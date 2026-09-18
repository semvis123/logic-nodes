// Stage 4: making circuits smaller. Every answer here is computed by the same
// engines as the sum of products calculator, the Karnaugh map solver and the
// Quine-McCluskey page, and written in the course's bar notation (a·b̄·c).

import {
	canonicalForms,
	grayCode,
	karnaughMapFromCells,
	minimise,
	simplify,
	type CellValue,
	type TruthTable
} from '../../boolean.js';
import { cubeTerm, tabulate } from '../../quineMcCluskey.js';
import { BAR, cubePattern, mintermText, overbar, patternText } from '../notation.js';
import { assemble, bin, int, pick, shuffle } from '../random.js';
import type { CourseQuestion, Random, StageMeta } from '../types.js';

const NAMES = ['a', 'b', 'c', 'd'];
const names = (n: number) => NAMES.slice(0, n);
const popcount = (v: number) => v.toString(2).replace(/0/g, '').length;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const ms = (list: number[]) => list.map((m) => `m${m}`).join(', ');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const tableOf = (variables: string[], ones: number[]): TruthTable => ({
	variables,
	rows: range(1 << variables.length).map((i) => ones.includes(i))
});

const cellsOf = (n: number, ones: number[], xs: number[] = []): CellValue[] =>
	range(1 << n).map((i) => (ones.includes(i) ? 1 : xs.includes(i) ? 'x' : 0));

/** The minimal sum of products for a map, in bar notation. */
const minimal = (variables: string[], cells: CellValue[]) =>
	overbar(karnaughMapFromCells(variables, cells, 'engineering').text);

const canonical = (variables: string[], ones: number[]) =>
	overbar(canonicalForms(tableOf(variables, ones), 'engineering').canonicalSop);

/** Flips the bar on the first letter: a wrong answer that looks right. */
const flipFirstBar = (text: string) =>
	text.replace(/^([a-d])(̅?)/, (_, letter: string, bar: string) => (bar ? letter : letter + BAR));

/** `a = 1, b = 0, c = 1` for a row of the table. */
const assignments = (index: number, variables: string[]) =>
	variables.map((v, i) => `${v} = ${(index >> (variables.length - 1 - i)) & 1}`).join(', ');

/** Every mask with `dropped` of the n bits set: the ways a loop can drop that many inputs. */
const masksWith = (n: number, dropped: number) => range(1 << n).filter((m) => popcount(m) === dropped);

/** The cells of a loop: those matching `fixed` on every bit outside `mask`. */
const cube = (n: number, mask: number, fixed: number) => range(1 << n).filter((i) => (i & ~mask) === fixed);

/** Which inputs change across a set of cells and which stay fixed, with their values. */
function across(cells: number[], variables: string[]) {
	const n = variables.length;
	const or = cells.reduce((acc, c) => acc | c, 0);
	const and = cells.reduce((acc, c) => acc & c, (1 << n) - 1);
	const changing = variables.filter((_, i) => or & ~and & (1 << (n - 1 - i)));
	const fixed = variables
		.filter((_, i) => !(or & ~and & (1 << (n - 1 - i))))
		.map((v) => `${v} = ${and & (1 << (n - 1 - variables.indexOf(v))) ? 1 : 0}`);
	return { changing, fixed };
}

/** True when the cells are exactly one loop: the simplifier covers them with a single term of that size. */
const isLoop = (cells: number[], n: number) => {
	const found = minimise(cells, [], n);
	return found.length === 1 && found[0].covers.length === cells.length;
};

// --- lesson 1: from truth table to expression -------------------------------

const writeMinterm = (random: Random): CourseQuestion => {
	const n = int(random, 2, 3);
	const vars = names(n);
	const full = (1 << n) - 1;
	const row = int(random, 0, full);
	const right = mintermText(row, vars);
	const reversed = parseInt(bin(row, n).split('').reverse().join(''), 2);
	const distractors = [
		mintermText(full - row, vars),
		mintermText((row + 1) & full, vars),
		mintermText(reversed, vars),
		mintermText(row >> 1, vars.slice(0, n - 1))
	];
	const { options, answer } = assemble(random, right, distractors);
	const ones = vars.filter((_, i) => row & (1 << (n - 1 - i)));
	const zeros = vars.filter((v) => !ones.includes(v));
	const onesPart = ones.length
		? `${ones.join(' and ')} ${ones.length === 1 ? 'is' : 'are'} 1, so ${
				ones.length === 1 ? 'it stays' : 'they stay'
		  } plain`
		: 'no input is 1';
	const zerosPart = zeros.length
		? `${zeros.join(' and ')} ${zeros.length === 1 ? 'is' : 'are'} 0, so ${
				zeros.length === 1 ? 'it gets' : 'they get'
		  } a bar`
		: 'no input is 0, so nothing gets a bar';
	return {
		prompt: `In a truth table with inputs ${vars.join(', ')}, which minterm belongs to the row where ${assignments(
			row,
			vars
		)}?`,
		detail: assignments(row, vars),
		options,
		answer,
		hints: [
			'A minterm ANDs every input together. An input that is 1 on the row appears plain; one that is 0 gets a bar, so the NOT turns it into a 1 and the AND can fire.',
			`On this row ${onesPart}, and ${zerosPart}. Write the ${n} letters in order with a dot between them.`
		],
		explanation: `The row ${assignments(row, vars)} reads as ${bin(
			row,
			n
		)}, which is ${row}, so this is m${row}. Plain letters for the 1s and bars for the 0s give ${right}.`
	};
};

