import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class InputNode extends Node {
	padding = 7;
	currentValue = 0;

	parameters: NodeParameter[] = [
		{
			name: 'name',
			label: 'Name',
			value: 'Input',
			type: 'text'
		},
		{
			name: 'index',
			label: 'Index',
			value: 0,
			type: 'number',
			required: true,
			min: 0
		}
	];

	constructor(
		id: string,
		x: number,
		y: number,
		layer: number,
		public nodeSystem: NodeSystem,
		parameters?: NodeParameter[]
	) {
		super(id, x, y, 30, 30, layer, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'InputNode',
			displayName: 'Input',
			category: 'Input',
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
	}

	onclick(e: MouseEvent, pos: { x: number; y: number }) {
		if (
			pos.x < this.padding ||
			pos.x > this.width - this.padding ||
			pos.y < this.padding ||
			pos.y > this.height - this.padding
		)
			return true;
		this.toggle();
		return false;
	}
}
