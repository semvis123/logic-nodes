<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseProp,
		parsePropInput,
		propTable,
		classify,
		PropError,
		MAX_PROP_VARS,
		type Prop,
		type PropTable
	} from '$lib/propositional';
	import { treeFromProp, withValues, treeStats, MAX_TREE_INPUT, type TreeNode } from '$lib/exprTree';
	import ExpressionTree from '$lib/ExpressionTree.svelte';
	import { readUrl, syncUrl, safeText, safeOption, safeInt, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { s: '(p → q) ∧ ¬(q ∨ r)', order: 'tf', chains: 'binary', row: 0 };
	onMount(() => {
		const p = readUrl();
		// Longer than most tools allow: other tools link here with circuit expressions
		// rewritten in logic notation, which roughly triples their length.
		input = safeText(p.s, MAX_TREE_INPUT) ?? input;
		order = safeOption(p.order, ['tf', '01'] as const) ?? order;
		chains = safeOption(p.chains, ['binary', 'merged'] as const) ?? chains;
		row = safeInt(p.row, 0, (1 << MAX_PROP_VARS) - 1) ?? row;
	});
	$: syncUrl({ s: input, order, chains, row }, DEFAULTS);

	let input = DEFAULTS.s;
	let order: 'tf' | '01' = 'tf';
	let chains: 'binary' | 'merged' = 'binary';
	let row = 0;

	const mark = (v: boolean, style: 'tf' | '01' = order) => (style === '01' ? (v ? '1' : '0') : v ? 'T' : 'F');

	/** One statement's table, with the values of its letters in each row. */
	const tableOf = (prop: Prop, falseFirst: boolean) => propTable({ statements: [prop], conclusion: null }, falseFirst);
	const valuesAt = (table: PropTable, r: number) =>
		Object.fromEntries(table.variables.map((v, j) => [v, table.rows[r][j]]));

	// Runs during prerendering too, so the page ships with a real tree.
	let tree: TreeNode | null = null;
	let table: PropTable | null = null;
	let error = '';
	$: {
		try {
			const prop = parseProp(input);
			table = tableOf(prop, order === '01');
			tree = treeFromProp(prop, { flatten: chains === 'merged' });
			error = '';
		} catch (e) {
			tree = null;
			table = null;
			error =
				e instanceof PropError
					? e.message.replace('Only one statement is allowed here', 'Draw one statement at a time: leave out , and ∴')
					: 'That statement did not parse';
		}
	}
	// A new statement can have fewer rows than the one before it.
	$: if (table && row >= table.rows.length) row = 0;
	$: values = table ? valuesAt(table, Math.min(row, table.rows.length - 1)) : null;
	$: answer = table ? table.statements[0].values[Math.min(row, table.rows.length - 1)] : false;
	$: stats = tree ? treeStats(tree) : null;
	$: kind = table ? classify(table.statements[0].values) : null;
	$: high = table ? table.statements[0].values.filter(Boolean).length : 0;

	function pick(r: number) {
		row = r;
	}

	/**
	 * The rows are one tab stop: only the selected row is in the tab order, and
	 * the arrow keys, Home and End move the selection (a roving tabindex).
	 */
	function rowKey(event: KeyboardEvent, r: number) {
		if (!table) return;
		const last = table.rows.length - 1;
		const moves: Record<string, number> = { ArrowDown: r + 1, ArrowUp: r - 1, Home: 0, End: last };
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			pick(r);
		} else if (event.key in moves) {
			event.preventDefault();
			const next = Math.max(0, Math.min(last, moves[event.key]));
			pick(next);
			const rows = (event.currentTarget as HTMLElement).parentElement?.children;
			(rows?.[next] as HTMLElement | undefined)?.focus();
		}
	}

	/**
	 * T and F tables start from all true, 1 and 0 tables from all 0, so the
	 * rows run in opposite orders. Keep the same assignment selected.
	 */
	function setOrder(next: 'tf' | '01') {
		if (next === order) return;
		if (table) row = table.rows.length - 1 - Math.min(row, table.rows.length - 1);
		order = next;
	}

	/** Loads a statement into the generator and scrolls up to it. */
	function tryStatement(statement: string) {
		input = statement;
		row = 0;
		const field = document.getElementById('statement');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples = [
		{ label: 'Precedence', value: '¬p ∨ q → r' },
		{ label: 'Brackets moved', value: '¬(p ∨ q) → r' },
		{ label: "De Morgan's law", value: '¬(p ∧ q) ↔ ¬p ∨ ¬q' },
		{ label: 'Chained arrows', value: 'p → q → r' },
		{ label: 'Four letters', value: '(p ⊕ q) ∧ (r ∨ ¬s)' },
		{ label: 'Six letters', value: '(p ∧ q ∨ r) → (s ↔ ¬t ∧ u)' }
	];

	// Worked examples, drawn by the same engine as the generator.
	const precedence = ['¬p ∨ q → r', '¬(p ∨ q) → r'].map((s) => ({ s, tree: treeFromProp(parseProp(s)) }));
	const disagree = (() => {
		const t = propTable(parsePropInput(precedence.map((p) => p.s).join(', ')));
		const [left, right] = t.statements;
		const rows = t.rows.map((_, r) => r).filter((r) => left.values[r] !== right.values[r]);
		const first = rows[0];
		return {
			count: rows.length,
			total: t.rows.length,
			where: t.variables.map((v, j) => `${v} = ${t.rows[first][j] ? 'T' : 'F'}`).join(', '),
			left: left.values[first],
			right: right.values[first]
		};
	})();

	const worked = (() => {
		const s = '(p ∨ q) ∧ ¬r';
		const prop = parseProp(s);
		const t = tableOf(prop, false);
		// The row p = F, q = T, r = F.
		const r = t.rows.findIndex((cells) => cells.join() === [false, true, false].join());
		const values = valuesAt(t, r);
		return { s, table: t, r, values, tree: treeFromProp(prop), filled: withValues(treeFromProp(prop), values) };
	})();

	const shared = (() => {
		const s = '(p ∧ q) ∨ ¬(p ∧ q) ∧ r';
		const tree = treeFromProp(parseProp(s));
		const count = (n: TreeNode, label: string): number =>
			(n.label === label ? 1 : 0) + n.children.reduce((sum, c) => sum + count(c, label), 0);
		return { s, tree, ands: count(tree, '∧'), stats: treeStats(tree) };
	})();

	/** Post-order: children first, then the node. That is reverse Polish notation. */
	const postfix = (n: TreeNode): string =>
		[...n.children.map(postfix), n.label + (n.children.length > 2 ? `(${n.children.length})` : '')].join(' ');
	const rpn = { s: 'p ∧ q → r', text: postfix(treeFromProp(parseProp('p ∧ q → r'))) };
	const chain = treeFromProp(parseProp('p ∧ q ∧ r'));
	const chainMerged = treeFromProp(parseProp('p ∧ q ∧ r'), { flatten: true });

	const faqs = [
		{
			q: 'Is an expression tree the same as a parse tree or a syntax tree?',
			a: 'Nearly. Strictly, a parse tree (or concrete syntax tree) has a node for every rule of the grammar, brackets included, while an abstract syntax tree keeps only the connectives and what they join. The brackets are not needed once the shape records the grouping. What courses call an expression tree is the abstract syntax tree, and that is what this page draws.'
		},
		{
			q: 'How do I type the symbols?',
			a: 'NOT: ¬, ~, ! or not. AND: ∧, &, ^ or and. OR: ∨, |, + or or, and a lone v between two letters works too. XOR: ⊕. IF-THEN: →, -> or =>. IF AND ONLY IF: ↔, <-> or iff. Each letter is a single letter such as p or q, and ⊤ and ⊥ (or 1 and 0) are constants. Note that ^ means AND here, as in logic classes. For circuit notation, where ab means a AND b and ^ is XOR, use the truth table generator, which draws the tree too.'
		},
		{
			q: 'Why does p → q → r branch to the right?',
			a: 'Because → groups to the right by convention: p → q → r means p → (q → r). The other connectives group to the left, so p ∧ q ∧ r means (p ∧ q) ∧ r and its tree leans left. For ∧ and ∨ the grouping makes no difference to the value; for → it does, which is why the convention matters.'
		},
		{
			q: 'Why are there two ∧ nodes for p ∧ q ∧ r?',
			a: 'Because each connective joins two things, and the parser reads the chain as (p ∧ q) ∧ r. Since ∧ and ∨ are associative, the grouping never changes the answer, so choosing "merged" for chains draws one ∧ node with three children instead. Chains of → are never merged, since → is not associative.'
		},
		{
			q: 'How do I read an expression back out of a tree?',
			a: `Visit each node after its children, from left to right, and write down what you meet. That is a post-order traversal, and it gives the expression in reverse Polish notation: ${rpn.s} becomes ${rpn.text}. Evaluating that list with a stack is the same bottom-up evaluation the tree shows.`
		},
		{
			q: 'How big can the expression be?',
			a: `Up to ${MAX_PROP_VARS} different letters, which is 64 rows to pick from. A letter can appear as many times as you like; each appearance is its own leaf. Wide trees scroll sideways inside their box.`
		}
	];

	const page = {
		title: 'Expression Tree Generator for Logic and Boolean Expressions',
		description:
			'Draw the expression tree of a logic or boolean expression, see how precedence shapes it, and watch it evaluate from the leaves up, row by row.',
		url: `${SITE}/expression-tree`,
		image: `${SITE}/og/expression-tree.png`,
		imageAlt: 'LogicGates.org: expression tree generator'
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
					{ '@type': 'ListItem', position: 3, name: 'Expression tree generator' }
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
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for p → q' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Expression tree generator</h1>
		<p class="lede">
			Type a logic expression and see the tree its connectives form: which one is applied last, and what each one works
			on. Pick a row to fill in every node's value, from the letters at the bottom up to the answer at the top.
		</p>

		<div class="card tool">
			<label class="field" for="statement">Expression</label>
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
				<span class="mono">⊕</span> xor,
				<span class="mono">→ -&gt;</span> if-then,
				<span class="mono">↔ &lt;-&gt; iff</span> if and only if. Here <span class="mono">^</span> means AND. For
				circuit notation such as <span class="mono">ab + c'</span>, use the
				<a href={toolLink('/truth-table-generator', { expr: "ab + c'" })}>truth table generator</a>.
			</p>

			<div class="chips">
				{#each examples as example}
					<button
						type="button"
						class="chip-btn"
						on:click={() => {
							input = example.value;
							row = 0;
						}}
					>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else if tree && table && values}
				<p class="answer" role="status">
					{#if table.variables.length}
						With
						{#each table.variables as v, j}
							<span class="mono">{v} = {mark(values[v])}</span>{j < table.variables.length - 1 ? ', ' : ''}
						{/each}
						the whole expression is
					{:else}
						The whole expression is
					{/if}
					<strong class={answer ? 'yes' : 'no'}>{answer ? 'true' : 'false'}</strong>.
					<span class="dim"
						>It is true in {high} of {table.rows.length} rows{kind === 'contingency' ? '' : `, a ${kind}`}.</span
					>
				</p>

				<div class="tree-box">
					<ExpressionTree {tree} {values} marks={order} />
				</div>
				{#if stats}
					<p class="tree-note">
						{stats.operators}
						{stats.operators === 1 ? 'connective' : 'connectives'}, {stats.leaves}
						{stats.leaves === 1 ? 'leaf' : 'leaves'}, {stats.depth + 1}
						{stats.depth === 0 ? 'level' : 'levels'}. The ringed node at the top is applied last, so its value is the
						answer.
					</p>
				{/if}

				<h2 class="pick-head" id="rows-head">Pick a row</h2>
				<div class="table-scroll">
					<table class="data-table rows" aria-labelledby="rows-head">
						<thead>
							<tr>
								{#each table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								<th scope="col" class="mono main">{table.statements[0].label}</th>
							</tr>
						</thead>
						<tbody>
							{#each table.rows as cells, r}
								{@const value = table.statements[0].values[r]}
								<tr
									class:selected={r === row}
									aria-current={r === row ? 'true' : undefined}
									tabindex={r === row ? 0 : -1}
									on:click={() => pick(r)}
									on:keydown={(e) => rowKey(e, r)}
								>
									{#each cells as cell}
										<td class={cell ? 'bit-1' : 'bit-0'}>{mark(cell)}</td>
									{/each}
									<td class="main {value ? 'bit-1' : 'bit-0'}">{mark(value)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="export">
					<div class="opt" role="group" aria-label="Values">
						<span class="opt-label">Values</span>
						<button
							type="button"
							class:active={order === 'tf'}
							aria-pressed={order === 'tf'}
							on:click={() => setOrder('tf')}>T and F</button
						>
						<button
							type="button"
							class:active={order === '01'}
							aria-pressed={order === '01'}
							on:click={() => setOrder('01')}>1 and 0</button
						>
					</div>
					<div class="opt" role="group" aria-label="Chains of ∧ and ∨">
						<span class="opt-label">Chains</span>
						<button
							type="button"
							class:active={chains === 'binary'}
							aria-pressed={chains === 'binary'}
							on:click={() => (chains = 'binary')}>Two at a time</button
						>
						<button
							type="button"
							class:active={chains === 'merged'}
							aria-pressed={chains === 'merged'}
							on:click={() => (chains = 'merged')}>Merged</button
						>
					</div>
					<ShareLink what="the expression" />
				</div>
				<p class="summary">
					<a href={toolLink('/propositional-logic-truth-table', { s: input })}>See every step as a truth table</a>
				</p>
			{/if}
		</div>
	</section>

	<section>
		<h2>What an expression tree is</h2>
		<p>
			An expression tree shows how an expression is built. Each connective is a node, and its branches lead to the parts
			it joins. The letters and constants are the leaves, at the ends of the branches. The node at the top, the root, is
			the connective applied last: it decides what kind of statement the whole thing is. A root of → makes the whole
			expression a conditional; a root of ∧, a conjunction.
		</p>
		<p>
			It is also called a parse tree or a syntax tree, since it is what a parser builds when it reads the text. Brackets
			do not appear in it. They only tell the parser how to group, and the shape of the tree already records that.
		</p>
	</section>

	<section>
		<h2>How precedence decides the shape</h2>
		<p class="section-intro">
			Without brackets, ¬ binds tightest, then ∧, ⊕, ∨, → and finally ↔. So in
			<span class="mono">{precedence[0].s}</span> the ¬ takes only p, and → is applied last. Put brackets around
			<span class="mono">p ∨ q</span> and the ¬ moves up the tree to take all of it:
		</p>
		<div class="pair">
			{#each precedence as example}
				<figure class="card pair-card">
					<ExpressionTree tree={example.tree} />
					<figcaption>
						<button type="button" class="link-btn mono" on:click={() => tryStatement(example.s)}>{example.s}</button>
					</figcaption>
				</figure>
			{/each}
		</div>
		<p class="reducer">
			Both have → at the root, but the left one negates p alone and the right one negates the whole of p ∨ q. They
			disagree in {disagree.count} of {disagree.total} rows: with <span class="mono">{disagree.where}</span>, for
			instance, the left is {disagree.left ? 'true' : 'false'} and the right is {disagree.right ? 'true' : 'false'}.
			Without brackets, a connective that binds more tightly always sits lower in the tree, because it is applied first.
		</p>
	</section>

	<section>
		<h2>Evaluating from the bottom up</h2>
		<p class="section-intro">
			To find the value of an expression for one row, start at the leaves with the values of the letters, then work
			upwards: each node applies its connective to the values just below it. Here is
			<span class="mono">{worked.s}</span> with p false, q true and r false:
		</p>
		<div class="card worked">
			<ExpressionTree tree={worked.tree} values={worked.values} />
		</div>
		<p class="section-intro">
			This is exactly what the working columns of a truth table do. Each connective in the tree is one column, filled in
			the same order, innermost first:
		</p>
		<div class="table-scroll">
			<table class="data-table steps-table">
				<thead>
					<tr>
						{#each worked.table.variables as variable}
							<th scope="col" class="mono">{variable}</th>
						{/each}
						{#each worked.table.steps as step, i}
							<th scope="col" class="mono" class:first={i === 0}>{step.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						{#each worked.table.rows[worked.r] as value}
							<td class={value ? 'bit-1' : 'bit-0'}>{mark(value, 'tf')}</td>
						{/each}
						{#each worked.table.steps as step, i}
							{@const value = step.values[worked.r]}
							<td class={value ? 'bit-1' : 'bit-0'} class:first={i === 0}>{mark(value, 'tf')}</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The last column is the root, {mark(!!worked.filled.value, 'tf')}. A full truth table repeats this for every row:
			the <a href="/propositional-logic-truth-table">truth table calculator for logic statements</a> shows those columns
			for any statement.
		</p>
	</section>

	<section>
		<h2>Trees and circuits</h2>
		<p>
			Read a tree upside down and it is a logic circuit: the leaves are inputs, each connective is a gate, and each
			branch is a wire carrying one gate's output to the next. The root is the output. A tree is the special kind of
			circuit where no gate's output is used twice.
		</p>
		<p class="section-intro">
			Real circuits often share. In <span class="mono">{shared.s}</span> the part p ∧ q appears twice, so the tree has
			two identical p ∧ q branches, with {shared.ands} ∧ nodes and {shared.stats.leaves} leaves in all:
		</p>
		<div class="card worked">
			<ExpressionTree tree={shared.tree} />
		</div>
		<p class="reducer">
			A circuit can build p ∧ q once and wire its output to both places, and the letters become input wires shared by
			every gate that reads them. The <a href="/logic-circuit-generator">circuit diagram generator</a> draws an
			expression as gates, and the <a href="/boolean-algebra-calculator">boolean algebra calculator</a> simplifies it so
			the circuit needs fewer of them.
		</p>
	</section>

	<section>
		<h2>Chains of the same connective</h2>
		<p class="section-intro">
			A connective joins two things, so <span class="mono">p ∧ q ∧ r</span> is read as (p ∧ q) ∧ r and drawn with two ∧ nodes.
			Since ∧ and ∨ give the same answer however a chain is grouped, the chain can also be drawn as one node with three branches,
			the way a three-input AND gate would be:
		</p>
		<div class="pair">
			<figure class="card pair-card">
				<ExpressionTree tree={chain} />
				<figcaption>Two at a time, as parsed</figcaption>
			</figure>
			<figure class="card pair-card">
				<ExpressionTree tree={chainMerged} />
				<figcaption>Merged</figcaption>
			</figure>
		</div>
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

	.answer {
		color: #ddd;
		font-size: 0.95rem;
		margin: 0 0 0.6rem;
	}

	.answer .yes {
		color: #8ede8e;
	}

	.answer .no {
		color: #ff8a8a;
	}

	.dim {
		color: #999;
		font-size: 0.85rem;
	}

	.tree-box {
		padding: 0.6rem 0 0.2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.tree-note {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 1rem;
	}

	.pick-head {
		font-size: 0.75rem;
		color: #999;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 400;
		margin: 0 0 0.4rem;
	}

	.table-scroll {
		overflow-x: auto;
		max-height: 300px;
		overflow-y: auto;
		border-radius: 3px;
		margin-bottom: 0.4rem;
	}

	.rows,
	.steps-table {
		width: auto;
		min-width: min(100%, 16rem);
	}

	.rows th,
	.rows td,
	.steps-table th,
	.steps-table td {
		text-align: center;
		padding-left: 0.9rem;
		padding-right: 0.9rem;
		white-space: nowrap;
	}

	.rows :global(thead th) {
		position: sticky;
		top: 0;
		background-color: #101012;
	}

	.rows tbody tr {
		cursor: pointer;
	}

	.rows tbody tr:hover td {
		background-color: rgba(255, 255, 255, 0.05);
	}

	.rows tr.selected td {
		background-color: rgba(255, 255, 255, 0.1);
		font-weight: 700;
	}

	.rows tr.selected td:first-child {
		box-shadow: inset 3px 0 0 #fff;
	}

	.rows tr:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}

	.rows .main,
	.steps-table .first {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.rows th.main {
		color: #fff;
		box-shadow: inset 0 -2px 0 #5db65d;
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

	.summary {
		font-size: 0.88rem;
		margin: 0.8rem 0 0;
	}

	.pair {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin: 0 0 0.8rem;
	}

	.pair-card {
		margin: 0;
		padding: 0.8rem 0.6rem 0.7rem;
		min-width: 0;
	}

	figcaption {
		text-align: center;
		color: #bbb;
		font-size: 0.85rem;
		margin-top: 0.4rem;
	}

	.link-btn {
		background: none;
		border: 0;
		padding: 0;
		color: #8ede8e;
		font-size: 0.95rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.worked {
		padding: 0.8rem 0.6rem;
		margin-bottom: 0.8rem;
	}
</style>