const andGateCount = (random: Random): CourseQuestion => {
	const n = int(random, 2, 4);
	const size = 1 << n;
	const k = int(random, 1, size - 1);
	const { options, answer } = assemble(random, String(k), [String(size), String(size - k), String(n), String(k + 1)]);
	return {
		prompt: `A truth table with ${n} inputs has ${k} ${k === 1 ? 'row' : 'rows'} where the output is 1 and ${
			size - k
		} where it is 0. How many AND gates does its canonical sum of products use?`,
		options,
		answer,
		hints: [
			'The canonical sum of products has one minterm for every row with output 1, and each minterm is one AND gate. Rows with output 0 add nothing.',
			`Count the rows that are 1: there ${
				k === 1 ? 'is 1 of them, so there is 1 minterm' : `are ${k} of them, so there are ${k} minterms`
			}.`
		],
		explanation: `One AND gate per row that is 1 gives ${plural(k, 'AND gate')}, each with ${n} inputs, ${
			k === 1 ? 'and no OR gate is needed' : `feeding one OR gate with ${k} inputs`
		}. The ${size - k} rows that are 0 contribute nothing.`
	};
};

const mintermNumber = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const vars = names(n);
	const full = (1 << n) - 1;
	const row = int(random, 0, full);
	const pattern = bin(row, n);
	const term = mintermText(row, vars);
	const reversed = parseInt(pattern.split('').reverse().join(''), 2);
	const weights = vars.map((_, i) => (row & (1 << (n - 1 - i)) ? 2 ** (n - 1 - i) : 0)).filter((w) => w > 0);
	if (int(random, 0, 1) === 0) {
		const distractors = [full - row, reversed, row + 1, row - 1, popcount(row)]
			.filter((d) => d >= 0 && d <= full && d !== row)
			.map(String);
		const { options, answer } = assemble(random, String(row), distractors);
		return {
			prompt: `With inputs ${vars.join(', ')}, which minterm number is ${term}?`,
			detail: term,
			options,
			answer,
			hints: [
				'Read the term as a row of the table: a plain letter is a 1 and a barred letter is a 0. Then read those bits as a binary number, first input first.',
				`${term} is the row ${pattern}. Add the weights of the 1s: ${
					weights.length ? weights.join(' + ') : 'there are none, so the value is 0'
				}.`
			],
			explanation: `Plain letters are 1 and barred letters are 0, so ${term} is the row ${pattern}, which is ${
				weights.length ? `${weights.join(' + ')} = ${row}` : '0'
			}: minterm m${row}.`
		};
	}
	const distractors = [
		mintermText(full - row, vars),
		mintermText(reversed, vars),
		mintermText((row + 1) & full, vars),
		mintermText((row + 2) & full, vars)
	];
	const { options, answer } = assemble(random, term, distractors);
	return {
		prompt: `With inputs ${vars.join(', ')}, which product is minterm m${row}?`,
		detail: `m${row}`,
		options,
		answer,
		hints: [
			`Write ${row} in binary with ${n} bits, one per input with the first input as the most significant bit. A 1 means the plain letter and a 0 means the barred letter.`,
			`m${row} in ${n} bits is ${pattern}, so ${assignments(row, vars)}. Bar the inputs that are 0.`
		],
		explanation: `${row} in ${n} bits is ${pattern}, so ${assignments(
			row,
			vars
		)}. Plain letters for the 1s and bars for the 0s give ${term}.`
	};
};

