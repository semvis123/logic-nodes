<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveMux from '$lib/course/widgets/LiveMux.svelte';
	import LiveDecoder from '$lib/course/widgets/LiveDecoder.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>Three circuits, one idea</h2>
<p>
	Adders do arithmetic. The circuits in this lesson do something humbler: they choose, they point, and they compare.
	They turn up everywhere inside a computer, and the point of meeting them together is to notice that none of them is
	new. Each one is a truth table, and a truth table is something you already know how to turn into gates.
</p>

<h2>The multiplexer: a switchboard</h2>
<p>
	Imagine an old telephone switchboard. Several lines come in, one line goes out, and an operator connects one of the
	incoming lines to the outgoing one. A <strong>multiplexer</strong>, or <strong>mux</strong>, is that switchboard made
	of gates. It has several data inputs, one output, and a few extra inputs called <strong>select lines</strong>. The
	select lines carry a binary number, the <strong>select code</strong>, and that number says which data input is
	connected to the output. Everything else is ignored.
</p>
<p>
	The smallest one picks between two inputs, a and b, with one select line s. When s is 0 the output copies a; when s is
	1 it copies b. As an expression that is <span class="mono">(¬s ∧ a) ∨ (s ∧ b)</span>: the select line enables one of
	two AND gates and an OR merges them. Try it:
</p>

<LiveExpression
	expression="(!s & a) | (s & b)"
	label="A 2-to-1 multiplexer. s picks a when 0 and b when 1."
	names={{ s: 'select' }}
/>

<p>
	Two select lines make four codes, 00 to 11, so they can pick among four inputs. One way to build that is a tree of
	three 2-to-1 muxes: s0 picks between d0 and d1 and, separately, between d2 and d3, then s1 picks between those two
	results. The widget below is wired that way.
</p>

<LiveMux />

<div class="example">
	<p><strong>Worked example.</strong> A 4-to-1 mux has s1 = 1 and s0 = 0. Which input reaches the output?</p>
	<p>
		Read the select lines as a binary number with s1 as the top bit: 10, which is 2. So the output copies d2, whatever
		d0, d1 and d3 are doing. In the tree, s0 = 0 picks d0 from the first pair and d2 from the second, and s1 = 1 picks
		the second pair's result, which is d2.
	</p>
</div>

<Aside kind="mistake" title="reading the select lines in the wrong order">
	<p>
		s1 s0 = 10 selects input 2, not input 1. The select lines are a binary number, and s1 is the twos column. Muxes are
		also easy to confuse with decoders: a mux has many data inputs and one output, a decoder has no data inputs at all
		and many outputs.
	</p>
</Aside>

<h2>The decoder: one line per code</h2>
<p>
	A <strong>decoder</strong> takes a binary number in and raises exactly one of its outputs, the one whose number
	matches. A 2-to-4 decoder has two inputs and four outputs, y0 to y3. Input 00 lights y0, 01 lights y1, 10 lights y2
	and 11 lights y3, and the other three stay low. Because exactly one output is ever high, this way of writing a number
	is called <strong>one-hot</strong>. Each output is a single AND gate, with each input used as it is or inverted: y0 is
	<span class="mono">¬a ∧ ¬b</span>, y1 is <span class="mono">¬a ∧ b</span>, y2 is <span class="mono">a ∧ ¬b</span>
	and y3 is <span class="mono">a ∧ b</span>.
</p>

<LiveDecoder />

<p>
	Decoders are how a memory chip turns an address into "this row, not the others", and in the next lesson a close cousin
	turns a digit into the bars of a display.
</p>

<h2>The comparator: equal, less, greater</h2>
<p>
	A <strong>comparator</strong> takes two numbers and says how they stand: equal, or which one is bigger. For single
	bits it has three outputs, and exactly one of them is high at any time. Equal is 1 when a and b match, which is XOR
	inverted, the XNOR gate. Greater is 1 only when a is 1 and b is 0, <span class="mono">a ∧ ¬b</span>. Less is the
	mirror image, <span class="mono">¬a ∧ b</span>.
</p>
<p>
	For longer numbers, compare from the top bit down. If the top bits differ, they decide, and the rest is ignored. If
	they are equal, move down one bit and ask again. In gates that is a chain of one bit comparators where each stage only
	gets a say when every stage above it reported equal.
</p>
<div class="example">
	<p><strong>Worked example.</strong> Compare A = 10 and B = 01 (two bits each).</p>
	<p>
		Top bits first: A has 1, B has 0. They differ, and A's is the 1, so A is greater. The bottom bits never need looking
		at. In decimal, that is 2 against 1.
	</p>
</div>

<Aside kind="why" title="why are these 'just truth tables'?">
	<p>
		Every circuit here has outputs that depend only on the inputs at that moment, with no memory. Stage 4 showed that
		any such behaviour can be written as a truth table and any truth table can be built from AND, OR and NOT. So a mux,
		a decoder and a comparator are not new kinds of thing; they are common tables that were worth giving names to,
		because designers reach for them constantly.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>
		A multiplexer passes one of its data inputs to its output, chosen by the select code; n select lines pick among 2<sup
			>n</sup
		> inputs.
	</li>
	<li>A decoder raises exactly one output, the one numbered by its input: a one-hot code.</li>
	<li>A comparator says equal, greater or less; for several bits, compare from the top bit down.</li>
	<li>All three are ordinary truth tables, built from the gates you already have.</li>
</ul>
