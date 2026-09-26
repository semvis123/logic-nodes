// Binary and hex arithmetic done the paper way, column by column.
//
// Every operation returns its working as data: the carries or borrows per
// column, the partial products, the long division steps, laid out on a grid
// of columns so a page can draw it aligned. The numbers are BigInt, so any
// length up to MAX_DIGITS works exactly, and the tests check every result
// against BigInt arithmetic and re-add the working to show it is consistent.

import {
	MAX_DIGITS,
	RadixError,
	digitChar,
	digitValue,
	parseRadix,
	radixNames,
	superscript,
	toRadix
} from './radix.js';

export type CalcRadix = 2 | 16;

export type Op = 'add' | 'sub' | 'mul' | 'div' | 'and' | 'or' | 'xor' | 'not' | 'shl' | 'shr';

export const ops: { id: Op; symbol: string; label: string; unary?: boolean; shift?: boolean }[] = [
	{ id: 'add', symbol: '+', label: 'Add' },
	{ id: 'sub', symbol: '−', label: 'Subtract' },
	{ id: 'mul', symbol: '×', label: 'Multiply' },
	{ id: 'div', symbol: '÷', label: 'Divide' },
	{ id: 'and', symbol: 'AND', label: 'AND' },
	{ id: 'or', symbol: 'OR', label: 'OR' },
	{ id: 'xor', symbol: 'XOR', label: 'XOR' },
	{ id: 'not', symbol: 'NOT', label: 'NOT', unary: true },
	{ id: 'shl', symbol: '<<', label: 'Shift left', shift: true },
	{ id: 'shr', symbol: '>>', label: 'Shift right', shift: true }
];

/** Fixed widths on offer, in bits. null means as wide as the numbers need. */
export const calcWidths = [8, 16, 32, 64] as const;

/** The largest shift accepted, in bits. */
export const MAX_SHIFT = 256;

export class CalcError extends Error {}

export type Tone = 'carry' | 'borrow' | 'dim' | 'result' | 'overflow' | 'one' | 'zero';

export type Cell = { text: string; tone?: Tone } | null;

export type LayoutRow = {
	/** What stands to the left of the row: an operator, or nothing. */
	sign: string;
	kind: 'carry' | 'borrow' | 'operand' | 'partial' | 'result';
	/** A short name for screen readers and the row's title. */
	label: string;
	cells: Cell[];
	/** Draw a rule above this row. */
	rule?: boolean;
};

/**
 * Rows of cells, right aligned on a shared set of columns. `groupEvery` asks
 * for a little space every so many columns from the right, which is how long
 * binary is read (in nibbles).
 */
export type Layout = { columns: number; rows: LayoutRow[]; groupEvery?: number };

export type DivisionStep = {
	/** The digit brought down from the dividend. */
	brought: string;
	/** The remainder so far, with that digit appended. */
	current: bigint;
	/** How many times the divisor goes into it: one digit of the quotient. */
	digit: number;
	/** digit × divisor, taken away from current. */
	product: bigint;
	remainder: bigint;
};

export type Calculation = {
	op: Op;
	radix: CalcRadix;
	/** The width in bits, or null for unlimited. */
	width: number | null;
	a: bigint;
	b: bigint;
	/** The answer as a number: negative for a − b with a < b in unlimited width. */
	result: bigint;
	/** Division only. */
	remainder?: bigint;
	/** The answer written in the calculator's base, with a minus sign when negative. */
	resultText: string;
	/** Unsigned overflow: something did not fit in the width and was dropped. */
	overflow: boolean;
	/** A borrow came out of the top column in fixed width: the pattern is a two's complement negative. */
	wrappedNegative: boolean;
	/**
	 * Fixed-width subtraction only: the result bits read as a signed (two's
	 * complement) number. It equals a − b unless the true difference is below
	 * the smallest signed value the width holds.
	 */
	signedResult?: bigint;
	layout: Layout;
	/** Describes the layout when it is not simply a op b. */
	layoutTitle?: string;
	/** One line per column or step, in the order they are worked. */
	explanation: string[];
	division?: DivisionStep[];
	notes: string[];
};

const bitsPer = (radix: CalcRadix) => (radix === 16 ? 4 : 1);

