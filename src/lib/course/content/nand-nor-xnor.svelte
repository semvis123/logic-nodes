<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>Three gates with a NOT built in</h2>
<p>
	You have met four gates: AND, OR, NOT and XOR. The last three of the seven are not new ideas. Each is one of the gates
	you know with a NOT gate glued onto its output, and the names say so: <strong>NAND</strong> is "not AND",
	<strong>NOR</strong> is "not OR", and <strong>XNOR</strong> is "not XOR". In the symbol, that built-in NOT is the bubble
	from the NOT lesson, drawn on the nose of the AND, OR or XOR shape. To work any of them out, work out the plain gate first
	and then flip the answer.
</p>

<LiveGate gate="nand" />

<p>
	NAND: the AND table turned upside down. AND has a single 1 in the bottom row; NAND has a single 0 there and 1
	everywhere else. In words, NAND outputs 0 only when every input is 1.
</p>

<LiveGate gate="nor" />

<p>
	NOR: the OR table flipped. OR has a single 0 in the top row; NOR has a single 1 there. NOR outputs 1 only when every
	input is 0. It is the gate for "none of them".
</p>

<LiveGate gate="xnor" />

<p>
	XNOR: XOR flipped. XOR is 1 when the inputs differ, so XNOR is 1 when they are the <em>same</em>: 1 for 00 and 11, 0
	for 01 and 10. That makes XNOR the "equal" gate. Feed it two bits and it answers the question "are these two bits the
	same?", which is the first step in comparing two numbers.
</p>

<div class="example">
	<p><strong>Worked example.</strong> What does a NOR gate output for inputs 1 and 0? And a NAND gate for 1 and 1?</p>
	<p>
		NOR is OR then NOT. OR of 1 and 0: at least one is 1, so 1. Flip it: 0. The NOR gate outputs 0. NAND is AND then
		NOT. AND of 1 and 1: both are 1, so 1. Flip it: 0. The NAND gate outputs 0. Check both against the tables above: the
		10 row of NOR and the 11 row of NAND are both 0.
	</p>
</div>

<Aside kind="mistake" title="flipping the inputs instead of the output">
	<p>
		NAND is <em>not</em> "AND of the flipped inputs". The NOT is on the output, after the AND has done its work. NAND of
		1 and 1 is NOT(1 AND 1) = NOT 1 = 0. If you flipped the inputs first you would get 0 AND 0 = 0, and that happens to agree
		here, but try 1 and 0: NAND gives NOT(0) = 1, while flipping first gives 0 AND 1 = 0. Always gate first, then flip.
	</p>
</Aside>

<h2>Why NAND matters more than it looks</h2>
<p>
	NAND seems like an afterthought, an AND with an extra step. It is the opposite. NAND on its own can build every other
	gate, and so every circuit in this course, without any help. A gate with that property is called
	<strong>universal</strong>. NOR is universal too. None of AND, OR, XOR or NOT is.
</p>
<p>Here are the three constructions, and each is short enough to check against a truth table.</p>
<p>
	<strong>NOT from NAND.</strong> Connect both inputs of a NAND gate to the same wire. The gate only ever sees 00 or 11.
	NAND of 00 is 1 and NAND of 11 is 0, so a 0 in gives 1 out and a 1 in gives 0 out. That is NOT.
</p>

<LiveExpression expression="!(a & a)" label="A NAND gate with both inputs tied to a. It behaves as NOT." />

<p>
	<strong>AND from NAND.</strong> NAND is AND with a flip on the end, so undo the flip: feed the NAND's output into a second
	NAND wired as a NOT. Two flips cancel, and what is left is AND. Two gates.
</p>
<p>
	<strong>OR from NAND.</strong> Flip each input with its own NAND-as-NOT, then NAND the two results together. Three gates.
	Try it below, and compare its table with the OR gate from earlier: they match row for row. Why inverting both inputs of
	an AND-with-a-flip should give OR is a rule with a name, and the next stage is about it; for now it is enough that the
	table says so.
</p>

<LiveExpression
	expression="!(!a & !b)"
	label="NOT a and NOT b into a NAND. This circuit behaves exactly like OR: compare the table with the OR gate's."
/>

<Aside kind="why" title="why are chips built from NAND?">
	<p>
		A factory that has to make one kind of gate well is in a better position than one that has to make seven. In the
		transistor technology used for nearly every chip today, a NAND gate is four transistors and an AND gate is six,
		because the AND is built as a NAND with an inverter on the end. So the "simpler" gate is the more expensive one, and
		designers let the flips fall where they may and use NANDs and NORs everywhere. The tools then take a design written
		with AND and OR and turn it into NAND and NOR automatically.
	</p>
</Aside>

<Aside kind="tip">
	<p>
		To recognise the three from a table, look at where the lone 1 or lone 0 is. A lone 0 in the bottom row is NAND. A
		lone 1 in the top row is NOR. Two 1s, in the top and bottom rows, is XNOR; two 1s in the middle rows is XOR.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>NAND, NOR and XNOR are AND, OR and XOR with a NOT on the output; the bubble on the symbol shows it.</li>
	<li>To work one out, do the plain gate first and then flip the answer.</li>
	<li>NAND outputs 0 only when every input is 1; NOR outputs 1 only when every input is 0.</li>
	<li>XNOR outputs 1 when its two inputs are equal. It is the "same?" gate.</li>
	<li>NAND alone can build NOT, AND and OR, so it can build anything. That is why chips are made of it.</li>
</ul>
