<script lang="ts">
	// Three bits in, a sum and a carry out: the full adder, with its eight-row
	// table lit at the current row. The rows and the outputs both come from the
	// full adder rule in $lib/adders, the same one the ripple carry adder page
	// and the tests use.
	import { fullAdder, fullAdderRows, type Bit } from '$lib/adders';

	export let label = 'A live full adder. Click the inputs.';

	const rows = fullAdderRows();
	let a: Bit = 0;
	let b: Bit = 0;
	let cin: Bit = 0;
	$: out = fullAdder(a, b, cin);
	$: row = a * 4 + b * 2 + cin;
	$: total = a + b + cin;
	const flip = (bit: Bit): Bit => (bit ? 0 : 1);
</script>

<div class="widget live-full-adder">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="toggle" class:on={a === 1} aria-pressed={a === 1} on:click={() => (a = flip(a))}>
			a <span class="val">{a}</span>
		</button>
		<button type="button" class="toggle" class:on={b === 1} aria-pressed={b === 1} on:click={() => (b = flip(b))}>
			b <span class="val">{b}</span>
		</button>
		<button
			type="button"
			class="toggle"
			class:on={cin === 1}
			aria-pressed={cin === 1}
			on:click={() => (cin = flip(cin))}
		>
			carry in <span class="val">{cin}</span>
		</button>
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out" class:on={out.sum === 1}>
			<span class="lamp" class:on={out.sum === 1} aria-hidden="true" /> sum <span class="val">{out.sum}</span>
		</span>
		<span class="out" class:on={out.cout === 1}>
			<span class="lamp" class:on={out.cout === 1} aria-hidden="true" /> carry out <span class="val">{out.cout}</span>
		</span>
	</div>
	<p class="reading" aria-live="polite">
		{a} + {b} + {cin} = {total}, which in binary is <strong class="mono">{out.cout}{out.sum}</strong>: carry out
		{out.cout}, sum {out.sum}. {total >= 2
			? 'At least two inputs are 1, so there is a carry.'
			: 'Fewer than two inputs are 1, so no carry.'}
	</p>
	<div class="table-wrap">
		<table class="data-table live-table">
			<thead>
				<tr>
					<th scope="col" class="mono">a</th>
					<th scope="col" class="mono">b</th>
					<th scope="col" class="mono">carry in</th>
					<th scope="col" class="mono">sum</th>
					<th scope="col" class="mono">carry out</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r, i}
					<tr class:current={i === row}>
						<td class={r.a ? 'bit-1' : 'bit-0'}>{r.a}</td>
						<td class={r.b ? 'bit-1' : 'bit-0'}>{r.b}</td>
						<td class={r.cin ? 'bit-1' : 'bit-0'}>{r.cin}</td>
						<td class={r.sum ? 'bit-1' : 'bit-0'}>{r.sum}</td>
						<td class={r.cout ? 'bit-1' : 'bit-0'}>{r.cout}</td>
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
