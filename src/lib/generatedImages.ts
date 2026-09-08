// Every reference image generated from the site's own data: the timing
// diagrams and the circuit, symbol, laws and flip-flop charts.
//
// The manifests are written by scripts/timing-cards.ts and
// scripts/diagram-cards.ts, which record the real pixel dimensions and the alt
// text alongside each file, so a page never hardcodes either.

import timing from './timingCards.json';
import diagrams from './diagramCards.json';

export type GeneratedImage = {
	file: string;
	title: string;
	alt: string;
	/** The page it belongs to, without the scheme; may carry a fragment. */
	url: string;
	width: number;
	height: number;
};

export const generatedImages = [...timing, ...diagrams] as GeneratedImage[];

/** Looks an image up by filename, failing loudly rather than rendering a gap. */
export function generatedImage(file: string): GeneratedImage {
	const found = generatedImages.find((image) => image.file === file);
	if (!found) throw new Error(`no generated image called ${file}; run "npm run timing" and "npm run diagrams"`);
	return found;
}

/** The images belonging to a page, ignoring any fragment on the recorded URL. */
export function imagesFor(path: string): GeneratedImage[] {
	return generatedImages.filter((image) => image.url.replace('logicgates.org', '').split('#')[0] === path);
}
