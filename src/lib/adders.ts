// Multi-bit adders: the ripple carry chain and the carry lookahead unit that
// replaces it. Everything the adder page shows, from the column by column
// addition to the lookahead equations and the gate depths, is produced here
// from the same full adder rule, and the test suite checks that the lookahead
// carries agree with the ripple carries on every input.

import { parseExpression, evaluate, type Ast, type Output } from './boolean.js';
import { buildCircuit } from './circuit.js';
import { toBits } from './numbers.js';

// The engine reads a variable as a single letter, so the bits of the two
// operands and the carry in get letters, and the drawing relabels them.
const A_LETTERS = 'abcd';
const B_LETTERS = 'efgh';
const CIN = 'z';
export const MAX_ADDER_WIDTH = A_LETTERS.length;

/** The engine's name for a bit of operand A, of operand B, and for the carry in. */
export const aVar = (i: number) => A_LETTERS[i];
export const bVar = (i: number) => B_LETTERS[i];
export const cinVar = CIN;

/** What the diagram prints for each variable: A0, B2, Cin. */
export const inputLabels: Record<string, string> = {
	...Object.fromEntries([...A_LETTERS].map((letter, i) => [letter, `A${i}`])),
	...Object.fromEntries([...B_LETTERS].map((letter, i) => [letter, `B${i}`])),
	[CIN]: 'Cin'
};

/** Swaps the single letter inputs of a drawn circuit for their readable labels. */
export function labelInputs<T extends { nodes: { kind: string; label: string }[] }>(circuit: T): T {
	for (const node of circuit.nodes) if (node.kind === 'input') node.label = inputLabels[node.label] ?? node.label;
	return circuit;
}

export type Bit = 0 | 1;

/** One column of an addition: what went in, what came out. */
export type Column = {
	/** Bit position, 0 for the least significant. */
	position: number;
	a: Bit;
	b: Bit;
	cin: Bit;
	sum: Bit;
	cout: Bit;
};

export type Addition = {
	width: number;
	a: number;
	b: number;
	cin: Bit;
	/** The columns, least significant first, the order the carry travels in. */
	columns: Column[];
	/** The bits of each operand and the result, most significant first, for printing. */
	aBits: Bit[];
	bBits: Bit[];
	sumBits: Bit[];
	/** The carries c0 to cn, least significant first, so carries[n] is the carry out. */
	carries: Bit[];
	/** The unsigned result, which wraps when the carry out is 1. */
	unsigned: number;
	carryOut: Bit;
	/** Signed overflow: the carry into the top bit differs from the carry out of it. */
	overflow: boolean;
};

/** The full adder rule, which every column applies. */
export const fullAdder = (a: Bit, b: Bit, cin: Bit): { sum: Bit; cout: Bit } => ({
	sum: ((a ^ b ^ cin) & 1) as Bit,
	cout: ((a & b) | (cin & (a ^ b))) as Bit
});

/** The full adder truth table, in counting order of (a, b, cin). */
export function fullAdderRows(): { a: Bit; b: Bit; cin: Bit; sum: Bit; cout: Bit }[] {
	const rows = [];
	for (let i = 0; i < 8; i++) {
		const a = ((i >> 2) & 1) as Bit;
		const b = ((i >> 1) & 1) as Bit;
		const cin = (i & 1) as Bit;
		rows.push({ a, b, cin, ...fullAdder(a, b, cin) });
	}
	return rows;
}

/** Adds two unsigned values column by column, the way a ripple carry adder does. */
export function rippleAdd(a: number, b: number, width: number, cin: Bit = 0): Addition {
	const aBits = toBits(a, width);
	const bBits = toBits(b, width);
	const columns: Column[] = [];
	const carries: Bit[] = [cin];
	let carry = cin;
	for (let position = 0; position < width; position++) {
		const ai = aBits[width - 1 - position];
		const bi = bBits[width - 1 - position];
		const { sum, cout } = fullAdder(ai, bi, carry);
		columns.push({ position, a: ai, b: bi, cin: carry, sum, cout });
		carries.push(cout);
		carry = cout;
	}
	const sumBits = columns.map((c) => c.sum).reverse();
	return {
		width,
		a,
		b,
		cin,
		columns,
		aBits,
		bBits,
		sumBits,
		carries,
		unsigned: sumBits.reduce<number>((total, bit) => total * 2 + bit, 0),
		carryOut: carry,
		overflow: carries[width] !== carries[width - 1]
	};
}

/**
 * The ripple carry adder as expressions the circuit generator can draw: each
 * carry is written in terms of the one before, so identical subterms collapse
 * into shared gates and the drawing is the chain of full adders it should be.
 */
export function rippleCarryExpressions(width: number, withCarryIn = true): { name: string; expression: string }[] {
	if (width > MAX_ADDER_WIDTH) throw new Error(`The adder expressions go up to ${MAX_ADDER_WIDTH} bits`);
	const outputs: { name: string; expression: string }[] = [];
	let carry = withCarryIn ? CIN : '';
	for (let i = 0; i < width; i++) {
		const a = aVar(i);
		const b = bVar(i);
		if (carry) {
			outputs.push({ name: `s${i}`, expression: `${a} ^ ${b} ^ (${carry})` });
			carry = `(${a} & ${b}) | ((${carry}) & (${a} ^ ${b}))`;
		} else {
			// The first column of an adder with no carry in is a half adder.
			outputs.push({ name: `s${i}`, expression: `${a} ^ ${b}` });
			carry = `${a} & ${b}`;
		}
	}
	outputs.push({ name: 'cout', expression: carry });
	return outputs;
}

