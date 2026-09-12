// Standalone SVG renderers for the circuit diagram and the truth table.
//
// These build the file as a string rather than serialising the DOM, so the
// export does not depend on page CSS and can offer a printable black and white
// version alongside the on-screen colours.

import type { Circuit } from './circuit.js';
import type { TruthTable, SystemTable } from './boolean.js';
import { shapes, inputYs } from './symbols.js';

export type Palette = 'colour' | 'mono';
export type Standard = 'ansi' | 'iec';

export type Theme = {
	background: string;
	body: string;
	line: string;
	text: string;
	high: string;
	low: string;
	muted: string;
};

export const THEMES: Record<Palette, Theme> = {
	colour: {
		background: '#1d1e20',
		body: '#161618',
		line: '#ffffff',
		text: '#ffffff',
		high: '#5db65d',
		low: '#f23',
		muted: '#888888'
	},
	// Printable: white paper, black ink, no state colours to lose in a photocopy.
	mono: {
		background: '#ffffff',
		body: '#ffffff',
		line: '#000000',
		text: '#000000',
		high: '#000000',
		low: '#000000',
		muted: '#555555'
	}
};

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const round = (n: number) => Math.round(n * 10) / 10;

function document_(width: number, height: number, title: string, body: string, theme: Theme) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(
		width
	)} ${round(height)}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<rect width="${round(width)}" height="${round(height)}" fill="${theme.background}"/>
${body}
</svg>
`;
}

/** One gate symbol, positioned, in whichever standard was asked for. */
function gateMarkup(
	op: string,
	x: number,
	y: number,
	standard: Standard,
	theme: Theme,
	wireColours: (string | null)[],
	outColour: string
): string {
	const shape = shapes[op] ?? shapes.and;
	// The gate kind is carried on the group so an exported file says what it
	// contains, and so tests can count gates without re-deriving the circuit.
	const parts: string[] = [`<g data-gate="${op}" transform="translate(${round(x)} ${round(y)})">`];
	const ys = inputYs(shape.inputs);

	if (standard === 'ansi') {
		ys.forEach((py, i) => {
			parts.push(
				`<line x1="0" y1="${py}" x2="${shape.leadIn}" y2="${py}" stroke="${
					wireColours[i] ?? theme.muted
				}" stroke-width="2"/>`
			);
		});
		parts.push(
			`<path d="${shape.body}" fill="${theme.body}" stroke="${theme.line}" stroke-width="2" stroke-linejoin="round"/>`
		);
		if (shape.extra) {
			parts.push(`<path d="${shape.extra}" fill="none" stroke="${theme.line}" stroke-width="2"/>`);
		}
		if (shape.bubble) {
			parts.push(
				`<circle cx="${shape.bubble}" cy="25" r="4" fill="${theme.body}" stroke="${theme.line}" stroke-width="2"/>`
			);
		}
		parts.push(`<line x1="${shape.leadOut}" y1="25" x2="70" y2="25" stroke="${outColour}" stroke-width="2"/>`);
	} else {
		ys.forEach((py, i) => {
			parts.push(
				`<line x1="0" y1="${py}" x2="14" y2="${py}" stroke="${wireColours[i] ?? theme.muted}" stroke-width="2"/>`
			);
		});
		parts.push(
			`<rect x="14" y="4" width="36" height="42" rx="1" fill="${theme.body}" stroke="${theme.line}" stroke-width="2"/>`,
			`<text x="32" y="31" text-anchor="middle" fill="${
				theme.text
			}" font-family="${MONO}" font-size="15" font-weight="600">${esc(shape.iec)}</text>`
		);
		if (shape.iecBubble) {
			parts.push(
				`<circle cx="54" cy="25" r="4" fill="${theme.body}" stroke="${theme.line}" stroke-width="2"/>`,
				`<line x1="58" y1="25" x2="70" y2="25" stroke="${outColour}" stroke-width="2"/>`
			);
		} else {
			parts.push(`<line x1="50" y1="25" x2="70" y2="25" stroke="${outColour}" stroke-width="2"/>`);
		}
	}
	parts.push('</g>');
	return parts.join('');
}

