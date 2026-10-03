// The symbol table checked against references that do not share its data:
// the Unicode character names (from Python's unicodedata, Unicode 15), the
// commands matplotlib's mathtext maps to each code point, the HTML parser of a
// real browser for every named entity, and the file system for every concept
// link. Then the page, as a reader would use it.

import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import {
	SYMBOLS,
	GROUPS,
	symbolById,
	glyphCodePoints,
	unicodeLabel,
	hexReference,
	decimalReference,
	htmlCode,
	wordInput,
	copyText,
	matchesQuery,
	filterGroups,
	lookAlikeOf,
	transcribe,
	needsAmssymb,
	WORKED_FORMULAS,
	COPY_FORMATS,
	type SymbolEntry
} from '../src/lib/symbolTable.js';

/** The official character names, from Python's unicodedata. */
const UNICODE_NAMES: Record<number, string> = {
	0x21: 'EXCLAMATION MARK',
	0x2b: 'PLUS SIGN',
	0x3c: 'LESS-THAN SIGN',
	0x3d: 'EQUALS SIGN',
	0x3e: 'GREATER-THAN SIGN',
	0x7e: 'TILDE',
	0xac: 'NOT SIGN',
	0xb7: 'MIDDLE DOT',
	0xd7: 'MULTIPLICATION SIGN',
	0x305: 'COMBINING OVERLINE',
	0x394: 'GREEK CAPITAL LETTER DELTA',
	0x2032: 'PRIME',
	0x2102: 'DOUBLE-STRUCK CAPITAL C',
	0x2115: 'DOUBLE-STRUCK CAPITAL N',
	0x2118: 'SCRIPT CAPITAL P',
	0x211a: 'DOUBLE-STRUCK CAPITAL Q',
	0x211d: 'DOUBLE-STRUCK CAPITAL R',
	0x2124: 'DOUBLE-STRUCK CAPITAL Z',
	0x2191: 'UPWARDS ARROW',
	0x2192: 'RIGHTWARDS ARROW',
	0x2193: 'DOWNWARDS ARROW',
	0x2194: 'LEFT RIGHT ARROW',
	0x21d2: 'RIGHTWARDS DOUBLE ARROW',
	0x21d4: 'LEFT RIGHT DOUBLE ARROW',
	0x2200: 'FOR ALL',
	0x2201: 'COMPLEMENT',
	0x2203: 'THERE EXISTS',
	0x2204: 'THERE DOES NOT EXIST',
	0x2205: 'EMPTY SET',
	0x2208: 'ELEMENT OF',
	0x2209: 'NOT AN ELEMENT OF',
	0x220b: 'CONTAINS AS MEMBER',
	0x220e: 'END OF PROOF',
	0x2216: 'SET MINUS',
	0x2227: 'LOGICAL AND',
	0x2228: 'LOGICAL OR',
	0x2229: 'INTERSECTION',
	0x222a: 'UNION',
	0x2234: 'THEREFORE',
	0x2235: 'BECAUSE',
	0x2248: 'ALMOST EQUAL TO',
	0x2260: 'NOT EQUAL TO',
	0x2261: 'IDENTICAL TO',
	0x2262: 'NOT IDENTICAL TO',
	0x2264: 'LESS-THAN OR EQUAL TO',
	0x2265: 'GREATER-THAN OR EQUAL TO',
	0x2282: 'SUBSET OF',
	0x2283: 'SUPERSET OF',
	0x2286: 'SUBSET OF OR EQUAL TO',
	0x2287: 'SUPERSET OF OR EQUAL TO',
	0x228a: 'SUBSET OF WITH NOT EQUAL TO',
	0x2295: 'CIRCLED PLUS',
	0x2296: 'CIRCLED MINUS',
	0x22a2: 'RIGHT TACK',
	0x22a3: 'LEFT TACK',
	0x22a4: 'DOWN TACK',
	0x22a5: 'UP TACK',
	0x22a8: 'TRUE',
	0x22bb: 'XOR',
	0x22bc: 'NAND',
	0x22bd: 'NOR',
	0x25a1: 'WHITE SQUARE',
	0x25c7: 'WHITE DIAMOND',
	0x1d4ab: 'MATHEMATICAL SCRIPT CAPITAL P'
};

/** Which character each symbol is meant to be, by its Unicode name: catches a look-alike. */
const EXPECTED_NAME: Record<string, string> = {
	not: 'NOT SIGN',
	and: 'LOGICAL AND',
	or: 'LOGICAL OR',
	veebar: 'XOR',
	nand: 'NAND',
	nor: 'NOR',
	models: 'TRUE',
	qed: 'END OF PROOF',
	emptyset: 'EMPTY SET',
	symdiff: 'GREEK CAPITAL LETTER DELTA',
	setminus: 'SET MINUS',
	dot: 'MIDDLE DOT',
	prime: 'PRIME',
	overline: 'COMBINING OVERLINE',
	'power-set': 'MATHEMATICAL SCRIPT CAPITAL P',
	wp: 'SCRIPT CAPITAL P',
	subsetneq: 'SUBSET OF WITH NOT EQUAL TO',
	complement: 'COMPLEMENT',
	box: 'WHITE SQUARE',
	diamond: 'WHITE DIAMOND'
};

