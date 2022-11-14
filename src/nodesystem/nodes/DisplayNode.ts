import { Node } from '../Node';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class DisplayNode extends Node {
	parameters: NodeParameter[] = [
		{
			name: 'showValue',
			label: 'Show Value',
			checked: false,
			type: 'checkbox'
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
		super(id, x, y, 40, 40, layer, [new NodeInput(uuid(), 'input', NodeValueType.Number)], [], nodeSystem);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'DisplayNode',
			displayName: 'Display',
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

		ctx.fillStyle = this.inputs[0].value == 0 ? '#aa1111' : '#11aa11';
		ctx.fill(path);
		ctx.fillStyle = this.style.fontColor;
		if (this.getParamValue('showValue', false)) {
			ctx.fillText(this.inputs[0].value == 0 ? '0' : '1', (this.width * 1) / 2, this.height / 2);
		}
		this.renderConnectionPoints(ctx);
	}

	reset(): void {
		this.nodeSystem.nodeRenderer.requestRender();
	}
}
