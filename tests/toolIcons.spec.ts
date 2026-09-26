// The homepage and the tools page put a small icon beside each tool's name.
// The icons are decoration: each link must still be named by the tool's name
// alone, so neither screen readers nor search engines read anything extra.

import { expect, test } from '@playwright/test';
import { tools } from '../src/lib/tools.js';
import { toolIcons } from '../src/lib/toolIcons.js';

test('every tool has an icon, and every icon belongs to a tool', () => {
	expect(Object.keys(toolIcons).sort()).toEqual(tools.map((tool) => tool.href).sort());
});

for (const path of ['/', '/tools']) {
	test(`the icons on ${path} stay out of the link names`, async ({ page }) => {
		await page.goto(path);
		for (const tool of tools) {
			const link = page.locator(`main a[href="${tool.href}"]:has(svg.tool-icon)`);
			await expect(link, tool.href).toHaveCount(1);
			await expect(link.locator('svg')).toHaveAttribute('aria-hidden', 'true');
			await expect(link.locator('svg text')).toHaveCount(0);
			// The name the link is announced by starts with the tool's name,
			// with nothing from the icon in front of it.
			const named = page
				.getByRole('link', { name: new RegExp(`^${tool.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
				.filter({ has: page.locator('svg.tool-icon') });
			await expect(named, tool.href).toHaveCount(1);
			const text = path === '/' ? link : link.locator('h3');
			expect((await text.innerText()).trim(), tool.href).toBe(tool.name);
		}
	});
}
