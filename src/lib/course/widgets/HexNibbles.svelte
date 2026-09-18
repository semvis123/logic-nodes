<script lang="ts">
	// A byte as two clickable nibbles, with the hex digit each nibble makes
	// underneath and the decimal total at the end. The point is that a hex
	// digit is a nibble and nothing more: flip a bit and only its own digit
	// changes.
	import { toBits, fromBits, render as renderBits } from '$lib/numbers';

	export let value = 0b10110110;
	export let label = 'A byte as two nibbles. Click any bit and watch which hex digit changes.';

	$: bits = toBits(value, 8);
	$: nibbles = [bits.slice(0, 4), bits.slice(4, 8)];
	$: hex = renderBits(bits, 'hex');
	$: decimal = fromBits(bits);
	$: high = fromBits(nibbles[0]);
	$: low = fromBits(nibbles[1]);

	const flip = (i: number) => {
		value ^= 1 << (7 - i);
	};
</script>

<div class="widget hex-nibbles">
	<p class="widget-title">{label}</p>
	<div class="nibbles" role="group" aria-label="Eight bits in two nibbles, most significant first">
		{#each nibbles as nibble, n}
			<div class="nibble">
				<div class="bits">
					{#each nibble as bit, j}
						{@const i = n * 4 + j}
						<button
							type="button"
							class="bit"
							class:on={bit === 1}
							aria-pressed={bit === 1}
							aria-label="bit {7 - i}, worth {2 ** (7 - i)}"
							on:click={() => flip(i)}
						>
							<span class="bit-value">{bit}</span>
							<span class="weight">{2 ** (3 - j)}</span>
						</button>
					{/each}
				</div>
				<p class="digit" aria-live="polite">
					<span class="mono">{nibble.join('')}</span> = {fromBits(nibble)} = hex
					<strong class="mono">{renderBits(nibble, 'hex')}</strong>
				</p>
			</div>
		{/each}
	</div>
	<p class="reading" aria-live="polite">
		Together: <span class="mono">{hex}</span> in hex, which is {high} × 16 + {low} =
		<strong>{decimal}</strong> in decimal.
	</p>
</div>

<style>
	.nibbles {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
	}

	.nibble {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.bits {
		display: flex;
		gap: 6px;
	}

	.bit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		min-width: 2.4rem;
		padding: 0.4rem 0.45rem;
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

	.digit {
		margin: 0;
		color: #ddd;
		font-size: 0.9rem;
	}

	.reading {
		margin: 0.8rem 0 0;
		color: #ddd;
	}
</style>
