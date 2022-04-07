import type { Node } from './Node';

export class NodeStorage {
	nodes: Node[] = [];
	addNode(node: Node) {
		this.nodes.push(node);
	}
	removeNode(node: Node) {
		node.cleanup();
		this.nodes = this.nodes.filter((n) => n !== node);
	}
	// duplicateNode(node: Node) {
	// 	// const newNode = node.duplicate();
	// 	// this.addNode(newNode);
	// 	// return newNode;
	// }
}
