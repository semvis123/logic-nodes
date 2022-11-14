import type { NodeSystemEventHandler } from '../handlers/NodeSystemEventHandler';
import { createDivTable } from '../utils';
import { FloatingModal } from './FloatingModal';

export class TableFloatingModal extends FloatingModal {
	constructor(titleText: string, private table: Map<string, number>[], eventHandler: NodeSystemEventHandler) {
		const content = document.createElement('div');
		const title = document.createElement('p');
		title.className = 'floating-modal-title';
		title.textContent = titleText;
		content.appendChild(title);
		if (table) {
			const tableEl = createDivTable(table);
			content.appendChild(tableEl);
		}
		super(content, eventHandler);
	}

	copyableContent(): string {
		let out = '';
		for (const header of this.table[0].keys()) {
			out += header + '\t';
		}
		out += '\n';
		for (const row of this.table) {
			for (const value of row.values()) {
				out += value + '\t';
			}
			out += '\n';
		}
		return out;
	}
}
