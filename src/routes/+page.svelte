<script lang="ts">
	import { NodeSystem } from '../nodesystem/NodeSystem';
	import { onMount, onDestroy } from 'svelte';

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

	// Client-side navigation to /about must not leave the editor's window
	// listeners or the context-menu override behind.
	onDestroy(() => {
		if (typeof document === 'undefined') return; // SSR runs onDestroy too
		document.oncontextmenu = null;
		nodeSystem?.reset(true);
		nodeSystem = null;
	});

	const resize = () => {
		if (nodeSystem == null) return;
		nodeSystem.nodeRenderer.requestRender();
		// set dpi
		dpi = devicePixelRatio || 1;
		nodeSystem.nodeRenderer.setDPI(dpi);
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'Logic Nodes',
		url: 'https://nodes.kriyak.com/',
		applicationCategory: 'EducationalApplication',
		operatingSystem: 'Web browser',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
		description:
			'Free online logic gate simulator. Build and simulate digital logic circuits in the browser, generate truth tables and boolean expressions, and share circuits with a link.',
		screenshot: 'https://nodes.kriyak.com/og-image.png',
		author: { '@type': 'Person', name: 'Sem', url: 'https://kriyak.com/about/', '@id': 'https://kriyak.com/#person' },
		license: 'https://www.apache.org/licenses/LICENSE-2.0'
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>Logic Nodes | Free Online Logic Gate Simulator</title>
	<meta
		name="description"
		content="Build and simulate digital logic circuits in your browser. Free logic gate simulator with truth tables, boolean expressions, custom nodes, and shareable circuits. No signup."
	/>
	<link rel="canonical" href="https://nodes.kriyak.com/" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Logic Nodes" />
	<meta property="og:title" content="Logic Nodes | Free Online Logic Gate Simulator" />
	<meta
		property="og:description"
		content="Build and simulate digital logic circuits in your browser. Truth tables, boolean expressions, custom nodes, and shareable circuits. Free, no signup."
	/>
	<meta property="og:url" content="https://nodes.kriyak.com/" />
	<meta property="og:image" content="https://nodes.kriyak.com/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Logic Nodes | Free Online Logic Gate Simulator" />
	<meta name="twitter:image" content="https://nodes.kriyak.com/og-image.png" />
	{@html jsonLd}
</svelte:head>

<div class="container" bind:clientWidth={width} bind:clientHeight={height}>
	<canvas bind:this={canvas} width={width * dpi} height={height * dpi} />
	<div class="canvasOverlayContainerWrapper">
		<div class="overlayContainer" bind:this={canvasOverlayContainer} />
	</div>
	<div class="overlayContainer" bind:this={overlayContainer} />
	<div class="toast-message-container" id="toast-container" />
	<a class="about-link" href="/about">about</a>
</div>

<style>
	/* Scoped to this page instead of a global <svelte:head> style block, so
	   client-side navigation to /about doesn't inherit overflow:hidden and
	   user-select:none. The container is fixed to the viewport, which keeps
	   the page unscrollable here without touching html/body. */
	:global(html),
	:global(body),
	:global(main) {
		margin: 0;
		padding: 0;
	}

	.container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background-color: #1d1e20;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		user-select: none;
	}

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

	.about-link {
		position: fixed;
		top: 0;
		right: 8px;
		z-index: 2;
		height: 30px;
		line-height: 30px;
		font: normal normal normal 14px/30px 'Helvetica Neue', Helvetica, Arial, sans-serif;
		color: #ccc;
		text-decoration: none;
		padding: 0 6px;
	}

	.about-link:hover {
		color: #fff;
		text-decoration: underline;
	}
</style>
