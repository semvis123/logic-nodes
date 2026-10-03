// The expression language is checked against JavaScript itself: random
// expressions are written once as source for our parser and once as source
// for new Function (an oracle only; the shipped code never uses it), with the
// 32-bit and divide-by-zero rules spelled out in the oracle's text.

import { expect, test, type Page } from '@playwright/test';
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
	exportCell,
	toRgba,
	SIN,
	angleOf,
	FUNCS
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

test.describe('the functions', () => {
	const at = (src: string, x = 0, y = 0, t = 0) => compile(src)(x, y, t);

	test('sqrt is the integer square root of every value a 256 grid can reach', () => {
		const f = compile('sqrt(x * 256 + y)');
		for (let x = 0; x < 256; x++)
			for (let y = 0; y < 256; y++) expect(f(x, y, 0)).toBe(Math.floor(Math.sqrt(x * 256 + y)));
		expect(at('sqrt(0 - 5)')).toBe(0);
		expect(at('sqrt(2147483647)')).toBe(46340);
	});

	test('sin is a whole turn in 256 steps from -127 to 127, and cos is sin a quarter turn on', () => {
		for (let a = 0; a < 256; a++) {
			expect(at('sin(x)', a)).toBe(Math.round(127 * Math.sin((2 * Math.PI * a) / 256)));
			expect(at('cos(x)', a)).toBe(at('sin(x + 64)', a));
			expect(at('sin(x)', a + 256)).toBe(at('sin(x)', a));
			expect(at('sin(x)', -a)).toBe(at('sin(x)', 256 - a));
		}
		expect([at('sin(64)'), at('sin(192)'), at('sin(0)'), at('cos(0)'), at('cos(128)')]).toEqual([
			127, -127, 0, 127, -127
		]);
		// A rounding that sat close to a half could differ between JavaScript engines; none does.
		const gap = Math.min(
			...Array.from(SIN, (_, i) => Math.abs(Math.abs((127 * Math.sin((2 * Math.PI * i) / 256)) % 1) - 0.5))
		);
		expect(gap).toBeGreaterThan(1e-6);
	});

	test('atan2(y, x) is the direction of (x, y) as a whole turn of 256, checked against sector boundaries', () => {
		expect([at('atan2(0, 1)'), at('atan2(1, 0)'), at('atan2(0, 0 - 1)'), at('atan2(0 - 1, 0)')]).toEqual([
			0, 64, 128, 192
		]);
		expect([at('atan2(1, 1)'), at('atan2(1, 0 - 1)'), at('atan2(0 - 1, 0 - 1)'), at('atan2(0, 0)')]).toEqual([
			32, 96, 160, 0
		]);
		// A second method: (x, y) belongs to step k when it lies between the rays half a step either side of k.
		const ray = (k: number) => [Math.cos(((k - 0.5) * 2 * Math.PI) / 256), Math.sin(((k - 0.5) * 2 * Math.PI) / 256)];
		const f = compile('atan2(y, x)');
		const wrong: string[] = [];
		for (let y = -90; y <= 90; y++)
			for (let x = -90; x <= 90; x++) {
				if (!x && !y) continue;
				const k = f(x, y, 0);
				const [lx, ly] = ray(k);
				const [hx, hy] = ray(k + 1);
				if (!(lx * y - ly * x > 0 && hx * y - hy * x < 0)) wrong.push(`${x},${y}`);
			}
		expect(wrong).toEqual([]);
		expect(at('atan2(y, x)', 3, 0 - 3)).toBe(at('atan2(0 - 3, 3)', 0, 0));
		expect(angleOf(-1, 0)).toBe(192);
		// No rounding sits close to a half step, so engines whose atan2 differs in the last bit still agree.
		let gap = 1;
		for (let y = -400; y <= 400; y++)
			for (let x = -400; x <= 400; x++)
				if (x || y) gap = Math.min(gap, Math.abs(Math.abs(((Math.atan2(y, x) * 256) / (2 * Math.PI)) % 1) - 0.5));
		expect(gap).toBeGreaterThan(1e-6);
	});

	test('abs, min and max follow 32-bit rules', () => {
		expect([at('abs(0 - 7)'), at('abs(7)'), at('abs(0 - 2147483647 - 1)')]).toEqual([7, 7, -2147483648]);
		expect([at('min(3, 0 - 4)'), at('max(3, 0 - 4)'), at('min(x, y)', 9, 2), at('max(x, y)', 9, 2)]).toEqual([
			-4, 3, 2, 9
		]);
	});

	test('functions nest and mix with operators; the error messages name the position', () => {
		expect(at('max(abs(x - 5), min(y, 3)) + 1', 2, 9)).toBe(4);
		expect(at('abs ( x )', 5)).toBe(5);
		const msg = (src: string) => {
			try {
				parse(src);
			} catch (e) {
				return (e as PatternError).message;
			}
			return '';
		};
		expect(msg('sin')).toContain('needs (');
		expect(msg('min(1)')).toContain('two arguments');
		expect(msg('atan2(1)')).toContain('two arguments');
		expect(msg('min(1, 2')).toContain('never closed');
		expect(msg('abs(1, 2)')).toContain('Unexpected ,');
		expect(msg('foo(1)')).toContain('Unknown name foo');
		expect(msg('1, 2')).toContain('Unexpected ,');
		expect(msg('abs('.repeat(70) + '1' + ')'.repeat(70))).toContain('deep');
		expect(Object.keys(FUNCS).sort()).toEqual(['abs', 'atan2', 'cos', 'max', 'min', 'sin', 'sqrt']);
	});

	test('paint into a reused buffer matches a fresh one, and toRgba writes opaque RGBA', () => {
		const fns = ['x', 'y', 'x ^ y'].map(compile);
		for (const mode of ['rgb', 'palette', 'grey', 'bit'] as const) {
			const look = { mode, bit: 2, pal: 'fire' };
			const buf = new Uint32Array(16 * 16).fill(7);
			expect(paint(fns, look, 16, 3, 1, buf)).toBe(buf);
			expect(Array.from(buf)).toEqual(Array.from(paint(fns, look, 16, 3)));
		}
		const data = new Uint8ClampedArray(8);
		toRgba([0x102030, 0xffeedd], data);
		expect(Array.from(data)).toEqual([0x10, 0x20, 0x30, 255, 0xff, 0xee, 0xdd, 255]);
	});

	test('every moving preset parses, uses t, and changes between frames', () => {
		const moving = PRESETS.filter((p) => p.play);
		expect(moving.length).toBeGreaterThanOrEqual(20);
		for (const p of moving) {
			const fns = [p.e].flat().map(compile);
			const look = { mode: p.mode, bit: p.bit ?? 0, pal: p.pal ?? 'fire' };
			const a = paint(fns, look, 32, 10, 4);
			const b = paint(fns, look, 32, 60, 4);
			expect(
				a.some((c, i) => c !== b[i]),
				p.label
			).toBe(true);
		}
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

	test('every preset compiles, fits the limit, and is marked as moving exactly when it uses t', () => {
		expect(new Set(PRESETS.map((p) => p.label)).size).toBe(PRESETS.length);
		for (const p of PRESETS) {
			const es = [p.e].flat();
			for (const e of es) expect(() => compile(e), e).not.toThrow();
			expect(
				es.every((e) => e.length <= MAX_LENGTH),
				p.label
			).toBe(true);
			expect(
				es.some((e) => /\bt\b/.test(e)),
				p.label
			).toBe(!!p.play);
			expect(p.note.length, p.label).toBeGreaterThan(20);
		}
	});

	test('a 32 by 32 thumbnail of every preset is cheap', () => {
		const t0 = performance.now();
		for (const p of PRESETS)
			paint(
				[p.e].flat().map(compile),
				{ mode: p.mode, bit: p.bit ?? 0, pal: p.pal ?? 'fire' },
				32,
				p.t ?? 0,
				p.size / 32
			);
		expect(performance.now() - t0).toBeLessThan(500);
	});
});

/** A fingerprint of the canvas, to see that the picture changed or stayed. */
const pixels = (page: Page) =>
	page.locator('.picture canvas').evaluate((c: HTMLCanvasElement) => {
		const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let h = 0;
		for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0;
		return `${c.width}:${h}`;
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
		const before = await pixels(page);
		await page.fill('#expr0', 'x & y');
		await expect.poll(() => pixels(page)).not.toBe(before);
		const good = await pixels(page);
		await page.fill('#expr0', '(x ^ y))');
		await expect(page.locator('#err0')).toContainText('Unexpected ) at position 8');
		expect(await pixels(page)).toBe(good);
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
		await expect(page).toHaveURL(/g=x\+%2B\+t/);
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
		await expect(page.locator('.picture canvas')).toHaveAttribute('width', '256');
	});

	test('Animate steps t at the chosen speed, and a moving preset starts by itself', async ({ page }) => {
		await page.goto(`${URL}?v=120`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#speed')).toHaveValue('120');
		const animate = page.getByRole('button', { name: 'Animate' });
		await expect(animate).toHaveAttribute('aria-pressed', 'false');
		await animate.click();
		await expect(page.locator('#t')).not.toHaveValue('0');
		await animate.click();
		await expect(animate).toHaveAttribute('aria-pressed', 'false');
		const stopped = await page.locator('#t').inputValue();
		await page.waitForTimeout(300);
		expect(await page.locator('#t').inputValue()).toBe(stopped);
		await expect(page).toHaveURL(/v=120/);
		await page.locator('.chips').getByRole('button', { name: 'Plasma' }).click();
		await expect(animate).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('input[id^=expr]')).toHaveCount(3);
		const a = await pixels(page);
		await expect.poll(() => pixels(page)).not.toBe(a);
		await page.locator('.chips').getByRole('button', { name: 'XOR texture' }).click();
		await expect(animate).toHaveAttribute('aria-pressed', 'false');
	});

	test('dragging t does not hammer history.replaceState', async ({ page }) => {
		await page.addInitScript(() => {
			const w = window as unknown as { calls: number };
			w.calls = 0;
			const original = history.replaceState.bind(history);
			history.replaceState = (...args) => {
				w.calls++;
				return original(...args);
			};
		});
		await page.goto(URL);
		await page.waitForLoadState('networkidle');
		await page.evaluate(() => {
			const t = document.getElementById('t') as HTMLInputElement;
			for (let i = 1; i <= 200; i++) {
				t.value = String(i % 256);
				t.dispatchEvent(new Event('input', { bubbles: true }));
			}
		});
		await expect(page).toHaveURL(/t=200/);
		expect(await page.evaluate(() => (window as unknown as { calls: number }).calls)).toBeLessThan(60);
	});
});
