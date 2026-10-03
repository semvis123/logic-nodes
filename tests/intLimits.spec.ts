// Integer limits, checked against the language's own constants and against
// formulas written a different way, and the overflow playground checked
// exhaustively against plain modular arithmetic.

import { expect, test } from '@playwright/test';
import {
	intTypes,
	intTypeBySlug,
	intSlugs,
	formulas,
	namesFor,
	languages,
	wrap,
	fits,
	applyOp,
	parseInteger,
	bitsNeeded,
	lookup,
	unixRollover,
	storiesFor,
	jsWrapExample,
	typeTitle,
	typeDescription,
	typeFaqs,
	overflowAnswer,
	describedLanguages,
	mistakesFor,
	jsNumberFit,
	binaryOf,
	hexOf,
	formatDecimal,
	int64UnixBillionYears,
	daysToOverflow,
	IntLimitsError,
	scientific,
	digitCount,
	usesOf,
	type IntType,
	type Op
} from '../src/lib/intLimits.js';

const T = (slug: string) => intTypeBySlug(slug) as IntType;

/** A seeded generator (mulberry32), so a failing random case can be replayed. */
function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let x = Math.imul(a ^ (a >>> 15), 1 | a);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/** A uniformly random value of the type, from 32-bit chunks of a seeded generator. */
function randomIn(t: IntType, rand: () => number): bigint {
	let u = 0n;
	for (let i = 0; i < t.bits / 32 || i < 1; i++) u = (u << 32n) | BigInt(Math.floor(rand() * 2 ** 32));
	return BigInt.asUintN(t.bits, u) + t.min;
}

/** A second way to the limits: build the bit patterns as strings and parse them. */
function referenceLimits(bits: number, signed: boolean): { min: bigint; max: bigint } {
	if (!signed) return { min: 0n, max: BigInt('0b' + '1'.repeat(bits)) };
	return { min: -BigInt('0b1' + '0'.repeat(bits - 1)), max: BigInt('0b0' + '1'.repeat(bits - 1)) };
}

/** Wrapping the slow way: add or subtract the modulus until the value is in range. */
function referenceWrap(n: bigint, min: bigint, max: bigint): bigint {
	const m = max - min + 1n;
	let r = n;
	while (r > max) r -= m;
	while (r < min) r += m;
	return r;
}

