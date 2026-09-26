// The reference material behind the /logic pages: the rules of inference, the
// laws of logic, the famous tautologies and a worked proof. Only the
// statements live here. Whether a rule is valid, a law holds or a statement is
// a tautology is always worked out by the propositional engine, at build time
// on the pages and again in tests/logicReference.spec.ts, so nothing on those
// pages rests on a hand typed verdict.

import {
	parseProp,
	parsePropInput,
	propTable,
	checkArgument,
	classify,
	formatProp,
	type Prop,
	type PropTable,
	type Classification
} from './propositional.js';

/** Premises then ∴ and a conclusion, as the calculator reads it. */
export const argumentText = (premises: string[], conclusion: string) => `${premises.join(', ')} ∴ ${conclusion}`;

export type ArgumentVerdict = {
	table: PropTable;
	valid: boolean;
	/** Rows where every premise is true and the conclusion false. */
	counterexamples: number[];
};

export function checkArgumentText(premises: string[], conclusion: string): ArgumentVerdict {
	const table = propTable(parsePropInput(argumentText(premises, conclusion)));
	const result = checkArgument(table);
	return { table, valid: result.valid, counterexamples: result.counterexamples };
}

/** Classifies one statement from its truth table. */
export function classifyText(statement: string): { kind: Classification; table: PropTable; trueRows: number } {
	const table = propTable(parsePropInput(statement));
	const values = table.statements[0].values;
	return { kind: classify(values), table, trueRows: values.filter(Boolean).length };
}

/** True when the two statements agree on every row. */
export function equivalentText(left: string, right: string): boolean {
	const table = propTable(parsePropInput(`${left}, ${right}`));
	const [a, b] = table.statements;
	return a.values.every((v, r) => v === b.values[r]);
}

/**
 * The argument as a single statement: (premise ∧ premise ∧ ...) → conclusion.
 * An argument is valid exactly when this is a tautology.
 */
export function asConditional(premises: string[], conclusion: string): string {
	const body = premises.map((p) => `(${p})`).join(' ∧ ');
	return formatProp(parseProp(premises.length ? `(${body}) → (${conclusion})` : conclusion));
}

// --- symbols ------------------------------------------------------------------

export type LogicSymbol = {
	symbol: string;
	name: string;
	reads: string;
	/** Other ways the same connective is written, in books and on keyboards. */
	also: string;
	/** A statement using it, for the truth table link. */
	example: string;
};

export const connectiveSymbols: LogicSymbol[] = [
	{ symbol: '¬', name: 'Negation', reads: 'not p', also: '~p, !p, p̄, −p, NOT p', example: '¬p' },
	{ symbol: '∧', name: 'Conjunction', reads: 'p and q', also: 'p & q, p · q, p AND q', example: 'p ∧ q' },
	{
		symbol: '∨',
		name: 'Disjunction',
		reads: 'p or q (or both)',
		also: 'p v q, p + q, p OR q',
		example: 'p ∨ q'
	},
	{
		symbol: '⊕',
		name: 'Exclusive or',
		reads: 'p or q, but not both',
		also: 'p ⊻ q, p ↮ q, p XOR q',
		example: 'p ⊕ q'
	},
	{
		symbol: '→',
		name: 'Conditional (implication)',
		reads: 'if p then q; p implies q',
		also: 'p ⊃ q, p ⇒ q',
		example: 'p → q'
	},
	{
		symbol: '↔',
		name: 'Biconditional',
		reads: 'p if and only if q',
		also: 'p ≡ q, p ⇔ q, p iff q',
		example: 'p ↔ q'
	}
];

export const otherSymbols: { symbol: string; name: string; meaning: string }[] = [
	{ symbol: '⊤', name: 'Top, verum', meaning: 'A statement that is always true. Also written T or 1.' },
	{ symbol: '⊥', name: 'Bottom, falsum', meaning: 'A statement that is always false. Also written F or 0.' },
	{ symbol: '∴', name: 'Therefore', meaning: 'Marks the conclusion of an argument.' },
	{
		symbol: '≡',
		name: 'Logically equivalent',
		meaning: 'Written between two statements with the same truth table, as in p → q ≡ ¬p ∨ q. Some books write ⇔.'
	},
	{
		symbol: '⊨',
		name: 'Entails',
		meaning: 'The premises on the left make the conclusion on the right true in every row: the argument is valid.'
	},
	{
		symbol: '⊢',
		name: 'Proves',
		meaning: 'The conclusion can be derived from the premises with the rules of a proof system.'
	}
];

