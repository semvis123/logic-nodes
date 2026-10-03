// The display designer: segment bytes, dot-matrix transforms, generated code and
// the Nixie decoder, each checked against a second, deliberately plain implementation.

import { expect, test } from '@playwright/test';
import {
	FONT,
	FONT_CHARS,
	GLYPHS,
	bcdOutput,
	bcdTable,
	byteCode,
	decodeByte,
	emptyGrid,
	encodeByte,
	flipH,
	flipV,
	fontColumns,
	gridBytes,
	gridFromBytes,
	gridFromHex,
	gridToHex,
	hexTable,
	invert,
	marqueeFrame,
	maskToSegments,
	missingGlyphs,
	renderText,
	rotateCw,
	segmentsToMask,
	textStrip,
	transpose,
	type Grid,
	type Lang
} from '../src/lib/displayDesigner.js';
import { digitSegments, segmentFunctions, litSegments } from '../src/lib/sevenSegment.js';

let seed = 12345;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const randomGrid = (w: number, h: number): Grid =>
	Array.from({ length: h }, () => Array.from({ length: w }, () => rand() < 0.5));

test.describe('seven-segment bytes', () => {
	test('hex digits 0 to F match the usual common cathode table, anode is the complement', () => {
		const expected = '3F 06 5B 4F 66 6D 7D 07 7F 6F 77 7C 39 5E 79 71'.split(' ').map((h) => parseInt(h, 16));
		const t = hexTable();
		expect(t.map((r) => r.cathode)).toEqual(expected);
		expect(t.map((r) => r.anode)).toEqual(expected.map((b) => 255 - b));
	});

	test('digits 0 to 9 agree with the decoder page, including the derived circuit', () => {
		const functions = segmentFunctions();
		for (let d = 0; d < 10; d++) {
			expect(GLYPHS[String(d)]).toBe(digitSegments[d]);
			const lit = [...litSegments(functions, d)].join('');
			expect(segmentsToMask(lit)).toBe(hexTable()[d].mask);
		}
	});

	test('both bit orders and both polarities round-trip all 256 patterns, against a plain loop', () => {
		for (let mask = 0; mask < 256; mask++) {
			expect(maskToSegments(segmentsToMask(maskToSegments(mask)))).toBe(maskToSegments(mask));
			for (const anode of [false, true]) {
				let lsb = 0;
				let msb = 0;
				for (let i = 0; i < 8; i++) {
					const lit = !!(mask & (1 << i));
					const bit = lit !== anode ? 1 : 0;
					lsb += bit * 2 ** i;
					msb += bit * 2 ** (7 - i);
				}
				expect(encodeByte(mask, { order: 'lsb', anode })).toBe(lsb);
				expect(encodeByte(mask, { order: 'msb', anode })).toBe(msb);
				for (const order of ['lsb', 'msb'] as const) {
					expect(decodeByte(encodeByte(mask, { order, anode }), { order, anode })).toBe(mask);
				}
			}
		}
	});

	test('text: case folding, decimal points, missing characters and cut-off', () => {
		expect(renderText('HELP', 4).masks.map((m) => m.toString(16))).toEqual(['76', '79', '38', '73']);
		expect(renderText('3.14', 4).masks).toEqual([0x4f | 0x80, 0x06, 0x66, 0]);
		expect(renderText('1', 3).masks).toEqual([0x06, 0, 0]);
		const r = renderText('gkx12', 3);
		expect(r.missing).toEqual(['g', 'k', 'x']);
		expect(r.cut).toBe(2);
		expect(renderText('AbCdEF', 6).masks).toEqual(
			hexTable()
				.slice(10)
				.map((x) => x.mask)
		);
		expect(renderText('cE', 2).masks).toEqual(renderText('CE', 2).masks);
	});

	test('generated C, Arduino and Verilog parse back to the same bytes', () => {
		const bytes = Array.from({ length: 16 }, () => Math.floor(rand() * 256));
		const parse = (code: string, lang: Lang) =>
			lang === 'verilog'
				? [...code.matchAll(/\d+'d(\d+): seg = 8'h([0-9A-F]{2});/g)]
						.sort((a, b) => +a[1] - +b[1])
						.map((m) => parseInt(m[2], 16))
				: [...code.slice(code.indexOf('{') + 1, code.indexOf('}')).matchAll(/0x([0-9A-F]{2})/g)].map((m) =>
						parseInt(m[1], 16)
				  );
		for (const lang of ['c', 'arduino', 'verilog'] as const) {
			for (const length of [1, 2, 5, 16]) {
				const code = byteCode(bytes.slice(0, length), lang, 'x', 'note');
				expect(parse(code, lang)).toEqual(bytes.slice(0, length));
			}
		}
		expect(byteCode([1, 2, 3], 'arduino', 'x', 'n')).toContain('const byte x[3]');
		expect(byteCode([1, 2, 3], 'c', 'x', 'n')).toContain('const uint8_t x[3]');
		expect(byteCode([1, 2, 3], 'verilog', 'x', 'n', 0xff)).toContain("2'd2: seg = 8'h03;");
		expect(byteCode([1, 2, 3], 'verilog', 'x', 'n', 0xff)).toContain("default: seg = 8'hFF;");
	});
});