test.describe('integer limits', () => {
	test('ten types, every width signed and unsigned', () => {
		expect(intTypes.map((t) => t.slug)).toEqual([...intSlugs]);
		expect(intTypes).toHaveLength(10);
		for (const t of intTypes) {
			expect(t.slug).toBe(`${t.signed ? '' : 'u'}int${t.bits}`);
		}
	});

	test('limits agree with an independent bit-string construction', () => {
		for (const t of intTypes) {
			const ref = referenceLimits(t.bits, t.signed);
			expect(t.min).toBe(ref.min);
			expect(t.max).toBe(ref.max);
			expect(t.max - t.min + 1n).toBe(t.count);
			expect(t.count).toBe(2n ** BigInt(t.bits));
		}
	});

	test('limits match the constants JavaScript itself knows', () => {
		// Typed arrays carry their own element width; filling one with all ones
		// and reading it back gives the extremes of that type.
		const pairs: [string, number | bigint, number | bigint][] = [
			['int8', new Int8Array([0x80])[0], new Int8Array([0x7f])[0]],
			['uint8', new Uint8Array([0])[0], new Uint8Array([-1])[0]],
			['int16', new Int16Array([0x8000])[0], new Int16Array([0x7fff])[0]],
			['uint16', 0, new Uint16Array([-1])[0]],
			['int32', -1 << 31, ~(-1 << 31)],
			['uint32', 0, -1 >>> 0],
			['int64', new BigInt64Array([1n << 63n])[0], new BigInt64Array([(1n << 63n) - 1n])[0]],
			['uint64', 0n, new BigUint64Array([-1n])[0]]
		];
		for (const [slug, min, max] of pairs) {
			expect(T(slug).min, slug).toBe(BigInt(min));
			expect(T(slug).max, slug).toBe(BigInt(max));
		}
	});

	test('known constants', () => {
		expect(T('int32').max).toBe(2147483647n);
		expect(T('int32').min).toBe(-2147483648n);
		expect(T('uint32').max).toBe(4294967295n);
		expect(T('int64').max).toBe(9223372036854775807n);
		expect(T('int64').min).toBe(-9223372036854775808n);
		expect(T('uint64').max).toBe(18446744073709551615n);
		expect(T('int128').max).toBe(170141183460469231731687303715884105727n);
		expect(T('uint128').max).toBe(340282366920938463463374607431768211455n);
		expect(T('int16').min).toBe(-32768n);
		expect(T('uint16').max).toBe(65535n);
		expect(T('int8').min).toBe(-128n);
		expect(T('uint8').max).toBe(255n);
		// Number.MAX_SAFE_INTEGER sits inside int64 and well past int32.
		expect(BigInt(Number.MAX_SAFE_INTEGER)).toBe(2n ** 53n - 1n);
		expect(fits(BigInt(Number.MAX_SAFE_INTEGER), T('int64'))).toBe(true);
		expect(fits(BigInt(Number.MAX_SAFE_INTEGER), T('uint32'))).toBe(false);
	});

	test('formulas and printed forms', () => {
		expect(formulas(T('int32'))).toEqual({ min: '−2³¹', max: '2³¹ − 1', count: '2³²' });
		expect(formulas(T('uint8'))).toEqual({ min: '0', max: '2⁸ − 1', count: '2⁸' });
		expect(formulas(T('int128')).max).toBe('2¹²⁷ − 1');
		expect(hexOf(T('int32').max, 32)).toBe('0x7FFFFFFF');
		expect(hexOf(T('int32').min, 32)).toBe('0x80000000');
		expect(hexOf(-1n, 8)).toBe('0xFF');
		expect(binaryOf(T('int8').min, 8)).toBe('10000000');
		expect(binaryOf(5n, 16)).toBe('0000000000000101');
		expect(formatDecimal(-2147483648n)).toBe('−2,147,483,648');
		expect(formatDecimal(0n)).toBe('0');
		for (const t of intTypes) {
			// The hex of max and min are the bit patterns the page shows.
			expect(BigInt(hexOf(t.max, t.bits))).toBe(BigInt.asUintN(t.bits, t.max));
			expect(binaryOf(t.min, t.bits)).toHaveLength(t.bits);
		}
	});

	test('every language has an entry for every type, and only certain names', () => {
		for (const t of intTypes) {
			const names = namesFor(t);
			expect(names.map((n) => n.language)).toEqual(languages);
			for (const n of names) expect(n.type !== null || !!n.note, `${n.language} ${t.slug} explains a gap`).toBe(true);
		}
		// SQL Server tinyint is the unsigned byte, not the signed one.
		expect(namesFor(T('uint8')).find((n) => n.language === 'SQL Server')?.type).toBe('tinyint');
		expect(namesFor(T('int8')).find((n) => n.language === 'SQL Server')?.type).toBeNull();
		expect(namesFor(T('int32')).find((n) => n.language === 'Java')?.type).toBe('int');
		expect(namesFor(T('uint64')).find((n) => n.language === 'Java')?.type).toBeNull();
	});

	test('wrapping agrees with a subtract-the-modulus reference', () => {
		for (const t of intTypes) {
			const samples = [
				t.min,
				t.max,
				t.min - 1n,
				t.max + 1n,
				0n,
				-1n,
				t.count * 3n + 5n,
				-t.count * 2n - 7n,
				t.max * 2n
			];
			for (const n of samples) expect(wrap(n, t), `${t.slug} ${n}`).toBe(referenceWrap(n, t.min, t.max));
		}
	});

	test('the playground, exhaustively for every 8-bit value and operation', () => {
		const eight = intTypes.filter((t) => t.bits === 8);
		const arith: [Op, (v: number) => number][] = [
			['inc', (v) => v + 1],
			['dec', (v) => v - 1],
			['dbl', (v) => v * 2],
			['neg', (v) => -v]
		];
		const mod = (n: number, m: number) => ((n % m) + m) % m;
		for (const t of eight) {
			for (let v = Number(t.min); v <= Number(t.max); v++) {
				for (const [op, f] of arith) {
					const exact = f(v);
					let expected = mod(exact, 256);
					if (t.signed && expected > 127) expected -= 256;
					const r = applyOp(t, BigInt(v), op);
					expect(r.exact).toBe(BigInt(exact));
					expect(r.result).toBe(BigInt(expected));
					expect(r.wrapped).toBe(exact !== expected);
					expect(r.direction).toBe(exact === expected ? null : exact > Number(t.max) ? 'over' : 'under');
				}
				// Casting every 8-bit value to every type: the result is the value
				// modulo 2ⁿ, read back in that type, the same as a typed array store.
				for (const to of intTypes) {
					const r = applyOp(t, BigInt(v), 'cast', to);
					expect(r.result).toBe(referenceWrap(BigInt(v), to.min, to.max));
				}
			}
		}
		expect(applyOp(T('int8'), 127n, 'inc').result).toBe(-128n);
		expect(applyOp(T('int8'), -128n, 'neg').result).toBe(-128n);
		expect(applyOp(T('uint8'), 0n, 'dec').result).toBe(255n);
	});

	test('the playground agrees with typed arrays on random wider values', () => {
		const rand = seeded(2038);
		const ctor = { int16: Int16Array, uint16: Uint16Array, int32: Int32Array, uint32: Uint32Array } as const;
		for (const [slug, Arr] of Object.entries(ctor)) {
			const t = T(slug);
			for (let i = 0; i < 400; i++) {
				const v = randomIn(t, rand);
				for (const op of ['inc', 'dec', 'dbl', 'neg'] as Op[]) {
					const r = applyOp(t, v, op);
					expect(r.result).toBe(BigInt(new Arr([Number(r.exact)])[0]));
				}
			}
		}
		for (const [slug, Arr] of [
			['int64', BigInt64Array],
			['uint64', BigUint64Array]
		] as const) {
			const t = T(slug);
			for (let i = 0; i < 400; i++) {
				const value = i < 4 ? [t.min, t.max, 0n, t.min + 1n][i] : randomIn(t, rand);
				for (const op of ['inc', 'dec', 'dbl', 'neg'] as Op[]) {
					const r = applyOp(t, value, op);
					expect(r.result).toBe(new Arr([BigInt.asUintN(64, r.exact)])[0]);
				}
			}
		}
	});

	test('128-bit arithmetic agrees with a remainder-based reference', () => {
		// Wrapping written a third way: the remainder modulo 2ⁿ, shifted into range.
		const reference = (n: bigint, t: IntType) => {
			const r = ((n % t.count) + t.count) % t.count;
			return t.signed && r > t.max ? r - t.count : r;
		};
		const rand = seeded(128);
		for (const t of [T('int128'), T('uint128')]) {
			const values = [
				t.min,
				t.max,
				0n,
				t.min + 1n,
				t.max - 1n,
				...Array.from({ length: 500 }, () => randomIn(t, rand))
			];
			for (const v of values) {
				for (const [op, f] of [
					['inc', (x: bigint) => x + 1n],
					['dec', (x: bigint) => x - 1n],
					['dbl', (x: bigint) => x * 2n],
					['neg', (x: bigint) => -x]
				] as [Op, (x: bigint) => bigint][]) {
					const r = applyOp(t, v, op);
					expect(r.exact).toBe(f(v));
					expect(r.result, `${t.slug} ${v} ${op}`).toBe(reference(f(v), t));
					expect(r.wrapped).toBe(r.result !== r.exact);
				}
				for (const to of intTypes) expect(applyOp(t, v, 'cast', to).result).toBe(reference(v, to));
			}
		}
	});

	test('cast step texts say what happens to the bits', () => {
		const steps = (from: string, v: bigint, to: string) => applyOp(T(from), v, 'cast', T(to)).steps.join(' ');
		expect(steps('int32', 300n, 'int8')).toContain('keeps the low 8 bits and drops the top 24');
		expect(steps('int32', 300n, 'int8')).toContain('The top bit of the result is 0, so as int8 it reads as 44');
		expect(steps('int8', -1n, 'int32')).toContain(
			'copies its sign bit (1) into the 24 new bits, so the number keeps its value'
		);
		expect(steps('int8', -1n, 'uint32')).not.toContain('keeps its value.');
		expect(steps('int8', -1n, 'uint32')).toContain('Read as unsigned, the bits are 4,294,967,295');
		expect(steps('uint8', 200n, 'int8')).toContain('200 − 2⁸ = −56');
		expect(steps('uint8', 200n, 'int32')).toContain('fills the 24 new bits with 0');
		expect(steps('int32', 5n, 'int32')).toBe('Same type: nothing changes.');
	});

	test('a JavaScript number is exact for some integers past 2^53, not all', () => {
		expect(jsNumberFit(2n ** 53n - 1n)).toEqual({ safe: true, exact: true, rounded: 2n ** 53n - 1n });
		expect(jsNumberFit(2n ** 53n)).toMatchObject({ safe: false, exact: true });
		expect(jsNumberFit(2n ** 53n + 1n)).toEqual({ safe: false, exact: false, rounded: 2n ** 53n });
		expect(jsNumberFit(-(2n ** 53n))).toMatchObject({ safe: false, exact: true });
		expect(jsNumberFit(2n ** 64n)).toMatchObject({ safe: false, exact: true });
		expect(jsNumberFit(2n ** 64n - 1n)).toEqual({ safe: false, exact: false, rounded: 2n ** 64n });
		expect(jsNumberFit(2n ** 1100n).rounded).toBeNull();
	});

	test('cast explanations name the right bit operation', () => {
		expect(applyOp(T('int8'), -1n, 'cast', T('int32')).castKind).toBe('sign-extend');
		expect(applyOp(T('int8'), -1n, 'cast', T('uint32')).result).toBe(4294967295n);
		expect(applyOp(T('uint8'), 200n, 'cast', T('int32')).castKind).toBe('zero-extend');
		expect(applyOp(T('int32'), 300n, 'cast', T('uint8')).castKind).toBe('truncate');
		expect(applyOp(T('int32'), 300n, 'cast', T('uint8')).result).toBe(44n);
		expect(applyOp(T('int32'), -1n, 'cast', T('uint32')).castKind).toBe('reinterpret');
		expect(applyOp(T('int32'), 5n, 'cast', T('int32')).castKind).toBe('same');
		expect(() => applyOp(T('int8'), 128n, 'inc')).toThrow(IntLimitsError);
		// Steps are written out and mention the result.
		const r = applyOp(T('int8'), 127n, 'inc');
		expect(r.steps.join(' ')).toContain('−128');
		expect(r.steps.join(' ')).toContain('256');
	});

	test('parsing', () => {
		expect(parseInteger('2147483647')).toBe(2147483647n);
		expect(parseInteger('2,147,483,647')).toBe(2147483647n);
		expect(parseInteger('−2,147,483,648')).toBe(-2147483648n);
		expect(parseInteger('-128')).toBe(-128n);
		expect(parseInteger('+5')).toBe(5n);
		expect(parseInteger('0xFF')).toBe(255n);
		expect(parseInteger('-0x80')).toBe(-128n);
		expect(parseInteger('0b1010_0101')).toBe(165n);
		expect(parseInteger('0o777')).toBe(511n);
		expect(parseInteger('2^31 - 1')).toBe(2147483647n);
		expect(parseInteger('2**64-1')).toBe(18446744073709551615n);
		expect(parseInteger('-2^63')).toBe(-9223372036854775808n);
		expect(parseInteger('1 000 000')).toBe(1000000n);
		expect(() => parseInteger('')).toThrow(/Type a whole number/);
		expect(() => parseInteger('1.5')).toThrow(/Whole numbers only/);
		expect(() => parseInteger('1e9')).toThrow(/in full/);
		expect(() => parseInteger('12a')).toThrow(/"a" is not a decimal digit/);
		expect(() => parseInteger('0x')).toThrow(/hex digits/);
		expect(() => parseInteger('0b102')).toThrow(/"2" is not a binary digit/);
		expect(() => parseInteger('9'.repeat(200))).toThrow(/more than/);
		// Limits as the pages print them, superscripts and typographic minus included.
		expect(parseInteger('2³¹ − 1')).toBe(2147483647n);
		expect(parseInteger('−2⁶³')).toBe(-9223372036854775808n);
		expect(parseInteger('2 ^ 31')).toBe(2147483648n);
		expect(parseInteger('2^31 + 1,000')).toBe(2147484648n);
		expect(parseInteger('0xFFFF_FFFF')).toBe(4294967295n);
		expect(parseInteger('0xFF FF')).toBe(65535n);
		// Malformed input is reported, not read as some other number.
		expect(() => parseInteger('2^3 1')).toThrow(/power of two as/);
		expect(() => parseInteger('2^31-1-1')).toThrow(/whole decimal number/);
		expect(() => parseInteger('2^1000')).toThrow(/400 or less/);
		expect(() => parseInteger('2^' + '1'.repeat(50))).toThrow(/400 or less/);
		expect(() => parseInteger('1,2,3')).toThrow(/threes/);
		expect(() => parseInteger('12,34')).toThrow(/threes/);
		expect(() => parseInteger('_1')).toThrow(/underscores/);
		expect(() => parseInteger('1_')).toThrow(/underscores/);
		expect(() => parseInteger('1__0')).toThrow(/underscores/);
		const rand = seeded(53);
		for (let i = 0; i < 300; i++) {
			const n = BigInt(Math.floor((rand() - 0.5) * 2 ** 53)) * BigInt(i + 1);
			expect(parseInteger(n.toString())).toBe(n);
			expect(parseInteger(formatDecimal(n))).toBe(n);
		}
	});

	test('the smallest type that holds a number', () => {
		expect(lookup(255n).smallestUnsigned?.slug).toBe('uint8');
		expect(lookup(255n).smallestSigned?.slug).toBe('int16');
		expect(lookup(-129n).smallestSigned?.slug).toBe('int16');
		expect(lookup(-1n).smallestUnsigned).toBeNull();
		expect(lookup(2n ** 128n).smallestUnsigned).toBeNull();
		expect(lookup(2n ** 127n).smallestUnsigned?.slug).toBe('uint128');
		// bitsNeeded matches a brute-force search over widths.
		for (let i = -600; i <= 600; i++) {
			const n = BigInt(i);
			const signed = Array.from({ length: 20 }, (_, k) => k + 1).find(
				(w) => n >= -(1n << BigInt(w - 1)) && n < 1n << BigInt(w - 1)
			);
			const unsigned = n < 0n ? null : Array.from({ length: 20 }, (_, k) => k + 1).find((w) => n < 1n << BigInt(w));
			expect(bitsNeeded(n), String(n)).toEqual({ unsigned, signed });
		}
		// Every smallest type really is the first that fits.
		for (const n of [0n, 127n, 128n, 32767n, 65536n, -2147483649n, 2n ** 64n]) {
			const l = lookup(n);
			if (l.smallestSigned) {
				const smaller = intTypes.filter((t) => t.signed && t.bits < (l.smallestSigned as IntType).bits);
				expect(smaller.some((t) => fits(n, t))).toBe(false);
			}
		}
	});

	test('dates and durations are computed, and match the documented ones', () => {
		expect(unixRollover(T('int32'))).toEqual({ last: '2038-01-19 03:14:07 UTC', next: '1901-12-13 20:45:52 UTC' });
		expect(unixRollover(T('uint32'))?.last).toBe('2106-02-07 06:28:15 UTC');
		expect(unixRollover(T('int64'))).toBeNull();
		expect(daysToOverflow(2n ** 31n, 100).toFixed(2)).toBe('248.55');
		expect(daysToOverflow(2n ** 32n, 1000).toFixed(1)).toBe('49.7');
		expect(Math.round(int64UnixBillionYears())).toBe(292);
	});

	test('stories are attached only to the type they concern', () => {
		const titles = (slug: string) => storiesFor(T(slug)).map((s) => s.title);
		expect(titles('int32')).toContain('The Year 2038 problem');
		expect(titles('int32')).toContain('Boeing 787 generator control units');
		expect(titles('uint8')).toEqual(['Pac-Man level 256']);
		expect(titles('int16')).toEqual(['Ariane 5 flight 501']);
		expect(titles('int8')).toEqual([]);
		expect(storiesFor(T('int32'))[0].text).toContain('2038-01-19 03:14:07 UTC');
		expect(storiesFor(T('int16'))[0].text).toContain('32,767');
	});

	test('the JavaScript wrap examples really evaluate to max + 1 wrapped', () => {
		for (const t of intTypes) {
			const result = new Function(`return ${jsWrapExample(t)}`)();
			expect(BigInt(result), jsWrapExample(t)).toBe(wrap(t.max + 1n, t));
		}
	});

	test('titles, descriptions and FAQs fit and carry computed numbers', () => {
		for (const t of intTypes) {
			const title = typeTitle(t);
			expect(title.length, title).toBeLessThanOrEqual(60);
			const d = typeDescription(t);
			expect(d.length, d).toBeGreaterThanOrEqual(110);
			expect(d.length, d).toBeLessThanOrEqual(160);
			const faqs = typeFaqs(t);
			expect(faqs.length).toBeGreaterThanOrEqual(4);
			expect(faqs[0].a).toContain(formatDecimal(t.max));
			expect(faqs.find((f) => f.q.includes('overflows'))?.a).toContain(formatDecimal(wrap(t.max + 1n, t)));
		}
	});

	test('descriptions and the overflow answer name only languages that have the type', () => {
		const sql = ['MySQL', 'PostgreSQL', 'SQL Server'];
		for (const t of intTypes) {
			const has = (language: string) => namesFor(t).some((n) => n.language === language && n.type !== null);
			for (const language of describedLanguages(t)) {
				if (language === 'SQL') expect(sql.some(has), `${t.slug} SQL`).toBe(true);
				else expect(has(language === 'C' ? 'C and C++' : language), `${t.slug} ${language}`).toBe(true);
			}
			const d = typeDescription(t);
			const answer = overflowAnswer(t);
			for (const language of ['Java', 'Kotlin', 'Go', 'C#']) {
				const word = new RegExp(`(^|[^A-Za-z])${language.replace('#', '\\#')}([^A-Za-z]|$)`);
				if (!has(language)) {
					expect(answer, `${t.slug} overflow answer names ${language}`).not.toMatch(word);
					expect(d, `${t.slug} description names ${language}`).not.toMatch(word);
				}
			}
			if (!sql.some(has)) expect(d).not.toContain('SQL');
			// Below 32 bits the sum is promoted to int, so the answer must not
			// claim that the expression itself wraps in Java, C# or Kotlin.
			if (t.bits < 32) {
				expect(answer).toContain(`is ${formatDecimal(t.max + 1n)} as an int`);
				expect(answer).not.toContain('undefined behaviour');
				// Kotlin's UByte and UShort arithmetic gives a UInt, not an Int.
				if (!t.signed) expect(answer).toContain('done in int (UInt in Kotlin)');
				else expect(answer).not.toContain('UInt');
			}
		}
		expect(describedLanguages(T('uint128'))).toEqual(['C', 'C#', 'Rust']);
		expect(overflowAnswer(T('uint128'))).toContain('C# (outside a checked context) does exactly that');
	});

	test('scientific notation rounds from the exact digits', () => {
		// Independent reference: Number's own toExponential, exact enough at three figures for these.
		const reference = (n: bigint) => {
			const [m, e] = Number(n).toExponential(2).split('e');
			return `${m} × 10^${Number(e)}`;
		};
		const plain = (s: string) =>
			s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/, (sup) => '^' + Array.from(sup, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''));
		for (const t of intTypes.filter((x) => x.bits >= 16)) {
			expect(plain(scientific(t.max)), t.slug).toBe(reference(t.max));
			expect(digitCount(t.min), t.slug).toBe(t.min.toString().replace('-', '').length);
		}
		expect(scientific(T('int128').max)).toBe('1.70 × 10³⁸');
		expect(scientific(T('uint128').max)).toBe('3.40 × 10³⁸');
		expect(digitCount(T('uint128').max)).toBe(39);
		expect(scientific(9995n)).toBe('1.00 × 10⁴');
		expect(scientific(9994n)).toBe('9.99 × 10³');
		expect(scientific(999n)).toBe('999');
	});

	test('linked uses point at pages that exist', () => {
		const links = Object.values(usesOf)
			.flat()
			.flatMap((u) => (typeof u === 'string' ? [] : [u.href]));
		expect(links.sort()).toEqual([
			'/ipv6-expand-compress',
			'/snowflake-id-decoder',
			'/subnet-calculator',
			'/subnet-calculator',
			'/uuid-decoder'
		]);
	});

	test('common mistakes carry computed numbers', () => {
		for (const t of intTypes) expect(mistakesFor(t).length, t.slug).toBeGreaterThanOrEqual(1);
		const text = (slug: string) =>
			mistakesFor(T(slug))
				.map((m) => m.text)
				.join(' ');
		expect(text('int32')).toContain('wraps back to −2,147,483,648');
		expect(text('uint8')).toContain('200 + 100 is 300');
		expect(text('uint8')).toContain('where it becomes 44');
		expect(text('uint16')).toContain(formatDecimal(65535n * 65535n));
		expect(text('int64')).toContain('9,007,199,254,740,993 arrives as 9,007,199,254,740,992');
		expect(text('uint32')).toContain('wraps to 4,294,967,295');
		expect(text('int8')).toContain('reads as −1');
		expect(text('int8')).not.toContain('undefined behaviour');
	});
});

