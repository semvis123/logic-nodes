<script lang="ts">
	// A seven module code drawn small, black on white like a real label. It is
	// decoration next to the bits written out, never the only way to read them.
	export let bits: string;
	/** Module width in pixels. */
	export let size = 5;
	export let height = 16;
</script>

<svg
	class="code-bars"
	width={(bits.length + 2) * size}
	{height}
	viewBox="0 0 {bits.length + 2} 1"
	preserveAspectRatio="none"
	aria-hidden="true"
	focusable="false"
>
	<rect width={bits.length + 2} height="1" fill="#fff" />
	{#each [...bits] as bit, i}
		{#if bit === '1'}
			<rect x={i + 1} width="1" height="1" fill="#000" shape-rendering="crispEdges" />
		{/if}
	{/each}
</svg>

<style>
	.code-bars {
		display: inline-block;
		vertical-align: middle;
		border-radius: 2px;
	}
</style>
