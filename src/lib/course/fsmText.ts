// The state machine equations as a lesson can print them. The Karnaugh map
// engine only knows single-letter variables, so $lib/fsm calls the state bits
// a and b; here they are renamed to the Q1 and Q0 the lesson text uses, and
// the AST is kept so a lesson can evaluate a row and show the check.

import { format, type Ast } from '../boolean.js';
import { fsmEquations, stateLabels, stateVariables, type Fsm } from '../fsm.js';

export type NamedEquation = { name: string; text: string; ast: Ast };

function rename(ast: Ast, names: Record<string, string>): Ast {
	switch (ast.t) {
		case 'var':
			return { t: 'var', name: names[ast.name] ?? ast.name };
		case 'const':
			return ast;
		case 'not':
			return { t: 'not', a: rename(ast.a, names) };
		case 'and':
			return { t: 'and', a: rename(ast.a, names), b: rename(ast.b, names) };
		case 'or':
			return { t: 'or', a: rename(ast.a, names), b: rename(ast.b, names) };
		case 'xor':
			return { t: 'xor', a: rename(ast.a, names), b: rename(ast.b, names) };
	}
}

/** The next-state and output equations of `fsm`, written with Q1, Q0 and the input name. */
export function namedEquations(fsm: Fsm): NamedEquation[] {
	const labels = stateLabels(fsm);
	const names = Object.fromEntries(stateVariables(fsm).map((v, i) => [v, labels[i]]));
	return fsmEquations(fsm).map((e) => {
		const ast = rename(e.ast, names);
		return { name: e.name, text: format(ast, 'math'), ast };
	});
}
