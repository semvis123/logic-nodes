import { Command } from "../commands/Command";
import type { NodeSystem } from "../NodeSystem";
import { getShortcuts } from "./shortcuts";

export type Shortcut = {
    name: string;
    keyCombo: string;
    description: string;
    callback: Callback;
    category: string;
}

type Callable = Command | (() => void);
type Callback = Callable | Callback[];


export class ShortcutManager {
	shortcuts: Shortcut[] = [];
	
    constructor(nodeSystem: NodeSystem) {
		this.shortcuts = getShortcuts(nodeSystem);
    }
	
    addShortcut(shortcut: Shortcut) {
		this.shortcuts.push(shortcut);
    }
	
    removeShortcut(shortcut: Shortcut) {
		this.shortcuts = this.shortcuts.filter((s) => s !== shortcut);
    }
	
	getShortcuts() {
		return this.shortcuts;
	}

    executeShortcut(e: KeyboardEvent) {
        for (const { keyCombo: keyComboList, callback} of this.shortcuts) {
			if (!(keyComboList?.length > 0)) continue;

			for (const keyCombo of keyComboList.split('|')) {
				const keyComboItems = keyCombo.split('+');
				let isCorrect = true;
				for (const keyComboItem of keyComboItems) {
					const possibleKeys = keyComboItem.split('/');
					let isPressed = false;
					for (const key of possibleKeys) {
						switch (key) {
							case 'ctrl': {
								isPressed ||= e.ctrlKey;
								break;
							}
							case 'cmd': {
								isPressed ||= e.metaKey;
								break;
							}
							case 'shift': {
								isPressed ||= e.shiftKey;
								break;
							}
							case 'alt': {
								isPressed ||= e.altKey;
								break;
							}
							case 'plus':
								isPressed ||= e.key == '+';
								break;
							case 'forward-slash':
								isPressed ||= e.key == '/';
								break;
							default:
								isPressed ||= e.key.toUpperCase() == key.toUpperCase();
						}
					}
					isCorrect &&= isPressed;
					if (!isPressed) break;
				}
				if (isCorrect) {
					this.executeCallback(callback);
					e.preventDefault();
					return;
				}
			}
		}
    }

    private executeCallback(callback: Callback) {
        if (callback instanceof Command) {
            callback.execute();
        } else if (callback instanceof Array) {
            callback.forEach((c) => {
                this.executeCallback(c);
            });
        } else {
            callback();
        }
    }
}