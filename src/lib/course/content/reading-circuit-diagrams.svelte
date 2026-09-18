<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import GateSymbol from '$lib/GateSymbol.svelte';
	import LiveCircuit from '$lib/course/widgets/LiveCircuit.svelte';
	import { gates } from '$lib/gates';
</script>

<h2>The seven shapes</h2>
<p>
	A circuit is drawn as a <strong>circuit diagram</strong>: a symbol for each gate, and lines for the wires between
	them. You have seen the symbols one at a time through this stage; here they are together. The set is the one used on
	most schematics, and it is called ANSI after the American standards body that keeps it.
</p>

<div class="symbols">
	{#each gates as gate}
		<figure class="symbol">
			<GateSymbol gate={gate.slug} label="{gate.name} gate symbol" />
			<figcaption>{gate.name}</figcaption>
		</figure>
	{/each}
</div>

<p>
	Three shapes carry it all. AND has a flat back and a rounded nose. OR has a curved back and comes to a point. NOT is a
	triangle with a bubble. Everything else is built from those: XOR is OR with a second curve behind its back, and a
	bubble on the nose of AND, OR or XOR turns it into NAND, NOR or XNOR. A NOT gate is really a triangle that does
	nothing plus a bubble that does the flipping. There is a second style, the IEC rectangles, where every gate is the
	same box with a label inside; the <a href="/logic-gate-symbols">symbol reference</a> shows both side by side.
</p>

<Aside kind="tip">
	<p>
		Look for the bubble first. If there is one, the gate is the inverted version of whatever shape it is on. Then look
		at the back: flat means AND, curved means OR, and a doubled curve means XOR.
	</p>
</Aside>

<h2>Which way the signal goes</h2>
<p>
	Diagrams read like text: left to right. Inputs sit on the left, the output is on the right, and every gate points
	right, so its inputs enter its back and its answer leaves its nose. A wire from an input runs to one or more gates; a
	wire from a gate's nose runs to the next gate along, or to the output. If you ever lose your place, find the pointed
	or rounded end of a gate, which is always its output, and you know which way you are going.
</p>
<p>
	One signal often needs to go to two places. On a printed schematic, wires that meet at a <strong>dot</strong> are joined
	and carry the same value; wires that simply cross with no dot are not connected at all, they just happen to pass each other
	on the page. The diagrams on this site avoid crossings where they can, and a signal that is used twice leaves its box as
	two wires, so you can always trace any wire back to the box or gate it came from.
</p>

<Aside kind="mistake" title="reading a crossing as a join">
	<p>
		Two wires that cross without a dot are two separate wires. Treating them as connected quietly changes what the
		circuit does, and it is the most common error in reading a schematic. If there is no dot, the wires are strangers.
	</p>
</Aside>

<h2>Working out a diagram</h2>
<p>
	The method is the one from the NOT lesson, now applied to a picture. Write the value of every input next to its box.
	Find a gate whose input wires all have values, apply its rule, and write the result on its output wire. Keep going
	until the output has a value. Every wire in the drawing ends up labelled with a 1 or a 0, and no gate is ever worked
	out before it is ready. The circuit below does the labelling for you in colour: green wires are 1 and red wires are 0.
	Change the inputs and follow the colours from left to right.
</p>

<LiveCircuit
	expression="(a | b) & !c"
	label="Three gates. Click the inputs and follow the colours from left to right."
/>

<div class="example">
	<p>
		<strong>Worked example.</strong> In the circuit above, what is the output when a = 0, b = 1 and c = 0?
	</p>
	<p>
		Label the inputs: a = 0, b = 1, c = 0. The OR gate has a and b, both known: at least one is 1, so its output wire is
		1. The NOT gate has c = 0, so its output wire is 1. The AND gate now has 1 from the OR and 1 from the NOT. Both are
		1, so the output is 1. Set the widget to 0, 1, 0 and every wire into the AND gate should be green.
	</p>
</div>

<h2>From a diagram to an expression</h2>
<p>
	The same walk from left to right also gives you the circuit as writing. Name what each gate computes as you reach it.
	The OR gate above takes a and b, so its output wire is <span class="mono">a ∨ b</span>. The NOT gate takes c, so its
	wire is <span class="mono">¬c</span>. The AND gate takes those two wires, so the whole circuit is
	<span class="mono">(a ∨ b) ∧ ¬c</span>. The brackets are there because the OR happened first; without them the
	expression would read as "a, OR (b AND NOT c)", which is a different circuit. Going the other way, from an expression
	to a drawing, is what the <a href="/logic-circuit-generator">circuit diagram generator</a> does, and it is a good way to
	check your reading: type your expression in and see if the picture matches.
</p>

<Aside kind="why" title="why learn to read drawings when there are expressions?">
	<p>
		Because the drawing is what you will be handed. Datasheets, textbooks, exam papers and the simulator on this site
		all show circuits as pictures, and a picture shows things an expression hides: which signals are shared, how far a
		wire has to travel, and how many gates deep the circuit is, which decides how fast it can run. Being able to move
		freely between the two is the skill; each is easier to read for some questions and harder for others.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>AND is flat-backed, OR is curved and pointed, NOT is a triangle. XOR adds a curve; a bubble adds a NOT.</li>
	<li>Signals flow left to right. A gate's inputs enter its back and its output leaves its nose.</li>
	<li>Wires joined at a dot carry the same value. Wires that cross without a dot are not connected.</li>
	<li>To find the output, label every wire from the inputs onwards, one gate at a time.</li>
	<li>To write the expression, name what each gate computes as you reach it, with brackets round earlier gates.</li>
</ul>

<style>
	.symbols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: 8px;
		margin: 1rem 0;
	}

	.symbol {
		margin: 0;
		padding: 0.5rem 0.4rem 0.3rem;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		text-align: center;
	}

	.symbol figcaption {
		margin-top: 0.3rem;
		color: #ddd;
		font: 600 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}
</style>
