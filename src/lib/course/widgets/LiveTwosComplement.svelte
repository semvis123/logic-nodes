<script lang="ts">
	// One clickable pattern read two ways, unsigned and two's complement, with
	// the top bit's negative weight shown, and a negate button that walks the
	// two steps, invert and add 1. The readings come from representations() and
	// the steps from negate(), both in $lib/twosComplement.
	import { representations, negate, type Negation } from '$lib/twosComplement';
	import { fromBits } from '$lib/numbers';

	export let width: 4 | 8 = 4;
	export let value = 5;
	export let label = 'The same bits, two readings. Click a bit, or negate the number.';

	$: mask = (1 << width) - 1;
	$: table = representations(width);
	$: reading = table[value & mask];
	$: weights = Array.from({ length: width }, (_, i) => (i === 0 ? -(2 ** (width - 1)) : 2 ** (width - 1 - i)));

	let steps: Negation | null = null;

	const flip = (i: number) => {
		value ^= 1 << (width - 1 - i);
		steps = null;
	};
	const doNegate = () => {
		steps = negate(reading.twosComplement, width);
		value = fromBits(steps.result);
	};
	const setWidth = (w: 4 | 8) => {
		width = w;
		value &= (1 << w) - 1;
		steps = null;
	};
	const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));
</script>

<div class="widget live-twos">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<div class="bits" role="group" aria-label="Bits, most significant first">
			{#each reading.bits as bit, i}
				<button
					type="button"
					class="bit"
					class:on={bit === 1}
					class:sign={i === 0}
					aria-pressed={bit === 1}
					aria-label="bit {width - 1 - i}, worth {weights[i]}"
					on:click={() => flip(i)}
				>
					<span class="bit-value">{bit}</span>
					<span class="weight">{signed(weights[i])}</span>
				</button>
			{/each}
		</div>
		<div class="buttons">
			<button type="button" class="toggle" on:click={doNegate}>Negate</button>
			<span class="widths" role="group" aria-label="Width">
				<button
					type="button"
					class="toggle"
					class:on={width === 4}
					aria-pressed={width === 4}
					on:click={() => setWidth(4)}
				>
					4 bits
				</button>
				<button
					type="button"
					class="toggle"
					class:on={width === 8}
					aria-pressed={width === 8}
					on:click={() => setWidth(8)}
				>
					8 bits
				</button>
			</span>
		</div>
	</div>
	<p class="reading" aria-live="polite">
		<span class="mono">{reading.pattern}</span> is <strong>{reading.unsigned}</strong> read as unsigned, and
		<strong>{signed(reading.twosComplement)}</strong> read as two's complement.
	</p>
	{#if steps}
		<div class="steps mono" aria-live="polite">
			<p>Negating {signed(steps.value)}:</p>
			<ol>
				<li>start with <span class="pattern">{steps.original.join('')}</span> ({signed(steps.value)})</li>
				<li>invert every bit: <span class="pattern">{steps.inverted.join('')}</span></li>
				<li>
					add 1: <span class="pattern">{steps.result.join('')}</span>, which reads as {signed(steps.reading)}
				</li>
			</ol>
			{#if !steps.fits}
				<p class="note">
					{signed(steps.value)} has no opposite in {width} bits: the range stops at {signed(-steps.value - 1)}, so the
					steps give the same pattern back.
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}

	.bits {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.bit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		min-width: 2.3rem;
		padding: 0.35rem 0.3rem;
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.6);
		border-radius: 3px;
		color: #fff;
		cursor: pointer;
		font: inherit;
	}

	.bit.on {
		background-color: #372;
	}

	.bit.sign {
		border-color: #e2b93b;
	}

	.bit-value {
		font: 600 1.2rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.weight {
		font-size: 0.7rem;
		color: #fff;
	}

	.buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}

	.widths {
		display: inline-flex;
		gap: 4px;
	}

	.reading {
		margin: 0.7rem 0 0;
		color: #ddd;
	}

	.steps {
		margin-top: 0.6rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
	}

	.steps p {
		margin: 0 0 0.3rem;
	}

	.steps ol {
		margin: 0;
		padding-left: 1.3rem;
	}

	.pattern {
		font-weight: 600;
		color: #fff;
	}

	.note {
		margin-top: 0.4rem !important;
		color: #e2b93b;
	}
</style>
