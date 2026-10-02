<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
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
		decimalReference,
		htmlCode,
		wordInput,
		transcribe,
		needsAmssymb,
		hex4,
		WORKED_FORMULAS,
		type CopyFormat,
		type SymbolEntry
	} from '$lib/symbolTable';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount, tick } from 'svelte';

	const ids = SYMBOLS.map((s) => s.id);
	/** A symbol in two groups keeps its plain id on its first tile, so ids stay unique. */
	const firstGroup: Record<string, string> = {};
	for (const g of GROUPS) for (const id of g.symbols) if (!firstGroup[id]) firstGroup[id] = g.id;
	const DEFAULTS = { q: '', as: 'symbol', s: 'and' };

	let query = DEFAULTS.q;
	let format: CopyFormat = 'symbol';
	let selectedId = DEFAULTS.s;

	onMount(() => {
		const p = readUrl();
		query = safeText(p.q, 60) ?? query;
		format = safeOption(p.as, COPY_FORMATS) ?? format;
		selectedId = safeOption(p.s, ids) ?? selectedId;
	});
	$: syncUrl({ q: query, as: format, s: selectedId }, DEFAULTS);

	// Runs at build time too, so the served page lists every symbol and shows ∧ in full.
	$: groups = filterGroups(query);
	$: selected = symbolById(selectedId) as SymbolEntry;
	$: word = wordInput(selected);

	/** What the last copy did, read out by the live region. */
	let status = '';
	let statusKind: 'ok' | 'warn' | 'fail' = 'ok';
	let statusTimer: ReturnType<typeof setTimeout>;

	function say(message: string, kind: typeof statusKind) {
		status = message;
		statusKind = kind;
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => (status = ''), 4000);
	}

	async function writeClipboard(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}

	/** A tile was pressed: select the symbol and copy it in the chosen format. */
	async function pick(s: SymbolEntry) {
		selectedId = s.id;
		const { text, fellBack } = copyText(s, format);
		const ok = await writeClipboard(text);
		const name = s.names[0];
		if (!ok) {
			say(`Could not reach the clipboard. Select ${text} in the panel below and press Ctrl+C.`, 'fail');
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
		else say(`Could not reach the clipboard. Select ${text} and press Ctrl+C.`, 'fail');
	}

	/**
	 * Arrow keys move between tiles, as in a character map. Up and down pick the
	 * tile in the row above or below whose centre is nearest, so it works however
	 * many columns the screen fits and across the group headings.
	 */
	function onGridKey(event: KeyboardEvent) {
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
		tiles[next].focus();
		tiles[next].scrollIntoView({ block: 'nearest' });
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
			)}. The panel beside the grid has a copy button for every other form.`
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
			'Copy and paste logic symbols in one click: ¬ ∧ ∨ ⊕ → ↔ ∀ ∃ ⊢ ⊨ ∴ and set symbols, each with its Unicode code point, HTML entity, LaTeX command and Word code.',
		url: `${SITE}/logic-symbols-copy-paste`,
		image: `${SITE}/og/logic-symbols-copy-paste.png`,
		imageAlt: 'LogicGates.org: logic symbols to copy and paste, with LaTeX and HTML codes'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['WebPage', 'FAQPage'],
				'@id': `${page.url}#webpage`,
				url: page.url,
				name: page.title,
				description: page.description,
				isPartOf: { '@id': `${SITE}/#website` },
				breadcrumb: { '@id': `${page.url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Logic symbols to copy and paste' }
				]
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>{page.title}</title>
	<meta name="description" content={page.description} />
	<link rel="canonical" href={page.url} />
	<meta name="author" content="Sem" />
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="LogicGates.org" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={page.title} />
	<meta property="og:description" content={page.description} />
	<meta property="og:url" content={page.url} />
	<meta property="og:image" content={page.image} />
	<meta property="og:image:alt" content={page.imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={page.title} />
	<meta name="twitter:description" content={page.description} />
	<meta name="twitter:image" content={page.image} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/logic', label: 'Propositional logic' },
		{ href: '/set-notation', label: 'Set notation' },
		{ href: '/logic-gate-symbols', label: 'Logic gate symbols' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/propositional-logic-truth-table', label: 'Propositional logic calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Logic symbols to copy and paste</h1>
		<p class="lede">
			Every symbol of logic, boolean algebra and set theory in one grid. Select one to copy it, as the character itself
			or as LaTeX, HTML or a Unicode code point, and see how to type it in Word.
		</p>

		<div class="card tool">
			<div class="controls">
				<div class="search">
					<label class="field" for="filter">Search symbols</label>
					<input
						id="filter"
						type="search"
						bind:value={query}
						placeholder="and, \land, 2227 or a pasted ∧"
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
						aria-describedby="filter-help"
					/>
					<p class="field-help" id="filter-help">
						Matches names, LaTeX commands, HTML entities and code points. Arrow keys move around the grid.
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
					{#each groups as { group, symbols } (group.id)}
						<div class="group">
							<h2 class="group-title" id="group-{group.id}">
								{group.title} <span class="count">{symbols.length}</span>
							</h2>
							<ul class="tiles" aria-labelledby="group-{group.id}">
								{#each symbols as s (s.id)}
									<li>
										<button
											type="button"
											class="tile"
											class:current={s.id === selectedId}
											id={firstGroup[s.id] === group.id ? `sym-${s.id}` : `sym-${s.id}-${group.id}`}
											aria-label="Copy {s.names[0]}, {unicodeLabel(s)}"
											on:click={() => pick(s)}
										>
											<span class="glyph" aria-hidden="true">{show(s)}</span>
											<span class="tile-name" aria-hidden="true">{s.names[0]}</span>
										</button>
									</li>
								{/each}
							</ul>
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

				<aside class="detail" id="detail" aria-labelledby="detail-name">
					<div class="detail-head">
						<span class="detail-glyph" aria-hidden="true">{show(selected)}</span>
						<div>
							<p class="detail-name" id="detail-name">{selected.names[0]}</p>
							{#if selected.names.length > 1}
								<p class="detail-also">Also: {selected.names.slice(1).join(', ')}</p>
							{/if}
						</div>
					</div>
					<p class="detail-meaning">{selected.meaning}</p>
					<dl class="codes">
						<div>
							<dt>Unicode</dt>
							<dd>
								<code class="mono">{unicodeLabel(selected)}</code>
								<button type="button" class="copy" on:click={() => copyCode(selected.glyph, 'the symbol')}
									>Copy symbol</button
								>
							</dd>
						</div>
						<div>
							<dt>HTML</dt>
							<dd>
								<code class="mono">{htmlCode(selected)}</code>
								<button type="button" class="copy" on:click={() => copyCode(htmlCode(selected), 'HTML')}>Copy</button>
								<span class="sub mono">{hexReference(selected)} · {decimalReference(selected)}</span>
								{#if !selected.entity}<span class="sub">HTML has no named entity for it.</span>{/if}
							</dd>
						</div>
						<div>
							<dt>LaTeX</dt>
							<dd>
								{#if selected.latex}
									<code class="mono">{selected.latex}</code>
									<button type="button" class="copy" on:click={() => copyCode(selected.latex ?? '', 'LaTeX')}
										>Copy</button
									>
									{#if selected.amssymb}<span class="sub"
											>Needs <span class="mono">\usepackage{'{'}amssymb{'}'}</span></span
										>{/if}
								{:else}
									<span class="none">No command</span>
								{/if}
								{#if selected.latexNote}<span class="sub">{selected.latexNote}</span>{/if}
							</dd>
						</div>
						<div>
							<dt>Word</dt>
							<dd>
								{#if word.kind === 'keyboard'}
									Type it on the keyboard.
								{:else}
									Type <kbd>{word.code}</kbd> then press <kbd>Alt</kbd>+<kbd>X</kbd>{#if word.then}, then type
										<kbd>{word.then}</kbd>{/if}.
								{/if}
							</dd>
						</div>
					</dl>
					{#if selected.links.length}
						<p class="detail-links">
							Learn more:
							{#each selected.links as link, i}{i ? ', ' : ''}<a href={link.href}>{link.label}</a>{/each}
						</p>
					{/if}
				</aside>
			</div>

			<p class="share-row"><ShareLink what="this symbol and search" /></p>
		</div>
	</section>

	<div class="toast-wrap">
		<p class="toast {statusKind}" class:visible={!!status} id="copy-status" role="status" aria-live="polite">
			{status}
		</p>
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
					which works for every character. A bare <span class="mono">&lt;</span> must always be written
					<span class="mono">&amp;lt;</span>.
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
						<dd class="mono">{w.latex}</dd>
						<dt>HTML</dt>
						<dd class="mono">{w.html}</dd>
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
					<span class="look-glyphs" aria-hidden="true">{l.pair.join('  ')}</span>
					<span class="mono look-codes">{l.codes.join(', ')}</span>
					<span class="look-note">{l.note}</span>
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
			All {reference.length} symbols on one sheet with their codes. Symbols with two jobs, such as ⊃ and ≡, appear once.
		</p>
		<p class="no-print"><button type="button" class="chip-btn" on:click={printTable}>Print this table</button></p>
		<div class="table-wrap">
			<table class="data-table reference">
				<thead>
					<tr>
						<th scope="col">Symbol</th>
						<th scope="col">Name</th>
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
							<td class="ref-glyph">{show(s)}</td>
							<td>{s.names[0]}</td>
							<td class="mono">{unicodeLabel(s)}</td>
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
	.intro {
		padding-top: 64px;
	}

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

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
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

		.detail {
			position: sticky;
			top: 70px;
			align-self: start;
		}
	}

	.group-title {
		color: #fff;
		font-size: 0.95rem !important;
		margin: 0.8rem 0 0.45rem !important;
	}

	.count {
		color: #999;
		font-weight: normal;
		font-size: 0.8rem;
	}

	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(66px, 1fr));
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
		font-size: 0.66rem;
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

	.detail {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.8rem 0.9rem;
		margin-top: 0.8rem;
		min-width: 0;
	}

	.detail-head {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.detail-glyph {
		font-size: 2.8rem;
		line-height: 1;
		min-width: 3.2rem;
		text-align: center;
		color: #8ede8e;
	}

	.detail-name {
		color: #fff;
		font-weight: 700;
		font-size: 1.05rem;
		margin: 0;
	}

	.detail-also {
		color: #bbb;
		font-size: 0.8rem;
		margin: 0.1rem 0 0;
	}

	.detail-meaning {
		font-size: 0.88rem;
		margin: 0.7rem 0;
	}

	.codes {
		margin: 0;
	}

	.codes > div {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding: 0.45rem 0;
	}

	.codes dt {
		color: #999;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.codes dd {
		margin: 0.1rem 0 0;
		font-size: 0.9rem;
		color: #ddd;
		overflow-wrap: anywhere;
	}

	.codes code {
		color: #8ede8e;
		font-size: 0.95rem;
		margin-right: 0.4rem;
	}

	.copy {
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		cursor: pointer;
		vertical-align: 1px;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.sub {
		display: block;
		color: #aaa;
		font-size: 0.78rem;
		margin-top: 0.15rem;
	}

	.none {
		color: #bbb;
	}

	.detail-links {
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.5rem;
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
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.15rem 0.9rem;
		align-items: start;
		padding: 0.6rem 0.9rem;
	}

	.look-glyphs {
		font-size: 1.4rem;
		white-space: pre;
		color: #fff;
		grid-row: 1 / span 2;
		line-height: 1.2;
		min-width: 4.5rem;
	}

	.look-codes {
		font-size: 0.8rem;
		color: #8ede8e !important;
	}

	.look-note {
		color: #ccc;
		font-size: 0.88rem;
	}

	.reference {
		font-size: 0.88rem;
	}

	.reference td,
	.reference th {
		padding: 0.25rem 0.7rem;
	}

	.reference .ref-glyph {
		font-size: 1.2rem;
		color: #fff;
		text-align: center;
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
		.tool {
			padding: 0.9rem 0.8rem 1rem;
		}

		.tile {
			height: 68px;
		}
	}

	@media print {
		:global(html.print-symbol-table section:not(#reference)),
		:global(html.print-symbol-table #reference .section-intro) {
			display: none;
		}

		.toast-wrap {
			display: none;
		}
	}
</style>
