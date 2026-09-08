// The whole value of a shown derivation is that each line is actually true.
// These check that claim rather than trusting the rewrite rules.

import { expect, test } from '@playwright/test';
import { parseExpression, truthTable, format, variablesOf, type Ast } from '../src/lib/boolean.js';
import { simplifySteps } from '../src/lib/steps.js';
import { laws } from '../src/lib/laws.js';

// Deterministic, so a failure is always reproducible.
let seed = 20260908;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const randomAst = (depth: number, pool: string[]): Ast => {
	if (depth <= 0 || rnd() < 0.28) {
		if (rnd() < 0.08) return { t: 'const', v: rnd() < 0.5 };
		return { t: 'var', name: pool[Math.floor(rnd() * pool.length)] };
	}
	if (rnd() < 0.22) return { t: 'not', a: randomAst(depth - 1, pool) };
	const r = rnd();
	const kind = r < 0.45 ? 'and' : r < 0.8 ? 'or' : 'xor';
	return { t: kind, a: randomAst(depth - 1, pool), b: randomAst(depth - 1, pool) } as Ast;
};

const cases = (count: number) => {
	const out: Ast[] = [];
	const vars = ['a', 'b', 'c', 'd'];
	while (out.length < count) {
		const pool = vars.slice(0, 2 + Math.floor(rnd() * 3));
		const ast = randomAst(3 + Math.floor(rnd() * 2), pool);
		if (variablesOf(ast).length) out.push(ast);
	}
	return out;
};

test.describe('shown working', () => {
	test('every single step preserves the truth table', () => {
		for (const ast of cases(400)) {
			const variables = variablesOf(ast);
			const expected = truthTable(ast, variables).rows;
			const working = simplifySteps(ast);
			if (working.tooBig) continue;

			let previous = format(ast, 'math');
			for (const step of working.steps) {
				const rows = truthTable(parseExpression(step.text), variables).rows;
				expect(rows, `"${step.law}" turned ${previous} into ${step.text}, which is a different function`).toEqual(
					expected
				);
				previous = step.text;
			}
			// And the end of the derivation is the expression it started from.
			const final = truthTable(parseExpression(working.text), variables).rows;
			expect(final, `the result ${working.text} is not ${format(ast, 'math')}`).toEqual(expected);
		}
	});

	test('every step names a law the site actually documents', () => {
		const known = new Set(laws.map((law) => law.name));
		const used = new Set<string>();
		for (const ast of cases(300)) {
			for (const step of simplifySteps(ast).steps) {
				expect(known, `step cites "${step.law}", which is not in laws.ts`).toContain(step.law);
				expect(step.detail.length, 'a step with no explanation is not working shown').toBeGreaterThan(0);
				used.add(step.law);
			}
		}
		// A derivation engine that only ever fires one rule is not much of one.
		expect(used.size, `only used ${[...used].join(', ')}`).toBeGreaterThan(5);
	});

	test('the derivation never gets longer than it promises', () => {
		for (const ast of cases(300)) {
			const working = simplifySteps(ast);
			expect(working.steps.length).toBeLessThanOrEqual(40);
			// Each entry must be a real change, not a restatement.
			for (let i = 1; i < working.steps.length; i++) {
				expect(working.steps[i].text, 'a step that changes nothing is noise').not.toBe(working.steps[i - 1].text);
			}
		}
	});

	test('it reaches the minimal answer on the textbook cases', () => {
		const textbook: [string, string][] = [
			['a & b | a & !b', 'a'],
			['a | a & b', 'a'],
			['!(!a)', 'a'],
			['a & !a', '0'],
			['a | !a', '1'],
			['a & 1', 'a'],
			['a | 0', 'a'],
			['a & 0', '0'],
			['a | 1', '1'],
			['a | !a & b', 'a ∨ b'],
			['!(a & b)', '¬a ∨ ¬b'],
			['!(a | b)', '¬a ∧ ¬b']
		];
		for (const [source, expected] of textbook) {
			const working = simplifySteps(parseExpression(source));
			expect(working.text, `${source} should work down to ${expected}`).toBe(expected);
			if (source !== '!(a & b)' && source !== '!(a | b)') {
				expect(working.steps.length, `${source} should show its working`).toBeGreaterThan(0);
			}
		}
	});

	test('it usually reaches the same answer as the minimiser', () => {
		let matched = 0;
		let total = 0;
		for (const ast of cases(300)) {
			const working = simplifySteps(ast);
			if (working.tooBig) continue;
			total++;
			if (working.isMinimal) matched++;
		}
		// It will not always: law rewriting is not a minimisation algorithm, which
		// is exactly why the page shows the minimiser's answer alongside. It does
		// get there almost every time though, and a drop means a rule regressed.
		expect(matched / total, `only matched ${matched} of ${total}`).toBeGreaterThan(0.95);
	});

	test('a derivation that stops early says so', () => {
		for (const ast of cases(200)) {
			const working = simplifySteps(ast);
			if (working.stoppedEarly) expect(working.steps.length).toBe(40);
		}
	});
});
