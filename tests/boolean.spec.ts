import { expect, test } from '@playwright/test';
import {
	parseExpression,
	truthTable,
	simplify,
	format,
	equivalent,
	variablesOf,
	evaluate,
	karnaughMap,
	karnaughMapFromCells,
	minimise,
	grayCode,
	canonicalForms,
	toGray,
	fromGray,
	toUniversal,
	countUniversalGates,
	formatUniversal,
	foldConstants,
	BooleanError,
	type Ast,
	type Notation
} from '../src/lib/boolean.js';
import { gates } from '../src/lib/gates.js';
import { laws } from '../src/lib/laws.js';
import { flipFlops } from '../src/lib/flipflops.js';
import { commonCircuits } from '../src/lib/commonCircuits.js';
import {
	makeQuestion,
	nextQuestion,
	questionSignature,
	topics,
	RECENT_LIMIT,
	MAX_QUIZ_GATES
} from '../src/lib/quiz.js';
import { circuitToSvg, truthTableToSvg, THEMES } from '../src/lib/exportSvg.js';
import { slugifyExpression } from '../src/lib/download.js';
import { buildCircuit, circuitStates, CircuitTooLarge, MAX_CIRCUIT_GATES } from '../src/lib/circuit.js';

const NOTATIONS: Notation[] = ['math', 'engineering', 'programming'];
const bits = (src: string) =>
	truthTable(parseExpression(src))
		.rows.map((r) => (r ? '1' : '0'))
		.join('');

// A deterministic generator, so a failure is always reproducible.
let seed = 20260907;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const randomAst = (depth: number, pool: string[]): Ast => {
	if (depth <= 0 || rnd() < 0.28) {
		if (rnd() < 0.07) return { t: 'const', v: rnd() < 0.5 };
		return { t: 'var', name: pool[Math.floor(rnd() * pool.length)] };
	}
	if (rnd() < 0.22) return { t: 'not', a: randomAst(depth - 1, pool) };
	const r = rnd();
	const kind = r < 0.45 ? 'and' : r < 0.78 ? 'or' : 'xor';
	return { t: kind, a: randomAst(depth - 1, pool), b: randomAst(depth - 1, pool) } as Ast;
};
const randomCases = (count: number) => {
	const out: { ast: Ast; table: ReturnType<typeof truthTable> }[] = [];
	const vars = ['a', 'b', 'c', 'd', 'e'];
	while (out.length < count) {
		const pool = vars.slice(0, 2 + Math.floor(rnd() * 4));
		const ast = randomAst(3 + Math.floor(rnd() * 2), pool);
		if (!variablesOf(ast).length) continue;
		out.push({ ast, table: truthTable(ast) });
	}
	return out;
};

test.describe('boolean expression engine', () => {
	test('parses each gate to its textbook truth table', () => {
		expect(bits('a & b')).toBe('0001');
		expect(bits('a | b')).toBe('0111');
		expect(bits('!a')).toBe('10');
		expect(bits('a ^ b')).toBe('0110');
		expect(bits('!(a & b)')).toBe('1110');
		expect(bits('!(a | b)')).toBe('1000');
	});

	test('accepts every notation for the same function', () => {
		for (const src of ['a & b', 'a . b', 'a ∧ b', 'a AND b', 'ab', 'a * b']) {
			expect(bits(src)).toBe('0001');
		}
		for (const src of ['a | b', 'a + b', 'a ∨ b', 'a OR b']) expect(bits(src)).toBe('0111');
		for (const src of ['!a', '~a', '¬a', "a'", 'a’', 'NOT a']) expect(bits(src)).toBe('10');
	});

	test('honours precedence and implicit AND', () => {
		expect(bits('a + bc')).toBe('00011111'); // a | (b & c)
		expect(bits('(a+b)c')).toBe('00010101');
		expect(bits("a'b")).toBe('0100');
	});

	test('rejects malformed input', () => {
		for (const bad of ['', '(a', 'a)', 'a &', '& a', 'a $ b']) {
			expect(() => parseExpression(bad)).toThrow(BooleanError);
		}
		expect(() => truthTable(parseExpression('abcdefghi'))).toThrow(BooleanError);
		expect(truthTable(parseExpression('abcdefgh')).rows.length).toBe(256);
	});

	test('simplifies to something with an identical truth table', () => {
		for (const { table } of randomCases(600)) {
			for (const notation of NOTATIONS) {
				const result = simplify(table, notation);
				const back = truthTable(parseExpression(result.text), table.variables);
				expect(back.rows, `simplify/${notation} changed the function`).toEqual(table.rows);
			}
		}
	});

	test('format round-trips in every notation', () => {
		for (const { ast, table } of randomCases(400)) {
			for (const notation of NOTATIONS) {
				const back = truthTable(parseExpression(format(ast, notation)), table.variables);
				expect(back.rows, `format/${notation} changed the function`).toEqual(table.rows);
			}
		}
	});

	test('juxtaposition never accidentally spells an operator', () => {
		// Engineering notation writes AND by running the letters together, so
		// variables named o and r would print as "or" and read back as an OR.
		const traps = ['o & r', 'n & o & t', 'x & o & r', 'a & n & d', 't & r & u & e', 'f & a & l & s & e'];
		for (const source of traps) {
			const ast = parseExpression(source);
			const table = truthTable(ast);
			for (const notation of NOTATIONS) {
				const text = format(ast, notation);
				const back = truthTable(parseExpression(text), table.variables);
				expect(back.rows, `${source} printed as "${text}" in ${notation}`).toEqual(table.rows);
			}
			// And the same trap reached through the simplifier.
			for (const notation of NOTATIONS) {
				const text = simplify(table, notation).text;
				const back = truthTable(parseExpression(text), table.variables);
				expect(back.rows, `${source} simplified to "${text}" in ${notation}`).toEqual(table.rows);
			}
		}
	});

	test('engineering notation writes AND as juxtaposition', () => {
		expect(format(parseExpression('a & b'), 'engineering')).toBe('ab');
		expect(format(parseExpression('a & !b | c'), 'engineering')).toBe("ab' + c");
		// The one case that has to break the run does so with an explicit dot.
		expect(format(parseExpression('o & r'), 'engineering')).toBe('o·r');
	});

	test('never returns more terms than there are minterms', () => {
		for (const { table } of randomCases(300)) {
			const trueRows = table.rows.filter(Boolean).length;
			if (trueRows === 0 || trueRows === table.rows.length) continue;
			expect(simplify(table, 'math').termCount).toBeLessThanOrEqual(trueRows);
		}
	});

	test('recognises the boolean algebra laws', () => {
		const laws: [string, string][] = [
			['a & 1', 'a'],
			['a | 0', 'a'],
			['a & 0', '0'],
			['a | 1', '1'],
			['a & a', 'a'],
			['a | a', 'a'],
			['a & !a', '0'],
			['a | !a', '1'],
			['!(!a)', 'a'],
			['a & b', 'b & a'],
			['(a & b) & c', 'a & (b & c)'],
			['a & (b | c)', '(a & b) | (a & c)'],
			['a | (a & b)', 'a'],
			['!(a & b)', '!a | !b'],
			['!(a | b)', '!a & !b']
		];
		for (const [left, right] of laws) {
			expect(equivalent(parseExpression(left), parseExpression(right)), `${left} = ${right}`).toBe(true);
		}
		// and does not accept a false one
		expect(equivalent(parseExpression('!(a & b)'), parseExpression('!a & !b'))).toBe(false);
	});
});

