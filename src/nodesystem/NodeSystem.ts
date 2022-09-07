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

	constructor(public canvas: HTMLCanvasElement, public htmlCanvasOverlayContainer: HTMLDivElement) {
		this.reset();
		this.config.setConfig(playground.config);
		this.loadSave(playground);
	}

	save() {
		const save: NodeSaveFile = {
			nodes: [],
			connections: [],
			config: this.config,
		};

		this.nodeStorage.nodes.forEach((node) => {
			save.nodes.push({type: node.constructor.name, ...node.save()});
		});

		this.nodeConnectionHandler.connections.forEach((inputs, output) => {
			inputs.forEach(input => {				
				save.connections.push({
					from: {
						nodeId: output.node.id,
						index: output.index,
					},
					to: {
						nodeId: input.node.id,
						index: input.index,
					},
				});
			})
		});

		return save;
	}

	loadSave(save: NodeSaveFile) {
		const nodeClasses = [
			ToggleNode,
			AndNode,
			ClockNode,
			OrNode,
			NotNode,
			DisplayNode,
			DelayNode,
			HtmlOverlayNode
		]
		const nodeClassesMap = {};
		nodeClasses.forEach(nodeClass => {
			nodeClassesMap[nodeClass.name] = nodeClass;
		})

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
		if (this.nodeClickHandler) this.nodeClickHandler.removeEventListeners();

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
		this.htmlCanvasOverlayContainer.style.transform = `translate(${0}px, ${0}px)`;
	}
}
