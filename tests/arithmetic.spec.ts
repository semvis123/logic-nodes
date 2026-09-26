// Column arithmetic, checked two ways: the answers against BigInt, and the
// working against itself, by reading the carries, borrows and partial products
// back off the layout and redoing each column.

import { expect, test } from '@playwright/test';
import {
	add,
	subtract,
	multiply,
	divide,
	bitwise,
	shift,
	calculate,
	partialProducts,
	additionTable,
	CalcError,
	type CalcRadix,
	type Calculation,
	type Layout
} from '../src/lib/arithmetic.js';

function randomBig(bits: number): bigint {
	const length = 1 + Math.floor(Math.random() * bits);
	let s = '';
	for (let i = 0; i < length; i++) s += Math.random() < 0.5 ? '0' : '1';
	return BigInt('0b' + s);
}

const value = (ch: string) => parseInt(ch, 16);

/** Reads a row of the layout as digit values per column, right to left, blanks as 0. */
function column(layout: Layout, kind: string, index = 0): number[] {
	const rows = layout.rows.filter((r) => r.kind === kind);
	return rows[index].cells.map((c) => (c ? value(c.text) : 0)).reverse();
}

/** A row of the layout as a number. */
function rowValue(layout: Layout, kind: string, radix: number, index = 0): bigint {
	return column(layout, kind, index).reduceRight((sum, d) => sum * BigInt(radix) + BigInt(d), 0n);
}

const radixes: CalcRadix[] = [2, 16];

