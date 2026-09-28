import { expect, test } from '@playwright/test';
import {
	GUESSER_SIZES,
	MAX_GUESSES,
	checkGuess,
	dayNumber,
	puzzleFor,
	remainingFunctions,
	rowLabel,
	shareText
} from '../src/lib/guesser.js';
import { equivalent, parseExpression, truthTable } from '../src/lib/boolean.js';

test('the same seed always gives the same puzzle', () => {
	for (const size of GUESSER_SIZES) {
		for (const seed of [0, 1, 42, 9999]) {
			expect(puzzleFor(seed, size)).toEqual(puzzleFor(seed, size));
		}
	}
});

test('every puzzle depends on every variable and its answer reproduces its rows', () => {
	for (const size of GUESSER_SIZES) {
		for (let seed = 0; seed < 300; seed++) {
			const puzzle = puzzleFor(seed, size);
			expect(puzzle.rows).toHaveLength(1 << size);
			expect(new Set(puzzle.rows).size, `constant at seed ${seed}`).toBe(2);
			puzzle.variables.forEach((_, bit) => {
				const mask = 1 << (size - 1 - bit);
				expect(puzzle.rows.some((v, i) => v !== puzzle.rows[i ^ mask]), `ignores variable ${bit}`).toBe(true);
			});
			const again = truthTable(parseExpression(puzzle.answer), puzzle.variables).rows;
			expect(again).toEqual(puzzle.rows);
		}
	}
});

test('different seeds give a spread of puzzles', () => {
	for (const size of GUESSER_SIZES) {
		const seen = new Set(Array.from({ length: 200 }, (_, seed) => puzzleFor(seed, size).rows.join('')));
		expect(seen.size).toBeGreaterThan(size === 2 ? 5 : 40);
	}
});

test('any equivalent expression is correct, and the answer itself always is', () => {
	const puzzle = puzzleFor(7, 3);
	expect(checkGuess(puzzle, puzzle.answer)).toEqual({ kind: 'correct' });
	// Reordered and double negated, but the same function.
	const ast = parseExpression(puzzle.answer);
	expect(equivalent(ast, parseExpression(`!!(${puzzle.answer})`))).toBe(true);
	expect(checkGuess(puzzle, `!!(${puzzle.answer})`)).toEqual({ kind: 'correct' });
});

test('a wrong guess reports a count, and the count is honest', () => {
	const puzzle = puzzleFor(3, 3);
	const result = checkGuess(puzzle, 'a');
	expect(result.kind).toBe('wrong');
	if (result.kind === 'wrong') {
		const guess = truthTable(parseExpression('a'), puzzle.variables).rows;
		expect(result.total).toBe(8);
		expect(result.matching).toBe(guess.filter((v, i) => v === puzzle.rows[i]).length);
		expect(result.matching).toBeLessThan(8);
	}
});

test('bad guesses are refused with a reason instead of costing a guess', () => {
	const puzzle = puzzleFor(3, 3);
	const empty = checkGuess(puzzle, '   ');
	expect(empty.kind).toBe('invalid');
	const broken = checkGuess(puzzle, 'a &');
	expect(broken.kind).toBe('invalid');
	const stray = checkGuess(puzzle, 'a & z');
	expect(stray).toMatchObject({ kind: 'invalid' });
	if (stray.kind === 'invalid') expect(stray.message).toContain('z');
	// d is a real variable, but not in a three variable puzzle.
	expect(checkGuess(puzzle, 'a & d').kind).toBe('invalid');
});

test('the day number counts days from 1 January 2026, in UTC', () => {
	expect(dayNumber(new Date(Date.UTC(2026, 0, 1)))).toBe(0);
	expect(dayNumber(new Date(Date.UTC(2026, 0, 1, 23, 59)))).toBe(0);
	expect(dayNumber(new Date(Date.UTC(2026, 0, 2)))).toBe(1);
	expect(dayNumber(new Date(Date.UTC(2026, 8, 28)))).toBe(270);
});

test('row labels, remaining functions and the share text', () => {
	const puzzle = puzzleFor(1, 3);
	expect(rowLabel(puzzle, 5)).toBe('a=1 b=0 c=1');
	expect(remainingFunctions(puzzle, [])).toBe(256);
	expect(remainingFunctions(puzzle, [0, 3, 7])).toBe(32);
	expect(MAX_GUESSES).toBeGreaterThan(0);
	const won = shareText({ label: '#270', size: 3, probes: 3, guesses: 2, won: true });
	expect(won).toContain('🟥🟩 solved: 2 guesses, 3 probes');
	expect(won).toContain('🟦🟦🟦⬜⬜⬜⬜⬜');
	// The share text never contains the answer or the hidden rows.
	expect(shareText({ label: '#1', size: 2, probes: 1, guesses: 6, won: false })).toContain('not solved: 6 guesses, 1 probe');
});

test('the page plays end to end: probe, guess wrong, guess right', async ({ page }) => {
	await page.goto('/boolean-function-guesser?n=2&seed=5');
	await expect(page.locator('h1')).toHaveText('Boolean function guesser');
	const puzzle = puzzleFor(5, 2);
	const reveal = page.getByRole('button', { name: /Reveal the output for/ });
	await expect(reveal).toHaveCount(4);
	await reveal.first().click();
	await expect(reveal).toHaveCount(3);
	await expect(page.getByText('1 of 4 rows probed.')).toBeVisible();

	await page.getByRole('textbox', { name: 'Your guess for the function' }).fill('a & z');
	await page.getByRole('button', { name: 'Guess', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('z');

	const wrongGuess = puzzle.rows.join('') === '0001' ? 'a | b' : 'a & b';
	await page.getByRole('textbox', { name: 'Your guess for the function' }).fill(wrongGuess);
	await page.getByRole('button', { name: 'Guess', exact: true }).click();
	await expect(page.getByRole('list', { name: 'Guesses so far' }).locator('li')).toHaveCount(1);

	await page.getByRole('textbox', { name: 'Your guess for the function' }).fill(puzzle.answer);
	await page.getByRole('button', { name: 'Guess', exact: true }).click();
	await expect(page.getByText(/Solved in 2 guesses/)).toBeVisible();
	await expect(page.getByRole('button', { name: /Reveal the output/ })).toHaveCount(0);

	// Progress survives a reload.
	await page.reload();
	await expect(page.getByText(/Solved in 2 guesses/)).toBeVisible();
});

test('giving up shows an answer that is really the hidden function', async ({ page }) => {
	await page.goto('/boolean-function-guesser?n=3&seed=11');
	await page.getByRole('button', { name: /Reveal the output for/ }).first().click();
	await page.getByRole('button', { name: 'Give up and show the answer' }).click();
	await expect(page.getByText(/Out of guesses/)).toBeVisible();
	const shown = await page.locator('.lose .mono').innerText();
	expect(truthTable(parseExpression(shown), ['a', 'b', 'c']).rows).toEqual(puzzleFor(11, 3).rows);
});
