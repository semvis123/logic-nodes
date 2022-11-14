import type { NodeSystemEventHandler } from '../handlers/NodeSystemEventHandler';
import { ToastMessage } from '../toastMessage/ToastMessage';
import './floatingModal.css';

export class FloatingModal {
	htmlElement: HTMLDivElement;
	initialMousePosition = {
		x: 0,
		y: 0
	};
	offsetMousePosition = {
		x: 0,
		y: 0
	};
	mouseIsDown = false;
	mouseMoved: boolean;

	constructor(public content: HTMLDivElement, eventHandler: NodeSystemEventHandler) {
		this.htmlElement = document.createElement('div');
		this.htmlElement.className = 'floating-modal';

		const closeButton = document.createElement('a');
		closeButton.className = 'floating-modal-close-button';
		closeButton.textContent = 'X';
		closeButton.onmouseup = (e)=> {
            e.preventDefault();
            e.stopImmediatePropagation();
            eventHandler.addEventListeners();
            this.remove();
        }

		this.htmlElement.onmousedown = (e) => {
			this.mouseIsDown = true;
			this.initialMousePosition.x = e.clientX - this.offsetMousePosition.x;
			this.initialMousePosition.y = e.clientY - this.offsetMousePosition.y;
			e.stopImmediatePropagation();
			e.preventDefault();
			eventHandler.cleanup();
			window.addEventListener('mousemove', this.mousemove.bind(this));
			this.mouseMoved = false;
		};
		this.htmlElement.onmouseup = async (e) => {
			this.htmlElement.style.cursor = 'grab';
			this.mouseIsDown = false;
			this.initialMousePosition.x = this.offsetMousePosition.x;
			this.initialMousePosition.y = this.offsetMousePosition.y;
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
		document.body.appendChild(this.htmlElement);
	}

	remove() {
		this.htmlElement.remove();
	}

	private mousemove(e) {
		if (e.buttons == 0) return;
		if (!this.mouseIsDown) return;
		this.mouseMoved = true;
		let currentX = 0;
		let currentY = 0;

		currentX = e.clientX - this.initialMousePosition.x;
		currentY = e.clientY - this.initialMousePosition.y;

		this.offsetMousePosition.x = currentX;
		this.offsetMousePosition.y = currentY;

		this.htmlElement.style.transform = 'translate3d(' + currentX + 'px, ' + currentY + 'px, 0)';
		e.stopImmediatePropagation();
		e.preventDefault();
	}

	copyableContent() {
		return this.content.textContent;
	}
}
