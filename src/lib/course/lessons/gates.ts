// Stage 2: the seven gates. Every answer here is computed by the expression
// engine or taken from the gate reference, never written out by hand, so a
// question cannot disagree with the tools.

import { parseExpression, truthTable, evaluate, equivalent, format, astKey, type Ast } from '../../boolean.js';
import { buildCircuit } from '../../circuit.js';
import { circuitToSvg } from '../../exportSvg.js';
import { gates as gateList, gateBySlug } from '../../gates.js';
import { shapes } from '../../symbols.js';
import { fromPractice } from '../fromPractice.js';
import type { Question } from '../../quiz.js';
import { assemble, bin, int, pick, shuffle } from '../random.js';
import type { CourseQuestion, QuestionGenerator, Random, StageMeta } from '../types.js';

const LETTERS = ['a', 'b', 'c', 'd'];

/** `a & b & c` style chain over the first n letters. */
const chain = (op: '&' | '|', n: number) => LETTERS.slice(0, n).join(` ${op} `);

/** Row index of an input combination, with the first variable as the top bit. */
const rowOf = (bits: number[]) => bits.reduce((acc, b) => acc * 2 + b, 0);

/** The bits of a row index, most significant first. */
const bitsOf = (row: number, n: number) => Array.from({ length: n }, (_, i) => (row >> (n - 1 - i)) & 1);

/** `a = 1, b = 0` style listing. */
const assignment = (vars: string[], bits: number[]) => vars.map((v, i) => `${v} = ${bits[i]}`).join(', ');

const valuesOf = (vars: string[], bits: number[]): Record<string, boolean> =>
	Object.fromEntries(vars.map((v, i) => [v, bits[i] === 1]));

/** The first three distinct wrong answers from a list of candidates, so a question has four options. */
const three = (correct: string, candidates: string[]) =>
	[...new Set(candidates.filter((c) => c !== correct))].slice(0, 3);

/** "an AND gate", "a NOR gate": the names beginning with a vowel sound. */
const article = (name: string) => (/^[AEIOUX]/.test(name) ? 'an' : 'a');

// --- Lesson 1: what a logic gate is -----------------------------------------

const rowsForInputs = (random: Random): CourseQuestion => {
	const n = int(random, 2, 4);
	const right = 2 ** n;
	const { options, answer } = assemble(
		random,
		String(right),
		three(String(right), [String(n * 2), String(right - 1), String(n ** 2), String(right + 1), String(n)])
	);
	return {
		prompt: `A gate has ${n} inputs. How many rows does its truth table have?`,
		options,
		answer,
		hints: [
			'Each input can be 0 or 1, and the table needs a row for every combination of them, so every extra input doubles the number of rows.',
			`Start from 1 input, which needs 2 rows, and double ${n - 1} more time${n - 1 === 1 ? '' : 's'}.`
		],
		explanation: `Each of the ${n} inputs has 2 possible values, so there are ${Array(n)
			.fill('2')
			.join(' × ')} = 2^${n} = ${right} combinations, and one row for each.`
	};
};

/** Tables the reader reads before any gate has been named. */
const TABLE_SOURCES = ['a & b', 'a | b', 'a ^ b', '!(a & b)', '!(a | b)', 'a & b & c', 'a | b | c', '(a & b) | c'];

const readTable = (random: Random): CourseQuestion => {
	const table = truthTable(parseExpression(pick(random, TABLE_SOURCES)));
	const n = table.variables.length;
	const row = int(random, 0, table.rows.length - 1);
	const bits = bitsOf(row, n);
	const value = table.rows[row] ? 1 : 0;
	return {
		prompt: `This truth table describes a gate. What does the gate output when ${assignment(table.variables, bits)}?`,
		table,
		tableOutputLabel: 'out',
		options: ['0', '1'],
		answer: value,
		hints: [
			'Find the row whose input columns match the values in the question, then read the output column of that same row.',
			`The rows count up in binary, so the row for ${bits.join('')} is row ${row + 1} counting from the top.`
		],
		explanation: `Row ${row + 1} of the table has inputs ${bits.join(', ')}, and its output column holds ${value}.`
	};
};