test.describe('dot-matrix', () => {
	test('rows and columns round-trip in both bit orders, on random grids', () => {
		for (let k = 0; k < 300; k++) {
			const w = 1 + Math.floor(rand() * 8);
			const h = 1 + Math.floor(rand() * 8);
			const g = randomGrid(w, h);
			for (const lines of ['rows', 'cols'] as const) {
				for (const msb of [true, false]) {
					expect(gridFromBytes(gridBytes(g, lines, msb), w, h, lines, msb)).toEqual(g);
				}
			}
			expect(gridFromHex(gridToHex(g), w, h)).toEqual(g);
		}
	});

	test('byte values follow the stated convention, checked pixel by pixel', () => {
		const g = randomGrid(5, 7);
		const rows = gridBytes(g, 'rows', true);
		const lsbRows = gridBytes(g, 'rows', false);
		const cols = gridBytes(g, 'cols', false);
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 5; c++) {
				expect((rows[r] >> (4 - c)) & 1).toBe(g[r][c] ? 1 : 0);
				expect((lsbRows[r] >> c) & 1).toBe(g[r][c] ? 1 : 0);
				expect((cols[c] >> r) & 1).toBe(g[r][c] ? 1 : 0);
			}
		}
	});

	test('transpose, rotate and flip: every single pixel of a 5 by 7 grid, and random grids', () => {
		for (let r = 0; r < 7; r++) {
			for (let c = 0; c < 5; c++) {
				const g = emptyGrid(5, 7);
				g[r][c] = true;
				const t = transpose(g);
				expect(t.length).toBe(5);
				expect(t[c][r]).toBe(true);
				const rot = rotateCw(g);
				expect(rot.length).toBe(5);
				expect(rot[0].length).toBe(7);
				expect(rot[c][6 - r]).toBe(true);
				expect(flipH(g)[r][4 - c]).toBe(true);
				expect(flipV(g)[6 - r][c]).toBe(true);
			}
		}
		for (let k = 0; k < 200; k++) {
			const g = randomGrid(5, 7);
			expect(transpose(transpose(g))).toEqual(g);
			expect(rotateCw(rotateCw(rotateCw(rotateCw(g))))).toEqual(g);
			expect(flipH(flipH(g))).toEqual(g);
			expect(flipV(flipV(g))).toEqual(g);
			expect(invert(invert(g))).toEqual(g);
			expect(rotateCw(rotateCw(g))).toEqual(flipV(flipH(g)));
			expect(gridBytes(g, 'cols', true)).toEqual(gridBytes(transpose(g), 'rows', true));
		}
	});

	test('the font: every glyph is 5 by 7, distinct, and the strip is the glyphs side by side', () => {
		const seen = new Set<string>();
		for (const ch of FONT_CHARS) {
			expect(FONT[ch]).toHaveLength(7);
			expect(FONT[ch].every((r) => r >= 0 && r < 32)).toBe(true);
			seen.add(FONT[ch].join());
		}
		expect(seen.size).toBe(FONT_CHARS.length);
		expect(FONT['A']).toEqual([0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11]);
		const strip = textStrip('AB');
		expect(strip[0]).toHaveLength(11);
		expect(strip.map((row) => row.slice(0, 5))).toEqual(textStrip('A'));
		expect(strip.map((row) => row.slice(6))).toEqual(textStrip('B'));
		expect(textStrip('a')).toEqual(textStrip('A'));
		expect(textStrip('')[0]).toHaveLength(0);
		expect(fontColumns()).toHaveLength(FONT_CHARS.length * 5);
		expect(missingGlyphs('a~b~@')).toEqual(['~', '@']);
	});

	test('marquee windows wrap with a gap', () => {
		const strip = textStrip('I');
		const period = 5 + 3;
		expect(marqueeFrame(strip, 0, 5)).toEqual(strip);
		expect(marqueeFrame(strip, period, 5)).toEqual(strip);
		expect(marqueeFrame(strip, 1, 8).map((r) => r[7])).toEqual(strip.map((r) => r[0]));
		expect(marqueeFrame(strip, 0, 8).map((r) => r.slice(5))).toEqual(strip.map(() => [false, false, false]));
	});

	test('link hex rejects what does not fit', () => {
		expect(gridFromHex('zz', 5, 1)).toBeUndefined();
		expect(gridFromHex('20', 5, 1)).toBeUndefined();
		expect(gridFromHex('1f', 5, 1)).toEqual([[true, true, true, true, true]]);
		expect(gridFromHex('1f', 5, 2)).toBeUndefined();
	});
});

