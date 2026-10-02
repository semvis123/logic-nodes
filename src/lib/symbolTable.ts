// The copy-and-paste table of logic, boolean algebra, set and proof symbols.
// Each symbol is stored once, with the code points typed out next to the glyph
// so the tests can catch a look-alike pasted in by mistake (Δ and ∆, ∅ and Ø
// are different characters). Everything else a reader copies is derived here:
// the numeric HTML references, the Word Alt+X code, and the LaTeX or HTML for a
// whole formula. The named entities and LaTeX commands are data, checked by the
// tests against the browser's HTML parser and a list of real commands.

export type GroupId = 'connectives' | 'quantifiers' | 'proof' | 'boolean' | 'sets' | 'relations';

export type ConceptLink = { href: string; label: string };

export type SymbolEntry = {
	/** Stable id for links and the query string. */
	id: string;
	/** What gets copied as the symbol. */
	glyph: string;
	/** The code points of the glyph, typed out independently of it. */
	codePoints: number[];
	/** How the glyph is shown, when it needs a letter to sit on (the combining overline). */
	display?: string;
	/** The first name is the one shown on the tile. */
	names: string[];
	meaning: string;
	/** The named HTML reference, if HTML has one. */
	entity: string | null;
	/** The LaTeX math mode command, or null when neither base LaTeX nor amssymb has one. */
	latex: string | null;
	/** Set when the command needs \usepackage{amssymb}. */
	amssymb?: boolean;
	/** A second command, or a caveat about how the first one prints. */
	latexNote?: string;
	links: ConceptLink[];
	/** Extra words people search for, beyond the names. */
	keywords?: string;
	/**
	 * Other LaTeX commands and HTML entities for the symbol, and the commands its
	 * note compares it with, so that searching for any of them finds it.
	 */
	aliases?: string[];
	/** Characters drawn almost the same, which a reader may paste by mistake. */
	lookAlikes?: number[];
	/** A shorter name for the tile, when the first name does not fit on it. */
	tile?: string;
};

const gate = (slug: string, name: string): ConceptLink => ({ href: `/logic-gates/${slug}`, label: `${name} gate` });
const setLink = (id: string, label: string): ConceptLink => ({ href: `/set-notation?symbol=${id}`, label });
const conditional: ConceptLink = { href: '/logic/conditional-statements', label: 'Conditional statements' };
const biconditional: ConceptLink = {
	href: '/logic/conditional-statements#biconditional',
	label: 'The biconditional'
};
const inference: ConceptLink = { href: '/logic/rules-of-inference', label: 'Rules of inference' };
const tautology: ConceptLink = { href: '/logic/tautology', label: 'Tautology and contradiction' };
const equivalences: ConceptLink = { href: '/logic/logical-equivalences', label: 'Logical equivalences' };
const laws: ConceptLink = { href: '/boolean-algebra-laws', label: 'Boolean algebra laws' };
const logic: ConceptLink = { href: '/logic', label: 'Propositional logic' };
const setNotation: ConceptLink = { href: '/set-notation', label: 'Set notation' };

