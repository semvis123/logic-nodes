<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import KMapWidget from '$lib/course/widgets/KMapWidget.svelte';
</script>

<h2>Two rows that share a reason</h2>
<p>
	In the last lesson, rows 6 and 7 of a truth table were both 1, and both for the same reason: a and b were 1 and c did
	not matter. Their minterms, <span class="mono">a·b·c̅</span> and <span class="mono">a·b·c</span>, differ only in c.
	ORed together they say "a and b, with c either way", which is just <span class="mono">a·b</span>. This is the one rule
	that every method in this stage relies on: two terms that differ in exactly one input merge into one term without that
	input. Finding such pairs in a truth table is hard, because the rows that differ in one bit are scattered. Row 3 (011)
	and row 4 (100) sit next to each other and differ in every bit; row 1 (001) and row 5 (101) differ in one bit and sit
	four lines apart.
</p>

<h2>Fold the table so neighbours touch</h2>
<p>
	A Karnaugh map, named after Maurice Karnaugh who published it in 1953, is the truth table rearranged into a grid so
	that any two cells that are side by side differ in exactly one input. For two inputs that is a 2 by 2 grid: a picks
	the row, b picks the column. For three inputs the grid is 2 rows by 4 columns: a picks the row and the pair bc picks
	the column. The trick is the order of the column headings. Counting order would be 00, 01, 10, 11, but going from 01
	to 10 changes both bits, so those two columns would not be neighbours. Instead the headings run 00, 01, 11, 10, where
	each step changes one bit.
</p>

<Aside kind="term" title="Gray code">
	<p>
		<strong>Gray code</strong> is an ordering of binary patterns in which each pattern differs from the next in exactly one
		bit: 00, 01, 11, 10 for two bits. Compare it with counting in binary, where 01 to 10 flips two bits and 011 to 100 flips
		three. The headings of a Karnaugh map are always in Gray order, and the last heading is one bit away from the first,
		so the two ends of the map are neighbours as well.
	</p>
</Aside>

<p>
	Here is the two-input map. The cell numbers are the row numbers from the truth table. Click the cells: with two 1s
	side by side the widget draws a group and writes the term it stands for.
</p>

<KMapWidget variables={['a', 'b']} values={[0, 0, 1, 1]} label="Two inputs. Click a cell to change it." />

<h2>Circling groups</h2>
<p>
	Once the 1s are on the map, minimising becomes pattern spotting. Draw a loop round any rectangle of 1s whose size is
	1, 2 or 4 cells (or 8 or 16 on bigger maps: always a power of two). Each loop is one product term. To write it, look
	at the inputs: any input that has the same value in every cell of the loop stays in the term, plain if that value is 1
	and barred if it is 0. Any input that changes inside the loop drops out. A loop of two drops one input, a loop of four
	drops two, so bigger loops give shorter terms. Then OR the terms of all the loops together.
</p>
<p>The rules for the loops, all of which follow from that:</p>
<ul>
	<li>Every 1 must be inside at least one loop, or the expression would miss a row.</li>
	<li>A loop may contain only 1s. One 0 inside it would make the term fire on a row that should be 0.</li>
	<li>Loops may overlap. Using a 1 twice costs nothing, and it often lets both loops be bigger.</li>
	<li>Make each loop as big as you can, and use as few loops as you can.</li>
	<li>The map wraps: the left column is next to the right column, because 00 and 10 differ in one bit.</li>
</ul>

<Aside kind="why" title="why must a loop be a power of two?">
	<p>
		A loop of two merges one pair and drops one input. A loop of four is two such pairs that themselves differ in a
		second input, so it drops two. Every doubling drops one more input. Three cells cannot be described that way: there
		is no set of inputs whose "either way" gives exactly three rows. Three 1s in a line are a loop of two plus a loop of
		two that overlap, and that is two terms, not one.
	</p>
</Aside>

<div class="example">
	<p>
		<strong>Worked example.</strong> A function of a, b and c is 1 on rows 0, 2, 5 and 7. Find its minimal expression with
		a map.
	</p>
	<p>
		Draw the map with a down the side and bc across the top in the order 00, 01, 11, 10. Row a = 0 holds m0, m1, m3, m2
		in that order, and row a = 1 holds m4, m5, m7, m6. Put 1s in m0, m2, m5 and m7. In the top row the 1s are in the
		first and last columns, bc = 00 and bc = 10. Those columns are neighbours because the map wraps, so they form a loop
		of two. Inside it a is 0 throughout and c is 0 throughout, while b changes, so the term is
		<span class="mono">a̅·c̅</span>. In the bottom row m5 and m7 sit side by side, bc = 01 and bc = 11. There a is 1 and c
		is 1 while b changes: <span class="mono">a·c</span>. Every 1 is covered, so the answer is
		<span class="mono">a̅·c̅ + a·c</span>, two terms instead of four minterms.
	</p>
</div>

<p>The map below starts with that function. Click cells to add and remove 1s and watch the loops move.</p>

<KMapWidget variables={['a', 'b', 'c']} values={[1, 0, 1, 0, 0, 1, 0, 1]} />

<Aside kind="mistake" title="looping cells that only look adjacent">
	<p>
		Two cells that touch at a corner are not neighbours: moving diagonally changes two inputs. Nor are three cells in a
		row a loop, however tempting. And the wrap round the edge only joins the two end columns (or the top and bottom
		rows); it does not make a cell adjacent to one two steps away in the same row. If in doubt, write the two cells in
		binary and count the bits that differ. Neighbours differ in exactly one.
	</p>
</Aside>

<Aside kind="tip">
	<p>
		Write the cell numbers into a blank map once, in the order m0, m1, m3, m2 across the top row, and keep it beside
		you. Most mistakes with small maps come from putting a 1 in the wrong cell, not from the looping.
	</p>
</Aside>

<h2>Reading the result</h2>
<p>
	The expression from a map is a sum of products, the same shape as the canonical one from the last lesson, but with
	fewer and shorter terms. Each loop is one AND gate, or no gate at all if only one input is left, and one OR gate
	collects them. The Karnaugh map solver on this site draws the loops for up to six inputs, and the widget above uses
	the same engine, so its loops are the solver's loops.
</p>

<h2>What to remember</h2>
<ul>
	<li>Two terms that differ in exactly one input merge into one term without that input.</li>
	<li>
		A Karnaugh map is the truth table laid out with headings in Gray order, so neighbouring cells differ in one bit.
	</li>
	<li>Loop rectangles of 1s of size 1, 2, 4 or 8; each loop is one term, and inputs that change inside it drop out.</li>
	<li>Bigger loops mean shorter terms; overlapping is free; the map wraps round its edges.</li>
	<li>OR the terms of the loops together for the minimal sum of products.</li>
</ul>
