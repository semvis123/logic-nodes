// The Venn diagram generator and the set notation page shade regions, print
// simplest expressions and state the laws of set algebra. All of it comes from
// src/lib/venn.ts, so the engine is checked here against plain JavaScript Set
// operations on concrete sets, and the drawn regions against point membership.

import { expect, test } from '@playwright/test';
import {
	parseSet,
	formatSet,
	shade,
	setsNeeded,
	regionNotation,
	regionWords,
	shortestExpression,
	sumOfProducts,
	sameShading,
	evaluateOn,
	subExpressions,
	analyse,
	vennLayout,
	vennSvg,
	inSet,
	booleanText,
	SetError,
	type SetExpr
} from '../src/lib/venn.js';
import { parseExpression, truthTable } from '../src/lib/boolean.js';

// One element in every region of a three-set diagram: element i is in exactly
// the sets whose bit is set in i (A = 4, B = 2, C = 1). Element 0 is in none.
const universe = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
const concrete = {
	A: new Set([...universe].filter((i) => inSet(i, 0, 3))),
	B: new Set([...universe].filter((i) => inSet(i, 1, 3))),
	C: new Set([...universe].filter((i) => inSet(i, 2, 3)))
};
const js = {
	union: (x: Set<number>, y: Set<number>) => new Set([...x, ...y]),
	inter: (x: Set<number>, y: Set<number>) => new Set([...x].filter((v) => y.has(v))),
	diff: (x: Set<number>, y: Set<number>) => new Set([...x].filter((v) => !y.has(v))),
	comp: (x: Set<number>) => new Set([...universe].filter((v) => !x.has(v)))
};
const { A, B, C } = concrete;

/** Which regions, as indices, the expression shades in a 3-set diagram. */
const shadedIndices = (input: string, n = 3) =>
	shade(parseSet(input), n)
		.map((v, i) => (v ? i : -1))
		.filter((i) => i >= 0);
const sorted = (s: Set<number>) => [...s].sort((x, y) => x - y);

