// Reuses the practice page's question generators inside a lesson. Those
// questions come with an explanation but no hints, so each kind gets a pair of
// hints here that fit every question of that kind.

import { makeQuestion, type Question, type Topic } from '../quiz.js';
import type { CourseQuestion, QuestionGenerator, Random } from './types.js';

const HINTS: Record<Question['kind'], [string, string]> = {
	'gate-output': [
		'Say the rule of the gate in words first: AND is 1 only when every input is 1, OR when at least one is, XOR when the inputs differ.',
		'A gate whose name starts with N, or XNOR, is the plain gate with the answer flipped. Work out the plain gate, then flip.'
	],
	'identify-gate': [
		'Look at the top row, where every input is 0, and the bottom row, where every input is 1. AND and OR are told apart by those two rows alone.',
		'Count the 1s in the output column: AND has exactly one, OR has all but one, XOR has half of them. A single 1 at the top means NOR.'
	],
	evaluate: [
		'Replace each letter with its value, then work from the innermost brackets outwards. NOT binds tightest, then AND, then OR.',
		'NOT flips a value, AND needs both sides to be 1, OR needs at least one side to be 1, XOR needs exactly one.'
	],
	equivalent: [
		'Two expressions are the same only if they agree on every input combination. Try all 0s and all 1s first: they usually tell the options apart.',
		'For each option, find one row of inputs where it disagrees with the original. The option with no such row is the answer.'
	],
	'count-ones': [
		'Each row of the truth table is one combination of inputs. Two inputs give four rows, three give eight.',
		'Go row by row and apply the rule to each one; count the rows where the output comes out as 1.'
	],
	'circuit-expression': [
		'Follow each wire from the inputs to the output, writing down the gate it passes through.',
		'Start at the output gate: its two inputs are the sub-expressions. Work backwards until you reach the input names.'
	],
	'circuit-output': [
		'Label every wire, starting at the inputs. Each gate can only be worked out once both of its input wires are known.',
		'Work out the gate nearest the inputs first, write its output on its wire, then move to the next gate along.'
	]
};

/**
 * A question from the practice generator for `topic`, with hints attached.
 * `accept` filters out questions a lesson has not covered yet (a gate not
 * taught until later, say); the generator rerolls until one passes, and
 * falls back to the last one so a strict filter can never hang.
 */
export function fromPractice(topic: Topic, accept: (q: Question) => boolean = () => true): QuestionGenerator {
	return (random: Random): CourseQuestion => {
		let q = makeQuestion(Math.floor(random() * 1_000_000) + 1, topic);
		for (let tries = 0; tries < 120 && !accept(q); tries++) {
			q = makeQuestion(Math.floor(random() * 1_000_000) + 1, topic);
		}
		return {
			prompt: q.prompt,
			detail: q.detail,
			table: q.table,
			tableOutputLabel: q.tableOutputLabel,
			svg: q.svg,
			svgAlt: q.svgAlt,
			options: q.options,
			answer: q.answer,
			hints: HINTS[q.kind],
			explanation: q.explanation
		};
	};
}