export const SYMBOLS: SymbolEntry[] = [
	// --- connectives --------------------------------------------------------
	{
		id: 'not',
		glyph: '¬',
		codePoints: [0xac],
		names: ['Negation', 'not sign', 'logical not'],
		meaning: '¬p, "not p", is true exactly when p is false. The usual negation sign in logic books.',
		entity: '&not;',
		latex: '\\lnot',
		latexNote: '\\neg is the same symbol',
		aliases: ['\\neg'],
		links: [gate('not', 'NOT'), logic],
		keywords: 'not negation negate'
	},
	{
		id: 'tilde',
		glyph: '~',
		codePoints: [0x7e],
		names: ['Tilde', 'negation (plain text)'],
		meaning: '~p means ¬p. It turns up in older textbooks and anywhere only a keyboard is available.',
		entity: null,
		latex: '\\sim',
		latexNote: 'prints the tilde operator ∼ (U+223C); \\textasciitilde gives a text tilde',
		aliases: ['\\textasciitilde'],
		lookAlikes: [0x223c],
		links: [gate('not', 'NOT')],
		keywords: 'not negation squiggle'
	},
	{
		id: 'and',
		glyph: '∧',
		codePoints: [0x2227],
		names: ['Conjunction', 'logical and', 'wedge'],
		meaning: 'p ∧ q, "p and q", is true only when both p and q are true.',
		entity: '&and;',
		latex: '\\land',
		latexNote: '\\wedge is the same symbol',
		aliases: ['\\wedge', '&wedge;'],
		links: [gate('and', 'AND'), logic],
		keywords: 'and conjunction wedge hat'
	},
	{
		id: 'or',
		glyph: '∨',
		codePoints: [0x2228],
		names: ['Disjunction', 'logical or', 'vee'],
		meaning: 'p ∨ q, "p or q", is true when at least one of them is true: the inclusive or.',
		entity: '&or;',
		latex: '\\lor',
		latexNote: '\\vee is the same symbol',
		aliases: ['\\vee', '&vee;'],
		links: [gate('or', 'OR'), logic],
		keywords: 'or disjunction vee'
	},
	{
		id: 'oplus',
		glyph: '⊕',
		codePoints: [0x2295],
		names: ['Exclusive or', 'XOR', 'circled plus'],
		meaning:
			'p ⊕ q is true when exactly one of p and q is true. The usual XOR sign in boolean algebra and computing; in algebra it also means direct sum.',
		entity: '&oplus;',
		latex: '\\oplus',
		links: [gate('xor', 'XOR')],
		keywords: 'xor exclusive or circled plus direct sum'
	},
	{
		id: 'veebar',
		glyph: '⊻',
		codePoints: [0x22bb],
		names: ['XOR (veebar)', 'exclusive or'],
		meaning: 'Another way to write exclusive or: p ⊻ q is true when exactly one of p and q is true.',
		entity: '&veebar;',
		latex: '\\veebar',
		amssymb: true,
		links: [gate('xor', 'XOR')],
		keywords: 'xor exclusive or underlined vee'
	},
	{
		id: 'to',
		glyph: '→',
		codePoints: [0x2192],
		names: ['Conditional', 'implication', 'right arrow'],
		meaning: 'p → q, "if p then q", is false only when p is true and q is false.',
		entity: '&rarr;',
		latex: '\\to',
		latexNote: '\\rightarrow is the same symbol',
		aliases: ['\\rightarrow', '&rightarrow;'],
		links: [conditional],
		keywords: 'implies implication if then arrow conditional'
	},
	{
		id: 'implies',
		glyph: '⇒',
		codePoints: [0x21d2],
		names: ['Implies', 'double right arrow'],
		meaning:
			'Some books write the conditional this way; others keep ⇒ for "implies" as a claim that p → q holds in every case, or between the steps of a proof.',
		entity: '&rArr;',
		latex: '\\Rightarrow',
		aliases: ['&Rightarrow;'],
		links: [conditional],
		keywords: 'implies implication double arrow'
	},
	{
		id: 'supset',
		glyph: '⊃',
		codePoints: [0x2283],
		names: ['Horseshoe', 'superset', 'older conditional sign'],
		meaning:
			'In older logic books p ⊃ q is the conditional "if p then q". In set theory A ⊃ B says A contains B; whether that allows A = B depends on the book, as with ⊂.',
		entity: '&sup;',
		latex: '\\supset',
		links: [conditional, setLink('superset', 'Superset in set notation')],
		keywords: 'horseshoe superset implies implication contains'
	},
	{
		id: 'iff',
		glyph: '↔',
		codePoints: [0x2194],
		names: ['Biconditional', 'if and only if', 'left right arrow'],
		meaning: 'p ↔ q, "p if and only if q", is true when p and q have the same truth value.',
		entity: '&harr;',
		latex: '\\leftrightarrow',
		aliases: ['&leftrightarrow;'],
		links: [biconditional, gate('xnor', 'XNOR')],
		keywords: 'iff biconditional if only if equivalence xnor double arrow'
	},
	{
		id: 'iff-double',
		glyph: '⇔',
		codePoints: [0x21d4],
		names: ['If and only if', 'left right double arrow'],
		meaning:
			'Used for the biconditional, or written between two statements to say each implies the other, as in a proof that goes both ways.',
		entity: '&hArr;',
		latex: '\\Leftrightarrow',
		latexNote: '\\iff prints a longer arrow ⟺ with extra space around it',
		aliases: ['\\iff', '&iff;', '&Leftrightarrow;'],
		links: [biconditional, gate('xnor', 'XNOR')],
		keywords: 'iff if only if equivalent double arrow'
	},
	{
		id: 'equiv',
		glyph: '≡',
		codePoints: [0x2261],
		names: ['Logically equivalent', 'identical to', 'triple bar'],
		meaning:
			'p ≡ q says the two statements have the same truth value in every row. Some books use it for the biconditional; in number theory a ≡ b (mod n) is congruence.',
		entity: '&equiv;',
		latex: '\\equiv',
		links: [equivalences],
		keywords: 'equivalent equivalence identical congruent triple equals'
	},
	{
		id: 'nand-arrow',
		glyph: '↑',
		codePoints: [0x2191],
		names: ['Sheffer stroke', 'NAND', 'up arrow'],
		meaning: 'p ↑ q means not (p and q): NAND, false only when both are true. Also written p | q.',
		entity: '&uarr;',
		latex: '\\uparrow',
		links: [gate('nand', 'NAND')],
		keywords: 'nand sheffer stroke up arrow'
	},
	{
		id: 'nand',
		glyph: '⊼',
		codePoints: [0x22bc],
		names: ['NAND', 'barwedge'],
		meaning: 'Another sign for NAND: an ∧ with a bar over it, read "not and".',
		entity: null,
		latex: '\\barwedge',
		amssymb: true,
		links: [gate('nand', 'NAND')],
		keywords: 'nand barwedge'
	},
	{
		id: 'nor-arrow',
		glyph: '↓',
		codePoints: [0x2193],
		names: ['Peirce arrow', 'NOR', 'down arrow'],
		meaning: 'p ↓ q means not (p or q): NOR, true only when both are false.',
		entity: '&darr;',
		latex: '\\downarrow',
		links: [gate('nor', 'NOR')],
		keywords: 'nor peirce down arrow'
	},
	{
		id: 'nor',
		glyph: '⊽',
		codePoints: [0x22bd],
		names: ['NOR', 'barvee'],
		meaning: 'Another sign for NOR: an ∨ with a bar over it, read "not or".',
		entity: '&barvee;',
		latex: null,
		latexNote: 'neither base LaTeX nor amssymb has it; \\barvee comes with the stix and unicode-math packages',
		aliases: ['\\barvee'],
		links: [gate('nor', 'NOR')],
		keywords: 'nor barvee'
	},
	{
		id: 'top',
		glyph: '⊤',
		codePoints: [0x22a4],
		names: ['Top', 'verum', 'always true'],
		meaning: 'A statement that is always true: the constant T, or 1 in boolean algebra.',
		entity: '&top;',
		latex: '\\top',
		links: [tautology],
		keywords: 'true tautology verum top constant'
	},
	{
		id: 'bot',
		glyph: '⊥',
		codePoints: [0x22a5],
		names: ['Bottom', 'falsum', 'always false'],
		meaning:
			'A statement that is always false: the constant F, or 0. Proofs by contradiction often end a line with ⊥. In geometry the same character means perpendicular.',
		entity: '&bot;',
		latex: '\\bot',
		latexNote: '\\perp is the same glyph with relation spacing',
		aliases: ['\\perp', '&perp;', '&bottom;'],
		links: [tautology],
		keywords: 'false contradiction falsum bottom up tack perpendicular'
	},

	// --- quantifiers ----------------------------------------------------------
	{
		id: 'forall',
		glyph: '∀',
		codePoints: [0x2200],
		names: ['For all', 'universal quantifier'],
		meaning: '∀x P(x) says P(x) holds for every x in the domain.',
		entity: '&forall;',
		latex: '\\forall',
		links: [logic],
		keywords: 'for all every each any universal quantifier upside down a'
	},
	{
		id: 'exists',
		glyph: '∃',
		codePoints: [0x2203],
		names: ['There exists', 'existential quantifier'],
		meaning: '∃x P(x) says at least one x in the domain has P(x).',
		entity: '&exist;',
		latex: '\\exists',
		links: [logic],
		keywords: 'there exists some existential quantifier backwards e'
	},
	{
		id: 'nexists',
		glyph: '∄',
		codePoints: [0x2204],
		names: ['There does not exist'],
		meaning: '∄x P(x) says no x has P(x): the same as ¬∃x P(x), and as ∀x ¬P(x).',
		entity: '&nexist;',
		latex: '\\nexists',
		amssymb: true,
		links: [logic],
		keywords: 'not exists there is no none quantifier'
	},
	{
		id: 'exists-unique',
		glyph: '∃!',
		codePoints: [0x2203, 0x21],
		names: ['There exists exactly one', 'uniqueness quantifier'],
		meaning: '∃!x P(x) says exactly one x has P(x). It is two characters: ∃ followed by an ordinary exclamation mark.',
		entity: '&exist;!',
		latex: '\\exists!',
		links: [logic],
		keywords: 'unique exactly one uniqueness quantifier'
	},

	// --- proof and metalogic --------------------------------------------------
	{
		id: 'vdash',
		glyph: '⊢',
		codePoints: [0x22a2],
		names: ['Turnstile', 'proves', 'right tack'],
		meaning: 'Γ ⊢ φ says φ can be derived from the premises Γ with the rules of a proof system.',
		entity: '&vdash;',
		latex: '\\vdash',
		links: [inference],
		keywords: 'turnstile proves derives syntactic consequence provable'
	},
	{
		id: 'models',
		glyph: '⊨',
		codePoints: [0x22a8],
		names: ['Double turnstile', 'entails', 'models'],
		meaning:
			'Γ ⊨ φ says every row that makes all of Γ true makes φ true: the argument is valid. ⊨ φ on its own says φ is a tautology.',
		entity: '&vDash;',
		latex: '\\models',
		latexNote: '\\vDash, with amssymb, is the same shape',
		aliases: ['\\vDash'],
		links: [inference, tautology],
		keywords: 'entails models satisfies semantic consequence double turnstile valid'
	},
	{
		id: 'therefore',
		glyph: '∴',
		codePoints: [0x2234],
		names: ['Therefore'],
		meaning: 'Marks the conclusion of an argument: p → q, p ∴ q.',
		entity: '&there4;',
		latex: '\\therefore',
		amssymb: true,
		links: [inference],
		keywords: 'therefore hence thus conclusion three dots'
	},
	{
		id: 'because',
		glyph: '∵',
		codePoints: [0x2235],
		names: ['Because'],
		meaning: 'Marks a reason: ∵ is ∴ upside down, and introduces what the conclusion rests on.',
		entity: '&because;',
		latex: '\\because',
		amssymb: true,
		links: [inference],
		keywords: 'because since three dots'
	},
	{
		id: 'qed',
		glyph: '∎',
		codePoints: [0x220e],
		names: ['End of proof', 'QED', 'tombstone'],
		meaning:
			'Marks the end of a proof, in place of Q.E.D., short for quod erat demonstrandum, "which was to be demonstrated".',
		entity: null,
		latex: '\\blacksquare',
		amssymb: true,
		latexNote: 'prints a filled square ■; the amsthm proof environment ends with \\qedsymbol, an open box □ by default',
		links: [{ href: '/logic/rules-of-inference#proof', label: 'Writing a proof' }],
		keywords: 'qed end of proof tombstone halmos black square'
	},
	{
		id: 'box',
		glyph: '□',
		codePoints: [0x25a1],
		names: ['Box', 'necessarily', 'white square'],
		meaning: 'In modal logic □p reads "necessarily p". Some authors also end proofs with an open box.',
		entity: '&square;',
		latex: '\\Box',
		amssymb: true,
		latexNote: 'the latexsym package also has \\Box, and amssymb has \\square for the same square',
		aliases: ['\\square'],
		links: [],
		keywords: 'box necessarily necessity modal white square'
	},
	{
		id: 'diamond',
		glyph: '◇',
		codePoints: [0x25c7],
		names: ['Diamond', 'possibly'],
		meaning: 'In modal logic ◇p reads "possibly p", which is the same as ¬□¬p.',
		entity: null,
		latex: '\\Diamond',
		amssymb: true,
		latexNote: 'the latexsym package also has \\Diamond',
		links: [],
		keywords: 'diamond possibly possibility modal'
	},
	{
		id: 'dashv',
		glyph: '⊣',
		codePoints: [0x22a3],
		names: ['Left tack', 'reverse turnstile'],
		meaning:
			'A turnstile facing left. ⊣⊢ between two formulas says each can be derived from the other; in category theory F ⊣ G says F is left adjoint to G.',
		entity: '&dashv;',
		latex: '\\dashv',
		links: [inference],
		keywords: 'left tack reverse turnstile interderivable adjoint'
	},

	// --- boolean algebra ------------------------------------------------------
	{
		id: 'dot',
		glyph: '·',
		codePoints: [0xb7],
		names: ['Middle dot', 'AND in boolean algebra'],
		meaning: 'A · B is A AND B. The dot is usually left out, so AB means the same thing.',
		entity: '&middot;',
		latex: '\\cdot',
		latexNote: 'prints the dot operator ⋅ (U+22C5), which is the same idea',
		lookAlikes: [0x22c5],
		links: [gate('and', 'AND'), laws],
		keywords: 'and product dot multiply boolean'
	},
	{
		id: 'plus',
		glyph: '+',
		codePoints: [0x2b],
		names: ['Plus', 'OR in boolean algebra'],
		meaning: 'A + B is A OR B in boolean algebra, so 1 + 1 = 1, not 2.',
		entity: '&plus;',
		latex: '+',
		links: [gate('or', 'OR'), laws],
		keywords: 'or sum plus boolean'
	},
	{
		id: 'prime',
		glyph: '′',
		codePoints: [0x2032],
		names: ['Prime', 'NOT in boolean algebra'],
		meaning:
			"A′ is NOT A, the complement of A. Easier to type than a bar, and a plain apostrophe A' is the usual stand-in.",
		entity: '&prime;',
		latex: "'",
		latexNote:
			"in math mode A' is shorthand for A^{\\prime}, which prints A′; a bare \\prime prints a large prime on the baseline",
		aliases: ['\\prime'],
		links: [gate('not', 'NOT'), laws],
		keywords: 'not complement prime apostrophe inverse boolean'
	},
	{
		id: 'overline',
		glyph: '̅',
		codePoints: [0x305],
		display: 'A̅',
		names: ['Overline', 'bar', 'NOT in boolean algebra'],
		meaning:
			'A̅, "A bar", is NOT A. U+0305 is a combining character: it draws its bar over the character just before it, so paste it straight after the letter. A bar over a whole expression needs LaTeX or an equation editor; in plain text write (A + B)\u2060′.',
		entity: null,
		latex: '\\overline{A}',
		latexNote: '\\bar{A} gives a shorter bar; \\overline stretches over several letters',
		aliases: ['\\overline', '\\bar', '\\bar{A}'],
		links: [gate('not', 'NOT'), laws],
		keywords: 'not bar overline overbar complement combining boolean'
	},

	// --- sets -----------------------------------------------------------------
	{
		id: 'in',
		glyph: '∈',
		codePoints: [0x2208],
		names: ['Element of', 'is in'],
		meaning: 'x ∈ A says x is one of the elements of the set A.',
		entity: '&isin;',
		latex: '\\in',
		links: [setLink('element', 'Element of, in set notation')],
		keywords: 'element member belongs in epsilon'
	},
	{
		id: 'notin',
		glyph: '∉',
		codePoints: [0x2209],
		names: ['Not an element of'],
		meaning: 'x ∉ A says x is not one of the elements of A: ¬(x ∈ A).',
		entity: '&notin;',
		latex: '\\notin',
		links: [setLink('not-element', 'Not an element of, in set notation')],
		keywords: 'not element not member not in'
	},
	{
		id: 'ni',
		glyph: '∋',
		codePoints: [0x220b],
		names: ['Contains as member'],
		meaning: 'A ∋ x is x ∈ A written the other way round: A has x as an element.',
		entity: '&ni;',
		latex: '\\ni',
		links: [setLink('element', 'Element of, in set notation')],
		keywords: 'contains member owns backwards epsilon'
	},
	{
		id: 'subset',
		glyph: '⊂',
		codePoints: [0x2282],
		names: ['Subset', 'proper subset'],
		meaning:
			'A ⊂ B says every element of A is in B. Many books mean a proper subset (A ≠ B), others use it as ⊆, so check the convention.',
		entity: '&sub;',
		latex: '\\subset',
		links: [setLink('proper-subset', 'Proper subset, in set notation')],
		keywords: 'subset proper subset contained'
	},
	{
		id: 'subseteq',
		glyph: '⊆',
		codePoints: [0x2286],
		names: ['Subset or equal'],
		meaning: 'A ⊆ B says every element of A is in B; A and B may be equal.',
		entity: '&sube;',
		latex: '\\subseteq',
		links: [setLink('subset', 'Subset, in set notation')],
		keywords: 'subset equal contained'
	},
	{
		id: 'subsetneq',
		glyph: '⊊',
		codePoints: [0x228a],
		names: ['Proper subset', 'subset, not equal'],
		meaning: 'A ⊊ B says A is a subset of B and not equal to it. Unlike ⊂, it cannot be misread.',
		entity: '&subne;',
		latex: '\\subsetneq',
		amssymb: true,
		links: [setLink('proper-subset', 'Proper subset, in set notation')],
		keywords: 'proper subset strict not equal'
	},
	{
		id: 'supseteq',
		glyph: '⊇',
		codePoints: [0x2287],
		names: ['Superset or equal'],
		meaning: 'A ⊇ B says A contains every element of B; A and B may be equal.',
		entity: '&supe;',
		latex: '\\supseteq',
		links: [setLink('superset', 'Superset, in set notation')],
		keywords: 'superset equal contains'
	},
	{
		id: 'cup',
		glyph: '∪',
		codePoints: [0x222a],
		names: ['Union', 'cup'],
		meaning: 'A ∪ B is everything in A or B or both. It is the set version of ∨.',
		entity: '&cup;',
		latex: '\\cup',
		links: [setLink('union', 'Union, in set notation')],
		keywords: 'union cup or'
	},
	{
		id: 'cap',
		glyph: '∩',
		codePoints: [0x2229],
		names: ['Intersection', 'cap'],
		meaning: 'A ∩ B is everything in both A and B. It is the set version of ∧.',
		entity: '&cap;',
		latex: '\\cap',
		links: [setLink('intersection', 'Intersection, in set notation')],
		keywords: 'intersection cap and'
	},
	{
		id: 'setminus',
		glyph: '∖',
		codePoints: [0x2216],
		names: ['Set difference', 'set minus'],
		meaning: 'A ∖ B is the elements of A that are not in B. Often typed as a backslash, or written A − B.',
		entity: '&setminus;',
		latex: '\\setminus',
		links: [setLink('difference', 'Difference, in set notation')],
		keywords: 'difference minus backslash relative complement'
	},
	{
		id: 'emptyset',
		glyph: '∅',
		codePoints: [0x2205],
		names: ['Empty set', 'null set'],
		meaning: 'The set with no elements, also written { }. A different character from the letter Ø and the Greek φ.',
		entity: '&empty;',
		latex: '\\emptyset',
		latexNote: '\\varnothing, with amssymb, is the rounder form',
		aliases: ['\\varnothing', '&emptyset;', '&emptyv;', '&varnothing;'],
		lookAlikes: [0xd8, 0x3c6],
		links: [setLink('empty', 'Empty set, in set notation')],
		keywords: 'empty null void zero slash'
	},
	{
		id: 'wp',
		glyph: '℘',
		codePoints: [0x2118],
		names: ['Weierstrass p', 'power set'],
		tile: 'Weier\u00adstrass p',
		meaning: '℘(A) is the set of all subsets of A. The glyph is the Weierstrass p, borrowed for the power set.',
		entity: '&weierp;',
		latex: '\\wp',
		links: [setLink('power-set', 'Power set, in set notation')],
		keywords: 'power set weierstrass p subsets'
	},
	{
		id: 'power-set',
		glyph: '𝒫',
		codePoints: [0x1d4ab],
		names: ['Power set', 'script P'],
		meaning:
			'𝒫(A) is the set of all subsets of A. The character lies beyond U+FFFF, so it takes two UTF-16 code units and four bytes of UTF-8.',
		entity: '&Pscr;',
		latex: '\\mathcal{P}',
		links: [setLink('power-set', 'Power set, in set notation')],
		keywords: 'power set script p subsets'
	},
	{
		id: 'times',
		glyph: '×',
		codePoints: [0xd7],
		names: ['Cartesian product', 'times'],
		meaning: 'A × B is every ordered pair (a, b) with a from A and b from B.',
		entity: '&times;',
		latex: '\\times',
		links: [setLink('product', 'Cartesian product, in set notation')],
		keywords: 'cartesian product times cross multiply pairs'
	},
	{
		id: 'complement',
		glyph: '∁',
		codePoints: [0x2201],
		names: ['Complement'],
		meaning: '∁A is everything in the universal set that is not in A. More often written A′, Aᶜ or with a bar.',
		entity: '&comp;',
		latex: '\\complement',
		amssymb: true,
		links: [setLink('complement', 'Complement, in set notation')],
		keywords: 'complement not'
	},
	{
		id: 'symdiff',
		glyph: 'Δ',
		codePoints: [0x394],
		names: ['Symmetric difference', 'delta'],
		meaning:
			'A Δ B is the elements in exactly one of A and B, the set version of exclusive or. This is the Greek capital delta; U+2206 (increment) looks the same.',
		entity: '&Delta;',
		latex: '\\Delta',
		latexNote: '\\triangle (△) is also used',
		aliases: ['\\triangle'],
		lookAlikes: [0x2206],
		links: [setLink('symmetric-difference', 'Symmetric difference, in set notation')],
		keywords: 'symmetric difference delta triangle xor'
	},
	{
		id: 'ominus',
		glyph: '⊖',
		codePoints: [0x2296],
		names: ['Circled minus', 'symmetric difference'],
		meaning: 'Another sign for symmetric difference: A ⊖ B.',
		entity: '&ominus;',
		latex: '\\ominus',
		links: [setLink('symmetric-difference', 'Symmetric difference, in set notation')],
		keywords: 'symmetric difference circled minus xor'
	},
	{
		id: 'naturals',
		glyph: 'ℕ',
		codePoints: [0x2115],
		names: ['Natural numbers'],
		meaning: 'The natural numbers. Books differ on whether they start 0, 1, 2, … or 1, 2, 3, …',
		entity: '&naturals;',
		latex: '\\mathbb{N}',
		amssymb: true,
		links: [setNotation],
		keywords: 'natural numbers counting blackboard bold n'
	},
	{
		id: 'integers',
		glyph: 'ℤ',
		codePoints: [0x2124],
		names: ['Integers'],
		meaning: 'The integers …, −2, −1, 0, 1, 2, … The Z is from the German Zahlen, "numbers".',
		entity: '&integers;',
		latex: '\\mathbb{Z}',
		amssymb: true,
		links: [setNotation],
		keywords: 'integers whole numbers blackboard bold z'
	},
	{
		id: 'rationals',
		glyph: 'ℚ',
		codePoints: [0x211a],
		names: ['Rational numbers'],
		meaning: 'The rational numbers: every fraction p/q of integers with q ≠ 0. Q for quotient.',
		entity: '&rationals;',
		latex: '\\mathbb{Q}',
		amssymb: true,
		links: [setNotation],
		keywords: 'rational numbers fractions quotient blackboard bold q'
	},
	{
		id: 'reals',
		glyph: 'ℝ',
		codePoints: [0x211d],
		names: ['Real numbers'],
		meaning: 'The real numbers: every point on the number line, rational or not.',
		entity: '&reals;',
		latex: '\\mathbb{R}',
		amssymb: true,
		links: [setNotation],
		keywords: 'real numbers blackboard bold r'
	},
	{
		id: 'complexes',
		glyph: 'ℂ',
		codePoints: [0x2102],
		names: ['Complex numbers'],
		meaning: 'The complex numbers a + bi, with a and b real.',
		entity: '&complexes;',
		latex: '\\mathbb{C}',
		amssymb: true,
		links: [setNotation],
		keywords: 'complex numbers imaginary blackboard bold c'
	},

	// --- relations ------------------------------------------------------------
	{
		id: 'equals',
		glyph: '=',
		codePoints: [0x3d],
		names: ['Equals'],
		meaning: 'The two sides are the same value, or for sets, have exactly the same elements.',
		entity: '&equals;',
		latex: '=',
		links: [setLink('equal', 'Equal sets, in set notation')],
		keywords: 'equals equal same'
	},
	{
		id: 'neq',
		glyph: '≠',
		codePoints: [0x2260],
		names: ['Not equal to'],
		meaning: 'The two sides are different: a ≠ b is ¬(a = b).',
		entity: '&ne;',
		latex: '\\neq',
		latexNote: '\\ne is the same symbol',
		aliases: ['\\ne'],
		links: [],
		keywords: 'not equal unequal different'
	},
	{
		id: 'nequiv',
		glyph: '≢',
		codePoints: [0x2262],
		names: ['Not equivalent', 'not identical to'],
		meaning: 'p ≢ q says the two statements are not logically equivalent: some row gives them different values.',
		entity: '&nequiv;',
		latex: '\\not\\equiv',
		links: [equivalences],
		keywords: 'not equivalent not identical not congruent'
	},
	{
		id: 'approx',
		glyph: '≈',
		codePoints: [0x2248],
		names: ['Approximately equal to'],
		tile: 'Approx. equal',
		meaning: 'The two sides are close but not exactly equal, as in π ≈ 3.14.',
		entity: '&asymp;',
		latex: '\\approx',
		links: [],
		keywords: 'approximately almost about roughly wavy equals'
	},
	{
		id: 'lt',
		glyph: '<',
		codePoints: [0x3c],
		names: ['Less than'],
		meaning: 'a < b: a is smaller than b. In HTML it is written &lt;, because a bare < starts a tag.',
		entity: '&lt;',
		latex: '<',
		links: [],
		keywords: 'less than smaller'
	},
	{
		id: 'leq',
		glyph: '≤',
		codePoints: [0x2264],
		names: ['Less than or equal to'],
		meaning: 'a ≤ b: a is smaller than b or equal to it.',
		entity: '&le;',
		latex: '\\leq',
		latexNote: '\\le is the same symbol',
		aliases: ['\\le', '&leq;'],
		links: [],
		keywords: 'less than equal at most'
	},
	{
		id: 'gt',
		glyph: '>',
		codePoints: [0x3e],
		names: ['Greater than'],
		meaning: 'a > b: a is larger than b.',
		entity: '&gt;',
		latex: '>',
		links: [],
		keywords: 'greater than larger bigger'
	},
	{
		id: 'geq',
		glyph: '≥',
		codePoints: [0x2265],
		names: ['Greater than or equal to'],
		meaning: 'a ≥ b: a is larger than b or equal to it.',
		entity: '&ge;',
		latex: '\\geq',
		latexNote: '\\ge is the same symbol',
		aliases: ['\\ge', '&geq;'],
		links: [],
		keywords: 'greater than equal at least'
	}
];

