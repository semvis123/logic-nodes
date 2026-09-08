// A small boolean expression engine: parse -> truth table -> simplified
// sum of products. Used by the truth table generator and the boolean algebra
// calculator pages. Deliberately dependency free and synchronous; the biggest
// input it ever sees is 8 variables (256 rows).

export type Ast =
	| { t: 'var'; name: string }
	| { t: 'const'; v: boolean }
	| { t: 'not'; a: Ast }
	| { t: 'and'; a: Ast; b: Ast }
	| { t: 'or'; a: Ast; b: Ast }
	| { t: 'xor'; a: Ast; b: Ast };

export const MAX_VARS = 8;

type Token =
	| { k: 'var'; name: string }
	| { k: 'const'; v: boolean }
	| { k: 'op'; op: 'and' | 'or' | 'xor' }
	| { k: 'not' }
	| { k: 'postnot' }
	| { k: '(' }
	| { k: ')' };

const KEYWORDS: Record<string, Token> = {
	and: { k: 'op', op: 'and' },
	or: { k: 'op', op: 'or' },
	xor: { k: 'op', op: 'xor' },
	not: { k: 'not' },
	true: { k: 'const', v: true },
	false: { k: 'const', v: false }
};

// Multi-character operators first, so && is not read as two ANDs.
const SYMBOLS: [string, Token][] = [
	['&&', { k: 'op', op: 'and' }],
	['||', { k: 'op', op: 'or' }],
	['&', { k: 'op', op: 'and' }],
	['∧', { k: 'op', op: 'and' }],
	['·', { k: 'op', op: 'and' }],
	['.', { k: 'op', op: 'and' }],
	['*', { k: 'op', op: 'and' }],
	['|', { k: 'op', op: 'or' }],
	['∨', { k: 'op', op: 'or' }],
	['+', { k: 'op', op: 'or' }],
	['^', { k: 'op', op: 'xor' }],
	['⊻', { k: 'op', op: 'xor' }],
	['⊕', { k: 'op', op: 'xor' }],
	['!', { k: 'not' }],
	['~', { k: 'not' }],
	['¬', { k: 'not' }],
	["'", { k: 'postnot' }],
	['\u2019', { k: 'postnot' }],
	['\u2032', { k: 'postnot' }],
	['(', { k: '(' }],
	[')', { k: ')' }]
];

export class BooleanError extends Error {}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < input.length) {
		const c = input[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (c === '0' || c === '1') {
			tokens.push({ k: 'const', v: c === '1' });
			i++;
			continue;
		}
		// A run of letters is either a keyword, or a string of single letter
		// variables written next to each other: "ab" means a AND b, the usual
		// convention in boolean algebra.
		if (/[a-zA-Z]/.test(c)) {
			let j = i;
			while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
			const word = input.slice(i, j);
			const keyword = KEYWORDS[word.toLowerCase()];
			if (keyword) {
				tokens.push(keyword);
			} else {
				for (const letter of word) tokens.push({ k: 'var', name: letter });
			}
			i = j;
			continue;
		}
		const symbol = SYMBOLS.find(([text]) => input.startsWith(text, i));
		if (!symbol) throw new BooleanError(`I don't understand "${c}"`);
		tokens.push(symbol[1]);
		i += symbol[0].length;
	}
	return tokens;
}

