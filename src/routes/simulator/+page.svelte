<script lang="ts">
	import { SITE } from '$lib/site';
	import { NodeSystem } from '../../nodesystem/NodeSystem';
	import { onMount, onDestroy } from 'svelte';
	import { modifiedFields } from '$lib/lastmod';

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

	// Same @id values as the about page, so both pages describe one entity.
	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				'@id': `${SITE}/#website`,
				url: `${SITE}/`,
				name: 'Logic Nodes',
				description: 'Free online logic gate simulator',
				inLanguage: 'en',
				publisher: { '@id': 'https://kriyak.com/#person' }
			},
			{
				'@type': 'WebPage',
				'@id': `${SITE}/simulator#webpage`,
				url: `${SITE}/simulator`,
				name: 'Logic Nodes | Free Online Logic Gate Simulator',
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				inLanguage: 'en',
				...modifiedFields(`${SITE}/simulator`)
			},
			{
				'@type': 'SoftwareApplication',
				'@id': `${SITE}/#app`,
				name: 'Logic Nodes',
				url: `${SITE}/simulator`,
				applicationCategory: 'EducationalApplication',
				applicationSubCategory: 'Logic gate simulator',
				operatingSystem: 'Web browser',
				browserRequirements: 'Requires JavaScript and HTML5 canvas support',
				isAccessibleForFree: true,
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
				description:
					'Free online logic gate simulator. Build and simulate digital logic circuits in the browser, generate truth tables and boolean expressions, and package circuits into reusable custom nodes.',
				screenshot: `${SITE}/og-image.png`,
				softwareHelp: { '@id': `${SITE}/#webpage` },
				inLanguage: 'en',
				author: { '@id': 'https://kriyak.com/#person' },
				license: 'https://www.apache.org/licenses/LICENSE-2.0'
			},
			{
				'@type': 'Person',
				'@id': 'https://kriyak.com/#person',
				name: 'Sem',
				url: 'https://kriyak.com/about/',
				jobTitle: 'Software developer',
				sameAs: ['https://github.com/semvis123', 'https://kriyak.com/']
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>The Simulator | Logic Nodes Logic Gate Editor</title>
	<meta
		name="description"
		content="Build and simulate digital logic circuits in your browser. Free logic gate simulator with truth tables, boolean expressions, and custom nodes."
	/>
	<link rel="canonical" href="https://logicgates.org/simulator" />
	<meta name="author" content="Sem" />
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Logic Nodes" />
	<meta property="og:title" content="The Logic Nodes circuit editor" />
	<meta
		property="og:description"
		content="Build and simulate digital logic circuits in your browser. Truth tables, boolean expressions, custom nodes, and example circuits. Free, no signup."
	/>
	<meta property="og:url" content="https://logicgates.org/simulator" />
	<meta property="og:image" content="https://logicgates.org/og/simulator.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="The Logic Nodes editor with a logic circuit on the canvas" />
	<meta property="og:locale" content="en" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="The Logic Nodes circuit editor" />
	<meta
		name="twitter:description"
		content="Build and simulate digital logic circuits in your browser. Truth tables, boolean expressions, custom nodes, and example circuits. Free, no signup."
	/>
	<meta name="twitter:image" content="https://logicgates.org/og/home.png" />
	<meta name="twitter:image:alt" content="The Logic Nodes editor with a logic circuit on the canvas" />
	{@html jsonLd}
</svelte:head>

<div class="container" bind:clientWidth={width} bind:clientHeight={height}>
	<canvas bind:this={canvas} width={width * dpi} height={height * dpi} />
	<div class="canvasOverlayContainerWrapper">
		<div class="overlayContainer" bind:this={canvasOverlayContainer} />
	</div>
	<div class="overlayContainer" bind:this={overlayContainer} />
	<div class="toast-message-container" id="toast-container" />
	<!-- The editor is all canvas, so the page still needs a heading and some
	     copy for screen readers and for search results. Present in the
	     prerendered HTML, since a crawler that does not run the script would
	     otherwise see nothing but an empty canvas. -->
	<h1 class="visually-hidden">Online logic gate simulator</h1>
	<p class="visually-hidden">
		A free logic gate simulator and digital circuit builder that runs in the browser, and an open-source alternative to
		tools like Logic.ly and Logisim. Build circuits from AND, OR, NOT, XOR, NAND and NOR gates, then generate their
		truth tables and boolean expressions.
		<a href="/">Learn how it works</a>.
	</p>
	<noscript>
		<p class="noscript-note">
			Logic Nodes is a free online logic gate simulator. Enable JavaScript to build and simulate circuits, or read the <a
				href="/">feature overview and guide</a
			>.
		</p>
	</noscript>
	<div class="corner-links">
		<a href="https://kriyak.com/" rel="author">by kriyak</a>
		<a href="/">about</a>
	</div>
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

	.noscript-note {
		position: absolute;
		top: 48px;
		left: 12px;
		right: 12px;
		z-index: 5;
		background: #0d0d0f;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #ddd;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		padding: 0.8rem 1rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.corner-links {
		position: fixed;
		top: 0;
		right: 8px;
		z-index: 2;
		display: flex;
		align-items: center;
		height: 30px;
	}

	.corner-links a {
		height: 30px;
		font: normal normal normal 14px/30px 'Helvetica Neue', Helvetica, Arial, sans-serif;
		color: #ccc;
		text-decoration: none;
		padding: 0 6px;
	}

	.corner-links a:hover {
		color: #fff;
		text-decoration: underline;
	}
</style>
