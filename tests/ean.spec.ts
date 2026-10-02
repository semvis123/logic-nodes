// EAN-13, UPC-A and EAN-8, checked against published codes and against a
// second encoder written from the specification's bar-and-space widths rather
// than from module strings. A decoder then reads every generated symbol back.
// During development the generated symbols were also scanned with OpenCV's
// barcode reader (3000 random codes drawn from the layout, 120 rasterised from
// the SVG file); that needs Python, so it is not part of this suite.

import { expect, test } from '@playwright/test';
import {
	L_CODES,
	G_CODES,
	R_CODES,
	PARITY_PATTERNS,
	QUIET_ZONES,
	SYMBOLOGIES,
	checkDigit,
	checkWorking,
	isValidCode,
	missedTranspositions,
	isbn10Check,
	isbn10To13,
	isbn13To10,
	prefixInfo,
	PREFIX_RANGES,
	parseCode,
	encode,
	layout,
	barcodeSvg,
	symbolModules,
	structure,
	barCount,
	darkModules,
	BarcodeError,
	type Symbology
} from '../src/lib/ean.js';

/** A deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x80000000;
	};
}
const random = rng(13);
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 10)).join('');

// --- An independent implementation -----------------------------------------

/**
 * Widths of space, bar, space, bar for each digit in set A, as tabulated in
 * the specification. Set C has the same widths starting with a bar; set B has
 * them in reverse order.
 */
const WIDTHS_A = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];

function fromWidths(widths: string, firstIsBar: boolean): string {
	let out = '';
	let bar = firstIsBar;
	for (const w of widths) {
		out += (bar ? '1' : '0').repeat(Number(w));
		bar = !bar;
	}
	return out;
}
const refCode = (digit: number, set: 'A' | 'B' | 'C') =>
	set === 'A'
		? fromWidths(WIDTHS_A[digit], false)
		: set === 'B'
		? fromWidths([...WIDTHS_A[digit]].reverse().join(''), false)
		: fromWidths(WIDTHS_A[digit], true);

/** The first digit's sets as a bitmask over the left six, 1 meaning set B: the spec table written another way. */
const PARITY_B_MASK = [
	0b000000, 0b001011, 0b001101, 0b001110, 0b010011, 0b011001, 0b011100, 0b010101, 0b010110, 0b011010
];

/** Check digit as the textbook formula: odd positions plus three times even positions, for 13 digits. */
function refCheck(data: string): number {
	const padded = data.padStart(12, '0');
	let odd = 0;
	let even = 0;
	for (let i = 0; i < 12; i++) {
		if (i % 2 === 0) odd += Number(padded[i]);
		else even += Number(padded[i]);
	}
	return (10 - ((odd + 3 * even) % 10)) % 10;
}

function refModules(code: string, symbology: Symbology): string {
	if (symbology === 'ean8') {
		let out = '101';
		for (let i = 0; i < 4; i++) out += refCode(Number(code[i]), 'A');
		out += '01010';
		for (let i = 4; i < 8; i++) out += refCode(Number(code[i]), 'C');
		return out + '101';
	}
	const ean = symbology === 'upca' ? '0' + code : code;
	const mask = PARITY_B_MASK[Number(ean[0])];
	let out = '101';
	for (let i = 0; i < 6; i++) out += refCode(Number(ean[i + 1]), (mask >> (5 - i)) & 1 ? 'B' : 'A');
	out += '01010';
	for (let i = 7; i < 13; i++) out += refCode(Number(ean[i]), 'C');
	return out + '101';
}