function parse(tokens: Token[]): Ast {
	let pos = 0;
	const peek = () => tokens[pos];

	// Anything that can begin a factor, which is also what makes an implicit
	// AND possible: "ab", "a(b+c)", "a!b".
	const startsFactor = (t: Token | undefined) =>
		!!t && (t.k === 'var' || t.k === 'const' || t.k === '(' || t.k === 'not');

	const parseOr = (): Ast => {
		let node = parseXor();
		while (peek()?.k === 'op' && (peek() as { op: string }).op === 'or') {
			pos++;
			node = { t: 'or', a: node, b: parseXor() };
		}
		return node;
	};

	const parseXor = (): Ast => {
		let node = parseAnd();
		while (peek()?.k === 'op' && (peek() as { op: string }).op === 'xor') {
			pos++;
			node = { t: 'xor', a: node, b: parseAnd() };
		}
		return node;
	};

	const parseAnd = (): Ast => {
		let node = parseUnary();
		for (;;) {
			const next = peek();
			if (next?.k === 'op' && (next as { op: string }).op === 'and') {
				pos++;
				node = { t: 'and', a: node, b: parseUnary() };
			} else if (startsFactor(next)) {
				node = { t: 'and', a: node, b: parseUnary() };
			} else {
				return node;
			}
		}
	};

	const parseUnary = (): Ast => {
		if (peek()?.k === 'not') {
			pos++;
			return { t: 'not', a: parseUnary() };
		}
		return parsePostfix();
	};

	const parsePostfix = (): Ast => {
		let node = parsePrimary();
		while (peek()?.k === 'postnot') {
			pos++;
			node = { t: 'not', a: node };
		}
		return node;
	};

	const parsePrimary = (): Ast => {
		const token = peek();
		if (!token) throw new BooleanError('The expression stops early');
		if (token.k === 'var') {
			pos++;
			return { t: 'var', name: token.name };
		}
		if (token.k === 'const') {
			pos++;
			return { t: 'const', v: token.v };
		}
		if (token.k === '(') {
			pos++;
			const inner = parseOr();
			if (peek()?.k !== ')') throw new BooleanError('A bracket is never closed');
			pos++;
			return inner;
		}
		if (token.k === ')') throw new BooleanError('A closing bracket has nothing to close');
		throw new BooleanError('An operator is missing something to work on');
	};

	const ast = parseOr();
	if (pos !== tokens.length) throw new BooleanError('There is a leftover operator');
	return ast;
}

export function variablesOf(ast: Ast): string[] {
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
	return [...found].sort((x, y) => x.localeCompare(y));
}

export function evaluate(ast: Ast, values: Record<string, boolean>): boolean {
	switch (ast.t) {
		case 'var':
			return values[ast.name];
		case 'const':
			return ast.v;
		case 'not':
			return !evaluate(ast.a, values);
		case 'and':
			return evaluate(ast.a, values) && evaluate(ast.b, values);
		case 'or':
			return evaluate(ast.a, values) || evaluate(ast.b, values);
		case 'xor':
			return evaluate(ast.a, values) !== evaluate(ast.b, values);
	}
}

export type TruthTable = {
	variables: string[];
	/** One entry per row, in counting order; rows[i] is the output for input i. */
	rows: boolean[];
};

/** Rows count up in binary, with variables[0] as the most significant bit. */
export function truthTable(ast: Ast, variables = variablesOf(ast)): TruthTable {
	if (variables.length > MAX_VARS) {
		throw new BooleanError(`That is more than ${MAX_VARS} variables`);
	}
	const rows: boolean[] = [];
	for (let i = 0; i < 1 << variables.length; i++) {
		const values: Record<string, boolean> = {};
		variables.forEach((name, bit) => {
			values[name] = !!(i & (1 << (variables.length - 1 - bit)));
		});
		rows.push(evaluate(ast, values));
	}
	return { variables, rows };
}

export function parseExpression(input: string): Ast {
	if (!input.trim()) throw new BooleanError('Type an expression first');
	return parse(tokenize(input));
}

// --- simplification (Quine-McCluskey) ---------------------------------------

/** A cube: `bits` holds the fixed values, `mask` marks the don't-care slots. */
type Implicant = { bits: number; mask: number; covers: number[] };

