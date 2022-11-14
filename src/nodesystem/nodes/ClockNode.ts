import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { Metadata } from '../Metadata';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { TickTimeoutReference } from '../TickSystem';

export class ClockNode extends Node {
	currentValue = 0;
	timer: TickTimeoutReference;
	parameters: NodeParameter[] = [
		{
			name: 'interval',
			label: 'Interval',
			value: 100,
			type: 'number',
			required: true,
			min: 10
		}
	];

	constructor(id: string, x: number, y: number, layer: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 40, 40, layer, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.importParams(parameters);
		this.reset();
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'ClockNode',
			displayName: 'Interval',
			category: 'Misc',
			parameters: this.parameters
		};
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
		ctx.fillText(this.getMetadata().displayName, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.fillText(`${this.getParamValue('interval', 1000)}`, (this.width * 2) / 4, (this.height * 2) / 3);
	}

	reset() {
		if (this.timer) {
			this.nodeSystem.tickSystem.removeTickTimeout(this.timer);
		}
		this.timer = this.nodeSystem.tickSystem.waitTicks(
			() => this.toggle(),
			this.getParamValue('interval', 1000) / this.nodeSystem.tickSystem.tickSpeed,
			true
		);
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
	}
}
