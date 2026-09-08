// Renders the reference material that only exists as page markup into image
// files: the common circuit diagrams, the gate symbol chart, the boolean
// algebra laws, and the flip-flop comparison.
//
// Everything is drawn from the same data and the same renderers the pages use,
// so a card cannot show a different circuit from the page it sits on.
//
//   npm run diagrams

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commonCircuits } from '../src/lib/commonCircuits.js';
import { flipFlops } from '../src/lib/flipflops.js';
import { gates } from '../src/lib/gates.js';
import { laws, lawCategories } from '../src/lib/laws.js';
import { parseExpression, truthTable, format } from '../src/lib/boolean.js';
import { buildCircuit } from '../src/lib/circuit.js';
import { circuitToSvg } from '../src/lib/exportSvg.js';
import { symbolSvg } from './gateSymbols.js';

const OUT_DIR = 'static/img';

const STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; color: #111; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .card { padding: 36px 40px; display: flex; flex-direction: column; gap: 16px; width: max-content; }
  h1 { font-size: 34px; letter-spacing: -0.01em; }
  .sub { font-size: 18px; color: #444; margin-top: 4px; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .out { display: flex; flex-direction: column; gap: 6px; }
  .out .label { font-size: 17px; color: #222; }
  .out .label b { font-family: ui-monospace, Menlo, monospace; }
  .foot { font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 2px; }
  svg { display: block; }
  table { border-collapse: collapse; font-size: 17px; }
  th, td { border: 1px solid #111; padding: 6px 14px; text-align: center; }
  th { background: #f0f0f0; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(3, auto); gap: 26px 40px; }
  .sym { text-align: center; }
  .sym .nm { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .sym .ex { font-family: ui-monospace, Menlo, monospace; font-size: 15px; color: #555; margin-bottom: 8px; }
  .sym .pair { display: flex; gap: 26px; justify-content: center; align-items: center; }
  .sym .pair div { text-align: center; }
  .sym .pair span { display: block; font-size: 12px; color: #666; letter-spacing: 0.06em; margin-top: 4px; }
  .laws { display: grid; grid-template-columns: repeat(2, auto); gap: 10px 48px; }
  .law { display: flex; align-items: baseline; gap: 12px; font-size: 17px; }
  .law .l, .law .r { font-family: ui-monospace, Menlo, monospace; }
  .law .eq { color: #888; }
  .law .nm { color: #666; font-size: 14px; margin-left: auto; padding-left: 18px; }
  .cat { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #444;
         grid-column: 1 / -1; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 6px; }
  .cat:first-child { border-top: none; margin-top: 0; padding-top: 0; }
  .ffs { display: flex; gap: 34px; align-items: flex-start; }
  .ff .nm { font-size: 24px; font-weight: 700; }
  .ff .eq { font-family: ui-monospace, Menlo, monospace; font-size: 15px; color: #444; margin: 4px 0 10px; }
`;

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c));

const html = (body: string) =>
	`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${body}</body></html>`;

const shell = (title: string, sub: string, inner: string, url: string) =>
	html(`<div class="card">
    <div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
    ${inner}
    <p class="foot">${url}</p>
  </div>`);

/** A gate diagram, drawn the same way the circuit generator draws one. */
const diagram = (expression: string, outputLabel: string) =>
	circuitToSvg(buildCircuit(parseExpression(expression)), {
		standard: 'ansi',
		palette: 'mono',
		outputLabel
	});

type Card = { file: string; title: string; alt: string; url: string; body: string; width: number };
const cards: Card[] = [];

// --- 1. one card per common circuit, with a diagram for each of its outputs
for (const circuit of commonCircuits) {
	const outputs = circuit.outputs
		.map(
			(output) => `<div class="out">
        <div class="label"><b>${esc(output.name)}</b> = ${esc(
				format(parseExpression(output.expression), 'math')
			)} &mdash; ${esc(output.note)}</div>
        ${diagram(output.expression, output.name)}
      </div>`
		)
		.join('');
	const pins = circuit.inputs.map((input) => `${input.v} = ${input.label}`).join(', ');
	cards.push({
		file: `${circuit.slug}-circuit-diagram.png`,
		title: `${circuit.name} circuit diagram`,
		alt: `${circuit.name} logic circuit diagram with inputs ${pins}: ${circuit.outputs
			.map((o) => `${o.name} from ${format(parseExpression(o.expression), 'math')}`)
			.join(', ')}`,
		url: `logicgates.org/common-circuits#${circuit.slug}`,
		body: shell(
			`${circuit.name} circuit diagram`,
			`${circuit.tagline}  Inputs: ${pins}.`,
			outputs,
			`logicgates.org/common-circuits`
		),
		width: 1100
	});
}

// --- 2. the gate symbols chart, both standards side by side
const symbolsBody = gates
	.map(
		(gate) => `<div class="sym">
      <div class="nm">${esc(gate.name)}</div>
      <div class="ex">${esc(gate.symbol)}</div>
      <div class="pair">
        <div>${symbolSvg(gate.slug, 'ansi')}<span>ANSI</span></div>
        <div>${symbolSvg(gate.slug, 'iec')}<span>IEC</span></div>
      </div>
    </div>`
	)
	.join('');
cards.push({
	file: 'logic-gate-symbols-chart.png',
	title: 'Logic gate symbols chart',
	alt: `Logic gate symbols chart: ANSI distinctive shapes and IEC rectangles side by side for ${gates
		.map((g) => g.name)
		.join(', ')}`,
	url: 'logicgates.org/logic-gate-symbols',
	body: shell(
		'Logic gate symbols',
		'ANSI distinctive shapes and IEC rectangles, side by side',
		`<div class="grid">${symbolsBody}</div>`,
		'logicgates.org/logic-gate-symbols'
	),
	width: 900
});

// --- 3. the laws of boolean algebra on one sheet
const lawsBody = lawCategories
	.map((category) => {
		const items = laws
			.filter((law) => law.category === category)
			.map(
				(law) =>
					`<div class="law"><span class="l">${esc(law.left)}</span><span class="eq">=</span><span class="r">${esc(
						law.right
					)}</span><span class="nm">${esc(law.name)}</span></div>`
			)
			.join('');
		return `<div class="cat">${esc(category)}</div>${items}`;
	})
	.join('');
cards.push({
	file: 'boolean-algebra-laws-chart.png',
	title: 'Boolean algebra laws',
	alt: `Boolean algebra laws reference: ${laws.length} identities including De Morgan, distributivity, absorption and consensus`,
	url: 'logicgates.org/boolean-algebra-laws',
	body: shell(
		'The laws of boolean algebra',
		`${laws.length} identities for rewriting logic without changing what it does`,
		`<div class="laws">${lawsBody}</div>`,
		'logicgates.org/boolean-algebra-laws'
	),
	width: 1500
});

// --- 4. the four flip-flops compared
const ffBody = flipFlops
	.map((ff) => {
		const rows = ff.characteristic
			.map(
				(row) =>
					`<tr>${row.inputs.map((b) => `<td>${b}</td>`).join('')}<td>${row.q}</td><td><b>${
						row.next === 'invalid' ? '&mdash;' : row.next
					}</b></td></tr>`
			)
			.join('');
		return `<div class="ff">
      <div class="nm">${esc(ff.shortName)}</div>
      <div class="eq">${esc(ff.equationText)}</div>
      <table><thead><tr>${ff.inputs
				.map((i) => `<th>${esc(i.toUpperCase())}</th>`)
				.join('')}<th>Q</th><th>Q⁺</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
	})
	.join('');
cards.push({
	file: 'flip-flops-comparison-chart.png',
	title: 'Flip-flop comparison chart',
	alt: 'Comparison of the SR, D, JK and T flip-flops: next-state equation and characteristic table for each',
	url: 'logicgates.org/flip-flops',
	body: shell(
		'The four flip-flops',
		'Next-state equation and characteristic table for each',
		`<div class="ffs">${ffBody}</div>`,
		'logicgates.org/flip-flops'
	),
	width: 1500
});

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const entry of cards) {
	await page.setViewportSize({ width: entry.width, height: 900 });
	await page.setContent(entry.body, { waitUntil: 'load' });
	const el = await page.$('.card');
	if (!el) throw new Error(`no card rendered for ${entry.file}`);
	await el.screenshot({ path: join(OUT_DIR, entry.file) });
	console.log(`  ${entry.file}`);
}

await browser.close();

const manifest = cards.map(({ file, title, alt, url }) => {
	const bytes = readFileSync(join(OUT_DIR, file));
	return { file, title, alt, url, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
});
writeFileSync('src/lib/diagramCards.json', `${JSON.stringify(manifest, null, '\t')}\n`);

console.log(`\n${cards.length} diagrams written to ${OUT_DIR}/, manifest to src/lib/diagramCards.json`);
