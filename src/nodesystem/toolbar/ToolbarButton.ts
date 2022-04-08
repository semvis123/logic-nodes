export class ToolbarButton {
	htmlElement: HTMLDivElement;
	constructor(public name: string, public clickHandler: () => void, public icon?: string) {
		this.htmlElement = this.createHtmlElement();
	}
	createHtmlElement(): HTMLDivElement {
		const button = document.createElement('div');
		button.classList.add('toolbar-button');
		button.innerHTML = `<i>${this.name}</i>`;
		button.addEventListener('click', this.clickHandler);
		return button;
	}
}
