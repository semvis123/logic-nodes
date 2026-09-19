<script lang="ts">
	// The roadmap: every stage and lesson, with a tick on each one finished.
	// It is the same list on every lesson page, which is also what keeps every
	// lesson a click away from every other.
	import { stages, allLessons } from './lessons';
	import { progress, resetProgress } from './progress';

	export let current = '';

	$: done = allLessons.filter((l) => $progress[l.slug]?.done).length;
	$: total = allLessons.length;

	function reset() {
		if (confirm('Clear your progress on every lesson?')) resetProgress();
	}
</script>

<nav class="roadmap" aria-label="Course roadmap">
	<p class="summary">
		<a href="/learn" class="home">Learn digital logic</a>
		<span class="count"><strong>{done}</strong> of {total} lessons done</span>
	</p>
	<progress class="bar" max={total} value={done} aria-label="Lessons done" />
	{#each stages as stage, i}
		{@const finished = stage.lessons.filter((l) => $progress[l.slug]?.done).length}
		<!-- Only the stage being read is unfolded, so the whole course fits
		     beside a lesson without a second scrollbar; the others open on a
		     click, and all of them open for print. -->
		<details class="stage" open={stage.lessons.some((l) => l.slug === current)}>
			<summary>
				<span class="num">{i + 1}</span>
				<span class="stage-title">{stage.title}</span>
				<span class="stage-count" class:all={finished === stage.lessons.length}>{finished}/{stage.lessons.length}</span>
			</summary>
			<ol>
				{#each stage.lessons as lesson}
					{@const state = $progress[lesson.slug]?.done}
					<li
						class:current={lesson.slug === current}
						class:passed={state === 'passed'}
						class:marked={state === 'marked'}
					>
						<a href="/learn/{lesson.slug}" aria-current={lesson.slug === current ? 'page' : undefined}>
							<span class="tick" aria-hidden="true">{state ? '✓' : ''}</span>
							<span class="title">{lesson.title}</span>
							{#if state}<span class="visually-hidden">, {state === 'passed' ? 'passed' : 'marked done'}</span>{/if}
						</a>
					</li>
				{/each}
			</ol>
		</details>
	{/each}
	{#if done > 0}
		<p class="reset"><button type="button" class="link-btn" on:click={reset}>Reset progress</button></p>
	{/if}
</nav>

<style>
	.roadmap {
		font-size: 0.85rem;
	}

	.summary {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin: 0 0 0.4rem;
	}

	.home {
		font-weight: 600;
		color: #fff;
		text-decoration: none;
	}

	.home:hover {
		text-decoration: underline;
	}

	.count {
		color: #aaa;
	}

	.bar {
		width: 100%;
		height: 6px;
		margin-bottom: 0.8rem;
		accent-color: #5db65d;
	}

	.stage {
		margin: 0 0 0.15rem;
		padding: 0;
		max-width: none;
	}

	summary {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		list-style: none;
		cursor: pointer;
		padding: 0.35rem 0.4rem;
		border-radius: 3px;
		font-size: 0.85rem;
		font-weight: 600;
		color: #bbb;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		background-color: rgba(255, 255, 255, 0.06);
		color: #fff;
	}

	.stage[open] summary {
		color: #fff;
	}

	.num {
		color: #5db65d;
		font: 600 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.stage-title {
		flex: 1;
	}

	.stage-count {
		font: 500 0.7rem ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #999;
	}

	.stage-count.all {
		color: #5db65d;
	}

	ol {
		list-style: none;
		padding: 0 0 0.4rem 0.9rem;
		margin: 0;
	}

	li a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.4rem;
		border-radius: 3px;
		color: #ccc;
		text-decoration: none;
	}

	li a:hover {
		background-color: rgba(255, 255, 255, 0.06);
		color: #fff;
	}

	li.current a {
		background-color: rgba(93, 182, 93, 0.15);
		color: #fff;
	}

	.tick {
		flex: none;
		width: 0.9rem;
		height: 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 50%;
		font-size: 0.6rem;
		line-height: 0.85rem;
		text-align: center;
		color: #fff;
	}

	li.passed .tick {
		background-color: #5db65d;
		border-color: #5db65d;
		color: #000;
	}

	li.marked .tick {
		border-color: #5db65d;
		color: #5db65d;
	}

	.reset {
		margin: 0.5rem 0 0;
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
</style>
