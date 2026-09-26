// The De Morgan, logic gate symbols and logic gates pages state identities,
// draw gates and print tables. Every claim is recomputed here from the
// expression and set engines, and the built pages are checked for the
// headings they are meant to rank for, FAQ markup that matches what is shown,
// and tables that stay inside a phone screen.

import { expect, test, type Page } from '@playwright/test';
import { parseExpression, equivalent, truthTable, simplify, variablesOf, type Ast } from '../src/lib/boolean.js';
import { parseSet, sameShading, toBoolean } from '../src/lib/venn.js';
import { value } from '../src/lib/setNotation.js';
import {
	demorganLaws,
	naryLaw,
	demorganNotations,
	overbarToPrime,
	overbarRuns,
	demorganGates,
	bubbledExpression,
	demorganProof,
	demorganWalkthrough,
	demorganMistakes
} from '../src/lib/demorgan.js';
import { overbarForms, iecLabels } from '../src/lib/symbolChart.js';
import { gates } from '../src/lib/gates.js';
import { shapes } from '../src/lib/symbols.js';

const same = (a: string, b: string) => equivalent(parseExpression(a), parseExpression(b));
const bits = (ast: Ast, variables = variablesOf(ast)) =>
	truthTable(ast, variables)
		.rows.map((r) => (r ? '1' : '0'))
		.join('');

test.describe("De Morgan's laws data", () => {
	test('both laws, and the n variable forms up to the engine limit, hold', () => {
		expect(same('¬(a ∧ b)', '¬a ∨ ¬b')).toBe(true);
		expect(same('¬(a ∨ b)', '¬a ∧ ¬b')).toBe(true);
		for (let n = 2; n <= 8; n++) {
			for (const op of ['and', 'or'] as const) {
				const law = naryLaw(n, op);
				expect(same(law.left, law.right), `${law.left} = ${law.right}`).toBe(true);
				expect(variablesOf(parseExpression(law.left))).toHaveLength(n);
			}
		}
		// The page shows the three and four variable forms.
		for (const id of ['and-3', 'or-3', 'and-4', 'or-4']) expect(demorganLaws.map((l) => l.id)).toContain(id);
		for (const law of demorganLaws) expect(same(law.left, law.right), law.id).toBe(true);
	});

	test('every notation states the same two laws', () => {
		// Read every row into the boolean engine, and compare it with the
		// laws in logic symbols, so a row cannot state some other identity.
		const read = (text: string, kind: string): Ast =>
			lowerCase(
				kind === 'set' ? toBoolean(parseSet(text)) : parseExpression(kind === 'overbar' ? overbarToPrime(text) : text)
			);
		const target = {
			first: ['¬(a ∧ b)', '¬a ∨ ¬b'],
			second: ['¬(a ∨ b)', '¬a ∧ ¬b']
		};
		for (const notation of demorganNotations) {
			for (const which of ['first', 'second'] as const) {
				const [left, right] = notation[which];
				expect(equivalent(read(left, notation.kind), parseExpression(target[which][0])), left).toBe(true);
				expect(equivalent(read(right, notation.kind), parseExpression(target[which][1])), right).toBe(true);
			}
			if (notation.kind === 'set') {
				expect(sameShading(parseSet(notation.first[0]), parseSet(notation.first[1]))).toBe(true);
				expect(sameShading(parseSet(notation.second[0]), parseSet(notation.second[1]))).toBe(true);
			}
		}
		// The overbar runs put the bar where the prime form puts the NOT.
		expect(overbarRuns('{A} + {B}')).toEqual([
			{ text: 'A', bar: true, group: false },
			{ text: ' + ', bar: false, group: false },
			{ text: 'B', bar: true, group: false }
		]);
		// A bar over several symbols is read as one negation, "not (A · B)",
		// never "not A · B", which is the mistake the laws warn about.
		expect(overbarRuns('{A · B}')).toEqual([{ text: 'A · B', bar: true, group: true }]);
	});

	test('the gate drawings compute the laws they illustrate', () => {
		for (const pair of demorganGates) {
			const law = demorganLaws.find((l) => l.id === pair.law)!;
			expect(same(bubbledExpression(pair.left), law.left), pair.left.name).toBe(true);
			expect(same(bubbledExpression(pair.right), law.right), pair.right.name).toBe(true);
			expect(pair.left.shape).not.toBe(pair.right.shape);
		}
		// NAND and NOR really are the gates the left hand drawings name.
		const nand = gates.find((g) => g.slug === 'nand')!;
		const nor = gates.find((g) => g.slug === 'nor')!;
		expect(same(bubbledExpression(demorganGates[0].left), nand.source)).toBe(true);
		expect(same(bubbledExpression(demorganGates[1].left), nor.source)).toBe(true);
	});

	test('the algebraic proof reaches its constants one valid step at a time', () => {
		for (const chain of demorganProof) {
			const start = parseExpression(chain.steps[0].expression);
			for (const step of chain.steps) {
				expect(equivalent(start, parseExpression(step.expression)), `${chain.id}: ${step.expression}`).toBe(true);
			}
			expect(chain.steps[chain.steps.length - 1].expression).toBe(chain.result);
			expect(new Set(truthTable(start).rows)).toEqual(new Set([chain.result === '1']));
		}
		// The two chains start from a ∧ b combined with ¬a ∨ ¬b, by OR and by AND.
		expect(same(demorganProof[0].steps[0].expression, '(a ∧ b) ∨ (¬a ∨ ¬b)')).toBe(true);
		expect(same(demorganProof[1].steps[0].expression, '(a ∧ b) ∧ (¬a ∨ ¬b)')).toBe(true);
	});

	test('the step by step example ends where the calculator does', () => {
		const start = parseExpression(demorganWalkthrough.steps[0].expression);
		for (const step of demorganWalkthrough.steps) {
			expect(equivalent(start, parseExpression(step.expression)), step.expression).toBe(true);
		}
		const last = demorganWalkthrough.steps[demorganWalkthrough.steps.length - 1].expression;
		expect(simplify(truthTable(start)).text).toBe(last);
		expect(demorganWalkthrough.title).toContain(demorganWalkthrough.steps[0].expression);
	});

	test('every mistake is wrong, and every correction is right', () => {
		for (const m of demorganMistakes) {
			expect(same(m.original, m.wrong), `${m.id}: ${m.wrong}`).toBe(false);
			expect(same(m.original, m.right), `${m.id}: ${m.right}`).toBe(true);
		}
		// The first is the one tabulated on the page: wrong on two of four rows.
		const [first] = demorganMistakes;
		const a = bits(parseExpression(first.original), ['a', 'b']);
		const b = bits(parseExpression(first.wrong), ['a', 'b']);
		expect([...a].filter((x, i) => x !== b[i])).toHaveLength(2);
	});

	test('the set example agrees with the laws', () => {
		expect(value('(A ∩ B)ᶜ')).toBe(value('Aᶜ ∪ Bᶜ'));
		expect(value('(A ∪ B)ᶜ')).toBe(value('Aᶜ ∩ Bᶜ'));
		expect(value('(A ∩ B)ᶜ')).not.toBe(value('Aᶜ ∩ Bᶜ'));
	});
});