export type SymbolGroup = { id: GroupId; title: string; intro: string; symbols: string[] };

/**
 * The groups, in reading order. A symbol with two jobs, such as ⊃ (the old
 * conditional and superset) or ≡ (equivalence and identity), is listed in both
 * groups but stored once above.
 */
export const GROUPS: SymbolGroup[] = [
	{
		id: 'connectives',
		title: 'Connectives',
		intro: 'Not, and, or, exclusive or, the conditional and biconditional, NAND, NOR and the two constants.',
		symbols: [
			'not',
			'tilde',
			'and',
			'or',
			'oplus',
			'veebar',
			'to',
			'implies',
			'supset',
			'iff',
			'iff-double',
			'equiv',
			'nand-arrow',
			'nand',
			'nor-arrow',
			'nor',
			'top',
			'bot'
		]
	},
	{
		id: 'quantifiers',
		title: 'Quantifiers',
		intro: 'For predicate logic: statements about every x, or some x.',
		symbols: ['forall', 'exists', 'nexists', 'exists-unique']
	},
	{
		id: 'proof',
		title: 'Proof and metalogic',
		intro: 'Symbols that talk about statements and arguments rather than joining them.',
		symbols: ['vdash', 'models', 'therefore', 'because', 'qed', 'box', 'diamond', 'dashv']
	},
	{
		id: 'boolean',
		title: 'Boolean algebra',
		intro: 'The engineering notation for AND, OR and NOT used with logic gates.',
		symbols: ['dot', 'plus', 'prime', 'overline']
	},
	{
		id: 'sets',
		title: 'Sets',
		intro: 'Membership, subsets, the set operations and the number sets.',
		symbols: [
			'in',
			'notin',
			'ni',
			'subset',
			'subseteq',
			'subsetneq',
			'supset',
			'supseteq',
			'cup',
			'cap',
			'setminus',
			'emptyset',
			'wp',
			'power-set',
			'times',
			'complement',
			'symdiff',
			'ominus',
			'naturals',
			'integers',
			'rationals',
			'reals',
			'complexes'
		]
	},
	{
		id: 'relations',
		title: 'Relations',
		intro: 'Equality, equivalence and order.',
		symbols: ['equals', 'neq', 'equiv', 'nequiv', 'approx', 'lt', 'leq', 'gt', 'geq']
	}
];

