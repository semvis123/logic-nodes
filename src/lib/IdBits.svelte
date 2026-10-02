<script lang="ts">
	import { fieldBits, hexOf, type IdField } from '$lib/ids';

	// An ID drawn the way RFC 9562 draws UUIDs: 32 bits to a row, each field a
	// labelled run of bits. Colour says which kind of field it is (time, random,
	// counter), and the label under each run and the table below say it again in
	// words, so nothing depends on seeing the colour.
	export let fields: IdField[];
	export let bits: number;
	/** How bit positions are numbered in the row headings: from the top bit as 0 (RFC style), or from the bottom (as Discord documents snowflakes). */
	export let numbering: 'top' | 'bottom' = 'top';
	/** Used in the accessible name of the diagram. */
	export let label = 'Bit layout';

	const ROW = 32;

	type Segment = { field: IdField; index: number; from: number; to: number };

	$: rows = Array.from({ length: Math.ceil(bits / ROW) }, (_, r) => {
		const lo = r * ROW;
		const hi = Math.min(bits, lo + ROW);
		const cells: { bit: string; index: number; edge: boolean }[] = [];
		const segments: Segment[] = [];
		fields.forEach((field, index) => {
			const from = Math.max(lo, field.start);
			const to = Math.min(hi, field.start + field.length);
			if (from >= to) return;
			segments.push({ field, index, from: from - lo, to: to - lo });
			const text = fieldBits(field);
			for (let p = from; p < to; p++) {
				cells.push({ bit: text[p - field.start], index, edge: p === field.start });
			}
		});
		const nibbles = Array.from({ length: (hi - lo) / 4 }, (_, n) =>
			cells
				.slice(n * 4, n * 4 + 4)
				.map((c) => c.bit)
				.join('')
		).map((b) => parseInt(b, 2).toString(16));
		return { lo, hi, cells, segments, nibbles };
	});

	const posLabel = (lo: number, hi: number) =>
		numbering === 'top' ? `bits ${lo} to ${hi - 1}` : `bits ${bits - 1 - lo} to ${bits - hi}`;

	const range = (f: IdField) =>
		numbering === 'top'
			? f.length === 1
				? `${f.start}`
				: `${f.start}–${f.start + f.length - 1}`
			: f.length === 1
			? `${bits - 1 - f.start}`
			: `${bits - 1 - f.start}–${bits - f.start - f.length}`;
</script>

