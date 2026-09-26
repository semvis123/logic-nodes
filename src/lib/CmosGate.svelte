<script lang="ts">
	// The gate as CMOS transistors: toggle the inputs and the transistors that
	// are switched on light up, with a sentence per stage saying which network
	// conducts. Everything shown comes from the series and parallel structure in
	// cmos.ts, which the tests check against the gate's truth table.
	import { cmosFor, cmosDrawing, simulate, describe, transistorCount } from '$lib/cmos';

	/** The gate slug: and, or, not, nand, nor, xor or xnor. */
	export let gate: string;

	$: cmos = cmosFor(gate);
	$: drawing = cmos ? cmosDrawing(cmos) : null;
	$: count = cmos ? transistorCount(cmos) : 0;
	$: primary = gate === 'not' ? ['a'] : ['a', 'b'];

	let values: Record<string, boolean> = { a: false, b: false };
	$: inputs = Object.fromEntries(primary.map((name) => [name, values[name]]));
	$: state = cmos ? simulate(cmos, inputs) : null;
	$: sentences = cmos ? describe(cmos, inputs) : [];
	$: on = new Set((drawing?.fets ?? []).filter((f) => state && state.values[f.input] !== f.pmos).map((f) => f.id));

	const toggle = (name: string) => (values = { ...values, [name]: !values[name] });
</script>

{#if cmos && drawing && state}
	<div class="cmos">
		<div class="controls">
			{#each primary as name}
				<button
					type="button"
					class="toggle"
					class:high={values[name]}
					aria-pressed={values[name]}
					on:click={() => toggle(name)}
				>
					<span class="mono">{name}</span> = {values[name] ? 1 : 0}
				</button>
			{/each}
			<span class="out" class:high={state.output}>
				<span class="mono">Y</span> = {state.output ? 1 : 0}
			</span>
			<span class="count">{count} transistors</span>
		</div>
		<div class="scroll">
			<svg
				class="drawing"
				viewBox="0 0 {drawing.width} {drawing.height}"
				style="max-width: {Math.round(drawing.width * 1.25)}px; min-width: {Math.round(drawing.width * 0.72)}px"
				role="img"
				aria-label="CMOS {gate.toUpperCase()} gate, {count} transistors. {cmos.summary}"
			>
				{#each drawing.prims as p}
					{#if p.k === 'line'}
						<line
							x1={p.x1}
							y1={p.y1}
							x2={p.x2}
							y2={p.y2}
							class={p.role}
							class:on={p.fet !== undefined && on.has(p.fet)}
						/>
					{:else if p.k === 'circle'}
						<circle cx={p.cx} cy={p.cy} r={p.r} class={p.role} class:on={p.fet !== undefined && on.has(p.fet)} />
					{:else if p.k === 'text'}
						<text x={p.x} y={p.y} text-anchor={p.anchor} class={p.role}>{p.text}</text>
					{/if}
				{/each}
			</svg>
		</div>
		<div class="explain" aria-live="polite">
			{#each sentences as sentence}
				<p>{sentence[0].toUpperCase() + sentence.slice(1)}</p>
			{/each}
		</div>
		<p class="summary">
			{cmos.summary} PMOS transistors, drawn with a bubble on the gate, conduct when their gate is 0; NMOS conduct when it
			is 1.
		</p>
	</div>
{/if}

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		margin-bottom: 0.8rem;
	}

	.toggle,
	.out {
		font: inherit;
		font-size: 0.9rem;
		color: #ddd;
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.3rem 0.75rem;
	}

	.toggle {
		cursor: pointer;
	}

	.toggle:hover {
		border-color: rgba(255, 255, 255, 0.7);
	}

	.toggle.high,
	.out.high {
		color: #8ede8e;
		border-color: #5db65d;
	}

	.out {
		border-style: dashed;
	}

	.count {
		color: #999;
		font-size: 0.85rem;
	}

	/* The wider schematics keep a legible size on a phone and scroll instead. */
	.scroll {
		overflow-x: auto;
	}

	.drawing {
		display: block;
		width: 100%;
		height: auto;
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
	}

	.drawing .wire,
	.drawing .rail {
		stroke: #bbb;
		stroke-width: 1.5;
	}

	.drawing .rail {
		stroke-width: 2;
	}

	.drawing .fet {
		stroke: #6a6a6a;
		stroke-width: 2;
	}

	.drawing .fet-bubble {
		fill: #161618;
		stroke: #6a6a6a;
		stroke-width: 2;
	}

	.drawing .fet.on,
	.drawing .fet-bubble.on {
		stroke: #8ede8e;
	}

	.drawing .node {
		fill: #bbb;
	}

	.drawing text {
		fill: #ddd;
		font: 14px ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.drawing .rail-label {
		fill: #999;
		font-size: 12px;
	}

	.drawing .caption {
		fill: #8ede8e;
		font-size: 13px;
		font-weight: 600;
	}

	.drawing .output {
		font-weight: 700;
	}

	.explain p {
		color: #ddd;
		margin: 0.6rem 0 0;
		max-width: 700px;
	}

	.summary {
		color: #999;
		font-size: 0.85rem;
		max-width: 700px;
	}
</style>
