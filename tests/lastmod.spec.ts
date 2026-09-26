// The sitemap's <lastmod> and every page's dateModified come from
// src/lib/lastmod.json. The build refreshes it from git, but a host that
// builds from a shallow clone keeps the committed copy, so a page added
// without regenerating and committing it ships with no date at all. This
// catches that before it reaches the live sitemap: run `npm run lastmod`
// and commit the result.

import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROUTES = 'src/routes';

function pages(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? pages(full) : entry === '+page.svelte' ? [full] : [];
	});
}

test('every page has a date in the committed lastmod.json', () => {
	const dates = JSON.parse(readFileSync('src/lib/lastmod.json', 'utf8')) as Record<string, string>;
	const missing = pages(ROUTES)
		.map((file) => '/' + relative(ROUTES, file).replace(/\/?\+page\.svelte$/, ''))
		.map((route) => (route === '/' ? '/' : route))
		.filter((route) => !dates[route]);
	expect(missing, `no date for ${missing.join(', ')}: run npm run lastmod and commit it`).toEqual([]);
	for (const date of Object.values(dates)) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
