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

export class CombinationNode extends Node {
	padding = 7;
	currentValue = 0;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	saveManager: SaveManager;
	inputNodes: InputNode[];
	outputNodes: OutputNode[];
	config: Config;

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
		}
	];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 30, 30, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.saveManager = nodeSystem.saveManager;
		this.importParams(parameters);
		this.reset();
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'CombinationNode',
			displayName: 'Chip',
			category: 'Misc',
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

		const textMetrics = ctx.measureText(this.getParamValue('nodeName', 'Label'));
		this.width = textMetrics.width + this.padding * 4;


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

		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.nodeStorage = new NodeStorage();
		this.config = new Config();
		const save = JSON.parse(this.nodeSystem.saveManager.getSaveFile(this.getParamValue('saveId', -1), false, true));
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
	}

	update() {
		this.inputNodes.forEach((inputNode, i) => {
			inputNode.outputs[0].value = this.inputs[i]?.value;
			this.nodeConnectionHandler.updateValue(inputNode.outputs[0]);
		});
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
