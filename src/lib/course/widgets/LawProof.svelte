<script lang="ts">
	// A law from $lib/laws with its proof: both sides evaluated on every row,
	// side by side, with the row for the current inputs lit. The tables come
	// from the same engine as the reference page, so the lesson cannot state a
	// law the site does not prove.
	import { laws } from '$lib/laws';
	import { parseExpression, truthTable, evaluate, equivalent, variablesOf } from '$lib/boolean';

	/** The law's name, exactly as in $lib/laws. */
	export let name: string;
	/** Which of the forms with that name, in the order the laws file lists them. */
	export let form = 0;
	export let label = '';

	const forms = laws.filter((law) => law.name === name);
	const law = forms[form] ?? forms[0];
	if (!law) throw new Error(`No law called "${name}"`);

	const left = parseExpression(law.left);
	const right = parseExpression(law.right);
	const variables = [...new Set([...variablesOf(left), ...variablesOf(right)])].sort((x, y) => x.localeCompare(y));
	const leftRows = truthTable(left, variables).rows;
	const rightRows = truthTable(right, variables).rows;
	const holds = equivalent(left, right);
	const shown = label || `${law.name}: ${law.left} = ${law.right}`;

	let values: Record<string, boolean> = Object.fromEntries(variables.map((v) => [v, false]));
	$: leftOut = evaluate(left, values);
	$: rightOut = evaluate(right, values);
	$: row = variables.reduce((acc, v) => acc * 2 + (values[v] ? 1 : 0), 0);

	const toggle = (v: string) => {
		values = { ...values, [v]: !values[v] };
	};
</script>

<div class="widget law-proof">
	<p class="widget-title">{shown}{variables.length ? '. Click the inputs.' : ''}</p>
	<div class="controls">
		{#each variables as v}
			<button type="button" class="toggle" class:on={values[v]} aria-pressed={values[v]} on:click={() => toggle(v)}>
				{v} <span class="val">{values[v] ? 1 : 0}</span>
			</button>
		{/each}
		{#if variables.length}<span class="arrow" aria-hidden="true">→</span>{/if}
		<span class="out" class:on={leftOut} aria-live="polite"
			><span class="mono">{law.left}</span> <span class="val">{leftOut ? 1 : 0}</span></span
		>
		<span class="out" class:on={rightOut} aria-live="polite"
			><span class="mono">{law.right}</span> <span class="val">{rightOut ? 1 : 0}</span></span
		>
	</div>
	<div class="table-wrap">
		<table class="data-table live-table">
			<thead>
				<tr>
					{#each variables as v}<th scope="col" class="mono">{v}</th>{/each}
					<th scope="col" class="mono">{law.left}</th>
					<th scope="col" class="mono">{law.right}</th>
				</tr>
			</thead>
			<tbody>
				{#each leftRows as value, i}
					<tr class:current={i === row}>
						{#each variables as _, bit}
							{@const on = !!(i & (1 << (variables.length - 1 - bit)))}
							<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
						{/each}
						<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
						<td class={rightRows[i] ? 'bit-1' : 'bit-0'}>{rightRows[i] ? 1 : 0}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="verdict">
		{holds
			? `The two columns match on all ${leftRows.length} row${leftRows.length === 1 ? '' : 's'}, so the law holds.`
			: 'The two columns differ, so this is not a law.'}
	</p>
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

	.verdict {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.6rem 0 0;
	}
</style>
