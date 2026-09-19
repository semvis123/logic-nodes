// The glossary: one self-contained paragraph per term, each pointing at the
// page that treats it properly. The test suite checks that every link
// resolves to a page in the sitemap, so an entry cannot point nowhere.

export type GlossaryEntry = {
	term: string;
	/** Anchor on the glossary page. */
	slug: string;
	definition: string;
	/** Where to read more, as a site path, optionally with a fragment. */
	href?: string;
};

export const glossary: GlossaryEntry[] = [
	{
		term: 'Active low',
		slug: 'active-low',
		definition:
			'A signal that does its job when it is 0 rather than 1. Written with a bar or a trailing N, as in R̄ or RESET_N, and drawn with a bubble on the pin. The NAND latch has active-low set and reset inputs.',
		href: '/sr-latch#nand'
	},
	{
		term: 'Adder',
		slug: 'adder',
		definition:
			'A circuit that adds binary numbers. A half adder adds two bits, a full adder adds two bits and a carry in, and a chain of full adders, one per column, adds whole numbers.',
		href: '/common-circuits/full-adder'
	},
	{
		term: 'AND gate',
		slug: 'and-gate',
		definition: 'A gate whose output is 1 only when every input is 1. Written a ∧ b, a · b or ab.',
		href: '/logic-gates/and'
	},
	{
		term: 'ANSI symbols',
		slug: 'ansi-symbols',
		definition:
			'The distinctive gate shapes used on most American schematics: a D for AND, a shield for OR, a triangle for NOT. Formally ANSI/IEEE Std 91, and originally from a military standard.',
		href: '/logic-gate-symbols'
	},
	{
		term: 'BCD',
		slug: 'bcd',
		definition:
			"Binary coded decimal: each decimal digit stored in its own four bits, so 42 is 0100 0010. Six of the sixteen four-bit patterns are never used, which makes them don't cares in circuits such as a seven-segment decoder.",
		href: '/binary-converter#bcd'
	},
	{
		term: 'Bit',
		slug: 'bit',
		definition: 'One binary digit, 0 or 1. The value on a single wire in a digital circuit.',
		href: '/learn/what-is-a-bit'
	},
	{
		term: 'Boolean algebra',
		slug: 'boolean-algebra',
		definition:
			'The algebra of true and false: variables that take the values 1 and 0, and the operations AND, OR and NOT. Every logic circuit without feedback is a boolean expression, and every boolean expression can be built as a circuit.',
		href: '/boolean-algebra-laws'
	},
	{
		term: 'Bubble',
		slug: 'bubble',
		definition:
			"The small circle on a gate pin that means inversion. On an output it turns AND into NAND and OR into NOR; on an input it marks the pin active low. Moving bubbles through a gate is De Morgan's law drawn rather than written.",
		href: '/logic-gate-symbols'
	},
	{
		term: 'Canonical form',
		slug: 'canonical-form',
		definition:
			'A sum of products in which every term contains every variable (a sum of minterms), or the equivalent product of maxterms. It is unique for a given function but rarely minimal.',
		href: '/sum-of-products-calculator'
	},
	{
		term: 'Carry',
		slug: 'carry',
		definition:
			'The 1 that overflows from one column of an addition into the next. A full adder takes a carry in and produces a carry out, and the carry out of adding three bits is their majority function.',
		href: '/common-circuits/full-adder'
	},
	{
		term: 'Carry lookahead',
		slug: 'carry-lookahead',
		definition:
			'An adder design that computes every carry directly from generate (A AND B) and propagate (A XOR B) signals instead of waiting for the carry from the column below, so the delay stays fixed as the word gets wider, at the cost of more and wider gates.',
		href: '/ripple-carry-adder#lookahead'
	},
	{
		term: 'Clock',
		slug: 'clock',
		definition:
			'A square wave that tells every flip-flop in a circuit when to look at its inputs. Edge-triggered parts act on the rising or falling edge, which is what lets a whole design change state at one predictable instant.',
		href: '/combinational-vs-sequential'
	},
	{
		term: 'Combinational logic',
		slug: 'combinational-logic',
		definition:
			'Logic whose output depends only on the inputs right now. Gates, adders, multiplexers and decoders are combinational; anything with memory is not.',
		href: '/combinational-vs-sequential'
	},
	{
		term: 'Comparator',
		slug: 'comparator',
		definition:
			'A circuit that reports whether one binary number is equal to, greater than or less than another, comparing from the most significant bit down.',
		href: '/common-circuits/comparator'
	},
	{
		term: 'Counter',
		slug: 'counter',
		definition:
			'A register that steps through a sequence of values on each clock pulse, usually counting in binary. Ripple counters chain flip-flops so each toggles the next; synchronous counters clock them all together.',
		href: '/counters'
	},
	{
		term: 'D flip-flop',
		slug: 'd-flip-flop',
		definition:
			'A flip-flop that copies its D input to Q on each clock edge and holds it in between. The building block of registers and most memory inside a processor.',
		href: '/flip-flops/d'
	},
	{
		term: "De Morgan's laws",
		slug: 'de-morgans-laws',
		definition:
			'Two identities for moving a NOT through a bracket: ¬(a ∧ b) = ¬a ∨ ¬b and ¬(a ∨ b) = ¬a ∧ ¬b. Negate every term, swap the operator. They are what makes NAND-only and NOR-only circuits possible.',
		href: '/de-morgans-laws'
	},
	{
		term: 'Decoder',
		slug: 'decoder',
		definition:
			'A circuit that turns an n-bit number into a single active line out of 2ⁿ. Its outputs are the minterms of its inputs, so any function is an OR of some of them.',
		href: '/common-circuits/decoder'
	},
	{
		term: 'Demultiplexer',
		slug: 'demultiplexer',
		definition:
			'A circuit that routes one data input to one of several outputs, chosen by its select lines. A decoder with the data ANDed into every output.',
		href: '/common-circuits/demultiplexer'
	},
	{
		term: "Don't care",
		slug: 'dont-care',
		definition:
			'A truth table row whose output does not matter, because that input can never happen or nothing reads the result. Marked X, and free to be treated as 0 or 1, whichever makes the circuit smaller.',
		href: '/karnaugh-map-solver'
	},
	{
		term: 'Edge triggered',
		slug: 'edge-triggered',
		definition:
			'Responding to inputs only at the instant a clock changes, rising or falling, and ignoring them the rest of the time. What distinguishes a flip-flop from a latch.',
		href: '/flip-flops'
	},
	{
		term: 'Encoder',
		slug: 'encoder',
		definition:
			'The reverse of a decoder: 2ⁿ input lines, one active, and the n-bit number of the active line comes out. A priority encoder resolves several active inputs by picking the highest.',
		href: '/common-circuits/encoder'
	},
	{
		term: 'Excitation table',
		slug: 'excitation-table',
		definition:
			'For a flip-flop, the table of which inputs produce each transition of Q: what to apply to go from 0 to 1, from 1 to 0, and so on. The tool used to design counters and state machines from their transition tables.',
		href: '/flip-flops'
	},
	{
		term: 'Finite state machine',
		slug: 'finite-state-machine',
		definition:
			'A sequential circuit that is always in one of a fixed set of states, moves between them on each clock according to its inputs, and produces outputs from its state (Moore) or from its state and inputs together (Mealy).',
		href: '/finite-state-machines'
	},
	{
		term: 'Flip-flop',
		slug: 'flip-flop',
		definition:
			'A one-bit memory element that changes state only on a clock edge. The four standard kinds are SR, D, JK and T.',
		href: '/flip-flops'
	},
	{
		term: 'Full adder',
		slug: 'full-adder',
		definition:
			'A circuit that adds two bits and a carry in, giving a sum and a carry out. Chained one per column, full adders add whole numbers.',
		href: '/common-circuits/full-adder'
	},
	{
		term: 'Gray code',
		slug: 'gray-code',
		definition:
			'A binary ordering in which consecutive values differ in exactly one bit. Used on the axes of a Karnaugh map, in rotary encoders, and anywhere a glitch between two changing bits would be read as a wrong value.',
		href: '/gray-code-converter'
	},
	{
		term: 'Half adder',
		slug: 'half-adder',
		definition: 'A circuit that adds two bits, giving a sum (XOR) and a carry (AND), with no way to take a carry in.',
		href: '/common-circuits/half-adder'
	},
	{
		term: 'IEC symbols',
		slug: 'iec-symbols',
		definition:
			'The rectangular gate symbols of IEC 60617: every gate is the same box with a label inside, & for AND, ≥1 for OR, =1 for XOR, and a bubble for inversion.',
		href: '/logic-gate-symbols'
	},
	{
		term: 'JK flip-flop',
		slug: 'jk-flip-flop',
		definition:
			'A flip-flop with two inputs that set, reset, hold, or toggle Q, depending on their combination. It removes the forbidden input of the SR flip-flop by making that case a toggle.',
		href: '/flip-flops/jk'
	},
	{
		term: 'Karnaugh map',
		slug: 'karnaugh-map',
		definition:
			'A truth table drawn as a grid whose axes are in Gray code, so that cells which differ in one variable sit next to each other. Circling rectangles of 1s reads off a minimal sum of products.',
		href: '/karnaugh-map-solver'
	},
	{
		term: 'Latch',
		slug: 'latch',
		definition:
			'A level-sensitive memory element, as opposed to an edge-triggered flip-flop. A plain SR latch responds whenever its inputs change; a gated latch responds whenever its enable is high.',
		href: '/sr-latch'
	},
	{
		term: 'Logic gate',
		slug: 'logic-gate',
		definition:
			'A circuit with one or more binary inputs and one binary output that follows a fixed rule. The seven standard gates are AND, OR, NOT, XOR, NAND, NOR and XNOR.',
		href: '/logic-gates'
	},
	{
		term: 'Majority function',
		slug: 'majority-function',
		definition:
			'A function that is 1 when more than half of its inputs are 1. For three inputs it is (a ∧ b) ∨ (b ∧ c) ∨ (a ∧ c), which is also the carry out of a full adder.',
		href: '/common-circuits/majority'
	},
	{
		term: 'Maxterm',
		slug: 'maxterm',
		definition:
			'An OR of every variable, each either plain or negated, that is 0 for exactly one row of the truth table. A function is the AND of the maxterms of its 0 rows, which is its product of sums.',
		href: '/sum-of-products-calculator'
	},
	{
		term: 'Mealy machine',
		slug: 'mealy-machine',
		definition:
			'A finite state machine whose outputs depend on both the current state and the current inputs, so an output can change as soon as an input does.',
		href: '/finite-state-machines#moore-vs-mealy'
	},
	{
		term: 'Minterm',
		slug: 'minterm',
		definition:
			'An AND of every variable, each either plain or negated, that is 1 for exactly one row of the truth table. A function is the OR of the minterms of its 1 rows, which is its canonical sum of products.',
		href: '/sum-of-products-calculator'
	},
	{
		term: 'Moore machine',
		slug: 'moore-machine',
		definition:
			'A finite state machine whose outputs depend on the current state alone, so they change only when the state does, on a clock edge.',
		href: '/finite-state-machines#moore-vs-mealy'
	},
	{
		term: 'Multiplexer',
		slug: 'multiplexer',
		definition:
			'A circuit that passes one of several data inputs to a single output, chosen by the value on its select lines. Also called a mux or a data selector.',
		href: '/common-circuits/multiplexer'
	},
	{
		term: 'NAND gate',
		slug: 'nand-gate',
		definition:
			'An AND gate with the output inverted: 0 only when every input is 1. Universal, meaning every other gate can be built from NAND alone.',
		href: '/logic-gates/nand'
	},
	{
		term: 'NOR gate',
		slug: 'nor-gate',
		definition:
			'An OR gate with the output inverted: 1 only when every input is 0. Universal, like NAND, and the gate behind the classic SR latch.',
		href: '/logic-gates/nor'
	},
	{
		term: 'NOT gate',
		slug: 'not-gate',
		definition: 'A gate with one input whose output is the opposite of it. Also called an inverter.',
		href: '/logic-gates/not'
	},
	{
		term: 'OR gate',
		slug: 'or-gate',
		definition:
			'A gate whose output is 1 when at least one input is 1. This is the inclusive or: it is still 1 when every input is 1.',
		href: '/logic-gates/or'
	},
	{
		term: 'Overflow',
		slug: 'overflow',
		definition:
			"A result that does not fit the width of the register. For unsigned numbers the carry out of the top bit flags it. For two's complement numbers the test is a result with the wrong sign, equivalently a carry into the top bit that differs from the carry out of it.",
		href: '/twos-complement#overflow'
	},
	{
		term: 'Parity',
		slug: 'parity',
		definition:
			'Whether the number of 1s in a word is even or odd. A parity bit sent with data lets the receiver detect any single flipped bit, and the generator is a chain of XOR gates.',
		href: '/common-circuits/parity'
	},
	{
		term: 'Prime implicant',
		slug: 'prime-implicant',
		definition:
			"A product term that is 1 only where the function is 1 or a don't care, and that cannot be made any shorter without breaking that. The groups on a Karnaugh map and the unticked rows of a Quine-McCluskey tabulation are prime implicants; an essential one is the only cover of some minterm.",
		href: '/quine-mccluskey#chart'
	},
	{
		term: 'Product of sums',
		slug: 'product-of-sums',
		definition:
			'An expression that is an AND of OR terms, such as (a ∨ b) ∧ (¬a ∨ c). The dual of a sum of products, and the natural form when a function has few 0 rows.',
		href: '/sum-of-products-calculator'
	},
	{
		term: 'Propagation delay',
		slug: 'propagation-delay',
		definition:
			'The time between an input of a gate changing and its output settling: tens of picoseconds for a gate inside a chip, tens of nanoseconds for a packaged TTL or CMOS gate. It sets the maximum clock rate of a circuit and is why ripple counters lag.',
		href: '/counters'
	},
	{
		term: 'Quine-McCluskey method',
		slug: 'quine-mccluskey',
		definition:
			'The tabular way to minimise a boolean function: merge minterms that differ in one bit until nothing merges, which gives the prime implicants, then choose the fewest of them that cover every minterm. It reaches the same answer as a Karnaugh map and works for any number of variables.',
		href: '/quine-mccluskey'
	},
	{
		term: 'Register',
		slug: 'register',
		definition:
			'A group of flip-flops sharing a clock, holding one multi-bit value. A shift register moves its contents one place along on every clock.',
		href: '/shift-registers'
	},
	{
		term: 'Ripple carry',
		slug: 'ripple-carry',
		definition:
			'An adder in which each column waits for the carry from the one before, so the carry ripples from the least significant bit to the most. Simple, but the delay grows with the width.',
		href: '/ripple-carry-adder'
	},
	{
		term: 'Sequential logic',
		slug: 'sequential-logic',
		definition:
			'Logic with memory: the output depends on the history of the inputs, not only their present values. Built from combinational logic plus feedback, usually in the form of flip-flops driven by a clock.',
		href: '/combinational-vs-sequential'
	},
	{
		term: 'Seven-segment display',
		slug: 'seven-segment-display',
		definition:
			'A digit made of seven bars, labelled a to g, lit in combinations to show the digits 0 to 9 and, at a stretch, hexadecimal letters. A seven-segment decoder turns a four-bit number into the seven segment signals.',
		href: '/seven-segment-decoder'
	},
	{
		term: 'Shift register',
		slug: 'shift-register',
		definition:
			'A chain of flip-flops in which each one passes its value to the next on every clock, so a word moves along one place per pulse. Used to convert between serial and parallel data.',
		href: '/shift-registers'
	},
	{
		term: 'Sign extension',
		slug: 'sign-extension',
		definition:
			"Widening a two's complement number by copying its sign bit into the new top bits, which keeps the value the same. Padding with zeros instead would turn a negative number into a large positive one.",
		href: '/twos-complement#extend'
	},
	{
		term: 'SR latch',
		slug: 'sr-latch',
		definition:
			'Two cross-coupled gates with a set and a reset input: the smallest circuit that remembers one bit. Built from NOR gates with active-high inputs or NAND gates with active-low ones.',
		href: '/sr-latch'
	},
	{
		term: 'State table',
		slug: 'state-table',
		definition:
			'For a state machine, the table listing the next state and output for every combination of present state and input. It is the truth table the flip-flop input logic is designed from.',
		href: '/finite-state-machines'
	},
	{
		term: 'Sum of products',
		slug: 'sum-of-products',
		definition:
			'An expression that is an OR of AND terms, such as (a ∧ b) ∨ (¬a ∧ c). The form a Karnaugh map produces and the form most minimisers aim for.',
		href: '/sum-of-products-calculator'
	},
	{
		term: 'T flip-flop',
		slug: 't-flip-flop',
		definition:
			'A flip-flop that toggles Q on the clock edge when T is 1 and holds when T is 0. The natural building block of a binary counter.',
		href: '/flip-flops/t'
	},
	{
		term: 'Truth table',
		slug: 'truth-table',
		definition:
			'A table listing the output of a circuit for every combination of its inputs. With n inputs it has 2ⁿ rows. It defines the function completely, which is why two circuits with the same truth table are interchangeable.',
		href: '/truth-table-generator'
	},
	{
		term: "Two's complement",
		slug: 'twos-complement',
		definition:
			'The usual representation of signed binary numbers, in which the top bit counts negative, so that a number is negated by inverting every bit and adding 1. It lets one adder handle addition and subtraction of signed numbers without a separate subtractor.',
		href: '/twos-complement'
	},
	{
		term: 'Universal gate',
		slug: 'universal-gate',
		definition:
			'A gate from which every boolean function can be built using no other kind of gate. NAND and NOR are the only two-input gates that are universal on their own.',
		href: '/logic-gates#universal-gates'
	},
	{
		term: 'XNOR gate',
		slug: 'xnor-gate',
		definition:
			'An XOR gate with the output inverted: 1 when its two inputs are equal. Also called the equivalence gate, and the heart of a comparator.',
		href: '/logic-gates/xnor'
	},
	{
		term: 'XOR gate',
		slug: 'xor-gate',
		definition:
			'The exclusive or: 1 when its two inputs differ and 0 when they match. The sum output of a half adder and the parity of two bits.',
		href: '/logic-gates/xor'
	}
];
