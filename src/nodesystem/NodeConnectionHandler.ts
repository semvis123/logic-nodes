import type { NodeOutput } from './NodeOutput';
import type { NodeInput } from './NodeInput';

export class NodeConnectionHandler {
	connections: Map<NodeOutput, NodeInput[]> = new Map();

	addConnection(fromOutput: NodeOutput, toInput: NodeInput) {
		if (!this.connections.has(fromOutput)) {
			this.connections.set(fromOutput, []);
		}
		this.removeFirstConnection(toInput);
		this.connections.get(fromOutput).push(toInput);
		fromOutput.node.update();
		this.updateValue(fromOutput);
	}

	removeConnection(fromOutput, toInput) {
		const connections = this.connections.get(fromOutput);
		if (connections) {
			const index = connections.findIndex((c) => c === toInput);
			if (index > -1) {
				connections.splice(index, 1);
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
		const connections = this.connections.get(output);
		if (connections) {
			connections.forEach((input) => {
				input.setValue(output.value);
				input.node?.update();
			});
		}
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
