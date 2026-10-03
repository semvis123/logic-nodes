<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { errorContext } from '$lib/baseN';

	// An input error with the offending character shown in place, so a long
	// string does not have to be counted by hand to find character 37.
	export let message: string;
	export let input = '';
	export let position: number | undefined = undefined;
	/** For the field's aria-describedby, so going back to it says what is wrong. */
	export let id: string | undefined = undefined;

	// Half-typed input is an error on nearly every key, so the box updates at once
	// but the screen reader alert waits for a pause in typing; otherwise it would
	// interrupt someone on each keystroke with a message about a value they have
	// not finished. The alert region is there from the start and only its text
	// changes, which is what screen readers announce reliably.
	let alertText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	$: scheduleAlert(message);
	function scheduleAlert(text: string) {
		if (!browser) return;
		clearTimeout(alertTimer);
		alertTimer = setTimeout(() => (alertText = text), 500);
	}
	onDestroy(() => clearTimeout(alertTimer));

	$: context = position && input ? errorContext(input, position) : null;
	const visible = (ch: string) => (ch === ' ' ? '␣' : ch === '\n' ? '↵' : ch === '\t' ? '⇥' : ch);
</script>

<div class="error" {id}>
	<p>{message}</p>
	{#if context}
		<p class="where mono">
			{context.cutStart ? '…' : ''}{context.before}<mark title="Character {position}">{visible(context.char)}</mark
			>{context.after}{context.cutEnd ? '…' : ''}
		</p>
	{/if}
</div>
<p class="visually-hidden" role="alert">{alertText}</p>

<style>
	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid #e05555;
		border-left-width: 4px;
		border-radius: 3px;
		background-color: rgba(190, 50, 50, 0.12);
	}

	.error p {
		margin: 0;
		color: #f88;
	}

	.where {
		margin-top: 0.4rem !important;
		color: #ddd !important;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

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

	mark {
		background-color: #b42323;
		color: #fff;
		font-weight: 700;
		padding: 0 0.15em;
		border-radius: 2px;
		outline: 1px solid #fff;
	}
</style>