/** The digits to show for a value: at least `pad` of them, zero filled. */
const digitsOf = (value: bigint, radix: CalcRadix, pad = 1) => toRadix(value, radix).padStart(pad, '0');

/** A BigInt in decimal with a typographic minus sign. */
export const signedDecimal = (n: bigint) => n.toString().replace(/^-/, '−');

/** A pattern of `width` bits read as a two's complement signed number. */
export const toSigned = (pattern: bigint, width: number) =>
	pattern >= 1n << BigInt(width - 1) ? pattern - (1n << BigInt(width)) : pattern;

/** A string placed at the right of `columns` cells, the rest empty. */
function rightAlign(text: string, columns: number, tone?: Tone): Cell[] {
	const cells: Cell[] = Array(columns).fill(null);
	const chars = [...text];
	chars.forEach((ch, i) => (cells[columns - chars.length + i] = { text: ch, tone }));
	return cells;
}

/** How a column is named in the explanation: its position and place value. */
function columnName(i: number, radix: CalcRadix) {
	return `Column ${i + 1} (${radix}${superscript(i)})`;
}

/** A digit's value spelled out for hex, where A to F need translating. */
const hexValue = (ch: string, radix: CalcRadix) =>
	radix === 16 && digitValue(ch) > 9 ? `${ch} (${digitValue(ch)})` : ch;

/**
 * Reads an operand. Values that will not fit a fixed width are an error rather
 * than being quietly wrapped, since the person typed them on purpose.
 */
export function parseOperand(text: string, radix: CalcRadix, width: number | null, name = 'That number'): bigint {
	let parsed;
	try {
		parsed = parseRadix(text, radix);
	} catch (e) {
		throw new CalcError(
			e instanceof RadixError ? `${name}: ${e.message[0].toLowerCase()}${e.message.slice(1)}` : String(e)
		);
	}
	if (width !== null && parsed.value >= 1n << BigInt(width)) {
		throw new CalcError(`${name} needs ${parsed.value.toString(2).length} bits, more than the ${width} chosen`);
	}
	return parsed.value;
}

/** Reads a shift distance, which is always written in decimal. */
export function parseShift(text: string): number {
	const s = text.trim();
	if (!/^\d+$/.test(s)) throw new CalcError('The shift is a count of places, written in decimal, such as 3');
	const n = Number(s);
	if (n > MAX_SHIFT) throw new CalcError(`Shift by at most ${MAX_SHIFT} places`);
	return n;
}

// --- Addition ---------------------------------------------------------------

export function add(a: bigint, b: bigint, radix: CalcRadix, width: number | null = null): Calculation {
	const r = BigInt(radix);
	const aText = toRadix(a, radix);
	const bText = toRadix(b, radix);
	const n = width !== null ? width / bitsPer(radix) : Math.max(aText.length, bText.length);
	const aDigits = aText.padStart(n, '0');
	const bDigits = bText.padStart(n, '0');

	const carries: number[] = Array(n + 1).fill(0);
	const sumDigits: string[] = [];
	const explanation: string[] = [];
	for (let i = 0; i < n; i++) {
		const da = aDigits[n - 1 - i];
		const db = bDigits[n - 1 - i];
		const carryIn = carries[i];
		const total = digitValue(da) + digitValue(db) + carryIn;
		const digit = total % radix;
		carries[i + 1] = total >= radix ? 1 : 0;
		sumDigits.unshift(digitChar(digit));
		const terms = `${hexValue(da, radix)} + ${hexValue(db, radix)}${carryIn ? ' + 1 carried' : ''}`;
		const sumText =
			radix === 2
				? `${total.toString(2)}`
				: total >= 10
				? `${total}, which is ${total.toString(16).toUpperCase()} in hex`
				: `${total}`;
		explanation.push(
			`${columnName(i, radix)}: ${terms} = ${sumText}. Write ${digitChar(digit)}${carries[i + 1] ? ', carry 1' : ''}.`
		);
	}
	const carryOut = carries[n] === 1;
	const exact = a + b;
	const overflow = width !== null && carryOut;
	const result = overflow ? exact & ((1n << BigInt(width!)) - 1n) : exact;
	if (carryOut) {
		explanation.push(
			width !== null
				? `The carry out of the top column has nowhere to go in ${width} bits, so it is lost: overflow.`
				: `The last carry becomes a new digit on the left.`
		);
	}

	const columns = n + 1;
	const carryRow = carries.map((c, i) => (c && i > 0 ? { text: '1', tone: 'carry' as Tone } : null)).reverse();
	const resultCells = rightAlign(sumDigits.join(''), columns, 'result');
	if (carryOut) resultCells[0] = { text: '1', tone: width !== null ? 'overflow' : 'result' };
	const layout: Layout = {
		columns,
		groupEvery: radix === 2 ? 4 : undefined,
		rows: [
			{ sign: '', kind: 'carry', label: 'carries', cells: carryRow },
			{ sign: '', kind: 'operand', label: 'first number', cells: rightAlign(width ? aDigits : aText, columns) },
			{ sign: '+', kind: 'operand', label: 'second number', cells: rightAlign(width ? bDigits : bText, columns) },
			{ sign: '', kind: 'result', label: 'sum', cells: resultCells, rule: true }
		]
	};
	const notes: string[] = [];
	if (overflow) {
		notes.push(
			`The full sum is ${toRadix(exact, radix)}, which needs ${
				exact.toString(2).length
			} bits. In ${width} bits only the low part is kept.`
		);
	}
	return {
		op: 'add',
		radix,
		width,
		a,
		b,
		result,
		resultText: width !== null ? digitsOf(result, radix, n) : toRadix(result, radix),
		overflow,
		wrappedNegative: false,
		layout,
		explanation,
		notes
	};
}

