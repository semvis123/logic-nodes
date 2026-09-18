<script lang="ts">
	// A 2-to-4 decoder: two input toggles and four lamps, of which exactly one
	// is lit. Each lamp is one of the four expressions in the common circuits
	// reference, evaluated by the engine.
	import { parseExpression, evaluate } from '$lib/boolean';
	import { circuitBySlug } from '$lib/commonCircuits';

	export let label = 'A 2-to-4 decoder. Click the inputs and watch which line goes high.';

	const lines = (circuitBySlug('decoder')?.outputs ?? []).map((o) => ({
		name: o.name,
		ast: parseExpression(o.expression)
	}));

	let a = false;
	let b = false;
	$: values = lines.map((line) => evaluate(line.ast, { a, b }));
	$: code = (a ? 2 : 0) + (b ? 1 : 0);
</script>

<div class="widget live-decoder">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="toggle" class:on={a} aria-pressed={a} on:click={() => (a = !a)}>
			a <span class="val">{a ? 1 : 0}</span>
		</button>
		<button type="button" class="toggle" class:on={b} aria-pressed={b} on:click={() => (b = !b)}>
			b <span class="val">{b ? 1 : 0}</span>
		</button>
		<span class="arrow" aria-hidden="true">→</span>
		{#each lines as line, i}
			<span class="out" class:on={values[i]}>
				<span class="lamp" class:on={values[i]} aria-hidden="true" />
				{line.name} <span class="val">{values[i] ? 1 : 0}</span>
			</span>
		{/each}
	</div>
	<p class="reading" aria-live="polite">
		The input reads <span class="mono">{a ? 1 : 0}{b ? 1 : 0}</span> = {code}, so line y{code} is high and the other three
		are low.
	</p>
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
</style>
