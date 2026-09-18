<script lang="ts">
	// The two-column frame every lesson sits in: roadmap on the left, lesson on
	// the right. On a phone the roadmap folds into a bar above the lesson. The
	// shared styles for widgets live here too, so a lesson author gets toggles
	// and lamps that look like the rest of the site without restating them.
	import { onMount } from 'svelte';
	import Sidebar from './Sidebar.svelte';
	import { loadProgress } from './progress';

	export let current = '';

	onMount(loadProgress);
</script>

<div class="course">
	<details class="drawer">
		<summary>Roadmap</summary>
		<div class="drawer-body"><Sidebar {current} /></div>
	</details>
	<aside class="side">
		<Sidebar {current} />
	</aside>
	<div class="main">
		<slot />
	</div>
</div>

<style>
	.course {
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr);
		gap: 2.5rem;
		max-width: 1240px;
		margin: 0 auto;
		padding: 0 20px;
	}

	/* Sections inside the frame span the column, not the site's usual 940px. */
	.main :global(section) {
		max-width: none;
		padding: 0;
	}

	.side {
		position: sticky;
		top: 38px;
		align-self: start;
		max-height: calc(100vh - 38px);
		overflow-y: auto;
		padding: 48px 0 2rem;
		border-right: 1px solid rgba(255, 255, 255, 0.12);
		padding-right: 1rem;
	}

	.drawer {
		display: none;
	}

	@media (max-width: 900px) {
		.course {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}

		.side {
			display: none;
		}

		.drawer {
			display: block;
			margin: 1rem 0 0;
			background-color: #161618;
			border: 1px solid rgba(255, 255, 255, 0.25);
			border-radius: 3px;
		}

		.drawer summary {
			cursor: pointer;
			padding: 0.5rem 0.8rem;
			font-weight: 600;
		}

		.drawer-body {
			padding: 0.4rem 0.8rem 0.8rem;
		}
	}

	@media print {
		.side,
		.drawer {
			display: none;
		}

		.course {
			display: block;
		}
	}

	/* Shared widget chrome. Every widget is a card with a title line; the
	   toggles and lamps match the live full adder that the old Learn page had. */
	.course :global(.widget) {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 1rem 1.1rem 1.1rem;
		margin: 1.2rem 0;
	}

	.course :global(.widget-title) {
		margin: 0 0 0.7rem;
		color: #bbb;
		font-size: 0.9rem;
	}

	.course :global(.toggle) {
		background-color: #40191c;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.course :global(.toggle.on) {
		background-color: #372;
	}

	.course :global(.out) {
		display: inline-block;
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		color: #fff;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
	}

	.course :global(.out.on) {
		background-color: #372;
	}

	/* Inside a lit toggle or lamp the site's grey monospace falls below the
	   contrast the sweep test asks for, so it takes the button's own colour. */
	.course :global(.toggle .mono),
	.course :global(.out .mono) {
		color: inherit;
	}

	.course :global(.val) {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 600;
		margin-left: 0.3rem;
	}

	.course :global(.arrow) {
		color: #949494;
	}

	.course :global(.lamp) {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.5);
		background-color: #f23;
		vertical-align: middle;
	}

	.course :global(.lamp.on) {
		background-color: #5db65d;
	}

	.course :global(.try) {
		border-left: 2px solid #5db65d;
		padding-left: 0.9rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.course :global(.toggle) {
			transition: none;
		}
	}

	@media print {
		.course :global(.widget) {
			background: #fff;
			border-color: #999;
		}
	}
</style>
