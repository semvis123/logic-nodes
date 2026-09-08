// Renders a downloadable reference card per gate, plus one chart of all six,
// into static/img/. The symbols and truth tables come from the same modules the
// site uses, so a card can never disagree with its page.
//
// Bundled and run by `npm run cards`.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gates } from '../src/lib/gates.js';
import { parseExpression, truthTable } from '../src/lib/boolean.js';
import { shapes, inputYs } from '../src/lib/symbols.js';

const OUT_DIR = 'static/img';

/** One gate symbol as standalone SVG markup, black on white for printing. */
function symbolSvg(slug: string, standard: 'ansi' | 'iec'): string {
	const shape = shapes[slug];
	const ys = inputYs(shape.inputs);
	const parts: string[] = [];
	if (standard === 'ansi') {
		ys.forEach((y) => parts.push(`<line x1="0" y1="${y}" x2="${shape.leadIn}" y2="${y}"/>`));
		parts.push(`<path d="${shape.body}" fill="none"/>`);
		if (shape.extra) parts.push(`<path d="${shape.extra}" fill="none"/>`);
		if (shape.bubble) parts.push(`<circle cx="${shape.bubble}" cy="25" r="4" fill="none"/>`);
		parts.push(`<line x1="${shape.leadOut}" y1="25" x2="70" y2="25"/>`);
	} else {
		ys.forEach((y) => parts.push(`<line x1="0" y1="${y}" x2="14" y2="${y}"/>`));
		parts.push(`<rect x="14" y="4" width="36" height="42" rx="1" fill="none"/>`);
		parts.push(
			`<text x="32" y="31" text-anchor="middle" font-family="monospace" font-size="15" font-weight="600" stroke="none" fill="#111">${shape.iec}</text>`
		);
		if (shape.iecBubble) {
			parts.push(`<circle cx="54" cy="25" r="4" fill="none"/>`);
			parts.push(`<line x1="58" y1="25" x2="70" y2="25"/>`);
		} else {
			parts.push(`<line x1="50" y1="25" x2="70" y2="25"/>`);
		}
	}
	return `<svg viewBox="0 0 70 50" width="126" height="90" stroke="#111" stroke-width="2" stroke-linejoin="round">${parts.join(
		''
	)}</svg>`;
}

/** Looks a gate up, failing loudly rather than silently drawing a blank card. */
function gateFor(slug: string) {
	const gate = gates.find((g) => g.slug === slug);
	if (!gate) throw new Error(`No such gate: ${slug}`);
	return gate;
}

function tableHtml(slug: string): string {
	const gate = gateFor(slug);
	const table = truthTable(parseExpression(gate.source));
	const head = [...table.variables, 'Q'].map((h) => `<th>${h}</th>`).join('');
	const body = table.rows
		.map((value, row) => {
			const cells = table.variables.map((_, bit) => {
				const on = !!(row & (1 << (table.variables.length - 1 - bit)));
				return `<td>${on ? 1 : 0}</td>`;
			});
			return `<tr>${cells.join('')}<td class="out">${value ? 1 : 0}</td></tr>`;
		})
		.join('');
	return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; color: #111; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .card { padding: 40px 44px; display: flex; flex-direction: column; gap: 18px; }
  h1 { font-size: 46px; letter-spacing: -0.01em; }
  .expr { font-family: ui-monospace, Menlo, monospace; font-size: 26px; color: #333; }
  .symbols { display: flex; gap: 46px; align-items: center; }
  .sym { text-align: center; }
  .sym span { display: block; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 6px; }
  table { border-collapse: collapse; font-family: ui-monospace, Menlo, monospace; font-size: 20px; }
  th, td { border: 1px solid #111; padding: 7px 20px; text-align: center; }
  th { background: #f0f0f0; font-weight: 700; }
  td.out { font-weight: 700; }
  .note { font-size: 18px; color: #444; line-height: 1.45; }
  .foot { font-size: 15px; color: #666; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 4px; }
  .chart { padding: 36px 40px; }
  .chart h1 { font-size: 38px; margin-bottom: 22px; }
  .row { display: flex; align-items: center; gap: 28px; padding: 12px 0; border-top: 1px solid #ddd; }
  .row:first-of-type { border-top: none; }
  .row .name { width: 96px; font-size: 26px; font-weight: 700; font-family: ui-monospace, Menlo, monospace; }
  .row .e { width: 130px; font-family: ui-monospace, Menlo, monospace; font-size: 19px; color: #333; }
  .row table { font-size: 15px; }
  .row th, .row td { padding: 3px 11px; }
  .row .desc { font-size: 16px; color: #444; flex: 1; }
`;

const gateCard = (slug: string) => {
	const gate = gateFor(slug);
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
  <div class="card">
    <div>
      <h1>${gate.name} gate</h1>
      <div class="expr">${gate.symbol}</div>
    </div>
    <div class="symbols">
      <div class="sym">${symbolSvg(slug, 'ansi')}<span>ANSI</span></div>
      <div class="sym">${symbolSvg(slug, 'iec')}<span>IEC</span></div>
    </div>
    ${tableHtml(slug)}
    <p class="note">Output is high when ${gate.outputHigh}.</p>
    <p class="foot">logicgates.org/logic-gates/${slug}</p>
  </div></body></html>`;
};

const chart = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
  <div class="chart">
    <h1>Logic gates: symbols and truth tables</h1>
    ${gates
			.map(
				(gate) => `<div class="row">
      <div class="name">${gate.name}</div>
      ${symbolSvg(gate.slug, 'ansi')}
      <div class="e">${gate.symbol}</div>
      ${tableHtml(gate.slug)}
      <div class="desc">High when ${gate.outputHigh}.</div>
    </div>`
			)
			.join('')}
    <p class="foot">logicgates.org/logic-gates</p>
  </div></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 });

for (const gate of gates) {
	await page.setContent(gateCard(gate.slug), { waitUntil: 'load' });
	const card = await page.$('.card');
	if (!card) throw new Error('The card did not render');
	await card.screenshot({ path: join(OUT_DIR, `${gate.slug}-gate-truth-table.png`) });
	console.log(`  ${gate.slug}-gate-truth-table.png`);
}

await page.setViewportSize({ width: 1180, height: 900 });
await page.setContent(chart(), { waitUntil: 'load' });
const chartEl = await page.$('.chart');
if (!chartEl) throw new Error('The chart did not render');
await chartEl.screenshot({ path: join(OUT_DIR, 'logic-gates-chart.png') });
console.log('  logic-gates-chart.png');

await browser.close();
console.log(`\n${gates.length + 1} reference cards written to ${OUT_DIR}/`);
