// Generates practice questions and their answers from the expression engine,
// so every question is graded by the same code that powers the tools rather
// than by a hand-written answer key.

import {
	parseExpression,
	truthTable,
	simplify,
	format,
	equivalent,
	evaluate,
	variablesOf,
	type Ast,
	type TruthTable
} from './boolean.js';
import { gates } from './gates.js';
import { buildCircuit, circuitStates, CircuitTooLarge } from './circuit.js';
import { circuitToSvg } from './exportSvg.js';

export type Question = {
	kind:
		| 'gate-output'
		| 'identify-gate'
		| 'evaluate'
		| 'equivalent'
		| 'count-ones'
		| 'circuit-expression'
		| 'circuit-output';
	prompt: string;
	/** Shown in a monospace box above the options, when there is one. */
	detail?: string;
	/** Rendered as a truth table when present. */
	table?: TruthTable;
	/** A circuit diagram, already rendered, shown above the options. */
	svg?: string;
	/** Alt text for that diagram, so the question is readable without it. */
	svgAlt?: string;
	/** The same diagram with the answer showing, revealed once marked. */
	svgSolved?: string;
	/** The same diagram in black and white, used when the page is printed. */
	svgPrint?: string;
	/** Column heading to use for the table's output. */
	tableOutputLabel?: string;
	options: string[];
	answer: number;
	explanation: string;
};