const readSop = (random: Random): CourseQuestion => {
	const n = int(random, 2, 3);
	const vars = names(n);
	const full = (1 << n) - 1;
	const k = int(random, 1, n);
	const ones = shuffle(random, range(1 << n))
		.slice(0, k)
		.sort((a, b) => a - b);
	const zeros = range(1 << n).filter((i) => !ones.includes(i));
	const right = canonical(vars, ones);
	const flipped = ones.includes(full - ones[0]) ? zeros[0] : full - ones[0];
	const swapped = [flipped, ...ones.slice(1)].sort((a, b) => a - b);
	const changed = k > 1 ? ones.slice(1) : [...ones, zeros[0]].sort((a, b) => a - b);
	const { options, answer } = assemble(random, right, [
		canonical(vars, swapped),
		canonical(vars, zeros),
		canonical(vars, changed)
	]);
	return {
		prompt: 'Which is the canonical sum of products for this truth table?',
		table: tableOf(vars, ones),
		options,
		answer,
		hints: [
			'Find every row where out is 1. Each one becomes a minterm, with a bar on the inputs that are 0 in that row, and the minterms are ORed together.',
			`The ${ones.length === 1 ? '1 is in row' : '1s are in rows'} ${ones.join(', ')}, so the ${
				ones.length === 1 ? 'minterm is' : 'minterms are'
			} ${ms(ones)}. Row ${ones[0]} is ${bin(ones[0], n)}, which gives ${mintermText(ones[0], vars)}.`
		],
		explanation: `${ones.length === 1 ? 'Row' : 'Rows'} ${ones.join(', ')} ${ones.length === 1 ? 'is' : 'are'} 1. ${
			ones.length === 1 ? 'Its minterm is' : 'Their minterms are'
		} ${ones.map((m) => `m${m} = ${mintermText(m, vars)}`).join(', ')}, ${
			ones.length === 1 ? 'and that alone is the expression' : 'and ORed together they give'
		}${ones.length === 1 ? '' : ` ${right}`}. The rows that are 0 add nothing.`
	};
};

// --- lesson 2: Karnaugh maps -------------------------------------------------

const adjacentCells = (random: Random): CourseQuestion => {
	const cols = grayCode(2);
	const labels = cols.map((v) => bin(v, 2));
	const cell = (row: number, col: number) => {
		const index = (row << 2) | cols[col];
		return { index, label: `a = ${row}, bc = ${labels[col]}` };
	};
	const r = int(random, 0, 1);
	const ci = int(random, 0, 3);
	const here = cell(r, ci);
	const right = pick(random, [cell(r, (ci + 1) % 4), cell(r, (ci + 3) % 4), cell(1 - r, ci)]);
	const wrong = [cell(1 - r, (ci + 1) % 4), cell(r, (ci + 2) % 4), cell(1 - r, (ci + 2) % 4)];
	const { options, answer } = assemble(
		random,
		right.label,
		wrong.map((w) => w.label)
	);
	const diff = (a: number, b: number) => popcount(a ^ b);
	const changed = names(3).filter((_, i) => (here.index ^ right.index) & (1 << (2 - i)));
	return {
		prompt: `On a three-input map the rows are a = 0 and a = 1 and the columns are bc = ${labels.join(
			', '
		)}, in that order. Which cell is a neighbour of the cell at ${here.label}?`,
		options,
		answer,
		hints: [
			'Neighbours differ in exactly one input. On the map that is the cell directly above or below, or directly left or right, and the two end columns count as touching because the map wraps.',
			`${here.label} is m${here.index}, which is ${bin(
				here.index,
				3
			)}. Write each option as three bits and count the bits that differ from ${bin(
				here.index,
				3
			)}: the neighbour differs in one.`
		],
		explanation: `${here.label} is ${bin(here.index, 3)} and ${right.label} is ${bin(
			right.index,
			3
		)}; only ${changed.join('')} differs, so they are neighbours. ${wrong
			.map((w) => `${w.label} is ${bin(w.index, 3)}, ${diff(here.index, w.index)} bits away`)
			.join('; ')}.`
	};
};

const groupTerm = (random: Random): CourseQuestion => {
	const n = 3;
	const vars = names(n);
	const dropped = pick(random, [1, 1, 2]);
	const mask = pick(random, masksWith(n, dropped));
	const fixed = int(random, 0, (1 << n) - 1) & ~mask;
	const cells = cube(n, mask, fixed);
	const [implicant] = minimise(cells, [], n);
	const right = patternText(cubePattern(implicant, n), vars);
	const otherMask = pick(
		random,
		masksWith(n, dropped).filter((m) => m !== mask)
	);
	const distractors = [
		patternText(cubePattern({ bits: fixed & ~otherMask, mask: otherMask }, n), vars),
		patternText(cubePattern({ bits: ~fixed & ~mask & ((1 << n) - 1), mask }, n), vars),
		mintermText(cells[0], vars)
	];
	if (dropped === 2) {
		const oneBit = mask & -mask;
		distractors.push(patternText(cubePattern({ bits: fixed, mask: oneBit }, n), vars));
	}
	const { options, answer } = assemble(random, right, distractors);
	const { changing, fixed: kept } = across(cells, vars);
	const bins = cells.map((c) => bin(c, n)).join(', ');
	return {
		prompt: `A loop on a three-input map covers the cells ${ms(cells)}. Which term does the loop stand for?`,
		detail: bins,
		options,
		answer,
		hints: [
			'Write the cells in binary. An input that has the same value in every cell stays in the term, plain for 1 and barred for 0; an input that changes drops out.',
			`Across ${bins}, ${changing.join(' and ')} ${changing.length === 1 ? 'changes' : 'change'} and ${kept.join(
				' and '
			)} ${kept.length === 1 ? 'stays' : 'stay'} the same. Keep the fixed ${
				kept.length === 1 ? 'input' : 'inputs'
			} and drop the rest.`
		],
		explanation: `The cells are ${bins}. ${changing.join(' and ')} ${
			changing.length === 1 ? 'takes' : 'take'
		} both values inside the loop, so ${changing.length === 1 ? 'it drops' : 'they drop'} out; ${kept.join(' and ')} ${
			kept.length === 1 ? 'is' : 'are'
		} fixed, which gives ${right}.`
	};
};

