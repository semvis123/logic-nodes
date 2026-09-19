<script lang="ts">
	// Two numbers as clickable bit rows, added the way a ripple carry adder
	// does it: column by column from the right, with the carry into each column
	// shown above it and the carry out of the whole thing on the far left. The
	// arithmetic is rippleAdd from $lib/adders, the same as the adder page.
	import { rippleAdd } from '$lib/adders';
	import { signedValue } from '$lib/numbers';

	export let width = 4;
	export let a = 11;
	export let b = 6;
	export let label = 'A ripple carry adder. Click the bits of a and b.';
	/** Read the operands and the result as two's complement, where the carry out is ignored. */
	export let signed = false;

	$: mask = (1 << width) - 1;
	$: sum = rippleAdd(a & mask, b & mask, width, 0);
	/** The carry into each column, most significant first, with the carry out first of all. */
	$: carryRow = [...sum.carries].reverse();
	$: weights = Array.from({ length: width }, (_, i) => 2 ** (width - 1 - i));
	$: aSigned = signedValue(sum.aBits);
	$: bSigned = signedValue(sum.bBits);
	$: resultSigned = signedValue(sum.sumBits);
	const minus = (n: number) => (n < 0 ? `−${-n}` : String(n));

	const flipA = (i: number) => {
		a ^= 1 << (width - 1 - i);
	};
	const flipB = (i: number) => {
		b ^= 1 << (width - 1 - i);
	};
</script>

<div class="widget live-ripple-adder">
	<p class="widget-title">{label}</p>
	<div class="table-wrap">
		<table class="data-table ripple">
			<thead>
				<tr>
					<th scope="col"><span class="visually-hidden">Row</span></th>
					<th scope="col" class="mono">out</th>
					{#each weights as w}<th scope="col" class="mono">{w}</th>{/each}
				</tr>
			</thead>
			<tbody>
				<tr class="carries">
					<th scope="row">carries</th>
					{#each carryRow as c, i}
						<td class={c ? 'bit-1' : 'bit-0'} class:cout={i === 0}>{c}</td>
					{/each}
				</tr>
				<tr>
					<th scope="row">a</th>
					<td class="blank" />
					{#each sum.aBits as bit, i}
						<td>
							<button
								type="button"
								class="bit"
								class:on={bit === 1}
								aria-pressed={bit === 1}
								aria-label="a bit {width - 1 - i}, worth {weights[i]}"
								on:click={() => flipA(i)}>{bit}</button
							>
						</td>
					{/each}
				</tr>
				<tr>
					<th scope="row">+ b</th>
					<td class="blank" />
					{#each sum.bBits as bit, i}
						<td>
							<button
								type="button"
								class="bit"
								class:on={bit === 1}
								aria-pressed={bit === 1}
								aria-label="b bit {width - 1 - i}, worth {weights[i]}"
								on:click={() => flipB(i)}>{bit}</button
							>
						</td>
					{/each}
				</tr>
				<tr class="result">
					<th scope="row">= sum</th>
					<td class={sum.carryOut ? 'bit-1' : 'bit-0'} class:cout={true}>{sum.carryOut}</td>
					{#each sum.sumBits as bit}
						<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
					{/each}
				</tr>
			</tbody>
		</table>
	</div>
	<p class="reading" aria-live="polite">
		{#if signed}
			Read as two's complement, {minus(aSigned)} + ({minus(bSigned)}) = {minus(aSigned + bSigned)}. The sum bits
			<span class="mono">{sum.sumBits.join('')}</span> read as {minus(resultSigned)}, and the carry out of
			{sum.carryOut} is ignored{#if resultSigned !== aSigned + bSigned}. That differs from the true answer, so this
				addition overflowed{/if}.
		{:else}
			{sum.a} + {sum.b} = {sum.a + sum.b}. The sum bits read <span class="mono">{sum.sumBits.join('')}</span> =
			{sum.unsigned}, and the carry out is {sum.carryOut}{#if sum.carryOut}, so the true answer did not fit in {width}
				bits: it is {2 ** width} + {sum.unsigned}.{:else}, so the answer fits.{/if}
		{/if}
	</p>
</div>

<style>
	.ripple th[scope='row'] {
		text-align: right;
		font-weight: 400;
		color: #ccc;
		white-space: nowrap;
	}

	.ripple td {
		text-align: center;
	}

	.ripple td.blank {
		background: transparent;
	}

	.ripple td.cout {
		border-right: 2px solid rgba(255, 255, 255, 0.35);
	}

	.carries td {
		font-size: 0.8rem;
	}

	.bit {
		min-width: 2.2rem;
		padding: 0.3rem 0.4rem;
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.6);
		border-radius: 3px;
		color: #fff;
		cursor: pointer;
		font: 600 1.1rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.bit.on {
		background-color: #372;
	}

	.reading {
		margin: 0.7rem 0 0;
		color: #ddd;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
