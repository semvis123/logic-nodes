<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveCounter from '$lib/course/widgets/LiveCounter.svelte';
</script>

<h2>A flip-flop that flips itself</h2>
<p>
	The T flip-flop from the last stage has one job: when its T input is 1, it <strong>toggles</strong> on the clock edge,
	so Q goes from 0 to 1 or from 1 to 0. Tie T to 1 permanently and the flip-flop toggles on every single edge. Its output
	is a square wave running at exactly half the rate of the clock, because it takes two edges, one to go up and one to come
	down, to get back where it started.
</p>
<p>
	Now feed that output into the clock input of a second T flip-flop, also with T tied to 1. The second one only sees an
	edge when the first one's output changes in the right direction, which is every second clock. So the second flip-flop
	toggles half as often as the first, and a third one hung off the second toggles half as often again. Read the three
	outputs as a binary number, the last flip-flop as the most significant bit, and they count: 000, 001, 010, 011, 100
	and so on. A <strong>counter</strong> is a row of flip-flops whose outputs, read as a number, go up by one on every clock
	edge.
</p>

<Aside kind="why" title="why does chaining toggles count in binary?">
	<p>
		Look at what counting in binary does to each column. The ones column flips on every step. The twos column flips
		every time the ones column goes from 1 back to 0, the fours column every time the twos column goes from 1 to 0, and
		so on. That is precisely a chain of toggles, each triggered by the one before it falling. Nothing in the circuit
		knows what a number is; the counting falls out of the wiring.
	</p>
</Aside>

<p>
	Press the clock and watch the bits. Q0 toggles every press, Q1 every second press, Q2 every fourth, Q3 every eighth.
</p>

<LiveCounter />

<p>
	The timing diagram grows a column per press. Each bit runs at half the rate of the one below it, so a counter is also
	a <strong>frequency divider</strong>: the top bit of a 4 bit counter goes up and down once for every 16 clock cycles.
	That halving is how a watch works. Its crystal ticks 32768 times a second, and fifteen stages of halving turn that
	into one tick per second.
</p>

<h2>Ripple and synchronous</h2>
<p>
	The chain just described, where each flip-flop is clocked by the output of the one before it, is called a
	<strong>ripple counter</strong>. It is the cheapest counter there is, but it has a flaw. Each flip-flop takes a moment
	to change, and the next one cannot start until it has. When the count goes from 0111 to 1000 the change has to ripple
	through all four stages in turn, and for a few moments the outputs show wrong values on the way, like 0110 and 0100,
	before settling. If a display is watching, nobody notices. If other logic is watching, it may act on a count that
	never really existed.
</p>
<p>
	A <strong>synchronous counter</strong> fixes that by giving every flip-flop the same clock. Each stage's T input is then
	wired to say "toggle if every bit below me is 1": Q0's T is tied to 1, Q1's T is Q0, Q2's T is Q0 AND Q1, and so on. All
	the bits change together on the edge, so the count is valid a moment later no matter how many bits there are. The price
	is those AND gates.
</p>

<Aside kind="mistake" title="reading a ripple counter mid-ripple">
	<p>
		The wrong values a ripple counter shows while it settles are real, and they are worst at the wrap from all 1s back
		to 0, where every stage changes in turn. If anything else in the circuit reads the count, use a synchronous counter,
		or read only once the count has had time to settle.
	</p>
</Aside>

<h2>Counting to something other than a power of two</h2>
<p>
	Four flip-flops naturally run through all sixteen of their patterns, from 0 to 15, before starting again. The number
	of states a counter goes through before it repeats is its <strong>modulus</strong>, so a plain 4 bit counter is a
	mod-16 counter. To count to ten instead, watch for the state just past the last one you want, 10, and use it to clear
	every flip-flop to 0. The count then runs 0 to 9 and starts again: a <strong>decade counter</strong>, mod-10. The
	detector is a single AND gate on the bits that are 1 in 1010, and the same trick gives any modulus you like. It is how
	a clock divides sixty seconds into a minute. The widget below wraps at 10; press it past 9.
</p>

<LiveCounter modulus={10} />

<div class="example">
	<p><strong>Worked example.</strong> A mod-10 counter starts at 0. What does it show after 23 clock edges?</p>
	<p>
		The counter goes round in a loop of 10: 0, 1, 2, … 9, then 0 again. Twenty-three edges is two full laps of ten,
		which bring it back to 0, with three edges left over. Three edges from 0 give 1, 2, 3. The counter shows 3. In
		general, the count after k edges is the remainder when k is divided by the modulus.
	</p>
</div>

<p>
	One last variation. An <strong>up/down counter</strong> has a control line that picks the direction. Counting down is the
	same rule with every bit inverted on the way into the toggle logic, since 1111, 1110, 1101 downwards is 0000, 0001, 0010
	upwards with the bits flipped, so one circuit does both, with a switch choosing between each Q and its opposite.
</p>

<h2>What to remember</h2>
<ul>
	<li>A T flip-flop with T tied to 1 toggles on every clock edge and halves the clock rate.</li>
	<li>Chain them so each toggles when the one before it goes from 1 to 0 and the outputs count in binary.</li>
	<li>Each bit runs at half the rate of the bit below it, so bit k toggles once every 2<sup>k</sup> edges.</li>
	<li>
		A ripple counter clocks each stage from the previous one and glitches; a synchronous counter shares the clock and
		does not.
	</li>
	<li>
		The modulus is how many states the counter runs through; to get one that is not a power of two, clear the counter at
		the target.
	</li>
</ul>
