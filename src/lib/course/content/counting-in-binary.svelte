<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import BitStrip from '$lib/course/widgets/BitStrip.svelte';
</script>

<h2>Counting with two digits</h2>
<p>
	You already count in a system with a limited set of digits: ten of them, 0 to 9. When you run out, you write a 0 and
	carry a 1 into the next column to the left, which is how 9 becomes 10. Binary is the very same idea with only two
	digits, 0 and 1. You run out much sooner, so you carry much more often, but the rule is the one you already know.
</p>
<p>Count up from zero and watch when the carry happens:</p>
<div class="example">
	<p class="mono">0, 1, 10, 11, 100, 101, 110, 111, 1000, …</p>
	<p>
		After 1 you have run out of digits, so you write 0 and carry: 10. That is two. Then 11 is three. Then both columns
		are full, so both carry: 100 is four.
	</p>
</div>

<Aside kind="mistake" title="reading 10 as ten">
	<p>
		In binary, 10 is two, not ten. It helps to read binary numbers digit by digit, "one zero", rather than "ten", until
		the habit is broken. When it matters which system a number is in, people write a small 2 or 10 after it: 10<sub
			>2</sub
		>
		is two, 10<sub>10</sub> is ten.
	</p>
</Aside>

<h2>Place value: every bit has a weight</h2>
<p>
	In decimal, the columns are worth 1, 10, 100, 1000: each column is ten times the one to its right. In binary each
	column is <em>twice</em> the one to its right, so the columns are worth 1, 2, 4, 8, 16, 32 and so on. Those column
	values are called <strong>weights</strong>. A binary number is read by adding up the weights of the columns that hold
	a 1 and ignoring the columns that hold a 0.
</p>

<BitStrip bits={4} value={5} label="Four bits, with the weight of each column underneath. Click the bits." />

<div class="example">
	<p><strong>Worked example.</strong> What is 1011 in decimal?</p>
	<p>
		Write the weights over the bits, from the right: 8, 4, 2, 1. The bits that are 1 sit under 8, 2 and 1. Add those: 8
		+ 2 + 1 = 11. The 4 column holds a 0, so it contributes nothing.
	</p>
</div>

<Aside kind="term" title="most and least significant bit">
	<p>
		The leftmost bit has the biggest weight, so it is called the <strong>most significant bit</strong>, often shortened
		to MSB. The rightmost bit is worth 1 and is the <strong>least significant bit</strong>, or LSB. Flipping the MSB
		changes the number a lot; flipping the LSB changes it by one.
	</p>
</Aside>

<h2>Going the other way: decimal to binary</h2>
<p>
	To write a decimal number in binary, walk through the weights from the biggest down and ask of each one, "does this
	fit in what I have left?" If it does, write a 1 and subtract it. If not, write a 0 and move on.
</p>
<div class="example">
	<p><strong>Worked example.</strong> Write 13 with four bits.</p>
	<p>
		Weights from the left: 8, 4, 2, 1. Does 8 fit in 13? Yes: write 1, and 13 − 8 = 5 is left. Does 4 fit in 5? Yes:
		write 1, 1 is left. Does 2 fit in 1? No: write 0. Does 1 fit in 1? Yes: write 1, nothing left. Reading the digits in
		order gives <span class="mono">1101</span>.
	</p>
</div>
<p>
	Check it by going back: 8 + 4 + 1 = 13. Going both ways and checking that they agree is a habit worth keeping for the
	whole course. It catches most slips.
</p>

<Aside kind="tip">
	<p>
		Learn the first sixteen by heart, 0000 through 1111, and the powers of two up to 256: 1, 2, 4, 8, 16, 32, 64, 128,
		256. With those in your head, most conversions in this course take a few seconds and no paper.
	</p>
</Aside>

<h2>Why the width matters</h2>
<p>
	A real circuit has a fixed number of wires, so it holds a fixed number of bits. That number is the
	<strong>width</strong>, and it decides the biggest number the circuit can hold. With four bits the biggest pattern is
	1111, which is 8 + 4 + 2 + 1 = 15. With eight bits it is 255, and in general with <em>n</em> bits it is 2<sup>n</sup> −
	1: one less than the number of patterns, because one of the patterns is spent on zero.
</p>
<p>
	Try counting past the top of the four-bit strip above: 1111 plus one would need a fifth column, and there is not one.
	In a real circuit the carry falls off the end and the number wraps round to 0000. Later in the course, when you build
	an adder, you will see that carry come out on its own wire.
</p>

<Aside kind="why" title="why not just use more bits?">
	<p>
		More bits means more wires, more gates and more power for every single operation, so designers choose the smallest
		width that fits the job. A traffic light controller might use three bits; a video game console uses sixty-four.
		Leading zeros are free, though: 5 in eight bits is simply 00000101.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>Binary counts with 0 and 1 and carries into the next column whenever a column is full.</li>
	<li>Each column has a weight, doubling from 1 on the right: 1, 2, 4, 8, 16, 32.</li>
	<li>To read a binary number, add the weights of the columns holding a 1.</li>
	<li>To write one, go through the weights from the biggest down and take each one that fits.</li>
	<li>A circuit's width is its number of bits, and the biggest number it can hold is 2<sup>n</sup> − 1.</li>
</ul>
