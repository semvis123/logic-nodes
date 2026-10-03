// Display designer: the bytes behind seven-segment digits, dot-matrix grids and
// Nixie tubes. Everything the page states as a fact (the 0 to F table, the glyph
// list, the generated code, the BCD table) comes from here.

import { digitSegments } from './sevenSegment.js';

/** The canonical pattern is a mask: bit 0 is segment a ... bit 6 is g, bit 7 is the decimal point. */
export const SEGMENT_ORDER = 'abcdefg.';
export type ByteOrder = 'lsb' | 'msb';
export type ByteOptions = { order: ByteOrder; anode: boolean };

export const segmentsToMask = (segments: string): number =>
	[...segments].reduce((mask, s) => (SEGMENT_ORDER.includes(s) ? mask | (1 << SEGMENT_ORDER.indexOf(s)) : mask), 0);

export const maskToSegments = (mask: number): string => [...SEGMENT_ORDER].filter((_, i) => mask & (1 << i)).join('');

function reverse8(byte: number): number {
	let out = 0;
	for (let i = 0; i < 8; i++) if (byte & (1 << i)) out |= 0x80 >> i;
	return out;
}

/**
 * The byte to send for a pattern. "lsb" is the order `dp g f e d c b a` with a as
 * bit 0; "msb" is `a b c d e f g dp` with a as bit 7, the same bits mirrored. A
 * common anode display lights a segment when its pin is low, so every bit flips.
 */
export function encodeByte(mask: number, { order, anode }: ByteOptions): number {
	const byte = order === 'lsb' ? mask : reverse8(mask);
	return anode ? ~byte & 0xff : byte;
}

export function decodeByte(byte: number, { order, anode }: ByteOptions): number {
	const lit = anode ? ~byte & 0xff : byte;
	return order === 'lsb' ? lit : reverse8(lit);
}

/** Glyphs for letters and symbols; digits come from the decoder page's table. Conventions, not a standard. */
const LETTERS =
	'A:abcefg b:cdefg C:adef d:bcdeg E:adefg F:aefg H:bcefg h:cefg J:bcde L:def n:ceg o:cdeg P:abefg r:eg t:defg U:bcdef y:bcdfg -:g _:d =:dg ?:abeg °:abfg';
export const GLYPHS: Record<string, string> = Object.fromEntries([
	...digitSegments.map((s, i) => [String(i), s]),
	...LETTERS.split(' ').map((g) => [g[0], g.slice(2)]),
	[' ', '']
]);

/** Which key stands for which glyph when typing: a letter without its own glyph can borrow another's look. */
const TYPED: Record<string, string> = {
	c: 'C',
	e: 'E',
	f: 'F',
	l: 'L',
	a: 'A',
	p: 'P',
	s: '5',
	u: 'U',
	j: 'J',
	i: '1',
	O: '0',
	S: '5',
	B: 'b',
	D: 'd',
	N: 'n',
	R: 'r',
	T: 't',
	Y: 'y'
};

export function glyphFor(ch: string): string | undefined {
	const key =
		ch in GLYPHS ? ch : TYPED[ch] ?? (ch.toLowerCase() in GLYPHS ? ch.toLowerCase() : TYPED[ch.toLowerCase()]);
	return key === undefined ? undefined : GLYPHS[key];
}

export type RenderedText = { masks: number[]; missing: string[]; cut: number };

/** Text on n digits. A "." lights the decimal point of the character before it; characters that cannot be drawn leave a blank digit and are listed. */
export function renderText(text: string, digits: number): RenderedText {
	const cells: number[] = [];
	const missing: string[] = [];
	for (const ch of text) {
		if (ch === '.' && cells.length) cells[cells.length - 1] |= 0x80;
		else {
			const segments = glyphFor(ch);
			if (segments === undefined && !missing.includes(ch)) missing.push(ch);
			cells.push(segmentsToMask(segments ?? ''));
		}
	}
	return {
		masks: Array.from({ length: digits }, (_, i) => cells[i] ?? 0),
		missing,
		cut: Math.max(0, cells.length - digits)
	};
}

