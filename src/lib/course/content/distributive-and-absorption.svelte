<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LawProof from '$lib/course/widgets/LawProof.svelte';
</script>

<h2>Multiplying out: AND over OR</h2>
<p>
	The laws in the last lesson each dealt with one operation at a time. The next two say how AND and OR behave when they
	meet, and they are the ones that do most of the work in a real simplification. The first is the
	<strong>distributive law</strong>: <span class="mono">a ∧ (b ∨ c) = a ∧ b ∨ a ∧ c</span>. In engineering notation it
	reads a(b + c) = ab + ac, which is exactly the rule for multiplying out a bracket in ordinary algebra, and it works
	here for the same reason. "a, and at least one of b and c" is the same as "a and b, or a and c".
</p>

<LawProof name="Distributivity" form={0} />

<p>
	It is used in both directions. Left to right multiplies a bracket out, which usually makes an expression longer. Right
	to left takes a shared term out of two terms and puts it in front of a bracket, which makes it shorter. Both are the
	same law, and the truth table above proves both at once.
</p>

<h2>The one arithmetic does not have: OR over AND</h2>
<p>
	Now the surprise. Boolean algebra also has <span class="mono">a ∨ b ∧ c = (a ∨ b) ∧ (a ∨ c)</span>: OR distributes
	over AND too. In arithmetic a + bc is certainly not (a + b)(a + c), so this one cannot be taken on trust. Check it on
	the table.
</p>

<LawProof name="Distributivity" form={1} />

<p>
	The reason it holds is worth seeing. If a is 1, the left side is 1 by annulment, and each bracket on the right is 1 as
	well, so the right side is 1. If a is 0, the left side is just b ∧ c, and each bracket on the right is just b or just
	c, so the right side is b ∧ c too. Both cases agree, and there are no other cases.
</p>

<Aside kind="why" title="why here and not in arithmetic?">
	<p>
		Multiply out (a + b)(a + c) in arithmetic and you get aa + ac + ab + bc. In boolean algebra aa is a by idempotence,
		and then a ∨ ac ∨ ab is a by the absorption law below, leaving a ∨ bc. The extra terms that stop it working in
		arithmetic simply vanish here, because there is no 2 and a term cannot be bigger than 1.
	</p>
</Aside>

<h2>Absorption: a term that adds nothing</h2>
<p>
	<strong>Absorption</strong> says <span class="mono">a ∨ a ∧ b = a</span>. Think about what the second term could ever
	do. If a is 1, the OR is already 1, and a ∧ b is not needed. If a is 0, then a ∧ b is 0 as well, and it adds nothing.
	So a ∧ b never changes the answer, and the whole gate that computes it can be removed. The dual form is
	<span class="mono">a ∧ (a ∨ b) = a</span>: if a is 1 the bracket is 1 and the AND gives a; if a is 0 the AND gives 0,
	which is a again.
</p>

<LawProof name="Absorption" form={0} />

<p>
	Absorption is the single most common simplification, and the easiest to spot: a term that contains another term of the
	same expression is swallowed by the shorter one. It can also be proved from the laws you already have, which is a good
	first taste of how a derivation reads.
</p>

<div class="example">
	<p><strong>Worked example.</strong> Prove absorption, <span class="mono">a ∨ a ∧ b = a</span>, using earlier laws.</p>
	<p>
		Start with <span class="mono">a ∨ a ∧ b</span>. By identity, a is the same as a ∧ 1, so write
		<span class="mono">a ∧ 1 ∨ a ∧ b</span>. Both terms now share a, so apply the distributive law right to left and
		take it out: <span class="mono">a ∧ (1 ∨ b)</span>. By annulment, 1 ∨ b is 1, giving
		<span class="mono">a ∧ 1</span>. By identity again, that is <span class="mono">a</span>. Four lines, each one a law
		from the previous lesson, and the truth table above agrees.
	</p>
</div>

<Aside kind="mistake" title="cancelling the a">
	<p>
		Seeing <span class="mono">a ∨ a ∧ b</span>, some people cross out the two a's as if they were cancelling a fraction,
		and are left with b. There is no cancelling in boolean algebra, because there is no subtraction and no division. The
		a's do not cancel; the shorter term swallows the longer one, and the answer is a, not b. Try a = 0, b = 1 on the
		widget above: the expression gives 0, and b would have given 1.
	</p>
</Aside>

<h2>Consensus: the term that looks necessary</h2>
<p>
	The last law here is harder to spot by eye. <strong>Consensus</strong> says
	<span class="mono">a ∧ b ∨ ¬a ∧ c ∨ b ∧ c = a ∧ b ∨ ¬a ∧ c</span>. The third term, b ∧ c, is built from the other two
	with the shared letter a removed, and it turns out to be covered by them already. Whenever b ∧ c is 1, look at a. If a
	is 1, then a ∧ b is 1. If a is 0, then ¬a ∧ c is 1. Either way, the OR was already 1 without the third term, so it can
	go.
</p>

<LawProof name="Consensus" form={0} />

<p>
	That third term is called the consensus term. People adding a term "to be safe" often add exactly this one, and
	minimising tools spend a lot of their time taking it back out. There is a dual form for brackets, listed on the
	<a href="/boolean-algebra-laws#law-consensus">laws page</a>, and it works the same way with the operators swapped.
</p>

<Aside kind="tip">
	<p>
		Every law in this stage comes in a pair, with AND and OR swapped and 0 and 1 swapped. If you know one form, you know
		the other. This is called duality, and it halves what there is to remember.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>Distributive: a ∧ (b ∨ c) = a ∧ b ∨ a ∧ c, like multiplying out a bracket. Use it both ways.</li>
	<li>Unlike arithmetic, it also works the other way round: a ∨ b ∧ c = (a ∨ b) ∧ (a ∨ c).</li>
	<li>Absorption: a ∨ a ∧ b = a and a ∧ (a ∨ b) = a. A term containing another term is swallowed by it.</li>
	<li>Consensus: in a ∧ b ∨ ¬a ∧ c ∨ b ∧ c, the term b ∧ c is already covered and can go.</li>
	<li>Every law has a dual with AND and OR swapped.</li>
</ul>