function primeImplicants(minterms: number[], varCount: number): Implicant[] {
	let current: Implicant[] = minterms.map((m) => ({ bits: m, mask: 0, covers: [m] }));
	const primes: Implicant[] = [];
	while (current.length) {
		const merged = new Array(current.length).fill(false);
		const next = new Map<string, Implicant>();
		for (let i = 0; i < current.length; i++) {
			for (let j = i + 1; j < current.length; j++) {
				const a = current[i];
				const b = current[j];
				if (a.mask !== b.mask) continue;
				const diff = a.bits ^ b.bits;
				// Combinable only when they differ in exactly one fixed bit.
				if (diff === 0 || (diff & (diff - 1)) !== 0) continue;
				merged[i] = true;
				merged[j] = true;
				const mask = a.mask | diff;
				const bits = a.bits & ~mask;
				const key = `${bits}/${mask}`;
				if (!next.has(key)) {
					next.set(key, { bits, mask, covers: [...new Set([...a.covers, ...b.covers])] });
				}
			}
		}
		current.forEach((implicant, i) => {
			if (!merged[i]) primes.push(implicant);
		});
		current = [...next.values()];
		if (varCount === 0) break;
	}
	return primes;
}

function cover(primes: Implicant[], minterms: number[]): Implicant[] {
	const chosen: Implicant[] = [];
	const remaining = new Set(minterms);

	// Essential prime implicants: the only cover for some minterm.
	for (const m of minterms) {
		const covering = primes.filter((p) => p.covers.includes(m));
		if (covering.length === 1 && !chosen.includes(covering[0])) {
			chosen.push(covering[0]);
		}
	}
	for (const p of chosen) p.covers.forEach((m) => remaining.delete(m));

	// Then greedily take whichever prime covers the most of what is left.
	while (remaining.size) {
		let best: Implicant | null = null;
		let bestCount = 0;
		for (const p of primes) {
			if (chosen.includes(p)) continue;
			const count = p.covers.filter((m) => remaining.has(m)).length;
			if (count > bestCount) {
				best = p;
				bestCount = count;
			}
		}
		if (!best) break;
		chosen.push(best);
		best.covers.forEach((m) => remaining.delete(m));
	}

	// Greedy can pick a term that later choices made redundant; drop those so
	// the result is irredundant.
	for (let i = chosen.length - 1; i >= 0; i--) {
		const without = chosen.filter((_, j) => j !== i);
		const covered = new Set(without.flatMap((p) => p.covers));
		if (minterms.every((m) => covered.has(m))) chosen.splice(i, 1);
	}
	return chosen;
}

export type Notation = 'math' | 'engineering' | 'programming';

const NOTATIONS: Record<Notation, { and: string; or: string; not: (v: string) => string }> = {
	math: { and: ' ∧ ', or: ' ∨ ', not: (v) => `¬${v}` },
	// Engineering notation writes AND as juxtaposition: ab, not a b.
	engineering: { and: '', or: ' + ', not: (v) => `${v}'` },
	programming: { and: ' && ', or: ' || ', not: (v) => `!${v}` }
};

export type Simplified = {
	/** The simplified expression, already formatted. */
	text: string;
	/** Number of AND terms; 0 for a constant result. */
	termCount: number;
	/** Row indices where the function is true. */
	minterms: number[];
	alwaysTrue: boolean;
	alwaysFalse: boolean;
};

/** Minimal-ish sum of products for a truth table, via Quine-McCluskey. */
export function simplify(table: TruthTable, notation: Notation = 'math'): Simplified {
	const { variables, rows } = table;
	const minterms = rows.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
	const style = NOTATIONS[notation];

	if (minterms.length === 0) {
		return { text: '0', termCount: 0, minterms, alwaysTrue: false, alwaysFalse: true };
	}
	if (minterms.length === rows.length) {
		return { text: '1', termCount: 0, minterms, alwaysTrue: true, alwaysFalse: false };
	}

	const chosen = cover(primeImplicants(minterms, variables.length), minterms);

	const terms = chosen
		.map((implicant) => {
			const literals: string[] = [];
			variables.forEach((name, index) => {
				const bit = 1 << (variables.length - 1 - index);
				if (implicant.mask & bit) return; // don't care
				literals.push(implicant.bits & bit ? name : style.not(name));
			});
			return { literals, sortKey: literals.length };
		})
		// Shortest terms first reads better and is stable between runs.
		.sort((a, b) => a.sortKey - b.sortKey || a.literals.join().localeCompare(b.literals.join()))
		.map((term) => term.literals.join(style.and));

	return {
		text: disambiguate(terms.join(style.or)),
		termCount: terms.length,
		minterms,
		alwaysTrue: false,
		alwaysFalse: false
	};
}

