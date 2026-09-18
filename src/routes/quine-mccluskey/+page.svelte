<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		tabulate,
		parseIndices,
		variableNames,
		cubeTerm,
		MAX_TABULATION_VARS,
		type Tabulation
	} from '$lib/quineMcCluskey';
	import { onMount } from 'svelte';
	import { readUrl, syncUrl, safeText, safeInt, toolLink } from '$lib/urlState';

	// The worked example is the one most textbooks use, because its chart needs
	// every step of the method: two essential primes, then a choice for what is
	// left. Every table below is computed from these three fields, so editing
	// them reworks the whole example rather than just the answer.
	let varCount = 4;
	let mintermText = '4, 8, 10, 11, 12, 15';
	let dontCareText = '9, 14';

	// A worked example travels in the link, like every tool on the site, so a
	// particular function can be handed to someone.
	const DEFAULTS = { v: '4', m: '4, 8, 10, 11, 12, 15', d: '9, 14' };
	onMount(() => {
		const p = readUrl();
		varCount = safeInt(p.v, 1, MAX_TABULATION_VARS) ?? varCount;
		// A parameter that is present but empty means an empty box, not the default.
		if (p.m !== undefined) mintermText = safeText(p.m, 200) ?? '';
		if (p.d !== undefined) dontCareText = safeText(p.d, 200) ?? '';
	});
	$: syncUrl({ v: varCount, m: mintermText, d: dontCareText }, DEFAULTS);

	let error = '';
	let result: Tabulation;
	$: {
		try {
			result = tabulate(parseIndices(mintermText), parseIndices(dontCareText), variableNames(varCount));
			error = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
	$: variables = variableNames(varCount);
	// Indices past the last cell of the map are ignored, and it is worth saying so.
	$: dropped = [...parseIndices(mintermText), ...parseIndices(dontCareText)].filter((m) => m >= 1 << varCount);
	$: sigma = `Σm(${result.minterms.join(', ')})${
		result.dontCares.length ? ` + d(${result.dontCares.join(', ')})` : ''
	}`;
	$: chartRows = result.chart.rows;
	$: coveredByEssential = new Set(result.essential.flatMap((cube) => cube.covers));
	$: primeCount = result.primes.length;
	$: engineeringText = result.text;
	// The same function on the Karnaugh map solver, as a link, so the two methods
	// can be compared on identical input. The solver takes an expression, so the
	// minterms are written as a canonical sum of products.
	$: mapLink = toolLink('/karnaugh-map-solver', {
		expr:
			result.minterms
				.map((m) => variables.map((name, i) => (m & (1 << (varCount - 1 - i)) ? name : `!${name}`)).join(''))
				.join(' + ') || '0',
		dc: result.dontCares.join(', '),
		notation: 'engineering'
	});

	const faqs = [
		{
			q: 'What is the Quine-McCluskey method?',
			a: 'A procedure for finding a minimal sum of products for a boolean function. It lists the minterms in binary, repeatedly merges pairs that differ in one bit into terms with a dash in that position, keeps the terms that can no longer merge as prime implicants, and then chooses the fewest of those primes that between them cover every minterm. It gives the same answer as a Karnaugh map, but as a table rather than a picture, so it works for any number of variables and can be run by a computer.'
		},
		{
			q: 'When should you use Quine-McCluskey instead of a Karnaugh map?',
			a: 'When there are more than about five variables, when the function is given as a list of minterm numbers rather than a drawing, or when the minimisation has to be done by a program. A Karnaugh map is faster by hand for four variables or fewer because adjacency is visible; the tabular method is the same search done mechanically, so it does not get harder to read as the function grows, only longer.'
		},
		{
			q: 'What is a prime implicant?',
			a: "An implicant is a product term that is 1 only where the function is 1 (or a don't care), so it can safely be part of a sum of products for it. A prime implicant is an implicant that cannot be made any larger: removing any literal from it would make it cover a 0. In the tabulation, the primes are exactly the rows that never got ticked, because nothing would merge with them."
		},
		{
			q: 'What is an essential prime implicant?',
			a: 'A prime implicant that is the only one covering some minterm. That minterm has to be covered by something, and nothing else can do it, so every minimal expression must contain that prime. Finding the essentials first is what makes the chart manageable: the columns they cover are crossed off, and only the leftover minterms need a choice.'
		},
		{
			q: "What is Petrick's method?",
			a: 'A systematic way to choose which of the non-essential primes to keep. For every minterm still uncovered, write a sum of the primes that cover it; multiply all those sums together; expand and simplify with X + XY = X. Each product term in the result is a valid cover, and the shortest ones, with the fewest literals as a tiebreak, are the minimal answers. When two products tie there are two equally good expressions, and either is correct.'
		},
		{
			q: "How are don't cares handled in Quine-McCluskey?",
			a: 'They go into the tabulation as if they were 1s, so they can help form larger primes, but they are left out of the prime implicant chart, so nothing is obliged to cover them. That is exactly how a Karnaugh map treats an X: circle it when it enlarges a group, ignore it otherwise.'
		},
		{
			q: 'Why is the method rarely used for large functions?',
			a: 'The number of prime implicants can grow exponentially with the number of variables, and choosing a minimal cover from them is an NP-hard problem, so the exact method becomes slow past a few dozen variables. Synthesis tools use heuristic minimisers descended from Espresso instead, which give a near-minimal answer quickly. For anything you would do by hand, Quine-McCluskey is exact and fast enough.'
		}
	];

	const page = {
		title: 'Quine-McCluskey Method: Tabular Minimisation Step by Step',
		description:
			"How the Quine-McCluskey method minimises a boolean function: grouping minterms by 1s, merging into prime implicants, the prime implicant chart, essential primes and Petrick's method, worked on any function you type.",
		url: `${SITE}/quine-mccluskey`,
		image: `${SITE}/og/quine-mccluskey.png`,
		imageAlt: 'LogicGates.org: the Quine-McCluskey method'
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
				'@type': 'HowTo',
				'@id': `${page.url}#howto`,
				name: 'Minimise a boolean function with the Quine-McCluskey method',
				description: 'The tabular method, from a list of minterms to a minimal sum of products.',
				step: [
					{
						'@type': 'HowToStep',
						position: 1,
						name: 'Group the minterms by their number of 1s',
						url: `${page.url}#group`
					},
					{
						'@type': 'HowToStep',
						position: 2,
						name: 'Merge pairs that differ in one bit until nothing merges',
						url: `${page.url}#merge`
					},
					{ '@type': 'HowToStep', position: 3, name: 'Build the prime implicant chart', url: `${page.url}#chart` },
					{
						'@type': 'HowToStep',
						position: 4,
						name: 'Take the essential prime implicants',
						url: `${page.url}#essential`
					},
					{
						'@type': 'HowToStep',
						position: 5,
						name: "Cover what is left with Petrick's method",
						url: `${page.url}#petrick`
					}
				]
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Quine-McCluskey' }
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
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/sum-of-products-calculator', label: 'Sum of products calculator' },
		{ href: '/boolean-algebra-examples', label: 'Simplification examples' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/tools">Tools</a> <span aria-hidden="true">/</span>
			<span>Quine-McCluskey</span>
		</nav>
		<h1>The Quine-McCluskey method</h1>
		<p class="lede">
			The tabular way to minimise a boolean function: the same answer a Karnaugh map gives, reached by merging binary
			codes in a table instead of spotting rectangles in a picture. It works for any number of variables, which is why
			it is the algorithm inside every minimiser, including the ones on this site.
		</p>
	</section>

	<section id="what-it-does">
		<h2>What the method does</h2>
		<p>
			A <a href="/sum-of-products-calculator">sum of products</a> lists one product term per minterm, which is correct
			but wasteful: any two minterms that differ in a single variable can be replaced by one term without that variable,
			since <span class="mono">AB'C + ABC = AC</span>. The Quine-McCluskey method, published by Willard Quine in 1952
			and refined by Edward McCluskey in 1956, is that one rule applied exhaustively and then a second step that picks
			the fewest of the resulting terms. It has two halves:
		</p>
		<ol class="steps">
			<li>
				<strong>Find every prime implicant.</strong> Write the minterms in binary, merge any pair that differs in one bit
				into a term with a dash there, and repeat on the merged terms until nothing merges. Whatever never merged is a prime
				implicant: a product term that cannot be made any shorter.
			</li>
			<li>
				<strong>Choose a minimal cover.</strong> Draw a chart of primes against minterms. A prime that is the only cover
				of some minterm is essential and goes straight into the answer. The leftover minterms are covered by the smallest
				set of remaining primes, found with Petrick's method.
			</li>
		</ol>
		<p>
			A <a href="/karnaugh-map-solver">Karnaugh map</a> does both halves at once by eye, and for four variables that is faster.
			Past five, and for anything a program has to do, the table wins: it never gets harder to read, only longer.
		</p>
	</section>

	<section id="example">
		<h2>A worked example</h2>
		<p class="section-intro">
			Every table below is computed from the function in these boxes. The default is a classic textbook example,
			<span class="mono">f(A, B, C, D) = Σm(4, 8, 10, 11, 12, 15) + d(9, 14)</span>, chosen because it needs every step
			of the method. Change it and the whole worked example changes with it.
		</p>
		<form class="controls" on:submit|preventDefault>
			<label>
				Variables
				<select bind:value={varCount}>
					{#each Array.from({ length: MAX_TABULATION_VARS }, (_, i) => i + 1) as n}
						<option value={n}>{n}: {variableNames(n).join(', ')}</option>
					{/each}
				</select>
			</label>
			<label>
				Minterms
				<input type="text" bind:value={mintermText} spellcheck="false" autocomplete="off" />
			</label>
			<label>
				Don't cares
				<input type="text" bind:value={dontCareText} spellcheck="false" autocomplete="off" placeholder="none" />
			</label>
		</form>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{:else}
			{#if dropped.length}
				<p class="note" role="status">
					{dropped.length === 1 ? 'Index' : 'Indices'}
					{dropped.join(', ')}
					{dropped.length === 1 ? 'is' : 'are'} beyond the {1 << varCount} cells of a {varCount} variable map, so
					{dropped.length === 1 ? 'it is' : 'they are'} ignored.
				</p>
			{/if}
			<p class="reading">
				<span class="mono">f({variables.join(', ')}) = {sigma}</span>
				<span class="arrow">gives</span>
				<span class="mono answer">{engineeringText}</span>
			</p>
		{/if}
	</section>

	{#if !error}
		<section id="group">
			<h2>Step 1: group the minterms by their number of 1s</h2>
			<p>
				Write every minterm and don't care in {varCount} bit binary and sort them into groups by how many 1s they contain.
				Two codes can only differ in exactly one bit if their counts of 1s differ by exactly one, so from now on only neighbouring
				groups ever need comparing. The don't cares join in here: a don't care may help form a larger term, and only later,
				in the chart, is it excused from being covered.
			</p>
			<div class="table-wrap">
				<table class="data-table tab">
					<thead>
						<tr>
							<th scope="col">1s</th>
							<th scope="col">Minterm</th>
							{#each variables as v}
								<th scope="col" class="mono">{v}</th>
							{/each}
							<th scope="col">Merged?</th>
						</tr>
					</thead>
					<tbody>
						{#each result.passes[0].groups as group}
							{#each group.cubes as cube, i}
								<tr class:group-start={i === 0}>
									{#if i === 0}
										<th scope="rowgroup" rowspan={group.cubes.length} class="ones">{group.ones}</th>
									{/if}
									<td class="mono index">
										m{cube.covers[0]}{#if result.dontCares.includes(cube.covers[0])}<span class="dc" title="don't care"
												>d</span
											>{/if}
									</td>
									{#each cube.pattern.split('') as bit}
										<td class={bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
									{/each}
									<td class="tick">{cube.ticked ? '✓' : 'prime'}</td>
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section id="merge">
			<h2>Step 2: merge pairs that differ in one bit</h2>
			<p>
				Compare each code in a group with every code in the group below it. When two differ in a single bit, write them
				as one term with a dash in that position and tick both originals: the tick means the term has been absorbed into
				something larger, so it cannot be prime. Then do the same to the new column, merging only terms whose dashes are
				in the same place, until a pass produces nothing. Anything left unticked at any stage is a prime implicant.
				{#if result.passes.length > 1}
					This function takes {result.passes.length - 1} merging {result.passes.length === 2 ? 'pass' : 'passes'} and produces
					{primeCount} prime {primeCount === 1 ? 'implicant' : 'implicants'}.
				{:else}
					Nothing merges here, so every minterm is its own prime implicant.
				{/if}
			</p>
			<div class="passes">
				{#each result.passes.slice(1) as pass}
					<div class="table-wrap">
						<table class="data-table tab">
							<caption>
								{pass.dashes === 1
									? 'Pairs'
									: pass.dashes === 2
									? 'Groups of four'
									: pass.dashes === 3
									? 'Groups of eight'
									: `Groups of ${1 << pass.dashes}`}: {pass.dashes}
								{pass.dashes === 1 ? 'dash' : 'dashes'}
							</caption>
							<thead>
								<tr>
									<th scope="col">1s</th>
									<th scope="col">Minterms</th>
									{#each variables as v}
										<th scope="col" class="mono">{v}</th>
									{/each}
									<th scope="col">Merged?</th>
								</tr>
							</thead>
							<tbody>
								{#each pass.groups as group}
									{#each group.cubes as cube, i}
										<tr class:group-start={i === 0}>
											{#if i === 0}
												<th scope="rowgroup" rowspan={group.cubes.length} class="ones">{group.ones}</th>
											{/if}
											<td class="mono index">{cube.covers.join(',')}</td>
											{#each cube.pattern.split('') as bit}
												<td class={bit === '1' ? 'bit-1' : bit === '0' ? 'bit-0' : 'bit-x'}
													>{bit === '-' ? '–' : bit}</td
												>
											{/each}
											<td class="tick">{cube.ticked ? '✓' : 'prime'}</td>
										</tr>
									{/each}
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
			<p>A dash means the variable has dropped out. Reading the dashes back gives the product terms:</p>
			<ul class="primes mono">
				{#each result.primes as prime}
					<li>
						<span class="pattern">{prime.pattern.replace(/-/g, '–')}</span> is
						<span class="term">{cubeTerm(prime, variables)}</span>
					</li>
				{/each}
			</ul>
		</section>

		<section id="chart">
			<h2>Step 3: the prime implicant chart</h2>
			<p>
				One row per prime implicant, one column per minterm, and a mark wherever the prime covers the minterm. The don't
				cares get no column: they were allowed to help build the primes, but nothing is obliged to cover them. The
				question the chart answers is which rows, taken together, put a mark in every column.
			</p>
			<div class="table-wrap">
				<table class="data-table chart">
					<thead>
						<tr>
							<th scope="col">Prime</th>
							<th scope="col">Term</th>
							{#each result.chart.minterms as m}
								<th scope="col" class="mono" class:crossed={coveredByEssential.has(m)}>m{m}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each chartRows as row}
							<tr class:essential={row.essential} class:chosen={result.chosen.includes(row.cube)}>
								<th scope="row" class="mono">{row.cube.pattern.replace(/-/g, '–')}</th>
								<td class="mono term">{row.term}</td>
								{#each row.covers as covered, column}
									<td class="mark" class:crossed={coveredByEssential.has(result.chart.minterms[column])}>
										{#if covered}<span class:sole={result.chart.rows.filter((r) => r.covers[column]).length === 1}
												>×</span
											>{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="legend">
				A mark in a circle is the only one in its column, which makes its row essential. Highlighted rows are the ones
				in the final answer; struck-through columns are covered by an essential prime.
			</p>
		</section>

		<section id="essential">
			<h2>Step 4: take the essential prime implicants</h2>
			<p>
				A column with a single mark can only be covered by that one row, so the row is essential and must appear in any
				minimal expression.
				{#if result.essential.length}
					Here {result.essential.length === 1 ? 'one prime is' : `${result.essential.length} primes are`} essential:
					{#each result.essential as cube, i}<span class="mono term">{cubeTerm(cube, variables)}</span>{i <
						result.essential.length - 1
							? ', '
							: ''}{/each}. Cross off every column {result.essential.length === 1 ? 'it covers' : 'they cover'}, and
					{#if result.remaining.length}
						{result.remaining.length === 1 ? 'one minterm is' : `${result.remaining.length} minterms are`} still uncovered:
						{#each result.remaining as m, i}<span class="mono">m{m}</span>{i < result.remaining.length - 1
								? ', '
								: ''}{/each}.
					{:else}
						nothing is left: the essential primes cover the whole function, and the answer is complete.
					{/if}
				{:else}
					No column has a single mark, so nothing is essential and the whole cover has to be chosen in the next step.
				{/if}
			</p>
		</section>

		<section id="petrick">
			<h2>Step 5: cover what is left</h2>
			{#if result.remaining.length}
				<p>
					For each uncovered minterm, write the sum of the primes that could cover it, then multiply those sums together
					and expand. Every product in the result is a valid cover; the shortest, with the fewest literals if two tie,
					is the minimal choice. That is Petrick's method, and it is just the distributive law with
					<span class="mono">X + XY = X</span> applied as you go.
				</p>
				<div class="petrick mono">
					{#each result.remaining as m}
						<div class="factor">
							<span class="col">m{m}:</span>
							{result.primes
								.filter((p) => !result.essential.includes(p) && p.covers.includes(m))
								.map((p) => cubeTerm(p, variables))
								.join(' + ')}
						</div>
					{/each}
				</div>
				<p>
					{#if result.alternatives.length > 1}
						Expanding gives {result.alternatives.length} equally short covers, so the function has
						{result.alternatives.length} minimal forms:
					{:else}
						Expanding leaves one shortest cover:
					{/if}
				</p>
				<ul class="alternatives mono">
					{#each result.alternatives as cover, i}
						<li class:picked={i === 0}>
							{[...result.essential, ...cover].map((cube) => cubeTerm(cube, variables)).join(' + ')}
							{#if i === 0 && result.alternatives.length > 1}<span class="note">shown above</span>{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p>
					Nothing is left to cover, so this step is empty: the essential primes alone are the minimal expression. Try
					adding a minterm above, or the default example, to see a chart that needs a choice.
				</p>
			{/if}
			<p class="result">
				<span class="label">Minimal sum of products</span>
				<span class="mono answer">f = {engineeringText}</span>
				<span class="count">
					{result.chosen.length}
					{result.chosen.length === 1 ? 'term' : 'terms'}, down from
					{result.minterms.length}
					{result.minterms.length === 1 ? 'minterm' : 'minterms'}
				</span>
			</p>
			<p class="reducer">
				<a href={mapLink}>See the same function as a Karnaugh map</a>: the groups it circles are these primes.
			</p>
		</section>
	{/if}

	<section id="compare">
		<h2>Karnaugh map or Quine-McCluskey?</h2>
		<div class="table-wrap">
			<table class="data-table compare">
				<thead>
					<tr>
						<th scope="col" />
						<th scope="col">Karnaugh map</th>
						<th scope="col">Quine-McCluskey</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">How adjacency is found</th>
						<td>By eye: Gray code ordering puts neighbours next to each other</td>
						<td>By comparison: two codes that differ in one bit</td>
					</tr>
					<tr>
						<th scope="row">Comfortable size</th>
						<td>Up to 4 variables by hand, 6 at a stretch</td>
						<td>Any number; the table just gets longer</td>
					</tr>
					<tr>
						<th scope="row">Suits a program</th>
						<td>Poorly: it is a visual method</td>
						<td>Well: it is a list of mechanical steps</td>
					</tr>
					<tr>
						<th scope="row">Result</th>
						<td colspan="2">The same minimal sum of products; the circled groups are the prime implicants</td>
					</tr>
					<tr>
						<th scope="row">Cost for large functions</th>
						<td>Impractical</td>
						<td>Exponential in the worst case; real tools use heuristics such as Espresso</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p>
			The <a href="/boolean-algebra-calculator">boolean algebra calculator</a> on this site runs exactly this method on
			whatever expression you type, up to eight variables, and the
			<a href="/karnaugh-map-solver">Karnaugh map solver</a>
			draws the primes it finds as rectangles. The <a href="/boolean-algebra-examples">simplification examples</a> reach
			the same answers by algebra, one law at a time.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about the Quine-McCluskey method</h2>
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

	.steps {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.steps li {
		margin-bottom: 0.6rem;
	}

	.steps strong {
		color: #fff;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		margin: 1rem 0;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: #bbb;
		font-size: 0.85rem;
	}

	.controls input {
		min-width: 14rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.error {
		color: #f66;
	}

	.note {
		color: #e9c46a;
		font-size: 0.9rem;
	}

	.reading {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 0.8rem;
		color: #ddd;
	}

	.arrow {
		color: #888;
		font-size: 0.85rem;
	}

	.answer {
		color: #8ede8e;
		font-size: 1.05rem;
	}

	.tab caption {
		caption-side: top;
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding: 0.3rem 0;
	}

	.tab .ones {
		color: #8ede8e;
		vertical-align: top;
		text-align: center;
	}

	.tab .group-start td,
	.tab .group-start th {
		border-top: 1px solid rgba(255, 255, 255, 0.25);
	}

	.tab .index {
		color: #ddd;
		white-space: nowrap;
	}

	.dc {
		color: #e9c46a;
		font-size: 0.7rem;
		margin-left: 2px;
		vertical-align: super;
	}

	.tick {
		color: #888;
		font-size: 0.85rem;
	}

	.passes {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-start;
	}

	.primes {
		list-style: none;
		padding: 0;
		color: #ddd;
	}

	.primes li {
		margin: 0.2rem 0;
	}

	.pattern {
		color: #bbb;
		letter-spacing: 0.1em;
	}

	.term {
		color: #8ede8e;
	}

	.chart .mark {
		text-align: center;
		color: #fff;
	}

	.chart .sole {
		display: inline-block;
		width: 1.3em;
		height: 1.3em;
		line-height: 1.3em;
		border: 1px solid #8ede8e;
		border-radius: 50%;
		color: #8ede8e;
	}

	.chart tr.chosen th,
	.chart tr.chosen td {
		background: rgba(93, 182, 93, 0.14);
	}

	.chart .crossed {
		text-decoration: line-through;
		opacity: 0.55;
	}

	.legend {
		color: #999;
		font-size: 0.85rem;
	}

	.petrick {
		color: #ddd;
		margin: 0.6rem 0 1rem;
		padding-left: 0.5rem;
		border-left: 2px solid rgba(255, 255, 255, 0.2);
	}

	.factor {
		margin: 0.2rem 0;
	}

	.col {
		color: #888;
		display: inline-block;
		width: 3.2em;
	}

	.alternatives {
		list-style: none;
		padding: 0;
		color: #ddd;
	}

	.alternatives li {
		margin: 0.25rem 0;
	}

	.alternatives .picked {
		color: #8ede8e;
	}

	.note {
		color: #888;
		font-size: 0.8rem;
		margin-left: 0.6rem;
		font-family: system-ui, sans-serif;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 1rem 0;
		padding: 0.8rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.03);
	}

	.result .label {
		color: #bbb;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.result .answer {
		font-size: 1.2rem;
	}

	.result .count {
		color: #999;
		font-size: 0.85rem;
	}

	.compare td,
	.compare th[scope='row'] {
		text-align: left;
		white-space: normal;
	}

	.compare th[scope='row'] {
		color: #ddd;
		font-weight: 500;
	}
</style>
