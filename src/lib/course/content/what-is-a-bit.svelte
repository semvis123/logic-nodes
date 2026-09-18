<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import Wire from '$lib/course/widgets/Wire.svelte';
	import BitStrip from '$lib/course/widgets/BitStrip.svelte';
</script>

<h2>Start with a light switch</h2>
<p>
	Think about a light switch on a wall. It is either up or down. There is no "a bit up". Flip it and the lamp is on;
	flip it back and the lamp is off. That switch, the wire from it, and the lamp at the end are the whole of digital
	logic in miniature: something that is in one of exactly two states, and a wire that carries that state somewhere else.
</p>

<Wire />

<p>
	Inside a computer there are billions of these wires, and every one of them is doing the same thing the wire above is
	doing: carrying one of two values. We call the two values <strong>1</strong> and <strong>0</strong>. That is a choice
	of names, nothing more. Electrically, a 1 is a wire held at a higher voltage and a 0 is a wire held at a lower one,
	which is why you will also hear <strong>high</strong> and <strong>low</strong>. Engineers also say
	<strong>on</strong> and <strong>off</strong>, or <strong>true</strong> and <strong>false</strong>. Same two values,
	four pairs of names.
</p>

<Aside kind="term" title="bit">
	<p>
		A <strong>bit</strong> is one of these two-valued things: a single 1 or 0. The word is short for "binary digit". Binary
		just means "made of two", the way a bicycle has two wheels.
	</p>
</Aside>

<h2>Why only two?</h2>
<p>
	It sounds limiting. A dial can be turned to any position, so why would you build a machine out of parts that only know
	two? The answer is that two is easy to get right. A wire that is meant to be at 5 volts might, through heat or
	interference, actually be at 4.7. If the rule is "anything above 2.5 counts as 1 and anything below counts as 0", that
	4.7 is still a perfectly good 1. Nothing was lost. A dial with a hundred positions has no such slack: every little
	wobble changes the reading.
</p>
<p>
	So digital circuits give up on carrying rich values along a wire and instead carry the simplest possible one, and they
	get in return a machine that can copy, store and shuffle those values a billion times a second without ever making a
	mistake. Everything richer, numbers, text, pictures, sound, is rebuilt out of bits further up.
</p>

<Aside kind="why" title="what about the voltages?">
	<p>
		You never need them for this course. Every circuit here works with pure 1s and 0s, and the simulator draws a 1 as a
		green wire and a 0 as a red one. If you go on to build circuits with real chips, the datasheet will tell you which
		voltage counts as which, and the rule above is all you need to make sense of it.
	</p>
</Aside>

<h2>More than one bit</h2>
<p>
	One bit answers one yes-or-no question: is the lamp on? To say anything more, use more bits. Put three switches side
	by side and read them left to right, and you can be in one of eight different situations: all off, only the right one
	on, only the middle one on, and so on. Click through them below.
</p>

<BitStrip bits={3} weights={false} label="Three bits. Click any of them and watch the pattern change." />

<p>
	Count the patterns: with one bit there are two, with two bits there are four, with three there are eight. Every bit
	you add doubles the count, because for every pattern you already had, the new bit can be 0 or 1. With eight bits there
	are 256 patterns; with thirty-two there are more than four billion.
</p>

<div class="example">
	<p><strong>Worked example.</strong> How many patterns can four bits make?</p>
	<p>
		Start from one bit, which has 2 patterns, and double three more times: 2, 4, 8, 16. Four bits make 16 patterns. A
		quicker way to say the same thing is 2 × 2 × 2 × 2, which is written 2<sup>4</sup>.
	</p>
</div>

<p>
	What a pattern <em>means</em> is up to whoever is using it. The pattern 101 might mean the number five, or the letter E,
	or "the second of three doors is closed". The bits do not care. That freedom is the second big idea of this course: a circuit
	only ever moves 1s and 0s around, and it is the design of the circuit that gives them a meaning. In the next lesson the
	meaning will be numbers.
</p>

<Aside kind="mistake" title="a bit is not a small number">
	<p>
		People sometimes read "bit" as "a little piece of data" and imagine it can hold a small value like 3 or 7. It
		cannot. A bit is exactly one of two things. To hold a 7 you need several bits working together, and the next lesson
		shows how.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>A wire in a digital circuit carries one of two values, called 1 and 0, high and low, or on and off.</li>
	<li>One such value is a bit. It is either 1 or 0; there is nothing in between.</li>
	<li>Two values are used because they are easy to tell apart, so the machine never misreads them.</li>
	<li>Bits side by side make patterns, and each extra bit doubles how many patterns there are.</li>
</ul>
