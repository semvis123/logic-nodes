// Everything the Ctrl+K palette can jump to. It is built once at build time
// into /search.json, which the palette fetches the first time it opens, so
// none of this is in any page's HTML or script bundle.
import { tools } from '$lib/tools';
import { gates } from '$lib/gates';
import { flipFlops } from '$lib/flipflops';
import { commonCircuits } from '$lib/commonCircuits';
import { allLessons } from '$lib/course/lessons';
import { glossary } from '$lib/glossary';

export type SearchKind = 'Tool' | 'Page' | 'Gate' | 'Flip-flop' | 'Circuit' | 'Lesson' | 'Term';

export type SearchEntry = {
	title: string;
	href: string;
	kind: SearchKind;
	/** One line under the title. */
	hint: string;
	/** Other words people type for this, matched but never shown. */
	keywords?: string;
};

/** The pages that are not tools, each with the words people use for them. */
const pages: Omit<SearchEntry, 'kind'>[] = [
	{ href: '/', title: 'Home', hint: 'Every tool and reference page', keywords: 'start index' },
	{ href: '/tools', title: 'All tools', hint: 'Every calculator and generator, by group' },
	{
		href: '/simulator',
		title: 'Logic gate simulator',
		hint: 'Build a circuit and run it',
		keywords: 'editor circuit simulator logic nodes build'
	},
	{
		href: '/learn',
		title: 'Learn digital logic',
		hint: 'A free course from bits to state machines',
		keywords: 'course lessons tutorial'
	},
	{
		href: '/practice',
		title: 'Practice questions',
		hint: 'Generated questions, marked instantly',
		keywords: 'quiz exercises test'
	},
	{
		href: '/logic-gates',
		title: 'Logic gates',
		hint: 'The seven gates, with symbols and truth tables',
		keywords: 'and or not xor nand nor xnor chart'
	},
	{
		href: '/logic-gate-symbols',
		title: 'Logic gate symbols',
		hint: 'ANSI and IEC symbols side by side',
		keywords: 'shapes ieee distinctive rectangular'
	},
	{
		href: '/de-morgans-laws',
		title: "De Morgan's laws",
		hint: 'Both laws, proved, with worked examples',
		keywords: 'demorgan'
	},
	{
		href: '/boolean-algebra-laws',
		title: 'Boolean algebra laws',
		hint: '28 identities, each proved by truth table',
		keywords: 'rules identities theorems absorption distributive'
	},
	{
		href: '/boolean-algebra-examples',
		title: 'Boolean algebra examples',
		hint: 'Twelve expressions simplified step by step',
		keywords: 'simplification worked'
	},
	{
		href: '/quine-mccluskey',
		title: 'Quine-McCluskey method',
		hint: 'Tabular minimisation, step by step',
		keywords: 'prime implicants petrick tabulation'
	},
	{
		href: '/sr-latch',
		title: 'SR latch',
		hint: 'NOR and NAND latches, gated SR and D latches',
		keywords: 'set reset memory'
	},
	{ href: '/flip-flops', title: 'Flip-flops', hint: 'SR, D, JK and T flip-flops', keywords: 'flipflop clock memory' },
	{
		href: '/counters',
		title: 'Counters',
		hint: 'Ripple and synchronous binary counters',
		keywords: 'ripple counter decade'
	},
	{
		href: '/shift-registers',
		title: 'Shift registers',
		hint: 'SISO, SIPO, PISO, PIPO, ring and Johnson',
		keywords: 'register'
	},
	{
		href: '/finite-state-machines',
		title: 'Finite state machines',
		hint: 'Moore and Mealy, with a worked design',
		keywords: 'fsm state diagram sequence detector'
	},
	{
		href: '/combinational-vs-sequential',
		title: 'Combinational vs sequential logic',
		hint: 'What changes once a circuit has memory'
	},
	{
		href: '/common-circuits',
		title: 'Common circuits',
		hint: 'Adders, multiplexers, decoders, comparators',
		keywords: 'encoder'
	},
	{
		href: '/ripple-carry-adder',
		title: 'Ripple carry adder',
		hint: 'A 4-bit adder, traced column by column',
		keywords: 'carry lookahead adder'
	},
	{
		href: '/seven-segment-decoder',
		title: 'Seven-segment decoder',
		hint: 'BCD to seven-segment, per segment',
		keywords: '7 segment display bcd'
	},
	{
		href: '/twos-complement',
		title: "Two's complement",
		hint: 'Signed binary numbers and overflow',
		keywords: '2s complement signed negative ones complement'
	},
	{
		href: '/logic',
		title: 'Propositional logic',
		hint: 'Connectives, truth tables, proofs and arguments',
		keywords: 'logic statements discrete maths'
	},
	{
		href: '/logic/conditional-statements',
		title: 'Conditional statements',
		hint: 'Converse, inverse and contrapositive',
		keywords: 'if then implication'
	},
	{
		href: '/logic/logical-equivalences',
		title: 'Logical equivalences',
		hint: 'The standard equivalence laws',
		keywords: 'equivalence laws table'
	},
	{
		href: '/logic/rules-of-inference',
		title: 'Rules of inference',
		hint: 'Modus ponens, modus tollens and the rest',
		keywords: 'modus ponens tollens syllogism'
	},
	{
		href: '/logic/tautology',
		title: 'Tautology and contradiction',
		hint: 'Tautologies, contradictions and contingencies',
		keywords: 'contingency'
	},
	{
		href: '/set-notation',
		title: 'Set notation',
		hint: 'Every set symbol, with examples',
		keywords: 'union intersection complement symbols'
	},
	{
		href: '/glossary',
		title: 'Glossary',
		hint: 'Every term on the site, defined',
		keywords: 'dictionary definitions terms'
	}
];

