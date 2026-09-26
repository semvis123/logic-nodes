// The expression tree pages draw the parse of an expression and colour every
// node by its value. The shape must be the parse, the values must match the
// engines, and the layout must be tidy: no overlaps, parents centred, leaves
// in reading order. All of that is checked here.

import { expect, test } from '@playwright/test';
import { parseProp, evaluateProp, formatProp, propVariables } from '../src/lib/propositional.js';
import { parseExpression, evaluate, variablesOf } from '../src/lib/boolean.js';
import {
	treeFromProp,
	treeFromAst,
	withValues,
	layoutTree,
	treeVariables,
	type TreeNode
} from '../src/lib/exprTree.js';

const shape = (n: TreeNode): string => (n.children.length ? `${n.label}(${n.children.map(shape).join(',')})` : n.label);

const rowsOf = (letters: string[]) =>
	Array.from({ length: 1 << letters.length }, (_, i) =>
		Object.fromEntries(letters.map((v, j) => [v, !!(i & (1 << (letters.length - 1 - j)))]))
	);

const SAMPLES = [
	'p',
	'⊤',
	'¬¬p',
	'¬p ∨ q → r',
	'¬(p ∨ q) → r',
	'p → q → r',
	'(p → q) → r',
	'p ∧ q ∧ r ∨ s',
	'(p ⊕ q) ⊕ r',
	'¬(p ∧ q) ↔ ¬p ∨ ¬q',
	'(p ∧ q ∨ r) → (s ↔ ¬t ∧ u)',
	'(p ∨ ⊥) ∧ ¬(q ↔ p) ⊕ (r → ⊤)'
];

test.describe('expression trees', () => {
	test('the shape is the parse, with precedence and grouping', () => {
		expect(shape(treeFromProp(parseProp('¬p ∨ q → r')))).toBe('→(∨(¬(p),q),r)');
		expect(shape(treeFromProp(parseProp('¬(p ∨ q) → r')))).toBe('→(¬(∨(p,q)),r)');
		expect(shape(treeFromProp(parseProp('p → q → r')))).toBe('→(p,→(q,r))');
		expect(shape(treeFromProp(parseProp('p ∧ q ∧ r')))).toBe('∧(∧(p,q),r)');
		expect(shape(treeFromProp(parseProp('p ∨ q ∧ r')))).toBe('∨(p,∧(q,r))');
		expect(shape(treeFromProp(parseProp('p ↔ q → ⊥')))).toBe('↔(p,→(q,⊥))');
	});

	test('merging chains flattens only runs of the same ∧ or ∨', () => {
		const merged = (s: string) => shape(treeFromProp(parseProp(s), { flatten: true }));
		expect(merged('p ∧ q ∧ r')).toBe('∧(p,q,r)');
		expect(merged('p ∧ (q ∧ r) ∧ s')).toBe('∧(p,q,r,s)');
		expect(merged('p ∨ q ∧ r ∨ s')).toBe('∨(p,∧(q,r),s)');
		expect(merged('p → q → r')).toBe('→(p,→(q,r))');
		expect(merged('¬(p ∧ q) ∧ r')).toBe('∧(¬(∧(p,q)),r)');
	});

	test('each node carries its subexpression as text', () => {
		const tree = treeFromProp(parseProp('¬(p ∨ q) → r'));
		expect(tree.expr).toBe('¬(p ∨ q) → r');
		expect(tree.children[0].expr).toBe('¬(p ∨ q)');
		expect(tree.children[0].children[0].expr).toBe('p ∨ q');
		expect(tree.children[1].expr).toBe('r');
	});

	test('every node has the value of its own subexpression, in every row', () => {
		for (const sample of SAMPLES) {
			for (const flatten of [false, true]) {
				const tree = treeFromProp(parseProp(sample), { flatten });
				expect(treeVariables(tree)).toEqual(propVariables([parseProp(sample)]));
				for (const values of rowsOf(treeVariables(tree))) {
					const walk = (n: TreeNode) => {
						expect(n.value, `${n.expr} in ${sample}`).toBe(evaluateProp(parseProp(n.expr), values));
						n.children.forEach(walk);
					};
					walk(withValues(tree, values));
				}
			}
		}
	});

	test('→ and ↔ follow their definitions', () => {
		const at = (s: string, p: boolean, q: boolean) => withValues(treeFromProp(parseProp(s)), { p, q }).value;
		const bools = [true, false];
		for (const p of bools)
			for (const q of bools) {
				expect(at('p → q', p, q)).toBe(!(p && !q));
				expect(at('p ↔ q', p, q)).toBe(p === q);
			}
	});

	test('circuit expressions: labels follow the notation, values follow the engine', () => {
		const ast = parseExpression("a'b + c ^ d");
		expect(shape(treeFromAst(ast, 'math'))).toBe('∨(∧(¬(a),b),⊻(c,d))');
		expect(shape(treeFromAst(ast, 'engineering'))).toBe('+(·(′(a),b),⊻(c,d))');
		expect(shape(treeFromAst(ast, 'programming'))).toBe('||(&&(!(a),b),^(c,d))');
		expect(shape(treeFromAst(parseExpression('abc + 1'), 'math', { flatten: true }))).toBe('∨(∧(a,b,c),1)');
		for (const input of ['!(a & b) | (a & !b)', 'ab + bc + ac', 'a ^ b ^ c', '(a + 0)(b + 1)']) {
			const expr = parseExpression(input);
			for (const flatten of [false, true]) {
				const tree = treeFromAst(expr, 'math', { flatten });
				for (const values of rowsOf(variablesOf(expr))) {
					expect(withValues(tree, values).value, input).toBe(evaluate(expr, values));
				}
			}
		}
	});

	test('a missing letter is an error, not a silent false', () => {
		expect(() => withValues(treeFromProp(parseProp('p ∧ q')), { p: true })).toThrow();
	});

	test('the layout is tidy: leaves in reading order, parents centred, nothing overlaps', () => {
		for (const sample of SAMPLES) {
			for (const flatten of [false, true]) {
				const tree = treeFromProp(parseProp(sample), { flatten });
				const layout = layoutTree(tree);
				const { nodes, edges } = layout;

				// One node per tree node, one edge per non-root node, deterministic.
				expect(edges.length).toBe(nodes.length - 1);
				expect(layoutTree(tree)).toEqual(layout);
				expect(nodes[0].node).toBe(tree);
				expect(nodes[0].y).toBe(0);

				// Leaves are one unit apart, and read the letters in the order they are written.
				const leaves = nodes.filter((n) => !n.node.children.length).sort((a, b) => a.x - b.x);
				expect(leaves.map((l) => l.x)).toEqual(leaves.map((_, i) => i));
				expect(layout.width).toBe(leaves.length - 1);
				const written = formatProp(parseProp(sample)).replace(/[^a-zA-Z⊤⊥]/g, '');
				expect(leaves.map((l) => l.node.label).join(''), sample).toBe(written);

				for (const n of nodes) {
					const children = edges.filter((e) => e.from === n.id).map((e) => nodes[e.to]);
					expect(children.map((c) => c.node)).toEqual(n.node.children);
					for (const c of children) expect(c.y).toBe(n.y + 1);
					if (children.length) {
						// Centred over the first and last child, which are left to right.
						expect(n.x).toBe((children[0].x + children[children.length - 1].x) / 2);
						for (let i = 1; i < children.length; i++) expect(children[i].x).toBeGreaterThan(children[i - 1].x);
					}
					expect(n.y).toBeLessThanOrEqual(layout.height);
				}

				// No two nodes on the same level closer than half a unit.
				for (const a of nodes)
					for (const b of nodes) {
						if (a.id < b.id && a.y === b.y) expect(Math.abs(a.x - b.x), sample).toBeGreaterThanOrEqual(0.5);
					}
			}
		}
	});
});