const whichRow = (random: Random): CourseQuestion => {
	const n = int(random, 2, 3);
	const vars = LETTERS.slice(0, n);
	const row = int(random, 0, 2 ** n - 1);
	const bits = bitsOf(row, n);
	const right = row + 1;
	const reversed = rowOf([...bits].reverse()) + 1;
	const { options, answer } = assemble(
		random,
		String(right),
		three(String(right), [String(row), String(reversed), String(right + 1), String(2 ** n - row), String(2 ** n + 1)])
	);
	return {
		prompt: `A truth table for inputs ${vars.join(
			', '
		)} counts up from all 0s. Calling the top row 1, which row holds ${assignment(vars, bits)}?`,
		options,
		answer,
		hints: [
			`The input columns are the binary numbers from 0 upwards, with ${vars[0]} as the leftmost bit. Row 1 is all 0s.`,
			`${bits.join('')} in binary is ${row}, and row 1 holds the number 0, so add 1.`
		],
		explanation: `Reading the inputs as one binary number, ${bits.join(
			''
		)} is ${row}. The top row holds 0 and is row 1, so ${row} is in row ${right}.`
	};
};

// --- Lesson 2: AND and OR ---------------------------------------------------

const andOrOutput = (random: Random): CourseQuestion => {
	const gate = pick(random, ['and', 'or'] as const);
	const n = int(random, 2, 3);
	const vars = LETTERS.slice(0, n);
	const bits = vars.map(() => int(random, 0, 1));
	const ast = parseExpression(chain(gate === 'and' ? '&' : '|', n));
	const value = evaluate(ast, valuesOf(vars, bits)) ? 1 : 0;
	const name = gate.toUpperCase();
	const ones = bits.filter((b) => b === 1).length;
	return {
		prompt: `What does a ${n}-input ${name} gate output when its inputs are ${bits.join(', ')}?`,
		options: ['0', '1'],
		answer: value,
		hints: [
			gate === 'and'
				? 'AND asks "are all of the inputs 1?" A single 0 anywhere is enough to make the output 0.'
				: 'OR asks "is at least one input 1?" A single 1 anywhere is enough to make the output 1.',
			`Count the 1s among the inputs: there ${ones === 1 ? 'is' : 'are'} ${ones} out of ${n}. ${
				gate === 'and' ? 'AND needs all of them to be 1.' : 'OR needs just one.'
			}`
		],
		explanation:
			gate === 'and'
				? `AND outputs 1 only when every input is 1. ${
						ones === n
							? `All ${n} inputs are 1, so the output is 1.`
							: `Here ${n - ones} of them ${n - ones === 1 ? 'is' : 'are'} 0, so the output is 0.`
				  }`
				: `OR outputs 1 when at least one input is 1. ${
						ones > 0
							? `Here ${ones} of them ${ones === 1 ? 'is' : 'are'} 1, so the output is 1.`
							: 'All inputs are 0, so the output is 0.'
				  }`
	};
};

const SITUATIONS: { text: string; gate: 'AND' | 'OR' }[] = [
	{ text: 'A door unlocks only when the key is turned and the correct code is entered.', gate: 'AND' },
	{ text: 'A burglar alarm rings if the door sensor or the window sensor is triggered.', gate: 'OR' },
	{ text: 'A microwave runs only when the door is closed and the start button is pressed.', gate: 'AND' },
	{ text: 'A doorbell rings if either the front door button or the back door button is pressed.', gate: 'OR' },
	{ text: 'A lift moves only when the doors are shut and a floor has been chosen.', gate: 'AND' },
	{ text: 'A phone vibrates if a message arrives or a call comes in.', gate: 'OR' },
	{ text: 'A car warns you if any one of its four doors is open.', gate: 'OR' },
	{ text: 'A rocket launches only when every one of its safety checks has passed.', gate: 'AND' }
];

const whichGateFits = (random: Random): CourseQuestion => {
	const s = pick(random, SITUATIONS);
	const other = s.gate === 'AND' ? 'OR' : 'AND';
	const { options, answer } = assemble(random, s.gate, [other, 'either would do', 'neither would do']);
	return {
		prompt: `${s.text} Which gate does this describe?`,
		options,
		answer,
		hints: [
			'Listen for the word: "and" or "only when both" points at AND; "or", "either" or "any" points at OR.',
			s.gate === 'AND'
				? 'The output should be 1 only when every condition holds at once. Which gate has exactly one 1 in its table?'
				: 'The output should be 1 as soon as any one condition holds. Which gate has only one 0 in its table?'
		],
		explanation:
			s.gate === 'AND'
				? 'Every condition has to be true at the same time, which is the rule of AND: 1 only when all inputs are 1.'
				: 'Any one condition on its own is enough, which is the rule of OR: 1 when at least one input is 1.'
	};
};

