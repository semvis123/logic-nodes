// A proof is only worth showing if every line of it is true. These check each
// line against the truth table of the statement it started from, for textbook
// examples and for many random statements, rather than trusting the laws.

import { expect, test } from '@playwright/test';
import {
	equivalenceProof,
	simplifyProof,
	isTautologyProof,
	sameTruthTable,
	orderlessKey,
	checkedLaws,
	EQUIVALENCE_LAWS,
	PROOF_LAWS,
	type ProofLine
} from '../src/lib/logicProof.js';
import { parseProp, formatProp, evaluateProp, propVariables, type Prop } from '../src/lib/propositional.js';

// Deterministic, so a failure is always reproducible.
let seed = 20260926;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const randomProp = (depth: number, pool: string[]): Prop => {
	if (depth <= 0 || rnd() < 0.25) {
		if (rnd() < 0.06) return { t: 'const', v: rnd() < 0.5 };
		return { t: 'var', name: pool[Math.floor(rnd() * pool.length)] };
	}
	if (rnd() < 0.2) return { t: 'not', a: randomProp(depth - 1, pool) };
	const r = rnd();
	const t = r < 0.25 ? 'and' : r < 0.5 ? 'or' : r < 0.62 ? 'xor' : r < 0.87 ? 'imp' : 'iff';
	return { t, a: randomProp(depth - 1, pool), b: randomProp(depth - 1, pool) } as Prop;
};
const randomCases = (count: number) => {
	const out: Prop[] = [];
	while (out.length < count) {
		const pool = ['p', 'q', 'r', 's'].slice(0, 2 + Math.floor(rnd() * 3));
		out.push(randomProp(2 + Math.floor(rnd() * 2), pool));
	}
	return out;
};

const SAMPLES = [
	'¬(p → q)',
	'p → q',
	'¬q → ¬p',
	'(p ∧ q) → (p ∨ q)',
	'p ↔ q',
	'(p ∧ q) ∨ (¬p ∧ ¬q)',
	'¬(p ∨ (¬p ∧ q))',
	'(p ∧ q) → r',
	'p → (q → r)',
	'(p ∧ (p → q)) → q',
	'p ⊕ q',
	'¬(p ↔ q)',
	'(p → q) ∧ (q → r) → (p → r)',
	'p ∨ ¬p',
	'p ∧ ¬p',
	'⊤ → p',
	'p ↔ q ↔ r'
];

const allowed = new Set<string>(PROOF_LAWS);

/** Every line has the truth table of the statement the proof started from. */
function expectSound(lines: ProofLine[], start: Prop, label: string) {
	let previous = formatProp(start);
	for (const line of lines) {
		expect(
			sameTruthTable(line.prop, start),
			`${label}: "${line.law}" turned ${previous} into ${line.text}, which is a different statement`
		).toBe(true);
		// The printed text says the same as the statement it came from.
		expect(formatProp(parseProp(line.text)), `${label}: ${line.text}`).toBe(line.text);
		expect(sameTruthTable(parseProp(line.text), line.prop)).toBe(true);
		previous = line.text;
	}
	lines.slice(1).forEach((line) => expect(allowed.has(line.law), `${label}: unexpected law "${line.law}"`).toBe(true));
	expect(lines[0].law).toBe('');
}

const proof = (a: string, b: string) => equivalenceProof(parseProp(a), parseProp(b));
const chainOf = (a: string, b: string) => {
	const result = proof(a, b);
	if (!result.equivalent) throw new Error(`${a} and ${b} should be equivalent`);
	return result;
};

