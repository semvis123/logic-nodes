<script lang="ts">
	// One flip-flop to clock by hand. The inputs are toggles, the clock is a
	// button, and the timing diagram grows with every edge. Q is not tracked
	// here at all: it is recomputed from the whole input history by the same
	// simulateClocked that draws the reference pages, so the lamp, the diagram
	// and the table can never disagree.
	import { flipFlopBySlug } from '$lib/flipflops';
	import { evaluate, parseExpression } from '$lib/boolean';
	import { clockSignal, simulateClocked, timingToSvg, timingAlt, type Level, type Signal } from '$lib/timing';

	export let kind: 'd' | 't' | 'jk' | 'sr' = 'd';
	export let table = true;
	export let label = '';

	const ff = flipFlopBySlug(kind)!;
	const equation = parseExpression(ff.equation);
	const SHOWN = 8;

	let pins: Record<string, boolean> = Object.fromEntries(ff.inputs.map((name) => [name, false]));
	/** The inputs that were present at each clock edge so far. */
	let history: boolean[][] = [];

	$: forbidden = kind === 'sr' && pins.s && pins.r;
	// Every clocked column, then the column that is happening now.
	$: columns = [...history, ff.inputs.map((name) => pins[name])];
	$: inputSignals = ff.inputs.map(
		(name, i): Signal => ({
			name: name.toUpperCase(),
			bits: columns.map((column) => (column[i] ? 1 : 0) as Level),
			coloured: true
		})
	);
	$: qSignal = simulateClocked(ff.equation, inputSignals, { initial: 0 });
	$: q = qSignal.bits[qSignal.bits.length - 1] === 1;
	$: next = forbidden ? null : evaluate(equation, { ...pins, q });

	// The picture shows the last few cycles; the state in its first column is
	// still right because the simulation ran over the whole history.
	$: start = Math.max(0, columns.length - SHOWN);
	$: windowed = [
		clockSignal(columns.length - start),
		...inputSignals.map((signal) => ({ ...signal, bits: signal.bits.slice(start) })),
		{ ...qSignal, bits: qSignal.bits.slice(start) }
	];
	$: svg = timingToSvg(windowed, { showEdges: true, showCycles: false });
	$: alt = timingAlt(windowed);

	$: rowIndex = ff.characteristic.findIndex(
		(row) => row.inputs.every((bit, i) => bit === (pins[ff.inputs[i]] ? '1' : '0')) && row.q === (q ? '1' : '0')
	);
	$: recent = history.slice(-4).map((inputs, i) => {
		const at = history.length - history.slice(-4).length + i;
		return { inputs, from: qSignal.bits[at], to: qSignal.bits[at + 1] };
	});

	function tick() {
		if (forbidden) return;
		history = [...history, ff.inputs.map((name) => pins[name])];
	}

	function clear() {
		history = [];
	}
</script>

<div class="widget live-flip-flop">
	<p class="widget-title">
		{label || `${ff.shortName} flip-flop. Set the inputs, then clock it.`}
		<span class="eq mono">{ff.equationText}</span>
	</p>
	<div class="controls">
		{#each ff.inputs as name}
			<button
				type="button"
				class="toggle"
				class:on={pins[name]}
				aria-pressed={pins[name]}
				on:click={() => (pins = { ...pins, [name]: !pins[name] })}
			>
				{name.toUpperCase()} <span class="val">{pins[name] ? 1 : 0}</span>
			</button>
		{/each}
		<button type="button" class="clock" on:click={tick} disabled={forbidden}>Clock ▸</button>
		<span class="out" class:on={q} aria-live="polite">Q <span class="val">{q ? 1 : 0}</span></span>
		<span class="next" aria-live="polite">
			{#if forbidden}
				<span class="warn">S = R = 1 is not allowed</span>
			{:else}
				after the next edge: <span class="mono">{next ? 1 : 0}</span>
			{/if}
		</span>
	</div>

	<div class="scroll" role="img" aria-label="Timing diagram for the {ff.shortName} flip-flop. {alt}">
		{@html svg}
	</div>
	<p class="caption">
		Each column is one clock cycle and each dashed line a rising edge. The column on the right is now: what the inputs
		are, and what Q is. Press the clock and the edge takes those inputs and Q moves in the next column.
		{#if history.length}
			<button type="button" class="link-btn" on:click={clear}>Start again</button>
		{/if}
	</p>

	{#if recent.length}
		<ol class="history">
			{#each recent as step}
				<li>
					<span class="mono">{ff.inputs.map((n, i) => `${n.toUpperCase()}=${step.inputs[i] ? 1 : 0}`).join(' ')}</span>
					<span class="move">Q {step.from} → {step.to}</span>
				</li>
			{/each}
		</ol>
	{/if}

	{#if table}
		<div class="table-wrap">
			<table class="data-table char">
				<thead>
					<tr>
						{#each ff.inputs as name}
							<th scope="col" class="mono">{name.toUpperCase()}</th>
						{/each}
						<th scope="col" class="mono">Q</th>
						<th scope="col" class="mono">Q⁺</th>
						<th scope="col">effect</th>
					</tr>
				</thead>
				<tbody>
					{#each ff.characteristic as row, i}
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
	.eq {
		display: block;
		color: #8ede8e;
		font-size: 0.85rem;
		margin-top: 0.2rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.clock {
		background-color: #1d1e20;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
	}

	.clock:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.next {
		color: #bbb;
		font-size: 0.85rem;
	}

	.warn {
		color: #f23;
	}

	.scroll {
		overflow-x: auto;
		margin: 0.8rem 0 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		background: #1d1e20;
	}

	.scroll :global(svg) {
		display: block;
	}

	.caption {
		color: #999;
		font-size: 0.85rem;
		margin: 0 0 0.4rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: #8ede8e;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.history {
		list-style: none;
		padding: 0;
		margin: 0.4rem 0;
		color: #ddd;
		font-size: 0.85rem;
	}

	.history li {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.15rem;
	}

	.move {
		color: #999;
	}

	.char {
		margin-top: 0.6rem;
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
