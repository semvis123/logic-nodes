import type { NodeSystem } from '../NodeSystem';
import type { MetadataCategory } from '../Metadata';
import { ToolbarDropdownMenu } from './ToolbarDropdownMenu';
import { metadataCategories } from '../Metadata';
import { ToolbarButton } from './ToolbarButton';
import { nodeClasses } from '../nodes/nodes';
import { positionNode, uuid } from '../utils';
import './toolbar.css';
import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import type { NodeSaveFile } from '../NodeSaveFile';

export class Toolbar {
	htmlElement: HTMLDivElement;
	buttons: (ToolbarButton | ToolbarDropdownMenu)[] = [];
	constructor(public nodeSystem: NodeSystem) {
		this.createHtmlElement();

		const newAction = () => {
			this.nodeSystem.reset();
			this.nodeSystem.nodeRenderer.render();
			this.nodeSystem.filename = 'Unititled';
		};

		const loadAction = async () => {
			// show savefile dialog
			type SaveMetadata = { id: number; filename: string };
			const saves: SaveMetadata[] = JSON.parse(window.localStorage.getItem('saves')) ?? [];
			const saveMetaData =
				saves[
					await new FullscreenPrompt().requestSelectionFromList(
						'Select savefile:',
						saves.map((x) => x.filename)
					)
				];
			const save: NodeSaveFile = JSON.parse(window.localStorage.getItem('save_' + saveMetaData.id));
			this.nodeSystem.reset();
			this.nodeSystem.config.setConfig(save.config);
			this.nodeSystem.loadSave(save);
			this.nodeSystem.saveId = saveMetaData.id;
			this.nodeSystem.filename = saveMetaData.filename;
			this.nodeSystem.nodeRenderer.render();
		};

		const saveAction = async () => {
			if (this.nodeSystem.saveId == -1) return saveAsAction();
			// save to localstorage
			const save = this.nodeSystem.save();
			const saveData = JSON.stringify(save);

			window.localStorage.setItem('save_' + this.nodeSystem.saveId, saveData);
		};

		const saveAsAction = async () => {
			// save to localstorage
			const save = this.nodeSystem.save();
			const saveData = JSON.stringify(save);
			const newSaveId: number = parseInt(window.localStorage.getItem('lastSaveId') ?? '0') + 1;

			const dialog = new FullscreenPrompt();
			const params = await dialog.requestParameters('Save', [
				{
					name: 'filename',
					label: 'Filename',
					value: 'save ' + newSaveId,
					type: 'text',
					required: true
				}
			]);
			const filename = params[0].value as string;

			type SaveMetadata = { id: number; filename: string };
			const saves: SaveMetadata[] = JSON.parse(window.localStorage.getItem('saves')) ?? [];
			saves.push({ id: newSaveId, filename });
			window.localStorage.setItem('saves', JSON.stringify(saves));
			window.localStorage.setItem('lastSaveId', newSaveId.toString());
			window.localStorage.setItem('save_' + newSaveId, saveData);
			this.nodeSystem.saveId = newSaveId;
			this.nodeSystem.filename = filename;
		};

		const importAction = () => {
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
		};

		const exportAction = () => {
			// download save
			const save = this.nodeSystem.save();
			const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'save.json';
			a.click();
		};

		const settingsAction = async () => {
			// show setting popup
			const popup = new FullscreenPrompt();
			const parameters = await popup.requestParameters('Settings', [
				{
					name: 'colorConnectionLines',
					label: 'Change connection line color based on value.',
					checked: this.nodeSystem.config.colorConnectionLines,
					type: 'checkbox'
				},
				(this.nodeSystem.saveId != -1) && {
					name: 'delete',
					type: 'button',
					label: 'Current savefile',
					value: 'Delete',
					onclick: () => {
						//
					}
				}
			]);
			parameters.forEach((param) => {
				this.nodeSystem.config[param.name] = param.type == 'checkbox' ? param.checked : param.value;
			});
		};

		const fileDropdownMenu = new ToolbarDropdownMenu('File');
		const newButton = new ToolbarButton('New', newAction);
		const openButton = new ToolbarButton('Load', loadAction);
		const saveButton = new ToolbarButton('Save', saveAction);
		const saveAsButton = new ToolbarButton('Save As', saveAsAction);
		const importButton = new ToolbarButton('Import', importAction);
		const exportButton = new ToolbarButton('Export', exportAction);
		const settingsButton = new ToolbarButton('Settings', settingsAction);

		for (const button of [
			newButton,
			openButton,
			saveButton,
			saveAsButton,
			importButton,
			exportButton,
			settingsButton
		]) {
			fileDropdownMenu.addButton(button);
		}

		fileDropdownMenu.onOpen = this.closeAll.bind(this);
		this.buttons.push(fileDropdownMenu);
		this.htmlElement.appendChild(fileDropdownMenu.htmlElement);

		const createNodeDropdowns = new Map<MetadataCategory, ToolbarDropdownMenu>();
		metadataCategories.forEach((category) => {
			createNodeDropdowns.set(category, new ToolbarDropdownMenu(category));
		});

		nodeClasses.forEach((nodeClass) => {
			const node = new ToolbarButton(nodeClass.prototype.getMetadata().displayName, () => {
				const newNode = new nodeClass(uuid(), 0, 0, this.nodeSystem);
				positionNode(
					newNode,
					window.innerWidth / 2,
					window.innerHeight / 2,
					this.nodeSystem.nodeStorage,
					this.nodeSystem.config
				);
				this.nodeSystem.nodeStorage.addNode(newNode);
				this.nodeSystem.nodeRenderer.render();
			});
			createNodeDropdowns.get(nodeClass.prototype.getMetadata().category ?? 'Misc').addButton(node);
		});

		createNodeDropdowns.forEach((dropdown) => {
			if (dropdown.buttons.length > 0) {
				this.buttons.push(dropdown);
				this.htmlElement.appendChild(dropdown.htmlElement);
				dropdown.onOpen = this.closeAll.bind(this);
			}
		});
	}

	closeAll() {
		this.buttons.forEach((dropdown) => {
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
