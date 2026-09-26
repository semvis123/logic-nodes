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
	encodeNames,
	decodeNames,
	encodeItems,
	decodeItems,
	itemSlot,
	regionText,
	MAX_NAME_LENGTH,
	MAX_ITEMS_LENGTH,
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

test.describe('names and items', () => {
	test('names and items survive a round trip through the link', () => {
		const names = ['Cats', 'Dogs', 'Pets'];
		expect(encodeNames(names, 3)).toBe('Cats|Dogs|Pets');
		expect(encodeNames(names, 2)).toBe('Cats|Dogs');
		expect(encodeNames(['', 'Dogs', ''], 3)).toBe('|Dogs');
		expect(encodeNames(['', '', ''], 3)).toBe('');
		expect(decodeNames('Cats|Dogs|Pets')).toEqual(names);
		expect(decodeNames('|Dogs')).toEqual(['', 'Dogs', '']);
		expect(decodeNames(undefined)).toEqual(['', '', '']);
		// Bounded, and the separator cannot be smuggled in.
		expect(decodeNames('x'.repeat(50))[0]).toHaveLength(MAX_NAME_LENGTH);

		const items = new Array(8).fill('');
		items[itemSlot(2, 2)] = 'penguin, ostrich';
		items[itemSlot(3, 2)] = ' eagle ,, owl ';
		items[itemSlot(0, 2)] = 'cat';
		const text = encodeItems(items, 2);
		expect(text).toBe('out:cat;A:penguin,ostrich;AB:eagle,owl');
		const back = decodeItems(text);
		expect(back[itemSlot(2, 2)]).toBe('penguin, ostrich');
		expect(back[itemSlot(3, 2)]).toBe('eagle, owl');
		expect(encodeItems(back, 2)).toBe(text);
		// Region "A only" of two sets is "A only, not C" of three: the items stay put.
		expect(itemSlot(2, 2)).toBe(itemSlot(4, 3));
		expect(encodeItems(back, 3)).toBe('out:cat;A:penguin,ostrich;AB:eagle,owl');
		// Only the regions a diagram shows are written into its link.
		const withC = decodeItems('C:fish;A:bee');
		expect(encodeItems(withC, 2)).toBe('A:bee');
		expect(encodeItems(withC, 3)).toBe('C:fish;A:bee');
		// Unknown keys are ignored, lists are bounded, and ; cannot end up inside a list.
		expect(decodeItems('D:x;ABCD:y;nonsense')).toEqual(new Array(8).fill(''));
		expect(decodeItems(`A:${'a,'.repeat(200)}`)[4].length).toBeLessThanOrEqual(MAX_ITEMS_LENGTH);
		items[4] = 'a;b';
		expect(encodeItems(items, 3)).toContain('A:a,b');
	});

	test('region text stays inside its region and says what it leaves out', () => {
		const many = ['apple', 'pear', 'banana', 'kiwi', 'strawberry', 'plum', 'fig', 'grape', 'melon', 'lime'];
		for (const n of [1, 2, 3]) {
			const layout = vennLayout(n);
			const regionOf = (x: number, y: number) =>
				layout.circles.reduce(
					(acc, c, set) => ((x - c.cx) ** 2 + (y - c.cy) ** 2 < c.r ** 2 ? acc | (1 << (n - 1 - set)) : acc),
					0
				);
			for (const region of layout.regions) {
				for (const items of [['tiger'], ['a', 'b'], many]) {
					const lines = regionText(n, region.index, items);
					expect(lines.length).toBeGreaterThan(0);
					for (const line of lines) {
						// The middle of the line's height is in the region it describes.
						expect(regionOf(line.x, line.y - 4), `${n} sets, region ${region.index}`).toBe(region.index);
						expect(line.y).toBeLessThan(layout.universe.y + layout.universe.h);
					}
					const shown = lines.flatMap((l) => l.text.split(', '));
					const more = shown.find((t) => /^\+\d+/.test(t) || / \+\d+$/.test(t));
					if (!more) {
						// Nothing left out: every item appears, whole.
						expect([...shown].sort()).toEqual([...items].sort());
					} else {
						const count = Number(more.match(/\+(\d+)/)![1]);
						const whole = shown.filter((t) => items.includes(t));
						expect(whole.length + count).toBeLessThanOrEqual(items.length);
					}
				}
			}
			// A short list fits in every region of two sets without being shortened.
			for (const region of layout.regions) {
				if (n < 3) expect(regionText(n, region.index, ['tiger']).map((l) => l.text)).toEqual(['tiger']);
			}
		}
		// Region labels come first, then the items.
		expect(regionText(2, 3, ['owl'], 'm3').map((l) => [l.kind, l.text])).toEqual([
			['label', 'm3'],
			['item', 'owl']
		]);
		expect(regionText(2, 3, [], '').length).toBe(0);
	});

	test('the SVG download includes the names and items, escaped', async ({ page }) => {
		const svg = vennSvg(2, [false, false, true, true], {
			names: ['Cats & kittens', 'Dogs'],
			items: [['rock'], [], ['<tiger>'], ['lion']],
			title: 'A'
		});
		expect(svg).toContain('Cats &amp; kittens');
		expect(svg).toContain('&lt;tiger&gt;');
		await page.setContent(svg);
		const texts = await page.locator('text').allTextContents();
		expect(texts).toEqual(expect.arrayContaining(['Cats & kittens', 'Dogs', '<tiger>', 'lion', 'rock']));
		// Well formed, as a file on its own.
		const errors = await page.evaluate(
			(source) => new DOMParser().parseFromString(source, 'image/svg+xml').getElementsByTagName('parsererror').length,
			svg
		);
		expect(errors).toBe(0);
	});
});

