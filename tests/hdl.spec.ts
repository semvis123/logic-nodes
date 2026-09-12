// The emitted HDL is checked by reading it back: both languages use operators
// this project's own parser understands, so the generated expression can be
// turned into a truth table and compared with the one it came from.

import { expect, test } from '@playwright/test';
import { parseExpression, parseSystem, truthTable, truthTables, variablesOf, type Ast } from '../src/lib/boolean.js';
import { toHdl, toHdlExpression, hdlTargets, type Hdl } from '../src/lib/hdl.js';

let seed = 20260909;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const randomAst = (depth: number, pool: string[]): Ast => {
	if (depth <= 0 || rnd() < 0.28) {
		if (rnd() < 0.08) return { t: 'const', v: rnd() < 0.5 };
		return { t: 'var', name: pool[Math.floor(rnd() * pool.length)] };
	}
	if (rnd() < 0.22) return { t: 'not', a: randomAst(depth - 1, pool) };
	const r = rnd();
	const kind = r < 0.45 ? 'and' : r < 0.8 ? 'or' : 'xor';
	return { t: kind, a: randomAst(depth - 1, pool), b: randomAst(depth - 1, pool) } as Ast;
};

/** Turns emitted HDL back into something this project's parser accepts. */
const readBack = (text: string, target: Hdl) =>
	target === 'verilog'
		? text.replace(/1'b1/g, '1').replace(/1'b0/g, '0')
		: text.replace(/'1'/g, '1').replace(/'0'/g, '0');

