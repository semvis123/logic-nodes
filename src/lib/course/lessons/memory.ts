// Stage 6: memory. Feedback, the SR latch, clocks and edges, and the four
// flip-flops. Every answer that depends on a circuit's behaviour is computed
// from $lib/latches, $lib/flipflops and $lib/timing, the same data the
// reference pages are drawn from.

import { evaluate, parseExpression } from '../../boolean.js';
import { flipFlops, flipFlopBySlug } from '../../flipflops.js';
import { latchBySlug } from '../../latches.js';
import { pattern, timingAlt, timingToSvg } from '../../timing.js';
import { assemble, int, pick, shuffle } from '../random.js';
import type { CourseQuestion, Random, StageMeta } from '../types.js';

const bit = (on: boolean) => (on ? 1 : 0);

// ---------------------------------------------------------------------------
// Lesson 1: circuits with memory

const combinationalCircuits = [
	'an AND gate',
	'an XOR gate',
	'a half adder',
	'a full adder',
	'a four bit ripple carry adder',
	'a multiplexer, which passes one of its data inputs through depending on a select input',
	'a seven-segment decoder, which turns four bits into the bars of a digit',
	'a chain of twenty gates with no wire leading backwards',
	'a NOT gate feeding an OR gate feeding an AND gate'
];

const sequentialCircuits = [
	'an SR latch',
	'an OR gate with its output wired back into one of its inputs',
	'a circuit that shows how many times a button has been pressed',
	'two NOR gates, the output of each wired into an input of the other',
	'a circuit whose output stays at 1 after the input that caused it has gone back to 0',
	'a traffic light controller that has to know which colour it showed last'
];

const combinationalOrSequential = (random: Random): CourseQuestion => {
	const sequential = random() < 0.5;
	const circuit = pick(random, sequential ? sequentialCircuits : combinationalCircuits);
	const right = sequential ? 'sequential, because it has feedback' : 'combinational, because it has no feedback';
	const wrong = [
		sequential ? 'combinational, because it has feedback' : 'sequential, because it has feedback',
		sequential ? 'sequential, because it has no feedback' : 'combinational, because it has feedback',
		sequential ? 'combinational, because it has no feedback' : 'sequential, because it has no feedback'
	];
	const { options, answer } = assemble(random, right, wrong);
	return {
		prompt: `Is this circuit combinational or sequential? ${circuit[0].toUpperCase()}${circuit.slice(1)}.`,
		options,
		answer,
		hints: [
			'A circuit is sequential when it has state: an output fed back to an input, so that what happened before changes the output. With no loop it is combinational, however many gates it has.',
			sequential
				? `Ask whether ${circuit} needs to remember anything. If the same inputs can give a different output later, something is being fed back.`
				: `Ask whether ${circuit} needs to remember anything. Signals only flow forwards through it, so the same inputs always give the same output.`
		],
		explanation: sequential
			? `${circuit[0].toUpperCase()}${circuit.slice(
					1
			  )} has to remember something, and the only way gates can remember is feedback: an output routed back to an input. That makes it sequential.`
			: `${circuit[0].toUpperCase()}${circuit.slice(
					1
			  )} has no wire leading from an output back to an input, so its output is fixed by its inputs now. That makes it combinational, and a truth table describes it completely.`
	};
};

const whatIsState = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'In a sequential circuit, what does the word "state" mean?',
			right: 'what the circuit is remembering at this moment',
			wrong: [
				'whether its inputs are 1 or 0 right now',
				'the number of gates it is built from',
				'the voltage of its power supply'
			]
		},
		{
			prompt: 'What makes a circuit sequential rather than combinational?',
			right: 'an output fed back to an input',
			wrong: ['having more than ten gates', 'using NOR gates instead of AND gates', 'having more inputs than outputs']
		},
		{
			prompt: 'Which of these can a combinational circuit never do?',
			right: 'give different outputs for the same inputs at different times',
			wrong: ['have more than two inputs', 'use a NOT gate', 'have several outputs']
		},
		{
			prompt: 'Why can a truth table not describe a circuit with memory?',
			right: 'the same inputs can give different outputs, depending on what happened before',
			wrong: [
				'a truth table can only have two inputs',
				'memory circuits have no output',
				'truth tables cannot contain a 0'
			]
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A combinational circuit answers only about its inputs now. A sequential one has state, a value it holds because an output is fed back to an input.',
			'Look for the option that is about history, about what happened before, rather than about size, voltage or the inputs right now.'
		],
		explanation:
			'State is the value a circuit holds after the input that caused it has gone. Only feedback, an output routed back to an input, can create it, and once a circuit has state the same inputs can give different outputs at different times, which is why no truth table can describe it.'
	};
};

