// Expression trees: the shape a parser gives an expression, drawn as a tree
// with one node per connective and a leaf per letter. Works for both engines:
// propositional logic (¬ ∧ ∨ ⊕ → ↔) and circuit algebra (in any of its three
// notations). Dependency free; the layout is in abstract units so the same
// numbers serve the SVG component and the tests.

import { formatProp, CONNECTIVE_SYMBOL, type Prop } from './propositional.js';
import { format, type Ast, type Notation } from './boolean.js';

export type TreeOp = 'not' | 'and' | 'or' | 'xor' | 'imp' | 'iff';

export type TreeNode = {
	/** What the node shows: a connective symbol, a letter, or a constant. */
	label: string;
	kind: 'op' | 'var' | 'const';
	/** The connective, for operator nodes. */
	op?: TreeOp;
	/** The letter, for variable nodes. */
	name?: string;
	/** The value of a constant node. */
	constant?: boolean;
	children: TreeNode[];
	/** Filled in by withValues. */
	value?: boolean;
	/** The subexpression this node stands for, as text. */
	expr: string;
};

export type TreeOptions = {
	/**
	 * Merge chains of the same associative connective (∧, ∨) into one node
	 * with several children. Off by default, so the tree is exactly the parse.
	 */
	flatten?: boolean;
};

const FLATTENS: TreeOp[] = ['and', 'or'];

/** The operands of a chain of the same connective, left to right. */
function propOperands(p: Prop, op: string): Prop[] {
	return p.t === op && p.t !== 'not' && p.t !== 'var' && p.t !== 'const'
		? [...propOperands(p.a, op), ...propOperands(p.b, op)]
		: [p];
}

function astOperands(n: Ast, op: string): Ast[] {
	return n.t === op && n.t !== 'not' && n.t !== 'var' && n.t !== 'const'
		? [...astOperands(n.a, op), ...astOperands(n.b, op)]
		: [n];
}

export function treeFromProp(p: Prop, options: TreeOptions = {}): TreeNode {
	const expr = formatProp(p);
	switch (p.t) {
		case 'var':
			return { label: p.name, kind: 'var', name: p.name, children: [], expr };
		case 'const':
			return { label: p.v ? '⊤' : '⊥', kind: 'const', constant: p.v, children: [], expr };
		case 'not':
			return { label: '¬', kind: 'op', op: 'not', children: [treeFromProp(p.a, options)], expr };
		default: {
			const parts =
				options.flatten && FLATTENS.includes(p.t) ? [...propOperands(p.a, p.t), ...propOperands(p.b, p.t)] : [p.a, p.b];
			return {
				label: CONNECTIVE_SYMBOL[p.t],
				kind: 'op',
				op: p.t,
				children: parts.map((c) => treeFromProp(c, options)),
				expr
			};
		}
	}
}

const AST_LABELS: Record<Notation, Record<'not' | 'and' | 'or' | 'xor', string>> = {
	math: { not: '¬', and: '∧', or: '∨', xor: '⊻' },
	engineering: { not: '′', and: '·', or: '+', xor: '⊻' },
	programming: { not: '!', and: '&&', or: '||', xor: '^' }
};

export function treeFromAst(ast: Ast, notation: Notation = 'math', options: TreeOptions = {}): TreeNode {
	const expr = format(ast, notation);
	const labels = AST_LABELS[notation];
	switch (ast.t) {
		case 'var':
			return { label: ast.name, kind: 'var', name: ast.name, children: [], expr };
		case 'const':
			return { label: ast.v ? '1' : '0', kind: 'const', constant: ast.v, children: [], expr };
		case 'not':
			return { label: labels.not, kind: 'op', op: 'not', children: [treeFromAst(ast.a, notation, options)], expr };
		default: {
			const parts =
				options.flatten && FLATTENS.includes(ast.t)
					? [...astOperands(ast.a, ast.t), ...astOperands(ast.b, ast.t)]
					: [ast.a, ast.b];
			return {
				label: labels[ast.t],
				kind: 'op',
				op: ast.t,
				children: parts.map((c) => treeFromAst(c, notation, options)),
				expr
			};
		}
	}
}

