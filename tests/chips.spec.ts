// The 7400-series pinouts and the CMOS schematics on the gate pages. The
// pinouts are checked for shape (fourteen distinct pins, power on 7 and 14, the
// promised number of gates) and the CMOS stages against the expression engine:
// for every input, exactly one network of each stage conducts, and the output
// is the gate's truth table.

import { expect, test } from '@playwright/test';
import { chips, gateCount, pinTable, pinoutDrawing, type Chip } from '../src/lib/chips.js';
import { cmosGates, conducts, simulate, describe, transistorCount, cmosDrawing } from '../src/lib/cmos.js';
import { parseExpression, truthTable } from '../src/lib/boolean.js';
import { gates } from '../src/lib/gates.js';

const SLUGS = ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'];

/** The gate's truth table from the engine, rows in counting order with a as the high bit. */
const truthOf = (slug: string) => {
	const gate = gates.find((g) => g.slug === slug)!;
	return truthTable(parseExpression(gate.source)).rows;
};

/** Every input combination for a gate, in the engine's row order. */
const inputRows = (slug: string) =>
	slug === 'not'
		? [{ a: false }, { a: true }]
		: [
				{ a: false, b: false },
				{ a: false, b: true },
				{ a: true, b: false },
				{ a: true, b: true }
		  ];

const logic: Record<string, (x: boolean[]) => boolean> = {
	and: ([a, b]) => a && b,
	or: ([a, b]) => a || b,
	not: ([a]) => !a,
	nand: ([a, b]) => !(a && b),
	nor: ([a, b]) => !(a || b),
	xor: ([a, b]) => a !== b,
	xnor: ([a, b]) => a === b
};

test.describe('chip pinouts', () => {
	test('there is one chip per gate', () => {
		expect(chips.map((c) => c.gate).sort()).toEqual([...SLUGS].sort());
	});

	test('the part numbers are the standard ones', () => {
		const part = (gate: string) => chips.find((c) => c.gate === gate)!.part;
		expect(['and', 'or', 'not', 'nand', 'nor', 'xor'].map(part)).toEqual([
			'7408',
			'7432',
			'7404',
			'7400',
			'7402',
			'7486'
		]);
		expect(chips.find((c) => c.gate === 'xnor')!.parts).toEqual(['74HC7266', '74LS266']);
	});

	const drawn = chips.filter((c): c is Chip & { gates: NonNullable<Chip['gates']> } => c.gates !== null);

	test('every drawn chip has 14 distinct pins with VCC on 14 and GND on 7', () => {
		expect(drawn.length).toBe(6);
		for (const chip of drawn) {
			expect(chip.power, chip.part).toEqual({ vcc: 14, gnd: 7 });
			const pins = pinTable(chip);
			expect(
				pins.map((p) => p.pin),
				chip.part
			).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
			expect(new Set(pins.map((p) => p.name)).size, chip.part).toBe(14);
			expect(pins.find((p) => p.pin === 14)!.name).toBe('VCC');
			expect(pins.find((p) => p.pin === 7)!.name).toBe('GND');
		}
	});

	test('every gate uses distinct pins, with the input count the gate type needs', () => {
		for (const chip of drawn) {
			for (const g of chip.gates) {
				const pins = [...g.inputs, g.output];
				expect(new Set(pins).size, chip.part).toBe(pins.length);
				expect(pins.every((p) => p >= 1 && p <= 14 && p !== 7 && p !== 14)).toBe(true);
				expect(g.inputs.length, chip.part).toBe(chip.gate === 'not' ? 1 : 2);
				// A gate's pins are all on one side of the package.
				expect(pins.every((p) => p <= 7) || pins.every((p) => p >= 8), chip.part).toBe(true);
			}
		}
	});

	test('the number of gates matches the description', () => {
		for (const chip of drawn) {
			expect(gateCount(chip), chip.part).toBe(chip.gate === 'not' ? 6 : 4);
			expect(chip.gates.length, chip.part).toBe(gateCount(chip));
			expect(chip.description, chip.part).toContain(chip.gate === 'not' ? 'inverter' : chip.gate.toUpperCase());
		}
	});

	test('the pinouts are the published ones', () => {
		const layout = (part: string) =>
			pinTable(drawn.find((c) => c.part === part)!)
				.map((p) => `${p.pin}:${p.name}`)
				.join(' ');
		const quad = '1:1A 2:1B 3:1Y 4:2A 5:2B 6:2Y 7:GND 8:3Y 9:3A 10:3B 11:4Y 12:4A 13:4B 14:VCC';
		for (const part of ['7400', '7408', '7432', '7486']) expect(layout(part), part).toBe(quad);
		expect(layout('7402')).toBe('1:1Y 2:1A 3:1B 4:2Y 5:2A 6:2B 7:GND 8:3A 9:3B 10:3Y 11:4A 12:4B 13:4Y 14:VCC');
		expect(layout('7404')).toBe('1:1A 2:1Y 3:2A 4:2Y 5:3A 6:3Y 7:GND 8:4Y 9:4A 10:5Y 11:5A 12:6Y 13:6A 14:VCC');
	});

	test('each gate is wired nA, nB to nY, and the gate type is the function the engine gives', () => {
		// The pins carry no logic of their own: what ties them to a function is
		// the gate type, so check the names line up with the gates and the type
		// against the engine's truth table for that gate.
		for (const chip of drawn) {
			const rows = truthOf(chip.gate);
			const table = pinTable(chip);
			chip.gates.forEach((g, i) => {
				const n = i + 1;
				expect(
					g.inputs.map((p) => table.find((t) => t.pin === p)!.name),
					chip.part
				).toEqual(g.inputs.length === 1 ? [`${n}A`] : [`${n}A`, `${n}B`]);
				expect(table.find((t) => t.pin === g.output)!.name).toBe(`${n}Y`);
				inputRows(chip.gate).forEach((row, r) => {
					const levels = Object.values(row);
					expect(logic[chip.gate](levels), `${chip.part} gate ${n}`).toBe(rows[r]);
				});
			});
		}
	});

	test('the XNOR part shows no pin diagram and carries the open-collector note', () => {
		const xnor = chips.find((c) => c.gate === 'xnor')!;
		expect(xnor.gates).toBeNull();
		expect(pinTable(xnor)).toEqual([]);
		expect(xnor.notes.join(' ')).toContain('open-collector');
	});

	test('the drawing stays inside its view box', () => {
		for (const chip of drawn) {
			for (const p of pinoutDrawing(chip)) {
				const xs =
					p.k === 'line' ? [p.x1, p.x2] : p.k === 'circle' ? [p.cx] : p.k === 'rect' || p.k === 'text' ? [p.x] : [];
				for (const x of xs) expect(x, chip.part).toBeGreaterThanOrEqual(0);
				for (const x of xs) expect(x, chip.part).toBeLessThanOrEqual(400);
			}
		}
	});
});

