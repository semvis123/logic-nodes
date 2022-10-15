import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';

export class SelectAllCommand extends Command {
	async execute() {
		this.nodeSystem.eventHandler.selectedNodes = this.nodeSystem.nodeStorage.nodes;
		this.nodeSystem.nodeRenderer.requestRender();
	}
}
