// The Ctrl+K palette: its list must cover every page and point only at real
// ones, the obvious query must come first, and it must work from the keyboard.

import { expect, test } from '@playwright/test';
import { sitemapPaths } from './sitemap.js';
import { search, within } from '../src/lib/search.js';
import { answers } from '../src/lib/paletteAnswers.js';
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
	// Two tools scoring the same go by where the word sits in their keywords.
	expect(top('cidr')).toBe('/subnet-calculator');
	expect(top('ipv4')).toBe('/subnet-calculator');
	expect(top('ip address')).toBe('/subnet-calculator');
	expect(top('mask')).toBe('/subnet-calculator');
	expect(top('alignment')).toBe('/struct-padding-calculator');
	expect(top('ulid')).toBe('/uuid-decoder');
	// The integer types answer to their names in other languages and their limits.
	expect(top('u64')).toBe('/integer-limits/uint64');
	expect(top('u32')).toBe('/integer-limits/uint32');
	expect(top('INT32_MAX')).toBe('/integer-limits/int32');
	expect(top('max int')).toBe('/integer-limits/int32');
	expect(top('sbyte')).toBe('/integer-limits/int8');
	expect(search(entries, '2147483647').map((e) => e.href)).toContain('/integer-limits/int32');
	expect(top('mantissa')).toBe('/ieee-754-converter');
	expect(search(entries, 'significand').map((e) => e.href)).toContain('/fp16-bf16-fp8-converter');
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

test('misspelt words still find the page', async ({ request }) => {
	const entries = await index(request);
	const top = (query: string) => search(entries, query)[0]?.href;
	expect(top('karnough')).toBe('/karnaugh-map-solver');
	expect(top('multiplxer')).toBe('/common-circuits/multiplexer');
	expect(top('venn diagarm')).toBe('/venn-diagram-generator');
	expect(top('tautolgy')).toBe('/logic/tautology');
	expect(top('sr lacth')).toBe('/sr-latch');
	expect(top('boolen algebra')).toBe('/boolean-algebra-calculator');
	expect(within('diagarm', 'diagram', 1)).toBe(true);
	expect(within('gate', 'gates', 1)).toBe(true);
	expect(within('and', 'xor', 1)).toBe(false);
});

test('instant answers are right, and plain words stay searches', () => {
	const first = (query: string) => answers(query)[0];
	expect(first('42')?.title).toBe('42 = 0010 1010');
	expect(answers('42')[1]?.title).toBe("42 is '*' in ASCII");
	expect(first('1011')?.title).toBe('1011 = 11');
	expect(first('0x1F')?.title).toBe('0x1F = 31');
	expect(first('0b101')?.title).toBe('0101 = 5');
	expect(first('101 + 11')?.title).toBe('101 + 11 = 1000');
	expect(first('1100 / 11')?.title).toBe('1100 ÷ 11 = 100');
	expect(first('0xFF + 1')?.title).toBe('0xFF + 0x1 = 0x100');
	expect(first('0.1')?.title).toBe('0.1 → 0x3DCCCCCD');
	expect(first('1e-3')?.href).toContain('/ieee-754-converter');
	expect(first('SGVsbG8=')?.title).toBe('"Hello"');
	expect(first('"A"')?.title).toBe("'A' = 65");
	expect(first('ab + a!b')?.title).toBe('= a');
	expect(first('a & !a')?.title).toBe('Always 0');
	expect(first('p v ~p')?.title).toBe('Tautology');
	expect(first('p -> q')?.title).toBe('Contingency');
	expect(first('p -> q, q therefore p')?.title).toBe('Invalid argument');
	expect(first('p -> q, p therefore q')?.title).toBe('Valid argument');
	expect(first('192.168.1.10/24')?.title).toBe('192.168.1.0/24 · 254 hosts');
	expect(first('10.0.0.1 255.255.0.0')?.title).toBe('10.0.0.0/16 · 65,534 hosts');
	expect(first('255.255.255.0')?.title).toBe('255.255.255.0 = /24');
	expect(first('2001:0db8:0000:0000:0000:0000:0000:0001')?.title).toBe('2001:db8::1');
	expect(first('550e8400-e29b-41d4-a716-446655440000')?.title).toBe('UUID version 4');
	expect(first('01ARZ3NDEKTSV4RRFFQ69G5FAV')?.hint).toBe('Made 2016-07-30T23:54:10.259Z');
	expect(first('175928847299117063')?.title).toBe('Discord ID → 2016-04-30T11:18:25.796Z');
	expect(first('4006381333931')?.title).toBe('A valid EAN-13');
	expect(answers('4006381333932').map((a) => a.hint)).toContain('The check digit should be 1');
	expect(first('2147483647')?.title).toBe('2147483647 = int32 max');
	expect(first('-128')?.title).toBe('−128 = int8 min');
	expect(answers('127').map((a) => a.title)).toContain('127 = int8 max');
	for (const words of [
		'karnaugh',
		'full adder',
		'not gate',
		'sum of products',
		'beef',
		'add',
		'de morgan',
		'c++',
		'Karnaugh',
		'flip-flops',
		'bf16',
		'2fa',
		'b64',
		'192.168.1.10',
		'a:b'
	]) {
		expect(answers(words), words).toEqual([]);
	}
});

