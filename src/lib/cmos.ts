// Transistor-level static CMOS versions of each gate. A stage is a pull-up
// network of PMOS transistors between VDD and its output and a pull-down
// network of NMOS transistors between its output and GND, each built from
// series and parallel groups. Conduction is worked out from that structure,
// and the test suite checks, for every input, that exactly one network of each
// stage conducts and that the output matches the gate's truth table.

import type { GateType, Prim } from './chips.js';

/** A PMOS conducts when its gate is 0, an NMOS when it is 1. */
export type Net = { t: 'fet'; input: string } | { t: 'series'; parts: Net[] } | { t: 'parallel'; parts: Net[] };

export type Stage = {
	/** What the stage is on its own, shown above it when there are several. */
	caption: string;
	inputs: string[];
	output: string;
	pullUp: Net;
	pullDown: Net;
};

export type CmosGate = {
	gate: GateType;
	stages: Stage[];
	/** What to say about the design in one or two sentences. */
	summary: string;
};

const fet = (input: string): Net => ({ t: 'fet', input });
const series = (...parts: Net[]): Net => ({ t: 'series', parts });
const parallel = (...parts: Net[]): Net => ({ t: 'parallel', parts });

const inverter = (input: string, output: string, caption = 'NOT'): Stage => ({
	caption,
	inputs: [input],
	output,
	pullUp: fet(input),
	pullDown: fet(input)
});
const nand = (output: string): Stage => ({
	caption: 'NAND',
	inputs: ['a', 'b'],
	output,
	pullUp: parallel(fet('a'), fet('b')),
	pullDown: series(fet('a'), fet('b'))
});
const nor = (output: string): Stage => ({
	caption: 'NOR',
	inputs: ['a', 'b'],
	output,
	pullUp: series(fet('a'), fet('b')),
	pullDown: parallel(fet('a'), fet('b'))
});

export const cmosGates: CmosGate[] = [
	{
		gate: 'not',
		stages: [inverter('a', 'y')],
		summary: 'One PMOS from VDD to the output and one NMOS from the output to GND, both driven by the input.'
	},
	{
		gate: 'nand',
		stages: [nand('y')],
		summary:
			'Two PMOS in parallel pull the output up if either input is 0; two NMOS in series pull it down only when both are 1.'
	},
	{
		gate: 'nor',
		stages: [nor('y')],
		summary:
			'Two PMOS in series pull the output up only when both inputs are 0; two NMOS in parallel pull it down if either is 1.'
	},
	{
		gate: 'and',
		stages: [nand('n'), inverter('n', 'y')],
		summary:
			'A single CMOS stage always inverts, so AND is built as NAND followed by an inverter: 4 transistors plus 2.'
	},
	{
		gate: 'or',
		stages: [nor('n'), inverter('n', 'y')],
		summary: 'A single CMOS stage always inverts, so OR is built as NOR followed by an inverter: 4 transistors plus 2.'
	},
	{
		gate: 'xor',
		stages: [
			inverter('a', 'na', 'NOT a'),
			inverter('b', 'nb', 'NOT b'),
			{
				caption: 'XOR',
				inputs: ['a', 'b', 'na', 'nb'],
				output: 'y',
				// Pulled down when the inputs agree, pulled up when they differ.
				pullUp: series(parallel(fet('a'), fet('b')), parallel(fet('na'), fet('nb'))),
				pullDown: parallel(series(fet('a'), fet('b')), series(fet('na'), fet('nb')))
			}
		],
		summary:
			'The complementary design: two inverters make ¬a and ¬b, and an 8-transistor stage pulls the output down when the inputs agree and up when they differ, 12 transistors in all.'
	},
	{
		gate: 'xnor',
		stages: [
			inverter('a', 'na', 'NOT a'),
			inverter('b', 'nb', 'NOT b'),
			{
				caption: 'XNOR',
				inputs: ['a', 'b', 'na', 'nb'],
				output: 'y',
				// Pulled down when the inputs differ, pulled up when they agree.
				pullUp: series(parallel(fet('a'), fet('nb')), parallel(fet('na'), fet('b'))),
				pullDown: parallel(series(fet('a'), fet('nb')), series(fet('na'), fet('b')))
			}
		],
		summary:
			'The complementary design: two inverters make ¬a and ¬b, and an 8-transistor stage pulls the output down when the inputs differ and up when they agree, 12 transistors in all.'
	}
];

export const cmosFor = (gate: string): CmosGate | undefined => cmosGates.find((g) => g.gate === gate);

/** Whether a network conducts end to end; `pmos` picks the transistor type. */
export function conducts(net: Net, values: Record<string, boolean>, pmos: boolean): boolean {
	if (net.t === 'fet') {
		const v = values[net.input];
		if (v === undefined) throw new Error(`no value for ${net.input}`);
		return pmos ? !v : v;
	}
	return net.t === 'series'
		? net.parts.every((p) => conducts(p, values, pmos))
		: net.parts.some((p) => conducts(p, values, pmos));
}

