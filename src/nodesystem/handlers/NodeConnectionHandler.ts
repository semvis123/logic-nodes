import type { NodeOutput } from '../NodeOutput';
import type { NodeInput } from '../NodeInput';
import type { Node } from '../Node';
export class NodeConnectionHandler {
	connections: Map<NodeOutput, NodeInput[]> = new Map();
	toUpdate: Set<NodeOutput> = new Set();
	updateTimer: NodeJS.Timeout;

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
		if (!this.updateTimer)
			this.updateTimer = setTimeout(this.updateAllValues.bind(this), 50);
	}

	updateAllValues() {
		clearTimeout(this.updateTimer);
		this.updateTimer = undefined;
		const updateSnapshot = new Set(this.toUpdate);
		this.toUpdate.clear();
		updateSnapshot.forEach(output => {
			const connections = this.connections.get(output);
			if (connections) {
				connections.forEach((input) => {
					input.setValue(output.value);
				});
				connections.forEach((input) => {
					input.node?.update();
				});
			}
		});
	}

	renderConnections(ctx: CanvasRenderingContext2D) {
		this.connections.forEach((toInputs, fromOutput) => {
			toInputs.forEach((toInput) => {
				if (toInput === undefined) return;
				ctx.beginPath();
				const toX = toInput.node.x;
				const inputOffset = (toInput.node.height / (toInput.node.inputs.length + 1)) * (toInput.index + 1);
				const toY = toInput.node.y + inputOffset;
				const fromX = fromOutput.node.x + fromOutput.node.width;
				const outputOffset = (fromOutput.node.height / (fromOutput.node.outputs.length + 1)) * (fromOutput.index + 1);
				const fromY = fromOutput.node.y + outputOffset;
				ctx.moveTo(fromX, fromY);
				const controlOffsetX = -(fromOutput.node.x - toInput.node.x) / 3 + fromOutput.node.width / 2;
				const controlOffsetY = -(fromOutput.node.y - toInput.node.y) / 3;
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