export type CircuitSvgOptions = {
	standard?: Standard;
	palette?: Palette;
	/** Signal states, so the export can match what is on screen. */
	states?: Record<string, boolean>;
	/** Shown as the SVG title and, when set, printed along the bottom. */
	caption?: string;
	/**
	 * What to print in the output box. Left unset it shows the live value, or Q
	 * when there are no states; set it to label the output instead, which is what
	 * you want for a diagram in a document. A circuit with several outputs
	 * always prints their names, since a bare 0 or 1 would not say which is which.
	 */
	outputLabel?: string;
};

export function circuitToSvg(circuit: Circuit, options: CircuitSvgOptions = {}): string {
	const standard = options.standard ?? 'ansi';
	const palette = options.palette ?? 'colour';
	const theme = THEMES[palette];
	const states = options.states;
	const caption = options.caption ?? '';

	// Without states, or in print, wires are drawn as plain lines.
	const wireColour = (id: string | undefined): string => {
		if (!states || palette === 'mono') return palette === 'mono' ? theme.line : theme.muted;
		if (id === undefined || !(id in states)) return theme.muted;
		return states[id] ? theme.high : theme.low;
	};

	const parts: string[] = [];
	for (const wire of circuit.wires) {
		parts.push(
			`<path d="${wire.path}" fill="none" stroke="${wireColour(wire.from)}" stroke-width="2" stroke-linecap="round"/>`
		);
	}

	for (const node of circuit.nodes) {
		if (node.kind === 'gate') {
			parts.push(
				gateMarkup(
					node.op ?? 'and',
					node.x,
					node.y,
					standard,
					theme,
					node.children.map((child) => wireColour(child)),
					wireColour(node.id)
				)
			);
		} else {
			const on = states ? !!states[node.id] : false;
			const fill = palette === 'mono' ? theme.background : node.kind === 'const' ? '#0d0d0f' : on ? '#372' : '#a22';
			parts.push(
				`<rect x="${round(node.x)}" y="${round(node.y)}" width="${node.width}" height="${
					node.height
				}" rx="3" fill="${fill}" stroke="${theme.line}" stroke-width="2"/>`,
				`<text x="${round(node.x + node.width / 2)}" y="${round(node.y + 20)}" text-anchor="middle" fill="${
					theme.text
				}" font-family="${MONO}" font-size="15" font-weight="600">${esc(node.label)}</text>`
			);
		}
	}

	let rightEdge = circuit.width;
	for (const out of circuit.outputs) {
		const outOn = states ? !!states[out.rootId] : false;
		const outFill = palette === 'mono' ? theme.background : outOn ? '#372' : '#40191c';
		const outText = circuit.outputs.length > 1 ? out.name : options.outputLabel ?? (states ? (outOn ? '1' : '0') : 'Q');
		// The layout reserves a fixed box, which a label longer than a couple of
		// characters spills out of. Grow it to the right, so the wire still meets
		// its left edge where the layout put it.
		const outWidth = Math.max(out.width, outText.length * 9 + 16);
		rightEdge = Math.max(rightEdge, out.x + outWidth + 12);
		parts.push(
			`<g data-output="${esc(out.name)}">`,
			`<rect x="${round(out.x)}" y="${round(out.y)}" width="${round(outWidth)}" height="${
				out.height
			}" rx="3" fill="${outFill}" stroke="${theme.line}" stroke-width="2"/>`,
			`<text x="${round(out.x + outWidth / 2)}" y="${round(out.y + 20)}" text-anchor="middle" fill="${
				theme.text
			}" font-family="${MONO}" font-size="15" font-weight="600">${esc(outText)}</text>`,
			`</g>`
		);
	}

	const captionHeight = caption ? 30 : 0;
	if (caption) {
		parts.push(
			`<text x="${round(circuit.width / 2)}" y="${round(circuit.height + 20)}" text-anchor="middle" fill="${
				theme.muted
			}" font-family="${SANS}" font-size="14">${esc(caption)}</text>`
		);
	}

	return document_(
		rightEdge,
		circuit.height + captionHeight,
		caption || 'Logic circuit diagram',
		parts.join('\n'),
		theme
	);
}

