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
	getNodeById(from: string): Node {
		return this.nodes.find((n) => n.id === from);
	}
}