const byId = new Map(SYMBOLS.map((s) => [s.id, s]));
export const symbolById = (id: string): SymbolEntry | undefined => byId.get(id);

// --- derived codes ------------------------------------------------------------

/** At least four hex digits, upper case: the form Unicode charts and Word use. */
export const hex4 = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');

/** The code points actually in the glyph, read from the string itself. */
export const glyphCodePoints = (glyph: string): number[] => Array.from(glyph, (c) => c.codePointAt(0) as number);

/** U+2227, or U+2203 U+0021 for a symbol made of two characters. */
export const unicodeLabel = (s: SymbolEntry) => s.codePoints.map((cp) => `U+${hex4(cp)}`).join(' ');

/** Characters HTML text can hold as they are. Markup characters must be escaped. */
const plainAscii = (cp: number) => cp >= 0x20 && cp < 0x7f && !'<>&"\''.includes(String.fromCharCode(cp));

/** &#x2227; for each character, keeping plain ASCII as it is. */
export const hexReference = (s: SymbolEntry) =>
	s.codePoints.map((cp) => (plainAscii(cp) ? String.fromCodePoint(cp) : `&#x${hex4(cp)};`)).join('');

/** &#8743; for each character, keeping plain ASCII as it is. */
export const decimalReference = (s: SymbolEntry) =>
	s.codePoints.map((cp) => (plainAscii(cp) ? String.fromCodePoint(cp) : `&#${cp};`)).join('');

