<script lang="ts">
	// A number in a working table: in full where there is room, and cut to its
	// first and last digits on a phone, so the columns after it (the remainder
	// and the digit it gives, which are the answer) stay on screen. The full
	// value is kept in the title.
	export let value: bigint;
	/** How the number is written where there is room. */
	export let big: (n: bigint) => string;

	const SHORT_OVER = 10;
	$: full = big(value);
	$: digits = value.toString();
	$: short = digits.length > SHORT_OVER ? `${digits.slice(0, 4)}…${digits.slice(-4)}` : full;
</script>

{#if short === full}{full}{:else}<span class="wide">{full}</span><span class="narrow" title={digits}>{short}</span>{/if}

<style>
	.narrow {
		display: none;
	}

	@media (max-width: 600px) {
		.wide {
			display: none;
		}

		.narrow {
			display: inline;
		}
	}
</style>
