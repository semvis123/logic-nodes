// Proofs of logical equivalence, one named law per line, the way a discrete
// maths textbook writes them (Rosen's table of logical equivalences).
//
// The conditional and biconditional are removed first, one at a time, with the
// laws that define them. What is left uses only ¬, ∧, ∨ and ⊕, which is the
// boolean algebra the working in steps.ts already handles law by law, so the
// rest of the proof comes from there, translated into logic notation and the
// law names logic courses use.
//
// Every line is checked against the truth table in the test suite, so a proof
// shown on the site cannot contain a false step.

import { parseExpression, type Ast } from './boolean.js';
import { simplifySteps } from './steps.js';
import {
	evaluateProp,
	formatProp,
	parseProp,
	propVariables,
	PropError,
	MAX_PROP_VARS,
	type Connective,
	type Prop
} from './propositional.js';

export type ProofLine = {
	/** The whole statement on this line, in logic notation. */
	text: string;
	/** The law that turns the previous line into this one; empty on the first line. */
	law: string;
	/** What the law did here. */
	detail: string;
	/** True when the law was applied right to left, walking back up the other side. */
	reversed?: boolean;
	prop: Prop;
};

export type Simplification = {
	/** The statement first, then one line per law applied. */
	lines: ProofLine[];
	final: Prop;
	finalText: string;
	/** The shortest equivalent form the minimiser finds, for comparison. */
	minimalText: string;
	/** True when the laws reached that shortest form. */
	isMinimal: boolean;
	/** True when the laws reduced the statement to ⊤. */
	tautology: boolean;
	/** True when the laws reduced the statement to ⊥. */
	contradiction: boolean;
	/** What the truth table says, whatever the laws managed. */
	classification: 'tautology' | 'contradiction' | 'contingency';
	/** The working hit its step limit before it ran out of laws to apply. */
	stoppedEarly: boolean;
	/** The statement was too large to work through law by law. */
	tooBig: boolean;
};

/** Every law name a proof line can carry. The tests hold the engine to this list. */
export const PROOF_LAWS = [
	'Biconditional law',
	'Conditional law',
	'Domination law',
	'Identity law',
	'Idempotent law',
	'Negation law',
	'Double negation law',
	"De Morgan's law",
	'Absorption law',
	'Distributive law',
	'Definition of ⊕',
	'Negation of a constant',
	'Adjacency law',
	'Consensus law',
	'Redundancy law',
	'Self-cancellation law',
	'Commutative law',
	'Associative law',
	'Commutative and associative laws'
] as const;

const LAW_NAMES: Record<string, string> = {
	Annulment: 'Domination law',
	Identity: 'Identity law',
	Idempotence: 'Idempotent law',
	Complement: 'Negation law',
	'Double negation': 'Double negation law',
	'De Morgan': "De Morgan's law",
	Absorption: 'Absorption law',
	Distributivity: 'Distributive law',
	Definition: 'Definition of ⊕',
	'Constant negation': 'Negation of a constant',
	Adjacency: 'Adjacency law',
	Consensus: 'Consensus law',
	Redundancy: 'Redundancy law',
	'Self cancel': 'Self-cancellation law'
};

/** Past this many symbols, removing ↔ would make a proof nobody reads. */
const MAX_SIZE = 60;

function size(p: Prop): number {
	if (p.t === 'var' || p.t === 'const') return 1;
	if (p.t === 'not') return 1 + size(p.a);
	return 1 + size(p.a) + size(p.b);
}

// --- conversion between the two engines ---------------------------------------

function toAst(p: Prop): Ast {
	switch (p.t) {
		case 'var':
		case 'const':
			return p;
		case 'not':
			return { t: 'not', a: toAst(p.a) };
		case 'and':
		case 'or':
		case 'xor':
			return { t: p.t, a: toAst(p.a), b: toAst(p.b) };
		default:
			throw new PropError('→ and ↔ have to be removed first');
	}
}

function fromAst(ast: Ast): Prop {
	switch (ast.t) {
		case 'var':
		case 'const':
			return ast;
		case 'not':
			return { t: 'not', a: fromAst(ast.a) };
		default:
			return { t: ast.t, a: fromAst(ast.a), b: fromAst(ast.b) };
	}
}

/** Reads a line of the boolean working back, so it can be printed the logic way. */
const fromMath = (text: string): Prop => fromAst(parseExpression(text));

/**
 * The boolean working describes its moves in circuit terms: 1 and 0, AND and
 * OR. Statement letters are single letters, so any digit is a constant.
 */
