<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parsePropInput, propTable } from '$lib/propositional';
	import {
		famousTautologies,
		classificationExamples,
		classifyText,
		checkArgumentText,
		asConditional,
		argumentText,
		rules,
		fallacies
	} from '$lib/logicReference';
	import { toolLink } from '$lib/urlState';

	const calc = (s: string) => toolLink('/propositional-logic-truth-table', { s });
	const tf = (v: boolean) => (v ? 'T' : 'F');

	const examples = classificationExamples.map((s) => {
		const c = classifyText(s);
		return { s, ...c, values: c.table.statements[0].values, rows: c.table.rows.length };
	});

	const workedStatement = 'p ∧ q → p ∨ q';
	const worked = propTable(parsePropInput(workedStatement));
	const workedKind = classifyText(workedStatement).kind;

	// Only the ones the engine confirms are listed.
	const famous = famousTautologies
		.map((t) => ({ ...t, ...classifyText(t.statement) }))
		.filter((t) => t.kind === 'tautology');

	// Arguments next to their conditionals: valid exactly when the conditional
	// is a tautology.
	const pick = (id: string) => [...rules, ...fallacies].find((r) => r.id === id)!;
	const arguments_ = ['modus-ponens', 'hypothetical-syllogism', 'affirming-the-consequent', 'denying-the-antecedent']
		.map(pick)
		.map((r) => {
			const conditional = asConditional(r.premises, r.conclusion);
			return {
				name: r.name,
				argument: argumentText(r.premises, r.conclusion),
				conditional,
				valid: checkArgumentText(r.premises, r.conclusion).valid,
				kind: classifyText(conditional).kind
			};
		});

	const deMorgan = classifyText('¬(p ∧ q) ↔ ¬p ∨ ¬q');

	const faqs = [
		{
			q: 'What is a tautology in logic?',
			a: 'A tautology is a statement that is true in every row of its truth table, whatever truth values its letters take. p ∨ ¬p ("it is raining or it is not raining") is the simplest example. Its truth comes from its form alone, not from any fact about the world.'
		},
		{
			q: 'How do you prove that a statement is a tautology?',
			a: 'Build its truth table and check that the final column is true in every row. Alternatively, use logical equivalences to rewrite it step by step until you reach ⊤ (true), or show that its negation is a contradiction. To show a statement is not a tautology, one row where it is false is enough.'
		},
		{
			q: 'What is the difference between a tautology, a contradiction and a contingency?',
			a: 'A tautology is true in every row, a contradiction is false in every row, and a contingency is true in some rows and false in others. Every statement is exactly one of the three. The negation of a tautology is a contradiction and the other way round; the negation of a contingency is another contingency.'
		},
		{
			q: 'Is a contingency satisfiable?',
			a: 'Yes. A statement is satisfiable when at least one row makes it true, so every tautology and every contingency is satisfiable, and only contradictions are not. Deciding satisfiability for large formulas is the SAT problem, the first problem shown to be NP-complete.'
		},
		{
			q: 'What is the relationship between tautologies and valid arguments?',
			a: 'An argument with premises P1, ..., Pn and conclusion C is valid exactly when the single statement (P1 ∧ ... ∧ Pn) → C is a tautology. A valid argument can never lead from true premises to a false conclusion, and a false row of that conditional would be exactly such a case.'
		},
		{
			q: 'Is "all bachelors are unmarried" a tautology?',
			a: 'Not in propositional logic. Its truth depends on what "bachelor" means, not on its logical form alone. Philosophers call such statements analytic truths. A logical tautology stays true whatever its letters stand for: "if it is a bachelor, then it is a bachelor" is one.'
		},
		{
			q: 'Why is tautology a bad thing in writing but a good thing in logic?',
			a: 'In writing, a tautology is needless repetition, such as "free gift" or "it is what it is", because it adds no information. A logical tautology adds no information about the world either, which is exactly why it is useful: it is a rule that holds in every case, so it can be used in any proof.'
		}
	];

	const page = {
		title: 'Tautology, Contradiction and Contingency in Logic',
		description:
			'What a tautology is in logic, how to check one with a truth table, and how it differs from a contradiction and a contingency, with famous tautologies.',
		url: `${SITE}/logic/tautology`,
		image: `${SITE}/og/logic-tautology.png`,
		imageAlt: 'LogicGates.org: tautology, contradiction and contingency'
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
					{ '@type': 'ListItem', position: 3, name: 'Tautology' }
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
		{ href: '/logic/conditional-statements', label: 'Conditional statements' },
		{ href: '/logic/rules-of-inference', label: 'Rules of inference' },
		{ href: '/logic/logical-equivalences', label: 'Logical equivalences' },
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for logic statements' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<a href="/logic">Logic</a> <span aria-hidden="true">›</span>
			<span>Tautology</span>
		</nav>
		<h1>Tautology, contradiction and contingency</h1>
		<p class="lede">
			Some statements are true however the world turns out, some are false however it turns out, and the rest depend on
			the facts. A truth table sorts every statement into one of those three, and the same test decides whether an
			argument is valid.
		</p>
	</section>

	<section id="definitions">
		<h2>The three kinds of statement</h2>
		<div class="kinds">
			<div class="card kind yes">
				<h3>Tautology</h3>
				<p>True in <strong>every</strong> row. Its form alone makes it true.</p>
				<p class="mono">p ∨ ¬p</p>
			</div>
			<div class="card kind no">
				<h3>Contradiction</h3>
				<p>False in <strong>every</strong> row. It can never be true.</p>
				<p class="mono">p ∧ ¬p</p>
			</div>
			<div class="card kind">
				<h3>Contingency</h3>
				<p>True in <strong>some</strong> rows and false in others. It depends on its letters.</p>
				<p class="mono">p → q</p>
			</div>
		</div>
		<p>
			Every statement is exactly one of the three. Two more words cut across them. A statement is
			<strong>satisfiable</strong> when at least one row makes it true, which covers tautologies and contingencies; a
			contradiction is <strong>unsatisfiable</strong>. And a tautology is also called a <strong>valid</strong> statement,
			or a logical truth.
		</p>
		<p>
			Negation swaps the outer two: the negation of a tautology is a contradiction and the negation of a contradiction
			is a tautology, while the negation of a contingency is again a contingency. So a statement is a tautology exactly
			when its negation is unsatisfiable, which is how automated provers check tautologies in practice.
		</p>
	</section>

	<section id="check">
		<h2>How to check with a truth table</h2>
		<ol class="list">
			<li>List every combination of truth values for the letters: 2<sup>n</sup> rows for n letters.</li>
			<li>Work out each part of the statement, innermost first, in its own column.</li>
			<li>
				Read the final column. All T: tautology. All F: contradiction. A mix: contingency. One F is enough to show a
				statement is not a tautology.
			</li>
		</ol>
		<p class="section-intro">
			Here is <span class="mono">{workedStatement}</span>, "if p and q, then p or q":
		</p>
		<div class="table-wrap">
			<table class="data-table tt">
				<thead>
					<tr>
						{#each worked.variables as v}<th scope="col" class="mono">{v}</th>{/each}
						{#each worked.steps as step, i}
							<th scope="col" class="mono" class:first={i === 0} class:main={i === worked.steps.length - 1}
								>{step.label}</th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each worked.rows as row, r}
						<tr>
							{#each row as v}<td class={v ? 'bit-1' : 'bit-0'}>{tf(v)}</td>{/each}
							{#each worked.steps as step, i}
								<td
									class={step.values[r] ? 'bit-1' : 'bit-0'}
									class:first={i === 0}
									class:main={i === worked.steps.length - 1}>{tf(step.values[r])}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The last column is all T, so the statement is a {workedKind}. Try your own in the
			<a href={calc(workedStatement)}>truth table calculator</a>, which names the kind for any single statement.
		</p>
	</section>

	<section id="examples">
		<h2>Classified examples</h2>
		<p class="section-intro">
			Each statement's final column, rows from all true down, and what it makes the statement:
		</p>
		<div class="table-wrap">
			<table class="data-table stack">
				<thead>
					<tr>
						<th scope="col">Statement and its final column</th>
						<th scope="col">Kind</th>
					</tr>
				</thead>
				<tbody>
					{#each examples as e}
						<tr>
							<td>
								<a class="mono nowrap" href={calc(e.s)}>{e.s}</a>
								<span class="mono values"
									>{#each e.values as v}<span class={v ? 't' : 'f'}>{tf(v)}</span>{/each}</span
								>
							</td>
							<td>
								<span class="kind-cell {e.kind}">{e.kind}</span>
								<span class="small">{e.kind === 'contradiction' ? 'unsatisfiable' : 'satisfiable'}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="famous">
		<h2>Famous tautologies</h2>
		<p class="section-intro">
			Many laws of logic are tautologies. Each of these was checked by truth table when this page was built.
		</p>
		<div class="table-wrap">
			<table class="data-table stack">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Statement</th>
					</tr>
				</thead>
				<tbody>
					{#each famous as t}
						<tr>
							<td>{t.name}</td>
							<td>
								<a class="mono" href={calc(t.statement)}>{t.statement}</a>
								<span class="small checked">✓ true in {t.trueRows} of {t.table.rows.length} rows</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			The first two are the classical laws of thought: everything is either true or false, and nothing is both. The
			principle of explosion says a contradiction implies anything at all, which is why a single contradiction wrecks a
			set of assumptions. Peirce's law is a tautology that is hard to see without the truth table, and one that
			intuitionistic logic rejects. Every
			<a href="/logic/logical-equivalences">logical equivalence</a> A ≡ B gives a tautology A ↔ B, and every
			<a href="/logic/rules-of-inference">rule of inference</a> gives one in the shape (premises) → conclusion.
		</p>
	</section>

	<section id="validity">
		<h2>Tautologies and valid arguments</h2>
		<p>
			An argument is <strong>valid</strong> when its conclusion is true in every row where all its premises are true. Put
			the premises together with ∧ and draw an arrow to the conclusion, and that condition is exactly what makes the conditional
			true in every row. So:
		</p>
		<p class="rule-box">
			An argument is valid if and only if (premise<sub>1</sub> ∧ ... ∧ premise<sub>n</sub>) → conclusion is a tautology.
		</p>
		<div class="table-wrap">
			<table class="data-table stack">
				<thead>
					<tr>
						<th scope="col">Argument</th>
						<th scope="col">As one statement</th>
					</tr>
				</thead>
				<tbody>
					{#each arguments_ as a}
						<tr>
							<td>
								{a.name}
								<a class="mono nowrap" href={calc(a.argument)}>{a.argument}</a>
								<span class="small {a.valid ? 'ok' : 'bad'}">{a.valid ? 'valid' : 'invalid'}</span>
							</td>
							<td>
								<a class="mono" href={calc(a.conditional)}>{a.conditional}</a>
								<span class="small kind-cell {a.kind}">{a.kind}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Both verdicts come from the engine: every valid argument has a tautology beside it, and every invalid one does
			not. The two invalid ones are the classic fallacies.
		</p>
	</section>

	<section id="equivalence">
		<h2>Tautologies and equivalence</h2>
		<p>
			Two statements A and B are <strong>logically equivalent</strong>, written A ≡ B, when A ↔ B is a tautology. For
			example <span class="mono">¬(p ∧ q) ↔ ¬p ∨ ¬q</span> is true in all {deMorgan.trueRows} of its
			{deMorgan.table.rows.length} rows, so De Morgan's law <span class="mono">¬(p ∧ q) ≡ ¬p ∨ ¬q</span> holds. The
			<a href="/logical-equivalence-calculator">logical equivalence calculator</a> runs this check for any two statements.
		</p>
	</section>

	<section id="circuits">
		<h2>In circuits</h2>
		<p>
			A tautology is a circuit whose output is 1 for every input, and a contradiction one whose output is always 0. A
			designer who finds either has found gates that can be replaced by a constant. Asking whether some input makes a
			circuit output 1 is asking whether its formula is satisfiable, the SAT problem that hardware verification tools
			solve every day. The <a href="/truth-table-generator">truth table generator</a> shows the output column of any circuit
			expression.
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

	.kinds {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		margin-bottom: 1rem;
	}

	.kind {
		padding: 0.9rem 1rem 0.8rem;
		border-left-width: 4px;
	}

	.kind.yes {
		border-left-color: #5db65d;
	}

	.kind.no {
		border-left-color: #e05555;
	}

	.kind p {
		margin: 0.3rem 0;
		font-size: 0.92rem;
	}

	.list {
		color: #ddd;
		padding-left: 1.25rem;
		max-width: 700px;
	}

	.list li {
		margin-bottom: 0.5rem;
	}

	.tt th,
	.tt td {
		text-align: center;
		white-space: nowrap;
	}

	.tt .first {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.tt .main {
		font-weight: 700;
		background-color: rgba(255, 255, 255, 0.06);
	}

	.nowrap {
		white-space: nowrap;
	}

	.t {
		color: #5db65d;
	}

	.f {
		color: #f66;
	}

	.kind-cell.tautology,
	.ok,
	.checked {
		color: #8ede8e;
	}

	.kind-cell.contradiction,
	.bad {
		color: #ff8a8a;
	}

	/* Two columns with their details stacked inside, so the tables fit a phone. */
	.stack td {
		vertical-align: top;
	}

	.stack td > * {
		display: block;
	}

	.values {
		letter-spacing: 0.15em;
	}

	.small {
		font-size: 0.8rem;
	}

	.rule-box {
		border-left: 4px solid #5db65d;
		background-color: rgba(51, 119, 34, 0.18);
		padding: 0.7rem 1rem;
		border-radius: 3px;
		color: #fff;
		max-width: 700px;
	}
</style>
