<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
	import TableToSop from '$lib/course/widgets/TableToSop.svelte';
</script>

<h2>You have the table. Where is the circuit?</h2>
<p>
	By now you can describe what you want a circuit to do by writing its truth table: one row for every combination of the
	inputs, and against each row the output you want, 1 or 0. What you do not yet have is a way to get from that table to
	a set of gates. This lesson gives you one. It is a recipe that works for any truth table at all, with no cleverness
	required. The price is that the circuit it produces is nearly always bigger than it needs to be, and the rest of this
	stage is about making it smaller.
</p>

<h2>One row, one AND gate</h2>
<p>
	Look at a single row where the output is 1. Say the inputs are <span class="mono">a</span>,
	<span class="mono">b</span> and <span class="mono">c</span>, and on this row they are 0, 1 and 1. Can you build a term
	that is 1 on this row and on no other? Yes: AND all three inputs together, with a NOT in front of any input that is 0
	on the row. Here that gives NOT a, AND b, AND c. When a is 0 and b and c are 1, every part of the AND is 1, so the
	term is 1. Change any input and one part becomes 0, so the whole term does. The term picks out exactly one row.
</p>

<Aside kind="term" title="minterm">
	<p>
		A <strong>minterm</strong> is an AND of every input, each one either plain or with a NOT, so that it is 1 on exactly
		one row of the truth table. Written the way this course writes it, the minterm for the row above is
		<span class="mono">a̅·b·c</span>: a bar over a letter means NOT, and a dot means AND. The tools on this site write
		the same thing as <span class="mono">¬a ∧ b ∧ c</span> or <span class="mono">a'bc</span>.
	</p>
</Aside>

<LiveExpression
	expression="!a & b & c"
	label="One minterm, a̅·b·c. Click the inputs: only one row of the table lights it."
	outputLabel="m3"
/>

<h2>Numbering the rows</h2>
<p>
	Every row has a number. Read the inputs on the row as a binary number, with the first input as the most significant
	bit, exactly as you did when counting in binary. The row with a = 0, b = 1, c = 1 reads as 011, which is 3, so its
	minterm is called <span class="mono">m3</span>. The row a = 1, b = 0, c = 1 is 101, which is 5, so its minterm is
	<span class="mono">m5 = a·b̅·c</span>. With three inputs the rows run from m0 to m7, and with four from m0 to m15.
	Engineers list the rows where a function is 1 as
	<span class="mono">Σm(1, 3, 6, 7)</span>, read "the sum of minterms 1, 3, 6 and 7", which says everything about the
	function in a few characters.
</p>

<Aside kind="why" title="why does the count start at 0?">
	<p>
		Because the row number is the binary value of the inputs, and the first row, where every input is 0, has the value
		0. Starting at 1 would break the link between the row number and the bits in it. That link is what lets you write
		the minterm straight from its number: m5 is 101, so a and c are plain and b gets a bar.
	</p>
</Aside>

<h2>OR them all together: the sum of products</h2>
<p>
	Now take every row where the output is 1, write its minterm, and OR all those minterms together. The result is an
	expression that matches the truth table on every row. Here is why it always works. On a row where the table says 1,
	that row's own minterm is 1, and an OR with any 1 in it is 1. On a row where the table says 0, no minterm was written
	for that row, and every minterm that was written belongs to some other row, so all of them are 0, and an OR of 0s is
	0. Whatever the table, the expression agrees with it.
</p>

<Aside kind="term" title="sum of products">
	<p>
		In boolean algebra an AND is often called a product and an OR a sum, so an OR of AND terms is a
		<strong>sum of products</strong>, or SOP. When every term is a full minterm, with every input in it, the expression
		is the <strong>canonical</strong> sum of products: the one that comes straight off the table with no thinking.
	</p>
</Aside>

<div class="example">
	<p>
		<strong>Worked example.</strong> A function of a, b and c is 1 on rows 1, 3, 6 and 7 and 0 everywhere else. Write its
		canonical sum of products.
	</p>
	<p>
		Row 1 is 001, so its minterm is <span class="mono">a̅·b̅·c</span>. Row 3 is 011: <span class="mono">a̅·b·c</span>. Row
		6 is 110: <span class="mono">a·b·c̅</span>. Row 7 is 111: <span class="mono">a·b·c</span>. OR them together:
	</p>
	<p class="mono">a̅·b̅·c + a̅·b·c + a·b·c̅ + a·b·c</p>
	<p>As a circuit: four AND gates with three inputs each, one OR gate with four inputs, and NOT gates for the bars.</p>
</div>

<p>
	The table below starts with that same function. Click the output cells and watch the expression rewrite itself, one
	minterm per 1.
</p>

<TableToSop variables={['a', 'b', 'c']} ones={[1, 3, 6, 7]} />

<Aside kind="mistake" title="putting the bar on the wrong inputs">
	<p>
		The bar goes on the inputs that are <em>0</em> in the row, not the ones that are 1. It is easy to reverse this, because
		the bar feels like it should mark something special and the 1s feel special. Remember what the bar is for: a NOT turns
		that 0 into a 1 so the AND can fire. An input that is already 1 needs no help.
	</p>
</Aside>

<h2>Why it is usually too big</h2>
<p>
	Look again at the worked example. The last line of the widget shows the same function as
	<span class="mono">a·b + a̅·c</span>: two AND gates with two inputs each and one OR gate, instead of four three-input
	ANDs and a four-input OR. Both give the same output on all eight rows, so they are the same function and either
	circuit would do. The canonical form is big because it treats every 1 as a separate case, when several rows often
	share a simpler reason for being 1. Rows 6 and 7 are both 1 because a and b are 1; c does not matter, so c should not
	be in the term. Spotting those shared reasons is the job of the next three lessons.
</p>

<Aside kind="why" title="why bother with the big version at all?">
	<p>
		Because it is guaranteed. A designer can always fall back on it, a computer can produce it without any judgement,
		and every method of minimising starts from it: a Karnaugh map is the canonical form drawn as a picture, and the
		Quine-McCluskey method is the canonical form processed as a list. You need the long version to have something to
		shorten.
	</p>
</Aside>

<h2>The mirror image: product of sums</h2>
<p>
	There is a second recipe that uses the rows where the output is 0. For each such row, write an OR of every input, this
	time with a bar on the inputs that are <em>1</em>. That term, called a <strong>maxterm</strong>, is 0 on exactly its
	own row. AND all the maxterms together and you get an AND of OR terms, a <strong>product of sums</strong>, which is 0
	exactly where the table is 0. It is the same function again. When a table has only a few 0s the product of sums is the
	shorter of the two, which is why the sum of products calculator shows both.
</p>

<h2>What to remember</h2>
<ul>
	<li>A minterm is an AND of every input, barred where the row has a 0, so it is 1 on one row only.</li>
	<li>Rows are numbered by reading their inputs as a binary number, so m5 is the row 101.</li>
	<li>OR the minterms of every row that is 1 and you have the canonical sum of products, which always works.</li>
	<li>It is usually far bigger than necessary because rows often share a simpler reason for being 1.</li>
	<li>Doing the same with the 0 rows, ORs inside an AND, gives the product of sums.</li>
</ul>
