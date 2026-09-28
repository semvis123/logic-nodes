// Where everything sits on the board, and how a marble's run turns into motion.
//
// The whole board is drawn in one coordinate system where a cell is 64 units
// square, so it scales to any width and stays sharp. This file has no DOM in it:
// the timeline is a plain list of segments the page plays back, which keeps the
// motion testable and lets "reduced motion" skip straight to the end.

import type { Run, Setup } from './engine.js';

export const CELL = 64;
/** Space to the left and right of the cells. */
export const PAD = 20;
/** Height of the lever rail and hopper above the first row. */
export const TOP = 114;
/** Height of the landing row of cups and drains below the last row. */
export const LAND = 84;
/** The marble's radius. */
export const RADIUS = 11;

export const boardSize = (setup: Setup) => ({
	width: setup.cols * CELL + 2 * PAD,
	height: TOP + setup.rows * CELL + LAND
});

export const cellCenter = (col: number, row: number) => ({
	x: PAD + col * CELL + CELL / 2,
	y: TOP + row * CELL + CELL / 2
});

/** Where the marble comes to rest inside a cup or drain. */
export const landingPoint = (setup: Setup, col: number) => ({
	x: PAD + col * CELL + CELL / 2,
	y: TOP + setup.rows * CELL + 46
});

/** Levers sit in a row along the top rail, spread evenly across the board. */
export const leverPosition = (setup: Setup, index: number, count: number) => ({
	x: PAD + ((index + 0.5) * setup.cols * CELL) / count,
	y: 12
});

/** A lever's slot is this tall and its knob travels the whole length. */
export const LEVER_SLOT = { width: 26, height: 46 };

/** The slope of a plank, a flap or a ramp: it rises one cell-half over a cell-width. */
export const SLOPE_DEGREES = (Math.atan(0.5) * 180) / Math.PI;

export type Ease = 'linear' | 'in' | 'out';

export type Segment = {
	from: { x: number; y: number };
	to: { x: number; y: number };
	ms: number;
	ease: { x: Ease; y: Ease };
	/** The cell whose part gets a small bump when the marble reaches the start of this segment. */
	bump?: number;
};

const easing: Record<Ease, (t: number) => number> = {
	linear: (t) => t,
	in: (t) => t * t,
	out: (t) => 1 - (1 - t) * (1 - t)
};

/** Where the marble is, part-way through a segment. */
export function pointAt(segment: Segment, t: number) {
	const clamped = Math.min(1, Math.max(0, t));
	return {
		x: segment.from.x + (segment.to.x - segment.from.x) * easing[segment.ease.x](clamped),
		y: segment.from.y + (segment.to.y - segment.from.y) * easing[segment.ease.y](clamped)
	};
}

/**
 * The marble's whole trip as a list of segments. Falling accelerates, sliding
 * along a plank accelerates a little less, and leaving the end of a plank is a
 * short arc: the marble keeps moving sideways while gravity takes over.
 * `speed` above 1 plays it faster.
 */
export function timeline(setup: Setup, run: Run, speed = 1): Segment[] {
	const { height, width } = boardSize(setup);
	const segments: Segment[] = [];
	const ms = (base: number) => Math.max(40, base / speed);
	const fall = (d: number) => ms(70 + 150 * Math.sqrt(Math.max(d, 0) / CELL));

	let at = { x: cellCenter(setup.start, 0).x, y: TOP - 30 };
	const go = (to: { x: number; y: number }, duration: number, ease: Segment['ease'], bump?: number) => {
		segments.push({ from: at, to, ms: duration, ease, bump });
		at = to;
	};

	for (const step of run.steps) {
		if (!step.part) continue;
		const { x, y } = cellCenter(step.col, step.row);
		const index = step.row * setup.cols + step.col;
		// Down to the part: the marble arrives just above the flap or slide.
		go({ x, y: y - 13 }, fall(y - 13 - at.y), { x: 'linear', y: 'in' }, index);
		if (step.exit === 0) {
			go({ x, y: y + CELL / 2 }, fall(CELL / 2 + 13), { x: 'linear', y: 'in' });
		} else {
			// Along the plank to its end, then off it and into the next lane.
			go({ x: x + step.exit * 34, y: y + 6 }, ms(200), { x: 'in', y: 'in' });
			go({ x: x + step.exit * CELL, y: y + CELL / 2 }, ms(150), { x: 'linear', y: 'in' });
		}
	}

	if (run.landing === null) {
		// Slid off the side of the board: carry on out of sight.
		const last = run.steps[run.steps.length - 1];
		const dir = last.exit || 1;
		go({ x: dir > 0 ? width + 30 : -30, y: at.y + 40 }, ms(220), { x: 'linear', y: 'in' });
		go({ x: at.x + dir * 20, y: height + 30 }, ms(320), { x: 'linear', y: 'in' });
	} else {
		const land = landingPoint(setup, run.landing);
		go({ x: land.x, y: land.y }, fall(land.y - at.y), { x: 'linear', y: 'in' });
	}
	return segments;
}

export const totalMs = (segments: Segment[]) => segments.reduce((sum, s) => sum + s.ms, 0);

/** The segment playing at time `t`, and how far through it we are (0 to 1). */
export function segmentAt(segments: Segment[], t: number): { index: number; progress: number } {
	let start = 0;
	for (let index = 0; index < segments.length; index++) {
		const end = start + segments[index].ms;
		if (t < end) return { index, progress: (t - start) / segments[index].ms };
		start = end;
	}
	return { index: segments.length - 1, progress: 1 };
}

/** The route as an SVG path, for the dashed trail that stays behind after a run. */
export function trailPath(segments: Segment[]): string {
	if (!segments.length) return '';
	const points = [segments[0].from, ...segments.map((s) => s.to)];
	return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
