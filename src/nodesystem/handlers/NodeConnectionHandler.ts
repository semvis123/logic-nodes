import type { NodeOutput } from '../NodeOutput';
import type { NodeInput } from '../NodeInput';
import type { Node } from '../Node';
import type { Config } from '../Config';
import type { EditorState } from '../EditorState';
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

	renderConnections(ctx: CanvasRenderingContext2D, config: Config, editorState: EditorState) {
		this.connections.forEach((toInputs, fromOutput) => {
			toInputs.forEach((toInput) => {
				if (toInput === undefined) return;
				if (fromOutput.node.layer !== editorState.layer && toInput.node.layer !== editorState.layer) return;
				ctx.beginPath();
				if (config.colorConnectionLines)
					ctx.strokeStyle = fromOutput.value ? config.theme.nodeHighColor : config.theme.nodeLowColor;
				else ctx.strokeStyle = config.theme.connectionColor;
				let toX = toInput.node.x - config.theme.connectionPointRadius;
				const inputOffset = (toInput.node.height / (toInput.node.inputs.length + 1)) * (toInput.index + 1);
				let toY = toInput.node.y + inputOffset;
				let fromX = fromOutput.node.x + fromOutput.node.width + config.theme.connectionPointRadius;
				const outputOffset = (fromOutput.node.height / (fromOutput.node.outputs.length + 1)) * (fromOutput.index + 1);
				let fromY = fromOutput.node.y + outputOffset;
				if (fromOutput.node.layer !== editorState.layer) {
					[toX, toY, fromX, fromY] = [fromX, fromY, toX, toY];
				}
				if (fromOutput.node.layer !== editorState.layer || toInput.node.layer !== editorState.layer) {
					if (fromOutput.node.layer !== editorState.layer) {
						toX = fromX - 25;
						toY = fromY + 25;
					} else {
						toX = fromX + 25;
						toY = fromY + 25;
					}
					const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
					gradient.addColorStop(0, ctx.strokeStyle);
					gradient.addColorStop(1, 'transparent');
					ctx.strokeStyle = gradient;
				}
				ctx.moveTo(fromX, fromY);

				if (config.connectionRenderMode == 'square') {
					ctx.lineTo((toX - fromX) / 2 + fromX, fromY);
					ctx.lineTo((toX - fromX) / 2 + fromX, toY);
					ctx.lineTo(toX, toY);
				} else {
					let controlOffsetX: number, controlOffsetY: number;
					if (toInput.node.layer !== editorState.layer) {
						controlOffsetX = 25;
						controlOffsetY = 5;
					} else if (fromOutput.node.layer !== editorState.layer) {
						controlOffsetX = -25;
						controlOffsetY = 5;
					} else {
						controlOffsetX = -(fromOutput.node.x - toInput.node.x) / 5;
						controlOffsetY = -(fromOutput.node.y - toInput.node.y) / 5;
					}
					ctx.bezierCurveTo(
						fromX + controlOffsetX,
						fromY + controlOffsetY,
						toX - controlOffsetX,
						toY - controlOffsetY,
						toX,
						toY
					);
				}

				ctx.stroke();
			});
		});
	}
}