<div class="id-bits" role="group" aria-label={label}>
	{#each rows as row}
		<div class="row">
			<div class="row-label">{posLabel(row.lo, row.hi)}</div>
			<div class="grid" style="--cols: {row.hi - row.lo}" aria-hidden="true">
				{#each row.nibbles as n, i}
					<span class="nib" style="grid-column: {i * 4 + 1} / span 4">{n}</span>
				{/each}
				{#each row.cells as c, i}
					<span
						class="bit t-{fields[c.index].tone}"
						class:edge={c.edge || i === 0}
						class:last={i === row.cells.length - 1}
						style="grid-row: 2">{c.bit}</span
					>
				{/each}
				{#each row.segments as s}
					<span
						class="seg t-{s.field.tone}"
						class:cont={s.field.start < row.lo}
						style="grid-column: {s.from + 1} / {s.to + 1}"
						title={s.field.name}>{s.to - s.from >= 2 ? s.field.short : ''}</span
					>
				{/each}
			</div>
		</div>
	{/each}
</div>

<div class="table-wrap fields-wrap">
	<table class="data-table fields">
		<caption class="visually-hidden">{label}: each field, what it means, its bits and its value</caption>
		<thead>
			<tr>
				<th scope="col">Field</th>
				<th scope="col">Bits</th>
				<th scope="col">Value</th>
			</tr>
		</thead>
		<tbody>
			{#each fields as f}
				<tr>
					<th scope="row"
						><span class="swatch t-{f.tone}" aria-hidden="true" />{f.name}{#if f.meaning}<span class="meaning"
								>{f.meaning}</span
							>{/if}</th
					>
					<td class="mono nowrap">{range(f)} <span class="dim">({f.length})</span></td>
					<td class="mono value">{f.length > 16 ? `0x${hexOf(f.value, Math.ceil(f.length / 4))}` : f.value}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.id-bits {
		display: grid;
		gap: 0.7rem;
		margin: 0.4rem 0 1rem;
	}

	.row-label {
		color: #aaa;
		font-size: 0.72rem;
		margin-bottom: 0.15rem;
	}

	/* The columns shrink with the card, so 32 bits fit a phone screen. */
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		max-width: calc(var(--cols) * 1.35rem);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.nib {
		grid-row: 1;
		color: #bbb;
		font-size: 0.72rem;
		text-align: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		margin: 0 1px 2px;
	}

	.bit {
		text-align: center;
		font-size: 0.74rem;
		line-height: 1.7;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
		border-bottom: 1px solid rgba(255, 255, 255, 0.14);
	}

	.bit.edge {
		border-left: 2px solid rgba(255, 255, 255, 0.6);
	}

	.bit.last {
		border-right: 2px solid rgba(255, 255, 255, 0.6);
	}

	.seg {
		grid-row: 3;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.66rem;
		line-height: 1.3;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: clip;
		border-top: 2px solid currentColor;
		margin: 2px 1px 0;
		padding-top: 1px;
	}

	.seg.cont {
		border-top-style: dashed;
	}

	/* One colour per kind of field, the same in every ID. */
	.t-time {
		color: #8ede8e;
	}
	.t-random {
		color: #8ec5ff;
	}
	.t-version {
		color: #ffd27a;
	}
	.t-variant {
		color: #f5a3cf;
	}
	.t-clock,
	.t-counter {
		color: #c9b0ff;
	}
	.t-node,
	.t-machine {
		color: #ffb27f;
	}
	.t-process {
		color: #f2e39a;
	}
	.t-hash {
		color: #9fdcd9;
	}
	.t-custom,
	.t-fixed {
		color: #cfcfcf;
	}

	.bit.t-time {
		background-color: rgba(93, 182, 93, 0.16);
	}
	.bit.t-random {
		background-color: rgba(90, 155, 216, 0.16);
	}
	.bit.t-version {
		background-color: rgba(255, 196, 77, 0.2);
	}
	.bit.t-variant {
		background-color: rgba(240, 120, 180, 0.2);
	}
	.bit.t-clock,
	.bit.t-counter {
		background-color: rgba(160, 120, 255, 0.18);
	}
	.bit.t-node,
	.bit.t-machine {
		background-color: rgba(255, 150, 80, 0.16);
	}
	.bit.t-process {
		background-color: rgba(230, 210, 100, 0.14);
	}
	.bit.t-hash {
		background-color: rgba(100, 200, 200, 0.14);
	}

	.swatch {
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
		border-radius: 2px;
		background-color: currentColor;
		margin-right: 0.45em;
		vertical-align: 0;
	}

	.fields th[scope='row'] {
		width: 55%;
		color: #eee;
		font-weight: 400;
		text-align: left;
	}

	.fields-wrap {
		margin-bottom: 0.8rem;
	}

	.fields td,
	.fields th {
		font-size: 0.85rem;
		vertical-align: top;
	}

	.nowrap {
		white-space: nowrap;
	}

	.value {
		overflow-wrap: anywhere;
		min-width: 8ch;
	}

	.meaning {
		display: block;
		color: #bbb;
		font-size: 0.8rem;
		margin: 0.15rem 0 0 1.15em;
		overflow-wrap: anywhere;
	}

	.dim {
		color: #999;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 560px) {
		.bit {
			font-size: 0.66rem;
		}
		.seg {
			font-size: 0.6rem;
		}
	}
</style>
