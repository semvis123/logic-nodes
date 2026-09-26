// Every reference image generated from the site's own data: the timing
// diagrams, the circuit, symbol, laws and flip-flop charts, and the reference
// charts of the number, text, logic and set pages.
//
// The manifests are written by scripts/timing-cards.ts,
// scripts/diagram-cards.ts and scripts/reference-charts.ts, which record the real pixel dimensions and the alt
// text alongside each file, so a page never hardcodes either.

import timing from './timingCards.json';
import diagrams from './diagramCards.json';
import charts from './referenceCharts.json';

export type GeneratedImage = {
	file: string;
	title: string;
	alt: string;
	/** The page it belongs to, without the scheme; may carry a fragment. */
	url: string;
	width: number;
	height: number;
};

export const generatedImages = [...timing, ...diagrams, ...charts] as GeneratedImage[];

/** Looks an image up by filename, failing loudly rather than rendering a gap. */
export function generatedImage(file: string): GeneratedImage {
	const found = generatedImages.find((image) => image.file === file);
	if (!found)
		throw new Error(`no generated image called ${file}; run "npm run timing", "npm run diagrams" and "npm run charts"`);
	return found;
}

/** The images belonging to a page, ignoring any fragment on the recorded URL. */
export function imagesFor(path: string): GeneratedImage[] {
	return generatedImages.filter((image) => image.url.replace('logicgates.org', '').split('#')[0] === path);
}