test('an answer opens its tool with the value already filled in', async ({ page }) => {
	const cases: [string, RegExp, string][] = [
		['ab + a!b', /\/boolean-algebra-calculator\?expr=/, 'ab + a!b'],
		['0x1F', /\/hex-to-decimal\?v=1F/, '1F'],
		['42', /\/binary-converter\?value=42/, '42'],
		['101 + 11', /\/binary-calculator\?/, '101'],
		['p -> q', /\/propositional-logic-truth-table\?s=/, 'p -> q'],
		['SGVsbG8=', /\/base64\?m=decode/, 'SGVsbG8='],
		['10.0.0.1/8', /\/subnet-calculator\?ip=/, '10.0.0.1/8'],
		['fe80::1', /\/ipv6-expand-compress\?a=/, 'fe80::1'],
		['01ARZ3NDEKTSV4RRFFQ69G5FAV', /\/uuid-decoder\?id=/, '01ARZ3NDEKTSV4RRFFQ69G5FAV'],
		['1000000000000000000', /\/snowflake-id-decoder\?id=/, '1000000000000000000'],
		['4006381333931', /\/ean-13-barcode-generator\?v=/, '4006381333931']
	];
	await page.goto('/tools');
	await page.waitForLoadState('networkidle');
	for (const [query, url, value] of cases) {
		await page.keyboard.press('Control+k');
		const dialog = page.locator('dialog.palette');
		await dialog.getByRole('combobox').fill(query);
		await expect(dialog.locator('li.answer').first()).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(page, query).toHaveURL(url);
		await page.waitForLoadState('networkidle');
		const fields = page.locator('main input[type="text"], main textarea');
		const values = await fields.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
		expect(
			values.some((v) => v.includes(value)),
			`${query}: ${values.join(' | ')}`
		).toBe(true);
	}
});

test('recent pages come first, and every row has an icon', async ({ page }) => {
	await page.goto('/karnaugh-map-solver');
	await page.waitForLoadState('networkidle');
	await page.goto('/sr-latch');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('Control+k');
	const dialog = page.locator('dialog.palette');
	await expect(dialog.locator('.section').first()).toHaveText('Recent');
	// The page you are on is not offered back to you.
	const first = dialog.getByRole('option').first();
	await expect(first).toContainText('Karnaugh map solver');
	await expect(dialog.getByRole('option').filter({ hasText: /^SR latch/ })).toHaveCount(0);
	const icons = await dialog
		.getByRole('option')
		.evaluateAll((options) => options.map((o) => o.querySelector('svg.tool-icon')?.innerHTML.trim().length ?? 0));
	expect(icons.length).toBeGreaterThan(10);
	expect(icons.filter((n) => n === 0)).toEqual([]);
});

test('closing with Escape and reopening straight away works', async ({ page }) => {
	await page.goto('/tools');
	await page.waitForLoadState('networkidle');
	const dialog = page.locator('dialog.palette');
	for (let i = 0; i < 3; i++) {
		await page.keyboard.press('Control+k');
		await expect(dialog.getByRole('option').first()).toBeVisible();
		await page.keyboard.press('Escape');
	}
	await page.keyboard.press('Control+k');
	await page.waitForTimeout(100);
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('option').first()).toBeVisible();
});
