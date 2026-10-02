// Base32, Base58 and base 36 checked against the published test vectors and
// against reference implementations written a different way: Base32 as one
// long bit string, Base58 with the digit-array carry loop Bitcoin Core uses,
// SHA-256 from Node's own crypto module rather than Web Crypto, and base 36
// against BigInt's native toString. Then the three pages, as a reader uses them.

import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
	base32Encode,
	base32Decode,
	base32Length,
	BASE32_ALPHABETS,
	CROCKFORD_CHECK_SYMBOLS,
	base58Encode,
	base58Decode,
	base58CheckVerify,
	base58CheckEncode,
	doubleSha256,
	describeVersion,
	leadingCharacters,
	VERSION_KINDS,
	BASE58_ALPHABET,
	parseInBase,
	toBase,
	divisionSteps,
	placeValueSteps,
	readingSteps,
	bytesToBase36,
	base36ToBytes,
	bytesToBigInt,
	bigIntToBytes,
	bytesAsText,
	MAX_TEXT_BYTES,
	BaseNError,
	type Base32Variant
} from '../src/lib/baseN.js';
import { textToBytes } from '../src/lib/textEncoding.js';

/** A deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x80000000;
	};
}

function randomBytes(random: () => number, length: number, zeroBias = 0): number[] {
	return Array.from({ length }, () => (random() < zeroBias ? 0 : Math.floor(random() * 256)));
}

const errorOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		return (e as Error).message;
	}
	return '';
};

const positionOf = (fn: () => unknown): number | undefined => {
	try {
		fn();
	} catch (e) {
		return (e as BaseNError).position;
	}
	return undefined;
};

// --- references ------------------------------------------------------------

/** Base32 the long way round: every bit in one string, cut into fives. */
function refBase32(bytes: number[], alphabet: string, pad: boolean): string {
	let bits = bytes.map((b) => b.toString(2).padStart(8, '0')).join('');
	while (bits.length % 5) bits += '0';
	let out = '';
	for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
	if (pad) while (out.length % 8) out += '=';
	return out;
}

function refBase32Decode(text: string, alphabet: string): number[] {
	const bits = text
		.replace(/=+$/, '')
		.split('')
		.map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0'))
		.join('');
	const out: number[] = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
	return out;
}

/** Base58 as Bitcoin Core writes it: a little-endian digit array, carried byte by byte, no BigInt. */
function refBase58(bytes: number[]): string {
	let zeros = 0;
	while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
	const digits: number[] = [];
	for (let i = zeros; i < bytes.length; i++) {
		let carry = bytes[i];
		for (let j = 0; j < digits.length; j++) {
			carry += digits[j] << 8;
			digits[j] = carry % 58;
			carry = Math.floor(carry / 58);
		}
		while (carry > 0) {
			digits.push(carry % 58);
			carry = Math.floor(carry / 58);
		}
	}
	return (
		'1'.repeat(zeros) +
		digits
			.reverse()
			.map((d) => BASE58_ALPHABET[d])
			.join('')
	);
}

function refBase58Decode(text: string): number[] {
	let ones = 0;
	while (ones < text.length && text[ones] === '1') ones++;
	const out: number[] = [];
	for (let i = ones; i < text.length; i++) {
		let carry = BASE58_ALPHABET.indexOf(text[i]);
		for (let j = 0; j < out.length; j++) {
			carry += out[j] * 58;
			out[j] = carry & 0xff;
			carry >>= 8;
		}
		while (carry > 0) {
			out.push(carry & 0xff);
			carry >>= 8;
		}
	}
	return [...Array(ones).fill(0), ...out.reverse()];
}

const nodeDoubleSha = (bytes: number[]) =>
	Array.from(
		createHash('sha256')
			.update(createHash('sha256').update(Buffer.from(bytes)).digest())
			.digest()
	);

// --- Base32 ----------------------------------------------------------------

/** The three alphabets typed out here, not taken from the engine, so a typo there is caught. */
const ALPHABETS: Record<Base32Variant, string> = {
	rfc4648: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
	hex: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
	crockford: '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
};

/** Crockford's reading as a number: the characters as base 32 digits, most significant first. */
const crockfordValue = (s: string) => [...s].reduce((n, c) => n * 32n + BigInt(ALPHABETS.crockford.indexOf(c)), 0n);

