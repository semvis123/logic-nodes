import type { NodeValueType } from './NodeValueType';
import type { Node } from './Node';

export class NodeOutput {
	node: Node;
	index: number;
	value: boolean | number | string = false;
	constructor(public id: string, public name: string, public valueType: NodeValueType) {}

	setValue(value: string | number | boolean) {
		this.value = value;
		this.node.nodeSystem.nodeConnectionHandler.updateValue(this);
	}

	setNode(node: Node, index: number) {
		this.node = node;
		this.index = index;
	}
}
