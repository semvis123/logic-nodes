// The extra columns of the logic gate symbols chart: each gate in overbar
// notation, and what the label inside an IEC rectangle means. Both are checked
// against the expression engine in tests/hubPages.spec.ts, the overbar forms
// by reading them back and the IEC labels by applying their counting rule to
// every row of each gate's truth table.

/** Overbar notation, with braces marking the text under the bar (see demorgan.ts). */
export const overbarForms: Record<string, string> = {
	and: 'a · b',
	or: 'a + b',
	not: '{a}',
	nand: '{a · b}',
	nor: '{a + b}',
	xor: 'a ⊕ b',
	xnor: '{a ⊕ b}'
};

export type IecLabel = {
	label: string;
	name: string;
	/** Completes "the output is 1 when...". */
	meaning: string;
	/** The gates drawn with this label on this site. */
	gates: string[];
	/** The counting rule the label stands for: ones is how many inputs are 1. */
	rule: (ones: number, inputs: number) => boolean;
};

// An IEC label is a count. It says how many inputs have to be 1 for the
// output to be 1, which is why the same few characters cover every gate.
export const iecLabels: IecLabel[] = [
	{
		label: '&',
		name: 'AND',
		meaning: 'every input is 1',
		gates: ['and', 'nand'],
		rule: (ones, inputs) => ones === inputs
	},
	{
		label: '≥1',
		name: 'OR',
		meaning: 'at least one input is 1',
		gates: ['or', 'nor'],
		rule: (ones) => ones >= 1
	},
	{
		label: '=1',
		name: 'Exclusive OR',
		meaning: 'exactly one input is 1',
		gates: ['xor'],
		rule: (ones) => ones === 1
	},
	{
		label: '=',
		name: 'Logic identity',
		meaning: 'all inputs are equal',
		gates: ['xnor'],
		rule: (ones, inputs) => ones === 0 || ones === inputs
	},
	{
		label: '1',
		name: 'Buffer',
		meaning: 'its single input is 1',
		gates: ['not'],
		rule: (ones) => ones === 1
	}
];
