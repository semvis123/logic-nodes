// Stage 3: boolean algebra. Writing a circuit as an expression, the laws that
// rewrite one, De Morgan, and simplifying step by step. Every answer here is
// computed by the expression engine, and every expression option is checked
// against the right one with a truth table, so a distractor is never secretly
// correct.

import { parseExpression, format, evaluate, equivalent, simplify, truthTable, type Ast } from '../../boolean.js';
import { laws } from '../../laws.js';
import { simplifySteps } from '../../steps.js';
import { fromPractice } from '../fromPractice.js';
import { assemble, int, pick, shuffle } from '../random.js';
import type { CourseQuestion, Random, StageMeta } from '../types.js';

// --- helpers -----------------------------------------------------------------

const LETTERS = ['a', 'b', 'c', 'd'];

/** Distinct variable names, so a question is not always about a and b. */
const letters = (random: Random, n: number) => shuffle(random, LETTERS).slice(0, n);

/** An expression as the site prints it: brackets only where the order needs them. */
const show = (text: string) => format(parseExpression(text), 'math');

/** Renames a, b and c in a law's text, keeping the law's own bracketing. */
const rename = (text: string, map: Record<string, string>) => text.replace(/[abc]/g, (v) => map[v] ?? v);

/**
 * Wrong answers that are really wrong: drops any candidate that computes the
 * same function as the right answer, and any duplicate, then keeps up to three.
 */
function wrongOnes(right: Ast, candidates: string[]): string[] {
	const rightText = format(right, 'math');
	const kept: string[] = [];
	for (const candidate of candidates) {
		const text = show(candidate);
		if (text === rightText || kept.includes(text)) continue;
		if (equivalent(parseExpression(text), right)) continue;
		kept.push(text);
	}
	return kept.slice(0, 3);
}

const v = (name: string): Ast => ({ t: 'var', name });
const not = (a: Ast): Ast => ({ t: 'not', a });
const and = (a: Ast, b: Ast): Ast => ({ t: 'and', a, b });
const or = (a: Ast, b: Ast): Ast => ({ t: 'or', a, b });

// --- lesson 1: writing a circuit as an expression ---------------------------

const precedence = (random: Random): CourseQuestion => {
	const [x, y, z] = letters(random, 3);
	const kinds = [
		{
			plain: `${x} ∧ ${y} ∨ ${z}`,
			brackets: [`(${x} ∧ ${y}) ∨ ${z}`, `${x} ∧ (${y} ∨ ${z})`],
			tightest: 'AND',
			rule: 'AND is done before OR'
		},
		{
			plain: `${x} ∨ ${y} ∧ ${z}`,
			brackets: [`${x} ∨ (${y} ∧ ${z})`, `(${x} ∨ ${y}) ∧ ${z}`],
			tightest: 'AND',
			rule: 'AND is done before OR'
		},
		{
			plain: `¬${x} ∧ ${y}`,
			brackets: [`(¬${x}) ∧ ${y}`, `¬(${x} ∧ ${y})`],
			tightest: 'NOT',
			rule: 'NOT is done before AND'
		},
		{
			plain: `¬${x} ∨ ${y}`,
			brackets: [`(¬${x}) ∨ ${y}`, `¬(${x} ∨ ${y})`],
			tightest: 'NOT',
			rule: 'NOT is done before OR'
		}
	];
	const kind = pick(random, kinds);
	const plain = parseExpression(kind.plain);
	const right = kind.brackets.find((b) => equivalent(parseExpression(b), plain))!;
	const wrong = kind.brackets.filter((b) => !equivalent(parseExpression(b), plain));
	const { options, answer } = assemble(random, right, [...wrong, 'Both of them', 'Neither of them']);
	return {
		prompt: 'Which bracketed form means the same as this expression, written without brackets?',
		detail: kind.plain,
		options,
		answer,
		hints: [
			'Without brackets the order is fixed: NOT is applied first, then AND, then OR. Brackets are only needed to change that order.',
			`The tightest operator in ${kind.plain} is ${kind.tightest}, so it is done first. Put brackets round that part and see which option you get.`
		],
		explanation: `${kind.rule}, so ${kind.plain} is read as ${right}. ${wrong[0]} would need the brackets written in, because it changes the order.`
	};
};