test.describe('Base32', () => {
	test('matches the RFC 4648 section 10 vectors in both alphabets', () => {
		const vectors: [string, string, string][] = [
			['', '', ''],
			['f', 'MY======', 'CO======'],
			['fo', 'MZXQ====', 'CPNG===='],
			['foo', 'MZXW6===', 'CPNMU==='],
			['foob', 'MZXW6YQ=', 'CPNMUOG='],
			['fooba', 'MZXW6YTB', 'CPNMUOJ1'],
			['foobar', 'MZXW6YTBOI======', 'CPNMUOJ1E8======']
		];
		for (const [text, std, hex] of vectors) {
			const bytes = textToBytes(text);
			expect(base32Encode(bytes).text, text).toBe(std);
			expect(base32Encode(bytes, { variant: 'hex' }).text, text).toBe(hex);
			expect(base32Decode(std).bytes).toEqual(bytes);
			expect(base32Decode(hex, 'hex').bytes).toEqual(bytes);
			expect(base32Decode(std.replace(/=/g, '')).bytes).toEqual(bytes);
		}
	});

	test('agrees with a bit-string encoder on random bytes in every alphabet', () => {
		const random = rng(32);
		const variants: Base32Variant[] = ['rfc4648', 'hex', 'crockford'];
		for (let n = 0; n < 300; n++) {
			const bytes = randomBytes(random, Math.floor(random() * 40), n % 3 === 0 ? 0.3 : 0);
			for (const variant of variants) {
				const alphabet = ALPHABETS[variant];
				for (const pad of [true, false]) {
					const { text, groups } = base32Encode(bytes, { variant, pad });
					expect(text).toBe(refBase32(bytes, alphabet, pad && variant !== 'crockford'));
					expect(text.length).toBe(base32Length(bytes.length, pad && variant !== 'crockford'));
					expect(groups.flatMap((g) => g.bytes)).toEqual(bytes);
					const back = base32Decode(text, variant);
					expect(back.bytes).toEqual(bytes);
					expect(back.bytes).toEqual(refBase32Decode(text, alphabet));
					expect(back.notes.filter((s) => s.includes('1s in its final'))).toEqual([]);
				}
			}
		}
	});

	test('shows each group as bytes, bits, fives and characters', () => {
		const { groups } = base32Encode(textToBytes('fooba'));
		expect(groups).toHaveLength(1);
		const g = groups[0];
		expect(g.bits).toHaveLength(40);
		expect(g.quintets.join('')).toBe(g.bits);
		expect(g.indexes).toEqual(g.quintets.map((q) => parseInt(q, 2)));
		expect(g.chars.join('')).toBe('MZXW6YTB');
		const f = base32Encode([0x66]).groups[0];
		expect(f.fillBits).toBe(2);
		expect(f.padding).toBe(6);
		expect(f.chars.join('')).toBe('MY======');
	});

	test('every character of every alphabet, in order, from 20 bytes that count 0 to 31 in fives', () => {
		const bits = Array.from({ length: 32 }, (_, i) => i.toString(2).padStart(5, '0')).join('');
		const bytes = Array.from({ length: 20 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
		for (const variant of ['rfc4648', 'hex', 'crockford'] as Base32Variant[]) {
			expect(BASE32_ALPHABETS[variant]).toBe(ALPHABETS[variant]);
			expect(base32Encode(bytes, { variant }).text).toBe(ALPHABETS[variant]);
			expect(base32Decode(ALPHABETS[variant].toLowerCase(), variant).bytes).toEqual(bytes);
		}
		// Crockford leaves out I, L, O and U, and only those, from A to Z.
		const missing = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((c) => !ALPHABETS.crockford.includes(c));
		expect(missing.join('')).toBe('ILOU');
	});

	test('a ULID read as Crockford gives its 128-bit number as well as the RFC 4648 cut', () => {
		const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
		const read = base32Decode(ulid, 'crockford');
		const value = crockfordValue(ulid);
		expect(value < 1n << 128n).toBe(true);
		const expected = Array.from({ length: 16 }, (_, i) => Number((value >> BigInt(8 * (15 - i))) & 0xffn));
		expect(read.asNumber).toEqual(expected);
		expect(read.asNumber?.[0]).toBe(0x01);
		expect(read.asNumber?.[1]).toBe(0x56);
		// No false warning about the last bits: in a ULID the spare bits are at the front.
		expect(read.notes.join(' ')).not.toMatch(/may have been altered/);
		expect(read.notes.join(' ')).toMatch(/length of a ULID/);
		// Only Crockford, and only a 26-character input that fits in 128 bits, is read that way.
		expect(base32Decode(ulid.slice(0, 24), 'crockford').asNumber).toBeUndefined();
		expect(base32Decode('8' + ulid.slice(1), 'crockford').asNumber).toBeUndefined();
	});

	test('checks a Crockford check symbol at the end, and refuses one that does not match', () => {
		// 01ARZ3NDEKTSV4RRFFQ69G5FAV mod 37 is 34, the symbol $.
		const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
		expect(Number(crockfordValue(ulid) % 37n)).toBe(34);
		const good = base32Decode(ulid + '$', 'crockford');
		expect(good.check).toEqual({ symbol: '$', value: 34, expected: 34, valid: true });
		expect(good.asNumber).toEqual(base32Decode(ulid, 'crockford').asNumber);
		expect(errorOf(() => base32Decode(ulid + '*', 'crockford'))).toMatch(/check symbol for 32.*is 34/);
		expect(positionOf(() => base32Decode(ulid + '*', 'crockford'))).toBe(27);
		// = is a check symbol (35) in Crockford's scheme, not padding.
		expect(errorOf(() => base32Decode('91JPRV3F=', 'crockford'))).toMatch(/check symbol for 35/);
		expect(errorOf(() => base32Decode('91JPRV3F==', 'crockford'))).toMatch(/can only come once, at the very end/);
		expect(CROCKFORD_CHECK_SYMBOLS).toBe('*~$=U');
		// Each extra symbol on a two-character string whose value mod 37 is that symbol's value.
		// (A check symbol from the 32 ordinary characters cannot be told apart from data.)
		for (let n = 32; n < 37; n++) {
			const v = BigInt(n + 37);
			const s = ALPHABETS.crockford[Number(v / 32n)] + ALPHABETS.crockford[Number(v % 32n)];
			const symbol = CROCKFORD_CHECK_SYMBOLS[n - 32];
			expect(base32Decode(s + symbol, 'crockford').check?.valid).toBe(true);
			expect(base32Decode(s + symbol.toLowerCase(), 'crockford').check?.valid).toBe(true);
		}
	});

	test('refuses non-ASCII look-alikes that change case into letters', () => {
		// ı upper-cases to I, ſ to S and ﬆ to ST: none of them is a Base32 or base 36 digit.
		for (const ch of ['ı', 'ſ', 'ﬆ', '\u212a', 'Ａ']) {
			expect(
				errorOf(() => base32Decode(ch + 'A')),
				ch
			).toMatch(/character 1\) is not in the RFC 4648/);
			expect(
				errorOf(() => base32Decode(ch + 'A', 'crockford')),
				ch
			).toMatch(/character 1\) is not in/);
			expect(
				errorOf(() => parseInBase(ch, 36)),
				ch
			).toMatch(/is not a base 36 digit/);
		}
		expect(errorOf(() => base32Decode('MZ😀A'))).toMatch(/character 3/);
	});

	test('reads Crockford leniently: any case, hyphens, I L O', () => {
		const bytes = [0x00, 0x01, 0x10, 0xff, 0x7c];
		const text = base32Encode(bytes, { variant: 'crockford' }).text;
		expect(text).toBe('000H1ZVW');
		const sloppy = 'oOo-h-iZvw';
		const read = base32Decode(sloppy, 'crockford');
		expect(read.bytes).toEqual(bytes);
		expect(read.notes.join(' ')).toMatch(/I and L were read as 1 and O as 0/);
		expect(base32Decode('1ili', 'crockford').bytes).toEqual(base32Decode('1111', 'crockford').bytes);
		expect(errorOf(() => base32Decode('ABU0', 'crockford'))).toMatch(
			/check symbols .* only come once, at the very end/
		);
		expect(positionOf(() => base32Decode('ABU0', 'crockford'))).toBe(3);
	});

	test('refuses what cannot be Base32, saying where', () => {
		expect(errorOf(() => base32Decode('MZXW1YQ='))).toBe(
			'"1" (character 5) is not in the RFC 4648 Base32 alphabet (A–Z and 2–7); a 0, 1 or 8 is probably the letter O, I or B.'
		);
		expect(errorOf(() => base32Decode('MZ9A'))).toMatch(/"9" \(character 3\).*; 9 is not used either\.$/);
		expect(positionOf(() => base32Decode('MZ XW1YQ='))).toBe(6);
		expect(errorOf(() => base32Decode('MZXWZ', 'hex'))).toMatch(/base32hex stops at V/);
		expect(errorOf(() => base32Decode('MZX'))).toMatch(/3 characters leave 3 over/);
		expect(errorOf(() => base32Decode('MZXW6Y'))).toMatch(/leave 6 over/);
		expect(errorOf(() => base32Decode('MY====='))).toMatch(/needs 6 = signs, not 5/);
		expect(errorOf(() => base32Decode('MZXW6YTB='))).toMatch(/needs no padding/);
		expect(errorOf(() => base32Decode('MY==MY=='))).toMatch(/Padding \(=\) can only come at the very end/);
		expect(base32Decode('mzxw 6ytb').notes.join(' ')).toMatch(/Small letters/);
		expect(base32Decode('MZ').notes.join(' ')).toMatch(/padding was missing/);
		expect(base32Decode('MZ======').notes.join(' ')).toMatch(/has 1s in its final 2 bits/);
	});
});

