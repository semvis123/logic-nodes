// The course: every lesson's questions are sound across many seeds, every
// lesson has its prose and its place on the roadmap, and the quiz on a lesson
// page passes, hints and remembers the way the lesson text promises.

import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { stages, allLessons, lessonBySlug, neighbours } from '../src/lib/course/lessons.js';
import { rng } from '../src/lib/course/random.js';
import { PASS_STREAK } from '../src/lib/course/types.js';
import { sitemapPaths } from './sitemap.js';

const question = (slug: string, seed: number) => {
	const lesson = lessonBySlug(slug)!;
	return lesson.generators[seed % lesson.generators.length](rng(seed));
};

test('every question generator is sound across many seeds', () => {
	const problems: string[] = [];
	for (const lesson of allLessons) {
		expect(lesson.generators.length, `${lesson.slug} has no question generators`).toBeGreaterThan(0);
		for (let seed = 1; seed <= 400; seed++) {
			const q = question(lesson.slug, seed);
			const where = `${lesson.slug} seed ${seed}`;
			if (!q.prompt.trim()) problems.push(`${where}: empty prompt`);
			if (q.options.length < 2) problems.push(`${where}: only ${q.options.length} option(s)`);
			if (new Set(q.options).size !== q.options.length)
				problems.push(`${where}: duplicate options ${q.options.join(' | ')}`);
			if (q.answer < 0 || q.answer >= q.options.length)
				problems.push(`${where}: answer index ${q.answer} out of range`);
			if (q.options.some((o) => !String(o).trim())) problems.push(`${where}: blank option`);
			if (q.hints.length !== 2 || q.hints.some((h) => !h.trim())) problems.push(`${where}: needs two hints`);
			if (!q.explanation.trim()) problems.push(`${where}: no explanation`);
			// The same seed must replay the same question, or ?q= links break.
			const again = question(lesson.slug, seed);
			if (again.prompt !== q.prompt || again.answer !== q.answer) problems.push(`${where}: not deterministic`);
		}
	}
	expect(problems.slice(0, 20), problems.slice(0, 20).join('\n')).toEqual([]);
});

test('every lesson has prose, and every prose file is a lesson', () => {
	const files = readdirSync('src/lib/course/content')
		.filter((f) => f.endsWith('.svelte'))
		.map((f) => f.replace(/\.svelte$/, ''));
	const slugs = allLessons.map((l) => l.slug);
	expect(
		slugs.filter((s) => !files.includes(s)),
		'lessons with no content component'
	).toEqual([]);
	expect(
		files.filter((f) => !slugs.includes(f)),
		'content components not in the registry'
	).toEqual([]);
	expect(new Set(slugs).size, 'slugs must be unique').toBe(slugs.length);
	for (const lesson of allLessons) {
		expect(lesson.description.length, `${lesson.slug} description too long for a snippet`).toBeLessThanOrEqual(170);
		expect(lesson.minutes, `${lesson.slug} needs a duration`).toBeGreaterThan(0);
	}
	for (const stage of stages) expect(stage.lessons.length, `stage ${stage.id} has no lessons`).toBeGreaterThan(0);
});

test('every lesson is in the sitemap and every link on it lands', async ({ request }) => {
	const paths = await sitemapPaths(request);
	const missing = allLessons.map((l) => `/learn/${l.slug}`).filter((p) => !paths.includes(p));
	expect(missing, `lessons missing from the sitemap: ${missing.join(', ')}`).toEqual([]);

	const problems: string[] = [];
	const checked = new Map<string, number>();
	for (const lesson of allLessons) {
		const html = await (await request.get(`/learn/${lesson.slug}`)).text();
		const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
		for (const href of new Set(hrefs)) {
			const path = href.split(/[#?]/)[0];
			if (!checked.has(path)) checked.set(path, (await request.get(path)).status());
			if (checked.get(path) !== 200)
				problems.push(`/learn/${lesson.slug} links ${href} which returns ${checked.get(path)}`);
		}
	}
	expect(problems, problems.join('\n')).toEqual([]);
});

test('the quiz hints on a wrong answer, passes after a run, and remembers', async ({ page }) => {
	const slug = allLessons[0].slug;
	const seed = 7;
	await page.goto(`/learn/${slug}?q=${seed}`);
	await expect(page.locator('h1')).toHaveText(allLessons[0].title);

	const options = page.locator('.quiz .option');
	const first = question(slug, seed);
	await expect(options).toHaveCount(first.options.length);
	await expect(options.nth(0)).toContainText(first.options[0]);

	// A wrong answer: a hint, and the question stays, with that option locked.
	const wrongIndex = (first.answer + 1) % first.options.length;
	await options.nth(wrongIndex).click();
	await expect(page.locator('.feedback')).toContainText(first.hints[0]);
	await expect(options.nth(wrongIndex)).toBeDisabled();
	await expect(options.nth(first.answer)).toBeEnabled();

	// Right, then keep answering right until the lesson is passed.
	await options.nth(first.answer).click();
	await expect(page.locator('.feedback')).toContainText('Correct');
	for (let i = 1; i < PASS_STREAK; i++) {
		await page.locator('.quiz .next').click();
		// The card carries the seed of the question it shows, so the test can
		// generate the same question and pick its answer.
		const current = await page.locator('.quiz-card').getAttribute('data-seed');
		const q = question(slug, Number(current));
		await page.locator('.quiz .option').nth(q.answer).click();
		await expect(page.locator('.feedback')).toContainText('Correct');
	}
	await expect(page.locator('.quiz .passed-line')).toContainText('You passed');
	await expect(page.locator('.side .roadmap li.current.passed')).toHaveCount(1);

	// The tick survives a reload, and the course home offers the next lesson.
	await page.reload();
	await expect(page.locator('.quiz .passed-line')).toContainText('You passed');
	await page.goto('/learn');
	const next = neighbours(slug).next!;
	await expect(page.locator('.start .cta')).toContainText(next.title);
	await expect(page.locator(`.lessons li.passed a[href="/learn/${slug}"]`)).toHaveCount(1);

	// Reset clears it.
	page.once('dialog', (d) => d.accept());
	await page.locator('.start .link-btn').click();
	await expect(page.locator('.lessons li.passed')).toHaveCount(0);
});

test('a lesson marked as known gets a hollow tick, and the roadmap folds on a phone', async ({ page }) => {
	const slug = allLessons[1].slug;
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto(`/learn/${slug}`);
	await expect(page.locator('.side')).toBeHidden();
	const drawer = page.locator('.drawer');
	await expect(drawer).toBeVisible();
	await drawer.locator('summary').click();
	await expect(drawer.locator('.roadmap li.current')).toBeVisible();

	await page.locator('.know-it .link-btn').click();
	await expect(page.locator('.quiz .passed-line')).toContainText('Marked as known');
	await expect(drawer.locator('.roadmap li.current.marked')).toHaveCount(1);
});
