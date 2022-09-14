import './toastMessage.css';

export type ToastType = 'info' | 'danger' | 'success' | 'warning';

const icons = {
	info: '!',
	danger: '⚠️',
	success: '✓',
	warning: '⚠️'
};

export class ToastMessage {
	htmlElement: HTMLDivElement;
	content: HTMLParagraphElement;
	icon: HTMLParagraphElement;
	closeIcon: HTMLAnchorElement;
	timer: NodeJS.Timeout;
	removeTimer: NodeJS.Timeout;

	constructor(public message: string, public type: ToastType = 'info', public timeout: number = 4000) {
		this.htmlElement = document.createElement('div');
		this.htmlElement.className = 'toast-message';
		this.htmlElement.dataset.type = type;

		this.content = document.createElement('p');
		this.content.className = 'toast-message-text';
		this.content.innerText = message;

		this.icon = document.createElement('p');
		this.icon.className = 'toast-message-icon';
		this.icon.innerText = icons[type];

		this.closeIcon = document.createElement('a');
		this.closeIcon.className = 'toast-message-close-icon';
		this.closeIcon.innerText = 'X';
		this.closeIcon.onclick = this.remove.bind(this);

		this.htmlElement.appendChild(this.icon);
		this.htmlElement.appendChild(this.content);
		this.htmlElement.appendChild(this.closeIcon);
	}

	show() {
		document.getElementById('toast-container').appendChild(this.htmlElement);
		if (this.timeout !== 0) {
			this.timer = setTimeout(this.remove.bind(this), this.timeout);
		}
	}

	remove() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
		this.htmlElement.classList.add('toast-message-disappearing');
		if (!this.removeTimer) {
			this.removeTimer = setTimeout(() => {
				this.htmlElement.remove();
			}, 500);
		}
	}
}
