// Low-precision floating point: FP16, BF16, the two OCP FP8 formats, FP4 and,
// for comparison, FP32. One engine covers them all, because they differ only
// in four things: how many exponent bits, how many mantissa bits, the bias,
// and what (if anything) the all-ones exponent is reserved for.
//
// Everything is exact. Decimal input becomes a fraction of BigInts and is
// rounded straight to each format, never through a JavaScript number, so the
// result for a format is never the double rounding of decimal → double →
// format. The tests decode every code of every format of 16 bits or fewer
// with an independent formula and check FP32 against ieee754.ts.

import { exactDecimal, shortDecimal, pow2, bitLength } from './ieee754.js';

export class MiniFloatError extends Error {}

/**
 * What the all-ones exponent means.
 * - 'ieee': infinity when the mantissa is zero, NaN otherwise (FP32, FP16, BF16, E5M2).
 * - 'fn': finite only; the single all-ones code S.1111.111 is NaN and the rest
 *   of the top exponent holds ordinary numbers (OCP E4M3, "E4M3FN").
 * - 'none': no infinity and no NaN at all; every code is a number (E2M1).
 */
export type Specials = 'ieee' | 'fn' | 'none';

export type FormatId = 'fp32' | 'fp16' | 'bf16' | 'e4m3' | 'e5m2' | 'e2m1';

export type MiniFormat = {
	id: FormatId;
	name: string;
	/** Other names people search for. */
	aka: string;
	bits: number;
	exponentBits: number;
	mantissaBits: number;
	bias: number;
	specials: Specials;
};

export const FORMATS: Record<FormatId, MiniFormat> = {
	fp32: {
		id: 'fp32',
		name: 'FP32',
		aka: 'single precision, float',
		bits: 32,
		exponentBits: 8,
		mantissaBits: 23,
		bias: 127,
		specials: 'ieee'
	},
	fp16: {
		id: 'fp16',
		name: 'FP16',
		aka: 'IEEE binary16, half precision',
		bits: 16,
		exponentBits: 5,
		mantissaBits: 10,
		bias: 15,
		specials: 'ieee'
	},
	bf16: {
		id: 'bf16',
		name: 'BF16',
		aka: 'bfloat16, brain floating point',
		bits: 16,
		exponentBits: 8,
		mantissaBits: 7,
		bias: 127,
		specials: 'ieee'
	},
	e4m3: {
		id: 'e4m3',
		name: 'FP8 E4M3',
		aka: 'OCP E4M3FN',
		bits: 8,
		exponentBits: 4,
		mantissaBits: 3,
		bias: 7,
		specials: 'fn'
	},
	e5m2: {
		id: 'e5m2',
		name: 'FP8 E5M2',
		aka: 'OCP E5M2',
		bits: 8,
		exponentBits: 5,
		mantissaBits: 2,
		bias: 15,
		specials: 'ieee'
	},
	e2m1: {
		id: 'e2m1',
		name: 'FP4 E2M1',
		aka: 'OCP MX FP4',
		bits: 4,
		exponentBits: 2,
		mantissaBits: 1,
		bias: 1,
		specials: 'none'
	}
};

/** The order the page shows them in: widest first, so precision visibly drains away. */
export const FORMAT_IDS: FormatId[] = ['fp32', 'fp16', 'bf16', 'e4m3', 'e5m2', 'e2m1'];

export type Kind = 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan';

export type Rational = { num: bigint; den: bigint };

export type Decoded = {
	format: FormatId;
	code: number;
	/** Every bit, most significant first. */
	bits: string;
	hex: string;
	sign: 0 | 1;
	exponentBits: string;
	mantissaBits: string;
	/** The exponent field read as an unsigned number. */
	biased: number;
	/** The power of two it stands for: biased − bias, or 1 − bias for zero and subnormals. Null for Inf and NaN. */
	exponent: number | null;
	kind: Kind;
	/** The exact value, sign included. Null for Inf and NaN; −0 has num 0 and sign 1. */
	value: Rational | null;
	/** The exact value in full as a decimal, or '-0', 'Infinity', '-Infinity', 'NaN'. */
	exact: string;
	/** The value as a JavaScript number, for sorting and short display. */
	number: number;
	/** 1.mmm for normals, 0.mmm for zero and subnormals, '' otherwise. */
	significand: string;
};

