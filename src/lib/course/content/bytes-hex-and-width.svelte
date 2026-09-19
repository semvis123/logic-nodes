<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import BitStrip from '$lib/course/widgets/BitStrip.svelte';
	import HexNibbles from '$lib/course/widgets/HexNibbles.svelte';
	import { toBits, render as renderBits } from '$lib/numbers';

	// The sixteen nibbles and the hex digit each one stands for, computed from
	// the same code the converter uses so the table cannot drift.
	const nibbleTable = Array.from({ length: 16 }, (_, i) => {
		const bits = toBits(i, 4);
		return { bits: bits.join(''), decimal: i, hex: renderBits(bits, 'hex') };
	});
</script>

<h2>Bits come in groups</h2>
<p>
	Nobody handles bits one at a time. A single bit answers a single yes-or-no question, and almost everything a circuit
	does needs more than that, so bits are dealt with in fixed-size groups. Two sizes come up so often that they have
	names.
</p>

<Aside kind="term" title="nibble and byte">
	<p>
		A <strong>nibble</strong> is four bits. A <strong>byte</strong> is eight bits, which is two nibbles. A byte can hold
		2<sup>8</sup> = 256 different patterns, so as an unsigned number it runs from 0 to 255. Memory sizes, file sizes and
		the width of most simple circuits are all counted in bytes.
	</p>
</Aside>

<p>
	The byte is the group that matters most. Almost every computer built since the 1970s stores its memory as a long row
	of bytes, and bigger values are made of several bytes side by side. The nibble matters for a different reason: it is
	exactly the size of one hexadecimal digit, which is the subject of the next section.
</p>

<h2>Hex: one digit per nibble</h2>
<p>
	Binary is easy for a circuit and tiresome for a person. Try reading <span class="mono">1011011010011100</span> out
	loud and you will lose your place halfway through. <strong>Hexadecimal</strong>, or hex for short, is a shorthand for
	writing bit patterns. It uses sixteen digits: 0 to 9 as usual, then the letters A to F for ten to fifteen. Sixteen is
	2<sup>4</sup>, so one hex digit stands for exactly one nibble, and a byte is always exactly two hex digits. Here is
	the whole table.
</p>

<div class="table-wrap">
	<table class="data-table">
		<caption>Every nibble and its hex digit</caption>
		<thead>
			<tr><th scope="col">Nibble</th><th scope="col">Decimal</th><th scope="col">Hex</th></tr>
		</thead>
		<tbody>
			{#each nibbleTable as row}
				<tr>
					<td class="mono">{row.bits}</td>
					<td>{row.decimal}</td>
					<td class="mono">{row.hex}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p>
	To turn a byte into hex, split it into its two nibbles and look each one up. To go back, replace each hex digit with
	its nibble. There is no arithmetic in either direction, only the lookup, and after a little practice the table is in
	your head. Try it below: each nibble has its own hex digit, and flipping a bit only ever changes the digit it belongs
	to.
</p>

<HexNibbles />

<div class="example">
	<p><strong>Worked example.</strong> Write the byte <span class="mono">10110110</span> in hex, then in decimal.</p>
	<p>
		Split it into nibbles: <span class="mono">1011</span> and <span class="mono">0110</span>. From the table, 1011 is
		eleven, which is B, and 0110 is six. So the byte is <span class="mono">B6</span> in hex. For the decimal value, the left
		digit is worth sixteen times the right one, just as the left digit of a two-digit decimal number is worth ten times the
		right one: 11 × 16 + 6 = 176 + 6 = 182.
	</p>
</div>

<Aside kind="why" title="why hex and not decimal?">
	<p>
		Decimal is the system you know, so why not write a byte as a number from 0 to 255? Because a decimal digit does not
		line up with any group of bits. Ten is not a power of two, so the decimal digits of 182 tell you nothing about which
		bits are set, and changing one bit can change every decimal digit. A hex digit is a nibble, so from
		<span class="mono">B6</span> you can read off the bits directly. Hex is also short: sixteen bits become four characters,
		and a thirty-two bit value becomes eight.
	</p>
</Aside>

<Aside kind="mistake" title="reading hex 10 as ten">
	<p>
		The same trap as binary, one lesson on. In hex, <span class="mono">10</span> is sixteen and
		<span class="mono">FF</span> is 255. When it matters which system a number is in, programmers put
		<span class="mono">0x</span> in front of hex and <span class="mono">0b</span> in front of binary, so
		<span class="mono">0x10</span> is sixteen and <span class="mono">0b10</span> is two. Also watch the split: nibbles are
		counted from the right, so a pattern that is not a multiple of four bits long gets its short nibble on the left.
	</p>
</Aside>

<h2>Width: how many bits there are</h2>
<p>
	The previous lesson introduced the <strong>width</strong> of a circuit: the fixed number of bits it holds. A width is nearly
	always a whole number of bytes, and four widths do most of the work in the world: 8 bits, 16 bits, 32 bits and 64 bits.
	An eight bit width holds one byte, and a sixty-four bit width holds eight of them.
</p>
<p>
	The width sets the biggest number that fits. With <em>n</em> bits there are 2<sup>n</sup> patterns, one of which is
	zero, so the biggest value is 2<sup>n</sup> − 1. For a byte that is 255. For sixteen bits it is 65,535, and for thirty-two
	bits it is a little over four billion. Click every bit on below and read the value.
</p>

<BitStrip bits={8} value={254} hex label="A byte, with its value in decimal and in hex. Set every bit to 1." />

<p>
	Now imagine adding one to all-ones. In decimal, 999 plus one needs a fourth column. In binary,
	<span class="mono">11111111</span> plus one needs a ninth bit, and an eight bit circuit does not have one. The 1 that
	should have gone into that ninth column has nowhere to go, so the eight bits that remain read
	<span class="mono">00000000</span>. The value has <strong>wrapped round</strong> to zero. Nothing broke; the circuit did
	exactly what its wires allow. When you build an adder in stage 5 you will see that lost 1 come out on a wire of its own,
	called the carry out, so that a circuit which cares can catch it.
</p>

<Aside kind="tip">
	<p>
		The powers of two that match common widths are worth knowing by sight: 2<sup>8</sup> is 256, 2<sup>16</sup> is
		65,536 and 2<sup>32</sup> is about 4.3 billion. The biggest unsigned value at each width is one less.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>A nibble is 4 bits and a byte is 8. A byte holds 256 patterns, so 0 to 255 as an unsigned number.</li>
	<li>Hex uses the digits 0 to 9 and A to F. One hex digit is one nibble, so a byte is two hex digits.</li>
	<li>Converting between hex and binary is a lookup, one nibble at a time, with no arithmetic.</li>
	<li>Common widths are 8, 16, 32 and 64 bits. With <em>n</em> bits the biggest value is 2<sup>n</sup> − 1.</li>
	<li>Adding one to all-ones wraps round to zero, and the lost carry comes out on its own wire in an adder.</li>
</ul>
