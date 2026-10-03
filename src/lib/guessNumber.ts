// The guess my number game, three ways, as plain functions the page draws.
//
// 1. The page finds your number with "is it greater than X?" questions: a
//    binary search, where every answer is one bit of information.
// 2. Liar mode (Ulam's game): eleven questions fixed in advance, any one of
//    which you may answer falsely. The questions are the bits of a Hamming
//    code, so the answers can be decoded like a damaged message.
// 3. You guess the page's number, with higher/lower hints. In the evil variant
//    the page never picks a number and keeps whichever half is bigger.
//
// Nothing here is random: the page supplies the randomness (a crypto random
// secret, a coin for ties), so every function can be checked exhaustively.

export type RangeKey = '100' | '128' | '1000' | '1000000';

export interface GameRange {
	key: RangeKey;
	lo: number;
	hi: number;
	/** How the range is written in text: "1 to 100". */
	label: string;
}

/** The ranges on offer. 0 to 127 is there because it is exactly seven bits. */
export const RANGES: readonly GameRange[] = [
	{ key: '100', lo: 1, hi: 100, label: '1 to 100' },
	{ key: '128', lo: 0, hi: 127, label: '0 to 127' },
	{ key: '1000', lo: 1, hi: 1000, label: '1 to 1,000' },
	{ key: '1000000', lo: 1, hi: 1_000_000, label: '1 to 1,000,000' }
];

export const RANGE_KEYS = RANGES.map((r) => r.key);

export const rangeOf = (key: RangeKey): GameRange => RANGES.find((r) => r.key === key) ?? RANGES[0];

/** How many numbers a range holds. */
export const sizeOf = (lo: number, hi: number): number => hi - lo + 1;

/** ⌈log₂ n⌉ for n ≥ 1, in integers, so 128 is exactly 7 and not 7.000000001. */
export function ceilLog2(n: number): number {
	let bits = 0;
	while (2 ** bits < n) bits++;
	return bits;
}

/** ⌊log₂ n⌋ for n ≥ 1. */
export function floorLog2(n: number): number {
	let bits = 0;
	while (2 ** (bits + 1) <= n) bits++;
	return bits;
}

/**
 * Yes/no questions needed to pin down one of n numbers. Each answer can at
 * best halve what is left, and q answers can tell apart only 2^q cases.
 */
export const questionsNeeded = (n: number): number => ceilLog2(n);

/**
 * Guesses needed with higher/lower hints, counting the final, correct guess.
 * One more than ⌊log₂ n⌋, which is ⌈log₂(n + 1)⌉: a guess has three outcomes,
 * but the last number still has to be said out loud to win.
 */
export const guessesNeeded = (n: number): number => floorLog2(n) + 1;

/**
 * The fewest yes/no questions that can find one of n numbers when one answer
 * may be a lie. With q questions, each number has q + 1 possible answer
 * patterns (the truth, or the truth with any one answer flipped), and no two
 * numbers may share a pattern, so n(q + 1) ≤ 2^q. That holds even when the
 * questions are chosen one at a time (Berlekamp's volume bound).
 */
export function liarQuestionsNeeded(n: number): number {
	let q = 0;
	while (n * (q + 1) > 2 ** q) q++;
	return q;
}

/** Thousands separators, the way the page writes numbers. */
export const fmt = (n: number): string => n.toLocaleString('en-GB');

// ---------------------------------------------------------------------------
// Mode 1: the page finds your number.

/**
 * The X in "Is your number greater than X?". It puts ⌈s/2⌉ numbers on the "no"
 * side and ⌊s/2⌋ on the "yes" side, so whichever answer comes, at most ⌈s/2⌉
 * numbers are left. Halving the larger part is what keeps the count of
 * questions at ⌈log₂ n⌉ for every number, not just on average.
 */
export const nextThreshold = (lo: number, hi: number): number => lo + Math.ceil(sizeOf(lo, hi) / 2) - 1;

export interface FindStep {
	/** The candidates before this question. */
	lo: number;
	hi: number;
	/** "Is your number greater than threshold?" */
	threshold: number;
	answer: boolean;
	/** For a power of two range starting at a multiple of its size: the bit this question reads. */
	bit: number | null;
}

export interface FindState {
	steps: FindStep[];
	/** The candidates after every answer so far. */
	lo: number;
	hi: number;
	/** One number left: the search is over. */
	done: boolean;
	/** The next threshold, or null when done. */
	next: number | null;
	/** Which bit the next question reads, when the questions are bit questions. */
	nextBit: number | null;
}

/**
 * When the candidates are an aligned block of 2^k numbers, such as 64 to 127,
 * "greater than the middle" asks exactly whether bit k − 1 is 1. Starting from
 * 0 to 127 every question stays like that, so the answers spell the number.
 */
export function bitOfQuestion(lo: number, hi: number): number | null {
	const size = sizeOf(lo, hi);
	if (size < 2 || (size & (size - 1)) !== 0 || lo % size !== 0) return null;
	return floorLog2(size) - 1;
}

