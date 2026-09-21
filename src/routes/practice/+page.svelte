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
	import type { Notation } from '$lib/boolean';
	import type { Standard } from '$lib/exportSvg';

	import { readUrl, syncUrl, safeOption, toolLink } from '$lib/urlState';

	const STANDARD_OPTIONS: { id: Standard; label: string }[] = [
		{ id: 'ansi', label: 'ANSI' },
		{ id: 'iec', label: 'IEC' }
	];
	const NOTATION_OPTIONS: { id: Notation; label: string }[] = [
		{ id: 'math', label: 'Mathematical' },
		{ id: 'engineering', label: 'Engineering' },
		{ id: 'programming', label: 'Programming' }
	];

	/** Comma-joined, since the query string only holds plain values. */
	function parseSet<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
		if (!value) return [];
		const found = value.split(',').filter((token): token is T => (allowed as readonly string[]).includes(token));
		return [...new Set(found)];
	}

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { topic: 'mixed', symbols: 'ansi', notation: 'math', type: '' };
	$: syncUrl(
		{ topic, symbols: standards.join(','), notation: notations.join(','), type: typeMode ? '1' : '' },
		DEFAULTS
	);

	let topic: Topic = 'mixed';
	// Which gate-symbol standards and expression notations to draw questions
	// from; checking more than one mixes them at random, question to question.
	let standards: Standard[] = ['ansi'];
	let notations: Notation[] = ['math'];
	// Type the answer instead of picking one of the four options.
	let typeMode = false;
	// A fixed seed for the server render, so the markup matches on hydration;
	// onMount immediately swaps in a random one so a reload is never the same.
	let question: Question = makeQuestion(1, 'mixed');
	let chosen: number | null = null;
	/** The typed-mode equivalent of `chosen`: null until submitted. */
	let typed: { value: string; right: boolean } | null = null;
	let typedValue = '';
	let typedInput: HTMLInputElement | undefined;
	let answered = 0;
	let correct = 0;
	let streak = 0;
	let best = 0;
	/** Signatures of the last few questions, so they do not come round again. */
	let recent: string[] = [];
	let nextBtn: HTMLButtonElement | undefined;

	/** Correct/wrong for recent answers, oldest first, for the run sparkline. */
	let history: boolean[] = [];
	const HISTORY_LIMIT = 20;

	type Missed = { id: number; question: Question; yourAnswer: string };
	/** Every question missed this session, so it can be reviewed afterwards. */
	let missed: Missed[] = [];
	let missedIdCounter = 0;
	const MISSED_LIMIT = 30;

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
		const p = readUrl();
		topic =
			safeOption(
				p.topic,
				topics.map((t) => t.id)
			) ?? topic;
		const parsedStandards = parseSet(p.symbols, ['ansi', 'iec'] as const);
		if (parsedStandards.length) standards = parsedStandards;
		const parsedNotations = parseSet(p.notation, ['math', 'engineering', 'programming'] as const);
		if (parsedNotations.length) notations = parsedNotations;
		typeMode = p.type === '1';
		advance();
	});

	$: isRight = chosen !== null ? chosen === question.answer : typed !== null ? typed.right : false;

	async function advance() {
		const picked = nextQuestion(topic, recent, Math.random, {
			difficulty: difficultyFor(streak),
			standards,
			notations
		});
		question = picked.question;
		recent = [...recent, questionSignature(picked.question)].slice(-RECENT_LIMIT);
		chosen = null;
		typed = null;
		typedValue = '';
		if (typeMode) {
			// So a keyboard-first run never needs a click to keep going.
			await tick();
			typedInput?.focus();
		}
	}

	/** Bookkeeping shared by both answering modes: score, streak, history, misses. */
	async function recordAnswer(right: boolean, yourAnswer: string) {
		answered += 1;
		const entry = byKind[question.kind] ?? { correct: 0, total: 0 };
		entry.total += 1;
		if (right) {
			correct += 1;
			streak += 1;
			best = Math.max(best, streak);
			entry.correct += 1;
		} else {
			streak = 0;
			missed = [...missed, { id: missedIdCounter++, question, yourAnswer }].slice(-MISSED_LIMIT);
		}
		byKind = { ...byKind, [question.kind]: entry };
		history = [...history, right].slice(-HISTORY_LIMIT);
		// The answered control (option button or input) can no longer hold
		// focus once disabled, so hand it to "Next question" rather than
		// dropping it to <body>.
		await tick();
		nextBtn?.focus();
	}

	function choose(index: number) {
		if (chosen !== null || typed !== null) return;
		chosen = index;
		recordAnswer(index === question.answer, question.options[index]);
	}

	/** Falls back to a plain text match; equivalent/circuit-expression accept
	 *  any expression with the same truth table, not just the printed option. */
	function gradeTyped(input: string): boolean {
		if (question.acceptsTyped) return question.acceptsTyped(input);
		return input.toLowerCase() === question.options[question.answer].toLowerCase();
	}

	function submitTyped() {
		if (chosen !== null || typed !== null) return;
		const input = typedValue.trim();
		if (!input) return;
		const right = gradeTyped(input);
		typed = { value: input, right };
		recordAnswer(right, input);
	}

	function setTopic(next: Topic) {
		if (next === topic) return;
		topic = next;
		recent = [];
		advance();
	}

	/** Toggling a representation setting reshuffles the current question, so
	 *  the change is visible right away rather than waiting for "Next". */
	function toggleStandard(id: Standard) {
		if (standards.includes(id)) {
			if (standards.length === 1) return; // always at least one
			standards = standards.filter((s) => s !== id);
		} else {
			standards = [...standards, id];
		}
		advance();
	}

	function toggleNotation(id: Notation) {
		if (notations.includes(id)) {
			if (notations.length === 1) return;
			notations = notations.filter((n) => n !== id);
		} else {
			notations = [...notations, id];
		}
		advance();
	}

	function toggleTypeMode() {
		typeMode = !typeMode;
		advance();
	}

	function reset() {
		answered = 0;
		correct = 0;
		streak = 0;
		best = 0;
		recent = [];
		byKind = {};
		history = [];
		missed = [];
		advance();
	}

	/**
	 * Number keys pick an answer, Enter/Space moves on once one is marked.
	 * Ignored while a form control would otherwise handle the key itself, so a
	 * keyboard user tabbed onto a button (or the typed-answer field) does not
	 * trigger it twice.
	 */
	function onKeydown(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		const tag = (e.target as HTMLElement | null)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

		const answeredNow = chosen !== null || typed !== null;
		if (!answeredNow) {
			if (typeMode) return; // typing happens in the field, not via a digit key
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
		},
		{
			q: 'Can I use IEC symbols or a different notation?',
			a: 'Open "Settings" above the topics to check any mix of ANSI/IEC gate symbols and mathematical/engineering/programming notation. Check more than one and questions draw from all of them at random; it defaults to whichever single one the rest of the site starts on.'
		},
		{
			q: 'Can I go back over what I got wrong?',
			a: '"Review your misses" appears under the question once you have missed at least one, with the correct answer and a link to go explore it further. It is cleared by reset, like everything else here.'
		},
		{
			q: 'Can I type the answer instead of picking one?',
			a: 'Yes: turn on "Type it instead of choosing" under Settings. For a question that asks for a specific expression, anything with the same truth table is accepted, in any notation, not only the one form shown as an option in multiple choice — typed mode is checked by the same engine that grades the tools, not by matching text.'
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
			Teaching a class? The <a href={toolLink('/worksheet', { topic })}>worksheet generator</a> puts the same questions on
			paper, with an answer key, from a link everyone can open — carrying over whichever topic is picked below.
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

		<details class="settings">
			<summary>Settings</summary>
			<div class="settings-groups">
				<fieldset>
					<legend>Gate symbols</legend>
					{#each STANDARD_OPTIONS as opt}
						<label class="check">
							<input type="checkbox" checked={standards.includes(opt.id)} on:change={() => toggleStandard(opt.id)} />
							{opt.label}
						</label>
					{/each}
				</fieldset>
				<fieldset>
					<legend>Expression notation</legend>
					{#each NOTATION_OPTIONS as opt}
						<label class="check">
							<input type="checkbox" checked={notations.includes(opt.id)} on:change={() => toggleNotation(opt.id)} />
							{opt.label}
						</label>
					{/each}
				</fieldset>
				<fieldset>
					<legend>Answering</legend>
					<label class="check">
						<input type="checkbox" checked={typeMode} on:change={toggleTypeMode} />
						Type it instead of choosing
					</label>
				</fieldset>
			</div>
		</details>

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

			{#if history.length > 0}
				<div class="history" aria-hidden="true">
					{#each history as ok}
						<span class="dot" class:ok />
					{/each}
				</div>
			{/if}

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

			{#if typeMode}
				<form class="typed" on:submit|preventDefault={submitTyped}>
					<input
						type="text"
						class="mono typed-input"
						class:correct={typed?.right}
						class:wrong={typed !== null && !typed.right}
						bind:value={typedValue}
						bind:this={typedInput}
						disabled={typed !== null}
						placeholder="Your answer"
						aria-label="Your answer"
						autocomplete="off"
						spellcheck="false"
					/>
					{#if !typed}
						<button type="submit" class="cta" disabled={!typedValue.trim()}>Check</button>
					{/if}
				</form>
				<p class="hint">Type your answer and press Enter to check it.</p>
			{:else}
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
			{/if}

			{#if chosen !== null || typed !== null}
				<div class="feedback" class:right={isRight} role="status">
					<p>
						<strong>{isRight ? 'Correct.' : 'Not quite.'}</strong>
						{#if typed && !isRight}
							Correct answer: <span class="mono">{question.options[question.answer]}</span>.
						{/if}
						<!-- Svelte trims the whitespace-only text node straddling an
						     {#if} block down to nothing, so the explanation would run
						     straight into the period above without this. -->
						{' '}{question.explanation}
					</p>
					{#if question.kind === 'circuit-output'}
						<!-- Only this kind re-renders the diagram with the signals applied;
						     the others just add a caption. -->
						The diagram above now shows every wire: green is 1, red is 0.
					{/if}
					{#if question.link}
						<a class="explore" href={question.link.href}>{question.link.label} →</a>
					{/if}
				</div>
				<button type="button" class="cta next" bind:this={nextBtn} on:click={advance}>Next question</button>
			{/if}
		</div>

		{#if missed.length > 0}
			<details class="card missed">
				<summary>Review your misses ({missed.length})</summary>
				<ol class="missed-list">
					{#each [...missed].reverse() as m (m.id)}
						<li>
							<p class="missed-prompt">
								{m.question.prompt}
								{#if m.question.detail}<span class="mono">{m.question.detail}</span>{/if}
							</p>
							<p class="missed-answer">
								Correct: <strong class="mono">{m.question.options[m.question.answer]}</strong> — you chose
								<strong class="mono">{m.yourAnswer}</strong>
							</p>
							<p class="missed-explain">
								{m.question.explanation}
								{#if m.question.link}
									<a href={m.question.link.href}>{m.question.link.label} →</a>
								{/if}
							</p>
						</li>
					{/each}
				</ol>
			</details>
		{/if}
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

	.settings {
		margin-bottom: 14px;
		color: #ccc;
		font-size: 0.85rem;
	}

	.settings summary {
		cursor: pointer;
		color: #ddd;
		width: fit-content;
	}

	.settings summary:hover {
		color: #fff;
	}

	.settings-groups {
		display: flex;
		flex-wrap: wrap;
		gap: 1.4rem;
		margin-top: 0.6rem;
	}

	.settings fieldset {
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem 0.8rem 0.6rem;
		margin: 0;
	}

	.settings legend {
		padding: 0 0.3rem;
		color: #888;
		font-size: 0.75rem;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0;
		cursor: pointer;
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

	.history {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin: -0.5rem 0 1rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background-color: #a22;
	}

	.dot.ok {
		background-color: #5db65d;
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

	.typed {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.typed-input {
		flex: 1;
		min-width: 200px;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 1rem;
		padding: 0.7rem 0.9rem;
		transition: border-color 0.12s ease, background-color 0.12s ease;
	}

	.typed-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.typed-input:disabled {
		cursor: default;
	}

	.typed-input.correct {
		background-color: rgba(51, 119, 34, 0.35);
		border-color: #5db65d;
	}

	.typed-input.wrong {
		background-color: rgba(255, 34, 51, 0.18);
		border-color: #f66;
	}

	.typed :global(.cta:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
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

	.explore {
		display: block;
		margin-top: 0.5rem;
		color: #8ede8e;
	}

	.next {
		margin-top: 1rem;
	}

	.missed {
		margin-top: 1rem;
		padding: 0.9rem 1.1rem;
		color: #ccc;
		font-size: 0.9rem;
	}

	.missed summary {
		cursor: pointer;
		color: #ddd;
	}

	.missed summary:hover {
		color: #fff;
	}

	.missed-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.missed-list li {
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
	}

	.missed-list li:first-child {
		padding-top: 0;
		border-top: none;
	}

	.missed-prompt {
		color: #fff;
		margin: 0 0 0.3rem;
	}

	.missed-answer {
		color: #aaa;
		font-size: 0.85rem;
		margin: 0 0 0.3rem;
	}

	.missed-answer strong {
		color: #ddd;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.missed-explain {
		color: #999;
		font-size: 0.85rem;
		margin: 0;
	}

	.missed-explain a {
		color: #8ede8e;
		margin-left: 0.4rem;
	}
</style>
