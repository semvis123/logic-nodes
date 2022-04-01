import type { NodeOutput } from './NodeOutput';
import type { NodeInput } from './NodeInput';

export class NodeConnectionHandler {
	connections: Map<NodeOutput, NodeInput[]> = new Map();

	addConnection(fromOutput: NodeOutput, toInput: NodeInput) {
		if (!this.connections.has(fromOutput)) {
			this.connections.set(fromOutput, []);
		}
		this.connections.get(fromOutput).push(toInput);
	}

	removeConnection(fromOutput, toInput) {
		const connections = this.connections.get(fromOutput);
		if (connections) {
			const index = connections.findIndex((c) => c.id === toInput);
			if (index > -1) {
				connections.splice(index, 1);
			}
		}
	}
    updateValue(output) {
        const connections = this.connections.get(output);
        if (connections) {
            connections.forEach((input) => {
                input.node?.update();
            });
        }
    }

    renderConnections(ctx: CanvasRenderingContext2D) {
        this.connections.forEach((toInputs, fromOutput) => {
            toInputs.forEach((toInput) => {
                ctx.beginPath();
                const toX = toInput.node.x;
                const toY = toInput.node.y + toInput.node.height / (toInput.node.inputs.length + 1) * (toInput.index + 1);
                const fromX = fromOutput.node.x + fromOutput.node.width;
                const fromY = fromOutput.node.y + fromOutput.node.height / (fromOutput.node.outputs.length + 1) * (fromOutput.index + 1);
                ctx.moveTo(fromX, fromY);
                const controlOffset = fromOutput.node.width / 2;
                ctx.bezierCurveTo(fromX + controlOffset, fromY, toX - controlOffset, toY, toX, toY);
                ctx.stroke();
            });
        });
    }
}
