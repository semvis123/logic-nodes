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
	binaryOf,
	hexOf,
	formatDecimal,
	int64UnixBillionYears,
	daysToOverflow,
	IntLimitsError,
	type IntType,
	type Op
} from '../src/lib/intLimits.js';

const T = (slug: string) => intTypeBySlug(slug) as IntType;

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
		const ctor = { int16: Int16Array, uint16: Uint16Array, int32: Int32Array, uint32: Uint32Array } as const;
		for (const [slug, Arr] of Object.entries(ctor)) {
			const t = T(slug);
			for (let i = 0; i < 400; i++) {
				const v = BigInt(Math.floor(Math.random() * Number(t.count))) + t.min;
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
				const v = BigInt.asUintN(64, BigInt(Math.floor(Math.random() * 2 ** 52)) << BigInt(i % 13)) + t.min;
				const value = fits(v, t) ? v : t.max;
				for (const op of ['inc', 'dec', 'dbl', 'neg'] as Op[]) {
					const r = applyOp(t, value, op);
					expect(r.result).toBe(new Arr([BigInt.asUintN(64, r.exact)])[0]);
				}
			}
		}
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
		for (let i = 0; i < 300; i++) {
			const n = BigInt(Math.floor((Math.random() - 0.5) * 2 ** 53)) * BigInt(i + 1);
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
});

test.describe('the integer-limits page', () => {
	test('the hub ships the table, a worked overflow and a lookup', async ({ page }) => {
		const html = await (await page.request.get('/integer-limits')).text();
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
		await page.fill('#lookup', '1.5');
		await expect(page.locator('#lookup-error')).toContainText('Whole numbers only');
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
		const html = await (await page.request.get('/integer-limits/int32')).text();
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

		await page.goto('/integer-limits/uint16');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#pg-type')).toHaveValue('uint16');
		await page.click('button[data-op="dbl"]');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('65,534');
		await page.click('[data-testid="pg-keep"]');
		await expect(page.locator('#pg-value')).toHaveValue('65534');
		await expect(page).toHaveURL(/v=65534/);

		// Moving to another type page reuses the component: it must reset to that type.
		await page.locator('.pager a').first().click();
		await expect(page).toHaveURL(/\/integer-limits\/int16$/);
		await expect(page.locator('#pg-type')).toHaveValue('int16');
		await expect(page.locator('#pg-value')).toHaveValue('32767');
		await expect(page.locator('[data-testid="pg-result"]')).toHaveText('−32,768');
		await expect(page.locator('h1')).toHaveText('int16: the 16-bit signed integer');
	});

	test('FAQ JSON-LD matches the visible answers', async ({ page }) => {
		for (const path of ['/integer-limits', '/integer-limits/int8', '/integer-limits/uint128']) {
			await page.goto(path);
			const ld = await page
				.locator('script[type="application/ld+json"]')
				.evaluateAll((els) => els.map((e) => JSON.parse(e.textContent || '{}')));
			const graph = ld.flatMap((x) => x['@graph'] ?? [x]);
			const faq = graph.find((n) => [].concat(n['@type']).includes('FAQPage' as never));
			const answers = faq.mainEntity.map((q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text);
			const visible = await page.locator('.faq details p').allTextContents();
			expect(visible.map((s) => s.trim())).toEqual(answers);
		}
	});
});