test.describe('column arithmetic', () => {
	test('answers agree with BigInt', () => {
		for (let i = 0; i < 600; i++) {
			const a = randomBig(i % 3 ? 40 : 200);
			const b = randomBig(i % 2 ? 40 : 120);
			for (const radix of radixes) {
				expect(add(a, b, radix).result).toBe(a + b);
				expect(subtract(a, b, radix).result).toBe(a - b);
				expect(multiply(a, b, radix).result).toBe(a * b);
				if (b > 0n) {
					const d = divide(a, b, radix);
					expect(d.result).toBe(a / b);
					expect(d.remainder).toBe(a % b);
				}
				const sub = subtract(a, b, radix);
				expect(sub.resultText).toBe((a < b ? '−' : '') + (a < b ? b - a : a - b).toString(radix).toUpperCase());
			}
		}
	});

	test('re-adding each column with its carry reproduces the sum', () => {
		for (let i = 0; i < 400; i++) {
			const a = randomBig(80);
			const b = randomBig(80);
			for (const radix of radixes) {
				const { layout } = add(a, b, radix);
				const carries = column(layout, 'carry');
				const top = column(layout, 'operand', 0);
				const bottom = column(layout, 'operand', 1);
				const sum = column(layout, 'result');
				expect(carries[0]).toBe(0);
				const bad: number[] = [];
				for (let c = 0; c < layout.columns; c++) {
					if (top[c] + bottom[c] + carries[c] !== sum[c] + radix * (carries[c + 1] ?? 0)) bad.push(c);
				}
				expect(bad, 'columns that do not add up').toEqual([]);
				expect(rowValue(layout, 'result', radix)).toBe(a + b);
			}
		}
	});

	test('each column with its borrow reproduces the difference', () => {
		for (let i = 0; i < 400; i++) {
			const a = randomBig(80);
			const b = randomBig(80);
			const [big, small] = a >= b ? [a, b] : [b, a];
			for (const radix of radixes) {
				const { layout } = subtract(a, b, radix);
				const borrows = column(layout, 'borrow');
				const top = column(layout, 'operand', 0);
				const bottom = column(layout, 'operand', 1);
				const diff = column(layout, 'result');
				expect(rowValue(layout, 'operand', radix, 0)).toBe(big);
				expect(rowValue(layout, 'operand', radix, 1)).toBe(small);
				expect(borrows[0]).toBe(0);
				const bad: number[] = [];
				for (let c = 0; c < layout.columns; c++) {
					if (top[c] - borrows[c] - bottom[c] + radix * (borrows[c + 1] ?? 0) !== diff[c]) bad.push(c);
				}
				expect(bad, 'columns that do not subtract').toEqual([]);
				expect(rowValue(layout, 'result', radix)).toBe(big - small);
			}
		}
	});

	test('partial products are shifted copies that add up to the product', () => {
		for (let i = 0; i < 300; i++) {
			const a = randomBig(60);
			const b = randomBig(i % 2 ? 12 : 60);
			for (const radix of radixes) {
				const calc = multiply(a, b, radix);
				const partials = partialProducts(a, b, radix);
				expect(partials.reduce((s, p) => s + p, 0n)).toBe(a * b);
				const rows = calc.layout.rows.filter((r) => r.kind === 'partial');
				const shown = rows.map((_, k) => rowValue(calc.layout, 'partial', radix, k));
				// Rows of zeros may be left out for long multipliers; the rest must add up.
				if (b.toString(radix).length > 1 || radix === 2) {
					expect(shown.reduce((s, p) => s + p, 0n)).toBe(a * b);
					for (const p of shown) expect(partials).toContain(p);
				}
				expect(rowValue(calc.layout, 'result', radix)).toBe(a * b);
			}
		}
	});

	test('long division steps are each a small division', () => {
		for (let i = 0; i < 200; i++) {
			const a = randomBig(100);
			const b = randomBig(i % 2 ? 8 : 40) + 1n;
			for (const radix of radixes) {
				const r = BigInt(radix);
				const calc = divide(a, b, radix);
				let previous = 0n;
				let quotient = 0n;
				const bad: number[] = [];
				calc.division!.forEach((step, k) => {
					const ok =
						step.current === previous * r + BigInt(value(step.brought)) &&
						step.digit < radix &&
						step.product === BigInt(step.digit) * b &&
						step.remainder === step.current - step.product &&
						step.remainder < b &&
						step.remainder >= 0n;
					if (!ok) bad.push(k);
					previous = step.remainder;
					quotient = quotient * r + BigInt(step.digit);
				});
				expect(bad, 'division steps that are wrong').toEqual([]);
				expect(quotient).toBe(a / b);
				expect(previous).toBe(a % b);
			}
		}
	});

	test('fixed width wraps, and says so', () => {
		for (const width of [8, 16, 32, 64]) {
			const mask = (1n << BigInt(width)) - 1n;
			for (let i = 0; i < 200; i++) {
				const a = randomBig(width);
				const b = randomBig(width);
				for (const radix of radixes) {
					const sum = add(a, b, radix, width);
					expect(sum.result).toBe((a + b) & mask);
					expect(sum.overflow).toBe(a + b > mask);
					expect(sum.resultText).toHaveLength(radix === 2 ? width : width / 4);
					const diff = subtract(a, b, radix, width);
					expect(diff.result).toBe((a - b) & mask);
					expect(diff.wrappedNegative).toBe(a < b);
					expect(BigInt((radix === 2 ? '0b' : '0x') + diff.resultText)).toBe((a - b) & mask);
					const product = multiply(a, b, radix, width);
					expect(product.result).toBe((a * b) & mask);
					expect(product.overflow).toBe(a * b > mask);
				}
			}
		}
	});

	test('a fixed-width difference only claims to be true when it fits the signed range', () => {
		for (const width of [8, 16]) {
			const low = -(1n << BigInt(width - 1));
			for (let i = 0; i < 300; i++) {
				const a = randomBig(width);
				const b = randomBig(width);
				const calc = subtract(a, b, 2, width);
				const bits = calc.result;
				const signed = bits >= 1n << BigInt(width - 1) ? bits - (1n << BigInt(width)) : bits;
				expect(calc.signedResult).toBe(signed);
				const claims = calc.notes.some((n) => n.includes('which is the true difference'));
				expect(claims, `${a} − ${b} in ${width}`).toBe(a < b && a - b >= low);
				expect(calc.notes.join(' ')).not.toContain('-');
			}
		}
		// The case the reviewer found: 0 − 255 in 8 bits leaves 00000001, which is +1 signed.
		const wrapped = subtract(0n, 255n, 2, 8);
		expect(wrapped.resultText).toBe('00000001');
		expect(wrapped.signedResult).toBe(1n);
		expect(wrapped.notes[0]).toContain('−255, which does not fit in 8 signed bits');
		expect(wrapped.notes[0]).not.toContain('which is the true difference');
		expect(subtract(3n, 5n, 2, 8).notes[0]).toContain('it is −2, which is the true difference');
		expect(subtract(0n, 128n, 2, 8).notes[0]).toContain('it is −128, which is the true difference');
		expect(subtract(0n, 129n, 2, 8).notes[0]).toContain('signed overflow');
	});

	test('bits shifted out of a fixed width are drawn struck through', () => {
		const calc = shift('shl', 0b11111111n, 2, 2, 8);
		expect(calc.overflow).toBe(true);
		expect(calc.resultText).toBe('11111100');
		const row = calc.layout.rows.find((r) => r.kind === 'result')!;
		expect(row.cells).toHaveLength(calc.layout.columns);
		expect(calc.layout.columns).toBe(10);
		const lost = row.cells.filter((c) => c?.tone === 'overflow').map((c) => c!.text);
		expect(lost.join('')).toBe('11');
		// Only up to the highest lost 1: 00010000 << 5 loses one bit, not five columns.
		const one = shift('shl', 0b10000n, 5, 2, 8);
		expect(one.layout.rows[1].cells.filter((c) => c?.tone === 'overflow')).toHaveLength(2);
		expect(one.result).toBe(0n);
		for (let i = 0; i < 200; i++) {
			const a = randomBig(16);
			const places = Math.floor(Math.random() * 20);
			const s = shift('shl', a, places, 2, 16);
			const cells = s.layout.rows[1].cells;
			const all = BigInt('0b' + cells.map((c) => c?.text ?? '0').join(''));
			expect(all).toBe(a << BigInt(places));
			expect(cells.filter((c) => c?.tone === 'overflow').length > 0).toBe(s.overflow);
		}
		expect(shift('shl', 0b1n, 3, 2, 8).layout.rows[1].cells.some((c) => c?.tone === 'overflow')).toBe(false);
	});

	test('bitwise operations and shifts agree with the operators', () => {
		for (let i = 0; i < 400; i++) {
			const a = randomBig(64);
			const b = randomBig(64);
			const places = Math.floor(Math.random() * 20);
			for (const radix of radixes) {
				expect(bitwise('and', a, b, radix, null).result).toBe(a & b);
				expect(bitwise('or', a, b, radix, null).result).toBe(a | b);
				expect(bitwise('xor', a, b, radix, null).result).toBe(a ^ b);
				expect(bitwise('not', a, 0n, radix, 64).result).toBe(~a & ((1n << 64n) - 1n));
				expect(shift('shl', a, places, radix, null).result).toBe(a << BigInt(places));
				expect(shift('shr', a, places, radix, null).result).toBe(a >> BigInt(places));
				const wide = shift('shl', a, places, radix, 64);
				expect(wide.result).toBe((a << BigInt(places)) & ((1n << 64n) - 1n));
				expect(wide.overflow).toBe(a << BigInt(places) !== wide.result);
			}
		}
		// NOT without a width uses the digits as typed, leading zeros included.
		expect(calculate('not', '0101', '', 2, null).resultText).toBe('1010');
		expect(calculate('not', '0F', '', 16, null).resultText).toBe('F0');
	});

	test('the entry point parses, and refuses what it cannot do', () => {
		expect(calculate('add', '1011', '110', 2, null).resultText).toBe('10001');
		expect(calculate('add', 'FF', '1', 16, null).resultText).toBe('100');
		expect(calculate('add', 'FF', '1', 16, 8).resultText).toBe('00');
		expect(calculate('sub', '101', '1000', 2, null).resultText).toBe('−11');
		expect(calculate('sub', '11', '101', 2, 8).resultText).toBe('11111110');
		expect(calculate('div', '1101', '11', 2, null).remainder).toBe(1n);
		expect(calculate('shl', '1', '4', 2, null).resultText).toBe('10000');
		expect(() => calculate('add', '102', '1', 2, null)).toThrow(/"2" is not a binary digit/);
		expect(() => calculate('add', 'FG', '1', 16, null)).toThrow(/"G" is not a hex digit/);
		expect(() => calculate('div', '101', '0', 2, null)).toThrow(/zero/);
		expect(() => calculate('add', '100000000', '1', 2, 8)).toThrow(/9 bits/);
		expect(() => calculate('shl', '1', 'x', 2, null)).toThrow(CalcError);
	});

	test('the explanation has a line for every column', () => {
		const calc: Calculation = add(0b1011n, 0b0111n, 2);
		expect(calc.explanation.length).toBeGreaterThanOrEqual(4);
		expect(calc.explanation[0]).toContain('1 + 1 = 10');
		expect(add(0xbn, 0x7n, 16).explanation[0]).toContain('12 in hex');
	});

	test('the addition tables', () => {
		const hex = additionTable(16);
		for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) expect(parseInt(hex[i][j], 16)).toBe(i + j);
		expect(additionTable(2)).toEqual([
			['0', '1'],
			['1', '10']
		]);
	});
});

