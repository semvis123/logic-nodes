// The worked examples on the De Morgan page. Every step is checked against the
// one before it in the test suite, so a derivation that quietly changes the
// function cannot be published.

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

export const demorganLaws = [
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
	{
		id: 'and-3',
		name: 'Three variables',
		left: '¬(a ∧ b ∧ c)',
		right: '¬a ∨ ¬b ∨ ¬c',
		words: 'The same rule with any number of terms: negate each one and swap every operator.',
		gate: 'A three input NAND is a three input OR with every input inverted.'
	},
	{
		id: 'or-3',
		name: 'Three variables',
		left: '¬(a ∨ b ∨ c)',
		right: '¬a ∧ ¬b ∧ ¬c',
		words: 'Likewise for OR, however long the chain.',
		gate: 'A three input NOR is a three input AND with every input inverted.'
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