/** Renders an AST back to text, used to echo the parsed expression. */
export function format(ast: Ast, notation: Notation = 'math'): string {
	const style = NOTATIONS[notation];
	const xor = notation === 'programming' ? ' ^ ' : ' ⊻ ';
	const walk = (n: Ast, parentPrecedence: number): string => {
		const wrap = (text: string, precedence: number) => (precedence < parentPrecedence ? `(${text})` : text);
		switch (n.t) {
			case 'var':
				return n.name;
			case 'const':
				return n.v ? '1' : '0';
			case 'not': {
				const inner = walk(n.a, 4);
				return style.not(inner);
			}
			case 'and':
				return wrap(`${walk(n.a, 3)}${style.and}${walk(n.b, 3)}`, 3);
			case 'xor':
				return wrap(`${walk(n.a, 2)}${xor}${walk(n.b, 2)}`, 2);
			case 'or':
				return wrap(`${walk(n.a, 1)}${style.or}${walk(n.b, 1)}`, 1);
		}
	};
	return disambiguate(walk(ast, 0));
}

/**
 * Juxtaposed variables can accidentally spell a keyword: variables named o and
 * r print as "or", which reads back as an OR. The tokenizer only treats a whole
 * run of letters as a keyword, so breaking such a run with an explicit AND dot
 * is enough to keep the printed form saying what it means.
 */
function disambiguate(text: string): string {
	return text.replace(/[a-zA-Z]{2,}/g, (run) => (KEYWORDS[run.toLowerCase()] ? run.split('').join('·') : run));
}

/** True when both expressions have the same truth table over their shared variables. */
export function equivalent(a: Ast, b: Ast): boolean {
	const variables = [...new Set([...variablesOf(a), ...variablesOf(b)])].sort((x, y) => x.localeCompare(y));
	if (variables.length > MAX_VARS) throw new BooleanError(`That is more than ${MAX_VARS} variables`);
	const left = truthTable(a, variables);
	const right = truthTable(b, variables);
	return left.rows.every((value, i) => value === right.rows[i]);
}

// --- Karnaugh maps -----------------------------------------------------------

/** Gray code sequence of `bits` length: successive entries differ in one bit. */
export function grayCode(bits: number): number[] {
	return Array.from({ length: 1 << bits }, (_, i) => i ^ (i >> 1));
}

export type KMapGroup = {
	/** Row/column pairs this group covers, as `${row},${col}` keys. */
	cells: string[];
	/** The product term, already formatted. */
	term: string;
	size: number;
};

export type KMap = {
	/** Variables shown down the left edge. */
	rowVars: string[];
	/** Variables shown across the top. */
	colVars: string[];
	/** Gray-coded row headers, as bit strings. */
	rowLabels: string[];
	colLabels: string[];
	/** cells[row][col] is true where the output is 1 (don't cares are false). */
	cells: boolean[][];
	/** The same grid including don't cares. */
	values: CellValue[][];
	/** Minterm index for each cell, matching the truth table row order. */
	indices: number[][];
	groups: KMapGroup[];
	/** The minimal sum of products, already formatted. */
	text: string;
	termCount: number;
};

/**
 * Lays a truth table out as a Karnaugh map and derives the covering groups
 * from the same prime implicants the simplifier uses, so the highlighted
 * rectangles always match the simplified expression.
 */
/** A square on a map: 0, 1, or a don't care that may be grouped either way. */
export type CellValue = 0 | 1 | 'x';

