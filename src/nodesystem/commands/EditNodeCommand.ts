import { FullscreenPrompt, type NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';

export class EditNodeCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		const commonParameters = this.findCommonParameters(this.selectedNodes);
		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.cleanup();
		try {
			const params = await popup.requestParameters('Edit', commonParameters);
			if (params == null) return;
			for (const node of this.selectedNodes) {
				for (const param of params) {
					const changedParam = node.parameters.find((p) => p.name == param.name);
					if (changedParam == null) continue;
					if (changedParam.type == 'checkbox') {
						changedParam.checked = param.checked;
					} else {
						changedParam.value = param.value;
					}
				}
				node.reset();
			}
			this.nodeSystem.nodeRenderer.requestRender();
			this.nodeSystem.snapshot();
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}

	findCommonParameters(nodes: Node[]) {
		const commonParameters: NodeParameter[] = [];
		const parameters = nodes.map((node) => node.getMetadata().parameters);
		for (const parameter of parameters[0]) {
			if (
				parameters.every((p) =>
					p.find(
						(p2) =>
							p2.name == parameter.name &&
							(p2.value ?? 1) == (parameter.value ?? 1) &&
							(p2.checked ?? 1) == (parameter.checked ?? 1)
					)
				)
			) {
				commonParameters.push(parameter);
			}
		}
		return commonParameters;
	}
}
