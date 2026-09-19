<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveTwosComplement from '$lib/course/widgets/LiveTwosComplement.svelte';
	import LiveRippleAdder from '$lib/course/widgets/LiveRippleAdder.svelte';
	import { representations } from '$lib/twosComplement';

	// The four bit table, from the same helper as the reference page.
	const codes = representations(4);
	const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));
</script>

<h2>There is no minus sign on a wire</h2>
<p>
	A four bit circuit holds sixteen patterns and nothing else. If you want negative numbers, some of those patterns have
	to <em>mean</em> negative numbers, and the circuit has to be told the rule. The rule almost every computer uses is
	called <strong>two's complement</strong>, and it changes one thing about place value: the top bit is worth
	<strong>minus</strong> its usual weight. In four bits the weights are 8, 4, 2, 1 for unsigned numbers; in two's
	complement they are −8, 4, 2, 1. Every other bit is as before. So <span class="mono">1011</span> is −8 + 2 + 1 = −5,
	and <span class="mono">0101</span> is plain 5, because its top bit is 0 and contributes nothing.
</p>

<LiveTwosComplement value={5} />

<p>
	Patterns with a 0 on top are the non-negative numbers, exactly as in unsigned binary. Patterns with a 1 on top are the
	negatives, counting up from the most negative. Here is the whole four bit table, read both ways:
</p>
<div class="table-wrap">
	<table class="data-table">
		<thead>
			<tr>
				<th scope="col" class="mono">Bits</th>
				<th scope="col">Unsigned</th>
				<th scope="col">Two's complement</th>
			</tr>
		</thead>
		<tbody>
			{#each codes as code}
				<tr>
					<td class="mono">{code.pattern}</td>
					<td>{code.unsigned}</td>
					<td>{signed(code.twosComplement)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>The range</h2>
<p>
	With <em>n</em> bits the most negative number is a 1 followed by zeros, worth −2<sup>n−1</sup>, and the most positive
	is a 0 followed by ones, worth 2<sup>n−1</sup> − 1. Four bits run from −8 to 7, eight bits from −128 to 127. There is one
	more negative number than positive because zero takes one of the patterns with a 0 on top. That is also why −8 is odd one
	out: it has no positive partner in four bits.
</p>

<h2>Negating: invert and add 1</h2>
<p>
	To find the pattern for a negative number, write the positive number in binary at the full width, flip every bit, and
	add 1. The same two steps go the other way too: they turn a negative pattern back into its positive partner. Press
	Negate in the widget above to watch them.
</p>
<div class="example">
	<p><strong>Worked example.</strong> What is −5 in four bit two's complement?</p>
	<p>
		5 is <span class="mono">0101</span>. Invert every bit: <span class="mono">1010</span>. Add 1:
		<span class="mono">1011</span>. Check it by reading the weights −8, 4, 2, 1: −8 + 2 + 1 = −5. Going back the same
		way, invert 1011 to get 0100 and add 1 to get 0101, which is 5 again.
	</p>
</div>

<Aside kind="mistake" title="reading the top bit as a plain minus sign">
	<p>
		<span class="mono">1011</span> is not −3. Writing a minus sign and then the size, the way we do on paper, is a different
		code called sign-magnitude, and adders do not work with it. In two's complement the top bit is a weight, −8, that you
		add to the rest: −8 + 3 = −5.
	</p>
</Aside>

<h2>Subtraction is addition</h2>
<p>
	Here is the reason this code won. To work out 6 − 3, add 6 and −3. In four bits that is
	<span class="mono">0110 + 1101</span>, and the ripple carry adder from the last lesson gives
	<span class="mono">0011</span> with a carry out of 1. Throw the carry away and 0011 is 3. Right answer, ordinary adder,
	no new circuit. Try it below: a is 6 and b is the pattern for −3.
</p>

<LiveRippleAdder
	a={6}
	b={13}
	signed
	label="6 + (−3). The b row holds 1101, the pattern for −3. Ignore the carry out."
/>

<p>
	In hardware, the "invert and add 1" happens on the way in. A row of NOT gates (or XOR gates with a control line) flips
	every bit of b, and the adder's first carry in is set to 1 to do the "add 1". One control signal switches the circuit
	between a + b and a − b, which is why a processor has an adder and no separate subtractor.
</p>

<Aside kind="why" title="why does adding the pattern for −3 subtract 3?">
	<p>
		Read as unsigned, the pattern 1101 is 13, and 13 = 16 − 3. So 6 + 13 = 19 = 16 + 3. In a four bit circuit the 16
		falls off the end as the carry out, and what is left is 3. Adding 2<sup>n</sup> changes nothing in <em>n</em> bits, so
		"add 16 − 3" and "subtract 3" come out the same. Two's complement is built on exactly that fact.
	</p>
</Aside>

<h2>Overflow for signed numbers</h2>
<p>
	The carry out no longer means what it did. 6 + (−3) had a carry out of 1 and was perfectly correct. For signed
	numbers, overflow is when the true answer is outside the range, and it shows up as the wrong sign. 5 + 3 is
	<span class="mono">0101 + 0011 = 1000</span>, which reads as −8: two positive numbers gave a negative, so 8 did not
	fit in −8 to 7. The same happens when two negatives give a positive. Adding a positive and a negative can never
	overflow, because the answer is always between the two.
</p>

<h2>What to remember</h2>
<ul>
	<li>Two's complement makes the top bit worth −2<sup>n−1</sup>; every other bit keeps its weight.</li>
	<li>Four bits hold −8 to 7; eight bits hold −128 to 127.</li>
	<li>To negate a number, invert every bit and add 1. The same steps go both ways.</li>
	<li>Subtraction is adding the negative, so one adder does both jobs.</li>
	<li>For signed numbers, ignore the carry out; overflow is two same-sign numbers giving the other sign.</li>
</ul>
