<script lang="ts">
	// A Venn diagram of 1 to 3 sets in a universe rectangle. Every region,
	// including the outside, is its own path, so each can be shaded, clicked and
	// reached with the keyboard. The geometry lives in venn.ts, where it is
	// tested point by point against circle membership.
	import { createEventDispatcher } from 'svelte';
	import {
		vennLayout,
		regionWords,
		regionNotation,
		regionLabel,
		regionText,
		setLabels,
		VENN_COLOURS,
		type RegionLabels
	} from '$lib/venn';

	export let n = 2;
	export let shaded: boolean[] = [];
	/** Regions toggle on click, Enter or Space, reported as a `toggle` event. */
	export let interactive = false;
	export let labels: RegionLabels = 'none';
	/** What the diagram shows, for screen readers, e.g. "Venn diagram of A ∪ B". */
	export let label = '';
	/** Show the U in the corner of the universe. */
	export let showUniverse = true;
	export let small = false;
	/** Names drawn for A, B and C; an empty name keeps the letter. */
	export let names: readonly string[] = [];
	/** Items drawn in each region, by region index. */
	export let items: readonly (readonly string[])[] = [];

	const dispatch = createEventDispatcher<{ toggle: number }>();

	$: layout = vennLayout(n);
	// "In A and C but not B" reads as part of a sentence: only its first letter is lowered,
	// so the set letters and names keep their capitals.
	const inSentence = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);
	$: shadedWords = layout.regions.filter((r) => shaded[r.index]).map((r) => inSentence(regionWords(r.index, n, names)));
	$: labelSpots = setLabels(n, names, small ? 24 : 18);
	$: texts = layout.regions.map((region) =>
		regionText(n, region.index, items[region.index] ?? [], regionLabel(region.index, n, labels))
	);
	$: itemCount = items.slice(0, layout.regions.length).reduce((sum, list) => sum + (list?.length ?? 0), 0);
	$: description =
		`${label || 'Venn diagram'}: ` +
		(shadedWords.length === 0
			? 'nothing is shaded.'
			: shadedWords.length === layout.regions.length
			? 'every region is shaded.'
			: `shaded ${shadedWords.join('; ')}.`) +
		(itemCount
			? ` Items: ${layout.regions
					.filter((r) => items[r.index]?.length)
					.map((r) => `${inSentence(regionWords(r.index, n, names))}: ${items[r.index].join(', ')}`)
					.join('; ')}.`
			: '');

	function key(event: KeyboardEvent, index: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			dispatch('toggle', index);
		}
	}
</script>

<svg
	class="venn"
	class:interactive
	class:small
	viewBox="0 0 {layout.width} {layout.height}"
	role={interactive ? 'group' : 'img'}
	aria-label={interactive
		? `${label || 'Venn diagram'}. Each region is a button that shades or clears it.`
		: description}
>
	{#each layout.regions as region (region.index)}
		{#if interactive}
			<path
				d={region.path}
				fill-rule="evenodd"
				class="region"
				class:on={shaded[region.index]}
				style="--fill: {shaded[region.index] ? VENN_COLOURS.shaded : VENN_COLOURS.background}"
				data-region={region.index}
				role="button"
				tabindex="0"
				aria-pressed={shaded[region.index] ? 'true' : 'false'}
				aria-label="{regionWords(region.index, n, names)} ({regionNotation(region.index, n)}){items[region.index]
					?.length
					? `: ${items[region.index].join(', ')}`
					: ''}"
				on:click={() => dispatch('toggle', region.index)}
				on:keydown={(event) => key(event, region.index)}
				><title>{regionWords(region.index, n, names)}: {regionNotation(region.index, n)}, minterm m{region.index}</title
				></path
			>
		{:else}
			<path
				d={region.path}
				fill-rule="evenodd"
				class="region"
				class:on={shaded[region.index]}
				style="--fill: {shaded[region.index] ? VENN_COLOURS.shaded : VENN_COLOURS.background}"
				data-region={region.index}
			/>
		{/if}
	{/each}
	<g class="overlay" aria-hidden="true">
		<rect x={layout.universe.x} y={layout.universe.y} width={layout.universe.w} height={layout.universe.h} />
		{#each layout.circles as circle}
			<circle cx={circle.cx} cy={circle.cy} r={circle.r} />
		{/each}
		{#if showUniverse}<text class="set-label" x={layout.universe.lx} y={layout.universe.ly}>U</text>{/if}
		{#each labelSpots as label}
			<text class="set-label" x={label.x} y={label.y} style="font-size: {label.size}px; text-anchor: {label.anchor}"
				>{label.text}</text
			>
		{/each}
		{#each texts as lines}
			{#each lines as line}
				<text class={line.kind === 'label' ? 'region-label' : 'item'} x={line.x} y={line.y} text-anchor={line.anchor}
					>{line.text}</text
				>
			{/each}
		{/each}
	</g>
</svg>

<style>
	.venn {
		display: block;
		width: 100%;
		max-width: 480px;
		height: auto;
		/* Text inside the diagram inherits this, for the contrast check too. */
		color: #fff;
		background-color: #0d0d0f;
		border-radius: 3px;
		user-select: none;
	}

	.venn.small {
		max-width: 220px;
	}

	.region {
		fill: var(--fill);
		transition: fill 0.12s;
	}

	.interactive .region {
		cursor: pointer;
		outline: none;
	}

	.interactive .region:hover {
		fill: #26262b;
	}

	.interactive .region.on:hover {
		fill: #4caf52;
	}

	.interactive .region:focus-visible {
		stroke: #ffd24d;
		stroke-width: 3;
		stroke-dasharray: 5 3;
	}

	.overlay {
		pointer-events: none;
	}

	.overlay rect {
		fill: none;
		stroke: rgba(255, 255, 255, 0.55);
		stroke-width: 1.5;
	}

	.overlay circle {
		fill: none;
		stroke: #f0f0f0;
		stroke-width: 2;
	}

	.set-label {
		fill: #fff;
		font: 700 18px system-ui, -apple-system, 'Segoe UI', sans-serif;
		text-anchor: middle;
		/* A dark outline keeps a long name readable where it crosses a circle. */
		stroke: #0d0d0f;
		stroke-width: 3px;
		paint-order: stroke;
	}

	.region-label,
	.item {
		fill: #fff;
		stroke: #0d0d0f;
		stroke-width: 3px;
		paint-order: stroke;
		font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.item {
		font: 400 11px system-ui, -apple-system, 'Segoe UI', sans-serif;
	}
</style>
