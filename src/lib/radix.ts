// Base conversion with the working shown, the way it is done on paper.
//
// numbers.ts deals in fixed-width registers; this file deals in numbers of any
// length (up to MAX_DIGITS digits), held as BigInt so nothing is rounded. Each
// function returns the steps as data, and the pages draw them, so a worked
// example can never disagree with its answer.

export type Radix = 2 | 8 | 10 | 16;

export class RadixError extends Error {}

/** The longest input accepted, in digits of whatever base it is written in. */
export const MAX_DIGITS = 64;

export const radixNames: Record<Radix, string> = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' };

const DIGITS = '0123456789ABCDEF';

/** The value of one digit character, or -1 when it is not a digit at all. */
export const digitValue = (ch: string): number => DIGITS.indexOf(ch.toUpperCase());

/** One digit value as its character: 11 is B. */
export const digitChar = (value: number): string => DIGITS[value];

/** How a base's valid digits are described in an error message. */
const allowed: Record<Radix, string> = {
	2: '0 and 1',
	8: '0 to 7',
	10: '0 to 9',
	16: '0 to 9 and A to F'
};

/**
 * Strips what people paste along with a number: spaces and underscores used as
 * separators, commas between groups of three in decimal (65,535), and the prefixes that languages put in front of literals (0x,
 * 0b, 0o, #, and h or b suffixes are not handled, being ambiguous).
 */