// --- Subtraction ------------------------------------------------------------

/** Column subtraction of top − bottom, which may borrow out of the top column. */
function columnSubtract(top: string, bottom: string, radix: CalcRadix) {
	const n = top.length;
	const borrows: number[] = Array(n + 1).fill(0);
	const digits: string[] = [];
	const explanation: string[] = [];
	for (let i = 0; i < n; i++) {
		const dt = top[n - 1 - i];
		const db = bottom[n - 1 - i];
		const borrowIn = borrows[i];
		let diff = digitValue(dt) - digitValue(db) - borrowIn;
		const minus = `${hexValue(dt, radix)}${borrowIn ? ' − 1 (lent)' : ''} − ${hexValue(db, radix)}`;
		if (diff < 0) {
			diff += radix;
			borrows[i + 1] = 1;
			const borrowed = radix === 2 ? '10' : '16';
			explanation.push(
				`${columnName(i, radix)}: ${minus} is below zero, so borrow ${borrowed} from the next column: ${
					radix === 2 ? `${diff}` : `${diff}${diff > 9 ? `, which is ${digitChar(diff)}` : ''}`
				}. Write ${digitChar(diff)}.`
			);
		} else {
			explanation.push(`${columnName(i, radix)}: ${minus} = ${diff}. Write ${digitChar(diff)}.`);
		}
		digits.unshift(digitChar(diff));
	}
	return { borrows, digits: digits.join(''), explanation, borrowOut: borrows[n] === 1 };
}