function logicDetail(law: string, detail: string): string {
	let d = detail
		.replace(/⊻/g, '⊕')
		.replace(/[01]/g, (c) => (c === '1' ? '⊤' : '⊥'))
		.replace(/an AND/g, 'a conjunction')
		.replace(/an OR/g, 'a disjunction');
	if (law === 'Annulment') {
		d = d.replace(/^a single (.) into a (\w+) decides it$/, 'a single $1 in a $2 makes the whole $2 $1');
	} else if (law === 'Complement') {
		const m = /^(.*) and (.*) can never both be satisfied, giving (.)$/.exec(d);
		if (m) {
			d =
				m[3] === '⊥'
					? `${m[1]} and ${m[2]} are never both true, so the conjunction is ⊥`
					: `one of ${m[1]} and ${m[2]} is always true, so the disjunction is ⊤`;
		}
	} else if (law === 'Definition') {
		d = d.replace(/^XOR is high when/, 'an exclusive or is true when');
	} else if (law === 'Constant negation') {
		d = d.replace(/^the opposite of/, 'the negation of');
	} else if (law === 'Distributivity') {
		// Brackets, so it is clear which parts are being distributed over which.
		const wrap = (x: string) => (x.includes(' ') ? `(${x})` : x);
		d = d.replace(
			/^multiplying (.*) into (.*)$/,
			(_, a: string, b: string) => `distributing ${wrap(a)} over ${wrap(b)}`
		);
	} else if (law === 'Absorption') {
		d = d.replace(/ already needs /, ' contains ');
	} else if (law === 'Self cancel') {
		d = 'a statement is never different from itself, so its exclusive or with itself is ⊥';
	}
	return d;
}

// --- removing → and ↔ ---------------------------------------------------------

/** The first → or ↔ met reading from the outside in, left to right. */
function eliminateOnce(p: Prop): { prop: Prop; law: string; detail: string } | null {
	if (p.t === 'imp') {
		const rewritten: Prop = { t: 'or', a: { t: 'not', a: p.a }, b: p.b };
		return {
			prop: rewritten,
			law: 'Conditional law',
			detail: `p → q ≡ ¬p ∨ q (material implication), applied to ${formatProp(p)}`
		};
	}
	if (p.t === 'iff') {
		const rewritten: Prop = { t: 'and', a: { t: 'imp', a: p.a, b: p.b }, b: { t: 'imp', a: p.b, b: p.a } };
		return {
			prop: rewritten,
			law: 'Biconditional law',
			detail: `p ↔ q ≡ (p → q) ∧ (q → p), applied to ${formatProp(p)}`
		};
	}
	if (p.t === 'not') {
		const inner = eliminateOnce(p.a);
		return inner && { ...inner, prop: { t: 'not', a: inner.prop } };
	}
	if (p.t === 'var' || p.t === 'const') return null;
	const left = eliminateOnce(p.a);
	if (left) return { ...left, prop: { t: p.t, a: left.prop, b: p.b } };
	const right = eliminateOnce(p.b);
	if (right) return { ...right, prop: { t: p.t, a: p.a, b: right.prop } };
	return null;
}

// --- comparing ----------------------------------------------------------------

/**
 * A key for comparing statements. By default it ignores both the order and the
 * grouping of ∧, ∨, ⊕ and ↔ terms; either can be kept, to tell which of the
 * commutative and associative laws a rearrangement used.
 */
export function orderlessKey(p: Prop, keepOrder = false, keepGrouping = false): string {
	const k = (q: Prop) => orderlessKey(q, keepOrder, keepGrouping);
	switch (p.t) {
		case 'var':
			return p.name;
		case 'const':
			return p.v ? 'T' : 'F';
		case 'not':
			return `!${k(p.a)}`;
		case 'imp':
			return `(${k(p.a)}>${k(p.b)})`;
		default: {
			const op: Connective = p.t;
			const parts: string[] = [];
			const collect = (q: Prop) => {
				if (q.t === op && !keepGrouping) {
					collect(q.a);
					collect(q.b);
				} else parts.push(k(q));
			};
			if (keepGrouping) parts.push(k(p.a), k(p.b));
			else collect(p);
			if (!keepOrder) parts.sort();
			return `${op}(${parts.join(',')})`;
		}
	}
}

function checkSize(props: Prop[]): string[] {
	const variables = propVariables(props);
	if (variables.length > MAX_PROP_VARS) {
		throw new PropError(`That is more than ${MAX_PROP_VARS} letters, which is too many to check by truth table`);
	}
	return variables;
}

/** Every assignment of the letters, all true first as in logic textbooks. */
function assignments(variables: string[]): Record<string, boolean>[] {
	const n = variables.length;
	const out: Record<string, boolean>[] = [];
	for (let i = (1 << n) - 1; i >= 0; i--) {
		out.push(Object.fromEntries(variables.map((v, bit) => [v, !!(i & (1 << (n - 1 - bit)))])));
	}
	return out;
}

