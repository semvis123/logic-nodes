import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import { Command } from './Command';
import { ToastMessage } from '../toastMessage/ToastMessage';
import { ConstructCircuitFromExpressionCommand } from './ConstructCircuitFromExpressionCommand';
import { FullscreenTruthTablePrompt } from '../fullscreenPrompt/FullscreenTruthTablePrompt';
import { indexToInputName } from '../utils';
import { CreateBooleanExpressionCommand, logicNotations } from './CreateBooleanExpressionCommand';

export class ConstructCircuitFromTruthTableCommand extends Command {
	async execute() {
		this.nodeSystem.eventHandler.cleanup();
		try {
			if (!(this.nodeSystem.nodeStorage.nodes?.length == 0)) {
				return new ToastMessage(
					'Cannot construct circuit from expression when there are nodes in the circuit',
					'danger'
				).show();
			}
			const inputPrompt = new FullscreenPrompt();
			const inputs = await inputPrompt.requestParameters('Amount of inputs', [
				{
					type: 'number',
					name: 'inputs',
					label: 'Inputs',
					value: 2,
					required: true,
					autofocus: true
				}
			]);
			if (inputs == null) return null;
			const inputAmount = inputs[0].value as number;
			const truthTablePrompt = new FullscreenTruthTablePrompt();
			const truthTable = await truthTablePrompt.requestTruthTable(inputAmount);

			if (truthTable == null) return null;

			const fromExpressionCommand = new ConstructCircuitFromExpressionCommand(this.nodeSystem);
			const booleanExpressionCommand = new CreateBooleanExpressionCommand(this.nodeSystem);
			const expression = this.createExpressionFromTruthTable(truthTable);
			console.log(expression);
			let simplifiedExpression = await booleanExpressionCommand.simplifyExpression(expression);
			console.log(simplifiedExpression);
			if (simplifiedExpression == expression) {
				// and or not -> & | ~
				simplifiedExpression = simplifiedExpression.replace(/and/g, '&').replace(/or/g, '|').replace(/not/g, '~');
			}
			fromExpressionCommand.constructCircuit(simplifiedExpression);
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}

	createExpressionFromTruthTable(truthTable: number[][]): string {
		let expression = '';
		truthTable.forEach((row) => {
			const inputs = row.slice(0, row.length - 1);
			const output = row[row.length - 1];
			const inputExpression = inputs
				.map((input, index) => {
					return input ? indexToInputName(index) : `(!${indexToInputName(index)})`;
				})
				.join(logicNotations[1].and);
			if (output == 1) {
				expression += `${inputExpression}||`;
			}
		});
		return expression.slice(0, expression.length - 2);
	}
}
