// Reference data for the per-gate pages. Every boolean claim here (the
// equivalences especially) is checked against the expression engine in the
// test suite, so the published identities cannot drift from the truth.

export type GateEquivalence = { label: string; expression: string; equals: string };

/**
 * A row-by-row contrast with another gate, for the comparison table. `differ`
 * lists the 2-input rows (00 = 0 to 11 = 3) where the two outputs disagree,
 * and every two-digit row the note mentions must be one of them.
 */
export type GateContrast = { slug: string; differ: number[]; note: string };

/** The 3-input version of a gate that takes more than two inputs. */
export type WideGate = {
	/** The expression the engine parses for the 3-input truth table. */
	source: string;
	/** How many inputs are 1 on the rows where the output is 1. */
	highWhen: number[];
	explanation: string;
	/** Two 2-input gates of this kind wired in a chain, and what that really computes. */
	chained: { expression: string; equals: string };
	/** How to get the true 3-input gate from 2-input parts. */
	fromTwo: string;
	/** A different function that goes by the same name in some texts or symbols. */
	alternative?: { label: string; expression: string; note: string };
};

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
	/** Everyday and engineering things that behave like this gate. */
	examples: string[];
	/** What the ANSI and IEC symbols look like and why. */
	symbolNote: string;
	wide?: WideGate;
	contrasts: GateContrast[];
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
		examples: [
			'A two-hand control on a machine press only runs the press while both buttons are held, so neither hand can be near the tool. The safety standards add a timing rule, but the core of it works like an AND gate.',
			"A safe deposit box that needs both the bank's key and the customer's key opens only when both are turned: an AND of the two keys.",
			'Many cars with a push-button start only start the engine when the button is pressed and the brake pedal is held down.',
			'A washing machine starts its cycle only when the door is shut and the start button is pressed.'
		],
		symbolNote:
			'The ANSI symbol is a D shape: a flat back where the inputs enter and a round front leading to the output. The IEC symbol is a rectangle labelled &, the ampersand for "and". Neither has a bubble on the output, since nothing is inverted.',
		wide: {
			source: 'a & b & c',
			highWhen: [3],
			explanation:
				'A 3-input AND gate outputs 1 only when all three inputs are 1, which is one row out of eight. AND is associative, so two 2-input AND gates in a chain give exactly the same table, and a wide AND can be built either way.',
			chained: { expression: '(a & b) & c', equals: 'a & b & c' },
			fromTwo: '(a & b) & c'
		},
		contrasts: [
			{
				slug: 'or',
				differ: [1, 2],
				note: 'AND and OR agree when the two inputs are equal, and disagree on 01 and 10, where AND gives 0 and OR gives 1.'
			},
			{ slug: 'nand', differ: [0, 1, 2, 3], note: 'NAND is the exact opposite of AND on every row.' }
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
				q: 'What does an AND gate do?',
				a: 'It outputs 1 only when all of its inputs are 1. If any input is 0 the output is 0, so a 2-input AND gate is 1 on just one of its four rows, 11.'
			},
			{
				q: 'What is the symbol for an AND gate?',
				a: 'In the ANSI style it is a D shape, with a flat back for the inputs and a round front for the output. In the IEC style it is a rectangle labelled &.'
			},
			{
				q: 'Can an AND gate have more than two inputs?',
				a: 'Yes. An AND gate of any width outputs 1 only when every input is 1. In the simulator the input count is an option on the node, and in hardware three and four input AND gates are standard parts.'
			},
			{
				q: 'What is the difference between AND and NAND?',
				a: 'NAND is AND with the output inverted. Where AND gives 1 only when all inputs are 1, NAND gives 0 only in that case and 1 everywhere else.'
			},
			{
				q: 'What is an example of an AND gate in everyday life?',
				a: "A two-hand control on a machine press, which only runs while both buttons are held, works like an AND gate. So does a safe deposit box that needs both the bank's key and the customer's key."
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
		examples: [
			'A doorbell with a push button at the front door and another at the back, wired in parallel, rings when either button is pressed.',
			'The interior light in many cars comes on when any door is open, since each door switch can light it on its own.',
			'A burglar alarm goes off when any one of its sensors is triggered, or several at once.'
		],
		symbolNote:
			'The ANSI OR symbol has a curved back and a pointed front, a little like a shield. The IEC symbol is a rectangle labelled ≥1, meaning the output is 1 when at least one input is 1. There is no bubble, since nothing is inverted.',
		wide: {
			source: 'a | b | c',
			highWhen: [1, 2, 3],
			explanation:
				'A 3-input OR gate outputs 1 when at least one of the three inputs is 1, so the all-zero row is the only one that gives 0. OR is associative too, so a chain of 2-input OR gates gives the same table.',
			chained: { expression: '(a | b) | c', equals: 'a | b | c' },
			fromTwo: '(a | b) | c'
		},
		contrasts: [
			{
				slug: 'xor',
				differ: [3],
				note: 'OR and XOR differ only when both inputs are 1: OR gives 1 there and XOR gives 0. That one row is the difference between inclusive and exclusive or.'
			},
			{ slug: 'nor', differ: [0, 1, 2, 3], note: 'NOR is the exact opposite of OR on every row.' }
		],
		equivalences: [
			{ label: 'From NAND gates', expression: '!(!(a & a) & !(b & b))', equals: 'a | b' },
			{ label: 'From NOR gates', expression: '!(!(a | b) | !(a | b))', equals: 'a | b' },
			{ label: 'De Morgan form', expression: '!(!a & !b)', equals: 'a | b' }
		],
		inSimulator: 'OR sits in the Logic menu next to AND, and takes a configurable number of inputs in the same way.',
		faqs: [
			{
				q: 'What does an OR gate do?',
				a: 'It outputs 1 when at least one of its inputs is 1, and 0 only when every input is 0. A 2-input OR gate is 1 on three of its four rows.'
			},
			{
				q: 'What is the symbol for an OR gate?',
				a: 'In the ANSI style it is a shape with a curved back and a pointed front. In the IEC style it is a rectangle labelled ≥1.'
			},
			{
				q: 'How many inputs can an OR gate have?',
				a: 'Two or more. A wide OR gate outputs 1 when any input is 1, and a chain of 2-input OR gates gives the same result.'
			},
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
			'Turning an active-low signal into an active-high one, or the other way round.',
			'Completing a set: AND and OR alone cannot express everything, but add NOT and you can express any boolean function at all.',
			'Building a ring oscillator, where an odd number of inverters in a loop never settles and oscillates instead.',
			'Producing the complement of a variable for a sum of products expression.'
		],
		examples: [
			'A fridge light is switched by a button that the closed door holds in, so the light is on when the door is not closed.',
			'A dusk-to-dawn outdoor light switches on when its sensor does not see daylight.',
			'A normally closed stop button carries current until it is pressed, so the circuit is on exactly when the button is not pressed.'
		],
		symbolNote:
			'The ANSI symbol is a triangle pointing towards the output, with a small circle, the bubble, on its tip. The triangle alone is a buffer, which passes its input through unchanged; the bubble is the part that means inversion. The IEC symbol is a rectangle labelled 1, with the same bubble on the output.',
		contrasts: [
			{
				slug: 'nand',
				differ: [2],
				note: 'NOT a differs from NAND only on row 10, and agrees with it whenever a and b are equal. That is why a NAND with both inputs tied together is an inverter.'
			},
			{
				slug: 'nor',
				differ: [1],
				note: 'NOT a differs from NOR only on row 01, so a NOR with its inputs tied together is an inverter too.'
			}
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
				q: 'What does a NOT gate do?',
				a: 'It outputs the opposite of its single input: 1 becomes 0 and 0 becomes 1.'
			},
			{
				q: 'What is the symbol for a NOT gate?',
				a: 'In the ANSI style it is a triangle with a small circle on its output, the circle being what means inversion. In the IEC style it is a rectangle labelled 1 with the same circle on the output.'
			},
			{
				q: 'Can a NOT gate have two inputs?',
				a: 'No. A NOT gate always has exactly one input. An inverted combination of two signals is a NAND, NOR or XNOR gate.'
			},
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
		inputs: 'many',
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
		examples: [
			'Two-way light switches on a staircase: flipping either switch changes the light. With the switch positions labelled the right way round, the light is on when the two switches disagree.',
			'RAID 5 disk arrays store the XOR of the data blocks as a parity block. If one disk fails, XOR of everything that is left rebuilds its contents.',
			'A simple XOR cipher combines each bit of a message with a key bit; applying the same key again recovers the message, because a XOR k XOR k is a.',
			'Old graphics systems drew cursors and selection boxes in XOR mode, so drawing the same shape a second time erased it and restored the picture underneath.'
		],
		symbolNote:
			'The ANSI XOR symbol is the OR shape with a second curved line drawn behind its back, across the inputs. That extra line is the only difference from OR, so it is worth looking for on a busy schematic. The IEC symbol is a rectangle labelled =1: the output is 1 when exactly one input is 1.',
		wide: {
			source: 'a ^ b ^ c',
			highWhen: [1, 3],
			explanation:
				'With three inputs, an XOR gate outputs 1 when an odd number of inputs are 1, which makes it a parity gate. That is what a chain of 2-input XOR gates gives, since each one flips the running result whenever its other input is 1, and it is what multi-input XOR parts and hardware description languages such as Verilog compute.',
			chained: { expression: '(a ^ b) ^ c', equals: 'a ^ b ^ c' },
			fromTwo: '(a ^ b) ^ c',
			alternative: {
				label: 'Exactly one',
				expression: '(a & !b & !c) | (!a & b & !c) | (!a & !b & c)',
				note: 'Some texts define exclusive or for more than two inputs as "exactly one input is 1" instead. That one-hot function is a different gate. The IEC label =1 strictly means exactly one, which is why a multi-input parity gate is labelled 2k+1 in IEC symbols.'
			}
		},
		contrasts: [
			{
				slug: 'or',
				differ: [3],
				note: 'XOR and OR differ only when both inputs are 1, where OR gives 1 and XOR gives 0. Mixing them up changes just that one row, which is easy to miss.'
			},
			{ slug: 'xnor', differ: [0, 1, 2, 3], note: 'XNOR is the exact opposite of XOR on every row.' }
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
				q: 'What does an XOR gate do?',
				a: 'It outputs 1 when its two inputs differ and 0 when they are the same. Put another way, the output is 1 when exactly one of the two inputs is 1.'
			},
			{
				q: 'What is the truth table of a 2-input XOR gate?',
				a: '0 XOR 0 = 0, 0 XOR 1 = 1, 1 XOR 0 = 1 and 1 XOR 1 = 0. The output is 1 on the two rows where the inputs differ.'
			},
			{
				q: 'What is the symbol for an XOR gate?',
				a: 'In the ANSI style it is the OR symbol with an extra curved line across the inputs. In the IEC style it is a rectangle labelled =1.'
			},
			{
				q: 'How many inputs can an XOR gate have?',
				a: 'Two is the usual case, but wider XOR gates exist. With more than two inputs the standard meaning is parity: the output is 1 when an odd number of inputs are 1, which is also what a chain of 2-input XOR gates gives.'
			},
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
			'NAND is functionally complete: every other gate can be built from NAND gates alone, so an entire processor could in principle be made of nothing else. That is not just a curiosity. In CMOS a NAND and a NOR both take four transistors, but the NAND puts its series devices on the fast side and its slow ones in parallel, so for the same drive strength it ends up smaller and quicker. That makes NAND one of the cheapest gates a chip can use, so logic is often mapped onto it; only the inverter, at two transistors, is smaller still.',
		uses: [
			'Building any other gate, which is why NAND is the workhorse of real logic families.',
			'Cross-coupling two NAND gates gives an SR latch, the simplest circuit that remembers a bit.',
			'Replacing an AND followed by a NOT with a single, faster gate.'
		],
		examples: [
			'A "door open" warning light that stays lit until every door reports shut: the light is on when not all the doors are closed, which is a NAND of the door sensors.',
			"NAND flash, the memory in SSDs and USB sticks, is named after its layout: its cells are connected in series, like the transistors in a NAND gate's pull-down network. It is a name for the wiring; the memory array is not built from NAND gates.",
			'The 7400, the first part number in the classic 7400 logic family, holds four 2-input NAND gates in one package.',
			'The Nand to Tetris course builds a working computer, step by step, starting from nothing but the NAND gate.'
		],
		symbolNote:
			'The ANSI NAND symbol is the AND shape with a bubble on the output. The bubble means inversion, so the symbol reads as AND followed by NOT. The IEC version is the AND rectangle, labelled &, with the same bubble on its output.',
		wide: {
			source: '!(a & b & c)',
			highWhen: [0, 1, 2],
			explanation:
				'A 3-input NAND gate is the inverse of a 3-input AND: its output is 0 only when all three inputs are 1. It is not the same as feeding one 2-input NAND into another, because the first inversion gets carried into the second gate. To widen a NAND from 2-input parts, AND the first two inputs and feed that into a NAND with the third.',
			chained: { expression: '!(!(a & b) & c)', equals: '(a & b) | !c' },
			fromTwo: '!((a & b) & c)'
		},
		contrasts: [
			{ slug: 'and', differ: [0, 1, 2, 3], note: 'NAND is the exact opposite of AND on every row.' },
			{
				slug: 'nor',
				differ: [1, 2],
				note: 'NAND and NOR agree when the two inputs are equal, and differ on 01 and 10, where NAND gives 1 and NOR gives 0.'
			}
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
				q: 'What does a NAND gate do?',
				a: 'It outputs 0 only when all of its inputs are 1, and 1 in every other case. It is an AND gate followed by a NOT, combined into one gate.'
			},
			{
				q: 'What is the symbol for a NAND gate?',
				a: 'The AND symbol with a small circle, the inversion bubble, on the output. In the IEC style it is a rectangle labelled & with the bubble on its output.'
			},
			{
				q: 'Why is NAND called a universal gate?',
				a: 'Because NOT, AND and OR can all be built from NAND gates alone, and those three are enough to express any boolean function. So any circuit at all can be rewritten using only NAND gates. NOR is universal for the same reason.'
			},
			{
				q: 'What is the difference between NAND and NOR?',
				a: "NAND is an inverted AND: it outputs 0 only when every input is 1. NOR is an inverted OR: it outputs 1 only when every input is 0. So NAND is 1 on three of its four rows and NOR on just one. Invert every input and the output of a NAND and you get a NOR, which is De Morgan's law in gate form. Both are universal."
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
		examples: [
			'An "all clear" lamp on an alarm panel that is lit only while no alarm input is active: any one alarm turns it off.',
			'NOR flash memory, which holds the firmware of many motherboards and embedded devices, is named after the NOR-like way its cells are wired in parallel.',
			'The 7402 in the classic 7400 logic family holds four 2-input NOR gates in one package.'
		],
		symbolNote:
			'The ANSI NOR symbol is the OR shape, curved back and pointed front, with a bubble on the output. The bubble means inversion, so the symbol reads as OR followed by NOT. The IEC version is the OR rectangle, labelled ≥1, with a bubble on its output.',
		wide: {
			source: '!(a | b | c)',
			highWhen: [0],
			explanation:
				'A 3-input NOR gate is the inverse of a 3-input OR: its output is 1 only when all three inputs are 0. Feeding one 2-input NOR into another does not give this, because the first inversion gets carried into the second gate. To widen a NOR from 2-input parts, OR the first two inputs and feed that into a NOR with the third.',
			chained: { expression: '!(!(a | b) | c)', equals: '(a | b) & !c' },
			fromTwo: '!((a | b) | c)'
		},
		contrasts: [
			{ slug: 'or', differ: [0, 1, 2, 3], note: 'NOR is the exact opposite of OR on every row.' },
			{
				slug: 'xnor',
				differ: [3],
				note: 'NOR and XNOR are both 1 when both inputs are 0, and differ only on 11, where XNOR gives 1 and NOR gives 0.'
			}
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
				q: 'What does a NOR gate do?',
				a: 'It outputs 1 only when all of its inputs are 0. If any input is 1 the output is 0. It is an OR gate followed by a NOT.'
			},
			{
				q: 'What is the symbol for a NOR gate?',
				a: 'The OR symbol, curved back and pointed front, with an inversion bubble on the output. In the IEC style it is a rectangle labelled ≥1 with the bubble on its output.'
			},
			{
				q: 'Why is NOR called a universal gate?',
				a: 'Because NOT, OR and AND can each be built from NOR gates alone, and those three can express any boolean function. So any circuit at all can be rewritten using only NOR gates.'
			},
			{
				q: 'How do you build an SR latch from NOR gates?',
				a: "Take two NOR gates and feed each gate's output into one input of the other. The remaining free inputs become set and reset. Raising set drives one output high and it stays there after set returns low, which is what makes it a memory element."
			},
			{
				q: 'What is the difference between NOR and NAND?',
				a: "NOR outputs 1 only when all inputs are 0; NAND outputs 0 only when all inputs are 1. So NOR is 1 on just one of its four rows and NAND on three. Invert every input and the output of a NAND and you get a NOR, which is De Morgan's law in gate form. Both are universal."
			},
			{
				q: 'Is NOR or NAND better for building everything?',
				a: 'Both are universal, so either works. In practice NAND is preferred in CMOS because it is slightly faster and smaller for the same drive strength, but NOR-only designs have been built, most famously the Apollo Guidance Computer.'
			}
		]
	},
	{
		slug: 'xnor',
		name: 'XNOR',
		symbol: '¬(a ⊻ b)',
		expression: "(a ⊕ b)'",
		source: '!(a ^ b)',
		inputs: 'many',
		tagline: 'High when its two inputs agree.',
		outputHigh: 'its two inputs are equal',
		behaviour:
			'An exclusive NOR gate outputs 1 when its two inputs are the same, both 0 or both 1, and 0 when they differ. It is an XOR gate with the output inverted, which makes it a one bit equality detector. Because of that it is also called the equivalence gate, and written a ≡ b or a ⊙ b.',
		intuition:
			'Where XOR asks "are these two different?", XNOR asks "are these two the same?". That is the question an equality comparator, such as the tag match in a cache, asks of every pair of bits, so it is a row of XNOR gates feeding an AND. XNOR is not universal though: chain XORs and XNORs however you like and the result still only ever counts whether an odd or even number of some of its inputs are high, so AND and OR are out of reach without another gate.',
		uses: [
			'One bit of an equality comparator: a XNOR per bit pair, then an AND across them, says whether two words are identical.',
			'The final stage of an even parity checker: XOR the data bits together, then XNOR the result with the received parity bit: the output is high when they match, so a 0 means an odd number of bits were flipped. Two flipped bits cancel out and go unnoticed, which is the limit of a single parity bit.',
			'A controlled buffer: XNOR a signal with 1 to pass it unchanged, or with 0 to invert it, the opposite sense to XOR.',
			'Counting matching bits between two patterns, which is how correlators and binary neural networks score a match: XNOR each pair, then count the 1s.'
		],
		examples: [
			'Two-way light switches on a staircase, read the other way round from XOR: label the switch positions so the light is on when both switches point the same way, and the light is the XNOR of the two switches.',
			'A system with two identical sensors, such as the duplicated sensors in many safety systems, treats their readings as healthy while they agree and flags a fault when they differ. The "agree" signal is an XNOR.',
			'Content-addressable memory, used in network routers to look up addresses, compares a search word against every stored word at once, and each bit of that comparison is a match test like XNOR.'
		],
		symbolNote:
			'The ANSI XNOR symbol is the XOR shape, OR with the extra curved line at the inputs, plus a bubble on the output to mean inversion. IEC draws it as a rectangle labelled =, the sign for logic identity: the output is 1 when the inputs are equal. A =1 rectangle with an inverted output is also seen, and for two inputs the two mean the same thing.',
		wide: {
			source: '!(a ^ b ^ c)',
			highWhen: [0, 2],
			explanation:
				'A 3-input XNOR gate is the inverse of a 3-input XOR: its output is 1 when an even number of inputs are 1, counting none as even. That makes it an even parity gate. Chaining two 2-input XNOR gates does not give this: the two inversions cancel, so a XNOR b XNOR c is the same as a XOR b XOR c, the odd parity function. To build the even parity version, chain XOR gates and invert once at the end.',
			chained: { expression: '!(!(a ^ b) ^ c)', equals: 'a ^ b ^ c' },
			fromTwo: '!((a ^ b) ^ c)',
			alternative: {
				label: 'All equal',
				expression: '(a & b & c) | (!a & !b & !c)',
				note: 'The IEC label = means all inputs are equal. For two inputs that is XNOR, but with three it is a different function, 1 only for 000 and 111.'
			}
		},
		contrasts: [
			{ slug: 'xor', differ: [0, 1, 2, 3], note: 'XNOR is the exact opposite of XOR on every row.' },
			{
				slug: 'and',
				differ: [0],
				note: 'XNOR is AND with one extra 1, on row 00. AND needs both inputs to be 1, while XNOR only needs them to be equal, which makes XNOR the equality gate.'
			}
		],
		equivalences: [
			{ label: 'XOR, inverted', expression: '!(a ^ b)', equals: '(a & b) | (!a & !b)' },
			{ label: 'Sum of products', expression: '(a & b) | (!a & !b)', equals: '!(a ^ b)' },
			{ label: 'Product of sums', expression: '(a | !b) & (!a | b)', equals: '!(a ^ b)' },
			{ label: 'XOR with one input inverted', expression: 'a ^ !b', equals: '!(a ^ b)' },
			{
				label: 'From NAND gates only',
				expression: '!(!(a & !(a & !(b & b))) & !(!(b & b) & !(a & !(b & b))))',
				equals: '!(a ^ b)'
			}
		],
		inSimulator:
			'There is no XNOR node in the simulator. Place an XOR and feed its output into a NOT, or put the NOT on one of the XOR inputs instead, which gives the same table. Package the pair as a custom node and it behaves like a native gate.',
		faqs: [
			{
				q: 'What is the difference between XOR and XNOR?',
				a: 'They are opposites on every row. XOR outputs 1 when its two inputs differ; XNOR outputs 1 when they are the same. XNOR is exactly an XOR gate followed by a NOT gate, which is what the N in the name and the bubble on the symbol mean.'
			},
			{
				q: 'What is the symbol for an XNOR gate?',
				a: 'In the ANSI style it is the XOR symbol with an inversion bubble on the output. In the IEC style it is a rectangle labelled =, or a =1 rectangle with an inverted output.'
			},
			{
				q: 'What does an XNOR gate do with three inputs?',
				a: 'A 3-input XNOR gate is the inverse of a 3-input XOR: it outputs 1 when an even number of inputs are 1, including none. Two 2-input XNOR gates in a chain give odd parity instead, because the two inversions cancel.'
			},
			{
				q: 'Is XNOR a universal gate?',
				a: 'No. NAND and NOR can each build every other gate, but XNOR cannot, and neither can XOR. Any circuit made only of XOR and XNOR gates still only reports whether an even or odd number of some of its inputs are high, however it is wired, so it can never behave like an AND or an OR. Add an AND gate to XOR and XNOR together and the set becomes complete: XNOR of a signal with itself supplies a constant 1, and XOR with 1 is NOT.'
			},
			{
				q: 'How many NAND gates does XNOR need?',
				a: 'Five. XOR takes four NAND gates, and XNOR is XOR with either the output or one of the inputs inverted, which is one more NAND with its inputs tied together. That is one more than XOR and three more than AND, so in NAND-only designs an equality test is comparatively expensive.'
			},
			{
				q: 'Why is XNOR called the equivalence gate?',
				a: 'Because its output is 1 precisely when the two inputs are equivalent, both 0 or both 1. In logic notation that is a ≡ b or a ⊙ b, and in a comparator that is the "these two bits match" signal.'
			}
		]
	}
];

export const gateBySlug = (slug: string) => gates.find((g) => g.slug === slug);
