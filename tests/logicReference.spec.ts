// The /logic pages list rules, laws and tautologies, and the logic statements
// page shows normal forms. Every such claim is recomputed here from the
// propositional engine, so a typo in the reference data fails a test instead
// of reaching a page.

import { expect, test } from '@playwright/test';
import {
	rules,
	fallacies,
	proof,
	stepForms,
	isInstanceOf,
	basicLaws,
	conditionalLaws,
	biconditionalLaws,
	nonLaws,
	famousTautologies,
	connectiveSymbols,
	checkArgumentText,
	classifyText,
	equivalentText,
	asConditional,
	equivalenceChains
} from '../src/lib/logicReference.js';
import {
	parseProp,
	parsePropInput,
	propTable,
	propVariables,
	evaluateProp,
	normalForms,
	type Prop
} from '../src/lib/propositional.js';

test.describe('logic reference', () => {
	test('every rule of inference is valid', () => {
		for (const rule of rules) {
			expect(checkArgumentText(rule.premises, rule.conclusion).valid, rule.name).toBe(true);
		}
	});

	test('every fallacy is invalid, with a counterexample', () => {
		for (const fallacy of fallacies) {
			const verdict = checkArgumentText(fallacy.premises, fallacy.conclusion);
			expect(verdict.valid, fallacy.name).toBe(false);
			expect(verdict.counterexamples.length, fallacy.name).toBeGreaterThan(0);
		}
		// Affirming the consequent fails exactly when q is true and p is false.
		const affirming = checkArgumentText(['p → q', 'q'], 'p');
		expect(affirming.counterexamples.map((r) => affirming.table.rows[r])).toEqual([[false, true]]);
	});

	test('an argument is valid exactly when its conditional is a tautology', () => {
		for (const r of [...rules, ...fallacies]) {
			const valid = checkArgumentText(r.premises, r.conclusion).valid;
			const kind = classifyText(asConditional(r.premises, r.conclusion)).kind;
			expect(kind === 'tautology', r.name).toBe(valid);
		}
		expect(asConditional(['p → q', 'p'], 'q')).toBe('(p → q) ∧ p → q');
	});

	test('every law is an equivalence, and every non-law is not', () => {
		for (const law of [...basicLaws, ...conditionalLaws, ...biconditionalLaws]) {
			for (const [left, right] of law.pairs) expect(equivalentText(left, right), `${law.name}: ${left}`).toBe(true);
		}
		for (const n of nonLaws) expect(equivalentText(n.left, n.right), n.left).toBe(false);
	});

	test('every famous tautology is a tautology', () => {
		for (const t of famousTautologies) expect(classifyText(t.statement).kind, t.name).toBe('tautology');
		expect(classifyText('p ∧ ¬p').kind).toBe('contradiction');
		expect(classifyText('p → q').kind).toBe('contingency');
	});

	test('every symbol example parses', () => {
		for (const s of connectiveSymbols) expect(() => parseProp(s.example)).not.toThrow();
	});

	test('the matcher recognises a rule only in its own shape', () => {
		const mp = rules.find((r) => r.id === 'modus-ponens')!;
		expect(isInstanceOf(mp, ['a ∧ b → c', 'a ∧ b'], 'c')).toBe(true);
		expect(isInstanceOf(mp, ['a → c', 'c'], 'a')).toBe(false);
		expect(isInstanceOf(mp, ['a → c', 'b'], 'c')).toBe(false);
	});

	test('each step of the worked proof follows, by the rule it cites', () => {
		const { lines } = proof;
		const premises = lines.filter((l) => l.rule === 'premise').map((l) => l.statement);
		expect(premises.length).toBe(proof.english.length);
		lines.forEach((line, i) => {
			if (line.rule === 'premise') return;
			const cited = stepForms(line.rule);
			expect(cited, line.rule).not.toBeNull();
			// Only earlier lines can be used.
			for (const n of line.from) expect(n).toBeLessThan(i + 1);
			const used = line.from.map((n) => lines[n - 1].statement);
			expect(checkArgumentText(used, line.statement).valid, `line ${i + 1}`).toBe(true);
			expect(
				cited!.forms.some((form) => isInstanceOf(form, used, line.statement)),
				`line ${i + 1} is ${cited!.name}`
			).toBe(true);
		});
		expect(lines[lines.length - 1].statement).toBe(proof.conclusion);
		expect(checkArgumentText(premises, proof.conclusion).valid).toBe(true);
	});

	test('each line of the equivalence chains is equivalent to the one before', () => {
		for (const chain of equivalenceChains) {
			chain.steps.slice(1).forEach((step, i) => {
				expect(equivalentText(chain.steps[i].statement, step.statement), `${chain.title}: ${step.statement}`).toBe(
					true
				);
			});
		}
		expect(classifyText(equivalenceChains[1].steps[0].statement).kind).toBe('tautology');
	});
});

