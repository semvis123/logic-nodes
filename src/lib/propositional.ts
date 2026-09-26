// Truth tables for statements in propositional logic: p → q, ¬p ∨ q, p ↔ q.
// Kept apart from the boolean engine on purpose. That one is circuit algebra
// (ab means a AND b, rows count up from 0), which every other tool depends
// on; this one follows the logic textbook: explicit connectives, a column for
// every subformula, and rows starting from all true.

export type Prop =
	| { t: 'var'; name: string }
	| { t: 'const'; v: boolean }
	| { t: 'not'; a: Prop }
	| { t: Connective; a: Prop; b: Prop };

export type Connective = 'and' | 'or' | 'xor' | 'imp' | 'iff';

export const MAX_PROP_VARS = 6;

export class PropError extends Error {}

type Token =
	| { k: 'var'; name: string }
	| { k: 'const'; v: boolean }
	| { k: 'op'; op: Connective }
	| { k: 'not' }
	| { k: '(' }
	| { k: ')' }
	| { k: ',' }
	| { k: 'therefore' };

const KEYWORDS: Record<string, Token> = {
	and: { k: 'op', op: 'and' },
	or: { k: 'op', op: 'or' },
	xor: { k: 'op', op: 'xor' },
	implies: { k: 'op', op: 'imp' },
	iff: { k: 'op', op: 'iff' },
	not: { k: 'not' },
	true: { k: 'const', v: true },
	false: { k: 'const', v: false },
	therefore: { k: 'therefore' }
};

// Longest first, so <-> is not read as < and ->.
const SYMBOLS: [string, Token][] = [
	['<->', { k: 'op', op: 'iff' }],
	['<=>', { k: 'op', op: 'iff' }],
	['->', { k: 'op', op: 'imp' }],
	['=>', { k: 'op', op: 'imp' }],
	['|-', { k: 'therefore' }],
	['&&', { k: 'op', op: 'and' }],
	['||', { k: 'op', op: 'or' }],
	['↔', { k: 'op', op: 'iff' }],
	['⇔', { k: 'op', op: 'iff' }],
	['≡', { k: 'op', op: 'iff' }],
	['→', { k: 'op', op: 'imp' }],
	['⇒', { k: 'op', op: 'imp' }],
	['⊃', { k: 'op', op: 'imp' }],
	['∧', { k: 'op', op: 'and' }],
	['&', { k: 'op', op: 'and' }],
	// In a logic class p ^ q is a wedge, not the XOR of C.
	['^', { k: 'op', op: 'and' }],
	['·', { k: 'op', op: 'and' }],
	['*', { k: 'op', op: 'and' }],
	['∨', { k: 'op', op: 'or' }],
	['|', { k: 'op', op: 'or' }],
	['+', { k: 'op', op: 'or' }],
	['⊕', { k: 'op', op: 'xor' }],
	['⊻', { k: 'op', op: 'xor' }],
	['¬', { k: 'not' }],
	['~', { k: 'not' }],
	['!', { k: 'not' }],
	['⊤', { k: 'const', v: true }],
	['⊥', { k: 'const', v: false }],
	['∴', { k: 'therefore' }],
	['⊢', { k: 'therefore' }],
	['(', { k: '(' }],
	[')', { k: ')' }],
	['[', { k: '(' }],
	[']', { k: ')' }],
	[',', { k: ',' }],
	[';', { k: ',' }]
];

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
		if (/[a-zA-Z]/.test(c)) {
			let j = i;
			while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
			const word = input.slice(i, j);
			const keyword = KEYWORDS[word.toLowerCase()];
			if (keyword) tokens.push(keyword);
			else if (word.length === 1) tokens.push({ k: 'var', name: word });
			else throw new PropError(`Write each statement as one letter, like p or q, not "${word}"`);
			i = j;
			continue;
		}
		const symbol = SYMBOLS.find(([text]) => input.startsWith(text, i));
		if (!symbol) throw new PropError(`I don't understand "${c}"`);
		tokens.push(symbol[1]);
		i += symbol[0].length;
	}
	return tokens;
}

// Binding strength, loosest first. ¬ binds tightest of all.
const PRECEDENCE: Record<Connective, number> = { iff: 1, imp: 2, or: 3, xor: 4, and: 5 };

