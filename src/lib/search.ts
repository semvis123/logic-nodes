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

/** On a tie, the tool first. */
const kindOrder: SearchKind[] = ['Tool', 'Page', 'Gate', 'Flip-flop', 'Circuit', 'Lesson', 'Term'];

const wordStart = (word: string) => new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

const startsWord = (text: string, word: string) => wordStart(word).test(text);

/**
 * How far into the keywords a word that missed the title was found. Keywords
 * are written most important first, so on an exact tie the page that lists the
 * word earlier is the one it is more about: "cidr" is the subnet calculator's
 * fifth keyword but only the VLSM calculator's tenth.
 */
function keywordPosition(word: string, title: string, keywords: string): number {
	if (title.includes(word)) return 0;
	const at = keywords.search(wordStart(word));
	if (at >= 0) return at;
	const inside = keywords.indexOf(word);
	return inside >= 0 ? inside : keywords.length;
}

/**
 * Whether two words are within `max` edits, counting a swap of two neighbouring
 * letters as one edit, since "diagarm" is one slip, not two.
 */
export function within(a: string, b: string, max: number): boolean {
	if (Math.abs(a.length - b.length) > max) return false;
	const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
	for (let j = 1; j <= b.length; j++) d[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		let rowMin = Infinity;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			rowMin = Math.min(rowMin, d[i][j]);
		}
		if (rowMin > max) return false;
	}
	return d[a.length][b.length] <= max;
}

const wordsOf = (text: string) => text.split(/[^a-z0-9]+/).filter(Boolean);

/** A misspelt word still matches a word, or the start of one, that it is close to. */
function fuzzyScore(word: string, title: string, keywords: string): number {
	if (word.length < 4) return 0;
	const max = word.length >= 7 ? 2 : 1;
	const near = (candidates: string[]) =>
		candidates.some(
			(w) => within(word, w, max) || (w.length > word.length && within(word, w.slice(0, word.length), max))
		);
	if (near(wordsOf(title))) return 45;
	if (near(wordsOf(keywords))) return 30;
	return 0;
}

function wordScore(word: string, title: string, keywords: string, hint: string): number {
	if (title.startsWith(word)) return 100;
	if (startsWord(title, word)) return 80;
	if (startsWord(keywords, word)) return 75;
	if (title.includes(word)) return 50;
	if (keywords.includes(word)) return 30;
	if (hint.includes(word)) return 20;
	return fuzzyScore(word, title, keywords);
}

export function search(entries: SearchEntry[], query: string, limit = 12): SearchEntry[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (!words.length) return entries.filter((entry) => entry.kind === 'Tool').slice(0, limit);
	const phrase = words.join(' ');
	const scored: { entry: SearchEntry; score: number; pos: number }[] = [];
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
		const pos = words.reduce((sum, word) => sum + keywordPosition(word, title, keywords), 0);
		scored.push({ entry, score: score * kindWeight[entry.kind], pos });
	}
	return scored
		.sort(
			(a, b) =>
				b.score - a.score ||
				kindOrder.indexOf(a.entry.kind) - kindOrder.indexOf(b.entry.kind) ||
				a.pos - b.pos ||
				a.entry.title.length - b.entry.title.length
		)
		.slice(0, limit)
		.map((s) => s.entry);
}
