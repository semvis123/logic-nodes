// Punched cards and paper tape: text to holes, and holes back to text.
//
// A card column or a tape frame is a small number whose set bits are its holes.
// Everything on the page (the drawing, the tables, the readings) is made from
// those numbers, so the picture and the decoded text cannot disagree.

export const MAX_CHARS = 80;
/** Shown where holes do not make a character this page knows. */
export const UNREADABLE = '▯';
export type Medium = 'card' | 'baudot' | 'ascii';

const popcount = (n: number) => n.toString(2).replace(/0/g, '').length;
const upper = (text: string) => [...text].map((c) => (c.toUpperCase().length === 1 ? c.toUpperCase() : c));

// ---- The 80-column card (IBM 029 character set) ----

/** Rows as printed, top to bottom. A column's 12-bit number keeps this order: row 12 is the top bit. */
export const ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const rowBit = (row: number) => 1 << (11 - ROWS.indexOf(row));
export const punchesOf = (mask: number) => ROWS.filter((r) => mask & rowBit(r));
// The 8 is written before the other digit, as IBM wrote it: 12-8-2, not 12-2-8.
export const punchLabel = (mask: number) => {
	const p = punchesOf(mask);
	const rank = (r: number) => (r === 8 && p.length > 1 && !p.includes(9) ? 0 : 1);
	const zones = p.filter((r) => r === 12 || r === 11 || (r === 0 && p.length > 1));
	return [...zones, ...p.filter((r) => !zones.includes(r)).sort((a, b) => rank(a) - rank(b))].join('-') || 'none';
};

// Letters and digits follow a rule (a zone punch plus a digit punch); the rest are listed as
// "character:rows". Any other punch pattern is simply not read.
const SPECIALS =
	'&:12 -:11 /:0-1 ¢:12-8-2 .:12-8-3 <:12-8-4 (:12-8-5 +:12-8-6 |:12-8-7 !:11-8-2 $:11-8-3 *:11-8-4 ):11-8-5 ;:11-8-6 ¬:11-8-7 ,:0-8-3 %:0-8-4 _:0-8-5 >:0-8-6 ?:0-8-7 ::8-2 #:8-3 @:8-4 \':8-5 =:8-6 ":8-7';

export const CARD_CODE: { ch: string; mask: number }[] = [{ ch: ' ', mask: 0 }];
for (let d = 0; d <= 9; d++) CARD_CODE.push({ ch: String(d), mask: rowBit(d) });
[
	['ABCDEFGHI', 12, 1],
	['JKLMNOPQR', 11, 1],
	['STUVWXYZ', 0, 2]
].forEach(([letters, zone, first]) =>
	[...(letters as string)].forEach((ch, i) =>
		CARD_CODE.push({ ch, mask: rowBit(zone as number) | rowBit((first as number) + i) })
	)
);
for (const s of SPECIALS.split(' '))
	CARD_CODE.push({
		ch: s[0],
		mask: s
			.slice(2)
			.split('-')
			.reduce((m, r) => m | rowBit(+r), 0)
	});

const MASK_OF = new Map(CARD_CODE.map((c) => [c.ch, c.mask]));
const CHAR_OF = new Map(CARD_CODE.map((c) => [c.mask, c.ch]));

/**
 * The EBCDIC byte a column becomes in memory: the zone punch (12, 11, 0 or none) picks the high
 * nibble, and the digit punch the low one. With an 8 punch, the other digit is added to 8.
 * Undefined for punch patterns that are not a character here.
 */
export function ebcdic(mask: number): number | undefined {
	const p = punchesOf(mask);
	if (!p.length) return 0x40;
	if (p.length === 1 && p[0] === 0) return 0xf0;
	if (p.includes(12) && p.includes(11)) return undefined;
	const zone = p.includes(12) ? 12 : p.includes(11) ? 11 : p.includes(0) ? 0 : -1;
	if (zone !== -1 && zone !== 0 && p.includes(0)) return undefined;
	const d = p.filter((r) => r >= 1 && r <= 9);
	const letters: Record<number, number> = { 12: 0xc0, 11: 0xd0, 0: 0xe0, [-1]: 0xf0 };
	const symbols: Record<number, number> = { 12: 0x40, 11: 0x50, 0: 0x60, [-1]: 0x70 };
	if (!d.length) return zone === 12 ? 0x50 : zone === 11 ? 0x60 : undefined;
	if (d.length === 1) return zone === 0 && d[0] === 1 ? 0x61 : letters[zone] + d[0];
	if (d.length === 2 && d[1] === 8 && d[0] < 8) return symbols[zone] + 8 + d[0];
	return undefined;
}

