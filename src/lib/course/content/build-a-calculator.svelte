<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveRippleAdder from '$lib/course/widgets/LiveRippleAdder.svelte';
	import LiveSevenSegment from '$lib/course/widgets/LiveSevenSegment.svelte';
	import { rippleAdd } from '$lib/adders';
	import { subtractSigned } from '$lib/twosComplement';

	// The checkpoint values, computed rather than typed, so the numbers the
	// reader checks against are the ones the circuit will produce.
	const add = (a: number, b: number) => rippleAdd(a, b, 4);
	const sub = (a: number, b: number) => subtractSigned(a, b, 4);
	const bits = (list: readonly number[]) => list.join('');
	const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));
	const c1 = add(11, 6);
	const c2 = add(15, 1);
	const c3 = add(10, 5);
	const s1 = sub(6, 3);
	const s2 = sub(3, 6);
	const s3 = sub(7, 7);
</script>

<h2>What you are building</h2>
<p>
	A calculator that adds and subtracts two four bit numbers and shows the answer on a seven-segment digit. Nothing in it
	is new: it is the half adder, the full adder, the ripple carry adder, two's complement and the display decoder from
	stage 5, wired together. The two widgets below are the heart of it. Everything you build is a way of making the
	simulator do what they do.
</p>
<div class="pair">
	<LiveRippleAdder a={9} b={3} label="The arithmetic: a four bit ripple carry adder." />
	<LiveSevenSegment code={2} label="The output: a seven-segment decoder and display." />
</div>
<p>
	Work through the steps in order, and do not skip a checkpoint. Each step turns the last one into a chip, so a mistake
	left in the half adder shows up in every adder built from it, where it is much harder to find. Building in the
	simulator: gates are in the Logic menu, toggles and displays in the Input and Output menus, and File, then Create
	node, packages whatever you have selected into a reusable chip with the inputs and outputs you named.
</p>

<h2>Step 1: the half adder chip</h2>
<ol>
	<li>Place two toggles, an XOR gate, an AND gate and two displays.</li>
	<li>Wire both toggles into both gates. The XOR output is the sum; the AND output is the carry.</li>
	<li>Click through the four input combinations.</li>
</ol>
<div class="example">
	<p>
		<strong>Checkpoint.</strong> 0 + 0 gives sum 0, carry 0. 0 + 1 and 1 + 0 give sum 1, carry 0. 1 + 1 gives sum 0, carry
		1.
	</p>
	<p>
		When all four are right, select everything and use File, then Create node. Name the chip "half adder", its inputs A
		and B, and its outputs S and C. Delete the loose gates; from now on you place the chip.
	</p>
</div>

<h2>Step 2: the full adder chip</h2>
<ol>
	<li>Place two half adder chips, an OR gate, three toggles (A, B and the carry in) and two displays.</li>
	<li>Wire A and B into the first chip. Wire its S output and the carry in toggle into the second chip.</li>
	<li>The second chip's S is the sum. Wire both chips' C outputs into the OR; the OR output is the carry out.</li>
</ol>
<div class="example">
	<p>
		<strong>Checkpoint.</strong> 1 + 1 + 1 gives sum 1, carry out 1. 1 + 0 + 1 gives sum 0, carry out 1. 0 + 1 + 0 gives
		sum 1, carry out 0.
	</p>
	<p>
		The rule: the sum is 1 when an odd number of inputs are 1; the carry out is 1 when at least two are. Check all eight
		rows, then package it as "full adder" with inputs A, B, C and outputs S, C.
	</p>
</div>

<Aside kind="mistake" title="swapping the two half adder outputs">
	<p>
		The second half adder must take the first one's <em>sum</em>, not its carry. If the sum column comes out right for
		single 1s but 1 + 1 + 0 gives the wrong answer, that wire is the first thing to check.
	</p>
</Aside>

<h2>Step 3: four in a row</h2>
<ol>
	<li>Place four full adder chips side by side, the rightmost one for bit 0.</li>
	<li>
		Wire each chip's carry out into the carry in of the chip to its left. Give the rightmost chip's carry in a toggle,
		set to 0 for now.
	</li>
	<li>
		Place eight toggles: four for A (bits 3 to 0) and four for B. Wire bit 0 of each into the rightmost chip, and so on.
	</li>
	<li>Place five displays: the four sums, and the carry out of the leftmost chip.</li>
</ol>
<div class="example">
	<p><strong>Checkpoint.</strong> Set A = {bits(c1.aBits)} (11) and B = {bits(c1.bBits)} (6).</p>
	<p>
		The sum displays should read {bits(c1.sumBits)} with the carry out at {c1.carryOut}: that is 16 + {c1.unsigned} = {c1.a +
			c1.b}. Then try {bits(c2.aBits)} + {bits(c2.bBits)}: {bits(c2.sumBits)} with carry out {c2.carryOut}, and watch
		the carry ripple through all four chips. Finally {bits(c3.aBits)} + {bits(c3.bBits)} should give {bits(c3.sumBits)} with
		carry out {c3.carryOut}, which is {c3.unsigned} and fits. Package the chain as "4 bit adder" with inputs A3 to A0, B3
		to B0 and C, and outputs S3 to S0 and C.
	</p>