const countOnesAndOr = (random: Random): CourseQuestion => {
	const gate = pick(random, ['and', 'or'] as const);
	const n = int(random, 2, 3);
	const table = truthTable(parseExpression(chain(gate === 'and' ? '&' : '|', n)));
	const otherTable = truthTable(parseExpression(chain(gate === 'and' ? '|' : '&', n)));
	const count = table.rows.filter(Boolean).length;
	const otherCount = otherTable.rows.filter(Boolean).length;
	const rows = table.rows.length;
	const { options, answer } = assemble(
		random,
		String(count),
		three(String(count), [String(otherCount), String(rows / 2), String(n), String(rows)])
	);
	const name = gate.toUpperCase();
	return {
		prompt: `A ${n}-input ${name} gate has a truth table of ${rows} rows. In how many of them is the output 1?`,
		options,
		answer,
		hints: [
			gate === 'and'
				? 'AND is 1 only in the one row where every input is 1.'
				: 'OR is 0 only in the one row where every input is 0, and 1 everywhere else.',
			gate === 'and'
				? `Out of ${rows} rows, only the bottom row has all ${n} inputs at 1.`
				: `Out of ${rows} rows, only the top row has all ${n} inputs at 0. Every other row has a 1 somewhere.`
		],
		explanation:
			gate === 'and'
				? `Only the row where all ${n} inputs are 1 gives a 1, so ${count} row out of ${rows}.`
				: `Every row except the all-0s row has at least one 1, so ${count} rows out of ${rows}.`
	};
};

// --- Lesson 3: NOT and combining gates --------------------------------------

const notOf = (random: Random): CourseQuestion => {
	const x = int(random, 0, 1);
	const two = random() < 0.35;
	const ast = parseExpression(two ? '!!a' : '!a');
	const value = evaluate(ast, { a: x === 1 }) ? 1 : 0;
	return {
		prompt: two
			? `Two NOT gates are joined in a row, the output of the first feeding the second. The input to the first is ${x}. What comes out of the second?`
			: `A NOT gate's input is ${x}. What is its output?`,
		options: ['0', '1'],
		answer: value,
		hints: [
			'NOT has one input and one job: its output is the opposite of its input.',
			two
				? `The first NOT turns ${x} into ${x ^ 1}. Now flip that once more.`
				: `The input is ${x}, so the output is whichever value ${x} is not.`
		],
		explanation: two
			? `The first NOT flips ${x} to ${
					x ^ 1
			  }, and the second flips it back to ${value}. Two NOTs in a row undo each other.`
			: `NOT flips its input, so ${x} becomes ${value}.`
	};
};

/** Two-gate circuits described in words, so no notation is needed to read them. */
const CHAINS: { source: string; words: string }[] = [
	{ source: '(a & b) | c', words: 'a and b go into an AND gate. Its output and c go into an OR gate.' },
	{ source: '(a | b) & c', words: 'a and b go into an OR gate. Its output and c go into an AND gate.' },
	{ source: '!a & b', words: 'a goes through a NOT gate. Its output and b go into an AND gate.' },
	{ source: 'a | !b', words: 'b goes through a NOT gate. Its output and a go into an OR gate.' },
	{ source: '!(a & b)', words: 'a and b go into an AND gate. Its output goes through a NOT gate.' },
	{ source: '!(a | b)', words: 'a and b go into an OR gate. Its output goes through a NOT gate.' }
];

const chainOutput = (random: Random): CourseQuestion => {
	const c = pick(random, CHAINS);
	const ast = parseExpression(c.source);
	const table = truthTable(ast);
	const vars = table.variables;
	const bits = vars.map(() => int(random, 0, 1));
	const values = valuesOf(vars, bits);
	const value = evaluate(ast, values) ? 1 : 0;
	// The first gate's output is the wire in the middle; name it for the hint.
	const first = innerGate(ast);
	const middle = evaluate(first, values) ? 1 : 0;
	return {
		prompt: `${c.words} What is the final output when ${assignment(vars, bits)}?`,
		detail: format(ast, 'math'),
		options: ['0', '1'],
		answer: value,
		hints: [
			'Work out the first gate on its own and write its answer on the wire between the gates. Then the second gate has both its inputs.',
			`The first gate, ${format(first, 'math')}, gives ${middle} for these inputs. Feed that into the second gate.`
		],
		explanation:
			ast.t === 'not'
				? `First gate: ${format(first, 'math')} = ${middle}. Second gate: the NOT flips that ${middle} to ${value}.`
				: `First gate: ${format(
						first,
						'math'
				  )} = ${middle}. Second gate: ${ast.t.toUpperCase()} of that ${middle} and ${other(
						ast,
						vars,
						bits
				  )} gives ${value}.`
	};
};

/** The input that goes straight into the root gate of a two-gate chain, with its value. */
function other(ast: Ast, vars: string[], bits: number[]): string {
	if (ast.t !== 'and' && ast.t !== 'or' && ast.t !== 'xor') return '';
	const leaf = ast.a.t === 'var' ? ast.a : ast.b;
	return leaf.t === 'var' ? `${leaf.name} = ${bits[vars.indexOf(leaf.name)]}` : '';
}

