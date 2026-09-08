// Smoke tests against the built site. These replace the scaffold test that
// shipped with the SvelteKit template and never matched this project.

import { expect, test } from '@playwright/test';
import { sitemapPaths } from './sitemap.js';

test('the homepage introduces the simulator', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Build logic circuits in your browser');
	await expect(page).toHaveTitle(/Logic Nodes/);
});

test('the old about URL still reaches the homepage', async ({ page }) => {
	await page.goto('/about');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('h1')).toHaveText('Build logic circuits in your browser');
});

test('the simulator loads its canvas and toolbar', async ({ page }) => {
	await page.goto('/simulator');
	await expect(page.locator('canvas')).toBeVisible();
	// There are two toolbars, top and bottom.
	await expect(page.locator('.toolbar')).toHaveCount(2);
	await expect(page.locator('.toolbar').first()).toBeVisible();
});

test('an example link opens that circuit', async ({ page }) => {
	await page.goto('/simulator#example:Calculator');
	await expect(page.locator('.toolbar-text')).toHaveText('Calculator');
});

test('the truth table generator computes as you type', async ({ page }) => {
	await page.goto('/truth-table-generator');
	await page.fill('#expression', 'a & b');
	const rows = page.locator('.result tbody tr');
	await expect(rows).toHaveCount(4);
	// Only the last row of an AND is high.
	await expect(rows.nth(3).locator('td').last()).toHaveText('1');
	await expect(rows.nth(0).locator('td').last()).toHaveText('0');
});

test('tool state travels in the URL', async ({ page }) => {
	await page.goto('/karnaugh-map-solver?expr=a%20%26%20b&notation=engineering');
	// Engineering notation renders AND as juxtaposition.
	await expect(page.locator('.reading')).toContainText('ab');
	await expect(page.locator('#expression')).toHaveValue('a & b');
	// And typing updates the address without a navigation.
	await page.goto('/truth-table-generator');
	await page.fill('#expression', 'a ^ b');
	await expect(page).toHaveURL(/expr=/);
});

test('a worksheet is rebuilt from its number', async ({ page }) => {
	await page.goto('/worksheet?seed=4242&n=5&topic=gates');
	const questions = page.locator('.question');
	await expect(questions).toHaveCount(5);
	const first = await questions.first().locator('.ask').textContent();

	// The same link must give the same sheet, and the key must be off by default.
	await expect(page.locator('.answer')).toHaveCount(0);
	await page.reload();
	await expect(questions.first().locator('.ask')).toHaveText(first ?? '');

	// A guessed key is not a key.
	await page.goto('/worksheet?seed=4242&n=5&topic=gates&key=1');
	await expect(page.locator('.answer')).toHaveCount(0);

	// Ticking the box unlocks it and puts a sheet specific code in the address.
	await page.goto('/worksheet?seed=4242&n=5&topic=gates');
	await page.locator('.check input[type=checkbox]').check();
	await expect(page.locator('.answer')).toHaveCount(5);
	const keyed = page.url();
	expect(keyed, 'the key must not be a flag anyone can guess').not.toContain('key=1');

	// And that link reopens the marked sheet, same questions.
	await page.goto('about:blank');
	await page.goto(keyed);
	await expect(page.locator('.answer')).toHaveCount(5);
	await expect(questions.first().locator('.ask')).toHaveText(first ?? '');

	// The same code does not unlock a different sheet.
	const token = new URL(keyed).searchParams.get('key');
	await page.goto(`/worksheet?seed=777&n=5&topic=gates&key=${token}`);
	await expect(page.locator('.answer')).toHaveCount(0);
});

test('the calculator shows its working, and every law it cites exists', async ({ page, request }) => {
	await page.goto('/boolean-algebra-calculator?expr=a%20%26%20b%20%7C%20!a%20%26%20c%20%7C%20b%20%26%20c');
	const working = page.locator('.working');
	await expect(working).toBeVisible();
	await working.evaluate((d: HTMLDetailsElement) => (d.open = true));

	const steps = page.locator('.steps-list li');
	await expect(steps.first()).toContainText('Start');
	expect(await steps.count(), 'a derivation needs at least one law').toBeGreaterThan(1);

	// Each cited law must link to an anchor that is really on the laws page.
	const laws = await (await request.get('/boolean-algebra-laws')).text();
	const links = page.locator('.steps-list a.step-law');
	for (let i = 0; i < (await links.count()); i++) {
		const href = await links.nth(i).getAttribute('href');
		const anchor = href?.split('#')[1] ?? '';
		expect(laws, `no id="${anchor}" on the laws page for ${await links.nth(i).textContent()}`).toContain(
			`id="${anchor}"`
		);
	}

	// The last line of the working must agree with the answer above it.
	const answer = await page.locator('.result-line.big .out').textContent();
	await expect(steps.last().locator('.step-text')).toHaveText(answer ?? '');
});

