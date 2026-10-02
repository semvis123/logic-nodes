<script lang="ts">
	// A seven module code drawn small. It is decoration next to the bits written
	// out, never the only way to read them. By default it is black on a white
	// label with a grey edge, like a real barcode; with `ink` the bars take the
	// text colour on no background, so on a dark tile the 1s still read as the
	// bars rather than the white gaps between them.
	export let bits: string;
	/** Module width in pixels. */
	export let size = 5;
	export let height = 16;
	export let ink = false;
	$: margin = ink ? 0 : 1;
</script>

<svg
	class="code-bars"
	class:label={!ink}
	width={(bits.length + 2 * margin) * size}
	{height}
	viewBox="0 0 {bits.length + 2 * margin} 1"
	preserveAspectRatio="none"
	aria-hidden="true"
	focusable="false"
>
	{#if !ink}<rect width={bits.length + 2} height="1" fill="#fff" />{/if}
	{#each [...bits] as bit, i}
		{#if bit === '1'}
			<rect x={i + margin} width="1" height="1" fill={ink ? 'currentColor' : '#000'} shape-rendering="crispEdges" />
		{/if}
	{/each}
</svg>

<style>
	.code-bars {
		display: inline-block;
		vertical-align: middle;
		border-radius: 2px;
	}

	.label {
		outline: 1px solid #777;
	}
</style>