test.describe('HDL export', () => {
	test('the emitted expression computes the same function', () => {
		for (let i = 0; i < 400; i++) {
			const pool = ['a', 'b', 'c', 'd'].slice(0, 2 + Math.floor(rnd() * 3));
			const ast = randomAst(3 + Math.floor(rnd() * 2), pool);
			const variables = variablesOf(ast);
			if (!variables.length) continue;
			const expected = truthTable(ast, variables).rows;
			for (const { id } of hdlTargets) {
				const text = toHdlExpression(ast, id);
				const rows = truthTable(parseExpression(readBack(text, id)), variables).rows;
				expect(rows, `${id} emitted "${text}", which is a different function`).toEqual(expected);
			}
		}
	});

	test('a module declares exactly the signals it uses', () => {
		for (let i = 0; i < 200; i++) {
			const ast = randomAst(3, ['a', 'b', 'c']);
			const variables = variablesOf(ast);
			if (!variables.length) continue;

			const verilog = toHdl(ast, 'verilog');
			for (const v of variables) expect(verilog).toContain(`input  wire ${v},`);
			expect(verilog).toContain('output wire y');
			expect(verilog.trimEnd().endsWith('endmodule')).toBe(true);
			// One port line per variable, plus the output.
			expect((verilog.match(/input  wire/g) ?? []).length).toBe(variables.length);

			const vhdl = toHdl(ast, 'vhdl');
			for (const v of variables) expect(vhdl).toContain(`${v} : in  std_logic;`);
			expect(vhdl).toContain('y : out std_logic');
			expect(vhdl).toContain('library ieee;');
			expect(vhdl.trimEnd().endsWith('end architecture;')).toBe(true);
		}
	});

	test('VHDL brackets every operator, since it has no AND/OR precedence', () => {
		// `a and b or c` is a syntax error in VHDL; the output must not produce it.
		const ast = parseExpression('a & b | c');
		const vhdl = toHdlExpression(ast, 'vhdl');
		expect(vhdl).toBe('(a and b) or c');
		expect(toHdlExpression(parseExpression('a | b & c'), 'vhdl')).toBe('a or (b and c)');
	});

	test('signal names need no escaping, because they are single letters', () => {
		// The parser splits letter runs into single variables, so a name can never
		// collide with a reserved word in either language. If that ever changes,
		// this is the test that should start failing.
		for (const source of ['o & r', 'i & n', 'a & n & d', 'x & o & r']) {
			for (const { id } of hdlTargets) {
				const text = toHdl(parseExpression(source), id);
				for (const name of variablesOf(parseExpression(source))) {
					expect(name.length, 'a multi letter signal name would need escaping').toBe(1);
					expect(text).toContain(id === 'verilog' ? `input  wire ${name},` : `${name} : in  std_logic;`);
				}
			}
		}
	});

	test('the familiar cases come out as written', () => {
		expect(toHdlExpression(parseExpression('a & b'), 'verilog')).toBe('a & b');
		expect(toHdlExpression(parseExpression('!a'), 'verilog')).toBe('~a');
		expect(toHdlExpression(parseExpression('!(a | b)'), 'verilog')).toBe('~(a | b)');
		expect(toHdlExpression(parseExpression('a ^ b'), 'vhdl')).toBe('a xor b');
		expect(toHdlExpression(parseExpression('!a'), 'vhdl')).toBe('not a');
	});

	test('the output port never collides with an input, whatever it is called', () => {
		// `y` is the conventional output name and also a perfectly legal variable.
		// Emitting both declares the port twice and assigns it from itself, which
		// neither language will take.
		for (const source of ['x & y', 'y', 'y | (a & y)']) {
			const ast = parseExpression(source);
			for (const { id } of hdlTargets) {
				const text = toHdl(ast, id);
				const ports = text
					.split('\n')
					.filter((line) => line.includes(' wire ') || line.includes(' std_logic'))
					.map((line) =>
						line
							.trim()
							.replace(/^(input|output)\s+wire\s+/, '')
							.replace(/\s*:.*$/, '')
							.replace(/,$/, '')
					);
				expect(new Set(ports).size, `${id} declared a port twice for ${source}`).toBe(ports.length);
			}
		}
	});

	test('several outputs become several ports, each with its own assignment', () => {
		const sources = [
			'sum = a ^ b; carry = a & b',
			'lt = !a & b; eq = !(a ^ b); gt = a & !b',
			'sum = a ^ b ^ c; carry = (a & b) | (c & (a ^ b))',
			'a & b; a | b'
		];
		for (const source of sources) {
			const outputs = parseSystem(source);
			const table = truthTables(outputs);
			for (const { id } of hdlTargets) {
				const text = toHdl(outputs, id);
				for (const v of table.variables) {
					expect(text).toContain(id === 'verilog' ? `input  wire ${v},` : `${v} : in  std_logic;`);
				}
				outputs.forEach((o, i) => {
					expect(text).toContain(id === 'verilog' ? `output wire ${o.name}` : `${o.name} : out std_logic`);
					// Read the assignment back and check it is the right function.
					const line = text
						.split('\n')
						.find((l) => l.trim().startsWith(id === 'verilog' ? `assign ${o.name} =` : `${o.name} <=`));
					expect(line, `${id} has no assignment for ${o.name}`).toBeTruthy();
					const body = line!.replace(/^.*?(=|<=)\s*/, '').replace(/;\s*$/, '');
					const rows = truthTable(parseExpression(readBack(body, id)), table.variables).rows;
					expect(rows, `${id}: ${o.name}`).toEqual(table.outputs[i].rows);
				});
				// The port list is punctuated so it compiles: no separator after the last port.
				const ports = text.split('\n').filter((l) => / wire |: (in|out) +std_logic/.test(l));
				expect(ports.length).toBe(table.variables.length + outputs.length);
				expect(
					ports
						.at(-1)!
						.trim()
						.endsWith(id === 'verilog' ? ',' : ';')
				).toBe(false);
				for (const port of ports.slice(0, -1)) expect(port.trim().endsWith(id === 'verilog' ? ',' : ';')).toBe(true);
			}
		}
	});

	test('the module name is always a legal identifier', () => {
		// Both languages need an identifier to start with a letter, and an
		// expression can perfectly well start with a constant.
		for (const name of ['1', '0_or_1', '9lives']) {
			for (const { id } of hdlTargets) {
				const text = toHdl(parseExpression('a & b'), id, name);
				const declared = text.match(id === 'verilog' ? /module (\S+)/ : /entity (\S+)/)?.[1] ?? '';
				expect(declared, `${id} emitted ${declared}`).toMatch(/^[a-zA-Z]/);
			}
		}
	});
});