const describeCircuit = (random: Random): CourseQuestion => {
	const [x, y, z] = letters(random, 3);
	const gateName = { and: 'AND', or: 'OR' } as const;
	const shape = int(random, 0, 2);
	let ast: Ast;
	let prompt: string;
	let candidates: string[];
	let firstPart: string;
	let lastGate: string;
	if (shape === 0) {
		// Two gates: the first feeds the second along with a third input.
		const g1 = pick(random, ['and', 'or'] as const);
		const g2 = pick(random, ['and', 'or'] as const);
		const first = g1 === 'and' ? and(v(x), v(y)) : or(v(x), v(y));
		ast = g2 === 'and' ? and(first, v(z)) : or(first, v(z));
		prompt = `An ${gateName[g1]} gate takes ${x} and ${y}. Its output goes into an ${gateName[g2]} gate together with ${z}. What is the expression for the ${gateName[g2]} gate's output?`;
		candidates = [
			`${x} ∧ ${y} ∨ ${z}`,
			`${x} ∧ (${y} ∨ ${z})`,
			`(${x} ∨ ${y}) ∧ ${z}`,
			`${x} ∨ ${y} ∧ ${z}`,
			`${x} ∧ ${y} ∧ ${z}`,
			`${x} ∨ ${y} ∨ ${z}`
		];
		firstPart = format(first, 'math');
		lastGate = gateName[g2];
	} else if (shape === 1) {
		// A NOT on one input, then a gate.
		const g = pick(random, ['and', 'or'] as const);
		ast = g === 'and' ? and(not(v(x)), v(y)) : or(not(v(x)), v(y));
		prompt = `A NOT gate inverts ${x}. Its output goes into an ${gateName[g]} gate together with ${y}. What is the expression for the ${gateName[g]} gate's output?`;
		candidates = [`¬(${x} ∧ ${y})`, `¬(${x} ∨ ${y})`, `${x} ∧ ¬${y}`, `${x} ∨ ¬${y}`, `¬${x} ∨ ${y}`, `¬${x} ∧ ${y}`];
		firstPart = `¬${x}`;
		lastGate = gateName[g];
	} else {
		// A gate, then a NOT on its output.
		const g = pick(random, ['and', 'or'] as const);
		ast = not(g === 'and' ? and(v(x), v(y)) : or(v(x), v(y)));
		prompt = `An ${gateName[g]} gate takes ${x} and ${y}, and its output goes through a NOT gate. What is the expression for the NOT gate's output?`;
		candidates = [
			`¬${x} ∧ ${y}`,
			`¬${x} ∨ ${y}`,
			`¬${x} ∧ ¬${y}`,
			`¬${x} ∨ ¬${y}`,
			`${x} ∧ ${y}`,
			`¬(${x} ∨ ${y})`,
			`¬(${x} ∧ ${y})`
		];
		firstPart = format(ast.t === 'not' ? ast.a : ast, 'math');
		lastGate = 'NOT';
	}
	const right = format(ast, 'math');
	const { options, answer } = assemble(random, right, wrongOnes(ast, candidates));
	return {
		prompt,
		options,
		answer,
		hints: [
			'Follow the wires from the inputs to the output, writing down each gate as you pass it. The last gate is the outermost operator of the expression.',
			`The first gate makes ${firstPart}. The ${lastGate} gate then works on that whole result, so it needs brackets round it if the usual order would split it up.`
		],
		explanation: `The first gate gives ${firstPart}. The ${lastGate} gate takes that as one of its inputs, which gives ${right}. Brackets are written only where the order of operations would otherwise read it differently.`
	};
};

/** The same expression with the variables replaced by their values, for a hint. */
function substituted(ast: Ast, values: Record<string, boolean>): Ast {
	switch (ast.t) {
		case 'var':
			return { t: 'const', v: values[ast.name] };
		case 'const':
			return ast;
		case 'not':
			return { t: 'not', a: substituted(ast.a, values) };
		default:
			return { t: ast.t, a: substituted(ast.a, values), b: substituted(ast.b, values) };
	}
}