// --- rules of inference ------------------------------------------------------

export type Rule = {
	id: string;
	name: string;
	/** Other names the rule goes by. */
	aka?: string;
	premises: string[];
	conclusion: string;
	/** An English instance, one line per premise, then the conclusion. */
	english: { premises: string[]; conclusion: string };
	/** What the rule says, in a sentence. */
	idea: string;
};

export const rules: Rule[] = [
	{
		id: 'modus-ponens',
		name: 'Modus ponens',
		aka: 'affirming the antecedent, →-elimination',
		premises: ['p → q', 'p'],
		conclusion: 'q',
		english: {
			premises: ['If the kettle is on, the water will boil.', 'The kettle is on.'],
			conclusion: 'The water will boil.'
		},
		idea: 'From a conditional and its antecedent, conclude its consequent.'
	},
	{
		id: 'modus-tollens',
		name: 'Modus tollens',
		aka: 'denying the consequent',
		premises: ['p → q', '¬q'],
		conclusion: '¬p',
		english: {
			premises: ['If the file was saved, it is on the disk.', 'It is not on the disk.'],
			conclusion: 'The file was not saved.'
		},
		idea: 'From a conditional and the negation of its consequent, conclude the negation of its antecedent.'
	},
	{
		id: 'hypothetical-syllogism',
		name: 'Hypothetical syllogism',
		aka: 'chain rule, transitivity',
		premises: ['p → q', 'q → r'],
		conclusion: 'p → r',
		english: {
			premises: ['If it snows, the roads are icy.', 'If the roads are icy, the bus is late.'],
			conclusion: 'If it snows, the bus is late.'
		},
		idea: 'Two conditionals that link up chain into one.'
	},
	{
		id: 'disjunctive-syllogism',
		name: 'Disjunctive syllogism',
		aka: 'elimination',
		premises: ['p ∨ q', '¬p'],
		conclusion: 'q',
		english: {
			premises: ['The key is in my coat or in my bag.', 'It is not in my coat.'],
			conclusion: 'It is in my bag.'
		},
		idea: 'Rule out one side of an OR and the other side must hold.'
	},
	{
		id: 'addition',
		name: 'Addition',
		aka: 'disjunction introduction',
		premises: ['p'],
		conclusion: 'p ∨ q',
		english: {
			premises: ['It is Tuesday.'],
			conclusion: 'It is Tuesday or it is raining.'
		},
		idea: 'Anything true stays true with an OR attached, whatever the other side says.'
	},
	{
		id: 'simplification',
		name: 'Simplification',
		aka: 'conjunction elimination',
		premises: ['p ∧ q'],
		conclusion: 'p',
		english: {
			premises: ['The shop is open and it sells bread.'],
			conclusion: 'The shop is open.'
		},
		idea: 'If both parts of an AND are true, each part is true on its own.'
	},
	{
		id: 'conjunction',
		name: 'Conjunction',
		aka: 'conjunction introduction',
		premises: ['p', 'q'],
		conclusion: 'p ∧ q',
		english: {
			premises: ['The door is locked.', 'The alarm is set.'],
			conclusion: 'The door is locked and the alarm is set.'
		},
		idea: 'Two statements that are each true can be joined with AND.'
	},
	{
		id: 'resolution',
		name: 'Resolution',
		premises: ['p ∨ q', '¬p ∨ r'],
		conclusion: 'q ∨ r',
		english: {
			premises: ['It is raining or it is sunny.', 'It is not raining or I take an umbrella.'],
			conclusion: 'It is sunny or I take an umbrella.'
		},
		idea: 'Two ORs that disagree about p cancel it out. This one rule drives automated theorem provers and SAT solvers.'
	},
	{
		id: 'constructive-dilemma',
		name: 'Constructive dilemma',
		premises: ['p → q', 'r → s', 'p ∨ r'],
		conclusion: 'q ∨ s',
		english: {
			premises: ['If I take the train, I read.', 'If I drive, I listen to the radio.', 'I take the train or I drive.'],
			conclusion: 'I read or I listen to the radio.'
		},
		idea: 'Two conditionals and an OR of their antecedents give an OR of their consequents.'
	},
	{
		id: 'destructive-dilemma',
		name: 'Destructive dilemma',
		premises: ['p → q', 'r → s', '¬q ∨ ¬s'],
		conclusion: '¬p ∨ ¬r',
		english: {
			premises: [
				'If the server is up, the page loads.',
				'If the cache is warm, the page is fast.',
				'The page does not load or it is not fast.'
			],
			conclusion: 'The server is not up or the cache is not warm.'
		},
		idea: 'Modus tollens applied to two conditionals at once.'
	}
];

