// EAN-13, UPC-A and EAN-8 barcodes, built the way the GS1 specification
// describes them: a check digit from alternating weights of 1 and 3, each digit
// drawn as seven modules from one of three code sets, guard patterns at the
// ends and in the middle, and a blank quiet zone either side.
//
// Everything the barcode page states as a fact (the code tables, the module
// count, the worked check digits) comes from here, so the text cannot drift
// from the bars.

export type Symbology = 'ean13' | 'upca' | 'ean8';

/** The three ways a digit can be drawn. */
export type CodeSet = 'L' | 'G' | 'R';

export class BarcodeError extends Error {}

/**
 * Set A in the specification, called L because it is only used on the left.
 * Every code is seven modules wide, two bars and two spaces, and starts with a
 * space. These ten strings are the only hand-written table; G and R follow.
 */
export const L_CODES: readonly string[] = [
	'0001101',
	'0011001',
	'0010011',
	'0111101',
	'0100011',
	'0110001',
	'0101111',
	'0111011',
	'0110111',
	'0001011'
];

const invert = (bits: string) => bits.replace(/[01]/g, (b) => (b === '0' ? '1' : '0'));
const reverse = (bits: string) => [...bits].reverse().join('');

/** Set C, the right-hand codes: each L code with every module inverted. */
export const R_CODES: readonly string[] = L_CODES.map(invert);

/** Set B, the left-hand alternative: each R code read backwards. */
export const G_CODES: readonly string[] = R_CODES.map(reverse);

export const CODE_SETS: Record<CodeSet, readonly string[]> = { L: L_CODES, G: G_CODES, R: R_CODES };

/**
 * Which code set each of the six left-hand digits of an EAN-13 uses, indexed by
 * the first digit. The first digit has no bars of its own: this pattern is how
 * it gets into the symbol. 0 is all L, which is exactly a UPC-A.
 */
export const PARITY_PATTERNS: readonly string[] = [
	'LLLLLL',
	'LLGLGG',
	'LLGGLG',
	'LLGGGL',
	'LGLLGG',
	'LGGLLG',
	'LGGGLL',
	'LGLGLG',
	'LGLGGL',
	'LGGLGL'
];

export const GUARDS = { start: '101', centre: '01010', end: '101' } as const;

/** The specification's minimum blank space either side, in modules. */
export const QUIET_ZONES: Record<Symbology, { left: number; right: number }> = {
	ean13: { left: 11, right: 7 },
	upca: { left: 9, right: 9 },
	ean8: { left: 7, right: 7 }
};

export interface SymbologyInfo {
	name: string;
	/** Length of a complete number, check digit included. */
	length: number;
	/** How many digits are drawn in each half. */
	half: number;
}

export const SYMBOLOGIES: Record<Symbology, SymbologyInfo> = {
	ean13: { name: 'EAN-13', length: 13, half: 6 },
	upca: { name: 'UPC-A', length: 12, half: 6 },
	ean8: { name: 'EAN-8', length: 8, half: 4 }
};

/** Modules between the outer edges of the guards: 95 for EAN-13 and UPC-A, 67 for EAN-8. */
export const symbolModules = (s: Symbology): number =>
	GUARDS.start.length + GUARDS.centre.length + GUARDS.end.length + 2 * SYMBOLOGIES[s].half * 7;

// ---------------------------------------------------------------------------
// Check digits

export interface CheckStep {
	/** 1-based position from the left. */
	position: number;
	digit: number;
	weight: 1 | 3;
	product: number;
}

export interface CheckWorking {
	steps: CheckStep[];
	sum: number;
	/** The next multiple of ten at or above the sum. */
	nextTen: number;
	check: number;
}

/**
 * The GS1 check digit. Counting from the right, the digit next to the check
 * digit is weighted 3, the one before it 1, and so on; the check digit is what
 * brings the weighted sum up to a multiple of ten. Counting from the right is
 * what makes one rule serve every length: a UPC-A and the same number with a
 * leading zero as an EAN-13 get the same check digit.
 */
export function checkWorking(data: string): CheckWorking {
	if (!/^\d+$/.test(data)) throw new BarcodeError('Digits only');
	const n = data.length;
	const steps = [...data].map((ch, i) => {
		const digit = Number(ch);
		const weight: 1 | 3 = (n - i) % 2 === 1 ? 3 : 1;
		return { position: i + 1, digit, weight, product: digit * weight };
	});
	const sum = steps.reduce((total, s) => total + s.product, 0);
	const nextTen = Math.ceil(sum / 10) * 10;
	return { steps, sum, nextTen, check: nextTen - sum };
}

