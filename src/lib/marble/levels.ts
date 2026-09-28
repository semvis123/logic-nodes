// The levels of the marble machine. Each one is a target the machine has to
// hit: for every setting of the levers, the marble must reach a cup or must not.
// Nothing here names the logic behind it. The hints only describe what should
// happen, and the reference solutions exist so the tests can prove every level
// can be solved and that its par is the fewest parts there is.

import type { Cells, Part, PartKind, Setup } from './engine.js';
import { cellIndex, emptyCells, leversOf } from './engine.js';

export type Level = {
	id: number;
	hint: string;
	levers: number;
	setup: Setup;
	/** The parts the player may place. */
	tray: PartKind[];
	/** Whether the marble should reach a cup, for each setting of the levers. */
	target: boolean[];
	/** The fewest parts that solve it. */
	par: number;
	/** One way to solve it, as [column, row, part]. */
	solution: [number, number, Part][];
	/** True when the tests can afford to prove that nothing smaller works. */
	provePar: boolean;
};

export const LEVER_NAMES = ['A', 'B', 'C'];

const table = (levers: number, rule: (down: boolean[]) => boolean) =>
	Array.from({ length: 1 << levers }, (_, setting) => rule(leversOf(levers, setting)));

const plank = (lever: number, open: 'down' | 'up', side: -1 | 1): Part => ({ kind: 'plank', lever, open, side });
const seesaw = (a: number, b: number): Part => ({ kind: 'seesaw', a, b });

const setup = (rows: number, cups: number[]): Setup => ({ cols: 5, rows, start: 2, cups });

export const levels: Level[] = [
	{
		id: 1,
		hint: 'Get the marble into the cup only when lever A is down.',
		levers: 1,
		setup: setup(3, [2]),
		tray: ['plank'],
		target: table(1, ([a]) => a),
		par: 1,
		solution: [[2, 0, plank(0, 'down', 1)]],
		provePar: true
	},
	{
		id: 2,
		hint: 'Now the other way round: the cup should catch it only when A is up.',
		levers: 1,
		setup: setup(3, [2]),
		tray: ['plank'],
		target: table(1, ([a]) => !a),
		par: 1,
		solution: [[2, 0, plank(0, 'up', 1)]],
		provePar: true
	},
	{
		id: 3,
		hint: 'Both A and B must be down.',
		levers: 2,
		setup: setup(3, [2]),
		tray: ['plank'],
		target: table(2, ([a, b]) => a && b),
		par: 2,
		solution: [
			[2, 0, plank(0, 'down', 1)],
			[2, 1, plank(1, 'down', 1)]
		],
		provePar: true
	},
	{
		id: 4,
		hint: 'A down, or B down, or both. There are two cups: give the marble a second chance.',
		levers: 2,
		setup: setup(3, [2, 3]),
		tray: ['plank'],
		target: table(2, ([a, b]) => a || b),
		par: 2,
		solution: [
			[2, 0, plank(0, 'down', 1)],
			[3, 1, plank(1, 'down', 1)]
		],
		provePar: true
	},
	{
		id: 5,
		hint: 'Exactly one of the two levers down. The cups are on the sides this time.',
		levers: 2,
		setup: setup(3, [1, 3]),
		tray: ['seesaw'],
		target: table(2, ([a, b]) => a !== b),
		par: 1,
		solution: [[2, 0, seesaw(0, 1)]],
		provePar: true
	},
	{
		id: 6,
		hint: 'The cup is in the middle: the marble should reach it when the levers match.',
		levers: 2,
		setup: setup(3, [2]),
		tray: ['seesaw'],
		target: table(2, ([a, b]) => a === b),
		par: 1,
		solution: [[2, 0, seesaw(0, 1)]],
		provePar: true
	},
	{
		id: 7,
		hint: 'A must be down and B must be up.',
		levers: 2,
		setup: setup(3, [2]),
		tray: ['plank'],
		target: table(2, ([a, b]) => a && !b),
		par: 2,
		solution: [
			[2, 0, plank(0, 'down', 1)],
			[2, 1, plank(1, 'up', 1)]
		],
		provePar: true
	},
	{
		id: 8,
		hint: 'Any lever being down is enough. Three cups, three chances.',
		levers: 3,
		setup: setup(3, [2, 3, 4]),
		tray: ['plank'],
		target: table(3, ([a, b, c]) => a || b || c),
		par: 3,
		solution: [
			[2, 0, plank(0, 'down', 1)],
			[3, 1, plank(1, 'down', 1)],
			[4, 2, plank(2, 'down', 1)]
		],
		provePar: true
	},
	{
		id: 9,
		hint: 'A must be down, and at least one of B and C as well. A plank that swings shut can be the way to the cup.',
		levers: 3,
		setup: setup(4, [2]),
		tray: ['plank', 'ramp'],
		target: table(3, ([a, b, c]) => a && (b || c)),
		par: 3,
		solution: [
			[2, 0, plank(0, 'down', -1)],
			[2, 1, plank(1, 'down', 1)],
			// Shut, this plank slides the marble left, straight back into the cup.
			[3, 2, plank(2, 'up', -1)]
		],
		provePar: true
	},
	{
		id: 10,
		hint: 'Exactly one of A and B down, and C down as well.',
		levers: 3,
		setup: setup(3, [1, 3]),
		tray: ['plank', 'seesaw'],
		target: table(3, ([a, b, c]) => a !== b && c),
		par: 3,
		solution: [
			[2, 0, seesaw(0, 1)],
			[1, 1, plank(2, 'down', -1)],
			[3, 1, plank(2, 'down', 1)]
		],
		provePar: true
	},
	{
		id: 11,
		hint: 'Two or more of the three levers must be down.',
		levers: 3,
		setup: setup(4, [1, 2]),
		tray: ['plank'],
		target: table(3, (down) => down.filter(Boolean).length >= 2),
		par: 4,
		solution: [
			[2, 0, plank(0, 'down', -1)],
			[2, 1, plank(1, 'down', -1)],
			[1, 1, plank(1, 'down', -1)],
			[1, 2, plank(2, 'down', -1)]
		],
		provePar: true
	}
];

/** A level's reference solution laid out as a board. */
export function solutionCells(level: Level): Cells {
	const cells = emptyCells(level.setup);
	for (const [col, row, part] of level.solution) cells[cellIndex(level.setup, col, row)] = part;
	return cells;
}