const orLoop = (random: Random): CourseQuestion => {
	// A short history for the set input; the loop's output is the OR of set
	// with its own previous output, so it goes to 1 at the first 1 and stays.
	const length = int(random, 3, 5);
	const sets = Array.from({ length }, () => random() < 0.4);
	if (int(random, 0, 3) === 0) sets.fill(false);
	let out = false;
	const trace = sets.map((set) => {
		const back = out;
		out = set || back;
		return `${bit(set)} OR ${bit(back)} = ${bit(out)}`;
	});
	const right = String(bit(out));
	const { options, answer } = assemble(random, right, [
		String(1 - bit(out)),
		'it flickers between 0 and 1',
		'it cannot be known'
	]);
	const shown = sets.map(bit).join(', ');
	return {
		prompt: `An OR gate has its output wired back into one of its inputs, and the output starts at 0. Over ${length} moments the set input is ${shown}. What is the output at the end?`,
		detail: `set: ${shown}`,
		options,
		answer,
		hints: [
			'At each moment the output is set OR the previous output. Once the output has been 1, the fed-back input is 1, and an OR with any input at 1 outputs 1.',
			`Moment by moment: ${trace.slice(0, -1).join(', then ')}. One more to go.`
		],
		explanation: `Working through the moments: ${trace.join('; ')}. ${
			out
				? 'Once a 1 went round the loop nothing could clear it, so the output ends at 1.'
				: 'Set was never 1, so nothing ever entered the loop and the output stays 0.'
		}`
	};
};

const whichIsSequential = (random: Random): CourseQuestion => {
	const wantSequential = random() < 0.5;
	const one = pick(random, wantSequential ? sequentialCircuits : combinationalCircuits);
	const others = shuffle(random, wantSequential ? combinationalCircuits : sequentialCircuits).slice(0, 3);
	const { options, answer } = assemble(random, one, others);
	return {
		prompt: wantSequential ? 'Which of these circuits is sequential?' : 'Which of these circuits is combinational?',
		options,
		answer,
		hints: [
			'Sequential means it has state: somewhere an output is fed back to an input, so it can remember. Combinational means no loop: the output is fixed by the inputs now.',
			wantSequential
				? 'Three of the options only ever pass signals forwards. Find the one that has to remember something.'
				: 'Three of the options have to remember something. Find the one whose output depends only on its inputs now.'
		],
		explanation: wantSequential
			? `${one[0].toUpperCase()}${one.slice(
					1
			  )} has state, so it is sequential. The others have no feedback: their outputs depend only on their inputs now, so they are combinational.`
			: `${one[0].toUpperCase()}${one.slice(
					1
			  )} has no feedback, so it is combinational. The others each have to remember something, which needs an output fed back to an input, so they are sequential.`
	};
};

// ---------------------------------------------------------------------------
// Lesson 2: the SR latch

const norLatch = latchBySlug('nor')!;
const nandLatch = latchBySlug('nand')!;
const norEquation = parseExpression(norLatch.equation);

const latchAfterSequence = (random: Random): CourseQuestion => {
	// Legal (S, R) pairs only; the forbidden pair has its own question.
	const legal = [
		[false, false],
		[true, false],
		[false, true]
	];
	const length = int(random, 3, 5);
	const steps = Array.from({ length }, () => pick(random, legal));
	// Make sure something actually happens, or the question is dull.
	if (steps.every(([s, r]) => !s && !r)) steps[0] = [true, false];
	let q = false;
	const trace = steps.map(([s, r]) => {
		q = evaluate(norEquation, { s, r, q });
		const note = s ? 'set' : r ? 'reset' : 'hold';
		return { s, r, q, note };
	});
	const right = String(bit(q));
	const { options, answer } = assemble(random, right, [String(1 - bit(q)), 'both outputs are 0', 'it cannot be known']);
	const shown = steps.map(([s, r]) => `S=${bit(s)} R=${bit(r)}`).join(', then ');
	const line = (t: { s: boolean; r: boolean; q: boolean; note: string }) =>
		`S=${bit(t.s)} R=${bit(t.r)} ${t.note}s, so Q = ${bit(t.q)}`;
	return {
		prompt: `A NOR SR latch starts with Q = 0. Its inputs go through these steps in order: ${shown}. What is Q after the last step?`,
		detail: steps.map(([s, r]) => `${bit(s)}${bit(r)}`).join(' → '),
		options,
		answer,
		hints: [
			'Take the steps one at a time. S = 1 sets Q to 1, R = 1 resets it to 0, and S = R = 0 holds whatever Q already was.',
			`Up to the second-last step: ${trace.slice(0, -1).map(line).join('; ')}. Now apply the last step.`
		],
		explanation: `Step by step: ${trace.map(line).join('; ')}. Q ends at ${right}.`
	};
};

