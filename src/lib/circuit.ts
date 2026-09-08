// Turns an expression into a positioned circuit diagram: a small DAG layout
// with gates in columns by depth and wires routed between them. Identical
// subexpressions collapse into one gate, the way they would in a real circuit.

import { astKey, type Ast } from './boolean.js';

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

export type Circuit = {
	nodes: CircuitNode[];
	wires: CircuitWire[];
	width: number;
	height: number;
	/** Id of the node driving the output. */
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

export function buildCircuit(ast: Ast): Circuit {
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

	const rootId = add(ast);
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

	// Inputs all share the leftmost column even if they feed deep gates.
	const maxDepth = Math.max(...[...nodes.values()].map((n) => n.depth));
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
	for (const node of nodes.values()) {
		node.children.forEach((childId, pin) => {
			const child = nodes.get(childId)!;
			const chain: string[] = [];
			for (let c = child.column + 1; c < node.column; c++) {
				const id = `bend:${childId}->${node.id}@${c}`;
				slots.set(id, { id, column: c, row: 0, from: [chain.at(-1) ?? childId] });
				chain.push(id);
			}
			slots.get(node.id)!.from.push(chain.at(-1) ?? childId);
			routes.push({ from: childId, to: node.id, pin, chain });
		});
	}

	const columns: Slot[][] = Array.from({ length: maxDepth + 1 }, () => []);
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
			const x = PAD + c * (GATE_W + COL_GAP);
			const cy = top + slot.row * rowHeight + GATE_H / 2;
			centreY.set(slot.id, cy);
			laneX.set(slot.id, x);
			const node = slot.node;
			if (!node) return;
			node.x = x;
			node.y = cy - node.height / 2;
			node.outX = node.x + node.width;
			node.outY = cy;
			node.inputPorts = pinYs(node.children.length).map((dy) => ({
				x: node.x,
				y: node.y + (node.kind === 'gate' ? dy : node.height / 2)
			}));
		});
	});

	const root = nodes.get(rootId)!;
	const output = {
		x: root.x + GATE_W + COL_GAP,
		y: root.outY - IO_H / 2,
		width: OUT_W,
		height: IO_H
	};
	const width = output.x + output.width + PAD;

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

	const wires: CircuitWire[] = routes.map(({ from, to, pin, chain }) => {
		const child = nodes.get(from)!;
		const port = nodes.get(to)!.inputPorts[pin];
		const points = [{ x: child.outX, y: child.outY }];
		// Cross each intermediate column along its own free lane.
		for (const id of chain) {
			const y = centreY.get(id)!;
			points.push({ x: laneX.get(id)!, y }, { x: laneX.get(id)! + GATE_W, y });
		}
		points.push(port);
		return { from, to, pin, points, path: pathThrough(points) };
	});
	wires.push({
		from: rootId,
		to: 'output',
		pin: 0,
		points: [
			{ x: root.outX, y: root.outY },
			{ x: output.x, y: root.outY }
		],
		path: `M${round(root.outX)} ${round(root.outY)} L${round(output.x)} ${round(root.outY)}`
	});

	return {
		nodes: [...nodes.values()],
		wires,
		width,
		height,
		rootId,
		output,
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
