// The set notation reference: every symbol with its name, how it is read and
// an example worked out on small concrete sets. It lives here rather than in
// the page so the printable chart (scripts/reference-charts.ts) is drawn from
// exactly the same rows, with every example computed by the set engine.

import { parseSet, evaluateOn, roster } from './venn.js';

// Every example below is computed from these sets at build time.
export const universe = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
export const sets = { A: new Set([1, 2, 3, 4]), B: new Set([3, 4, 5, 6]) };
export const value = (expression: string) => roster(evaluateOn(parseSet(expression), sets, universe));
const subset = (x: Set<number>, y: Set<number>) => [...x].every((v) => y.has(v));
const small = new Set([1, 2]);
const tf = (v: boolean) => (v ? 'true' : 'false');

/** Every subset, smallest first: each item doubles the list, with and without it. */
function powerSet(items: number[]): number[][] {
	let all: number[][] = [[]];
	for (const item of items) all = [...all, ...all.map((s) => [...s, item])];
	return all.sort((x, y) => x.length - y.length);
}
const powerOfSmall = `{${powerSet([...small])
	.map((s) => roster(s))
	.join(', ')}}`;
const product = [...small].flatMap((x) => ['x', 'y'].map((y) => `(${x}, ${y})`));
export const evens = [...universe].filter((x) => x % 2 === 0);

export type SymbolRow = {
	id: string;
	symbol: string;
	name: string;
	reads: string;
	example: string;
	/** A two-set expression to draw, for the symbols that are operations. */
	diagram?: string;
	logic?: string;
};

export const symbolRows: SymbolRow[] = [
	{
		id: 'element',
		symbol: '∈',
		name: 'Element of',
		reads: 'is an element of, is in',
		example: `3 ∈ A is ${tf(sets.A.has(3))}`,
		logic: 'x ∈ A is a statement: true or false'
	},
	{
		id: 'not-element',
		symbol: '∉',
		name: 'Not an element of',
		reads: 'is not an element of',
		example: `7 ∉ A is ${tf(!sets.A.has(7))}`,
		logic: '¬(x ∈ A)'
	},
	{
		id: 'subset',
		symbol: '⊆',
		name: 'Subset',
		reads: 'is a subset of',
		example: `{1, 2} ⊆ A is ${tf(subset(small, sets.A))}; A ⊆ A is ${tf(subset(sets.A, sets.A))}`,
		logic: 'x ∈ X → x ∈ Y, for every x'
	},
	{
		id: 'proper-subset',
		symbol: '⊂',
		name: 'Proper subset',
		reads: 'is a proper subset of',
		example: `{1, 2} ⊂ A is ${tf(subset(small, sets.A) && small.size < sets.A.size)}; A ⊂ A is ${tf(false)}`,
		logic: 'X ⊆ Y and X ≠ Y'
	},
	{
		id: 'superset',
		symbol: '⊇',
		name: 'Superset',
		reads: 'is a superset of, contains',
		example: `A ⊇ {3, 4} is ${tf(subset(new Set([3, 4]), sets.A))}`,
		logic: 'x ∈ Y → x ∈ X, for every x'
	},
	{
		id: 'union',
		symbol: '∪',
		name: 'Union',
		reads: 'A union B; in A or B',
		example: `A ∪ B = ${value('A ∪ B')}`,
		diagram: 'A ∪ B',
		logic: '∨ (OR)'
	},
	{
		id: 'intersection',
		symbol: '∩',
		name: 'Intersection',
		reads: 'A intersect B; in A and B',
		example: `A ∩ B = ${value('A ∩ B')}`,
		diagram: 'A ∩ B',
		logic: '∧ (AND)'
	},
	{
		id: 'complement',
		symbol: 'A′\nAᶜ',
		name: 'Complement',
		reads: 'A complement; not in A',
		example: `A′ = ${value('A′')}`,
		diagram: 'A′',
		logic: '¬ (NOT)'
	},
	{
		id: 'difference',
		symbol: 'A − B\nA \\ B',
		name: 'Difference',
		reads: 'A minus B; in A but not B',
		example: `A − B = ${value('A − B')}, B − A = ${value('B − A')}`,
		diagram: 'A − B',
		logic: 'A ∧ ¬B (AND NOT)'
	},
	{
		id: 'symmetric-difference',
		symbol: 'Δ',
		name: 'Symmetric difference',
		reads: 'in A or B but not both',
		example: `A Δ B = ${value('A Δ B')}`,
		diagram: 'A Δ B',
		logic: '⊕ (XOR)'
	},
	{
		id: 'empty',
		symbol: '∅\n{ }',
		name: 'Empty set',
		reads: 'the empty set',
		example: `A ∩ A′ = ${value('A ∩ A′')}`,
		diagram: 'A ∩ A′ ∩ B',
		logic: 'always false (0)'
	},
	{
		id: 'universal',
		symbol: 'U\nξ',
		name: 'Universal set',
		reads: 'the universal set: everything under discussion',
		example: `U = ${roster(universe)}`,
		diagram: 'U ∪ B',
		logic: 'always true (1)'
	},
	{
		id: 'cardinality',
		symbol: '|A|\nn(A)',
		name: 'Cardinality',
		reads: 'the number of elements in A',
		example: `|A| = ${sets.A.size}, |A ∪ B| = ${evaluateOn(parseSet('A ∪ B'), sets, universe).size}`
	},
	{
		id: 'power-set',
		symbol: 'P(A)\n𝒫(A)',
		name: 'Power set',
		reads: 'the set of all subsets of A',
		example: `P({1, 2}) = ${powerOfSmall}`
	},
	{
		id: 'product',
		symbol: '×',
		name: 'Cartesian product',
		reads: 'A cross B: every ordered pair',
		example: `{1, 2} × {x, y} = {${product.join(', ')}}`
	},
	{
		id: 'roster',
		symbol: '{ , }',
		name: 'Roster notation',
		reads: 'the set containing',
		example: `A = ${roster(sets.A)}`
	},
	{
		id: 'set-builder',
		symbol: '{x : …}\n{x | …}',
		name: 'Set-builder notation',
		reads: 'the set of all x such that',
		example: `{x ∈ U : x is even} = ${roster(evens)}`
	},
	{
		id: 'equal',
		symbol: '=',
		name: 'Equal sets',
		reads: 'has exactly the same elements as',
		example: `{1, 2} = {2, 1} is true`,
		logic: 'x ∈ X ↔ x ∈ Y, for every x'
	}
];