const forbiddenState = (random: Random): CourseQuestion => {
	const norRow = norLatch.characteristic.find((row) => row.next === 'invalid')!;
	const nandRow = nandLatch.characteristic.find((row) => row.next === 'invalid')!;
	const asks = [
		{
			prompt: `In a NOR SR latch, S and R are both ${norRow.inputs[0]}. What happens to the outputs?`,
			right: 'Q and Q̄ are both 0',
			wrong: ['Q and Q̄ are both 1', 'Q is 1 and Q̄ is 0', 'the latch holds its last value'],
			explanation:
				'A NOR outputs 0 whenever either input is 1. With S and R both 1, each gate has a 1 on an input, so both outputs are forced to 0. Q and Q̄ are no longer opposites, which is why the input is forbidden.'
		},
		{
			prompt:
				'S and R of a NOR latch have both been 1, and are now released to 0 at the same moment. What is Q afterwards?',
			right: 'it cannot be predicted: whichever gate is faster wins',
			wrong: [
				'always 1, because set wins',
				'always 0, because reset wins',
				'it stays at whatever it was before S and R went high'
			],
			explanation:
				'With both outputs at 0, releasing both inputs gives each gate two 0s, so each wants to go to 1. Whichever gets there first forces the other back to 0. That depends on tiny differences in gate speed, so the result cannot be predicted.'
		},
		{
			prompt: 'Which input combination is forbidden on a NOR SR latch?',
			right: `S = ${norRow.inputs[0]}, R = ${norRow.inputs[1]}`,
			wrong: ['S = 0, R = 0', 'S = 1, R = 0', 'S = 0, R = 1'],
			explanation: `S = ${norRow.inputs[0]} and R = ${norRow.inputs[1]} together force both NOR outputs to 0, so Q and Q̄ stop being opposites and the state after release is unpredictable. The characteristic table marks that row as not allowed.`
		},
		{
			prompt: 'Which input combination is forbidden on a NAND SR latch, whose inputs S̄ and R̄ are active-low?',
			right: `S̄ = ${nandRow.inputs[0]}, R̄ = ${nandRow.inputs[1]}`,
			wrong: ['S̄ = 1, R̄ = 1', 'S̄ = 0, R̄ = 1', 'S̄ = 1, R̄ = 0'],
			explanation: `A NAND is forced to 1 by a 0 on either input, so in the NAND latch a 0 does the work a 1 did in the NOR latch. The forbidden case is both inputs active at once: S̄ = ${nandRow.inputs[0]} and R̄ = ${nandRow.inputs[1]}, where both outputs are forced to 1.`
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A NOR is forced to 0 by a 1 on either input, and a NAND is forced to 1 by a 0 on either input. The forbidden case is the one where both gates are forced at once.',
			'When both gates are forced, the two outputs are equal instead of opposite, and when the inputs are released the gates race. Pick the option that says so.'
		],
		explanation: ask.explanation
	};
};

const latchGates = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'What is a NOR SR latch built from?',
			right: 'two NOR gates, the output of each wired into an input of the other',
			wrong: [
				'two NOR gates in a row, one feeding the next',
				'one NOR gate and one NOT gate',
				'two XOR gates, the output of each wired into an input of the other'
			]
		},
		{
			prompt: 'How many gates does the simplest SR latch need?',
			right: '2',
			wrong: ['1', '3', '4']
		},
		{
			prompt: 'In an SR latch, where does the output of each gate go?',
			right: 'into an input of the other gate',
			wrong: ['into its own input', 'only to the outside world', 'into both inputs of the other gate']
		},
		{
			prompt: 'The same cross-coupled wiring with NAND gates instead of NOR gates gives a latch whose inputs are…',
			right: 'active-low: a 0 sets or resets, and both inputs sit at 1 when idle',
			wrong: [
				'exactly the same: a 1 sets or resets',
				'unusable: NAND gates cannot form a latch',
				'active-low: both inputs sit at 0 when idle'
			]
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			"The latch is two gates of the same kind, cross-coupled: each gate's output is one of the other gate's inputs. The two free inputs are S and R.",
			'Cross-coupled means a loop between two gates, not a chain. With NAND instead of NOR the loop is the same but a 0 does the work, so the inputs rest at 1.'
		],
		explanation:
			'An SR latch is two NOR gates with the output of each wired into an input of the other; the free inputs are S and R and the outputs are Q and Q̄. Built from NAND gates instead, the same wiring gives active-low inputs S̄ and R̄ that rest at 1 and act on a 0.'
	};
};

