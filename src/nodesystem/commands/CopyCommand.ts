import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';

export class CopyCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		const data = this.nodeSystem.exportNodes(this.selectedNodes);
		await navigator.clipboard.writeText(JSON.stringify(data));
	}
}
