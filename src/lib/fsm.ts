// The worked state machines on the finite state machine page. The transition
// tables are the source of truth: the next-state and output equations shown on
// the page are derived from them by the Karnaugh map engine, and the test
// suite checks that simulating those equations walks the same states and
// produces the same outputs as the table itself.

import { karnaughMapFromCells, parseExpression, evaluate, type CellValue, type Ast } from './boolean.js';

export type FsmState = {
	id: string;
	/** What the state means, for the diagram and the table. */
	meaning: string;
	/** The binary code assigned to it, most significant bit first. */
	code: string;
	/** Moore output while in this state; absent for Mealy machines. */
	output?: '0' | '1';
};

export type FsmTransition = {
	from: string;
	input: '0' | '1';
	to: string;
	/** Mealy output on this transition; absent for Moore machines. */
	output?: '0' | '1';
};

export type Fsm = {
	slug: string;
	name: string;
	kind: 'moore' | 'mealy';
	/** What it does, in one sentence. */
	purpose: string;
	input: string;
	states: FsmState[];
	transitions: FsmTransition[];
	/** An input sequence for the step diagram. */
	demo: string;
};

export const fsms: Fsm[] = [
	{
		slug: 'moore-101',
		name: 'Moore sequence detector for 101',
		kind: 'moore',
		purpose:
			'Raises its output for one clock cycle after it has seen the bits 1, 0, 1 arrive in order, overlaps allowed.',
		input: 'x',
		states: [
			{ id: 'S0', meaning: 'nothing useful seen yet', code: '00', output: '0' },
			{ id: 'S1', meaning: 'seen 1', code: '01', output: '0' },
			{ id: 'S2', meaning: 'seen 10', code: '10', output: '0' },
			{ id: 'S3', meaning: 'seen 101', code: '11', output: '1' }
		],
		transitions: [
			{ from: 'S0', input: '0', to: 'S0' },
			{ from: 'S0', input: '1', to: 'S1' },
			{ from: 'S1', input: '0', to: 'S2' },
			{ from: 'S1', input: '1', to: 'S1' },
			{ from: 'S2', input: '0', to: 'S0' },
			{ from: 'S2', input: '1', to: 'S3' },
			{ from: 'S3', input: '0', to: 'S2' },
			{ from: 'S3', input: '1', to: 'S1' }
		],
		demo: '0101101001011'
	},
	{
		slug: 'mealy-101',
		name: 'Mealy sequence detector for 101',
		kind: 'mealy',
		purpose:
			'The same detector with the output on the transitions, which saves a state and flags the pattern a cycle earlier.',
		input: 'x',
		states: [
			{ id: 'S0', meaning: 'nothing useful seen yet', code: '00' },
			{ id: 'S1', meaning: 'seen 1', code: '01' },
			{ id: 'S2', meaning: 'seen 10', code: '10' }
		],
		transitions: [
			{ from: 'S0', input: '0', to: 'S0', output: '0' },
			{ from: 'S0', input: '1', to: 'S1', output: '0' },
			{ from: 'S1', input: '0', to: 'S2', output: '0' },
			{ from: 'S1', input: '1', to: 'S1', output: '0' },
			{ from: 'S2', input: '0', to: 'S0', output: '0' },
			{ from: 'S2', input: '1', to: 'S1', output: '1' }
		],
		demo: '0101101001011'
	}
];

export const fsmBySlug = (slug: string) => fsms.find((f) => f.slug === slug);

/**
 * The state bits as the engine's variables, most significant first. The
 * engine only knows single-letter names (adjacent letters mean AND), so the
 * bits are a, b, ... and the page labels them Q1, Q0 alongside.
 */
export function stateVariables(fsm: Fsm): string[] {
	const width = fsm.states[0].code.length;
	return Array.from({ length: width }, (_, i) => String.fromCharCode(97 + i));
}

/** What each state variable is called in the text: Q1, Q0. */
export function stateLabels(fsm: Fsm): string[] {
	const width = fsm.states[0].code.length;
	return Array.from({ length: width }, (_, i) => `Q${width - 1 - i}`);
}

export type FsmEquation = {
	/** d1, d0 for the next-state bits, z for the output. */
	name: string;
	text: string;
	ast: Ast;
};

/**
 * Derives the D flip-flop input equations and the output equation from the
 * transition table. Rows for codes no state uses are don't cares.
 */
export function fsmEquations(fsm: Fsm): FsmEquation[] {
	const stateVars = stateVariables(fsm);
	const width = stateVars.length;
	const variables = [...stateVars, fsm.input];
	const rows = 1 << variables.length;
	const byCode = new Map(fsm.states.map((s) => [s.code, s]));
	const byId = new Map(fsm.states.map((s) => [s.id, s]));

	const column = (pick: (state: FsmState, transition: FsmTransition) => boolean): CellValue[] =>
		Array.from({ length: rows }, (_, row) => {
			const code = (row >> 1).toString(2).padStart(width, '0');
			const input = row & 1 ? '1' : '0';
			const state = byCode.get(code);
			if (!state) return 'x';
			const transition = fsm.transitions.find((t) => t.from === state.id && t.input === input);
			if (!transition) throw new Error(`${fsm.slug}: no transition from ${state.id} on ${input}`);
			return pick(state, transition) ? 1 : 0;
		});

	const equations: FsmEquation[] = [];
	for (let bit = 0; bit < width; bit++) {
		const cells = column((_, t) => byId.get(t.to)!.code[bit] === '1');
		const map = karnaughMapFromCells(variables, cells);
		equations.push({ name: `d${width - 1 - bit}`, text: map.text, ast: parseExpression(map.text) });
	}
	const outputCells = fsm.kind === 'moore' ? column((s) => s.output === '1') : column((_, t) => t.output === '1');
	const map = karnaughMapFromCells(variables, outputCells);
	equations.push({ name: 'z', text: map.text, ast: parseExpression(map.text) });
	return equations;
}

export type FsmStep = {
	input: '0' | '1';
	state: string;
	next: string;
	output: '0' | '1';
};

/** Walks the transition table over an input string, starting from the first state. */
export function walkTable(fsm: Fsm, inputs: string): FsmStep[] {
	let state = fsm.states[0].id;
	const steps: FsmStep[] = [];
	for (const ch of inputs) {
		const input = ch === '1' ? '1' : '0';
		const transition = fsm.transitions.find((t) => t.from === state && t.input === input)!;
		const output = fsm.kind === 'moore' ? fsm.states.find((s) => s.id === state)!.output! : transition.output!;
		steps.push({ input, state, next: transition.to, output });
		state = transition.to;
	}
	return steps;
}

/** Runs the derived equations over the same input string, reporting the state codes. */
export function walkEquations(
	fsm: Fsm,
	equations: FsmEquation[],
	inputs: string
): { code: string; output: '0' | '1' }[] {
	const stateVars = stateVariables(fsm);
	let code = fsm.states[0].code;
	const out: { code: string; output: '0' | '1' }[] = [];
	for (const ch of inputs) {
		const values: Record<string, boolean> = { [fsm.input]: ch === '1' };
		stateVars.forEach((name, i) => (values[name] = code[i] === '1'));
		const z = evaluate(equations.find((e) => e.name === 'z')!.ast, values);
		const width = stateVars.length;
		const nextCode = stateVars
			.map((_, i) => (evaluate(equations.find((e) => e.name === `d${width - 1 - i}`)!.ast, values) ? '1' : '0'))
			.join('');
		out.push({ code, output: z ? '1' : '0' });
		code = nextCode;
	}
	return out;
}
