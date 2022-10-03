import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';

export class DeleteNodesCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		this.selectedNodes.forEach((node) => {
			this.nodeSystem.nodeStorage.removeNode(node);
			this.nodeSystem.nodeRenderer.requestRender();
		});
		this.nodeSystem.snapshot();
	}
}