test.describe('CMOS gates', () => {
	test('there is one design per gate, with the usual transistor counts', () => {
		expect(cmosGates.map((g) => g.gate).sort()).toEqual([...SLUGS].sort());
		const counts = Object.fromEntries(cmosGates.map((g) => [g.gate, transistorCount(g)]));
		expect(counts).toEqual({ not: 2, nand: 4, nor: 4, and: 6, or: 6, xor: 12, xnor: 12 });
	});

	test('each network has one transistor per input, and both networks see the same inputs', () => {
		for (const gate of cmosGates) {
			for (const stage of gate.stages) {
				// Static CMOS: the pull-down is the dual of the pull-up, so each
				// network has one transistor per gate connection.
				const inputsOf = (net: typeof stage.pullUp): string[] =>
					net.t === 'fet' ? [net.input] : net.parts.flatMap(inputsOf);
				expect(inputsOf(stage.pullUp).sort(), gate.gate).toEqual(inputsOf(stage.pullDown).sort());
				expect(new Set(inputsOf(stage.pullUp)), gate.gate).toEqual(new Set(stage.inputs));
			}
		}
	});

	test('for every input exactly one network of each stage conducts, and the output is the truth table', () => {
		for (const gate of cmosGates) {
			const rows = truthOf(gate.gate);
			inputRows(gate.gate).forEach((inputs, r) => {
				const values: Record<string, boolean> = { ...inputs };
				for (const stage of gate.stages) {
					const up = conducts(stage.pullUp, values, true);
					const down = conducts(stage.pullDown, values, false);
					expect(up !== down, `${gate.gate} ${stage.caption} at ${JSON.stringify(inputs)}`).toBe(true);
					values[stage.output] = up;
				}
				expect(values.y, `${gate.gate} at ${JSON.stringify(inputs)}`).toBe(rows[r]);
				expect(simulate(gate, inputs).output).toBe(rows[r]);
			});
		}
	});

	test('the explanation names the conducting network and the right level', () => {
		for (const gate of cmosGates) {
			inputRows(gate.gate).forEach((inputs) => {
				const { stages } = simulate(gate, inputs);
				describe(gate, inputs).forEach((sentence, i) => {
					expect(sentence).toContain(stages[i].up ? 'pull-up network conducts' : 'pull-down network conducts');
					expect(sentence).toMatch(stages[i].up ? /VDD and is 1\.$/ : /GND and is 0\.$/);
				});
			});
		}
	});

	test('the schematic draws every transistor once, PMOS with a bubble', () => {
		for (const gate of cmosGates) {
			const { prims, fets } = cmosDrawing(gate);
			expect(fets.length, gate.gate).toBe(transistorCount(gate));
			const bubbles = prims.filter((p) => p.role === 'fet-bubble').map((p) => p.fet);
			expect(
				bubbles.sort((x, y) => x! - y!),
				gate.gate
			).toEqual(fets.filter((f) => f.pmos).map((f) => f.id));
			const railLabels = prims.filter((p) => p.k === 'text' && p.role === 'rail-label');
			expect(railLabels.length, gate.gate).toBe(gate.stages.length * 2);
		}
	});
});