test.describe('set expressions', () => {
	test('regions agree with JavaScript Set operations on concrete sets', () => {
		const cases: [string, Set<number>][] = [
			['A ∪ B', js.union(A, B)],
			['A ∩ B', js.inter(A, B)],
			['A − B', js.diff(A, B)],
			['(A ∪ B)′', js.comp(js.union(A, B))],
			['A′ ∩ B′', js.inter(js.comp(A), js.comp(B))],
			['A Δ B', js.union(js.diff(A, B), js.diff(B, A))],
			['(A ∩ B) ∪ C', js.union(js.inter(A, B), C)],
			['A ∩ (B ∪ C)', js.inter(A, js.union(B, C))],
			['A − (B ∪ C)', js.diff(A, js.union(B, C))],
			[
				'(A Δ B) Δ C',
				js.union(js.diff(js.union(js.diff(A, B), js.diff(B, A)), C), js.diff(C, js.union(js.diff(A, B), js.diff(B, A))))
			],
			['U − C', js.comp(C)],
			['∅ ∪ A', A],
			['A ∩ U', A]
		];
		for (const [input, expected] of cases) {
			expect(shadedIndices(input), input).toEqual(sorted(expected));
			expect(sorted(evaluateOn(parseSet(input), concrete, universe)), input).toEqual(sorted(expected));
		}
	});

	test('every expression over three sets agrees with the concrete evaluation', () => {
		// Random expressions, deterministic seed, checked both ways.
		let seed = 7;
		const rand = (n: number) => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed % n;
		};
		const build = (depth: number): SetExpr => {
			if (depth === 0 || rand(3) === 0) return { t: 'set', name: 'ABC'[rand(3)] };
			const kind = rand(5);
			if (kind === 4) return { t: 'comp', a: build(depth - 1) };
			const t = (['union', 'inter', 'diff', 'sym'] as const)[kind];
			return { t, a: build(depth - 1), b: build(depth - 1) };
		};
		for (let i = 0; i < 300; i++) {
			const expr = build(4);
			const regions = shade(expr, 3)
				.map((v, r) => (v ? r : -1))
				.filter((r) => r >= 0);
			expect(regions, formatSet(expr)).toEqual(sorted(evaluateOn(expr, concrete, universe)));
			// Printing and parsing back is lossless.
			expect(sameShading(parseSet(formatSet(expr)), expr), formatSet(expr)).toBe(true);
		}
	});

	test("De Morgan's laws hold for sets", () => {
		expect(sameShading(parseSet('(A ∪ B)′'), parseSet('A′ ∩ B′'))).toBe(true);
		expect(sameShading(parseSet('(A ∩ B)′'), parseSet('A′ ∪ B′'))).toBe(true);
		expect(sameShading(parseSet('(A ∪ B ∪ C)′'), parseSet('A′ ∩ B′ ∩ C′'))).toBe(true);
		expect(sameShading(parseSet('(A ∪ B)′'), parseSet('A′ ∪ B′'))).toBe(false);
	});

	test('every shading has a shortest and a sum of products expression that shade it back', () => {
		for (const n of [1, 2, 3]) {
			const size = 1 << n;
			for (let mask = 0; mask < 1 << size; mask++) {
				const shaded = Array.from({ length: size }, (_, i) => !!(mask & (1 << i)));
				for (const expr of [shortestExpression(shaded, n), sumOfProducts(shaded, n)]) {
					const text = formatSet(expr);
					const back = parseSet(text);
					expect(setsNeeded(back) <= n, text).toBe(true);
					expect(shade(back, n), `${n} sets, mask ${mask}: ${text}`).toEqual(shaded);
				}
			}
		}
	});

	test('the shortest expressions are the familiar ones', () => {
		const shortest = (input: string, n = 2) => formatSet(shortestExpression(shade(parseSet(input), n), n));
		expect(shortest('A′ ∩ B′')).toBe('(A ∪ B)′');
		expect(shortest('A ∩ B′')).toBe('A − B');
		expect(shortest('(A − B) ∪ (B − A)')).toBe('A Δ B');
		expect(shortest('A ∪ (A ∩ B)')).toBe('A');
		expect(shortest('A ∩ A′')).toBe('∅');
		expect(shortest('A ∪ A′')).toBe('U');
		expect(shortest('(A ∩ B) ∪ (A ∩ C)', 3)).toBe('A ∩ (B ∪ C)');
		expect(formatSet(sumOfProducts(shade(parseSet('A ∩ (B ∪ C)'), 3), 3))).toBe('(A ∩ B) ∪ (A ∩ C)');
	});

	test('the boolean equivalent has the same truth table', () => {
		for (const input of ['A − B', 'A Δ (B ∪ C′)', '(A ∩ B)′ ∪ C', 'U − A', '∅ ∪ B']) {
			const expr = parseSet(input);
			const n = setsNeeded(expr);
			const ast = parseExpression(booleanText(expr));
			expect(truthTable(ast, ['A', 'B', 'C'].slice(0, n)).rows, input).toEqual(shade(expr, n));
		}
		expect(booleanText(parseSet('A − B'))).toBe('A ∧ ¬B');
	});

	test('every notation for an operator reads the same', () => {
		const same = (inputs: string[]) => {
			const expected = formatSet(parseSet(inputs[0]));
			for (const input of inputs) expect(formatSet(parseSet(input)), input).toBe(expected);
		};
		same(['A ∪ B', 'A | B', 'A + B', 'A or B', 'A union B', 'A U B', 'a u b', 'AuB', 'A ∨ B']);
		same(['A ∩ B', 'A & B', 'A and B', 'A intersect B', 'A n B', 'AnB', 'a ∩ b']);
		same(['A′', "A'", 'Aᶜ', 'A^c', '~A', '¬A', 'not A', '!A']);
		same(['A − B', 'A - B', 'A \\ B', 'A minus B']);
		same(['A Δ B', 'A ⊕ B', 'A xor B']);
		same(['∅', '{}']);
		same(['U', 'ξ']);
		same(['(A ∪ B)′', "(A | B)'", '~(A ∪ B)', '[A ∪ B]′']);
	});

	test('U is the universal set as an operand and union between sets', () => {
		expect(formatSet(parseSet('U − A'))).toBe('U − A');
		expect(formatSet(parseSet('A U B'))).toBe('A ∪ B');
		expect(formatSet(parseSet('A ∩ U'))).toBe('A ∩ U');
		expect(formatSet(parseSet('A U U'))).toBe('A ∪ U');
	});

	test('precedence: complement, then intersection, then difference, then union', () => {
		expect(formatSet(parseSet('A ∪ B ∩ C'))).toBe('A ∪ (B ∩ C)');
		expect(formatSet(parseSet('A ∩ B ∪ C'))).toBe('(A ∩ B) ∪ C');
		expect(formatSet(parseSet('A − B ∩ C'))).toBe('A − (B ∩ C)');
		expect(formatSet(parseSet('A ∪ B − C'))).toBe('A ∪ (B − C)');
		expect(formatSet(parseSet('A − B − C'))).toBe('(A − B) − C');
		expect(formatSet(parseSet('A Δ B − C'))).toBe('(A Δ B) − C');
		expect(formatSet(parseSet('A ∩ B′'))).toBe('A ∩ B′');
		expect(formatSet(parseSet('(A ∩ B)′'))).toBe('(A ∩ B)′');
		expect(formatSet(parseSet('¬A ∩ B'))).toBe('A′ ∩ B');
		expect(formatSet(parseSet('A ∪ B ∪ C'))).toBe('A ∪ B ∪ C');
	});

	test('errors say what is wrong', () => {
		const error = (input: string) => {
			try {
				parseSet(input);
			} catch (e) {
				expect(e).toBeInstanceOf(SetError);
				return (e as Error).message;
			}
			return 'no error';
		};
		expect(error('')).toMatch(/Type a set expression/);
		expect(error('AB')).toMatch(/between A and B/);
		expect(error('A ∪')).toMatch(/missing after ∪/);
		expect(error('∩ B')).toMatch(/needs a set on its left/);
		expect(error('(A ∪ B')).toMatch(/never closed/);
		expect(error('A ∪ B)')).toMatch(/closing bracket without an opening/);
		expect(error('A ∪ D')).toMatch(/D is not one of the sets/);
		expect(error('A ∪ ()')).toMatch(/nothing between/);
		expect(error('A ^ B')).toMatch(/complement as A′ or A\^c/);
		expect(error('A # B')).toMatch(/"#" is not a set symbol/);
		expect(error('′A')).toMatch(/needs a set before it/);
		expect(error('A ∪ ∩ B')).toMatch(/missing between ∪ and ∩/);
		expect(error('apple')).toMatch(/"apple" is not a set or an operator/);
	});

	test('the number of sets follows the highest letter used', () => {
		expect(setsNeeded(parseSet('A′'))).toBe(1);
		expect(setsNeeded(parseSet('U'))).toBe(1);
		expect(setsNeeded(parseSet('B'))).toBe(2);
		expect(setsNeeded(parseSet('A ∪ C'))).toBe(3);
		expect(analyse('A ∪ B', 3).n).toBe(3);
		expect(analyse('A ∪ C', 2).n).toBe(3);
		expect(() => shade(parseSet('C'), 2)).toThrow(SetError);
	});

	test('regions are named in notation and in words', () => {
		expect(regionNotation(5, 3)).toBe('A ∩ B′ ∩ C');
		expect(regionWords(5, 3)).toBe('In A and C but not B');
		expect(regionWords(0, 3)).toBe('Outside A, B and C');
		expect(regionWords(7, 3)).toBe('In A, B and C');
		expect(regionWords(4, 3)).toBe('In A but not B or C');
		expect(regionWords(2, 2)).toBe('In A but not B');
		expect(regionWords(0, 1)).toBe('Outside A');
		expect(regionNotation(1, 1)).toBe('A');
	});

	test('sub-expressions come innermost first and end with the whole', () => {
		const steps = subExpressions(parseSet('(A ∪ B)′ ∩ C')).map(formatSet);
		expect(steps).toEqual(['A', 'B', 'A ∪ B', '(A ∪ B)′', 'C', '(A ∪ B)′ ∩ C']);
	});
});

