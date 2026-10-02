// The guess my number engine, checked exhaustively where the ranges allow it
// and against independent references written differently: Math.log2 for the
// counts, a brute-force set search for liar mode, a minimax search for the
// evil adversary. Then the page, as a player would use it.

import { expect, test } from '@playwright/test';
import {
	RANGES,
	rangeOf,
	ceilLog2,
	floorLog2,
	questionsNeeded,
	guessesNeeded,
	liarQuestionsNeeded,
	nextThreshold,
	playFind,
	answersFor,
	wrongAnswers,
	answersToText,
	answersFromText,
	bitOfQuestion,
	liarEncode,
	liarDecode,
	LIAR_TABLE,
	LIAR_QUESTIONS,
	honestReply,
	evilReply,
	narrowed,
	middleGuess,
	halvingGuesses,
	randomInRange,
	rangeFacts,
	type GameRange,
	type Reply
} from '../src/lib/guessNumber.js';

const range100 = rangeOf('100');
const range128 = rangeOf('128');

test.describe('counting questions', () => {
	test('ceil and floor log2 agree with Math.log2 and with powers of two', () => {
		for (let n = 1; n <= 5000; n++) {
			expect(ceilLog2(n)).toBe(Math.ceil(Math.log2(n)));
			expect(floorLog2(n)).toBe(Math.floor(Math.log2(n)));
		}
		for (let k = 0; k <= 30; k++) {
			expect(ceilLog2(2 ** k)).toBe(k);
			expect(ceilLog2(2 ** k + 1)).toBe(k + 1);
			expect(floorLog2(2 ** k)).toBe(k);
		}
	});

	test('the known counts', () => {
		expect(questionsNeeded(100)).toBe(7);
		expect(questionsNeeded(128)).toBe(7);
		expect(questionsNeeded(1000)).toBe(10);
		expect(questionsNeeded(1_000_000)).toBe(20);
		// A higher/lower guess has to name the last number too.
		expect(guessesNeeded(100)).toBe(7);
		expect(guessesNeeded(128)).toBe(8);
		expect(guessesNeeded(1000)).toBe(10);
		expect(guessesNeeded(1_000_000)).toBe(20);
		for (let n = 1; n < 3000; n++) expect(guessesNeeded(n)).toBe(Math.ceil(Math.log2(n + 1)));
	});

	test('the one-lie volume bound', () => {
		expect(liarQuestionsNeeded(128)).toBe(11);
		expect(liarQuestionsNeeded(1_000_000)).toBe(25);
		// 128 × 12 = 1536 fits in 2^11 = 2048; 128 × 11 = 1408 does not fit in 2^10.
		expect(128 * 12).toBeLessThanOrEqual(2 ** 11);
		expect(128 * 11).toBeGreaterThan(2 ** 10);
		expect(liarQuestionsNeeded(16)).toBe(7); // the Hamming(7,4) code
		expect(liarQuestionsNeeded(2048)).toBe(15); // the Hamming(15,11) code, which is perfect
	});

	test('the reference facts', () => {
		const f = rangeFacts(range100);
		expect(f).toMatchObject({ size: 100, bits: 6.64, questions: 7, guesses: 7, withOneLie: 11 });
		expect(rangeFacts(range128)).toMatchObject({ size: 128, bits: 7, questions: 7, guesses: 8, withOneLie: 11 });
	});
});

