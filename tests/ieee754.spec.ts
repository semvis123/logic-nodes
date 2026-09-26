// IEEE 754 fields, checked against what the machine itself does: DataView and
// the typed arrays for the bits, Number() for decimal to double, Math.fround
// for double to single.

import { expect, test } from '@playwright/test';
import {
	decode,
	encode,
	parsePattern,
	patternOf,
	limits,
	exactDecimal,
	shortestDecimal,
	formats,
	FloatError,
	type Format
} from '../src/lib/ieee754.js';

function randomPattern(bits: number): bigint {
	let s = '';
	for (let i = 0; i < bits; i++) s += Math.random() < 0.5 ? '0' : '1';
	return BigInt('0b' + s);
}

/** Bits of a number via Float32Array or Float64Array, independently of DataView. */
function typedBits(value: number, format: Format): string {
	if (format === 'single') {
		const u = new Uint32Array(new Float32Array([value]).buffer)[0];
		return u.toString(2).padStart(32, '0');
	}
	const u = new BigUint64Array(new Float64Array([value]).buffer)[0];
	return u.toString(2).padStart(64, '0');
}

const same = (a: number, b: number) => Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));

test.describe('IEEE 754', () => {
	test('decoding random patterns agrees with DataView', () => {
		for (const format of ['single', 'double'] as const) {
			const f = formats[format];
			for (let i = 0; i < 1500; i++) {
				const pattern = randomPattern(f.bits);
				const fields = decode(pattern, format);
				const view = new DataView(new ArrayBuffer(8));
				if (format === 'single') view.setUint32(0, Number(pattern));
				else view.setBigUint64(0, pattern);
				const expected = format === 'single' ? view.getFloat32(0) : view.getFloat64(0);
				expect(same(fields.value, expected)).toBe(true);
				expect(fields.bits).toBe(pattern.toString(2).padStart(f.bits, '0'));
				expect(fields.sign + fields.exponentBits + fields.fractionBits).toBe(fields.bits);
				expect(fields.exponentBits).toHaveLength(f.exponentBits);
				if (Number.isFinite(expected)) {
					// The exact decimal is exact, so parsing it lands back on the same number.
					expect(same(Number(fields.exact), expected), fields.exact).toBe(true);
					if (format === 'double') expect(same(Number(fields.shortest), expected)).toBe(true);
					if (format === 'single') expect(Math.fround(Number(fields.shortest))).toBe(Math.fround(expected));
				}
				if (fields.kind === 'normal') {
					expect(fields.exponent).toBe(fields.biased - f.bias);
					expect(2 ** fields.exponent! <= Math.abs(expected) && Math.abs(expected) < 2 ** (fields.exponent! + 1)).toBe(
						true
					);
				}
			}
		}
	});

	test('encoding random doubles gives their own bits', () => {
		for (let i = 0; i < 800; i++) {
			const pattern = randomPattern(64);
			const x = new Float64Array(new BigUint64Array([pattern]).buffer)[0];
			if (!Number.isFinite(x)) continue;
			for (const text of [String(x), x.toPrecision(17), x.toExponential(25)]) {
				const enc = encode(text, 'double');
				expect(enc.bits, text).toBe(typedBits(x, 'double'));
			}
			// And the same number as a float: a double is exact input, so Math.fround rounds it once, correctly.
			const exact = decode(pattern, 'double').exact;
			expect(encode(exact, 'single').bits, exact).toBe(typedBits(Math.fround(x), 'single'));
		}
	});

	test('encoding random decimals agrees with Number() and Math.fround', () => {
		for (let i = 0; i < 2000; i++) {
			const digits = String(Math.floor(Math.random() * 10 ** (1 + (i % 15))));
			const exp = Math.floor(Math.random() * 90) - 45;
			const text = `${Math.random() < 0.3 ? '-' : ''}${digits[0]}.${digits.slice(1) || '0'}e${
				exp * (i % 7 === 0 ? 7 : 1)
			}`;
			const x = Number(text);
			const dbl = encode(text, 'double');
			expect(dbl.bits, text).toBe(typedBits(x, 'double'));
			const sgl = encode(text, 'single');
			expect(sgl.bits, text).toBe(typedBits(Math.fround(x), 'single'));
			// The error is the stored value minus the input, exactly.
			if (Number.isFinite(dbl.value) && dbl.value !== 0) {
				expect(dbl.rounded === 'exact').toBe(dbl.error === '0');
				expect(dbl.error === '0' ? 0 : dbl.error.startsWith('-') ? -1 : 1).toBe(
					dbl.rounded === 'up' ? 1 : dbl.rounded === 'down' ? -1 : 0
				);
			}
		}
	});

	test('edge cases', () => {
		const cases = [
			'0',
			'-0',
			'1',
			'0.1',
			'0.2',
			'0.3',
			'1e-45',
			'1.4e-45',
			'7e-46',
			'3.4028235e38',
			'3.4028236e38',
			'3.5e38',
			'1.17549435e-38',
			'5e-324',
			'2.5e-324',
			'2.4e-324',
			'2.2250738585072014e-308',
			'1.7976931348623157e308',
			'1.7976931348623158e308',
			'1.8e308',
			'16777217',
			'9007199254740993',
			'123456789012345678901234567890'
		];
		for (const text of cases) {
			const x = Number(text);
			expect(encode(text, 'double').bits, text).toBe(typedBits(x, 'double'));
			expect(encode(text, 'single').bits, text).toBe(typedBits(Math.fround(x), 'single'));
		}
		expect(encode('1.8e308', 'double').overflowed).toBe(true);
		expect(encode('1.8e308', 'double').kind).toBe('infinity');
		expect(encode('1e-50', 'single').underflowed).toBe(true);
		expect(encode('1e-40', 'single').kind).toBe('subnormal');
		expect(encode('-0', 'single').sign).toBe(1);
		expect(encode('-0', 'single').kind).toBe('zero');
		for (const format of ['single', 'double'] as const) {
			expect(encode('Infinity', format).kind).toBe('infinity');
			expect(encode('-inf', format).value).toBe(-Infinity);
			const nan = encode('NaN', format);
			expect(nan.kind).toBe('nan');
			expect(nan.quiet).toBe(true);
			expect(Number.isNaN(nan.value)).toBe(true);
		}
		// Exponents far beyond any format's range round to infinity or zero, like the language does.
		for (const text of ['1e5000', '-1e5000', '1e-5000', '-2.5e-99999', '0e5000', '1e400', '1e-400', '9e99999999']) {
			const x = Number(text);
			for (const format of ['single', 'double'] as const) {
				const e = encode(text, format);
				expect(e.bits, `${text} ${format}`).toBe(typedBits(format === 'single' ? Math.fround(x) : x, format));
			}
		}
		expect(encode('1e5000', 'double').overflowed).toBe(true);
		expect(encode('1e-5000', 'double').underflowed).toBe(true);
		expect(encode('1e-5000', 'double').error).toBe('-1e-5000');
		expect(encode('-1e-5000', 'double').rounded).toBe('up');
		expect(() => encode('1.2.3', 'double')).toThrow(FloatError);
		expect(() => encode('abc', 'double')).toThrow(FloatError);
		expect(() => encode('', 'double')).toThrow(FloatError);
	});

	test('the exact value of 0.1 and its error', () => {
		const tenth = encode('0.1', 'double');
		expect(tenth.exact).toBe('0.1000000000000000055511151231257827021181583404541015625');
		expect(tenth.error).toBe('0.0000000000000000055511151231257827021181583404541015625');
		expect(tenth.rounded).toBe('up');
		expect(tenth.hex).toBe('3FB999999999999A');
		const single = encode('0.1', 'single');
		expect(single.hex).toBe('3DCCCCCD');
		expect(single.exact).toBe('0.100000001490116119384765625');
		expect(single.shortest).toBe('0.1');
		expect(single.errorShort).toBe('1.49e-9');
		expect(encode('0.5', 'single').error).toBe('0');
	});

	test('bit pattern input', () => {
		expect(decode(parsePattern('0x3F800000', 'single', 'hex'), 'single').value).toBe(1);
		expect(decode(parsePattern('C0000000', 'single', 'hex'), 'single').value).toBe(-2);
		expect(decode(parsePattern('1', 'single', 'binary'), 'single').kind).toBe('subnormal');
		expect(decode(parsePattern('7FF0000000000000', 'double', 'hex'), 'double').value).toBe(Infinity);
		expect(() => parsePattern('123456789', 'single', 'hex')).toThrow(/8 hex digits/);
		expect(() => parsePattern('12G', 'single', 'hex')).toThrow(/"G"/);
		expect(() => parsePattern('102', 'single', 'binary')).toThrow(/"2"/);
		for (let i = 0; i < 500; i++) {
			const x = (Math.random() - 0.5) * 10 ** Math.floor(Math.random() * 20);
			expect(decode(patternOf(x, 'double'), 'double').value).toBe(x);
			expect(decode(patternOf(x, 'single'), 'single').value).toBe(Math.fround(x));
		}
	});

	test('limits', () => {
		const d = limits('double');
		expect(d.max.value).toBe(Number.MAX_VALUE);
		expect(d.minSubnormal.value).toBe(Number.MIN_VALUE);
		expect(d.minNormal.value).toBe(2 ** -1022);
		expect(d.epsilon.value).toBe(Number.EPSILON);
		expect(d.one.value).toBe(1);
		const s = limits('single');
		expect(s.max.value).toBe(new Float32Array([3.4028234663852886e38])[0]);
		expect(s.minSubnormal.value).toBe(2 ** -149);
		expect(s.epsilon.value).toBe(2 ** -23);
		expect(s.max.shortest).toBe('3.4028235e+38');
	});

	test('helpers', () => {
		expect(exactDecimal(1n, 8n)).toBe('0.125');
		expect(exactDecimal(-3n, 4n)).toBe('-0.75');
		expect(exactDecimal(10n, 1n)).toBe('10');
		expect(shortestDecimal(Math.fround(0.1), 'single')).toBe('0.1');
		expect(shortestDecimal(0.1 + 0.2, 'double')).toBe('0.30000000000000004');
	});
});

test('the IEEE 754 page turns a huge exponent into infinity and a tiny one into zero', async ({ page }) => {
	await page.goto('/ieee-754-converter?v=1e5000');
	await expect(page.locator('.answer.wide .answer-value')).toHaveText('Infinity');
	await expect(page.locator('.error')).toHaveCount(0);
	await page.goto('/ieee-754-converter?v=1e-5000');
	await expect(page.locator('.answer.wide .answer-value')).toHaveText('0');
	await expect(page.locator('.error')).toHaveCount(0);
});
