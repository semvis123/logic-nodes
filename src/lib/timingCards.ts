// The generated timing diagram images. Written by scripts/timing-cards.ts,
// which renders them from the same waveform generators the pages draw inline,
// and records the real dimensions so a page can reserve the space.

import cards from './timingCards.json';

export type TimingCard = {
	file: string;
	title: string;
	alt: string;
	url: string;
	width: number;
	height: number;
};

export const timingCards = cards as TimingCard[];

/** Looks a card up by filename, so a typo fails loudly rather than silently. */
export function timingCard(file: string): TimingCard {
	const found = timingCards.find((card) => card.file === file);
	if (!found) throw new Error(`no timing card called ${file}; run "npm run timing"`);
	return found;
}
