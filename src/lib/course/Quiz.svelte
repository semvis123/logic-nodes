<script lang="ts">
	// The quiz at the end of a lesson. Five right in a row passes the lesson;
	// a wrong answer gives a hint and the same question again, a second wrong
	// answer a stronger hint, and a third shows the answer with the working.
	// Questions are generated from a seed, so there is always another one, and
	// ?q=<seed> in the address reopens a particular first question.
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { rng } from './random';
	import { progress, recordAnswer, markDone } from './progress';
	import { PASS_STREAK, type CourseQuestion, type LessonMeta } from './types';

	export let lesson: LessonMeta;

	function make(seed: number): CourseQuestion {
		const generator = lesson.generators[seed % lesson.generators.length];
		return generator(rng(seed));
	}

	// A fixed seed for the server render, so the markup matches on hydration;
	// onMount swaps in the seed from the address, or a random one.
	let seed = 1;
	let question = make(seed);
	let chosen: number | null = null;
	let wrongPicks: number[] = [];
	let wrong = 0;
	let streak = 0;
	let answered = 0;
	let correct = 0;
	/** The last few prompts, so the same question does not come straight back. */
	let recent: string[] = [];
	let feedback: HTMLElement | null = null;

	$: state = $progress[lesson.slug];
	$: passed = state?.done === 'passed';
	$: marked = state?.done === 'marked';
	$: isRight = chosen !== null && chosen === question.answer;
	/** Shown once the answer is settled, right or given away. */
	$: settled = isRight || wrong >= 3;

	onMount(() => {
		const fromUrl = Number($page.url.searchParams.get('q'));
		load(Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : randomSeed());
	});

	const randomSeed = () => Math.floor(Math.random() * 1_000_000) + 1;

	function load(next: number) {
		seed = next;
		question = make(seed);
		chosen = null;
		wrongPicks = [];
		wrong = 0;
	}

	function advance() {
		let next = randomSeed();
		// A narrow lesson can only pose so many different questions; try a few
		// seeds for a fresh one and settle for a repeat rather than stall.
		for (let attempt = 0; attempt < 30 && recent.includes(make(next).prompt); attempt++) next = randomSeed();
		recent = [...recent, question.prompt].slice(-6);
		load(next);
	}

	async function choose(index: number) {
		if (settled || wrongPicks.includes(index)) return;
		chosen = index;
		answered += 1;
		if (index === question.answer) {
			correct += 1;
			streak += 1;
			recordAnswer(lesson.slug, true, streak);
			if (streak >= PASS_STREAK && !passed) markDone(lesson.slug, 'passed');
		} else {
			wrongPicks = [...wrongPicks, index];
			wrong += 1;
			streak = 0;
			recordAnswer(lesson.slug, false, 0);
		}
		await tick();
		feedback?.focus();
	}

	function knowIt() {
		markDone(lesson.slug, 'marked');
	}
</script>

