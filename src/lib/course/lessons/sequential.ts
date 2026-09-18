// Stage 7: counting and state machines. Every sequence, waveform, transition
// and count a question asserts is computed with the same libraries as the
// reference pages, never typed in.

import { assemble, bin, int, pick } from '../random.js';
import type { CourseQuestion, Random, StageMeta } from '../types.js';
import { bitsOf, countSequence, counterWaveforms, registerKinds, shiftRegisterStages } from '../../sequential.js';
import { fsms, walkTable } from '../../fsm.js';
import { fromGray, toGray } from '../../boolean.js';
import type { Level } from '../../timing.js';

/** The smallest number of bits that gives n things distinct codes. */
const bitsFor = (n: number) => {
	let b = 0;
	while (1 << b < n) b++;
	return b;
};

const popcount = (value: number) => value.toString(2).split('1').length - 1;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// --- registers and shift registers ------------------------------------------

/**
 * What a shift register holds after `input` has been clocked in, written
 * Q(width-1) first. Stage k holds the input from k+1 clocks ago; the generator
 * gives one column per cycle, so the cycle after the last clock is found by
 * appending a bit that is waiting at the input but not yet clocked in.
 */
function contentsAfter(input: Level[], width: number): string {
	const traces = shiftRegisterStages([...input, 0], width);
	return traces
		.map((trace) => trace.bits[input.length])
		.reverse()
		.join('');
}

const registerAfterClocks = (random: Random): CourseQuestion => {
	const width = 4;
	const k = int(random, 2, 4);
	const input: Level[] = Array.from({ length: k }, () => (random() < 0.5 ? 0 : 1));
	if (input.every((bit) => bit === 0)) input[int(random, 0, k - 1)] = 1;
	const right = contentsAfter(input, width);
	const stages = right.split('').reverse();
	const distractors = [
		[...stages].reverse().join(''),
		contentsAfter(input.slice(0, -1), width),
		input.join('').padStart(width, '0'),
		input.join('').padEnd(width, '0'),
		contentsAfter([...input, 0], width),
		bin(~parseInt(right, 2) & ((1 << width) - 1), width)
	];
	const { options, answer } = assemble(random, right, distractors);
	const list = input.join(', ');
	return {
		prompt: `A four bit shift register starts holding 0000. Data goes in at Q0 and moves towards Q3 on every clock edge. The input is ${list} on ${k} successive clocks, first bit first. What does the register hold after those ${k} clocks, written Q3 Q2 Q1 Q0?`,
		detail: `in: ${list}`,
		options,
		answer,
		hints: [
			'Every clock edge moves each bit one stage along and the input bit lands in Q0. The bit that went in first has moved furthest.',
			`The last bit in, ${
				input[k - 1]
			}, is in Q0. The one before it is in Q1, and so on. Any stage the data has not reached is still 0.`
		],
		explanation: `After ${k} clocks: ${stages
			.map((bit, i) => `Q${i} = ${bit}`)
			.join(', ')}. Written Q3 first, that is ${right}.`
	};
};

const shiftLeft = (random: Random): CourseQuestion => {
	const width = 4;
	const value = int(random, 1, 7);
	// Loading the value is clocking its bits in top bit first; shifting left is
	// one more clock with a 0 at the input.
	const loaded = bitsOf(value, width).reverse();
	const right = contentsAfter([...loaded, 0], width);
	const doubled = parseInt(right, 2);
	const distractors = [bin(value >> 1, width), bin(value + 1, width), bin(value * 2 + 1, width), bin(value, width)];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `A ${width} bit register holds ${bin(
			value,
			width
		)}, which is ${value}. Every bit is shifted one place to the left and a 0 comes in on the right. What does it hold now?`,
		detail: bin(value, width),
		options,
		answer,
		hints: [
			'Shifting left moves every bit into the column with double the weight, so the number doubles.',
			`${value} doubled is ${doubled}. Write ${doubled} in ${width} bits.`
		],
		explanation: `Each bit moves to the column of twice the weight and a 0 fills the ones column, so the value doubles: ${value} × 2 = ${doubled}, which is ${right}.`
	};
};

