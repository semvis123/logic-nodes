<script lang="ts">
	// The NOR SR latch as two gates the reader can watch settle. Nothing here is
	// looked up: each gate's output is recomputed from the NOR rule alone, and
	// the reference table underneath comes from $lib/latches so the two cannot
	// disagree. In step mode the reader updates one gate at a time, which makes
	// the feedback visible and turns the forbidden input's race into a choice.
	import { shapes, inputYs } from '$lib/symbols';
	import { latchBySlug } from '$lib/latches';

	export let label = 'The NOR SR latch. Click S and R; watch both outputs.';
	export let table = true;

	const nor = (a: boolean, b: boolean) => !(a || b);
	const latch = latchBySlug('nor')!;
	const shape = shapes.nor;
	const ys = inputYs(2);

	let s = false;
	let r = false;
	/** Output of the Q gate, the one that takes R. */
	let q = false;
	/** Output of the Q̄ gate, the one that takes S. */
	let qBar = true;
	let stepping = false;

	// What each gate would output right now from its own two inputs.
	$: wantQ = nor(r, qBar);
	$: wantQBar = nor(s, q);
	$: staleQ = wantQ !== q;
	$: staleQBar = wantQBar !== qBar;
	$: forbidden = s && r;
	$: rowIndex = latch.characteristic.findIndex(
		(row) => row.inputs[0] === (s ? '1' : '0') && row.inputs[1] === (r ? '1' : '0') && row.q === (q ? '1' : '0')
	);

	/**
	 * Lets the gates catch up one at a time until neither wants to change. When
	 * both are ready at once the Q gate goes first here; in a real latch it is
	 * whichever gate happens to be faster.
	 */
	function settle() {
		for (let i = 0; i < 8; i++) {
			const nextQ = nor(r, qBar);
			if (nextQ !== q) {
				q = nextQ;
				continue;
			}
			const nextQBar = nor(s, q);
			if (nextQBar !== qBar) {
				qBar = nextQBar;
				continue;
			}
			return;
		}
	}

	function toggleS() {
		s = !s;
		if (!stepping) settle();
	}

	function toggleR() {
		r = !r;
		if (!stepping) settle();
	}

	function toggleStepping() {
		stepping = !stepping;
		if (!stepping) settle();
	}

	const updateQ = () => (q = wantQ);
	const updateQBar = () => (qBar = wantQBar);

	const colour = (on: boolean) => (on ? '#5db65d' : '#f23');
	const mono = 'ui-monospace, Menlo, monospace';
</script>