test.describe('diagram geometry', () => {
	test('every region path covers exactly its region', async ({ page }) => {
		for (const n of [1, 2, 3]) {
			const layout = vennLayout(n);
			await page.setContent(vennSvg(n, new Array(1 << n).fill(false)));
			const mismatches = await page.evaluate(
				({ layout, n }) => {
					const svg = document.querySelector('svg')!;
					const paths = Array.from(svg.querySelectorAll('path')) as SVGPathElement[];
					const out: string[] = [];
					const u = layout.universe;
					for (let y = u.y + 1; y < u.y + u.h; y += 3) {
						for (let x = u.x + 1; x < u.x + u.w; x += 3) {
							// Skip points within a pixel of an outline, where rounding decides.
							const near = layout.circles.some((c: any) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r) < 1);
							if (near) continue;
							const expected = layout.circles.reduce(
								(acc: number, c: any, set: number) =>
									(x - c.cx) ** 2 + (y - c.cy) ** 2 < c.r ** 2 ? acc | (1 << (n - 1 - set)) : acc,
								0
							);
							const point = new DOMPoint(x, y);
							const hits = paths.map((p, i) => (p.isPointInFill(point) ? i : -1)).filter((i) => i >= 0);
							if (hits.length !== 1 || hits[0] !== expected)
								out.push(`${n} sets (${x}, ${y}): expected ${expected}, got ${hits.join('/')}`);
						}
					}
					return out;
				},
				{ layout, n }
			);
			expect(mismatches.slice(0, 5), mismatches.slice(0, 5).join('\n')).toEqual([]);
		}
	});
});

