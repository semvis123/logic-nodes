import type { NodeInput } from './NodeInput';
import type { NodeOutput } from './NodeOutput';
import type { NodeStyle } from './NodeStyle';
import type { NodeType } from './NodeType';
import './node.css';
import type { NodeSystem } from './NodeSystem';

export class Node {
	constructor(
		public id: string,
		public type: NodeType,
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public inputs: NodeInput[],
		public outputs: NodeOutput[],
		public nodeSystem: NodeSystem,
		public style: NodeStyle = {
			color: '#fff',
			borderColor: '#000',
			borderWidth: 1,
			borderRadius: 0,
			fontSize: 12,
			fontFamily: 'Arial',
			fontColor: '#000'
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
			delete: {
				text: 'Delete',
				onclick: () => {
					// this.nodeConnectionHandler.removeNode(this);
					menu.remove();
				}
			},
			duplicate: {
				text: 'Duplicate',
				onclick: () => {
					// this.nodeConnectionHandler.duplicateNode(this);
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

		this.renderConnectionPoints(ctx);

		ctx.fillStyle = this.style.fontColor;
		ctx.fillText(this.type.toString(), this.width / 2, this.height / 2);

		ctx.restore();
	}

	renderConnectionPoints(ctx: CanvasRenderingContext2D) {
		const inputSpacing = this.height / (this.inputs.length + 1);
		ctx.fillStyle = '#000';
		for (let i = 0; i < this.inputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(0, inputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.fill();
		}

		const outputSpacing = this.height / (this.outputs.length + 1);
		for (let i = 0; i < this.outputs.length; i++) {
			ctx.beginPath();
			ctx.ellipse(this.width, outputSpacing * (i + 1), 5, 5, 0, 0, 2 * Math.PI);
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
}
