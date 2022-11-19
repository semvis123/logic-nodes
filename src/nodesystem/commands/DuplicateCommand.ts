import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';

export class DuplicateCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
		const nodeData = this.nodeSystem.exportNodes(this.nodeSystem.editorState.selectedNodes);
		this.nodeSystem.importNodes(nodeData, true, true);
	}
}
