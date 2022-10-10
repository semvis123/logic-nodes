import type { SaveMetadata } from '../SaveManager';
import type { Folder } from './Folder';
import './fullscreenPrompt.css';

export type NodeParameter = {
	name: string;
	label?: string;
	type?: 'number' | 'text' | 'checkbox' | 'button' | 'color';
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
	pattern?: string;
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

	requestParameters(title: string, parameters: NodeParameter[]): Promise<NodeParameter[]> {
		return new Promise((resolve, reject) => {
			const titleEl = document.createElement('h1');
			titleEl.innerText = title;
			const submitBtn = document.createElement('input');
			submitBtn.type = 'button';
			submitBtn.value = 'Save';
			submitBtn.onclick = () => {
				this.htmlElement.remove();
				resolve(parameters);
			};

			const cancelBtn = document.createElement('input');
			cancelBtn.type = 'button';
			cancelBtn.value = 'x';
			cancelBtn.className = 'cancelbtn';
			cancelBtn.onclick = () => {
				this.htmlElement.remove();
				reject();
			};
			this.popupElement.appendChild(titleEl);
			parameters = parameters.map((param) => Object.assign({}, param));
			parameters.forEach((param) => {
				if (Object.keys(param).length == 0) return;
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
				paramInput.onkeydown = (e: KeyboardEvent) => {
					if (e.key == 'Enter') submitBtn.click();
				};
				this.popupElement.appendChild(paramEl);
			});

			this.popupElement.appendChild(cancelBtn);
			this.popupElement.appendChild(submitBtn);
		});
	}

	requestSelectionFromFolder(folder: Folder): Promise<SaveMetadata> {
		return new Promise((resolve, reject) => {
			const titleEl = document.createElement('h1');
			titleEl.innerText = folder.name;
			this.popupElement.appendChild(titleEl);

			const listEl = document.createElement('ul');
			folder.files.forEach((item) => {
				const paramEl = document.createElement('li');
				const paramLabel = document.createElement('p');
				paramLabel.innerText = item.filename;
				paramEl.className = 'list-item';
				paramEl.onclick = () => {
					this.htmlElement.remove();
					resolve(item);
				};
				paramEl.appendChild(paramLabel);
				listEl.appendChild(paramEl);
			});

			folder.directories.forEach((folder) => {
				const paramEl = document.createElement('li');
				const paramLabel = document.createElement('p');
				paramLabel.innerText = '> ' + folder.name;
				paramEl.className = 'list-item list-folder';
				paramEl.onclick = () => {
					new FullscreenPrompt()
						.requestSelectionFromFolder(folder)
						.then((save: SaveMetadata) => {
							this.htmlElement.remove();
							resolve(save);
						})
						.catch();
				};
				paramEl.appendChild(paramLabel);
				listEl.appendChild(paramEl);
			});

			const cancelBtn = document.createElement('input');
			cancelBtn.type = 'button';
			cancelBtn.value = 'x';
			cancelBtn.className = 'cancelbtn';
			cancelBtn.onclick = () => {
				this.htmlElement.remove();
				reject();
			};

			this.popupElement.appendChild(cancelBtn);
			this.popupElement.appendChild(listEl);
		});
	}
}