/** Splits the variables across the two axes and works out the Gray ordering. */
function kmapLayout(variables: string[]) {
	const colCount = Math.ceil(variables.length / 2);
	const rowVars = variables.slice(0, variables.length - colCount);
	const colVars = variables.slice(variables.length - colCount);
	const rowGray = grayCode(rowVars.length);
	const colGray = grayCode(colVars.length);
	const pad = (value: number, bits: number) => (bits === 0 ? '' : value.toString(2).padStart(bits, '0'));

	// Row bits are the high bits of the minterm index, column bits the low.
	const indices = rowGray.map((r) => colGray.map((c) => (r << colVars.length) | c));

	return {
		rowVars,
		colVars,
		rowLabels: rowGray.map((v) => pad(v, rowVars.length)),
		colLabels: colGray.map((v) => pad(v, colVars.length)),
		indices
	};
}

function formatImplicant(implicant: Implicant, variables: string[], style: typeof NOTATIONS[Notation]): string {
	const literals: string[] = [];
	variables.forEach((name, index) => {
		const bit = 1 << (variables.length - 1 - index);
		if (implicant.mask & bit) return; // this variable is not fixed in the cube
		literals.push(implicant.bits & bit ? name : style.not(name));
	});
	// No fixed variables means the cube is the whole map.
	return disambiguate(literals.join(style.and)) || '1';
}

/**
 * Minimal cover of `minterms`. Don't cares may be swallowed into a group when
 * that makes it bigger, but never have to be covered themselves, which is what
 * makes them worth marking.
 */
export function minimise(minterms: number[], dontCares: number[], varCount: number): Implicant[] {
	if (minterms.length === 0) return [];
	const seeds = [...new Set([...minterms, ...dontCares])].sort((a, b) => a - b);
	return cover(primeImplicants(seeds, varCount), minterms);
}

/** Builds the map straight from cell values, so don't cares can be expressed. */
export function karnaughMapFromCells(variables: string[], values: CellValue[], notation: Notation = 'math'): KMap {
	const layout = kmapLayout(variables);
	const style = NOTATIONS[notation];

	const cells = layout.indices.map((row) => row.map((index) => values[index] === 1));
	const cellValues = layout.indices.map((row) => row.map((index) => values[index] ?? 0));

	const minterms = values.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
	const dontCares = values.map((v, i) => (v === 'x' ? i : -1)).filter((i) => i >= 0);

	const groups: KMapGroup[] = minimise(minterms, dontCares, variables.length)
		.map((implicant) => {
			const cellKeys: string[] = [];
			layout.indices.forEach((indexRow, r) =>
				indexRow.forEach((index, c) => {
					if (implicant.covers.includes(index)) cellKeys.push(`${r},${c}`);
				})
			);
			return {
				cells: cellKeys,
				term: formatImplicant(implicant, variables, style),
				size: implicant.covers.length
			};
		})
		.sort((a, b) => b.size - a.size);

	return {
		...layout,
		cells,
		values: cellValues,
		groups,
		text: groups.length ? groups.map((g) => g.term).join(style.or) : '0',
		termCount: groups.length
	};
}

export function karnaughMap(table: TruthTable, notation: Notation = 'math'): KMap {
	const values: CellValue[] = table.rows.map((v) => (v ? 1 : 0));
	return karnaughMapFromCells(table.variables, values, notation);
}

// --- canonical forms: minterms, maxterms, SOP and POS -----------------------

export type CanonicalForms = {
	/** Row indices where the function is true. */
	minterms: number[];
	/** Row indices where the function is false. */
	maxterms: number[];
	/** Sigma notation, e.g. "Σm(0, 2, 5)". */
	sigma: string;
	/** Pi notation, e.g. "ΠM(1, 3, 4)". */
	pi: string;
	/** Every minterm written out in full, ORed together. */
	canonicalSop: string;
	/** Every maxterm written out in full, ANDed together. */
	canonicalPos: string;
	/** Minimal sum of products (Quine-McCluskey). */
	minimalSop: string;
	/** Minimal product of sums (Quine-McCluskey on the complement). */
	minimalPos: string;
	sopTermCount: number;
	posTermCount: number;
};

/** The literal for one variable inside a minterm: 1 means the plain variable. */
function literalFor(name: string, high: boolean, style: typeof NOTATIONS[Notation]) {
	return high ? name : style.not(name);
}

