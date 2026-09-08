// Shared by the site sweeps. The domain is deliberately not hardcoded here:
// when it changed, every copy of the old pattern quietly matched nothing, and
// the checks that assert "no problems were found" passed over an empty list
// instead of failing. Parsing whatever host the sitemap actually uses, and
// refusing to return an empty list, makes that impossible.

import { expect, type APIRequestContext } from '@playwright/test';

export async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
	const xml = await (await request.get('/sitemap.xml')).text();
	const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1] || '/');
	expect(paths.length, 'the sitemap yielded no URLs, so nothing would be checked').toBeGreaterThan(20);
	return paths;
}