const latchRow = (random: Random): CourseQuestion => {
	const rows = norLatch.characteristic.filter((row) => row.next !== 'invalid');
	const row = pick(random, rows);
	const next = row.next as '0' | '1';
	const otherNotes = ['hold', 'set', 'reset'].filter((n) => n !== row.note);
	const right = `${next} (${row.note})`;
	const wrong = [
		`${next === '1' ? 0 : 1} (${row.note})`,
		`${next} (${otherNotes[0]})`,
		`${next === '1' ? 0 : 1} (${otherNotes[1]})`
	];
	const { options, answer } = assemble(random, right, wrong);
	const [s, r] = row.inputs;
	const why =
		row.note === 'hold'
			? `With S and R both 0 neither gate is forced, so the latch holds and Q stays at ${row.q}.`
			: row.note === 'set'
			? 'S = 1 forces the Q̄ gate to 0, the Q gate then sees two 0s and outputs 1: set, whatever Q was.'
			: 'R = 1 forces the Q gate to 0 directly: reset, whatever Q was.';
	return {
		prompt: `A NOR SR latch has S = ${s}, R = ${r}, and Q is currently ${row.q}. What does Q become, and what is that called?`,
		detail: `S=${s} R=${r} Q=${row.q}`,
		options,
		answer,
		hints: [
			'S = 1 sets, R = 1 resets, and both at 0 holds. Hold means Q keeps the value it already has.',
			`Here S = ${s} and R = ${r}, so the row is "${row.note}". ${
				row.note === 'hold'
					? `Q is currently ${row.q}, so it stays there.`
					: `That gives Q⁺ = ${next} no matter what Q was.`
			}`
		],
		explanation: `${why} The characteristic table row S = ${s}, R = ${r}, Q = ${row.q} gives Q⁺ = ${next}, ${row.note}.`
	};
};

// ---------------------------------------------------------------------------
// Lesson 3: clocks and edges

const countEdges = (random: Random): CourseQuestion => {
	// A random waveform, drawn by the same renderer as the reference pages, and
	// the edges counted from its bits.
	const length = int(random, 6, 9);
	let bits = '';
	let level = random() < 0.5 ? 1 : 0;
	for (let i = 0; i < length; i++) {
		if (i > 0 && random() < 0.5) level = 1 - level;
		bits += level;
	}
	const signal = pattern('A', bits);
	const rising = signal.bits.filter((b, i) => i > 0 && b === 1 && signal.bits[i - 1] === 0).length;
	const falling = signal.bits.filter((b, i) => i > 0 && b === 0 && signal.bits[i - 1] === 1).length;
	const kind = pick(random, ['rising', 'falling', 'pulses'] as const);
	const right = kind === 'falling' ? falling : rising;
	const other = kind === 'falling' ? rising : falling;
	const { options, answer } = assemble(
		random,
		String(right),
		[
			String(other),
			String(right + 1),
			String(Math.max(0, right - 1)),
			String(rising + falling),
			String(right + 2)
		].filter((d) => d !== String(right))
	);
	const prompt =
		kind === 'rising'
			? 'How many rising edges does signal A have in this diagram?'
			: kind === 'falling'
			? 'How many falling edges does signal A have in this diagram?'
			: 'Signal A is fed into a rising edge detector. How many pulses does the detector produce over this diagram?';
	const wanted = kind === 'falling' ? 'falling' : 'rising';
	const where = signal.bits
		.map((b, i) => (i > 0 && signal.bits[i - 1] !== b && (wanted === 'rising' ? b === 1 : b === 0) ? i + 1 : 0))
		.filter((c) => c > 0);
	return {
		prompt,
		svg: timingToSvg([signal], { showEdges: false, showCycles: true }),
		svgAlt: timingAlt([signal]),
		options,
		answer,
		hints: [
			`A ${wanted} edge is the instant the signal goes from ${
				wanted === 'rising' ? '0 to 1' : '1 to 0'
			}. Count the places where the line steps ${
				wanted === 'rising' ? 'up' : 'down'
			}, not the columns where it is high.${
				kind === 'pulses' ? ' A rising edge detector gives one pulse per rising edge and nothing else.' : ''
			}`,
			`The signal reads ${bits} column by column. Look at each pair of neighbouring columns and count the ${
				wanted === 'rising' ? '0 followed by 1' : '1 followed by 0'
			} pairs.`
		],
		explanation: `Reading ${bits} left to right, the ${wanted} edges are at the start of ${
			where.length ? `column${where.length === 1 ? '' : 's'} ${where.join(', ')}` : 'no column at all'
		}: ${right} in total.${
			kind === 'pulses' ? ' The detector pulses once per rising edge, so that is the number of pulses.' : ''
		}`
	};
};