export const countFets = (net: Net): number =>
	net.t === 'fet' ? 1 : net.parts.reduce((sum, p) => sum + countFets(p), 0);

export const transistorCount = (gate: CmosGate) =>
	gate.stages.reduce((sum, s) => sum + countFets(s.pullUp) + countFets(s.pullDown), 0);

export type StageState = { up: boolean; down: boolean; output: boolean };

/**
 * Runs the stages in order from the primary inputs. A stage whose networks
 * both conduct or both block has no defined output; that is reported as an
 * error rather than guessed, and the tests make sure it never happens.
 */
export function simulate(gate: CmosGate, inputs: Record<string, boolean>) {
	const values: Record<string, boolean> = { ...inputs };
	const stages: StageState[] = gate.stages.map((stage) => {
		const up = conducts(stage.pullUp, values, true);
		const down = conducts(stage.pullDown, values, false);
		if (up === down) throw new Error(`${stage.caption}: ${up ? 'both networks conduct' : 'neither network conducts'}`);
		values[stage.output] = up;
		return { up, down, output: up };
	});
	return { values, stages, output: values.y };
}

/** Node names as printed on the schematic. */
export const nodeLabel = (name: string) => ({ na: '¬a', nb: '¬b', y: 'Y' }[name] ?? name);

/** One sentence per stage saying which network conducts and why. */
export function describe(gate: CmosGate, inputs: Record<string, boolean>): string[] {
	const { values, stages } = simulate(gate, inputs);
	return gate.stages.map((stage, i) => {
		// The node between two stages has no printed name: call it by its stage.
		const name = (node: string) =>
			node === 'n' ? `the ${gate.stages.find((s) => s.output === 'n')?.caption} output` : nodeLabel(node);
		const onFets = (net: Net, pmos: boolean): string[] =>
			net.t === 'fet'
				? values[net.input] !== pmos
					? [name(net.input)]
					: []
				: net.parts.flatMap((p) => onFets(p, pmos));
		const on = (xs: string[], kind: string) =>
			xs.length === 1
				? `the ${kind} driven by ${xs[0]} is on`
				: `the ${kind} transistors driven by ${xs.join(' and ')} are on`;
		const out = stage.output === 'y' ? 'Y' : name(stage.output);
		const lead = gate.stages.length > 1 ? `${stage.caption}: ` : '';
		return stages[i].up
			? `${lead}the pull-up network conducts (${on(
					onFets(stage.pullUp, true),
					'PMOS'
			  )}) and the pull-down network is open, so ${out} is connected to VDD and is 1.`
			: `${lead}the pull-down network conducts (${on(
					onFets(stage.pullDown, false),
					'NMOS'
			  )}) and the pull-up network is open, so ${out} is connected to GND and is 0.`;
	});
}

// --- drawing ------------------------------------------------------------------------
//
// Each transistor is a 80 x 70 cell with its drain and source on a vertical
// line and its gate lead to the left. Series groups stack, parallel groups sit
// side by side between two rails. Stages sit left to right, level on their
// output node, VDD above and GND below.

export type CmosPrim = Prim & { fet?: number };

export type FetInfo = { id: number; stage: number; pmos: boolean; input: string };

type Laid = { w: number; h: number; cx: number; draw: (x: number, y: number) => void };

const CELL_W = 80;
const CELL_H = 70;
const CELL_CX = 56;
const GAP = 14;

