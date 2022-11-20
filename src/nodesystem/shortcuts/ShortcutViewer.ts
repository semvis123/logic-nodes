import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import type { Shortcut, ShortcutManager } from './ShortcutManager';
import './shortcutViewer.css';

export class ShortcutViewer extends FullscreenPrompt {
	constructor() {
		super();
	}

	async show(shortcutManager: ShortcutManager) {
		const result = new Promise<void>((resolve, reject) => {
			this.addCloseListeners(false);
			this.rejectPromise = reject;
			this.resolvePromise = resolve;
			const titleEl = document.createElement('h1');
			titleEl.innerText = 'Shortcuts';

			const cancelBtn = document.createElement('input');
			cancelBtn.type = 'button';
			cancelBtn.value = 'x';
			cancelBtn.className = 'cancelbtn';
			cancelBtn.onclick = () => {
				this.close(true);
				resolve();
			};
			this.popupElement.appendChild(titleEl);
			const shortcutContainer = document.createElement('div');
			shortcutContainer.className = 'shortcut-container';
			const shortcuts = shortcutManager.getShortcuts();
			const shortcutCategories = new Set(shortcuts.map((s) => s.category));
			shortcutCategories.forEach((category) => {
				const categoryEl = document.createElement('div');
				categoryEl.className = 'shortcut-category';
				const categoryTitleEl = document.createElement('h2');
				categoryTitleEl.innerText = category;
				categoryEl.appendChild(categoryTitleEl);
				const categoryShortcuts = shortcuts.filter((s) => s.category == category);
				const categoryShortcutsEl = document.createElement('div');
				categoryShortcuts.forEach((shortcut) => {
					const shortcutEl = this.shortcutToDiv(shortcut);
					categoryShortcutsEl.appendChild(shortcutEl);
				});
				categoryEl.appendChild(categoryShortcutsEl);
				shortcutContainer.appendChild(categoryEl);
			});
			this.popupElement.appendChild(shortcutContainer);
			this.popupElement.appendChild(cancelBtn);
			this.popupElement.classList.add('shortcut-popup');
		});
		this.promise = result;
		return result;
	}

	shortcutToDiv(shortcut: Shortcut) {
		const shortcutEl = document.createElement('div');
		shortcutEl.className = 'shortcut';
		const shortcutName = document.createElement('p');
		shortcutName.innerText = shortcut.name;
		shortcutEl.appendChild(shortcutName);
		const shortcutKeys = document.createElement('p');

		const separatorMap = { '|': ' or ', '+': ' + ' };
		const separators = Object.keys(separatorMap);

		for (let i = 0; i < shortcut.keyCombo.length; i++) {
			if (separators.includes(shortcut.keyCombo[i])) {
				const separator = document.createTextNode(separatorMap[shortcut.keyCombo[i]]);
				shortcutKeys.appendChild(separator);
				continue;
			}
			let key = shortcut.keyCombo[i];
			const keyEl = document.createElement('kbd');
			while (i < shortcut.keyCombo.length - 1 && !separators.includes(shortcut.keyCombo[i + 1])) {
				i++;
				key += shortcut.keyCombo[i];
			}
			keyEl.innerText = key;
			shortcutKeys.appendChild(keyEl);
		}
		shortcutEl.appendChild(shortcutKeys);
		shortcutEl.title = shortcut.description;
		return shortcutEl;
	}
}
