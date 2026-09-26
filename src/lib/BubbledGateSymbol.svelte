<script lang="ts">
	import { shapes } from '$lib/symbols';
	import type { BubbledGate } from '$lib/demorgan';

	// An AND or OR distinctive shape with bubbles on its inputs, its output, or
	// both: the drawings De Morgan's laws are about. It reuses the geometry in
	// symbols.ts, shifted right to make room for the input bubbles, so a NAND
	// here is the same outline as everywhere else on the site.
	export let gate: BubbledGate;
	export let label: string;

	const SHIFT = 8;
	const R = 4;
	const ys = [16, 34];

	$: shape = shapes[gate.outputBubble ? (gate.shape === 'and' ? 'nand' : 'nor') : gate.shape];
	// Where the back of the body is at the height of the input pins. The AND
	// back is flat at x = 6; the OR back is a curve that has bowed right to
	// about x = 12.5 by the pin heights (see leadIn in symbols.ts).
	$: back = (gate.shape === 'and' ? 6 : 12.5) + SHIFT;
	$: leadEnd = gate.inputBubbles ? back - 2 * R : shape.leadIn + SHIFT;
</script>

<svg viewBox="0 0 78 50" class="symbol" role="img" aria-label={label}>
	{#each ys as y}
		<line x1="0" y1={y} x2={leadEnd} y2={y} stroke="#9aa" stroke-width="2" />
	{/each}
	<g transform="translate({SHIFT} 0)">
		<path d={shape.body} fill="#161618" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
		{#if shape.bubble}
			<circle cx={shape.bubble} cy="25" r={R} fill="#161618" stroke="#fff" stroke-width="2" />
		{/if}
		<line x1={shape.leadOut} y1="25" x2={70} y2="25" stroke="#9aa" stroke-width="2" />
	</g>
	<!-- Drawn after the body, so the curved OR back cannot clip them. -->
	{#if gate.inputBubbles}
		{#each ys as y}
			<circle cx={back - R} cy={y} r={R} fill="#161618" stroke="#fff" stroke-width="2" />
		{/each}
	{/if}
</svg>

<style>
	.symbol {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
</style>
