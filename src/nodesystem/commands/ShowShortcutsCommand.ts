import { ShortcutViewer } from '../shortcuts/ShortcutViewer';
import { Command } from './Command';

export class ShowShortcutsCommand extends Command {
	async execute() {
		this.nodeSystem.eventHandler.cleanup();
		try {
			await new ShortcutViewer().show(this.nodeSystem.shortcutManager);
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}
}
