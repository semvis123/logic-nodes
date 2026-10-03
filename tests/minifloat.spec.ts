// The low-precision float engine, checked three independent ways: every code
// of every format of 16 bits or fewer against a plain formula in doubles (all
// of these values are exact in a double), encoding against a brute-force
// nearest-value search, and FP32 and BF16 against ieee754.ts and the classic
// add-0x7FFF bit trick for rounding FP32 to BF16.

// Results the tests have just computed are known to exist, so `!` is allowed here.
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { expect, test, type Page } from '@playwright/test';
import {
	FORMATS,
	FORMAT_IDS,
	decode,
	encode,
	encodeParsed,
	asParsed,
	parseCode,
	neighbours,
	facts,
	allCodes,
	mxBlock,
	distinctShort,
	roundingSteps,
	MiniFloatError,
	type FormatId
} from '../src/lib/minifloat.js';
import { encode as ieeeEncode, decode as ieeeDecode, exactDecimal } from '../src/lib/ieee754.js';

const SMALL: FormatId[] = ['fp16', 'bf16', 'e4m3', 'e5m2', 'e2m1'];

/**
 * An independent decoder: the textbook formula, evaluated in doubles. Every
 * value of a format of 16 bits or fewer is exact in a double, so equality is exact.
 */
function formulaValue(code: number, id: FormatId): number {
	const f = FORMATS[id];
	const s = Math.floor(code / 2 ** (f.bits - 1));
	const E = Math.floor(code / 2 ** f.mantissaBits) % 2 ** f.exponentBits;
	const M = code % 2 ** f.mantissaBits;
	const topE = 2 ** f.exponentBits - 1;
	const sign = s ? -1 : 1;
	if (E === topE && f.specials === 'ieee') return M === 0 ? sign * Infinity : NaN;
	if (E === topE && f.specials === 'fn' && M === 2 ** f.mantissaBits - 1) return NaN;
	if (E === 0) return sign * Math.pow(2, 1 - f.bias) * (M / 2 ** f.mantissaBits);
	return sign * Math.pow(2, E - f.bias) * (1 + M / 2 ** f.mantissaBits);
}

/**
 * A small seeded generator (mulberry32), so a failure in the random tests
 * repeats: the seed is printed, and SEED=<n> reruns with it.
 */
const SEED = Number(process.env.SEED) || Math.floor(Math.random() * 2 ** 32);
console.log(`minifloat random tests: SEED=${SEED}`);
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const same = (a: number, b: number) => Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b));

/** The finite values of a format with their codes, sorted by value, for brute-force rounding. */
const tables = new Map<FormatId, { code: number; v: number }[]>();
function finiteTable(id: FormatId) {
	const cached = tables.get(id);
	if (cached) return cached;
	const table = allCodes(id)
		.filter((d) => d.kind !== 'nan' && d.kind !== 'infinity')
		.map((d) => ({ code: d.code, v: d.number }));
	tables.set(id, table);
	return table;
}

/**
 * Round-to-nearest-even by brute force over a format's positive values, in
 * doubles. x must be exactly representable in a double and positive; the
 * midpoints of these formats are too, so ties are seen exactly.
 */
function bruteRound(x: number, id: FormatId): { code: number; overflow: boolean } {
	const f = FORMATS[id];
	const pos = finiteTable(id).filter((t) => t.code < 2 ** (f.bits - 1));
	const max = pos[pos.length - 1];
	// The would-be next value above the largest one, one step of the top binade further.
	const ulpTop = Math.pow(2, Math.floor(Math.log2(max.v)) - f.mantissaBits);
	const threshold = max.v + ulpTop / 2;
	// Halfway to the next step counts as overflow only when the largest code's mantissa is odd (ties to even).
	if (x > threshold || (x === threshold && max.code % 2 === 1)) return { code: -1, overflow: true };
	// Binary search for the first value at or above x, then compare it with the one below.
	let lo = 0;
	let hi = pos.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (pos[mid].v < x) lo = mid + 1;
		else hi = mid;
	}
	const above = pos[lo];
	if (above.v < x) return { code: above.code, overflow: false }; // between max and the threshold
	const below = pos[Math.max(0, lo - 1)];
	const da = above.v - x;
	const db = x - below.v;
	if (da < db) return { code: above.code, overflow: false };
	if (db < da) return { code: below.code, overflow: false };
	return { code: above.code % 2 === 0 ? above.code : below.code, overflow: false };
}

