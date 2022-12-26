import { Command } from './Command';
import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import type { SaveMetadata } from '../SaveManager';
import { logicNotations } from './CreateBooleanExpressionCommand';

export class SettingsCommand extends Command {
	async execute() {
		// show setting popup
		const popup = new FullscreenPrompt();
		this.nodeSystem.eventHandler.cleanup();
		try {
			const parameters = await popup.requestParameters('Settings', [
				{
					name: 'colorConnectionLines',
					label: 'Change connection line color based on value.',
					checked: this.nodeSystem.config.colorConnectionLines,
					type: 'checkbox'
				},
				{
					name: 'connectionRenderMode',
					label: "Connection line render mode, possible values: 'square', 'bezier' (default).",
					value: this.nodeSystem.config.connectionRenderMode,
					type: 'text',
					pattern: 'square|bezier'
				},
				{
					name: 'localStorage.wolframAppId',
					label: 'Wolfram Alpha App ID (for boolean expression simplification)',
					value: this.nodeSystem.config.private.wolframAppId,
					type: 'text'
				},
				{
					name: 'localStorage.wolframAlphaEnabled',
					label: 'Wolfram Alpha Enabled (requires App ID)',
					checked: this.nodeSystem.config.private.wolframAlphaEnabled,
					type: 'checkbox'
				},
				{
					name: 'localStorage.wolframAlphaCorsProxy',
					label: 'Wolfram Alpha CORS Proxy (for boolean expression simplification)',
					value: this.nodeSystem.config.private.wolframAlphaCorsProxy,
					type: 'text'
				},
				{
					name: 'localStorage.logicNotation',
					label: 'Logic notation',
					value: this.nodeSystem.config.private.logicNotation,
					type: 'select',
					options: [
						...logicNotations.map((notation, index) => ({
							label: [notation.and, notation.or, notation.not, notation.xor].join(''),
							value: index
						}))
					]
				},
				{
					name: 'localStorage.useXORSymbol',
					label: 'Use XOR symbol instead of combining other symbols',
					checked: this.nodeSystem.config.private.useXORSymbol,
					type: 'checkbox'
				},
				this.nodeSystem.saveId != 'unsaved' && {
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
			if (parameters == null) {
				return;
			}
			parameters.forEach((param) => {
				if (Object.keys(param).length == 0) {
					return;
				}
				if (param.name.startsWith('localStorage.')) {
					const key = param.name.split('.')[1];
					if (param.type == 'checkbox') {
						window.localStorage.setItem(key, param.checked ? 'true' : 'false');
					} else {
						window.localStorage.setItem(key, param.value as string);
					}
					return;
				}
				this.nodeSystem.config[param.name] = param.type == 'checkbox' ? param.checked : param.value;
			});
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
			this.nodeSystem.nodeRenderer.requestRender();
		}
	}
}
