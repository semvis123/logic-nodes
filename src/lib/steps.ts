// Simplification with the working shown: rewrites an expression one named law
// at a time, so the answer comes with a derivation a student can copy out.
//
// The minimiser in boolean.ts finds the smallest sum of products by table
// search (Quine-McCluskey), which is reliable but says nothing about why. This
// does the opposite: it only ever applies a law from laws.ts, and records each
// application, so the result is arrived at the way it would be on paper.
//
// Every rewrite here preserves the truth table, and the test suite checks that
// claim step by step against random expressions rather than trusting it.

import { format, parseExpression, simplify, truthTable, variablesOf, type Ast, type Notation } from './boolean.js';

/**
 * AND, OR and XOR are flattened into n-ary groups while rewriting. Matching a
 * law like absorption means finding two terms anywhere in a group regardless of
 * order, and reassociating a binary tree to do that would fill the derivation
 * with commutativity and associativity steps that teach nothing.
 */
type N =
	| { t: 'var'; name: string }
	| { t: 'const'; v: boolean }
	| { t: 'not'; a: N }
	| { t: 'and'; xs: N[] }
	| { t: 'or'; xs: N[] }
	| { t: 'xor'; xs: N[] };

export type Step = {
	/** The law applied, matching a name in laws.ts so the page can link to it. */
	law: string;
	/** What that law did here, in terms of the parts it matched. */
	detail: string;
	/** The whole expression after this step, already formatted. */
	text: string;
};

export type Working = {
	steps: Step[];
	/** The expression the laws arrived at. */
	text: string;
	/** The minimiser's answer, for comparison. */
	minimalText: string;
	/** True when the laws reached the same form the minimiser did. */
	isMinimal: boolean;
	/** True when it stopped on the step limit rather than running out of moves. */
	stoppedEarly: boolean;
	/** Set when the expression was too big to work through by hand. */
	tooBig: boolean;
};

/** Past this a derivation is longer than anyone will read. */
const MAX_STEPS = 40;
/** Distribution multiplies terms out, so it needs its own ceiling. */
const MAX_TERMS = 24;

// --- converting to and from the binary AST ----------------------------------

function toN(ast: Ast): N {
	switch (ast.t) {
		case 'var':
			return { t: 'var', name: ast.name };
		case 'const':
			return { t: 'const', v: ast.v };
		case 'not':
			return { t: 'not', a: toN(ast.a) };
		default: {
			// Flatten a run of the same operator into one group.
			const xs: N[] = [];
			const collect = (node: Ast) => {
				if (node.t === ast.t) {
					collect(node.a);
					collect(node.b);
				} else {
					xs.push(toN(node));
				}
			};
			collect(ast);
			return { t: ast.t, xs };
		}
	}
}

function toAst(n: N): Ast {
	switch (n.t) {
		case 'var':
			return { t: 'var', name: n.name };
		case 'const':
			return { t: 'const', v: n.v };
		case 'not':
			return { t: 'not', a: toAst(n.a) };
		default: {
			if (!n.xs.length) return { t: 'const', v: n.t === 'and' };
			return n.xs.map(toAst).reduce((a, b) => ({ t: n.t, a, b } as Ast));
		}
	}
}

/** A structural key that ignores the order of a commutative group's terms. */
function key(n: N): string {
	switch (n.t) {
		case 'var':
			return n.name;
		case 'const':
			return n.v ? '1' : '0';
		case 'not':
			return `!${key(n.a)}`;
		default:
			return `${n.t}(${n.xs.map(key).sort().join(',')})`;
	}
}

const same = (a: N, b: N) => key(a) === key(b);
const negate = (n: N): N => (n.t === 'not' ? n.a : { t: 'not', a: n });
const isNegationOf = (a: N, b: N) => key(negate(a)) === key(b);

/**
 * Re-flattens nested groups of the same operator. Rewrites build new groups
 * from old parts, so an AND can end up directly inside an AND; every rule here
 * assumes that has already been dealt with. This is associativity, applied
 * silently because a derivation full of reassociation steps teaches nothing.
 */
function norm(n: N): N {
	if (n.t === 'var' || n.t === 'const') return n;
	if (n.t === 'not') return { t: 'not', a: norm(n.a) };
	const xs: N[] = [];
	for (const child of n.xs.map(norm)) {
		if (child.t === n.t) xs.push(...child.xs);
		else xs.push(child);
	}
	return xs.length === 1 ? xs[0] : { t: n.t, xs };
}

