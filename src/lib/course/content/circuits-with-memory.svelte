<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import FeedbackLoop from '$lib/course/widgets/FeedbackLoop.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>Everything so far had no memory</h2>
<p>
	Every circuit in the course up to now, from a single gate to a full adder, has one thing in common: its output depends
	only on what its inputs are doing <em>right now</em>. Give an AND gate two 1s and it outputs 1. Give it the same two
	1s tomorrow and it outputs 1 again. It has no idea what it was doing a moment ago. A circuit like that is called
	<strong>combinational</strong>, because its output is fixed by the combination of inputs in front of it, and a truth
	table says everything there is to say about it.
</p>

<Aside kind="term" title="combinational">
	<p>
		A <strong>combinational</strong> circuit is one whose output depends only on its present inputs. The same inputs always
		give the same output. Gates, adders, decoders and multiplexers are all combinational.
	</p>
</Aside>

<p>
	That is a real limit. A calculator has to remember the first number while you type the second. A traffic light has to
	know that it was red a moment ago, so that it goes to red and amber next rather than straight to green. To do any of
	that, a circuit has to hold on to a value after the input that caused it has gone away. It needs memory, and no amount
	of combinational logic will give it that.
</p>

<h2>One wire looping back</h2>
<p>
	Here is the whole trick. Take an OR gate. Wire its output back round into one of its own inputs, so the gate's answer
	becomes part of its own question. The other input is a button called set.
</p>

<FeedbackLoop />

<p>
	Walk through it. At the start set is 0 and the output is 0, so the fed-back input is 0 too. The OR sees 0 and 0 and
	outputs 0. Nothing changes. Now press set. The OR sees 1 and 0 and outputs 1, and that 1 travels back round to the
	second input. Release set. The OR now sees 0 from the button and 1 from its own output, and an OR with any input at 1
	outputs 1. The output stays at 1, on its own, with nobody pressing anything. The circuit is remembering that set was
	once pressed.
</p>
<p>
	Notice what just happened to the truth table. With set at 0 the output was 0 at the start and 1 at the end. Same
	input, two different outputs. No truth table can express that, because the answer depends not only on the inputs but
	on what happened before. The circuit has a <strong>state</strong>, and a circuit with state is called
	<strong>sequential</strong>.
</p>

<Aside kind="term" title="state and sequential">
	<p>
		The <strong>state</strong> of a circuit is what it is remembering at this moment: the value stored in it, which its
		inputs can change but do not decide on their own. A <strong>sequential</strong> circuit is one that has state, so its
		output depends on the sequence of things that happened to it, not just on the inputs in front of it now. The only way
		to get state out of gates is feedback: an output routed back to an input.
	</p>
</Aside>

<div class="example">
	<p>
		<strong>Worked example.</strong> The OR loop starts with its output at 0. Over four moments, set is 0, then 1, then 0,
		then 0. What is the output at each moment?
	</p>
	<p>
		Moment 1: set is 0, fed back is 0, so 0 OR 0 = 0. Moment 2: set is 1, so 1 OR 0 = 1, and that 1 goes round to the
		second input. Moment 3: set is 0 but fed back is now 1, so 0 OR 1 = 1. Moment 4: the same, 0 OR 1 = 1. The output is
		0, 1, 1, 1. Once it has been 1, it is 1 for ever.
	</p>
</div>

<h2>Why the loop cannot be cleared</h2>
<p>
	That "for ever" is the problem. Once a 1 is going round the loop, the OR gate has a 1 on its second input whatever the
	button does, so there is no input that brings the output back to 0. It is memory, but one-way memory: a fuse that has
	blown. Useful memory needs two operations, a way to set it to 1 and a way to reset it to 0, and the OR loop only has
	the first.
</p>
<p>
	The fix is to put something in the loop that can break it. Send the fed-back wire through an AND gate together with
	the opposite of a reset button. While reset is 0 the AND passes the fed-back value through unchanged and the loop
	works as before. Press reset and the AND outputs 0, the OR sees 0 and 0, and the output drops. The expression below is
	exactly that circuit, with the fed-back value written as q.
</p>

<LiveExpression
	expression="set | (q & !reset)"
	label="What the output becomes: set OR (fed back AND NOT reset)"
	names={{ q: 'fed back' }}
	outputLabel="next"
/>

<p>
	With set and reset both 0, the next output simply equals the fed-back value: the circuit holds. Set forces a 1; reset
	forces a 0. That equation, set OR (q AND NOT reset), is the SR latch, and the next lesson builds it out of two gates.
</p>

<Aside kind="why" title="why not just cut the power?">
	<p>
		Cutting the power does clear the loop, and that is exactly what happens to every bit in a computer when it is
		switched off. But it clears everything at once. A useful memory needs to clear one bit while its neighbours keep
		their values, and that needs a reset input, not a power switch.
	</p>
</Aside>

<Aside kind="mistake" title="a long chain of gates is not memory">
	<p>
		A circuit with dozens of gates in a row, like a four bit adder, feels as if it ought to remember something. It does
		not. Signals only ever flow forwards through it, so the output is still fixed by the inputs now, however deep the
		chain. The test is not how many gates there are but whether you can follow a wire from an output back round to an
		input. No loop, no state.
	</p>
</Aside>

<h2>A preview: why a clock will be needed</h2>
<p>
	A loop like this responds the instant its inputs change. That is fine for one loop. A real circuit has thousands of
	them, each feeding the next, and each settles at its own moment, a little sooner or later than its neighbours. Two
	loops that were meant to change together can end up changing in the wrong order, and the result depends on which wire
	happened to be faster.
</p>
<p>
	The cure, which arrives in the third lesson of this stage, is a <strong>clock</strong>: a signal that ticks at a
	steady rate and tells every piece of memory in the circuit to look at its inputs at the same instant. Between ticks,
	everything has time to settle. First, though, the latch itself.
</p>

<h2>What to remember</h2>
<ul>
	<li>A combinational circuit's output depends only on its inputs now; the same inputs always give the same output.</li>
	<li>Feeding an output back to an input gives a circuit state: a value it holds after the input has gone.</li>
	<li>A circuit with state is sequential, and no truth table can describe it, because history matters.</li>
	<li>An OR loop can be set but never cleared; useful memory needs both a set and a reset.</li>
	<li>With many loops in one circuit, a clock is needed to keep their changes in step.</li>
</ul>
