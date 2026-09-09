<script lang="ts">
	import { page } from '$app/stores';
	import { tools } from '$lib/tools';

	// Shared chrome and design system for the content pages (the editor itself
	// is a separate world). Everything is scoped under .content so the styles
	// can never reach the canvas route after a client side navigation.
	export let related: { href: string; label: string }[] = [];

	// The tools would swamp the bar, so they live behind a hub page.
	const nav = [
		{ href: '/learn', label: 'Learn' },
		{ href: '/logic-gates', label: 'Gates' },
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/tools', label: 'Tools' },
		{ href: '/practice', label: 'Practice' }
	];

	// A section counts as current when the path starts with it, so the gate
	// detail pages keep "Gates" highlighted; each tool keeps "Tools" lit.
	const toolPaths = tools.map((tool) => tool.href);

	// Pages that belong to a section without living under its path.
	const alsoIn: Record<string, string[]> = {
		'/logic-gates': ['/logic-gate-symbols'],
		'/tools': [...toolPaths, '/boolean-algebra-laws'],
		'/learn': ['/common-circuits', '/combinational-vs-sequential'],
		'/flip-flops': ['/counters', '/shift-registers']
	};
	/** Printing should not hide answers behind a collapsed summary. */
	function openAll() {
		document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
	}

	$: current = (href: string) => {
		const path = $page.url.pathname;
		if (path === href || path.startsWith(`${href}/`)) return true;
		return (alsoIn[href] ?? []).includes(path);
	};
</script>

<svelte:head>
	<!-- Every social card this site generates is 1200x630. Declaring it here
	     rather than on 20 pages means a card can never be described wrongly, and
	     lets a scraper lay out the preview before the image has downloaded. -->
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/png" />
</svelte:head>

<svelte:window on:beforeprint={openAll} />

