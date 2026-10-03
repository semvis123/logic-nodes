<script lang="ts">
	// A read-only picture of a dot-matrix grid.
	import type { Grid } from '$lib/displayDesigner';
	export let grid: Grid;
	export let label: string;
	export let size = 10;
	$: w = grid[0]?.length ?? 0;
</script>

<svg viewBox="0 0 {Math.max(w, 1) * size} {grid.length * size}" width={Math.max(w, 1) * size} class="dots" role="img" aria-label={label}>
	{#each grid as row, r}
		{#each row as on, c}
			<circle cx={c * size + size / 2} cy={r * size + size / 2} r={size * 0.4} class:on />
		{/each}
	{/each}
</svg>

<style>
	.dots {
		display: block;
		max-width: 100%;
		height: auto;
	}
	circle {
		fill: #2a2a2e;
	}
	circle.on {
		fill: #f23;
	}
</style>
