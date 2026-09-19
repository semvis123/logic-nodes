<script lang="ts">
	// One clickable byte read three ways at once: as an unsigned number, as an
	// ASCII character, and as two BCD digits. The same bits, three meanings,
	// and only the reading changes when the reader picks a different code.
	import { toBits, fromBits } from '$lib/numbers';

	export let value = 0b01000010;
	export let label = 'One byte, three readings. Click any bit.';

	$: bits = toBits(value, 8);
	$: nibbles = [bits.slice(0, 4), bits.slice(4, 8)];
	$: unsigned = fromBits(bits);
	$: printable = unsigned >= 32 && unsigned <= 126;
	$: character = printable ? String.fromCharCode(unsigned) : '';
	$: digits = nibbles.map((nibble) => fromBits(nibble));
	$: bcdValid = digits.every((d) => d <= 9);
	$: bcdParts = nibbles.map((nibble, n) => ({
		bits: nibble.join(''),
		reading: digits[n] <= 9 ? `is the digit ${digits[n]}` : 'is not a digit'
	}));

	const flip = (i: number) => {
		value ^= 1 << (7 - i);
	};
</script>

<div class="widget code-explorer">
	<p class="widget-title">{label}</p>
	<div class="nibbles" role="group" aria-label="Eight bits in two nibbles, most significant first">
		{#each nibbles as nibble, n}
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
					</button>
				{/each}
			</div>
		{/each}
	</div>
	<div class="table-wrap">
		<table class="data-table readings" aria-live="polite">
			<thead>
				<tr><th scope="col">Read as</th><th scope="col">It means</th></tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">an unsigned number</th>
					<td><strong>{unsigned}</strong></td>
				</tr>
				<tr>
					<th scope="row">an ASCII character</th>
					<td>
						{#if printable}
							{#if character === ' '}
								a space
							{:else}
								the character <strong class="mono">{character}</strong>
							{/if}
						{:else}
							not printable
						{/if}
					</td>
				</tr>
				<tr>
					<th scope="row">two BCD digits</th>
					<td>
						<span class="mono">{bcdParts[0].bits}</span>
						{bcdParts[0].reading}, <span class="mono">{bcdParts[1].bits}</span>
						{bcdParts[1].reading}.
						{#if bcdValid}
							Together: <strong>{digits[0]}{digits[1]}</strong>.
						{:else}
							Not valid BCD.
						{/if}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</div>

<style>
	.nibbles {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
	}

	.bits {
		display: flex;
		gap: 6px;
	}

	.bit {
		min-width: 2.4rem;
		padding: 0.4rem 0.45rem;
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.6);
		border-radius: 3px;
		color: #fff;
		cursor: pointer;
		font: 600 1.3rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.bit.on {
		background-color: #372;
	}

	.readings {
		margin-top: 0.8rem;
	}

	.readings th[scope='row'] {
		text-align: left;
		font-weight: 400;
		color: #ccc;
	}
</style>