const evaluateExpression = (random: Random): CourseQuestion => {
	const [x, y, z] = letters(random, 3);
	const pool = [
		`${x} ∧ ${y} ∨ ${z}`,
		`${x} ∧ (${y} ∨ ${z})`,
		`¬${x} ∧ ${y}`,
		`¬(${x} ∧ ${y})`,
		`${x} ∨ ¬${y} ∧ ${z}`,
		`(${x} ∨ ${y}) ∧ ¬${z}`,
		`¬${x} ∨ ¬${y}`,
		`¬(${x} ∨ ${y}) ∨ ${z}`
	];
	const text = pick(random, pool);
	const ast = parseExpression(text);
	const names = [x, y, z].filter((n) => text.includes(n));
	const values: Record<string, boolean> = {};
	for (const n of names) values[n] = random() < 0.5;
	const result = evaluate(ast, values);
	const assignment = names.map((n) => `${n} = ${values[n] ? 1 : 0}`).join(', ');
	const withValues = format(substituted(ast, values), 'math');

	// Describe the outermost operator with its two sides worked out.
	let working: string;
	if (ast.t === 'not') {
		const inner = evaluate(ast.a, values);
		working = `Inside the NOT, ${format(ast.a, 'math')} is ${inner ? 1 : 0}, and NOT flips it to ${result ? 1 : 0}.`;
	} else if (ast.t === 'and' || ast.t === 'or') {
		const l = evaluate(ast.a, values);
		const r = evaluate(ast.b, values);
		const rule = ast.t === 'and' ? 'AND needs both sides to be 1' : 'OR needs at least one side to be 1';
		working = `The left part, ${format(ast.a, 'math')}, is ${l ? 1 : 0} and the right part, ${format(
			ast.b,
			'math'
		)}, is ${r ? 1 : 0}. ${rule}, so the answer is ${result ? 1 : 0}.`;
	} else {
		working = `Working it through gives ${result ? 1 : 0}.`;
	}
	return {
		prompt: `What is this expression when ${assignment}?`,
		detail: text,
		options: ['0', '1'],
		answer: result ? 1 : 0,
		hints: [
			'Replace each letter with its value, then work from the innermost part outwards: NOT first, then AND, then OR.',
			`With the values in it reads ${withValues}. Do the NOTs first, then the ANDs, then the ORs.`
		],
		explanation: `With the values in, the expression is ${withValues}. ${working}`
	};
};

// --- lesson 2: the basic laws ------------------------------------------------

const BASIC = [
	'Identity',
	'Annulment',
	'Idempotence',
	'Complement',
	'Double negation',
	'Commutativity',
	'Associativity'
];

/** What to look for, per law, for the second hint. */
const CLUES: Record<string, string> = {
	Identity: 'one side combines a signal with the constant that changes nothing, 1 for AND or 0 for OR',
	Annulment: 'one side combines a signal with the constant that decides everything, 0 for AND or 1 for OR',
	Idempotence: 'the same signal appears twice on one side and once on the other',
	Complement: 'a signal is combined with its own NOT, and the other side is a constant',
	'Double negation': 'two NOTs sit on one signal',
	Commutativity: 'the two sides have the same parts in a different order',
	Associativity: 'the two sides have the same parts in the same order, with the brackets moved',
	Distributivity: 'one side has a bracket, and the other has the outside term multiplied into each part of it',
	Absorption: 'a term already contains the other term, and the whole thing collapses to the shorter one',
	Consensus:
		'three terms become two: the dropped one is made of the parts of the other two with the shared variable gone',
	'De Morgan': 'a NOT over a bracket becomes a NOT on each term, with AND and OR swapped'
};

const lawMap = (random: Random) => {
	const [p, q, r] = letters(random, 3);
	return { a: p, b: q, c: r };
};

const nameTheLaw = (random: Random): CourseQuestion => {
	const map = lawMap(random);
	const law = pick(
		random,
		laws.filter((l) => BASIC.includes(l.name) && l.category !== 'Exclusive or')
	);
	const left = rename(law.left, map);
	const right = rename(law.right, map);
	const others = shuffle(
		random,
		BASIC.filter((n) => n !== law.name)
	).slice(0, 3);
	const { options, answer } = assemble(random, law.name, others);
	return {
		prompt: 'Which law turns the left side into the right side?',
		detail: `${left} = ${right}`,
		options,
		answer,
		hints: [
			'Look at what changed between the two sides: did a constant disappear, did a repeated term disappear, did the order change, or did the brackets move?',
			`Here ${CLUES[law.name]}.`
		],
		explanation: `This is ${law.name}: ${left} = ${right}. ${law.note}`
	};
};

