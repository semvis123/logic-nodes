<script lang="ts">
	// Four clickable input bits driving a seven-segment digit. The bars are lit
	// by the seven minimal expressions from $lib/sevenSegment, the same ones the
	// decoder page derives, so the display shows what the circuit computes,
	// including the leftover shapes for the six codes above 9.
	import SevenSegment from '$lib/SevenSegment.svelte';
	import { segmentFunctions, litSegments, digitSegments, inputLabels } from '$lib/sevenSegment';

	export let code = 9;
	export let label = 'A seven-segment decoder. Click the input bits.';

	const functions = segmentFunctions();
	$: code &= 15;
	$: bits = Array.from({ length: 4 }, (_, i) => (code >> (3 - i)) & 1);
	$: lit = litSegments(functions, code);
	$: litList = [...lit].sort();
	/** The digit whose shape is showing, if the lit bars match one. */
	$: shown = digitSegments.indexOf(litList.join(''));

	const flip = (i: number) => {
		code ^= 1 << (3 - i);
	};
</script>

<div class="widget live-seven-segment">
	<p class="widget-title">{label}</p>
	<div class="body">
		<div class="inputs">
			<div class="bits" role="group" aria-label="Input bits, most significant first">
				{#each bits as bit, i}
					<button
						type="button"
						class="bit"
						class:on={bit === 1}
						aria-pressed={bit === 1}
						aria-label="{inputLabels[i]}, worth {2 ** (3 - i)}"
						on:click={() => flip(i)}
					>
						<span class="bit-value">{bit}</span>
						<span class="weight">{inputLabels[i]}</span>
					</button>
				{/each}
			</div>
			<p class="reading" aria-live="polite">
				Input <span class="mono">{bits.join('')}</span> = {code}.
				{#if code <= 9}
					Lit: <span class="mono">{litList.join(', ')}</span>, which draws the digit <strong>{code}</strong>.
				{:else}
					{code} is not a decimal digit, so its row was a don't care. The circuit lights
					<span class="mono">{litList.join(', ')}</span>{#if shown >= 0}, which happens to look like a {shown}{:else}, a
						shape that is no digit{/if}.
				{/if}
			</p>
		</div>
		<div class="display">
			<SevenSegment {lit} labels label="Display for input {code}" />
		</div>
	</div>
</div>

<style>
	.body {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 16px;
	}

	.inputs {
		flex: 1 1 220px;
	}

	.bits {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.bit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		min-width: 2.6rem;
		padding: 0.4rem 0.5rem;
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

	.bit-value {
		font: 600 1.3rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.weight {
		font-size: 0.7rem;
		color: #fff;
	}

	.reading {
		margin: 0.7rem 0 0;
		color: #ddd;
	}

	.display {
		width: 110px;
		flex: 0 0 auto;
	}
</style>
