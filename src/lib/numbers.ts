// Fixed-width binary numbers: what a register actually holds.
//
// This is deliberately not a general base converter. Everything here is tied to
// a width, because that is what makes it digital logic rather than arithmetic:
// a value only means something once you say how many flip-flops are holding it,
// and the interesting behaviour — wrapping, the sign bit, overflow — only
// exists because the width is finite.

export type Base = 'decimal' | 'binary' | 'hex' | 'octal';

export const bases: { id: Base; label: string; radix: number; digits: RegExp }[] = [
	{ id: 'decimal', label: 'Decimal', radix: 10, digits: /^[0-9]+$/ },
	{ id: 'binary', label: 'Binary', radix: 2, digits: /^[01]+$/ },
	{ id: 'hex', label: 'Hex', radix: 16, digits: /^[0-9a-fA-F]+$/ },
	{ id: 'octal', label: 'Octal', radix: 8, digits: /^[0-7]+$/ }
];

/** Widths worth offering: a nibble, then the byte multiples. */
export const widths = [4, 8, 12, 16, 24, 32];

export const MAX_WIDTH = 32;

export class NumberError extends Error {}

/**
 * Reads a number written in `base`. A leading minus is allowed for decimal
 * only: a binary or hex literal is a bit pattern, and a bit pattern has no
 * sign of its own until you decide how to read it.
 */
export function parseNumber(text: string, base: Base): number {
	const trimmed = text.trim().replace(/[\s_]/g, '');
	if (!trimmed) throw new NumberError('Type a number first');

	const negative = trimmed.startsWith('-');
	const digits = negative ? trimmed.slice(1) : trimmed;
	if (negative && base !== 'decimal') {
		throw new NumberError('Only decimal can be written with a minus sign');
	}

	const spec = bases.find((b) => b.id === base);
	if (!spec) throw new NumberError(`Unknown base ${base}`);
	if (!spec.digits.test(digits)) {
		throw new NumberError(`That is not a ${spec.label.toLowerCase()} number`);
	}
	const value = parseInt(digits, spec.radix);
	if (!Number.isSafeInteger(value)) throw new NumberError('That number is too big');
	return negative ? -value : value;
}

/** The unsigned range a width can hold, and the signed range in two's complement. */
export function rangeOf(width: number) {
	return {
		unsignedMax: 2 ** width - 1,
		signedMin: -(2 ** (width - 1)),
		signedMax: 2 ** (width - 1) - 1
	};
}

/** True when the value cannot be represented in `width` bits, signed or not. */
export function fits(value: number, width: number): boolean {
	const { unsignedMax, signedMin } = rangeOf(width);
	return value >= signedMin && value <= unsignedMax;
}

/**
 * The bit pattern for a value, most significant bit first. A negative number
 * becomes its two's complement, which is the whole point: the same pattern is
 * both "that negative number" and "some large positive number", and only the
 * reader decides which.
 */
export function toBits(value: number, width: number): (0 | 1)[] {
	const wrapped = ((Math.trunc(value) % 2 ** width) + 2 ** width) % 2 ** width;
	return Array.from({ length: width }, (_, i): 0 | 1 => (Math.floor(wrapped / 2 ** (width - 1 - i)) % 2 === 1 ? 1 : 0));
}

/** The unsigned value of a bit pattern. */
export const fromBits = (bits: (0 | 1)[]): number => bits.reduce<number>((total, bit) => total * 2 + bit, 0);

/** The same pattern read as two's complement: the top bit is worth -2^(n-1). */
export function signedValue(bits: (0 | 1)[]): number {
	if (!bits.length) return 0;
	const unsigned = fromBits(bits);
	return bits[0] === 1 ? unsigned - 2 ** bits.length : unsigned;
}

/** Groups bits for reading, four at a time by convention. */
export function groupBits(bits: (0 | 1)[], size = 4): string {
	const text = bits.join('');
	const head = text.length % size;
	const groups = [head ? text.slice(0, head) : '', ...(text.slice(head).match(/.{4}/g) ?? [])];
	return groups.filter(Boolean).join(' ');
}

/** Renders a bit pattern in another base, padded to the width it deserves. */
export function render(bits: (0 | 1)[], base: Base): string {
	const value = fromBits(bits);
	switch (base) {
		case 'decimal':
			return String(value);
		case 'binary':
			return bits.join('');
		case 'hex':
			return value
				.toString(16)
				.toUpperCase()
				.padStart(Math.ceil(bits.length / 4), '0');
		case 'octal':
			return value.toString(8).padStart(Math.ceil(bits.length / 3), '0');
	}
}

/**
 * Binary coded decimal: each decimal digit in its own four bits. Wasteful, but
 * it is what a seven segment display wants, because each digit drives its own
 * decoder without anyone having to divide by ten.
 */
export function toBcd(value: number): { digit: number; bits: (0 | 1)[] }[] {
	if (value < 0) throw new NumberError('BCD has no sign');
	return String(Math.trunc(value))
		.split('')
		.map((d) => ({ digit: Number(d), bits: toBits(Number(d), 4) }));
}

/** The six of sixteen four-bit patterns that are not decimal digits. */
export const invalidBcdPatterns = Array.from({ length: 6 }, (_, i) => toBits(10 + i, 4));

/** Two's complement, step by step, because that is how it is taught. */
export function negationSteps(value: number, width: number) {
	const original = toBits(Math.abs(value), width);
	const inverted = original.map((bit) => (bit ? 0 : 1) as 0 | 1);
	const result = toBits(-Math.abs(value), width);
	return { original, inverted, result };
}
