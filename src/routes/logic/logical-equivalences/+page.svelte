<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parsePropInput, propTable } from '$lib/propositional';
	import {
		basicLaws,
		conditionalLaws,
		biconditionalLaws,
		nonLaws,
		equivalenceChains,
		equivalentText,
		type Law
	} from '$lib/logicReference';
	import { toolLink } from '$lib/urlState';

	const calc = (s: string) => toolLink('/propositional-logic-truth-table', { s });

	// Every pair is checked at build time; the tick is shown only for pairs the
	// engine confirms, and a pair it rejects is left off the page.
	const checked = (laws: Law[]) =>
		laws
			.map((law) => ({
				...law,
				pairs: law.pairs
					.filter(([a, b]) => equivalentText(a, b))
					.map(([a, b]) => ({ left: a, right: b, link: calc(`${a}, ${b}`) }))
			}))
			.filter((law) => law.pairs.length);

	const groups = [
		{ id: 'basic', title: 'The laws of logic', laws: checked(basicLaws) },
		{ id: 'conditional', title: 'Equivalences with conditionals', laws: checked(conditionalLaws) },
		{ id: 'biconditional', title: 'Equivalences with biconditionals', laws: checked(biconditionalLaws) }
	];

	const negations = [
		['¬¬p', 'p'],
		['¬(p ∧ q)', '¬p ∨ ¬q'],
		['¬(p ∨ q)', '¬p ∧ ¬q'],
		['¬(p → q)', 'p ∧ ¬q'],
		['¬(p ↔ q)', 'p ↔ ¬q'],
		['¬(p ⊕ q)', 'p ↔ q']
	]
		.filter(([a, b]) => equivalentText(a, b))
		.map(([left, right]) => ({ left, right }));

	const beach = equivalentText('¬(s → b ∧ c)', 's ∧ ¬(b ∧ c)') && equivalentText('s ∧ ¬(b ∧ c)', 's ∧ (¬b ∨ ¬c)');

	// Look-alikes that fail, each with the first row where the sides differ.
	const traps = nonLaws
		.map((n) => {
			const table = propTable(parsePropInput(`${n.left}, ${n.right}`));
			const [a, b] = table.statements;
			const row = table.rows.findIndex((_, r) => a.values[r] !== b.values[r]);
			const at =
				row === -1 ? '' : table.variables.map((v, j) => `${v} ${table.rows[row][j] ? 'true' : 'false'}`).join(', ');
			return { ...n, at, link: calc(`${n.left}, ${n.right}`) };
		})
		.filter((n) => n.at);

	const chains = equivalenceChains
		.map((c) => ({
			...c,
			ok: c.steps.slice(1).every((s, i) => equivalentText(c.steps[i].statement, s.statement))
		}))
		.filter((c) => c.ok);

	const faqs = [
		{
			q: 'What does it mean for two statements to be logically equivalent?',
			a: 'Two statements are logically equivalent when they have the same truth value in every row of their truth table, so each can replace the other anywhere without changing the meaning. It is written A ≡ B, and holds exactly when A ↔ B is a tautology.'
		},
		{
			q: 'What are the laws of logic?',
			a: "The laws of logic are the standard logical equivalences: identity, domination, idempotent, double negation, commutative, associative, distributive, De Morgan's, absorption and negation, plus the equivalences for conditionals and biconditionals. The three classical laws of thought are the law of identity, the law of non-contradiction and the law of excluded middle."
		},
		{
			q: 'How do you prove that two statements are logically equivalent?',
			a: 'Either build a truth table and check that the two columns match in every row, or start from one statement and rewrite it with known equivalences, one law per step, until you reach the other. To prove they are not equivalent, find one row where they differ.'
		},
		{
			q: 'What is the difference between ≡ and ↔?',
			a: 'p ↔ q is a statement inside the logic: it is true in some rows and false in others. p ≡ q is a claim about two statements: that p ↔ q is true in every row. Some books use ⇔ for either one, so check the conventions of your course.'
		},
		{
			q: 'Is p → q equivalent to ¬p ∨ q?',
			a: 'Yes. Both are false in exactly one row, where p is true and q is false. This equivalence, often called material implication, is the usual first step when simplifying a statement with arrows in it, because the other laws are about ∧, ∨ and ¬.'
		},
		{
			q: 'Are the laws of logic the same as the laws of boolean algebra?',
			a: 'Yes, in different notation. Boolean algebra writes ∧ as multiplication, ∨ as +, ¬p as p′ and ⊤ and ⊥ as 1 and 0, so p ∧ (q ∨ r) ≡ (p ∧ q) ∨ (p ∧ r) becomes p(q + r) = pq + pr. The conditional has no boolean operator of its own and is written ¬p + q.'
		}
	];

	const page = {
		title: 'Logical Equivalences: The Laws of Logic With Proofs',
		description:
			"The table of logical equivalences: De Morgan's, distributive, absorption, conditional and biconditional laws, each one checked by truth table.",
		url: `${SITE}/logic/logical-equivalences`,
		image: `${SITE}/og/logic-logical-equivalences.png`,
		imageAlt: 'LogicGates.org: the table of logical equivalences'
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
					{ '@type': 'ListItem', position: 2, name: 'Logic', item: `${SITE}/logic` },
					{ '@type': 'ListItem', position: 3, name: 'Logical equivalences' }
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
		{ href: '/logic', label: 'Propositional logic' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' },
		{ href: '/logic/conditional-statements', label: 'Conditional statements' },
		{ href: '/logic/tautology', label: 'Tautologies' },
		{ href: '/logic/rules-of-inference', label: 'Rules of inference' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/set-notation', label: 'The same laws for sets' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<a href="/logic">Logic</a> <span aria-hidden="true">›</span>
			<span>Logical equivalences</span>
		</nav>
		<h1>Logical equivalences</h1>
		<p class="lede">
			The laws of logic: pairs of statements that are true in exactly the same cases, so either can replace the other.
			Every law in these tables was checked by truth table when this page was built.
		</p>
	</section>

	<section id="meaning">
		<h2>What logical equivalence means</h2>
		<p>
			Two statements A and B are <strong>logically equivalent</strong>, written <span class="mono">A ≡ B</span>, when
			they have the same truth value in every row of their truth table. Equivalently, the statement
			<span class="mono">A ↔ B</span> is a <a href="/logic/tautology">tautology</a>. Because the two sides never
			disagree, you may swap one for the other anywhere, even inside a larger statement, and the meaning does not
			change. That is what makes the laws below useful: they are the moves allowed when simplifying a statement or
			proving two statements say the same.
		</p>
	</section>

	{#each groups as group}
		<section id={group.id}>
			<h2>{group.title}</h2>
			{#if group.id === 'basic'}
				<p class="section-intro">
					Most laws come in pairs, one for ∧ and one for ∨. Swap ∧ with ∨ and ⊤ with ⊥ in one and you get the other,
					which is the principle of <strong>duality</strong>.
				</p>
			{:else if group.id === 'conditional'}
				<p class="section-intro">
					These remove or reshape arrows. The first is used most: it turns any conditional into ∧, ∨ and ¬, where the
					basic laws apply. See <a href="/logic/conditional-statements">conditional statements</a> for what the arrow means.
				</p>
			{:else}
				<p class="section-intro">
					A biconditional is two conditionals, so it can always be taken apart into ∧, ∨ and ¬.
				</p>
			{/if}
			<div class="table-wrap">
				<table class="data-table laws">
					<thead>
						<tr>
							<th scope="col">Name</th>
							<th scope="col">Equivalence</th>
							<th scope="col" class="checked-head">Checked</th>
						</tr>
					</thead>
					<tbody>
						{#each group.laws as law}
							{#each law.pairs as pair, i}
								<tr class:cont={i > 0}>
									{#if i === 0}<th scope="row" rowspan={law.pairs.length}>{law.name}</th>{/if}
									<td class="mono eq">
										<span>{pair.left}</span> <span class="equiv">≡</span> <span>{pair.right}</span>
									</td>
									<td class="checked"
										><a href={pair.link} aria-label="Checked by truth table: {pair.left} ≡ {pair.right}"
											>✓<span class="long">&nbsp;by truth table</span></a
										></td
									>
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}

	<section id="negation">
		<h2>How to negate a statement</h2>
		<p class="section-intro">
			To negate a compound statement, push the ¬ inwards with these, one connective at a time:
		</p>
		<div class="table-wrap">
			<table class="data-table laws">
				<thead>
					<tr>
						<th scope="col">Negation</th>
						<th scope="col">Is equivalent to</th>
						<th scope="col" class="checked-head">Checked</th>
					</tr>
				</thead>
				<tbody>
					{#each negations as n}
						<tr>
							<td class="mono">{n.left}</td>
							<td class="mono">{n.right}</td>
							<td class="checked"
								><a href={calc(`${n.left}, ${n.right}`)} aria-label="Checked by truth table: {n.left} ≡ {n.right}"
									>✓<span class="long">&nbsp;by truth table</span></a
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if beach}<p>
				For example, the negation of "if it is sunny, we go to the beach and have a picnic" is
				<span class="mono">¬(s → b ∧ c) ≡ s ∧ ¬(b ∧ c) ≡ s ∧ (¬b ∨ ¬c)</span>: it is sunny, and we skip the beach or
				skip the picnic.
			</p>{/if}
	</section>

	<section id="not-equivalent">
		<h2>Look-alikes that are not equivalent</h2>
		<p class="section-intro">
			Each of these pairs differs in at least one row, found by the engine. One row is enough to show two statements are
			not equivalent.
		</p>
		<div class="table-wrap">
			<table class="data-table laws">
				<thead>
					<tr>
						<th scope="col">Pair</th>
						<th scope="col">Differ when</th>
						<th scope="col">Why</th>
					</tr>
				</thead>
				<tbody>
					{#each traps as t}
						<tr>
							<td class="mono eq"
								><a href={t.link}><span>{t.left}</span> <span class="equiv not">≢</span> <span>{t.right}</span></a></td
							>
							<td>{t.at}</td>
							<td>{t.why}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="proving">
		<h2>How to prove two statements are equivalent</h2>
		<p>There are two ways, and both are proofs.</p>
		<ol class="list">
			<li>
				<strong>Truth table.</strong> Write both statements as columns and check that they agree in every row. It always
				works, but the table doubles with every new letter.
			</li>
			<li>
				<strong>Chain of laws.</strong> Start from one side and rewrite it, one law per line, until you reach the other.
				Each line is equivalent to the one before, so the first is equivalent to the last. This is shorter for statements
				with many letters and shows why the equivalence holds.
			</li>
		</ol>
		{#each chains as chain}
			<div class="card chain">
				<h3>{chain.title}</h3>
				<table class="chain-table">
					<tbody>
						{#each chain.steps as step, i}
							<tr>
								<td class="sym">{i === 0 ? '' : '≡'}</td>
								<td class="mono">{step.statement}</td>
								<td class="law">{step.law}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
		<p>
			Each line of both chains was checked against the line before when this page was built. A statement that reduces to
			⊤ is a tautology, as in the second chain. To check your own pair, use the
			<a href="/logical-equivalence-calculator">logical equivalence calculator</a>, or put both statements, separated by
			a comma, into the <a href={calc('p → q, ¬p ∨ q, ¬q → ¬p')}>truth table calculator</a>.
		</p>
	</section>

	<section id="boolean">
		<h2>The same laws in boolean algebra</h2>
		<p>
			Digital electronics uses exactly these laws, written with 1 and 0 for ⊤ and ⊥, + for ∨, multiplication for ∧ and a
			bar or prime for ¬. The distributive law <span class="mono">p ∧ (q ∨ r) ≡ (p ∧ q) ∨ (p ∧ r)</span> is
			<span class="mono">p(q + r) = pq + pr</span>. See the <a href="/boolean-algebra-laws">laws of boolean algebra</a>
			for that notation and <a href="/de-morgans-laws">De Morgan's laws</a> for the pair used most in circuit design.
			The <a href="/logic/rules-of-inference">rules of inference</a> build on these: a proof may use any law in this table
			to rewrite a line.
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

	.crumbs {
		font-size: 0.8rem;
		color: #999;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #999;
	}

	.laws {
		width: 100%;
	}

	.laws th[scope='row'] {
		color: #fff;
		white-space: nowrap;
		vertical-align: top;
	}

	.laws tr.cont td {
		border-top: none;
	}

	.eq {
		color: #fff;
	}

	/* Each side stays whole; on a phone the line breaks at the ≡. */
	.eq > span,
	.eq a > span {
		white-space: nowrap;
	}

	@media (max-width: 600px) {
		.laws th[scope='row'] {
			white-space: normal;
		}

		/* The tick is enough on a phone; the column header says what it means. */
		.checked .long {
			display: none;
		}
	}

	.eq a {
		text-decoration: none;
		color: #fff;
	}

	.equiv {
		color: #8ede8e;
		padding: 0 0.3rem;
	}

	.equiv.not {
		color: #ff8a8a;
	}

	.checked {
		white-space: nowrap;
		font-size: 0.8rem;
		text-align: right;
	}

	.laws th.checked-head {
		text-align: right;
	}

	.checked a {
		color: #8ede8e;
		text-decoration: none;
	}

	.checked a:hover {
		text-decoration: underline;
	}

	.list {
		color: #ddd;
		padding-left: 1.25rem;
		max-width: 700px;
	}

	.list li {
		margin-bottom: 0.6rem;
	}

	.chain {
		padding: 0.9rem 1rem;
		margin-bottom: 12px;
		overflow-x: auto;
	}

	.chain h3 {
		color: #fff;
		margin-bottom: 0.6rem;
	}

	.chain-table {
		border-collapse: collapse;
	}

	.chain-table td {
		padding: 0.2rem 0.6rem 0.2rem 0;
		vertical-align: top;
	}

	.chain-table .sym {
		color: #8ede8e;
		width: 1rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.chain-table .mono {
		color: #fff;
		white-space: nowrap;
		padding-right: 1.5rem;
	}

	.chain-table .law {
		color: #aaa;
		font-size: 0.85rem;
	}
</style>