/** Replays a list of yes/no answers. Answers after the search has finished are ignored. */
export function playFind(range: GameRange, answers: readonly boolean[]): FindState {
	let { lo, hi } = range;
	const steps: FindStep[] = [];
	for (const answer of answers) {
		if (lo === hi) break;
		const threshold = nextThreshold(lo, hi);
		steps.push({ lo, hi, threshold, answer, bit: bitOfQuestion(lo, hi) });
		if (answer) lo = threshold + 1;
		else hi = threshold;
	}
	const done = lo === hi;
	return {
		steps,
		lo,
		hi,
		done,
		next: done ? null : nextThreshold(lo, hi),
		nextBit: done ? null : bitOfQuestion(lo, hi)
	};
}

/** The honest answers for a secret, in order, until the search finishes. */
export function answersFor(range: GameRange, secret: number): boolean[] {
	const answers: boolean[] = [];
	let state = playFind(range, answers);
	while (!state.done) {
		answers.push(secret > (state.next as number));
		state = playFind(range, answers);
	}
	return answers;
}

/**
 * The questions (numbered from 1) whose given answer is false for `secret`.
 * When the search lands on the wrong number, these are the slips.
 */
export function wrongAnswers(steps: readonly FindStep[], secret: number): number[] {
	return steps.flatMap((s, i) => (secret > s.threshold !== s.answer ? [i + 1] : []));
}

/** Answers as the compact string kept in the URL: y and n. */
export const answersToText = (answers: readonly boolean[]): string => answers.map((a) => (a ? 'y' : 'n')).join('');

/** Reads a y/n string back, or null when it holds anything else. */
export function answersFromText(text: string | undefined, max: number): boolean[] | null {
	if (text === undefined || text.length > max || !/^[yn]*$/.test(text)) return null;
	return [...text].map((c) => c === 'y');
}

// ---------------------------------------------------------------------------
// Mode 2: liar mode, a shortened Hamming code.
//
// A Hamming(15, 11) code numbers its bits 1 to 15. Positions 1, 2, 4 and 8 are
// checks; the rest carry data. Keeping only positions 1 to 11 leaves 7 data
// bits, enough for 0 to 127, and 4 checks: an (11, 7) code. Check c makes the
// bits at all positions with c in their binary form have an even number of 1s.
// One flipped bit at position p breaks exactly the checks whose c is in p, so
// the broken checks add up to p: the position of the lie.

export const LIAR_QUESTIONS = 11;
export const CHECK_POSITIONS = [1, 2, 4, 8] as const;
/** Data positions, carrying bits 6 (worth 64) down to 0 (worth 1). */
export const DATA_POSITIONS = [3, 5, 6, 7, 9, 10, 11] as const;

export interface LiarQuestion {
	/** 1 to 11: the question number is the Hamming position. */
	position: number;
	role: 'check' | 'data';
	/** For a data question, the place value it asks about (64 down to 1). */
	value: number | null;
	/** For a check question, the data positions it covers. */
	covers: number[];
	/** The numbers 0 to 127 for which the true answer is yes. */
	members: number[];
}

/** The 11 bits of the codeword for n (index 0 is question 1). */
export function liarEncode(n: number): boolean[] {
	const bits = Array<boolean>(LIAR_QUESTIONS).fill(false);
	DATA_POSITIONS.forEach((p, i) => (bits[p - 1] = ((n >> (6 - i)) & 1) === 1));
	for (const c of CHECK_POSITIONS) {
		let parity = false;
		for (const p of DATA_POSITIONS) if (p & c) parity = parity !== bits[p - 1];
		bits[c - 1] = parity;
	}
	return bits;
}

export const LIAR_TABLE: readonly LiarQuestion[] = Array.from({ length: LIAR_QUESTIONS }, (_, i) => {
	const position = i + 1;
	const check = (CHECK_POSITIONS as readonly number[]).includes(position);
	const dataIndex = (DATA_POSITIONS as readonly number[]).indexOf(position);
	const members: number[] = [];
	for (let n = 0; n < 128; n++) if (liarEncode(n)[i]) members.push(n);
	return {
		position,
		role: check ? 'check' : 'data',
		value: check ? null : 2 ** (6 - dataIndex),
		covers: check ? DATA_POSITIONS.filter((p) => p & position) : [],
		members
	};
});

export interface CheckResult {
	/** 1, 2, 4 or 8. */
	check: number;
	/** Every question in this group: the positions with this bit set, check included. */
	positions: number[];
	/** How many of them were answered yes. */
	yes: number;
	/** An odd count means the lie, if any, is in this group. */
	odd: boolean;
}

export type LiarVerdict =
	| { kind: 'truth'; number: number }
	| { kind: 'lie'; number: number; question: number; said: boolean }
	| { kind: 'many' };

