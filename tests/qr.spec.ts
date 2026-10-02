// The QR encoder against known answers and the standard's capacity and
// format tables, Reed–Solomon codewords checked by syndromes computed with an
// independent field multiply, the BCH codes checked by polynomial division,
// and the layout of the function patterns. Then the page, as a reader uses it.
//
// During development every version, level, mode and mask was also rendered and
// read back with OpenCV's QR decoder; that needs Python, so it is not part of
// this suite.

import { expect, test } from '@playwright/test';
import {
	encodeQr,
	capacity,
	dataCodewords,
	totalCodewords,
	remainderBits,
	rawDataModules,
	blockLayout,
	alignmentPositions,
	charCountBits,
	chooseMode,
	smallestVersion,
	formatBits,
	versionBits,
	FORMAT_MASK,
	FORMAT_GENERATOR,
	VERSION_GENERATOR,
	GF_EXP,
	gfMul,
	rsRemainder,
	penalty,
	MASKS,
	EC_LEVELS,
	symbolSize,
	codewordOutlines,
	codewordLabels,
	rolePaths,
	qrSvg,
	describeModule,
	QrError,
	type QrCode,
	type EcLevel
} from '../src/lib/qr.js';

/** Carry-less multiply then reduce by 0x11D, bit by bit: a different route to the same field. */
function slowMul(a: number, b: number): number {
	let product = 0;
	for (let i = 0; i < 8; i++) if ((b >> i) & 1) product ^= a << i;
	for (let bit = 15; bit >= 8; bit--) if ((product >> bit) & 1) product ^= 0x11d << (bit - 8);
	return product;
}

function slowPow(a: number, n: number): number {
	let r = 1;
	for (let i = 0; i < n; i++) r = slowMul(r, a);
	return r;
}

/** The remainder of a binary polynomial division, for the BCH checks. */
function polyMod(value: number, generator: number): number {
	const gLen = generator.toString(2).length;
	for (let bit = value.toString(2).length - 1; bit >= gLen - 1; bit--)
		if ((value >> bit) & 1) value ^= generator << (bit - gLen + 1);
	return value;
}

const popcount = (n: number) => n.toString(2).replace(/0/g, '').length;

/** A deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x80000000;
	};
}

const errorOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(QrError);
		return (e as Error).message;
	}
	throw new Error('expected a QrError');
};

/** The 15 format bits as read back from one of the two copies in a symbol. */
function readFormat(qr: QrCode, copy: 1 | 2): number {
	let bits = 0;
	for (let y = 0; y < qr.size; y++)
		for (let x = 0; x < qr.size; x++) {
			const m = qr.info[y][x];
			if (m.role === 'format' && m.copy === copy && qr.modules[y][x]) bits |= 1 << m.bit;
		}
	return bits;
}

