import { Node } from '../Node';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../nodeDetailBox/NodeDetailBox';

export class CounterNode extends Node {
	parameters: NodeParameter[] = [];
	count = 0;

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 40, 40, [new NodeInput(uuid(), 'input', NodeValueType.Number)], [], nodeSystem);
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

		ctx.fillStyle = '#4494a6';
		ctx.fill(path);
		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.count.toString(), (this.width * 1) / 2, this.height / 2);
		this.renderConnectionPoints(ctx);
	}

	getMetadata() {
		return {
			displayName: 'Counter',
			parameters: this.parameters
		};
	}

	update() {
		if (this.inputs[0].value == 1) {
			this.count++;
		}
		this.nodeSystem.nodeRenderer.render();
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