test.describe('pages', () => {
	test('the generator shades the default expression and prints the shortest form', async ({ page }) => {
		await page.goto('/venn-diagram-generator');
		const regions = page.locator('.venn-main [data-region]');
		await expect(regions).toHaveCount(8);
		const shaded = await regions.evaluateAll((els) =>
			els.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => Number(e.getAttribute('data-region')))
		);
		expect(shaded.sort()).toEqual(shadedIndices('A ∩ (B ∪ C)'));
		await expect(page.locator('.shortest')).toContainText('A ∩ (B ∪ C)');
	});

	test('clicking regions builds the expression', async ({ page }) => {
		await page.goto('/venn-diagram-generator?s=A%20%E2%88%AA%20B');
		await expect(page.locator('#set-expression')).toHaveValue('A ∪ B');
		await expect(page.locator('.venn-main [data-region]')).toHaveCount(4);
		// Unshade the overlap: A ∪ B less A ∩ B is the symmetric difference.
		await page.locator('.venn-main [data-region="3"]').click();
		await expect(page.locator('#set-expression')).toHaveValue('A Δ B');
		// Keyboard: focus the outside and press Enter.
		await page.locator('.venn-main [data-region="0"]').focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('#set-expression')).toHaveValue('(A ∩ B)′');
		expect(page.url()).toContain('s=');
	});

	test('the set notation page only marks laws the engine verified', async ({ page }) => {
		await page.goto('/set-notation');
		const rows = page.locator('.laws tbody tr');
		expect(await rows.count()).toBeGreaterThan(10);
		await expect(page.locator('.laws .checked')).toHaveCount(await rows.count());
	});
});
