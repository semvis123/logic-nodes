import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, textColor, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';
import { NodeInput } from '../NodeInput';
import { NodeStorage } from '../NodeStorage';
import { NodeConnectionHandler } from '../handlers/NodeConnectionHandler';
import type { NodeSaveData } from '../NodeSaveData';
import type { NodeSaveFile } from '../NodeSaveFile';
import { nodeClassesMap } from './nodes';
import { Config } from '../Config';
import type { OutputNode } from './OutputNode';
import type { InputNode } from './InputNode';
import type { SaveManager } from '../SaveManager';
import { TickSystem } from '../TickSystem';
import { ToastMessage } from '../toastMessage/ToastMessage';

export class CustomNode extends Node {
	padding = 7;
	currentValue = 0;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	dependencies: {
		[dependencyId: string]: NodeSaveFile;
	};
	saveManager: SaveManager;
	inputNodes: InputNode[];
	outputNodes: OutputNode[];
	config: Config;
	inputNodeSize: number;
	outputNodeSize: number;

	parameters: NodeParameter[] = [
		{
			name: 'saveId',
			label: 'SaveId',
			value: '5',
			type: 'text'
		},
		{
			name: 'nodeName',
			label: 'Name',
			value: '',
			type: 'text'
		},
		{
			name: 'color',
			label: 'Color',
			value: '#000',
			type: 'color'
		},
		{
			name: 'instant',
			label: 'Instant',
			checked: false,
			type: 'checkbox'
		}
	];
	tickSystem: TickSystem;

	constructor(
		id: string,
		x: number,
		y: number,
		layer: number,
		public nodeSystem: NodeSystem,
		parameters?: NodeParameter[]
	) {
		super(id, x, y, 30, 30, layer, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.saveManager = nodeSystem.saveManager;
		this.importParams(parameters);
		this.reset();
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'CombinationNode',
			displayName: 'Chip',
			category: 'Misc',
			hideFromMenu: true,
			parameters: this.parameters
		};
	}

	renderNode(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = this.style.color;
		ctx.strokeStyle = this.style.borderColor;
		ctx.lineWidth = this.style.borderWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const path = roundRect(0, 0, this.width, this.height, this.style.borderRadius);
		ctx.stroke(path);
		ctx.fill(path);

		this.renderConnectionPoints(ctx);

		ctx.fillStyle = this.getParamValue('color', '#000');
		ctx.fillRect(this.padding, this.padding, this.width - this.padding * 2, this.height - this.padding * 2);
		ctx.strokeStyle = this.nodeSystem.config.theme.nodeBorderColor;
		ctx.strokeRect(this.padding, this.padding, this.width - this.padding * 2, this.height - this.padding * 2);
		ctx.fillStyle = textColor(this.getParamValue('color', '#000'));
		ctx.fillText(this.getParamValue('nodeName', 'Label'), this.width / 2, this.height / 2);
	}

