<script lang="ts">
	// A bit pattern in bytes, two nibbles each. The bytes wrap onto new lines
	// rather than widening the page, so a 128-bit value fits a phone; every row
	// holds whole bytes, so two patterns of the same width stay aligned.
	export let bits: string;
	/** Underline the top bit, the sign of a signed type. */
	export let signed = false;
	/** Accessible description of the whole pattern. */
	export let label: string;

	$: bytes = Array.from({ length: Math.ceil(bits.length / 8) }, (_, i) => bits.slice(i * 8, i * 8 + 8));
</script>

<span class="bits mono" role="img" aria-label={label}>
	{#each bytes as byte, b}
		<span class="byte" aria-hidden="true">
			{#each byte.split('') as bit, i}
				<span class="bit {bit === '1' ? 'one' : 'zero'}" class:sign={signed && b === 0 && i === 0} class:gap={i === 4}
					>{bit}</span
				>
			{/each}
		</span>
	{/each}
</span>

<style>
	.bits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.6rem;
		font-size: 1rem;
		line-height: 1.5;
	}

	.byte {
		display: inline-flex;
		white-space: nowrap;
	}

	.bit {
		display: inline-block;
		width: 0.72em;
		text-align: center;
	}

	.one {
		color: #8ede8e;
	}

	.zero {
		color: #f77;
	}

	.gap {
		margin-left: 0.3em;
	}

	/* The sign bit is marked by an underline, not only by colour. */
	.sign {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
		color: #fff;
	}
</style>