/**
 * What to paste into HTML: the named reference where there is one, because it
 * reads better in source; otherwise the hex reference. Plain ASCII such as = or
 * + needs no reference at all.
 */
export function htmlCode(s: SymbolEntry): string {
	if (s.codePoints.every(plainAscii)) return s.glyph;
	return s.entity ?? hexReference(s);
}

export type WordInput =
	| { kind: 'keyboard' }
	| {
			kind: 'alt-x';
			/** The hex code to type before pressing Alt+X. */
			code: string;
			/** Characters typed normally afterwards, such as the ! of ∃!. */
			then: string;
	  };

/**
 * Microsoft Word turns the hex digits just before the cursor into that
 * character when you press Alt+X. Keyboard characters are simply typed.
 */
export function wordInput(s: SymbolEntry): WordInput {
	if (s.codePoints.every(plainAscii)) return { kind: 'keyboard' };
	const [first, ...rest] = s.codePoints;
	return { kind: 'alt-x', code: hex4(first), then: String.fromCodePoint(...rest) };
}

export const COPY_FORMATS = ['symbol', 'latex', 'html', 'unicode'] as const;
export type CopyFormat = typeof COPY_FORMATS[number];

export const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
	symbol: 'Symbol',
	latex: 'LaTeX',
	html: 'HTML',
	unicode: 'Unicode'
};

