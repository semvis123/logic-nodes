import { Command } from './Command';
import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import { ToastMessage } from '../toastMessage/ToastMessage';

export class CreateNodeCommand extends Command {
	async execute() {
		let possible = false;
		// check if possible
		this.nodeSystem.nodeStorage.nodes.forEach((node) => {
			if (node.getMetadata().nodeName == 'OutputNode') {
				possible = true;
			}
		});

		if (!possible) return new ToastMessage('Creating a node requires at least one OutputNode.', 'danger').show();

		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.cleanup();
		try {
			const params = await popup.requestParameters('New Node', [
				{
					name: 'name',
					label: 'Name',
					value: '',
					type: 'text'
				}
			]);
			if (params == null) return;
			
			const name = params[0].value as string;
			const save = this.nodeSystem.saveManager.createSaveFile();
			if (this.nodeSystem.saveId == -1) {
				this.nodeSystem.saveId = this.nodeSystem.saveManager.lastSaveId() + 1;
			}
			this.nodeSystem.saveManager.saveToLocalStorage(save, name, this.nodeSystem.saveId, false, true);
			new ToastMessage('Created node: ' + name, 'info').show();
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}
}