const whichKind = (random: Random): CourseQuestion => {
	const kind = pick(random, registerKinds);
	const name = (k: typeof registerKinds[number]) => `${k.name} (${k.slug.toUpperCase()})`;
	const { options, answer } = assemble(random, name(kind), registerKinds.filter((k) => k !== kind).map(name));
	const way = (text: string) => (text.startsWith('one') ? 'serial' : 'parallel');
	return {
		prompt: `Which kind of shift register takes its data in ${kind.inputs} and gives it out ${kind.outputs}?`,
		options,
		answer,
		hints: [
			'The name is just the two answers written down: how the data goes in, then how it comes out. Serial means one bit per clock; parallel means all the stages at once.',
			`In ${kind.inputs}: that is ${way(kind.inputs)} in. Out ${kind.outputs}: that is ${way(kind.outputs)} out.`
		],
		explanation: `${kind.name}: in ${kind.inputs}, out ${kind.outputs}. ${kind.use}`
	};
};

const registerSize = (random: Random): CourseQuestion => {
	const n = pick(random, [3, 4, 5, 6, 8, 12, 16]);
	const { options, answer } = assemble(random, String(n), [String(n - 1), String(n + 1), String(2 ** n)]);
	return {
		prompt: `How many D flip-flops does a ${n} bit register need?`,
		options,
		answer,
		hints: [
			'A register is one D flip-flop per bit, all sharing the same clock.',
			`${n} bits means ${n} flip-flops. The 2^${n} different values it can hold are a count of patterns, not of flip-flops.`
		],
		explanation: `One flip-flop holds one bit, so a ${n} bit register is ${n} D flip-flops on a shared clock. It can hold 2^${n} = ${
			2 ** n
		} different values, but that is the number of patterns, not the number of flip-flops.`
	};
};

// --- counters ---------------------------------------------------------------

const countAfter = (random: Random): CourseQuestion => {
	const modulus = pick(random, [16, 10, 8, 12, 6, 5]);
	const k = int(random, 1, 2 * modulus + 3);
	const sequence = countSequence(4, k + 1, modulus);
	const right = sequence[k];
	const laps = Math.floor(k / modulus);
	const left = k % modulus;
	const distractors = [k, (right + 1) % modulus, (right + modulus - 1) % modulus, modulus].map(String);
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `A mod-${modulus} counter counts 0 up to ${
			modulus - 1
		} and then goes back to 0. It starts at 0. What does it show after ${plural(k, 'clock edge')}?`,
		options,
		answer,
		hints: [
			`Every edge adds one, and after ${
				modulus - 1
			} the next edge gives 0 again, so the count goes round in a loop of ${modulus}.`,
			laps === 0
				? `${plural(k, 'edge')} is less than one lap of ${modulus}, so just count up from 0.`
				: `${plural(k, 'edge')} is ${plural(laps, 'full lap')} of ${modulus} with ${left} left over.`
		],
		explanation: `The sequence is ${sequence.slice(0, Math.min(sequence.length, modulus + 1)).join(', ')}${
			sequence.length > modulus + 1 ? ', …' : ''
		} and repeats every ${modulus}. ${k} = ${laps} × ${modulus} + ${left}, so after ${plural(
			k,
			'edge'
		)} the counter shows ${right}.`
	};
};

const counterSize = (random: Random): CourseQuestion => {
	const modulus = pick(random, [5, 6, 10, 12, 16, 24, 60, 100]);
	const right = bitsFor(modulus);
	const exact = 1 << right === modulus;
	const distractors = [modulus, right - 1, right + 1].filter((d) => d > 0).map(String);
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `How many flip-flops does a mod-${modulus} counter need, one that counts 0 to ${
			modulus - 1
		} and then starts again?`,
		options,
		answer,
		hints: [
			'Each flip-flop holds one bit, and n bits can show 2^n different counts. You need enough bits for every count you want to show.',
			`Find the smallest power of two that is at least ${modulus}: that is ${1 << right} = 2^${right}.`
		],
		explanation: `${right - 1} flip-flops give only ${
			1 << (right - 1)
		} states, not enough for ${modulus}. ${right} give ${1 << right}, which is enough. ${
			exact
				? `${modulus} is a power of two, so the counter wraps on its own with no extra logic.`
				: `The counter then needs a gate that clears it when it reaches ${modulus}, so it never shows the ${
						(1 << right) - modulus
				  } spare states.`
		}`
	};
};

