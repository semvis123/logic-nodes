// Downscales the three editor screenshots into the sizes the homepage carousel
// actually displays, and re-encodes them as WebP.
//
// The originals are 1800px wide because that is what a 940px column needs on a
// 2x display. A phone was downloading all of it to paint a 370px slide, which
// is most of the page's image weight thrown away. The `og:image` and the
// structured data still point at the full size PNGs, so those stay put.
//
// Chromium does the resizing and the encoding: it is already a dependency, and
// unlike a native image tool it produces the same output on every machine.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');

/** The carousel is 100vw up to a 940px column, so 1800 covers a 2x display. */
const WIDTHS = [600, 900, 1200, 1800];
const QUALITY = 0.82;
const SOURCES = ['boolean-algebra.png', 'seven-segment.png', 'calculator.png'];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

for (const source of SOURCES) {
	const data = readFileSync(join(staticDir, source)).toString('base64');
	const base = source.replace(/\.png$/, '');

	const encoded = await page.evaluate(
		async ({ data, widths, quality }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${data}`;
			await image.decode();

			return widths.map((width) => {
				const height = Math.round((width / image.naturalWidth) * image.naturalHeight);
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(image, 0, 0, width, height);
				return { width, url: canvas.toDataURL('image/webp', quality) };
			});
		},
		{ data, widths: WIDTHS, quality: QUALITY }
	);

	for (const { width, url } of encoded) {
		const bytes = Buffer.from(url.split(',')[1], 'base64');
		writeFileSync(join(staticDir, `${base}-${width}.webp`), bytes);
		console.log(`${base}-${width}.webp  ${(bytes.length / 1024).toFixed(1)} KiB`);
	}
}

await browser.close();
