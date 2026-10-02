<script lang="ts">
	// Everything about one symbol, with a copy button for each code. The page
	// shows it beside the grid on a wide screen and under the selected tile's
	// group on a phone, so it is a component of its own.
	import {
		unicodeLabel,
		hexReference,
		decimalReference,
		htmlCode,
		wordInput,
		type SymbolEntry
	} from '$lib/symbolTable';

	export let selected: SymbolEntry;
	export let copy: (text: string, what: string) => void;

	$: word = wordInput(selected);
	$: shown = selected.display ?? selected.glyph;
	$: html = htmlCode(selected);
	$: hex = hexReference(selected);
	$: dec = decimalReference(selected);
	/** A combining character is typed after the letter it sits on. */
	$: combining = !!selected.display;
</script>

<aside class="detail" id="detail" aria-labelledby="detail-name">
	<div class="detail-head">
		<span class="detail-glyph" aria-hidden="true">{shown}</span>
		<div class="detail-title">
			<p class="detail-name" id="detail-name">{selected.names[0]}</p>
			{#if selected.names.length > 1}
				<p class="detail-also">Also: {selected.names.slice(1).join(', ')}</p>
			{/if}
			<button type="button" class="copy copy-main" on:click={() => copy(selected.glyph, selected.names[0])}
				>Copy symbol</button
			>
		</div>
	</div>
	<p class="detail-meaning">{selected.meaning}</p>
	<dl class="codes">
		<div>
			<dt>Unicode</dt>
			<dd>
				<code class="mono">{unicodeLabel(selected)}</code>
				<button type="button" class="copy" on:click={() => copy(unicodeLabel(selected), 'code point')}>Copy</button>
			</dd>
		</div>
		<div>
			<dt>HTML</dt>
			<dd>
				<span class="code-line">
					<code class="mono">{html}</code>
					<button type="button" class="copy" on:click={() => copy(html, 'HTML')}>Copy</button>
				</span>
				{#if hex !== html}
					<span class="code-line">
						<code class="mono small">{hex}</code>
						<button type="button" class="copy" on:click={() => copy(hex, 'hex reference')}>Copy</button>
					</span>
				{/if}
				{#if dec !== html}
					<span class="code-line">
						<code class="mono small">{dec}</code>
						<button type="button" class="copy" on:click={() => copy(dec, 'decimal reference')}>Copy</button>
					</span>
				{/if}
				{#if !selected.entity}<span class="sub">HTML has no named entity for it.</span>{/if}
			</dd>
		</div>
		<div>
			<dt>LaTeX</dt>
			<dd>
				{#if selected.latex}
					<code class="mono">{selected.latex}</code>
					<button type="button" class="copy" on:click={() => copy(selected.latex ?? '', 'LaTeX')}>Copy</button>
					{#if selected.amssymb}<span class="sub">Needs <span class="mono">\usepackage{'{'}amssymb{'}'}</span></span
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
				{:else if combining}
					Type the letter, then <kbd>{word.code}</kbd>. Select just <kbd>{word.code}</kbd> and press
					<kbd>Alt</kbd>+<kbd>X</kbd>: after a letter A to F, Word would read the letter as part of the code.
				{:else}
					Type <kbd>{word.code}</kbd> then press <kbd>Alt</kbd>+<kbd>X</kbd>{#if word.then}, then type
						<kbd>{word.then}</kbd>{/if}.
					<span class="sub">After a letter A to F or a digit, select the code before pressing Alt+X.</span>
				{/if}
				{#if word.kind !== 'keyboard'}<span class="sub">Alt+X works in Word for Windows.</span>{/if}
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

<style>
	.detail {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.8rem 0.9rem;
		min-width: 0;
	}

	.detail-head {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.detail-title {
		flex: 1 1 auto;
		min-width: 0;
	}

	.detail-glyph {
		font-family: 'Cambria Math', 'STIX Two Math', 'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Math', serif;
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

	.codes code.small {
		color: #ccc;
		font-size: 0.85rem;
	}

	.code-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}

	.copy {
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.78rem;
		min-height: 28px;
		padding: 0.25rem 0.7rem;
		cursor: pointer;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.copy-main {
		margin-top: 0.4rem;
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

	@media (max-width: 480px) {
		.copy {
			min-height: 36px;
		}
	}
</style>
