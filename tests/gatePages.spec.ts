// The per-gate pages. The first half checks every claim in gates.ts that the
// pages print (the 3-input readings, the row-by-row contrasts, the symbol
// labels and the truth-table FAQ) against the expression engine; the second
// half checks the built pages carry the sections those claims fill.

import { expect, test } from '@playwright/test';
import { gates } from '../src/lib/gates.js';
import { shapes } from '../src/lib/symbols.js';
import { equivalent, parseExpression, truthTable } from '../src/lib/boolean.js';

const rows = (source: string, variables: string[]) => truthTable(parseExpression(source), variables).rows;
const same = (x: string, y: string) => equivalent(parseExpression(x), parseExpression(y));
const ones = (row: number) => row.toString(2).split('1').length - 1;
const differ = (x: boolean[], y: boolean[]) => x.flatMap((v, i) => (v !== y[i] ? [i] : []));
const need = <T>(value: T | undefined, what: string): T => {
	if (value === undefined) throw new Error(`missing ${what}`);
	return value;
};
const gate = (slug: string) =>
	need(
		gates.find((g) => g.slug === slug),
		`gate ${slug}`
	);
const wideOf = (slug: string) => need(gate(slug).wide, `3-input ${slug}`);
const ABC = ['a', 'b', 'c'];

test.describe('gate facts', () => {
	test('every gate that takes more than two inputs has a 3-input reading, and only those', () => {
		for (const g of gates) {
			expect(!!g.wide, g.name).toBe(g.inputs === 'many');
			expect(g.examples.length, g.name).toBeGreaterThanOrEqual(3);
			expect(g.faqs.length, g.name).toBeGreaterThanOrEqual(4);
			expect(g.faqs.length, g.name).toBeLessThanOrEqual(6);
			for (const faq of g.faqs) expect(faq.q, g.name).toMatch(/\?$/);
		}
		expect(gates.filter((g) => g.wide).map((g) => g.slug)).toEqual(['and', 'or', 'xor', 'nand', 'nor', 'xnor']);
	});

	test('each 3-input gate is high on exactly the input counts it claims', () => {
		for (const g of gates) {
			const w = g.wide;
			if (!w) continue;
			const table = rows(w.source, ABC);
			expect(table, g.name).toHaveLength(8);
			table.forEach((value, row) => expect(value, `${g.name} row ${row}`).toBe(w.highWhen.includes(ones(row))));
			// The 3-input source reduces to the 2-input gate when c is held at the
			// value that leaves it neutral: 1 for AND and NAND, 0 for the rest.
			const neutral = g.slug === 'and' || g.slug === 'nand' ? '1' : '0';
			expect(same(w.source.replace('c', neutral), g.source), g.name).toBe(true);
		}
	});

	test('the chained and built-from-two readings are what the page says', () => {
		for (const g of gates) {
			if (!g.wide) continue;
			const w = g.wide;
			expect(same(w.chained.expression, w.chained.equals), `${g.name} chain`).toBe(true);
			expect(same(w.fromTwo, w.source), `${g.name} from two`).toBe(true);
		}
		// AND, OR and XOR are associative, so a chain is the wide gate.
		for (const slug of ['and', 'or', 'xor']) {
			const w = wideOf(slug);
			expect(same(w.chained.expression, w.source), slug).toBe(true);
		}
		// NAND, NOR and XNOR are not: the chain is a different function.
		for (const slug of ['nand', 'nor', 'xnor']) {
			const w = wideOf(slug);
			expect(same(w.chained.expression, w.source), slug).toBe(false);
		}
		// The inversions cancel: a XNOR b XNOR c is odd parity, the same as XOR.
		expect(same(wideOf('xnor').chained.expression, 'a ^ b ^ c')).toBe(true);
		expect(same(wideOf('xnor').chained.expression, wideOf('xor').source)).toBe(true);
		// A 3-input XNOR is the inverse of a 3-input XOR, and 1 on the all-zero row.
		expect(same(wideOf('xnor').source, `!(${wideOf('xor').source})`)).toBe(true);
		expect(rows(wideOf('xnor').source, ABC)[0]).toBe(true);
		// A 3-input NAND or NOR is the inverse of the 3-input AND or OR.
		expect(same(wideOf('nand').source, `!(${wideOf('and').source})`)).toBe(true);
		expect(same(wideOf('nor').source, `!(${wideOf('or').source})`)).toBe(true);
	});

	test('the alternative 3-input readings differ where the page says', () => {
		const xor = wideOf('xor');
		const oneHot = rows(need(xor.alternative, 'one-hot XOR').expression, ABC);
		oneHot.forEach((value, row) => expect(value, `row ${row}`).toBe(ones(row) === 1));
		// Exactly one and odd parity only disagree when all three are 1.
		expect(differ(rows(xor.source, ABC), oneHot)).toEqual([7]);

		const xnor = wideOf('xnor');
		const allEqual = rows(need(xnor.alternative, 'all-equal XNOR').expression, ABC);
		// "1 only for 000 and 111".
		expect(allEqual.flatMap((v, i) => (v ? [i] : []))).toEqual([0, 7]);
		// Identity for two inputs is XNOR.
		expect(same('(a & b) | (!a & !b)', gate('xnor').source)).toBe(true);
		expect(differ(rows(xnor.source, ABC), allEqual)).toEqual([3, 5, 6, 7]);
	});

	test('each contrast lists exactly the rows where the two gates differ', () => {
		for (const g of gates) {
			expect(g.contrasts.length, g.name).toBeGreaterThanOrEqual(1);
			for (const c of g.contrasts) {
				const actual = differ(rows(g.source, ['a', 'b']), rows(gate(c.slug).source, ['a', 'b']));
				expect(actual, `${g.name} vs ${c.slug}`).toEqual(c.differ);
				// Every row the note names is one of those rows.
				for (const named of c.note.match(/\b[01]{2}\b/g) ?? []) {
					expect(c.differ, `${g.name} vs ${c.slug} names ${named}`).toContain(parseInt(named, 2));
				}
				if (c.differ.length === 4) expect(c.note, g.name).toMatch(/exact opposite/);
			}
		}
		// The ones the brief calls out by name.
		expect(gate('xor').contrasts.find((c) => c.slug === 'or')?.differ).toEqual([3]);
		expect(gate('or').contrasts.find((c) => c.slug === 'xor')?.differ).toEqual([3]);
		// Tying a NAND's or a NOR's inputs together gives NOT, as the NOT page says.
		expect(same('!(a & a)', '!a')).toBe(true);
		expect(same('!(a | a)', '!a')).toBe(true);
	});

	test('each symbol note and symbol FAQ names the IEC label the page draws', () => {
		for (const g of gates) {
			const shape = shapes[g.slug];
			expect(g.symbolNote, g.name).toContain(shape.iec);
			if (shape.bubble) expect(g.symbolNote, g.name).toMatch(/bubble/);
			const faq = g.faqs.find((f) => /symbol/.test(f.q));
			expect(need(faq, `${g.name} symbol FAQ`).a, g.name).toContain(shape.iec);
		}
	});

	test('the written XOR truth table matches the engine', () => {
		const faq = need(
			gate('xor').faqs.find((f) => /truth table/.test(f.q)),
			'XOR truth table FAQ'
		);
		const written = [...faq.a.matchAll(/([01]) XOR ([01]) = ([01])/g)];
		expect(written).toHaveLength(4);
		const table = rows(gate('xor').source, ['a', 'b']);
		for (const [, a, b, q] of written) expect(table[parseInt(a + b, 2)] ? '1' : '0').toBe(q);
	});
});

