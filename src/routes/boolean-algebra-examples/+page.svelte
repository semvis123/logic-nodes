<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { simplificationExamples } from '$lib/simplificationExamples';
	import { simplifySteps } from '$lib/steps';
	import { lawSlug } from '$lib/laws';
	import { parseExpression, truthTable, variablesOf, format } from '$lib/boolean';

	// Every derivation is produced by the step engine, one named law per line,
	// and the test suite checks that each one reaches the minimal form. Nothing
	// on this page is typed in.
	const worked = simplificationExamples.map((example) => {
		const ast = parseExpression(example.expression);
		const working = simplifySteps(ast);
		const variables = variablesOf(ast);
		const table = truthTable(ast, variables);
		return {
			...example,
			original: format(ast, 'math'),
			working,
			variables,
			ones: table.rows.filter(Boolean).length,
			rows: table.rows.length,
			calculatorHref: `/boolean-algebra-calculator?expr=${encodeURIComponent(example.expression)}`,
			kmapHref: `/karnaugh-map-solver?expr=${encodeURIComponent(example.expression)}`
		};
	});

	const faqs = [
		{
			q: 'How do you simplify a boolean expression step by step?',
			a: 'Push any NOT that covers a bracket down onto the variables with De Morgan. Then look for a term that is a superset of another and drop it (absorption), for two terms that differ in a single literal and merge them, and for a literal that another term already makes redundant. Multiply out brackets only when nothing else applies. Repeat until no law fits; the result is a minimal sum of products.'
		},
		{
			q: 'Which boolean algebra laws are used most in simplification?',
			a: 'Absorption, which deletes a term already covered by a shorter one; redundancy, sometimes called the elimination or covering law, which drops a literal another term makes unnecessary; De Morgan, which moves negations inside brackets; distribution, which multiplies brackets out; and consensus, which removes a term that two others cover between them. The identity, idempotence and complement laws tidy up constants and repeats.'
		},
		{
			q: 'How do I know when an expression is fully simplified?',
			a: 'When no term can be dropped and no literal can be removed from any term without changing the truth table. The only certain check is the truth table itself: a minimiser such as the Karnaugh map or Quine-McCluskey finds a minimal cover from the table, and the calculator on this site compares your answer against it row by row.'
		},
		{
			q: 'Is the simplest form of a boolean expression unique?',
			a: 'Not always. Some functions have several sums of products with the same number of terms and literals, and a Karnaugh map shows this as more than one way to choose the groups. The truth table is unique; the minimal expression for it may not be.'
		},
		{
			q: 'Should I simplify by algebra or with a Karnaugh map?',
			a: 'Up to four variables a Karnaugh map is faster and harder to get wrong, because the groupings are visible. Algebra is what you need when an expression is given to you as brackets rather than as a table, when there are more than six variables, which is where maps stop being readable, and when the question asks for a derivation with the laws named.'
		}
	];

	const page = {
		title: 'Boolean Algebra Simplification Examples: Worked Step by Step',
		description: `${simplificationExamples.length} boolean expressions simplified step by step with the law named on every line, from absorption to consensus, each verified to reach the minimal form.`,
		url: `${SITE}/boolean-algebra-examples`,
		image: `${SITE}/og/boolean-algebra-examples.png`,
		imageAlt: 'LogicGates.org: boolean algebra examples'
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
					{ '@type': 'ListItem', position: 2, name: 'Boolean algebra laws', item: `${SITE}/boolean-algebra-laws` },
					{ '@type': 'ListItem', position: 3, name: 'Worked examples' }
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
		{ href: '/boolean-algebra-calculator', label: 'Simplify your own expression' },
		{ href: '/boolean-algebra-laws', label: 'All the laws, with proofs' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/boolean-algebra-laws">Boolean algebra laws</a> <span aria-hidden="true">/</span>
			<span>Worked examples</span>
		</nav>
		<h1>Boolean algebra simplification examples</h1>
		<p class="lede">
			{simplificationExamples.length} expressions simplified one law at a time, in the order you would meet them: first the
			single moves, then the ones that combine, then a few that need several rounds. Every line names the law it applied,
			and every derivation is checked against the truth table.
		</p>
		<ol class="toc">
			{#each worked as example, i}
				<li><a href="#{example.id}">{i + 1}. {example.title}</a></li>
			{/each}
		</ol>
	</section>

	<section id="method">
		<h2>The method</h2>
		<ol class="method">
			<li>
				<strong>Get the NOTs onto single variables.</strong> A NOT over a bracket blocks everything else;
				<a href="/de-morgans-laws">De Morgan</a> pushes it in.
			</li>
			<li>
				<strong>Drop what is already covered.</strong> Absorption removes a term that a shorter term makes redundant; the
				redundancy law removes a literal that another term makes unnecessary.
			</li>
			<li>
				<strong>Merge terms that differ in one literal.</strong> a ∧ b and a ∧ ¬b together are just a. This is a Karnaugh
				map group written as algebra; in named laws it is redundancy followed by absorption.
			</li>
			<li>
				<strong>Multiply out last.</strong> Distribution makes an expression bigger before it gets smaller, so only reach
				for it when nothing else applies.
			</li>
			<li>
				<strong>Check the consensus.</strong> A term covered by two others together, such as b ∧ c next to a ∧ b and ¬a ∧
				c, can go. It is the one step people miss.
			</li>
		</ol>
	</section>

	{#each worked as example, i}
		<section class="example" id={example.id}>
			<h2>{i + 1}. {example.title}</h2>
			<p class="lesson">{example.lesson}</p>
			<div class="card">
				<ol class="steps-list">
					<li>
						<span class="step-law start">Start</span>
						<span class="mono step-text">{example.original}</span>
					</li>
					{#each example.working.steps as step}
						<li>
							<a class="step-law" href="/boolean-algebra-laws#{lawSlug(step.law)}">{step.law}</a>
							<span class="mono step-text">{step.text}</span>
							<span class="step-detail">{step.detail}</span>
						</li>
					{/each}
				</ol>
				<p class="result">
					Result: <span class="mono">{example.working.text}</span>. The minimiser agrees, and the truth table has
					{example.ones} of {example.rows} rows high in both.
				</p>
				<p class="links">
					<a href={example.calculatorHref}>Open in the calculator</a>
					<a href={example.kmapHref}>See it on a Karnaugh map</a>
				</p>
			</div>
		</section>
	{/each}

	<section>
		<h2>Try your own</h2>
		<p>
			The <a href="/boolean-algebra-calculator">boolean algebra calculator</a> produces the same kind of derivation for
			any expression you type, and checks whether two expressions are equivalent. For up to six variables the
			<a href="/karnaugh-map-solver">Karnaugh map solver</a> shows the groups instead. The
			<a href="/practice?topic=simplifying">practice questions</a> generate simplification exercises with instant marking.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about simplifying</h2>
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

	.method {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.method li {
		margin-bottom: 0.5rem;
	}

	.method strong {
		color: #fff;
	}

	.lesson {
		color: #bbb;
		max-width: 700px;
	}

	.example .card {
		padding: 0.9rem 1rem 1rem;
	}

	.steps-list {
		margin: 0;
		padding-left: 1.4rem;
	}

	.steps-list li {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		gap: 0.15rem 0.9rem;
		align-items: baseline;
		margin-bottom: 0.45rem;
	}

	.step-law {
		font-size: 0.8rem;
		color: #8ede8e;
		text-decoration: none;
		border: 1px solid rgba(141, 222, 142, 0.35);
		border-radius: 3px;
		padding: 0.1rem 0.4rem;
		text-align: center;
	}

	.step-law.start {
		color: #999;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.step-text {
		color: #fff;
	}

	.step-detail {
		grid-column: 2;
		color: #999;
		font-size: 0.82rem;
	}

	.result {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0.8rem 0 0.4rem;
	}

	.result .mono {
		color: #8ede8e;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 0;
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		.steps-list li {
			grid-template-columns: 1fr;
		}

		.step-detail {
			grid-column: 1;
		}
	}
</style>