/** Reads modules back to digits, recovering an EAN-13's first digit from the parity of the left half. */
function decode(modules: string, symbology: Symbology): string {
	const half = symbology === 'ean8' ? 4 : 6;
	if (
		modules.slice(0, 3) !== '101' ||
		modules.slice(3 + half * 7, 8 + half * 7) !== '01010' ||
		!modules.endsWith('101')
	) {
		throw new Error('guard patterns are wrong');
	}
	const read = (bits: string, sets: ('A' | 'B' | 'C')[]) => {
		for (const set of sets) {
			for (let d = 0; d < 10; d++) if (refCode(d, set) === bits) return { d, set };
		}
		throw new Error(`no digit reads as ${bits}`);
	};
	const left = Array.from({ length: half }, (_, i) => read(modules.slice(3 + i * 7, 10 + i * 7), ['A', 'B']));
	const right = Array.from({ length: half }, (_, i) =>
		read(modules.slice(8 + half * 7 + i * 7, 15 + half * 7 + i * 7), ['C'])
	);
	let out = [...left, ...right].map((x) => x.d).join('');
	if (symbology !== 'ean8') {
		const mask = left.reduce((m, x) => (m << 1) | (x.set === 'B' ? 1 : 0), 0);
		const first = PARITY_B_MASK.indexOf(mask);
		if (first < 0 || (symbology === 'upca' && first !== 0)) throw new Error('impossible parity pattern');
		if (symbology === 'ean13') out = first + out;
	}
	return out;
}

// --- Tests ------------------------------------------------------------------

