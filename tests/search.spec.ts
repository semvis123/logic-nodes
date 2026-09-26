// The Ctrl+K palette: its list must cover every page and point only at real
// ones, the obvious query must come first, and it must work from the keyboard.

import { expect, test } from '@playwright/test';
import { sitemapPaths } from './sitemap.js';
import { search } from '../src/lib/search.js';
import type { SearchEntry } from '../src/lib/searchIndex.js';

async function index(request: import('@playwright/test').APIRequestContext): Promise<SearchEntry[]> {
	const response = await request.get('/search.json');
	expect(response.ok()).toBe(true);
	return response.json();
}

test('the search list covers every page, and every entry leads somewhere real', async ({ request }) => {
	const entries = await index(request);
	const paths = await sitemapPaths(request);
	const listed = new Set(entries.map((entry) => entry.href.split('#')[0]));
	expect(
		paths.filter((path) => !listed.has(path)),
		'pages the palette cannot find'
	).toEqual([]);
	expect(
		[...listed].filter((path) => !paths.includes(path)),
		'entries for pages that do not exist'
	).toEqual([]);
	expect(new Set(entries.map((entry) => entry.href)).size, 'duplicate entries').toBe(entries.length);

	// Glossary entries jump to an anchor, which has to be on the page.
	const glossary = await (await request.get('/glossary')).text();
	const missing = entries
		.filter((entry) => entry.href.startsWith('/glossary#'))
		.map((entry) => entry.href.slice('/glossary#'.length))
		.filter((id) => !glossary.includes(`id="${id}"`));
	expect(missing, 'glossary anchors that do not exist').toEqual([]);
});

test('the obvious result comes first', async ({ request }) => {
	const entries = await index(request);
	const top = (query: string) => search(entries, query)[0]?.href;
	expect(top('karnaugh')).toBe('/karnaugh-map-solver');
	expect(top('kmap')).toBe('/karnaugh-map-solver');
	expect(top('truth table')).toBe('/truth-table-generator');
	expect(top('xor')).toBe('/logic-gates/xor');
	expect(top('b64')).toBe('/base64');
	expect(top('de morgan')).toBe('/de-morgans-laws');
	expect(top('hex to dec')).toBe('/hex-to-decimal');
	expect(top('full adder')).toBe('/common-circuits/full-adder');
	expect(top('floating point')).toBe('/ieee-754-converter');
	expect(top('modus ponens')).toBe('/logic/rules-of-inference');
	expect(top('Karnaugh MAP')).toBe('/karnaugh-map-solver');
	expect(search(entries, 'zzzz')).toEqual([]);
	// With nothing typed, it offers the tools.
	expect(search(entries, '').every((entry) => entry.kind === 'Tool')).toBe(true);
});

test('the palette opens from the keyboard and goes where you pick', async ({ page }) => {
	await page.goto('/tools');
	await page.waitForLoadState('networkidle');
	const dialog = page.locator('dialog.palette');
	await expect(dialog).toBeHidden();

	await page.keyboard.press('Control+k');
	await expect(dialog).toBeVisible();
	const input = dialog.getByRole('combobox');
	await expect(input).toBeFocused();
	await input.fill('karnaugh');
	await expect(dialog.getByRole('option').first()).toContainText('Karnaugh map solver');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/karnaugh-map-solver$/);
	await expect(dialog).toBeHidden();

	// "/" opens it too, the arrows move the selection, and Escape closes it.
	await page.locator('h1').click();
	await page.keyboard.press('/');
	await expect(dialog).toBeVisible();
	await input.fill('gate');
	const options = dialog.getByRole('option');
	await expect(options.first()).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowDown');
	await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	// The button in the bar opens it, and a click on a result follows it.
	await page.getByRole('button', { name: /Search the site/ }).click();
	await input.fill('glossary');
	await dialog
		.getByRole('option', { name: /Glossary/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/glossary$/);
});

test('typing "/" into a tool does not open the palette', async ({ page }) => {
	await page.goto('/truth-table-generator');
	await page.waitForLoadState('networkidle');
	const field = page.locator('main input[type="text"], main textarea').first();
	await field.click();
	await page.keyboard.type('a/b');
	await expect(page.locator('dialog.palette')).toBeHidden();
});

test('the results are not part of the page until it is opened', async ({ request }) => {
	const html = await (await request.get('/')).text();
	expect(html).not.toContain('palette-option');
	expect(html).not.toContain('search.json');
});
