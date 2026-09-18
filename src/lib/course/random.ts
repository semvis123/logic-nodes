// Helpers for question generators. Everything is driven by a seeded generator
// so a question can be replayed from its seed, which is what makes a lesson
// link with ?q= reopen the same question and what lets the tests check every
// generator across thousands of seeds.

import type { Random } from './types.js';

/** Small deterministic PRNG (mulberry32), the same one the practice page uses. */
export function rng(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const pick = <T>(random: Random, items: readonly T[]): T => items[Math.floor(random() * items.length)];

/** An integer in [lo, hi], both ends included. */
export const int = (random: Random, lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));

export function shuffle<T>(random: Random, items: readonly T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Places the right answer among the distractors at a random position, dropping
 * any distractor that happens to equal the answer or another distractor, so an
 * option list never carries the same text twice.
 */
export function assemble(
	random: Random,
	correct: string,
	distractors: string[]
): { options: string[]; answer: number } {
	const unique = [...new Set(distractors.filter((d) => d !== correct))];
	const options = shuffle(random, [correct, ...unique]);
	return { options, answer: options.indexOf(correct) };
}

/** A binary string of a fixed width, for prompts and options. */
export const bin = (value: number, bits: number) => (value >>> 0).toString(2).padStart(bits, '0');

/** Groups a binary string in fours from the right, for readability. */
export const grouped = (binary: string) => binary.replace(/(\d)(?=(\d{4})+$)/g, '$1 ');
