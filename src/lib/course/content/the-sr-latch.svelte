<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
	import LiveLatch from '$lib/course/widgets/LiveLatch.svelte';
</script>

<h2>Two gates, each holding the other</h2>
<p>
	The last lesson ended with an equation: the next output is set OR (fed back AND NOT reset). It can be built from just
	two NOR gates. A NOR is an OR followed by a NOT: it outputs 1 only when <em>both</em> of its inputs are 0, and a 1 on either
	input forces its output to 0.
</p>

<LiveGate gate="nor" />

<p>
	Take two NOR gates and wire the output of each into one input of the other. That leaves one free input on each gate:
	call them <strong>S</strong> for set and <strong>R</strong> for reset. The outputs are called <strong>Q</strong> and
	<strong>Q̄</strong>. This pair of cross-coupled gates is the <strong>SR latch</strong>, the smallest circuit that can
	remember one bit. Call the gate that takes R the Q gate, since Q comes out of it, and the gate that takes S the Q̄
	gate.
</p>

<Aside kind="term" title="Q and Q̄">
	<p>
		<strong>Q</strong> is the output of a memory circuit: the bit it is holding. <strong>Q̄</strong>, said "Q bar", is
		its complement, the same bit inverted. In a working latch the two are always opposites, and the second one comes
		free from the second gate. A <strong>latch</strong> is any circuit that stays in whichever state it was last pushed into.
	</p>
</Aside>

<LiveLatch />

<h2>Set, gate by gate</h2>
<p>
	Start with S and R both 0, Q at 0 and Q̄ at 1. Is that stable? The Q gate sees R = 0 and Q̄ = 1; the 1 forces it to 0,
	so Q stays 0. The Q̄ gate sees S = 0 and Q = 0, so it outputs 1, and Q̄ stays 1. Each gate is holding the other where it
	is.
</p>
<p>
	Now raise S to 1. The Q̄ gate has a 1 on an input, so it is forced to 0: Q̄ falls. That 0 reaches the Q gate, which now
	sees R = 0 and Q̄ = 0, so Q rises to 1. That 1 travels back to the Q̄ gate, which already had a 1 from S, so nothing
	more changes. The latch has flipped: Q is 1, Q̄ is 0.
</p>
<p>
	Now drop S back to 0. The Q̄ gate sees S = 0 and Q = 1, still a 1 on an input, so Q̄ stays 0, and the Q gate keeps Q at
	1. Nothing moved: the set input has gone and the latch is still holding the 1. That is memory. Switch the widget to
	step mode to watch each move happen one at a time.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> The latch is holding Q = 1, Q̄ = 0. R goes to 1 and then back to 0. What happens at each
		gate?
	</p>
	<p>
		R = 1 puts a 1 on the Q gate, forcing it to 0: Q falls. That 0 reaches the Q̄ gate, which now sees S = 0 and Q = 0,
		so Q̄ rises to 1. The Q gate now has R = 1 and Q̄ = 1, still forced to 0. When R drops to 0 the Q gate sees R = 0 and
		Q̄ = 1, still a 1 on an input, so Q stays 0. The latch is reset and holds the 0.
	</p>
</div>

<h2>Hold, set and reset in one table</h2>
<p>
	A truth table cannot describe the latch, because the same inputs give different outputs depending on what it was
	holding. The fix is to treat the present state as an extra input. The table under the widget does that: its columns
	are S, R, the present Q, and Q⁺, the value Q settles to. That is a <strong>characteristic table</strong>, and every
	memory circuit on this site is described by one.
</p>
<p>
	With S = R = 0 the next Q equals the present Q: the latch <strong>holds</strong>. With S = 1 and R = 0 the next Q is 1
	whatever it was: <strong>set</strong>. With R = 1 and S = 0 it is 0: <strong>reset</strong>. Hold is the row where the
	latch is being memory.
</p>

<Aside kind="why" title="why does it hold with both inputs at 0?">
	<p>
		Because each gate's output is an input to the other. Whichever gate is outputting 1 puts a 1 on the other gate,
		forcing it to 0, and that 0 is what lets the first gate keep outputting 1. The two gates are holding each other up,
		and there are two ways for that to be true: Q = 1, Q̄ = 0 or Q = 0, Q̄ = 1. Two stable states is exactly one bit of
		memory.
	</p>
</Aside>

<h2>The forbidden input</h2>
<p>
	The last two rows are marked not allowed. Raise S and R together and each gate has a 1 on an input, so both are forced
	to 0. Q and Q̄ are both 0, no longer opposites, and anything downstream that relied on Q̄ being the inverse of Q gets
	nonsense. That is the mild problem.
</p>
<p>
	The real problem comes when both inputs are released at once. Each gate now sees two 0s and wants to go to 1, and
	whichever gets there first forces the other back down. If the Q gate is a fraction faster the latch ends up set; if
	the Q̄ gate is, reset. Tiny differences in gate speed decide it, so the result cannot be predicted, which is why the
	table gives no next value for that row. Designers either keep S = R = 1 from ever happening, or use the JK flip-flop,
	two lessons from now, which gives it a meaning.
</p>

<Aside kind="mistake" title="expecting Q̄ always to be the opposite of Q">
	<p>
		It is, in every allowed row. People then assume it is a law of the circuit and design around it, and the one
		forbidden row breaks the assumption: both outputs are 0. Nothing is damaged; the latch is simply not doing what a
		latch is for. Treat S = R = 1 as an input the circuit must never see, not as a state it has.
	</p>
</Aside>

<h2 id="nand">The NAND version</h2>
<p>
	Wire two NAND gates the same way and you get the same latch inside out. A NAND is forced, to 1, by a 0 on either
	input, so a 0 does the work a 1 did before. Its inputs are written S̄ and R̄ and are called
	<strong>active-low</strong>: both sit at 1 when idle, a 0 on S̄ sets, a 0 on R̄ resets, and both at 0 is forbidden. Real
	chips prefer this version, because NAND is the smaller and faster gate to make, but everything above carries over with
	the 1s and 0s swapped.
</p>

<h2>What to remember</h2>
<ul>
	<li>An SR latch is two NOR gates, the output of each wired into an input of the other.</li>
	<li>S = 1 sets Q to 1, R = 1 resets it to 0, and with both at 0 the latch holds its last value.</li>
	<li>Q̄ comes from the second gate and is the opposite of Q in every allowed state.</li>
	<li>S = R = 1 is forbidden: both outputs go to 0, and releasing both at once gives an unpredictable result.</li>
	<li>A characteristic table describes memory by listing the next state for each input and present state.</li>
</ul>