test.describe('EAN engine', () => {
	test('the code sets match the specification widths', () => {
		for (let d = 0; d < 10; d++) {
			expect(L_CODES[d]).toBe(refCode(d, 'A'));
			expect(G_CODES[d]).toBe(refCode(d, 'B'));
			expect(R_CODES[d]).toBe(refCode(d, 'C'));
			for (const code of [L_CODES[d], G_CODES[d], R_CODES[d]]) {
				expect(code).toHaveLength(7);
				expect(barCount(code)).toBe(2);
			}
			expect(darkModules(L_CODES[d]) % 2).toBe(1);
			expect(darkModules(G_CODES[d]) % 2).toBe(0);
			expect(darkModules(R_CODES[d]) % 2).toBe(0);
		}
		// All thirty codes are different, which is what lets a scanner tell the sets apart.
		expect(new Set([...L_CODES, ...G_CODES, ...R_CODES]).size).toBe(30);
		PARITY_PATTERNS.forEach((p, d) => {
			const mask = [...p].reduce((m, c) => (m << 1) | (c === 'G' ? 1 : 0), 0);
			expect(mask).toBe(PARITY_B_MASK[d]);
			expect(p[0]).toBe('L');
		});
	});

	test('check digits of published codes', () => {
		for (const code of [
			'4006381333931',
			'9780306406157',
			'5901234123457',
			'036000291452',
			'012345678905',
			'96385074'
		]) {
			expect(isValidCode(code)).toBe(true);
			expect(checkDigit(code.slice(0, -1))).toBe(Number(code.slice(-1)));
		}
		expect(isValidCode('4006381333932')).toBe(false);
		const w = checkWorking('400638133393');
		expect(w.steps.map((s) => s.weight).join('')).toBe('131313131313');
		expect(w.sum).toBe(89);
		expect(w.nextTen).toBe(90);
		expect(w.check).toBe(1);
		// UPC-A counts from the right too, so its first digit is weighted 3.
		expect(checkWorking('03600029145').steps[0].weight).toBe(3);
	});

	test('check digits agree with the textbook formula for random numbers', () => {
		const bad: string[] = [];
		for (let i = 0; i < 5000; i++) {
			for (const n of [7, 11, 12]) {
				const data = digits(n);
				if (checkDigit(data) !== refCheck(data)) bad.push(data);
			}
		}
		// A UPC-A and its EAN-13 form share a check digit.
		for (let i = 0; i < 500; i++) {
			const data = digits(11);
			if (checkDigit(data) !== checkDigit('0' + data)) bad.push(data);
		}
		expect(bad).toEqual([]);
	});

	test('every single digit error is caught, and swaps only of digits five apart are missed', () => {
		const passed: string[] = [];
		for (let i = 0; i < 300; i++) {
			const code = digits(12);
			const full = code + checkDigit(code);
			for (let p = 0; p < 13; p++) {
				for (let d = 0; d < 10; d++) {
					if (String(d) === full[p]) continue;
					const changed = full.slice(0, p) + d + full.slice(p + 1);
					if (isValidCode(changed)) passed.push(changed);
				}
			}
		}
		expect(passed).toEqual([]);
		const missed = missedTranspositions();
		expect(missed).toHaveLength(10);
		for (const [a, b] of missed) expect(Math.abs(a - b)).toBe(5);
		// Brute force over every adjacent swap in a few numbers agrees.
		const wrong: string[] = [];
		for (let i = 0; i < 200; i++) {
			const code = digits(12);
			const full = code + checkDigit(code);
			for (let p = 0; p < 12; p++) {
				const a = Number(full[p]);
				const b = Number(full[p + 1]);
				if (a === b) continue;
				const swapped = full.slice(0, p) + full[p + 1] + full[p] + full.slice(p + 2);
				if (isValidCode(swapped) !== (Math.abs(a - b) === 5)) wrong.push(swapped);
			}
		}
		expect(wrong).toEqual([]);
	});

	test('ISBN-10 to ISBN-13', () => {
		const c = isbn10To13('0-306-40615-2');
		expect(c.isbn13).toBe('9780306406157');
		expect(c.valid10).toBe(true);
		expect(isbn10Check('080442957')).toBe('X');
		const x = isbn10To13('0-8044-2957-X');
		expect(x.valid10).toBe(true);
		expect(x.isbn13).toBe('978080442957' + refCheck('978080442957'));
		const wrong = isbn10To13('0306406151');
		expect(wrong.valid10).toBe(false);
		expect(wrong.expected10).toBe('2');
		expect(wrong.isbn13).toBe('9780306406157');
		expect(isbn13To10('9780306406157')).toBe('0306406152');
		expect(isbn13To10('9791234567896')).toBeNull();
		// Round trips over random ISBNs, checked against the mod 11 definition directly.
		for (let i = 0; i < 2000; i++) {
			const nine = digits(9);
			const check = isbn10Check(nine);
			const sum = [...(nine + check)].reduce((t, ch, j) => t + (ch === 'X' ? 10 : Number(ch)) * (10 - j), 0);
			expect(sum % 11).toBe(0);
			const isbn13 = isbn10To13(nine + check).isbn13;
			expect(isValidCode(isbn13)).toBe(true);
			expect(isbn13To10(isbn13)).toBe(nine + check);
		}
		expect(() => isbn10To13('12345')).toThrow(BarcodeError);
	});

	test('GS1 prefixes', () => {
		expect(prefixInfo('4006381333931')?.meaning).toBe('GS1 Germany');
		expect(prefixInfo('9780306406157')?.meaning).toContain('ISBN');
		expect(prefixInfo('0036000291452')?.meaning).toBe('GS1 US');
		expect(prefixInfo('2001234567893')?.meaning).toContain('Restricted');
		expect(prefixInfo('1500000000000')).toBeNull();
		expect(prefixInfo('6901234567892')?.meaning).toBe('GS1 China');
		expect(prefixInfo('7541234567891')?.meaning).toBe('GS1 Canada');
		expect(prefixInfo('9771234567003')?.meaning).toContain('ISSN');
		expect(prefixInfo('0401234567891')?.meaning).toBe('Restricted circulation within a company');
		expect(prefixInfo('0201234567891')?.meaning).toBe('Restricted circulation within a geographic region');
		expect(prefixInfo('8712345678906')?.meaning).toBe('GS1 Netherlands');
		expect(prefixInfo('5001234567892')?.meaning).toBe('GS1 UK');
		expect(prefixInfo('0501234567891')).toBeNull();
		expect(prefixInfo('9991234567891')).toBeNull();
		// Ranges are in order and never overlap.
		for (let i = 1; i < PREFIX_RANGES.length; i++) {
			expect(PREFIX_RANGES[i].from).toBeGreaterThan(PREFIX_RANGES[i - 1].to);
			expect(PREFIX_RANGES[i].to).toBeGreaterThanOrEqual(PREFIX_RANGES[i].from);
		}
	});

	test('parsing what people type', () => {
		const a = parseCode('400638133393', 'ean13');
		expect(a.code).toBe('4006381333931');
		expect(a.status).toBe('computed');
		expect(parseCode('4 006381 333931', 'ean13').status).toBe('valid');
		const bad = parseCode('4006381333935', 'ean13');
		expect(bad.status).toBe('invalid');
		expect(bad.given).toBe(5);
		expect(bad.code).toBe('4006381333931');
		expect(parseCode('036000291452', 'upca').status).toBe('valid');
		expect(parseCode('03600029145', 'upca').code).toBe('036000291452');
		expect(parseCode('9638507', 'ean8').code).toBe('96385074');
		const isbn = parseCode('0-306-40615-2', 'ean13');
		expect(isbn.code).toBe('9780306406157');
		expect(isbn.isbn?.valid10).toBe(true);
		for (const [text, sym] of [
			['', 'ean13'],
			['12345', 'ean13'],
			['40063813339312', 'ean13'],
			['4006381333a31', 'ean13'],
			['0306406152', 'upca'],
			['123', 'ean8']
		] as const) {
			expect(() => parseCode(text, sym)).toThrow(BarcodeError);
		}
		expect(() => parseCode('12', 'ean8')).toThrow(/7 digits.*or 8/);
		// Typographic hyphens, dashes and minus signs from copied text are separators too.
		for (const dash of ['\u2010', '\u2011', '\u2012', '\u2013', '\u2014', '\u2212', '\u00ad']) {
			expect(parseCode(`400${dash}6381333931`, 'ean13').status).toBe('valid');
			expect(parseCode(`0${dash}306${dash}40615${dash}2`, 'ean13').code).toBe('9780306406157');
			expect(isbn10To13(`0${dash}8044${dash}2957${dash}X`).valid10).toBe(true);
		}
		// The error quotes the character as typed: not upper-cased, and a whole code point.
		expect(() => parseCode('59012x', 'ean13')).toThrow('“x” is not a digit');
		expect(() => parseCode('ß00638133393', 'ean13')).toThrow('“ß” is not a digit');
		expect(() => parseCode('4006😀', 'ean13')).toThrow('“😀” is not a digit');
	});

	test('the modules match the independent encoder and decode back', () => {
		const syms: Symbology[] = ['ean13', 'upca', 'ean8'];
		const bad: string[] = [];
		for (const sym of syms) {
			const n = SYMBOLOGIES[sym].length - 1;
			for (let i = 0; i < 3000; i++) {
				const data = i < 10 ? String(i).repeat(n) : digits(n);
				const code = data + checkDigit(data);
				const b = encode(code, sym);
				const ok =
					b.modules === refModules(code, sym) &&
					b.modules.length === symbolModules(sym) &&
					decode(b.modules, sym) === code &&
					b.width === symbolModules(sym) + QUIET_ZONES[sym].left + QUIET_ZONES[sym].right &&
					b.segments.map((s) => s.bits).join('') === '0'.repeat(b.quiet.left) + b.modules + '0'.repeat(b.quiet.right);
				if (!ok) bad.push(`${sym} ${code}`);
			}
		}
		expect(bad).toEqual([]);
		// A UPC-A draws exactly the bars of its EAN-13 form.
		expect(encode('036000291452', 'upca').modules).toBe(encode('0036000291452', 'ean13').modules);
		expect(encode('4006381333931', 'ean13').parity).toBe('LGLLGG');
		expect(symbolModules('ean13')).toBe(95);
		expect(symbolModules('ean8')).toBe(67);
		// The quiet zones and totals as GS1 gives them, not as the engine's own constants.
		expect(QUIET_ZONES).toEqual({
			ean13: { left: 11, right: 7 },
			upca: { left: 9, right: 9 },
			ean8: { left: 7, right: 7 }
		});
		expect(structure('ean13').reduce((t, p) => t + p.modules, 0)).toBe(113);
		expect(structure('upca').reduce((t, p) => t + p.modules, 0)).toBe(113);
		expect(structure('ean8').reduce((t, p) => t + p.modules, 0)).toBe(81);
		expect(encode('96385074', 'ean8').width).toBe(81);
		expect(encode('036000291452', 'upca').width).toBe(113);
		expect(() => encode('4006381333932', 'ean13')).toThrow(BarcodeError);
		expect(() => encode('400638133393', 'ean13')).toThrow(BarcodeError);
	});

	test('the drawn bars are the modules, and each digit owns its own bars', () => {
		for (const [code, sym] of [
			['4006381333931', 'ean13'],
			['036000291452', 'upca'],
			['96385074', 'ean8']
		] as const) {
			const b = encode(code, sym);
			const l = layout(b);
			const row = Array(l.width).fill('0');
			for (const bar of l.bars) for (let x = bar.x; x < bar.x + bar.width; x++) row[x] = '1';
			expect(row.join('')).toBe(b.segments.map((s) => s.bits).join(''));
			// Every digit of the number is printed once.
			expect(
				l.labels
					.slice()
					.sort((p, q) => p.digitIndex - q.digitIndex)
					.map((t) => t.text)
					.join('')
			).toBe(code);
			for (const span of l.digitSpans) {
				const own = l.bars.filter((bar) => bar.digitIndex === span.digitIndex);
				expect(own).toHaveLength(2);
				for (const bar of own) {
					expect(bar.x).toBeGreaterThanOrEqual(span.x);
					expect(bar.x + bar.width).toBeLessThanOrEqual(span.x + span.width);
				}
			}
			const svg = barcodeSvg(b, 3);
			expect(svg).toContain(`width="${l.width * 3}" height="${l.height * 3}"`);
			expect((svg.match(/<rect /g) ?? []).length).toBe(l.bars.length + 1);
		}
		// UPC-A's outer digits have long bars and sit outside the symbol.
		const upc = layout(encode('036000291452', 'upca'));
		expect(upc.bars.filter((b) => b.long && b.digitIndex === 0)).toHaveLength(2);
		expect(upc.labels.filter((t) => t.small).map((t) => t.text)).toEqual(['0', '2']);
	});
});

