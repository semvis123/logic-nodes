import { NodeType } from '../NodeType';
import { Node } from '../Node';
import type { NodeConnectionHandler } from '../handlers/NodeConnectionHandler';
import { uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';

export class DisplayNode extends Node {
	constructor(id: string, x: number, y: number, nodeConnectionHandler: NodeConnectionHandler) {
		super(
			id,
			NodeType.Input,
			x,
			y,
			40,
			40,
			[new NodeInput(uuid(), 'input', NodeValueType.Number)],
			[],
			nodeConnectionHandler,
			{
				color: '#fff',
				borderColor: '#000',
				borderWidth: 1,
				borderRadius: 0,
				fontSize: 12,
				fontFamily: 'Arial',
				fontColor: '#fff'
			}
		);
	}

	renderNode(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(this.x, this.y);

		ctx.fillStyle = this.style.color;
		ctx.strokeStyle = this.style.borderColor;
		ctx.lineWidth = this.style.borderWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		ctx.beginPath();
		ctx.rect(0, 0, this.width, this.height);
		ctx.fill();
		ctx.stroke();
		

		ctx.fillStyle = this.inputs[0].value == 0 ? '#aa1111' : '#11aa11';
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.inputs[0].value.toString(), (this.width * 1) / 2, this.height / 2);
		this.renderConnectionPoints(ctx);

		ctx.restore();
	}
}
