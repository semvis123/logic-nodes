import type { NodeSaveFile } from './NodeSaveFile';
import type { NodeSystem } from './NodeSystem';
import { ToastMessage } from './toastMessage/ToastMessage';

export type SaveMetadata = { id: number; filename: string; isAutosave?: boolean; lastUpdated?: string };

export class SaveManager {
	constructor(public nodeSystem: NodeSystem) {}

	createSaveFile() {
		const save: NodeSaveFile = {
			...this.nodeSystem.exportNodes(this.nodeSystem.nodeStorage.nodes),
			config: this.nodeSystem.config.toObject()
		};

		return save;
	}

	loadSaveFile(save: NodeSaveFile, filename: string, saveId: number, silent = false) {
		try {
			this.nodeSystem.importNodes(save);
		} catch (e) {
			new ToastMessage('Failed to load save', 'danger').show();
			console.error(e);
			this.nodeSystem.reset();
			return;
		}
		this.nodeSystem.nodeRenderer.render();
		this.nodeSystem.filename = filename;
		this.nodeSystem.saveId = saveId;
		this.nodeSystem.displayFileInfo();
		if (!silent) {
			new ToastMessage('Loaded save: ' + filename).show();
			this.nodeSystem.history = [save];
			this.nodeSystem.historyLevel = 0;
		}

		this.nodeSystem.config.setConfig(save.config);
	}

	getSaves(includeNonModifiedAutosaves = false): SaveMetadata[] {
		const saves: SaveMetadata[] = JSON.parse(window.localStorage.getItem('saves')) ?? [];
		const filteredSaves = [];
		for (const save of saves) {
			if (save.isAutosave && !includeNonModifiedAutosaves) {
				const autosave = this.getSaveFile(save.id, true);

				if (!autosave || this.getSaveFile(save.id, false) == autosave) {
					continue;
				}
			}
			filteredSaves.push(save);
		}

		return filteredSaves;
	}

	getSaveFile(saveId: number, autosave = false) {
		const prefix = autosave ? 'autosave_' : 'save_';
		return window.localStorage.getItem(prefix + saveId);
	}

	saveToLocalStorage(saveData: NodeSaveFile, filename: string, id: number, isAutosave = false) {
		let saves: SaveMetadata[] = this.getSaves();
		saves = saves.filter((save) => !(id == save.id && save.isAutosave == isAutosave));
		const lastUpdated = new Date().toJSON();
		saves.push({ id, filename, isAutosave, lastUpdated });

		const lastSaveId = Math.max(this.lastSaveId(), id);
		window.localStorage.setItem('lastSaveId', lastSaveId.toString());
		const prefix = isAutosave ? 'autosave_' : 'save_';
		window.localStorage.setItem(prefix + id, JSON.stringify(saveData));
		window.localStorage.setItem('saves', JSON.stringify(saves));
	}

	lastSaveId() {
		return parseInt(window.localStorage.getItem('lastSaveId') ?? '0');
	}
}