/** True when the two statements agree on every row, over all the letters of both. */
export function sameTruthTable(a: Prop, b: Prop): boolean {
	const variables = checkSize([a, b]);
	return assignments(variables).every((row) => evaluateProp(a, row) === evaluateProp(b, row));
}

// --- the proofs ---------------------------------------------------------------

/** Works a statement down to its simplest form, one law per line. */
export function simplifyProof(p: Prop): Simplification {
	const variables = checkSize([p]);
	const rows = assignments(variables).map((row) => evaluateProp(p, row));
	const classification = rows.every(Boolean) ? 'tautology' : !rows.some(Boolean) ? 'contradiction' : 'contingency';

	const lines: ProofLine[] = [{ text: formatProp(p), law: '', detail: '', prop: p }];
	let current = p;
	let tooBig = false;
	for (let move = eliminateOnce(current); move; move = eliminateOnce(current)) {
		if (size(move.prop) > MAX_SIZE) {
			tooBig = true;
			break;
		}
		current = move.prop;
		lines.push({ text: formatProp(current), law: move.law, detail: move.detail, prop: current });
	}

	let stoppedEarly = false;
	let isMinimal = false;
	let minimalText = '';
	if (!tooBig) {
		const working = simplifySteps(toAst(current), 'math');
		minimalText = formatProp(fromMath(working.minimalText));
		tooBig = working.tooBig;
		stoppedEarly = working.stoppedEarly;
		isMinimal = working.isMinimal;
		for (const step of working.steps) {
			const prop = fromMath(step.text);
			lines.push({
				text: formatProp(prop),
				law: LAW_NAMES[step.law] ?? `${step.law} law`,
				detail: logicDetail(step.law, step.detail),
				prop
			});
		}
	}

	const final = lines[lines.length - 1].prop;
	if (!minimalText) minimalText = formatProp(final);
	return {
		lines,
		final,
		finalText: formatProp(final),
		minimalText,
		isMinimal,
		tautology: final.t === 'const' && final.v,
		contradiction: final.t === 'const' && !final.v,
		classification,
		stoppedEarly,
		tooBig
	};
}

export type Counterexample = { values: Record<string, boolean>; a: boolean; b: boolean };

/**
 * One flat shape rather than a union: the project does not run TypeScript in
 * strict mode, which is what narrowing on a boolean field needs.
 */
export type EquivalenceProof = {
	equivalent: boolean;
	variables: string[];
	/** Set when they are not equivalent: a row where the two differ. */
	counterexample: Counterexample | null;
	/** Set when they are equivalent: each side simplified by the laws. */
	left: Simplification | null;
	right: Simplification | null;
	/** One chain from the left statement to the right one, or null when the laws did not meet. */
	chain: ProofLine[] | null;
};

/**
 * Decides equivalence by truth table, then looks for a chain of laws. Each side
 * is simplified, and where the two workings reach the same statement (up to the
 * order of terms) the right side's lines are walked backwards: each law holds in
 * both directions, so the step that took line i to i + 1 also takes i + 1 back to i.
 */
export function equivalenceProof(a: Prop, b: Prop): EquivalenceProof {
	const variables = checkSize([a, b]);
	for (const values of assignments(variables)) {
		const left = evaluateProp(a, values);
		const right = evaluateProp(b, values);
		if (left !== right)
			return {
				equivalent: false,
				variables,
				counterexample: { values, a: left, b: right },
				left: null,
				right: null,
				chain: null
			};
	}
	const left = simplifyProof(a);
	const right = simplifyProof(b);

	// The earliest point where the two workings meet, fewest lines in total.
	let best: [number, number] | null = null;
	const rightKeys = right.lines.map((l) => orderlessKey(l.prop));
	left.lines.forEach((line, i) => {
		const j = rightKeys.indexOf(orderlessKey(line.prop));
		if (j >= 0 && (!best || i + j < best[0] + best[1])) best = [i, j];
	});
	if (!best) return { equivalent: true, variables, counterexample: null, left, right, chain: null };

	const [i, j] = best as [number, number];
	const chain = left.lines.slice(0, i + 1);
	const meet = right.lines[j];
	const from = chain[chain.length - 1].prop;
	if (meet.text !== chain[chain.length - 1].text) {
		// Only the order changed, only the brackets, or both.
		const law =
			orderlessKey(from, false, true) === orderlessKey(meet.prop, false, true)
				? 'Commutative law'
				: orderlessKey(from, true) === orderlessKey(meet.prop, true)
				? 'Associative law'
				: 'Commutative and associative laws';
		chain.push({
			text: meet.text,
			law,
			detail:
				law === 'Commutative law'
					? 'the same terms, written in a different order'
					: law === 'Associative law'
					? 'the same terms, grouped differently'
					: 'the same terms, in a different order and grouping',
			prop: meet.prop
		});
	}
	for (let k = j - 1; k >= 0; k--) {
		const step = right.lines[k + 1];
		chain.push({
			text: right.lines[k].text,
			law: step.law,
			detail: step.detail,
			reversed: true,
			prop: right.lines[k].prop
		});
	}
	return { equivalent: true, variables, counterexample: null, left, right, chain };
}

