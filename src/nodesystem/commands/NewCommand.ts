import { Command } from "./Command";

export class NewCommand extends Command {
    execute() {
        this.nodeSystem.reset();
        this.nodeSystem.nodeRenderer.requestRender();
        this.nodeSystem.filename = 'Untitled';
    }
}