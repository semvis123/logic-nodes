// The worked examples on the simplification page. The derivations themselves
// are produced by the step engine at build time, one named law per line, and
// the test suite checks that every example reaches the minimal form, so the
// page can never show a derivation that stalls.

export type SimplificationExample = {
	id: string;
	title: string;
	/** In the engine's math notation. */
	expression: string;
	/** What the example teaches, in one or two sentences. */
	lesson: string;
};

export const simplificationExamples: SimplificationExample[] = [
	{
		id: 'absorption',
		title: 'A term that adds nothing',
		expression: 'a ∨ a ∧ b',
		lesson:
			'If a is already enough on its own, a ∧ b can never contribute a row that a does not. This is absorption, and it is the single most common simplification.'
	},
	{
		id: 'redundant-literal',
		title: 'A literal that cannot matter',
		expression: 'a ∧ (¬a ∨ b)',
		lesson:
			'Inside the bracket, ¬a is dead: the outer a is already required, so ¬a can never be true when the whole expression is. Drop it and the bracket collapses to a ∧ b.'
	},
	{
		id: 'combine-pair',
		title: 'Two terms that differ in one literal',
		expression: 'a ∧ b ∨ a ∧ ¬b',
		lesson:
			'The two terms agree on a and disagree on b, so between them they cover every value of b. That is exactly what a Karnaugh map group of two does; in the laws it takes two moves, redundancy to drop the ¬b and then absorption.'
	},
	{
		id: 'pos-pair',
		title: 'The same trick for a product of sums',
		expression: '(a ∨ b) ∧ (a ∨ ¬b)',
		lesson:
			'The laws are dual: everything that works on an OR of ANDs works on an AND of ORs with the operators swapped. The two brackets differ only in b, so b cancels, by the same two moves as the previous example.'
	},
	{
		id: 'demorgan-nor',
		title: 'A negated bracket',
		expression: '¬(a ∨ b) ∨ ¬a ∧ b',
		lesson:
			'Nothing can be simplified while the NOT sits over a bracket. De Morgan pushes it down onto the variables, and then redundancy and absorption finish the job.'
	},
	{
		id: 'xor-plus-and',
		title: 'An XOR that turns out to be an OR',
		expression: 'a ⊻ b ∨ a ∧ b',
		lesson:
			'XOR is "one but not both"; add back the "both" case and you have "at least one", which is OR. The derivation has to expand the XOR into its definition before the ordinary laws can see that.'
	},
	{
		id: 'three-terms',
		title: 'Three terms down to two',
		expression: 'a ∧ ¬b ∨ a ∧ b ∧ c ∨ ¬a ∧ ¬b',
		lesson:
			'Redundancy is the workhorse here: a term can shed a literal when another term already covers the case that literal rules out. Two rounds of it, then absorption.'
	},
	{
		id: 'consensus',
		title: 'The consensus term',
		expression: 'a ∧ b ∨ ¬a ∧ c ∨ b ∧ c',
		lesson:
			'The term b ∧ c looks necessary and is not: whenever it is true, either a ∧ b or ¬a ∧ c is true as well, depending on a. This is the one people miss by hand and the one a Karnaugh map makes obvious.'
	},
	{
		id: 'pos-to-sop',
		title: 'From a product of sums to a sum of products',
		expression: '(a ∨ b) ∧ (¬a ∨ c) ∧ (b ∨ c)',
		lesson:
			'Multiplying out looks like it will make things worse, and it does at first. Two rounds of it, with redundancy and absorption trimming in between, and then consensus removes the last term. The third bracket was consensus all along.'
	},
	{
		id: 'xor-from-nand',
		title: 'Recognising an XOR',
		expression: '¬(a ∧ b) ∧ (a ∨ b)',
		lesson:
			'"Not both, but at least one" is exactly exclusive or. De Morgan, one distribution and two redundancy steps turn the compact form into the sum of products that the definition of XOR uses.'
	},
	{
		id: 'four-minterms',
		title: 'Four minterms that are one variable',
		expression: '¬a ∧ ¬b ∧ ¬c ∨ ¬a ∧ ¬b ∧ c ∨ a ∧ ¬b ∧ ¬c ∨ a ∧ ¬b ∧ c',
		lesson:
			'Every term has ¬b and between them they cover every combination of a and c, so the whole thing is just ¬b. On a Karnaugh map this is one group of four; by hand it takes a run of redundancy and absorption steps.'
	},
	{
		id: 'tautology',
		title: 'An expression that is always true',
		expression: 'a ∧ ¬b ∨ ¬a ∧ b ∨ a ∧ b ∨ ¬a ∧ ¬b',
		lesson:
			'All four minterms of two variables are present, so the function is 1 on every row. The laws get there by collapsing the terms until a ∨ ¬a appears, and the complement law turns that into 1.'
	}
];
