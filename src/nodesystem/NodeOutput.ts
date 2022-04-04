import type { NodeValueType } from './NodeValueType';
import type { Node } from './Node';

export class NodeOutput {
	value: boolean | number | string = false;
	node: Node;
	index: number;
	constructor(public id: string, public name: string, public valueType: NodeValueType) {}

	setValue(value: string | number | boolean) {
		this.value = value;
		this.node.nodeConnectionHandler.updateValue(this);
	}

	setNode(node: Node, index: number) {
		this.node = node;
		this.index = index;
	}
}
