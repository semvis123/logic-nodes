import type { ToolbarButton } from './ToolbarButton';

export class ToolbarDropdownMenu {
	htmlElement: HTMLDivElement;
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
			event.stopPropagation();
			this.htmlElement.classList.toggle('toolbar-dropdown-menu-open');
			this.buttons.forEach((button) => {
				button.htmlElement.classList.toggle('toolbar-dropdown-menu-button-open');
			});
		};

		return this.htmlElement;
	}

	addButton(button: ToolbarButton) {
		this.buttons.push(button);
		this.htmlElement.appendChild(button.htmlElement);
	}
}
