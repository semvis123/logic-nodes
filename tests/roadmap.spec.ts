// The roadmap is the map of the whole site, so it is only useful while every
// link on it still lands, and while every page still has a place on it.

import { expect, test } from '@playwright/test';
import { stages } from '../src/lib/roadmap.js';
import { sitemapPaths } from './sitemap.js';

const path = (href: string) => href.split(/[#?]/)[0];

test('every link on the roadmap lands on a real page and a real anchor', async ({ request }) => {
	const problems: string[] = [];
	const html = new Map<string, string>();

	for (const stage of stages) {
		for (const link of stage.pages) {
			const target = path(link.href);
			if (!html.has(target)) {
				const response = await request.get(target);
				if (response.status() !== 200) {
					problems.push(`${stage.id}: ${link.href} returns ${response.status()}`);
					continue;
				}
				html.set(target, await response.text());
			}
			// A fragment must name an id on that page, or the link silently lands
			// at the top. The simulator's #example: fragments are handled by the
			// editor itself, not by an element id.
			const fragment = link.href.split('#')[1];
			if (fragment && !fragment.startsWith('example:') && !html.get(target)?.includes(`id="${fragment}"`))
				problems.push(`${stage.id}: ${link.href} has no id="${fragment}" to land on`);
		}
	}
	expect(problems, problems.join('\n')).toEqual([]);
});

test('no page has been left off the roadmap', async ({ request }) => {
	const onRoadmap = new Set(stages.flatMap((stage) => stage.pages.map((link) => path(link.href))));
	// The homepage and the roadmap itself are not stops on the path. Detail
	// pages count as covered by their hub, except the gates and flip-flops,
	// which the roadmap lists one by one on purpose.
	const missing = (await sitemapPaths(request))
		.filter((p) => p !== '/' && p !== '/roadmap')
		.filter((p) => p.split('/').length === 2 || p.startsWith('/logic-gates/') || p.startsWith('/flip-flops/'))
		.filter((p) => !onRoadmap.has(p));
	expect(missing, `pages with no place on the roadmap: ${missing.join(', ')}`).toEqual([]);
});

test('the stages are in order, and nothing on the path points backwards', () => {
	const ids = stages.map((stage) => stage.id);
	expect(new Set(ids).size, 'stage ids must be unique').toBe(ids.length);

	// The stages go from combinational ideas to memory to counting, in that
	// order, and each of the load-bearing pages is introduced in the stage
	// that the idea belongs to. The tools and reference pages recur, so only
	// the first stage that names a page counts as introducing it.
	expect(ids).toEqual(['bits', 'gates', 'algebra', 'smaller', 'build', 'memory', 'sequential', 'practice']);
	const first = new Map<string, string>();
	for (const stage of stages)
		for (const link of stage.pages) if (!first.has(path(link.href))) first.set(path(link.href), stage.id);
	expect(first.get('/binary-converter')).toBe('bits');
	expect(first.get('/logic-gates')).toBe('gates');
	expect(first.get('/boolean-algebra-laws')).toBe('algebra');
	expect(first.get('/karnaugh-map-solver')).toBe('smaller');
	expect(first.get('/ripple-carry-adder')).toBe('build');
	expect(first.get('/sr-latch')).toBe('memory');
	expect(first.get('/flip-flops')).toBe('memory');
	expect(first.get('/counters')).toBe('sequential');
	expect(first.get('/finite-state-machines')).toBe('sequential');
	expect(first.get('/worksheet')).toBe('practice');
});

test('the roadmap page renders every stage with its pages', async ({ page }) => {
	await page.goto('/roadmap');
	await expect(page.locator('h1')).toHaveText('Digital logic roadmap');
	await expect(page.locator('section.stage')).toHaveCount(stages.length);
	for (const [i, stage] of stages.entries()) {
		const section = page.locator(`section#${stage.id}`);
		await expect(section.locator('h2')).toContainText(stage.title);
		await expect(section.locator('.pages li')).toHaveCount(stage.pages.length);
		await expect(section.locator('.checkpoint')).toContainText(stage.checkpoint);
		// The table of contents links each stage in the same order.
		await expect(page.locator('.toc li').nth(i).locator('a')).toHaveAttribute('href', `#${stage.id}`);
	}
	// The structured data lists the same stages in the same order.
	const ld = await page.locator('script[type="application/ld+json"]').textContent();
	const graph = JSON.parse(ld ?? '{}')['@graph'] as { '@type': string; itemListElement?: { name: string }[] }[];
	const list = graph.find((node) => node['@type'] === 'ItemList');
	expect(list?.itemListElement?.map((item) => item.name)).toEqual(stages.map((stage) => stage.title));
});
