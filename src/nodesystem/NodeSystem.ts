import { NodeConnectionHandler } from './handlers/NodeConnectionHandler';
import { NodesystemEventHandler } from './handlers/NodesystemEventHandler';
import { NodeStorage } from './NodeStorage';
import { NodeRenderer } from './NodeRenderer';
import { Config } from './Config';
import { playground } from './example_playground';
import type { NodeSaveFile } from './NodeSaveFile';
import { Toolbar } from './toolbar/Toolbar';
import { nodeClassesMap } from './nodes/nodes';
import './nodesystem.css';
import type { NodeSaveData } from './NodeSaveData';
import { getBoundingBoxOfMultipleNodes, positionNode, uuid } from './utils';
import type { Node } from './Node';
import { ToastMessage } from './toastmessage/ToastMessage';
export class NodeSystem {
	eventHandler: NodesystemEventHandler;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	nodeRenderer: NodeRenderer;
	config: Config;
	toolbar: Toolbar;
	saveId = -1;
	filename = 'Example';

	constructor(
		public canvas: HTMLCanvasElement,
		public htmlCanvasOverlayContainer: HTMLDivElement,
		public htmlOverlayContainer: HTMLDivElement
	) {
		this.reset();
		this.config.setConfig(playground.config);
		this.loadSave(playground, 'Untitled', -1, true);
	}

	save() {
		const save: NodeSaveFile = {
			...this.exportNodes(this.nodeStorage.nodes),
			config: this.config.toObject()
		};

		return save;
	}

	loadSave(save: NodeSaveFile, filename: string, saveId: number, silent=false) {
		try {
			this.importNodes(save);
		} catch {
			new ToastMessage('Failed to load save', 'danger').show();
			this.reset();
			return;
		}
		this.nodeRenderer.render();
		this.filename = filename;
		this.saveId = saveId;
		this.displayFileInfo();
		if (!silent) new ToastMessage('Loaded save: ' + filename).show();
	}

	reset() {
		if (this.nodeStorage?.nodes?.length > 0) {
			this.nodeStorage.nodes.forEach((node) => {
				node.cleanup();
			});
		}
		if (this.eventHandler) this.eventHandler.removeEventListeners();

		delete this.eventHandler;
		delete this.nodeConnectionHandler;
		delete this.nodeStorage;
		delete this.nodeRenderer;
		delete this.config;
		delete this.toolbar;

		this.saveId = -1;
		this.filename = 'Untitled';
		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.eventHandler = new NodesystemEventHandler(this, this.canvas);
		this.nodeRenderer = new NodeRenderer(this.canvas, this);
		this.nodeStorage = new NodeStorage();
		this.toolbar = new Toolbar(this);
		this.config = new Config();
		this.htmlCanvasOverlayContainer.style.transform = `translate(${0}px, ${0}px)`;
		this.displayFileInfo();
	}

	displayFileInfo() {
		this.htmlOverlayContainer.textContent = '';
		const filenameEl = document.createElement('p');
		filenameEl.className = 'filename';
		filenameEl.innerText = this.filename;
		this.htmlOverlayContainer.appendChild(filenameEl);
	}

	exportNodes(
		nodesToExport: Node[],
	): {
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
		rename = false,
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
	}
}
