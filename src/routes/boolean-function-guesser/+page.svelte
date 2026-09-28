<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { readUrl, syncUrl, safeInt } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';
	import {
		GUESSER_SIZES,
		MAX_GUESSES,
		checkGuess,
		dayNumber,
		puzzleFor,
		remainingFunctions,
		rowLabel,
		shareText,
		type GuesserSize,
		type Puzzle
	} from '$lib/guesser';

	// The size and the seed live in the query string. With no seed the puzzle is
	// today's, the same for everyone, worked out in the browser from the date.
	const DEFAULTS = { n: '3', seed: '' };
	let size: GuesserSize = 3;
	let seed: number | null = null;
	let today = 0;
	let ready = false;

	type Saved = { revealed: number[]; guesses: string[]; done: 'won' | 'lost' | null };
	let revealed: number[] = [];
	let guesses: { text: string; matching: number; total: number }[] = [];
	let done: Saved['done'] = null;
	let typed = '';
	let message = '';
	let copied = false;

	$: activeSeed = seed ?? today;
	$: puzzle = ready ? puzzleFor(activeSeed, size) : (null as Puzzle | null);
	$: label = seed === null ? `#${today}` : `seed ${seed}`;
	$: syncUrl({ n: size, seed: seed ?? '' }, DEFAULTS);

	// Worked out from the variables directly, not from activeSeed: that one only
	// updates after the next flush, and load() runs straight after they change.
	const key = () => `logicgates-guesser:${seed ?? today}:${size}`;

	function load() {
		revealed = [];
		guesses = [];
		done = null;
		try {
			const raw = localStorage.getItem(key());
			if (raw) {
				const saved = JSON.parse(raw);
				revealed = saved.revealed ?? [];
				guesses = saved.guesses ?? [];
				done = saved.done ?? null;
			}
		} catch {
			// Private windows can refuse storage; the game just forgets on reload.
		}
	}

	function save() {
		try {
			localStorage.setItem(key(), JSON.stringify({ revealed, guesses, done }));
		} catch {
			// Nothing to do: progress is a convenience, not a requirement.
		}
	}

	onMount(() => {
		const p = readUrl();
		size = (GUESSER_SIZES as readonly number[]).includes(Number(p.n)) ? (Number(p.n) as GuesserSize) : size;
		seed = safeInt(p.seed, 0, 999999) ?? null;
		today = dayNumber(new Date());
		ready = true;
		load();
	});

	function start(nextSize: GuesserSize, nextSeed: number | null) {
		size = nextSize;
		seed = nextSeed;
		typed = '';
		message = '';
		copied = false;
		load();
	}

	const randomPuzzle = () => start(size, Math.floor(Math.random() * 1000000));

	function probe(row: number) {
		if (done || revealed.includes(row)) return;
		revealed = [...revealed, row];
		save();
	}

	function submit() {
		if (!puzzle || done || !typed.trim()) return;
		const result = checkGuess(puzzle, typed);
		if (result.kind === 'invalid') {
			message = result.message;
			return;
		}
		message = '';
		if (result.kind === 'correct') {
			guesses = [...guesses, { text: typed.trim(), matching: puzzle.rows.length, total: puzzle.rows.length }];
			done = 'won';
		} else {
			guesses = [...guesses, { text: typed.trim(), matching: result.matching, total: result.total }];
			if (guesses.length >= MAX_GUESSES) done = 'lost';
		}
		typed = '';
		save();
	}

	function giveUp() {
		done = 'lost';
		save();
	}

	async function copyResult() {
		const text = shareText({
			label,
			size,
			probes: revealed.length,
			guesses: guesses.length,
			won: done === 'won'
		});
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			message = text;
		}
	}

	$: remaining = puzzle ? remainingFunctions(puzzle, revealed) : 0;
	$: rowCount = 1 << size;
	$: bitsOf = (row: number) => Array.from({ length: size }, (_, bit) => (row >> (size - 1 - bit)) & 1);

	const faqs = [
		{
			q: 'How does the boolean function guesser work?',
			a: 'The game hides a boolean function of two, three or four variables. You probe input combinations to see what the function outputs for each, then type an expression you think matches. Your guess is compared by truth table, so any equivalent expression wins, and a wrong guess tells you how many rows it gets right.'
		},
		{
			q: 'Is there a new puzzle every day?',
			a: 'Yes. With no seed in the link, the puzzle comes from the date, so everyone gets the same function on the same day. There is nothing to sign in to and no server involved: the day number is the seed. The "Random puzzle" button picks any other seed, and a link with a seed always reopens that exact puzzle.'
		},
		{
			q: 'What counts as a correct answer?',
			a: 'Any expression with the same truth table. If the hidden function is (a AND b) XOR c, then c ^ (b & a) is just as right. You can write it with & | ^ and ! or with the words and, or, xor and not.'
		},
		{
			q: 'Why does a wrong guess only give a count?',
			a: 'A row that your guess gets wrong is simply the opposite of what your guess said for it, so naming the wrong rows would reveal the whole truth table in a single guess. The count keeps the puzzle in the probing: every row you look at is worth something.'
		}
	];

	const page = {
		title: 'Boolean Function Guesser: A Logic Puzzle Game',
		description:
			'Work out a hidden boolean function by probing its truth table one row at a time, then type an expression that matches it. A new puzzle every day.',
		url: `${SITE}/boolean-function-guesser`,
		image: `${SITE}/og/boolean-function-guesser.png`,
		imageAlt: 'LogicGates.org: boolean function guesser'
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
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Boolean function guesser' }
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
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/practice', label: 'Practice questions' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Boolean function guesser</h1>
		<p class="lede">
			A hidden boolean function is loaded, and all you can do is ask it questions. <strong>Probe</strong> an input
			combination to see what it outputs, then <strong>guess</strong> the expression. You have {MAX_GUESSES} guesses,
			and every equivalent expression counts as right.
		</p>

		<div class="card tool">
			<div class="fields">
				<div class="field-group">
					<span class="field" id="size-label">Variables</span>
					<div class="seg" role="group" aria-labelledby="size-label">
						{#each GUESSER_SIZES as n}
							<button type="button" class:on={size === n} aria-pressed={size === n} on:click={() => start(n, seed)}>
								{n}
							</button>
						{/each}
					</div>
				</div>
				<div class="field-group">
					<span class="field">Puzzle</span>
					<div class="seg">
						<button type="button" class:on={seed === null} aria-pressed={seed === null} on:click={() => start(size, null)}>
							Today
						</button>
						<button type="button" on:click={randomPuzzle}>Random</button>
					</div>
				</div>
			</div>
			<p class="share-row"><ShareLink what="this puzzle" /></p>

			{#if !puzzle}
				<p class="field-help">Loading the puzzle…</p>
			{:else}
				<div class="board">
					<div class="probe">
						<h2 class="sub">Probe a row</h2>
						<div class="table-wrap">
							<table class="data-table grid" aria-label="Truth table of the hidden function">
								<thead>
									<tr>
										{#each puzzle.variables as v}
											<th scope="col" class="mono">{v}</th>
										{/each}
										<th scope="col" class="mono">out</th>
									</tr>
								</thead>
								<tbody>
									{#each Array(rowCount) as _, row}
										{@const known = revealed.includes(row) || done !== null}
										<tr>
											{#each bitsOf(row) as bit}
												<td class="mono">{bit}</td>
											{/each}
											<td class="out">
												{#if known}
													<span class="mono value" class:one={puzzle.rows[row]} class:late={!revealed.includes(row)}>
														{puzzle.rows[row] ? 1 : 0}
													</span>
												{:else}
													<button
														type="button"
														class="reveal"
														aria-label={`Reveal the output for ${rowLabel(puzzle, row)}`}
														on:click={() => probe(row)}>?</button
													>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="field-help" role="status">
							{revealed.length} of {rowCount} rows probed.
							{#if !done}{remaining.toLocaleString('en')} functions still fit what you have seen.{/if}
						</p>
					</div>

					<div class="guess">
						<h2 class="sub">Your guesses</h2>
						{#if !done}
							<form class="typed" on:submit|preventDefault={submit}>
								<input
									class="expr mono"
									type="text"
									bind:value={typed}
									placeholder={puzzle.variables.slice(0, 2).join(' & ')}
									aria-label="Your guess for the function"
									aria-describedby="guess-help"
									autocomplete="off"
									spellcheck="false"
								/>
								<button type="submit" class="cta" disabled={!typed.trim()}>Guess</button>
							</form>
							<p class="field-help" id="guess-help">
								Use {puzzle.variables.join(', ')} with <span class="mono">&amp; | ^ !</span> or and, or, xor, not.
								{MAX_GUESSES - guesses.length} left.
							</p>
							{#if message}<p class="error" role="alert">{message}</p>{/if}
						{/if}

						<ol class="history" aria-label="Guesses so far">
							{#each guesses as g}
								<li class:right={g.matching === g.total}>
									<span class="mono">{g.text}</span>
									<span class="score">{g.matching === g.total ? 'correct' : `${g.matching} of ${g.total} rows`}</span>
								</li>
							{/each}
						</ol>

						{#if done}
							<div class="result" role="status">
								{#if done === 'won'}
									<p class="win">
										Solved in {guesses.length}
										{guesses.length === 1 ? 'guess' : 'guesses'} with {revealed.length}
										{revealed.length === 1 ? 'probe' : 'probes'}.
									</p>
								{:else}
									<p class="lose">Out of guesses. One answer was <span class="mono">{puzzle.answer}</span>.</p>
								{/if}
								<p class="actions">
									<button type="button" class="cta" on:click={copyResult}>{copied ? 'Copied' : 'Copy result'}</button>
									<button type="button" class="link-btn" on:click={randomPuzzle}>Play a random puzzle</button>
									<a href={`/truth-table-generator?expr=${encodeURIComponent(puzzle.answer)}`}>Open the answer as a truth table</a>
								</p>
							</div>
						{:else if revealed.length > 0}
							<p class="actions"><button type="button" class="link-btn" on:click={giveUp}>Give up and show the answer</button></p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2>How to play well</h2>
		<p class="section-intro">
			Every probe removes half the remaining possibilities, so the strategy is to make your guesses count.
		</p>
		<ul>
			<li>
				<strong>Probe the extremes first.</strong> The rows <span class="mono">000</span> and <span class="mono">111</span> tell
				you whether the function leans towards AND-like or OR-like behaviour.
			</li>
			<li>
				<strong>Look for symmetry.</strong> If the output flips whenever any single input flips, it is an
				<a href="/logic-gates/xor">XOR</a> of those inputs. Only one row being 1 is an AND, and only one row being 0 is an
				OR.
			</li>
			<li>
				<strong>Use the score.</strong> A guess that matches 6 of 8 rows is one flipped pair away from right. Change one
				term and see if the count goes up.
			</li>
			<li>
				<strong>Check your answer as a table.</strong> The <a href="/truth-table-generator">truth table generator</a> shows
				what a guess actually does, and the <a href="/karnaugh-map-solver">Karnaugh map solver</a> turns a table back into
				the shortest expression.
			</li>
		</ul>
	</section>

	<section>
		<h2>Questions</h2>
		{#each faqs as f}
			<details class="faq">
				<summary>{f.q}</summary>
				<p>{f.a}</p>
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
	.fields {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}
	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}
	.seg {
		display: inline-flex;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		overflow: hidden;
	}
	.seg button {
		background: #0d0d0f;
		color: #fff;
		border: 0;
		padding: 0.5rem 0.9rem;
		font: inherit;
		cursor: pointer;
	}
	.seg button + button {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}
	.seg button.on {
		background: #2c6b2c;
	}
	.seg button:focus-visible,
	.reveal:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}
	.share-row {
		margin: 0.8rem 0 0;
	}
	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
	}
	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.6rem 0 0;
		white-space: pre-line;
	}
	.board {
		display: grid;
		grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
		gap: 1.5rem;
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}
	.sub {
		font-size: 1rem;
		margin: 0 0 0.6rem;
	}
	.grid td,
	.grid th {
		text-align: center;
	}
	.reveal {
		background: #0d0d0f;
		color: #9ad39a;
		border: 1px dashed rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		width: 2rem;
		cursor: pointer;
		font: inherit;
	}
	.reveal:hover {
		border-color: #5db65d;
	}
	.value {
		color: #aaa;
	}
	.value.one {
		color: #7be27b;
		font-weight: 700;
	}
	.value.late {
		opacity: 0.55;
	}
	.typed {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.expr {
		flex: 1;
		min-width: 10rem;
		box-sizing: border-box;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 1rem;
		padding: 0.55rem 0.6rem;
	}
	.expr:focus {
		outline: none;
		border-color: #5db65d;
	}
	.history {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
	}
	.history li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.6rem;
		border-left: 3px solid #b55;
		background: rgba(255, 255, 255, 0.04);
		margin-bottom: 0.4rem;
	}
	.history li.right {
		border-left-color: #5db65d;
	}
	.score {
		color: #bbb;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.result {
		margin-top: 1rem;
	}
	.win {
		color: #7be27b;
	}
	.lose {
		color: #f99;
	}
	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0.8rem 0 0;
	}
	.link-btn {
		background: none;
		border: 0;
		color: #9ad39a;
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
	.faq summary {
		cursor: pointer;
		font-weight: 600;
	}
	@media (max-width: 640px) {
		.board {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
