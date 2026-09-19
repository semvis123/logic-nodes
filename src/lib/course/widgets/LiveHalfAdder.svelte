<script lang="ts">
	// Two bits in, a sum and a carry out: the half adder, with its four-row
	// table lit at the current row. Both outputs are the expressions the common
	// circuits reference lists, evaluated by the engine, so the widget cannot
	// disagree with the reference card.
	import { parseExpression, evaluate } from '$lib/boolean';
	import { circuitBySlug } from '$lib/commonCircuits';

	export let label = 'The half adder. Click a and b.';

	const outputs = circuitBySlug('half-adder')?.outputs ?? [];
	const expressionOf = (name: string) => {
		const output = outputs.find((o) => o.name === name);
		if (!output) throw new Error(`The half adder reference has no ${name} output`);
		return parseExpression(output.expression);
	};
	const sumAst = expressionOf('sum');
	const carryAst = expressionOf('carry');
	const compute = (a: boolean, b: boolean) => ({
		sum: evaluate(sumAst, { a, b }),
		carry: evaluate(carryAst, { a, b })
	});
	const rows = Array.from({ length: 4 }, (_, i) => ({ a: !!(i & 2), b: !!(i & 1), ...compute(!!(i & 2), !!(i & 1)) }));

	let a = false;
	let b = false;
	$: out = compute(a, b);
	$: row = (a ? 2 : 0) + (b ? 1 : 0);
	$: total = (a ? 1 : 0) + (b ? 1 : 0);
</script>

<div class="widget live-half-adder">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="toggle" class:on={a} aria-pressed={a} on:click={() => (a = !a)}>
			a <span class="val">{a ? 1 : 0}</span>
		</button>
		<button type="button" class="toggle" class:on={b} aria-pressed={b} on:click={() => (b = !b)}>
			b <span class="val">{b ? 1 : 0}</span>
		</button>
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out" class:on={out.sum}>
			<span class="lamp" class:on={out.sum} aria-hidden="true" /> sum <span class="val">{out.sum ? 1 : 0}</span>
		</span>
		<span class="out" class:on={out.carry}>
			<span class="lamp" class:on={out.carry} aria-hidden="true" /> carry <span class="val">{out.carry ? 1 : 0}</span>
		</span>
	</div>
	<p class="reading" aria-live="polite">
		{a ? 1 : 0} + {b ? 1 : 0} = {total}, which in binary is
		<strong class="mono">{out.carry ? 1 : 0}{out.sum ? 1 : 0}</strong>: carry {out.carry ? 1 : 0}, sum {out.sum
			? 1
			: 0}.
	</p>
	<div class="table-wrap">
		<table class="data-table live-table">
			<thead>
				<tr>
					<th scope="col" class="mono">a</th>
					<th scope="col" class="mono">b</th>
					<th scope="col" class="mono">sum</th>
					<th scope="col" class="mono">carry</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r, i}
					<tr class:current={i === row}>
						<td class={r.a ? 'bit-1' : 'bit-0'}>{r.a ? 1 : 0}</td>
						<td class={r.b ? 'bit-1' : 'bit-0'}>{r.b ? 1 : 0}</td>
						<td class={r.sum ? 'bit-1' : 'bit-0'}>{r.sum ? 1 : 0}</td>
						<td class={r.carry ? 'bit-1' : 'bit-0'}>{r.carry ? 1 : 0}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.reading {
		margin: 0.7rem 0 0;
		color: #ddd;
	}

	.live-table {
		margin-top: 0.8rem;
	}

	.live-table tr.current td {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}
</style>
