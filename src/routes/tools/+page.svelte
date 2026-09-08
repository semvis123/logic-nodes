<script lang="ts">
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { tools } from '$lib/tools';

	const SITE = 'https://nodes.kriyak.com';

	const page = {
		title: 'Digital Logic Tools: Truth Tables, K-Maps, Boolean Algebra',
		description:
			'Seven free tools for digital logic: truth tables, boolean simplification, Karnaugh maps, SOP and POS, NAND conversion, circuit diagrams and Gray code.',
		url: `${SITE}/tools`,
		image: `${SITE}/og/tools.png`,
		imageAlt: 'Logic Nodes: tools'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'CollectionPage',
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
				name: 'Digital logic tools',
				itemListElement: tools.map((tool, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: tool.name,
					description: tool.blurb,
					url: `${SITE}${tool.href}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Tools' }
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
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' }
	]}
>
	<section class="intro">
		<h1>Digital logic tools</h1>
		<p class="lede">
			Seven calculators for the things you actually have to work out: truth tables, simplification, Karnaugh maps,
			canonical forms, universal gates, gate diagrams and Gray code. All free, all in your browser, nothing uploaded.
		</p>
	</section>

	<section>
		<h2>The tools</h2>
		<div class="grid">
			{#each tools as tool}
				<a class="card tool" href={tool.href}>
					<h3>{tool.name}</h3>
					<p>{tool.blurb}</p>
					<span class="more">Open →</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<h2>Which one do I want?</h2>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">If you have</th>
						<th scope="col">And you want</th>
						<th scope="col">Use</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">An expression</th>
						<td>every input combination listed</td>
						<td><a href="/truth-table-generator">Truth table generator</a></td>
					</tr>
					<tr>
						<th scope="row">A long expression</th>
						<td>the shortest equivalent</td>
						<td><a href="/boolean-algebra-calculator">Boolean algebra calculator</a></td>
					</tr>
					<tr>
						<th scope="row">Two expressions</th>
						<td>to know whether they match</td>
						<td><a href="/boolean-algebra-calculator">Boolean algebra calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A homework K-map</th>
						<td>the groups drawn and named</td>
						<td><a href="/karnaugh-map-solver">Karnaugh map solver</a></td>
					</tr>
					<tr>
						<th scope="row">A truth table</th>
						<td>minterms, maxterms, SOP or POS</td>
						<td><a href="/sum-of-products-calculator">Sum of products calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A circuit design</th>
						<td>it rebuilt from one gate type</td>
						<td><a href="/nand-nor-converter">NAND and NOR converter</a></td>
					</tr>
					<tr>
						<th scope="row">A counter or encoder</th>
						<td>a one-bit-at-a-time sequence</td>
						<td><a href="/gray-code-converter">Gray code converter</a></td>
					</tr>
					<tr>
						<th scope="row">An idea</th>
						<td>to build and run it</td>
						<td><a href="/simulator">The simulator</a></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>They all share one engine</h2>
		<p class="section-intro">
			The same parser and minimiser sits behind every tool here, so an expression you type into one means exactly the
			same thing in the next. It accepts whichever notation you use —
			<span class="mono">a·b</span>, <span class="mono">a&amp;b</span>,
			<span class="mono">a∧b</span>, <span class="mono">ab</span> — and the simplification is Quine-McCluskey, the same algorithm
			whether you see it as algebra or as groups on a map.
		</p>
		<p class="reducer">
			It is covered by a property-based test suite: thousands of generated expressions are simplified and then
			re-checked against their original truth table, so a wrong answer fails the build.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 64px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
	}

	.tool {
		padding: 1rem 1.1rem 1.1rem;
		text-decoration: none;
		display: block;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.tool:hover {
		border-color: rgba(255, 255, 255, 0.75);
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.tool,
		.tool:hover {
			transition: none;
			transform: none;
		}
	}

	.tool h3 {
		color: #fff;
	}

	.tool p {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 0.6rem;
	}

	.more {
		color: #8ede8e;
		font-size: 0.8rem;
	}
</style>