export const checkDigit = (data: string): number => checkWorking(data).check;

/** True when the last digit is the right check digit for the rest. */
export const isValidCode = (code: string): boolean =>
	/^\d{2,}$/.test(code) && checkDigit(code.slice(0, -1)) === Number(code[code.length - 1]);

/**
 * Adjacent pairs of distinct digits whose swap the check digit cannot see.
 * Swapping a and b changes the sum by 2(a − b) times ±1, which is a multiple of
 * ten only when a and b differ by 5.
 */
export function missedTranspositions(): [number, number][] {
	const missed: [number, number][] = [];
	for (let a = 0; a < 10; a++) {
		for (let b = 0; b < 10; b++) {
			if (a !== b && (3 * a + b) % 10 === (3 * b + a) % 10) missed.push([a, b]);
		}
	}
	return missed;
}

// ---------------------------------------------------------------------------
// ISBN

/** The ISBN-10 check character for nine digits: weights 10 down to 2, mod 11, 10 written X. */
export function isbn10Check(first9: string): string {
	if (!/^\d{9}$/.test(first9)) throw new BarcodeError('An ISBN-10 check needs nine digits');
	const sum = [...first9].reduce((total, ch, i) => total + Number(ch) * (10 - i), 0);
	const check = (11 - (sum % 11)) % 11;
	return check === 10 ? 'X' : String(check);
}

export interface IsbnConversion {
	isbn10: string;
	/** The ISBN-10 check character the first nine digits call for. */
	expected10: string;
	valid10: boolean;
	isbn13: string;
	working: CheckWorking;
}

/**
 * ISBN-10 to ISBN-13: put 978 in front, drop the old check character and work
 * out a new one with the EAN rule, since the two schemes share nothing else.
 */
export function isbn10To13(isbn10: string): IsbnConversion {
	const s = isbn10.replace(/[\s-]/g, '').toUpperCase();
	if (!/^\d{9}[\dX]$/.test(s)) throw new BarcodeError('An ISBN-10 is nine digits and a check digit or X');
	const expected10 = isbn10Check(s.slice(0, 9));
	const data = '978' + s.slice(0, 9);
	const working = checkWorking(data);
	return { isbn10: s, expected10, valid10: expected10 === s[9], isbn13: data + working.check, working };
}

/** The ISBN-10 for a 978 ISBN-13, or null: 979 numbers have no ISBN-10. */
export function isbn13To10(isbn13: string): string | null {
	if (!/^978\d{10}$/.test(isbn13)) return null;
	const first9 = isbn13.slice(3, 12);
	return first9 + isbn10Check(first9);
}

// ---------------------------------------------------------------------------
// GS1 prefixes

export interface PrefixRange {
	from: number;
	to: number;
	/** Who issued the company prefix, or what the range is for. */
	meaning: string;
	/** True for ranges that are not tied to a member organisation. */
	special?: boolean;
}

/**
 * A selection of the GS1 prefix list: the member organisations people most
 * often ask about and the ranges with a special use. A prefix says which GS1
 * member organisation handed out the company prefix, not where the product was
 * made. Left deliberately incomplete rather than guessed at.
 */
export const PREFIX_RANGES: readonly PrefixRange[] = [
	{ from: 0, to: 19, meaning: 'GS1 US' },
	{ from: 20, to: 29, meaning: 'Restricted circulation within a geographic region', special: true },
	{ from: 30, to: 39, meaning: 'GS1 US' },
	{ from: 40, to: 49, meaning: 'Restricted circulation within a company', special: true },
	{ from: 60, to: 139, meaning: 'GS1 US' },
	{ from: 200, to: 299, meaning: 'Restricted circulation within a geographic region', special: true },
	{ from: 300, to: 379, meaning: 'GS1 France' },
	{ from: 400, to: 440, meaning: 'GS1 Germany' },
	{ from: 450, to: 459, meaning: 'GS1 Japan' },
	{ from: 460, to: 469, meaning: 'GS1 Russia' },
	{ from: 490, to: 499, meaning: 'GS1 Japan' },
	{ from: 500, to: 509, meaning: 'GS1 UK' },
	{ from: 540, to: 549, meaning: 'GS1 Belgium & Luxembourg' },
	{ from: 570, to: 579, meaning: 'GS1 Denmark' },
	{ from: 640, to: 649, meaning: 'GS1 Finland' },
	{ from: 690, to: 699, meaning: 'GS1 China' },
	{ from: 700, to: 709, meaning: 'GS1 Norway' },
	{ from: 730, to: 739, meaning: 'GS1 Sweden' },
	{ from: 754, to: 755, meaning: 'GS1 Canada' },
	{ from: 760, to: 769, meaning: 'GS1 Switzerland' },
	{ from: 800, to: 839, meaning: 'GS1 Italy' },
	{ from: 840, to: 849, meaning: 'GS1 Spain' },
	{ from: 870, to: 879, meaning: 'GS1 Netherlands' },
	{ from: 880, to: 880, meaning: 'GS1 Korea' },
	{ from: 890, to: 890, meaning: 'GS1 India' },
	{ from: 900, to: 919, meaning: 'GS1 Austria' },
	{ from: 930, to: 939, meaning: 'GS1 Australia' },
	{ from: 940, to: 949, meaning: 'GS1 New Zealand' },
	{ from: 977, to: 977, meaning: 'Serial publications (ISSN)', special: true },
	{ from: 978, to: 979, meaning: 'Books (ISBN), the “Bookland” range', special: true }
];

