<script lang="ts">
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { laws, lawCategories, lawSlug } from '$lib/laws';

	import { parseExpression, truthTable, variablesOf } from '$lib/boolean';

	const SITE = 'https://nodes.kriyak.com';

	// Each law gets a generated proof: both sides evaluated over every row.
	const proven = laws.map((law) => {
		const left = parseExpression(law.left);
		const right = parseExpression(law.right);
		const variables = [...new Set([...variablesOf(left), ...variablesOf(right)])].sort();
		const l = truthTable(left, variables);
		const r = truthTable(right, variables);
		return {
			...law,
			variables,
			rows: l.rows.map((value, i) => ({ index: i, left: value, right: r.rows[i] })),
			holds: l.rows.every((value, i) => value === r.rows[i])
		};
	});

	// Several laws share a name (Identity has three forms). Only the first one
	// gets the anchor, so a link to it lands on the top of that group. It has to
	// look in `proven`, since those are the objects the template iterates.
	const firstOf = (name: string) => proven.find((law) => law.name === name);

	const grouped = lawCategories.map((category) => ({
		category,
		items: proven.filter((law) => law.category === category)
	}));

	const faqs = [
		{
			q: 'What are the laws of boolean algebra?',
			a: 'A set of identities that let you rewrite a logic expression without changing what it computes. The core ones are identity, annulment, idempotence, complement, commutativity, associativity, distributivity, absorption and De Morgan. Together they are what circuit minimisation is built on.'
		},
		{
			q: 'How is boolean algebra different from ordinary algebra?',
			a: 'Variables take only two values, there is no subtraction or division, and OR distributes over AND as well as the other way round, which has no equivalent in ordinary arithmetic. Absorption and idempotence have no counterpart either: a + a is a, not 2a.'
		},
		{
			q: "What are De Morgan's laws?",
			a: 'They say that negating a bracket swaps the operator inside it: not (a and b) equals not a or not b, and not (a or b) equals not a and not b. They are what lets any circuit be rebuilt from NAND gates alone, or from NOR gates alone.'
		},
		{
			q: 'How do I prove a boolean identity?',
			a: 'Build the truth table for both sides and check every row matches. With n variables that is 2^n rows, so it is exhaustive rather than a sample, which makes it a genuine proof. Every law on this page is shown with its table, and the calculator will check your own expressions the same way.'
		}
	];

	const page = {
		title: 'Boolean Algebra Laws: Every Rule, With Proofs',
		description:
			'The laws of boolean algebra — De Morgan, distributive, absorption, consensus and the rest — each stated and proved with a full truth table.',
		url: `${SITE}/boolean-algebra-laws`,
		image: `${SITE}/og/boolean-algebra-laws.png`,
		imageAlt: 'Logic Nodes: boolean algebra laws'
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
					{ '@type': 'ListItem', position: 2, name: 'Boolean algebra laws' }
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
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/sum-of-products-calculator', label: 'Sum of products calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>The laws of boolean algebra</h1>
		<p class="lede">
			{laws.length} identities for rewriting logic without changing what it does. Each one is shown with the truth table
			that proves it, generated here rather than typed out.
		</p>
		<p class="reducer">
			Want to check your own? The <a href="/boolean-algebra-calculator">calculator</a> compares any two expressions row by
			row.
		</p>
	</section>

	{#each grouped as group}
		<section id={group.category.toLowerCase().replace(/\s+/g, '-')}>
			<h2>{group.category}</h2>
			<div class="laws">
				{#each group.items as law}
					<!-- The first card of each name carries the anchor, so a derivation
					     elsewhere on the site can link straight to the law it used. -->
					<div class="card law" id={firstOf(law.name) === law ? lawSlug(law.name) : undefined}>
						<div class="statement">
							<span class="mono expr">{law.left}</span>
							<span class="equals" aria-label="is equivalent to">=</span>
							<span class="mono expr">{law.right}</span>
							<span class="law-name">{law.name}</span>
						</div>
						<p class="note">{law.note}</p>
						<details>
							<summary>Proof</summary>
							<div class="table-wrap">
								<table class="data-table proof">
									<thead>
										<tr>
											{#each law.variables as variable}
												<th scope="col" class="mono">{variable}</th>
											{/each}
											<th scope="col" class="mono">{law.left}</th>
											<th scope="col" class="mono">{law.right}</th>
										</tr>
									</thead>
									<tbody>
										{#each law.rows as row}
											<tr>
												{#each law.variables as _, bit}
													{@const on = !!(row.index & (1 << (law.variables.length - 1 - bit)))}
													<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
												{/each}
												<td class={row.left ? 'bit-1' : 'bit-0'}>{row.left ? 1 : 0}</td>
												<td class={row.right ? 'bit-1' : 'bit-0'}>{row.right ? 1 : 0}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							<p class="verdict">
								{law.holds
									? `Both columns match on all ${law.rows.length} rows, so the identity holds.`
									: 'These columns do not match.'}
							</p>
						</details>
					</div>
				{/each}
			</div>
		</section>
	{/each}

	<section>
		<h2>Using them</h2>
		<p class="section-intro">
			The laws are how a circuit gets smaller. In practice you rarely apply them one at a time by hand past three or
			four variables, but knowing them is what lets you read someone else's simplification and see why it works.
		</p>
		<ul class="uses">
			<li>
				<strong>Absorption and redundancy</strong> delete whole terms, so they are the ones worth spotting first.
			</li>
			<li>
				<strong>Adjacency</strong> is the algebraic form of circling two squares on a
				<a href="/karnaugh-map-solver">Karnaugh map</a>: one variable takes both values and cancels.
			</li>
			<li>
				<strong>De Morgan</strong> converts between AND and OR forms, which is what makes
				<a href="/nand-nor-converter">NAND-only and NOR-only circuits</a> possible.
			</li>
			<li>
				<strong>Consensus</strong> is the one people miss by hand: a term that looks necessary is already covered by two
				others.
			</li>
		</ul>
		<p>
			<a class="cta" href="/boolean-algebra-calculator">Simplify an expression</a>
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

	.laws {
		display: grid;
		gap: 10px;
	}

	.law {
		padding: 0.85rem 1rem 0.9rem;
	}

	.statement {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.expr {
		color: #fff;
		font-size: 1rem;
	}

	.equals {
		color: #8ede8e;
	}

	.law-name {
		margin-left: auto;
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.note {
		color: #bbb;
		font-size: 0.88rem;
		margin: 0.5rem 0 0.6rem;
	}

	.law summary {
		cursor: pointer;
		color: #8ede8e;
		font-size: 0.82rem;
	}

	.proof {
		margin-top: 0.6rem;
		font-size: 0.85rem;
	}

	.proof th,
	.proof td {
		text-align: center;
	}

	.verdict {
		color: #888;
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
	}

	.uses {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.uses li {
		margin-bottom: 0.6rem;
	}

	.uses strong {
		color: #fff;
	}
</style>
