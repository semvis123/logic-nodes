import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { Metadata } from '../Metadata';
import type { NodeParameter } from '../nodeDetailBox/NodeDetailBox';

export class ClockNode extends Node {
	currentValue = 0;
	timer: NodeJS.Timer;
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

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 40, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.parameters = parameters ?? this.parameters;
		this.timer = setInterval(() => this.toggle(), this.getParamValue('interval', 1000));
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
			clearInterval(this.timer);
		}
		this.timer = setInterval(() => this.toggle(), this.getParamValue('interval', 1000));
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
	}

	getMetadata(): Metadata {
		return {
			displayName: 'Interval',
			category: 'Misc',
			parameters: this.parameters
		};
	}

	static override load(saveData: any, nodeSystem: NodeSystem): Node {
		return new this(saveData.id, saveData.x, saveData.y, nodeSystem, saveData.parameters);
	}

	override save(): any {
		return {
			id: this.id,
			x: this.x,
			y: this.y,
			parameters: this.parameters
		};
	}
}