function mintermTerm(index: number, variables: string[], style: typeof NOTATIONS[Notation]) {
	return variables
		.map((name, i) => literalFor(name, !!(index & (1 << (variables.length - 1 - i))), style))
		.join(style.and);
}

/** A maxterm is the complement of a minterm: polarities flip and AND becomes OR. */
function maxtermTerm(index: number, variables: string[], style: typeof NOTATIONS[Notation]) {
	return variables
		.map((name, i) => literalFor(name, !(index & (1 << (variables.length - 1 - i))), style))
		.join(style.or);
}

export function canonicalForms(table: TruthTable, notation: Notation = 'math'): CanonicalForms {
	const { variables, rows } = table;
	const style = NOTATIONS[notation];
	const minterms = rows.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
	const maxterms = rows.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

	const wrap = (term: string, needed: boolean) => (needed ? `(${term})` : term);
	const canonicalSop = minterms.length
		? disambiguate(minterms.map((m) => wrap(mintermTerm(m, variables, style), variables.length > 1)).join(style.or))
		: '0';
	const canonicalPos = maxterms.length
		? disambiguate(maxterms.map((m) => wrap(maxtermTerm(m, variables, style), variables.length > 1)).join(style.and))
		: '1';

	const sop = simplify(table, notation);

	// Minimal POS: minimise the complement, then De Morgan each product term
	// into a sum term. Cheaper and less error prone than a separate algorithm.
	let minimalPos: string;
	let posTermCount: number;
	if (minterms.length === 0) {
		minimalPos = '0';
		posTermCount = 0;
	} else if (maxterms.length === 0) {
		minimalPos = '1';
		posTermCount = 0;
	} else {
		const chosen = cover(primeImplicants(maxterms, variables.length), maxterms);
		const terms = chosen
			.map((implicant) => {
				const literals: string[] = [];
				variables.forEach((name, index) => {
					const bit = 1 << (variables.length - 1 - index);
					if (implicant.mask & bit) return;
					// Complementing the product term flips every literal.
					literals.push(implicant.bits & bit ? style.not(name) : name);
				});
				return literals;
			})
			.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()))
			.map((literals) => wrap(literals.join(style.or), literals.length > 1));
		minimalPos = disambiguate(terms.join(style.and));
		posTermCount = terms.length;
	}

	const list = (items: number[]) => items.join(', ');
	return {
		minterms,
		maxterms,
		sigma: `Σm(${list(minterms)})`,
		pi: `ΠM(${list(maxterms)})`,
		canonicalSop,
		canonicalPos,
		minimalSop: sop.text,
		minimalPos,
		sopTermCount: sop.termCount,
		posTermCount
	};
}

// --- gray code --------------------------------------------------------------

export const toGray = (value: number) => value ^ (value >> 1);

export function fromGray(gray: number): number {
	let value = gray;
	for (let shift = 1; shift < 32; shift <<= 1) value ^= value >> shift;
	return value;
}

export const toBinaryString = (value: number, bits: number) => value.toString(2).padStart(bits, '0');

// --- universal gate conversion ----------------------------------------------

export type UniversalKind = 'nand' | 'nor';

/** Folds away constants so the conversion never has to invent a 0 or 1. */
export function foldConstants(ast: Ast): Ast {
	switch (ast.t) {
		case 'var':
		case 'const':
			return ast;
		case 'not': {
			const a = foldConstants(ast.a);
			if (a.t === 'const') return { t: 'const', v: !a.v };
			return { t: 'not', a };
		}
		case 'and': {
			const a = foldConstants(ast.a);
			const b = foldConstants(ast.b);
			if (a.t === 'const') return a.v ? b : { t: 'const', v: false };
			if (b.t === 'const') return b.v ? a : { t: 'const', v: false };
			return { t: 'and', a, b };
		}
		case 'or': {
			const a = foldConstants(ast.a);
			const b = foldConstants(ast.b);
			if (a.t === 'const') return a.v ? { t: 'const', v: true } : b;
			if (b.t === 'const') return b.v ? { t: 'const', v: true } : a;
			return { t: 'or', a, b };
		}
		case 'xor': {
			const a = foldConstants(ast.a);
			const b = foldConstants(ast.b);
			if (a.t === 'const') return a.v ? foldConstants({ t: 'not', a: b }) : b;
			if (b.t === 'const') return b.v ? foldConstants({ t: 'not', a }) : a;
			return { t: 'xor', a, b };
		}
	}
}