export interface Punched {
	cells: number[];
	/** Problems worth telling the person about; empty when the text went in as typed. */
	notes: string[];
}

/** Punches text onto a card: one column per character, capitals only, blank where unknown. */
export function punchCard(text: string): Punched {
	const chars = upper(text);
	const notes: string[] = [];
	if (chars.length > MAX_CHARS)
		notes.push(`A card has ${MAX_CHARS} columns, so the last ${chars.length - MAX_CHARS} characters were cut.`);
	const kept = chars.slice(0, MAX_CHARS);
	const bad = [...new Set(kept.filter((c) => !MASK_OF.has(c)))];
	if (bad.length) notes.push(`Not in this page's card code, so left blank: ${bad.join(' ')}`);
	const cells = kept.map((c) => MASK_OF.get(c) ?? 0);
	while (cells.length < MAX_CHARS) cells.push(0);
	return { cells, notes };
}

/** One sentence naming every position that is a problem, rather than one alert each. */
const listNote = (noun: string, at: number[], what: string) =>
	at.length
		? [
				`${noun}${at.length > 1 ? 's' : ''} ${at.join(', ')} ${at.length > 1 ? 'are' : 'is'} not ${what}, so ${
					at.length > 1 ? 'they read' : 'it reads'
				} as ${UNREADABLE}.`
		  ]
		: [];

export interface Reading {
	text: string;
	notes: string[];
}

/** Reads a card back. Trailing blank columns are dropped; a column that is no character reads as ▯. */
export function readCard(cells: number[]): Reading {
	const bad: number[] = [];
	const text = cells.map((m, i) => {
		const ch = CHAR_OF.get(m & 0xfff);
		if (ch === undefined) bad.push(i + 1);
		return ch ?? UNREADABLE;
	});
	return { text: text.join('').replace(/ +$/, ''), notes: listNote('Column', bad, 'a character this page knows') };
}

// ---- Baudot (ITA2) tape ----

// Code values 0 to 31, in order, for each shift. Names are not text: NUL is a blank frame, NAT is
// a position that differs between countries, VAR is one whose figure varies between sources (so it
// is not read), ENQ and BEL are signalling codes.
const LETTERS = 'NUL E LF A SP S I U CR D R J N F C K T Z L W H Y P Q O B G FIGS M X V LTRS'.split(' ');
const FIGURES = "NUL 3 LF - SP ' 8 7 CR ENQ 4 BEL , NAT : ( 5 + ) 2 NAT 6 0 1 9 ? NAT FIGS . / VAR LTRS".split(' ');
const LTRS = 31;
const FIGS = 27;
const TEXT_TOKEN: Record<string, string> = { SP: ' ', LF: '\n', CR: '\r' };
const tokenText = (t: string) => TEXT_TOKEN[t] ?? (t.length === 1 ? t : undefined);

/** For each text character: its code, and which shift it needs (both for space, CR and LF). */
const BAUDOT_OF = new Map<string, { code: number; shift?: 'L' | 'F' }>();
LETTERS.forEach((t, code) => {
	const ch = tokenText(t);
	if (ch) BAUDOT_OF.set(ch, { code, shift: /[A-Z]/.test(ch) ? 'L' : undefined });
});
FIGURES.forEach((t, code) => {
	const ch = tokenText(t);
	if (ch && !BAUDOT_OF.has(ch)) BAUDOT_OF.set(ch, { code, shift: 'F' });
});

/** What one frame shows and reads as; `ok` is false for a parity error or an unreadable code. */
export interface Frame {
	out: string;
	label: string;
	note: string;
	ok: boolean;
}
const SHORT: Record<string, string> = { SP: 'sp', LTRS: 'LT', FIGS: 'FG' };
const LONG: Record<string, string> = {
	NUL: 'a blank frame',
	LTRS: 'the letters shift',
	FIGS: 'the figures shift',
	LF: 'line feed',
	CR: 'carriage return',
	SP: 'a space'
};

/** Reads Baudot frames in order, following the shifts. Reading starts in letters. */
export function readBaudot(frames: number[]): Frame[] {
	let figures = false;
	return frames.map((f, i) => {
		const t = f >= 0 && f < 32 ? (figures ? FIGURES : LETTERS)[f] : 'NAT';
		if (f === LTRS || f === FIGS) figures = f === FIGS;
		const ch = tokenText(t);
		const out =
			t === 'CR' && frames[i + 1] === 2 ? '' : t === 'NUL' || f === LTRS || f === FIGS ? '' : ch ?? UNREADABLE;
		const ok = ch !== undefined || t === 'NUL' || f === LTRS || f === FIGS;
		return {
			out,
			label: SHORT[t] ?? (['NAT', 'VAR', 'ENQ', 'BEL'].includes(t) ? '?' : t),
			note: ok ? `${LONG[t] ?? t}` : 'is not a character this page reads',
			ok
		};
	});
}

