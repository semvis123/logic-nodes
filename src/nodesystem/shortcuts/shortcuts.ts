import { ConstructCircuitFromExpressionCommand } from '../commands/ConstructCircuitFromExpressionCommand';
import { CopyCommand } from '../commands/CopyCommand';
import { DeleteCommand } from '../commands/DeleteCommand';
import { ImportCommand } from '../commands/ImportCommand';
import { NewCommand } from '../commands/NewCommand';
import { SaveAsCommand } from '../commands/SaveAsCommand';
import { SaveCommand } from '../commands/SaveCommand';
import { SelectAllCommand } from '../commands/SelectAllCommand';
import { SettingsCommand } from '../commands/SettingsCommand';
import type { NodeSystem } from '../NodeSystem';
import type { Shortcut } from './ShortcutManager';
import { ExportCommand } from '../commands/ExportCommand';
import { LoadSaveCommand } from '../commands/LoadSaveCommand';
import { ShowShortcutsCommand } from '../commands/ShowShortcutsCommand';
import { DeselectAllCommand } from '../commands/DeselectAllCommand';
import { ToastMessage } from '../toastMessage/ToastMessage';

export const getShortcuts: (nodeSystem: NodeSystem) => Shortcut[] = (nodeSystem: NodeSystem) => [
	{
		name: 'Undo',
		description: 'Undo the last action',
		keyCombo: 'ctrl/cmd+z',
		callback: nodeSystem.undo.bind(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'Redo',
		description: 'Redo the last action',
		keyCombo: 'ctrl/cmd+y|ctrl/cmd+shift+z',
		callback: nodeSystem.redo.bind(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'Cut',
		description: 'Cut selected nodes to clipboard',
		keyCombo: 'ctrl/cmd+x',
		callback: [new CopyCommand(nodeSystem), new DeleteCommand(nodeSystem)],
		category: 'Editor'
	},
	{
		name: 'Delete selected nodes',
		description: 'Delete all selected nodes in the circuit',
		keyCombo: 'Delete/Backspace',
		callback: new DeleteCommand(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'Select all',
		description: 'Select all nodes in the circuit',
		keyCombo: 'ctrl/cmd+a',
		callback: new SelectAllCommand(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'Deselect all',
		description: 'Deselect all nodes in the circuit',
		keyCombo: 'escape',
		callback: new DeselectAllCommand(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'New circuit',
		description: 'Create a new circuit',
		keyCombo: 'ctrl/cmd+n',
		callback: new NewCommand(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'Save',
		description: 'Save the current circuit',
		keyCombo: 'ctrl/cmd+s',
		callback: new SaveCommand(nodeSystem),
		category: 'File'
	},
	{
		name: 'Save as',
		description: 'Save the current circuit as a new file',
		keyCombo: 'ctrl/cmd+shift+s',
		callback: new SaveAsCommand(nodeSystem),
		category: 'File'
	},
	{
		name: 'Load save',
		description: 'Load a save file',
		keyCombo: 'ctrl/cmd+o',
		callback: new LoadSaveCommand(nodeSystem),
		category: 'File'
	},
	{
		name: 'Import',
		description: 'Import a circuit from a file',
		keyCombo: 'ctrl/cmd+shift+o',
		callback: new ImportCommand(nodeSystem),
		category: 'File'
	},
	{
		name: 'Export',
		description: 'Export the current circuit to a file',
		keyCombo: 'ctrl/cmd+shift+e',
		callback: new ExportCommand(nodeSystem),
		category: 'File'
	},
	{
		name: 'Settings',
		description: 'Open the settings menu',
		keyCombo: 'ctrl/cmd+,',
		callback: new SettingsCommand(nodeSystem),
		category: 'Editor'
	},
	{
		name: 'Zoom in',
		description: 'Zoom in a factor of 2',
		keyCombo: 'ctrl/cmd+=',
		callback: () => {
			nodeSystem.nodeRenderer.setZoom(nodeSystem.editorState.view.zoom * 2);
		},
		category: 'View'
	},
	{
		name: 'Zoom out',
		description: 'Zoom out a factor of 2',
		keyCombo: 'ctrl/cmd+-',
		callback: () => {
			nodeSystem.nodeRenderer.setZoom(nodeSystem.editorState.view.zoom / 2);
		},
		category: 'View'
	},
	{
		name: 'Zoom to fit',
		description: 'Zoom to fit the circuit in the viewport',
		keyCombo: 'ctrl/cmd+9',
		callback: nodeSystem.nodeRenderer.zoomToFit.bind(nodeSystem.nodeRenderer),
		category: 'View'
	},
	{
		name: 'Zoom to 100%',
		description: 'Zoom to 100%',
		keyCombo: 'ctrl/cmd+0',
		callback: () => {
			nodeSystem.nodeRenderer.setZoom(1);
		},
		category: 'View'
	},
	{
		name: 'Show/Hide minimap',
		description: 'Show or hide the minimap',
		keyCombo: 'ctrl/cmd+m',
		callback: () => {
			if (nodeSystem.minimap.visible) {
				nodeSystem.minimap.remove();
			} else {
				nodeSystem.minimap.show();
			}
			nodeSystem.nodeRenderer?.requestRender();
		},
		category: 'View'
	},
	{
		name: 'Circuit from expression',
		description: 'Create a circuit from an expression',
		keyCombo: 'ctrl/cmd+e',
		callback: new ConstructCircuitFromExpressionCommand(nodeSystem),
		category: 'Editor'
	},
	...Array.from({ length: 9 }, (_, i) => ({
		name: `Set layer to ${i + 1}`,
		description: `Set the layer to ${i + 1}`,
		keyCombo: `${i + 1}`,
		callback: () => {
			if (nodeSystem.editorState.layer !== i) {
				nodeSystem.nodeRenderer.setLayer(i);
				new ToastMessage(`Set layer to ${i + 1}`, 'info', 1000).show();
			}
		},
		category: 'Layers'
	})),
	{
		name: 'Show shortcuts',
		description: 'Show all shortcuts',
		keyCombo: 'ctrl/cmd+forward-slash',
		callback: () => {
			new ShowShortcutsCommand(nodeSystem).execute();
		},
		category: 'Editor'
	}
];
