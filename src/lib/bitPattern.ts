// Bitwise pattern generator: a small expression language over x, y and t, a
// parser that compiles it to a closure, and the colouring and SVG output.
//
// There is no eval and no new Function here. A page that runs whatever is in a
// shared link has to parse it itself, and a hand-written parser also gives
// errors that name a position.
//
// The arithmetic is 32-bit two's complement, like C's int on every machine
// people draw this on. Division and remainder by zero give 0, which beats
// stopping half way through an image (row 0 of `x % y` is not an error).
// Shift counts use their low 5 bits, as JavaScript and most CPUs do.
//
// Seven functions are there for moving pictures: abs, min, max, sqrt (the integer
// part), sin and cos, which take a whole turn as 256 and give -127 to 127, and
// atan2(y, x), which goes the other way: the direction of the point (x, y) as a
// whole turn of 256, so spirals and sweeps need no table.

import type { Layout, Tone } from '$lib/arithmetic';

export class PatternError extends Error {
	/** One-based character position, to match the ErrorAt component. */
	at: number;
	constructor(message: string, at: number) {
		super(message);
		this.at = at;
	}
}

export type Fn = (x: number, y: number, t: number) => number;

/** op is 'num', 'x', 'y', 't', 'u-', 'u~', 'u+', 'f:name' for a function, or the binary operator itself. */
export interface Node {
	op: string;
	a?: Node;
	b?: Node;
	v?: number;
	/** Source span, parentheses included. */
	s: number;
	e: number;
}

export const MAX_LENGTH = 400;
const MAX_DEPTH = 64;
// Lowest precedence first, as in C: | ^ & shifts, then + -, then * / %.
/** Function names and how many arguments each takes. */
export const FUNCS: Record<string, number> = { abs: 1, min: 2, max: 2, sqrt: 1, sin: 1, cos: 1, atan2: 2 };
/** sin of a whole turn split into 256 steps, scaled to 127 and rounded. */
export const SIN = Int8Array.from({ length: 256 }, (_, i) => Math.round(127 * Math.sin((2 * Math.PI * i) / 256)));
/**
 * The direction of (x, y) as a whole turn of 256, 0 to 255, counted from the
 * positive x axis towards positive y (which is down the screen). Rounded to the
 * nearest step. atan2(0, 0) is 0.
 */
export const angleOf = (y: number, x: number) => Math.round((Math.atan2(y, x) * 256) / (2 * Math.PI)) & 255;
const LEVELS = ['|', '^', '&', '<< >>', '+ -', '* / %'].map((l) => l.split(' '));

