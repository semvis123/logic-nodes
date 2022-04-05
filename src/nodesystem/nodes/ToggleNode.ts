import { NodeType } from '../NodeType';
import { Node } from '../Node';
import type { NodeConnectionHandler } from '../handlers/NodeConnectionHandler';
import { NodeOutput } from '../NodeOutput';
import { uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';

export class ToggleNode extends Node {
	currentValue = 0;

	constructor(id: string, x: number, y: number, nodeConnectionHandler: NodeConnectionHandler) {
		super(
			id,
			NodeType.Input,
			x,
			y,
			120,
			40,
			[],
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
		ctx.fillText('Switch', (this.width * 3) / 4, this.height / 2);

		ctx.fillStyle = this.currentValue == 0 ? '#a33' : '#3a3';
		ctx.fillRect(0, 0, this.width / 2, this.height);
		ctx.strokeStyle = '#222';
		ctx.lineWidth = 3;
		ctx.strokeRect(0, 0, this.width / 2, this.height);
		ctx.restore();
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
	}

	onclick(e: MouseEvent, pos: { x: number; y: number }) {
		if (pos.x > this.width / 2) return true;
		this.toggle();
		return false;
	}
}
