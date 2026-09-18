<script lang="ts">
	// One expression written the three ways the site's tools read and write
	// it, so a reader can see that ∧, a dot and & are one idea with three
	// faces. The box is editable, and every row is produced by the same
	// formatter the tools use, so the rows cannot disagree with them.
	import { parseExpression, format, BooleanError, type Notation } from '$lib/boolean';

	export let expression: string;
	export let label = 'One expression, three ways of writing it. Edit it and watch the rows change.';

	const notations: { id: Notation; name: string; reads: string }[] = [
		{ id: 'math', name: 'Maths', reads: '∧ is AND, ∨ is OR, ¬ is NOT' },
		{ id: 'engineering', name: 'Engineering', reads: 'letters side by side are AND, + is OR, a prime is NOT' },
		{ id: 'programming', name: 'Programming', reads: '&& is AND, || is OR, ! is NOT' }
	];

	let text = expression;
	let rows: { name: string; reads: string; text: string }[] = [];
	let error = '';
	$: {
		try {
			const ast = parseExpression(text);
			rows = notations.map((n) => ({ ...n, text: format(ast, n.id) }));
			error = '';
		} catch (e) {
			error = e instanceof BooleanError ? e.message : 'That is not an expression';
		}
	}
</script>

<div class="widget notation-table">
	<p class="widget-title">{label}</p>
	<label class="entry">
		<span>Expression</span>
		<input type="text" class="mono" bind:value={text} spellcheck="false" autocomplete="off" />
	</label>
	{#if error}
		<p class="error" aria-live="polite">{error}</p>
	{/if}
	<div class="table-wrap" aria-live="polite">
		<table class="data-table notations">
			<thead>
				<tr>
					<th scope="col">Notation</th>
					<th scope="col">Written</th>
					<th scope="col">How to read it</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row}
					<tr>
						<th scope="row">{row.name}</th>
						<td class="mono expr">{row.text}</td>
						<td class="reads">{row.reads}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.entry {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
		color: #bbb;
		font-size: 0.9rem;
		margin-bottom: 0.7rem;
	}

	.entry input {
		flex: 1 1 12rem;
		min-width: 0;
		background-color: #0e0e10;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		padding: 0.35rem 0.5rem;
		font-size: 1rem;
	}

	.entry input:focus {
		outline: 2px solid #5db65d;
		outline-offset: 1px;
	}

	.error {
		color: #f88;
		font-size: 0.85rem;
		margin: 0 0 0.5rem;
	}

	.notations th[scope='row'] {
		text-align: left;
		color: #ddd;
		font-weight: 600;
	}

	.notations .expr {
		color: #8ede8e;
		white-space: nowrap;
	}

	.notations .reads {
		color: #bbb;
		font-size: 0.85rem;
	}
</style>