test.describe('karnaugh maps', () => {
	test('gray code changes exactly one bit per step', () => {
		for (let n = 1; n <= 4; n++) {
			const g = grayCode(n);
			expect(new Set(g).size).toBe(1 << n);
			for (let i = 1; i < g.length; i++) {
				const diff = g[i] ^ g[i - 1];
				expect(diff && (diff & (diff - 1)) === 0).toBe(true);
			}
		}
	});

	test('lays out every minterm once, with adjacent cells one bit apart', () => {
		for (const { table } of randomCases(250)) {
			if (table.variables.length < 2) continue;
			const map = karnaughMap(table, 'math');
			const flat = map.indices.flat();
			expect(flat.length).toBe(table.rows.length);
			expect(new Set(flat).size).toBe(flat.length);
			map.indices.forEach((row, r) => {
				row.forEach((index, c) => {
					expect(map.cells[r][c]).toBe(table.rows[index]);
					if (c > 0) {
						const d = index ^ row[c - 1];
						expect(d && (d & (d - 1)) === 0).toBe(true);
					}
					if (r > 0) {
						const d = index ^ map.indices[r - 1][c];
						expect(d && (d & (d - 1)) === 0).toBe(true);
					}
				});
			});
		}
	});

	test('groups are powers of two, cover exactly the 1s, and rebuild the function', () => {
		for (const { table } of randomCases(250)) {
			if (table.variables.length < 2) continue;
			const map = karnaughMap(table, 'math');
			const ones = new Set<string>();
			map.cells.forEach((row, r) => row.forEach((v, c) => v && ones.add(`${r},${c}`)));
			const grouped = new Set<string>();
			for (const group of map.groups) {
				expect(group.size & (group.size - 1)).toBe(0);
				expect(group.cells.length).toBe(group.size);
				for (const cell of group.cells) {
					expect(ones.has(cell)).toBe(true);
					grouped.add(cell);
				}
			}
			expect(grouped.size).toBe(ones.size);
			if (map.groups.length) {
				const expr = map.groups.map((g) => `(${g.term})`).join(' ∨ ');
				expect(truthTable(parseExpression(expr), table.variables).rows).toEqual(table.rows);
			}
		}
	});

	test('an all-ones map is a single group', () => {
		const map = karnaughMap(truthTable(parseExpression('a | !a | b')), 'math');
		expect(map.groups.length).toBe(1);
		expect(map.groups[0].term).toBe('1');
	});
});

test.describe('published gate reference', () => {
	test('every equivalence on the gate pages actually holds', () => {
		for (const gate of gates) {
			for (const eq of gate.equivalences) {
				expect(
					equivalent(parseExpression(eq.expression), parseExpression(eq.equals)),
					`${gate.name}: ${eq.label} — ${eq.expression} should equal ${eq.equals}`
				).toBe(true);
			}
		}
	});

	test('each gate has the arity and content its page claims', () => {
		for (const gate of gates) {
			const table = truthTable(parseExpression(gate.source));
			expect(table.variables.length).toBe(gate.inputs === 1 ? 1 : 2);
			expect(gate.uses.length).toBeGreaterThanOrEqual(3);
			expect(gate.faqs.length).toBeGreaterThanOrEqual(2);
			expect(gate.outputHigh.length).toBeGreaterThan(0);
		}
		expect(new Set(gates.map((g) => g.slug)).size).toBe(gates.length);
	});
});

test.describe('canonical forms', () => {
	test('minterms and maxterms partition the table', () => {
		for (const { table } of randomCases(250)) {
			const forms = canonicalForms(table, 'math');
			expect(forms.minterms.length + forms.maxterms.length).toBe(table.rows.length);
			expect(new Set([...forms.minterms, ...forms.maxterms]).size).toBe(table.rows.length);
			for (const m of forms.minterms) expect(table.rows[m]).toBe(true);
			for (const m of forms.maxterms) expect(table.rows[m]).toBe(false);
		}
	});

	test('all four forms describe the same function', () => {
		for (const { table } of randomCases(300)) {
			for (const notation of NOTATIONS) {
				const forms = canonicalForms(table, notation);
				for (const [name, expr] of [
					['canonicalSop', forms.canonicalSop],
					['canonicalPos', forms.canonicalPos],
					['minimalSop', forms.minimalSop],
					['minimalPos', forms.minimalPos]
				] as const) {
					const back = truthTable(parseExpression(expr), table.variables);
					expect(back.rows, `${name}/${notation}: ${expr}`).toEqual(table.rows);
				}
			}
		}
	});

	test('writes the standard sigma and pi notation', () => {
		const forms = canonicalForms(truthTable(parseExpression('a & b')), 'math');
		expect(forms.sigma).toBe('Σm(3)');
		expect(forms.pi).toBe('ΠM(0, 1, 2)');
		expect(forms.canonicalSop).toBe('(a ∧ b)');
		expect(forms.canonicalPos).toBe('(a ∨ b) ∧ (a ∨ ¬b) ∧ (¬a ∨ b)');
	});

	test('handles constant functions', () => {
		const never = canonicalForms(truthTable(parseExpression('a & !a')), 'math');
		expect(never.canonicalSop).toBe('0');
		expect(never.minimalSop).toBe('0');
		expect(never.minimalPos).toBe('0');
		const always = canonicalForms(truthTable(parseExpression('a | !a')), 'math');
		expect(always.canonicalPos).toBe('1');
		expect(always.minimalPos).toBe('1');
	});
});

