// Renders one social card per page into static/og/.
//
// Run after a build: the titles and descriptions are read back out of the
// prerendered HTML, so a card can never disagree with the page it belongs to.
//
//   npm run build && node scripts/og-images.mjs

import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PAGES_DIR = '.svelte-kit/output/prerendered/pages';
const OUT_DIR = 'static/og';
const WIDTH = 1200;
const HEIGHT = 630;

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (entry.endsWith('.html')) out.push(full);
	}
	return out;
}

// Pages that exist only to redirect. A card for one could never be shared,
// since the URL never renders.
const SKIP = new Set(['/about']);

const decode = (s) =>
	s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');

const strip = (s) =>
	decode(s.replace(/<[^>]+>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();

function pageInfo(file) {
	const html = readFileSync(file, 'utf8');
	const path = '/' + relative(PAGES_DIR, file).replace(/\.html$/, '');
	const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
	const lede = html.match(/class="lede[^"]*"[^>]*>([\s\S]*?)<\/p>/);
	const desc = html.match(/<meta name="description" content="([^"]*)"/);
	const kicker = html.match(/<nav class="crumbs[^"]*"[\s\S]*?<a[^>]*>([^<]*)<\/a>/);
	return {
		path,
		slug: path === '/' ? 'home' : path.slice(1).replace(/\//g, '-'),
		title: h1 ? strip(h1[1]) : 'Logic Nodes',
		subtitle: lede ? strip(lede[1]) : desc ? decode(desc[1]) : '',
		kicker: kicker ? strip(kicker[1]) : ''
	};
}

// The card markup: same palette and grid as the site itself.
const card = ({ title, subtitle, kicker }) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; display: flex; flex-direction: column;
    justify-content: space-between; padding: 64px 72px;
    background-color: #1d1e20;
    background-image:
      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 45px 45px;
    color: #fff;
    font: 400 16px/1.5 'Helvetica Neue', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 26px; color: #ddd; }
  .box { width: 26px; height: 26px; background: #372; border: 2px solid #fff; border-radius: 5px; }
  .kicker { color: #5db65d; font-size: 22px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 16px; }
  h1 { font-size: ${title.length > 34 ? 62 : 76}px; line-height: 1.08; letter-spacing: -0.02em; }
  p { color: #bbb; font-size: 27px; line-height: 1.45; margin-top: 22px; max-width: 900px;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; }
  .url { color: #8ede8e; font: 500 24px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .wires { display: flex; gap: 7px; align-items: flex-end; }
  .wires i { display: block; width: 7px; border-radius: 2px; }
</style></head>
<body>
  <div class="brand"><span class="box"></span> Logic Nodes</div>
  <div>
    ${kicker ? `<div class="kicker">${kicker}</div>` : ''}
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
  </div>
  <div class="foot">
    <span class="url">logicgates.org</span>
    <span class="wires">
      ${[18, 34, 26, 46, 30, 22, 38]
				.map((h, i) => `<i style="height:${h}px;background:${i % 3 === 1 ? '#f23' : '#5db65d'}"></i>`)
				.join('')}
    </span>
  </div>
</body></html>`;

const files = walk(PAGES_DIR);
mkdirSync(OUT_DIR, { recursive: true });

// Uses the Chrome already on the machine, so this needs no extra download.
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

let count = 0;
for (const file of files) {
	const info = pageInfo(file);
	if (SKIP.has(info.path)) continue;
	await page.setContent(card(info), { waitUntil: 'load' });
	await page.screenshot({ path: join(OUT_DIR, `${info.slug}.png`) });
	count++;
	console.log(`  ${info.slug}.png  ${info.title}`);
}

// The editor route has no prerendered HTML of its own, so give it a card too.
await page.setContent(
	card({
		title: 'Build logic circuits in your browser',
		subtitle: 'A free logic gate simulator. Wire up gates, watch the signals flow, and read off the truth table.',
		kicker: ''
	}),
	{ waitUntil: 'load' }
);
await page.screenshot({ path: join(OUT_DIR, 'home.png') });
count++;

await browser.close();
console.log(`\n${count} social cards written to ${OUT_DIR}/`);