/** A statement is a tautology when its simplification ends at ⊤. */
export function isTautologyProof(p: Prop): Simplification & { proved: boolean } {
	const s = simplifyProof(p);
	return { ...s, proved: s.tautology };
}

// --- the reference table ------------------------------------------------------

export type EquivalenceLaw = { name: string; left: string; right: string; group: 'basic' | 'conditional' };

/** The table of logical equivalences, as statements the engine can check. */
export const EQUIVALENCE_LAWS: EquivalenceLaw[] = [
	{ name: 'Identity laws', left: 'p ∧ ⊤', right: 'p', group: 'basic' },
	{ name: 'Identity laws', left: 'p ∨ ⊥', right: 'p', group: 'basic' },
	{ name: 'Domination laws', left: 'p ∨ ⊤', right: '⊤', group: 'basic' },
	{ name: 'Domination laws', left: 'p ∧ ⊥', right: '⊥', group: 'basic' },
	{ name: 'Idempotent laws', left: 'p ∨ p', right: 'p', group: 'basic' },
	{ name: 'Idempotent laws', left: 'p ∧ p', right: 'p', group: 'basic' },
	{ name: 'Double negation law', left: '¬¬p', right: 'p', group: 'basic' },
	{ name: 'Commutative laws', left: 'p ∨ q', right: 'q ∨ p', group: 'basic' },
	{ name: 'Commutative laws', left: 'p ∧ q', right: 'q ∧ p', group: 'basic' },
	{ name: 'Associative laws', left: '(p ∨ q) ∨ r', right: 'p ∨ (q ∨ r)', group: 'basic' },
	{ name: 'Associative laws', left: '(p ∧ q) ∧ r', right: 'p ∧ (q ∧ r)', group: 'basic' },
	{ name: 'Distributive laws', left: 'p ∨ (q ∧ r)', right: '(p ∨ q) ∧ (p ∨ r)', group: 'basic' },
	{ name: 'Distributive laws', left: 'p ∧ (q ∨ r)', right: '(p ∧ q) ∨ (p ∧ r)', group: 'basic' },
	{ name: "De Morgan's laws", left: '¬(p ∧ q)', right: '¬p ∨ ¬q', group: 'basic' },
	{ name: "De Morgan's laws", left: '¬(p ∨ q)', right: '¬p ∧ ¬q', group: 'basic' },
	{ name: 'Absorption laws', left: 'p ∨ (p ∧ q)', right: 'p', group: 'basic' },
	{ name: 'Absorption laws', left: 'p ∧ (p ∨ q)', right: 'p', group: 'basic' },
	{ name: 'Negation laws', left: 'p ∨ ¬p', right: '⊤', group: 'basic' },
	{ name: 'Negation laws', left: 'p ∧ ¬p', right: '⊥', group: 'basic' },
	{ name: 'Definition of ⊕', left: 'p ⊕ q', right: '(p ∧ ¬q) ∨ (¬p ∧ q)', group: 'basic' },
	{ name: 'Conditional law', left: 'p → q', right: '¬p ∨ q', group: 'conditional' },
	{ name: 'Contrapositive', left: 'p → q', right: '¬q → ¬p', group: 'conditional' },
	{ name: 'Disjunction as conditional', left: 'p ∨ q', right: '¬p → q', group: 'conditional' },
	{ name: 'Negated conditional', left: '¬(p → q)', right: 'p ∧ ¬q', group: 'conditional' },
	{ name: 'Exportation', left: '(p ∧ q) → r', right: 'p → (q → r)', group: 'conditional' },
	{ name: 'Common consequent', left: '(p → r) ∧ (q → r)', right: '(p ∨ q) → r', group: 'conditional' },
	{ name: 'Common antecedent', left: '(p → q) ∧ (p → r)', right: 'p → (q ∧ r)', group: 'conditional' },
	{ name: 'Biconditional law', left: 'p ↔ q', right: '(p → q) ∧ (q → p)', group: 'conditional' },
	{ name: 'Biconditional as cases', left: 'p ↔ q', right: '(p ∧ q) ∨ (¬p ∧ ¬q)', group: 'conditional' },
	{ name: 'Negated biconditional', left: '¬(p ↔ q)', right: 'p ↔ ¬q', group: 'conditional' }
];

/** Each law with the engine's own verdict on it, for the page to render. */
export function checkedLaws(): (EquivalenceLaw & { proved: boolean })[] {
	return EQUIVALENCE_LAWS.map((law) => ({
		...law,
		proved: sameTruthTable(parseProp(law.left), parseProp(law.right))
	}));
}
