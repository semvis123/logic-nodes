<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveFullAdder from '$lib/course/widgets/LiveFullAdder.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>The missing input</h2>
<p>
	The half adder from the last lesson adds two bits and can send a carry out to the left. What it cannot do is take a
	carry <em>in</em> from the right. Think of adding 19 and 13 on paper: the ones column makes 12, so you write 2 and carry
	1, and the tens column then has three things to add, 1 and 1 and the carried 1. Every column except the rightmost works
	like that. A circuit that can sit in any column needs three inputs.
</p>

<Aside kind="term" title="full adder, carry in, carry out">
	<p>
		A <strong>full adder</strong> adds three bits: the two bits of its column, a and b, and the
		<strong>carry in</strong>, the carry arriving from the column on its right. It gives a sum bit and a
		<strong>carry out</strong>, which goes to the column on its left. Because it has a carry in, full adders can be
		chained.
	</p>
</Aside>

<p>
	Three inputs make eight combinations, so the table has eight rows. Adding three bits gives a total of 0, 1, 2 or 3,
	and the two outputs are just that total written in binary: 0 is <span class="mono">00</span>, 1 is
	<span class="mono">01</span>, 2 is <span class="mono">10</span> and 3 is <span class="mono">11</span>. The left digit
	is the carry out and the right digit is the sum. Click through the rows and watch the total.
</p>

<LiveFullAdder />

<h2>Two rules that describe the table</h2>
<p>
	Look at the sum column. It is 1 whenever an odd number of the inputs are 1: one input, or all three. That is what you
	get by XORing all three inputs together, <span class="mono">a ⊻ b ⊻ c</span>, because XOR flips the answer every time
	it meets another 1. Now the carry out column. It is 1 whenever the total is 2 or more, in other words whenever
	<strong>at least two</strong> of the three inputs are 1. That rule has a name, the <strong>majority</strong>: the
	output agrees with whatever most of the inputs are doing. As gates it is "a and b, or the carry in and exactly one of
	a and b", which the reference page writes as <span class="mono">(a ∧ b) ∨ (c ∧ (a ⊻ b))</span>.
</p>

<LiveExpression
	expression="(a & b) | (c & (a ^ b))"
	label="The carry out on its own. It is 1 when at least two inputs are 1."
	outputLabel="carry out"
	names={{ c: 'carry in' }}
/>

<div class="example">
	<p><strong>Worked example.</strong> A full adder is given a = 1, b = 0 and a carry in of 1. What does it output?</p>
	<p>
		As numbers, 1 + 0 + 1 = 2, which is <span class="mono">10</span> in binary: carry out 1, sum 0. Check with the rules.
		Two of the three inputs are 1, an even number, so the sum is 0. At least two inputs are 1, so the carry out is 1. Both
		ways give sum 0, carry out 1.
	</p>
</div>

<Aside kind="mistake" title="carry out only when all three are 1">
	<p>
		A carry does not need every input to be 1. Two 1s already make 2, which is too big for one bit, so the carry out is
		1 for any two inputs high, not just for all three. The carry out is 1 in four of the eight rows, not one.
	</p>
</Aside>

<h2>Building it from two half adders</h2>
<p>
	You do not have to design the full adder from scratch. The neat way is to use the chip you already made. The first
	half adder adds a and b, giving a first sum and a first carry. The second half adder adds that first sum to the carry
	in, giving the final sum and a second carry. The final carry out is the first carry OR the second carry. That is the
	whole circuit: two half adders and one OR gate.
</p>

<Aside kind="why" title="why is an OR enough for the two carries?">
	<p>
		Because the two carries can never both be 1 at the same time. The first carry is 1 only when a and b are both 1, and
		then the first sum is 0. The second half adder adds that 0 to the carry in, and 0 plus anything never carries. So at
		most one of the two carries is ever 1, and an OR gate simply passes whichever one it is.
	</p>
</Aside>

<p>
	Count the gates and it comes to two XORs, two ANDs and one OR, five in all. Whether you draw it as five gates or as
	two half adder chips and an OR, it is the same truth table, and the truth table is the thing that matters.
</p>

<h2>Build it</h2>
<p>
	In the simulator, place two of your half adder chips and an OR gate. Wire toggles a and b into the first chip. Wire
	its sum output and a third toggle, the carry in, into the second chip. The second chip's sum is the full adder's sum.
	Wire both chips' carry outputs into the OR, and the OR's output is the carry out. Check all eight rows against the
	table above, then package the whole thing as a chip called "full adder". In the next lesson you will place four of
	them in a row.
</p>

<h2>What to remember</h2>
<ul>
	<li>A full adder adds three bits: a, b and the carry in from the column to its right.</li>
	<li>The sum is a XOR b XOR carry in: 1 when an odd number of inputs are 1.</li>
	<li>The carry out is 1 when at least two of the three inputs are 1, the majority rule.</li>
	<li>Two half adders and an OR gate make a full adder; the two carries are never both 1.</li>
</ul>