test.describe('expression tree pages', () => {
	test('the generator ships a real tree and updates it with the row', async ({ page }) => {
		const html = await (await page.request.get('/expression-tree')).text();
		expect(html).toContain('<svg');
		expect(html).toContain('role="img"');

		await page.goto('/expression-tree');
		const tree = page.locator('.tree-box svg');
		await expect(tree).toHaveAttribute('aria-label', /whole expression is false/);
		// Row 0 is all true: p → q holds, q ∨ r holds, so ¬(q ∨ r) and the answer are false.
		await expect(tree.locator('g.node.on')).not.toHaveCount(0);
		await expect(page.locator('.answer strong')).toHaveText('false');

		// p = F, q = F, r = F is the last row, where the expression is true.
		await page.locator('table.rows tbody tr').last().click();
		await expect(page.locator('table.rows tbody tr').last()).toHaveClass(/selected/);
		await expect(page.locator('.answer strong')).toHaveText('true');
		await expect(tree).toHaveAttribute('aria-label', /whole expression is true/);
		await expect(page).toHaveURL(/row=7/);
	});

	test('the truth table generator draws the tree for the selected row', async ({ page }) => {
		const html = await (await page.request.get('/truth-table-generator')).text();
		expect(html).toMatch(/<svg[^>]*role="img"/);

		await page.goto('/truth-table-generator');
		const tree = page.locator('.tree-block svg').first();
		// Row 0 is a = b = c = 0: a & b is 0, !c is 1, so the output is 1.
		await expect(tree).toHaveAttribute('aria-label', /whole expression is 1/);
		await page.locator('table.result tbody tr').nth(1).click();
		await expect(tree).toHaveAttribute('aria-label', /whole expression is 0/);
		await expect(page.locator('table.result tbody tr').nth(1)).toHaveClass(/selected/);
	});

	test('the boolean algebra calculator ships the tree of its input', async ({ page }) => {
		const html = await (await page.request.get('/boolean-algebra-calculator')).text();
		expect(html).toMatch(/<details[^>]*class="[^"]*tree-details[\s\S]*?<svg[^>]*role="img"/);
		expect(html).toContain('/expression-tree?');
	});
});
