<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import GateSymbol from '$lib/GateSymbol.svelte';
	import ChipPinout from '$lib/ChipPinout.svelte';
	import CmosGate from '$lib/CmosGate.svelte';
	import ReferenceChart from '$lib/ReferenceChart.svelte';
	import { chipFor, gateCount } from '$lib/chips';
	import { imagesFor } from '$lib/generatedImages';
	import { gates } from '$lib/gates';
	import { glossary } from '$lib/glossary';
	import { equivalent, parseExpression, truthTable, toBinaryString } from '$lib/boolean';
	import type { PageData } from './$types';

	export let data: PageData;

	$: gate = data.gate;
	$: table = truthTable(parseExpression(gate.source));
	$: chip = chipFor(gate.slug);
	const countWord = (n: number) => ({ 4: 'four', 6: 'six' }[n] ?? String(n));
	// The printable pinout and transistor charts made for this gate, if any.
	$: charts = imagesFor(`/logic-gates/${gate.slug}`);
	$: others = gates.filter((g) => g.slug !== gate.slug);

	const bitsOf = (row: number, width: number) => [...toBinaryString(row, width)].map((d) => d === '1');
	const rowsOf = (source: string, variables: string[]) => truthTable(parseExpression(source), variables).rows;
	const differingRows = (x: boolean[], y: boolean[]) => x.flatMap((v, i) => (v !== y[i] ? [i] : []));
	/** "011, 101 and 110" from row numbers. */
	const rowList = (rows: number[], width: number) => {
		const names = rows.map((r) => toBinaryString(r, width));
		return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
	};

	// The 3-input table, read from the engine with a fixed variable order so
	// every column lines up, plus the chained and alternative readings.
	const VARS3 = ['a', 'b', 'c'];
	$: wide = gate.wide
		? (() => {
				const w = gate.wide;
				const rows = rowsOf(w.source, VARS3);
				const chained = rowsOf(w.chained.expression, VARS3);
				const alternative = w.alternative ? rowsOf(w.alternative.expression, VARS3) : null;
				return {
					...w,
					rows,
					chainSame: equivalent(parseExpression(w.chained.expression), parseExpression(w.source)),
					chainDiffer: differingRows(rows, chained),
					alternativeRows: alternative,
					alternativeDiffer: alternative ? differingRows(rows, alternative) : []
				};
		  })()
		: null;

	// Every gate on the same four input rows. NOT only reads a, so it gets its
	// own column at the end rather than a place among the 2-input gates.
	const COMPARED = ['and', 'or', 'nand', 'nor', 'xor', 'xnor', 'not'];
	const compared = COMPARED.map((slug) => {
		const g = gates.find((x) => x.slug === slug);
		if (!g) throw new Error(`no gate ${slug}`);
		return { slug, label: slug === 'not' ? 'NOT a' : g.name, rows: rowsOf(g.source, ['a', 'b']) };
	});

	$: term = glossary.find((entry) => entry.slug === `${gate.slug}-gate`);
	$: cardImage = `${SITE}/img/${gate.slug}-gate-truth-table.png`;
	$: url = `${SITE}/logic-gates/${gate.slug}`;
	$: ogImage = `${SITE}/og/logic-gates-${gate.slug}.png`;

	$: title = `${gate.name} Gate: Truth Table, Symbol and How It Works`;
	// The snippet answers the query itself: the rule, then the whole table,
	// read off the same engine output the page renders.
	$: rowsText = table.rows
		.map((out, i) => `${i.toString(2).padStart(table.variables.length, '0')}→${out ? 1 : 0}`)
		.join(', ');
	$: description =
		`The ${gate.name} gate outputs 1 when ${gate.outputHigh}. Truth table: ${rowsText}. ` +
		`Its symbol, expression and uses, with a live simulator.`;

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
				about: {
					'@type': 'DefinedTerm',
					'@id': `${SITE}/glossary#${gate.slug}-gate`,
					name: `${gate.name} gate`,
					description: term?.definition ?? gate.tagline,
					inDefinedTermSet: { '@id': `${SITE}/glossary#terms` }
				},
				mentions: { '@id': `${SITE}/#app` },
				image: { '@id': `${url}#primaryimage` },
				primaryImageOfPage: { '@id': `${url}#primaryimage` },
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
				'@type': 'ImageObject',
				'@id': `${url}#primaryimage`,
				url: cardImage,
				contentUrl: cardImage,
				caption: `${gate.name} gate reference card: ANSI and IEC symbols, the boolean expression and the truth table`
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
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
	<meta property="og:site_name" content="LogicGates.org" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={`LogicGates.org: ${gate.name}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/logic-gates', label: 'All seven gates' },
		{ href: '/logic-gate-symbols', label: 'Gate symbols' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
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
				<h2 class="card-title">{gate.name} gate truth table</h2>
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
		<h2>{gate.name} gate symbol</h2>
		<div class="symbols">
			<figure class="card symbol">
				<GateSymbol gate={gate.slug} standard="ansi" label="{gate.name} gate symbol, ANSI distinctive shape" />
				<figcaption>ANSI distinctive shape</figcaption>
			</figure>
			<figure class="card symbol">
				<GateSymbol gate={gate.slug} standard="iec" label="{gate.name} gate symbol, IEC rectangle" />
				<figcaption>IEC rectangular symbol</figcaption>
			</figure>
		</div>
		<p class="section-intro">
			{gate.symbolNote} The <a href="/logic-gate-symbols">logic gate symbols</a> page draws all seven gates side by side
			in both standards.
		</p>
	</section>

	<section>
		<h2>How the {gate.name} gate works</h2>
		<p>{gate.behaviour}</p>
		<p>{gate.intuition}</p>
	</section>

	{#if wide}
		<section>
			<h2>3-input {gate.name} gate truth table</h2>
			<p class="section-intro">{wide.explanation}</p>
			<div class="table-wrap">
				<table class="data-table wide-table">
					<thead>
						<tr>
							{#each VARS3 as variable}
								<th scope="col" class="mono">{variable}</th>
							{/each}
							<th scope="col" class="ones">Inputs at 1</th>
							<th scope="col" class="mono out">Q</th>
							{#if wide.alternative}
								<th scope="col" class="alt">{wide.alternative.label}</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each wide.rows as value, row}
							{@const bits = bitsOf(row, 3)}
							<tr>
								{#each bits as on}
									<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
								{/each}
								<td class="ones">{bits.filter(Boolean).length}</td>
								<td class="out {value ? 'bit-1' : 'bit-0'}">{value ? 1 : 0}</td>
								{#if wide.alternativeRows}
									<td class="alt" class:differs={wide.alternativeDiffer.includes(row)}>
										{wide.alternativeRows[row] ? 1 : 0}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p>
				Two 2-input {gate.name} gates in a chain, <code class="mono">{wide.chained.expression}</code>,
				{#if wide.chainSame}
					give exactly this table.
				{:else}
					do not give this table:
					{#if wide.chainDiffer.length === wide.rows.length}
						they give its exact opposite on every row,
					{:else}
						they differ from it on rows {rowList(wide.chainDiffer, 3)},
					{/if}
					and work out to
					<code class="mono">{wide.chained.equals}</code>. From 2-input parts, the 3-input gate is
					<code class="mono">{wide.fromTwo}</code>.
				{/if}
			</p>
			{#if wide.alternative}
				<p>
					{wide.alternative.note} In the table, the "{wide.alternative.label.toLowerCase()}" column differs from Q on {wide
						.alternativeDiffer.length === 1
						? 'row'
						: 'rows'}
					{rowList(wide.alternativeDiffer, 3)}.
				</p>
			{/if}
		</section>
	{/if}

	<section>
		<h2>{gate.name} compared with the other gates</h2>
		<p class="section-intro">
			The same four input rows through every gate, with the {gate.name} column highlighted. NOT has only one input, so its
			column is NOT a and ignores b.
		</p>
		<div class="table-wrap">
			<table class="data-table compare">
				<thead>
					<tr>
						<th scope="col" class="mono">a</th>
						<th scope="col" class="mono">b</th>
						{#each compared as column}
							<th scope="col" class="mono" class:current={column.slug === gate.slug}>
								{#if column.slug === gate.slug}
									{column.label}
								{:else}
									<a href="/logic-gates/{column.slug}">{column.label}</a>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each [0, 1, 2, 3] as row}
						{@const bits = bitsOf(row, 2)}
						<tr>
							{#each bits as on}
								<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
							{/each}
							{#each compared as column}
								<td class={column.rows[row] ? 'bit-1' : 'bit-0'} class:current={column.slug === gate.slug}>
									{column.rows[row] ? 1 : 0}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<ul class="uses contrasts">
			{#each gate.contrasts as contrast}
				<li>{contrast.note}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>Building the {gate.name} gate from other gates</h2>
		<p class="section-intro">
			Each of these is equivalent to the {gate.name} gate. Paste any of them into the simulator with
			<kbd>ctrl</kbd>+<kbd>E</kbd> to see the circuit.
		</p>
		<div class="table-wrap">
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
		</div>
	</section>

	<section>
		<h2>{gate.name} gate transistor circuit</h2>
		<p class="section-intro">
			In static CMOS, the textbook {gate.name} gate is a handful of transistors. Toggle the inputs to see which ones switch
			on and which network connects the output to the supply or to ground.
		</p>
		<CmosGate gate={gate.slug} />
		<div class="chart-small">
			{#each charts.filter((image) => image.file.includes('cmos')) as image}
				<ReferenceChart file={image.file} />
			{/each}
		</div>
	</section>

	{#if chip}
		<section>
			<h2>{gate.name} gate chip: the {chip.part}{chip.gates ? ' pinout' : ''}</h2>
			<p class="section-intro">
				To build with real parts, the {gate.name} gate comes {countWord(gateCount(chip))} to a package in the 7400 series.
				The
				{chip.part} is a {chip.description}.
			</p>
			<ChipPinout gate={gate.slug} />
			<div class="chart-small">
				{#each charts.filter((image) => image.file.includes('pinout')) as image}
					<ReferenceChart file={image.file} />
				{/each}
			</div>
		</section>
	{/if}

	<section>
		<h2>{gate.name} gate examples</h2>
		<p class="section-intro">Everyday and engineering things that follow the {gate.name} rule.</p>
		<ul class="uses">
			{#each gate.examples as example}
				<li>{example}</li>
			{/each}
		</ul>
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
		<h2>{gate.name} gate reference card</h2>
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
	/* The printable chart repeats the live diagram above it, so it stays small. */
	.chart-small :global(.card-image) {
		max-width: 420px;
		margin-top: 1rem;
	}

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

	.symbols {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 200px));
		gap: 12px;
		margin-bottom: 1rem;
	}

	.symbol {
		margin: 0;
		padding: 1rem 1.2rem 0.7rem;
	}

	.symbol figcaption {
		color: #999;
		font-size: 0.8rem;
		text-align: center;
		margin-top: 0.6rem;
	}

	.wide-table th,
	.wide-table td,
	.compare th,
	.compare td {
		text-align: center;
	}

	.wide-table .ones {
		color: #888;
		white-space: nowrap;
	}

	.wide-table .alt {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
		white-space: nowrap;
	}

	/* The alternative reading's disagreements with Q, which the text below lists. */
	.wide-table td.differs {
		color: #f7b267;
		font-weight: 600;
	}

	/* Separates the two input columns from the gate outputs. */
	.compare th:nth-child(3),
	.compare td:nth-child(3) {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.compare .current {
		background-color: rgba(93, 182, 93, 0.16);
	}

	.compare thead .current {
		color: #8ede8e;
	}

	/* Nine narrow columns: tighter cells on a phone so the whole table fits. */
	@media (max-width: 640px) {
		.data-table.compare th,
		.data-table.compare td {
			padding: 0.35rem 0.3rem;
			font-size: 0.78rem;
		}
	}

	code.mono {
		white-space: nowrap;
	}

	.compare thead a {
		color: #fff;
		text-decoration: none;
	}

	.compare thead a:hover {
		text-decoration: underline;
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
