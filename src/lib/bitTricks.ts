// The classic bit hacks, each one run step by step on a fixed-width integer so
// the page can show every intermediate value as a row of bits.
//
// Values are held as plain numbers holding the unsigned bit pattern, 0 to
// 2^width - 1. JavaScript's own bitwise operators work on 32-bit signed
// integers, so every operation goes through wrap() to bring the result back to
// the pattern at the chosen width; signed() reads a pattern as two's
// complement when a trick needs the sign. Shifts by 32 never happen: the
// tricks only shift by less than the width.

export type Width = 8 | 16 | 32;
export const WIDTHS: readonly Width[] = [8, 16, 32];

export class BitTrickError extends Error {
	/** The input the message is about, so a page can mark that field. */
	field: 'x' | 'y' | 'n' = 'x';
}

function fieldError(field: 'x' | 'y' | 'n', message: string) {
	const e = new BitTrickError(message);
	e.field = field;
	return e;
}

/** All ones at the width. */
export const maskOf = (w: Width): number => (w === 32 ? 0xffffffff : (1 << w) - 1);

/** Any integer (within ±2^53) reduced to the unsigned pattern of its low w bits. */
export const wrap = (v: number, w: Width): number => (w === 32 ? v >>> 0 : (v >>> 0) & maskOf(w));

/** The pattern read as a two's complement number. */
export const signed = (v: number, w: Width): number => (v >= 2 ** (w - 1) ? v - 2 ** w : v);

const and = (a: number, b: number, w: Width) => wrap(a & b, w);
const or = (a: number, b: number, w: Width) => wrap(a | b, w);
const xor = (a: number, b: number, w: Width) => wrap(a ^ b, w);
const not = (a: number, w: Width) => wrap(~a, w);
const add = (a: number, b: number, w: Width) => wrap(a + b, w);
const sub = (a: number, b: number, w: Width) => wrap(a - b, w);
const shl = (a: number, k: number, w: Width) => wrap(a << k, w);
/** Logical shift right: zeros come in at the top, as for an unsigned type. */
const shr = (a: number, k: number) => a >>> k;
/** Arithmetic shift right: copies of the sign bit come in, as GCC and Clang do for a negative int. */
const sar = (a: number, k: number, w: Width) => wrap(signed(a, w) >> k, w);
const mul = (a: number, b: number, w: Width) => wrap(Math.imul(a, b), w);

/** The bits of a pattern, most significant first. */
export const bitString = (v: number, w: Width): string => v.toString(2).padStart(w, '0');

/** Binary in groups (nibbles by default), for prose. */
export function groupedBits(v: number, w: Width, group = 4): string {
	const s = bitString(v, w);
	const out: string[] = [];
	for (let i = 0; i < w; i += group) out.push(s.slice(i, i + group));
	return out.join(' ');
}

/** Hex padded to the width, with a 0x prefix. */
export const hexOf = (v: number, w: Width): string =>
	'0x' +
	v
		.toString(16)
		.toUpperCase()
		.padStart(w / 4, '0');

/** Which bits differ between two patterns, indexed by bit position (0 is the least significant). */
export function changedBits(a: number, b: number, w: Width): boolean[] {
	const d = xor(a, b, w);
	return Array.from({ length: w }, (_, i) => Math.floor(d / 2 ** i) % 2 === 1);
}

export const popcount = (v: number): number => {
	let c = 0;
	for (let x = v; x; x = Math.floor(x / 2)) c += x % 2;
	return c;
};

/** A printable ASCII character for a byte value, or '' when there is none. */
export const asciiChar = (v: number): string => (v >= 0x21 && v <= 0x7e ? String.fromCharCode(v) : '');
const isLetter = (v: number) => (v >= 65 && v <= 90) || (v >= 97 && v <= 122);

// --- input -------------------------------------------------------------

export const MAX_INPUT = 80;

/**
 * Reads what someone typed as a pattern of w bits: decimal (signed or
 * unsigned), hex with 0x, binary with 0b, or a character in quotes such as 'a'.
 * Spaces and underscores between digits are ignored. A value that needs more
 * bits than the width is refused rather than silently cut down.
 */
