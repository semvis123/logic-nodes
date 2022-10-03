import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';

export class EditNodeCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		const node = this.selectedNodes?.[0];
		if (node == undefined) return;

		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.removeEventListeners();
		try {
			node.parameters = await popup.requestParameters('Edit', node.getMetadata().parameters);
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
		node.reset();
		this.nodeSystem.nodeRenderer.requestRender();
		this.nodeSystem.snapshot();
	}
}
