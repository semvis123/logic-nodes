import { NodeConnectionHandler } from './handlers/NodeConnectionHandler';
import { NodesystemEventHandler } from './handlers/NodeMouseEventHandler';
import { NodeStorage } from './NodeStorage';
import { NodeRenderer } from './NodeRenderer';
import { Config } from './Config';
import { playground } from './example_playground';
import type { NodeSaveFile } from './NodeSaveFile';
import { Toolbar } from './toolbar/Toolbar';
import { nodeClassesMap } from './nodes/nodes';

export class NodeSystem {
	eventHandler: NodesystemEventHandler;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	nodeRenderer: NodeRenderer;
	config: Config;
	toolbar: Toolbar;
	saveId = -1;
	filename = 'Example'

	constructor(public canvas: HTMLCanvasElement, public htmlCanvasOverlayContainer: HTMLDivElement) {
		this.reset();
		this.config.setConfig(playground.config);
		this.loadSave(playground);
	}

	save() {
		const save: NodeSaveFile = {
			nodes: [],
			connections: [],
			config: this.config.toObject()
		};

		this.nodeStorage.nodes.forEach((node) => {
			save.nodes.push({ type: node.constructor.name, ...node.save() });
		});

		this.nodeConnectionHandler.connections.forEach((inputs, output) => {
			inputs.forEach((input) => {
				save.connections.push({
					from: {
						nodeId: output.node.id,
						index: output.index
					},
					to: {
						nodeId: input.node.id,
						index: input.index
					}
				});
			});
		});

		return save;
	}

	loadSave(save: NodeSaveFile) {		
		for (const node of save.nodes) {
			const newNode = nodeClassesMap[node.type].load(node, this);
			this.nodeStorage.addNode(newNode);
		}

		for (const connection of save.connections) {
			const fromNode = this.nodeStorage.getNodeById(connection.from.nodeId);
			const toNode = this.nodeStorage.getNodeById(connection.to.nodeId);
			if (fromNode && toNode) {
				this.nodeConnectionHandler.addConnection(
					fromNode.outputs[connection.from.index],
					toNode.inputs[connection.to.index]
				);
			}
		}

		this.nodeRenderer.render();
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
		this.filename = 'Example'
		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.eventHandler = new NodesystemEventHandler(this, this.canvas);
		this.nodeRenderer = new NodeRenderer(this.canvas, this);
		this.nodeStorage = new NodeStorage();
		this.toolbar = new Toolbar(this);
		this.config = new Config();
		this.htmlCanvasOverlayContainer.style.transform = `translate(${0}px, ${0}px)`;
	}
}
