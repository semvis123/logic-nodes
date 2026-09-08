<script lang="ts">
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseExpression,
		truthTable,
		karnaughMapFromCells,
		format,
		BooleanError,
		type Notation,
		type CellValue,
		type KMap,
		type Ast
	} from '$lib/boolean';

	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const SITE = 'https://nodes.kriyak.com';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { expr: 'a!b + abc + !a!bc', dc: '', notation: 'math', cells: '' };
	onMount(() => {
		const p = readUrl();
		expression = safeText(p.expr) ?? expression;
		dontCareInput = safeText(p.dc, 120) ?? dontCareInput;
		notation = safeOption(p.notation, ['math', 'engineering', 'programming'] as const) ?? notation;
		// A hand-drawn map travels as the cells themselves.
		const drawn = safeText(p.cells, 300);
		if (drawn && /^[01x]+$/.test(drawn) && Number.isInteger(Math.log2(drawn.length))) {
			const count = Math.log2(drawn.length);
			if (count >= 2 && count <= MAX_MAP_VARS) {
				variables = NAMES.slice(0, count);
				cells = drawn.split('').map((c) => (c === 'x' ? 'x' : c === '1' ? 1 : 0)) as CellValue[];
				sourceAst = null;
				custom = true;
				error = '';
				lastKey = `${expression}\u0000${dontCareInput}`;
			}
		}
	});
	$: syncUrl(
		{
			expr: custom ? '' : expression,
			dc: custom ? '' : dontCareInput,
			notation,
			cells: custom ? cells.map((c) => (c === 'x' ? 'x' : String(c))).join('') : ''
		},
		DEFAULTS
	);
	const MAX_MAP_VARS = 6;
	const NAMES = ['a', 'b', 'c', 'd', 'e', 'f'];

	let expression = 'a!b + abc + !a!bc';
	let dontCareInput = '';
	let notation: Notation = 'math';
	let selected: number | null = null;
	let blankVars = 4;

	// The cell values are the real state: the two inputs seed them, and clicking
	// a square edits them directly.
	let variables: string[] = [];
	let cells: CellValue[] = [];
	let sourceAst: Ast | null = null;
	let custom = false;
	let error = '';
	let lastKey = '';

	$: rebuild(expression, dontCareInput);

	function parseIndices(text: string, limit: number): Set<number> {
		const out = new Set<number>();
		for (const part of text.split(/[\s,;]+/).filter(Boolean)) {
			const value = Number(part.replace(/^[md]/i, ''));
			if (!Number.isInteger(value) || value < 0 || value >= limit) {
				throw new BooleanError(`"${part}" is not a row number between 0 and ${limit - 1}`);
			}
			out.add(value);
		}
		return out;
	}

	function rebuild(expr: string, dontCares: string) {
		const key = `${expr}\u0000${dontCares}`;
		if (key === lastKey) return;
		lastKey = key;
		try {
			const ast = parseExpression(expr);
			const table = truthTable(ast);
			if (table.variables.length < 2) throw new BooleanError('A map needs at least two variables');
			if (table.variables.length > MAX_MAP_VARS) {
				throw new BooleanError(`A Karnaugh map tops out at ${MAX_MAP_VARS} variables`);
			}
			const marked = parseIndices(dontCares, table.rows.length);
			variables = table.variables;
			cells = table.rows.map((value, i) => (marked.has(i) ? 'x' : value ? 1 : 0));
			sourceAst = ast;
			custom = false;
			selected = null;
			error = '';
		} catch (e) {
			error = e instanceof BooleanError ? e.message : 'That expression did not parse';
		}
	}

	$: map = variables.length ? karnaughMapFromCells(variables, cells, notation) : null;
	$: reading = sourceAst && !custom ? format(sourceAst, notation) : '';
	$: required = cells.filter((value) => value === 1).length;
	$: dontCareCount = cells.filter((value) => value === 'x').length;

	// Clicking a square walks it through the three states.
	function cycle(index: number) {
		const current = cells[index];
		cells[index] = current === 0 ? 1 : current === 1 ? 'x' : 0;
		cells = cells;
		custom = true;
		selected = null;
	}

	function blankMap(count: number) {
		variables = NAMES.slice(0, count);
		cells = Array(1 << count).fill(0) as CellValue[];
		sourceAst = null;
		custom = true;
		selected = null;
		error = '';
		expression = '';
		dontCareInput = '';
		// Match the key the empty inputs would produce, so the rebuild stays put.
		lastKey = '\u0000';
	}

	function reset() {
		lastKey = '';
		rebuild(expression, dontCareInput);
	}

	// Distinguishable on the dark canvas; the legend text carries the meaning
	// too, so colour is never the only signal.
	const COLORS = ['#5db65d', '#4d9de0', '#e0a44d', '#b06ed6', '#e05d7a', '#3fbfb0', '#c9d64d', '#8d8df0'];

	// Which groups cover a square. `sel` and `m` are passed in rather than read
	// from scope: Svelte only tracks what an expression mentions, and a stale
	// tint was surviving on squares whose group had gone away.
	function shownGroups(row: number, col: number, sel: number | null, m: KMap | null): number[] {
		if (!m) return [];
		const covering = m.groups.map((group, i) => (group.cells.includes(`${row},${col}`) ? i : -1)).filter((i) => i >= 0);
		return sel === null ? covering : covering.filter((i) => i === sel);
	}

	const tint = (row: number, col: number, sel: number | null, m: KMap | null) => {
		const shown = shownGroups(row, col, sel, m);
		return shown.length ? `background-color:${COLORS[shown[0] % COLORS.length]}33` : '';
	};

	const dimmed = (row: number, col: number, sel: number | null, m: KMap | null) =>
		sel !== null && !shownGroups(row, col, null, m).includes(sel);

	const examples = [
		{ label: 'Three variables', value: 'a!b + abc + !a!bc', dontCares: '' },
		{ label: 'Corner wrap', value: '!a!b!c!d + !a!bc!d + a!b!c!d + a!bc!d', dontCares: '' },
		{
			// The classic: the six unused BCD codes are free to be anything.
			label: "BCD ≥ 5, with don't cares",
			value: '!ab!cd + !abc!d + !abcd + a!b!c!d + a!b!cd',
			dontCares: '10, 11, 12, 13, 14, 15'
		},
		{ label: 'Majority of three', value: 'ab + bc + ac', dontCares: '' },
		{ label: 'Already minimal', value: 'a ^ b', dontCares: '' }
	];

	const faqs = [
		{
			q: "What is a don't care in a Karnaugh map?",
			a: 'A row whose output genuinely does not matter, because that input combination can never happen or because nothing downstream looks at it. Marking it X lets the minimiser treat it as either 0 or 1, whichever makes the groups bigger. The six unused codes of a binary coded decimal digit are the standard example.'
		},
		{
			q: "Do don't cares have to be covered?",
			a: "No, and that is the whole point. A group may swallow a don't care when doing so makes it larger, but leaving one outside every group costs nothing. The groups here are formed from the 1s and the X's together, and then only the 1s have to be covered."
		},
		{
			q: 'How do I read a Karnaugh map?',
			a: 'Each square is one row of the truth table. The labels along the edges are in Gray code, so neighbouring squares differ in exactly one variable. That is the whole trick: any rectangle of adjacent 1s whose size is a power of two collapses into a single product term, because the variables that change across the rectangle cancel out.'
		},
		{
			q: 'What are the grouping rules?',
			a: 'Groups must be rectangles of 1, 2, 4, 8 or more squares, always a power of two. They may overlap, and they wrap around the edges of the map, so the left column is adjacent to the right column and the top row to the bottom. Bigger groups are better, because each doubling removes one variable from the term.'
		},
		{
			q: 'How are the groups on this page chosen?',
			a: 'By Quine-McCluskey, which is the algebraic equivalent of drawing the rectangles: it finds all the prime implicants, keeps the ones that are essential, covers what is left and then drops any group the others already cover. The groups shown are exactly the terms in the simplified expression.'
		},
		{
			q: 'Why does the map stop at six variables?',
			a: `Past ${MAX_MAP_VARS} variables a Karnaugh map is harder to read than the algebra it replaces, which is why real designs switch to Quine-McCluskey or a synthesis tool. The boolean algebra calculator on this site will still simplify up to eight variables.`
		}
	];

	const page = {
		title: "Karnaugh Map Solver With Don't Cares: K-Map Simplifier",
		description:
			"Build a K-map from an expression or by clicking squares, mark don't cares, and get the groups highlighted with the minimal expression. Two to six variables.",
		url: `${SITE}/karnaugh-map-solver`,
		image: `${SITE}/og/karnaugh-map-solver.png`,
		imageAlt: 'Logic Nodes: karnaugh map solver'
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
					{ '@type': 'ListItem', position: 2, name: 'Karnaugh map solver' }
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
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Karnaugh map solver</h1>
		<p class="lede">
			Type an expression or click the squares to build a map, mark the rows you don't care about, and get every group
			drawn with the minimal expression underneath. Two to six variables, worked out in your browser.
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
						<button
							type="button"
							class="chip-btn"
							on:click={() => {
								expression = example.value;
								dontCareInput = example.dontCares;
							}}
						>
							{example.label}
						</button>
					{/each}
				</div>
				<ShareLink what="the map" />
				<label class="notation">
					Notation
					<select bind:value={notation}>
						<option value="math">Mathematical</option>
						<option value="engineering">Engineering</option>
						<option value="programming">Programming</option>
					</select>
				</label>
			</div>

			<div class="dont-care-row">
				<label class="field inline" for="dont-care-rows">Don't cares</label>
				<input
					id="dont-care-rows"
					class="dc-input"
					type="text"
					bind:value={dontCareInput}
					placeholder="row numbers, e.g. 10, 11, 12"
					spellcheck="false"
					autocomplete="off"
					aria-describedby="dont-care-help"
				/>
				<span class="blank-map">
					or
					<button type="button" class="link-btn" on:click={() => blankMap(blankVars)}> start blank </button>
					with
					<select bind:value={blankVars} aria-label="Variables for a blank map">
						{#each [2, 3, 4, 5, 6] as n}
							<option value={n}>{n}</option>
						{/each}
					</select>
					variables
				</span>
			</div>
			<p class="field-help" id="dont-care-help">
				Rows whose output does not matter, so a group may swallow them for free. You can also click any square to cycle
				it through 0, 1 and X.
			</p>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else if map}
				<p class="reading">
					{#if custom}
						<span class="badge">Edited by hand</span>
						{required} required, {dontCareCount} don't care
						{#if sourceAst}
							<button type="button" class="link-btn" on:click={reset}> reset to the expression </button>
						{/if}
					{:else}
						Reading it as <span class="mono">{reading}</span>
						{#if dontCareCount}
							· {dontCareCount} don't care{dontCareCount === 1 ? '' : 's'}
						{/if}
					{/if}
				</p>

				<div class="map-scroll">
					<table class="kmap" aria-label="Karnaugh map">
						<thead>
							<tr>
								<th scope="col" class="corner">
									<span class="corner-rows">{map.rowVars.join('')}</span>
									<span class="corner-cols">{map.colVars.join('')}</span>
								</th>
								{#each map.colLabels as label}
									<th scope="col" class="mono">{label}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each map.values as cellRow, r}
								<tr>
									<th scope="row" class="mono">{map.rowLabels[r]}</th>
									{#each cellRow as cellValue, c}
										{@const index = map.indices[r][c]}
										{@const shown = shownGroups(r, c, selected, map)}
										<td class="cell" class:dimmed={dimmed(r, c, selected, map)} style={tint(r, c, selected, map)}>
											<button
												type="button"
												class="cell-btn"
												on:click={() => cycle(index)}
												aria-label={`Row ${index}, currently ${
													cellValue === 'x' ? "don't care" : cellValue
												}. Click to change it.`}
											>
												<span class={cellValue === 'x' ? 'bit-x' : cellValue === 1 ? 'bit-1' : 'bit-0'}>
													{cellValue === 'x' ? 'X' : cellValue}
												</span>
												{#if shown.length}
													<span class="dots">
														{#each shown as g}
															<span class="dot" style="background-color:{COLORS[g % COLORS.length]}" />
														{/each}
													</span>
												{/if}
											</button>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if map.groups.length}
					<div class="legend">
						<span class="legend-label">Groups</span>
						{#each map.groups as group, i}
							<button
								type="button"
								class="group-btn"
								class:active={selected === i}
								on:click={() => (selected = selected === i ? null : i)}
								aria-pressed={selected === i}
							>
								<span class="swatch" style="background-color:{COLORS[i % COLORS.length]}" />
								<span class="mono">{group.term}</span>
								<span class="group-size">{group.size} {group.size === 1 ? 'cell' : 'cells'}</span>
							</button>
						{/each}
					</div>
					<p class="hint">Pick a group to see only its squares. Click a square to cycle it through 0, 1 and X.</p>
				{/if}

				<p class="result-line">
					<span class="result-label">Simplified</span>
					<span class="mono out">{map.text}</span>
				</p>
			{/if}
		</div>
	</section>

	<section>
		<h2>How a Karnaugh map works</h2>
		<p class="section-intro">
			A Karnaugh map is a truth table folded into a grid so that logical neighbours are physical neighbours. That one
			change turns simplification into pattern spotting.
		</p>
		<ol class="steps">
			<li>
				<strong>The edges count in <a href="/gray-code-converter">Gray code</a>.</strong> The column labels run 00, 01, 11,
				10 rather than in binary order, so moving one square changes exactly one variable. It is why the map works at all.
			</li>
			<li>
				<strong>Circle rectangles of 1s.</strong> Every group has to be a power of two: 1, 2, 4, 8. Inside a group of two,
				one variable takes both values, so it cancels and drops out of the term. Every doubling removes one more variable.
			</li>
			<li>
				<strong>The edges wrap.</strong> The left column touches the right column and the top row touches the bottom, as
				if the map were rolled into a torus. Corner squares can form a group of four.
			</li>
			<li>
				<strong>Overlap is free.</strong> Reusing a square in two groups costs nothing, so always take the biggest rectangle
				available.
			</li>
			<li>
				<strong>Treat X as whichever helps.</strong> A <a href="#dont-cares">don't care</a> counts as a 1 when it lets a
				group grow and as a 0 otherwise, and never needs covering on its own.
			</li>
			<li>
				<strong>OR the terms together.</strong> Each group is one AND term; the whole map is those terms ORed. That is your
				simplified sum of products.
			</li>
		</ol>
	</section>

	<section id="dont-cares">
		<h2>Don't cares</h2>
		<p class="section-intro">
			Sometimes a row of the truth table has no right answer, because the input can never occur or because nothing reads
			the output in that case. Those rows are free: the minimiser can treat them as 1 where that helps and 0 where it
			does not.
		</p>
		<p>
			The usual example is a binary coded decimal digit. Four bits can express sixteen values, but a decimal digit only
			uses ten of them, so the codes 1010 through 1111 never appear. A circuit deciding whether the digit is five or
			more does not have to produce anything sensible for those six, and saying so out loud makes it smaller.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">"BCD digit is 5 or more"</th>
						<th scope="col">Minimal expression</th>
						<th scope="col">Literals</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Unused codes forced to 0</th>
						<td class="mono">¬a ∧ b ∧ d ∨ ¬a ∧ b ∧ c ∨ a ∧ ¬b ∧ ¬c</td>
						<td>9</td>
					</tr>
					<tr>
						<th scope="row">Unused codes marked X</th>
						<td class="mono">a ∨ b ∧ d ∨ b ∧ c</td>
						<td>5</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Identical behaviour on every input that can actually happen, four fewer literals and a gate saved. Load it above
			with the <strong>BCD ≥ 5</strong> example, then clear the don't care box to watch the expression grow back.
		</p>
	</section>

	<section>
		<h2>Karnaugh map or boolean algebra?</h2>
		<p class="section-intro">They give the same answer; they suit different sizes of problem.</p>
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col">Approach</th>
					<th scope="col">Best at</th>
					<th scope="col">Falls apart when</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">Karnaugh map</th>
					<td>Two to four variables, done by eye in seconds</td>
					<td>Past six variables the grid stops being readable</td>
				</tr>
				<tr>
					<th scope="row">Algebraic rewriting</th>
					<td>Showing your working, and proofs</td>
					<td>It is easy to miss a simplification you did not think of</td>
				</tr>
				<tr>
					<th scope="row">Quine-McCluskey</th>
					<td>Any size, and it is mechanical, so a computer can do it</td>
					<td>Tedious by hand</td>
				</tr>
			</tbody>
		</table>
		<p class="reducer">
			This page runs Quine-McCluskey and draws the result as a map, so the groups you see are guaranteed to be a valid,
			irredundant cover rather than the first ones a human happened to spot. Irredundant means no group can be dropped;
			for a handful of awkward functions an exact solver can still find a cover with one term fewer.
		</p>
	</section>

	<section>
		<h2>Then build it</h2>
		<p class="section-intro">
			A simplified expression is worth checking against real gates. Paste it into the simulator with <kbd>ctrl</kbd
			>+<kbd>E</kbd> and you get the circuit, wired and running, with fewer gates than the version you started with.
		</p>
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

	.map-scroll {
		overflow-x: auto;
	}

	.kmap {
		border-collapse: collapse;
		margin-bottom: 1rem;
	}

	.kmap th {
		color: #888;
		font-weight: normal;
		font-size: 0.8rem;
		padding: 0.3rem 0.5rem;
	}

	.corner {
		position: relative;
		min-width: 3.2rem;
		height: 2.2rem;
		/* The classic diagonal split: rows label bottom-left, cols top-right. */
		background-image: linear-gradient(
			to top right,
			transparent calc(50% - 0.5px),
			rgba(255, 255, 255, 0.25) 50%,
			transparent calc(50% + 0.5px)
		);
	}

	.corner-rows {
		position: absolute;
		left: 0.3rem;
		bottom: 0.15rem;
	}

	.corner-cols {
		position: absolute;
		right: 0.3rem;
		top: 0.15rem;
	}

	.cell {
		padding: 0;
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.25);
		transition: background-color 0.15s ease;
		vertical-align: middle;
	}

	.cell-btn {
		width: 3.2rem;
		height: 3.2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		background: none;
		border: none;
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1.1rem;
		cursor: pointer;
	}

	.cell-btn:hover {
		background-color: rgba(255, 255, 255, 0.07);
	}

	.cell-btn:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}

	/* Don't cares read as neutral: neither high nor low. */
	.bit-x {
		color: #d8b45a;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.cell.dimmed {
		opacity: 0.35;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 3px;
	}

	.dont-care-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}

	.field.inline {
		margin-bottom: 0;
		white-space: nowrap;
	}

	.dc-input {
		flex: 1;
		min-width: 10rem;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 0.9rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.4rem 0.6rem;
	}

	.dc-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.blank-map {
		color: #888;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.blank-map select {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.15rem 0.2rem;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #8ede8e;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.badge {
		background-color: rgba(216, 180, 90, 0.18);
		border: 1px solid rgba(216, 180, 90, 0.6);
		color: #d8b45a;
		border-radius: 3px;
		font-size: 0.72rem;
		padding: 0.05rem 0.35rem;
		margin-right: 0.3rem;
	}

	.field-help {
		color: #888;
		font-size: 0.8rem;
		margin: 0.4rem 0 0.9rem;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		display: inline-block;
	}

	.legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 0.4rem;
	}

	.legend-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.2rem;
	}

	.group-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.group-btn:hover,
	.group-btn.active {
		border-color: #5db65d;
		color: #fff;
	}

	.swatch {
		width: 11px;
		height: 11px;
		border-radius: 2px;
		display: inline-block;
	}

	.group-size {
		color: #888;
		font-size: 0.75rem;
	}

	.hint {
		color: #888;
		font-size: 0.78rem;
		margin: 0.5rem 0 0;
	}

	.result-line {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
		margin: 1rem 0 0;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.result-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.result-line .out {
		color: #8ede8e;
		font-size: 1.25rem;
		word-break: break-word;
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