// The pages built on these engines: state from the URL, working drawn, errors shown.
test.describe('number tool pages', () => {
	test('the binary calculator reads its state from the URL and shows carries', async ({ page }) => {
		await page.goto('/binary-calculator?a=1011&b=111');
		await expect(page.locator('.answer-value').first()).toHaveText('1 0010');
		await expect(page.locator('.answer-check')).toContainText('11 + 7 = 18');
		await expect(page.locator('.working-scroll td.carry').first()).toBeVisible();
		await page.fill('#calc-a', '1021');
		await expect(page.locator('#calc-error')).toContainText('"2" is not a binary digit');
	});

	test('the calculator strikes through shifted-out bits and resets the count on switching to a shift', async ({
		page
	}) => {
		await page.goto('/binary-calculator?a=11111111&b=2&op=shl&bits=8');
		await expect(page.locator('.answer-value').first()).toHaveText('1111 1100');
		await expect(page.locator('.warning')).toContainText('struck through');
		await expect(page.locator('.tool .working-scroll td.overflow')).toHaveCount(2);
		await expect(page.locator('.answer-check')).toHaveText('In decimal: 255 << 2 = 1020; 8 bits keep 252');
		await page.goto('/binary-calculator');
		await expect(page.locator('#calc-b')).toHaveValue('11011');
		await page.locator('.op-btn[title="Shift left"]').click();
		await expect(page.locator('#calc-b')).toHaveValue('1');
		await expect(page.locator('#calc-error')).toHaveCount(0);
		await expect(page.locator('.answer-value').first()).toHaveText('101 1010');
	});

	test('the calculator warns of signed overflow rather than claiming the true difference', async ({ page }) => {
		await page.goto('/binary-calculator?a=0&b=11111111&op=sub&bits=8');
		await expect(page.locator('.answer-value').first()).toHaveText('0000 0001');
		await expect(page.locator('.results')).toContainText('Signed overflow');
		await expect(page.locator('.results')).not.toContainText('which is the true difference');
		await expect(page.locator('.answer-check')).toHaveText('In decimal: 0 − 255 = −255; 8 bits keep 1');
		await page.goto('/binary-calculator?a=11&b=101&op=sub&bits=8');
		await expect(page.locator('.results')).toContainText('it is −2, which is the true difference');
	});

	test('the binary calculator FAQ names the carry and overflow flags correctly', async ({ page }) => {
		await page.goto('/binary-calculator');
		const faq = page.locator('#faq, section:has(h2:text("Questions"))').first();
		await expect(faq).toContainText('carry flag');
		await expect(faq).toContainText('overflow flag (V or OF)');
		await expect(page.locator('h1 ~ h3, .intro h3')).toHaveCount(0);
	});

	test('the hex calculator divides with a remainder', async ({ page }) => {
		await page.goto('/hex-calculator?a=FFFF&b=3&op=div');
		await expect(page.locator('.answer-value').first()).toHaveText('5555');
		await expect(page.locator('.div-table tbody tr')).toHaveCount(4);
	});

	test('hex to decimal works both ways', async ({ page }) => {
		await page.goto('/hex-to-decimal?v=FF');
		await expect(page.locator('.answer-value')).toHaveText('255');
		await page.getByRole('button', { name: 'Decimal to hex' }).click();
		await expect(page.locator('#value')).toHaveValue('255');
		await expect(page.locator('.answer-value')).toHaveText('FF');
	});

	test('the IEEE 754 converter shows the fields of 0.1', async ({ page }) => {
		await page.goto('/ieee-754-converter');
		await expect(page.locator('.hint .mono')).toHaveText('3DCCCCCD');
		await expect(page.locator('.answer.wide .answer-value')).toHaveText('0.100000001490116119384765625');
		await page.getByRole('button', { name: 'Double (64 bit)' }).click();
		await expect(page.locator('.hint .mono')).toHaveText('3FB999999999999A');
	});
});
