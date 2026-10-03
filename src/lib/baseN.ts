// Three more ways of writing bytes or numbers as text, each with its working
// kept so a page can draw it.
//
// Base32 is Base64's sibling: a regrouping of bits, 5 bytes into 8 characters
// of 5 bits each, in three alphabets (RFC 4648, base32hex and Crockford's).
// Base58 and base 36 are different in kind. 58 and 36 are not powers of two, so
// no whole number of bits fits one character; the input is read as one big
// number and converted by repeated division, the way decimal becomes hex.
//
// Pure TypeScript with BigInt, no dependencies. The one thing not written out
// here is SHA-256 for Base58Check, which comes from the platform's Web Crypto
// (crypto.subtle) in both the browser and Node.

import { bin8, hex2, decodeUtf8, EncodingError } from './textEncoding.js';

/** A mistake in the input, with the 1-based character position when there is one. */
export class BaseNError extends Error {
	position?: number;
	constructor(message: string, position?: number) {
		super(message);
		this.position = position;
	}
}

function chunk(s: string, size: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
	return out;
}

/** How a character is named in an error: a space or tab would be invisible in quotes. */
const show = (ch: string) => (ch === '"' ? 'The quote mark "' : `"${ch}"`);

/**
 * The characters that count, each with its position in what was typed, so an
 * error can point at the real place even after spaces were skipped.
 */
function significant(input: string, skip: RegExp): { ch: string; at: number }[] {
	const out: { ch: string; at: number }[] = [];
	let at = 0;
	for (const ch of input) {
		at++;
		if (!skip.test(ch)) out.push({ ch, at });
	}
	return out;
}

/**
 * Bytes shown as text when they are UTF-8 that a person could read. Control
 * characters other than tab and line breaks mean the bytes are probably not
 * text at all, so the page shows them in hex instead.
 */
export function bytesAsText(bytes: number[]): { text: string; isText: boolean } {
	try {
		const text = decodeUtf8(bytes).text;
		// eslint-disable-next-line no-control-regex
		if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return { text: '', isText: false };
		return { text, isText: true };
	} catch (e) {
		if (e instanceof EncodingError) return { text: '', isText: false };
		throw e;
	}
}

export const hexBytes = (bytes: number[], separator = ' ') => bytes.map(hex2).join(separator);

/** Bytes read as one unsigned big-endian number: the first byte is the most significant. */
export function bytesToBigInt(bytes: number[]): bigint {
	let n = 0n;
	for (const b of bytes) n = (n << 8n) | BigInt(b);
	return n;
}

/** The shortest big-endian bytes for a number; zero is no bytes at all. */
export function bigIntToBytes(n: bigint): number[] {
	const out: number[] = [];
	while (n > 0n) {
		out.unshift(Number(n & 0xffn));
		n >>= 8n;
	}
	return out;
}

// --- Base32 ----------------------------------------------------------------

export type Base32Variant = 'rfc4648' | 'hex' | 'crockford';

export const BASE32_ALPHABETS: Record<Base32Variant, string> = {
	rfc4648: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
	hex: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
	crockford: '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
};

export const BASE32_NAMES: Record<Base32Variant, string> = {
	rfc4648: 'RFC 4648 Base32',
	hex: 'base32hex',
	crockford: 'Crockford Base32'
};

/** Characters per started group of 5 bytes, and the = signs that fill the group to 8. */
const BASE32_PAD: Record<number, number> = { 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 };

/** One group of up to 5 bytes and the up to 8 characters it becomes. */
export type Base32Group = {
	bytes: number[];
	/** The bytes' bits, then the zero bits added to fill the last 5-bit index. */
	bits: string;
	/** How many of those bits are filler: 0 to 4 when encoding, and what is dropped when decoding. */
	fillBits: number;
	/** The 5-bit indexes as bit strings. */
	quintets: string[];
	indexes: number[];
	/** The characters, followed by any = padding. */
	chars: string[];
	/** How many of the 8 character slots have no bits: the = signs, written or not. */
	padding: number;
};

export type Base32Options = { variant?: Base32Variant; pad?: boolean };

