import type { Node } from './Node';
import type { NodeSystem } from './NodeSystem';
import { EditNodeCommand } from './commands/EditNodeCommand';
import { DeleteCommand } from './commands/DeleteCommand';
import { PasteCommand } from './commands/PasteCommand';
import { CopyCommand } from './commands/CopyCommand';
import { DuplicateCommand } from './commands/DuplicateCommand';
import { AlignNodesCommand } from './commands/AlignNodesCommand';
import { ChangeLayerOfNodeCommand } from './commands/ChangeLayerOfNodeCommand';
import { FilterNodesCommand } from './commands/FilterNodesCommand';

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
			edit: this.selectedNodes?.length > 0 && {
				text: 'Edit',
				onclick: this.editAction
			},
			copy: this.selectedNodes?.length > 0 && {
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
			},
			layer: this.selectedNodes?.length > 0 && {
				text: 'Change layer',
				onclick: this.moveNodesAction
			},
			filter: this.selectedNodes?.length > 0 && {
				text: 'Filter selection',
				onclick: this.filterNodesAction
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
		this.remove();
		new EditNodeCommand(this.nodeSystem, this.selectedNodes).execute();
	}

	deleteAction() {
		this.remove();
		new DeleteCommand(this.nodeSystem).execute();
	}

	copyAction() {
		this.remove();
		new CopyCommand(this.nodeSystem).execute();
	}

	pasteAction() {
		this.remove();
		new PasteCommand(this.nodeSystem).execute();
	}

	duplicateAction() {
		this.remove();
		new DuplicateCommand(this.nodeSystem).execute();
	}

	alignAction() {
		new AlignNodesCommand(this.nodeSystem, this.selectedNodes).execute();
		this.remove();
	}

	moveNodesAction() {
		new ChangeLayerOfNodeCommand(this.nodeSystem, this.selectedNodes).execute();
		this.remove();
	}

	filterNodesAction() {
		new FilterNodesCommand(this.nodeSystem).execute();
		this.remove();
	}

	remove() {
		this.menu.remove();
		this.menu = null;
		this.nodeSystem.editorState.contextMenu = null;
	}
}