function parseTokens(tokens: Token[]): Prop {
	let pos = 0;
	const peek = () => tokens[pos];

	// A lone v between two statements is the textbook wedge for OR: "p v q".
	const opAt = (level: number): Connective | undefined => {
		const token = peek();
		if (token?.k === 'op' && PRECEDENCE[token.op] === level) return token.op;
		if (level === PRECEDENCE.or && token?.k === 'var' && token.name.toLowerCase() === 'v') return 'or';
		return undefined;
	};

	const parseLevel = (level: number): Prop => {
		if (level > PRECEDENCE.and) return parseUnary();
		const left = parseLevel(level + 1);
		if (level === PRECEDENCE.imp) {
			// p → q → r means p → (q → r), the standard convention.
			if (opAt(level)) {
				pos++;
				return { t: 'imp', a: left, b: parseLevel(level) };
			}
			return left;
		}
		let node = left;
		for (let op = opAt(level); op; op = opAt(level)) {
			pos++;
			node = { t: op, a: node, b: parseLevel(level + 1) };
		}
		return node;
	};

	const parseUnary = (): Prop => {
		if (peek()?.k === 'not') {
			pos++;
			return { t: 'not', a: parseUnary() };
		}
		return parsePrimary();
	};

	const parsePrimary = (): Prop => {
		const token = peek();
		if (!token) throw new PropError('The statement stops early');
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
			const inner = parseLevel(1);
			if (peek()?.k !== ')') throw new PropError('A bracket is never closed');
			pos++;
			return inner;
		}
		if (token.k === ')') throw new PropError('A closing bracket has nothing to close');
		throw new PropError('A connective is missing a statement to work on');
	};

	const prop = parseLevel(1);
	if (pos !== tokens.length) {
		const token = peek();
		if (token.k === 'var' || token.k === 'const' || token.k === '(' || token.k === 'not') {
			throw new PropError('Two statements sit side by side: put a connective such as ∧ or → between them');
		}
		throw new PropError('There is a leftover connective');
	}
	return prop;
}

export function parseProp(input: string): Prop {
	const tokens = tokenize(input);
	if (tokens.some((t) => t.k === ',' || t.k === 'therefore')) {
		throw new PropError('Only one statement is allowed here');
	}
	return parseTokens(tokens);
}

/**
 * The input to the calculator: one statement, several separated by commas to
 * compare them, or premises then ∴ and a conclusion to test an argument.
 */
export type PropInput = { statements: Prop[]; conclusion: Prop | null };

export function parsePropInput(input: string): PropInput {
	const tokens = tokenize(input);
	const turn = tokens.findIndex((t) => t.k === 'therefore');
	if (turn !== -1 && tokens.slice(turn + 1).some((t) => t.k === 'therefore')) {
		throw new PropError('An argument has only one conclusion, so only one ∴');
	}
	const split = (part: Token[]): Prop[] => {
		const groups: Token[][] = [[]];
		for (const token of part) {
			if (token.k === ',') groups.push([]);
			else groups[groups.length - 1].push(token);
		}
		if (groups.some((g) => g.length === 0)) throw new PropError('There is an empty statement between two commas');
		return groups.map(parseTokens);
	};
	if (turn === -1) return { statements: split(tokens), conclusion: null };
	const premises = turn === 0 ? [] : split(tokens.slice(0, turn));
	const after = split(tokens.slice(turn + 1));
	if (after.length !== 1) throw new PropError('Put a single statement after ∴');
	return { statements: premises, conclusion: after[0] };
}

export function evaluateProp(p: Prop, values: Record<string, boolean>): boolean {
	switch (p.t) {
		case 'var':
			return values[p.name];
		case 'const':
			return p.v;
		case 'not':
			return !evaluateProp(p.a, values);
		case 'and':
			return evaluateProp(p.a, values) && evaluateProp(p.b, values);
		case 'or':
			return evaluateProp(p.a, values) || evaluateProp(p.b, values);
		case 'xor':
			return evaluateProp(p.a, values) !== evaluateProp(p.b, values);
		case 'imp':
			return !evaluateProp(p.a, values) || evaluateProp(p.b, values);
		case 'iff':
			return evaluateProp(p.a, values) === evaluateProp(p.b, values);
	}
}

export const CONNECTIVE_SYMBOL: Record<Connective, string> = {
	and: '∧',
	or: '∨',
	xor: '⊕',
	imp: '→',
	iff: '↔'
};

const strength = (p: Prop) => (p.t === 'var' || p.t === 'const' || p.t === 'not' ? 6 : PRECEDENCE[p.t]);

