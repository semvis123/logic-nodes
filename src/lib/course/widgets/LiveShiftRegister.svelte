<script lang="ts">
	// Four D flip-flops in a row on one clock. The reader sets the bit at the
	// input, presses the clock and watches the bit walk along the stages. The
	// stage values come from the same generator as the shift register page, so
	// the widget cannot disagree with it.
	import { shiftRegisterStages } from '$lib/sequential';
	import type { Level } from '$lib/timing';

	export let width = 4;
	export let label = 'A four bit shift register. Set the input bit, then press the clock.';

	const LIMIT = 12;

	let dataIn: Level = 1;
	let history: Level[] = [];

	// Stage k holds what the input was k+1 clocks ago. The generator gives one
	// column per cycle, so the cycle after the last click is found by appending
	// the bit that is waiting at the input and has not been clocked in yet.
	$: traces = shiftRegisterStages([...history, dataIn], width);
	$: stages = traces.map((trace) => trace.bits[history.length]);
	$: rows = history.map((bit, i) => ({ clock: i + 1, input: bit, stages: traces.map((t) => t.bits[i + 1]) }));
	$: pattern = [...stages].reverse().join('');
	$: value = parseInt(pattern, 2);
	$: full = history.length >= LIMIT;

	const clock = () => {
		if (!full) history = [...history, dataIn];
	};
	const reset = () => {
		history = [];
	};
</script>

<div class="widget live-shift-register">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button
			type="button"
			class="toggle"
			class:on={dataIn === 1}
			aria-pressed={dataIn === 1}
			on:click={() => (dataIn = dataIn === 1 ? 0 : 1)}
		>
			data in <span class="val">{dataIn}</span>
		</button>
		<button type="button" class="clock" on:click={clock} disabled={full}>Clock</button>
		<button type="button" class="reset" on:click={reset} disabled={history.length === 0}>Reset</button>
	</div>
	<div class="stages" role="group" aria-label="The four stages, Q0 nearest the input" aria-live="polite">
		{#each stages as bit, k}
			{#if k > 0}<span class="arrow" aria-hidden="true">→</span>{/if}
			<span class="stage">
				<span class="lamp" class:on={bit === 1} />
				<span class="name mono">Q{k}</span>
				<span class="bit mono">{bit}</span>
			</span>
		{/each}
	</div>
	<p class="reading" aria-live="polite">
		Read as a number, Q{width - 1} first: <span class="mono">{pattern}</span> = <strong>{value}</strong>
	</p>
	{#if rows.length}
		<div class="table-wrap">
			<table class="data-table history">
				<caption>What each stage held after every clock</caption>
				<thead>
					<tr>
						<th scope="col">Clock</th>
						<th scope="col" class="mono">In</th>
						{#each traces as trace}
							<th scope="col" class="mono">{trace.name}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr>
							<td class="mono">{row.clock}</td>
							<td class={row.input === 1 ? 'bit-1' : 'bit-0'}>{row.input}</td>
							{#each row.stages as bit}
								<td class={bit === 1 ? 'bit-1' : 'bit-0'}>{bit}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if full}
			<p class="note">That is {LIMIT} clocks. Press reset to start again.</p>
		{/if}
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.clock,
	.reset {
		background-color: #222;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}

	.clock {
		border-color: #5db65d;
		color: #8ede8e;
	}

	.clock:disabled,
	.reset:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.stages {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 0.9rem;
	}

	.stage {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background-color: #222;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.35rem 0.6rem;
	}

	.name {
		color: #bbb;
		font-size: 0.8rem;
	}

	.bit {
		font-weight: 600;
	}

	.reading {
		margin: 0.7rem 0 0;
		color: #ddd;
	}

	.history {
		margin-top: 0.8rem;
	}

	.note {
		margin: 0.5rem 0 0;
		color: #aaa;
		font-size: 0.85rem;
	}
</style>
