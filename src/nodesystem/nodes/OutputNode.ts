import { Node } from '../Node';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class OutputNode extends Node {
	parameters: NodeParameter[] = [
		{
			name: 'name',
			label: 'Name',
			value: 'Output',
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
	updateCallback: () => void;

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 20, 20, [new NodeInput(uuid(), 'input', NodeValueType.Number)], [], nodeSystem);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'OutputNode',
			displayName: 'Output',
			category: 'Output',
			parameters: this.parameters
		};
	}

	update() {
		this.updateCallback?.();
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
		this.renderConnectionPoints(ctx);
	}

	reset(): void {
		this.nodeSystem.nodeRenderer.render();
	}
}