const edgeWords = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'What is a rising edge?',
			right: 'the instant a signal goes from 0 to 1',
			wrong: [
				'the instant a signal goes from 1 to 0',
				'the whole time a signal is at 1',
				'the highest voltage the clock reaches'
			]
		},
		{
			prompt: 'What is a falling edge?',
			right: 'the instant a signal goes from 1 to 0',
			wrong: ['the instant a signal goes from 0 to 1', 'the whole time a signal is at 0', 'the moment the clock stops']
		},
		{
			prompt: 'How many rising edges does a clock have in one period?',
			right: '1',
			wrong: ['2', '0', 'it depends on the frequency']
		},
		{
			prompt: 'What is a clock, in a digital circuit?',
			right: 'a signal that flips between 0 and 1 at a steady rate',
			wrong: ['a circuit that shows the time of day', 'a wire that is always 1', 'a gate with a very long delay']
		},
		{
			prompt: 'Why is memory in a big circuit made to change only on a clock edge?',
			right: 'so every stored bit changes at the same instant and the logic between has a full period to settle',
			wrong: [
				'because gates cannot work without a clock',
				'so the circuit uses less power',
				'because a latch cannot be built without one'
			]
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A clock is a steady square wave. Each period has one rising edge, the instant it goes 0 to 1, and one falling edge, the instant it goes 1 to 0.',
			'Edges are instants, not stretches of time. Pick the option that talks about the moment of change, or about everything changing together at that moment.'
		],
		explanation:
			'A clock flips between 0 and 1 at a steady rate. The instant it goes from 0 to 1 is a rising edge and the instant it goes from 1 to 0 is a falling edge; each period has exactly one of each. Making all memory change on the same edge keeps a big circuit in step and gives the logic between a whole period to settle.'
	};
};

const frequencies: { hz: number; label: string }[] = [
	{ hz: 1, label: '1 Hz' },
	{ hz: 2, label: '2 Hz' },
	{ hz: 4, label: '4 Hz' },
	{ hz: 5, label: '5 Hz' },
	{ hz: 10, label: '10 Hz' },
	{ hz: 20, label: '20 Hz' },
	{ hz: 50, label: '50 Hz' },
	{ hz: 100, label: '100 Hz' },
	{ hz: 200, label: '200 Hz' },
	{ hz: 500, label: '500 Hz' },
	{ hz: 1000, label: '1 kHz' },
	{ hz: 2000, label: '2 kHz' },
	{ hz: 10_000, label: '10 kHz' },
	{ hz: 1_000_000, label: '1 MHz' }
];

/** A period in seconds, written in the friendliest unit. */
const periodLabel = (seconds: number) => {
	const tidy = (n: number) => String(Math.round(n * 1000) / 1000);
	if (seconds >= 1) return `${tidy(seconds)} s`;
	if (seconds >= 0.001) return `${tidy(seconds * 1000)} ms`;
	return `${tidy(seconds * 1_000_000)} µs`;
};

const periodAndFrequency = (random: Random): CourseQuestion => {
	const f = pick(random, frequencies);
	const period = 1 / f.hz;
	const right = periodLabel(period);
	const toPeriod = random() < 0.6;
	if (toPeriod) {
		const wrong = [
			...new Set([periodLabel(period * 10), periodLabel(period / 10), periodLabel(period * 2), `${f.hz} ms`])
		]
			.filter((d) => d !== right)
			.slice(0, 3);
		const { options, answer } = assemble(random, right, wrong);
		return {
			prompt: `A clock runs at ${f.label}. What is its period?`,
			options,
			answer,
			hints: [
				"Period and frequency are each other's inverse: period = 1 ÷ frequency. A frequency in hertz is cycles per second, so the period comes out in seconds.",
				`${f.label} is ${f.hz} cycles a second, so one cycle takes 1/${f.hz} of a second. Convert that to the handiest unit (1 s = 1000 ms, 1 ms = 1000 µs).`
			],
			explanation: `${f.label} means ${f.hz} cycles every second, so each cycle lasts 1/${f.hz} s = ${right}.`
		};
	}
	const wrong = [
		frequencies.find((g) => g.hz === f.hz * 10)?.label ?? `${f.hz * 10} Hz`,
		frequencies.find((g) => g.hz * 10 === f.hz)?.label ?? `${f.hz / 10} Hz`,
		frequencies.find((g) => g.hz === f.hz * 2)?.label ?? `${f.hz * 2} Hz`
	];
	const { options, answer } = assemble(random, f.label, wrong);
	return {
		prompt: `A clock has a period of ${right}. What is its frequency?`,
		options,
		answer,
		hints: [
			'Frequency is how many periods fit into one second: frequency = 1 ÷ period, with the period in seconds.',
			`${right} is ${period} s, so ask how many of those fit into a second: 1 ÷ ${period}.`
		],
		explanation: `A period of ${right} is ${period} s, and 1 ÷ ${period} = ${f.hz}, so the clock runs at ${f.hz} cycles a second: ${f.label}.`
	};
};