/** Punches text as Baudot frames. Starts in letters and adds a shift only when the set changes. */
export function punchBaudot(text: string): Punched {
	const chars = upper(text);
	const notes: string[] = [];
	if (chars.length > MAX_CHARS) notes.push(`Only the first ${MAX_CHARS} characters were punched.`);
	const cells: number[] = [];
	const bad = new Set<string>();
	let figures = false;
	for (const c of chars.slice(0, MAX_CHARS)) {
		for (const ch of c === '\n' ? ['\r', '\n'] : [c]) {
			const e = BAUDOT_OF.get(ch);
			if (!e) bad.add(c);
			else {
				if (e.shift && (e.shift === 'F') !== figures) {
					figures = e.shift === 'F';
					cells.push(figures ? FIGS : LTRS);
				}
				cells.push(e.code);
			}
		}
	}
	if (bad.size) notes.push(`Not in the Baudot code, so skipped: ${[...bad].join(' ')}`);
	return { cells, notes };
}

// ---- Eight-level ASCII tape: 7 data bits plus an even parity bit in track 8 ----

const withParity = (code: number) => code | ((popcount(code) & 1) << 7);
const asciiOk = (c: string) => /^[ -~\r\n]$/.test(c);

export function readAscii(frames: number[]): Frame[] {
	return frames.map((f) => {
		const code = f & 127;
		const parity = f >= 0 && f < 256 && popcount(f) % 2 === 0;
		const printable = code >= 32 && code < 127;
		const name =
			code === 10 ? 'LF' : code === 13 ? 'CR' : code === 32 ? 'sp' : printable ? String.fromCharCode(code) : '?';
		const known = printable || code === 10 || code === 13;
		const out = known ? String.fromCharCode(code) : f === 0 ? '' : UNREADABLE;
		const problem = !parity
			? 'fails the even parity check'
			: !known && f !== 0
			? 'is not a character this page reads'
			: '';
		return {
			out,
			label: f === 0 ? '' : name,
			note: problem || (f === 0 ? 'a blank frame' : `code ${code}`),
			ok: !problem
		};
	});
}

export function punchAscii(text: string): Punched {
	const chars = [...text];
	const notes: string[] = [];
	if (chars.length > MAX_CHARS) notes.push(`Only the first ${MAX_CHARS} characters were punched.`);
	const kept = chars.slice(0, MAX_CHARS);
	const bad = [...new Set(kept.filter((c) => !asciiOk(c)))];
	if (bad.length) notes.push(`Not printable ASCII, so skipped: ${bad.join(' ')}`);
	return { cells: kept.filter(asciiOk).map((c) => withParity(c.charCodeAt(0))), notes };
}

// ---- One interface for all three media ----

export const TRACKS: Record<Medium, number> = { card: 12, baudot: 5, ascii: 8 };
export const punch = (medium: Medium, text: string) =>
	medium === 'card' ? punchCard(text) : medium === 'baudot' ? punchBaudot(text) : punchAscii(text);

export function read(medium: Medium, cells: number[]): Reading {
	if (medium === 'card') return readCard(cells);
	const frames = medium === 'baudot' ? readBaudot(cells) : readAscii(cells);
	const notes = frames.flatMap((f, i) => (f.ok ? [] : [`Frame ${i + 1} ${f.note}.`]));
	const more = notes.length - 2;
	return {
		text: frames.map((f) => f.out).join(''),
		notes: more > 1 ? [...notes.slice(0, 2), `${more} more frames have a problem.`] : notes
	};
}

/** One sentence about a column or frame, for the readout under the drawing. */
export function describe(medium: Medium, cells: number[], i: number): string {
	const v = cells[i];
	if (v === undefined) return '';
	if (medium === 'card') {
		const ch = CHAR_OF.get(v);
		const e = ebcdic(v);
		const what = ch === undefined ? 'no known character' : ch === ' ' ? 'a space' : `reads as ${ch}`;
		return `Column ${i + 1}: punches ${punchLabel(v)}, ${what}${
			ch !== undefined && e !== undefined ? `, EBCDIC ${e.toString(16).toUpperCase()}` : ''
		}.`;
	}
	const n = TRACKS[medium];
	const f = (medium === 'baudot' ? readBaudot(cells) : readAscii(cells))[i];
	const holes = [...Array(n)].map((_, t) => t + 1).filter((t) => v & (1 << (t - 1)));
	return `Frame ${i + 1}: tracks ${n} to 1 are ${v.toString(2).padStart(n, '0')} (holes in track ${
		holes.join(', ') || 'none'
	}), ${
		f.ok
			? f.out && f.out.trim()
				? `reads as ${f.out === '\n' ? 'line feed' : f.out === '\r' ? 'carriage return' : f.out}`
				: f.note
			: f.note
	}.`;
}

