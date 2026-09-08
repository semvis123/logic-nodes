// Reference data for the per-gate pages. Every boolean claim here (the
// equivalences especially) is checked against the expression engine in the
// test suite, so the published identities cannot drift from the truth.

export type GateEquivalence = { label: string; expression: string; equals: string };

export type Gate = {
	slug: string;
	name: string;
	symbol: string;
	expression: string;
	/** The expression the engine parses to build this gate's truth table. */
	source: string;
	inputs: number | 'many';
	tagline: string;
	/** Completes the sentence "the output is high when...". */
	outputHigh: string;
	behaviour: string;
	intuition: string;
	uses: string[];
	equivalences: GateEquivalence[];
	inSimulator: string;
	faqs: { q: string; a: string }[];
};

export const gates: Gate[] = [
	{
		slug: 'and',
		name: 'AND',
		symbol: 'a ∧ b',
		expression: 'a · b',
		source: 'a & b',
		inputs: 'many',
		tagline: 'High only when every input is high.',
		outputHigh: 'every input is high',
		behaviour:
			'An AND gate outputs 1 when all of its inputs are 1, and 0 the moment any one of them drops to 0. With two inputs that is a single 1 in the truth table, out of four rows.',
		intuition:
			'Think of two switches wired in series along the same wire. The current only reaches the end if both switches are closed; opening either one breaks the circuit. That is exactly an AND gate, which is why AND is sometimes called a series connection.',
		uses: [
			'Gating a signal: feed data into one input and an enable line into the other, and the data only passes while enable is high.',
			'Masking bits, which is what a bitwise AND does in software, one AND gate per bit.',
			'Detecting that several conditions hold at once, such as "counter is at maximum" fed from every bit of the counter.',
			'The carry output of a half adder is a single AND gate.'
		],
		equivalences: [
			{ label: 'From NAND gates', expression: '!(!(a & b) & !(a & b))', equals: 'a & b' },
			{ label: 'From NOR gates', expression: '!(!(a | a) | !(b | b))', equals: 'a & b' },
			{ label: 'De Morgan form', expression: '!(!a | !b)', equals: 'a & b' }
		],
		inSimulator:
			'The Logic menu has AND, and its input count is a parameter: open the node and ask for three or eight inputs instead of two rather than chaining several gates.',
		faqs: [
			{
				q: 'Can an AND gate have more than two inputs?',
				a: 'Yes. An AND gate of any width outputs 1 only when every input is 1. In Logic Nodes the input count is an option on the node, and in hardware three and four input AND gates are standard parts.'
			},
			{
				q: 'What is the difference between AND and NAND?',
				a: 'NAND is AND with the output inverted. Where AND gives 1 only when all inputs are 1, NAND gives 0 only in that case and 1 everywhere else.'
			}
		]
	},
	{
		slug: 'or',
		name: 'OR',
		symbol: 'a ∨ b',
		expression: 'a + b',
		source: 'a | b',
		inputs: 'many',
		tagline: 'High when at least one input is high.',
		outputHigh: 'at least one input is high',
		behaviour:
			'An OR gate outputs 1 if any of its inputs is 1, and only outputs 0 when every input is 0. This is the inclusive or: unlike everyday English, "a or b" here is still true when both are true.',
		intuition:
			"Two switches wired in parallel. Close either one, or both, and the current gets through; the only way to stop it is to open all of them. OR is the parallel connection to AND's series one.",
		uses: [
			'Collecting alarm or error conditions: any one of them going high raises a single combined flag.',
			'Bitwise OR in software, setting bits without disturbing the others.',
			'Merging several requests onto one line, as in a simple interrupt system.',
			'Building a sum of products, where the final OR joins the AND terms together.'
		],
		equivalences: [
			{ label: 'From NAND gates', expression: '!(!(a & a) & !(b & b))', equals: 'a | b' },
			{ label: 'From NOR gates', expression: '!(!(a | b) | !(a | b))', equals: 'a | b' },
			{ label: 'De Morgan form', expression: '!(!a & !b)', equals: 'a | b' }
		],
		inSimulator: 'OR sits in the Logic menu next to AND, and takes a configurable number of inputs in the same way.',
		faqs: [
			{
				q: 'Is OR inclusive or exclusive?',
				a: 'Inclusive. An OR gate outputs 1 when both inputs are 1. If you want the exclusive version, which is 0 when both inputs are 1, that is the XOR gate.'
			},
			{
				q: 'What is the difference between OR and NOR?',
				a: 'NOR is OR with an inverted output: it gives 1 only when every input is 0.'
			}
		]
	},
	{
		slug: 'not',
		name: 'NOT',
		symbol: '¬a',
		expression: "a'",
		source: '!a',
		inputs: 1,
		tagline: 'Outputs the opposite of its single input.',
		outputHigh: 'its single input is low',
		behaviour:
			'A NOT gate, also called an inverter, has one input and one output. It turns 1 into 0 and 0 into 1. Inverting twice gets you back where you started, which is the double negation law.',
		intuition:
			'It is the only gate that does not combine anything. Everything else on this page merges two or more signals; the inverter just flips one. That makes it the piece that turns AND into NAND, OR into NOR, and a positive condition into a negative one.',
		uses: [
			'Turning an active-low signal into an active-high one, which is most of what inverters do in real boards.',
			'Completing a set: AND and OR alone cannot express everything, but add NOT and you can express any boolean function at all.',
			'Building a ring oscillator, where an odd number of inverters in a loop never settles and oscillates instead.',
			'Producing the complement of a variable for a sum of products expression.'
		],
		equivalences: [
			{ label: 'From a NAND gate', expression: '!(a & a)', equals: '!a' },
			{ label: 'From a NOR gate', expression: '!(a | a)', equals: '!a' },
			{ label: 'From XOR with a 1', expression: 'a ^ 1', equals: '!a' }
		],
		inSimulator:
			'NOT is in the Logic menu. It is the one gate with a fixed single input, so there is no input count to set.',
		faqs: [
			{
				q: 'Why is a NOT gate called an inverter?',
				a: 'Because it inverts its input: the output is always the opposite level. The two names mean the same thing, and in circuit diagrams it is drawn as a triangle with a small bubble on the output, the bubble being the part that means inversion.'
			},
			{
				q: 'What happens if I chain two NOT gates?',
				a: 'You get the original signal back, since inverting twice cancels out. It is not useless though: a pair of inverters is often used as a buffer, to strengthen a weak signal or to add a deliberate delay.'
			}
		]
	},
	{
		slug: 'xor',
		name: 'XOR',
		symbol: 'a ⊻ b',
		expression: 'a ⊕ b',
		source: 'a ^ b',
		inputs: 2,
		tagline: 'High when its two inputs disagree.',
		outputHigh: 'its two inputs differ',
		behaviour:
			'An exclusive or gate outputs 1 when exactly one of its two inputs is 1. Put another way, it outputs 1 when the inputs differ and 0 when they are the same, which makes it a one bit difference detector.',
		intuition:
			'XOR is the gate that answers "are these two different?". That single property explains nearly every use it has: comparing values, adding bits, flipping bits on demand and counting parity are all the same question asked in different contexts.',
		uses: [
			'The sum output of a half adder: 1 + 1 gives 0 and carries, which is exactly what XOR does.',
			'Comparing two values for equality, since a XOR b is 0 only when a and b match.',
			'A controlled inverter: XOR a signal with 1 to invert it, or with 0 to pass it through unchanged.',
			'Parity generators and checkers, and the same trick underpins the simplest error detection schemes.'
		],
		equivalences: [
			{ label: 'Sum of products', expression: '(a & !b) | (!a & b)', equals: 'a ^ b' },
			{ label: 'OR without the overlap', expression: '(a | b) & !(a & b)', equals: 'a ^ b' },
			{ label: 'From NAND gates only', expression: '!(!(a & !(a & b)) & !(b & !(a & b)))', equals: 'a ^ b' }
		],
		inSimulator:
			'XOR is in the Logic menu, with two inputs. For a wider parity check, chain XOR gates together: the result is 1 when an odd number of inputs are high.',
		faqs: [
			{
				q: 'What is the difference between OR and XOR?',
				a: 'They only differ on the last row of the truth table. When both inputs are 1, OR outputs 1 and XOR outputs 0. XOR is the "one or the other, but not both" version.'
			},
			{
				q: 'Why is XOR used in adders?',
				a: 'Because adding two bits gives 0 for 0+0, 1 for 0+1 and 1+0, and 0 with a carry for 1+1. That pattern is exactly XOR, and the carry is exactly AND. Together they form the half adder.'
			}
		]
	},
	{
		slug: 'nand',
		name: 'NAND',
		symbol: '¬(a ∧ b)',
		expression: "(a · b)'",
		source: '!(a & b)',
		inputs: 'many',
		tagline: 'The inverse of AND, and enough to build everything else.',
		outputHigh: 'any input is low',
		behaviour:
			'A NAND gate outputs 0 only when all of its inputs are 1, and 1 in every other case. It is an AND gate with the output inverted, which is where the name comes from: Not AND.',
		intuition:
			'NAND is functionally complete: every other gate can be built from NAND gates alone, so an entire processor could in principle be made of nothing else. That is not just a curiosity. In CMOS a NAND and a NOR both take four transistors, but the NAND puts its series devices on the fast side and its slow ones in parallel, so for the same drive strength it ends up smaller and quicker. That is why real chips are dominated by it. Only the inverter, at two transistors, is smaller still.',
		uses: [
			'Building any other gate, which is why NAND is the workhorse of real logic families.',
			'Cross-coupling two NAND gates gives an SR latch, the simplest circuit that remembers a bit.',
			'Flash memory cells are arranged in a NAND configuration, which is where the name NAND flash comes from.',
			'Replacing an AND followed by a NOT with a single, faster gate.'
		],
		equivalences: [
			{ label: 'NOT from NAND', expression: '!(a & a)', equals: '!a' },
			{ label: 'AND from NAND', expression: '!(!(a & b) & !(a & b))', equals: 'a & b' },
			{ label: 'OR from NAND', expression: '!(!(a & a) & !(b & b))', equals: 'a | b' },
			{ label: 'De Morgan form', expression: '!a | !b', equals: '!(a & b)' }
		],
		inSimulator:
			'NAND is in the Logic menu and takes a configurable number of inputs. Try rebuilding a half adder from NAND gates alone; it takes five.',
		faqs: [
			{
				q: 'Why is NAND called a universal gate?',
				a: 'Because NOT, AND and OR can all be built from NAND gates alone, and those three are enough to express any boolean function. So any circuit at all can be rewritten using only NAND gates. NOR is universal for the same reason.'
			},
			{
				q: 'How do you make a NOT gate from a NAND gate?',
				a: 'Tie both inputs together, or hold one input high. A NAND with both inputs fed by the same signal outputs the inverse of that signal.'
			}
		]
	},
	{
		slug: 'nor',
		name: 'NOR',
		symbol: '¬(a ∨ b)',
		expression: "(a + b)'",
		source: '!(a | b)',
		inputs: 'many',
		tagline: 'High only when every input is low.',
		outputHigh: 'every input is low',
		behaviour:
			'A NOR gate outputs 1 only when all of its inputs are 0. Any input going high drops the output to 0. It is an OR gate with the output inverted.',
		intuition:
			"Like NAND, NOR is functionally complete, so it can build every other gate on its own. It is also the gate behind the classic SR latch: two NOR gates each feeding the other's input, which is the first circuit most people meet that has memory rather than just combinational behaviour.",
		uses: [
			'Cross-coupled pairs form an SR latch, the building block of flip-flops and registers.',
			'Detecting that a bus or a set of flags is completely idle, since NOR is high only when everything is low.',
			'Building any other gate, in the same way NAND can.',
			'The Apollo Guidance Computer was famously built almost entirely from three input NOR gates.'
		],
		equivalences: [
			{ label: 'NOT from NOR', expression: '!(a | a)', equals: '!a' },
			{ label: 'OR from NOR', expression: '!(!(a | b) | !(a | b))', equals: 'a | b' },
			{ label: 'AND from NOR', expression: '!(!(a | a) | !(b | b))', equals: 'a & b' },
			{ label: 'De Morgan form', expression: '!a & !b', equals: '!(a | b)' }
		],
		inSimulator:
			'NOR is in the Logic menu with a configurable input count. Wire two of them into each other, output to input, and you have a latch you can set and reset.',
		faqs: [
			{
				q: 'How do you build an SR latch from NOR gates?',
				a: "Take two NOR gates and feed each gate's output into one input of the other. The remaining free inputs become set and reset. Raising set drives one output high and it stays there after set returns low, which is what makes it a memory element."
			},
			{
				q: 'Is NOR or NAND better for building everything?',
				a: 'Both are universal, so either works. In practice NAND is preferred in CMOS because it is slightly faster and smaller for the same drive strength, but NOR-only designs have been built, most famously the Apollo Guidance Computer.'
			}
		]
	}
];

export const gateBySlug = (slug: string) => gates.find((g) => g.slug === slug);