export type TableSvgOptions = {
	palette?: Palette;
	caption?: string;
	/** Heading of the output column of a single output table; defaults to Q. */
	outputLabel?: string;
};

const CELL_W = 46;
const CELL_H = 30;

/** A single output table, or one with a column per output. */
export function truthTableToSvg(table: TruthTable | SystemTable, options: TableSvgOptions = {}): string {
	const palette = options.palette ?? 'colour';
	const theme = THEMES[palette];
	const caption = options.caption ?? '';
	const outputs = 'outputs' in table ? table.outputs : [{ name: options.outputLabel ?? 'Q', rows: table.rows }];
	const rowCount = outputs[0]?.rows.length ?? 0;

	// A name longer than a bit needs a wider column than a digit does.
	const cellWidth = (label: string) => Math.max(CELL_W, label.length * 9 + 16);
	const widths = [...table.variables.map(cellWidth), ...outputs.map((o) => cellWidth(o.name))];
	const edges = widths.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w], [0]);
	const centre = (column: number) => edges[column] + widths[column] / 2;
	const columns = widths.length;
	const width = Math.max(edges[columns], 120);
	const headerH = CELL_H + 4;
	const bodyH = rowCount * CELL_H;
	const captionH = caption ? 28 : 0;
	const height = headerH + bodyH + captionH + 8;

	const parts: string[] = [];
	// Header band.
	parts.push(
		`<rect x="0" y="0" width="${width}" height="${headerH}" fill="${palette === 'mono' ? '#eeeeee' : '#101012'}"/>`
	);
	[...table.variables, ...outputs.map((o) => o.name)].forEach((name, i) => {
		parts.push(
			`<text x="${centre(i)}" y="${headerH - 10}" text-anchor="middle" fill="${
				theme.text
			}" font-family="${MONO}" font-size="15" font-weight="600">${esc(name)}</text>`
		);
	});

	const bit = (value: boolean, x: number, y: number) =>
		`<text x="${x}" y="${y + 20}" text-anchor="middle" fill="${
			value ? theme.high : theme.low
		}" font-family="${MONO}" font-size="15">${value ? 1 : 0}</text>`;
	for (let row = 0; row < rowCount; row++) {
		const y = headerH + row * CELL_H;
		table.variables.forEach((_, i) => {
			parts.push(bit(!!(row & (1 << (table.variables.length - 1 - i))), centre(i), y));
		});
		outputs.forEach((o, i) => parts.push(bit(o.rows[row], centre(table.variables.length + i), y)));
	}

	// Grid lines, drawn after the values so they sit crisply on top.
	const grid = palette === 'mono' ? '#000000' : 'rgba(255,255,255,0.25)';
	for (let c = 1; c < columns; c++) {
		parts.push(
			`<line x1="${edges[c]}" y1="0" x2="${edges[c]}" y2="${headerH + bodyH}" stroke="${grid}" stroke-width="1"/>`
		);
	}
	for (let r = 0; r <= rowCount; r++) {
		parts.push(
			`<line x1="0" y1="${headerH + r * CELL_H}" x2="${width}" y2="${
				headerH + r * CELL_H
			}" stroke="${grid}" stroke-width="1"/>`
		);
	}
	parts.push(
		`<rect x="0.5" y="0.5" width="${width - 1}" height="${
			headerH + bodyH - 1
		}" fill="none" stroke="${grid}" stroke-width="1"/>`
	);

	if (caption) {
		parts.push(
			`<text x="${width / 2}" y="${headerH + bodyH + 20}" text-anchor="middle" fill="${
				theme.muted
			}" font-family="${SANS}" font-size="13">${esc(caption)}</text>`
		);
	}

	return document_(width, height, caption || 'Truth table', parts.join('\n'), theme);
}
