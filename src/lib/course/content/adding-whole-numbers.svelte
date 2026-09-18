<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveRippleAdder from '$lib/course/widgets/LiveRippleAdder.svelte';
</script>

<h2>One adder per column</h2>
<p>
	A full adder adds one column: two bits and a carry in, giving a sum bit and a carry out. To add whole numbers, give
	every column its own full adder and wire each carry out into the carry in of the column on its left. The rightmost
	column has nothing to its right, so its carry in is held at 0. Four full adders in a row add two four bit numbers;
	eight add two bytes. The number of adders is the number of bits, no more and no less.
</p>

<Aside kind="term" title="ripple carry adder">
	<p>
		A <strong>ripple carry adder</strong> is a chain of full adders, one per bit, with each carry out feeding the next carry
		in. The name describes what happens inside it: a carry made in a low column ripples along the chain, column by column,
		until it reaches the top.
	</p>
</Aside>

<p>
	Below is a four bit ripple carry adder. The top row shows the carry into each column, with the final carry out on the
	far left. Click the bits of a and b and watch the carries move.
</p>

<LiveRippleAdder a={11} b={6} />

<h2>Tracing a sum column by column</h2>
<p>
	Take the sum the widget starts with, 11 + 6, which is <span class="mono">1011 + 0110</span>. Work from the right,
	numbering the columns from 0 like the weights 1, 2, 4, 8.
</p>
<div class="example">
	<p><strong>Worked example.</strong> What does the adder produce for 1011 + 0110?</p>
	<p>
		Column 0: 1 + 0 + carry in 0 = 1. Sum bit 1, carry 0. Column 1: 1 + 1 + 0 = 2, which is
		<span class="mono">10</span>. Sum bit 0, carry 1. Column 2: 0 + 1 + 1 = 2. Sum bit 0, carry 1. Column 3: 1 + 0 + 1 =
		2. Sum bit 0, carry 1. Reading the sum bits from the top, the answer is <span class="mono">0001</span> with a carry out
		of 1.
	</p>
	<p>
		Check it: 11 + 6 = 17, and 17 is 16 + 1. The carry out is the 16 and the sum bits are the 1. The adder is right; it
		just needed a fifth bit to say so.
	</p>
</div>

<h2>What the last carry means</h2>
<p>
	Four bits hold 0 to 15. When the true sum is bigger than that, the top column carries out and the four sum bits alone
	are wrong: 17 came out as 1. The carry out of the last column is therefore a fifth bit of the answer, worth 2<sup
		>4</sup
	>
	= 16, and it doubles as a warning flag. When it is 1, the result did not fit. This is called
	<strong>overflow</strong>: the true answer overflowed the width of the circuit. For plain unsigned numbers the rule is
	simple: carry out 1 means overflow, carry out 0 means the sum bits are the whole answer.
</p>

<Aside kind="mistake" title="reading the sum bits and ignoring the carry">
	<p>
		9 + 7 through a four bit adder shows <span class="mono">0000</span>. It is not saying the answer is zero. The carry
		out is 1, so the answer is 16 + 0 = 16. Always read the carry out with the sum bits, or, if the circuit throws it
		away, remember that the number has wrapped round to the start, the way a car's mileage counter goes from 9999 to
		0000.
	</p>
</Aside>

<h2>Why the ripple is slow</h2>
<p>
	Nothing in column 3 can finish until it knows its carry in, which comes from column 2, which is waiting on column 1,
	which is waiting on column 0. Every gate takes a small but real time to settle, and each column adds about two gate
	delays to the carry path, an AND and an OR. In the worst case, adding 1 to
	<span class="mono">1111</span>, a single carry has to ripple through every column before the top bit is right. For
	four bits that is a short wait; for a 32 bit adder the carry path is about 64 gates long, and the whole adder is only
	as fast as that path. Designers fix it with a <strong>carry lookahead adder</strong>, which works out every carry
	directly from the inputs instead of waiting for the column below. It costs many more gates and is explained on the
	<a href="/ripple-carry-adder#lookahead">ripple carry adder page</a>. Build the ripple version first: it is the one you
	can watch working.
</p>

<Aside kind="why" title="why does the first column get a carry in at all?">
	<p>
		The rightmost column could be a half adder, since no carry can arrive from its right. Using a full adder with the
		carry in held at 0 does the same job and buys something useful: a carry in of 1 adds one extra to the whole sum. The
		next lesson uses exactly that to turn the adder into a subtractor.
	</p>
</Aside>

<h2>Build it</h2>
<p>
	Place four of your full adder chips in a row. Wire the carry out of each into the carry in of the one to its left, and
	set the first carry in to 0. Eight toggles feed the two numbers, four bits each, and five displays show the four sum
	bits and the final carry out. Try 1011 + 0110 and check that you get 0001 with the carry lit, then add 1 to 1111 and
	watch the carry ripple through all four chips. The built in calculator example has the same chain inside it.
</p>

<h2>What to remember</h2>
<ul>
	<li>A ripple carry adder is one full adder per bit, each carry out wired to the next carry in.</li>
	<li>Trace a sum from the right hand column, passing each carry one column to the left.</li>
	<li>The carry out of the top column is a fifth bit; for unsigned numbers, 1 means the sum did not fit.</li>
	<li>The carry chain sets the speed, about two gate delays per bit, which is why lookahead adders exist.</li>
</ul>
