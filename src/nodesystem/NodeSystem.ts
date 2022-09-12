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
		this.loadSave(playground, 'Untitled', -1);
	}

	save() {
		const save: NodeSaveFile = {
			...this.exportNodes(this.nodeStorage.nodes),
			config: this.config.toObject()
		};

		return save;
	}

	loadSave(save: NodeSaveFile, filename: string, saveId: number) {
		this.importNodes(save);
		this.nodeRenderer.render();
		this.filename = filename;
		this.saveId = saveId;
		this.displayFileInfo();
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
		rename = false
	): {
		nodes: NodeSaveData[];
		connections: NodeSaveFile['connections'];
	} {
		const data = { nodes: [], connections: [] };
		const nodes = new Map<string, NodeSaveData>();
		const inputsAndOutputs: Set<string> = new Set();
		nodesToExport.forEach((node) => {
			const nodeSave = node.save();

			if (rename) nodeSave.id = uuid();

			data.nodes.push(nodeSave);
			nodes.set(node.id, nodeSave);
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
						const fromNodeId = nodes.get(fromOutput.node.id).id;
						const fromIdx = fromOutput.index;
						const toNodeId = nodes.get(input.node.id).id;
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
		addSelection = false
	) {
		const nodes: NodeSaveData[] = data.nodes;
		const pastedNodes: Node[] = [];
		nodes.forEach((node) => {
			const newNode = nodeClassesMap[node.type].load(node, this);
			this.nodeStorage.addNode(newNode);
			pastedNodes.push(newNode);
		});

		for (const connection of data.connections) {
			const fromNode = this.nodeStorage.getNodeById(connection.from.nodeId);
			const toNode = this.nodeStorage.getNodeById(connection.to.nodeId);
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