/** The hex digits 0 to F, with their bytes in the usual common cathode order. */
export const hexTable = () =>
	[...'0123456789AbCdEF'].map((digit) => {
		const mask = segmentsToMask(GLYPHS[digit]);
		return {
			digit,
			segments: GLYPHS[digit],
			mask,
			cathode: encodeByte(mask, { order: 'lsb', anode: false }),
			anode: encodeByte(mask, { order: 'lsb', anode: true })
		};
	});

/** The characters the typing box can draw, one glyph each, for the reference table. */
export const typeable = () => Object.keys(GLYPHS).filter((c) => c !== ' ');

export const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
export const bin = (n: number, width = 8) => n.toString(2).padStart(width, '0');

export type Lang = 'c' | 'arduino' | 'verilog';

/** An array (or, for Verilog, a case statement on the index) holding the bytes. */
export function byteCode(bytes: number[], lang: Lang, name: string, note: string, off = 0): string {
	const body = bytes.map((b) => `0x${hex2(b)}`);
	if (lang === 'verilog') {
		const width = Math.max(1, Math.ceil(Math.log2(bytes.length)));
		const rows = bytes.map((b, i) => `    ${width}'d${i}: seg = 8'h${hex2(b)};`);
		return `// ${note}\n// idx: wire [${width - 1}:0], seg: reg [7:0]\nalways @(*) begin\n  case (idx)\n${rows.join(
			'\n'
		)}\n    default: seg = 8'h${hex2(off)};\n  endcase\nend`;
	}
	const type = lang === 'c' ? 'const uint8_t' : 'const byte';
	return `${lang === 'c' ? '#include <stdint.h>\n\n' : ''}// ${note}\n${type} ${name}[${
		bytes.length
	}] = {\n  ${body.join(', ')}\n};`;
}

// ---- Nixie ----

/** The 74141 / K155ID1 style decoder: codes 0 to 9 select that numeral's cathode, 10 to 15 select none. */
export const bcdOutput = (code: number): number | null => (code >= 0 && code <= 9 ? code : null);
export const bcdTable = () =>
	Array.from({ length: 16 }, (_, code) => ({ code, bits: bin(code, 4), output: bcdOutput(code) }));

// ---- Dot matrix ----

export type Grid = boolean[][];
export type Lines = 'rows' | 'cols';

export const emptyGrid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<boolean>(w).fill(false));
export const transpose = (g: Grid): Grid => (g.length ? g[0].map((_, c) => g.map((row) => row[c])) : g);
export const flipH = (g: Grid): Grid => g.map((row) => [...row].reverse());
export const flipV = (g: Grid): Grid => [...g].reverse();
export const rotateCw = (g: Grid): Grid => flipH(transpose(g));
export const invert = (g: Grid): Grid => g.map((row) => row.map((v) => !v));

/** One line of pixels as a number: the first pixel is the top bit (msb) or bit 0 (lsb). */
function pack(line: boolean[], msb: boolean): number {
	return line.reduce((n, v, i) => (v ? n | (1 << (msb ? line.length - 1 - i : i)) : n), 0);
}
const unpack = (n: number, len: number, msb: boolean): boolean[] =>
	Array.from({ length: len }, (_, i) => !!(n & (1 << (msb ? len - 1 - i : i))));

/** Row bytes read left to right; column bytes read top to bottom. Short lines sit in the low bits. */
export const gridBytes = (g: Grid, lines: Lines, msb: boolean): number[] =>
	(lines === 'rows' ? g : transpose(g)).map((line) => pack(line, msb));

export function gridFromBytes(bytes: number[], w: number, h: number, lines: Lines, msb: boolean): Grid {
	const out = bytes.map((b) => unpack(b, lines === 'rows' ? w : h, msb));
	return lines === 'rows' ? out : transpose(out);
}

