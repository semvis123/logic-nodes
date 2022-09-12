import { FullscreenPrompt } from './fullscreenPrompt/FullscreenPrompt';
import type { Node } from './Node';
import type { NodeSystem } from './NodeSystem';

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
		node.parameters = await popup.requestParameters('Edit', node.getMetadata().parameters);
		node.reset();
	}

	deleteAction() {
		this.selectedNodes.forEach((node) => {
			this.nodeSystem.nodeStorage.removeNode(node);
			this.nodeSystem.nodeRenderer.render();
		});
		this.menu.remove();
	}

	async copyAction() {
		const nodeData = JSON.stringify(this.nodeSystem.exportNodes(this.selectedNodes, true));
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
		}
		this.menu.remove();
	}

	duplicateAction() {
		const nodeData = this.nodeSystem.exportNodes(this.selectedNodes, true);
		this.nodeSystem.importNodes(nodeData, true);
		this.menu.remove();
	}
	alignAction() {
		const gridsize = 40 + this.nodeSystem.config.nodeSpacing;
		this.selectedNodes.forEach((node) => {
			node.x = Math.round(node.x / gridsize) * gridsize;
			node.y = Math.round(node.y / gridsize) * gridsize;
		});
		this.menu.remove();
	}
}
