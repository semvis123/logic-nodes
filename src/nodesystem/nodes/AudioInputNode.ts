import { Node } from '../Node';
import { NodeOutput } from '../NodeOutput';
import { roundRect, uuid } from '../utils';
import { NodeValueType } from '../NodeValueType';
import type { NodeSystem } from '../NodeSystem';
import type { Metadata } from '../Metadata';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { TickTimeoutReference } from '../TickSystem';

export class AudioInputNode extends Node {
	currentValue = 0;
	timer: TickTimeoutReference;
	parameters: NodeParameter[] = [
		{
			name: 'minFreq',
			label: 'Minimal frequency',
			value: 1000,
			type: 'number',
			required: true,
			min: 0
		},
		{
			name: 'maxFreq',
			label: 'Maximum frequency',
			value: 2000,
			type: 'number',
			required: true,
			min: 0
		},
		{
			name: 'minVolume',
			label: 'Minimum volume (%)',
			value: 10,
			type: 'number',
			required: true,
			min: 0
		},
		{
			name: 'sampleFreq',
			label: 'Sample interval (ms)',
			value: 50,
			type: 'number',
			required: true,
			min: 50
		}
	];
	static stream: MediaStream = null;
	static analyserNode: AnalyserNode;
	static localMaxima = new Array(10);
	static audioData: Float32Array;
	static correlatedSignal: Float32Array;
	static audioCtx: AudioContext;
	lastPitch = 0;

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 70, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		if (!AudioInputNode.stream) {
			navigator.mediaDevices
				.getUserMedia({ audio: true })
				.then((stream) => {
					AudioInputNode.stream = stream;
					AudioInputNode.audioCtx = new window.AudioContext();
					AudioInputNode.analyserNode = AudioInputNode.audioCtx.createAnalyser();
					const microphoneStream = AudioInputNode.audioCtx.createMediaStreamSource(stream);

					microphoneStream.connect(AudioInputNode.analyserNode);

					AudioInputNode.audioData = new Float32Array(AudioInputNode.analyserNode.fftSize);
					AudioInputNode.correlatedSignal = new Float32Array(AudioInputNode.analyserNode.fftSize);
				})
				.catch((err) => {
					console.log(err);
				});
		}
		this.importParams(parameters);
		this.reset();
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'AudioInputNode',
			displayName: 'Microphone',
			category: 'Input',
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
		ctx.fillText(this.getMetadata().displayName, (this.width * 2) / 4, (this.height * 1) / 3);
		ctx.fillText(`${this.lastPitch}`, (this.width * 2) / 4, (this.height * 2) / 3);
	}

	reset() {
		if (this.timer) {
			this.nodeSystem.tickSystem.removeTickTimeout(this.timer);
		}
		this.timer = this.nodeSystem.tickSystem.waitTicks(
			() => this.update(),
			this.getParamValue('sampleFreq', 1000) / this.nodeSystem.tickSystem.tickSpeed,
			true
		);
	}

	update() {
		if (!AudioInputNode.analyserNode) return;
		AudioInputNode.analyserNode.getFloatTimeDomainData(AudioInputNode.audioData);

		const pitch = this.getAutocorrelatedPitch();
		const array = new Uint8Array(AudioInputNode.analyserNode.frequencyBinCount);
		AudioInputNode.analyserNode.getByteFrequencyData(array);
		const volumeSum = array.reduce((a, value) => a + value, 0);
		const volumeAvg = Math.round(volumeSum / array.length);

		this.currentValue =
			this.getParamValue('minFreq', 1000) < pitch &&
			this.getParamValue('maxFreq', 2000) > pitch &&
			volumeAvg > this.getParamValue('minVolume', 10)
				? 1
				: 0;
		this.outputs[0].setValue(this.currentValue);
		if (volumeAvg > this.getParamValue('minVolume', 10)) {
			this.lastPitch = Math.round(pitch);
		}
	}

	getAutocorrelatedPitch() {
		// https://stackoverflow.com/a/69271725
		let maximaCount = 0;

		for (let l = 0; l < AudioInputNode.analyserNode.fftSize; l++) {
			AudioInputNode.correlatedSignal[l] = 0;
			for (let i = 0; i < AudioInputNode.analyserNode.fftSize - l; i++) {
				AudioInputNode.correlatedSignal[l] += AudioInputNode.audioData[i] * AudioInputNode.audioData[i + l];
			}
			if (l > 1) {
				if (
					AudioInputNode.correlatedSignal[l - 2] - AudioInputNode.correlatedSignal[l - 1] < 0 &&
					AudioInputNode.correlatedSignal[l - 1] - AudioInputNode.correlatedSignal[l] > 0
				) {
					AudioInputNode.localMaxima[maximaCount] = l - 1;
					maximaCount++;
					if (maximaCount >= AudioInputNode.localMaxima.length) break;
				}
			}
		}

		// Second: find the average distance in samples between maxima

		let maximaMean = AudioInputNode.localMaxima[0];

		for (let i = 1; i < maximaCount; i++)
			maximaMean += AudioInputNode.localMaxima[i] - AudioInputNode.localMaxima[i - 1];

		maximaMean /= maximaCount;

		return AudioInputNode.audioCtx.sampleRate / maximaMean;
	}
}
