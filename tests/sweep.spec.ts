import { test, expect } from '@playwright/test';

const paths: string[] = [];

test.beforeAll(async ({ request }) => {
	const xml = await (await request.get('/sitemap.xml')).text();
	for (const m of xml.matchAll(/<loc>https:\/\/nodes\.kriyak\.com(.*?)<\/loc>/g)) paths.push(m[1] || '/');
});

test('every page is legible and fits at 1280 and 390', async ({ page, request }) => {
	const xml = await (await request.get('/sitemap.xml')).text();
	const all = [...xml.matchAll(/<loc>https:\/\/nodes\.kriyak\.com(.*?)<\/loc>/g)].map((m) => m[1] || '/');
	const problems: string[] = [];

	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 900 });
		for (const path of all) {
			if (path === '/simulator') continue; // a full-bleed canvas app, not a content page
			await page.goto(path);
			const found = await page.evaluate((w) => {
				const out: string[] = [];

				// Composite a colour over its ancestors so alpha is not read as opaque.
				const rgba = (s: string) => {
					const n = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
					return { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 };
				};
				const over = (fg: any, bg: any) => ({
					r: fg.r * fg.a + bg.r * (1 - fg.a),
					g: fg.g * fg.a + bg.g * (1 - fg.a),
					b: fg.b * fg.a + bg.b * (1 - fg.a),
					a: 1
				});
				const bgOf = (el: Element | null): any => {
					let c = { r: 29, g: 30, b: 32, a: 1 };
					const chain: Element[] = [];
					for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
					for (const e of chain) {
						const b = rgba(getComputedStyle(e).backgroundColor);
						if (b.a > 0) c = over(b, c);
					}
					return c;
				};
				const lum = (c: any) => {
					const f = (v: number) => {
						v /= 255;
						return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
					};
					return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
				};
				const ratio = (a: any, b: any) => {
					const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
					return (x + 0.05) / (y + 0.05);
				};

				for (const el of Array.from(document.querySelectorAll('body *'))) {
					const style = getComputedStyle(el);
					if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
					// Only judge elements that hold text of their own.
					const own = Array.from(el.childNodes)
						.filter((n) => n.nodeType === 3)
						.map((n) => n.textContent?.trim())
						.join('');
					if (!own) continue;
					const bg = bgOf(el.parentElement);
					const fg = over(rgba(style.color), bgOf(el));
					const size = parseFloat(style.fontSize);
					const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight) >= 700);
					const r = ratio(fg, bgOf(el));
					if (r < (large ? 3 : 4.5))
						out.push(`contrast ${r.toFixed(2)} on <${el.tagName.toLowerCase()}> "${own.slice(0, 40)}"`);
				}

				// Nothing may spill past the viewport.
				if (document.documentElement.scrollWidth > w + 1)
					out.push(`horizontal overflow: ${document.documentElement.scrollWidth}px > ${w}px`);
				return out;
			}, width);
			for (const f of found) problems.push(`${width}px ${path}: ${f}`);
		}
	}
	expect(problems, problems.join('\n')).toEqual([]);
});
