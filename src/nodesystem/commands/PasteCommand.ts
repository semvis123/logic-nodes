import { ToastMessage } from "../toastMessage/ToastMessage";
import { Command } from "./Command";

export class PasteCommand extends Command {

    async execute() {
		try {
			const data = JSON.parse(await navigator.clipboard.readText());
			this.nodeSystem.importNodes(data, true);
		} catch (e) {
			console.log('invalid data');
			console.log(e);
			new ToastMessage('Unable to paste nodes', 'danger').show();
		}
    }
}