/** Standard notation with only the brackets the reading needs. */
export function formatProp(p: Prop): string {
	switch (p.t) {
		case 'var':
			return p.name;
		case 'const':
			return p.v ? '⊤' : '⊥';
		case 'not': {
			const inner = formatProp(p.a);
			return strength(p.a) === 6 ? `¬${inner}` : `¬(${inner})`;
		}
		default: {
			const level = PRECEDENCE[p.t];
			// → groups to the right, the rest to the left, so the bracket goes on
			// whichever side would otherwise be read the other way.
			const leftNeeds = p.t === 'imp' ? strength(p.a) <= level : strength(p.a) < level;
			const rightNeeds = p.t === 'imp' ? strength(p.b) < level : strength(p.b) <= level;
			const left = leftNeeds ? `(${formatProp(p.a)})` : formatProp(p.a);
			const right = rightNeeds ? `(${formatProp(p.b)})` : formatProp(p.b);
			return `${left} ${CONNECTIVE_SYMBOL[p.t]} ${right}`;
		}
	}
}

export function propVariables(props: Prop[]): string[] {
	const found = new Set<string>();
	const walk = (p: Prop) => {
		if (p.t === 'var') found.add(p.name);
		else if (p.t === 'not') walk(p.a);
		else if (p.t !== 'const') {
			walk(p.a);
			walk(p.b);
		}
	};
	props.forEach(walk);
	return [...found].sort((x, y) => x.localeCompare(y));
}

/** Every compound subformula, innermost first, each once: the working columns. */
export function subformulas(props: Prop[]): Prop[] {
	const seen = new Map<string, Prop>();
	const walk = (p: Prop) => {
		if (p.t === 'var' || p.t === 'const') return;
		if (p.t === 'not') walk(p.a);
		else {
			walk(p.a);
			walk(p.b);
		}
		const key = formatProp(p);
		if (!seen.has(key)) seen.set(key, p);
	};
	props.forEach(walk);
	return [...seen.values()];
}

export type Column = { label: string; prop: Prop; values: boolean[] };

export type PropTable = {
	variables: string[];
	/** rows[i][j]: the value of variables[j] in row i. */
	rows: boolean[][];
	/** The working: every compound subformula, innermost first. */
	steps: Column[];
	/** The statements as typed (premises, when there is a conclusion). */
	statements: Column[];
	conclusion: Column | null;
};

/**
 * Rows start from all true, the order in logic textbooks, unless falseFirst
 * asks for the counting order used in computer science.
 */
export function propTable(input: PropInput, falseFirst = false): PropTable {
	const all = input.conclusion ? [...input.statements, input.conclusion] : input.statements;
	const variables = propVariables(all);
	if (variables.length > MAX_PROP_VARS) {
		throw new PropError(`That is more than ${MAX_PROP_VARS} letters, which would be over 64 rows`);
	}
	const n = variables.length;
	const rows: boolean[][] = [];
	for (let i = 0; i < 1 << n; i++) {
		const index = falseFirst ? i : (1 << n) - 1 - i;
		rows.push(variables.map((_, bit) => !!(index & (1 << (n - 1 - bit)))));
	}
	const column = (prop: Prop): Column => ({
		label: formatProp(prop),
		prop,
		values: rows.map((row) => evaluateProp(prop, Object.fromEntries(variables.map((v, j) => [v, row[j]]))))
	});
	return {
		variables,
		rows,
		steps: subformulas(all).map(column),
		statements: input.statements.map(column),
		conclusion: input.conclusion ? column(input.conclusion) : null
	};
}

export type Classification = 'tautology' | 'contradiction' | 'contingency';

export function classify(values: boolean[]): Classification {
	if (values.every(Boolean)) return 'tautology';
	if (!values.some(Boolean)) return 'contradiction';
	return 'contingency';
}

/**
 * An argument is valid when no row makes every premise true and the
 * conclusion false. Returns the rows where the premises all hold, and the
 * counterexamples among them.
 */
export function checkArgument(table: PropTable): { critical: number[]; counterexamples: number[]; valid: boolean } {
	if (!table.conclusion) throw new PropError('There is no conclusion to check');
	const critical = table.rows.map((_, i) => i).filter((i) => table.statements.every((s) => s.values[i]));
	const counterexamples = critical.filter((i) => !table.conclusion!.values[i]);
	return { critical, counterexamples, valid: counterexamples.length === 0 };
}

/** Groups statements whose columns agree on every row. */
export function equivalenceGroups(columns: Column[]): number[][] {
	const groups: number[][] = [];
	columns.forEach((column, i) => {
		const group = groups.find((g) => columns[g[0]].values.every((v, r) => v === column.values[r]));
		if (group) group.push(i);
		else groups.push([i]);
	});
	return groups;
}
