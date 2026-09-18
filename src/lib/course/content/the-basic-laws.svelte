<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LawProof from '$lib/course/widgets/LawProof.svelte';
</script>

<h2>What a law is</h2>
<p>
	Two expressions can look different and still be the same circuit. <span class="mono">a ∧ b</span> and
	<span class="mono">b ∧ a</span> are wired differently on paper and give the same output on every row of the truth
	table. When that happens the two expressions are <strong>equivalent</strong>, and either can be swapped for the other
	anywhere it appears without anything changing. A <strong>law</strong> is an equivalence that holds no matter what the letters
	stand for, so it can be used again and again on any expression. The laws are how a big expression is turned into a smaller
	one that does the same job, which in a circuit means fewer gates.
</p>

<Aside kind="term" title="equivalent">
	<p>
		Two expressions are <strong>equivalent</strong> when their truth tables match on every row. Same inputs, same output,
		always. This lesson writes an equals sign between equivalent expressions, the way the reference pages do.
	</p>
</Aside>

<p>
	This lesson takes the seven simplest laws. Each has a one-line reason, and each is proved by a truth table you can
	click through. The names are the ones the <a href="/boolean-algebra-laws">laws page</a> on this site uses; other books
	sometimes use different ones, and those are noted where it matters.
</p>

<h2>Identity and annulment: the constants</h2>
<p>
	<strong>Identity:</strong> <span class="mono">a ∧ 1 = a</span> and <span class="mono">a ∨ 0 = a</span>. ANDing with 1
	changes nothing, because the AND's output is then decided entirely by a. ORing with 0 changes nothing, because a 0
	adds nothing to an OR. In a circuit, an AND gate with one input tied to 1 is just a wire.
</p>

<LawProof name="Identity" form={0} />

<p>
	<strong>Annulment:</strong> <span class="mono">a ∧ 0 = 0</span> and <span class="mono">a ∨ 1 = 1</span>. A single 0
	into an AND forces the output to 0 whatever a is, and a single 1 into an OR forces it to 1. Some books call this the
	null law or the domination law. It is the reason a wire stuck at the wrong value can switch off a whole section of a
	circuit.
</p>

<h2>Idempotence and complement: a signal with itself</h2>
<p>
	<strong>Idempotence:</strong> <span class="mono">a ∧ a = a</span> and <span class="mono">a ∨ a = a</span>. The word
	means "same power": doing the operation with the same signal twice is no different from once. Feed one wire into both
	inputs of an AND gate and you have built a wire.
</p>

<Aside kind="mistake" title="a ∨ a is not 2a">
	<p>
		In ordinary algebra a + a is 2a, and habit wants to write the same here. There is no 2 in boolean algebra. The only
		values are 0 and 1, and 1 ∨ 1 is 1. So a ∨ a is a, a ∧ a is a, and there is nothing to carry or double. Whenever
		school algebra and boolean algebra disagree, the truth table decides, and the truth table has only two rows here.
	</p>
</Aside>

<p>
	<strong>Complement:</strong> <span class="mono">a ∧ ¬a = 0</span> and <span class="mono">a ∨ ¬a = 1</span>. Exactly
	one of a and ¬a is 1 at any moment, so the AND can never fire and the OR always does. This law is what makes a term
	vanish, or an expression collapse to a constant, in the middle of a simplification.
</p>

<LawProof name="Complement" form={1} />

<h2>Double negation: two NOTs cancel</h2>
<p>
	<strong>Double negation:</strong> <span class="mono">¬¬a = a</span>. Inverting a signal twice gives it back. Some
	books call this involution. It looks too obvious to need a name, but it is used constantly, because other laws often
	leave two NOTs stacked on one letter and this is what tidies them away.
</p>

<h2>Commutativity and associativity: order and grouping</h2>
<p>
	<strong>Commutativity:</strong> <span class="mono">a ∧ b = b ∧ a</span> and <span class="mono">a ∨ b = b ∨ a</span>.
	Swapping the inputs of a gate changes nothing, because a gate has no idea which of its inputs is which.
</p>
<p>
	<strong>Associativity:</strong> <span class="mono">(a ∧ b) ∧ c = a ∧ (b ∧ c)</span> and the same for OR. When the same
	operation is used twice in a row, it does not matter which pair is done first, so the brackets can be dropped and
	<span class="mono">a ∧ b ∧ c</span> means the same whichever way it is grouped. This is why a three-input AND gate is a
	sensible thing to draw, and why a wide OR can be built from a chain of two-input ones.
</p>

<LawProof name="Associativity" form={0} />

<h2>How a truth table proves a law</h2>
<p>
	A law is a claim about every possible input, so to prove one you check every possible input. With one letter there are
	two rows, with two letters four, with three letters eight: 2<sup>n</sup> rows for n letters, as you saw in the first stage.
	Work out both sides on every row. If the two columns match all the way down, the law is proved, and not just tested, because
	there are no other cases to try.
</p>

<div class="example">
	<p><strong>Worked example.</strong> Prove that <span class="mono">a ∨ ¬a = 1</span>.</p>
	<p>
		There is one letter, so two rows. When a = 0: ¬a is 1, and 0 ∨ 1 is 1. When a = 1: ¬a is 0, and 1 ∨ 0 is 1. The left
		side is 1 on both rows, and the right side is the constant 1, which is 1 on both rows too. The columns match, so the
		law holds. That is the whole proof: two rows, no cleverness needed.
	</p>
</div>

<Aside kind="why" title="if a table settles it, why learn laws?">
	<p>
		Because a table only answers yes or no about two expressions you already have. It cannot tell you what the smaller
		expression is; it can only confirm one once you have guessed it. The laws are how you find it. They also scale: a
		table for ten inputs has 1024 rows, but a law is one line whatever the number of inputs.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>Equivalent expressions have the same truth table. A law is an equivalence that always holds.</li>
	<li>Identity: 1 in an AND or 0 in an OR changes nothing. Annulment: 0 in an AND or 1 in an OR decides everything.</li>
	<li>Idempotence: a with itself is a. Complement: a with ¬a is 0 for AND and 1 for OR.</li>
	<li>
		Double negation: two NOTs cancel. Commutativity: order does not matter. Associativity: grouping does not matter.
	</li>
	<li>A truth table with all 2<sup>n</sup> rows checked is a complete proof.</li>
</ul>