test.describe('the page finds your number', () => {
	test('the first question for 1 to 100 is "greater than 50?"', () => {
		expect(nextThreshold(1, 100)).toBe(50);
		expect(playFind(range100, []).next).toBe(50);
		expect(nextThreshold(0, 127)).toBe(63);
	});

	test('the worked example: 42 in 1 to 100', () => {
		const answers = answersFor(range100, 42);
		expect(answersToText(answers)).toBe('nyynynn');
		const state = playFind(range100, answers);
		expect(state.steps.map((s) => s.threshold)).toEqual([50, 25, 38, 44, 41, 43, 42]);
		expect(state.done).toBe(true);
		expect(state.lo).toBe(42);
	});

	test('every number in every range is found within ceil(log2 n) questions', () => {
		for (const range of RANGES) {
			const n = range.hi - range.lo + 1;
			const limit = questionsNeeded(n);
			let worst = 0;
			const bad: string[] = [];
			for (let secret = range.lo; secret <= range.hi; secret++) {
				const answers = answersFor(range, secret);
				const state = playFind(range, answers);
				// Plain checks in the hot loop: expect() per number is slow over a thousand of them.
				if (!state.done || state.lo !== secret) bad.push(`${range.label}: ${secret} landed on ${state.lo}`);
				if (answers.length > limit) bad.push(`${range.label}: ${secret} took ${answers.length}`);
				worst = Math.max(worst, answers.length);
				// Every intermediate range contains the secret.
				if (state.steps.some((s) => secret < s.lo || secret > s.hi)) bad.push(`${range.label}: ${secret} lost`);
			}
			expect(bad).toEqual([]);
			// And the bound is reached, so it is tight.
			expect(worst).toBe(limit);
		}
	});

	test('every answer sequence ends on a real number, and the search is a bijection', () => {
		// All 2^7 answer strings for 0 to 127 land on distinct numbers.
		const seen = new Set<number>();
		for (let mask = 0; mask < 128; mask++) {
			const answers = Array.from({ length: 7 }, (_, i) => ((mask >> (6 - i)) & 1) === 1);
			const state = playFind(range128, answers);
			expect(state.done).toBe(true);
			// For 0 to 127 the answers are the binary digits of the number.
			expect(state.lo).toBe(mask);
			seen.add(state.lo);
		}
		expect(seen.size).toBe(128);
	});

	test('0 to 127 asks bit questions, 64s down to 1s', () => {
		const state = playFind(range128, answersFor(range128, 42));
		expect(state.steps.map((s) => s.bit)).toEqual([6, 5, 4, 3, 2, 1, 0]);
		expect(answersToText(state.steps.map((s) => s.answer))).toBe('nynynyn');
		expect((42).toString(2).padStart(7, '0')).toBe('0101010');
		expect(bitOfQuestion(1, 100)).toBeNull();
		expect(bitOfQuestion(64, 127)).toBe(5);
		expect(bitOfQuestion(32, 95)).toBeNull();
	});

	test('extra answers after the end are ignored', () => {
		const state = playFind(range100, answersFromText('nyynynnyyy', 20) ?? []);
		expect(state.steps).toHaveLength(7);
		expect(state.lo).toBe(42);
	});

	test('a wrong answer is found once the real number is known', () => {
		const truth = answersFor(range100, 42);
		const slipped = truth.slice();
		slipped[2] = !slipped[2];
		const state = playFind(range100, slipped);
		expect(state.lo).not.toBe(42);
		const wrong = wrongAnswers(state.steps, 42);
		expect(wrong[0]).toBe(3);
		// Honest answers have no slips.
		expect(wrongAnswers(playFind(range100, truth).steps, 42)).toEqual([]);
	});

	test('the URL form of answers', () => {
		expect(answersFromText('', 7)).toEqual([]);
		expect(answersFromText('yny', 7)).toEqual([true, false, true]);
		expect(answersFromText('ynx', 7)).toBeNull();
		expect(answersFromText('YN', 7)).toBeNull();
		expect(answersFromText('yyyyyyyy', 7)).toBeNull();
		expect(answersFromText(undefined, 7)).toBeNull();
	});
});

