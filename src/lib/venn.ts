// Set expressions and Venn diagrams for up to three sets. Sets and boolean
// algebra are the same algebra (union is OR, intersection is AND, complement
// is NOT), so this module only adds the set syntax and the geometry: it turns
// a set expression into the boolean engine's Ast and lets that engine do the
// logic. Each region of an n-set Venn diagram is one row of an n-variable
// truth table, which is why a diagram and a truth table always agree.
//
// Syntax, decided here and documented on the pages:
// - Sets are A, B and C (lowercase works too). U is the universal set, and so
//   is ξ, the symbol used in UK schools. ∅ or {} is the empty set.
// - Union: ∪ | + or "union", and a U or u written between two sets ("A U B"),
//   since a set can never stand there. Intersection: ∩ & and "intersect", and
//   an n between two sets ("A n B"). Difference: − - \ or "minus". Symmetric
//   difference: Δ ⊕ or "xor". Complement: A′ A' Aᶜ A^c, or ~A ¬A "not A".
// - Juxtaposition (AB) is rejected rather than guessed at: some books mean
//   A ∩ B by it, and "A B" is more often a missing operator than a product.
// - Precedence: complement, then intersection, then difference and symmetric
//   difference (left to right), then union. Textbooks do not all agree on
//   this, so the output always brackets mixed operators.

import { minimise, truthTable, format, type Ast } from './boolean.js';

export type SetExpr =
	| { t: 'set'; name: string }
	| { t: 'empty' }
	| { t: 'universe' }
	| { t: 'comp'; a: SetExpr }
	| { t: 'union'; a: SetExpr; b: SetExpr }
	| { t: 'inter'; a: SetExpr; b: SetExpr }
	| { t: 'diff'; a: SetExpr; b: SetExpr }
	| { t: 'sym'; a: SetExpr; b: SetExpr };

type BinaryKind = 'union' | 'inter' | 'diff' | 'sym';

export const SET_NAMES = ['A', 'B', 'C'] as const;
export const MAX_SETS = 3;

export class SetError extends Error {}

// --- parsing -----------------------------------------------------------------

type Token =
	| { k: 'set'; name: string }
	| { k: 'empty' }
	| { k: 'universe' }
	/** A U: the universal set where a set is expected, union between two sets. */
	| { k: 'U' }
	/** An n: intersection between two sets, and an error anywhere else. */
	| { k: 'op'; op: BinaryKind; text: string }
	| { k: 'not'; text: string }
	| { k: 'post' }
	| { k: '(' }
	| { k: ')' };

const SYMBOL = { union: '∪', inter: '∩', diff: '−', sym: 'Δ' } as const;

const WORDS: Record<string, Token> = {
	union: { k: 'op', op: 'union', text: 'union' },
	or: { k: 'op', op: 'union', text: 'or' },
	cup: { k: 'op', op: 'union', text: 'cup' },
	intersect: { k: 'op', op: 'inter', text: 'intersect' },
	intersection: { k: 'op', op: 'inter', text: 'intersection' },
	and: { k: 'op', op: 'inter', text: 'and' },
	cap: { k: 'op', op: 'inter', text: 'cap' },
	minus: { k: 'op', op: 'diff', text: 'minus' },
	xor: { k: 'op', op: 'sym', text: 'xor' },
	not: { k: 'not', text: 'not' },
	empty: { k: 'empty' }
};

// Longest first, so {} is not read as two brackets.
const SYMBOLS: [string, Token][] = [
	['{}', { k: 'empty' }],
	['^c', { k: 'post' }],
	['^C', { k: 'post' }],
	['&&', { k: 'op', op: 'inter', text: '&&' }],
	['||', { k: 'op', op: 'union', text: '||' }],
	['∪', { k: 'op', op: 'union', text: '∪' }],
	['∨', { k: 'op', op: 'union', text: '∨' }],
	['|', { k: 'op', op: 'union', text: '|' }],
	['+', { k: 'op', op: 'union', text: '+' }],
	['∩', { k: 'op', op: 'inter', text: '∩' }],
	['∧', { k: 'op', op: 'inter', text: '∧' }],
	['&', { k: 'op', op: 'inter', text: '&' }],
	['·', { k: 'op', op: 'inter', text: '·' }],
	['*', { k: 'op', op: 'inter', text: '*' }],
	['−', { k: 'op', op: 'diff', text: '−' }],
	['-', { k: 'op', op: 'diff', text: '-' }],
	['–', { k: 'op', op: 'diff', text: '–' }],
	['\\', { k: 'op', op: 'diff', text: '\\' }],
	['∖', { k: 'op', op: 'diff', text: '∖' }],
	['Δ', { k: 'op', op: 'sym', text: 'Δ' }],
	['∆', { k: 'op', op: 'sym', text: '∆' }],
	['△', { k: 'op', op: 'sym', text: '△' }],
	['⊕', { k: 'op', op: 'sym', text: '⊕' }],
	['⊖', { k: 'op', op: 'sym', text: '⊖' }],
	['ᶜ', { k: 'post' }],
	["'", { k: 'post' }],
	['′', { k: 'post' }],
	['’', { k: 'post' }],
	['~', { k: 'not', text: '~' }],
	['¬', { k: 'not', text: '¬' }],
	['!', { k: 'not', text: '!' }],
	['∅', { k: 'empty' }],
	['Ø', { k: 'empty' }],
	['ø', { k: 'empty' }],
	['⌀', { k: 'empty' }],
	['ξ', { k: 'universe' }],
	['(', { k: '(' }],
	['[', { k: '(' }],
	[')', { k: ')' }],
	[']', { k: ')' }]
];

