<script lang="ts">
	// Binary and Gray code counting side by side, one step at a time, with the
	// bits that changed lit up. The Gray sequence is the converter's own, so the
	// widget and the reference page always show the same code.
	import { grayCode, toBinaryString, toGray } from '$lib/boolean';

	export let bits = 3;
	export let label = 'Step through the sequence and watch how many bits change each time.';

	const sequence = grayCode(bits);
	const n = sequence.length;

	let index = 0;

	$: previous = (index - 1 + n) % n;
	$: gray = toGray(index);
	$: binaryDiff = index ^ previous;
	$: grayDiff = gray ^ toGray(previous);
	$: binaryChanged = toBinaryString(binaryDiff, bits)
		.split('')
		.filter((b) => b === '1').length;
	$: grayChanged = toBinaryString(grayDiff, bits)
		.split('')
		.filter((b) => b === '1').length;

	const digits = (value: number) => toBinaryString(value, bits).split('');
	const changedFrom = (value: number, from: number) => digits(value ^ from).map((d) => d === '1');
</script>

<div class="widget gray-counter">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="step" on:click={() => (index = previous)}>Previous</button>
		<button type="button" class="step" on:click={() => (index = (index + 1) % n)}>Next</button>
		<span class="where">
			value <strong>{index}</strong>
			{#if index === n - 1}(next wraps to 0){/if}
		</span>
	</div>
	<div class="codes" aria-live="polite">
		<div class="code">
			<p class="code-name">Binary</p>
			<p class="digits mono">
				{#each digits(index) as d, i}
					<span class:changed={changedFrom(index, previous)[i]}>{d}</span>
				{/each}
			</p>
			<p class="count">{binaryChanged} {binaryChanged === 1 ? 'bit' : 'bits'} changed</p>
		</div>
		<div class="code">
			<p class="code-name">Gray</p>
			<p class="digits mono">
				{#each digits(gray) as d, i}
					<span class:changed={changedFrom(gray, toGray(previous))[i]}>{d}</span>
				{/each}
			</p>
			<p class="count">{grayChanged} {grayChanged === 1 ? 'bit' : 'bits'} changed</p>
		</div>
	</div>
	<div class="table-wrap">
		<table class="data-table sequence">
			<caption>The whole {bits} bit sequence. The lit digit is the one that changed from the row above.</caption>
			<thead>
				<tr>
					<th scope="col">Value</th>
					<th scope="col">Binary</th>
					<th scope="col">Gray</th>
				</tr>
			</thead>
			<tbody>
				{#each sequence as g, i}
					{@const before = (i - 1 + n) % n}
					<tr class:current={i === index}>
						<td class="mono">{i}</td>
						<td class="mono">
							{#each digits(i) as d, k}<span class:changed={changedFrom(i, before)[k]}>{d}</span>{/each}
						</td>
						<td class="mono">
							{#each digits(g) as d, k}<span class:changed={changedFrom(g, sequence[before])[k]}>{d}</span>{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.step {
		background-color: #222;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}

	.where {
		color: #aaa;
		font-size: 0.85rem;
	}

	.codes {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 0.9rem;
	}

	.code {
		flex: 1 1 140px;
		background-color: #222;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.5rem 0.8rem;
	}

	.code p {
		margin: 0;
	}

	.code-name {
		color: #bbb;
		font-size: 0.8rem;
	}

	.digits {
		font-size: 1.6rem;
		font-weight: 600;
		letter-spacing: 0.15em;
		color: #ddd;
	}

	.count {
		color: #aaa;
		font-size: 0.8rem;
	}

	.changed {
		color: #8ede8e;
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.sequence {
		margin-top: 0.9rem;
	}

	.sequence tr.current td {
		outline: 2px solid #5db65d;
		outline-offset: -2px;
	}
</style>
