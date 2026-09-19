<script lang="ts">
	// One gate to play with: its symbol with the wires coloured by their state,
	// a toggle per input, and its truth table with the current row lit.
	import GateSymbol from '$lib/GateSymbol.svelte';
	import { gateBySlug } from '$lib/gates';

	export let gate: 'and' | 'or' | 'not' | 'xor' | 'nand' | 'nor' | 'xnor';
	export let table = true;

	const expressions = {
		and: (a: boolean, b: boolean) => a && b,
		or: (a: boolean, b: boolean) => a || b,
		not: (a: boolean) => !a,
		xor: (a: boolean, b: boolean) => a !== b,
		nand: (a: boolean, b: boolean) => !(a && b),
		nor: (a: boolean, b: boolean) => !(a || b),
		xnor: (a: boolean, b: boolean) => a === b
	};

	$: info = gateBySlug(gate);
	$: inputs = gate === 'not' ? ['a'] : ['a', 'b'];
	let a = false;
	let b = false;
	$: output = gate === 'not' ? expressions.not(a) : expressions[gate](a, b);
	$: row = gate === 'not' ? (a ? 1 : 0) : (a ? 2 : 0) + (b ? 1 : 0);
	$: rows = Array.from({ length: 1 << inputs.length }, (_, i) =>
		gate === 'not' ? expressions.not(!!(i & 1)) : expressions[gate](!!(i & 2), !!(i & 1))
	);
</script>

<div class="widget live-gate">
	<p class="widget-title">{info?.name ?? gate.toUpperCase()} gate. Click the inputs.</p>
	<div class="controls">
		<div class="toggles">
			<button type="button" class="toggle" class:on={a} aria-pressed={a} on:click={() => (a = !a)}>
				a <span class="val">{a ? 1 : 0}</span>
			</button>
			{#if inputs.length === 2}
				<button type="button" class="toggle" class:on={b} aria-pressed={b} on:click={() => (b = !b)}>
					b <span class="val">{b ? 1 : 0}</span>
				</button>
			{/if}
		</div>
		<div class="symbol-box">
			<GateSymbol {gate} inputStates={inputs.length === 2 ? [a, b] : [a]} outputState={output} />
		</div>
		<span class="out" class:on={output} aria-live="polite">out <span class="val">{output ? 1 : 0}</span></span>
	</div>
	{#if table}
		<div class="table-wrap">
			<table class="data-table live-table">
				<thead>
					<tr>
						{#each inputs as v}<th scope="col" class="mono">{v}</th>{/each}
						<th scope="col" class="mono">out</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as value, i}
						<tr class:current={i === row}>
							{#each inputs as _, bit}
								{@const on = !!(i & (1 << (inputs.length - 1 - bit)))}
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
		gap: 10px;
	}

	.toggles {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.symbol-box {
		width: 110px;
	}

	.symbol-box :global(svg) {
		width: 100%;
		height: auto;
		display: block;
	}

	.live-table {
		margin-top: 0.8rem;
	}

	.live-table tr.current td {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}
</style>
