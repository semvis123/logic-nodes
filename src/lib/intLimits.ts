// The fixed-width integer types, their limits, their names across languages,
// and what happens when arithmetic runs past either end.
//
// Every limit is computed here with BigInt from the width and signedness, never
// typed in, and the integer limits pages render only what this file returns, so
// a page cannot print a maximum that disagrees with its own formula. Dates
// derived from the limits (the Year 2038 problem and friends) are computed too.

import { groupDecimal, superscript } from './radix.js';

export const intSlugs = [
	'int8',
	'uint8',
	'int16',
	'uint16',
	'int32',
	'uint32',
	'int64',
	'uint64',
	'int128',
	'uint128'
] as const;
export type IntSlug = typeof intSlugs[number];

export type Width = 8 | 16 | 32 | 64 | 128;

export type IntType = {
	slug: IntSlug;
	bits: Width;
	signed: boolean;
	min: bigint;
	max: bigint;
	/** How many distinct values the type has: always 2 to the power of its width. */
	count: bigint;
};

export class IntLimitsError extends Error {}

function makeType(slug: IntSlug): IntType {
	const signed = !slug.startsWith('u');
	const bits = Number(slug.replace(/^u?int/, '')) as Width;
	const n = BigInt(bits);
	// Two's complement gives half the patterns (those with the top bit set) to
	// the negatives, so the signed range is lopsided by one: zero sits on the
	// non-negative side.
	const min = signed ? -(1n << (n - 1n)) : 0n;
	const max = signed ? (1n << (n - 1n)) - 1n : (1n << n) - 1n;
	return { slug, bits, signed, min, max, count: 1n << n };
}

export const intTypes: IntType[] = intSlugs.map(makeType);

export const intTypeBySlug = (slug: string): IntType | undefined => intTypes.find((t) => t.slug === slug);

/** "32-bit signed integer". */
export const describeType = (t: IntType) => `${t.bits}-bit ${t.signed ? 'signed' : 'unsigned'} integer`;

/** The other type of the same width: int32 for uint32 and the other way round. */
export const twinOf = (t: IntType): IntType =>
	intTypes.find((o) => o.bits === t.bits && o.signed !== t.signed) as IntType;

/** A BigInt in decimal with thousands separators and a typographic minus sign. */
export const formatDecimal = (n: bigint): string => (n < 0n ? '−' : '') + groupDecimal((n < 0n ? -n : n).toString());

/** The width's bit pattern for a value already in range: two's complement for negatives. */
export const patternOf = (n: bigint, bits: number): bigint => BigInt.asUintN(bits, n);

/** The bit pattern as a string of exactly `bits` binary digits. */
export const binaryOf = (n: bigint, bits: number): string => patternOf(n, bits).toString(2).padStart(bits, '0');

/** The bit pattern as hex with a 0x prefix, padded to the full width. */
export const hexOf = (n: bigint, bits: number): string =>
	'0x' +
	patternOf(n, bits)
		.toString(16)
		.toUpperCase()
		.padStart(bits / 4, '0');

/** Binary digits in groups of four, for reading. */
export const nibbles = (binary: string): string => binary.replace(/(.{4})(?=.)/g, '$1 ');

/** The limits as powers of two: −2³¹ and 2³¹ − 1, or 0 and 2³² − 1. */
export function formulas(t: IntType): { min: string; max: string; count: string } {
	const top = t.signed ? t.bits - 1 : t.bits;
	return {
		min: t.signed ? `−2${superscript(t.bits - 1)}` : '0',
		max: `2${superscript(top)} − 1`,
		count: `2${superscript(t.bits)}`
	};
}

/** How many decimal digits a number has, without its sign. */
export const digitCount = (n: bigint): number => (n < 0n ? -n : n).toString().length;

/**
 * A positive number to three significant figures in scientific notation, such
 * as 1.70 × 10³⁸, for where all 39 digits would not fit. Rounded with BigInt
 * from the exact digits, so it does not depend on a double's precision.
 */
export function scientific(n: bigint): string {
	const digits = n.toString();
	if (n < 1000n) return digits;
	let exponent = digits.length - 1;
	// Round half up to three significant figures; 9.995e38 rounds up to 1.00e39.
	let mantissa = (BigInt(digits.slice(0, 4)) + 5n) / 10n;
	if (mantissa >= 1000n) {
		mantissa /= 10n;
		exponent += 1;
	}
	const m = mantissa.toString();
	return `${m[0]}.${m.slice(1)} × 10${superscript(exponent)}`;
}

// ---------------------------------------------------------------------------
// Names in each language. Only names that exist with exactly this width are
// listed; where a language has nothing, it says so and says what people use.

export type LanguageName = {
	language: string;
	/** The type's name in that language, or null when there is none. */
	type: string | null;
	/** How to spell the limits in code, when the language has constants for them. */
	limits?: string;
	note?: string;
};

type Row = [string | null, string?, string?];

