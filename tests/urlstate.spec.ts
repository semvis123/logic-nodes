import { test, expect } from '@playwright/test';

// Every tool must survive the round trip: change something, copy the address,
// reopen it, and get the same state back.
const tools: { path: string; change: string; value: string }[] = [
	{ path: '/truth-table-generator', change: '#expression', value: 'a ^ b ^ c' },
	{ path: '/boolean-algebra-calculator', change: '#expression', value: '!(a | b) & c' },
	{ path: '/karnaugh-map-solver', change: '#expression', value: 'a & b | c' },
	{ path: '/sum-of-products-calculator', change: '#expression', value: 'a ^ b' },
	{ path: '/nand-nor-converter', change: '#expression', value: 'a & (b | c)' },
	{ path: '/logic-circuit-generator', change: '#expression', value: '(a ^ b) & c' }
];

for (const tool of tools) {
	test(`${tool.path} round trips through the address bar`, async ({ page }) => {
		await page.goto(tool.path);
		await page.fill(tool.change, tool.value);
		await expect(page).toHaveURL(/\?/);
		const shared = page.url();

		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page.locator(tool.change)).toHaveValue(tool.value);
		// And reopening must not rewrite the link it came from.
		expect(page.url()).toBe(shared);
	});
}

test('the gray code converter round trips', async ({ page }) => {
	await page.goto('/gray-code-converter?value=1011&mode=binary');
	await expect(page.locator('#value')).toHaveValue('1011');
	expect(page.url()).toContain('value=1011');
});

test('a hand drawn karnaugh map travels in the link', async ({ page }) => {
	await page.goto('/karnaugh-map-solver');
	// Click three squares, then reopen the resulting link.
	const squares = page.locator('.kmap td button, .kmap .cell');
	await squares.nth(0).click();
	await squares.nth(1).click();
	await expect(page).toHaveURL(/cells=/);
	const shared = page.url();
	await page.goto('about:blank');
	await page.goto(shared);
	await expect(page.locator('.badge')).toHaveText('Edited by hand');
});

test('a link from one tool to another carries the expression', async ({ page }) => {
	// Calculator -> truth table generator.
	await page.goto('/boolean-algebra-calculator');
	await page.fill('#expression', 'a & !b | c');
	await page.getByRole('link', { name: 'See the full truth table' }).click();
	await expect(page).toHaveURL(/truth-table-generator/);
	await expect(page.locator('#expression')).toHaveValue('a & !b | c');

	// And back the other way.
	await page.fill('#expression', 'a ^ b & c');
	await page.getByRole('link', { name: 'simplify this further' }).click();
	await expect(page).toHaveURL(/boolean-algebra-calculator/);
	await expect(page.locator('#expression')).toHaveValue('a ^ b & c');

	// The circuit generator hands off to all three of its suggestions.
	for (const [name, path] of [
		['boolean algebra calculator', 'boolean-algebra-calculator'],
		['Karnaugh map', 'karnaugh-map-solver'],
		['NAND and NOR converter', 'nand-nor-converter']
	]) {
		await page.goto('/logic-circuit-generator');
		await page.fill('#expression', '(a | b) & !c');
		await page.getByRole('link', { name, exact: true }).click();
		await expect(page).toHaveURL(new RegExp(path));
		await expect(page.locator('#expression')).toHaveValue('(a | b) & !c');
	}
});

test('the circuit generator emits Verilog and VHDL for what is drawn', async ({ page }) => {
	await page.goto('/logic-circuit-generator?expr=(a%20%26%20b)%20%7C%20(!a%20%26%20c)');
	await page.locator('.hdl').evaluate((d: HTMLDetailsElement) => (d.open = true));

	const code = page.locator('.hdl-code');
	await expect(code).toContainText('module');
	await expect(code).toContainText('assign y = (a & b) | (~a & c);');
	// One port per variable, plus the output.
	await expect(code).toContainText('input  wire a,');
	await expect(code).toContainText('output wire y');

	await page.getByRole('button', { name: 'VHDL' }).click();
	await expect(code).toContainText('library ieee;');
	await expect(code).toContainText('y <= (a and b) or (not a and c);');
	await expect(code).toContainText('end architecture;');

	// And it follows the expression rather than being a fixed sample.
	await page.fill('#expression', 'a ^ b');
	await expect(code).toContainText('y <= a xor b;');
});

test('practice keeps its topic in the link', async ({ page }) => {
	await page.goto('/practice?topic=gates');
	await expect(page.locator('.topic.active')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.topic.active')).toHaveCount(1);
	// Switching topic rewrites the link rather than navigating.
	await page.locator('.topic', { hasText: 'Simplifying' }).click();
	await expect(page).toHaveURL(/topic=simplifying/);
});
