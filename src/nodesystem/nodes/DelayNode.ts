import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { Metadata } from '../Metadata';
import type { NodeParameter } from '../nodeDetailBox/NodeDetailBox';
import type { NodeSaveData } from '../NodeSaveData';

export class DelayNode extends Node {
	parameters: NodeParameter[] = [
		{
			name: 'delay',
			label: 'Delay',
			value: 100,
			type: 'number',
			required: true,
			min: 10
		}
	];
	delay: NodeJS.Timeout;

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(
			id,
			x,
			y,
			40,
			40,
			[new NodeInput(uuid(), 'a', NodeValueType.Number)],
			[new NodeOutput(uuid(), 'delayed output', NodeValueType.Number)],
			nodeSystem
		);
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

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(`delay`, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.fillText(`${this.getParamValue('delay', 1000)}`, (this.width * 2) / 4, (this.height * 2) / 3);
	}

	update() {
		this.delay = setTimeout(() => {
			this.outputs[0].setValue(this.inputs[0].value);
		}, this.getParamValue('delay', 1000));
	}

	reset() {
		if (this.delay) clearTimeout(this.delay);
		this.delay = setTimeout(() => {
			this.outputs[0].setValue(this.inputs[0].value);
		}, this.getParamValue('delay', 1000));
	}

	getMetadata(): Metadata {
		return {
			displayName: 'Delay',
			category: 'Misc',
			parameters: this.parameters
		};
	}

	static override load(saveData: NodeSaveData, nodeSystem: NodeSystem): Node {
		return new this(saveData.id, saveData.x, saveData.y, nodeSystem, saveData.parameters);
	}

	override save(): NodeSaveData {
		return {
			id: this.id,
			x: this.x,
			y: this.y,
			parameters: this.parameters
		};
	}
}