// --- Base58 ----------------------------------------------------------------

test.describe('Base58', () => {
	test('matches the known vectors', () => {
		expect(base58Encode(textToBytes('Hello World!')).text).toBe('2NEpo7TZRRrLZSi2U');
		expect(base58Encode(textToBytes('The quick brown fox jumps over the lazy dog.')).text).toBe(
			'USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z'
		);
		expect(base58Encode([0x00, 0x00, 0x28, 0x7f, 0xb4, 0xcd]).text).toBe('11233QC4');
		expect(base58Encode([]).text).toBe('');
		expect(base58Encode([0]).text).toBe('1');
		expect(base58Encode([0, 0, 0]).text).toBe('111');
		expect(base58Encode([57]).text).toBe('z');
		expect(base58Encode([58]).text).toBe('21');
		expect(base58Decode('2NEpo7TZRRrLZSi2U').bytes).toEqual(textToBytes('Hello World!'));
		expect(base58Decode('111').bytes).toEqual([0, 0, 0]);
		expect(base58Decode('').bytes).toEqual([]);
	});

	test('agrees with a digit-array encoder on random bytes, leading zeros included', () => {
		const random = rng(58);
		for (let n = 0; n < 1500; n++) {
			const zeros = n % 4 === 0 ? Math.floor(random() * 4) : 0;
			const bytes = [...Array(zeros).fill(0), ...randomBytes(random, Math.floor(random() * 48), 0.05)];
			const encoded = base58Encode(bytes);
			expect(encoded.text).toBe(refBase58(bytes));
			const decoded = base58Decode(encoded.text);
			expect(decoded.bytes).toEqual(bytes);
			expect(decoded.bytes).toEqual(refBase58Decode(encoded.text));
			expect(decoded.leadingOnes).toBe(encoded.leadingZeros);
		}
	});

	test('the division steps are the working: n = 58q + r, remainders read upwards', () => {
		const { steps, value, text, leadingZeros } = base58Encode([0, 0, ...textToBytes('Hi')]);
		expect(leadingZeros).toBe(2);
		expect(value).toBe(0x4869n);
		for (const s of steps) {
			expect(s.dividend).toBe(s.quotient * 58n + BigInt(s.remainder));
			expect(BASE58_ALPHABET[s.remainder]).toBe(s.digit);
		}
		expect(steps[steps.length - 1].quotient).toBe(0n);
		expect(
			'11' +
				steps
					.map((s) => s.digit)
					.reverse()
					.join('')
		).toBe(text);
		const { steps: reading } = base58Decode(text);
		expect(reading[reading.length - 1].after).toBe(0x4869n);
		for (const r of reading) expect(r.after).toBe(r.before * 58n + BigInt(r.value));
	});

	test('refuses characters outside the alphabet, saying where and why', () => {
		expect(errorOf(() => base58Decode('2NEp0'))).toMatch(/"0" \(character 5\).*leaves out 0, O, I and l/);
		expect(positionOf(() => base58Decode('  2NEpl'))).toBe(7);
		expect(errorOf(() => base58Decode('2NE po'))).toMatch(/A space or line break \(character 4\)/);
		expect(errorOf(() => base58Decode('ab+c'))).toMatch(/Base64 character/);
	});
});