function base32Group(bytes: number[], alphabet: string, pad: boolean): Base32Group {
	const byteBits = bytes.map(bin8).join('');
	const count = Math.ceil(byteBits.length / 5);
	const fillBits = count * 5 - byteBits.length;
	const bits = byteBits + '0'.repeat(fillBits);
	const quintets = chunk(bits, 5);
	const indexes = quintets.map((q) => parseInt(q, 2));
	const padding = 8 - count;
	const chars = indexes.map((i) => alphabet[i]);
	if (pad) for (let k = 0; k < padding; k++) chars.push('=');
	return { bytes, bits, fillBits, quintets, indexes, chars, padding };
}

/**
 * Encodes bytes as Base32, keeping each 5-byte group so it can be drawn.
 * Crockford's alphabet never takes padding: his scheme has no = sign.
 */
export function base32Encode(bytes: number[], options: Base32Options = {}): { text: string; groups: Base32Group[] } {
	const variant = options.variant ?? 'rfc4648';
	const pad = variant !== 'crockford' && (options.pad ?? true);
	const alphabet = BASE32_ALPHABETS[variant];
	const groups: Base32Group[] = [];
	for (let i = 0; i < bytes.length; i += 5) groups.push(base32Group(bytes.slice(i, i + 5), alphabet, pad));
	return { text: groups.map((g) => g.chars.join('')).join(''), groups };
}

/** The encoded length for n bytes: 8 characters per started group of 5, or just the characters with bits. */
export const base32Length = (bytes: number, pad = true) =>
	pad ? 8 * Math.ceil(bytes / 5) : Math.ceil((bytes * 8) / 5);

export type Base32Decoded = {
	bytes: number[];
	groups: Base32Group[];
	notes: string[];
	/**
	 * Crockford's scheme and ULIDs write a number, with the spare bits at the
	 * front; when 26 Crockford characters hold a 128-bit number (a ULID's shape),
	 * these are its 16 bytes read that way.
	 */
	asNumber?: number[];
	/**
	 * Says what `asNumber` is. Kept out of `notes`, so a page that shows the
	 * number reading as its result need not repeat it.
	 */
	numberNote?: string;
	/** A Crockford check symbol at the end, what it stands for, and whether it matches. */
	check?: { symbol: string; value: number; expected: number; valid: boolean };
};

/** Crockford's five extra check symbols, for the values 32 to 36. */
export const CROCKFORD_CHECK_SYMBOLS = '*~$=U';

/** Only the ASCII letters are folded to capitals: toUpperCase would turn ı into I and ﬆ into ST. */
const asciiUpper = (ch: string) => (ch >= 'a' && ch <= 'z' ? ch.toUpperCase() : ch);

/** The 26 characters of a ULID: a 48-bit time and 80 random bits, one 128-bit number. */
export const ULID_LENGTH = 26;

/**
 * 16 bytes written the ULID way: one 128-bit number in 26 Crockford
 * characters, with the 2 spare bits as zeros at the front. Encoding the same
 * bytes from the left puts those zeros at the end instead, so the two strings
 * differ; this is the reading base32Decode returns as `asNumber`, turned back.
 */
export function crockfordNumber(bytes: number[]): string {
	if (bytes.length !== 16) throw new BaseNError('A ULID is 16 bytes, one 128-bit number.');
	let n = bytesToBigInt(bytes);
	let text = '';
	for (let k = 0; k < ULID_LENGTH; k++) {
		text = BASE32_ALPHABETS.crockford[Number(n & 31n)] + text;
		n >>= 5n;
	}
	return text;
}

const allowedBase32: Record<Base32Variant, string> = {
	rfc4648: 'A–Z and 2–7',
	hex: '0–9 and A–V',
	crockford: '0–9 and the letters A–Z except I, L, O and U'
};

/**
 * Decodes Base32 in the chosen alphabet. Spaces and line breaks are skipped
 * (TOTP secrets are often shown in blocks of four), and small letters are
 * read as capitals. Crockford's alphabet also skips hyphens and reads I and L
 * as 1 and O as 0, as his scheme says a decoder should, and checks one of his
 * check symbols (* ~ $ = U) at the end. Anything else that cannot be Base32 is
 * refused with its position in what was typed.
 *
 * The bytes are always cut the RFC 4648 way, from the left, with the spare
 * bits at the end, which is what most Crockford libraries do with bytes.
 * Crockford's own description, and ULIDs, write a number instead, with the
 * spare bits at the front; for a ULID-shaped input that reading is returned as
 * well, as `asNumber`.
 */
