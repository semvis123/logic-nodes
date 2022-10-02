import { Command } from "./Command";
import { FullscreenPrompt } from "../fullscreenPrompt/FullscreenPrompt";
import type { SaveMetadata } from "../SaveManager";

export class SettingsCommand extends Command {


    async execute() {
        // show setting popup
        const popup = new FullscreenPrompt();
        this.nodeSystem.eventHandler.removeEventListeners();
        try {
            const parameters = await popup.requestParameters('Settings', [
                {
                    name: 'colorConnectionLines',
                    label: 'Change connection line color based on value.',
                    checked: this.nodeSystem.config.colorConnectionLines,
                    type: 'checkbox'
                },
                this.nodeSystem.saveId != -1 && {
                    name: 'delete',
                    type: 'button',
                    label: 'Current savefile',
                    value: 'Delete',
                    onclick: () => {
                        const saves: SaveMetadata[] = JSON.parse(window.localStorage.getItem('saves')) ?? [];
                        const newSaves = saves.filter(
                            (value) => !(value.id == this.nodeSystem.saveId && this.nodeSystem.isCustomNode == value.isCustomNode)
                        );
                        window.localStorage.setItem('saves', JSON.stringify(newSaves));
                        const prefix = this.nodeSystem.isCustomNode ? 'node_' : '';
                        window.localStorage.removeItem('save_' + prefix + this.nodeSystem.saveId);
                        window.localStorage.removeItem('autosave_' + prefix + this.nodeSystem.saveId);
                        this.nodeSystem.reset();
                    }
                }
            ]);
            parameters.forEach((param) => {
                this.nodeSystem.config[param.name] = param.type == 'checkbox' ? param.checked : param.value;
            });
        } finally {
            this.nodeSystem.eventHandler.addEventListeners();
        }
    }
}