export function cleanDigits(text: string, radix: Radix): string {
	let s = text.trim().replace(/[\s_]/g, '');
	if (radix === 16) s = s.replace(/^(0x|#|\$)/i, '');
	if (radix === 2) s = s.replace(/^0b/i, '');
	if (radix === 8) s = s.replace(/^0o/i, '');
	// Only well-formed thousands groups, so a decimal comma such as 1,5 is still refused.
	if (radix === 10 && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
	return s;
}

/**
 * Reads an unsigned whole number written in `radix`. Leading zeros are kept in
 * `digits`, since a worked example should start from what was typed.
 */
export function parseRadix(text: string, radix: Radix): { digits: string; value: bigint } {
	const s = cleanDigits(text, radix);
	if (!s) throw new RadixError('Type a number first');
	if (s.startsWith('-')) {
		throw new RadixError('This converter takes whole numbers of zero or more; a negative number needs a bit width');
	}
	if (/[.,]/.test(s)) throw new RadixError('Whole numbers only: fractions are not converted here');
	for (const ch of s) {
		const d = digitValue(ch);
		if (d < 0 || d >= radix) {
			throw new RadixError(
				`"${ch}" is not ${radix === 8 ? 'an' : 'a'} ${radixNames[radix]} digit: use ${allowed[radix]}`
			);
		}
	}
	if (s.length > MAX_DIGITS) throw new RadixError(`That is more than ${MAX_DIGITS} digits`);
	const digits = s.toUpperCase();
	let value = 0n;
	for (const ch of digits) value = value * BigInt(radix) + BigInt(digitValue(ch));
	return { digits, value };
}

/** A value written in `radix`, upper case, with no prefix. */
export const toRadix = (value: bigint, radix: Radix): string => value.toString(radix).toUpperCase();

/** Groups a digit string from the right, for reading: 11111111 → 1111 1111. */
export function groupDigits(digits: string, size: number, separator = ' '): string {
	const head = digits.length % size;
	const parts = head ? [digits.slice(0, head)] : [];
	for (let i = head; i < digits.length; i += size) parts.push(digits.slice(i, i + size));
	return parts.join(separator);
}

/** Thousands separators for a decimal string. */
export const groupDecimal = (digits: string) => groupDigits(digits, 3, ',');

export type PlaceTerm = {
	/** The digit as written. */
	digit: string;
	/** Its value, 0 to radix − 1. */
	value: number;
	/** Its position counting from 0 at the right. */
	power: number;
	/** radix to the power of `power`. */
	place: bigint;
	/** value × place. */
	product: bigint;
};

/**
 * The place-value method: every digit times its power of the base, summed.
 * Terms come most significant first, the order they are written in.
 */
export function placeValueSteps(digits: string, radix: Radix): { terms: PlaceTerm[]; total: bigint } {
	const terms = [...digits].map((digit, i): PlaceTerm => {
		const power = digits.length - 1 - i;
		const place = BigInt(radix) ** BigInt(power);
		const value = digitValue(digit);
		return { digit, value, power, place, product: BigInt(value) * place };
	});
	return { terms, total: terms.reduce((sum, t) => sum + t.product, 0n) };
}

export type DivisionStep = {
	dividend: bigint;
	quotient: bigint;
	remainder: number;
	/** The remainder as a digit of the new base. */
	digit: string;
};

/**
 * Repeated division: divide by the base, keep the remainder, carry on with the
 * quotient until it is zero. The remainders read from the last to the first
 * are the answer. Zero is a single step that gives 0.
 */
export function divisionSteps(value: bigint, radix: Radix): { steps: DivisionStep[]; result: string } {
	const steps: DivisionStep[] = [];
	const r = BigInt(radix);
	let n = value;
	do {
		const quotient = n / r;
		const remainder = Number(n % r);
		steps.push({ dividend: n, quotient, remainder, digit: digitChar(remainder) });
		n = quotient;
	} while (n > 0n);
	return {
		steps,
		result: steps
			.map((s) => s.digit)
			.reverse()
			.join('')
	};
}

/** Bits per digit for the bases that are powers of two. */
export const bitsPerDigit = (radix: 2 | 8 | 16): number => (radix === 16 ? 4 : radix === 8 ? 3 : 1);

export type Group = { digit: string; bits: string };

/**
 * Hex or octal to binary: each digit becomes its own group of 4 or 3 bits.
 * No arithmetic, just a lookup, which is the reason these bases exist.
 */
export function digitsToBitGroups(digits: string, radix: 8 | 16): Group[] {
	const size = bitsPerDigit(radix);
	return [...digits].map((digit) => ({
		digit,
		bits: digitValue(digit).toString(2).padStart(size, '0')
	}));
}

/**
 * Binary to hex or octal: pad on the left to a whole number of groups, then
 * read each group as one digit. `padded` says how many zeros were added.
 */
export function bitsToDigitGroups(bits: string, radix: 8 | 16): { groups: Group[]; padded: number } {
	const size = bitsPerDigit(radix);
	const padded = (size - (bits.length % size)) % size;
	const full = '0'.repeat(padded) + bits;
	const groups: Group[] = [];
	for (let i = 0; i < full.length; i += size) {
		const chunk = full.slice(i, i + size);
		groups.push({ bits: chunk, digit: digitChar(parseInt(chunk, 2)) });
	}
	return { groups, padded };
}

/** Joins groups into the converted number, dropping leading zero digits but keeping a lone 0. */
export const joinDigits = (groups: Group[]): string =>
	groups
		.map((g) => g.digit)
		.join('')
		.replace(/^0+(?=.)/, '');

/** Joins groups into a bit string, dropping leading zeros but keeping a lone 0. */
export const joinBits = (groups: Group[]): string =>
	groups
		.map((g) => g.bits)
		.join('')
		.replace(/^0+(?=.)/, '');

/** The sixteen hex digits with their decimal and binary values, for the reference tables. */
export const hexDigitTable = Array.from({ length: 16 }, (_, value) => ({
	hex: digitChar(value),
	decimal: value,
	binary: value.toString(2).padStart(4, '0')
}));

/** The eight octal digits with their three bits. */
export const octalDigitTable = Array.from({ length: 8 }, (_, value) => ({
	octal: String(value),
	binary: value.toString(2).padStart(3, '0')
}));

/** Superscript digits, for writing 16³ in running text. */
export const superscript = (n: number): string =>
	String(n)
		.split('')
		.map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])
		.join('');
