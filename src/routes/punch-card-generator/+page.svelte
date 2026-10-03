<script lang="ts">
	import { scrollRegion } from '$lib/scrollRegion';
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import PageHead from '$lib/PageHead.svelte';
	import { copyText, downloadPng, downloadSvg } from '$lib/download';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import { onMount, tick } from 'svelte';
	import {
		CARD_CODE,
		MAX_CHARS,
		UNREADABLE,
		TRACKS,
		baudotTable,
		cardScene,
		cardTable,
		describe,
		ebcdic,
		packCells,
		punch,
		read,
		scene,
		sceneSvg,
		unpackCells,
		workingColumns,
		type Medium
	} from '$lib/punchCard';

	const MEDIA: { id: Medium; label: string; name: string }[] = [
		{ id: 'card', label: '80-column card', name: 'punched card' },
		{ id: 'baudot', label: 'Baudot tape (5 tracks)', name: 'Baudot paper tape' },
		{ id: 'ascii', label: 'ASCII tape (8 tracks)', name: 'ASCII paper tape' }
	];
	const DEFAULTS = { m: 'card', t: 'HELLO, WORLD' };
	// Tape can run longer than the text because of shift frames.
	const FRAME_LIMIT = 240;

	let medium: Medium = 'card';
	let text = DEFAULTS.t;
	let punched = punch(medium, text);
	let cells = punched.cells;
	let notes = punched.notes;
	/** The column or frame being shown in the readout, and the cell that takes the keyboard. */
	let hot = 0;
	let cur = 0;
	let svgEl: SVGSVGElement;

	function setText(next: string) {
		text = next;
		punched = punch(medium, next);
		cells = punched.cells;
		notes = punched.notes;
		hot = Math.min(hot, Math.max(cells.length - 1, 0));
	}
	function setMedium(next: Medium) {
		medium = next;
		hot = cur = 0;
		setText(text);
	}
	function toggle(i: number) {
		const hit = sc.hits[i];
		cells[hit.col] ^= hit.bit;
		const r = read(medium, cells);
		text = r.text;
		notes = r.notes;
		cells = cells;
	}

	onMount(() => {
		const p = readUrl();
		medium = safeOption(p.m, ['card', 'baudot', 'ascii'] as const) ?? medium;
		const packed = unpackCells(p.h ?? '', FRAME_LIMIT, medium);
		if (p.h !== undefined && packed) {
			cells = packed;
			const r = read(medium, cells);
			text = r.text;
			notes = r.notes;
		} else setText(safeText(p.t, 400) ?? text);
		tick().then(() => syncUrl(urlState, DEFAULTS));
	});

	// The link holds the text, unless holes were edited so that they no longer match it.
	$: edited = packCells(cells) !== packCells(punch(medium, text).cells);
	$: lastUsed = cells.reduce((n, v, i) => (v ? i + 1 : n), 0);
	$: urlState = {
		m: medium,
		t: edited ? '' : text,
		h: edited ? packCells(medium === 'card' ? cells.slice(0, lastUsed) : cells) : ''
	};
	$: syncUrl(urlState, DEFAULTS);

	$: sc = scene(medium, cells);
	$: rows = TRACKS[medium];
	$: band = cells.length ? sc.band(Math.min(hot, cells.length - 1)) : null;
	$: svg = sceneSvg(sc);

	const hitIndex = (e: Event) => Number((e.target as Element).closest?.('[data-i]')?.getAttribute('data-i') ?? -1);
	function onOver(e: Event) {
		const i = hitIndex(e);
		if (i >= 0) hot = sc.hits[i].col;
	}
	function onClick(e: MouseEvent) {
		const i = hitIndex(e);
		if (i < 0) return;
		cur = i;
		hot = sc.hits[i].col;
		toggle(i);
	}
	async function onKey(e: KeyboardEvent) {
		const i = hitIndex(e);
		if (i < 0) return;
		const step: Record<string, number> = { ArrowRight: rows, ArrowLeft: -rows, ArrowDown: 1, ArrowUp: -1 };
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			toggle(i);
			return;
		}
		let j = i + (step[e.key] ?? 0);
		if (e.key === 'Home') j = i % rows;
		if (e.key === 'End') j = sc.hits.length - rows + (i % rows);
		if (!(e.key in step || e.key === 'Home' || e.key === 'End')) return;
		e.preventDefault();
		if (
			j < 0 ||
			j >= sc.hits.length ||
			(Math.abs(step[e.key] ?? 0) === 1 && Math.floor(j / rows) !== Math.floor(i / rows))
		)
			return;
		cur = j;
		hot = sc.hits[j].col;
		await tick();
		(svgEl.querySelector(`[data-i="${j}"]`) as SVGElement | null)?.focus();
	}

	let copied = '';
	let timer: ReturnType<typeof setTimeout>;
	async function copy() {
		copied = (await copyText(text)) ? 'Copied' : 'Select the text and copy it';
		clearTimeout(timer);
		timer = setTimeout(() => (copied = ''), 2000);
	}
	const fileName = (ext: string) =>
		`${medium === 'card' ? 'punch-card' : medium === 'baudot' ? 'baudot-tape' : 'ascii-tape'}.${ext}`;

	// Everything below is worked out by the engine, so the prose and tables cannot drift from the code.
	const chips = [
		'HELLO, WORLD',
		'LOGIC GATES 74',
		'A+B=C (1.5)',
		CARD_CODE.slice(37)
			.map((c) => c.ch)
			.join('')
	];
	const working = workingColumns('CARD 80');
	const table = cardTable();
	const baudot = baudotTable();
	const exercise = 'NAND 7400';
	const exerciseScene = cardScene(punch('card', exercise).cells, 12);
	const working0 = workingColumns(exercise)[0];
	const hex = (n: number | undefined) => (n ?? 0).toString(16).toUpperCase();
	const parity = ['A', 'C'].map((c) => ({ c, byte: punch('ascii', c).cells[0] }));
	const shifts = punch('baudot', '1 2').cells;
	const ebA = hex(ebcdic(punch('card', 'A').cells[0]));

	const faqs = [
		{
			q: 'How does a punch card store a letter?',
			a: `Each column has 12 rows, and a character is a pattern of punches in one column. A digit is one punch, in the row of that digit. A letter is two: a zone punch (row 12, 11 or 0) and a digit punch (1 to 9). A is 12 and 1, J is 11 and 1, S is 0 and 2. A card has ${MAX_CHARS} columns, so it holds ${MAX_CHARS} characters.`
		},
		{
			q: 'Why do the letters need two holes?',
			a: `Ten digits fit in ten rows, but 26 letters do not. Using a zone punch with a digit punch gives 3 zones times 9 digits, which is more than enough, and keeps the three groups A to I, J to R and S to Z in order. Of the 4,096 possible patterns in a column, this page's card code uses ${CARD_CODE.length}.`
		},
		{
			q: 'How does a card become EBCDIC?',
			a: `A card reader gives the computer the 12 bits of each column. EBCDIC was arranged to follow the card code: the zone punch becomes the high hex digit (12 gives C, 11 gives D, 0 gives E, none gives F for digits) and the digit punch becomes the low hex digit. A, which is 12 and 1, is ${ebA}. The table above is checked against Python's cp037 EBCDIC codec.`
		},
		{
			q: 'What are LTRS and FIGS on Baudot tape?',
			a: `Five holes give only 32 codes, so the same code means a letter or a figure depending on the last shift frame. LTRS (11111) switches to letters and FIGS (11011) to figures. Spaces, carriage return and line feed are the same in both. This page starts in letters, adds a shift only when the set changes, and leaves the shift on across a space, so "1 2" is the ${
				shifts.length
			} frames ${shifts.join(', ')}.`
		},
		{
			q: 'Why does ASCII tape have a parity hole?',
			a: `ASCII has 7 bits, and the 8th track carries a parity bit so that a frame never has an odd number of holes. A is 41 in hex with two bits set, so its parity bit stays clear and the frame is ${hex(
				parity[0].byte
			)}. C is 43 with three bits set, so the parity track is punched and the frame is ${hex(
				parity[1].byte
			)}. A single missed or extra hole then shows up as an odd frame.`
		},
		{
			q: 'Why are there no lowercase letters?',
			a: 'The card code here is capitals, digits and symbols, and Baudot has one case of letters. Lowercase text typed above is punched as capitals on the card and on Baudot tape. ASCII tape keeps the case you type.'
		}
	];
	const page = {
		title: 'Punch Card Generator and Reader: Hollerith and Paper Tape',
		description:
			'Type text to punch an 80-column Hollerith card or Baudot and ASCII paper tape, or click the holes to read it back. See the zones, digits and codes.',
		url: `${SITE}/punch-card-generator`,
		image: `${SITE}/og/punch-card-generator.png`,
		imageAlt: 'LogicGates.org: punch card generator and reader, with paper tape'
	};
