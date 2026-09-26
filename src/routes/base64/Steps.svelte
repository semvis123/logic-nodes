<script lang="ts">
	import { hex2, type Base64Group } from '$lib/textEncoding';

	// The regrouping drawn to scale: every bit is one column, so the 8-bit bytes
	// and the 6-bit indexes line up and each bit keeps its byte's colour after
	// it has been moved into a six.
	export let groups: Base64Group[];
	export let mode: 'encode' | 'decode' = 'encode';

	const printable = (b: number) => (b > 32 && b < 127 ? String.fromCharCode(b) : '');

	type Cell = { bit: string; source: number; kind: 'data' | 'fill' | 'empty' };

	function cells(g: Base64Group): Cell[] {
		const dataBits = g.bytes.length * 8;
		return Array.from({ length: 24 }, (_, p) => ({
			bit: p < g.bits.length ? g.bits[p] : '',
			source: Math.floor(p / 8),
			kind: p < dataBits ? 'data' : p < g.bits.length ? 'fill' : 'empty'
		}));
	}

	$: rows =
		mode === 'encode' ? ['bytes', 'bits8', 'bits6', 'index', 'char'] : ['char', 'index', 'bits6', 'bits8', 'bytes'];
</script>

<div class="steps-view">
	{#each groups as g}
		{@const cs = cells(g)}
		<div
			class="group"
			role="group"
			aria-label="{g.bytes.length} byte{g.bytes.length === 1 ? '' : 's'}, {g.chars.join('')}"
		>
			{#each rows as row}
				{#if row === 'bytes'}
					{#each [0, 1, 2] as k}
						{#if k < g.bytes.length}
							<span class="byte s{k}" style="grid-column: span 8"
								><span class="hex">{hex2(g.bytes[k])}</span>{#if printable(g.bytes[k])}<span class="plain"
										>{printable(g.bytes[k])}</span
									>{/if}</span
							>
						{:else}
							<span class="byte none" style="grid-column: span 8">no byte</span>
						{/if}
					{/each}
				{:else if row === 'bits8' || row === 'bits6'}
					{#each cs as c, p}
						<span
							class="bit {c.kind} s{c.source}"
							class:edge={row === 'bits8' ? p % 8 === 0 : p % 6 === 0}
							class:row8={row === 'bits8'}>{c.bit}</span
						>
					{/each}
				{:else if row === 'index'}
					{#each [0, 1, 2, 3] as s}
						<span class="index" style="grid-column: span 6">{s < g.indexes.length ? g.indexes[s] : ''}</span>
					{/each}
				{:else}
					{#each [0, 1, 2, 3] as s}
						<span class="out" class:pad={g.chars[s] === '=' || g.chars[s] === undefined} style="grid-column: span 6"
							>{g.chars[s] ?? ''}</span
						>
					{/each}
				{/if}
			{/each}
		</div>
	{/each}
</div>

<style>
	.steps-view {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem 1.2rem;
		--cell: 0.74rem;
	}

	.group {
		display: grid;
		grid-template-columns: repeat(24, var(--cell));
		grid-auto-rows: auto;
		row-gap: 3px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.5rem 0.55rem;
		background-color: #101012;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.byte,
	.index,
	.out {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		margin: 0 1px;
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.byte.none {
		border-style: dashed;
		color: #999;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.7rem;
	}

	.plain {
		color: #fff;
	}

	.index {
		color: #ddd;
		border-color: transparent;
	}

	.out {
		color: #fff;
		font-weight: 700;
		font-size: 1rem;
		background-color: rgba(51, 119, 34, 0.35);
		border-color: #5db65d;
	}

	.out.pad {
		background: none;
		border-color: rgba(255, 255, 255, 0.3);
		color: #bbb;
	}

	.bit {
		text-align: center;
		font-size: 0.72rem;
		line-height: 1.6;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.bit.edge {
		border-left: 2px solid rgba(255, 255, 255, 0.55);
	}

	.bit.fill {
		color: #aaa;
		background-color: rgba(255, 255, 255, 0.06);
	}

	.bit.empty {
		border-color: transparent;
	}

	.bit.data.s0,
	.byte.s0 .hex {
		color: #8ede8e;
	}

	.bit.data.s1,
	.byte.s1 .hex {
		color: #8ec5ff;
	}

	.bit.data.s2,
	.byte.s2 .hex {
		color: #e6c07b;
	}

	.byte.s0 {
		border-color: #5db65d;
	}

	.byte.s1 {
		border-color: #5a9bd8;
	}

	.byte.s2 {
		border-color: #c49a4a;
	}
</style>
