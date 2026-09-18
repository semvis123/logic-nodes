<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import ClockStepper from '$lib/course/widgets/ClockStepper.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>A signal that ticks</h2>
<p>
	The latch from the last lesson changes the moment its inputs change. That is fine for one latch, but a computer has
	millions of them, and if each one changes whenever it happens to be ready, the ones that were meant to move together
	drift apart. What is needed is something that says "now" to everything at once, over and over. That is a
	<strong>clock</strong>: a signal that flips between 0 and 1 at a steady rate and never stops, like a metronome for the
	circuit. It carries no data. Its only job is timing.
</p>
<p>
	Two numbers describe a clock. The <strong>period</strong> is the time one full cycle takes, one stretch at 1 and one
	at 0, before the pattern repeats. The <strong>frequency</strong> is how many of those cycles happen each second, measured
	in hertz (Hz). The two are each other's inverse: a clock with a period of 1 millisecond completes 1000 cycles a second,
	so its frequency is 1000 Hz, written 1 kHz. A 1 MHz clock runs a million cycles a second, so each period is one microsecond,
	and a processor's 3 GHz is three thousand million cycles a second.
</p>

<Aside kind="term" title="period and frequency">
	<p>
		<strong>Period</strong> is the time for one cycle; <strong>frequency</strong> is cycles per second, in hertz. One is
		1 divided by the other: a 100 Hz clock has a period of 1/100 of a second, which is 10 ms, and a period of 2 ms means
		500 Hz.
	</p>
</Aside>

<h2>Edges</h2>
<p>
	Draw a clock against time and you get a square wave: flat at 1, a sharp step down, flat at 0, a sharp step up. The
	steps are the interesting part. The instant the clock goes from 0 to 1 is a <strong>rising edge</strong>, and the
	instant it goes from 1 to 0 is a <strong>falling edge</strong>. Each period has exactly one of each. Advance the clock
	below and watch the edges appear.
</p>

<ClockStepper />

<div class="example">
	<p>
		<strong>Worked example.</strong> A clock runs at 2 kHz. What is its period, and how many rising edges pass in 3 ms?
	</p>
	<p>
		2 kHz is 2000 cycles a second, so one cycle takes 1/2000 of a second, which is 0.5 ms. In 3 ms there are 3 ÷ 0.5 = 6
		cycles, and each cycle has one rising edge, so 6 rising edges.
	</p>
</div>

<h2>Why everything moves on the same edge</h2>
<p>
	Here is the plan for the rest of the course. Every piece of memory in a circuit is made to change only at the rising
	edge of one shared clock, and to ignore its inputs at every other moment. Between one edge and the next, the gates in
	between have a whole period to work out their new values and settle, and nothing reads a value while it is still
	changing, because nothing reads anything until the next edge. A big circuit becomes a set of small ones that each have
	to be correct by the next tick, which is something a designer can actually check.
</p>

<Aside kind="why" title="why an edge and not just 'while the clock is 1'?">
	<p>
		Because "while the clock is 1" lasts a while, and a while is long enough for things to happen twice. If memory
		listens for the whole time the clock is high, a value can pass through it, go round some logic, and come back to
		change it again before the clock drops. An edge is an instant. Nothing can happen twice in an instant, so each piece
		of memory changes exactly once per cycle.
	</p>
</Aside>

<h2>The gated latch, and what is wrong with it</h2>
<p>
	The first attempt at putting a latch under a clock's control is simple: put an AND gate in front of each input and
	feed a signal called <strong>enable</strong> into both. While enable is 0 the AND gates pass nothing, so S and R can
	do what they like and the latch holds. While enable is 1 the latch listens as usual. This is the
	<strong>gated</strong> SR latch. The expression below is its next output; try it with enable at 0 and see that nothing
	you do to S and R matters.
</p>

<LiveExpression
	expression="(e & s) | (!(e & r) & q)"
	label="The gated SR latch: next Q from enable, S, R and the present Q"
	names={{ e: 'enable', s: 'S', r: 'R', q: 'Q now' }}
	outputLabel="next"
/>

<p>
	It is a real improvement, but it is <strong>level-sensitive</strong>: it responds for the whole time enable is at 1,
	not at one instant. That is the problem from the box above. Anything that changes twice while enable is high gets
	through twice. The next lesson fixes it with a circuit that responds only at the edge itself, and that circuit is the
	flip-flop.
</p>

<Aside kind="mistake" title="'the clock is 1' is not 'a rising edge'">
	<p>
		A clock is 1 for half of every period. A rising edge is the single instant at the start of that half. When a lesson
		or a datasheet says something happens "on the clock", it nearly always means on the edge, once per period, and not
		continuously for as long as the clock is high.
	</p>
</Aside>

<h2>Catching an edge with gates</h2>
<p>
	An edge is an instant, so how can a circuit react to one? With a small trick. Take the signal and also a copy of it
	that has been inverted and delayed slightly, and AND the two together. Most of the time they disagree: when the signal
	is 1 the inverted copy is 0, and when it is 0 the copy is 1, so the AND outputs 0. But just after a rising edge, for
	as long as the delay lasts, the signal is already 1 and the delayed inverted copy is still 1. The AND outputs 1 for
	that moment and then goes quiet. That is a <strong>rising edge detector</strong>: one short pulse per rising edge,
	nothing while the signal stays high, and nothing at all on a falling edge. The pulse trace in the widget above is its
	output.
</p>
<p>
	The simulator has this circuit built in: an AND gate, a NOT gate and a delay in the path between them. In the example
	the delay comes from the NOT gate and a splitter node, which each take a moment to pass the signal on; a Delay node
	would make the pulse longer. Feed the detector from an Interval node, which is the simulator's clock, and into a
	Counter, and the counter goes up once per rising edge rather than racing while the clock is high.
</p>

<h2>What to remember</h2>
<ul>
	<li>A clock is a signal that flips between 0 and 1 at a steady rate; it carries timing, not data.</li>
	<li>Period is the time for one cycle, frequency is cycles per second, and each is 1 divided by the other.</li>
	<li>A rising edge is the instant a signal goes 0 to 1; a falling edge, 1 to 0. Each period has one of each.</li>
	<li>Making every memory element change on the same edge gives the rest of the circuit a full period to settle.</li>
	<li>A gated latch responds for as long as enable is high; only responding at the edge fixes that.</li>
</ul>