const bitRate = (random: Random): CourseQuestion => {
	const width = 4;
	const k = int(random, 1, 3);
	const traces = counterWaveforms(width, 1 << (width + 1));
	const trace = traces.find((t) => t.name === `Q${k}`) ?? traces[0];
	const changes = trace.bits.map((bit, i) => (i > 0 && bit !== trace.bits[i - 1] ? i : -1)).filter((i) => i >= 0);
	const every = changes[1] - changes[0];
	const text = (n: number) => (n === 1 ? 'on every clock edge' : `once every ${n} clock edges`);
	const { options, answer } = assemble(random, text(every), [
		text(1),
		text(every / 2),
		text(every * 2),
		text(every * 4)
	]);
	return {
		prompt: `In a binary counter, Q0 toggles on every clock edge. How often does Q${k} toggle?`,
		options,
		answer,
		hints: [
			'A bit toggles only when every bit below it is 1, which happens half as often as the bit below it toggles.',
			`Q0 toggles every edge, Q1 every 2nd edge, and each step up doubles the gap. Q${k} is ${k} ${
				k === 1 ? 'step' : 'steps'
			} up from Q0.`
		],
		explanation: `The gap doubles at each bit: Q0 every edge, Q1 every 2, Q2 every 4, Q3 every 8. Q${k} toggles ${text(
			every
		)}, so it runs at 1/${every} of the rate of Q0 and a full cycle of it, high then low, takes ${
			every * 2
		} clock cycles.`
	};
};

const afterWrap = (random: Random): CourseQuestion => {
	const modulus = pick(random, [6, 8, 10, 12, 16]);
	const j = int(random, 1, 3);
	const top = modulus - 1;
	const sequence = countSequence(4, top + j + 1, modulus);
	const right = sequence[top + j];
	const path = sequence.slice(top + 1, top + j + 1);
	const distractors = [top + j, modulus, j, right + 1].map(String);
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `A mod-${modulus} counter is showing ${top}, its highest count. What does it show ${
			j === 1 ? 'after the next clock edge' : `after ${j} more clock edges`
		}?`,
		options,
		answer,
		hints: [
			`After ${top} the counter cannot go higher, so the next edge takes it back to 0, and counting carries on from there.`,
			`Count on from ${top} for ${plural(j, 'edge')}: ${top}, then 0, then 1, and so on.`
		],
		explanation: `${top} is the last state, so the next edge wraps to 0. The ${plural(j, 'edge')} after ${top} give${
			j === 1 ? 's' : ''
		} ${path.join(', ')}. The counter shows ${right}.`
	};
};

// --- gray code ---------------------------------------------------------------

const grayOf = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const value = int(random, 1, 2 ** n - 1);
	const gray = toGray(value);
	const right = bin(gray, n);
	const distractors = [
		bin(value, n),
		bin(fromGray(value), n),
		bin(gray ^ 1, n),
		bin(gray ^ (1 << (n - 1)), n),
		// Kept to n bits, or the all-ones value would offer a pattern one bit too wide.
		bin((value + 1) & ((1 << n) - 1), n)
	];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `What is ${value}, binary ${bin(value, n)}, in Gray code?`,
		detail: bin(value, n),
		options,
		answer,
		hints: [
			'Copy the top bit. Then each Gray bit is the XOR of the binary bit in that position with the binary bit to its left.',
			`Write ${bin(value, n)} over itself shifted one place right, ${bin(value >> 1, n)}, and XOR column by column.`
		],
		explanation: `${bin(value, n)} XOR ${bin(value >> 1, n)}, the same bits shifted right by one, is ${right}.`
	};
};

