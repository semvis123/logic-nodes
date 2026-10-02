<script lang="ts">
	import { toBits, dottedBits } from '$lib/ipv4';

	// Rows of 32 bits stacked in exact columns, so an AND or an OR can be read
	// straight down, the way it is done on paper. The network and host bits are
	// told apart three ways: a labelled bracket above, a divider line at the
	// split, and a tinted background on the host side.
	type Row = { label: string; op?: string; value: number; text: string; result?: boolean };
	export let rows: Row[];
	export let prefix: number;
	export let caption: string;
	/** Bits of result rows that differ from this value get marked, for the membership check. */
	export let compare: number | null = null;

	/** Grid column (1-based) of bit i, leaving a narrow column for the dot after each octet. */
	const col = (i: number) => i + Math.floor(i / 8) + 1;

	$: netBits = prefix;
	$: hostBits = 32 - prefix;
	$: netText = netBits >= 15 ? `${netBits} network bits` : netBits >= 5 ? `net ${netBits}` : '';
	$: hostText = hostBits >= 13 ? `${hostBits} host bits` : hostBits >= 5 ? `host ${hostBits}` : '';
	$: compareBits = compare === null ? '' : toBits(compare);
</script>

<div class="bits-figure" role="group" aria-label={caption}>
	<div class="row scale" aria-hidden="true">
		<span class="label" />
		<span class="grid">
			{#if netBits > 0}
				<span class="span net" style="grid-column: 1 / {col(netBits - 1) + 1}" title="{netBits} network bits"
					>{netText}</span
				>
			{/if}
			{#if hostBits > 0}
				<span class="span host" style="grid-column: {col(netBits)} / -1" title="{hostBits} host bits">{hostText}</span>
			{/if}
		</span>
		<span class="dec" />
	</div>
	{#each rows as row}
		{@const bits = toBits(row.value)}
		<div class="row" class:result={row.result}>
			<span class="label"
				>{#if row.op}<span class="op">{row.op}</span> {/if}{row.label}</span
			>
			<span class="grid" role="img" aria-label="{row.label} in binary: {dottedBits(row.value)}">
				{#each bits as bit, i}
					{#if i && i % 8 === 0}<span class="dot" aria-hidden="true">.</span>{/if}
					<span
						class="b"
						class:one={bit === '1'}
						class:host={i >= prefix}
						class:split={i === prefix}
						class:diff={row.result && compareBits && compareBits[i] !== bit}
						aria-hidden="true">{bit}</span
					>
				{/each}
			</span>
			<span class="dec">{row.text}</span>
		</div>
	{/each}
</div>

<style>
	.bits-figure {
		--c: 14px;
		--d: 8px;
		background-color: #101012;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.55rem 0.7rem 0.65rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		max-width: 100%;
		box-sizing: border-box;
		overflow-x: auto;
	}

	.row {
		display: grid;
		grid-template-columns: 8.5rem max-content 1fr;
		align-items: center;
		column-gap: 0.9rem;
		padding: 1px 0;
	}

	.row.result {
		border-top: 1px solid rgba(255, 255, 255, 0.55);
		margin-top: 2px;
		padding-top: 3px;
	}

	.grid {
		display: grid;
		grid-template-columns:
			repeat(8, var(--c)) var(--d) repeat(8, var(--c)) var(--d) repeat(8, var(--c)) var(--d)
			repeat(8, var(--c));
	}

	.label {
		color: #bbb;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.op {
		color: #d8b45a;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 700;
	}

	.result .label {
		color: #fff;
		font-weight: 600;
	}

	.dec {
		color: #ddd;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.result .dec {
		color: #8ede8e;
		font-weight: 700;
	}

	.b {
		text-align: center;
		font-size: 0.78rem;
		line-height: 1.55;
		color: #999;
	}

	.b.one {
		color: #fff;
		font-weight: 700;
	}

	.b.host {
		background-color: rgba(216, 180, 90, 0.13);
	}

	.b.split {
		box-shadow: inset 2px 0 0 #d8b45a;
	}

	.b.diff {
		color: #ff8a8a;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 2px;
	}

	.dot {
		text-align: center;
		color: #888;
		font-size: 0.78rem;
		line-height: 1.55;
	}

	.span {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.7rem;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		padding-bottom: 1px;
		margin: 0 1px 3px;
	}

	.span.net {
		color: #8ede8e;
		border-bottom: 2px solid #5db65d;
	}

	.span.host {
		color: #d8b45a;
		border-bottom: 2px dashed #d8b45a;
	}

	/* On a phone the label and the dotted value share a line above the bits,
	   which then get the full width. */
	@media (max-width: 640px) {
		.bits-figure {
			--c: 9px;
			--d: 5px;
			padding: 0.5rem 0.5rem 0.6rem;
		}

		.row {
			grid-template-columns: 1fr auto;
			row-gap: 1px;
		}

		.row .grid {
			grid-column: 1 / -1;
			grid-row: 2;
		}

		.row.scale .label,
		.row.scale .dec {
			display: none;
		}

		.row:not(.scale):not(:nth-child(2)) {
			margin-top: 4px;
		}

		.b,
		.dot {
			font-size: 0.68rem;
		}

		.dec {
			font-size: 0.8rem;
		}

		.span {
			font-size: 0.64rem;
		}
	}
</style>