/** Per language, per slug: [type, limits, note]. */
const NAMES: Record<string, Partial<Record<IntSlug, Row>>> = {
	'C and C++': {
		int8: ['int8_t', 'INT8_MIN, INT8_MAX', 'Plain char may be signed or unsigned, depending on the platform.'],
		uint8: ['uint8_t', 'UINT8_MAX'],
		int16: ['int16_t', 'INT16_MIN, INT16_MAX', 'short is at least 16 bits, and exactly 16 on common platforms.'],
		uint16: ['uint16_t', 'UINT16_MAX'],
		int32: [
			'int32_t',
			'INT32_MIN, INT32_MAX',
			'int is 32 bits on common desktop and phone platforms, but the standard only promises 16.'
		],
		uint32: ['uint32_t', 'UINT32_MAX'],
		int64: [
			'int64_t',
			'INT64_MIN, INT64_MAX',
			'long is 64 bits on 64-bit Linux and macOS but 32 bits on Windows; long long is at least 64 everywhere.'
		],
		uint64: ['uint64_t', 'UINT64_MAX', 'size_t is 64 bits on 64-bit platforms.'],
		int128: ['__int128', undefined, 'Not standard: a GCC and Clang extension on 64-bit targets, with no limit macros.'],
		uint128: [
			'unsigned __int128',
			undefined,
			'Not standard: a GCC and Clang extension on 64-bit targets, with no limit macros.'
		]
	},
	Java: {
		int8: ['byte', 'Byte.MIN_VALUE, Byte.MAX_VALUE'],
		uint8: [null, undefined, 'byte is signed; Byte.toUnsignedInt(b) reads one as 0 to 255.'],
		int16: ['short', 'Short.MIN_VALUE, Short.MAX_VALUE'],
		uint16: ['char', 'Character.MAX_VALUE', 'char is an unsigned 16-bit UTF-16 code unit, and does arithmetic.'],
		int32: ['int', 'Integer.MIN_VALUE, Integer.MAX_VALUE'],
		uint32: [null, undefined, 'Use int with Integer.toUnsignedLong, Integer.divideUnsigned and friends.'],
		int64: ['long', 'Long.MIN_VALUE, Long.MAX_VALUE'],
		uint64: [null, undefined, 'Use long with Long.toUnsignedString, Long.compareUnsigned and friends.'],
		int128: [null, undefined, 'Use java.math.BigInteger.'],
		uint128: [null, undefined, 'Use java.math.BigInteger.']
	},
	'C#': {
		int8: ['sbyte', 'sbyte.MinValue, sbyte.MaxValue'],
		uint8: ['byte', 'byte.MaxValue'],
		int16: ['short', 'short.MinValue, short.MaxValue'],
		uint16: ['ushort', 'ushort.MaxValue'],
		int32: ['int', 'int.MinValue, int.MaxValue'],
		uint32: ['uint', 'uint.MaxValue'],
		int64: ['long', 'long.MinValue, long.MaxValue'],
		uint64: ['ulong', 'ulong.MaxValue'],
		int128: ['Int128', 'Int128.MinValue, Int128.MaxValue', '.NET 7 and later.'],
		uint128: ['UInt128', 'UInt128.MaxValue', '.NET 7 and later.']
	},
	Rust: {
		int8: ['i8', 'i8::MIN, i8::MAX'],
		uint8: ['u8', 'u8::MAX'],
		int16: ['i16', 'i16::MIN, i16::MAX'],
		uint16: ['u16', 'u16::MAX'],
		int32: ['i32', 'i32::MIN, i32::MAX'],
		uint32: ['u32', 'u32::MAX'],
		int64: ['i64', 'i64::MIN, i64::MAX', 'isize is the pointer width: 64 bits on 64-bit targets.'],
		uint64: ['u64', 'u64::MAX', 'usize is the pointer width: 64 bits on 64-bit targets.'],
		int128: ['i128', 'i128::MIN, i128::MAX'],
		uint128: ['u128', 'u128::MAX']
	},
	Go: {
		int8: ['int8', 'math.MinInt8, math.MaxInt8'],
		uint8: ['uint8 (alias byte)', 'math.MaxUint8'],
		int16: ['int16', 'math.MinInt16, math.MaxInt16'],
		uint16: ['uint16', 'math.MaxUint16'],
		int32: ['int32 (alias rune)', 'math.MinInt32, math.MaxInt32'],
		uint32: ['uint32', 'math.MaxUint32'],
		int64: ['int64', 'math.MinInt64, math.MaxInt64', 'int is 32 or 64 bits, depending on the platform.'],
		uint64: ['uint64', 'math.MaxUint64', 'uint is 32 or 64 bits, depending on the platform.'],
		int128: [null, undefined, 'Use math/big.'],
		uint128: [null, undefined, 'Use math/big.']
	},
	Swift: {
		int8: ['Int8', 'Int8.min, Int8.max'],
		uint8: ['UInt8', 'UInt8.max'],
		int16: ['Int16', 'Int16.min, Int16.max'],
		uint16: ['UInt16', 'UInt16.max'],
		int32: ['Int32', 'Int32.min, Int32.max'],
		uint32: ['UInt32', 'UInt32.max'],
		int64: ['Int64', 'Int64.min, Int64.max', 'Int is the platform word size: 64 bits on 64-bit platforms.'],
		uint64: ['UInt64', 'UInt64.max'],
		int128: ['Int128', 'Int128.min, Int128.max', 'Swift 6 and later.'],
		uint128: ['UInt128', 'UInt128.max', 'Swift 6 and later.']
	},
	Kotlin: {
		int8: ['Byte', 'Byte.MIN_VALUE, Byte.MAX_VALUE'],
		uint8: ['UByte', 'UByte.MAX_VALUE'],
		int16: ['Short', 'Short.MIN_VALUE, Short.MAX_VALUE'],
		uint16: ['UShort', 'UShort.MAX_VALUE'],
		int32: ['Int', 'Int.MIN_VALUE, Int.MAX_VALUE'],
		uint32: ['UInt', 'UInt.MAX_VALUE'],
		int64: ['Long', 'Long.MIN_VALUE, Long.MAX_VALUE'],
		uint64: ['ULong', 'ULong.MAX_VALUE'],
		int128: [null, undefined, 'Use java.math.BigInteger on the JVM.'],
		uint128: [null, undefined, 'Use java.math.BigInteger on the JVM.']
	},
	MySQL: {
		int8: ['TINYINT'],
		uint8: ['TINYINT UNSIGNED'],
		int16: ['SMALLINT'],
		uint16: ['SMALLINT UNSIGNED'],
		int32: ['INT (or INTEGER)'],
		uint32: ['INT UNSIGNED'],
		int64: ['BIGINT'],
		uint64: ['BIGINT UNSIGNED'],
		int128: [null, undefined, 'Use DECIMAL(39, 0) for whole numbers this big.'],
		uint128: [null, undefined, 'Use DECIMAL(39, 0) for whole numbers this big.']
	},
	PostgreSQL: {
		int8: [null, undefined, 'The smallest integer type is smallint, 16 bits.'],
		uint8: [null, undefined, 'PostgreSQL has no unsigned integer types.'],
		int16: ['smallint (int2)'],
		uint16: [null, undefined, 'PostgreSQL has no unsigned integer types.'],
		int32: ['integer (int4)'],
		uint32: [null, undefined, 'PostgreSQL has no unsigned integer types; bigint holds the whole range.'],
		int64: ['bigint (int8)', undefined, 'The 8 in int8 counts bytes, not bits.'],
		uint64: [null, undefined, 'PostgreSQL has no unsigned integer types; numeric holds the whole range.'],
		int128: [null, undefined, 'Use numeric.'],
		uint128: [null, undefined, 'Use numeric; a 128-bit identifier fits the uuid type.']
	},
	'SQL Server': {
		int8: [null, undefined, 'tinyint is unsigned: 0 to 255, not −128 to 127.'],
		uint8: ['tinyint', undefined, 'The only unsigned integer type in SQL Server.'],
		int16: ['smallint'],
		uint16: [null, undefined, 'SQL Server has no unsigned types apart from tinyint.'],
		int32: ['int'],
		uint32: [null, undefined, 'SQL Server has no unsigned types apart from tinyint.'],
		int64: ['bigint'],
		uint64: [null, undefined, 'SQL Server has no unsigned types apart from tinyint.'],
		int128: [null, undefined, 'Use decimal(38, 0), which stops one digit short of the full range.'],
		uint128: [null, undefined, 'Use decimal(38, 0), which stops one digit short; uniqueidentifier is 128 bits.']
	},
	JavaScript: {
		int8: ['Int8Array element', undefined, 'There is no 8-bit scalar; numbers are 64-bit floats.'],
		uint8: ['Uint8Array element', undefined, 'Uint8ClampedArray clamps to 0 and 255 instead of wrapping.'],
		int16: ['Int16Array element'],
		uint16: ['Uint16Array element'],
		int32: ['Int32Array element', undefined, 'The bitwise operators (|, &, ^, <<, >>) work on 32-bit signed integers.'],
		uint32: ['Uint32Array element', undefined, 'x >>> 0 reads a number as a 32-bit unsigned integer.'],
		int64: [
			'BigInt64Array element',
			undefined,
			'An ordinary number is exact only up to Number.MAX_SAFE_INTEGER, 2⁵³ − 1. BigInt.asIntN(64, x) wraps a BigInt into 64 bits.'
		],
		uint64: ['BigUint64Array element', undefined, 'BigInt.asUintN(64, x) wraps a BigInt into 64 bits.'],
		int128: [null, undefined, 'BigInt has no fixed width; BigInt.asIntN(128, x) wraps a value into 128 bits.'],
		uint128: [null, undefined, 'BigInt has no fixed width; BigInt.asUintN(128, x) wraps a value into 128 bits.']
	},
	Python: {
		int8: ['ctypes.c_int8', undefined, 'Python’s own int has no fixed width and never overflows.'],
		uint8: ['ctypes.c_uint8', undefined, 'Each item of a bytes object is 0 to 255.'],
		int16: ['ctypes.c_int16'],
		uint16: ['ctypes.c_uint16'],
		int32: ['ctypes.c_int32'],
		uint32: ['ctypes.c_uint32'],
		int64: ['ctypes.c_int64'],
		uint64: ['ctypes.c_uint64'],
		int128: [null, undefined, 'Python’s own int holds any size.'],
		uint128: [null, undefined, 'Python’s own int holds any size.']
	}
};

