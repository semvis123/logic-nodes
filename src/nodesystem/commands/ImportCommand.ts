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
					const json = JSON.parse(reader.result as string);
					this.nodeSystem.reset();
					this.nodeSystem.saveManager.loadSaveFile(json, 'Unsaved import', -1);
				};
				reader.readAsText(file);
			}
		};
		openDialog.click();
	}
}
