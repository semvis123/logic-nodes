// The standard building blocks of combinational logic. Each output is given as
// an expression, and the truth tables on the page are generated from those
// expressions; the test suite then checks each one against what the circuit is
// supposed to do arithmetically, so the reference cannot quietly go wrong.

export type CommonCircuit = {
	slug: string;
	name: string;
	tagline: string;
	/**
	 * Input pins in table order. `v` is the single letter the expressions use,
	 * because adjacent letters mean AND in this notation, so a pin cannot be
	 * called "cin". `label` is what the tables show.
	 */
	inputs: { v: string; label: string }[];
	outputs: { name: string; expression: string; note: string }[];
	explanation: string;
	uses: string[];
	buildTip: string;
};

export const commonCircuits: CommonCircuit[] = [
	{
		slug: 'half-adder',
		name: 'Half adder',
		tagline: 'Adds two bits. Two gates.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' }
		],
		outputs: [
			{ name: 'sum', expression: 'a ^ b', note: 'one XOR gate' },
			{ name: 'carry', expression: 'a & b', note: 'one AND gate' }
		],
		explanation:
			'Adding two single bits has four cases, and the two output columns turn out to be gates you already know. The sum is 1 when exactly one input is 1, which is XOR. The carry is 1 only when both are, which is AND. It is called a half adder because it has nowhere to accept a carry coming in from the column to its right.',
		uses: [
			'The least significant column of an adder, where there is no carry in.',
			'Incrementing a value by one, which is an adder with the second input tied to a constant.',
			'A first custom node to build, because everything larger is made of these.'
		],
		buildTip:
			'Two toggles, an XOR and an AND fed from the same two inputs, and two displays. Package it as a custom node and the full adder becomes three parts.'
	},
	{
		slug: 'full-adder',
		name: 'Full adder',
		tagline: 'Adds two bits and a carry in.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' },
			{ v: 'c', label: 'Cin' }
		],
		outputs: [
			{ name: 'sum', expression: 'a ^ b ^ c', note: 'two XOR gates in a chain' },
			{
				name: 'cout',
				expression: '(a & b) | (c & (a ^ b))',
				note: 'carry out when both inputs are high, or when the carry in meets exactly one'
			}
		],
		explanation:
			'A third input lets the carry from the previous column join in, which is what makes the adder chainable. The sum is the XOR of all three inputs, and the carry out is high whenever at least two of the three are, so it is really a majority function wearing a different hat.',
		uses: [
			'Every column but the first of a ripple carry adder.',
			'Subtraction, by inverting one operand and setting the first carry in to 1.',
			'Counters and accumulators, which are adders with a register on the output.'
		],
		buildTip:
			'Two half adders and an OR: the first adds a and b, the second adds that sum to the carry in, and the OR combines the two carries.'
	},
	{
		slug: 'multiplexer',
		name: '2-to-1 multiplexer',
		tagline: 'Picks one of two inputs.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' },
			{ v: 's', label: 'S' }
		],
		outputs: [{ name: 'out', expression: '(!s & a) | (s & b)', note: 's chooses a when 0, b when 1' }],
		explanation:
			'A multiplexer is a switch made of gates. The select line enables one of two AND gates, and an OR merges them, so exactly one input reaches the output at a time. Widen the select to n bits and you can choose between 2^n inputs.',
		uses: [
			'Choosing between two data sources, which is how a processor picks an operand.',
			'Implementing any boolean function directly, by wiring the truth table into the data inputs.',
			'Sharing one bus between several senders, one at a time.'
		],
		buildTip:
			'One NOT for the select, two ANDs and one OR. Watch the output follow whichever input the select points at.'
	},
	{
		slug: 'demultiplexer',
		name: '1-to-2 demultiplexer',
		tagline: 'Sends one input to one of two outputs.',
		inputs: [
			{ v: 'd', label: 'D' },
			{ v: 's', label: 'S' }
		],
		outputs: [
			{ name: 'y0', expression: '!s & d', note: 'the data when s is 0' },
			{ name: 'y1', expression: 's & d', note: 'the data when s is 1' }
		],
		explanation:
			'The mirror image of a multiplexer. One data line goes in, the select decides which output it comes out of, and the other output stays low. Chain them and one signal can be routed to any of many destinations.',
		uses: [
			'Routing a signal to one of several destinations, such as picking a memory bank.',
			'Turning a binary address into an enable line for the addressed device.',
			'Serial to parallel conversion, together with some storage.'
		],
		buildTip: 'One NOT and two ANDs. It is a decoder with the data line ANDed into every output.'
	},
	{
		slug: 'decoder',
		name: '2-to-4 decoder',
		tagline: 'Turns a 2-bit number into one hot line.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' }
		],
		outputs: [
			{ name: 'y0', expression: '!a & !b', note: 'high for 00' },
			{ name: 'y1', expression: '!a & b', note: 'high for 01' },
			{ name: 'y2', expression: 'a & !b', note: 'high for 10' },
			{ name: 'y3', expression: 'a & b', note: 'high for 11' }
		],
		explanation:
			'A decoder raises exactly one output, the one whose number matches the input. Each output is a single AND of the inputs in the right polarities, which means a decoder is really all the minterms of its inputs made available at once.',
		uses: [
			'Address decoding: picking which chip or register a bus address refers to.',
			'Driving a display, where each output lights one element.',
			'Building any function at all, by ORing together the minterms you want.'
		],
		buildTip: 'Two NOTs and four ANDs. Toggle the inputs and watch exactly one output light at a time.'
	},
	{
		slug: 'encoder',
		name: '4-to-2 encoder',
		tagline: 'Turns one hot line back into a number.',
		inputs: [
			{ v: 'a', label: 'I0' },
			{ v: 'b', label: 'I1' },
			{ v: 'c', label: 'I2' },
			{ v: 'd', label: 'I3' }
		],
		outputs: [
			{ name: 'o1', expression: 'c | d', note: 'the high bit: I2 or I3' },
			{ name: 'o0', expression: 'b | d', note: 'the low bit: I1 or I3' }
		],
		explanation:
			'The reverse of a decoder: four lines in, a two bit number out saying which one is high. It assumes exactly one input is active. If two are, the output is the OR of their codes rather than either of them, which is why real designs use a priority encoder that picks the highest instead. Note also that all zeros and I0 alone both give 00, so a real encoder adds a valid output to tell them apart.',
		uses: [
			'Reading a keypad, where one key is down at a time.',
			'Interrupt handling, usually as a priority encoder so simultaneous requests resolve.',
			'Compressing a one hot state register back into a binary state number.'
		],
		buildTip:
			'Two OR gates is the whole circuit. Making it a priority encoder, so that a higher line wins when two are high, needs one more NOT and AND here: o0 becomes I3 or (I1 and not I2).'
	},
	{
		slug: 'comparator',
		name: '1-bit comparator',
		tagline: 'Says whether two bits are equal, or which is bigger.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' }
		],
		outputs: [
			{ name: 'equal', expression: '!(a ^ b)', note: 'XNOR: high when they match' },
			{ name: 'greater', expression: 'a & !b', note: 'a is 1 and b is 0' },
			{ name: 'less', expression: '!a & b', note: 'b is 1 and a is 0' }
		],
		explanation:
			'Comparing one bit needs three answers, and exactly one of them is true at any time. Equality is just XOR inverted, since XOR asks whether the inputs differ. Widening it to several bits means comparing from the most significant end and only looking further down when the bits so far are equal.',
		uses: [
			'Testing two values for equality, which a processor does on every branch.',
			'Sorting networks and min or max circuits.',
			'Detecting that a counter has reached a target value.'
		],
		buildTip:
			'An XOR with a NOT for equality, and two ANDs with a NOT each for the other two. Check that exactly one output is ever high.'
	},
	{
		slug: 'parity',
		name: '3-bit parity generator',
		tagline: 'Says whether the number of 1s is odd.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' },
			{ v: 'c', label: 'C' }
		],
		outputs: [{ name: 'odd', expression: 'a ^ b ^ c', note: 'a chain of XOR gates' }],
		explanation:
			'XOR gates chained together answer one question: is the number of high inputs odd? Send that bit along with the data and the receiver can recompute it. If the two disagree, something flipped on the way, which catches any single bit error.',
		uses: [
			'Error detection on serial links and older memory buses.',
			'Building a checksum, which is parity generalised to more bits.',
			'The sum output of an adder, which is the parity of its three inputs.'
		],
		buildTip: 'Two XOR gates in a chain. Adding a NOT gives even parity instead.'
	},
	{
		slug: 'majority',
		name: 'Majority voter',
		tagline: 'High when at least two of three inputs are.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' },
			{ v: 'c', label: 'C' }
		],
		outputs: [{ name: 'out', expression: '(a & b) | (b & c) | (a & c)', note: 'one AND per pair, then OR' }],
		explanation:
			'Three inputs vote and the majority wins. It is the same function as the carry out of a full adder, which is worth noticing: adding three bits produces a carry exactly when at least two of them are 1.',
		uses: [
			'Redundant systems, where three copies of a circuit vote so one failure is outvoted.',
			'The carry path of an adder.',
			'Smoothing a noisy signal by voting over three samples.'
		],
		buildTip:
			'Three ANDs and one OR. It cannot be made smaller as a sum of products, which the Karnaugh map solver will confirm.'
	}
];

export const circuitBySlug = (slug: string) => commonCircuits.find((c) => c.slug === slug);