test.describe('minifloat engine', () => {
	// The exhaustive loops collect mismatches and assert once: an expect() per
	// code would make these take minutes.
	test('decoding every code of every format of 16 bits or fewer matches the formula', () => {
		const bad: string[] = [];
		let checked = 0;
		for (const id of SMALL) {
			const f = FORMATS[id];
			for (let c = 0; c < 2 ** f.bits; c++) {
				const d = decode(c, id);
				const expected = formulaValue(c, id);
				checked++;
				if (!same(d.number, expected)) bad.push(`${id} ${d.hex}: ${d.number} vs ${expected}`);
				if (Number.isFinite(expected)) {
					if (!same(Number(d.exact), expected)) bad.push(`${id} ${d.hex} exact ${d.exact}`);
					if (Number(d.value!.num) / Number(d.value!.den) !== expected) bad.push(`${id} ${d.hex} rational`);
				}
				if (d.bits !== c.toString(2).padStart(f.bits, '0')) bad.push(`${id} ${c} bits`);
				if (String(d.sign) + d.exponentBits + d.mantissaBits !== d.bits) bad.push(`${id} ${c} fields`);
				if (parseInt(d.hex, 16) !== c) bad.push(`${id} ${c} hex`);
			}
		}
		expect(bad.slice(0, 10)).toEqual([]);
		expect(checked).toBe(2 * 65536 + 2 * 256 + 16);
	});

	test('encode(decode(code)) is the code for every non-NaN code, both zeros included', () => {
		const bad: string[] = [];
		for (const id of SMALL) {
			for (const d of allCodes(id)) {
				if (d.kind === 'nan') continue;
				const e = encode(d.exact, id);
				if (e.result?.code !== d.code) bad.push(`${id} ${d.hex} from ${d.exact} gave ${e.result?.hex}`);
				if (e.rounded !== (d.kind === 'infinity' ? 'special' : 'exact')) bad.push(`${id} ${d.hex} ${e.rounded}`);
			}
		}
		expect(bad.slice(0, 10)).toEqual([]);
	});

	test('positive codes increase in value with the code, and negatives mirror them', () => {
		const bad: string[] = [];
		for (const id of SMALL) {
			const f = FORMATS[id];
			const half = 2 ** (f.bits - 1);
			let previous = -Infinity;
			for (let c = 0; c < half; c++) {
				const d = decode(c, id);
				if (d.kind === 'nan') continue;
				if (!(d.number > previous)) bad.push(`${id} ${d.hex} not above the code before`);
				previous = d.number;
				const neg = decode(c + half, id);
				if (!same(neg.number, -d.number)) bad.push(`${id} ${neg.hex} does not mirror`);
			}
		}
		expect(bad.slice(0, 10)).toEqual([]);
	});

	test('the known values', () => {
		const fp16 = facts('fp16');
		expect(fp16.max.exact).toBe('65504');
		expect(fp16.max.hex).toBe('7BFF');
		expect(fp16.minNormal.number).toBe(2 ** -14);
		expect(fp16.minSubnormal.number).toBe(2 ** -24);
		expect(decode(0x3c00, 'fp16').exact).toBe('1');
		expect(encode('1', 'fp16').result!.hex).toBe('3C00');
		expect(encode('-2', 'fp16').result!.hex).toBe('C000');
		expect(encode('65504', 'fp16').result!.hex).toBe('7BFF');
		expect(encode('0.1', 'fp16').result!.hex).toBe('2E66');
		expect(decode(0x7c00, 'fp16').kind).toBe('infinity');
		expect(decode(0x7e00, 'fp16').kind).toBe('nan');
		expect(encode('1', 'bf16').result!.hex).toBe('3F80');
		expect(encode('3.14159', 'bf16').result!.hex).toBe('4049');
		expect(facts('bf16').max.number).toBe(3.3895313892515355e38);
		expect(facts('e4m3').max.exact).toBe('448');
		expect(facts('e4m3').max.hex).toBe('7E');
		expect(decode(0x7f, 'e4m3').kind).toBe('nan');
		expect(decode(0xff, 'e4m3').kind).toBe('nan');
		expect(decode(0x78, 'e4m3').exact).toBe('256'); // top exponent holds numbers in E4M3
		expect(facts('e4m3').minNormal.number).toBe(2 ** -6);
		expect(facts('e4m3').minSubnormal.number).toBe(2 ** -9);
		expect(facts('e4m3').nanCount).toBe(2);
		expect(facts('e5m2').max.exact).toBe('57344');
		expect(decode(0x7c, 'e5m2').kind).toBe('infinity');
		expect(facts('e5m2').minSubnormal.number).toBe(2 ** -16);
		expect(facts('e5m2').nanCount).toBe(6);
		const fp4 = allCodes('e2m1')
			.filter((d) => d.sign === 0)
			.map((d) => d.exact);
		expect(fp4).toEqual(['0', '0.5', '1', '1.5', '2', '3', '4', '6']);
		expect(facts('e2m1').nanCount).toBe(0);
		expect(facts('e2m1').finiteCount).toBe(16);
		expect(facts('fp32').max.number).toBe(3.4028234663852886e38);
		expect(facts('fp16').decimalDigits).toBeCloseTo(3.311, 3);
	});

	test('encoding matches a brute-force nearest-value search', () => {
		const bad: string[] = [];
		const random = mulberry32(SEED);
		for (const id of ['e4m3', 'e5m2', 'e2m1', 'fp16', 'bf16'] as const) {
			const pos = finiteTable(id).filter((t) => t.code < 2 ** (FORMATS[id].bits - 1));
			const max = pos[pos.length - 1].v;
			for (let i = 0; i < 1500; i++) {
				// Random doubles across and beyond the range, plus exact values nudged a little.
				const x =
					i % 3 === 0
						? random() * max * 1.2
						: i % 3 === 1
						? Math.pow(2, random() * Math.log2(max) * 2.2 - Math.log2(max) * 1.1)
						: pos[Math.floor(random() * pos.length)].v * (1 + (random() - 0.5) * 0.1);
				const text = exactDecimal(...rationalOf(x));
				const want = bruteRound(x, id);
				const got = encode(text, id, 'nan');
				if (want.overflow !== (got.overflow !== null)) bad.push(`${id} ${text}: overflow ${got.overflow}`);
				else if (!want.overflow && got.result!.code !== want.code)
					bad.push(`${id} ${text}: ${got.result!.hex}, want ${want.code.toString(16)}`);
			}
		}
		expect(bad.slice(0, 10), `SEED=${SEED}`).toEqual([]);
	});

	test('every midpoint between neighbours rounds to the even code, and a hair off it does not', () => {
		const bad: string[] = [];
		let ties = 0;
		for (const id of SMALL) {
			const f = FORMATS[id];
			const half = 2 ** (f.bits - 1);
			const pos = allCodes(id).filter((d) => d.code < half && d.value);
			for (let i = 0; i + 1 < pos.length; i++) {
				const a = pos[i].value!;
				const b = pos[i + 1].value!;
				// (a + b) / 2 over a common power-of-two denominator.
				const num = a.num * b.den + b.num * a.den;
				const den = a.den * b.den * 2n;
				const mid = exactDecimal(num, den);
				const even = pos[i].code % 2 === 0 ? pos[i] : pos[i + 1];
				const e = encode(mid, id);
				ties++;
				if (e.result!.code !== even.code) bad.push(`${id} midpoint ${mid} gave ${e.result!.hex}`);
				if (!e.steps!.tie) bad.push(`${id} midpoint ${mid} not seen as a tie`);
				// Just above and below the midpoint, the nearer value wins.
				const tiny = den * 1024n;
				if (encode(exactDecimal(num * 1024n + 1n, tiny), id).result!.code !== pos[i + 1].code)
					bad.push(`${id} just above ${mid}`);
				if (encode(exactDecimal(num * 1024n - 1n, tiny), id).result!.code !== pos[i].code)
					bad.push(`${id} just below ${mid}`);
				// Negative midpoints mirror.
				if (encode('-' + mid, id).result!.code !== even.code + half) bad.push(`${id} -${mid}`);
			}
		}
		expect(bad.slice(0, 10)).toEqual([]);
		expect(ties).toBeGreaterThan(60000);
	});

	test('overflow: IEEE formats go to infinity, E4M3 saturates or gives NaN, FP4 saturates', () => {
		expect(encode('65519.99', 'fp16').result!.hex).toBe('7BFF');
		expect(encode('65520', 'fp16').result!.kind).toBe('infinity'); // the tie goes to even, which is infinity
		expect(encode('65520', 'fp16').overflow).toBe('infinity');
		expect(encode('-1e6', 'fp16').result!.exact).toBe('-Infinity');
		// E4M3: 464 is halfway between 448 and the unrepresentable 480; ties to even keeps 448.
		expect(encode('464', 'e4m3', 'nan').result!.exact).toBe('448');
		expect(encode('464', 'e4m3', 'nan').overflow).toBeNull();
		expect(encode('464.001', 'e4m3', 'nan').result!.kind).toBe('nan');
		expect(encode('464.001', 'e4m3', 'nan').overflow).toBe('nan');
		expect(encode('1000', 'e4m3', 'saturate').result!.exact).toBe('448');
		expect(encode('1000', 'e4m3', 'saturate').overflow).toBe('saturated');
		expect(encode('1000', 'e4m3', 'saturate').rounded).toBe('down');
		expect(encode('-1000', 'e4m3', 'saturate').result!.exact).toBe('-448');
		expect(encode('Infinity', 'e4m3', 'saturate').result!.exact).toBe('448');
		expect(encode('Infinity', 'e4m3', 'nan').result!.kind).toBe('nan');
		expect(encode('NaN', 'e4m3').result!.hex).toBe('7F');
		expect(encode('61440', 'e5m2').result!.kind).toBe('infinity');
		expect(encode('61439', 'e5m2').result!.exact).toBe('57344');
		expect(encode('7', 'e2m1').result!.exact).toBe('6');
		expect(encode('100', 'e2m1', 'nan').result!.exact).toBe('6');
		expect(encode('100', 'e2m1').overflow).toBe('saturated');
		expect(encode('NaN', 'e2m1').result).toBeNull();
		expect(encode('NaN', 'e2m1').note).toContain('no NaN');
		expect(encode('NaN', 'fp16').result!.hex).toBe('7E00');
		expect(encode('1e999', 'fp32').result!.exact).toBe('Infinity');
		expect(encode('1e999', 'e4m3').result!.exact).toBe('448');
	});

	test('underflow, zeros and signs', () => {
		expect(encode('1e-999', 'fp16').result!.exact).toBe('0');
		expect(encode('1e-999', 'fp16').underflowed).toBe(true);
		expect(encode('-1e-999', 'fp16').result!.exact).toBe('-0');
		expect(encode('0.25', 'e2m1').result!.exact).toBe('0'); // tie between 0 and 0.5: 0 is even
		expect(encode('0.25', 'e2m1').underflowed).toBe(true);
		expect(encode('0.2500001', 'e2m1').result!.exact).toBe('0.5');
		expect(encode('-0', 'e4m3').result!.hex).toBe('80');
		expect(encode('0', 'e4m3').result!.hex).toBe('00');
		expect(encode('2.99e-8', 'fp16').result!.exact).toBe(decode(1, 'fp16').exact); // just above half the smallest subnormal
		expect(encode('2.99e-8', 'fp16').steps!.subnormal).toBe(true);
	});

	test('FP32 agrees with ieee754.ts, and BF16 with rounding the FP32 bits', () => {
		const random = mulberry32(SEED + 1);
		const randomDecimal = () => {
			const digits = String(Math.floor(random() * 1e9));
			const e = Math.floor(random() * 90) - 50;
			return `${random() < 0.5 ? '-' : ''}${digits[0]}.${digits.slice(1)}e${e}`;
		};
		for (let i = 0; i < 400; i++) {
			const t = randomDecimal();
			const ours = encode(t, 'fp32').result!;
			const theirs = ieeeEncode(t, 'single');
			expect(ours.hex, `${t} SEED=${SEED}`).toBe(theirs.hex);
			expect(ours.exact, `${t} SEED=${SEED}`).toBe(theirs.exact);
		}
		const bad: string[] = [];
		for (let i = 0; i < 2000; i++) {
			const code32 = Math.floor(random() * 2 ** 32);
			const fp32 = ieeeDecode(BigInt(code32), 'single');
			if (fp32.kind === 'nan') continue;
			// Round to nearest even on the bits: add 0x7FFF plus the lowest kept bit, keep the top half.
			const lsb = Math.floor(code32 / 65536) % 2;
			const expected = Math.floor((code32 + 0x7fff + lsb) / 65536);
			const text = fp32.kind === 'zero' ? (fp32.sign ? '-0' : '0') : fp32.exact;
			const got = encode(text, 'bf16').result!.code;
			if (got !== expected) bad.push(`${fp32.hex} = ${text}: ${got.toString(16)}`);
		}
		// BF16 is exactly the top half of FP32 for values BF16 can hold.
		for (const d of allCodes('bf16')) {
			if (d.kind === 'nan') continue;
			const got = encode(d.exact, 'fp32').result!.hex;
			if (got !== d.hex + '0000') bad.push(`${d.hex} as FP32 is ${got}`);
		}
		expect(bad.slice(0, 10), `SEED=${SEED}`).toEqual([]);
	});

	test('converting a decoded value to another format goes through its exact value', () => {
		const one = decode(0x3c00, 'fp16');
		expect(encodeParsed(asParsed(one), 'bf16').result!.hex).toBe('3F80');
		expect(encodeParsed(asParsed(decode(0x7c00, 'fp16')), 'e4m3', 'nan').result!.kind).toBe('nan');
		expect(encodeParsed(asParsed(decode(0x8000, 'fp16')), 'e2m1').result!.hex).toBe('8');
		expect(encodeParsed(asParsed(decode(0x7bff, 'fp16')), 'e5m2').result!.kind).toBe('infinity'); // 65504 > 61440
	});

	test('guard, round and sticky bits', () => {
		// 1.0625 in E4M3 is 1.0001: kept 1.000, guard 1, round 0, sticky 0: a tie, kept even.
		const s = roundingSteps({ num: 17n, den: 16n }, 'e4m3');
		expect(s.keptText).toBe('1.000');
		expect([s.guard, s.round, s.sticky]).toEqual([1, 0, 0]);
		expect(s.tie).toBe(true);
		expect(s.roundUp).toBe(false);
		// 1.1875 = 1.0011: kept 1.001 (odd), guard 1: a tie, rounds up to 1.010.
		const t = roundingSteps({ num: 19n, den: 16n }, 'e4m3');
		expect(t.keptText).toBe('1.001');
		expect(t.roundUp).toBe(true);
		// 0.1 never ends, so sticky is set; but its guard bit is 0, so it rounds toward zero.
		const u = roundingSteps({ num: 1n, den: 10n }, 'fp16');
		expect(u.sticky).toBe(1);
		expect(u.guard).toBe(0);
		expect(u.e).toBe(-4);
		expect(u.reason).toContain('rounds down');
		// The page's "sticky decides" example: 1.0703125 = 1.0001001, kept 1.000, G 1, R 0, S 1.
		const st = encode('1.0703125', 'e4m3');
		expect([st.steps!.keptText, st.steps!.guard, st.steps!.round, st.steps!.sticky]).toEqual(['1.000', 1, 0, 1]);
		expect(st.steps!.roundUp).toBe(true);
		expect(st.result!.exact).toBe('1.125');
		expect(st.steps!.reason).toContain('sticky is 1');
		// The page's two ties.
		expect(encode('1.0625', 'e4m3').steps!.tie).toBe(true);
		expect(encode('1.1875', 'e4m3').steps!.tie).toBe(true);
		// For a negative number the words follow the number, not its magnitude:
		// dropping bits of -0.1 moves it up, toward zero, as the card's error says.
		const neg = encode('-0.1', 'fp16');
		expect(neg.rounded).toBe('up');
		expect(neg.steps!.reason).toContain('up, toward zero');
		expect(encode('-1.0703125', 'e4m3').steps!.reason).toContain('down, away from zero');
		expect(encode('-1.1875', 'e4m3').steps!.reason).toContain(
			'so round to the even pattern, which is down, away from zero.'
		);
		expect(encode('1.1875', 'e4m3').steps!.reason).toContain('so round to the even pattern, which is up.');
		// Nothing to round: no talk of truncating.
		expect(encode('1', 'fp16').steps!.reason).toContain('stored exactly');
	});

	test('short forms of neighbours stay distinct', () => {
		const one = encode('0.1', 'fp32').result!;
		const n = neighbours(one);
		const texts = distinctShort([n.below!, one, n.above!]);
		expect(texts).toEqual(['0.099999994', '0.1', '0.10000001']);
		expect(distinctShort([decode(0x3bff, 'fp16'), decode(0x3c00, 'fp16')])).toEqual(['0.99951', '1']);
	});

	test('neighbours step across zero and stop at the largest finite value', () => {
		const n = neighbours(decode(0x3c00, 'fp16'));
		expect(n.below!.hex).toBe('3BFF');
		expect(n.above!.hex).toBe('3C01');
		expect(neighbours(decode(0x7bff, 'fp16')).above).toBeNull();
		expect(neighbours(decode(0x0000, 'fp16')).above!.hex).toBe('0001');
		expect(neighbours(decode(0x0000, 'fp16')).below!.hex).toBe('8001');
		expect(neighbours(decode(0x8001, 'fp16')).above!.hex).toBe('0000');
		expect(neighbours(decode(0xfbff, 'fp16')).below).toBeNull();
		expect(neighbours(decode(0x7e, 'e4m3')).above).toBeNull();
		expect(neighbours(decode(0x7d, 'e4m3')).above!.exact).toBe('448');
		expect(neighbours(decode(0xe, 'e2m1')).below!.exact).toBe('-6');
		expect(neighbours(decode(0x7f800000 - 1, 'fp32')).above).toBeNull();
	});

	test('parsing bit patterns and bad input', () => {
		expect(parseCode('0x3C00', 'fp16', 'hex')).toBe(0x3c00);
		expect(parseCode('3c00', 'fp16', 'hex')).toBe(0x3c00);
		expect(parseCode('0 1111 110', 'e4m3', 'binary')).toBe(0x7e);
		expect(parseCode('0.1111.110', 'e4m3', 'binary')).toBe(0x7e);
		expect(parseCode('7', 'e2m1', 'hex')).toBe(7);
		expect(() => parseCode('10', 'e2m1', 'hex')).toThrow(MiniFloatError);
		expect(() => parseCode('1FF', 'e4m3', 'hex')).toThrow(/largest code is FF/);
		expect(() => parseCode('3G00', 'fp16', 'hex')).toThrow(/"G" is not a hex digit/);
		expect(() => parseCode('012', 'fp16', 'binary')).toThrow(/"2" is not a bit/);
		expect(() => parseCode('', 'fp16', 'hex')).toThrow(/Type a bit pattern/);
		expect(() => encode('abc', 'fp16')).toThrow(/^"abc" is not a decimal number$/);
		// Long junk is quoted only in part, so the error stays one short line.
		expect(() => encode('x' + 'y'.repeat(300), 'fp16')).toThrow(/^"xyyyyyyyyyyyyyyyyyyy…" is not a decimal number$/);
		expect(() => encode('', 'fp16')).toThrow(/Type a number/);
		expect(() => encode('1.2.3', 'fp16')).toThrow(MiniFloatError);
		expect(encode('  +1_000 ', 'fp16').result!.exact).toBe('1000');
		expect(encode('+5', 'fp16').input).toBe('5');
		expect(() => encode('+-5', 'fp16')).toThrow(/not a decimal number/);
		expect(() => encode('--5', 'fp16')).toThrow(/not a decimal number/);
		// A comma is a thousands separator only between groups of three digits; a decimal comma is an error.
		expect(encode('1,000', 'fp16').result!.exact).toBe('1000');
		expect(encode('12,345.5', 'fp32').result!.exact).toBe('12345.5');
		expect(() => encode('0,1', 'fp16')).toThrow(/Use a point for the decimal: 0\.1/);
		expect(() => encode('1,5', 'fp16')).toThrow(/Use a point/);
		expect(() => encode('2,5e-3', 'fp16')).toThrow(/Use a point/);
		expect(() => encode('1,00', 'fp16')).toThrow(/Use a point/);
		expect(() => encode('1,0000', 'fp16')).toThrow(/Use a point/);
		expect(encode('−2.5', 'fp16').result!.exact).toBe('-2.5');
		expect(encode('inf', 'bf16').result!.hex).toBe('7F80');
		expect(encode('-Infinity', 'e5m2').result!.hex).toBe('FC');
		expect(() => decode(256, 'e4m3')).toThrow(MiniFloatError);
	});

	test('hostile decimals are answered at once', () => {
		const start = Date.now();
		for (const t of ['0e999999999', '0e-999999999', '-0e999999999999', '0.000e300000000', '0e' + '9'.repeat(398)]) {
			const e = encode(t, 'fp16');
			expect(e.result!.kind, t).toBe('zero');
			expect(e.result!.sign, t).toBe(t.startsWith('-') ? 1 : 0);
		}
		expect(encode('1e' + '9'.repeat(398), 'fp16').result!.exact).toBe('Infinity');
		expect(encode('1e-' + '9'.repeat(397), 'fp16').result!.exact).toBe('0');
		expect(encode('1' + '0'.repeat(380) + 'e-999999999', 'e4m3').underflowed).toBe(true);
		expect(Date.now() - start).toBeLessThan(500);
	});

	test('a number far beyond every range still shows its error when clamped', () => {
		for (const t of ['1e400', '1e401', '1e999']) {
			const e = encode(t, 'e4m3', 'saturate');
			expect(e.result!.exact).toBe('448');
			expect(e.errorShort).toBe(`-${t}`);
			expect(e.relativeShort).toBe('1');
		}
		expect(encode('-123456e500', 'e2m1').errorShort).toBe('1.235e505');
		expect(encode('99999e500', 'e2m1').errorShort).toBe('-1e505');
		// Infinity and NaN have no error to show.
		expect(encode('1e999', 'fp16').errorShort).toBeNull();
		expect(encode('1e999', 'e4m3', 'nan').errorShort).toBeNull();
	});

	test('errors are exact and relative errors sensible', () => {
		const e = encode('0.1', 'e4m3');
		expect(e.result!.exact).toBe('0.1015625');
		expect(e.error).toBe('0.0015625');
		expect(e.relativeShort).toBe('0.01563');
		expect(e.errorShort).toBe('0.0015625');
		// Short errors stay exact rather than being rounded to four figures.
		expect(encode('70000', 'e2m1').errorShort).toBe('-69994');
		expect(encode('0.1', 'fp32').errorShort).toBe('1.49e-9');
		expect(e.rounded).toBe('up');
		const z = encode('0.1', 'e2m1');
		expect(z.result!.exact).toBe('0');
		expect(z.relativeShort).toBe('1');
		expect(z.underflowed).toBe(true);
		for (const id of FORMAT_IDS) expect(encode('1', id).rounded).toBe('exact');
	});

	test('an MXFP4 block shares one power-of-two scale', () => {
		const b = mxBlock(['0.3', '-1.2', '2.5', '0.05']);
		// Largest magnitude 2.5: floor(log2 2.5) = 1, minus E2M1's top exponent 2, gives a scale of 2^-1.
		expect(b.scaleExp).toBe(-1);
		expect(b.scaleCode).toBe(126);
		expect(b.elements.map((e) => e.scaled)).toEqual(['0.6', '-2.4', '5', '0.1']);
		expect(b.elements.map((e) => e.code.exact)).toEqual(['0.5', '-2', '4', '0']);
		expect(b.elements.map((e) => e.restored)).toEqual(['0.25', '-1', '2', '0']);
		// 7 / 2^0 = 7 is above 6, so it is clamped.
		const c = mxBlock(['7', '1']);
		expect(c.scaleExp).toBe(0);
		expect(c.elements[0].saturated).toBe(true);
		expect(c.elements[0].code.exact).toBe('6');
	});
});

