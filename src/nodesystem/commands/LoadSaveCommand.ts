import { Command } from "./Command";
import type { Folder } from "../fullscreenPrompt/Folder";
import { FullscreenPrompt } from "../fullscreenPrompt/FullscreenPrompt";
import type { NodeSaveFile } from "../NodeSaveFile";
import type { SaveMetadata } from "../SaveManager";

export class LoadSaveCommand extends Command {


    async execute() {
        // show save file dialog
        const saves: SaveMetadata[] = this.nodeSystem.saveManager.getSaves();
        const normalSaves: SaveMetadata[] = [];
        const customNodes: SaveMetadata[] = [];
        const autosavedCustomNodes: SaveMetadata[] = [];
        const autosaves: SaveMetadata[] = [];

        saves.forEach((save) => {
            if (!save.isAutosave && !save.isCustomNode) {
                normalSaves.push(save);
            } else if (!save.isAutosave && save.isCustomNode) {
                customNodes.push(save);
            } else if (save.isAutosave && save.isCustomNode) {
                autosavedCustomNodes.push(save);
            } else if (save.isAutosave) {
                autosaves.push(save);
            }
        });

        const saveFolder: Folder = {
            name: 'Saves',
            files: normalSaves,
            directories: [
                {
                    name: 'Autosaves',
                    files: autosaves,
                    directories: []
                },
                {
                    name: 'Custom nodes',
                    files: customNodes,
                    directories: [
                        {
                            name: 'Autosaves',
                            files: autosavedCustomNodes,
                            directories: []
                        }
                    ]
                }
            ]
        };

        this.nodeSystem.eventHandler.removeEventListeners();
        try {
            const saveMetaData = await new FullscreenPrompt().requestSelectionFromFolder(saveFolder);
            console.log(saveMetaData);
            const save: NodeSaveFile = JSON.parse(
                this.nodeSystem.saveManager.getSaveFile(saveMetaData.id, saveMetaData.isAutosave, saveMetaData.isCustomNode)
            );
            this.nodeSystem.reset();
            this.nodeSystem.saveManager.loadSaveFile(
                save,
                saveMetaData.filename,
                saveMetaData.id,
                false,
                saveMetaData.isCustomNode
            );
            this.nodeSystem.nodeRenderer.requestRender();
        } finally {
            this.nodeSystem.eventHandler.addEventListeners();
        }
    }
}