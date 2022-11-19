import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';

export class ChangeLayerOfNodeCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		const nodes = this.selectedNodes ?? [];
		if (nodes.length == 0) return;

		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.cleanup();
		try {
			const newLayerParams = await popup
				.requestParameters('Move to layer', [
					{
						type: 'number',
						name: 'layer',
						value: this.nodeSystem.editorState.layer,
						min: 0,
						max: 9,
						step: 1
					}
				]);
			if (newLayerParams == null) return;
			const newLayer = parseInt(newLayerParams[0].value as string);
			nodes.forEach((node) => {
				node.layer = newLayer;
			});
			this.nodeSystem.editorState.selectedNodes = [];
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
		this.nodeSystem.nodeRenderer.requestRender();
		this.nodeSystem.snapshot();
	}
}
