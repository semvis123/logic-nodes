// The classic 7400-series parts for each gate: part numbers, the pin of every
// input and output, and the drawing of the 14-pin DIP package used by the gate
// pages and the printable pinout charts. The pin numbers are checked in the test
// suite: fourteen distinct pins, power on 7 and 14, and one gate per group.

import { shapes, inputYs } from './symbols.js';

export type GateType = 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | 'xnor';

/** One gate inside the package: its input pins in A, B order and its output pin. */
export type ChipGate = { inputs: number[]; output: number };

export type Chip = {
	gate: GateType;
	/** The generic part number, used for file names and headings. */
	part: string;
	/** Part numbers to search for, generic first. */
	parts: string[];
	/** For example "quad 2-input NAND gate". */
	description: string;
	/** Short, certain notes on the logic families it is sold in. */
	families: string[];
	notes: string[];
	/**
	 * The gates in order 1 to n, or null when the pinout is not published here:
	 * the component then shows no diagram and points to the datasheet.
	 */
	gates: ChipGate[] | null;
	power: { vcc: number; gnd: number };
};

const PINS = 14;
const POWER = { vcc: 14, gnd: 7 };
const HC = '74HC: CMOS, 2 V to 6 V supply.';
const LS = '74LS: bipolar TTL (low-power Schottky), 5 V supply.';

/** The layout shared by the 7400, 7408, 7432 and 7486. */
const QUAD: ChipGate[] = [
	{ inputs: [1, 2], output: 3 },
	{ inputs: [4, 5], output: 6 },
	{ inputs: [9, 10], output: 8 },
	{ inputs: [12, 13], output: 11 }
];

export const chips: Chip[] = [
	{
		gate: 'and',
		part: '7408',
		parts: ['7408', '74HC08', '74LS08'],
		description: 'quad 2-input AND gate',
		families: [HC, LS],
		notes: [],
		gates: QUAD,
		power: POWER
	},
	{
		gate: 'or',
		part: '7432',
		parts: ['7432', '74HC32', '74LS32'],
		description: 'quad 2-input OR gate',
		families: [HC, LS],
		notes: [],
		gates: QUAD,
		power: POWER
	},
	{
		gate: 'not',
		part: '7404',
		parts: ['7404', '74HC04', '74LS04'],
		description: 'hex inverter',
		families: [HC, LS],
		notes: [],
		gates: [
			{ inputs: [1], output: 2 },
			{ inputs: [3], output: 4 },
			{ inputs: [5], output: 6 },
			{ inputs: [9], output: 8 },
			{ inputs: [11], output: 10 },
			{ inputs: [13], output: 12 }
		],
		power: POWER
	},
	{
		gate: 'nand',
		part: '7400',
		parts: ['7400', '74HC00', '74LS00'],
		description: 'quad 2-input NAND gate',
		families: [HC, LS],
		notes: [],
		gates: QUAD,
		power: POWER
	},
	{
		gate: 'nor',
		part: '7402',
		parts: ['7402', '74HC02', '74LS02'],
		description: 'quad 2-input NOR gate',
		families: [HC, LS],
		// The NOR part puts each output before its inputs.
		notes: [
			'Unlike the 7400, 7408, 7432 and 7486, inputs and outputs trade places: the outputs are on pins 1, 4, 10 and 13 instead of 3, 6, 8 and 11.'
		],
		gates: [
			{ inputs: [2, 3], output: 1 },
			{ inputs: [5, 6], output: 4 },
			{ inputs: [8, 9], output: 10 },
			{ inputs: [11, 12], output: 13 }
		],
		power: POWER
	},
	{
		gate: 'xor',
		part: '7486',
		parts: ['7486', '74HC86', '74LS86'],
		description: 'quad 2-input XOR gate',
		families: [HC, LS],
		notes: [],
		gates: QUAD,
		power: POWER
	},
	{
		gate: 'xnor',
		part: '74LS266',
		parts: ['74HC7266', '74LS266'],
		description: 'quad 2-input XNOR gate',
		families: ['74HC7266: CMOS, 2 V to 6 V supply.', LS],
		notes: [
			'The 74LS266 has open-collector outputs: each output needs a pull-up resistor to VCC to give a high level.'
		],
		// Not published here. The layouts in circulation for the '266 disagree on
		// pins 8 to 10, and without the manufacturer's datasheet to hand a wrong
		// pin diagram would be worse than none.
		gates: null,
		power: POWER
	}
];

export const chipFor = (gate: string): Chip | undefined => chips.find((c) => c.gate === gate);

/** "quad" for 4 gates, "hex" for 6: the count the description promises. */
export const gateCount = (chip: Chip) => ({ quad: 4, hex: 6 }[chip.description.split(' ')[0]] ?? 0);

export type Pin = { pin: number; name: string; function: string };

/** Every pin of the package with its name (1A, 1Y, GND...) and what it does. */
export function pinTable(chip: Chip): Pin[] {
	if (!chip.gates) return [];
	const pins: Pin[] = [];
	chip.gates.forEach((g, i) => {
		const n = i + 1;
		g.inputs.forEach((pin, k) => {
			const letter = 'AB'[k];
			pins.push({
				pin,
				name: `${n}${letter}`,
				function: g.inputs.length === 1 ? `Input of gate ${n}` : `Input ${letter} of gate ${n}`
			});
		});
		pins.push({ pin: g.output, name: `${n}Y`, function: `Output of gate ${n}` });
	});
	pins.push({ pin: chip.power.gnd, name: 'GND', function: 'Ground, 0 V' });
	pins.push({ pin: chip.power.vcc, name: 'VCC', function: 'Positive supply' });
	return pins.sort((x, y) => x.pin - y.pin);
}