/** The gate nearest the inputs in a two-gate chain: the non-variable child of the root. */
function innerGate(ast: Ast): Ast {
	if (ast.t === 'not') return ast.a;
	if (ast.t === 'var' || ast.t === 'const') return ast;
	return ast.a.t === 'var' ? ast.b : ast.a;
}

// --- Lesson 4: XOR ----------------------------------------------------------

const xorOutput = (random: Random): CourseQuestion => {
	const withOne = random() < 0.3;
	const bits = [int(random, 0, 1), withOne ? 1 : int(random, 0, 1)];
	const ast = parseExpression('a ^ b');
	const value = evaluate(ast, { a: bits[0] === 1, b: bits[1] === 1 }) ? 1 : 0;
	return {
		prompt: withOne
			? `One input of an XOR gate is tied to a constant 1. The other input is ${bits[0]}. What is the output?`
			: `What does an XOR gate output when its inputs are ${bits[0]} and ${bits[1]}?`,
		options: ['0', '1'],
		answer: value,
		hints: [
			'XOR outputs 1 when its two inputs are different and 0 when they are the same.',
			`The inputs are ${bits[0]} and ${bits[1]}. Are they the same or different?`
		],
		explanation:
			bits[0] === bits[1]
				? `The inputs ${bits[0]} and ${bits[1]} are the same, so XOR gives ${value}.`
				: `The inputs ${bits[0]} and ${bits[1]} differ, so XOR gives ${value}.${
						withOne ? ' XOR with a 1 always flips the other input.' : ''
				  }`
	};
};

const xorPatterns = (random: Random): CourseQuestion => {
	const n = 4;
	const p = int(random, 1, 2 ** n - 2);
	let q = int(random, 1, 2 ** n - 2);
	if (q === p) q = (p + 5) % (2 ** n - 1) || 1;
	const ast = parseExpression('a ^ b');
	const pb = bin(p, n);
	const qb = bin(q, n);
	const bits = Array.from({ length: n }, (_, i) => (evaluate(ast, { a: pb[i] === '1', b: qb[i] === '1' }) ? '1' : '0'));
	const right = bits.join('');
	const r = parseInt(right, 2);
	const { options, answer } = assemble(
		random,
		right,
		three(right, [bin(p | q, n), bin(p & q, n), bin(r ^ 0b1000, n), bin(r ^ 0b0001, n), bin(r ^ 0b1111, n)])
	);
	return {
		prompt: `XOR the patterns ${pb} and ${qb} bit by bit: the first bit of one with the first bit of the other, and so on.`,
		detail: `${pb} XOR ${qb}`,
		options,
		answer,
		hints: [
			'Take the patterns one column at a time. In each column, write 1 if the two bits differ and 0 if they are the same.',
			`Column by column: ${Array.from({ length: n }, (_, i) => `${pb[i]} and ${qb[i]} give ${bits[i]}`).join(', ')}.`
		],
		explanation: `Going along the columns, ${pb} XOR ${qb} gives ${right}: a 1 wherever the two patterns differ, a 0 wherever they match.`
	};
};

const RULES: { text: string; gate: string }[] = [
	{ text: 'outputs 1 only when its two inputs are different', gate: 'XOR' },
	{ text: 'outputs 1 only when both of its inputs are 1', gate: 'AND' },
	{ text: 'outputs 1 when at least one of its inputs is 1', gate: 'OR' },
	{ text: 'gives the sum bit when two bits are added, ignoring the carry', gate: 'XOR' },
	{ text: 'gives the carry bit when two bits are added', gate: 'AND' },
	{ text: 'outputs 1 when one input is 1 or the other is 1, but not both', gate: 'XOR' }
];

const whichRule = (random: Random): CourseQuestion => {
	const rule = pick(random, RULES);
	const { options, answer } = assemble(
		random,
		rule.gate,
		['AND', 'OR', 'XOR', 'NOT'].filter((g) => g !== rule.gate)
	);
	return {
		prompt: `Which gate ${rule.text}?`,
		options,
		answer,
		hints: [
			'AND is "both", OR is "at least one", XOR is "one or the other but not both", NOT has only one input.',
			rule.gate === 'XOR'
				? 'Adding 1 + 1 gives 10 in binary: the sum bit is 0 while the carry is 1. Which gate gives 0 for two 1s but 1 for a 1 and a 0?'
				: rule.gate === 'AND'
				? 'The only gate that needs every input to be 1 is the one with a single 1 in its table.'
				: 'The gate that is satisfied by any single 1 has a single 0 in its table.'
		],
		explanation: `That is the rule of ${rule.gate}. ${
			rule.gate === 'XOR'
				? 'XOR is 1 exactly when the inputs differ, which is also the sum bit of a one-bit addition: 0 + 1 and 1 + 0 give 1, but 1 + 1 gives 0 and a carry.'
				: rule.gate === 'AND'
				? 'AND is 1 only for two 1s, which is also when adding two bits produces a carry.'
				: 'OR is 1 as soon as any input is 1.'
		}`
	};
};

