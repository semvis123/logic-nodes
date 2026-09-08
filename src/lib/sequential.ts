// Counters and shift registers: what you get once flip-flops are chained.
//
// Every sequence and waveform on those pages comes from here rather than being
// typed out, and each generator is checked against the property that defines
// it: a counter bit toggles exactly when all the bits below it are high, a
// shift register stage is its input delayed by a fixed number of cycles, and a
// Johnson counter has twice as many states as it has stages.

import type { Level, Signal } from './timing.js';

/** Bit 0 is the least significant, which is the one that toggles every cycle. */
export const bitsOf = (value: number, width: number): Level[] =>
	Array.from({ length: width }, (_, i) => ((value >> i) & 1) as Level);

/**
 * The states of a binary up counter, wrapping at `modulus`. A plain n-bit
 * counter has a modulus of 2^n; a decade counter clears itself at 10.
 */
export function countSequence(width: number, cycles: number, modulus = 1 << width): number[] {
	return Array.from({ length: cycles }, (_, cycle) => cycle % modulus);
}

/**
 * One trace per bit of a counter, most significant first, which is the order
 * they are written in and read off a diagram.
 */
export function counterWaveforms(width: number, cycles: number, modulus = 1 << width): Signal[] {
	const states = countSequence(width, cycles, modulus);
	return Array.from({ length: width }, (_, i) => ({
		name: `Q${width - 1 - i}`,
		bits: states.map((value) => ((value >> (width - 1 - i)) & 1) as Level),
		coloured: true
	}));
}

/**
 * A shift register's stages, given the serial input. Stage k holds what the
 * input was k+1 cycles ago, which is the whole behaviour in one sentence.
 */
export function shiftRegisterStages(input: Level[], width: number): Signal[] {
	return Array.from({ length: width }, (_, stage) => ({
		name: `Q${stage}`,
		bits: input.map((_, cycle) => (cycle > stage ? input[cycle - stage - 1] : 0)),
		coloured: true
	}));
}

/**
 * A ring counter: one high bit walked around a loop of `width` stages, so it
 * has exactly `width` states and needs no decoding to tell them apart.
 */
export function ringCounter(width: number, cycles: number): Signal[] {
	return Array.from({ length: width }, (_, stage) => ({
		name: `Q${stage}`,
		bits: Array.from({ length: cycles }, (_, cycle) => (cycle % width === stage ? 1 : 0) as Level),
		coloured: true
	}));
}

/**
 * A Johnson counter: a ring with the last output inverted on the way back, so
 * the pattern fills up and then empties. That gives 2n states from n stages,
 * twice what a ring counter manages with the same hardware.
 */
export function johnsonCounter(width: number, cycles: number): Signal[] {
	const states: Level[][] = [];
	let current: Level[] = Array.from({ length: width }, () => 0);
	for (let cycle = 0; cycle < cycles; cycle++) {
		states.push(current);
		current = [(current[width - 1] ? 0 : 1) as Level, ...current.slice(0, width - 1)];
	}
	return Array.from({ length: width }, (_, stage) => ({
		name: `Q${stage}`,
		bits: states.map((state) => state[stage]),
		coloured: true
	}));
}

export type CounterKind = {
	slug: string;
	name: string;
	blurb: string;
	/** Why you would pick this one. */
	note: string;
};

export const counterKinds: CounterKind[] = [
	{
		slug: 'ripple',
		name: 'Ripple (asynchronous)',
		blurb: 'Each flip-flop clocks the next one.',
		note: 'The simplest to wire and the cheapest in gates, but each stage waits for the one before it, so the delays add up and the outputs pass through wrong intermediate values whenever a carry ripples — worst at the wrap from all ones back to zero, where every stage changes in turn. Fine for driving a display, not for feeding other logic.'
	},
	{
		slug: 'synchronous',
		name: 'Synchronous',
		blurb: 'Every flip-flop shares one clock.',
		note: 'All the stages change together, so the count is valid one propagation delay after the edge no matter how wide the counter is. It costs extra AND gates to work out which stages should toggle, which is the usual trade.'
	},
	{
		slug: 'decade',
		name: 'Decade (mod 10)',
		blurb: 'Counts 0 to 9, then clears.',
		note: 'A four bit counter with a detector on the state after the last one you want, wired to the clear input. The same trick gives any modulus, which is how a clock divides seconds into minutes.'
	},
	{
		slug: 'updown',
		name: 'Up/down',
		blurb: 'One control line picks the direction.',
		note: 'Counting down is counting up with every bit inverted on the way into the toggle logic, so the same circuit does both with a multiplexer choosing between Q and its complement.'
	}
];

export type RegisterKind = {
	slug: string;
	name: string;
	inputs: string;
	outputs: string;
	use: string;
};

export const registerKinds: RegisterKind[] = [
	{
		slug: 'siso',
		name: 'Serial in, serial out',
		inputs: 'one bit per clock',
		outputs: 'one bit per clock',
		use: 'A delay line: whatever goes in comes out a fixed number of cycles later.'
	},
	{
		slug: 'sipo',
		name: 'Serial in, parallel out',
		inputs: 'one bit per clock',
		outputs: 'all stages at once',
		use: 'Receiving. A byte arriving one bit at a time on a single wire ends up on eight, which is what the receiving half of a UART does.'
	},
	{
		slug: 'piso',
		name: 'Parallel in, serial out',
		inputs: 'all stages at once',
		outputs: 'one bit per clock',
		use: 'Sending. Load a whole word, then clock it out down one wire.'
	},
	{
		slug: 'pipo',
		name: 'Parallel in, parallel out',
		inputs: 'all stages at once',
		outputs: 'all stages at once',
		use: 'Storage: a register in the ordinary sense, holding a word for one clock or many.'
	}
];
