// Ranking for the Ctrl+K palette. Every word typed must match somewhere. A
// match in the title counts most, then the keywords (other names for the same
// thing), then the one-line hint.
import type { SearchEntry, SearchKind } from '$lib/searchIndex';

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '');

/**
 * Tools and pages ahead of the many glossary terms and lessons: a term named
 * exactly what you typed still loses to the tool that does it.
 */
const kindWeight: Record<SearchKind, number> = {
	Tool: 1,
	Page: 1,
	Gate: 0.95,
	'Flip-flop': 0.95,
	Circuit: 0.9,
	Lesson: 0.7,
	Term: 0.6
};

const startsWord = (text: string, word: string) =>
	new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text);

function wordScore(word: string, title: string, keywords: string, hint: string): number {
	if (title.startsWith(word)) return 100;
	if (startsWord(title, word)) return 80;
	if (startsWord(keywords, word)) return 75;
	if (title.includes(word)) return 50;
	if (keywords.includes(word)) return 30;
	if (hint.includes(word)) return 20;
	return 0;
}

export function search(entries: SearchEntry[], query: string, limit = 12): SearchEntry[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (!words.length) return entries.filter((entry) => entry.kind === 'Tool').slice(0, limit);
	const phrase = words.join(' ');
	const scored: { entry: SearchEntry; score: number }[] = [];
	for (const entry of entries) {
		const title = fold(entry.title);
		const keywords = fold(entry.keywords ?? '');
		const hint = fold(entry.hint);
		let score = 0;
		for (const word of words) {
			const s = wordScore(word, title, keywords, hint);
			if (!s) {
				score = 0;
				break;
			}
			score += s;
		}
		if (!score) continue;
		// The words together, in order, beat the same words scattered.
		if (words.length > 1 && (title.includes(phrase) || keywords.includes(phrase))) score += 40;
		if (title === phrase) score += 10;
		scored.push({ entry, score: score * kindWeight[entry.kind] });
	}
	return scored
		.sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length)
		.slice(0, limit)
		.map((s) => s.entry);
}