test.describe('the integer-limits page', () => {
	test('the hub ships the table, a worked overflow and a lookup', async ({ page }) => {
		// Long numbers carry <wbr> between digit groups (and {@html} markers); read the text without them.
		const html = (await (await page.request.get('/integer-limits')).text()).replace(
			/<wbr>|<!-- HTML_TAG_(START|END) -->/g,
			''
		);
		for (const t of intTypes) {
			expect(html).toContain(`href="/integer-limits/${t.slug}"`);
			expect(html).toContain(formatDecimal(t.max));
		}
		// The default playground: int8 127 + 1 wraps to −128.
		expect(html).toMatch(/data-testid="pg-result"[^>]*>\s*−128/);
		await page.goto('/integer-limits');
		await page.waitForLoadState('networkidle');
		await page.fill('#lookup', '70000');
		await expect(page.locator('[data-testid="lookup-signed"]')).toHaveText('int32');
		await expect(page.locator('[data-testid="lookup-unsigned"]')).toHaveText('uint32');
		await page.fill('#lookup', '-1');
		await expect(page.locator('.fit-grid')).toContainText('uint128 no negatives');
		await expect(page.locator('.answer-also')).toContainText('It needs 1 bit as a signed');
		await page.fill('#lookup', '2^64');
		await expect(page.locator('.answer-also')).toContainText('holds this exact value');
		await page.fill('#lookup', '2^53 + 1');
		await expect(page.locator('.answer-also')).toContainText(
			'cannot hold it exactly: it rounds to 9,007,199,254,740,992'
		);
		await page.fill('#lookup', '1.5');
		await expect(page.locator('#lookup-error')).toContainText('Whole numbers only');
		// The faded stale result cannot be reached by keyboard.
		await expect(page.locator('.results.stale')).toHaveAttribute('inert', '');
	});

	test('the playground computes, and its state survives a reload', async ({ page }) => {
		await page.goto('/integer-limits');
		await page.waitForLoadState('networkidle');
		await page.selectOption('#pg-type', 'uint8');
		await page.fill('#pg-value', '0');
		await page.click('button[data-op="dec"]');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('255');
		await page.click('button[data-op="cast"]');
		await page.selectOption('#pg-to', 'int8');
		await page.fill('#pg-value', '200');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('−56');
		await page.fill('#lookup', '-129');
		await expect(page).toHaveURL(/t=uint8/);
		await expect(page).toHaveURL(/op=cast/);
		const url = page.url();
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#pg-type')).toHaveValue('uint8');
		await expect(page.locator('#pg-to')).toHaveValue('int8');
		await expect(page.locator('#pg-value')).toHaveValue('200');
		await expect(page.locator('#lookup')).toHaveValue('-129');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('−56');
		await expect(page.locator('[data-testid="lookup-signed"]')).toHaveText('int16');
	});

	test('a type page shows its limits, names, stories and a wrapped default', async ({ page }) => {
		const html = (await (await page.request.get('/integer-limits/int32')).text()).replace(
			/<wbr>|<!-- HTML_TAG_(START|END) -->/g,
			''
		);
		expect(html).toContain('2,147,483,647');
		expect(html).toContain('−2,147,483,648');
		expect(html).toContain('0x7FFFFFFF');
		expect(html).toContain('INT32_MAX');
		expect(html).toContain('Integer.MAX_VALUE');
		expect(html).toContain('2038-01-19 03:14:07 UTC');
		expect(html).toMatch(/data-testid="pg-result"[^>]*>\s*−2,147,483,648/);
		for (const slug of intSlugs) {
			const res = await page.request.get(`/integer-limits/${slug}`);
			expect(res.status(), slug).toBe(200);
		}
		expect((await page.request.get('/integer-limits/int7')).status()).toBe(404);
		// The served select already shows this page's type, before any script runs.
		const uint64 = await (await page.request.get('/integer-limits/uint64')).text();
		expect(uint64).toMatch(/<option value="uint64" selected/);
		expect(uint64).not.toMatch(/<option value="int8" selected/);
		expect(uint64).toContain('href="/tools"');

		await page.goto('/integer-limits/uint16');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#pg-type')).toHaveValue('uint16');
		await page.click('button[data-op="dbl"]');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('65,534');
		await page.click('[data-testid="pg-keep"]');
		await expect(page.locator('#pg-value')).toHaveValue('65534');
		await expect(page).toHaveURL(/v=65534/);
		// Too big for the type: an error, a way out, and no stale button to press.
		await page.fill('#pg-value', '70000');
		await expect(page.locator('.playground [role="alert"]')).toContainText('does not fit in uint16');
		await expect(page.locator('.playground .results')).toHaveAttribute('inert', '');
		await page.click('[data-testid="pg-widen"]');
		await expect(page.locator('#pg-type')).toHaveValue('uint32');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('140,000');

		// Moving to another type page reuses the component: it must reset to that type.
		await page.locator('.pager a').first().click();
		await expect(page).toHaveURL(/\/integer-limits\/int16$/);
		await expect(page.locator('#pg-type')).toHaveValue('int16');
		await expect(page.locator('#pg-value')).toHaveValue('32767');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('−32,768');
		await expect(page.locator('h1')).toHaveText('int16: the 16-bit signed integer');
	});

	test('the link survives Back and Forward, and rejected values leave the address bar', async ({ page }) => {
		for (const path of ['/integer-limits', '/integer-limits/int8']) {
			await page.goto(path);
			await page.waitForLoadState('networkidle');
			await page.fill('#pg-value', '5');
			await expect(page).toHaveURL(/v=5/);
			await page.locator('a[href="/tools"]').first().click();
			await expect(page).toHaveURL(/\/tools$/);
			await page.goBack();
			await expect(page).toHaveURL(new RegExp(`${path}\\?.*v=5`));
			await expect(page.locator('#pg-value')).toHaveValue('5');
			await page.goForward();
			await page.goBack();
			await expect(page.locator('#pg-value')).toHaveValue('5');
			await expect(page).toHaveURL(/v=5/);
		}
		// An unknown type and an over-long value are ignored, and dropped from the link.
		await page.goto(`/integer-limits/uint8?t=int7&to=bogus&op=x&v=${'9'.repeat(500)}`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(/\/integer-limits\/uint8$/);
		await expect(page.locator('#pg-value')).toHaveValue('255');
		await page.goto(`/integer-limits?q=${'1'.repeat(500)}&t=nope`);
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(/\/integer-limits$/);
	});

	test('the link keeps following edits after Back from another site', async ({
		playwright,
		browserName,
		launchOptions,
		channel,
		baseURL
	}) => {
		// Playwright turns the back/forward cache off; real browsers keep it on,
		// and a page restored from it does not run afterNavigate again.
		const browser = await playwright[browserName].launch({
			...launchOptions,
			channel,
			ignoreDefaultArgs: ['--disable-back-forward-cache']
		});
		try {
			const page = await browser.newPage({ baseURL });
			// Same server, other origin: the browser leaves the app entirely.
			const elsewhere = (baseURL as string).replace('localhost', '127.0.0.1') + '/tools';
			for (const path of ['/integer-limits/int8', '/integer-limits']) {
				await page.goto(path);
				await page.waitForLoadState('networkidle');
				await page.fill('#pg-value', '5');
				await expect(page).toHaveURL(/v=5/);
				await page.evaluate((href) => {
					const a = document.createElement('a');
					a.href = href;
					a.id = 'elsewhere';
					a.textContent = 'elsewhere';
					document.querySelector('main')?.prepend(a);
				}, elsewhere);
				await page.click('#elsewhere');
				await expect(page).toHaveURL(elsewhere);
				await page.goBack({ waitUntil: 'commit' });
				await expect(page.locator('#pg-value')).toHaveValue('5');
				await page.fill('#pg-value', '6');
				await expect(page).toHaveURL(new RegExp(`${path}\\?.*v=6`));
			}
		} finally {
			await browser.close();
		}
	});

	test('errors are described on the field and announced once typing pauses', async ({ page }) => {
		await page.goto('/integer-limits');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#lookup')).toHaveAttribute('aria-describedby', 'lookup-help');
		await page.fill('#lookup', '1.5');
		await expect(page.locator('#lookup')).toHaveAttribute('aria-describedby', 'lookup-help lookup-error');
		// The visible error is not itself an alert; a hidden copy is, after a pause.
		await expect(page.locator('#lookup-error:not([role])')).toBeVisible();
		await expect(page.locator('.intro [role="alert"]')).toHaveText(/Whole numbers only/);
		await page.fill('#lookup', '300');
		await expect(page.locator('.intro [role="alert"]')).toHaveCount(0);
		await expect(page.locator('.intro [role="status"]').first()).toHaveText(/smallest signed type int16/);
		await page.fill('#pg-value', 'x');
		await expect(page.locator('#pg-value')).toHaveAttribute('aria-describedby', 'pg-help pg-error');
		// The value chip −1 and the operation −1 have different names.
		await expect(page.locator('role=button[name="−1 (subtract one)"]')).toHaveAttribute('data-op', 'dec');
		await expect(page.locator('role=group[name="Set the value"] >> button')).toContainText(['max', 'min', '0', '−1']);
	});
});
