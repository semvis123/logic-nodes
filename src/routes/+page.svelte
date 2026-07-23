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
	// listeners or the context-menu override behind. Note: reset(true) is NOT
	// a teardown, it rebuilds the editor and re-adds the listeners.
	onDestroy(() => {
		if (typeof document === 'undefined') return; // SSR runs onDestroy too
		document.oncontextmenu = null;
		nodeSystem?.destroy();
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
		content="Build and simulate digital logic circuits in your browser. Free logic gate simulator with truth tables, boolean expressions, and shareable circuits."
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
	<!-- Crawlable heading + intro for the editor route. Visually hidden so the
	     editor's appearance is unchanged, but present in the prerendered HTML
	     (Googlebot renders JS and would otherwise see only the canvas) and read
	     by screen readers. Single, accurate H1 matching the page's purpose. -->
	<h1 class="sr-only">Online Logic Gate Simulator</h1>
	<p class="sr-only">
		Free online logic gate simulator and digital circuit builder — a no-signup, open-source
		alternative to tools like Logic.ly and Logisim. Build circuits with AND, OR, NOT, XOR, NAND
		and NOR gates, generate truth tables and boolean expressions, and share them with a link.
		<a href="/about">Learn how it works</a>.
	</p>
	<noscript>
		<p class="noscript-note">
			Logic Nodes is a free online logic gate simulator. Enable JavaScript to build and simulate
			circuits, or read the <a href="/about">feature overview and guide</a>.
		</p>
	</noscript>
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

	/* Present in the DOM for crawlers and screen readers, but not painted, so the
	   editor layout is untouched. */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.noscript-note {
		position: absolute;
		top: 40px;
		left: 12px;
		right: 12px;
		z-index: 3;
		color: #ccc;
		font: normal normal normal 14px/1.5 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