const grayStep = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const i = int(random, 0, 2 ** n - 2);
	const a = toGray(i);
	const b = toGray(i + 1);
	const diff = a ^ b;
	const position = Array.from({ length: n }, (_, k) => k).find((k) => 1 << k === diff) ?? 0;
	const text = (k: number) => `bit ${k}${k === 0 ? ' (the rightmost)' : k === n - 1 ? ' (the leftmost)' : ''}`;
	const { options, answer } = assemble(
		random,
		text(position),
		Array.from({ length: n }, (_, k) => k)
			.filter((k) => k !== position)
			.map(text)
	);
	return {
		prompt: `Counting in ${n} bit Gray code, ${i} is ${bin(a, n)} and ${i + 1} is ${bin(
			b,
			n
		)}. Which bit changes between them?`,
		detail: `${bin(a, n)} → ${bin(b, n)}`,
		options,
		answer,
		hints: [
			'Exactly one bit changes on every step of a Gray code. Compare the two patterns column by column.',
			`Bit 0 is the rightmost column. ${bin(a, n)} and ${bin(
				b,
				n
			)} differ in only one column; count in from the right to name it.`
		],
		explanation: `${bin(a, n)} XOR ${bin(b, n)} = ${bin(
			diff,
			n
		)}: a single 1, at bit ${position}, so that is the only bit that changed.`
	};
};

const binaryFromGray = (random: Random): CourseQuestion => {
	const n = int(random, 3, 4);
	const gray = int(random, 1, 2 ** n - 1);
	const value = fromGray(gray);
	const right = bin(value, n);
	const distractors = [
		bin(gray, n),
		bin(toGray(gray), n),
		bin(value ^ 1, n),
		bin(value ^ 2, n),
		bin(value ^ (1 << (n - 1)), n)
	];
	const { options, answer } = assemble(random, right, distractors);
	const g = bin(gray, n).split('');
	const b = right.split('');
	const steps = b.map((bit, i) => (i === 0 ? `the top bit ${bit} is copied` : `${g[i]} XOR ${b[i - 1]} = ${bit}`));
	return {
		prompt: `The Gray code ${bin(gray, n)} stands for which binary number?`,
		detail: bin(gray, n),
		options,
		answer,
		hints: [
			'Copy the top bit. Then, working left to right, each binary bit is the XOR of the Gray bit in that position with the binary bit you have just written.',
			`Start with the top bit, ${b[0]}. The next binary bit is ${g[1]} XOR ${b[0]}, and so on down the pattern.`
		],
		explanation: `Working from the left: ${steps.join('; ')}. That gives ${right}, which is ${value}.`
	};
};

const binaryStep = (random: Random): CourseQuestion => {
	const n = int(random, 4, 5);
	const v = int(random, 0, 2 ** n - 2);
	const diff = v ^ (v + 1);
	const right = popcount(diff);
	const { options, answer } = assemble(
		random,
		String(right),
		Array.from({ length: n }, (_, k) => k + 1)
			.filter((k) => k !== right)
			.map(String)
	);
	const trailing = right - 1;
	return {
		prompt: `Counting in plain binary with ${n} bits, how many bits change when ${v} (${bin(v, n)}) becomes ${
			v + 1
		} (${bin(v + 1, n)})?`,
		detail: `${bin(v, n)} → ${bin(v + 1, n)}`,
		options,
		answer,
		hints: [
			'Compare the two patterns column by column and count the columns that differ. Adding one flips every 1 at the right end to 0, and the first 0 to its left to 1.',
			trailing === 0
				? `${bin(v, n)} ends in a 0, so only that last bit flips.`
				: `${bin(v, n)} ends in ${plural(trailing, 'one')}; ${
						trailing === 1 ? 'it flips' : 'they all flip'
				  }, and so does the 0 just before ${trailing === 1 ? 'it' : 'them'}.`
		],
		explanation: `${bin(v, n)} XOR ${bin(v + 1, n)} = ${bin(diff, n)}, which has ${
			right === 1 ? 'a single 1' : `${right} 1s`
		}, so ${plural(right, 'bit changes', 'bits change')}. In Gray code the same step would change exactly one.`
	};
};

// --- state machines ------------------------------------------------------------

const detector = fsms.find((f) => f.slug === 'moore-101') ?? fsms[0];
const stateById = (id: string) => detector.states.find((s) => s.id === id) ?? detector.states[0];

/** The shortest input that walks the detector from its start into each state. */
const prefixes = new Map<string, string>();
for (const candidate of ['', '1', '10', '101']) {
	const steps = walkTable(detector, candidate);
	const end = steps.length ? steps[steps.length - 1].next : detector.states[0].id;
	if (!prefixes.has(end)) prefixes.set(end, candidate);
}
const prefixFor = (id: string) => prefixes.get(id) ?? '';

