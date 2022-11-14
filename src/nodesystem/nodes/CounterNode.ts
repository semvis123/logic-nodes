import { Node } from '../Node';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class CounterNode extends Node {
	parameters: NodeParameter[] = [];
	count = 0;

	constructor(id: string, x: number, y: number, layer: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(
			id,
			x,
			y,
			40,
			40,
			layer,
			[new NodeInput(uuid(), 'input', NodeValueType.Number), new NodeInput(uuid(), 'reset', NodeValueType.Number)],
			[],
			nodeSystem
		);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'CounterNode',
			displayName: 'Counter',
			category: 'Output',
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

		ctx.fillStyle = '#4494a6';
		ctx.fill(path);
		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.count.toString(), (this.width * 1) / 2, this.height / 2);
		this.renderConnectionPoints(ctx);
	}

	update() {
		if (this.inputs[0].value == 1) {
			this.count++;
		}
		if (this.inputs[1].value == 1) {
			this.count = 0;
		}
	}
}
