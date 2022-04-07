import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';

export class DelayNode extends Node {
	constructor(id: string, x: number, y: number, nodeSystem: NodeSystem, public delay: number) {
		super(
			id,
			'Delay',
			x,
			y,
			40,
			40,
			[new NodeInput(uuid(), 'a', NodeValueType.Number)],
			[new NodeOutput(uuid(), 'delayed output', NodeValueType.Number)],
			nodeSystem
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

		const path = roundRect(0, 0, this.width, this.height, this.style.borderRadius);
		ctx.stroke(path);
		ctx.fill(path);

		this.renderConnectionPoints(ctx);

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(`delay`, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.fillText(`${this.delay}`, (this.width * 2) / 4, (this.height * 2) / 3);
		ctx.restore();
	}

	update() {
		setTimeout(() => {
			this.outputs[0].setValue(this.inputs[0].value);
			this.nodeSystem.nodeRenderer.render();
		}, this.delay);
	}
}
