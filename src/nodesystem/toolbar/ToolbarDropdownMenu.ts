import type { ToolbarButton } from './ToolbarButton';

export class ToolbarDropdownMenu {
	htmlElement: HTMLDivElement;
	isOpen: boolean;
	onOpen: () => void;

	constructor(public name: string, public buttons: ToolbarButton[] = []) {
		this.createHtmlElement();
	}

	createHtmlElement(): HTMLDivElement {
		this.htmlElement = document.createElement('div');
		this.htmlElement.classList.add('toolbar-dropdown-menu');
		this.htmlElement.innerHTML = `<div class="toolbar-dropdown-menu-name">${this.name}</div>`;
		this.buttons.forEach((button) => {
			this.htmlElement.appendChild(button.htmlElement);
		});
		this.htmlElement.onclick = (event) => {
			if (!this.isOpen && this.onOpen) this.onOpen();
			event.stopPropagation();
			if (this.isOpen) this.close();
			else this.open();
		};

		return this.htmlElement;
	}

	close() {
		this.isOpen = false;
		this.htmlElement.classList.remove('toolbar-dropdown-menu-open');
		this.buttons.forEach((button) => {
			button.htmlElement.classList.remove('toolbar-dropdown-menu-button-open');
		});
	}

	open() {
		this.isOpen = true;
		this.htmlElement.classList.add('toolbar-dropdown-menu-open');
		this.buttons.forEach((button) => {
			button.htmlElement.classList.add('toolbar-dropdown-menu-button-open');
		});
	}

	addButton(button: ToolbarButton) {
		this.buttons.push(button);
		this.htmlElement.appendChild(button.htmlElement);
	}
}
