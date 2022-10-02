import type { NodeSystem } from '../NodeSystem';
import { ToolbarButton } from './ToolbarButton';
import './toolbar.css';

export class BottomToolbar {
	htmlElement: HTMLDivElement;
	buttons: ToolbarButton[] = [];
	zoomLevel: ToolbarButton;
	filename: ToolbarButton;

	constructor(public nodeSystem: NodeSystem) {
		this.createHtmlElement();
		this.createButtons();
	}

	createButtons() {
		this.zoomLevel = new ToolbarButton('100%', () => {
			this.nodeSystem.nodeRenderer.setZoom(1);
		});
		this.filename = new ToolbarButton('filename', null);
		this.filename.htmlElement.classList.add('toolbar-text');

		this.htmlElement.appendChild(this.filename.htmlElement);
		this.htmlElement.appendChild(this.zoomLevel.htmlElement);
		this.htmlElement.appendChild(
			new ToolbarButton('Zoom to fit', () => {
				this.nodeSystem.nodeRenderer.zoomToFit();
			}).htmlElement
		);
	}

	setFileName(filename: string) {
		this.filename.setText(filename);
	}

	setZoom(zoom: number) {
		this.zoomLevel.setText(`${Math.round(zoom * 100)}%`);
	}

	createHtmlElement(): HTMLDivElement {
		this.htmlElement = document.createElement('div');
		this.htmlElement.classList.add('toolbar');
		this.htmlElement.classList.add('bottom-toolbar');
		this.buttons.forEach((button) => {
			this.htmlElement.appendChild(button.htmlElement);
		});

		// add to DOM
		this.nodeSystem.canvas.parentElement.appendChild(this.htmlElement);

		return this.htmlElement;
	}
}
