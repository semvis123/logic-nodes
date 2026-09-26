<script lang="ts">
	import type { Layout } from '$lib/arithmetic';

	/** Rows of digits on shared columns, as arithmetic is written on paper. */
	export let layout: Layout;
	/** Accessible name for the whole working. */
	export let label = 'Working';

	// A little space every few columns from the right, so long binary reads in nibbles.
	$: gapBefore = (j: number) => !!layout.groupEvery && j > 0 && (layout.columns - j) % layout.groupEvery === 0;
</script>

<!-- A long number scrolls inside this box rather than widening the page. -->
<div class="working-scroll" tabindex="0" role="region" aria-label={label}>
	<table class="working">
		<tbody>
			{#each layout.rows as row}
				<tr class="row-{row.kind}" class:rule={row.rule}>
					<th scope="row" class="sign">
						<span class="visually-hidden">{row.label}</span><span aria-hidden="true">{row.sign}</span>
					</th>
					{#each row.cells as cell, j}
						<td class="cell {cell?.tone ?? ''}" class:gap={gapBefore(j)}>{cell?.text ?? ''}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Only as wide as the sum, so it reads as one block rather than a stray
	   column of digits at the far edge of a wide card. */
	.working-scroll {
		overflow-x: auto;
		width: fit-content;
		max-width: 100%;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
		box-sizing: border-box;
	}

	.working {
		border-collapse: collapse;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1.15rem;
		line-height: 1.35;
	}

	.working th,
	.working td {
		padding: 0 0.12em;
		text-align: center;
		min-width: 0.85em;
		color: #eee;
		font-weight: normal;
	}

	.sign {
		color: #bbb;
		padding-right: 0.6em !important;
		text-align: right !important;
		white-space: nowrap;
		font-size: 0.95rem;
	}

	.working td.gap {
		padding-left: 0.5em;
	}

	tr.rule td,
	tr.rule th {
		border-top: 2px solid rgba(255, 255, 255, 0.55);
		padding-top: 0.15em;
	}

	/* Carries and borrows sit small above the column they belong to. */
	.row-carry td,
	.row-borrow td {
		font-size: 0.75rem;
		line-height: 1.2;
		vertical-align: bottom;
	}

	.working td.carry {
		color: #f0c060;
	}

	.working td.borrow {
		color: #ff9a9a;
	}

	.working td.result {
		color: #8ede8e;
		font-weight: 700;
	}

	.working td.overflow {
		color: #ff8a8a;
		text-decoration: line-through;
	}

	.working td.dim {
		color: #8c8c8c;
	}

	.working td.one {
		color: #6fcf6f;
	}

	.working td.zero {
		color: #ff7a7a;
	}

	.row-result td.one,
	.row-result td.zero {
		font-weight: 700;
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
		.working {
			font-size: 1rem;
		}
	}
</style>