/** 2^k as an exact rational. */
const twoTo = (k: number): Rational => (k >= 0 ? { num: pow2(k), den: 1n } : { num: 1n, den: pow2(-k) });

/** A rational as a JavaScript number, close enough for display and ordering (never used for results). */
function toNumber(r: Rational): number {
	if (r.num === 0n) return 0;
	const sign = r.num < 0n ? -1 : 1;
	const n = r.num < 0n ? -r.num : r.num;
	// Scale both to about 60 bits so neither Number() overflows.
	const shift = bitLength(n) - bitLength(r.den);
	const scaled = shift >= 0 ? (n << 60n) / (r.den << BigInt(shift)) : ((n << BigInt(-shift)) << 60n) / r.den;
	return sign * Number(scaled) * 2 ** (shift - 60);
}

export const emin = (f: MiniFormat) => 1 - f.bias;
const maxBiasedField = (f: MiniFormat) => 2 ** f.exponentBits - 1;

/** The largest finite magnitude's code, which depends on what the top exponent is reserved for. */
export function maxFiniteCode(f: MiniFormat): number {
	const top = maxBiasedField(f);
	const allOnes = 2 ** f.mantissaBits - 1;
	if (f.specials === 'ieee') return (top - 1) * 2 ** f.mantissaBits + allOnes;
	if (f.specials === 'fn') return top * 2 ** f.mantissaBits + allOnes - 1;
	return top * 2 ** f.mantissaBits + allOnes;
}

const hexOf = (code: number, bits: number) =>
	code
		.toString(16)
		.toUpperCase()
		.padStart(Math.ceil(bits / 4), '0');

/** Reads a code (a whole number of the format's width) as a float. */
export function decode(code: number, id: FormatId): Decoded {
	const f = FORMATS[id];
	if (!Number.isInteger(code) || code < 0 || code >= 2 ** f.bits)
		throw new MiniFloatError(`A ${f.name} code is a whole number from 0 to ${2 ** f.bits - 1}`);
	const bits = code.toString(2).padStart(f.bits, '0');
	const sign = bits[0] === '1' ? 1 : 0;
	const exponentBits = bits.slice(1, 1 + f.exponentBits);
	const mantissaBits = bits.slice(1 + f.exponentBits);
	const biased = parseInt(exponentBits, 2);
	const fraction = BigInt('0b' + mantissaBits);
	const allOnes = pow2(f.mantissaBits) - 1n;
	const top = biased === maxBiasedField(f);

	let kind: Kind;
	if (top && f.specials === 'ieee') kind = fraction === 0n ? 'infinity' : 'nan';
	else if (top && f.specials === 'fn' && fraction === allOnes) kind = 'nan';
	else if (biased === 0) kind = fraction === 0n ? 'zero' : 'subnormal';
	else kind = 'normal';

	let exponent: number | null = null;
	let value: Rational | null = null;
	let exact: string;
	let number: number;
	if (kind === 'infinity') {
		exact = sign ? '-Infinity' : 'Infinity';
		number = sign ? -Infinity : Infinity;
	} else if (kind === 'nan') {
		exact = 'NaN';
		number = NaN;
	} else {
		exponent = kind === 'normal' ? biased - f.bias : emin(f);
		const mantissa = kind === 'normal' ? pow2(f.mantissaBits) + fraction : fraction;
		// value = mantissa × 2^(exponent − mantissaBits)
		const k = exponent - f.mantissaBits;
		const signed = sign ? -mantissa : mantissa;
		value = k >= 0 ? { num: signed * pow2(k), den: 1n } : { num: signed, den: pow2(-k) };
		exact = kind === 'zero' ? (sign ? '-0' : '0') : exactDecimal(value.num, value.den);
		number = kind === 'zero' ? (sign ? -0 : 0) : toNumber(value);
	}
	const significand =
		kind === 'normal' ? `1.${mantissaBits}` : kind === 'infinity' || kind === 'nan' ? '' : `0.${mantissaBits}`;
	return {
		format: id,
		code,
		bits,
		hex: hexOf(code, f.bits),
		sign,
		exponentBits,
		mantissaBits,
		biased,
		exponent,
		kind,
		value,
		exact,
		number,
		significand
	};
}

// --- Decimal input --------------------------------------------------------

/** Beyond 10 to this power either way, a decimal is out of range for every format here (FP32 spans about 10^±45). */
const MAX_DECIMAL_ORDER = 400;
export const MAX_INPUT = 400;

