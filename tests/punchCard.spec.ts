// Punched cards and paper tape. The card code is checked against Python's cp037 (EBCDIC) codec
// through the Hollerith to EBCDIC correspondence, derived separately (see CP037 below), and the
// tape codes against a second, differently laid out copy of the ITA2 table.

import { expect, test } from '@playwright/test';
import {
	CARD_CODE,
	MAX_CHARS,
	UNREADABLE,
	ROWS,
	cardScene,
	cardTable,
	describe,
	ebcdic,
	packCells,
	punch,
	punchLabel,
	read,
	readAscii,
	readBaudot,
	scene,
	sceneSvg,
	unpackCells,
	type Medium
} from '../src/lib/punchCard.js';

// char:punches:hex, from `bytes([b]).decode('cp037')` for the bytes whose Hollerith punches the
// standard correspondence gives (12/11/0 zone high nibbles C/D/E, 8-punch symbols 4x to 7x).
const CP037 =
	'∅:none:40 ¢:12-8-2:4A .:12-8-3:4B <:12-8-4:4C (:12-8-5:4D +:12-8-6:4E |:12-8-7:4F &:12:50 !:11-8-2:5A $:11-8-3:5B *:11-8-4:5C ):11-8-5:5D ;:11-8-6:5E ¬:11-8-7:5F -:11:60 /:0-1:61 ,:0-8-3:6B %:0-8-4:6C _:0-8-5:6D >:0-8-6:6E ?:0-8-7:6F ::8-2:7A #:8-3:7B @:8-4:7C \':8-5:7D =:8-6:7E ":8-7:7F A:12-1:C1 B:12-2:C2 C:12-3:C3 D:12-4:C4 E:12-5:C5 F:12-6:C6 G:12-7:C7 H:12-8:C8 I:12-9:C9 J:11-1:D1 K:11-2:D2 L:11-3:D3 M:11-4:D4 N:11-5:D5 O:11-6:D6 P:11-7:D7 Q:11-8:D8 R:11-9:D9 S:0-2:E2 T:0-3:E3 U:0-4:E4 V:0-5:E5 W:0-6:E6 X:0-7:E7 Y:0-8:E8 Z:0-9:E9 0:0:F0 1:1:F1 2:2:F2 3:3:F3 4:4:F4 5:5:F5 6:6:F6 7:7:F7 8:8:F8 9:9:F9'.split(
		' '
	);
const cardChars = CARD_CODE.map((c) => c.ch);

