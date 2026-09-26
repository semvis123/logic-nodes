// IEEE 754 binary floating point, single (32 bit) and double (64 bit).
//
// Decimal input is rounded to the nearest float exactly, with BigInt rational
// arithmetic rather than by going through a JavaScript number, so a float32
// never suffers the double rounding of decimal → double → float. The stored
// value is then written out in full as a decimal, which is always possible
// because every finite float is a whole number times a power of two, and the
// rounding error is the exact difference between the two. The tests check
// every field against DataView and the typed arrays.

export type Format = 'single' | 'double';

export const formats: Record<
	Format,
	{ bits: number; exponentBits: number; fractionBits: number; bias: number; name: string; ctype: string }
> = {
	single: { bits: 32, exponentBits: 8, fractionBits: 23, bias: 127, name: 'Single precision (32 bit)', ctype: 'float' },
	double: {
		bits: 64,
		exponentBits: 11,
		fractionBits: 52,
		bias: 1023,
		name: 'Double precision (64 bit)',
		ctype: 'double'
	}
};

export class FloatError extends Error {}

export type Kind = 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan';

export type FloatFields = {
	format: Format;
	/** Every bit, most significant first. */
	bits: string;
	hex: string;
	sign: 0 | 1;
	exponentBits: string;
	fractionBits: string;
	/** The exponent field read as an unsigned number. */
	biased: number;
	/** The power of two it stands for: biased − bias, or 1 − bias for subnormals. Null for Inf and NaN. */
	exponent: number | null;
	kind: Kind;
	/** The value as a JavaScript number (a float32 widens exactly into it). */
	value: number;
	/** The exact stored value, in full, as a decimal. */
	exact: string;
	/** The significand in binary: 1.fraction for normals, 0.fraction for subnormals. */
	significand: string;
	/** The shortest decimal that reads back as this same float. */
	shortest: string;
	/** The gap to the next float away from zero, exactly, for finite values. */
	gap: string | null;
	/** For NaN: whether the top fraction bit (quiet bit) is set. */
	quiet?: boolean;
};

export type Encoding = FloatFields & {
	/** The decimal that was typed, normalised. */
	input: string;
	/** stored − input, exactly, as a decimal. '0' when the input was stored exactly. */
	error: string;
	/** The same error to a few significant figures, in scientific notation. */
	errorShort: string;
	/** Which way the typed value was rounded. */
	rounded: 'exact' | 'up' | 'down';
	/** Too large for the format, so it became infinity. */
	overflowed: boolean;
	/** Nonzero but too small, so it became zero. */
	underflowed: boolean;
};

const pow2 = (n: number) => 1n << BigInt(n);
const bitLength = (n: bigint) => (n === 0n ? 0 : n.toString(2).length);

// --- Exact rationals --------------------------------------------------------

type Rational = { num: bigint; den: bigint };

/** Beyond 10 to this power either way, a decimal is out of range for every format here. */
const MAX_DECIMAL_ORDER = 400;