const oneLawSimplify = (random: Random): CourseQuestion => {
	const [x] = letters(random, 1);
	const pool = [
		`${x} ∧ 1`,
		`${x} ∨ 0`,
		`${x} ∧ 0`,
		`${x} ∨ 1`,
		`${x} ∧ ${x}`,
		`${x} ∨ ${x}`,
		`${x} ∧ ¬${x}`,
		`${x} ∨ ¬${x}`,
		`¬¬${x}`
	];
	const text = pick(random, pool);
	const working = simplifySteps(parseExpression(text));
	const step = working.steps[0];
	const right = working.text;
	const { options, answer } = assemble(random, right, [x, `¬${x}`, '0', '1']);
	return {
		prompt: 'Simplify this expression as far as it goes.',
		detail: text,
		options,
		answer,
		hints: [
			'Ask what the second part is doing: a constant either changes nothing or decides everything, a repeat adds nothing, and a signal with its own NOT is fixed at one value.',
			`This is the ${step.law} law: ${step.detail}.`
		],
		explanation: `${step.law}: ${step.detail}. So ${text} = ${right}.`
	};
};

const whichEquals = (random: Random): CourseQuestion => {
	const [x] = letters(random, 1);
	const pool = [
		`${x} ∧ 1`,
		`${x} ∨ 0`,
		`${x} ∧ 0`,
		`${x} ∨ 1`,
		`${x} ∧ ${x}`,
		`${x} ∨ ${x}`,
		`${x} ∧ ¬${x}`,
		`${x} ∨ ¬${x}`,
		`¬¬${x}`
	];
	const target = pick(random, [x, '0', '1']);
	const targetAst = parseExpression(target);
	const yes = pool.filter((p) => equivalent(parseExpression(p), targetAst));
	const no = pool.filter((p) => !equivalent(parseExpression(p), targetAst));
	const right = pick(random, yes);
	const { options, answer } = assemble(random, right, shuffle(random, no).slice(0, 3));
	const step = simplifySteps(parseExpression(right)).steps[0];
	const what = target === x ? `${x} on its own` : `the constant ${target}`;
	return {
		prompt: `Which of these is always equal to ${what}?`,
		options,
		answer,
		hints: [
			`Try ${x} = 0 and then ${x} = 1 in each option. The right one gives ${
				target === x ? `${x} back` : target
			} both times.`,
			`Look for the ${step.law} law: ${step.detail}.`
		],
		explanation: `${right} = ${target} by the ${step.law} law: ${step.detail}. Each of the other options gives a different value for at least one value of ${x}.`
	};
};

// --- lesson 3: distributing and absorbing -----------------------------------

const applyDistributive = (random: Random): CourseQuestion => {
	const [x, y, z] = letters(random, 3);
	// One negated literal now and then, so the shape is not always the textbook one.
	const yy = random() < 0.3 ? `¬${y}` : y;
	const andOverOr = random() < 0.5;
	const left = andOverOr ? `${x} ∧ (${yy} ∨ ${z})` : `${x} ∨ ${yy} ∧ ${z}`;
	const rightAst = andOverOr
		? or(and(v(x), parseExpression(yy)), and(v(x), v(z)))
		: and(or(v(x), parseExpression(yy)), or(v(x), v(z)));
	const right = format(rightAst, 'math');
	const candidates = andOverOr
		? [
				`${x} ∧ ${yy} ∨ ${z}`,
				`(${x} ∨ ${yy}) ∧ (${x} ∨ ${z})`,
				`${x} ∨ ${yy} ∧ ${z}`,
				`${x} ∧ ${yy} ∧ ${x} ∧ ${z}`,
				`${x} ∧ ${yy} ∨ ${x} ∨ ${z}`
		  ]
		: [
				`${x} ∨ ${yy} ∧ ${x} ∨ ${z}`,
				`${x} ∧ ${yy} ∨ ${x} ∧ ${z}`,
				`${x} ∨ ${yy} ∨ ${x} ∨ ${z}`,
				`(${x} ∨ ${yy}) ∧ ${z}`,
				`(${x} ∧ ${yy}) ∨ (${x} ∧ ${z})`
		  ];
	const { options, answer } = assemble(random, right, wrongOnes(rightAst, candidates));
	const outer = andOverOr ? 'AND' : 'OR';
	const inner = andOverOr ? 'OR' : 'AND';
	// Only the AND-over-OR form shows a bracket; the other has a bare AND term.
	const part = andOverOr ? 'the bracket' : `the AND term ${yy} ∧ ${z}`;
	return {
		prompt: andOverOr
			? 'Use the distributive law to multiply out this expression. Which of these is the result?'
			: 'Use the distributive law, OR over AND, to rewrite this expression. Which of these is the result?',
		detail: show(left),
		options,
		answer,
		hints: [
			`The distributive law copies the outside term into each part of ${part}: the ${outer} with ${x} is done with ${yy} and again with ${z}, and the two results are joined by the ${inner} that sat between ${yy} and ${z}.`,
			`Take ${x} ${outer} ${yy}, then ${x} ${outer} ${z}, and join the two with ${inner}.`
		],
		explanation: `${x} is combined with each part of ${part} in turn, and the two results are joined by ${inner}: ${show(
			left
		)} = ${right}. A truth table confirms both sides agree on every row.`
	};
};

