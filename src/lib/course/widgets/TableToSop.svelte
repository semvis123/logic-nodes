<script lang="ts">
	// A truth table whose output column the reader edits, with the canonical
	// sum of products written out underneath, one minterm per 1, and the
	// minimal form as a taste of what the rest of the stage is for. Both come
	// from the same engine as the sum of products calculator.
	import { canonicalForms, type TruthTable } from '$lib/boolean';
	import { mintermText, overbar } from '$lib/course/notation';

	export let variables: string[] = ['a', 'b', 'c'];
	/** Row numbers whose output starts as 1. */
	export let ones: number[] = [];
	export let label = 'Click any output cell to change it and watch the expression follow.';

	let rows: boolean[] = Array.from({ length: 1 << variables.length }, (_, i) => ones.includes(i));
	$: table = { variables, rows } as TruthTable;
	$: forms = canonicalForms(table, 'engineering');
	$: count = forms.minterms.length;

	const flip = (i: number) => {
		rows[i] = !rows[i];
		rows = rows;
	};
</script>

<div class="widget table-to-sop">
	<p class="widget-title">{label}</p>
	<div class="table-wrap">
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col">row</th>
					{#each variables as v}<th scope="col" class="mono">{v}</th>{/each}
					<th scope="col" class="mono">out</th>
					<th scope="col">minterm</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as value, i}
					<tr>
						<td class="index">{i}</td>
						{#each variables as _, bit}
							{@const on = !!(i & (1 << (variables.length - 1 - bit)))}
							<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
						{/each}
						<td class="out-cell">
							<button
								type="button"
								class="toggle"
								class:on={value}
								aria-pressed={value}
								aria-label="Row {i} output, currently {value ? 1 : 0}"
								on:click={() => flip(i)}
							>
								{value ? 1 : 0}
							</button>
						</td>
						<td class="mono term">{value ? `m${i} = ${mintermText(i, variables)}` : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="readout" aria-live="polite">
		<p><span class="label">Minterms</span> <span class="mono">{forms.sigma}</span></p>
		<p>
			<span class="label">Canonical sum of products</span>
			<span class="mono result">{overbar(forms.canonicalSop)}</span>
		</p>
		<p class="dim">
			{#if count === 0}
				No rows are 1, so no gates at all: the output is always 0.
			{:else}
				{count} AND {count === 1 ? 'gate' : 'gates'} with {variables.length} inputs{count > 1
					? ` each, feeding one OR gate with ${count} inputs`
					: ', and no OR gate needed'}.
			{/if}
		</p>
		<p>
			<span class="label">The same function, minimised</span>
			<span class="mono">{overbar(forms.minimalSop)}</span>
			<span class="dim"
				>({forms.sopTermCount} {forms.sopTermCount === 1 ? 'term' : 'terms'}; how, later in this stage)</span
			>
		</p>
	</div>
</div>

<style>
	.index {
		color: #888;
		font-size: 0.85rem;
	}

	.out-cell {
		padding-top: 0.2rem;
		padding-bottom: 0.2rem;
	}

	.out-cell .toggle {
		min-width: 2.4rem;
		padding: 0.25rem 0.5rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 600;
	}

	.term {
		white-space: nowrap;
	}

	.readout {
		margin-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		padding-top: 0.7rem;
	}

	.readout p {
		margin: 0 0 0.45rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.7rem;
		align-items: baseline;
	}

	.label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.result {
		color: #8ede8e;
	}

	.dim {
		color: #999;
		font-size: 0.85rem;
	}
</style>
