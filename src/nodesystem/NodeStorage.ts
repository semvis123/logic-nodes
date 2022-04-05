import type { Node } from './Node';

export class NodeStorage {
	nodes: Node[] = [];
	addNode(node: Node) {
		this.nodes.push(node);
	}
	removeNode(node: Node) {
		this.nodes = this.nodes.filter((n) => n !== node);
	}
}