test.describe('gray code', () => {
	test('round-trips and matches the sequence', () => {
		for (let n = 0; n < 512; n++) expect(fromGray(toGray(n))).toBe(n);
		expect(grayCode(3).map(toGray).length).toBe(8);
		expect(grayCode(3)).toEqual([0, 1, 3, 2, 6, 7, 5, 4]);
		for (let n = 1; n < 256; n++) {
			const d = toGray(n) ^ toGray(n - 1);
			expect(d && (d & (d - 1)) === 0).toBe(true);
		}
	});
});

test.describe('universal gate conversion', () => {
	test('constant folding preserves the function', () => {
		for (const { ast, table } of randomCases(300)) {
			const folded = foldConstants(ast);
			expect(truthTable(folded, table.variables).rows).toEqual(table.rows);
		}
	});

	test('NAND-only and NOR-only versions compute the same thing', () => {
		for (const { ast, table } of randomCases(400)) {
			for (const kind of ['nand', 'nor'] as const) {
				const converted = toUniversal(ast, kind);
				expect(truthTable(converted, table.variables).rows, kind).toEqual(table.rows);
			}
		}
	});

	test('the converted expression really only uses that one gate', () => {
		const onlyKind = (n: Ast, kind: 'and' | 'or'): boolean => {
			if (n.t === 'var' || n.t === 'const') return true;
			if (n.t === 'not' && n.a.t === kind) return onlyKind(n.a.a, kind) && onlyKind(n.a.b, kind);
			return false;
		};
		for (const { ast } of randomCases(300)) {
			expect(onlyKind(toUniversal(ast, 'nand'), 'and')).toBe(true);
			expect(onlyKind(toUniversal(ast, 'nor'), 'or')).toBe(true);
		}
	});

	test('uses the textbook gate counts', () => {
		const count = (src: string, kind: 'nand' | 'nor') => countUniversalGates(toUniversal(parseExpression(src), kind));
		expect(count('!a', 'nand')).toBe(1);
		expect(count('a & b', 'nand')).toBe(2);
		expect(count('a | b', 'nand')).toBe(3);
		expect(count('a ^ b', 'nand')).toBe(4);
		expect(count('!a', 'nor')).toBe(1);
		expect(count('a | b', 'nor')).toBe(2);
		expect(count('a & b', 'nor')).toBe(3);
		expect(count('a ^ b', 'nor')).toBe(5);
	});

	test('prints nested gate calls', () => {
		expect(formatUniversal(toUniversal(parseExpression('!a'), 'nand'), 'nand')).toBe('NAND(a, a)');
		expect(formatUniversal(toUniversal(parseExpression('a & b'), 'nand'), 'nand')).toBe('NAND(NAND(a, b), NAND(a, b))');
		expect(formatUniversal(toUniversal(parseExpression('a | b'), 'nor'), 'nor')).toBe('NOR(NOR(a, b), NOR(a, b))');
	});
});

test.describe('published boolean algebra laws', () => {
	test('every law holds across its full truth table', () => {
		for (const law of laws) {
			expect(
				equivalent(parseExpression(law.left), parseExpression(law.right)),
				`${law.category} / ${law.name}: ${law.left} = ${law.right}`
			).toBe(true);
		}
	});

	test('each law is stated, categorised and explained', () => {
		for (const law of laws) {
			expect(law.name.length, law.left).toBeGreaterThan(0);
			expect(law.note.length, law.left).toBeGreaterThan(20);
			expect(law.left).not.toBe(law.right);
		}
		expect(laws.length).toBeGreaterThanOrEqual(25);
	});
});

test.describe("karnaugh maps with don't cares", () => {
	const cellsOf = (n: number, ones: number[], dashes: number[] = []) =>
		Array.from({ length: 1 << n }, (_, i) => (ones.includes(i) ? 1 : dashes.includes(i) ? 'x' : 0)) as ('x' | 0 | 1)[];

	test("a don't care is used only when it helps", () => {
		// f = m(0, 2) over two variables is ¬b; adding m1 as a don't care lets the
		// group grow to the whole map.
		const without = karnaughMapFromCells(['a', 'b'], cellsOf(2, [0, 2]), 'math');
		expect(without.text).toBe('¬b');
		const withDontCare = karnaughMapFromCells(['a', 'b'], cellsOf(2, [0, 2], [1, 3]), 'math');
		expect(withDontCare.text).toBe('1');
	});

	test("don't cares never have to be covered", () => {
		// Only m5 is required; every other square is a don't care. One term is enough.
		const map = karnaughMapFromCells(['a', 'b', 'c'], cellsOf(3, [5], [0, 1, 2, 3, 4, 6, 7]), 'math');
		expect(map.termCount).toBe(1);
		expect(truthTableAgrees(map, ['a', 'b', 'c'], cellsOf(3, [5], [0, 1, 2, 3, 4, 6, 7]))).toBe(true);
	});

	test('the result still matches on every required row', () => {
		for (const { table } of randomCases(250)) {
			if (table.variables.length < 2) continue;
			// Turn a third of the rows into don't cares, deterministically.
			const values = table.rows.map((v, i) => (i % 3 === 0 ? ('x' as const) : ((v ? 1 : 0) as 0 | 1)));
			const map = karnaughMapFromCells(table.variables, values, 'math');
			expect(truthTableAgrees(map, table.variables, values)).toBe(true);
			// Every group must sit entirely on 1s and don't cares, never on a 0.
			for (const group of map.groups) {
				expect(group.size & (group.size - 1)).toBe(0);
				for (const cell of group.cells) {
					const [r, c] = cell.split(',').map(Number);
					expect(map.values[r][c], `group ${group.term} covers a 0`).not.toBe(0);
				}
			}
			// And every required 1 must be inside some group.
			const covered = new Set(map.groups.flatMap((g) => g.cells));
			map.values.forEach((row, r) =>
				row.forEach((value, c) => {
					if (value === 1) expect(covered.has(`${r},${c}`), 'uncovered 1').toBe(true);
				})
			);
		}
	});

	test('no required minterms means the function is 0', () => {
		const map = karnaughMapFromCells(['a', 'b'], cellsOf(2, [], [0, 1, 2, 3]), 'math');
		expect(map.text).toBe('0');
		expect(map.groups.length).toBe(0);
	});

	test("minimise ignores uncovered don't cares", () => {
		expect(minimise([], [0, 1, 2, 3], 2).length).toBe(0);
		expect(minimise([3], [], 2).length).toBe(1);
	});

	// The simplified expression must agree with the map on every required row,
	// and is free to do anything on the don't cares.
	function truthTableAgrees(
		map: ReturnType<typeof karnaughMapFromCells>,
		variables: string[],
		values: ('x' | 0 | 1)[]
	) {
		const result = truthTable(parseExpression(map.text), variables);
		return values.every((value, i) => value === 'x' || result.rows[i] === (value === 1));
	}
});

