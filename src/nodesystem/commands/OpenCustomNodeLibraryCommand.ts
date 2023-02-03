import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import CustomNodeLibrary from '../customNodeLibrary/CustomNodeLibrary';

export class OpenCustomNodeLibraryCommand extends Command {
	constructor(nodeSystem: NodeSystem) {
		super(nodeSystem);
	}
	async execute() {
        this.nodeSystem.eventHandler.removeEventListeners();

        const nodeLibrary = new CustomNodeLibrary(this.nodeSystem);
        await nodeLibrary.open();

        this.nodeSystem.eventHandler.addEventListeners();
	}
}