test.describe('liar mode', () => {
	/** An independent decoder: try every number and every single lie. */
	function bruteDecode(answers: boolean[]): { number: number; lie: number } | null {
		const hits: { number: number; lie: number }[] = [];
		for (let n = 0; n < 128; n++) {
			const truth = LIAR_TABLE.map((q) => q.members.includes(n));
			const diff = truth.flatMap((t, i) => (t !== answers[i] ? [i + 1] : []));
			if (diff.length <= 1) hits.push({ number: n, lie: diff[0] ?? 0 });
		}
		expect(hits.length).toBeLessThanOrEqual(1);
		return hits[0] ?? null;
	}

	test('the question table', () => {
		expect(LIAR_TABLE.map((q) => q.role).join(' ')).toBe('check check data check data data data check data data data');
		expect(LIAR_TABLE.filter((q) => q.role === 'data').map((q) => q.value)).toEqual([64, 32, 16, 8, 4, 2, 1]);
		expect(LIAR_TABLE[0].covers).toEqual([3, 5, 7, 9, 11]);
		expect(LIAR_TABLE[1].covers).toEqual([3, 6, 7, 10, 11]);
		expect(LIAR_TABLE[3].covers).toEqual([5, 6, 7]);
		expect(LIAR_TABLE[7].covers).toEqual([9, 10, 11]);
		// Every question splits the 128 numbers exactly in half.
		for (const q of LIAR_TABLE) expect(q.members).toHaveLength(64);
		// A data question is a plain bit question.
		const q3 = LIAR_TABLE[2];
		expect(q3.members.every((n) => n >= 64)).toBe(true);
	});

	test('any two numbers differ in at least three answers', () => {
		const words = Array.from({ length: 128 }, (_, n) => liarEncode(n));
		let min = Infinity;
		for (let a = 0; a < 128; a++)
			for (let b = a + 1; b < 128; b++) {
				const d = words[a].filter((x, i) => x !== words[b][i]).length;
				min = Math.min(min, d);
			}
		expect(min).toBe(3);
	});

	test('all 128 numbers, with no lie and with each of the 11 possible lies', () => {
		let cases = 0;
		for (let n = 0; n < 128; n++) {
			const truth = liarEncode(n);
			const clean = liarDecode(truth);
			expect(clean.syndrome).toBe(0);
			expect(clean.verdict).toEqual({ kind: 'truth', number: n });
			cases++;
			for (let q = 1; q <= LIAR_QUESTIONS; q++) {
				const lied = truth.slice();
				lied[q - 1] = !lied[q - 1];
				const d = liarDecode(lied);
				expect(d.syndrome).toBe(q);
				expect(d.verdict).toEqual({ kind: 'lie', number: n, question: q, said: lied[q - 1] });
				expect(bruteDecode(lied)).toEqual({ number: n, lie: q });
				cases++;
			}
		}
		expect(cases).toBe(128 * 12);
	});

	test('every one of the 2048 answer patterns either decodes like brute force or is flagged', () => {
		let many = 0;
		for (let mask = 0; mask < 2048; mask++) {
			const answers = Array.from({ length: 11 }, (_, i) => ((mask >> i) & 1) === 1);
			const d = liarDecode(answers);
			const brute = bruteDecode(answers);
			if (d.verdict.kind === 'many') {
				expect(brute).toBeNull();
				expect(d.syndrome).toBeGreaterThan(11);
				many++;
			} else {
				expect(brute).toEqual({ number: d.verdict.number, lie: d.verdict.kind === 'lie' ? d.verdict.question : 0 });
			}
		}
		// 2048 patterns, 1536 within one lie of a number, the rest unreachable with one lie.
		expect(many).toBe(2048 - 128 * 12);
	});

	test('known codewords, from the parity equations written out by hand', () => {
		// 42 = 0101010: data at positions 3,5,6,7,9,10,11 = 0,1,0,1,0,1,0.
		// p1 = d3^d5^d7^d9^d11 = 0^1^1^0^0 = 0, p2 = d3^d6^d7^d10^d11 = 0^0^1^1^0 = 0,
		// p4 = d5^d6^d7 = 1^0^1 = 0, p8 = d9^d10^d11 = 0^1^0 = 1.
		const bits = (n: number) =>
			liarEncode(n)
				.map((b) => (b ? 1 : 0))
				.join('');
		expect(bits(42)).toBe('00001011010');
		expect(bits(0)).toBe('00000000000');
		// 127: every data bit 1, and every check covers an odd number of data bits (5, 5, 3 and 3).
		expect(bits(127)).toBe('11111111111');
		expect(bits(64)).toBe('11100000000');
	});

	test('the worked example: 42 with a lie on question 6', () => {
		const answers = liarEncode(42);
		answers[5] = !answers[5];
		const d = liarDecode(answers);
		expect(d.checks.filter((c) => c.odd).map((c) => c.check)).toEqual([2, 4]);
		expect(d.verdict).toMatchObject({ kind: 'lie', number: 42, question: 6 });
	});

	test('wrong lengths are refused', () => {
		expect(() => liarDecode([true])).toThrow(RangeError);
	});
});