export function subtract(a: bigint, b: bigint, radix: CalcRadix, width: number | null = null): Calculation {
	const notes: string[] = [];
	let layoutTitle: string | undefined;
	let top = a;
	let bottom = b;
	let negative = false;
	if (width === null && a < b) {
		// On paper the smaller number goes underneath: work out b − a and put a minus sign on it.
		top = b;
		bottom = a;
		negative = true;
		layoutTitle = `The second number is larger, so this works out ${toRadix(b, radix)} − ${toRadix(
			a,
			radix
		)} and makes the answer negative.`;
	}
	const n = width !== null ? width / bitsPer(radix) : toRadix(top, radix).length;
	const topDigits = digitsOf(top, radix, n);
	const bottomDigits = digitsOf(bottom, radix, n);
	const work = columnSubtract(topDigits, bottomDigits, radix);

	const columns = n;
	const borrowRow: Cell[] = work.borrows
		.slice(0, n)
		.map((v, i) => (v ? { text: '1', tone: 'borrow' as Tone } : null))
		.reverse();
	const shownBottom = width !== null ? bottomDigits : toRadix(bottom, radix);
	const layout: Layout = {
		columns,
		groupEvery: radix === 2 ? 4 : undefined,
		rows: [
			{ sign: '', kind: 'borrow', label: 'borrows', cells: borrowRow },
			{ sign: '', kind: 'operand', label: 'first number', cells: rightAlign(topDigits, columns) },
			{ sign: '−', kind: 'operand', label: 'second number', cells: rightAlign(shownBottom, columns) },
			{ sign: '', kind: 'result', label: 'difference', cells: rightAlign(work.digits, columns, 'result'), rule: true }
		]
	};

	let result: bigint;
	let resultText: string;
	let wrappedNegative = false;
	let signedResult: bigint | undefined;
	if (width !== null) {
		result = (a - b) & ((1n << BigInt(width)) - 1n);
		resultText = work.digits;
		signedResult = toSigned(result, width);
		if (work.borrowOut) {
			wrappedNegative = true;
			const fits = signedResult === a - b;
			work.explanation.push(
				fits
					? `A borrow is still owed out of the top column, which means the answer is negative. The ${width} bits left behind are its two's complement.`
					: `A borrow is still owed out of the top column, which means the answer is negative, but it is too far below zero for ${width} signed bits, so the bits left behind wrap round.`
			);
			const smallest = signedDecimal(-(1n << BigInt(width - 1)));
			notes.push(
				fits
					? `Read as unsigned this is ${result}; read as a signed ${width} bit number it is ${signedDecimal(
							signedResult
					  )}, which is the true difference.`
					: `Read as unsigned this is ${result}; read as a signed ${width} bit number it is ${signedDecimal(
							signedResult
					  )}. Neither is the true difference, ${signedDecimal(
							a - b
					  )}, which does not fit in ${width} signed bits (the smallest is ${smallest}): a signed overflow.`
			);
		}
	} else {
		const magnitude = top - bottom;
		result = negative ? -magnitude : magnitude;
		resultText = (negative ? '−' : '') + toRadix(magnitude, radix);
	}
	// Leading zeros are the width, not the answer: drop them in unlimited mode.
	if (width === null) layout.rows[3].cells = rightAlign(toRadix(top - bottom, radix), columns, 'result');
	return {
		op: 'sub',
		radix,
		width,
		a,
		b,
		result,
		resultText,
		overflow: false,
		wrappedNegative,
		signedResult,
		layout,
		layoutTitle,
		explanation: work.explanation,
		notes
	};
}

// --- Multiplication ---------------------------------------------------------

/** Above this many multiplier digits, rows of zeros are left out of the working. */
const SHOW_ZERO_ROWS_UP_TO = 16;