export interface LiarDecode {
	checks: CheckResult[];
	/** The sum of the broken checks: 0 for no lie, else the question that was the lie. */
	syndrome: number;
	verdict: LiarVerdict;
}

/** Reads the number back from 11 answers, correcting at most one lie. */
export function liarDecode(answers: readonly boolean[]): LiarDecode {
	if (answers.length !== LIAR_QUESTIONS) throw new RangeError('Liar mode needs exactly 11 answers');
	const checks = CHECK_POSITIONS.map((check) => {
		const positions: number[] = [];
		for (let p = 1; p <= LIAR_QUESTIONS; p++) if (p & check) positions.push(p);
		const yes = positions.filter((p) => answers[p - 1]).length;
		return { check, positions, yes, odd: yes % 2 === 1 };
	});
	const syndrome = checks.reduce((sum, c) => sum + (c.odd ? c.check : 0), 0);
	// 12 to 15 name a position the shortened code does not have: two or more lies.
	if (syndrome > LIAR_QUESTIONS) return { checks, syndrome, verdict: { kind: 'many' } };
	const fixed = answers.slice();
	if (syndrome) fixed[syndrome - 1] = !fixed[syndrome - 1];
	const number = DATA_POSITIONS.reduce((n, p) => n * 2 + (fixed[p - 1] ? 1 : 0), 0);
	const verdict: LiarVerdict = syndrome
		? { kind: 'lie', number, question: syndrome, said: answers[syndrome - 1] }
		: { kind: 'truth', number };
	return { checks, syndrome, verdict };
}

// ---------------------------------------------------------------------------
// Mode 3: you guess the page's number.

export type Reply = 'higher' | 'lower' | 'correct';

/** The honest reply: is the secret higher or lower than the guess? */
export const honestReply = (secret: number, guess: number): Reply =>
	guess === secret ? 'correct' : secret > guess ? 'higher' : 'lower';

/**
 * The evil reply. The page holds no number, only the range of numbers that fit
 * every reply so far, and after each guess keeps the bigger side. Every reply
 * stays true of some number, so it never cheats; it just never commits. It can
 * only say "correct" once one number is left and that number is guessed.
 * `preferHigher` breaks ties, when both sides are the same size.
 */
export function evilReply(
	lo: number,
	hi: number,
	guess: number,
	preferHigher = true
): { reply: Reply; lo: number; hi: number } {
	if (guess < lo) return { reply: 'higher', lo, hi };
	if (guess > hi) return { reply: 'lower', lo, hi };
	if (lo === hi) return { reply: 'correct', lo, hi };
	const below = guess - lo;
	const above = hi - guess;
	const goHigher = above > below || (above === below && preferHigher);
	return goHigher ? { reply: 'higher', lo: guess + 1, hi } : { reply: 'lower', lo, hi: guess - 1 };
}

/** The candidates left after a list of replies: what the hints so far have ruled in. */
export function narrowed(range: GameRange, history: readonly { guess: number; reply: Reply }[]) {
	let { lo, hi } = range;
	for (const { guess, reply } of history) {
		if (reply === 'correct') return { lo: guess, hi: guess };
		if (reply === 'higher') lo = Math.max(lo, guess + 1);
		else hi = Math.min(hi, guess - 1);
	}
	return { lo, hi };
}

/** The halving guess for the candidates left: the middle, rounding down. */
export const middleGuess = (lo: number, hi: number): number => Math.floor((lo + hi) / 2);

/** How many guesses halving takes to hit `secret`, counting the winning one. */
export function halvingGuesses(range: GameRange, secret: number): number {
	let { lo, hi } = range;
	for (let count = 1; ; count++) {
		const guess = middleGuess(lo, hi);
		if (guess === secret) return count;
		if (secret > guess) lo = guess + 1;
		else hi = guess - 1;
	}
}

/**
 * A uniformly random whole number from lo to hi. `random32` gives 32 random
 * bits (crypto.getRandomValues in the browser). Values from the top, partial
 * block are thrown away, so no number is likelier than another.
 */
export function randomInRange(lo: number, hi: number, random32: () => number): number {
	const n = sizeOf(lo, hi);
	const limit = 2 ** 32 - (2 ** 32 % n);
	for (;;) {
		const r = random32() >>> 0;
		if (r < limit) return lo + (r % n);
	}
}

// ---------------------------------------------------------------------------
// The reference table.

export interface RangeFacts {
	range: GameRange;
	size: number;
	/** log₂ n, the information in bits, to two decimals. */
	bits: number;
	questions: number;
	guesses: number;
	withOneLie: number;
}

export const rangeFacts = (range: GameRange): RangeFacts => {
	const size = sizeOf(range.lo, range.hi);
	return {
		range,
		size,
		bits: Math.round(Math.log2(size) * 100) / 100,
		questions: questionsNeeded(size),
		guesses: guessesNeeded(size),
		withOneLie: liarQuestionsNeeded(size)
	};
};
