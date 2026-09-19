<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>The gate that says no</h2>
<p>
	AND and OR combine inputs. The third gate does something simpler: it takes one input and outputs the opposite. A 1 in
	gives a 0 out, and a 0 in gives a 1 out. It is called <strong>NOT</strong>, and its truth table has just two rows,
	because one input can only be in two states.
</p>

<LiveGate gate="not" />

<p>
	The symbol is a triangle pointing in the direction the signal travels, with a small circle on its tip. That circle is
	worth knowing on its own, because it turns up on other gates too.
</p>

<Aside kind="term" title="bubble">
	<p>
		The small circle on the output of the NOT symbol is called a <strong>bubble</strong>, and wherever you see one it
		means "invert here". The triangle by itself would just pass the signal through unchanged; the bubble is the part
		that flips it. Later you will see bubbles on the outputs of other gates, and they mean exactly the same thing.
	</p>
</Aside>

<p>
	NOT is also called an <strong>inverter</strong>, because it inverts the signal. Putting two NOT gates in a row gets
	you back where you started: a 1 becomes 0 and then 1 again. That sounds pointless, and as logic it is, but it is the
	first hint that gates can be connected to each other, which is the real subject of this lesson.
</p>

<h2>Gates feed gates</h2>
<p>
	A gate's output is a wire carrying a 1 or a 0. An input of another gate is a wire expecting a 1 or a 0. So the one can
	be connected to the other, and now you have a circuit of two gates in which the second one works on the first one's
	answer. There is no limit to this. A processor is a few billion gates connected this way, and every one of them is
	doing nothing more than applying its own small rule to whatever arrives on its inputs.
</p>
<p>
	The wire between two gates deserves a moment's thought. It is not an input you control and it is not the final output.
	It carries an <strong>intermediate value</strong>: a result that exists only to be fed into the next gate. When you
	work out a circuit by hand, you write that value on the wire, and then the next gate has everything it needs.
</p>
<p>
	Here is a circuit of three gates. <span class="mono">a</span> and <span class="mono">b</span> go into an AND; its
	output goes through a NOT; and that result goes into an OR together with <span class="mono">c</span>. Try all the
	combinations and watch the table.
</p>

<LiveExpression expression="!(a & b) | c" label="Three gates in a chain: AND, then NOT, then OR with a third input." />

<Aside kind="term" title="writing a circuit as an expression">
	<p>
		Rather than draw every circuit, engineers write it down. <span class="mono">a ∧ b</span> means "a AND b",
		<span class="mono">a ∨ b</span> means "a OR b", and <span class="mono">¬a</span> means "NOT a". Brackets show which
		gate comes first, the same as in arithmetic. The circuit above is
		<span class="mono">¬(a ∧ b) ∨ c</span>: AND a and b, NOT the result, then OR it with c. You will also see
		<span class="mono">a · b</span> or <span class="mono">ab</span> for AND, <span class="mono">a + b</span> for OR and
		<span class="mono">a'</span> for NOT, and in code <span class="mono">a &amp; b</span>,
		<span class="mono">a | b</span> and <span class="mono">!a</span>. Same gates, different handwriting.
	</p>
</Aside>

<h2>Working a circuit out step by step</h2>
<p>
	The method is always the same, however big the circuit gets. Start at the inputs, find a gate whose inputs are all
	known, work out its output from its rule, and write that value on its output wire. Now another gate has all its inputs
	known. Keep going until you reach the output. You never have to hold more than one gate in your head at a time.
</p>

<div class="example">
	<p>
		<strong>Worked example.</strong> In the circuit above, what is the output when a = 1, b = 1 and c = 0?
	</p>
	<p>
		The AND gate has a = 1 and b = 1. Both are 1, so its output is 1. Write 1 on the wire leaving it. The NOT gate
		receives that 1 and flips it: 0. Write 0 on its output wire. The OR gate now has 0 from the NOT and c = 0. At least
		one 1? No. Its output is 0, so the circuit outputs 0. Set the widget to 1, 1, 0 and check: the output lamp is off.
	</p>
</div>

<Aside kind="mistake" title="working from the output end">
	<p>
		It is tempting to start at the gate nearest the output, since that is the one you want the answer from. But that
		gate cannot be worked out until its inputs are known, and one of them comes from an earlier gate. Start where the
		named inputs go in and move towards the output; each step then only needs values you already have.
	</p>
</Aside>

<Aside kind="why" title="why bother with NOT at all?">
	<p>
		AND and OR can only ever say "yes" more often as you turn more inputs on. Neither can express "when the door is
		<em>closed</em>" if what the sensor gives you is "the door is open". NOT is what lets a circuit act on the absence
		of something. Without it, whole families of decisions would be out of reach. With it, and with AND and OR, every
		decision that can be written as a truth table can be built. The rest of the seven gates are conveniences.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>NOT has one input and outputs the opposite of it. Two NOTs in a row cancel out.</li>
	<li>The bubble on a symbol means "invert here", on NOT and on any other gate it appears on.</li>
	<li>Gates connect: the output wire of one gate can be an input wire of another.</li>
	<li>The wire between two gates carries an intermediate value. Write it down as you go.</li>
	<li>To work out a circuit, start at the inputs and settle one gate at a time until you reach the output.</li>
</ul>
