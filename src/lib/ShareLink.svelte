<script lang="ts">
	import { copyLink } from '$lib/urlState';

	/** What the link points at, for the hint text. */
	export let what = 'this';

	let state: 'idle' | 'copied' | 'failed' = 'idle';
	let timer: ReturnType<typeof setTimeout>;

	async function copy() {
		state = (await copyLink()) ? 'copied' : 'failed';
		clearTimeout(timer);
		timer = setTimeout(() => (state = 'idle'), 2500);
	}
</script>

<button type="button" class="share" on:click={copy}>
	{state === 'copied' ? 'Link copied' : state === 'failed' ? 'Press ctrl+C' : 'Copy link'}
</button>
<span class="share-hint">
	{#if state === 'failed'}
		The address bar already holds {what}.
	{:else}
		The address bar tracks {what}, so a link reopens it exactly.
	{/if}
</span>

<style>
	.share {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.share:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.share-hint {
		color: #888;
		font-size: 0.75rem;
	}
</style>
