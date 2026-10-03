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
	{ id: 'text', name: 'Text and encodings' },
	{ id: 'dev', name: 'Programming and networking' }
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
	},
	{
		href: '/logic-symbols-copy-paste',
		name: 'Logic symbols to copy and paste',
		short: 'Logic symbols',
		group: 'logic',
		blurb:
			'Copy any logic, boolean or set symbol in one click, as the character, LaTeX, HTML or its Unicode code point.'
	},
	{
		href: '/fp16-bf16-fp8-converter',
		name: 'FP16, BF16, FP8 and FP4 converter',
		short: 'FP16 / FP8',
		group: 'numbers',
		blurb:
			'A decimal in FP16, BF16, FP8 E4M3 and E5M2 and FP4 at once: the bits, the exact value stored, the rounding error and the neighbours.'
	},
	{
		href: '/base36',
		name: 'Base 36 converter',
		short: 'Base 36',
		group: 'numbers',
		blurb:
			'Convert decimal to base 36 and back, or between any two bases from 2 to 36, for numbers of any size, with every division step shown.'
	},
	{
		href: '/guess-my-number',
		name: 'Guess my number',
		short: 'Guess number',
		group: 'numbers',
		blurb:
			'Think of a number and it is found in 7 yes/no questions, one bit each. Then lie once and a Hamming code catches it, or beat an evil opponent.'
	},
	{
		href: '/base32',
		name: 'Base32 encode and decode',
		short: 'Base32',
		group: 'text',
		blurb:
			'Encode or decode Base32 in the RFC 4648, base32hex or Crockford alphabet, with every 5 bytes drawn as 8 characters, bit by bit.'
	},
	{
		href: '/base58',
		name: 'Base58 encode and decode',
		short: 'Base58',
		group: 'text',
		blurb:
			'Encode or decode Base58 with the division by 58 written out, and check the checksum of a Bitcoin address or WIF key.'
	},
	{
		href: '/qr-code-generator',
		name: 'QR code generator',
		short: 'QR code',
		group: 'text',
		blurb:
			'Makes a QR code and takes it apart: every module coloured by its role, each encoding step written out, with SVG and PNG download.'
	},
	{
		href: '/ean-13-barcode-generator',
		name: 'EAN-13 barcode generator',
		short: 'EAN-13',
		group: 'text',
		blurb:
			'Make an EAN-13, UPC-A or EAN-8 barcode with the check digit worked out, and see which L, G or R code draws every digit.'
	},
	{
		href: '/punch-card-generator',
		name: 'Punch card generator and reader',
		short: 'Punch cards',
		group: 'text',
		blurb: 'Punch text onto an 80-column card or a paper tape, or click holes and read what they say.'
	},
	{
		href: '/bitwise-pattern-generator',
		name: 'Bitwise pattern generator',
		short: 'Bit art',
		group: 'numbers',
		blurb: 'Draw x ^ y, x & y and your own expressions as images, and see the bits behind any pixel.'
	},
	{
		href: '/seven-segment-display-designer',
		name: 'Seven-segment and dot-matrix display designer',
		short: 'Displays',
		group: 'circuits',
		blurb: 'Design seven-segment, dot-matrix and Nixie displays and copy the bytes as C, Arduino or Verilog.'
	},
	{
		href: '/subnet-calculator',
		name: 'Subnet calculator',
		short: 'Subnets',
		group: 'dev',
		blurb: 'Network, broadcast and host range from any CIDR or netmask, with the address AND mask drawn bit by bit.'
	},
	{
		href: '/vlsm-calculator',
		name: 'VLSM calculator',
		short: 'VLSM',
		group: 'dev',
		blurb:
			'Plan subnets of different sizes from host counts, packed largest first with free space shown, or split a network evenly.'
	},
	{
		href: '/ipv6-expand-compress',
		name: 'IPv6 expand and compress',
		short: 'IPv6',
		group: 'dev',
		blurb:
			'Expand an IPv6 address to all 32 digits or compress it the RFC 5952 way, with each rule, all 128 bits, the prefix and the address type.'
	},
	{
		href: '/bit-manipulation-tricks',
		name: 'Bit manipulation tricks',
		short: 'Bit tricks',
		group: 'dev',
		blurb:
			'The classic bit hacks, from x & (x - 1) to SWAR popcount and XOR swap, traced bit by bit for your own value at 8, 16 or 32 bits.'
	},
	{
		href: '/integer-limits',
		name: 'Integer limits',
		short: 'Int limits',
		group: 'dev',
		blurb:
			'The min and max of every integer type from int8 to uint128, their names in each language, and an overflow playground.'
	},
	{
		href: '/struct-padding-calculator',
		name: 'Struct padding calculator',
		short: 'Struct padding',
		group: 'dev',
		blurb:
			'Paste a C struct to see every offset and padding byte, sizeof on five ABIs, and a member order that wastes less.'
	},
	{
		href: '/uuid-decoder',
		name: 'UUID decoder and generator',
		short: 'UUID decoder',
		group: 'dev',
		blurb:
			'Paste a UUID, ULID or ObjectId to see its version, variant and timestamp bit by bit, or generate fresh IDs in your browser.'
	},
	{
		href: '/snowflake-id-decoder',
		name: 'Snowflake ID decoder',
		short: 'Snowflake IDs',
		group: 'dev',
		blurb:
			'Turn a Discord or Twitter/X ID into the exact moment it was made, with its worker and sequence bits, or a date into its snowflake range.'
	},
	{
		href: '/file-signature-checker',
		name: 'File signature checker',
		short: 'File signature',
		group: 'dev',
		blurb:
			'Find out what a file really is from its first bytes: the magic number highlighted in a hex dump, and whether the extension tells the truth.'
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
