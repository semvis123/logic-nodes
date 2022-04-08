import { NodeConnectionHandler } from './handlers/NodeConnectionHandler';
import { NodeMouseEventHandler } from './handlers/NodeMouseEventHandler';
import { ClockNode } from './nodes/ClockNode';
import { DisplayNode } from './nodes/DisplayNode';
import { HtmlOverlayNode } from './nodes/HtmlOverlayNode';
import { AndNode } from './nodes/LogicAndNode';
import { NotNode } from './nodes/LogicNotNode';
import { OrNode } from './nodes/LogicOrNode';
import { ToggleNode } from './nodes/ToggleNode';
import { NodeStorage } from './NodeStorage';
import { NodeRenderer } from './NodeRenderer';
import { DelayNode } from './nodes/DelayNode';
import { Config } from './Config';
import { playground } from './example_playground';
import type { NodeSaveFile } from './NodeSaveFile';
import { Toolbar } from './toolbar/Toolbar';
export class NodeSystem {
	nodeClickHandler: NodeMouseEventHandler;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	nodeRenderer: NodeRenderer;
	config: Config;
	toolbar: Toolbar;

	constructor(public canvas: HTMLCanvasElement) {
		this.reset();
		this.config.setConfig(playground.config);
		this.loadSave(playground);
	}
	save() {
		return { test: 'hoi' };
	}

	loadSave(save: NodeSaveFile) {
		for (const node of save.nodes) {
			switch (node.type) {
				case 'ToggleNode':
					this.nodeStorage.addNode(new ToggleNode(node.id, node.x, node.y, this, node.defaultValue));
					break;
				case 'ClockNode':
					this.nodeStorage.addNode(new ClockNode(node.id, node.x, node.y, this, node.interval));
					break;
				case 'AndNode':
					this.nodeStorage.addNode(new AndNode(node.id, node.x, node.y, this));
					break;
				case 'OrNode':
					this.nodeStorage.addNode(new OrNode(node.id, node.x, node.y, this));
					break;
				case 'NotNode':
					this.nodeStorage.addNode(new NotNode(node.id, node.x, node.y, this));
					break;
				case 'DisplayNode':
					this.nodeStorage.addNode(new DisplayNode(node.id, node.x, node.y, this));
					break;
				case 'DelayNode':
					this.nodeStorage.addNode(new DelayNode(node.id, node.x, node.y, this, node.delay));
					break;
				case 'HtmlOverlayNode':
					this.nodeStorage.addNode(new HtmlOverlayNode(node.id, node.x, node.y, this));
					break;
			}
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
	}

	reset() {
		if (this.nodeStorage?.nodes?.length > 0) {
			this.nodeStorage.nodes.forEach((node) => {
				node.cleanup();
			});
		}

		const canvasCopy = this.canvas.cloneNode(true);
		this.canvas.parentNode.replaceChild(canvasCopy, this.canvas);
		this.canvas = canvasCopy as HTMLCanvasElement;

		delete this.nodeClickHandler;
		delete this.nodeConnectionHandler;
		delete this.nodeStorage;
		delete this.nodeRenderer;
		delete this.config;
		delete this.toolbar;

		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.nodeClickHandler = new NodeMouseEventHandler(this, this.canvas);
		this.nodeRenderer = new NodeRenderer(this.canvas, this);
		this.nodeStorage = new NodeStorage();
		this.toolbar = new Toolbar(this);
		this.config = new Config();
	}
}
