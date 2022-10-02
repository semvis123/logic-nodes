import { Command } from '../commands/Command';

export class ToolbarButton {
	htmlElement: HTMLDivElement;
	constructor(public name: string, public clickHandler: (() => void) | Command, public icon?: string) {
		this.htmlElement = this.createHtmlElement();
	}
	createHtmlElement(): HTMLDivElement {
		const button = document.createElement('div');
		button.classList.add('toolbar-button');
		button.innerHTML = `<i>${this.name}</i>`;
		button.addEventListener('click', () => {
			if (this.clickHandler instanceof Command) {
				this.clickHandler.execute();
			} else {
				this.clickHandler();
			}
		});
		return button;
	}

	setText(text: string) {
		this.htmlElement.innerHTML = `<i>${text}</i>`;
	}
}