export type Fallacy = Rule & { mistakenFor: string };

export const fallacies: Fallacy[] = [
	{
		id: 'affirming-the-consequent',
		name: 'Affirming the consequent',
		premises: ['p → q', 'q'],
		conclusion: 'p',
		english: {
			premises: ['If it rained, the grass is wet.', 'The grass is wet.'],
			conclusion: 'It rained.'
		},
		idea: 'The grass could be wet from a sprinkler: q can be true for reasons other than p.',
		mistakenFor: 'modus ponens'
	},
	{
		id: 'denying-the-antecedent',
		name: 'Denying the antecedent',
		premises: ['p → q', '¬p'],
		conclusion: '¬q',
		english: {
			premises: ['If it rained, the grass is wet.', 'It did not rain.'],
			conclusion: 'The grass is not wet.'
		},
		idea: 'The conditional says nothing about what happens when p is false.',
		mistakenFor: 'modus tollens'
	},
	{
		id: 'affirming-a-disjunct',
		name: 'Affirming a disjunct',
		premises: ['p ∨ q', 'p'],
		conclusion: '¬q',
		english: {
			premises: ['She speaks French or she speaks Spanish.', 'She speaks French.'],
			conclusion: 'She does not speak Spanish.'
		},
		idea: 'The OR of logic is inclusive, so both sides can be true.',
		mistakenFor: 'disjunctive syllogism'
	}
];

// --- a worked proof -------------------------------------------------------------

export type ProofLine = {
	statement: string;
	/** "premise", a rule id, or the name of a law used to rewrite a line. */
	rule: string;
	/** Line numbers (from 1) the rule is applied to, in the rule's premise order. */
	from: number[];
};

export const proof = {
	key: [
		{ letter: 't', means: 'the train is running' },
		{ letter: 'b', means: 'I take the bus' },
		{ letter: 's', means: 'it is snowing' },
		{ letter: 'l', means: 'I am late' },
		{ letter: 'c', means: 'I call ahead' }
	],
	english: [
		'The train is running or I take the bus.',
		'It is snowing and the train is not running.',
		'If I take the bus, I am late.',
		'If I am late, I call ahead.'
	],
	englishConclusion: 'I call ahead, and it is snowing.',
	conclusion: 'c ∧ s',
	lines: [
		{ statement: 't ∨ b', rule: 'premise', from: [] },
		{ statement: 's ∧ ¬t', rule: 'premise', from: [] },
		{ statement: 'b → l', rule: 'premise', from: [] },
		{ statement: 'l → c', rule: 'premise', from: [] },
		{ statement: '¬t ∧ s', rule: 'commutative', from: [2] },
		{ statement: '¬t', rule: 'simplification', from: [5] },
		{ statement: 'b', rule: 'disjunctive-syllogism', from: [1, 6] },
		{ statement: 'b → c', rule: 'hypothetical-syllogism', from: [3, 4] },
		{ statement: 'c', rule: 'modus-ponens', from: [8, 7] },
		{ statement: 's', rule: 'simplification', from: [2] },
		{ statement: 'c ∧ s', rule: 'conjunction', from: [9, 10] }
	] as ProofLine[]
};

/** What a proof step may cite: a rule of inference, or a law read either way. */
export function stepForms(cited: string): { name: string; forms: Pick<Rule, 'premises' | 'conclusion'>[] } | null {
	const rule = rules.find((r) => r.id === cited);
	if (rule) return { name: rule.name, forms: [rule] };
	const law = [...basicLaws, ...conditionalLaws, ...biconditionalLaws].find((l) => l.name.toLowerCase() === cited);
	if (!law) return null;
	return {
		name: `${law.name} law`,
		forms: law.pairs.flatMap(([a, b]) => [
			{ premises: [a], conclusion: b },
			{ premises: [b], conclusion: a }
		])
	};
}