export function base32Decode(input: string, variant: Base32Variant = 'rfc4648'): Base32Decoded {
	const notes: string[] = [];
	const crockford = variant === 'crockford';
	const alphabet = BASE32_ALPHABETS[variant];
	const kept = significant(input, crockford ? /[\s-]/ : /\s/);
	if (/\S\s+\S/.test(input.trim())) notes.push('Spaces and line breaks were ignored.');
	if (crockford && input.includes('-'))
		notes.push('Hyphens were ignored: Crockford Base32 allows them for readability.');

	// A Crockford check symbol is the last character; only the five extra ones
	// can be told apart from data, since the other 32 are ordinary characters.
	let checkSymbol: { ch: string; at: number } | undefined;
	if (crockford && kept.length > 1 && CROCKFORD_CHECK_SYMBOLS.includes(asciiUpper(kept[kept.length - 1].ch)))
		checkSymbol = kept.pop();
	if (crockford) {
		const misplaced = kept.find((k) => CROCKFORD_CHECK_SYMBOLS.includes(asciiUpper(k.ch)));
		if (misplaced) {
			const symbols = CROCKFORD_CHECK_SYMBOLS.split('').join(' ');
			// Only reached with one character when it is all there is: a check
			// symbol checks the number before it, so it cannot stand alone.
			throw new BaseNError(
				kept.length === 1
					? `${show(misplaced.ch)} (character ${
							misplaced.at
					  }) is one of Crockford's check symbols (${symbols}), which check the characters before them, so it needs data in front of it.`
					: `${show(misplaced.ch)} (character ${
							misplaced.at
					  }) is one of Crockford's check symbols (${symbols}), which can only come once, at the very end.${
							misplaced.ch === '=' ? ' Crockford Base32 has no = padding.' : ''
					  }`,
				misplaced.at
			);
		}
	}

	// Split off the padding first, so an = in the middle is reported as such.
	const firstPad = kept.findIndex((k) => k.ch === '=');
	const body = firstPad >= 0 ? kept.slice(0, firstPad) : kept;
	const tail = firstPad >= 0 ? kept.slice(firstPad) : [];
	const stray = tail.find((k) => k.ch !== '=');
	if (stray)
		throw new BaseNError(
			`Padding (=) can only come at the very end, but character ${kept[firstPad].at} is = and more follows it.`,
			kept[firstPad].at
		);

	let lower = false;
	let confusable = false;
	const indexes: number[] = [];
	const chars: string[] = [];
	for (const { ch, at } of body) {
		let c = asciiUpper(ch);
		if (c !== ch) lower = true;
		if (crockford && (c === 'I' || c === 'L')) {
			c = '1';
			confusable = true;
		} else if (crockford && c === 'O') {
			c = '0';
			confusable = true;
		}
		const index = alphabet.indexOf(c);
		if (index < 0) {
			const why =
				variant === 'rfc4648' && /[018]/.test(c)
					? '; a 0, 1 or 8 is probably the letter O, I or B'
					: variant === 'rfc4648' && c === '9'
					? '; 9 is not used either'
					: variant === 'hex' && /[W-Z]/.test(c)
					? '; base32hex stops at V, the 32nd character'
					: '';
			throw new BaseNError(
				`${show(ch)} (character ${at}) is not in the ${BASE32_NAMES[variant]} alphabet (${
					allowedBase32[variant]
				})${why}.`,
				at
			);
		}
		indexes.push(index);
		chars.push(c);
	}
	if (lower && !crockford) notes.push('Small letters were read as capitals.');
	if (confusable) notes.push('I and L were read as 1 and O as 0, as Crockford Base32 allows.');

	const padding = tail.length;
	const leftover = body.length % 8;
	const needed = BASE32_PAD[leftover];
	if (needed === undefined)
		throw new BaseNError(
			`${body.length} character${body.length === 1 ? '' : 's'} leave${
				body.length === 1 ? 's' : ''
			} ${leftover} over after the groups of eight, and a group can only end after 2, 4, 5 or 7 characters (1, 2, 3 or 4 bytes). A character is probably missing or extra.`
		);
	if (padding) {
		if (padding !== needed)
			throw new BaseNError(
				needed === 0
					? `The data is a whole number of 8-character groups, so it needs no padding, but ends with ${padding} = sign${
							padding > 1 ? 's' : ''
					  }.`
					: `The last group has ${leftover} characters, so it needs ${needed} = sign${
							needed > 1 ? 's' : ''
					  }, not ${padding}.`
			);
	} else if (needed && !crockford) {
		notes.push(`The padding was missing; the last group is read as if it ended in ${'='.repeat(needed)}.`);
	}

	// A ULID is one 128-bit number in 26 characters (130 bits), so its first
	// two bits are zeros at the front, not filler at the end. Read that way when
	// the input has a ULID's shape, and say so instead of warning about the end.
	let asNumber: number[] | undefined;
	if (crockford && chars.length === ULID_LENGTH) {
		const value = indexes.reduce((n, i) => n * 32n + BigInt(i), 0n);
		if (value < 1n << 128n) {
			const raw = bigIntToBytes(value);
			asNumber = [...Array(16 - raw.length).fill(0), ...raw];
		}
	}

	let check: Base32Decoded['check'];
	if (checkSymbol) {
		const symbol = asciiUpper(checkSymbol.ch);
		const value = 32 + CROCKFORD_CHECK_SYMBOLS.indexOf(symbol);
		const expected = Number(indexes.reduce((n, i) => n * 32n + BigInt(i), 0n) % 37n);
		check = { symbol, value, expected, valid: value === expected };
		if (!check.valid)
			throw new BaseNError(
				`The last character, ${symbol}, is a Crockford check symbol for ${value}, but the number before it, taken mod 37, is ${expected}${
					expected < 32 ? ` (${alphabet[expected]})` : ` (${CROCKFORD_CHECK_SYMBOLS[expected - 32]})`
				}. A character is probably mistyped.`,
				checkSymbol.at
			);
		notes.push(
			`The last character, ${symbol}, is a Crockford check symbol: the number before it, taken mod 37, is ${value}, so it matches. It is not part of the data.`
		);
	}

	const groups: Base32Group[] = [];
	const bytes: number[] = [];
	for (let i = 0; i < chars.length; i += 8) {
		const groupChars = chars.slice(i, i + 8);
		const groupIndexes = indexes.slice(i, i + 8);
		const quintets = groupIndexes.map((n) => n.toString(2).padStart(5, '0'));
		const bits = quintets.join('');
		const byteCount = Math.floor(bits.length / 8);
		const fillBits = bits.length - byteCount * 8;
		const groupBytes = chunk(bits.slice(0, byteCount * 8), 8).map((b) => parseInt(b, 2));
		if (fillBits && !asNumber && /1/.test(bits.slice(byteCount * 8)))
			notes.push(
				`The last character, ${
					groupChars[groupChars.length - 1]
				}, has 1s in its final ${fillBits} bits, which an encoder always leaves as 0. They were ignored, but the input may have been altered.`
			);
		const groupPadding = 8 - groupChars.length;
		const showPad = padding > 0 && !crockford && i + 8 >= chars.length;
		groups.push({
			bytes: groupBytes,
			bits,
			fillBits,
			quintets,
			indexes: groupIndexes,
			chars: [...groupChars, ...Array(showPad ? groupPadding : 0).fill('=')],
			padding: groupPadding
		});
		bytes.push(...groupBytes);
	}
	const numberNote =
		asNumber &&
		`26 characters is the length of a ULID, which is one 128-bit number with 2 zero bits at the front, not bytes cut from the left. Read as a number, these characters are the 16 bytes ${hexBytes(
			asNumber
		)}.`;
	return { bytes, groups, notes, asNumber, numberNote, check };
}

