<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import GrayCounter from '$lib/course/widgets/GrayCounter.svelte';
	import { grayCode, toBinaryString, toGray, fromGray } from '$lib/boolean';

	// Every pattern in the text comes from the converter's own functions.
	const three = grayCode(3).map((g) => toBinaryString(g, 3));
	const two = grayCode(2).map((g) => toBinaryString(g, 2));
	const six = toBinaryString(6, 3);
	const sixShifted = toBinaryString(6 >> 1, 3);
	const sixGray = toBinaryString(toGray(6), 3);
	const sixBack = toBinaryString(fromGray(toGray(6)), 3);
</script>

<h2>A counter that changes one bit at a time</h2>
<p>
	Plain binary counting has a habit you may not have noticed. Going from 3 to 4 is 011 to 100, and all three bits change
	at once. From 7 to 8 is 0111 to 1000: four bits change. In a real circuit nothing changes at exactly the same instant,
	so for a moment during that step the wires can show a pattern that is neither the old value nor the new one.
</p>
<p>
	<strong>Gray code</strong> is a different order for the same patterns, chosen so that every step changes exactly one
	bit. Its formal name is <strong>reflected binary code</strong>, and it is not a different way of writing numbers: the
	patterns are the same 0s and 1s, just listed in a different sequence. Step through the widget and compare the two
	columns.
</p>

<GrayCounter />

<p>
	In the binary column the number of lit digits varies; in the Gray column it is always exactly one, even on the wrap
	from the last value back to 0.
</p>

<Aside kind="why" title="what is wrong with a few bits changing at once?">
	<p>
		Picture a rotary encoder, the disc inside a volume knob or a robot's wheel that reports how far it has turned. Each
		bit is a track on the disc read by its own sensor. As the disc turns from position 3 (011) to position 4 (100), the
		three sensors do not flip at precisely the same moment, so between the two readings you might see 111 or 000:
		position 7 or position 0, both badly wrong. With Gray code only one track changes between neighbouring positions, so
		the worst a mistimed read can do is show the old value or the new one, and both are within one step of the truth.
		The same problem appears whenever a value is read while it is changing, such as a count crossing from one clock to
		another.
	</p>
</Aside>

<h2>Building the sequence</h2>
<p>
	Gray code is built by reflecting. Start with one bit: 0, 1. Write the list out, then write it again backwards
	underneath, like a reflection in a mirror: 0, 1, 1, 0. Now put a 0 in front of the original half and a 1 in front of
	the reflected half: {two.join(', ')}. That is the 2 bit sequence, and every step changes one bit. Do it again, reflect
	and prefix, and you get the 3 bit sequence:
</p>
<p class="mono">{three.join(', ')}</p>
<p>
	Why does it work? The two halves are mirror images, so where they meet, the two middle entries are identical apart
	from the new front bit. And within each half the steps are the steps of the shorter code, which already changed one
	bit each. So the new sequence changes one bit per step too, all the way along.
</p>

<h2>Converting binary to Gray and back</h2>
<p>
	You do not need to build the whole list to find the Gray code of one number. Write the binary number, write it again
	shifted one place to the right underneath, and XOR the columns. Remember XOR from stage 2: the output is 1 when the
	two inputs differ. The top bit has nothing above it and is copied unchanged.
</p>

<div class="example">
	<p><strong>Worked example.</strong> What is 6 in Gray code, and how do you get back?</p>
	<p>
		6 in binary is <span class="mono">{six}</span>. Shifted right by one it is <span class="mono">{sixShifted}</span>.
		XOR column by column: 1 with 0 is 1, 1 with 1 is 0, 0 with 1 is 1. The Gray code is
		<span class="mono">{sixGray}</span>, and it is entry number 6 in the list above, counting the first entry as 0.
	</p>
	<p>
		Going back runs from the left. Copy the top bit: 1. Each following binary bit is the Gray bit in that position XOR
		the binary bit you have just written: 0 XOR 1 = 1, then 1 XOR 1 = 0. That gives <span class="mono">{sixBack}</span>,
		which is 6 again.
	</p>
</div>

<p>
	In hardware, binary to Gray is a single row of XOR gates, one per bit below the top, all working at once. Gray to
	binary is a chain, because each bit needs the one you just worked out, but it is still only XOR gates.
</p>

<Aside kind="mistake" title="reading a Gray pattern as a binary number">
	<p>
		The Gray code for 6 is 101, and 101 read as ordinary binary is 5. Both are true, and neither means 6 equals 5. A
		pattern only has a value once you say which code it is in. When you read a Gray-coded sensor, convert first and then
		treat the result as a number, never the other way round.
	</p>
</Aside>

<h2>You have met this before</h2>
<p>
	Look back at the Karnaugh maps in stage 4. The rows and columns were labelled 00, 01, 11, 10, not 00, 01, 10, 11. That
	is the 2 bit Gray code, and it is the whole reason the map works: neighbouring squares differ in exactly one variable,
	so a group of squares is a set of inputs where one variable does not matter, and that variable drops out of the term.
	The map even wraps around at the edges, because 10 and 00 differ in one bit too, just like the last and first entries
	of the widget.
</p>

<h2>What to remember</h2>
<ul>
	<li>
		Gray code is an order for bit patterns in which consecutive values differ in exactly one bit, including the wrap.
	</li>
	<li>It matters wherever a value is read while it changes: a mistimed read is then off by at most one step.</li>
	<li>Build it by reflecting the list and prefixing 0 to the first half and 1 to the second.</li>
	<li>
		Binary to Gray is the number XOR itself shifted right by one; Gray to binary runs the XOR from the top bit down.
	</li>
	<li>The 00, 01, 11, 10 headings of a Karnaugh map are the 2 bit Gray code.</li>
</ul>
