<script lang="ts">
	import { toolIcons } from '$lib/toolIcons';

	export let href = '';
	/** Paths to draw instead of a tool's icon, for things that are not tools. */
	export let markup = '';
</script>

<!-- Decoration only: the tool's name next to it is the label. -->
<svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
	>{@html markup || toolIcons[href] || ''}</svg
>

<style>
	.tool-icon {
		width: 20px;
		height: 20px;
		flex: none;
		fill: none;
		stroke: #8a8a90;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: stroke 0.15s ease;
	}

	:global(a:hover) .tool-icon,
	:global(a:focus-visible) .tool-icon {
		stroke: #8ede8e;
	}

	@media print {
		.tool-icon {
			stroke: #444;
		}
	}
</style>