// --- Base58 ----------------------------------------------------------------

/** Bitcoin's alphabet: the digits and letters without 0, O, I and l. */
export const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * The most bytes Base58 is worked through for. Repeated division of an n-byte
 * number takes n² time and the kept steps n² memory, so a pasted file would
 * freeze the page; 2,000 bytes is far beyond any address or key and still quick.
 */
export const MAX_BASE58_BYTES = 2000;
/** The longest Base58 string of MAX_BASE58_BYTES bytes, each character carrying log2 58 bits. */
export const MAX_BASE58_CHARS = Math.ceil((MAX_BASE58_BYTES * 8) / Math.log2(58));

/** One step of repeated division: n = 58 × quotient + remainder. */
export type DivisionStep = {
	dividend: bigint;
	quotient: bigint;
	remainder: number;
	/** The remainder as a digit or character of the new base. */
	digit: string;
};

/** One step of reading digits back: total = previous total × base + digit. */
export type HornerStep = {
	digit: string;
	value: number;
	/** The total before this digit. */
	before: bigint;
	/** before × base + value. */
	after: bigint;
};

export type Base58Encoded = {
	text: string;
	/** Zero bytes at the start, each written as 1 (the character for 0). */
	leadingZeros: number;
	/** The rest of the bytes as one number. */
	value: bigint;
	/** Repeated division of `value` by 58, first step first; empty when value is 0. */
	steps: DivisionStep[];
};