/** 5 by 7 glyphs, one 5-bit row per number, the leftmost pixel in bit 4. Drawn for this site. */
const FONT_SOURCE =
	'0:0e 11 13 15 19 11 0e|1:04 0c 04 04 04 04 0e|2:0e 11 01 02 04 08 1f|3:1f 02 04 02 01 11 0e|4:02 06 0a 12 1f 02 02|5:1f 10 1e 01 01 11 0e|6:06 08 10 1e 11 11 0e|7:1f 01 02 04 08 08 08|8:0e 11 11 0e 11 11 0e|9:0e 11 11 0f 01 02 0c|' +
	'A:0e 11 11 1f 11 11 11|B:1e 11 11 1e 11 11 1e|C:0e 11 10 10 10 11 0e|D:1c 12 11 11 11 12 1c|E:1f 10 10 1e 10 10 1f|F:1f 10 10 1e 10 10 10|G:0e 11 10 17 11 11 0f|H:11 11 11 1f 11 11 11|I:0e 04 04 04 04 04 0e|J:07 02 02 02 02 12 0c|K:11 12 14 18 14 12 11|L:10 10 10 10 10 10 1f|M:11 1b 15 15 11 11 11|' +
	'N:11 11 19 15 13 11 11|O:0e 11 11 11 11 11 0e|P:1e 11 11 1e 10 10 10|Q:0e 11 11 11 15 12 0d|R:1e 11 11 1e 14 12 11|S:0e 11 10 0e 01 11 0e|T:1f 04 04 04 04 04 04|U:11 11 11 11 11 11 0e|V:11 11 11 11 11 0a 04|W:11 11 11 15 15 15 0a|X:11 11 0a 04 0a 11 11|Y:11 11 0a 04 04 04 04|Z:1f 01 02 04 08 10 1f|' +
	' :00 00 00 00 00 00 00|.:00 00 00 00 00 0c 0c|,:00 00 00 00 0c 04 08|!:04 04 04 04 04 00 04|?:0e 11 01 02 04 00 04|-:00 00 00 1f 00 00 00|+:00 04 04 1f 04 04 00|=:00 00 1f 00 1f 00 00|::00 0c 0c 00 0c 0c 00|/:01 01 02 04 08 10 10|*:00 15 0e 1f 0e 15 00|<:02 04 08 10 08 04 02|>:10 08 04 02 04 08 10|(:02 04 08 08 08 04 02|):08 04 02 02 02 04 08';
export const FONT: Record<string, number[]> = Object.fromEntries(
	FONT_SOURCE.split('|').map((g) => [
		g[0],
		g
			.slice(2)
			.split(' ')
			.map((h) => parseInt(h, 16))
	])
);
export const FONT_CHARS = Object.keys(FONT).join('');

const glyphGrid = (ch: string): Grid =>
	(FONT[ch] ?? FONT[ch.toUpperCase()] ?? FONT['?']).map((r) => unpack(r, 5, true));
export const hasGlyph = (ch: string) => ch in FONT || ch.toUpperCase() in FONT;

/** A string as one wide grid, a blank column between characters. */
export function textStrip(text: string): Grid {
	const rows = emptyGrid(0, 7);
	[...text].forEach((ch, i) => {
		const g = glyphGrid(ch);
		g.forEach((row, r) => rows[r].push(...(i ? [false] : []), ...row));
	});
	return rows;
}

/** Characters with no glyph (they are drawn as "?"). */
export const missingGlyphs = (text: string) => [...new Set([...text].filter((c) => !hasGlyph(c)))];

/** The window of a scrolling strip at an offset; the strip wraps with a gap of three columns. */
export function marqueeFrame(strip: Grid, offset: number, width: number): Grid {
	const period = (strip[0]?.length ?? 0) + 3;
	return strip.map((row) =>
		Array.from({ length: width }, (_, c) => ((offset + c) % period < row.length ? row[(offset + c) % period] : false))
	);
}

/** Every glyph in the font as column bytes, five per character. */
export const fontColumns = (msb = false): number[] =>
	[...FONT_CHARS].flatMap((ch) => gridBytes(glyphGrid(ch), 'cols', msb));

/** Rows as a short hex string for the link: first row first, each row's first pixel on the top bit. */
export const gridToHex = (g: Grid) => gridBytes(g, 'rows', true).map(hex2).join('');
export function gridFromHex(hex: string, w: number, h: number): Grid | undefined {
	if (!/^[0-9a-f]*$/i.test(hex) || hex.length !== 2 * h) return undefined;
	const bytes = (hex.match(/../g) ?? []).map((x) => parseInt(x, 16));
	return bytes.some((b) => b >> w) ? undefined : gridFromBytes(bytes, w, h, 'rows', true);
}
