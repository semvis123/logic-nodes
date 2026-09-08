// One list of the tools, used by the hub page, the nav and the sitemap check.
export type Tool = {
	href: string;
	name: string;
	blurb: string;
	/** Short label for tight spaces like the nav. */
	short: string;
};

export const tools: Tool[] = [
	{
		href: '/truth-table-generator',
		name: 'Truth table generator',
		short: 'Truth tables',
		blurb: 'Type an expression, get its full truth table, plus the tables of all six basic gates.'
	},
	{
		href: '/boolean-algebra-calculator',
		name: 'Boolean algebra calculator',
		short: 'Boolean algebra',
		blurb: 'Simplify to a minimal sum of products, or check whether two expressions are equivalent.'
	},
	{
		href: '/karnaugh-map-solver',
		name: 'Karnaugh map solver',
		short: 'Karnaugh maps',
		blurb: 'Draws the K-map with every group highlighted, for two to six variables.'
	},
	{
		href: '/sum-of-products-calculator',
		name: 'Sum of products calculator',
		short: 'SOP and POS',
		blurb: 'Minterms, maxterms, and all four forms: canonical and minimal, SOP and POS.'
	},
	{
		href: '/nand-nor-converter',
		name: 'NAND and NOR converter',
		short: 'NAND / NOR',
		blurb: 'Rewrite any expression using only NAND gates, or only NOR gates, with the gate count.'
	},
	{
		href: '/logic-circuit-generator',
		name: 'Circuit diagram generator',
		short: 'Circuit diagrams',
		blurb: 'Draws an expression as a gate diagram you can click through, with live signal colours.'
	},
	{
		href: '/worksheet',
		name: 'Worksheet generator',
		short: 'Worksheets',
		blurb: 'A printable set of questions with an answer key, rebuilt from the number in the link.'
	},
	{
		href: '/gray-code-converter',
		name: 'Gray code converter',
		short: 'Gray code',
		blurb: 'Convert between binary and Gray code, with the full sequence for any width.'
	}
];
