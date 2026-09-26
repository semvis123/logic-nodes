<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import VennDiagram from '$lib/VennDiagram.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		analyse,
		parseSet,
		formatSet,
		shade,
		sameShading,
		shortestExpression,
		subExpressions,
		regionsOf,
		vennSvg,
		regionWords,
		regionNotation,
		toBoolean,
		itemSlot,
		splitItems,
		encodeNames,
		decodeNames,
		encodeItems,
		decodeItems,
		MAX_NAME_LENGTH,
		MAX_ITEMS_LENGTH,
		SetError,
		SET_NAMES,
		type SetExpr,
		type VennResult,
		type RegionLabels
	} from '$lib/venn';
	import { variablesOf } from '$lib/boolean';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import { downloadSvg, downloadPng } from '$lib/download';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { s: 'A ∩ (B ∪ C)', sets: 'auto', labels: 'none', names: '', items: '' };
	type SetsOption = 'auto' | '1' | '2' | '3';
	const setOptions: SetsOption[] = ['auto', '1', '2', '3'];
	onMount(() => {
		const p = readUrl();
		input = safeText(p.s) ?? input;
		sets = safeOption(p.sets, ['auto', '1', '2', '3'] as const) ?? sets;
		labels = safeOption(p.labels, ['none', 'minterm', 'bits'] as const) ?? labels;
		// Both are bounded: names by length, items per region, so links stay short.
		names = decodeNames(safeText(p.names, 3 * (MAX_NAME_LENGTH + 1)));
		items = decodeItems(safeText(p.items, 8 * (MAX_ITEMS_LENGTH + 5)));
		if (p.names || p.items) customOpen = true;
	});
	$: syncUrl(
		{ s: input, sets, labels, names: encodeNames(names, result.n), items: encodeItems(items, result.n) },
		DEFAULTS
	);

	let input = DEFAULTS.s;
	let sets: SetsOption = 'auto';
	let labels: RegionLabels = 'none';

	// Names for A, B and C, and the items in each region, only drawn: the
	// expression keeps the letters. Items are kept by three-set region number,
	// so "in A only" keeps its items when the diagram gains or loses a set.
	let names: string[] = ['', '', ''];
	let items: string[] = new Array(8).fill('');
	let customOpen = false;
	$: shownNames = names.slice(0, result.n);
	$: shownItems = result.regions.map((r) => splitItems(items[itemSlot(r.index, result.n)] ?? ''));

	/** An example to start from: which birds fly. */
	function customExample() {
		input = 'A ∩ B';
		sets = 'auto';
		names = ['Birds', 'Can fly', ''];
		items = new Array(8).fill('');
		// Two sets: region 2 is A only, 3 is both, 1 is B only, 0 is neither.
		items[itemSlot(2, 2)] = 'penguin, ostrich, kiwi';
		items[itemSlot(3, 2)] = 'eagle, sparrow, owl';
		items[itemSlot(1, 2)] = 'bat, bee, butterfly';
		items[itemSlot(0, 2)] = 'cat, snail';
	}

	function clearCustom() {
		names = ['', '', ''];
		items = new Array(8).fill('');
	}

	// Runs during prerendering too, so the page ships with a real, shaded
	// diagram. On an error the last good diagram stays, dimmed.
	let result: VennResult = analyse(DEFAULTS.s);
	let error = '';
	$: {
		try {
			result = analyse(input, sets === 'auto' ? undefined : Number(sets));
			error = '';
		} catch (e) {
			error = e instanceof SetError ? e.message : 'That expression did not parse.';
		}
	}
	$: forcedUp = sets !== 'auto' && Number(sets) < result.n && !error;

	/** Clicking a region flips it, and the expression is rewritten to match. */
	function toggle(index: number) {
		const next = result.shaded.slice();
		next[index] = !next[index];
		if (sets === 'auto') sets = String(result.n) as SetsOption;
		input = formatSet(shortestExpression(next, result.n));
	}

	function clear() {
		if (sets === 'auto') sets = String(result.n) as SetsOption;
		input = '∅';
	}

	/**
	 * Loads an expression and scrolls up to the tool. A plain link to ?s= would
	 * only change the address bar, since the query string is read on mount.
	 */
	function tryExpression(expression: string) {
		input = expression;
		sets = 'auto';
		const field = document.getElementById('set-expression');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const fileName = (text: string) =>
		'venn-' +
		(text
			.replace(/∪/g, ' union ')
			.replace(/∩/g, ' and ')
			.replace(/−/g, ' minus ')
			.replace(/Δ/g, ' xor ')
			.replace(/′/g, ' c ')
			.replace(/∅/g, 'empty')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'diagram');

	const exportSvg = () =>
		vennSvg(result.n, result.shaded, { labels, title: result.text, names: shownNames, items: shownItems });

	function saveSvg() {
		downloadSvg(exportSvg(), `${fileName(result.text)}.svg`);
	}

	function savePng() {
		downloadPng(exportSvg(), `${fileName(result.text)}.png`);
	}

	const examples = [
		{ label: 'A ∪ B', value: 'A ∪ B' },
		{ label: 'A ∩ B', value: 'A ∩ B' },
		{ label: 'A − B', value: 'A − B' },
		{ label: '(A ∪ B)′', value: '(A ∪ B)′' },
		{ label: 'A′ ∩ B′', value: 'A′ ∩ B′' },
		{ label: 'A Δ B', value: 'A Δ B' },
		{ label: '(A ∩ B) ∪ C', value: '(A ∩ B) ∪ C' },
		{ label: 'A ∩ (B ∪ C)', value: 'A ∩ (B ∪ C)' },
		{ label: 'Exactly one of A, B, C', value: '(A − (B ∪ C)) ∪ (B − (A ∪ C)) ∪ (C − (A ∪ B))' }
	];

	/** One sentence on how a step's shading follows from the steps before it. */
	function howTo(e: SetExpr): string {
		const f = formatSet;
		switch (e.t) {
			case 'set':
				return `Shade the whole of circle ${e.name}.`;
			case 'empty':
				return 'The empty set: nothing is shaded.';
			case 'universe':
				return 'The universal set: everything is shaded.';
			case 'comp':
				return `Swap the shading of ${f(e.a)}: shade everything outside it.`;
			case 'union':
				return `Shade every region in ${f(e.a)} or ${f(e.b)}, or both.`;
			case 'inter':
				return `Keep only the regions shaded in both ${f(e.a)} and ${f(e.b)}.`;
			case 'diff':
				return `Start from ${f(e.a)} and remove every region of ${f(e.b)}.`;
			case 'sym':
				return `Shade the regions in ${f(e.a)} or ${f(e.b)} but not in both.`;
		}
	}

	type Step = { text: string; how: string; shaded: boolean[] };
	function stepsFor(r: VennResult): Step[] {
		const all = subExpressions(r.expr);
		// Single letters are only worth a step when they are the whole answer.
		const parts = all.length > 1 ? all.filter((e) => e.t !== 'set') : all;
		return parts.slice(-8).map((e) => ({ text: formatSet(e), how: howTo(e), shaded: shade(e, r.n) }));
	}
	$: steps = stepsFor(result);

	/** Karnaugh map cells: rows are A, columns the rest in Gray code order. */
	function kmapOf(n: number, shaded: boolean[]) {
		const gray = (bits: number) => (bits === 0 ? [0] : bits === 1 ? [0, 1] : [0, 1, 3, 2]);
		const rowBits = n === 1 ? 0 : 1;
		const colBits = n - rowBits;
		const pad = (v: number, bits: number) => (bits ? v.toString(2).padStart(bits, '0') : '');
		return {
			rowName: SET_NAMES.slice(0, rowBits).join(''),
			colName: SET_NAMES.slice(rowBits, n).join(''),
			cols: gray(colBits).map((c) => pad(c, colBits)),
			rows: gray(rowBits).map((r) => ({
				label: pad(r, rowBits),
				cells: gray(colBits).map((c) => {
					const index = (r << colBits) | c;
					return { index, on: shaded[index] };
				})
			}))
		};
	}
	$: kmap = kmapOf(result.n, result.shaded);
	// One region to point at in the text under the map: in A but not B, when there is a B.
	$: kmapExample = result.n === 1 ? 1 : (1 << (result.n - 1)) | (result.n === 3 ? 1 : 0);

	// The truth table and simplifier only list the letters an expression uses, so
	// with an unused set their rows are numbered differently from the regions here.
	$: usedSets = variablesOf(toBoolean(result.expr));
	$: missingSets = SET_NAMES.slice(0, result.n).filter((name) => !usedSets.includes(name));

	// Reference material, generated by the same engine as the tool.
	const mapping = regionsOf(shade(parseSet('A ∩ B ∩ C'), 3), 3);
	const deMorgan = [
		{ left: '(A ∪ B)′', right: 'A′ ∩ B′', words: 'Outside the union is outside both.' },
		{ left: '(A ∩ B)′', right: 'A′ ∪ B′', words: 'Outside the overlap is outside at least one.' }
	].map((law) => ({
		...law,
		leftShading: shade(parseSet(law.left), 2),
		rightShading: shade(parseSet(law.right), 2),
		checked: sameShading(parseSet(law.left), parseSet(law.right), 2)
	}));
	const deMorganTrap = !sameShading(parseSet('(A ∪ B)′'), parseSet('A′ ∪ B′'), 2);

	const faqs = [
		{
			q: 'How do I type the set symbols?',
			a: "Union: ∪, |, + or the word union, or a U between two sets (A U B). Intersection: ∩, &, n or intersect. Complement: A′, A', Aᶜ, A^c, ~A or not A. Difference: −, - or \\. Symmetric difference: Δ, ⊕ or xor. Use ∅ or {} for the empty set and U or ξ for the universal set. The sets are A, B and C; lowercase works too."
		},
		{
			q: 'Which operation comes first without brackets?',
			a: 'Here complement binds tightest, then intersection, then difference and symmetric difference (left to right), then union, so A ∪ B ∩ C means A ∪ (B ∩ C). Textbooks do not all agree on this order, so write the brackets. The generator always prints them in its answers, so they never depend on a convention.'
		},
		{
			q: 'Why does U mean both union and the universal set?',
			a: 'Because people type it for both, and the position always tells them apart. Between two sets, as in A U B, it can only be a union. Where a set is expected, as in U − A or A ∩ U, it is the universal set. For an unambiguous answer, use ∪ for union and U or ξ for the universal set.'
		},
		{
			q: 'How do I get the expression for a shaded diagram?',
			a: 'Click the regions. Each click shades or clears one region, and the expression box is rewritten with the shortest expression that shades exactly those regions. Clear shading starts from an empty diagram. With the keyboard, tab to a region and press Enter or Space.'
		},
		{
			q: 'How is the shortest expression found?',
			a: 'By search, not guesswork. For up to three sets there are only 256 possible shadings, so the generator builds every expression in order of length until each shading has one, counting every set and operator. The union of intersections next to it comes from the Quine-McCluskey method, the same minimisation the Karnaugh map solver uses.'
		},
		{
			q: 'How many regions does a Venn diagram have?',
			a: 'Two to the power of the number of sets, counting the region outside every circle: 2 for one set, 4 for two and 8 for three. Each region is one row of the truth table, because each set is either in or out, just as each variable is either 1 or 0.'
		},
		{
			q: 'Can I name the sets and put items in the regions?',
			a: 'Yes. Open "Name the sets and add items" under the diagram. A name such as Cats replaces the letter on the diagram, while the expression keeps using A, B and C. Type the items of each region separated by commas, and they are drawn inside it; a long list is shortened to fit, ending in a count of what is left out. The names and items are part of the link and of the SVG and PNG downloads.'
		},
		{
			q: 'Can I draw four sets?',
			a: 'Not here. Four circles cannot show all 16 regions, since some combinations would be missing; a four-set Venn diagram needs ellipses or other shapes. For four or more variables a Karnaugh map is easier to read, and the Karnaugh map solver goes up to six.'
		}
	];

	const page = {
		title: 'Venn Diagram Generator: Shade Any Set Expression',
		description:
			'Free Venn diagram maker for 2 or 3 sets: type a set expression like (A ∪ B)′ ∩ C to shade it, or click regions to get the expression. Export SVG or PNG.',
		url: `${SITE}/venn-diagram-generator`,
		image: `${SITE}/og/venn-diagram-generator.png`,
		imageAlt: 'LogicGates.org: Venn diagram generator'
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
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Venn diagram generator' }
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
		{ href: '/set-notation', label: 'Set notation and symbols' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<a href="/tools">Tools</a> <span aria-hidden="true">›</span>
			<span>Venn diagram generator</span>
		</nav>
		<h1>Venn diagram generator</h1>
		<p class="lede">
			Type a set expression and see its Venn diagram shaded, with every region listed as a row of a truth table. Or
			click the regions you want shaded and get the expression back. Name the sets, write items in the regions and
			download the diagram as an SVG or PNG.
		</p>

		<div class="card tool">
			<label class="field" for="set-expression">Set expression</label>
			<input
				id="set-expression"
				class="expression-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-describedby="set-help"
			/>
			<p class="field-help" id="set-help">
				Sets <span class="mono">A B C</span>. <span class="mono">∪ | + U</span> union,
				<span class="mono">∩ &amp; n</span> intersection, <span class="mono">A′ A' A^c ~A</span> complement,
				<span class="mono">− - \</span> difference, <span class="mono">Δ xor</span> symmetric difference,
				<span class="mono">∅ {'{}'}</span> empty set, <span class="mono">U ξ</span> universal set. Brackets are safest;
				see
				<a href="#faq">the order of operations</a>.
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryExpression(example.value)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{/if}

			<div class="result-grid" class:stale={!!error}>
				<div class="diagram">
					<div class="venn-main">
						<VennDiagram
							n={result.n}
							shaded={result.shaded}
							{labels}
							interactive
							names={shownNames}
							items={shownItems}
							label="Venn diagram of {result.text}"
							on:toggle={(event) => toggle(event.detail)}
						/>
					</div>
					<p class="diagram-help">
						Click a region, or tab to it and press Enter, to shade or clear it. The expression updates to match.
					</p>
				</div>

				<div class="answers">
					<dl>
						<div>
							<dt>Expression</dt>
							<dd class="mono">{result.text}</dd>
						</div>
						<div>
							<dt>Shortest form</dt>
							<dd class="mono shortest">{result.shortest}</dd>
						</div>
						<div>
							<dt>As a union of intersections</dt>
							<dd class="mono">{result.sop}</dd>
						</div>
						<div>
							<dt>Boolean algebra</dt>
							<dd>
								<span class="mono">{result.boolean}</span>
								<span class="links">
									<a href={toolLink('/boolean-algebra-calculator', { expr: result.boolean })}>Simplify</a>
									<a href={toolLink('/truth-table-generator', { expr: result.boolean })}>Truth table</a>
								</span>
								{#if missingSets.length}
									<span class="link-note">
										The expression does not use {missingSets.join(' or ')}, so the linked table leaves {missingSets.length ===
										1
											? 'it'
											: 'them'} out and numbers its rows differently from the regions here.
									</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt>Shaded regions (minterms)</dt>
							<dd class="mono">
								{result.minterms.length ? `Σm(${result.minterms.join(', ')})` : 'none'}
							</dd>
						</div>
					</dl>
					{#if forcedUp}
						<p class="note">This expression uses {SET_NAMES[result.n - 1]}, so it needs {result.n} sets.</p>
					{/if}
				</div>
			</div>

			<details class="custom" bind:open={customOpen}>
				<summary>Name the sets and add items</summary>
				<p class="custom-help">
					Names are drawn on the diagram; the expression keeps using the letters. Separate items with commas. A long
					list is shortened to fit its region. The link and the SVG and PNG downloads include both.
				</p>
				<div class="names">
					{#each SET_NAMES.slice(0, result.n) as letter, set}
						<label class="name-field">
							<span class="mono">{letter}</span>
							<input
								type="text"
								bind:value={names[set]}
								placeholder="Name for {letter}"
								maxlength={MAX_NAME_LENGTH}
								autocomplete="off"
							/>
						</label>
					{/each}
				</div>
				<ul class="item-fields">
					{#each result.regions as region (region.index)}
						<li>
							<label for="items-{region.index}">
								<span class="mono">{region.notation}</span>
								<span class="dim">{regionWords(region.index, result.n, shownNames)}</span>
							</label>
							<input
								id="items-{region.index}"
								type="text"
								bind:value={items[itemSlot(region.index, result.n)]}
								placeholder="Items, separated by commas"
								maxlength={MAX_ITEMS_LENGTH}
								autocomplete="off"
							/>
						</li>
					{/each}
				</ul>
				<div class="custom-actions">
					<button type="button" on:click={customExample}>Example: birds that fly</button>
					<button type="button" on:click={clearCustom}>Clear names and items</button>
				</div>
			</details>

			<div class="table-scroll">
				<table class="data-table regions" class:stale={!!error} aria-label="Regions of the diagram">
					<thead>
						<tr>
							<th scope="col">Row</th>
							{#each SET_NAMES.slice(0, result.n) as name}
								<th scope="col" class="mono">{name}</th>
							{/each}
							<th scope="col">Region</th>
							<th scope="col" class="words">In words</th>
							<th scope="col">Shaded</th>
						</tr>
					</thead>
					<tbody>
						{#each result.regions as region}
							<tr class:on={region.shaded}>
								<td class="mono">m{region.index}</td>
								{#each region.bits as bit}
									<td class={bit ? 'bit-1' : 'bit-0'}>{bit ? 1 : 0}</td>
								{/each}
								<td class="mono nowrap">{region.notation}</td>
								<td class="words">{regionWords(region.index, result.n, shownNames)}</td>
								<td class={region.shaded ? 'bit-1' : 'bit-0'}>{region.shaded ? 'Yes' : 'No'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="export">
				<div class="opt" role="group" aria-label="Number of sets">
					<span class="opt-label">Sets</span>
					{#each setOptions as option}
						<button
							type="button"
							class:active={sets === option}
							aria-pressed={sets === option}
							on:click={() => (sets = option)}>{option === 'auto' ? 'Auto' : option}</button
						>
					{/each}
				</div>
				<div class="opt" role="group" aria-label="Region labels">
					<span class="opt-label">Labels</span>
					<button
						type="button"
						class:active={labels === 'none'}
						aria-pressed={labels === 'none'}
						on:click={() => (labels = 'none')}>Off</button
					>
					<button
						type="button"
						class:active={labels === 'minterm'}
						aria-pressed={labels === 'minterm'}
						on:click={() => (labels = 'minterm')}>m0…</button
					>
					<button
						type="button"
						class:active={labels === 'bits'}
						aria-pressed={labels === 'bits'}
						on:click={() => (labels = 'bits')}>1/0</button
					>
				</div>
				<div class="opt" role="group" aria-label="Diagram">
					<button type="button" on:click={clear}>Clear shading</button>
					<button type="button" on:click={saveSvg}>SVG</button>
					<button type="button" on:click={savePng}>PNG</button>
				</div>
				<ShareLink what="the expression" />
			</div>
		</div>
	</section>

	<section id="step-by-step">
		<h2>How to shade a Venn diagram, step by step</h2>
		<p class="section-intro">
			Work from the inside out, as with arithmetic: shade the innermost brackets first, then combine. Each diagram below
			is one step of <span class="mono">{result.text}</span>, and it changes with the expression above.
		</p>
		<ol class="steps-grid">
			{#each steps as step, i}
				<li class="card step" class:final={i === steps.length - 1}>
					<VennDiagram n={result.n} shaded={step.shaded} small label="Step {i + 1}: {step.text}" />
					<p class="step-title"><span class="step-number">{i + 1}</span> <span class="mono">{step.text}</span></p>
					<p class="step-how">{step.how}</p>
				</li>
			{/each}
		</ol>
		<p class="reducer">
			For an intersection, a region is shaded only if it is shaded in both parts. For a union, if it is shaded in
			either. A complement swaps shaded and unshaded, including the region outside every circle.
		</p>
	</section>

	<section id="truth-tables">
		<h2>Venn diagrams and truth tables</h2>
		<p class="section-intro">
			A point of the diagram is either in A or not, in B or not, in C or not. That is three yes-or-no answers, like
			three variables that are each 1 or 0, so the eight regions of a three-set diagram are exactly the eight rows of a
			three-variable truth table. Each region is one minterm.
		</p>
		<div class="mapping">
			<div class="mapping-diagram">
				<VennDiagram
					n={3}
					shaded={new Array(8).fill(false)}
					labels="bits"
					label="Three-set Venn diagram with each region labelled by its row of the truth table"
				/>
			</div>
			<div class="table-scroll">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col" class="mono">A</th>
							<th scope="col" class="mono">B</th>
							<th scope="col" class="mono">C</th>
							<th scope="col">Region</th>
							<th scope="col">Minterm</th>
						</tr>
					</thead>
					<tbody>
						{#each mapping as region}
							<tr>
								{#each region.bits as bit}
									<td class={bit ? 'bit-1' : 'bit-0'}>{bit ? 1 : 0}</td>
								{/each}
								<td class="mono nowrap">{region.notation}</td>
								<td class="mono">m{region.index}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
		<p class="reducer">
			So shading a Venn diagram and filling in the output column of a truth table are the same job. Union is OR,
			intersection is AND and complement is NOT, which is why the generator can hand every expression to the
			<a href="/truth-table-generator">truth table generator</a> and the
			<a href="/boolean-algebra-calculator">boolean algebra calculator</a>. The symbols are listed side by side on the
			<a href="/set-notation">set notation</a> page.
		</p>
	</section>

	<section id="de-morgan">
		<h2>De Morgan's laws for sets</h2>
		<p class="section-intro">
			The complement of a union is the intersection of the complements, and the other way round. Shade both sides and
			the diagrams come out identical.
		</p>
		<div class="law-grid">
			{#each deMorgan as law}
				<div class="card law">
					<div class="law-pair">
						<figure>
							<VennDiagram n={2} shaded={law.leftShading} small label={law.left} />
							<figcaption class="mono">{law.left}</figcaption>
						</figure>
						<span class="equals" aria-hidden="true">=</span>
						<figure>
							<VennDiagram n={2} shaded={law.rightShading} small label={law.right} />
							<figcaption class="mono">{law.right}</figcaption>
						</figure>
					</div>
					<p class="law-note">
						{law.words}
						{#if law.checked}<span class="checked">Same regions in both, checked by the engine.</span>{/if}
					</p>
				</div>
			{/each}
		</div>
		{#if deMorganTrap}
			<p class="reducer">
				A common slip is to complement each set and keep the operator: <span class="mono">(A ∪ B)′</span> is not
				<span class="mono">A′ ∪ B′</span>, which shades everything except the overlap.
				<a
					href={toolLink('/venn-diagram-generator', { s: 'A′ ∪ B′' })}
					on:click|preventDefault={() => tryExpression('A′ ∪ B′')}>Shade it</a
				>. The same laws for logic gates are on <a href="/de-morgans-laws">De Morgan's laws</a>.
			</p>
		{/if}
	</section>

	<section id="karnaugh">
		<h2>Venn diagrams and Karnaugh maps</h2>
		<p class="section-intro">
			A Karnaugh map is a Venn diagram with square regions. Each cell is one region, laid out so that neighbouring cells
			differ in one set, which makes the groups easy to see. Here is <span class="mono">{result.text}</span> as a map:
		</p>
		<div class="kmap-wrap">
			<div class="kmap-diagram">
				<VennDiagram n={result.n} shaded={result.shaded} small labels="minterm" label="Venn diagram of {result.text}" />
			</div>
			<table class="data-table kmap">
				<thead>
					<tr>
						<th scope="col" class="mono corner">{kmap.rowName ? `${kmap.rowName} \\ ${kmap.colName}` : kmap.colName}</th
						>
						{#each kmap.cols as col}
							<th scope="col" class="mono">{col}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each kmap.rows as row}
						<tr>
							<th scope="row" class="mono">{row.label || '–'}</th>
							{#each row.cells as cell}
								<td class={cell.on ? 'bit-1 on' : 'bit-0'}>
									{cell.on ? 1 : 0}<span class="cell-index">m{cell.index}</span>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The labels match: region m{kmapExample} of the diagram,
			<span class="mono nowrap">{regionNotation(kmapExample, result.n)}</span>, is cell m{kmapExample} of the map. Past three
			sets circles run out of room, and a map keeps going: the
			<a href="/karnaugh-map-solver">Karnaugh map solver</a> handles up to six variables.
		</p>
	</section>

	<section class="faq" id="faq">
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
		padding-top: 48px;
	}

	.crumbs {
		font-size: 0.8rem;
		color: #999;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #999;
	}

	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
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
		margin: 0 0 0.7rem;
	}

	.stale {
		opacity: 0.45;
	}

	.result-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 1.2rem;
		align-items: start;
		margin-bottom: 1rem;
	}

	.diagram-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0;
	}

	.answers dl {
		margin: 0;
	}

	.answers dl > div {
		padding: 0.55rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.answers dl > div:first-child {
		padding-top: 0;
	}

	.answers dt {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.2rem;
	}

	.answers dd {
		margin: 0;
		color: #fff;
		font-size: 1.05rem;
		overflow-wrap: anywhere;
	}

	.answers .shortest {
		color: #8ede8e;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.links {
		display: inline-flex;
		gap: 0.8rem;
		margin-left: 0.6rem;
		font-size: 0.85rem;
		font-family: system-ui, sans-serif;
	}

	.link-note {
		display: block;
		color: #bbb;
		font-size: 0.8rem;
		font-family: system-ui, sans-serif;
		margin-top: 0.3rem;
	}

	.custom {
		margin: 0 0 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.8rem;
	}

	.custom summary {
		cursor: pointer;
		color: #ddd;
		font-size: 0.9rem;
	}

	.custom-help {
		color: #bbb;
		font-size: 0.82rem;
		margin: 0.6rem 0 0.8rem;
	}

	.names {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 8px;
		margin-bottom: 0.9rem;
	}

	.name-field {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: #fff;
	}

	.custom input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 0.9rem;
		padding: 0.35rem 0.5rem;
	}

	.custom input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.custom input::placeholder {
		color: #999;
	}

	.item-fields {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.item-fields li {
		display: grid;
		grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
		gap: 0.3rem 0.8rem;
		align-items: center;
		padding: 0.3rem 0;
	}

	.item-fields label {
		font-size: 0.85rem;
		color: #fff;
		overflow-wrap: anywhere;
	}

	.item-fields .dim {
		display: block;
		color: #aaa;
		font-size: 0.78rem;
	}

	.custom-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 0.7rem;
	}

	.custom-actions button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}

	.custom-actions button:hover {
		border-color: #5db65d;
	}

	.note {
		color: #ddd;
		font-size: 0.85rem;
		margin: 0.6rem 0 0;
	}

	.table-scroll {
		overflow-x: auto;
		border-radius: 3px;
	}

	.regions {
		width: 100%;
	}

	.regions td,
	.regions th {
		text-align: center;
	}

	.regions .words {
		text-align: left;
	}

	.regions tr.on td {
		background-color: rgba(51, 119, 34, 0.16);
	}

	.nowrap {
		white-space: nowrap;
	}

	.export {
		display: flex;
		align-items: center;
		gap: 0.8rem 1.1rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.opt {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.opt-label {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.15rem;
	}

	.opt button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.opt button:hover {
		border-color: #5db65d;
	}

	.opt button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.steps-grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 12px;
	}

	.step {
		padding: 0.7rem 0.8rem 0.8rem;
	}

	.step.final {
		border-color: #5db65d;
	}

	.step-title {
		margin: 0.55rem 0 0.25rem;
		color: #fff;
		overflow-wrap: anywhere;
	}

	.step-number {
		display: inline-block;
		min-width: 1.4rem;
		color: #8ede8e;
		font-weight: 700;
	}

	.step-how {
		color: #bbb;
		font-size: 0.82rem;
		margin: 0;
	}

	.mapping {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1.2rem;
		align-items: start;
	}

	.mapping .data-table td,
	.mapping .data-table th {
		text-align: center;
	}

	.law-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 12px;
	}

	.law {
		padding: 0.9rem 1rem 1rem;
	}

	.law-pair {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.law-pair figure {
		flex: 1;
		margin: 0;
		min-width: 0;
	}

	.law-pair figcaption {
		text-align: center;
		color: #fff;
		margin-top: 0.35rem;
	}

	.equals {
		color: #ddd;
		font-size: 1.4rem;
	}

	.law-note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.7rem 0 0;
	}

	.checked {
		display: block;
		color: #8ede8e;
		margin-top: 0.25rem;
	}

	.checked::before {
		content: '✓ ';
	}

	.kmap-wrap {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.2rem;
	}

	.kmap-diagram {
		width: 280px;
		max-width: 100%;
	}

	.kmap-diagram :global(svg) {
		max-width: 100%;
	}

	.mapping-diagram {
		max-width: 400px;
	}

	.step :global(svg) {
		margin: 0 auto;
	}

	.kmap {
		width: auto;
	}

	.kmap th,
	.kmap td {
		text-align: center;
		min-width: 2.6rem;
	}

	.kmap td {
		font-size: 1.05rem;
		line-height: 1.1;
	}

	.kmap td.on {
		background-color: rgba(51, 119, 34, 0.25);
	}

	.cell-index {
		display: block;
		font-size: 0.7rem;
		color: #aaa;
	}

	@media (max-width: 720px) {
		.result-grid,
		.mapping {
			grid-template-columns: minmax(0, 1fr);
		}

		.regions .words {
			display: none;
		}

		.item-fields li {
			grid-template-columns: minmax(0, 1fr);
		}

		.data-table.regions th,
		.data-table.regions td {
			padding-left: 0.4rem;
			padding-right: 0.4rem;
			font-size: 0.8rem;
		}

		.tool {
			padding: 0.9rem 0.8rem 1rem;
		}
	}
</style>
