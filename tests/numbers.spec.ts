// Fixed-width numbers, checked against the arithmetic they are supposed to
// implement rather than against hand-written expectations.

import { expect, test } from '@playwright/test';
import {
	parseNumber,
	toBits,
	fromBits,
	signedValue,
	rangeOf,
	fits,
	render,
	groupBits,
	toBcd,
	invalidBcdPatterns,
	negationSteps,
	widths,
	bases,
	NumberError,
	type Base
} from '../src/lib/numbers.js';

test.describe('fixed width numbers', () => {
	test('bits round trip through every width', () => {
		for (const width of [1, 4, 8, 12, 16]) {
			const { unsignedMax } = rangeOf(width);
			const step = Math.max(1, Math.floor(unsignedMax / 400));
			for (let value = 0; value <= unsignedMax; value += step) {
				const bits = toBits(value, width);
				expect(bits).toHaveLength(width);
				expect(fromBits(bits), `${value} in ${width} bits`).toBe(value);
			}
		}
	});

	test("a negative number is its two's complement", () => {
		for (const width of [4, 8, 16]) {
			const { signedMin, signedMax } = rangeOf(width);
			for (let value = signedMin; value <= signedMax; value++) {
				const bits = toBits(value, width);
				// Reading it back as signed must give the number we started with.
				expect(signedValue(bits), `${value} in ${width} bits`).toBe(value);
				// And the defining property: x + (-x) is zero, in this width.
				if (value !== signedMin) {
					const sum = fromBits(toBits(value, width)) + fromBits(toBits(-value, width));
					expect(sum % 2 ** width, `${value} + ${-value}`).toBe(0);
				}
			}
		}
	});

	test('values outside the width wrap rather than overflow the array', () => {
		for (const width of [4, 8]) {
			for (const value of [-9999, -1, 0, 1, 9999, 2 ** width, 2 ** width + 5]) {
				const bits = toBits(value, width);
				expect(bits).toHaveLength(width);
				expect(bits.every((b) => b === 0 || b === 1)).toBe(true);
				// Wrapping is modular arithmetic, not clamping.
				expect(fromBits(bits)).toBe(((Math.trunc(value) % 2 ** width) + 2 ** width) % 2 ** width);
			}
		}
	});

	test('fits agrees with the stated range', () => {
		for (const width of widths) {
			const { unsignedMax, signedMin, signedMax } = rangeOf(width);
			expect(signedMax).toBe(unsignedMax >>> 1 || 2 ** (width - 1) - 1);
			expect(fits(unsignedMax, width)).toBe(true);
			expect(fits(unsignedMax + 1, width)).toBe(false);
			expect(fits(signedMin, width)).toBe(true);
			expect(fits(signedMin - 1, width)).toBe(false);
		}
	});

	test('parsing accepts each base and rejects the others', () => {
		expect(parseNumber('1010', 'binary')).toBe(10);
		expect(parseNumber('ff', 'hex')).toBe(255);
		expect(parseNumber('FF', 'hex')).toBe(255);
		expect(parseNumber('777', 'octal')).toBe(511);
		expect(parseNumber('-42', 'decimal')).toBe(-42);
		// Spacing and underscores are how people actually write bit patterns.
		expect(parseNumber('1010 1010', 'binary')).toBe(170);
		expect(parseNumber('1010_1010', 'binary')).toBe(170);

		for (const [text, base] of [
			['2', 'binary'],
			['g', 'hex'],
			['8', 'octal'],
			['xyz', 'decimal'],
			['', 'decimal'],
			['-1010', 'binary']
		] as [string, Base][]) {
			expect(() => parseNumber(text, base), `${text} as ${base}`).toThrow(NumberError);
		}
	});

	test('rendering round trips through every base', () => {
		for (const width of [4, 8, 16]) {
			for (let value = 0; value < 2 ** Math.min(width, 9); value += 7) {
				const bits = toBits(value, width);
				for (const { id } of bases) {
					if (id === 'decimal') continue;
					expect(parseNumber(render(bits, id), id), `${value} via ${id}`).toBe(value);
				}
				expect(Number(render(bits, 'decimal'))).toBe(value);
			}
		}
	});

	test('grouping keeps every bit and adds only spaces', () => {
		for (const width of widths) {
			const bits = toBits(2 ** width - 1 - 5, width);
			const grouped = groupBits(bits);
			expect(grouped.replace(/ /g, '')).toBe(bits.join(''));
			// Every group but possibly the first is four bits wide.
			const parts = grouped.split(' ');
			for (const part of parts.slice(1)) expect(part).toHaveLength(4);
		}
	});

	test('BCD holds one decimal digit per nibble', () => {
		for (let value = 0; value < 500; value++) {
			const digits = toBcd(value);
			expect(digits.map((d) => d.digit).join('')).toBe(String(value));
			for (const { digit, bits } of digits) {
				expect(bits).toHaveLength(4);
				expect(fromBits(bits)).toBe(digit);
				expect(digit).toBeLessThan(10);
			}
		}
		expect(() => toBcd(-1)).toThrow(NumberError);
	});

	test('exactly six four-bit patterns are not decimal digits', () => {
		expect(invalidBcdPatterns).toHaveLength(6);
		for (const bits of invalidBcdPatterns) expect(fromBits(bits)).toBeGreaterThan(9);
		const wasted = new Set(invalidBcdPatterns.map((b) => fromBits(b)));
		expect([...wasted].sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15]);
	});

	test('the negation steps really are invert and add one', () => {
		for (const width of [4, 8]) {
			const { signedMax } = rangeOf(width);
			for (let value = 1; value <= signedMax; value++) {
				const { original, inverted, result } = negationSteps(value, width);
				// Inverting is bit by bit.
				original.forEach((bit, i) => expect(inverted[i]).toBe(bit ? 0 : 1));
				// And the result is the inverted pattern plus one, in this width.
				expect(fromBits(result)).toBe((fromBits(inverted) + 1) % 2 ** width);
				expect(signedValue(result)).toBe(-value);
			}
		}
	});
});
