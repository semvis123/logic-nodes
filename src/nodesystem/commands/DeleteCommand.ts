import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';

export class DeleteCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
		this.nodeSystem.editorState.selectedNodes?.forEach((node) => {
			this.nodeSystem.nodeStorage.removeNode(node);
		});
		this.nodeSystem.nodeRenderer.requestRender();
		this.nodeSystem.editorState.selectedNodes = [];
		this.nodeSystem.snapshot();
	}
}
