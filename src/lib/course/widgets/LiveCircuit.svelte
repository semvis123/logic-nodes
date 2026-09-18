<script lang="ts">
	// A circuit diagram to click: the expression is laid out by the same
	// engine as the circuit diagram generator, drawn with the same renderer,
	// and every wire is coloured by its live state for the current toggles, so
	// the reader can watch a signal travel from the inputs to the output.
	import { parseExpression, evaluate, variablesOf, format } from '$lib/boolean';
	import { buildCircuit, circuitStates } from '$lib/circuit';
	import { circuitToSvg } from '$lib/exportSvg';

	export let expression: string;
	export let label = '';
	/** Optional friendlier names for the inputs, keyed by variable. */
	export let names: Record<string, string> = {};

	const ast = parseExpression(expression);
	const variables = variablesOf(ast);
	const circuit = buildCircuit(ast);
	const shown = label || `The circuit for ${format(ast, 'math')}. Click the inputs.`;

	let values: Record<string, boolean> = Object.fromEntries(variables.map((v) => [v, false]));
	$: output = evaluate(ast, values);
	$: svg = circuitToSvg(circuit, { standard: 'ansi', states: circuitStates(circuit, values) });

	const toggle = (v: string) => {
		values = { ...values, [v]: !values[v] };
	};
</script>

<div class="widget live-circuit">
	<p class="widget-title">{shown}</p>
	<div class="controls">
		{#each variables as v}
			<button type="button" class="toggle" class:on={values[v]} aria-pressed={values[v]} on:click={() => toggle(v)}>
				{names[v] ?? v} <span class="val">{values[v] ? 1 : 0}</span>
			</button>
		{/each}
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out" class:on={output} aria-live="polite">out <span class="val">{output ? 1 : 0}</span></span>
	</div>
	<figure class="diagram">
		{@html svg}
		<figcaption class="caption">Green wires carry a 1, red wires carry a 0.</figcaption>
	</figure>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.diagram {
		margin: 0.8rem 0 0;
		max-width: 520px;
	}

	.diagram :global(svg) {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 3px;
	}

	.caption {
		color: #999;
		font-size: 0.8rem;
		margin-top: 0.4rem;
	}
</style>