export type LookaheadCarry = {
	/** Which carry this is: c1 is the carry into bit 1. */
	index: number;
	/** In generate and propagate terms, as a reader would write it. */
	text: string;
	/** The same carry in the engine's syntax over the a, b and cin variables. */
	expression: string;
	/** Number of product terms, which is the OR gate's fan-in. */
	terms: number;
};

/**
 * The carry lookahead equations. Each carry is a sum of products in the
 * generate and propagate signals of the columns below it, none of which waits
 * on another carry, which is the whole point.
 */
export function lookaheadCarries(width: number): LookaheadCarry[] {
	const g = (i: number) => `G${i}`;
	const p = (i: number) => `P${i}`;
	if (width > MAX_ADDER_WIDTH) throw new Error(`The adder expressions go up to ${MAX_ADDER_WIDTH} bits`);
	const gExpr = (i: number) => `(${aVar(i)} & ${bVar(i)})`;
	const pExpr = (i: number) => `(${aVar(i)} ^ ${bVar(i)})`;
	const carries: LookaheadCarry[] = [];
	for (let index = 1; index <= width; index++) {
		const products: string[] = [];
		const exprs: string[] = [];
		// c_index = G_{index-1} + P_{index-1} G_{index-2} + ... + P_{index-1}...P_0 c0
		for (let k = index - 1; k >= 0; k--) {
			const propagates = Array.from({ length: index - 1 - k }, (_, j) => index - 1 - j);
			products.push([...propagates.map(p), g(k)].join(''));
			exprs.push([...propagates.map(pExpr), gExpr(k)].join(' & '));
		}
		const allPropagate = Array.from({ length: index }, (_, j) => index - 1 - j);
		products.push([...allPropagate.map(p), 'c0'].join(''));
		exprs.push([...allPropagate.map(pExpr), CIN].join(' & '));
		carries.push({
			index,
			text: `c${index} = ${products.join(' + ')}`,
			expression: exprs.join(' | '),
			terms: products.length
		});
	}
	return carries;
}

/** The carry lookahead adder as expressions: sums from P and the lookahead carries. */
export function lookaheadExpressions(width: number): { name: string; expression: string }[] {
	const carries = lookaheadCarries(width);
	const outputs: { name: string; expression: string }[] = [];
	for (let i = 0; i < width; i++) {
		const carry = i === 0 ? CIN : `(${carries[i - 1].expression})`;
		outputs.push({ name: `s${i}`, expression: `(${aVar(i)} ^ ${bVar(i)}) ^ ${carry}` });
	}
	outputs.push({ name: 'cout', expression: carries[width - 1].expression });
	return outputs;
}

/** Turns the expression list into what the circuit builder takes. */
export function toOutputs(list: { name: string; expression: string }[]): Output[] {
	return list.map((o) => ({ name: o.name, ast: parseExpression(o.expression) }));
}

/** The values a set of adder expressions produce for concrete operands. */
export function evaluateAdder(
	list: { name: string; expression: string }[],
	a: number,
	b: number,
	width: number,
	cin: Bit
) {
	const values: Record<string, boolean> = { [CIN]: cin === 1 };
	const aBits = toBits(a, width);
	const bBits = toBits(b, width);
	for (let i = 0; i < width; i++) {
		values[aVar(i)] = aBits[width - 1 - i] === 1;
		values[bVar(i)] = bBits[width - 1 - i] === 1;
	}
	const asts: Record<string, Ast> = Object.fromEntries(list.map((o) => [o.name, parseExpression(o.expression)]));
	return Object.fromEntries(Object.entries(asts).map(([name, ast]) => [name, evaluate(ast, values)])) as Record<
		string,
		boolean
	>;
}

/**
 * Gate depth from the inputs to the carry out, which is what sets how long
 * an adder takes: the longest path through the drawn circuit, counting one
 * unit per two-input gate, exactly as the circuit generator lays it out.
 */
export function carryDepth(list: { name: string; expression: string }[]): { ripple: number; gates: number } {
	const circuit = buildCircuit(toOutputs(list));
	const cout = circuit.outputs.find((o) => o.name === 'cout');
	const node = circuit.nodes.find((n) => n.id === cout?.rootId);
	return { ripple: node ? node.depth : 0, gates: circuit.gateCount };
}

/** Worst case gate delay to the carry out, by the textbook count, for comparison across widths. */
export function delayTable(widths: number[]): { width: number; ripple: number; lookahead: number }[] {
	// A ripple adder's carry path is two gate levels per column (an AND-OR
	// stage per full adder) after the XOR that makes the first propagate, which
	// is the depth the drawn circuit measures. Lookahead is a fixed three: P and
	// G, then the AND row, then the OR, however wide the word.
	return widths.map((width) => ({ width, ripple: 2 * width + 1, lookahead: 3 }));
}