/** Every letter in the tree, sorted, each once. */
export function treeVariables(tree: TreeNode): string[] {
	const found = new Set<string>();
	const walk = (n: TreeNode) => {
		if (n.kind === 'var' && n.name) found.add(n.name);
		n.children.forEach(walk);
	};
	walk(tree);
	return [...found].sort((x, y) => x.localeCompare(y));
}

/**
 * A copy of the tree with the value of every node for one row, worked out
 * from the leaves up, the way the working columns of a truth table are.
 */
export function withValues(tree: TreeNode, values: Record<string, boolean>): TreeNode {
	const children = tree.children.map((c) => withValues(c, values));
	const v = children.map((c) => c.value as boolean);
	let value: boolean;
	if (tree.kind === 'var') {
		if (!Object.prototype.hasOwnProperty.call(values, tree.name!)) throw new Error(`No value for ${tree.name}`);
		value = !!values[tree.name!];
	} else if (tree.kind === 'const') {
		value = !!tree.constant;
	} else {
		switch (tree.op) {
			case 'not':
				value = !v[0];
				break;
			case 'and':
				value = v.every(Boolean);
				break;
			case 'or':
				value = v.some(Boolean);
				break;
			case 'xor':
				// Odd parity, which is what a chain of ⊕ gives.
				value = v.filter(Boolean).length % 2 === 1;
				break;
			case 'imp':
				value = !v[0] || v[1];
				break;
			case 'iff':
				value = v[0] === v[1];
				break;
			default:
				throw new Error(`Unknown connective ${tree.op}`);
		}
	}
	return { ...tree, children, value };
}

export type LaidOutNode = {
	/** Preorder index: 0 is the root. */
	id: number;
	node: TreeNode;
	/** Leaves sit at 0, 1, 2, … from left to right; parents in between. */
	x: number;
	/** The depth: 0 for the root. */
	y: number;
	parent: number | null;
};

export type TreeLayout = {
	nodes: LaidOutNode[];
	edges: { from: number; to: number }[];
	/** The span of x: leaves run from 0 to width. */
	width: number;
	/** The deepest level. */
	height: number;
	leafCount: number;
};

/**
 * A tidy layout: the leaves are spaced one unit apart in reading order, every
 * parent is centred over its first and last child, and each level of depth is
 * one unit lower. A subtree owns a run of consecutive leaves, so subtrees never
 * overlap and edges never cross.
 */
export function layoutTree(tree: TreeNode): TreeLayout {
	const nodes: LaidOutNode[] = [];
	const edges: { from: number; to: number }[] = [];
	let nextLeaf = 0;
	let height = 0;
	const place = (node: TreeNode, depth: number, parent: number | null): number => {
		const id = nodes.length;
		const entry: LaidOutNode = { id, node, x: 0, y: depth, parent };
		nodes.push(entry);
		if (parent !== null) edges.push({ from: parent, to: id });
		height = Math.max(height, depth);
		if (!node.children.length) {
			entry.x = nextLeaf++;
		} else {
			const xs = node.children.map((child) => nodes[place(child, depth + 1, id)].x);
			entry.x = (xs[0] + xs[xs.length - 1]) / 2;
		}
		return id;
	};
	place(tree, 0, null);
	return { nodes, edges, width: Math.max(0, nextLeaf - 1), height, leafCount: nextLeaf };
}

/** Counts for a short description of the tree. */
export function treeStats(tree: TreeNode): { operators: number; leaves: number; depth: number } {
	let operators = 0;
	let leaves = 0;
	let depth = 0;
	const walk = (n: TreeNode, d: number) => {
		depth = Math.max(depth, d);
		if (n.children.length) operators++;
		else leaves++;
		n.children.forEach((c) => walk(c, d + 1));
	};
	walk(tree, 0);
	return { operators, leaves, depth };
}
