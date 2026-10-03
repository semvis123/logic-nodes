// The expression language is checked against JavaScript itself: random
// expressions are written once as source for our parser and once as source
// for new Function (an oracle only; the shipped code never uses it), with the
// 32-bit and divide-by-zero rules spelled out in the oracle's text.

import { expect, test } from '@playwright/test';
import {
	compile,
	parse,
	evalGrid,
	paint,
	toSvg,
	pascalMod2,
	sierpinskiHolds,
	rootWorking,
	PatternError,
	PALETTES,
	PRESETS,
	MAX_LENGTH,
	colourOf,
	exportCell
} from '../src/lib/bitPattern.js';

let seed = 12345;
const rand = (n: number) => {
	seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
	return (seed >>> 8) % n;
};

const BINARY = '+ - * / % << >> & ^ |'.split(' ');
/** Returns our source and the oracle's source for the same random tree. */
function random(depth: number): [string, string] {
	if (depth === 0 || rand(5) === 0) {
		const pick = rand(6);
		if (pick < 3) return ['xyt'[pick], 'xyt'[pick]];
		const n = rand(300);
		return rand(2) ? [String(n), String(n)] : ['0x' + n.toString(16), String(n)];
	}
	if (rand(5) === 0) {
		const [s, o] = random(depth - 1);
		const op = '~-'[rand(2)];
		return [`${op}(${s})`, op === '~' ? `(~(${o}))` : `((-(${o}))|0)`];
	}
	const [as, ao] = random(depth - 1);
	const [bs, bo] = random(depth - 1);
	const op = BINARY[rand(BINARY.length)];
	const oracle: Record<string, string> = {
		'+': `((${ao}+${bo})|0)`,
		'-': `((${ao}-${bo})|0)`,
		'*': `Math.imul(${ao},${bo})`,
		'/': `D((${ao}),(${bo}),0)`,
		'%': `D((${ao}),(${bo}),1)`
	};
	return [`(${as}) ${op} (${bs})`, oracle[op] ?? `((${ao})${op}(${bo}))`];
}

test.describe('the expression language', () => {
	test('matches an independent oracle on random expressions', () => {
		const D = (a: number, b: number, rem: number) => (b === 0 ? 0 : (rem ? a % b : a / b) | 0);
		for (let i = 0; i < 400; i++) {
			const [src, oracleSrc] = random(1 + rand(5));
			const oracle = new Function('D', 'x', 'y', 't', `return ${oracleSrc};`) as (...a: unknown[]) => number;
			const fn = compile(src);
			const t = rand(256);
			const wrong: string[] = [];
			for (let y = 0; y < 16; y++)
				for (let x = 0; x < 16; x++)
					if ((fn(x, y, t) & 255) !== ((oracle(D, x, y, t) as number) & 255)) wrong.push(`${x},${y}`);
			expect(wrong, `${src} at t=${t}`).toEqual([]);
		}
	});

	test('precedence, literals and the 32-bit rules', () => {
		const v = (src: string, x = 0, y = 0, t = 0) => compile(src)(x, y, t);
		const cases: [string, number, number?][] = [
			['1 + 2 << 3', 24],
			['1 | 2 ^ 3 & 4', 3],
			['2 + 3 * 4', 14],
			['~x & 255', 250, 5],
			['-x', -5, 5],
			['- -x', 5, 5],
			['0x1F + 0b101', 36],
			['0XfF', 255],
			['7 / 2', 3],
			['-7 / 2', -3],
			['-7 % 3', -1],
			['5 / 0', 0],
			['5 % 0', 0],
			['1 << 31', -2147483648],
			['1 << 32', 1],
			['-8 >> 1', -4],
			['0xFFFFFFFF', -1],
			['2147483647 + 1', -2147483648],
			['65536 * 65536', 0],
			['46341 * 46341', -2147479015],
			['x ^ y', 6, 5],
			['-2147483648 / -1', -2147483648],
			['-2147483648 % -1', 0],
			['1 << -1', -2147483648],
			['-1 >> 40', -1],
			['5 % -3', 2],
			['x - -y', 5, 5]
		];
		for (const [src, want, x] of cases) expect(v(src, x ?? 0, src === 'x ^ y' ? 3 : 0), src).toBe(want);
	});

	test('errors name the position and the problem', () => {
		const bad: [string, string, number][] = [
			['x +', 'ends too soon', 3],
			['(x ^ y))', 'Unexpected ) at position 8', 8],
			['(x ^ y', 'never closed', 1],
			['x $ y', 'Unexpected character $ at position 3', 3],
			['x < y', 'single <', 3],
			['z', 'Unknown name z at position 1', 1],
			['12ab', 'Unexpected a in a number at position 3', 3],
			['0x', 'no digits', 1],
			['4294967296', '32 bits', 1],
			['* 2', 'Unexpected * at position 1', 1],
			['x y', 'Unexpected y at position 3', 3],
			['', 'Type an expression', 1],
			['  ', 'Type an expression', 1]
		];
		for (const [src, msg, at] of bad) {
			let err: PatternError | undefined;
			try {
				parse(src);
			} catch (e) {
				err = e as PatternError;
			}
			expect(err, src).toBeInstanceOf(PatternError);
			expect(err?.message, src).toContain(msg);
			expect(err?.at, src).toBe(at);
		}
	});

	test('long and deeply nested input fails cleanly or runs, never overflows the stack', () => {
		expect(() => parse('('.repeat(5000) + 'x' + ')'.repeat(5000))).toThrow(/longer than/);
		expect(() => parse('('.repeat(150) + 'x' + ')'.repeat(150))).toThrow(/Nested more than/);
		expect(() => parse('~'.repeat(200) + 'x')).toThrow(/Nested more than/);
		expect(compile('('.repeat(50) + 'x' + ')'.repeat(50))(7, 0, 0)).toBe(7);
		const chain = Array(MAX_LENGTH / 2 - 1)
			.fill('x')
			.join('+');
		expect(chain.length).toBeLessThanOrEqual(MAX_LENGTH);
		expect(compile(chain)(2, 0, 0)).toBe(2 * (MAX_LENGTH / 2 - 1));
	});
});

