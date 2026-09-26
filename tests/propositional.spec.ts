// The propositional logic page states what the connectives do, which
// arguments are valid and which statements are equivalent. Every one of those
// claims comes from this engine, so it is checked here against the
// definitions and against the boolean engine the rest of the site uses.

import { expect, test } from '@playwright/test';
import {
	parseProp,
	parsePropInput,
	formatProp,
	evaluateProp,
	propTable,
	classify,
	checkArgument,
	equivalenceGroups,
	PropError,
	MAX_PROP_VARS
} from '../src/lib/propositional.js';
import { parseExpression, truthTable } from '../src/lib/boolean.js';

const column = (input: string, falseFirst = false) => {
	const table = propTable(parsePropInput(input), falseFirst);
	return table.statements[0].values.map((v) => (v ? 'T' : 'F')).join('');
};

test.describe('propositional logic', () => {
	test('the five connectives, rows from all true', () => {
		expect(column('¬p')).toBe('FT');
		expect(column('p ∧ q')).toBe('TFFF');
		expect(column('p ∨ q')).toBe('TTTF');
		expect(column('p → q')).toBe('TFTT');
		expect(column('p ↔ q')).toBe('TFFT');
		expect(column('p ⊕ q')).toBe('FTTF');
	});

	test('every notation for a connective reads the same', () => {
		const same = (inputs: string[]) => {
			const expected = formatProp(parseProp(inputs[0]));
			for (const input of inputs) expect(formatProp(parseProp(input)), input).toBe(expected);
		};
		same(['p → q', 'p -> q', 'p => q', 'p ⇒ q', 'p ⊃ q', 'p implies q']);
		same(['p ↔ q', 'p <-> q', 'p <=> q', 'p ⇔ q', 'p ≡ q', 'p iff q']);
		same(['p ∧ q', 'p & q', 'p && q', 'p ^ q', 'p · q', 'p and q', 'p AND q']);
		same(['p ∨ q', 'p | q', 'p || q', 'p + q', 'p or q', 'p v q', 'p V q']);
		same(['¬p', '~p', '!p', 'not p']);
	});

	test('precedence: ¬, then ∧, ∨, →, ↔, and → groups to the right', () => {
		expect(formatProp(parseProp('~p v q -> r'))).toBe('¬p ∨ q → r');
		expect(parseProp('p ∨ q ∧ r')).toEqual(parseProp('p ∨ (q ∧ r)'));
		expect(parseProp('p → q ↔ r')).toEqual(parseProp('(p → q) ↔ r'));
		expect(parseProp('p → q → r')).toEqual(parseProp('p → (q → r)'));
		expect(formatProp(parseProp('(p → q) → r'))).toBe('(p → q) → r');
		expect(formatProp(parseProp('p → (q → r)'))).toBe('p → q → r');
		expect(formatProp(parseProp('¬(p ∧ q)'))).toBe('¬(p ∧ q)');
	});

	test('formatting never changes the meaning', () => {
		const samples = ['(p → q) → r', 'p → (q → r)', '¬(p ∨ q) ↔ ¬p ∧ ¬q', '(p ↔ q) ↔ r', 'p ∧ (q ∨ r)', '(p ⊕ q) ∨ r'];
		for (const sample of samples) {
			const once = parseProp(sample);
			const twice = parseProp(formatProp(once));
			expect(column(formatProp(twice)), sample).toBe(column(sample));
		}
	});

	test('agrees with the boolean engine on the connectives they share', () => {
		const pairs: [string, string][] = [
			['¬p ∨ q ∧ r', '!p | q & r'],
			['(p ∨ q) ∧ ¬(p ∧ q)', '(p | q) & !(p & q)'],
			['p ⊕ q ⊕ r', 'p ^ q ^ r']
		];
		for (const [prop, bool] of pairs) {
			const ours = propTable(parsePropInput(prop), true).statements[0].values;
			expect(ours, prop).toEqual(truthTable(parseExpression(bool)).rows);
		}
		// And the two it does not have, by their definitions.
		expect(column('p → q', true)).toBe(column('¬p ∨ q', true));
		expect(column('p ↔ q', true)).toBe(column('(p → q) ∧ (q → p)', true));
	});

	test('the working columns are each compound part, innermost first, without repeats', () => {
		const table = propTable(parsePropInput('(p → q) ∧ ¬q → ¬p'));
		expect(table.steps.map((s) => s.label)).toEqual(['p → q', '¬q', '(p → q) ∧ ¬q', '¬p', '(p → q) ∧ ¬q → ¬p']);
		expect(classify(table.statements[0].values)).toBe('tautology');
	});

	test('classification', () => {
		const kind = (s: string) => classify(propTable(parsePropInput(s)).statements[0].values);
		expect(kind('p ∨ ¬p')).toBe('tautology');
		expect(kind('p ∧ ¬p')).toBe('contradiction');
		expect(kind('p → q')).toBe('contingency');
		expect(kind('¬(p ∧ q) ↔ ¬p ∨ ¬q')).toBe('tautology');
	});

	test('arguments: the valid forms are valid and the fallacies are not', () => {
		const valid = (s: string) => checkArgument(propTable(parsePropInput(s))).valid;
		expect(valid('p → q, p ∴ q')).toBe(true); // modus ponens
		expect(valid('p → q, ¬q ∴ ¬p')).toBe(true); // modus tollens
		expect(valid('p → q, q → r ∴ p → r')).toBe(true); // hypothetical syllogism
		expect(valid('p ∨ q, ¬p ∴ q')).toBe(true); // disjunctive syllogism
		expect(valid('p → q, q ∴ p')).toBe(false); // affirming the consequent
		expect(valid('p → q, ¬p ∴ ¬q')).toBe(false); // denying the antecedent
		expect(valid('p, ¬p ∴ q')).toBe(true); // anything follows from a contradiction
		expect(valid('∴ p ∨ ¬p')).toBe(true);
		expect(valid('p → q, q therefore p')).toBe(false);

		const table = propTable(parsePropInput('p → q, q ∴ p'));
		const result = checkArgument(table);
		// Rows TT, TF, FT, FF: the premises hold in TT and FT, and FT is the counterexample.
		expect(result.critical).toEqual([0, 2]);
		expect(result.counterexamples).toEqual([2]);
	});

	test('equivalence: a conditional matches its contrapositive, not its converse', () => {
		const table = propTable(parsePropInput('p → q, ¬q → ¬p, q → p, ¬p → ¬q'));
		expect(equivalenceGroups(table.statements)).toEqual([
			[0, 1],
			[2, 3]
		]);
	});

	test('rows run from all true down, or count up when asked', () => {
		const table = propTable(parsePropInput('p ∧ q'));
		expect(table.variables).toEqual(['p', 'q']);
		expect(table.rows).toEqual([
			[true, true],
			[true, false],
			[false, true],
			[false, false]
		]);
		expect(propTable(parsePropInput('p ∧ q'), true).rows[0]).toEqual([false, false]);
	});

	test('mistakes get a message rather than a wrong table', () => {
		const message = (s: string) => {
			try {
				propTable(parsePropInput(s));
				return '';
			} catch (e) {
				expect(e).toBeInstanceOf(PropError);
				return (e as Error).message;
			}
		};
		expect(message('p q')).toMatch(/side by side/);
		expect(message('pq → r')).toMatch(/one letter/);
		expect(message('(p → q')).toMatch(/never closed/);
		expect(message('p →')).toMatch(/stops early/);
		expect(message('p, , q')).toMatch(/empty statement/);
		expect(message('p ∴ q ∴ r')).toMatch(/only one ∴/);
		expect(message('p ∴ q, r')).toMatch(/single statement/);
		expect(message('p # q')).toMatch(/understand/);
		expect(message('a ∧ b ∧ c ∧ d ∧ e ∧ f ∧ g')).toMatch(new RegExp(`${MAX_PROP_VARS}`));
		expect(() => parseProp('p, q')).toThrow(PropError);
		// Half typed input says what is actually missing.
		expect(message('')).toMatch(/Type a statement/);
		expect(message('   ')).toMatch(/Type a statement/);
		expect(message('p → q, p ∴')).toMatch(/after ∴/);
		expect(message('p → q,')).toMatch(/after the last comma/);
		expect(message(', p')).toMatch(/before the first comma/);
		expect(message('p → q, ∴ q')).toMatch(/between the last comma and ∴/);
		// Numbered letters are named as the problem, not read as p AND 1.
		expect(message('p1 → p2')).toMatch(/numbered letters such as p1/);
		// Words that happen to be Object.prototype members are not keywords.
		expect(message('p ∧ constructor')).toMatch(/one letter/);
		expect(message('toString')).toMatch(/one letter/);
	});

	test('constants', () => {
		expect(evaluateProp(parseProp('⊤ → ⊥'), {})).toBe(false);
		expect(evaluateProp(parseProp('false → p'), { p: false })).toBe(true);
		expect(formatProp(parseProp('1 ∧ 0'))).toBe('⊤ ∧ ⊥');
	});
});
