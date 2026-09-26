// The laws, notations, proofs and worked examples on the De Morgan page. Every
// identity is checked by the engines in the test suite, and every step of a
// derivation against its starting point, so a derivation that quietly changes
// the function cannot be published.

export type DerivationStep = {
	/** The expression after this step, in the engine's math notation. */
	expression: string;
	/** The rule that got here; empty for the starting point. */
	rule: string;
};

export type Derivation = {
	id: string;
	title: string;
	/** What the example shows, in one line. */
	why: string;
	steps: DerivationStep[];
};

export type DemorganLaw = {
	id: string;
	name: string;
	left: string;
	right: string;
	words: string;
	gate: string;
};

const NARY_VARIABLES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const WIDTHS = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/**
 * The law for n terms, written out: ¬(a ∧ b ∧ c) = ¬a ∨ ¬b ∨ ¬c and its OR
 * twin. Generated rather than typed, so the page and the tests can ask for
 * any width the engine can tabulate, up to eight.
 */
export function naryLaw(n: number, op: 'and' | 'or'): DemorganLaw {
	const variables = NARY_VARIABLES.slice(0, n);
	const [inner, outer] = op === 'and' ? [' ∧ ', ' ∨ '] : [' ∨ ', ' ∧ '];
	const [gate, other] = op === 'and' ? ['NAND', 'OR'] : ['NOR', 'AND'];
	const width = WIDTHS[n];
	return {
		id: `${op}-${n}`,
		name: `${width[0].toUpperCase()}${width.slice(1)} variables`,
		left: `¬(${variables.join(inner)})`,
		right: variables.map((v) => `¬${v}`).join(outer),
		words:
			op === 'and'
				? 'The same rule with any number of terms: negate each one and swap every operator.'
				: 'Likewise for OR, however long the chain.',
		gate: `A ${width} input ${gate} is a ${width} input ${other} with every input inverted.`
	};
}

export const demorganLaws: DemorganLaw[] = [
	{
		id: 'and',
		name: 'First law',
		left: '¬(a ∧ b)',
		right: '¬a ∨ ¬b',
		words: 'The negation of an AND is the OR of the negations.',
		gate: 'A NAND gate is an OR gate with both inputs inverted.'
	},
	{
		id: 'or',
		name: 'Second law',
		left: '¬(a ∨ b)',
		right: '¬a ∧ ¬b',
		words: 'The negation of an OR is the AND of the negations.',
		gate: 'A NOR gate is an AND gate with both inputs inverted.'
	},
	naryLaw(3, 'and'),
	naryLaw(3, 'or'),
	naryLaw(4, 'and'),
	naryLaw(4, 'or')
];

/**
 * The two laws as each field writes them. The set theory row is read by the
 * set engine in the tests and every other row by the boolean engine. In the
 * overbar row, braces mark the text under a bar: {A · B} is A · B with a line
 * over it.
 */
export type LawNotation = {
	id: string;
	name: string;
	kind: 'boolean' | 'overbar' | 'set';
	first: [string, string];
	second: [string, string];
};

export const demorganNotations: LawNotation[] = [
	{ id: 'logic', name: 'Logic', kind: 'boolean', first: ['¬(A ∧ B)', '¬A ∨ ¬B'], second: ['¬(A ∨ B)', '¬A ∧ ¬B'] },
	{
		id: 'overbar',
		name: 'Boolean, overbar',
		kind: 'overbar',
		first: ['{A · B}', '{A} + {B}'],
		second: ['{A + B}', '{A} · {B}']
	},
	{
		id: 'prime',
		name: 'Boolean, prime',
		kind: 'boolean',
		first: ["(AB)'", "A' + B'"],
		second: ["(A + B)'", "A'B'"]
	},
	{
		id: 'code',
		name: 'C, Java, JS',
		kind: 'boolean',
		first: ['!(a && b)', '!a || !b'],
		second: ['!(a || b)', '!a && !b']
	},
	{
		id: 'python',
		name: 'Python',
		kind: 'boolean',
		first: ['not (a and b)', 'not a or not b'],
		second: ['not (a or b)', 'not a and not b']
	},
	{ id: 'sets', name: 'Set theory', kind: 'set', first: ['(A ∩ B)ᶜ', 'Aᶜ ∪ Bᶜ'], second: ['(A ∪ B)ᶜ', 'Aᶜ ∩ Bᶜ'] }
];

/** Splits overbar text into runs, marking the ones drawn under a bar. */
export const overbarRuns = (text: string) =>
	text
		.split(/(\{[^}]*\})/)
		.filter(Boolean)
		.map((run) => {
			if (!run.startsWith('{')) return { text: run, bar: false, group: false };
			const inner = run.slice(1, -1);
			// A bar over several symbols negates them together, so a screen reader
			// has to hear "not (A · B)": "not A · B" is the very mistake the laws
			// are about.
			return { text: inner, bar: true, group: inner.replace(/\s/g, '').length > 1 };
		});