const whichLawUsed = (random: Random): CourseQuestion => {
	const map = lawMap(random);
	const names = ['Distributivity', 'Absorption', 'Consensus'];
	const law = pick(
		random,
		laws.filter((l) => names.includes(l.name))
	);
	// Shown in whichever direction, since a law is used both ways.
	const forwards = random() < 0.6;
	const left = rename(forwards ? law.left : law.right, map);
	const right = rename(forwards ? law.right : law.left, map);
	const others = shuffle(random, [
		...names.filter((n) => n !== law.name),
		'Idempotence',
		'Identity',
		'Commutativity'
	]).slice(0, 3);
	const { options, answer } = assemble(random, law.name, others);
	return {
		prompt: 'Which law turns the left side into the right side?',
		detail: `${left} = ${right}`,
		options,
		answer,
		hints: [
			'Count the terms on each side. Distributivity changes brackets into terms or back; absorption and consensus delete a whole term, or put one back when the law is read from right to left.',
			forwards ? `Here ${CLUES[law.name]}.` : `Read from right to left, ${CLUES[law.name]}.`
		],
		explanation: `This is ${law.name}${forwards ? '' : ', read from right to left'}: ${left} = ${right}. ${law.note}`
	};
};

const absorbedTerm = (random: Random): CourseQuestion => {
	const [x, y, z] = letters(random, 3);
	const sumForm = random() < 0.5;
	const terms = shuffle(random, sumForm ? [x, `${x} ∧ ${y}`, z] : [x, `(${x} ∨ ${y})`, z]);
	const joiner = sumForm ? ' ∨ ' : ' ∧ ';
	const whole = parseExpression(terms.join(joiner));
	const removable = terms.filter((t) => equivalent(parseExpression(terms.filter((o) => o !== t).join(joiner)), whole));
	const right = removable[0];
	const wrong = terms.filter((t) => t !== right);
	const { options, answer } = assemble(random, right, [...wrong, 'None of them']);
	const kind = sumForm ? 'term' : 'bracket';
	return {
		prompt: `In this expression, which ${kind} can be removed without changing what it computes?`,
		detail: terms.join(joiner),
		options,
		answer,
		hints: [
			`Absorption: ${
				sumForm ? `${x} ∨ ${x} ∧ ${y} = ${x}` : `${x} ∧ (${x} ∨ ${y}) = ${x}`
			}. Look for a ${kind} that already contains another ${kind} of the expression.`,
			`${right} contains ${x}, and ${x} is also a ${kind} on its own, so ${x} does that job by itself.`
		],
		explanation: sumForm
			? `Whenever ${x} ∧ ${y} is 1, ${x} is 1 as well, so the OR is already 1 without it. Removing ${right} leaves ${terms
					.filter((t) => t !== right)
					.join(joiner)}, which has the same truth table. Removing ${x} or ${z} changes the table.`
			: `Whenever ${x} is 1, ${x} ∨ ${y} is 1 as well, so the bracket never blocks the AND on its own. Removing ${right} leaves ${terms
					.filter((t) => t !== right)
					.join(joiner)}, which has the same truth table. Removing ${x} or ${z} changes the table.`
	};
};

// --- lesson 4: De Morgan -----------------------------------------------------

/** De Morgan applied by hand: negate each term, swap the operator, cancel double NOTs. */
function pushNot(op: 'and' | 'or', terms: Ast[]): Ast {
	const flipped = terms.map((t) => (t.t === 'not' ? t.a : not(t)));
	return flipped.reduce((acc, t) => (op === 'and' ? or(acc, t) : and(acc, t)));
}