export type Parsed =
	| {
			kind: 'number';
			negative: boolean;
			/** The magnitude; for a number beyond every range, just its digits (see order). */
			value: Rational;
			normalised: string;
			beyond?: 'huge' | 'tiny';
			/** For a number beyond every range, the power of ten of its leading digit. */
			order?: number;
	  }
	| { kind: 'infinity'; negative: boolean; normalised: string }
	| { kind: 'nan'; negative: boolean; normalised: string };

/**
 * Commas are only accepted as thousands separators (1,000 or 12,345.6). Any
 * other comma is almost certainly a decimal comma, and silently dropping it
 * would turn 0,1 into 1, so that is an error that says what to type instead.
 */
function stripThousands(s: string): string {
	if (!s.includes(',')) return s;
	if (/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?(e[+-]?\d+)?$/.test(s)) return s.replace(/,/g, '');
	const suggestion = /^[+-]?\d*,\d+(e[+-]?\d+)?$/.test(s) ? `: ${s.replace(',', '.')}` : '';
	throw new MiniFloatError(
		`Use a point for the decimal${suggestion}. A comma is only read between groups of three digits, as in 1,000`
	);
}

/** Reads a decimal such as -1.25e-3, or Infinity or NaN, into an exact fraction. */
export function parseDecimal(text: string): Parsed {
	const cleaned = text.trim().replace(/[\s_]/g, '').replace(/[−–]/g, '-').toLowerCase();
	if (!cleaned) throw new MiniFloatError('Type a number first');
	if (cleaned.length > MAX_INPUT) throw new MiniFloatError(`That is longer than ${MAX_INPUT} characters`);
	const s = stripThousands(cleaned);
	const special = s.match(/^([+-]?)(inf|infinity|∞|nan)$/);
	if (special) {
		const negative = special[1] === '-';
		if (special[2] === 'nan') return { kind: 'nan', negative, normalised: 'NaN' };
		return { kind: 'infinity', negative, normalised: negative ? '-Infinity' : 'Infinity' };
	}
	// One sign at most: '+-5' is a typo, not -5.
	const m = s.match(/^([+-])?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/);
	if (!m || (!m[2] && !m[3])) {
		// Quote only the start, so a pasted paragraph gives a one-line error, not a wall of text.
		const typed = text.trim();
		const shown = typed.length > 20 ? `${typed.slice(0, 20)}…` : typed;
		throw new MiniFloatError(`"${shown}" is not a decimal number`);
	}
	const negative = m[1] === '-';
	const normalised = negative ? s : s.replace(/^\+/, '');
	const whole = m[2] || '';
	const frac = m[3] || '';
	const significant = (whole + frac).replace(/^0+(?=.)/, '') || '0';
	const digits = BigInt(significant);
	// Zero times any power of ten is zero. Settled before the exponent is even
	// read, so 0e999999999 cannot ask for a power of ten with a billion digits.
	if (digits === 0n) return { kind: 'number', negative, value: { num: 0n, den: 1n }, normalised };
	// A JavaScript number holds any exponent that fits in 400 characters (as
	// Infinity at worst), and the order check below catches all of them.
	const exp = m[4] ? Number(m[4]) : 0;
	const e10 = exp - frac.length;
	// The power of ten of the leading digit. Far outside every format's range the
	// answer is zero or infinity whatever the digits are, so it is settled here
	// rather than with an enormous exact fraction. The digits are at most 400
	// long, so within this order e10 is too, and the power of ten stays small.
	const order = significant.length - 1 + e10;
	if (!(Math.abs(order) <= MAX_DECIMAL_ORDER))
		return {
			kind: 'number',
			negative,
			value: { num: digits, den: 1n },
			normalised,
			order,
			beyond: order > 0 ? 'huge' : 'tiny'
		};
	const value = e10 >= 0 ? { num: digits * 10n ** BigInt(e10), den: 1n } : { num: digits, den: 10n ** BigInt(-e10) };
	return { kind: 'number', negative, value, normalised };
}

// --- Rounding --------------------------------------------------------------

/**
 * The guard, round and sticky bits of rounding a positive value to a format.
 * Hardware keeps the significand bits the format can store, plus two more
 * (guard and round) and one bit that is the OR of everything after them
 * (sticky). Those three are all it needs to round to nearest, ties to even.
 */