export function parse(src: string): Node {
	if (src.length > MAX_LENGTH)
		throw new PatternError(`Expression is longer than ${MAX_LENGTH} characters`, MAX_LENGTH + 1);
	type Tok = { k: 'n' | 'id' | 'op' | '(' | ')' | ',' | 'end'; text: string; v?: number; s: number; e: number };
	const toks: Tok[] = [];
	for (let i = 0; i < src.length; ) {
		const c = src[i];
		if (/\s/.test(c)) {
			i++;
		} else if (/[0-9]/.test(c)) {
			const m = /^(0[xX][0-9a-fA-F]*|0[bB][01]*|[0-9]+)/.exec(src.slice(i))?.[0] ?? '';
			const body = m.slice(2);
			if (/^0[xXbB]$/.test(m.slice(0, 2)) && !body)
				throw new PatternError(`${m} has no digits after the prefix`, i + 1);
			const v = /^0[xX]/.test(m) ? parseInt(body, 16) : /^0[bB]/.test(m) ? parseInt(body, 2) : parseInt(m, 10);
			const after = src[i + m.length];
			if (after && /[0-9a-zA-Z_]/.test(after))
				throw new PatternError(`Unexpected ${after} in a number at position ${i + m.length + 1}`, i + m.length + 1);
			if (v > 0xffffffff) throw new PatternError(`${m} does not fit in 32 bits`, i + 1);
			toks.push({ k: 'n', text: m, v: v | 0, s: i, e: i + m.length });
			i += m.length;
		} else if (/[a-zA-Z_]/.test(c)) {
			const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i))?.[0] ?? '';
			if (!['x', 'y', 't'].includes(m) && !(m in FUNCS))
				throw new PatternError(
					`Unknown name ${m} at position ${i + 1}: use x, y, t or a function (${Object.keys(FUNCS).join(', ')})`,
					i + 1
				);
			toks.push({ k: 'id', text: m, s: i, e: i + m.length });
			i += m.length;
		} else if (c === '<' || c === '>') {
			if (src[i + 1] !== c)
				throw new PatternError(
					`Use ${c}${c} to shift: a single ${c} at position ${i + 1} is a comparison, which is not supported`,
					i + 1
				);
			toks.push({ k: 'op', text: c + c, s: i, e: i + 2 });
			i += 2;
		} else if ('~+-*/%&^|'.includes(c)) {
			toks.push({ k: 'op', text: c, s: i, e: i + 1 });
			i++;
		} else if (c === '(' || c === ')' || c === ',') {
			toks.push({ k: c, text: c, s: i, e: i + 1 });
			i++;
		} else {
			throw new PatternError(`Unexpected character ${c} at position ${i + 1}`, i + 1);
		}
	}
	toks.push({ k: 'end', text: '', s: src.length, e: src.length });

	let p = 0;
	const unexpected = (tok: Tok) =>
		tok.k === 'end' && !toks[1]
			? new PatternError('Type an expression using x, y or t, for example x ^ y', 1)
			: tok.k === 'end'
			? new PatternError(
					`The expression ends too soon: something is missing after position ${src.trimEnd().length}`,
					Math.max(src.trimEnd().length, 1)
			  )
			: new PatternError(`Unexpected ${tok.text} at position ${tok.s + 1}`, tok.s + 1);
	function unary(depth: number): Node {
		const tok = toks[p];
		if (depth > MAX_DEPTH)
			throw new PatternError(`Nested more than ${MAX_DEPTH} levels deep at position ${tok.s + 1}`, tok.s + 1);
		if (tok.k === 'op' && '~-+'.includes(tok.text)) {
			p++;
			const a = unary(depth + 1);
			return { op: 'u' + tok.text, a, s: tok.s, e: a.e };
		}
		p++;
		if (tok.k === 'n') return { op: 'num', v: tok.v, s: tok.s, e: tok.e };
		if (tok.k === 'id' && tok.text in FUNCS) {
			if (toks[p].k !== '(')
				throw new PatternError(`${tok.text} needs ( and its argument after it, at position ${tok.e + 1}`, tok.e + 1);
			p++;
			const a = binary(0, depth + 1);
			let b: Node | undefined;
			if (FUNCS[tok.text] === 2) {
				if (toks[p].k !== ',')
					throw new PatternError(`${tok.text} needs two arguments, separated by a comma`, toks[p].s + 1);
				p++;
				b = binary(0, depth + 1);
			}
			const close = toks[p];
			if (close.k !== ')')
				throw close.k === 'end'
					? new PatternError(`The ( at position ${tok.e + 1} is never closed`, tok.e + 1)
					: unexpected(close);
			p++;
			return { op: 'f:' + tok.text, a, b, s: tok.s, e: close.e };
		}
		if (tok.k === 'id') return { op: tok.text, s: tok.s, e: tok.e };
		if (tok.k === '(') {
			const inner = binary(0, depth + 1);
			const close = toks[p];
			if (close.k !== ')')
				throw close.k === 'end'
					? new PatternError(`The ( at position ${tok.s + 1} is never closed`, tok.s + 1)
					: unexpected(close);
			p++;
			return { ...inner, s: tok.s, e: close.e };
		}
		p--;
		throw unexpected(tok);
	}
	function binary(level: number, depth: number): Node {
		if (level === LEVELS.length) return unary(depth);
		let left = binary(level + 1, depth);
		while (toks[p].k === 'op' && LEVELS[level].includes(toks[p].text)) {
			const op = toks[p++].text;
			const right = binary(level + 1, depth);
			left = { op, a: left, b: right, s: left.s, e: right.e };
		}
		return left;
	}
	const root = binary(0, 0);
	if (toks[p].k !== 'end') throw unexpected(toks[p]);
	return root;
}

const NIL: Fn = () => 0;

