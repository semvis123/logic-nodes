import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../nodeDetailBox/NodeDetailBox';
import type { Metadata } from '../Metadata';

export class ButtonNode extends Node {
	padding = 7;
	currentValue = 0;
	timer: NodeJS.Timeout;

	parameters: NodeParameter[] = [
		{
			name: 'delay',
			label: 'Delay',
			value: 1000,
			type: 'number',
			required: true,
			min: 50
		}
	];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 40, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.parameters = parameters ?? this.parameters;
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

		// ctx.fillStyle = this.style.fontColor;
		// ctx.fillText('Switch', (this.width * 3) / 4, this.height / 2);

		ctx.fillStyle = this.currentValue == 0 ? '#a33' : '#3a3';
		ctx.fillRect(this.padding, this.padding, this.width - this.padding * 2, this.height - this.padding * 2);
		ctx.strokeStyle = this.nodeSystem.config.theme.nodeBorderColor;
		ctx.strokeRect(this.padding, this.padding, this.width - this.padding * 2, this.height - this.padding * 2);
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
		if (this.timer) {
			clearTimeout(this.timer);
		}
	}

	onclick(e: MouseEvent, pos: { x: number; y: number }) {
		if ((pos.x < this.padding || pos.x > this.width - this.padding) ||
			(pos.y < this.padding || pos.y > this.height - this.padding)
		) return true;
		this.toggle();
		this.timer = setTimeout(() => {
			this.toggle();
		}, this.getParamValue('delay', 1000));
		return false;
	}


	getMetadata(): Metadata {
		return {
			displayName: 'Button',
			category: 'Input',
			parameters: this.parameters
		}
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
