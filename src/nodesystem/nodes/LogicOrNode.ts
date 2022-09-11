import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class OrNode extends Node {
	parameters: NodeParameter[] = [];

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
			nodeName: 'OrNode',
			displayName: 'OR',
			category: 'Logic',
			parameters: this.parameters
		};
	}

	update() {
		this.outputs[0].setValue((this.inputs[0].value as number) | (this.inputs[1].value as number));
	}
}