/** The same overbar text in prime notation, which the boolean engine reads. */
export const overbarToPrime = (text: string) => text.replace(/\{([^}]*)\}/g, "($1)'");

/**
 * The laws drawn as gates. A drawing is fully described by its shape and
 * where its bubbles are, so the tests rebuild each drawing's expression from
 * those alone and check it against the law it illustrates.
 */
export type BubbledGate = {
	shape: 'and' | 'or';
	inputBubbles: boolean;
	outputBubble: boolean;
	name: string;
};

export const demorganGates: { law: string; left: BubbledGate; right: BubbledGate }[] = [
	{
		law: 'and',
		left: { shape: 'and', inputBubbles: false, outputBubble: true, name: 'NAND' },
		right: { shape: 'or', inputBubbles: true, outputBubble: false, name: 'OR with inverted inputs' }
	},
	{
		law: 'or',
		left: { shape: 'or', inputBubbles: false, outputBubble: true, name: 'NOR' },
		right: { shape: 'and', inputBubbles: true, outputBubble: false, name: 'AND with inverted inputs' }
	}
];

/** What a drawn gate computes, read off its shape and bubbles. */
export function bubbledExpression(gate: BubbledGate): string {
	const inputs = gate.inputBubbles ? ['¬a', '¬b'] : ['a', 'b'];
	const body = inputs.join(gate.shape === 'and' ? ' ∧ ' : ' ∨ ');
	return gate.outputBubble ? `¬(${body})` : body;
}

/**
 * The algebraic proof of the first law. ¬a ∨ ¬b is the complement of a ∧ b
 * if the two OR to 1 and AND to 0, and a value has only one complement.
 * Each chain is checked step by step in the tests, and must end on `result`.
 */
export const demorganProof: (Derivation & { result: '0' | '1' })[] = [
	{
		id: 'proof-or',
		title: 'Together they cover every case',
		why: 'OR the two sides. If the result is always 1, no row is missing from both.',
		result: '1',
		steps: [
			{ expression: '(a ∧ b) ∨ (¬a ∨ ¬b)', rule: '' },
			{ expression: '(a ∨ ¬a ∨ ¬b) ∧ (b ∨ ¬a ∨ ¬b)', rule: 'Distributive law: OR over AND' },
			{ expression: '(1 ∨ ¬b) ∧ (1 ∨ ¬a)', rule: 'Complement: a ∨ ¬a = 1 and b ∨ ¬b = 1' },
			{ expression: '1 ∧ 1', rule: 'Annulment: 1 ∨ x = 1' },
			{ expression: '1', rule: 'Identity' }
		]
	},
	{
		id: 'proof-and',
		title: 'They never overlap',
		why: 'AND the two sides. If the result is always 0, no row is in both.',
		result: '0',
		steps: [
			{ expression: '(a ∧ b) ∧ (¬a ∨ ¬b)', rule: '' },
			{ expression: '(a ∧ b ∧ ¬a) ∨ (a ∧ b ∧ ¬b)', rule: 'Distributive law: AND over OR' },
			{ expression: '(0 ∧ b) ∨ (a ∧ 0)', rule: 'Complement: a ∧ ¬a = 0 and b ∧ ¬b = 0' },
			{ expression: '0 ∨ 0', rule: 'Annulment: 0 ∧ x = 0' },
			{ expression: '0', rule: 'Identity' }
		]
	}
];

/** The step by step example: De Morgan first, then the ordinary laws finish it. */
export const demorganWalkthrough: Derivation = {
	id: 'step-by-step',
	title: 'Simplify ¬(a ∨ ¬b) ∨ ¬(a ∨ b)',
	why: 'Two negated brackets. Clear them with De Morgan, and the rest falls out.',
	steps: [
		{ expression: '¬(a ∨ ¬b) ∨ ¬(a ∨ b)', rule: '' },
		{ expression: '(¬a ∧ ¬¬b) ∨ (¬a ∧ ¬b)', rule: 'De Morgan on each bracket: negate every term, OR becomes AND' },
		{ expression: '(¬a ∧ b) ∨ (¬a ∧ ¬b)', rule: 'Double negation: ¬¬b is b' },
		{ expression: '¬a ∧ (b ∨ ¬b)', rule: 'Distributive law, taking out the common ¬a' },
		{ expression: '¬a ∧ 1', rule: 'Complement: b ∨ ¬b = 1' },
		{ expression: '¬a', rule: 'Identity: x ∧ 1 = x' }
	]
};

/**
 * The usual ways the laws go wrong. The tests check that each wrong form
 * differs from the original on at least one row, and each right form matches.
 */
