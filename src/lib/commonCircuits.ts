// The standard building blocks of combinational logic. Each output is given as
// an expression, and the truth tables on the page are generated from those
// expressions; the test suite then checks each one against what the circuit is
// supposed to do arithmetically, so the reference cannot quietly go wrong.

export type CommonCircuit = {
	slug: string;
	name: string;
	tagline: string;
	/** One self-contained sentence saying what the circuit is; the lede of its page. */
	definition: string;
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
	faqs: { q: string; a: string }[];
};

export const commonCircuits: CommonCircuit[] = [
	{
		slug: 'half-adder',
		name: 'Half adder',
		tagline: 'Adds two bits. Two gates.',
		definition:
			'A half adder is a combinational circuit that adds two single bits and produces a sum bit and a carry bit, using one XOR gate for the sum and one AND gate for the carry.',
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
			'Two toggles, an XOR and an AND fed from the same two inputs, and two displays. Package it as a custom node and the full adder becomes three parts.',
		faqs: [
			{
				q: 'What is the truth table of a half adder?',
				a: 'Four rows. Inputs 00 give sum 0, carry 0; 01 and 10 give sum 1, carry 0; 11 gives sum 0, carry 1. The sum column is the XOR of the inputs and the carry column is their AND, which is the whole circuit.'
			},
			{
				q: 'Why is it called a half adder?',
				a: 'Because it does half the job of adding a column of bits: it adds the two bits in the column but has no input for a carry arriving from the column to its right. A full adder has that third input, and a half adder is what you use in the rightmost column where no carry can arrive.'
			},
			{
				q: 'How many gates does a half adder need?',
				a: 'Two, an XOR and an AND. Built from NAND gates only it takes five: four for the XOR, and although a separate AND would cost two more, the NAND of the two inputs already sits inside the XOR, so one extra NAND inverting it gives the carry.'
			}
		]
	},
	{
		slug: 'full-adder',
		name: 'Full adder',
		tagline: 'Adds two bits and a carry in.',
		definition:
			'A full adder is a combinational circuit that adds three bits, two operand bits and a carry in, and produces a sum bit and a carry out, so that copies of it can be chained one per column to add whole numbers.',
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
			'Two half adders and an OR: the first adds a and b, the second adds that sum to the carry in, and the OR combines the two carries.',
		faqs: [
			{
				q: 'What is the truth table of a full adder?',
				a: 'Eight rows, one per combination of A, B and the carry in. The sum is 1 whenever an odd number of the three inputs are 1, which is their XOR, and the carry out is 1 whenever at least two of them are, which is the majority function.'
			},
			{
				q: 'How do you build a full adder from two half adders?',
				a: 'The first half adder adds A and B. The second adds that sum to the carry in and produces the final sum. The two carries can never both be 1 at once, so an OR gate combining them gives the carry out. That is the usual textbook construction: two half adders and one OR.'
			},
			{
				q: 'How is a full adder used to add whole numbers?',
				a: 'Chain one per bit with each carry out feeding the next carry in, which is a ripple carry adder. The first column can be a half adder, since there is no carry coming in. Four full adders add two four bit numbers, and the four bit calculator in the simulator is built exactly that way.'
			}
		]
	},
	{
		slug: 'multiplexer',
		name: '2-to-1 multiplexer',
		tagline: 'Picks one of two inputs.',
		definition:
			'A multiplexer, or mux, is a combinational circuit that selects one of several data inputs and passes it to a single output, chosen by the binary value on its select lines.',
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
			'One NOT for the select, two ANDs and one OR. Watch the output follow whichever input the select points at.',
		faqs: [
			{
				q: 'What is a multiplexer used for?',
				a: 'Choosing between data sources: a processor uses one to pick which register feeds the arithmetic unit, a communications link uses one to share a single wire between several senders, and any boolean function can be built directly from one by wiring its truth table into the data inputs.'
			},
			{
				q: 'What is the boolean expression for a 2-to-1 multiplexer?',
				a: 'Out = (¬S ∧ A) ∨ (S ∧ B). When S is 0 the first term passes A and the second is blocked; when S is 1 the roles swap. A 4-to-1 mux has two select lines and four such terms, one per input.'
			},
			{
				q: 'What is the difference between a multiplexer and a demultiplexer?',
				a: 'They are mirror images. A multiplexer has many inputs and one output, and the select chooses which input gets through. A demultiplexer has one input and many outputs, and the select chooses which output the input goes to. Put one of each on either end of a wire and several signals can share it in turn.'
			}
		]
	},
	{
		slug: 'demultiplexer',
		name: '1-to-2 demultiplexer',
		tagline: 'Sends one input to one of two outputs.',
		definition:
			'A demultiplexer, or demux, is a combinational circuit that routes a single data input to one of several outputs, chosen by the binary value on its select lines, while the other outputs stay low.',
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
		buildTip: 'One NOT and two ANDs. It is a decoder with the data line ANDed into every output.',
		faqs: [
			{
				q: 'What is a demultiplexer used for?',
				a: 'Steering one signal to one of several destinations: selecting which memory bank or peripheral receives a write, unpacking a shared serial line back into separate channels, and turning a binary address into the single enable line for the addressed device.'
			},
			{
				q: 'What is the difference between a demultiplexer and a decoder?',
				a: 'A decoder raises the one output whose number matches the select input. A demultiplexer does the same, but also ANDs a data line into every output, so the chosen output carries the data rather than a constant 1. Hold the data line high and a demux is a decoder.'
			}
		]
	},
	{
		slug: 'decoder',
		name: '2-to-4 decoder',
		tagline: 'Turns a 2-bit number into one hot line.',
		definition:
			'A decoder is a combinational circuit that takes an n-bit binary number and raises exactly one of its 2ⁿ outputs, the one whose index matches the input.',
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
		buildTip: 'Two NOTs and four ANDs. Toggle the inputs and watch exactly one output light at a time.',
		faqs: [
			{
				q: 'What is a decoder used for?',
				a: "Address decoding, where the high bits of a bus address select one chip or register; driving displays and indicator lamps, one output per element; and generating the minterms of a function, since a decoder's outputs are exactly the minterms of its inputs, so any function is an OR of the right ones."
			},
			{
				q: 'What is the difference between a decoder and an encoder?',
				a: 'They are inverses. A decoder turns a binary number into a single active line, one hot out of many. An encoder turns a single active line back into its binary number. A 2-to-4 decoder and a 4-to-2 encoder undo each other.'
			},
			{
				q: 'How does a 2-to-4 decoder work?',
				a: 'Each output is one AND gate fed by the inputs in the right polarity: Y0 is ¬A ∧ ¬B, Y1 is ¬A ∧ B, Y2 is A ∧ ¬B and Y3 is A ∧ B. Two inverters and four AND gates make the whole circuit, and adding an enable input to every AND gives a decoder that can be switched off.'
			}
		]
	},
	{
		slug: 'encoder',
		name: '4-to-2 encoder',
		tagline: 'Turns one hot line back into a number.',
		definition:
			'An encoder is a combinational circuit that takes 2ⁿ input lines, of which one is active, and outputs the n-bit binary number of the active line.',
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
			'Two OR gates is the whole circuit. Making it a priority encoder, so that a higher line wins when two are high, needs one more NOT and AND here: o0 becomes I3 or (I1 and not I2).',
		faqs: [
			{
				q: 'What is an encoder used for?',
				a: 'Reading a keypad or a bank of switches where one is pressed at a time, compressing a one hot state back into a binary state number, and, as a priority encoder, resolving several simultaneous interrupt requests into the number of the most urgent one.'
			},
			{
				q: 'What is a priority encoder?',
				a: 'An encoder that gives a defined answer when more than one input is active: the highest numbered active input wins. A plain encoder simply ORs the codes of the active inputs together, which gives the wrong number whenever two active inputs have different codes, so real designs almost always add priority and a valid output that says whether any input was active at all.'
			}
		]
	},
	{
		slug: 'comparator',
		name: '1-bit comparator',
		tagline: 'Says whether two bits are equal, or which is bigger.',
		definition:
			'A comparator is a combinational circuit that takes two binary numbers and reports whether they are equal and, if not, which is greater.',
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
			'An XOR with a NOT for equality, and two ANDs with a NOT each for the other two. Check that exactly one output is ever high.',
		faqs: [
			{
				q: 'How does a 1-bit comparator work?',
				a: 'Three outputs. Equal is the XNOR of the two bits, 1 when they match. Greater is A ∧ ¬B, since the only way A can exceed B is A = 1, B = 0. Less is ¬A ∧ B. Exactly one of the three is high for any input.'
			},
			{
				q: 'How do you compare numbers with more than one bit?',
				a: 'Start at the most significant bit. If those bits differ, that decides it. If they are equal, look at the next bit down, and so on. In gates that is a chain of 1-bit comparators where each stage is only allowed to speak when every stage above it reported equal, and the equal output of the whole thing is the AND of all the per-bit equal signals.'
			},
			{
				q: 'What is a comparator used for?',
				a: 'Every conditional branch in a processor is a comparison; so is checking whether a counter has reached its target, sorting, and finding a minimum or maximum. A magnitude comparator chip such as the 7485 does four bits at once and cascades for wider numbers.'
			}
		]
	},
	{
		slug: 'parity',
		name: '3-bit parity generator',
		tagline: 'Says whether the number of 1s is odd.',
		definition:
			'A parity generator is a combinational circuit that reports whether the number of 1s among its inputs is odd, using a chain of XOR gates, so that one extra bit can be sent alongside data to catch a single flipped bit.',
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
			'The starting point for a CRC, which is the same idea run over many bits at once.',
			'The sum output of an adder, which is the parity of its three inputs.'
		],
		buildTip:
			'Two XOR gates in a chain, which is the even parity bit. Adding a NOT on the end gives odd parity instead.',
		faqs: [
			{
				q: 'What is the difference between odd and even parity?',
				a: 'With even parity the parity bit is chosen so the total number of 1s, data plus parity bit, is even; with odd parity so the total is odd. The generator is the same XOR chain either way, with a NOT on the end for odd. The receiver recomputes and compares, and a mismatch means a bit flipped in transit.'
			},
			{
				q: 'How many errors can a parity bit catch?',
				a: 'Any odd number of flipped bits, which in practice means the single bit error that is by far the most common. Two flipped bits cancel out and go unnoticed. Catching more, or finding out which bit flipped, needs a longer code such as a Hamming code or a CRC, both of which are built from the same XOR idea run over more bits.'
			},
			{
				q: "Why is parity the same as an adder's sum output?",
				a: 'Because the sum bit of a full adder is A ⊕ B ⊕ Cin, and that is 1 exactly when an odd number of the three inputs are 1. A parity generator and the sum path of an adder are the same circuit asked a different question.'
			}
		]
	},
	{
		slug: 'majority',
		name: 'Majority voter',
		tagline: 'High when at least two of three inputs are.',
		definition:
			'A majority voter is a combinational circuit whose output is 1 when more than half of its inputs are 1, so with three inputs it is 1 when at least two of them are.',
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
			'Three ANDs and one OR. It cannot be made smaller as a sum of products, which the Karnaugh map solver will confirm.',
		faqs: [
			{
				q: 'What is a majority voter used for?',
				a: 'Fault tolerance. Run three copies of a circuit and vote on their outputs, and a single failing copy is outvoted, which is triple modular redundancy as used in aircraft and spacecraft. The same function is the carry out of a full adder, and it also cleans up a noisy signal by voting over three samples.'
			},
			{
				q: 'What is the boolean expression for a 3-input majority function?',
				a: '(A ∧ B) ∨ (B ∧ C) ∨ (A ∧ C): one AND per pair of inputs, then an OR. Any pair being 1 is enough. This is the smallest sum of products form there is, which a Karnaugh map confirms, and it is exactly the carry out equation of a full adder.'
			}
		]
	},
	{
		slug: 'half-subtractor',
		name: 'Half subtractor',
		tagline: 'Subtracts one bit from another. Two gates and an inverter.',
		definition:
			'A half subtractor is a combinational circuit that subtracts one bit from another and produces a difference bit and a borrow bit, using an XOR gate for the difference and an AND gate with one inverted input for the borrow.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' }
		],
		outputs: [
			{ name: 'diff', expression: 'a ^ b', note: 'one XOR gate, the same as the half adder sum' },
			{ name: 'borrow', expression: '!a & b', note: 'borrow when taking 1 from 0' }
		],
		explanation:
			"Subtracting B from A one bit at a time has the same four cases as adding, and the difference column is the same XOR. What changes is the carry: subtraction borrows, and only one case needs it, 0 minus 1. So the borrow is 1 exactly when A is 0 and B is 1, which is ¬A ∧ B rather than the adder's A ∧ B.",
		uses: [
			'The least significant column of a subtractor, where nothing has been borrowed yet.',
			'Decrementing a value by one, which is a subtractor with the second input tied to a constant.',
			'Showing why adders and subtractors are the same circuit apart from one inverted input.'
		],
		buildTip:
			'Two toggles, an XOR for the difference, and a NOT into an AND for the borrow. Compare it to the half adder: only the NOT is new.',
		faqs: [
			{
				q: 'What is the truth table of a half subtractor?',
				a: 'Four rows. 0 minus 0 is difference 0, borrow 0; 1 minus 0 is difference 1, borrow 0; 1 minus 1 is difference 0, borrow 0; and 0 minus 1 is difference 1 with a borrow of 1, because taking 1 from 0 needs a 1 borrowed from the next column. The difference column is A ⊕ B and the borrow column is ¬A ∧ B.'
			},
			{
				q: 'What is the difference between a half adder and a half subtractor?',
				a: 'The sum and difference outputs are identical: both are XOR. The carry and borrow differ in one row. An adder carries when both inputs are 1, so the carry is A ∧ B; a subtractor borrows when A is 0 and B is 1, so the borrow is ¬A ∧ B. One inverter turns one into the other.'
			}
		]
	},
	{
		slug: 'full-subtractor',
		name: 'Full subtractor',
		tagline: 'Subtracts two bits and a borrow in.',
		definition:
			'A full subtractor is a combinational circuit that subtracts a bit and an incoming borrow from another bit, producing a difference bit and a borrow out, so that copies of it can be chained one per column to subtract whole numbers.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' },
			{ v: 'c', label: 'Bin' }
		],
		outputs: [
			{ name: 'diff', expression: 'a ^ b ^ c', note: 'two XOR gates, the same as the full adder sum' },
			{
				name: 'bout',
				expression: '(!a & b) | (!(a ^ b) & c)',
				note: 'borrow when B exceeds A, or when the borrow in meets equal bits'
			}
		],
		explanation:
			'A third input takes the borrow from the column to the right, which is what makes the subtractor chainable. The difference is the XOR of all three inputs, exactly as in the full adder. The borrow out is 1 when B alone exceeds A, or when A and B are equal and the incoming borrow has to be passed on: ¬A ∧ B ∨ ¬(A ⊕ B) ∧ Bin.',
		uses: [
			'Every column but the first of a ripple borrow subtractor.',
			'Comparing two numbers, since a subtraction that ends with a borrow out means the second number was bigger.',
			"The subtract half of an arithmetic unit, though most real designs add the two's complement instead and reuse the adder."
		],
		buildTip:
			'Two half subtractors and an OR, mirroring the full adder: the first takes B from A, the second takes the borrow in from that difference, and the OR combines the two borrows.',
		faqs: [
			{
				q: 'What is the truth table of a full subtractor?',
				a: 'Eight rows, one per combination of A, B and the borrow in. The difference is 1 whenever an odd number of the three inputs are 1, which is their XOR. The borrow out is 1 when B is 1 and A is 0, and also when A equals B and the borrow in is 1: in both cases the column has to borrow from the next one.'
			},
			{
				q: 'What is the difference between a full adder and a full subtractor?',
				a: "The sum and difference are the same XOR of three inputs. The carry out of an adder is 1 when at least two inputs are 1; the borrow out of a subtractor is 1 when B and the borrow in together outweigh A. Invert A in the adder's carry equation and you get the borrow equation, which is why one inverter and a shared XOR let an adder subtract."
			},
			{
				q: 'Why do processors not use subtractors?',
				a: "Because A minus B equals A plus the two's complement of B, and the two's complement is just every bit of B inverted with 1 added, which an adder can do by setting its first carry in to 1. One adder with an XOR on each B input therefore adds and subtracts, so a separate subtractor circuit is rarely built."
			}
		]
	},
	{
		slug: 'decoder-3-to-8',
		name: '3-to-8 decoder',
		tagline: 'Turns a 3-bit number into one hot line out of eight.',
		definition:
			'A 3-to-8 decoder is a combinational circuit that takes a three-bit binary number and raises exactly one of its eight outputs, the one whose index matches the input.',
		inputs: [
			{ v: 'a', label: 'A' },
			{ v: 'b', label: 'B' },
			{ v: 'c', label: 'C' }
		],
		outputs: [
			{ name: 'y0', expression: '!a & !b & !c', note: 'high for 000' },
			{ name: 'y1', expression: '!a & !b & c', note: 'high for 001' },
			{ name: 'y2', expression: '!a & b & !c', note: 'high for 010' },
			{ name: 'y3', expression: '!a & b & c', note: 'high for 011' },
			{ name: 'y4', expression: 'a & !b & !c', note: 'high for 100' },
			{ name: 'y5', expression: 'a & !b & c', note: 'high for 101' },
			{ name: 'y6', expression: 'a & b & !c', note: 'high for 110' },
			{ name: 'y7', expression: 'a & b & c', note: 'high for 111' }
		],
		explanation:
			'The same idea as the 2-to-4 decoder with one more input bit: each output is a single three-input AND of the inputs in the right polarity, so the eight outputs are the eight minterms of A, B and C. Three inverters and eight AND gates make the whole circuit, and this is the size that turns up as a real part, the 74138, which adds enable inputs so that two of them can be wired into a 4-to-16.',
		uses: [
			'Selecting one of eight registers, memory chips or peripherals from three address bits.',
			'Generating all the minterms of three variables at once, so any three-input function is an OR of some outputs.',
			'Converting a three bit state number into one hot signals for a state machine.'
		],
		buildTip:
			'Three NOTs and eight ANDs with three inputs each; the simulator lets an AND take three inputs directly. Wire the inputs to three toggles and watch one output at a time light as you count.',
		faqs: [
			{
				q: 'How does a 3-to-8 decoder work?',
				a: 'Each output is an AND gate that is only satisfied by one input pattern. Y5, for instance, is A ∧ ¬B ∧ C, which is 1 only for 101. Three inverters supply the complemented inputs, so the whole circuit is three NOT gates and eight three-input AND gates, and exactly one output is high at any time.'
			},
			{
				q: 'How do you make a 4-to-16 decoder from 3-to-8 decoders?',
				a: 'Use two of them and the fourth input bit as an enable: it enables the first decoder directly and the second through an inverter. Real 3-to-8 parts such as the 74138 have enable pins for exactly this purpose, and the same trick stacks any number of stages.'
			},
			{
				q: 'What is the difference between a decoder and a demultiplexer?',
				a: 'A demultiplexer is a decoder with a data input ANDed into every output, so the selected line carries the data rather than a constant 1. A decoder with an enable input is already a demultiplexer if you feed the data into the enable, which is why parts like the 74138 are sold under both names.'
			}
		]
	},
	{
		slug: 'comparator-2-bit',
		name: '2-bit comparator',
		tagline: 'Compares two 2-bit numbers: equal, greater or less.',
		definition:
			'A 2-bit magnitude comparator is a combinational circuit that takes two two-bit numbers and reports whether the first is equal to, greater than or less than the second, by comparing the high bits first and the low bits only when the high bits match.',
		inputs: [
			{ v: 'a', label: 'A1' },
			{ v: 'b', label: 'A0' },
			{ v: 'c', label: 'B1' },
			{ v: 'd', label: 'B0' }
		],
		outputs: [
			{ name: 'equal', expression: '!(a ^ c) & !(b ^ d)', note: 'both bit pairs match' },
			{
				name: 'greater',
				expression: '(a & !c) | (!(a ^ c) & b & !d)',
				note: 'A wins on the high bit, or ties it and wins on the low'
			},
			{
				name: 'less',
				expression: '(!a & c) | (!(a ^ c) & !b & d)',
				note: 'B wins on the high bit, or ties it and wins on the low'
			}
		],
		explanation:
			'Comparing two bits at a time is the 1-bit comparator twice, with a rule for combining them: the high bits decide unless they are equal, in which case the low bits decide. Equality is the AND of the two per-bit XNORs. Greater is "A1 beats B1" or "the high bits tie and A0 beats B0", and less is the mirror image. Widening to more bits adds one more term per bit, each guarded by every tie above it.',
		uses: [
			'Branch decisions on small fields such as priority levels or opcodes.',
			'Detecting that a 2-bit counter has passed a threshold.',
			'The building block of wider comparators, which chain these with the equal output of each stage enabling the next.'
		],
		buildTip:
			'Two XNORs for the per-bit equality, then an AND for equal and two AND-OR networks for greater and less. Check that exactly one of the three outputs is high for every one of the sixteen input combinations.',
		faqs: [
			{
				q: 'How does a 2-bit comparator work?',
				a: 'It compares the high bits first. If A1 and B1 differ, that settles it: A is greater when A1 is 1, less when B1 is 1. If they are equal, the low bits decide the same way. Equal means both pairs match, which is the AND of two XNOR gates. Exactly one of the three outputs is high for any input.'
			},
			{
				q: 'How do you build a 4-bit comparator?',
				a: 'Extend the same rule: A is greater if it wins on bit 3, or ties on bit 3 and wins on bit 2, or ties on bits 3 and 2 and wins on bit 1, and so on down to bit 0. Equal is the AND of all four per-bit XNORs. The 7485 is exactly this circuit for four bits, with cascade inputs so several can be chained for wider numbers.'
			}
		]
	}
];

export const circuitBySlug = (slug: string) => commonCircuits.find((c) => c.slug === slug);
