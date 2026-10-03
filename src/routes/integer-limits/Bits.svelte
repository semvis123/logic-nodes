<script lang="ts">
	// A bit pattern in bytes, two nibbles each. The bytes wrap onto new lines
	// rather than widening the page, so a 128-bit value fits a phone; every row
	// holds whole bytes, so two patterns of the same width stay aligned.
	export let bits: string;
	/** Underline the top bit, the sign of a signed type. */
	export let signed = false;
	/** Accessible description of the whole pattern. */
	export let label: string;
	/**
	 * Reserve a one-bit slot on the left, so this row lines up with a row that
	 * shows a carry there. `carry` is the bit that did not fit, if any.
	 */
	export let gutter = false;
	export let carry = '';
	/** How many of the leading bits a narrowing cast throws away. */
	export let dropped = 0;
	/** How many of the leading bits a widening cast adds. */
	export let added = 0;

	$: bytes = Array.from({ length: Math.ceil(bits.length / 8) }, (_, i) => bits.slice(i * 8, i * 8 + 8));
</script>

<span class="bits mono" role="img" aria-label={label}>
	{#if gutter}
		<span class="carry" aria-hidden="true"><span class="bit dropped">{carry}</span></span>
	{/if}
	<span class="bytes">
		{#each bytes as byte, b}
			<span class="byte" aria-hidden="true">
				{#each byte.split('') as bit, i}
					<span
						class="bit {bit === '1' ? 'one' : 'zero'}"
						class:sign={signed && b === 0 && i === 0 && !added}
						class:dropped={b * 8 + i < dropped}
						class:added={b * 8 + i < added}
						class:gap={i === 4}>{bit}</span
					>
				{/each}
			</span>
		{/each}
	</span>
</span>

<style>
	/* The carry slot is its own column beside the bytes, so when the bytes wrap
	   onto more lines those lines stay under the first, not under the carry. */
	.bits {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-size: 1rem;
		line-height: 1.5;
	}

	.bytes {
		display: flex;
		flex-wrap: wrap;
		flex: 1 1 auto;
		min-width: 0;
		gap: 0.25rem 0.6rem;
	}

	.byte,
	.carry {
		display: inline-flex;
		white-space: nowrap;
	}

	.carry {
		flex: none;
		width: 0.72em;
	}

	.bit {
		display: inline-block;
		width: 0.72em;
		text-align: center;
	}

	/* Ones and zeros differ by their digit; colour only helps the eye. Red is
	   kept for errors, so a zero is a quiet grey rather than an alarm. */
	.one {
		color: #8ede8e;
	}

	.zero {
		color: #a8a8a8;
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

	/* Bits that do not survive: struck through, not just dimmed. */
	.dropped {
		color: #8c8c8c;
		text-decoration: line-through;
		text-decoration-thickness: 2px;
	}

	/* Bits a widening cast adds: a dotted underline. */
	.added {
		color: #e9c46a;
		text-decoration: underline dotted;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
	}
</style>