const groupSize = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const k = int(random, 1, n - 1);
	if (int(random, 0, 1) === 0) {
		const right = 2 ** k;
		const distractors = [k, 2 * k, 2 ** (n - k), n - k, 2 ** n].filter((d) => d !== right).map(String);
		const { options, answer } = assemble(random, String(right), distractors);
		return {
			prompt: `On a ${n}-input map, a loop whose term has dropped ${plural(k, 'input')} covers how many cells?`,
			options,
			answer,
			hints: [
				'Each input that drops out takes both values inside the loop, and that doubles the number of cells.',
				`Start from one cell and double it ${k} ${k === 1 ? 'time' : 'times'}: ${range(k + 1)
					.map((i) => 2 ** i)
					.join(', ')}.`
			],
			explanation: `Every dropped input doubles the loop, so ${k} dropped ${
				k === 1 ? 'input gives' : 'inputs give'
			} 2^${k} = ${right} cells. The term keeps the other ${n - k} ${n - k === 1 ? 'input' : 'inputs'}.`
		};
	}
	const size = 2 ** k;
	const right = n - k;
	const distractors = [k, size, n, n - k + 1, size - 1].filter((d) => d !== right && d > 0).map(String);
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `On a ${n}-input map, a loop of ${size} cells gives a term with how many letters in it?`,
		options,
		answer,
		hints: [
			'A loop of 2 drops one input, a loop of 4 drops two, a loop of 8 drops three: each doubling drops one more. The letters left are the inputs that did not drop.',
			`${size} is 2^${k}, so the loop drops ${plural(k, 'input')} out of ${n}.`
		],
		explanation: `${size} cells is 2^${k}, so ${plural(k, 'input')} dropped out, leaving ${n} − ${k} = ${right} ${
			right === 1 ? 'letter' : 'letters'
		} in the term.`
	};
};

const minimalMap = (random: Random): CourseQuestion => {
	const n = int(random, 2, 3);
	const vars = names(n);
	const size = 1 << n;
	const loops = n === 2 ? 1 : int(random, 1, 2);
	const set = new Set<number>();
	for (let i = 0; i < loops; i++) {
		const dropped = n === 2 ? 1 : pick(random, [1, 1, 2]);
		const mask = pick(random, masksWith(n, dropped));
		const fixed = int(random, 0, size - 1) & ~mask;
		for (const c of cube(n, mask, fixed)) set.add(c);
	}
	if (set.size === size) set.delete(size - 1);
	const ones = [...set].sort((a, b) => a - b);
	const table = tableOf(vars, ones);
	const right = overbar(simplify(table, 'engineering').text);
	const map = karnaughMapFromCells(vars, cellsOf(n, ones), 'engineering');
	const groups = map.groups.map((g) => ({
		term: overbar(g.term),
		cells: g.cells.map((key) => {
			const [r, c] = key.split(',').map(Number);
			return map.indices[r][c];
		})
	}));
	const zero = range(size).find((i) => !set.has(i)) ?? 0;
	const distractors = [
		canonical(vars, ones),
		flipFirstBar(right),
		groups.length > 1 ? groups[0].term : mintermText(ones[0], vars),
		`${right} + ${mintermText(zero, vars)}`
	];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt:
			'Draw the Karnaugh map for this truth table and loop the biggest groups of 1s you can. What is the minimal expression?',
		table,
		options,
		answer,
		hints: [
			`Put the 1s on the map with the column headings in Gray order (${
				n === 2 ? 'b = 0, 1' : 'bc = 00, 01, 11, 10'
			}), then loop rectangles of 1, 2 or 4 ones, as big as possible. Inputs that change inside a loop drop out.`,
			`The 1s are ${ms(ones)}. They make ${plural(groups.length, 'loop')}: ${groups
				.map((g) => `${ms(g.cells)} giving ${g.term}`)
				.join('; ')}.`
		],
		explanation: `${groups
			.map((g) => `${ms(g.cells)} form a loop of ${g.cells.length} for ${g.term}`)
			.join(', and ')}. ORed together: ${right}.`
	};
};

// --- lesson 3: four-variable maps and don't cares ---------------------------