// --- Lesson 5: NAND, NOR and XNOR ---------------------------------------------

const invertedOutput = (random: Random): CourseQuestion => {
	const gate = gateBySlug(pick(random, ['nand', 'nor', 'xnor']))!;
	const bits = [int(random, 0, 1), int(random, 0, 1)];
	const ast = parseExpression(gate.source);
	const plain = parseExpression(gate.source.slice(2, -1));
	const values = { a: bits[0] === 1, b: bits[1] === 1 };
	const value = evaluate(ast, values) ? 1 : 0;
	const inner = evaluate(plain, values) ? 1 : 0;
	const base = gate.name.replace(/^N|^XN/, (m) => (m === 'XN' ? 'X' : ''));
	return {
		prompt: `What does ${article(gate.name)} ${gate.name} gate output when its inputs are ${bits[0]} and ${bits[1]}?`,
		options: ['0', '1'],
		answer: value,
		hints: [
			`${gate.name} is ${base} with a NOT on the end: work out ${base} first, then flip the answer.`,
			`${base} of ${bits[0]} and ${bits[1]} is ${inner}. Now flip it.`
		],
		explanation: `${base} gives ${inner} for inputs ${bits[0]} and ${bits[1]}, and ${gate.name} flips that to ${value}. Put another way, ${gate.name} is 1 when ${gate.outputHigh}.`
	};
};

/** Counts the distinct NAND gates in an expression built only from NAND. */
function nandCount(ast: Ast): number {
	const seen = new Set<string>();
	const walk = (n: Ast) => {
		if (n.t === 'not' && n.a.t === 'and') {
			seen.add(astKey(n));
			walk(n.a.a);
			walk(n.a.b);
		} else if (n.t === 'not') walk(n.a);
		else if (n.t === 'and' || n.t === 'or' || n.t === 'xor') {
			walk(n.a);
			walk(n.b);
		}
	};
	walk(ast);
	return seen.size;
}

const buildFromNand = (random: Random): CourseQuestion => {
	const nand = gateBySlug('nand')!;
	const kind = pick(random, ['not', 'tied', 'count-and', 'count-or'] as const);
	if (kind === 'not') {
		const right = 'Connect both inputs of a NAND gate to the same signal';
		const { options, answer } = assemble(random, right, [
			'Connect one input of a NAND gate to a constant 0',
			'Leave one input of a NAND gate unconnected',
			'Feed the NAND output back into one of its inputs'
		]);
		return {
			prompt: 'How do you make a NOT gate out of a single NAND gate?',
			options,
			answer,
			hints: [
				'A NAND with both inputs equal only ever sees the rows 0, 0 and 1, 1 of its table.',
				'NAND of 0 and 0 is 1, and NAND of 1 and 1 is 0. That is the table of NOT.'
			],
			explanation:
				'Tie both inputs together, so the gate sees a, a. NAND(0, 0) = 1 and NAND(1, 1) = 0, which is exactly NOT a. A constant 0 on one input would hold the output at 1 forever.'
		};
	}
	if (kind === 'tied') {
		const x = int(random, 0, 1);
		const value = evaluate(parseExpression('!(a & a)'), { a: x === 1 }) ? 1 : 0;
		return {
			prompt: `Both inputs of a NAND gate are connected to the same wire, which carries ${x}. What is the output?`,
			options: ['0', '1'],
			answer: value,
			hints: [
				'With both inputs tied together the gate is seeing the same value twice: AND it, then flip.',
				`AND of ${x} and ${x} is ${x}. Now flip it.`
			],
			explanation: `The gate sees ${x} and ${x}. AND gives ${x}, and the NOT on the end flips it to ${value}. A NAND with tied inputs is a NOT gate.`
		};
	}
	const target = kind === 'count-and' ? 'AND' : 'OR';
	const eq = nand.equivalences.find((e) => e.label === `${target} from NAND`)!;
	const count = nandCount(parseExpression(eq.expression));
	const { options, answer } = assemble(
		random,
		String(count),
		['1', '2', '3', '4'].filter((c) => c !== String(count))
	);
	return {
		prompt: `How many NAND gates does it take to build a two-input ${target} gate?`,
		options,
		answer,
		hints: [
			target === 'AND'
				? 'AND is NAND with the inversion undone, and undoing an inversion means one more NOT, which is one more NAND.'
				: 'OR from NAND means inverting each input first, one NAND each, and then feeding both into a NAND.',
			target === 'AND'
				? 'One NAND for the NAND itself, and one NAND with tied inputs to flip its output back.'
				: 'One NAND per input to invert it, then one more to combine them: count them up.'
		],
		explanation: `${target} from NAND is written ${format(
			parseExpression(eq.expression),
			'math'
		)}, which is ${count} NAND gates: ${
			target === 'AND'
				? 'the NAND itself, then a NAND with tied inputs acting as NOT.'
				: 'two NANDs with tied inputs acting as NOTs on a and b, then a NAND of the two results.'
		}`
	};
};