export function multiply(a: bigint, b: bigint, radix: CalcRadix, width: number | null = null): Calculation {
	const r = BigInt(radix);
	const aText = toRadix(a, radix);
	const bText = toRadix(b, radix);
	const exact = a * b;
	const partials: { digit: string; position: number; value: bigint; shown: string }[] = [];
	const explanation: string[] = [];
	const showZeros = bText.length <= SHOW_ZERO_ROWS_UP_TO;
	let skipped = 0;
	for (let i = 0; i < bText.length; i++) {
		const digit = bText[bText.length - 1 - i];
		const d = BigInt(digitValue(digit));
		const product = a * d;
		const value = product * r ** BigInt(i);
		const shift = i === 0 ? '' : `, shifted ${i} place${i === 1 ? '' : 's'} left`;
		if (radix === 2) {
			explanation.push(
				d
					? `Bit ${i} of the multiplier is 1: write ${aText}${shift}.`
					: `Bit ${i} of the multiplier is 0: nothing to add${showZeros ? ', a row of zeros' : ''}.`
			);
		} else {
			explanation.push(
				`Digit ${i + 1} of the multiplier is ${hexValue(digit, radix)}: ${aText} × ${digit} = ${toRadix(
					product,
					radix
				)} (${a} × ${d} = ${product} in decimal)${shift}.`
			);
		}
		if (d === 0n && !showZeros) {
			skipped++;
			continue;
		}
		partials.push({ digit, position: i, value, shown: toRadix(product, radix) });
	}
	const productText = toRadix(exact, radix);
	const columns = Math.max(productText.length, aText.length, bText.length) + (width !== null ? 0 : 0);
	const rows: LayoutRow[] = [
		{ sign: '', kind: 'operand', label: 'first number', cells: rightAlign(aText, columns) },
		{ sign: '×', kind: 'operand', label: 'second number', cells: rightAlign(bText, columns) }
	];
	if (bText.length > 1 || radix === 2) {
		partials.forEach((p, k) => {
			// The shift is written as zeros in the empty places, dimmed, so the
			// alignment reads without them being mistaken for part of the product.
			const text = p.shown + '0'.repeat(p.position);
			const cells = rightAlign(text, columns);
			for (let j = 0; j < p.position; j++) cells[columns - 1 - j] = { text: '0', tone: 'dim' };
			rows.push({
				sign: k === 0 ? '' : '+',
				kind: 'partial',
				label: `${toRadix(a, radix)} × ${p.digit}, shifted ${p.position}`,
				cells,
				rule: k === 0
			});
		});
	}
	const resultCells = rightAlign(productText, columns, 'result');
	let result = exact;
	let overflow = false;
	const notes: string[] = [];
	if (width !== null && exact >= 1n << BigInt(width)) {
		overflow = true;
		result = exact & ((1n << BigInt(width)) - 1n);
		const keep = width / bitsPer(radix);
		for (let j = 0; j < columns - keep; j++)
			if (resultCells[j]) resultCells[j] = { text: resultCells[j]!.text, tone: 'overflow' };
		notes.push(
			`The full product needs ${
				exact.toString(2).length
			} bits. In ${width} bits only the low ${width} are kept, so the answer overflows.`
		);
	}
	rows.push({ sign: '', kind: 'result', label: 'product', cells: resultCells, rule: true });
	if (skipped) explanation.push(`The ${skipped} rows of zeros are left out of the working above.`);
	explanation.push(
		partials.length > 1 ? `Add the rows to get ${productText}.` : `That row is the product: ${productText}.`
	);
	return {
		op: 'mul',
		radix,
		width,
		a,
		b,
		result,
		resultText: width !== null ? digitsOf(result, radix, width / bitsPer(radix)) : toRadix(result, radix),
		overflow,
		wrappedNegative: false,
		layout: { columns, rows, groupEvery: radix === 2 ? 4 : undefined },
		explanation,
		notes
	};
}

/** The partial products of a multiplication, for checking: they sum to the product. */
export function partialProducts(a: bigint, b: bigint, radix: CalcRadix): bigint[] {
	const bText = toRadix(b, radix);
	return [...bText].reverse().map((digit, i) => a * BigInt(digitValue(digit)) * BigInt(radix) ** BigInt(i));
}

// --- Division ---------------------------------------------------------------

export function divide(a: bigint, b: bigint, radix: CalcRadix, width: number | null = null): Calculation {
	if (b === 0n) throw new CalcError('Division by zero has no answer');
	const r = BigInt(radix);
	const aText = toRadix(a, radix);
	const steps: DivisionStep[] = [];
	const explanation: string[] = [];
	let remainder = 0n;
	let quotientText = '';
	for (const ch of aText) {
		const current = remainder * r + BigInt(digitValue(ch));
		const digit = Number(current / b);
		const product = BigInt(digit) * b;
		remainder = current - product;
		steps.push({ brought: ch, current, digit, product, remainder });
		quotientText += digitChar(digit);
		const cur = toRadix(current, radix);
		const div = toRadix(b, radix);
		if (digit === 0) {
			explanation.push(`Bring down ${ch}: ${cur} is smaller than ${div}, so the quotient digit is 0.`);
		} else {
			explanation.push(
				`Bring down ${ch}: ${div} goes into ${cur} ${digit === 1 ? 'once' : `${digit} times`}${
					radix === 16 ? ` (${current} ÷ ${b} in decimal)` : ''
				}. Write ${digitChar(digit)}, subtract ${toRadix(product, radix)}, leaving ${toRadix(remainder, radix)}.`
			);
		}
	}
	const quotient = a / b;
	const q = toRadix(quotient, radix);
	const columns = Math.max(aText.length, 1);
	return {
		op: 'div',
		radix,
		width,
		a,
		b,
		result: quotient,
		remainder,
		resultText: q,
		overflow: false,
		wrappedNegative: false,
		layout: {
			columns,
			groupEvery: radix === 2 ? 4 : undefined,
			rows: [
				{
					sign: '',
					kind: 'result',
					label: 'quotient',
					cells: rightAlign(quotientText.replace(/^0+(?=.)/, ''), columns, 'result')
				},
				{
					sign: `${toRadix(b, radix)} )`,
					kind: 'operand',
					label: 'dividend',
					cells: rightAlign(aText, columns),
					rule: true
				}
			]
		},
		explanation,
		division: steps,
		notes: [`Quotient ${q}, remainder ${toRadix(remainder, radix)}.`]
	};
}

