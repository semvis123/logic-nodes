// The learning roadmap: every page on the site, in the order to learn it.
//
// The /learn page is a hands-on build, eight steps to a working adder. This is
// the map around it: where a complete beginner starts, what each stage is for
// in plain words, and which page to read next. The order is the dependency
// order of the ideas, not the order the pages were written in.
//
// Kept as data rather than markup so a test can check that every link here
// still resolves, and that no page on the site has been left off the map.

export interface RoadmapPage {
	href: string;
	label: string;
	/** Why this page, at this point, in one sentence. */
	why: string;
}

export interface Stage {
	id: string;
	title: string;
	/** The idea of the stage, in plain words: what it is and why it matters. */
	summary: string[];
	pages: RoadmapPage[];
	/** What you should be able to do before moving on. */
	checkpoint: string;
}

export const stages: Stage[] = [
	{
		id: 'bits',
		title: 'Bits and binary numbers',
		summary: [
			'A computer has no digits inside it, only wires that are either on or off. Call on 1 and off 0 and you have a bit, the smallest thing a digital circuit can hold. Everything on this site is about turning some bits into other bits.',
			'Put bits side by side and you can count with them: 0, 1, 10, 11, 100, exactly like ordinary counting but with only two digits to work with. Four bits count from 0 to 15, eight bits from 0 to 255. That is all a binary number is.'
		],
		pages: [
			{
				href: '/learn#signals',
				label: 'One wire, two values',
				why: 'The first step of the hands-on path: what a signal is, and how the simulator draws it.'
			},
			{
				href: '/binary-converter',
				label: 'Binary converter',
				why: 'Type a number and watch it become bits. Read the section on bit width: it explains why a circuit always has a fixed number of wires.'
			},
			{
				href: '/glossary',
				label: 'Glossary',
				why: 'Keep it open in another tab. Every term on the site is defined here in one paragraph.'
			}
		],
		checkpoint: 'You can turn 13 into 1101 and 1010 back into 10 in your head, and say how many values 8 bits can hold.'
	},
	{
		id: 'gates',
		title: 'The seven gates',
		summary: [
			'A gate is a tiny machine with one rule. It looks at its inputs and decides its output. AND says "both". OR says "at least one". NOT says "the opposite". Those three are enough to build anything; the other four are shortcuts for combinations that come up constantly.',
			'A truth table is the complete description of a gate: every combination of inputs, and what comes out for each. If you can write the truth table, you know the gate. Everything later, from adders to state machines, is a truth table that got bigger.'
		],
		pages: [
			{
				href: '/logic-gates',
				label: 'The seven logic gates',
				why: 'All seven side by side, with the idea of a universal gate: NAND alone can build the other six.'
			},
			{
				href: '/logic-gates/and',
				label: 'AND',
				why: 'Start with the three basic gates. AND is high only when every input is.'
			},
			{ href: '/logic-gates/or', label: 'OR', why: 'High when at least one input is.' },
			{ href: '/logic-gates/not', label: 'NOT', why: 'The only one-input gate: it flips the signal.' },
			{
				href: '/logic-gates/xor',
				label: 'XOR',
				why: 'High when the inputs differ. This is the gate that adds, so it deserves its own visit.'
			},
			{
				href: '/logic-gates/nand',
				label: 'NAND',
				why: 'AND with the output flipped. The gate real chips are mostly made of.'
			},
			{
				href: '/logic-gates/nor',
				label: 'NOR',
				why: 'OR with the output flipped. Two of these make your first memory, later on.'
			},
			{
				href: '/logic-gates/xnor',
				label: 'XNOR',
				why: 'XOR flipped: high when the inputs are equal, which is how a circuit compares.'
			},
			{
				href: '/logic-gate-symbols',
				label: 'Logic gate symbols',
				why: 'The two drawing standards you will meet in books and datasheets, so a diagram never looks foreign.'
			},
			{
				href: '/truth-table-generator',
				label: 'Truth table generator',
				why: 'Type any combination of gates and see its table. Use it to check your own tables until they are automatic.'
			},
			{
				href: '/learn#gates',
				label: 'Build them in the simulator',
				why: 'Place one of each, wire two switches in, and click through all four input combinations.'
			}
		],
		checkpoint:
			'You can write the truth table of any of the seven gates from memory and pick the right gate for "on when both switches are on" without thinking.'
	},
	{
		id: 'algebra',
		title: 'Boolean algebra: writing a circuit down',
		summary: [
			'Drawing gates gets slow. Boolean algebra writes the same circuit as a short expression: a dot or nothing for AND, a plus for OR, a bar for NOT. A · B + C̄ is an AND feeding an OR with an inverted input, and it takes two seconds to write.',
			"Once a circuit is an expression you can rearrange it with a small set of laws, the way x + x becomes 2x in ordinary algebra. Every rearrangement is a different circuit that does exactly the same job, and usually a smaller one. De Morgan's laws are the pair you will use most: they turn ANDs into ORs and back."
		],
		pages: [
			{
				href: '/boolean-algebra-laws',
				label: 'Boolean algebra laws',
				why: 'Every identity, each proved with the truth table that shows both sides agree. Read it once, then use it as a lookup.'
			},
			{
				href: '/de-morgans-laws',
				label: "De Morgan's laws",
				why: 'The two laws that let you swap AND for OR. They are why NAND and NOR can build everything.'
			},
			{
				href: '/boolean-algebra-examples',
				label: 'Worked simplification examples',
				why: 'Twelve expressions simplified one line at a time, with the law named on every line. Cover the right-hand side and try each step first.'
			},
			{
				href: '/boolean-algebra-calculator',
				label: 'Boolean algebra calculator',
				why: 'Type your own expression and it shows the working. Use it to check your homework, not to skip it.'
			},
			{
				href: '/nand-nor-converter',
				label: 'NAND and NOR converter',
				why: 'See any expression rebuilt from a single gate type, which is what a real chip does.'
			},
			{
				href: '/practice?topic=simplifying',
				label: 'Practice: simplifying',
				why: 'Endless generated questions on spotting the shorter equivalent form, marked as you go.'
			}
		],
		checkpoint: 'You can simplify A·B + A·B̄ to A, say which law you used at each step, and write NOT(A AND B) as an OR.'
	},
	{
		id: 'smaller',
		title: 'Making a circuit as small as it can be',
		summary: [
			'Any truth table can be turned straight into a circuit: one AND for every row that outputs 1, all ORed together. That always works and it is almost always far bigger than it needs to be. Fewer gates means cheaper, faster and less to get wrong, so minimising is a core skill.',
			'There are three ways to do it, and they are the same idea in different clothes. Sum of products gives the standard forms exam questions are written in. A Karnaugh map lays the truth table out as a grid where the simplification is visible as rectangles, and is the fastest way by hand up to four or five inputs. Quine-McCluskey is the same search written as a procedure a computer can follow for any number of inputs.'
		],
		pages: [
			{
				href: '/sum-of-products-calculator',
				label: 'Sum of products calculator',
				why: 'Minterms, maxterms, canonical and minimal forms, so you know what each name means before you minimise.'
			},
			{
				href: '/karnaugh-map-solver',
				label: 'Karnaugh map solver',
				why: "Draws the map and circles the groups for you. Draw your own first, then compare. The section on don't cares matters for the decoder later."
			},
			{
				href: '/quine-mccluskey',
				label: 'The Quine-McCluskey method',
				why: 'The tabular method worked step by step on any function you type. Read it once you are comfortable with K-maps; it explains what the calculator has been doing.'
			},
			{
				href: '/logic-circuit-generator',
				label: 'Circuit diagram generator',
				why: 'Draw the expression before and after simplifying and count the gates you saved.'
			}
		],
		checkpoint:
			'Given a four-input truth table you can draw the Karnaugh map, circle the groups and read off the smallest expression.'
	},
	{
		id: 'build',
		title: 'Building things that compute',
		summary: [
			'You now know enough to build real circuits. Adding two bits takes two gates: XOR for the sum, AND for the carry. Give it a third input for a carry coming in and it can be chained, and four of them in a row add two four-bit numbers. That chain is the arithmetic unit inside every processor, just wider.',
			'Everything in this stage is combinational: the output depends only on what the inputs are right now, and the same inputs always give the same answer. Multiplexers, decoders, comparators and the seven-segment decoder are all just bigger truth tables, built the way you learned in the last two stages.'
		],
		pages: [
			{
				href: '/learn#half-adder',
				label: 'Build a half adder',
				why: 'Step 3 of the hands-on path. Two gates, and you can add.'
			},
			{
				href: '/learn#full-adder',
				label: 'Build a full adder',
				why: 'Step 4: the carry-in, a live full adder to click through, and how to chain them.'
			},
			{
				href: '/common-circuits/half-adder',
				label: 'Half adder reference',
				why: 'The expressions and the generated truth table, for when you need them exactly.'
			},
			{
				href: '/common-circuits/full-adder',
				label: 'Full adder reference',
				why: 'The same for the full adder, including the carry-out expression.'
			},
			{
				href: '/ripple-carry-adder',
				label: 'Ripple carry adder',
				why: 'Four full adders chained, traced column by column, and why the carry chain is slow.'
			},
			{
				href: '/twos-complement',
				label: "Two's complement",
				why: 'How negative numbers fit in bits, and why the adder you just built can subtract without any new parts.'
			},
			{
				href: '/common-circuits',
				label: 'Common circuits',
				why: 'The rest of the standard building blocks: multiplexer, decoder, encoder, comparator, parity and majority, each with its own page.'
			},
			{
				href: '/seven-segment-decoder',
				label: 'Seven-segment decoder',
				why: "Four bits in, a readable digit out. Seven small K-map problems sharing four inputs, with don't cares used for real."
			},
			{
				href: '/learn#display',
				label: 'Build the display',
				why: "Step 7 of the hands-on path wires the decoder to the simulator's seven-segment display."
			}
		],
		checkpoint:
			'You can explain why 1 + 1 gives sum 0 and carry 1, trace 0011 + 0101 through four full adders, and say what a multiplexer is for.'
	},
	{
		id: 'memory',
		title: 'Memory: circuits that remember',
		summary: [
			"Every circuit so far forgets its inputs the moment they change. Feed a gate's output back round to its own input and something new happens: the circuit can hold a value after the input that set it has gone. Two NOR gates wired like that are an SR latch, one bit of memory made of two gates.",
			'A latch changes whenever its inputs do, which makes a big circuit hard to keep in step. A flip-flop is a latch that only looks at its inputs at one instant, the tick of a clock. With a clock, every part of a circuit moves at the same moment, and that is what makes counters, registers and processors possible.'
		],
		pages: [
			{
				href: '/combinational-vs-sequential',
				label: 'Combinational vs sequential logic',
				why: 'The line you are about to cross: what changes once a circuit has feedback, and why a clock appears.'
			},
			{
				href: '/learn#memory',
				label: 'Build an SR latch',
				why: 'Step 5 of the hands-on path. Wire two NOR gates into each other and watch it remember.'
			},
			{
				href: '/sr-latch',
				label: 'The SR latch',
				why: 'The NOR and NAND versions, the gated latch and the D latch, and why setting and resetting at once is forbidden.'
			},
			{
				href: '/flip-flops',
				label: 'Flip-flops',
				why: 'The four kinds, which one to reach for, and the tables you design with.'
			},
			{ href: '/flip-flops/sr', label: 'SR flip-flop', why: 'The latch you just built, clocked.' },
			{
				href: '/flip-flops/d',
				label: 'D flip-flop',
				why: 'The one you will use most: on each tick, the output becomes whatever the input is.'
			},
			{ href: '/flip-flops/jk', label: 'JK flip-flop', why: 'An SR with the forbidden case turned into a toggle.' },
			{
				href: '/flip-flops/t',
				label: 'T flip-flop',
				why: 'Flips on every tick it is told to. This is the building block of a counter.'
			},
			{
				href: '/learn#time',
				label: 'Clocks, delays and edges',
				why: 'Step 6 of the hands-on path: build a clock and an edge detector in the simulator.'
			}
		],
		checkpoint:
			"You can say what a D flip-flop's output does on each clock edge, and explain why a latch with both inputs high has no valid state."
	},
	{
		id: 'sequential',
		title: 'Circuits that count and step',
		summary: [
			'Put flip-flops in a row and you have a register, a place to keep a whole number. Wire them so each tick moves the number on by one and you have a counter; wire them so each tick moves every bit one place sideways and you have a shift register. Between them they are most of what a processor does with its data.',
			'The last idea is the biggest. Give a circuit a set of states, a rule for which state comes next based on the current state and the input, and an output for each state, and you have a finite state machine. Traffic lights, vending machines, the control unit of a processor: every controller is one of these, and you already know every part it is built from.'
		],
		pages: [
			{
				href: '/counters',
				label: 'Counters',
				why: 'Ripple and synchronous counters, why each bit runs at half the speed of the last, and how to design one that counts to any number.'
			},
			{
				href: '/shift-registers',
				label: 'Shift registers',
				why: 'Serial and parallel in and out, plus ring and Johnson counters.'
			},
			{
				href: '/gray-code-converter',
				label: 'Gray code',
				why: 'A way of counting where only one bit changes per step, which is why it is safe to read while it moves and why K-maps are laid out with it.'
			},
			{
				href: '/finite-state-machines',
				label: 'Finite state machines',
				why: 'Moore against Mealy, the design procedure, and a sequence detector taken from state diagram to working circuit.'
			}
		],
		checkpoint:
			'You can design a counter that runs 0 to 5 and starts again, and draw the state diagram for a lock that opens on the sequence 1, 0, 1.'
	},
	{
		id: 'practice',
		title: 'Check yourself, then keep building',
		summary: [
			'Reading is not the same as being able to do it. The practice page generates questions without end and marks them on the spot, the worksheets print, and the simulator is where you find out whether a design you drew on paper actually works.',
			'From here the site is a reference: come back to whichever page you need when a circuit misbehaves. If you want a single big project, rebuild the four-bit calculator example from scratch, then make it eight bits wide.'
		],
		pages: [
			{
				href: '/practice',
				label: 'Practice questions',
				why: 'Gates, truth tables, expressions, diagrams and simplifying, filterable by topic and marked instantly.'
			},
			{
				href: '/worksheet',
				label: 'Printable worksheets',
				why: 'A sheet with an optional answer key, rebuilt from its number so a class can share the same questions.'
			},
			{
				href: '/tools',
				label: 'All the tools',
				why: 'Every calculator and generator on the site in one place, now that you know what each one is for.'
			},
			{
				href: '/simulator#example:Calculator',
				label: 'The four-bit calculator',
				why: 'Open it, take it apart, then close it and build your own.'
			}
		],
		checkpoint: 'You built something that was not on this site, and it worked.'
	}
];
