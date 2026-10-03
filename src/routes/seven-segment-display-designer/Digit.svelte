<script lang="ts">
	// One editable seven-segment digit. Segments are buttons; only the digit being
	// edited is in the tab order, so a row of eight is not 64 tab stops.
	import { createEventDispatcher } from 'svelte';
	import { SEGMENT_ORDER } from '$lib/displayDesigner';

	export let mask = 0;
	export let index = 0;
	export let tabbable = true;
	const dispatch = createEventDispatcher<{ toggle: number }>();

	// Outlines in a 76 by 108 box; the point is a circle.
	const SHAPES = 'M12,6 h40 l-6,6 h-28 z|M58,10 v40 l-6,-6 v-28 z|M58,58 v40 l-6,-6 v-28 z|M12,102 h40 l-6,-6 h-28 z|M6,58 v40 l6,-6 v-28 z|M6,10 v40 l6,-6 v-28 z|M12,54 h40 l-6,3 l6,3 h-40 l6,-3 z'.split('|');
	const press = (e: KeyboardEvent, bit: number) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dispatch('toggle', bit);
		}
	};
</script>

<svg viewBox="0 0 76 108" class="digit" role="group" aria-label="Digit {index + 1}">
	{#each SEGMENT_ORDER as name, bit}
		{@const label = `Digit ${index + 1}, ${bit === 7 ? 'decimal point' : 'segment ' + name}`}
		{#if bit < 7}
			<path d={SHAPES[bit]} class:lit={mask & (1 << bit)} role="button" tabindex={tabbable ? 0 : -1} aria-pressed={!!(mask & (1 << bit))} aria-label={label} on:click={() => dispatch('toggle', bit)} on:keydown={(e) => press(e, bit)} />
		{:else}
			<circle cx="68" cy="100" r="5" class:lit={mask & 128} role="button" tabindex={tabbable ? 0 : -1} aria-pressed={!!(mask & 128)} aria-label={label} on:click={() => dispatch('toggle', 7)} on:keydown={(e) => press(e, 7)} />
		{/if}
	{/each}
</svg>

<style>
	.digit {
		display: block;
		width: 100%;
		height: auto;
		touch-action: manipulation;
	}
	path,
	circle {
		fill: #2a2a2e;
		stroke: #444;
		stroke-width: 1;
		cursor: pointer;
	}
	path:hover,
	circle:hover {
		fill: #4a3034;
	}
	.lit,
	.lit:hover {
		fill: #f23;
		stroke: #f66;
	}
	path:focus-visible,
	circle:focus-visible {
		outline: none;
		stroke: #fff;
		stroke-width: 2.5;
	}
</style>
