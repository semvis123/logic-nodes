import { Command } from "./Command";
import { SaveAsCommand } from "./SaveAsCommand";

export class SaveCommand extends Command {

    execute() {
        if (this.nodeSystem.saveId == -1) return new SaveAsCommand(this.nodeSystem).execute();
        // save to localStorage
        const save = this.nodeSystem.saveManager.createSaveFile();
        this.nodeSystem.saveManager.saveToLocalStorage(
            save,
            this.nodeSystem.filename,
            this.nodeSystem.saveId,
            false,
            this.nodeSystem.isCustomNode
        );

    }
}