test.describe('you guess the number', () => {
	test('honest replies', () => {
		expect(honestReply(42, 50)).toBe('lower');
		expect(honestReply(42, 30)).toBe('higher');
		expect(honestReply(42, 42)).toBe('correct');
	});

	test('halving finds every number within the bound, and reaches it', () => {
		for (const range of RANGES.slice(0, 3)) {
			const n = range.hi - range.lo + 1;
			let worst = 0;
			for (let s = range.lo; s <= range.hi; s++) {
				const g = halvingGuesses(range, s);
				expect(g).toBeLessThanOrEqual(guessesNeeded(n));
				worst = Math.max(worst, g);
			}
			expect(worst).toBe(guessesNeeded(n));
		}
		expect(halvingGuesses(range100, 50)).toBe(1);
		expect(middleGuess(1, 100)).toBe(50);
	});

	/** Plays a strategy against the evil page and checks every reply stays consistent. */
	function playEvil(range: GameRange, pick: (lo: number, hi: number) => number, preferHigher: () => boolean) {
		let { lo, hi } = range;
		const history: { guess: number; reply: Reply }[] = [];
		for (let count = 1; count < 10_000; count++) {
			const guess = pick(lo, hi);
			const r = evilReply(lo, hi, guess, preferHigher());
			history.push({ guess, reply: r.reply });
			// Some number is still consistent with every reply given.
			const left = narrowed(range, history);
			expect(left.lo).toBeLessThanOrEqual(left.hi);
			expect(left).toEqual({ lo: r.reply === 'correct' ? guess : r.lo, hi: r.reply === 'correct' ? guess : r.hi });
			// And the honest page with that secret would have said the same things.
			for (const h of history) expect(honestReply(left.lo, h.guess)).toBe(h.reply);
			if (r.reply === 'correct') return count;
			lo = r.lo;
			hi = r.hi;
		}
		throw new Error('never finished');
	}

	/** Minimax: the fewest guesses a perfect player needs against a perfect adversary, for n candidates. */
	function minimax(n: number, memo = new Map<number, number>()): number {
		if (n <= 0) return 0;
		if (n === 1) return 1;
		const known = memo.get(n);
		if (known !== undefined) return known;
		let best = Infinity;
		for (let g = 0; g < n; g++) best = Math.min(best, 1 + Math.max(minimax(g, memo), minimax(n - 1 - g, memo)));
		memo.set(n, best);
		return best;
	}

	test('the evil page forces the worst case on a halving player, and never contradicts itself', () => {
		for (const range of RANGES) {
			const n = range.hi - range.lo + 1;
			for (const tie of [true, false]) {
				expect(playEvil(range, middleGuess, () => tie)).toBe(guessesNeeded(n));
			}
		}
	});

	test('no strategy beats the evil page, and the bound is the minimax value', () => {
		const memo = new Map<number, number>();
		for (let n = 1; n <= 300; n++) expect(minimax(n, memo)).toBe(guessesNeeded(n));
		let seed = 7;
		const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x80000000);
		for (const range of [range100, range128, { lo: 1, hi: 7, key: '100', label: '' } as GameRange]) {
			const n = range.hi - range.lo + 1;
			for (let game = 0; game < 60; game++) {
				// Random guesses, sometimes outside the range or already ruled out.
				const pick = (lo: number, hi: number) =>
					random() < 0.1 ? range.lo + Math.floor(random() * n) : lo + Math.floor(random() * (hi - lo + 1));
				expect(playEvil(range, pick, () => random() < 0.5)).toBeGreaterThanOrEqual(guessesNeeded(n));
			}
		}
	});

	test('out of range guesses get a consistent hint and do not narrow anything', () => {
		expect(evilReply(10, 20, 5)).toEqual({ reply: 'higher', lo: 10, hi: 20 });
		expect(evilReply(10, 20, 25)).toEqual({ reply: 'lower', lo: 10, hi: 20 });
		expect(evilReply(10, 10, 10)).toEqual({ reply: 'correct', lo: 10, hi: 10 });
		expect(evilReply(10, 11, 10).reply).toBe('higher');
		expect(evilReply(10, 11, 11).reply).toBe('lower');
	});

	test('random secrets are uniform and in range', () => {
		const counts = new Map<number, number>();
		let x = 0;
		// Every 32-bit value in a stride, which covers the residues evenly apart from the discarded tail.
		for (let i = 0; i < 100_000; i++) {
			x = (x + 2654435761) >>> 0;
			const v = randomInRange(1, 100, () => x);
			if (v < 1 || v > 100) throw new Error(`out of range: ${v}`);
			counts.set(v, (counts.get(v) ?? 0) + 1);
		}
		expect(counts.size).toBe(100);
		for (const c of counts.values()) expect(Math.abs(c - 1000)).toBeLessThan(60);
		// Values in the discarded top block are rejected, not folded onto small numbers.
		const values = [2 ** 32 - 1, 5];
		expect(randomInRange(1, 100, () => values.shift() ?? 0)).toBe(6);
		expect(randomInRange(0, 0, () => 123)).toBe(0);
	});
});

