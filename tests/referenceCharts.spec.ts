// The printable reference charts written by scripts/reference-charts.ts: each
// file must exist at the size its manifest records, carry its own specific alt
// text, be shown on its page with that alt text, and be listed in the sitemap
// under that page so image search can associate the two.

import { expect, test } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

type Chart = { file: string; title: string; alt: string; url: string; width: number; height: number };

const charts: Chart[] = JSON.parse(readFileSync('src/lib/referenceCharts.json', 'utf8'));
const pathOf = (chart: Chart) => chart.url.replace('logicgates.org', '').split('#')[0];

const decode = (s: string) =>
	s.replace(
		/&quot;|&#34;|&amp;|&#39;|&apos;|&lt;|&gt;/g,
		(e) => ({ '&quot;': '"', '&#34;': '"', '&amp;': '&', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>' }[e]!)
	);

test('the manifest lists all twenty charts: one per reference page, and the chips and CMOS circuits of the gates', () => {
	expect(charts).toHaveLength(20);
	expect(new Set(charts.map((c) => c.file)).size).toBe(charts.length);
	const gatePages = charts.filter((c) => pathOf(c).startsWith('/logic-gates/'));
	const others = charts.filter((c) => !gatePages.includes(c));
	expect(new Set(others.map(pathOf)).size).toBe(11);
	// A pinout for every gate but XNOR, whose pinout is not published, and a
	// transistor circuit for the three single-stage gates.
	expect(gatePages.filter((c) => c.file.endsWith('-chip-pinout.png'))).toHaveLength(6);
	expect(gatePages.filter((c) => c.file.endsWith('-cmos-transistor-circuit.png'))).toHaveLength(3);
});

test('every chart file exists as a PNG of the recorded size', () => {
	for (const chart of charts) {
		const path = `static/img/${chart.file}`;
		expect(existsSync(path), `${path} is missing; run "npm run charts"`).toBe(true);
		const bytes = readFileSync(path);
		expect(bytes.subarray(1, 4).toString('ascii'), `${chart.file} is not a PNG`).toBe('PNG');
		expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
		expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, chart.file).toEqual({
			width: chart.width,
			height: chart.height
		});
		expect(bytes.length, `${chart.file} is over 400 KB`).toBeLessThan(400 * 1024);
	}
});

test('every chart has specific, unique alt text and a title', () => {
	for (const chart of charts) {
		expect(chart.title.length, chart.file).toBeGreaterThan(8);
		expect(chart.alt.length, `${chart.file}: alt text too short to describe the chart`).toBeGreaterThan(80);
		expect(chart.alt.length, `${chart.file}: alt text too long`).toBeLessThan(400);
		expect(chart.alt.toLowerCase(), `${chart.file}: alt text should say what the chart is`).toContain(
			chart.title
				.toLowerCase()
				.replace(/ chart$/, '')
				.split(' ')[0]
		);
	}
	expect(new Set(charts.map((c) => c.alt)).size).toBe(charts.length);
});

test('every chart is shown on its page with its alt text and size', async ({ request }) => {
	for (const chart of charts) {
		const html = await (await request.get(pathOf(chart))).text();
		const tag = html.match(new RegExp(`<img[^>]*src="/img/${chart.file.replace('.', '\\.')}"[^>]*>`))?.[0];
		expect(tag, `${pathOf(chart)} does not show ${chart.file}`).toBeTruthy();
		const attr = (name: string) => decode(tag!.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '');
		expect(attr('alt'), chart.file).toBe(chart.alt);
		expect(attr('width'), chart.file).toBe(String(chart.width));
		expect(attr('height'), chart.file).toBe(String(chart.height));
		expect(html, `${chart.file} should be downloadable`).toContain(`href="/img/${chart.file}" download`);
		const image = await request.get(`/img/${chart.file}`);
		expect(image.status(), chart.file).toBe(200);
	}
});

test('every chart is in the sitemap under its page', async ({ request }) => {
	const xml = await (await request.get('/sitemap.xml')).text();
	for (const chart of charts) {
		const block = (xml.match(/<url>[\s\S]*?<\/url>/g) ?? []).find((b) =>
			new RegExp(`<loc>[^<]*?logicgates\\.org${pathOf(chart)}</loc>`).test(b)
		);
		expect(block, `${pathOf(chart)} is not in the sitemap`).toBeTruthy();
		expect(block, `${chart.file} is not listed under ${pathOf(chart)}`).toContain(`/img/${chart.file}</image:loc>`);
		expect(block).toContain(`<image:title>${chart.title}</image:title>`);
	}
});

test('the charts fit a phone screen without scrolling sideways', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	for (const chart of charts) {
		await page.goto(pathOf(chart));
		const img = page.locator(`img[src="/img/${chart.file}"]`);
		await img.scrollIntoViewIfNeeded();
		const box = await img.boundingBox();
		expect(box!.width, chart.file).toBeLessThanOrEqual(390);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(overflow, `${pathOf(chart)} scrolls sideways`).toBeLessThanOrEqual(0);
	}
});
