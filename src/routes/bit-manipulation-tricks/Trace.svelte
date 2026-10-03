<script lang="ts">
	import { bitString, changedBits, groupedBits, hexOf, signed, type Row, type Width } from '$lib/bitTricks';

	// One row per intermediate value, every bit in its own column so the rows
	// line up and a bit can be followed straight down. Every row has the same
	// column geometry (a gap after each nibble); a trick that works on other
	// field sizes shades alternate fields instead, which takes no width. Bits
	// that differ from the row a step is compared with are boxed and
	// underlined, and the count is written out, so the change never rests on
	// colour alone.
	export let rows: Row[];
	export let w: Width;
	export let signedView = false;
	/** A bit position to pick out in every row, for the bit n tricks. */
	export let column: number | null = null;
	/** Accessible name for the trace. */
	export let label = 'Trace';

	type Cell = { bit: string; pos: number; changed: boolean; gap: boolean; alt: boolean; half: boolean };

	function cells(row: Row): Cell[] {
		const s = bitString(row.value, w);
		const base = row.base === undefined ? null : rows[row.base];
		const diff = base ? changedBits(row.value, base.value, w) : null;
		const group = row.group ?? 4;
		return s.split('').map((bit, i) => {
			const pos = w - 1 - i;
			return {
				bit,
				pos,
				changed: !!diff && diff[pos],
				gap: i > 0 && (w - i) % 4 === 0,
				alt: group !== 4 && Math.floor(pos / group) % 2 === 1,
				half: w === 32 && i === 16
			};
		});
	}

	function changeText(row: Row): string {
		if (row.base === undefined) return '';
		const n = changedBits(row.value, rows[row.base].value, w).filter(Boolean).length;
		const against = rows[row.base].expr;
		return n === 0 ? `same bits as ${against}` : `${n} bit${n === 1 ? ' differs' : 's differ'} from ${against}`;
	}

	const decimal = (v: number) => {
		const s = signedView ? signed(v, w) : v;
		return s < 0 ? `−${-s}` : String(s);
	};

	// Bit numbers over the columns: every one at 8 bits, every fourth above
	// that, and the top of each half of a 32-bit row.
	$: indexCells = Array.from({ length: w }, (_, i) => {
		const pos = w - 1 - i;
		return {
			pos,
			show: w === 8 || pos % 4 === 0 || pos === w - 1 || (w === 32 && pos === 15),
			gap: i > 0 && (w - i) % 4 === 0,
			half: w === 32 && i === 16
		};
	});

	// A long trace (Kernighan's loop on a dense 32-bit value runs 32 passes)
	// shows its first and last rows, with the middle behind a button.
	const HEAD = 5;
	const TAIL = 3;
	let expanded = false;
	$: long = rows.length > HEAD + TAIL + 4;
	// The toggle keeps its key, so its button keeps focus when it is pressed.
	type Item = { key: string; row?: Row };
	let items: Item[];
	$: {
		const all: Item[] = rows.map((row, i) => ({ key: `r${i}`, row }));
		items = long ? [...all.slice(0, HEAD), { key: 'toggle' }, ...all.slice(expanded ? HEAD : rows.length - TAIL)] : all;
	}
</script>