const pad3 = (n: number) => String(n).padStart(3, '0');

/** "400–440", or a single prefix on its own. */
export const prefixLabel = (r: PrefixRange): string =>
	r.from === r.to ? pad3(r.from) : `${pad3(r.from)}–${pad3(r.to)}`;

/** The range a 13 digit number's first three digits fall in, if this page lists it. */
export function prefixInfo(code13: string): PrefixRange | null {
	const prefix = Number(code13.slice(0, 3));
	return PREFIX_RANGES.find((r) => prefix >= r.from && prefix <= r.to) ?? null;
}

// ---------------------------------------------------------------------------
// Reading what was typed

export type CheckStatus = 'computed' | 'valid' | 'invalid';

export interface ParsedCode {
	symbology: Symbology;
	/** The full number that gets drawn, check digit included (corrected if it was wrong). */
	code: string;
	/** The digits the check digit is calculated from. */
	data: string;
	working: CheckWorking;
	status: CheckStatus;
	/** The check digit that was typed, when one was. */
	given?: number;
	/** Set when an ISBN-10 was typed and converted. */
	isbn?: IsbnConversion;
}

/** Spaces and hyphens are how these numbers are usually printed, so they are ignored. */
export const cleanCode = (text: string): string => text.replace(/[\s-]/g, '');

/**
 * Reads a number for `symbology`. The short length (12 for EAN-13) gets a
 * check digit added; the full length has its check digit verified. An ISBN-10
 * typed into the EAN-13 field is converted to its ISBN-13.
 */
export function parseCode(text: string, symbology: Symbology): ParsedCode {
	const s = cleanCode(text).toUpperCase();
	const { length, name } = SYMBOLOGIES[symbology];
	if (!s) throw new BarcodeError('Type a number first');
	if (symbology === 'ean13' && /^\d{9}[\dX]$/.test(s)) {
		const isbn = isbn10To13(s);
		return {
			symbology,
			code: isbn.isbn13,
			data: isbn.isbn13.slice(0, 12),
			working: isbn.working,
			status: 'computed',
			isbn
		};
	}
	const bad = s.match(/[^\d]/);
	if (bad) throw new BarcodeError(`“${bad[0]}” is not a digit: ${name} numbers are digits 0 to 9 only`);
	if (s.length !== length && s.length !== length - 1) {
		const isbnHint = symbology === 'ean13' ? ', or a 10 character ISBN' : '';
		throw new BarcodeError(
			`${name} takes ${length - 1} digits (the check digit is added) or ${length} (it is checked)${isbnHint}; this is ${
				s.length
			} digit${s.length === 1 ? '' : 's'}`
		);
	}
	const data = s.slice(0, length - 1);
	const working = checkWorking(data);
	const code = data + working.check;
	if (s.length === length - 1) return { symbology, code, data, working, status: 'computed' };
	const given = Number(s[length - 1]);
	return { symbology, code, data, working, status: given === working.check ? 'valid' : 'invalid', given };
}

// ---------------------------------------------------------------------------
// Encoding

export type SegmentKind = 'quiet' | 'guard' | 'digit';

export interface Segment {
	kind: SegmentKind;
	/** "Start guard", "Digit 4", "Left quiet zone". */
	label: string;
	/** The modules, 1 for a bar and 0 for a space. Quiet zones are all 0. */
	bits: string;
	/** First module, counted from the left edge of the left quiet zone. */
	start: number;
	/** For digits: index into the symbology's own number, and the code set used. */
	digitIndex?: number;
	set?: CodeSet;
}

