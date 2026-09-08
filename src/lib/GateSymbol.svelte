<script lang="ts">
	import { shapes, inputYs } from '$lib/symbols';

	export let gate: string;
	/** 'ansi' draws the distinctive shape, 'iec' the rectangle. */
	export let standard: 'ansi' | 'iec' = 'ansi';
	export let label = '';
	/** Optional per-pin signal states, used by the circuit diagram. */
	export let inputStates: (boolean | null)[] = [];
	export let outputState: boolean | null = null;

	$: shape = shapes[gate];
	$: ys = inputYs(shape.inputs);
	const wire = (state: boolean | null) => (state === null ? '#9aa' : state ? '#5db65d' : '#f23');
</script>

<svg viewBox="0 0 70 50" class="symbol" role="img" aria-label={label || `${gate.toUpperCase()} gate symbol`}>
	{#if standard === 'ansi'}
		{#each ys as y, i}
			<line x1="0" y1={y} x2={shape.leadIn} y2={y} stroke={wire(inputStates[i] ?? null)} stroke-width="2" />
		{/each}
		<path d={shape.body} fill="#161618" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
		{#if shape.extra}
			<path d={shape.extra} fill="none" stroke="#fff" stroke-width="2" />
		{/if}
		{#if shape.bubble}
			<circle cx={shape.bubble} cy="25" r="4" fill="#161618" stroke="#fff" stroke-width="2" />
		{/if}
		<line x1={shape.leadOut} y1="25" x2="70" y2="25" stroke={wire(outputState)} stroke-width="2" />
	{:else}
		{#each ys as y, i}
			<line x1="0" y1={y} x2="14" y2={y} stroke={wire(inputStates[i] ?? null)} stroke-width="2" />
		{/each}
		<rect x="14" y="4" width="36" height="42" fill="#161618" stroke="#fff" stroke-width="2" rx="1" />
		<text x="32" y="31" text-anchor="middle" fill="#fff" class="iec-label">{shape.iec}</text>
		{#if shape.iecBubble}
			<circle cx="54" cy="25" r="4" fill="#161618" stroke="#fff" stroke-width="2" />
			<line x1="58" y1="25" x2="70" y2="25" stroke={wire(outputState)} stroke-width="2" />
		{:else}
			<line x1="50" y1="25" x2="70" y2="25" stroke={wire(outputState)} stroke-width="2" />
		{/if}
	{/if}
</svg>

<style>
	.symbol {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.iec-label {
		font: 600 15px ui-monospace, SFMono-Regular, Menlo, monospace;
	}
</style>
