<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>One or the other, but not both</h2>
<p>
	The OR lesson warned that the gate is not the "or" of everyday speech: OR is happy when both inputs are 1. There is a
	gate for the everyday meaning too. It outputs 1 when one input <em>or</em> the other is 1, but not when both are, and
	not when neither is. It is called <strong>XOR</strong>, short for "exclusive or", because it excludes the case where
	both are on.
</p>

<LiveGate gate="xor" />

<p>
	The cleanest way to remember it is not about "or" at all: XOR outputs 1 when its two inputs are
	<em>different</em>, and 0 when they are the <em>same</em>. Look at the table. 00 and 11, the two rows where the inputs
	match, give 0. 01 and 10, where they differ, give 1. The symbol is the OR shape with a second curved line drawn behind
	its back.
</p>

<Aside kind="term" title="XOR">
	<p>
		<strong>XOR</strong> is the exclusive OR gate. Its output is 1 when exactly one of its two inputs is 1, which is the
		same as saying the two inputs are different. On this site it has two inputs; you will sometimes see it written as
		<span class="mono">a ⊕ b</span>
		or <span class="mono">a ⊻ b</span>, and in code as
		<span class="mono">a ^ b</span>.
	</p>
</Aside>

<h2>Adding without the carry</h2>
<p>
	Here is why XOR earns a place among the seven. Add two single bits and there are four cases: 0 + 0 = 0, 0 + 1 = 1, 1 +
	0 = 1, and 1 + 1 = 10, which is binary for two: a 0 in this column and a 1 carried to the next. Now look at just the
	digit that stays in this column: 0, 1, 1, 0. That is the XOR table. And look at the carry: 0, 0, 0, 1. That is the AND
	table.
</p>
<p>
	So one XOR gate and one AND gate, side by side on the same two inputs, add two bits. The XOR gives the sum digit and
	the AND gives the carry. That little circuit has a name, the half adder, and it is the first thing built in the stage
	on arithmetic. Everything a computer does with numbers starts here.
</p>

<div class="example">
	<p><strong>Worked example.</strong> XOR the patterns 1101 and 1011 bit by bit.</p>
	<p>
		Line them up and take one column at a time. Leftmost: 1 and 1 are the same, so 0. Next: 1 and 0 differ, so 1. Next:
		0 and 1 differ, so 1. Rightmost: 1 and 1 are the same, so 0. The answer is
		<span class="mono">0110</span>. Notice that every column is worked out on its own; nothing carries from one to the
		next, which is exactly what "add without carry" means.
	</p>
</div>

<h2>A switch that flips</h2>
<p>
	Set one input of an XOR gate to a fixed value and something useful happens to the other. Hold
	<span class="mono">b</span> at 0 and the output simply copies <span class="mono">a</span>: 0 gives 0, 1 gives 1. Hold
	<span class="mono">b</span>
	at 1 and the output is the opposite of <span class="mono">a</span>: 0 gives 1, 1 gives 0. So an XOR gate is a NOT gate
	that can be switched on and off by its second input. Engineers call this a
	<strong>controlled inverter</strong>, and it is how a circuit is told "use this number as it is" or "use its opposite"
	with a single control wire.
</p>

<LiveExpression
	expression="a ^ b"
	label="XOR as a controlled inverter: with flip = 1 the output is the opposite of a; with flip = 0 it is a."
	names={{ b: 'flip' }}
/>

<Aside kind="why" title="why not just use a NOT gate?">
	<p>
		A NOT gate always inverts. There is no way to ask it not to. When a circuit needs to invert a value
		<em>sometimes</em>, depending on another signal, XOR does in one gate what would otherwise take two NOTs, two ANDs
		and an OR. Subtraction in a computer is done this way: the same adder is used, with the second number flipped by a
		row of XOR gates when the operation is a subtraction.
	</p>
</Aside>

<h2>Counting 1s: parity</h2>
<p>
	Chain XOR gates together and the pattern continues. Three inputs XORed give 1 when an odd number of them are 1 and 0
	when an even number are. Click through the widget below: the output is 1 for exactly one input on or all three on, and
	0 for none or two. This is called the <strong>parity</strong> of the inputs, and it is a cheap way to check that a set
	of bits arrived intact. Send the bits plus one extra bit that makes the count of 1s even; if the receiver counts an odd
	number, something was flipped on the way.
</p>

<LiveExpression expression="a ^ b ^ c" label="Three inputs XORed: 1 when an odd number of them are 1." />

<Aside kind="mistake" title="treating XOR like OR when both inputs are 1">
	<p>
		The one row people get wrong is the bottom one. OR gives 1 for two 1s; XOR gives 0. If the inputs are the same, XOR
		is 0, whether they are both 0 or both 1. Say "different?" to yourself rather than "or", and the bottom row takes
		care of itself.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>XOR outputs 1 when its two inputs are different and 0 when they are the same.</li>
	<li>It is the everyday "or": one or the other, but not both.</li>
	<li>XOR is the sum digit when two bits are added; AND is the carry. Together they make a half adder.</li>
	<li>XOR with a 1 flips the other input; XOR with a 0 leaves it alone. That is a controlled inverter.</li>
	<li>A chain of XORs tells you whether the number of 1s is odd, which is called parity.</li>
</ul>