const edgeDetector = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'The output of a rising edge detector has just gone to 1 for a moment. What did its input do?',
			right: 'it went from 0 to 1',
			wrong: ['it went from 1 to 0', 'it stayed at 1', 'it stayed at 0']
		},
		{
			prompt: 'The input of a rising edge detector goes to 1 and stays there. What does the output do?',
			right: 'one short pulse at the edge, then 0',
			wrong: ['1 for as long as the input is 1', 'nothing, because the input did not fall', 'it flips every period']
		},
		{
			prompt:
				'A rising edge detector ANDs the signal with an inverted copy of itself. Why must the copy also be delayed?',
			right: 'so that for a moment after the edge the signal is 1 while the copy is still 1',
			wrong: [
				'so that the AND gate has time to warm up',
				'because NOT gates cannot be connected straight to AND gates',
				'to make the pulse arrive before the edge'
			]
		},
		{
			prompt: 'Which gates make up the rising edge detector in the simulator?',
			right: 'an AND and a NOT, with a delay between them',
			wrong: ['two NOR gates cross-coupled', 'an OR and an XOR', 'a single NAND gate']
		},
		{
			prompt: 'What does a rising edge detector output on a falling edge of its input?',
			right: 'nothing: the output stays 0',
			wrong: ['a short pulse', '1 for as long as the input is 0', 'the opposite of its input']
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'The detector is AND(signal, delayed NOT signal). The two disagree almost all the time, so the AND is 0; they agree only in the moment after the signal has risen and the delayed inverted copy has not caught up.',
			'That moment is the pulse: it starts on the rising edge and lasts as long as the delay. Nothing happens while the signal sits still, and nothing on a falling edge, where both are 0.'
		],
		explanation:
			'A rising edge detector ANDs its input with an inverted, delayed copy. Just after a rising edge the input is 1 and the delayed copy is still 1, so the AND outputs a pulse as long as the delay. While the input sits at 1 or 0 the two disagree and the output is 0, and on a falling edge both are 0, so nothing happens.'
	};
};

// ---------------------------------------------------------------------------
// Lesson 4: flip-flops

const rule: Record<string, string> = {
	sr: 'S sets, R resets, both 0 holds, and S = R = 1 is not allowed.',
	d: 'On the edge, Q becomes whatever D is.',
	t: 'On the edge, Q flips when T is 1 and holds when T is 0.',
	jk: 'J sets, K resets, both 0 holds, and both 1 toggles.'
};

const nextQ = (random: Random): CourseQuestion => {
	const ff = pick(random, flipFlops);
	const row = pick(random, ff.characteristic);
	const right = row.next === 'invalid' ? 'not allowed' : row.next;
	const { options, answer } = assemble(random, right, [
		'0',
		'1',
		'not allowed',
		'it changes at once, without waiting for the edge'
	]);
	const inputs = ff.inputs.map((name, i) => `${name.toUpperCase()} = ${row.inputs[i]}`).join(', ');
	const label = ff.slug === 'sr' ? 'SR flip-flop' : `${ff.shortName} flip-flop`;
	return {
		prompt: `A${ff.slug === 'sr' ? 'n' : ''} ${label} has ${inputs} and Q is currently ${
			row.q
		}. What is Q after the next clock edge?`,
		detail: `${inputs}, Q = ${row.q}`,
		options,
		answer,
		hints: [
			`The rule of the ${ff.shortName}: ${rule[ff.slug]}`,
			`Here ${inputs}, so this is the "${row.note}" row of the characteristic table${
				row.next === 'invalid' ? '.' : `, with Q = ${row.q} going in.`
			}`
		],
		explanation:
			row.next === 'invalid'
				? `${inputs} is the forbidden input of the SR flip-flop: both outputs would be driven to 0 and the state after that is unpredictable, so the characteristic table marks it as not allowed.`
				: `${rule[ff.slug]} With ${inputs} and Q = ${row.q}, the characteristic table row is "${row.note}", so Q⁺ = ${
						row.next
				  }. As an equation, ${ff.equationText}.`
	};
};