const withDontCares = (random: Random): CourseQuestion => {
	const n = pick(random, [3, 3, 4]);
	const vars = names(n);
	const size = 1 << n;
	const dropped = n === 3 ? 2 : pick(random, [2, 3]);
	const mask = pick(random, masksWith(n, dropped));
	const fixed = int(random, 0, size - 1) & ~mask;
	const loop = cube(n, mask, fixed);
	const order = shuffle(random, loop);
	const xCount = int(random, 1, loop.length - 2);
	const xs = order.slice(0, xCount).sort((a, b) => a - b);
	const ones = order.slice(xCount).sort((a, b) => a - b);
	const right = minimal(vars, cellsOf(n, ones, xs));
	const withoutX = minimal(vars, cellsOf(n, ones));
	const { options, answer } = assemble(random, right, [withoutX, flipFirstBar(right), mintermText(ones[0], vars)]);
	const { changing, fixed: kept } = across(loop, vars);
	const asOnes = xs.length === 1 ? 'a 1' : '1s';
	return {
		prompt: `A ${n}-input map has 1s in ${ms(ones)} and don't cares in ${ms(
			xs
		)}; every other cell is 0. What is the minimal expression?`,
		detail: `1: ${ms(ones)}    X: ${ms(xs)}`,
		options,
		answer,
		hints: [
			"A don't care may be counted as a 1 when that makes a loop bigger, and left out when it does not. Only the 1s have to be covered.",
			`Count ${ms(xs)} as ${asOnes} and the cells ${ms(loop)} form one loop of ${loop.length}, which drops ${plural(
				dropped,
				'input'
			)}.`
		],
		explanation: `Treating ${ms(xs)} as ${asOnes}, ${ms(loop)} form a single loop of ${
			loop.length
		}. Inside it ${kept.join(' and ')} ${kept.length === 1 ? 'stays' : 'stay'} fixed while ${changing.join(
			', '
		)} change, so the term is ${right}. Without the don't cares the best cover is ${withoutX}.`
	};
};

const validGroup = (random: Random): CourseQuestion => {
	const n = 4;
	const vars = names(n);
	// Loops that only exist because the map wraps: across the end columns, the
	// end rows, or both at once for the corners.
	const kinds = [
		{ mask: 0b0010, fixed: int(random, 0, 3) << 2, how: 'across the two end columns, cd = 00 and cd = 10' },
		{ mask: 0b1000, fixed: int(random, 0, 3), how: 'across the top and bottom rows, ab = 00 and ab = 10' },
		{ mask: 0b1010, fixed: 0, how: 'through all four corners at once' },
		{ mask: 0b1001, fixed: int(random, 0, 1) << 1, how: 'across the top and bottom rows, two columns wide' },
		{ mask: 0b0110, fixed: int(random, 0, 1) << 3, how: 'across the two end columns, two rows tall' }
	];
	const kind = pick(random, kinds);
	const right = cube(n, kind.mask, kind.fixed);
	const [implicant] = minimise(right, [], n);
	const term = patternText(cubePattern(implicant, n), vars);
	const first = right[0];
	const twoBitsOff = first ^ kind.mask ^ (kind.mask & -kind.mask) ^ (first & 1 ? 1 : 0b0100);
	const candidates = [
		[...right.slice(0, -1), twoBitsOff & (size(n) - 1)],
		[...right, (first ^ 0b0001) & (size(n) - 1)],
		right.length === 2 ? [first, first ^ 0b0101] : right.slice(0, -1),
		[first, first ^ 0b1111]
	].map((cells) => [...new Set(cells)].sort((a, b) => a - b));
	// Two candidates can come out as the same set; keep one so the explanation
	// does not rule the same cells out twice.
	const wrongSets = [...new Map(candidates.filter((cells) => !isLoop(cells, n)).map((c) => [ms(c), c])).values()];
	const distractors = wrongSets.map(ms);
	const { options, answer } = assemble(random, ms(right), distractors);
	const { changing, fixed } = across(right, vars);
	const reason = (cells: number[]) =>
		Number.isInteger(Math.log2(cells.length))
			? `${ms(cells)} would need ${across(cells, vars).changing.join(', ')} to change, which is too many inputs for ${
					cells.length
			  } cells`
			: `${ms(cells)} is ${cells.length} cells, and a loop is always 1, 2, 4 or 8`;
	return {
		prompt:
			'On a four-input map (rows ab, columns cd, both in the order 00, 01, 11, 10), which of these sets of cells is a valid loop? Remember that the map wraps.',
		options,
		answer,
		hints: [
			'A loop is a rectangle of 1, 2, 4 or 8 cells in which some inputs are fixed and the rest take every combination. The two end columns touch, and so do the top and bottom rows.',
			`Write each set in binary. In a valid loop of ${right.length}, ${plural(
				changing.length,
				'input'
			)} take both values and the rest never change. ${ms(right)} are ${right.map((c) => bin(c, n)).join(', ')}.`
		],
		explanation: `${ms(right)} are ${right.map((c) => bin(c, n)).join(', ')}: ${changing.join(' and ')} ${
			changing.length === 1 ? 'changes' : 'change'
		} while ${fixed.join(' and ')} stay fixed, so they form a loop of ${right.length} for ${term}, wrapping ${
			kind.how
		}. ${wrongSets.map(reason).join('. ')}.`
	};
};
const size = (n: number) => 1 << n;