/** Turns a tree into closures once, so drawing 65,536 pixels is not 65,536 tree walks. */
export function build(n: Node): Fn {
	const a = n.a ? build(n.a) : NIL;
	const b = n.b ? build(n.b) : NIL;
	switch (n.op) {
		case 'num': {
			const v = n.v ?? 0;
			return () => v;
		}
		case 'x':
			return (x) => x;
		case 'y':
			return (_x, y) => y;
		case 't':
			return (_x, _y, t) => t;
		case 'u-':
			return (x, y, t) => -a(x, y, t) | 0;
		case 'u~':
			return (x, y, t) => ~a(x, y, t);
		case 'u+':
			return a;
		case '+':
			return (x, y, t) => (a(x, y, t) + b(x, y, t)) | 0;
		case '-':
			return (x, y, t) => (a(x, y, t) - b(x, y, t)) | 0;
		case '*':
			return (x, y, t) => Math.imul(a(x, y, t), b(x, y, t));
		case '/':
			return (x, y, t) => {
				const d = b(x, y, t);
				return d === 0 ? 0 : (a(x, y, t) / d) | 0;
			};
		case '%':
			return (x, y, t) => {
				const d = b(x, y, t);
				return d === 0 ? 0 : a(x, y, t) % d | 0;
			};
		case 'f:abs':
			return (x, y, t) => {
				const v = a(x, y, t);
				return v < 0 ? -v | 0 : v;
			};
		case 'f:min':
			return (x, y, t) => Math.min(a(x, y, t), b(x, y, t));
		case 'f:max':
			return (x, y, t) => Math.max(a(x, y, t), b(x, y, t));
		case 'f:sqrt':
			return (x, y, t) => {
				const v = a(x, y, t);
				return v > 0 ? Math.floor(Math.sqrt(v)) : 0;
			};
		case 'f:sin':
			return (x, y, t) => SIN[a(x, y, t) & 255];
		case 'f:cos':
			return (x, y, t) => SIN[(a(x, y, t) + 64) & 255];
		case 'f:atan2':
			return (x, y, t) => angleOf(a(x, y, t), b(x, y, t));
		case '<<':
			return (x, y, t) => a(x, y, t) << b(x, y, t);
		case '>>':
			return (x, y, t) => a(x, y, t) >> b(x, y, t);
		case '&':
			return (x, y, t) => a(x, y, t) & b(x, y, t);
		case '^':
			return (x, y, t) => a(x, y, t) ^ b(x, y, t);
		default:
			return (x, y, t) => a(x, y, t) | b(x, y, t);
	}
}

export const compile = (src: string): Fn => build(parse(src));

/** A pixel's value is the low 8 bits of the result. */
export const byteOf = (n: number) => n & 255;

/** Values for a size by size grid; step spaces the samples out (used by thumbnails). */
export function evalGrid(fn: Fn, size: number, t: number, step = 1): Uint8Array {
	const out = new Uint8Array(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = fn(x * step, y * step, t) & 255;
	return out;
}

// --- Bit by bit working for one pixel ---

export const BIT_OPS: Record<string, string> = { '&': 'AND', '^': 'XOR', '|': 'OR' };

export interface Working {
	op: string;
	aText: string;
	bText: string;
	a: number;
	b: number;
	result: number;
}

/**
 * When the whole expression is one AND, XOR or OR of two parts, returns what
 * each part is and what it is at this pixel; otherwise null, and the page just
 * shows the value. Only the low 8 bits matter to the picture and to these three
 * operators, so the working is shown in 8 columns.
 */
export function rootWorking(src: string, node: Node) {
	const { a: left, b: right } = node;
	if (!(node.op in BIT_OPS) || !left || !right) return null;
	const a = build(left);
	const b = build(right);
	const full = build(node);
	return (x: number, y: number, t: number): Working => ({
		op: node.op,
		aText: src.slice(left.s, left.e),
		bText: src.slice(right.s, right.e),
		a: a(x, y, t),
		b: b(x, y, t),
		result: full(x, y, t)
	});
}

export const bits8 = (n: number) => (n & 255).toString(2).padStart(8, '0');

/** The three rows (A, op B, result) as a column working, for ColumnWorking. */
export function workingLayout(w: Working): Layout {
	const cells = (n: number, tone?: Tone) => [...bits8(n)].map((text) => ({ text, tone }));
	return {
		columns: 8,
		groupEvery: 4,
		rows: [
			{ sign: '', kind: 'operand', label: 'A', cells: cells(w.a) },
			{ sign: w.op, kind: 'operand', label: 'B', cells: cells(w.b) },
			{ sign: '', kind: 'result', label: BIT_OPS[w.op], cells: cells(w.result, 'result'), rule: true }
		]
	};
}

// --- Colour ---

export type Mode = 'grey' | 'bit' | 'palette' | 'rgb';
export const MODES: { id: Mode; label: string }[] = [
	{ id: 'grey', label: 'Greyscale' },
	{ id: 'bit', label: 'One bit' },
	{ id: 'palette', label: 'Palette' },
	{ id: 'rgb', label: 'RGB' }
];

const rgb = (r: number, g: number, b: number) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
const cosine = (t: number, c: number[], d: number[]) => {
	const ch = (i: number) => 255 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (c[i] * t + d[i])));
	return rgb(ch(0), ch(1), ch(2));
};
const lerp = (stops: number[][], t: number) => {
	const f = t * (stops.length - 1);
	const i = Math.min(Math.floor(f), stops.length - 2);
	const u = f - i;
	return rgb(...([0, 1, 2].map((k) => stops[i][k] + (stops[i + 1][k] - stops[i][k]) * u) as [number, number, number]));
};

