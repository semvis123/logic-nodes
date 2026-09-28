<script lang="ts">
	// A part drawn in a cell, or as an icon when the origin is all there is.
	import type { Part, Levers } from './engine';
	import Flap from './Flap.svelte';

	export let part: Part;
	export let levers: Levers;
	/** Changes each time the marble hits this part, to replay the little bump. */
	export let bump = 0;
	/** Colour each plank with its lever's colour. */
	export let tint = false;

	$: plankOpen = part.kind === 'plank' && !!levers[part.lever] === (part.open === 'down');
	$: seesawA = part.kind === 'seesaw' && !!levers[part.a] && !levers[part.b];
	$: seesawB = part.kind === 'seesaw' && !!levers[part.b] && !levers[part.a];
</script>

{#key bump}
	<g class="part" class:bump={bump > 0}>
		{#if part.kind === 'plank'}
			<Flap
				side={part.side}
				open={plankOpen}
				length={64}
				{tint}
				lever={part.lever}
				arrow={part.open === 'down' ? 'down' : 'up'}
			/>
		{:else if part.kind === 'seesaw'}
			<!-- One assembly: a bar across the cell with a flap hinged at each end. The right hand flap tips the
			     marble left and swings out when only the first lever is down. -->
			<path d="M-28 -16H28" class="bar" />
			<Flap side={1} open={!seesawB} length={34} {tint} lever={part.b} />
			<Flap side={-1} open={!seesawA} length={34} {tint} lever={part.a} />
			<circle cx="0" cy="-16" r="4" class="pivot" />
		{:else}
			<g clip-path="url(#marble-cell-clip)">
				<g transform="scale({part.side} 1)">
					<path d="M-32 -18 32 14v7L-32 -11z" class="ramp" />
					<circle cx="-22" cy="-11.5" r="1.7" class="rivet" />
					<circle cx="0" cy="2.5" r="1.7" class="rivet" />
					<circle cx="22" cy="16.5" r="1.7" class="rivet" />
				</g>
			</g>
		{/if}
	</g>
{/key}

<style>
	.ramp {
		fill: #9fb2c9;
		stroke: #3d4c62;
		stroke-width: 1.6;
		stroke-linejoin: round;
	}
	.bar {
		stroke: #5a636f;
		stroke-width: 5;
		stroke-linecap: round;
	}
	.pivot {
		fill: #cfd6e0;
		stroke: #3d4c62;
		stroke-width: 1.6;
	}
	.rivet {
		fill: #38465a;
	}
	.bump {
		animation: bump 0.28s ease-out;
	}
	@keyframes bump {
		0% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(2.6px);
		}
		100% {
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bump {
			animation: none;
		}
	}
</style>
