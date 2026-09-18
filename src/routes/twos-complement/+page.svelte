<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		representations,
		ranges,
		negate,
		addSigned,
		subtractSigned,
		signExtend,
		overflowExamples,
		type SignedSum
	} from '$lib/twosComplement';
	import { toolLink } from '$lib/urlState';

	const WIDTH = 4;

	// Every table on this page is generated from the fixed-width number helpers
	// the binary converter uses, and checked against integer arithmetic by the
	// test suite, so the page cannot show an addition that does not add up.
	const codes = representations(WIDTH);
	const widths = ranges([4, 8, 16, 32]);

	// Live negation: type a number, see the two steps.
	let value = 6;
	let width = 8;
	const clamp = (n: unknown, lo: number, hi: number) =>
		Number.isInteger(n) ? Math.min(Math.max(n as number, lo), hi) : 0;
	$: bound = 2 ** (width - 1);
	$: step = negate(clamp(value, -bound, bound - 1), width);

	// Worked additions and subtractions, at four bits so every column is visible.
	const worked: { label: string; sum: SignedSum }[] = [
		{ label: '5 + (−3)', sum: addSigned(5, -3, WIDTH) },
		{ label: '(−6) + 3', sum: addSigned(-6, 3, WIDTH) },
		{ label: '(−4) + (−2)', sum: addSigned(-4, -2, WIDTH) },
		{ label: '3 − 5', sum: subtractSigned(3, 5, WIDTH) }
	];
	const overflow = overflowExamples(WIDTH);
	const extended = signExtend(-5, 4, 8);
	const extendedPositive = signExtend(5, 4, 8);

	const signedText = (n: number) => (n < 0 ? `−${-n}` : String(n));
	/** A number as it appears inside a sum: negatives in brackets, positives bare. */
	const signedTerm = (n: number) => (n < 0 ? `(${signedText(n)})` : signedText(n));

	const faqs = [
		{
			q: "What is two's complement?",
			a: "The standard way computers represent negative whole numbers. In an n-bit two's complement number the top bit counts as −2ⁿ⁻¹ instead of +2ⁿ⁻¹, and every other bit keeps its usual value. So in eight bits 1111 1111 is −128 + 127 = −1, and 1000 0000 is −128. The same adder that adds unsigned numbers adds these correctly, which is why the representation won."
		},
		{
			q: "How do you convert a number to two's complement?",
			a: 'For a positive number, just write it in binary with enough leading zeros to fill the width. For a negative number, write its magnitude in binary, invert every bit, and add 1. To go back, do the same thing: inverting and adding 1 negates a number in either direction. A quicker version: copy the bits from the right up to and including the first 1, then invert everything to the left of it.'
		},
		{
			q: "What is the range of an n-bit two's complement number?",
			a: 'From −2ⁿ⁻¹ to 2ⁿ⁻¹ − 1. Eight bits hold −128 to 127, sixteen bits −32,768 to 32,767, and thirty-two bits −2,147,483,648 to 2,147,483,647. There is one more negative number than positive because zero takes one of the non-negative patterns, and there is exactly one zero.'
		},
		{
			q: "Why do computers use two's complement instead of sign-magnitude?",
			a: "Because subtraction becomes addition. With two's complement, a − b is a + (−b), and negating b is a row of inverters and a carry in, so one adder does both jobs with no special cases for signs. Sign-magnitude and one's complement both need extra logic to handle signs and both have two representations of zero, which every comparison would then have to allow for."
		},
		{
			q: "How do you detect overflow in two's complement addition?",
			a: 'When adding, overflow can only happen when both operands have the same sign, and it shows up as a result with the opposite sign: two positives adding to a negative, or two negatives adding to a positive. In hardware the test is that the carry into the top bit differs from the carry out of it. The carry out on its own means nothing for signed numbers; it is only the unsigned overflow flag.'
		},
		{
			q: 'What is sign extension?',
			a: "Widening a two's complement number without changing its value: copy the sign bit into all the new bits on the left. −5 in four bits is 1011; in eight bits it is 1111 1011. A positive number gets zeros, as usual. Most processors do this when they load a byte into a wider register as a signed value."
		},
		{
			q: 'Why is −128 special in eight bits?',
			a: 'It is the one number whose negation does not fit. Inverting 1000 0000 gives 0111 1111, adding 1 gives 1000 0000 again, so negating −128 gives −128, and the overflow flag is set. The asymmetry exists because there is one zero and an even number of patterns, so the negatives outnumber the positives by one.'
		}
	];

	const page = {
		title: "Two's Complement: How to Convert, Add and Subtract, with Examples",
		description:
			"What two's complement is and why computers use it: the 4-bit table of every pattern, negation by invert and add 1, worked addition and subtraction, the overflow rule, sign extension and the ranges of 8, 16 and 32 bits.",
		url: `${SITE}/twos-complement`,
		image: `${SITE}/og/twos-complement.png`,
		imageAlt: "LogicGates.org: two's complement"
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['WebPage', 'FAQPage'],
				'@id': `${page.url}#webpage`,
				url: page.url,
				name: page.title,
				description: page.description,
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${page.url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'HowTo',
				'@id': `${page.url}#howto`,
				name: "Convert a negative number to two's complement",
				description: 'Write the magnitude in binary, invert every bit, add 1.',
				step: [
					{
						'@type': 'HowToStep',
						position: 1,
						name: 'Write the magnitude in binary at the full width',
						url: `${page.url}#negate`
					},
					{ '@type': 'HowToStep', position: 2, name: 'Invert every bit', url: `${page.url}#negate` },
					{ '@type': 'HowToStep', position: 3, name: 'Add 1', url: `${page.url}#negate` }
				]
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Learn digital logic', item: `${SITE}/learn` },
					{ '@type': 'ListItem', position: 3, name: "Two's complement" }
				]
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>{page.title}</title>
	<meta name="description" content={page.description} />
	<link rel="canonical" href={page.url} />
	<meta name="author" content="Sem" />
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="LogicGates.org" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={page.title} />
	<meta property="og:description" content={page.description} />
	<meta property="og:url" content={page.url} />
	<meta property="og:image" content={page.image} />
	<meta property="og:image:alt" content={page.imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={page.title} />
	<meta name="twitter:description" content={page.description} />
	<meta name="twitter:image" content={page.image} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/ripple-carry-adder', label: 'The ripple carry adder' },
		{ href: '/common-circuits/full-subtractor', label: 'The full subtractor' },
		{ href: '/gray-code-converter', label: 'Gray code' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/learn">Learn</a> <span aria-hidden="true">/</span>
			<span>Two's complement</span>
		</nav>
		<h1>Two's complement</h1>
		<p class="lede">
			How a computer writes a negative number using nothing but bits, and why that particular way lets one adder do
			subtraction for free. Every table here is generated and checked, so the arithmetic is right by construction.
		</p>
	</section>

	<section id="what-it-is">
		<h2>What it is</h2>
		<p>
			A register holds a fixed number of bits and nothing else: no minus sign. To represent negative numbers, some
			patterns have to be read as negative. Two's complement does it with one rule: <strong
				>the top bit is worth −2<sup>n−1</sup> instead of +2<sup>n−1</sup></strong
			>. Every other bit keeps its usual weight. In four bits the weights are −8, 4, 2, 1, so
			<span class="mono">1011</span>
			is −8 + 2 + 1 = −5, and <span class="mono">0101</span> is plain 5.
		</p>
		<p>
			The patterns with a 0 on top are the non-negative numbers, exactly as in unsigned binary. The patterns with a 1 on
			top are the negatives, counting up from the most negative. The whole table for four bits, with the two other
			signed codes it beat, is below.
		</p>
	</section>

	<section id="table">
		<h2>Every 4-bit pattern, four ways</h2>
		<div class="table-wrap">
			<table class="data-table codes">
				<thead>
					<tr>
						<th scope="col" class="mono">Bits</th>
						<th scope="col">Unsigned</th>
						<th scope="col">Sign-magnitude</th>
						<th scope="col">One's complement</th>
						<th scope="col" class="twos">Two's complement</th>
					</tr>
				</thead>
				<tbody>
					{#each codes as code}
						<tr class:negative={code.twosComplement < 0}>
							<td class="mono pattern">
								{#each code.bits as bit, i}<span class={bit ? 'bit-1' : 'bit-0'} class:sign={i === 0}>{bit}</span
									>{/each}
							</td>
							<td>{code.unsigned}</td>
							<td class:zero={code.signMagnitude === 0 && code.unsigned !== 0}>{signedText(code.signMagnitude)}</td>
							<td class:zero={code.onesComplement === 0 && code.unsigned !== 0}>{signedText(code.onesComplement)}</td>
							<td class="twos">{signedText(code.twosComplement)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			<strong>Sign-magnitude</strong> uses the top bit as a plain sign and the rest as the size, the way we write
			numbers on paper. <strong>One's complement</strong> makes a negative by inverting every bit of the positive. Both
			have a second zero, marked above, and both need separate logic to add numbers of different sign.
			<strong>Two's complement</strong> is one's complement with 1 added to every negative, which removes the duplicate zero,
			reaches one further negative, and, the real reason it won, adds with an ordinary adder.
		</p>
	</section>

	<section id="negate">
		<h2>How to negate: invert and add 1</h2>
		<p>
			To find the pattern for a negative number, write its magnitude in binary at the full width, flip every bit, and
			add 1. The same two steps go the other way too: inverting and adding 1 negates any number, so a negative pattern
			put through them comes out as its positive magnitude. Type any number in range, positive or negative, and the
			steps follow it.
		</p>
		<form class="controls" on:submit|preventDefault>
			<label>
				Number
				<input type="number" min={-bound} max={bound - 1} bind:value />
			</label>
			<label>
				Width
				<select bind:value={width}>
					{#each [4, 8, 16] as w}
						<option value={w}>{w} bits</option>
					{/each}
				</select>
			</label>
		</form>
		<div class="steps mono">
			<div class="step">
				<span class="label">{signedText(step.value)} in binary</span>
				<span class="bits"
					>{#each step.original as bit, i}<span class={bit ? 'bit-1' : 'bit-0'} class:copied={i >= step.shortcutIndex}
							>{bit}</span
						>{#if (width - 1 - i) % 4 === 0 && i < width - 1}<span class="gap" />{/if}{/each}</span
				>
			</div>
			<div class="step">
				<span class="label">invert every bit</span>
				<span class="bits"
					>{#each step.inverted as bit, i}<span class={bit ? 'bit-1' : 'bit-0'}>{bit}</span
						>{#if (width - 1 - i) % 4 === 0 && i < width - 1}<span class="gap" />{/if}{/each}</span
				>
			</div>
			<div class="step result-step">
				<span class="label">add 1</span>
				<span class="bits"
					>{#each step.result as bit, i}<span class={bit ? 'bit-1' : 'bit-0'} class:copied={i >= step.shortcutIndex}
							>{bit}</span
						>{#if (width - 1 - i) % 4 === 0 && i < width - 1}<span class="gap" />{/if}{/each}</span
				>
				<span class="reads">
					reads as {signedText(step.reading)}
					{#if !step.fits}
						: {signedText(step.value)} is the one number whose negation does not fit
					{/if}
				</span>
			</div>
		</div>
		<p>
			<strong>The shortcut.</strong> Starting from the right, copy the bits up to and including the first 1, then invert
			everything to its left. The highlighted bits above are the copied ones; they come out the same because inverting
			turns the trailing <span class="mono">10…0</span> into <span class="mono">01…1</span>, and adding 1 turns it
			straight back.
		</p>
		<p class="reducer">
			The <a href={toolLink('/binary-converter', { value: String(step.value), bits: width, base: 'decimal' })}
				>binary converter</a
			>
			shows the same number in every base at widths from 4 to 32 bits.
		</p>
	</section>

	<section id="why">
		<h2>Why it works: arithmetic modulo 2<sup>n</sup></h2>
		<p>
			An n-bit adder throws away any carry out of the top bit, so it is really adding modulo 2<sup>n</sup>. In that
			arithmetic, adding 2<sup>n</sup> − x is the same as subtracting x, because the 2<sup>n</sup> falls off the end.
			The two's complement of x is exactly 2<sup>n</sup> − x: inverting every bit gives (2<sup>n</sup> − 1) − x, and adding
			1 completes it. So the pattern for −x is the number that, added to x, wraps round to zero, which is what a negative
			number ought to be. Nothing about the adder has to know the sign; the reader decides.
		</p>
	</section>

	<section id="add">
		<h2>Adding and subtracting</h2>
		<p>
			Add the patterns as if they were unsigned, discard the carry out of the top bit, and read the result as two's
			complement. Subtraction is addition of the negated number: invert the second operand and put a 1 on the carry in,
			which is the "add 1" of the negation for free. Each column below is a full adder doing exactly that.
		</p>
		<div class="worked">
			{#each worked as { label, sum }}
				<figure class="addition">
					<figcaption>
						{label} = {signedText(sum.expected)}
						{#if sum.kind === 'subtract'}
							<span class="how">invert {signedText(sum.bSigned)} and add with a carry in of 1</span>
						{/if}
					</figcaption>
					<table class="data-table sum-table">
						<tbody>
							<tr class="carries">
								<th scope="row">carry</th>
								{#each [...sum.carries].reverse() as carry, i}
									<td class:discard={i === 0} class={carry ? 'bit-1' : 'bit-0'}>{carry}</td>
								{/each}
							</tr>
							<tr>
								<th scope="row">{signedText(sum.aSigned)}</th>
								<td />
								{#each sum.aBits as bit}
									<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
								{/each}
							</tr>
							{#if sum.kind === 'subtract' && sum.inverted}
								<tr class="faded">
									<th scope="row">{signedText(sum.bSigned)}</th>
									<td />
									{#each sum.bBits as bit}
										<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
									{/each}
								</tr>
								<tr>
									<th scope="row">inverted</th>
									<td class="op">+</td>
									{#each sum.inverted as bit}
										<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
									{/each}
								</tr>
							{:else}
								<tr>
									<th scope="row">{signedText(sum.bSigned)}</th>
									<td class="op">+</td>
									{#each sum.bBits as bit}
										<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
									{/each}
								</tr>
							{/if}
							<tr class="result-row">
								<th scope="row">{signedText(sum.resultSigned)}</th>
								<td class="discard {sum.carryOut ? 'bit-1' : 'bit-0'}" title="carry out, discarded">{sum.carryOut}</td>
								{#each sum.sumBits as bit}
									<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
								{/each}
							</tr>
						</tbody>
					</table>
				</figure>
			{/each}
		</div>
		<p class="legend">
			The dimmed bit on the far left of each result is the carry out of the top column, which is discarded. In the
			subtraction the crossed-out row is the number being subtracted, and the row beneath it is what actually enters the
			adder: the carry in of 1 on the right supplies the +1 of the negation.
		</p>
		<p class="reducer">
			This is precisely what a <a href="/ripple-carry-adder#subtract">ripple carry adder</a> with an inverting row in
			front of it does, and why a processor needs no separate subtractor. The
			<a href="/common-circuits/full-subtractor">full subtractor</a> is the alternative: a borrow chain instead of a carry
			chain.
		</p>
	</section>

	<section id="overflow">
		<h2>Overflow</h2>
		<p>
			Four bits hold −8 to 7. Add two numbers whose true sum lies outside that and the adder still produces a pattern,
			it is just the wrong one: the sum wraps round. The tell is the sign. Two positives can never legitimately add to a
			negative, nor two negatives to a positive, so a result with the wrong sign means overflow. Adding numbers of mixed
			sign can never overflow, because the sum lies between them. In hardware the equivalent test is that the carry into
			the top bit differs from the carry out of it.
		</p>
		<div class="table-wrap">
			<table class="data-table overflow">
				<thead>
					<tr>
						<th scope="col">Sum</th>
						<th scope="col">Bits</th>
						<th scope="col">Reads as</th>
						<th scope="col">Carry in to top</th>
						<th scope="col">Carry out</th>
						<th scope="col">Overflow?</th>
					</tr>
				</thead>
				<tbody>
					{#each overflow as sum}
						<tr class:flagged={sum.overflow}>
							<th scope="row">{signedTerm(sum.aSigned)} + {signedTerm(sum.bSigned)} = {signedText(sum.expected)}</th>
							<td class="mono">{sum.sumBits.join('')}</td>
							<td>{signedText(sum.resultSigned)}</td>
							<td class={sum.carries[WIDTH - 1] ? 'bit-1' : 'bit-0'}>{sum.carries[WIDTH - 1]}</td>
							<td class={sum.carryOut ? 'bit-1' : 'bit-0'}>{sum.carryOut}</td>
							<td class="flag">{sum.overflow ? 'yes: wrong sign' : 'no'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			The carry out by itself says nothing about signed overflow: the last two rows have a carry out and are fine, the
			first has none and is wrong, and the second has one and is wrong too. It is the unsigned overflow flag, and
			processors keep both: a carry flag for unsigned arithmetic and an overflow flag for signed, set from the same
			adder on every addition.
		</p>
	</section>

	<section id="range">
		<h2>Ranges</h2>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Width</th>
						<th scope="col">Unsigned</th>
						<th scope="col">Two's complement</th>
					</tr>
				</thead>
				<tbody>
					{#each widths as row}
						<tr>
							<th scope="row" class="mono">{row.width} bits</th>
							<td>0 to {row.unsignedMax.toLocaleString('en')}</td>
							<td>−{(-row.signedMin).toLocaleString('en')} to {row.signedMax.toLocaleString('en')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			There is one more negative than positive number at every width, because zero uses up one of the patterns with a 0
			on top. The most negative number, −2<sup>n−1</sup>, is the one value whose negation does not fit: invert and add 1
			and you get the same pattern back, with the overflow flag set.
		</p>
	</section>

	<section id="extend">
		<h2>Sign extension</h2>
		<p>
			To widen a two's complement number, copy its top bit into every new position. The value does not change: for a
			positive number the new bits are zeros, and for a negative one the new top bit, the copies, and the old top bit,
			now positive, add up to exactly the weight the old top bit had: −128 + 64 + 32 + 16 + 8 = −8.
		</p>
		<div class="extend mono">
			<div>
				<span class="label">{signedText(extended.value)} in 4 bits</span>
				<span class="bits"
					>{#each extended.before as bit}<span class={bit ? 'bit-1' : 'bit-0'}>{bit}</span>{/each}</span
				>
			</div>
			<div>
				<span class="label">in 8 bits</span>
				<span class="bits"
					>{#each extended.after as bit, i}<span class={bit ? 'bit-1' : 'bit-0'} class:copied={i < 4}>{bit}</span
						>{#if i === 3}<span class="gap" />{/if}{/each}</span
				>
			</div>
			<div>
				<span class="label">{signedText(extendedPositive.value)} in 8 bits</span>
				<span class="bits"
					>{#each extendedPositive.after as bit, i}<span class={bit ? 'bit-1' : 'bit-0'} class:copied={i < 4}
							>{bit}</span
						>{#if i === 3}<span class="gap" />{/if}{/each}</span
				>
			</div>
		</div>
		<p>
			Padding with zeros instead, as for an unsigned number, would turn −5 into 11. Most processors have separate load
			instructions for the two cases for exactly this reason.
		</p>
	</section>

	<section id="build">
		<h2>See it in a circuit</h2>
		<p>
			The <a href="/simulator#example:Calculator">calculator example</a> in the simulator is a 4-bit adder; feed it a
			number and the two's complement of another, and it subtracts, although its display reads the answer as unsigned,
			so 3 − 5, entered as 0011 + 1011, lights up the digit for 14 rather than −2. The
			<a href="/ripple-carry-adder">ripple carry adder page</a> traces the carries column by column, and the
			<a href="/binary-converter">binary converter</a> shows any value in two's complement at 4 to 32 bits.
		</p>
		<p>
			<a class="cta" href="/simulator#example:Calculator">Open the calculator circuit</a>
		</p>
	</section>

	<section class="faq">
		<h2>Questions about two's complement</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 48px;
	}

	.crumbs {
		font-size: 0.8rem;
		color: #888;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #888;
	}

	.codes td {
		text-align: center;
	}

	.codes .pattern {
		letter-spacing: 0.15em;
	}

	.codes .pattern span {
		padding: 0;
	}

	.codes .pattern .bit-1 {
		color: #8ede8e;
	}

	.codes .pattern .bit-0 {
		color: #f77;
	}

	.codes .sign {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.codes .twos {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
		color: #8ede8e;
	}

	.codes .zero {
		color: #e9c46a;
	}

	.codes .zero::after {
		content: ' (again)';
		font-size: 0.75rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		margin: 1rem 0;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: #bbb;
		font-size: 0.85rem;
	}

	.controls input {
		width: 7rem;
	}

	.steps,
	.extend {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 1rem 0;
		padding: 0.8rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.03);
	}

	.step,
	.extend div {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem 1rem;
	}

	.steps .label,
	.extend .label {
		color: #bbb;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
		min-width: 9rem;
	}

	.bits {
		font-size: 1.15rem;
		letter-spacing: 0.12em;
		white-space: nowrap;
	}

	.bits .bit-1 {
		color: #8ede8e;
	}

	.bits .bit-0 {
		color: #f77;
	}

	/* An underline rather than a tint: a tint behind a red 0 drops it below the
	   contrast the site sweep requires. */
	.bits .copied {
		border-bottom: 2px solid #5db65d;
	}

	.gap {
		display: inline-block;
		width: 0.5em;
	}

	.result-step .reads {
		color: #ddd;
		font-family: system-ui, sans-serif;
		font-size: 0.9rem;
	}

	.worked {
		display: flex;
		flex-wrap: wrap;
		gap: 20px 32px;
		margin: 1rem 0;
	}

	.addition {
		margin: 0;
	}

	.addition figcaption {
		color: #ddd;
		font-size: 0.95rem;
		margin-bottom: 0.4rem;
	}

	.addition .how {
		display: block;
		color: #888;
		font-size: 0.8rem;
	}

	.sum-table th[scope='row'] {
		text-align: right;
		color: #bbb;
		font-weight: 400;
		padding-right: 0.8rem;
		white-space: nowrap;
	}

	.sum-table td {
		text-align: center;
		min-width: 1.6em;
	}

	.sum-table .carries td {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	.sum-table .carries th {
		font-size: 0.75rem;
	}

	.sum-table .op {
		color: #888;
	}

	.sum-table .discard {
		opacity: 0.35;
	}

	.sum-table .faded td,
	.sum-table .faded th {
		text-decoration: line-through;
		opacity: 0.5;
	}

	.sum-table .result-row td,
	.sum-table .result-row th {
		border-top: 1px solid rgba(255, 255, 255, 0.35);
	}

	.legend {
		color: #999;
		font-size: 0.85rem;
	}

	.overflow th[scope='row'] {
		text-align: left;
		color: #ddd;
		white-space: nowrap;
	}

	.overflow td {
		text-align: center;
	}

	.overflow .flag {
		color: #bbb;
		white-space: nowrap;
	}

	.overflow tr.flagged .flag {
		color: #f77;
	}
</style>