/**
 * The code point each LaTeX command prints, from matplotlib's mathtext table
 * (tex2uni), plus the commands it does not list: \lnot, \land and \lor are
 * base LaTeX aliases of \neg, \wedge and \vee, and \Box and \Diamond come from
 * amssymb. The font alphabets are checked by letter instead.
 */
const LATEX_PRINTS: Record<string, number> = {
	lnot: 0xac,
	neg: 0xac,
	land: 0x2227,
	wedge: 0x2227,
	lor: 0x2228,
	vee: 0x2228,
	sim: 0x223c,
	oplus: 0x2295,
	veebar: 0x22bb,
	to: 0x2192,
	rightarrow: 0x2192,
	Rightarrow: 0x21d2,
	supset: 0x2283,
	leftrightarrow: 0x2194,
	Leftrightarrow: 0x21d4,
	equiv: 0x2261,
	uparrow: 0x2191,
	barwedge: 0x22bc,
	downarrow: 0x2193,
	top: 0x22a4,
	bot: 0x22a5,
	forall: 0x2200,
	exists: 0x2203,
	nexists: 0x2204,
	vdash: 0x22a2,
	models: 0x22a7,
	therefore: 0x2234,
	because: 0x2235,
	blacksquare: 0x25a0,
	Box: 0x25a1,
	Diamond: 0x25c7,
	dashv: 0x22a3,
	cdot: 0x22c5,
	in: 0x2208,
	notin: 0x2209,
	ni: 0x220b,
	subset: 0x2282,
	subseteq: 0x2286,
	subsetneq: 0x228a,
	supseteq: 0x2287,
	cup: 0x222a,
	cap: 0x2229,
	setminus: 0x2216,
	emptyset: 0x2205,
	wp: 0x2118,
	times: 0xd7,
	complement: 0x2201,
	Delta: 0x394,
	ominus: 0x2296,
	neq: 0x2260,
	approx: 0x2248,
	leq: 0x2264,
	geq: 0x2265,
	// The aliases and the commands the notes name. \le, \ge and \ne are base
	// LaTeX shorthands for \leq, \geq and \neq; \perp is \bot's glyph from the
	// same font slot, set as a relation (plain TeX: \bot "023F, \perp "323F);
	// \iff is base LaTeX's spaced \Longleftrightarrow; \barvee is not in
	// matplotlib but in stix and unicode-math, mapped to U+22BD.
	textasciitilde: 0x7e,
	ne: 0x2260,
	le: 0x2264,
	ge: 0x2265,
	perp: 0x22a5,
	iff: 0x27fa,
	vDash: 0x22a8,
	varnothing: 0x2205,
	square: 0x25a1,
	prime: 0x2032,
	triangle: 0x25b3,
	barvee: 0x22bd
};

/** Commands the notes name that are not single symbols: accents and the proof-end macro. */
const LATEX_OTHER = new Set(['overline', 'bar', 'mathbb', 'mathcal', 'not', 'qedsymbol', 'usepackage']);

/** Aliases that are a different, related character, which the symbol's note explains. */
const ALIAS_PRINTS_DIFFERENTLY: Record<string, string> = {
	iff: '⟺, the long arrow; the note says so',
	triangle: '△, an alternative sign for symmetric difference; the note says so'
};

/** Commands that need \usepackage{amssymb}; everything else above is in base LaTeX. */
const AMSSYMB = new Set([
	'veebar',
	'barwedge',
	'nexists',
	'therefore',
	'because',
	'blacksquare',
	'Box',
	'Diamond',
	'subsetneq',
	'complement',
	'mathbb',
	'vDash',
	'varnothing',
	'square'
]);

/** Where a printed glyph legitimately differs from the stored one, and why. */
const PRINTS_DIFFERENTLY: Record<string, string> = {
	tilde: 'math mode \\sim is the tilde operator; the note says so',
	models: '\\models is built from | and =, which reads as ⊨',
	qed: '\\blacksquare is ■; the note says so',
	dot: '\\cdot is the dot operator; the note says so'
};

/** A symbol that must exist; a missing one fails the test that asked for it. */
function sym(id: string): SymbolEntry {
	const s = symbolById(id);
	if (!s) throw new Error(`no symbol ${id}`);
	return s;
}

/** UTF-16 decoded by hand, so the code point check does not reuse the engine's method. */
function utf16CodePoints(s: string): number[] {
	const out: number[] = [];
	for (let i = 0; i < s.length; i++) {
		const hi = s.charCodeAt(i);
		if (hi >= 0xd800 && hi <= 0xdbff) {
			const lo = s.charCodeAt(++i);
			out.push(0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00));
		} else out.push(hi);
	}
	return out;
}

