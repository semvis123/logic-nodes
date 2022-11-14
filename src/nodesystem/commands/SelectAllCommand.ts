import { Command } from './Command';

export class SelectAllCommand extends Command {
	async execute() {
		this.nodeSystem.editorState.selectedNodes = this.nodeSystem.nodeStorage.nodes;
		this.nodeSystem.nodeRenderer.requestRender();
	}
}