const bcdDontCares = (random: Random): CourseQuestion => {
	const variant = int(random, 0, 2);
	if (variant === 0) {
		const { options, answer } = assemble(random, '6', ['4', '10', '16', '9']);
		return {
			prompt:
				"A BCD digit is a decimal digit from 0 to 9 stored in four bits. How many of the 16 four-bit patterns never occur, and so can be marked as don't cares in a seven-segment decoder?",
			options,
			answer,
			hints: [
				'Four bits can make 16 patterns, but a decimal digit only needs one pattern for each of 0 to 9.',
				'Count the patterns from 1010 (ten) up to 1111 (fifteen).'
			],
			explanation:
				"Four bits give 16 patterns and the ten digits use 0000 to 1001, so the six codes 10 to 15 (1010 to 1111) never arrive and are don't cares."
		};
	}
	if (variant === 1) {
		const right = '10 to 15 (1010 to 1111)';
		const { options, answer } = assemble(random, right, [
			'0 to 5 (0000 to 0101)',
			'8 to 15 (1000 to 1111)',
			'9 to 15 (1001 to 1111)'
		]);
		return {
			prompt: "Which input codes are the don't cares of a BCD seven-segment decoder?",
			options,
			answer,
			hints: [
				'The decoder receives a decimal digit as four bits. The codes it never receives are the ones that are not a digit.',
				'The digits are 0 to 9, which is 0000 to 1001. Everything above that is spare.'
			],
			explanation:
				'BCD uses the codes 0 to 9, so 10 to 15 (1010 to 1111) never occur. Those six rows can be treated as 1 or 0, whichever makes the loops bigger.'
		};
	}
	const bits = int(random, 3, 4);
	const used = int(random, 2 ** (bits - 1) + 1, 2 ** bits - 1);
	const dc = 2 ** bits - used;
	const distractors = [used, 2 ** bits, bits, dc + 1, dc - 1].filter((d) => d !== dc && d > 0).map(String);
	const { options, answer } = assemble(random, String(dc), distractors);
	return {
		prompt: `A decoder takes ${bits} input bits, but only the codes 0 to ${
			used - 1
		} ever arrive. How many rows of its truth table are don't cares?`,
		options,
		answer,
		hints: [
			`${bits} bits can make ${
				2 ** bits
			} patterns. The rows that never arrive are the ones above the highest code used.`,
			`${2 ** bits} patterns in total, ${used} of them used. Subtract.`
		],
		explanation: `${bits} bits give 2^${bits} = ${2 ** bits} rows. The codes 0 to ${
			used - 1
		} use ${used} of them, so the other ${2 ** bits} − ${used} = ${dc} rows never happen and are don't cares.`
	};
};

const cornerNeighbours = (random: Random): CourseQuestion => {
	const n = 4;
	const vars = names(n);
	const corners = [0, 2, 8, 10];
	const place = (c: number) => `m${c} (ab = ${bin(c >> 2, 2)}, cd = ${bin(c & 3, 2)})`;
	if (int(random, 0, 1) === 0) {
		const here = pick(random, corners);
		const right = pick(
			random,
			corners.filter((c) => popcount(c ^ here) === 1)
		);
		const wrong = [corners.find((c) => popcount(c ^ here) === 2) ?? 10, here ^ 0b0101, here ^ 0b0111, here ^ 0b1111];
		const { options, answer } = assemble(random, place(right), wrong.map(place));
		const changed = vars.filter((_, i) => (here ^ right) & (1 << (n - 1 - i)));
		return {
			prompt: `${place(
				here
			)} is a corner of a four-input map. Which of these cells is its neighbour by wrapping round the edge of the map?`,
			options,
			answer,
			hints: [
				'The map wraps both ways: the left column touches the right column and the top row touches the bottom row, so a corner has two neighbours it reaches by wrapping.',
				`m${here} is ${bin(here, n)}. A neighbour differs in exactly one bit; ${place(
					wrong[0]
				)} is the opposite corner and differs in two.`
			],
			explanation: `m${here} is ${bin(here, n)} and m${right} is ${bin(right, n)}: only ${changed.join(
				''
			)} differs, so they are neighbours, joined by the wrap. ${wrong
				.map((w) => `m${w} differs in ${popcount(w ^ here)} bits`)
				.join(', ')}.`
		};
	}
	const right = minimal(vars, cellsOf(n, corners));
	const { options, answer } = assemble(random, right, [
		patternText('0-0-', vars),
		patternText('-1-1', vars),
		mintermText(0, vars),
		patternText('-00-', vars)
	]);
	return {
		prompt:
			'The four corner cells m0, m2, m8 and m10 of a four-input map are all 1. What is the term for that loop of four?',
		detail: corners.map((c) => bin(c, n)).join(', '),
		options,
		answer,
		hints: [
			'Write the four cells in binary and look at each input: the ones that stay the same in all four give the term, the ones that change drop out.',
			'In 0000, 0010, 1000 and 1010, the second and fourth bits are always 0 while the first and third take both values.'
		],
		explanation: `Across 0000, 0010, 1000 and 1010, a and c change while b and d are always 0, so the corners form one loop of four for ${right}.`
	};
};