/** Small deterministic PRNG, so a given seed always gives the same question. */
function rng(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const pick = <T>(random: () => number, items: T[]): T => items[Math.floor(random() * items.length)];

const shuffle = <T>(random: () => number, items: T[]): T[] => {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

/** Places the correct answer randomly among the distractors. */
function assemble(random: () => number, correct: string, distractors: string[]): Question['options'] & {} {
	return shuffle(random, [correct, ...distractors]);
}

function randomAst(random: () => number, pool: string[], depth: number): Ast {
	if (depth <= 0 || random() < 0.3) {
		const name = pick(random, pool);
		return random() < 0.3 ? { t: 'not', a: { t: 'var', name } } : { t: 'var', name };
	}
	const kind = random() < 0.45 ? 'and' : random() < 0.75 ? 'or' : 'xor';
	return {
		t: kind,
		a: randomAst(random, pool, depth - 1),
		b: randomAst(random, pool, depth - 1)
	} as Ast;
}

const twoInputGates = gates.filter((g) => g.slug !== 'not');

/**
 * Rejects expressions with a dead sub-expression in them: `a ∨ a`, `b ⊻ b`,
 * `¬a ∧ a` and friends. They are valid but they read as noise, and as wrong
 * answers they can be eliminated without understanding anything.
 */
function isClean(source: Ast): boolean {
	// Judge the text the reader will actually see. Printing drops brackets
	// between equal-precedence operators, so `c ⊻ (c ⊻ ¬a)` reaches the page as
	// `c ⊻ c ⊻ ¬a`, which reads as dead even though the tree was not.
	let ast: Ast;
	try {
		ast = parseExpression(format(source, 'math'));
	} catch {
		return false;
	}
	// AND binds tighter than OR everywhere, but XOR's rank against OR is not a
	// settled convention: plenty of texts give the two equal precedence. So a
	// printed `b ∨ ¬c ⊻ a` has two defensible readings and two defensible
	// answers, which is no good in a question that marks you. Rather than pick a
	// side, do not ask it.
	const text = format(source, 'math');
	if (text.includes('⊻') && (text.includes('∨') || text.includes('∧'))) return false;

	const constant = (node: Ast): boolean => {
		const names = variablesOf(node);
		if (!names.length) return true;
		const rows = truthTable(node, names).rows;
		return rows.every((v) => v === rows[0]);
	};
	// AND, OR and XOR are associative, so `a ⊻ c ⊻ a` prints as a flat chain and
	// reads as one. Comparing only the two halves of each node misses that: the
	// repeat is between a node and its grandchild, not between siblings.
	const operands = (node: Ast, t: Ast['t']): Ast[] =>
		node.t === t && (node.t === 'and' || node.t === 'or' || node.t === 'xor')
			? [...operands(node.a, t), ...operands(node.b, t)]
			: [node];

	const walk = (node: Ast): boolean => {
		if (node.t === 'var') return true;
		if (node.t === 'const') return false;
		if (node.t === 'not') return walk(node.a);
		// No half may be dead, and no two operands of one chain may be the same.
		if (constant(node.a) || constant(node.b)) return false;
		const flat = operands(node, node.t).map((x) => format(x, 'math'));
		if (new Set(flat).size !== flat.length) return false;
		return walk(node.a) && walk(node.b);
	};
	// A variable that cannot change the answer is the same kind of giveaway as a
	// dead sub-expression, so reject those too.
	const names = variablesOf(ast);
	const table = truthTable(ast, names);
	const allMatter = names.every((_, i) =>
		table.rows.some((out, row) => out !== table.rows[row ^ (1 << (names.length - 1 - i))])
	);
	if (!allMatter) return false;
	return !constant(ast) && walk(ast);
}

function gateOutput(random: () => number): Question | null {
	const gate = pick(random, gates);
	const table = truthTable(parseExpression(gate.source));
	const row = Math.floor(random() * table.rows.length);
	const bits = table.variables.map((_, i) => (row >> (table.variables.length - 1 - i)) & 1);
	const value = table.rows[row];
	// AND, OR and XOR all start with a vowel sound.
	const article = /^[AEIOUX]/.test(gate.name) ? 'an' : 'a';
	return {
		kind: 'gate-output',
		prompt:
			table.variables.length === 1
				? `What does ${article} ${gate.name} gate output when its input is ${bits[0]}?`
				: `What does ${article} ${gate.name} gate output when its inputs are ${bits[0]} and ${bits[1]}?`,
		options: ['0', '1'],
		answer: value ? 1 : 0,
		explanation: `${gate.name} is high when ${gate.outputHigh}, so this gives ${value ? 1 : 0}.`
	};
}

function identifyGate(random: () => number): Question | null {
	const gate = pick(random, twoInputGates);
	const table = truthTable(parseExpression(gate.source));
	const distractors = shuffle(
		random,
		twoInputGates.filter((g) => g.slug !== gate.slug)
	)
		.slice(0, 3)
		.map((g) => g.name);
	const options = assemble(random, gate.name, distractors);
	return {
		kind: 'identify-gate',
		prompt: 'Which gate has this truth table?',
		table,
		tableOutputLabel: 'Q',
		options,
		answer: options.indexOf(gate.name),
		explanation: `This is ${gate.name}: the output is high when ${gate.outputHigh}.`
	};
}

function evaluateQuestion(random: () => number): Question | null {
	const pool = ['a', 'b', 'c'].slice(0, 2 + Math.floor(random() * 2));
	const ast = randomAst(random, pool, 2);
	const variables = variablesOf(ast);
	if (variables.length < 2) return null;
	if (!isClean(ast)) return null;
	const values: Record<string, boolean> = {};
	for (const name of variables) values[name] = random() < 0.5;
	const result = evaluate(ast, values);
	const assignment = variables.map((n) => `${n} = ${values[n] ? 1 : 0}`).join(', ');
	return {
		kind: 'evaluate',
		prompt: `What is the output when ${assignment}?`,
		detail: format(ast, 'math'),
		options: ['0', '1'],
		answer: result ? 1 : 0,
		explanation: `Substituting the values gives ${result ? 1 : 0}.`
	};
}

function equivalentQuestion(random: () => number): Question | null {
	const pool = ['a', 'b', 'c'];
	const ast = randomAst(random, pool, 2);
	const table = truthTable(ast);
	if (table.variables.length < 2 || !isClean(ast)) return null;
	const minimal = simplify(table, 'math');
	if (!minimal.termCount) return null; // skip constants, they read oddly
	const correct = minimal.text;
	if (correct === format(ast, 'math')) return null; // no simplification to find

	// Distractors have to be genuinely wrong, so each is checked.
	const candidates: string[] = [];
	for (let attempt = 0; attempt < 40 && candidates.length < 3; attempt++) {
		const other = randomAst(random, table.variables, 2);
		if (variablesOf(other).length < 1) continue;
		const text = simplify(truthTable(other, table.variables), 'math').text;
		if (text === '0' || text === '1' || text === correct) continue;
		if (candidates.includes(text)) continue;
		if (equivalent(parseExpression(text), ast)) continue;
		candidates.push(text);
	}
	if (candidates.length < 3) return null;

	const options = assemble(random, correct, candidates);
	return {
		kind: 'equivalent',
		prompt: 'Which expression is equivalent to this one?',
		detail: format(ast, 'math'),
		options,
		answer: options.indexOf(correct),
		explanation: `${correct} has exactly the same truth table, and it is the minimal sum of products.`
	};
}

function countOnes(random: () => number): Question | null {
	const pool = ['a', 'b', 'c'];
	const ast = randomAst(random, pool, 2);
	const table = truthTable(ast);
	if (table.variables.length < 2 || !isClean(ast)) return null;
	const count = table.rows.filter(Boolean).length;
	if (count === 0 || count === table.rows.length) return null;

	const distractors: string[] = [];
	for (let delta = 1; distractors.length < 3 && delta <= table.rows.length; delta++) {
		for (const candidate of [count - delta, count + delta]) {
			if (candidate < 0 || candidate > table.rows.length) continue;
			if (distractors.length < 3 && !distractors.includes(String(candidate))) {
				distractors.push(String(candidate));
			}
		}
	}
	if (distractors.length < 3) return null;

	const options = assemble(random, String(count), distractors);
	return {
		kind: 'count-ones',
		prompt: `In how many of the ${table.rows.length} rows is this expression true?`,
		detail: format(ast, 'math'),
		options,
		answer: options.indexOf(String(count)),
		explanation: `Its truth table has ${count} row${count === 1 ? '' : 's'} where the output is 1, out of ${
			table.rows.length
		}.`
	};
}

/**
 * Draws an expression as a diagram with nothing that gives the answer away,
 * plus a second version showing the answer for once the question is marked.
 */
/**
 * How big a quiz diagram is allowed to get. Past this a circuit stops being
 * something you can read at a glance on paper, and the question turns into a
 * tracing exercise rather than a logic one.
 */
export const MAX_QUIZ_GATES = 10;

function diagramOf(
	ast: Ast,
	reveal: { values?: Record<string, boolean>; caption?: string } = {}
): { svg: string; alt: string; solved: string; print: string } | null {
	try {
		const circuit = buildCircuit(ast);
		if (circuit.gateCount > MAX_QUIZ_GATES) return null;
		const base = { standard: 'ansi' as const, palette: 'colour' as const };
		return {
			svg: circuitToSvg(circuit, { ...base, outputLabel: 'Q' }),
			// Worksheets end up on paper, where the dark palette is a waste of ink.
			print: circuitToSvg(circuit, { ...base, palette: 'mono', outputLabel: 'Q' }),
			// Deliberately no gate count: for the read-the-circuit question that would
			// hand a screen reader user the answer the sighted reader has to work for.
			alt: `A logic circuit diagram with inputs ${variablesOf(ast).join(', ')}`,
			// With the inputs applied, every wire shows its state.
			solved: circuitToSvg(circuit, {
				...base,
				states: reveal.values ? circuitStates(circuit, reveal.values) : undefined,
				caption: reveal.caption
			})
		};
	} catch (e) {
		if (e instanceof CircuitTooLarge) return null;
		throw e;
	}
}

function circuitExpression(random: () => number): Question | null {
	const pool = ['a', 'b', 'c'];
	const ast = randomAst(random, pool, 2);
	const table = truthTable(ast);
	if (table.variables.length < 2 || !isClean(ast)) return null;
	const correct = format(ast, 'math');
	const drawing = diagramOf(ast, { caption: correct });
	if (!drawing) return null;
	let gateCount: number;
	try {
		gateCount = buildCircuit(ast).gateCount;
	} catch {
		return null;
	}
	const candidates: string[] = [];
	for (let attempt = 0; attempt < 120 && candidates.length < 3; attempt++) {
		const other = randomAst(random, table.variables, 2);
		if (!isClean(other)) continue;
		// A wrong answer with a different number of gates can be dismissed by
		// counting the shapes in the picture, without reading any of them.
		try {
			if (buildCircuit(other).gateCount !== gateCount) continue;
		} catch {
			continue;
		}
		const text = format(other, 'math');
		if (text === correct || candidates.includes(text)) continue;
		if (equivalent(other, ast)) continue; // must actually be a wrong answer
		candidates.push(text);
	}
	if (candidates.length < 3) return null;

	const options = assemble(random, correct, candidates);
	return {
		kind: 'circuit-expression',
		prompt: 'Which expression does this circuit implement?',
		svg: drawing.svg,
		svgAlt: drawing.alt,
		svgSolved: drawing.solved,
		svgPrint: drawing.print,
		options,
		answer: options.indexOf(correct),
		explanation: `Reading the diagram from the inputs gives ${correct}.`
	};
}

function circuitOutput(random: () => number): Question | null {
	const pool = ['a', 'b', 'c'];
	// Tracing a signal stays readable at depth 3, and the answer is still 0 or 1,
	// so these can be bigger than the ones you have to read an expression off.
	const ast = randomAst(random, pool, random() < 0.4 ? 3 : 2);
	const variables = variablesOf(ast);
	if (variables.length < 2 || !isClean(ast)) return null;
	const values: Record<string, boolean> = {};
	for (const name of variables) values[name] = random() < 0.5;
	const result = evaluate(ast, values);
	const drawing = diagramOf(ast, { values });
	if (!drawing) return null;
	const assignment = variables.map((n) => `${n} = ${values[n] ? 1 : 0}`).join(', ');
	return {
		kind: 'circuit-output',
		prompt: `What does this circuit output when ${assignment}?`,
		svg: drawing.svg,
		svgAlt: drawing.alt,
		svgSolved: drawing.solved,
		svgPrint: drawing.print,
		options: ['0', '1'],
		answer: result ? 1 : 0,
		// No claim about colour here: the same explanation is printed in black and
		// white on a worksheet. The practice page adds that note itself, where it
		// really does reveal a coloured diagram.
		explanation: `Following the signals through the gates gives ${result ? 1 : 0}.`
	};
}

const GENERATORS = [
	gateOutput,
	identifyGate,
	evaluateQuestion,
	equivalentQuestion,
	countOnes,
	circuitExpression,
	circuitOutput
];

export type Topic = 'mixed' | 'gates' | 'truth-tables' | 'expressions' | 'simplifying' | 'diagrams';

export const topics: { id: Topic; label: string; blurb: string }[] = [
	{ id: 'mixed', label: 'Mixed', blurb: 'A bit of everything' },
	{ id: 'diagrams', label: 'Diagrams', blurb: 'Reading a circuit drawing' },
	{ id: 'gates', label: 'Gates', blurb: 'What each gate does, and recognising one' },
	{ id: 'truth-tables', label: 'Truth tables', blurb: 'Reading and counting rows' },
	{ id: 'expressions', label: 'Expressions', blurb: 'Evaluating an expression by hand' },
	{ id: 'simplifying', label: 'Simplifying', blurb: 'Spotting an equivalent, shorter form' }
];

const BY_TOPIC: Record<Topic, typeof GENERATORS> = {
	mixed: GENERATORS,
	gates: [gateOutput, identifyGate],
	'truth-tables': [identifyGate, countOnes],
	expressions: [evaluateQuestion],
	simplifying: [equivalentQuestion],
	diagrams: [circuitExpression, circuitOutput]
};

/**
 * Identifies a question regardless of how its options were shuffled, so the
 * same one is not asked again a few turns later.
 */
export const questionSignature = (q: Question) =>
	[q.kind, q.prompt, q.detail ?? '', q.table ? q.table.rows.map(Number).join('') : '', q.svg ?? ''].join('|');

/**
 * Builds one question. The same seed always produces the same question, which
 * keeps server rendering and the browser in step.
 */
export function makeQuestion(seed: number, topic: Topic = 'mixed'): Question {
	const generators = BY_TOPIC[topic] ?? GENERATORS;
	// The generator is chosen from the seed alone and then retried with fresh
	// randomness. Advancing to the next generator on every refusal would pour
	// them all into whichever one never refuses, and a mixed run would be most
	// of that one kind.
	const chosen = generators[seed % generators.length];
	for (let attempt = 0; attempt < 200; attempt++) {
		const question = chosen(rng(seed + attempt * 7919));
		if (question) return question;
	}
	// It will not produce anything for this seed at all. Only now try the rest,
	// and only ones this topic actually offers.
	for (let i = 1; i < generators.length; i++) {
		for (let attempt = 0; attempt < 50; attempt++) {
			const question = generators[(seed + i) % generators.length](rng(seed + i * 104729 + attempt * 7919));
			if (question) return question;
		}
	}
	// Nothing at all, which should not happen; the one generator that cannot
	// refuse is at least always a real question.
	return gateOutput(rng(seed))!;
}

/**
 * Picks a seed whose question has not come up in `recent`, so a run of
 * questions does not repeat itself within the last twenty or so.
 */
export function nextQuestion(
	topic: Topic,
	recent: string[],
	random: () => number = Math.random
): { seed: number; question: Question } {
	let fallback: { seed: number; question: Question } | null = null;
	for (let attempt = 0; attempt < 80; attempt++) {
		const seed = Math.floor(random() * 1_000_000) + 1;
		const question = makeQuestion(seed, topic);
		fallback ??= { seed, question };
		if (!recent.includes(questionSignature(question))) return { seed, question };
	}
	// A narrow topic can run out of fresh questions; repeating beats stalling.
	return fallback!;
}

export const RECENT_LIMIT = 20;
