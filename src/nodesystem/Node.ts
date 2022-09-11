import type { NodeInput } from './NodeInput';
import type { NodeOutput } from './NodeOutput';
import type { NodeStyle } from './NodeStyle';
import './node.css';
import { positionNode, roundRect, uuid } from './utils';
import type { Metadata } from './Metadata';
import type { NodeSystem } from './NodeSystem';
import { FullscreenPrompt, type NodeParameter } from './fullscreenPrompt/FullscreenPrompt';
import type { NodeSaveData } from './NodeSaveData';
import type { NodeConstructor } from './NodeConstructor';

export abstract class Node {
	public parameters = [];

	constructor(
		public id: string,
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public inputs: NodeInput[],
		public outputs: NodeOutput[],
		public nodeSystem: NodeSystem,
		public style: NodeStyle = {
			color: nodeSystem.config.theme.nodeBackfroundColor,
			borderColor: nodeSystem.config.theme.nodeBorderColor,
			borderWidth: 1,
			borderRadius: nodeSystem.config.theme.nodeBorderRadius,
			fontSize: 12,
			fontFamily: 'Arial',
			fontColor: nodeSystem.config.theme.nodeTextColor
		}
	) {
		inputs.forEach((input, i) => input.setNode(this, i));
		outputs.forEach((output, i) => output.setNode(this, i));
	}

	showContextMenu(pageX: number, pageY: number): HTMLDivElement {
		const menu = document.createElement('div');
		menu.classList.add('node-context-menu');
		menu.style.left = `${pageX}px`;
		menu.style.top = `${pageY}px`;

		const menuItems = {
			edit: {
				text: 'Edit',
				onclick: (async () => {
					menu.remove();
					const popup = new FullscreenPrompt();
					this.parameters = await popup.requestParameters('Edit', this.getMetadata().parameters);
					this.reset();
				}).bind(this)
			},
			delete: {
				text: 'Delete',
				onclick: () => {
					this.nodeSystem.nodeStorage.removeNode(this);
					menu.remove();
					this.nodeSystem.nodeRenderer.render();
				}
			},
			duplicate: {
				text: 'Duplicate',
				onclick: () => {
					const clone = this.save();
					clone.id = uuid();
					const cloneNode = Object.getPrototypeOf(this).constructor.load(clone, this.nodeSystem);
					positionNode(cloneNode, clone.x, clone.y, this.nodeSystem.nodeStorage, this.nodeSystem.config);
					this.nodeSystem.nodeStorage.addNode(cloneNode);
					menu.remove();
				}
			}
		};

		Object.keys(menuItems).forEach((key) => {
			const item = document.createElement('div');
			item.innerText = menuItems[key].text;
			item.onclick = menuItems[key].onclick;
			item.classList.add('node-context-menu-item');

			menu.appendChild(item);
		});

		document.body.appendChild(menu);
		return menu;
	}

	renderNode(ctx: CanvasRenderingContext2D) {
		const textPadding = 5;
		ctx.fillStyle = this.style.color;
		ctx.strokeStyle = this.style.borderColor;
		ctx.lineWidth = this.style.borderWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
		
		// scale font down if text exceeds width
		const textMetrics = ctx.measureText(this.getMetadata().displayName);
		let width = textMetrics.width + textPadding * 2;
		while (Math.floor(width) > this.width) {
			const textMetrics = ctx.measureText(this.getMetadata().displayName);
			width = textMetrics.width + textPadding * 2;
			const ratio = this.width / width;
			this.style.fontSize = this.style.fontSize * ratio;
			ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
		}

		const path = roundRect(0, 0, this.width, this.height, this.style.borderRadius);
		ctx.stroke(path);
		ctx.fill(path);

		this.renderConnectionPoints(ctx);

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.getMetadata().displayName, this.width / 2, this.height / 2);
	}

	renderConnectionPoints(ctx: CanvasRenderingContext2D) {
		const inputSpacing = this.height / (this.inputs.length + 1);
		ctx.fillStyle = this.style.fontColor;
		const radius = this.nodeSystem.config.theme.connectionPointRadius;
		for (let i = 0; i < this.inputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(0, inputSpacing * (i + 1), radius, radius, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
			ctx.closePath();
		}

		const outputSpacing = this.height / (this.outputs.length + 1);
		for (let i = 0; i < this.outputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(this.width, outputSpacing * (i + 1), radius, radius, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
			ctx.closePath();
		}
	}

	update() {
		this.outputs.forEach((output) => output.setValue(false));
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onclick(_e: MouseEvent, _pos: { x: number; y: number }) {
		return true;
	}

	cleanup() {
		this.nodeSystem.eventHandler.selectedNodes = this.nodeSystem.eventHandler.selectedNodes?.filter(
			(node) => node != this
		);
		this.nodeSystem.nodeConnectionHandler.removeAllConnections(this);
	}

	getMetadata(): Metadata {
		return {
			nodeName: 'Node',
			displayName: 'Node',
			parameters: this.parameters
		};
	}

	getParam(key: string): NodeParameter {
		for (const param of this.parameters) {
			if (param.name == key) return param;
		}
	}

	getParamValue<Type>(key: string, defaultvalue: Type): Type {
		if (this.getParam(key)?.type === 'checkbox') {
			return (this.getParam(key)?.checked as Type) ?? defaultvalue;
		}
		return (this.getParam(key)?.value as Type) ?? defaultvalue;
	}

	importParams(params: NodeParameter[]) {
		params?.forEach(param => {
			const existingParam = this.getParam(param.name);
			if (!existingParam) {
				this.parameters.push(param)
				return;
			}

			for (const key of ['value', 'checked']) {
				if (Object.hasOwn(param, key)) {
					existingParam[key] = param[key];
				}
			}
		})
	}

	save(): NodeSaveData {
		return {
			id: this.id,
			type: this.getMetadata().nodeName,
			x: this.x,
			y: this.y,
			parameters: this.parameters
		};
	}

	static load(saveData: NodeSaveData, nodeSystem: NodeSystem): Node {
		return new (this as unknown as NodeConstructor)(saveData.id, saveData.x, saveData.y, nodeSystem, saveData.parameters);
	}

	reset() {
		this.nodeSystem.nodeRenderer.render();
	}
}