/** A seeded generator, so a failing property test fails the same way again. */
function rng(seed: number) {
	return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const sample = (alphabet: string[], n: number, next: () => number) =>
	Array.from({ length: n }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');

test.describe('card code', () => {
	test('every character has the punches and EBCDIC byte cp037 gives', () => {
		expect(cardChars.length).toBe(CP037.length);
		for (const v of CP037) {
			const [ch0, punches, hex] = [v[0], v.split(':').slice(-2)[0], v.split(':').slice(-1)[0]];
			const ch = ch0 === '∅' ? ' ' : ch0;
			const entry = CARD_CODE.find((c) => c.ch === ch) ?? { ch, mask: -1 };
			expect(punchLabel(entry.mask), ch).toBe(punches);
			expect((ebcdic(entry.mask) ?? -1).toString(16).toUpperCase(), ch).toBe(hex);
		}
	});

	test('masks are distinct, and all 4096 columns decode without throwing', () => {
		expect(new Set(CARD_CODE.map((c) => c.mask)).size).toBe(CARD_CODE.length);
		const known = new Set(CARD_CODE.map((c) => c.mask));
		for (let m = 0; m < 4096; m++) {
			const { text } = read('card', [m]);
			if (known.has(m)) expect(punch('card', text || ' ').cells[0]).toBe(m);
			else expect(text).toBe(UNREADABLE);
		}
	});

	test('the ebcdic rule gives nothing for punch patterns outside the code', () => {
		expect(ebcdic(0xc00)).toBeUndefined(); // 12 and 11 together
		expect(ebcdic(0x800 | 0x200)).toBeUndefined(); // 12 and 0 together
		expect(ebcdic(0x001 | 0x002)).toBeUndefined(); // 9 and 8 together
	});

	test('rows run 12, 11, 0, 1 to 9 from the top bit down', () => {
		expect(ROWS.join(',')).toBe('12,11,0,1,2,3,4,5,6,7,8,9');
		expect(punch('card', 'A').cells[0]).toBe(0x800 | 0x100);
	});

	test('the code table lists every character once with a 12-bit column', () => {
		const rows = cardTable();
		expect(rows.length).toBe(cardChars.length);
		expect(rows.find((r) => r.ch === 'A')).toMatchObject({ punches: '12-1', column: '100100000000', ebcdic: 'C1' });
	});
});

test.describe('round trips', () => {
	const alphabets: Record<Medium, string[]> = {
		card: cardChars,
		baudot: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789-',:(+)2?./;\n"],
		ascii: [...Array(95)].map((_, i) => String.fromCharCode(32 + i)).concat(['\n', '\r'])
	};
	for (const medium of ['card', 'baudot', 'ascii'] as Medium[]) {
		test(`${medium}: random strings come back as typed`, () => {
			const next = rng(medium.length * 977);
			for (let i = 0; i < 300; i++) {
				const text = sample(alphabets[medium], Math.floor(next() * (MAX_CHARS + 1)), next);
				const punched = punch(medium, text);
				expect(punched.notes).toEqual([]);
				const back = read(medium, punched.cells);
				expect(back.notes).toEqual([]);
				expect(back.text).toBe(medium === 'card' ? text.replace(/ +$/, '') : text);
			}
		});
	}

	test('every supported character survives alone', () => {
		for (const medium of ['card', 'baudot', 'ascii'] as Medium[])
			for (const ch of alphabets[medium])
				if (ch.trim() || medium !== 'card')
					expect(read(medium, punch(medium, ch).cells).text, `${medium} ${JSON.stringify(ch)}`).toBe(ch);
	});

	test('lowercase is punched as capitals on a card and on Baudot tape, as typed on ASCII tape', () => {
		expect(read('card', punch('card', 'hello').cells).text).toBe('HELLO');
		expect(read('baudot', punch('baudot', 'hello').cells).text).toBe('HELLO');
		expect(read('ascii', punch('ascii', 'hello').cells).text).toBe('hello');
	});
});

// The ITA2 table as binary codes, the way a standard prints it, in a different order from the engine's.
const ITA2 =
	`00011 A -|11001 B ?|01110 C :|01001 D ENQ|00001 E 3|01101 F NAT|11010 G NAT|10100 H NAT|00110 I 8|01011 J BEL|01111 K (|10010 L )|11100 M .|01100 N ,|11000 O 9|10110 P 0|10111 Q 1|01010 R 4|00101 S '|10000 T 5|00111 U 7|11110 V ;|10011 W 2|11101 X /|10101 Y 6|10001 Z +|00100 SP SP|01000 CR CR|00010 LF LF|11111 LTRS LTRS|11011 FIGS FIGS|00000 NUL NUL`.split(
		'|'
	);

test.describe('Baudot tape', () => {
	test('letters and figures match the ITA2 table', () => {
		const want = (t: string) =>
			((
				{
					SP: ' ',
					CR: '\r',
					LF: '\n',
					NUL: '',
					LTRS: '',
					FIGS: '',
					NAT: UNREADABLE,
					ENQ: UNREADABLE,
					BEL: UNREADABLE
				} as Record<string, string>
			)[t] ?? t);
		for (const row of ITA2) {
			const [bits, l, f] = row.split(' ');
			const code = parseInt(bits, 2);
			expect(readBaudot([code])[0].out, `letters ${bits}`).toBe(want(l));
			expect(readBaudot([27, code])[1].out, `figures ${bits}`).toBe(want(f));
		}
		expect(ITA2).toHaveLength(32);
	});

	test('shifts are inserted only when the set changes', () => {
		const codes = (t: string) => punch('baudot', t).cells;
		expect(codes('A')).toEqual([3]);
		expect(codes('A1A')).toEqual([3, 27, 23, 31, 3]);
		expect(codes('1 2')).toEqual([27, 23, 4, 19]); // a space belongs to both sets and keeps the shift
		expect(codes('A\nB')).toEqual([3, 8, 2, 25]); // a newline is CR then LF, in either shift
		expect(codes('12\n3')).toEqual([27, 23, 19, 8, 2, 1]);
		expect(
			readBaudot([27, 23, 4, 19])
				.map((f) => f.out)
				.join('')
		).toBe('1 2');
	});

	test('a carriage return followed by a line feed is one newline', () => {
		expect(read('baudot', [8, 2]).text).toBe('\n');
		expect(read('baudot', [8]).text).toBe('\r');
		expect(read('baudot', [2]).text).toBe('\n');
	});

	test('blank frames are skipped and positions without a character read as unreadable, with a note', () => {
		expect(read('baudot', [0, 3, 0]).text).toBe('A');
		const r = read('baudot', [27, 9]);
		expect(r.text).toBe(UNREADABLE);
		expect(r.notes[0]).toContain('Frame 2');
	});
});

test.describe('ASCII tape', () => {
	test('every frame has even parity and matches an independent popcount', () => {
		for (let c = 32; c < 127; c++) {
			const [f] = punch('ascii', String.fromCharCode(c)).cells;
			expect(f & 127).toBe(c);
			expect((f.toString(2).split('1').length - 1) & 1).toBe(0);
			expect(f >> 7).toBe((c.toString(2).split('1').length - 1) & 1);
		}
	});

	test('a flipped bit is reported as a parity error but the rest still reads', () => {
		const frames = punch('ascii', 'HELLO').cells;
		frames[2] ^= 4;
		const r = read('ascii', frames);
		expect(r.notes).toEqual(['Frame 3 fails the even parity check.']);
		expect(readAscii(frames).map((f) => f.ok)).toEqual([true, true, false, true, true]);
	});

	test('known frames', () => {
		expect(punch('ascii', 'A').cells).toEqual([0x41]); // 0x41 has two bits set
		expect(punch('ascii', 'C').cells).toEqual([0x43 | 0x80]); // 0x43 has three
	});
});

test.describe('limits and bad input', () => {
	test('overlong input is cut, with a note, on every medium', () => {
		for (const medium of ['card', 'baudot', 'ascii'] as Medium[]) {
			const p = punch(medium, 'A'.repeat(100));
			expect(p.notes[0]).toMatch(/80/);
			expect(read(medium, p.cells).text.length).toBe(80);
		}
		expect(punch('card', '').cells).toHaveLength(80);
	});

	test('unsupported characters are named, and leave a blank column on a card', () => {
		const p = punch('card', 'A~B');
		expect(p.notes[0]).toContain('~');
		expect(p.cells.slice(0, 3)).toEqual([punch('card', 'A').cells[0], 0, punch('card', 'B').cells[0]]);
		expect(punch('baudot', 'A@B').notes[0]).toContain('@');
		expect(read('baudot', punch('baudot', 'A@B').cells).text).toBe('AB');
		expect(punch('ascii', 'é').notes[0]).toContain('é');
	});

	test('decoding any value never throws', () => {
		const next = rng(5);
		for (const medium of ['baudot', 'ascii'] as Medium[])
			for (let i = 0; i < 2000; i++)
				expect(() => read(medium, [Math.floor(next() * 70000) - 100, i & 255, 31, 27])).not.toThrow();
		expect(() => read('card', [-1, 99999, 0.5, NaN])).not.toThrow();
	});
});

test.describe('drawing and links', () => {
	test('the drawing has a hit target for every hole position and a hole for every set bit', () => {
		const next = rng(9);
		for (const medium of ['card', 'baudot', 'ascii'] as Medium[]) {
			const cells =
				medium === 'card'
					? [...Array(80)].map(() => Math.floor(next() * 4096))
					: [...Array(30)].map(() => Math.floor(next() * (1 << (medium === 'baudot' ? 5 : 8))));
			const s = scene(medium, cells);
			const tracks = medium === 'card' ? 12 : medium === 'baudot' ? 5 : 8;
			expect(s.hits).toHaveLength(cells.length * tracks);
			const bits = cells.reduce((n, v) => n + v.toString(2).split('1').length - 1, 0);
			expect((s.inner.match(/fill="#15130e"/g) ?? []).length - (medium === 'card' ? 0 : cells.length)).toBe(bits);
			expect(sceneSvg(s)).toMatch(/^<svg [^>]*width="\d+" height="\d+"/);
		}
		expect(cardScene(punch('card', 'HI').cells, 14).w).toBeLessThan(scene('card', []).w);
	});

	test('a column is described with its punches, character and EBCDIC byte', () => {
		const cells = punch('card', 'HELLO').cells;
		expect(describe('card', cells, 0)).toBe('Column 1: punches 12-8, reads as H, EBCDIC C8.');
		expect(describe('card', [0b11], 0)).toContain('no known character');
		expect(describe('baudot', punch('baudot', 'E').cells, 0)).toContain('00001 (holes in track 1)');
	});

	test('packed links round trip and refuse anything else', () => {
		const next = rng(3);
		const cells = [...Array(80)].map(() => Math.floor(next() * 4096));
		expect(unpackCells(packCells(cells), 80, 'card')).toEqual(cells);
		expect(unpackCells(packCells([3, 0, 31]), 240, 'baudot')).toEqual([3, 0, 31]);
		expect(unpackCells('0', 80, 'card')).toBeUndefined();
		expect(unpackCells('0!', 80, 'card')).toBeUndefined();
		expect(unpackCells(packCells([32]), 80, 'baudot')).toBeUndefined();
		expect(unpackCells('00'.repeat(81), 80, 'card')).toBeUndefined();
	});
});

test.describe('the punch-card-generator page', () => {
	test('ships a punched card and a code table, and reads what is typed', async ({ page }) => {
		const html = await (await page.request.get('/punch-card-generator')).text();
		expect(html).toContain('HELLO, WORLD');
		expect(html).toContain('12-8-2');
		await page.goto('/punch-card-generator');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#text')).toHaveValue('HELLO, WORLD');
		await expect(page.locator('.readout')).toContainText('Column 1: punches 12-8, reads as H');
		await page.locator('#text').fill('FORTRAN');
		await expect(page.locator('.readout')).toContainText('Column 1: punches 12-6, reads as F');
		await page.locator('#text').fill('A~');
		await expect(page.locator('[role=alert]')).toContainText('~');
	});

	test('clicking a hole changes the text, and the link carries the holes', async ({ page }) => {
		await page.goto('/punch-card-generator?t=AB');
		await page.waitForLoadState('networkidle');
		// Column 2 is B (12-2): add a 3 punch and it is no known character, so it reads as the placeholder.
		await page.locator('rect[aria-label="Column 2, row 3"]').click();
		await expect(page.locator('#text')).toHaveValue('A' + UNREADABLE);
		await expect(page.locator('.readout')).toContainText('no known character');
		expect(page.url()).toContain('h=');
		// Switch the 12 punch of column 2 to a different row via keyboard: focus, then Space.
		await page.locator('rect[aria-label="Column 2, row 3"]').focus();
		await page.keyboard.press('Space');
		await expect(page.locator('#text')).toHaveValue('AB');
		expect(page.url()).not.toContain('h=');
		await page.locator('rect[aria-label="Column 1, row 12"]').click();
		await expect(page.locator('#text')).toHaveValue(/^[^A]/);
		const url = page.url();
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#text')).toHaveValue(/^[^A]/);
		expect(page.url()).toBe(url);
	});

	test('switches to tape and shows frames', async ({ page }) => {
		await page.goto('/punch-card-generator?m=baudot&t=A1');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#text')).toHaveValue('A1');
		await expect(page.locator('rect[aria-label="Frame 3, track 1"]')).toHaveCount(1);
		await page.getByRole('button', { name: /ASCII tape/ }).click();
		await expect(page.locator('rect[aria-label="Frame 2, track 8"]')).toHaveCount(1);
		expect(page.url()).toContain('m=ascii');
	});

	test('does not scroll the page sideways at 390 px', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await page.goto('/punch-card-generator');
		await page.waitForLoadState('networkidle');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});
});
