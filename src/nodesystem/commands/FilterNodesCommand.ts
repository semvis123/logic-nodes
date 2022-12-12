import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import { FullscreenPrompt, type NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';

export class FilterNodesCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
        const nodeTypes = new Set<string>();
        const filterParameters = new Set<NodeParameter>();
        for (const node of this.nodeSystem.editorState.selectedNodes) {
            nodeTypes.add(node.getMetadata().nodeName);
        }
        for (const nodeType of nodeTypes) {
            filterParameters.add({
                name: nodeType,
                label: nodeType,
                type: 'checkbox',
                checked: true,
            });
        }

        const popup = new FullscreenPrompt();
        this.nodeSystem.eventHandler.cleanup();
        try {
            const params = await popup.requestParameters('Filter', Array.from(filterParameters));
            if (params == null) return;
            const filteredNodes = []
            for (const node of this.nodeSystem.editorState.selectedNodes) {
                const param = params.find((p) => p.name == node.getMetadata().nodeName);
                if (param == null) continue;
                if (param.checked) {
                    filteredNodes.push(node);
                }
            }
            
            this.nodeSystem.editorState.selectedNodes = filteredNodes;
            this.nodeSystem.nodeRenderer.requestRender();
        }
        finally {
            this.nodeSystem.eventHandler.addEventListeners();
        }
	}
}