test.describe('gate pages', () => {
	for (const g of gates) {
		test(`the ${g.name} page carries every section`, async ({ page }) => {
			await page.goto(`/logic-gates/${g.slug}`);
			const h2 = page.locator('h2');
			await expect(h2.filter({ hasText: new RegExp(`^${g.name} gate truth table$`) })).toHaveCount(1);

			const symbol = page.locator('section', { has: page.locator('h2', { hasText: `${g.name} gate symbol` }) });
			await expect(symbol.locator('svg')).toHaveCount(2);
			await expect(symbol.locator('a[href="/logic-gate-symbols"]')).toHaveCount(1);

			const wide = page.locator('section', { has: page.locator('h2', { hasText: `3-input ${g.name} gate` }) });
			if (g.wide) {
				await expect(wide.locator('tbody tr')).toHaveCount(8);
				const q = await wide.locator('tbody td.out').allTextContents();
				expect(q.map((t) => t.trim() === '1')).toEqual(rows(g.wide.source, ABC));
			} else {
				await expect(wide).toHaveCount(0);
			}

			const compare = page.locator('section', {
				has: page.locator('h2', { hasText: `${g.name} compared with the other gates` })
			});
			await expect(compare.locator('tbody tr')).toHaveCount(4);
			await expect(compare.locator('thead th.current')).toHaveText(g.slug === 'not' ? 'NOT a' : g.name);
			const current = await compare.locator('tbody td.current').allTextContents();
			expect(current.map((t) => t.trim() === '1')).toEqual(rows(g.source, ['a', 'b']));

			await expect(page.locator('h2', { hasText: `${g.name} gate examples` })).toHaveCount(1);

			// The FAQ on the page and the FAQPage questions are the same list.
			await expect(page.locator('.faq details')).toHaveCount(g.faqs.length);
			const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
			const ld = blocks
				.map((text) => JSON.parse(text))
				.find((block) => block['@graph']?.some((n: { '@id'?: string }) => n['@id']?.endsWith(`/${g.slug}#webpage`)));
			const webPage = ld['@graph'].find((n: { '@id'?: string }) => n['@id']?.endsWith('#webpage'));
			expect(webPage.mainEntity).toHaveLength(g.faqs.length);
			expect(webPage.mainEntity.map((q: { name: string }) => q.name)).toEqual(g.faqs.map((f) => f.q));
			expect(webPage.about['@type']).toBe('DefinedTerm');
			const image = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'ImageObject');
			expect(webPage.primaryImageOfPage['@id']).toBe(image['@id']);
			expect(image.contentUrl).toMatch(new RegExp(`/img/${g.slug}-gate-truth-table\\.png$`));
		});
	}

	test('no gate page scrolls sideways on a phone', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		for (const g of gates) {
			await page.goto(`/logic-gates/${g.slug}`);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
			expect(overflow, g.name).toBeLessThanOrEqual(0);
		}
	});
});