test.describe('the published BCD comparison', () => {
	// The don't cares section quotes both expressions and their literal counts;
	// this keeps that table honest.
	const BCD_GE_5 = '!ab!cd + !abc!d + !abcd + a!b!c!d + a!b!cd';
	const UNUSED = [10, 11, 12, 13, 14, 15];
	const literals = (text: string) => (text.match(/[a-z]/g) ?? []).length;

	test('marking the unused codes really does shrink it', () => {
		const table = truthTable(parseExpression(BCD_GE_5));
		expect(table.variables).toEqual(['a', 'b', 'c', 'd']);
		// The function is exactly the digits 5 to 9.
		expect(table.rows.map((r, i) => (r ? i : -1)).filter((i) => i >= 0)).toEqual([5, 6, 7, 8, 9]);

		const forced = karnaughMapFromCells(table.variables, table.rows.map((v) => (v ? 1 : 0)) as (0 | 1)[], 'math');
		const marked = karnaughMapFromCells(
			table.variables,
			table.rows.map((v, i) => (UNUSED.includes(i) ? 'x' : v ? 1 : 0)) as ('x' | 0 | 1)[],
			'math'
		);

		expect(forced.text).toBe('¬a ∧ b ∧ d ∨ ¬a ∧ b ∧ c ∨ a ∧ ¬b ∧ ¬c');
		expect(marked.text).toBe('a ∨ b ∧ d ∨ b ∧ c');
		expect(literals(forced.text)).toBe(9);
		expect(literals(marked.text)).toBe(5);

		// Both must agree on every code that can actually occur.
		const forcedRows = truthTable(parseExpression(forced.text), table.variables).rows;
		const markedRows = truthTable(parseExpression(marked.text), table.variables).rows;
		for (let i = 0; i < 10; i++) {
			expect(forcedRows[i], `row ${i}`).toBe(table.rows[i]);
			expect(markedRows[i], `row ${i}`).toBe(table.rows[i]);
		}
	});
});

test.describe('flip-flop reference', () => {
	test('each characteristic equation reproduces its table', () => {
		for (const ff of flipFlops) {
			const ast = parseExpression(ff.equation);
			const variables = [...ff.inputs, 'q'];
			for (const row of ff.characteristic) {
				if (row.next === 'invalid') continue; // undefined by definition
				const values: Record<string, boolean> = { q: row.q === '1' };
				ff.inputs.forEach((name, i) => (values[name] = row.inputs[i] === '1'));
				const got = evaluate(ast, values);
				expect(got, `${ff.shortName}: ${ff.inputs.join('')}=${row.inputs.join('')} q=${row.q}`).toBe(row.next === '1');
			}
			// The equation must not mention anything outside its declared pins.
			expect(new Set(variablesOf(ast))).toEqual(new Set(variables.filter((v) => ff.equation.includes(v))));
		}
	});

	test('each excitation table agrees with the characteristic equation', () => {
		for (const ff of flipFlops) {
			const ast = parseExpression(ff.equation);
			for (const row of ff.excitation) {
				// A don't care must work for both values, so try every expansion.
				const options: boolean[][] = [[]];
				for (const bit of row.inputs) {
					const next: boolean[][] = [];
					for (const partial of options) {
						if (bit === 'X') next.push([...partial, false], [...partial, true]);
						else next.push([...partial, bit === '1']);
					}
					options.length = 0;
					options.push(...next);
				}
				for (const combo of options) {
					const values: Record<string, boolean> = { q: row.from === '1' };
					ff.inputs.forEach((name, i) => (values[name] = combo[i]));
					// Skip the SR combination the datasheet forbids.
					if (ff.slug === 'sr' && combo[0] && combo[1]) continue;
					expect(
						evaluate(ast, values),
						`${ff.shortName}: ${row.from}->${row.to} with ${ff.inputs.join('')}=${combo.map(Number).join('')}`
					).toBe(row.to === '1');
				}
			}
		}
	});

	test('tables are complete and the content is filled in', () => {
		for (const ff of flipFlops) {
			expect(ff.characteristic.length).toBe(2 ** (ff.inputs.length + 1));
			expect(ff.excitation.length).toBe(4);
			expect(ff.excitation.map((e) => `${e.from}${e.to}`).sort()).toEqual(['00', '01', '10', '11']);
			for (const row of ff.excitation) expect(row.inputs.length).toBe(ff.inputs.length);
			expect(ff.uses.length).toBeGreaterThanOrEqual(3);
			expect(ff.faqs.length).toBeGreaterThanOrEqual(2);
			expect(ff.buildFrom.length).toBeGreaterThan(40);
		}
		expect(new Set(flipFlops.map((f) => f.slug)).size).toBe(flipFlops.length);
	});
});

