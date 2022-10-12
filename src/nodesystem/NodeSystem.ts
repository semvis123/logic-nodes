import { NodeConnectionHandler } from './handlers/NodeConnectionHandler';
import { NodeSystemEventHandler } from './handlers/NodeSystemEventHandler';
import { NodeStorage } from './NodeStorage';
import { NodeRenderer } from './NodeRenderer';
import { Config } from './Config';
import { playground } from './example_playground';
import type { NodeSaveFile } from './NodeSaveFile';
import { Toolbar } from './toolbar/Toolbar';
import { nodeClassesMap } from './nodes/nodes';
import './nodeSystem.css';
import type { NodeSaveData } from './NodeSaveData';
import { getBoundingBoxOfMultipleNodes, positionNode, uuid } from './utils';
import type { Node } from './Node';
import { ToastMessage } from './toastMessage/ToastMessage';
import { BottomToolbar } from './toolbar/BottomToolbar';
import { SaveManager } from './SaveManager';
import { TickSystem } from './TickSystem';

const maxUndoHistory = 5000;

export class NodeSystem {
	eventHandler: NodeSystemEventHandler;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	nodeRenderer?: NodeRenderer;
	config: Config;
	toolbar: Toolbar;
	bottomToolbar: BottomToolbar;
	saveId = -1;
	filename = 'Example';
	isCustomNode = false;
	history = [];
	historyLevel = -1;
	restoringHistory = false;
	snapshotTimer: NodeJS.Timeout;
	saveManager: SaveManager;
	tickSystem: TickSystem;

	constructor(
		public canvas: HTMLCanvasElement,
		public htmlCanvasOverlayContainer: HTMLDivElement,
		public htmlOverlayContainer: HTMLDivElement
	) {
		this.reset();
		this.saveManager.loadSaveFile(playground, 'Untitled', -1, true);
	}

	snapshot() {
		if (this.restoringHistory) return; // we don't want a snapshot during a snapshot restore.

		this.autoSave();

		const save = this.saveManager.createSaveFile();

		while (this.history.length - 1 != this.historyLevel) {
			// overwrite the existing history
			this.history.pop();
		}
		if (this.history.length > maxUndoHistory) {
			this.history.shift();
			this.historyLevel--;
		}
		this.history.push(save);
		this.historyLevel++;
	}

	autoSave() {
		const save = this.saveManager.createSaveFile();
		if (!this.snapshotTimer) {
			this.snapshotTimer = setTimeout(() => {
				// autosave
				const nonAutosave = this.saveManager.getSaveFile(this.saveId, false, this.isCustomNode);
				if (JSON.stringify(save) == nonAutosave) {
					return; // don't override autosave when there are no changes compared to the save.
				}
				this.saveManager.saveToLocalStorage(save, this.filename, this.saveId, true);
				new ToastMessage('Autosaved', 'info', 500).show();
				this.snapshotTimer = undefined;
			}, 10000);
		}
	}

	undo() {
		if (this.historyLevel <= 0) {
			new ToastMessage('Cannot undo', 'warning', 1500).show();
			return;
		}
		this.restoringHistory = true;
		try {
			this.historyLevel--;
			this.reset(false);
			this.saveManager.loadSaveFile(this.history[this.historyLevel], this.filename, this.saveId, true);

			new ToastMessage(`Undo ${this.historyLevel}/${this.history.length - 1}`, 'info', 1000).show();
			this.autoSave();
		} finally {
			this.restoringHistory = false;
		}
	}

	redo() {
		if (this.historyLevel == this.history.length - 1) {
			new ToastMessage('Cannot redo', 'warning', 1500).show();
			return;
		}

		this.restoringHistory = true;
		try {
			this.historyLevel++;
			this.reset(false);
			this.saveManager.loadSaveFile(this.history[this.historyLevel], this.filename, this.saveId, true);
			new ToastMessage(`Redo ${this.historyLevel}/${this.history.length - 1}`, 'info', 1000).show();
			this.autoSave();
		} finally {
			this.restoringHistory = false;
		}
	}

