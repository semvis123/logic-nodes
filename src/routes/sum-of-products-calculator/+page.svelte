<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseExpression,
		truthTable,
		canonicalForms,
		format,
		BooleanError,
		type Notation,
		type TruthTable,
		type CanonicalForms
	} from '$lib/boolean';

	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { expr: 'a!b + abc + !a!bc', notation: 'math' };
	onMount(() => {
		const p = readUrl();
		expression = safeText(p.expr) ?? expression;
		notation = safeOption(p.notation, ['math', 'engineering', 'programming'] as const) ?? notation;
	});
	$: syncUrl({ expr: expression, notation }, DEFAULTS);

	let expression = 'a!b + abc + !a!bc';
	let notation: Notation = 'math';

	let table: TruthTable | null = null;
	let forms: CanonicalForms | null = null;
	let reading = '';
	let error = '';
	$: {
		try {
			const ast = parseExpression(expression);
			table = truthTable(ast);
			forms = canonicalForms(table, notation);
			reading = format(ast, notation);
			error = '';
		} catch (e) {
			table = null;
			forms = null;
			error = e instanceof BooleanError ? e.message : 'That expression did not parse';
		}
	}

	const examples = [
		{ label: 'Three variables', value: 'a!b + abc + !a!bc' },
		{ label: 'Majority of three', value: 'ab + bc + ac' },
		{ label: 'XOR', value: 'a ^ b' },
		{ label: 'Four variables', value: 'abcd + ab!cd + a!bcd' },
		{ label: 'Already minimal', value: 'a + b' }
	];

	const faqs = [
		{
			q: 'What is the difference between a minterm and a maxterm?',
			a: 'A minterm is one row of the truth table where the output is 1, written as an AND of every variable. A maxterm is a row where the output is 0, written as an OR of every variable with the polarities flipped. Every function is the OR of its minterms, and equally the AND of its maxterms, the two constant functions aside, where one of the two lists is empty.'
		},
		{
			q: 'What do Σm and ΠM mean?',
			a: 'They are shorthand for listing row numbers. Σm(1, 3, 5) means the sum, that is the OR, of minterms 1, 3 and 5. ΠM(0, 2, 4) means the product, that is the AND, of maxterms 0, 2 and 4. The two lists are complements of each other: every row is in exactly one of them.'
		},
		{
			q: 'What is the difference between canonical and minimal form?',
			a: 'Canonical form writes every variable in every term, so it maps one to one onto the truth table but is long. Minimal form is the same function with the redundancy removed by Quine-McCluskey, so it needs fewer gates. Both describe exactly the same behaviour.'
		},
		{
			q: 'Should I use sum of products or product of sums?',
			a: 'Whichever is smaller for your function, which usually means SOP when the output is mostly 0 and POS when it is mostly 1. Both are shown above so you can compare term counts. SOP maps directly onto AND gates feeding an OR, and POS onto OR gates feeding an AND.'
		}
	];

	const page = {
		title: 'Sum of Products Calculator: SOP, POS, Minterms & Maxterms',
		description:
			'Convert a boolean expression into canonical and minimal sum of products and product of sums, with minterm and maxterm lists. Free, in your browser.',
		url: `${SITE}/sum-of-products-calculator`,
		image: `${SITE}/og/sum-of-products-calculator.png`,
		imageAlt: 'Logic Nodes: sum of products calculator'
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
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Sum of products calculator' }
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
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Sum of products and product of sums</h1>
		<p class="lede">
			Type an expression and get its minterms, maxterms, and all four standard forms: canonical and minimal, SOP and
			POS. Everything is worked out in your browser.
		</p>

		<div class="card tool">
			<label class="field" for="expression">Boolean expression</label>
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
						<option value="math">Mathematical</option>
						<option value="engineering">Engineering</option>
						<option value="programming">Programming</option>
					</select>
				</label>
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else if forms && table}
				<p class="reading">Reading it as <span class="mono">{reading}</span></p>

				<div class="forms" role="status">
					<div class="form-row">
						<span class="form-label">Minterms</span>
						<span class="mono">{forms.sigma}</span>
						<span class="count">{forms.minterms.length} of {table.rows.length} rows</span>
					</div>
					<div class="form-row">
						<span class="form-label">Maxterms</span>
						<span class="mono">{forms.pi}</span>
						<span class="count">{forms.maxterms.length} of {table.rows.length} rows</span>
					</div>
					<div class="form-row split">
						<span class="form-label">Canonical SOP</span>
						<span class="mono long">{forms.canonicalSop}</span>
					</div>
					<div class="form-row split">
						<span class="form-label">Canonical POS</span>
						<span class="mono long">{forms.canonicalPos}</span>
					</div>
					<div class="form-row split highlight">
						<span class="form-label">Minimal SOP</span>
						<span class="mono long out">{forms.minimalSop}</span>
						<span class="count">{forms.sopTermCount} term{forms.sopTermCount === 1 ? '' : 's'}</span>
					</div>
					<div class="form-row split highlight">
						<span class="form-label">Minimal POS</span>
						<span class="mono long out">{forms.minimalPos}</span>
						<span class="count">{forms.posTermCount} term{forms.posTermCount === 1 ? '' : 's'}</span>
					</div>
				</div>

				<div class="table-wrap">
					<table class="data-table rows">
						<thead>
							<tr>
								<th scope="col" class="mono">#</th>
								{#each table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								<th scope="col" class="mono">Q</th>
								<th scope="col">Term</th>
							</tr>
						</thead>
						<tbody>
							{#each table.rows as value, row}
								<tr>
									<td class="index">{row}</td>
									{#each table.variables as _, bit}
										{@const on = !!(row & (1 << (table.variables.length - 1 - bit)))}
										<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
									{/each}
									<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
									<td class="term">{value ? `minterm m${row}` : `maxterm M${row}`}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2>Minterms and maxterms</h2>
		<p class="section-intro">
			Both are ways of naming a single row of the truth table. Which one you use depends on whether you are describing
			where the function is true or where it is false.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col" />
						<th scope="col">Minterm</th>
						<th scope="col">Maxterm</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Marks a row where</th>
						<td>the output is 1</td>
						<td>the output is 0</td>
					</tr>
					<tr>
						<th scope="row">Written as</th>
						<td>an AND of every variable</td>
						<td>an OR of every variable</td>
					</tr>
					<tr>
						<th scope="row">A 1 in the row means</th>
						<td class="mono">a</td>
						<td class="mono">¬a</td>
					</tr>
					<tr>
						<th scope="row">A 0 in the row means</th>
						<td class="mono">¬a</td>
						<td class="mono">a</td>
					</tr>
					<tr>
						<th scope="row">Combined with</th>
						<td>OR, giving a sum of products</td>
						<td>AND, giving a product of sums</td>
					</tr>
					<tr>
						<th scope="row">Notation</th>
						<td class="mono">Σm(…)</td>
						<td class="mono">ΠM(…)</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The polarities really do flip: minterm 2 of three variables is
			<span class="mono">¬a ∧ b ∧ ¬c</span>, while maxterm 2 is
			<span class="mono">a ∨ ¬b ∨ c</span>. One says "the output is 1 exactly here", the other says "the output is 0
			exactly here", so each rules out or pins down the same single row.
		</p>
	</section>

	<section>
		<h2>Canonical, then minimal</h2>
		<p class="section-intro">
			Canonical form comes straight off the truth table with no thinking involved, which is what makes it useful and
			also what makes it long. Minimising is what turns it into a circuit worth building.
		</p>
		<ol class="steps">
			<li>
				<strong>Read the rows.</strong> Every row where the output is 1 becomes one minterm, and ORing them together gives
				canonical SOP. It is guaranteed correct and almost always bigger than it needs to be.
			</li>
			<li>
				<strong>Merge the neighbours.</strong> Two terms differing in one variable collapse into one, by the adjacency
				law. Repeating that until nothing merges is the first half of Quine-McCluskey — the second half picks which of
				the groups it found to keep — and it is what circling groups on a
				<a href="/karnaugh-map-solver">Karnaugh map</a> does by eye.
			</li>
			<li>
				<strong>Try it from the other side.</strong> The minimal POS is found by minimising the rows where the output is
				0 and then complementing. For some functions it comes out smaller than the SOP, which is why both are shown above.
			</li>
			<li>
				<strong>Build it.</strong> Paste either form into the simulator with
				<kbd>ctrl</kbd>+<kbd>E</kbd> and compare the gate counts for yourself.
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

	.reading {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 0.8rem;
	}

	.forms {
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		padding-top: 0.9rem;
		margin-bottom: 1.1rem;
	}

	.form-row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.form-row.split {
		align-items: flex-start;
	}

	.form-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 7.5rem;
		flex: none;
	}

	.long {
		flex: 1;
		min-width: 0;
		word-break: break-word;
	}

	.highlight .out {
		color: #8ede8e;
		font-size: 1.05rem;
	}

	.count {
		color: #888;
		font-size: 0.75rem;
	}

	.rows {
		width: 100%;
	}

	.rows th,
	.rows td {
		text-align: center;
	}

	.rows .index,
	.rows .term {
		color: #888;
		font-size: 0.8rem;
	}

	.rows .term {
		text-align: left;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.steps {
		padding-left: 1.25rem;
		color: #ddd;
		max-width: 680px;
	}

	.steps li {
		margin-bottom: 0.8rem;
	}
</style>
