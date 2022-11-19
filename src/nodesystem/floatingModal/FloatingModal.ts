import type { NodeSystemEventHandler } from '../handlers/NodeSystemEventHandler';
import { ToastMessage } from '../toastMessage/ToastMessage';
import './floatingModal.css';
import { FloatingModalPositioner } from './FloatingModalPositioner';

export class FloatingModal {
	htmlElement: HTMLDivElement;
	initialMousePosition = {
		x: 0,
		y: 0
	};
	mouseIsDown = false;
	mouseMoved: boolean;
	x = 0;
	y = 0;

	constructor(public content: HTMLDivElement, eventHandler: NodeSystemEventHandler) {
		this.htmlElement = document.createElement('div');
		this.htmlElement.className = 'floating-modal';

		const closeButton = document.createElement('a');
		closeButton.className = 'floating-modal-close-button';
		closeButton.textContent = 'X';
		closeButton.onmouseup = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			eventHandler.addEventListeners();
			this.remove();
		};

		this.htmlElement.onmousedown = (e) => {
			this.mouseIsDown = true;
			this.initialMousePosition.x = e.clientX - this.x;
			this.initialMousePosition.y = e.clientY - this.y;
			e.stopImmediatePropagation();
			e.preventDefault();
			eventHandler.cleanup();
			window.addEventListener('mousemove', this.mousemove.bind(this));
			this.mouseMoved = false;
			FloatingModalPositioner.prototype.getInstance().bringToFront(this);
		};
		this.htmlElement.onmouseup = async (e) => {
			if (!this.mouseIsDown) return;
			this.htmlElement.style.cursor = 'grab';
			this.mouseIsDown = false;
			this.initialMousePosition.x = this.x;
			this.initialMousePosition.y = this.y;
			e.stopImmediatePropagation();
			e.preventDefault();
			window.removeEventListener('mousemove', this.mousemove.bind(this));
			eventHandler.addEventListeners();
			if (!this.mouseMoved) {
				await navigator.clipboard.writeText(this.copyableContent());
				new ToastMessage('Copied to clipboard', 'info').show();
			}
		};
		this.htmlElement.appendChild(closeButton);
		this.htmlElement.appendChild(content);
	}

	show() {
		document.querySelector('.container').appendChild(this.htmlElement);
		FloatingModalPositioner.prototype.getInstance().addModal(this);
	}

	remove() {
		this.htmlElement.remove();
		FloatingModalPositioner.prototype.getInstance().removeModal(this);
	}

	private mousemove(e: MouseEvent) {
		if (e.buttons == 0) return;
		if (!this.mouseIsDown) return;
		this.mouseMoved = true;
		let currentX = 0;
		let currentY = 0;

		currentX = e.clientX - this.initialMousePosition.x;
		currentY = e.clientY - this.initialMousePosition.y;

		this.setPosition(currentX, currentY);
		e.stopImmediatePropagation();
		e.preventDefault();
	}

	copyableContent() {
		return this.content.textContent;
	}

	setPosition(x: number, y: number) {
		this.htmlElement.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
		this.x = x;
		this.y = y;
	}

	overlaps(other: FloatingModal) {
		const rect1 = this.htmlElement.getBoundingClientRect();
		const rect2 = other.htmlElement.getBoundingClientRect();
		return !(
			rect1.right < rect2.left ||
			rect1.left > rect2.right ||
			rect1.bottom < rect2.top ||
			rect1.top > rect2.bottom
		);
	}
}
