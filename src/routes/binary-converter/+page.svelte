<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		bases,
		widths,
		parseNumber,
		toBits,
		fromBits,
		signedValue,
		rangeOf,
		fits,
		render as renderBase,
		groupBits,
		toBcd,
		invalidBcdPatterns,
		negationSteps,
		NumberError,
		type Base
	} from '$lib/numbers';
	import { toGray } from '$lib/boolean';
	import { readUrl, syncUrl, safeText, safeInt, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const DEFAULTS = { value: '202', base: 'decimal', bits: '8' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.value, 40) ?? input;
		base = safeOption(p.base, ['decimal', 'binary', 'hex', 'octal'] as const) ?? base;
		width = safeInt(p.bits, 4, 32) ?? width;
	});
	$: syncUrl({ value: input, base, bits: width }, DEFAULTS);

	let input = '202';
	let base: Base = 'decimal';
	let width = 8;

	let value = 0;
	// A value that will not parse means there is nothing to show. A value that
	// parses but does not fit still has an answer: it wraps, which is the whole
	// lesson of the page, so that one is a note rather than an error.
	let error = '';
	let warning = '';
	$: {
		try {
			value = parseNumber(input, base);
			error = '';
			warning = fits(value, width)
				? ''
				: `${value} needs more than ${width} bits, so the register keeps only the low ${width}.`;
		} catch (e) {
			error = e instanceof NumberError ? e.message : 'That is not a number';
			warning = '';
		}
	}

	/** Something to start from, in the spirit of the other tools' examples. */
	const presets: { label: string; value: string; base: Base; width: number }[] = [
		{ label: 'A byte', value: '202', base: 'decimal', width: 8 },
		{ label: 'All ones', value: '255', base: 'decimal', width: 8 },
		{ label: 'Negative', value: '-54', base: 'decimal', width: 8 },
		{ label: 'Minus one', value: '-1', base: 'decimal', width: 16 },
		{ label: 'From hex', value: 'CAFE', base: 'hex', width: 16 },
		{ label: 'Sign bit only', value: '10000000', base: 'binary', width: 8 }
	];

	function load(preset: typeof presets[number]) {
		base = preset.base;
		width = preset.width;
		input = preset.value;
	}

	/** Bits in nibbles, so the register reads the way binary is written. */
	$: nibbles = Array.from({ length: Math.ceil(bits.length / 4) }, (_, i) => ({
		bits: bits.slice(i * 4, i * 4 + 4),
		offset: i * 4
	}));

	$: otherBases = bases.filter((b) => b.id !== 'binary');

	$: bits = toBits(value, width);
	$: range = rangeOf(width);
	$: unsigned = fromBits(bits);
	$: signed = signedValue(bits);
	$: bcd = value >= 0 ? toBcd(unsigned) : [];
	// Driven by the signed reading, not by what was typed: 202 in eight bits IS
	// -54, and the steps have to start from 54, not from 202.
	$: steps = signed < 0 ? negationSteps(signed, width) : null;

	/** Clicking a bit flips it, which is the point of showing them as a register. */
	function flip(index: number) {
		const next = [...bits];
		next[index] = next[index] ? 0 : 1;
		base = 'binary';
		input = next.join('');
	}

	const faqs = [
		{
			q: 'How do I convert decimal to binary?',
			a: 'Repeatedly halve the number and write down the remainders, then read them backwards. Or work down from the largest power of two that fits: for 202 in eight bits that is 128, leaving 74, then 64 leaving 10, then 8 and 2, which gives 11001010. The converter above does it either way round and shows the bits you can click.'
		},
		{
			q: "What is two's complement, and why invert and add one?",
			a: "It is how a fixed-width register holds a negative number: invert every bit and add one. The reason is that it makes subtraction free. Adding a number to its two's complement wraps the register to zero, so the same adder circuit that computes a + b also computes a - b if you feed it the complement of b. No separate subtractor is needed, which is why almost every processor uses it."
		},
		{
			q: 'Why does the same bit pattern show two different values?',
			a: "Because a bit pattern has no sign of its own. 11001010 is 202 read as unsigned and -54 read as two's complement, and nothing in the register says which is meant. The width and the interpretation are decisions made by the circuit reading it, which is exactly why a language makes you declare whether an integer is signed."
		},
		{
			q: 'What is BCD and why would anyone waste bits like that?',
			a: 'Binary coded decimal gives each decimal digit its own four bits, so 42 is 0100 0010 rather than 101010. It wastes six of the sixteen patterns per digit, but each digit can drive its own seven segment decoder directly, with no division by ten anywhere. That is why clocks, meters and calculator displays use it.'
		},
		{
			q: 'Why is hex used instead of binary?',
			a: 'Because one hex digit is exactly four bits, so the two line up perfectly and converting is a lookup rather than arithmetic. A byte is always two hex digits. Octal does the same job for three bits, which is why it survives in Unix file permissions, where the bits come in threes.'
		}
	];

	const page = {
		title: 'Binary Converter: Decimal, Hex and Two’s Complement',
		description:
			'Convert between decimal, binary, hex and octal at a fixed bit width, with two’s complement, BCD and Gray code, and a register you can click bit by bit.',
		url: `${SITE}/binary-converter`,
		image: `${SITE}/og/binary-converter.png`,
		imageAlt: 'Logic Nodes: binary converter'
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
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Binary converter' }
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
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Logic Nodes" />
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
		{ href: '/gray-code-converter', label: 'Gray code converter' },
		{ href: '/common-circuits', label: 'Adders and other circuits' },
		{ href: '/counters', label: 'Counters' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Binary converter</h1>
		<p class="lede">
			Decimal, binary, hex and octal at a fixed width, with the two's complement and BCD forms alongside. The width is
			the point: a number only means something once you say how many bits are holding it.
		</p>

		<div class="card tool">
			<label class="input-label" for="value">Value</label>
			<div class="input-row">
				<input id="value" type="text" bind:value={input} spellcheck="false" autocomplete="off" />
				<select class="base-select" bind:value={base} aria-label="Read the value as">
					{#each bases as option}
						<option value={option.id}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="presets">
				{#each presets as preset}
					<button type="button" class="preset" on:click={() => load(preset)}>{preset.label}</button>
				{/each}
			</div>

			<div class="row second">
				<label class="field inline">
					Width
					<select bind:value={width}>
						{#each widths as option}
							<option value={option}>{option} bits</option>
						{/each}
					</select>
				</label>
				<ShareLink what="this conversion" />
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else}
				<div class="register-wrap">
					<div class="register" role="group" aria-label="Bit pattern, most significant bit first">
						{#each nibbles as nibble}
							<div class="nibble">
								{#each nibble.bits as bit, j}
									{@const index = bits.length - 1 - (nibble.offset + j)}
									<button
										type="button"
										class="bit"
										class:on={bit === 1}
										aria-label={`Bit ${index}, currently ${bit}. Click to flip.`}
										on:click={() => flip(nibble.offset + j)}
									>
										<span class="bit-value">{bit}</span>
										<span class="bit-index">{index}</span>
									</button>
								{/each}
							</div>
						{/each}
					</div>
					<p class="hint">
						Click any bit to flip it. Bit {width - 1} is the most significant, and the sign bit when the value is read as
						signed.
					</p>
					<p class="primary">
						<span class="primary-label">Binary</span>
						<span class="mono primary-value">{groupBits(bits)}</span>
					</p>
				</div>

				{#if warning}
					<p class="warning" role="status">{warning}</p>
				{/if}

				<div class="answers" role="status">
					{#each otherBases as option}
						<div class="answer">
							<span class="answer-label">{option.label}</span>
							<span class="mono answer-value">{renderBase(bits, option.id)}</span>
						</div>
					{/each}
					<div class="answer signed" class:negative={signed < 0}>
						<span class="answer-label">Signed</span>
						<span class="mono answer-value">{signed}</span>
						<span class="answer-note">two's complement</span>
					</div>
				</div>

				<div class="extras">
					<div class="extra">
						<span class="extra-label">Gray code</span>
						<span class="mono extra-value">{groupBits(toBits(toGray(unsigned), width))}</span>
						<a class="extra-note" href="/gray-code-converter">one bit changes at a time</a>
					</div>
					{#if bcd.length}
						<div class="extra">
							<span class="extra-label">BCD</span>
							<span class="mono extra-value">{bcd.map((d) => d.bits.join('')).join(' ')}</span>
							<span class="extra-note">one nibble per decimal digit</span>
						</div>
					{/if}
					<p class="range-note">
						{width} bits hold <strong>0 to {range.unsignedMax}</strong> unsigned, or
						<strong>{range.signedMin} to {range.signedMax}</strong> signed.
					</p>
				</div>

				{#if steps}
					<div class="steps-box">
						<p class="steps-title">How {Math.abs(signed)} is stored as {signed}</p>
						<ol class="steps-list">
							<li>
								<span class="step-label">Start with {Math.abs(signed)}</span><span class="mono"
									>{groupBits(steps.original)}</span
								>
							</li>
							<li>
								<span class="step-label">Invert every bit</span><span class="mono">{groupBits(steps.inverted)}</span>
							</li>
							<li><span class="step-label">Add one</span><span class="mono">{groupBits(steps.result)}</span></li>
						</ol>
					</div>
				{/if}
			{/if}
		</div>
	</section>

	<section id="width">
		<h2>Why the width comes first</h2>
		<p>
			On paper a number can be as long as it likes. In a circuit it cannot: it lives in a fixed row of flip-flops, and
			that row has no way to grow. Everything awkward about machine arithmetic follows from that one fact.
		</p>
		<ul class="points">
			<li>
				<strong>It wraps rather than overflows.</strong> An eight bit register holding 255 and asked for one more gives
				0, because the ninth bit has nowhere to go. That is the same wrap a
				<a href="/counters">counter</a> relies on to start again at zero.
			</li>
			<li>
				<strong>The same pattern means two things.</strong> Nothing in the register records whether the top bit is worth
				+128 or −128. The circuit reading it decides, which is why you have to declare whether an integer is signed.
			</li>
			<li>
				<strong>Hex is not another number system.</strong> It is four bits written as one character, which is why a byte
				is always exactly two hex digits and converting is a lookup rather than arithmetic.
			</li>
		</ul>
	</section>

	<section id="twos-complement">
		<h2>Two's complement, and why subtraction is free</h2>
		<p>
			To write a negative number, invert every bit and add one. That looks arbitrary until you notice what it buys: a
			number plus its complement wraps the register to zero. Which means <span class="mono">a − b</span> is just
			<span class="mono">a + (−b)</span>, and the
			<a href="/common-circuits">adder you already built</a> does subtraction with no extra circuit, only a row of inverters
			and a carry in tied high.
		</p>
		<p class="note">
			The one asymmetry is worth knowing: an <em>n</em> bit register reaches −2<sup>n−1</sup> but only +2<sup>n−1</sup
			>−1, because zero takes up one of the positive slots. In eight bits that is −128 to 127, and −(−128) has no
			answer.
		</p>
	</section>

	<section id="bcd">
		<h2>BCD: paying bits for a simpler display</h2>
		<p>
			Binary coded decimal gives every decimal digit its own four bits. It is wasteful — six of the sixteen patterns per
			digit are never used — but it means each digit drives its own
			<a href="/common-circuits">seven segment decoder</a> directly, with nothing having to divide by ten. Clocks and meters
			take that trade every time.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<caption>The six patterns BCD throws away</caption>
				<thead>
					<tr><th scope="col">Pattern</th><th scope="col">Unsigned value</th><th scope="col">As a digit</th></tr>
				</thead>
				<tbody>
					{#each invalidBcdPatterns as pattern}
						<tr>
							<td class="mono">{pattern.join('')}</td>
							<td class="mono">{fromBits(pattern)}</td>
							<td>not a decimal digit</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="faq" id="faq">
		<h2>Questions</h2>
		{#each faqs as item}
			<details>
				<summary>{item.q}</summary>
				<p>{item.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	/* .card draws the box; every page that uses it supplies its own padding.
	   Matching the truth table generator and the K-map solver. */
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}

	/* Input, laid out like the other tools: label above, one wide field. */
	.input-label {
		color: #ddd;
		display: block;
		font-size: 0.9rem;
		margin-bottom: 0.4rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	.input-row input {
		flex: 1;
		min-width: 0;
		font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
		font-size: 1.2rem;
		padding: 0.6rem 0.8rem;
	}

	.base-select {
		font-size: 0.95rem;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}

	.preset {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		white-space: nowrap;
	}

	.preset:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.row.second {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
		margin-top: 0.8rem;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.9rem 0 0;
	}

	.warning {
		color: #e0b050;
		font-size: 0.85rem;
		margin: 0.6rem 0 0;
	}

	/* The register is the point of the page, so it gets the space. */
	.register-wrap {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 1rem;
		padding-top: 1rem;
	}

	.register {
		display: flex;
		flex-wrap: wrap;
		/* A wide gap between nibbles and a narrow one within, so the grouping is
		   visible and a wrap lands on a nibble boundary rather than mid-byte. */
		gap: 0.5rem 0.9rem;
	}

	.nibble {
		display: flex;
		gap: 3px;
	}

	.bit {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		color: #7d7d7d;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 40px;
		padding: 0.45rem 0.2rem 0.25rem;
		transition: background-color 0.1s ease, border-color 0.1s ease;
	}

	.bit:hover {
		border-color: #5db65d;
	}

	.bit.on {
		background: #2f6b2f;
		border-color: #5db65d;
	}

	.bit-value {
		color: #fff;
		font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.1;
	}

	.bit-index {
		font-size: 0.62rem;
		letter-spacing: 0.02em;
	}

	.bit.on .bit-index {
		color: #bfe6bf;
	}

	@media (prefers-reduced-motion: reduce) {
		.bit {
			transition: none;
		}
	}

	.hint {
		color: #999;
		font-size: 0.82rem;
		margin: 0.7rem 0 0;
	}

	/* The headline answer: this is the binary converter, so the binary string
	   gets the weight, the way the K-map solver shows its simplified form. */
	.primary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.3rem 0.9rem;
		margin: 0.9rem 0 0;
	}

	.primary-label {
		color: #888;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		min-width: 5.5rem;
	}

	.primary-value {
		color: #8ede8e;
		font-size: 1.5rem;
		overflow-wrap: anywhere;
	}

	/* The conversions themselves, as a grid rather than a stack of equal rows. */
	.answers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 1rem;
		padding-top: 1rem;
	}

	.answer {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
	}

	.answer-label {
		color: #888;
		display: block;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-value {
		color: #fff;
		display: block;
		font-size: 1.15rem;
		margin-top: 0.15rem;
		overflow-wrap: anywhere;
	}

	.answer.signed {
		border-color: rgba(93, 182, 93, 0.5);
	}

	.answer.signed .answer-value {
		color: #8ede8e;
	}

	.answer.negative .answer-value {
		color: #ffb3b3;
	}

	.answer-note {
		color: #888;
		display: block;
		font-size: 0.72rem;
		margin-top: 0.1rem;
	}

	.extras {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 1rem;
		padding-top: 0.9rem;
	}

	.extra {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.7rem;
		margin-bottom: 0.4rem;
	}

	.extra-label {
		color: #888;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		min-width: 5.5rem;
	}

	.extra-value {
		color: #ddd;
		overflow-wrap: anywhere;
	}

	.extra-note {
		color: #9a9a9a;
		font-size: 0.78rem;
	}

	a.extra-note {
		color: #8ede8e;
	}

	.range-note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.7rem 0 0;
	}

	.range-note strong {
		color: #fff;
		font-weight: 600;
	}

	.steps-box {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 1rem;
		padding-top: 0.9rem;
	}

	.steps-title {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}

	.steps-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.steps-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.3rem 0.9rem;
		padding: 0.2rem 0;
	}

	.step-label {
		color: #8ede8e;
		font-size: 0.8rem;
		min-width: 9rem;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.6rem;
	}

	.points strong {
		color: #fff;
	}

	@media (max-width: 560px) {
		.input-row input {
			font-size: 1.05rem;
		}

		.bit {
			min-width: 34px;
		}

		.extra-label {
			min-width: 100%;
		}
	}
</style>
