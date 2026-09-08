<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { imagesFor } from '$lib/generatedImages';
	import { modifiedFields } from '$lib/lastmod';
	import { commonCircuits } from '$lib/commonCircuits';
	import { parseExpression, evaluate } from '$lib/boolean';

	// One combined table per circuit: every input combination, every output.
	const built = commonCircuits.map((circuit) => {
		const asts = circuit.outputs.map((o) => parseExpression(o.expression));
		const rows = Array.from({ length: 1 << circuit.inputs.length }, (_, row) => {
			const values: Record<string, boolean> = {};
			circuit.inputs.forEach((pin, i) => {
				values[pin.v] = !!(row & (1 << (circuit.inputs.length - 1 - i)));
			});
			return {
				inputs: circuit.inputs.map((pin) => values[pin.v]),
				outputs: asts.map((ast) => evaluate(ast, values))
			};
		});
		return { ...circuit, rows };
	});

	const faqs = [
		{
			q: 'What is the difference between a half adder and a full adder?',
			a: 'A half adder adds two bits and produces a sum and a carry, but has no way to accept a carry coming in. A full adder takes a third input for that carry, which is what lets adders be chained one per bit. The first column of an adder can be a half adder; every column after it must be a full adder.'
		},
		{
			q: 'What is the difference between a multiplexer and a decoder?',
			a: 'A multiplexer has many data inputs and one output, and the select lines choose which input reaches it. A decoder has only the select lines and raises exactly one of its many outputs. A demultiplexer is the mux run backwards: one input, many outputs, and it is a decoder with the data line ANDed into each output.'
		},
		{
			q: 'Are these circuits combinational?',
			a: 'Yes, all of them. Every output depends only on the inputs at that moment, with no feedback and no memory, which is why each one can be written as a boolean expression and printed as a complete truth table. Anything that has to remember needs a flip-flop instead.'
		},
		{
			q: 'How do I build these in the simulator?',
			a: 'Place the gates from the Logic menu, wire them up, then use File then Create node to package the result. Once a half adder is a custom node, a full adder is two of them and an OR gate, and a four bit adder is four full adders in a row.'
		}
	];

	const page = {
		title: 'Common Logic Circuits: Adders, Multiplexers, Decoders',
		description:
			'The standard combinational building blocks with truth tables and boolean expressions: half and full adders, multiplexers, decoders, comparators and parity.',
		url: `${SITE}/common-circuits`,
		image: `${SITE}/og/common-circuits.png`,
		imageAlt: 'Logic Nodes: common circuits'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['CollectionPage', 'FAQPage'],
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
				'@type': 'ItemList',
				'@id': `${page.url}#list`,
				name: 'Common combinational circuits',
				itemListElement: commonCircuits.map((circuit, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: circuit.name,
					url: `${page.url}#${circuit.slug}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Common circuits' }
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
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/combinational-vs-sequential', label: 'Combinational vs sequential' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Common logic circuits</h1>
		<p class="lede">
			The handful of combinational blocks that everything else is assembled from. Each one is given as boolean
			expressions, with its complete truth table.
		</p>
		<ol class="toc">
			{#each built as circuit}
				<li><a href="#{circuit.slug}">{circuit.name}</a></li>
			{/each}
		</ol>
	</section>

	{#each built as circuit}
		<section id={circuit.slug}>
			<h2>{circuit.name}</h2>
			<p class="section-intro">{circuit.tagline}</p>

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
							{#each circuit.rows as row}
								<tr>
									{#each row.inputs as bit}
										<td class={bit ? 'bit-1' : 'bit-0'}>{bit ? 1 : 0}</td>
									{/each}
									{#each row.outputs as bit, i}
										<td class="out {bit ? 'bit-1' : 'bit-0'}" class:first-out={i === 0}>
											{bit ? 1 : 0}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="side">
					<dl class="equations">
						{#each circuit.outputs as output}
							<dt class="mono">{output.name}</dt>
							<dd>
								<span class="mono expr">{output.expression}</span>
								<span class="note">{output.note}</span>
							</dd>
						{/each}
					</dl>
					<p class="build"><strong>Building it.</strong> {circuit.buildTip}</p>
				</div>
			</div>

			<p>{circuit.explanation}</p>

			<ul class="uses">
				{#each circuit.uses as use}
					<li>{use}</li>
				{/each}
			</ul>
		</section>
	{/each}

	<section>
		<h2>Putting them together</h2>
		<p class="section-intro">
			None of these is interesting alone. What makes them worth knowing is that they compose, and the simulator lets you
			package each one into a node you can reuse.
		</p>
		<ul class="compose">
			<li>Two half adders and an OR make a full adder.</li>
			<li>Four full adders in a row make a four bit adder, each carry feeding the next.</li>
			<li>
				An adder with one input inverted and the first carry set to 1 becomes a subtractor, because that is two's
				complement.
			</li>
			<li>A decoder plus a set of ORs builds any function at all, straight from its truth table.</li>
			<li>
				Add a <a href="/flip-flops">flip-flop</a> and an adder becomes a counter, which is where combinational logic stops
				and sequential logic starts.
			</li>
		</ul>
		<p>
			<a class="cta" href="/simulator#example:Calculator">Open the four bit calculator</a>
		</p>
		<p class="reducer">
			Or draw any of the expressions above with the
			<a href="/logic-circuit-generator">circuit diagram generator</a>.
		</p>
	</section>

	<section>
		<h2>Reference cards</h2>
		<p class="section-intro">Every circuit above as a gate diagram, black on white, for notes or a slide.</p>
		{#each imagesFor('/common-circuits') as shot}
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

	.toc {
		list-style: none;
		padding: 0;
		margin: 1.2rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.toc a {
		display: inline-block;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.3rem 0.7rem;
		text-decoration: none;
		color: #ddd;
		font-size: 0.85rem;
	}

	.toc a:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.layout {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 16px;
		align-items: start;
		margin-bottom: 1rem;
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

	.build {
		color: #bbb;
		font-size: 0.88rem;
		margin: 0.9rem 0 0;
	}

	.build strong {
		color: #fff;
	}

	.uses {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.uses li {
		margin-bottom: 0.4rem;
	}

	.compose {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.compose li {
		margin-bottom: 0.5rem;
	}
</style>