/**
 * Encodes bytes as Base58. The bytes are one big number, divided by 58 until
 * nothing is left; the remainders, last first, are the characters. A number
 * has no leading zeros, so zero bytes at the start would vanish: each one is
 * written as a 1 instead, which is why every Bitcoin address with version byte
 * 0 starts with 1.
 */
export function base58Encode(bytes: number[]): Base58Encoded {
	if (bytes.length > MAX_BASE58_BYTES)
		throw new BaseNError(
			`That is ${bytes.length.toLocaleString(
				'en-GB'
			)} bytes; Base58 is worked through here for up to ${MAX_BASE58_BYTES.toLocaleString('en-GB')} bytes.`
		);
	let leadingZeros = 0;
	while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
	const value = bytesToBigInt(bytes.slice(leadingZeros));
	const steps = repeatedDivision(value, 58, BASE58_ALPHABET, false);
	const digits = steps
		.map((s) => s.digit)
		.reverse()
		.join('');
	return { text: '1'.repeat(leadingZeros) + digits, leadingZeros, value, steps };
}

export type Base58Decoded = {
	bytes: number[];
	/** 1s at the start, each one a zero byte. */
	leadingOnes: number;
	value: bigint;
	/** The remaining characters read one at a time. */
	steps: HornerStep[];
};

/**
 * Decodes Base58: each character's value is added to the total times 58, then
 * the number is written out as bytes and the leading 1s become zero bytes.
 * Spaces around the input are trimmed; anything inside that is not in the
 * alphabet is refused with its position, with a hint for the four characters
 * Base58 leaves out on purpose.
 */
export function base58Decode(input: string): Base58Decoded {
	const text = input.trim();
	if (text.length > MAX_BASE58_CHARS)
		throw new BaseNError(
			`That is ${text.length.toLocaleString(
				'en-GB'
			)} characters; Base58 is decoded here for up to ${MAX_BASE58_CHARS.toLocaleString(
				'en-GB'
			)}, the length of ${MAX_BASE58_BYTES.toLocaleString('en-GB')} bytes.`
		);
	const offset = input.length - input.trimStart().length;
	let at = offset;
	const values: number[] = [];
	for (const ch of text) {
		at++;
		const v = BASE58_ALPHABET.indexOf(ch);
		if (v < 0) {
			const hint =
				ch === '0' || ch === 'O' || ch === 'I' || ch === 'l'
					? ` Base58 leaves out 0, O, I and l because they are easy to mistake for each other; ${
							ch === '0' || ch === 'O' ? 'did you mean o' : 'did you mean 1 or i'
					  }?`
					: /\s/.test(ch)
					? ' Base58 has no spaces or line breaks inside it.'
					: ch === '+' || ch === '/' || ch === '='
					? ' That is a Base64 character; Base58 uses only letters and digits.'
					: '';
			throw new BaseNError(
				`${/\s/.test(ch) ? 'A space or line break' : show(ch)} (character ${at}) is not in the Base58 alphabet.${hint}`,
				at
			);
		}
		values.push(v);
	}
	let leadingOnes = 0;
	while (leadingOnes < values.length && values[leadingOnes] === 0) leadingOnes++;
	const steps = hornerSteps(text.slice(leadingOnes), values.slice(leadingOnes), 58);
	const value = steps.length ? steps[steps.length - 1].after : 0n;
	return { bytes: [...Array(leadingOnes).fill(0), ...bigIntToBytes(value)], leadingOnes, value, steps };
}

