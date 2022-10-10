import './tooltip.css';

export class Tooltip {
	htmlElement: HTMLDivElement;
	constructor(private x: number, private y: number, private text: string) {}

	createElement() {
		this.htmlElement = document.createElement('div');
		this.htmlElement.style.transform = `translate(${this.x}px, ${this.y}px)`;
		this.htmlElement.innerText = this.text;
		this.htmlElement.classList.add('tooltip');
		return this.htmlElement;
	}

	destroy() {
		this.htmlElement.remove();
	}

	setPos(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.htmlElement.style.transform = `translate(${this.x}px, ${this.y}px)`;
	}
}