test.describe('the pictures', () => {
	test('x & y == 0 is Pascal triangle mod 2, built by addition, up to 256', () => {
		expect(sierpinskiHolds(256)).toBe(true);
		const g = pascalMod2(5);
		expect(Array.from(g.slice(5 * 4))).toEqual([1, 1, 1, 1, 0]);
		expect(Array.from(g.slice(5 * 2, 5 * 3))).toEqual([1, 1, 0, 0, 1]);
	});

	test('(x ^ y) & (x | y) and (x | y) - (x & y) draw exactly x ^ y', () => {
		const want = evalGrid(compile('x ^ y'), 256, 0);
		for (const e of ['(x ^ y) & (x | y)', '(x | y) - (x & y)', '(x + y) - 2 * (x & y)'])
			expect(evalGrid(compile(e), 256, 0), e).toEqual(want);
	});

	test('each quadrant of x ^ y is the half size picture, or that plus half the range', () => {
		const n = 64;
		const half = evalGrid(compile('x ^ y'), n / 2, 0);
		const full = evalGrid(compile('x ^ y'), n, 0);
		for (let y = 0; y < n; y++)
			for (let x = 0; x < n; x++) {
				const base = half[(y % (n / 2)) * (n / 2) + (x % (n / 2))];
				const offDiagonal = x >= n / 2 !== y >= n / 2;
				expect(full[y * n + x]).toBe(base + (offDiagonal ? n / 2 : 0));
			}
	});

	test('x | y is the x & y picture turned half way round and inverted', () => {
		const or = evalGrid(compile('x | y'), 128, 0);
		const and = evalGrid(compile('x & y'), 128, 0);
		for (let i = 0; i < or.length; i++) expect(or[i]).toBe(127 - and[or.length - 1 - i]);
	});

	test('colour modes', () => {
		const look = { mode: 'grey', bit: 3, pal: 'fire' } as const;
		expect(colourOf(look, 200)).toBe(0xc8c8c8);
		expect(colourOf({ ...look, mode: 'bit' }, 8)).not.toBe(colourOf({ ...look, mode: 'bit' }, 7));
		expect(colourOf({ ...look, mode: 'bit', bit: 0 }, 255)).toBe(colourOf({ ...look, mode: 'bit', bit: 7 }, 128));
		expect(colourOf({ ...look, mode: 'rgb' }, 1, 2, 3)).toBe(0x010203);
		for (const p of PALETTES) {
			const a = colourOf({ ...look, mode: 'palette', pal: p.id }, 0);
			const b = colourOf({ ...look, mode: 'palette', pal: p.id }, 255);
			expect(a, p.id).not.toBe(b);
			for (const c of [a, b]) expect(c).toBeLessThanOrEqual(0xffffff);
		}
		const rgbPaint = paint(['x', 'y', '0'].map(compile), { ...look, mode: 'rgb' }, 4, 0);
		expect(rgbPaint[1 * 4 + 2]).toBe(0x020100);
	});

	test('the SVG holds every pixel and stays small for a smooth picture', () => {
		const look = { mode: 'grey', bit: 0, pal: 'fire' } as const;
		const render = (e: string, size: number) => paint([compile(e)], look, size, 0);
		const colours = render('x ^ y', 16);
		const svg = toSvg(colours, 16, 4);
		expect(svg).toContain('width="64" height="64"');
		expect(svg).toContain('viewBox="0 0 16 16"');
		// Redraw the SVG's own runs and compare with the pixels.
		const bg = /<rect[^>]*fill="(#\w+)"/.exec(svg)?.[1] ?? '';
		const out = Array(256).fill(parseInt(bg.slice(1), 16));
		for (const m of svg.matchAll(/<path stroke="(#\w+)" d="([^"]*)"/g)) {
			let cx = 0;
			let cy = 0;
			for (const r of m[2].matchAll(/([Mm])(-?\d+) (-?[\d.]+)h(\d+)/g)) {
				[cx, cy] = r[1] === 'M' ? [+r[2], +r[3]] : [cx + +r[2], cy + +r[3]];
				for (let i = 0; i < +r[4]; i++) out[Math.floor(cy) * 16 + cx + i] = parseInt(m[1].slice(1), 16);
				cx += +r[4];
			}
		}
		expect(out).toEqual(Array.from(colours));
		expect(toSvg(render('7', 256), 256).length).toBeLessThan(400);
		expect(exportCell(256)).toBe(4);
		expect(exportCell(16) * 16).toBe(1024);
	});

	test('the working splits a top level AND, XOR or OR and nothing else', () => {
		const w = rootWorking('(x ^ y) & (x | y)', parse('(x ^ y) & (x | y)'));
		expect(w?.(5, 3, 0)).toEqual({ op: '&', aText: '(x ^ y)', bText: '(x | y)', a: 6, b: 7, result: 6 });
		expect(rootWorking('x * y', parse('x * y'))).toBeNull();
		expect(rootWorking('x', parse('x'))).toBeNull();
	});

	test('every preset compiles', () => {
		for (const p of PRESETS) for (const e of [p.e].flat()) expect(() => compile(e), e).not.toThrow();
	});
});

