<script lang="ts">
	// The Quine-McCluskey tabulation one pass at a time: the minterms grouped by
	// their number of 1s, then each merging pass as the reader asks for it, then
	// the prime implicants and the chart that picks the cover. Every table is
	// the engine's own working, the same as on the Quine-McCluskey page.
	import { tabulate, cubeTerm } from '$lib/quineMcCluskey';
	import { overbar } from '$lib/course/notation';

	export let minterms: number[];
	export let dontCares: number[] = [];
	export let variables: string[] = ['a', 'b', 'c', 'd'];
	export let label = 'Click through the passes. A tick means the code merged with another in the next pass.';

	const result = tabulate(minterms, dontCares, variables);
	const passes = result.passes;
	// Steps 0 to passes.length - 1 reveal the passes; then the primes; then the chart.
	const primesStep = passes.length;
	const chartStep = passes.length + 1;
	let step = 0;

	const caption = (dashes: number) =>
		dashes === 0
			? 'Pass 0: the minterms, grouped by their number of 1s'
			: dashes === 1
			? 'Pass 1: pairs that differ in one bit, one dash each'
			: `Pass ${dashes}: groups of ${1 << dashes}, ${dashes} dashes each`;

	$: nextLabel =
		step < passes.length - 1
			? `Merge: pass ${step + 1}`
			: step === passes.length - 1
			? 'Nothing more merges. Show the prime implicants'
			: step === primesStep
			? 'Show the chart and the answer'
			: 'Start again';

	const advance = () => {
		step = step >= chartStep ? 0 : step + 1;
	};

	const term = (cube: typeof result.primes[number]) => overbar(cubeTerm(cube, variables));
	const dashed = (pattern: string) => pattern.replace(/-/g, '–');
	$: coveredByEssential = new Set(result.essential.flatMap((cube) => cube.covers));
</script>