/** A double as an exact fraction num/den with den a power of two. */
function rationalOf(x: number): [bigint, bigint] {
	let den = 1n;
	let v = x;
	while (!Number.isInteger(v)) {
		v *= 2;
		den *= 2n;
	}
	return [BigInt(v), den];
}

test.describe('the fp16-bf16-fp8-converter page', () => {
	const card = (page: Page, name: string) =>
		page.locator('.fmt-card', { has: page.locator('h3', { hasText: new RegExp(`^${name}$`) }) });

	test.describe('as prerendered, without JavaScript', () => {
		test.use({ javaScriptEnabled: false });
		test('ships 0.1 already converted, in each format card', async ({ page }) => {
			await page.goto('/fp16-bf16-fp8-converter');
			for (const id of FORMAT_IDS) {
				const e = encode('0.1', id);
				const c = card(page, FORMATS[id].name);
				await expect(c.locator('.facts dd').first()).toContainText(e.result!.hex);
				await expect(c.locator('.stored')).toHaveText(e.result!.exact);
			}
			await expect(card(page, 'FP4 E2M1').locator('.stored')).toHaveText('0');
			await expect(card(page, 'FP4 E2M1')).toContainText('too small: rounded down to zero');
			await expect(card(page, 'FP16')).toContainText('(0.0244% relative)');
			await expect(card(page, 'FP32')).toContainText('(1.49e−6% relative)');
			await expect(page.locator('.answer-label')).toHaveText('FP16 stores');
			await expect(page.locator('.answer-value')).toHaveText('0.0999755859375');
			await expect(page.locator('.steps-box summary')).toContainText('How 0.1 rounds to FP16');
		});
	});

	test('typing converts, the overflow choice applies to E4M3, and bits read back', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter');
		await page.waitForLoadState('networkidle');
		await page.locator('#value').fill('70000');
		await expect(card(page, 'FP16').locator('.stored')).toHaveText('Infinity');
		await expect(card(page, 'BF16').locator('.stored')).toHaveText('70144');
		await expect(card(page, 'FP8 E4M3').locator('.stored')).toHaveText('448');
		await expect(card(page, 'FP4 E2M1').locator('.stored')).toHaveText('6');
		await expect(card(page, 'FP4 E2M1')).toContainText('(99.99% relative)');
		await expect(page.locator('.answer-value')).toHaveText('Infinity');
		await page.getByRole('button', { name: 'Become NaN' }).click();
		await expect(card(page, 'FP8 E4M3').locator('.stored')).toHaveText('NaN');
		await expect(page).toHaveURL(/of=nan/);

		await page.getByRole('button', { name: 'Hex bits' }).click();
		await page.getByRole('button', { name: 'FP8 E4M3', exact: true }).click();
		await page.locator('#value').fill('7E');
		await expect(page.locator('.answer-value')).toHaveText('448');
		await page.locator('#value').fill('7G');
		await expect(page.locator('.error')).toContainText('"G" is not a hex digit');
		await page.locator('#value').fill('3C');
		await expect(page.locator('.error')).toHaveText('');
		// Flipping the sign bit makes it negative.
		await page.getByRole('button', { name: /^Sign bit/ }).click();
		await expect(page.locator('#value')).toHaveValue('BC');
		await expect(page.locator('.answer-value')).toHaveText('−1.5');
	});

	test('a negative value is worked through with matching words and sign', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter?v=-0.1');
		await expect(card(page, 'FP16')).toContainText('rounded up');
		const steps = page.locator('.steps-box');
		await expect(steps).toContainText('rounds up, toward zero');
		await expect(steps).toContainText('−1.1001100110 × 2⁻⁴ = −0.0999755859375');
	});

	test('invalid input keeps the layout still and takes the stale results out of the tab order', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter');
		await page.waitForLoadState('networkidle');
		// Measured from the top of the document, since tabbing may scroll.
		const top = () => page.locator('.results').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
		const before = await top();
		await page.locator('#value').fill('0,1');
		await expect(page.locator('.error')).toContainText('Use a point for the decimal: 0.1');
		expect(await top()).toBe(before);
		await expect(page.locator('.results')).toHaveAttribute('inert', /.*/);
		// Tabbing from the input skips everything in the results.
		await page.locator('#value').focus();
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press('Tab');
			expect(await page.evaluate(() => !!document.activeElement?.closest('.results'))).toBe(false);
		}
		await page.locator('#value').fill('0.1');
		await expect(page.locator('.results')).not.toHaveAttribute('inert', /.*/);
		expect(await top()).toBe(before);
	});

	test('copying says Copied on the button', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto('/fp16-bf16-fp8-converter');
		await page.waitForLoadState('networkidle');
		const button = card(page, 'FP32').getByRole('button', { name: /^Copy FP32/ });
		await button.click();
		await expect(button).toHaveText('Copied');
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('3DCCCCCD');
		await expect(card(page, 'FP16').getByRole('button', { name: /^Copy FP16/ })).toHaveText('Copy');
	});

	test('switching to bits when the format has no code for the value picks one that has', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter?v=NaN&fmt=e2m1');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Hex bits' }).click();
		await expect(page.locator('#value')).toHaveValue('7E00');
		await expect(page.locator('.fmt-card.current h3')).toHaveText('FP16');
		await expect(page.locator('.error')).toHaveText('');
	});

	for (const width of [390, 1280]) {
		test(`long values do not push the page sideways at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			const fits = async () =>
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
			await page.goto(`/fp16-bf16-fp8-converter?v=${'1'.repeat(300)}`);
			await expect(page.locator('#value')).toHaveValue('1'.repeat(300));
			await fits();
			await page.goto('/fp16-bf16-fp8-converter?v=x' + 'y'.repeat(300));
			await expect(page.locator('.error')).toContainText('is not a decimal number');
			await fits();
			// The smallest FP32 subnormal, read as bits and then shown as its 151-character exact decimal.
			await page.goto('/fp16-bf16-fp8-converter?v=00000001&mode=hex&fmt=fp32');
			await page.waitForLoadState('networkidle');
			await page.getByRole('button', { name: 'Decimal' }).click();
			await expect(page.locator('.steps-box summary')).toContainText('rounds to FP32');
			await fits();
		});
	}

	test('a shared link reopens the same state', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'BF16', exact: true }).click();
		await page.locator('#value').fill('3.14159');
		await expect(page).toHaveURL(/v=3\.14159/);
		await expect(page).toHaveURL(/fmt=bf16/);
		const url = page.url();
		await page.goto(url);
		await expect(page.locator('#value')).toHaveValue('3.14159');
		await expect(page.locator('.fmt-card.current h3')).toHaveText('BF16');
		await expect(page.locator('.steps-box summary')).toContainText('rounds to BF16');
		await page.goto('/fp16-bf16-fp8-converter?v=3C00&mode=hex&fmt=fp16');
		await expect(page.locator('.answer-value')).toHaveText('1');
		await page.goto('/fp16-bf16-fp8-converter?v=1&fmt=bogus&mode=nope');
		await expect(page.locator('.fmt-card.current h3')).toHaveText('FP16');
	});

	test('rejected query values are cleared from the address bar', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter?fmt=bogus&mode=nope&of=x');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.fmt-card.current h3')).toHaveText('FP16');
		expect(await page.evaluate(() => location.search)).toBe('');
	});

	test('Back and Forward keep the value in the link', async ({ page }) => {
		await page.goto('/tools');
		await page.waitForLoadState('networkidle');
		await page.locator('a[href="/fp16-bf16-fp8-converter"]').first().click();
		await page.waitForURL(/\/fp16-bf16-fp8-converter$/);
		await page.waitForLoadState('networkidle');
		await page.locator('#value').fill('2.5');
		await expect(page).toHaveURL(/v=2\.5/);
		await page.goBack();
		await page.waitForURL(/\/tools$/);
		await page.goForward();
		await page.waitForURL(/fp16-bf16-fp8-converter/);
		await expect(page.locator('#value')).toHaveValue('2.5');
		await expect(page).toHaveURL(/v=2\.5/);
	});

	test('an error is described on the field and announced only once typing pauses', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter');
		await page.waitForLoadState('networkidle');
		const field = page.locator('#value');
		await expect(field).toHaveAttribute('aria-describedby', 'value-help');
		await field.fill('0,1');
		await expect(field).toHaveAttribute('aria-describedby', 'value-help value-error');
		await expect(page.locator('#value-error')).toContainText('Use a point');
		await expect(page.locator('[role="alert"]')).toContainText('Use a point');
		await field.fill('0.5');
		await expect(page.locator('[role="alert"]')).toHaveCount(0);
		await expect(page.locator('[role="status"]').first()).toHaveText('FP16 stores 0.5');
	});

	test('FAQ JSON-LD matches the visible answers', async ({ page }) => {
		await page.goto('/fp16-bf16-fp8-converter');
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) || '{}');
		const faq = ld['@graph'].find((n: { mainEntity?: unknown }) => n.mainEntity);
		const visible = await page.locator('.faq details p').allTextContents();
		expect(faq.mainEntity.map((q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text)).toEqual(
			visible.map((t) => t.trim())
		);
	});
});