/** Parses a decimal such as -1.25e-3 into an exact fraction and a sign. */
function parseDecimal(text: string): {
	negative: boolean;
	value: Rational;
	normalised: string;
	/** Far outside any float's range: 'huge' becomes infinity and 'tiny' zero, without the arithmetic. */
	beyond?: 'huge' | 'tiny';
} {
	const s = text.trim().replace(/[\s_]/g, '').replace(/^\+/, '').replace(/−/g, '-');
	const m = s.match(/^(-)?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
	if (!m || (!m[2] && !m[3])) throw new FloatError(`"${text.trim()}" is not a decimal number`);
	const negative = !!m[1];
	const whole = m[2] || '';
	const frac = m[3] || '';
	const exp = m[4] ? Number(m[4]) : 0;
	if (whole.length + frac.length > 1200) throw new FloatError('That number is too long to convert');
	const significant = (whole + frac).replace(/^0+(?=.)/, '') || '0';
	const digits = BigInt(significant);
	const e10 = exp - frac.length;
	// The power of ten of the leading digit. A double's range is about 10^-324 to
	// 10^308, so anything beyond 10^±400 rounds to zero or infinity whatever its
	// digits, and is settled here rather than with a huge exact fraction.
	const order = significant.length - 1 + e10;
	if (digits !== 0n && Math.abs(order) > MAX_DECIMAL_ORDER) {
		return {
			negative,
			value: { num: digits, den: 1n },
			normalised: s.toLowerCase(),
			beyond: order > 0 ? 'huge' : 'tiny'
		};
	}
	const value = e10 >= 0 ? { num: digits * 10n ** BigInt(e10), den: 1n } : { num: digits, den: 10n ** BigInt(-e10) };
	return { negative, value, normalised: s.toLowerCase() };
}

/**
 * Writes num/den as a decimal in full. Only terminating fractions are allowed,
 * which covers everything here: floats are dyadic and typed input is decimal.
 */
export function exactDecimal(num: bigint, den: bigint): string {
	const negative = num < 0n !== den < 0n && num !== 0n;
	let n = num < 0n ? -num : num;
	let d = den < 0n ? -den : den;
	let twos = 0;
	let fives = 0;
	while (d % 2n === 0n) (d /= 2n), twos++;
	while (d % 5n === 0n) (d /= 5n), fives++;
	if (d !== 1n) throw new Error('Not a terminating decimal');
	const k = Math.max(twos, fives);
	n = n * 2n ** BigInt(k - twos) * 5n ** BigInt(k - fives);
	let text = n.toString();
	if (k > 0) {
		text = text.padStart(k + 1, '0');
		text = `${text.slice(0, -k)}.${text.slice(-k)}`.replace(/\.?0+$/, '');
	}
	return (negative ? '-' : '') + text;
}

/** num/den to `digits` significant figures, as 1.2345e-17 (or plain for moderate sizes). */
export function shortDecimal(num: bigint, den: bigint, digits = 6): string {
	if (num === 0n) return '0';
	const negative = num < 0n !== den < 0n;
	const n = num < 0n ? -num : num;
	const d = den < 0n ? -den : den;
	// Find e with 10^e <= n/d < 10^(e+1).
	let e = n.toString().length - d.toString().length;
	const ge = (e: number) => (e >= 0 ? n >= d * 10n ** BigInt(e) : n * 10n ** BigInt(-e) >= d);
	while (!ge(e)) e--;
	while (ge(e + 1)) e++;
	// Scale to an integer with `digits` figures, rounding half up.
	const shift = digits - 1 - e;
	const scaled =
		shift >= 0
			? (n * 10n ** BigInt(shift) * 2n + d) / (2n * d)
			: (n * 2n + d * 10n ** BigInt(-shift)) / (2n * d * 10n ** BigInt(-shift));
	let mant = scaled.toString();
	if (mant.length > digits) {
		mant = mant.slice(0, digits);
		e++;
	}
	const trimmed = mant.replace(/0+$/, '') || '0';
	const sign = negative ? '-' : '';
	if (e >= -4 && e < 15) {
		// Plain notation reads better for ordinary sizes. value = trimmed × 10^scale.
		const scale = e - (trimmed.length - 1);
		const plain = scale >= 0 ? trimmed + '0'.repeat(scale) : exactDecimal(BigInt(trimmed), 10n ** BigInt(-scale));
		return sign + plain;
	}
	const body = trimmed.length > 1 ? `${trimmed[0]}.${trimmed.slice(1)}` : trimmed;
	return `${sign}${body}e${e}`;
}

// --- Fields -----------------------------------------------------------------

/** Reads a bit pattern (as a BigInt) as a float of the given format. */
export function decode(pattern: bigint, format: Format): FloatFields {
	const f = formats[format];
	const bits = pattern.toString(2).padStart(f.bits, '0');
	if (bits.length !== f.bits) throw new FloatError(`That is more than ${f.bits} bits`);
	const sign = bits[0] === '1' ? 1 : 0;
	const exponentBits = bits.slice(1, 1 + f.exponentBits);
	const fractionBits = bits.slice(1 + f.exponentBits);
	const biased = parseInt(exponentBits, 2);
	const fraction = BigInt('0b' + fractionBits);
	const maxBiased = 2 ** f.exponentBits - 1;
	const emin = 1 - f.bias;

	let kind: Kind;
	let exponent: number | null;
	let mantissa = 0n;
	if (biased === maxBiased) {
		kind = fraction === 0n ? 'infinity' : 'nan';
		exponent = null;
	} else if (biased === 0) {
		kind = fraction === 0n ? 'zero' : 'subnormal';
		exponent = emin;
		mantissa = fraction;
	} else {
		kind = 'normal';
		exponent = biased - f.bias;
		mantissa = pow2(f.fractionBits) + fraction;
	}

	// value = mantissa × 2^(exponent − fractionBits)
	const view = new DataView(new ArrayBuffer(8));
	if (format === 'single') view.setUint32(0, Number(pattern));
	else view.setBigUint64(0, pattern);
	const value = format === 'single' ? view.getFloat32(0) : view.getFloat64(0);

	let exact: string;
	let gap: string | null = null;
	if (kind === 'infinity') exact = sign ? '-Infinity' : 'Infinity';
	else if (kind === 'nan') exact = 'NaN';
	else {
		const k = exponent! - f.fractionBits;
		const signed = sign ? -mantissa : mantissa;
		exact = k >= 0 ? (signed * pow2(k)).toString() : exactDecimal(signed, pow2(-k));
		if (kind === 'zero' && sign) exact = '-0';
		gap = k >= 0 ? pow2(k).toString() : exactDecimal(1n, pow2(-k));
	}

	const significand =
		kind === 'normal' ? `1.${fractionBits}` : kind === 'subnormal' || kind === 'zero' ? `0.${fractionBits}` : '';
	const hex = pattern
		.toString(16)
		.toUpperCase()
		.padStart(f.bits / 4, '0');
	return {
		format,
		bits,
		hex,
		sign,
		exponentBits,
		fractionBits,
		biased,
		exponent,
		kind,
		value,
		exact,
		significand,
		shortest: shortestDecimal(value, format),
		gap,
		quiet: kind === 'nan' ? fractionBits[0] === '1' : undefined
	};
}

/** The shortest decimal that reads back as the same float, the way languages print floats. */
export function shortestDecimal(value: number, format: Format): string {
	if (Number.isNaN(value)) return 'NaN';
	if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
	if (Object.is(value, -0)) return '-0';
	if (format === 'double') return String(value);
	for (let p = 1; p <= 9; p++) {
		const s = value.toPrecision(p);
		if (Math.fround(Number(s)) === value) return String(Number(s));
	}
	return String(value);
}

/**
 * Rounds a positive rational to the nearest float, ties to even, and returns
 * the bit pattern without its sign. Values too large become infinity.
 */
function roundToFloat(v: Rational, format: Format): { pattern: bigint; overflowed: boolean } {
	const f = formats[format];
	const p = f.fractionBits + 1;
	const emin = 1 - f.bias;
	const emax = f.bias;
	const infinity = BigInt(2 ** f.exponentBits - 1) << BigInt(f.fractionBits);
	// e with 2^e <= v < 2^(e+1).
	let e = bitLength(v.num) - bitLength(v.den);
	const atLeast = (e: number) => (e >= 0 ? v.num >= v.den * pow2(e) : v.num * pow2(-e) >= v.den);
	while (!atLeast(e)) e--;
	while (atLeast(e + 1)) e++;
	if (e > emax + 1) return { pattern: infinity, overflowed: true };
	// Below the normal range the step between floats stops shrinking.
	const scaleExp = Math.max(e, emin) - (p - 1);
	// m = v / 2^scaleExp, rounded to nearest, ties to even.
	let N = v.num;
	let D = v.den;
	if (scaleExp >= 0) D *= pow2(scaleExp);
	else N *= pow2(-scaleExp);
	let m = N / D;
	const rem2 = (N % D) * 2n;
	if (rem2 > D || (rem2 === D && m % 2n === 1n)) m += 1n;
	let exp = scaleExp + (p - 1);
	if (m === pow2(p)) {
		m >>= 1n;
		exp += 1;
	}
	if (m < pow2(p - 1)) {
		// Subnormal (or zero): exponent field 0, the fraction is m itself.
		return { pattern: m, overflowed: false };
	}
	if (exp > emax) return { pattern: infinity, overflowed: true };
	const biased = BigInt(exp + f.bias);
	return { pattern: (biased << BigInt(f.fractionBits)) | (m - pow2(p - 1)), overflowed: false };
}

/** The exact value of a finite pattern as a rational, sign included. */
function patternValue(fields: FloatFields): Rational {
	const f = formats[fields.format];
	const fraction = BigInt('0b' + fields.fractionBits);
	const mantissa = fields.kind === 'normal' ? pow2(f.fractionBits) + fraction : fraction;
	const k = (fields.exponent ?? 0) - f.fractionBits;
	const signed = fields.sign ? -mantissa : mantissa;
	return k >= 0 ? { num: signed * pow2(k), den: 1n } : { num: signed, den: pow2(-k) };
}

/** Decimal text to the nearest float, with the rounding it took. */
export function encode(text: string, format: Format): Encoding {
	const f = formats[format];
	const t = text.trim().toLowerCase().replace(/−/g, '-').replace(/\s/g, '');
	if (!t) throw new FloatError('Type a number first');
	const special = t.match(/^([+-]?)(inf|infinity|∞|nan)$/);
	if (special) {
		const negative = special[1] === '-';
		const expAll = BigInt(2 ** f.exponentBits - 1) << BigInt(f.fractionBits);
		const isNan = special[2] === 'nan';
		// The canonical quiet NaN: top fraction bit set.
		let pattern = isNan ? expAll | pow2(f.fractionBits - 1) : expAll;
		if (negative) pattern |= pow2(f.bits - 1);
		return {
			...decode(pattern, format),
			input: isNan ? 'NaN' : negative ? '-Infinity' : 'Infinity',
			error: '0',
			errorShort: '0',
			rounded: 'exact',
			overflowed: false,
			underflowed: false
		};
	}
	const { negative, value, normalised, beyond } = parseDecimal(t);
	const signBit = negative ? pow2(f.bits - 1) : 0n;
	if (beyond === 'huge') {
		const infinity = BigInt(2 ** f.exponentBits - 1) << BigInt(f.fractionBits);
		return {
			...decode(infinity | signBit, format),
			input: normalised,
			error: 'Infinity',
			errorShort: 'Infinity',
			rounded: negative ? 'down' : 'up',
			overflowed: true,
			underflowed: false
		};
	}
	if (beyond === 'tiny') {
		// Stored as zero, so the error is exactly minus the number typed.
		const error = negative ? normalised.slice(1) : `-${normalised}`;
		return {
			...decode(signBit, format),
			input: normalised,
			error,
			errorShort: error,
			rounded: negative ? 'up' : 'down',
			overflowed: false,
			underflowed: true
		};
	}
	if (value.num === 0n) {
		return {
			...decode(signBit, format),
			input: normalised,
			error: '0',
			errorShort: '0',
			rounded: 'exact',
			overflowed: false,
			underflowed: false
		};
	}
	const { pattern, overflowed } = roundToFloat(value, format);
	const fields = decode(pattern | signBit, format);
	const inputExact = exactDecimal(negative ? -value.num : value.num, value.den);
	if (overflowed) {
		return {
			...fields,
			input: inputExact,
			error: 'Infinity',
			errorShort: 'Infinity',
			rounded: negative ? 'down' : 'up',
			overflowed,
			underflowed: false
		};
	}
	const stored = patternValue(fields);
	const inputSigned = { num: negative ? -value.num : value.num, den: value.den };
	const errNum = stored.num * inputSigned.den - inputSigned.num * stored.den;
	const errDen = stored.den * inputSigned.den;
	return {
		...fields,
		input: inputExact,
		error: exactDecimal(errNum, errDen),
		errorShort: shortDecimal(errNum, errDen, 4),
		rounded: errNum === 0n ? 'exact' : errNum > 0n ? 'up' : 'down',
		overflowed: false,
		underflowed: fields.kind === 'zero'
	};
}

/**
 * Reads a bit pattern typed as hex (0x3F800000) or binary. Shorter input is
 * padded on the left with zeros; longer input is an error.
 */
export function parsePattern(text: string, format: Format, base: 'hex' | 'binary'): bigint {
	const f = formats[format];
	let s = text.trim().replace(/[\s_]/g, '');
	if (base === 'hex') s = s.replace(/^0x/i, '');
	else s = s.replace(/^0b/i, '');
	if (!s) throw new FloatError('Type a bit pattern first');
	const valid = base === 'hex' ? /^[0-9a-f]+$/i : /^[01]+$/;
	if (!valid.test(s)) {
		const bad = [...s].find((ch) => !valid.test(ch));
		throw new FloatError(
			`"${bad}" is not a ${base === 'hex' ? 'hex digit: use 0 to 9 and A to F' : 'bit: use 0 and 1'}`
		);
	}
	const limit = base === 'hex' ? f.bits / 4 : f.bits;
	if (s.length > limit)
		throw new FloatError(
			`A ${f.bits} bit float is ${limit} ${base === 'hex' ? 'hex digits' : 'bits'}; that is ${s.length}`
		);
	return BigInt((base === 'hex' ? '0x' : '0b') + s);
}

/** The bit pattern of a JavaScript number in the given format, via the typed arrays. */
export function patternOf(value: number, format: Format): bigint {
	const view = new DataView(new ArrayBuffer(8));
	if (format === 'single') {
		view.setFloat32(0, value);
		return BigInt(view.getUint32(0));
	}
	view.setFloat64(0, value);
	return view.getBigUint64(0);
}

/** The largest finite value, the smallest normal and the smallest subnormal, for the reference table. */
export function limits(format: Format) {
	const f = formats[format];
	const maxBiased = BigInt(2 ** f.exponentBits - 2);
	const allFraction = pow2(f.fractionBits) - 1n;
	return {
		max: decode((maxBiased << BigInt(f.fractionBits)) | allFraction, format),
		minNormal: decode(1n << BigInt(f.fractionBits), format),
		minSubnormal: decode(1n, format),
		one: decode(BigInt(f.bias) << BigInt(f.fractionBits), format),
		epsilon: decode(BigInt(f.bias - f.fractionBits) << BigInt(f.fractionBits), format)
	};
}
