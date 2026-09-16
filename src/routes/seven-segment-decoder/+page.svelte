<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		segmentFunctions,
		litSegments,
		digitSegments,
		segmentNames,
		inputVariables,
		inputLabels,
		codeBits,
		type SegmentName
	} from '$lib/sevenSegment';
	import { buildCircuit, circuitStates } from '$lib/circuit';
	import { circuitToSvg } from '$lib/exportSvg';

	// The seven expressions are derived from the digit patterns by the Karnaugh
	// map engine, with codes 10 to 15 as don't cares, and the test suite checks
	// that each one lights exactly the right bars for every digit.
	const functions = segmentFunctions();

	// Truth table rows for the ten digits.
	const rows = digitSegments.map((pattern, code) => ({
		code,
		bits: inputVariables.map((_, i) => !!(code & (8 >> i))),
		segments: segmentNames.map((s) => pattern.includes(s))
	}));

	// Live demo: pick a code and watch the derived circuit drive the display.
	let code = 5;
	$: lit = litSegments(functions, code);
	$: bits = codeBits(code);

	// One segment's circuit at a time; all seven at once is too wide to read.
	let chosen: SegmentName = 'a';
	$: chosenFunction = functions.find((f) => f.segment === chosen)!;
	$: circuit = buildCircuit(chosenFunction.ast);
	$: states = circuitStates(circuit, bits);
	$: circuitSvg = circuitToSvg(circuit, { standard: 'ansi', palette: 'colour', states });

	// The segment geometry of the display, in a 64 by 108 box.
	const geometry: Record<SegmentName, string> = {
		a: 'M12,6 h40 l-6,6 h-28 z',
		b: 'M58,10 v40 l-6,-6 v-28 z',
		c: 'M58,58 v40 l-6,-6 v-28 z',
		d: 'M12,102 h40 l-6,-6 h-28 z',
		e: 'M6,58 v40 l6,-6 v-28 z',
		f: 'M6,10 v40 l6,-6 v-28 z',
		g: 'M12,54 h40 l-6,3 l6,3 h-40 l6,-3 z'
	};

	const kmapHref = (cells: (0 | 1 | 'x')[]) =>
		`/karnaugh-map-solver?cells=${cells.map((c) => (c === 'x' ? 'x' : String(c))).join('')}`;

	const faqs = [
		{
			q: 'What is a seven-segment decoder?',
			a: 'A combinational circuit that takes a four-bit binary number, usually a BCD digit from 0 to 9, and produces seven outputs, one per bar of a seven-segment display, so that the bars light in the shape of that digit. It is seven separate boolean functions of the same four inputs, each derived from a truth table with ten rows.'
		},
		{
			q: 'What is the truth table for a BCD to seven-segment decoder?',
			a: "Ten rows, one per digit, with four input columns for the BCD bits and seven output columns for segments a to g. Segment a, for instance, is lit for 0, 2, 3, 5, 6, 7, 8 and 9 and dark for 1 and 4. The six remaining input codes, 10 to 15, never occur with BCD input and are left as don't cares."
		},
		{
			q: "Why are codes 10 to 15 don't cares?",
			a: "Because a BCD input never produces them, so whatever the decoder shows for them is never seen. Marking those rows as don't cares lets the Karnaugh map groups grow across them, which makes every one of the seven expressions shorter. On a real chip those codes display leftover shapes that mean nothing."
		},
		{
			q: 'What is the difference between common anode and common cathode displays?',
			a: 'Which terminal the segments share. In a common cathode display all the segment cathodes are joined to ground and a segment lights when its input is driven high; in a common anode display the anodes share the supply and a segment lights when its input is pulled low. The logic is the same either way, with every output inverted for common anode, which is what the 7447 does compared with the 7448.'
		},
		{
			q: 'How many gates does a seven-segment decoder need?',
			a: `With the don't cares used, the seven minimal expressions on this page have ${functions.reduce(
				(n, f) => n + f.groups,
				0
			)} product terms between them, plus an OR per segment and four inverters for the input complements. Sharing identical terms between segments, which a real design does, brings the count down further.`
		},
		{
			q: 'What chip is a seven-segment decoder?',
			a: 'The classic TTL parts are the 7447, which drives common anode displays with active-low outputs, and the 7448 for common cathode displays, both taking a BCD input. The CMOS 4511 does the same for common cathode displays and adds a latch on the inputs. Modern designs usually do the decoding in a microcontroller or an FPGA instead.'
		}
	];

	const page = {
		title: 'Seven-Segment Decoder: Truth Table, K-Maps and Circuit',
		description:
			"How a BCD to seven-segment decoder works: the truth table, a Karnaugh-map derived expression for each of the seven segments with the don't cares used, a live display, and the circuit.",
		url: `${SITE}/seven-segment-decoder`,
		image: `${SITE}/og/seven-segment-decoder.png`,
		imageAlt: 'LogicGates.org: seven-segment decoder'
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
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Common circuits', item: `${SITE}/common-circuits` },
					{ '@type': 'ListItem', position: 3, name: 'Seven-segment decoder' }
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
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/common-circuits', label: 'Common circuits' },
		{ href: '/binary-converter#bcd', label: 'BCD, on the binary converter' },
		{ href: '/learn#display', label: 'Build one on the learning path' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/common-circuits">Common circuits</a> <span aria-hidden="true">/</span>
			<span>Seven-segment decoder</span>
		</nav>
		<h1>The seven-segment decoder</h1>
		<p class="lede">
			A seven-segment decoder is a combinational circuit that turns a four-bit binary digit into the seven signals that
			light the bars of a display, so that 1001 shows as a 9. It is seven boolean functions of the same four inputs,
			each derived from a ten-row truth table, and the best everyday example of don't cares earning their keep.
		</p>
	</section>

	<section id="demo">
		<h2>Try it</h2>
		<p class="section-intro">
			Pick a code and the display is driven by the seven expressions derived further down, not by a lookup: what you see
			is what the circuit computes, including for the six codes above 9.
		</p>
		<div class="card demo">
			<div class="codes" role="group" aria-label="Input code">
				{#each Array.from({ length: 16 }, (_, i) => i) as value}
					<button
						type="button"
						class:on={code === value}
						class:dc={value > 9}
						aria-pressed={code === value}
						on:click={() => (code = value)}>{value}</button
					>
				{/each}
			</div>
			<div class="demo-body">
				<svg
					viewBox="0 0 64 108"
					class="display"
					role="img"
					aria-label={`Display showing the segments ${[...lit].sort().join(', ') || 'none'} for input ${code}`}
				>
					{#each segmentNames as segment}
						<path d={geometry[segment]} class:lit={lit.has(segment)} />
					{/each}
				</svg>
				<dl class="readout">
					<dt>Input</dt>
					<dd class="mono">
						{#each inputLabels as label, i}
							<span class="bit" class:on={bits[inputVariables[i]]}>{label}={bits[inputVariables[i]] ? 1 : 0}</span>
						{/each}
					</dd>
					<dt>Segments</dt>
					<dd class="mono">
						{#each segmentNames as segment}
							<span class="bit" class:on={lit.has(segment)}>{segment}={lit.has(segment) ? 1 : 0}</span>
						{/each}
					</dd>
					{#if code > 9}
						<dd class="note">
							{code} is not a BCD digit. Its rows were don't cares, so this shape is whatever the minimal circuit happens
							to produce.
						</dd>
					{/if}
				</dl>
			</div>
		</div>
	</section>

	<section id="how-it-works">
		<h2>How it works</h2>
		<p>
			A seven-segment display is seven LEDs arranged as a figure eight, labelled <span class="mono">a</span> to
			<span class="mono">g</span> clockwise from the top with <span class="mono">g</span> in the middle. Light the right
			subset and you get a digit: all but <span class="mono">g</span> for 0, only <span class="mono">b</span>
			and <span class="mono">c</span> for 1, and so on. The decoder's job is to turn the four bits of the digit into those
			seven on-or-off signals.
		</p>
		<p>
			There is no clever trick in it, which is what makes it a good exercise. Each segment is its own boolean function
			of the four input bits, read straight off a truth table with one row per digit. Simplify each of the seven columns
			and you have seven small circuits sharing four inputs. The one refinement is that a BCD digit never exceeds 9, so
			the six input codes 10 to 15 never happen, and their rows can be marked as don't cares. That lets every Karnaugh
			map group grow, and each of the seven expressions comes out shorter than it would otherwise.
		</p>
	</section>

	<section id="truth-table">
		<h2>Truth table</h2>
		<p class="section-intro">
			One row per digit. The inputs are the four bits of the digit, most significant first; the outputs are the
			segments, 1 for lit.
		</p>
		<div class="table-wrap">
			<table class="data-table decoder-table">
				<thead>
					<tr>
						<th scope="col">Digit</th>
						{#each inputLabels as label}
							<th scope="col" class="mono">{label}</th>
						{/each}
						{#each segmentNames as segment, i}
							<th scope="col" class="mono out" class:first-out={i === 0}>{segment}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr class:live={row.code === code}>
							<th scope="row">{row.code}</th>
							{#each row.bits as bit}
								<td class={bit ? 'bit-1' : 'bit-0'}>{bit ? 1 : 0}</td>
							{/each}
							{#each row.segments as on, i}
								<td class="out {on ? 'bit-1' : 'bit-0'}" class:first-out={i === 0}>{on ? 1 : 0}</td>
							{/each}
						</tr>
					{/each}
					<tr class="dc-row">
						<th scope="row">10–15</th>
						<td colspan="4" class="dc-cell">1010 to 1111</td>
						{#each segmentNames as _, i}
							<td class="out bit-x" class:first-out={i === 0}>X</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			These are the textbook shapes: 6 with its top bar and 9 with its bottom bar lit. The 7447 leaves segment
			<span class="mono">a</span> dark on 6 and <span class="mono">d</span> dark on 9, which changes two rows and nothing
			else about the method.
		</p>
	</section>

	<section id="expressions">
		<h2>The seven expressions</h2>
		<p class="section-intro">
			Each segment's column, simplified as a Karnaugh map with the don't cares used. Every one of these was generated by
			the same engine as the <a href="/karnaugh-map-solver">solver</a>, and checked against the table above.
		</p>
		<div class="segments">
			{#each functions as f}
				<div class="card segment" class:lit={lit.has(f.segment)}>
					<h3>
						<span class="mono">{f.segment}</span>
						<span class="count">{f.groups} {f.groups === 1 ? 'term' : 'terms'}</span>
					</h3>
					<p class="mono expr">{f.segment} = {f.text}</p>
					<p class="links">
						<a href={kmapHref(f.cells)}>Open on the Karnaugh map</a>
						<button type="button" class="link" on:click={() => (chosen = f.segment)}>Draw the circuit</button>
					</p>
				</div>
			{/each}
		</div>
		<p class="reducer">
			The inputs are called <span class="mono">w x y z</span> here for the bits 8, 4, 2 and 1. The solver labels them
			<span class="mono">a b c d</span>, which is the usual textbook naming; only the letters differ.
		</p>
	</section>

	<section id="circuit">
		<h2>The circuit for segment {chosen}</h2>
		<p class="section-intro">
			One segment at a time, driven by the code chosen above. Pick another segment from the cards, or toggle the input,
			and the signal colours follow.
		</p>
		<div class="card diagram-card">
			<div class="segment-picker" role="group" aria-label="Segment">
				{#each segmentNames as segment}
					<button
						type="button"
						class:on={chosen === segment}
						aria-pressed={chosen === segment}
						on:click={() => (chosen = segment)}>{segment}</button
					>
				{/each}
			</div>
			<div class="canvas" role="img" aria-label={`Logic circuit for segment ${chosen}: ${chosenFunction.text}`}>
				{@html circuitSvg}
			</div>
		</div>
		<p class="reducer">
			The full decoder is these seven circuits side by side, sharing the four inputs and their inverters. The
			<a href="/simulator#example:7%20Segment-display">simulator's seven-segment example</a> has it wired to a display node
			you can drive from four switches.
		</p>
	</section>

	<section id="real-parts">
		<h2>In real hardware</h2>
		<p>
			The decoder has been a standard part since the 1960s: the TTL 7447 drives common anode displays with active-low
			outputs, the 7448 drives common cathode displays, and the CMOS 4511 adds a latch so the input can change while the
			display holds. All of them take a BCD input and add extras the pure logic does not need, such as a lamp test pin
			that lights every segment and a ripple blanking input that suppresses leading zeros across several digits. In
			anything designed today the decoding is a few lines of code in a microcontroller or a lookup table in an FPGA, but
			the truth table is the same one as above.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about seven-segment decoders</h2>
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

	.demo {
		padding: 0.9rem 1rem 1rem;
	}

	.codes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.9rem;
	}

	.codes button,
	.segment-picker button {
		font: 600 0.9rem ui-monospace, SFMono-Regular, Menlo, monospace;
		min-width: 2.2rem;
		color: #ddd;
		background: #1d1e20;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		padding: 0.3rem 0.4rem;
		cursor: pointer;
	}

	.codes button.dc {
		color: #999;
		border-style: dashed;
	}

	.codes button.on,
	.segment-picker button.on {
		border-color: #5db65d;
		color: #fff;
		background: #163116;
	}

	.demo-body {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		align-items: flex-start;
	}

	.display {
		width: 96px;
		height: auto;
		background: #0d0d0f;
		border-radius: 4px;
		padding: 6px;
	}

	.display path {
		fill: #2a2a2e;
	}

	.display path.lit {
		fill: #f23;
	}

	.readout {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 0.9rem;
		align-content: start;
	}

	.readout dt {
		color: #999;
		font-size: 0.85rem;
	}

	.readout dd {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.readout .note {
		grid-column: 1 / -1;
		color: #bbb;
		font-size: 0.85rem;
		max-width: 420px;
	}

	.bit {
		display: inline-block;
		border: 1px solid #f23;
		border-radius: 2px;
		padding: 0 0.35rem;
		color: #fff;
		font-size: 0.85rem;
	}

	.bit.on {
		border-color: #5db65d;
	}

	.decoder-table th,
	.decoder-table td {
		text-align: center;
		padding: 0.25rem 0.55rem;
	}

	.decoder-table tbody th {
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.first-out {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	tr.live td {
		box-shadow: inset 0 0 0 1px #fff;
	}

	.dc-row td {
		color: #999;
	}

	.dc-cell {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.segments {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 10px;
	}

	.segment {
		padding: 0.8rem 0.9rem 0.9rem;
	}

	.segment.lit {
		border-color: rgba(93, 182, 93, 0.6);
	}

	.segment h3 {
		margin: 0 0 0.4rem;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.segment h3 .mono {
		color: #8ede8e;
		font-size: 1.2rem;
	}

	.count {
		color: #999;
		font-size: 0.8rem;
	}

	.expr {
		color: #fff;
		margin: 0 0 0.5rem;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 0;
		font-size: 0.82rem;
	}

	.link {
		font: inherit;
		color: #8ede8e;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
	}

	.diagram-card {
		padding: 0.8rem 0.9rem 0.9rem;
	}

	.segment-picker {
		display: flex;
		gap: 4px;
		margin-bottom: 0.7rem;
	}

	.canvas {
		overflow-x: auto;
		background-color: #1d1e20;
		background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
		background-size: 22px 22px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem;
	}

	.canvas :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		max-width: 100%;
	}
</style>