export type RoundingSteps = {
	/** The power of two of the leading bit, 2^e ≤ value < 2^(e+1). */
	e: number;
	/** Below the normal range the step between values stops shrinking, so fewer bits are kept. */
	subnormal: boolean;
	/** The weight of the last kept bit: 2^lsb. */
	lsb: number;
	/** The kept bits as a whole number, before rounding (value ÷ 2^lsb, truncated). */
	kept: bigint;
	/** kept written as 1.mmm or 0.mmm. */
	keptText: string;
	guard: 0 | 1;
	round: 0 | 1;
	sticky: 0 | 1;
	/** A few bits after guard and round, for showing where sticky comes from. */
	tail: string;
	/** True when everything after the kept bits is exactly one half of the last place. */
	tie: boolean;
	roundUp: boolean;
	/** Why: in words. */
	reason: string;
};

/** Floor of log2 of a positive rational. */
function floorLog2(v: Rational): number {
	let e = bitLength(v.num) - bitLength(v.den);
	const atLeast = (k: number) => (k >= 0 ? v.num >= v.den * pow2(k) : v.num * pow2(-k) >= v.den);
	while (!atLeast(e)) e--;
	while (atLeast(e + 1)) e++;
	return e;
}

/** v ÷ 2^k as quotient and remainder over a common denominator. */
function divPow2(v: Rational, k: number): { q: bigint; rem: bigint; den: bigint } {
	let N = v.num;
	let D = v.den;
	if (k >= 0) D *= pow2(k);
	else N *= pow2(-k);
	return { q: N / D, rem: N % D, den: D };
}

/**
 * The guard/round/sticky working for a magnitude (exponent range unbounded
 * above). The rounding itself only ever looks at the magnitude; `negative`
 * only changes the words, because moving a negative number's magnitude up
 * moves the number down.
 */
export function roundingSteps(v: Rational, id: FormatId, negative = false): RoundingSteps {
	const f = FORMATS[id];
	const e = floorLog2(v);
	const subnormal = e < emin(f);
	const lsb = Math.max(e, emin(f)) - f.mantissaBits;
	const { q: kept, rem, den } = divPow2(v, lsb);
	// The bits after the kept ones: rem/den in [0, 1), read off one at a time.
	let r = rem;
	const after: number[] = [];
	for (let i = 0; i < 10; i++) {
		r *= 2n;
		after.push(r >= den ? 1 : 0);
		if (r >= den) r -= den;
	}
	const guard = after[0] as 0 | 1;
	const round = after[1] as 0 | 1;
	// Sticky is everything after the round bit: any of the next bits, or anything left beyond them.
	const sticky = (after.slice(2).some((b) => b === 1) || r !== 0n ? 1 : 0) as 0 | 1;
	const tie = guard === 1 && round === 0 && sticky === 0;
	const odd = kept % 2n === 1n;
	const roundUp = guard === 1 && (round === 1 || sticky === 1 || odd);
	const towardZero = negative ? 'up, toward zero' : 'down';
	const awayFromZero = negative ? 'down, away from zero' : 'up';
	let reason: string;
	if (guard === 0 && round === 0 && sticky === 0)
		reason = 'Guard, round and sticky are all 0: nothing is lost, so the value is stored exactly.';
	else if (guard === 0)
		reason = `The guard bit is 0, so the rest is less than half a step: drop it, which rounds ${towardZero} (truncation).`;
	else if (round === 0 && sticky === 1)
		reason = `Guard is 1 and round is 0, which would be a tie, but sticky is 1: something further down is set, so the rest is more than half a step. Round ${awayFromZero}.`;
	else if (!tie)
		reason = `The guard bit is 1 and the round bit is 1, so the rest is more than half a step: round ${awayFromZero}.`;
	else if (odd)
		reason = `Guard is 1 and round and sticky are 0: exactly halfway. The last kept bit is 1 (odd), so round to the even pattern, which is ${awayFromZero}.`;
	else reason = 'Guard is 1 and round and sticky are 0: exactly halfway. The last kept bit is 0 (even), so keep it.';
	const keptBits = kept.toString(2).padStart(f.mantissaBits + 1, '0');
	return {
		e,
		subnormal,
		lsb,
		kept,
		keptText: `${keptBits[0]}.${keptBits.slice(1)}`,
		guard,
		round,
		sticky,
		tail: after.slice(2).join(''),
		tie,
		roundUp,
		reason
	};
}

