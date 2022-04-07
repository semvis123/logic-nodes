import { Node } from '../Node';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';

export class DisplayNode extends Node {
	constructor(id: string, x: number, y: number, nodeSystem: NodeSystem) {
		super(id, 'Input', x, y, 40, 40, [new NodeInput(uuid(), 'input', NodeValueType.Number)], [], nodeSystem);
	}

	update() {
		this.nodeSystem.nodeRenderer.render();
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

		ctx.fillStyle = this.inputs[0].value == 0 ? '#aa1111' : '#11aa11';
		ctx.fill(path);
		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.inputs[0].value.toString(), (this.width * 1) / 2, this.height / 2);
		this.renderConnectionPoints(ctx);

		ctx.restore();
	}
}