// --- matching a step against a rule's form -----------------------------------

/**
 * Tries to read `actual` as an instance of `pattern`, where each letter of the
 * pattern may stand for any statement. Letters already bound must match the
 * same statement again.
 */
function match(pattern: Prop, actual: Prop, bound: Map<string, string>): boolean {
	if (pattern.t === 'var') {
		const text = formatProp(actual);
		const seen = bound.get(pattern.name);
		if (seen !== undefined) return seen === text;
		bound.set(pattern.name, text);
		return true;
	}
	if (pattern.t !== actual.t) return false;
	if (pattern.t === 'const') return actual.t === 'const' && pattern.v === actual.v;
	if (pattern.t === 'not') return actual.t === 'not' && match(pattern.a, actual.a, bound);
	if (actual.t === 'const' || actual.t === 'not') return false;
	return match(pattern.a, actual.a, bound) && match(pattern.b, actual.b, bound);
}

/**
 * True when the premises and conclusion, in that order, have the rule's form:
 * one substitution of statements for the rule's letters turns the rule into
 * exactly this step.
 */
export function isInstanceOf(rule: Pick<Rule, 'premises' | 'conclusion'>, premises: string[], conclusion: string) {
	if (rule.premises.length !== premises.length) return false;
	const bound = new Map<string, string>();
	const pairs: [string, string][] = rule.premises.map((p, i) => [p, premises[i]]);
	pairs.push([rule.conclusion, conclusion]);
	return pairs.every(([pattern, actual]) => match(parseProp(pattern), parseProp(actual), bound));
}

// --- the laws of logic ---------------------------------------------------------

export type Law = { name: string; pairs: [string, string][]; note?: string };

export const basicLaws: Law[] = [
	{
		name: 'Identity',
		pairs: [
			['p ∧ ⊤', 'p'],
			['p ∨ ⊥', 'p']
		]
	},
	{
		name: 'Domination',
		pairs: [
			['p ∨ ⊤', '⊤'],
			['p ∧ ⊥', '⊥']
		]
	},
	{
		name: 'Idempotent',
		pairs: [
			['p ∨ p', 'p'],
			['p ∧ p', 'p']
		]
	},
	{ name: 'Double negation', pairs: [['¬¬p', 'p']] },
	{
		name: 'Commutative',
		pairs: [
			['p ∨ q', 'q ∨ p'],
			['p ∧ q', 'q ∧ p']
		]
	},
	{
		name: 'Associative',
		pairs: [
			['(p ∨ q) ∨ r', 'p ∨ (q ∨ r)'],
			['(p ∧ q) ∧ r', 'p ∧ (q ∧ r)']
		]
	},
	{
		name: 'Distributive',
		pairs: [
			['p ∨ (q ∧ r)', '(p ∨ q) ∧ (p ∨ r)'],
			['p ∧ (q ∨ r)', '(p ∧ q) ∨ (p ∧ r)']
		]
	},
	{
		name: "De Morgan's",
		pairs: [
			['¬(p ∧ q)', '¬p ∨ ¬q'],
			['¬(p ∨ q)', '¬p ∧ ¬q']
		]
	},
	{
		name: 'Absorption',
		pairs: [
			['p ∨ (p ∧ q)', 'p'],
			['p ∧ (p ∨ q)', 'p']
		]
	},
	{
		name: 'Negation',
		pairs: [
			['p ∨ ¬p', '⊤'],
			['p ∧ ¬p', '⊥']
		]
	}
];

export const conditionalLaws: Law[] = [
	{ name: 'Material implication', pairs: [['p → q', '¬p ∨ q']] },
	{ name: 'Contraposition', pairs: [['p → q', '¬q → ¬p']] },
	{ name: 'OR as a conditional', pairs: [['p ∨ q', '¬p → q']] },
	{ name: 'AND as a conditional', pairs: [['p ∧ q', '¬(p → ¬q)']] },
	{ name: 'Negated conditional', pairs: [['¬(p → q)', 'p ∧ ¬q']] },
	{ name: 'Common antecedent, AND', pairs: [['(p → q) ∧ (p → r)', 'p → q ∧ r']] },
	{ name: 'Common consequent, AND', pairs: [['(p → r) ∧ (q → r)', 'p ∨ q → r']] },
	{ name: 'Common antecedent, OR', pairs: [['(p → q) ∨ (p → r)', 'p → q ∨ r']] },
	{ name: 'Common consequent, OR', pairs: [['(p → r) ∨ (q → r)', 'p ∧ q → r']] },
	{ name: 'Exportation', pairs: [['p ∧ q → r', 'p → (q → r)']] }
];