export const languages = Object.keys(NAMES);

/** What the type is called in each language, in a fixed order. */
export function namesFor(t: IntType): LanguageName[] {
	return languages.map((language) => {
		const row = NAMES[language][t.slug];
		if (!row) throw new Error(`no ${language} entry for ${t.slug}`);
		const [type, limits, note] = row;
		return { language, type, limits, note };
	});
}

// ---------------------------------------------------------------------------
// Overflow.

export type OverflowRule = { language: string; behaviour: string; tools: string };

/**
 * What each language does by default when integer arithmetic leaves the
 * type's range, and what it offers instead. Checked by compiling and running
 * code where a compiler was at hand (C, Java, Rust, Go, JavaScript, Python).
 */
export const overflowRules: OverflowRule[] = [
	{
		language: 'C and C++',
		behaviour:
			'Unsigned types wrap around modulo 2ⁿ. Signed overflow is undefined behaviour: the compiler may assume it never happens and optimise on that basis. Types narrower than int are promoted to int first, so even uint16_t × uint16_t can overflow a signed int.',
		tools: '__builtin_add_overflow (GCC, Clang); ckd_add in C23’s <stdckdint.h>; -fsanitize=undefined to catch it'
	},
	{
		language: 'Java',
		behaviour: 'Wraps around silently, in two’s complement.',
		tools: 'Math.addExact, multiplyExact and friends throw ArithmeticException'
	},
	{
		language: 'C#',
		behaviour:
			'Wraps around, unless the code is in a checked context, which throws OverflowException. A constant expression that overflows is a compile error.',
		tools: 'checked(...) blocks, or the CheckForOverflowUnderflow compiler option'
	},
	{
		language: 'Rust',
		behaviour: 'Panics in debug builds. Release builds wrap, unless overflow-checks is turned on for that profile.',
		tools: 'checked_add, wrapping_add, saturating_add, overflowing_add'
	},
	{
		language: 'Go',
		behaviour: 'Wraps around silently. Only constant expressions that overflow are compile errors.',
		tools: 'math/bits.Add64 reports the carry; Mul64 returns the high half of the product'
	},
	{
		language: 'Swift',
		behaviour: 'Traps: the program stops with a runtime error.',
		tools: '&+, &-, &* wrap on purpose; addingReportingOverflow reports it'
	},
	{
		language: 'Kotlin',
		behaviour: 'Wraps around silently, like Java.',
		tools: 'Math.addExact on the JVM'
	},
	{
		language: 'JavaScript',
		behaviour:
			'Numbers never wrap, but lose precision past 2⁵³. Bitwise operators and typed arrays wrap to their width. BigInt never overflows.',
		tools: 'Number.isSafeInteger; BigInt.asIntN and asUintN to wrap deliberately'
	},
	{
		language: 'Python',
		behaviour: 'int never overflows: it grows as needed.',
		tools: 'ctypes and NumPy fixed-width types do wrap'
	},
	{
		language: 'SQL',
		behaviour: 'An error: the statement fails with an out of range or arithmetic overflow message.',
		tools: 'MySQL outside strict mode clips an out-of-range value stored into a column to the limit, with a warning'
	}
];

