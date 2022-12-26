import type { NodeSaveFile } from '../NodeSaveFile';
import { uuid } from '../utils';
import { Command } from './Command';

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
				reader.onload = () => {
					const json = JSON.parse(reader.result as string) as NodeSaveFile;
					// ask for name
					const name = prompt('Please enter a name for the import.', 'Untitled');

					const dependencies = this.getDependencyNames(json);
					console.log(dependencies);
					for (const [dependencyId, name] of Object.entries(dependencies)) {
						if (this.nodeSystem.saveManager.getSaveFile(dependencyId, false, true)) {
							// ask if it should be overwritten
							if (!confirm('A custom node with the name "' + name + '" already exists. Do you want to overwrite it?')) {
								continue;
							}
							this.nodeSystem.saveManager.deleteSaveFile(dependencyId, false, true);
						}

						this.nodeSystem.saveManager.saveToLocalStorage(json.dependencies[dependencyId], name, dependencyId, false, true, true);
					}

					const saveId = uuid();

					this.nodeSystem.saveManager.saveToLocalStorage(json, name, saveId, false, false, true);

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
