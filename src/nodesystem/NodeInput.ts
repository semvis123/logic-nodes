import type { NodeValueType } from './NodeValueType';
import type { Node } from './Node';

export class NodeInput {
	node: Node;
	index: number;
	value: number | string | boolean = 0;
	constructor(public id: string, public name: string, public valueType: NodeValueType) {}

	setNode(node: Node, index: number) {
		this.node = node;
		this.index = index;
	}

	setValue(value: string | number | boolean) {
		this.value = value;
	}
}
