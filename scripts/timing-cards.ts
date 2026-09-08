// Renders the timing diagrams as standalone PNGs.
//
// The pages draw these as inline SVG, which is why they are crisp and print in
// black and white. The cost is that there is no image file, so nothing can be
// indexed in Google Images or dropped into a slide. This writes the same
// waveforms out as files, from the same generators the pages use, so the two
// cannot describe different circuits.
//
//   npm run timing

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flipFlops } from '../src/lib/flipflops.js';
import { clockSignal, pattern, simulateClocked, timingToSvg, type Level, type Signal } from '../src/lib/timing.js';
import { counterWaveforms, shiftRegisterStages, ringCounter, johnsonCounter } from '../src/lib/sequential.js';

const OUT_DIR = 'static/img';

const STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; color: #111; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .card { padding: 36px 40px; display: flex; flex-direction: column; gap: 14px; width: max-content; }
  h1 { font-size: 34px; letter-spacing: -0.01em; }
  .sub { font-family: ui-monospace, Menlo, monospace; font-size: 20px; color: #333; }
  .note { font-size: 16px; color: #444; line-height: 1.45; max-width: 720px; }
  .foot { font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 2px; }
  svg { display: block; }
`;

const card = (title: string, sub: string, svg: string, note: string, url: string) =>
	`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
  <div class="card">
    <div><h1>${title}</h1><div class="sub">${sub}</div></div>
    ${svg}
    <p class="note">${note}</p>
    <p class="foot">${url}</p>
  </div></body></html>`;

/** Mono, since these end up on white paper and white slides. */
const draw = (signals: Signal[]) => timingToSvg(signals, { palette: 'mono', showEdges: true, showCycles: true });

type Card = {
	file: string;
	title: string;
	sub: string;
	signals: Signal[];
	note: string;
	url: string;
	/** Alt text, written here so the file and its description travel together. */
	alt: string;
};
const cards: Card[] = [];

// One per flip-flop, walking every legal input combination, exactly as the page
// does so the file and the page agree.
for (const ff of flipFlops) {
	const combinations = [
		...new Map(
			ff.characteristic.filter((row) => row.next !== 'invalid').map((row) => [row.inputs.join(''), row.inputs])
		).values()
	];
	const inputs = ff.inputs.map((name, i) =>
		pattern(name.toUpperCase(), combinations.map((bits) => String(bits[i]).repeat(2)).join(''))
	);
	const q = simulateClocked(ff.equation, inputs, { initial: 0 });
	cards.push({
		file: `${ff.slug}-flip-flop-timing-diagram.png`,
		title: `${ff.shortName} flip-flop timing diagram`,
		sub: ff.equationText,
		signals: [clockSignal(inputs[0].bits.length), ...inputs, q],
		note: `Q changes only on a rising clock edge, shown by the dashed lines. Every legal input combination in turn, held for two cycles.`,
		url: `logicgates.org/flip-flops/${ff.slug}`,
		alt: `${ff.shortName} flip-flop timing diagram: clock, ${ff.inputs
			.map((i) => i.toUpperCase())
			.join(' and ')} inputs, and the Q output changing only on rising clock edges`
	});
}

const COUNTER_CYCLES = 10;
cards.push({
	file: 'binary-counter-timing-diagram.png',
	alt: 'Timing diagram of a 3 bit binary counter, showing Q0 toggling every cycle, Q1 every second cycle and Q2 every fourth',
	title: '3 bit binary counter timing diagram',
	sub: 'Q2 Q1 Q0, counting 0 to 7',
	signals: [clockSignal(COUNTER_CYCLES), ...counterWaveforms(3, COUNTER_CYCLES)],
	note: 'Each bit toggles when every bit below it is high, so each runs at half the rate of the one before. That halving is why a counter is also a frequency divider.',
	url: 'logicgates.org/counters'
});

cards.push({
	file: 'decade-counter-timing-diagram.png',
	alt: 'Timing diagram of a decade counter counting 0 to 9 and clearing back to 0',
	title: 'Decade counter timing diagram',
	sub: 'Counts 0 to 9, then clears',
	signals: [clockSignal(12), ...counterWaveforms(4, 12, 10)],
	note: 'A four bit counter with a detector on 10 wired to the clear input, so the sequence stops short and starts again.',
	url: 'logicgates.org/counters'
});

const serial: Level[] = [1, 0, 1, 1, 0, 0, 0, 0, 0, 0];
cards.push({
	file: 'shift-register-timing-diagram.png',
	alt: 'Timing diagram of a 4 bit shift register, showing the input pattern moving one stage per clock edge',
	title: '4 bit shift register timing diagram',
	sub: 'Serial in, parallel out',
	signals: [
		clockSignal(serial.length),
		{ name: 'IN', bits: serial, coloured: true },
		...shiftRegisterStages(serial, 4)
	],
	note: 'Stage k holds what the input was k+1 cycles ago, so the pattern walks along one place per clock edge.',
	url: 'logicgates.org/shift-registers'
});

cards.push({
	file: 'ring-counter-timing-diagram.png',
	alt: 'Timing diagram of a 4 stage ring counter, one high bit moving one place per clock edge',
	title: 'Ring counter timing diagram',
	sub: '4 states from 4 stages',
	signals: [clockSignal(9), ...ringCounter(4, 9)],
	note: 'One high bit walked around a loop. Each state is already a single wire, so nothing needs decoding.',
	url: 'logicgates.org/shift-registers'
});

cards.push({
	file: 'johnson-counter-timing-diagram.png',
	alt: 'Timing diagram of a 4 stage Johnson counter filling with ones and then emptying, giving eight states',
	title: 'Johnson counter timing diagram',
	sub: '8 states from the same 4 stages',
	signals: [clockSignal(10), ...johnsonCounter(4, 10)],
	note: 'A ring with the last output inverted on the way back, so the register fills with 1s and then empties, doubling the number of states.',
	url: 'logicgates.org/shift-registers'
});

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const entry of cards) {
	await page.setViewportSize({ width: 1200, height: 800 });
	await page.setContent(card(entry.title, entry.sub, draw(entry.signals), entry.note, entry.url), {
		waitUntil: 'load'
	});
	const el = await page.$('.card');
	if (!el) throw new Error(`no card rendered for ${entry.file}`);
	await el.screenshot({ path: join(OUT_DIR, entry.file) });
	console.log(`  ${entry.file}`);
}

await browser.close();

// A manifest so the pages and the sitemap use the real dimensions and the same
// alt text, instead of each hardcoding its own copy.
const manifest = cards.map(({ file, title, alt, url }) => {
	const bytes = readFileSync(join(OUT_DIR, file));
	return { file, title, alt, url, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
});
writeFileSync('src/lib/timingCards.json', `${JSON.stringify(manifest, null, '\t')}\n`);

console.log(`\n${cards.length} timing diagrams written to ${OUT_DIR}/, manifest to src/lib/timingCards.json`);
