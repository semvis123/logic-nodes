import { Node } from '../Node';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import { NodeInput } from '../NodeInput';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class ToneNode extends Node {
	parameters: NodeParameter[] = [
		{
			name: 'frequency',
			label: 'Frequency',
			type: 'number',
			value: 800,
			min: 0
		},
		{
			name: 'type',
			label: 'Type (sine, square, sawtooth, triangle)',
			type: 'text',
			value: 'sine'
		}
	];
	context = new AudioContext();
	oscillator = this.context.createOscillator();

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 40, 40, [new NodeInput(uuid(), 'input', NodeValueType.Number)], [], nodeSystem);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'ToneNode',
			displayName: 'Tone generator',
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
		ctx.fillText(this.getParamValue('frequency', 800).toString(), (this.width * 1) / 2, this.height / 2-5);
		ctx.fillText('Hz', (this.width * 1) / 2, this.height / 2 + 10);

		this.renderConnectionPoints(ctx);
	}

	update() {
		if (this.inputs[0].value) {
			this.oscillator = this.context.createOscillator();
			this.oscillator.type = this.getParamValue('type', 'sine');
			this.oscillator.frequency.value = this.getParamValue('frequency', 800);
			this.oscillator.connect(this.context.destination);
			this.oscillator.start();
		} else {
			this.oscillator.stop();
		}
	}

	reset(): void {
		this.nodeSystem.nodeRenderer.requestRender();
		this.inputs[0].value && this.update();
	}
}