<!-- A scrollable region must be focusable to be scrolled by keyboard; Svelte 3 flags any tabindex here. -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div class="trace-scroll" tabindex="0" role="region" aria-label={label}>
	<table class="trace w{w}">
		<thead>
			<tr>
				<th scope="col" class="step-h">Step</th>
				<th scope="col" class="bits-h">
					<span class="visually-hidden">Bits, bit {w - 1} on the left down to bit 0</span>
					<span class="index-row" aria-hidden="true">
						{#each indexCells as c}{#if c.half}<span class="brk" />{/if}<span
								class="idx"
								class:gap={c.gap}
								class:col={c.pos === column}>{c.show || c.pos === column ? c.pos : ''}</span
							>{/each}
					</span>
				</th>
				<th scope="col" class="num num-h"
					><span class="hex-h">Hex</span> <span class="dec-h">{signedView ? 'Signed' : 'Unsigned'} decimal</span></th
				>
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.key)}
				{#if item.row}
					{@const row = item.row}
					{@const change = changeText(row)}
					<tr class="role-{row.role}">
						<th scope="row" class="step">
							<code class="expr">{row.expr}</code>
							{#if row.note}<span class="note">{row.note}</span>{/if}
							{#if change}<span class="delta">{change}</span>{/if}
						</th>
						<td class="bits">
							<span class="visually-hidden">{groupedBits(row.value, w)}</span>
							<span class="bit-row" aria-hidden="true"
								>{#each cells(row) as c}{#if c.half}<span class="brk" />{/if}<span
										class="b{c.bit}"
										class:chg={c.changed}
										class:gap={c.gap}
										class:alt={c.alt}
										class:col={c.pos === column}>{c.bit}</span
									>{/each}</span
							>
						</td>
						<td class="mono num vals"
							><span class="hex">{hexOf(row.value, w)}</span> <span class="dec">{decimal(row.value)}</span></td
						>
					</tr>
				{:else}
					<tr class="more">
						<td colspan="3">
							<button type="button" class="more-btn" aria-expanded={expanded} on:click={() => (expanded = !expanded)}
								>{expanded ? 'Hide' : 'Show'} the {rows.length - HEAD - TAIL} rows in between</button
							>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Only as wide as the rows, and a 32-bit row scrolls inside this box on a
	   phone rather than widening the page. --cell is the width of one bit
	   column, shared by the bit rows and the bit numbers over them. */
	.trace-scroll {
		--cell: 1.1rem;
		--gap: 0.4rem;
		overflow-x: auto;
		max-width: 100%;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.trace {
		border-collapse: collapse;
		width: 100%;
		font-variant-numeric: tabular-nums;
	}

	.trace th,
	.trace td {
		padding: 0.4rem 0.7rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		text-align: left;
		vertical-align: middle;
		color: #ddd;
		font-weight: normal;
	}

	.trace thead th {
		color: #bbb;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding-top: 0.5rem;
		padding-bottom: 0.25rem;
		white-space: nowrap;
	}

	.trace tbody tr:last-child th,
	.trace tbody tr:last-child td {
		border-bottom: none;
	}

	.step {
		min-width: 10rem;
	}

	.expr {
		display: block;
		color: #fff;
		font: 0.92rem ui-monospace, SFMono-Regular, Menlo, monospace;
		max-width: 16rem;
	}

	.note,
	.delta {
		display: block;
		color: #aaa;
		font-size: 0.78rem;
		line-height: 1.35;
		max-width: 22rem;
	}

	/* A 32-bit row is wide: the step text wraps sooner so the values stay in view. */
	.w32 .expr,
	.w32 .note,
	.w32 .delta {
		max-width: 12rem;
	}

	.delta {
		color: #e0c27a;
	}

	.bits,
	.bits-h {
		white-space: nowrap;
	}

	.bit-row,
	.index-row {
		display: inline-flex;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.bit-row span,
	.index-row span {
		display: inline-block;
		width: var(--cell);
		text-align: center;
		box-sizing: border-box;
		flex: none;
	}

	.bit-row span {
		font-size: 1.05rem;
		line-height: 1.5;
		border: 1px solid transparent;
		border-radius: 2px;
	}

	.index-row span {
		font-size: 0.62rem;
		text-transform: none;
		letter-spacing: 0;
		color: #999;
	}

	/* The same gap after every nibble in every row, so the columns never drift. */
	.bit-row .gap,
	.index-row .gap {
		margin-left: var(--gap);
	}

	/* Alternate fields of a trick that works on pairs, bytes or halves. */
	.bit-row .alt {
		background-color: rgba(255, 255, 255, 0.09);
	}

	/* The line break between the two halves of a 32-bit row, used on a phone. */
	.bit-row .brk,
	.index-row .brk {
		display: none;
	}

	/* 32 bits next to a long step name: narrower columns keep the hex and
	   decimal in view on a desktop card. */
	.w32 {
		--cell: 0.98rem;
		--gap: 0.3rem;
	}

	.w32 .bit-row span {
		font-size: 0.86rem;
	}

	.b1 {
		color: #8ede8e;
		font-weight: 700;
	}

	.b0 {
		color: #9a9a9a;
	}

	/* A changed bit: boxed and underlined, as well as tinted. */
	.bit-row .chg {
		border-color: #e0c27a;
		border-bottom-width: 3px;
		background: rgba(224, 194, 122, 0.12);
	}

	.bit-row .col,
	.index-row .col {
		background-color: rgba(142, 222, 142, 0.14);
	}

	.index-row .col {
		color: #8ede8e;
		font-weight: 700;
	}

	.vals span,
	.num-h span {
		display: block;
	}

	.hex {
		color: #ccc;
	}

	.dec {
		color: #fff;
	}

	.num {
		text-align: right !important;
		white-space: nowrap;
	}

	.role-mask .expr {
		color: #c8c8c8;
	}

	.role-result th,
	.role-result td {
		background: rgba(93, 182, 93, 0.08);
	}

	.role-result .expr {
		color: #8ede8e;
		font-weight: 700;
	}

	.more td {
		text-align: center;
		padding: 0.35rem 0.7rem;
	}

	.more-btn {
		background: #0d0d0f;
		border: 1px dashed rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
		cursor: pointer;
	}

	.more-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* On a phone each step stacks: its name, then the bits, then the values.
	   The header keeps the bit numbers and the value labels, laid out the same way. */
	@media (max-width: 640px) {
		.trace-scroll {
			--cell: 1.05rem;
		}

		.trace,
		.trace thead,
		.trace tbody {
			display: block;
		}

		.trace tr {
			display: grid;
			grid-template-columns: 1fr auto;
			column-gap: 0.8rem;
			padding: 0.45rem 0.6rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		}

		.trace thead tr {
			padding-bottom: 0.3rem;
		}

		.trace tbody tr:last-child {
			border-bottom: none;
		}

		.trace th,
		.trace td {
			border: none !important;
			padding: 0 !important;
		}

		.step-h {
			display: none;
		}

		.step,
		.bits,
		.bits-h {
			grid-column: 1 / -1;
			min-width: 0;
		}

		.bits {
			padding: 0.2rem 0 !important;
		}

		.bit-row span {
			font-size: 1rem;
		}

		/* A 32-bit row splits into two lines of 16, bits 31 to 16 over 15 to 0. */
		.w32 {
			--cell: 1rem;
		}

		.w32 .bit-row,
		.w32 .index-row {
			display: flex;
			flex-wrap: wrap;
			row-gap: 3px;
		}

		.w32 .bit-row .brk,
		.w32 .index-row .brk {
			display: block;
			flex-basis: 100%;
			height: 0;
		}

		.w32 .bit-row span:not(.brk) {
			font-size: 0.95rem;
		}

		.w32 .brk + span {
			margin-left: 0;
		}

		.trace tbody tr.role-result {
			background: rgba(93, 182, 93, 0.08);
		}

		.trace tbody tr.role-result th,
		.trace tbody tr.role-result td {
			background: none;
		}

		.vals,
		.num-h {
			grid-column: 1 / -1;
			display: flex !important;
			justify-content: space-between;
			font-size: 0.85rem;
		}

		.num-h {
			font-size: 0.7rem !important;
			margin-top: 0.2rem;
		}

		.more {
			display: block !important;
		}

		.more td {
			display: block;
			padding: 0.2rem 0 !important;
		}
	}
</style>