const twoInputGates = gateList.filter((g) => g.slug !== 'not');

const gateByRule = (random: Random): CourseQuestion => {
	const gate = pick(random, twoInputGates);
	const others = shuffle(
		random,
		twoInputGates.filter((g) => g.slug !== gate.slug).map((g) => g.name)
	).slice(0, 3);
	const { options, answer } = assemble(random, gate.name, others);
	return {
		prompt: `Which gate outputs 1 when ${gate.outputHigh}?`,
		options,
		answer,
		hints: [
			'The three gates with a NOT built in are the plain gates flipped: NAND is 0 only for two 1s, NOR is 1 only for two 0s, XNOR is 1 when the inputs match.',
			gate.slug === 'xnor'
				? 'XOR is 1 when the inputs differ. The gate that is 1 when they are equal is its opposite.'
				: gate.slug === 'nor'
				? 'OR is 0 only when every input is 0. The gate that is 1 in exactly that case is its opposite.'
				: gate.slug === 'nand'
				? 'AND is 1 only when every input is 1. The gate that is 0 in exactly that case, and 1 otherwise, is its opposite.'
				: `Say the rule of each option in words and find the one that matches "${gate.outputHigh}".`
		],
		explanation: `${gate.name} outputs 1 when ${gate.outputHigh}. ${
			gate.slug === 'nand'
				? 'It is AND with the output flipped, so it is 0 only for all 1s.'
				: gate.slug === 'nor'
				? 'It is OR with the output flipped, so it is 1 only for all 0s.'
				: gate.slug === 'xnor'
				? 'It is XOR with the output flipped: 1 for 00 and 11, 0 for 01 and 10.'
				: gate.slug === 'xor'
				? 'It is 1 for 01 and 10, and 0 for 00 and 11.'
				: gate.slug === 'and'
				? 'Its table has a single 1, in the bottom row.'
				: 'Its table has a single 0, in the top row.'
		}`
	};
};

// --- Lesson 6: reading a circuit diagram --------------------------------------

const SYMBOL_FEATURES: { text: string; slug: string }[] = [
	{ text: 'a flat back and a rounded nose, like a capital D', slug: 'and' },
	{ text: 'a curved back and a body that comes to a point', slug: 'or' },
	{ text: 'a triangle with a small circle on its tip', slug: 'not' },
	{ text: 'the OR shape with a second curved line drawn behind its back', slug: 'xor' },
	{ text: 'the AND shape with a small circle on its output', slug: 'nand' },
	{ text: 'the OR shape with a small circle on its output', slug: 'nor' },
	{ text: 'the XOR shape with a small circle on its output', slug: 'xnor' }
];

