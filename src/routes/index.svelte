<script lang="ts">
	import { onMount } from 'svelte';
	import { NodeRenderer } from '../nodesystem/NodeRenderer';

	let canvas;

	onMount(() => {
		document.oncontextmenu = (e) => {
			e.preventDefault();
			return false;
		};
		let dpi = window.devicePixelRatio;
		let style_width = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
		canvas.setAttribute('width', (style_width * dpi).toString());
		const nodeRenderer = new NodeRenderer(canvas);
		nodeRenderer.render();
	});
</script>

<svelte:head>
	<style>
		html, body {
			margin: 0;
			padding: 0;
			height: 100%;
			overflow: hidden;
		}
	</style>
</svelte:head>

<canvas width={1500} height={1500} bind:this={canvas} />

<style>
</style>
