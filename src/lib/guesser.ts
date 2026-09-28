// The engine behind the mystery box: a hidden boolean function of two to four
// switches and one lamp. The player flips switches, watches the lamp, and then
// picks which of four expressions the box computes.
//
// Everything is a pure function of (seed, size), so the daily puzzle needs no
// server: today's date is the seed, and everyone gets the same box.

import { rng, pick, int, shuffle } from './course/random.js';
import { simplify, truthTable, type Ast } from './boolean.js';

export const GUESSER_SIZES = [2, 3, 4] as const;
export type GuesserSize = (typeof GUESSER_SIZES)[number];

/** What a wrong pick costs, in switch flips: a wrong pick hurts more than a look. */
export const WRONG_PENALTY = 3;

export type Puzzle = {
	size: GuesserSize;
	variables: string[];
	/** The hidden output for every input row, in counting order, a on top. */
	rows: boolean[];
};

const NAMES = ['a', 'b', 'c', 'd'];

/** Names of the variables in a puzzle of this size. */
export const variablesFor = (size: number) => NAMES.slice(0, size);

/**
 * A random expression that uses every one of the variables, built by joining
 * shuffled leaves with random gates and negating some of them.
 */
function randomAst(random: () => number, variables: string[]): Ast {
	const leaves: Ast[] = variables.map((name) => {
		const leaf: Ast = { t: 'var', name };
		return random() < 0.3 ? { t: 'not', a: leaf } : leaf;
	});
	// Shuffle so the variables do not always join in alphabetical order.
	for (let i = leaves.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[leaves[i], leaves[j]] = [leaves[j], leaves[i]];
	}
	while (leaves.length > 1) {
		const i = int(random, 0, leaves.length - 2);
		const [a, b] = leaves.splice(i, 2);
		const op = pick(random, ['and', 'or', 'xor'] as const);
		let node: Ast = { t: op, a, b };
		if (random() < 0.2) node = { t: 'not', a: node };
		leaves.splice(i, 0, node);
	}
	return leaves[0];
}

/** True when flipping this variable changes at least one row. */
function dependsOn(rows: boolean[], size: number, bit: number): boolean {
	const mask = 1 << (size - 1 - bit);
	return rows.some((value, i) => value !== rows[i ^ mask]);
}

/**
 * The puzzle for a seed. A function is thrown back when it ignores one of its
 * switches (a three switch box that is really about two would be unfair) or is
 * a constant. The seed drives a fresh generator each attempt, so the same seed
 * always lands on the same puzzle.
 */
export function puzzleFor(seed: number, size: GuesserSize): Puzzle {
	const variables = variablesFor(size);
	const random = rng(seed * 31 + size);
	for (let attempt = 0; attempt < 500; attempt++) {
		const { rows } = truthTable(randomAst(random, variables), variables);
		if (variables.every((_, bit) => dependsOn(rows, size, bit))) return { size, variables, rows };
	}
	// Unreachable in practice, but a fixed puzzle beats an exception: all switches XORed.
	return { size, variables, rows: Array.from({ length: 1 << size }, (_, i) => bitCount(i) % 2 === 1) };
}

const bitCount = (n: number) => n.toString(2).replace(/0/g, '').length;

/** Days since 1 January 2026 in UTC, so the whole world shares one box a day. */
export function dayNumber(date: Date): number {
	return Math.floor(
		(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(2026, 0, 1)) / 86400000
	);
}

export type Option = { text: string; correct: boolean };

/** The expression for a set of rows, in one style, so no option looks different from the rest. */
const describe = (variables: string[], rows: boolean[]) => simplify({ variables, rows }, 'programming').text;

/**
 * Four expressions to choose from: the real one and three near misses. A near
 * miss is the real function with one row flipped (two, if the puzzle is too
 * small to find three that way), which is close enough that a couple of flips
 * cannot tell them apart by eye but a well chosen setting can. All four are
 * written as a minimal sum of products so that the style gives nothing away.
 */
export function optionsFor(puzzle: Puzzle, seed: number): Option[] {
	const random = rng(seed * 17 + puzzle.size + 1000);
	const correct = describe(puzzle.variables, puzzle.rows);
	const seen = new Set([correct]);
	const options: Option[] = [{ text: correct, correct: true }];
	for (let attempt = 0; attempt < 400 && options.length < 4; attempt++) {
		const rows = [...puzzle.rows];
		const flips = attempt < 60 ? 1 : 2;
		for (const row of shuffle(random, rows.map((_, i) => i)).slice(0, flips)) rows[row] = !rows[row];
		if (rows.every((v) => v === rows[0])) continue;
		const text = describe(puzzle.variables, rows);
		if (seen.has(text)) continue;
		seen.add(text);
		options.push({ text, correct: false });
	}
	return shuffle(random, options);
}

/** Lower is better: every flip counts one, and every wrong pick counts three. */
export const scoreOf = (flips: number, wrongPicks: number) => flips + WRONG_PENALTY * wrongPicks;

/** The line a player can paste: how they did, with no spoilers. */
export function shareText(opts: { label: string; size: number; flips: number; wrongPicks: number }): string {
	const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	return [
		`Mystery box ${opts.label} (${opts.size} switches)`,
		`${'🔘'.repeat(Math.min(opts.flips, 20))}${opts.flips > 20 ? '…' : ''}${'❌'.repeat(opts.wrongPicks)}`,
		`Score ${scoreOf(opts.flips, opts.wrongPicks)}: ${count(opts.flips, 'flip', 'flips')}, ${count(opts.wrongPicks, 'wrong pick', 'wrong picks')}`
	].join('\n');
}
