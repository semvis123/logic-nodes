import { expect, test } from '@playwright/test';
import {
	cellIndex,
	emptyCells,
	exitOf,
	fewestParts,
	leversOf,
	outputs,
	partCount,
	simulate,
	type Part,
	type Setup
} from '../src/lib/marble/engine.js';
import { levels, solutionCells } from '../src/lib/marble/levels.js';

const setup: Setup = { cols: 5, rows: 4, start: 2, cups: [2] };

test('an empty board drops the marble straight into the cup', () => {
	const run = simulate(setup, emptyCells(setup), []);
	expect(run.landing).toBe(2);
	expect(run.cup).toBe(true);
	expect(run.steps).toHaveLength(4);
});

test('levers read like a truth table: lever A is the top bit', () => {
	expect(leversOf(2, 0)).toEqual([false, false]);
	expect(leversOf(2, 1)).toEqual([false, true]);
	expect(leversOf(2, 2)).toEqual([true, false]);
	expect(leversOf(3, 5)).toEqual([true, false, true]);
});

test('each part sends the marble where its rule says', () => {
	const plank: Part = { kind: 'plank', lever: 0, open: 'down', side: 1 };
	expect(exitOf(plank, [true])).toBe(0);
	expect(exitOf(plank, [false])).toBe(1);
	expect(exitOf({ ...plank, open: 'up' }, [true])).toBe(1);
	expect(exitOf({ ...plank, open: 'up' }, [false])).toBe(0);
	expect(exitOf({ ...plank, side: -1 }, [false])).toBe(-1);
	expect(exitOf({ kind: 'ramp', side: -1 }, [])).toBe(-1);
	const seesaw: Part = { kind: 'seesaw', a: 0, b: 1 };
	expect(exitOf(seesaw, [false, false])).toBe(0);
	expect(exitOf(seesaw, [true, true])).toBe(0);
	expect(exitOf(seesaw, [true, false])).toBe(-1);
	expect(exitOf(seesaw, [false, true])).toBe(1);
});

test('a marble that slides off the side of the board is lost, not in a cup', () => {
	const cells = emptyCells(setup);
	cells[cellIndex(setup, 2, 0)] = { kind: 'ramp', side: 1 };
	cells[cellIndex(setup, 3, 1)] = { kind: 'ramp', side: 1 };
	cells[cellIndex(setup, 4, 2)] = { kind: 'ramp', side: 1 };
	const run = simulate(setup, cells, []);
	expect(run.landing).toBeNull();
	expect(run.cup).toBe(false);
	expect(run.steps).toHaveLength(3);
});

test('the same board and levers always give the same run', () => {
	const cells = solutionCells(levels[10]);
	for (let setting = 0; setting < 8; setting++) {
		const levers = leversOf(3, setting);
		expect(simulate(levels[10].setup, cells, levers)).toEqual(simulate(levels[10].setup, cells, levers));
	}
});

for (const level of levels) {
	test(`level ${level.id}: the reference solution hits the target with exactly the par`, () => {
		const cells = solutionCells(level);
		expect(outputs(level.setup, cells, level.levers)).toEqual(level.target);
		expect(partCount(cells)).toBe(level.par);
		// Every part in the solution is one the tray offers, tied to a lever that exists.
		for (const [, , part] of level.solution) {
			expect(level.tray).toContain(part.kind);
			if (part.kind === 'plank') expect(part.lever).toBeLessThan(level.levers);
			if (part.kind === 'seesaw') expect([part.a, part.b].every((l) => l < level.levers)).toBe(true);
		}
		// The target is neither always true nor always false, so it is worth building.
		expect(new Set(level.target).size).toBe(2);
		// An empty board must not already solve it.
		expect(outputs(level.setup, emptyCells(level.setup), level.levers)).not.toEqual(level.target);
	});

	if (level.provePar)
		test(`level ${level.id}: nothing with fewer than ${level.par} parts solves it`, () => {
			test.setTimeout(240_000);
			const best = fewestParts(level.setup, level.tray, level.levers, level.target, level.par);
			expect(best).toBe(level.par);
		});
}