export function parseOperand(text: string, w: Width): number {
	const raw = text.trim();
	if (!raw) throw new BitTrickError('Type a number: decimal, 0x hex, 0b binary or a character in quotes.');
	if (raw.length > MAX_INPUT) throw new BitTrickError(`That is more than ${MAX_INPUT} characters.`);
	const quoted = raw.match(/^(['"])(.)\1$/u);
	if (quoted) {
		const code = quoted[2].codePointAt(0) ?? 0;
		if (code >= 2 ** w)
			throw new BitTrickError(`'${quoted[2]}' is U+${code.toString(16).toUpperCase()}, more than ${w} bits.`);
		return code;
	}
	if (/^['"‘’“”]/u.test(raw)) throw new BitTrickError("Put exactly one character between the quotes, such as 'a'.");
	let s = raw.replace(/[\s_]/g, '');
	let negative = false;
	if (s[0] === '-' || s[0] === '+' || s[0] === '−') {
		negative = s[0] !== '+';
		s = s.slice(1);
	}
	let value: bigint;
	let kind: 'decimal' | 'hex' | 'binary' = 'decimal';
	if (/^0x/i.test(s)) {
		kind = 'hex';
		const digits = s.slice(2);
		const bad = digits.match(/[^0-9a-f]/i);
		if (!digits || bad)
			throw new BitTrickError(bad ? `"${bad[0]}" is not a hex digit.` : 'Hex digits are missing after 0x.');
		value = BigInt('0x' + digits);
	} else if (/^0b/i.test(s)) {
		kind = 'binary';
		const digits = s.slice(2);
		const bad = digits.match(/[^01]/);
		if (!digits || bad)
			throw new BitTrickError(bad ? `"${bad[0]}" is not a binary digit.` : 'Bits are missing after 0b.');
		value = BigInt('0b' + digits);
	} else {
		const bad = s.match(/[^0-9]/);
		if (!s || bad)
			throw new BitTrickError(
				bad ? `"${bad[0]}" is not a decimal digit. Hex needs 0x in front, binary 0b.` : 'There is no number there.'
			);
		value = BigInt(s);
	}
	const top = 1n << BigInt(w);
	if (negative) {
		if (value > top / 2n)
			throw new BitTrickError(`-${value} is below −${top / 2n}, the smallest ${w}-bit signed value.`);
		return Number((top - value) % top);
	}
	if (value >= top) {
		const needs = value.toString(2).length;
		throw new BitTrickError(
			kind === 'decimal'
				? `${value} does not fit in ${w} bits: the range is 0 to ${top - 1n}, or −${top / 2n} to ${
						top / 2n - 1n
				  } signed.`
				: `That needs ${needs} bits, more than ${w}.`
		);
	}
	return Number(value);
}

// --- traces --------------------------------------------------------------

export type RowRole = 'input' | 'mask' | 'step' | 'result';

export interface Row {
	/** The C expression whose value this row is. */
	expr: string;
	/** What the operation did, in words. */
	note?: string;
	value: number;
	role: RowRole;
	/** Index of the row this one is compared with: its differing bits are marked. */
	base?: number;
	/**
	 * The size of the fields a trick works on, when it is not a nibble. The bit
	 * columns keep their nibble spacing whatever this is, so a bit can be
	 * followed straight down; the fields are shown by shading alone.
	 */
	group?: number;
}

export type Result =
	| { kind: 'bits'; value: number }
	| { kind: 'bool'; value: boolean }
	| { kind: 'count'; value: number; unit: string }
	| { kind: 'pair'; value: [number, number]; names: [string, string] };

export interface Trace {
	rows: Row[];
	result: Result;
	/** One sentence saying what came out, for the answer box. */
	summary: string;
	/** The result as the answer box should show it, when that is not just the number. */
	answer?: string;
	/** A case where the trick goes wrong or a naive version for comparison. */
	aside?: { title: string; text: string; code?: string; rows: Row[] };
	/** The inputs are outside what the trick is for; the trace still runs. */
	warning?: string;
}

export type Category = 'single' | 'lowest' | 'count' | 'arith' | 'shuffle';

export const categories: { id: Category; name: string }[] = [
	{ id: 'single', name: 'One bit at a time' },
	{ id: 'lowest', name: 'The lowest set bit' },
	{ id: 'count', name: 'Counting bits' },
	{ id: 'arith', name: 'Arithmetic without branches' },
	{ id: 'shuffle', name: 'Moving and converting bits' }
];

export interface Inputs {
	x: number;
	y: number;
	n: number;
	w: Width;
}

export interface Example {
	label: string;
	x: string;
	y?: string;
	n?: number;
	/** The width the example is about, when it only makes its point at one width. */
	w?: Width;
}

export interface Trick {
	id: string;
	name: string;
	category: Category;
	/**
	 * The trick as C for the given width, with x (and y) held in a uintN_t, or
	 * an intN_t for a signed trick. C does arithmetic on 8 and 16-bit values in
	 * int, so the code casts back to the width wherever that changes the result.
	 */
	code: (w: Width) => string;
	/** One line: what it computes. */
	what: string;
	/** Why it works, a paragraph or two. */
	why: string[];
	/** The second operand's label when the trick takes one. */
	y?: string;
	/** The integer parameter: its label and range for a width. */
	n?: { label: string; min: number; max: (w: Width) => number };
	/** Treat x (and y) as signed in the decimal column of the trace. */
	signedView?: boolean;
	examples: Example[];
	trace: (i: Inputs) => Trace;
}

const intT = (w: Width) => `int${w}_t`;
const uintT = (w: Width) => `uint${w}_t`;

/** The C type a trick's x (and y) is held in at a width. */
export const cType = (trick: Trick, w: Width): string => (trick.signedView ? intT(w) : uintT(w));
const hx = hexOf;
const dec = (v: number) => (v < 0 ? `−${-v}` : String(v));
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** The mask with only bit n set. */
const bitMask = (n: number, w: Width) => shl(1, n, w);

/** Index of the lowest set bit, or -1 for zero. */
function lowestSet(v: number): number {
	if (!v) return -1;
	let i = 0;
	while (Math.floor(v / 2 ** i) % 2 === 0) i++;
	return i;
}

/** A shift-and-mask cascade's masks: s ones then s zeros, repeated, starting at bit 0. */
export function alternatingMask(s: number, w: Width): number {
	let m = 0;
	for (let i = 0; i < w; i++) if (Math.floor(i / s) % 2 === 0) m += 2 ** i;
	return m;
}

/** The SWAR popcount's multiply, cut back to the width where C would not. */
const swarProduct = (w: Width) => (w === 16 ? '(uint16_t)(x * 0x0101)' : '(x * 0x01010101)');

/** The shift amounts 1, 2, 4 … below the width. */
const halvings = (w: Width) => [1, 2, 4, 8, 16].filter((s) => s < w);

function singleBit(kind: 'test' | 'set' | 'clear' | 'toggle'): Trick['trace'] {
	return ({ x, n, w }) => {
		const m = bitMask(n, w);
		const rows: Row[] = [
			{ expr: 'x', value: x, role: 'input' },
			{ expr: `1u << ${n}`, note: `only bit ${n} is 1`, value: m, role: 'mask' }
		];
		if (kind === 'test') {
			const r = and(x, m, w);
			rows.push({ expr: `x & (1u << ${n})`, note: 'AND keeps bit n and clears the rest', value: r, role: 'result' });
			return {
				rows,
				result: { kind: 'bool', value: r !== 0 },
				summary: `Bit ${n} of x is ${r ? 1 : 0}: the AND is ${r ? 'non-zero, so true' : 'zero, so false'}.`
			};
		}
		if (kind === 'set') {
			const r = or(x, m, w);
			rows.push({ expr: `x | (1u << ${n})`, note: 'OR with 1 forces the bit on', value: r, role: 'result', base: 0 });
			return {
				rows,
				result: { kind: 'bits', value: r },
				summary:
					r === x ? `Bit ${n} was already 1, so x is unchanged.` : `Bit ${n} is now 1; every other bit is untouched.`
			};
		}
		if (kind === 'clear') {
			const inv = not(m, w);
			const r = and(x, inv, w);
			rows.push({ expr: `~(1u << ${n})`, note: `every bit 1 except bit ${n}`, value: inv, role: 'mask', base: 1 });
			rows.push({
				expr: `x & ~(1u << ${n})`,
				note: 'AND with 0 forces the bit off',
				value: r,
				role: 'result',
				base: 0
			});
			return {
				rows,
				result: { kind: 'bits', value: r },
				summary:
					r === x ? `Bit ${n} was already 0, so x is unchanged.` : `Bit ${n} is now 0; every other bit is untouched.`
			};
		}
		const r = xor(x, m, w);
		rows.push({ expr: `x ^ (1u << ${n})`, note: 'XOR with 1 flips the bit', value: r, role: 'result', base: 0 });
		return {
			rows,
			result: { kind: 'bits', value: r },
			summary: `Bit ${n} flipped from ${r & m ? 0 : 1} to ${r & m ? 1 : 0}.`
		};
	};
}

const bitN = { label: 'bit n', min: 0, max: (w: Width) => w - 1 };

export const tricks: Trick[] = [
	{
		id: 'test-a-bit',
		name: 'Test bit n',
		category: 'single',
		code: () => '(x & (1u << n)) != 0',
		what: 'Is bit n of x a 1?',
		why: [
			'1u << n is a mask with a single 1 at position n. AND keeps a bit only where both inputs are 1, so every other position becomes 0 and the result is non-zero exactly when x has a 1 at position n.',
			'(x >> n) & 1 gives the same answer as 0 or 1 instead of zero or non-zero.'
		],
		n: bitN,
		examples: [
			{ label: 'bit 3 of 88', x: '88', n: 3 },
			{ label: 'bit 0 of 88', x: '88', n: 0 },
			{ label: 'bit 7 of −1', x: '-1', n: 7 }
		],
		trace: singleBit('test')
	},
	{
		id: 'set-a-bit',
		name: 'Set bit n',
		category: 'single',
		code: () => 'x | (1u << n)',
		what: 'Turn bit n on and leave the others alone.',
		why: [
			'OR with 0 leaves a bit as it was and OR with 1 makes it 1. The mask is 0 everywhere except position n, so only that bit can change.'
		],
		n: bitN,
		examples: [
			{ label: 'set bit 2 of 88', x: '88', n: 2 },
			{ label: 'already set', x: '88', n: 3 }
		],
		trace: singleBit('set')
	},
	{
		id: 'clear-a-bit',
		name: 'Clear bit n',
		category: 'single',
		code: () => 'x & ~(1u << n)',
		what: 'Turn bit n off and leave the others alone.',
		why: [
			'~ inverts the single-bit mask, giving all ones with a 0 at position n. AND with 1 leaves a bit as it was and AND with 0 clears it, so only bit n can change.'
		],
		n: bitN,
		examples: [
			{ label: 'clear bit 4 of 88', x: '88', n: 4 },
			{ label: 'clear bit 7 of −1', x: '-1', n: 7 }
		],
		trace: singleBit('clear')
	},
	{
		id: 'toggle-a-bit',
		name: 'Toggle bit n',
		category: 'single',
		code: () => 'x ^ (1u << n)',
		what: 'Flip bit n: a 0 becomes 1 and a 1 becomes 0.',
		why: [
			'XOR with 1 inverts a bit and XOR with 0 leaves it alone. Applying the same toggle twice gets x back, which is what makes XOR useful for flags and for the swap trick further down.'
		],
		n: bitN,
		examples: [
			{ label: 'toggle bit 6 of 88', x: '88', n: 6 },
			{ label: 'toggle bit 3 of 88', x: '88', n: 3 }
		],
		trace: singleBit('toggle')
	},
	{
		id: 'clear-lowest-set-bit',
		name: 'Clear the lowest set bit',
		category: 'lowest',
		code: () => 'x & (x - 1)',
		what: 'Turn off the rightmost 1 and keep everything above it.',
		why: [
			'Subtracting 1 borrows from the lowest 1: that bit becomes 0 and every 0 below it becomes 1, while the bits above it do not change. So x and x − 1 agree above the lowest 1 and are opposite at and below it.',
			'AND keeps the agreeing bits and zeroes the rest, which removes exactly the lowest 1. For x = 0 the result is 0.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '160: five 0s below', x: '0b10100000' },
			{ label: '1: only bit 0', x: '1' },
			{ label: '0: no set bit', x: '0' }
		],
		trace: ({ x, w }) => {
			const m1 = sub(x, 1, w);
			const r = and(x, m1, w);
			const low = lowestSet(x);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{
						expr: 'x - 1',
						note: x ? `the 1 at bit ${low} becomes 0, the 0s below it become 1s` : 'wraps round to all ones',
						value: m1,
						role: 'step',
						base: 0
					},
					{ expr: 'x & (x - 1)', note: 'AND keeps only the bits the two agree on', value: r, role: 'result', base: 0 }
				],
				result: { kind: 'bits', value: r },
				summary: x ? `The lowest set bit, bit ${low}, is cleared.` : 'x has no set bits, so the result is 0.'
			};
		}
	},
	{
		id: 'isolate-lowest-set-bit',
		name: 'Isolate the lowest set bit',
		category: 'lowest',
		code: () => 'x & -x',
		what: 'Keep only the rightmost 1.',
		why: [
			"In two's complement −x is ~x + 1. Inverting x turns its trailing 0s into 1s and its lowest 1 into a 0; adding 1 carries through those 1s and stops at that 0, setting it. So −x matches x at the lowest 1 and below it, and is the inverse of x above it.",
			'AND therefore leaves only the lowest 1. It works on an unsigned type too: the negation wraps round the same way. For x = 0 the result is 0.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '160: five 0s below', x: '0b10100000' },
			{ label: '255: bit 0 is set', x: '255' }
		],
		trace: ({ x, w }) => {
			const inv = not(x, w);
			const neg = add(inv, 1, w);
			const r = and(x, neg, w);
			const low = lowestSet(x);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: '~x', note: 'every bit inverted', value: inv, role: 'step', base: 0 },
					{ expr: '-x', note: 'that is ~x + 1: the carry runs up to the lowest 1', value: neg, role: 'step', base: 1 },
					{ expr: 'x & -x', note: 'only the lowest 1 is in both', value: r, role: 'result', base: 0 }
				],
				result: { kind: 'bits', value: r },
				summary: x
					? `Only bit ${low} is left: ${r} is the largest power of two that divides x.`
					: 'x is 0, so there is no lowest set bit and the result is 0.'
			};
		}
	},
	{
		id: 'is-power-of-two',
		name: 'Is x a power of two?',
		category: 'lowest',
		code: () => 'x != 0 && (x & (x - 1)) == 0',
		what: 'True for 1, 2, 4, 8 and so on, false for anything else.',
		why: [
			'A power of two has exactly one bit set. Clearing the lowest set bit with x & (x − 1) leaves 0 only if there was no other set bit.',
			'0 also gives 0 from x & (x − 1), which is why the x != 0 test is needed.'
		],
		examples: [
			{ label: '64: yes', x: '64' },
			{ label: '88: three bits set', x: '88' },
			{ label: '0: the special case', x: '0' },
			{ label: '0x80: the top bit', x: '0x80' }
		],
		trace: ({ x, w }) => {
			const m1 = sub(x, 1, w);
			const r = and(x, m1, w);
			const yes = x !== 0 && r === 0;
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{
						expr: 'x - 1',
						note: x ? 'the lowest 1 becomes 0, the bits below it 1' : 'wraps round to all ones',
						value: m1,
						role: 'step',
						base: 0
					},
					{ expr: 'x & (x - 1)', note: 'x with its lowest set bit cleared', value: r, role: 'result', base: 0 }
				],
				result: { kind: 'bool', value: yes },
				summary: yes
					? `True: x & (x − 1) is 0 and x is not, so x = ${x} = 2${superscript(lowestSet(x))}.`
					: x === 0
					? 'False: x & (x − 1) is 0, but x itself is 0, which is not a power of two.'
					: `False: x has ${plural(popcount(x), 'set bit')}, so clearing one leaves something behind.`
			};
		}
	},
	{
		id: 'count-trailing-zeros',
		name: 'Count trailing zeros',
		category: 'lowest',
		code: (w) => (w === 32 ? '__builtin_popcount((x & -x) - 1)' : `__builtin_popcount((${uintT(w)})((x & -x) - 1))`),
		what: 'How many 0s sit below the lowest 1, which is also the index of the lowest set bit.',
		why: [
			'x & −x isolates the lowest set bit. Subtracting 1 turns that single 1 into 0 and every 0 below it into a 1, so the result has exactly as many 1s as x has trailing zeros. Counting them gives the answer.',
			'For x = 0 this gives the width, because 0 − 1 is all ones at the width. At 8 and 16 bits C needs the cast back to the width for that: x & −x is worked out in int, so without the cast 0 − 1 is a 32-bit −1 and the count comes out as 32. GCC and Clang have __builtin_ctz, which compiles to a hardware instruction where the processor has one, but its result for 0 is undefined; C23 adds stdc_trailing_zeros, which returns the width for 0.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '1: none', x: '1' },
			{ label: '0x80: the top bit', x: '0x80' },
			{ label: '0: all zeros', x: '0' }
		],
		trace: ({ x, w }) => {
			const iso = and(x, neg(x, w), w);
			const below = sub(iso, 1, w);
			const r = popcount(below);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'x & -x', note: 'the lowest set bit on its own', value: iso, role: 'step', base: 0 },
					{
						expr: '(x & -x) - 1',
						note: 'ones exactly where x has trailing zeros',
						value: below,
						role: 'result',
						base: 1
					}
				],
				result: { kind: 'count', value: r, unit: 'trailing zero' },
				summary: x
					? `${plural(r, 'trailing zero')}: the lowest set bit is bit ${r}.`
					: `x is 0, so all ${w} bits are trailing zeros and the count is ${w}.`
			};
		}
	},
	{
		id: 'count-set-bits-kernighan',
		name: "Count set bits (Kernighan's loop)",
		category: 'count',
		code: () => 'for (c = 0; x; c++) x &= x - 1;',
		what: 'Count the 1 bits by clearing them one at a time.',
		why: [
			'Each pass of x &= x − 1 clears the lowest set bit, so the loop runs once per 1 in x and stops when none are left. A number with three set bits takes three passes, whatever its width.',
			'It is often credited to Brian Kernighan because The C Programming Language uses it in an exercise; Peter Wegner published it in 1960. It is fastest when few bits are set; the SWAR version below takes the same number of steps for every value.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '255: eight passes', x: '255' },
			{ label: '0x81: two passes', x: '0x81' },
			{ label: '0: no passes', x: '0' }
		],
		trace: ({ x, w }) => {
			// One row per pass, compared with the pass before, so the single bit each
			// pass clears is the one marked. The x - 1 inside a pass is the clear the
			// lowest set bit trick, traced on its own above.
			const rows: Row[] = [{ expr: 'x', value: x, role: 'input' }];
			let v = x;
			let c = 0;
			while (v) {
				const cleared = lowestSet(v);
				v = and(v, sub(v, 1, w), w);
				c++;
				rows.push({
					expr: 'x &= x - 1',
					note: `pass ${c} clears bit ${cleared}; c = ${c}`,
					value: v,
					role: v ? 'step' : 'result',
					base: rows.length - 1
				});
			}
			if (!c) rows[0] = { ...rows[0], note: 'already 0: the loop never runs' };
			return {
				rows,
				result: { kind: 'count', value: c, unit: 'set bit' },
				summary: `${plural(c, 'set bit')}, found in ${plural(c, 'pass', 'passes')} of the loop.`
			};
		}
	},
	{
		id: 'count-set-bits-swar',
		name: 'Count set bits (SWAR)',
		category: 'count',
		code: (w) => {
			const [m55, m33, m0f] = [1, 2, 4].map((s) => hx(alternatingMask(s, w), w));
			return [
				`x = x - ((x >> 1) & ${m55});`,
				`x = (x & ${m33}) + ((x >> 2) & ${m33});`,
				`x = (x + (x >> 4)) & ${m0f};`,
				w === 8 ? '/* x is now the count */' : `x = ${swarProduct(w)} >> ${w - 8};`
			].join('\n');
		},
		what: 'Count the 1 bits in a fixed number of steps, adding neighbouring fields in parallel.',
		why: [
			'SWAR means SIMD within a register: the number is treated as many small fields, and one subtraction or addition works on all of them at once. After the first line each 2-bit field holds the number of 1s that were in it (a pair ab is worth 2a + b, and subtracting a leaves a + b). The second line adds neighbouring pairs into 4-bit counts, the third adds nibbles into byte counts.',
			'At 16 and 32 bits one more line adds the bytes together: the multiply by 0x0101 (0x01010101 at 32 bits) adds every byte into the top byte, and the shift brings that sum down. Nothing carries between fields because no count can outgrow its field: a 4-bit field holds at most 4, a byte at most 8.',
			'At 16 bits the product has to be cut back to 16 bits before the shift. C multiplies a uint16_t as an int, so without the (uint16_t) cast the byte that lands above bit 15 survives and the shift brings it down as well: 0xFFFF would count as 2064 instead of 16.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '255', x: '255' },
			{ label: '0xB6', x: '0xB6' }
		],
		trace: ({ x, w }) => {
			const m55 = alternatingMask(1, w);
			const m33 = alternatingMask(2, w);
			const m0f = alternatingMask(4, w);
			const a = sub(x, and(shr(x, 1), m55, w), w);
			const b = add(and(a, m33, w), and(shr(a, 2), m33, w), w);
			const c = and(add(b, shr(b, 4), w), m0f, w);
			// Each step's x is the row before it, as in the C, where x is reassigned.
			const rows: Row[] = [
				{ expr: 'x', value: x, role: 'input', group: 2 },
				{
					expr: `(x >> 1) & ${hx(m55, w)}`,
					note: 'the high bit of each pair, moved down',
					value: and(shr(x, 1), m55, w),
					role: 'mask',
					group: 2
				},
				{
					expr: `x - ((x >> 1) & ${hx(m55, w)})`,
					note: 'each 2-bit field now counts its own 1s',
					value: a,
					role: 'step',
					base: 0,
					group: 2
				},
				{
					expr: `(x & ${hx(m33, w)}) + ((x >> 2) & ${hx(m33, w)})`,
					note: 'add neighbouring pairs: 4-bit counts',
					value: b,
					role: 'step',
					base: 2,
					group: 4
				},
				{
					expr: `(x + (x >> 4)) & ${hx(m0f, w)}`,
					note: 'add neighbouring nibbles: one count per byte',
					value: c,
					role: w === 8 ? 'result' : 'step',
					base: 3,
					group: 8
				}
			];
			let r = c;
			if (w > 8) {
				const p = mul(c, w === 16 ? 0x0101 : 0x01010101, w);
				rows.push({
					expr: swarProduct(w),
					note: 'the top byte is now the sum of every byte',
					value: p,
					role: 'step',
					base: 4,
					group: 8
				});
				r = shr(p, w - 8);
				rows.push({
					expr: `${swarProduct(w)} >> ${w - 8}`,
					note: 'bring the top byte down',
					value: r,
					role: 'result',
					base: 5,
					group: 8
				});
			}
			return {
				rows,
				result: { kind: 'count', value: r, unit: 'set bit' },
				summary: `${plural(r, 'set bit')}, in ${w === 8 ? 3 : 5} steps whatever the value.`
			};
		}
	},
	{
		id: 'parity',
		name: 'Parity',
		category: 'count',
		code: (w) =>
			[
				...halvings(w)
					.reverse()
					.map((s) => `x ^= x >> ${s};`),
				'parity = x & 1;'
			].join('\n'),
		what: 'Is the number of 1 bits odd? 1 for odd, 0 for even.',
		why: [
			'XOR of two bits is 1 when exactly one of them is 1, so the XOR of a set of bits is the parity of that set. Folding the top half onto the bottom half with x ^= x >> (width / 2) keeps the parity of the whole in the bottom half; halving again and again leaves it in bit 0.',
			'Parity is the idea behind a parity bit on a serial line or a memory word: one extra bit chosen so the total number of 1s is even, which catches any single flipped bit.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '0x81', x: '0x81' },
			{ label: '7', x: '7' }
		],
		trace: ({ x, w }) => {
			const rows: Row[] = [{ expr: 'x', value: x, role: 'input' }];
			let v = x;
			for (const s of halvings(w).reverse()) {
				const prev = rows.length - 1;
				v = xor(v, shr(v, s), w);
				rows.push({
					expr: `x ^= x >> ${s}`,
					note: `the low ${s} bit${s === 1 ? '' : 's'} now carry the parity`,
					value: v,
					role: 'step',
					base: prev,
					group: s >= 4 ? s : 4
				});
			}
			const r = v & 1;
			rows.push({ expr: 'x & 1', note: 'bit 0 is the answer', value: r, role: 'result' });
			const c = popcount(x);
			return {
				rows,
				result: { kind: 'count', value: r, unit: 'parity' },
				summary: `Parity ${r}: x has ${plural(c, 'set bit')}, an ${c % 2 ? 'odd' : 'even'} number.`
			};
		}
	},
	{
		id: 'xor-swap',
		name: 'XOR swap',
		category: 'arith',
		code: () => 'x ^= y;\ny ^= x;\nx ^= y;',
		what: 'Swap two variables without a temporary.',
		why: [
			'XOR is its own inverse: (a ^ b) ^ b = a. After the first line x holds x ^ y. The second line computes y ^ (x ^ y), which is the original x. The third computes (x ^ y) ^ x, which is the original y.',
			'It is a curiosity rather than an optimisation: compilers swap through a register, which is as fast or faster, and the three XORs depend on each other so they cannot run in parallel. It also fails when both names refer to the same variable: the first XOR sets it to 0 and the value is lost.'
		],
		y: 'y',
		examples: [
			{ label: '88 and 54', x: '88', y: '54' },
			{ label: 'equal values', x: '7', y: '7' },
			{ label: '0 and 255', x: '0', y: '255' }
		],
		trace: ({ x, y, w }) => {
			const x1 = xor(x, y, w);
			const y1 = xor(y, x1, w);
			const x2 = xor(x1, y1, w);
			const a1 = xor(x, x, w);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'y', value: y, role: 'input' },
					{ expr: 'x ^= y', note: 'x holds x ^ y: a 1 wherever they differed', value: x1, role: 'step', base: 0 },
					{ expr: 'y ^= x', note: 'y ^ (x ^ y) is the old x', value: y1, role: 'step', base: 1 },
					{ expr: 'x ^= y', note: '(x ^ y) ^ old x is the old y', value: x2, role: 'result', base: 0 }
				],
				result: { kind: 'pair', value: [x2, y1], names: ['x', 'y'] },
				summary: `Swapped: x is now ${x2} and y is ${y1}.`,
				aside: {
					title: 'The aliasing trap: swapping a variable with itself',
					text: `A swap function written like this breaks when a and b point at the same variable, which a sort can do when it swaps an element with itself. The first line computes x ^ x, which is 0, and from then on every line is 0 ^ 0. The value is lost. Equal values in two different variables are fine; the problem is one variable under two names. A temporary variable has no such trap.`,
					code: 'void swap(int *a, int *b) {\n    *a ^= *b;\n    *b ^= *a;\n    *a ^= *b;\n}',
					rows: [
						{ expr: '*a (and *b)', value: x, role: 'input' },
						{ expr: '*a ^= *b', note: 'x ^ x is 0, and *b is the same variable', value: a1, role: 'step', base: 0 },
						{ expr: '*b ^= *a', note: '0 ^ 0', value: a1, role: 'step', base: 0 },
						{ expr: '*a ^= *b', note: 'still 0: the value is gone', value: a1, role: 'result', base: 0 }
					]
				}
			};
		}
	},
	{
		id: 'opposite-signs',
		name: 'Do x and y have opposite signs?',
		category: 'arith',
		code: () => '(x ^ y) < 0',
		what: 'True when one is negative and the other is not.',
		why: [
			"In two's complement the top bit is the sign: 1 for negative, 0 for zero or positive. XOR of the two top bits is 1 exactly when they differ, and a 1 in the top bit makes the result negative. So one XOR and one sign test replace (x < 0) != (y < 0).",
			'Zero counts as non-negative here, so 0 and 5 do not have opposite signs, and 0 and −5 do.'
		],
		y: 'y',
		signedView: true,
		examples: [
			{ label: '88 and −42', x: '88', y: '-42' },
			{ label: '88 and 54', x: '88', y: '54' },
			{ label: '−1 and −128', x: '-1', y: '-128' },
			{ label: '0 and −5', x: '0', y: '-5' }
		],
		trace: ({ x, y, w }) => {
			const r = xor(x, y, w);
			const yes = r >= 2 ** (w - 1);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'y', value: y, role: 'input' },
					{
						expr: 'x ^ y',
						note: `top bit is ${yes ? 1 : 0}: the signs ${yes ? 'differ' : 'match'}`,
						value: r,
						role: 'result'
					}
				],
				result: { kind: 'bool', value: yes },
				summary: `${yes ? 'True' : 'False'}: x is ${signed(x, w) < 0 ? 'negative' : 'not negative'} and y is ${
					signed(y, w) < 0 ? 'negative' : 'not negative'
				}.`
			};
		}
	},
	{
		id: 'branchless-abs',
		name: 'Absolute value without a branch',
		category: 'arith',
		code: (w) => `${intT(w)} m = x >> ${w - 1};\n(x + m) ^ m`,
		what: '|x| using a shift, an add and an XOR, with no if.',
		why: [
			'Shifting a signed value right by width − 1 copies the sign bit into every position: m is all ones (−1) for a negative x and 0 otherwise. For x ≥ 0, (x + 0) ^ 0 is x. For x < 0, x + m is x − 1, and XOR with all ones inverts it, and ~(x − 1) = −x.',
			'It relies on the right shift being arithmetic, which C leaves to the implementation for negative values (GCC and Clang do shift arithmetically). The most negative value has no positive partner. At 8 bits C works out (x + m) ^ m in int, where −128 gives 128; stored back in an int8_t that is the pattern 1000 0000, which reads as −128 again. At 32 bits it is worse: for INT_MIN the x + m itself overflows, which is undefined behaviour, just as abs(INT_MIN) is.'
		],
		signedView: true,
		examples: [
			{ label: '−42', x: '-42' },
			{ label: '42', x: '42' },
			{ label: '−128', x: '-128' },
			{ label: '−1', x: '-1' }
		],
		trace: ({ x, w }) => {
			const m = sar(x, w - 1, w);
			const s = add(x, m, w);
			const r = xor(s, m, w);
			const sx = signed(x, w);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{
						expr: `m = x >> ${w - 1}`,
						note: m ? 'x is negative: m is all ones (−1)' : 'x is not negative: m is 0',
						value: m,
						role: 'mask'
					},
					{ expr: 'x + m', note: m ? 'that is x − 1' : 'adding 0 changes nothing', value: s, role: 'step', base: 0 },
					{
						expr: '(x + m) ^ m',
						note: m ? 'inverting x − 1 gives −x' : 'XOR with 0 changes nothing',
						value: r,
						role: 'result',
						base: 0
					}
				],
				result: { kind: 'bits', value: r },
				summary:
					sx !== -(2 ** (w - 1))
						? `|${dec(sx)}| = ${signed(r, w)}.`
						: w === 32
						? `|${dec(sx)}| does not fit in 32 signed bits. The pattern comes back as ${dec(
								signed(r, w)
						  )}, but in C the x + m step overflows here, which is undefined behaviour.`
						: `|${dec(sx)}| does not fit in ${w} signed bits: (x + m) ^ m is ${-sx}, which stored back in an ${intT(
								w
						  )} reads as ${dec(signed(r, w))} again.`
			};
		}
	},
	{
		id: 'branchless-min-max',
		name: 'Minimum and maximum without a branch',
		category: 'arith',
		code: () => 'min = y ^ ((x ^ y) & -(x < y));\nmax = x ^ ((x ^ y) & -(x < y));',
		what: 'The smaller and the larger of two signed integers, selected with a mask instead of an if.',
		why: [
			'x < y is 1 or 0 in C, so −(x < y) is either all ones or all zeros: a mask that selects. When it is all ones, (x ^ y) & mask is x ^ y, and y ^ (x ^ y) = x; when it is 0, y ^ 0 = y. So min is x exactly when x < y.',
			'This version compares instead of subtracting, so it cannot overflow. Modern compilers often turn the plain if into a conditional move anyway, so measure before using it.'
		],
		y: 'y',
		signedView: true,
		examples: [
			{ label: '88 and −42', x: '88', y: '-42' },
			{ label: '−42 and 88', x: '-42', y: '88' },
			{ label: 'equal', x: '5', y: '5' }
		],
		trace: ({ x, y, w }) => {
			const lt = signed(x, w) < signed(y, w);
			const mask = lt ? maskOf(w) : 0;
			const d = xor(x, y, w);
			const sel = and(d, mask, w);
			const mn = xor(y, sel, w);
			const mx = xor(x, sel, w);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'y', value: y, role: 'input' },
					{
						expr: '-(x < y)',
						note: `x < y is ${lt ? 1 : 0}, so the mask is ${lt ? 'all ones' : '0'}`,
						value: mask,
						role: 'mask'
					},
					{ expr: 'x ^ y', note: 'the bits where they differ', value: d, role: 'step' },
					{
						expr: '(x ^ y) & -(x < y)',
						note: lt ? 'kept: the mask is all ones' : 'wiped: the mask is 0',
						value: sel,
						role: 'step',
						base: 3
					},
					{
						expr: 'min = y ^ ((x ^ y) & -(x < y))',
						note: lt ? 'y ^ (x ^ y) is x' : 'y ^ 0 is y',
						value: mn,
						role: 'result',
						base: 1
					},
					{
						expr: 'max = x ^ ((x ^ y) & -(x < y))',
						note: lt ? 'x ^ (x ^ y) is y' : 'x ^ 0 is x',
						value: mx,
						role: 'result',
						base: 0
					}
				],
				result: { kind: 'pair', value: [mn, mx], names: ['min', 'max'] },
				summary: `min is ${dec(signed(mn, w))} and max is ${dec(signed(mx, w))}.`
			};
		}
	},
	{
		id: 'average-without-overflow',
		name: 'Average without overflow',
		category: 'arith',
		code: () => '(x & y) + ((x ^ y) >> 1)',
		what: 'The average of two unsigned integers, rounded down, without x + y overflowing.',
		why: [
			'Addition splits into the carries and the sum without carries: x + y = 2(x & y) + (x ^ y). The bits in both numbers are counted twice and the bits in exactly one are counted once. Halving each part separately gives (x & y) + ((x ^ y) >> 1), and no intermediate value is larger than the result.',
			'The obvious (x + y) / 2 fails as soon as x + y no longer fits: the carry out of the top bit is lost before the division. A real case was a binary search midpoint, (low + high) / 2, which Joshua Bloch reported in 2006 as a bug in Java’s Arrays.binarySearch for arrays of more than about a billion elements.'
		],
		y: 'y',
		examples: [
			{ label: '200 and 100', x: '200', y: '100' },
			{ label: '255 and 253', x: '255', y: '253' },
			{ label: '7 and 4', x: '7', y: '4' }
		],
		trace: ({ x, y, w }) => {
			const both = and(x, y, w);
			const one = xor(x, y, w);
			const half = shr(one, 1);
			const r = add(both, half, w);
			const naive = add(x, y, w);
			const naiveHalf = shr(naive, 1);
			const overflow = x + y > maskOf(w);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'y', value: y, role: 'input' },
					{ expr: 'x & y', note: 'bits in both: half of their weight in the sum', value: both, role: 'step' },
					{ expr: 'x ^ y', note: 'bits in exactly one', value: one, role: 'step' },
					{ expr: '(x ^ y) >> 1', note: 'halved', value: half, role: 'step', base: 3 },
					{ expr: '(x & y) + ((x ^ y) >> 1)', note: 'the average, rounded down', value: r, role: 'result' }
				],
				result: { kind: 'bits', value: r },
				summary: `The average of ${x} and ${y} is ${r}${(x + y) % 2 ? ` (${(x + y) / 2} rounded down)` : ''}.`,
				aside: {
					title: 'The naive (x + y) >> 1, for comparison',
					text: overflow
						? `x + y = ${x + y}, which needs ${w + 1} bits. The carry out of bit ${
								w - 1
						  } is lost, the sum wraps round to ${naive}, and halving that gives ${naiveHalf} instead of ${r}.`
						: `Here x + y = ${
								x + y
						  } still fits in ${w} bits, so the naive version also gives ${naiveHalf}. Try 200 and 100 at 8 bits to see it overflow.`,
					rows: [
						{
							expr: 'x + y',
							note: overflow ? `the carry out of the top bit is lost` : 'fits',
							value: naive,
							role: 'step'
						},
						{ expr: '(x + y) >> 1', note: overflow ? 'wrong' : 'right this time', value: naiveHalf, role: 'result' }
					]
				}
			};
		}
	},
	{
		id: 'modulo-power-of-two',
		name: 'Modulo a power of two',
		category: 'arith',
		code: () => '/* x % n, for n a power of two */\nx & (n - 1)',
		what: 'The remainder of x divided by n, for an unsigned x and a power of two n, with an AND instead of a division.',
		why: [
			'Dividing by 2^k shifts the bits right by k places, and the remainder is the k bits that fall off the end. n − 1 is a mask of exactly those k low bits (8 − 1 = 0b111), so AND keeps the remainder and drops the quotient.',
			'It only works when n is a power of two; for any other n, n − 1 is not a block of low ones. For a negative signed x it gives a different answer from C’s %, which rounds towards zero and keeps the sign: −7 % 8 is −7, while −7 & 7 is 1. Java’s HashMap keeps its table size a power of two and picks a bucket with (n − 1) & hash.'
		],
		y: 'n',
		examples: [
			{ label: '93 mod 8', x: '93', y: '8' },
			{ label: '200 mod 64', x: '200', y: '64' },
			{ label: '88 mod 6 (not a power)', x: '88', y: '6' }
		],
		trace: ({ x, y, w }) => {
			const m1 = sub(y, 1, w);
			const r = and(x, m1, w);
			const pow = y !== 0 && and(y, m1, w) === 0;
			const k = lowestSet(y);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'n', value: y, role: 'input' },
					{
						expr: 'n - 1',
						note: pow ? `the low ${k} bit${k === 1 ? '' : 's'} set: the remainder mask` : 'not a block of low ones',
						value: m1,
						role: 'mask'
					},
					{
						expr: 'x & (n - 1)',
						note: pow ? 'the bits that a division would drop' : 'not the remainder',
						value: r,
						role: 'result',
						base: 0
					}
				],
				result: { kind: 'bits', value: r },
				summary: pow ? `${x} mod ${y} = ${r}.` : `x & (n − 1) = ${r}, which is not ${x} mod ${y}.`,
				warning: pow
					? undefined
					: y === 0
					? 'n is 0, so n − 1 is all ones and the AND returns x unchanged; x % 0 is undefined.'
					: `${y} is not a power of two, so the trick does not apply: ${x} % ${y} is ${
							x % y
					  }, but x & (n − 1) gives ${r}.`
			};
		}
	},
	{
		id: 'round-up-to-power-of-two',
		name: 'Round up to the next power of two',
		category: 'shuffle',
		code: (w) => ['x--;', ...halvings(w).map((s) => `x |= x >> ${s};`), 'x++;'].join('\n'),
		what: 'The smallest power of two that is greater than or equal to x.',
		why: [
			'After x−−, OR-ing x with itself shifted right by 1, 2, 4 and so on copies its highest 1 into every position below it: each step doubles the length of the run of 1s, so log2(width) steps fill them all. The result is 2^k − 1, and adding 1 carries all the way up to 2^k.',
			'The decrement first is what makes an exact power of two come back unchanged: 64 − 1 = 63 fills to 63 and rounds up to 64. Two edge cases come from wrapping: x = 0 gives 0 rather than 1 (0 − 1 is all ones, and +1 wraps back to 0), and a value above the largest power of two that fits also wraps to 0.'
		],
		examples: [
			{ label: '88', x: '88' },
			{ label: '64', x: '64' },
			{ label: '5', x: '5' },
			{ label: '200 at 8 bits: too big', x: '200', w: 8 }
		],
		trace: ({ x, w }) => {
			let v = sub(x, 1, w);
			const rows: Row[] = [
				{ expr: 'x', value: x, role: 'input' },
				{
					expr: 'x--',
					note: x ? 'so an exact power of two stays put' : 'wraps round to all ones',
					value: v,
					role: 'step',
					base: 0
				}
			];
			for (const s of halvings(w)) {
				const prev = rows.length - 1;
				v = or(v, shr(v, s), w);
				rows.push({
					expr: `x |= x >> ${s}`,
					note: `the top 1 is copied ${s} more place${s === 1 ? '' : 's'} down`,
					value: v,
					role: 'step',
					base: prev
				});
			}
			const r = add(v, 1, w);
			rows.push({
				expr: 'x++',
				note: 'all ones below a bit, plus 1, carries into it',
				value: r,
				role: 'result',
				base: rows.length - 1
			});
			const top = 2 ** (w - 1);
			return {
				rows,
				result: { kind: 'bits', value: r },
				summary:
					x === 0
						? 'x is 0. The true answer is 1 (2⁰), but the trick gives 0: 0 − 1 wraps round to all ones, and + 1 wraps back to 0.'
						: x > top
						? `${x} is above ${top}, the largest power of two in ${w} bits, so the result wraps round to 0.`
						: r === x
						? `${x} is already a power of two, so it comes back unchanged.`
						: `The next power of two above ${x} is ${r} = 2${superscript(lowestSet(r))}.`
			};
		}
	},
	{
		id: 'reverse-bits',
		name: 'Reverse the bits',
		category: 'shuffle',
		code: (w) =>
			halvings(w)
				.map((s) => {
					const m = hx(alternatingMask(s, w), w);
					return `x = ((x >> ${s}) & ${m}) | ((x & ${m}) << ${s});`;
				})
				.join('\n'),
		what: 'Mirror the bit order, so bit 0 swaps with the top bit, bit 1 with the one below it, and so on.',
		why: [
			'Swap neighbouring bits, then neighbouring pairs, then nibbles, then bytes, until the two halves swap. Each line uses a mask that picks the lower field of every pair of fields: shifting right by s and masking moves the upper fields down, masking and shifting left moves the lower fields up, and OR puts them together.',
			'Reversing every level of a binary tree of fields reverses the whole, in log2(width) steps instead of one step per bit.'
		],
		examples: [
			{ label: '88', x: '0b01011000' },
			{ label: '1', x: '1' },
			{ label: '0xF0', x: '0xF0' }
		],
		trace: ({ x, w }) => {
			const rows: Row[] = [{ expr: 'x', value: x, role: 'input' }];
			let v = x;
			for (const s of halvings(w)) {
				const m = alternatingMask(s, w);
				v = or(and(shr(v, s), m, w), shl(and(v, m, w), s, w), w);
				rows.push({
					expr: `swap ${s === 1 ? 'single bits' : `${s}-bit fields`}`,
					note: `((x >> ${s}) & ${hx(m, w)}) | ((x & ${hx(m, w)}) << ${s})`,
					value: v,
					role: s * 2 === w ? 'result' : 'step',
					base: rows.length - 1,
					group: s * 2
				});
			}
			return {
				rows,
				result: { kind: 'bits', value: v },
				summary: `${groupedBits(x, w)} reversed is ${groupedBits(v, w)}.`
			};
		}
	},
	{
		id: 'binary-to-gray-code',
		name: 'Binary to Gray code',
		category: 'shuffle',
		code: () => 'x ^ (x >> 1)',
		what: 'The reflected binary Gray code of x, where counting up changes one bit at a time.',
		why: [
			'Each Gray code bit is the XOR of a binary bit and the bit above it, so it is 1 exactly where the binary number changes from one bit to the next. Shifting right by one lines every bit up with its upper neighbour, and one XOR does all the positions at once. The top bit is XORed with the 0 shifted in, so it stays as it is.',
			'Going back is not one step: each binary bit is the XOR of the Gray bit in the same position and every Gray bit above it, which takes a loop or a shift-and-XOR cascade like the parity trick.'
		],
		examples: [
			{ label: '88', x: '88' },
			{ label: '7', x: '7' },
			{ label: '8', x: '8' }
		],
		trace: ({ x, w }) => {
			const s = shr(x, 1);
			const r = xor(x, s, w);
			return {
				rows: [
					{ expr: 'x', value: x, role: 'input' },
					{ expr: 'x >> 1', note: 'every bit moved under its right-hand neighbour', value: s, role: 'step' },
					{
						expr: 'x ^ (x >> 1)',
						note: '1 wherever two neighbouring bits of x differ',
						value: r,
						role: 'result',
						base: 0
					}
				],
				result: { kind: 'bits', value: r },
				summary: `${x} in Gray code is ${groupedBits(r, w)}.`
			};
		}
	},
	{
		id: 'sign-extension',
		name: 'Sign-extend a k-bit value',
		category: 'shuffle',
		code: () => '/* x holds a k-bit field */\nm = 1u << (k - 1);\nr = (x ^ m) - m;',
		what: "Widen a k-bit two's complement number to the full width, keeping its value.",
		why: [
			'A k-bit field from a packet or a register is negative when its bit k − 1 is set, but in a wider variable that bit is just a positive weight of 2^(k−1). XOR with m flips that bit, which is the same as adding 2^(k−1) when it was 0 and subtracting it when it was 1; subtracting m then takes 2^(k−1) away. A positive field comes back unchanged and a negative one ends up 2^k lower, which is its signed value, with the sign copied into every bit above.',
			'The other common form shifts the field to the top and back: (int32_t)(x << (32 − k)) >> (32 − k). That relies on an arithmetic right shift; the XOR version only needs wrapping arithmetic, so it also works on unsigned types.'
		],
		n: { label: 'k bits', min: 1, max: (w) => w },
		signedView: true,
		examples: [
			{ label: '4-bit 1011', x: '0b1011', n: 4 },
			{ label: '4-bit 0101', x: '0b0101', n: 4 },
			{ label: '5-bit 10000', x: '0b10000', n: 5 }
		],
		trace: ({ x, n, w }) => {
			const fieldMask = n >= w ? maskOf(w) : sub(shl(1, n, w), 1, w);
			const v = and(x, fieldMask, w);
			const m = shl(1, n - 1, w);
			const t = xor(v, m, w);
			const r = sub(t, m, w);
			const rows: Row[] = [{ expr: 'x', value: x, role: 'input' }];
			if (v !== x)
				rows.push({
					expr: `x & ${hx(fieldMask, w)}`,
					note: `keep only the ${n}-bit field`,
					value: v,
					role: 'step',
					base: 0
				});
			rows.push(
				{ expr: `m = 1u << ${n - 1}`, note: `the field's sign bit`, value: m, role: 'mask' },
				{ expr: 'x ^ m', note: 'the sign bit flipped', value: t, role: 'step', base: rows.length - 1 },
				{
					expr: '(x ^ m) - m',
					note: v & m ? 'the borrow runs all the way up: the sign is copied' : 'the bit comes back: nothing changes',
					value: r,
					role: 'result',
					base: rows.length - 1
				}
			);
			return {
				rows,
				result: { kind: 'bits', value: r },
				summary: `The ${n}-bit field ${bitString(v, w).slice(w - n)} is ${dec(signed(r, w))} as a signed number.`,
				warning: v !== x ? `x has bits above bit ${n - 1}; only the low ${n} bits are the field.` : undefined
			};
		}
	},
	{
		id: 'ascii-case-toggle',
		name: 'Toggle ASCII letter case',
		category: 'shuffle',
		code: () => "c ^ 0x20   /* 'a' <-> 'A' */",
		what: 'Switch an ASCII letter between upper and lower case by flipping one bit.',
		why: [
			'ASCII puts the capitals at 0x41 to 0x5A and the small letters at 0x61 to 0x7A, exactly 0x20 apart, so the two cases of a letter differ only in bit 5. XOR with 0x20 flips it. c | 0x20 forces lower case and c & ~0x20 forces upper case.',
			'Only letters have a partner: the same flip turns [ into { and @ into a back-quote, so check the character is a letter first. It does not apply to accented letters in UTF-8.'
		],
		examples: [
			{ label: "'a'", x: "'a'" },
			{ label: "'Z'", x: "'Z'" },
			{ label: "'['", x: "'['" }
		],
		trace: ({ x, w }) => {
			const r = xor(x, 0x20, w);
			const from = asciiChar(x);
			const to = asciiChar(r);
			return {
				rows: [
					{ expr: 'c', note: from ? `'${from}'` : undefined, value: x, role: 'input' },
					{ expr: '0x20', note: 'only bit 5', value: 0x20, role: 'mask' },
					{ expr: 'c ^ 0x20', note: to ? `'${to}'` : undefined, value: r, role: 'result', base: 0 }
				],
				result: { kind: 'bits', value: r },
				summary: from && to ? `'${from}' becomes '${to}'.` : `${x} becomes ${r}.`,
				answer: to ? `'${to}' (${hx(r, w)}, ${r})` : undefined,
				warning: isLetter(x)
					? undefined
					: `${from ? `'${from}'` : x} is not an ASCII letter, so it has no other case; the flip ${
							to ? `turns it into '${to}'` : `gives ${r}`
					  }.`
			};
		}
	}
];

