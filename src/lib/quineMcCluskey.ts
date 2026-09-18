// The Quine-McCluskey method, kept as the tables a textbook would show rather
// than the bare answer: every pass of the tabulation, the prime implicant
// chart, which primes are essential, and how the rest of the cover is chosen.
//
// The boolean engine already runs this algorithm to simplify expressions, but
// it only keeps the result. This module keeps the working, so a page can show
// the method step by step. The test suite checks that the primes found here
// are exactly the maximal implicants of the function and that the cover is
// never bigger than the engine's own.

import type { Notation } from './boolean.js';

/** A cube in the tabulation: fixed bits, a mask of the dashes, the minterms it covers. */
export type Cube = {
	bits: number;
	mask: number;
	/** The minterms and don't cares merged into this cube, ascending. */
	covers: number[];
	/** The binary with dashes, most significant bit first. */
	pattern: string;
	/** Number of 1s among the fixed bits, which is what the groups are keyed on. */
	ones: number;
	/** Whether the cube merged with another in the next pass. Unticked cubes are prime. */
	ticked: boolean;
};

/** One pass of the tabulation: the cubes with the same number of dashes, grouped by ones. */
export type Pass = {
	/** Number of dashes in every cube of this pass: 0 for the minterm list, 1 for pairs, and so on. */
	dashes: number;
	groups: { ones: number; cubes: Cube[] }[];
};

export type Chart = {
	/** The minterms that must be covered, ascending. Don't cares are not columns. */
	minterms: number[];
	/** One row per prime, in the order they were found. */
	rows: { cube: Cube; term: string; covers: boolean[]; essential: boolean }[];
};

export type Tabulation = {
	variables: string[];
	minterms: number[];
	dontCares: number[];
	passes: Pass[];
	primes: Cube[];
	chart: Chart;
	essential: Cube[];
	/** Minterms not covered by the essential primes, ascending. */
	remaining: number[];
	/** The primes that cover the remaining minterms, chosen by Petrick's method. */
	extra: Cube[];
	/** The full cover: essential primes first, then the extra ones. */
	chosen: Cube[];
	/** Every minimal cover of the remaining minterms, so the page can show the alternatives. */
	alternatives: Cube[][];
	text: string;
};

export const MAX_TABULATION_VARS = 5;

const NOTATIONS: Record<Notation, { and: string; or: string; not: (v: string) => string }> = {
	math: { and: '∧', or: ' ∨ ', not: (v) => `¬${v}` },
	engineering: { and: '', or: ' + ', not: (v) => `${v}'` },
	programming: { and: ' & ', or: ' | ', not: (v) => `!${v}` }
};

const countOnes = (value: number) => value.toString(2).replace(/0/g, '').length;

/** The cube's binary with a dash wherever the mask says the bit is free. */
function patternOf(bits: number, mask: number, varCount: number): string {
	return Array.from({ length: varCount }, (_, i) => {
		const bit = 1 << (varCount - 1 - i);
		return mask & bit ? '-' : bits & bit ? '1' : '0';
	}).join('');
}

/** A cube as a product term: the fixed bits as literals, or 1 for the whole map. */
export function cubeTerm(cube: Cube, variables: string[], notation: Notation = 'engineering'): string {
	const style = NOTATIONS[notation];
	const literals: string[] = [];
	variables.forEach((name, i) => {
		const bit = 1 << (variables.length - 1 - i);
		if (cube.mask & bit) return;
		literals.push(cube.bits & bit ? name : style.not(name));
	});
	return literals.join(style.and) || '1';
}

/** Literal count of a cover, the tiebreak between covers with the same number of terms. */
const literalCount = (cover: Cube[]) =>
	cover.reduce((total, cube) => total + (cube.pattern.length - cube.pattern.split('-').length + 1), 0);