export const demorganMistakes = [
	{
		id: 'operator',
		title: 'Forgetting to flip the operator',
		original: '¬(a ∧ b)',
		wrong: '¬a ∧ ¬b',
		right: '¬a ∨ ¬b',
		why: 'The NOT goes onto every term, and the AND must become an OR at the same time.'
	},
	{
		id: 'some-terms',
		title: 'Negating only some of the terms',
		original: '¬(a ∨ b)',
		wrong: '¬a ∧ b',
		right: '¬a ∧ ¬b',
		why: 'Every term inside the bracket gets a NOT, not only the first.'
	},
	{
		id: 'partial-bar',
		title: 'Breaking the bar only partway',
		original: '¬(a ∧ b ∧ c)',
		wrong: '¬a ∨ ¬b ∧ ¬c',
		right: '¬a ∨ ¬b ∨ ¬c',
		why: 'When the bar breaks, it breaks over every operator beneath it. Swap one AND and leave the other, and the function changes.'
	},
	{
		id: 'grouping',
		title: 'Losing the grouping inside the bracket',
		original: '¬(a ∨ b ∧ c)',
		wrong: '¬a ∧ ¬b ∨ ¬c',
		right: '¬a ∧ (¬b ∨ ¬c)',
		why: 'AND binds tighter than OR, so the bracket holds a ∨ (b ∧ c): two terms, not three. Apply the law to the OR, then to the inner AND, and keep the bracket the swap creates.'
	}
];

export const demorganExamples: Derivation[] = [
	{
		id: 'negated-and',
		title: 'A NOT over an AND',
		why: 'The basic move, followed by the tidy-up that nearly always comes with it.',
		steps: [
			{ expression: '¬(a ∧ ¬b)', rule: '' },
			{ expression: '¬a ∨ ¬¬b', rule: 'De Morgan: negate each term, AND becomes OR' },
			{ expression: '¬a ∨ b', rule: 'Double negation: ¬¬b is b' }
		]
	},
	{
		id: 'negated-or',
		title: 'A NOT over a longer OR',
		why: 'With three terms the rule is the same: every term is negated and every operator is swapped.',
		steps: [
			{ expression: '¬(a ∨ ¬b ∨ c)', rule: '' },
			{ expression: '¬a ∧ ¬¬b ∧ ¬c', rule: 'De Morgan: negate each term, OR becomes AND' },
			{ expression: '¬a ∧ b ∧ ¬c', rule: 'Double negation' }
		]
	},
	{
		id: 'nested',
		title: 'Nested brackets, outside in',
		why: 'Apply the law to the outermost NOT first. The inner bracket comes along as one term, and gets its own turn.',
		steps: [
			{ expression: '¬((a ∧ b) ∨ c)', rule: '' },
			{ expression: '¬(a ∧ b) ∧ ¬c', rule: 'De Morgan on the outer OR; the bracket is a single term' },
			{ expression: '(¬a ∨ ¬b) ∧ ¬c', rule: 'De Morgan on the inner AND' }
		]
	},
	{
		id: 'complement',
		title: 'The complement of a function',
		why: 'Negating a sum of products gives a product of sums. This is how you write ¬F when you already have F.',
		steps: [
			{ expression: '¬((a ∧ b) ∨ (¬a ∧ c))', rule: '' },
			{ expression: '¬(a ∧ b) ∧ ¬(¬a ∧ c)', rule: 'De Morgan on the OR' },
			{ expression: '(¬a ∨ ¬b) ∧ (¬¬a ∨ ¬c)', rule: 'De Morgan on each AND' },
			{ expression: '(¬a ∨ ¬b) ∧ (a ∨ ¬c)', rule: 'Double negation' }
		]
	},
	{
		id: 'nand-or',
		title: 'An OR gate from NAND gates',
		why: 'Read backwards, the law turns an OR into a NAND with inverted inputs, which is how NAND builds everything.',
		steps: [
			{ expression: 'a ∨ b', rule: '' },
			{ expression: '¬¬(a ∨ b)', rule: 'Double negation, added on purpose' },
			{ expression: '¬(¬a ∧ ¬b)', rule: 'De Morgan on the inner NOT: one NAND fed by two inverters' }
		]
	},
	{
		id: 'simplify',
		title: 'Clearing a negated bracket before simplifying',
		why: 'Simplification needs the NOTs on single variables. De Morgan pushes them there; then the ordinary laws apply.',
		steps: [
			{ expression: '¬(¬a ∨ (b ∧ ¬c))', rule: '' },
			{ expression: 'a ∧ ¬(b ∧ ¬c)', rule: 'De Morgan on the OR, with ¬¬a written as a' },
			{ expression: 'a ∧ (¬b ∨ c)', rule: 'De Morgan on the remaining AND' },
			{ expression: '(a ∧ ¬b) ∨ (a ∧ c)', rule: 'Distributive law, into sum of products form' }
		]
	}
];
