import './nodedetailbox.css'

export type NodeParameter = {
	name: string;
	label?: string;
	type?: 'number' | 'text' | 'checkbox';
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
};

export class NodeDetailBox {
	htmlElement: HTMLDivElement;
    popupElement: HTMLDivElement;

	constructor() {
		this.htmlElement = document.createElement('div');
        this.htmlElement.className = "popup-container";
		this.popupElement = document.createElement('div');
        this.popupElement.className = "popup";
        this.htmlElement.appendChild(this.popupElement);
		window.document.body.appendChild(this.htmlElement);
	}

	requestParameters(title, parameters: NodeParameter[]): Promise<NodeParameter[]> {
		return new Promise(((resolve) => {
			const titleEl = document.createElement('h1');
			titleEl.innerText = title;
            this.popupElement.appendChild(titleEl);
            parameters = parameters.map((param)=>Object.assign({}, param));
			parameters.forEach((param) => {
				const paramEl = document.createElement('div');
				const paramLabel = document.createElement('p');
				const paramInput = document.createElement('input');
                const paramInputContainer = document.createElement('div');
				paramLabel.innerText = param.label;
				Object.assign(paramInput, param);
                paramInputContainer.appendChild(paramInput);
				paramEl.appendChild(paramLabel);
				paramEl.appendChild(paramInputContainer);
                paramEl.className = 'parameter';
				paramInput.onchange = (e) => {
                    if (param.type == 'checkbox')
					    param.checked = (e.currentTarget as HTMLInputElement).checked;
                    else
					    param.value = (e.currentTarget as HTMLInputElement).value;
				};
				this.popupElement.appendChild(paramEl);
			});

			const submitBtn = document.createElement('input');
            submitBtn.type = 'button';
            submitBtn.value = 'Save'
			submitBtn.onclick = () => {
                this.htmlElement.remove();
				resolve(parameters);
			};
            this.popupElement.appendChild(submitBtn);
		}));
	}
}
