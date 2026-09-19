<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveHalfAdder from '$lib/course/widgets/LiveHalfAdder.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
</script>

<h2>Adding two bits</h2>
<p>
	Everything so far has been about moving 1s and 0s around. This stage is about making them do arithmetic, and it starts
	with the smallest sum there is: one bit plus one bit. There are only four cases, because each bit is 0 or 1. Three of
	them are easy. 0 + 0 is 0, 0 + 1 is 1, and 1 + 0 is 1. The fourth is the interesting one. 1 + 1 is two, and two does
	not fit in a single bit. In binary, two is written <span class="mono">10</span>: a 0 in the ones column and a 1
	carried into the twos column, exactly as 5 + 5 in decimal gives a 0 and a carry of 1.
</p>
<p>
	So adding two bits needs <em>two</em> output bits. The right hand one is called the <strong>sum</strong>, and it is
	what stays in this column. The left hand one is called the <strong>carry</strong>, and it is what moves to the next
	column on the left. Write out all four cases with both outputs and you have the truth table of a circuit.
</p>

<LiveHalfAdder />

<h2>Two columns, two gates</h2>
<p>
	Now look at each output column on its own, ignoring the other. The sum column reads 0, 1, 1, 0 for the inputs 00, 01,
	10, 11. That is 1 exactly when the two inputs are different, which is the XOR gate from stage 2. The carry column
	reads 0, 0, 0, 1: a 1 only when both inputs are 1, which is AND. So the whole circuit is one XOR gate and one AND
	gate, both fed from the same two inputs. Two gates, and you can add.
</p>

<Aside kind="term" title="half adder">
	<p>
		A <strong>half adder</strong> is the circuit that adds two single bits and gives a sum and a carry out. It is an XOR
		for the sum and an AND for the carry. The "half" is explained below.
	</p>
</Aside>

<p>Here is the XOR on its own, so you can check the sum column against it row by row:</p>

<LiveGate gate="xor" />

<div class="example">
	<p><strong>Worked example.</strong> A half adder is given a = 1 and b = 1. What does it output?</p>
	<p>
		As numbers, 1 + 1 = 2, and 2 in binary is <span class="mono">10</span>. The right bit, 0, is the sum; the left bit,
		1, is the carry. Check with the gates: 1 XOR 1 is 0, so the sum is 0, and 1 AND 1 is 1, so the carry is 1. Both ways
		agree: sum 0, carry 1.
	</p>
</div>

<Aside kind="mistake" title="using OR for the sum">
	<p>
		It is tempting to think "adding is OR", because 0 OR 1 is 1 just as 0 + 1 is 1. But 1 OR 1 is 1, and 1 + 1 is not 1.
		The sum column needs a gate that gives 0 for two 1s, and that is XOR. OR throws the carry away and gets the last row
		wrong.
	</p>
</Aside>

<h2>Why "half"?</h2>
<p>
	Think about adding two numbers of several digits on paper. In every column but the first, you add three things: the
	two digits and whatever was carried in from the column to the right. The half adder adds only two. It can send a carry
	out, but it has no input to take a carry in, so it can only ever be the rightmost column of a bigger adder. It does
	half the job, which is where the name comes from. The next lesson adds the missing input.
</p>

<Aside kind="why" title="why bother with such a small circuit?">
	<p>
		Because everything larger is made of it. A full adder is two half adders and an OR gate. A four bit adder is four
		full adders in a row. The calculator example in the simulator is built exactly that way, and if you make the half
		adder once and package it as a reusable chip, each later step is only a little harder than the one before.
	</p>
</Aside>

<h2>Build it</h2>
<p>
	Open the simulator and place two toggles, an XOR gate and an AND gate from the Logic menu, and two displays. Wire both
	toggles into both gates, the XOR's output to one display for the sum, and the AND's output to the other for the carry.
	Click through the four input combinations and check them against the table above. When it works, select the whole
	thing and use File, then Create node, to turn it into a chip called "half adder". You will want it in the next lesson.
</p>

<h2>What to remember</h2>
<ul>
	<li>Adding two bits gives 0, 1 or 2, and 2 needs two bits: a sum of 0 and a carry of 1.</li>
	<li>The sum column of the table is XOR; the carry column is AND.</li>
	<li>A half adder is one XOR and one AND fed from the same two inputs.</li>
	<li>It is "half" because it has no carry in, so it can only be the rightmost column of an adder.</li>
</ul>
