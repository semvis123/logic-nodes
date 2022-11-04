import type { NodeSystem } from '../NodeSystem';
import type { MetadataCategory } from '../Metadata';
import { ToolbarDropdownMenu } from './ToolbarDropdownMenu';
import { metadataCategories } from '../Metadata';
import { ToolbarButton } from './ToolbarButton';
import { nodeClasses } from '../nodes/nodes';
import { positionNode, uuid } from '../utils';
import './toolbar.css';
import { exampleSaves } from '../examples/exampleSaves';
import { CustomNode } from '../nodes/CustomNode';
import { CreateNodeCommand } from '../commands/CreateCustomNodeCommand';
import { SettingsCommand } from '../commands/SettingsCommand';
import { ExportCommand } from '../commands/ExportCommand';
import { ImportCommand } from '../commands/ImportCommand';
import { SaveAsCommand } from '../commands/SaveAsCommand';
import { SaveCommand } from '../commands/SaveCommand';
import { LoadSaveCommand } from '../commands/LoadSaveCommand';
import { NewCommand } from '../commands/NewCommand';
import type { Command } from '../commands/Command';
import { DisplayTruthTableCommand } from '../commands/DisplayTruthTableCommand';
import { CreateBooleanExpressionCommand } from '../commands/CreateBooleanExpressionCommand';

export class Toolbar {
	htmlElement: HTMLDivElement;
	buttons: (ToolbarButton | ToolbarDropdownMenu)[] = [];
	constructor(public nodeSystem: NodeSystem) {
		this.createHtmlElement();

		const fileDropdownMenu = new ToolbarDropdownMenu('File');
		let createButton = (text: string, commandClass: new (n: NodeSystem) => Command) => {
			const c = new commandClass(this.nodeSystem);
			return new ToolbarButton(text, c);
		};
		createButton = createButton.bind(this);

		for (const button of [
			createButton('New', NewCommand),
			createButton('Load', LoadSaveCommand),
			createButton('Save', SaveCommand),
			createButton('Save As', SaveAsCommand),
			createButton('Import', ImportCommand),
			createButton('Export', ExportCommand),
			createButton('Create node', CreateNodeCommand),
			createButton('Build truth table', DisplayTruthTableCommand),
			createButton('Simplify Logic', SimplifyLogicCommand),
			createButton('Boolean expression', CreateBooleanExpressionCommand),
			createButton('Settings', SettingsCommand),
		]) {
			fileDropdownMenu.addButton(button);
		}
		const examplesDropdownMenu = new ToolbarDropdownMenu('Examples', [], true);

		exampleSaves.forEach(({ filename, save }) => {
			examplesDropdownMenu.addButton(
				new ToolbarButton(filename, () => {
					this.nodeSystem.reset();
					this.nodeSystem.saveManager.loadSaveFile(save, filename, -1);
				})
			);
		});

		fileDropdownMenu.addButton(examplesDropdownMenu);

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
					window.innerWidth / 2 / this.nodeSystem.nodeRenderer.view.zoom - this.nodeSystem.nodeRenderer.view.x,
					window.innerHeight / 2 / this.nodeSystem.nodeRenderer.view.zoom - this.nodeSystem.nodeRenderer.view.y,
					this.nodeSystem.nodeStorage,
					this.nodeSystem.config
				);
				this.nodeSystem.nodeStorage.addNode(newNode);
				this.nodeSystem.nodeRenderer.requestRender();
			});
			createNodeDropdowns.get(nodeClass.prototype.getMetadata().category ?? 'Misc').addButton(node);
		});

		// custom nodes
		this.nodeSystem.saveManager.getCustomNodes().forEach((node) => {
			const button = new ToolbarButton(node.filename, () => {
				const newNode = new CustomNode(uuid(), 0, 0, this.nodeSystem, [
					{
						name: 'saveId',
						value: node.id
					},
					{
						name: 'nodeName',
						value: node.filename
					}
				]);
				positionNode(
					newNode,
					window.innerWidth / 2 / this.nodeSystem.nodeRenderer.view.zoom - this.nodeSystem.nodeRenderer.view.x,
					window.innerHeight / 2 / this.nodeSystem.nodeRenderer.view.zoom - this.nodeSystem.nodeRenderer.view.y,
					this.nodeSystem.nodeStorage,
					this.nodeSystem.config
				);
				this.nodeSystem.nodeStorage.addNode(newNode);
				this.nodeSystem.nodeRenderer.requestRender();
			});
			createNodeDropdowns.get('Custom').addButton(button);
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