/** How big an expression is, used to stop distribution running away. */
function size(n: N): number {
	if (n.t === 'var' || n.t === 'const') return 1;
	if (n.t === 'not') return 1 + size(n.a);
	return n.xs.reduce((total, x) => total + size(x), 1);
}

// --- the laws ---------------------------------------------------------------

type Rewrite = { n: N; law: string; detail: string };

/** The terms of a product, so two products can be compared literal by literal. */
const literalsOf = (n: N): N[] => (n.t === 'and' ? n.xs : [n]);

/** The same, for whichever operator is nested inside the group being examined. */
const partsOf = (n: N, inner: 'and' | 'or'): N[] => (n.t === inner ? n.xs : [n]);

function fmt(n: N, notation: Notation): string {
	return format(toAst(n), notation);
}

/**
 * One rewrite at this node, or null. Children are handled by the caller, so
 * every rule here can assume its arguments are already as simple as they get.
 */
function ruleFor(n: N, notation: Notation, sop: boolean): Rewrite | null {
	const show = (x: N) => fmt(x, notation);

	if (n.t === 'not') {
		if (n.a.t === 'not') {
			return { n: n.a.a, law: 'Double negation', detail: `two negations on ${show(n.a.a)} cancel` };
		}
		if (n.a.t === 'const') {
			return {
				n: { t: 'const', v: !n.a.v },
				// Not the XOR law of the same name in laws.ts: this is bookkeeping,
				// and pointing at that anchor would send the reader somewhere unrelated.
				law: 'Constant negation',
				detail: `the opposite of ${n.a.v ? 1 : 0} is ${n.a.v ? 0 : 1}`
			};
		}
		if (n.a.t === 'and' || n.a.t === 'or') {
			// De Morgan, pushing the negation onto each term.
			const flipped: N = { t: n.a.t === 'and' ? 'or' : 'and', xs: n.a.xs.map(negate) };
			return {
				n: flipped,
				law: 'De Morgan',
				detail: `negating ${n.a.t === 'and' ? 'an AND' : 'an OR'} flips it to ${
					n.a.t === 'and' ? 'an OR' : 'an AND'
				} and negates each term`
			};
		}
		return null;
	}

	if (n.t === 'xor') {
		if (n.xs.length === 2 && same(n.xs[0], n.xs[1])) {
			return { n: { t: 'const', v: false }, law: 'Self cancel', detail: `nothing ever differs from itself` };
		}
		// Expanding XOR puts the whole expression in terms the other laws handle.
		const [a, b] = [n.xs[0], n.xs.length === 2 ? n.xs[1] : ({ t: 'xor', xs: n.xs.slice(1) } as N)];
		return {
			n: {
				t: 'or',
				xs: [
					{ t: 'and', xs: [a, negate(b)] },
					{ t: 'and', xs: [negate(a), b] }
				]
			},
			law: 'Definition',
			detail: `XOR is high when exactly one of ${show(a)} and ${show(b)} is`
		};
	}

	if (n.t !== 'and' && n.t !== 'or') return null;

	const isAnd = n.t === 'and';
	// AND and OR obey the same laws with 0 and 1 swapped, so one body does both.
	const annulling = !isAnd; // the value that forces the result: 1 for OR, 0 for AND
	const neutral = isAnd; // the value that can be dropped
	const xs = n.xs;

	// A group of one is not a group.
	if (xs.length === 1) return { n: xs[0], law: '', detail: '' };

	const constant = xs.find((x) => x.t === 'const' && x.v === annulling);
	if (constant) {
		return {
			n: { t: 'const', v: annulling },
			law: 'Annulment',
			detail: `a single ${annulling ? 1 : 0} into ${isAnd ? 'an AND' : 'an OR'} decides it`
		};
	}

	if (xs.some((x) => x.t === 'const' && x.v === neutral)) {
		const kept = xs.filter((x) => x.t !== 'const');
		return {
			n: kept.length ? { t: n.t, xs: kept } : { t: 'const', v: neutral },
			law: 'Identity',
			detail: `${neutral ? 1 : 0} changes nothing in ${isAnd ? 'an AND' : 'an OR'}`
		};
	}

	// Idempotence: the same term twice.
	for (let i = 0; i < xs.length; i++) {
		for (let j = i + 1; j < xs.length; j++) {
			if (same(xs[i], xs[j])) {
				return {
					n: { t: n.t, xs: xs.filter((_, k) => k !== j) },
					law: 'Idempotence',
					detail: `${show(xs[i])} appears twice`
				};
			}
		}
	}

	// Complement: a term alongside its own negation.
	for (let i = 0; i < xs.length; i++) {
		for (let j = i + 1; j < xs.length; j++) {
			if (isNegationOf(xs[i], xs[j])) {
				return {
					n: { t: 'const', v: annulling },
					law: 'Complement',
					detail: `${show(xs[i])} and ${show(xs[j])} can never both be satisfied, giving ${annulling ? 1 : 0}`
				};
			}
		}
	}

	// Absorption: a ∨ (a ∧ b) = a, and its dual a ∧ (a ∨ b) = a.
	const inner = isAnd ? 'or' : 'and';
	for (let i = 0; i < xs.length; i++) {
		const group = xs[i];
		if (group.t !== inner) continue;
		const swallower = xs.find((other, k) => k !== i && group.xs.some((part) => same(part, other)));
		if (swallower) {
			const kept = xs.filter((_, k) => k !== i);
			return {
				n: kept.length === 1 ? kept[0] : { t: n.t, xs: kept },
				law: 'Absorption',
				detail: `${show(group)} already needs ${show(swallower)}, so it adds nothing`
			};
		}
	}

	// Redundancy: a ∨ (¬a ∧ b) = a ∨ b. Stated generally, a term L ∧ S sitting
	// next to ¬L ∧ R lets R drop the ¬L, provided S is contained in R: when L is
	// high the first term already covers everything R could, and when L is low
	// the ¬L was never doing any work. The single literal form in the textbooks
	// is this with S empty.
	for (let p = 0; p < xs.length; p++) {
		for (let q = 0; q < xs.length; q++) {
			if (p === q) continue;
			const carrier = xs[q];
			if (carrier.t !== inner) continue;
			const left = partsOf(xs[p], inner);
			const right = carrier.xs;
			const opposed = left.filter((l) => right.some((r) => isNegationOf(l, r)));
			if (opposed.length !== 1) continue;
			// Everything else the first term needs must already be in the second.
			const rest = left.filter((l) => !same(l, opposed[0]));
			if (!rest.every((l) => right.some((r) => same(l, r)))) continue;
			const trimmed = right.filter((r) => !isNegationOf(opposed[0], r));
			if (!trimmed.length || trimmed.length === right.length) continue;
			const replacement: N = trimmed.length === 1 ? trimmed[0] : { t: inner, xs: trimmed };
			return {
				n: { t: n.t, xs: xs.map((x, k) => (k === q ? replacement : x)) },
				law: 'Redundancy',
				detail: `${show(xs[p])} already covers everything ${show(negate(opposed[0]))} rules out here`
			};
		}
	}

	// Adjacency: (a ∧ b) ∨ (a ∧ ¬b) = a. Two products whose literals agree
	// everywhere but one variable, which appears in both polarities and so
	// cannot matter. Compared as sets of literals: a repeated literal is the
	// business of idempotence, and would otherwise make two equal terms look
	// different.
	for (let i = 0; i < xs.length; i++) {
		for (let j = i + 1; j < xs.length; j++) {
			const left = new Map(literalsOf(xs[i]).map((l) => [key(l), l]));
			const right = new Map(literalsOf(xs[j]).map((l) => [key(l), l]));
			if (left.size !== right.size) continue;
			const onlyLeft = [...left.values()].filter((l) => !right.has(key(l)));
			const onlyRight = [...right.values()].filter((r) => !left.has(key(r)));
			if (onlyLeft.length !== 1 || onlyRight.length !== 1) continue;
			if (!isNegationOf(onlyLeft[0], onlyRight[0])) continue;
			const shared = [...left.values()].filter((l) => right.has(key(l)));
			if (!shared.length) continue; // that is complement, handled above
			const merged: N = shared.length === 1 ? shared[0] : { t: isAnd ? 'or' : 'and', xs: shared };
			const kept = xs.filter((_, k) => k !== i && k !== j);
			return {
				n: kept.length ? { t: n.t, xs: [merged, ...kept] } : merged,
				law: 'Adjacency',
				detail: `${show(xs[i])} and ${show(xs[j])} differ only in ${show(onlyLeft[0])}, which therefore does not matter`
			};
		}
	}

	// Consensus: (a ∧ b) ∨ (¬a ∧ c) ∨ (b ∧ c) drops the third term.
	for (let i = 0; i < xs.length; i++) {
		for (let j = 0; j < xs.length; j++) {
			if (i === j) continue;
			const left = literalsOf(xs[i]);
			const right = literalsOf(xs[j]);
			const pivot = left.find((l) => right.some((r) => isNegationOf(l, r)));
			if (!pivot) continue;
			// The consensus term is everything else from both, with the pivot gone.
			const rest = [...left.filter((l) => !same(l, pivot)), ...right.filter((r) => !isNegationOf(pivot, r))];
			if (!rest.length) continue;
			const consensusKey = key({ t: isAnd ? 'or' : 'and', xs: rest });
			const redundant = xs.findIndex((x, k) => k !== i && k !== j && key(x) === consensusKey);
			if (redundant < 0) continue;
			return {
				n: { t: n.t, xs: xs.filter((_, k) => k !== redundant) },
				law: 'Consensus',
				detail: `${show(xs[redundant])} is already covered by ${show(xs[i])} and ${show(xs[j])} together`
			};
		}
	}

	// Distribution, only once the reducing laws have nothing left to do. This is
	// what turns a nested expression into a sum of products.
	if (sop && isAnd) {
		const at = xs.findIndex((x) => x.t === 'or');
		if (at >= 0) {
			const group = xs[at] as { t: 'or'; xs: N[] };
			const others = xs.filter((_, k) => k !== at);
			const expanded: N = {
				t: 'or',
				xs: group.xs.map((part) => ({ t: 'and', xs: [...others, part] } as N))
			};
			if (size(expanded) <= MAX_TERMS * 3) {
				return {
					n: expanded,
					law: 'Distributivity',
					detail: `multiplying ${others.map(show).join(' ∧ ')} into ${show(group)}`
				};
			}
		}
	}

	return null;
}

