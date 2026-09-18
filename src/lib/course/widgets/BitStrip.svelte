<script lang="ts">
	// A row of bits the reader can flip, with the value they add up to. The
	// weights under each bit are the whole idea of place value, so they are on
	// by default; a lesson that has not introduced them yet turns them off.
	export let bits = 4;
	export let value = 0;
	export let weights = true;
	export let hex = false;
	export let label = 'Click a bit to flip it';

	$: pattern = Array.from({ length: bits }, (_, i) => (value >> (bits - 1 - i)) & 1);
	$: terms = pattern.map((bit, i) => (bit ? 2 ** (bits - 1 - i) : 0)).filter((t) => t > 0);

	const flip = (i: number) => {
		value ^= 1 << (bits - 1 - i);
	};
</script>

<div class="widget bitstrip">
	<p class="widget-title">{label}</p>
	<div class="bits" role="group" aria-label="Bits, most significant first">
		{#each pattern as bit, i}
			<button
				type="button"
				class="bit"
				class:on={bit === 1}
				aria-pressed={bit === 1}
				aria-label="bit {bits - 1 - i}, worth {2 ** (bits - 1 - i)}"
				on:click={() => flip(i)}
			>
				<span class="bit-value">{bit}</span>
				{#if weights}<span class="weight">{2 ** (bits - 1 - i)}</span>{/if}
			</button>
		{/each}
	</div>
	<p class="reading" aria-live="polite">
		{#if weights}
			<span class="mono">{terms.length ? terms.join(' + ') : '0'}</span> =
		{/if}
		<strong>{value}</strong>
		{#if hex}
			<span class="dim">, or <span class="mono">{value.toString(16).toUpperCase()}</span> in hex</span>
		{/if}
	</p>
</div>

<style>
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

	.dim {
		color: #aaa;
	}
</style>
