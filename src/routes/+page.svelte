<script lang="ts">
	import { NodeSystem } from '../nodesystem/NodeSystem';
	import { onMount } from 'svelte';
	let canvas: HTMLCanvasElement;

	let width = 500;
	let height = 500;
	let dpi = 1;
	let nodeSystem: NodeSystem = null;
	let canvasOverlayContainer: HTMLDivElement;
	let overlayContainer: HTMLDivElement;
	$: (width, height), resize();

	onMount(() => {
		nodeSystem = new NodeSystem(canvas, canvasOverlayContainer, overlayContainer);
		document.oncontextmenu = (e) => {
			e.preventDefault();
			return false;
		};
	});

	const resize = () => {
		if (nodeSystem == null) return;
		nodeSystem.nodeRenderer.requestRender();
		// set dpi
		dpi = devicePixelRatio || 1;
		nodeSystem.nodeRenderer.setDPI(dpi);
	};
</script>

<svelte:head>
	<style>
		* {
			-webkit-user-select: none;
			-moz-user-select: none;
			-ms-user-select: none;
			user-select: none;
		}
		html,
		body {
			margin: 0;
			padding: 0;
			height: 100%;
			width: 100%;
			overflow: hidden;
			/* fixes white background flickering on resize */
			background-color: #222;
		}
		.container,
		canvas {
			width: 100%;
			height: 100%;
		}
		.overlayContainer {
			position: absolute;
			top: 0;
			left: 0;
			height: 100vh;
			width: 100vw;
			backface-visibility: hidden;
		}
		.canvasOverlayContainerWrapper {
			position: fixed;
			top: 0;
			left: 0;
		}
	</style>
</svelte:head>

<div class="container" bind:clientWidth={width} bind:clientHeight={height}>
	<canvas bind:this={canvas} width={width * dpi} height={height * dpi} />
	<div class="canvasOverlayContainerWrapper">
		<div class="overlayContainer" bind:this={canvasOverlayContainer} />
	</div>
	<div class="overlayContainer" bind:this={overlayContainer} />
	<div class="toast-message-container" id="toast-container" />
</div>
