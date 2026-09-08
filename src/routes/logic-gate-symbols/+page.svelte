<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { imagesFor } from '$lib/generatedImages';
	import { modifiedFields } from '$lib/lastmod';
	import GateSymbol from '$lib/GateSymbol.svelte';
	import { gates } from '$lib/gates';
	import { shapes } from '$lib/symbols';

	let standard: 'ansi' | 'iec' = 'ansi';

	const rows = gates.map((gate) => ({ ...gate, shape: shapes[gate.slug] }));

	const faqs = [
		{
			q: 'What is the difference between ANSI and IEC logic gate symbols?',
			a: 'The distinctive shapes give each gate its own outline: a D for AND, a shield for OR, a triangle for NOT. They come from MIL-STD-806 and are kept in ANSI/IEEE Std 91-1984, which is why they are usually just called the ANSI symbols — though that standard defines rectangular forms too. IEC 60617-12 uses one rectangle for every gate with a label inside saying what it does: & for AND, ≥1 for OR, 1 for a buffer, =1 for XOR. American schematics tend to use ANSI, European and formal standards documents tend to use IEC.'
		},
		{
			q: 'What does the little circle on a gate symbol mean?',
			a: 'That bubble means inversion. An AND with a bubble on its output is a NAND; an OR with one is a NOR; the triangle with a bubble is a NOT gate. A bubble on an input means that input is active low, so it is inverted before the gate acts on it.'
		},
		{
			q: 'How do I tell AND and OR apart?',
			a: 'The AND symbol has a flat back and a smooth semicircular nose, like a capital D. The OR symbol has a curved back and comes to a point. The trick people use is that AND is flat at the back, and OR is curved at both ends.'
		},
		{
			q: 'How is XOR drawn?',
			a: 'Exactly like OR, with a second curved line drawn just behind the back of the shape. That extra line is the only difference, so it is worth looking twice at a busy schematic. In IEC form the rectangle is labelled =1, meaning exactly one input is high.'
		}
	];

	const page = {
		title: 'Logic Gate Symbols: ANSI and IEC Shapes Compared',
		description:
			'Every logic gate symbol in both standards, ANSI distinctive shapes and IEC rectangles, with what the inversion bubble means and each truth table.',
		url: `${SITE}/logic-gate-symbols`,
		image: `${SITE}/og/logic-gate-symbols.png`,
		imageAlt: 'Logic Nodes: logic gate symbols'
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
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
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

	<section>
		<h2>The six symbols</h2>
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
				across its back, which is easy to miss on a dense drawing.
			{:else}
				In IEC form every gate is the same rectangle and only the label changes: <span class="mono">&amp;</span>
				for AND, <span class="mono">≥1</span> for OR, <span class="mono">1</span> for a buffer and
				<span class="mono">=1</span> for XOR. Inversion is still a bubble on the output.
			{/if}
		</p>
	</section>

	<section>
		<h2>Side by side</h2>
		<p class="section-intro">The same gate in both standards, with the boolean expression and what the output does.</p>
		<div class="table-wrap">
			<table class="data-table compare">
				<thead>
					<tr>
						<th scope="col">Gate</th>
						<th scope="col">ANSI</th>
						<th scope="col">IEC</th>
						<th scope="col">Expression</th>
						<th scope="col">Output is high when</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as gate}
						<tr>
							<th scope="row"><a href="/logic-gates/{gate.slug}">{gate.name}</a></th>
							<td class="cell-symbol"><GateSymbol gate={gate.slug} standard="ansi" label="" /></td>
							<td class="cell-symbol"><GateSymbol gate={gate.slug} standard="iec" label="" /></td>
							<td class="mono">{gate.symbol}</td>
							<td>{gate.outputHigh}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>The bubble</h2>
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
				<a href="/boolean-algebra-laws">De Morgan's law</a> drawn rather than written.
			</li>
			<li>
				<strong>On a clock pin</strong> of a <a href="/flip-flops">flip-flop</a>, it means the part triggers on the
				falling edge rather than the rising one.
			</li>
		</ul>
		<p class="reducer">
			This is why experienced engineers redraw gates with bubbles moved around: pushing bubbles through a gate swaps AND
			for OR and often makes a schematic read more directly.
		</p>
	</section>

	<section>
		<h2>Which should I use?</h2>
		<p>
			If you are drawing for other people, match whatever they already use. American textbooks, datasheets and most
			schematic capture tools default to the ANSI shapes, and they have a real advantage: the outline tells you the
			function at a glance, even at small sizes or in a photocopy. IEC rectangles win when a part has many inputs or
			unusual behaviour, because there is always room for a label, and they are what international standards documents
			expect.
		</p>
		<p>
			Logic Nodes itself uses neither. The editor draws every node as a labelled box, which is closer to IEC in spirit
			and keeps custom nodes and gates looking consistent.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
	</section>

	<section>
		<h2>Reference card</h2>
		<p class="section-intro">All six gates in both standards on one image, for notes or a slide.</p>
		{#each imagesFor('/logic-gate-symbols') as shot}
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

	.cell-symbol {
		width: 110px;
		min-width: 110px;
		padding: 0.4rem 0.6rem;
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