const identifySymbol = (random: Random): CourseQuestion => {
	const bubbled = gateList.filter((g) => shapes[g.slug].bubble !== undefined).map((g) => g.name);
	const plain = gateList.filter((g) => shapes[g.slug].bubble === undefined).map((g) => g.name);
	const kind = pick(random, ['feature', 'feature', 'bubble', 'no-bubble'] as const);
	if (kind === 'bubble' || kind === 'no-bubble') {
		const pool = kind === 'bubble' ? bubbled : plain;
		const right = pick(random, pool);
		const wrong = shuffle(random, kind === 'bubble' ? plain : bubbled).slice(0, 3);
		const { options, answer } = assemble(random, right, wrong);
		return {
			prompt:
				kind === 'bubble'
					? 'Which of these gates is drawn with a small circle, a bubble, on its output?'
					: 'Which of these gates is drawn without a bubble on its output?',
			options,
			answer,
			hints: [
				'The bubble means "invert the output". It appears on NOT and on every gate whose name starts with N, plus XNOR.',
				`The gates with a bubble are ${bubbled.join(', ')}; the ones without are ${plain.join(', ')}.`
			],
			explanation: `${right} ${
				kind === 'bubble' ? 'has a bubble' : 'has no bubble'
			}. A bubble marks an inverted output, so it is on ${bubbled.join(', ')} and nothing else.`
		};
	}
	const feature = pick(random, SYMBOL_FEATURES);
	const gate = gateBySlug(feature.slug)!;
	const others = shuffle(
		random,
		gateList.filter((g) => g.slug !== feature.slug).map((g) => g.name)
	).slice(0, 3);
	const { options, answer } = assemble(random, gate.name, others);
	return {
		prompt: `Which gate's symbol is ${feature.text}?`,
		options,
		answer,
		hints: [
			'AND is the D shape, OR is the pointed shape with a curved back, NOT is the triangle. XOR adds a line behind OR, and a bubble on the output turns AND, OR and XOR into NAND, NOR and XNOR.',
			shapes[feature.slug].bubble !== undefined && feature.slug !== 'not'
				? `The bubble means the output is inverted, so this is the inverted version of the shape it is drawn on: ${gate.name}.`
				: `Only one of the seven is drawn that way, and it is the gate that is 1 when ${gate.outputHigh}.`
		],
		explanation: `That is the ${gate.name} symbol: ${feature.text}. ${gate.name} outputs 1 when ${gate.outputHigh}.`
	};
};

/** Two-gate diagrams to read an expression off. */
const DIAGRAM_SOURCES = [
	'!a & b',
	'a & !b',
	'!a | b',
	'a | !b',
	'!(a & b)',
	'!(a | b)',
	'!(a ^ b)',
	'(a & b) | c',
	'(a | b) & c',
	'(a ^ b) & c',
	'(a & b) ^ c',
	'(a | b) ^ c',
	'(a ^ b) | c'
];

const diagramExpression = (random: Random): CourseQuestion => {
	const source = pick(random, DIAGRAM_SOURCES);
	const ast = parseExpression(source);
	const vars = truthTable(ast).variables;
	const right = format(ast, 'math');
	// Wrong answers use the same inputs, so the boxes on the left give nothing away.
	const wrong = DIAGRAM_SOURCES.map((s) => parseExpression(s))
		.filter((other) => truthTable(other).variables.join('') === vars.join('') && !equivalent(other, ast))
		.map((other) => format(other, 'math'));
	const { options, answer } = assemble(random, right, shuffle(random, wrong).slice(0, 3));
	const circuit = buildCircuit(ast);
	const first = innerGate(ast);
	return {
		prompt: 'Which expression does this circuit implement?',
		svg: circuitToSvg(circuit, { standard: 'ansi', palette: 'colour', outputLabel: 'Q' }),
		svgAlt: `A two-gate logic circuit with inputs ${vars.join(', ')}`,
		options,
		answer,
		hints: [
			'Start at the inputs on the left. Name the first gate they meet and write down what it computes, then see what that feeds.',
			`The gate nearest the inputs computes ${format(
				first,
				'math'
			)}. Look at which gate its output wire goes into, and what else goes in with it.`
		],
		explanation: `The first gate gives ${format(first, 'math')}, and the gate at the output combines that${
			ast.t === 'not' ? ' through a NOT' : ' with the remaining input'
		}, so the circuit is ${right}.`
	};
};

// The practice generators cover all seven gates. Early lessons only get the
// questions about what they have taught so far.
const text = (q: Question) => [q.prompt, q.detail ?? '', ...q.options, q.explanation].join(' ');
const noXor = (q: Question) => !text(q).includes('\u22bb') && !/xor/i.test(text(q));
const onlyAndOr = (q: Question) => q.kind === 'gate-output' && !/\b(NAND|NOR|XOR|XNOR|NOT)\b/i.test(text(q));
const upToXor = (q: Question) => q.kind === 'gate-output' && !/\b(NAND|NOR|XNOR)\b/i.test(text(q));

// The practice hints are written for all seven gates. A lesson that has not
// met them all yet swaps in hints that mention only the gates taught so far.
const withHints =
	(generator: QuestionGenerator, hints: [string, string]): QuestionGenerator =>
	(random: Random) => ({ ...generator(random), hints });

const andOrHints: [string, string] = [
	'Say the rule of the gate in words first: AND is 1 only when every input is 1, OR when at least one is.',
	'Count the 1s among the inputs. AND needs all of them to be 1; OR needs just one.'
];
const noXorHints: [string, string] = [
	'Replace each letter with its value, then work from the innermost brackets outwards. NOT binds tightest, then AND, then OR.',
	'NOT flips a value, AND needs both sides to be 1, OR needs at least one side to be 1.'
];
const fourGateHints: [string, string] = [
	'Say the rule of the gate in words first: AND is 1 only when every input is 1, OR when at least one is, XOR when the two inputs differ, NOT flips its one input.',
	'Look at whether the inputs are the same or different. Two 1s satisfy AND and OR but not XOR; a 1 and a 0 satisfy OR and XOR but not AND.'
];

