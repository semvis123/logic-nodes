// The seven-segment decoder: which bars light for each digit, and the four
// input bits that select the digit. Each segment's expression on the page is
// derived from these patterns by the Karnaugh map engine, with the six unused
// codes 10 to 15 as don't cares, and the test suite checks that every derived
// expression lights exactly the bars listed here for every digit.

import { karnaughMapFromCells, parseExpression, evaluate, type CellValue, type Ast } from './boolean.js';

export const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
export type SegmentName = typeof segmentNames[number];

/** The four input bits, most significant first: 8, 4, 2, 1. */
export const inputVariables = ['w', 'x', 'y', 'z'];
export const inputLabels = ['B3', 'B2', 'B1', 'B0'];

/**
 * Which segments show each digit. The "textbook" patterns: 6 has its top bar
 * and 9 has its bottom bar, unlike some decoder chips which leave them off.
 */
export const digitSegments: string[] = [
	'abcdef', // 0
	'bc', // 1
	'abdeg', // 2
	'abcdg', // 3
	'bcfg', // 4
	'acdfg', // 5
	'acdefg', // 6
	'abc', // 7
	'abcdefg', // 8
	'abcdfg' // 9
];

/** The 16 cells of one segment's map: lit, unlit, or don't care above 9. */
export function segmentCells(segment: SegmentName): CellValue[] {
	return Array.from({ length: 16 }, (_, code) => (code > 9 ? 'x' : digitSegments[code].includes(segment) ? 1 : 0));
}

export type SegmentFunction = {
	segment: SegmentName;
	/** Minimal sum of products, in math notation. */
	text: string;
	ast: Ast;
	groups: number;
	cells: CellValue[];
};

/** One minimal expression per segment, from the map with don't cares. */
export function segmentFunctions(): SegmentFunction[] {
	return segmentNames.map((segment) => {
		const cells = segmentCells(segment);
		const map = karnaughMapFromCells(inputVariables, cells);
		return { segment, text: map.text, ast: parseExpression(map.text), groups: map.groups.length, cells };
	});
}

/** The bits of a code as the engine's variables. */
export function codeBits(code: number): Record<string, boolean> {
	return Object.fromEntries(inputVariables.map((name, i) => [name, !!(code & (8 >> i))]));
}

/** Which segments the derived circuit lights for a code, including 10 to 15. */
export function litSegments(functions: SegmentFunction[], code: number): Set<SegmentName> {
	const bits = codeBits(code);
	return new Set(functions.filter((f) => evaluate(f.ast, bits)).map((f) => f.segment));
}