const nextState = (random: Random): CourseQuestion => {
	const from = pick(random, detector.states);
	const input = pick(random, ['0', '1'] as const);
	const steps = walkTable(detector, prefixFor(from.id) + input);
	const to = stateById(steps[steps.length - 1].next);
	const text = (s: typeof from) => `${s.id} (${s.meaning})`;
	const { options, answer } = assemble(random, text(to), detector.states.filter((s) => s !== to).map(text));
	return {
		prompt: `The 101 detector is in ${from.id}, meaning it has ${from.meaning}. The next input bit is ${input}. Which state does it go to?`,
		options,
		answer,
		hints: [
			'Each state remembers how much of the pattern 1, 0, 1 has been seen so far. Ask how much of the pattern the most recent bits make up once this bit is added.',
			`Having ${from.meaning}, a ${input} arrives. The longest tail of the recent input that is the start of 1, 0, 1 is now: ${to.meaning}.`
		],
		explanation: `From ${from.id} (${from.meaning}), an input of ${input} leads to ${to.id} (${to.meaning}). The machine keeps only as much of the recent input as could still be part of a 1, 0, 1.`
	};
};

const runDetector = (random: Random): CourseQuestion => {
	const length = int(random, 3, 6);
	let bits = '';
	for (let i = 0; i < length; i++) bits += random() < 0.5 ? '0' : '1';
	const steps = walkTable(detector, bits);
	const last = steps[steps.length - 1];
	const end = stateById(last.next);
	const text = (s: typeof end) => `${s.id}, output ${s.output}`;
	const { options, answer } = assemble(random, text(end), detector.states.filter((s) => s !== end).map(text));
	return {
		prompt: `Starting in S0, the 101 detector is fed the bits ${bits
			.split('')
			.join(', ')}, one per clock edge. Which state is it in afterwards, and what is its output there?`,
		detail: bits,
		options,
		answer,
		hints: [
			'Follow the table one bit at a time: from the current state, take the arrow for that bit. The output belongs to the state you end in, and only S3 (seen 101) has output 1.',
			`After ${bits.slice(0, -1).split('').join(', ')} the machine is in ${
				last.state
			}. Now take the arrow for the last bit, ${last.input}.`
		],
		explanation: `Step by step: ${steps
			.map((s) => `${s.state} on ${s.input} goes to ${s.next}`)
			.join('; ')}. It ends in ${end.id} (${end.meaning}), whose output is ${end.output}.`
	};
};

const mooreOrMealy = (random: Random): CourseQuestion => {
	const asks: { text: string; right: 'Moore' | 'Mealy' }[] = [
		{
			text: 'Its output depends only on which state it is in, so the output changes only when the state does, on a clock edge.',
			right: 'Moore'
		},
		{
			text: 'Its output depends on its state and on the current input, so the output can change as soon as the input does.',
			right: 'Mealy'
		},
		{
			text: 'A traffic light controller: which lamps are lit depends only on the state the controller is in.',
			right: 'Moore'
		},
		{
			text: 'A detector that raises its output on the very transition that completes the pattern, in the same cycle as the last input bit.',
			right: 'Mealy'
		},
		{ text: 'Its state diagram has the outputs written inside the state circles.', right: 'Moore' },
		{ text: 'Its state diagram has the outputs written on the arrows, as input/output.', right: 'Mealy' }
	];
	const ask = pick(random, asks);
	const other = ask.right === 'Moore' ? 'Mealy' : 'Moore';
	const { options, answer } = assemble(random, ask.right, [other, 'neither: it is combinational logic', 'a latch']);
	return {
		prompt: `What kind of machine is this? ${ask.text}`,
		options,
		answer,
		hints: [
			'Ask where the output comes from: from the state alone, or from the state and the input together.',
			ask.right === 'Moore'
				? 'Here the input plays no part in the output; only the state does. Outputs in the circles.'
				: 'Here the input matters to the output, not just the state. Outputs on the arrows.'
		],
		explanation: `${
			ask.right === 'Moore'
				? 'The output is a function of the state alone, which is the Moore kind: outputs sit inside the state circles and change only on a clock edge.'
				: 'The output is a function of the state and the input together, which is the Mealy kind: outputs sit on the arrows and can change as soon as the input does.'
		} Both are state machines; a latch and plain combinational logic are not.`
	};
};

