import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';

export class NotNode extends Node {
	constructor(id: string, x: number, y: number, nodeSystem: NodeSystem) {
		super(
			id,
			'Not',
			x,
			y,
			40,
			40,
			[new NodeInput(uuid(), 'a', NodeValueType.Number)],
			[new NodeOutput(uuid(), 'output', NodeValueType.Number)],
			nodeSystem
		);
	}

	update() {
		this.outputs[0].setValue((this.inputs[0].value as number) === 0 ? 1 : 0);
	}
}