/** Finds one rewrite in the tree, innermost first, so the working reads bottom up. */
function rewriteOnce(n: N, notation: Notation, sop: boolean): Rewrite | null {
	if (n.t === 'not') {
		const inner = rewriteOnce(n.a, notation, sop);
		if (inner) return { ...inner, n: { t: 'not', a: inner.n } };
	} else if (n.t !== 'var' && n.t !== 'const') {
		for (let i = 0; i < n.xs.length; i++) {
			const inner = rewriteOnce(n.xs[i], notation, sop);
			if (inner) {
				return { ...inner, n: { t: n.t, xs: n.xs.map((x, k) => (k === i ? inner.n : x)) } };
			}
		}
	}
	return ruleFor(n, notation, sop);
}

/**
 * Works an expression down to a simpler form, one law at a time.
 *
 * Reduction runs to a standstill first; only then does distribution multiply
 * things out, so a derivation never expands something it could have collapsed.
 */
export function simplifySteps(ast: Ast, notation: Notation = 'math'): Working {
	const variables = variablesOf(ast);
	const table = truthTable(ast, variables);
	const minimalText = simplify(table, notation).text;
	const empty = {
		steps: [] as Step[],
		text: format(ast, notation),
		minimalText,
		isMinimal: false,
		stoppedEarly: false,
		tooBig: false
	};
	// Beyond this the derivation is not something anyone would do by hand.
	if (size(toN(ast)) > 60) return { ...empty, tooBig: true };

	const steps: Step[] = [];
	let current = norm(toN(ast));
	let stoppedEarly = false;

	// Two passes: reduce as far as the laws go, then allow distribution and
	// reduce again on what that produced.
	for (const sop of [false, true]) {
		for (;;) {
			if (steps.length >= MAX_STEPS) {
				stoppedEarly = true;
				break;
			}
			const move = rewriteOnce(current, notation, sop);
			if (!move) break;
			const next = norm(move.n);
			// Associativity alone is not progress, and would loop forever.
			if (key(next) === key(current)) break;
			current = next;
			// Ungrouping a group of one is bookkeeping, not a law worth showing.
			if (!move.law) continue;
			steps.push({ law: move.law, detail: move.detail, text: fmt(current, notation) });
		}
		if (stoppedEarly) break;
	}

	let text = fmt(current, notation);
	// Compared structurally, so a different order of the same terms still counts
	// as having reached the minimal answer.
	let isMinimal = false;
	try {
		isMinimal = key(current) === key(toN(parseExpression(minimalText)));
	} catch {
		isMinimal = false;
	}
	// When the laws land on the same expression the minimiser did, show it in the
	// minimiser's term order. Reordering a commutative group is not a step this
	// module ever shows, so ending the working on a different arrangement of the
	// same answer would read as a disagreement where there is none.
	if (isMinimal && text !== minimalText) {
		text = minimalText;
		if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], text: minimalText };
	}

	return {
		steps,
		text,
		minimalText,
		isMinimal,
		stoppedEarly,
		tooBig: false
	};
}
