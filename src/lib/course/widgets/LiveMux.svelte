<script lang="ts">
	// A 4-to-1 multiplexer: four data toggles, two select toggles, one output.
	// It is built the way a real one can be, as a tree of three 2-to-1 muxes,
	// each evaluated from the 2-to-1 expression in the common circuits
	// reference, so the widget and the reference card agree.
	import { parseExpression, evaluate } from '$lib/boolean';
	import { circuitBySlug } from '$lib/commonCircuits';

	export let label = 'A 4-to-1 multiplexer. Set the select code, then change the inputs.';

	const reference = circuitBySlug('multiplexer');
	if (!reference) throw new Error('The multiplexer reference is missing');
	const twoToOne = parseExpression(reference.outputs[0].expression);
	/** The 2-to-1 mux: a when s is 0, b when s is 1. */
	const pass = (s: boolean, a: boolean, b: boolean) => evaluate(twoToOne, { s, a, b });

	let data = [false, false, false, false];
	let s1 = false;
	let s0 = false;
	$: low = pass(s0, data[0], data[1]);
	$: high = pass(s0, data[2], data[3]);
	$: out = pass(s1, low, high);
	$: selected = (s1 ? 2 : 0) + (s0 ? 1 : 0);

	const flip = (i: number) => {
		data = data.map((d, j) => (j === i ? !d : d));
	};
</script>

<div class="widget live-mux">
	<p class="widget-title">{label}</p>
	<div class="rows">
		<div class="row">
			<span class="caption">select</span>
			<button type="button" class="toggle" class:on={s1} aria-pressed={s1} on:click={() => (s1 = !s1)}>
				s1 <span class="val">{s1 ? 1 : 0}</span>
			</button>
			<button type="button" class="toggle" class:on={s0} aria-pressed={s0} on:click={() => (s0 = !s0)}>
				s0 <span class="val">{s0 ? 1 : 0}</span>
			</button>
			<span class="note" aria-live="polite">
				code <span class="mono">{s1 ? 1 : 0}{s0 ? 1 : 0}</span> = {selected}, so input d{selected} is passed
			</span>
		</div>
		<div class="row">
			<span class="caption">inputs</span>
			{#each data as d, i}
				<button
					type="button"
					class="toggle"
					class:on={d}
					class:chosen={i === selected}
					aria-pressed={d}
					aria-label="d{i}, {i === selected ? 'selected' : 'not selected'}"
					on:click={() => flip(i)}
				>
					d{i} <span class="val">{d ? 1 : 0}</span>
				</button>
			{/each}
		</div>
		<div class="row">
			<span class="caption">output</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="out" class:on={out} aria-live="polite">
				<span class="lamp" class:on={out} aria-hidden="true" /> out <span class="val">{out ? 1 : 0}</span>
			</span>
		</div>
	</div>
</div>

<style>
	.rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.caption {
		min-width: 3.6rem;
		color: #bbb;
		font-size: 0.85rem;
	}

	.note {
		color: #ddd;
		font-size: 0.9rem;
	}

	.toggle.chosen {
		outline: 2px solid #e2b93b;
		outline-offset: 1px;
	}
</style>