function hornerSteps(digits: string, values: number[], base: number): HornerStep[] {
	const b = BigInt(base);
	const chars = [...digits];
	let total = 0n;
	return values.map((value, i) => {
		const before = total;
		total = before * b + BigInt(value);
		return { digit: chars[i], value, before, after: total };
	});
}

/**
 * Repeated division by `base`. With `zeroStep` a value of 0 is one step that
 * gives the digit 0, which is right for a number; Base58 wants no steps at all,
 * since zero bytes are written as 1s separately.
 */
function repeatedDivision(value: bigint, base: number, alphabet: string, zeroStep: boolean): DivisionStep[] {
	const steps: DivisionStep[] = [];
	const b = BigInt(base);
	let n = value;
	if (n === 0n && !zeroStep) return steps;
	do {
		const quotient = n / b;
		const remainder = Number(n % b);
		steps.push({ dividend: n, quotient, remainder, digit: alphabet[remainder] });
		n = quotient;
	} while (n > 0n);
	return steps;
}

// --- Base58Check -----------------------------------------------------------

/** SHA-256 applied twice, as Bitcoin does for its checksums. */
export async function doubleSha256(bytes: number[]): Promise<number[]> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) throw new BaseNError('This browser cannot compute SHA-256 here, so the checksum cannot be checked.');
	const first = await subtle.digest('SHA-256', new Uint8Array(bytes));
	const second = await subtle.digest('SHA-256', first);
	return Array.from(new Uint8Array(second));
}

/** What a version byte (and payload length) says a Base58Check string is. */
export type VersionKind = { version: number; payloadLength: number; suffix?: number; name: string };

/**
 * The prefixes from Bitcoin's own code (chainparams). WIF keys for a
 * compressed public key carry one more byte, 01, after the 32-byte key.
 */
export const VERSION_KINDS: VersionKind[] = [
	{ version: 0x00, payloadLength: 20, name: 'Bitcoin address (P2PKH, pay to public key hash)' },
	{ version: 0x05, payloadLength: 20, name: 'Bitcoin script address (P2SH)' },
	{ version: 0x6f, payloadLength: 20, name: 'Bitcoin testnet address (P2PKH)' },
	{ version: 0xc4, payloadLength: 20, name: 'Bitcoin testnet script address (P2SH)' },
	{ version: 0x80, payloadLength: 32, name: 'Bitcoin private key, WIF' },
	{ version: 0x80, payloadLength: 33, suffix: 0x01, name: 'Bitcoin private key, WIF, compressed public key' },
	{ version: 0xef, payloadLength: 32, name: 'Bitcoin testnet private key, WIF' },
	{ version: 0xef, payloadLength: 33, suffix: 0x01, name: 'Bitcoin testnet private key, WIF, compressed public key' }
];

export function describeVersion(version: number, payload: number[]): VersionKind | undefined {
	return VERSION_KINDS.find(
		(k) =>
			k.version === version &&
			k.payloadLength === payload.length &&
			(k.suffix === undefined || payload[payload.length - 1] === k.suffix)
	);
}

/**
 * The characters a Base58Check string of one kind can start with, found by
 * encoding the smallest and largest possible values (every value in between
 * starts with a character in between), and the longest such a string can be.
 */
export function leadingCharacters(kind: VersionKind): { first: string; last: string; longest: number } {
	const keyBytes = kind.payloadLength - (kind.suffix === undefined ? 0 : 1);
	const suffix = kind.suffix === undefined ? [] : [kind.suffix];
	const low = base58Encode([kind.version, ...Array(keyBytes).fill(0), ...suffix, 0, 0, 0, 0]).text;
	const high = base58Encode([kind.version, ...Array(keyBytes).fill(0xff), ...suffix, 0xff, 0xff, 0xff, 0xff]).text;
	return { first: low[0], last: high[0], longest: high.length };
}

