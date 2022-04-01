import type { NodeValueType } from './NodeValueType';
import type { Node } from './Node';

export class NodeInput {
	node: Node;
	constructor(
		public id: string,
		public name: string,
		public valueType: NodeValueType,
		public index
	) {}

	setNode(node: Node) {
		this.node = node;
	}
}
