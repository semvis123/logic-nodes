import type { NodeSystemEventHandler } from '../handlers/NodeSystemEventHandler';
import { FloatingModal } from './FloatingModal';

export class TextFloatingModal extends FloatingModal {
	constructor(titleText: string, private bodyText: string, eventHandler: NodeSystemEventHandler) {
		const content = document.createElement('div');
		const title = document.createElement('p');
		const body = document.createElement('p');
		body.className = 'floating-modal-body';
		body.textContent = bodyText;
		title.className = 'floating-modal-title';
		title.textContent = titleText;
		content.appendChild(title);
		if (bodyText) content.appendChild(body);
		super(content, eventHandler);
	}

	copyableContent(): string {
		return this.bodyText;
	}
}