</script>

<PageHead {page} {faqs} crumb="Punch card generator and reader" />

<ContentPage
	tool
	related={[
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary' },
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/seven-segment-decoder', label: 'Seven-segment decoder' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Punch card generator and reader</h1>
		<p class="lede">
			Type text and see it punched into an 80-column card or a strip of paper tape. Click any hole to add or remove it
			and read what the holes say.
		</p>

		<div class="card tool">
			<div class="seg" role="group" aria-label="Medium">
				{#each MEDIA as m}
					<button
						type="button"
						class:active={medium === m.id}
						aria-pressed={medium === m.id}
						on:click={() => setMedium(m.id)}>{m.label}</button
					>
				{/each}
			</div>

			<label class="field" for="text">Text to punch (up to {MAX_CHARS} characters)</label>
			<input
				id="text"
				class="text mono"
				type="text"
				autocomplete="off"
				spellcheck="false"
				value={text}
				on:input={(e) => setText(e.currentTarget.value)}
				aria-describedby="notes"
			/>
			<div class="chips">
				{#each chips as c}
					<button type="button" class="chip-btn mono" on:click={() => setText(c)}
						>{c.length > 14 ? 'All specials' : c}</button
					>
				{/each}
			</div>
			<div id="notes" role="status">
				{#each notes as n}<p class="note warn" role="alert">{n}</p>{/each}
			</div>

			<div class="scroll-box" use:scrollRegion data-label="{MEDIA.find((m) => m.id === medium)?.name} drawing">
				<svg
					bind:this={svgEl}
					width={sc.w}
					height={sc.h}
					viewBox="0 0 {sc.w} {sc.h}"
					role="group"
					aria-label="Holes. Press space on a hole to toggle it, arrow keys to move."
					on:mouseover={onOver}
					on:focus={onOver}
					on:focusin={onOver}
					on:click={onClick}
					on:keydown={onKey}
				>
					<g>{@html sc.inner}</g>
					{#if band}<rect class="band" {...band} />{/if}
					{#each sc.hits as h, i}
						<rect
							class="hit"
							x={h.x}
							y={h.y}
							width={h.w}
							height={h.h}
							data-i={i}
							role="checkbox"
							aria-checked={(cells[h.col] & h.bit) !== 0}
							aria-label={h.label}
							tabindex={i === cur ? 0 : -1}
						/>
					{/each}
				</svg>
			</div>
			<p class="readout" aria-live="off">
				{describe(medium, cells, Math.min(hot, cells.length - 1)) || 'Nothing is punched yet.'}
			</p>
			<p class="note">
				{#if medium === 'card'}
					Rows run 12, 11, 0, 1 to 9 from the top; the cut corner is top left and column 1 is at the left. A column that
					is no known character reads as {UNREADABLE}.
				{:else}
					Frames run left to right in reading order. Track 1, the least significant bit, is the bottom row; the small
					holes are the feed holes{medium === 'ascii' ? ', and track 8 is the parity bit' : ''}.
				{/if}
			</p>

			<div class="actions">
				<button type="button" class="chip-btn" on:click={copy}>Copy text</button>
				<button type="button" class="chip-btn" on:click={() => downloadSvg(svg, fileName('svg'))}>Download SVG</button>
				<button type="button" class="chip-btn" on:click={() => downloadPng(svg, fileName('png'))}>Download PNG</button>
				<span class="copied" aria-live="polite">{copied}</span>
			</div>
		</div>
	</section>

	<section id="column">
		<h2>How a column stores a character</h2>
		<p>
			A card column has 12 positions. Rows 0 to 9 are the digits, and rows 12 and 11 above them are the zones; row 0
			doubles as a zone. A digit is a single hole. A letter is a zone hole plus a digit hole: A to I are 12 with 1 to 9,
			J to R are 11 with 1 to 9, and S to Z are 0 with 2 to 9. Space is a column with no holes. Read as binary, the
			column is a 12-bit number with the top row as the top bit, which is what a card reader hands to the computer.
		</p>
		<div class="table-wrap scroll-box" use:scrollRegion data-label="Worked example">
			<table class="data-table">
				<caption>"CARD 80", column by column</caption>
				<thead
					><tr
						><th scope="col">Character</th><th scope="col">Punches</th><th scope="col">12-bit column</th><th scope="col"
							>EBCDIC (hex)</th
						></tr
					></thead
				>
				<tbody>
					{#each working as w}
						<tr
							><th scope="row" class="mono">{w.ch === ' ' ? 'space' : w.ch}</th><td class="mono">{w.punches}</td><td
								class="mono">{w.column}</td
							><td class="mono">{w.ebcdic}</td></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			The EBCDIC byte follows from the punches: the zone chooses the high hex digit and the digit punch the low one, so
			the card code and EBCDIC line up. {MAX_CHARS} columns of 12 rows is {MAX_CHARS * 12} hole positions per card, and 80
			columns was also one line of source code per card, which is a common explanation for why 80 characters stayed a default
			line width.
		</p>
	</section>

	<section id="code">
		<h2>The card code on this page</h2>
		<p>
			This is the IBM 029 keypunch set: capitals, digits, space and {CARD_CODE.length - 37} symbols. Each symbol has an 8
			punch with a zone or digit, except &amp;, - and /. Punch patterns not listed here are not read.
		</p>
		<div class="table-wrap scroll-box" use:scrollRegion data-label="Card code table">
			<table class="data-table">
				<thead
					><tr
						><th scope="col">Character</th><th scope="col">Punches</th><th scope="col">12-bit column</th><th scope="col"
							>EBCDIC (hex)</th
						></tr
					></thead
				>
				<tbody>
					{#each table as r}
						<tr
							><th scope="row" class="mono">{r.ch === ' ' ? 'space' : r.ch}</th><td class="mono">{r.punches}</td><td
								class="mono">{r.column}</td
							><td class="mono">{r.ebcdic}</td></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="tape">
		<h2>Paper tape: frames, tracks and shifts</h2>
		<p>
			Paper tape holds one character per frame across the width of the tape. Baudot tape has 5 tracks, so 32 codes;
			ASCII tape has 7 data tracks and an 8th for parity. A row of smaller feed holes runs along the tape, between track
			2 and 3 on five-track tape and between track 3 and 4 on eight-track tape. The track numbering and drawing
			direction are this page's convention; the code values are what matter.
		</p>
		<p>
			Baudot (ITA2) uses two shifts to double the 32 codes. Most codes are a letter or a figure depending on the last
			shift, and the codes marked national use differ between countries, so this page does not read them. Parity on
			ASCII tape is even: {parity[0].c} needs no parity hole and
			{parity[1].c} needs one, as the FAQ shows.
		</p>
		<div class="table-wrap scroll-box" use:scrollRegion data-label="Baudot code table">
			<table class="data-table">
				<thead
					><tr><th scope="col">Code (track 5 to 1)</th><th scope="col">Letters</th><th scope="col">Figures</th></tr
					></thead
				>
				<tbody>
					{#each baudot as b}
						<tr
							><th scope="row" class="mono">{b.code}</th><td class="mono">{b.letters}</td><td class="mono"
								>{b.figures}</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">Some equipment drops back to letters after every space; this page does not.</p>
	</section>

	<section id="exercise">
		<h2>Read this card</h2>
		<p>The first 12 columns of a card. Work out each column from the rows, then check yourself.</p>
		<div class="scroll-box" use:scrollRegion data-label="Exercise card">
			<div role="img" aria-label="A card with 12 columns to read" class="exercise">{@html sceneSvg(exerciseScene)}</div>
		</div>
		<details>
			<summary>Show the answer</summary>
			<p>
				It reads <span class="mono">{exercise}</span>. The first column has punches {working0.punches}, which is {exercise[0]}.
			</p>
		</details>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Treating rows 12 and 11 as digits.</strong> They are zones. Row 0 is a digit alone and a zone beside another
				digit.
			</li>
			<li>
				<strong>Forgetting the shift on Baudot tape.</strong> The same frame is E or 3. Reading needs the last LTRS or FIGS,
				and the shift stays on across a space.
			</li>
			<li>
				<strong>Reading tape bits in the wrong order.</strong> Here track 1 is the least significant bit. Other sources draw
				or number the tracks the other way, so check before comparing patterns.
			</li>
			<li>
				<strong>Counting the parity hole as data.</strong> On ASCII tape the 8th track only makes the number of holes even.
			</li>
		</ul>
	</section>

	<section class="faq">
		<h2>Questions</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
		<p class="reducer">
			For other text encodings, see the <a href="/ascii-table">ASCII table</a> and <a href="/base64">Base64</a>; for
			numbers in bits, the <a href="/binary-converter">binary converter</a>.
		</p>
	</section>
</ContentPage>

<style>
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}
	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.9rem;
	}
	.seg button,
	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
	}
	.seg button {
		flex: 1 1 8rem;
		font-size: 0.9rem;
		padding: 0.5rem 0.4rem;
	}
	.seg button.active {
		font-weight: 600;
	}
	.chip-btn {
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
	}
	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}
	.chips,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0.5rem 0 0.8rem;
	}
	.text {
		width: 100%;
		box-sizing: border-box;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 1.05rem;
		padding: 0.6rem 0.7rem;
	}
	.text:focus {
		outline: none;
		border-color: #5db65d;
	}
	#notes {
		min-height: 0.1rem;
	}
	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}
	.note.warn {
		color: #ffb3a7;
	}
	.readout {
		margin: 0.6rem 0 0;
		min-height: 2.6em;
		color: #ddd;
		font-size: 0.95rem;
	}
	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}
	.exercise {
		width: max-content;
	}
	svg {
		display: block;
		max-width: none;
	}
	.hit {
		fill: transparent;
		cursor: pointer;
	}
	.hit:hover {
		fill: rgba(93, 182, 93, 0.25);
	}
	.hit:focus-visible {
		outline: none;
		stroke: #1b6b1b;
		stroke-width: 2;
	}
	.band {
		fill: rgba(93, 182, 93, 0.16);
		pointer-events: none;
	}
	.copied {
		color: #8ede8e;
		font-size: 0.8rem;
	}
	caption {
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding-bottom: 0.3rem;
	}
</style>