export const biconditionalLaws: Law[] = [
	{ name: 'Two conditionals', pairs: [['p ↔ q', '(p → q) ∧ (q → p)']] },
	{ name: 'Negating both sides', pairs: [['p ↔ q', '¬p ↔ ¬q']] },
	{ name: 'Both or neither', pairs: [['p ↔ q', '(p ∧ q) ∨ (¬p ∧ ¬q)']] },
	{ name: 'Negated biconditional', pairs: [['¬(p ↔ q)', 'p ↔ ¬q']] },
	{ name: 'Negated biconditional as XOR', pairs: [['¬(p ↔ q)', 'p ⊕ q']] }
];

/** Pairs that look like laws and are not, each with the engine's counterexample. */
export const nonLaws: { left: string; right: string; why: string }[] = [
	{ left: 'p → q', right: 'q → p', why: 'A conditional is not the same as its converse.' },
	{ left: '(p → q) → r', right: 'p → (q → r)', why: 'The conditional is not associative, so brackets matter.' },
	{ left: '¬(p ∧ q)', right: '¬p ∧ ¬q', why: 'The negation has to flip the ∧ to ∨ as well (De Morgan).' },
	{ left: '¬(p → q)', right: '¬p → ¬q', why: 'Negating a conditional does not give its inverse.' }
];

// --- tautologies ----------------------------------------------------------------

export const famousTautologies: { name: string; statement: string }[] = [
	{ name: 'Law of excluded middle', statement: 'p ∨ ¬p' },
	{ name: 'Law of non-contradiction', statement: '¬(p ∧ ¬p)' },
	{ name: 'Law of identity', statement: 'p → p' },
	{ name: 'Double negation', statement: '¬¬p ↔ p' },
	{ name: 'Modus ponens', statement: '(p → q) ∧ p → q' },
	{ name: 'Modus tollens', statement: '(p → q) ∧ ¬q → ¬p' },
	{ name: 'Hypothetical syllogism', statement: '(p → q) ∧ (q → r) → (p → r)' },
	{ name: 'Contraposition', statement: '(p → q) ↔ (¬q → ¬p)' },
	{ name: "De Morgan's law", statement: '¬(p ∧ q) ↔ ¬p ∨ ¬q' },
	{ name: 'Principle of explosion', statement: 'p ∧ ¬p → q' },
	{ name: "Peirce's law", statement: '((p → q) → p) → p' }
];

export const classificationExamples: string[] = ['p ∨ ¬p', 'p ∧ ¬p', 'p → q', '(p → q) ↔ (p ∧ ¬q)', 'p ∧ q → p ∨ q'];

/** Proofs of equivalence by a chain of laws: each line is equivalent to the one before. */
export const equivalenceChains: { title: string; steps: { statement: string; law: string }[] }[] = [
	{
		title: 'Show that (p → q) ∧ (p → ¬q) ≡ ¬p',
		steps: [
			{ statement: '(p → q) ∧ (p → ¬q)', law: '' },
			{ statement: '(¬p ∨ q) ∧ (¬p ∨ ¬q)', law: 'Material implication, twice' },
			{ statement: '¬p ∨ (q ∧ ¬q)', law: 'Distributive law' },
			{ statement: '¬p ∨ ⊥', law: 'Negation law' },
			{ statement: '¬p', law: 'Identity law' }
		]
	},
	{
		title: 'Show that p ∧ q → p ∨ q is a tautology',
		steps: [
			{ statement: 'p ∧ q → p ∨ q', law: '' },
			{ statement: '¬(p ∧ q) ∨ (p ∨ q)', law: 'Material implication' },
			{ statement: '(¬p ∨ ¬q) ∨ (p ∨ q)', law: "De Morgan's law" },
			{ statement: '(p ∨ ¬p) ∨ (q ∨ ¬q)', law: 'Associative and commutative laws' },
			{ statement: '⊤ ∨ ⊤', law: 'Negation law' },
			{ statement: '⊤', law: 'Domination law' }
		]
	}
];