	reset() {
		// setup mini nodeSystem
		if (this.nodeStorage?.nodes?.length > 0) {
			this.nodeStorage.nodes.forEach((node) => {
				node.cleanup(false);
			});
		}

		delete this.nodeConnectionHandler;
		delete this.nodeStorage;
		delete this.config;
		this.tickSystem?.stop();
		delete this.tickSystem;

		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.nodeStorage = new NodeStorage();
		if (!this.getParamValue('instant', false)) {
			this.tickSystem = new TickSystem(this.nodeConnectionHandler);
			this.tickSystem.start();
		}
		this.config = new Config();
		this.dependencies = this.nodeSystem.dependencies;
		const save = this.nodeSystem.saveManager.getCustomNodeSaveFileWithDependencies(
			this.getParamValue('saveId', 'unsaved')
		);
		if (!save) {
			throw new Error(
				`Save with id ${this.getParamValue('saveId', 'unsaved')} not found, needed for node ${
					this.id
				} (${this.getParamValue('nodeName', 'Label')})`
			);
		}
		this.importNodes(save);
		this.inputNodes = [];
		this.outputNodes = [];
		this.nodeStorage.nodes.sort((a, b) => a.y - b.y);
		this.nodeStorage.nodes.forEach((node) => {
			if (node.getMetadata().nodeName == 'InputNode') {
				// add as input
				this.inputNodes.push(node as InputNode);
			} else if (node.getMetadata().nodeName == 'OutputNode') {
				// add an output
				this.outputNodes.push(node as OutputNode);
				(node as OutputNode).updateCallback = this.updateOutputs.bind(this);
			}
		});

		if (this.inputNodeSize == this.inputNodes.length && this.outputNodeSize == this.outputNodes.length) {
			// same input and output length, so we don't actually need to update the inputs and outputs
			return;
		}
		this.inputNodeSize = this.inputNodes.length;
		this.outputNodeSize = this.outputNodes.length;

		// setup inputs
		while (this.inputs.length > 0) {
			this.nodeSystem.nodeConnectionHandler.removeFirstConnection(this.inputs.pop());
		}

		while (this.inputs.length < this.inputNodes.length) {
			this.inputs.push(
				new NodeInput(uuid(), this.inputNodes[this.inputs.length].getParamValue('name', ''), NodeValueType.Number)
			);
		}

		this.inputs.forEach((input, i) => input.setNode(this, i));

		// setup outputs
		while (this.outputs.length > 0) {
			this.nodeSystem.nodeConnectionHandler.connections.delete(this.outputs.pop());
		}
		while (this.outputs.length < this.outputNodes.length) {
			this.outputs.push(
				new NodeOutput(uuid(), this.outputNodes[this.outputs.length].getParamValue('name', ''), NodeValueType.Number)
			);
		}

		this.outputs.forEach((output, i) => output.setNode(this, i));
		if (this.nodeSystem.nodeRenderer) {
			const ctx = this.nodeSystem.nodeRenderer.canvas.getContext('2d');
			ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
			const textMetrics = ctx.measureText(this.getParamValue('nodeName', 'Label')) ?? { width: 40 };
			this.width = textMetrics.width + this.padding * 4;
		}
		this.height = Math.max(Math.max(this.inputs.length, this.outputs.length) * 20, 40);
	}

	importNodes(
		data: {
			nodes: NodeSaveData[];
			connections: NodeSaveFile['connections'];
		},
		rename = false
	) {
		const nodes: NodeSaveData[] = data.nodes;
		const nodeNames = new Map<string, string>();
		const pastedNodes: Node[] = [];
		nodes.forEach((node) => {
			if (node.type == 'CombinationNode') {
				// if parent instant-mode is true, set child instant-mode to true
				node.parameters.forEach((param) => {
					if (param.name == 'instant') {
						param.checked = param.checked || this.getParamValue('instant', false);
					}
				});
			}
			const newNode = nodeClassesMap.get(node.type).load(node, this as unknown as NodeSystem);
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
	}

	update() {
		this.inputNodes.forEach((inputNode, i) => {
			inputNode.outputs[0].value = this.inputs[i]?.value;
			this.nodeConnectionHandler.updateValue(inputNode.outputs[0]);
		});
		if (this.getParamValue('instant', false)) {
			let limit = 50000;
			while (this.nodeConnectionHandler.toUpdate.size > 0 && limit-- > 0) {
				this.nodeConnectionHandler.updateAllValues();
			}
			if (limit <= 0) {
				this.getParam('instant').checked = false;
				new ToastMessage('Custom node detected a cycle, and disabled instant mode.', 'danger').show();
			}
			this.updateOutputs();
		}
	}

	updateOutputs() {
		this.outputs.forEach((output, i) => {
			output.setValue(this.outputNodes[i].inputs[0].value);
		});
	}

	onclick(e: MouseEvent, pos: { x: number; y: number }) {
		// if (
		// 	pos.x < this.padding ||
		// 	pos.x > this.width - this.padding ||
		// 	pos.y < this.padding ||
		// 	pos.y > this.height - this.padding
		// )
		// 	return true;

		// open the combination node maybe?

		// this.toggle();
		return true;
	}
}
