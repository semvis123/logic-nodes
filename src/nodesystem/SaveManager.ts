import type { NodeSaveFile } from './NodeSaveFile';
import type { NodeSystem } from './NodeSystem';
import { ToastMessage } from './toastMessage/ToastMessage';

export type SaveMetadata = {
	id: string;
	filename: string;
	isAutosave?: boolean;
	isCustomNode?: boolean;
	isImported?: boolean;
	lastUpdated?: string;
};

export class SaveManager {
	constructor(public nodeSystem: NodeSystem) {}

	createSaveFile(dependencies = false) {
		const save: NodeSaveFile = {
			...this.nodeSystem.exportNodes(this.nodeSystem.nodeStorage.nodes),
			config: this.nodeSystem.config.toObject()
		};

		if (dependencies) {
			for (const node of this.nodeSystem.nodeStorage.nodes) {
				if (node.getMetadata().nodeName == 'CombinationNode') {
					save.dependencies = save.dependencies ?? {};
					save.dependencies[node.getParamValue('saveId', 'unsaved')] = this.getCustomNodeSaveFileWithDependencies(
						node.getParamValue('saveId', 'undefined')
					);
				}
			}

			for (const [id, dependency] of Object.entries(save.dependencies ?? {})) {
				save.dependencies[id] = this.bubbleDependencies(dependency);
				for (const [id2, dependency2] of Object.entries(save.dependencies[id].dependencies ?? {})) {
					save.dependencies[id2] = dependency2;
				}
				save.dependencies[id].dependencies = {};
			}
		}

		return save;
	}

	loadSaveFile(save: NodeSaveFile, filename: string, saveId: string, silent = false, isCustomNode = false) {
		this.nodeSystem.dependencies = save.dependencies ?? {};
		try {
			this.nodeSystem.importNodes(save);
		} catch (e) {
			new ToastMessage('Failed to load save', 'danger').show();
			console.error(e);
			this.nodeSystem.reset();
			return;
		}
		this.nodeSystem.nodeRenderer.requestRender();
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

	getSaveFile(saveId: string, autosave = false, customNode = false) {
		const prefix = (autosave ? 'autosave_' : 'save_') + (customNode ? 'node_' : '');
		return window.localStorage.getItem(prefix + saveId);
	}

	getCustomNodeSaveFileWithDependencies(saveId: string) {
		const prefix = 'save_node_';

		// check dependencies first
		if (this.nodeSystem.dependencies[saveId]) {
			return { ...this.nodeSystem.dependencies[saveId], dependencies: this.nodeSystem.dependencies };
		}

		const json = JSON.parse(window.localStorage.getItem(prefix + saveId)) as NodeSaveFile;
		if (!json) {
			throw new Error('Could not find custom node with id ' + saveId);
		}
		const dependencies = json.dependencies ?? {};

		for (const node of json.nodes) {
			if (node.type == 'CombinationNode') {
				for (const param of node.parameters) {
					if (param.name == 'saveId') {
						dependencies[param.value] = this.getCustomNodeSaveFileWithDependencies(param.value as string);
					}
				}
			}
		}

		for (const dependency of Object.values(json.dependencies ?? {})) {
			for (const [innerDependencyId, innerDependency] of Object.entries(dependency.dependencies ?? {})) {
				json.dependencies[innerDependencyId] = innerDependency;
				innerDependency.dependencies = {};
			}
		}

		json.dependencies = dependencies;

		return json;
	}

	bubbleDependencies(saveFile: NodeSaveFile): NodeSaveFile {
		const dependencies = saveFile.dependencies ?? {};
		for (const [id, dependency] of Object.entries(dependencies)) {
			const save = this.bubbleDependencies(dependency);
			dependencies[id] = save;
			for (const [innerDependencyId, innerDependency] of Object.entries(save.dependencies ?? {})) {
				dependencies[innerDependencyId] = innerDependency;
			}
			save.dependencies = {};
		}
		saveFile.dependencies = dependencies;
		return saveFile;
	}

	saveToLocalStorage(saveData: NodeSaveFile, filename: string, id: string, isAutosave = false, isCustomNode = false, isImported=false) {
		let saves: SaveMetadata[] = this.getSaves();
		saves = saves.filter(
			(save) => !(id == save.id && save.isAutosave == isAutosave && save.isCustomNode == isCustomNode && save.isImported == isImported)
		);
		const lastUpdated = new Date().toJSON();
		saves.push({ id, filename, isAutosave, lastUpdated, isCustomNode });

		const prefix = (isAutosave ? 'autosave_' : 'save_') + (isCustomNode ? 'node_' : '');
		window.localStorage.setItem(prefix + id, JSON.stringify(saveData));
		window.localStorage.setItem('saves', JSON.stringify(saves));
	}

	getSaveMetadata(id: string, isAutosave = false, isCustomNode = false) {
		const saves: SaveMetadata[] = this.getSaves();
		return saves.find((save) => save.id == id && save.isAutosave == isAutosave && save.isCustomNode == isCustomNode);
	}

	deleteSaveFile(id: string, isAutosave = false, isCustomNode = false) {
		let saves: SaveMetadata[] = this.getSaves();
		saves = saves.filter(
			(save) => !(id == save.id && save.isAutosave == isAutosave && save.isCustomNode == isCustomNode)
		);
		window.localStorage.setItem('saves', JSON.stringify(saves));
		const prefix = (isAutosave ? 'autosave_' : 'save_') + (isCustomNode ? 'node_' : '');
		window.localStorage.removeItem(prefix + id);
	}
}
