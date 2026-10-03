<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import PageHead from '$lib/PageHead.svelte';
	import {
		SYMBOLS,
		GROUPS,
		COPY_FORMATS,
		COPY_FORMAT_LABELS,
		symbolById,
		filterGroups,
		copyText,
		unicodeLabel,
		hexReference,
		htmlCode,
		lookAlikeOf,
		transcribe,
		needsAmssymb,
		hex4,
		WORKED_FORMULAS,
		type CopyFormat,
		type SymbolEntry
	} from '$lib/symbolTable';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import SymbolDetail from './SymbolDetail.svelte';
	import { onMount, tick } from 'svelte';

	const ids = SYMBOLS.map((s) => s.id);
	/** A symbol in two groups keeps its plain id on its first tile, so ids stay unique. */
	const firstGroup: Record<string, string> = {};
	for (const g of GROUPS) for (const id of g.symbols) if (!firstGroup[id]) firstGroup[id] = g.id;
	const DEFAULTS = { q: '', as: 'symbol', s: 'and' };

	let query = DEFAULTS.q;
	let format: CopyFormat = 'symbol';
	let selectedId = DEFAULTS.s;
	/** The group whose tile was used last, for a symbol listed in two groups. */
	let selectedGroup = '';
	/** Under 860px the panel goes under the group of the tile in use, not beside the grid. */
	let narrow = false;
	/** On a phone the panel stays under the grid until a tile is used, so nothing moves on load. */
	let placed = false;
	const MAX_QUERY = 60;

	onMount(() => {
		const p = readUrl();
		query = safeText(p.q, MAX_QUERY) ?? query;
		format = safeOption(p.as, COPY_FORMATS) ?? format;
		selectedId = safeOption(p.s, ids) ?? selectedId;
		// Drops any query value that was not valid, so the address shows the state on screen.
		syncUrl({ q: query, as: format, s: selectedId }, DEFAULTS);
		const mq = window.matchMedia('(max-width: 859px)');
		narrow = mq.matches;
		const onChange = () => (narrow = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
	$: syncUrl({ q: query, as: format, s: selectedId }, DEFAULTS);

	// Runs at build time too, so the served page lists every symbol and shows ∧ in full.
	$: groups = filterGroups(query);
	$: selected = symbolById(selectedId) as SymbolEntry;
	$: matchCount = new Set(groups.flatMap((g) => g.symbols.map((s) => s.id))).size;
	$: lookAlike = lookAlikeOf(query);
	/** Shown under the box and read out with the match count, so a pasted twin is explained either way. */
	$: lookAlikeText = lookAlike
		? `${lookAlike.char} (${u(lookAlike.char.codePointAt(0) ?? 0)}) is a look-alike of ${
				lookAlike.symbol.glyph
		  } (${unicodeLabel(lookAlike.symbol)}), ${lookAlike.symbol.names[0]}. They are different characters.`
		: '';

	/** The tile that holds the selection: the group last used if it shows it, else the first that does. */
	$: currentGroup = (
		groups.find((g) => g.group.id === selectedGroup && g.symbols.some((s) => s.id === selectedId)) ??
		groups.find((g) => g.symbols.some((s) => s.id === selectedId))
	)?.group.id;
	/** Only one tile is in the Tab order: the current one, or the first when it is filtered out. */
	$: tabKey = currentGroup
		? `${currentGroup}:${selectedId}`
		: groups.length
		? `${groups[0].group.id}:${groups[0].symbols[0].id}`
		: '';
	$: panelInGroup = narrow && placed ? currentGroup : undefined;

	const tileId = (s: SymbolEntry, groupId: string) =>
		firstGroup[s.id] === groupId ? `sym-${s.id}` : `sym-${s.id}-${groupId}`;

	/**
	 * Makes a tile current. On a phone the panel then moves under that tile's
	 * group, which can shift the tile; the page scrolls by the same amount so the
	 * tile stays where the reader's finger or focus is.
	 */
	async function select(s: SymbolEntry, groupId: string) {
		const id = tileId(s, groupId);
		const before = document.getElementById(id)?.getBoundingClientRect().top;
		selectedId = s.id;
		selectedGroup = groupId;
		placed = true;
		// A clipboard failure names the symbol to copy by hand; once another tile
		// is in use it is out of date, and on a phone it covers part of the panel.
		if (statusKind === 'fail') dismiss();
		await tick();
		const after = document.getElementById(id)?.getBoundingClientRect().top;
		if (before !== undefined && after !== undefined && after !== before) window.scrollBy(0, after - before);
	}

	/** What the last copy did, read out by the live region. */
	let status = '';
	let statusKind: 'ok' | 'warn' | 'fail' = 'ok';
	let statusTimer: ReturnType<typeof setTimeout>;

	function say(message: string, kind: typeof statusKind) {
		status = message;
		statusKind = kind;
		clearTimeout(statusTimer);
		// A failure stays up until it is dismissed or another symbol is used, so
		// there is time to copy by hand.
		if (kind !== 'fail') statusTimer = setTimeout(() => (status = ''), 4000);
	}

	function dismiss() {
		clearTimeout(statusTimer);
		status = '';
	}

	async function writeClipboard(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}

	const clipboardFailed = (text: string) =>
		`Could not reach the clipboard. Select ${text} in the symbol panel and copy it from there.`;

	/** A tile was pressed: select the symbol and copy it in the chosen format. */
	async function pick(s: SymbolEntry, groupId: string) {
		await select(s, groupId);
		const { text, fellBack } = copyText(s, format);
		const ok = await writeClipboard(text);
		const name = s.names[0];
		if (!ok) {
			say(clipboardFailed(text), 'fail');
		} else if (fellBack) {
			say(
				`${s.glyph} has no LaTeX command in base LaTeX or amssymb, so the symbol itself was copied (${name}).`,
				'warn'
			);
		} else if (s.id === 'overline' && format === 'symbol') {
			say('Copied U+0305, the combining overline: paste it straight after the letter it goes over.', 'ok');
		} else if (format === 'latex' && s.amssymb) {
			say(`Copied ${text} (${name}). It needs \\usepackage{amssymb}.`, 'ok');
		} else {
			say(`Copied ${text} (${name})`, 'ok');
		}
	}

	/** The copy buttons in the detail panel copy one exact code. */
	async function copyCode(text: string, what: string) {
		const ok = await writeClipboard(text);
		if (ok) say(`Copied ${text} (${what})`, 'ok');
		else say(clipboardFailed(text), 'fail');
	}

	/**
	 * Arrow keys move between tiles, as in a character map, and show each symbol
	 * in the panel without copying it; Enter or Space copies. Up and down pick the
	 * tile in the row above or below whose centre is nearest, so it works however
	 * many columns the screen fits and across the group headings.
	 */
	async function onGridKey(event: KeyboardEvent) {
		const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>('.tile'));
		const i = tiles.indexOf(document.activeElement as HTMLButtonElement);
		if (i < 0) return;
		let next = -1;
		if (event.key === 'ArrowRight') next = Math.min(i + 1, tiles.length - 1);
		else if (event.key === 'ArrowLeft') next = Math.max(i - 1, 0);
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = tiles.length - 1;
		else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const here = tiles[i].getBoundingClientRect();
			const down = event.key === 'ArrowDown';
			const rows = tiles
				.map((t, index) => ({ index, rect: t.getBoundingClientRect() }))
				.filter(({ rect }) => (down ? rect.top > here.top + 4 : rect.top < here.top - 4));
			if (rows.length) {
				const rowTop = down ? Math.min(...rows.map((r) => r.rect.top)) : Math.max(...rows.map((r) => r.rect.top));
				const centre = here.left + here.width / 2;
				const row = rows.filter((r) => Math.abs(r.rect.top - rowTop) < 4);
				row.sort(
					(a, b) =>
						Math.abs(a.rect.left + a.rect.width / 2 - centre) - Math.abs(b.rect.left + b.rect.width / 2 - centre)
				);
				next = row[0].index;
			} else next = i;
		} else return;
		event.preventDefault();
		const target = tiles[next];
		const s = symbolById(target.dataset.symbol ?? '');
		if (s) await select(s, target.dataset.group ?? '');
		// The panel may have moved, so find the tile again by its id.
		const tile = document.getElementById(target.id) ?? target;
		tile.focus();
		tile.scrollIntoView({ block: 'nearest' });
	}

	async function clearSearch() {
		query = '';
		await tick();
		document.getElementById('filter')?.focus();
	}

	/** Prints only the reference table, by hiding everything else for the print. */
	function printTable() {
		document.documentElement.classList.add('print-symbol-table');
		window.print();
		document.documentElement.classList.remove('print-symbol-table');
	}

	/** Each symbol once, in group order, for the printable table. */
	const reference = (() => {
		const seen = new Set<string>();
		return GROUPS.flatMap((g) =>
			g.symbols
				.filter((id) => !seen.has(id) && (seen.add(id), true))
				.map((id) => ({ group: g.title, s: symbolById(id) as SymbolEntry }))
		);
	})();

	const worked = WORKED_FORMULAS.map((f) => ({
		text: f,
		latex: transcribe(f, 'latex'),
		html: transcribe(f, 'html'),
		amssymb: needsAmssymb(f)
	}));

	const show = (s: SymbolEntry) => s.display ?? s.glyph;
	const u = (cp: number) => `U+${hex4(cp)}`;
	const and = symbolById('and') as SymbolEntry;
	const therefore = symbolById('therefore') as SymbolEntry;
	const overline = symbolById('overline') as SymbolEntry;
	const amsCount = SYMBOLS.filter((s) => s.amssymb).length;

	/** Characters that look alike but are not interchangeable. */
	const lookPairs: { pair: string[]; note: string }[] = [
		{
			pair: ['∨', 'v'],
			note: 'The or sign is not the letter v. A search, a screen reader or a parser reads them differently.'
		},
		{
			pair: ['¬', '−', '-'],
			note: 'The not sign, the minus sign and the hyphen are three characters. Only ¬ means not.'
		},
		{
			pair: ['∅', 'Ø', 'φ'],
			note: 'The empty set is not the Scandinavian letter Ø or the Greek phi, though fonts draw them alike.'
		},
		{
			pair: ['Δ', '∆'],
			note: 'Greek capital delta and the increment sign look identical; symmetric difference is usually typed with Δ.'
		},
		{
			pair: ['′', "'"],
			note: 'The prime is a separate character from the apostrophe. Both are used for NOT A; the prime looks better in print.'
		},
		{
			pair: ['·', '⋅'],
			note: 'The middle dot and the dot operator both mean AND in boolean algebra. LaTeX \\cdot prints the dot operator.'
		},
		{ pair: ['~', '∼'], note: 'The keyboard tilde and the tilde operator. LaTeX \\sim gives the tilde operator.' }
	];
	const lookAlikes = lookPairs.map((l) => ({ ...l, codes: l.pair.map((c) => u(c.codePointAt(0) as number)) }));

	const faqs = [
		{
			q: 'How do I copy and paste a logic symbol?',
			a: `Select its tile and it is copied straight away: the "Copy as" buttons choose whether you get the symbol itself, its LaTeX command, its HTML code or its Unicode code point. For ${
				and.glyph
			} those are ${and.glyph}, ${and.latex}, ${and.entity} and ${unicodeLabel(
				and
			)}. The symbol panel, beside the grid or under it on a phone, has copy buttons for the symbol, its code point, its HTML codes (named, hex and decimal) and its LaTeX command.`
		},
		{
			q: 'How do I type logic symbols in Word?',
			a: `Type the symbol's hex code and press Alt+X straight after it: ${hex4(and.codePoints[0])} then Alt+X gives ${
				and.glyph
			}. Word reads hex digits backwards from the cursor, so if the code follows a letter A to F or a digit, select just the code before pressing Alt+X. Alt+X on a symbol you have already typed turns it back into its code.`
		},
		{
			q: 'Which logic symbols need amssymb in LaTeX?',
			a: `${amsCount} of the ${SYMBOLS.length} symbols here: ${SYMBOLS.filter((s) => s.amssymb)
				.map((s) => s.latex)
				.join(
					', '
				)}. Add \\usepackage{amssymb} to the preamble. The everyday connectives, \\lnot, \\land, \\lor, \\to and \\leftrightarrow, are in base LaTeX.`
		},
		{
			q: 'What is the difference between → and ⇒?',
			a: 'Most books write the conditional, a connective inside a formula, as p → q. Many use ⇒ for implication as a claim about formulas, that p → q holds in every case, or between the lines of a proof. Some books use ⇒ for the conditional itself, and older ones use ⊃, so follow the convention of whatever you are reading.'
		},
		{
			q: 'What is the difference between ⊢ and ⊨?',
			a: 'Γ ⊢ φ (turnstile) says φ can be derived from Γ using the rules of a proof system: it is about proofs. Γ ⊨ φ (double turnstile) says every assignment that makes Γ true also makes φ true: it is about truth. Soundness and completeness theorems are the statements that the two agree.'
		},
		{
			q: 'How do I write NOT A with a bar over it?',
			a: `Type A and then the combining overline, ${unicodeLabel(
				overline
			)}, which draws a bar over the character before it: A̅. In LaTeX write ${
				overline.latex
			}, which also stretches over a longer expression. In plain text a prime, A′, or an apostrophe, A', means the same and is easier to type.`
		}
	];

	const page = {
		title: 'Logic Symbols Copy and Paste: ¬ ∧ ∨ → ↔ ∀ ∃ ⊢ With LaTeX',
		description:
			'Copy and paste logic symbols in one click: ¬ ∧ ∨ ⊕ → ↔ ∀ ∃ ⊢ ⊨ ∴ and set symbols, each with its Unicode code point, HTML code, LaTeX command and Word code.',
		url: `${SITE}/logic-symbols-copy-paste`,
		image: `${SITE}/og/logic-symbols-copy-paste.png`,
		imageAlt: 'LogicGates.org: logic symbols to copy and paste, with LaTeX and HTML codes'
	};
</script>

<PageHead {page} {faqs} crumb="Logic symbols to copy and paste" />

<ContentPage
	tool
	related={[
		{ href: '/logic', label: 'Propositional logic' },
		{ href: '/set-notation', label: 'Set notation' },
		{ href: '/logic-gate-symbols', label: 'Logic gate symbols' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/propositional-logic-truth-table', label: 'Logic statement truth tables' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Logic symbols to copy and paste</h1>
		<p class="lede">
			The {SYMBOLS.length} most common symbols of logic, boolean algebra and set theory in one grid. Select one to copy it,
			as the character itself or as LaTeX, HTML or a Unicode code point, and see how to type it in Word.
		</p>

		<div class="card tool">
			<div class="controls">
				<div class="search">
					<label class="field" for="filter">Search symbols</label>
					<input
						id="filter"
						type="search"
						maxlength={MAX_QUERY}
						bind:value={query}
						placeholder="and, \land, 2227 or a pasted ∧"
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
						aria-describedby="filter-help"
					/>
					<p class="field-help" id="filter-help">
						Matches names, LaTeX commands, HTML entities and code points. In the grid, arrow keys move between symbols
						and Enter copies one.
					</p>
					{#if lookAlike}
						<p class="field-help look-hint">{lookAlikeText}</p>
					{/if}
					<p class="visually-hidden" role="status">
						{#if query.trim()}{matchCount
								? `${matchCount} ${matchCount === 1 ? 'symbol matches' : 'symbols match'}`
								: `No symbol matches “${query.trim()}”`}{#if lookAlike}. {lookAlikeText}{/if}{/if}
					</p>
				</div>
				<div class="format">
					<span class="field" id="format-label">Copy as</span>
					<div class="segmented" role="group" aria-labelledby="format-label">
						{#each COPY_FORMATS as f}
							<button
								type="button"
								class:active={format === f}
								aria-pressed={format === f}
								on:click={() => (format = f)}>{COPY_FORMAT_LABELS[f]}</button
							>
						{/each}
					</div>
				</div>
			</div>

			<div class="workspace">
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div class="grid-area" on:keydown={onGridKey}>
					<h2 class="visually-hidden">Symbol grid</h2>
					{#each groups as { group, symbols } (group.id)}
						<div class="group">
							<h3 class="group-title" id="group-{group.id}">
								{group.title}
								<span class="count" aria-hidden="true">{symbols.length}</span><span class="visually-hidden"
									>({symbols.length} {symbols.length === 1 ? 'symbol' : 'symbols'})</span
								>
							</h3>
							{#if !query.trim()}<p class="group-intro">{group.intro}</p>{/if}
							<ul class="tiles" aria-labelledby="group-{group.id}">
								{#each symbols as s (s.id)}
									<li>
										<button
											type="button"
											class="tile"
											class:current={s.id === selectedId}
											id={tileId(s, group.id)}
											data-symbol={s.id}
											data-group={group.id}
											tabindex={`${group.id}:${s.id}` === tabKey ? 0 : -1}
											aria-current={s.id === selectedId ? 'true' : undefined}
											aria-label="Copy {s.names[0]}, {unicodeLabel(s)}"
											on:click={() => pick(s, group.id)}
										>
											<span class="glyph" aria-hidden="true">{show(s)}</span>
											<span class="tile-name" aria-hidden="true">{s.tile ?? s.names[0]}</span>
										</button>
									</li>
								{/each}
							</ul>
							{#if panelInGroup === group.id}
								<div class="panel-inline"><SymbolDetail {selected} copy={copyCode} /></div>
							{/if}
						</div>
					{:else}
						<div class="empty">
							<p>
								No symbol matches “{query}”. Try a name such as <em>implies</em>, a LaTeX command such as
								<span class="mono">\land</span>, or a code point such as <span class="mono">2227</span>.
							</p>
							<button type="button" class="chip-btn" on:click={clearSearch}>Clear the search</button>
						</div>
					{/each}
				</div>

				{#if !panelInGroup}
					<div class="panel-side"><SymbolDetail {selected} copy={copyCode} /></div>
				{/if}
			</div>

			<p class="share-row"><ShareLink what="this symbol and search" /></p>
		</div>
	</section>

	<div class="toast-wrap">
		<div class="toast {statusKind}" class:visible={!!status}>
			<p id="copy-status" role="status" aria-live="polite">{status}</p>
			{#if status && statusKind === 'fail'}
				<button type="button" class="toast-close" on:click={dismiss}>Dismiss</button>
			{/if}
		</div>
	</div>

	<section id="how-to-type">
		<h2>How to type logic symbols</h2>
		<p class="section-intro">
			Copying from a page works anywhere, but each place you write has a way of its own that is quicker once you know
			it.
		</p>
		<div class="ways">
			<div class="card way">
				<h3>Microsoft Word</h3>
				<p>
					Type the hex code from the panel and press <kbd>Alt</kbd>+<kbd>X</kbd>:
					<span class="mono">{hex4(and.codePoints[0])}</span>
					becomes {and.glyph}. Word reads hex digits back from the cursor, so after a letter A to F or a digit, select
					the code first. Insert › Equation also takes LaTeX-style commands such as <span class="mono">\wedge</span>.
				</p>
			</div>
			<div class="card way">
				<h3>LaTeX</h3>
				<p>
					Use the command in math mode, between <span class="mono">$</span> signs. {amsCount} of the commands, such as
					<span class="mono">{therefore.latex}</span>, come from the amssymb package, which the panel flags; add
					<span class="mono">\usepackage{'{'}amssymb{'}'}</span> to the preamble.
				</p>
			</div>
			<div class="card way">
				<h3>HTML</h3>
				<p>
					A page saved as UTF-8 can hold the symbol itself. Otherwise use the named entity, such as
					<span class="mono">{and.entity}</span>, or the numeric one, <span class="mono">{hexReference(and)}</span>,
					which works for every character. A <span class="mono">&lt;</span> in text is safest written
					<span class="mono">&amp;lt;</span>, since a <span class="mono">&lt;</span> followed by a letter starts a tag.
				</p>
			</div>
			<div class="card way">
				<h3>Windows and macOS</h3>
				<p>
					On Windows 11, <kbd>Win</kbd>+<kbd>.</kbd> opens the emoji panel, whose symbols tab has many of these. On a
					Mac,
					<kbd>Ctrl</kbd>+<kbd>Cmd</kbd>+<kbd>Space</kbd> opens the Character Viewer, which can search by name.
				</p>
			</div>
		</div>
	</section>

	<section id="worked-examples">
		<h2>Whole formulas in LaTeX and HTML</h2>
		<p class="section-intro">
			The same formulas written three ways, each converted symbol by symbol from the table on this page. Note the space
			after a command such as <span class="mono">\lnot</span> before a letter: without it LaTeX reads
			<span class="mono">\lnotp</span> as one unknown command.
		</p>
		<div class="formulas">
			{#each worked as w}
				<div class="card formula">
					<p class="formula-text">{w.text}</p>
					<dl>
						<dt>LaTeX</dt>
						<dd>
							<span class="mono">{w.latex}</span>
							<button type="button" class="copy-small" on:click={() => copyCode(w.latex, 'LaTeX')}
								><span aria-hidden="true">Copy</span><span class="visually-hidden">Copy the LaTeX for {w.text}</span
								></button
							>
						</dd>
						<dt>HTML</dt>
						<dd>
							<span class="mono">{w.html}</span>
							<button type="button" class="copy-small" on:click={() => copyCode(w.html, 'HTML')}
								><span aria-hidden="true">Copy</span><span class="visually-hidden">Copy the HTML for {w.text}</span
								></button
							>
						</dd>
					</dl>
					{#if w.amssymb}<p class="reducer">The LaTeX needs amssymb.</p>{/if}
				</div>
			{/each}
		</div>
		<p class="reducer">
			To check what a formula means, paste it into the <a href="/propositional-logic-truth-table"
				>propositional logic calculator</a
			>
			for its truth table, or a boolean expression into the
			<a href="/boolean-algebra-calculator">boolean algebra calculator</a>.
		</p>
	</section>

	<section id="look-alikes">
		<h2>Look-alikes and common mistakes</h2>
		<p class="section-intro">
			Several of these symbols have twins that fonts draw almost the same way. They are different characters, so a
			search for one will not find the other.
		</p>
		<ul class="look-list">
			{#each lookAlikes as l}
				<li class="card look">
					<span class="look-glyphs" aria-hidden="true">
						{#each l.pair as c}<span class="look-glyph">{c}</span>{/each}
					</span>
					<span class="look-text">
						<span class="mono look-codes">{l.codes.join(', ')}</span>
						<span class="look-note">{l.note}</span>
					</span>
				</li>
			{/each}
		</ul>
		<p class="reducer">
			Meanings shift between books too. ⊂ is a proper subset in some and any subset in others, which is why ⊆ and ⊊
			exist; ≡ can mean logically equivalent or the biconditional; ⊃ is the conditional in older logic books and
			superset in set theory. The <a href="/logic">propositional logic</a> and <a href="/set-notation">set notation</a> pages
			explain each in context.
		</p>
	</section>

	<section id="reference">
		<h2>Printable logic symbols table</h2>
		<p class="section-intro">
			All {reference.length} symbols in one table with their codes, ready to print. Symbols with two jobs, such as ⊃ and
			≡, appear once.
		</p>
		<p class="no-print"><button type="button" class="chip-btn" on:click={printTable}>Print this table</button></p>
		<div class="table-wrap">
			<table class="data-table reference">
				<thead>
					<tr>
						<th scope="col">Symbol</th>
						<th scope="col" class="ref-name">Name</th>
						<th scope="col">Unicode</th>
						<th scope="col">HTML</th>
						<th scope="col">LaTeX</th>
					</tr>
				</thead>
				<tbody>
					{#each reference as { group, s }, i}
						{#if i === 0 || reference[i - 1].group !== group}
							<tr class="group-row"><th scope="rowgroup" colspan="5">{group}</th></tr>
						{/if}
						<tr>
							<td class="ref-glyph">{show(s)}<span class="ref-name-inline">{s.names[0]}</span></td>
							<td class="ref-name">{s.names[0]}</td>
							<td class="mono ref-cp">{unicodeLabel(s)}</td>
							<td class="mono">{htmlCode(s)}</td>
							<td class="mono">{s.latex ?? '—'}{s.amssymb ? ' *' : ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			* needs <span class="mono">\usepackage{'{'}amssymb{'}'}</span>. — means no command in base LaTeX or amssymb.
		</p>
	</section>

	<section class="faq">
		<h2>Questions</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.2rem;
		align-items: flex-start;
	}

	.search {
		flex: 1 1 280px;
		min-width: 0;
	}
	#filter {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 1rem;
		padding: 0.5rem 0.7rem;
	}

	#filter::placeholder {
		color: #8a8a8a;
	}

	#filter:focus {
		outline: none;
		border-color: #5db65d;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.4rem 0 0;
	}

	.segmented {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.segmented button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
	}

	.segmented button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		margin-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.6rem;
	}

	@media (min-width: 860px) {
		.workspace {
			grid-template-columns: minmax(0, 1fr) 290px;
		}

		.panel-side {
			position: sticky;
			top: 70px;
			align-self: start;
		}
	}

	.panel-side {
		margin-top: 0.8rem;
		min-width: 0;
	}

	.panel-inline {
		margin-top: 0.7rem;
	}

	.grid-area .group-title {
		color: #fff;
		font-size: 0.95rem;
		margin: 0.8rem 0 0.2rem;
	}

	.count {
		color: #999;
		font-weight: normal;
		font-size: 0.8rem;
	}

	.group-intro {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0 0 0.45rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.look-hint {
		color: #d9c48a;
	}

	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 5px;
	}

	.tile {
		width: 100%;
		height: 74px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		color: #fff;
		cursor: pointer;
		padding: 4px 3px;
	}

	.tile:hover {
		border-color: #5db65d;
	}

	.tile.current {
		border-color: #5db65d;
		box-shadow: inset 0 0 0 1px #5db65d;
		background: #142114;
	}

	/* Focus is a white ring outside the tile, so it never looks like the green
	   hover or selected state. */
	.tile:focus {
		outline: none;
	}

	.tile:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	.glyph,
	.detail-glyph,
	.ref-glyph,
	.formula-text,
	.look-glyphs {
		font-family: 'Cambria Math', 'STIX Two Math', 'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Math', serif;
	}

	.glyph {
		font-size: 1.6rem;
		line-height: 1.1;
	}

	.tile-name {
		color: #bbb;
		font-size: 0.7rem;
		hyphens: manual;
		line-height: 1.15;
		text-align: center;
		max-width: 100%;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.empty {
		padding: 1rem 0;
	}

	.empty p {
		margin: 0 0 0.6rem;
		/* The message repeats the search, which may be one long unbroken run. */
		overflow-wrap: anywhere;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	/* The copy message floats at the foot of the screen, so it is seen wherever
	   in the grid the click was, and nothing on the page moves when it appears. */
	.toast-wrap {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 16px;
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 20;
		padding: 0 16px;
	}

	.toast {
		margin: 0;
		max-width: 560px;
		background: #0d0d0f;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		font-size: 0.9rem;
		padding: 0.55rem 0.9rem;
		opacity: 0;
		transform: translateY(8px);
		transition: opacity 0.15s, transform 0.15s;
		overflow-wrap: anywhere;
	}

	.toast.visible {
		opacity: 1;
		transform: none;
	}

	.toast p {
		margin: 0;
	}

	/* Only a failure, which stays up, takes clicks; a passing message never
	   blocks a tap on what is under it. */
	.toast.fail.visible {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		pointer-events: auto;
	}

	.toast-close {
		flex: none;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		min-height: 36px;
		padding: 0.25rem 0.7rem;
		cursor: pointer;
	}

	.toast-close:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.toast.warn {
		border-color: #d9a441;
	}

	.toast.fail {
		border-color: #f66;
	}

	@media (prefers-reduced-motion: reduce) {
		.toast {
			transition: none;
			transform: none;
		}
	}

	.ways {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
		gap: 12px;
	}

	.way {
		padding: 0.9rem 1rem;
	}

	.way h3 {
		color: #fff;
	}

	.way p {
		font-size: 0.92rem;
		margin: 0;
	}

	.formulas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
		gap: 12px;
	}

	.formula {
		padding: 0.8rem 1rem;
		min-width: 0;
	}

	.formula-text {
		color: #fff;
		font-size: 1.25rem;
		margin: 0 0 0.5rem;
	}

	.formula dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.3rem 0.7rem;
	}

	.formula dt {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding-top: 0.15rem;
	}

	.formula dd {
		margin: 0;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}

	.look-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 8px;
	}

	.look {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		gap: 0 0.9rem;
		align-items: start;
		padding: 0.6rem 0.9rem;
	}

	.look-glyphs {
		display: flex;
		gap: 4px;
	}

	.look-glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2.4rem;
		font-size: 1.6rem;
		color: #fff;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.look-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.look-codes {
		font-size: 0.8rem;
		color: #8ede8e !important;
	}

	.look-note {
		color: #ccc;
		font-size: 0.88rem;
	}

	.formula dd {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.formula dd .mono {
		flex: 1 1 auto;
		min-width: 0;
	}

	/* The same size and look as the site's Copy link button. */
	.copy-small {
		flex: 0 0 auto;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		line-height: 1.2;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}

	.copy-small:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.reference {
		font-size: 0.85rem;
	}

	/* .reference.data-table outranks the site's roomier .data-table cells, so
	   the table stays compact enough to print on few pages. */
	.reference.data-table td,
	.reference.data-table th {
		padding: 2px 10px;
		line-height: 1.35;
	}

	.reference .ref-glyph {
		font-size: 1.05rem;
		color: #fff;
		text-align: center;
	}

	.ref-name-inline {
		display: none;
	}

	.reference td.mono {
		white-space: nowrap;
	}

	.reference .group-row th {
		color: #8ede8e;
		font-weight: 600;
		background: #101012;
		font-size: 0.8rem;
	}

	@media (max-width: 480px) {
		.tile {
			height: 68px;
		}

		.look {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.4rem;
		}

		/* The name moves under the glyph, so the code columns people come for fit. */
		.reference .ref-name {
			display: none;
		}

		.reference .ref-glyph {
			text-align: left;
		}

		.ref-name-inline {
			display: block;
			color: #bbb;
			font-family: system-ui, sans-serif;
			font-size: 0.72rem;
			line-height: 1.2;
		}

		.reference.data-table td,
		.reference.data-table th {
			padding: 2px 4px;
		}

		.reference td.mono {
			font-size: 0.7rem;
		}

		/* U+2203 U+0021 may wrap between its two code points. */
		.reference td.ref-cp {
			white-space: normal;
		}
	}

	@media print {
		:global(html.print-symbol-table section:not(#reference)),
		:global(html.print-symbol-table #reference .section-intro),
		:global(html.print-symbol-table #reference .no-print) {
			display: none;
		}

		.reference {
			font-size: 8.5pt;
		}

		.reference .ref-glyph {
			font-size: 10pt;
		}

		.reference.data-table td,
		.reference.data-table th {
			padding: 0 6px;
			line-height: 1.25;
		}

		.toast-wrap {
			display: none;
		}
	}
</style>
