import './fullscreenPrompt.css';

export type NodeParameter = {
	name: string;
	label?: string;
	type?: 'number' | 'text' | 'checkbox' | 'button';
	value?: string | number;
	step?: number;
	readonly?: boolean;
	required?: boolean;
	min?: number;
	max?: number;
	maxlength?: number;
	minlength?: number;
	checked?: boolean;
	disabled?: boolean;
	onclick?: () => void;
};

export class FullscreenPrompt {
	htmlElement: HTMLDivElement;
	popupElement: HTMLDivElement;

	constructor() {
		this.htmlElement = document.createElement('div');
		this.htmlElement.className = 'popup-container';
		this.popupElement = document.createElement('div');
		this.popupElement.className = 'popup';
		this.htmlElement.appendChild(this.popupElement);
		window.document.body.appendChild(this.htmlElement);
	}

	requestParameters(title, parameters: NodeParameter[]): Promise<NodeParameter[]> {
		return new Promise((resolve, reject) => {
			const titleEl = document.createElement('h1');
			titleEl.innerText = title;
			this.popupElement.appendChild(titleEl);
			parameters = parameters.map((param) => Object.assign({}, param));
			parameters.forEach((param) => {
				const paramEl = document.createElement('div');
				const paramLabel = document.createElement('p');
				const paramInput = document.createElement('input');
				const paramInputContainer = document.createElement('div');
				paramLabel.innerText = param.label ?? '';
				Object.assign(paramInput, param);
				paramInputContainer.appendChild(paramInput);
				paramEl.appendChild(paramLabel);
				paramEl.appendChild(paramInputContainer);
				paramEl.className = 'parameter';
				paramInput.onchange = (e) => {
					if (param.type == 'checkbox') param.checked = (e.currentTarget as HTMLInputElement).checked;
					else param.value = (e.currentTarget as HTMLInputElement).value;
				};
				this.popupElement.appendChild(paramEl);
			});

			const submitBtn = document.createElement('input');
			submitBtn.type = 'button';
			submitBtn.value = 'Save';
			submitBtn.onclick = () => {
				this.htmlElement.remove();
				resolve(parameters);
			};
			this.htmlElement.onclick = () => {
				this.htmlElement.remove();
				reject();
			};
			this.popupElement.appendChild(submitBtn);
		});
	}

	requestSelectionFromList(title: string, list: string[]): Promise<number> {
		return new Promise((resolve, reject) => {
			const titleEl = document.createElement('h1');
			titleEl.innerText = title;
			this.popupElement.appendChild(titleEl);

			const listEl = document.createElement('ul');
			list.forEach((item, index) => {
				const paramEl = document.createElement('li');
				const paramLabel = document.createElement('p');
				paramLabel.innerText = item;
				paramEl.className = 'list-item';
				paramEl.onclick = (e) => {
					this.htmlElement.remove();
					resolve(index);
				};
				paramEl.appendChild(paramLabel);
				listEl.appendChild(paramEl);
			});

			this.htmlElement.onclick = () => {
				this.htmlElement.remove();
				reject();
			};

			this.popupElement.appendChild(listEl);
		});
	}
}
