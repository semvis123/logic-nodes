import type { NodeSystem } from '../NodeSystem';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDropdownMenu } from './ToolbarDropdownMenu';
import './toolbar.css';
import { playground } from '../example_playground';

export class Toolbar {
	htmlElement: HTMLDivElement;
	buttons: (ToolbarButton | ToolbarDropdownMenu)[] = [];
	constructor(public nodeSystem: NodeSystem) {
		this.createHtmlElement();
		const fileDropdownMenu = new ToolbarDropdownMenu('File');
		const newButton = new ToolbarButton('New', () => {
			this.nodeSystem.reset();
			this.nodeSystem.config.setConfig(playground.config);
			this.nodeSystem.loadSave(playground);
		});

		const openButton = new ToolbarButton('Open', () => {
			// show open dialog
			const openDialog = document.createElement('input');
			openDialog.type = 'file';
			openDialog.accept = '.json';
			openDialog.onchange = (event: any) => {
				const file = event.target.files[0];
				if (file) {
					const reader = new FileReader();
					reader.onload = (event: any) => {
						const json = JSON.parse(reader.result as string);
						this.nodeSystem.reset();
						this.nodeSystem.config.setConfig(json.config);
						this.nodeSystem.loadSave(json);
					};
					reader.readAsText(file);
				}
			};
			openDialog.click();
		});

		const saveButton = new ToolbarButton('Save', () => {
			// download save
			const save = this.nodeSystem.save();
			const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'save.json';
			a.click();
		});
		fileDropdownMenu.addButton(newButton);
		fileDropdownMenu.addButton(openButton);
		fileDropdownMenu.addButton(saveButton);
		this.buttons.push(fileDropdownMenu);
		this.htmlElement.appendChild(fileDropdownMenu.htmlElement);
	}

	createHtmlElement(): HTMLDivElement {
		this.htmlElement = document.createElement('div');
		this.htmlElement.classList.add('toolbar');
		this.buttons.forEach((button) => {
			this.htmlElement.appendChild(button.htmlElement);
		});

		// add to DOM
		document.body.appendChild(this.htmlElement);

		return this.htmlElement;
	}
}
