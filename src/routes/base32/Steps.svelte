<script lang="ts">
	import { scrollRegion } from '$lib/scrollRegion';
	import { hex2 } from '$lib/textEncoding';
	import type { Base32Group } from '$lib/baseN';

	// The regrouping drawn to scale: 40 columns, one per bit, so five 8-bit bytes
	// and eight 5-bit indexes line up exactly, and each bit keeps its byte's
	// colour (and its byte's position) after it has moved into a five.
	export let groups: Base32Group[];
	export let mode: 'encode' | 'decode' = 'encode';
	/** What a screen reader calls the box when it scrolls; each drawing on a page needs its own. */
	export let label = 'Base32 working, bit by bit';

	const printable = (b: number) => (b > 32 && b < 127 ? String.fromCharCode(b) : '');
	const BYTES = [0, 1, 2, 3, 4];
	const CHARS = [0, 1, 2, 3, 4, 5, 6, 7];

	type Cell = { bit: string; source: number; kind: 'data' | 'fill' | 'empty' };

	function cells(g: Base32Group): Cell[] {
		const dataBits = g.bytes.length * 8;
		return Array.from({ length: 40 }, (_, p) => ({
			bit: p < g.bits.length ? g.bits[p] : '',
			source: Math.floor(p / 8),
			kind: p < dataBits ? 'data' : p < g.bits.length ? 'fill' : 'empty'
		}));
	}

	$: rows =
		mode === 'encode' ? ['bytes', 'bits8', 'bits5', 'index', 'char'] : ['char', 'index', 'bits5', 'bits8', 'bytes'];
</script>

<div class="steps-scroll" use:scrollRegion={label}>
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
						{#each BYTES as k}
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
					{:else if row === 'bits8' || row === 'bits5'}
						{#each cs as c, p}
							<span class="bit {c.kind} s{c.source}" class:edge={row === 'bits8' ? p % 8 === 0 : p % 5 === 0}
								>{c.bit}</span
							>
						{/each}
					{:else if row === 'index'}
						{#each CHARS as s}
							<span class="index" style="grid-column: span 5">{s < g.indexes.length ? g.indexes[s] : ''}</span>
						{/each}
					{:else}
						{#each CHARS as s}
							<span class="out" class:pad={g.chars[s] === '=' || g.chars[s] === undefined} style="grid-column: span 5"
								>{g.chars[s] ?? ''}</span
							>
						{/each}
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>
<p class="scroll-hint">Each group is 40 bits wide: scroll sideways to see all of it.</p>

<style>
	/* Forty bit columns are wider than a phone, so the drawing scrolls on its own. */
	.steps-scroll {
		overflow-x: auto;
		max-width: 100%;
		padding-bottom: 2px;
	}

	.scroll-hint {
		display: none;
		color: #999;
		font-size: 0.78rem;
		margin: 0.3rem 0 0;
	}

	@media (max-width: 600px) {
		.scroll-hint {
			display: block;
		}
	}

	.steps-view {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem 1.2rem;
		--cell: 0.72rem;
	}

	.group {
		display: grid;
		grid-template-columns: repeat(40, var(--cell));
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
		font-size: 0.7rem;
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

	.bit.data.s3,
	.byte.s3 .hex {
		color: #f0a3c8;
	}

	.bit.data.s4,
	.byte.s4 .hex {
		color: #7fd8d0;
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

	.byte.s3 {
		border-color: #c46f9a;
	}

	.byte.s4 {
		border-color: #4fa89f;
	}
</style>