test.describe('logical equivalence proofs', () => {
	test('every line of every simplification is equivalent to the statement', () => {
		for (const s of SAMPLES) {
			const p = parseProp(s);
			expectSound(simplifyProof(p).lines, p, s);
		}
		for (const p of randomCases(300)) {
			const result = simplifyProof(p);
			expectSound(result.lines, p, formatProp(p));
			expect(result.lines[0].text).toBe(formatProp(p));
			expect(result.finalText).toBe(result.lines[result.lines.length - 1].text);
		}
	});

	test('→ and ↔ are removed first, one per line, and never come back', () => {
		for (const p of randomCases(200)) {
			const { lines, tooBig } = simplifyProof(p);
			const laws = lines.slice(1).map((l) => l.law);
			const firstOther = laws.findIndex((l) => l !== 'Conditional law' && l !== 'Biconditional law');
			if (firstOther >= 0) {
				expect(laws.slice(firstOther).some((l) => l === 'Conditional law' || l === 'Biconditional law')).toBe(false);
				// Once the boolean laws start, the statement has neither connective.
				expect(lines[firstOther + 1].text).not.toMatch(/[→↔]/);
			}
			if (!tooBig) expect(lines[lines.length - 1].text).not.toMatch(/[→↔]/);
		}
	});

	test('every chain runs from the left statement to the right one, each line equivalent', () => {
		const pairs: [string, string][] = [
			['¬(p → q)', 'p ∧ ¬q'],
			['p → q', '¬q → ¬p'],
			['p ↔ q', '(p ∧ q) ∨ (¬p ∧ ¬q)'],
			['¬(p ∨ (¬p ∧ q))', '¬p ∧ ¬q'],
			['(p ∧ q) → r', 'p → (q → r)'],
			['p ∨ (p ∧ q)', 'p'],
			['¬(p ↔ q)', 'p ↔ ¬q'],
			['(p → r) ∧ (q → r)', '(p ∨ q) → r'],
			['p ⊕ q', '¬(p ↔ q)']
		];
		let chains = 0;
		const check = (a: Prop, b: Prop) => {
			const result = equivalenceProof(a, b);
			expect(result.equivalent).toBe(true);
			if (!result.equivalent) return;
			expectSound(result.left.lines, a, formatProp(a));
			expectSound(result.right.lines, b, formatProp(b));
			if (!result.chain) return;
			chains++;
			expectSound(result.chain, a, `${formatProp(a)} ≡ ${formatProp(b)}`);
			expect(result.chain[0].text).toBe(formatProp(a));
			expect(result.chain[result.chain.length - 1].text).toBe(formatProp(b));
		};
		for (const [a, b] of pairs) check(parseProp(a), parseProp(b));
		// Random pairs that are equivalent by construction: a statement and one
		// of the lines of its own simplification, rewritten a different way.
		for (const p of randomCases(150)) {
			const lines = simplifyProof(p).lines;
			const other = lines[Math.floor(rnd() * lines.length)].prop;
			check(p, other);
			check(other, p);
		}
		expect(chains).toBeGreaterThan(250);
	});

	test('textbook examples reach the expected forms', () => {
		// Negated conditional.
		expect(simplifyProof(parseProp('¬(p → q)')).finalText).toBe('p ∧ ¬q');
		expect(chainOf('¬(p → q)', 'p ∧ ¬q').chain?.map((l) => l.law)).toEqual(['', 'Conditional law', "De Morgan's law"]);

		// Contrapositive: both sides meet.
		const contrapositive = chainOf('p → q', '¬q → ¬p').chain!;
		expect(contrapositive[0].text).toBe('p → q');
		expect(contrapositive[contrapositive.length - 1].text).toBe('¬q → ¬p');
		expect(contrapositive.some((l) => l.reversed)).toBe(true);

		// A tautology.
		const t = isTautologyProof(parseProp('(p ∧ q) → (p ∨ q)'));
		expect(t.proved).toBe(true);
		expect(t.finalText).toBe('⊤');
		expect(t.classification).toBe('tautology');
		expect(isTautologyProof(parseProp('(p ∧ (p → q)) → q')).proved).toBe(true);
		expect(simplifyProof(parseProp('p ∧ ¬p')).contradiction).toBe(true);

		// Biconditional as two cases.
		const iff = chainOf('p ↔ q', '(p ∧ q) ∨ (¬p ∧ ¬q)');
		expect(iff.chain).not.toBeNull();
		expect(iff.chain![1].law).toBe('Biconditional law');

		// Rosen's example: ¬(p ∨ (¬p ∧ q)) ≡ ¬p ∧ ¬q.
		expect(simplifyProof(parseProp('¬(p ∨ (¬p ∧ q))')).finalText).toBe('¬p ∧ ¬q');
		expect(chainOf('¬(p ∨ (¬p ∧ q))', '¬p ∧ ¬q').chain).not.toBeNull();

		// Exportation.
		expect(chainOf('(p ∧ q) → r', 'p → (q → r)').chain).not.toBeNull();
	});

	test('a rearrangement at the meeting point names the law it uses', () => {
		const chain = chainOf('(p ∧ q) → r', 'p → (q → r)').chain!;
		const laws = chain.map((l) => l.law);
		expect(laws).toContain('Associative law');
		const swap = chainOf('p ∨ q', 'q ∨ p').chain!;
		expect(swap.map((l) => l.law)).toEqual(['', 'Commutative law']);
	});

	test('non-equivalent pairs give a real counterexample', () => {
		const pairs: [string, string][] = [
			['p → q', 'q → p'],
			['p → q', '¬p → ¬q'],
			['p ∧ q', 'p ∨ q'],
			['p ⊕ q', 'p ↔ q'],
			['p → (q → r)', '(p → q) → r'],
			['p', 'q']
		];
		const randomPairs = randomCases(200).map((a) => [a, randomCases(1)[0]] as [Prop, Prop]);
		const all = [...pairs.map(([a, b]) => [parseProp(a), parseProp(b)] as [Prop, Prop]), ...randomPairs];
		let differing = 0;
		for (const [a, b] of all) {
			const result = equivalenceProof(a, b);
			expect(result.equivalent).toBe(sameTruthTable(a, b));
			if (result.equivalent) continue;
			differing++;
			const { values } = result.counterexample;
			expect(Object.keys(values).sort()).toEqual(propVariables([a, b]));
			expect(evaluateProp(a, values)).toBe(result.counterexample.a);
			expect(evaluateProp(b, values)).toBe(result.counterexample.b);
			expect(result.counterexample.a).not.toBe(result.counterexample.b);
		}
		expect(differing).toBeGreaterThan(100);
		// The converse fails when p is true and q is false.
		const converse = proof('p → q', 'q → p');
		expect(converse.equivalent).toBe(false);
		if (!converse.equivalent)
			expect(converse.counterexample).toEqual({ values: { p: true, q: false }, a: false, b: true });
	});

	test('law names only come from the allowed set', () => {
		const used = new Set<string>();
		for (const p of randomCases(300)) for (const line of simplifyProof(p).lines.slice(1)) used.add(line.law);
		for (const law of used) expect(allowed.has(law), law).toBe(true);
		// And the translation reads as logic, not circuit algebra.
		for (const p of randomCases(300)) {
			for (const line of simplifyProof(p).lines) {
				expect(line.text).not.toMatch(/[01⊻]/);
				expect(line.detail).not.toMatch(/[01⊻]|\bAND\b|\bOR\b|\bXOR\b|high/);
			}
		}
	});

	test('the reference table only lists real equivalences', () => {
		expect(EQUIVALENCE_LAWS.length).toBeGreaterThan(20);
		for (const law of checkedLaws()) expect(law.proved, `${law.left} ≡ ${law.right}`).toBe(true);
		// And the check is not vacuous.
		expect(sameTruthTable(parseProp('p → q'), parseProp('q → p'))).toBe(false);
	});

	test('the comparison key ignores order and grouping only', () => {
		const k = (s: string) => orderlessKey(parseProp(s));
		expect(k('p ∧ q ∧ r')).toBe(k('r ∧ (q ∧ p)'));
		expect(k('p ∨ q')).not.toBe(k('p ∧ q'));
		expect(k('p → q')).not.toBe(k('q → p'));
	});
});
