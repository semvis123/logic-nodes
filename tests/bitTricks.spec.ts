// The bit hacks, checked against plain references that work on strings of
// '0' and '1' or on ordinary arithmetic, never on the same bitwise tricks:
// exhaustively for every 8-bit value (and every pair for two-operand tricks),
// and for random 16 and 32-bit values.

import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	tricks,
	trickById,
	getTrick,
	parseOperand,
	runTrick,
	resultText,
	changedBits,
	alternatingMask,
	BitTrickError,
	cType,
	type Width,
	type Trick,
	type Result
} from '../src/lib/bitTricks.js';

// --- references, written without bitwise operators -------------------------

const bits = (v: number, w: number) => v.toString(2).padStart(w, '0');
const fromBits = (s: string) => parseInt(s, 2);
const toSigned = (v: number, w: number) => (v >= 2 ** (w - 1) ? v - 2 ** w : v);
const mod = (v: number, w: number) => ((v % 2 ** w) + 2 ** w) % 2 ** w;
const ones = (v: number, w: number) =>
	bits(v, w)
		.split('')
		.filter((c) => c === '1').length;
/** Bit n read from the string, counting from the right. */
const bitAt = (v: number, w: number, n: number) => bits(v, w)[w - 1 - n] === '1';
const setChar = (v: number, w: number, n: number, c: string) => {
	const s = bits(v, w).split('');
	s[w - 1 - n] = c;
	return fromBits(s.join(''));
};
const trailingZeros = (v: number, w: number) => {
	const s = bits(v, w);
	const i = s.lastIndexOf('1');
	return i < 0 ? w : w - 1 - i;
};

/** The expected result of each trick, from first principles. */
const reference: Record<string, (x: number, y: number, n: number, w: number) => Result['value']> = {
	'test-a-bit': (x, _y, n, w) => bitAt(x, w, n),
	'set-a-bit': (x, _y, n, w) => setChar(x, w, n, '1'),
	'clear-a-bit': (x, _y, n, w) => setChar(x, w, n, '0'),
	'toggle-a-bit': (x, _y, n, w) => setChar(x, w, n, bitAt(x, w, n) ? '0' : '1'),
	'clear-lowest-set-bit': (x, _y, _n, w) => {
		const s = bits(x, w);
		const i = s.lastIndexOf('1');
		return i < 0 ? 0 : fromBits(s.slice(0, i) + '0' + s.slice(i + 1));
	},
	'isolate-lowest-set-bit': (x, _y, _n, w) => (x === 0 ? 0 : 2 ** trailingZeros(x, w)),
	'is-power-of-two': (x) => {
		for (let p = 1; p <= x; p *= 2) if (p === x) return true;
		return false;
	},
	'count-trailing-zeros': (x, _y, _n, w) => trailingZeros(x, w),
	'count-set-bits-kernighan': (x, _y, _n, w) => ones(x, w),
	'count-set-bits-swar': (x, _y, _n, w) => ones(x, w),
	parity: (x, _y, _n, w) => ones(x, w) % 2,
	'xor-swap': (x, y) => [y, x],
	'opposite-signs': (x, y, _n, w) => toSigned(x, w) < 0 !== toSigned(y, w) < 0,
	'branchless-abs': (x, _y, _n, w) => mod(Math.abs(toSigned(x, w)), w),
	'branchless-min-max': (x, y, _n, w) => {
		const [a, b] = [toSigned(x, w), toSigned(y, w)];
		return [mod(Math.min(a, b), w), mod(Math.max(a, b), w)];
	},
	'average-without-overflow': (x, y) => Math.floor((x + y) / 2),
	// Only meaningful for powers of two; other n are checked separately.
	'modulo-power-of-two': (x, y) => x % y,
	'round-up-to-power-of-two': (x, _y, _n, w) => {
		if (x === 0) return 0;
		let p = 1;
		while (p < x) p *= 2;
		return p >= 2 ** w ? 0 : p;
	},
	'reverse-bits': (x, _y, _n, w) => fromBits(bits(x, w).split('').reverse().join('')),
	'binary-to-gray-code': (x, _y, _n, w) => {
		const s = bits(x, w);
		let g = s[0];
		for (let i = 1; i < w; i++) g += s[i] === s[i - 1] ? '0' : '1';
		return fromBits(g);
	},
	'sign-extension': (x, _y, n, w) => {
		const field = bits(x, w).slice(w - n);
		const v = fromBits(field);
		return mod(field[0] === '1' ? v - 2 ** n : v, w);
	},
	// Bit 5 flipped by arithmetic: subtract 32 if it is set, add it otherwise.
	'ascii-case-toggle': (x, _y, _n, w) => (bitAt(x, w, 5) ? x - 32 : x + 32)
};