export type OverflowMode = 'saturate' | 'nan';

export type Encoding = {
	format: FormatId;
	/** What was typed, normalised. */
	input: string;
	/** The code stored, or null when the format cannot hold the input at all (NaN in FP4). */
	result: Decoded | null;
	/** Why there is no result, when there is none. */
	note: string;
	/** stored − input, exactly, as a decimal; null when either is not finite, or the input is beyond 10^400. */
	error: string | null;
	errorShort: string | null;
	/** |stored − input| ÷ |input|, to a few figures; null for zero input or non-finite values. */
	relativeShort: string | null;
	rounded: 'exact' | 'up' | 'down' | 'special';
	/** Beyond the largest finite value: what happened to it. */
	overflow: null | 'infinity' | 'saturated' | 'nan';
	/** Nonzero but too small, so it became zero. */
	underflowed: boolean;
	/** The guard/round/sticky working, for finite nonzero input that is not absurdly large or small. */
	steps: RoundingSteps | null;
};

const signBitValue = (f: MiniFormat) => 2 ** (f.bits - 1);

/** The canonical NaN: for IEEE formats a quiet NaN (top mantissa bit set); for E4M3 the only one there is. */
export function nanCode(id: FormatId): number | null {
	const f = FORMATS[id];
	if (f.specials === 'none') return null;
	const top = maxBiasedField(f) * 2 ** f.mantissaBits;
	return f.specials === 'fn' ? top + 2 ** f.mantissaBits - 1 : top + 2 ** (f.mantissaBits - 1);
}

/** What an out-of-range magnitude becomes, given the format and the chosen mode. */
function overflowCode(f: MiniFormat, mode: OverflowMode): { code: number; overflow: 'infinity' | 'saturated' | 'nan' } {
	const top = maxBiasedField(f) * 2 ** f.mantissaBits;
	if (f.specials === 'ieee') return { code: top, overflow: 'infinity' };
	if (f.specials === 'fn' && mode === 'nan') return { code: top + 2 ** f.mantissaBits - 1, overflow: 'nan' };
	return { code: maxFiniteCode(f), overflow: 'saturated' };
}

/**
 * Rounds a positive rational to the nearest code, ties to even, as if the
 * exponent could grow without limit; then anything above the largest finite
 * value counts as overflow. That is IEEE 754's definition, and for E4M3 it
 * puts the overflow threshold at 464, halfway between 448 and the 480 the NaN
 * code would have been.
 */
function roundMagnitude(v: Rational, f: MiniFormat): { code: number; overflowed: boolean } {
	const steps = roundingSteps(v, f.id);
	let m = steps.kept + (steps.roundUp ? 1n : 0n);
	let lsb = steps.lsb;
	if (m === pow2(f.mantissaBits + 1)) {
		m >>= 1n;
		lsb += 1;
	}
	if (m < pow2(f.mantissaBits)) return { code: Number(m), overflowed: false }; // subnormal or zero
	const biased = lsb + f.mantissaBits + f.bias;
	const code = biased * 2 ** f.mantissaBits + Number(m - pow2(f.mantissaBits));
	if (biased > maxBiasedField(f) || code > maxFiniteCode(f)) return { code: -1, overflowed: true };
	return { code, overflowed: false };
}

/** An error short enough to read: exact when that is short, otherwise to 4 figures. */
function errorText(e: Rational): string {
	const exact = exactDecimal(e.num, e.den);
	return exact.length <= 12 ? exact : shortDecimal(e.num, e.den, 4);
}

