// Reference data for the SR latch page. Each latch's next-state equation is
// checked against its hand-written table in the test suite, so the two can
// never disagree, and the step diagrams on the page are simulated from the
// same equation.

import type { Bit } from './flipflops.js';

export type Latch = {
	slug: string;
	name: string;
	/** Input pins in table order, as the engine names them. */
	inputs: string[];
	/** What the table shows for each pin: S̄ rather than s, for instance. */
	labels: string[];
	/** Next state, in the engine's syntax; q is the present state. */
	equation: string;
	equationText: string;
	tagline: string;
	/** Rows of the characteristic table. An X input stands for both values. */
	characteristic: { inputs: Bit[]; q: Bit; next: Bit | 'invalid'; note: string }[];
	/** A sequence of input columns for the step diagram, one string per pin. */
	demo: string[];
};

export const latches: Latch[] = [
	{
		slug: 'nor',
		name: 'The NOR SR latch',
		inputs: ['s', 'r'],
		labels: ['S', 'R'],
		equation: 's | (!r & q)',
		equationText: 'Q⁺ = S ∨ (¬R ∧ Q)',
		tagline: 'Two cross-coupled NOR gates. Active-high set and reset.',
		characteristic: [
			{ inputs: ['0', '0'], q: '0', next: '0', note: 'hold' },
			{ inputs: ['0', '0'], q: '1', next: '1', note: 'hold' },
			{ inputs: ['0', '1'], q: '0', next: '0', note: 'reset' },
			{ inputs: ['0', '1'], q: '1', next: '0', note: 'reset' },
			{ inputs: ['1', '0'], q: '0', next: '1', note: 'set' },
			{ inputs: ['1', '0'], q: '1', next: '1', note: 'set' },
			{ inputs: ['1', '1'], q: '0', next: 'invalid', note: 'not allowed' },
			{ inputs: ['1', '1'], q: '1', next: 'invalid', note: 'not allowed' }
		],
		demo: ['0110000100', '0000110000']
	},
	{
		slug: 'nand',
		name: 'The NAND SR latch',
		inputs: ['s', 'r'],
		labels: ['S̄', 'R̄'],
		equation: '!s | (r & q)',
		equationText: 'Q⁺ = ¬S̄ ∨ (R̄ ∧ Q)',
		tagline: 'Two cross-coupled NAND gates. Set and reset are active-low: a 0 does the work.',
		characteristic: [
			{ inputs: ['1', '1'], q: '0', next: '0', note: 'hold' },
			{ inputs: ['1', '1'], q: '1', next: '1', note: 'hold' },
			{ inputs: ['1', '0'], q: '0', next: '0', note: 'reset' },
			{ inputs: ['1', '0'], q: '1', next: '0', note: 'reset' },
			{ inputs: ['0', '1'], q: '0', next: '1', note: 'set' },
			{ inputs: ['0', '1'], q: '1', next: '1', note: 'set' },
			{ inputs: ['0', '0'], q: '0', next: 'invalid', note: 'not allowed' },
			{ inputs: ['0', '0'], q: '1', next: 'invalid', note: 'not allowed' }
		],
		demo: ['1001111011', '1111001111']
	},
	{
		slug: 'gated',
		name: 'The gated SR latch',
		inputs: ['e', 's', 'r'],
		labels: ['E', 'S', 'R'],
		equation: '(e & s) | (!(e & r) & q)',
		equationText: 'Q⁺ = (E ∧ S) ∨ (¬(E ∧ R) ∧ Q)',
		tagline: 'An SR latch behind an enable. While E is low, S and R are ignored.',
		characteristic: [
			{ inputs: ['0', 'X', 'X'], q: '0', next: '0', note: 'hold: disabled' },
			{ inputs: ['0', 'X', 'X'], q: '1', next: '1', note: 'hold: disabled' },
			{ inputs: ['1', '0', '0'], q: '0', next: '0', note: 'hold' },
			{ inputs: ['1', '0', '0'], q: '1', next: '1', note: 'hold' },
			{ inputs: ['1', '0', '1'], q: '0', next: '0', note: 'reset' },
			{ inputs: ['1', '0', '1'], q: '1', next: '0', note: 'reset' },
			{ inputs: ['1', '1', '0'], q: '0', next: '1', note: 'set' },
			{ inputs: ['1', '1', '0'], q: '1', next: '1', note: 'set' },
			{ inputs: ['1', '1', '1'], q: '0', next: 'invalid', note: 'not allowed' },
			{ inputs: ['1', '1', '1'], q: '1', next: 'invalid', note: 'not allowed' }
		],
		demo: ['0011001100', '0110000110', '0000111000']
	},
	{
		slug: 'd',
		name: 'The D latch',
		inputs: ['e', 'd'],
		labels: ['E', 'D'],
		equation: '(e & d) | (!e & q)',
		equationText: 'Q⁺ = (E ∧ D) ∨ (¬E ∧ Q)',
		tagline: 'A gated SR latch with R tied to ¬S. Transparent while E is high, frozen while it is low.',
		characteristic: [
			{ inputs: ['0', 'X'], q: '0', next: '0', note: 'hold: frozen' },
			{ inputs: ['0', 'X'], q: '1', next: '1', note: 'hold: frozen' },
			{ inputs: ['1', '0'], q: '0', next: '0', note: 'follows D' },
			{ inputs: ['1', '0'], q: '1', next: '0', note: 'follows D' },
			{ inputs: ['1', '1'], q: '0', next: '1', note: 'follows D' },
			{ inputs: ['1', '1'], q: '1', next: '1', note: 'follows D' }
		],
		demo: ['0111000110', '0101101010']
	}
];

export const latchBySlug = (slug: string) => latches.find((l) => l.slug === slug);