test.describe('nixie decoder', () => {
	test('codes 0 to 9 select that cathode, 10 to 15 select none', () => {
		const t = bcdTable();
		expect(t).toHaveLength(16);
		t.forEach((r, i) => {
			expect(parseInt(r.bits, 2)).toBe(i);
			expect(r.output).toBe(i < 10 ? i : null);
		});
		expect(bcdOutput(-1)).toBeNull();
		expect(bcdOutput(16)).toBeNull();
	});
});

test.describe('the seven-segment-display-designer page', () => {
	test('the prerendered page shows the default HELP bytes and the 0 to F table', async ({ page }) => {
		const html = await (await page.request.get('/seven-segment-display-designer')).text();
		for (const b of ['0x76', '0x79', '0x38', '0x73', '0x3F', '0xC0', '0x71']) expect(html).toContain(b);
		expect(html).toContain('const uint8_t digits[4]');
	});

	test('clicking a segment changes the byte, and the link round-trips', async ({ page }) => {
		await page.goto('/seven-segment-display-designer');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Digit 1, segment a', exact: true }).click();
		await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText('0x77');
		await page.getByRole('button', { name: 'Common anode' }).click();
		await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText('0x88');
		await page.getByRole('button', { name: 'a b c d e f g dp' }).click();
		const url = page.url();
		expect(url).toContain('cc=anode');
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: 'Common anode' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: 'Digit 1, segment a', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		const first = (await page.locator('tbody tr').first().locator('td').nth(2).textContent()) ?? '';
		// 0x77 is a b c e f g lit; mirrored (a is the top bit) and inverted it is 0x11
		expect(first).toBe(
			'0x' + encodeByte(0x77, { order: 'msb', anode: true }).toString(16).toUpperCase().padStart(2, '0')
		);
	});

	test('typing text and keyboard-toggling a segment', async ({ page }) => {
		await page.goto('/seven-segment-display-designer?n=2');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Type text to show on the digits').fill('10');
		await expect(page.locator('tbody tr').nth(1).locator('td').nth(2)).toHaveText('0x3F');
		const seg = page.getByRole('button', { name: 'Digit 1, decimal point' });
		await seg.focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText('0x86');
		await page.getByLabel('Type text to show on the digits').fill('gx');
		await expect(page.getByRole('status').filter({ hasText: 'No seven-segment shape' })).toContainText('"g", "x"');
	});

	test('the dot-matrix editor paints, drags, transforms and shares', async ({ page }) => {
		await page.goto('/seven-segment-display-designer?t=mat');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('pre').first()).toContainText('0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11');
		await page.getByRole('button', { name: 'Clear' }).click();
		await expect(page.locator('pre').first()).toContainText('0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00');
		const first = page.getByRole('button', { name: 'Row 1, column 1' });
		const box = (await first.boundingBox())!;
		const last = (await page.getByRole('button', { name: 'Row 1, column 3' }).boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 8 });
		await page.mouse.up();
		await expect(page.locator('pre').first()).toContainText('0x1C, 0x00');
		await page.getByRole('button', { name: 'Columns' }).click();
		await expect(page.locator('pre').first()).toContainText('0x40, 0x40, 0x40, 0x00, 0x00');
		await page.getByRole('button', { name: 'Rotate 90°' }).click();
		await expect(page.getByText('7×5 after rotating')).toBeVisible();
		await page.getByRole('button', { name: 'Row 2, column 2' }).focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('button', { name: 'Row 2, column 3' })).toBeFocused();
		await page.keyboard.press('Space');
		await expect(page.getByRole('button', { name: 'Row 2, column 3' })).toHaveAttribute('aria-pressed', 'true');
		const url = page.url();
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: 'Row 2, column 3' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('button', { name: 'Columns' })).toHaveAttribute('aria-pressed', 'true');
	});

	test('nixie tubes show digits, and codes above 9 stay dark', async ({ page }) => {
		await page.goto('/seven-segment-display-designer?t=nix&nx=7A');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('img', { name: 'Tube 1 showing 7' })).toBeVisible();
		await expect(page.getByRole('img', { name: /Tube 2 dark, code 10/ })).toBeVisible();
		await page.getByLabel(/Digits to show on the tubes/).fill('4x2');
		await expect(page.getByRole('img', { name: 'Tube 2 showing 2' })).toBeVisible();
		await expect(page.getByText('other characters were dropped')).toBeVisible();
	});
});
