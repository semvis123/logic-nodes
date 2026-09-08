import { test, expect } from '@playwright/test';

test('printing a worksheet hides the chrome and shows the questions', async ({ page }) => {
	await page.goto('/worksheet?seed=99&n=6&topic=mixed');
	await page.emulateMedia({ media: 'print' });

	// Site navigation, controls and the footer are for the screen only.
	for (const selector of ['nav', '.no-print', 'footer']) {
		const nodes = page.locator(selector);
		for (let i = 0; i < (await nodes.count()); i++)
			await expect(nodes.nth(i), `${selector} #${i} should be hidden in print`).toBeHidden();
	}

	// The sheet itself survives, in ink-friendly colours.
	await expect(page.locator('.question')).toHaveCount(6);
	const colour = await page
		.locator('.question')
		.first()
		.evaluate((el) => getComputedStyle(el).color);
	expect(colour, 'question text should be dark for paper').toMatch(
		/rgb\((\d+), \1, \1\)|rgb\(0, 0, 0\)|rgb\([0-5]?\d, /
	);
});

test('a content page prints without the interactive chrome', async ({ page }) => {
	await page.goto('/learn');
	await page.emulateMedia({ media: 'print' });
	await expect(page.locator('nav').first()).toBeHidden();
	await expect(page.locator('h1')).toBeVisible();
	// Collapsed sections must be open on paper, or the print loses content.
	// emulateMedia does not fire beforeprint, so raise it the way printing does.
	await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
	const details = page.locator('details');
	expect(await details.count()).toBeGreaterThan(0);
	for (let i = 0; i < (await details.count()); i++) {
		await expect(details.nth(i)).toHaveAttribute('open', '');
		await expect(details.nth(i).locator('p').first()).toBeVisible();
	}
});