/** The n values a trick takes at a width, or [0] when it takes none. */
const nValues = (t: Trick, w: Width) => {
	if (!t.n) return [0];
	const out: number[] = [];
	for (let n = t.n.min; n <= t.n.max(w); n++) out.push(n);
	return out;
};

const yValues = (t: Trick, w: Width, all: boolean) => {
	if (!t.y) return [0];
	if (t.id === 'modulo-power-of-two') return Array.from({ length: w }, (_, k) => 2 ** k);
	return all ? Array.from({ length: 2 ** w }, (_, i) => i) : [];
};

function check(t: Trick, x: number, y: number, n: number, w: Width): string | null {
	const trace = t.trace({ x, y, n, w });
	const want = reference[t.id](x, y, n, w);
	if (JSON.stringify(trace.result.value) !== JSON.stringify(want))
		return `${t.id} x=${x} y=${y} n=${n} w=${w}: got ${JSON.stringify(trace.result.value)}, want ${JSON.stringify(
			want
		)}`;
	// Every row is a pattern of the width.
	for (const r of trace.rows)
		if (!Number.isInteger(r.value) || r.value < 0 || r.value >= 2 ** w) return `${t.id}: row ${r.expr} out of range`;
	// The trace ends at the stated result.
	const last = trace.rows[trace.rows.length - 1];
	const res = trace.result;
	if (res.kind === 'bits' && last.value !== res.value)
		return `${t.id} x=${x}: last row ${last.value} is not the result ${res.value}`;
	if (res.kind === 'pair' && !trace.rows.slice(-2).some((r) => r.value === res.value[0]))
		return `${t.id}: pair missing from the trace`;
	return null;
}