// Renames every variable to lower case, so rows written with A and B compare
// against laws written with a and b.
function lowerCase(ast: Ast): Ast {
	switch (ast.t) {
		case 'var':
			return { t: 'var', name: ast.name.toLowerCase() };
		case 'const':
			return ast;
		case 'not':
			return { t: 'not', a: lowerCase(ast.a) };
		default:
			return { ...ast, a: lowerCase(ast.a), b: lowerCase(ast.b) };
	}
}

test.describe('logic gate symbols data', () => {
	test('every expression in the chart is the gate it sits beside', () => {
		for (const gate of gates) {
			expect(overbarForms[gate.slug], gate.slug).toBeDefined();
			expect(same(overbarToPrime(overbarForms[gate.slug]), gate.source), `${gate.slug} overbar`).toBe(true);
			expect(same(gate.symbol, gate.source), `${gate.slug} symbol`).toBe(true);
		}
	});

	test('every IEC label is the counting rule its gates obey', () => {
		for (const gate of gates) {
			const shape = shapes[gate.slug];
			const label = iecLabels.find((l) => l.label === shape.iec);
			expect(label, `${gate.slug}: ${shape.iec}`).toBeDefined();
			expect(label!.gates, gate.slug).toContain(gate.slug);
			const table = truthTable(parseExpression(gate.source));
			const n = table.variables.length;
			table.rows.forEach((out, row) => {
				const ones = row.toString(2).split('1').length - 1;
				const labelled = label!.rule(ones, n);
				expect(shape.iecBubble ? !labelled : labelled, `${gate.slug} row ${row}`).toBe(out);
			});
		}
		for (const label of iecLabels) {
			for (const slug of label.gates) expect(shapes[slug].iec, slug).toBe(label.label);
		}
	});

	test('the XNOR and three input XOR notes are true', () => {
		const rule = (label: string) => iecLabels.find((l) => l.label === label)!.rule;
		// "=" and a bubbled "=1" agree on two inputs.
		for (let ones = 0; ones <= 2; ones++) expect(rule('=')(ones, 2)).toBe(!rule('=1')(ones, 2));
		// With three inputs, "=1" and a chain of XORs differ only when all three are 1.
		const chain = truthTable(parseExpression('a ^ b ^ c')).rows;
		const differ = chain
			.map((out, row) => (out !== rule('=1')(row.toString(2).split('1').length - 1, 3) ? row : -1))
			.filter((row) => row >= 0);
		expect(differ).toEqual([7]);
	});
});

