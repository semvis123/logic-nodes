import type { NodeOutput } from '../NodeOutput';
import type { NodeInput } from '../NodeInput';
import type { Node } from '../Node';
import type { Config } from '../Config';
export class NodeConnectionHandler {
	connections: Map<NodeOutput, NodeInput[]> = new Map();
	toUpdate: Set<NodeOutput> = new Set();

	removeAllConnections(node: Node) {
		this.connections.forEach((toInputs, fromOutput) => {
			for (const toInput of toInputs) {
				if (toInput.node === node) {
					if (!this.removeConnection(fromOutput, toInput)) throw 'could not remove connection';
				}
			}
		});
		for (const output of node.outputs) {
			this.connections.delete(output);
		}
	}

	addConnection(fromOutput: NodeOutput, toInput: NodeInput) {
		if (!this.connections.has(fromOutput)) {
			this.connections.set(fromOutput, []);
		}
		this.removeFirstConnection(toInput);
		this.connections.get(fromOutput).push(toInput);
		fromOutput.node.update();
		this.updateValue(fromOutput);
	}

	removeConnection(fromOutput: NodeOutput, toInput: NodeInput) {
		const connections = this.connections.get(fromOutput);
		if (connections) {
			const index = connections.findIndex((c) => c === toInput);
			if (index > -1) {
				connections.splice(index, 1);
				toInput.setValue(false);
				toInput.node.update();
				return true;
			}
		}
		return false;
	}

	removeFirstConnection(toInput: NodeInput) {
		for (const [output, inputs] of this.connections) {
			for (const input of inputs) {
				if (input == toInput) {
					if (!this.removeConnection(output, input)) throw 'could not remove connection';
					return [output, input];
				}
			}
		}
		return false;
	}

	updateValue(output: NodeOutput) {
		this.toUpdate.add(output);
	}

	updateAllValues() {
		const updateSnapshot = Array.from(this.toUpdate);
		this.toUpdate.clear();

		updateSnapshot.forEach((output) => {
			const connections = this.connections.get(output);
			if (connections) {
				connections.forEach((input) => {
					if (input.value != output.value) {
						input.setValue(output.value);
						input.node?.update();
					}
				});
			}
		});
		if (updateSnapshot.length > 0) {
			updateSnapshot[0].node.nodeSystem.nodeRenderer?.requestRender();
		}
	}

	renderConnections(ctx: CanvasRenderingContext2D, config: Config) {
		this.connections.forEach((toInputs, fromOutput) => {
			toInputs.forEach((toInput) => {
				if (toInput === undefined) return;
				ctx.beginPath();
				if (config.colorConnectionLines)
					ctx.strokeStyle = fromOutput.value ? config.theme.nodeHighColor : config.theme.nodeLowColor;
				else ctx.strokeStyle = config.theme.connectionColor;
				const toX = toInput.node.x - config.theme.connectionPointRadius;
				const inputOffset = (toInput.node.height / (toInput.node.inputs.length + 1)) * (toInput.index + 1);
				const toY = toInput.node.y + inputOffset;
				const fromX = fromOutput.node.x + fromOutput.node.width + config.theme.connectionPointRadius;
				const outputOffset = (fromOutput.node.height / (fromOutput.node.outputs.length + 1)) * (fromOutput.index + 1);
				const fromY = fromOutput.node.y + outputOffset;
				ctx.moveTo(fromX, fromY);
				const controlOffsetX = -(fromOutput.node.x - toInput.node.x) / 5;
				const controlOffsetY = -(fromOutput.node.y - toInput.node.y) / 5;
				ctx.bezierCurveTo(
					fromX + controlOffsetX,
					fromY + controlOffsetY,
					toX - controlOffsetX,
					toY - controlOffsetY,
					toX,
					toY
				);
				ctx.stroke();
			});
		});
	}
}
