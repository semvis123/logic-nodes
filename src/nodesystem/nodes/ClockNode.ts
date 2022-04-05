import { NodeType } from '../NodeType';
import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';

export class ClockNode extends Node {
	currentValue = 0;
	timer: NodeJS.Timer;

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, public interval: number) {
		super(id, NodeType.Input, x, y, 40, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.timer = setInterval(() => this.toggle(), interval);
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

		const outputSpacing = this.height / (this.outputs.length + 1);
		for (let i = 0; i < this.outputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(this.width, outputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
		}

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(`Clock`, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.fillText(`${this.interval}`, (this.width * 2) / 4, (this.height * 2) / 3);
		ctx.restore();
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
		this.nodeSystem.nodeRenderer.render();
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
	}
}
