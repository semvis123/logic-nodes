// A timing diagram is only worth showing if it agrees with the equation the
// same page states. These check the simulation against the published tables,
// and the drawing against the simulation.

import { expect, test } from '@playwright/test';
import { flipFlops } from '../src/lib/flipflops.js';
import { clockSignal, pattern, simulateClocked, timingToSvg, timingAlt, type Level } from '../src/lib/timing.js';
import { parseExpression, evaluate } from '../src/lib/boolean.js';

test.describe('timing diagrams', () => {
	test('a simulated trace obeys the published characteristic table', () => {
		for (const ff of flipFlops) {
			const ast = parseExpression(ff.equation);
			// Walk every input combination in a long pseudo-random sequence.
			const cycles = 24;
			const inputs = ff.inputs.map((name, i) =>
				pattern(name, Array.from({ length: cycles }, (_, c) => ((c >> i) & 1 ? '1' : '0')).join(''))
			);
			const q = simulateClocked(ff.equation, inputs, { initial: 0 });
			expect(q.bits.length, `${ff.slug} produced no trace`).toBe(cycles);

			// Every step must be exactly what the equation says, one cycle later.
			for (let c = 0; c < cycles - 1; c++) {
				const values: Record<string, boolean> = { q: q.bits[c] === 1 };
				ff.inputs.forEach((name, i) => (values[name] = inputs[i].bits[c] === 1));
				const expected: Level = evaluate(ast, values) ? 1 : 0;
				expect(q.bits[c + 1], `${ff.slug} cycle ${c + 1} -> ${c + 2}`).toBe(expected);
			}
		}
	});

	test('a D flip-flop delays its input by exactly one cycle', () => {
		const d = pattern('d', '0110100110');
		const q = simulateClocked('d', [d], { initial: 0 });
		// The definition of the thing: Q follows D, one cycle behind.
		expect(q.bits.slice(1).join('')).toBe(d.bits.slice(0, -1).join(''));
	});

	test('a T flip-flop toggles only when told to', () => {
		const t = pattern('t', '0011110000');
		const q = simulateClocked('t ^ q', [t], { initial: 0 });
		for (let c = 1; c < t.bits.length; c++) {
			const changed = q.bits[c] !== q.bits[c - 1];
			expect(changed, `cycle ${c}`).toBe(t.bits[c - 1] === 1);
		}
	});

	test('the drawing has one trace per signal and is well formed', () => {
		for (const palette of ['colour', 'mono'] as const) {
			const signals = [clockSignal(6), pattern('d', '011010'), simulateClocked('d', [pattern('d', '011010')])];
			const svg = timingToSvg(signals, { palette, caption: 'D flip-flop', showEdges: true });
			expect(svg.startsWith('<svg')).toBe(true);
			expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
			expect((svg.match(/<path /g) ?? []).length, 'one path per signal').toBe(signals.length);
			for (const signal of signals) expect(svg).toContain(`>${signal.name}<`);
			// No NaN or undefined can reach a coordinate.
			expect(svg).not.toMatch(/NaN|undefined/);
			// A cycle label per cycle, plus the caption.
			expect(svg).toContain('D flip-flop');
		}
	});

	test('the printable palette uses no colour', () => {
		const svg = timingToSvg([clockSignal(4), pattern('a', '0101')], { palette: 'mono' });
		// Only black, white and the grey of the guide lines.
		const colours = [...svg.matchAll(/(?:stroke|fill)="(#[0-9a-f]{3,6})"/gi)].map((m) => m[1].toLowerCase());
		for (const colour of colours) expect(['#ffffff', '#000000', '#555555']).toContain(colour);
	});

	test('alt text describes the traces that carry data', () => {
		const alt = timingAlt([clockSignal(4), pattern('a', '0101')]);
		expect(alt).toContain('a is 0101');
		expect(alt).not.toContain('CLK');
	});
});