test.describe('the ean-13-barcode-generator page', () => {
	const URL_ = '/ean-13-barcode-generator';

	/** Reads the drawn bars back into a module string, quiet zones included. */
	const drawnModules = async (page: import('@playwright/test').Page) => {
		const width = await page.locator('svg.barcode').evaluate((svg) => (svg as SVGSVGElement).viewBox.baseVal.width);
		const bars = await page
			.locator('svg.barcode rect.bar')
			.evaluateAll((rects) => rects.map((r) => [Number(r.getAttribute('x')), Number(r.getAttribute('width'))]));
		const row = Array(width).fill('0');
		for (const [x, w] of bars) for (let i = x; i < x + w; i++) row[i] = '1';
		return row.join('');
	};
	const withQuiet = (code: string, sym: Symbology) => {
		const b = encode(code, sym);
		return '0'.repeat(b.quiet.left) + b.modules + '0'.repeat(b.quiet.right);
	};

	test('the prerendered page already shows the default barcode', async ({ page }) => {
		const html = await (await page.request.get(URL_)).text();
		expect(html).toContain('4 006381 333931');
		expect(html).toContain('GS1 Germany issued the company prefix');
		expect(html).toContain('aria-label="EAN-13 barcode for 4006381333931"');
		// The module listing is in the HTML, segment by segment.
		const segs = [...html.matchAll(/class="seg-bits mono[^"]*">([01]+)</g)].map((m) => m[1]).join('');
		expect(segs).toBe(encode('4006381333931', 'ean13').modules);
		const bars = layout(encode('4006381333931', 'ean13')).bars.length;
		expect((html.match(/class="bar[ "]/g) ?? []).length).toBe(bars);
		await page.goto(URL_);
		expect(await drawnModules(page)).toBe(withQuiet('4006381333931', 'ean13'));
	});

	test('typing checks the number and redraws the bars', async ({ page }) => {
		await page.goto(URL_);
		await page.waitForLoadState('networkidle');
		await page.fill('#code', '5901234123457');
		await expect(page.locator('.answer-value')).toHaveText('5 901234 123457');
		await expect(page.locator('.answer-also')).toContainText('is correct');
		expect(await drawnModules(page)).toBe(withQuiet('5901234123457', 'ean13'));
		await expect(page).toHaveURL(/v=5901234123457/);

		await page.fill('#code', '5901234123450');
		await expect(page.locator('.warning')).toContainText('correct check digit, 7');
		await expect(page.locator('.answer-also')).toContainText('need 7, not 0');

		await expect(page.locator('#code')).toHaveAttribute('aria-describedby', 'code-help');
		const before = await page.locator('.tool').boundingBox();
		await page.fill('#code', '59012x');
		await expect(page.locator('.error')).toContainText('“x” is not a digit');
		// The help is hidden under the error, so only the error describes the field.
		await expect(page.locator('#code')).toHaveAttribute('aria-describedby', 'code-error');
		// The stale barcode and working are inert: out of the tab order, not just dimmed.
		await expect(page.locator('.barcode-figure')).toHaveAttribute('inert', '');
		await expect(page.locator('.working')).toHaveAttribute('inert', '');
		await expect(page.locator('.answer')).toHaveAttribute('role', 'status');
		// The error takes the help text's place, so the card does not grow.
		expect((await page.locator('.tool').boundingBox())?.height).toBe(before?.height);
		await page.locator('#code').focus();
		for (let i = 0; i < 12; i++) {
			await page.keyboard.press('Tab');
			const inside = await page.evaluate(() => !!document.activeElement?.closest('.barcode-figure, .working'));
			expect(inside).toBe(false);
		}
		await page.fill('#code', '12345');
		await expect(page.locator('.error')).toContainText('this is 5 digits');

		await page.fill('#code', '0-306-40615-2');
		await expect(page.locator('.answer-value')).toHaveText('9 780306 406157');
		await expect(page.locator('.answer-also')).toContainText('ISBN-10 0306406152');
	});

	test('switching to UPC-A keeps the same bars', async ({ page }) => {
		await page.goto(URL_);
		await page.waitForLoadState('networkidle');
		await page.fill('#code', '0036000291452');
		const ean = await drawnModules(page);
		await expect(page.locator('.hint')).toHaveCount(0);
		await page.getByRole('button', { name: 'UPC-A', exact: true }).click();
		await expect(page.locator('#code')).toHaveValue('036000291452');
		await expect(page.locator('.answer-value')).toHaveText('0 36000 29145 2');
		// Same 95 modules; only the quiet zones differ (11 and 7 against 9 and 9).
		const upc = await drawnModules(page);
		expect(upc.slice(9, -9)).toBe(ean.slice(11, -7));
		await expect(page).toHaveURL(/sym=upca/);

		// Twelve digits with a valid UPC check digit in the EAN-13 field get a hint.
		await page.getByRole('button', { name: 'EAN-13', exact: true }).click();
		await page.fill('#code', '036000291452');
		await page.getByRole('button', { name: 'Read them as UPC-A' }).click();
		await expect(page.getByRole('button', { name: 'UPC-A', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#code')).toHaveValue('036000291452');

		// Pressing UPC-A instead of the hint keeps the typed number too, not the 13 digit code with its 0 dropped.
		await page.getByRole('button', { name: 'EAN-13', exact: true }).click();
		await page.fill('#code', '036000291452');
		await page.getByRole('button', { name: 'UPC-A', exact: true }).click();
		await expect(page.locator('#code')).toHaveValue('036000291452');
		await expect(page.locator('.answer-value')).toHaveText('0 36000 29145 2');
		// Back to EAN-13 puts the 0 in front of what was typed.
		await page.getByRole('button', { name: 'EAN-13', exact: true }).click();
		await expect(page.locator('#code')).toHaveValue('0036000291452');
		// A UPC-A with a mistyped check digit is kept as typed, and flagged, rather than shifted along.
		await page.getByRole('button', { name: 'EAN-13', exact: true }).click();
		await page.fill('#code', '036000291453');
		await expect(page.locator('.hint')).toContainText('the first 11 need 2, not 3');
		await page.getByRole('button', { name: 'UPC-A', exact: true }).click();
		await expect(page.locator('#code')).toHaveValue('036000291453');
		await expect(page.locator('.answer-also')).toContainText('need 2, not 3');
		// A number that cannot be a UPC-A falls back to the UPC-A example.
		await page.getByRole('button', { name: 'EAN-13', exact: true }).click();
		await page.fill('#code', '400638133393');
		await page.getByRole('button', { name: 'UPC-A', exact: true }).click();
		await expect(page.locator('#code')).toHaveValue('03600029145');
	});

	test('a shared link reopens the same barcode', async ({ page }) => {
		await page.goto(`${URL_}?v=9638507&sym=ean8`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.answer-value')).toHaveText('9638 5074');
		await expect(page.getByRole('button', { name: 'EAN-8', exact: true })).toHaveAttribute('aria-pressed', 'true');
		expect(await drawnModules(page)).toBe(withQuiet('96385074', 'ean8'));
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#code')).toHaveValue('9638507');
		await expect(page).toHaveURL(/v=9638507/);
		await expect(page).toHaveURL(/sym=ean8/);
		// Junk in the link falls back to the defaults rather than breaking the page.
		await page.goto(`${URL_}?sym=qr`);
		await expect(page.locator('.answer-value')).toHaveText('4 006381 333931');
		// A type with no number opens that type's example, not the EAN-13 default.
		await page.goto(`${URL_}?sym=upca`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.answer-value')).toHaveText('0 36000 29145 2');
		await expect(page.locator('.warning')).toHaveCount(0);
		await page.goto(`${URL_}?sym=ean8`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.error')).toHaveText('');
		await expect(page.locator('.answer-value')).toHaveText('9638 5074');
		// An empty or over-long value falls back to the default and is cleaned out of the address.
		await page.goto(`${URL_}?v=`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(/ean-13-barcode-generator$/);
		await page.goto(`${URL_}?v=${'1'.repeat(41)}`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(/ean-13-barcode-generator$/);
	});

	test('focusing a digit lights up its bars', async ({ page }) => {
		await page.goto(URL_);
		await page.waitForLoadState('networkidle');
		const buttons = page.locator('.digit-btn');
		await expect(buttons).toHaveCount(13);
		await buttons.nth(2).focus();
		await expect(page.locator('svg.barcode rect.band')).toHaveCount(1);
		await expect(page.locator('svg.barcode rect.bar.hot')).toHaveCount(2);
		await expect(page.locator('#digit-detail')).toContainText('Position 3: 0 drawn with its G code 0100111');
		await buttons.nth(0).focus();
		await expect(page.locator('svg.barcode rect.band')).toHaveCount(6);
		await expect(page.locator('#digit-detail')).toContainText('LGLLGG');
		await buttons.nth(0).blur();
		await expect(page.locator('svg.barcode rect.band')).toHaveCount(0);
		// Hovering the bars works the other way round.
		const target = page.locator('svg.barcode rect.hover-target').nth(7);
		await target.hover();
		await expect(buttons.nth(8)).toHaveClass(/hot/);

		// A click pins a digit: it stays lit after the pointer and focus leave, until Escape.
		await buttons.nth(4).click();
		await expect(buttons.nth(4)).toHaveAttribute('aria-pressed', 'true');
		await page.mouse.move(0, 0);
		await page.locator('#code').focus();
		await expect(buttons.nth(4)).toHaveClass(/hot/);
		await expect(page.locator('svg.barcode rect.bar.hot')).toHaveCount(2);
		await buttons.nth(4).focus();
		await page.keyboard.press('Escape');
		await expect(buttons.nth(4)).toHaveAttribute('aria-pressed', 'false');
		await page.locator('#code').focus();
		await expect(page.locator('svg.barcode rect.bar.hot')).toHaveCount(0);
		// Leaving the bars goes back to the focused digit rather than to nothing.
		await buttons.nth(1).focus();
		await page.locator('svg.barcode rect.hover-target').nth(9).hover();
		await expect(buttons.nth(10)).toHaveClass(/hot/);
		await page.mouse.move(0, 0);
		await expect(buttons.nth(1)).toHaveClass(/hot/);
	});

	test('on a phone a copy of the bars stays in view above the digit strip', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await page.goto(URL_);
		await page.waitForLoadState('networkidle');
		const mini = page.locator('.mini-paper');
		await expect(mini).toBeVisible();
		// The same bars as the full barcode.
		expect(await mini.locator('rect.mini-bar').count()).toBe(await page.locator('svg.barcode rect.bar').count());
		const last = page.locator('.digit-btn').last();
		await last.scrollIntoViewIfNeeded();
		await last.click();
		await expect(mini.locator('rect.mini-bar.hot')).toHaveCount(2);
		const box = await mini.boundingBox();
		expect(box && box.y >= 0 && box.y + box.height <= 800).toBe(true);
		// On a wide screen the barcode itself is near enough, so the copy is not shown.
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(mini).toBeHidden();
	});

	test('hovering a UPC-A digit printed outside the bars lights it up', async ({ page }) => {
		await page.goto(`${URL_}?v=036000291452&sym=upca`);
		await page.waitForLoadState('networkidle');
		await page.locator('svg.barcode').evaluate((svg) => svg.scrollIntoView({ block: 'center' }));
		// The printed digits sit under their (invisible) hover targets, so the pointer goes to where the digit is drawn.
		const smalls = page.locator('svg.barcode text.digit-label');
		await smalls.first().hover({ force: true });
		await expect(page.locator('.digit-btn').first()).toHaveClass(/hot/);
		await smalls.last().hover({ force: true });
		await expect(page.locator('.digit-btn').last()).toHaveClass(/hot/);
	});

	test('each copy button confirms beside itself', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto(URL_);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Copy modules' }).click();
		await expect(page.locator('.module-line .copy-status')).toHaveText('Modules copied');
		await expect(page.locator('.barcode-figure .copy-status')).toHaveText('');
		await page.getByRole('button', { name: 'Copy number' }).click();
		await expect(page.locator('.barcode-figure .copy-status')).toHaveText('Number copied');
	});

	test('the downloads are the barcode', async ({ page }) => {
		await page.goto(URL_);
		await page.waitForLoadState('networkidle');
		const [svg] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'Download SVG' }).click()
		]);
		expect(svg.suggestedFilename()).toBe('ean-13-4006381333931.svg');
		const fs = await import('node:fs/promises');
		const text = await fs.readFile((await svg.path()) as string, 'utf8');
		expect(text).toBe(barcodeSvg(encode('4006381333931', 'ean13')));
		const [png] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'Download PNG' }).click()
		]);
		expect(png.suggestedFilename()).toBe('ean-13-4006381333931.png');
		const bytes = await fs.readFile((await png.path()) as string);
		expect(bytes.subarray(1, 4).toString()).toBe('PNG');
		// Six pixels per module: 113 modules wide.
		expect(bytes.readUInt32BE(16)).toBe(113 * 6);
	});

	test('the FAQ structured data matches the visible answers', async ({ page }) => {
		await page.goto(URL_);
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) as string);
		const webPage = ld['@graph'].find((n: { '@type': string[] }) => Array.isArray(n['@type']));
		const visible = await page.locator('.faq details').evaluateAll((ds) =>
			ds.map((d) => ({
				q: d.querySelector('summary')?.textContent?.trim(),
				a: d.querySelector('p')?.textContent?.trim()
			}))
		);
		expect(
			webPage.mainEntity.map((m: { name: string; acceptedAnswer: { text: string } }) => ({
				q: m.name,
				a: m.acceptedAnswer.text
			}))
		).toEqual(visible);
		expect(visible.length).toBeGreaterThanOrEqual(4);
	});
});