// --- lesson 4: how a computer minimises -------------------------------------

const canMerge = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const full = (1 << n) - 1;
	const m = int(random, 0, full);
	const bits = shuffle(
		random,
		range(n).map((i) => 1 << i)
	);
	const right = m ^ bits[0];
	const wrong = [m ^ bits[0] ^ bits[1], m ^ bits[1] ^ bits[2], m ^ bits[0] ^ bits[1] ^ bits[2]];
	const show = (x: number) => `m${x} (${bin(x, n)})`;
	const { options, answer } = assemble(random, show(right), wrong.map(show));
	return {
		prompt: `In the merging step, which of these minterms can merge with ${show(m)}?`,
		detail: bin(m, n),
		options,
		answer,
		hints: [
			'Two codes merge only when they differ in exactly one bit. Write both in binary, one above the other, and count the positions where they differ.',
			`${show(m)} against ${show(wrong[0])}: ${popcount(
				m ^ wrong[0]
			)} bits differ, so that one is out. Check the others the same way; the answer differs in one bit only.`
		],
		explanation: `${show(right)} differs from ${bin(m, n)} in one bit, so the pair merges into ${bin(m, n)
			.split('')
			.map((b, i) => ((m ^ right) & (1 << (n - 1 - i)) ? '–' : b))
			.join('')}. ${wrong.map((w) => `${show(w)} differs in ${popcount(w ^ m)}`).join(', ')}, so none of those merge.`
	};
};

const mergeResult = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const vars = names(n);
	const full = (1 << n) - 1;
	const first = int(random, 0, full);
	const k = int(random, 0, n - 1);
	const second = first ^ (1 << k);
	const [lo, hi] = first < second ? [first, second] : [second, first];
	const result = tabulate([lo, hi], [], vars);
	const merged = result.primes[0];
	const right = overbar(cubeTerm(merged, vars));
	const dashed = merged.pattern.replace(/-/g, '–');
	const otherMask = 1 << (k + 1) % n;
	const { options, answer } = assemble(random, right, [
		patternText(cubePattern({ bits: lo & ~otherMask, mask: otherMask }, n), vars),
		flipFirstBar(right),
		mintermText(lo, vars),
		mintermText(hi, vars)
	]);
	const droppedVar = vars[n - 1 - k];
	return {
		prompt: `m${lo} (${bin(lo, n)}) and m${hi} (${bin(
			hi,
			n
		)}) differ in one bit, so they merge. Which term do they make?`,
		detail: `${bin(lo, n)} and ${bin(hi, n)}`,
		options,
		answer,
		hints: [
			'Write the two codes one above the other. The bit that differs becomes a dash, meaning that input has dropped out; the bits that agree stay, as a plain letter for 1 and a barred letter for 0.',
			`${bin(lo, n)} and ${bin(
				hi,
				n
			)} differ only in ${droppedVar}, giving ${dashed}. Now read the remaining bits as letters.`
		],
		explanation: `${bin(lo, n)} and ${bin(
			hi,
			n
		)} agree everywhere except ${droppedVar}, so the merged term is ${dashed}, which reads as ${right}. It covers both m${lo} and m${hi}.`
	};
};

const countOnes = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const m = int(random, 0, (1 << n) - 1);
	const right = popcount(m);
	const label = (k: number) => `${k} ${k === 1 ? 'one' : 'ones'}`;
	const distractors = [right + 1, right - 1, n - right, n, m].filter((d) => d >= 0 && d <= n && d !== right).map(label);
	const { options, answer } = assemble(random, label(right), distractors);
	const positions = bin(m, n)
		.split('')
		.map((b, i) => (b === '1' ? i + 1 : 0))
		.filter(Boolean);
	return {
		prompt: `Minterm m${m} of a ${n}-input function is ${bin(
			m,
			n
		)} in binary. In step 1 of Quine-McCluskey, which group does it go into?`,
		detail: bin(m, n),
		options,
		answer,
		hints: [
			'The groups are keyed on how many 1s the code contains, not on its value. Count the 1s and ignore the 0s.',
			`${bin(m, n)} has ${
				right === 0
					? 'no 1s at all'
					: `a 1 in ${positions.length === 1 ? 'position' : 'positions'} ${positions.join(', ')} from the left`
			}.`
		],
		explanation: `${bin(m, n)} contains ${label(right)}${
			right ? ` (${plural(n - right, '0')} do not count)` : ''
		}, so m${m} goes in the group for ${label(right)}. Only the groups either side of it need comparing with it.`
	};
};

