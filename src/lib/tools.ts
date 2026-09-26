// One list of the tools, used by the hub page, the nav and the sitemap check.
export type Tool = {
	href: string;
	name: string;
	blurb: string;
	/** Short label for tight spaces like the nav. */
	short: string;
	group: ToolGroup;
};

/** The hub page lists the tools under these headings, in this order. */
export const toolGroups = [
	{ id: 'circuits', name: 'Boolean algebra and circuits' },
	{ id: 'logic', name: 'Logic statements and sets' },
	{ id: 'numbers', name: 'Numbers and binary arithmetic' },
	{ id: 'text', name: 'Text and encodings' }
] as const;

export type ToolGroup = typeof toolGroups[number]['id'];

export const tools: Tool[] = [
	{
		href: '/truth-table-generator',
		group: 'circuits',
		name: 'Truth table generator',
		short: 'Truth tables',
		blurb:
			'Type an expression, or several for a multi-output circuit, and get the full truth table, plus the tables of all seven basic gates.'
	},
	{
		href: '/propositional-logic-truth-table',
		group: 'logic',
		name: 'Logic statement truth tables',
		short: 'Logic statements',
		blurb:
			'Truth tables for p → q, ↔ and ¬ with every step shown, plus tautology, equivalence and argument validity checks.'
	},
	{
		href: '/boolean-algebra-calculator',
		group: 'circuits',
		name: 'Boolean algebra calculator',
		short: 'Boolean algebra',
		blurb: 'Simplify to an irredundant sum of products, or check whether two expressions are equivalent.'
	},
	{
		href: '/karnaugh-map-solver',
		group: 'circuits',
		name: 'Karnaugh map solver',
		short: 'Karnaugh maps',
		blurb: 'Draws the K-map with every group highlighted, for two to six variables.'
	},
	{
		href: '/sum-of-products-calculator',
		group: 'circuits',
		name: 'Sum of products calculator',
		short: 'SOP and POS',
		blurb: 'Minterms, maxterms, and all four forms: canonical and minimal, SOP and POS.'
	},
	{
		href: '/nand-nor-converter',
		group: 'circuits',
		name: 'NAND and NOR converter',
		short: 'NAND / NOR',
		blurb: 'Rewrite any expression using only NAND gates, or only NOR gates, with the gate count.'
	},
	{
		href: '/logic-circuit-generator',
		group: 'circuits',
		name: 'Circuit diagram generator',
		short: 'Circuit diagrams',
		blurb:
			'Draws one expression, or several outputs at once, as a gate diagram you can click through, with live signal colours.'
	},
	{
		href: '/worksheet',
		group: 'circuits',
		name: 'Worksheet generator',
		short: 'Worksheets',
		blurb: 'A printable set of questions with an answer key, rebuilt from the number in the link.'
	},
	{
		href: '/binary-converter',
		group: 'numbers',
		name: 'Binary converter',
		short: 'Binary',
		blurb: "Decimal, binary, hex and octal at a fixed width, with two's complement and BCD."
	},
	{
		href: '/gray-code-converter',
		group: 'numbers',
		name: 'Gray code converter',
		short: 'Gray code',
		blurb: 'Convert between binary and Gray code, with the full sequence for any width.'
	},
	{
		href: '/logical-equivalence-calculator',
		name: 'Logical equivalence calculator',
		short: 'Equivalence proofs',
		group: 'logic',
		blurb:
			'Step-by-step proofs that two logic statements are equivalent, one named law per line, or a counterexample when they are not.'
	},
	{
		href: '/expression-tree',
		name: 'Expression tree generator',
		short: 'Expression trees',
		group: 'logic',
		blurb: "Draw the parse tree of a logic expression and see every part's value for any row of its truth table."
	},
	{
		href: '/venn-diagram-generator',
		name: 'Venn diagram generator',
		short: 'Venn diagrams',
		group: 'logic',
		blurb: 'Shade any set expression of up to three sets, or click regions to get the expression, with the truth table.'
	},
	{
		href: '/hex-to-decimal',
		name: 'Hex to decimal converter',
		short: 'Hex to decimal',
		group: 'numbers',
		blurb: 'Hex to decimal and back, with the place-value sum and the repeated division written out.'
	},
	{
		href: '/hex-to-binary',
		name: 'Hex to binary converter',
		short: 'Hex to binary',
		group: 'numbers',
		blurb: 'Hex to binary and back, nibble by nibble, and octal in groups of three bits.'
	},
	{
		href: '/binary-calculator',
		name: 'Binary calculator',
		short: 'Binary maths',
		group: 'numbers',
		blurb: 'Add, subtract, multiply and divide in binary with every carry and borrow shown, plus bitwise operations.'
	},
	{
		href: '/hex-calculator',
		name: 'Hex calculator',
		short: 'Hex maths',
		group: 'numbers',
		blurb: 'Hex arithmetic with column working, carries at 16, and the full hex addition table.'
	},
	{
		href: '/ieee-754-converter',
		name: 'IEEE 754 converter',
		short: 'Floating point',
		group: 'numbers',
		blurb:
			'Decimal to float and double bits: sign, exponent and fraction, the exact value stored and the rounding error.'
	},
	{
		href: '/binary-translator',
		name: 'Binary translator',
		short: 'Binary text',
		group: 'text',
		blurb: 'Text to binary and binary to text, with each character broken down into its code point and UTF-8 bytes.'
	},
	{
		href: '/ascii-table',
		name: 'ASCII table',
		short: 'ASCII',
		group: 'text',
		blurb: 'All 128 ASCII codes in decimal, hex and binary, with the control characters named and explained.'
	},
	{
		href: '/base64',
		name: 'Base64 encode and decode',
		short: 'Base64',
		group: 'text',
		blurb: 'Encode text to Base64 or decode it, with every 3 bytes shown becoming 4 characters, bit by bit.'
	}
];

const WORDS = [
	'zero',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve',
	'thirteen',
	'fourteen',
	'fifteen',
	'sixteen',
	'seventeen',
	'eighteen',
	'nineteen',
	'twenty'
];
const TENS = ['', '', 'twenty', 'thirty', 'forty'];

/** The number of tools as a word, so copy that counts them cannot drift from the list. */
export function toolCount(): string {
	const n = tools.length;
	if (n < WORDS.length) return WORDS[n];
	const tens = TENS[Math.floor(n / 10)];
	return n % 10 ? `${tens}-${WORDS[n % 10]}` : tens;
}