export interface Barcode {
	symbology: Symbology;
	code: string;
	/** For EAN-13: the parity pattern that carries the first digit. */
	parity?: string;
	segments: Segment[];
	/** The modules from the first bar of the start guard to the last of the end guard. */
	modules: string;
	quiet: { left: number; right: number };
	/** Total width including both quiet zones. */
	width: number;
}

/**
 * Lays a complete number out as modules. A UPC-A is drawn as the EAN-13 with a
 * leading 0, whose parity pattern is all L, so the bars are identical; only
 * the printed digits differ.
 */
export function encode(code: string, symbology: Symbology): Barcode {
	const { length, half } = SYMBOLOGIES[symbology];
	if (!new RegExp(`^\\d{${length}}$`).test(code)) {
		throw new BarcodeError(`${SYMBOLOGIES[symbology].name} needs exactly ${length} digits`);
	}
	if (!isValidCode(code)) throw new BarcodeError(`${code} has the wrong check digit`);

	// Which digits get bars, which code sets they use, and where they sit in `code`.
	let drawn: string;
	let sets: CodeSet[];
	let parity: string | undefined;
	let offset = 0;
	if (symbology === 'ean8') {
		drawn = code;
		sets = [...'LLLLRRRR'] as CodeSet[];
	} else {
		const ean = symbology === 'upca' ? '0' + code : code;
		parity = PARITY_PATTERNS[Number(ean[0])];
		drawn = ean.slice(1);
		sets = [...parity, ...'RRRRRR'] as CodeSet[];
		// EAN-13 digit 0 is drawn through the parity; UPC-A has no hidden digit.
		offset = symbology === 'upca' ? 0 : 1;
	}

	const quiet = QUIET_ZONES[symbology];
	const segments: Segment[] = [];
	let at = 0;
	const push = (s: Omit<Segment, 'start'>) => {
		segments.push({ ...s, start: at });
		at += s.bits.length;
	};
	const digit = (i: number) =>
		push({
			kind: 'digit',
			label: `Digit ${code[i + offset]}`,
			bits: CODE_SETS[sets[i]][Number(drawn[i])],
			digitIndex: i + offset,
			set: sets[i]
		});

	push({ kind: 'quiet', label: 'Left quiet zone', bits: '0'.repeat(quiet.left) });
	push({ kind: 'guard', label: 'Start guard', bits: GUARDS.start });
	for (let i = 0; i < half; i++) digit(i);
	push({ kind: 'guard', label: 'Centre guard', bits: GUARDS.centre });
	for (let i = half; i < 2 * half; i++) digit(i);
	push({ kind: 'guard', label: 'End guard', bits: GUARDS.end });
	push({ kind: 'quiet', label: 'Right quiet zone', bits: '0'.repeat(quiet.right) });

	const modules = segments
		.filter((s) => s.kind !== 'quiet')
		.map((s) => s.bits)
		.join('');
	return { symbology, code, parity, segments, modules, quiet, width: at };
}

// ---------------------------------------------------------------------------
// Drawing

export interface Bar {
	/** In modules from the left edge. */
	x: number;
	width: number;
	/** Guard bars (and UPC-A's outer digits) run down past the digits. */
	long: boolean;
	/** The digit this bar belongs to, if any. */
	digitIndex?: number;
}

export interface Label {
	text: string;
	/** Centre of the text, in modules. */
	x: number;
	digitIndex: number;
	/** The UPC-A outer digits are printed smaller, in the quiet zones. */
	small: boolean;
}

export interface Layout {
	width: number;
	height: number;
	barTop: number;
	barBottom: number;
	longBottom: number;
	textY: number;
	fontSize: number;
	bars: Bar[];
	labels: Label[];
	/** Each digit's span of modules, for highlighting. */
	digitSpans: { digitIndex: number; x: number; width: number }[];
}

/** Proportions, in modules. GS1's EAN-13 is about 69 modules tall at nominal size; this is close to it. */
const BAR_TOP = 3;
const BAR_HEIGHT = 62;
const GUARD_EXTRA = 5;
const FONT = 9;

