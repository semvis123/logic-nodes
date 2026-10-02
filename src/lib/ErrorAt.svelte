<script lang="ts">
	import { errorContext } from '$lib/baseN';

	// An input error with the offending character shown in place, so a long
	// string does not have to be counted by hand to find character 37.
	export let message: string;
	export let input = '';
	export let position: number | undefined = undefined;

	$: context = position && input ? errorContext(input, position) : null;
	const visible = (ch: string) => (ch === ' ' ? '␣' : ch === '\n' ? '↵' : ch === '\t' ? '⇥' : ch);
</script>

<div class="error" role="alert">
	<p>{message}</p>
	{#if context}
		<p class="where mono">
			{context.cutStart ? '…' : ''}{context.before}<mark title="Character {position}">{visible(context.char)}</mark
			>{context.after}{context.cutEnd ? '…' : ''}
		</p>
	{/if}
</div>

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

	mark {
		background-color: #b42323;
		color: #fff;
		font-weight: 700;
		padding: 0 0.15em;
		border-radius: 2px;
		outline: 1px solid #fff;
	}
</style>
