<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseProp, parsePropInput, propTable, CONNECTIVE_SYMBOL, type Prop } from '$lib/propositional';
	import { connectiveSymbols, otherSymbols } from '$lib/logicReference';
	import { toolLink } from '$lib/urlState';

	const calc = (s: string) => toolLink('/propositional-logic-truth-table', { s });

	// Each connective's result column, from the engine, rows from all true.
	const symbols = connectiveSymbols.map((s) => {
		const table = propTable(parsePropInput(s.example));
		return { ...s, variables: table.variables, rows: table.rows, values: table.statements[0].values };
	});
	const tf = (v: boolean) => (v ? 'T' : 'F');

	/** Every bracket written out, to show how the precedence rules group a statement. */
	function bracketed(p: Prop, top = true): string {
		if (p.t === 'var') return p.name;
		if (p.t === 'const') return p.v ? '⊤' : '⊥';
		if (p.t === 'not') return `¬${bracketed(p.a, false)}`;
		const inner = `${bracketed(p.a, false)} ${CONNECTIVE_SYMBOL[p.t]} ${bracketed(p.b, false)}`;
		return top ? inner : `(${inner})`;
	}
	const precedence = ['¬p ∨ q → r', 'p ∧ q ∨ r', 'p → q ↔ ¬q → ¬p', 'p → q → r'].map((s) => ({
		s,
		reads: bracketed(parseProp(s))
	}));

	const topics = [
		{
			href: '/logic/conditional-statements',
			title: 'Conditional statements',
			text: 'If p then q: when it is false, the converse, inverse and contrapositive, the biconditional, and necessary and sufficient conditions.'
		},
		{
			href: '/logic/tautology',
			title: 'Tautology, contradiction and contingency',
			text: 'Statements that are always true, always false, or neither, and how a truth table tells them apart.'
		},
		{
			href: '/logic/logical-equivalences',
			title: 'Logical equivalences',
			text: "The laws of logic: De Morgan's, distributive, absorption and the rest, each checked by truth table."
		},
		{
			href: '/logic/rules-of-inference',
			title: 'Rules of inference',
			text: 'Modus ponens, modus tollens, the syllogisms and resolution, the classic fallacies, and how to write a proof.'
		}
	];

	const gateMap = [
		{ symbol: '¬p', gate: 'NOT', href: '/logic-gates/not' },
		{ symbol: 'p ∧ q', gate: 'AND', href: '/logic-gates/and' },
		{ symbol: 'p ∨ q', gate: 'OR', href: '/logic-gates/or' },
		{ symbol: 'p ⊕ q', gate: 'XOR', href: '/logic-gates/xor' },
		{ symbol: 'p ↔ q', gate: 'XNOR', href: '/logic-gates/xnor' },
		{ symbol: '¬(p ∧ q)', gate: 'NAND', href: '/logic-gates/nand' },
		{ symbol: '¬(p ∨ q)', gate: 'NOR', href: '/logic-gates/nor' }
	];

	const faqs = [
		{
			q: 'What is propositional logic?',
			a: 'Propositional logic is the part of logic that studies how the truth of compound statements depends on the truth of their parts. Each basic statement is a single letter that is either true or false, and connectives such as not, and, or, if-then and if-and-only-if build larger statements from them. It is also called sentential logic, statement logic or the propositional calculus.'
		},
		{
			q: 'What does the symbol → mean in logic?',
			a: 'p → q is the conditional, read "if p then q" or "p implies q". It is false in exactly one case: when p is true and q is false. Some books write it as p ⊃ q or p ⇒ q.'
		},
		{
			q: 'What is the difference between ∧ and ∨?',
			a: '∧ is AND (conjunction): p ∧ q is true only when both are true. ∨ is OR (disjunction): p ∨ q is true when at least one is true, including when both are. The OR of logic is inclusive; the exclusive version, "one or the other but not both", is written ⊕.'
		},
		{
			q: 'What is the difference between propositional logic and predicate logic?',
			a: 'Propositional logic treats "Socrates is mortal" as an indivisible letter such as p. Predicate (first-order) logic looks inside the statement, with predicates like Mortal(x) and the quantifiers ∀ (for all) and ∃ (there exists). Everything in propositional logic can be decided with a truth table; predicate logic in general cannot.'
		},
		{
			q: 'Is "x > 3" a proposition?',
			a: 'Not on its own. Its truth depends on x, so it is an open sentence, or predicate. It becomes a proposition once x is fixed ("5 > 3" is true) or once it is quantified ("for every x, x > 3" is false). Questions and commands are not propositions either, since they are neither true nor false.'
		},
		{
			q: 'How is propositional logic used in computer science?',
			a: 'Every if statement in a program tests a proposition, digital circuits compute propositional formulas with logic gates, and SAT solvers decide whether huge propositional formulas can be made true, which is how chips are verified and many scheduling problems are solved. Boolean algebra is propositional logic written with 1, 0, + and multiplication.'
		}
	];

	const page = {
		title: 'Propositional Logic: Symbols, Connectives, Truth Tables',
		description:
			'Propositional logic explained: what a proposition is, the logic symbols ¬ ∧ ∨ → ↔ and how to read them, with guides to tautologies, conditionals and proofs.',
		url: `${SITE}/logic`,
		image: `${SITE}/og/logic.png`,
		imageAlt: 'LogicGates.org: propositional logic, symbols and connectives'
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
					{ '@type': 'ListItem', position: 2, name: 'Logic' }
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
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for logic statements' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' },
		{ href: '/logic/conditional-statements', label: 'Conditional statements' },
		{ href: '/logic/tautology', label: 'Tautologies' },
		{ href: '/logic/rules-of-inference', label: 'Rules of inference' },
		{ href: '/logic/logical-equivalences', label: 'Logical equivalences' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<span>Logic</span>
		</nav>
		<h1>Propositional logic</h1>
		<p class="lede">
			The logic of statements that are either true or false, and of the words that join them: not, and, or, if-then and
			if and only if. It is what a logic or discrete maths course starts with, and it is the same algebra that logic
			gates compute.
		</p>
		<div class="topics">
			{#each topics as topic}
				<a class="card topic" href={topic.href}>
					<strong>{topic.title}</strong>
					<span>{topic.text}</span>
				</a>
			{/each}
		</div>
		<p class="tools-line">
			Tools: <a href="/propositional-logic-truth-table">truth table calculator for logic statements</a>, which also
			checks arguments, and the <a href="/logical-equivalence-calculator">logical equivalence calculator</a>.
		</p>
	</section>

	<section id="propositions">
		<h2>Propositions and statements</h2>
		<p>
			A <strong>proposition</strong> (or statement) is a sentence that is either true or false, not both. "Paris is in France"
			is a true proposition and "7 is even" is a false one. "Close the door" and "Is it raining?" are not propositions, since
			neither is true or false, and nor is "x is even" until you know what x is.
		</p>
		<p>
			Propositional logic does not look inside a proposition. It names each one with a letter, usually p, q and r, and
			cares only about its <strong>truth value</strong>: true (T) or false (F). A letter on its own is an
			<strong>atomic</strong> statement. Joining statements with connectives gives <strong>compound</strong> statements
			such as <span class="mono">p ∧ ¬q</span>, and the truth value of a compound statement is fixed completely by the
			truth values of its letters. That is why a truth table, which lists every combination, can answer every question
			in propositional logic.
		</p>
	</section>

	<section id="symbols">
		<h2>Logic symbols and how to read them</h2>
		<p class="section-intro">
			Five connectives appear in every textbook, and exclusive or joins them in computing. Books and keyboards write
			them in several ways, and the calculator accepts every alternative listed. Some books also write p ∧ q as pq; the
			calculator needs the symbol, since it reads each letter as its own statement. The last column is each connective's
			truth table, rows from all true down, computed rather than typed.
		</p>
		<div class="table-wrap">
			<table class="data-table symbols connectives">
				<thead>
					<tr>
						<th scope="col">Symbol</th>
						<th scope="col">Name</th>
						<th scope="col">Read as</th>
						<th scope="col">Also written</th>
						<th scope="col">Truth values</th>
					</tr>
				</thead>
				<tbody>
					{#each symbols as s}
						<tr>
							<td class="big mono">{s.symbol}</td>
							<td class="name">{s.name}</td>
							<td data-label="Read as">{s.reads}</td>
							<td class="mono" data-label="Also written">{s.also}</td>
							<td data-label="Truth values">
								<a class="values mono" href={calc(s.example)} title="Truth table of {s.example}">
									{#each s.values as v}<span class={v ? 't' : 'f'}>{tf(v)}</span>{/each}
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			For two letters the four values are for p, q = TT, TF, FT, FF; for ¬p they are for p = T, F. Select a column to
			open its full truth table.
		</p>

		<h3 class="sub">Other symbols you will meet</h3>
		<div class="table-wrap">
			<table class="data-table symbols">
				<thead>
					<tr>
						<th scope="col">Symbol</th>
						<th scope="col">Name</th>
						<th scope="col">Meaning</th>
					</tr>
				</thead>
				<tbody>
					{#each otherSymbols as s}
						<tr>
							<td class="big mono">{s.symbol}</td>
							<td>{s.name}</td>
							<td>{s.meaning}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			≡ and ⊨ are not connectives: they are statements about statements. <span class="mono">p ↔ q</span> is a statement
			that can be true or false; <span class="mono">p ≡ q</span> is the claim that
			<span class="mono">p ↔ q</span> is true in every row.
		</p>
	</section>

	<section id="precedence">
		<h2>Order of operations</h2>
		<p>
			Like × before + in arithmetic, the connectives have an order that saves brackets. ¬ binds tightest, then ∧, then
			∨, then →, and ↔ binds loosest. A chain of → groups to the right. Books differ on where ⊕ sits, so it is safest to
			bracket it; here it sits between ∧ and ∨. When in doubt, write the brackets.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Written</th>
						<th scope="col">Means</th>
					</tr>
				</thead>
				<tbody>
					{#each precedence as row}
						<tr>
							<td class="mono">{row.s}</td>
							<td class="mono">{row.reads}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="topics">
		<h2>What to learn next</h2>
		<ul class="list">
			<li>
				<a href="/logic/conditional-statements">Conditional statements</a>: why
				<span class="mono">p → q</span> is true when p is false, and which of the converse, inverse and contrapositive mean
				the same thing.
			</li>
			<li>
				<a href="/logic/tautology">Tautologies, contradictions and contingencies</a>: classifying a statement by its
				truth table, and what that has to do with valid arguments.
			</li>
			<li>
				<a href="/logic/logical-equivalences">Logical equivalences</a>: the laws that let you rewrite a statement
				without changing its meaning.
			</li>
			<li>
				<a href="/logic/rules-of-inference">Rules of inference</a>: modus ponens and friends, and how to chain them into
				a proof.
			</li>
		</ul>
		<p>
			To check your own work, type any statement into the
			<a href={calc('(p → q) ∧ (q → r) → (p → r)')}>truth table calculator</a> for its full table, a list of statements
			separated by commas to compare them, or premises, ∴ and a conclusion to test an argument. The
			<a href="/logical-equivalence-calculator">logical equivalence calculator</a> checks whether two statements mean the
			same.
		</p>
	</section>

	<section id="circuits">
		<h2>From logic to logic gates</h2>
		<p>
			In 1938 Claude Shannon showed that switching circuits obey the same algebra as propositional logic. Write 1 for
			true and 0 for false and every connective becomes a <a href="/logic-gates">logic gate</a>:
		</p>
		<div class="gate-row">
			{#each gateMap as g}
				<a class="card gate-chip" href={g.href}><span class="mono">{g.symbol}</span> {g.gate}</a>
			{/each}
		</div>
		<p>
			The conditional has no gate of its own: <span class="mono">p → q</span> is built as
			<span class="mono">¬p ∨ q</span>. The <a href="/boolean-algebra-laws">laws of boolean algebra</a> are the
			<a href="/logic/logical-equivalences">logical equivalences</a> in circuit notation, where ∧ is written as
			multiplication and ∨ as +, and <a href="/de-morgans-laws">De Morgan's laws</a> are the same in both.
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

	.topics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 12px;
	}

	.topic {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.9rem 1rem 1rem;
		text-decoration: none;
	}

	.topic strong {
		color: #fff;
	}

	.topic span {
		color: #bbb;
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.topic:hover {
		border-color: #5db65d;
	}

	.tools-line {
		font-size: 0.92rem;
		margin-top: 1rem;
	}

	.symbols td {
		vertical-align: middle;
	}

	.big {
		font-size: 1.3rem;
		color: #fff;
		text-align: center;
	}

	.values {
		text-decoration: none;
		letter-spacing: 0.15em;
		white-space: nowrap;
	}

	.t {
		color: #5db65d;
	}

	.f {
		color: #f66;
	}

	/* On a phone five columns do not fit, so each connective becomes a small card. */
	@media (max-width: 600px) {
		.connectives thead {
			display: none;
		}

		.connectives,
		.connectives tbody {
			display: block;
		}

		.connectives tr {
			display: grid;
			grid-template-columns: 2.4rem 1fr;
			padding: 0.5rem 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		}

		.connectives tr:last-child {
			border-bottom: none;
		}

		/* Doubled class to outrank the shared .data-table cell borders. */
		.connectives.symbols td {
			border: none;
			padding: 0.1rem 0.7rem 0.1rem 0;
		}

		.connectives td.big {
			grid-row: span 4;
			padding-left: 0.7rem;
		}

		.connectives td.name {
			color: #fff;
			font-weight: 600;
		}

		.connectives td[data-label]::before {
			content: attr(data-label) ': ';
			color: #999;
			font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
			font-size: 0.85rem;
		}
	}

	.sub {
		margin-top: 1.8rem;
		margin-bottom: 0.7rem;
	}

	.list {
		color: #ddd;
		padding-left: 1.25rem;
		max-width: 700px;
	}

	.list li {
		margin-bottom: 0.6rem;
	}

	.gate-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.gate-chip {
		padding: 0.35rem 0.75rem;
		color: #fff;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.gate-chip .mono {
		color: #8ede8e;
		margin-right: 0.3rem;
	}

	.gate-chip:hover {
		border-color: #5db65d;
	}
</style>
