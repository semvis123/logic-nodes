<script lang="ts">
	// A Karnaugh map to click: each square cycles through 0 and 1 (and X when
	// don't cares are allowed), and the groups are drawn from the same engine
	// as the solver page, in the same colours, so what the reader sees here
	// is exactly what the solver would show for the same map.
	import { karnaughMapFromCells, type CellValue, type KMap } from '$lib/boolean';
	import { overbar } from '$lib/course/notation';

	export let variables: string[] = ['a', 'b', 'c'];
	/** Starting cell values in truth table row order; missing cells are 0. */
	export let values: CellValue[] = [];
	export let dontCares = false;
	export let label = '';

	let cells: CellValue[] = Array.from({ length: 1 << variables.length }, (_, i) => values[i] ?? 0);
	let selected: number | null = null;

	$: map = karnaughMapFromCells(variables, cells, 'engineering');
	$: title =
		label || `Click a square to change it${dontCares ? ' (0, 1 or X)' : ''}. The groups and the expression follow.`;

	function cycle(index: number) {
		const current = cells[index];
		cells[index] = current === 0 ? 1 : current === 1 && dontCares ? 'x' : 0;
		cells = cells;
		selected = null;
	}

	// The solver's palette, so a group here looks like the same group there.
	const COLORS = ['#5db65d', '#4d9de0', '#e0a44d', '#b06ed6', '#e05d7a', '#3fbfb0', '#c9d64d', '#8d8df0'];

	function shownGroups(row: number, col: number, sel: number | null, m: KMap): number[] {
		const covering = m.groups.map((group, i) => (group.cells.includes(`${row},${col}`) ? i : -1)).filter((i) => i >= 0);
		return sel === null ? covering : covering.filter((i) => i === sel);
	}

	const tint = (row: number, col: number, sel: number | null, m: KMap) => {
		const shown = shownGroups(row, col, sel, m);
		return shown.length ? `background-color:${COLORS[shown[0] % COLORS.length]}33` : '';
	};

	const dimmed = (row: number, col: number, sel: number | null, m: KMap) =>
		sel !== null && !shownGroups(row, col, null, m).includes(sel);
</script>

<div class="widget kmap-widget">
	<p class="widget-title">{title}</p>
	<div class="map-scroll">
		<table class="kmap" aria-label="Karnaugh map">
			<thead>
				<tr>
					<th scope="col" class="corner">
						<span class="corner-rows">{map.rowVars.join('')}</span>
						<span class="corner-cols">{map.colVars.join('')}</span>
					</th>
					{#each map.colLabels as colLabel}
						<th scope="col" class="mono">{colLabel}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each map.values as cellRow, r}
					<tr>
						<th scope="row" class="mono">{map.rowLabels[r]}</th>
						{#each cellRow as cellValue, c}
							{@const index = map.indices[r][c]}
							{@const shown = shownGroups(r, c, selected, map)}
							<td class="cell" class:dimmed={dimmed(r, c, selected, map)} style={tint(r, c, selected, map)}>
								<button
									type="button"
									class="cell-btn"
									on:click={() => cycle(index)}
									aria-label="Cell m{index}, currently {cellValue === 'x'
										? "don't care"
										: cellValue}. Click to change it."
								>
									<span class="number">m{index}</span>
									<span class={cellValue === 'x' ? 'bit-x' : cellValue === 1 ? 'bit-1' : 'bit-0'}>
										{cellValue === 'x' ? 'X' : cellValue}
									</span>
									{#if shown.length}
										<span class="dots">
											{#each shown as g}
												<span class="dot" style="background-color:{COLORS[g % COLORS.length]}" />
											{/each}
										</span>
									{/if}
								</button>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if map.groups.length}
		<div class="legend">
			<span class="legend-label">Groups</span>
			{#each map.groups as group, i}
				<button
					type="button"
					class="group-btn"
					class:active={selected === i}
					on:click={() => (selected = selected === i ? null : i)}
					aria-pressed={selected === i}
				>
					<span class="swatch" style="background-color:{COLORS[i % COLORS.length]}" />
					<span class="mono">{overbar(group.term)}</span>
					<span class="group-size">{group.size} {group.size === 1 ? 'cell' : 'cells'}</span>
				</button>
			{/each}
		</div>
	{/if}

	<p class="result-line" aria-live="polite">
		<span class="result-label">Expression</span>
		<span class="mono result">{overbar(map.text)}</span>
	</p>
</div>

<style>
	.map-scroll {
		overflow-x: auto;
	}

	.kmap {
		border-collapse: collapse;
		margin-bottom: 0.8rem;
	}

	.kmap th {
		color: #888;
		font-weight: normal;
		font-size: 0.8rem;
		padding: 0.3rem 0.5rem;
	}

	.corner {
		position: relative;
		min-width: 3rem;
		height: 2.2rem;
		/* The classic diagonal split: rows label bottom-left, cols top-right. */
		background-image: linear-gradient(
			to top right,
			transparent calc(50% - 0.5px),
			rgba(255, 255, 255, 0.25) 50%,
			transparent calc(50% + 0.5px)
		);
	}

	.corner-rows {
		position: absolute;
		left: 0.3rem;
		bottom: 0.15rem;
	}

	.corner-cols {
		position: absolute;
		right: 0.3rem;
		top: 0.15rem;
	}

	.cell {
		padding: 0;
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.25);
		transition: background-color 0.15s ease;
		vertical-align: middle;
	}

	.cell-btn {
		width: 3.1rem;
		height: 3.3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		background: none;
		border: none;
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1.1rem;
		cursor: pointer;
	}

	.cell-btn:hover {
		background-color: rgba(255, 255, 255, 0.07);
	}

	.cell-btn:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}

	.number {
		font-size: 0.6rem;
		color: #eee;
	}

	.cell-btn .bit-1 {
		color: #5db65d;
	}

	.cell-btn .bit-0 {
		color: #f66;
	}

	/* Don't cares read as neutral: neither high nor low. */
	.cell-btn .bit-x {
		color: #d8b45a;
	}

	.cell.dimmed {
		opacity: 0.35;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 3px;
		height: 6px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		display: inline-block;
	}

	.legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.legend-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.2rem;
	}

	.group-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.group-btn:hover,
	.group-btn.active {
		border-color: #5db65d;
		color: #fff;
	}

	.swatch {
		width: 11px;
		height: 11px;
		border-radius: 2px;
		display: inline-block;
	}

	.group-size {
		color: #888;
		font-size: 0.75rem;
	}

	.result-line {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
		margin: 0.8rem 0 0;
		padding-top: 0.7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.result-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.result {
		color: #8ede8e;
		font-size: 1.15rem;
		word-break: break-word;
	}

	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition: none;
		}
	}
</style>
