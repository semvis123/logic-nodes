// The rules of the marble machine, with no drawing in them.
//
// A marble is dropped into the top of a grid and falls one row at a time. In
// every cell it meets either nothing, which lets it fall straight on, or a part
// that sends it straight down, one column left, or one column right. When it
// leaves the bottom row it lands in a cup or in a drain. The levers along the
// top are the inputs and "the marble reached a cup" is the output, so a machine
// is a boolean function that has been built out of planks and seesaws.
//
// Nothing here is random or timed, so a machine always does the same thing for
// the same levers, which is what lets the tests check it against a truth table.

/** True means the lever is pulled down. */
export type Levers = boolean[];

export type Side = -1 | 1;

/** A flap that lets the marble through when its lever agrees, and otherwise slides it off to one side. */
export type Plank = { kind: 'plank'; lever: number; open: 'down' | 'up'; side: Side };
/** Two flaps: the marble tips left when only the first lever is down and right when only the second is. */
export type Seesaw = { kind: 'seesaw'; a: number; b: number };
/** A fixed slide that always sends the marble to one side. */
export type Ramp = { kind: 'ramp'; side: Side };

export type Part = Plank | Seesaw | Ramp;
export type PartKind = Part['kind'];

/** The shape of a level's board. Cells are stored row by row, from the top. */
export type Setup = {
	cols: number;
	rows: number;
	/** The column the marble is dropped into. */
	start: number;
	/** The columns whose landing spot is a cup. */
	cups: number[];
};

export type Cells = (Part | null)[];

export const emptyCells = (setup: Setup): Cells => Array<Part | null>(setup.cols * setup.rows).fill(null);

export const cellIndex = (setup: Setup, col: number, row: number) => row * setup.cols + col;

/** Which way a part sends the marble: straight down, or a column to either side. */
export function exitOf(part: Part, levers: Levers): -1 | 0 | 1 {
	switch (part.kind) {
		case 'plank':
			return levers[part.lever] === (part.open === 'down') ? 0 : part.side;
		case 'ramp':
			return part.side;
		case 'seesaw': {
			const a = !!levers[part.a];
			const b = !!levers[part.b];
			if (a === b) return 0;
			return a ? -1 : 1;
		}
	}
}

/** What happened in one row: where the marble was, what it met, and which way it left. */
export type Step = { col: number; row: number; part: Part | null; exit: -1 | 0 | 1 };

export type Run = {
	steps: Step[];
	/** The column the marble ended in, or null if it slid off the side of the board. */
	landing: number | null;
	/** True when the marble ended in a cup. */
	cup: boolean;
};

export function simulate(setup: Setup, cells: Cells, levers: Levers): Run {
	const steps: Step[] = [];
	let col = setup.start;
	for (let row = 0; row < setup.rows; row++) {
		const part = cells[cellIndex(setup, col, row)];
		const exit = part ? exitOf(part, levers) : 0;
		steps.push({ col, row, part, exit });
		col += exit;
		if (col < 0 || col >= setup.cols) return { steps, landing: null, cup: false };
	}
	return { steps, landing: col, cup: setup.cups.includes(col) };
}

/** Lever i is down in setting s when bit (n - 1 - i) of s is set, so lever A is the top bit as in a truth table. */
export function leversOf(count: number, setting: number): Levers {
	return Array.from({ length: count }, (_, i) => !!(setting & (1 << (count - 1 - i))));
}

/** Whether the marble reaches a cup, for every one of the 2^n settings of the levers. */
export function outputs(setup: Setup, cells: Cells, count: number): boolean[] {
	return Array.from({ length: 1 << count }, (_, setting) => simulate(setup, cells, leversOf(count, setting)).cup);
}

export const partCount = (cells: Cells) => cells.filter(Boolean).length;

/** A part as it is first placed, before the player ties it to a lever. */
export function defaultPart(kind: PartKind, col: number, setup: Setup, levers: number): Part {
	const side: Side = col >= setup.cols - 1 ? -1 : 1;
	switch (kind) {
		case 'plank':
			return { kind, lever: 0, open: 'down', side };
		case 'ramp':
			return { kind, side };
		case 'seesaw':
			return { kind, a: 0, b: Math.min(1, levers - 1) };
	}
}

/** Every distinct part a player could place, for the given tray and lever count. */
export function partOptions(tray: PartKind[], levers: number): Part[] {
	const options: Part[] = [];
	const sides: Side[] = [-1, 1];
	for (const kind of tray) {
		if (kind === 'plank') {
			for (let lever = 0; lever < levers; lever++)
				for (const open of ['down', 'up'] as const)
					for (const side of sides) options.push({ kind, lever, open, side });
		} else if (kind === 'ramp') {
			for (const side of sides) options.push({ kind, side });
		} else {
			for (let a = 0; a < levers; a++)
				for (let b = 0; b < levers; b++) if (a !== b) options.push({ kind, a, b });
		}
	}
	return options;
}

/**
 * The fewest parts that make the machine match `target`, found by trying every
 * arrangement of up to `limit` parts, or null if none of that size works. Used
 * by the tests to prove that a level's par really is the best there is, so it is
 * only practical for small levels.
 */
export function fewestParts(
	setup: Setup,
	tray: PartKind[],
	levers: number,
	target: boolean[],
	limit: number
): number | null {
	const options = partOptions(tray, levers);
	const cells = emptyCells(setup);
	// Stops at the first setting that disagrees, which is nearly always the first or second.
	const matches = () => target.every((value, setting) => simulate(setup, cells, leversOf(levers, setting)).cup === value);

	const search = (from: number, left: number): boolean => {
		if (left === 0) return matches();
		for (let cell = from; cell < cells.length; cell++) {
			for (const option of options) {
				cells[cell] = option;
				if (search(cell + 1, left - 1)) {
					cells[cell] = null;
					return true;
				}
			}
			cells[cell] = null;
		}
		return false;
	};

	for (let count = 0; count <= limit; count++) if (search(0, count)) return count;
	return null;
}