const sub = (a: Rational, b: Rational): Rational => ({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
const abs = (a: Rational): Rational => ({ num: a.num < 0n ? -a.num : a.num, den: a.den });

/** Decimal text to the nearest value of a format, with how it was rounded. */
export function encode(text: string, id: FormatId, mode: OverflowMode = 'saturate'): Encoding {
	return encodeParsed(parseDecimal(text), id, mode);
}

/** The code a decimal is stored as; for the page's fixed examples, which always have one. */
export function stored(text: string, id: FormatId, mode: OverflowMode = 'saturate'): Decoded {
	const e = encode(text, id, mode);
	if (!e.result) throw new MiniFloatError(e.note);
	return e.result;
}

export function encodeParsed(p: Parsed, id: FormatId, mode: OverflowMode = 'saturate'): Encoding {
	const f = FORMATS[id];
	const signBit = p.negative ? signBitValue(f) : 0;
	const base = {
		format: id,
		input: p.normalised,
		note: '',
		error: null,
		errorShort: null,
		relativeShort: null,
		underflowed: false,
		steps: null
	};
	if (p.kind === 'nan') {
		const nan = nanCode(id);
		if (nan === null)
			return { ...base, result: null, note: `${f.name} has no NaN`, rounded: 'special', overflow: null };
		return { ...base, result: decode(nan + signBit, id), rounded: 'special', overflow: null };
	}
	if (p.kind === 'infinity') {
		const o = overflowCode(f, mode);
		return { ...base, result: decode(o.code + signBit, id), rounded: 'special', overflow: o.overflow };
	}
	const { value, beyond } = p;
	if (beyond === 'huge') {
		const o = overflowCode(f, mode);
		// Clamped to the largest value, the error is that minus a number above
		// 10^400: to four figures, minus the number itself, and 100% of it. The
		// exact error would need the whole power of ten, which is the point of
		// not building it.
		const saturated = o.overflow === 'saturated';
		// The leading digits as d.ddd, from a value in [1, 10); rounding 9.9996 up gives 10, one order higher.
		const lead = shortDecimal(value.num, 10n ** BigInt(value.num.toString().length - 1), 4);
		const order = (p.order ?? 0) + (lead === '10' ? 1 : 0);
		const errorShort = saturated ? `${p.negative ? '' : '-'}${lead === '10' ? '1' : lead}e${order}` : null;
		return {
			...base,
			result: decode(o.code + signBit, id),
			errorShort,
			relativeShort: saturated ? '1' : null,
			rounded: o.overflow === 'nan' ? 'special' : p.negative === saturated ? 'up' : 'down',
			overflow: o.overflow
		};
	}
	const inputSigned: Rational = { num: p.negative ? -value.num : value.num, den: value.den };
	if (beyond === 'tiny') {
		// Stored as zero, so the error is exactly minus the number typed, and the relative error is 100%.
		const error = p.negative ? p.normalised.slice(1) : `-${p.normalised}`;
		return {
			...base,
			result: decode(signBit, id),
			error,
			errorShort: error,
			relativeShort: '1',
			rounded: p.negative ? 'up' : 'down',
			overflow: null,
			underflowed: true
		};
	}
	if (value.num === 0n) {
		return { ...base, result: decode(signBit, id), error: '0', errorShort: '0', rounded: 'exact', overflow: null };
	}
	const steps = roundingSteps(value, id, p.negative);
	const { code, overflowed } = roundMagnitude(value, f);
	if (overflowed) {
		const o = overflowCode(f, mode);
		const result = decode(o.code + signBit, id);
		const saturatedError = result.value ? sub(result.value, inputSigned) : null;
		return {
			...base,
			result,
			error: saturatedError ? exactDecimal(saturatedError.num, saturatedError.den) : null,
			errorShort: saturatedError ? errorText(saturatedError) : null,
			relativeShort: saturatedError
				? shortDecimal(abs(saturatedError).num * value.den, abs(saturatedError).den * value.num, 4)
				: null,
			rounded: o.overflow === 'nan' ? 'special' : p.negative === (o.overflow === 'saturated') ? 'up' : 'down',
			overflow: o.overflow,
			steps
		};
	}
	const result = decode(code + signBit, id);
	// A finite code always has a value; the fallback only satisfies the type checker.
	const err = sub(result.value ?? { num: 0n, den: 1n }, inputSigned);
	const absErr = abs(err);
	return {
		...base,
		result,
		error: exactDecimal(err.num, err.den),
		errorShort: errorText(err),
		relativeShort: shortDecimal(absErr.num * value.den, absErr.den * value.num, 4),
		rounded: err.num === 0n ? 'exact' : err.num > 0n ? 'up' : 'down',
		overflow: null,
		underflowed: result.kind === 'zero',
		steps
	};
}

/**
 * The value a decoded code stands for, as the input of another format. NaN and
 * infinities carry over as themselves; −0 stays −0.
 */
export function asParsed(d: Decoded): Parsed {
	if (d.kind === 'nan') return { kind: 'nan', negative: d.sign === 1, normalised: 'NaN' };
	if (d.kind === 'infinity') return { kind: 'infinity', negative: d.sign === 1, normalised: d.exact };
	const v = d.value ?? { num: 0n, den: 1n };
	return {
		kind: 'number',
		negative: d.sign === 1,
		value: { num: v.num < 0n ? -v.num : v.num, den: v.den },
		normalised: d.exact
	};
}

// --- Bit patterns ----------------------------------------------------------

/**
 * Reads a code typed as hex (0x3C00) or binary. Shorter input is padded on the
 * left with zeros; longer input is an error.
 */
export function parseCode(text: string, id: FormatId, base: 'hex' | 'binary'): number {
	const f = FORMATS[id];
	let s = text.trim().replace(/[\s_.]/g, '');
	s = base === 'hex' ? s.replace(/^0x/i, '') : s.replace(/^0b/i, '');
	if (!s) throw new MiniFloatError('Type a bit pattern first');
	const valid = base === 'hex' ? /^[0-9a-f]$/i : /^[01]$/;
	const bad = [...s].find((ch) => !valid.test(ch));
	if (bad !== undefined)
		throw new MiniFloatError(
			`"${bad}" is not a ${base === 'hex' ? 'hex digit: use 0 to 9 and A to F' : 'bit: use 0 and 1'}`
		);
	const value = parseInt(s, base === 'hex' ? 16 : 2);
	const digits = base === 'hex' ? Math.ceil(f.bits / 4) : f.bits;
	if (s.replace(/^0+(?=.)/, '').length > digits || value >= 2 ** f.bits)
		throw new MiniFloatError(
			base === 'hex'
				? `${f.name} is ${f.bits} bits, so the largest code is ${hexOf(2 ** f.bits - 1, f.bits)}`
				: `${f.name} is ${f.bits} bits; that is ${s.length}`
		);
	return value;
}

// --- Neighbours ------------------------------------------------------------

/**
 * The next representable values below and above a finite value, or null past
 * the largest finite value. Codes are sign and magnitude, so moving up through
 * the negatives means stepping the magnitude down.
 */
export function neighbours(d: Decoded): { below: Decoded | null; above: Decoded | null } {
	if (d.kind === 'nan' || d.kind === 'infinity') return { below: null, above: null };
	const f = FORMATS[d.format];
	const s = signBitValue(f);
	const mag = d.code % s;
	const max = maxFiniteCode(f);
	const larger = mag < max ? mag + 1 : null;
	if (mag === 0) return { below: decode(s + 1, d.format), above: decode(1, d.format) };
	const smaller = mag - 1;
	if (d.sign === 0)
		return { below: decode(smaller, d.format), above: larger === null ? null : decode(larger, d.format) };
	return {
		below: larger === null ? null : decode(s + larger, d.format),
		above: decode(smaller === 0 ? 0 : s + smaller, d.format)
	};
}

// --- Reference figures -----------------------------------------------------

export type FormatFacts = {
	format: MiniFormat;
	max: Decoded;
	minNormal: Decoded;
	minSubnormal: Decoded;
	/** The gap between 1 and the next value up: 2^−mantissaBits. */
	epsilon: Rational;
	epsilonPower: number;
	/** Significand bits including the hidden one, times log10(2). */
	decimalDigits: number;
	infinities: boolean;
	nanCount: number;
	/** How many codes are finite numbers (both zeros included). */
	finiteCount: number;
};

export function facts(id: FormatId): FormatFacts {
	const f = FORMATS[id];
	const perSign = 2 ** (f.bits - 1);
	const nanPerSign = f.specials === 'ieee' ? 2 ** f.mantissaBits - 1 : f.specials === 'fn' ? 1 : 0;
	const infPerSign = f.specials === 'ieee' ? 1 : 0;
	return {
		format: f,
		max: decode(maxFiniteCode(f), id),
		minNormal: decode(2 ** f.mantissaBits, id),
		minSubnormal: decode(1, id),
		epsilon: twoTo(-f.mantissaBits),
		epsilonPower: -f.mantissaBits,
		decimalDigits: (f.mantissaBits + 1) * Math.log10(2),
		infinities: f.specials === 'ieee',
		nanCount: 2 * nanPerSign,
		finiteCount: 2 * (perSign - nanPerSign - infPerSign)
	};
}

/** Every code of a format, in code order. Only sensible for 16 bits or fewer. */
export function allCodes(id: FormatId): Decoded[] {
	const f = FORMATS[id];
	if (f.bits > 16) throw new MiniFloatError('Too many codes to list');
	return Array.from({ length: 2 ** f.bits }, (_, c) => decode(c, id));
}

// --- Display helpers -------------------------------------------------------

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 2⁻¹⁴ style. */
export const powerOfTwo = (k: number) =>
	'2' +
	String(k)
		.split('')
		.map((ch) => (ch === '-' ? '⁻' : SUPERSCRIPT[Number(ch)]))
		.join('');

/** The minus sign people expect to read rather than a hyphen. */
export const minus = (s: string) => s.replace(/^-/, '−').replace(/e-/, 'e−');

/** A value short enough for a table cell: exact when that is short, otherwise to 5 figures. */
export function shortValue(d: Decoded, maxLength = 12): string {
	if (!d.value || d.exact.length <= maxLength) return d.exact;
	return shortDecimal(d.value.num, d.value.den, 5);
}

/**
 * Short forms of several values that still tell them apart: neighbours of an
 * FP32 value agree to seven or eight figures, so five would print the same
 * number three times.
 */
export function distinctShort(values: Decoded[], minDigits = 5): string[] {
	const finite = values.filter((d) => d.value);
	for (let digits = minDigits; digits <= 40; digits++) {
		const texts = values.map((d) =>
			!d.value || d.kind === 'zero' || d.exact.length <= digits + 2
				? d.exact
				: shortDecimal(d.value.num, d.value.den, digits)
		);
		const seen = new Set(texts.filter((_, i) => values[i].value));
		if (seen.size === new Set(finite.map((d) => d.exact)).size) return texts;
	}
	return values.map((d) => d.exact);
}

/** Exact power-of-two exponent of a value that is a power of two, or null. */
export function exactPower(d: Decoded): number | null {
	if (!d.value || d.value.num === 0n) return null;
	const n = d.value.num < 0n ? -d.value.num : d.value.num;
	const isPow = (x: bigint) => (x & (x - 1n)) === 0n;
	if (!isPow(n) || !isPow(d.value.den)) return null;
	return bitLength(n) - bitLength(d.value.den);
}

// --- Block scaling (MXFP4) -------------------------------------------------

/**
 * OCP microscaling: a block of values shares one 8-bit scale, an E8M0 power
 * of two, and each value is stored as FP4 E2M1 after dividing by it. The MX
 * specification picks the scale exponent as floor(log2(largest magnitude))
 * minus the element format's largest exponent (2 for E2M1, whose largest
 * value is 6 = 1.5 × 2²), and elements that still land above 6 are clamped.
 */
export function mxBlock(values: string[]) {
	const f = FORMATS.e2m1;
	const emaxElem = maxBiasedField(f) - f.bias;
	const parsed = values.map((v) => {
		const p = parseDecimal(v);
		if (p.kind !== 'number' || p.beyond) throw new MiniFloatError('Block values must be ordinary numbers');
		return { text: v, p };
	});
	let amax: Rational = { num: 0n, den: 1n };
	for (const { p } of parsed) {
		if (p.kind !== 'number') continue;
		if (p.value.num * amax.den > amax.num * p.value.den) amax = p.value;
	}
	const scaleExp = amax.num === 0n ? -127 : floorLog2(amax) - emaxElem;
	const elements = parsed.map(({ text, p }) => {
		if (p.kind !== 'number') throw new MiniFloatError('unreachable');
		const scaled: Parsed = {
			kind: 'number',
			negative: p.negative,
			value:
				scaleExp >= 0
					? { num: p.value.num, den: p.value.den * pow2(scaleExp) }
					: { num: p.value.num * pow2(-scaleExp), den: p.value.den },
			normalised: text
		};
		const enc = encodeParsed(scaled, 'e2m1', 'saturate');
		const d = enc.result;
		if (!d) throw new MiniFloatError('FP4 holds every finite value after clamping');
		const back = d.value ? { num: d.value.num * twoTo(scaleExp).num, den: d.value.den * twoTo(scaleExp).den } : null;
		return {
			input: text,
			scaled: exactDecimal(p.negative ? -scaled.value.num : scaled.value.num, scaled.value.den),
			code: d,
			saturated: enc.overflow === 'saturated',
			restored: back ? (d.kind === 'zero' ? (d.sign ? '-0' : '0') : exactDecimal(back.num, back.den)) : 'NaN'
		};
	});
	return { scaleExp, scaleCode: scaleExp + 127, emaxElem, elements };
}