/**
 * The text one click copies. A symbol with no LaTeX command falls back to the
 * character itself, which LuaLaTeX and XeLaTeX with unicode-math accept as is,
 * and the result says so rather than copying nothing.
 */
export function copyText(s: SymbolEntry, format: CopyFormat): { text: string; fellBack: boolean } {
	switch (format) {
		case 'latex':
			return s.latex === null ? { text: s.glyph, fellBack: true } : { text: s.latex, fellBack: false };
		case 'html':
			return { text: htmlCode(s), fellBack: false };
		case 'unicode':
			return { text: unicodeLabel(s), fellBack: false };
		default:
			return { text: s.glyph, fellBack: false };
	}
}

// --- search -------------------------------------------------------------------

const fold = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** \land, &and; and land all find the same symbol when typed as a plain word. */
const bare = (word: string) => word.replace(/^(u\+|\\|&#x|&#|&)/, '').replace(/;$/, '');

/**
 * Joining words inside a name ("less than or equal to", "if and only if").
 * They are left out of the name words, so "or" does not find ≤, and dropped
 * from a query that has other words. The keywords keep them on purpose: "or"
 * still finds ∨ and +.
 */
const STOP_WORDS = new Set(['and', 'or', 'of', 'to', 'the', 'a', 'an']);

/**
 * Every code the page shows or names for a symbol, exactly as written. LaTeX
 * and HTML are case sensitive (\vdash is ⊢, \vDash is ⊨; &rarr; is →, &rArr; is
 * ⇒), so these are compared without folding.
 */
const codesOf = (s: SymbolEntry): string[] =>
	[s.latex, s.entity, htmlCode(s), ...(s.aliases ?? [])].filter((c): c is string => !!c && /^[\\&]/.test(c));

const codes = new Map(SYMBOLS.map((s) => [s.id, codesOf(s)]));
const allCodes = new Set(SYMBOLS.flatMap(codesOf));

/** Every word a person might type to find a symbol, folded once. */
const words = new Map(
	SYMBOLS.map((s) => {
		const nameWords = fold(s.names.join(' '))
			.split(/[\s,(){}]+/)
			.filter((w) => w && !STOP_WORDS.has(w));
		const codeWords = fold(
			[s.keywords ?? '', ...codesOf(s), unicodeLabel(s), s.codePoints.map(hex4).join(' ')].join(' ')
		)
			.split(/[\s,(){}]+/)
			.filter(Boolean);
		const all = [...nameWords, ...codeWords];
		return [s.id, [...new Set([...all, ...all.map(bare)])]];
	})
);

/** &#x2227; and &#8743; turned back into the characters they stand for. */
const decodeNumeric = (text: string) =>
	text.replace(/&#(x[0-9a-f]+|\d+);/gi, (ref, n: string) => {
		const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
		return cp <= 0x10ffff ? String.fromCodePoint(cp) : ref;
	});

/** The symbol a pasted look-alike character is often mistaken for. */
export function lookAlikeOf(text: string): { char: string; symbol: SymbolEntry } | undefined {
	const char = text.trim();
	if (Array.from(char).length !== 1) return undefined;
	const cp = char.codePointAt(0) as number;
	const symbol = SYMBOLS.find((s) => s.lookAlikes?.includes(cp));
	return symbol && { char, symbol };
}

/** One word of a query, against one symbol. */
function matchesWord(s: SymbolEntry, w: string): boolean {
	// A numeric reference, complete or still being typed, against the ones shown.
	if (/^&#/.test(w)) {
		const lower = w.toLowerCase();
		return [hexReference(s), decimalReference(s)].some((r) => r.toLowerCase().startsWith(lower));
	}
	// A LaTeX command or HTML entity, case and all. A complete code finds only
	// the symbols it belongs to, so \to does not also bring up \top; a code
	// still being typed finds every code it starts.
	if (/^[\\&]/.test(w)) {
		const own = codes.get(s.id) ?? [];
		return allCodes.has(w) ? own.includes(w) : own.some((c) => c.startsWith(w));
	}
	const folded = bare(fold(w));
	return !folded || (words.get(s.id) ?? []).some((t) => t.startsWith(folded));
}

/**
 * True when the symbol matches the query. Pasting a character, a numeric
 * reference or a look-alike finds every symbol containing it; otherwise every
 * word of the query must start one of the words in the symbol's names,
 * keywords, codes or code point. Matching word starts rather than anywhere
 * keeps "and" from finding NAND, and the meaning text is left out because
 * nearly every meaning contains "and" or "or".
 */
export function matchesQuery(s: SymbolEntry, query: string): boolean {
	const trimmed = query.trim();
	if (!trimmed) return true;
	const decoded = decodeNumeric(trimmed);
	if (decoded === s.glyph || decoded === s.display) return true;
	if (lookAlikeOf(decoded)?.symbol === s) return true;
	if (allCodes.has(trimmed)) return (codes.get(s.id) ?? []).includes(trimmed);
	// The LaTeX for + = < > and the prime is typed as it is: ' finds the prime.
	if (s.latex === trimmed) return true;
	// A lone \ or & is the first key of a LaTeX command or an HTML code, not a
	// pasted character, so it keeps every symbol that has such a code rather
	// than flashing "no symbol matches" while the rest is typed. Every symbol
	// has a numeric reference, so & keeps them all.
	if (trimmed === '&') return true;
	if (trimmed === '\\') return matchesWord(s, trimmed);
	if (Array.from(decoded).length === 1 && !/[a-z0-9]/i.test(decoded)) return s.glyph.includes(decoded);
	if (decoded !== trimmed) return false;
	const parts = trimmed.split(/\s+/);
	const content = parts.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
	return (content.length ? content : parts).every((w) => matchesWord(s, w));
}

/** The groups with only the matching symbols in them, empty groups dropped. */
export function filterGroups(query: string): { group: SymbolGroup; symbols: SymbolEntry[] }[] {
	return GROUPS.map((group) => ({
		group,
		symbols: group.symbols.map((id) => byId.get(id) as SymbolEntry).filter((s) => matchesQuery(s, query))
	})).filter((g) => g.symbols.length > 0);
}

// --- whole formulas ---------------------------------------------------------------

/** One symbol per single character, for transcribing a formula. */
const byChar = new Map(SYMBOLS.filter((s) => s.codePoints.length === 1).map((s) => [s.glyph, s]));

/** Characters that mean something to LaTeX or HTML, escaped when a formula has them. */
const LATEX_SPECIAL: Record<string, string> = {
	'{': '\\{',
	'}': '\\}',
	'%': '\\%',
	'#': '\\#',
	'&': '\\&'
};

/**
 * A formula typed with Unicode symbols, rewritten as LaTeX or HTML. Letters,
 * digits, spaces and brackets pass through; set braces, % # & in LaTeX and &
 * in HTML are escaped, since both languages treat them as markup. A LaTeX command made of letters
 * swallows a letter right after it (\lnot p must not become \lnotp), so a
 * space is put in where one is needed. A letter followed by the combining
 * overline becomes \overline{A} in LaTeX.
 */
export function transcribe(text: string, format: 'latex' | 'html'): string {
	const chars = Array.from(text);
	let out = '';
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		if (format === 'latex' && chars[i + 1] === '̅') {
			out = joinLatex(out, `\\overline{${c}}`);
			i++;
			continue;
		}
		const s = byChar.get(c);
		if (format === 'latex') {
			const piece = s ? s.latex ?? c : LATEX_SPECIAL[c] ?? c;
			out = joinLatex(out, piece);
		} else {
			out += s ? htmlCode(s) : c === '&' ? '&amp;' : c;
		}
	}
	return out;
}

/** Appends to LaTeX source, adding a space when a command would run into a letter. */
function joinLatex(out: string, piece: string): string {
	if (/\\[a-zA-Z]+$/.test(out) && /^[a-zA-Z]/.test(piece)) return `${out} ${piece}`;
	return out + piece;
}

/** Does the LaTeX need \usepackage{amssymb}? */
export const needsAmssymb = (text: string) => Array.from(text).some((c) => byChar.get(c)?.amssymb === true);

/** Formulas the page writes out in every format, as worked examples. */
export const WORKED_FORMULAS = [
	'¬(p ∧ q) ≡ ¬p ∨ ¬q',
	'∀x ∃y (x < y)',
	'A ∩ (B ∪ C) = (A ∩ B) ∪ (A ∩ C)',
	'A̅ · B̅ = (A + B)′'
];