</div>

<h2>Step 4: subtraction with two's complement</h2>
<p>
	To subtract, add the negative. The negative of B is "invert every bit and add 1", and the adder can do both parts: a
	row of XOR gates inverts B when a control line is 1, and the same control line goes into the adder's carry in to add
	the 1.
</p>
<ol>
	<li>Add one toggle called "subtract".</li>
	<li>
		Place four XOR gates, one per bit of B. Each takes one B toggle and the subtract toggle, and its output goes to the
		adder's B input for that bit.
	</li>
	<li>Wire the subtract toggle into the adder's carry in as well, replacing the toggle you put there in step 3.</li>
</ol>
<div class="example">
	<p>
		<strong>Checkpoint.</strong> With subtract at 0 the adder behaves as before. With subtract at 1, set A = {bits(
			s1.aBits
		)} (6) and B = {bits(s1.bBits)} (3).
	</p>
	<p>
		The XORs turn B into {bits(s1.inverted ?? [])}, and the sums read {bits(s1.sumBits)}, which is {signed(
			s1.resultSigned
		)}. The carry out is {s1.carryOut}; for subtraction you ignore it. Now try {bits(s2.aBits)} − {bits(s2.bBits)}, 3 −
		6: the sums read {bits(s2.sumBits)}, which is {signed(s2.resultSigned)} in two's complement (top bit worth −8: −8 + 4
		+ 1). And
		{bits(s3.aBits)} − {bits(s3.bBits)} gives {bits(s3.sumBits)}.
	</p>
</div>

<Aside kind="why" title="why does one toggle do both jobs?">
	<p>
		XOR with 0 leaves a bit alone and XOR with 1 flips it, so the subtract line inverts B only when you ask. The carry
		in supplies the "add 1" that finishes the negation. When subtract is 0, B passes through unchanged and the carry in
		is 0, so the same circuit adds. That is how a processor's arithmetic unit does it.
	</p>
</Aside>

<h2>Step 5: a digit on the display</h2>
<p>
	Four displays showing bits are hard to read. The seven-segment decoder from stage 5 turns the four sum bits into a
	digit. The quickest route is the built in example: open <a href="/simulator#example:7%20Segment-display"
		>the 7 Segment-display example</a
	>, which has all seven segment circuits wired to four switches, select the decoder part, and package it as a chip with
	inputs B3 to B0 and outputs a to g. Or build it yourself from the seven expressions on the
	<a href="/seven-segment-decoder">decoder page</a>, one segment at a time.
</p>
<ol>
	<li>Place the decoder chip and seven displays arranged as a figure eight, a on top, g in the middle.</li>
	<li>Wire the adder's four sum outputs into the decoder's inputs, bit 3 to B3 and so on.</li>
	<li>Wire each decoder output to its bar.</li>
</ol>
<div class="example">
	<p>
		<strong>Checkpoint.</strong> 4 + 5 should light a, b, c, d, f and g: a 9. 2 + 1 should light a, b, c, d and g: a 3.
	</p>
	<p>
		Sums of 10 or more, like 7 + 5, are not decimal digits, so the display shows whatever the don't cares left there. A
		real calculator would need a second digit and a circuit to split the sum into tens and units; that is beyond four
		bits, and a good stretch goal.
	</p>
</div>

<h2>Step 6: compare with the built in example</h2>
<p>
	Open <a href="/simulator#example:Calculator">the Calculator example</a>. Inside it you will find the same half adder
	and full adder chips, a "4 Bit adder" made of four full adders, and "7 segment decoder" chips on the outputs. It adds
	only, so your build already does something it does not: subtract. Compare how the two of you wired the carry chain,
	and open the chips to see where they match your own.
</p>

<h2>Stretch goals</h2>
<ul>
	<li>
		<strong>Eight bits.</strong> Place a second 4 bit adder chip and wire the carry out of the first into the carry in of
		the second. Sixteen toggles in, eight sums and a carry out. 200 + 100 needs the ninth bit; check that it lights.
	</li>
	<li>
		<strong>An overflow lamp.</strong> For signed numbers, overflow is two same-sign inputs giving the other sign. Build
		it as: A3 XNOR B3 (the signs match), AND S3 XOR A3 (the result's sign differs). Try 5 + 3 and watch it light while 6
		− 3 leaves it dark.
	</li>
	<li>
		<strong>Two digits.</strong> Show sums up to 30 as tens and units. You will need a circuit that turns a five bit number
		into two BCD digits, which is a truth table with 32 rows and eight outputs: a real design problem, and every tool on
		this site can help with it.
	</li>
</ul>

<h2>What to remember</h2>
<ul>
	<li>Big circuits are built from small chips, and every chip is checked before it is used in the next.</li>
	<li>One full adder per bit, carries chained, is a ripple carry adder.</li>
	<li>Inverting B with XORs and setting the carry in to 1 turns the adder into a subtractor.</li>
	<li>A seven-segment decoder on the sum turns bits into something a person can read.</li>
</ul>

<style>
	.pair {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 0 1rem;
	}
</style>
