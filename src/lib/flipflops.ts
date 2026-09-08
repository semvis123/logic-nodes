// Reference data for the flip-flop pages. The characteristic equation of each
// one is checked against its hand-written table in the test suite, so the two
// can never disagree.

/** '0', '1' or 'X' for a don't care. */
export type Bit = '0' | '1' | 'X';

export type FlipFlop = {
	slug: string;
	name: string;
	shortName: string;
	/** Input pins, in table order. Q is always appended as the present state. */
	inputs: string[];
	/** Boolean expression for the next state, in the engine's syntax. */
	equation: string;
	/** The same equation formatted for reading. */
	equationText: string;
	tagline: string;
	behaviour: string;
	intuition: string;
	/** Rows of the characteristic table: inputs then present state, then next. */
	characteristic: { inputs: Bit[]; q: Bit; next: Bit | 'invalid'; note: string }[];
	/** How to drive a wanted transition: Q -> Q+ needs these inputs. */
	excitation: { from: Bit; to: Bit; inputs: Bit[] }[];
	uses: string[];
	buildFrom: string;
	faqs: { q: string; a: string }[];
};

export const flipFlops: FlipFlop[] = [
	{
		slug: 'sr',
		name: 'SR latch and flip-flop',
		shortName: 'SR',
		inputs: ['s', 'r'],
		equation: 's | (!r & q)',
		equationText: 'Q⁺ = S ∨ (¬R ∧ Q)',
		tagline: 'Set it, reset it, and it stays where you put it.',
		behaviour:
			'Raising S drives the output high and it stays high after S returns low. Raising R drives it back to 0. With both inputs low the circuit holds whatever it last had, and that holding is the whole point: it is the first circuit with memory rather than just a response to its current inputs.',
		intuition:
			'Two NOR gates, each feeding one input of the other. The cross connection means each gate helps hold the other in place, so the pair has two stable configurations and sits in whichever one it was last pushed into. Raising both inputs at once is the flaw: it forces both outputs low, so the two "opposite" outputs are no longer opposite, and when the inputs drop together the result depends on which gate happens to be faster.',
		characteristic: [
			{ inputs: ['0', '0'], q: '0', next: '0', note: 'hold' },
			{ inputs: ['0', '0'], q: '1', next: '1', note: 'hold' },
			{ inputs: ['0', '1'], q: '0', next: '0', note: 'reset' },
			{ inputs: ['0', '1'], q: '1', next: '0', note: 'reset' },
			{ inputs: ['1', '0'], q: '0', next: '1', note: 'set' },
			{ inputs: ['1', '0'], q: '1', next: '1', note: 'set' },
			{ inputs: ['1', '1'], q: '0', next: 'invalid', note: 'not allowed' },
			{ inputs: ['1', '1'], q: '1', next: 'invalid', note: 'not allowed' }
		],
		excitation: [
			{ from: '0', to: '0', inputs: ['0', 'X'] },
			{ from: '0', to: '1', inputs: ['1', '0'] },
			{ from: '1', to: '0', inputs: ['0', '1'] },
			{ from: '1', to: '1', inputs: ['X', '0'] }
		],
		uses: [
			'Debouncing a mechanical switch, where the two contacts set and reset the latch and the bouncing in between is ignored.',
			'The storage element inside every other flip-flop on this page: they are all an SR latch with logic bolted onto the front.',
			'Holding an alarm or fault condition until something explicitly clears it.',
			'Arbitrating between two requests, since whichever arrives first wins and holds.'
		],
		buildFrom:
			'Two NOR gates, output of each into an input of the other. The free NOR inputs become S and R. Using NAND gates instead gives the same behaviour with active-low inputs, usually written S̄R̄.',
		faqs: [
			{
				q: 'What is the difference between an SR latch and an SR flip-flop?',
				a: 'A latch responds the moment its inputs change. A flip-flop only looks at its inputs on a clock edge, so its output changes at predictable instants. In practice an SR flip-flop is an SR latch with the inputs gated by a clock.'
			},
			{
				q: 'Why is S = R = 1 forbidden?',
				a: 'It drives both outputs low, so Q and its complement are momentarily equal, which the rest of the circuit does not expect. Worse, when the two inputs return to 0 together the latch settles into whichever state its gates happen to reach first, so the result is not predictable. The JK flip-flop exists largely to remove this case.'
			}
		]
	},
	{
		slug: 'd',
		name: 'D flip-flop',
		shortName: 'D',
		inputs: ['d'],
		equation: 'd',
		equationText: 'Q⁺ = D',
		tagline: 'Whatever is on the input at the clock edge is what you get.',
		behaviour:
			'The simplest useful flip-flop. On each active clock edge the output takes the value of D, and between edges it holds. There is no forbidden combination and nothing to remember: the next state is just the input.',
		intuition:
			'D stands for data, or for delay, and both readings are fair. It captures a value and holds it steady for a whole clock period, which is exactly what you need to stop a signal changing while something else is trying to read it. Every register, every pipeline stage and most of the memory inside a processor is built from these.',
		characteristic: [
			{ inputs: ['0'], q: '0', next: '0', note: 'load 0' },
			{ inputs: ['0'], q: '1', next: '0', note: 'load 0' },
			{ inputs: ['1'], q: '0', next: '1', note: 'load 1' },
			{ inputs: ['1'], q: '1', next: '1', note: 'load 1' }
		],
		excitation: [
			{ from: '0', to: '0', inputs: ['0'] },
			{ from: '0', to: '1', inputs: ['1'] },
			{ from: '1', to: '0', inputs: ['0'] },
			{ from: '1', to: '1', inputs: ['1'] }
		],
		uses: [
			'Registers: one D flip-flop per bit, all sharing a clock, is how a processor holds a word.',
			"Pipeline stages, where each stage captures the previous one's result on the same edge.",
			'Synchronising an input that arrives at an unrelated time, usually two in a row to reduce the chance of metastability.',
			'Dividing a clock by two: feed the inverted output back into D and the output flips every edge.'
		],
		buildFrom:
			'An SR latch with S = D and R = ¬D, so the forbidden combination can never be reached. The edge triggered version chains two such latches on opposite clock phases, which is why it is called a master-slave arrangement.',
		faqs: [
			{
				q: 'What does the D stand for?',
				a: 'Data, and it is also read as delay, because the output follows the input one clock period later. Both descriptions fit what the circuit does.'
			},
			{
				q: 'What is the difference between a D latch and a D flip-flop?',
				a: 'A D latch is transparent while its enable is high: the output follows the input continuously. A D flip-flop only samples on the clock edge, so the output changes once per clock no matter how the input moves in between. Flip-flops are what synchronous designs use.'
			}
		]
	},
	{
		slug: 'jk',
		name: 'JK flip-flop',
		shortName: 'JK',
		inputs: ['j', 'k'],
		equation: '(j & !q) | (!k & q)',
		equationText: 'Q⁺ = (J ∧ ¬Q) ∨ (¬K ∧ Q)',
		tagline: 'Set, reset, hold, and the forbidden case turned into something useful.',
		behaviour:
			'J sets and K resets, exactly like S and R. The difference is the case where both are high: instead of being forbidden, it toggles the output. That makes every one of the four input combinations meaningful, which is why the JK was for a long time the general purpose flip-flop.',
		intuition:
			'Take an SR flip-flop and feed the outputs back into the input gates, so the circuit knows its own state. Now "set" can only act when the output is 0 and "reset" only when it is 1, which is what removes the contradiction. The freed-up combination is then wired to invert, giving a toggle for nothing.',
		characteristic: [
			{ inputs: ['0', '0'], q: '0', next: '0', note: 'hold' },
			{ inputs: ['0', '0'], q: '1', next: '1', note: 'hold' },
			{ inputs: ['0', '1'], q: '0', next: '0', note: 'reset' },
			{ inputs: ['0', '1'], q: '1', next: '0', note: 'reset' },
			{ inputs: ['1', '0'], q: '0', next: '1', note: 'set' },
			{ inputs: ['1', '0'], q: '1', next: '1', note: 'set' },
			{ inputs: ['1', '1'], q: '0', next: '1', note: 'toggle' },
			{ inputs: ['1', '1'], q: '1', next: '0', note: 'toggle' }
		],
		excitation: [
			{ from: '0', to: '0', inputs: ['0', 'X'] },
			{ from: '0', to: '1', inputs: ['1', 'X'] },
			{ from: '1', to: '0', inputs: ['X', '1'] },
			{ from: '1', to: '1', inputs: ['X', '0'] }
		],
		uses: [
			'Ripple counters, by tying J and K high so the flip-flop toggles on every edge.',
			"State machines, where the don't cares in its excitation table often make the driving logic smaller than a D would.",
			'Shift registers and frequency dividers.',
			'Any place you want set, reset and toggle available from one part.'
		],
		buildFrom:
			'An SR flip-flop with the outputs fed back: J is ANDed with ¬Q and K with Q before they reach the set and reset inputs. It must be edge triggered, because a level triggered version with J = K = 1 would toggle continuously for as long as the clock stayed high.',
		faqs: [
			{
				q: 'What do J and K stand for?',
				a: 'Nothing agreed on. The most repeated story is that they honour Jack Kilby, though it has never been firmly established. Treat them as arbitrary names for the set and reset inputs.'
			},
			{
				q: 'What happens when J and K are both 1?',
				a: 'The output toggles on every clock edge. That is the whole reason the JK exists: the input combination that an SR flip-flop forbids is put to work as an invert instruction.'
			}
		]
	},
	{
		slug: 't',
		name: 'T flip-flop',
		shortName: 'T',
		inputs: ['t'],
		equation: 't ^ q',
		equationText: 'Q⁺ = T ⊻ Q',
		tagline: 'Hold when T is 0, invert when T is 1.',
		behaviour:
			'A single input decides whether the output keeps its value or flips it on the clock edge. That is the entire specification, and it makes the T flip-flop the natural building block for anything that counts.',
		intuition:
			'Toggling is division. Tie T high and the output changes on every clock edge, so it completes one cycle for every two input cycles: a divide by two. Chain four of them and you have a counter that displays 0 to 15 in binary, which is exactly how a simple ripple counter works.',
		characteristic: [
			{ inputs: ['0'], q: '0', next: '0', note: 'hold' },
			{ inputs: ['0'], q: '1', next: '1', note: 'hold' },
			{ inputs: ['1'], q: '0', next: '1', note: 'toggle' },
			{ inputs: ['1'], q: '1', next: '0', note: 'toggle' }
		],
		excitation: [
			{ from: '0', to: '0', inputs: ['0'] },
			{ from: '0', to: '1', inputs: ['1'] },
			{ from: '1', to: '0', inputs: ['1'] },
			{ from: '1', to: '1', inputs: ['0'] }
		],
		uses: [
			'Binary counters: each stage toggles when the one before it falls, so the bits count up.',
			'Clock division, halving a frequency per stage.',
			'Turning a momentary button into an on/off state that survives the button being released.',
			'Gray code counters, where only one stage is allowed to change per step.'
		],
		buildFrom:
			'A JK flip-flop with J and K tied together, or a D flip-flop with D = T ⊻ Q, which is one XOR gate fed from the output. The XOR version is the one you will build in a simulator.',
		faqs: [
			{
				q: 'How do you make a T flip-flop from a D flip-flop?',
				a: "Feed D from an XOR gate whose inputs are T and the flip-flop's own output. When T is 0 the XOR passes Q back unchanged and the state holds; when T is 1 it passes ¬Q and the state flips."
			},
			{
				q: 'Why is a T flip-flop good for counting?',
				a: 'Because its output changes once every two clock edges, which is a divide by two. Cascade n of them and you get a counter with n bits, each stage running at half the rate of the one before it.'
			}
		]
	}
];

export const flipFlopBySlug = (slug: string) => flipFlops.find((f) => f.slug === slug);
