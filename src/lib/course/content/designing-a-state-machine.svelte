<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import StateAssignment from '$lib/course/widgets/StateAssignment.svelte';
	import { fsms } from '$lib/fsm';
	import { evaluate } from '$lib/boolean';
	import { namedEquations } from '$lib/course/fsmText';

	// The equations are derived from the transition table by the Karnaugh map
	// engine, and the worked row is evaluated with them, so every line here is
	// generated rather than typed.
	const detector = fsms.find((f) => f.slug === 'moore-101') ?? fsms[0];
	const equations = namedEquations(detector);
	const eq = (name: string) => equations.find((e) => e.name === name)?.text ?? '';

	// The row worked in the example: S2 (seen 10) with x = 1, which goes to S3.
	const from = detector.states.find((s) => s.id === 'S2') ?? detector.states[0];
	const transition = detector.transitions.find((t) => t.from === from.id && t.input === '1') ?? detector.transitions[0];
	const to = detector.states.find((s) => s.id === transition.to) ?? detector.states[0];
	const values = { Q1: from.code[0] === '1', Q0: from.code[1] === '1', x: transition.input === '1' };
	const check = equations.map((e) => ({ name: e.name, value: evaluate(e.ast, values) ? 1 : 0 }));
	const bit = (name: string) => check.find((c) => c.name === name)?.value ?? 0;
	const codes = detector.states.map((s) => `${s.id} = ${s.code}`).join(', ');
</script>

<h2>The procedure</h2>
<p>
	The last lesson promised that once a machine is a state table, turning it into a circuit is mechanical. Here is the
	procedure, the same for every machine, and then the 101 detector worked through it.
</p>
<ol>
	<li>
		<strong>Draw the state diagram.</strong> One circle per situation the machine must remember, one arrow per input value
		from each.
	</li>
	<li><strong>Write the state table.</strong> Every present state and input, with the next state and the output.</li>
	<li>
		<strong>Assign codes.</strong> Give each state a binary pattern. Each bit of the pattern will live in one flip-flop.
	</li>
	<li><strong>Choose flip-flops.</strong> D flip-flops are the usual choice, for a reason you will see in a moment.</li>
	<li>
		<strong>Derive the equations.</strong> Each next-state bit and each output is a boolean function of the state bits and
		the inputs. Simplify each one with a Karnaugh map.
	</li>
	<li><strong>Draw the circuit</strong> and check it against the table.</li>
</ol>

<h2>Assigning codes</h2>
<p>
	A state is an idea; a flip-flop holds a bit. To build the machine, each state gets a <strong>code</strong>, a pattern
	of bits, and the machine's state is then simply the contents of a small register. With n states you need enough bits
	to give each one a different pattern: two bits for up to four states, three bits for up to eight, and in general the
	smallest b with 2<sup>b</sup> at least n. The detector has four states, so two bits, held in two flip-flops whose
	outputs we call <span class="mono">Q1</span> and <span class="mono">Q0</span>: {codes}.
</p>
<p>
	With the codes in place the state table becomes a truth table. Its inputs are the state bits and x; its outputs are
	the bits of the next state, called <span class="mono">d1</span> and <span class="mono">d0</span>, and the machine
	output z. Step through the widget and watch the table turn into equations.
</p>

<StateAssignment />

<h2>Why D flip-flops</h2>
<p>
	A D flip-flop copies its D input to Q on the clock edge. So if the flip-flop holding Q1 must show the next state's top
	bit after the edge, its D input must be that bit <em>before</em> the edge: d1 is simply the next-state column for Q1,
	and d0 the column for Q0. There is nothing to translate. Other flip-flops need a lookup: with a T flip-flop you must
	ask "does this bit change?". The tables of what to put on a flip-flop's inputs to get from one state to another are
	called <strong>excitation tables</strong>, which is why the equations are often called excitation equations. With D,
	the excitation equation and the next-state equation are the same thing.
</p>