test.describe('Base58Check', () => {
	test('Web Crypto double SHA-256 matches Node crypto', async () => {
		const random = rng(256);
		for (let n = 0; n < 50; n++) {
			const bytes = randomBytes(random, Math.floor(random() * 100));
			expect(await doubleSha256(bytes)).toEqual(nodeDoubleSha(bytes));
		}
	});

	test('a known address passes, and one changed character fails', async () => {
		const good = await base58CheckVerify('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
		expect(good.valid).toBe(true);
		expect(good.version).toBe(0);
		expect(good.payload).toHaveLength(20);
		expect(good.kind?.name).toMatch(/P2PKH/);
		expect(good.checksum).toEqual(nodeDoubleSha([good.version, ...good.payload]).slice(0, 4));

		const script = await base58CheckVerify('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
		expect(script.valid).toBe(true);
		expect(script.version).toBe(5);
		expect(script.kind?.name).toMatch(/P2SH/);

		const bad = await base58CheckVerify('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3');
		expect(bad.valid).toBe(false);
		expect(bad.expected).not.toEqual(bad.checksum);

		await expect(base58CheckVerify('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN0')).rejects.toThrow(/character 34/);
		await expect(base58CheckVerify('2NEp')).rejects.toThrow(/at least 5/);
		await expect(base58CheckVerify('  ')).rejects.toThrow(/Paste/);
	});

	test('encoding round trips and every random corruption of one character is caught', async () => {
		const random = rng(5858);
		for (let n = 0; n < 40; n++) {
			const version = n % 2 ? 0 : Math.floor(random() * 256);
			const payload = randomBytes(random, 20);
			const text = await base58CheckEncode(version, payload);
			const expected = refBase58([version, ...payload, ...nodeDoubleSha([version, ...payload]).slice(0, 4)]);
			expect(text).toBe(expected);
			const back = await base58CheckVerify(text);
			expect(back.valid).toBe(true);
			expect(back.payload).toEqual(payload);
			const at = 1 + Math.floor(random() * (text.length - 1));
			const swapped = BASE58_ALPHABET[(BASE58_ALPHABET.indexOf(text[at]) + 1) % 58];
			const broken = text.slice(0, at) + swapped + text.slice(at + 1);
			const checked = await base58CheckVerify(broken).catch(() => null);
			if (checked) expect(checked.valid).toBe(false);
		}
	});

	test('the version table gives the first characters people know', () => {
		const firsts = VERSION_KINDS.map((k) => {
			const r = leadingCharacters(k);
			return r.first === r.last ? r.first : `${r.first}-${r.last}`;
		});
		expect(firsts).toEqual(['1', '3', 'm-n', '2', '5', 'K-L', '9', 'c']);
		// Legacy addresses are at most 34 characters; uncompressed WIF keys are 51.
		expect(VERSION_KINDS.map((k) => leadingCharacters(k).longest)).toEqual([34, 34, 34, 35, 51, 52, 51, 52]);
		expect(describeVersion(0x80, [...Array(32).fill(1), 0x01])?.name).toMatch(/compressed/);
		expect(describeVersion(0x80, Array(32).fill(1))?.name).not.toMatch(/compressed/);
		expect(describeVersion(0x42, Array(20).fill(1))).toBeUndefined();
	});
});

// --- base 36 and any base ----------------------------------------------------

test.describe('base 36 and any base', () => {
	test('agrees with BigInt toString in every base from 2 to 36', () => {
		const random = rng(36);
		for (let n = 0; n < 120; n++) {
			const bytes = randomBytes(random, 1 + Math.floor(random() * 30));
			const value = n < 5 ? BigInt(n) : bytesToBigInt(bytes);
			for (let base = 2; base <= 36; base++) {
				const native = value.toString(base);
				expect(toBase(value, base, true)).toBe(native);
				expect(toBase(value, base)).toBe(native.toUpperCase());
				expect(parseInBase(native, base).value).toBe(value);
				expect(parseInBase(native.toUpperCase(), base).value).toBe(value);
			}
		}
	});

	test('the working adds up', () => {
		expect(toBase(0n, 36)).toBe('0');
		expect(divisionSteps(0n, 36).steps).toHaveLength(1);
		const { steps, result } = divisionSteps(1_000_000n, 36);
		expect(result).toBe('LFLS');
		for (const s of steps) expect(s.dividend).toBe(s.quotient * 36n + BigInt(s.remainder));
		const { terms, total } = placeValueSteps('LFLS', 36);
		expect(total).toBe(1_000_000n);
		expect(terms.map((t) => t.value)).toEqual([21, 15, 21, 28]);
		expect(terms[0].place).toBe(36n ** 3n);
		const reading = readingSteps('zz', 36);
		expect(reading[1].after).toBe(1295n);
		expect(parseInt('LFLS', 36)).toBe(1_000_000);
	});

	test('reads separators and matching prefixes, and refuses the rest with a position', () => {
		expect(parseInBase('0xFF', 16).value).toBe(255n);
		expect(parseInBase('0b1010', 2).value).toBe(10n);
		expect(parseInBase('1_000 000', 10).value).toBe(1_000_000n);
		expect(parseInBase('0x10', 36).value).toBe(BigInt(parseInt('0x10'.slice(0), 36)));
		expect(parseInBase('007', 8).digits).toBe('007');
		expect(errorOf(() => parseInBase('12A', 10))).toMatch(/"A" \(character 3\) is not a base 10 digit/);
		expect(positionOf(() => parseInBase('  12A', 10))).toBe(5);
		expect(errorOf(() => parseInBase('19', 8))).toMatch(/uses the digits 0 to 7/);
		expect(errorOf(() => parseInBase('1.5', 10))).toMatch(/fractions/);
		expect(errorOf(() => parseInBase('-5', 10))).toMatch(/negative/);
		expect(errorOf(() => parseInBase('', 36))).toMatch(/Type a number/);
		expect(errorOf(() => parseInBase('Z!', 36))).toMatch(/"!" \(character 2\)/);
		expect(errorOf(() => parseInBase('G', 16))).toMatch(/0 to 9 and A to F/);
		expect(errorOf(() => parseInBase('1'.repeat(401), 2))).toMatch(/more than 400/);
	});

	test('text as one base 36 number round trips, except leading zero bytes', () => {
		const random = rng(3636);
		for (let n = 0; n < 300; n++) {
			const bytes = [1 + Math.floor(random() * 255), ...randomBytes(random, Math.floor(random() * 30))];
			const { digits, value } = bytesToBase36(bytes, true);
			expect(digits).toBe(BigInt('0x' + Buffer.from(bytes).toString('hex')).toString(36));
			expect(value).toBe(bytesToBigInt(bytes));
			expect(base36ToBytes(digits).bytes).toEqual(bytes);
		}
		const hello = bytesToBase36(textToBytes('Hello'));
		expect(hello.digits).toBe(BigInt('0x48656c6c6f').toString(36).toUpperCase());
		const zero = bytesToBase36([0, 0x41]);
		expect(zero.leadingZeros).toBe(1);
		expect(base36ToBytes(zero.digits).bytes).toEqual([0x41]);
		expect(bytesToBase36([]).digits).toBe('');
		// The longest text that is read still writes a number short enough to read back.
		const longest = bytesToBase36(Array(MAX_TEXT_BYTES).fill(0xff));
		expect(base36ToBytes(longest.digits).bytes).toEqual(Array(MAX_TEXT_BYTES).fill(0xff));
		expect(errorOf(() => bytesToBase36(Array(MAX_TEXT_BYTES + 1).fill(0x41)))).toMatch(/up to 250 bytes/);
		expect(bigIntToBytes(0n)).toEqual([]);
		expect(bigIntToBytes(256n)).toEqual([1, 0]);
	});

	test('bytes are only called text when they read as text', () => {
		expect(bytesAsText(textToBytes('café'))).toEqual({ text: 'café', isText: true });
		expect(bytesAsText([0xff]).isText).toBe(false);
		expect(bytesAsText([0x00, 0x41]).isText).toBe(false);
		expect(bytesAsText([0x41, 0x0a]).isText).toBe(true);
	});
});

// --- the pages -------------------------------------------------------------

/** The FAQ answers in the JSON-LD, which must say exactly what the page shows. */
async function faqMatches(page: import('@playwright/test').Page) {
	const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
	const graph = JSON.parse(ld ?? '{}')['@graph'];
	const questions = graph[0].mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => ({
		q: q.name,
		a: q.acceptedAnswer.text
	}));
	const shown = await page.locator('.faq details').evaluateAll((items) =>
		items.map((d) => ({
			q: d.querySelector('summary')?.textContent?.trim(),
			a: d.querySelector('p')?.textContent?.trim()
		}))
	);
	expect(questions.length).toBeGreaterThanOrEqual(4);
	expect(shown).toEqual(questions);
}

test.describe('the base32 page', () => {
	test('ships a worked example and encodes, decodes and explains errors', async ({ page }) => {
		const html = await (await page.request.get('/base32')).text();
		expect(html).toContain('JBSWY3DP');
		expect(html).toContain('MZXW6YTB');
		expect(html).toContain('CPNMUOG=');
		await page.goto('/base32');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#output')).toHaveValue('JBSWY3DP');
		await page.locator('#input').fill('foobar');
		await expect(page.locator('#output')).toHaveValue('MZXW6YTBOI======');
		await expect(page.locator('.steps-view').first()).toContainText('=');
		await page.getByRole('button', { name: 'base32hex', exact: true }).click();
		await expect(page.locator('#output')).toHaveValue('CPNMUOJ1E8======');
		await page.getByRole('button', { name: 'Decode', exact: true }).click();
		await expect(page.locator('#input')).toHaveValue('CPNMUOJ1E8======');
		await expect(page.locator('#output')).toHaveValue('foobar');
		await page.getByRole('button', { name: 'RFC 4648', exact: true }).click();
		await page.locator('#input').fill('MZXW1YQ=');
		await expect(page.locator('.error')).toContainText('character 5');
		await expect(page.locator('.error mark')).toHaveText('1');
		await page.getByRole('button', { name: 'Decode a 2FA secret' }).click();
		await expect(page.locator('#output')).toHaveValue('48 65 6C 6C 6F 21 DE AD BE EF');
	});

	test('a shared link reopens the same state', async ({ page }) => {
		await page.goto('/base32');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Crockford', exact: true }).click();
		await page.getByRole('button', { name: 'Hex bytes', exact: true }).click();
		await page.locator('#input').fill('00 01 10 FF 7C');
		await expect(page.locator('#output')).toHaveValue('000H1ZVW');
		const url = page.url();
		expect(url).toContain('a=crockford');
		expect(url).toContain('in=hex');
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#input')).toHaveValue('00 01 10 FF 7C');
		await expect(page.locator('#output')).toHaveValue('000H1ZVW');
		await page.goto('/base32?m=decode&a=crockford&t=9ijp-rv3f');
		await expect(page.locator('#output')).toHaveValue('Hello');
		await page.goto('/base32?m=decode&a=crockford&t=01ARZ3NDEKTSV4RRFFQ69G5FAV');
		await expect(page.locator('.tool')).toContainText('01 56 3E 3A B5 D3 D6 76 4C 61 EF B9 93 02 BD 5B');
		await expect(page.locator('.tool')).not.toContainText('may have been altered');
	});

	test('the FAQ JSON-LD matches the visible answers', async ({ page }) => {
		await page.goto('/base32');
		await faqMatches(page);
	});
});

test.describe('the base58 page', () => {
	test('ships a worked example, the division steps and the address breakdown', async ({ page }) => {
		const html = await (await page.request.get('/base58')).text();
		expect(html).toContain('2NEpo7TZRRrLZSi2U');
		expect(html).toContain('÷ 58');
		// The Base58Check example is computed at build time, checksum and all.
		const check = await base58CheckVerify('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
		expect(html).toContain(check.checksum.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
		expect(html).toContain('>matches<');
		await page.goto('/base58');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#output')).toHaveValue('2NEpo7TZRRrLZSi2U');
		await page.getByRole('button', { name: 'Hex bytes', exact: true }).click();
		await page.locator('#input').fill('00 00 48 69');
		await expect(page.locator('#output')).toHaveValue(base58Encode([0, 0, 0x48, 0x69]).text);
		await expect(page.locator('.working')).toContainText('2 zero bytes');
		await page.getByRole('button', { name: 'Decode', exact: true }).click();
		await expect(page.locator('#output')).toHaveValue('00 00 48 69');
		await page.locator('#input').fill('2NEpo7TZRRrLZSi2U');
		await expect(page.locator('#output')).toHaveValue('Hello World!');
		await page.locator('#input').fill('2NEp0');
		await expect(page.locator('.error')).toContainText('leaves out 0, O, I and l');
	});

	test('checks an address and catches a typo', async ({ page }) => {
		await page.goto('/base58?m=check&t=1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
		await expect(page.locator('.verdict')).toContainText('Checksum is valid');
		await expect(page.locator('.verdict')).toContainText('P2PKH');
		await page.locator('#input').fill('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3');
		await expect(page.locator('.verdict')).toContainText('does not match');
		await page.getByRole('button', { name: 'A script address' }).click();
		await expect(page.locator('.verdict')).toContainText('P2SH');
		expect(page.url()).toContain('m=check');
		// Leaving the checker for Encode takes the address's bytes, not its characters.
		const script = await base58CheckVerify('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
		await page.getByRole('button', { name: 'Encode', exact: true }).click();
		await expect(page.locator('#input')).toHaveValue(
			script.decoded.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
		);
		await expect(page.locator('#output')).toHaveValue('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
		// A link that names check mode but no string opens on the example address.
		await page.goto('/base58?m=check');
		await expect(page.locator('#input')).toHaveValue('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
		await expect(page.locator('.verdict')).toContainText('Checksum is valid');
	});

	test('a shared link reopens the same state, and the FAQ JSON-LD matches', async ({ page }) => {
		await page.goto('/base58');
		await page.waitForLoadState('networkidle');
		await page.locator('#input').fill('Hi');
		await page.getByRole('button', { name: 'Decode', exact: true }).click();
		const url = page.url();
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#input')).toHaveValue(base58Encode(textToBytes('Hi')).text);
		await expect(page.locator('#output')).toHaveValue('Hi');
		await faqMatches(page);
	});
});

test.describe('the base36 page', () => {
	test('ships a worked conversion and converts as you type', async ({ page }) => {
		const html = await (await page.request.get('/base36')).text();
		expect(html).toContain('LFLS');
		expect(html).toContain('÷ 36');
		await page.goto('/base36');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.answer-value')).toHaveText('LFLS');
		await page.locator('#value').fill('18446744073709551615');
		await expect(page.locator('.answer-value')).toHaveText('3W5E11264SGSF');
		await page.getByRole('button', { name: 'Base 36 to decimal' }).click();
		await expect(page.locator('#value')).toHaveValue('3W5E11264SGSF');
		await expect(page.locator('.answer-value')).toHaveText('18,446,744,073,709,551,615');
		await page.locator('#value').fill('zz');
		await expect(page.locator('.answer-value')).toHaveText('1,295');
		await page.locator('#value').fill('Z!Z');
		await expect(page.locator('.error')).toContainText('character 2');
	});

	test('any base, text, and a shared link', async ({ page }) => {
		await page.goto('/base36');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Any base' }).click();
		await page.locator('#from-base').selectOption('16');
		await page.locator('#to-base').selectOption('2');
		await page.locator('#value').fill('FF');
		await expect(page.locator('.answer-value')).toHaveText('11111111');
		const url = page.url();
		expect(url).toContain('to=2');
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.answer-value')).toHaveText('11111111');
		await expect(page.locator('#from-base')).toHaveValue('16');

		await page.getByRole('button', { name: 'Text', exact: true }).click();
		await expect(page.locator('.answer-value')).toHaveText(bytesToBase36(textToBytes('Hi')).digits);
		await page.getByRole('button', { name: 'Base 36 to text' }).click();
		await expect(page.locator('.answer-value')).toHaveText('Hi');
		await page.goto('/base36?m=text');
		await expect(page.locator('.answer-value')).toHaveText(bytesToBase36(textToBytes('Hi')).digits);
		await page.goto('/base36?m=text&v=1000000');
		await expect(page.locator('#value')).toHaveValue('1000000');
		// Text to any base carries the number across, in decimal, and reads it as decimal.
		await page.goto('/base36?m=text&v=Hello');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Any base' }).click();
		const helloValue = bytesToBase36(textToBytes('Hello')).value;
		await expect(page.locator('#value')).toHaveValue(helloValue.toString());
		await expect(page.locator('#from-base')).toHaveValue('10');
		await expect(page.locator('.answer-value')).toHaveText(toBase(helloValue, 36));
		await page.goto('/base36?m=text&v=0');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Any base' }).click();
		await expect(page.locator('.answer-value')).toHaveText('1C');
		// While there is an error, no stale result is shown.
		await page.locator('#value').fill('-5');
		await expect(page.locator('.error')).toContainText('negative');
		await expect(page.locator('.answer')).toHaveCount(0);
		// A long text's link round trips, as an error rather than as another text.
		await page.goto('/base36?m=text&v=' + 'x'.repeat(260));
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#value')).toHaveValue('x'.repeat(260));
		await expect(page.locator('.error')).toContainText('up to 250 bytes');
		await page.goto('/base36?m=from36&v=hello&c=lower');
		await expect(page.locator('.answer-value')).toHaveText(Number(parseInt('hello', 36)).toLocaleString('en-GB'));
		await faqMatches(page);
	});
});
