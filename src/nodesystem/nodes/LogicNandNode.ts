import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class NandNode extends Node {
	parameters: NodeParameter[] = [
		{
			name: 'inputs',
			label: 'Inputs',
			value: 2,
			type: 'number',
			required: true,
			min: 1
		}
	];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(
			id,
			x,
			y,
			40,
			40,
			[new NodeInput(uuid(), 'a', NodeValueType.Number), new NodeInput(uuid(), 'b', NodeValueType.Number)],
			[new NodeOutput(uuid(), 'output', NodeValueType.Number)],
			nodeSystem
		);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'NandNode',
			displayName: 'NAND',
			category: 'Logic',
			parameters: this.parameters
		};
	}

	reset() {
		while (this.inputs.length > this.getParamValue('inputs', 2)) {
			// remove inputs
			this.nodeSystem.nodeConnectionHandler.removeFirstConnection(this.inputs[this.inputs.length - 1]);
		}
		while (this.inputs.length < this.getParamValue('inputs', 2)) {
			this.inputs.push(new NodeInput(uuid(), '-', NodeValueType.Number));
		}
		this.inputs.forEach((input, i) => input.setNode(this, i));
		this.height = Math.max(this.inputs.length * 20, 40);
	}

	update() {
		let value = 1;
		this.inputs.forEach((input) => {
			value &= input.value as number;
		});

		this.outputs[0].setValue(1 - value);
	}
}
