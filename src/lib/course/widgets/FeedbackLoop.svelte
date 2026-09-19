<script lang="ts">
	// An OR gate whose output is wired back into one of its own inputs: the
	// smallest circuit with state, and a one-way one. The output is recomputed
	// from the OR rule every time something changes; nothing is looked up. Once
	// a 1 is going round the loop the gate sees a 1 whatever the set input does,
	// so the only way back to 0 is to rebuild the circuit.
	import { shapes, inputYs } from '$lib/symbols';

	export let label = 'An OR gate fed back into itself. Press set, then release it.';

	const or = (a: boolean, b: boolean) => a || b;
	const shape = shapes.or;
	const ys = inputYs(2);

	let set = false;
	/** The output, which is also the gate's second input. */
	let q = false;
	let trace: { set: boolean; back: boolean; out: boolean }[] = [];

	function apply() {
		const back = q;
		q = or(set, back);
		trace = [...trace.slice(-5), { set, back, out: q }];
	}

	function toggleSet() {
		set = !set;
		apply();
	}

	function rebuild() {
		set = false;
		q = false;
		trace = [];
	}

	const colour = (on: boolean) => (on ? '#5db65d' : '#f23');
</script>

<div class="widget feedback-loop">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="toggle" class:on={set} aria-pressed={set} on:click={toggleSet}>
			set <span class="val">{set ? 1 : 0}</span>
		</button>
		<span class="out" class:on={q} aria-live="polite">out <span class="val">{q ? 1 : 0}</span></span>
		<button type="button" class="link-btn" on:click={rebuild}>Rebuild the circuit</button>
	</div>

	<svg
		viewBox="0 0 220 96"
		class="diagram"
		role="img"
		aria-label="An OR gate with its output looped back to its second input"
	>
		<!-- set wire into the top input -->
		<line x1="12" y1={12 + ys[0]} x2={62 + shape.leadIn} y2={12 + ys[0]} stroke={colour(set)} stroke-width="2" />
		<text x="8" y={12 + ys[0] - 5} fill="#bbb" font-size="10" font-family="ui-monospace, Menlo, monospace">set</text>
		<!-- the fed-back wire: out, down, round and into the bottom input -->
		<path
			d={`M168 37 V84 H36 V${12 + ys[1]} H${62 + shape.leadIn}`}
			fill="none"
			stroke={colour(q)}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<text x="44" y="80" fill="#bbb" font-size="10" font-family="ui-monospace, Menlo, monospace">fed back</text>
		<!-- the OR gate itself -->
		<g transform="translate(62 12)">
			<path d={shape.body} fill="#161618" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
			<line x1={shape.leadOut} y1="25" x2="70" y2="25" stroke={colour(q)} stroke-width="2" />
		</g>
		<!-- output wire and lamp -->
		<line x1="132" y1="37" x2="196" y2="37" stroke={colour(q)} stroke-width="2" />
		<circle cx="204" cy="37" r="7" fill={colour(q)} stroke="rgba(255,255,255,0.6)" stroke-width="1" />
		<text x="176" y="30" fill="#bbb" font-size="10" font-family="ui-monospace, Menlo, monospace">out</text>
	</svg>

	<p class="reading" aria-live="polite">
		{#if !q}
			Both inputs of the OR are 0, so the output is 0 and the fed-back wire carries a 0. Nothing is happening.
		{:else if set}
			set is 1, so the OR outputs 1. That 1 is now travelling back round into the second input.
		{:else}
			set is back to 0, but the fed-back input is still 1, and an OR with any input at 1 outputs 1. The loop is holding
			itself on.
		{/if}
	</p>

	{#if trace.length}
		<div class="table-wrap">
			<table class="data-table trace">
				<thead>
					<tr>
						<th scope="col" class="mono">set</th>
						<th scope="col" class="mono">fed back</th>
						<th scope="col" class="mono">out</th>
					</tr>
				</thead>
				<tbody>
					{#each trace as step}
						<tr>
							<td class={step.set ? 'bit-1' : 'bit-0'}>{step.set ? 1 : 0}</td>
							<td class={step.back ? 'bit-1' : 'bit-0'}>{step.back ? 1 : 0}</td>
							<td class={step.out ? 'bit-1' : 'bit-0'}>{step.out ? 1 : 0}</td>
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

	.diagram {
		display: block;
		width: 100%;
		max-width: 330px;
		height: auto;
		margin: 0.8rem 0 0.4rem;
	}

	.reading {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.trace {
		margin-top: 0.7rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: #8ede8e;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.4rem 0;
		text-decoration: underline;
	}
</style>