/** Ramps built by formula; each maps 0 to 255 to a colour, and none is stored. */
export const PALETTES: { id: string; label: string; at: (t: number) => number }[] = [
	{
		id: 'fire',
		label: 'Fire',
		at: (t) =>
			lerp(
				[
					[0, 0, 0],
					[140, 20, 10],
					[235, 100, 10],
					[255, 220, 90],
					[255, 255, 240]
				],
				t
			)
	},
	{ id: 'spectrum', label: 'Spectrum', at: (t) => cosine(t, [0.9, 0.9, 0.9], [0, 0.33, 0.67]) },
	{
		id: 'ocean',
		label: 'Ocean',
		at: (t) =>
			lerp(
				[
					[5, 10, 40],
					[10, 70, 130],
					[30, 170, 170],
					[190, 240, 210]
				],
				t
			)
	},
	{
		id: 'sunset',
		label: 'Sunset',
		at: (t) =>
			lerp(
				[
					[20, 5, 50],
					[120, 20, 110],
					[230, 70, 70],
					[255, 180, 80],
					[255, 245, 200]
				],
				t
			)
	}
];

const ramps = new Map<string, number[]>();
function ramp(id: string): number[] {
	let r = ramps.get(id);
	if (!r) {
		const p = PALETTES.find((q) => q.id === id) ?? PALETTES[0];
		r = Array.from({ length: 256 }, (_, i) => p.at(i / 255));
		ramps.set(id, r);
	}
	return r;
}

export interface Look {
	mode: Mode;
	bit: number;
	pal: string;
}

const BIT_ON = 0xe8e8e8;
const BIT_OFF = 0x101014;

/** Packed 0xRRGGBB colour for a pixel. In RGB mode the three values are red, green, blue. */
export function colourOf(look: Look, v: number, g = v, b = v): number {
	switch (look.mode) {
		case 'bit':
			return (v >> look.bit) & 1 ? BIT_ON : BIT_OFF;
		case 'palette':
			return ramp(look.pal)[v];
		case 'rgb':
			return (v << 16) | (g << 8) | b;
		default:
			return v * 0x010101;
	}
}

/**
 * The colours of a whole grid: one function normally, three in RGB mode. Pass
 * `out` to reuse a buffer between frames. Single-function modes look each
 * value up in a 256-entry table instead of working the colour out per pixel.
 */
export function paint(
	fns: Fn[],
	look: Look,
	size: number,
	t: number,
	step = 1,
	out = new Uint32Array(size * size)
): Uint32Array {
	const [f, g, h] = fns;
	if (look.mode === 'rgb' && g && h) {
		for (let y = 0, i = 0; y < size; y++)
			for (let x = 0; x < size; x++, i++) {
				const X = x * step;
				const Y = y * step;
				out[i] = ((f(X, Y, t) & 255) << 16) | ((g(X, Y, t) & 255) << 8) | (h(X, Y, t) & 255);
			}
		return out;
	}
	const lut = Uint32Array.from({ length: 256 }, (_, v) => colourOf(look, v));
	for (let y = 0, i = 0; y < size; y++)
		for (let x = 0; x < size; x++, i++) out[i] = lut[f(x * step, y * step, t) & 255];
	return out;
}