/** The token for a single letter, or null when the letter means nothing. */
function letterToken(c: string): Token | null {
	const upper = c.toUpperCase();
	if ((SET_NAMES as readonly string[]).includes(upper)) return { k: 'set', name: upper };
	if (upper === 'U') return { k: 'U' };
	if (c === 'n') return { k: 'op', op: 'inter', text: 'n' };
	return null;
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	outer: while (i < input.length) {
		const c = input[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (/[a-zA-Z]/.test(c)) {
			let j = i;
			while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
			const run = input.slice(i, j);
			const word = WORDS[run.toLowerCase()];
			if (word) {
				tokens.push(word);
			} else {
				// A run such as "AuB" or "AnB" is read letter by letter; anything
				// that is not a set, U or n is reported by name.
				for (const letter of run) {
					const token = letterToken(letter);
					if (!token) {
						throw new SetError(
							run.length > 1
								? `"${run}" is not a set or an operator. Use the sets A, B and C.`
								: `${letter} is not one of the sets. Use A, B and C (U is the universal set).`
						);
					}
					tokens.push(token);
				}
			}
			i = j;
			continue;
		}
		for (const [symbol, token] of SYMBOLS) {
			if (input.startsWith(symbol, i)) {
				tokens.push(token);
				i += symbol.length;
				continue outer;
			}
		}
		if (c === '^') throw new SetError('Write a complement as A′ or A^c. For symmetric difference use Δ or xor.');
		throw new SetError(`"${c}" is not a set symbol.`);
	}
	return tokens;
}

const describeToken = (token: Token): string => {
	switch (token.k) {
		case 'set':
			return token.name;
		case 'empty':
			return '∅';
		case 'universe':
		case 'U':
			return 'U';
		case 'op':
			return SYMBOL[token.op];
		case 'not':
			return '¬';
		case 'post':
			return '′';
		default:
			return token.k;
	}
};

function parse(tokens: Token[]): SetExpr {
	let pos = 0;
	const peek = () => tokens[pos];

	// The expression is parsed in four levels, loosest first.
	const parseUnion = (): SetExpr => {
		let left = parseDifference();
		for (;;) {
			const token = peek();
			if (token && ((token.k === 'op' && token.op === 'union') || token.k === 'U')) {
				pos++;
				left = { t: 'union', a: left, b: parseDifference('∪') };
			} else return left;
		}
	};

	const parseDifference = (after?: string): SetExpr => {
		let left = parseIntersection(after);
		for (;;) {
			const token = peek();
			if (token?.k === 'op' && (token.op === 'diff' || token.op === 'sym')) {
				pos++;
				left = { t: token.op, a: left, b: parseIntersection(SYMBOL[token.op]) };
			} else return left;
		}
	};

	const parseIntersection = (after?: string): SetExpr => {
		let left = parseUnary(after);
		for (;;) {
			const token = peek();
			if (token?.k === 'op' && token.op === 'inter') {
				pos++;
				left = { t: 'inter', a: left, b: parseUnary('∩') };
			} else return left;
		}
	};

	const parseUnary = (after?: string): SetExpr => {
		const token = peek();
		if (token?.k === 'not') {
			pos++;
			return { t: 'comp', a: parseUnary('¬') };
		}
		let operand = parsePrimary(after);
		while (peek()?.k === 'post') {
			pos++;
			operand = { t: 'comp', a: operand };
		}
		return operand;
	};

	const parsePrimary = (after?: string): SetExpr => {
		const token = peek();
		if (!token) {
			throw new SetError(after ? `Something is missing after ${after}.` : 'Type a set expression first.');
		}
		switch (token.k) {
			case 'set':
				pos++;
				return { t: 'set', name: token.name };
			case 'empty':
				pos++;
				return { t: 'empty' };
			case 'universe':
			case 'U':
				pos++;
				return { t: 'universe' };
			case '(': {
				pos++;
				if (peek()?.k === ')') throw new SetError('There is nothing between a pair of brackets.');
				const inner = parseUnion();
				if (peek()?.k !== ')') {
					throw new SetError(peek() ? leftover(peek()) : 'A bracket is opened but never closed.');
				}
				pos++;
				return inner;
			}
			case ')':
				throw new SetError(
					after ? `Something is missing after ${after}.` : 'There is a closing bracket without an opening one.'
				);
			case 'post':
				throw new SetError('A complement mark (′) needs a set before it.');
			case 'op':
				throw new SetError(
					after
						? `Something is missing between ${after} and ${SYMBOL[token.op]}.`
						: `${SYMBOL[token.op]} needs a set on its left.`
				);
			default:
				throw new SetError(`Unexpected ${describeToken(token)}.`);
		}
	};

	const leftover = (token: Token): string => {
		if (token.k === ')') return 'There is a closing bracket without an opening one.';
		const previous = tokens[pos - 1];
		if (token.k === 'set' || token.k === 'empty' || token.k === 'universe' || token.k === '(' || token.k === 'not') {
			const before = previous ? describeToken(previous) : '';
			const next = token.k === '(' ? '(' : describeToken(token);
			return `Put an operator such as ∩ or ∪ between ${before === ')' ? 'the bracket' : before} and ${next}${
				token.k === 'set' && previous?.k === 'set' ? ` (write ${before} ∩ ${next}, not ${before}${next})` : ''
			}.`;
		}
		return `Unexpected ${describeToken(token)}.`;
	};

	if (!tokens.length) throw new SetError('Type a set expression first.');
	const expr = parseUnion();
	if (pos < tokens.length) throw new SetError(leftover(tokens[pos]));
	return expr;
}

/** Parses a set expression, throwing a SetError with a readable message. */
export function parseSet(input: string): SetExpr {
	if (!input.trim()) throw new SetError('Type a set expression first.');
	return parse(tokenize(input));
}

// --- printing ------------------------------------------------------------------

/**
 * Prints an expression in textbook notation. Mixed operators are always
 * bracketed, because the precedence of ∪, ∩ and − is not agreed on, and a
 * reader should never need to know this site's choice to read the answer.
 */
export function formatSet(expr: SetExpr): string {
	const walk = (e: SetExpr, parent: BinaryKind | 'comp' | null): string => {
		switch (e.t) {
			case 'set':
				return e.name;
			case 'empty':
				return '∅';
			case 'universe':
				return 'U';
			case 'comp': {
				const inner = walk(e.a, 'comp');
				return `${inner}′`;
			}
			default: {
				const text = `${walk(e.a, e.t)} ${SYMBOL[e.t]} ${walk(e.b, e.t)}`;
				// Same associative operator on either side needs no brackets;
				// everything else does.
				const associative = e.t === 'union' || e.t === 'inter' || e.t === 'sym';
				const bare = parent === null || (parent === e.t && associative);
				return bare ? text : `(${text})`;
			}
		}
	};
	return walk(expr, null);
}

// --- logic -------------------------------------------------------------------

/** The same expression in the boolean engine's terms: ∪ is OR, ∩ AND, ′ NOT. */
export function toBoolean(expr: SetExpr): Ast {
	switch (expr.t) {
		case 'set':
			return { t: 'var', name: expr.name };
		case 'empty':
			return { t: 'const', v: false };
		case 'universe':
			return { t: 'const', v: true };
		case 'comp':
			return { t: 'not', a: toBoolean(expr.a) };
		case 'union':
			return { t: 'or', a: toBoolean(expr.a), b: toBoolean(expr.b) };
		case 'inter':
			return { t: 'and', a: toBoolean(expr.a), b: toBoolean(expr.b) };
		case 'diff':
			return { t: 'and', a: toBoolean(expr.a), b: { t: 'not', a: toBoolean(expr.b) } };
		case 'sym':
			return { t: 'xor', a: toBoolean(expr.a), b: toBoolean(expr.b) };
	}
}

/** The boolean expression in maths notation, e.g. A ∧ ¬B. */
export const booleanText = (expr: SetExpr): string => format(toBoolean(expr), 'math');

/** How many sets the diagram needs: up to the highest letter used, at least one. */
export function setsNeeded(expr: SetExpr): number {
	let highest = 0;
	const walk = (e: SetExpr) => {
		if (e.t === 'set') highest = Math.max(highest, SET_NAMES.indexOf(e.name as 'A') + 1);
		else if (e.t === 'comp') walk(e.a);
		else if ('b' in e) {
			walk(e.a);
			walk(e.b);
		}
	};
	walk(expr);
	return Math.max(1, highest);
}

/** True when set `set` (0 = A) contains region `index` of an n-set diagram. */
export const inSet = (index: number, set: number, n: number): boolean => !!(index & (1 << (n - 1 - set)));

/**
 * Which regions the expression covers, one entry per region. Region i is truth
 * table row i, with A as the most significant bit, so region 0 is outside
 * every set and the last region is inside all of them.
 */
export function shade(expr: SetExpr, n: number): boolean[] {
	if (n < setsNeeded(expr)) throw new SetError(`That expression needs ${setsNeeded(expr)} sets.`);
	return truthTable(toBoolean(expr), SET_NAMES.slice(0, n) as unknown as string[]).rows;
}

/** A region in set notation, e.g. A ∩ B′ ∩ C. */
export function regionNotation(index: number, n: number): string {
	return SET_NAMES.slice(0, n)
		.map((name, set) => (inSet(index, set, n) ? name : `${name}′`))
		.join(' ∩ ');
}

const list = (names: string[], joiner: string) =>
	names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`;

/** A region in words, e.g. "In A and C but not B", for labels and screen readers. */
export function regionWords(index: number, n: number): string {
	const names = SET_NAMES.slice(0, n) as unknown as string[];
	const ins = names.filter((_, set) => inSet(index, set, n));
	const outs = names.filter((_, set) => !inSet(index, set, n));
	if (!ins.length) return n === 1 ? 'Outside A' : `Outside ${list(outs, 'and')}`;
	if (!outs.length) return n === 1 ? 'In A' : `In ${list(ins, 'and')}`;
	return `In ${list(ins, 'and')} but not ${list(outs, 'or')}`;
}

export type Region = {
	index: number;
	/** 1/0 per set, A first: the truth table row. */
	bits: boolean[];
	notation: string;
	words: string;
	shaded: boolean;
};

export function regionsOf(shaded: boolean[], n: number): Region[] {
	return shaded.map((value, index) => ({
		index,
		bits: SET_NAMES.slice(0, n).map((_, set) => inSet(index, set, n)),
		notation: regionNotation(index, n),
		words: regionWords(index, n),
		shaded: value
	}));
}

const leaf = (set: number): SetExpr => ({ t: 'set', name: SET_NAMES[set] });

/**
 * The shading as a union of intersections, from the boolean engine's minimal
 * sum of products: each product term is an intersection, and the sum is their
 * union. Uses only ∪, ∩ and ′.
 */
export function sumOfProducts(shaded: boolean[], n: number): SetExpr {
	const minterms = shaded.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
	if (!minterms.length) return { t: 'empty' };
	if (minterms.length === shaded.length) return { t: 'universe' };
	const terms = minimise(minterms, [], n).map((implicant) => {
		const literals: SetExpr[] = [];
		for (let set = 0; set < n; set++) {
			const bit = 1 << (n - 1 - set);
			if (implicant.mask & bit) continue;
			literals.push(implicant.bits & bit ? leaf(set) : { t: 'comp', a: leaf(set) });
		}
		return literals;
	});
	const product = (literals: SetExpr[]) => literals.reduce((acc, next): SetExpr => ({ t: 'inter', a: acc, b: next }));
	// Shortest terms first, then alphabetical, so the answer reads in order.
	return terms
		.map((literals) => ({ size: literals.length, expr: product(literals) }))
		.sort((x, y) => x.size - y.size || formatSet(x.expr).localeCompare(formatSet(y.expr)))
		.map((term) => term.expr)
		.reduce((acc, next): SetExpr => ({ t: 'union', a: acc, b: next }));
}

// Costs for the shortest-expression search: every set costs 2, every operator
// 1, and symmetric difference 2 because fewer readers know it. So A − B (5)
// beats A ∩ B′ (6), and (A ∪ B)′ (6) beats A′ ∩ B′ (7).
const LEAF_COST = 2;
const OP_COST: Record<BinaryKind, number> = { union: 1, inter: 1, diff: 1, sym: 2 };
const COMP_COST = 1;

const searchCache = new Map<number, SetExpr[]>();

/** For every possible shading of an n-set diagram, the cheapest expression. */
function shortestTable(n: number): SetExpr[] {
	const cached = searchCache.get(n);
	if (cached) return cached;
	const size = 1 << n;
	const count = 1 << size;
	const full = count - 1;
	const best: (SetExpr | undefined)[] = new Array(count);
	const byCost: number[][] = [];
	let found = 0;
	const add = (mask: number, expr: SetExpr, cost: number) => {
		if (best[mask]) return;
		best[mask] = expr;
		(byCost[cost] ??= []).push(mask);
		found++;
	};
	// A mask has bit i set when region i is shaded.
	for (let set = 0; set < n; set++) {
		let mask = 0;
		for (let i = 0; i < size; i++) if (inSet(i, set, n)) mask |= 1 << i;
		add(mask, leaf(set), LEAF_COST);
	}
	add(0, { t: 'empty' }, LEAF_COST);
	add(full, { t: 'universe' }, LEAF_COST);

	const ops: [BinaryKind, (x: number, y: number) => number][] = [
		['union', (x, y) => x | y],
		['inter', (x, y) => x & y],
		['diff', (x, y) => x & ~y & full],
		['sym', (x, y) => x ^ y]
	];
	for (let cost = LEAF_COST + 1; found < count && cost < 80; cost++) {
		// Complements first, so a tie goes to (A ∪ B)′ rather than A′ − B.
		for (const x of byCost[cost - COMP_COST] ?? []) {
			if (x === 0 || x === full) continue;
			const mask = ~x & full;
			if (!best[mask]) add(mask, { t: 'comp', a: best[x]! }, cost);
		}
		for (const [op, apply] of ops) {
			const remaining = cost - OP_COST[op];
			for (let left = LEAF_COST; left <= remaining - LEAF_COST; left++) {
				const xs = byCost[left] ?? [];
				const ys = byCost[remaining - left] ?? [];
				for (const x of xs) {
					// Constants never help inside a larger expression.
					if (x === 0 || x === full) continue;
					for (const y of ys) {
						if (y === 0 || y === full) continue;
						const mask = apply(x, y);
						if (!best[mask]) add(mask, { t: op, a: best[x]!, b: best[y]! }, cost);
					}
				}
			}
		}
	}
	const table = best as SetExpr[];
	searchCache.set(n, table);
	return table;
}

/**
 * The shortest expression for a shading, using ∪ ∩ − Δ and ′. Found by
 * building every expression in order of length until each of the 2^(2^n)
 * shadings has one, so for up to three sets it is exact, not a heuristic.
 */
export function shortestExpression(shaded: boolean[], n: number): SetExpr {
	const mask = shaded.reduce((acc, v, i) => (v ? acc | (1 << i) : acc), 0);
	return inReadingOrder(shortestTable(n)[mask]);
}

/** The set letters of an expression in the order they are written. */
const lettersOf = (expr: SetExpr): string => formatSet(expr).replace(/[^A-C]/g, '');

/**
 * Swaps the sides of ∪, ∩ and Δ so letters read in alphabetical order where
 * they can: (A ∪ B) ∩ C rather than C ∩ (A ∪ B). The shading is unchanged.
 */
function inReadingOrder(expr: SetExpr): SetExpr {
	if (expr.t === 'comp') return { t: 'comp', a: inReadingOrder(expr.a) };
	if (!('b' in expr)) return expr;
	const a = inReadingOrder(expr.a);
	const b = inReadingOrder(expr.b);
	if (expr.t !== 'diff' && lettersOf(b) < lettersOf(a)) return { t: expr.t, a: b, b: a };
	return { t: expr.t, a, b };
}

/** The inner parts of an expression, innermost first, for step by step shading. */
export function subExpressions(expr: SetExpr): SetExpr[] {
	const out: SetExpr[] = [];
	const seen = new Set<string>();
	const walk = (e: SetExpr) => {
		if (e.t === 'comp') walk(e.a);
		else if ('b' in e) {
			walk(e.a);
			walk(e.b);
		}
		const key = formatSet(e);
		if (!seen.has(key)) {
			seen.add(key);
			out.push(e);
		}
	};
	walk(expr);
	return out;
}

export type VennResult = {
	expr: SetExpr;
	/** The input, reprinted in unambiguous notation. */
	text: string;
	n: number;
	shaded: boolean[];
	regions: Region[];
	minterms: number[];
	shortest: string;
	sop: string;
	boolean: string;
};

/** Everything the generator shows for one shading. */
export function analyseShading(shaded: boolean[], n: number) {
	const minterms = shaded.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
	const shortest = shortestExpression(shaded, n);
	return {
		shaded,
		regions: regionsOf(shaded, n),
		minterms,
		shortest: formatSet(shortest),
		shortestExpr: shortest,
		sop: formatSet(sumOfProducts(shaded, n)),
		boolean: booleanText(shortest)
	};
}

/** Parses and analyses an expression; n defaults to the sets it uses. */
export function analyse(input: string, n?: number): VennResult {
	const expr = parseSet(input);
	const sets = Math.min(MAX_SETS, Math.max(n ?? 1, setsNeeded(expr)));
	const shaded = shade(expr, sets);
	const result = analyseShading(shaded, sets);
	return {
		expr,
		text: formatSet(expr),
		n: sets,
		shaded,
		regions: result.regions,
		minterms: result.minterms,
		shortest: result.shortest,
		sop: result.sop,
		boolean: booleanText(expr)
	};
}

/** True when two expressions shade the same regions of a diagram with n sets. */
export function sameShading(a: SetExpr, b: SetExpr, n = MAX_SETS): boolean {
	const x = shade(a, n);
	const y = shade(b, n);
	return x.every((v, i) => v === y[i]);
}

// --- geometry ------------------------------------------------------------------

export type VennCircle = { name: string; cx: number; cy: number; r: number; lx: number; ly: number };
export type VennRegionShape = { index: number; path: string; lx: number; ly: number };
export type VennLayout = {
	n: number;
	width: number;
	height: number;
	universe: { x: number; y: number; w: number; h: number; lx: number; ly: number };
	circles: VennCircle[];
	regions: VennRegionShape[];
};

type Point = { x: number; y: number };

const WIDTH = 320;
const HEIGHT = 250;
const UNIVERSE = { x: 6, y: 6, w: 308, h: 238, lx: 20, ly: 30 };

const num = (v: number) => (Math.round(v * 100) / 100).toString();

function circlesFor(n: number): VennCircle[] {
	const at = (name: string, cx: number, cy: number, r: number, angle: number, gap: number): VennCircle => ({
		name,
		cx,
		cy,
		r,
		lx: cx + Math.cos(angle) * (r + gap),
		ly: cy + Math.sin(angle) * (r + gap)
	});
	const up = (-3 * Math.PI) / 4;
	if (n === 1) return [at('A', 160, 125, 88, up, 10)];
	if (n === 2) return [at('A', 122, 125, 80, up, 12), at('B', 198, 125, 80, -Math.PI / 4, 12)];
	return [
		at('A', 125, 99, 70, up, 11),
		at('B', 195, 99, 70, -Math.PI / 4, 11),
		at('C', 160, 159.62, 70, (3 * Math.PI) / 4, 13)
	];
}

const inside = (c: VennCircle, p: Point) => (p.x - c.cx) ** 2 + (p.y - c.cy) ** 2 < c.r ** 2;

/** The two crossing points of equal circles. */
function crossings(a: VennCircle, b: VennCircle): [Point, Point] {
	const dx = b.cx - a.cx;
	const dy = b.cy - a.cy;
	const d = Math.hypot(dx, dy);
	const h = Math.sqrt(a.r ** 2 - (d / 2) ** 2);
	const mx = a.cx + dx / 2;
	const my = a.cy + dy / 2;
	return [
		{ x: mx - (dy / d) * h, y: my + (dx / d) * h },
		{ x: mx + (dy / d) * h, y: my - (dx / d) * h }
	];
}

/**
 * The arc of circle `k` from p to q that forms part of the region's edge. Of
 * the two arcs joining the points, it is the one whose midpoint lies inside
 * exactly the other circles the region is inside.
 */
function arc(circles: VennCircle[], k: number, p: Point, q: Point, member: boolean[]): string {
	const c = circles[k];
	const from = Math.atan2(p.y - c.cy, p.x - c.cx);
	const to = Math.atan2(q.y - c.cy, q.x - c.cx);
	let span = to - from;
	while (span <= 0) span += 2 * Math.PI;
	const fits = (angle: number) => {
		const mid = { x: c.cx + Math.cos(angle) * c.r, y: c.cy + Math.sin(angle) * c.r };
		return circles.every((other, j) => j === k || inside(other, mid) === member[j]);
	};
	// Increasing angle is clockwise on screen, which is SVG's sweep flag 1.
	const clockwise = fits(from + span / 2);
	const length = clockwise ? span : 2 * Math.PI - span;
	return `A ${num(c.r)} ${num(c.r)} 0 ${length > Math.PI ? 1 : 0} ${clockwise ? 1 : 0} ${num(q.x)} ${num(q.y)}`;
}

/** A closed path through `points`, taking the edge after point i along circle edges[i]. */
function cyclePath(circles: VennCircle[], points: Point[], edges: number[], member: boolean[]): string {
	let d = `M ${num(points[0].x)} ${num(points[0].y)}`;
	points.forEach((p, i) => {
		d += ` ${arc(circles, edges[i], p, points[(i + 1) % points.length], member)}`;
	});
	return `${d} Z`;
}

const rectPath = () => {
	const { x, y, w, h } = UNIVERSE;
	return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
};

function regionPaths(circles: VennCircle[]): string[] {
	const n = circles.length;
	const member = (index: number) => circles.map((_, set) => inSet(index, set, n));
	if (n === 1) {
		const { cx, cy, r } = circles[0];
		const circle = `M ${num(cx - r)} ${cy} A ${r} ${r} 0 1 0 ${num(cx + r)} ${cy} A ${r} ${r} 0 1 0 ${num(
			cx - r
		)} ${cy} Z`;
		return [`${rectPath()} ${circle}`, circle];
	}
	if (n === 2) {
		const [p, q] = crossings(circles[0], circles[1]);
		const paths: string[] = [];
		paths[3] = cyclePath(circles, [p, q], [0, 1], member(3));
		paths[2] = cyclePath(circles, [p, q], [0, 1], member(2));
		paths[1] = cyclePath(circles, [p, q], [1, 0], member(1));
		paths[0] = `${rectPath()} ${cyclePath(circles, [p, q], [0, 1], member(0))}`;
		return paths;
	}
	// For each pair, the crossing inside the third circle and the one outside.
	const [A, B, C] = [0, 1, 2];
	const pair = (x: number, y: number, third: number) => {
		const [p, q] = crossings(circles[x], circles[y]);
		return inside(circles[third], p) ? { inner: p, outer: q } : { inner: q, outer: p };
	};
	const ab = pair(A, B, C);
	const ac = pair(A, C, B);
	const bc = pair(B, C, A);
	const paths: string[] = [];
	// Bits: A = 4, B = 2, C = 1.
	paths[7] = cyclePath(circles, [ab.inner, ac.inner, bc.inner], [A, C, B], member(7));
	paths[6] = cyclePath(circles, [ab.outer, ac.inner, bc.inner], [A, C, B], member(6));
	paths[5] = cyclePath(circles, [ac.outer, ab.inner, bc.inner], [A, B, C], member(5));
	paths[3] = cyclePath(circles, [bc.outer, ab.inner, ac.inner], [B, A, C], member(3));
	paths[4] = cyclePath(circles, [ab.outer, ac.outer, bc.inner], [A, C, B], member(4));
	paths[2] = cyclePath(circles, [ab.outer, bc.outer, ac.inner], [B, C, A], member(2));
	paths[1] = cyclePath(circles, [ac.outer, bc.outer, ab.inner], [C, B, A], member(1));
	paths[0] = `${rectPath()} ${cyclePath(circles, [ab.outer, ac.outer, bc.outer], [A, C, B], member(0))}`;
	return paths;
}

/** Where to write a region's label: the middle of the region, found by sampling. */
function labelSpots(circles: VennCircle[]): Point[] {
	const n = circles.length;
	const sums = Array.from({ length: 1 << n }, () => ({ x: 0, y: 0, count: 0 }));
	for (let y = UNIVERSE.y; y < UNIVERSE.y + UNIVERSE.h; y += 2) {
		for (let x = UNIVERSE.x; x < UNIVERSE.x + UNIVERSE.w; x += 2) {
			const index = circles.reduce((acc, c, set) => (inside(c, { x, y }) ? acc | (1 << (n - 1 - set)) : acc), 0);
			sums[index].x += x;
			sums[index].y += y;
			sums[index].count++;
		}
	}
	return sums.map((s, index) =>
		// The outside's centroid would land inside the circles; use a corner.
		index === 0
			? { x: UNIVERSE.x + UNIVERSE.w - 26, y: UNIVERSE.y + UNIVERSE.h - 14 }
			: { x: s.x / s.count, y: s.y / s.count }
	);
}

const layoutCache = new Map<number, VennLayout>();

/** The diagram for 1, 2 or 3 sets: circles, labels and one path per region. */
export function vennLayout(n: number): VennLayout {
	const cached = layoutCache.get(n);
	if (cached) return cached;
	if (n < 1 || n > MAX_SETS) throw new SetError(`A diagram has 1 to ${MAX_SETS} sets.`);
	const circles = circlesFor(n);
	const paths = regionPaths(circles);
	const spots = labelSpots(circles);
	const layout: VennLayout = {
		n,
		width: WIDTH,
		height: HEIGHT,
		universe: UNIVERSE,
		circles,
		regions: paths.map((path, index) => ({ index, path, lx: spots[index].x, ly: spots[index].y }))
	};
	layoutCache.set(n, layout);
	return layout;
}

export const VENN_COLOURS = {
	background: '#141416',
	shaded: '#3e9a44',
	outline: '#f0f0f0',
	label: '#ffffff',
	regionLabel: '#ffffff'
};

export type RegionLabels = 'none' | 'minterm' | 'bits';

export function regionLabel(index: number, n: number, labels: RegionLabels): string {
	if (labels === 'minterm') return `m${index}`;
	if (labels === 'bits') return index.toString(2).padStart(n, '0');
	return '';
}

const escapeXml = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** A standalone SVG file of a shaded diagram, for download. */
export function vennSvg(n: number, shaded: boolean[], options: { labels?: RegionLabels; title?: string } = {}) {
	const layout = vennLayout(n);
	const { labels = 'none', title = '' } = options;
	const colours = VENN_COLOURS;
	const scale = 2;
	const parts: string[] = [];
	parts.push(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width * scale}" height="${
			layout.height * scale + (title ? 40 : 0)
		}" viewBox="0 0 ${layout.width} ${layout.height + (title ? 20 : 0)}" font-family="Helvetica, Arial, sans-serif">`
	);
	parts.push(`<rect width="100%" height="100%" fill="#0d0d0f"/>`);
	for (const region of layout.regions) {
		parts.push(
			`<path d="${region.path}" fill="${
				shaded[region.index] ? colours.shaded : colours.background
			}" fill-rule="evenodd"/>`
		);
	}
	const u = layout.universe;
	parts.push(
		`<rect x="${u.x}" y="${u.y}" width="${u.w}" height="${u.h}" fill="none" stroke="${colours.outline}" stroke-width="1.5"/>`
	);
	for (const c of layout.circles) {
		parts.push(
			`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${colours.outline}" stroke-width="2"/>`
		);
	}
	parts.push(
		`<text x="${u.lx}" y="${u.ly}" fill="${colours.label}" font-size="17" font-weight="700" text-anchor="middle">U</text>`
	);
	for (const c of layout.circles) {
		parts.push(
			`<text x="${num(c.lx)}" y="${num(c.ly + 6)}" fill="${
				colours.label
			}" font-size="18" font-weight="700" text-anchor="middle">${c.name}</text>`
		);
	}
	if (labels !== 'none') {
		for (const region of layout.regions) {
			parts.push(
				`<text x="${num(region.lx)}" y="${num(
					region.ly + 4
				)}" fill="#fff" stroke="#0d0d0f" stroke-width="3" paint-order="stroke" font-size="12" text-anchor="middle">${regionLabel(
					region.index,
					n,
					labels
				)}</text>`
			);
		}
	}
	if (title) {
		parts.push(
			`<text x="${layout.width / 2}" y="${
				layout.height + 12
			}" fill="#ffffff" font-size="13" text-anchor="middle">${escapeXml(title)}</text>`
		);
	}
	parts.push('</svg>');
	return parts.join('');
}

