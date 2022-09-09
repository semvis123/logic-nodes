import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../nodeDetailBox/NodeDetailBox';
import type { Metadata } from '../Metadata';
import type { NodeSaveData } from '../NodeSaveData';

export class ToggleNode extends Node {
	currentValue = 0;
	parameters: NodeParameter[] = [
		{
			name: 'defaultValue',
			label: 'Default value',
			value: 1,
			type: 'number',
			required: true,
			min: 0,
			max: 1
		}
	];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 120, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.parameters = parameters ?? this.parameters;
		this.currentValue = this.getParamValue('defaultValue', 0);
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
		ctx.fillText('Switch', (this.width * 3) / 4, this.height / 2);

		ctx.fillStyle = this.currentValue == 0 ? '#a33' : '#3a3';
		ctx.fillRect(0, 0, this.width / 2, this.height);
		ctx.strokeStyle = this.nodeSystem.config.theme.nodeBorderColor;
		ctx.strokeRect(0, 0, this.width / 2, this.height);
	}

	update() {
		this.outputs[0].setValue(this.currentValue);
	}

	toggle() {
		this.currentValue = this.currentValue === 0 ? 1 : 0;
		this.update();
	}

	onclick(e: MouseEvent, pos: { x: number; y: number }) {
		if (pos.x > this.width / 2) return true;
		this.toggle();
		return false;
	}


	getMetadata(): Metadata {
		return {
			displayName: 'Toggle',
			category: 'Input',
			parameters: this.parameters
		}
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
