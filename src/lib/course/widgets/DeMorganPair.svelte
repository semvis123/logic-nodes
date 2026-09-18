<script lang="ts">
	// Two expressions on one set of toggles, a lamp for each, and the verdict
	// on whether they agree on every row. Built for De Morgan, but it compares
	// any pair, which is also how a simplification is checked.
	import { parseExpression, truthTable, evaluate, equivalent, variablesOf, format } from '$lib/boolean';

	export let left: string;
	export let right: string;
	export let label = '';
	export let table = true;

	const l = parseExpression(left);
	const r = parseExpression(right);
	const variables = [...new Set([...variablesOf(l), ...variablesOf(r)])].sort((x, y) => x.localeCompare(y));
	const leftText = format(l, 'math');
	const rightText = format(r, 'math');
	const leftRows = truthTable(l, variables).rows;
	const rightRows = truthTable(r, variables).rows;
	const same = equivalent(l, r);
	const differing = leftRows.filter((value, i) => value !== rightRows[i]).length;
	const shown = label || `${leftText} against ${rightText}. Click the inputs.`;

	let values: Record<string, boolean> = Object.fromEntries(variables.map((v) => [v, false]));
	$: leftOut = evaluate(l, values);
	$: rightOut = evaluate(r, values);
	$: row = variables.reduce((acc, v) => acc * 2 + (values[v] ? 1 : 0), 0);

	const toggle = (v: string) => {
		values = { ...values, [v]: !values[v] };
	};
</script>

<div class="widget demorgan-pair">
	<p class="widget-title">{shown}</p>
	<div class="controls">
		{#each variables as v}
			<button type="button" class="toggle" class:on={values[v]} aria-pressed={values[v]} on:click={() => toggle(v)}>
				{v} <span class="val">{values[v] ? 1 : 0}</span>
			</button>
		{/each}
	</div>
	<div class="pair" aria-live="polite">
		<div class="side">
			<span class="lamp" class:on={leftOut} role="img" aria-label={leftOut ? 'on' : 'off'} />
			<span class="mono expr">{leftText}</span>
			<span class="val">{leftOut ? 1 : 0}</span>
		</div>
		<div class="side">
			<span class="lamp" class:on={rightOut} role="img" aria-label={rightOut ? 'on' : 'off'} />
			<span class="mono expr">{rightText}</span>
			<span class="val">{rightOut ? 1 : 0}</span>
		</div>
	</div>
	<p class="verdict" class:same class:differs={!same}>
		{same
			? `Same on every row: all ${leftRows.length} of them.`
			: `Not the same: they differ on ${differing} of ${leftRows.length} rows.`}
	</p>
	{#if table}
		<div class="table-wrap">
			<table class="data-table live-table">
				<thead>
					<tr>
						{#each variables as v}<th scope="col" class="mono">{v}</th>{/each}
						<th scope="col" class="mono">{leftText}</th>
						<th scope="col" class="mono">{rightText}</th>
					</tr>
				</thead>
				<tbody>
					{#each leftRows as value, i}
						<tr class:current={i === row} class:mismatch={value !== rightRows[i]}>
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
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.pair {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 0.8rem;
	}

	.side {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: #fff;
	}

	.side .expr {
		font-size: 1rem;
	}

	.verdict {
		font-size: 0.9rem;
		margin: 0.7rem 0 0;
		color: #8ede8e;
	}

	.verdict.differs {
		color: #f88;
	}

	.live-table {
		margin-top: 0.8rem;
	}

	.live-table tr.current td {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}

	.live-table tr.mismatch td {
		background-color: rgba(255, 34, 51, 0.12);
	}
</style>
