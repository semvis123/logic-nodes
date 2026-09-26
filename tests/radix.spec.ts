// Base conversion with working, checked against the language's own
// parseInt and toString rather than against hand-written answers.

import { expect, test } from '@playwright/test';
import {
	parseRadix,
	placeValueSteps,
	divisionSteps,
	digitsToBitGroups,
	bitsToDigitGroups,
	joinDigits,
	joinBits,
	groupDigits,
	hexDigitTable,
	RadixError,
	MAX_DIGITS,
	type Radix
} from '../src/lib/radix.js';

/** A random BigInt of up to `bits` bits, with small values well represented. */
function randomBig(bits: number): bigint {
	const length = 1 + Math.floor(Math.random() * bits);
	let s = '';
	for (let i = 0; i < length; i++) s += Math.random() < 0.5 ? '0' : '1';
	return BigInt('0b' + s);
}

const radixes: Radix[] = [2, 8, 10, 16];

test.describe('base conversion', () => {
	test('parsing agrees with parseInt', () => {
		for (let i = 0; i < 500; i++) {
			const n = Math.floor(Math.random() * 2 ** 48);
			for (const radix of radixes) {
				const text = n.toString(radix);
				expect(parseRadix(text, radix).value).toBe(BigInt(parseInt(text, radix)));
			}
		}
	});

	test('prefixes, separators and case are accepted', () => {
		expect(parseRadix('0xff', 16).value).toBe(255n);
		expect(parseRadix('#1E90FF', 16).value).toBe(0x1e90ffn);
		expect(parseRadix('dead_beef', 16).value).toBe(0xdeadbeefn);
		expect(parseRadix('0b1010 0101', 2).value).toBe(0xa5n);
		expect(parseRadix('0o755', 8).value).toBe(0o755n);
		expect(parseRadix('00FF', 16).digits).toBe('00FF');
	});

	test('bad input says which character is wrong', () => {
		expect(() => parseRadix('12G4', 16)).toThrow(/"G" is not a hex digit/);
		expect(() => parseRadix('1021', 2)).toThrow(/"2" is not a binary digit/);
		expect(() => parseRadix('78', 8)).toThrow(/"8" is not an octal digit/);
		expect(() => parseRadix('', 10)).toThrow(RadixError);
		expect(() => parseRadix('-5', 10)).toThrow(/negative/);
		expect(() => parseRadix('1.5', 10)).toThrow(/Whole numbers/);
		expect(() => parseRadix('1'.repeat(MAX_DIGITS + 1), 2)).toThrow(/more than/);
		expect(parseRadix('1'.repeat(MAX_DIGITS), 16).value).toBe(BigInt('0x' + '1'.repeat(MAX_DIGITS)));
	});

	test('place values sum to the number, term by term', () => {
		for (let i = 0; i < 200; i++) {
			const value = randomBig(200);
			for (const radix of radixes) {
				const digits = value.toString(radix).toUpperCase();
				const { terms, total } = placeValueSteps(digits, radix);
				expect(total).toBe(value);
				const bad = terms.filter(
					(t, k) =>
						t.power !== digits.length - 1 - k ||
						t.place !== BigInt(radix) ** BigInt(t.power) ||
						t.product !== BigInt(parseInt(t.digit, radix)) * t.place
				);
				expect(bad).toEqual([]);
			}
		}
	});

	test('repeated division gives toString, and every step divides', () => {
		for (let i = 0; i < 200; i++) {
			const value = i < 5 ? BigInt(i) : randomBig(200);
			for (const radix of radixes) {
				const { steps, result } = divisionSteps(value, radix);
				expect(result).toBe(value.toString(radix).toUpperCase());
				expect(steps[0].dividend).toBe(value);
				const bad = steps.filter(
					(s, k) =>
						s.dividend !== s.quotient * BigInt(radix) + BigInt(s.remainder) ||
						s.remainder >= radix ||
						(k > 0 && s.dividend !== steps[k - 1].quotient)
				);
				expect(bad).toEqual([]);
				expect(steps[steps.length - 1].quotient).toBe(0n);
			}
		}
	});

	test('nibbles and octal triples round trip', () => {
		for (let i = 0; i < 300; i++) {
			const value = i < 3 ? BigInt(i) : randomBig(256);
			const binary = value.toString(2);
			for (const radix of [8, 16] as const) {
				const digits = value.toString(radix).toUpperCase();
				const groups = digitsToBitGroups(digits, radix);
				expect(joinBits(groups)).toBe(binary);
				expect(groups.every((g) => g.bits.length === (radix === 16 ? 4 : 3))).toBe(true);
				const back = bitsToDigitGroups(binary, radix);
				expect(joinDigits(back.groups)).toBe(digits);
				expect((binary.length + back.padded) % (radix === 16 ? 4 : 3)).toBe(0);
			}
		}
	});

	test('the reference table and grouping', () => {
		hexDigitTable.forEach((row) => {
			expect(parseInt(row.hex, 16)).toBe(row.decimal);
			expect(parseInt(row.binary, 2)).toBe(row.decimal);
		});
		expect(groupDigits('11111111', 4)).toBe('1111 1111');
		expect(groupDigits('1011111111', 4)).toBe('10 1111 1111');
	});
});
