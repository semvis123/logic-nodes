<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import type { SearchEntry, SearchKind } from '$lib/searchIndex';
	import type { Answer } from '$lib/paletteAnswers';
	import { search } from '$lib/search';
	import { toolIcons } from '$lib/toolIcons';
	import { tools } from '$lib/tools';
	import ToolIcon from '$lib/ToolIcon.svelte';

	// Ctrl+K (⌘K on a Mac), or "/" when not typing, jumps anywhere on the site.
	// The list comes from /search.json and the instant answers from their own
	// module, both fetched the first time the palette opens, so it adds nothing
	// to the page until someone uses it.

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
	let answer: ((query: string) => Answer[]) | null = null;
	let failed = false;
	let mac = false;
	let here = '';
	let recent: string[] = [];

	type Row = {
		title: string;
		hint: string;
		href: string;
		kind: string;
		icon: string;
		section: string;
		answer?: boolean;
	};

	/** An icon for each kind of result that is not a tool. */
	const kindIcons: Record<Exclude<SearchKind, 'Tool'>, string> = {
		Page: '<path d="M6 2.5h9l4 4v15H6z"/><path d="M15 2.5v4h4M9 12h7M9 16h7"/>',
		Gate: '<path d="M2 9h3M2 15h3M5 5h5a7 7 0 0 1 0 14H5zM17 12h5"/>',
		'Flip-flop': '<path d="M2 17h4V7h6v10h6V7h4"/>',
		Circuit: toolIcons['/logic-circuit-generator'],
		Lesson: '<path d="M12 6.5C10 5 7 4.5 3 5v13.5c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5V20"/>',
		Term: '<path d="M4 6h16M4 11h16M4 16h10"/>'
	};

	const RECENT_KEY = 'palette-recent';

	function readRecent(): string[] {
		try {
			const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
			return Array.isArray(saved) ? saved.filter((h) => typeof h === 'string') : [];
		} catch {
			return [];
		}
	}

	/** Remembers the pages visited, in this browser only, for the empty palette. */
	function remember(path: string) {
		recent = [path, ...readRecent().filter((h) => h !== path)].slice(0, 6);
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
		} catch {
			// Private windows and blocked storage just go without.
		}
	}

	onMount(() => {
		mac = /Mac|iPhone|iPad/.test(navigator.platform);
	});

	async function load() {
		if (!answer) {
			import('$lib/paletteAnswers').then((m) => (answer = m.answers)).catch(() => undefined);
		}
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

	const iconFor = (entry: SearchEntry) => (entry.kind === 'Tool' ? toolIcons[entry.href] : kindIcons[entry.kind]);
	const rowOf = (entry: SearchEntry, section: string): Row => ({ ...entry, icon: iconFor(entry), section });

	function buildRows(list: SearchEntry[] | null, q: string, answerFn: typeof answer, visited: string[]): Row[] {
		const rows: Row[] = [];
		if (answerFn && q.trim()) {
			for (const a of answerFn(q)) {
				rows.push({
					...a,
					kind: tools.find((tool) => tool.href === a.tool)?.short ?? 'Answer',
					icon: toolIcons[a.tool],
					section: 'Answers',
					answer: !a.action
				});
			}
		}
		if (!list) return rows;
		if (q.trim()) {
			for (const entry of search(list, q)) rows.push(rowOf(entry, 'Pages'));
			return rows;
		}
		const byHref = new Map(list.map((entry) => [entry.href, entry]));
		const back = visited
			.filter((href) => href !== here)
			.map((href) => byHref.get(href))
			.filter((entry): entry is SearchEntry => !!entry)
			.slice(0, 4);
		for (const entry of back) rows.push(rowOf(entry, 'Recent'));
		for (const entry of search(list, '')) {
			if (!back.includes(entry)) rows.push(rowOf(entry, 'Tools'));
		}
		return rows;
	}

	// The dialog's own state, not `open`: its close event arrives a moment after
	// Escape, and a Ctrl+K in between must open it again, not close it.
	const isOpen = () => !!dialogEl && dialog().open;

	async function show() {
		if (isOpen()) return;
		open = true;
		query = '';
		active = 0;
		await tick();
		dialog().showModal();
		input.focus();
		load();
	}

	function close() {
		if (isOpen()) dialog().close();
	}

	function go(href: string) {
		close();
		goto(href);
	}

	$: results = buildRows(entries, query, answer, recent);
	// A new query starts from the top result.
	$: query, (active = 0);

	const editable = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

	function onWindowKey(event: KeyboardEvent) {
		if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
			event.preventDefault();
			if (isOpen()) close();
			else show();
		} else if (event.key === '/' && !isOpen() && !editable(event.target)) {
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

	afterNavigate(() => {
		close();
		here = location.pathname;
		remember(here);
	});
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
	on:close={() => (open = isOpen())}
	on:click={(event) => event.target === dialogEl && close()}
>
	{#if open}
		<div class="box">
			<input
				bind:this={input}
				bind:value={query}
				on:keydown={onInputKey}
				type="text"
				placeholder="Search, or type an expression or a number"
				autocomplete="off"
				spellcheck="false"
				role="combobox"
				aria-expanded="true"
				aria-controls="palette-results"
				aria-autocomplete="list"
				aria-activedescendant={results.length ? `palette-option-${active}` : undefined}
			/>
			<ul id="palette-results" role="listbox" aria-label="Results" bind:this={list}>
				{#each results as row, i (`${row.section} ${row.href} ${row.title}`)}
					{#if i === 0 || results[i - 1].section !== row.section}
						<li class="section" role="presentation" aria-hidden="true">{row.section}</li>
					{/if}
					<li
						id="palette-option-{i}"
						role="option"
						aria-selected={i === active}
						class:active={i === active}
						class:answer={row.answer}
						on:mousemove={() => (active = i)}
					>
						<a href={row.href} tabindex="-1" on:click|preventDefault={() => go(row.href)}>
							<ToolIcon markup={row.icon} />
							<span class="title">{row.title}</span>
							<span class="kind">{row.kind}</span>
							<span class="hint">{row.hint}</span>
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
			{:else if !results.length && query.trim()}
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

	.section {
		padding: 8px 10px 4px;
		color: #777;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	li a {
		display: grid;
		grid-template-columns: 20px 1fr auto;
		align-items: center;
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

	li a > :global(.tool-icon) {
		grid-row: 1 / 3;
	}

	li.active :global(.tool-icon) {
		stroke: #8ede8e;
	}

	li.answer .title {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hint {
		grid-column: 2 / -1;
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