test.describe('the bitwise-pattern-generator page', () => {
	const URL = '/bitwise-pattern-generator';

	test('the prerendered HTML already holds the default picture and its working', async ({ request }) => {
		const html = await (await request.get(URL)).text();
		expect(html).toContain('viewBox="0 0 128 128"');
		expect(html).toContain('Pixel x 45, y 22');
		expect(html).toContain('XOR');
		expect(html).toContain('= 00111011');
	});

	test('typing redraws, an error keeps the last picture, and the keys move the pixel', async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState('networkidle');
		const picture = page.locator('.picture svg');
		const before = await picture.innerHTML();
		await page.fill('#expr0', 'x & y');
		await expect.poll(() => picture.innerHTML()).not.toBe(before);
		const good = await picture.innerHTML();
		await page.fill('#expr0', '(x ^ y))');
		await expect(page.locator('#err0')).toContainText('Unexpected ) at position 8');
		expect(await picture.innerHTML()).toBe(good);
		await page.fill('#expr0', 'x ^ y');
		await page.locator('.picture').focus();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Shift+ArrowDown');
		await expect(page.locator('.readout h2')).toHaveText('Pixel x 46, y 30');
		await expect(page.locator('[role=status][aria-live]').first()).toContainText('x 46, y 30');
	});

	test('RGB mode shows three fields and every setting survives a reload', async ({ page }) => {
		await page.goto(`${URL}?e=x%20%26%20y&s=32&m=bit&k=3&t=9`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#expr0')).toHaveValue('x & y');
		await expect(page.getByRole('button', { name: '32', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#t')).toHaveValue('9');
		await page.getByRole('button', { name: 'RGB', exact: true }).click();
		await page.fill('#expr2', 'x + t');
		await expect(page.locator('.field')).toHaveCount(3);
		await expect(page).toHaveURL(/m=rgb/);
		const url = page.url();
		await page.reload();
		await page.waitForLoadState('networkidle');
		expect(page.url()).toBe(url);
		await expect(page.locator('#expr2')).toHaveValue('x + t');
		await expect(page.locator('#expr1')).toHaveValue('x ^ y');
	});

	test('a preset chip loads its expression and size', async ({ page }) => {
		await page.goto(URL);
		await page.waitForLoadState('networkidle');
		await page.locator('.chips').getByRole('button', { name: 'Product, high byte' }).click();
		await expect(page.locator('#expr0')).toHaveValue('(x * y) >> 8');
		await expect(page.locator('.picture svg')).toHaveAttribute('viewBox', '0 0 256 256');
	});
});
