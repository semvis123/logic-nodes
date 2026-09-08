<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { toGray, fromGray, toBinaryString, grayCode } from '$lib/boolean';

	import { readUrl, syncUrl, safeText, safeInt, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { value: '5', bits: '4', mode: 'binary' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.value, 40) ?? input;
		bits = safeInt(p.bits, 2, 8) ?? bits;
		mode = safeOption(p.mode, ['binary', 'gray'] as const) ?? mode;
	});
	$: syncUrl({ value: input, bits, mode }, DEFAULTS);

	let bits = 4;
	let input = '5';
	let mode: 'binary' | 'gray' = 'binary';

	$: max = (1 << bits) - 1;

	// Accepts a decimal number or a binary string, whichever the reader typed.
	function parseValue(text: string): number | null {
		const trimmed = text.trim();
		if (!trimmed) return null;
		const value = /^[01]+$/.test(trimmed) && trimmed.length > 1 ? parseInt(trimmed, 2) : Number(trimmed);
		if (!Number.isInteger(value) || value < 0) return null;
		return value;
	}

	let error = '';
	let decimal = 0;
	let binary = 0;
	let gray = 0;
	$: {
		const value = parseValue(input);
		if (value === null) {
			error = 'Enter a whole number, in decimal or binary';
		} else if (value > max) {
			error = `${value} needs more than ${bits} bits`;
		} else {
			error = '';
			if (mode === 'binary') {
				binary = value;
				gray = toGray(value);
			} else {
				gray = value;
				binary = fromGray(value);
			}
			decimal = binary;
		}
	}

	// The full sequence, which is the part people usually come here to copy.
	$: sequence = grayCode(bits).map((g, i) => ({
		index: i,
		binary: toBinaryString(i, bits),
		gray: toBinaryString(g, bits),
		grayDecimal: g
	}));

	// Which bit changed from the previous row, to show the one-bit property.
	const changedBit = (i: number) => {
		if (i === 0) return -1;
		const diff = grayCode(bits)[i] ^ grayCode(bits)[i - 1];
		return bits - 1 - Math.log2(diff);
	};

	const faqs = [
		{
			q: 'What is Gray code?',
			a: 'A way of ordering binary numbers so that consecutive values differ in exactly one bit. Counting 0, 1, 2, 3 in ordinary binary goes 00, 01, 10, 11, where the step from 01 to 10 changes both bits at once. In Gray code the same four values are 00, 01, 11, 10, and every step changes one bit only.'
		},
		{
			q: 'How do you convert binary to Gray code?',
			a: 'Exclusive-or the number with itself shifted right by one place: gray = n XOR (n >> 1). The top bit is copied unchanged, and each lower Gray bit is the XOR of the binary bit in that position with the one above it.'
		},
		{
			q: 'How do you convert Gray code back to binary?',
			a: 'Work down from the top. The most significant bit is copied unchanged, and each following binary bit is the XOR of the Gray bit in that position with the binary bit you just produced. Repeatedly XOR-shifting does the same thing in a few operations.'
		},
		{
			q: 'What is Gray code used for?',
			a: 'Anywhere a value is read while it might be changing. Rotary encoders and position sensors use it so a reading taken mid-transition is off by at most one step rather than wildly wrong. Karnaugh maps use it along their edges so that neighbouring squares differ in one variable, which is what makes grouping work.'
		}
	];

	const page = {
		title: 'Gray Code Converter: Binary to Gray and Back',
		description:
			'Convert between binary and Gray code, with the full sequence for any width up to 8 bits and the one-bit-change rule shown row by row.',
		url: `${SITE}/gray-code-converter`,
		image: `${SITE}/og/gray-code-converter.png`,
		imageAlt: 'Logic Nodes: gray code converter'
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
					{ '@type': 'ListItem', position: 3, name: 'Gray code converter' }
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
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Gray code converter</h1>
		<p class="lede">
			Convert either way between binary and Gray code, and read off the full sequence for any width. Consecutive Gray
			values always differ in exactly one bit. Its formal name, <strong>reflected binary code</strong>, describes how
			the sequence is built: write the list out, mirror it, and prefix a 0 to the original half and a 1 to the
			reflection.
		</p>

		<div class="card tool">
			<div class="fields">
				<div class="field-group">
					<label class="field" for="value">Value</label>
					<input
						id="value"
						class="value-input"
						type="text"
						bind:value={input}
						spellcheck="false"
						autocomplete="off"
						aria-describedby="value-help"
					/>
				</div>
				<div class="field-group">
					<label class="field" for="mode">Input is</label>
					<select id="mode" bind:value={mode}>
						<option value="binary">Binary or decimal</option>
						<option value="gray">Gray code</option>
					</select>
				</div>
				<div class="field-group">
					<label class="field" for="bits">Bits</label>
					<select id="bits" bind:value={bits}>
						{#each [2, 3, 4, 5, 6, 7, 8] as n}
							<option value={n}>{n}</option>
						{/each}
					</select>
				</div>
			</div>
			<p class="share-row"><ShareLink what="the value" /></p>
			<p class="field-help" id="value-help">
				Type a decimal number like <span class="mono">13</span>, or a binary string like
				<span class="mono">1101</span>.
			</p>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else}
				<div class="result" role="status">
					<div class="result-row">
						<span class="result-label">Decimal</span>
						<span class="mono big">{decimal}</span>
					</div>
					<div class="result-row">
						<span class="result-label">Binary</span>
						<span class="mono big bits-out">
							{#each toBinaryString(binary, bits).split('') as bit}
								<span class={bit === '1' ? 'one' : 'zero'}>{bit}</span>
							{/each}
						</span>
					</div>
					<div class="result-row">
						<span class="result-label">Gray code</span>
						<span class="mono big bits-out out">
							{#each toBinaryString(gray, bits).split('') as bit}
								<span class={bit === '1' ? 'one' : 'zero'}>{bit}</span>
							{/each}
						</span>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2>The {bits} bit sequence</h2>
		<p class="section-intro">
			Counting up in Gray code. The highlighted bit is the one that changed from the row above: there is never more than
			one.
		</p>
		<div class="table-wrap">
			<table class="data-table sequence">
				<thead>
					<tr>
						<th scope="col" class="mono">n</th>
						<th scope="col">Binary</th>
						<th scope="col">Gray</th>
						<th scope="col" class="mono">Gray as decimal</th>
					</tr>
				</thead>
				<tbody>
					{#each sequence as row}
						{@const changed = changedBit(row.index)}
						<tr>
							<td class="index">{row.index}</td>
							<td class="mono">{row.binary}</td>
							<td class="mono">
								{#each row.gray.split('') as bit, i}
									<span class:changed={i === changed}>{bit}</span>
								{/each}
							</td>
							<td class="index">{row.grayDecimal}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>How the conversion works</h2>
		<p class="section-intro">
			Both directions are only <a href="/logic-gates/xor">XOR gates</a>, which is why the hardware is trivial. Binary to
			Gray is a single layer of <em>n</em> − 1 XORs, one for every bit below the top, all working at once. Gray to
			binary reads as a chain, because each bit needs the one above it, but the chain is a running XOR and those fold
			into a tree: <em>n</em> bits need only log<sub>2</sub> <em>n</em> layers, which is the same trick the shift-and-XOR
			version below uses.
		</p>
		<div class="two-up">
			<div class="card way">
				<h3>Binary to Gray</h3>
				<p class="mono formula">gray = n ⊻ (n &gt;&gt; 1)</p>
				<p>
					Copy the most significant bit unchanged, then make each following Gray bit the XOR of the binary bit in that
					position with the binary bit above it.
				</p>
			</div>
			<div class="card way">
				<h3>Gray to binary</h3>
				<p class="mono formula">bᵢ = gᵢ ⊻ bᵢ₊₁</p>
				<p>
					Again the top bit is copied straight across. Each following binary bit is the XOR of the Gray bit there with
					the binary bit you have just worked out, so it has to run top down.
				</p>
			</div>
		</div>
		<p class="reducer">
			Build it yourself: an <a href="/logic-gates/xor">XOR</a> per bit below the top converts binary to Gray in one
			layer of gates.
			<a href="/simulator">Open the simulator</a> and wire four toggles through three XORs to see it work.
		</p>
	</section>

	<section>
		<h2>Why it exists</h2>
		<p>
			The point of Gray code is that only one bit moves at a time. If you read an ordinary binary counter at the exact
			moment it steps from 0111 to 1000, the bits do not all flip at once in the real world, and you can sample a value
			that was never intended — anything from 0000 to 1111. With Gray code the worst case is that you catch the old
			value or the new one, because only one bit is in motion.
		</p>
		<p>
			That is why rotary encoders, linear position sensors and anything crossing between two clock domains tends to use
			it. And it is why the edges of a
			<a href="/karnaugh-map-solver">Karnaugh map</a> are labelled 00, 01, 11, 10 rather than in counting order: neighbouring
			squares then differ in exactly one variable, which is the whole reason grouping them cancels that variable out.
		</p>
	</section>

	<section class="faq">
		<h2>Questions</h2>
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
		padding-top: 64px;
	}

	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
	}

	.fields {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: flex-end;
	}

	.field-group {
		flex: 1;
		min-width: 8rem;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.value-input,
	.fields select {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.6rem;
	}

	.value-input:focus,
	.fields select:focus {
		outline: none;
		border-color: #5db65d;
	}

	.share-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0.8rem 0 0;
	}

	.field-help {
		color: #888;
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.8rem 0 0;
	}

	.result {
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		margin-top: 1rem;
		padding-top: 0.9rem;
	}

	.result-row {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		margin-bottom: 0.5rem;
	}

	.result-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 6rem;
	}

	.big {
		font-size: 1.3rem;
	}

	.bits-out span {
		padding: 0 1px;
	}

	.bits-out .one {
		color: #5db65d;
	}

	.bits-out .zero {
		color: #f66;
	}

	.out {
		font-weight: 600;
	}

	.sequence {
		width: 100%;
	}

	.sequence th,
	.sequence td {
		text-align: center;
	}

	.sequence .index {
		color: #888;
	}

	.changed {
		background-color: rgba(93, 182, 93, 0.28);
		border-radius: 2px;
		color: #fff;
	}

	.two-up {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
	}

	.way {
		padding: 0.9rem 1rem 1rem;
	}

	.way h3 {
		color: #fff;
	}

	.formula {
		color: #8ede8e;
		font-size: 1rem;
		margin: 0 0 0.6rem;
	}

	.way p {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0;
	}
</style>
