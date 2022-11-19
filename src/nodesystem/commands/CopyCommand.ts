import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';

export class CopyCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
		if (!(this.nodeSystem.editorState.selectedNodes?.length > 0)) {
			return;
		}
		const data = this.nodeSystem.exportNodes(this.nodeSystem.editorState.selectedNodes);
		await navigator.clipboard.writeText(JSON.stringify(data));
	}
}
