<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parsePropInput,
		propTable,
		classify,
		checkArgument,
		equivalenceGroups,
		PropError,
		MAX_PROP_VARS,
		type PropTable,
		type Column
	} from '$lib/propositional';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { s: '(p → q) ∧ ¬q → ¬p', order: 'tf', working: 'on' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.s) ?? input;
		order = safeOption(p.order, ['tf', '01'] as const) ?? order;
		working = safeOption(p.working, ['on', 'off'] as const) ?? working;
	});
	$: syncUrl({ s: input, order, working }, DEFAULTS);

	let input = DEFAULTS.s;
	let order: 'tf' | '01' = 'tf';
	let working: 'on' | 'off' = 'on';

	type Shown = Column & { main: boolean; conclusion: boolean };

	/**
	 * The columns to draw: the working, then the statements, then the
	 * conclusion. The conclusion always gets its own final column, even when a
	 * premise reads the same, so every premise the verdict rests on is shown.
	 */
	function columnsOf(table: PropTable, withWorking: boolean): Shown[] {
		const statementLabels = new Set(table.statements.map((c) => c.label));
		const conclusionLabel = table.conclusion?.label;
		const shown: Shown[] = [];
		const add = (c: Column, conclusion = false) => {
			if (shown.some((s) => s.label === c.label && s.conclusion === conclusion)) return;
			shown.push({ ...c, main: conclusion || statementLabels.has(c.label), conclusion });
		};
		if (withWorking) {
			// The conclusion's own step is left for its final column.
			for (const step of table.steps) {
				if (step.label !== conclusionLabel || statementLabels.has(step.label)) add(step);
			}
		}
		// A statement that is a single letter or constant has no working column.
		table.statements.forEach((c) => add(c));
		if (table.conclusion) add(table.conclusion, true);
		return withWorking ? shown : shown.filter((c) => c.main);
	}

	type Verdict = {
		tone: 'yes' | 'no' | 'neutral';
		head: string;
		/** What the term means in general, for anyone meeting it for the first time. */
		means: string;
		/** The section of this page that explains it further. */
		more: string;
		/** What it means for this particular table. */
		detail: string;
	};

	const TERMS = {
		tautology: {
			means: 'A tautology is a statement that is true in every row, whatever its letters stand for.',
			more: '#by-hand'
		},
		contradiction: {
			means: 'A contradiction is a statement that is false in every row, whatever its letters stand for.',
			more: '#by-hand'
		},
		contingency: {
			means:
				'A contingency is a statement that is true in some rows and false in others: whether it holds depends on its letters.',
			more: '#by-hand'
		},
		valid: {
			means:
				'An argument is valid when its conclusion is true in every row where all of its premises are true, so true premises can never lead to a false conclusion.',
			more: '#arguments'
		},
		invalid: {
			means:
				'An argument is invalid when at least one row makes every premise true and the conclusion false. Such a row is called a counterexample.',
			more: '#arguments'
		},
		equivalent: {
			means:
				'Statements are logically equivalent when they have the same truth value in every row, so each can replace the other.',
			more: '#equivalence'
		}
	};

	// Runs during prerendering too, so the page ships with a real, crawlable
	// truth table rather than an empty widget.
	let table: PropTable | null = null;
	let columns: Shown[] = [];
	let verdict: Verdict | null = null;
	let critical = new Set<number>();
	let counter = new Set<number>();
	let error = '';
	$: {
		try {
			table = propTable(parsePropInput(input), order === '01');
			columns = columnsOf(table, working === 'on');
			critical = new Set();
			counter = new Set();
			if (table.conclusion) {
				const result = checkArgument(table);
				critical = new Set(result.critical);
				counter = new Set(result.counterexamples);
				const rowsWord = (n: number) => (n === 1 ? 'one row' : `${n} rows`);
				verdict = !result.valid
					? {
							tone: 'no',
							head: 'Invalid argument',
							...TERMS.invalid,
							detail: `Here ${
								counter.size === 1 ? 'one row makes' : `${counter.size} rows make`
							} every premise true and the conclusion false, marked in red.`
					  }
					: {
							tone: 'yes',
							head: 'Valid argument',
							...TERMS.valid,
							detail: result.critical.length
								? `Here the premises are all true in ${rowsWord(
										result.critical.length
								  )}, marked in green, and the conclusion is true ${
										result.critical.length === 1 ? 'there too' : 'in each of them'
								  }.`
								: 'Here the premises are never all true at once, so no row could be a counterexample.'
					  };
			} else if (table.statements.length === 1) {
				const values = table.statements[0].values;
				const kind = classify(values);
				const high = values.filter(Boolean).length;
				verdict = {
					tone: kind === 'tautology' ? 'yes' : kind === 'contradiction' ? 'no' : 'neutral',
					head: kind[0].toUpperCase() + kind.slice(1),
					...TERMS[kind],
					detail:
						kind === 'contingency'
							? `Here it is true in ${high} of ${values.length} rows and false in ${values.length - high}.`
							: `Here all ${values.length} rows come out ${mark(kind === 'tautology')} in the last column.`
				};
			} else {
				const groups = equivalenceGroups(table.statements).filter((g) => g.length > 1);
				verdict = {
					tone: groups.length ? 'yes' : 'no',
					head: !groups.length
						? 'Not equivalent'
						: groups.length === 1 && groups[0].length === table.statements.length
						? 'Equivalent'
						: 'Some are equivalent',
					...TERMS.equivalent,
					detail: groups.length
						? 'Here these match in every row: ' +
						  groups.map((g) => g.map((i) => table!.statements[i].label).join(' ≡ ')).join(';  ') +
						  '.'
						: 'Here each pair differs in at least one row.'
				};
			}
			error = '';
		} catch (e) {
			table = null;
			error = e instanceof PropError ? e.message : 'That statement did not parse';
		}
	}

	/**
	 * Loads a statement into the calculator and scrolls up to it. A plain link
	 * to ?s= would only change the address bar, since the query string is read
	 * once, on mount.
	 */
	function tryStatement(statement: string) {
		input = statement;
		const field = document.getElementById('statement');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const mark = (v: boolean) => (order === '01' ? (v ? '1' : '0') : v ? 'T' : 'F');

	const examples = [
		{ label: 'Conditional', value: 'p → q' },
		{ label: 'Contrapositive', value: 'p → q, ¬q → ¬p, q → p' },
		{ label: 'Modus ponens', value: 'p → q, p ∴ q' },
		{ label: 'Affirming the consequent', value: 'p → q, q ∴ p' },
		{ label: "De Morgan's law", value: '¬(p ∧ q) ↔ ¬p ∨ ¬q' },
		{ label: 'Three letters', value: '(p ∨ q) ∧ (q → r)' }
	];

	// Reference tables, from the same engine as the calculator.
	const tf = (v: boolean) => (v ? 'T' : 'F');
	const reference = (s: string) => propTable(parsePropInput(s));
	const connectives = [
		{ name: 'Negation', symbol: '¬p', reads: 'not p', note: 'flips the truth value' },
		{ name: 'Conjunction', symbol: 'p ∧ q', reads: 'p and q', note: 'true only when both are true' },
		{ name: 'Disjunction', symbol: 'p ∨ q', reads: 'p or q', note: 'true when at least one is true' },
		{ name: 'Conditional', symbol: 'p → q', reads: 'if p then q', note: 'false only when p is true and q is false' },
		{ name: 'Biconditional', symbol: 'p ↔ q', reads: 'p if and only if q', note: 'true when both have the same value' }
	].map((c) => ({ ...c, table: reference(c.symbol) }));

	const worked = reference('(p → q) ∧ ¬q → ¬p');
	const family = reference('p → q, q → p, ¬p → ¬q, ¬q → ¬p');
	const familyNames = ['Conditional', 'Converse', 'Inverse', 'Contrapositive'];
	const affirming = reference('p → q, q ∴ p');
	const affirmingResult = checkArgument(affirming);

	const faqs = [
		{
			q: 'How do I type the symbols?',
			a: 'Any common notation works. NOT: ¬, ~, ! or not. AND: ∧, &, ^ or and. OR: ∨, |, + or the word or, and a lone v between two letters works too. IF-THEN: →, ->, =>, ⊃ or implies. IF AND ONLY IF: ↔, <->, <=>, ≡ or iff. XOR: ⊕. Each statement letter is a single letter such as p, q or r, and ⊤ and ⊥ (or true and false) are constants.'
		},
		{
			q: 'Why is "if p then q" true when p is false?',
			a: 'Because a conditional only makes a promise about what happens when p is true. When p is false the promise is not broken, whatever q is, so the statement counts as true; logicians call this vacuously true. The only row that breaks "if it rains, the street is wet" is the one where it rains and the street stays dry.'
		},
		{
			q: 'How many rows does a truth table need?',
			a: `Two to the power of the number of statement letters: 2 rows for one letter, 4 for two, 8 for three, 16 for four. This calculator goes up to ${MAX_PROP_VARS} letters, which is 64 rows.`
		},
		{
			q: 'Which order do the rows go in?',
			a: 'Logic textbooks start from all true and end with all false, halving the pattern in each column: the first letter is TTTTFFFF for three letters, the next TTFFTTFF, the last TFTFTFTF. Computer science counts up in binary from all zeros instead. Both list every combination exactly once; switch between them with the order option.'
		},
		{
			q: 'How do I check whether an argument is valid?',
			a: 'Type the premises separated by commas, then ∴ (or "therefore") and the conclusion, as in "p → q, p ∴ q". The argument is valid when every row that makes all the premises true also makes the conclusion true. A row where the premises are true and the conclusion false is a counterexample, and one is enough to make it invalid.'
		},
		{
			q: 'How do I show two statements are logically equivalent?',
			a: 'Separate them with commas. They are equivalent when their columns match in every row, or equally when the biconditional between them is a tautology. The contrapositive example shows p → q and ¬q → ¬p agreeing everywhere, while the converse q → p does not.'
		},
		{
			q: 'Is this the same as a logic gate truth table?',
			a: 'Yes, with different notation. T and F are 1 and 0, ∧ is an AND gate, ∨ is OR and ¬ is NOT. The conditional p → q has no gate of its own; it is ¬p ∨ q. The biconditional is an XNOR gate. For circuit expressions the truth table generator uses the engineering notation, where ab means a AND b.'
		}
	];

	const page = {
		title: 'Truth Table Calculator for Logic Statements: →, ↔, ¬',
		description:
			'Truth tables for propositional logic: type a statement like p → q and see every step. Checks tautologies, equivalence and argument validity.',
		url: `${SITE}/propositional-logic-truth-table`,
		image: `${SITE}/og/propositional-logic-truth-table.png`,
		imageAlt: 'LogicGates.org: truth table calculator for logic statements'
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
					{ '@type': 'ListItem', position: 3, name: 'Logic statement truth tables' }
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
		{ href: '/truth-table-generator', label: 'Truth table generator (circuits)' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Truth tables for logic statements</h1>
		<p class="lede">
			Type a statement from propositional logic, such as p → q, and get its full truth table with a column for every
			step. Several statements at once are checked for equivalence, and premises followed by ∴ and a conclusion are
			checked for validity.
		</p>

		<div class="card tool">
			<label class="field" for="statement">Statement</label>
			<input
				id="statement"
				class="expression-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-describedby="statement-help"
			/>
			<p class="field-help" id="statement-help">
				<span class="mono">¬ ~ !</span> not,
				<span class="mono">∧ &amp; ^</span> and,
				<span class="mono">∨ | v</span> or,
				<span class="mono">→ -&gt; =&gt;</span> if-then,
				<span class="mono">↔ &lt;-&gt; iff</span> if and only if,
				<span class="mono">⊕</span> xor. Separate statements with <span class="mono">,</span> to compare them; put
				<span class="mono">∴</span> or <span class="mono">therefore</span> before a conclusion to test an argument.
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => (input = example.value)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else if table}
				{#if verdict}
					<div class="verdict {verdict.tone}" role="status">
						<strong class="verdict-head">{verdict.head}</strong>
						<span class="verdict-detail">{verdict.detail}</span>
						<span class="verdict-means">{verdict.means} <a href={verdict.more}>More on this</a></span>
					</div>
				{/if}
				<div class="table-scroll">
					<table class="data-table result">
						<thead>
							<tr>
								{#each table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								{#each columns as column, i}
									<th scope="col" class="mono" class:first={i === 0} class:main={column.main} class:step={!column.main}>
										{column.conclusion ? '∴ ' : ''}{column.label}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each table.rows as row, r}
								<tr class:critical={critical.has(r) && !counter.has(r)} class:counter={counter.has(r)}>
									{#each row as value}
										<td class={value ? 'bit-1' : 'bit-0'}>{mark(value)}</td>
									{/each}
									{#each columns as column, i}
										{@const value = column.values[r]}
										<td
											class={value ? 'bit-1' : 'bit-0'}
											class:first={i === 0}
											class:main={column.main}
											class:step={!column.main}>{mark(value)}</td
										>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="export">
					<div class="opt" role="group" aria-label="Row order">
						<span class="opt-label">Rows</span>
						<button
							type="button"
							class:active={order === 'tf'}
							aria-pressed={order === 'tf'}
							on:click={() => (order = 'tf')}>T first</button
						>
						<button
							type="button"
							class:active={order === '01'}
							aria-pressed={order === '01'}
							on:click={() => (order = '01')}>0 first, as 1/0</button
						>
					</div>
					<div class="opt" role="group" aria-label="Working">
						<span class="opt-label">Working</span>
						<button
							type="button"
							class:active={working === 'on'}
							aria-pressed={working === 'on'}
							on:click={() => (working = 'on')}>Every step</button
						>
						<button
							type="button"
							class:active={working === 'off'}
							aria-pressed={working === 'off'}
							on:click={() => (working = 'off')}>Answer only</button
						>
					</div>
					<ShareLink what="the statement" />
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2>The five connectives</h2>
		<p class="section-intro">
			Every statement in propositional logic is built from single letters and these five. Each is defined by nothing
			more than its truth table.
		</p>
		<div class="gate-grid">
			{#each connectives as c}
				<div class="card gate">
					<h3>{c.name}<span class="gate-symbol mono">{c.symbol}</span></h3>
					<table class="data-table small">
						<thead>
							<tr>
								{#each c.table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								<th scope="col" class="mono">{c.symbol}</th>
							</tr>
						</thead>
						<tbody>
							{#each c.table.rows as row, r}
								<tr>
									{#each row as value}
										<td class={value ? 'bit-1' : 'bit-0'}>{tf(value)}</td>
									{/each}
									<td class={c.table.statements[0].values[r] ? 'bit-1' : 'bit-0'}>
										{tf(c.table.statements[0].values[r])}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="gate-note">Read "{c.reads}": {c.note}.</p>
				</div>
			{/each}
		</div>
	</section>

	<section id="by-hand">
		<h2>How to build a truth table by hand</h2>
		<ol class="steps">
			<li>
				<strong>Count the letters.</strong> With n different statement letters there are 2<sup>n</sup> rows: 4 for p and
				q, 8 once r joins them.
			</li>
			<li>
				<strong>Fill in the letter columns.</strong> The first letter is true for the top half and false for the bottom half,
				the next alternates in quarters, and the last alternates every row. That lists every combination once.
			</li>
			<li>
				<strong>Work from the inside out.</strong> Give each part of the statement its own column, innermost brackets and
				negations first, and fill it using the connective's table and the columns it depends on.
			</li>
			<li>
				<strong>Read the last column.</strong> That is the value of the whole statement in each row.
			</li>
		</ol>
		<p class="section-intro">
			Here is <span class="mono">(p → q) ∧ ¬q → ¬p</span> worked that way, which is the reasoning called modus tollens written
			as one statement:
		</p>
		<div class="table-scroll">
			<table class="data-table result">
				<thead>
					<tr>
						{#each worked.variables as variable}
							<th scope="col" class="mono">{variable}</th>
						{/each}
						{#each worked.steps as step, i}
							<th scope="col" class="mono" class:first={i === 0} class:main={i === worked.steps.length - 1}>
								{step.label}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each worked.rows as row, r}
						<tr>
							{#each row as value}
								<td class={value ? 'bit-1' : 'bit-0'}>{tf(value)}</td>
							{/each}
							{#each worked.steps as step, i}
								{@const value = step.values[r]}
								<td class={value ? 'bit-1' : 'bit-0'} class:first={i === 0} class:main={i === worked.steps.length - 1}
									>{tf(value)}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The last column is true in every row, so the statement is a <strong>tautology</strong>: true whatever p and q are.
			One that is false in every row, such as <span class="mono">p ∧ ¬p</span>, is a <strong>contradiction</strong>, and
			anything in between is a <strong>contingency</strong>.
		</p>
	</section>

	<section id="equivalence">
		<h2>Converse, inverse and contrapositive</h2>
		<p class="section-intro">
			Swap or negate the parts of a conditional and you get three related statements. Only one of them says the same
			thing.
		</p>
		<div class="table-scroll">
			<table class="data-table result">
				<thead>
					<tr>
						{#each family.variables as variable}
							<th scope="col" class="mono">{variable}</th>
						{/each}
						{#each family.statements as statement, i}
							<th scope="col" class="first">
								{familyNames[i]}<br /><span class="mono">{statement.label}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each family.rows as row, r}
						<tr>
							{#each row as value}
								<td class={value ? 'bit-1' : 'bit-0'}>{tf(value)}</td>
							{/each}
							{#each family.statements as statement}
								{@const value = statement.values[r]}
								<td class="first {value ? 'bit-1' : 'bit-0'}">{tf(value)}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The conditional and its contrapositive match in every row, so they are logically equivalent, and so are the
			converse and the inverse. A conditional and its converse are not: "if it is a square, it has four sides" is true,
			and "if it has four sides, it is a square" is not.
		</p>
	</section>

	<section id="arguments">
		<h2>Testing an argument</h2>
		<p class="section-intro">
			An argument is valid when its conclusion is true in every row where all its premises are true. To test one, look
			only at those rows. Take <span class="mono">p → q</span> and <span class="mono">q</span>, therefore
			<span class="mono">p</span>:
		</p>
		<table class="data-table result">
			<thead>
				<tr>
					{#each affirming.variables as variable}
						<th scope="col" class="mono">{variable}</th>
					{/each}
					{#each affirming.statements as premise, i}
						<th scope="col" class="mono" class:first={i === 0}>{premise.label}</th>
					{/each}
					<th scope="col" class="mono main">∴ {affirming.conclusion?.label}</th>
				</tr>
			</thead>
			<tbody>
				{#each affirming.rows as row, r}
					<tr
						class:critical={affirmingResult.critical.includes(r) && !affirmingResult.counterexamples.includes(r)}
						class:counter={affirmingResult.counterexamples.includes(r)}
					>
						{#each row as value}
							<td class={value ? 'bit-1' : 'bit-0'}>{tf(value)}</td>
						{/each}
						{#each affirming.statements as premise, i}
							{@const value = premise.values[r]}
							<td class={value ? 'bit-1' : 'bit-0'} class:first={i === 0}>{tf(value)}</td>
						{/each}
						<td class="main {affirming.conclusion?.values[r] ? 'bit-1' : 'bit-0'}">
							{tf(!!affirming.conclusion?.values[r])}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="reducer">
			Both premises are true in {affirmingResult.critical.length} rows, and in the red one the conclusion is false: q is
			true and p is not. That single counterexample makes the argument invalid. It is a named fallacy, affirming the consequent.
			Swap the second premise for <span class="mono">p</span> and conclude
			<span class="mono">q</span> instead and you have modus ponens, which is valid:
			<a
				href={toolLink('/propositional-logic-truth-table', { s: 'p → q, p ∴ q' })}
				on:click|preventDefault={() => tryStatement('p → q, p ∴ q')}>check it</a
			>.
		</p>
	</section>

	<section>
		<h2>The same tables, as logic gates</h2>
		<p>
			Propositional logic and digital circuits share one algebra. Write 1 for T and 0 for F, and ∧, ∨ and ¬ are the
			<a href="/logic-gates/and">AND</a>, <a href="/logic-gates/or">OR</a> and <a href="/logic-gates/not">NOT</a> gates.
			The conditional has no gate of its own, since <span class="mono">p → q</span> is <span class="mono">¬p ∨ q</span>,
			and the biconditional is the <a href="/logic-gates/xnor">XNOR gate</a>. Laws such as
			<a href="/de-morgans-laws">De Morgan's</a> hold in both. For circuit expressions, where ab means a AND b, use the
			<a href="/truth-table-generator">truth table generator</a>.
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
		color: #888;
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

	.table-scroll {
		overflow-x: auto;
		max-height: 460px;
		overflow-y: auto;
		border-radius: 3px;
		margin-bottom: 0.4rem;
	}

	.result {
		width: auto;
		min-width: min(100%, 20rem);
	}

	.result th,
	.result td {
		text-align: center;
		padding-left: 0.9rem;
		padding-right: 0.9rem;
		white-space: nowrap;
	}

	/* :global so the rule survives scoping, which is what makes the header stick. */
	.result :global(thead th) {
		position: sticky;
		top: 0;
		background-color: #101012;
	}

	.result .first {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	/* The working is there to follow, the statement's own column is the answer. */
	.result .step {
		opacity: 0.7;
	}

	.result .main {
		font-weight: 700;
	}

	/* The answer column is tinted and underlined, so it reads as the result. */
	.result .main {
		background-color: rgba(255, 255, 255, 0.06);
	}

	.result th.main {
		color: #fff;
		box-shadow: inset 0 -2px 0 #5db65d;
	}

	.result tr.critical td {
		background-color: rgba(51, 119, 34, 0.16);
	}

	.result tr.counter td {
		background-color: rgba(190, 50, 50, 0.25);
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
	}

	.verdict-means {
		color: #aaa;
		font-size: 0.82rem;
		margin-top: 0.35rem;
		padding-top: 0.4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
	}

	.verdict-means a {
		white-space: nowrap;
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

	.opt {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.opt-label {
		color: #888;
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

	.opt button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.gate-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.gate {
		padding: 0.9rem 1rem 1rem;
	}

	.gate h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		color: #fff;
	}

	.gate-symbol {
		font-size: 0.85rem;
		color: #999;
	}

	.gate .small {
		width: 100%;
		font-size: 0.85rem;
	}

	.gate-note {
		color: #888;
		font-size: 0.8rem;
		margin: 0.6rem 0 0;
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
