<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		RANGES,
		RANGE_KEYS,
		rangeOf,
		sizeOf,
		ceilLog2,
		questionsNeeded,
		guessesNeeded,
		liarQuestionsNeeded,
		playFind,
		answersFor,
		wrongAnswers,
		answersToText,
		answersFromText,
		liarEncode,
		liarDecode,
		LIAR_TABLE,
		LIAR_QUESTIONS,
		CHECK_POSITIONS,
		honestReply,
		evilReply,
		narrowed,
		middleGuess,
		halvingGuesses,
		randomInRange,
		rangeFacts,
		fmt,
		type RangeKey,
		type Reply
	} from '$lib/guessNumber';
	import { readUrl, syncUrl, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount, tick } from 'svelte';

	const MODES = ['find', 'liar', 'guess'] as const;
	type Mode = typeof MODES[number];
	const modeLabels: Record<Mode, string> = {
		find: 'I find your number',
		liar: 'Liar mode',
		guess: 'You guess mine'
	};
	const DEFAULTS = { mode: 'find', r: '100', a: '', evil: '' };

	let mode: Mode = 'find';
	let rangeKey: RangeKey = '100';
	/** The yes/no answers given so far, in find and liar mode. */
	let answers: boolean[] = [];
	let evil = false;
	let mounted = false;

	onMount(() => {
		const p = readUrl();
		mode = safeOption(p.mode, MODES) ?? mode;
		rangeKey = safeOption(p.r, RANGE_KEYS) ?? rangeKey;
		evil = p.evil === '1';
		if (mode === 'liar') answers = answersFromText(p.a, LIAR_QUESTIONS) ?? [];
		else if (mode === 'find') {
			const r = rangeOf(rangeKey);
			const given = answersFromText(p.a, questionsNeeded(sizeOf(r.lo, r.hi))) ?? [];
			// Some paths finish a question early; drop answers past the end so Undo always undoes something.
			answers = given.slice(0, playFind(r, given).steps.length);
		}
		mounted = true;
		if (mode === 'guess') newGame();
	});
	$: syncUrl(
		{
			mode,
			// Liar mode is always 0 to 127, so a range in its link would mean nothing.
			r: mode === 'liar' ? DEFAULTS.r : rangeKey,
			a: mode === 'guess' ? '' : answersToText(answers),
			evil: mode === 'guess' && evil ? '1' : ''
		},
		DEFAULTS
	);

	$: range = rangeOf(rangeKey);
	$: rangeSize = sizeOf(range.lo, range.hi);

	// --- mode 1: the page finds your number ---------------------------------
	$: find = playFind(range, answers);
	$: findLimit = questionsNeeded(rangeSize);
	$: findLeft = sizeOf(find.lo, find.hi);
	/** After the search ends: has the player confirmed the number? */
	let verdict: 'ask' | 'right' | 'wrong' = 'ask';
	let actualText = '';
	$: actualDigits = actualText.replace(/[,_\s]/g, '');
	$: actual = /^\d{1,7}$/.test(actualDigits) ? Number(actualDigits) : null;
	$: actualInRange = actual !== null && actual >= range.lo && actual <= range.hi;
	$: slips = actual !== null && actualInRange ? wrongAnswers(find.steps, actual) : [];
	$: bitsSoFar = find.steps.map((s) => (s.answer ? '1' : '0')).join('');

	// --- mode 2: liar mode ----------------------------------------------------
	$: liarQuestion = answers.length < LIAR_QUESTIONS ? LIAR_TABLE[answers.length] : null;
	$: liarResult = mode === 'liar' && answers.length === LIAR_QUESTIONS ? liarDecode(answers) : null;
	$: liarTruth = liarResult && liarResult.verdict.kind !== 'many' ? liarEncode(liarResult.verdict.number) : null;

	async function answer(yes: boolean) {
		if (mode === 'find' && find.done) return;
		if (mode === 'liar' && answers.length >= LIAR_QUESTIONS) return;
		answers = [...answers, yes];
		verdict = 'ask';
		actualText = '';
		// The last answer removes the Yes/No buttons; keep keyboard focus in the game, not on <body>.
		const over = mode === 'liar' ? answers.length === LIAR_QUESTIONS : playFind(range, answers).done;
		if (over) {
			await tick();
			focusId(mode === 'liar' ? 'liar-result' : 'confirm-yes');
		}
	}

	async function setVerdict(v: 'right' | 'wrong') {
		verdict = v;
		await tick();
		focusId(v === 'wrong' ? 'actual' : 'play-again');
	}

	function focusId(id: string) {
		document.getElementById(id)?.focus();
	}

	function undo() {
		answers = answers.slice(0, -1);
		verdict = 'ask';
		actualText = '';
	}

	function restart() {
		answers = [];
		verdict = 'ask';
		actualText = '';
	}

	// --- mode 3: you guess the page's number --------------------------------
	let secret: number | null = null;
	let history: { guess: number; reply: Reply; wasted: boolean }[] = [];
	/** What evil mode still allows: it never holds one number, only this range. */
	let evilLo = 1;
	let evilHi = 100;
	let guessText = '';
	let guessError = '';
	let showHint = false;

	const random32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

	function newGame() {
		// From rangeKey, not the reactive `range`, which may not have caught up yet
		// (on mount, straight after the URL sets rangeKey).
		const r = rangeOf(rangeKey);
		history = [];
		guessText = '';
		guessError = '';
		showHint = false;
		evilLo = r.lo;
		evilHi = r.hi;
		// Picked in the browser, never at prerender, so every visitor gets their own.
		secret = randomInRange(r.lo, r.hi, random32);
	}

	$: known = narrowed(range, history);
	$: won = history.length > 0 && history[history.length - 1].reply === 'correct';
	$: guessLimit = guessesNeeded(rangeSize);
	$: lastReply = history.length ? history[history.length - 1] : null;

	async function submitGuess() {
		if (won || secret === null) return;
		const text = guessText.trim().replace(/[,_\s]/g, '');
		if (!/^\d+$/.test(text) || Number(text) < range.lo || Number(text) > range.hi) {
			guessError = `Guess a whole number from ${range.label}.`;
			return;
		}
		guessError = '';
		const guess = Number(text);
		const wasted = guess < known.lo || guess > known.hi;
		let reply: Reply;
		if (evil) {
			const r = evilReply(evilLo, evilHi, guess, random32() % 2 === 0);
			reply = r.reply;
			evilLo = r.lo;
			evilHi = r.hi;
		} else reply = honestReply(secret, guess);
		history = [...history, { guess, reply, wasted }];
		guessText = '';
		showHint = false;
		if (reply === 'correct') {
			// The input is now disabled, which would drop focus to <body>.
			await tick();
			focusId('new-game');
		}
	}

	// --- switching ---------------------------------------------------------
	async function setMode(m: Mode) {
		if (m === mode) return;
		mode = m;
		answers = [];
		verdict = 'ask';
		actualText = '';
		if (m === 'guess') {
			await tick();
			newGame();
		}
	}

	async function setRange(k: RangeKey) {
		rangeKey = k;
		answers = [];
		verdict = 'ask';
		actualText = '';
		if (mode === 'guess') {
			await tick();
			newGame();
		}
	}

	async function toggleEvil() {
		await tick();
		newGame();
	}

	/** A demo game, as a link and a click: the answers someone telling the truth about `n` would give. */
	function demoFind(key: RangeKey, n: number) {
		mode = 'find';
		rangeKey = key;
		answers = answersFor(rangeOf(key), n);
		verdict = 'ask';
		actualText = '';
		focusTool();
	}

	function demoLiar(n: number, lies: number[]) {
		mode = 'liar';
		answers = liarAnswers(n, lies);
		verdict = 'ask';
		actualText = '';
		focusTool();
	}

	function focusTool() {
		const el = document.getElementById('game');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		el?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
		el?.focus({ preventScroll: true });
	}

	function liarAnswers(n: number, lies: number[]): boolean[] {
		const a = liarEncode(n);
		for (const q of lies) a[q - 1] = !a[q - 1];
		return a;
	}

	/** Y and N answer the question, unless someone is typing somewhere. */
	function onKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
		const t = e.target as HTMLElement | null;
		if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		const key = e.key.toLowerCase();
		if (key !== 'y' && key !== 'n') return;
		const open = (mode === 'find' && !find.done) || (mode === 'liar' && answers.length < LIAR_QUESTIONS);
		if (!open) return;
		e.preventDefault();
		answer(key === 'y');
	}

	// --- the shareable result ----------------------------------------------
	const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
	const guessCount = (n: number) => `${fmt(n)} ${n === 1 ? 'guess' : 'guesses'}`;
	$: resultText =
		mode === 'find' && find.done && verdict === 'right'
			? `Found ${fmt(find.lo)} in ${plural(find.steps.length, 'question')} (${range.label}).`
			: mode === 'liar' && liarResult && liarResult.verdict.kind === 'lie'
			? `Found ${liarResult.verdict.number} in 11 questions and caught the lie on question ${liarResult.verdict.question}.`
			: mode === 'liar' && liarResult && liarResult.verdict.kind === 'truth'
			? `Found ${liarResult.verdict.number} in 11 questions, with no lie told.`
			: mode === 'guess' && won && evil
			? `Cornered evil mode in ${guessCount(history.length)} (${range.label}); it can always force ${guessLimit}.`
			: mode === 'guess' && won
			? `Guessed ${fmt(known.lo)} in ${guessCount(history.length)} (${
					range.label
			  }); halving never needs more than ${guessLimit}.`
			: '';
	let copied: 'idle' | 'copied' | 'failed' = 'idle';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyResult() {
		try {
			await navigator.clipboard.writeText(`${resultText} ${location.origin}/guess-my-number`);
			copied = 'copied';
		} catch {
			copied = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = 'idle'), 2500);
	}

	const pct = (n: number) => ((n - range.lo) / rangeSize) * 100;

	// --- teaching content, all from the engine ------------------------------
	const r100 = rangeOf('100');
	const r128 = rangeOf('128');
	const worked = playFind(r100, answersFor(r100, 42));
	const workedBits = playFind(r128, answersFor(r128, 42));
	const facts = RANGES.map(rangeFacts);
	const f100 = rangeFacts(r100);
	const f128 = rangeFacts(r128);
	const fMillion = rangeFacts(rangeOf('1000000'));
	const LIAR_EXAMPLE_LIE = 6;
	const liarExample = liarDecode(liarAnswers(42, [LIAR_EXAMPLE_LIE]));
	const liarExampleTruth = liarEncode(42);
	const liarExampleSaid = liarAnswers(42, [LIAR_EXAMPLE_LIE]);
	/** Two lies whose syndrome names a question that does not exist, so the page can say so. */
	const TWO_LIES = [4, 8];
	const twoLiesSyndrome = TWO_LIES.reduce((a, b) => a ^ b, 0);
	const liarMin = liarQuestionsNeeded(128);
	const dataQuestions = LIAR_TABLE.filter((q) => q.role === 'data');
	/** Patterns needed against patterns available, one question short and at the minimum. */
	const volume = (q: number) => ({ q, need: 128 * (q + 1), have: 2 ** q });
	const volumeShort = volume(liarMin - 1);
	const volumeEnough = volume(liarMin);
	/** Repeating each bit question three times and taking the majority. */
	const tripled = 3 * questionsNeeded(128);
	/** 100, 50, 25, …: what is left after each halving. */
	const halvings = [100];
	while (halvings[halvings.length - 1] > 1) halvings.push(Math.ceil(halvings[halvings.length - 1] / 2));

	/** A halving player against the evil page on 1 to 100, ties going high. */
	const evilGame = (() => {
		let lo = r100.lo;
		let hi = r100.hi;
		const moves: { guess: number; reply: Reply; lo: number; hi: number }[] = [];
		for (;;) {
			const guess = middleGuess(lo, hi);
			const r = evilReply(lo, hi, guess, true);
			moves.push({ guess, reply: r.reply, lo: r.lo, hi: r.hi });
			if (r.reply === 'correct') return moves;
			lo = r.lo;
			hi = r.hi;
		}
	})();

	const replyText: Record<Reply, string> = { higher: 'Higher', lower: 'Lower', correct: 'Correct' };
	const yn = (b: boolean) => (b ? 'Yes' : 'No');
	const sup = (n: number) =>
		String(n)
			.split('')
			.map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])
			.join('');

	const faqs = [
		{
			q: 'How many questions does it take to guess a number from 1 to 100?',
			a: `${f100.questions}. Each yes/no answer can at best halve the numbers left, and ${
				f100.questions
			} halvings cover 2${sup(f100.questions)} = ${2 ** f100.questions} numbers while ${
				f100.questions - 1
			} cover only ${
				2 ** (f100.questions - 1)
			}, fewer than 100. Asking "is it greater than the middle?" every time reaches that bound for every number, not just on average.`
		},
		{
			q: 'Why does 0 to 127 need 7 questions but 8 higher/lower guesses?',
			a: `With yes/no questions, the search is over the moment one number is left; nobody has to say it. A higher/lower game only ends when the number is guessed out loud, so the last guess is one more. That makes it ⌊log₂ n⌋ + 1 guesses: ${f128.guesses} for 128 numbers, but still ${f100.guesses} for 1 to 100.`
		},
		{
			q: 'How does liar mode work out which answer was the lie?',
			a: `The ${LIAR_QUESTIONS} questions are the bits of a Hamming code: 7 ask for the bits of your number, and 4 are checks that each cover an overlapping group of questions. A single lie breaks exactly the checks whose groups contain it, and the numbers of the broken checks (1, 2, 4 and 8) add up to the number of the question that was the lie.`
		},
		{
			q: 'Could fewer than 11 questions catch one lie?',
			a: `Not for 128 numbers. With q questions each number has q + 1 answer patterns (honest, or with one of the q answers flipped) and no two numbers may share one, so 128 × (q + 1) must fit in 2 to the power q. For q = ${
				volumeShort.q
			} that is ${fmt(volumeShort.need)} patterns against ${fmt(volumeShort.have)}; for q = ${
				volumeEnough.q
			} it is ${fmt(volumeEnough.need)} against ${fmt(
				volumeEnough.have
			)}. The argument holds even when each question is chosen after hearing the last answer.`
		},
		{
			q: 'Does the evil mode cheat?',
			a: 'No. It never picks a number, but every reply it gives is true of every number still in play, so at any point there is a number it could reveal that fits all its answers. It just keeps the larger half each time, which forces a halving player to the full ⌊log₂ n⌋ + 1 guesses.'
		},
		{
			q: 'How many questions for a number from 1 to 1,000,000?',
			a: `${fMillion.questions}, because 2${sup(fMillion.questions)} = ${fmt(
				2 ** fMillion.questions
			)} is the first power of two past a million. If one answer may be a lie, at least ${
				fMillion.withOneLie
			} questions are needed by the same counting argument as liar mode.`
		}
	];

	const page = {
		title: 'Guess My Number Game: Binary Search, Bits and a Liar Mode',
		description:
			'Think of a number from 1 to 100 and the page finds it in at most 7 yes/no questions. Then try liar mode, where a Hamming code catches one lie.',
		url: `${SITE}/guess-my-number`,
		image: `${SITE}/og/guess-my-number.png`,
		imageAlt: 'LogicGates.org: guess my number with binary search, bits and a liar mode'
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
					{ '@type': 'ListItem', position: 3, name: 'Guess my number' }
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

<svelte:window on:keydown={onKey} />

<ContentPage
	related={[
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/bit-manipulation-tricks', label: 'Bit manipulation tricks' },
		{ href: '/gray-code-converter', label: 'Gray code converter' },
		{ href: '/practice', label: 'Practice' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Guess my number</h1>
		<p class="lede">
			Think of a number and answer yes or no: the page finds it in at most {f100.questions} questions for 1 to 100, because
			every answer is worth up to one bit. Then try lying once, or guessing the page's number while it plays dirty.
		</p>

		<div class="card tool" id="game" tabindex="-1">
			<div class="modes" role="group" aria-label="Game">
				{#each MODES as m}
					<button type="button" class:active={mode === m} aria-pressed={mode === m} on:click={() => setMode(m)}
						>{modeLabels[m]}</button
					>
				{/each}
			</div>

			{#if mode !== 'liar'}
				<div class="range-row">
					<label class="field inline" for="range">Numbers from</label>
					<select
						id="range"
						value={rangeKey}
						on:change={(e) => setRange(safeOption(e.currentTarget.value, RANGE_KEYS) ?? '100')}
					>
						{#each RANGES as r}
							<option value={r.key}>{r.label}</option>
						{/each}
					</select>
					{#if mode === 'guess'}
						<label class="evil">
							<input type="checkbox" bind:checked={evil} on:change={toggleEvil} />
							Evil mode: the page never commits to a number
						</label>
					{/if}
				</div>
			{/if}

			{#if mode === 'find'}
				<p class="setup">
					Think of a whole number from {range.label}. {#if rangeKey === '128'}Every question asks about one bit of it,
						so the answers spell it in binary.{:else}I need at most {findLimit} questions.{/if}
				</p>
				<div class="play">
					<div class="question" role="status">
						{#if !find.done}
							<span class="q-count">Question {find.steps.length + 1} of at most {findLimit}</span>
							{#if find.nextBit !== null}
								<span class="q-text">Is the {fmt(2 ** find.nextBit)}s bit of your number a 1?</span>
								<span class="q-also"
									>Given your answers so far, that is the same as: is it greater than {fmt(find.next ?? 0)}?</span
								>
							{:else}
								<span class="q-text">Is your number greater than {fmt(find.next ?? 0)}?</span>
							{/if}
						{:else}
							<span class="q-count"
								>Done in {plural(find.steps.length, 'question')}{find.steps.length < findLimit
									? `, ${findLimit - find.steps.length} fewer than the most it can take`
									: ''}</span
							>
							<span class="q-text">Your number is <strong class="mono">{fmt(find.lo)}</strong>.</span>
							{#if rangeKey === '128'}
								<span class="q-also"
									>Your answers, yes as 1 and no as 0, spell <span class="mono">{bitsSoFar}</span>, which is {find.lo}
									in binary.</span
								>
							{/if}
						{/if}
					</div>

					{#if !find.done}
						<div class="yes-no">
							<button type="button" class="big yes" aria-keyshortcuts="y" on:click={() => answer(true)}
								>Yes <kbd aria-hidden="true">Y</kbd></button
							>
							<button type="button" class="big no" aria-keyshortcuts="n" on:click={() => answer(false)}
								>No <kbd aria-hidden="true">N</kbd></button
							>
						</div>
					{:else if verdict === 'ask'}
						<div class="yes-no">
							<button type="button" class="big yes" id="confirm-yes" on:click={() => setVerdict('right')}
								>That is my number</button
							>
							<button type="button" class="big no" on:click={() => setVerdict('wrong')}>It is not</button>
						</div>
					{:else if verdict === 'right'}
						<div class="yes-no">
							<button type="button" class="big yes" id="play-again" on:click={restart}>Play again</button>
						</div>
					{:else if verdict === 'wrong'}
						<div class="slip">
							<label class="field" for="actual">Then an answer slipped. What was your number?</label>
							<input
								id="actual"
								class="value-input"
								type="text"
								inputmode="numeric"
								autocomplete="off"
								bind:value={actualText}
								aria-invalid={actualText.trim() && !actualInRange ? 'true' : 'false'}
								aria-describedby="slip-out"
							/>
							<div id="slip-out" aria-live="polite">
								{#if actualText.trim() && !actualInRange}
									<p class="error" role="alert">Type a whole number from {range.label}.</p>
								{:else if actual !== null && slips.length}
									<p class="slip-text">
										For {fmt(actual)},
										{#each slips as q, i}{i ? (i === slips.length - 1 ? ' and ' : ', ') : ''}question {q}
											(greater than {fmt(find.steps[q - 1].threshold)}?) should have been {yn(
												!find.steps[q - 1].answer
											).toLowerCase()}{/each}. One wrong answer sends the search down the wrong half, and halving never
										looks back, which is why liar mode needs extra questions.
									</p>
								{:else if actual !== null}
									<p class="slip-text">Every answer fits {fmt(actual)}, so the search did land on it.</p>
								{/if}
							</div>
						</div>
					{/if}

					<div class="bar-wrap" aria-hidden="true">
						<div class="bar">
							<span class="bar-in" style="left: {pct(find.lo)}%; width: {(findLeft / rangeSize) * 100}%" />
						</div>
						<div class="bar-ends"><span>{fmt(range.lo)}</span><span>{fmt(range.hi)}</span></div>
					</div>
					<p class="left-text">
						{#if find.done}
							One number left out of {fmt(rangeSize)}.
						{:else}
							Still possible: {fmt(find.lo)} to {fmt(find.hi)}, {fmt(findLeft)} numbers, so at most {ceilLog2(findLeft)}
							more {ceilLog2(findLeft) === 1 ? 'question' : 'questions'}.
						{/if}
					</p>

					<div class="controls">
						<button type="button" class="small-btn" on:click={undo} disabled={!answers.length}>Undo last answer</button>
						<button type="button" class="small-btn" on:click={restart} disabled={!answers.length}>Start again</button>
					</div>
				</div>

				{#if find.steps.length}
					<h2 class="working-title">The trail</h2>
					<div class="table-wrap scroll-box">
						<table class="data-table trail">
							<thead>
								<tr>
									<th scope="col">#</th>
									<th scope="col">Question</th>
									<th scope="col"><span class="wide">Answer</span><span class="narrow">Ans.</span></th>
									<th scope="col">Left</th>
									{#if rangeKey === '128'}<th scope="col">Bits so far</th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each find.steps as s, i}
									{@const after = i + 1 < find.steps.length ? find.steps[i + 1] : find}
									<tr class:slipped={slips.includes(i + 1)}>
										<td class="mono">{i + 1}</td>
										<td
											>{#if s.bit !== null}{fmt(2 ** s.bit)}s bit 1?<span class="wide"
													>{` (> ${fmt(s.threshold)})`}</span
												>{:else}<span class="wide">Greater than</span><span class="narrow">&gt;</span>
												{fmt(s.threshold)}?{/if}</td
										>
										<td class="mono strong"
											><span class="wide">{yn(s.answer)}</span><span class="narrow">{s.answer ? 'Y' : 'N'}</span
											>{slips.includes(i + 1) ? ' (wrong)' : ''}</td
										>
										<td class="mono">{fmt(after.lo)}{after.lo === after.hi ? '' : ` to ${fmt(after.hi)}`}</td>
										{#if rangeKey === '128'}<td class="mono">{bitsSoFar.slice(0, i + 1)}{'·'.repeat(6 - i)}</td>{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if find.done}
						<p class="reducer">
							{findLimit} yes/no answers can tell apart 2{sup(findLimit)} = {fmt(2 ** findLimit)} numbers{#if findLimit > 1},
								{findLimit - 1} only {fmt(2 ** (findLimit - 1))}{/if}, so {range.label} always takes at most {findLimit}.
						</p>
					{/if}
				{/if}
			{:else if mode === 'liar'}
				<p class="setup">
					Think of a whole number from 0 to 127. I ask {LIAR_QUESTIONS} questions, all fixed in advance, and you may lie
					in answer to any one of them. I still find the number, and I tell you which answer was the lie.
				</p>
				{#if liarQuestion}
					<div class="question" role="status">
						<span class="q-count">Question {liarQuestion.position} of {LIAR_QUESTIONS}</span>
						<span class="q-text">Is your number in this set?</span>
						<span class="q-also">The {liarQuestion.members.length} numbers in the set are boxed and bold.</span>
					</div>
					<p class="visually-hidden">The set: {liarQuestion.members.join(', ')}.</p>
					<div class="num-grid" aria-hidden="true">
						{#each Array.from({ length: 128 }, (_, n) => n) as n}
							<span class:in={liarQuestion.members.includes(n)}>{n}</span>
						{/each}
					</div>
					<div class="yes-no">
						<button type="button" class="big yes" aria-keyshortcuts="y" on:click={() => answer(true)}
							>Yes <kbd aria-hidden="true">Y</kbd></button
						>
						<button type="button" class="big no" aria-keyshortcuts="n" on:click={() => answer(false)}
							>No <kbd aria-hidden="true">N</kbd></button
						>
					</div>
					<div class="controls">
						<span class="progress mono"
							><span class="visually-hidden">Answers so far: </span>{answers
								.map((a) => (a ? 'Y' : 'N'))
								.join(' ')}{answers.length ? ' ' : ''}{'_ '.repeat(LIAR_QUESTIONS - answers.length).trim()}</span
						>
						<button type="button" class="small-btn" on:click={undo} disabled={!answers.length}>Undo last answer</button>
						<button type="button" class="small-btn" on:click={restart} disabled={!answers.length}>Start again</button>
					</div>
				{:else if liarResult}
					<div class="question" role="status" id="liar-result" tabindex="-1">
						{#if liarResult.verdict.kind === 'many'}
							<span class="q-count">More than one lie</span>
							<span class="q-text">Those answers do not fit any number with at most one lie.</span>
							<span class="q-also"
								>The broken checks add up to {liarResult.syndrome}, and there is no question {liarResult.syndrome}: at
								least two answers were lies.</span
							>
						{:else}
							<span class="q-count"
								>{liarResult.verdict.kind === 'lie'
									? `You lied on question ${liarResult.verdict.question}`
									: 'No lies told'}</span
							>
							<span class="q-text">Your number is <strong class="mono">{liarResult.verdict.number}</strong>.</span>
							<span class="q-also">
								{#if liarResult.verdict.kind === 'lie'}
									You said {yn(liarResult.verdict.said).toLowerCase()} to question {liarResult.verdict.question}; the
									true answer was {yn(!liarResult.verdict.said).toLowerCase()}. The broken checks add up to {liarResult.syndrome}.
								{:else}
									Every check came out even, so every answer fits {liarResult.verdict.number}.
								{/if}
							</span>
						{/if}
					</div>
					<p class="reducer">
						If you told two lies, the code can be fooled into "fixing" the wrong answer and naming the wrong number: it
						only promises to correct one.
					</p>

					<h2 class="working-title">The checks</h2>
					<div class="table-wrap">
						<table class="data-table checks">
							<thead>
								<tr>
									<th scope="col">Check</th>
									<th scope="col"><span class="wide">Questions in the group</span><span class="narrow">Group</span></th>
									<th scope="col"><span class="wide">Yes answers</span><span class="narrow">Yes</span></th>
									<th scope="col">Result</th>
								</tr>
							</thead>
							<tbody>
								{#each liarResult.checks as c}
									<tr>
										<td class="mono strong">{c.check}</td>
										<td class="mono"
											><span class="wide">{c.positions.join(', ')}</span><span class="narrow"
												>{c.positions.join(',')}</span
											></td
										>
										<td class="mono">{c.yes}</td>
										<td
											>{#if c.odd}Odd<span class="wide">: broken, add {c.check}</span><span class="narrow"
													>, +{c.check}</span
												>{:else}Even<span class="wide">: fine</span>{/if}</td
										>
									</tr>
								{/each}
								<tr class="total">
									<th scope="row" colspan="3">Sum of broken checks<span class="wide">{' '}(the syndrome)</span></th>
									<td class="mono strong">{liarResult.syndrome}</td>
								</tr>
							</tbody>
						</table>
					</div>

					<h2 class="working-title">Your answers</h2>
					<div class="table-wrap">
						<table class="data-table answers">
							<thead>
								<tr>
									<th scope="col">Question</th>
									<th scope="col">Kind</th>
									<th scope="col"><span class="wide">You said</span><span class="narrow">Said</span></th>
									{#if liarTruth}<th scope="col">True<span class="wide">{' '}answer</span></th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each LIAR_TABLE as q, i}
									<tr class:slipped={liarTruth !== null && liarTruth[i] !== answers[i]}>
										<td class="mono">{q.position}</td>
										<td class="kind">{q.role === 'check' ? `Check ${q.position}` : `${q.value}s bit`}</td>
										<td class="mono">{yn(answers[i])}</td>
										{#if liarTruth}<td class="mono strong"
												>{yn(liarTruth[i])}{#if liarTruth[i] !== answers[i]}<span class="wide">{' (the lie)'}</span
													><span class="narrow">{' (lie)'}</span>{/if}</td
											>{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="controls">
						<button type="button" class="small-btn" on:click={undo}>Undo last answer</button>
						<button type="button" class="small-btn" on:click={restart}>Play again</button>
					</div>
				{/if}
			{:else}
				<p class="setup">
					{#if evil}
						I am thinking of a number from {range.label}. Or am I? Guess, and I say higher or lower, always truthfully
						for some number.
					{:else}
						I have picked a number from {range.label} at random. Guess, and I say higher or lower. Halving never needs more
						than {guessLimit} guesses.
					{/if}
				</p>
				<form class="guess-form" on:submit|preventDefault={submitGuess}>
					<label class="field" for="guess">Your guess</label>
					<div class="guess-row">
						<input
							id="guess"
							class="value-input"
							type="text"
							inputmode="numeric"
							autocomplete="off"
							bind:value={guessText}
							disabled={won}
							aria-invalid={guessError ? 'true' : 'false'}
							aria-describedby="guess-help"
						/>
						<button type="submit" class="big yes" disabled={won || !mounted}>Guess</button>
					</div>
					<p class="field-help" id="guess-help">
						{#if guessError}
							<span class="error" role="alert">{guessError}</span>
						{:else if won}
							Start a new game to play again.
						{:else if history.length}
							It is between {fmt(known.lo)} and {fmt(known.hi)}: {fmt(sizeOf(known.lo, known.hi))}
							{sizeOf(known.lo, known.hi) === 1 ? 'number' : 'numbers'} left.
						{:else}
							A whole number from {range.label}. Press Enter to guess.
						{/if}
					</p>
				</form>

				<div class="question" role="status">
					{#if lastReply}
						<span class="q-count">Guess {history.length}: {fmt(lastReply.guess)}</span>
						{#if lastReply.reply === 'correct'}
							<span class="q-text">Correct: <strong class="mono">{fmt(lastReply.guess)}</strong>.</span>
							<span class="q-also">
								{#if evil}
									You needed {guessCount(history.length)}. I never picked a number: I kept whichever side of your guess
									held more numbers, and only said "correct" when one was left. Against that, nobody can be sure of
									winning in fewer than {guessLimit}.
								{:else}
									You needed {guessCount(history.length)}; halving never needs more than {guessLimit}, and would have
									found {fmt(lastReply.guess)} in {guessCount(halvingGuesses(range, lastReply.guess))}.
								{/if}
							</span>
						{:else}
							<span class="q-text">{replyText[lastReply.reply]} than {fmt(lastReply.guess)}.</span>
							{#if lastReply.wasted}
								<span class="q-also"
									>Your earlier hints had already ruled that out, so this guess told you nothing new.</span
								>
							{/if}
						{/if}
					{:else}
						<span class="q-count">No guesses yet</span>
						<span class="q-text">Make your first guess.</span>
					{/if}
				</div>

				<div class="bar-wrap" aria-hidden="true">
					<div class="bar">
						<span
							class="bar-in"
							style="left: {pct(known.lo)}%; width: {(sizeOf(known.lo, known.hi) / rangeSize) * 100}%"
						/>
					</div>
					<div class="bar-ends"><span>{fmt(range.lo)}</span><span>{fmt(range.hi)}</span></div>
				</div>

				<div class="controls">
					{#if !won}
						<button type="button" class="small-btn" on:click={() => (showHint = true)} disabled={!mounted}
							>What would halving guess?</button
						>
					{/if}
					<button type="button" class="small-btn" id="new-game" on:click={newGame} disabled={!mounted}>New game</button>
				</div>
				{#if showHint && !won}
					<p class="hint" aria-live="polite">
						The middle of what is left: {fmt(middleGuess(known.lo, known.hi))}. Either answer then rules out about half.
					</p>
				{/if}

				{#if history.length}
					<ol class="history">
						{#each history as h}
							<li>
								<span class="mono">{fmt(h.guess)}</span>: {replyText[h.reply].toLowerCase()}{h.wasted
									? ' (already ruled out)'
									: ''}
							</li>
						{/each}
					</ol>
				{/if}
			{/if}

			{#if resultText}
				<div class="result-row">
					<span class="result-text">{resultText}</span>
					<button type="button" class="small-btn" on:click={copyResult}>Copy result</button>
					<span class="copied" aria-live="polite"
						>{copied === 'copied'
							? 'Copied'
							: copied === 'failed'
							? 'Could not copy; select the text instead'
							: ''}</span
					>
				</div>
			{/if}

			<div class="chips">
				<span class="chips-label">Watch a game (replaces the one in progress):</span>
				<button type="button" class="chip-btn" on:click={() => demoFind('100', 42)}>Find 42</button>
				<button type="button" class="chip-btn" on:click={() => demoFind('128', 42)}>42 in binary</button>
				<button type="button" class="chip-btn" on:click={() => demoFind('1000000', 777777)}>Find 777,777</button>
				<button type="button" class="chip-btn" on:click={() => demoLiar(42, [6])}>Liar: 42, lie on 6</button>
				<button type="button" class="chip-btn" on:click={() => demoLiar(100, [])}>Liar: 100, no lie</button>
				<button type="button" class="chip-btn" on:click={() => demoLiar(42, TWO_LIES)}>Liar: two lies</button>
			</div>
			<p class="share-row"><ShareLink what="this game" /></p>
		</div>
	</section>

	<section id="halving">
		<h2>How halving finds any number in {f100.questions} questions</h2>
		<p>
			Each question splits the numbers still possible into two groups, and the answer throws one away. Asking "is it
			greater than the middle?" makes the two groups as equal as they can be, so whichever answer comes, at most half
			(rounded up) are left. From 100 that goes {halvings.join(', ')}: {halvings.length - 1} questions.
		</p>
		<p>
			Seven is not a coincidence of 100. Six answers can only tell apart 2{sup(6)} = 64 cases, fewer than 100, so no list
			of six yes/no questions can work for every number. Seven can tell apart 2{sup(7)} = 128, enough with room to spare.
			In general n numbers need ⌈log₂ n⌉ questions, the number of bits it takes to write n − 1 in binary.
		</p>
		<div class="table-wrap">
			<table class="data-table trail">
				<caption>Finding 42 in 1 to 100</caption>
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col">Possible before</th>
						<th scope="col">Question</th>
						<th scope="col">Answer</th>
						<th scope="col">Possible after</th>
					</tr>
				</thead>
				<tbody>
					{#each worked.steps as s, i}
						{@const after = i + 1 < worked.steps.length ? worked.steps[i + 1] : worked}
						<tr>
							<td class="mono">{i + 1}</td>
							<td class="mono">{s.lo} to {s.hi} ({sizeOf(s.lo, s.hi)})</td>
							<td>Greater than {s.threshold}?</td>
							<td class="mono strong">{yn(s.answer)}</td>
							<td class="mono"
								>{after.lo}{after.lo === after.hi ? '' : ` to ${after.hi} (${sizeOf(after.lo, after.hi)})`}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Some numbers take one question fewer: the halves of an odd count are not equal, and a number in the smaller half
			can finish early. None takes more. <a
				href="/guess-my-number?a={answersToText(worked.steps.map((s) => s.answer))}"
				on:click|preventDefault={() => demoFind('100', 42)}>Replay this game</a
			>.
		</p>
	</section>

	<section id="bits">
		<h2>The answers are the binary digits</h2>
		<p>
			With 0 to 127 the halving lines up exactly with binary. The first question, greater than 63, asks whether the 64s
			bit is 1. Whichever half is left, the next question asks about the 32s bit, then the 16s, down to the 1s. Write
			yes as 1 and no as 0 and the seven answers are the number in binary. That is why a yes/no answer is said to carry
			one bit of information: exactly one when yes and no are equally likely, as here, and less when the split is
			uneven.
		</p>
		<div class="table-wrap">
			<table class="data-table bits">
				<caption>Finding 42 in 0 to 127</caption>
				<thead>
					<tr>
						<th scope="col">Bit</th>
						<th scope="col">Question</th>
						<th scope="col">Answer</th>
						<th scope="col">Digit</th>
					</tr>
				</thead>
				<tbody>
					{#each workedBits.steps as s}
						<tr>
							<td class="mono">{2 ** (s.bit ?? 0)}s</td>
							<td>Greater than {s.threshold}?</td>
							<td class="mono">{yn(s.answer)}</td>
							<td class="mono strong">{s.answer ? 1 : 0}</td>
						</tr>
					{/each}
					<tr class="total">
						<th scope="row" colspan="3">Read down the digits</th>
						<td class="mono strong digits"
							>{workedBits.steps.map((s) => (s.answer ? 1 : 0)).join('')} = {workedBits.lo}</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The <a href="/binary-converter">binary converter</a> shows the same place values for any number. Ranges that are
			not a power of two, like 1 to 100, still need whole bits: 100 numbers carry log₂ 100 ≈ {f100.bits} bits of information,
			and a question cannot ask for part of one.
		</p>
	</section>

	<section id="liar">
		<h2>Liar mode: catching one lie with a Hamming code</h2>
		<p>
			Stanisław Ulam posed this game in his autobiography, <em>Adventures of a Mathematician</em> (1976): how many
			yes/no questions find a number if the answerer may lie? Plain halving is hopeless, because one wrong answer sends
			the search into the wrong half and it never comes back. Asking every bit question three times and taking the
			majority works, but costs {tripled} questions for 0 to 127.
		</p>
		<p>
			Liar mode needs only {LIAR_QUESTIONS}, by borrowing an error-correcting code. The questions are numbered 1 to {LIAR_QUESTIONS}.
			Questions {dataQuestions.map((q) => q.position).join(', ')} ask for the seven bits of your number, 64s to 1s. Questions
			{CHECK_POSITIONS.join(', ')} are checks: check c asks whether an odd number of the bit questions whose own number contains
			c in binary would be answered yes, so that across its whole group the honest yes answers always come to an even count.
		</p>
		<div class="table-wrap">
			<table class="data-table liar-table">
				<caption>The eleven questions</caption>
				<thead>
					<tr>
						<th scope="col">Question</th>
						<th scope="col">In binary</th>
						<th scope="col">What it really asks</th>
					</tr>
				</thead>
				<tbody>
					{#each LIAR_TABLE as q}
						<tr>
							<td class="mono strong">{q.position}</td>
							<td class="mono">{q.position.toString(2).padStart(4, '0')}</td>
							<td
								>{#if q.role === 'data'}Is the {q.value}s bit 1?{:else}Check {q.position}: is an odd number of questions {q.covers.join(
										', '
									)} yes?{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			A lie on question p flips one answer, so it makes the yes count odd in exactly the groups that contain p, and
			those are the checks whose numbers add up to p in binary. Add up the broken checks and you have the number of the
			lie. If nothing is broken, nobody lied. This sum is called the syndrome.
		</p>
		<div class="card worked">
			<h3>42, with a lie on question 6</h3>
			<div class="table-wrap">
				<table class="data-table liar-answers">
					<caption>The lie, on question {LIAR_EXAMPLE_LIE}, is in bold.</caption>
					<thead>
						<tr>
							<th scope="row"><span class="wide">Question</span><span class="narrow">Q</span></th>
							{#each liarExampleTruth as _, i}
								<th scope="col" class:lie={i + 1 === LIAR_EXAMPLE_LIE}>{i + 1}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						<tr>
							<th scope="row">Honest</th>
							{#each liarExampleTruth as b, i}
								<td class="mono" class:lie={i + 1 === LIAR_EXAMPLE_LIE}>{b ? 'Y' : 'N'}</td>
							{/each}
						</tr>
						<tr>
							<th scope="row">Given</th>
							{#each liarExampleSaid as b, i}
								<td class="mono" class:lie={i + 1 === LIAR_EXAMPLE_LIE}
									>{b ? 'Y' : 'N'}{#if i + 1 === LIAR_EXAMPLE_LIE}<span class="wide">{' '}(lie)</span>{/if}</td
								>
							{/each}
						</tr>
					</tbody>
				</table>
			</div>
			<ul class="small checks-list">
				{#each liarExample.checks as c}
					<li>
						Check {c.check} (questions {c.positions.join(', ')}): {c.yes} yes, {c.odd ? 'odd, broken' : 'even'}
					</li>
				{/each}
			</ul>
			<p class="small">
				Broken checks {liarExample.checks
					.filter((c) => c.odd)
					.map((c) => c.check)
					.join(' + ')} = <strong>{liarExample.syndrome}</strong>, so question {liarExample.syndrome} was the lie. Flip it
				back, read the bit questions, and the number is
				<strong>{liarExample.verdict.kind === 'lie' ? liarExample.verdict.number : ''}</strong>.
				<a
					href="/guess-my-number?mode=liar&amp;a={answersToText(liarExampleSaid)}"
					on:click|preventDefault={() => demoLiar(42, [LIAR_EXAMPLE_LIE])}>Replay it</a
				>
			</p>
		</div>
		<p>
			This is a shortened Hamming(15, 11) code: the full code has 11 data bits and checks 1, 2, 4 and 8 over 15
			positions; keeping positions 1 to 11 leaves 7 data bits, exactly 0 to 127. Any two numbers differ in at least
			three of the eleven answers, so one lie leaves the honest number closer than any other. Two lies can be mistaken
			for one lie somewhere else, and then the answer comes out wrong; if the syndrome is 12 to 15, a position that does
			not exist, the page can at least tell you so. Lies on questions {TWO_LIES.join(' and ')} do that: they break checks
			{TWO_LIES.join(' and ')}, which add up to {twoLiesSyndrome}.
		</p>
		<p>
			{LIAR_QUESTIONS} is the least possible. Each number has {liarMin + 1} answer patterns that must lead to it (the honest
			one, and one with each answer flipped), and no two numbers can share a pattern, so 128 × (q + 1) ≤ 2<sup>q</sup>.
			That fails at q = {volumeShort.q} ({fmt(volumeShort.need)} against {fmt(volumeShort.have)}) and holds at {volumeEnough.q}
			({fmt(volumeEnough.need)} against {fmt(volumeEnough.have)}), even if each question could depend on the answers
			before it.
		</p>
	</section>

	<section id="evil">
		<h2>The evil version: an opponent that never commits</h2>
		<p>
			In "you guess mine" the evil page does not pick a number. It keeps the range of numbers that fit every hint so
			far, and on each guess says whichever of higher or lower leaves more of them. It never lies, since every reply is
			true for every number still in play, but it makes each guess as useless as it can be.
		</p>
		<p>
			Against that, the best a player can do is halve, and halving still rules out only about half each time, and never
			gets lucky. From n numbers that takes ⌊log₂ n⌋ + 1 guesses. When n is a power of two that is one more than the
			yes/no game, because the last number has to be said out loud: {f128.questions} questions but {f128.guesses} guesses
			for 0 to 127. Otherwise the two counts are equal, both {f100.guesses} for 1 to 100, because a guess has three outcomes
			and can carry more than one bit. Here is a halving player against it on 1 to 100:
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr><th scope="col">Guess</th><th scope="col">Reply</th><th scope="col">Still possible</th></tr>
				</thead>
				<tbody>
					{#each evilGame as m}
						<tr>
							<td class="mono strong">{m.guess}</td>
							<td>{replyText[m.reply]}</td>
							<td class="mono">{m.reply === 'correct' ? m.guess : m.lo === m.hi ? m.lo : `${m.lo} to ${m.hi}`}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			This is an adversary argument, the standard way to prove a lower bound: if a clever opponent can always keep two
			numbers alive for this long, no strategy can be sure to finish sooner.
		</p>
	</section>

	<section id="reference">
		<h2>Questions needed for each range</h2>
		<div class="table-wrap">
			<table class="data-table facts">
				<thead>
					<tr>
						<th scope="col">Range</th>
						<th scope="col" class="num">Numbers</th>
						<th scope="col" class="num">Bits<span class="wide">{' '}(log₂ n)</span></th>
						<th scope="col" class="num">Yes/no<span class="wide">{' '}questions</span></th>
						<th scope="col" class="num"
							><span class="wide">Higher/lower guesses</span><span class="narrow">Guesses</span></th
						>
						<th scope="col" class="num"
							><span class="wide">Questions with one lie</span><span class="narrow">One lie</span></th
						>
					</tr>
				</thead>
				<tbody>
					{#each facts as f}
						<tr>
							<td>{f.range.label}</td>
							<td class="mono num">{fmt(f.size)}</td>
							<td class="mono num">{f.bits}</td>
							<td class="mono num strong">{f.questions}</td>
							<td class="mono num">{f.guesses}</td>
							<td class="mono num">{f.withOneLie}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Yes/no questions: ⌈log₂ n⌉. Higher/lower guesses, counting the winning one: ⌊log₂ n⌋ + 1. With one lie: the
			smallest q with n × (q + 1) ≤ 2<sup>q</sup>, a lower bound that Hamming codes reach for 0 to 127.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Greater than, or greater than or equal?</strong> Mixing the two halfway through moves the boundary by one
				and can lose the number. Pick one wording and keep it; this page always asks "greater than".
			</li>
			<li>
				<strong>Guessing the middle of the original range.</strong> The middle must be of what is still possible. After "higher
				than 50" from 1 to 100, what is left is 51 to 100, so the next guess is 75, not 25 or 51.
			</li>
			<li>
				<strong>Counting 100 as needing 6.64 questions.</strong> log₂ 100 ≈ {f100.bits}, but questions come in whole
				numbers, so it is {f100.questions}.
			</li>
			<li>
				<strong>Expecting the same count for questions and guesses.</strong> For 0 to 127 it is {f128.questions} yes/no questions
				but {f128.guesses} higher/lower guesses, as explained above.
			</li>
			<li>
				<strong>Asking each question twice to beat a liar.</strong> Two answers that disagree show a lie happened, but not
				which one was true. It takes three copies, or a code like the one in liar mode, to correct it.
			</li>
		</ul>
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

	.tool:focus,
	.question:focus {
		outline: none;
	}

	/* Clears the sticky site nav when a chip or replay link scrolls the game into view. */
	#game {
		scroll-margin-top: 56px;
	}

	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.9rem;
	}

	.modes button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
		padding: 0.45rem 0.9rem;
		cursor: pointer;
	}

	.modes button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.range-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.9rem;
		margin-bottom: 0.6rem;
	}

	.range-row select {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 0.9rem;
		padding: 0.3rem 0.4rem;
	}

	.evil {
		color: #ddd;
		font-size: 0.88rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.evil input {
		width: 1.05rem;
		height: 1.05rem;
		accent-color: #5db65d;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.field.inline {
		margin: 0;
	}

	.setup {
		color: #bbb;
		font-size: 0.92rem;
		margin: 0 0 0.9rem;
		max-width: 680px;
	}

	.question {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.7rem 0.9rem;
		min-height: 5.4rem;
		box-sizing: border-box;
	}

	.q-count {
		color: #999;
		display: block;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.q-text {
		color: #fff;
		display: block;
		font-size: 1.35rem;
		line-height: 1.3;
		margin-top: 0.15rem;
	}

	.q-text strong {
		color: #8ede8e;
	}

	.q-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.3rem;
	}

	.yes-no {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin: 0.8rem 0;
	}

	.big {
		border-radius: 3px;
		color: #fff;
		cursor: pointer;
		font-size: 1.1rem;
		font-weight: 600;
		min-height: 3rem;
		padding: 0.6rem 1rem;
	}

	.big.yes {
		background-color: #372;
		border: 1px solid #5db65d;
	}

	.big.yes:hover:not(:disabled) {
		background-color: #483;
	}

	.big.no {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.5);
	}

	.big.no:hover {
		border-color: #fff;
	}

	.big:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.big kbd {
		font-size: 0.7rem;
		margin-left: 0.4rem;
		vertical-align: 0.15em;
	}

	.small-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.82rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
	}

	.small-btn:hover:not(:disabled) {
		border-color: #5db65d;
		color: #fff;
	}

	.small-btn:disabled {
		color: #999;
		border-color: rgba(255, 255, 255, 0.25);
		cursor: default;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 0.6rem 0 0.2rem;
	}

	.progress {
		color: #ddd;
		font-size: 0.85rem;
		margin-right: auto;
		letter-spacing: 0.04em;
	}

	.bar-wrap {
		margin-top: 0.9rem;
	}

	.bar {
		position: relative;
		height: 12px;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-in {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 3px;
		background: #5db65d;
		transition: left 0.25s ease, width 0.25s ease;
	}

	.bar-ends {
		display: flex;
		justify-content: space-between;
		color: #999;
		font: 0.72rem ui-monospace, SFMono-Regular, Menlo, monospace;
		margin-top: 2px;
	}

	.left-text {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.3rem 0 0;
	}

	.value-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.value-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.value-input[aria-invalid='true'] {
		border-color: #f66;
	}

	.slip {
		margin: 0.8rem 0 0;
		max-width: 520px;
	}

	.slip-text {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.8rem;
	}

	.guess-form {
		max-width: 520px;
	}

	.guess-row {
		display: flex;
		gap: 8px;
	}

	.guess-row .value-input {
		flex: 1;
		min-width: 0;
	}

	.guess-row .big {
		flex: none;
		min-width: 6.5rem;
	}

	.hint {
		color: #ddd;
		font-size: 0.88rem;
		margin: 0.4rem 0 0;
	}

	.history {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.8rem 0 0;
		padding-left: 1.4rem;
	}

	.history li {
		margin-right: 0.6rem;
	}

	/* 16 columns on a wide screen, so the rows are 0 to 15, 16 to 31 and so on;
	   8 on a phone. Members are boxed and bold as well as tinted. */
	.num-grid {
		display: grid;
		grid-template-columns: repeat(16, minmax(0, 1fr));
		gap: 3px;
		margin: 0.8rem 0 0;
		font: 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
		font-variant-numeric: tabular-nums;
	}

	.num-grid span {
		border: 1px solid transparent;
		border-radius: 2px;
		color: #8f8f8f;
		padding: 0.18rem 0;
		text-align: center;
	}

	.num-grid span.in {
		background: #24502a;
		border-color: #8ede8e;
		color: #fff;
		font-weight: 700;
	}

	.result-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 1rem;
		padding-top: 0.8rem;
	}

	.result-text {
		color: #fff;
		font-size: 0.95rem;
	}

	.copied {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 1rem 0 0;
	}

	.chips-label {
		color: #bbb;
		font-size: 0.8rem;
		margin-right: 0.2rem;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font: 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.3rem !important;
	}

	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}

	.data-table caption {
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding-bottom: 0.4rem;
	}

	.trail td,
	.bits td,
	.checks td,
	.answers td {
		white-space: nowrap;
	}

	.narrow {
		display: none;
	}

	.liar-answers th,
	.liar-answers td {
		text-align: center;
		white-space: nowrap;
		padding-left: 0.45rem;
		padding-right: 0.45rem;
	}

	.liar-answers .lie {
		color: #fff;
		font-weight: 700;
		background: rgba(255, 102, 102, 0.12);
	}

	/* The question column wraps, so the range and bits columns stay in view on a phone. */
	.trail td:nth-child(2) {
		white-space: normal;
		min-width: 9rem;
	}

	.num {
		text-align: right !important;
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.data-table tr.slipped td {
		background: rgba(255, 102, 102, 0.12);
		color: #fff;
	}

	.data-table tr.total th,
	.data-table tr.total td {
		border-top: 2px solid rgba(255, 255, 255, 0.4);
		color: #fff;
	}

	.worked {
		padding: 0.9rem 1rem;
		margin: 1rem 0;
	}

	.worked h3 {
		color: #fff;
	}

	.small {
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
		overflow-wrap: anywhere;
	}

	.worked strong {
		color: #8ede8e;
	}

	.checks-list {
		color: #ddd;
		padding-left: 1.2rem;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.6rem;
	}

	.points strong {
		color: #fff;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 560px) {
		/* Shorter cell text on a phone, so every column of the game tables fits. */
		.wide {
			display: none;
		}

		.narrow {
			display: inline;
		}

		.trail td:nth-child(2) {
			min-width: 0;
			white-space: nowrap;
		}

		.liar-answers :is(th, td) {
			padding-left: 0.3rem !important;
			padding-right: 0.3rem !important;
		}

		.bits td.digits {
			white-space: normal;
		}

		.trail :is(th, td),
		.bits :is(th, td),
		.facts :is(th, td),
		.checks :is(th, td),
		.answers :is(th, td) {
			padding-left: 0.4rem !important;
			padding-right: 0.4rem !important;
		}

		.num-grid {
			grid-template-columns: repeat(8, minmax(0, 1fr));
			font-size: 0.85rem;
		}

		.q-text {
			font-size: 1.2rem;
		}

		.tool {
			padding: 0.9rem 0.8rem 1.1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar-in {
			transition: none;
		}
	}
</style>