// A seeded generator (mulberry32), so a failure found on one run is found on every run.
let seed = 0x5eed;
function rand(): number {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = seed;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const random = (w: number) => Math.floor(rand() * 2 ** w);

// --- every row of every trace, worked out again with BigInt ------------------

const B = BigInt;
const all = (w: number) => (1n << B(w)) - 1n;
const u = (v: bigint, w: number) => ((v % (1n << B(w))) + (1n << B(w))) % (1n << B(w));
const sgn = (v: bigint, w: number) => (v >= 1n << B(w - 1) ? v - (1n << B(w)) : v);
function fieldMask(s: number, w: number): bigint {
	let m = 0n;
	for (let i = 0; i < w; i++) if (Math.floor(i / s) % 2 === 0) m += 1n << B(i);
	return m;
}
const steps = (w: number) => [1, 2, 4, 8, 16].filter((s) => s < w);

/** The value of every row a trick's trace should show, in order. */
function expectedRows(id: string, xn: number, yn: number, n: number, w: number): bigint[] {
	const [x, y, m] = [B(xn), B(yn), all(w)];
	const bit = 1n << B(n);
	switch (id) {
		case 'test-a-bit':
			return [x, bit, x & bit];
		case 'set-a-bit':
			return [x, bit, x | bit];
		case 'clear-a-bit':
			return [x, bit, m ^ bit, x & (m ^ bit)];
		case 'toggle-a-bit':
			return [x, bit, x ^ bit];
		case 'clear-lowest-set-bit':
		case 'is-power-of-two':
			return [x, u(x - 1n, w), x & u(x - 1n, w)];
		case 'isolate-lowest-set-bit':
			return [x, m ^ x, u(-x, w), x & u(-x, w)];
		case 'count-trailing-zeros':
			return [x, x & u(-x, w), u((x & u(-x, w)) - 1n, w)];
		case 'count-set-bits-kernighan': {
			const r = [x];
			for (let v = x; v; ) r.push((v = v & u(v - 1n, w)));
			return r;
		}
		case 'count-set-bits-swar': {
			const [m55, m33, m0f] = [fieldMask(1, w), fieldMask(2, w), fieldMask(4, w)];
			const half = (x >> 1n) & m55;
			const a = u(x - half, w);
			const b = (a & m33) + ((a >> 2n) & m33);
			const c = (b + (b >> 4n)) & m0f;
			const r = [x, half, a, b, c];
			if (w > 8) {
				const p = u(c * (w === 16 ? 0x0101n : 0x01010101n), w);
				r.push(p, p >> B(w - 8));
			}
			return r;
		}
		case 'parity': {
			const r = [x];
			let v = x;
			for (const s of steps(w).reverse()) r.push((v = v ^ (v >> B(s))));
			return [...r, v & 1n];
		}
		case 'xor-swap':
			return [x, y, x ^ y, x, y];
		case 'opposite-signs':
			return [x, y, x ^ y];
		case 'branchless-abs': {
			const mask = sgn(x, w) < 0n ? m : 0n;
			return [x, mask, u(x + mask, w), u(x + mask, w) ^ mask];
		}
		case 'branchless-min-max': {
			const lt = sgn(x, w) < sgn(y, w);
			const sel = lt ? x ^ y : 0n;
			return [x, y, lt ? m : 0n, x ^ y, sel, lt ? x : y, lt ? y : x];
		}
		case 'average-without-overflow':
			return [x, y, x & y, x ^ y, (x ^ y) >> 1n, (x + y) / 2n];
		case 'modulo-power-of-two':
			return [x, y, u(y - 1n, w), x & u(y - 1n, w)];
		case 'round-up-to-power-of-two': {
			let v = u(x - 1n, w);
			const r = [x, v];
			for (const s of steps(w)) r.push((v = v | (v >> B(s))));
			return [...r, u(v + 1n, w)];
		}
		case 'reverse-bits': {
			const r = [x];
			let v = x;
			for (const s of steps(w)) {
				const k = fieldMask(s, w);
				r.push((v = ((v >> B(s)) & k) | u((v & k) << B(s), w)));
			}
			return r;
		}
		case 'binary-to-gray-code':
			return [x, x >> 1n, x ^ (x >> 1n)];
		case 'sign-extension': {
			const field = n >= w ? x : x & ((1n << B(n)) - 1n);
			const sign = 1n << B(n - 1);
			const tail = [sign, field ^ sign, u((field ^ sign) - sign, w)];
			return field === x ? [x, ...tail] : [x, field, ...tail];
		}
		case 'ascii-case-toggle':
			return [x, 0x20n, x ^ 0x20n];
	}
	throw new Error(`no row reference for ${id}`);
}

function checkRows(t: Trick, x: number, y: number, n: number, w: Width): string | null {
	const { rows } = t.trace({ x, y, n, w });
	const got = rows.map((r) => B(r.value));
	const want = expectedRows(t.id, x, y, n, w);
	if (got.length !== want.length || got.some((g, i) => g !== want[i]))
		return `${t.id} x=${x} y=${y} n=${n} w=${w}: rows ${got.join(',')}, want ${want.join(',')}`;
	for (const r of rows)
		if (r.base !== undefined && (r.base < 0 || r.base >= rows.indexOf(r))) return `${t.id}: bad base`;
	return null;
}

test.describe('bit tricks', () => {
	test('every trick has a reference, unique id and sane metadata', () => {
		const ids = tricks.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const t of tricks) {
			expect(reference[t.id], t.id).toBeTruthy();
			expect(t.id).toMatch(/^[a-z0-9-]+$/);
			expect(t.why.length).toBeGreaterThan(0);
			expect(t.examples.length).toBeGreaterThan(0);
			expect(trickById(t.id)).toBe(t);
		}
		expect(tricks.length).toBeGreaterThanOrEqual(22);
	});

	test('every trick is right for every 8-bit value, and every pair', () => {
		const bad: string[] = [];
		for (const t of tricks) {
			for (const n of nValues(t, 8))
				for (const y of yValues(t, 8, true))
					for (let x = 0; x < 256; x++) {
						const err = check(t, x, y, n, 8);
						if (err) bad.push(err);
					}
		}
		expect(bad.slice(0, 10)).toEqual([]);
	});

	test('every trick is right for random 16 and 32-bit values', () => {
		const bad: string[] = [];
		for (const w of [16, 32] as Width[]) {
			for (const t of tricks) {
				for (let i = 0; i < 400; i++) {
					const ns = nValues(t, w);
					const n = ns[Math.floor(rand() * ns.length)];
					const ys = yValues(t, w, false);
					const y = t.y ? (ys.length ? ys[Math.floor(rand() * ys.length)] : random(w)) : 0;
					const x = random(w);
					const err = check(t, x, y, n, w);
					if (err) bad.push(err);
				}
				// The edges: 0, 1, all ones, the sign bit alone and the largest positive.
				for (const x of [0, 1, 2 ** w - 1, 2 ** (w - 1), 2 ** (w - 1) - 1])
					for (const n of nValues(t, w)) {
						const y = t.id === 'modulo-power-of-two' ? 2 ** (n % w) : 2 ** (w - 1);
						const err = check(t, x, y, n, w);
						if (err) bad.push(err);
					}
			}
		}
		expect(bad.slice(0, 10)).toEqual([]);
	});

	test('known answers', () => {
		const run = (id: string, x: string, w: Width = 8, y = '0', n = 0) => runTrick(getTrick(id), { x, y, n }, w).trace;
		expect(run('clear-lowest-set-bit', '0b01011000').result.value).toBe(0b01010000);
		expect(run('isolate-lowest-set-bit', '88').result.value).toBe(8);
		expect(run('count-set-bits-swar', '0xFFFFFFFF', 32).result.value).toBe(32);
		expect(run('count-set-bits-swar', '0x0F0F', 16).result.value).toBe(8);
		expect(run('reverse-bits', '1', 32).result.value).toBe(0x80000000);
		expect(run('reverse-bits', '0x12345678', 32).result.value).toBe(0x1e6a2c48);
		expect(run('round-up-to-power-of-two', '1000', 16).result.value).toBe(1024);
		expect(run('round-up-to-power-of-two', '0', 32).result.value).toBe(0);
		expect(run('branchless-abs', '-128').result.value).toBe(0x80);
		expect(run('branchless-abs', '-2147483647', 32).result.value).toBe(2147483647);
		expect(run('average-without-overflow', '200', 8, '100').result.value).toBe(150);
		expect(run('average-without-overflow', '0xFFFFFFFF', 32, '0xFFFFFFFD').result.value).toBe(0xfffffffe);
		expect(run('binary-to-gray-code', '7').result.value).toBe(4);
		expect(run('sign-extension', '0b1011', 8, '0', 4).result.value).toBe(0xfb);
		expect(run('sign-extension', '0xFFF', 32, '0', 12).result.value).toBe(0xffffffff);
		expect(run('ascii-case-toggle', "'a'").result.value).toBe(65);
		expect(run('count-trailing-zeros', '0', 16).result.value).toBe(16);
		expect(run('parity', '0x80000001', 32).result.value).toBe(0);
		expect(run('opposite-signs', '-1', 32, '0').result.value).toBe(true);
		expect(run('branchless-min-max', '-42', 8, '88').result.value).toEqual([214, 88]);
	});

	test('every row of every trace is right: all 8-bit values and pairs, random 16 and 32-bit ones', () => {
		const bad: string[] = [];
		for (const t of tricks)
			for (const w of [8, 16, 32] as Width[]) {
				const xs =
					w === 8 ? Array.from({ length: 256 }, (_, i) => i) : [0, 1, 2 ** w - 1, 2 ** (w - 1), 2 ** (w - 1) - 1];
				if (w > 8) for (let i = 0; i < 300; i++) xs.push(random(w));
				const ys = !t.y ? [0] : t.id === 'modulo-power-of-two' ? yValues(t, w, false) : w === 8 ? xs : xs.slice(0, 40);
				for (const n of nValues(t, w))
					for (const y of ys)
						for (const x of xs) {
							const err = checkRows(t, x, y, n, w);
							if (err && bad.length < 10) bad.push(err);
						}
			}
		expect(bad).toEqual([]);
	});

	test("Kernighan's loop shows one row per pass, each clearing exactly the lowest set bit", () => {
		const t = getTrick('count-set-bits-kernighan');
		for (let x = 0; x < 256; x++) {
			const { rows } = t.trace({ x, y: 0, n: 0, w: 8 });
			expect(rows.length).toBe(1 + ones(x, 8));
			for (let i = 1; i < rows.length; i++) {
				expect(rows[i].base).toBe(i - 1);
				expect(changedBits(rows[i].value, rows[i - 1].value, 8).filter(Boolean).length).toBe(1);
				expect(trailingZeros(rows[i].value, 8)).toBeGreaterThan(trailingZeros(rows[i - 1].value, 8));
			}
		}
	});

	test('the shift-or cascade fills every bit below the top one', () => {
		const t = getTrick('round-up-to-power-of-two');
		const { rows } = t.trace({ x: 0x2000001, y: 0, n: 0, w: 32 });
		expect(rows.map((r) => r.expr)).toEqual([
			'x',
			'x--',
			'x |= x >> 1',
			'x |= x >> 2',
			'x |= x >> 4',
			'x |= x >> 8',
			'x |= x >> 16',
			'x++'
		]);
		expect(rows[rows.length - 2].value).toBe(0x3ffffff);
	});

	test('XOR swap: the aliasing trace ends at zero', () => {
		const t = getTrick('xor-swap');
		for (let x = 1; x < 256; x++) {
			const rows = t.trace({ x, y: 5, n: 0, w: 8 }).aside?.rows ?? [];
			expect(rows[rows.length - 1]?.value).toBe(0);
		}
	});

	test('modulo warns for an n that is not a power of two, and says what % gives', () => {
		const t = getTrick('modulo-power-of-two');
		expect(t.trace({ x: 88, y: 8, n: 0, w: 8 }).warning).toBeUndefined();
		const off = t.trace({ x: 88, y: 6, n: 0, w: 8 });
		expect(off.warning).toContain(`${88 % 6}`);
		expect(off.warning).toContain(`${88 & 5}`);
		expect(t.trace({ x: 88, y: 0, n: 0, w: 8 }).warning).toMatch(/undefined/);
	});

	test('the average aside shows the overflow only when there is one', () => {
		const t = getTrick('average-without-overflow');
		for (let x = 0; x < 256; x += 3)
			for (let y = 0; y < 256; y += 5) {
				const a = t.trace({ x, y, n: 0, w: 8 }).aside ?? { text: '', rows: [] };
				expect(a.text.includes('is lost'), `${x} ${y}`).toBe(x + y > 255);
				expect(a.rows[1].value).toBe(Math.floor(((x + y) % 256) / 2));
			}
	});

	test('masks and changed bits', () => {
		expect(alternatingMask(1, 32)).toBe(0x55555555);
		expect(alternatingMask(2, 16)).toBe(0x3333);
		expect(alternatingMask(4, 8)).toBe(0x0f);
		expect(alternatingMask(16, 32)).toBe(0x0000ffff);
		expect(changedBits(0b1010, 0b0110, 8)).toEqual([false, false, true, true, false, false, false, false]);
		for (let i = 0; i < 200; i++) {
			const a = random(32);
			const b = random(32);
			const c = changedBits(a, b, 32);
			expect(c.filter(Boolean).length).toBe(ones(Number(BigInt(a) ^ BigInt(b)), 32));
		}
	});
});

