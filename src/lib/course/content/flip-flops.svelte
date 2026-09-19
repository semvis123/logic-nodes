<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveFlipFlop from '$lib/course/widgets/LiveFlipFlop.svelte';
</script>

<h2>A latch that waits for the edge</h2>
<p>
	The gated latch from the last lesson listens for as long as its enable is high. A <strong>flip-flop</strong> is a
	latch that listens only at a clock edge. It looks at its inputs at the instant of the rising edge, moves its output to
	match, and then ignores the inputs completely until the next edge, however much they change in between. A circuit that
	behaves like that is called <strong>edge-triggered</strong>, as opposed to level-sensitive, and it is what makes the
	plan from the last lesson work: every flip-flop in a design shares one clock, so every stored bit changes at the same
	instant, once per period.
</p>

<Aside kind="term" title="edge-triggered">
	<p>
		<strong>Edge-triggered</strong> means responding to inputs only at the instant a clock changes, rising or falling, and
		ignoring them the rest of the time. That is the whole difference between a flip-flop and a latch: a latch is level-sensitive
		and responds whenever its inputs change (or whenever its enable is high); a flip-flop responds once per clock edge.
	</p>
</Aside>

<p>
	Inside, a flip-flop is still an SR latch with logic in front of it, and the four standard kinds differ only in what
	that logic does with the inputs. They are named after their inputs: SR, D, T and JK.
</p>

<h2>The D flip-flop</h2>
<p>
	The simplest and by far the most used. It has one input, <strong>D</strong> for data, and one rule: on the rising edge,
	Q becomes whatever D is at that instant. Between edges Q holds. There is no forbidden input and nothing to work out. Set
	D, press the clock, and watch the timing diagram grow.
</p>

<LiveFlipFlop kind="d" />

<p>
	The diagram is worth learning to read, because it is how sequential circuits are drawn everywhere. Time runs left to
	right and each column is one clock cycle. The dashed lines are the rising edges. The rows are the signals: the clock
	at the top, then the inputs, then Q. Q only ever changes on a dashed line, and it takes the value D had in the column
	before, so the response arrives one column late. That one-column delay is a flip-flop doing its job: D was captured at
	the edge and held steady for the whole of the next cycle, whatever D did afterwards.
</p>

<Aside kind="mistake" title="expecting Q to follow D between edges">
	<p>
		Set D to 1 and Q does not move. It will not move until the clock is pressed. People used to gates find this strange
		at first, because every gate so far answered immediately. A flip-flop is not answering a question; it is taking a
		photograph, and it only takes one when the clock says so. If D changes back before the edge, the change is never
		seen.
	</p>
</Aside>

<h2>The T flip-flop</h2>
<p>
	The <strong>T</strong> stands for toggle. Its rule: when T is 1, Q flips to its opposite on every edge; when T is 0, Q
	holds. Hold T at 1 and press the clock repeatedly and Q goes 0, 1, 0, 1, changing once per edge, which means it completes
	one full cycle for every two cycles of the clock. That is why a chain of T flip-flops counts in binary, and the next stage
	builds one.
</p>

<LiveFlipFlop kind="t" />

<h2>The JK flip-flop</h2>
<p>
	The <strong>JK</strong> is the SR latch with its one flaw fixed. J sets and K resets, exactly like S and R, and with
	both at 0 it holds. The difference is J = K = 1. Instead of being forbidden, it <strong>toggles</strong>: Q flips to
	its opposite on the edge, just like a T flip-flop with T at 1. Every one of the four input combinations now means
	something, which is why the JK was for a long time the general-purpose flip-flop.
</p>

<LiveFlipFlop kind="jk" />

<div class="example">
	<p>
		<strong>Worked example.</strong> A JK flip-flop is holding Q = 0. On the first edge J = 1 and K = 1; on the second, J
		= 0 and K = 1. What is Q after each edge?
	</p>
	<p>
		First edge: J and K are both 1, which is the toggle row of the characteristic table. Q was 0, so it flips to 1.
		Second edge: J = 0 and K = 1 is the reset row, so Q goes to 0 whatever it was. Q after the two edges is 1, then 0.
		Check it against the table under the widget: the row J = 1, K = 1, Q = 0 gives Q⁺ = 1, and the row J = 0, K = 1, Q =
		1 gives Q⁺ = 0.
	</p>
</div>

<h2>Reading the tables</h2>
<p>
	Each widget has the flip-flop's <strong>characteristic table</strong> underneath: for every combination of inputs and
	present Q, the Q⁺ it gives on the next edge, with the row that matches the widget highlighted. The reference pages
	also give each flip-flop's <strong>excitation table</strong>, which is the same information turned round: given where
	Q is and where you want it to go, what must the inputs be? That is the table you use when designing a circuit rather
	than analysing one, and the next stage leans on it.
</p>

<Aside kind="why" title="why do real designs mostly use D?">
	<p>
		Because the JK and T can both be made from a D flip-flop plus a gate or two, and a D has only one input to get
		right. A T is a D fed from an XOR of T and Q. A JK is a D fed from a little logic on J, K and Q. When a design tool
		is choosing, it would rather add a gate than manage a second control input, so nearly every stored bit in a modern
		chip is a D flip-flop, and registers are simply rows of them sharing a clock.
	</p>
</Aside>

<h2>One rule about timing</h2>
<p>
	The edge is an instant, but the circuit behind it is not infinitely fast, so every flip-flop has a
	<strong>setup time</strong>: the input must already be steady for a short time before the edge arrives, or the
	flip-flop may capture nonsense. It is the reason the plan of "change everything on the edge, then settle" works: the
	settling must finish before the next edge minus the setup time, and that is the limit on how fast a clock can run.
</p>

<h2>What to remember</h2>
<ul>
	<li>A flip-flop is a latch that only looks at its inputs on a clock edge: edge-triggered, not level-sensitive.</li>
	<li>D: on the edge, Q copies D. The one used most, and the building block of registers.</li>
	<li>T: on the edge, Q flips when T is 1 and holds when T is 0. The building block of counters.</li>
	<li>JK: J sets, K resets, both hold with 0 and toggle with 1; the forbidden case is gone.</li>
	<li>A timing diagram shows Q changing only on the edges, one column after the inputs that caused it.</li>
</ul>
