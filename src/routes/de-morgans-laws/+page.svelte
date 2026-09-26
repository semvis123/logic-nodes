<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { demorganLaws, demorganExamples } from '$lib/demorgan';
	import { parseExpression, truthTable, variablesOf, evaluate } from '$lib/boolean';

	// Every proof on this page is generated from the expression engine, and the
	// same identities are checked in the test suite, so nothing here is typed in.
	const proven = demorganLaws.map((law) => {
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

	// The mistake everyone makes once: dropping the NOT into the bracket without
	// swapping the operator. Its table is generated too, so the row where the
	// two differ is found rather than asserted.
	const wrong = {
		left: '¬(a ∧ b)',
		right: '¬a ∧ ¬b',
		rows: [0, 1, 2, 3].map((i) => {
			const values = { a: !!(i & 2), b: !!(i & 1) };
			return {
				a: values.a,
				b: values.b,
				left: evaluate(parseExpression('¬(a ∧ b)'), values),
				right: evaluate(parseExpression('¬a ∧ ¬b'), values)
			};
		})
	};
	const differing = wrong.rows.filter((row) => row.left !== row.right);

	const faqs = [
		{
			q: "What are De Morgan's laws?",
			a: 'Two identities in boolean algebra that say how a NOT moves through a bracket. Negating an AND gives the OR of the negated terms: ¬(a ∧ b) = ¬a ∨ ¬b. Negating an OR gives the AND of the negated terms: ¬(a ∨ b) = ¬a ∧ ¬b. In short, negate every term and swap AND for OR.'
		},
		{
			q: "What is De Morgan's theorem in digital electronics?",
			a: 'The same two laws read as gates: a NAND gate is an OR gate with both inputs inverted, and a NOR gate is an AND gate with both inputs inverted. That is what lets any circuit be rebuilt from NAND gates alone or from NOR gates alone, and what engineers are doing when they push inversion bubbles around a schematic.'
		},
		{
			q: "How do you apply De Morgan's law step by step?",
			a: 'Find the NOT that covers a bracket. Remove it, put a NOT on every term inside the bracket instead, and swap the operator between the terms: AND becomes OR, OR becomes AND. If a term was already negated it now has two NOTs, which cancel. Work from the outermost bracket inwards, treating any inner bracket as a single term until it is its own turn.'
		},
		{
			q: "Do De Morgan's laws work for more than two variables?",
			a: 'Yes. ¬(a ∧ b ∧ c) = ¬a ∨ ¬b ∨ ¬c, and the same for OR, for any number of terms. It follows from applying the two-variable law repeatedly, since a ∧ b ∧ c is (a ∧ b) ∧ c. The tables on this page prove the three-variable forms directly.'
		},
		{
			q: 'Why is ¬(a ∧ b) not the same as ¬a ∧ ¬b?',
			a: 'Take a = 1 and b = 0. Then a ∧ b is 0, so ¬(a ∧ b) is 1; but ¬a ∧ ¬b is 0 ∧ 1, which is 0. The NOT cannot simply be distributed inside the bracket; the operator has to flip as well. "Not both" means "at least one is missing", which is an OR.'
		},
		{
			q: 'Who was De Morgan?',
			a: "Augustus De Morgan, a British mathematician and logician, who stated the laws formally in 1847, alongside George Boole's work. The idea itself is older: medieval logicians, William of Ockham among them, had written out the same rule in words."
		}
	];

	const page = {
		title: "De Morgan's Laws: Explained With Proofs and Worked Examples",
		description:
			"De Morgan's laws (theorem): ¬(a ∧ b) = ¬a ∨ ¬b and ¬(a ∨ b) = ¬a ∧ ¬b. Each proved with a truth table, then worked examples and NAND and NOR gates.",
		url: `${SITE}/de-morgans-laws`,
		image: `${SITE}/og/de-morgans-laws.png`,
		imageAlt: "LogicGates.org: De Morgan's laws"
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
					{ '@type': 'ListItem', position: 3, name: "De Morgan's laws" }
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
		{ href: '/boolean-algebra-laws', label: 'All the laws of boolean algebra' },
		{ href: '/boolean-algebra-examples', label: 'Worked simplification examples' },
		{ href: '/nand-nor-converter', label: 'NAND and NOR converter' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for logic statements' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' },
		{ href: '/logic-gates', label: 'The seven logic gates' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/boolean-algebra-laws">Boolean algebra laws</a> <span aria-hidden="true">/</span>
			<span>De Morgan</span>
		</nav>
		<h1>De Morgan's laws</h1>
		<p class="lede">
			Two rules for moving a NOT through a bracket. Negate an AND and you get an OR of negations; negate an OR and you
			get an AND of negations. Negate every term, swap the operator. That is the whole of it, and it is the most used
			identity in digital logic.
		</p>
	</section>

	<section id="the-laws">
		<h2>The two laws</h2>
		<div class="laws">
			{#each proven.slice(0, 2) as law}
				<div class="card law" id="law-{law.id}">
					<div class="statement">
						<span class="mono expr">{law.left}</span>
						<span class="equals" aria-label="is equivalent to">=</span>
						<span class="mono expr">{law.right}</span>
					</div>
					<p class="words">{law.words}</p>
					<p class="note">{law.gate}</p>
					<details open>
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
		<p class="reducer">
			In engineering notation the same two lines read <span class="mono">(A·B)' = A' + B'</span> and
			<span class="mono">(A+B)' = A'·B'</span>. In code, <span class="mono">!(a &amp;&amp; b)</span> is
			<span class="mono">!a || !b</span>, which is the form most programmers meet first.
		</p>
	</section>

	<section id="how-to-apply">
		<h2>How to apply them</h2>
		<p>The rule is mechanical, and it is easiest to remember as three moves on the bracket:</p>
		<ol class="moves">
			<li><strong>Take the NOT off the bracket.</strong> The bracket no longer has a bar over it.</li>
			<li>
				<strong>Negate every term inside.</strong> A term that was already negated now has two NOTs, which cancel.
			</li>
			<li><strong>Swap the operator.</strong> Every AND between those terms becomes OR, and every OR becomes AND.</li>
		</ol>
		<p>
			When brackets are nested, work from the outside in. The outer NOT sees the inner bracket as one term, so it gets a
			NOT of its own and waits. Then apply the law to that inner bracket in turn. The older mnemonic is "break the line,
			change the sign": the overbar breaks into pieces, and the operator under the break flips.
		</p>
	</section>

	<section id="worked-examples">
		<h2>Worked examples</h2>
		<p class="section-intro">
			Six derivations, each one a step at a time with the law named at every line. Every step is checked against the
			starting expression by the same engine that runs the tools on this site.
		</p>
		{#each demorganExamples as example}
			<div class="card example" id={example.id}>
				<h3>{example.title}</h3>
				<p class="why">{example.why}</p>
				<ol class="steps">
					{#each example.steps as step, i}
						<li>
							<span class="mono expr">{step.expression}</span>
							{#if i > 0}
								<span class="rule">{step.rule}</span>
							{/if}
						</li>
					{/each}
				</ol>
			</div>
		{/each}
		<p class="reducer">
			Want to see one on your own expression? The <a href="/boolean-algebra-calculator">boolean algebra calculator</a>
			shows every law it applies, and can confirm that any two of the lines above are equivalent.
		</p>
	</section>

	<section id="more-variables">
		<h2>More than two variables</h2>
		<p>
			The laws hold for any number of terms, because a ∧ b ∧ c is just (a ∧ b) ∧ c and the two-variable law can be
			applied twice. In practice you treat the whole chain at once: negate every term, swap every operator.
		</p>
		<div class="laws">
			{#each proven.slice(2) as law}
				<div class="card law" id="law-{law.id}">
					<div class="statement">
						<span class="mono expr">{law.left}</span>
						<span class="equals" aria-label="is equivalent to">=</span>
						<span class="mono expr">{law.right}</span>
					</div>
					<p class="note">{law.gate}</p>
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

	<section id="in-circuits">
		<h2>In circuits: bubble pushing</h2>
		<p>
			On a schematic the laws are drawn rather than written. The small circle on a gate's pin means invert, and De
			Morgan says you may move a bubble from the output of a gate to all of its inputs as long as you swap the gate's
			shape at the same time.
		</p>
		<ul class="bubbles">
			<li>
				A <a href="/logic-gates/nand">NAND</a> gate, an AND with a bubbled output, is the same part as an OR with both
				inputs bubbled: <span class="mono">¬(a ∧ b) = ¬a ∨ ¬b</span>.
			</li>
			<li>
				A <a href="/logic-gates/nor">NOR</a> gate, an OR with a bubbled output, is an AND with both inputs bubbled:
				<span class="mono">¬(a ∨ b) = ¬a ∧ ¬b</span>.
			</li>
			<li>
				Two bubbles on one wire cancel, so a NAND driving a gate with bubbled inputs can be redrawn as a plain AND
				driving a plain gate.
			</li>
		</ul>
		<p>
			Engineers use this to make a schematic read the way the design was thought about, with active-low signals shown as
			bubbles rather than as extra inverters. It is also why <a href="/logic-gates#universal-gates"
				>NAND and NOR are universal</a
			>: the OR that NAND seems to lack is a NAND with its inputs inverted, which is the "OR gate from NAND gates"
			example above. The
			<a href="/nand-nor-converter">NAND and NOR converter</a> applies the laws to a whole expression and counts the gates.
		</p>
	</section>

	<section id="common-mistake">
		<h2>The common mistake</h2>
		<p>
			The error nearly everyone makes once is to push the NOT inside the bracket and leave the operator alone, writing
			<span class="mono">{wrong.left}</span> as <span class="mono">{wrong.right}</span>. The table shows where it goes
			wrong.
		</p>
		<div class="table-wrap">
			<table class="data-table proof mistake">
				<thead>
					<tr>
						<th scope="col" class="mono">a</th>
						<th scope="col" class="mono">b</th>
						<th scope="col" class="mono">{wrong.left}</th>
						<th scope="col" class="mono">{wrong.right}</th>
					</tr>
				</thead>
				<tbody>
					{#each wrong.rows as row}
						<tr class:differs={row.left !== row.right}>
							<td class={row.a ? 'bit-1' : 'bit-0'}>{row.a ? 1 : 0}</td>
							<td class={row.b ? 'bit-1' : 'bit-0'}>{row.b ? 1 : 0}</td>
							<td class={row.left ? 'bit-1' : 'bit-0'}>{row.left ? 1 : 0}</td>
							<td class={row.right ? 'bit-1' : 'bit-0'}>{row.right ? 1 : 0}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="verdict">
			The two differ on {differing.length} of 4 rows. "Not both a and b" is true whenever either one is missing; "not a and
			not b" needs both to be missing. The first is an OR of the negations, and only the OR is right.
		</p>
	</section>

	<section id="history">
		<h2>Where the name comes from</h2>
		<p>
			Augustus De Morgan (1806–1871) was a British mathematician and logician, a contemporary and correspondent of
			George Boole, and he stated the laws formally in his <em>Formal Logic</em> of 1847; the algebraic notation used here
			came with the Boolean algebra that followed. The observation itself is much older: medieval logicians knew it, and
			William of Ockham wrote out the same rule in words in the fourteenth century. What De Morgan added was the algebra,
			which is what makes the rule mechanical enough to build circuits with.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about De Morgan's laws</h2>
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

	.laws {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 12px;
	}

	.law {
		padding: 0.9rem 1rem 1rem;
	}

	.statement {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.expr {
		color: #8ede8e;
		font-size: 1.05rem;
	}

	.equals {
		color: #999;
	}

	.words {
		color: #fff;
		margin: 0.3rem 0;
	}

	.note {
		color: #bbb;
		font-size: 0.88rem;
		margin: 0.3rem 0 0.6rem;
	}

	.law details {
		margin-top: 0.4rem;
	}

	.law summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: #8ede8e;
	}

	.proof {
		margin-top: 0.6rem;
		font-size: 0.85rem;
	}

	.verdict {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
	}

	.moves {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.moves li {
		margin-bottom: 0.5rem;
	}

	.moves strong {
		color: #fff;
	}

	.example {
		padding: 0.9rem 1rem 1rem;
		margin-bottom: 12px;
	}

	.example h3 {
		margin: 0 0 0.3rem;
	}

	.why {
		color: #bbb;
		font-size: 0.88rem;
		margin: 0 0 0.6rem;
	}

	.steps {
		margin: 0;
		padding-left: 1.4rem;
		color: #ddd;
	}

	.steps li {
		margin-bottom: 0.35rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.9rem;
		align-items: baseline;
	}

	.steps .expr {
		font-size: 1rem;
	}

	.rule {
		color: #999;
		font-size: 0.82rem;
	}

	.bubbles {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.bubbles li {
		margin-bottom: 0.5rem;
	}

	.mistake .differs td {
		background: rgba(255, 34, 51, 0.12);
	}
</style>
