import type { NodeInput } from './NodeInput';
import type { NodeOutput } from './NodeOutput';
import type { NodeStyle } from './NodeStyle';
import './node.css';
import { positionNode, roundRect, uuid } from './utils';
import type { Metadata } from './Metadata';
import type { NodeSystem } from './NodeSystem';
import { NodeDetailBox, type NodeParameter } from './nodeDetailBox/NodeDetailBox';

export class Node {
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
					const popup = new NodeDetailBox()
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
				onclick: (() => {
					const clone = this.save();
					clone.id = uuid();
					const cloneNode = Object.getPrototypeOf(this).constructor.load(clone, this.nodeSystem);
					positionNode(cloneNode, this.nodeSystem.nodeStorage, clone.x, clone.y);
					this.nodeSystem.nodeStorage.addNode(cloneNode);
					menu.remove();
				}).bind(this)
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
		ctx.fillText(this.getMetadata().displayName, this.width / 2, this.height / 2);
	}

	renderConnectionPoints(ctx: CanvasRenderingContext2D) {
		const inputSpacing = this.height / (this.inputs.length + 1);
		ctx.fillStyle = this.nodeSystem.config.theme.nodeTextColor;
		const radius = this.nodeSystem.config.theme.connectionPointRadius;
		for (let i = 0; i < this.inputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(0, inputSpacing * (i + 1), radius, radius, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
		}

		const outputSpacing = this.height / (this.outputs.length + 1);
		for (let i = 0; i < this.outputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(this.width, outputSpacing * (i + 1), radius, radius, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
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
		this.nodeSystem.nodeClickHandler.selectedNodes = this.nodeSystem.nodeClickHandler.selectedNodes?.filter(
			(node) => node != this
		);
		this.nodeSystem.nodeConnectionHandler.removeAllConnections(this);
	}

	getMetadata(): Metadata {
		return {
			displayName: 'Node',
			parameters: this.parameters
		}
	}

	getParam(key: string): NodeParameter { 
		for(const param of this.parameters) {
			if (param.name == key) return param;
		}
		throw new Error("param not found");
	}

	getParamValue<Type>(key: string, defaultvalue: Type): Type {
		return (this.getParam(key).value as Type) ?? defaultvalue
	}

	save(): any {
		return {}
	}

	static load(saveData: any, nodeSystem: NodeSystem): Node {
		return new Node(saveData.id, saveData.x, saveData.y, saveData.width, saveData.height, [], [], nodeSystem, saveData.nodeStyle);
	}

	reset() {
		this.nodeSystem.nodeRenderer.render();
	}
}
