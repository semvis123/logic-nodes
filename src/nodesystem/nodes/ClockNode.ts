import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';

export class ClockNode extends Node {
	currentValue = 0;
	timer: NodeJS.Timer;

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, public interval: number) {
		super(id, x, y, 40, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.timer = setInterval(() => this.toggle(), interval);
	}

	renderNode(ctx: CanvasRenderingContext2D) {
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
		ctx.fillText(`Clock`, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.fillText(`${this.interval}`, (this.width * 2) / 4, (this.height * 2) / 3);
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
		// this.nodeSystem.nodeRenderer.render();
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
	}

	getMetadata() {
		return {
			displayName: 'Clock'
		}
	}

	static load(saveData: any, nodeSystem: NodeSystem): Node {
		return new ClockNode(saveData.id, saveData.x, saveData.y, nodeSystem, saveData.interval);
	}

	save(): any {
		return {
			id: this.id,
			x: this.x,
			y: this.y,
			interval: this.interval
		}
	}
}
