<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveSevenSegment from '$lib/course/widgets/LiveSevenSegment.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
	import { segmentFunctions, digitSegments } from '$lib/sevenSegment';
	import { format } from '$lib/boolean';

	// Segment e, derived from its map with the don't cares used, the same way
	// the decoder page derives all seven.
	const functions = segmentFunctions();
	const e = functions.find((f) => f.segment === 'e') ?? functions[0];
	const eExpression = format(e.ast, 'engineering');
	const eDigits = digitSegments.map((s, d) => (s.includes('e') ? d : -1)).filter((d) => d >= 0);
	const names: Record<string, string> = { w: 'B3', x: 'B2', y: 'B1', z: 'B0' };
	// The same expression with the input bits named as the decoder page names them.
	const eShown = e.text.replace(/[wxyz]/g, (v) => names[v]);
	const eList = `${eDigits.slice(0, -1).join(', ')} and ${eDigits[eDigits.length - 1]}`;
</script>

<h2>Seven bars make a digit</h2>
<p>
	A four bit number is fine for a machine and useless for a person. A <strong>seven-segment display</strong> is the fix
	you have seen on every clock radio and petrol pump: seven bars arranged as a figure eight, each one a lamp that is on
	or off. Light the right bars and the shape is a digit. The bars are lettered <span class="mono">a</span> across the
	top, then <span class="mono">b</span>, <span class="mono">c</span> and <span class="mono">d</span> clockwise round to
	the bottom, <span class="mono">e</span> and <span class="mono">f</span> back up the left side, and
	<span class="mono">g</span> across the middle. A 0 is every bar except g; a 1 is just b and c on the right; an 8 is all
	seven.
</p>

<LiveSevenSegment code={9} />

<h2>Four bits in, seven out</h2>
<p>
	The display wants seven on-or-off signals. What you have is a number, in the usual case one decimal digit written in
	four bits: 0 is 0000, 9 is 1001. That code is called <strong>BCD</strong>, binary coded decimal, and it was met in
	stage 1: each decimal digit gets its own four bits. The circuit between the two is the
	<strong>seven-segment decoder</strong>: four inputs, B3 down to B0, and seven outputs, one per bar. Feed it 1001 and
	bars a, b, c, d, f and g come on, which is a 9.
</p>
<p>
	There is no clever trick in it, which is exactly why it is a good exercise. Segment a is its own boolean function of
	the four inputs. So is segment b, and so on for all seven. Write a truth table with ten rows, one per digit, four
	input columns and seven output columns, and each output column is one small design problem you already know how to
	solve: simplify it and build it. Seven truth tables sharing four inputs, side by side.
</p>

<h2>The rows nobody cares about</h2>
<p>
	Four bits make sixteen patterns, but a decimal digit only uses ten. The codes 10 to 15, 1010 to 1111, never arrive at
	a BCD decoder. That means it does not matter what the circuit does for them, and in stage 4 you saw what to do with
	such rows: mark them as <strong>don't cares</strong>, and let the Karnaugh map groups grow across them. Every one of
	the seven expressions comes out shorter than it would if those six rows had to be forced to 0.
</p>

<Aside kind="why" title="what does the display show for 10 to 15?">
	<p>
		Whatever the simplified circuit happens to produce, and nobody designed it. Click the input bits above past 9 and
		you will see a mix of real digits and shapes that are no digit at all. That is not a fault. Those inputs were
		promised never to happen, and the freedom to ignore them is what paid for the smaller circuit.
	</p>
</Aside>

<h2>One segment, worked through</h2>
<p>
	Take segment e, the bottom left bar. Look at the digits: it is lit for {eList} and dark for the rest. From that column,
	with the six spare codes as don't cares, the Karnaugh map gives
	<span class="mono">{eShown}</span>, where B3 B2 B1 B0 are the four input bits, ¬ means NOT, ∧ means AND and ∨ means
	OR. In words: segment e lights when the bottom bit is 0 and either B2 is 0 or B1 is 1. Notice that B3 does not appear
	at all; the don't cares let the groups swallow it. Click through the inputs and check it against the list of digits.
</p>

<LiveExpression
	expression={eExpression}
	label="Segment e, the bottom left bar. Lit for {eList}."
	outputLabel="e"
	{names}
/>

<div class="example">
	<p><strong>Worked example.</strong> Which segments light for the digit 4?</p>
	<p>
		Draw a 4 on the figure eight. It has the two right hand bars, b and c, the top left bar, f, and the middle bar, g.
		No top, no bottom, no bottom left. So the decoder's row for input 0100 has 1s in the b, c, f and g columns and 0s in
		a, d and e. Four of the seven output functions are 1 on that row.
	</p>
</div>

<Aside kind="mistake" title="one output per digit">
	<p>
		The decoder does not have ten outputs, one saying "this is a 3" and so on. It has seven, one per bar, and a 3 is
		simply the pattern a, b, c, d, g being on at once. A circuit with ten one-hot outputs is the decoder from the last
		lesson, and you could build the display driver from one by ORing the right lines together, but it would be far
		bigger than the seven simplified expressions.
	</p>
</Aside>

<h2>Build it</h2>
<p>
	Open the seven segment display example in the simulator and trace one segment back from the display to the four
	switches. Then try designing segment a yourself: write its column of the truth table, mark the six don't cares, and
	compare your expression with the one on the <a href="/seven-segment-decoder">seven-segment decoder page</a>, which
	derives all seven.
</p>

<h2>What to remember</h2>
<ul>
	<li>A seven-segment display is seven lamps, a to g, lettered clockwise from the top with g in the middle.</li>
	<li>The decoder takes a four bit BCD digit and drives seven outputs, one per bar.</li>
	<li>It is seven truth tables sharing four inputs; each output column is designed on its own.</li>
	<li>Codes 10 to 15 never occur, so their rows are don't cares, and every expression gets shorter.</li>
</ul>
