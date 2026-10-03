<script lang="ts">
	import { onDestroy } from 'svelte';

	// A screen reader copy of an error that waits for a pause in typing. Each
	// half-typed address is an error, so an alert that followed every keystroke
	// would interrupt the reader over and over; the visible error still updates
	// at once.
	export let message: string;
	export let delay = 500;

	let text = '';
	let timer: ReturnType<typeof setTimeout>;
	$: schedule(message);
	function schedule(m: string) {
		clearTimeout(timer);
		if (!m) text = '';
		else timer = setTimeout(() => (text = m), delay);
	}
	onDestroy(() => clearTimeout(timer));
</script>

{#if text}
	<p class="visually-hidden" role="alert">{text}</p>
{/if}

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