// --- concrete sets, for the reference page's examples ----------------------

/** Formats a finite set in roster notation, e.g. {1, 2, 3}. */
export const roster = (items: Iterable<string | number>): string => {
	const values = [...items];
	return values.length ? `{${values.join(', ')}}` : '∅';
};

/** Evaluates an expression on concrete sets of numbers, with plain JS Sets. */
export function evaluateOn(expr: SetExpr, sets: Record<string, Set<number>>, universe: Set<number>): Set<number> {
	const go = (e: SetExpr): Set<number> => {
		switch (e.t) {
			case 'set':
				return new Set(sets[e.name] ?? []);
			case 'empty':
				return new Set();
			case 'universe':
				return new Set(universe);
			case 'comp': {
				const inner = go(e.a);
				return new Set([...universe].filter((x) => !inner.has(x)));
			}
			case 'union':
				return new Set([...go(e.a), ...go(e.b)]);
			case 'inter': {
				const right = go(e.b);
				return new Set([...go(e.a)].filter((x) => right.has(x)));
			}
			case 'diff': {
				const right = go(e.b);
				return new Set([...go(e.a)].filter((x) => !right.has(x)));
			}
			case 'sym': {
				const left = go(e.a);
				const right = go(e.b);
				return new Set([...[...left].filter((x) => !right.has(x)), ...[...right].filter((x) => !left.has(x))]);
			}
		}
	};
	return new Set([...go(expr)].sort((x, y) => x - y));
}
