import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { Metadata } from '../Metadata';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';

export class ConnectionNode extends Node {
	parameters: NodeParameter[] = [];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(
			id,
			x,
			y,
			50,
			40,
			[new NodeInput(uuid(), '1', NodeValueType.Number)],
			[new NodeOutput(uuid(), 'q', NodeValueType.Number)],
			nodeSystem
		);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'SplitterNode',
			displayName: 'Splitter',
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
		ctx.fillText(`Splitter`, (this.width * 2) / 4, (this.height * 1) / 2);
	}

	update() {
		this.outputs[0].setValue(this.inputs[0].value);
	}
}
