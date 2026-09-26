<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		rules,
		fallacies,
		proof,
		stepForms,
		isInstanceOf,
		checkArgumentText,
		argumentText,
		asConditional,
		classifyText
	} from '$lib/logicReference';
	import { toolLink } from '$lib/urlState';

	const calc = (s: string) => toolLink('/propositional-logic-truth-table', { s });
	// For "Therefore, ..." in mid-sentence; "I" keeps its capital.
	const lowerFirst = (s: string) => (/^I\b/.test(s) ? s : s[0].toLowerCase() + s.slice(1));

	// Each rule is listed only if the engine finds it valid.
	const valid = rules
		.map((r) => {
			const verdict = checkArgumentText(r.premises, r.conclusion);
			return { ...r, argument: argumentText(r.premises, r.conclusion), verdict, rows: verdict.table.rows.length };
		})
		.filter((r) => r.verdict.valid);

	// And each fallacy only if the engine finds a counterexample, which is shown.
	const invalid = fallacies
		.map((f) => {
			const verdict = checkArgumentText(f.premises, f.conclusion);
			const counter = verdict.counterexamples.map((i) =>
				verdict.table.variables.map((v, j) => `${v} ${verdict.table.rows[i][j] ? 'true' : 'false'}`).join(', ')
			);
			return { ...f, argument: argumentText(f.premises, f.conclusion), verdict, counter };
		})
		.filter((f) => !f.verdict.valid);

	// The worked proof, every step checked two ways at build time: the lines it
	// cites entail it, and it has the shape of the rule it names.
	const lines = proof.lines.map((line, i) => {
		if (line.rule === 'premise') return { ...line, n: i + 1, why: 'Premise', ok: true };
		const cited = stepForms(line.rule);
		const used = line.from.map((n) => proof.lines[n - 1].statement);
		const ok =
			!!cited &&
			checkArgumentText(used, line.statement).valid &&
			cited.forms.some((form) => isInstanceOf(form, used, line.statement));
		return { ...line, n: i + 1, why: `${cited?.name ?? line.rule}, ${line.from.join(', ')}`, ok };
	});
	const proofOk = lines.every((l) => l.ok);
	const premises = proof.lines.filter((l) => l.rule === 'premise').map((l) => l.statement);
	const wholeArgument = argumentText(premises, proof.conclusion);
	const wholeValid = checkArgumentText(premises, proof.conclusion);

	const mp = valid.find((r) => r.id === 'modus-ponens');
	const mpConditional = mp ? asConditional(mp.premises, mp.conclusion) : '';
	const mpKind = mp ? classifyText(mpConditional).kind : '';

	const faqs = [
		{
			q: 'What are rules of inference?',
			a: 'Rules of inference are valid argument forms: patterns such as "p → q and p, therefore q" whose conclusion is true whenever all the premises are true, whatever statements the letters stand for. A proof is a chain of steps, each justified by one of these rules applied to earlier lines.'
		},
		{
			q: 'What is the difference between modus ponens and modus tollens?',
			a: 'Both start from a conditional p → q. Modus ponens adds p and concludes q: it affirms the antecedent. Modus tollens adds ¬q and concludes ¬p: it denies the consequent. They are the two valid ways to use a conditional; the two mirror images, affirming the consequent and denying the antecedent, are fallacies.'
		},
		{
			q: 'What does modus ponens mean?',
			a: 'Modus ponens is Latin for "the way that affirms", short for modus ponendo ponens, "the way that affirms by affirming". Modus tollens is "the way that denies", from modus tollendo tollens. The names describe what the second premise does to the conditional.'
		},
		{
			q: 'How do you know a rule of inference is valid?',
			a: 'Check its truth table: in every row where all the premises are true, the conclusion must be true too. Equivalently, (premises joined with ∧) → conclusion must be a tautology. Every rule on this page was checked that way when the page was built, and the calculator will check any argument you type.'
		},
		{
			q: 'What is the difference between a rule of inference and a logical equivalence?',
			a: 'A rule of inference works in one direction on whole lines: from p ∧ q you may infer p, but not the reverse. A logical equivalence works in both directions and may replace any part of a statement, because both sides always have the same truth value. Proofs use both.'
		},
		{
			q: 'Is a valid argument always true?',
			a: 'No. Validity is about form: if the premises are true, the conclusion must be. "If the moon is cheese, it is edible; the moon is cheese; so it is edible" is valid modus ponens with a false premise. An argument that is valid and has true premises is called sound, and its conclusion is true.'
		}
	];

	const page = {
		title: 'Rules of Inference: Modus Ponens, Modus Tollens and More',
		description:
			'The rules of inference in propositional logic, from modus ponens and modus tollens to resolution, each checked by truth table, with fallacies and a proof.',
		url: `${SITE}/logic/rules-of-inference`,
		image: `${SITE}/og/logic-rules-of-inference.png`,
		imageAlt: 'LogicGates.org: rules of inference, modus ponens and modus tollens'
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
					{ '@type': 'ListItem', position: 3, name: 'Rules of inference' }
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
		{ href: '/logic/tautology', label: 'Tautologies' },
		{ href: '/logic/logical-equivalences', label: 'Logical equivalences' },
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for logic statements' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<a href="/logic">Logic</a> <span aria-hidden="true">›</span>
			<span>Rules of inference</span>
		</nav>
		<h1>Rules of inference</h1>
		<p class="lede">
			The valid patterns of reasoning that proofs are built from, each with its form, an everyday example and a truth
			table check, followed by the fallacies that look like them and a proof written step by step.
		</p>
	</section>

	<section id="what">
		<h2>Arguments, validity and rules</h2>
		<p>
			An <strong>argument</strong> is a list of statements, the <strong>premises</strong>, followed by a
			<strong>conclusion</strong>, marked with ∴ ("therefore"). It is <strong>valid</strong> when the conclusion is true
			in every case where all the premises are true. Validity is about form, not content: replace the letters with any statements
			you like and a valid form stays valid.
		</p>
		<p>
			A <strong>rule of inference</strong> is a short valid form that is worth a name. Each one below was checked by
			listing every row of its truth table when this page was built. Written as a single statement, each is also a
			<a href="/logic/tautology">tautology</a>{#if mp && mpKind === 'tautology'}: modus ponens becomes
				<span class="mono">{mpConditional}</span>, true in every row{/if}.
		</p>
	</section>

	<section id="rules">
		<h2>The rules</h2>
		<div class="table-wrap">
			<table class="data-table summary">
				<thead>
					<tr>
						<th scope="col">Rule</th>
						<th scope="col">Premises</th>
						<th scope="col">Conclusion</th>
					</tr>
				</thead>
				<tbody>
					{#each valid as r}
						<tr>
							<td><a href="#{r.id}">{r.name}</a></td>
							<td class="mono"
								>{#each r.premises as premise, i}<span class="nowrap"
										>{premise}{i < r.premises.length - 1 ? ',' : ''}</span
									>{' '}{/each}</td
							>
							<td class="mono nowrap">∴ {r.conclusion}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="rules">
			{#each valid as r}
				<article class="card rule" id={r.id}>
					<h3>{r.name}</h3>
					{#if r.aka}<p class="aka">Also called {r.aka}</p>{/if}
					<div class="rule-body">
						<div class="form mono" aria-label="Form">
							{#each r.premises as premise}<div>{premise}</div>{/each}
							<div class="therefore">∴ {r.conclusion}</div>
						</div>
						<div class="example">
							{#each r.english.premises as premise}<div>{premise}</div>{/each}
							<div class="therefore">
								Therefore, {lowerFirst(r.english.conclusion)}
							</div>
						</div>
					</div>
					<p class="idea">{r.idea}</p>
					<p class="check">
						<span class="ok">✓ Valid</span>: checked on all {r.rows} rows.
						<a href={calc(r.argument)}>See the truth table</a>
					</p>
				</article>
			{/each}
		</div>
	</section>

	<section id="fallacies">
		<h2>Fallacies: the invalid look-alikes</h2>
		<p class="section-intro">
			A formal fallacy is an argument form that looks like a rule but is not valid: some row makes every premise true
			and the conclusion false. One such row, a <strong>counterexample</strong>, is enough to sink it.
		</p>
		<div class="rules">
			{#each invalid as f}
				<article class="card rule fallacy" id={f.id}>
					<h3>{f.name}</h3>
					<p class="aka">Often mistaken for {f.mistakenFor}</p>
					<div class="rule-body">
						<div class="form mono">
							{#each f.premises as premise}<div>{premise}</div>{/each}
							<div class="therefore">∴ {f.conclusion}</div>
						</div>
						<div class="example">
							{#each f.english.premises as premise}<div>{premise}</div>{/each}
							<div class="therefore">
								Therefore, {lowerFirst(f.english.conclusion)}
							</div>
						</div>
					</div>
					<p class="idea">{f.idea}</p>
					<p class="check">
						<span class="bad">✗ Invalid</span>: counterexample {f.counter.join('; ')}.
						<a href={calc(f.argument)}>See the truth table</a>
					</p>
				</article>
			{/each}
		</div>
	</section>

	<section id="proof">
		<h2>How to write a proof with rules of inference</h2>
		<p>
			A truth table can check any argument, but it doubles in size with every letter. A <strong>proof</strong> reaches
			the conclusion in a few lines instead: list the premises, then add one line at a time, each following from earlier
			lines by a rule of inference or by replacing part of a line with something
			<a href="/logic/logical-equivalences">logically equivalent</a>. The proof ends when the conclusion appears.
		</p>
		<p class="section-intro">Take this argument:</p>
		<div class="card english-arg">
			{#each proof.english as sentence}<div>{sentence}</div>{/each}
			<div class="therefore">
				Therefore, {lowerFirst(proof.englishConclusion)}
			</div>
		</div>
		<p class="key">
			{#each proof.key as k, i}<span class="mono">{k.letter}</span>: {k.means}{#if i < proof.key.length - 1};
				{/if}{/each}.
		</p>
		{#if proofOk}
			<div class="table-wrap">
				<table class="data-table proof">
					<thead>
						<tr>
							<th scope="col">Line</th>
							<th scope="col">Statement</th>
							<th scope="col">Justification</th>
						</tr>
					</thead>
					<tbody>
						{#each lines as line}
							<tr class:premise={line.rule === 'premise'}>
								<td class="num">{line.n}</td>
								<td class="mono nowrap">{line.statement}</td>
								<td>{line.why}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="reducer">
				Line {lines.length} is the conclusion, so the argument is valid. Every step was checked when this page was built:
				the lines it cites entail it, and it has the exact shape of the rule it names. Line 5 uses the commutative law to
				swap the sides of ∧, since simplification here keeps the left part.
				{#if wholeValid.valid}The <a href={calc(wholeArgument)}>full truth table</a> agrees, over all
					{wholeValid.table.rows.length} rows.{/if}
			</p>
		{/if}
		<p>Some habits that make proofs easier to find:</p>
		<ul class="list">
			<li>Break conjunctions apart with simplification early; single letters are easier to use.</li>
			<li>
				Look for a conditional whose antecedent you have (modus ponens) or whose consequent you can deny (modus
				tollens).
			</li>
			<li>Chain conditionals with hypothetical syllogism before applying them.</li>
			<li>Work backwards from the conclusion: ask which rule could produce it, and what that rule needs.</li>
			<li>
				Rewrite with equivalences when a line is in the wrong shape, for example <span class="mono">p → q</span> as
				<span class="mono">¬q → ¬p</span> (the
				<a href="/logic/conditional-statements#converse-inverse-contrapositive">contrapositive</a>).
			</li>
		</ul>
	</section>

	<section id="resolution-proofs">
		<h2>Resolution and computers</h2>
		<p>
			Resolution deserves a word of its own. Rewrite every premise and the negation of the conclusion as ORs of letters
			and negated letters (<a href="/propositional-logic-truth-table#normal-forms">conjunctive normal form</a>), then
			resolve pairs of clauses until the empty clause, a contradiction, appears. That one rule is complete for proving
			that a set of clauses is unsatisfiable, which is why it, and descendants of it, run inside theorem provers and the
			SAT solvers used to verify chips.
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

	.nowrap {
		white-space: nowrap;
	}

	.summary {
		margin-bottom: 1.5rem;
	}

	.rules {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
		gap: 12px;
	}

	@media (max-width: 480px) {
		.rules {
			grid-template-columns: 1fr;
		}
	}

	.rule {
		padding: 0.9rem 1rem 0.8rem;
		scroll-margin-top: 50px;
	}

	.rule h3 {
		color: #fff;
		font-size: 1.05rem;
	}

	.aka {
		color: #999;
		font-size: 0.8rem;
		margin: 0 0 0.6rem;
	}

	.rule-body {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		align-items: start;
	}

	.form {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.45rem 0.75rem;
		white-space: nowrap;
		color: #fff;
	}

	.therefore {
		border-top: 1px solid rgba(255, 255, 255, 0.35);
		margin-top: 0.2rem;
		padding-top: 0.2rem;
	}

	.example {
		color: #ccc;
		font-size: 0.88rem;
		line-height: 1.5;
	}

	.example .therefore {
		border-top-color: rgba(255, 255, 255, 0.2);
	}

	.idea {
		font-size: 0.88rem;
		color: #bbb;
		margin: 0.7rem 0 0.4rem;
	}

	.check {
		font-size: 0.82rem;
		color: #aaa;
		margin: 0;
	}

	.ok {
		color: #8ede8e;
		font-weight: 700;
	}

	.bad {
		color: #ff8a8a;
		font-weight: 700;
	}

	.fallacy {
		border-left: 4px solid #e05555;
	}

	.english-arg {
		padding: 0.8rem 1rem;
		max-width: 560px;
		color: #ddd;
		line-height: 1.6;
	}

	.key {
		color: #aaa;
		font-size: 0.85rem;
	}

	.proof .num {
		text-align: right;
		color: #999;
		width: 2.5rem;
	}

	.proof tr.premise td {
		color: #aaa;
	}

	.proof tr:not(.premise) .mono {
		color: #fff;
	}

	.list {
		color: #ddd;
		padding-left: 1.25rem;
		max-width: 700px;
	}

	.list li {
		margin-bottom: 0.5rem;
	}

	@media (max-width: 520px) {
		.rule-body {
			grid-template-columns: 1fr;
			gap: 0.6rem;
		}
	}
</style>
