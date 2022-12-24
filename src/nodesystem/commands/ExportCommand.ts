import { Command } from './Command';

export class ExportCommand extends Command {
	execute() {
		// download save
		const save = this.nodeSystem.saveManager.createSaveFile(true);
		const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'save.json';
		a.click();
	}
}