const whichFlipFlop = (random: Random): CourseQuestion => {
	// Derived from the characteristic tables rather than named by hand.
	const toggles = flipFlops.filter((ff) => ff.characteristic.some((row) => row.note === 'toggle'));
	const single = toggles.find((ff) => ff.inputs.length === 1)!;
	const double = toggles.find((ff) => ff.inputs.length === 2)!;
	const forbidden = flipFlops.find((ff) => ff.characteristic.some((row) => row.next === 'invalid'))!;
	const copies = flipFlops.find((ff) => ff.characteristic.every((row) => row.next === row.inputs[0]))!;
	const asks = [
		{
			prompt: 'Which flip-flop flips its output on every clock edge while its single input is held at 1?',
			right: single,
			why: `${single.shortName} stands for toggle: with ${single.inputs[0].toUpperCase()} = 1, every edge inverts Q.`
		},
		{
			prompt: 'Which flip-flop copies its input to Q on every clock edge?',
			right: copies,
			why: `The ${copies.shortName} flip-flop's whole rule is ${
				copies.equationText
			}: Q becomes whatever ${copies.inputs[0].toUpperCase()} is at the edge.`
		},
		{
			prompt: 'Which flip-flop turns the forbidden both-inputs-1 case of the SR into a toggle?',
			right: double,
			why: `The ${
				double.shortName
			} is an SR with its outputs fed back to the input logic, so ${double.inputs[0].toUpperCase()} = ${double.inputs[1].toUpperCase()} = 1 inverts Q instead of being forbidden.`
		},
		{
			prompt: 'Which flip-flop has an input combination that is not allowed?',
			right: forbidden,
			why: `The ${
				forbidden.shortName
			} inherits the latch's forbidden case: ${forbidden.inputs[0].toUpperCase()} = ${forbidden.inputs[1].toUpperCase()} = 1 drives both outputs low and leaves the next state unpredictable.`
		},
		{
			prompt: 'Which flip-flop is used for nearly every stored bit in a modern chip, such as the bits of a register?',
			right: copies,
			why: `The ${copies.shortName} has one input and no special cases, and any other flip-flop can be made from it with a gate or two, so it is the one design tools reach for.`
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(
		random,
		ask.right.shortName,
		flipFlops.filter((ff) => ff.slug !== ask.right.slug).map((ff) => ff.shortName)
	);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'D copies its input on the edge. T toggles when its input is 1. JK is SR with both-1 meaning toggle. SR still has the forbidden both-1 case.',
			`Its next-state equation is ${ask.right.equationText}. Which flip-flop is that?`
		],
		explanation: ask.why
	};
};

const dFlipFlop = flipFlopBySlug('d')!;
const dEquation = parseExpression(dFlipFlop.equation);

const whatDDoes = (random: Random): CourseQuestion => {
	const d = random() < 0.5;
	const q = random() < 0.5;
	const after = evaluate(dEquation, { d, q });
	const asks = [
		{
			prompt: 'What does a D flip-flop do on a rising clock edge?',
			right: 'Q takes the value D has at that instant',
			wrong: ['Q flips to its opposite', 'Q takes the opposite of D', 'Q holds whatever it had'],
			explanation: `The D flip-flop's rule is ${dFlipFlop.equationText}: at the edge, Q becomes D. Between edges it holds.`
		},
		{
			prompt: `A D flip-flop has Q = ${bit(q)}. Between two clock edges, D goes from ${bit(d)} to ${bit(
				!d
			)} and back to ${bit(d)}. What does Q do during that time?`,
			right: `nothing: Q stays at ${bit(q)} until the next edge`,
			wrong: [
				`it follows D: ${bit(d)}, ${bit(!d)}, ${bit(d)}`,
				`it goes to ${bit(!d)} and stays there`,
				'it toggles once'
			],
			explanation: `A flip-flop only looks at D on the edge. Between edges Q holds at ${bit(
				q
			)} no matter what D does, and the change to ${bit(!d)} is never seen because D was back at ${bit(
				d
			)} by the next edge.`
		},
		{
			prompt: `A D flip-flop has Q = ${bit(q)} and D = ${bit(
				d
			)} at the rising edge. A moment after the edge D changes to ${bit(!d)}. What is Q for the rest of the cycle?`,
			right: String(bit(after)),
			wrong: [String(bit(!after)), 'it switches halfway through', 'it cannot be known'],
			explanation: `At the edge D was ${bit(d)}, so Q became ${bit(after)}. The later change to ${bit(
				!d
			)} is ignored until the next edge, so Q stays at ${bit(after)} for the whole cycle.`
		},
		{
			prompt: 'What is the setup time of a flip-flop?',
			right: 'how long the input must already be steady before the clock edge',
			wrong: [
				'how long the clock must stay at 1',
				'the delay between two flip-flops',
				'the time it takes to build the circuit'
			]
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A D flip-flop is a photograph of D taken at the edge. Q becomes D at that instant and holds until the next edge, whatever D does in between.',
			ask.right.startsWith('how long')
				? 'The input has to have settled before the edge arrives, or the photograph is blurred. Pick the option about the input being steady before the edge.'
				: `Ask only what D was at the edge itself. ${
						ask.prompt.includes('at the rising edge') ? `It was ${bit(d)}.` : 'Everything between edges is ignored.'
				  }`
		],
		explanation:
			ask.explanation ??
			'The setup time is the short stretch before the edge during which D must already be steady. If D is still changing then, the flip-flop may capture nonsense. It is what limits how fast a clock can run.'
	};
};