test.describe('circuit diagram layout', () => {
	test('the drawn circuit computes the same function as the expression', () => {
		for (const { ast, table } of randomCases(200)) {
			const circuit = buildCircuit(ast);
			for (let row = 0; row < table.rows.length; row++) {
				const values: Record<string, boolean> = {};
				table.variables.forEach((name, bit) => {
					values[name] = !!(row & (1 << (table.variables.length - 1 - bit)));
				});
				const states = circuitStates(circuit, values);
				expect(states[circuit.rootId], `row ${row}`).toBe(table.rows[row]);
			}
		}
	});

	test('every wire connects two real nodes and every gate has its pins', () => {
		for (const { ast } of randomCases(150)) {
			const circuit = buildCircuit(ast);
			const ids = new Set(circuit.nodes.map((n) => n.id));
			for (const wire of circuit.wires) {
				expect(ids.has(wire.from)).toBe(true);
				expect(wire.to === 'output' || ids.has(wire.to)).toBe(true);
				expect(wire.path).not.toContain('NaN');
			}
			for (const node of circuit.nodes) {
				expect(node.inputPorts.length).toBe(node.children.length);
				if (node.kind === 'gate') {
					expect(node.children.length).toBe(node.op === 'not' ? 1 : 2);
				} else {
					expect(node.children.length).toBe(0);
				}
				// Nothing may be positioned outside the reported canvas.
				expect(node.x).toBeGreaterThanOrEqual(0);
				expect(node.y).toBeGreaterThanOrEqual(0);
				expect(node.x + node.width).toBeLessThanOrEqual(circuit.width);
				expect(node.y + node.height).toBeLessThanOrEqual(circuit.height);
			}
			expect(circuit.output.x + circuit.output.width).toBeLessThanOrEqual(circuit.width);
		}
	});

	test('a gate feeding two places is drawn once', () => {
		// (a & b) appears twice but is one gate, plus the OR: three in total.
		const circuit = buildCircuit(parseExpression('((a & b) | c) & ((a & b) | d)'));
		const ands = circuit.nodes.filter((n) => n.op === 'and');
		expect(
			circuit.nodes
				.filter((n) => n.kind === 'input')
				.map((n) => n.label)
				.sort()
		).toEqual(['a', 'b', 'c', 'd']);
		// One shared AND for a&b, two ORs, and the final AND.
		expect(ands.length).toBe(2);
		expect(circuit.gateCount).toBe(4);
	});

	test('no wire is routed across a gate body', () => {
		// Exact segment/rectangle overlap (Liang-Barsky), rather than sampling.
		const crosses = (
			a: { x: number; y: number },
			b: { x: number; y: number },
			box: { x: number; y: number; width: number; height: number }
		) => {
			const pad = 0.5; // touching an edge is fine; passing through is not
			const [xmin, xmax] = [box.x + pad, box.x + box.width - pad];
			const [ymin, ymax] = [box.y + pad, box.y + box.height - pad];
			let t0 = 0;
			let t1 = 1;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			for (const [p, q] of [
				[-dx, a.x - xmin],
				[dx, xmax - a.x],
				[-dy, a.y - ymin],
				[dy, ymax - a.y]
			]) {
				if (p === 0) {
					if (q < 0) return false; // parallel and outside
					continue;
				}
				const r = q / p;
				if (p < 0) {
					if (r > t1) return false;
					if (r > t0) t0 = r;
				} else {
					if (r < t0) return false;
					if (r < t1) t1 = r;
				}
			}
			return t1 > t0;
		};

		const violations: string[] = [];
		for (const { ast } of randomCases(120)) {
			const circuit = buildCircuit(ast);
			const boxes = circuit.nodes.filter((n) => n.kind === 'gate');
			for (const wire of circuit.wires) {
				for (let i = 1; i < wire.points.length; i++) {
					for (const box of boxes) {
						// A wire may touch the gate it leaves or the one it arrives at.
						if (box.id === wire.from || box.id === wire.to) continue;
						if (crosses(wire.points[i - 1], wire.points[i], box)) {
							violations.push(`${wire.from} -> ${wire.to} crosses ${box.label}`);
						}
					}
				}
			}
		}
		expect(violations.slice(0, 5)).toEqual([]);
	});

	test('gates sit strictly to the right of everything feeding them', () => {
		for (const { ast } of randomCases(120)) {
			const circuit = buildCircuit(ast);
			const byId = new Map(circuit.nodes.map((n) => [n.id, n]));
			for (const node of circuit.nodes) {
				for (const childId of node.children) {
					expect(byId.get(childId)!.x, `${node.label} <- ${byId.get(childId)!.label}`).toBeLessThan(node.x);
				}
			}
		}
	});

	test('refuses to draw something absurd', () => {
		// Every pair of eight variables ANDed, ORed together: 28 ANDs and 27 ORs.
		const vars = 'abcdefgh'.split('');
		const terms: string[] = [];
		for (let i = 0; i < vars.length; i++) {
			for (let j = i + 1; j < vars.length; j++) terms.push(`${vars[i]}${vars[j]}`);
		}
		const huge = terms.join(' + ');
		expect(() => buildCircuit(parseExpression(huge))).toThrow(CircuitTooLarge);
		// And something merely large still draws.
		expect(buildCircuit(parseExpression('ab + cd + ef')).gateCount).toBeLessThan(MAX_CIRCUIT_GATES);
	});
});