// --- the C each trick shows, compiled and run --------------------------------
//
// The page shows C and offers to copy it, so the C itself is checked: every
// trick's code(w) is compiled with GCC, with x (and y) declared as the type the
// page names, and run on every 8-bit value (and pair) and on random 16 and
// 32-bit values. This catches what the engine cannot, such as C promoting a
// uint16_t to int before a multiply. UBSan stops the run on undefined
// behaviour; the one known case, the branchless abs of INT_MIN, is left out
// because the page says it is undefined.

/** The variable each statement-form trick leaves its result in. */
const cResult: Record<string, string[]> = {
	'count-set-bits-kernighan': ['c'],
	'count-set-bits-swar': ['x'],
	parity: ['parity'],
	'xor-swap': ['x', 'y'],
	'branchless-min-max': ['min', 'max'],
	'round-up-to-power-of-two': ['x'],
	'reverse-bits': ['x'],
	'sign-extension': ['r']
};

let gcc = true;
try {
	execFileSync('gcc', ['--version'], { stdio: 'ignore' });
} catch {
	gcc = false;
}

function cCases(t: Trick, w: Width): { x: number; y: number; n: number }[] {
	const xs =
		w === 8
			? Array.from({ length: 256 }, (_, i) => i)
			: [0, 1, 2 ** w - 1, 2 ** (w - 1), 2 ** (w - 1) - 1, ...Array.from({ length: 400 }, () => random(w))];
	const ys = !t.y ? [0] : t.id === 'modulo-power-of-two' ? yValues(t, w, false) : w === 8 ? xs : xs.slice(0, 30);
	const out: { x: number; y: number; n: number }[] = [];
	for (const n of nValues(t, w))
		for (const y of ys)
			for (let x of xs) {
				// The C takes x as the k-bit field itself.
				if (t.id === 'sign-extension') x = n >= w ? x : x % 2 ** n;
				if (t.id === 'branchless-abs' && w === 32 && x === 2 ** 31) continue;
				out.push({ x, y, n });
			}
	return out;
}