const latchVsFlipFlop = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'What is the difference between a latch and a flip-flop?',
			right: 'a latch responds whenever its inputs change; a flip-flop only on a clock edge',
			wrong: [
				'a latch has memory and a flip-flop does not',
				'a flip-flop stores several bits and a latch stores one',
				'a flip-flop needs no clock and a latch does'
			]
		},
		{
			prompt: 'Which word describes a flip-flop, as opposed to a latch?',
			right: 'edge-triggered',
			wrong: ['level-sensitive', 'combinational', 'transparent']
		},
		{
			prompt:
				'A gated latch has its enable at 1 and its inputs change three times. How many times can its output change?',
			right: 'up to three times, once for each input change',
			wrong: ['once, at the start of the enable', 'never, because enable was not a clock edge', 'exactly twice']
		},
		{
			prompt: "A flip-flop's input changes three times between two clock edges. How many times can Q change?",
			right: 'once at most, at the edge',
			wrong: ['three times', 'twice', 'it depends on how long the clock is high']
		},
		{
			prompt: 'Which of these is level-sensitive?',
			right: 'a gated SR latch',
			wrong: ['a D flip-flop', 'a T flip-flop', 'a JK flip-flop']
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A latch is level-sensitive: it responds whenever its inputs change, or for as long as its enable is high. A flip-flop is edge-triggered: it responds only at the instant of a clock edge.',
			'Ask how many instants the circuit listens at. A latch listens for a stretch of time; a flip-flop listens once per period, so its output can move once per period at most.'
		],
		explanation:
			'A latch is level-sensitive and can change its output as often as its inputs change while it is listening. A flip-flop is edge-triggered: it looks at its inputs only at the clock edge, so Q changes at most once per period, at that instant, and everything downstream can rely on it.'
	};
};

export const memory: StageMeta = {
	id: 'memory',
	title: 'Memory',
	tagline: 'Feed a gate back into itself and the circuit starts to remember.',
	lessons: [
		{
			slug: 'circuits-with-memory',
			title: 'Circuits that remember',
			blurb: 'Loop an output back to an input and the circuit gets a past.',
			description:
				'Combinational versus sequential logic: why every circuit so far had no memory, how feeding an output back gives a circuit state, and why a clock will be needed.',
			minutes: 10,
			generators: [combinationalOrSequential, whatIsState, orLoop, whichIsSequential],
			deeper: [
				{ href: '/combinational-vs-sequential', label: 'Combinational vs sequential logic' },
				{ href: '/sr-latch', label: 'The SR latch' }
			],
			build: {
				href: '/simulator',
				label: 'an OR gate with its output wired back into one of its inputs, a toggle and a display'
			}
		},
		{
			slug: 'the-sr-latch',
			title: 'The SR latch',
			blurb: 'Two NOR gates holding each other up: one bit of memory you can set and reset.',
			description:
				'How the SR latch works, gate by gate: two cross-coupled NOR gates, set, reset and hold, Q and Q-bar, the forbidden S = R = 1 input and the NAND version.',
			minutes: 14,
			generators: [latchAfterSequence, latchRow, forbiddenState, latchGates],
			deeper: [
				{ href: '/sr-latch', label: 'The SR latch' },
				{ href: '/sr-latch#nand', label: 'The NAND version' },
				{ href: '/logic-gates/nor', label: 'The NOR gate' },
				{ href: '/flip-flops/sr', label: 'The SR flip-flop' }
			],
			build: {
				href: '/simulator',
				label:
					"the SR latch: two NOR gates, two toggles and two displays, with each gate's output wired back into the other's input"
			}
		},
		{
			slug: 'clocks-and-edges',
			title: 'Clocks and edges',
			blurb: 'A steady tick, the instants it changes, and why everything moves on the same one.',
			description:
				'What a clock is, period and frequency, rising and falling edges, why memory should change only on an edge, the gated latch and a rising edge detector built from gates.',
			minutes: 12,
			generators: [countEdges, edgeWords, periodAndFrequency, edgeDetector],
			deeper: [
				{ href: '/combinational-vs-sequential', label: 'Why the clock arrives' },
				{ href: '/flip-flops', label: 'Latch or flip-flop?' }
			],
			build: { href: '/simulator#example:Rising%20edge%20detector', label: 'the rising edge detector' }
		},
		{
			slug: 'flip-flops',
			title: 'Flip-flops',
			blurb: 'A latch that only listens on the clock edge: D, T and JK, with their tables and timing.',
			description:
				'The D, T and JK flip-flops explained: a latch that looks at its inputs only on a clock edge, with characteristic tables, a timing diagram to grow and setup time.',
			minutes: 14,
			generators: [nextQ, whichFlipFlop, whatDDoes, latchVsFlipFlop],
			deeper: [
				{ href: '/flip-flops', label: 'Flip-flops' },
				{ href: '/flip-flops/d', label: 'The D flip-flop' },
				{ href: '/flip-flops/t', label: 'The T flip-flop' },
				{ href: '/flip-flops/jk', label: 'The JK flip-flop' },
				{ href: '/flip-flops/sr', label: 'The SR flip-flop' }
			]
		}
	]
};