// ---- Drawing: the same numbers as an SVG scene ----

const CREAM = '#e8d9ae';
const INK = '#3a2f14';
const FAINT = '#6a5a30';
const LIGHT = '#ccc';
const HOLE = '#15130e';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Glyphs at their own x positions, in one element: the string and the positions pair up. */
function glyphs(pairs: [number, string][], y: number, size: number, fill: string, anchor = 'middle') {
	const one = (xs: number[], str: string) =>
		`<text x="${xs.join(
			' '
		)}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-family="ui-monospace,Menlo,monospace">${esc(
			str
		)}</text>`;
	if (!pairs.length) return '';
	// One element with a position per glyph is compact, but only works for single characters.
	return pairs.every((p) => p[1].length === 1)
		? one(
				pairs.map((p) => p[0]),
				pairs.map((p) => p[1]).join('')
		  )
		: pairs.map((p) => one([p[0]], p[1])).join('');
}

/** Where a click lands: `bit` is the hole it toggles in cell `col`. */
export interface Hit {
	col: number;
	bit: number;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
}
export interface Scene {
	w: number;
	h: number;
	inner: string;
	hits: Hit[];
	/** The vertical band of one column, for the highlight. */
	band: (col: number) => { x: number; y: number; w: number; h: number };
}
export const sceneSvg = (s: Scene) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}">${s.inner}</svg>`;

/** A card of `columns` columns (80 for a real one; fewer crops it for an exercise).
 * `printed` false leaves the characters off the top edge, so an exercise does not give its answer away. */
export function cardScene(cells: number[], columns = MAX_CHARS, printed = true): Scene {
	const cw = 11,
		rh = 20,
		left = 30,
		top = 34;
	const w = left + columns * cw + 12;
	const h = top + 12 * rh + 24;
	const cx = (c: number) => left + c * cw + cw / 2;
	const cy = (r: number) => top + r * rh + rh / 2;
	let inner = `<path d="M14 0H${w - 1}V${h - 1}H0V14Z" fill="${CREAM}" stroke="#8a7a4e"/>`;
	const chars = printed
		? cells.slice(0, columns).map((m, c) => [cx(c), CHAR_OF.get(m) ?? UNREADABLE] as [number, string])
		: [];
	inner += glyphs(
		chars.filter((p) => p[1] !== ' '),
		top - 9,
		10,
		INK
	);
	ROWS.forEach((row, r) => {
		inner += glyphs([[left - 6, String(row)]], cy(r) + 3, 9, INK, 'end');
		if (row <= 9)
			inner += glyphs(
				[...Array(columns)].map((_, c) => [cx(c), String(row)] as [number, string]),
				cy(r) + 2.5,
				7,
				FAINT
			);
	});
	inner += glyphs(
		[1, ...Array.from({ length: columns / 10 }, (_, i) => (i + 1) * 10)]
			.filter((n) => n <= columns)
			.map((n) => [cx(n - 1), String(n)] as [number, string]),
		h - 8,
		8,
		FAINT
	);
	const hits: Hit[] = [];
	for (let c = 0; c < columns; c++)
		ROWS.forEach((row, r) => {
			const bit = rowBit(row);
			if (cells[c] & bit)
				inner += `<rect x="${cx(c) - 3}" y="${cy(r) - 5.5}" width="6" height="11" rx="1" fill="${HOLE}"/>`;
			hits.push({
				col: c,
				bit,
				x: cx(c) - cw / 2,
				y: cy(r) - rh / 2,
				w: cw,
				h: rh,
				label: `Column ${c + 1}, row ${row}`
			});
		});
	return { w, h, inner, hits, band: (c) => ({ x: cx(c) - cw / 2, y: top, w: cw, h: 12 * rh }) };
}

