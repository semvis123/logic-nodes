// Text encodings checked against the platform's own implementations:
// TextEncoder and TextDecoder for UTF-8, Node's Buffer for Base64, and the
// definitions for ASCII. Then the three pages, as a reader would use them.

import { expect, test } from '@playwright/test';
import {
	encodeText,
	textToBytes,
	decodeUtf8,
	utf8Bytes,
	UTF8_RANGES,
	parseBinary,
	parseHex,
	parseDecimal,
	formatBytes,
	placeValues,
	asciiTable,
	asciiBlocks,
	base64Encode,
	base64EncodeText,
	base64Decode,
	base64Length,
	BASE64_ALPHABET,
	BASE64URL_ALPHABET,
	EncodingError
} from '../src/lib/textEncoding.js';

const samples = [
	'',
	'Hi',
	'hello world',
	'café',
	'naïve façade',
	'Ærøskøbing',
	'€100',
	'日本語',
	'😀',
	'👩‍💻 at work',
	'🇳🇱',
	'á',
	'tab\there\nnew line\r\n',
	'\u0000\u007f\u0080߿ࠀ￿\u{10000}\u{10ffff}'
];

/** A deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x80000000;
	};
}

function randomString(random: () => number, length: number, withLoneSurrogates = false): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		const pick = random();
		let cp: number;
		if (pick < 0.4) cp = Math.floor(random() * 128);
		else if (pick < 0.6) cp = 0x80 + Math.floor(random() * (0x800 - 0x80));
		else if (pick < 0.8) cp = 0x800 + Math.floor(random() * (0x10000 - 0x800));
		else cp = 0x10000 + Math.floor(random() * (0x110000 - 0x10000));
		if (cp >= 0xd800 && cp <= 0xdfff && !withLoneSurrogates) cp = 0x41;
		out += String.fromCodePoint(cp);
	}
	return out;
}

const errorOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(EncodingError);
		return (e as Error).message;
	}
	throw new Error('expected an EncodingError');
};

test.describe('UTF-8', () => {
	test('matches TextEncoder on the samples and on random text', () => {
		const encoder = new TextEncoder();
		const random = rng(7);
		const inputs = [
			...samples,
			...Array.from({ length: 300 }, () => randomString(random, 1 + Math.floor(random() * 20)))
		];
		for (const text of inputs) expect(textToBytes(text), JSON.stringify(text)).toEqual([...encoder.encode(text)]);
	});

	test('a lone surrogate becomes U+FFFD, as TextEncoder does', () => {
		const encoder = new TextEncoder();
		const random = rng(11);
		for (let n = 0; n < 100; n++) {
			const text = randomString(random, 8, true) + '\ud800x\udc00';
			expect(textToBytes(text)).toEqual([...encoder.encode(text)]);
		}
		expect(encodeText('\ud83d')[0]).toMatchObject({ codePoint: 0xfffd, replaced: true });
	});

	test('decoding round trips and agrees with TextDecoder', () => {
		const decoder = new TextDecoder('utf-8', { fatal: true });
		const random = rng(3);
		const inputs = [
			...samples,
			...Array.from({ length: 300 }, () => randomString(random, 1 + Math.floor(random() * 20)))
		];
		for (const text of inputs) {
			const bytes = textToBytes(text);
			const { text: back, chars } = decodeUtf8(bytes);
			expect(back).toBe(text);
			expect(back).toBe(decoder.decode(new Uint8Array(bytes)));
			expect(chars.map((c) => c.char).join('')).toBe(text);
		}
	});

	test('every byte count sits at the right boundaries, with prefix and payload bits that rebuild the code point', () => {
		for (const range of UTF8_RANGES) {
			for (const cp of [range.first, range.last, Math.floor((range.first + range.last) / 2)]) {
				if (cp >= 0xd800 && cp <= 0xdfff) continue;
				const bytes = utf8Bytes(cp);
				expect(bytes).toHaveLength(range.bytes);
				expect(bytes.map((b) => b.prefix + b.payload).join(' ')).toBe(bytes.map((b) => b.binary).join(' '));
				expect(bytes[0].prefix).toBe(['0', '110', '1110', '11110'][range.bytes - 1]);
				for (const b of bytes.slice(1)) expect(b.prefix).toBe('10');
				expect(parseInt(bytes.map((b) => b.payload).join(''), 2)).toBe(cp);
				expect(bytes.map((b) => b.payload).join('')).toHaveLength(range.payloadBits);
				const pattern = range.pattern.split(' ');
				bytes.forEach((b, i) => expect(pattern[i].replace(/x/g, '')).toBe(b.prefix));
			}
		}
	});

	test('the per-character breakdown', () => {
		const [h, e, emoji] = encodeText('hé😀');
		expect(h).toMatchObject({ char: 'h', codePoint: 0x68, label: 'U+0068', offset: 0 });
		expect(e.label).toBe('U+00E9');
		expect(e.bytes.map((b) => b.binary)).toEqual(['11000011', '10101001']);
		expect(e.bytes.map((b) => b.hex)).toEqual(['C3', 'A9']);
		expect(e.offset).toBe(1);
		expect(emoji.label).toBe('U+1F600');
		expect(emoji.bytes.map((b) => b.hex).join(' ')).toBe('F0 9F 98 80');
		expect(emoji.offset).toBe(3);
	});

	test('invalid UTF-8 is refused with the position, as TextDecoder refuses it', () => {
		const decoder = new TextDecoder('utf-8', { fatal: true });
		const cases: [number[], RegExp][] = [
			[[0x48, 0xa9], /Byte 2 \(10101001\) starts with 10/],
			[[0x41, 0xc3], /Byte 2 .* starts a 2-byte character, but the input ends after it/],
			[[0xc3, 0x41], /byte 2 \(01000001\) does not start with 10/],
			[[0xe2, 0x82], /3-byte character, but the input ends after 2 bytes/],
			[[0xc0, 0x80], /overlong/],
			[[0xe0, 0x80, 0x80], /Bytes 1 to 3 are an overlong encoding of U\+0000/],
			[[0xed, 0xa0, 0x80], /surrogate/],
			[[0xf4, 0x90, 0x80, 0x80], /beyond U\+10FFFF/],
			[[0xff], /F5 to FF/]
		];
		for (const [bytes, message] of cases) {
			expect(errorOf(() => decodeUtf8(bytes))).toMatch(message);
			expect(() => decoder.decode(new Uint8Array(bytes))).toThrow();
		}
		// Random byte strings: this decoder refuses exactly what TextDecoder refuses.
		const random = rng(5);
		for (let n = 0; n < 2000; n++) {
			const bytes = Array.from({ length: 1 + Math.floor(random() * 6) }, () => Math.floor(random() * 256));
			let expected: string | null = null;
			try {
				expected = decoder.decode(new Uint8Array(bytes));
			} catch {
				expected = null;
			}
			let actual: string | null = null;
			try {
				actual = decodeUtf8(bytes).text;
			} catch {
				actual = null;
			}
			expect(actual, bytes.join(',')).toBe(expected);
		}
	});
});

test.describe('bytes as binary, hex and decimal', () => {
	test('binary with spaces, without, and in 7-bit groups', () => {
		expect(parseBinary('01001000 01101001').bytes).toEqual([72, 105]);
		expect(parseBinary('0100100001101001').bytes).toEqual([72, 105]);
		expect(parseBinary(' 01001000,\n01101001 ').bytes).toEqual([72, 105]);
		expect(parseBinary('1001000 1101001')).toEqual({ bytes: [72, 105], sevenBit: true });
		expect(parseBinary('').bytes).toEqual([]);
	});

	test('binary mistakes name the group', () => {
		expect(errorOf(() => parseBinary('01001000 0110100'))).toMatch(/Group 2 \(0110100\) has 7 bits/);
		expect(errorOf(() => parseBinary('01001000 011010011'))).toMatch(/Group 2 .* has 9 bits/);
		expect(errorOf(() => parseBinary('0100100 2'))).toMatch(/"2" at character 9 is not a binary digit/);
		expect(errorOf(() => parseBinary('010010000110100'))).toMatch(/15 bits is not a whole number of bytes/);
	});

	test('hex and decimal', () => {
		expect(parseHex('48 69').bytes).toEqual([72, 105]);
		expect(parseHex('4869').bytes).toEqual([72, 105]);
		expect(parseHex('0x48 0x69').bytes).toEqual([72, 105]);
		expect(parseHex('\\x48\\x69').bytes).toEqual([72, 105]);
		expect(parseHex('c3:a9').bytes).toEqual([0xc3, 0xa9]);
		expect(errorOf(() => parseHex('486'))).toMatch(/3 hex digits/);
		expect(errorOf(() => parseHex('4G'))).toMatch(/"G" is not a hex digit/);
		expect(parseDecimal('72, 105').bytes).toEqual([72, 105]);
		expect(errorOf(() => parseDecimal('72 256'))).toMatch(/256 \(number 2\) is more than 255/);
		expect(errorOf(() => parseDecimal('7.2'))).toMatch(/not a whole number/);
	});

	test('formatting round trips through parsing', () => {
		const random = rng(9);
		for (let n = 0; n < 100; n++) {
			const bytes = textToBytes(randomString(random, 6));
			expect(parseBinary(formatBytes(bytes, 'binary')).bytes).toEqual(bytes);
			expect(parseBinary(formatBytes(bytes, 'binary', '')).bytes).toEqual(bytes);
			expect(parseHex(formatBytes(bytes, 'hex')).bytes).toEqual(bytes);
			expect(parseHex(formatBytes(bytes, 'hex', '')).bytes).toEqual(bytes);
			expect(parseDecimal(formatBytes(bytes, 'decimal')).bytes).toEqual(bytes);
		}
		expect(formatBytes([72, 5], 'binary', ' ', false)).toBe('1001000 101');
	});

	test('place values add up to the byte', () => {
		for (let v = 0; v < 256; v++) expect(placeValues(v).sum).toBe(v);
		expect(placeValues(72).terms).toEqual([64, 8]);
	});
});

test.describe('ASCII', () => {
	const table = asciiTable();

	test('128 rows, each code in every base', () => {
		expect(table).toHaveLength(128);
		table.forEach((row, code) => {
			expect(row.code).toBe(code);
			expect(parseInt(row.hex, 16)).toBe(code);
			expect(parseInt(row.binary, 2)).toBe(code);
			expect(row.binary).toHaveLength(7);
			expect(parseInt(row.octal, 8)).toBe(code);
			expect(row.name, `name of ${code}`).toBeTruthy();
			if (row.kind !== 'control' && row.kind !== 'space') expect(row.char.charCodeAt(0)).toBe(code);
		});
	});

	test('the control codes are 0 to 31 and 127, with their usual abbreviations', () => {
		expect(table.filter((r) => r.kind === 'control').map((r) => r.code)).toEqual([
			...Array.from({ length: 32 }, (_, i) => i),
			127
		]);
		expect(table[0].abbr).toBe('NUL');
		expect(table[10]).toMatchObject({ abbr: 'LF', name: 'line feed', escape: '\\n', caret: '^J' });
		expect(table[13]).toMatchObject({ abbr: 'CR', name: 'carriage return', escape: '\\r' });
		expect(table[27].abbr).toBe('ESC');
		expect(table[127]).toMatchObject({ abbr: 'DEL', caret: '^?' });
		expect(table[32].name).toBe('space');
	});

	test('letters differ from their other case in bit 5 only, digits carry their value in the low four bits', () => {
		for (let code = 65; code <= 90; code++) {
			expect(table[code].kind).toBe('upper');
			expect(table[code + 32].kind).toBe('lower');
			expect(table[code + 32].char).toBe(table[code].char.toLowerCase());
			expect(code ^ (code + 32)).toBe(32);
		}
		for (let code = 48; code <= 57; code++) {
			expect(table[code].kind).toBe('digit');
			expect(code & 0xf).toBe(Number(table[code].char));
		}
	});

	test('four blocks of 32', () => {
		const blocks = asciiBlocks();
		expect(blocks.map((b) => b.topBits)).toEqual(['00', '01', '10', '11']);
		for (const b of blocks) for (const row of b.rows) expect(row.binary.slice(0, 2)).toBe(b.topBits);
	});
});

test.describe('Base64', () => {
	test('the RFC 4648 test vectors', () => {
		const vectors: [string, string][] = [
			['', ''],
			['f', 'Zg=='],
			['fo', 'Zm8='],
			['foo', 'Zm9v'],
			['foob', 'Zm9vYg=='],
			['fooba', 'Zm9vYmE='],
			['foobar', 'Zm9vYmFy']
		];
		for (const [plain, encoded] of vectors) {
			expect(base64EncodeText(plain).text).toBe(encoded);
			expect(decodeUtf8(base64Decode(encoded).bytes).text).toBe(plain);
		}
	});

	test('agrees with Buffer on random bytes and text, in both alphabets', () => {
		const random = rng(13);
		for (let n = 0; n < 400; n++) {
			const bytes = Array.from({ length: Math.floor(random() * 40) }, () => Math.floor(random() * 256));
			const buffer = Buffer.from(bytes);
			expect(base64Encode(bytes).text).toBe(buffer.toString('base64'));
			expect(base64Encode(bytes, { urlSafe: true, pad: false }).text).toBe(buffer.toString('base64url'));
			expect(base64Decode(buffer.toString('base64')).bytes).toEqual(bytes);
			expect(base64Decode(buffer.toString('base64url')).bytes).toEqual(bytes);
			expect(base64Length(bytes.length)).toBe(buffer.toString('base64').length);
			expect(base64Length(bytes.length, false)).toBe(buffer.toString('base64url').length);
		}
		for (let n = 0; n < 100; n++) {
			const text = randomString(random, Math.floor(random() * 12));
			expect(base64EncodeText(text).text).toBe(Buffer.from(text).toString('base64'));
			expect(decodeUtf8(base64Decode(Buffer.from(text).toString('base64')).bytes).text).toBe(text);
		}
	});

	test('the groups show the regrouping of 8-bit bytes into 6-bit indexes', () => {
		const { groups } = base64EncodeText('Man');
		expect(groups).toHaveLength(1);
		expect(groups[0].bits).toBe('010011010110000101101110');
		expect(groups[0].sextets).toEqual(['010011', '010110', '000101', '101110']);
		expect(groups[0].indexes).toEqual([19, 22, 5, 46]);
		expect(groups[0].chars.join('')).toBe('TWFu');
		const [one] = base64EncodeText('M').groups;
		expect(one).toMatchObject({ fillBits: 4, padding: 2, sextets: ['010011', '010000'] });
		expect(one.chars.join('')).toBe('TQ==');
		const [two] = base64EncodeText('Ma').groups;
		expect(two).toMatchObject({ fillBits: 2, padding: 1 });
		expect(two.chars.join('')).toBe('TWE=');
		const decoded = base64Decode('TWE=').groups[0];
		expect(decoded).toMatchObject({ bytes: [77, 97], fillBits: 2, padding: 1 });
		expect(decoded.chars.join('')).toBe('TWE=');
	});

	test('the two alphabets', () => {
		expect(BASE64_ALPHABET).toHaveLength(64);
		expect(new Set(BASE64_ALPHABET).size).toBe(64);
		expect(BASE64URL_ALPHABET.slice(0, 62)).toBe(BASE64_ALPHABET.slice(0, 62));
		expect(base64Encode([0xfb, 0xff]).text).toBe('+/8=');
		expect(base64Encode([0xfb, 0xff], { urlSafe: true }).text).toBe('-_8=');
		expect(base64Decode('-_8').variant).toBe('url');
	});

	test('decoding tolerates white space and missing padding, and says so', () => {
		expect(base64Decode('Zm9v\nYmFy').bytes).toEqual(textToBytes('foobar'));
		expect(base64Decode(' Zm9v YmFy ').notes).toContain('Spaces and line breaks were ignored.');
		const unpadded = base64Decode('Zg');
		expect(unpadded.bytes).toEqual([0x66]);
		expect(unpadded.notes.join(' ')).toMatch(/padding was missing/);
		expect(base64Decode('Zh==').notes.join(' ')).toMatch(/1s in its final 4 bits/);
	});

	test('decoding errors are specific', () => {
		expect(errorOf(() => base64Decode('Zm9v!'))).toMatch(/"!" \(character 5.*\) is not in the Base64 alphabet/);
		expect(errorOf(() => base64Decode('Zm9vY'))).toMatch(/5 characters leaves one character over/);
		expect(errorOf(() => base64Decode('Zg=v'))).toMatch(/Padding \(=\) can only come at the very end/);
		expect(errorOf(() => base64Decode('Zg==='))).toMatch(/3 = signs/);
		expect(errorOf(() => base64Decode('Zm8=='))).toMatch(/needs 1 = sign, not 2/);
		expect(errorOf(() => base64Decode('Zm9v='))).toMatch(/needs no padding/);
		expect(errorOf(() => base64Decode('a+b-'))).toMatch(/mixes the standard alphabet/);
	});
});

test.describe('the pages', () => {
	test('the binary translator ships a real breakdown and translates both ways', async ({ page }) => {
		const response = await page.request.get('/binary-translator');
		const html = await response.text();
		expect(html).toContain('01001000');
		expect(html).toContain('U+0048');

		await page.goto('/binary-translator?t=' + encodeURIComponent('hé😀'));
		await expect(page.locator('#output')).toHaveValue('01101000 11000011 10101001 11110000 10011111 10011000 10000000');
		await expect(page.locator('.breakdown').first()).toContainText('U+1F600');

		await page.getByRole('button', { name: 'Binary to text', exact: true }).click();
		await page.locator('#input').fill('01001000 01101001');
		await expect(page.locator('#output')).toHaveValue('Hi');
		await page.locator('#input').fill('01001000 0110100');
		await expect(page.locator('.error')).toContainText('Group 2 (0110100) has 7 bits');
		await page.locator('#input').fill('11000011 01000001');
		await expect(page.locator('.error')).toContainText('does not start with 10');
		await expect(page).toHaveURL(/d=decode/);
	});

	test('the ASCII table is complete in the served HTML and filters', async ({ page }) => {
		const html = await (await page.request.get('/ascii-table')).text();
		expect(html).toContain('carriage return');
		expect(html).toContain('1111111');
		await page.goto('/ascii-table');
		await expect(page.locator('.ascii tbody tr')).toHaveCount(128);
		await page.locator('#filter').fill('line feed');
		await expect(page.locator('.ascii tbody tr')).toHaveCount(1);
		await page.locator('#filter').fill('A');
		await expect(page.locator('.ascii tbody tr').first()).toContainText('65');
	});

	test('Base64 encodes, shows its steps, and explains a bad input', async ({ page }) => {
		const html = await (await page.request.get('/base64')).text();
		expect(html).toContain('TWFu');
		await page.goto('/base64');
		await page.locator('#input').fill('😀');
		await expect(page.locator('#output')).toHaveValue('8J+YgA==');
		await expect(page.locator('.steps-view').first()).toContainText('=');
		await page.getByRole('button', { name: 'Decode', exact: true }).click();
		await page.locator('#input').fill('Zm9vY');
		await expect(page.locator('.error')).toContainText('one character over');
		await page.locator('#input').fill('SGVsbG8');
		await expect(page.locator('#output')).toHaveValue('Hello');
	});
});