test('every page is reachable by keyboard, with no duplicate ids', async ({ page, request }) => {
	const paths = await sitemapPaths(request);
	const problems: string[] = [];

	for (const path of paths) {
		await page.goto(path);
		problems.push(
			...(await page.evaluate((where) => {
				const out: string[] = [];
				const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
				for (const id of new Set(ids))
					if (ids.filter((x) => x === id).length > 1) out.push(`${where}: duplicate id "${id}"`);
				// Exactly one main landmark, and the nav must not be inside it.
				const mains = document.querySelectorAll('main');
				if (where !== '/simulator') {
					if (mains.length !== 1) out.push(`${where}: ${mains.length} main elements`);
					else if (mains[0].querySelector('header.topbar')) out.push(`${where}: the site header is inside main`);
				}
				return out;
			}, path))
		);
	}
	expect(problems, problems.join('\n')).toEqual([]);

	// The skip link is the first thing tabbed to, and it goes to the content.
	await page.goto('/learn');
	await page.keyboard.press('Tab');
	const skip = page.locator('a.skip');
	await expect(skip).toBeFocused();
	await expect(skip).toBeVisible();
	await skip.press('Enter');
	await expect(page).toHaveURL(/#main$/);
});

test('a wrong address gets a useful page, not a bare error', async ({ page }) => {
	const response = await page.goto('/this-page-does-not-exist');
	expect(response?.status()).toBe(404);
	await expect(page.locator('h1')).toHaveText('That page is not here');
	// It must offer a way out, and must never be indexed.
	await expect(page.locator('a[href="/simulator"]').first()).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('every page is well linked and close to the homepage', async ({ request }) => {
	const paths = await sitemapPaths(request);
	const html = new Map<string, string>();
	for (const path of paths) html.set(path, await (await request.get(path)).text());

	const linksOf = (page: string) =>
		[...(html.get(page) ?? '').matchAll(/href="(\/[^"#?]*)/g)]
			.map((m) => m[1].replace(/\/$/, '') || '/')
			.filter((target) => html.has(target) && target !== page);

	// Nothing should be more than two clicks from the homepage.
	const depth = new Map([['/', 0]]);
	let frontier = ['/'];
	while (frontier.length) {
		const next: string[] = [];
		for (const page of frontier)
			for (const target of linksOf(page))
				if (!depth.has(target)) {
					depth.set(target, (depth.get(page) ?? 0) + 1);
					next.push(target);
				}
		frontier = next;
	}
	const deep = paths.filter((p) => (depth.get(p) ?? 99) > 2);
	expect(deep, `more than two clicks from the homepage: ${deep.join(', ')}`).toEqual([]);

	// And each page should be reachable from several places, not just one.
	const inbound = new Map(paths.map((p) => [p, 0]));
	for (const page of paths)
		for (const target of new Set(linksOf(page))) inbound.set(target, (inbound.get(target) ?? 0) + 1);
	const lonely = [...inbound].filter(([page, n]) => page !== '/' && n < 3).map(([page, n]) => `${page} (${n})`);
	expect(lonely, `fewer than three inbound internal links: ${lonely.join(', ')}`).toEqual([]);
});

test('llms.txt lists every page', async ({ request }) => {
	const llms = await (await request.get('/llms.txt')).text();
	const paths = await sitemapPaths(request);

	// Detail pages are covered by their hub entry, so only top level ones count.
	const missing = paths
		.filter((p) => p === '/' || p.split('/').length === 2)
		.filter((p) => !llms.includes(`logicgates.org${p === '/' ? '/)' : `${p})`}`));
	expect(missing, `llms.txt does not mention: ${missing.join(', ')}`).toEqual([]);
});

test('no page is orphaned: everything is linked from somewhere', async ({ request }) => {
	const paths = await sitemapPaths(request);

	// Collect every internal href on the site.
	const linked = new Set<string>();
	for (const path of paths) {
		const html = await (await request.get(path)).text();
		for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
			const target = m[1].replace(/\/$/, '') || '/';
			if (target !== path) linked.add(target);
		}
	}

	const orphans = paths.filter((p) => p !== '/' && !linked.has(p));
	expect(orphans, `these pages are in the sitemap but nothing links to them: ${orphans.join(', ')}`).toEqual([]);
});

test('every page in the sitemap is reachable', async ({ page, request }) => {
	const paths = await sitemapPaths(request);
	expect(paths.length).toBeGreaterThan(20);
	for (const path of paths) {
		const response = await request.get(path);
		expect(response.status(), `${path} returned ${response.status()}`).toBe(200);
	}
});