function neg(a: number, w: Width) {
	return sub(0, a, w);
}

const supers = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const superscript = (n: number): string =>
	String(n)
		.split('')
		.map((d) => supers[Number(d)])
		.join('');

export const trickById = (id: string): Trick | undefined => tricks.find((t) => t.id === id);

/** A trick that must exist, such as one named in the page's own code. */
export function getTrick(id: string): Trick {
	const t = trickById(id);
	if (!t) throw new Error(`No trick called ${id}`);
	return t;
}

/**
 * Runs a trick on typed inputs, checking each against the width and the
 * trick's own range for n. Throws a BitTrickError naming the field.
 */
export function runTrick(
	trick: Trick,
	text: { x: string; y: string; n: number },
	w: Width
): { inputs: Inputs; trace: Trace } {
	const x = parseOperand(text.x, w);
	let y = 0;
	if (trick.y) {
		try {
			y = parseOperand(text.y, w);
		} catch (e) {
			throw fieldError('y', `${trick.y}: ${(e as Error).message}`);
		}
	}
	const n = text.n;
	if (trick.n) {
		const max = trick.n.max(w);
		if (!Number.isInteger(n) || n < trick.n.min || n > max)
			throw fieldError('n', `${trick.n.label} must be a whole number from ${trick.n.min} to ${max} at ${w} bits.`);
	}
	const inputs = { x, y, n, w };
	return { inputs, trace: trick.trace(inputs) };
}

/** The result as text, for the answer box and the catalogue. */
export function resultText(r: Result, w: Width, signedView = false): string {
	switch (r.kind) {
		case 'bool':
			return r.value ? 'true' : 'false';
		case 'count':
			return String(r.value);
		case 'pair':
			return r.names.map((name, i) => `${name} = ${valueText(r.value[i], w, signedView)}`).join(', ');
		case 'bits':
			return valueText(r.value, w, signedView);
	}
}

/** A pattern as decimal, signed when the trick is about signed numbers. */
export const valueText = (v: number, w: Width, signedView = false): string =>
	signedView ? dec(signed(v, w)) : String(v);