test.describe('the guess-my-number page', () => {
	test('the prerendered page asks the first question and shows the worked examples', async ({ page }) => {
		const html = await (await page.request.get('/guess-my-number')).text();
		expect(html).toContain('Is your number greater than 50?');
		expect(html).toContain('Finding 42 in 1 to 100');
		expect(html).toContain('0101010 = 42');
		// No secret is chosen at build time.
		expect(html).not.toContain('Correct:');
	});

	test('answering finds the number, with buttons and with the keyboard', async ({ page }) => {
		await page.goto('/guess-my-number');
		await page.waitForLoadState('networkidle');
		const truth = answersFor(range100, 77);
		for (const [i, a] of truth.entries()) {
			if (i % 2) await page.keyboard.press(a ? 'y' : 'n');
			else await page.getByRole('button', { name: a ? /^Yes/ : /^No/ }).click();
		}
		await expect(page.locator('.question')).toContainText('Your number is 77.');
		await expect(page).toHaveURL(new RegExp(`a=${answersToText(truth)}`));
		// The Yes/No buttons are gone; focus stays in the game.
		await expect(page.getByRole('button', { name: 'That is my number' })).toBeFocused();
		await expect(page.locator('#game')).toContainText('2⁷ = 128 numbers, 6 only 64');
		await page.keyboard.press('Enter');
		await expect(page.locator('.result-text')).toHaveText(`Found 77 in ${truth.length} questions (1 to 100).`);
		await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
	});

	test('a wrong answer is pointed out once the real number is given', async ({ page }) => {
		const slipped = answersFor(range100, 42);
		slipped[2] = !slipped[2];
		await page.goto(`/guess-my-number?a=${answersToText(slipped)}`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'It is not' }).click();
		await page.fill('#actual', '42');
		await expect(page.locator('.slip-text')).toContainText('question 3');
		await page.fill('#actual', '500');
		await expect(page.locator('#slip-out [role="alert"]')).toBeVisible();
		await expect(page.locator('#actual')).toHaveAttribute('aria-invalid', 'true');
		// Thousands separators are fine, as in the guess box.
		await page.goto(`/guess-my-number?r=1000000&a=${answersToText(answersFor(rangeOf('1000000'), 5))}`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'It is not' }).click();
		await expect(page.locator('#actual')).toBeFocused();
		await page.fill('#actual', '777,777');
		await expect(page.locator('#actual')).toHaveAttribute('aria-invalid', 'false');
		await expect(page.locator('.slip-text')).toContainText('For 777,777, question 1');
	});

	test('a shared link round trips', async ({ page }) => {
		await page.goto('/guess-my-number');
		await page.waitForLoadState('networkidle');
		await page.selectOption('#range', '128');
		await page.getByRole('button', { name: /^Yes/ }).click();
		await page.getByRole('button', { name: /^No/ }).click();
		await expect(page).toHaveURL(/r=128&a=yn/);
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page.locator('.question')).toContainText('Question 3 of at most 7');
		await expect(page.locator('.question')).toContainText('16s bit');
		expect(page.url()).toBe(shared);
	});

	test('liar mode decodes a game with one lie and flags two', async ({ page }) => {
		const lied = liarEncode(93);
		lied[8] = !lied[8];
		await page.goto(`/guess-my-number?mode=liar&a=${answersToText(lied.slice(0, 10))}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.question')).toContainText('Question 11 of 11');
		await expect(page.locator('.num-grid .in')).toHaveCount(64);
		await page.getByRole('button', { name: lied[10] ? /^Yes/ : /^No/ }).click();
		await expect(page.locator('.question')).toContainText('Your number is 93.');
		await expect(page.locator('.question')).toContainText('You lied on question 9');
		await expect(page).toHaveURL(new RegExp(`mode=liar&a=${answersToText(lied)}`));
		// Lies on 4 and 8 break checks 4 and 8, a syndrome of 12: no such question, so two lies.
		const twice = liarEncode(5);
		twice[4 - 1] = !twice[4 - 1];
		twice[8 - 1] = !twice[8 - 1];
		expect(liarDecode(twice)).toMatchObject({ syndrome: 12, verdict: { kind: 'many' } });
		await page.goto(`/guess-my-number?mode=liar&a=${answersToText(twice)}`);
		await expect(page.locator('.question')).toContainText('More than one lie');
		await expect(page.locator('.question')).toContainText('add up to 12');
		await expect(page.locator('.result-text')).toHaveCount(0);
		// The two-lies chip shows the same flag rather than a confident wrong number.
		await page.getByRole('button', { name: 'Liar: two lies' }).click();
		await expect(page.locator('.question')).toContainText('More than one lie');
	});

	test('a link with an answer past the end of the search keeps only the answers used', async ({ page }) => {
		await page.goto('/guess-my-number?a=yyyyyyy');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.question')).toContainText('Your number is 100.');
		await expect(page).toHaveURL(/a=yyyyyy$/);
		await page.getByRole('button', { name: 'Undo last answer' }).click();
		await expect(page).toHaveURL(/a=yyyyy$/);
		await expect(page.locator('.question')).toContainText('Question 6');
	});

	test('a guess-mode link with a big range plays on that range', async ({ page }) => {
		await page.goto('/guess-my-number?mode=guess&r=1000000&evil=1');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#range')).toHaveValue('1000000');
		let lo = 1;
		let hi = 1_000_000;
		let count = 0;
		for (;;) {
			const g = Math.floor((lo + hi) / 2);
			await page.fill('#guess', String(g));
			await page.press('#guess', 'Enter');
			count++;
			const text = (await page.locator('.question .q-text').textContent()) ?? '';
			// 500,000 leaves 499,999 below and 500,000 above, so the bigger side is higher.
			if (count === 1) expect(text).toBe('Higher than 500,000.');
			if (text.startsWith('Correct')) break;
			if (text.startsWith('Higher')) lo = g + 1;
			else hi = g - 1;
			expect(lo).toBeLessThanOrEqual(hi);
		}
		expect(count).toBe(20);
		await expect(page.locator('.result-text')).toContainText('Cornered evil mode in 20 guesses (1 to 1,000,000)');
		// Focus moves to New game, not back to the top of the page.
		await expect(page.locator('#new-game')).toBeFocused();
		// The honest game on the same link picks its secret from the whole range, not from 1 to 100:
		// a guess of 500 is "lower" only for a secret below 500, 1 in 2,000 per game.
		await page.goto('/guess-my-number?mode=guess&r=1000000');
		await page.waitForLoadState('networkidle');
		const replies: string[] = [];
		for (let game = 0; game < 3; game++) {
			if (game) await page.getByRole('button', { name: 'New game' }).click();
			await page.fill('#guess', '500');
			await page.press('#guess', 'Enter');
			replies.push((await page.locator('.question .q-text').textContent()) ?? '');
		}
		expect(replies.some((r) => r.startsWith('Higher'))).toBe(true);
	});

	test('you guess mine: the hints are consistent and lead to the number', async ({ page }) => {
		await page.goto('/guess-my-number?mode=guess');
		await page.waitForLoadState('networkidle');
		let lo = 1;
		let hi = 100;
		for (let i = 0; i < 7; i++) {
			const g = Math.floor((lo + hi) / 2);
			await page.fill('#guess', String(g));
			await page.press('#guess', 'Enter');
			const text = (await page.locator('.question .q-text').textContent()) ?? '';
			if (text.startsWith('Correct')) break;
			if (text.startsWith('Higher')) lo = g + 1;
			else hi = g - 1;
		}
		await expect(page.locator('.question')).toContainText('Correct');
		await expect(page.locator('.result-text')).toContainText('halving never needs more than 7');
		// Out of range input is refused without counting.
		await page.getByRole('button', { name: 'New game' }).click();
		await page.fill('#guess', '101');
		await page.press('#guess', 'Enter');
		await expect(page.locator('[role="alert"]')).toHaveText('Guess a whole number from 1 to 100.');
		await expect(page.locator('.question')).toContainText('No guesses yet');
	});

	test('evil mode takes the full seven guesses from a halving player', async ({ page }) => {
		await page.goto('/guess-my-number?mode=guess&evil=1');
		await page.waitForLoadState('networkidle');
		let lo = 1;
		let hi = 100;
		let count = 0;
		for (;;) {
			const g = Math.floor((lo + hi) / 2);
			await page.fill('#guess', String(g));
			await page.press('#guess', 'Enter');
			count++;
			const text = (await page.locator('.question .q-text').textContent()) ?? '';
			if (text.startsWith('Correct')) break;
			if (text.startsWith('Higher')) lo = g + 1;
			else hi = g - 1;
			expect(lo).toBeLessThanOrEqual(hi);
		}
		expect(count).toBe(7);
		await expect(page.locator('.question')).toContainText('I never picked a number');
	});

	test('the FAQ JSON-LD matches the visible answers', async ({ page }) => {
		await page.goto('/guess-my-number');
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
		const faq = ld['@graph'][0].mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [
			q.name,
			q.acceptedAnswer.text
		]);
		const visible = await page
			.locator('.faq details')
			.evaluateAll((ds) =>
				ds.map((d) => [d.querySelector('summary')?.textContent?.trim(), d.querySelector('p')?.textContent?.trim()])
			);
		expect(visible).toEqual(faq);
		expect(faq.length).toBeGreaterThanOrEqual(4);
	});
});