/** Turns modules into runs of bars, with the human-readable digits underneath. */
export function layout(barcode: Barcode): Layout {
	const { symbology, segments, code, quiet } = barcode;
	const bars: Bar[] = [];
	const digitSpans: Layout['digitSpans'] = [];
	const lastIndex = code.length - 1;
	for (const seg of segments) {
		if (seg.kind === 'quiet') continue;
		if (seg.kind === 'digit' && seg.digitIndex !== undefined) {
			digitSpans.push({ digitIndex: seg.digitIndex, x: seg.start, width: seg.bits.length });
		}
		// UPC-A extends the bars of its first and last digit along with the guards.
		const long =
			seg.kind === 'guard' || (symbology === 'upca' && (seg.digitIndex === 0 || seg.digitIndex === lastIndex));
		let i = 0;
		while (i < seg.bits.length) {
			if (seg.bits[i] === '1') {
				let j = i;
				while (j < seg.bits.length && seg.bits[j] === '1') j++;
				bars.push({ x: seg.start + i, width: j - i, long, digitIndex: seg.digitIndex });
				i = j;
			} else i++;
		}
	}

	const labels: Label[] = [];
	for (const span of digitSpans) {
		const outer = symbology === 'upca' && (span.digitIndex === 0 || span.digitIndex === lastIndex);
		if (outer) continue;
		labels.push({ text: code[span.digitIndex], x: span.x + span.width / 2, digitIndex: span.digitIndex, small: false });
	}
	if (symbology === 'ean13') labels.unshift({ text: code[0], x: quiet.left - 4.5, digitIndex: 0, small: false });
	if (symbology === 'upca') {
		labels.unshift({ text: code[0], x: quiet.left - 4, digitIndex: 0, small: true });
		labels.push({ text: code[lastIndex], x: barcode.width - quiet.right + 4, digitIndex: lastIndex, small: true });
	}

	const barBottom = BAR_TOP + BAR_HEIGHT;
	const longBottom = barBottom + GUARD_EXTRA;
	return {
		width: barcode.width,
		height: longBottom + 4,
		barTop: BAR_TOP,
		barBottom,
		longBottom,
		textY: barBottom + FONT - 1,
		fontSize: FONT,
		bars,
		labels,
		digitSpans
	};
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * A standalone SVG file: black bars on white, quiet zones included, `scale`
 * pixels per module. Built as a string so the download does not depend on the
 * page's styles or highlight state.
 */
export function barcodeSvg(barcode: Barcode, scale = 3): string {
	const l = layout(barcode);
	const w = l.width * scale;
	const h = l.height * scale;
	const rects = l.bars
		.map((b) => {
			const bottom = b.long ? l.longBottom : l.barBottom;
			return `<rect x="${b.x}" y="${l.barTop}" width="${b.width}" height="${bottom - l.barTop}"/>`;
		})
		.join('');
	const text = l.labels
		.map(
			(t) =>
				`<text x="${t.x}" y="${t.small ? l.textY - 1 : l.textY}"${t.small ? ` font-size="${l.fontSize - 2}"` : ''}>${
					t.text
				}</text>`
		)
		.join('');
	const name = SYMBOLOGIES[barcode.symbology].name;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${l.width} ${l.height}" role="img">` +
		`<title>${name} barcode ${barcode.code}</title>` +
		`<rect width="${l.width}" height="${l.height}" fill="#fff"/>` +
		`<g fill="#000" shape-rendering="crispEdges">${rects}</g>` +
		`<g fill="#000" font-family="${MONO}" font-size="${l.fontSize}" text-anchor="middle">${text}</g>` +
		`</svg>`
	);
}

// ---------------------------------------------------------------------------
// Reference content

/** Number of bars (runs of 1s) in a code: always 2 for a valid digit code. */
export const barCount = (bits: string): number => (bits.match(/1+/g) ?? []).length;

/** Dark modules in a code. L codes have an odd number, G and R an even one. */
export const darkModules = (bits: string): number => [...bits].filter((b) => b === '1').length;

/** The structure of a symbol from edge to edge, with module counts. */
export function structure(symbology: Symbology): { part: string; modules: number }[] {
	const { half } = SYMBOLOGIES[symbology];
	const q = QUIET_ZONES[symbology];
	return [
		{ part: 'Left quiet zone', modules: q.left },
		{ part: 'Start guard 101', modules: GUARDS.start.length },
		{ part: `${half} left-hand digits × 7`, modules: half * 7 },
		{ part: 'Centre guard 01010', modules: GUARDS.centre.length },
		{ part: `${half} right-hand digits × 7`, modules: half * 7 },
		{ part: 'End guard 101', modules: GUARDS.end.length },
		{ part: 'Right quiet zone', modules: q.right }
	];
}

/** The number grouped the way it is printed under the bars: 4 006381 333931, 0 36000 29145 2, 9638 5074. */
export function printedForm(code: string, symbology: Symbology): string {
	if (symbology === 'ean13') return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
	if (symbology === 'upca') return `${code[0]} ${code.slice(1, 6)} ${code.slice(6, 11)} ${code[11]}`;
	return `${code.slice(0, 4)} ${code.slice(4)}`;
}
