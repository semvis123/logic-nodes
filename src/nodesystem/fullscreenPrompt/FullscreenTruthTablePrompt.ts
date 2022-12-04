import { indexToInputName } from '../utils';
import { FullscreenPrompt } from './FullscreenPrompt';

export class FullscreenTruthTablePrompt extends FullscreenPrompt {
	truthTable: HTMLTableElement = null;

	constructor() {
		super();
	}

	async requestTruthTable(inputs: number): Promise<number[][]> {
		const result = new Promise<number[][]>((resolve, reject) => {
			this.addCloseListeners();
			this.rejectPromise = reject;
			this.resolvePromise = resolve;
			const titleEl = document.createElement('h1');
			titleEl.innerText = 'Enter Truth Table';
			this.popupElement.appendChild(titleEl);

			this.createTruthTable(inputs);

			const cancelBtn = document.createElement('input');
			cancelBtn.type = 'button';
			cancelBtn.value = 'x';
			cancelBtn.className = 'cancelbtn';
			cancelBtn.onclick = () => {
				this.close(true, null);
			};

			this.popupElement.appendChild(cancelBtn);

			const okBtn = document.createElement('input');
			okBtn.type = 'button';
			okBtn.value = 'Save';
			okBtn.className = 'okbtn';
			okBtn.onclick = () => {
				this.close(true, this.getTruthTable());
			};

			this.popupElement.appendChild(okBtn);
		});

		this.promise = result;
		return result;
	}

	createTruthTable(inputs: number): void {
		this.truthTable = document.createElement('table');
		const headerRow = document.createElement('tr');
		for (let i = 0; i < inputs; i++) {
			const header = document.createElement('th');
			header.innerText = indexToInputName(i);
			headerRow.appendChild(header);
		}
		const outputHeader = document.createElement('th');
		outputHeader.innerText = 'Output';
		headerRow.appendChild(outputHeader);
		this.truthTable.appendChild(headerRow);

		// content
		for (let i = 0; i < 2 ** inputs; i++) {
			const row = document.createElement('tr');
			for (let j = 0; j < inputs; j++) {
				const td = document.createElement('td');
				const value = Math.min(i & (1 << j), 1);
				td.innerText = value.toString();
				td.classList.add('td-value-' + value);
				row.appendChild(td);
			}
			const outputCell = document.createElement('td');
			const output = document.createElement('input');
			output.type = 'checkbox';
			outputCell.appendChild(output);
			row.appendChild(outputCell);
			this.truthTable.appendChild(row);
		}

		this.popupElement.appendChild(this.truthTable);
	}

	getTruthTable(): number[][] {
		const table = [];
		for (let i = 1; i < this.truthTable.rows.length; i++) {
			const row = [];
			for (let j = 0; j < this.truthTable.rows[i].cells.length; j++) {
				const cell = this.truthTable.rows[i].cells[j];
				if (cell.children.length > 0) {
					row.push((cell.children[0] as HTMLInputElement).checked ? 1 : 0);
				} else {
					row.push(parseInt(cell.innerText));
				}
			}
			table.push(row);
		}

		return table;
	}
}
