// Every table on the two's complement page is checked against ordinary
// integer arithmetic, so the page can only say what the numbers do.

import { expect, test } from '@playwright/test';
import {
	representations,
	ranges,
	negate,
	addSigned,
	subtractSigned,
	signExtend,
	overflowExamples
} from '../src/lib/twosComplement.js';
import { signedValue, toBits } from '../src/lib/numbers.js';

test.describe("two's complement", () => {
	test('the four readings of every pattern', () => {
		for (const width of [3, 4, 5, 8]) {
			const rows = representations(width);
			expect(rows).toHaveLength(1 << width);
			const half = 1 << (width - 1);
			rows.forEach((row, value) => {
				expect(row.unsigned).toBe(value);
				expect(row.pattern).toBe(value.toString(2).padStart(width, '0'));
				// Two's complement: the top bit counts negative.
				expect(row.twosComplement).toBe(value < half ? value : value - (1 << width));
				// The positives agree in every code; the negatives differ by design.
				if (value < half) {
					expect(row.signMagnitude).toBe(value);
					expect(row.onesComplement).toBe(value);
				} else {
					expect(row.signMagnitude).toBe(-(value - half) || 0);
					expect(row.onesComplement).toBe(row.twosComplement + 1);
				}
			});
			// Sign-magnitude and one's complement each have two zeros; two's complement has one.
			const zeros = (key: 'signMagnitude' | 'onesComplement' | 'twosComplement') =>
				rows.filter((row) => row[key] === 0).length;
			expect(zeros('signMagnitude')).toBe(2);
			expect(zeros('onesComplement')).toBe(2);
			expect(zeros('twosComplement')).toBe(1);
			// And two's complement alone reaches one further negative.
			expect(Math.min(...rows.map((r) => r.twosComplement))).toBe(-half);
			expect(Math.min(...rows.map((r) => r.onesComplement))).toBe(-half + 1);
		}
	});

	test('ranges', () => {
		expect(ranges([4, 8])).toEqual([
			{ width: 4, unsignedMax: 15, signedMin: -8, signedMax: 7 },
			{ width: 8, unsignedMax: 255, signedMin: -128, signedMax: 127 }
		]);
	});

	test('negation by invert and add one gives the negative, and the shortcut lands on the same bits', () => {
		for (const width of [4, 8]) {
			const half = 1 << (width - 1);
			for (let value = -half; value < half; value++) {
				const step = negate(value, width);
				expect(step.inverted).toEqual(step.original.map((bit) => (bit ? 0 : 1)));
				expect(step.result).toEqual(toBits(-Math.abs(value), width));
				// Adding one to the inverted pattern is the result.
				const invertedValue = step.inverted.reduce((total, bit) => total * 2 + bit, 0);
				expect(step.result).toEqual(toBits(invertedValue + 1, width));
				// Everything from the rightmost 1 down is copied, everything above it inverted.
				step.original.forEach((bit, i) => {
					const expected = i >= step.shortcutIndex ? bit : bit ? 0 : 1;
					expect(step.result[i], `bit ${i} of ${value}`).toBe(expected);
				});
				if (value === -half) {
					// The most negative number is its own negation, which is the one case that does not fit.
					expect(step.fits).toBe(false);
					expect(step.reading).toBe(-half);
				} else {
					expect(step.fits).toBe(true);
					expect(step.reading).toBe(-Math.abs(value) || 0);
				}
			}
		}
	});

	test('signed addition and subtraction are right whenever the answer fits, and flag overflow when it does not', () => {
		const width = 4;
		for (let a = -8; a < 8; a++) {
			for (let b = -8; b < 8; b++) {
				const sum = addSigned(a, b, width);
				expect(sum.aSigned).toBe(a);
				expect(sum.bSigned).toBe(b);
				expect(sum.expected).toBe(a + b);
				const fits = a + b >= -8 && a + b <= 7;
				expect(sum.overflow, `${a} + ${b}`).toBe(!fits);
				if (fits) expect(sum.resultSigned).toBe(a + b);
				else expect(sum.resultSigned).not.toBe(a + b);
				// Overflow can only happen when the operands share a sign.
				if (sum.overflow) expect(Math.sign(a) === Math.sign(b)).toBe(true);

				const difference = subtractSigned(a, b, width);
				expect(difference.bSigned).toBe(b);
				expect(difference.expected).toBe(a - b);
				expect(difference.inverted).toEqual(toBits(b, width).map((bit) => (bit ? 0 : 1)));
				expect(difference.cin).toBe(1);
				const differenceFits = a - b >= -8 && a - b <= 7;
				expect(difference.overflow, `${a} - ${b}`).toBe(!differenceFits);
				if (differenceFits) expect(difference.resultSigned).toBe(a - b);
			}
		}
	});

	test('sign extension keeps the value', () => {
		for (let value = -8; value < 8; value++) {
			const extended = signExtend(value, 4, 8);
			expect(extended.value).toBe(value);
			expect(signedValue(extended.after)).toBe(value);
			expect(extended.after.slice(0, 5).every((bit) => bit === extended.before[0])).toBe(true);
			expect(extended.after.slice(4)).toEqual(extended.before);
		}
	});

	test('the overflow examples are two that overflow and two that do not', () => {
		const examples = overflowExamples(4);
		expect(examples.map((e) => e.overflow)).toEqual([true, true, false, false]);
		expect(examples[0].resultSigned).toBe(-8);
		expect(examples[1].resultSigned).toBe(7);
	});
});
