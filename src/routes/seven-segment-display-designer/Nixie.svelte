<script lang="ts">
	// A stylised Nixie tube: ten numerals stacked in the same place, one glowing.
	// A digit of null leaves the tube dark.
	export let digit: number | null = null;
	export let label = '';
	export let uid = 0;
	const numerals = Array.from({ length: 10 }, (_, i) => i);
</script>

<svg
	viewBox="0 0 60 100"
	class="tube"
	role="img"
	aria-label={label || (digit === null ? 'Dark Nixie tube' : `Nixie tube showing ${digit}`)}
>
	<defs>
		<filter id="glow{uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
	</defs>
	<rect x="4" y="2" width="52" height="86" rx="24" class="glass" class:on={digit !== null} />
	<rect x="14" y="88" width="32" height="9" rx="2" class="base" />
	{#each numerals as n}
		<text x="30" y="58" dy="0.35em" class="num idle">{n}</text>
	{/each}
	{#if digit !== null}
		<text x="30" y="58" dy="0.35em" class="num glowing" filter="url(#glow{uid})">{digit}</text>
		<text x="30" y="58" dy="0.35em" class="num hot">{digit}</text>
	{/if}
</svg>

<style>
	.tube {
		display: block;
		width: 100%;
		height: auto;
	}
	.glass {
		fill: #1a1210;
		stroke: #6b4a3a;
		stroke-width: 1.5;
	}
	.glass.on {
		fill: #2a1508;
		stroke: #b8743c;
	}
	.base {
		fill: #3a3a3e;
	}
	.num {
		font: 700 46px Georgia, 'Times New Roman', serif;
		text-anchor: middle;
		fill: none;
	}
	.idle {
		stroke: #6a4a34;
		stroke-width: 0.6;
		opacity: 0.35;
	}
	.glowing {
		fill: #ff8a1f;
		stroke: #ff8a1f;
		stroke-width: 3;
	}
	.hot {
		fill: #ffb25c;
		stroke: #ff9a3c;
		stroke-width: 1;
	}
</style>
