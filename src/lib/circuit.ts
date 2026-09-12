// Turns an expression, or several of them, into a positioned circuit diagram:
// a small DAG layout with gates in columns by depth and wires routed between
// them. Identical subexpressions collapse into one gate, the way they would in
// a real circuit, and that holds across outputs too: a full adder's two
// outputs share their XOR.

import { astKey, type Ast, type Output } from './boolean.js';

export type CircuitNode = {
	id: string;
	kind: 'input' | 'const' | 'gate';
	/** Gate operation, or the variable name / constant label. */
	op?: 'and' | 'or' | 'xor' | 'not';
	label: string;
	/** Ids of the nodes feeding this one, in pin order. */
	children: string[];
	depth: number;
	column: number;
	row: number;
	x: number;
	y: number;
	width: number;
	height: number;
	/** Where a wire leaves this node. */
	outX: number;
	outY: number;
	/** Where wires arrive, one per child. */
	inputPorts: { x: number; y: number }[];
};

export type CircuitWire = {
	from: string;
	to: string;
	pin: number;
	/** The polyline the curve follows; the drawn path stays within its hull. */
	points: { x: number; y: number }[];
	path: string;
};

export type CircuitOutput = {
	/** `output:0`, `output:1`, ...; what a wire's `to` names. */
	id: string;
	name: string;
	/** Id of the node driving this output. */
	rootId: string;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Circuit = {
	nodes: CircuitNode[];
	wires: CircuitWire[];
	width: number;
	height: number;
	/** The output boxes, in the order they were written. */
	outputs: CircuitOutput[];
	/** The first output, for the common single output case. */
	rootId: string;
	output: { x: number; y: number; width: number; height: number };
	gateCount: number;
};

const GATE_W = 70;
const GATE_H = 50;
const IO_W = 42;
const IO_H = 30;
const COL_GAP = 46;
const ROW_GAP = 18;
const PAD = 12;
const OUT_W = 46;

export const MAX_CIRCUIT_GATES = 40;

export class CircuitTooLarge extends Error {}

/** Input pin offsets within a gate body, matching the drawn symbol. */
const pinYs = (count: number) => (count === 0 ? [] : count === 1 ? [GATE_H / 2] : [GATE_H * 0.32, GATE_H * 0.68]);

/** One expression draws one output; a list of named outputs draws them all. */
export function buildCircuit(source: Ast | Output[]): Circuit {
	const wanted: Output[] = Array.isArray(source) ? source : [{ name: 'Q', ast: source }];
	const nodes = new Map<string, CircuitNode>();

	// Collapse identical subtrees so a shared term becomes one gate.
	function add(n: Ast): string {
		const id = astKey(n);
		const existing = nodes.get(id);
		if (existing) return id;

		let node: CircuitNode;
		if (n.t === 'var') {
			node = blank(id, 'input', n.name, []);
		} else if (n.t === 'const') {
			node = blank(id, 'const', n.v ? '1' : '0', []);
		} else if (n.t === 'not') {
			node = blank(id, 'gate', 'NOT', [add(n.a)], 'not');
		} else {
			node = blank(id, 'gate', n.t.toUpperCase(), [add(n.a), add(n.b)], n.t);
		}
		nodes.set(id, node);
		return id;
	}

	function blank(
		id: string,
		kind: CircuitNode['kind'],
		label: string,
		children: string[],
		op?: CircuitNode['op']
	): CircuitNode {
		return {
			id,
			kind,
			op,
			label,
			children,
			depth: 0,
			column: 0,
			row: 0,
			x: 0,
			y: 0,
			width: kind === 'gate' ? GATE_W : IO_W,
			height: kind === 'gate' ? GATE_H : IO_H,
			outX: 0,
			outY: 0,
			inputPorts: []
		};
	}

	const roots = wanted.map((o, i) => ({ id: `output:${i}`, name: o.name, rootId: add(o.ast) }));
	const gateCount = [...nodes.values()].filter((n) => n.kind === 'gate').length;
	if (gateCount > MAX_CIRCUIT_GATES) {
		throw new CircuitTooLarge(`That needs ${gateCount} gates, more than this page will draw`);
	}

	// Depth is the longest path from an input, so every gate sits to the right
	// of everything feeding it.
	const depthOf = (id: string): number => {
		const node = nodes.get(id)!;
		if (!node.children.length) return 0;
		return 1 + Math.max(...node.children.map(depthOf));
	};
	for (const node of nodes.values()) node.depth = depthOf(node.id);

	// Inputs all share the leftmost column even if they feed deep gates, and
	// the outputs share the column after the deepest gate.
	const maxDepth = Math.max(...[...nodes.values()].map((n) => n.depth));
	const outputColumn = maxDepth + 1;
	for (const node of nodes.values()) node.column = node.kind === 'gate' ? node.depth : 0;

	// A wire that spans more than one column would otherwise cut straight across
	// whatever sits in between. Give it a lane of its own: one dummy slot per
	// column it passes through, which then competes for row space like a gate.
	type Slot = { id: string; column: number; row: number; from: string[]; node?: CircuitNode };
	const slots = new Map<string, Slot>();
	for (const node of nodes.values()) {
		slots.set(node.id, { id: node.id, column: node.column, row: 0, from: [], node });
	}

	/** Each edge as the chain of slots a wire travels through. */
	const routes: { from: string; to: string; pin: number; chain: string[] }[] = [];
	const route = (childId: string, toId: string, toColumn: number, pin: number) => {
		const child = nodes.get(childId)!;
		const chain: string[] = [];
		for (let c = child.column + 1; c < toColumn; c++) {
			const id = `bend:${childId}->${toId}@${c}`;
			slots.set(id, { id, column: c, row: 0, from: [chain.at(-1) ?? childId] });
			chain.push(id);
		}
		slots.get(toId)!.from.push(chain.at(-1) ?? childId);
		routes.push({ from: childId, to: toId, pin, chain });
	};
	for (const node of nodes.values()) {
		node.children.forEach((childId, pin) => route(childId, node.id, node.column, pin));
	}
	// An output box is a slot like any other, so two outputs never land on the
	// same row, and a wire from a shallow gate to the output column is routed
	// around the deeper gates rather than across them.
	for (const out of roots) {
		slots.set(out.id, { id: out.id, column: outputColumn, row: 0, from: [] });
		route(out.rootId, out.id, outputColumn, 0);
	}

	const columns: Slot[][] = Array.from({ length: outputColumn + 1 }, () => []);
	for (const slot of slots.values()) columns[slot.column].push(slot);

	// Inputs in alphabetical order; each later column ordered by the average
	// position of what feeds it, which keeps the wires from crossing needlessly.
	columns[0].sort((a, b) => (a.node?.label ?? '').localeCompare(b.node?.label ?? ''));
	columns[0].forEach((slot, i) => (slot.row = i));
	const rowOf = new Map<string, number>();
	for (const slot of columns[0]) rowOf.set(slot.id, slot.row);
	for (let c = 1; c < columns.length; c++) {
		columns[c].sort((a, b) => barycentre(a) - barycentre(b));
		columns[c].forEach((slot, i) => (slot.row = i));
		for (const slot of columns[c]) rowOf.set(slot.id, slot.row);
	}

	function barycentre(slot: Slot): number {
		const values = slot.from.map((id) => rowOf.get(id)).filter((v): v is number => v != null);
		return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
	}

	// Position, centring each column against the tallest one.
	const rowHeight = GATE_H + ROW_GAP;
	const tallest = Math.max(...columns.map((col) => col.length));
	const height = tallest * rowHeight - ROW_GAP + PAD * 2;
	/** Middle of a slot, which is the height a wire lane runs at. */
	const centreY = new Map<string, number>();
	const laneX = new Map<string, number>();
	columns.forEach((col, c) => {
		const columnHeight = col.length * rowHeight - ROW_GAP;
		const top = PAD + (height - PAD * 2 - columnHeight) / 2;
		col.forEach((slot) => {
			centreY.set(slot.id, top + slot.row * rowHeight + GATE_H / 2);
			laneX.set(slot.id, PAD + c * (GATE_W + COL_GAP));
		});
	});

	// An output box lines up with the wire feeding it wherever it can, so a lone
	// output sits straight across from its gate. Only when two would collide are
	// they nudged apart, and the column is kept inside the canvas.
	const outCol = columns[outputColumn];
	const ys = outCol.map((slot) => centreY.get(slot.from[0])!);
	for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + rowHeight);
	const bottom = height - PAD - GATE_H / 2;
	for (let i = ys.length - 1; i >= 0; i--) {
		ys[i] = Math.min(ys[i], i === ys.length - 1 ? bottom : ys[i + 1] - rowHeight);
	}
	outCol.forEach((slot, i) => centreY.set(slot.id, ys[i]));

	// Sorting the rows decides where each gate sits, but not which of its two
	// pins a wire lands on: that was taken from the order the operands happened
	// to be written in. So `b | a` sent b to the top pin while the input column
	// put a on top, and the two wires crossed for no reason at all. AND, OR and
	// XOR do not care about the order of their inputs, so the pins are free to
	// follow the wires rather than the text.
	const arrivesAt = (route: { from: string; chain: string[] }) => centreY.get(route.chain.at(-1) ?? route.from)!;
	const heights = new Map<string, number>();
	for (const route of routes) heights.set(`${route.to}#${route.pin}`, arrivesAt(route));

	const swapped = new Set<string>();
	for (const node of nodes.values()) {
		if (node.children.length !== 2) continue;
		const [top, bottom] = [heights.get(`${node.id}#0`), heights.get(`${node.id}#1`)];
		if (top == null || bottom == null || top <= bottom) continue;
		node.children = [node.children[1], node.children[0]];
		swapped.add(node.id);
	}

	for (const node of nodes.values()) {
		const cy = centreY.get(node.id)!;
		node.x = laneX.get(node.id)!;
		node.y = cy - node.height / 2;
		node.outX = node.x + node.width;
		node.outY = cy;
		node.inputPorts = pinYs(node.children.length).map((dy) => ({
			x: node.x,
			y: node.y + (node.kind === 'gate' ? dy : node.height / 2)
		}));
	}

	const outputs: CircuitOutput[] = roots.map((out) => ({
		...out,
		x: laneX.get(out.id)!,
		y: centreY.get(out.id)! - IO_H / 2,
		width: OUT_W,
		height: IO_H
	}));
	const width = Math.max(...outputs.map((out) => out.x + out.width)) + PAD;

	/** Smooth horizontal-tangent curve through the points, hull-safe. */
	function pathThrough(points: { x: number; y: number }[]): string {
		let d = `M${round(points[0].x)} ${round(points[0].y)}`;
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			if (Math.abs(a.y - b.y) < 0.01) {
				d += ` L${round(b.x)} ${round(b.y)}`;
			} else {
				const dx = Math.max(10, (b.x - a.x) / 2);
				d += ` C${round(a.x + dx)} ${round(a.y)}, ${round(b.x - dx)} ${round(b.y)}, ${round(b.x)} ${round(b.y)}`;
			}
		}
		return d;
	}
	const round = (n: number) => Math.round(n * 10) / 10;

	const outputById = new Map(outputs.map((out) => [out.id, out]));
	const wires: CircuitWire[] = routes.map(({ from, to, pin: written, chain }) => {
		const child = nodes.get(from)!;
		// The pin the route was built with is the one it was written at; if the
		// gate's inputs were swapped above, it arrives at the other one.
		const pin = swapped.has(to) ? 1 - written : written;
		const target = outputById.get(to);
		const port = target ? { x: target.x, y: target.y + target.height / 2 } : nodes.get(to)!.inputPorts[pin];
		const points = [{ x: child.outX, y: child.outY }];
		// Cross each intermediate column along its own free lane.
		for (const id of chain) {
			const y = centreY.get(id)!;
			points.push({ x: laneX.get(id)!, y }, { x: laneX.get(id)! + GATE_W, y });
		}
		points.push(port);
		return { from, to, pin, points, path: pathThrough(points) };
	});

	const [first] = outputs;
	return {
		nodes: [...nodes.values()],
		wires,
		width,
		height,
		outputs,
		rootId: first.rootId,
		output: { x: first.x, y: first.y, width: first.width, height: first.height },
		gateCount
	};
}

/** Evaluates every node, so the diagram can show live signal states. */
export function circuitStates(circuit: Circuit, values: Record<string, boolean>): Record<string, boolean> {
	const states: Record<string, boolean> = {};
	const byId = new Map(circuit.nodes.map((n) => [n.id, n]));

	const resolve = (id: string): boolean => {
		if (id in states) return states[id];
		const node = byId.get(id)!;
		let result: boolean;
		if (node.kind === 'input') result = !!values[node.label];
		else if (node.kind === 'const') result = node.label === '1';
		else {
			const inputs = node.children.map(resolve);
			result =
				node.op === 'not'
					? !inputs[0]
					: node.op === 'and'
					? inputs[0] && inputs[1]
					: node.op === 'or'
					? inputs[0] || inputs[1]
					: inputs[0] !== inputs[1];
		}
		states[id] = result;
		return result;
	};

	for (const node of circuit.nodes) resolve(node.id);
	return states;
}