export const gates: StageMeta = {
	id: 'gates',
	title: 'The seven gates',
	tagline: 'A gate is a tiny machine with one rule. Seven of them are all you need.',
	lessons: [
		{
			slug: 'what-is-a-logic-gate',
			title: 'What a logic gate is',
			blurb: 'Inputs in, one output out, and a table that says everything there is to say about it.',
			description:
				'What a logic gate is: a small circuit whose output depends only on its current inputs, and the truth table that describes it, one row per input combination.',
			minutes: 10,
			generators: [rowsForInputs, readTable, whichRow],
			deeper: [
				{ href: '/logic-gates', label: 'The seven logic gates' },
				{ href: '/truth-table-generator', label: 'Truth table generator' }
			],
			build: { href: '/simulator#example:Introduction', label: 'the introduction circuit' }
		},
		{
			slug: 'and-and-or',
			title: 'AND and OR',
			blurb: 'The two gates you use most: "both" and "at least one".',
			description:
				'The AND and OR gates in words, symbols and truth tables: AND is 1 only when every input is 1, OR when at least one is, with examples and three-input versions.',
			minutes: 10,
			generators: [andOrOutput, whichGateFits, countOnesAndOr, withHints(fromPractice('gates', onlyAndOr), andOrHints)],
			deeper: [
				{ href: '/logic-gates/and', label: 'The AND gate' },
				{ href: '/logic-gates/or', label: 'The OR gate' },
				{ href: '/practice?topic=gates', label: 'Practice: gates' }
			]
		},
		{
			slug: 'not-and-combining-gates',
			title: 'NOT, and joining gates together',
			blurb: 'The gate that flips a bit, and what happens when one gate feeds another.',
			description:
				'The NOT gate and its bubble, then how gates chain: the output of one gate feeds the input of the next, and a small two-gate circuit is worked out step by step.',
			minutes: 12,
			generators: [
				notOf,
				chainOutput,
				withHints(fromPractice('expressions', noXor), noXorHints),
				fromPractice('diagrams', (q) => q.kind === 'circuit-expression' && noXor(q))
			],
			deeper: [
				{ href: '/logic-gates/not', label: 'The NOT gate' },
				{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' }
			]
		},
		{
			slug: 'xor',
			title: 'XOR, the odd one out',
			blurb: 'One or the other but not both, and why that is how computers add.',
			description:
				'The XOR gate: 1 when its inputs differ, one or the other but not both. XOR as adding without a carry, XOR with a 1 as a controlled inverter, and parity.',
			minutes: 10,
			generators: [xorOutput, xorPatterns, whichRule, withHints(fromPractice('gates', upToXor), fourGateHints)],
			deeper: [
				{ href: '/logic-gates/xor', label: 'The XOR gate' },
				{ href: '/practice?topic=gates', label: 'Practice: gates' }
			]
		},
		{
			slug: 'nand-nor-xnor',
			title: 'NAND, NOR and XNOR',
			blurb: 'Three gates with a NOT built in, and why one of them is enough to build a computer.',
			description:
				'NAND, NOR and XNOR: each is a plain gate followed by NOT. How NAND alone builds NOT, AND and OR, why chips are made of it, and XNOR as the "equal" gate.',
			minutes: 12,
			generators: [invertedOutput, fromPractice('truth-tables'), buildFromNand, gateByRule],
			deeper: [
				{ href: '/logic-gates/nand', label: 'The NAND gate' },
				{ href: '/logic-gates/nor', label: 'The NOR gate' },
				{ href: '/logic-gates/xnor', label: 'The XNOR gate' }
			]
		},
		{
			slug: 'reading-circuit-diagrams',
			title: 'Reading a circuit diagram',
			blurb: 'The seven symbols, which way the signals flow, and how to work a drawing out wire by wire.',
			description:
				'How to read a logic circuit diagram: the symbol for each of the seven gates, left-to-right signal flow, joined and crossing wires, and labelling every wire.',
			minutes: 12,
			generators: [identifySymbol, fromPractice('diagrams'), diagramExpression],
			deeper: [
				{ href: '/logic-gate-symbols', label: 'Logic gate symbols, ANSI and IEC' },
				{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
				{ href: '/practice?topic=gates', label: 'Practice: gates' }
			],
			build: { href: '/simulator', label: 'a circuit of your own' }
		}
	]
};
