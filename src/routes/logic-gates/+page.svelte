<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { gates } from '$lib/gates';
	import { parseExpression, truthTable } from '$lib/boolean';

	// Tables come from the expression engine, so the reference cannot drift.
	const rows = gates.map((gate) => ({ ...gate, table: truthTable(parseExpression(gate.source)) }));

	const page = {
		title: 'The 6 Logic Gates: Truth Tables, Symbols and Uses',
		description:
			'AND, OR, NOT, XOR, NAND and NOR explained, each with its truth table, boolean expression and what it is actually used for. Free reference, no signup.',
		url: `${SITE}/logic-gates`,
		image: `${SITE}/og/logic-gates.png`,
		imageAlt: 'Logic Nodes: logic gates'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${page.url}#webpage`,
				url: page.url,
				name: page.title,
				description: page.description,
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${page.url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: { '@id': `${page.url}#list` }
			},
			{
				'@type': 'ItemList',
				'@id': `${page.url}#list`,
				name: 'The six basic logic gates',
				itemListElement: gates.map((gate, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: `${gate.name} gate`,
					url: `${SITE}/logic-gates/${gate.slug}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Logic gates' }
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
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' }
	]}
>
	<section class="intro">
		<h1>The six logic gates</h1>
		<p class="lede">
			Every digital circuit ever built, from a doorbell to a processor, is made of these six operations. Each one
			combines binary inputs, one for NOT and two or more for the rest, into a single binary output.
		</p>
	</section>

	<section>
		<h2>All six at a glance</h2>
		<div class="gate-grid">
			{#each rows as gate}
				<a class="card gate" href="/logic-gates/{gate.slug}">
					<h3>
						<span class="gate-name">{gate.name}</span>
						<span class="gate-symbol mono">{gate.symbol}</span>
					</h3>
					<table class="data-table small">
						<thead>
							<tr>
								{#each gate.table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								<th scope="col" class="mono">Q</th>
							</tr>
						</thead>
						<tbody>
							{#each gate.table.rows as value, row}
								<tr>
									{#each gate.table.variables as _, bit}
										{@const on = !!(row & (1 << (gate.table.variables.length - 1 - bit)))}
										<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
									{/each}
									<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="tagline">{gate.tagline}</p>
					<span class="more">Read more →</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<h2>The chart</h2>
		<p class="section-intro">
			All six with their symbols and truth tables on one image, if you want it on a wall or in a set of notes.
		</p>
		<a class="chart-image" href="/img/logic-gates-chart.png" download>
			<img
				src="/img/logic-gates-chart.png"
				alt="Logic gates chart: AND, OR, NOT, XOR, NAND and NOR with their ANSI symbols, boolean expressions and truth tables"
				width="1180"
				height="700"
				loading="lazy"
				decoding="async"
			/>
			<span class="chart-caption">Click to download the logic gates chart</span>
		</a>
	</section>

	<section>
		<h2>How they relate</h2>
		<p class="section-intro">
			The six are not independent. Three of them are the other three with the output inverted, and two of them can build
			all the rest on their own.
		</p>
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col">Gate</th>
					<th scope="col">Is</th>
					<th scope="col">Inputs</th>
					<th scope="col">Universal</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">AND</th>
					<td>The base case: all inputs high</td>
					<td>2 or more</td>
					<td>No</td>
				</tr>
				<tr>
					<th scope="row">OR</th>
					<td>The base case: any input high</td>
					<td>2 or more</td>
					<td>No</td>
				</tr>
				<tr>
					<th scope="row">NOT</th>
					<td>Inversion, the thing that completes the set</td>
					<td>1</td>
					<td>No</td>
				</tr>
				<tr>
					<th scope="row">NAND</th>
					<td>AND, inverted</td>
					<td>2 or more</td>
					<td>Yes</td>
				</tr>
				<tr>
					<th scope="row">NOR</th>
					<td>OR, inverted</td>
					<td>2 or more</td>
					<td>Yes</td>
				</tr>
				<tr>
					<th scope="row">XOR</th>
					<td>OR, minus the case where both are high</td>
					<td>2</td>
					<td>No</td>
				</tr>
			</tbody>
		</table>
		<p class="reducer">
			"Universal" means every other gate can be built from that one alone. NAND and NOR both qualify, which is why real
			chips are largely made of them. Each gate page shows the construction, and every identity on this site is machine
			checked against its truth table.
		</p>
	</section>

	<section>
		<h2>Try them</h2>
		<p class="section-intro">
			Reading a truth table is one thing; watching a signal move is another. Drop a couple of these onto a canvas, wire
			them to a switch and a lamp, and toggle the inputs.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			Prefer to recognise them on a schematic? The
			<a href="/logic-gate-symbols">symbol reference</a> has all six in both the ANSI and IEC styles.
		</p>
		<p class="reducer">
			Or start from the <a href="/simulator#example:Introduction">introduction circuit</a>, generate a
			<a href="/truth-table-generator">truth table</a> from what you build, and simplify it with a
			<a href="/karnaugh-map-solver">Karnaugh map</a>.
		</p>
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 64px;
	}

	.chart-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
	}

	.chart-image img {
		display: block;
		width: 100%;
		height: auto;
		/* The card art is black on white, so it carries its own page colour. */
		background: #fff;
	}

	.chart-caption {
		display: block;
		background: #161618;
		color: #8ede8e;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
	}

	.gate-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 12px;
	}

	.gate {
		padding: 0.9rem 1rem 1rem;
		text-decoration: none;
		display: block;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.gate:hover {
		border-color: rgba(255, 255, 255, 0.75);
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.gate,
		.gate:hover {
			transition: none;
			transform: none;
		}
	}

	.gate h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.gate-name {
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.gate-symbol {
		font-size: 0.85rem;
		color: #999;
	}

	.gate .small {
		width: 100%;
		font-size: 0.85rem;
	}

	.tagline {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.6rem 0 0.4rem;
	}

	.more {
		color: #8ede8e;
		font-size: 0.8rem;
	}
</style>
