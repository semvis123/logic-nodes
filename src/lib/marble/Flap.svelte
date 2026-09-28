<script lang="ts">
	// One hinged board in a cell. Swung shut it is a slope the marble slides down;
	// swung open it hangs against the wall and the marble drops straight past it.
	// The same flap is a plank on its own and half of a seesaw, and it is drawn in
	// cell coordinates with the origin at the middle of the cell.
	import { LEVER_NAMES } from './levels';
	import { SLOPE_DEGREES } from './geometry';

	/** +1 is hinged on the left wall and slopes down to the right, -1 is the mirror image. */
	export let side: 1 | -1 = 1;
	export let open = false;
	export let length = 64;
	/** The lever whose colour the tab wears. */
	export let lever = 0;
	/** A second lever shown as a small ring beside the tab, for the seesaw. */
	export let ring: number | null = null;
	/** Which way the tab's arrow points: the way the lever has to be for the flap to open. */
	export let arrow: 'up' | 'down' | null = null;

	const HINGE_X = 28;
	const HINGE_Y = -16;
	$: hingeX = -side * HINGE_X;
	$: angle = open ? 90 : SLOPE_DEGREES;
</script>

<g class="flap">
	<g clip-path="url(#marble-cell-clip)">
		<g transform="translate({hingeX} {HINGE_Y}) scale({side} 1)">
			<g class="swing" style="transform: rotate({angle}deg)">
				<rect x="0" y="-4" width={length} height="8" rx="3" class="board" />
				<path d="M7 0H{length - 7}" class="grain" />
			</g>
		</g>
	</g>
	<g transform="translate({hingeX} {HINGE_Y})">
		<circle r="7.5" class="tab" style="fill: var(--lever-{lever})" />
		<text class="tab-letter" y="0.5">{LEVER_NAMES[lever]}</text>
		{#if arrow}
			<path class="tab-arrow" d={arrow === 'down' ? 'M-3 10.5h6l-3 4z' : 'M-3 14.5h6l-3-4z'} />
		{/if}
		{#if ring !== null}
			<circle class="ring" cx={side * 9} cy="6" r="3.6" style="stroke: var(--lever-{ring})" />
		{/if}
	</g>
</g>

<style>
	.board {
		fill: #d9a05b;
		stroke: #6b4118;
		stroke-width: 1.6;
	}
	.grain {
		stroke: #a5692a;
		stroke-width: 1.2;
		stroke-linecap: round;
		fill: none;
	}
	.swing {
		transform-origin: 0 0;
		transition: transform 0.3s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	.tab {
		stroke: #1a1a1a;
		stroke-width: 1.6;
	}
	.tab-letter {
		font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace;
		fill: #101010;
		text-anchor: middle;
		dominant-baseline: central;
	}
	.tab-arrow {
		fill: #f2f2f2;
		stroke: #101010;
		stroke-width: 0.8;
		stroke-linejoin: round;
	}
	.ring {
		fill: #101010;
		stroke-width: 2;
	}
	@media (prefers-reduced-motion: reduce) {
		.swing {
			transition: none;
		}
	}
</style>