/** The engine's own way to finish a cover: take whichever prime covers most of what is left. */
function greedy(rows: Cube[], remaining: number[]): Cube[] {
	const left = new Set(remaining);
	const chosen: Cube[] = [];
	while (left.size) {
		let best: Cube | null = null;
		let bestCount = 0;
		for (const row of rows) {
			if (chosen.includes(row)) continue;
			const count = row.covers.filter((m) => left.has(m)).length;
			if (count > bestCount) {
				best = row;
				bestCount = count;
			}
		}
		if (!best) break;
		chosen.push(best);
		best.covers.forEach((m) => left.delete(m));
	}
	// Drop anything a later choice made redundant.
	for (let i = chosen.length - 1; i >= 0; i--) {
		const without = new Set(chosen.filter((_, j) => j !== i).flatMap((c) => c.covers));
		if (remaining.every((m) => without.has(m))) chosen.splice(i, 1);
	}
	return chosen;
}

/** How many partial products Petrick's method may hold before it gives up on being exhaustive. */
const PETRICK_LIMIT = 4000;

/**
 * Petrick's method: the product, over every leftover minterm, of the sum of
 * the primes that cover it, multiplied out. Each surviving product is a
 * cover, and the smallest ones are the answers. Covers with a redundant
 * prime are dropped as they arise (X + XY = X), which keeps the expansion
 * small for anything a page would show; past the limit only the shortest
 * products are kept, and the greedy cover is used if it turns out shorter.
 */
function petrick(rows: Cube[], remaining: number[]): Cube[][] {
	const key = (product: Cube[]) =>
		product
			.map((c) => c.pattern)
			.sort()
			.join(',');
	let products: Cube[][] = [[]];
	// Minterms with the fewest options first, so the expansion stays narrow.
	const order = [...remaining].sort(
		(a, b) => rows.filter((r) => r.covers.includes(a)).length - rows.filter((r) => r.covers.includes(b)).length
	);
	for (const m of order) {
		const options = rows.filter((row) => row.covers.includes(m));
		const next = new Map<string, Cube[]>();
		for (const product of products) {
			if (product.some((cube) => cube.covers.includes(m))) {
				// Already covered by something in the product: X + XY = X.
				next.set(key(product), product);
				continue;
			}
			for (const option of options) {
				const grown = [...product, option];
				next.set(key(grown), grown);
			}
		}
		products = [...next.values()];
		if (products.length > PETRICK_LIMIT) {
			const shortest = Math.min(...products.map((p) => p.length));
			products = products.filter((p) => p.length === shortest);
		}
	}
	// A product that contains another product is not minimal.
	products = products.filter(
		(a) => !products.some((b) => b !== a && b.length < a.length && b.every((c) => a.includes(c)))
	);
	const sorted = products.sort((a, b) => a.length - b.length || literalCount(a) - literalCount(b));
	const best = sorted[0] ?? [];
	const fallback = greedy(rows, remaining);
	if (
		fallback.length < best.length ||
		(fallback.length === best.length && literalCount(fallback) < literalCount(best))
	) {
		return [fallback];
	}
	return sorted.filter((p) => p.length === best.length && literalCount(p) === literalCount(best));
}

/**
 * Runs the whole method on a function given by its minterm and don't care
 * indices, keeping every intermediate table.
 */
