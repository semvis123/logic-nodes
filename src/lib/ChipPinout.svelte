<script lang="ts">
	// The 7400-series part for a gate: the 14-pin DIP drawn from above with each
	// gate wired to its pins, and the same pinout as a table for readers who
	// cannot see the drawing. A part whose pinout is not published here gets
	// the part numbers and a pointer to the datasheet instead.
	import { chipFor, pinTable, pinSummary, pinoutDrawing, PINOUT_WIDTH, PINOUT_HEIGHT } from '$lib/chips';

	/** The gate slug: and, or, not, nand, nor, xor or xnor. */
	export let gate: string;

	$: chip = chipFor(gate);
	$: pins = chip ? pinTable(chip) : [];
	$: prims = chip?.gates ? pinoutDrawing(chip) : [];
</script>

{#if chip}
	<div class="chip">
		<p class="parts">
			{#each chip.parts as part, i}<span class="mono part">{part}</span>{i < chip.parts.length - 1 ? ', ' : ''}{/each}:
			{chip.description}, 14-pin DIP
		</p>
		{#if chip.gates}
			<div class="layout">
				<svg
					class="drawing"
					viewBox="0 0 {PINOUT_WIDTH} {PINOUT_HEIGHT}"
					role="img"
					aria-label="{pinSummary(chip)}. Top view, notch at the top."
				>
					{#each prims as p}
						{#if p.k === 'line'}
							<line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} class={p.role} />
						{:else if p.k === 'path'}
							<path d={p.d} transform={p.transform} class={p.role} />
						{:else if p.k === 'circle'}
							<circle cx={p.cx} cy={p.cy} r={p.r} class={p.role} />
						{:else if p.k === 'rect'}
							<rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} class={p.role} />
						{:else}
							<text x={p.x} y={p.y} text-anchor={p.anchor} class={p.role}>{p.text}</text>
						{/if}
					{/each}
				</svg>
				<div class="table-wrap">
					<table class="data-table pins">
						<caption>{chip.part} pin functions</caption>
						<thead>
							<tr>
								<th scope="col">Pin</th>
								<th scope="col">Name</th>
								<th scope="col">Function</th>
							</tr>
						</thead>
						<tbody>
							{#each pins as pin}
								<tr>
									<td class="num">{pin.pin}</td>
									<th scope="row" class="mono">{pin.name}</th>
									<td>{pin.function}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<p class="check">
				The pin diagram is not shown here. Check the manufacturer's datasheet for the exact part you have before wiring
				it: VCC and GND are on pins 14 and 7, but the gate pins are not laid out as on the 7400.
			</p>
		{/if}
		<ul class="notes">
			{#each [...chip.families, ...chip.notes] as note}
				<li>{note}</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.parts {
		color: #ddd;
	}

	.part {
		color: #8ede8e;
	}

	.layout {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 24px;
		align-items: flex-start;
	}

	.drawing {
		display: block;
		width: 100%;
		max-width: 440px;
		height: auto;
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
	}

	.drawing .body {
		fill: #1f1f23;
		stroke: #8a8a8a;
		stroke-width: 2;
	}

	.drawing .dot {
		fill: #ddd;
	}

	.drawing .pin {
		fill: #2c2c30;
		stroke: #9a9a9a;
		stroke-width: 1;
	}

	.drawing .pin-number {
		fill: #fff;
		font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.drawing .pin-name {
		fill: #ddd;
		font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.drawing .power {
		fill: #8ede8e;
		font: 600 13px ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.drawing .wire {
		stroke: #bbb;
		stroke-width: 1.5;
		fill: none;
	}

	.drawing .gate {
		fill: #161618;
		stroke: #8ede8e;
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.drawing .gate-line {
		fill: none;
		stroke: #8ede8e;
		stroke-width: 2;
	}

	.drawing .part {
		fill: #888;
		font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
		letter-spacing: 0.08em;
	}

	.pins caption {
		caption-side: top;
		text-align: left;
		color: #999;
		font-size: 0.8rem;
		padding-bottom: 0.3rem;
	}

	.pins td,
	.pins th {
		padding: 0.2rem 0.75rem;
		font-size: 0.85rem;
	}

	.pins .num {
		text-align: right;
	}

	.check {
		color: #ddd;
		max-width: 640px;
	}

	.notes {
		color: #bbb;
		font-size: 0.85rem;
		padding-left: 1.25rem;
		max-width: 640px;
	}
</style>
