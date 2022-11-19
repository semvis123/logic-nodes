import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class ConstantNode extends Node {
	parameters: NodeParameter[] = [
		{
			name: 'value',
			label: 'Value',
			value: 1,
			type: 'number',
			required: true,
			min: 0,
			max: 1
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
		super(id, x, y, 25, 25, layer, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.importParams(parameters);
        this.update();
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'ConstantNode',
			displayName: 'Constant',
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

		ctx.fillStyle = this.outputs[0].value == 0 ? '#aa1111' : '#11aa11';
		ctx.fill(path);
		ctx.fillStyle = this.style.fontColor;
		this.renderConnectionPoints(ctx);
	}

	update() {
		this.outputs[0].setValue(parseInt(this.getParamValue('value', '0') as string));
	}

    reset() {
        this.update();
        this.nodeSystem.nodeRenderer?.requestRender();
    }
}
