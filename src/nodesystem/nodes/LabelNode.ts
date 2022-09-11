import { Node } from '../Node';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';
import type { NodeSystem } from '../NodeSystem';
import { roundRect, textColor } from '../utils';

export class LabelNode extends Node {
	padding = 5;
	parameters: NodeParameter[] = [{
		name: 'text',
		label: 'Text',
		value: 'Label',
		type: 'text'
	},
	{
		name: 'bgcolor',
		label: 'Background color',
		value: '#fff',
		type: 'color'
	},
	{
		name: 'fontsize',
		label: 'Font size',
		value: 12,
		type: 'number',
		step: 1
	}
];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(
			id,
			x,
			y,
			40,
			20,
			[],
			[],
			nodeSystem
		);
		this.parameters[1].value = this.style.color;
		this.parameters[2].value = this.style.fontSize;
		this.importParams(parameters);
	}

	renderNode(ctx: CanvasRenderingContext2D) {
		const bgColor = this.getParamValue('bgcolor', '#1d1d1d');
		ctx.fillStyle = bgColor;
		ctx.strokeStyle = this.style.borderColor;
		ctx.lineWidth = this.style.borderWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.font = `${this.getParamValue('fontsize', this.style.fontSize)}px ${this.style.fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const textMetrics = ctx.measureText(this.getParamValue('text', 'Label'));
		this.height = textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent + this.padding * 2;
		this.width = textMetrics.width + this.padding * 2;
		const path = roundRect(0, 0, this.width, this.height, this.style.borderRadius);
		ctx.stroke(path);
		ctx.fill(path);

		this.renderConnectionPoints(ctx);

		ctx.fillStyle = textColor(bgColor);
		ctx.fillText(this.getParamValue('text', 'Label'), this.width / 2, this.height / 2);
	}
	
	reset(): void {
		this.nodeSystem.nodeRenderer.render();
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'LabelNode',
			displayName: 'Label',
			category: 'Misc',
			parameters: this.parameters
		};
	}
}
