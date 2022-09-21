import type { NodeSaveFile } from './NodeSaveFile';
import type { NodeSystem } from './NodeSystem';
import { ToastMessage } from './toastMessage/ToastMessage';

export type SaveMetadata = {
	id: number;
	filename: string;
	isAutosave?: boolean;
	isCustomNode?: boolean;
	lastUpdated?: string;
};

export class SaveManager {
	constructor(public nodeSystem: NodeSystem) {}

	createSaveFile() {
		const save: NodeSaveFile = {
			...this.nodeSystem.exportNodes(this.nodeSystem.nodeStorage.nodes),
			config: this.nodeSystem.config.toObject()
		};

		return save;
	}

	loadSaveFile(save: NodeSaveFile, filename: string, saveId: number, silent = false, isCustomNode = false) {
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
		this.nodeSystem.isCustomNode = isCustomNode;
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
				const autosave = this.getSaveFile(save.id, true, save.isCustomNode);

				if (!autosave || this.getSaveFile(save.id, false, save.isCustomNode) == autosave) {
					continue;
				}
			}
			filteredSaves.push(save);
		}
		return filteredSaves;
	}

	getCustomNodes() {
		return this.getSaves().filter((node) => node.isCustomNode);
	}

	getSaveFile(saveId: number, autosave = false, customNode = false) {
		const prefix = (autosave ? 'autosave_' : 'save_') + (customNode ? 'node_' : '');
		return window.localStorage.getItem(prefix + saveId);
	}

	saveToLocalStorage(saveData: NodeSaveFile, filename: string, id: number, isAutosave = false, isCustomNode = false) {
		let saves: SaveMetadata[] = this.getSaves();
		saves = saves.filter(
			(save) => !(id == save.id && save.isAutosave == isAutosave && save.isCustomNode == isCustomNode)
		);
		const lastUpdated = new Date().toJSON();
		saves.push({ id, filename, isAutosave, lastUpdated, isCustomNode });

		const lastSaveId = Math.max(this.lastSaveId(), id);
		window.localStorage.setItem('lastSaveId', lastSaveId.toString());
		const prefix = (isAutosave ? 'autosave_' : 'save_') + (isCustomNode ? 'node_' : '');
		window.localStorage.setItem(prefix + id, JSON.stringify(saveData));
		window.localStorage.setItem('saves', JSON.stringify(saves));
	}

	lastSaveId() {
		return parseInt(window.localStorage.getItem('lastSaveId') ?? '0');
	}
}
