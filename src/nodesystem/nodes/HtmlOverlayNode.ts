import { NodeOutput } from '../NodeOutput';
import { NodeValueType } from '../NodeValueType';
import { uuid } from '../utils';
import { Node } from '../Node';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../fullscreenPrompt/FullscreenPrompt';
import type { Metadata } from '../Metadata';

export class HtmlOverlayNode extends Node {
	htmlElement: HTMLElement;
	parameters: NodeParameter[] = [];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 120, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.importParams(parameters);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'HtmlOverlayNode',
			displayName: 'HTML overlay',
			category: 'Misc',
			parameters: this.parameters
		};
	}

	renderNode(ctx: CanvasRenderingContext2D): void {
		super.renderNode(ctx);
		if (this.htmlElement) {
			if (this.nodeSystem.config.hardwareAccelerationHtmlOverlay) {
				// hardware acceleration
				this.htmlElement.style.transform = `translate(${this.x}px, ${this.y}px)`;
			} else {
				// no hardware acceleration
				this.htmlElement.style.left = this.x + 'px';
				this.htmlElement.style.top = this.y + 'px';
			}
		} else {
			this.htmlElement = document.createElement('div');
			this.htmlElement.style.position = 'absolute';
			if (this.nodeSystem.config.hardwareAccelerationHtmlOverlay) {
				// hardware acceleration
				this.htmlElement.style.transform = `translate(${this.x}px, ${this.y}px)`;
				this.htmlElement.style.left = 0 + 'px';
				this.htmlElement.style.top = 0 + 'px';
			} else {
				// no hardware acceleration
				this.htmlElement.style.left = this.x + 'px';
				this.htmlElement.style.top = this.y + 'px';
			}
			this.htmlElement.style.width = this.width + 'px';
			this.htmlElement.style.height = this.height + 'px';
			this.htmlElement.style.color = this.nodeSystem.config.theme.nodeTextColor;
			this.htmlElement.style.fontSize = '12px';
			this.htmlElement.style.fontFamily = 'Arial';
			this.htmlElement.style.textAlign = 'center';
			this.htmlElement.style.userSelect = 'none';
			this.htmlElement.style.pointerEvents = 'none';
			this.htmlElement.style.zIndex = '1';
			this.htmlElement.innerHTML = 'HtmlOverlay';
			this.nodeSystem.htmlCanvasOverlayContainer.appendChild(this.htmlElement);
		}
	}

	cleanup(): void {
		if (this.htmlElement) {
			this.htmlElement.remove();
			this.htmlElement = null;
		}
		super.cleanup();
	}
}