test('every level gets a bit harder: more levers or more parts, never fewer of both', () => {
	for (let i = 1; i < levels.length; i++) {
		const before = levels[i - 1];
		const now = levels[i];
		expect(now.levers >= before.levers || now.par >= before.par, `level ${now.id}`).toBe(true);
	}
	expect(levels.map((l) => l.id)).toEqual(levels.map((_, i) => i + 1));
});

// --- the page ---------------------------------------------------------------

import type { Page } from '@playwright/test';

const STORAGE_KEY = 'logicgates-marble-machine:v1';

/** Opens the game with some levels already solved and some boards already built. */
async function open(page: Page, url = '/marble-machine', saved?: { solved?: Record<number, number>; boards?: Record<number, unknown> }) {
	if (saved) {
		await page.addInitScript(
			([key, value]) => {
				if (!localStorage.getItem(key)) localStorage.setItem(key, value);
			},
			[STORAGE_KEY, JSON.stringify({ solved: saved.solved ?? {}, boards: saved.boards ?? {} })]
		);
	}
	await page.goto(url);
	await expect(page.locator('.game[data-ready="true"] .machine')).toBeVisible();
}

const cell = (page: Page, row: number, col: number) => page.locator(`[data-cell="${row},${col}"]`);
const status = (page: Page) => page.getByTestId('status');
const allSolved = Object.fromEntries(levels.map((l) => [l.id, l.par]));

test('level 1 can be solved by picking a plank and tapping a square', async ({ page }) => {
	await open(page);
	await expect(page.getByTestId('hint')).toContainText('lever A is down');
	// Level 2 is locked until level 1 is solved.
	await expect(page.getByRole('button', { name: /^Level 2/ })).toBeDisabled();

	await page.locator('[data-tray="plank"]').click();
	await cell(page, 0, 2).click();
	await expect(cell(page, 0, 2)).toHaveAttribute('aria-label', /plank tied to lever A/);
	await expect(status(page)).toContainText('1 part placed');

	await page.getByRole('button', { name: 'Test all settings' }).click();
	await expect(status(page)).toContainText('Solved with 1 part', { timeout: 20_000 });
	await expect(page.getByRole('button', { name: /^Level 2/ })).toBeEnabled();
	await expect(page.locator('.card.ok')).toHaveCount(2);

	await page.getByRole('button', { name: 'Next level' }).click();
	await expect(page.getByTestId('hint')).toContainText('Level 2');
});

test('the inspector changes how a part behaves, which level 2 needs', async ({ page }) => {
	await open(page, '/marble-machine?level=2', { solved: { 1: 1 } });
	await page.locator('[data-tray="plank"]').click();
	await cell(page, 0, 2).click();
	// A plank as it comes opens when the lever is down, which is the wrong way round here.
	await page.getByRole('button', { name: 'Test all settings' }).click();
	await expect(page.locator('.card.bad')).toHaveCount(2, { timeout: 20_000 });
	await page.getByRole('group', { name: 'Lets the marble through when it is' }).getByRole('button', { name: 'Up' }).click();
	await expect(cell(page, 0, 2)).toHaveAttribute('aria-label', /opens when it is up/);
	// Changing the part throws the old test away.
	await expect(page.locator('.card.bad')).toHaveCount(0);
	await page.getByRole('button', { name: 'Test all settings' }).click();
	await expect(status(page)).toContainText('Solved with 1 part', { timeout: 20_000 });
});

test('parts can be dragged from the tray, moved, and dragged back to remove them', async ({ page }) => {
	await open(page);
	const tray = page.locator('[data-tray="plank"]');
	const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
		await page.mouse.move(to.x, to.y, { steps: 4 });
		await page.mouse.up();
	};
	const centre = async (locator: ReturnType<typeof cell>) => {
		const box = (await locator.boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	};

	await drag(await centre(tray), await centre(cell(page, 1, 3)));
	await expect(cell(page, 1, 3)).toHaveAttribute('aria-label', /plank/);

	await drag(await centre(cell(page, 1, 3)), await centre(cell(page, 0, 1)));
	await expect(cell(page, 0, 1)).toHaveAttribute('aria-label', /plank/);
	await expect(cell(page, 1, 3)).toHaveAttribute('aria-label', /empty/);

	await drag(await centre(cell(page, 0, 1)), await centre(tray));
	await expect(cell(page, 0, 1)).toHaveAttribute('aria-label', /empty/);
	await expect(status(page)).toContainText('0 parts placed');
});