<section class="quiz" id="quiz" aria-labelledby="quiz-heading">
	<h2 id="quiz-heading">Check yourself</h2>
	{#if passed}
		<p class="passed-line" role="status">
			<span class="tick" aria-hidden="true">✓</span> You passed this lesson. Keep going for practice, or move on.
		</p>
	{:else if marked}
		<p class="passed-line" role="status">
			<span class="tick hollow" aria-hidden="true">✓</span> Marked as known. Pass the quiz to earn the full tick.
		</p>
	{:else}
		<p class="section-intro">
			Get {PASS_STREAK} right in a row and the lesson is done. A wrong answer costs the run, not the lesson.
		</p>
	{/if}

	<div class="card quiz-card" data-seed={seed}>
		<div class="score" aria-label="Progress">
			<span class="dots" aria-hidden="true">
				{#each Array(PASS_STREAK) as _, i}<span class="dot" class:lit={i < streak} />{/each}
			</span>
			<span class="visually-hidden">{streak} right in a row.</span>
			<span><strong>{correct}</strong> / {answered} this visit</span>
			{#if state?.best}<span class="dim">best run {state.best}</span>{/if}
		</div>

		<p class="prompt">{question.prompt}</p>
		{#if question.detail}
			<p class="detail mono">{question.detail}</p>
		{/if}
		{#if question.svg}
			<figure class="diagram">
				{@html question.svg}
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
							<th scope="col" class="mono">{question.tableOutputLabel ?? 'out'}</th>
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
					class:correct={settled && i === question.answer}
					class:wrong={wrongPicks.includes(i)}
					class:muted={settled && i !== question.answer && !wrongPicks.includes(i)}
					disabled={settled || wrongPicks.includes(i)}
					on:click={() => choose(i)}
				>
					<span class="letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
					<span class="text">{option}</span>
				</button>
			{/each}
		</div>

		{#if chosen !== null}
			<div
				class="feedback"
				class:right={isRight}
				class:hint={!settled}
				role="status"
				tabindex="-1"
				bind:this={feedback}
			>
				{#if isRight}
					<strong>Correct.</strong> {question.explanation}
				{:else if wrong === 1}
					<strong>Not quite.</strong> Hint: {question.hints[0]} Try again.
				{:else if wrong === 2}
					<strong>Still not it.</strong> Bigger hint: {question.hints[1]} One more go.
				{:else}
					<strong>The answer is {String.fromCharCode(65 + question.answer)}.</strong>
					{question.explanation}
				{/if}
			</div>
		{/if}

		{#if settled}
			<button type="button" class="cta next" on:click={advance}>
				{passed ? 'Another question' : 'Next question'}
			</button>
		{/if}
	</div>

	{#if !passed && !marked}
		<p class="know-it">
			Already know this? <button type="button" class="link-btn" on:click={knowIt}>Mark the lesson as known</button>
			and come back to the quiz any time.
		</p>
	{/if}
</section>

<style>
	.quiz {
		margin-top: 2.5rem;
	}

	.passed-line {
		color: #ddd;
	}

	.tick {
		display: inline-block;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 50%;
		background-color: #5db65d;
		color: #000;
		font-size: 0.8rem;
		line-height: 1.2rem;
		text-align: center;
		margin-right: 0.2rem;
	}

	.tick.hollow {
		background: none;
		border: 1px solid #5db65d;
		color: #5db65d;
	}

	.quiz-card {
		padding: 1rem 1.1rem 1.1rem;
	}

	.score {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		color: #bbb;
		font-size: 0.85rem;
		margin-bottom: 0.8rem;
	}

	.dots {
		display: inline-flex;
		gap: 5px;
	}

	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		border: 1px solid #666;
	}

	.dot.lit {
		background-color: #5db65d;
		border-color: #5db65d;
	}

	.dim {
		color: #888;
	}

	.prompt {
		font-size: 1.05rem;
		color: #fff;
		margin: 0 0 0.6rem;
	}

	.detail {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.5rem 0.8rem;
		display: inline-block;
		margin: 0 0 0.8rem;
	}

	.diagram {
		margin: 0 0 0.8rem;
		max-width: 520px;
	}

	.diagram :global(svg) {
		width: 100%;
		height: auto;
	}

	.q-table {
		margin-bottom: 0.8rem;
	}

	.options {
		display: grid;
		gap: 6px;
		margin: 0.6rem 0;
	}

	.option {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		text-align: left;
		background-color: #1d1e20;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		color: #fff;
		font: inherit;
		padding: 0.55rem 0.8rem;
		cursor: pointer;
	}

	.option:hover:not(:disabled) {
		border-color: #5db65d;
	}

	.option:disabled {
		cursor: default;
	}

	.letter {
		flex: none;
		color: #5db65d;
		font: 600 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.text {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		white-space: pre-wrap;
	}

	.option.correct {
		border-color: #5db65d;
		background-color: rgba(93, 182, 93, 0.18);
	}

	.option.wrong {
		border-color: #f23;
		background-color: rgba(255, 34, 51, 0.15);
		opacity: 0.8;
	}

	.option.muted {
		opacity: 0.45;
	}

	.feedback {
		border-left: 3px solid #f23;
		padding: 0.5rem 0.9rem;
		margin: 0.8rem 0;
		color: #ddd;
		background-color: rgba(255, 255, 255, 0.03);
	}

	.feedback.hint {
		border-left-color: #e2b93b;
	}

	.feedback.right {
		border-left-color: #5db65d;
	}

	.feedback:focus {
		outline: none;
	}

	.know-it {
		color: #888;
		font-size: 0.85rem;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #aaa;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.link-btn:hover {
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

	@media print {
		.quiz {
			display: none;
		}
	}
</style>
