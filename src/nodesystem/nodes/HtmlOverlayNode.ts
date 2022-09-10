import { NodeOutput } from '../NodeOutput';
import { NodeValueType } from '../NodeValueType';
import { uuid } from '../utils';
import { Node } from '../Node';
import type { NodeSystem } from '../NodeSystem';
import type { NodeParameter } from '../nodeDetailBox/NodeDetailBox';
import type { Metadata } from '../Metadata';
import type { NodeSaveData } from '../NodeSaveData';

export class HtmlOverlayNode extends Node {
	htmlElement: HTMLElement;
	parameters: NodeParameter[] = [];

	constructor(id: string, x: number, y: number, public nodeSystem: NodeSystem, parameters?: NodeParameter[]) {
		super(id, x, y, 120, 40, [], [new NodeOutput(uuid(), 'output', NodeValueType.Number)], nodeSystem);
		this.parameters = parameters ?? this.parameters;
	}

	renderNode(ctx): void {
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

	getMetadata(): Metadata {
		return {
			displayName: 'HTML overlay',
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