function cFunction(t: Trick, w: Width, name: string): string {
	const T = cType(t, w);
	const lines = t
		.code(w)
		.split('\n')
		.filter((l) => !l.startsWith('/*'));
	const last = lines[lines.length - 1].trim();
	const isExpr = !last.endsWith(';');
	const body = isExpr ? [...lines.slice(0, -1), `r = (${last});`] : lines;
	const results = isExpr ? ['r'] : cResult[t.id];
	if (!results) throw new Error(`${t.id}: say which variable holds the result`);
	return `static void ${name}(${T} x, ${T} y, unsigned n) {
	unsigned k = n; ${T} c = x, r = 0, min = 0, max = 0, parity = 0; uint${w}_t m = 0;
	(void)k; (void)c; (void)min; (void)max; (void)parity; (void)m; (void)y;
	{
		${t.y === 'n' ? `${T} n = y;` : ''}
		${body.join('\n\t\t')}
	}
	printf("${results.map(() => '%llu').join(' ')}\\n", ${results
		.map((v) => `(unsigned long long)(uint${w}_t)${v}`)
		.join(', ')});
}`;
}

test.describe('the C code for every trick', () => {
	test('compiles and gives the reference result at every width', () => {
		test.skip(!gcc, 'GCC is not installed');
		const dir = mkdtempSync(join(tmpdir(), 'bit-tricks-c-'));
		try {
			const fns: string[] = [];
			const calls: string[] = [];
			const expected: string[] = [];
			const labels: string[] = [];
			const pattern = (v: number | boolean) => String(Number(v));
			tricks.forEach((t, i) => {
				for (const w of [8, 16, 32] as Width[]) {
					const name = `trick_${i}_${w}`;
					const T = cType(t, w);
					fns.push(cFunction(t, w, name));
					const cases = cCases(t, w);
					calls.push(
						`{ static const unsigned long long cs[][3] = {${cases
							.map((c) => `{${c.x}u,${c.y}u,${c.n}u}`)
							.join(
								','
							)}};\n\tfor (unsigned i = 0; i < sizeof cs / sizeof cs[0]; i++) ${name}((${T})cs[i][0], (${T})cs[i][1], (unsigned)cs[i][2]); }`
					);
					for (const c of cases) {
						const want = reference[t.id](c.x, c.y, c.n, w);
						expected.push(Array.isArray(want) ? want.map(pattern).join(' ') : pattern(want));
						labels.push(`${t.id} at ${w} bits, x=${c.x} y=${c.y} n=${c.n}`);
					}
				}
			});
			const src = `#include <stdio.h>\n#include <stdint.h>\n${fns.join('\n')}\nint main(void) {\n\t${calls.join(
				'\n\t'
			)}\n\treturn 0;\n}\n`;
			writeFileSync(join(dir, 'tricks.c'), src);
			execFileSync(
				'gcc',
				['-std=c11', '-O1', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-o', 'tricks', 'tricks.c'],
				{ cwd: dir }
			);
			const got = execFileSync(join(dir, 'tricks'), { maxBuffer: 1 << 26 })
				.toString()
				.trim()
				.split('\n');
			expect(got.length).toBe(expected.length);
			const bad: string[] = [];
			for (let i = 0; i < got.length && bad.length < 10; i++)
				if (got[i] !== expected[i]) bad.push(`${labels[i]}: C gave ${got[i]}, want ${expected[i]}`);
			expect(bad).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

test.describe('reading what was typed', () => {
	test('decimal, signed decimal, hex, binary and characters', () => {
		expect(parseOperand('88', 8)).toBe(88);
		expect(parseOperand('-1', 8)).toBe(255);
		expect(parseOperand('-128', 8)).toBe(128);
		expect(parseOperand('-1', 32)).toBe(0xffffffff);
		expect(parseOperand('-2147483648', 32)).toBe(0x80000000);
		expect(parseOperand('4294967295', 32)).toBe(0xffffffff);
		expect(parseOperand('0xff', 8)).toBe(255);
		expect(parseOperand('0XdeadBEEF', 32)).toBe(0xdeadbeef);
		expect(parseOperand('0b0101_1000', 8)).toBe(88);
		expect(parseOperand('0b 0101 1000', 8)).toBe(88);
		expect(parseOperand(' 1 000 ', 16)).toBe(1000);
		expect(parseOperand("'a'", 8)).toBe(97);
		expect(parseOperand('"Z"', 8)).toBe(90);
		expect(parseOperand('−5', 8)).toBe(251);
		expect(parseOperand('-0x10', 8)).toBe(240);
		expect(parseOperand('0x000000FF', 8)).toBe(255);
	});

	test('out of range and malformed input is refused with a reason', () => {
		expect(() => parseOperand('256', 8)).toThrow(/0 to 255, or −128 to 127/);
		expect(() => parseOperand('-129', 8)).toThrow(/smallest 8-bit/);
		expect(() => parseOperand('0x1FF', 8)).toThrow(/9 bits/);
		expect(() => parseOperand('0b102', 8)).toThrow(/"2" is not a binary digit/);
		expect(() => parseOperand('0xG', 8)).toThrow(/"G" is not a hex digit/);
		expect(() => parseOperand('12a', 8)).toThrow(/Hex needs 0x/);
		expect(() => parseOperand('1.5', 8)).toThrow(BitTrickError);
		expect(() => parseOperand('', 8)).toThrow(BitTrickError);
		expect(() => parseOperand('0x', 8)).toThrow(/missing/);
		expect(() => parseOperand("'€'", 8)).toThrow(/more than 8 bits/);
		expect(() => parseOperand("'ab'", 8)).toThrow(/exactly one character/);
		expect(() => parseOperand('"e\u0301"', 8)).toThrow(/exactly one character/);
		expect(() => parseOperand('1'.repeat(100), 32)).toThrow(/characters/);
	});

	test('runTrick checks n against the trick and the width', () => {
		const t = getTrick('set-a-bit');
		expect(() => runTrick(t, { x: '1', y: '', n: 8 }, 8)).toThrow(/0 to 7/);
		expect(runTrick(t, { x: '1', y: '', n: 31 }, 32).trace.result.value).toBe(0x80000001);
		expect(() => runTrick(getTrick('sign-extension'), { x: '1', y: '', n: 0 }, 8)).toThrow(/1 to 8/);
		expect(() => runTrick(getTrick('xor-swap'), { x: '1', y: 'zz', n: 0 }, 8)).toThrow(/^y:/);
	});

	test('result text', () => {
		expect(resultText({ kind: 'bool', value: true }, 8)).toBe('true');
		expect(resultText({ kind: 'bits', value: 214 }, 8, true)).toBe('−42');
		expect(resultText({ kind: 'pair', value: [214, 88], names: ['min', 'max'] }, 8, true)).toBe('min = −42, max = 88');
	});
});

test.describe('the bit-manipulation-tricks page', () => {
	test('the served HTML already holds the default trace and every trick', async ({ page }) => {
		const html = await (await page.request.get('/bit-manipulation-tricks')).text();
		// The default: x & (x - 1) on 0101 1000 gives 0101 0000.
		expect(html).toContain('x &amp; (x - 1)');
		expect(html).toContain('0x58');
		expect(html).toContain('0x50');
		expect(html).toContain('The lowest set bit, bit 3, is cleared.');
		for (const t of tricks) expect(html, t.id).toContain(`id="${t.id}"`);
		// The select shows the traced trick before any script runs.
		expect(html).toMatch(/<option value="clear-lowest-set-bit"[^>]*selected/);
		expect(html.match(/<option[^>]*selected/g)?.length).toBe(1);
		expect(html).toContain('1 bit differs from x');
	});

	test('changing the inputs re-traces, and bad input says why', async ({ page }) => {
		await page.goto('/bit-manipulation-tricks');
		await page.waitForLoadState('networkidle');
		const answer = page.locator('.answer .answer-value');
		await page.locator('#x-input').fill('0xF0');
		await expect(answer).toHaveText('224');
		// A typed x carries over to the next trick.
		await page.locator('#trick').selectOption('count-set-bits-kernighan');
		await expect(page.locator('#x-input')).toHaveValue('0xF0');
		await expect(answer).toHaveText('4');
		await page.getByRole('button', { name: '32 bits' }).click();
		await page.locator('#x-input').fill('0xFFFFFFFF');
		await expect(answer).toHaveText('32');
		await expect(page.locator('.trace tbody tr').first()).toBeVisible();
		await page.locator('#x-input').fill('0x1FFFFFFFF');
		await expect(page.locator('.error')).toContainText('33 bits');
		await expect(page.locator('#x-input')).toHaveAttribute('aria-invalid', 'true');
		// Two operands and the aliasing aside.
		await page.locator('#trick').selectOption('xor-swap');
		await page.locator('#y-input').fill('7');
		await expect(answer).toContainText('y = 88');
		await expect(page.getByRole('heading', { name: /aliasing trap/ })).toBeVisible();
	});

	test('the trick and inputs round trip through the address bar', async ({ page }) => {
		await page.goto('/bit-manipulation-tricks');
		await page.waitForLoadState('networkidle');
		await page.locator('#trick').selectOption('set-a-bit');
		await page.getByRole('button', { name: '16 bits' }).click();
		await page.locator('#x-input').fill('-2');
		await page.locator('#n-input').fill('0');
		await expect(page).toHaveURL(/t=set-a-bit/);
		await expect(page).toHaveURL(/n=0/);
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#trick')).toHaveValue('set-a-bit');
		await expect(page.locator('#x-input')).toHaveValue('-2');
		await expect(page.locator('#n-input')).toHaveValue('0');
		await expect(page.getByRole('button', { name: '16 bits' })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.answer .answer-value')).toHaveText('65535');
		expect(page.url()).toBe(shared);
	});

	test('a trick anchor opens that trick in the tool', async ({ page }) => {
		await page.goto('/bit-manipulation-tricks#reverse-bits');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#trick')).toHaveValue('reverse-bits');
		await page.locator('#xor-swap').getByRole('link', { name: 'Trace it bit by bit' }).click();
		await expect(page.locator('#trick')).toHaveValue('xor-swap');
		await expect(page).toHaveURL(/t=xor-swap/);
	});

	test('the FAQ JSON-LD matches the visible questions and answers', async ({ page }) => {
		await page.goto('/bit-manipulation-tricks');
		const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
		const ld = blocks.map((b) => JSON.parse(b)).find((b) => b['@graph']);
		const webPage = ld['@graph'].find((n: { '@id'?: string }) => n['@id']?.endsWith('#webpage'));
		const questions = (await page.locator('.faq summary').allTextContents()).map((s) => s.trim());
		const answers = (await page.locator('.faq details p').allTextContents()).map((s) => s.trim());
		expect(webPage.mainEntity.map((q: { name: string }) => q.name)).toEqual(questions);
		expect(webPage.mainEntity.map((q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text)).toEqual(answers);
	});

	test('Prev and Next keep focus at the ends of the list', async ({ page }) => {
		await page.goto('/bit-manipulation-tricks?t=set-a-bit');
		await page.waitForLoadState('networkidle');
		const prev = page.getByRole('button', { name: 'Previous trick' });
		await prev.focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('#trick')).toHaveValue('test-a-bit');
		await expect(prev).toBeFocused();
		await expect(prev).toHaveAttribute('aria-disabled', 'true');
		await page.keyboard.press('Enter');
		await expect(page.locator('#trick')).toHaveValue('test-a-bit');
	});

	for (const width of [390, 1280])
		test(`every bit column lines up from row to row at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			for (const q of ['t=reverse-bits&w=16', 't=count-set-bits-swar&w=32&x=0xDEADBEEF', 't=parity&w=32']) {
				await page.goto(`/bit-manipulation-tricks?${q}`);
				await page.waitForLoadState('networkidle');
				const xs = await page.locator('#tool .trace').evaluate((t) =>
					[...t.querySelectorAll('.bit-row, .index-row')].map((row) => {
						const cells = [...row.querySelectorAll('span:not(.brk)')];
						return Math.round(cells[cells.length - 1].getBoundingClientRect().x);
					})
				);
				expect(new Set(xs).size, `${q}: ${xs.join(',')}`).toBe(1);
				// And the 32-bit trace fits its box without scrolling sideways.
				const fits = await page.locator('#tool .trace-scroll').evaluate((el) => el.scrollWidth <= el.clientWidth);
				expect(fits, q).toBe(true);
			}
		});

	test('no sideways scroll on a phone, even at 32 bits', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/bit-manipulation-tricks?t=reverse-bits&w=32&x=0x12345678');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.answer .answer-value')).toHaveText(String(0x1e6a2c48));
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(overflow).toBeLessThanOrEqual(0);
		// The two halves of a 32-bit row fit the trace box without scrolling.
		const fits = await page
			.locator('.trace-scroll')
			.first()
			.evaluate((el) => el.scrollWidth <= el.clientWidth);
		expect(fits).toBe(true);
	});
});