/** Any whole number wrapped into the type, the way two's complement hardware does it. */
export const wrap = (n: bigint, t: IntType): bigint =>
	t.signed ? BigInt.asIntN(t.bits, n) : BigInt.asUintN(t.bits, n);

export const fits = (n: bigint, t: IntType): boolean => n >= t.min && n <= t.max;

export type Op = 'inc' | 'dec' | 'dbl' | 'neg' | 'cast';

export const ops: { id: Op; label: string; name: string }[] = [
	{ id: 'inc', label: '+1', name: 'add one' },
	{ id: 'dec', label: '−1', name: 'subtract one' },
	{ id: 'dbl', label: '×2', name: 'double' },
	{ id: 'neg', label: 'negate', name: 'negate' },
	{ id: 'cast', label: 'cast to', name: 'cast' }
];


export type OpResult = {
	from: IntType;
	to: IntType;
	value: bigint;
	/** The mathematically exact answer, before it is squeezed into the type. */
	exact: bigint;
	result: bigint;
	/** True when the stored answer differs from the exact one. */
	wrapped: boolean;
	/** Which end was crossed, for arithmetic. */
	direction: 'over' | 'under' | null;
	/** For casts: what the hardware does to the bit pattern. */
	castKind?: 'same' | 'truncate' | 'sign-extend' | 'zero-extend' | 'reinterpret';
	steps: string[];
};

/**
 * One operation on a value of a type, as the CPU does it: compute the exact
 * answer, keep the low n bits, and read those bits back as the type. That is
 * what Java, Go, C# (unchecked), Rust release builds and C unsigned arithmetic
 * all do; the page says which languages do something else.
 */
export function applyOp(t: IntType, value: bigint, op: Op, target: IntType = t): OpResult {
	if (!fits(value, t)) {
		throw new IntLimitsError(
			`${formatDecimal(value)} is outside ${t.slug} (${formatDecimal(t.min)} to ${formatDecimal(t.max)})`
		);
	}
	const to = op === 'cast' ? target : t;
	const exact =
		op === 'inc' ? value + 1n : op === 'dec' ? value - 1n : op === 'dbl' ? value * 2n : op === 'neg' ? -value : value;
	const result = wrap(exact, to);
	const wrapped = result !== exact;
	const direction = !wrapped || op === 'cast' ? null : exact > to.max ? 'over' : 'under';
	const steps: string[] = [];
	const modulus = to.count;
	const span = `2${superscript(to.bits)} = ${formatDecimal(modulus)}`;

	let castKind: OpResult['castKind'];
	if (op === 'cast') {
		if (to.slug === t.slug) castKind = 'same';
		else if (to.bits < t.bits) castKind = 'truncate';
		else if (to.bits > t.bits) castKind = t.signed ? 'sign-extend' : 'zero-extend';
		else castKind = 'reinterpret';
		const pattern = binaryOf(value, t.bits);
		if (castKind === 'same') steps.push('Same type: nothing changes.');
		if (castKind === 'truncate') {
			steps.push(
				`Narrowing from ${t.bits} to ${to.bits} bits keeps the low ${to.bits} bits and drops the top ${
					t.bits - to.bits
				}.`
			);
		}
		if (castKind === 'sign-extend') {
			const sign = pattern[0];
			steps.push(
				`Widening a signed value copies its sign bit (${sign}) into the ${to.bits - t.bits} new bits${
					to.signed || sign === '0' ? ', so the number keeps its value' : ''
				}.`
			);
		}
		if (castKind === 'zero-extend') {
			steps.push(
				`Widening an unsigned value fills the ${to.bits - t.bits} new bits with 0, so the number keeps its value.`
			);
		}
		if (castKind === 'reinterpret') {
			steps.push(`Same width: the ${to.bits} bits are kept exactly and only read differently.`);
		}
		if (castKind !== 'same' && to.signed) {
			const top = binaryOf(result, to.bits)[0];
			steps.push(
				top === '1'
					? `The top bit of the result is 1, so as ${to.slug} it is negative: ${formatDecimal(
							patternOf(result, to.bits)
					  )} − 2${superscript(to.bits)} = ${formatDecimal(result)}.`
					: `The top bit of the result is 0, so as ${to.slug} it reads as ${formatDecimal(result)}.`
			);
		} else if (castKind !== 'same') {
			steps.push(`Read as unsigned, the bits are ${formatDecimal(result)}.`);
		}
		if (wrapped) {
			steps.push(
				`The value changed: ${formatDecimal(value)} is outside ${to.slug}, which runs from ${formatDecimal(
					to.min
				)} to ${formatDecimal(to.max)}.`
			);
		} else if (castKind !== 'same') {
			steps.push(`${formatDecimal(value)} fits in ${to.slug}, so the value is unchanged.`);
		}
		return { from: t, to, value, exact, result, wrapped, direction, castKind, steps };
	}

	steps.push(`Exact answer: ${formatDecimal(exact)}.`);
	if (!wrapped) {
		steps.push(`That is within ${to.slug} (${formatDecimal(to.min)} to ${formatDecimal(to.max)}), so nothing wraps.`);
	} else {
		steps.push(
			`That is ${direction === 'over' ? 'above the maximum' : 'below the minimum'} of ${to.slug}, ${formatDecimal(
				direction === 'over' ? to.max : to.min
			)}.`
		);
		const low = patternOf(exact, to.bits);
		steps.push(
			`The hardware keeps only the low ${
				to.bits
			} bits, which is the same as taking the answer modulo ${span}: ${formatDecimal(low)}.`
		);
		if (to.signed) {
			steps.push(
				low > to.max
					? `The top bit is 1, so read as signed it is ${formatDecimal(low)} − ${formatDecimal(
							modulus
					  )} = ${formatDecimal(result)}.`
					: `The top bit is 0, so read as signed it stays ${formatDecimal(result)}.`
			);
		}
	}
	return { from: t, to, value, exact, result, wrapped, direction, steps };
}

// ---------------------------------------------------------------------------
// Reading what people type.

/** The longest input accepted, in characters. */
export const MAX_INPUT = 160;

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * Takes the separators out of a run of digits. Underscores may sit between any
 * two digits, as in code. Commas, apostrophes and spaces are only accepted as
 * thousands separators in decimal, in groups of three, so a typo such as
 * "1,2,3" is reported instead of quietly read as 123.
 */
