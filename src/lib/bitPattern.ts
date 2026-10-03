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

/** op is 'num', 'x', 'y', 't', 'u-', 'u~', 'u+' or the binary operator itself. */
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
const LEVELS = ['|', '^', '&', '<< >>', '+ -', '* / %'].map((l) => l.split(' '));

export function parse(src: string): Node {
	if (src.length > MAX_LENGTH)
		throw new PatternError(`Expression is longer than ${MAX_LENGTH} characters`, MAX_LENGTH + 1);
	type Tok = { k: 'n' | 'id' | 'op' | '(' | ')' | 'end'; text: string; v?: number; s: number; e: number };
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
			if (!['x', 'y', 't'].includes(m))
				throw new PatternError(`Unknown name ${m} at position ${i + 1}: use x, y or t`, i + 1);
			toks.push({ k: 'id', text: m, s: i, e: i + 1 });
			i++;
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
		} else if (c === '(' || c === ')') {
			toks.push({ k: c, text: c, s: i, e: i + 1 });
			i++;
		} else {
			throw new PatternError(`Unexpected character ${c} at position ${i + 1}`, i + 1);
		}
	}
	toks.push({ k: 'end', text: '', s: src.length, e: src.length });

	let p = 0;
	const unexpected = (tok: Tok) =>
		tok.k === 'end'
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

/** The colours of a whole grid: one function normally, three in RGB mode. */
export function paint(fns: Fn[], look: Look, size: number, t: number, step = 1): Uint32Array {
	const grids = (look.mode === 'rgb' ? fns.slice(0, 3) : fns.slice(0, 1)).map((f) => evalGrid(f, size, t, step));
	const out = new Uint32Array(size * size);
	for (let i = 0; i < out.length; i++) out[i] = colourOf(look, grids[0][i], grids[1]?.[i], grids[2]?.[i]);
	return out;
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
	const paths = new Map<number, string>();
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; ) {
			const c = colours[y * size + x];
			let w = 1;
			while (x + w < size && colours[y * size + x + w] === c) w++;
			if (c !== bg) paths.set(c, (paths.get(c) ?? '') + `M${x} ${y + 0.5}h${w}`);
			x += w;
		}
	}
	let body = `<rect width="${size}" height="${size}" fill="${hex6(bg)}"/>`;
	for (const [c, d] of paths) body += `<path stroke="${hex6(c)}" d="${d}"/>`;
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
		note: 'Black where x and y share no set bit: the Sierpinski triangle in the dark cells.'
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
		note: 'The same shape as AND, turned over: it is brightest where AND is darkest.'
	},
	{
		label: 'Checks',
		e: 'x & y & 8',
		size: 64,
		mode: 'grey',
		note: 'Only bit 3 can survive, so each cell is on or off.'
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
		label: 'Moving XOR',
		e: '(x ^ y) + t',
		size: 128,
		mode: 'palette',
		pal: 'ocean',
		note: 'Adds the frame number, so the colours cycle as t moves.'
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
	}
];
