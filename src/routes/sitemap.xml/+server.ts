import { gates } from '$lib/gates';
import { flipFlops } from '$lib/flipflops';
import { lastModified } from '$lib/lastmod';

export const prerender = true;

const SITE = 'https://nodes.kriyak.com';

// Screenshots worth surfacing in Google Images, per page.
const IMAGES: Record<string, { file: string; title: string }[]> = {
	'/logic-gates': [{ file: 'img/logic-gates-chart.png', title: 'Logic gates chart: symbols and truth tables' }],
	...Object.fromEntries(
		gates.map((gate) => [
			`/logic-gates/${gate.slug}`,
			[
				{
					file: `img/${gate.slug}-gate-truth-table.png`,
					title: `${gate.name} gate: symbol and truth table`
				}
			]
		])
	),
	'/': [{ file: 'og-image.png', title: 'The Logic Nodes logic gate simulator' }],
	'/about': [
		{ file: 'boolean-algebra.png', title: 'Truth table and boolean expression from a logic circuit' },
		{ file: 'seven-segment.png', title: 'A seven segment decoder built from logic gates' },
		{ file: 'calculator.png', title: 'A four bit calculator built from logic gates' }
	]
};

/**
 * Derived from the route tree rather than hand written, so a new page is in the
 * sitemap the moment it exists. Dynamic segments are expanded from their data.
 */
function routes(): string[] {
	const found = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));
	const paths = new Set<string>();
	for (const file of found) {
		const path = file.replace('/src/routes', '').replace('/+page.svelte', '') || '/';
		if (path.includes('[gate]')) {
			for (const gate of gates) paths.add(path.replace('[gate]', gate.slug));
		} else if (path.includes('[type]')) {
			for (const ff of flipFlops) paths.add(path.replace('[type]', ff.slug));
		} else if (path.includes('[')) {
			// An unhandled dynamic route would silently go missing; fail loudly.
			throw new Error(`sitemap: no expansion for dynamic route ${path}`);
		} else if (path !== '/about') {
			// /about only exists to redirect to the homepage.
			paths.add(path);
		}
	}
	return [...paths].sort((a, b) => a.localeCompare(b));
}

export function GET() {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${routes()
	.map((path) => {
		const images = (IMAGES[path] ?? [])
			.map(
				(image) =>
					`    <image:image>\n      <image:loc>${SITE}/${image.file}</image:loc>\n      <image:title>${image.title}</image:title>\n    </image:image>`
			)
			.join('\n');
		// Only pages with a real commit date get one. Stamping every page with the
		// build date would tell a crawler the whole site changes on every deploy.
		const date = lastModified(path);
		return `  <url>\n    <loc>${SITE}${path}</loc>${date ? `\n    <lastmod>${date}</lastmod>` : ''}${
			images ? `\n${images}` : ''
		}\n  </url>`;
	})
	.join('\n')}
</urlset>
`;
	return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