const whichScales = (random: Random): CourseQuestion => {
	const variant = int(random, 0, 2);
	if (variant === 0) {
		const v = int(random, 7, 12);
		const right = 'Quine-McCluskey, run by a program';
		const { options, answer } = assemble(random, right, [
			'A Karnaugh map drawn by hand',
			'Reading the truth table by eye',
			'Writing the canonical sum of products and stopping there'
		]);
		return {
			prompt: `You need the smallest circuit for a function of ${v} inputs. Which method is the practical one?`,
			options,
			answer,
			hints: [
				`A Karnaugh map relies on seeing the neighbours, and that stops working at five or six inputs. ${v} is past that.`,
				`With ${v} inputs the truth table has ${
					2 ** v
				} rows. Only a procedure a computer can follow will get through it.`
			],
			explanation: `A map of ${v} inputs cannot be read, and the canonical form is the big circuit, not the small one. Quine-McCluskey is a fixed procedure, so a program can run it on ${v} inputs and give the same answer a map would.`
		};
	}
	if (variant === 1) {
		const { options, answer } = assemble(random, '5 or 6', ['2', '12', 'Any number']);
		return {
			prompt: 'Up to roughly how many inputs is a Karnaugh map practical?',
			options,
			answer,
			hints: [
				'Think about how many cells the map has and whether you could still see which cells are neighbours.',
				'Four inputs is a 4 by 4 square. Five needs two of them stacked, six needs four, and after that nobody can read it.'
			],
			explanation:
				'Maps are comfortable up to four inputs and still usable at five or six with stacked squares. Beyond that the neighbours cannot be seen, which is why the Quine-McCluskey method exists.'
		};
	}
	const right = 'It is a fixed list of steps that needs no picture to be read';
	const { options, answer } = assemble(random, right, [
		'It always gives a smaller circuit than a map',
		'It does not need the minterms',
		'It skips the prime implicant chart'
	]);
	return {
		prompt: 'Why does the Quine-McCluskey method suit a computer better than a Karnaugh map?',
		options,
		answer,
		hints: [
			'A computer cannot spot a rectangle. Ask which option describes something that can be done without looking.',
			'Both methods give the same minimal answer and both start from the minterms; the difference is in how the neighbours are found.'
		],
		explanation:
			'Quine-McCluskey finds neighbours by comparing binary codes, a mechanical step, and chooses the cover from a chart by counting marks. Nothing has to be seen, so a program can do it for any number of inputs. The answer is the same one a map gives.'
	};
};

export const smaller: StageMeta = {
	id: 'smaller',
	title: 'Making circuits smaller',
	tagline: 'Any truth table can become a circuit; these methods make it the smallest one.',
	lessons: [
		{
			slug: 'from-truth-table-to-expression',
			title: 'From truth table to expression',
			blurb: 'One AND term per row that is 1, all ORed together: a circuit for any table, and why it is too big.',
			description:
				'How any truth table becomes an expression: minterms and their numbering, the canonical sum of products, why it always works and why it is too big.',
			minutes: 12,
			generators: [writeMinterm, andGateCount, mintermNumber, readSop],
			deeper: [
				{ href: '/sum-of-products-calculator', label: 'Sum of products calculator' },
				{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' }
			]
		},
		{
			slug: 'karnaugh-maps',
			title: 'Karnaugh maps',
			blurb: 'The truth table folded so that neighbours touch, and loops of 1s that turn into short terms.',
			description:
				'How a Karnaugh map works: Gray code headings so neighbours differ in one bit, looping groups of 1, 2 and 4, and wrapping round the edges.',
			minutes: 14,
			generators: [adjacentCells, groupTerm, groupSize, minimalMap],
			deeper: [
				{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
				{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' }
			]
		},
		{
			slug: 'bigger-karnaugh-maps',
			title: "Four-variable maps and don't cares",
			blurb: 'The 4 by 4 map with its wrapping corners, and rows that never happen, which you may fill however helps.',
			description:
				"Four-variable Karnaugh maps: wrapping corners, loops of eight, don't cares from the unused BCD codes of a seven-segment decoder, and essential implicants.",
			minutes: 14,
			generators: [withDontCares, validGroup, bcdDontCares, cornerNeighbours],
			deeper: [
				{ href: '/karnaugh-map-solver#dont-cares', label: "Don't cares on the Karnaugh map solver" },
				{ href: '/seven-segment-decoder', label: 'The seven-segment decoder' }
			]
		},
		{
			slug: 'how-a-computer-minimises',
			title: 'How a computer minimises',
			blurb: "The Quine-McCluskey method: the map's merging rule as a procedure that works for any number of inputs.",
			description:
				'The Quine-McCluskey method step by step: group minterms by their 1s, merge pairs differing in one bit, find the prime implicants and choose a cover.',
			minutes: 12,
			generators: [canMerge, mergeResult, countOnes, whichScales],
			deeper: [
				{ href: '/quine-mccluskey', label: 'The Quine-McCluskey method, worked on any function' },
				{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' }
			]
		}
	]
};