<div class="widget live-latch">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="toggle" class:on={s} aria-pressed={s} on:click={toggleS}>
			S <span class="val">{s ? 1 : 0}</span>
		</button>
		<button type="button" class="toggle" class:on={r} aria-pressed={r} on:click={toggleR}>
			R <span class="val">{r ? 1 : 0}</span>
		</button>
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out" class:on={q} aria-live="polite">Q <span class="val">{q ? 1 : 0}</span></span>
		<span class="out" class:on={qBar} aria-live="polite">Q̄ <span class="val">{qBar ? 1 : 0}</span></span>
		<button type="button" class="mode" class:on={stepping} aria-pressed={stepping} on:click={toggleStepping}>
			Step gate by gate
		</button>
	</div>

	<svg
		viewBox="0 0 250 160"
		class="diagram"
		role="img"
		aria-label="Two NOR gates, the output of each wired into an input of the other"
	>
		<!-- R into the top gate's first pin -->
		<line x1="14" y1={12 + ys[0]} x2={80 + shape.leadIn} y2={12 + ys[0]} stroke={colour(r)} stroke-width="2" />
		<text x="8" y={12 + ys[0] - 5} fill="#bbb" font-size="10" font-family={mono}>R</text>
		<!-- S into the bottom gate's second pin -->
		<line x1="14" y1={96 + ys[1]} x2={80 + shape.leadIn} y2={96 + ys[1]} stroke={colour(s)} stroke-width="2" />
		<text x="8" y={96 + ys[1] + 14} fill="#bbb" font-size="10" font-family={mono}>S</text>
		<!-- Q: out of the top gate, round and into the bottom gate's first pin -->
		<path
			d={`M${80 + shape.leadOut} 37 H196 V72 H60 V${96 + ys[0]} H${80 + shape.leadIn}`}
			fill="none"
			stroke={colour(q)}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<!-- Q̄: out of the bottom gate, round and into the top gate's second pin -->
		<path
			d={`M${80 + shape.leadOut} 121 H206 V84 H50 V${12 + ys[1]} H${80 + shape.leadIn}`}
			fill="none"
			stroke={colour(qBar)}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<!-- the two gates -->
		<g transform="translate(80 12)">
			{#if stepping && staleQ}
				<rect
					x="2"
					y="-2"
					width="66"
					height="54"
					fill="none"
					stroke="#e2b93b"
					stroke-width="1.5"
					stroke-dasharray="4 3"
				/>
			{/if}
			<path d={shape.body} fill="#161618" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
			<circle cx={shape.bubble} cy="25" r="4" fill="#161618" stroke="#fff" stroke-width="2" />
			<text x="30" y="29" text-anchor="middle" fill="#bbb" font-size="9" font-family={mono}>Q gate</text>
		</g>
		<g transform="translate(80 96)">
			{#if stepping && staleQBar}
				<rect
					x="2"
					y="-2"
					width="66"
					height="54"
					fill="none"
					stroke="#e2b93b"
					stroke-width="1.5"
					stroke-dasharray="4 3"
				/>
			{/if}
			<path d={shape.body} fill="#161618" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
			<circle cx={shape.bubble} cy="25" r="4" fill="#161618" stroke="#fff" stroke-width="2" />
			<text x="30" y="29" text-anchor="middle" fill="#bbb" font-size="9" font-family={mono}>Q̄ gate</text>
		</g>
		<!-- output lamps -->
		<line x1="196" y1="37" x2="219" y2="37" stroke={colour(q)} stroke-width="2" />
		<line x1="206" y1="121" x2="219" y2="121" stroke={colour(qBar)} stroke-width="2" />
		<circle cx="226" cy="37" r="7" fill={colour(q)} stroke="rgba(255,255,255,0.6)" stroke-width="1" />
		<text x="236" y="41" fill="#bbb" font-size="10" font-family={mono}>Q</text>
		<circle cx="226" cy="121" r="7" fill={colour(qBar)} stroke="rgba(255,255,255,0.6)" stroke-width="1" />
		<text x="236" y="125" fill="#bbb" font-size="10" font-family={mono}>Q̄</text>
	</svg>

	{#if stepping}
		<div class="steps">
			<p class="gate-line">
				Q gate sees R = <span class="mono">{r ? 1 : 0}</span> and Q̄ = <span class="mono">{qBar ? 1 : 0}</span>, so it
				wants <span class="mono">{wantQ ? 1 : 0}</span>.
				<button type="button" class="toggle small" disabled={!staleQ} on:click={updateQ}>Update Q gate</button>
			</p>
			<p class="gate-line">
				Q̄ gate sees S = <span class="mono">{s ? 1 : 0}</span> and Q = <span class="mono">{q ? 1 : 0}</span>, so it wants
				<span class="mono">{wantQBar ? 1 : 0}</span>.
				<button type="button" class="toggle small" disabled={!staleQBar} on:click={updateQBar}>Update Q̄ gate</button>
			</p>
		</div>
	{/if}

	<p class="reading" aria-live="polite">
		{#if forbidden}
			S and R are both 1. Each gate has a 1 on an input, so both output 0: Q and Q̄ are both 0 and no longer opposites.
			This is the forbidden input. Now release both together and see which gate wins.
		{:else if stepping && staleQ && staleQBar}
			Both gates want to change. Whichever you update first wins and holds the other down. In a real latch that is
			decided by which gate happens to be a fraction faster, which is why the result is not predictable.
		{:else if stepping && (staleQ || staleQBar)}
			One gate has not caught up yet. Update it and see whether the other one then wants to change too.
		{:else if s && !r}
			S is 1: the Q̄ gate is forced to 0, the Q gate sees two 0s and outputs 1. Set.
		{:else if r && !s}
			R is 1: the Q gate is forced to 0, the Q̄ gate sees two 0s and outputs 1. Reset.
		{:else}
			S and R are both 0. Each gate is held where it is by the other's output. Hold: Q stays at {q ? 1 : 0}.
		{/if}
	</p>

	{#if table}
		<div class="table-wrap">
			<table class="data-table char">
				<thead>
					<tr>
						<th scope="col" class="mono">S</th>
						<th scope="col" class="mono">R</th>
						<th scope="col" class="mono">Q</th>
						<th scope="col" class="mono">Q⁺</th>
						<th scope="col">effect</th>
					</tr>
				</thead>
				<tbody>
					{#each latch.characteristic as row, i}
						<tr class:current={i === rowIndex} class:invalid={row.next === 'invalid'}>
							{#each row.inputs as bit}
								<td class={bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
							{/each}
							<td class={row.q === '1' ? 'bit-1' : 'bit-0'}>{row.q}</td>
							<td class={row.next === 'invalid' ? 'bit-x' : row.next === '1' ? 'bit-1' : 'bit-0'}>
								{row.next === 'invalid' ? '—' : row.next}
							</td>
							<td class="effect">{row.note}</td>
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

	.mode {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		color: #ddd;
		font: inherit;
		font-size: 0.8rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}

	.mode.on {
		border-color: #e2b93b;
		color: #e2b93b;
	}

	.diagram {
		display: block;
		width: 100%;
		max-width: 360px;
		height: auto;
		margin: 0.8rem 0 0.4rem;
	}

	.steps {
		margin: 0.4rem 0;
	}

	.gate-line {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0 0 0.4rem;
	}

	.small {
		font-size: 0.78rem !important;
		padding: 0.25rem 0.5rem !important;
		margin-left: 0.4rem;
	}

	.small:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.reading {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.char {
		margin-top: 0.8rem;
	}

	.char tr.current td {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}

	.char tr.invalid td {
		opacity: 0.6;
	}

	.effect {
		color: #999;
		font-size: 0.85rem;
	}
</style>
