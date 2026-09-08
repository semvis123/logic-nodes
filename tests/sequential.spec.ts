// Each generator is checked against the property that defines the circuit, so
// the counter and shift register pages cannot state something the code does
// not actually do.

import { expect, test } from '@playwright/test';
import {
	bitsOf,
	countSequence,
	counterWaveforms,
	shiftRegisterStages,
	ringCounter,
	johnsonCounter,
	counterKinds,
	registerKinds
} from '../src/lib/sequential.js';
import type { Level } from '../src/lib/timing.js';

test.describe('counters', () => {
	test('a counter bit toggles exactly when every bit below it is high', () => {
		for (let width = 1; width <= 5; width++) {
			const traces = counterWaveforms(width, 1 << (width + 1));
			// traces[0] is the most significant, so index back to bit position.
			const bit = (position: number) => traces[width - 1 - position].bits;
			for (let position = 0; position < width; position++) {
				const trace = bit(position);
				for (let cycle = 1; cycle < trace.length; cycle++) {
					const toggled = trace[cycle] !== trace[cycle - 1];
					// It should have toggled iff all lower bits were high last cycle.
					const lowerAllHigh = Array.from({ length: position }, (_, i) => bit(i)[cycle - 1]).every((v) => v === 1);
					expect(toggled, `width ${width}, bit ${position}, cycle ${cycle}`).toBe(lowerAllHigh);
				}
			}
		}
	});

	test('the count sequence counts, and wraps at its modulus', () => {
		expect(countSequence(4, 12)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
		// A decade counter clears itself after 9.
		expect(countSequence(4, 12, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]);
		for (const modulus of [3, 5, 10, 16]) {
			const states = countSequence(4, 40, modulus);
			expect(new Set(states).size, `modulus ${modulus}`).toBe(modulus);
			expect(Math.max(...states)).toBe(modulus - 1);
		}
	});

	test('the waveforms agree with the numbers they came from', () => {
		const width = 4;
		const cycles = 20;
		const states = countSequence(width, cycles);
		const traces = counterWaveforms(width, cycles);
		for (let cycle = 0; cycle < cycles; cycle++) {
			// Read the bits back off the traces and rebuild the number.
			const value = traces.reduce((total, trace, i) => total + trace.bits[cycle] * (1 << (width - 1 - i)), 0);
			expect(value, `cycle ${cycle}`).toBe(states[cycle]);
		}
	});

	test('bitsOf is the inverse of reading the bits back', () => {
		for (let value = 0; value < 32; value++) {
			const bits = bitsOf(value, 5);
			expect(bits.reduce((total, bit, i) => total + bit * (1 << i), 0)).toBe(value);
		}
	});
});

test.describe('shift registers', () => {
	test('each stage is the input delayed by one more cycle', () => {
		const input: Level[] = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1];
		const stages = shiftRegisterStages(input, 4);
		expect(stages).toHaveLength(4);
		stages.forEach((stage, index) => {
			for (let cycle = 0; cycle < input.length; cycle++) {
				const expected = cycle > index ? input[cycle - index - 1] : 0;
				expect(stage.bits[cycle], `stage ${index}, cycle ${cycle}`).toBe(expected);
			}
		});
	});

	test('a ring counter has one high bit and exactly n states', () => {
		for (const width of [3, 4, 5, 8]) {
			const stages = ringCounter(width, width * 3);
			for (let cycle = 0; cycle < width * 3; cycle++) {
				const high = stages.filter((s) => s.bits[cycle] === 1).length;
				expect(high, `width ${width}, cycle ${cycle}`).toBe(1);
			}
			const states = new Set(Array.from({ length: width * 3 }, (_, c) => stages.map((s) => s.bits[c]).join('')));
			expect(states.size).toBe(width);
		}
	});

	test('a Johnson counter gets twice as many states from the same stages', () => {
		for (const width of [2, 3, 4, 5]) {
			const cycles = width * 6;
			const stages = johnsonCounter(width, cycles);
			const states = Array.from({ length: cycles }, (_, c) => stages.map((s) => s.bits[c]).join(''));
			expect(new Set(states).size, `width ${width}`).toBe(width * 2);
			// It fills from one end and empties from the same end: every state is a
			// run of 1s followed by a run of 0s, or the other way round.
			for (const state of states) expect(state, `width ${width}`).toMatch(/^(1*0*|0*1*)$/);
			// And the sequence repeats after 2n cycles.
			expect(states[0]).toBe(states[width * 2]);
		}
	});
});

test('the published reference lists are complete', () => {
	for (const kind of counterKinds) {
		expect(kind.slug).toMatch(/^[a-z]+$/);
		expect(kind.name.length).toBeGreaterThan(3);
		expect(kind.note.length, `${kind.slug} needs a real explanation`).toBeGreaterThan(80);
	}
	for (const kind of registerKinds) {
		expect(kind.slug).toMatch(/^[a-z]{4}$/);
		expect(kind.use.length, `${kind.slug} needs a real use`).toBeGreaterThan(30);
	}
	expect(new Set(registerKinds.map((k) => k.slug)).size).toBe(registerKinds.length);
});
