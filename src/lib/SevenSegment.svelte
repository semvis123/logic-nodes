<script lang="ts">
	// A seven-segment digit drawn to the usual layout, with optional letters
	// beside each bar. Used on the decoder page for the live display, the
	// labelled reference, the per-segment cards and the truth table.
	import type { SegmentName } from '$lib/sevenSegment';

	/** Which segments are lit. */
	export let lit: Set<SegmentName> | SegmentName[] = [];
	/** Draw the letters a to g next to their bars. */
	export let labels = false;
	/** Draw the unlit bars faintly, so the shape of the digit is visible. */
	export let ghost = true;
	export let label = '';

	$: on = new Set(lit);

	// Segment outlines in a 64 by 108 box, clockwise from the top, g in the middle.
	const geometry: Record<SegmentName, string> = {
		a: 'M12,6 h40 l-6,6 h-28 z',
		b: 'M58,10 v40 l-6,-6 v-28 z',
		c: 'M58,58 v40 l-6,-6 v-28 z',
		d: 'M12,102 h40 l-6,-6 h-28 z',
		e: 'M6,58 v40 l6,-6 v-28 z',
		f: 'M6,10 v40 l6,-6 v-28 z',
		g: 'M12,54 h40 l-6,3 l6,3 h-40 l6,-3 z'
	};
	const letterAt: Record<SegmentName, { x: number; y: number }> = {
		a: { x: 32, y: -4 },
		b: { x: 70, y: 34 },
		c: { x: 70, y: 82 },
		d: { x: 32, y: 118 },
		e: { x: -6, y: 82 },
		f: { x: -6, y: 34 },
		g: { x: 70, y: 58 }
	};
	const names = Object.keys(geometry) as SegmentName[];
</script>

<svg
	viewBox={labels ? '-16 -14 96 138' : '0 0 64 108'}
	class="seven-segment"
	class:labelled={labels}
	role="img"
	aria-label={label || `Seven-segment display showing segments ${[...on].sort().join(', ') || 'none'}`}
>
	{#each names as segment}
		<path d={geometry[segment]} class:lit={on.has(segment)} class:ghost />
		{#if labels}
			<text x={letterAt[segment].x} y={letterAt[segment].y} class:lit={on.has(segment)}>{segment}</text>
		{/if}
	{/each}
</svg>

<style>
	.seven-segment {
		display: block;
		width: 100%;
		height: auto;
	}

	path {
		fill: transparent;
	}

	path.ghost {
		fill: #2a2a2e;
	}

	path.lit {
		fill: #f23;
	}

	text {
		fill: #999;
		font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace;
		text-anchor: middle;
		dominant-baseline: middle;
	}

	text.lit {
		fill: #fff;
	}
</style>
