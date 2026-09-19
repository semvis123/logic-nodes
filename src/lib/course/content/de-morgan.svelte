<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
	import DeMorganPair from '$lib/course/widgets/DeMorganPair.svelte';
</script>

<h2>Not both, and not either</h2>
<p>
	Suppose you are told "you do not have both your keys and your phone". What do you know? That at least one of them is
	missing: no keys, or no phone, or neither. "Not both" means "at least one is missing". Now suppose you are told "you
	have neither your keys nor your phone". That is stronger: no keys, and no phone. "Not either" means "both are
	missing". Those two sentences are <strong>De Morgan's laws</strong>, and they are the rules for moving a NOT through a
	bracket.
</p>
<p>
	The first law: <span class="mono">¬(a ∧ b) = ¬a ∨ ¬b</span>. Not both means at least one is missing, which is an OR of
	the NOTs. Click through every row below and watch the two lamps agree.
</p>

<DeMorganPair left="!(a & b)" right="!a | !b" />

<p>
	The second law: <span class="mono">¬(a ∨ b) = ¬a ∧ ¬b</span>. Not either means both are missing, which is an AND of
	the NOTs.
</p>

<DeMorganPair left="!(a | b)" right="!a & !b" />

<p>
	Put the two together and the pattern is one rule: to push a NOT through a bracket, <strong
		>negate every term inside and swap the operator</strong
	>, AND for OR or OR for AND. In engineering notation, where NOT is a bar drawn over the whole bracket, the rule is
	remembered as "break the line, change the sign": the bar breaks into a bar over each term, and the operator under the
	break flips.
</p>

<h2>How to apply it</h2>
<p>Three moves, always in this order:</p>
<ol>
	<li>Take the NOT off the bracket.</li>
	<li>
		Put a NOT on every term that was inside it. A term that already had a NOT now has two, and they cancel by double
		negation.
	</li>
	<li>Swap the operator between those terms: AND becomes OR, OR becomes AND.</li>
</ol>

<div class="example">
	<p><strong>Worked example.</strong> Rewrite <span class="mono">¬(a ∧ ¬b)</span> so that no NOT covers a bracket.</p>
	<p>
		Take the NOT off the bracket and put one on each term: ¬a and ¬¬b. Swap the AND for an OR:
		<span class="mono">¬a ∨ ¬¬b</span>. The two NOTs on b cancel by double negation, leaving
		<span class="mono">¬a ∨ b</span>. Check it in words: "not (a and not b)" means "a is missing, or b is present",
		which is what the answer says.
	</p>
</div>

<p>
	When brackets are nested, work from the outside in. The outer NOT sees an inner bracket as a single term, so that term
	gets a NOT of its own and waits its turn. <span class="mono">¬((a ∧ b) ∨ c)</span> becomes
	<span class="mono">¬(a ∧ b) ∧ ¬c</span> on the first pass, and then the inner NOT is pushed in the same way to give
	<span class="mono">(¬a ∨ ¬b) ∧ ¬c</span>.
</p>

<LiveExpression
	expression="!((a & b) | c)"
	label="¬((a ∧ b) ∨ c), the nested example. Check it against (¬a ∨ ¬b) ∧ ¬c row by row."
/>

<h2>In pictures: bubble pushing</h2>
<p>
	On a circuit drawing, the NOT on a gate's output is drawn as a small circle, called a <strong>bubble</strong>. A NAND
	gate is an AND gate with a bubble on its output. De Morgan says that this is the same part as an OR gate with a bubble
	on each input, because ¬(a ∧ b) is ¬a ∨ ¬b. Likewise a NOR gate, an OR with a bubbled output, is an AND with both
	inputs bubbled. The rule for drawings is: a bubble may be moved from a gate's output to all of its inputs, or back, as
	long as the gate's shape is swapped at the same time. Engineers call this bubble pushing, and use it to redraw a
	circuit so that it reads the way it was thought about.
</p>

<Aside kind="why" title="why this matters for real chips">
	<p>
		Because a NAND gate on its own can build every other gate, and NAND is one of the cheapest gates to make in silicon,
		so a great deal of real hardware is built from it. De Morgan is the law that turns an OR into a NAND with inverted
		inputs, which is how the OR that NAND seems to lack is built. The <a href="/nand-nor-converter"
			>NAND and NOR converter</a
		> does this to a whole expression and counts the gates it takes.
	</p>
</Aside>

<h2>Any number of inputs</h2>
<p>
	The laws are not limited to two terms. <span class="mono">¬(a ∧ b ∧ c) = ¬a ∨ ¬b ∨ ¬c</span>, and the same for OR,
	however long the chain. This follows from the two-input law applied twice, because a ∧ b ∧ c is (a ∧ b) ∧ c, but in
	practice you treat the whole chain at once: negate every term, swap every operator.
</p>

<DeMorganPair left="!(a & b & c)" right="!a | !b | !c" />

<h2>The mistake everyone makes once</h2>
<p>
	The error is to push the NOT onto each term and forget to swap the operator, writing
	<span class="mono">¬(a ∧ b)</span> as <span class="mono">¬a ∧ ¬b</span>. That says "both are missing", which is the
	second sentence from the start of this lesson, not the first. The widget below marks the rows where the two disagree.
</p>

<DeMorganPair left="!(a & b)" right="!a & !b" label="The wrong rewrite. Find a row where the lamps differ." />

<Aside kind="mistake" title="dropping the bar instead of breaking it">
	<p>
		Set a to 1 and b to 0. Then a ∧ b is 0, so ¬(a ∧ b) is 1: they are not both present. But ¬a ∧ ¬b is 0 ∧ 1, which is
		0. The two differ, so the rewrite was wrong. The bar has to break, and the sign has to change, every time. The
		opposite slip, swapping the operator but forgetting to negate the terms, is just as wrong: ¬(a ∧ b) is not a ∨ b
		either.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>¬(a ∧ b) = ¬a ∨ ¬b: "not both" is "at least one is missing".</li>
	<li>¬(a ∨ b) = ¬a ∧ ¬b: "not either" is "both are missing".</li>
	<li>To push a NOT through a bracket, negate every term and swap the operator. Break the line, change the sign.</li>
	<li>It works for any number of terms, and for nested brackets from the outside in.</li>
	<li>On a drawing, a bubble moves from a gate's output to all its inputs if the gate's shape is swapped.</li>
</ul>
