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
	let error = '';
	$: {
		try {
			value = parseNumber(input, base);
			error = fits(value, width) ? '' : `${value} does not fit in ${width} bits`;
		} catch (e) {
			error = e instanceof NumberError ? e.message : 'That is not a number';
		}
	}

	$: bits = toBits(value, width);
	$: range = rangeOf(width);
	$: unsigned = fromBits(bits);
	$: signed = signedValue(bits);
	$: bcd = value >= 0 ? toBcd(unsigned) : [];
	$: steps = signed < 0 || value < 0 ? negationSteps(value, width) : null;

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
			<div class="row">
				<label class="field">
					Value
					<input id="value" type="text" bind:value={input} spellcheck="false" autocomplete="off" />
				</label>
				<label class="field">
					Read as
					<select bind:value={base}>
						{#each bases as option}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
				<label class="field">
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
			{/if}

			<div class="register" role="group" aria-label="Bit pattern, most significant bit first">
				{#each bits as bit, i}
					<button
						type="button"
						class="bit"
						class:on={bit === 1}
						aria-label={`Bit ${width - 1 - i}, currently ${bit}`}
						on:click={() => flip(i)}
					>
						<span class="bit-value">{bit}</span>
						<span class="bit-index">{width - 1 - i}</span>
					</button>
				{/each}
			</div>
			<p class="hint">Click a bit to flip it. Bit {width - 1} is the most significant, and the sign bit when signed.</p>

			<div class="result" role="status">
				{#each bases as option}
					<p class="result-line">
						<span class="result-label">{option.label}</span>
						<span class="mono out">{option.id === 'binary' ? groupBits(bits) : renderBase(bits, option.id)}</span>
					</p>
				{/each}
				<p class="result-line">
					<span class="result-label">Signed</span>
					<span class="mono out">{signed}</span>
					<span class="aside">two's complement</span>
				</p>
				<p class="result-line">
					<span class="result-label">Gray code</span>
					<span class="mono out">{groupBits(toBits(toGray(unsigned), width))}</span>
					<span class="aside"><a href="/gray-code-converter">one bit changes at a time</a></span>
				</p>
				{#if bcd.length}
					<p class="result-line">
						<span class="result-label">BCD</span>
						<span class="mono out">{bcd.map((d) => d.bits.join('')).join(' ')}</span>
						<span class="aside">one digit per nibble</span>
					</p>
				{/if}
				<p class="result-note">
					{width} bits hold 0 to {range.unsignedMax} unsigned, or {range.signedMin} to {range.signedMax} signed.
				</p>
			</div>

			{#if steps}
				<div class="steps-box">
					<p class="steps-title">How {Math.abs(signed)} became {signed}</p>
					<p class="step">
						<span class="step-label">Start</span> <span class="mono">{groupBits(steps.original)}</span>
					</p>
					<p class="step">
						<span class="step-label">Invert</span> <span class="mono">{groupBits(steps.inverted)}</span>
					</p>
					<p class="step">
						<span class="step-label">Add one</span> <span class="mono">{groupBits(steps.result)}</span>
					</p>
				</div>
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
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.8rem;
	}

	.register {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 1rem 0 0.4rem;
	}

	.bit {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #888;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 34px;
		padding: 0.35rem 0.2rem 0.2rem;
	}

	.bit.on {
		background: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.bit-value {
		font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
		font-size: 1.05rem;
		font-weight: 600;
		color: #fff;
	}

	.bit-index {
		font-size: 0.6rem;
		letter-spacing: 0.03em;
	}

	.result-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
		margin: 0.25rem 0;
	}

	.result-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 5.5rem;
	}

	.out {
		color: #fff;
		font-size: 1rem;
		overflow-wrap: anywhere;
	}

	.aside {
		color: #888;
		font-size: 0.8rem;
	}

	.aside a {
		color: #8ede8e;
	}

	.result-note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.7rem 0 0;
	}

	.steps-box {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 0.9rem;
		padding-top: 0.8rem;
	}

	.steps-title {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0 0 0.4rem;
	}

	.step {
		display: flex;
		gap: 0.8rem;
		margin: 0.15rem 0;
	}

	.step-label {
		color: #8ede8e;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 4.5rem;
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
</style>