/** A route file for a site path, or the gate data for /logic-gates/<slug>. */
function pageExists(href: string): boolean {
	const path = href.split(/[?#]/)[0];
	const gate = path.match(/^\/logic-gates\/([a-z]+)$/);
	if (gate) return readFileSync('src/lib/gates.ts', 'utf8').includes(`slug: '${gate[1]}'`);
	return existsSync(`src/routes${path}/+page.svelte`);
}

test.describe('the symbol data', () => {
	test('every glyph is the code points stored next to it, and a real named character', () => {
		for (const s of SYMBOLS) {
			expect(utf16CodePoints(s.glyph), s.id).toEqual(s.codePoints);
			expect(glyphCodePoints(s.glyph), s.id).toEqual(s.codePoints);
			for (const cp of s.codePoints) expect(UNICODE_NAMES[cp], `${s.id} U+${cp.toString(16)}`).toBeTruthy();
		}
		for (const [id, name] of Object.entries(EXPECTED_NAME)) {
			const s = sym(id);
			expect(UNICODE_NAMES[s.codePoints[0]], id).toBe(name);
		}
		// The look-alikes the page warns about are the right ones.
		expect(sym('symdiff').codePoints).not.toContain(0x2206);
		expect(sym('emptyset').codePoints).not.toContain(0xd8);
	});

	test('no symbol is stored twice, and every id is unique', () => {
		const glyphs = SYMBOLS.map((s) => s.glyph);
		expect(new Set(glyphs).size).toBe(glyphs.length);
		const ids = SYMBOLS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('the groups list every symbol, each at most once per group', () => {
		const listed = new Set(GROUPS.flatMap((g) => g.symbols));
		expect([...listed].sort()).toEqual(SYMBOLS.map((s) => s.id).sort());
		for (const g of GROUPS) {
			expect(new Set(g.symbols).size, g.id).toBe(g.symbols.length);
			for (const id of g.symbols) expect(symbolById(id), `${g.id}: ${id}`).toBeTruthy();
		}
		// The symbols the brief asks for are all here, in their groups.
		const want: Record<string, string> = {
			connectives: '¬ ~ ∧ ∨ ⊕ ⊻ → ⇒ ⊃ ↔ ⇔ ≡ ↑ ⊼ ↓ ⊽ ⊤ ⊥',
			quantifiers: '∀ ∃ ∄ ∃!',
			proof: '⊢ ⊨ ∴ ∵ ∎ □ ◇ ⊣',
			boolean: '· + ′ ̅',
			sets: '∈ ∉ ∋ ⊂ ⊆ ⊊ ⊃ ⊇ ∪ ∩ ∖ ∅ ℘ 𝒫 × ∁ Δ ⊖ ℕ ℤ ℚ ℝ ℂ',
			relations: '= ≠ ≡ ≢ ≈ < ≤ > ≥'
		};
		for (const g of GROUPS) {
			expect(g.symbols.map((id) => sym(id).glyph).join(' '), g.id).toBe(want[g.id]);
		}
	});

	test('every LaTeX command is real, prints the symbol, and needs amssymb exactly when flagged', () => {
		for (const s of SYMBOLS) {
			if (s.latex === null) {
				expect(s.latexNote, `${s.id} explains the missing command`).toBeTruthy();
				expect(s.amssymb).toBeFalsy();
				continue;
			}
			const commands = [...s.latex.matchAll(/\\([A-Za-z]+)/g)].map((m) => m[1]);
			const needs = commands.some((c) => AMSSYMB.has(c));
			expect(!!s.amssymb, `${s.id} amssymb flag`).toBe(needs);
			if (commands.length === 0) {
				// Typed as it is: + = < > and the apostrophe prime.
				expect(['+', '=', '<', '>', "'"], s.id).toContain(s.latex);
				continue;
			}
			const head = commands[0];
			if (head === 'mathbb') {
				const letter = s.latex.match(/^\\mathbb\{([A-Z])\}$/)?.[1];
				expect(UNICODE_NAMES[s.codePoints[0]], s.id).toBe(`DOUBLE-STRUCK CAPITAL ${letter}`);
			} else if (head === 'mathcal') {
				expect(UNICODE_NAMES[s.codePoints[0]]).toBe('MATHEMATICAL SCRIPT CAPITAL P');
			} else if (head === 'overline') {
				expect(s.codePoints).toEqual([0x305]);
			} else if (head === 'not') {
				expect(s.latex).toBe('\\not\\equiv');
				expect(UNICODE_NAMES[s.codePoints[0]]).toBe('NOT IDENTICAL TO');
			} else {
				expect(LATEX_PRINTS[head], `${s.id}: \\${head} is a known command`).toBeDefined();
				if (!PRINTS_DIFFERENTLY[s.id]) {
					expect(LATEX_PRINTS[head], `${s.id}: \\${head} prints it`).toBe(s.codePoints[0]);
				}
			}
			for (const c of commands) {
				expect(LATEX_PRINTS[c] !== undefined || ['mathbb', 'mathcal', 'overline', 'not'].includes(c), c).toBe(true);
			}
		}
	});

	test('every alias and every command a note names is real, and prints the symbol or says why not', () => {
		for (const s of SYMBOLS) {
			for (const alias of s.aliases ?? []) {
				expect(alias, s.id).toMatch(/^(\\[A-Za-z]+(\{[A-Z]\})?|&[A-Za-z][A-Za-z0-9]*;)$/);
				if (!alias.startsWith('\\')) continue;
				const head = (alias.match(/^\\([A-Za-z]+)/) as RegExpMatchArray)[1];
				if (LATEX_OTHER.has(head)) {
					expect(s.id, alias).toBe('overline');
					continue;
				}
				expect(LATEX_PRINTS[head], `${s.id}: ${alias} is a known command`).toBeDefined();
				if (!ALIAS_PRINTS_DIFFERENTLY[head]) expect(LATEX_PRINTS[head], `${s.id}: ${alias}`).toBe(s.codePoints[0]);
				// An alias that needs amssymb is named as such in the note.
				if (AMSSYMB.has(head)) expect(s.latexNote ?? '', `${s.id}: ${alias}`).toContain('amssymb');
			}
			for (const m of (s.latexNote ?? '').matchAll(/\\([A-Za-z]+)/g)) {
				expect(LATEX_PRINTS[m[1]] !== undefined || LATEX_OTHER.has(m[1]), `${s.id} note: \\${m[1]}`).toBe(true);
			}
		}
		// The notes that compare a command with the main one name it as an alias, so search finds it.
		for (const s of SYMBOLS) {
			for (const m of (s.latexNote ?? '').matchAll(/\\([A-Za-z]+)/g)) {
				if (['qedsymbol', 'Box', 'Diamond', 'overline', 'sim'].includes(m[1])) continue;
				expect(
					[s.latex ?? '', ...(s.aliases ?? [])].some((c) => c.startsWith(`\\${m[1]}`)),
					`${s.id}: \\${m[1]}`
				).toBe(true);
			}
		}
	});

	test('named entities look like entities, and every symbol has a meaning and a name', () => {
		for (const s of SYMBOLS) {
			if (s.entity) expect(s.entity, s.id).toMatch(/^&[A-Za-z][A-Za-z0-9]*;!?$/);
			expect(s.names.length, s.id).toBeGreaterThan(0);
			expect(s.meaning.length, s.id).toBeGreaterThan(20);
			expect(s.meaning, s.id).not.toMatch(/!$/);
		}
	});

	test('every concept link points to a page that exists', () => {
		for (const s of SYMBOLS) {
			for (const link of s.links) expect(pageExists(link.href), `${s.id} → ${link.href}`).toBe(true);
		}
		// The ones the brief names.
		expect(sym('and').links[0].href).toBe('/logic-gates/and');
		expect(sym('to').links[0].href).toBe('/logic/conditional-statements');
		expect(sym('vdash').links[0].href).toBe('/logic/rules-of-inference');
		expect(sym('cup').links[0].href.startsWith('/set-notation')).toBe(true);
		// Deep links into set notation name rows it really has.
		const setPage = readFileSync('src/lib/setNotation.ts', 'utf8');
		for (const s of SYMBOLS) {
			for (const link of s.links) {
				const m = link.href.match(/symbol=([a-z-]+)/);
				if (m) expect(setPage, link.href).toContain(`id: '${m[1]}'`);
			}
		}
		const biconditional = readFileSync('src/routes/logic/conditional-statements/+page.svelte', 'utf8');
		expect(biconditional).toContain('id="biconditional"');
		expect(readFileSync('src/routes/logic/rules-of-inference/+page.svelte', 'utf8')).toContain('id="proof"');
	});
});

test.describe('the derived codes', () => {
	test('known answers for the codes a reader copies', () => {
		const and = sym('and');
		expect(unicodeLabel(and)).toBe('U+2227');
		expect(hexReference(and)).toBe('&#x2227;');
		expect(decimalReference(and)).toBe('&#8743;');
		expect(htmlCode(and)).toBe('&and;');
		expect(wordInput(and)).toEqual({ kind: 'alt-x', code: '2227', then: '' });

		const unique = sym('exists-unique');
		expect(unicodeLabel(unique)).toBe('U+2203 U+0021');
		expect(hexReference(unique)).toBe('&#x2203;!');
		expect(decimalReference(unique)).toBe('&#8707;!');
		expect(wordInput(unique)).toEqual({ kind: 'alt-x', code: '2203', then: '!' });

		const script = sym('power-set');
		expect(unicodeLabel(script)).toBe('U+1D4AB');
		expect(decimalReference(script)).toBe('&#119979;');
		expect(wordInput(script)).toEqual({ kind: 'alt-x', code: '1D4AB', then: '' });

		expect(unicodeLabel(sym('not'))).toBe('U+00AC');
		expect(wordInput(sym('plus'))).toEqual({ kind: 'keyboard' });
		expect(htmlCode(sym('plus'))).toBe('+');
		expect(htmlCode(sym('lt'))).toBe('&lt;');
		expect(htmlCode(sym('nand'))).toBe('&#x22BC;');
	});

	test('numeric references agree with the code points for every symbol', () => {
		for (const s of SYMBOLS) {
			const dec = [...decimalReference(s).matchAll(/&#(\d+);/g)].map((m) => Number(m[1]));
			const hex = [...hexReference(s).matchAll(/&#x([0-9A-F]+);/g)].map((m) => parseInt(m[1], 16));
			expect(hex, s.id).toEqual(dec);
			const plain = s.codePoints.filter((cp) => cp >= 0x20 && cp < 0x7f && !'<>&"\''.includes(String.fromCharCode(cp)));
			expect(dec.length + plain.length, s.id).toBe(s.codePoints.length);
		}
	});

	test('copy as gives the symbol, LaTeX, HTML or code point, and says when it falls back', () => {
		const or = sym('or');
		expect(COPY_FORMATS.map((f) => copyText(or, f).text)).toEqual(['∨', '\\lor', '&or;', 'U+2228']);
		const nor = sym('nor');
		expect(copyText(nor, 'latex')).toEqual({ text: '⊽', fellBack: true });
		expect(copyText(nor, 'html').text).toBe('&barvee;');
		expect(copyText(sym('overline'), 'symbol').text).toBe('̅');
	});

	test('search finds by name, LaTeX, entity, code point and pasted glyph, by word start', () => {
		const ids = (q: string) => SYMBOLS.filter((s) => matchesQuery(s, q)).map((s) => s.id);
		expect(ids('')).toHaveLength(SYMBOLS.length);
		expect(ids('and')).toContain('and');
		expect(ids('and')).not.toContain('nand');
		expect(ids('\\land')).toEqual(['and']);
		expect(ids('&and;')).toEqual(['and']);
		expect(ids('U+2227')).toEqual(['and']);
		expect(ids('2227')).toEqual(['and']);
		expect(ids('∧')).toEqual(['and']);
		expect(ids('!')).toEqual(['exists-unique']);
		expect(ids('<')).toEqual(['lt']);
		expect(ids('therefore')).toEqual(['therefore']);
		expect(ids('power set')).toEqual(['wp', 'power-set']);
		expect(ids('xor')).toEqual(expect.arrayContaining(['oplus', 'veebar', 'symdiff', 'ominus']));
		expect(ids('Peirce')).toEqual(['nor-arrow']);
		expect(ids('qqqq')).toEqual([]);
		expect(filterGroups('qqqq')).toEqual([]);
		expect(filterGroups('superset').map((g) => g.group.id)).toEqual(['connectives', 'sets']);
	});

	test('every code the page shows finds its own symbol, and only symbols that share it', () => {
		const ids = (q: string) => SYMBOLS.filter((s) => matchesQuery(s, q)).map((s) => s.id);
		/** Who else genuinely has the same code: the same character, or a shared alias. */
		const sharing = (q: string) =>
			SYMBOLS.filter(
				(s) =>
					[s.latex, s.entity, htmlCode(s), hexReference(s), decimalReference(s), unicodeLabel(s), s.glyph].includes(
						q
					) || (s.aliases ?? []).includes(q)
			).map((s) => s.id);
		let checked = 0;
		for (const s of SYMBOLS) {
			const shown = [
				s.glyph,
				s.display,
				s.latex,
				s.entity,
				htmlCode(s),
				hexReference(s),
				decimalReference(s),
				unicodeLabel(s),
				...(s.aliases ?? [])
			].filter((c): c is string => !!c);
			for (const code of shown) {
				const found = ids(code);
				expect(found, `${s.id}: ${code}`).toContain(s.id);
				// A LaTeX command or named entity finds exactly the symbols that have it. A
				// numeric reference acts like pasting its character: &#x2203; finds ∃ and ∃!.
				if (/^[\\&]/.test(code) && !code.startsWith('&#')) {
					expect(found.sort(), `${s.id}: ${code}`).toEqual(sharing(code).sort());
				}
				// Hex references are case-insensitive in HTML: &#x22bc; is &#x22BC;.
				if (code.startsWith('&#x')) expect(ids(code.toLowerCase()), code).toContain(s.id);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(400);
	});

	test('LaTeX and HTML codes that differ only by case find different symbols', () => {
		const ids = (q: string) => SYMBOLS.filter((s) => matchesQuery(s, q)).map((s) => s.id);
		expect(ids('\\vdash')).toEqual(['vdash']);
		expect(ids('\\vDash')).toEqual(['models']);
		expect(ids('\\rightarrow')).toEqual(['to']);
		expect(ids('\\Rightarrow')).toEqual(['implies']);
		expect(ids('\\leftrightarrow')).toEqual(['iff']);
		expect(ids('\\Leftrightarrow')).toEqual(['iff-double']);
		expect(ids('&rarr;')).toEqual(['to']);
		expect(ids('&rArr;')).toEqual(['implies']);
		expect(ids('&harr;')).toEqual(['iff']);
		expect(ids('&hArr;')).toEqual(['iff-double']);
		expect(ids('&vdash;')).toEqual(['vdash']);
		expect(ids('&vDash;')).toEqual(['models']);
		// \diamond (⋄) and \delta (δ) are other characters, not in the table.
		expect(ids('\\diamond')).toEqual([]);
		expect(ids('\\delta')).toEqual([]);
		// A complete code finds only its symbols; one still being typed finds every code it starts.
		expect(ids('\\to')).toEqual(['to']);
		expect(ids('\\vee')).toEqual(['or']);
		expect(ids('\\lan')).toEqual(['and']);
		expect(ids('\\sub')).toEqual(['subset', 'subseteq', 'subsetneq']);
		expect(ids('&#x22')).toContain('nand');
		expect(ids('&#x22')).not.toContain('not');
		// The first key of a code keeps every symbol that has such a code.
		expect(ids('&')).toEqual(SYMBOLS.map((s) => s.id));
		const withCommand = SYMBOLS.filter((s) => [s.latex, ...(s.aliases ?? [])].some((c) => c?.startsWith('\\')));
		expect(ids('\\')).toEqual(withCommand.map((s) => s.id));
		expect(ids('\\')).toContain('prime');
		expect(ids('\\').length).toBeGreaterThan(50);
	});

	test('aliases, numeric references, brace commands and look-alikes all find their symbol', () => {
		const ids = (q: string) => SYMBOLS.filter((s) => matchesQuery(s, q)).map((s) => s.id);
		const want: [string, string][] = [
			['\\neg', 'not'],
			['\\wedge', 'and'],
			['\\vee', 'or'],
			['\\iff', 'iff-double'],
			['\\perp', 'bot'],
			['\\varnothing', 'emptyset'],
			['\\prime', 'prime'],
			['\\barvee', 'nor'],
			['\\ne', 'neq'],
			['\\le', 'leq'],
			['\\ge', 'geq'],
			['\\bar', 'overline'],
			['&wedge;', 'and'],
			['&vee;', 'or'],
			['&iff;', 'iff-double'],
			['&perp;', 'bot'],
			['&emptyset;', 'emptyset'],
			['&#x2227;', 'and'],
			['&#8743;', 'and'],
			['&#x22BC;', 'nand'],
			['&#x2203;!', 'exists-unique'],
			['\\mathbb{N}', 'naturals'],
			['\\mathcal{P}', 'power-set'],
			['\\overline{A}', 'overline'],
			["'", 'prime'],
			['∆', 'symdiff'],
			['⋅', 'dot'],
			['∼', 'tilde'],
			['Ø', 'emptyset']
		];
		for (const [q, id] of want) expect(ids(q), q).toEqual([id]);
		expect(lookAlikeOf('∆')?.symbol.id).toBe('symdiff');
		expect(lookAlikeOf('Δ')).toBeUndefined();
		expect(lookAlikeOf('ab')).toBeUndefined();
	});

	test('joining words do not drag in unrelated symbols', () => {
		const ids = (q: string) => SYMBOLS.filter((s) => matchesQuery(s, q)).map((s) => s.id);
		expect(ids('or')).toEqual(['or', 'oplus', 'veebar', 'plus', 'cup']);
		expect(ids('and')).toEqual(['and', 'dot', 'cap']);
		expect(ids('not')).not.toContain('supset');
		expect(ids('not')).not.toContain('emptyset');
		expect(ids('less than or equal to')).toEqual(['leq']);
		expect(ids('if and only if')).toEqual(['iff', 'iff-double']);
	});
});

test.describe('whole formulas', () => {
	test('transcribed to LaTeX and HTML', () => {
		expect(transcribe('¬(p ∧ q) ≡ ¬p ∨ ¬q', 'latex')).toBe('\\lnot(p \\land q) \\equiv \\lnot p \\lor \\lnot q');
		expect(transcribe('¬(p ∧ q) ≡ ¬p ∨ ¬q', 'html')).toBe('&not;(p &and; q) &equiv; &not;p &or; &not;q');
		expect(transcribe('∀x ∃y (x < y)', 'latex')).toBe('\\forall x \\exists y (x < y)');
		expect(transcribe('∀x ∃y (x < y)', 'html')).toBe('&forall;x &exist;y (x &lt; y)');
		expect(transcribe('A̅ · B̅ = (A + B)′', 'latex')).toBe("\\overline{A} \\cdot \\overline{B} = (A + B)'");
		expect(transcribe('A̅ · B̅', 'html')).toBe('A&#x0305; &middot; B&#x0305;');
		expect(transcribe('x ∈ ℕ', 'latex')).toBe('x \\in \\mathbb{N}');
		expect(needsAmssymb('x ∈ ℕ')).toBe(true);
		expect(needsAmssymb('p ∧ q')).toBe(false);
		// Markup characters are escaped rather than passed through.
		expect(transcribe('{1, 2} ⊆ ℕ', 'latex')).toBe('\\{1, 2\\} \\subseteq \\mathbb{N}');
		expect(transcribe('50% & #1', 'latex')).toBe('50\\% \\& \\#1');
		expect(transcribe('a & b', 'html')).toBe('a &amp; b');
		// No command runs into the letter after it: each one is a command the table knows.
		for (const f of WORKED_FORMULAS) {
			for (const m of transcribe(f, 'latex').matchAll(/\\([a-zA-Z]+)/g)) {
				expect(
					SYMBOLS.some((s) => s.latex?.includes(`\\${m[1]}`)),
					m[1]
				).toBe(true);
			}
		}
	});
});

test.describe('the logic-symbols-copy-paste page', () => {
	const path = '/logic-symbols-copy-paste';

	test('the served HTML has every symbol and the default worked detail', async ({ page }) => {
		const html = await (await page.request.get(path)).text();
		expect(html).toContain('U+2227');
		expect(html).toContain('&amp;and;');
		expect(html).toContain('\\land');
		for (const s of SYMBOLS) expect(html, s.id).toContain(`id="sym-${s.id}"`);
		await page.goto(path);
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('#detail')).toContainText('Conjunction');
		// Symbols listed in two groups keep their ids unique.
		const ids = await page.evaluate(() => Array.from(document.querySelectorAll('[id]'), (e) => e.id));
		expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
		await expect(page.locator('#sym-supset-sets')).toBeVisible();
	});

	test('every named entity on the page decodes to its glyph in the browser', async ({ page }) => {
		await page.goto(path);
		const pairs = SYMBOLS.flatMap((s) =>
			[s.entity, ...(s.aliases ?? []).filter((a) => a.startsWith('&'))]
				.filter((ref): ref is string => !!ref)
				.map((ref) => ({ ref, glyph: s.glyph, id: s.id }))
		);
		expect(pairs.length).toBeGreaterThan(70);
		const wrong = await page.evaluate((pairs) => {
			const box = document.createElement('div');
			return pairs.filter(({ ref, glyph }) => {
				box.innerHTML = ref;
				return box.textContent !== glyph;
			});
		}, pairs);
		expect(wrong).toEqual([]);
		const numeric = SYMBOLS.flatMap((s) => [
			{ ref: hexReference(s), glyph: s.glyph },
			{ ref: decimalReference(s), glyph: s.glyph },
			{ ref: htmlCode(s), glyph: s.glyph }
		]);
		const wrongNumeric = await page.evaluate((pairs) => {
			const box = document.createElement('div');
			return pairs.filter(({ ref, glyph }) => {
				box.innerHTML = ref;
				return box.textContent !== glyph;
			});
		}, numeric);
		expect(wrongNumeric).toEqual([]);
	});

	test('clicking a symbol copies it, in the chosen format, and says so', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.locator('#sym-forall').click();
		await expect(page.locator('#copy-status')).toContainText('Copied ∀');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('∀');
		await expect(page.locator('#detail')).toContainText('U+2200');
		await page.getByRole('button', { name: 'LaTeX', exact: true }).click();
		await page.locator('#sym-therefore').click();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('\\therefore');
		await expect(page.locator('#copy-status')).toContainText('amssymb');
		await page.locator('#sym-nor').click();
		await expect(page.locator('#copy-status')).toContainText('no LaTeX command');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('⊽');
		await expect(page).toHaveURL(/as=latex/);
		await expect(page).toHaveURL(/s=nor/);
	});

	test('every copy button in the panel says what it copies', async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		const names = await page
			.locator('#detail button')
			.evaluateAll((els) => els.map((b) => (b.textContent ?? '').replace(/^Copy(?=Copy)/, '').trim()));
		expect(names).toEqual([
			'Copy symbol',
			'Copy the code point U+2227',
			'Copy the HTML &and;',
			'Copy the hex reference &#x2227;',
			'Copy the decimal reference &#8743;',
			'Copy the LaTeX command \\land'
		]);
		await expect(page.getByRole('button', { name: 'Copy the hex reference &#x2227;' })).toHaveCount(1);
	});

	test('a clipboard failure can be dismissed and clears when another symbol is used', async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.evaluate(() => {
			navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
		});
		await page.locator('#sym-forall').click();
		await expect(page.locator('#copy-status')).toContainText('Could not reach the clipboard');
		await page.getByRole('button', { name: 'Dismiss' }).click();
		await expect(page.locator('#copy-status')).toHaveText('');
		await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
		await page.locator('#sym-exists').click();
		await expect(page.locator('#copy-status')).toContainText('Select ∃');
		// Moving to another symbol makes the message out of date, so it goes.
		await page.locator('#sym-exists').press('ArrowRight');
		await expect(page.locator('#copy-status')).toHaveText('');
	});

	test('the keyboard can reach, move through and copy the grid', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		// The grid is one Tab stop: from the last format button, Tab lands on the
		// current tile and the next Tab leaves the grid for the panel.
		await page.getByRole('button', { name: 'Unicode', exact: true }).focus();
		await page.keyboard.press('Tab');
		await expect(page.locator('#sym-and')).toBeFocused();
		await page.keyboard.press('Tab');
		expect(await page.evaluate(() => !!document.activeElement?.closest('#detail'))).toBe(true);
		await expect(page.locator('.tile[tabindex="0"]')).toHaveCount(1);
		await expect(page.locator('#sym-and')).toHaveAttribute('aria-current', 'true');
		// Arrow keys show a symbol in the panel without copying it.
		await page.evaluate(() => navigator.clipboard.writeText('untouched'));
		await page.locator('#sym-not').focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('#sym-tilde')).toBeFocused();
		await expect(page.locator('#detail')).toContainText('Tilde');
		await expect(page.locator('#sym-tilde')).toHaveAttribute('tabindex', '0');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('untouched');
		await page.keyboard.press('End');
		await expect(page.locator('#sym-geq')).toBeFocused();
		await page.keyboard.press('Home');
		await expect(page.locator('#sym-not')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		const focused = await page.evaluate(() => document.activeElement?.id);
		expect(focused).not.toBe('sym-not');
		await page.keyboard.press('Enter');
		await expect(page.locator('#copy-status')).toContainText('Copied');
	});

	test('the filter narrows the grid and explains an empty result', async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.locator('#filter').fill('proper subset');
		await expect(page.locator('.tile')).toHaveCount(2);
		await expect(page.locator('#sym-subset')).toBeVisible();
		await expect(page.locator('#sym-subsetneq')).toBeVisible();
		await expect(page.getByRole('status').filter({ hasText: 'symbols match' })).toHaveText('2 symbols match');
		await page.locator('#filter').fill('zzzz');
		await expect(page.locator('.tile')).toHaveCount(0);
		await expect(page.locator('.empty')).toContainText('No symbol matches');
		await expect(page.getByRole('status').filter({ hasText: 'No symbol' })).toHaveCount(1);
		await expect(page).toHaveURL(/q=zzzz/);
		// The codes the panel shows find their symbol, and a pasted look-alike is named.
		await page.locator('#filter').fill('&#x2227;');
		await expect(page.locator('.tile')).toHaveCount(1);
		await page.locator('#filter').fill('∆');
		await expect(page.locator('#sym-symdiff')).toBeVisible();
		await expect(page.locator('.look-hint')).toContainText('different characters');
		// The reason is read out with the match count, not only shown.
		await expect(page.getByRole('status').filter({ hasText: 'symbol matches' })).toContainText('look-alike of Δ');
		// The first key of a LaTeX command or HTML code does not empty the grid.
		await page.locator('#filter').fill('\\');
		await expect(page.locator('#sym-and')).toBeVisible();
		await page.locator('#filter').fill('&');
		await expect(page.locator('#sym-and')).toBeVisible();
		// The box takes no more than a shared link keeps.
		await expect(page.locator('#filter')).toHaveAttribute('maxlength', '60');
	});

	test('on a phone the panel opens under the group of the tile used', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.setViewportSize({ width: 390, height: 800 });
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		const tile = page.locator('#sym-cup');
		await tile.scrollIntoViewIfNeeded();
		const before = (await tile.boundingBox())?.y ?? 0;
		await tile.click();
		await expect(page.locator('#detail')).toContainText('Union');
		const inSets = await page.evaluate(
			() => !!document.querySelector('#group-sets')?.parentElement?.contains(document.getElementById('detail'))
		);
		expect(inSets).toBe(true);
		// The tile stays where it was tapped.
		const after = (await tile.boundingBox())?.y ?? 0;
		expect(Math.abs(after - before)).toBeLessThan(4);
		await page.locator('#sym-not').click();
		const inConnectives = await page.evaluate(
			() => !!document.querySelector('#group-connectives')?.parentElement?.contains(document.getElementById('detail'))
		);
		expect(inConnectives).toBe(true);
	});

	test('a shared link reopens the same filter, format and symbol', async ({ page }) => {
		await page.goto(`${path}?q=arrow&as=html&s=implies`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#filter')).toHaveValue('arrow');
		await expect(page.getByRole('button', { name: 'HTML', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#detail')).toContainText('U+21D2');
		await expect(page).toHaveURL(/q=arrow/);
		await expect(page).toHaveURL(/as=html/);
		await expect(page).toHaveURL(/s=implies/);
		// Junk in the query string is ignored, not shown.
		await page.goto(`${path}?as=pdf&s=nonsense`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: 'Symbol', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#detail')).toContainText('U+2227');
		// and dropped from the address, so Copy link does not pass it on.
		await expect.poll(() => page.evaluate(() => location.search)).toBe('');
		await page.goto(`${path}?q=${'x'.repeat(200)}&as=latex&s=bogus`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#filter')).toHaveValue('');
		await expect.poll(() => page.evaluate(() => location.search)).toBe('?as=latex');
	});

	test('a long search with no match wraps instead of widening the page', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 900 });
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.locator('#filter').fill('q'.repeat(60));
		await expect(page.locator('.empty')).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);
	});
});