/** Paper tape: frames left to right, track 1 (the least significant bit) at the bottom. */
export function tapeScene(medium: 'baudot' | 'ascii', cells: number[]): Scene {
	const n = TRACKS[medium];
	const frames = medium === 'baudot' ? readBaudot(cells) : readAscii(cells);
	const pitch = 16,
		rh = 15,
		left = 48,
		top = 24;
	// The feed holes sit off centre: after track 3 (counting down) in eight-level tape, after track 2 in five-level tape.
	const below = n === 8 ? 3 : 2;
	const slots = [...Array(n)].map((_, i) => n - i);
	slots.splice(n - below, 0, 0);
	const h = top + slots.length * rh + 8 + 20;
	const w = Math.max(left + cells.length * pitch + 12, 200);
	const tapeH = slots.length * rh + 8;
	const cx = (f: number) => left + f * pitch + pitch / 2;
	const cy = (s: number) => top + 4 + s * rh + rh / 2;
	let inner = `<rect width="${w}" height="${h}" fill="#17171a"/><rect x="${left - 6}" y="${top}" width="${
		w - left + 6
	}" height="${tapeH}" fill="${CREAM}" stroke="#8a7a4e"/>`;
	slots.forEach((t, s) => {
		inner += glyphs([[left - 12, t ? String(t) : 'feed']], cy(s) + 3, 9, LIGHT, 'end');
		if (!t) cells.forEach((_, f) => (inner += `<circle cx="${cx(f)}" cy="${cy(s)}" r="2.5" fill="${HOLE}"/>`));
	});
	inner += glyphs(
		frames.map((f, i) => [cx(i), f.label] as [number, string]).filter((p) => p[1]),
		top - 6,
		10,
		LIGHT
	);
	inner += glyphs(
		cells.map((v, i) => [cx(i), (v & 255).toString(16).toUpperCase().padStart(2, '0')] as [number, string]),
		h - 4,
		8,
		LIGHT
	);
	const hits: Hit[] = [];
	cells.forEach((v, f) =>
		slots.forEach((t, s) => {
			if (!t) return;
			const bit = 1 << (t - 1);
			if (v & bit) inner += `<circle cx="${cx(f)}" cy="${cy(s)}" r="4.5" fill="${HOLE}"/>`;
			hits.push({
				col: f,
				bit,
				x: cx(f) - pitch / 2,
				y: cy(s) - rh / 2,
				w: pitch,
				h: rh,
				label: `Frame ${f + 1}, track ${t}`
			});
		})
	);
	return { w, h, inner, hits, band: (f) => ({ x: cx(f) - pitch / 2, y: top, w: pitch, h: tapeH }) };
}

export const scene = (medium: Medium, cells: number[]) =>
	medium === 'card' ? cardScene(cells) : tapeScene(medium, cells);

// ---- Compact links: 12 bits per cell as two characters of a 64-character alphabet ----

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

export function packCells(cells: number[]): string {
	return cells.map((v) => ALPHABET[(v >> 6) & 63] + ALPHABET[v & 63]).join('');
}

/** The cells a packed string holds, or undefined if it is not one this page wrote (or is too long). */
export function unpackCells(s: string, limit: number, medium: Medium): number[] | undefined {
	if (s.length % 2 || s.length / 2 > limit || [...s].some((c) => !ALPHABET.includes(c))) return undefined;
	const cells = s.match(/../g)?.map((p) => (ALPHABET.indexOf(p[0]) << 6) | ALPHABET.indexOf(p[1])) ?? [];
	if (cells.some((v) => v >= 1 << TRACKS[medium])) return undefined;
	while (medium === 'card' && cells.length < MAX_CHARS) cells.push(0);
	return cells;
}

// ---- Tables for the page ----

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

export const cardTable = () =>
	CARD_CODE.map(({ ch, mask }) => ({
		ch,
		punches: punchLabel(mask),
		column: mask.toString(2).padStart(12, '0'),
		ebcdic: hex2(ebcdic(mask) ?? 0)
	}));

const NAME: Record<string, string> = {
	NUL: 'blank',
	SP: 'space',
	NAT: 'national use',
	VAR: 'varies',
	LTRS: 'LTRS',
	FIGS: 'FIGS',
	ENQ: 'ENQ',
	BEL: 'BEL'
};
export const baudotTable = () =>
	LETTERS.map((l, code) => ({
		code: code.toString(2).padStart(5, '0'),
		letters: NAME[l] ?? l,
		figures: NAME[FIGURES[code]] ?? FIGURES[code]
	}));

/** How the text `s` is punched on a card, column by column, for the worked example. */
export const workingColumns = (s: string) =>
	[...s]
		.map((ch) => ({ ch, mask: MASK_OF.get(ch) ?? 0 }))
		.map(({ ch, mask }) => ({
			ch,
			punches: punchLabel(mask),
			column: mask.toString(2).padStart(12, '0'),
			ebcdic: hex2(ebcdic(mask) ?? 0)
		}));