/** Copies packed 0xRRGGBB colours into canvas pixel data (RGBA bytes). */
export function toRgba(colours: ArrayLike<number>, data: Uint8ClampedArray) {
	for (let i = 0, j = 0; i < colours.length; i++, j += 4) {
		const c = colours[i];
		// Masked, because a clamped array saturates at 255 instead of keeping the low byte.
		data[j] = (c >> 16) & 255;
		data[j + 1] = (c >> 8) & 255;
		data[j + 2] = c & 255;
		data[j + 3] = 255;
	}
}

const hex6 = (c: number) => '#' + c.toString(16).padStart(6, '0');
export { hex6 as hexColour };

/**
 * Inline SVG of the grid. Equal neighbours along a row are merged into one
 * horizontal line, and the commonest colour is a background rectangle that its
 * own runs are left out of, which also hides hairline seams between runs at
 * fractional zoom. `cell` is the size of one pixel in the file's own units.
 */
export function toSvg(colours: ArrayLike<number>, size: number, cell = 1, label = ''): string {
	const count = new Map<number, number>();
	for (let i = 0; i < colours.length; i++) count.set(colours[i], (count.get(colours[i]) ?? 0) + 1);
	let bg = colours[0];
	let most = 0;
	for (const [c, n] of count)
		if (n > most) {
			most = n;
			bg = c;
		}
	// Each colour is one path; after the first run, moves are relative to where the last run ended.
	const paths = new Map<number, { d: string; x: number; y: number }>();
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; ) {
			const c = colours[y * size + x];
			let w = 1;
			while (x + w < size && colours[y * size + x + w] === c) w++;
			if (c !== bg) {
				const p = paths.get(c);
				if (p) p.d += `m${x - p.x} ${y - p.y}h${w}`;
				const q = p ?? { d: `M${x} ${y + 0.5}h${w}`, x: 0, y: 0 };
				[q.x, q.y] = [x + w, y];
				paths.set(c, q);
			}
			x += w;
		}
	}
	let body = `<rect width="${size}" height="${size}" fill="${hex6(bg)}"/>`;
	for (const [c, p] of paths) body += `<path stroke="${hex6(c)}" d="${p.d}"/>`;
	const px = size * cell;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges"${
		label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'
	}>${body}</svg>`;
}

/** Whole pixels per cell so that an export is about 1024 wide. */
export const exportCell = (size: number) => Math.max(1, Math.floor(1024 / size));

// --- The Sierpinski fact, by addition ---

/**
 * C(x + y, x) mod 2 for every x, y below n, built the way Pascal's triangle is
 * built: each entry is the one above plus the one to the left. No binomial
 * formula and no bit operators, so it is an independent check on x & y.
 */
export function pascalMod2(n: number): Uint8Array {
	const g = new Uint8Array(n * n);
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) g[y * n + x] = x === 0 || y === 0 ? 1 : (g[(y - 1) * n + x] + g[y * n + x - 1]) % 2;
	return g;
}

/** True when C(x + y, x) is odd exactly where x & y is 0, over the whole n by n grid. */
export function sierpinskiHolds(n: number): boolean {
	const g = pascalMod2(n);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((g[y * n + x] === 1) !== ((x & y) === 0)) return false;
	return true;
}

// --- Presets ---

export interface Preset {
	label: string;
	/** One expression, or red, green and blue. */
	e: string | [string, string, string];
	size: number;
	mode: Mode;
	bit?: number;
	pal?: string;
	t?: number;
	/** Starts animating when loaded: the expression uses t. */
	play?: boolean;
	note: string;
}

export const PRESETS: Preset[] = [
	{
		label: 'XOR texture',
		e: 'x ^ y',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		note: 'The classic. Each quadrant is a copy of the whole at half size.'
	},
	{
		label: 'AND',
		e: 'x & y',
		size: 128,
		mode: 'grey',
		note: 'Black where x and y share no set bit: the Sierpinski triangle is the black cells.'
	},
	{
		label: 'Sierpinski',
		e: '((x & y) - 1) >> 31',
		size: 128,
		mode: 'grey',
		note: 'White exactly where x & y is 0, so the triangle stands out.'
	},
	{
		label: 'OR',
		e: 'x | y',
		size: 128,
		mode: 'palette',
		pal: 'fire',
		note: 'The AND picture turned half way round and inverted, because x | y is 127 minus ((127 - x) & (127 - y)) on this grid.'
	},
	{
		label: 'Checks',
		e: 'x & y & 8',
		size: 64,
		mode: 'bit',
		bit: 3,
		note: 'Only bit 3 can survive, so each cell is on or off. Shown as bit 3, since 8 is almost black in greyscale.'
	},
	{
		label: 'Product',
		e: 'x * y',
		size: 128,
		mode: 'palette',
		pal: 'ocean',
		note: 'Only the low 8 bits of x times y are drawn, so it wraps into curved bands.'
	},
	{
		label: 'Product, high byte',
		e: '(x * y) >> 8',
		size: 256,
		mode: 'palette',
		pal: 'sunset',
		note: 'The next 8 bits up. The curves are hyperbolas, x times y = constant.'
	},
	{
		label: 'Rings',
		e: '(x * x + y * y) >> 6',
		size: 256,
		mode: 'palette',
		pal: 'spectrum',
		note: 'Squared distance from the corner, divided down; wrapping makes the rings.'
	},
	{
		label: 'Remainder',
		e: 'x % y',
		size: 128,
		mode: 'palette',
		pal: 'fire',
		note: 'Row 0 divides by zero, which is defined here as 0.'
	},
	{
		label: 'Bit 5 of XOR',
		e: 'x ^ y',
		size: 128,
		mode: 'bit',
		bit: 5,
		note: 'One bit plane of the XOR texture: on or off, nothing between.'
	},
	{
		label: 'Three channels',
		e: ['x ^ y', 'x | y', 'x & y'],
		size: 128,
		mode: 'rgb',
		note: 'XOR for red, OR for green and AND for blue.'
	},
	{
		label: 'Moving XOR',
		e: '(x ^ y) + t',
		size: 128,
		mode: 'palette',
		pal: 'ocean',
		play: true,
		note: 'Adds the frame number, so the colours cycle as t moves.'
	},
	{
		label: 'Plasma',
		e: [
			'128 + sin(x * 3 + t * 2) / 2 + sin(y * 4 - t * 3) / 2',
			'128 + sin((x + y) * 2 + t * 4) / 2 + sin(x * 5) / 2',
			'128 + sin(sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)) * 6 - t * 4) / 2 + sin(y * 3 + t) / 2'
		],
		size: 128,
		mode: 'rgb',
		t: 30,
		play: true,
		note: 'Each channel adds two sines with different speeds and directions, so the colours drift against each other.'
	},
	{
		label: 'Ripples',
		e: 'sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)) * 6 - t * 4',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'Distance from the middle, times 6, minus 4t. A ring is one value, so as t grows the rings move outwards.'
	},
	{
		label: 'Pond',
		e: 'sin(sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)) * 8 - t * 6) + 128',
		size: 128,
		mode: 'grey',
		t: 30,
		play: true,
		note: 'The sine of the distance, moved up by 128 so that it runs from 1 to 255 and not from -127 to 127.'
	},
	{
		label: 'Waves',
		e: 'y * 2 + sin(x * 4 + t * 4) / 2',
		size: 128,
		mode: 'palette',
		pal: 'ocean',
		t: 30,
		play: true,
		note: 'The sine bends the bands that y * 2 would draw, and t slides it sideways.'
	},
	{
		label: 'Two centres',
		e: 'sqrt((x - 32 - (t >> 1)) * (x - 32 - (t >> 1)) + (y - 64) * (y - 64)) ^ sqrt((x - 96) * (x - 96) + (y - 64) * (y - 64))',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'The distance to two points, XORed. The left point slides right as t grows, and the fringes between them change.'
	},
	{
		label: 'Sierpinski sweep',
		e: '((x & y) - t) >> 31',
		size: 128,
		mode: 'grey',
		t: 40,
		play: true,
		note: 'White wherever x & y is below t. Cells with a small x & y fill in first; from t = 128 on, every cell is white.'
	},
	{
		label: 'Tunnel',
		e: 'sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)) ^ (t + x + y)',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'Distance from the middle XOR a diagonal that slides with t.'
	},
	{
		label: 'Kaleidoscope',
		e: '(abs(x - 64) ^ abs(y - 64)) * 4 - t * 2',
		size: 128,
		mode: 'palette',
		pal: 'fire',
		t: 30,
		play: true,
		note: 'abs(x - 64) folds the picture about the middle column, and the same for rows, so every quadrant is a mirror of the others. The XOR of the folded coordinates is multiplied by 4 so it wraps, and 2t is subtracted so the colours cycle.'
	},
	{
		label: 'Spiral arms',
		e: 'atan2(y - 64, x - 64) * 3 + sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)) * 4 - t * 4',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'The angle round the middle (0 to 255) times 3, plus 4 times the distance, minus 4t. Three colour cycles fit round one turn, so there are three arms, and the distance term shears them into spirals that move outwards as t grows.'
	},
	{
		label: 'Vortex',
		e: '(atan2(y - 64, x - 64) * 2) ^ (6000 / (sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)) + 1) - t * 2)',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'The angle times 2, XOR 6000 divided by the distance. The division is steep near the middle, so the rings crowd together there, like looking down a tunnel. Subtracting 2t makes the ring pattern drift towards the middle.'
	},
	{
		label: 'Rainbow swirl',
		e: [
			'128+sin(atan2(y - 64, x - 64)*2+sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64))*2-t*4+0)',
			'128+sin(atan2(y - 64, x - 64)*2+sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64))*2-t*4+85)',
			'128+sin(atan2(y - 64, x - 64)*2+sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64))*2-t*4+170)'
		],
		size: 128,
		mode: 'rgb',
		t: 30,
		play: true,
		note: 'All three channels are 128 plus the sine of 2 times the angle, plus 2 times the distance, minus 4t. They are offset by 0, 85 and 170, a third of a turn apart, so the hues run round the colour wheel.'
	},
	{
		label: 'Spinning XOR',
		e: '(((x - 64) * cos(t) - (y - 64) * sin(t)) >> 7) ^ (((x - 64) * sin(t) + (y - 64) * cos(t)) >> 7)',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'Turns x - 64 and y - 64 through the angle t with sin and cos (a whole turn is 256, so t = 0 to 255 is one full rotation), shifts right by 7 to undo the scale of about 128, then XORs the two. The XOR texture rotates about the middle.'
	},
	{
		label: 'Chequered floor',
		e: '((x - 64) * 64 / (y - 40) ^ 2048 / (y - 40) + t * 4) & ((40 - y) >> 31)',
		size: 128,
		mode: 'bit',
		bit: 6,
		t: 30,
		play: true,
		note: 'Dividing by y - 40 gives a perspective floor with its horizon on row 40: x - 64 and 2048 divided by y - 40 are the position across and the depth. Their XOR has bit 6 set on alternate squares, which is shown as the bit. Adding 4t to the depth slides the squares towards you; the last term blanks the rows above the horizon.'
	},
	{
		label: 'XOR zoom',
		e: '((x - 64) * (160 + sin(t)) >> 7) ^ ((y - 64) * (160 + sin(t)) >> 7)',
		size: 128,
		mode: 'palette',
		pal: 'ocean',
		t: 30,
		play: true,
		note: 'The XOR texture of x - 64 and y - 64 scaled by (160 + sin(t)) / 128, between about 0.26 and 2.2, so it zooms in and out about the middle. Because sin repeats every 256, the loop is seamless.'
	},
	{
		label: 'Sierpinski zoom',
		e: '(((x * (100 + sin(t) / 2) >> 7) & (y * (100 + sin(t) / 2) >> 7)) - 1) >> 31',
		size: 128,
		mode: 'grey',
		t: 30,
		play: true,
		note: 'The coordinates are scaled by between about 0.3 and 1.3 before the AND, then white where it is 0. With a small scale the triangle is magnified towards the top left corner; with a large one it breaks into finer copies.'
	},
	{
		label: 'Metaballs',
		e: 'min(255, 40000/((x-64-sin(t)/3)*(x-64-sin(t)/3)+(y-64-cos(t*2)/3)*(y-64-cos(t*2)/3)+1)+40000/((x-64-cos(t*3)/3)*(x-64-cos(t*3)/3)+(y-64-sin(t*2)/3)*(y-64-sin(t*2)/3)+1)+40000/((x-64-sin(t*2+90)/2)*(x-64-sin(t*2+90)/2)+(y-64-sin(t*3)/4)*(y-64-sin(t*3)/4)+1))',
		size: 128,
		mode: 'palette',
		pal: 'fire',
		t: 30,
		play: true,
		note: 'Each of three balls adds 40000 divided by the squared distance plus 1, using integer division, so the field falls off steeply. Where the fields add up, close balls merge into one blob; min caps the total at 255. The centres orbit with sin and cos.'
	},
	{
		label: 'Lava lamp',
		e: 'min(255,80000/((x-64-sin(t)/4)*(x-64-sin(t)/4)+(y-64-sin(t*2)/2)*(y-64-sin(t*2)/2)+1)+80000/((x-64-cos(t)/4)*(x-64-cos(t)/4)+(y-64-sin(t*2+90)/2)*(y-64-sin(t*2+90)/2)+1)+80000/((x-64-sin(t*3)/3)*(x-64-sin(t*3)/3)+(y-64-cos(t)/2)*(y-64-cos(t)/2)+1))',
		size: 128,
		mode: 'palette',
		pal: 'sunset',
		t: 100,
		play: true,
		note: 'The same sum of inverse squared distances as Metaballs, with bigger balls (80000) that rise and fall, drawn in the Sunset palette. The blobs stretch and join when they pass close to each other.'
	},
	{
		label: 'Interference',
		e: 'sin(sqrt((x-64+sin(t)/4)*(x-64+sin(t)/4)+(y-64)*(y-64))*5)+sin(sqrt((x-64)*(x-64)+(y-64+cos(t)/4)*(y-64+cos(t)/4))*5)+sin(sqrt((x-64-sin(t)/4)*(x-64-sin(t)/4)+(y-64-cos(t)/4)*(y-64-cos(t)/4))*5)+384',
		size: 128,
		mode: 'palette',
		pal: 'spectrum',
		t: 30,
		play: true,
		note: 'The sum of the sine of the distance from three centres that circle around the middle. The total runs from 3 to 765, so it wraps about three times, which cuts it into contour bands; the bands bend where the waves from different centres meet.'
	},
	{
		label: 'Radar sweep',
		e: [
			'(255-((atan2(y - 64, x - 64)-t*2)&255))>>3&((sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64))-60)>>31)',
			'(255-((atan2(y - 64, x - 64)-t*2)&255))&((sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64))-60)>>31)',
			'(255-((atan2(y - 64, x - 64)-t*2)&255))>>3&((sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64))-60)>>31)'
		],
		size: 128,
		mode: 'rgb',
		t: 30,
		play: true,
		note: 'atan2 gives the bearing of each pixel, so (bearing - 2t) & 255 is how far behind the beam it is. Green is 255 minus that, brightest at the beam and fading behind it; red and blue are an eighth of it. The beam turns once every 128 steps, and the last term blanks everything beyond 60 pixels from the middle.'
	},
	{
		label: 'Flames',
		e: 'y*3-t*8+sin(x*6)/2+sin(x*13+t*4)/4',
		size: 128,
		mode: 'palette',
		pal: 'fire',
		t: 30,
		play: true,
		note: 'y * 3 - 8t makes bands that move upwards, as t grows; the two sines bend them sideways. It is flame-like in the Fire palette, nothing more.'
	},
	{
		label: 'Scrolling maze',
		e: '255-min(255,abs(((x+t)&7^(((((x+t)>>3)+(y>>3)*57)*((((x+t)>>3)+(y>>3)*57)*(((x+t)>>3)+(y>>3)*57)*15731+789221)>>14)&1)*7)-(y&7))*60)',
		size: 128,
		mode: 'palette',
		pal: 'ocean',
		t: 30,
		play: true,
		note: 'Cells of 8 by 8 pixels. A hash of the cell number picks the direction of one diagonal line in each cell (u or its mirror 7 - u, compared with v), and the lines join into a maze, as in the old one-line 10 PRINT programs. Adding t to x scrolls it sideways.'
	}
];