test.describe('logic gates hub data', () => {
	test('the basic gates build the others as the FAQ says', () => {
		expect(same('(a ∧ ¬b) ∨ (¬a ∧ b)', 'a ^ b')).toBe(true);
		expect(same('¬(a ∧ b)', gates.find((g) => g.slug === 'nand')!.source)).toBe(true);
		expect(same('¬(a ∨ b)', gates.find((g) => g.slug === 'nor')!.source)).toBe(true);
		expect(same('¬(a ⊻ b)', gates.find((g) => g.slug === 'xnor')!.source)).toBe(true);
	});
});

// --- the built pages ---------------------------------------------------------

const PAGES: Record<string, string[]> = {
	'/de-morgans-laws': [
		"De Morgan's laws",
		"De Morgan's first and second law",
		'The same laws in every notation',
		"Proof of De Morgan's theorem",
		"How to apply De Morgan's law step by step",
		"De Morgan's law for n variables",
		"De Morgan's law in logic gates",
		"De Morgan's law for sets",
		'Common mistakes'
	],
	'/logic-gate-symbols': [
		'Logic gate symbols',
		'The 7 logic gate symbols',
		'Logic gate symbols chart',
		'IEC symbols: what &, ≥1, =1 and 1 mean',
		'The bubble: what the circle on a gate means',
		'ANSI vs IEC logic gate symbols'
	],
	'/logic-gates': [
		'The 7 types of logic gates',
		'Types of logic gates',
		'Truth table of all 7 logic gates',
		'Logic gates chart',
		'Basic gates vs universal gates',
		'Universal gates: NAND and NOR'
	]
};

async function jsonLd(page: Page) {
	const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
	return blocks.map((text) => JSON.parse(text));
}

for (const [path, headings] of Object.entries(PAGES)) {
	test(`${path} has its headings, and FAQ markup that matches the page`, async ({ page }) => {
		await page.goto(path);
		const shown = (await page.locator('h1, h2, h3').allTextContents()).map((t) => t.trim());
		for (const heading of headings) expect(shown, heading).toContain(heading);

		const graph = (await jsonLd(page)).flatMap((block) => block['@graph'] ?? [block]);
		const webPage = graph.find((node) => [node['@type']].flat().includes('FAQPage'));
		expect(webPage, 'FAQPage').toBeDefined();
		const questions = webPage.mainEntity.map((q: { name: string }) => q.name);
		const summaries = (await page.locator('section.faq details summary').allTextContents()).map((t) => t.trim());
		expect(summaries).toEqual(questions);
		expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBe(true);

		// An image described in the structured data must be on the page.
		const html = await page.content();
		for (const image of graph.filter((node) => node['@type'] === 'ImageObject')) {
			expect(html).toContain(new URL(image.contentUrl).pathname);
		}
	});

	test(`${path} does not scroll sideways on a phone`, async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(path);
		// Open every proof so the widest tables are laid out too.
		await page.evaluate(() => document.querySelectorAll('details').forEach((d) => d.setAttribute('open', '')));
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});
}

test('the combined truth table on the hub matches every gate', async ({ page }) => {
	await page.goto('/logic-gates');
	const table = page.locator('#all-gates-truth-table');
	const headers = (await table.locator('thead th').allTextContents()).map((t) => t.trim());
	expect(headers).toEqual(['a', 'b', ...gates.map((g) => (g.slug === 'not' ? 'NOT a' : g.name))]);
	await expect(table.locator('tbody tr')).toHaveCount(4);
	for (let i = 0; i < 4; i++) {
		const row = table.locator('tbody tr').nth(i);
		const cells = (await row.locator('td').allTextContents()).map((t) => t.trim());
		expect(cells.slice(0, 2)).toEqual([(i >> 1) & 1, i & 1].map(String));
		gates.forEach((gate, g) => {
			const expected = truthTable(parseExpression(gate.source), ['a', 'b']).rows[i] ? '1' : '0';
			expect(cells[2 + g], `${gate.name} row ${i}`).toBe(expected);
		});
	}
});

test('the symbols chart prints each gate beside its own truth table', async ({ page }) => {
	await page.goto('/logic-gate-symbols');
	const rows = page.locator('#chart table.compare > tbody > tr');
	await expect(rows).toHaveCount(gates.length);
	for (const [i, gate] of gates.entries()) {
		const row = rows.nth(i);
		await expect(row.locator('th[scope="row"] a')).toHaveText(gate.name);
		const outputs = (await row.locator('table.mini td.q').allTextContents()).join('');
		expect(outputs, gate.name).toBe(bits(parseExpression(gate.source)));
	}
});

test('the De Morgan page shows the sets the engine computes', async ({ page }) => {
	await page.goto('/de-morgans-laws');
	const rows = page.locator('table.set-table tbody tr');
	const expressions = await page.locator('table.set-table tbody th').allTextContents();
	expect(expressions.length).toBeGreaterThan(0);
	for (const [i, expression] of expressions.entries()) {
		await expect(rows.nth(i).locator('td').last()).toHaveText(value(expression.trim()));
	}
});
