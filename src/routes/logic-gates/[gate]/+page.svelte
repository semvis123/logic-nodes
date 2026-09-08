<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { gates } from '$lib/gates';
	import { parseExpression, truthTable } from '$lib/boolean';
	import type { PageData } from './$types';

	export let data: PageData;

	$: gate = data.gate;
	$: table = truthTable(parseExpression(gate.source));
	$: others = gates.filter((g) => g.slug !== gate.slug);
	$: url = `${SITE}/logic-gates/${gate.slug}`;
	$: ogImage = `${SITE}/og/logic-gates-${gate.slug}.png`;

	$: title = `${gate.name} Gate: Truth Table, Symbol and How It Works`;
	$: description =
		`What the ${gate.name} gate does, its truth table and boolean expression, ` +
		`how to build it from other gates, and where it is used. Free reference with a live simulator.`;

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
				mainEntity: gate.faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Logic gates', item: `${SITE}/logic-gates` },
					{ '@type': 'ListItem', position: 3, name: `${gate.name} gate` }
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
	<meta property="og:site_name" content="Logic Nodes" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={`Logic Nodes: ${gate.name}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/logic-gates', label: 'All six gates' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/truth-table-generator', label: 'Truth table generator' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/logic-gates">Logic gates</a> <span aria-hidden="true">/</span>
			<span>{gate.name}</span>
		</nav>
		<h1>{gate.name} gate</h1>
		<p class="lede">{gate.tagline}</p>

		<div class="summary">
			<div class="card table-card">
				<h2 class="card-title">Truth table</h2>
				<table class="data-table">
					<thead>
						<tr>
							{#each table.variables as variable}
								<th scope="col" class="mono">{variable}</th>
							{/each}
							<th scope="col" class="mono out">Q</th>
						</tr>
					</thead>
					<tbody>
						{#each table.rows as value, row}
							<tr>
								{#each table.variables as _, bit}
									{@const on = !!(row & (1 << (table.variables.length - 1 - bit)))}
									<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
								{/each}
								<td class="out {value ? 'bit-1' : 'bit-0'}">{value ? 1 : 0}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="card facts">
				<h2 class="card-title">At a glance</h2>
				<dl>
					<dt>Boolean expression</dt>
					<dd class="mono">{gate.symbol}</dd>
					<dt>Engineering notation</dt>
					<dd class="mono">{gate.expression}</dd>
					<dt>Inputs</dt>
					<dd>{gate.inputs === 'many' ? 'Two or more' : gate.inputs === 1 ? 'One' : 'Two'}</dd>
					<dt>Output is high when</dt>
					<dd>{gate.outputHigh}</dd>
				</dl>
			</div>
		</div>
	</section>

	<section>
		<h2>How the {gate.name} gate behaves</h2>
		<p>{gate.behaviour}</p>
		<p>{gate.intuition}</p>
	</section>

	<section>
		<h2>Building it from other gates</h2>
		<p class="section-intro">
			Each of these is equivalent to the {gate.name} gate, verified against the full truth table. Paste any of them into
			the simulator with <kbd>ctrl</kbd>+<kbd>E</kbd> to see the circuit.
		</p>
		<table class="data-table equivalences">
			<thead>
				<tr>
					<th scope="col">Construction</th>
					<th scope="col">Expression</th>
					<th scope="col">Equals</th>
				</tr>
			</thead>
			<tbody>
				{#each gate.equivalences as eq}
					<tr>
						<th scope="row">{eq.label}</th>
						<td class="mono">{eq.expression}</td>
						<td class="mono equals">{eq.equals}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section>
		<h2>Reference card</h2>
		<p class="section-intro">
			The symbol in <a href="/logic-gate-symbols">both standards</a> and the truth table on one image, for notes or a slide.
		</p>
		<a class="card-image" href="/img/{gate.slug}-gate-truth-table.png" download>
			<img
				src="/img/{gate.slug}-gate-truth-table.png"
				alt="{gate.name} gate reference: ANSI and IEC symbols, the boolean expression {gate.symbol}, and the full truth table"
				width="760"
				height="620"
				loading="lazy"
				decoding="async"
			/>
			<span class="card-caption">Click to download the {gate.name} reference card</span>
		</a>
	</section>

	<section>
		<h2>Where the {gate.name} gate is used</h2>
		<ul class="uses">
			{#each gate.uses as use}
				<li>{use}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>In the simulator</h2>
		<p class="section-intro">{gate.inSimulator}</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
	</section>

	<section class="faq">
		<h2>Questions about the {gate.name} gate</h2>
		{#each gate.faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>

	<section>
		<h2>The other gates</h2>
		<div class="others">
			{#each others as other}
				<a class="other" href="/logic-gates/{other.slug}">
					<span class="other-name mono">{other.name}</span>
					<span class="other-tag">{other.tagline}</span>
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

	.summary {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 12px;
		align-items: start;
		margin-top: 1.5rem;
	}

	@media (max-width: 640px) {
		.summary {
			grid-template-columns: 1fr;
		}
	}

	.card-title {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888;
		margin: 0 0 0.6rem;
	}

	.table-card,
	.facts {
		padding: 0.9rem 1rem 1rem;
	}

	.table-card .data-table {
		border: none;
		background: transparent;
	}

	.table-card th,
	.table-card td {
		text-align: center;
		padding: 0.3rem 1rem;
	}

	.out {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.facts dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.35rem 1rem;
		font-size: 0.9rem;
	}

	.facts dt {
		color: #888;
	}

	.facts dd {
		margin: 0;
		color: #ddd;
	}

	.equivalences .equals {
		color: #8ede8e;
	}

	.card-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
		max-width: 560px;
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

	.uses {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.uses li {
		margin-bottom: 0.6rem;
	}

	.others {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 10px;
	}

	.other {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.7rem 0.9rem;
		text-decoration: none;
	}

	.other:hover {
		border-color: rgba(255, 255, 255, 0.7);
	}

	.other-name {
		display: block;
		color: #fff;
		font-weight: 600;
	}

	.other-tag {
		display: block;
		color: #999;
		font-size: 0.82rem;
		margin-top: 0.15rem;
	}
</style>
