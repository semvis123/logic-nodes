<script lang="ts">
	import { onMount } from 'svelte';
	import { uuid } from '../nodesystem/utils';
	import { NodeRenderer } from '../nodesystem/NodeRenderer';

	let canvas;

	onMount(() => {
		console.log(uuid());
		const nodeRenderer = new NodeRenderer(canvas);
		nodeRenderer.render();
	});
</script>

<svelte:head>
	<style>
		html,
		body {
			margin: 0;
			padding: 0;
			height: 100%;
			overflow: hidden;
		}
	</style>
</svelte:head>

<canvas width={1500} height={1500} bind:this={canvas} />

<style>
	canvas {
		width: 100%;
		height: 100%;
		background-color: #666;
	}
</style>
