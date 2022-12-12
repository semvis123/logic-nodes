import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import { FullscreenPrompt, type NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';

export class FilterNodesCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
		const displayNames = new Set<string>();
		const filterParameters = new Set<NodeParameter>();
		for (const node of this.nodeSystem.editorState.selectedNodes) {
			displayNames.add(node.getMetadata().displayName);
		}
		for (const displayName of displayNames) {
			filterParameters.add({
				name: displayName,
				label: displayName,
				type: 'checkbox',
				checked: true
			});
		}

		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.cleanup();
		try {
			const params = await popup.requestParameters('Filter selection', Array.from(filterParameters));
			if (params == null) return;
			const filteredNodes = [];
			for (const node of this.nodeSystem.editorState.selectedNodes) {
				const param = params.find((p) => p.name == node.getMetadata().displayName);
				if (param == null) continue;
				if (param.checked) {
					filteredNodes.push(node);
				}
			}

			this.nodeSystem.editorState.selectedNodes = filteredNodes;
			this.nodeSystem.nodeRenderer.requestRender();
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}
}
