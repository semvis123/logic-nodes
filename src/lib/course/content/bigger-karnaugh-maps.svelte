<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import KMapWidget from '$lib/course/widgets/KMapWidget.svelte';
	import type { CellValue } from '$lib/boolean';

	// Segment a of a seven-segment display is lit for the digits 0, 2, 3, 5, 6,
	// 7, 8 and 9; the six codes past 9 never arrive from a BCD input.
	const segmentA: CellValue[] = Array.from({ length: 16 }, (_, code) =>
		code >= 10 ? 'x' : [0, 2, 3, 5, 6, 7, 8, 9].includes(code) ? 1 : 0
	);
	const fiveOrMore: CellValue[] = Array.from({ length: 16 }, (_, code) => (code >= 10 ? 'x' : code >= 5 ? 1 : 0));
</script>

<h2>Four inputs: a 4 by 4 map</h2>
<p>
	With four inputs, a and b together pick the row and c and d together pick the column, and both sets of headings run in
	Gray order: 00, 01, 11, 10. That makes a square of sixteen cells, one per row of the truth table. The numbering
	follows from the headings. The top row, ab = 00, holds m0, m1, m3, m2. The second row, ab = 01, holds m4, m5, m7, m6.
	The third row is ab = 11, not 10, so it holds m12, m13, m15, m14, and the bottom row, ab = 10, holds m8, m9, m11, m10.
</p>
<p>
	Everything from the three-input map still holds, and two things become more important. The map now wraps both ways:
	the top row is next to the bottom row (00 and 10 differ in one bit) as well as the left column next to the right
	column. So the four corners, m0, m2, m8 and m10, are one loop of four. Check it: they all have b = 0 and d = 0, while
	a and c take both values, so the term is <span class="mono">b̅·d̅</span>. And loops of eight now exist: a whole pair of
	rows or pair of columns, which drops three inputs and leaves a single letter.
</p>

<Aside kind="mistake" title="reading the third row as ab = 10">
	<p>
		The rows and columns are in Gray order, so the third heading is 11 and the fourth is 10. Someone who fills the map
		in counting order puts m8 to m11 in the third row and m12 to m15 in the fourth, and every loop that crosses those
		rows comes out wrong. Write the headings down before you write a single 1.
	</p>
</Aside>

<h2>Rows that never happen</h2>
<p>
	Sometimes a truth table has rows whose inputs can never occur. The standard example is a decimal digit stored as four
	bits, called <strong>binary coded decimal</strong> or BCD: 0000 for 0 up to 1001 for 9. The patterns 1010 to 1111, the
	codes 10 to 15, are never produced by a BCD counter or keypad. A circuit that drives a seven-segment display from a BCD
	digit has to say what each of its seven segments does for the ten real digits, but for the six codes that never come it
	genuinely does not matter, and a designer should say so rather than pick 0 or 1 at random.
</p>

<Aside kind="term" title="don't care">
	<p>
		A <strong>don't care</strong> is a row of the truth table whose output does not matter, either because that input combination
		cannot happen or because nothing downstream looks at the output in that case. It is written X on the map. When you draw
		loops you may count an X as a 1 if that makes a loop bigger, and as a 0 if it does not, and you make that choice separately
		for each X. An X never has to be inside a loop: only the 1s must be covered.
	</p>
</Aside>

<div class="example">
	<p>
		<strong>Worked example.</strong> Build a circuit whose output is 1 when a BCD digit is 5 or more. The inputs are the
		four bits a, b, c, d of the digit, with a the most significant.
	</p>
	<p>
		The 1s are the digits 5 to 9, which are m5, m6, m7, m8 and m9. If you treat codes 10 to 15 as 0s, the best loops are
		three loops of two, and the expression is <span class="mono">a̅·b·d + a̅·b·c + a·b̅·c̅</span>: nine letters and three
		three-input AND gates. Now mark m10 to m15 as X instead. The whole bottom half of the map, rows ab = 11 and ab = 10,
		is now 1s and Xs, so m8 and m9 join a loop of eight whose term is just <span class="mono">a</span>. The Xs at m14
		and m15 let m6 and m7 grow into a loop of four, <span class="mono">b·c</span>, and m13 and m15 let m5 and m7 grow
		into <span class="mono">b·d</span>. The result is <span class="mono">a + b·d + b·c</span>: five letters, two AND
		gates, and it still gives the right answer for every digit from 0 to 9.
	</p>
</div>

<KMapWidget
	variables={['a', 'b', 'c', 'd']}
	values={fiveOrMore}
	dontCares
	label="Is the digit 5 or more? Click an X to make it 0 and watch the loops shrink."
/>

<Aside kind="why" title="why is it safe to treat an X as a 1?">
	<p>
		Because the row it belongs to never arrives at the circuit. The only inputs the circuit ever sees are the ten real
		digits, and on those rows the expression with the Xs used and the one without give identical outputs. Treating an X
		as 1 changes what the circuit would do for an input it will never get, and that costs nothing. Whether the solver
		counted it as 1 or 0 is not even worth recording.
	</p>
</Aside>

<h2>The seven-segment decoder</h2>
<p>
	The map below is the top segment of a seven-segment display, segment a, which is lit for the digits 0, 2, 3, 5, 6, 7,
	8 and 9 and dark for 1 and 4. The six spare codes are marked X. Click any X to turn it into a 0 and watch the
	expression grow; the seven-segment decoder page does this for all seven segments, and every one of them comes out
	shorter with the don't cares used.
</p>

<KMapWidget
	variables={['a', 'b', 'c', 'd']}
	values={segmentA}
	dontCares
	label="Segment a of the display, with codes 10 to 15 as don't cares."
/>

<h2>Prime implicants, and the essential ones</h2>
<p>
	The loops you can draw have names, and the names make the choosing step clear. Any loop of 1s (and Xs) is an
	<strong>implicant</strong>: a term that is 1 only where the function is allowed to be 1. A loop that cannot be made
	any bigger without taking in a 0 is a <strong>prime implicant</strong>. Those are the only loops worth considering,
	because a smaller loop inside a bigger one costs a longer term for no benefit. Among the prime implicants, some cover
	a 1 that no other prime implicant covers. Those are <strong>essential</strong>: any correct answer has to include
	them, so take them first. Then look at whichever 1s are still uncovered and pick the fewest remaining prime implicants
	that cover them. In the worked example, all three loops were essential and there was nothing left to choose. On harder
	maps the choice is where two people can find different but equally short answers.
</p>

<h2>What to remember</h2>
<ul>
	<li>A four-input map is 4 by 4 with both headings in Gray order, so the third row is ab = 11.</li>
	<li>It wraps both ways: the four corners are one loop of four, and loops of eight leave a single letter.</li>
	<li>A don't care, X, is a row that never happens; count it as 1 when that enlarges a loop, otherwise ignore it.</li>
	<li>BCD leaves codes 10 to 15 unused, which is why a seven-segment decoder has six don't cares.</li>
	<li>Take the essential prime implicants first, then cover what is left with as few of the others as you can.</li>
</ul>
