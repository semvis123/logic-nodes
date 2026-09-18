<script lang="ts">
	// Any boolean expression as a thing to click: one toggle per input, the
	// output lamp, and the truth table with the current row lit. The table is
	// computed by the same engine as the tools, so it cannot disagree with them.
	import { parseExpression, truthTable, evaluate, variablesOf, format } from '$lib/boolean';

	export let expression: string;
	export let label = '';
	export let table = true;
	export let outputLabel = 'out';
	/** Optional friendlier names for the inputs, keyed by variable. */
	export let names: Record<string, string> = {};

	const ast = parseExpression(expression);
	const variables = variablesOf(ast);
	const rows = truthTable(ast, variables);
	const shown = label || format(ast, 'engineering');

	let values: Record<string, boolean> = Object.fromEntries(variables.map((v) => [v, false]));
	$: output = evaluate(ast, values);
	$: row = variables.reduce((acc, v) => acc * 2 + (values[v] ? 1 : 0), 0);

	const toggle = (v: string) => {
		values = { ...values, [v]: !values[v] };
	};
</script>

<div class="widget live-expression">
	<p class="widget-title">{shown}</p>
	<div class="controls">
		{#each variables as v}
			<button type="button" class="toggle" class:on={values[v]} aria-pressed={values[v]} on:click={() => toggle(v)}>
				{names[v] ?? v} <span class="val">{values[v] ? 1 : 0}</span>
			</button>
		{/each}
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out" class:on={output} aria-live="polite">{outputLabel} <span class="val">{output ? 1 : 0}</span></span
		>
	</div>
	{#if table}
		<div class="table-wrap">
			<table class="data-table live-table">
				<thead>
					<tr>
						{#each variables as v}<th scope="col" class="mono">{names[v] ?? v}</th>{/each}
						<th scope="col" class="mono">{outputLabel}</th>
					</tr>
				</thead>
				<tbody>
					{#each rows.rows as value, i}
						<tr class:current={i === row}>
							{#each variables as _, bit}
								{@const on = !!(i & (1 << (variables.length - 1 - bit)))}
								<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
							{/each}
							<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.live-table {
		margin-top: 0.8rem;
	}

	.live-table tr.current td {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}
</style>
