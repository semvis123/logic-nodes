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
	geq: 0x2265
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
	'mathbb'
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
		const pairs = SYMBOLS.filter((s) => s.entity).map((s) => ({ ref: s.entity ?? '', glyph: s.glyph, id: s.id }));
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

	test('the keyboard can reach, move through and copy the grid', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await page.locator('#sym-not').focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('#sym-tilde')).toBeFocused();
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
		await page.locator('#filter').fill('zzzz');
		await expect(page.locator('.tile')).toHaveCount(0);
		await expect(page.locator('.empty')).toContainText('No symbol matches');
		await expect(page).toHaveURL(/q=zzzz/);
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
	});

	test('the FAQ JSON-LD matches the visible answers', async ({ page }) => {
		await page.goto(path);
		const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
		const graph = JSON.parse(ld ?? '{}')['@graph'];
		const faq = graph[0].mainEntity as { name: string; acceptedAnswer: { text: string } }[];
		const visible = await page.locator('.faq details').evaluateAll((els) =>
			els.map((d) => ({
				q: d.querySelector('summary')?.textContent?.trim(),
				a: d.querySelector('p')?.textContent?.trim()
			}))
		);
		expect(faq.map((f) => ({ q: f.name, a: f.acceptedAnswer.text }))).toEqual(visible);
		expect(faq.length).toBeGreaterThanOrEqual(4);
	});
});
