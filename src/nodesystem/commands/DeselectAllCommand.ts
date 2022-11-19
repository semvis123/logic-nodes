import { Command } from './Command';

export class DeselectAllCommand extends Command {
	async execute() {
		this.nodeSystem.editorState.selectedNodes = [];
		this.nodeSystem.nodeRenderer.requestRender();
	}
}
