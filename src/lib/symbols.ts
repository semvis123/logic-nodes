// Gate symbol geometry, drawn once here and reused by the symbols page and the
// circuit diagram generator. Coordinates are in a 70 x 50 box with the inputs
// entering at x = 0 and the output leaving at x = 70.

export type GateShape = {
	/** Outline of the body, as SVG path data. */
	body: string;
	/** A second stroke-only path, used for the XOR back curve. */
	extra?: string;
	/** x of the inverting bubble, if the gate has one. */
	bubble?: number;
	/** Where the input leads stop and the output lead starts. */
	leadIn: number;
	leadOut: number;
	/** Number of input pins the symbol is drawn with. */
	inputs: 1 | 2;
	/** The label inside the IEC rectangle. */
	iec: string;
	/** IEC rectangles mark inversion with a bubble too. */
	iecBubble: boolean;
};

export const shapes: Record<string, GateShape> = {
	// A flat back with a semicircular nose.
	and: {
		body: 'M6 4 H29 A21 21 0 0 1 29 46 H6 Z',
		leadIn: 6,
		leadOut: 50,
		inputs: 2,
		iec: '&',
		iecBubble: false
	},
	// A curved back drawn into a point.
	or: {
		body: 'M6 4 Q22 25 6 46 Q34 46 50 25 Q34 4 6 4 Z',
		leadIn: 10,
		leadOut: 50,
		inputs: 2,
		iec: '≥1',
		iecBubble: false
	},
	not: {
		body: 'M8 5 L44 25 L8 45 Z',
		bubble: 48,
		leadIn: 8,
		leadOut: 52,
		inputs: 1,
		iec: '1',
		iecBubble: true
	},
	nand: {
		body: 'M6 4 H29 A21 21 0 0 1 29 46 H6 Z',
		bubble: 54,
		leadIn: 6,
		leadOut: 58,
		inputs: 2,
		iec: '&',
		iecBubble: true
	},
	nor: {
		body: 'M6 4 Q22 25 6 46 Q34 46 50 25 Q34 4 6 4 Z',
		bubble: 54,
		leadIn: 10,
		leadOut: 58,
		inputs: 2,
		iec: '≥1',
		iecBubble: true
	},
	// An OR shifted right, with a second curve behind it.
	xor: {
		body: 'M12 4 Q28 25 12 46 Q40 46 56 25 Q40 4 12 4 Z',
		extra: 'M4 4 Q20 25 4 46',
		leadIn: 14,
		leadOut: 56,
		inputs: 2,
		iec: '=1',
		iecBubble: false
	}
};

/** y positions of the input leads for a symbol with one or two inputs. */
export const inputYs = (count: 1 | 2) => (count === 1 ? [25] : [16, 34]);