test.describe('known answers', () => {
	test('HELLO WORLD at 1-Q, codewords and error correction', () => {
		const qr = encodeQr('HELLO WORLD', { ec: 'Q' });
		expect(qr).toMatchObject({ version: 1, size: 21, mode: 'alphanumeric', count: 11 });
		expect(qr.fields[0].bits).toBe('0010');
		expect(qr.fields[1].bits).toBe('000001011');
		expect(qr.groups.slice(0, 2)).toEqual([
			{ chars: 'HE', value: 779, bits: '01100001011' },
			{ chars: 'LL', value: 966, bits: '01111000110' }
		]);
		expect(qr.groups[5]).toEqual({ chars: 'D', value: 13, bits: '001101' });
		expect(qr.dataCodewords).toEqual([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236]);
		expect(qr.blocks).toHaveLength(1);
		expect(qr.blocks[0].ec).toEqual([168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
		expect(qr.sequence).toEqual([...qr.dataCodewords, ...qr.blocks[0].ec]);
		expect(qr.padCount).toBe(3);
	});

	test('01234567, the numeric mode example', () => {
		const qr = encodeQr('01234567', { ec: 'M' });
		const bits = qr.fields
			.slice(0, 3)
			.map((f) => f.bits)
			.join('');
		expect(bits).toBe('0001' + '0000001000' + '0000001100' + '0101011001' + '1000011');
	});
});

test.describe('capacity tables', () => {
	test('characters per symbol match the standard', () => {
		const table: [number, EcLevel, number, number, number][] = [
			[1, 'L', 41, 25, 17],
			[1, 'M', 34, 20, 14],
			[1, 'Q', 27, 16, 11],
			[1, 'H', 17, 10, 7],
			[10, 'L', 652, 395, 271],
			[10, 'M', 513, 311, 213],
			[10, 'Q', 364, 221, 151],
			[10, 'H', 288, 174, 119],
			[40, 'L', 7089, 4296, 2953],
			[40, 'M', 5596, 3391, 2331],
			[40, 'Q', 3993, 2420, 1663],
			[40, 'H', 3057, 1852, 1273]
		];
		for (const [v, ec, numeric, alnum, bytes] of table) {
			expect([capacity(v, ec, 'numeric'), capacity(v, ec, 'alphanumeric'), capacity(v, ec, 'byte')]).toEqual([
				numeric,
				alnum,
				bytes
			]);
		}
	});

	test('codeword counts, blocks and remainder bits', () => {
		expect(EC_LEVELS.map((ec) => dataCodewords(1, ec))).toEqual([19, 16, 13, 9]);
		expect(EC_LEVELS.map((ec) => dataCodewords(40, ec))).toEqual([2956, 2334, 1666, 1276]);
		expect(totalCodewords(1)).toBe(26);
		expect(totalCodewords(40)).toBe(3706);
		expect(blockLayout(5, 'Q')).toEqual([
			{ count: 2, data: 15, ec: 18 },
			{ count: 2, data: 16, ec: 18 }
		]);
		expect(blockLayout(21, 'L')).toEqual([
			{ count: 4, data: 116, ec: 28 },
			{ count: 4, data: 117, ec: 28 }
		]);
		const remainders = Array.from({ length: 40 }, (_, i) => remainderBits(i + 1));
		const expected = (v: number) =>
			v === 1 ? 0 : v <= 6 ? 7 : v <= 13 ? 0 : v <= 20 ? 3 : v <= 27 ? 4 : v <= 34 ? 3 : 0;
		expect(remainders).toEqual(remainders.map((_, i) => expected(i + 1)));
		for (let v = 1; v <= 40; v++)
			for (const ec of EC_LEVELS) {
				const layout = blockLayout(v, ec);
				expect(layout.reduce((n, g) => n + g.count * (g.data + g.ec), 0)).toBe(totalCodewords(v));
			}
	});

	test('the character count field widens at versions 10 and 27', () => {
		expect([9, 10, 26, 27].map((v) => charCountBits('numeric', v))).toEqual([10, 12, 12, 14]);
		expect([9, 10, 26, 27].map((v) => charCountBits('alphanumeric', v))).toEqual([9, 11, 11, 13]);
		expect([9, 10, 26, 27].map((v) => charCountBits('byte', v))).toEqual([8, 16, 16, 16]);
	});

	test('a full symbol fits, one character more needs the next version', () => {
		for (const v of [1, 2, 9, 10, 26, 27, 39])
			for (const ec of EC_LEVELS) {
				const digits = '7'.repeat(capacity(v, ec, 'numeric'));
				expect(smallestVersion(digits, ec)).toBe(v);
				expect(smallestVersion(digits + '7', ec)).toBe(v + 1);
				const letters = 'A'.repeat(capacity(v, ec, 'alphanumeric'));
				expect(smallestVersion(letters, ec)).toBe(v);
				expect(smallestVersion(letters + 'A', ec)).toBe(v + 1);
				const bytes = 'a'.repeat(capacity(v, ec, 'byte'));
				expect(smallestVersion(bytes, ec)).toBe(v);
				expect(smallestVersion(bytes + 'a', ec)).toBe(v + 1);
			}
	});
});

test.describe('modes', () => {
	test('the most compact mode that fits the whole text', () => {
		expect(chooseMode('0123456789')).toBe('numeric');
		expect(chooseMode('HELLO WORLD')).toBe('alphanumeric');
		expect(chooseMode('HTTP://EXAMPLE.COM/A-B')).toBe('alphanumeric');
		expect(chooseMode('Hello')).toBe('byte');
		expect(chooseMode('ABC!')).toBe('byte');
		expect(chooseMode('café')).toBe('byte');
	});

	test('numeric groups of three, and byte mode as UTF-8', () => {
		const numeric = encodeQr('01234567', { ec: 'M' });
		expect(numeric.groups.map((g) => [g.chars, g.bits])).toEqual([
			['012', '0000001100'],
			['345', '0101011001'],
			['67', '1000011']
		]);
		const bytes = encodeQr('é😀', { ec: 'L' });
		expect(bytes.count).toBe(6);
		expect(bytes.groups.map((g) => g.value)).toEqual([0xc3, 0xa9, 0xf0, 0x9f, 0x98, 0x80]);
		expect(bytes.groups.map((g) => g.chars)).toEqual(['é', '', '😀', '', '', '']);
	});

	test('the bit stream: terminator, zeros to a byte, then alternating pad bytes', () => {
		for (const text of ['1', 'HELLO WORLD', 'Hello, world', 'x'.repeat(17)]) {
			const qr = encodeQr(text, { ec: 'L' });
			const bits = qr.fields.map((f) => f.bits).join('');
			expect(bits.length).toBe(dataCodewords(qr.version, 'L') * 8);
			const terminator = qr.fields.find((f) => f.kind === 'terminator');
			expect(terminator?.bits).toMatch(/^0{0,4}$/);
			const pads = qr.dataCodewords.slice(qr.dataCodewords.length - qr.padCount);
			expect(pads).toEqual(pads.map((_, i) => (i % 2 ? 0x11 : 0xec)));
		}
	});
});

test.describe('the field and the error correction', () => {
	test('the exponent table is the powers of α = 2', () => {
		for (let i = 0; i < 255; i++) expect(GF_EXP[i]).toBe(slowPow(2, i));
		expect(new Set(GF_EXP.slice(0, 255)).size).toBe(255);
		const random = rng(5);
		for (let n = 0; n < 2000; n++) {
			const a = Math.floor(random() * 256);
			const b = Math.floor(random() * 256);
			expect(gfMul(a, b)).toBe(slowMul(a, b));
		}
	});

	test('every block is a codeword: the syndromes at α⁰ … α^(n−1) are zero', () => {
		const random = rng(11);
		for (let n = 0; n < 60; n++) {
			const v = 1 + Math.floor(random() * 40);
			const ec = EC_LEVELS[Math.floor(random() * 4)];
			const text = 'Q'.repeat(1 + Math.floor(random() * capacity(v, ec, 'alphanumeric')));
			const qr = encodeQr(text, { ec, version: Math.max(v, smallestVersion(text, ec)) });
			const syndromes: number[] = [];
			for (const block of qr.blocks) {
				const word = [...block.data, ...block.ec];
				for (let i = 0; i < block.ec.length; i++) {
					const root = slowPow(2, i);
					let s = 0;
					for (const c of word) s = slowMul(s, root) ^ c;
					syndromes.push(s);
				}
			}
			expect(syndromes.filter((s) => s !== 0)).toEqual([]);
		}
		// A changed codeword is detected.
		const data = [1, 2, 3, 4, 5];
		const ecw = rsRemainder(data, 10);
		const word = [...data, ...ecw];
		word[2] ^= 0x40;
		let s = 0;
		for (const c of word) s = slowMul(s, 2) ^ c;
		expect(s).not.toBe(0);
	});

	test('blocks are interleaved: first codeword of each block, then the second, and so on', () => {
		const qr = encodeQr('x'.repeat(100), { ec: 'H' });
		expect(qr.blocks.length).toBeGreaterThan(1);
		const b = qr.blocks;
		expect(qr.sequence.slice(0, b.length)).toEqual(b.map((block) => block.data[0]));
		const dataTotal = b.reduce((n, block) => n + block.data.length, 0);
		expect(qr.sequence.slice(dataTotal, dataTotal + b.length)).toEqual(b.map((block) => block.ec[0]));
		expect(qr.sequence.length).toBe(totalCodewords(qr.version));
		expect(qr.origin.filter((o) => o.kind === 'data')).toHaveLength(dataTotal);
	});
});

test.describe('format and version information', () => {
	test('the format bits match the standard', () => {
		expect(formatBits('L', 0).toString(2).padStart(15, '0')).toBe('111011111000100');
		expect(formatBits('M', 0).toString(2).padStart(15, '0')).toBe('101010000010010');
		expect(formatBits('Q', 0).toString(2).padStart(15, '0')).toBe('011010101011111');
		expect(formatBits('H', 0).toString(2).padStart(15, '0')).toBe('001011010001001');
	});

	test('every format code is a BCH(15,5) codeword at distance 7 or more from the others', () => {
		const codes = EC_LEVELS.flatMap((ec) => MASKS.map((_, k) => formatBits(ec, k)));
		expect(new Set(codes).size).toBe(32);
		for (const c of codes) expect(polyMod(c ^ FORMAT_MASK, FORMAT_GENERATOR)).toBe(0);
		for (const a of codes) for (const b of codes) if (a !== b) expect(popcount(a ^ b)).toBeGreaterThanOrEqual(7);
	});

	test('the version bits match the standard, and are BCH(18,6) codewords', () => {
		expect(versionBits(7)).toBe(0x07c94);
		expect(versionBits(8)).toBe(0x085bc);
		expect(versionBits(40)).toBe(0x28c69);
		const codes = Array.from({ length: 34 }, (_, i) => versionBits(i + 7));
		for (const [i, c] of codes.entries()) {
			expect(c >> 12).toBe(i + 7);
			expect(polyMod(c, VERSION_GENERATOR)).toBe(0);
		}
		for (const a of codes) for (const b of codes) if (a !== b) expect(popcount(a ^ b)).toBeGreaterThanOrEqual(8);
	});

	test('both copies in the symbol agree, for every level and mask', () => {
		for (const ec of EC_LEVELS)
			for (let mask = 0; mask < 8; mask++) {
				const qr = encodeQr('FORMAT', { ec, mask });
				expect(readFormat(qr, 1)).toBe(formatBits(ec, mask));
				expect(readFormat(qr, 2)).toBe(formatBits(ec, mask));
			}
		const big = encodeQr('V', { version: 12 });
		for (const copy of [1, 2]) {
			let bits = 0;
			for (let y = 0; y < big.size; y++)
				for (let x = 0; x < big.size; x++) {
					const m = big.info[y][x];
					if (m.role === 'version' && m.copy === copy && big.modules[y][x]) bits |= 1 << m.bit;
				}
			expect(bits).toBe(versionBits(12));
		}
	});
});

test.describe('the layout', () => {
	test('alignment pattern centres match the standard table', () => {
		expect(alignmentPositions(1)).toEqual([]);
		expect(alignmentPositions(2)).toEqual([6, 18]);
		expect(alignmentPositions(7)).toEqual([6, 22, 38]);
		expect(alignmentPositions(14)).toEqual([6, 26, 46, 66]);
		expect(alignmentPositions(21)).toEqual([6, 28, 50, 72, 94]);
		expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
		expect(alignmentPositions(36)).toEqual([6, 24, 50, 76, 102, 128, 154]);
		expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
	});

	test('function patterns sit where the standard puts them, in every version', () => {
		for (let v = 1; v <= 40; v++) {
			const qr = encodeQr('1', { version: v, ec: 'L' });
			const n = symbolSize(v);
			const at = (x: number, y: number) => qr.modules[y][x];
			// Finder patterns: a dark ring, a light ring, a dark 3×3 centre.
			const wrong: string[] = [];
			for (const [ox, oy] of [
				[0, 0],
				[n - 7, 0],
				[0, n - 7]
			])
				for (let dy = 0; dy < 7; dy++)
					for (let dx = 0; dx < 7; dx++) {
						const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
						if (at(ox + dx, oy + dy) !== (ring !== 2) || qr.info[oy + dy][ox + dx].role !== 'finder')
							wrong.push(`finder ${ox + dx},${oy + dy}`);
					}
			// Timing patterns alternate between the finders, starting dark.
			for (let i = 8; i < n - 8; i++) {
				if (qr.info[6][i].role === 'timing' && at(i, 6) !== (i % 2 === 0)) wrong.push(`timing ${i},6`);
				if (qr.info[i][6].role === 'timing' && at(6, i) !== (i % 2 === 0)) wrong.push(`timing 6,${i}`);
			}
			// The dark module.
			expect(at(8, 4 * v + 9)).toBe(true);
			expect(qr.info[4 * v + 9][8].role).toBe('dark');
			// Separators are light.
			let separators = 0;
			for (let y = 0; y < n; y++)
				for (let x = 0; x < n; x++)
					if (qr.info[y][x].role === 'separator') {
						separators++;
						if (at(x, y)) wrong.push(`separator ${x},${y}`);
					}
			expect(wrong).toEqual([]);
			expect(separators).toBe(3 * 15);
			// Every module left over for codewords is used, and nothing else.
			let free = 0;
			for (const row of qr.info) for (const m of row) if (['data', 'ec', 'remainder'].includes(m.role)) free++;
			expect(free).toBe(rawDataModules(v));
			const roles = qr.info.flat();
			expect(roles.filter((m) => m.role === 'remainder')).toHaveLength(remainderBits(v));
			expect(roles.filter((m) => m.role === 'version')).toHaveLength(v >= 7 ? 36 : 0);
			expect(roles.filter((m) => m.role === 'format')).toHaveLength(30);
		}
	});

	test('each codeword is eight modules, bit 7 placed first', () => {
		const qr = encodeQr('https://logicgates.org/qr-code-generator', { ec: 'M' });
		const bits: number[][] = qr.sequence.map(() => []);
		for (const row of qr.info) for (const m of row) if (m.codeword >= 0) bits[m.codeword].push(m.bit);
		for (const b of bits) expect(b.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		// The first codeword starts in the bottom right corner, going up.
		expect(qr.info[qr.size - 1][qr.size - 1]).toMatchObject({ codeword: 0, bit: 7 });
		expect(qr.info[qr.size - 1][qr.size - 2]).toMatchObject({ codeword: 0, bit: 6 });
		expect(qr.info[qr.size - 2][qr.size - 1]).toMatchObject({ codeword: 0, bit: 5 });
	});
});

test.describe('masks and penalties', () => {
	test('the mask inverts data and error correction modules only', () => {
		for (let mask = 0; mask < 8; mask++) {
			const qr = encodeQr('MASK TEST 123', { ec: 'H', version: 7, mask });
			const wrong: string[] = [];
			for (let y = 0; y < qr.size; y++)
				for (let x = 0; x < qr.size; x++) {
					const role = qr.info[y][x].role;
					const flip = ['data', 'ec', 'remainder'].includes(role) && MASKS[mask].test(x, y);
					if (qr.modules[y][x] !== (qr.unmasked[y][x] !== flip)) wrong.push(`${x},${y}`);
				}
			expect(wrong).toEqual([]);
		}
	});

	test('the automatic choice is the lowest total, and every total adds up', () => {
		const random = rng(3);
		for (let n = 0; n < 20; n++) {
			const text = String(Math.floor(random() * 1e9)) + 'abc'.repeat(Math.floor(random() * 30));
			const qr = encodeQr(text, { ec: EC_LEVELS[n % 4] });
			const lowest = Math.min(...qr.penalties.map((p) => p.total));
			expect(qr.penalties[qr.mask].total).toBe(lowest);
			expect(qr.penalties.findIndex((p) => p.total === lowest)).toBe(qr.mask);
			for (const p of qr.penalties) expect(p.total).toBe(p.runs + p.boxes + p.finders + p.balance);
			expect(penalty(qr.modules).total).toBe(lowest);
		}
	});

	test('the four rules on hand-made patterns', () => {
		const blank = Array.from({ length: 21 }, () => new Array(21).fill(false));
		// 42 lines of 21: 3 + 16 each; 20×20 boxes of 3; no finder lookalikes; 0% dark is 10 steps of 5%.
		expect(penalty(blank)).toMatchObject({ runs: 42 * 19, boxes: 1200, finders: 0, balance: 100 });
		const checker = blank.map((row, y) => row.map((_, x) => (x + y) % 2 === 0));
		// 221 of 441 dark is 50.1%: under one 5% step.
		expect(penalty(checker)).toMatchObject({ runs: 0, boxes: 0, finders: 0, balance: 0 });
		// One finder-like row with light on both sides counts twice.
		const row = blank.map((r) => r.slice());
		[1, 0, 1, 1, 1, 0, 1].forEach((d, i) => (row[10][7 + i] = d === 1));
		expect(penalty(row).finders).toBe(80);
	});
});

test.describe('drawing and errors', () => {
	test('outlines, labels, role paths and the SVG', () => {
		const qr = encodeQr('HELLO WORLD', { ec: 'Q' });
		const labels = codewordLabels(qr);
		expect(labels).toHaveLength(26);
		expect(labels.filter((l) => l.kind === 'data')).toHaveLength(13);
		for (const l of labels) {
			expect(l.x).toBeGreaterThan(0);
			expect(l.x).toBeLessThan(21);
		}
		expect(codewordOutlines(qr)).toMatch(/^M/);
		const paths = rolePaths(qr);
		expect(paths.finder.dark).toContain('M0 0h7v1h-7z');
		expect(paths.separator.dark).toBe('');
		const svg = qrSvg(qr.modules, 10);
		expect(svg).toContain('width="290"');
		expect(svg).toContain('viewBox="0 0 29 29"');
		expect(describeModule(qr, 20, 20)).toContain('codeword 1 (data 1 of block 1, 0x20), bit 7');
		expect(describeModule(qr, 8, 13)).toContain('the dark module');
	});

	test('errors say what is wrong', () => {
		expect(errorOf(() => encodeQr('x'.repeat(2954), { ec: 'L' }))).toMatch(/2954 bytes.*largest QR code holds 2953/);
		expect(errorOf(() => encodeQr('x'.repeat(1300), { ec: 'H' }))).toMatch(/lower error correction level/);
		expect(errorOf(() => encodeQr('x'.repeat(30), { version: 1 }))).toMatch(/smallest version that holds it is 3/);
		expect(errorOf(() => encodeQr('x', { version: 41 }))).toMatch(/version 1 to 40/);
		expect(errorOf(() => encodeQr('x', { mask: 8 }))).toMatch(/0 to 7/);
	});
});

test.describe('the qr-code-generator page', () => {
	test('the prerendered page shows a finished HELLO WORLD code', async ({ page }) => {
		const html = await (await page.request.get('/qr-code-generator')).text();
		expect(html).toContain('Version 1, 21 × 21 modules, level Q, mask 0');
		expect(html).toContain('20 5B 0B 78 D1 72 DC 4D 43 40 EC 11 EC');
		expect(html).toContain('A8 48 16 52 D9 36 9C 00 2E 0F B4 7A 10');
		expect(html).toMatch(/<svg[^>]*class="symbol/);
	});

	test('typing re-encodes, settings change the code, and bad input explains itself', async ({ page }) => {
		await page.goto('/qr-code-generator');
		await page.waitForLoadState('networkidle');
		const answer = page.locator('.answer');
		await page.locator('#qr-text').fill('https://logicgates.org');
		await expect(answer).toContainText('22 bytes in byte mode');
		await expect(answer).toContainText('In capitals it would fit alphanumeric mode');
		await page.getByRole('button', { name: 'H 30%' }).click();
		await expect(answer).toContainText('level H');
		await page.locator('#qr-version').selectOption('10');
		await expect(answer).toContainText('Version 10, 57 × 57 modules');
		await expect(answer).toContainText('Version 3 would have been enough');
		await page.locator('#qr-mask').selectOption('5');
		await expect(answer).toContainText('mask 5');
		await expect(page.locator('.penalties tr.chosen')).toContainText('set');
		// Version information appears from version 7.
		await expect(page.locator('.layer', { hasText: 'Version information' })).toContainText('36');

		await page.locator('#qr-version').selectOption('auto');
		await page.locator('#qr-text').fill('x'.repeat(1300));
		await expect(page.locator('.error')).toContainText('lower error correction level');
		await page.locator('#qr-text').fill('');
		await expect(page.locator('.error')).toContainText('Type some text');
	});

	test('the inspector names the module under the pointer and the arrow keys', async ({ page }) => {
		await page.goto('/qr-code-generator');
		await page.waitForLoadState('networkidle');
		const symbol = page.locator('svg.symbol');
		await symbol.focus();
		await page.keyboard.press('ArrowUp');
		await expect(page.locator('#qr-readout')).toContainText('Row 20, column 20: codeword 1');
		await page.keyboard.press('ArrowLeft');
		await expect(page.locator('#qr-readout')).toContainText('Row 20, column 19: codeword 1');
		const box = await symbol.boundingBox();
		if (!box) throw new Error('the symbol has no box');
		const unit = box.width / 29;
		await page.mouse.move(box.x + unit * (4 + 8.5), box.y + unit * (4 + 13.5));
		await expect(page.locator('#qr-readout')).toContainText('the dark module');
		await page.getByRole('checkbox', { name: /Apply mask/ }).uncheck();
		await expect(page.locator('.anatomy')).toContainText('before masking');
	});

	test('the SVG download is the plain code with its quiet zone', async ({ page }) => {
		await page.goto('/qr-code-generator');
		await page.waitForLoadState('networkidle');
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'Download SVG' }).click()
		]);
		expect(download.suggestedFilename()).toBe('qr-code-v1-Q.svg');
		const path = await download.path();
		const svg = (await import('node:fs')).readFileSync(path ?? '', 'utf8');
		expect(svg).toContain('viewBox="0 0 29 29"');
		expect(svg).toContain('fill="#000"');
	});

	test('a shared link reopens the same code, and the URL follows the settings', async ({ page }) => {
		await page.goto('/qr-code-generator?t=Hello%2C+world&ec=L&v=4&m=3');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#qr-text')).toHaveValue('Hello, world');
		await expect(page.locator('.answer')).toContainText('Version 4, 33 × 33 modules, level L, mask 3');
		await page.getByRole('button', { name: 'M 15%' }).click();
		await expect(page).toHaveURL(/ec=M/);
		await expect(page).toHaveURL(/t=Hello%2C\+world/);
		await page.locator('.chips button', { hasText: 'HELLO WORLD' }).click();
		await expect(page).toHaveURL(/\/qr-code-generator$/);
	});

	test('the FAQ markup matches the questions on the page', async ({ page }) => {
		await page.goto('/qr-code-generator');
		const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
		const graph = blocks.flatMap((text) => JSON.parse(text)['@graph'] ?? []);
		const webPage = graph.find((node: { '@type': string[] }) => [node['@type']].flat().includes('FAQPage'));
		const questions = webPage.mainEntity.map((q: { name: string }) => q.name);
		const answers = webPage.mainEntity.map((q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text);
		expect(questions).toEqual((await page.locator('.faq summary').allTextContents()).map((t) => t.trim()));
		expect(answers).toEqual((await page.locator('.faq details > p').allTextContents()).map((t) => t.trim()));
	});
});
