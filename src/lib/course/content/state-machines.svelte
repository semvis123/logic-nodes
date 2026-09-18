<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveStateMachine from '$lib/course/widgets/LiveStateMachine.svelte';
	import { fsms, walkTable } from '$lib/fsm';

	// The worked example is walked through the same table as the widget and
	// the reference page, so the trace cannot be wrong.
	const detector = fsms.find((f) => f.slug === 'moore-101') ?? fsms[0];
	const mealy = fsms.find((f) => f.slug === 'mealy-101') ?? fsms[1];
	const demo = '1011';
	const steps = walkTable(detector, demo);
	const stateOf = (id: string) => detector.states.find((s) => s.id === id) ?? detector.states[0];
	const end = stateOf(steps[steps.length - 1].next);
	const flagged = steps.filter((s) => s.output === '1').map((s) => s.state);
	const trace = steps.map((s) => `from ${s.state} on a ${s.input} it goes to ${s.next}`).join('; ');
</script>

<h2>Circuits that remember where they are</h2>
<p>
	Every circuit in this stage so far has been a circuit with a memory: a register remembers a value, a counter remembers
	how far it has counted. There is a general way to describe any such circuit, and it is worth learning because
	engineers use it for everything from traffic lights to the control unit of a processor.
</p>
<p>
	A <strong>finite state machine</strong> has three parts. A fixed set of <strong>states</strong>: the situations the
	machine can be in, of which it is always in exactly one. A rule for the <strong>next state</strong>: given the state
	it is in and the input it sees, which state it moves to on the clock edge. And <strong>outputs</strong>: what the
	machine says to the outside world. "Finite" just means the list of states is fixed in advance and there are only so
	many of them. Each move from one state to another is called a <strong>transition</strong>.
</p>

<Aside kind="term" title="state">
	<p>
		One of the situations a machine can be in, standing for everything it needs to remember about the past. A turnstile
		has two states, locked and unlocked. It does not remember how many people have gone through, because it does not
		need to; the state holds only what matters for deciding what to do next.
	</p>
</Aside>

<p>
	You have already built one. A counter is a state machine with no input at all: its states are the counts, every state
	has one arrow to the next, and the clock edge takes it. A traffic light is one with a handful of states, red, red and
	amber, green, amber, and a timer telling it when to move on. A vending machine is one whose states are how much money
	has been put in so far, with a coin as the input and "release the item" as an output.
</p>

<h2>Two pictures of the same thing</h2>
<p>
	A machine is usually drawn as a <strong>state diagram</strong>: one circle per state, and one arrow per transition,
	labelled with the input that causes it. An arrow from a state back to itself means "stay here". The very same
	information can be written as a <strong>state table</strong>: one row for each combination of present state and input,
	giving the next state and the output. The diagram is easier to think with; the table is what you build the circuit
	from. They are two views of one thing, and you should be able to turn either into the other.
</p>
<p>
	Here is a real one to drive. It watches a stream of bits, one per clock, and raises its output z for one clock after
	it has seen the bits 1, 0, 1 arrive in order. Its four states are how much of the pattern it has seen so far. Press 1,
	0, 1 and watch.
</p>

<LiveStateMachine />

<p>
	Notice that the machine never stores the bits themselves. It only remembers how much of the pattern the recent input
	could still be part of. After 1, 0, 1 it is in <span class="mono">S3</span>, and if another 1 arrives it goes to
	<span class="mono">S1</span>, "seen 1", because that final 1 might be the start of the next 101. That is what a state
	is: a summary of the past that is just enough for the future.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> The detector starts in S0 and receives {demo.split('').join(', ')}. Which states
		does it pass through, and when is z 1?
	</p>
	<p>
		Follow the table one bit at a time: {trace}. The output belongs to the state, and only S3 (seen 101) has z = 1, so z
		is 1 for the one clock cycle the machine spends in {flagged.join(' and ')}, which is the cycle after the third bit
		arrived. It ends in {end.id}, {end.meaning}, with z = {end.output}.
	</p>
</div>

<h2>Moore and Mealy</h2>
<p>
	The detector above is a <strong>Moore machine</strong>: its output depends on the state alone. The output is written
	inside each circle, it changes only when the state changes, on a clock edge, and it holds steady for a whole cycle.
	The other kind is a <strong>Mealy machine</strong>, whose output depends on the state <em>and</em> the current input. Its
	outputs are written on the arrows, as input/output, and they can change the moment an input does.
</p>
<p>
	The same detector as a Mealy machine needs only {mealy.states.length} states, because it can raise z on the very arrow
	that completes the pattern, from "seen 10" on a 1, instead of needing a fourth state to be in. It also flags the pattern
	a cycle earlier. The price is an output that can flicker while the input is settling, which a Moore output never does.
	Either kind can be turned into the other; which you choose depends on whether you would rather have fewer states or a steadier
	output.
</p>

<Aside kind="why" title="why bother with a formal description?">
	<p>
		Because once a design is a state table, the rest is mechanical. The next lesson turns a table into flip-flops and
		gates by a fixed procedure, and a test can check every row. Controllers written as a vague pile of conditions are
		where bugs live; controllers written as state machines can be drawn, checked and explained.
	</p>
</Aside>

<Aside kind="mistake" title="a state for every input, or a state for every bit seen">
	<p>
		Beginners either make far too many states, one for every possible input history, or too few, forgetting a situation
		the machine really must tell apart. The test is always the same: two histories need different states only if the
		machine must behave differently after them. The detector treats "seen 1" and "seen 1, 1" as the same state, because
		in both cases the next useful bit is a 0.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>
		A finite state machine is a fixed set of states, a next-state rule based on the current state and input, and
		outputs.
	</li>
	<li>
		The state diagram (circles and arrows) and the state table (one row per state and input) hold the same information.
	</li>
	<li>A state summarises the past: it holds only what the machine needs to decide what to do next.</li>
	<li>
		Moore: output from the state alone, steady for a cycle. Mealy: output from state and input, faster and often fewer
		states.
	</li>
	<li>A counter is a state machine with no input; a controller is one with several.</li>
</ul>
