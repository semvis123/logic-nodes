<script lang="ts">
	import { copyText } from '$lib/download';
	export let text: string;
	export let label = 'Copy';
	let state = '';
	let timer: ReturnType<typeof setTimeout>;
	async function copy() {
		state = (await copyText(text)) ? 'Copied' : 'Select the text and copy it';
		clearTimeout(timer);
		timer = setTimeout(() => (state = ''), 2500);
	}
</script>

<span class="copy-wrap">
	<button type="button" class="copy" on:click={copy}>{label}</button>
	<span class="copied" aria-live="polite">{state}</span>
</span>

<style>
	.copy-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.25rem 0.7rem;
		cursor: pointer;
	}
	.copied {
		color: #8ede8e;
		font-size: 0.8rem;
	}
</style>
