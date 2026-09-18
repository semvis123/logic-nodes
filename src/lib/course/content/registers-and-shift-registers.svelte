<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveShiftRegister from '$lib/course/widgets/LiveShiftRegister.svelte';
</script>

<h2>Holding a whole number</h2>
<p>
	In the last stage you met the D flip-flop. Here is the one-line reminder: it has a data input D, a clock input, and an
	output Q. At the moment the clock rises, it copies whatever is on D to Q, and then it holds that value, ignoring D,
	until the next rising edge. One flip-flop holds one bit.
</p>
<p>
	A number is several bits, so to hold a number you need several flip-flops. Put four of them side by side, give every
	one the same clock, and feed each one its own bit of the number. On the clock edge all four copy their inputs at the
	same moment, and between edges the number just sits there. That is a <strong>register</strong>: a row of D flip-flops
	sharing one clock, holding one bit each and a whole value together.
</p>

<Aside kind="term" title="register">
	<p>
		A group of flip-flops that share a clock and are treated as one unit holding one value. A 4 bit register is four
		flip-flops, an 8 bit register is eight, and so on: always one flip-flop per bit. The value in a register is often
		called its <strong>contents</strong>.
	</p>
</Aside>

<p>
	Most registers also have a <strong>load</strong> control. When load is 1, the flip-flops take the new value on the
	next edge. When load is 0, each flip-flop's D input is wired back from its own Q, so the edge copies the old value
	over itself and nothing changes. That is what lets a register keep a number for as long as you like while the clock
	keeps ticking: a register either <strong>loads</strong> or <strong>holds</strong>, and the load line says which.
</p>

<h2>Sliding the bits along</h2>
<p>
	Now wire the flip-flops differently. Instead of giving each one its own input, connect the Q of the first to the D of
	the second, the Q of the second to the D of the third, and so on down the row. Only the first flip-flop has an outside
	input. On every clock edge, each flip-flop copies its neighbour's output, so every bit moves one place along the row.
	This is a <strong>shift register</strong>, and each flip-flop in it is called a <strong>stage</strong>.
</p>

<Aside kind="why" title="why do the bits not all rush to the end at once?">
	<p>
		Each flip-flop copies what its neighbour was showing at the instant of the edge. By the time that neighbour's output
		changes to its own new value, the edge has passed and nobody is looking. So every stage takes the
		<em>old</em> value of the stage before it, and the data moves exactly one place per edge. It is the same reason a line
		of people passing buckets does not skip anyone.
	</p>
</Aside>

<p>
	Try it. Set the input bit, press the clock, and watch the bit enter at Q0 and walk towards Q3. Feed in a few 1s and 0s
	and the whole pattern travels along, one place per press. The table under the lamps is the history: read a column
	downwards and you see one bit travelling; read a row across and you see what the register held at that moment.
</p>

<LiveShiftRegister />

<p>
	Because the data goes in one bit per clock, this is called <strong>serial</strong> input: the bits arrive in a series,
	one after another, on a single wire. A value that is presented all at once, one wire per bit, is called
	<strong>parallel</strong>. A shift register can have either kind of input and either kind of output, which gives four
	kinds by name:
</p>
<ul>
	<li>
		<strong>Serial in, serial out (SISO)</strong>: one bit in per clock, one bit out per clock, from the last stage. A
		delay line: whatever goes in comes out a fixed number of clocks later.
	</li>
	<li>
		<strong>Serial in, parallel out (SIPO)</strong>: one bit in per clock, then read all the stages at once. This turns
		one wire into many, which is how a byte arriving down a single wire ends up on eight.
	</li>
	<li>
		<strong>Parallel in, serial out (PISO)</strong>: load a whole word at once, then clock it out one bit at a time down
		one wire. Sending, the reverse of the one above.
	</li>
	<li>
		<strong>Parallel in, parallel out (PIPO)</strong>: everything at once in and out. That is just the ordinary register
		from the top of this lesson.
	</li>
</ul>

<Aside kind="tip">
	<p>
		The names are nothing to memorise: they are the two answers written down, how the data goes in and how it comes out.
		Ask "one bit per clock, or all at once?" twice and you have the name.
	</p>
</Aside>

<h2>What shifting does to a number</h2>
<p>
	Read the widget's stages as a number with Q3 as the most significant bit, as the line under the lamps does. Data
	entering at Q0 and moving towards Q3 is then a <strong>shift left</strong>: every bit moves into the column with twice
	the weight. If the bit coming in on the right is a 0, the number doubles.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> A 4 bit register holds 0011. Shift it left by one place, with a 0 coming in. What does
		it hold?
	</p>
	<p>
		0011 is 2 + 1 = 3. After the shift the 1 that was in the twos column is in the fours column and the 1 from the ones
		column is in the twos column, with a 0 filling the ones column: <span class="mono">0110</span>. That is 4 + 2 = 6,
		which is 3 doubled. Shift again and you get <span class="mono">1100</span>, which is 12. Each shift left is a
		multiplication by two, and each shift right, going the other way, is a division by two with the remainder dropped.
	</p>
</div>

<Aside kind="mistake" title="the bit that falls off the end">
	<p>
		A register has a fixed width, so shifting left pushes the leftmost bit out. Shift 1100 (12) left once more and you
		get 1000, which is 8, not 24: the 24 needed a fifth bit and there is none. Real circuits often catch that bit in a
		separate flip-flop called the carry, but the register itself has forgotten it. Whenever you shift, check that the
		top bit was a 0 first.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>
		A register is n D flip-flops sharing one clock; it holds an n bit value and either loads or holds on each edge.
	</li>
	<li>
		A shift register wires each stage's output to the next stage's input, so every bit moves one place per clock edge.
	</li>
	<li>
		Serial means one bit per clock on one wire; parallel means all bits at once. The four kinds are SISO, SIPO, PISO and
		PIPO.
	</li>
	<li>Shifting left with a 0 coming in doubles the number; shifting right halves it.</li>
	<li>The bit pushed off the end is lost unless something else catches it.</li>
</ul>