test('everything can be done from the keyboard', async ({ page }) => {
	await open(page);
	await page.locator('[data-tray="plank"]').focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('[data-tray="plank"]')).toHaveAttribute('aria-pressed', 'true');
	await cell(page, 0, 2).focus();
	await page.keyboard.press('Enter');
	await expect(cell(page, 0, 2)).toHaveAttribute('aria-label', /plank tied to lever A/);
	// Arrow keys walk the grid, and Delete takes a part out.
	await page.keyboard.press('ArrowDown');
	await expect(cell(page, 1, 2)).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('Delete');
	await expect(cell(page, 0, 2)).toHaveAttribute('aria-label', /empty/);
	// Levers are switches that work from the keyboard too.
	const lever = page.getByRole('switch', { name: 'Lever A' });
	await lever.focus();
	await page.keyboard.press('Space');
	await expect(lever).toHaveAttribute('aria-checked', 'true');
});

test('a board and solved levels survive a reload', async ({ page }) => {
	await open(page);
	await page.locator('[data-tray="plank"]').click();
	await cell(page, 0, 2).click();
	await page.reload();
	await expect(cell(page, 0, 2)).toHaveAttribute('aria-label', /plank/);
	await page.getByRole('button', { name: 'Test all settings' }).click();
	await expect(status(page)).toContainText('Solved', { timeout: 20_000 });
	await page.reload();
	await expect(page.getByRole('button', { name: /^Level 1, solved/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Level 2/ })).toBeEnabled();
});

test('a link cannot skip levels you have not reached', async ({ page }) => {
	await open(page, '/marble-machine?level=7');
	await expect(page.getByTestId('hint')).toContainText('Level 1');
	await open(page, '/marble-machine?level=3', { solved: { 1: 1, 2: 1 } });
	await expect(page.getByTestId('hint')).toContainText('Level 3');
});

test('a wrong machine marks the failing settings, and tapping one replays it with its route', async ({ page }) => {
	// A plank that opens when A is up: right for level 2, wrong for level 1.
	const board = Array(15).fill(null);
	board[2] = { kind: 'plank', lever: 0, open: 'up', side: 1 };
	await open(page, '/marble-machine', { boards: { 1: board } });
	await page.getByRole('button', { name: 'Test all settings' }).click();
	await expect(status(page)).toContainText('0 of 2 settings match', { timeout: 20_000 });
	await expect(page.locator('.card.bad')).toHaveCount(2);
	await expect(page.locator('.trail')).toHaveCount(1);
	await page.locator('.cards .card').first().click();
	await expect(status(page)).toContainText(/It (reached|missed) the cup/, { timeout: 10_000 });
	await expect(page.locator('.trail')).toHaveCount(1);
});

test('with reduced motion the marble result is instant and the levers still work', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const solution = levels[8].solution;
	const board = Array(levels[8].setup.cols * levels[8].setup.rows).fill(null);
	for (const [col, row, part] of solution) board[row * levels[8].setup.cols + col] = part;
	await open(page, '/marble-machine?level=9', { solved: allSolved, boards: { 9: board } });
	await page.getByRole('button', { name: 'Test all settings' }).click();
	await expect(status(page)).toContainText('Solved with 3 parts', { timeout: 3000 });
});

for (const level of levels) {
	test(`level ${level.id} can be solved through the page with its reference solution`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const board = Array(level.setup.cols * level.setup.rows).fill(null);
		for (const [col, row, part] of level.solution) board[row * level.setup.cols + col] = part;
		await open(page, `/marble-machine?level=${level.id}`, { solved: allSolved, boards: { [level.id]: board } });
		await expect(page.locator('[data-cell]')).toHaveCount(level.setup.cols * level.setup.rows);
		await page.getByRole('button', { name: 'Test all settings' }).click();
		await expect(status(page)).toContainText(`Solved with ${level.par} ${level.par === 1 ? 'part' : 'parts'}`, {
			timeout: 5000
		});
		await expect(page.locator('.card.ok')).toHaveCount(1 << level.levers);
	});
}