<div class="content">
	<!-- The first thing a keyboard user reaches, so the nav can be stepped over
	     on every page rather than tabbed through each time. -->
	<a class="skip" href="#main">Skip to content</a>

	<header class="topbar">
		<a class="brand" href="/"><span class="brand-box" /> <span class="brand-text">Logic Nodes</span></a>
		<nav class="nav" aria-label="Sections">
			{#each nav as item}
				<a href={item.href} aria-current={current(item.href) ? 'page' : undefined}>
					{item.label}
				</a>
			{/each}
		</nav>
		<!-- Two labels rather than one: on a phone the long one squeezes the nav
		     until the current section is cut off mid-word. -->
		<a class="toolbar-btn" href="/simulator"
			><span class="btn-long">Open the simulator</span><span class="btn-short">Simulator</span></a
		>
	</header>

	<main id="main" tabindex="-1">
		<slot />
	</main>

	<footer class="footer">
		{#if related.length}
			<p class="related">
				More:
				{#each related as link, i}<a href={link.href}>{link.label}</a>{#if i < related.length - 1}
						<span aria-hidden="true"> · </span>
					{/if}{/each}
			</p>
		{/if}
		<p>
			Logic Nodes is free and open source under Apache 2.0.
			<a href="https://github.com/semvis123/logic-nodes">Source on GitHub</a>.
		</p>
		<p>
			Built by <a href="https://kriyak.com/">Sem, a freelance software developer</a>. Curious about the internals?
			<a href="https://kriyak.com/blog/hand-writing-a-canvas-node-editor/"> Read how it's built </a>
			or see the <a href="https://kriyak.com/project/logic-nodes/">project page</a>.
		</p>
	</footer>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		background-color: #1d1e20;
	}

	/* The main landmark sits inside .content, which draws the grid, so it must
	   not paint a background of its own over it. It used to live in app.html,
	   wrapping everything from the outside, where a background was harmless. */
	:global(main) {
		margin: 0;
		padding: 0;
		background: none;
	}

	.skip {
		position: absolute;
		left: 0.5rem;
		top: -3rem;
		z-index: 10;
		background: #0d0d0f;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		padding: 0.5rem 0.9rem;
		text-decoration: none;
		transition: top 0.15s;
	}

	.skip:focus {
		top: 0.5rem;
	}

	/* The target of the skip link should not draw a ring when it receives focus
	   programmatically; it is a landing spot, not a control. */
	main:focus {
		outline: none;
	}

	/* One focus treatment for the whole site. Without this, custom dark controls
	   fall back to whatever ring the browser picks, which varies per element. */
	.content :global(a:focus-visible),
	.content :global(button:focus-visible),
	.content :global(input:focus-visible),
	.content :global(select:focus-visible),
	.content :global(textarea:focus-visible),
	.content :global(summary:focus-visible),
	.content :global([tabindex]:focus-visible),
	.skip:focus-visible,
	.topbar a:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: 2px;
		border-radius: 2px;
	}

	.content {
		min-height: 100vh;
		background-color: #1d1e20;
		background-image: linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
		background-size: 45px 45px;
		color: #fff;
		font: normal normal normal 16px/1.6 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 1rem;
		height: 38px;
		background-color: #101010;
		border-bottom: solid 1px #444;
		padding: 0 10px;
		font-size: 14px;
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
		min-width: 0;
		/* Narrow screens scroll the nav sideways rather than wrapping the bar.
		   The fade on the trailing edge is what says so: without it a clipped
		   item just looks like a rendering fault. */
		overflow-x: auto;
		scrollbar-width: none;
	}

	.btn-short {
		display: none;
	}

	.nav::-webkit-scrollbar {
		display: none;
	}

	.nav a {
		color: #bbb;
		text-decoration: none;
		font-size: 13px;
		padding: 0 8px;
		line-height: 36px;
		white-space: nowrap;
		border-bottom: 2px solid transparent;
	}

	.nav a:hover {
		color: #fff;
	}

	.nav a[aria-current='page'] {
		color: #fff;
		border-bottom-color: #5db65d;
	}

	.brand {
		flex: none;
	}

	.toolbar-btn {
		flex: none;
	}

	@media (max-width: 700px) {
		/* The brand text is redundant next to the nav on a phone, but the box on
		   its own is decorative, so hiding it outright leaves the home link with
		   no name at all. Take it out of the layout, not out of the page. */
		.brand-text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}

		.btn-long {
			display: none;
		}

		.btn-short {
			display: inline;
		}

		/* Only where the bar can actually overflow: the fade is what marks a cut
		   off item as scrollable rather than broken. */
		.nav {
			mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent);
			-webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent);
		}
	}

	.brand {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #fff;
		text-decoration: none;
	}

	.brand:hover {
		text-decoration: underline;
	}

	/* Like an active input node in the editor: green fill, white border. */
	.brand-box {
		display: inline-block;
		width: 12px;
		height: 12px;
		background-color: #372;
		border: 1px solid #fff;
		border-radius: 3px;
	}

	.toolbar-btn {
		box-sizing: border-box;
		background-color: #060606;
		border: solid 1px rgb(133, 133, 133);
		color: #fff;
		padding: 0 10px;
		height: 26px;
		line-height: 24px;
		text-align: center;
		text-decoration: none;
		font-size: 13px;
		border-radius: 3px;
	}

	.toolbar-btn:hover {
		background-color: #1a1a1a;
	}

	.footer {
		max-width: 940px;
		margin: 3.5rem auto 0;
		padding: 1.5rem 20px 2.5rem;
		border-top: 1px solid #444;
		color: #999;
		font-size: 0.92rem;
	}

	.footer a {
		color: #ddd;
	}

	.related a {
		color: #fff;
	}

	/* Padding rather than literal spaces: Svelte trims whitespace between the
	   each-block separator and the links. */
	.related span {
		padding: 0 0.35rem;
		color: #999;
	}

	/* --- shared layout and components for the slotted page content --- */

	.content :global(section) {
		max-width: 940px;
		margin: 0 auto;
		padding: 0 20px;
	}

	.content :global(h1) {
		font-size: 2.4rem;
		line-height: 1.15;
		margin: 0 0 0.75rem;
	}

	.content :global(h2) {
		font-size: 1.4rem;
		margin: 3.2rem 0 1rem;
	}

	.content :global(h3) {
		font-size: 1rem;
		margin: 0 0 0.4rem;
	}

	.content :global(.lede) {
		color: #bbb;
		font-size: 1.05rem;
		max-width: 640px;
		margin: 0 0 1.5rem;
	}

	.content :global(.section-intro) {
		color: #bbb;
		max-width: 660px;
		margin-top: 0;
	}

	.content :global(p) {
		color: #ddd;
	}

	.content :global(.reducer) {
		color: #888;
		font-size: 0.85rem;
		margin-top: 0.75rem;
		max-width: 660px;
	}

	.content :global(.card) {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
	}

	.content :global(.cta) {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background-color: #372;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		text-decoration: none;
		padding: 0.65rem 1.4rem;
		font-weight: 600;
	}

	.content :global(.cta:hover) {
		background-color: #483;
	}

	.content :global(a) {
		color: #8ede8e;
	}

	.content :global(kbd) {
		font: 600 0.85em ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.55);
		border-bottom-width: 2px;
		border-radius: 3px;
		padding: 0 4px;
		background: #0d0d0f;
	}

	.content :global(.faq details) {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		margin-bottom: 8px;
		padding: 0.6rem 0.9rem;
	}

	.content :global(.faq summary) {
		cursor: pointer;
		font-weight: 600;
	}

	.content :global(.faq p) {
		color: #bbb;
		margin: 0.5rem 0 0.2rem;
	}

	/* Data tables: the reference tables and the generated truth tables. */
	.content :global(.data-table) {
		border-collapse: collapse;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		font-variant-numeric: tabular-nums;
	}

	.content :global(.data-table th),
	.content :global(.data-table td) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		padding: 0.4rem 0.85rem;
		text-align: left;
		color: #bbb;
		font-weight: normal;
		background-color: transparent;
	}

	.content :global(.data-table thead th) {
		color: #fff;
		font-weight: 600;
		font-size: 0.85rem;
		white-space: nowrap;
		background-color: #101012;
	}

	.content :global(.data-table tbody tr:last-child th),
	.content :global(.data-table tbody tr:last-child td) {
		border-bottom: none;
	}

	/* Wide reference tables scroll sideways on a phone instead of pushing the
	   whole page wider. */
	.content :global(.table-wrap) {
		overflow-x: auto;
	}

	.content :global(.mono) {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #ddd;
	}

	/* --- print --- */

	@media print {
		/* Ink on paper: drop the dark theme rather than flooding the page. */
		:global(html),
		:global(body),
		:global(main) {
			background: #fff !important;
		}

		.content {
			background: #fff !important;
			background-image: none !important;
			color: #000;
		}

		.content :global(*) {
			color: #000 !important;
			box-shadow: none !important;
		}

		.topbar,
		.footer,
		.content :global(.screen-only),
		.content :global(.no-print),
		.content :global(.cta),
		.content :global(button),
		.content :global(select),
		.content :global(input) {
			display: none !important;
		}

		/* The paper copy of a figure, hidden on screen and shown here. */
		.content :global(.print-only) {
			display: block !important;
		}

		.content :global(section) {
			max-width: none;
			padding: 0;
		}

		.content :global(.card) {
			background: #fff !important;
			border: 1px solid #999 !important;
		}

		.content :global(.data-table) {
			background: #fff !important;
			border-color: #000 !important;
		}

		.content :global(.data-table th),
		.content :global(.data-table td) {
			border-color: #999 !important;
		}

		.content :global(.data-table thead th) {
			background: #eee !important;
		}

		/* Keep a table, a figure or a question from splitting across pages. */
		.content :global(table),
		.content :global(figure),
		.content :global(li),
		.content :global(details) {
			break-inside: avoid;
		}

		.content :global(h1),
		.content :global(h2),
		.content :global(h3) {
			break-after: avoid;
		}

		/* Open every answer, so a printed page is not full of empty summaries.
		   The beforeprint handler adds the open attribute in browsers that fire
		   it; this reveals the content in the ones that do not. */
		.content :global(details) {
			display: block;
		}

		.content :global(details > *) {
			display: block !important;
		}

		.content :global(details)::details-content {
			content-visibility: visible !important;
			block-size: auto !important;
		}

		/* Spell out where a link went, since a printed page cannot be clicked. */
		.content :global(a[href^='http'])::after {
			content: ' (' attr(href) ')';
			font-size: 0.85em;
			color: #555 !important;
		}
	}

	/* Signal values, coloured the way the editor colours its wires. The td
	   qualifier is needed to outrank the .data-table td colour above. */
	.content :global(td.bit-1) {
		color: #5db65d;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.content :global(td.bit-0) {
		color: #f66;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	/* Don't cares read as neither high nor low. */
	.content :global(td.bit-x) {
		color: #d8b45a;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
</style>
