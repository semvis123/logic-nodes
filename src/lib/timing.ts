// Timing diagrams: the way sequential logic is actually taught. A flip-flop's
// characteristic equation says what the next state is; a waveform says when it
// happens, which is the part a table cannot show.
//
// The traces are not drawn by hand. A flip-flop's Q is simulated from the same
// equation the reference tables are checked against, so a diagram cannot
// disagree with the page it sits on.

import { evaluate, parseExpression, type Ast } from './boolean.js';
import { THEMES, type Palette } from './exportSvg.js';

export type Level = 0 | 1;

export type Signal = {
	name: string;
	/** One level per clock cycle. */
	bits: Level[];
	/** Drawn in the state colours; inputs usually are, a clock is not. */
	coloured?: boolean;
};

export type TimingOptions = {
	palette?: Palette;
	/** Dashed markers on the active clock edge, which is where state changes. */
	showEdges?: boolean;
	caption?: string;
	/** Labels the cycles 1..n along the bottom. */
	showCycles?: boolean;
};

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace";

const CYCLE = 56; // width of one clock cycle
const HEIGHT = 26; // height of a trace's swing
const GAP = 18; // vertical space between traces
const LABEL = 54; // room for the signal name
const PAD = 14;
const RISE = 4; // horizontal run of a transition, so edges look like edges

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Simulates a clocked element over a set of input waveforms.
 *
 * One column is one clock cycle. The inputs shown in a cycle are the values
 * present during it, and the state they produce appears in the next cycle:
 * that is the rising edge at the boundary doing its work, which is exactly the
 * delay a timing diagram exists to show.
 */
export function simulateClocked(
	equation: string | Ast,
	inputs: Signal[],
	options: { initial?: Level; stateName?: string } = {}
): Signal {
	const ast = typeof equation === 'string' ? parseExpression(equation) : equation;
	const cycles = Math.max(0, ...inputs.map((signal) => signal.bits.length));
	const bits: Level[] = [];
	let q: Level = options.initial ?? 0;

	for (let cycle = 0; cycle < cycles; cycle++) {
		bits.push(q);
		const values: Record<string, boolean> = { q: q === 1 };
		for (const signal of inputs) values[signal.name.toLowerCase()] = signal.bits[cycle] === 1;
		q = evaluate(ast, values) ? 1 : 0;
	}
	return { name: options.stateName ?? 'Q', bits, coloured: true };
}

/** A square wave: high for the first half of every cycle. */
export function clockSignal(cycles: number, name = 'CLK'): Signal {
	return { name, bits: Array.from({ length: cycles }, () => 1), coloured: false };
}

/** Repeats a pattern out to `cycles`, so a waveform can be written as a string. */
export function pattern(name: string, bits: string, coloured = true): Signal {
	return {
		name,
		bits: [...bits].filter((c) => c === '0' || c === '1').map((c) => (c === '1' ? 1 : 0)) as Level[],
		coloured
	};
}

/** The path for one trace. The clock gets a pulse per cycle; the rest hold. */
function tracePath(signal: Signal, cycles: number, isClock: boolean, top: number): string {
	const y = (level: Level) => top + (level === 1 ? 0 : HEIGHT);
	const points: string[] = [];
	let x = LABEL + PAD;

	if (isClock) {
		// Low, then a rising edge at the start of each cycle: the edge lines up
		// with the boundary where state changes.
		points.push(`M ${x} ${y(0)}`);
		for (let cycle = 0; cycle < cycles; cycle++) {
			points.push(`L ${round(x + RISE)} ${y(1)}`);
			points.push(`L ${round(x + CYCLE / 2)} ${y(1)}`);
			points.push(`L ${round(x + CYCLE / 2 + RISE)} ${y(0)}`);
			points.push(`L ${round(x + CYCLE)} ${y(0)}`);
			x += CYCLE;
		}
		return points.join(' ');
	}

	points.push(`M ${x} ${y(signal.bits[0] ?? 0)}`);
	for (let cycle = 0; cycle < cycles; cycle++) {
		const level = signal.bits[cycle] ?? signal.bits[signal.bits.length - 1] ?? 0;
		const previous = cycle === 0 ? level : signal.bits[cycle - 1] ?? level;
		if (level !== previous) {
			points.push(`L ${round(x + RISE)} ${y(level)}`);
		}
		points.push(`L ${round(x + CYCLE)} ${y(level)}`);
		x += CYCLE;
	}
	return points.join(' ');
}

export function timingToSvg(signals: Signal[], options: TimingOptions = {}): string {
	const { palette = 'colour', showEdges = true, caption = '', showCycles = true } = options;
	const theme = THEMES[palette];
	const cycles = Math.max(1, ...signals.map((s) => s.bits.length));

	const width = LABEL + PAD * 2 + cycles * CYCLE;
	const rows = signals.length;
	const captionRoom = caption ? 22 : 0;
	const cycleRoom = showCycles ? 18 : 0;
	const height = PAD * 2 + rows * (HEIGHT + GAP) - GAP + captionRoom + cycleRoom;

	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
		`<rect width="${width}" height="${height}" fill="${theme.background}"/>`
	];

	const topOf = (row: number) => PAD + row * (HEIGHT + GAP);

	// Edge markers first, so the traces draw over them.
	if (showEdges) {
		for (let cycle = 0; cycle <= cycles; cycle++) {
			const x = LABEL + PAD + cycle * CYCLE;
			parts.push(
				`<line x1="${round(x)}" y1="${PAD - 6}" x2="${round(x)}" y2="${topOf(rows - 1) + HEIGHT + 6}" stroke="${
					theme.muted
				}" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`
			);
		}
	}

	signals.forEach((signal, row) => {
		const top = topOf(row);
		const isClock = signal.coloured === false && /clk|clock/i.test(signal.name);
		const stroke = signal.coloured === false ? theme.line : theme.high;

		parts.push(
			`<text x="${LABEL - 8}" y="${
				top + HEIGHT / 2 + 4
			}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${theme.text}">${signal.name}</text>`
		);
		parts.push(
			`<path d="${tracePath(
				signal,
				cycles,
				isClock,
				top
			)}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`
		);
	});

	if (showCycles) {
		const y = topOf(rows - 1) + HEIGHT + 16;
		for (let cycle = 0; cycle < cycles; cycle++) {
			const x = LABEL + PAD + cycle * CYCLE + CYCLE / 2;
			parts.push(
				`<text x="${round(x)}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="10" fill="${
					theme.muted
				}">${cycle + 1}</text>`
			);
		}
	}

	if (caption) {
		parts.push(
			`<text x="${width / 2}" y="${height - 7}" text-anchor="middle" font-family="${SANS}" font-size="12" fill="${
				theme.muted
			}">${caption.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</text>`
		);
	}

	parts.push('</svg>');
	return parts.join('');
}

/** Plain text description of a diagram, for the alt attribute. */
export function timingAlt(signals: Signal[]): string {
	return signals
		.filter((s) => s.coloured !== false)
		.map((s) => `${s.name} is ${s.bits.join('')}`)
		.join(', ');
}
