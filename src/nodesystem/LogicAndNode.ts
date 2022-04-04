import { NodeType } from './NodeType';
import { Node } from './Node';
import type { NodeConnectionHandler } from './NodeConnectionHandler';
import { NodeOutput } from './NodeOutput';
import { uuid } from './utils';
import { NodeValueType } from './NodeValueType';
import { NodeInput } from './NodeInput';

export class AndNode extends Node {
	constructor(id: string, x: number, y: number, nodeConnectionHandler: NodeConnectionHandler) {
		super(
			id,
			NodeType.Input,
			x,
			y,
			40,
			40,
			[new NodeInput(uuid(), 'a', NodeValueType.Number), new NodeInput(uuid(), 'b', NodeValueType.Number)],
			[new NodeOutput(uuid(), 'output', NodeValueType.Number)],
			nodeConnectionHandler
		);
	}

	renderNode(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(this.x, this.y);

		ctx.fillStyle = this.style.color;
		ctx.strokeStyle = this.style.borderColor;
		ctx.lineWidth = this.style.borderWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		ctx.beginPath();
		ctx.rect(0, 0, this.width, this.height);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = '#000';

		const inputSpacing = this.height / (this.inputs.length + 1);
		ctx.fillStyle = this.style.fontColor;
		for (let i = 0; i < this.inputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(0, inputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
		}

		const outputSpacing = this.height / (this.outputs.length + 1);
		for (let i = 0; i < this.outputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(this.width, outputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
		}

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(`and`, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.restore();
	}

	update() {
		this.outputs[0].setValue((this.inputs[0].value as number) & (this.inputs[1].value as number));
	}
}