export type Base58CheckResult = {
	decoded: Base58Decoded;
	version: number;
	payload: number[];
	/** The last 4 bytes, as written in the string. */
	checksum: number[];
	/** Double SHA-256 of version + payload. */
	hash: number[];
	/** Its first 4 bytes: what the checksum should be. */
	expected: number[];
	valid: boolean;
	kind?: VersionKind;
};

/**
 * Splits a Base58Check string into version byte, payload and checksum, and
 * recomputes the checksum. A single mistyped character changes the number
 * and so the checksum, which is the point of it.
 */
export async function base58CheckVerify(input: string): Promise<Base58CheckResult> {
	if (!input.trim()) throw new BaseNError('Paste a Base58Check string, such as a Bitcoin address, first.');
	const decoded = base58Decode(input);
	const { bytes } = decoded;
	if (bytes.length < 5)
		throw new BaseNError(
			`That decodes to ${bytes.length} byte${
				bytes.length === 1 ? '' : 's'
			}, but Base58Check needs at least 5: a version byte and a 4-byte checksum.`
		);
	const version = bytes[0];
	const payload = bytes.slice(1, -4);
	const checksum = bytes.slice(-4);
	const hash = await doubleSha256(bytes.slice(0, -4));
	const expected = hash.slice(0, 4);
	const valid = expected.every((b, i) => b === checksum[i]);
	return { decoded, version, payload, checksum, hash, expected, valid, kind: describeVersion(version, payload) };
}

/** Builds a Base58Check string: version byte, payload, then the first 4 bytes of the double SHA-256. */
export async function base58CheckEncode(version: number, payload: number[]): Promise<string> {
	const body = [version, ...payload];
	const hash = await doubleSha256(body);
	return base58Encode([...body, ...hash.slice(0, 4)]).text;
}

// --- Base 36 and any base from 2 to 36 ----------------------------------------

export const DIGITS36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The longest number accepted, in digits of the base it is written in. */
export const MAX_NUMBER_DIGITS = 400;

export type PlaceTerm = {
	digit: string;
	value: number;
	/** Position counting from 0 at the right. */
	power: number;
	place: bigint;
	product: bigint;
};

const baseDigits = (base: number) =>
	base <= 10 ? `0 to ${base - 1}` : base === 11 ? '0 to 9 and A' : `0 to 9 and A to ${DIGITS36[base - 1]}`;

/**
 * Reads a whole number written in any base from 2 to 36, upper or lower case.
 * Spaces and underscores are skipped as separators, and the usual prefixes
 * (0x, 0o, 0b) are accepted where they match the base. Leading zeros are kept
 * in `digits`, since the working should start from what was typed.
 */
export function parseInBase(input: string, base: number): { digits: string; value: bigint } {
	if (!Number.isInteger(base) || base < 2 || base > 36) throw new BaseNError('The base must be from 2 to 36.');
	const lead = input.length - input.trimStart().length;
	let text = input.trim();
	let skipped = lead;
	const prefix = text.match(/^0[xob]/i);
	if (prefix) {
		const p = prefix[0][1].toLowerCase();
		if ((p === 'x' && base === 16) || (p === 'o' && base === 8) || (p === 'b' && base === 2)) {
			text = text.slice(2);
			skipped += 2;
		}
	}
	if (!text) throw new BaseNError('Type a number first.');
	if (text[0] === '-' || text[0] === '−')
		throw new BaseNError('Whole numbers of zero or more only: negative numbers are not converted here.', skipped + 1);
	let digits = '';
	let at = skipped;
	for (const ch of text) {
		at++;
		if (/[\s_]/.test(ch)) continue;
		const v = DIGITS36.indexOf(asciiUpper(ch));
		if (v < 0 || v >= base) {
			const what =
				ch === '.' || ch === ','
					? ' Whole numbers only: fractions are not converted here.'
					: ` Base ${base} uses the digits ${baseDigits(base)}.`;
			throw new BaseNError(`${show(ch)} (character ${at}) is not a base ${base} digit.${what}`, at);
		}
		digits += DIGITS36[v];
	}
	if (!digits) throw new BaseNError('Type a number first.');
	if (digits.length > MAX_NUMBER_DIGITS) throw new BaseNError(`That is more than ${MAX_NUMBER_DIGITS} digits.`);
	let value = 0n;
	const b = BigInt(base);
	for (const ch of digits) value = value * b + BigInt(DIGITS36.indexOf(ch));
	return { digits, value };
}