function stripSeparators(body: string, radix: number): string {
	if (/^_|_$|__/.test(body)) throw new IntLimitsError('Put underscores only between digits, as in 1_000_000');
	const plain = body.replace(/_/g, '');
	if (!/[,'\s]/.test(plain)) return plain;
	if (radix === 10 && /^\d{1,3}(?:[,'\s]\d{3})+$/.test(plain)) return plain.replace(/[,'\s]/g, '');
	if (radix !== 10 && /^\w+(?: \w+)+$/.test(plain)) return plain.replace(/ /g, '');
	throw new IntLimitsError(
		radix === 10
			? 'Group the digits in threes, as in 1,000,000, or leave the separators out'
			: 'Separate the digits with single spaces or underscores, or not at all'
	);
}

/**
 * Reads a whole number in decimal, hex (0x), binary (0b) or octal (0o), with
 * an optional sign and digit separators, or a power of two written 2^31 - 1,
 * 2**31 - 1 or 2³¹ − 1, since that is how the limits are usually written.
 */
export function parseInteger(text: string): bigint {
	const raw = text.trim();
	if (!raw) throw new IntLimitsError('Type a whole number first');
	if (raw.length > MAX_INPUT) throw new IntLimitsError(`That is more than ${MAX_INPUT} characters`);
	const s = raw
		.replace(/[−–]/g, '-')
		// 2³¹ is 2^31: the form these pages print the limits in.
		.replace(/(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, d: string, sup: string) =>
			[d, '^', ...Array.from(sup, (c) => SUPERSCRIPTS.indexOf(c))].join('')
		)
		// Spaces around an operator are just layout; spaces inside a number are not.
		.replace(/\s*(\^|\*\*|[+-])\s*/g, '$1');

	if (/^[+-]?2(?:\^|\*\*)/.test(s)) {
		const power = s.match(/^([+-]?)2(?:\^|\*\*)(\d+)(?:([+-])(.+))?$/);
		if (!power) throw new IntLimitsError('Write a power of two as 2^31, 2^31 - 1 or 2^31 + 1');
		const exponent = Number(power[2]);
		if (exponent > 400) throw new IntLimitsError('Keep the power of two to 400 or less');
		let n = 1n << BigInt(exponent);
		if (power[1] === '-') n = -n;
		if (power[3]) {
			const addend = stripSeparators(power[4], 10);
			if (!/^\d+$/.test(addend)) throw new IntLimitsError('Add or subtract a whole decimal number, as in 2^31 - 1');
			n = power[3] === '-' ? n - BigInt(addend) : n + BigInt(addend);
		}
		return n;
	}
	const m = s.match(/^([+-]?)(0[xX]|0[bB]|0[oO])?(.*)$/) as RegExpMatchArray;
	const negative = m[1] === '-';
	const prefix = (m[2] ?? '').toLowerCase();
	const radix = prefix === '0x' ? 16 : prefix === '0b' ? 2 : prefix === '0o' ? 8 : 10;
	const radixName = { 16: 'hex', 2: 'binary', 8: 'octal', 10: 'decimal' }[radix];
	if (!m[3])
		throw new IntLimitsError(prefix ? `Add some ${radixName} digits after ${prefix}` : 'Type a whole number first');
	if (radix === 10 && /^\d+\.\d*$|^\d*\.\d+$/.test(m[3]))
		throw new IntLimitsError('Whole numbers only: integer types have no fractions');
	if (radix === 10 && /^\d+(\.\d+)?e\d+$/i.test(m[3])) {
		throw new IntLimitsError('Write the number out in full, or as a power of two such as 2^31 - 1');
	}
	const body = stripSeparators(m[3], radix);
	const valid = '0123456789abcdef'.slice(0, radix);
	for (const ch of body.toLowerCase()) {
		if (!valid.includes(ch)) {
			throw new IntLimitsError(`"${ch}" is not ${radix === 8 ? 'an' : 'a'} ${radixName} digit`);
		}
	}
	const value = BigInt((prefix || '') + body);
	return negative ? -value : value;
}

/**
 * How a JavaScript number copes with n. Past Number.MAX_SAFE_INTEGER some
 * integers still have an exact double (every power of two does), but their
 * neighbours do not, so arithmetic on them is no longer safe.
 */
export function jsNumberFit(n: bigint): { safe: boolean; exact: boolean; rounded: bigint | null } {
	const x = Number(n);
	const rounded = Number.isFinite(x) ? BigInt(x) : null;
	return { safe: Number.isSafeInteger(x) && rounded === n, exact: rounded === n, rounded };
}

// ---------------------------------------------------------------------------
// Which types hold a number.

/** The fewest bits that hold n: as unsigned (null for negatives) and as signed two's complement. */
export function bitsNeeded(n: bigint): { unsigned: number | null; signed: number } {
	// −1 is all ones at any width, so a single bit holds it; below that, the
	// magnitude of −n − 1 plus a sign bit.
	if (n < 0n) return { unsigned: null, signed: n === -1n ? 1 : (-n - 1n).toString(2).length + 1 };
	const length = n === 0n ? 1 : n.toString(2).length;
	return { unsigned: length, signed: n === 0n ? 1 : length + 1 };
}

export type Lookup = {
	value: bigint;
	bits: { unsigned: number | null; signed: number };
	smallestSigned: IntType | null;
	smallestUnsigned: IntType | null;
	all: { type: IntType; fits: boolean }[];
};

export function lookup(n: bigint): Lookup {
	const all = intTypes.map((type) => ({ type, fits: fits(n, type) }));
	return {
		value: n,
		bits: bitsNeeded(n),
		smallestSigned: intTypes.find((t) => t.signed && fits(n, t)) ?? null,
		smallestUnsigned: intTypes.find((t) => !t.signed && fits(n, t)) ?? null,
		all
	};
}

// ---------------------------------------------------------------------------
// Dates and durations that fall out of the limits.

/** A count of seconds since 1970-01-01 UTC as an ISO date, to the second. */
export const unixDate = (seconds: bigint): string =>
	new Date(Number(seconds) * 1000).toISOString().replace('.000Z', ' UTC').replace('T', ' ');

/** The last second a Unix timestamp of this type can hold, and where it lands after one more. */
export function unixRollover(t: IntType): { last: string; next: string } | null {
	if (t.bits !== 32) return null;
	return { last: unixDate(t.max), next: unixDate(wrap(t.max + 1n, t)) };
}

/** Average Gregorian year in seconds: 365.2425 days. */
const GREGORIAN_YEAR = 31_556_952n;

/** Roughly how many years a 64-bit signed seconds counter lasts, in billions. */
export const int64UnixBillionYears = (): number =>
	Number((intTypeBySlug('int64') as IntType).max / GREGORIAN_YEAR / 1_000_000n) / 1000;

/** Days until a counter of `bits` bits overflows when it ticks `perSecond` times a second. */
export const daysToOverflow = (limit: bigint, perSecond: number): number => Number(limit) / perSecond / 86400;

export type Story = { title: string; text: string };

/** Real overflows, attached only to the type they concern. */
export function storiesFor(t: IntType): Story[] {
	const stories: Story[] = [];
	if (t.slug === 'uint8') {
		stories.push({
			title: 'Pac-Man level 256',
			text: 'The arcade Pac-Man keeps its level number in a single byte. On level 256 the routine that draws the bonus fruit at the bottom of the screen goes wrong when that count overflows: it draws far more than it should, garbles the right half of the maze and leaves a level that cannot be finished.'
		});
	}
	if (t.slug === 'int16') {
		stories.push({
			title: 'Ariane 5 flight 501',
			text: `On 4 June 1996 the first Ariane 5 broke up about 40 seconds after lift-off. Its inertial reference software converted a 64-bit floating-point value, the horizontal bias, into a 16-bit signed integer. The value was larger than ${formatDecimal(
				t.max
			)}, the conversion raised an exception, both inertial reference units shut down, and the rocket veered off course and was destroyed.`
		});
	}
	if (t.slug === 'int32') {
		const r = unixRollover(t) as { last: string; next: string };
		const centi = daysToOverflow(t.max + 1n, 100);
		stories.push(
			{
				title: 'The Year 2038 problem',
				text: `Unix time counts seconds since 1970-01-01 00:00:00 UTC. In a signed 32-bit integer the last second it can hold is ${
					r.last
				}; one second later it wraps to ${formatDecimal(t.min)}, which reads as ${
					r.next
				}. Systems that still store time in 32 bits need to move to 64.`
			},
			{
				title: 'Boeing 787 generator control units',
				text: `In 2015 the US Federal Aviation Administration ordered 787 operators to cycle power regularly, because a software counter in the generator control units overflowed after 248 days of continuous power and could shut down all AC power. 2³¹ hundredths of a second is ${centi.toFixed(
					2
				)} days, which is why it is widely taken to be a signed 32-bit count of centiseconds.`
			},
			{
				title: 'Gangnam Style on YouTube',
				text: `In December 2014 YouTube said Psy’s Gangnam Style had been watched so many times, closing in on ${formatDecimal(
					t.max
				)} views, the largest signed 32-bit integer, that it had upgraded the view counter to a 64-bit integer.`
			}
		);
	}
	if (t.slug === 'uint32') {
		const r = unixRollover(t) as { last: string; next: string };
		const ms = daysToOverflow(t.count, 1000);
		stories.push(
			{
				title: 'Windows 95 and 98 after 49.7 days',
				text: `Microsoft documented that Windows 95 and 98 could stop responding after exactly 49.7 days of continuous running, a fault in their timing code. 2³² milliseconds is ${ms.toFixed(
					2
				)} days, the point where a 32-bit count of milliseconds runs out.`
			},
			{
				title: 'Unsigned Unix time',
				text: `Stored as unsigned 32 bits, Unix time runs out later than the signed 2038 limit: the last second is ${r.last}. The price is that dates before 1970 cannot be written at all.`
			}
		);
	}
	if (t.slug === 'int64') {
		stories.push({
			title: '64-bit Unix time',
			text: `With a signed 64-bit count of seconds, Unix time lasts about ${int64UnixBillionYears().toFixed(
				0
			)} billion years either side of 1970, which is why moving to 64 bits settles the 2038 problem for good.`
		});
	}
	return stories;
}

/** A place a type turns up, linked to the tool for it when the site has one. */
export type Use = string | { text: string; href: string };

/** Where people actually meet each type. Plain facts, no anecdotes. */
export const usesOf: Record<IntSlug, Use[]> = {
	int8: ['Small signed offsets and deltas', 'Java’s byte, which is signed, so a byte read as 0xFF is −1'],
	uint8: [
		'One byte of memory or a file',
		'Each red, green or blue channel of a 24-bit colour',
		{ text: 'Each part of an IPv4 address', href: '/subnet-calculator' }
	],
	int16: ['CD audio and most WAV files: 16-bit signed samples', 'Older and embedded systems where int is 16 bits'],
	uint16: [
		'TCP and UDP port numbers, 0 to 65,535',
		'UTF-16 code units',
		'Unicode code points in the Basic Multilingual Plane'
	],
	int32: ['int in Java, C# and (on common platforms) C', 'Unix time in older systems', 'JavaScript bitwise operators'],
	uint32: [
		{ text: 'An IPv4 address as one number', href: '/subnet-calculator' },
		'CRC-32 checksums',
		'RGBA colours packed into one word'
	],
	int64: ['Unix time in modern systems', 'long in Java, C# and Kotlin', 'Database primary keys (bigint)'],
	uint64: [
		'size_t and memory addresses on 64-bit platforms',
		'Hashes such as 64-bit FNV',
		'File sizes and offsets',
		{
			text: '64-bit IDs such as Discord snowflakes, which APIs send as strings so JavaScript does not round them',
			href: '/snowflake-id-decoder'
		}
	],
	int128: ['The full signed product of two 64-bit numbers', 'Sums of many 64-bit values that must not overflow'],
	uint128: [
		{ text: 'An IPv6 address as one number', href: '/ipv6-expand-compress' },
		{ text: 'UUIDs, which are 128 bits', href: '/uuid-decoder' },
		'The full product of two 64-bit numbers'
	]
};

export type Mistake = { title: string; text: string };

/**
 * Mistakes people make with a type, with the numbers computed. Each one is a
 * plain consequence of the rules above (promotion to int, two's complement,
 * doubles in JSON), not an anecdote.
 */
export function mistakesFor(t: IntType): Mistake[] {
	const out: Mistake[] = [];
	const max = formatDecimal(t.max);
	if (t.signed) {
		out.push({
			title: `Negating ${formatDecimal(t.min)} or taking its absolute value`,
			text: `The exact answer, ${formatDecimal(-t.min)}, is one past the maximum of ${max}, so once it is stored as ${
				t.slug
			} it wraps back to ${formatDecimal(wrap(-t.min, t))}: −x and abs(x) of the minimum stay negative${
				t.bits >= 32 ? ' wherever the result wraps, and in C and C++ the overflow is undefined behaviour' : ''
			}.`
		});
	} else {
		out.push({
			title: 'Counting down to zero with an unsigned counter',
			text: `A loop such as for (i = n; i >= 0; i--) never ends when i is ${t.slug}: i >= 0 is always true, and 0 − 1 wraps to ${max}. Test i > 0 and use i − 1 inside, or use a signed counter.`
		});
	}
	if (t.slug === 'int8') {
		out.push({
			title: 'Reading Java bytes as 0 to 255',
			text: `Java’s byte is signed, so a byte holding 0xFF reads as ${formatDecimal(
				wrap(255n, t)
			)}. Use b & 0xFF or Byte.toUnsignedInt(b) to get ${formatDecimal(255n)}.`
		});
	}
	if (t.slug === 'uint8') {
		const sum = 200n + 100n;
		out.push({
			title: 'Expecting a byte sum in C to wrap straight away',
			text: `Two uint8_t values are promoted to int before they are added, so 200 + 100 is ${formatDecimal(
				sum
			)} until it is stored back into a uint8_t, where it becomes ${formatDecimal(
				wrap(sum, t)
			)}. Comparing the sum with 255 before storing it therefore works.`
		});
	}
	if (t.slug === 'int16') {
		out.push({
			title: 'Expecting short arithmetic in Java to stay short',
			text: `s = s + 1 does not compile when s is a short, because s + 1 is an int. s += 1 and s++ do compile, and silently wrap ${max} to ${formatDecimal(
				wrap(t.max + 1n, t)
			)}.`
		});
	}
	if (t.slug === 'uint16') {
		const product = t.max * t.max;
		const int32 = intTypeBySlug('int32') as IntType;
		out.push({
			title: 'Multiplying two uint16_t values in C',
			text: `Both are promoted to signed int first, so ${max} × ${max} = ${formatDecimal(
				product
			)} overflows a 32-bit int (maximum ${formatDecimal(
				int32.max
			)}), which is undefined behaviour. Cast one operand to uint32_t before multiplying.`
		});
	}
	if (t.slug === 'uint32' || t.slug === 'uint64') {
		const cname = t.slug === 'uint32' ? 'uint32_t' : 'uint64_t';
		out.push({
			title: 'Comparing signed with unsigned in C',
			text: `-1 < x is false when x is a ${cname}, even when x is 0: the −1 is converted to ${
				t.slug
			} first and becomes ${max}${t.slug === 'uint32' ? ' (on platforms where int is 32 bits)' : ''}.`
		});
	}
	if (t.bits === 32 || t.bits === 64) {
		out.push({
			title: 'Finding a midpoint as (low + high) / 2',
			text: `When low and high are both ${formatDecimal(
				t.max / 2n + 1n
			)} or more, just over half the maximum, their sum overflows ${
				t.slug
			}. low + (high − low) / 2 gives the same midpoint without the overflow.`
		});
	}
	if (t.slug === 'int32') {
		const r = unixRollover(t) as { last: string; next: string };
		out.push({
			title: 'Storing timestamps or growing IDs in 32 bits',
			text: `A signed 32-bit count of seconds since 1970 runs out at ${r.last}, and an auto-increment ID stops at ${max}. Use 64 bits for anything that keeps growing.`
		});
	}
	if (t.bits === 64) {
		const id = 2n ** 53n + 1n;
		out.push({
			title: 'Sending 64-bit IDs through JSON to JavaScript',
			text: `JSON.parse turns every number into a double, which is exact only up to 2⁵³ − 1. An ID of ${formatDecimal(
				id
			)} arrives as ${formatDecimal(BigInt(Number(id)))}. Send large IDs as strings.`
		});
	}
	if (t.bits === 128) {
		out.push({
			title: 'Expecting the usual tools to handle 128 bits',
			text: 'GCC and Clang have no literal for __int128 and printf has no format for it, so build values from two 64-bit halves and print them yourself. MySQL, PostgreSQL and SQL Server have no 128-bit integer column type either.'
		});
	}
	return out;
}

/** A JavaScript expression that shows max + 1 wrapping, for the type's own storage. */
export function jsWrapExample(t: IntType): string {
	const arrays: Partial<Record<IntSlug, string>> = {
		int8: 'Int8Array',
		uint8: 'Uint8Array',
		int16: 'Int16Array',
		uint16: 'Uint16Array'
	};
	const array = arrays[t.slug];
	if (array) return `new ${array}([${t.max} + 1])[0]`;
	if (t.slug === 'int32') return `(${t.max} + 1) | 0`;
	if (t.slug === 'uint32') return `(${t.max} + 1) >>> 0`;
	return `BigInt.${t.signed ? 'asIntN' : 'asUintN'}(${t.bits}, ${t.max}n + 1n)`;
}

// ---------------------------------------------------------------------------
// Page text, generated so the numbers in it are computed.

export const typeTitle = (t: IntType) =>
	`${t.slug} Max Value and Range: ${t.bits}-bit ${t.signed ? 'Signed' : 'Unsigned'} Integer`;

/** "A", "A and B", "A, B and C". */
export const listOf = (items: string[]): string =>
	items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** True when the language has a type of exactly this width, by namesFor. */
export const hasType = (t: IntType, language: string): boolean =>
	namesFor(t).some((n) => n.language === language && n.type !== null);

/** The languages a description names: only those with a real name for the type. */
export function describedLanguages(t: IntType): string[] {
	const named = [
		['C and C++', 'C'],
		['Java', 'Java'],
		['C#', 'C#'],
		['Rust', 'Rust'],
		['Go', 'Go']
	]
		.filter(([language]) => hasType(t, language))
		.map(([, short]) => short);
	const sql = ['MySQL', 'PostgreSQL', 'SQL Server'].some((d) => hasType(t, d));
	return sql ? [...named, 'SQL'] : named;
}

/** A 110 to 160 character description, a full sentence: the first candidate that fits. */
export function typeDescription(t: IntType): string {
	const f = formulas(t);
	const range = `${formatDecimal(t.min)} to ${formatDecimal(t.max)}`;
	const langs = listOf(describedLanguages(t));
	const candidates = [
		`${t.slug} holds ${range} (${f.min} to ${f.max}). Here are its names in ${langs} and what each language does on overflow.`,
		`${t.slug} holds ${range}. Here are its names in ${langs} and what happens on overflow.`,
		`${t.slug}, the ${describeType(t)}, holds ${f.min} to ${f.max}, up to ${formatDecimal(
			t.max
		)}. See its name in each language and what overflow does.`,
		`${t.slug} is the ${describeType(t)}: ${f.min} to ${
			f.max
		}. See its exact limits in decimal, hex and binary, its names in ${langs} and what overflow does.`,
		`${t.slug} is the ${describeType(t)}, holding ${f.min} to ${
			f.max
		}. See its exact limits in decimal, hex and binary, its name in each language, and what overflow does.`
	];
	const fit = candidates.find((c) => c.length >= 110 && c.length <= 160);
	if (!fit) throw new Error(`no description fits for ${t.slug}`);
	return fit;
}

/**
 * What max + 1 does, language by language. Only languages that have the type
 * are named. Below 32 bits the C family, Java, C# and Kotlin do the sum in int
 * (Java's byte + 1 is the int 128; Kotlin's UByte and UShort give a UInt), so the wrap happens only when the result
 * is stored back; Go, Rust and Swift work at the narrow width itself.
 */
export function overflowAnswer(t: IntType): string {
	const max = formatDecimal(t.max);
	const next = formatDecimal(wrap(t.max + 1n, t));
	const head = `On the hardware the result keeps only its low ${t.bits} bits, so ${max} + 1 becomes ${next}.`;
	if (t.bits < 32) {
		const promoting = ['C', 'C++', ...['Java', 'C#', 'Kotlin'].filter((l) => hasType(t, l))];
		return `${head} In ${listOf(promoting)}, arithmetic on ${t.bits}-bit values is done in int${
			!t.signed && promoting.includes('Kotlin') ? ' (UInt in Kotlin)' : ''
		}, so ${max} + 1 is ${formatDecimal(t.max + 1n)} as an int; it becomes ${next} only when stored back into the ${
			t.bits
		}-bit type, as x++, ${
			promoting.includes('Kotlin')
				? 'a cast or (except in Kotlin, where it does not compile) x += 1'
				: 'x += 1 or a cast'
		} do. Go wraps at ${
			t.bits
		} bits directly, Rust panics in debug builds and wraps in release builds, and Swift stops with a runtime error.`;
	}
	const wrapping = ['Java', 'Kotlin', 'Go', 'C#']
		.filter((l) => hasType(t, l))
		.map((l) => (l === 'C#' ? 'C# (outside a checked context)' : l));
	const c = t.signed
		? 'In C and C++ signed overflow is undefined behaviour'
		: 'C and C++ wrap unsigned types the same way';
	return `${head} ${listOf(wrapping)} ${
		wrapping.length === 1 ? 'does' : 'do'
	} exactly that. ${c}; Rust panics in debug builds and wraps in release builds; Swift stops with a runtime error.`;
}

export type Faq = { q: string; a: string };

export function typeFaqs(t: IntType): Faq[] {
	const f = formulas(t);
	const names = namesFor(t).filter((n) => n.type && !n.type.includes('element') && !n.language.includes('SQL'));
	const sql = namesFor(t).filter((n) => n.type && ['MySQL', 'PostgreSQL', 'SQL Server'].includes(n.language));
	const faqs: Faq[] = [
		{
			q: `What is the maximum value of ${t.slug}?`,
			a: `${formatDecimal(t.max)}, which is ${f.max} or ${hexOf(t.max, t.bits)} in hex. The minimum is ${formatDecimal(
				t.min
			)}${t.signed ? ` (${f.min})` : ''}.`
		},
		t.signed
			? {
					q: `Why is the minimum of ${t.slug} one further from zero than the maximum?`,
					a: `${t.bits} bits make ${
						f.count
					} patterns. Two’s complement gives the half with the top bit set to the negatives, ${formatDecimal(
						t.min
					)} to −1, and the other half to zero and the positives, 0 to ${formatDecimal(
						t.max
					)}. Zero takes one of the non-negative patterns, so there is one more negative number than positive. That is also why negating ${formatDecimal(
						t.min
					)} overflows back to itself.`
			  }
			: {
					q: `Why does ${t.slug} start at 0?`,
					a: `An unsigned type spends all ${
						t.bits
					} bits on magnitude and none on a sign, so it cannot hold negative numbers but reaches twice as far: ${formatDecimal(
						t.max
					)} instead of the ${formatDecimal(twinOf(t).max)} of ${
						twinOf(t).slug
					}. Subtracting 1 from 0 wraps to the maximum.`
			  },
		{
			q: `How many values can ${t.slug} hold?`,
			a: `${f.count} = ${formatDecimal(t.count)} distinct values, from ${formatDecimal(t.min)} to ${formatDecimal(
				t.max
			)}.`
		},
		{
			q: `What happens when ${t.slug} overflows?`,
			a: overflowAnswer(t)
		},
		{
			q: `What is ${t.slug} called in other languages?`,
			a:
				(names.length
					? `${names.map((n) => `${n.language}: ${n.type}`).join('; ')}.`
					: 'None of the common languages has a standard name for it.') +
				(sql.length
					? ` In SQL: ${sql.map((n) => `${n.type} in ${n.language}`).join(', ')}.`
					: ' No common SQL database has it as a column type.')
		}
	];
	return faqs;
}
