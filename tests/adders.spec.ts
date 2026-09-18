// The adder page's tables are checked against integer arithmetic, and the
// carry lookahead equations against the ripple carries they are meant to
// replace, on every input of every width the page shows.

import { expect, test } from '@playwright/test';
import {
	fullAdder,
	fullAdderRows,
	rippleAdd,
	rippleCarryExpressions,
	lookaheadCarries,
	lookaheadExpressions,
	evaluateAdder,
	carryDepth,
	delayTable,
	toOutputs,
	type Bit
} from '../src/lib/adders.js';
import { buildCircuit } from '../src/lib/circuit.js';

test.describe('adders', () => {
	test('a full adder adds three bits', () => {
		for (const row of fullAdderRows()) {
			expect(row.sum + 2 * row.cout).toBe(row.a + row.b + row.cin);
		}
		expect(fullAdderRows()).toHaveLength(8);
		expect(fullAdder(1, 1, 1)).toEqual({ sum: 1, cout: 1 });
	});

	test('ripple addition is addition, with the carry out as the extra bit', () => {
		// Exhaustive at the widths the page shows, sampled at a byte.
		const cases: [number, number, number][] = [];
		for (const width of [1, 2, 3, 4]) {
			for (let a = 0; a < 1 << width; a++) for (let b = 0; b < 1 << width; b++) cases.push([width, a, b]);
		}
		for (let i = 0; i < 200; i++) cases.push([8, (i * 37) % 256, (i * 101 + 13) % 256]);
		for (const [width, a, b] of cases) {
			for (const cin of [0, 1] as Bit[]) {
				const sum = rippleAdd(a, b, width, cin);
				expect(sum.unsigned + (sum.carryOut << width), `${a} + ${b} + ${cin} at ${width} bits`).toBe(a + b + cin);
				// Each column applies the full adder rule to the carry the previous one produced.
				sum.columns.forEach((column, i) => {
					expect(column.cin).toBe(i === 0 ? cin : sum.columns[i - 1].cout);
					expect(fullAdder(column.a, column.b, column.cin)).toEqual({ sum: column.sum, cout: column.cout });
				});
				expect(sum.carries).toHaveLength(width + 1);
			}
		}
	});

	test('signed overflow is flagged exactly when the true sum leaves the range', () => {
		const width = 4;
		for (let a = -8; a < 8; a++) {
			for (let b = -8; b < 8; b++) {
				const sum = rippleAdd(a, b, width);
				const outOfRange = a + b > 7 || a + b < -8;
				expect(sum.overflow, `${a} + ${b}`).toBe(outOfRange);
			}
		}
	});

	test('the lookahead carries equal the ripple carries on every input', () => {
		for (const width of [1, 2, 3, 4]) {
			const carries = lookaheadCarries(width);
			expect(carries).toHaveLength(width);
			// c_i has i + 1 product terms: one per generate below it, plus the carry in term.
			carries.forEach((carry, i) => expect(carry.terms).toBe(i + 2));
			const list = carries.map((carry) => ({ name: `c${carry.index}`, expression: carry.expression }));
			for (let a = 0; a < 1 << width; a++) {
				for (let b = 0; b < 1 << width; b++) {
					for (const cin of [0, 1] as Bit[]) {
						const ripple = rippleAdd(a, b, width, cin);
						const values = evaluateAdder(list, a, b, width, cin);
						carries.forEach((carry) => {
							expect(values[`c${carry.index}`], `${carry.text} for ${a} + ${b} + ${cin}`).toBe(
								ripple.carries[carry.index] === 1
							);
						});
					}
				}
			}
		}
	});

	test('both expression forms compute the sum', () => {
		for (const width of [1, 2, 3, 4]) {
			for (const list of [rippleCarryExpressions(width), lookaheadExpressions(width)]) {
				for (let a = 0; a < 1 << width; a++) {
					for (let b = 0; b < 1 << width; b++) {
						for (const cin of [0, 1] as Bit[]) {
							const values = evaluateAdder(list, a, b, width, cin);
							const sum = Array.from({ length: width }, (_, i) => (values[`s${i}`] ? 1 << i : 0)).reduce(
								(x, y) => x + y,
								0
							);
							expect(sum + (values.cout ? 1 << width : 0), `${a} + ${b} + ${cin} at ${width} bits`).toBe(a + b + cin);
						}
					}
				}
			}
		}
		// Without a carry in the first column is a half adder, and the sum is still right.
		const noCarry = rippleCarryExpressions(4, false);
		expect(noCarry[0].expression).toBe('a ^ e');
		for (let a = 0; a < 16; a++) {
			for (let b = 0; b < 16; b++) {
				const values = evaluateAdder(noCarry, a, b, 4, 0);
				const sum = [0, 1, 2, 3].reduce((total, i) => total + (values[`s${i}`] ? 1 << i : 0), 0);
				expect(sum + (values.cout ? 16 : 0)).toBe(a + b);
			}
		}
	});

	test('the lookahead equations read as the textbook writes them', () => {
		const [c1, c2] = lookaheadCarries(4);
		expect(c1.text).toBe('c1 = G0 + P0c0');
		expect(c2.text).toBe('c2 = G1 + P1G0 + P1P0c0');
		expect(lookaheadCarries(4)[3].text).toBe('c4 = G3 + P3G2 + P3P2G1 + P3P2P1G0 + P3P2P1P0c0');
	});

	test('the ripple carry path grows two gate levels per column', () => {
		for (const width of [1, 2, 3, 4]) {
			const { ripple } = carryDepth(rippleCarryExpressions(width));
			expect(ripple, `${width} bits`).toBe(2 * width + 1);
		}
		// The drawing shares the XOR between sum and carry, five gates per full adder.
		expect(buildCircuit(toOutputs(rippleCarryExpressions(4))).gateCount).toBe(20);
		// The comparison table uses the same count as the drawing.
		expect(delayTable([4, 8])).toEqual([
			{ width: 4, ripple: 9, lookahead: 3 },
			{ width: 8, ripple: 17, lookahead: 3 }
		]);
	});
});