export function tabulate(
	minterms: number[],
	dontCares: number[],
	variables: string[],
	notation: Notation = 'engineering'
): Tabulation {
	const varCount = variables.length;
	if (varCount < 1 || varCount > MAX_TABULATION_VARS) {
		throw new Error(`The tabulation shows 1 to ${MAX_TABULATION_VARS} variables`);
	}
	const limit = 1 << varCount;
	const clean = (list: number[]) =>
		[...new Set(list.filter((m) => Number.isInteger(m) && m >= 0 && m < limit))].sort((a, b) => a - b);
	const cares = clean(minterms);
	const dcs = clean(dontCares).filter((m) => !cares.includes(m));
	const seeds = [...new Set([...cares, ...dcs])].sort((a, b) => a - b);

	const makeCube = (bits: number, mask: number, covers: number[]): Cube => ({
		bits,
		mask,
		covers: [...covers].sort((a, b) => a - b),
		pattern: patternOf(bits, mask, varCount),
		ones: countOnes(bits & ~mask),
		ticked: false
	});

	const passes: Pass[] = [];
	const primes: Cube[] = [];
	let current = seeds.map((m) => makeCube(m, 0, [m]));
	let dashes = 0;
	while (current.length) {
		const next = new Map<string, Cube>();
		// Only cubes in adjacent groups can differ in exactly one fixed bit, and
		// the group with fewer ones must hold the 0: that is the usual shortcut,
		// and it comes out identical to trying every pair.
		for (let i = 0; i < current.length; i++) {
			for (let j = i + 1; j < current.length; j++) {
				const a = current[i];
				const b = current[j];
				if (a.mask !== b.mask) continue;
				const diff = a.bits ^ b.bits;
				if (diff === 0 || (diff & (diff - 1)) !== 0) continue;
				a.ticked = true;
				b.ticked = true;
				const mask = a.mask | diff;
				const bits = a.bits & ~mask;
				const key = `${bits}/${mask}`;
				if (!next.has(key)) next.set(key, makeCube(bits, mask, [...new Set([...a.covers, ...b.covers])]));
			}
		}
		const byOnes = new Map<number, Cube[]>();
		for (const cube of current) {
			const group = byOnes.get(cube.ones) ?? [];
			group.push(cube);
			byOnes.set(cube.ones, group);
		}
		passes.push({
			dashes,
			groups: [...byOnes.entries()].sort((a, b) => a[0] - b[0]).map(([ones, cubes]) => ({ ones, cubes }))
		});
		for (const cube of current) if (!cube.ticked) primes.push(cube);
		current = [...next.values()].sort((a, b) => a.ones - b.ones || a.covers[0] - b.covers[0]);
		dashes++;
	}

	// The chart: rows are primes, columns are the minterms that matter.
	const rows = primes.map((cube) => ({
		cube,
		term: cubeTerm(cube, variables, notation),
		covers: cares.map((m) => cube.covers.includes(m)),
		essential: false
	}));
	const essential: Cube[] = [];
	cares.forEach((_, column) => {
		const covering = rows.filter((row) => row.covers[column]);
		if (covering.length === 1) {
			covering[0].essential = true;
			if (!essential.includes(covering[0].cube)) essential.push(covering[0].cube);
		}
	});
	const coveredByEssential = new Set(essential.flatMap((cube) => cube.covers));
	const remaining = cares.filter((m) => !coveredByEssential.has(m));
	const candidates = primes.filter(
		(cube) => !essential.includes(cube) && cube.covers.some((m) => remaining.includes(m))
	);
	const alternatives = remaining.length ? petrick(candidates, remaining) : [];
	const extra = alternatives[0] ?? [];
	const chosen = [...essential, ...extra];
	const style = NOTATIONS[notation];

	return {
		variables,
		minterms: cares,
		dontCares: dcs,
		passes,
		primes,
		chart: { minterms: cares, rows },
		essential,
		remaining,
		extra,
		chosen,
		alternatives,
		text: chosen.length ? chosen.map((cube) => cubeTerm(cube, variables, notation)).join(style.or) : '0'
	};
}

/** Reads "0, 1, 5, 7" or "0 1 5 7" into a list of indices; anything else is ignored. */
export function parseIndices(text: string): number[] {
	return text
		.split(/[\s,;]+/)
		.filter(Boolean)
		.map(Number)
		.filter((n) => Number.isInteger(n) && n >= 0);
}

/** The letters a page labels its variables with, most significant first. */
export const variableNames = (count: number) => Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

/** True when a cube is an implicant: every cell it spans is a 1 or a don't care. */
export function isImplicant(cube: Cube, minterms: number[], dontCares: number[], varCount: number): boolean {
	const allowed = new Set([...minterms, ...dontCares]);
	for (let cell = 0; cell < 1 << varCount; cell++) {
		if ((cell & ~cube.mask) === cube.bits && !allowed.has(cell)) return false;
	}
	return true;
}