// --- Bitwise ----------------------------------------------------------------

/** The width a bitwise operation works in when none was chosen: enough for both operands as written. */
function autoWidth(radix: CalcRadix, ...texts: string[]) {
	const per = bitsPer(radix);
	return Math.max(1, ...texts.map((t) => t.length * per));
}

const bitCells = (value: bigint, width: number, tone?: Tone): Cell[] =>
	[...value.toString(2).padStart(width, '0')].map((ch) => ({ text: ch, tone: tone ?? (ch === '1' ? 'one' : 'zero') }));

export function bitwise(
	op: 'and' | 'or' | 'xor' | 'not',
	a: bigint,
	b: bigint,
	radix: CalcRadix,
	width: number | null,
	written: { a: string; b: string } = { a: toRadix(a, radix), b: toRadix(b, radix) }
): Calculation {
	const w =
		width ?? (op === 'not' ? autoWidth(radix, written.a) : autoWidth(radix, toRadix(a, radix), toRadix(b, radix)));
	const mask = (1n << BigInt(w)) - 1n;
	const result = op === 'and' ? a & b : op === 'or' ? a | b : op === 'xor' ? a ^ b : ~a & mask;
	const symbol = op.toUpperCase();
	const rows: LayoutRow[] =
		op === 'not'
			? [
					{ sign: '', kind: 'operand', label: 'number', cells: bitCells(a, w) },
					{ sign: 'NOT', kind: 'result', label: 'result', cells: bitCells(result, w), rule: true }
			  ]
			: [
					{ sign: '', kind: 'operand', label: 'first number', cells: bitCells(a, w) },
					{ sign: symbol, kind: 'operand', label: 'second number', cells: bitCells(b, w) },
					{ sign: '', kind: 'result', label: 'result', cells: bitCells(result, w), rule: true }
			  ];
	const rule = {
		and: 'Each result bit is 1 only where both bits above it are 1.',
		or: 'Each result bit is 1 where either bit above it is 1.',
		xor: 'Each result bit is 1 where the two bits above it differ.',
		not: 'Each bit is flipped: 0 becomes 1 and 1 becomes 0.'
	}[op];
	const notes: string[] = [];
	if (op === 'not' && width === null) {
		notes.push(`NOT depends on the width: the answer is for ${w} bits, the number as written. Pick a width to fix it.`);
	}
	return {
		op,
		radix,
		width,
		a,
		b,
		result,
		resultText: radix === 2 ? result.toString(2).padStart(w, '0') : digitsOf(result, radix, Math.ceil(w / 4)),
		overflow: false,
		wrappedNegative: false,
		layout: { columns: w, rows, groupEvery: 4 },
		layoutTitle: radix === 16 ? 'Bitwise operations work on the bits, so the hex is written out in binary.' : undefined,
		explanation: [rule],
		notes
	};
}

// --- Shifts -----------------------------------------------------------------

