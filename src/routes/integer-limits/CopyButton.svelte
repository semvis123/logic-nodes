<script lang="ts">
	/** The exact text put on the clipboard. */
	export let text: string;
	/** What is being copied, read after the visible word: "Copy maximum in hex". */
	export let label: string;

	let state: 'idle' | 'copied' | 'failed' = 'idle';
	let timer: ReturnType<typeof setTimeout>;

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			state = 'copied';
		} catch {
			state = 'failed';
		}
		clearTimeout(timer);
		timer = setTimeout(() => (state = 'idle'), 2000);
	}
</script>

<!-- The visible word starts the accessible name, so speech users can say what they see. -->
<button type="button" class="copy" on:click={copy}
	>{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select it' : 'Copy'}<span class="visually-hidden">
		{label}</span
	></button
><span class="visually-hidden" aria-live="polite"
	>{state === 'copied' ? `Copied ${text}` : state === 'failed' ? 'Copying failed: select the text instead' : ''}</span
>

<style>
	/* The same size and look as the site's Copy link button. */
	.copy {
		align-self: center;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font-size: 0.8rem;
		line-height: 1.2;
		min-width: 4.6rem;
		padding: 0.3rem 0.7rem;
		position: relative;
		vertical-align: middle;
		white-space: nowrap;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
