<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { onMount, tick } from 'svelte';
	import {
		makeQuestion,
		nextQuestion,
		questionSignature,
		topics,
		RECENT_LIMIT,
		type Topic,
		type Question
	} from '$lib/quiz';

	import { readUrl, syncUrl, safeOption } from '$lib/urlState';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { topic: 'mixed' };
	$: syncUrl({ topic }, DEFAULTS);

	let topic: Topic = 'mixed';
	// A fixed seed for the server render, so the markup matches on hydration;
	// onMount immediately swaps in a random one so a reload is never the same.
	let question: Question = makeQuestion(1, 'mixed');
	let chosen: number | null = null;
	let answered = 0;
	let correct = 0;
	let streak = 0;
	let best = 0;
	/** Signatures of the last few questions, so they do not come round again. */
	let recent: string[] = [];
	let nextBtn: HTMLButtonElement | undefined;

	const KIND_LABELS: Record<Question['kind'], string> = {
		'gate-output': 'Gate output',
		'identify-gate': 'Identify the gate',
		evaluate: 'Evaluate an expression',
		equivalent: 'Find the equivalent',
		'count-ones': 'Count the ones',
		'circuit-expression': 'Read a circuit',
		'circuit-output': 'Trace a circuit'
	};
	const KIND_ORDER = Object.keys(KIND_LABELS) as Question['kind'][];
	/** Correct/total per kind of question, for the mixed-mode breakdown. */
	let byKind: Partial<Record<Question['kind'], { correct: number; total: number }>> = {};

	// A run of three correct answers in a row raises the difficulty by one
	// step, up to two; a miss (which zeroes the streak) drops it straight back.
	// A plain function rather than a `$:` value: `reset` changes `streak` and
	// calls `advance` in the same tick, before a reactive statement would catch up.
	const difficultyFor = (s: number) => Math.min(Math.floor(s / 3), 2);

	onMount(() => {
		topic =
			safeOption(
				readUrl().topic,
				topics.map((t) => t.id)
			) ?? topic;
		advance();
	});

	$: isRight = chosen !== null && chosen === question.answer;

	function advance() {
		const picked = nextQuestion(topic, recent, Math.random, difficultyFor(streak));
		question = picked.question;
		recent = [...recent, questionSignature(picked.question)].slice(-RECENT_LIMIT);
		chosen = null;
	}

	async function choose(index: number) {
		if (chosen !== null) return;
		chosen = index;
		answered += 1;
		const entry = byKind[question.kind] ?? { correct: 0, total: 0 };
		entry.total += 1;
		if (index === question.answer) {
			correct += 1;
			streak += 1;
			best = Math.max(best, streak);
			entry.correct += 1;
		} else {
			streak = 0;
		}
		byKind = { ...byKind, [question.kind]: entry };
		// The chosen option (and every other, now disabled) can no longer hold
		// focus, so hand it to "Next question" rather than dropping it to <body>.
		await tick();
		nextBtn?.focus();
	}

	function setTopic(next: Topic) {
		if (next === topic) return;
		topic = next;
		recent = [];
		advance();
	}

	function reset() {
		answered = 0;
		correct = 0;
		streak = 0;
		best = 0;
		recent = [];
		byKind = {};
		advance();
	}

	/**
	 * Number keys pick an answer, Enter/Space moves on once one is marked.
	 * Ignored while a form control would otherwise handle the key itself, so a
	 * keyboard user tabbed onto a button does not trigger it twice.
	 */
	function onKeydown(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		const tag = (e.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		if (chosen === null) {
			const n = Number(e.key);
			if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
				e.preventDefault();
				choose(n - 1);
			}
			return;
		}
		if ((e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON' && tag !== 'A') {
			e.preventDefault();
			advance();
		}
	}

	const faqs = [
		{
			q: 'Where do the questions come from?',
			a: 'They are built fresh rather than drawn from a fixed list, so you can keep going indefinitely. The wrong answers are real alternatives rather than filler, so you cannot get there by eliminating the obviously silly ones.'
		},
		{
			q: 'What is covered?',
			a: 'Gate outputs, identifying a gate from its truth table, evaluating an expression at given inputs, spotting an equivalent expression, counting the rows where a function is true, and two kinds of question on a gate diagram: reading its expression off it, and tracing signals to its output. That is most of what an introductory digital logic exercise sheet asks.'
		},
		{
			q: 'Is there a time limit or a score to beat?',
			a: 'No timer. The counter tracks how many you have answered, how many were right and your current streak, and nothing is sent anywhere or stored between visits.'
		},
		{
			q: 'Does it get harder?',
			a: 'For the expression-based questions, yes: three correct answers in a row and it starts drawing longer, more deeply nested expressions; miss one and it drops straight back to the baseline. The level shown next to your streak is where that stands. Diagrams stay the same size at every level, so a circuit is never too big to draw.'
		},
		{
			q: 'Can I answer without a mouse?',
			a: 'Number keys pick an option and Enter moves on once a question is marked, so a whole run can be done from the keyboard.'
		}
	];

	const page = {
		title: 'Logic Gate Practice: Endless Generated Questions',
		description:
			'Practise digital logic with generated questions on gates, truth tables, expressions and equivalence. Instant marking, no signup, unlimited questions.',
		url: `${SITE}/practice`,
		image: `${SITE}/og/practice.png`,
		imageAlt: 'LogicGates.org: practice'
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
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Practice' }
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

<svelte:window on:keydown={onKeydown} />

<ContentPage
	related={[
		{ href: '/worksheet', label: 'Printable worksheets' },
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Practice</h1>
		<p class="lede">
			Generated questions on gates, truth tables and boolean expressions, marked as you go. They never run out, and
			nothing is stored.
		</p>
		<p class="aside">
			Teaching a class? The <a href="/worksheet">worksheet generator</a> puts the same questions on paper, with an answer
			key, from a link everyone can open.
		</p>

		<div class="topics" role="group" aria-label="Topic">
			{#each topics as option}
				<button
					type="button"
					class="topic"
					class:active={topic === option.id}
					aria-pressed={topic === option.id}
					title={option.blurb}
					on:click={() => setTopic(option.id)}
				>
					{option.label}
				</button>
			{/each}
		</div>

		<div class="card quiz">
			<div class="score">
				<span><strong>{correct}</strong> / {answered} correct</span>
				<span>streak <strong>{streak}</strong></span>
				{#if best > 1}<span>best <strong>{best}</strong></span>{/if}
				<span title="Three in a row raises the difficulty; a miss drops it back">
					level <strong>{difficultyFor(streak) + 1}</strong>
				</span>
				{#if answered > 0}
					<button type="button" class="link-btn" on:click={reset}>reset</button>
				{/if}
			</div>

			{#if topic === 'mixed' && answered > 0}
				<div class="breakdown">
					{#each KIND_ORDER as kind}
						{#if byKind[kind]}
							<span class="chip"
								>{KIND_LABELS[kind]} <strong>{byKind[kind]?.correct}/{byKind[kind]?.total}</strong></span
							>
						{/if}
					{/each}
				</div>
			{/if}

			<p class="prompt">{question.prompt}</p>

			{#if question.detail}
				<p class="detail mono">{question.detail}</p>
			{/if}

			{#if question.svg}
				<figure class="diagram">
					<!-- Generated by the same renderer as the circuit tool. Once the
					     question is marked, the signals are switched on. -->
					{@html chosen !== null && question.svgSolved ? question.svgSolved : question.svg}
					<figcaption class="visually-hidden">{question.svgAlt}</figcaption>
				</figure>
			{/if}

			{#if question.table}
				<div class="table-wrap">
					<table class="data-table q-table">
						<thead>
							<tr>
								{#each question.table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								<th scope="col" class="mono">{question.tableOutputLabel ?? 'Q'}</th>
							</tr>
						</thead>
						<tbody>
							{#each question.table.rows as value, row}
								<tr>
									{#each question.table.variables as _, bit}
										{@const on = !!(row & (1 << (question.table.variables.length - 1 - bit)))}
										<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
									{/each}
									<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="options" role="group" aria-label="Answers">
				{#each question.options as option, i}
					<button
						type="button"
						class="option"
						class:correct={chosen !== null && i === question.answer}
						class:wrong={chosen === i && i !== question.answer}
						class:muted={chosen !== null && i !== question.answer && chosen !== i}
						disabled={chosen !== null}
						on:click={() => choose(i)}
					>
						<span class="mono">{option}</span>
					</button>
				{/each}
			</div>
			<p class="hint">Press 1–{question.options.length} to answer, Enter for the next question.</p>

			{#if chosen !== null}
				<div class="feedback" class:right={isRight} role="status">
					<strong>{isRight ? 'Correct.' : 'Not quite.'}</strong>
					{question.explanation}
					{#if question.kind === 'circuit-output'}
						<!-- Only this kind re-renders the diagram with the signals applied;
						     the others just add a caption. -->
						The diagram above now shows every wire: green is 1, red is 0.
					{/if}
				</div>
				<button type="button" class="cta next" bind:this={nextBtn} on:click={advance}>Next question</button>
			{/if}
		</div>
	</section>

	<section>
		<h2>What comes up</h2>
		<p class="section-intro">Seven kinds of question, mixed at random.</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Question</th>
						<th scope="col">What it tests</th>
						<th scope="col">Stuck? Read</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Gate output</th>
						<td>Knowing each gate's behaviour cold</td>
						<td><a href="/logic-gates">The seven logic gates</a></td>
					</tr>
					<tr>
						<th scope="row">Identify the gate</th>
						<td>Reading a truth table backwards</td>
						<td><a href="/truth-table-generator">Truth table generator</a></td>
					</tr>
					<tr>
						<th scope="row">Evaluate an expression</th>
						<td>Operator precedence and substitution</td>
						<td><a href="/boolean-algebra-laws">Boolean algebra laws</a></td>
					</tr>
					<tr>
						<th scope="row">Find the equivalent</th>
						<td>Simplification and De Morgan</td>
						<td><a href="/boolean-algebra-calculator">Boolean algebra calculator</a></td>
					</tr>
					<tr>
						<th scope="row">Count the ones</th>
						<td>Building a truth table in your head</td>
						<td><a href="/karnaugh-map-solver">Karnaugh map solver</a></td>
					</tr>
					<tr>
						<th scope="row">Read a circuit</th>
						<td>Getting from a gate diagram to an expression</td>
						<td><a href="/logic-circuit-generator">Logic circuit generator</a></td>
					</tr>
					<tr>
						<th scope="row">Trace a circuit</th>
						<td>Following signals through a diagram to its output</td>
						<td><a href="/logic-circuit-generator">Logic circuit generator</a></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>Then build something</h2>
		<p class="section-intro">
			Answering questions about gates is a different skill from wiring them up. When a question stops being obvious,
			build the circuit and watch it.
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

	.aside {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 1rem;
	}

	.aside a {
		color: #8ede8e;
	}

	.topics {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}

	.topic {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
	}

	.topic:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.topic.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.quiz {
		padding: 1.1rem 1.2rem 1.3rem;
	}

	.score {
		display: flex;
		gap: 1.2rem;
		align-items: baseline;
		flex-wrap: wrap;
		color: #888;
		font-size: 0.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		padding-bottom: 0.7rem;
		margin-bottom: 1rem;
	}

	.score strong {
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #8ede8e;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
		margin-left: auto;
	}

	.breakdown {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		color: #888;
		font-size: 0.78rem;
		margin: -0.4rem 0 1rem;
	}

	.chip strong {
		color: #ccc;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.hint {
		color: #777;
		font-size: 0.78rem;
		margin: 0.6rem 0 0;
	}

	.prompt {
		color: #fff;
		font-size: 1.05rem;
		margin: 0 0 0.8rem;
	}

	.detail {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		color: #8ede8e;
		font-size: 1.1rem;
		padding: 0.6rem 0.8rem;
		margin: 0 0 1rem;
		word-break: break-word;
	}

	.diagram {
		margin: 0 0 1rem;
		padding: 0.5rem;
		background-color: #1d1e20;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		overflow-x: auto;
	}

	.diagram :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		max-width: 520px;
		margin: 0 auto;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.q-table {
		margin-bottom: 1rem;
	}

	.q-table th,
	.q-table td {
		text-align: center;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 8px;
	}

	.option {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 1rem;
		padding: 0.7rem 0.9rem;
		cursor: pointer;
		text-align: center;
		transition: border-color 0.12s ease, background-color 0.12s ease;
	}

	.option:hover:not(:disabled) {
		border-color: #5db65d;
	}

	.option:disabled {
		cursor: default;
	}

	.option.correct {
		background-color: rgba(51, 119, 34, 0.35);
		border-color: #5db65d;
	}

	.option.wrong {
		background-color: rgba(255, 34, 51, 0.18);
		border-color: #f66;
	}

	.option.muted {
		opacity: 0.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.option {
			transition: none;
		}
	}

	.feedback {
		margin-top: 1rem;
		padding: 0.7rem 0.9rem;
		border-radius: 3px;
		border: 1px solid rgba(255, 102, 102, 0.5);
		background-color: rgba(255, 34, 51, 0.1);
		color: #ddd;
		font-size: 0.9rem;
	}

	.feedback.right {
		border-color: rgba(93, 182, 93, 0.6);
		background-color: rgba(51, 119, 34, 0.18);
	}

	.feedback strong {
		color: #fff;
	}

	.next {
		margin-top: 1rem;
	}
</style>
