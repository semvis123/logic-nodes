// The course writes expressions the way a textbook does: a bar over a letter
// for NOT and a dot between the letters of an AND term, so a·b̄·c reads as
// "a and not b and c". The engine prints engineering notation (ab'c + a'b),
// so everything here converts from that, and no lesson formats a term by hand.

import type { Cube } from '../quineMcCluskey.js';

/** The combining overline that puts a bar on the letter before it. */
export const BAR = '̅';

/** One variable as it appears in a term: plain when it is 1, barred when it is 0. */
export const literal = (name: string, high: boolean) => (high ? name : `${name}${BAR}`);

/** `ab'c + a'b` in engineering notation becomes `a·b̄·c + ā·b`. Constants pass through. */
export function overbar(engineering: string): string {
	return engineering
		.split(' + ')
		.map((term) => {
			const literals = term.replace(/[()]/g, '').match(/[a-zA-Z]'?|[01]/g) ?? [];
			return literals.map((l) => (l.endsWith("'") ? `${l[0]}${BAR}` : l)).join('·');
		})
		.join(' + ');
}

/** The minterm for row `index` of a table over `variables`, most significant variable first. */
export function mintermText(index: number, variables: string[]): string {
	return variables.map((name, i) => literal(name, !!(index & (1 << (variables.length - 1 - i))))).join('·');
}

/** A tabulation pattern such as `0-1` as a term: the dashes drop out, and no letters left means 1. */
export function patternText(pattern: string, variables: string[]): string {
	const literals = [...pattern]
		.map((bit, i) => (bit === '-' ? '' : literal(variables[i], bit === '1')))
		.filter(Boolean);
	return literals.join('·') || '1';
}

/** The binary-with-dashes pattern of a cube from the simplifier or the tabulation. */
export function cubePattern(cube: Pick<Cube, 'bits' | 'mask'>, varCount: number): string {
	return Array.from({ length: varCount }, (_, i) => {
		const bit = 1 << (varCount - 1 - i);
		return cube.mask & bit ? '-' : cube.bits & bit ? '1' : '0';
	}).join('');
}