/** One sentence naming the part and every pin, for alt and aria-label text. */
export function pinSummary(chip: Chip): string {
	const pins = pinTable(chip);
	return `${chip.part} ${chip.description}, 14-pin DIP pinout: ${pins.map((p) => `pin ${p.pin} ${p.name}`).join(', ')}`;
}

// --- drawing ------------------------------------------------------------------------
//
// Top view of the package, notch at the top: pins 1 to 7 down the left, 8 to 14
// up the right. Each gate is drawn beside its own pins, facing into the package
// on the left and mirrored on the right, with its output wire taken round the
// symbol back to the output pin.

/** A drawing primitive; `role` picks the colour, so one layout serves both themes. */
export type Prim =
	| { k: 'line'; x1: number; y1: number; x2: number; y2: number; role: string }
	| { k: 'path'; d: string; transform?: string; role: string }
	| { k: 'circle'; cx: number; cy: number; r: number; role: string }
	| { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number; role: string }
	| { k: 'text'; x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; role: string };

export const PINOUT_WIDTH = 400;
export const PINOUT_HEIGHT = 340;

const BODY = { x: 60, y: 20, w: 280, h: 300 };
const PITCH = 40;
const FIRST = 50;
const STUB = 24;

/** y of a pin, and the side it is on. */
export function pinPosition(pin: number): { y: number; side: 'left' | 'right' } {
	return pin <= PINS / 2
		? { y: FIRST + (pin - 1) * PITCH, side: 'left' }
		: { y: FIRST + (PINS - pin) * PITCH, side: 'right' };
}

export function pinoutDrawing(chip: Chip): Prim[] {
	const out: Prim[] = [];
	const { x, y, w, h } = BODY;
	const right = x + w;
	// The body, with the notch as a half circle cut into the top edge.
	const mid = x + w / 2;
	out.push({
		k: 'path',
		d: `M${x} ${y} H${mid - 12} A12 12 0 0 0 ${mid + 12} ${y} H${right} V${y + h} H${x} Z`,
		role: 'body'
	});
	out.push({ k: 'circle', cx: x + 13, cy: y + 13, r: 4, role: 'dot' });

	const names = new Map(pinTable(chip).map((p) => [p.pin, p.name]));
	for (let pin = 1; pin <= PINS; pin++) {
		const { y: py, side } = pinPosition(pin);
		const left = side === 'left';
		const sx = left ? x - STUB : right;
		out.push({ k: 'rect', x: sx, y: py - 8, w: STUB, h: 16, rx: 2, role: 'pin' });
		out.push({ k: 'text', x: sx + STUB / 2, y: py + 4, text: String(pin), anchor: 'middle', role: 'pin-number' });
		const name = names.get(pin) ?? '';
		const power = pin === chip.power.vcc || pin === chip.power.gnd;
		out.push({
			k: 'text',
			x: left ? sx - 5 : sx + STUB + 5,
			y: py + 4.5,
			text: name,
			anchor: left ? 'end' : 'start',
			role: power ? 'power' : 'pin-name'
		});
	}

	for (const g of chip.gates ?? []) {
		const { side } = pinPosition(g.output);
		const left = side === 'left';
		const shape = shapes[chip.gate];
		const edge = left ? x : right;
		// Mirrored on the right: every x is measured inwards from the body edge.
		const at = (dx: number) => (left ? edge + dx : edge - dx);
		const inputYsAbs = g.inputs.map((p) => pinPosition(p).y).sort((a, b) => a - b);
		const centre = inputYsAbs.reduce((s, v) => s + v, 0) / inputYsAbs.length;
		const top = centre - 25;
		const symbolX = 45; // where the 70 wide symbol box starts, inwards from the edge
		const jog = 35;
		inputYs(shape.inputs).forEach((sy, i) => {
			const py = inputYsAbs[i];
			const ly = top + sy;
			out.push({ k: 'line', x1: at(0), y1: py, x2: at(jog), y2: py, role: 'wire' });
			if (py !== ly) out.push({ k: 'line', x1: at(jog), y1: py, x2: at(jog), y2: ly, role: 'wire' });
			out.push({ k: 'line', x1: at(jog), y1: ly, x2: at(symbolX + shape.leadIn), y2: ly, role: 'wire' });
		});
		const transform = left ? `translate(${at(symbolX)} ${top})` : `translate(${at(symbolX)} ${top}) scale(-1 1)`;
		out.push({ k: 'path', d: shape.body, transform, role: 'gate' });
		if (shape.extra) out.push({ k: 'path', d: shape.extra, transform, role: 'gate-line' });
		if (shape.bubble) out.push({ k: 'circle', cx: at(symbolX + shape.bubble), cy: top + 25, r: 4, role: 'gate' });
		// Output: out of the nose, round the symbol and back to the pin.
		const oy = pinPosition(g.output).y;
		const turn = symbolX + 80;
		out.push({ k: 'line', x1: at(symbolX + shape.leadOut), y1: centre, x2: at(turn), y2: centre, role: 'wire' });
		out.push({ k: 'line', x1: at(turn), y1: centre, x2: at(turn), y2: oy, role: 'wire' });
		out.push({ k: 'line', x1: at(turn), y1: oy, x2: at(0), y2: oy, role: 'wire' });
	}
	// The part number along the middle of the package.
	out.push({ k: 'text', x: mid, y: y + h - 12, text: chip.part, anchor: 'middle', role: 'part' });
	return out;
}
