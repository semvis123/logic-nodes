<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
	import NotationTable from '$lib/course/widgets/NotationTable.svelte';
</script>

<h2>Why write it down at all</h2>
<p>
	A drawing of a circuit is a good way to see it and a poor way to think about it. Two drawings can be the same circuit
	with the gates shuffled about, and you would not spot it. Drawings cannot be compared, checked or made smaller by any
	rule you could write down. Text can. So the first move in this stage is to stop drawing gates and start writing them,
	as an <strong>expression</strong>: a single line of symbols that says exactly what a circuit computes.
</p>

<Aside kind="term" title="expression and boolean algebra">
	<p>
		An <strong>expression</strong> is a line of text built from input names, the three operations AND, OR and NOT, and
		brackets. <strong>Boolean algebra</strong> is the set of rules for working with such expressions, named after George
		Boole, who worked them out in the mid-1800s, long before there were any circuits to apply them to. There are only two
		values, 1 and 0, and only those three operations, which is what makes it so much smaller than school algebra.
	</p>
</Aside>

<h2>Three ways of writing the same thing</h2>
<p>
	Three groups of people use boolean algebra, and each writes it their own way. Logicians and maths books write AND as
	∧, OR as ∨ and NOT as ¬ in front of the thing it inverts. Engineers write AND by putting the letters side by side, OR
	as a plus sign, and NOT as a bar drawn over the top of whatever is inverted; since a bar is hard to type, this site
	writes that bar as a prime, so a with a bar over it appears as <span class="mono">a'</span>. Programmers write AND as
	<span class="mono">&amp;&amp;</span>, OR as <span class="mono">||</span> and NOT as <span class="mono">!</span>, and
	the single characters <span class="mono">&amp;</span> and <span class="mono">|</span> are accepted too, so
	<span class="mono">a &amp; b | !c</span> is fine. Type any of them into the tools on this site, or the words and, or and
	not, and they are all read the same way.
</p>

<NotationTable expression="a & b | !c" />

<p>
	Each row says the same thing: "a and b, or not c". It is one idea in three costumes, and it is worth being able to
	read all three, because you will meet each of them.
</p>

<Aside kind="why" title="why three notations?">
	<p>
		Because three different trades arrived at the same algebra from different directions. The maths symbols came from
		logic, the plus and the bar from the engineers who first drew circuits with them, and the programming symbols from
		the languages that needed them on a keyboard. None is better. The engineering one is the shortest, which is why
		textbooks and data sheets lean on it; the maths one is what the reference pages on this site use, and the
		programming one is the easiest to type into the tools.
	</p>
</Aside>

<h2>The order of operations</h2>
<p>
	In arithmetic, 2 + 3 × 4 is 14, not 20, because multiplication is done before addition. Boolean algebra has the same
	kind of rule. <strong>NOT is done first, then AND, then OR.</strong> So <span class="mono">a ∧ b ∨ c</span> means "a and
	b, or c": the AND happens first, and the OR joins its result with c. It is no accident that engineers write AND like multiplication
	and OR like addition; the order is the same as the one you already know.
</p>
<p>
	When you want a different order, you write brackets, exactly as in arithmetic. <span class="mono">a ∧ (b ∨ c)</span>
	means "a, and at least one of b and c", which is a different circuit. Try the expression below. It has two AND parts joined
	by an OR, and the NOTs apply only to the single letter after them.
</p>

<LiveExpression expression="a & !b | !a & c" label="a ∧ ¬b ∨ ¬a ∧ c. Click the inputs." />

<Aside kind="mistake" title="reading a ∧ b ∨ c as a ∧ (b ∨ c)">
	<p>
		Without brackets, AND grabs only its neighbours. In <span class="mono">a ∧ b ∨ c</span> the AND joins a and b and
		nothing else; c stands on its own, joined to the rest by the OR. Set a to 0 and c to 1: the unbracketed form gives
		1, because c alone is enough, while <span class="mono">a ∧ (b ∨ c)</span> gives 0, because a is required. If you are
		ever unsure, write the brackets in. They are never wrong, only sometimes unnecessary.
	</p>
</Aside>

<h2>From a circuit to an expression, and back</h2>
<p>
	To write down a circuit, start at the output and work backwards. The last gate before the output is the outermost
	operation of the expression, and each of its inputs is either a plain input name or a smaller circuit, which you write
	the same way. To build a circuit from an expression, do the reverse: the outermost operation is the last gate, and
	each part inside it is a gate before it. Brackets appear wherever the order of operations would otherwise split
	something that belongs together.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> An OR gate takes a and b. Its output and c go into an AND gate, and the AND gate's output
		goes through a NOT gate. Write the expression for the final output.
	</p>
	<p>
		The OR gate gives <span class="mono">a ∨ b</span>. The AND gate joins that whole result with c, so it needs brackets
		round the OR, or the AND would grab only b: <span class="mono">(a ∨ b) ∧ c</span>. The NOT gate inverts all of that,
		so it needs brackets round everything: <span class="mono">¬((a ∨ b) ∧ c)</span>. Reading it back, the outermost
		operation is the NOT, which is the last gate; inside it is the AND, the gate before; and inside that is the OR, the
		first gate. Three gates, three operations.
	</p>
</div>

<h2>Reading a value off an expression</h2>
<p>
	To find what an expression gives for particular inputs, replace each letter with its value and work from the inside
	out: NOTs first, then ANDs, then ORs, and anything in brackets before the thing outside it. Take
	<span class="mono">a ∧ ¬b ∨ ¬a ∧ c</span> with a = 1, b = 0 and c = 1. The NOTs first: ¬b is 1 and ¬a is 0. Then the ANDs:
	1 ∧ 1 is 1 and 0 ∧ 1 is 0. Then the OR: 1 ∨ 0 is 1. That is exactly what the widget above does for whichever row you have
	clicked, and a truth table is nothing more than this done for every row.
</p>

<Aside kind="tip">
	<p>
		When you write an expression, say it out loud as a sentence: "a and not b, or not a and c". If the sentence needs a
		pause to make sense, the expression needs a bracket there.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>An expression is a circuit written as text, using AND, OR, NOT and brackets.</li>
	<li>Maths writes ∧ ∨ ¬, engineering writes ab + c with a bar (a prime here), programming writes &amp;&amp; || !.</li>
	<li>NOT is done first, then AND, then OR. Brackets change that order.</li>
	<li>The last gate before the output is the outermost operation of the expression.</li>
	<li>To evaluate, put the values in and work from the inside out.</li>
</ul>
