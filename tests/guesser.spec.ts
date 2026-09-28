import { expect, test } from '@playwright/test';
import {
	GUESSER_SIZES,
	WRONG_PENALTY,
	dayNumber,
	optionsFor,
	puzzleFor,
	scoreOf,
	shareText
} from '../src/lib/guesser.js';
import { parseExpression, truthTable } from '../src/lib/boolean.js';

test('the same seed always gives the same box and the same options', () => {
	for (const size of GUESSER_SIZES) {
		for (const seed of [0, 1, 42, 9999]) {
			const puzzle = puzzleFor(seed, size);
			expect(puzzle).toEqual(puzzleFor(seed, size));
			expect(optionsFor(puzzle, seed)).toEqual(optionsFor(puzzle, seed));
		}
	}
});

test('every box depends on every switch', () => {
	for (const size of GUESSER_SIZES) {
		for (let seed = 0; seed < 300; seed++) {
			const puzzle = puzzleFor(seed, size);
			expect(puzzle.rows).toHaveLength(1 << size);
			expect(new Set(puzzle.rows).size, `constant at seed ${seed}`).toBe(2);
			puzzle.variables.forEach((_, bit) => {
				const mask = 1 << (size - 1 - bit);
				expect(puzzle.rows.some((v, i) => v !== puzzle.rows[i ^ mask]), `ignores switch ${bit}`).toBe(true);
			});
		}
	}
});

test('different seeds give a spread of boxes', () => {
	for (const size of GUESSER_SIZES) {
		const seen = new Set(Array.from({ length: 200 }, (_, seed) => puzzleFor(seed, size).rows.join('')));
		expect(seen.size).toBeGreaterThan(size === 2 ? 5 : 40);
	}
});

test('there are four distinct options and exactly one is the box', () => {
	for (const size of GUESSER_SIZES) {
		for (let seed = 0; seed < 200; seed++) {
			const puzzle = puzzleFor(seed, size);
			const options = optionsFor(puzzle, seed);
			expect(options, `size ${size} seed ${seed}`).toHaveLength(4);
			expect(new Set(options.map((o) => o.text)).size).toBe(4);
			expect(options.filter((o) => o.correct)).toHaveLength(1);
			// The right option really is the box, and no wrong one is.
			for (const option of options) {
				const rows = truthTable(parseExpression(option.text), puzzle.variables).rows;
				expect(rows.every((v, i) => v === puzzle.rows[i]), option.text).toBe(option.correct);
			}
		}
	}
});

test('the options are all written the same way, so the style gives nothing away', () => {
	const puzzle = puzzleFor(12, 3);
	for (const option of optionsFor(puzzle, 12)) expect(option.text).toMatch(/^[a-d!&| ()01]+$/);
});

test('the day number counts days from 1 January 2026, in UTC', () => {
	expect(dayNumber(new Date(Date.UTC(2026, 0, 1)))).toBe(0);
	expect(dayNumber(new Date(Date.UTC(2026, 0, 1, 23, 59)))).toBe(0);
	expect(dayNumber(new Date(Date.UTC(2026, 0, 2)))).toBe(1);
	expect(dayNumber(new Date(Date.UTC(2026, 8, 28)))).toBe(270);
});

test('a wrong pick costs more than a flip, and the share text has no spoilers', () => {
	expect(scoreOf(5, 0)).toBe(5);
	expect(scoreOf(5, 2)).toBe(5 + 2 * WRONG_PENALTY);
	const text = shareText({ label: '#270', size: 3, flips: 4, wrongPicks: 1 });
	expect(text).toContain('Mystery box #270 (3 switches)');
	expect(text).toContain('🔘🔘🔘🔘❌');
	expect(text).toContain('Score 7: 4 flips, 1 wrong pick');
	expect(shareText({ label: '#1', size: 2, flips: 1, wrongPicks: 0 })).toContain('Score 1: 1 flip, 0 wrong picks');
});

test('the page plays end to end: flip, pick wrong, pick right, and it survives a reload', async ({ page }) => {
	await page.goto('/boolean-function-guesser?n=2&seed=5');
	await expect(page.locator('h1')).toHaveText('Mystery box');
	const puzzle = puzzleFor(5, 2);
	const options = optionsFor(puzzle, 5);

	await expect(page.getByText('0 flips: score 0')).toBeVisible();
	const a = page.getByRole('button', { name: /^a/ });
	await a.click();
	await expect(a).toHaveAttribute('aria-pressed', 'true');
	// Switch a is the top bit, so this is row 2 (a=1, b=0).
	await expect(page.getByText(puzzle.rows[2] ? 'Lamp on' : 'Lamp off')).toBeVisible();
	await expect(page.getByText('1 flip: score 1')).toBeVisible();

	const wrongIndex = options.findIndex((o) => !o.correct);
	const choices = page.getByRole('group', { name: 'Choose an expression' }).getByRole('button');
	await choices.nth(wrongIndex).click();
	await expect(choices.nth(wrongIndex)).toBeDisabled();
	await expect(page.getByText(`1 flip, 1 wrong pick: score ${1 + WRONG_PENALTY}`)).toBeVisible();

	await choices.nth(options.findIndex((o) => o.correct)).click();
	await expect(page.getByText(`Solved with a score of ${1 + WRONG_PENALTY}.`)).toBeVisible();
	// Solved: the switches lock, and the notes show the whole table.
	await expect(a).toBeDisabled();

	await page.reload();
	await expect(page.getByText(`Solved with a score of ${1 + WRONG_PENALTY}.`)).toBeVisible();
});

test('every option can be reached and the right one always wins', async ({ page }) => {
	await page.goto('/boolean-function-guesser?n=4&seed=11');
	const options = optionsFor(puzzleFor(11, 4), 11);
	const choices = page.getByRole('group', { name: 'Choose an expression' }).getByRole('button');
	await expect(choices).toHaveCount(4);
	for (let i = 0; i < 4; i++) await expect(choices.nth(i)).toHaveText(options[i].text);
});

test('changing the number of switches redraws the box and the notes', async ({ page }) => {
	await page.goto('/boolean-function-guesser?n=3&seed=2');
	const switches = page.getByRole('group', { name: 'Switches', exact: true }).getByRole('button');
	const noteRows = page.getByRole('table', { name: /Settings you have tried/ }).locator('tbody tr');
	await expect(switches).toHaveCount(3);
	await expect(noteRows).toHaveCount(8);
	await page.getByRole('group', { name: 'Switches', exact: true }).getByRole('button').first().click();
	await page.getByRole('button', { name: '4', exact: true }).click();
	await expect(switches).toHaveCount(4);
	await expect(noteRows).toHaveCount(16);
	// Every note row has four input columns and the lamp, and the old flips are gone.
	await expect(noteRows.first().locator('td')).toHaveCount(5);
	await expect(page.getByText('0 flips: score 0')).toBeVisible();
});
