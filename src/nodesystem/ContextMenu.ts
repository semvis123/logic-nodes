import { FullscreenPrompt } from './fullscreenPrompt/FullscreenPrompt';
import type { Node } from './Node';
import type { NodeSystem } from './NodeSystem';
import { ToastMessage } from './toastmessage/ToastMessage';
import { getBoundingBoxOfMultipleNodes } from './utils';

export class ContextMenu {
	menu: HTMLDivElement;

	constructor(public x: number, public y: number, public selectedNodes: Node[], public nodeSystem: NodeSystem) {
		this.menu = document.createElement('div');
		this.menu.classList.add('node-context-menu');
		this.menu.style.left = `${this.x}px`;
		this.menu.style.top = `${this.y}px`;
	}

	show() {
		const menuItems = {
			edit: this.selectedNodes?.length == 1 && {
				text: 'Edit',
				onclick: this.editAction
			},
			copy: this.selectedNodes?.length == 1 && {
				text: 'Copy',
				onclick: this.copyAction
			},
			paste: {
				text: 'Paste',
				onclick: this.pasteAction
			},
			delete: this.selectedNodes?.length > 0 && {
				text: 'Delete',
				onclick: this.deleteAction
			},
			duplicate: this.selectedNodes?.length > 0 && {
				text: 'Duplicate',
				onclick: this.duplicateAction
			},
			align: this.selectedNodes?.length > 1 && {
				text: 'Align',
				onclick: this.alignAction
			}
		};

		Object.values(menuItems).forEach((menuItem) => {
			if (!menuItem) return;
			const item = document.createElement('div');
			item.innerText = menuItem.text;
			item.onclick = menuItem.onclick.bind(this);
			item.classList.add('node-context-menu-item');

			this.menu.appendChild(item);
		});

		document.body.appendChild(this.menu);
		return this.menu;
	}

	async editAction() {
		const node = this.selectedNodes[0];
		this.menu.remove();
		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.removeEventListeners();
		try {
			node.parameters = await popup.requestParameters('Edit', node.getMetadata().parameters);
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
		node.reset();
		this.nodeSystem.nodeRenderer.render();
		this.nodeSystem.snapshot();
	}

	deleteAction() {
		this.selectedNodes.forEach((node) => {
			this.nodeSystem.nodeStorage.removeNode(node);
			this.nodeSystem.nodeRenderer.render();
		});
		this.menu.remove();
		this.nodeSystem.snapshot();
	}

	async copyAction() {
		const nodeData = JSON.stringify(this.nodeSystem.exportNodes(this.selectedNodes));
		await navigator.clipboard.writeText(nodeData);
		this.menu.remove();
	}

	async pasteAction() {
		try {
			const data = JSON.parse(await navigator.clipboard.readText());
			this.nodeSystem.importNodes(data, true);
		} catch (e) {
			console.log('invalid data');
			console.log(e);
			new ToastMessage('Unable to paste nodes', 'danger').show();
		}
		this.menu.remove();
	}

	duplicateAction() {
		const nodeData = this.nodeSystem.exportNodes(this.selectedNodes);
		this.nodeSystem.importNodes(nodeData, true, true);
		this.menu.remove();
	}

	alignAction() {
		const { x, y } = getBoundingBoxOfMultipleNodes(this.selectedNodes);
		const padding = this.nodeSystem.config.nodeSpacing;
		// width += padding * 2;
		// height += padding * 2;
		// const totalArea = width * height;
		// const rows = height / 50;
		// const columns = width / 50;
		let smallestWidth: number;
		let smallestHeight: number;
		this.selectedNodes.forEach((node) => {
			smallestWidth = Math.min(smallestWidth ?? node.width, node.width);
			smallestHeight = Math.min(smallestHeight ?? node.height, node.height);
		});
		const gridSizeX = smallestWidth + padding;
		const gridSizeY = smallestHeight + padding;

		this.selectedNodes.forEach((node) => {
			node.x = Math.round((node.x - x) / gridSizeX) * gridSizeX + x;
			node.y = Math.round((node.y - y) / gridSizeY) * gridSizeY + y;
		});
		this.nodeSystem.eventHandler.selectedNodes = undefined;
		this.menu.remove();
		this.nodeSystem.snapshot();
	}
}
