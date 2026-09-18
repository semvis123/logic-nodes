// The tabulation on the Quine-McCluskey page is checked against the
// definitions: every prime it lists is an implicant that cannot be grown, no
// maximal implicant is missing, and the cover it picks is never larger than
// the one the engine's own minimiser finds.

import { expect, test } from '@playwright/test';
import { tabulate, isImplicant, cubeTerm, parseIndices, variableNames, type Cube } from '../src/lib/quineMcCluskey.js';
import { minimise, parseExpression, evaluate } from '../src/lib/boolean.js';

/** A seeded generator, so a failure names a case that can be rerun. */
function random(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

function randomFunction(rand: () => number, varCount: number) {
	const minterms: number[] = [];
	const dontCares: number[] = [];
	for (let cell = 0; cell < 1 << varCount; cell++) {
		const r = rand();
		if (r < 0.4) minterms.push(cell);
		else if (r < 0.5) dontCares.push(cell);
	}
	return { minterms, dontCares };
}

/** Every implicant that cannot be widened along any axis, by brute force. */
function maximalImplicants(minterms: number[], dontCares: number[], varCount: number): string[] {
	const found: string[] = [];
	const cells = 1 << varCount;
	for (let mask = 0; mask < cells; mask++) {
		for (let bits = 0; bits < cells; bits++) {
			if (bits & mask) continue;
			const cube: Cube = { bits, mask, covers: [], pattern: '', ones: 0, ticked: false };
			if (!isImplicant(cube, minterms, dontCares, varCount)) continue;
			// Maximal when freeing any fixed bit stops it being an implicant.
			let maximal = true;
			for (let bit = 1; bit < cells; bit <<= 1) {
				if (mask & bit) continue;
				const wider: Cube = { ...cube, mask: mask | bit, bits: bits & ~bit };
				if (isImplicant(wider, minterms, dontCares, varCount)) maximal = false;
			}
			if (maximal) found.push(`${bits}/${mask}`);
		}
	}
	return found.sort();
}

test.describe('Quine-McCluskey', () => {
	test('the primes are exactly the maximal implicants', () => {
		const rand = random(7);
		for (let round = 0; round < 60; round++) {
			const varCount = 2 + Math.floor(rand() * 4);
			const { minterms, dontCares } = randomFunction(rand, varCount);
			if (!minterms.length) continue;
			const result = tabulate(minterms, dontCares, variableNames(varCount));
			const primes = result.primes.map((p) => `${p.bits}/${p.mask}`).sort();
			expect(primes, `Σm(${minterms}) + d(${dontCares})`).toEqual(maximalImplicants(minterms, dontCares, varCount));
			for (const prime of result.primes) {
				expect(isImplicant(prime, minterms, dontCares, varCount)).toBe(true);
				// A cube's cover list is every cell it spans.
				expect(prime.covers.length).toBe(1 << (prime.pattern.split('-').length - 1));
			}
		}
	});

	test('the cover covers every minterm, uses only primes, and is no bigger than the engine finds', () => {
		const rand = random(11);
		for (let round = 0; round < 80; round++) {
			const varCount = 2 + Math.floor(rand() * 4);
			const { minterms, dontCares } = randomFunction(rand, varCount);
			if (!minterms.length) continue;
			const result = tabulate(minterms, dontCares, variableNames(varCount));
			const covered = new Set(result.chosen.flatMap((cube) => cube.covers));
			for (const m of minterms) expect(covered.has(m), `minterm ${m} of Σm(${minterms})`).toBe(true);
			for (const cube of result.chosen) expect(result.primes).toContain(cube);
			// No chosen prime is redundant.
			for (const cube of result.chosen) {
				const without = new Set(result.chosen.filter((c) => c !== cube).flatMap((c) => c.covers));
				expect(
					minterms.every((m) => without.has(m)),
					`${cube.pattern} is redundant`
				).toBe(false);
			}
			const engine = minimise(minterms, dontCares, varCount);
			expect(result.chosen.length, `Σm(${minterms}) + d(${dontCares})`).toBeLessThanOrEqual(engine.length);
			// Every alternative Petrick lists is the same size and also a cover.
			for (const alternative of result.alternatives) {
				expect(alternative.length).toBe(result.extra.length);
				const all = new Set([...result.essential, ...alternative].flatMap((c) => c.covers));
				for (const m of minterms) expect(all.has(m)).toBe(true);
			}
		}
	});

	test('the final expression computes the function', () => {
		const rand = random(3);
		for (let round = 0; round < 40; round++) {
			const varCount = 1 + Math.floor(rand() * 5);
			const { minterms, dontCares } = randomFunction(rand, varCount);
			const variables = variableNames(varCount);
			const result = tabulate(minterms, dontCares, variables, 'programming');
			const ast = parseExpression(result.text);
			for (let cell = 0; cell < 1 << varCount; cell++) {
				if (dontCares.includes(cell)) continue;
				const values: Record<string, boolean> = {};
				variables.forEach((name, i) => (values[name] = !!(cell & (1 << (varCount - 1 - i)))));
				expect(evaluate(ast, values), `cell ${cell} of ${result.text}`).toBe(minterms.includes(cell));
			}
		}
	});

	test('essential primes are the only cover of some minterm', () => {
		const result = tabulate([4, 8, 10, 11, 12, 15], [9, 14], variableNames(4));
		for (const cube of result.essential) {
			const alone = result.minterms.some(
				(m) => cube.covers.includes(m) && result.primes.filter((p) => p.covers.includes(m)).length === 1
			);
			expect(alone, cube.pattern).toBe(true);
		}
		// The textbook answer for this function.
		expect(result.primes.map((p) => p.pattern).sort()).toEqual(['-100', '1--0', '1-1-', '10--'].sort());
		expect(result.chosen.length).toBe(3);
	});

	test('the passes are grouped by ones, and a ticked cube reappears merged in the next pass', () => {
		const result = tabulate([0, 1, 2, 5, 6, 7, 8, 9, 10, 14], [], variableNames(4));
		result.passes.forEach((pass, index) => {
			expect(pass.dashes).toBe(index);
			pass.groups.forEach((group) => {
				for (const cube of group.cubes) {
					expect(cube.ones).toBe(group.ones);
					expect(cube.pattern.split('-').length - 1).toBe(index);
					if (cube.ticked) {
						const next = result.passes[index + 1];
						expect(next, `${cube.pattern} is ticked but there is no next pass`).toBeTruthy();
						const merged = next.groups
							.flatMap((g) => g.cubes)
							.some((c) => cube.covers.every((m) => c.covers.includes(m)));
						expect(merged, cube.pattern).toBe(true);
					} else {
						expect(result.primes).toContain(cube);
					}
				}
			});
		});
	});

	test('terms, parsing and names', () => {
		const variables = variableNames(3);
		const cube: Cube = { bits: 0b100, mask: 0b010, covers: [4, 6], pattern: '1-0', ones: 1, ticked: false };
		expect(cubeTerm(cube, variables, 'engineering')).toBe("AC'");
		expect(cubeTerm(cube, variables, 'math')).toBe('A∧¬C');
		expect(cubeTerm({ ...cube, mask: 0b111, bits: 0 }, variables)).toBe('1');
		expect(parseIndices('0, 1 5;7 x')).toEqual([0, 1, 5, 7]);
		expect(variableNames(4)).toEqual(['A', 'B', 'C', 'D']);
		// Out of range and repeated indices are dropped, and a don't care that is also a minterm counts once.
		const result = tabulate([1, 1, 9], [1, 2], variableNames(3));
		expect(result.minterms).toEqual([1]);
		expect(result.dontCares).toEqual([2]);
	});
});
