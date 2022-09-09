import type { NodeSystem } from '../NodeSystem';
import type { MetadataCategory } from '../Metadata';
import { ToolbarDropdownMenu } from './ToolbarDropdownMenu';
import { metadataCategories } from '../Metadata';
import { ToolbarButton } from './ToolbarButton';
import { nodeClasses } from '../nodes/nodes';
import { positionNode, uuid } from '../utils';
import './toolbar.css';
import { NodeDetailBox } from '../nodeDetailBox/NodeDetailBox';

export class Toolbar {
	htmlElement: HTMLDivElement;
	buttons: (ToolbarButton | ToolbarDropdownMenu)[] = [];
	constructor(public nodeSystem: NodeSystem) {
		this.createHtmlElement();
		const fileDropdownMenu = new ToolbarDropdownMenu('File');
		const newButton = new ToolbarButton('New', () => {
			this.nodeSystem.reset();
			this.nodeSystem.nodeRenderer.render();
			// this.nodeSystem.config.setConfig(playground.config);
			// this.nodeSystem.loadSave(playground);
		});

		const openButton = new ToolbarButton('Open', () => {
			// show open dialog
			const openDialog = document.createElement('input');
			openDialog.type = 'file';
			openDialog.accept = '.json';
			openDialog.onchange = (event: Event) => {
				const file = (event.target as HTMLInputElement).files[0];
				if (file) {
					const reader = new FileReader();
					reader.onload = () => {
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


		const settingsButton = new ToolbarButton('Settings', async () => {
			// show setting popup
			const popup = new NodeDetailBox();
			const parameters = await popup.requestParameters('Settings', [{
				name: 'colorConnectionLines',
				label: 'Change connection line color based on value.',
				checked: this.nodeSystem.config.colorConnectionLines,
				type: 'checkbox'
			}]);
			parameters.forEach(param => {
				this.nodeSystem.config[param.name] = param.type == 'checkbox' ? param.checked : param.value;
			})
		});

		fileDropdownMenu.addButton(newButton);
		fileDropdownMenu.addButton(openButton);
		fileDropdownMenu.addButton(saveButton);
		fileDropdownMenu.addButton(settingsButton);
		fileDropdownMenu.onOpen = this.closeAll.bind(this);
		this.buttons.push(fileDropdownMenu);
		this.htmlElement.appendChild(fileDropdownMenu.htmlElement);

		const createNodeDropdowns = new Map<MetadataCategory, ToolbarDropdownMenu>();
		metadataCategories.forEach(category => {
			createNodeDropdowns.set(category, new ToolbarDropdownMenu(category));
		});

		nodeClasses.forEach(nodeClass => {
			const node = new ToolbarButton(nodeClass.prototype.getMetadata().displayName, () => {
				const newNode = new nodeClass(uuid(), 0, 0, this.nodeSystem);
				positionNode(newNode, this.nodeSystem.nodeStorage, window.innerWidth / 2, window.innerHeight / 2);
				this.nodeSystem.nodeStorage.addNode(newNode);
				this.nodeSystem.nodeRenderer.render();
			});
			createNodeDropdowns.get(nodeClass.prototype.getMetadata().category ?? 'Misc').addButton(node);
		})

		createNodeDropdowns.forEach(dropdown => {
			if (dropdown.buttons.length > 0) {
				this.buttons.push(dropdown)
				this.htmlElement.appendChild(dropdown.htmlElement);
				dropdown.onOpen = this.closeAll.bind(this);
			}
		})
	}

	closeAll() {
		console.log('aaa')
		this.buttons.forEach(dropdown => {
			if (!(dropdown instanceof ToolbarDropdownMenu)) return;
			dropdown.close();			
		});
	}

	createHtmlElement(): HTMLDivElement {
		this.htmlElement = document.createElement('div');
		this.htmlElement.classList.add('toolbar');
		this.buttons.forEach((button) => {
			this.htmlElement.appendChild(button.htmlElement);
		});

		// add to DOM
		this.nodeSystem.canvas.parentElement.appendChild(this.htmlElement);

		return this.htmlElement;
	}
}