test.describe('generator names, items and links', () => {
	test('names and items from the link are drawn, and typing updates the link', async ({ page }) => {
		await page.goto('/venn-diagram-generator?s=A%20%E2%88%A9%20B&names=Cats|Dogs&items=A:tiger;AB:lion,puma');
		const diagram = page.locator('.venn-main svg');
		await expect(diagram.locator('text.set-label')).toHaveText(['U', 'Cats', 'Dogs']);
		await expect(diagram.locator('text.item')).toContainText(['tiger']);
		await expect(diagram.locator('text.item', { hasText: 'lion' })).toHaveText('lion, puma');
		// The expression keeps its letters; the words use the names.
		await expect(page.locator('#set-expression')).toHaveValue('A ∩ B');
		await expect(diagram.locator('[data-region="3"]')).toHaveAttribute('aria-label', /In Cats and Dogs.*lion, puma/);
		await expect(page.locator('details.custom')).toHaveAttribute('open', '');

		await page.locator('#items-1').fill('wolf, fox');
		await expect(diagram.locator('text.item', { hasText: 'wolf' })).toHaveText('wolf, fox');
		await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBe('B:wolf,fox;A:tiger;AB:lion,puma');
		await page.locator('.names input').first().fill('Big cats');
		await expect(diagram.locator('text.set-label').nth(1)).toHaveText('Big cats');
		await expect.poll(() => new URL(page.url()).searchParams.get('names')).toBe('Big cats|Dogs');

		// A reload gives back the same diagram.
		await page.reload();
		await expect(diagram.locator('text.set-label')).toHaveText(['U', 'Big cats', 'Dogs']);
		await expect(page.locator('#items-1')).toHaveValue('wolf, fox');
	});

	test('the example fills in names and items, and clearing removes them', async ({ page }) => {
		await page.goto('/venn-diagram-generator');
		await page.locator('details.custom summary').click();
		await page.getByRole('button', { name: 'Example: birds that fly' }).click();
		const diagram = page.locator('.venn-main svg');
		await expect(diagram.locator('text.set-label')).toHaveText(['U', 'Birds', 'Can fly']);
		await expect(diagram.locator('text.item')).not.toHaveCount(0);
		await page.getByRole('button', { name: 'Clear names and items' }).click();
		await expect(diagram.locator('text.set-label')).toHaveText(['U', 'A', 'B']);
		await expect(diagram.locator('text.item')).toHaveCount(0);
		await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBeNull();
	});

	test('descriptions keep set letters in capitals', async ({ page }) => {
		await page.goto('/venn-diagram-generator');
		const step = page.locator('.step svg').last();
		await expect(step).toHaveAttribute(
			'aria-label',
			/shaded in A and C but not B; in A and B but not C; in A, B and C\./
		);
	});

	test('an unused set is pointed out under the truth table link', async ({ page }) => {
		await page.goto('/venn-diagram-generator?s=C&sets=3');
		await expect(page.locator('.link-note')).toContainText('does not use A or B');
		await page.locator('#set-expression').fill('A ∩ B ∩ C');
		await expect(page.locator('.link-note')).toHaveCount(0);
	});

	test('the Karnaugh map text names a region the diagram has', async ({ page }) => {
		await page.goto('/venn-diagram-generator?s=A%20%E2%88%AA%20B');
		const text = page.locator('#karnaugh .reducer');
		await expect(text).toContainText('region m2 of the diagram');
		await expect(text).toContainText('A ∩ B′');
		await page.locator('#set-expression').fill('A ∩ C');
		await expect(text).toContainText('region m5 of the diagram');
		await page.locator('#set-expression').fill('A′');
		await expect(text).toContainText('region m1 of the diagram');
	});
});
