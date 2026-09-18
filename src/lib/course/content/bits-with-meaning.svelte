<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import CodeExplorer from '$lib/course/widgets/CodeExplorer.svelte';
	import { invalidBcdPatterns, fromBits } from '$lib/numbers';

	// The six nibbles BCD never uses, from the converter's own list.
	const unused = invalidBcdPatterns.map((bits) => ({ bits: bits.join(''), value: fromBits(bits) }));
</script>

<h2>A pattern means nothing on its own</h2>
<p>
	So far every pattern of bits has been a number. That was a choice, not a fact about bits. The byte
	<span class="mono">01000010</span> is the number 66 only if everyone has agreed to read it as a number. Under a different
	agreement the same eight bits are the letter B, or the two decimal digits 4 and 2, or eight separate yes-or-no answers.
	The bits do not change. Only the reading does.
</p>

<Aside kind="term" title="code">
	<p>
		A <strong>code</strong> is an agreed table that says which pattern of bits stands for which thing. Binary numbers are
		one code. This lesson shows three more, and the same byte looks different under each one.
	</p>
</Aside>

<CodeExplorer />

<h2>Letters: ASCII</h2>
<p>
	To store text, a computer needs a code that pairs every character with a number. The one almost every system agrees on
	is <strong>ASCII</strong>, a table drawn up in the 1960s that gives 128 characters a number from 0 to 127. Capital A
	is 65, B is 66, and so on up to Z at 90. The small letters follow, with a at 97 and z at 122. The characters 0 to 9
	are in the table too, with the character 0 at 48 and 9 at 57. That last part trips people up: the character
	<span class="mono">7</span> that you see on a screen is stored as the number 55, not as the number 7.
</p>
<p>
	The codes from 32 to 126 are the ones that print: 32 is a space, and the rest are letters, digits and punctuation.
	Codes below 32 are instructions to the printer or screen, such as "new line", and 127 is "delete". None of those has a
	shape to draw, which is why the widget above says "not printable" for them. ASCII needs only seven bits for its 128
	codes, but it is always stored in a byte, and the eighth bit was later used to extend the table.
</p>

<Aside kind="mistake" title="the byte contains a letter">
	<p>
		It does not. The byte contains 01000010, and a program that has been told to read it as ASCII draws a B. Hand the
		same byte to a program expecting a number and it will say 66. If two programs disagree about the code, the text
		comes out as rubbish, which is exactly what happens when a file is opened with the wrong character encoding.
	</p>
</Aside>

<h2>Colour: three bytes</h2>
<p>
	A colour on a screen is made by mixing red, green and blue light, and each of the three is stored as one byte: 0 means
	none of that light, 255 means as much as the pixel can give. So a colour is 3 bytes, which is 24 bits, and there are 2<sup
		>24</sup
	>
	= 16,777,216 colours to choose from. This is the code behind the hex colours in web pages:
	<span class="mono">FF8000</span> is red 255, green 128, blue 0, which is orange. Each byte is two hex digits, so the three
	channels sit side by side and can be read off one at a time.
</p>

<h2>Decimal digits: BCD</h2>
<p>
	Sometimes a circuit wants to show a decimal number to a person, on a clock or a meter. Working out the decimal digits
	of a binary number takes dividing by ten, and dividing is hard to build. <strong>Binary coded decimal</strong>, or
	BCD, sidesteps the problem: each decimal digit gets its own nibble, holding that digit as a four bit binary number.
	The number 42 becomes <span class="mono">0100 0010</span>, a 4 and then a 2, rather than 101010.
</p>
<p>
	A nibble has sixteen patterns and there are only ten digits, so six patterns are never used in BCD. They are the
	nibbles worth 10 to 15:
</p>
<div class="table-wrap">
	<table class="data-table">
		<caption>The six nibbles BCD never uses</caption>
		<thead>
			<tr><th scope="col">Nibble</th><th scope="col">Unsigned value</th><th scope="col">In BCD</th></tr>
		</thead>
		<tbody>
			{#each unused as row}
				<tr>
					<td class="mono">{row.bits}</td>
					<td>{row.value}</td>
					<td>not a digit</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p>
	That waste is the price of a simpler circuit: each nibble drives its own digit of the display directly. In stage 4,
	when you design the circuit that turns a BCD digit into the seven bars of a display, those six patterns will come back
	as inputs that can never happen, and you will be allowed to give them whatever output makes the circuit smallest.
</p>

<div class="example">
	<p><strong>Worked example.</strong> Read the byte <span class="mono">01000010</span> three ways.</p>
	<p>
		As an unsigned number, the 1s sit under the weights 64 and 2, so it is 66. As ASCII, 65 is A, so 66 is B. As BCD,
		split it into nibbles: <span class="mono">0100</span> is 4 and <span class="mono">0010</span> is 2, so it is the decimal
		number 42. Three answers, one byte, and every one of them is right under its own code.
	</p>
</div>

<h2>One bit on its own: a flag</h2>
<p>
	The smallest code of all uses a single bit. A <strong>flag</strong> is one bit whose meaning is yes or no for one
	particular question: is the light on, is the door open, did the last sum overflow. Circuits keep such bits in a
	<strong>register</strong>, which is a row of bits a circuit holds on to until it is told to change them; stage 7
	builds one. A byte in a register can hold eight unrelated flags at once, and a circuit that only cares about the light
	reads only its bit and ignores the other seven. Under this code the byte is not a number at all.
</p>

<Aside kind="why" title="what about negative numbers?">
	<p>
		They are a code too, and the one that matters is called two's complement. It reads the top bit of a pattern as a
		negative weight, so <span class="mono">11111111</span> is −1 rather than 255. It is left until stage 5 because the reason
		it is chosen over every other way of writing negatives only makes sense once you have built an adder and seen it wrap.
		For now, every number in this course is unsigned: zero or above.
	</p>
</Aside>

<Aside kind="tip">
	<p>
		Whenever you meet a pattern of bits, ask "under which code?" before asking what it means. Every later stage of the
		course is a circuit that reads its inputs under one code and writes its outputs under another, and most bugs in
		digital design are two parts of a circuit disagreeing about the code.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>
		Bits have no meaning until a code, an agreed table, gives them one. The same pattern means different things under
		different codes.
	</li>
	<li>
		ASCII numbers characters: A is 65, a is 97, and the character 0 is 48. Codes 32 to 126 are the printable ones.
	</li>
	<li>A screen colour is three bytes, one each for red, green and blue: 24 bits, so about 16.8 million colours.</li>
	<li>BCD gives each decimal digit its own nibble, and never uses the six nibbles worth 10 to 15.</li>
	<li>A flag is one bit meaning yes or no. Negative numbers are a code too, and wait until stage 5.</li>
</ul>
