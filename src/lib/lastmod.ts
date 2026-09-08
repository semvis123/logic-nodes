// When each page last actually changed, from git. See scripts/lastmod.mjs: the
// map is deliberately incomplete rather than guessed, so a page with no entry
// gets no date rather than today's.

import dates from './lastmod.json';

const map = dates as Record<string, string>;

/** The last commit date for a route, or undefined if it is not known. */
export function lastModified(pathOrUrl: string): string | undefined {
	const raw = pathOrUrl.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '') || '/';
	const path = raw.length > 1 ? raw.replace(/\/$/, '') : '/';
	if (map[path]) return map[path];

	// Every gate page comes from one +page.svelte, so /logic-gates/and is dated
	// by the /logic-gates/[gate] template it is rendered from.
	for (const [route, date] of Object.entries(map)) {
		if (!route.includes('[')) continue;
		const pattern = new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`);
		if (pattern.test(path)) return date;
	}
	return undefined;
}

/**
 * Spread into a JSON-LD node: adds dateModified when it is known and nothing
 * when it is not, so the structured data never carries a date that is a guess.
 */
export function modifiedFields(pathOrUrl: string): { dateModified?: string } {
	const date = lastModified(pathOrUrl);
	return date ? { dateModified: date } : {};
}