test.describe('practice questions', () => {
	test('every generated question has exactly one correct answer', () => {
		const kinds = new Set<string>();
		for (let seed = 1; seed <= 600; seed++) {
			const q = makeQuestion(seed);
			kinds.add(q.kind);
			expect(q.options.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
			expect(q.answer, `seed ${seed}`).toBeGreaterThanOrEqual(0);
			expect(q.answer, `seed ${seed}`).toBeLessThan(q.options.length);
			expect(new Set(q.options).size, `seed ${seed}: duplicate options`).toBe(q.options.length);
			expect(q.prompt.length).toBeGreaterThan(10);
			expect(q.explanation.length).toBeGreaterThan(10);

			// Grade the marked answer with the engine rather than trusting it.
			if (q.kind === 'equivalent') {
				const source = parseExpression(q.detail!);
				q.options.forEach((option, i) => {
					const same = equivalent(parseExpression(option), source);
					expect(same, `seed ${seed}: option "${option}" should ${i === q.answer ? '' : 'not '}match`).toBe(
						i === q.answer
					);
				});
			}
			if (q.kind === 'evaluate') {
				const match = q.prompt.match(/when (.+)\?/);
				const values: Record<string, boolean> = {};
				for (const part of match![1].split(', ')) {
					const [name, value] = part.split(' = ');
					values[name] = value === '1';
				}
				const expected = evaluate(parseExpression(q.detail!), values);
				expect(q.options[q.answer], `seed ${seed}`).toBe(expected ? '1' : '0');
			}
			if (q.kind === 'circuit-expression') {
				// Exactly the marked option may match the drawn circuit.
				const answer = parseExpression(q.options[q.answer]);
				q.options.forEach((option, i) => {
					if (i === q.answer) return;
					expect(equivalent(parseExpression(option), answer), `seed ${seed}: "${option}" is also correct`).toBe(false);
				});
				expect(q.svg, `seed ${seed}`).toContain('<svg');
				expect(q.svgAlt!.length).toBeGreaterThan(10);
				// The diagram must carry no caption, which is where the expression
				// would otherwise be printed and give the answer away.
				expect(q.svg, `seed ${seed}: diagram is captioned`).not.toContain('font-size="14"');
				expect(q.svg).toContain('>Q</text>');
			}
			if (q.kind === 'circuit-output') {
				const match = q.prompt.match(/when (.+)\?/);
				const values: Record<string, boolean> = {};
				for (const part of match![1].split(', ')) {
					const [name, value] = part.split(' = ');
					values[name] = value === '1';
				}
				expect(q.svg, `seed ${seed}`).toContain('<svg');
				// The drawing must not show live values, or the answer is given away.
				expect(q.svg).toContain('>Q</text>');
				expect(['0', '1']).toContain(q.options[q.answer]);
				void values;
			}
			if (q.kind === 'count-ones') {
				const count = truthTable(parseExpression(q.detail!)).rows.filter(Boolean).length;
				expect(q.options[q.answer], `seed ${seed}`).toBe(String(count));
			}
			if (q.kind === 'identify-gate') {
				const named = gates.find((g) => g.name === q.options[q.answer])!;
				const expected = truthTable(parseExpression(named.source));
				expect(q.table!.rows, `seed ${seed}`).toEqual(expected.rows);
				// and no other option matches that table
				for (const option of q.options) {
					if (option === named.name) continue;
					const other = gates.find((g) => g.name === option)!;
					expect(truthTable(parseExpression(other.source)).rows).not.toEqual(q.table!.rows);
				}
			}
			if (q.kind === 'gate-output') {
				expect(q.prompt, `seed ${seed}: article`).not.toMatch(/\ba (AND|OR|XOR) gate\b/);
				const bits = [...q.prompt.matchAll(/\b([01])\b/g)].map((m) => m[1] === '1');
				const named = gates.find((g) => new RegExp(`\\ban? ${g.name} gate\\b`).test(q.prompt))!;
				const table = truthTable(parseExpression(named.source));
				const values: Record<string, boolean> = {};
				table.variables.forEach((name, i) => (values[name] = bits[i]));
				expect(q.options[q.answer], `seed ${seed}: ${q.prompt}`).toBe(
					evaluate(parseExpression(named.source), values) ? '1' : '0'
				);
			}
		}
		// The mix should exercise every generator.
		expect(kinds.size).toBe(7);
	});

	test('questions never show a dead sub-expression', () => {
		// Things like "a ∨ a", "b ⊻ b" or "¬a ∧ a" are valid but read as noise,
		// and as wrong answers they can be dismissed without any understanding.
		const constantSub = (text: string) => {
			const ast = parseExpression(text);
			const dead = (node: typeof ast): boolean => {
				if (node.t === 'var') return false;
				if (node.t === 'const') return true;
				if (node.t === 'not') return dead(node.a);
				for (const half of [node.a, node.b]) {
					const names = variablesOf(half);
					if (!names.length) return true;
					const rows = truthTable(half, names).rows;
					if (rows.every((v) => v === rows[0])) return true;
				}
				return dead(node.a) || dead(node.b);
			};
			return dead(ast);
		};
		for (let seed = 1; seed <= 400; seed++) {
			const q = makeQuestion(seed);
			const shown = [q.detail, ...(q.kind === 'circuit-expression' ? q.options : [])].filter((t): t is string => !!t);
			for (const text of shown) {
				expect(constantSub(text), `seed ${seed}: "${text}" contains a dead term`).toBe(false);
			}
		}
	});

	test('the same seed always gives the same question', () => {
		for (const seed of [1, 42, 99, 1234]) {
			expect(makeQuestion(seed)).toEqual(makeQuestion(seed));
		}
	});
});

test.describe('practice topics and repeats', () => {
	const KINDS_FOR: Record<string, string[]> = {
		mixed: [
			'gate-output',
			'identify-gate',
			'evaluate',
			'equivalent',
			'count-ones',
			'circuit-expression',
			'circuit-output'
		],
		gates: ['gate-output', 'identify-gate'],
		'truth-tables': ['identify-gate', 'count-ones'],
		expressions: ['evaluate'],
		simplifying: ['equivalent'],
		diagrams: ['circuit-expression', 'circuit-output']
	};

	test('each topic only asks its own kinds of question', () => {
		for (const topic of topics) {
			const seen = new Set<string>();
			for (let seed = 1; seed <= 200; seed++) {
				const q = makeQuestion(seed, topic.id);
				expect(KINDS_FOR[topic.id], `${topic.id} produced ${q.kind}`).toContain(q.kind);
				seen.add(q.kind);
			}
			// Every generator the topic claims should actually turn up.
			expect(seen.size, `${topic.id} only produced ${[...seen].join(', ')}`).toBe(KINDS_FOR[topic.id].length);
		}
	});

	test('a run of questions does not repeat within the recent window', () => {
		for (const topic of topics) {
			let random = ((seed) => () => {
				seed = (seed * 1103515245 + 12345) & 0x7fffffff;
				return seed / 0x7fffffff;
			})(4242);
			let recent: string[] = [];
			const order: string[] = [];
			for (let i = 0; i < 60; i++) {
				const { question } = nextQuestion(topic.id, recent, random);
				const sig = questionSignature(question);
				// It must differ from everything still inside the window.
				expect(recent, `${topic.id} repeated at step ${i}`).not.toContain(sig);
				order.push(sig);
				recent = [...recent, sig].slice(-RECENT_LIMIT);
			}
			expect(new Set(order.slice(0, RECENT_LIMIT)).size).toBe(RECENT_LIMIT);
		}
	});

	test('a fresh visit does not start on the same question every time', () => {
		const firsts = new Set<string>();
		for (let run = 0; run < 25; run++) {
			let seed = run * 7919 + 13;
			const random = () => {
				seed = (seed * 1103515245 + 12345) & 0x7fffffff;
				return seed / 0x7fffffff;
			};
			firsts.add(questionSignature(nextQuestion('mixed', [], random).question));
		}
		expect(firsts.size).toBeGreaterThan(15);
	});
});

test.describe('quiz diagrams', () => {
	test('every diagram question stays within the readable size cap', () => {
		let drawn = 0;
		for (let seed = 1; seed <= 600; seed++) {
			const question = makeQuestion(seed, 'diagrams');
			expect(question.svg, 'a diagram question must have a diagram').toBeTruthy();
			expect(question.svgPrint, 'and a black and white copy for paper').toBeTruthy();
			// The cap is on gates, which is what the drawing code counts.
			const gates = (question.svg?.match(/data-gate=/g) ?? []).length;
			expect(gates, `seed ${seed} drew ${gates} gates`).toBeLessThanOrEqual(MAX_QUIZ_GATES);
			drawn++;
		}
		expect(drawn).toBe(600);
	});

	test('the diagram topic produces a range of circuit sizes', () => {
		const sizes = new Set<number>();
		for (let seed = 1; seed <= 300; seed++) {
			const q = makeQuestion(seed, 'diagrams');
			sizes.add((q.svg?.match(/data-gate=/g) ?? []).length);
		}
		// If everything came out the same size the depth variation is not working.
		expect(sizes.size, `only saw sizes ${[...sizes].join(', ')}`).toBeGreaterThan(2);
	});
});

test.describe('SVG export', () => {
	// A minimal XML well-formedness check: tags must nest and close properly.
	const wellFormed = (svg: string) => {
		const stack: string[] = [];
		const tag = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
		let m: RegExpExecArray | null;
		while ((m = tag.exec(svg))) {
			const [, closing, name, attrs, selfClose] = m;
			if (attrs.includes('<')) return `attribute contains < in <${name}>`;
			if (selfClose || name === '?xml') continue;
			if (closing) {
				if (stack.pop() !== name) return `mismatched </${name}>`;
			} else {
				stack.push(name);
			}
		}
		return stack.length ? `unclosed <${stack.join(', ')}>` : null;
	};

	test('circuit exports are well formed in every combination', () => {
		for (const { ast } of randomCases(60)) {
			const circuit = buildCircuit(ast);
			for (const standard of ['ansi', 'iec'] as const) {
				for (const palette of ['colour', 'mono'] as const) {
					const svg = circuitToSvg(circuit, { standard, palette, caption: 'a & b' });
					expect(wellFormed(svg), `${standard}/${palette}`).toBe(null);
					expect(svg).not.toContain('NaN');
					expect(svg).not.toContain('undefined');
					expect(svg.startsWith('<?xml')).toBe(true);
					expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
					// Every gate must be drawn.
					const bodies = (svg.match(/<path d="M/g) ?? []).length;
					expect(bodies).toBeGreaterThanOrEqual(standard === 'ansi' ? circuit.gateCount : 0);
				}
			}
		}
	});

	test('the print version uses no colour', () => {
		const circuit = buildCircuit(parseExpression('(a & b) | !c'));
		const mono = circuitToSvg(circuit, { palette: 'mono', states: { a: true } });
		// No green or red anywhere, and a white page.
		expect(mono).not.toMatch(/#5db65d|#f23|#372|#a22/);
		expect(mono).toContain(THEMES.mono.background);
		const colour = circuitToSvg(circuit, { palette: 'colour', states: {} });
		expect(colour).toContain(THEMES.colour.background);
	});

	test('states colour the wires only when asked for', () => {
		const circuit = buildCircuit(parseExpression('a & b'));
		const states: Record<string, boolean> = {};
		for (const node of circuit.nodes) states[node.id] = node.label === 'a';
		const withStates = circuitToSvg(circuit, { palette: 'colour', states });
		expect(withStates).toContain('#5db65d');
		expect(withStates).toContain('#f23');
		const without = circuitToSvg(circuit, { palette: 'colour' });
		expect(without).not.toContain('#5db65d');
	});

	test('the output box can be labelled instead of showing a value', () => {
		const circuit = buildCircuit(parseExpression('a & b'));
		const states: Record<string, boolean> = {};
		for (const node of circuit.nodes) states[node.id] = true;
		// Default: the live value.
		expect(circuitToSvg(circuit, { states })).toContain('>1</text>');
		// Labelled: the letter, and never the value.
		const labelled = circuitToSvg(circuit, { states, outputLabel: 'Q' });
		expect(labelled).toContain('>Q</text>');
		const outputs = labelled.match(/>[01Q]<\/text>/g) ?? [];
		expect(outputs).toContain('>Q</text>');
		// A caption can be left off entirely.
		expect(circuitToSvg(circuit, { caption: 'a ∧ b' })).toContain('a ∧ b');
		const bare = circuitToSvg(circuit, { caption: '' });
		expect(bare).not.toContain('font-size="14"');
	});

	test('truth table exports match the table they came from', () => {
		for (const src of ['a & b', 'a ^ b', 'abc + !a', '!(a | b)']) {
			const table = truthTable(parseExpression(src));
			for (const palette of ['colour', 'mono'] as const) {
				const svg = truthTableToSvg(table, { palette, caption: src });
				expect(wellFormed(svg), `${src}/${palette}`).toBe(null);
				expect(svg).not.toContain('NaN');
				// One digit per cell, plus the header labels.
				const digits = (svg.match(/>[01]<\/text>/g) ?? []).length;
				expect(digits).toBe(table.rows.length * (table.variables.length + 1));
				for (const name of table.variables) expect(svg).toContain(`>${name}</text>`);
			}
		}
	});

	test('filenames stay readable and safe', () => {
		expect(slugifyExpression('a & b')).toBe('a-and-b');
		expect(slugifyExpression('¬(a ∨ b)')).toBe('not-a-or-b');
		expect(slugifyExpression('   ')).toBe('circuit');
		expect(slugifyExpression('a'.repeat(200)).length).toBeLessThanOrEqual(60);
		expect(slugifyExpression('a/b\\c')).not.toMatch(/[/\\]/);
	});
});

test.describe('common circuits reference', () => {
	// Evaluate every output of a circuit for one assignment of its inputs.
	const run = (slug: string, bits: Record<string, boolean>) => {
		const circuit = commonCircuits.find((c) => c.slug === slug)!;
		const out: Record<string, boolean> = {};
		for (const output of circuit.outputs) {
			out[output.name] = evaluate(parseExpression(output.expression), bits);
		}
		return out;
	};
	const each = (names: string[], fn: (bits: Record<string, boolean>) => void) => {
		for (let i = 0; i < 1 << names.length; i++) {
			const bits: Record<string, boolean> = {};
			names.forEach((n, k) => (bits[n] = !!(i & (1 << (names.length - 1 - k)))));
			fn(bits);
		}
	};

	test('the half adder really adds two bits', () => {
		each(['a', 'b'], (bits) => {
			const { sum, carry } = run('half-adder', bits);
			expect(Number(sum) + 2 * Number(carry)).toBe(Number(bits.a) + Number(bits.b));
		});
	});

	test('the full adder really adds three bits', () => {
		each(['a', 'b', 'c'], (bits) => {
			const { sum, cout } = run('full-adder', bits);
			expect(Number(sum) + 2 * Number(cout)).toBe(Number(bits.a) + Number(bits.b) + Number(bits.c));
		});
	});

	test('the multiplexer selects, and the demultiplexer routes', () => {
		each(['a', 'b', 's'], (bits) => {
			expect(run('multiplexer', bits).out).toBe(bits.s ? bits.b : bits.a);
		});
		each(['d', 's'], (bits) => {
			const { y0, y1 } = run('demultiplexer', bits);
			expect(y0).toBe(!bits.s && bits.d);
			expect(y1).toBe(bits.s && bits.d);
			expect(y0 && y1).toBe(false); // never both
		});
	});

	test('the decoder raises exactly one line, matching the input number', () => {
		each(['a', 'b'], (bits) => {
			const out = run('decoder', bits);
			const high = Object.entries(out).filter(([, v]) => v);
			expect(high.length).toBe(1);
			const index = (bits.a ? 2 : 0) + (bits.b ? 1 : 0);
			expect(high[0][0]).toBe(`y${index}`);
		});
	});

	test('the encoder reverses the decoder for one hot inputs', () => {
		for (let index = 0; index < 4; index++) {
			const bits = { a: index === 0, b: index === 1, c: index === 2, d: index === 3 };
			const { o1, o0 } = run('encoder', bits);
			expect((o1 ? 2 : 0) + (o0 ? 1 : 0), `one hot ${index}`).toBe(index);
		}
	});

	test('the comparator gives exactly one verdict', () => {
		each(['a', 'b'], (bits) => {
			const { equal, greater, less } = run('comparator', bits);
			expect([equal, greater, less].filter(Boolean).length).toBe(1);
			expect(equal).toBe(bits.a === bits.b);
			expect(greater).toBe(Number(bits.a) > Number(bits.b));
			expect(less).toBe(Number(bits.a) < Number(bits.b));
		});
	});

	test('parity is odd, and majority is a majority', () => {
		each(['a', 'b', 'c'], (bits) => {
			const count = [bits.a, bits.b, bits.c].filter(Boolean).length;
			expect(run('parity', bits).odd).toBe(count % 2 === 1);
			expect(run('majority', bits).out).toBe(count >= 2);
		});
	});

	test('the full adder carry really is the majority function', () => {
		// The page says so, so it had better be true.
		each(['a', 'b', 'c'], (bits) => {
			const carry = evaluate(parseExpression('(a & b) | (c & (a ^ b))'), bits);
			const majority = evaluate(parseExpression('(a & b) | (b & c) | (a & c)'), bits);
			expect(carry).toBe(majority);
		});
	});

	test('every entry is complete and its expressions use only its own pins', () => {
		for (const circuit of commonCircuits) {
			expect(circuit.outputs.length).toBeGreaterThan(0);
			expect(circuit.uses.length).toBeGreaterThanOrEqual(3);
			expect(circuit.explanation.length).toBeGreaterThan(80);
			expect(circuit.buildTip.length).toBeGreaterThan(30);
			for (const output of circuit.outputs) {
				const used = variablesOf(parseExpression(output.expression));
				const pins = circuit.inputs.map((pin) => pin.v);
				for (const name of used) {
					expect(pins, `${circuit.slug}/${output.name} uses ${name}`).toContain(name);
				}
				// A pin name must be a single letter, or the parser would read it
				// as several variables ANDed together.
				for (const pin of circuit.inputs) expect(pin.v).toMatch(/^[a-z]$/);
			}
		}
		expect(new Set(commonCircuits.map((c) => c.slug)).size).toBe(commonCircuits.length);
	});
});
