import { ToastMessage } from '../toastMessage/ToastMessage';
import { Command } from './Command';
import type { NodeSaveFile } from '../NodeSaveFile';
import type { NodeSystem } from '../NodeSystem';

export class PasteCommand extends Command {
	constructor(nodeSystem: NodeSystem, private event: ClipboardEvent = null) {
		super(nodeSystem);
	}

	async execute() {
		try {
			let data: NodeSaveFile;
			if (this.event == null) {
				data = JSON.parse(await navigator.clipboard.readText());
			} else {
				data = JSON.parse(this.event.clipboardData.getData('text'));
			}
			this.nodeSystem.importNodes(data, true, true);
		} catch (e) {
			console.log('invalid data');
			console.log(e);
			new ToastMessage('Unable to paste nodes', 'danger').show();
		}
	}
}
