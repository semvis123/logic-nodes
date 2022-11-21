import type { SaveMetadata } from '../SaveManager';
import type { Folder } from './Folder';
import './fullscreenPrompt.css';

export type NodeParameter = {
	name: string;
	label?: string;
	type?: 'number' | 'text' | 'checkbox' | 'button' | 'color' | 'select';
	value?: string | number;
	options?: { label: string; value: string | number }[];
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
	autofocus?: boolean;
	onclick?: () => void;
};

export class FullscreenPrompt {
	htmlElement: HTMLDivElement;
	popupElement: HTMLDivElement;
	promise: Promise<NodeParameter[] | SaveMetadata | void>;
	rejectPromise: (reason?: string) => void;
	resolvePromise: (
		value:
			| NodeParameter[]
			| SaveMetadata
			| void
			| PromiseLike<void>
			| PromiseLike<NodeParameter[]>
			| PromiseLike<SaveMetadata>
	) => void;
	failOnClose = false;

	constructor() {
		this.htmlElement = document.createElement('div');
		this.htmlElement.className = 'popup-container';
		this.popupElement = document.createElement('div');
		this.popupElement.className = 'popup';
		this.htmlElement.appendChild(this.popupElement);
		window.document.body.appendChild(this.htmlElement);
		this.closeOnEscape = this.closeOnEscape.bind(this);
		this.closeOnOutsideClick = this.closeOnOutsideClick.bind(this);
	}

	requestParameters(title: string, parameters: NodeParameter[]): Promise<NodeParameter[] | null> {
		const result = new Promise<NodeParameter[]>((resolve, reject) => {
			this.rejectPromise = reject;
			this.resolvePromise = resolve;
			this.addCloseListeners();
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
				this.close(true, null);
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
				if (param.type == 'select') {
					paramInput.remove();
					paramInputContainer.className = 'select-container';
					const select = document.createElement('select');
					select.name = param.name;
					param.options.forEach((option) => {
						const optionEl = document.createElement('option');
						optionEl.value = option.value.toString();
						optionEl.innerText = option.label;
						select.appendChild(optionEl);
					});
					paramInputContainer.appendChild(select);
					select.value = param.value.toString();
					select.onchange = () => {
						param.value = select.value;
					}
				}
				paramEl.appendChild(paramLabel);
				paramEl.appendChild(paramInputContainer);
				paramEl.className = 'parameter';
				paramInput.onchange = (e) => {
					if (param.type == 'checkbox') param.checked = (e.currentTarget as HTMLInputElement).checked;
					else param.value = (e.currentTarget as HTMLInputElement).value;
				};
				paramInput.onkeydown = (e: KeyboardEvent) => {
					if (e.key == 'Enter') {
						paramInput.onchange(e);
						e.preventDefault();
						submitBtn.click();
					}
				};
				this.popupElement.appendChild(paramEl);
			});

			this.popupElement.appendChild(cancelBtn);
			this.popupElement.appendChild(submitBtn);
		});

		this.promise = result;
		return result;
	}

	requestSelectionFromFolder(folder: Folder): Promise<SaveMetadata> {
		const result = new Promise<SaveMetadata>((resolve, reject) => {
			this.addCloseListeners();
			this.rejectPromise = reject;
			this.resolvePromise = resolve;
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
				paramEl.onclick = async () => {
					this.removeCloseListeners();
					const save = await new FullscreenPrompt().requestSelectionFromFolder(folder);
					if (save) {
						resolve(save);
						this.htmlElement.remove();
					} else {
						this.addCloseListeners();
					}
				};
				paramEl.appendChild(paramLabel);
				listEl.appendChild(paramEl);
			});

			const cancelBtn = document.createElement('input');
			cancelBtn.type = 'button';
			cancelBtn.value = 'x';
			cancelBtn.className = 'cancelbtn';
			cancelBtn.onclick = () => {
				this.close(true, null);
			};

			this.popupElement.appendChild(cancelBtn);
			this.popupElement.appendChild(listEl);
		});

		this.promise = result;
		return result;
	}

	close(resolve = false, result: NodeParameter[] | SaveMetadata | void = null) {
		if (this.promise) {
			if (resolve) this.resolvePromise(result);
			else this.rejectPromise();
		}
		this.htmlElement.remove();
		this.removeCloseListeners();
	}

	closeOnEscape(e: KeyboardEvent) {
		if (e.key == 'Escape') {
			e.preventDefault();
			this.close(!this.failOnClose);
		}
	}

	closeOnOutsideClick(e: MouseEvent) {
		if (e.target == this.htmlElement) this.close(!this.failOnClose);
	}

	addCloseListeners(failOnClose = false) {
		this.failOnClose = failOnClose;
		window.addEventListener('keydown', this.closeOnEscape);
		this.htmlElement.addEventListener('click', this.closeOnOutsideClick);
	}

	removeCloseListeners() {
		window.removeEventListener('keydown', this.closeOnEscape);
		this.htmlElement.removeEventListener('click', this.closeOnOutsideClick);
	}
}