/** Short forms and other names for the tools. */
const toolKeywords: Record<string, string> = {
	'/truth-table-generator': 'truth table calculator',
	'/propositional-logic-truth-table': 'propositional logic truth table p q',
	'/boolean-algebra-calculator': 'simplify simplifier minimize expression',
	'/karnaugh-map-solver': 'kmap k-map k map karnaugh',
	'/sum-of-products-calculator': 'sop pos minterms maxterms canonical product of sums',
	'/nand-nor-converter': 'universal gates',
	'/logic-circuit-generator': 'circuit diagram draw expression schematic',
	'/boolean-function-guesser': 'game puzzle wordle daily guess hidden function',
	'/worksheet': 'printable homework teacher',
	'/binary-converter': 'decimal to binary binary to decimal octal bcd base converter',
	'/gray-code-converter': 'gray code reflected binary',
	'/logical-equivalence-calculator': 'proof prove equivalent',
	'/expression-tree': 'parse tree syntax tree',
	'/venn-diagram-generator': 'venn sets',
	'/hex-to-decimal': 'hexadecimal hex decimal',
	'/hex-to-binary': 'hexadecimal hex binary nibble',
	'/binary-calculator': 'binary addition subtraction multiplication division bitwise',
	'/hex-calculator': 'hexadecimal addition subtraction',
	'/ieee-754-converter': 'floating point float double single precision',
	'/binary-translator': 'text to binary binary to text utf-8',
	'/ascii-table': 'ascii codes characters chart',
	'/base64': 'base 64 b64 encode decode'
};

/** Short names for the common circuits. */
const circuitKeywords: Record<string, string> = {
	multiplexer: 'mux selector',
	demultiplexer: 'demux',
	decoder: 'decoder 2 to 4',
	'decoder-3-to-8': 'decoder 3 to 8',
	comparator: 'magnitude compare',
	'comparator-2-bit': 'magnitude compare',
	parity: 'parity bit even odd',
	majority: 'voter vote'
};

const clip = (text: string, max = 90) =>
	text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max)).replace(/[,;:]$/, '')}…`;

export function searchIndex(): SearchEntry[] {
	return [
		...tools.map((tool) => ({
			title: tool.name,
			href: tool.href,
			kind: 'Tool' as const,
			hint: clip(tool.blurb),
			keywords: toolKeywords[tool.href]
		})),
		...pages.map((page) => ({ ...page, kind: 'Page' as const })),
		...gates.map((gate) => ({
			title: `${gate.name} gate`,
			href: `/logic-gates/${gate.slug}`,
			kind: 'Gate' as const,
			hint: clip(gate.tagline),
			keywords: gate.expression
		})),
		...flipFlops.map((ff) => ({
			title: ff.name,
			href: `/flip-flops/${ff.slug}`,
			kind: 'Flip-flop' as const,
			hint: clip(ff.tagline),
			keywords: ff.shortName
		})),
		...commonCircuits.map((circuit) => ({
			title: circuit.name,
			href: `/common-circuits/${circuit.slug}`,
			kind: 'Circuit' as const,
			hint: clip(circuit.tagline),
			keywords: circuitKeywords[circuit.slug]
		})),
		...allLessons.map((lesson) => ({
			title: lesson.title,
			href: `/learn/${lesson.slug}`,
			kind: 'Lesson' as const,
			hint: clip(lesson.blurb)
		})),
		...glossary.map((entry) => ({
			title: entry.term,
			href: `/glossary#${entry.slug}`,
			kind: 'Term' as const,
			hint: clip(entry.definition)
		}))
	];
}
