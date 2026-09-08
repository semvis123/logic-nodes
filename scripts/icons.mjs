// Renders the app icons and the favicon from one source drawing, so they all
// match. The old favicon was 100x100, which is too small for an installed app.
//
//   npm run icons

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// The mark is the editor's own idiom: two wires into a gate, one lit wire out.
const icon = (size, padding) => {
	const inset = Math.round(size * padding);
	const box = size - inset * 2;
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; }
    body { width: ${size}px; height: ${size}px; background: #1d1e20; display: flex;
           align-items: center; justify-content: center; }
    svg { display: block; }
  </style></head><body>
  <svg width="${box}" height="${box}" viewBox="0 0 100 100">
    <rect x="2" y="2" width="96" height="96" rx="16" fill="#161618" stroke="#ffffff" stroke-width="5"/>
    <!-- An OR gate holding a true statement: one input high, one low, output
         high. It was an AND before, with the same colours, which reads as
         1 AND 0 = 1. A logic site should not ship a wrong gate as its mark.
         The leads stop at x = 51 because that is where the curved back sits at
         the pin heights, not at its leftmost point. -->
    <line x1="18" y1="34" x2="52" y2="34" stroke="#5db65d" stroke-width="7" stroke-linecap="round"/>
    <line x1="18" y1="66" x2="52" y2="66" stroke="#f23" stroke-width="7" stroke-linecap="round"/>
    <path d="M46 20 Q60 50 46 80 Q68 80 84 50 Q68 20 46 20 Z" fill="#0d0d0f" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/>
    <line x1="84" y1="50" x2="94" y2="50" stroke="#5db65d" stroke-width="7" stroke-linecap="round"/>
    <circle cx="88" cy="50" r="0.1" fill="#5db65d"/>
  </svg>
  </body></html>`;
};

const OUT = 'static';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

const targets = [
	{ file: 'favicon.png', size: 512, padding: 0 },
	{ file: 'icon-192.png', size: 192, padding: 0 },
	{ file: 'icon-512.png', size: 512, padding: 0 },
	// Maskable icons get cropped to a circle by Android, so keep clear of the edge.
	{ file: 'icon-maskable-512.png', size: 512, padding: 0.14 },
	{ file: 'apple-touch-icon.png', size: 180, padding: 0.06 }
];

for (const { file, size, padding } of targets) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(icon(size, padding), { waitUntil: 'load' });
	await page.screenshot({ path: `${OUT}/${file}` });
	console.log(`  ${file}  ${size}x${size}`);
}

await browser.close();
console.log(`\n${targets.length} icons written to ${OUT}/`);