const rewriteDeMorgan = (random: Random): CourseQuestion => {
	const [x, y] = letters(random, 2);
	const op = pick(random, ['and', 'or'] as const);
	const negX = random() < 0.25;
	const negY = !negX && random() < 0.3;
	const tx = negX ? not(v(x)) : v(x);
	const ty = negY ? not(v(y)) : v(y);
	const start = not(op === 'and' ? and(tx, ty) : or(tx, ty));
	const startText = format(start, 'math');
	const rightAst = pushNot(op, [tx, ty]);
	const right = format(rightAst, 'math');
	const sx = format(tx, 'math');
	const sy = format(ty, 'math');
	const keep = op === 'and' ? '∧' : '∨';
	const swap = op === 'and' ? '∨' : '∧';
	const nx = format(negX ? v(x) : not(v(x)), 'math');
	const ny = format(negY ? v(y) : not(v(y)), 'math');
	const candidates = [
		`${nx} ${keep} ${ny}`, // negated each term but kept the operator
		`${sx} ${keep} ${sy}`, // dropped the NOT altogether
		`${sx} ${swap} ${sy}`, // swapped the operator but negated nothing
		`${nx} ${swap} ${sy}` // negated only the first term
	];
	const { options, answer } = assemble(random, right, wrongOnes(rightAst, candidates));
	const words = op === 'and' ? '"not both" means "at least one is missing"' : '"not either" means "both are missing"';
	return {
		prompt: 'Rewrite this with De Morgan so that no NOT covers a bracket.',
		detail: startText,
		options,
		answer,
		hints: [
			'Three moves: take the NOT off the bracket, put a NOT on every term inside, and swap the operator. Two NOTs on one term cancel.',
			`Negate ${sx} to get ${nx} and ${sy} to get ${ny}, then join them with ${swap} instead of ${keep}.`
		],
		explanation: `${startText} = ${right}: each term is negated and ${keep} becomes ${swap}, because ${words}. Keeping the operator, or dropping the NOT, gives a different truth table.`
	};
};

const gateEquivalent = (random: Random): CourseQuestion => {
	const [x, y] = letters(random, 2);
	const nor = random() < 0.5;
	const start = nor ? `¬(${x} ∨ ${y})` : `¬(${x} ∧ ${y})`;
	const startAst = parseExpression(start);
	const op = nor ? '∧' : '∨';
	const candidates = [`¬${x} ${op} ¬${y}`, `¬${x} ${op} ${y}`, `${x} ${op} ¬${y}`, `${x} ${op} ${y}`];
	const right = candidates.find((c) => equivalent(parseExpression(c), startAst))!;
	const { options, answer } = assemble(random, right, wrongOnes(startAst, candidates));
	const gate = nor ? 'NOR' : 'NAND';
	const using = nor ? 'AND' : 'OR';
	return {
		prompt: `A ${gate} gate computes ${start}. Which of these, using only NOT and ${using}, is the same thing?`,
		detail: start,
		options,
		answer,
		hints: [
			`De Morgan: negate every term inside the bracket and swap the operator. ${
				nor ? 'A NOT over an OR becomes an AND of NOTs.' : 'A NOT over an AND becomes an OR of NOTs.'
			}`,
			`Both ${x} and ${y} get a NOT, so the right option has a NOT on each of them.`
		],
		explanation: `${start} = ${right}. ${
			nor
				? `"Neither ${x} nor ${y}" is the same as "${x} is off and ${y} is off".`
				: `"Not both ${x} and ${y}" is the same as "${x} is off or ${y} is off".`
		} Try ${x} = 1, ${y} = 0 on the other options and at least one row disagrees.`
	};
};

