// Two's complement, as the tables a page needs: every pattern of a width read
// four ways, negation as the steps it is taught in, and signed addition and
// subtraction traced column by column with the overflow rule applied. All of
// it comes from the same fixed-width helpers the binary converter uses, and
// the test suite checks each table against plain integer arithmetic.

import { toBits, fromBits, signedValue, rangeOf } from './numbers.js';
import { rippleAdd, type Addition, type Bit } from './adders.js';

export type Representation = {
	bits: Bit[];
	pattern: string;
	unsigned: number;
	/** Top bit is the sign, the rest the magnitude; 1000 is a second zero. */
	signMagnitude: number;
	/** Negatives are the bitwise inverse of positives; 1111 is a second zero. */
	onesComplement: number;
	twosComplement: number;
};

/** Every pattern of a width, in counting order, read as each of the four codes. */
export function representations(width: number): Representation[] {
	return Array.from({ length: 1 << width }, (_, value) => {
		const bits = toBits(value, width);
		const magnitude = fromBits(bits.slice(1));
		const negative = bits[0] === 1;
		return {
			bits,
			pattern: bits.join(''),
			unsigned: value,
			signMagnitude: (negative ? -magnitude : magnitude) || 0,
			onesComplement: (negative ? -(2 ** width - 1 - value) : value) || 0,
			twosComplement: signedValue(bits)
		};
	});
}

/** The signed and unsigned ranges of the usual widths. */
export function ranges(widths: number[]) {
	return widths.map((width) => ({ width, ...rangeOf(width) }));
}

export type Negation = {
	value: number;
	width: number;
	/** The value's own pattern, the inverted pattern, and the result after adding 1. */
	original: Bit[];
	inverted: Bit[];
	result: Bit[];
	/** The value the result reads as in two's complement, which is −value when that fits. */
	reading: number;
	/** The shortcut: copy up to and including the first 1 from the right, invert the rest. */
	shortcutIndex: number;
	fits: boolean;
};

/**
 * Negates a value the way it is taught: invert every bit, then add 1. A
 * negative value starts from its own pattern and comes out positive, since
 * the same two steps work in both directions.
 */
export function negate(value: number, width: number): Negation {
	const original = toBits(value, width);
	const inverted = original.map((bit) => (bit ? 0 : 1) as Bit);
	const result = toBits(-value, width);
	const firstOne = [...original].reverse().indexOf(1);
	const { signedMin, signedMax } = rangeOf(width);
	return {
		value,
		width,
		original,
		inverted,
		result,
		reading: signedValue(result),
		// Zero has no 1 to stop at, so every bit is copied.
		shortcutIndex: firstOne < 0 ? 0 : width - 1 - firstOne,
		fits: -value >= signedMin && -value <= signedMax && value >= signedMin && value <= signedMax
	};
}

export type SignedSum = Addition & {
	aSigned: number;
	bSigned: number;
	/** What the result pattern reads as in two's complement. */
	resultSigned: number;
	/** The true sum, which is the result only when there was no overflow. */
	expected: number;
	/** Whether the carry out is meaningful (unsigned) or discarded (signed). */
	kind: 'add' | 'subtract';
	/** For subtraction, the inverted second operand that was actually added. */
	inverted?: Bit[];
};

/** Adds two signed values, reading the operands and result as two's complement. */
export function addSigned(a: number, b: number, width: number): SignedSum {
	const sum = rippleAdd(a, b, width, 0);
	return {
		...sum,
		aSigned: signedValue(sum.aBits),
		bSigned: signedValue(sum.bBits),
		resultSigned: signedValue(sum.sumBits),
		expected: signedValue(sum.aBits) + signedValue(sum.bBits),
		kind: 'add'
	};
}

/** Subtracts by inverting the subtrahend and adding with a carry in of 1. */
export function subtractSigned(a: number, b: number, width: number): SignedSum {
	const bBits = toBits(b, width);
	const inverted = bBits.map((bit) => (bit ? 0 : 1) as Bit);
	const sum = rippleAdd(a, fromBits(inverted), width, 1);
	return {
		...sum,
		// Show the original operand, not the pattern that went into the adder.
		bBits,
		b,
		inverted,
		aSigned: signedValue(sum.aBits),
		bSigned: signedValue(bBits),
		resultSigned: signedValue(sum.sumBits),
		expected: signedValue(sum.aBits) - signedValue(bBits),
		kind: 'subtract'
	};
}

/** Copies the sign bit into the new top bits, which keeps the value the same. */
export function signExtend(value: number, from: number, to: number): { before: Bit[]; after: Bit[]; value: number } {
	const before = toBits(value, from);
	const signed = signedValue(before);
	return { before, after: toBits(signed, to), value: signed };
}

/** The overflow cases a page shows: same signs in, a different sign out. */
export const overflowExamples = (width: number) => {
	const { signedMax, signedMin } = rangeOf(width);
	return [
		addSigned(signedMax, 1, width),
		addSigned(signedMin, -1, width),
		addSigned(signedMax - 2, -3, width),
		addSigned(-3, -4, width)
	];
};
