import type { ToolbarButton } from './ToolbarButton';

export class ToolbarDropdownMenu {
	htmlElement: HTMLDivElement;
	isOpen: boolean;
	onOpen: () => void;

	constructor(
		public name: string,
		public buttons: (ToolbarButton | ToolbarDropdownMenu)[] = [],
		public insideDropdown = false
	) {
		this.createHtmlElement();
	}

	createHtmlElement(): HTMLDivElement {
		this.htmlElement = document.createElement('div');
		this.htmlElement.classList.add('toolbar-dropdown-menu');
		if (this.insideDropdown) this.htmlElement.classList.add('toolbar-dropdown-menu-hidden');

		const buttonName = document.createElement('div');
		buttonName.classList.add('toolbar-dropdown-menu-name');
		buttonName.innerText = this.name;
		this.htmlElement.appendChild(buttonName);

		this.buttons.forEach((button) => {
			this.htmlElement.appendChild(button.htmlElement);
		});
		this.htmlElement.onmouseover = (event) => {
			if (this.insideDropdown) {
				if (!this.isOpen && this.onOpen) this.onOpen();
				event.stopPropagation();
				this.open();
			}
		};
		this.htmlElement.onmouseout = (event) => {
			if (this.insideDropdown) {
				event.stopPropagation();
				this.close();
			}
		};
		this.htmlElement.onclick = (event) => {
			if (!this.isOpen && this.onOpen) this.onOpen();
			if (!this.insideDropdown) event.stopPropagation();
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

	addButton(button: ToolbarButton | ToolbarDropdownMenu) {
		this.buttons.push(button);
		this.htmlElement.appendChild(button.htmlElement);
	}
}