const threeInputs = (random: Random): CourseQuestion => {
	const [x, y, z] = letters(random, 3);
	const op = pick(random, ['and', 'or'] as const);
	const negZ = random() < 0.3;
	const tz = negZ ? not(v(z)) : v(z);
	const inner = op === 'and' ? and(and(v(x), v(y)), tz) : or(or(v(x), v(y)), tz);
	const start = not(inner);
	const startText = format(start, 'math');
	const rightAst = pushNot(op, [v(x), v(y), tz]);
	const right = format(rightAst, 'math');
	const keep = op === 'and' ? '∧' : '∨';
	const swap = op === 'and' ? '∨' : '∧';
	const sz = format(tz, 'math');
	const nz = format(negZ ? v(z) : not(v(z)), 'math');
	const candidates = [
		`¬${x} ${keep} ¬${y} ${keep} ${nz}`,
		`¬${x} ${swap} ¬${y} ${swap} ${sz}`,
		`¬${x} ${swap} ${y} ${swap} ${sz}`,
		`${x} ${swap} ${y} ${swap} ${sz}`
	];
	const { options, answer } = assemble(random, right, wrongOnes(rightAst, candidates));
	return {
		prompt: 'Apply De Morgan to this three-input expression.',
		detail: startText,
		options,
		answer,
		hints: [
			'The law works for any number of terms: negate every term inside the bracket and swap every operator between them.',
			`Three terms, so three NOTs: ¬${x}, ¬${y} and ${nz}, joined by ${swap}.`
		],
		explanation: `${startText} = ${right}. Every term gets a NOT and every ${keep} becomes ${swap}${
			negZ ? `; the two NOTs on ${z} cancel` : ''
		}. This is the two-input law applied twice, since ${x} ${keep} ${y} ${keep} ${sz} is (${x} ${keep} ${y}) ${keep} ${sz}.`
	};
};

// --- lesson 5: simplifying step by step -------------------------------------

/**
 * Small expressions the step engine can work through. Each one has at least
 * one step and reaches the minimiser's answer, which the course tests check.
 */
const POOL = [
	'¬(a ∨ b) ∨ ¬a ∧ b',
	'a ∧ (b ∨ ¬b)',
	'¬(a ∧ b) ∨ a',
	'(a ∨ b) ∧ (a ∨ c)',
	'a ∨ a ∧ b ∨ a ∧ c',
	'¬(¬a ∨ ¬b) ∧ b',
	'a ∧ b ∨ a ∧ (b ∨ c)',
	'a ∧ ¬b ∨ ¬(a ∨ b)',
	'a ∧ b ∧ 1 ∨ 0',
	'¬a ∨ ¬(a ∨ b)',
	'a ∧ ¬(a ∨ b)',
	'a ∧ b ∨ a ∧ ¬b',
	'(a ∨ b) ∧ ¬a',
	'a ∧ (a ∨ b) ∧ c',
	'a ∨ ¬a ∧ b',
	'a ∧ b ∨ ¬a ∧ b',
	'¬(a ∧ ¬b) ∨ b',
	'a ∧ (b ∨ c) ∨ a ∧ ¬b'
];

const nextStep = (random: Random): CourseQuestion => {
	const map = lawMap(random);
	const text = rename(pick(random, POOL), map);
	const ast = parseExpression(text);
	const start = format(ast, 'math');
	const working = simplifySteps(ast);
	const step = working.steps[0];
	// Other pool members' first lines, and a few plausible misreadings, as
	// wrong answers; anything that happens to equal the start is dropped.
	const candidates = shuffle(random, [
		...POOL.filter((p) => p !== text).map((p) => simplifySteps(parseExpression(rename(p, map))).steps[0]?.text ?? ''),
		rename('a ∧ b', map),
		rename('a ∨ b', map),
		rename('¬a ∧ b', map),
		rename('¬a', map)
	]).filter(Boolean);
	const { options, answer } = assemble(random, step.text, wrongOnes(ast, candidates));
	const rest = working.steps.length - 1;
	return {
		prompt: 'Simplifying this expression one law at a time, what does the first step give?',
		detail: start,
		options,
		answer,
		hints: [
			'Look for a law that fits some part of it: a NOT over a bracket, a constant, a term that appears twice, a term next to its own NOT, or a term that already contains another.',
			`The first law that applies is ${step.law}: ${step.detail}.`
		],
		explanation: `${step.law}: ${step.detail}, which gives ${step.text}.${
			rest > 0
				? ` After that, ${rest} more step${rest === 1 ? ' reaches' : 's reach'} ${working.text}.`
				: ' No law applies after that.'
		}`
	};
};

