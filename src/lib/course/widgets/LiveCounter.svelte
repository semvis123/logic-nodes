<script lang="ts">
	// A binary counter to clock by hand: four bit lamps, the decimal value, and
	// a timing diagram that grows a column per press. The sequence and the
	// waveforms come from the counter generators, so the widget agrees with the
	// counters page for any modulus.
	import { afterUpdate } from 'svelte';
	import { bitsOf, countSequence, counterWaveforms } from '$lib/sequential';
	import { clockSignal, timingAlt, timingToSvg } from '$lib/timing';

	export let width = 4;
	export let modulus = 16;
	export let label = '';

	const LIMIT = 40;

	let clocks = 0;
	let scroller: HTMLDivElement | undefined;

	$: title = label || `A ${width} bit counter that wraps at ${modulus}. Press the clock.`;
	$: sequence = countSequence(width, clocks + 1, modulus);
	$: count = sequence[clocks];
	// Most significant bit first, which is the order the lamps are read in.
	$: bits = bitsOf(count, width).reverse();
	$: signals = [clockSignal(clocks + 1), ...counterWaveforms(width, clocks + 1, modulus)];
	$: svg = timingToSvg(signals, { showEdges: true, showCycles: true });
	$: alt = timingAlt(signals);
	$: full = clocks >= LIMIT;

	const clock = () => {
		if (!full) clocks += 1;
	};
	const reset = () => {
		clocks = 0;
	};

	// Keep the newest cycle in view as the diagram grows.
	afterUpdate(() => {
		if (scroller) scroller.scrollLeft = scroller.scrollWidth;
	});
</script>

<div class="widget live-counter">
	<p class="widget-title">{title}</p>
	<div class="controls">
		<button type="button" class="clock" on:click={clock} disabled={full}>Clock</button>
		<button type="button" class="reset" on:click={reset} disabled={clocks === 0}>Reset</button>
		<span class="clocks">{clocks} {clocks === 1 ? 'clock' : 'clocks'} so far</span>
	</div>
	<div class="readout" aria-live="polite">
		<span class="bits" role="group" aria-label="Counter bits, most significant first">
			{#each bits as bit, i}
				<span class="stage">
					<span class="lamp" class:on={bit === 1} />
					<span class="name mono">Q{width - 1 - i}</span>
					<span class="bit mono">{bit}</span>
				</span>
			{/each}
		</span>
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out on"><span class="val">{count}</span></span>
	</div>
	<p class="sequence mono" aria-live="polite">{sequence.join(', ')}</p>
	<div class="timing-scroll" role="img" aria-label="Timing diagram of the counter so far. {alt}" bind:this={scroller}>
		{@html svg}
	</div>
	{#if full}
		<p class="note">That is {LIMIT} clocks. Press reset to start again.</p>
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

	.clocks {
		color: #aaa;
		font-size: 0.85rem;
	}

	.readout {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 0.9rem;
	}

	.bits {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.stage {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background-color: #222;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.35rem 0.5rem;
	}

	.name {
		color: #bbb;
		font-size: 0.8rem;
	}

	.bit {
		font-weight: 600;
	}

	.sequence {
		margin: 0.7rem 0 0.5rem;
		color: #ddd;
		font-size: 0.9rem;
		word-break: break-word;
	}

	.timing-scroll {
		overflow-x: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		background: #1d1e20;
	}

	.timing-scroll :global(svg) {
		display: block;
	}

	.note {
		margin: 0.5rem 0 0;
		color: #aaa;
		font-size: 0.85rem;
	}
</style>