/** A whole number written in `base`, in capitals unless `lower` is set. */
export function toBase(value: bigint, base: number, lower = false): string {
	if (value < 0n) throw new BaseNError('Whole numbers of zero or more only.');
	const out = repeatedDivision(value, base, DIGITS36, true)
		.map((s) => s.digit)
		.reverse()
		.join('');
	return lower ? out.toLowerCase() : out;
}

/** Repeated division by the base; zero is one step giving 0. */
export function divisionSteps(value: bigint, base: number): { steps: DivisionStep[]; result: string } {
	const steps = repeatedDivision(value, base, DIGITS36, true);
	return {
		steps,
		result: steps
			.map((s) => s.digit)
			.reverse()
			.join('')
	};
}

/** Every digit times its power of the base, most significant first, and their sum. */
export function placeValueSteps(digits: string, base: number): { terms: PlaceTerm[]; total: bigint } {
	const b = BigInt(base);
	const terms = [...digits].map((digit, i): PlaceTerm => {
		const power = digits.length - 1 - i;
		const place = b ** BigInt(power);
		const value = DIGITS36.indexOf(digit.toUpperCase());
		return { digit, value, power, place, product: BigInt(value) * place };
	});
	return { terms, total: terms.reduce((sum, t) => sum + t.product, 0n) };
}

/** Reading digits left to right, multiplying the total by the base each time. */
export function readingSteps(digits: string, base: number): HornerStep[] {
	return hornerSteps(
		digits,
		[...digits].map((d) => DIGITS36.indexOf(d.toUpperCase())),
		base
	);
}

/** The most bytes text mode reads as one number: 2,000 bits, which is 387 base 36 digits, under MAX_NUMBER_DIGITS. */
export const MAX_TEXT_BYTES = 250;

export type TextAsNumber = { bytes: number[]; leadingZeros: number; value: bigint; digits: string };

/**
 * Text as one base 36 number: its UTF-8 bytes read as a big-endian number.
 * Unlike Base58 there is no rule for zero bytes at the start, so they are lost;
 * the result reports how many, so the page can say so.
 */
export function bytesToBase36(bytes: number[], lower = false): TextAsNumber {
	if (bytes.length > MAX_TEXT_BYTES)
		throw new BaseNError(
			`That is ${bytes.length} bytes of UTF-8; text is read as one number here only up to ${MAX_TEXT_BYTES} bytes, so that the number can be read back.`
		);
	let leadingZeros = 0;
	while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
	const value = bytesToBigInt(bytes);
	return { bytes, leadingZeros, value, digits: bytes.length ? toBase(value, 36, lower) : '' };
}

/** The reverse: a base 36 number written out as the fewest bytes that hold it. */
export function base36ToBytes(input: string): { bytes: number[]; value: bigint; digits: string } {
	const { digits, value } = parseInBase(input, 36);
	return { bytes: bigIntToBytes(value), value, digits };
}

/**
 * The few characters around an error's position, so a page can show the bad
 * character in place rather than only give its number. Positions count
 * characters as typed, starting at 1.
 */
export function errorContext(
	input: string,
	position: number,
	span = 16
): { before: string; char: string; after: string; cutStart: boolean; cutEnd: boolean } {
	const chars = [...input];
	const i = Math.min(Math.max(position - 1, 0), Math.max(chars.length - 1, 0));
	const start = Math.max(0, i - span);
	const end = Math.min(chars.length, i + 1 + span);
	return {
		before: chars.slice(start, i).join(''),
		char: chars[i] ?? '',
		after: chars.slice(i + 1, end).join(''),
		cutStart: start > 0,
		cutEnd: end < chars.length
	};
}