	reset(full = true) {
		if (this.snapshotTimer) {
			clearTimeout(this.snapshotTimer);
			this.snapshotTimer = undefined;
		}

		if (this.nodeStorage?.nodes?.length > 0) {
			this.nodeStorage.nodes.forEach((node) => {
				node.cleanup();
			});
		}

		const prevDpi = this.nodeRenderer?.dpi;

		if (full) {
			if (this.eventHandler) this.eventHandler.cleanup();

			delete this.eventHandler;
			delete this.nodeRenderer;
			delete this.config;
			delete this.toolbar;
			delete this.bottomToolbar;
		}

		delete this.nodeConnectionHandler;
		delete this.nodeStorage;
		delete this.saveManager;
		this.tickSystem && this.tickSystem.stop();
		delete this.tickSystem;

		this.saveId = -1;
		this.filename = 'Untitled';
		this.isCustomNode = false;
		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.nodeStorage = new NodeStorage();
		this.saveManager = new SaveManager(this);
		this.tickSystem = new TickSystem(this.nodeConnectionHandler);

		if (full) {
			this.eventHandler = new NodeSystemEventHandler(this, this.canvas);
			this.nodeRenderer = new NodeRenderer(this.canvas, this);
			this.nodeRenderer.setDPI(prevDpi);
			this.toolbar = new Toolbar(this);
			this.bottomToolbar = new BottomToolbar(this);
			this.config = new Config();
			this.htmlCanvasOverlayContainer.style.transform = `translate(${0}px, ${0}px)`;
		}
		this.tickSystem.start();
		this.displayFileInfo();
	}

	displayFileInfo() {
		this.bottomToolbar.setFileName(this.filename);
	}

	exportNodes(nodesToExport: Node[]): {
		nodes: NodeSaveData[];
		connections: NodeSaveFile['connections'];
	} {
		const data = { nodes: [], connections: [] };
		const inputsAndOutputs: Set<string> = new Set();
		nodesToExport.forEach((node) => {
			const nodeSave = node.save();

			data.nodes.push(nodeSave);
			node.inputs.forEach((input) => {
				inputsAndOutputs.add(input.id);
			});
			node.outputs.forEach((output) => {
				inputsAndOutputs.add(output.id);
			});
		});

		this.nodeConnectionHandler.connections.forEach((toInputs, fromOutput) => {
			if (inputsAndOutputs.has(fromOutput.id)) {
				// save the connection
				toInputs.forEach((input) => {
					if (inputsAndOutputs.has(input.id)) {
						const fromNodeId = fromOutput.node.id;
						const fromIdx = fromOutput.index;
						const toNodeId = input.node.id;
						const toIdx = input.index;
						data.connections.push({
							from: { nodeId: fromNodeId, index: fromIdx },
							to: { nodeId: toNodeId, index: toIdx }
						});
					}
				});
			}
		});
		return data;
	}

	importNodes(
		data: {
			nodes: NodeSaveData[];
			connections: NodeSaveFile['connections'];
		},
		addSelection = false,
		rename = false
	) {
		const nodes: NodeSaveData[] = data.nodes;
		const nodeNames = new Map<string, string>();
		const pastedNodes: Node[] = [];
		nodes.forEach((node) => {
			const newNode = nodeClassesMap[node.type].load(node, this);
			if (rename) newNode.id = uuid();
			nodeNames.set(node.id, newNode.id);
			this.nodeStorage.addNode(newNode);
			pastedNodes.push(newNode);
		});

		for (const connection of data.connections) {
			const fromNode = this.nodeStorage.getNodeById(nodeNames.get(connection.from.nodeId));
			const toNode = this.nodeStorage.getNodeById(nodeNames.get(connection.to.nodeId));
			if (fromNode && toNode) {
				this.nodeConnectionHandler.addConnection(
					fromNode.outputs[connection.from.index],
					toNode.inputs[connection.to.index]
				);
			}
		}

		if (addSelection) {
			this.eventHandler.selectedNodes = pastedNodes;
			const box = getBoundingBoxOfMultipleNodes(this.eventHandler.selectedNodes);
			const translation = positionNode(
				box,
				box.x,
				box.y,
				this.nodeStorage,
				this.config,
				this.eventHandler.selectedNodes
			);
			this.eventHandler.selectedNodes.forEach((node) => {
				node.x += translation.x;
				node.y += translation.y;
			});
		}
		this.snapshot();
		this.nodeRenderer?.requestRender();
	}
}
