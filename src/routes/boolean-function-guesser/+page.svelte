<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { readUrl, syncUrl, safeInt } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';
	import {
		GUESSER_SIZES,
		WRONG_PENALTY,
		dayNumber,
		optionsFor,
		puzzleFor,
		scoreOf,
		shareText,
		type GuesserSize,
		type Option,
		type Puzzle
	} from '$lib/guesser';

	// The size and the seed live in the query string. With no seed the box is
	// today's, the same for everyone, worked out in the browser from the date.
	const DEFAULTS = { n: '3', seed: '' };
	let size: GuesserSize = 3;
	let seed: number | null = null;
	let today = 0;
	let ready = false;

	// The player's whole game: the switches as a row number (a is the top bit),
	// how many flips it took, which rows the lamp has been seen at, and which
	// options were ruled out by a wrong pick.
	let input = 0;
	let flips = 0;
	let seen: number[] = [0];
	let wrong: number[] = [];
	let solved = false;
	let copied = false;

	$: puzzle = ready ? puzzleFor(seed ?? today, size) : (null as Puzzle | null);
	$: options = puzzle ? optionsFor(puzzle, seed ?? today) : ([] as Option[]);
	$: label = seed === null ? `#${today}` : `seed ${seed}`;
	$: syncUrl({ n: size, seed: seed ?? '' }, DEFAULTS);
	$: lit = puzzle ? puzzle.rows[input] : false;
	$: score = scoreOf(flips, wrong.length);
	$: rowCount = 1 << size;

	// Worked out from the variables directly, not from a reactive value: those
	// only update after the next flush, and load() runs straight after they change.
	const key = () => `logicgates-mystery-box:${seed ?? today}:${size}`;

	function load() {
		input = 0;
		flips = 0;
		seen = [0];
		wrong = [];
		solved = false;
		try {
			const raw = localStorage.getItem(key());
			if (raw) {
				const saved = JSON.parse(raw);
				input = saved.input ?? 0;
				flips = saved.flips ?? 0;
				seen = saved.seen ?? [0];
				wrong = saved.wrong ?? [];
				solved = !!saved.solved;
			}
		} catch {
			// Private windows can refuse storage; the game just forgets on reload.
		}
	}

	function save() {
		try {
			localStorage.setItem(key(), JSON.stringify({ input, flips, seen, wrong, solved }));
		} catch {
			// Progress is a convenience, not a requirement.
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
		copied = false;
		load();
	}

	const randomBox = () => start(size, Math.floor(Math.random() * 1000000));

	// Passing input and size in, rather than reading them inside, is what lets Svelte
	// see the template depends on them and redraw when they change.
	const isOn = (bit: number, row: number, width: number) => !!(row & (1 << (width - 1 - bit)));

	function flip(bit: number) {
		if (solved) return;
		input ^= 1 << (size - 1 - bit);
		flips += 1;
		if (!seen.includes(input)) seen = [...seen, input];
		save();
	}

	function choose(index: number) {
		if (solved || wrong.includes(index)) return;
		if (options[index].correct) solved = true;
		else wrong = [...wrong, index];
		save();
	}

	async function copyResult() {
		try {
			await navigator.clipboard.writeText(shareText({ label, size, flips, wrongPicks: wrong.length }));
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			// The score is on screen; there is nothing else to fall back on.
		}
	}

	const bitsOf = (row: number, width: number) => Array.from({ length: width }, (_, bit) => (row >> (width - 1 - bit)) & 1);

	const faqs = [
		{
			q: 'How does the mystery box work?',
			a: 'The box hides a boolean function of two, three or four switches, and the lamp shows its output. You flip the switches as often as you like and watch the lamp, then pick which of four expressions the box computes. Your score is the number of flips plus three for every wrong pick, and lower is better.'
		},
		{
			q: 'Is there a new box every day?',
			a: 'Yes. With no seed in the link, the box comes from the date, so everyone gets the same function on the same day. There is nothing to sign in to and no server involved: the day number is the seed. The Random button picks any other seed, and a link with a seed always reopens that exact box.'
		},
		{
			q: 'Why are the answers written as sums of products?',
			a: 'So that the way an option is written cannot give the answer away. Every option is the minimal sum of products for its truth table, the same form the boolean algebra calculator produces. The wrong options are the real function with one or two rows changed, so you have to test the rows where they differ.'
		},
		{
			q: 'How do I keep my flips low?',
			a: 'Do not test rows in order. Look at the four options first, find a row where two of them disagree, flip the switches to reach it, and read the lamp: that one look rules out at least one option. Flipping one switch at a time also keeps each step cheap.'
		}
	];

	const page = {
		title: 'Mystery Box: A Boolean Logic Puzzle Game',
		description:
			'Flip the switches on a mystery box, watch the lamp, and work out which boolean expression it computes in as few flips as you can. A new box daily.',
		url: `${SITE}/boolean-function-guesser`,
		image: `${SITE}/og/boolean-function-guesser.png`,
		imageAlt: 'LogicGates.org: mystery box'
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
					{ '@type': 'ListItem', position: 3, name: 'Mystery box' }
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
		<h1>Mystery box</h1>
		<p class="lede">
			A sealed box has a few switches and one lamp, and it hides a boolean function. <strong>Flip the switches</strong>
			and watch the lamp, then <strong>pick the expression</strong> the box computes. Every flip costs one point and
			every wrong pick costs {WRONG_PENALTY}, so the aim is to find out as much as possible in as few flips as you can.
		</p>

		<div class="card tool">
			<div class="fields">
				<div class="field-group">
					<span class="field" id="size-label">Number of switches</span>
					<div class="seg" role="group" aria-labelledby="size-label">
						{#each GUESSER_SIZES as n}
							<button type="button" class:on={size === n} aria-pressed={size === n} on:click={() => start(n, seed)}>
								{n}
							</button>
						{/each}
					</div>
				</div>
				<div class="field-group">
					<span class="field">Box</span>
					<div class="seg">
						<button type="button" class:on={seed === null} aria-pressed={seed === null} on:click={() => start(size, null)}>
							Today
						</button>
						<button type="button" on:click={randomBox}>Random</button>
					</div>
				</div>
			</div>
			<p class="share-row"><ShareLink what="this box" /></p>

			{#if !puzzle}
				<p class="field-help">Loading the box…</p>
			{:else}
				<div class="board">
					<div class="box" aria-label="The mystery box">
						<div class="switches" role="group" aria-label="Switches">
							{#each puzzle.variables as name, bit}
								<button
									type="button"
									class="switch"
									class:on={isOn(bit, input, size)}
									aria-pressed={isOn(bit, input, size)}
									disabled={solved}
									on:click={() => flip(bit)}
								>
									<span class="mono name">{name}</span>
									<span class="knob" aria-hidden="true"></span>
									<span class="mono state">{isOn(bit, input, size) ? 1 : 0}</span>
								</button>
							{/each}
						</div>
						<div class="lamp-wrap" role="status">
							<div class="lamp" class:lit aria-hidden="true"></div>
							<span class="lamp-text">Lamp {lit ? 'on' : 'off'}</span>
						</div>
					</div>

					<div class="notes">
						<h2 class="sub">Your notes</h2>
						<div class="table-wrap">
							<table class="data-table grid" aria-label="Settings you have tried and what the lamp did">
								<thead>
									<tr>
										{#each puzzle.variables as v}
											<th scope="col" class="mono">{v}</th>
										{/each}
										<th scope="col" class="mono">lamp</th>
									</tr>
								</thead>
								<tbody>
									{#each Array(rowCount) as _, row}
										{@const known = seen.includes(row) || solved}
										<tr class:here={row === input && !solved}>
											{#each bitsOf(row, size) as bit}
												<td class="mono">{bit}</td>
											{/each}
											<td class="mono" class:on={known && puzzle.rows[row]} class:late={known && !seen.includes(row)}>
												{known ? (puzzle.rows[row] ? 1 : 0) : '·'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="field-help">The box fills this in for you as you go.</p>
					</div>
				</div>

				<div class="pick">
					<h2 class="sub">What does the box compute?</h2>
					<div class="options" role="group" aria-label="Choose an expression">
						{#each options as option, i}
							{@const out = wrong.includes(i)}
							<button
								type="button"
								class="option mono"
								class:out
								class:right={solved && option.correct}
								disabled={solved || out}
								on:click={() => choose(i)}
							>
								{option.text}
							</button>
						{/each}
					</div>

					<p class="scoreline" role="status">
						{flips} {flips === 1 ? 'flip' : 'flips'}{#if wrong.length}, {wrong.length} wrong
							{wrong.length === 1 ? 'pick' : 'picks'}{/if}: score <strong>{score}</strong>
					</p>
					{#if solved}
						<div class="result" role="status">
							<p class="win">Solved with a score of {score}.</p>
							<p class="actions">
								<button type="button" class="cta" on:click={copyResult}>{copied ? 'Copied' : 'Copy result'}</button>
								<button type="button" class="link-btn" on:click={randomBox}>Play a random box</button>
								<a href={`/truth-table-generator?expr=${encodeURIComponent(options.find((o) => o.correct)?.text ?? '')}`}
									>Open the answer as a truth table</a
								>
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2>How to play well</h2>
		<p class="section-intro">
			The four choices are the clues. Read them before you touch a switch, because the best flip is the one that
			separates two of them.
		</p>
		<ul>
			<li>
				<strong>Hunt for a row where the options disagree.</strong> Work out what each expression gives for a setting,
				find one where they differ, and go there: whatever the lamp does, at least one option is gone.
			</li>
			<li>
				<strong>Flip one switch at a time.</strong> Moving to a neighbouring setting costs one point, and a jump across
				three switches costs three. The notes grid shows which settings you have already seen.
			</li>
			<li>
				<strong>Spot the shape.</strong> If the lamp changes whenever any single switch changes, the box is an
				<a href="/logic-gates/xor">XOR</a> of the switches. A lamp that lights for only one setting is an AND, and one
				that goes out for only one setting is an OR.
			</li>
			<li>
				<strong>Check yourself afterwards.</strong> The <a href="/truth-table-generator">truth table generator</a> shows
				what an expression really does, and the <a href="/karnaugh-map-solver">Karnaugh map solver</a> turns a table back
				into the shortest expression.
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
	.switch:focus-visible,
	.option:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: 2px;
	}
	.share-row {
		margin: 0.8rem 0 0;
	}
	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
	}
	.board {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 14rem);
		gap: 1.5rem;
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}
	.sub {
		font-size: 1rem;
		margin: 0 0 0.6rem;
	}
	.box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.4rem;
		padding: 1.2rem 0.8rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
	}
	.switches {
		display: flex;
		gap: 0.9rem;
		flex-wrap: wrap;
		justify-content: center;
	}
	.switch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: 0;
		color: #fff;
		cursor: pointer;
		font: inherit;
		padding: 0.3rem 0.5rem;
	}
	.switch:disabled {
		cursor: default;
		opacity: 0.7;
	}
	.knob {
		position: relative;
		width: 2.2rem;
		height: 4rem;
		border-radius: 1.1rem;
		background: #0d0d0f;
		border: 2px solid rgba(255, 255, 255, 0.5);
	}
	.knob::after {
		content: '';
		position: absolute;
		left: 0.25rem;
		right: 0.25rem;
		bottom: 0.25rem;
		height: 1.5rem;
		border-radius: 0.8rem;
		background: #666;
		transition: bottom 0.12s ease, background 0.12s ease;
	}
	.switch.on .knob {
		border-color: #5db65d;
	}
	.switch.on .knob::after {
		bottom: 2rem;
		background: #7be27b;
	}
	.name {
		font-size: 1.1rem;
	}
	.state {
		color: #aaa;
		font-size: 0.85rem;
	}
	.lamp-wrap {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.lamp {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: #2a2a2a;
		border: 2px solid rgba(255, 255, 255, 0.4);
		transition: background 0.12s ease, box-shadow 0.12s ease;
	}
	.lamp.lit {
		background: #ffe36b;
		border-color: #ffe36b;
		box-shadow: 0 0 22px 6px rgba(255, 227, 107, 0.55);
	}
	.lamp-text {
		font-size: 0.95rem;
	}
	.grid td,
	.grid th {
		text-align: center;
	}
	.grid tr.here td {
		background: rgba(93, 182, 93, 0.18);
	}
	.grid td.on {
		color: #7be27b;
		font-weight: 700;
	}
	.grid td.late {
		opacity: 0.55;
	}
	.pick {
		margin-top: 1.3rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.6rem;
	}
	.option {
		background: #0d0d0f;
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		padding: 0.7rem 0.8rem;
		text-align: left;
		font-size: 0.95rem;
		cursor: pointer;
		overflow-wrap: anywhere;
	}
	.option:hover:not(:disabled) {
		border-color: #5db65d;
	}
	.option.out {
		text-decoration: line-through;
		color: #f99;
		border-color: #b55;
		opacity: 0.7;
		cursor: default;
	}
	.option.right {
		border-color: #5db65d;
		background: rgba(93, 182, 93, 0.2);
	}
	.scoreline {
		margin: 0.9rem 0 0;
		color: #ddd;
	}
	.result {
		margin-top: 0.6rem;
	}
	.win {
		color: #7be27b;
		margin: 0;
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
