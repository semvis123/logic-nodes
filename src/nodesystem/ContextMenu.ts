import type { Node } from './Node';
import type { NodeSystem } from './NodeSystem';
import { EditNodeCommand } from './commands/EditNodeCommand';
import { DeleteNodesCommand } from './commands/DeleteNodesCommand';
import { PasteCommand } from './commands/PasteCommand';
import { CopyCommand } from './commands/CopyCommand';
import { DuplicateNodesCommand } from './commands/DuplicateNodesCommand';
import { AlignNodesCommand } from './commands/AlignNodesCommand';

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

	editAction() {
		this.menu.remove();
		new EditNodeCommand(this.nodeSystem, this.selectedNodes).execute();
	}

	deleteAction() {
		this.menu.remove();
		new DeleteNodesCommand(this.nodeSystem, this.selectedNodes).execute();
	}

	copyAction() {
		this.menu.remove();
		new CopyCommand(this.nodeSystem, this.selectedNodes).execute();
	}

	pasteAction() {
		this.menu.remove();
		new PasteCommand(this.nodeSystem).execute();
	}

	duplicateAction() {
		this.menu.remove();
		new DuplicateNodesCommand(this.nodeSystem, this.selectedNodes).execute();
	}

	alignAction() {
		new AlignNodesCommand(this.nodeSystem, this.selectedNodes).execute();
		this.menu.remove();
	}
}
