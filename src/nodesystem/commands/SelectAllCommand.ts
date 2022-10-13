import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';

export class SelectAllCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
		this.nodeSystem.eventHandler.selectedNodes = this.nodeSystem.nodeStorage.nodes;
		this.nodeSystem.nodeRenderer.requestRender();
	}
}
