<script lang="ts">
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseExpression,
		truthTable,
		simplify,
		format,
		equivalent,
		BooleanError,
		MAX_VARS,
		type Notation
	} from '$lib/boolean';
	import { laws, lawSlug } from '$lib/laws';
	import { simplifySteps, type Working } from '$lib/steps';

	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const SITE = 'https://nodes.kriyak.com';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = {
		expr: '!(a & b) | (a & !b)',
		notation: 'math',
		left: 'a ∧ (a ∨ b)',
		right: 'a'
	};
	onMount(() => {
		const p = readUrl();
		expression = safeText(p.expr) ?? expression;
		notation = safeOption(p.notation, ['math', 'engineering', 'programming'] as const) ?? notation;
		left = safeText(p.left) ?? left;
		right = safeText(p.right) ?? right;
	});
	$: syncUrl({ expr: expression, notation, left, right }, DEFAULTS);

	let expression = '!(a & b) | (a & !b)';
	let notation: Notation = 'math';

	// Everything is pure, so this also runs while prerendering: the shipped HTML
	// contains a real worked result instead of an empty box.
	let simplified = '';
	let original = '';
	let rowCount = 0;
	let trueRows = 0;
	let literalsBefore = 0;
	let literalsAfter = 0;
	let error = '';
	let working: Working | null = null;
	$: {
		try {
			const ast = parseExpression(expression);
			const table = truthTable(ast);
			const result = simplify(table, notation);
			working = simplifySteps(ast, notation);
			original = format(ast, notation);
			simplified = result.text;
			rowCount = table.rows.length;
			trueRows = result.minterms.length;
			literalsBefore = countLiterals(original);
			literalsAfter = result.termCount === 0 ? 0 : countLiterals(simplified);
			error = '';
		} catch (e) {
			simplified = '';
			working = null;
			error = e instanceof BooleanError ? e.message : 'That expression did not parse';
		}
	}

	// Rough size measure for the before/after line: how many variable mentions.
	function countLiterals(text: string): number {
		return (text.match(/[a-z]/gi) ?? []).length;
	}

	// --- equivalence checker ---
	let left = 'a ∧ (a ∨ b)';
	let right = 'a';
	let equivalenceResult: { same: boolean; message: string } | null = null;
	$: {
		try {
			const same = equivalent(parseExpression(left), parseExpression(right));
			equivalenceResult = {
				same,
				message: same
					? 'Equivalent: both sides have exactly the same truth table.'
					: 'Not equivalent: there is at least one row where the two disagree.'
			};
		} catch (e) {
			equivalenceResult = {
				same: false,
				message: e instanceof BooleanError ? e.message : 'One of those did not parse'
			};
		}
	}

	const notations = [
		{ id: 'math' as Notation, label: 'Mathematical', sample: '¬a ∧ b ∨ c' },
		{ id: 'engineering' as Notation, label: 'Engineering', sample: "a'b + c" },
		{ id: 'programming' as Notation, label: 'Programming', sample: '!a && b || c' }
	];

	const examples = [
		{ label: 'Redundant OR', value: 'ab + ab’ + a’b' },
		{ label: 'De Morgan', value: '!(a & b)' },
		{ label: 'Absorption', value: 'a | (a & b)' },
		{ label: 'Always true', value: 'a | !a' },
		{ label: 'Four variables', value: 'abc + abd + ab!c!d' }
	];

	const faqs = [
		{
			q: 'How does the simplification work?',
			a: 'The expression is turned into its truth table, and the table is reduced with the Quine-McCluskey algorithm: it finds the prime implicants, keeps the essential ones, covers whatever is left and then drops any term the others already cover. The result is an irredundant sum of products.'
		},
		{
			q: 'Can I see the steps?',
			a: 'Yes. Open "show the working" under the answer and the expression is rewritten one law at a time, with the law named on every line and a note on what it matched. That derivation is produced separately from the answer above it: it only ever applies a law, the way you would on paper, so you can copy it into your homework.'
		},
		{
			q: 'Why does the working sometimes stop before the minimal answer?',
			a: 'Because applying laws and minimising are different jobs. The laws are local rewrites, so a reduction that needs several terms considered together can have no single law that spells it out. The minimiser searches the whole truth table instead, so it always finds the smallest cover. When the two disagree the page shows both, rather than pretending a law got there.'
		},
		{
			q: 'Which notations can I type?',
			a: 'All of the common ones, mixed freely. AND as a·b, a&b, a∧b, a AND b or just ab; OR as a+b, a|b, a∨b or a OR b; NOT as !a, ~a, ¬a, a’ or NOT a; XOR as a^b, a⊻b or a XOR b. Note that ^ is read as XOR, and single letters are variables, so abc means a AND b AND c.'
		},
		{
			q: 'How many variables does it support?',
			a: `Up to ${MAX_VARS}. Beyond that the truth table gets impractically large for a page like this.`
		},
		{
			q: 'Can it check two expressions are the same?',
			a: 'Yes. The equivalence checker compares the full truth tables of both expressions over their combined variables, so it is a proof rather than a guess. Every law in the table on this page can be loaded into it.'
		},
		{
			q: 'Does the simulator itself do boolean algebra?',
			a: 'Yes. Logic Nodes turns any circuit into its boolean expression, and builds a circuit from an expression you paste in with ctrl+E. Optional simplification inside the simulator goes through the Wolfram Alpha API and needs your own free App ID in the settings; the calculator on this page needs nothing.'
		}
	];

	const page = {
		title: 'Boolean Algebra Calculator: Simplify Step by Step',
		description:
			'Simplify a boolean expression step by step, with the law named at every line, or check whether two expressions are equivalent. Free and runs in your browser.',
		url: `${SITE}/boolean-algebra-calculator`,
		image: `${SITE}/og/boolean-algebra-calculator.png`,
		imageAlt: 'Logic Nodes: boolean algebra calculator'
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
					{ '@type': 'ListItem', position: 2, name: 'Boolean algebra calculator' }
				]
			},
			{
				'@type': 'SoftwareApplication',
				'@id': `${SITE}/#app`,
				name: 'Logic Nodes',
				url: `${SITE}/`,
				applicationCategory: 'EducationalApplication',
				operatingSystem: 'Web browser',
				isAccessibleForFree: true,
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
				author: { '@id': 'https://kriyak.com/#person' }
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
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Boolean algebra calculator</h1>
		<p class="lede">
			Simplify an expression to its minimal sum of products, with the working shown one law at a time, or check whether
			two expressions are really the same. Both are exact: the answer comes from the complete truth table, worked out in
			your browser.
		</p>

		<div class="card tool">
			<label class="field" for="expression">Expression to simplify</label>
			<input
				id="expression"
				class="expression-input"
				type="text"
				bind:value={expression}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
			/>

			<div class="controls">
				<div class="chips">
					{#each examples as example}
						<button type="button" class="chip-btn" on:click={() => (expression = example.value)}>
							{example.label}
						</button>
					{/each}
				</div>
				<ShareLink what="the expression" />
				<label class="notation">
					Notation
					<select bind:value={notation}>
						{#each notations as option}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else}
				<div class="result" role="status">
					<p class="result-line">
						<span class="result-label">Input</span>
						<span class="mono">{original}</span>
					</p>
					<p class="result-line big">
						<span class="result-label">Simplified</span>
						<span class="mono out">{simplified}</span>
					</p>
					<p class="result-note">
						True in {trueRows} of {rowCount} rows.
						{#if literalsAfter && literalsAfter < literalsBefore}
							Down from {literalsBefore} to {literalsAfter} variable mentions.
						{:else if literalsAfter === literalsBefore}
							Already as short as a sum of products gets.
						{/if}
						<a href={toolLink('/truth-table-generator', { expr: expression })}>See the full truth table</a>
					</p>

					{#if working && !working.tooBig}
						<details class="working" open={working.steps.length > 0 && working.steps.length <= 8}>
							<summary>
								Show the working
								<span class="count"
									>{working.steps.length}
									{working.steps.length === 1 ? 'step' : 'steps'}</span
								>
							</summary>

							{#if working.steps.length === 0}
								<p class="working-note">
									There is nothing to do: no law applies to <span class="mono">{original}</span>, which is already as
									simple as the algebra makes it.
								</p>
							{:else}
								<ol class="steps-list">
									<li>
										<span class="step-law start">Start</span>
										<span class="mono step-text">{original}</span>
									</li>
									{#each working.steps as step}
										<li>
											<a class="step-law" href="/boolean-algebra-laws#{lawSlug(step.law)}">{step.law}</a>
											<span class="mono step-text">{step.text}</span>
											<span class="step-detail">{step.detail}</span>
										</li>
									{/each}
								</ol>

								<p class="working-note">
									{#if working.stoppedEarly}
										That is as far as this goes in {working.steps.length} steps. The minimiser reaches
										<span class="mono">{working.minimalText}</span>, by searching the truth table rather than by
										applying laws.
									{:else if working.isMinimal}
										Which is the same answer the minimiser gives, reached by laws alone.
									{:else}
										The laws stop there. The minimiser gets to <span class="mono">{working.minimalText}</span>: it
										searches the truth table for the smallest cover, so it can find reductions that no single law spells
										out.
									{/if}
								</p>
							{/if}
						</details>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2>Are these two the same?</h2>
		<p class="section-intro">
			Enter two expressions and they are compared row by row across every combination of their variables. That is a
			proof of equivalence, not a spot check.
		</p>
		<div class="card tool">
			<div class="pair">
				<div>
					<label class="field" for="left">Left</label>
					<input
						id="left"
						class="expression-input"
						type="text"
						bind:value={left}
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
					/>
				</div>
				<span class="equals" aria-hidden="true">=</span>
				<div>
					<label class="field" for="right">Right</label>
					<input
						id="right"
						class="expression-input"
						type="text"
						bind:value={right}
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
					/>
				</div>
			</div>
			{#if equivalenceResult}
				<p class="verdict {equivalenceResult.same ? 'yes' : 'no'}" role="status">
					{equivalenceResult.message}
				</p>
			{/if}
		</div>
	</section>

	<section>
		<h2>The laws of boolean algebra</h2>
		<p class="section-intro">
			The rewrites every simplification is built from. Pick any one to load it into the checker above and see it
			verified across the whole truth table.
		</p>
		<div class="table-wrap">
			<table class="data-table laws">
				<thead>
					<tr>
						<th scope="col">Law</th>
						<th scope="col">Identity</th>
						<th scope="col"><span class="visually-hidden">Check</span></th>
					</tr>
				</thead>
				<tbody>
					{#each laws as law}
						<tr>
							<th scope="row">{law.name}</th>
							<td class="mono">{law.left} &nbsp;=&nbsp; {law.right}</td>
							<td class="check-cell">
								<button
									type="button"
									class="chip-btn"
									on:click={() => {
										left = law.left;
										right = law.right;
										document.getElementById('left')?.scrollIntoView({ block: 'center' });
									}}
								>
									Check
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			De Morgan's laws are the ones worth memorising: they let you push a negation through a bracket, turning ANDs into
			ORs and back. Every <a href="/nand-nor-converter">NAND-only design</a> leans on them, and the
			<a href="/boolean-algebra-laws">full reference</a> proves each law with its truth table.
		</p>
	</section>

	<section>
		<h2>Three notations, one algebra</h2>
		<p class="section-intro">
			Textbooks, engineers and programmers each write the same operators differently. All three are accepted in the
			boxes above, and the simulator can render expressions in five styles.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Style</th>
						<th scope="col">AND</th>
						<th scope="col">OR</th>
						<th scope="col">NOT</th>
						<th scope="col">Example</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Mathematical</th>
						<td class="mono">∧</td>
						<td class="mono">∨</td>
						<td class="mono">¬</td>
						<td class="mono">¬a ∧ b ∨ c</td>
					</tr>
					<tr>
						<th scope="row">Engineering</th>
						<td class="mono">· or nothing</td>
						<td class="mono">+</td>
						<td class="mono">′</td>
						<td class="mono">a′b + c</td>
					</tr>
					<tr>
						<th scope="row">Programming</th>
						<td class="mono">&amp;&amp;</td>
						<td class="mono">||</td>
						<td class="mono">!</td>
						<td class="mono">!a &amp;&amp; b || c</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			One thing to watch: <span class="mono">^</span> is read as XOR here, as in most programming languages, even though
			a few textbooks use it for AND.
		</p>
	</section>

	<section>
		<h2>From algebra to an actual circuit</h2>
		<p class="section-intro">
			An expression is only half the story. In the simulator the two directions are one keystroke apart, so you can
			check your algebra against gates that really switch.
		</p>
		<ol class="steps">
			<li>
				<strong>Expression to circuit.</strong> On an empty canvas press <kbd>ctrl</kbd>+<kbd>E</kbd>
				and paste your expression. You get the wired circuit, ready to toggle.
			</li>
			<li>
				<strong>Circuit to expression.</strong> Build something from gates and choose
				<strong>Boolean expression</strong> from the toolbar to read it back as algebra, in whichever of the five notations
				you picked in the settings.
			</li>
			<li>
				<strong>Truth table either way.</strong> Print the table from a circuit, or press
				<kbd>ctrl</kbd>+<kbd>T</kbd> on an empty canvas to build a circuit from a table you fill in.
			</li>
		</ol>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
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
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
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

	.expression-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 0.7rem 0 1rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.notation {
		font-size: 0.8rem;
		color: #888;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.notation select {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.2rem 0.3rem;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.result {
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		padding-top: 0.9rem;
	}

	.result-line {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		margin: 0 0 0.5rem;
		flex-wrap: wrap;
	}

	.result-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 5.5rem;
	}

	.result-line.big .out {
		color: #8ede8e;
		font-size: 1.25rem;
		word-break: break-word;
	}

	.working {
		margin-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.8rem;
	}

	.working summary {
		cursor: pointer;
		color: #ddd;
		font-size: 0.9rem;
	}

	.working summary .count {
		color: #888;
		font-size: 0.8rem;
		margin-left: 0.4rem;
	}

	.steps-list {
		list-style: none;
		counter-reset: step;
		padding: 0;
		margin: 0.8rem 0 0;
	}

	.steps-list li {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
		gap: 0.2rem 0.8rem;
		padding: 0.35rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}

	.steps-list li:first-child {
		border-top: 0;
	}

	.step-law {
		color: #8ede8e;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		align-self: start;
		padding-top: 0.15rem;
	}

	/* The first row is where you came in, not a law that was applied. */
	.step-law.start {
		color: #888;
	}

	.step-text {
		color: #fff;
		font-size: 0.95rem;
		overflow-wrap: anywhere;
	}

	.step-detail {
		grid-column: 2;
		color: #999;
		font-size: 0.8rem;
	}

	.working-note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.8rem 0 0;
	}

	@media (max-width: 620px) {
		.steps-list li {
			grid-template-columns: 1fr;
		}

		.step-detail {
			grid-column: 1;
		}
	}

	.result-note {
		color: #888;
		font-size: 0.83rem;
		margin: 0.7rem 0 0;
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.8rem;
		align-items: end;
	}

	.equals {
		color: #888;
		font-size: 1.3rem;
		padding-bottom: 0.5rem;
	}

	@media (max-width: 620px) {
		.pair {
			grid-template-columns: 1fr;
		}

		.equals {
			display: none;
		}
	}

	.verdict {
		font-size: 0.9rem;
		margin: 0.9rem 0 0;
		padding: 0.5rem 0.7rem;
		border-radius: 3px;
		border: 1px solid;
	}

	.verdict.yes {
		color: #8ede8e;
		border-color: rgba(93, 182, 93, 0.6);
		background-color: rgba(51, 119, 34, 0.18);
	}

	.verdict.no {
		color: #f88;
		border-color: rgba(255, 51, 51, 0.5);
		background-color: rgba(255, 34, 51, 0.1);
	}

	.laws {
		width: 100%;
	}

	.laws .check-cell {
		text-align: right;
		width: 1%;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.steps {
		padding-left: 1.25rem;
		color: #ddd;
		max-width: 660px;
	}

	.steps li {
		margin-bottom: 0.8rem;
	}
</style>