<div class="widget merge-passes">
	<p class="widget-title">{label}</p>
	<p class="function mono">
		f({variables.join(', ')}) = Σm({result.minterms.join(', ')}){#if result.dontCares.length}
			+ d({result.dontCares.join(', ')}){/if}
	</p>

	<div class="passes" aria-live="polite">
		{#each passes.slice(0, Math.min(step, passes.length - 1) + 1) as pass}
			<div class="table-wrap">
				<table class="data-table tab">
					<caption>{caption(pass.dashes)}</caption>
					<thead>
						<tr>
							<th scope="col">1s</th>
							<th scope="col">{pass.dashes === 0 ? 'minterm' : 'minterms'}</th>
							{#each variables as v}<th scope="col" class="mono">{v}</th>{/each}
							<th scope="col">merged?</th>
						</tr>
					</thead>
					<tbody>
						{#each pass.groups as group}
							{#each group.cubes as cube, i}
								<tr class:group-start={i === 0}>
									{#if i === 0}
										<th scope="rowgroup" rowspan={group.cubes.length} class="ones">{group.ones}</th>
									{/if}
									<td class="mono index">{cube.covers.map((m) => `m${m}`).join(', ')}</td>
									{#each cube.pattern.split('') as bit}
										<td class={bit === '1' ? 'bit-1' : bit === '0' ? 'bit-0' : 'bit-x'}>{bit === '-' ? '–' : bit}</td>
									{/each}
									<td class="tick">{cube.ticked ? '✓' : 'prime'}</td>
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>
		{/each}

		{#if step >= primesStep}
			<div class="primes">
				<p class="sub">Prime implicants: everything that was never ticked, with the dashes read back as terms.</p>
				<ul class="mono">
					{#each result.primes as prime}
						<li>
							<span class="pattern">{dashed(prime.pattern)}</span> covers
							<span class="dim">{prime.covers.map((m) => `m${m}`).join(', ')}</span>:
							<span class="term">{term(prime)}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if step >= chartStep}
			<div class="table-wrap">
				<table class="data-table chart">
					<caption>The prime implicant chart: a mark where a prime covers a minterm</caption>
					<thead>
						<tr>
							<th scope="col">prime</th>
							{#each result.chart.minterms as m}
								<th scope="col" class="mono" class:crossed={coveredByEssential.has(m)}>m{m}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each result.chart.rows as row}
							<tr class:chosen={result.chosen.includes(row.cube)}>
								<th scope="row" class="mono">
									{term(row.cube)}{#if row.essential}<span class="essential"> essential</span>{/if}
								</th>
								{#each row.covers as covered, column}
									<td class="mark" class:crossed={coveredByEssential.has(result.chart.minterms[column])}>
										{#if covered}<span class:sole={result.chart.rows.filter((r) => r.covers[column]).length === 1}
												>×</span
											>{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="sub">
				{#if result.essential.length}
					A column with a single mark makes its row essential: {result.essential.map(term).join(', ')}.
				{:else}
					No column has a single mark, so nothing is essential and the whole cover is a choice.
				{/if}
				{#if result.remaining.length}
					That leaves {result.remaining.map((m) => `m${m}`).join(', ')} to cover, and the fewest extra primes that do it
					{result.extra.length === 1 ? 'is' : 'are'}
					{result.extra.map(term).join(', ')}.
				{:else}
					Between them they cover every column, so nothing more is needed.
				{/if}
			</p>
			<p class="answer">
				<span class="label">Minimal sum of products</span>
				<span class="mono result">{overbar(result.text)}</span>
				<span class="dim"
					>{result.chosen.length}
					{result.chosen.length === 1 ? 'term' : 'terms'}, from {result.minterms.length} minterms</span
				>
			</p>
		{/if}
	</div>

	<div class="controls">
		<button type="button" class="step-btn" on:click={advance}>{nextLabel}</button>
		{#if step > 0 && step < chartStep}
			<button type="button" class="link-btn" on:click={() => (step = 0)}>Start again</button>
		{/if}
	</div>
</div>

<style>
	.function {
		margin: 0 0 0.8rem;
		color: #ddd;
	}

	.passes {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.tab caption,
	.chart caption {
		caption-side: top;
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding: 0 0 0.3rem;
	}

	.tab .ones {
		color: #8ede8e;
		vertical-align: top;
		text-align: center;
	}

	.tab .group-start td,
	.tab .group-start th {
		border-top: 1px solid rgba(255, 255, 255, 0.25);
	}

	.tab .index {
		color: #ddd;
		white-space: nowrap;
	}

	.tick {
		color: #888;
		font-size: 0.85rem;
	}

	.sub {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 0.4rem;
	}

	.primes ul {
		list-style: none;
		padding: 0;
		margin: 0;
		color: #ddd;
	}

	.primes li {
		margin: 0.2rem 0;
	}

	.pattern {
		color: #bbb;
		letter-spacing: 0.1em;
	}

	.term {
		color: #8ede8e;
	}

	.dim {
		color: #999;
		font-size: 0.85rem;
	}

	.chart .mark {
		text-align: center;
		color: #fff;
	}

	.chart .sole {
		display: inline-block;
		width: 1.3em;
		height: 1.3em;
		line-height: 1.3em;
		border: 1px solid #8ede8e;
		border-radius: 50%;
		color: #8ede8e;
	}

	.chart tr.chosen th,
	.chart tr.chosen td {
		background: rgba(93, 182, 93, 0.14);
	}

	.chart .crossed {
		text-decoration: line-through;
		opacity: 0.55;
	}

	.essential {
		color: #8ede8e;
		font-size: 0.7rem;
		font-family: system-ui, sans-serif;
		margin-left: 0.3rem;
	}

	.answer {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.3rem 0.7rem;
		margin: 0.2rem 0 0;
	}

	.label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.result {
		color: #8ede8e;
		font-size: 1.15rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
	}

	.step-btn {
		background-color: #372;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.9rem;
		padding: 0.45rem 0.9rem;
		cursor: pointer;
	}

	.step-btn:hover {
		background-color: #4a3;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #8ede8e;
		font: inherit;
		font-size: 0.85rem;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
