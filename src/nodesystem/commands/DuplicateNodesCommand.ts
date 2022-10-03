import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';

export class DuplicateNodesCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		const nodeData = this.nodeSystem.exportNodes(this.selectedNodes);
		this.nodeSystem.importNodes(nodeData, true, true);
	}
}
