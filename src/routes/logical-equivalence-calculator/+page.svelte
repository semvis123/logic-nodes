<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseProp, propTable, formatProp, PropError, MAX_PROP_VARS, type PropTable } from '$lib/propositional';
	import {
		equivalenceProof,
		simplifyProof,
		checkedLaws,
		type ProofLine,
		type Simplification,
		type Counterexample
	} from '$lib/logicProof';
	import { readUrl, syncUrl, safeText, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Both statements live in the query string, so a link reopens this proof.
	const DEFAULTS = { a: '¬(p → q)', b: 'p ∧ ¬q' };
	onMount(() => {
		const p = readUrl();
		const a = safeText(p.a);
		// A link with only ?a= asks to simplify that statement on its own.
		if (a) {
			left = a;
			right = safeText(p.b) ?? '';
		}
	});
	// Only the default pair is left out of the address: once either side
	// changes both are written, so an empty right side survives a reload.
	$: syncUrl({ a: left, b: right }, left === DEFAULTS.a && right === DEFAULTS.b ? DEFAULTS : {});

	let left = DEFAULTS.a;
	let right = DEFAULTS.b;

	type Verdict = {
		tone: 'yes' | 'no' | 'neutral';
		head: string;
		/** What the term means in general. */
		means: string;
		/** What it means for these statements. */
		detail: string;
	};

	const MEANS = {
		equivalent:
			'Two statements are logically equivalent, written ≡, when they have the same truth value in every row of the truth table, so either can replace the other.',
		notEquivalent:
			'Two statements are not equivalent when at least one assignment of true and false to the letters gives them different values. One such row, a counterexample, is enough.',
		tautology: 'A tautology is a statement that is true whatever its letters stand for: it is equivalent to ⊤.',
		contradiction:
			'A contradiction is a statement that is false whatever its letters stand for: it is equivalent to ⊥.',
		contingency:
			'A contingency is true for some values of its letters and false for others, so it cannot be reduced to ⊤ or ⊥.'
	};

	type Result =
		| { kind: 'chain'; lines: ProofLine[] }
		| { kind: 'both'; left: Simplification; right: Simplification; table: PropTable }
		| { kind: 'counter'; variables: string[]; counter: Counterexample; aText: string; bText: string }
		| { kind: 'single'; s: Simplification };

	// Kept apart so the template can read it without narrowing the union again.
	$: counterValues = result?.kind === 'counter' ? result.counter.values : {};

	const steps = (n: number) => (n === 1 ? 'one law' : `${n} laws`);
	const tf = (v: boolean) => (v ? 'T' : 'F');

	// Runs during prerendering too, so the page ships with a real proof.
	let result: Result | null = null;
	let verdict: Verdict | null = null;
	let errorA = '';
	let errorB = '';
	$: {
		result = null;
		verdict = null;
		errorA = '';
		errorB = '';
		const parse = (text: string, side: 'a' | 'b') => {
			try {
				return parseProp(text);
			} catch (e) {
				const message = e instanceof PropError ? e.message : 'That statement did not parse';
				if (side === 'a') errorA = message;
				else errorB = message;
				return null;
			}
		};
		const a = left.trim() ? parse(left, 'a') : null;
		if (!left.trim()) errorA = 'Type a statement, such as p → q';
		const b = right.trim() ? parse(right, 'b') : null;
		try {
			if (a && !right.trim()) {
				const s = simplifyProof(a);
				result = { kind: 'single', s };
				const n = s.lines.length - 1;
				if (s.classification === 'tautology') {
					verdict = {
						tone: 'yes',
						head: 'Tautology',
						means: MEANS.tautology,
						detail: s.tautology
							? `The laws reduce it to ⊤ in ${n} ${n === 1 ? 'step' : 'steps'}, so it is true in every case.`
							: 'Its truth table is true in every row, though the laws here stop before reaching ⊤.'
					};
				} else if (s.classification === 'contradiction') {
					verdict = {
						tone: 'no',
						head: 'Contradiction',
						means: MEANS.contradiction,
						detail: s.contradiction
							? `The laws reduce it to ⊥ in ${n} ${n === 1 ? 'step' : 'steps'}, so it is false in every case.`
							: 'Its truth table is false in every row, though the laws here stop before reaching ⊥.'
					};
				} else {
					verdict = {
						tone: 'neutral',
						head: 'Simplified',
						means: MEANS.contingency,
						detail: n
							? `Neither a tautology nor a contradiction. It simplifies to ${s.finalText}.`
							: 'Neither a tautology nor a contradiction, and no law makes it any simpler.'
					};
				}
			} else if (a && b) {
				const proof = equivalenceProof(a, b);
				if (!proof.equivalent) {
					const { values, a: va, b: vb } = proof.counterexample;
					result = {
						kind: 'counter',
						variables: proof.variables,
						counter: proof.counterexample,
						aText: formatProp(a),
						bText: formatProp(b)
					};
					const word = (v: boolean) => (v ? 'true' : 'false');
					const parts = proof.variables.map((v) => `${v} is ${word(values[v])}`);
					const assignment =
						parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
					verdict = {
						tone: 'no',
						head: 'Not equivalent',
						means: MEANS.notEquivalent,
						detail: `They differ${assignment ? ` when ${assignment}` : ''}: the left statement is ${word(
							va
						)} and the right is ${word(vb)}.`
					};
				} else if (proof.chain) {
					result = { kind: 'chain', lines: proof.chain };
					verdict = {
						tone: 'yes',
						head: 'Equivalent',
						means: MEANS.equivalent,
						detail:
							proof.chain.length > 1
								? `A chain of ${steps(
										proof.chain.length - 1
								  )} turns the left statement into the right one, each line equivalent to the last.`
								: 'The two statements are written the same way, so there is nothing to prove.'
					};
				} else {
					result = {
						kind: 'both',
						left: proof.left,
						right: proof.right,
						table: propTable({ statements: [a, b], conclusion: null })
					};
					verdict = {
						tone: 'yes',
						head: 'Equivalent',
						means: MEANS.equivalent,
						detail:
							'They agree in every row of the truth table below, which proves it. Simplifying each side by the laws does not bring them to the same statement here, so both workings are shown.'
					};
				}
			}
		} catch (e) {
			result = null;
			verdict = null;
			errorA = e instanceof PropError ? e.message : 'Those statements could not be compared';
		}
	}

	$: tableLink = toolLink('/propositional-logic-truth-table', {
		s: right.trim() ? `${left.trim()}, ${right.trim()}` : left.trim()
	});

	function tryPair(a: string, b: string) {
		left = a;
		right = b;
		const field = document.getElementById('left');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	const examples = [
		{ label: 'Negated conditional', a: '¬(p → q)', b: 'p ∧ ¬q' },
		{ label: 'Contrapositive', a: 'p → q', b: '¬q → ¬p' },
		{ label: "De Morgan's law", a: '¬(p ∧ q)', b: '¬p ∨ ¬q' },
		{ label: 'Exportation', a: '(p ∧ q) → r', b: 'p → (q → r)' },
		{ label: 'Absorption', a: 'p ∨ (p ∧ q)', b: 'p' },
		{ label: 'Biconditional', a: 'p ↔ q', b: '(p ∧ q) ∨ (¬p ∧ ¬q)' },
		{ label: 'Tautology', a: '(p ∧ (p → q)) → q', b: '' },
		{ label: 'Converse (not equivalent)', a: 'p → q', b: 'q → p' }
	];

	// The reference table, each law checked by the engine at build time.
	const laws = checkedLaws();
	const lawGroups = [
		{ title: 'Laws for ¬, ∧, ∨ and ⊕', rows: laws.filter((l) => l.group === 'basic') },
		{ title: 'Laws for → and ↔', rows: laws.filter((l) => l.group === 'conditional') }
	];

	// The worked example, from the same engine as the calculator.
	const worked = simplifyProof(parseProp('(p ∧ q) → (p ∨ q)'));
	const rosen = equivalenceProof(parseProp('¬(p ∨ (¬p ∧ q))'), parseProp('¬p ∧ ¬q'));
	const rosenChain = rosen.equivalent ? rosen.chain : null;

	const faqs = [
		{
			q: 'How is this different from a truth table?',
			a: 'A truth table checks every combination of true and false and compares the results, which always settles the question but explains nothing. A proof by laws rewrites one statement into the other, one named law at a time, and shows why they say the same thing. This calculator decides equivalence by truth table first, so the verdict is always right, and then builds the chain of laws.'
		},
		{
			q: 'Which laws are allowed in a proof?',
			a: "The ones in the table of logical equivalences: identity, domination, idempotent, double negation, commutative, associative, distributive, De Morgan's, absorption and negation laws, plus the conditional and biconditional laws that remove → and ↔. The calculator also uses a few shortcuts from boolean algebra, such as the redundancy law p ∨ (¬p ∧ q) ≡ p ∨ q, each of which is itself proved by truth table in the tests. Like most textbooks, it sometimes reorders the terms of a conjunction or disjunction without a separate line for the commutative law."
		},
		{
			q: 'What is material implication?',
			a: 'It is the reading of "if p then q" used in logic: p → q is false only when p is true and q is false. That makes it equivalent to ¬p ∨ q, and the equivalence p → q ≡ ¬p ∨ q is also called the conditional law or the law of material implication. It is the first step in most proofs with →.'
		},
		{
			q: 'Why do proofs from different textbooks look different?',
			a: 'Because there is usually more than one route. Laws can be applied in a different order, a textbook may merge two steps into one or split one into two, and some books name the same law differently: domination is also called annulment, and the negation laws are also called complement laws. Any chain is a valid proof as long as each line follows from the one before by a law.'
		},
		{
			q: 'What does "applied in reverse" mean?',
			a: 'Every law is an equivalence, so it can be used in both directions. The calculator simplifies both statements until they meet, then walks back up the right-hand working. On that part of the proof each law runs from its simpler side to its longer side, which is marked in reverse.'
		},
		{
			q: 'How do I show a statement is a tautology?',
			a: 'Leave the second field empty. A statement is a tautology when it is equivalent to ⊤, so simplifying it by the laws until ⊤ is left proves it. The calculator also checks the truth table, so it will tell you if a statement is a tautology even when the laws alone do not reach ⊤.'
		},
		{
			q: 'How do I type the symbols?',
			a: `NOT: ¬, ~ or !. AND: ∧, & or ^. OR: ∨, | or v. IF-THEN: →, -> or =>. IF AND ONLY IF: ↔, <-> or iff. XOR: ⊕. Use single letters such as p, q and r, and ⊤ and ⊥ (or true and false) for the constants. Up to ${MAX_PROP_VARS} letters are allowed.`
		}
	];

	const page = {
		title: 'Logical Equivalence Calculator: Step-by-Step Proofs',
		description:
			'Prove two logic statements equivalent step by step, with the law named on every line, or test for a tautology. Includes the table of equivalences.',
		url: `${SITE}/logical-equivalence-calculator`,
		image: `${SITE}/og/logical-equivalence-calculator.png`,
		imageAlt: 'LogicGates.org: logical equivalence calculator with step-by-step proofs'
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
					{ '@type': 'ListItem', position: 3, name: 'Logical equivalence calculator' }
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
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Logical equivalence calculator</h1>
		<p class="lede">
			Type two statements from propositional logic and get a proof that they are equivalent, one law per line, the way a
			discrete maths course writes it. If they are not equivalent you get a counterexample. Leave the second field empty
			to simplify a statement or test whether it is a tautology.
		</p>

		<div class="card tool">
			<div class="pair">
				<div class="side">
					<label class="field" for="left">Statement</label>
					<input
						id="left"
						class="expression-input"
						type="text"
						bind:value={left}
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
						aria-describedby="statement-help"
					/>
				</div>
				<span class="equiv" aria-hidden="true">≡</span>
				<div class="side">
					<label class="field" for="right">Equivalent to? <span class="optional">(optional)</span></label>
					<input
						id="right"
						class="expression-input"
						type="text"
						bind:value={right}
						placeholder="leave empty to simplify"
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
						aria-describedby="statement-help"
					/>
				</div>
			</div>
			<p class="field-help" id="statement-help">
				<span class="mono">¬ ~ !</span> not,
				<span class="mono">∧ &amp; ^</span> and,
				<span class="mono">∨ | v</span> or,
				<span class="mono">→ -&gt;</span> if-then,
				<span class="mono">↔ &lt;-&gt; iff</span> if and only if,
				<span class="mono">⊕</span> xor, <span class="mono">⊤ ⊥</span> true and false.
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryPair(example.a, example.b)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if errorA || errorB}
				{#if errorA}<p class="error" role="status">Statement: {errorA}</p>{/if}
				{#if errorB}<p class="error" role="status">Second statement: {errorB}</p>{/if}
			{:else if result && verdict}
				<div class="verdict {verdict.tone}" role="status">
					<strong class="verdict-head">{verdict.head}</strong>
					<span class="verdict-detail">{verdict.detail}</span>
					<span class="verdict-means">{verdict.means}</span>
				</div>

				{#if result.kind === 'chain'}
					<ol class="proof" aria-label="Proof">
						{#each result.lines as line, i}
							<li>
								<span class="num">{i + 1}</span>
								<span class="mono statement">{i === 0 ? '' : '≡ '}{line.text}</span>
								<span class="law" class:start={i === 0}>
									{i === 0 ? 'Given' : line.law}{#if line.reversed}<span class="rev">, in reverse</span>{/if}
									{#if line.detail}<span class="law-detail">{line.detail}</span>{/if}
								</span>
							</li>
						{/each}
					</ol>
				{:else if result.kind === 'single'}
					<ol class="proof" aria-label="Simplification">
						{#each result.s.lines as line, i}
							<li>
								<span class="num">{i + 1}</span>
								<span class="mono statement">{i === 0 ? '' : '≡ '}{line.text}</span>
								<span class="law" class:start={i === 0}>
									{i === 0 ? 'Given' : line.law}
									{#if line.detail}<span class="law-detail">{line.detail}</span>{/if}
								</span>
							</li>
						{/each}
					</ol>
					{#if result.s.tooBig}
						<p class="note">
							This statement is too long to work through law by law, so the working stops here. The verdict above comes
							from the truth table.
						</p>
					{:else if result.s.stoppedEarly}
						<p class="note">
							The working stops after {result.s.lines.length - 1} lines to stay readable. The shortest equivalent form is
							<span class="mono">{result.s.minimalText}</span>, found by searching the truth table.
						</p>
					{:else if !result.s.isMinimal}
						<p class="note">
							The laws stop there. A search of the truth table finds the shorter form
							<span class="mono">{result.s.minimalText}</span>, which no single law here reaches.
						</p>
					{/if}
				{:else if result.kind === 'both'}
					<div class="both">
						{#each [result.left, result.right] as side, s}
							<div>
								<h3 class="side-head">{s === 0 ? 'Left statement' : 'Right statement'}</h3>
								<ol class="proof compact">
									{#each side.lines as line, i}
										<li>
											<span class="num">{i + 1}</span>
											<span class="mono statement">{i === 0 ? '' : '≡ '}{line.text}</span>
											<span class="law" class:start={i === 0}>
												{i === 0 ? 'Given' : line.law}
												{#if line.detail}<span class="law-detail">{line.detail}</span>{/if}
											</span>
										</li>
									{/each}
								</ol>
							</div>
						{/each}
					</div>
					<div class="table-scroll">
						<table class="data-table result-table">
							<thead>
								<tr>
									{#each result.table.variables as variable}
										<th scope="col" class="mono">{variable}</th>
									{/each}
									{#each result.table.statements as statement, i}
										<th scope="col" class="mono main" class:first={i === 0}>{statement.label}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each result.table.rows as row, r}
									<tr>
										{#each row as value}
											<td class={value ? 'bit-1' : 'bit-0'}>{tf(value)}</td>
										{/each}
										{#each result.table.statements as statement, i}
											<td class="{statement.values[r] ? 'bit-1' : 'bit-0'} main" class:first={i === 0}
												>{tf(statement.values[r])}</td
											>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else if result.kind === 'counter'}
					<p class="note">A counterexample: with these values the two statements come out differently.</p>
					<div class="table-scroll">
						<table class="data-table result-table">
							<thead>
								<tr>
									{#each result.variables as variable}
										<th scope="col" class="mono">{variable}</th>
									{/each}
									<th scope="col" class="mono main first">{result.aText}</th>
									<th scope="col" class="mono main">{result.bText}</th>
								</tr>
							</thead>
							<tbody>
								<tr class="counter">
									{#each result.variables as variable}
										{@const value = counterValues[variable]}
										<td class={value ? 'bit-1' : 'bit-0'}>{tf(value)}</td>
									{/each}
									<td class="{result.counter.a ? 'bit-1' : 'bit-0'} main first">{tf(result.counter.a)}</td>
									<td class="{result.counter.b ? 'bit-1' : 'bit-0'} main">{tf(result.counter.b)}</td>
								</tr>
							</tbody>
						</table>
					</div>
				{/if}

				<div class="export">
					<a class="button-link" href={tableLink}>See the full truth table</a>
					<ShareLink what="the proof" />
				</div>
			{/if}
		</div>
	</section>

	<section id="how">
		<h2>How to prove two statements are equivalent</h2>
		<p class="section-intro">
			Two statements are logically equivalent when they are true in exactly the same cases. There are two standard ways
			to show it.
		</p>
		<div class="methods">
			<div class="card method">
				<h3>By truth table</h3>
				<p>
					List every combination of true and false for the letters, work out both statements in each row, and compare
					the two columns. If they match in every row the statements are equivalent; one row where they differ shows
					they are not. It always works, but it grows fast: 2<sup>n</sup> rows for n letters.
				</p>
			</div>
			<div class="card method">
				<h3>By laws</h3>
				<p>
					Start from one statement and rewrite it, one known equivalence at a time, until it becomes the other. Name the
					law on every line. The usual order is to remove → and ↔ first, push negations inwards with De Morgan's laws,
					then simplify with the remaining laws.
				</p>
			</div>
		</div>
		<p class="reducer">
			This calculator does both. It decides the question by truth table, so the verdict is never wrong, then looks for a
			chain of laws. It simplifies both statements, and where the two workings reach the same statement it joins them,
			reading the right-hand working backwards. Every law holds in both directions, so that is still a valid proof.
		</p>
	</section>

	<section id="example">
		<h2>A worked example</h2>
		<p class="section-intro">
			Show that <span class="mono">(p ∧ q) → (p ∨ q)</span> is a tautology, that is, equivalent to ⊤:
		</p>
		<ol class="proof worked">
			{#each worked.lines as line, i}
				<li>
					<span class="num">{i + 1}</span>
					<span class="mono statement">{i === 0 ? '' : '≡ '}{line.text}</span>
					<span class="law" class:start={i === 0}>
						{i === 0 ? 'Given' : line.law}
						{#if line.detail}<span class="law-detail">{line.detail}</span>{/if}
					</span>
				</li>
			{/each}
		</ol>
		<p class="reducer">
			The conditional law removes the arrow, De Morgan's law pushes the negation inside the brackets, and then a letter
			sits next to its own negation in one big disjunction. One of the two is always true, so the whole disjunction is
			⊤. The statement is therefore true in every case{worked.tautology ? '' : ' (confirmed by truth table)'}.
		</p>
		{#if rosenChain}
			<p class="section-intro">
				A second one, found in many textbooks: <span class="mono">¬(p ∨ (¬p ∧ q))</span> ≡
				<span class="mono">¬p ∧ ¬q</span>
				(<a
					href={toolLink('/logical-equivalence-calculator', { a: '¬(p ∨ (¬p ∧ q))', b: '¬p ∧ ¬q' })}
					on:click|preventDefault={() => tryPair('¬(p ∨ (¬p ∧ q))', '¬p ∧ ¬q')}>try it above</a
				>). The calculator proves it in {rosenChain.length - 1} steps.
				{#if rosenChain.some((l) => l.law === 'Redundancy law')}
					Textbooks usually take longer, with De Morgan's law, the distributive law, the negation law and the identity
					law. The redundancy law, <span class="mono">p ∨ (¬p ∧ q) ≡ p ∨ q</span>, packs those steps into one; both
					routes are valid proofs.
				{/if}
			</p>
		{/if}
	</section>

	<section id="laws">
		<h2>Table of logical equivalences</h2>
		<p class="section-intro">
			The laws used in proofs, each written as a pair of equivalent statements. Every row was checked by truth table
			when this page was built; a tick means the two sides agree in every row.
		</p>
		{#each lawGroups as group}
			<h3 class="table-head">{group.title}</h3>
			<div class="table-scroll laws-scroll">
				<table class="data-table laws-table">
					<thead>
						<tr>
							<th scope="col">Law</th>
							<th scope="col">Equivalence</th>
							<th scope="col"
								><span class="visually-hidden">Checked by truth table</span><span aria-hidden="true">Table</span></th
							>
						</tr>
					</thead>
					<tbody>
						{#each group.rows as law, i}
							<tr class:continued={i > 0 && group.rows[i - 1].name === law.name}>
								<td class="law-name">{i > 0 && group.rows[i - 1].name === law.name ? '' : law.name}</td>
								<td class="mono eq"><span>{law.left}</span> <span>≡ {law.right}</span></td>
								<td class={law.proved ? 'bit-1' : 'bit-0'}>{law.proved ? '✓' : '✗'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
		<p class="reducer">
			The conditional law, <span class="mono">p → q ≡ ¬p ∨ q</span>, is also called material implication. With it, every
			law for → follows from the laws for ¬, ∧ and ∨. The same laws hold in boolean algebra with 1 for ⊤ and 0 for ⊥:
			see the <a href="/boolean-algebra-laws">boolean algebra laws</a> and
			<a href="/de-morgans-laws">De Morgan's laws</a>.
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

	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}

	.pair {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 0.7rem;
		align-items: end;
	}

	.equiv {
		color: #999;
		font-size: 1.4rem;
		padding-bottom: 0.45rem;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.optional {
		color: #999;
	}

	.expression-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.expression-input::placeholder {
		color: #888;
		font-size: 0.95rem;
	}

	.expression-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.7rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 1rem;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.verdict {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0 0 0.8rem;
		padding: 0.75rem 0.95rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-left-width: 4px;
		border-radius: 3px;
		background-color: rgba(255, 255, 255, 0.04);
	}

	.verdict.yes {
		border-color: #5db65d;
		background-color: rgba(51, 119, 34, 0.18);
	}

	.verdict.no {
		border-color: #e05555;
		background-color: rgba(190, 50, 50, 0.18);
	}

	.verdict-head {
		color: #fff;
		font-size: 1.2rem;
	}

	.verdict.yes .verdict-head {
		color: #8ede8e;
	}

	.verdict.no .verdict-head {
		color: #ff8a8a;
	}

	.verdict-detail {
		color: #ddd;
		font-size: 0.9rem;
		overflow-wrap: anywhere;
	}

	.verdict-means {
		color: #aaa;
		font-size: 0.82rem;
		margin-top: 0.35rem;
		padding-top: 0.4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
	}

	/* The proof: line number, statement, and the law that justifies it. */
	.proof {
		list-style: none;
		padding: 0;
		margin: 0.4rem 0 0;
	}

	.proof li {
		display: grid;
		grid-template-columns: 1.6rem minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 0.2rem 0.9rem;
		padding: 0.5rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		align-items: baseline;
	}

	.proof li:first-child {
		border-top: 0;
	}

	.num {
		color: #999;
		font-size: 0.8rem;
		text-align: right;
	}

	.statement {
		color: #fff;
		font-size: 1rem;
		overflow-wrap: anywhere;
	}

	.law {
		color: #8ede8e;
		font-size: 0.85rem;
	}

	.law.start {
		color: #999;
	}

	.rev {
		color: #bbb;
	}

	.law-detail {
		display: block;
		color: #999;
		font-size: 0.78rem;
		margin-top: 0.1rem;
		overflow-wrap: anywhere;
	}

	.worked {
		max-width: 760px;
		margin-bottom: 0.8rem;
	}

	.both {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
		margin-bottom: 0.8rem;
	}

	.side-head {
		font-size: 0.9rem;
		color: #ddd;
		margin: 0 0 0.2rem;
	}

	.compact li {
		grid-template-columns: 1.6rem minmax(0, 1fr);
	}

	.compact .law {
		grid-column: 2;
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.8rem 0 0.5rem;
	}

	/* Positioned, so hidden labels inside stay within the scroller. */
	.table-scroll {
		position: relative;
		overflow-x: auto;
		border-radius: 3px;
		margin-bottom: 0.4rem;
	}

	.result-table {
		width: auto;
		min-width: min(100%, 16rem);
	}

	.result-table th,
	.result-table td {
		text-align: center;
		padding-left: 0.9rem;
		padding-right: 0.9rem;
		white-space: nowrap;
	}

	.result-table .first {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.result-table .main {
		font-weight: 700;
	}

	.result-table tr.counter td {
		background-color: rgba(190, 50, 50, 0.25);
	}

	.export {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.button-link {
		display: inline-block;
		background: #0d0d0f;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
		text-decoration: none;
	}

	.button-link:hover {
		background-color: #372;
	}

	.methods {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
		margin-bottom: 0.8rem;
	}

	.method {
		padding: 0.9rem 1.1rem;
	}

	.method h3 {
		color: #fff;
		margin-top: 0;
	}

	.method p {
		color: #ddd;
		margin: 0;
	}

	.table-head {
		color: #fff;
		font-size: 1rem;
		margin: 1.2rem 0 0.4rem;
	}

	.laws-table {
		width: 100%;
	}

	.laws-table td,
	.laws-table th {
		text-align: left;
	}

	.laws-table td:last-child,
	.laws-table th:last-child {
		text-align: center;
		width: 4rem;
	}

	.laws-table tr.continued td {
		border-top-color: transparent;
	}

	.law-name {
		color: #ddd;
	}

	/* Each side stays whole, so a narrow screen breaks only at the ≡. */
	.eq span {
		display: inline-block;
		white-space: nowrap;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 620px) {
		.pair {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}

		.equiv {
			display: none;
		}

		.proof li {
			grid-template-columns: 1.6rem minmax(0, 1fr);
		}

		.proof .law {
			grid-column: 2;
		}

		.laws-table {
			font-size: 0.85rem;
		}

		.laws-table td,
		.laws-table th {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
		}

		.laws-table td:last-child,
		.laws-table th:last-child {
			width: 2.8rem;
		}
	}
</style>
