// Where a learner is in the course. Kept in localStorage only: there are no
// accounts on this site, and the roadmap is more useful with ticks on it than
// without. Every read and write is guarded, so a private window or blocked
// storage just means the ticks do not survive a reload.

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Done = 'passed' | 'marked';

export interface LessonProgress {
	/** How the lesson was completed, if it was. */
	done?: Done;
	/** Longest run of right answers in a row. */
	best: number;
	answered: number;
	correct: number;
}

export type ProgressMap = Record<string, LessonProgress>;

const KEY = 'logicgates-course';

function read(): ProgressMap {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function write(map: ProgressMap) {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(map));
	} catch {
		// Storage is full or blocked; the page keeps working without it.
	}
}

/**
 * Starts empty on the server and in the first client render, so the markup
 * matches on hydration, then loads from storage in loadProgress().
 */
export const progress = writable<ProgressMap>({});

export function loadProgress() {
	progress.set(read());
}

const blank = (): LessonProgress => ({ best: 0, answered: 0, correct: 0 });

function change(slug: string, fn: (entry: LessonProgress) => LessonProgress) {
	progress.update((map) => {
		const next = { ...map, [slug]: fn(map[slug] ?? blank()) };
		write(next);
		return next;
	});
}

/** Records one answer; `streak` is the run of right answers including this one. */
export function recordAnswer(slug: string, right: boolean, streak: number) {
	change(slug, (entry) => ({
		...entry,
		answered: entry.answered + 1,
		correct: entry.correct + (right ? 1 : 0),
		best: Math.max(entry.best, streak)
	}));
}

export function markDone(slug: string, how: Done) {
	// Passing the quiz outranks marking, and is never downgraded by it.
	change(slug, (entry) => ({ ...entry, done: entry.done === 'passed' ? 'passed' : how }));
}

export function clearLesson(slug: string) {
	change(slug, () => blank());
}

export function resetProgress() {
	progress.set({});
	if (!browser) return;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Nothing to clear, or storage is blocked.
	}
}

export const doneSlugs = derived(progress, (map) =>
	Object.entries(map)
		.filter(([, entry]) => entry.done)
		.map(([slug]) => slug)
);