const howManyStates = (random: Random): CourseQuestion => {
	const tasks = [
		{ text: 'a turnstile that is either locked or unlocked', list: 'locked, unlocked', n: 2 },
		{
			text: 'a traffic light that cycles red, red and amber, green, amber',
			list: 'red, red and amber, green, amber',
			n: 4
		},
		{ text: 'a counter that counts 0, 1, 2, 3, 4, 5 and then repeats', list: '0, 1, 2, 3, 4, 5', n: 6 },
		{ text: 'a lamp that one button turns on and off', list: 'off, on', n: 2 },
		{
			text: 'a pedestrian crossing that shows walk, then flashing, then do not walk',
			list: 'walk, flashing, do not walk',
			n: 3
		},
		{ text: 'a controller that remembers which of four floors a lift is on', list: 'floor 1, 2, 3, 4', n: 4 },
		{ text: 'a machine that remembers the last two bits it received', list: '00, 01, 10, 11', n: 4 },
		{ text: 'a mod-8 counter', list: '0 to 7', n: 8 }
	];
	const task = pick(random, tasks);
	const n = task.n;
	const distractors = [n - 1, n + 1, 2 * n].filter((d) => d > 0 && d !== n).map(String);
	const { options, answer } = assemble(random, String(n), distractors);
	return {
		prompt: `How many states does a state machine need for ${task.text}?`,
		options,
		answer,
		hints: [
			'Count the different situations the machine has to tell apart. Each one is a state.',
			`List them: ${task.list}.`
		],
		explanation: `The situations to tell apart are ${task.list}: ${n} of them, so ${n} states. Anything the machine does not need to remember is not a state.`
	};
};

// --- designing a state machine ---------------------------------------------------

const flipFlopsForStates = (random: Random): CourseQuestion => {
	const n = int(random, 3, 20);
	const right = bitsFor(n);
	const spare = (1 << right) - n;
	const distractors = [n, right - 1, right + 1].filter((d) => d > 0).map(String);
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `A state machine has ${n} states. How many flip-flops does it need to hold the state?`,
		options,
		answer,
		hints: [
			'Each flip-flop holds one bit, and b bits give 2^b different codes. You need at least as many codes as states.',
			`Powers of two: 2, 4, 8, 16, 32. Find the first one that is at least ${n}.`
		],
		explanation: `${right - 1} bits give ${1 << (right - 1)} codes, too few for ${n} states. ${right} bits give ${
			1 << right
		}, which is enough, so ${right} flip-flops${
			spare ? `, with ${plural(spare, 'code')} left unused` : ' with no code to spare'
		}.`
	};
};

const rowBits = (random: Random): CourseQuestion => {
	const from = pick(random, detector.states);
	const input = pick(random, ['0', '1'] as const);
	const steps = walkTable(detector, prefixFor(from.id) + input);
	const to = stateById(steps[steps.length - 1].next);
	const { options, answer } = assemble(
		random,
		to.code,
		detector.states.filter((s) => s !== to).map((s) => s.code)
	);
	return {
		prompt: `The 101 detector uses the codes shown. The row of its state table for present state ${from.id} with x = ${input} has next state ${to.id}. With D flip-flops, what must d1 d0 be for that row, d1 first?`,
		detail: detector.states.map((s) => `${s.id} = ${s.code}`).join(', '),
		options,
		answer,
		hints: [
			'A D flip-flop copies whatever is on D at the clock edge into Q. So the D inputs are simply the code of the state the machine goes to next.',
			`The next state is ${to.id}. Look up its code in the list.`
		],
		explanation: `The next state is ${to.id}, whose code is ${to.code}, so d1 = ${to.code[0]} and d0 = ${to.code[1]}. With D flip-flops the next-state code is the D input pattern, nothing to translate.`
	};
};

