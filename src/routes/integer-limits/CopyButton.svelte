<script lang="ts">
	/** The exact text put on the clipboard. */
	export let text: string;
	/** What is being copied, for screen readers: "Copy maximum in hex". */
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

<button type="button" class="copy" on:click={copy} aria-label="Copy {label}"
	>{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select it' : 'Copy'}</button
><span class="live" aria-live="polite"
	>{state === 'copied' ? `Copied ${text}` : state === 'failed' ? 'Copying failed: select the text instead' : ''}</span
>

<style>
	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font-size: 0.72rem;
		min-width: 4.4rem;
		padding: 0.15rem 0.45rem;
		white-space: nowrap;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.live {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
