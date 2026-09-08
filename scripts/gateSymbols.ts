// The single-gate symbols, in both standards.
//
// Shared by the reference cards and the symbols chart. These cannot be drawn by
// building a circuit from the gate's expression the way the other diagrams are:
// that would render a NAND as an AND wired into a NOT, when the whole point of
// a symbols chart is the single shape with a bubble on it.

import { shapes, inputYs } from '../src/lib/symbols.js';

/** One gate symbol as standalone SVG markup, black on white for printing. */
export function symbolSvg(slug: string, standard: 'ansi' | 'iec'): string {
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