const nand = (a: Ast, b: Ast): Ast => ({ t: 'not', a: { t: 'and', a, b } });
const nor = (a: Ast, b: Ast): Ast => ({ t: 'not', a: { t: 'or', a, b } });

/**
 * Rewrites an expression so it uses only NAND (or only NOR) operations. The
 * result is still a normal Ast — a NAND is `not(and(x, y))` — so it can be
 * evaluated, printed and equivalence-checked like anything else.
 */
export function toUniversal(ast: Ast, kind: UniversalKind): Ast {
	const folded = foldConstants(ast);
	const g = kind === 'nand' ? nand : nor;

	const convert = (n: Ast): Ast => {
		switch (n.t) {
			case 'var':
				return n;
			case 'const':
				// Only reachable when the whole expression is constant.
				return n;
			case 'not': {
				const a = convert(n.a);
				return g(a, a);
			}
			case 'and': {
				const a = convert(n.a);
				const b = convert(n.b);
				// NAND: invert the NAND. NOR: OR the two inverted inputs.
				return kind === 'nand' ? g(g(a, b), g(a, b)) : g(g(a, a), g(b, b));
			}
			case 'or': {
				const a = convert(n.a);
				const b = convert(n.b);
				return kind === 'nand' ? g(g(a, a), g(b, b)) : g(g(a, b), g(a, b));
			}
			case 'xor': {
				const a = convert(n.a);
				const b = convert(n.b);
				if (kind === 'nand') {
					// The classic four gate NAND XOR.
					const c = g(a, b);
					return g(g(a, c), g(b, c));
				}
				// The dual gives XNOR, so invert it: five NOR gates in total.
				const c = g(a, b);
				const xnor = g(g(a, c), g(b, c));
				return g(xnor, xnor);
			}
		}
	};
	return convert(folded);
}

/** A structural key: identical subtrees share one key, and one gate. */
export const astKey = (ast: Ast): string => {
	switch (ast.t) {
		case 'var':
			return ast.name;
		case 'const':
			return ast.v ? '1' : '0';
		case 'not':
			return `!(${astKey(ast.a)})`;
		default:
			return `(${astKey(ast.a)}${ast.t}${astKey(ast.b)})`;
	}
};

/**
 * Counts the gates a converted expression really needs. Identical subtrees are
 * one shared gate in a circuit, so they are counted once.
 */
export function countUniversalGates(ast: Ast): number {
	const seen = new Set<string>();
	const walk = (n: Ast) => {
		if (n.t === 'not' && (n.a.t === 'and' || n.a.t === 'or')) {
			seen.add(astKey(n));
			walk(n.a.a);
			walk(n.a.b);
			return;
		}
		if (n.t === 'not') return walk(n.a);
		if (n.t === 'and' || n.t === 'or' || n.t === 'xor') {
			walk(n.a);
			walk(n.b);
		}
	};
	walk(ast);
	return seen.size;
}

/** Prints a converted expression as nested NAND(a, b) / NOR(a, b) calls. */
export function formatUniversal(ast: Ast, kind: UniversalKind): string {
	const label = kind.toUpperCase();
	const walk = (n: Ast): string => {
		if (n.t === 'not' && (n.a.t === 'and' || n.a.t === 'or')) {
			return `${label}(${walk(n.a.a)}, ${walk(n.a.b)})`;
		}
		if (n.t === 'var') return n.name;
		if (n.t === 'const') return n.v ? '1' : '0';
		// Should not occur after conversion, but keep the output honest.
		return format(n, 'programming');
	};
	return walk(ast);
}
