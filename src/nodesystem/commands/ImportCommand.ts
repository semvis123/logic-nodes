import type { NodeSaveFile } from '../NodeSaveFile';
import { uuid } from '../utils';
import { Command } from './Command';
import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import { ToastMessage } from '../toastMessage/ToastMessage';

export class ImportCommand extends Command {
	execute() {
		// show open dialog
		const openDialog = document.createElement('input');
		openDialog.type = 'file';
		openDialog.accept = '.json';
		openDialog.onchange = (event: Event) => {
			const file = (event.target as HTMLInputElement).files[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = async () => {
					this.nodeSystem.eventHandler.removeEventListeners();

					const json = JSON.parse(reader.result as string) as NodeSaveFile;
					const fullscreenPrompt = new FullscreenPrompt();
					const dependencies = this.getDependencyNames(json);
					const params = await fullscreenPrompt.requestParameters('Import save', [
						{
							name: 'importName',
							label: 'Name',
							type: 'text',
							required: true,
							value: file.name.replace('.json', '')
						},
						dependencies && {
							name: 'importDependencies',
							label: `Import ${Object.keys(dependencies).length} dependenc${
								Object.keys(dependencies).length == 1 ? 'y' : 'ies'
							}`,
							type: 'checkbox',
							checked: true
						}
					]);
					const name = params[0].value as string;
					const importDependencies = params[1].checked;
					if (!name) {
						return new ToastMessage('Please enter a name for the save file.', 'danger').show();
					}
					if (importDependencies) {
						console.log(dependencies);
						for (const [dependencyId, name] of Object.entries(dependencies)) {
							if (this.nodeSystem.saveManager.getSaveFile(dependencyId, false, true)) {
								// ask if it should be overwritten
								if (
									!confirm('A custom node with the name "' + name + '" already exists. Do you want to overwrite it?')
								) {
									continue;
								}
								this.nodeSystem.saveManager.deleteSaveFile(dependencyId, false, true);
							}

							this.nodeSystem.saveManager.saveToLocalStorage(
								json.dependencies[dependencyId],
								name,
								dependencyId,
								false,
								true,
								true
							);
						}
					}

					const saveId = uuid();

					this.nodeSystem.saveManager.saveToLocalStorage(json, name, saveId, false, false, true);

					this.nodeSystem.eventHandler.addEventListeners();
					// load
					this.nodeSystem.reset();
					this.nodeSystem.saveManager.loadSaveFile(json, name, saveId, false, false);
				};
				reader.readAsText(file);
			}
		};
		openDialog.click();
	}

	getDependencyNames(save: NodeSaveFile) {
		let dependencies: {
			[saveId: string]: string;
		} = {};
		for (const node of save.nodes) {
			if (node.type == 'CombinationNode') {
				let saveId = '';
				let name = '';
				for (const param in node.parameters) {
					if (node.parameters[param].name == 'saveId') {
						saveId = node.parameters[param].value as string;
					}
					if (node.parameters[param].name == 'nodeName') {
						name = node.parameters[param].value as string;
					}
				}
				if (saveId) {
					dependencies[saveId] = name;
				}
			}
		}
		for (const dependency of Object.values(save.dependencies)) {
			dependencies = { ...dependencies, ...this.getDependencyNames(dependency) };
		}
		return dependencies;
	}
}
