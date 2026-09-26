<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import type { SearchEntry } from '$lib/searchIndex';
	import { search } from '$lib/search';

	// Ctrl+K (⌘K on a Mac), or "/" when not typing, jumps anywhere on the site.
	// The list comes from /search.json, fetched the first time the palette
	// opens, so it adds nothing to the page until someone uses it.

	// This TypeScript's DOM types predate <dialog>'s methods, which every
	// current browser has.
	type Dialog = HTMLElement & { open: boolean; showModal(): void; close(): void };
	let dialogEl: HTMLElement;
	const dialog = () => dialogEl as unknown as Dialog;
	let input: HTMLInputElement;
	let list: HTMLElement;
	let open = false;
	let query = '';
	let active = 0;
	let entries: SearchEntry[] | null = null;
	let failed = false;
	let mac = false;

	onMount(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform);
	});

	async function load() {
		if (entries) return;
		failed = false;
		try {
			const response = await fetch('/search.json');
			if (!response.ok) throw new Error(String(response.status));
			entries = await response.json();
		} catch {
			failed = true;
		}
	}

	async function show() {
		if (open) return;
		open = true;
		query = '';
		active = 0;
		await tick();
		dialog().showModal();
		input.focus();
		load();
	}

	function close() {
		if (dialogEl && dialog().open) dialog().close();
	}

	function go(href: string) {
		close();
		goto(href);
	}

	$: results = entries ? search(entries, query) : [];
	// A new query starts from the top result.
	$: query, (active = 0);

	const editable = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

	function onWindowKey(event: KeyboardEvent) {
		if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
			event.preventDefault();
			if (open) close();
			else show();
		} else if (event.key === '/' && !open && !editable(event.target)) {
			event.preventDefault();
			show();
		}
	}

	async function move(by: number) {
		if (!results.length) return;
		active = (active + by + results.length) % results.length;
		await tick();
		list?.querySelector(`#palette-option-${active}`)?.scrollIntoView({ block: 'nearest' });
	}

	function onInputKey(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter' && results[active]) {
			event.preventDefault();
			go(results[active].href);
		}
	}

	afterNavigate(close);
</script>

<svelte:window on:keydown={onWindowKey} />

<button class="search-btn" type="button" on:click={show} aria-label="Search the site ({mac ? '⌘' : 'Ctrl+'}K)">
	<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
		><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg
	>
	<span class="label">Search</span>
	<kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
</button>

<!-- Empty until opened: the results are not part of the page. -->
<dialog
	bind:this={dialogEl}
	class="palette"
	aria-label="Search the site"
	on:close={() => (open = false)}
	on:click={(event) => event.target === dialogEl && close()}
>
	{#if open}
		<div class="box">
			<input
				bind:this={input}
				bind:value={query}
				on:keydown={onInputKey}
				type="text"
				placeholder="Search tools, pages, gates and terms"
				autocomplete="off"
				spellcheck="false"
				role="combobox"
				aria-expanded="true"
				aria-controls="palette-results"
				aria-autocomplete="list"
				aria-activedescendant={results.length ? `palette-option-${active}` : undefined}
			/>
			<ul id="palette-results" role="listbox" aria-label="Results" bind:this={list}>
				{#each results as entry, i (entry.href)}
					<li
						id="palette-option-{i}"
						role="option"
						aria-selected={i === active}
						class:active={i === active}
						on:mousemove={() => (active = i)}
					>
						<a href={entry.href} tabindex="-1" on:click|preventDefault={() => go(entry.href)}>
							<span class="title">{entry.title}</span>
							<span class="kind">{entry.kind}</span>
							<span class="hint">{entry.hint}</span>
						</a>
					</li>
				{/each}
			</ul>
			{#if failed}
				<p class="empty">
					The search list could not be loaded. <button type="button" on:click={load}>Try again</button>
				</p>
			{:else if !entries}
				<p class="empty">Loading…</p>
			{:else if !results.length}
				<p class="empty">Nothing matches “{query}”.</p>
			{/if}
			<p class="keys" aria-hidden="true">
				<kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
			</p>
		</div>
	{/if}
</dialog>

<style>
	.search-btn {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		box-sizing: border-box;
		height: 26px;
		padding: 0 6px 0 8px;
		background-color: #060606;
		border: 1px solid #555;
		border-radius: 3px;
		color: #bbb;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.search-btn:hover {
		color: #fff;
		border-color: #888;
	}

	.search-btn:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: 2px;
	}

	.search-btn svg {
		width: 15px;
		height: 15px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	kbd {
		font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #999;
		border: 1px solid #444;
		border-radius: 3px;
		padding: 0 4px;
		line-height: 16px;
		background: #161618;
	}

	/* On a phone there is no keyboard shortcut to advertise, and the nav needs
	   the room: the magnifier alone, named by its aria-label. */
	@media (max-width: 700px) {
		.search-btn .label,
		.search-btn kbd {
			display: none;
		}

		.search-btn {
			padding: 0 6px;
		}
	}

	.palette {
		width: min(640px, calc(100vw - 24px));
		max-height: min(560px, calc(100vh - 80px));
		margin: 10vh auto auto;
		padding: 0;
		border: 1px solid #555;
		border-radius: 6px;
		background: #161618;
		color: #fff;
		font: 15px/1.4 'Helvetica Neue', Helvetica, Arial, sans-serif;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.palette::backdrop {
		background: rgba(0, 0, 0, 0.55);
	}

	.box {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 14px 16px;
		background: transparent;
		border: 0;
		border-bottom: 1px solid #333;
		color: #fff;
		font: inherit;
		font-size: 16px;
		outline: none;
	}

	input::placeholder {
		color: #777;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 6px;
		overflow-y: auto;
	}

	li a {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 0.75rem;
		padding: 8px 10px;
		border-radius: 4px;
		color: #e6e6e6;
		text-decoration: none;
	}

	li.active a {
		background: #26282b;
		color: #fff;
	}

	.title {
		font-weight: 600;
		min-width: 0;
	}

	.kind {
		color: #8a8a90;
		font-size: 12px;
		align-self: center;
	}

	li.active .kind {
		color: #8ede8e;
	}

	.hint {
		grid-column: 1 / -1;
		color: #999;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		margin: 0;
		padding: 14px 16px;
		color: #999;
		font-size: 14px;
	}

	.empty button {
		background: none;
		border: 0;
		padding: 0;
		color: #8ede8e;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.keys {
		margin: 0;
		padding: 8px 16px;
		border-top: 1px solid #333;
		color: #777;
		font-size: 12px;
	}

	.keys kbd {
		margin-right: 2px;
	}

	@media (max-width: 700px) {
		.keys {
			display: none;
		}

		.palette {
			margin-top: 12px;
		}
	}

	@media print {
		.search-btn {
			display: none;
		}
	}
</style>
