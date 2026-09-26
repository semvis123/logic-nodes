<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { imagesFor } from '$lib/generatedImages';
	import { modifiedFields } from '$lib/lastmod';
	import GateSymbol from '$lib/GateSymbol.svelte';
	import { gates } from '$lib/gates';
	import { shapes } from '$lib/symbols';
	import { parseExpression, truthTable, format } from '$lib/boolean';
	import { overbarRuns } from '$lib/demorgan';
	import { overbarForms, iecLabels } from '$lib/symbolChart';

	let standard: 'ansi' | 'iec' = 'ansi';

	// The truth tables and the programming form come from the expression
	// engine; the overbar forms and IEC labels are checked against it in tests.
	const rows = gates.map((gate) => {
		const ast = parseExpression(gate.source);
		return {
			...gate,
			shape: shapes[gate.slug],
			table: truthTable(ast),
			code: format(ast, 'programming'),
			overbar: overbarRuns(overbarForms[gate.slug])
		};
	});
	const iecRows = iecLabels.map((label) => ({
		...label,
		gateNames: label.gates.map((slug) => gates.find((g) => g.slug === slug)?.name ?? slug)
	}));

	const chart = imagesFor('/logic-gate-symbols');

	const faqs = [
		{
			q: 'What is the difference between ANSI and IEC logic gate symbols?',
			a: 'The distinctive shapes give each gate its own outline: a D for AND, a shield for OR, a triangle for NOT. They come from MIL-STD-806 and are kept in ANSI/IEEE Std 91-1984, which is why they are usually just called the ANSI symbols — though that standard defines rectangular forms too. IEC 60617-12 uses one rectangle for every gate with a label inside saying what it does: & for AND, ≥1 for OR, 1 for a buffer, =1 for XOR. American schematics tend to use ANSI, European and formal standards documents tend to use IEC.'
		},
		{
			q: 'Which logic gate symbols are used in Europe?',
			a: 'Formally, the IEC 60617 rectangles, adopted in Europe as EN 60617 and in Germany as DIN EN 60617, which is why they are often called the European or DIN symbols. Each gate is a rectangle with a label: & for AND, ≥1 for OR, =1 for XOR. The ANSI shapes are widely understood in Europe as well, and plenty of European schematics use them.'
		},
		{
			q: 'What does ≥1 mean on a logic gate?',
			a: 'It is the IEC label for OR. Most IEC labels are a count of how many inputs must be 1 for the output to be 1, and ≥1 means at least one. The AND label & means every input, and =1 means exactly one, which for two inputs is XOR.'
		},
		{
			q: 'What does the little circle on a gate symbol mean?',
			a: 'That bubble means inversion. An AND with a bubble on its output is a NAND; an OR with one is a NOR; the triangle with a bubble is a NOT gate. A bubble on an input means that input is active low, so it is inverted before the gate acts on it.'
		},
		{
			q: 'What are the symbols for AND and OR gates?',
			a: 'In the ANSI style the AND symbol has a flat back and a smooth semicircular nose, like a capital D. The OR symbol has a curved back and comes to a point. In the IEC style both are rectangles, labelled & for AND and ≥1 for OR. In boolean algebra AND is written A · B or A ∧ B, and OR is A + B or A ∨ B.'
		},
		{
			q: 'How is XOR drawn?',
			a: 'Exactly like OR, with a second curved line drawn just behind the back of the shape. That extra line is the only difference, so it is worth looking twice at a busy schematic. In IEC form the rectangle is labelled =1, meaning exactly one input is high.'
		}
	];

	const page = {
		title: 'Logic Gate Symbols Chart: ANSI, IEC and Truth Tables',
		description:
			'All seven logic gate symbols in one chart: ANSI/IEEE distinctive shapes, IEC 60617 rectangles (the European style), boolean expressions and truth tables.',
		url: `${SITE}/logic-gate-symbols`,
		image: `${SITE}/og/logic-gate-symbols.png`,
		imageAlt: 'LogicGates.org: logic gate symbols'
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
				...(chart.length ? { primaryImageOfPage: { '@id': `${page.url}#chart` } } : {}),
				mainEntity: faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			...chart.slice(0, 1).map((image) => ({
				'@type': 'ImageObject',
				'@id': `${page.url}#chart`,
				name: image.title,
				caption: image.alt,
				contentUrl: `${SITE}/img/${image.file}`,
				width: image.width,
				height: image.height
			})),
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Logic gates', item: `${SITE}/logic-gates` },
					{ '@type': 'ListItem', position: 3, name: 'Symbols' }
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
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws and bubble pushing" },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Logic gate symbols</h1>
		<p class="lede">
			Every gate in both standards: the ANSI distinctive shapes used on most American schematics, and the IEC rectangles
			used in European and formal documents. Same gates, two drawings.
		</p>
		<div class="switch" role="group" aria-label="Symbol standard">
			<button
				type="button"
				class:active={standard === 'ansi'}
				aria-pressed={standard === 'ansi'}
				on:click={() => (standard = 'ansi')}>ANSI shapes</button
			>
			<button
				type="button"
				class:active={standard === 'iec'}
				aria-pressed={standard === 'iec'}
				on:click={() => (standard = 'iec')}>IEC rectangles</button
			>
		</div>
	</section>

	<section id="symbols">
		<h2>The 7 logic gate symbols</h2>
		<div class="grid">
			{#each rows as gate}
				<div class="card symbol-card">
					<h3>
						<a href="/logic-gates/{gate.slug}">{gate.name}</a>
						<span class="expr mono">{gate.symbol}</span>
					</h3>
					<div class="drawing">
						<GateSymbol
							gate={gate.slug}
							{standard}
							label={`${gate.name} gate, ${standard === 'ansi' ? 'ANSI distinctive shape' : 'IEC rectangular'} symbol`}
						/>
					</div>
					<p class="note">{gate.tagline}</p>
				</div>
			{/each}
		</div>
		<p class="reducer">
			{#if standard === 'ansi'}
				Note that NAND is simply the AND shape with a bubble, and NOR is OR with a bubble. XOR is OR with one extra line
				across its back, which is easy to miss on a dense drawing, and XNOR is that shape with a bubble.
			{:else}
				In IEC form every gate is the same rectangle and only the label changes: <span class="mono">&amp;</span>
				for AND, <span class="mono">≥1</span> for OR, <span class="mono">1</span> for a buffer,
				<span class="mono">=1</span> for XOR and <span class="mono">=</span> for XNOR. Inversion is still a bubble on the
				output.
			{/if}
		</p>
	</section>

	<section id="chart">
		<h2>Logic gate symbols chart</h2>
		<p class="section-intro">
			All seven gates with the ANSI and IEC symbol, the boolean expression in three notations, and the truth table.
		</p>
		<div class="table-wrap">
			<table class="data-table compare">
				<thead>
					<tr>
						<th scope="col">Gate</th>
						<th scope="col">ANSI / IEEE</th>
						<th scope="col">IEC 60617</th>
						<th scope="col">Expression</th>
						<th scope="col">Truth table</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as gate}
						<tr>
							<th scope="row">
								<a href="/logic-gates/{gate.slug}">{gate.name}</a>
								<span class="high">1 when {gate.outputHigh}</span>
							</th>
							<td class="cell-symbol"
								><GateSymbol gate={gate.slug} standard="ansi" label="{gate.name} gate, ANSI symbol" /></td
							>
							<td class="cell-symbol"
								><GateSymbol gate={gate.slug} standard="iec" label="{gate.name} gate, IEC symbol" /></td
							>
							<td class="forms">
								<span class="mono overbar"
									>Q = {#each gate.overbar as run}<span class:bar={run.bar}
											>{#if run.bar}<span class="sr">{run.group ? 'not (' : 'not '}</span
												>{/if}{run.text}{#if run.group}<span class="sr">)</span>{/if}</span
										>{/each}</span
								>
								<span class="mono">{gate.symbol}</span>
								<span class="mono">{gate.code}</span>
							</td>
							<td class="cell-table">
								<table class="mini" aria-label="{gate.name} truth table">
									<thead>
										<tr>
											{#each gate.table.variables as variable}
												<th scope="col">{variable}</th>
											{/each}
											<th scope="col">Q</th>
										</tr>
									</thead>
									<tbody>
										{#each gate.table.rows as value, row}
											<tr>
												{#each gate.table.variables as _, bit}
													{@const on = !!(row & (1 << (gate.table.variables.length - 1 - bit)))}
													<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
												{/each}
												<td class="q {value ? 'bit-1' : 'bit-0'}">{value ? 1 : 0}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The three expressions say the same thing: a bar or <span class="mono">¬</span> or <span class="mono">!</span> is
			NOT,
			<span class="mono">·</span>, <span class="mono">∧</span> and <span class="mono">&amp;&amp;</span> are AND, and
			<span class="mono">+</span>, <span class="mono">∨</span> and <span class="mono">||</span> are OR. Each gate's own
			page has its full truth table for more inputs, and the
			<a href="/truth-table-generator">truth table generator</a> makes one for any expression.
		</p>

		{#each chart as shot}
			<h3 id="download">Download the chart</h3>
			<p>All seven gates in both standards on one image, for notes or a slide.</p>
			<a class="card-image" href="/img/{shot.file}" download>
				<img
					src="/img/{shot.file}"
					alt={shot.alt}
					width={shot.width}
					height={shot.height}
					loading="lazy"
					decoding="async"
				/>
				<span class="card-caption">Click to download: {shot.title}</span>
			</a>
		{/each}
	</section>

	<section id="iec">
		<h2>IEC symbols: what &amp;, ≥1, =1 and 1 mean</h2>
		<p>
			In IEC 60617 every gate is the same rectangle, so the label inside carries the whole function. Most labels are a
			count of how many inputs must be 1 for the output to be 1 (≥1, =1, 2k+1); &amp; means every input, and = means all
			inputs are equal. A handful of short labels covers every gate.
		</p>
		<div class="table-wrap">
			<table class="data-table labels">
				<thead>
					<tr>
						<th scope="col">Label</th>
						<th scope="col">Name</th>
						<th scope="col">Output is 1 when</th>
						<th scope="col">Used for</th>
					</tr>
				</thead>
				<tbody>
					{#each iecRows as label}
						<tr>
							<th scope="row" class="mono iec-label">{label.label}</th>
							<td>{label.name}</td>
							<td>{label.meaning}</td>
							<td>
								{#each label.gates as slug, i}{i ? ', ' : ''}<a href="/logic-gates/{slug}">{label.gateNames[i]}</a
									>{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			Inversion is the same bubble as in the ANSI shapes. NAND is the <span class="mono">&amp;</span> rectangle with a
			bubble on its output, NOR is <span class="mono">≥1</span> with a bubble, and NOT is the
			<span class="mono">1</span> buffer with a bubble. XNOR is drawn two ways: <span class="mono">=</span>, or
			<span class="mono">=1</span> with a bubble. For two inputs they are the same function.
		</p>
		<p class="reducer">
			With three or more inputs, <span class="mono">=1</span> and a chain of XOR gates part ways.
			<span class="mono">=1</span> means exactly one input is 1, while <span class="mono">a ⊕ b ⊕ c</span> is 1 whenever
			an odd number of inputs is 1, all three included. IEC labels that odd parity function
			<span class="mono">2k+1</span>.
		</p>
	</section>

	<section id="bubble">
		<h2>The bubble: what the circle on a gate means</h2>
		<p class="section-intro">One convention carries most of the meaning on a schematic: a small circle means invert.</p>
		<ul class="bubbles">
			<li>
				<strong>On the output</strong>, it negates the gate. AND becomes
				<a href="/logic-gates/nand">NAND</a>, OR becomes <a href="/logic-gates/nor">NOR</a>, and the NOT triangle is
				really just a buffer with a bubble.
			</li>
			<li>
				<strong>On an input</strong>, it means that pin is active low: the signal is inverted before the gate sees it.
				An AND with both inputs bubbled behaves as a NOR, which is
				<a href="/de-morgans-laws#in-circuits">De Morgan's law</a> drawn rather than written.
			</li>
			<li>
				<strong>On a clock pin</strong> of a <a href="/flip-flops">flip-flop</a>, a bubble in front of the edge triangle
				means the part triggers on the falling edge rather than the rising one.
			</li>
		</ul>
		<p class="reducer">
			This is why experienced engineers redraw gates with bubbles moved around: pushing bubbles through a gate swaps AND
			for OR and often makes a schematic read more directly.
		</p>
	</section>

	<section id="ansi-vs-iec">
		<h2>ANSI vs IEC logic gate symbols</h2>
		<p>
			The distinctive shapes are often called the ANSI, IEEE or American symbols; they are defined in ANSI/IEEE Std
			91-1984. The rectangles are the IEC 60617 symbols, often called the European symbols, and in Germany the DIN
			symbols after DIN EN 60617. Both describe the same seven gates, and both use the bubble for inversion.
		</p>
		<p>
			If you are drawing for other people, match whatever they already use. American textbooks and most schematic
			capture tools default to the ANSI shapes, and they have a real advantage: the outline tells you the function at a
			glance, even at small sizes or in a photocopy. IEC rectangles win when a part has many inputs or unusual
			behaviour, because there is always room for a label, and they are what international standards documents expect.
		</p>
		<p>
			The simulator on this site uses neither. The editor draws every node as a labelled box, which is closer to IEC in
			spirit and keeps custom nodes and gates looking consistent.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
	</section>

	<section class="faq">
		<h2>Questions about logic gate symbols</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	.card-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
		max-width: 640px;
		margin-bottom: 0.9rem;
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

	.intro {
		padding-top: 64px;
	}

	.switch {
		display: inline-flex;
		gap: 4px;
		margin-top: 0.5rem;
	}

	.switch button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
	}

	.switch button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 12px;
	}

	.symbol-card {
		padding: 0.9rem 1rem 1rem;
	}

	.symbol-card h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.symbol-card h3 a {
		color: #fff;
		text-decoration: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.symbol-card h3 a:hover {
		text-decoration: underline;
	}

	.expr {
		font-size: 0.8rem;
		color: #999;
	}

	.drawing {
		padding: 0.8rem 0.6rem;
		max-width: 190px;
		margin: 0 auto;
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
		text-align: center;
	}

	.compare th,
	.compare td {
		vertical-align: middle;
	}

	.compare th[scope='row'] a {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.high {
		display: block;
		color: #999;
		font-size: 0.78rem;
		font-weight: normal;
		margin-top: 0.2rem;
		max-width: 11rem;
	}

	.cell-symbol {
		width: 110px;
		min-width: 110px;
		padding: 0.4rem 0.6rem;
	}

	.forms {
		white-space: nowrap;
		/* Holds the absolutely placed .sr text inside the scrolling table, so it
		   cannot widen the page from outside it. */
		position: relative;
	}

	.forms > span {
		display: block;
		font-size: 0.85rem;
		color: #bbb;
		line-height: 1.6;
	}

	.forms .overbar {
		color: #8ede8e;
		font-size: 1rem;
	}

	.bar {
		text-decoration: overline;
	}

	/* Read aloud, the bar becomes "not"; on screen, the bar alone says it. */
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.mini {
		border-collapse: collapse;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
	}

	.compare .mini th,
	.compare .mini td {
		padding: 0.05rem 0.45rem;
		line-height: 1.35;
		text-align: center;
		border: none;
		background: none;
	}

	.mini th {
		color: #999;
		font-weight: normal;
	}

	.compare .mini .q {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.iec-label {
		font-size: 1.05rem;
		color: #fff;
	}

	.bubbles {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.bubbles li {
		margin-bottom: 0.6rem;
	}

	.bubbles strong {
		color: #fff;
	}
</style>