export function cmosDrawing(gate: CmosGate) {
	const prims: CmosPrim[] = [];
	const fets: FetInfo[] = [];
	const line = (x1: number, y1: number, x2: number, y2: number, role = 'wire', id?: number) =>
		prims.push({ k: 'line', x1, y1, x2, y2, role, fet: id });
	const text = (x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end', role = 'label') =>
		prims.push({ k: 'text', x, y, text: s, anchor, role });

	const transistor = (cx: number, y: number, pmos: boolean, id: number, label: string | null) => {
		line(cx, y, cx, y + 18, 'fet', id);
		line(cx, y + 18, cx - 14, y + 18, 'fet', id);
		line(cx - 14, y + 13, cx - 14, y + 57, 'fet', id);
		line(cx - 14, y + 52, cx, y + 52, 'fet', id);
		line(cx, y + 52, cx, y + CELL_H, 'fet', id);
		line(cx - 20, y + 18, cx - 20, y + 52, 'fet', id);
		if (pmos) {
			prims.push({ k: 'circle', cx: cx - 24.5, cy: y + 35, r: 4.5, role: 'fet-bubble', fet: id });
			line(cx - 44, y + 35, cx - 29, y + 35, 'fet', id);
		} else line(cx - 44, y + 35, cx - 20, y + 35, 'fet', id);
		if (label !== null) text(cx - 48, y + 40, label, 'end');
	};

	const layout = (net: Net, stage: number, pmos: boolean, labelled: boolean): Laid => {
		if (net.t === 'fet')
			return {
				w: CELL_W,
				h: CELL_H,
				cx: CELL_CX,
				draw: (x, y) => {
					const id = fets.length;
					fets.push({ id, stage, pmos, input: net.input });
					transistor(x + CELL_CX, y, pmos, id, labelled ? nodeLabel(net.input) : null);
				}
			};
		const parts = net.parts.map((p) => layout(p, stage, pmos, labelled));
		if (net.t === 'series') {
			const left = Math.max(...parts.map((p) => p.cx));
			const right = Math.max(...parts.map((p) => p.w - p.cx));
			return {
				w: left + right,
				h: parts.reduce((s, p) => s + p.h, 0),
				cx: left,
				draw: (x, y) => {
					let yy = y;
					for (const p of parts) {
						p.draw(x + left - p.cx, yy);
						yy += p.h;
					}
				}
			};
		}
		const h = Math.max(...parts.map((p) => p.h));
		const lefts = parts.map((_, i) => parts.slice(0, i).reduce((s, p) => s + p.w, 0));
		const centres = parts.map((p, i) => lefts[i] + p.cx);
		return {
			w: parts.reduce((s, p) => s + p.w, 0),
			h,
			cx: (centres[0] + centres[centres.length - 1]) / 2,
			draw: (x, y) => {
				line(x + centres[0], y, x + centres[centres.length - 1], y);
				line(x + centres[0], y + h, x + centres[centres.length - 1], y + h);
				parts.forEach((p, i) => {
					p.draw(x + lefts[i], y);
					if (p.h < h) line(x + centres[i], y + p.h, x + centres[i], y + h);
				});
			}
		};
	};

	// A stage with one input and one transistor each side is drawn as the usual
	// inverter, both gates tied to one input line; the others label each gate.
	const bussed = (s: Stage) => s.inputs.length === 1 && s.pullUp.t === 'fet' && s.pullDown.t === 'fet';
	const laid = gate.stages.map((s, i) => {
		const labelled = !bussed(s);
		return { up: layout(s.pullUp, i, true, labelled), down: layout(s.pullDown, i, false, labelled) };
	});
	const captions = gate.stages.length > 1;
	const top = captions ? 48 : 26;
	const yo = top + Math.max(...laid.map((l) => l.up.h)) + GAP;
	const bottom = yo + GAP + Math.max(...laid.map((l) => l.down.h));

	let cursor = 8;
	gate.stages.forEach((stage, i) => {
		const { up, down } = laid[i];
		const bus = bussed(stage);
		const wiredIn = bus && i > 0 && gate.stages[i - 1].output === stage.inputs[0];
		const left = Math.max(up.cx, down.cx, bus ? (wiredIn ? 60 : 86) : 0);
		const cx = cursor + left;
		const y0 = yo - GAP - up.h;
		if (captions) text(cx, top - 30, stage.caption, 'middle', 'caption');
		// VDD
		line(cx - 18, y0, cx + 18, y0, 'rail');
		text(cx, y0 - 7, 'VDD', 'middle', 'rail-label');
		up.draw(cx - up.cx, y0);
		line(cx, y0 + up.h, cx, yo + GAP);
		down.draw(cx - down.cx, yo + GAP);
		const yb = yo + GAP + down.h;
		// GND
		line(cx, yb, cx, bottom + 10);
		line(cx - 16, bottom + 10, cx + 16, bottom + 10, 'rail');
		line(cx - 10, bottom + 15, cx + 10, bottom + 15, 'rail');
		line(cx - 4, bottom + 20, cx + 4, bottom + 20, 'rail');
		text(cx, bottom + 36, 'GND', 'middle', 'rail-label');
		prims.push({ k: 'circle', cx, cy: yo, r: 3, role: 'node' });
		if (bus) {
			const bx = cx - 44;
			line(bx, y0 + 35, bx, yo + GAP + 35);
			prims.push({ k: 'circle', cx: bx, cy: yo, r: 3, role: 'node' });
			if (!wiredIn) {
				line(bx - 26, yo, bx, yo);
				text(bx - 30, yo + 5, nodeLabel(stage.inputs[0]), 'end');
			}
		}
		const right = Math.max(up.w - up.cx, down.w - down.cx);
		const next = gate.stages[i + 1];
		const feedsNext = next && bussed(next) && next.inputs[0] === stage.output;
		if (feedsNext) {
			// The wire runs to the next stage's input line, drawn with it.
			const end = cx + right + 20 + 60 - 44;
			line(cx, yo, end, yo);
			cursor = cx + right + 20;
		} else {
			const end = cx + right + 18;
			line(cx, yo, end, yo);
			text(end + 5, yo + 5, nodeLabel(stage.output), 'start', stage.output === 'y' ? 'output' : 'label');
			cursor = end + 40;
		}
	});

	return { prims, fets, width: Math.ceil(cursor - 12), height: bottom + 44 };
}
