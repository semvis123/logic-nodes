<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { generatedImage } from '$lib/generatedImages';
	import { commonCircuits } from '$lib/commonCircuits';
	import { parseExpression, evaluate, format } from '$lib/boolean';
	import { buildCircuit, circuitStates } from '$lib/circuit';
	import { circuitToSvg } from '$lib/exportSvg';
	import type { PageData } from './$types';

	export let data: PageData;

	$: circuit = data.circuit;
	$: others = commonCircuits.filter((c) => c.slug !== circuit.slug);
	$: url = `${SITE}/common-circuits/${circuit.slug}`;
	$: ogImage = `${SITE}/og/common-circuits-${circuit.slug}.png`;

	// The truth table and the diagram are both generated from the same
	// expressions, so the page cannot show a table that disagrees with its drawing.
	$: asts = circuit.outputs.map((o) => ({ name: o.name, ast: parseExpression(o.expression) }));
	$: rows = Array.from({ length: 1 << circuit.inputs.length }, (_, row) => {
		const values: Record<string, boolean> = {};
		circuit.inputs.forEach((pin, i) => {
			values[pin.v] = !!(row & (1 << (circuit.inputs.length - 1 - i)));
		});
		return {
			inputs: circuit.inputs.map((pin) => values[pin.v]),
			outputs: asts.map((o) => evaluate(o.ast, values))
		};
	});
	$: drawn = buildCircuit(asts);
	$: card = generatedImage(`${circuit.slug}-circuit-diagram.png`);

	// Live diagram: toggle the inputs and the signal colours follow.
	let pins: Record<string, boolean> = {};
	let lastSlug = '';
	$: if (circuit.slug !== lastSlug) {
		lastSlug = circuit.slug;
		pins = Object.fromEntries(circuit.inputs.map((pin) => [pin.v, false]));
	}
	$: states = circuitStates(drawn, pins);
	$: svg = circuitToSvg(drawn, { standard: 'ansi', palette: 'colour', states });
	$: liveRow = circuit.inputs.reduce(
		(acc, pin, i) => acc + (pins[pin.v] ? 1 << (circuit.inputs.length - 1 - i) : 0),
		0
	);
	$: reading = circuit.outputs.map((o, i) => `${o.name} = ${format(asts[i].ast, 'math')}`).join('; ');

	// Title case for the tab and the search result: "Half Adder", "2-to-1 Multiplexer".
	$: title = `${circuit.name.replace(/(^|\s)[a-z]/g, (m) =>
		m.toUpperCase()
	)}: Truth Table, Circuit Diagram and Boolean Expression`;
	$: description = circuit.definition;

	$: jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['WebPage', 'FAQPage'],
				'@id': `${url}#webpage`,
				url,
				name: title,
				description,
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(url),
				mainEntity: circuit.faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Common circuits', item: `${SITE}/common-circuits` },
					{ '@type': 'ListItem', position: 3, name: circuit.name }
				]
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta name="author" content="Sem" />
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="LogicGates.org" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={`LogicGates.org: ${circuit.name}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/common-circuits', label: 'All the common circuits' },
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/common-circuits">Common circuits</a> <span aria-hidden="true">/</span>
			<span>{circuit.name}</span>
		</nav>
		<h1>{circuit.name}</h1>
		<p class="lede">{circuit.definition}</p>
		<p class="tagline">{circuit.tagline}</p>
	</section>

	<section id="diagram">
		<h2>Circuit diagram</h2>
		<p class="section-intro">
			Toggle the inputs and follow the signals: green wires are high, red are low. The highlighted row of the truth
			table below is the one you have set.
		</p>
		<div class="card diagram-card">
			<div class="inputs" role="group" aria-label="Circuit inputs">
				{#each circuit.inputs as pin}
					<button
						type="button"
						class="pin"
						class:on={pins[pin.v]}
						aria-pressed={pins[pin.v]}
						on:click={() => (pins = { ...pins, [pin.v]: !pins[pin.v] })}
					>
						{pin.label}
						<span class="val">{pins[pin.v] ? 1 : 0}</span>
					</button>
				{/each}
				<span class="outs">
					{#each asts as o, i}
						<span class="out-state" class:on={rows[liveRow].outputs[i]}>
							{o.name} <span class="val">{rows[liveRow].outputs[i] ? 1 : 0}</span>
						</span>
					{/each}
				</span>
			</div>
			<div class="canvas" role="img" aria-label={`${circuit.name} logic circuit diagram: ${reading}`}>
				{@html svg}
			</div>
		</div>
	</section>

	<section id="truth-table">
		<h2>Truth table</h2>
		<div class="layout">
			<div class="table-wrap">
				<table class="data-table circuit-table">
					<thead>
						<tr>
							{#each circuit.inputs as pin}
								<th scope="col" class="mono">{pin.label}</th>
							{/each}
							{#each circuit.outputs as output, i}
								<th scope="col" class="mono out" class:first-out={i === 0}>{output.name}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each rows as row, index}
							<tr class:live={index === liveRow}>
								{#each row.inputs as bit}
									<td class={bit ? 'bit-1' : 'bit-0'}>{bit ? 1 : 0}</td>
								{/each}
								{#each row.outputs as bit, i}
									<td class="out {bit ? 'bit-1' : 'bit-0'}" class:first-out={i === 0}>{bit ? 1 : 0}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="side">
				<h3>Boolean expressions</h3>
				<dl class="equations">
					{#each circuit.outputs as output, i}
						<dt class="mono">{output.name}</dt>
						<dd>
							<span class="mono expr">{format(asts[i].ast, 'math')}</span>
							<span class="note">{output.note}</span>
						</dd>
					{/each}
				</dl>
			</div>
		</div>
	</section>

	<section id="how-it-works">
		<h2>How it works</h2>
		<p>{circuit.explanation}</p>
	</section>

	<section id="uses">
		<h2>Where it is used</h2>
		<ul class="uses">
			{#each circuit.uses as use}
				<li>{use}</li>
			{/each}
		</ul>
	</section>

	<section id="build">
		<h2>Build it</h2>
		<p>{circuit.buildTip}</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			Or draw it from the expressions above with the
			<a href="/logic-circuit-generator">circuit diagram generator</a>, in either symbol standard, and export it as SVG,
			PNG, Verilog or VHDL.
		</p>
	</section>

	<section id="reference-card">
		<h2>Reference card</h2>
		<p class="section-intro">The diagram above as an image, black on white, for notes or a slide.</p>
		<a class="card-image" href="/img/{card.file}" download>
			<img
				src="/img/{card.file}"
				alt={card.alt}
				width={card.width}
				height={card.height}
				loading="lazy"
				decoding="async"
			/>
			<span class="card-caption">Click to download: {card.title}</span>
		</a>
	</section>

	<section class="faq">
		<h2>Questions about the {circuit.name.toLowerCase()}</h2>
		{#each circuit.faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>

	<section>
		<h2>The other circuits</h2>
		<div class="others">
			{#each others as other}
				<a class="other" href="/common-circuits/{other.slug}">
					<span class="other-name">{other.name}</span>
					<span class="other-tagline">{other.tagline}</span>
				</a>
			{/each}
		</div>
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

	.tagline {
		color: #bbb;
		margin-top: 0.4rem;
	}

	.diagram-card {
		padding: 0.8rem 0.9rem 0.9rem;
	}

	.inputs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 0.7rem;
	}

	.pin {
		font: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #fff;
		background: #1d1e20;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pin .val,
	.out-state .val {
		display: inline-block;
		min-width: 1.2em;
		text-align: center;
		border-radius: 2px;
		border: 1px solid #f23;
		background: #0d0d0f;
		color: #fff;
		font-weight: 700;
		padding: 0 0.2em;
	}

	.pin.on .val,
	.out-state.on .val {
		border-color: #5db65d;
	}

	.pin.on {
		border-color: #5db65d;
	}

	.outs {
		margin-left: auto;
		display: inline-flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.out-state {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #ddd;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
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

	.layout {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 16px;
		align-items: start;
	}

	@media (max-width: 700px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.circuit-table th,
	.circuit-table td {
		text-align: center;
		padding: 0.3rem 0.75rem;
	}

	.first-out {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	tr.live td {
		box-shadow: inset 0 0 0 1px #fff;
	}

	.side h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.equations {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 0.9rem;
		font-size: 0.9rem;
	}

	.equations dt {
		color: #fff;
		font-weight: 600;
	}

	.equations dd {
		margin: 0;
	}

	.expr {
		color: #8ede8e;
		display: block;
	}

	.note {
		color: #888;
		font-size: 0.82rem;
	}

	.uses {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.uses li {
		margin-bottom: 0.4rem;
	}

	.card-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
		max-width: 640px;
	}

	.card-image img {
		display: block;
		width: 100%;
		height: auto;
		/* The card art is black on white, so it carries its own page colour. */
		background: #fff;
	}

	.card-caption {
		display: block;
		background: #161618;
		color: #8ede8e;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
	}

	.others {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
	}

	.other {
		display: block;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
		text-decoration: none;
		color: #ddd;
	}

	.other:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.other-name {
		display: block;
		color: #fff;
		font-weight: 600;
	}

	.other-tagline {
		display: block;
		font-size: 0.82rem;
		color: #999;
		margin-top: 0.2rem;
	}
</style>
