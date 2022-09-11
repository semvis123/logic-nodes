
<script lang="ts">
	import { NodeSystem } from '../nodesystem/NodeSystem';
	import { onMount } from 'svelte';

	export const csr = false;
	export const prerender = true;

	let canvas: HTMLCanvasElement;

	let width = 500;
	let height = 500;
	let nodeSystem = null;
	let overlayContainer = null;
	$: (width, height), resize();

	onMount(() => {
		nodeSystem = new NodeSystem(canvas, overlayContainer);
		document.oncontextmenu = (e) => {
			e.preventDefault();
			return false;
		};
	});

	const resize = () => {
		if (nodeSystem == null) return;
		nodeSystem.nodeRenderer.render();
	};
</script>

<svelte:head>
	<style>
		html,
		body {
			margin: 0;
			padding: 0;
			height: 100%;
			width: 100%;
			overflow: hidden;
		}
		.container {
			width: 100%;
			height: 100%;
		}
		.overlayContainer {
			position: absolute;
			top: 0;
			left: 0;
		}
	</style>
</svelte:head>

<div class="container" bind:clientWidth={width} bind:clientHeight={height}>
	<canvas bind:this={canvas} {width} {height} />
	<div class="overlayContainer" bind:this={overlayContainer} />
</div>
