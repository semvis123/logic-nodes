// The engine behind the boolean function guesser: a hidden function of two to
// four variables, picked from a seed, that the player learns about one truth
// table row at a time.
//
// Everything is a pure function of (seed, size), so the daily puzzle needs no
// server: today's date is the seed, and everyone gets the same function.

import { rng, pick, int } from './course/random.js';
import {
	BooleanError,
	format,
	parseExpression,
	truthTable,
	type Ast
} from './boolean.js';

export const GUESSER_SIZES = [2, 3, 4] as const;
export type GuesserSize = (typeof GUESSER_SIZES)[number];

/** How many wrong guesses a player gets before the answer is shown. */
export const MAX_GUESSES = 6;

export type Puzzle = {
	size: GuesserSize;
	variables: string[];
	/** The hidden output for every input row, in counting order, a on top. */
	rows: boolean[];
	/** One expression that produces those rows, shown when the player gives up. */
	answer: string;
};

const NAMES = ['a', 'b', 'c', 'd'];

/** Names of the variables in a puzzle of this size. */
export const variablesFor = (size: number) => NAMES.slice(0, size);

/**
 * A random expression that uses every one of the variables, built by joining
 * shuffled leaves with random gates and negating some of them. Twice the leaf
 * count is enough to reach a good spread of functions without producing
 * anything a player could not type in a line.
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
 * variables (a three variable puzzle that is really about two would be unfair)
 * or is a constant. The seed drives a fresh generator each attempt, so the
 * same seed always lands on the same puzzle.
 */
export function puzzleFor(seed: number, size: GuesserSize): Puzzle {
	const variables = variablesFor(size);
	const random = rng(seed * 31 + size);
	for (let attempt = 0; attempt < 500; attempt++) {
		const ast = randomAst(random, variables);
		const { rows } = truthTable(ast, variables);
		if (!variables.every((_, bit) => dependsOn(rows, size, bit))) continue;
		return { size, variables, rows, answer: format(ast, 'programming') };
	}
	// Unreachable in practice, but a fixed puzzle beats an exception.
	const ast = parseExpression(variables.join(' ^ '));
	return { size, variables, rows: truthTable(ast, variables).rows, answer: variables.join(' ^ ') };
}

/** Days since 1 January 2026 in UTC, so the whole world shares one puzzle a day. */
export function dayNumber(date: Date): number {
	return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(2026, 0, 1)) / 86400000);
}

export type GuessResult =
	| { kind: 'invalid'; message: string }
	| { kind: 'correct' }
	| { kind: 'wrong'; matching: number; total: number };

/**
 * Marks a typed guess. It is compared by truth table, so `a&b` and `b & a` are
 * the same answer. A wrong guess reports only how many of the rows it gets
 * right, not which: naming the rows would give the whole table away, since a
 * row that is wrong is simply the opposite of what the guess said.
 */
export function checkGuess(puzzle: Puzzle, text: string): GuessResult {
	let ast: Ast;
	try {
		ast = parseExpression(text);
	} catch (error) {
		return { kind: 'invalid', message: error instanceof BooleanError ? error.message : 'That is not an expression' };
	}
	const stray = [...variablesIn(ast)].filter((name) => !puzzle.variables.includes(name));
	if (stray.length) {
		return {
			kind: 'invalid',
			message: `Only ${puzzle.variables.join(', ')} are allowed here, not ${stray.join(', ')}`
		};
	}
	const guess = truthTable(ast, puzzle.variables).rows;
	const matching = guess.filter((value, i) => value === puzzle.rows[i]).length;
	if (matching === puzzle.rows.length) return { kind: 'correct' };
	return { kind: 'wrong', matching, total: puzzle.rows.length };
}

function variablesIn(ast: Ast): Set<string> {
	const found = new Set<string>();
	const walk = (n: Ast) => {
		if (n.t === 'var') found.add(n.name);
		else if (n.t === 'not') walk(n.a);
		else if (n.t !== 'const') {
			walk(n.a);
			walk(n.b);
		}
	};
	walk(ast);
	return found;
}

/** The input row `index` as text, like "a=1 b=0 c=1". */
export function rowLabel(puzzle: Puzzle, index: number): string {
	return puzzle.variables
		.map((name, bit) => `${name}=${(index >> (puzzle.size - 1 - bit)) & 1}`)
		.join(' ');
}

/** How many functions are still possible once these rows are known: the rest are free. */
export function remainingFunctions(puzzle: Puzzle, revealed: number[]): number {
	return 2 ** (puzzle.rows.length - revealed.length);
}

/** The line a player can paste: how they did, with no spoilers. */
export function shareText(opts: {
	label: string;
	size: number;
	probes: number;
	guesses: number;
	won: boolean;
}): string {
	const rows = 1 << opts.size;
	const probes = '🟦'.repeat(opts.probes) + '⬜'.repeat(rows - opts.probes);
	const wrong = opts.guesses - (opts.won ? 1 : 0);
	const marks = '🟥'.repeat(wrong) + (opts.won ? '🟩' : '');
	const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	return [
		`Boolean function guesser ${opts.label} (${opts.size} variables)`,
		probes,
		`${marks} ${opts.won ? 'solved' : 'not solved'}: ${count(opts.guesses, 'guess', 'guesses')}, ${count(opts.probes, 'probe', 'probes')}`
	].join('\n');
}