test.describe('normal forms', () => {
	const agree = (a: Prop, b: Prop) => {
		const variables = propVariables([a, b]);
		for (let i = 0; i < 1 << variables.length; i++) {
			const values = Object.fromEntries(variables.map((v, j) => [v, !!(i & (1 << j))]));
			if (evaluateProp(a, values) !== evaluateProp(b, values)) return false;
		}
		return true;
	};

	const samples = [
		'p → q',
		'p ↔ q',
		'p ⊕ q',
		'(p → q) ∧ ¬q → ¬p',
		'¬(p ∧ q) ↔ ¬p ∨ ¬q',
		'(p ∨ q) ∧ (q → r)',
		'p ∧ ¬p',
		'p ∨ ¬p',
		'p',
		'¬p',
		'(p ↔ q) ↔ r',
		'p ∧ q ∨ r ∧ s → t',
		'(a → b) ∧ (c → d) ∧ (e ∨ f)',
		'⊤ ∧ ⊥',
		'⊤',
		'q ∧ ⊤',
		'o ∧ r',
		'¬(p → q ∨ r) ∨ s ⊕ p'
	];

	test('every form says the same as the statement', () => {
		for (const sample of samples) {
			const prop = parseProp(sample);
			const forms = normalForms(prop);
			for (const [name, text] of Object.entries(forms)) {
				expect(agree(prop, parseProp(text)), `${name} of ${sample}: ${text}`).toBe(true);
			}
		}
	});

	test('the forms have their shape: no → ↔ ⊕, negation only on letters', () => {
		for (const sample of samples) {
			for (const text of Object.values(normalForms(parseProp(sample)))) {
				expect(text).not.toMatch(/[→↔⊕⊻]/);
				expect(text).not.toMatch(/¬[(¬]/);
				expect(text).not.toMatch(/[01]/);
			}
		}
	});

	test('exact forms for the textbook cases', () => {
		expect(normalForms(parseProp('p → q'))).toEqual({
			dnf: '¬p ∨ q',
			cnf: '¬p ∨ q',
			fullDnf: '(¬p ∧ ¬q) ∨ (¬p ∧ q) ∨ (p ∧ q)',
			fullCnf: '¬p ∨ q'
		});
		expect(normalForms(parseProp('p ↔ q'))).toMatchObject({ dnf: '(¬p ∧ ¬q) ∨ (p ∧ q)', cnf: '(¬p ∨ q) ∧ (p ∨ ¬q)' });
		// A contradiction has no true rows, so its DNF is ⊥; a tautology's CNF is ⊤.
		expect(normalForms(parseProp('p ∧ ¬p'))).toMatchObject({ dnf: '⊥', fullDnf: '⊥', cnf: '⊥' });
		expect(normalForms(parseProp('p ∨ ¬p'))).toMatchObject({ dnf: '⊤', cnf: '⊤', fullCnf: '⊤' });
		expect(normalForms(parseProp('⊤ ∧ ⊥'))).toEqual({ dnf: '⊥', cnf: '⊥', fullDnf: '⊥', fullCnf: '⊥' });
	});

	test('the full DNF has one term per true row, the full CNF one clause per false row', () => {
		for (const sample of samples) {
			const prop = parseProp(sample);
			const values = propTable(parsePropInput(sample)).statements[0].values;
			const forms = normalForms(prop);
			const trues = values.filter(Boolean).length;
			const falses = values.length - trues;
			if (propVariables([prop]).length === 0) continue;
			if (trues) expect(forms.fullDnf.split(' ∨ ').length, sample).toBe(trues);
			if (falses) expect(forms.fullCnf.split(' ∧ ').length, sample).toBe(falses);
		}
	});
});