const minimalForm = (random: Random): CourseQuestion => {
	const map = lawMap(random);
	const text = rename(pick(random, POOL), map);
	const ast = parseExpression(text);
	const start = format(ast, 'math');
	const working = simplifySteps(ast);
	const right = simplify(truthTable(ast), 'math').text;
	const candidates = shuffle(random, [
		...POOL.filter((p) => p !== text).map((p) => simplify(truthTable(parseExpression(rename(p, map))), 'math').text),
		rename('a ∧ b', map),
		rename('a ∨ b', map),
		rename('¬a ∨ b', map),
		rename('¬a ∧ ¬b', map),
		rename('a', map),
		rename('¬b', map)
	]);
	const { options, answer } = assemble(random, right, wrongOnes(ast, candidates));
	const trail = working.steps.map((s) => s.law).join(', then ');
	return {
		prompt: 'What is the simplest form of this expression?',
		detail: start,
		options,
		answer,
		hints: [
			'Apply the laws until none fits. Or count the rows where the expression is 1 and find the option that is 1 on exactly those rows.',
			`The working starts with ${working.steps[0].law}: ${working.steps[0].detail}.`
		],
		explanation: `${trail}: the laws take ${start} down to ${working.text}, and the calculator's minimiser gives the same answer, ${right}.`
	};
};

// --- the stage ---------------------------------------------------------------

export const algebra: StageMeta = {
	id: 'algebra',
	title: 'Boolean algebra',
	tagline: 'Writing a circuit down as an expression, and rearranging it with a few laws.',
	lessons: [
		{
			slug: 'writing-circuits-as-expressions',
			title: 'Writing a circuit as an expression',
			blurb:
				'Three notations for the same circuit, the order operators are applied in, and going between words and symbols.',
			description:
				'How to write a logic circuit as a boolean expression: the maths, engineering and programming notations, precedence and brackets, and reading a circuit off an expression.',
			minutes: 12,
			generators: [precedence, describeCircuit, fromPractice('expressions'), evaluateExpression],
			deeper: [
				{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
				{ href: '/boolean-algebra-laws', label: 'The laws of boolean algebra' }
			],
			build: { href: '/simulator', label: 'a circuit from an expression' }
		},
		{
			slug: 'the-basic-laws',
			title: 'The basic laws',
			blurb: 'Seven small rules that are always true, each proved by a truth table you can click through.',
			description:
				'The basic laws of boolean algebra: identity, annulment, idempotence, complement, double negation, commutativity and associativity, each explained and proved.',
			minutes: 14,
			generators: [nameTheLaw, oneLawSimplify, whichEquals, fromPractice('simplifying')],
			deeper: [
				{ href: '/boolean-algebra-laws', label: 'Every law, with its proof' },
				{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' }
			]
		},
		{
			slug: 'distributive-and-absorption',
			title: 'Distributing and absorbing',
			blurb: 'Multiplying out brackets both ways, and the law that deletes a whole term.',
			description:
				'The distributive law of boolean algebra in both directions, the absorption law with its intuition, and the consensus law, each proved with a truth table.',
			minutes: 14,
			generators: [applyDistributive, whichLawUsed, absorbedTerm],
			deeper: [
				{ href: '/boolean-algebra-laws#law-distributivity', label: 'Distributivity, with its proof' },
				{ href: '/boolean-algebra-laws#law-absorption', label: 'Absorption, with its proof' },
				{ href: '/boolean-algebra-laws#law-consensus', label: 'Consensus, with its proof' }
			]
		},
		{
			slug: 'de-morgan',
			title: "De Morgan's laws",
			blurb: 'How a NOT moves through a bracket: negate every term and swap the operator.',
			description:
				"De Morgan's laws explained in words, proved with truth tables, drawn as bubble pushing on gates, extended to more inputs, and the mistake of dropping the bar.",
			minutes: 14,
			generators: [rewriteDeMorgan, gateEquivalent, threeInputs],
			deeper: [
				{ href: '/de-morgans-laws', label: "De Morgan's laws, in depth" },
				{ href: '/nand-nor-converter', label: 'NAND and NOR converter' }
			]
		},
		{
			slug: 'simplifying-step-by-step',
			title: 'Simplifying step by step',
			blurb: 'A method for making an expression smaller, with two worked derivations and a way to check the answer.',
			description:
				'How to simplify a boolean expression by hand: look for a law, apply it, repeat, with worked examples naming the law on every line and a truth table check at the end.',
			minutes: 16,
			generators: [nextStep, minimalForm, fromPractice('simplifying')],
			deeper: [
				{ href: '/boolean-algebra-examples', label: 'Twelve worked simplifications' },
				{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
				{ href: '/practice?topic=simplifying', label: 'Practice simplifying' }
			]
		}
	]
};
