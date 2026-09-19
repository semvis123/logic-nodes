// Stage 8: the final project. The quiz is a mixed review, so the generators
// are borrowed from the stages the project draws on rather than written again.

import { fromPractice } from '../fromPractice.js';
import type { StageMeta } from '../types.js';
import { addFourBit, signedPatternValue, digitForSegments } from './build.js';

export const project: StageMeta = {
	id: 'project',
	title: 'The final project',
	tagline: 'Put it all together and build something that was not on this site.',
	lessons: [
		{
			slug: 'build-a-calculator',
			title: 'Build a four-bit calculator',
			blurb: 'A guided build in the simulator: adder chips, subtraction, a digit on the display, and where to go next.',
			description:
				"Build a four bit calculator in the logic simulator: half and full adder chips, a ripple carry adder, two's complement subtraction and a seven-segment display.",
			minutes: 45,
			generators: [fromPractice('mixed'), addFourBit, signedPatternValue, digitForSegments],
			deeper: [
				{ href: '/ripple-carry-adder', label: 'The ripple carry adder' },
				{ href: '/twos-complement', label: "Two's complement" },
				{ href: '/seven-segment-decoder', label: 'The seven-segment decoder' },
				{ href: '/common-circuits', label: 'Common circuits' }
			],
			build: { href: '/simulator#example:Calculator', label: 'the four bit calculator example' }
		}
	]
};