export function shift(
	op: 'shl' | 'shr',
	a: bigint,
	places: number,
	radix: CalcRadix,
	width: number | null,
	written = toRadix(a, radix)
): Calculation {
	const w = width ?? autoWidth(radix, written);
	const n = BigInt(places);
	const exact = op === 'shl' ? a << n : a >> n;
	let result = exact;
	let overflow = false;
	const notes: string[] = [];
	const explanation: string[] = [];
	// In unlimited width a left shift simply grows; in fixed width bits fall off the top.
	const outWidth = width === null && op === 'shl' ? w + places : w;
	if (width !== null && op === 'shl') {
		result = exact & ((1n << BigInt(width)) - 1n);
		if (result !== exact) {
			overflow = true;
			notes.push(`Some 1 bits were shifted out of the top of the ${width} bits and lost.`);
		}
	}
	const factor = `2${superscript(places)} = ${1n << n}`;
	if (op === 'shl') {
		explanation.push(
			`Every bit moves ${places} place${
				places === 1 ? '' : 's'
			} to the left and zeros fill in on the right. That multiplies by ${factor}${
				overflow ? ', apart from the bits that no longer fit' : ''
			}.`
		);
		if (overflow) {
			explanation.push(
				`Bits pushed above bit ${
					w - 1
				} are lost. From the highest 1 down, they are struck through at the left of the working.`
			);
		}
	} else {
		const lost = a & ((1n << n) - 1n);
		explanation.push(
			`Every bit moves ${places} place${
				places === 1 ? '' : 's'
			} to the right and zeros fill in on the left. That divides by ${factor}, dropping the remainder${
				lost ? ` (${lost.toString(2)} in binary, which falls off the right)` : ''
			}.`
		);
	}
	// When bits fall off the top, the result row shows the full shifted number
	// with the bits that no longer fit struck through, up to the highest 1.
	const dropped = overflow ? exact.toString(2).length - w : 0;
	const columns = Math.max(outWidth, w) + dropped;
	const aCells = [...Array(columns - w).fill(null), ...bitCells(a, w)];
	const lost: Cell[] = dropped
		? [...(exact >> BigInt(w)).toString(2).padStart(dropped, '0')].map((ch) => ({ text: ch, tone: 'overflow' }))
		: [];
	const rCells = [...lost, ...bitCells(result, outWidth)];
	const rows: LayoutRow[] = [
		{ sign: '', kind: 'operand', label: 'number', cells: aCells },
		{
			sign: op === 'shl' ? `<< ${places}` : `>> ${places}`,
			kind: 'result',
			label: 'shifted',
			cells: [...Array(columns - rCells.length).fill(null), ...rCells],
			rule: true
		}
	];
	return {
		op,
		radix,
		width,
		a,
		b: n,
		result,
		resultText:
			radix === 2 ? result.toString(2).padStart(outWidth, '0') : digitsOf(result, radix, Math.ceil(outWidth / 4)),
		overflow,
		wrappedNegative: false,
		layout: { columns, rows, groupEvery: 4 },
		layoutTitle: radix === 16 ? 'Shifts move bits, so the hex is written out in binary.' : undefined,
		explanation,
		notes
	};
}

// --- One entry point for the pages -------------------------------------------

/**
 * Parses both operands and runs the operation. Throws CalcError with a
 * message fit to show when an input is not usable.
 */
export function calculate(op: Op, aText: string, bText: string, radix: CalcRadix, width: number | null): Calculation {
	const spec = ops.find((o) => o.id === op);
	if (!spec) throw new CalcError(`Unknown operation ${op}`);
	const a = parseOperand(aText, radix, width, spec.unary || spec.shift ? 'The number' : 'The first number');
	const writtenA = parseRadix(aText, radix).digits;
	if (spec.unary) return bitwise('not', a, 0n, radix, width, { a: writtenA, b: '' });
	if (spec.shift) return shift(op as 'shl' | 'shr', a, parseShift(bText), radix, width, writtenA);
	const b = parseOperand(bText, radix, width, 'The second number');
	switch (op) {
		case 'add':
			return add(a, b, radix, width);
		case 'sub':
			return subtract(a, b, radix, width);
		case 'mul':
			return multiply(a, b, radix, width);
		case 'div':
			return divide(a, b, radix, width);
		default:
			return bitwise(op as 'and' | 'or' | 'xor', a, b, radix, width);
	}
}

/** The addition table for a base: every digit plus every digit, as the pages print it. */
export function additionTable(radix: CalcRadix): string[][] {
	return Array.from({ length: radix }, (_, i) =>
		Array.from({ length: radix }, (_, j) => toRadix(BigInt(i + j), radix))
	);
}

export { MAX_DIGITS, radixNames };