<h2>The equations</h2>
<p>
	Take each output column of the truth table in turn, put it on a Karnaugh map with Q1, Q0 and x as the variables, and
	group the 1s exactly as in stage 4. The maps give, with ∧ for AND, ∨ for OR and ¬ for NOT:
</p>
<dl class="equations">
	{#each equations as e}
		<div>
			<dt class="mono">{e.name}</dt>
			<dd class="mono">= {e.text}</dd>
		</div>
	{/each}
</dl>
<p>
	Read them in words. <span class="mono">d0 = {eq('d0')}</span>: the low state bit is simply a copy of the input,
	because every state with a 1 in the low bit (S1 and S3) is reached on a 1 and every state with a 0 there on a 0.
	<span class="mono">z = {eq('z')}</span>: the output is 1 only in the state coded 11, which is S3, and it depends on
	the state bits alone, which is what makes this a Moore machine. <span class="mono">d1</span> is the one with real work
	in it, and the map did that work for you.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> Check the equations on one row: the machine is in {from.id} ({from.code}, {from.meaning})
		and x = {transition.input}.
	</p>
	<p>
		From the table, the next state should be {to.id}, coded {to.code}, so we need d1 = {to.code[0]} and d0 = {to
			.code[1]}, and the output in {from.id} should be {from.output}. Now put Q1 = {from.code[0]}, Q0 = {from.code[1]},
		x = {transition.input} into the equations: d1 comes out {bit('d1')}, d0 comes out {bit('d0')} and z comes out {bit(
			'z'
		)}. All three agree with the table. Doing this for every row is the check in step 6, and the site's test suite does
		exactly that for this machine.
	</p>
</div>

<h2>Drawing the circuit</h2>
<p>
	The circuit is now fixed: two D flip-flops on one clock, their outputs Q1 and Q0 fed back into a block of gates
	together with x, that block computing d1, d0 and z from the equations above, and d1 and d0 wired to the D inputs. The
	gates are the combinational part, the flip-flops are the memory, and that shape, gates in a loop with a register, is
	every sequential circuit you will ever meet.
</p>

<Aside kind="why" title="why simplify with a map rather than just wire up the table?">
	<p>
		A table with three inputs could be wired directly, one gate per row, but a real machine may have ten state bits and
		several inputs, and its table thousands of rows. The Karnaugh map finds the few gates that do the same job: in the
		detector, d1 has eight rows and comes out as two terms.
	</p>
</Aside>

<h2>Unused states</h2>
<p>
	Two bits give four codes and the detector uses all four. A machine with three states would leave one code spare, and
	during design that row of the table is a <strong>don't care</strong>: the map may treat it as 0 or 1, whichever gives
	the simpler equation. But a real circuit can land in that code at power-up or after a glitch, and the equations will
	send it somewhere. Either check that every unused code finds its way back to a proper state, or give each one an
	explicit arrow to the reset state and pay for the extra gate. Doing neither is how a machine gets stuck.
</p>

<Aside kind="mistake" title="reading the present state where the next state should be">
	<p>
		The d columns come from the <em>next</em> state's code, not the present one. It is easy, filling in the table, to copy
		the code of the row's own state into d1 d0. The check in the worked example catches it: with the present code in the
		d columns the machine would never move.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>Design order: diagram, table, codes, flip-flops, equations, circuit, check.</li>
	<li>n states need the smallest number of bits b with 2<sup>b</sup> at least n, one flip-flop per bit.</li>
	<li>With D flip-flops each D input is simply the next-state bit, so the equations come straight off the table.</li>
	<li>
		Each next-state bit and output is a boolean function of the state bits and inputs; a Karnaugh map simplifies it.
	</li>
	<li>Unused codes are don't cares in the map, but check where they lead in the real circuit.</li>
</ul>

<style>
	.equations {
		margin: 0.6rem 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.equations div {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.equations dt {
		color: #8ede8e;
		font-weight: 600;
	}

	.equations dd {
		margin: 0;
	}
</style>
