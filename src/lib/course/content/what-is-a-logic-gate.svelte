<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>A box with a rule</h2>
<p>
	So far a wire has only ever carried a bit from one place to another. Nothing has been <em>done</em> to it. A
	<strong>logic gate</strong> is the smallest thing that does something: a little circuit with a few wires going in, one
	wire coming out, and a fixed rule that decides what the output is from what the inputs are. That is all a gate is. It does
	not remember anything, it does not wait for anything, and it has no settings. Put values on its inputs and, a moment later,
	the rule has put a value on its output.
</p>
<p>
	Here is one gate to try. Its rule is "output 1 only when both inputs are 1". Click the inputs and watch the output
	wire change colour.
</p>

<LiveGate gate="and" />

<Aside kind="term" title="logic gate">
	<p>
		A <strong>logic gate</strong> is a small circuit with one or more inputs and exactly one output, each carrying a 1 or
		a 0, whose output is fixed by a rule applied to the inputs as they are right now. This one is called AND; the next lesson
		is about it.
	</p>
</Aside>

<h2>Why the rule is the whole story</h2>
<p>
	Because every input can only be 0 or 1, a gate can only ever be asked a small number of questions. A gate with two
	inputs can see four situations: both off, only the second on, only the first on, both on. That is the same counting
	you did with bits in the last stage: two bits, four patterns. A three-input gate sees eight situations, a four-input
	gate sixteen. In general, <em>n</em> inputs give 2<sup>n</sup> situations, and each one has an answer.
</p>
<p>
	So if you write down the answer for every situation, you have described the gate completely. There is nothing left to
	say about it. Two gates built in completely different ways, one from transistors and one from relays or from two
	switches on a battery, are the <em>same gate</em> if their lists of answers match. Engineers call that list a truth table,
	and it is the one tool you will use in every lesson from here on.
</p>

<Aside kind="term" title="truth table">
	<p>
		A <strong>truth table</strong> lists every combination of inputs a gate can see, one per row, with the output the
		gate gives for each. The inputs are the left-hand columns and the output is the right-hand one. A gate with
		<em>n</em> inputs has a table of 2<sup>n</sup> rows. The name is from logic, where 1 is "true" and 0 is "false".
	</p>
</Aside>

<h2>Reading a truth table</h2>
<p>
	Look at the table under the gate above. The two left columns are the inputs <span class="mono">a</span> and
	<span class="mono">b</span>. Read the rows top to bottom and you will see the inputs counting up in binary: 00, 01,
	10, 11. That is the convention everywhere, and it is why counting in binary came before this lesson. Row one is always
	all zeros, the last row is always all ones, and every pattern appears exactly once in between. The right column,
	<span class="mono">out</span>, is the answer for that row.
</p>
<p>
	To read the table for a particular case, find the row whose inputs match and read across. To write one for a gate you
	are describing, put the input columns down first, counting up from all zeros, and only then think about the output
	column one row at a time. Writing the inputs in counting order is what stops you from missing a row or listing one
	twice.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> The gate above has the rule "1 only when both inputs are 1". Fill in its truth table.
	</p>
	<p>
		Two inputs, so 2<sup>2</sup> = 4 rows. Write the inputs counting up: 00, 01, 10, 11. Now the rule, row by row. 00:
		both are 0, not both 1, so 0. 01: only <span class="mono">b</span> is 1, so 0. 10: only <span class="mono">a</span>
		is 1, so 0. 11: both are 1, so 1. The output column reads <span class="mono">0, 0, 0, 1</span>, which is what the
		widget shows.
	</p>
</div>

<p>Here is a gate with three inputs and the same rule, so you can see a table with eight rows. Click through them.</p>

<LiveExpression
	expression="a & b & c"
	label="Three inputs, eight rows. The rule is still: 1 only when every input is 1."
/>

<Aside kind="why" title="why does the order of the rows matter?">
	<p>
		It does not change what the gate does, but it matters to people. If every table on the site, in every textbook and
		in every datasheet counts up from 0, then you can compare two tables by looking at their output columns alone, and
		you can find a row without searching. The output column on its own, read top to bottom, becomes a kind of
		fingerprint for the gate: <span class="mono">0001</span> is the gate above and nothing else.
	</p>
</Aside>

<Aside kind="mistake" title="reading the row number as the answer">
	<p>
		It is easy to look up "a = 1, b = 0" and come back with "row 3", or with the input pattern 10 itself, rather than
		with the value in the output column. The row is where you look; the output column is what you read. Put your finger
		on the input columns, slide it right, and only then read.
	</p>
</Aside>

<h2>What comes next</h2>
<p>
	There are seven gates with names, and this stage takes them a couple at a time. Every one of them is just a different
	output column over the same input columns. Once you can read a truth table, no gate can surprise you: if you are ever
	unsure what a gate does, its table settles it.
</p>

<h2>What to remember</h2>
<ul>
	<li>A logic gate has inputs and one output, and a fixed rule that decides the output from the inputs right now.</li>
	<li>A gate with <em>n</em> inputs can see 2<sup>n</sup> different input combinations.</li>
	<li>A truth table lists every combination with the gate's output for it, and describes the gate completely.</li>
	<li>The input columns count up in binary from all zeros, so every combination appears exactly once.</li>
	<li>Two gates with the same truth table are the same gate, however they are built.</li>
</ul>
