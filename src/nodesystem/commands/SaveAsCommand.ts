import { Command } from './Command';
import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';

export class SaveAsCommand extends Command {
	async execute() {
		// save to localStorage
		const save = this.nodeSystem.saveManager.createSaveFile();
		const newSaveId: number = this.nodeSystem.saveManager.lastSaveId() + 1;

		const dialog = new FullscreenPrompt();

		this.nodeSystem.eventHandler.cleanup();
		try {
			const params = await dialog.requestParameters('Save', [
				{
					name: 'filename',
					label: 'Filename',
					value: 'save ' + newSaveId,
					type: 'text',
					required: true
				}
			]);
			if (params == null) return;

			const filename = params[0].value as string;
			this.nodeSystem.saveManager.saveToLocalStorage(save, filename, newSaveId);
			this.nodeSystem.saveId = newSaveId;
			this.nodeSystem.filename = filename;
			this.nodeSystem.displayFileInfo();
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}
}