const simplestFlipFlop = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt:
				"Which flip-flop type makes the input equation for each state bit simply that bit's next-state column, straight from the table?",
			right: 'D',
			why: 'a D flip-flop copies its input on the clock edge, so D is the next value of Q and the next-state column is the equation.'
		},
		{
			prompt:
				'For a counter, where what matters is whether each bit changes on the next edge, which flip-flop type gives the simplest input equations?',
			right: 'T',
			why: 'a T flip-flop toggles when T is 1, so T is simply "does this bit change", which is exactly the question a counter asks.'
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ['D', 'T', 'JK', 'SR']);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'Think about what each type does on a clock edge: D copies its input, T toggles when its input is 1, JK and SR set and reset.',
			ask.right === 'D'
				? 'If D equals the next Q, the equation is the next-state column with nothing to translate.'
				: 'If T is 1 exactly when the bit changes, the equation is just the toggle rule.'
		],
		explanation: `${ask.right}: ${ask.why}`
	};
};

const tableRows = (random: Random): CourseQuestion => {
	const n = int(random, 3, 8);
	const right = 2 * n;
	const distractors = [n, n * n, 2 ** n, n + 2].filter((d) => d !== right).map(String);
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `A state machine has ${n} states and one input bit. How many rows does its state table have?`,
		options,
		answer,
		hints: [
			'The table has one row for every combination of present state and input value.',
			`${n} states, and for each of them the input can be 0 or 1: ${n} × 2.`
		],
		explanation: `Each of the ${n} states appears once with x = 0 and once with x = 1, so ${n} × 2 = ${right} rows.`
	};
};

export const sequential: StageMeta = {
	id: 'sequential',
	title: 'Counting and state machines',
	tagline: 'Flip-flops in a row become registers, counters and controllers.',
	lessons: [
		{
			slug: 'registers-and-shift-registers',
			title: 'Registers and shift registers',
			blurb: 'Line up D flip-flops on one clock and you can hold a whole number, or slide it along one bit at a time.',
			description:
				'What a register is, how a shift register moves its bits along on every clock, the four serial and parallel kinds, and why shifting left doubles a number.',
			minutes: 14,
			generators: [registerAfterClocks, shiftLeft, whichKind, registerSize],
			deeper: [
				{ href: '/shift-registers', label: 'Shift registers' },
				{ href: '/flip-flops/d', label: 'The D flip-flop' }
			]
		},
		{
			slug: 'counters',
			title: 'Counters',
			blurb: 'Chain toggling flip-flops and their outputs count in binary all by themselves.',
			description:
				'How a binary counter works from toggling flip-flops: ripple and synchronous counters, why each bit runs at half the rate, modulus, and counting to ten.',
			minutes: 15,
			generators: [countAfter, counterSize, bitRate, afterWrap],
			deeper: [
				{ href: '/counters', label: 'Counters' },
				{ href: '/flip-flops/t', label: 'The T flip-flop' }
			]
		},
		{
			slug: 'gray-code',
			title: 'Gray code',
			blurb: 'A way of counting where only one bit changes at a time, and why that avoids a nasty glitch.',
			description:
				'Gray code explained: why changing one bit per step matters, how to build the sequence, converting binary to Gray and back with XOR, and where you met it.',
			minutes: 12,
			generators: [grayOf, grayStep, binaryFromGray, binaryStep],
			deeper: [
				{ href: '/gray-code-converter', label: 'Gray code converter' },
				{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' }
			]
		},
		{
			slug: 'state-machines',
			title: 'State machines',
			blurb: 'A set of states, a rule for moving between them, and outputs: the pattern behind every controller.',
			description:
				'What a finite state machine is: states, transitions and outputs, the state diagram and state table, Moore versus Mealy, and a 101 detector to step through.',
			minutes: 15,
			generators: [nextState, runDetector, mooreOrMealy, howManyStates],
			deeper: [
				{ href: '/finite-state-machines', label: 'Finite state machines' },
				{ href: '/finite-state-machines#moore-vs-mealy', label: 'Moore vs Mealy' }
			]
		},
		{
			slug: 'designing-a-state-machine',
			title: 'Designing a state machine',
			blurb: 'From a state diagram to gates and flip-flops, the same way every time.',
			description:
				'The state machine design procedure worked on a 101 detector: state table, binary codes, next-state equations from Karnaugh maps, D flip-flops and the circuit.',
			minutes: 16,
			generators: [flipFlopsForStates, rowBits, simplestFlipFlop, tableRows],
			deeper: [
				{ href: '/finite-state-machines', label: 'Finite state machines' },
				{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
				{ href: '/flip-flops/d', label: 'The D flip-flop' }
			]
		}
	]
};
