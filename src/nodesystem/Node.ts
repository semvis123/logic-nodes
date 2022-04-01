import type { NodeInput } from './NodeInput';
import type { NodeOutput } from './NodeOutput';
import type { NodeStyle } from './NodeStyle';
import type { NodeType } from './NodeType';
import type { NodeConnectionHandler } from './NodeConnectionHandler';

export class Node {

	constructor(
		public id: string,
		public type: NodeType,
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public inputs: NodeInput[],
		public outputs: NodeOutput[],
		public nodeConnectionHandler: NodeConnectionHandler,
		public style: NodeStyle = {
			color: '#fff',
			borderColor: '#000',
			borderWidth: 1,
			borderRadius: 0,
			fontSize: 12,
			fontFamily: 'Arial',
			fontColor: '#000'
		}
	) {
		inputs.forEach(input => input.setNode(this));
		outputs.forEach(output => output.setNode(this));
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
		ctx.moveTo(0, 0);
		ctx.lineTo(this.width, 0);
		ctx.lineTo(this.width, this.height);
		ctx.lineTo(0, this.height);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		const inputSpacing = this.height / (this.inputs.length + 1);
		for (let i = 0; i < this.inputs.length; i++) {
			ctx.moveTo(0, inputSpacing * (i + 1));
			ctx.beginPath();
			ctx.ellipse(0, inputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fillStyle = this.style.fontColor;
			ctx.fill();
		}

		const outputSpacing = this.height / (this.outputs.length + 1);
		for (let i = 0; i < this.outputs.length; i++) {
			ctx.moveTo(this.width, outputSpacing * (i + 1));
			ctx.beginPath();
			ctx.ellipse(this.width, outputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fillStyle = this.style.fontColor;
			ctx.fill();
		}

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.type.toString(), this.width / 2, this.height / 2);

		ctx.restore();
	}

	update() {
		this.outputs.forEach(output => output.setValue(false));
	}
}
