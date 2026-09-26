<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { asciiTable, asciiBlocks, encodeText, placeValues, type AsciiRow } from '$lib/textEncoding';
	import { readUrl, syncUrl, safeText, safeInt } from '$lib/urlState';
	import { onMount } from 'svelte';

	// The filter and the open row live in the query string, so a link to one
	// character opens with it expanded.
	const DEFAULTS = { q: '', c: '' };
	onMount(() => {
		const p = readUrl();
		query = safeText(p.q, 40) ?? query;
		const code = safeInt(p.c, 0, 127);
		if (code !== undefined) selected = code;
	});

	let query = '';
	let selected: number | null = null;
	$: syncUrl({ q: query, c: selected ?? '' }, DEFAULTS);

	const table = asciiTable();
	const blocks = asciiBlocks();
	const controls = table.filter((r) => r.kind === 'control');

	/**
	 * How well a row matches the filter, lower is better, or null for no match.
	 * A single character matches itself first, a number its decimal code, then
	 * its hex code, and words search the names.
	 */
	function score(row: AsciiRow, raw: string): number | null {
		const q = raw.trim();
		if (!raw) return 0;
		if (raw === ' ' && row.code === 32) return 0;
		if (!q) return null;
		const lower = q.toLowerCase();
		if (q.length === 1 && row.char === q) return 0;
		if (row.abbr && row.abbr.toLowerCase() === lower) return 0;
		if (/^\d+$/.test(q) && Number(q) === row.code) return 0;
		if (/^[01]{7,8}$/.test(q) && parseInt(q, 2) === row.code) return 0;
		if (row.escape === q || row.caret?.toLowerCase() === lower) return 0;
		if (/^(0x)?[0-9a-f]{1,2}$/i.test(q) && parseInt(q.replace(/^0x/i, ''), 16) === row.code) return 1;
		if (q.length > 1 && row.name.toLowerCase().includes(lower)) return 2;
		if (q.length > 1 && row.use?.toLowerCase().includes(lower)) return 3;
		return null;
	}

	$: rows = query
		? table
				.map((row) => ({ row, s: score(row, query) }))
				.filter((r) => r.s !== null)
				.sort((a, b) => (a.s ?? 0) - (b.s ?? 0) || a.row.code - b.row.code)
				.map((r) => r.row)
		: table;

	function toggle(code: number) {
		selected = selected === code ? null : code;
	}

	/** The other case of a letter, which differs in the bit worth 32. */
	const partner = (row: AsciiRow) =>
		row.kind === 'upper' ? table[row.code + 32] : row.kind === 'lower' ? table[row.code - 32] : null;

	const A = table[65];
	const a = table[97];
	// Found rather than assumed: the one position where A and a differ.
	const caseBit = A.binary.split('').findIndex((bit, i) => bit !== a.binary[i]);
	const digits = table.filter((r) => r.kind === 'digit');
	const eAcute = encodeText('é')[0];

	const faqs = [
		{
			q: 'What is the ASCII code for A?',
			a: `Capital A is ${A.code} in decimal, ${A.hex} in hex and ${A.binary} in binary. Small a is ${a.code}, ${a.hex} in hex. The capitals run from 65 to 90 and the small letters from 97 to 122, in alphabetical order.`
		},
		{
			q: 'How many characters are in ASCII?',
			a: `128, numbered 0 to 127, because ASCII uses 7 bits and 2^7 is 128. ${
				controls.length
			} of them are control codes, which are not printed; the other ${
				128 - controls.length
			} are the space, digits, letters and punctuation.`
		},
		{
			q: 'What is the difference between ASCII and Unicode?',
			a: 'ASCII has 128 characters, enough for English. Unicode numbers every character of every writing system, well over 100,000 of them, and its first 128 are ASCII with the same numbers. UTF-8, the usual way to store Unicode, stores those 128 as the same single bytes, so ASCII text is valid UTF-8.'
		},
		{
			q: 'Why is a 32 more than A?',
			a: `So that changing case is a single bit. ${A.char} is ${A.binary} and ${a.char} is ${a.binary}: they differ only in the bit worth 32. Old hardware could switch case, or ignore it when comparing, by setting or clearing that bit.`
		},
		{
			q: 'What are the characters 128 to 255?',
			a: 'They are not ASCII. ASCII stops at 127. Many 8-bit character sets, loosely called extended ASCII, used 128 to 255 for accented letters, box drawing and symbols, but each set used them differently, so the same byte could be é on one computer and something else on another. Unicode and UTF-8 replaced them.'
		},
		{
			q: 'What is the difference between LF and CR?',
			a: 'LF, line feed, is code 10 and moves down a line; CR, carriage return, is code 13 and moves back to the start of the line. They come from teleprinters, which needed both. Unix, Linux and macOS end a line of text with LF alone, Windows with CR followed by LF.'
		}
	];

	const page = {
		title: 'ASCII Table: Every Code in Decimal, Hex and Binary',
		description:
			'The full ASCII table: all 128 characters with their decimal, hex, binary and octal codes, what each control character does, and how the table is laid out.',
		url: `${SITE}/ascii-table`,
		image: `${SITE}/og/ascii-table.png`,
		imageAlt: 'LogicGates.org: the ASCII table in decimal, hex and binary'
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
					{ '@type': 'ListItem', position: 3, name: 'ASCII table' }
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
		{ href: '/binary-translator', label: 'Binary translator' },
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/learn/bits-with-meaning', label: 'Lesson: how bits become letters' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>ASCII table</h1>
		<p class="lede">
			All 128 ASCII characters with their codes in decimal, hex and binary. Control characters are listed by their
			abbreviation and name. Search for a character, a code or a name, and select a row to see its bits.
		</p>

		<div class="filter-bar no-print">
			<label class="field" for="filter">Find a character, code or name</label>
			<input
				id="filter"
				class="expression-input"
				type="search"
				bind:value={query}
				placeholder="A, 65, 0x41, 1000001, line feed"
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
			/>
			<p class="field-help" role="status">
				{#if query}
					{rows.length} of 128 codes match.
					<button type="button" class="link-btn" on:click={() => (query = '')}>Show all</button>
				{:else}
					Showing all 128 codes.
				{/if}
			</p>
		</div>

		<div class="table-scroll">
			<table class="data-table ascii">
				<thead>
					<tr>
						<th scope="col">Dec</th>
						<th scope="col">Hex</th>
						<th scope="col">Binary</th>
						<th scope="col" class="oct">Oct</th>
						<th scope="col">Char</th>
						<th scope="col">Name</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.code)}
						<tr class={row.kind} class:open={selected === row.code} on:click={() => toggle(row.code)}>
							<td class="mono">{row.code}</td>
							<td class="mono">{row.hex}</td>
							<td class="mono bin">{row.binary}</td>
							<td class="mono oct">{row.octal}</td>
							<td class="char">
								<button
									type="button"
									class="row-btn"
									aria-expanded={selected === row.code}
									aria-label="{row.name}, code {row.code}: show its bits"
									on:click|stopPropagation={() => toggle(row.code)}>{row.char === ' ' ? 'SP' : row.char}</button
								>
							</td>
							<td class="name">{row.name}</td>
						</tr>
						{#if selected === row.code}
							{@const pv = placeValues(row.code)}
							{@const other = partner(row)}
							<tr class="detail">
								<td colspan="6">
									<div class="detail-box">
										<div class="bits-grid" aria-label="Bits of {row.code}">
											{#each pv.bits as bit, i}
												<span class="bit-cell {bit ? 'one' : 'zero'}"
													><span class="w">{pv.weights[i]}</span><span class="b">{bit}</span></span
												>
											{/each}
										</div>
										<p>
											<strong>{row.abbr ? `${row.abbr}, ${row.name}` : `${row.char}, ${row.name}`}.</strong>
											{#if pv.terms.length}{pv.terms.join(' + ')} = {row.code}.{:else}All bits 0.{/if}
											Octal {row.octal}, HTML <span class="mono">&amp;#{row.code};</span>{#if row.caret}, typed as
												<span class="mono">{row.caret}</span>{/if}{#if row.escape}, written
												<span class="mono">{row.escape}</span> in C{/if}. As a byte it is
											<span class="mono">0{row.binary}</span>, the same in UTF-8.
										</p>
										{#if row.use}<p>{row.use}</p>{/if}
										{#if other}
											<p>
												Its other case, {other.char}, is {other.code}: <span class="mono">{other.binary}</span>, the
												same bits apart from the one worth 32.
											</p>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		{#if !rows.length}
			<p class="field-help">Nothing in ASCII matches that. ASCII has only codes 0 to 127.</p>
		{/if}
		<p class="reducer">
			Binary is shown in the 7 bits ASCII uses; stored in a byte it has an extra 0 in front. To turn a whole message
			into binary, use the <a href="/binary-translator">binary translator</a>.
		</p>
	</section>

	<section id="what">
		<h2>What ASCII is</h2>
		<p>
			ASCII, the American Standard Code for Information Interchange, was published in 1963 so that teleprinters and
			computers from different makers could exchange text. It gives a number from 0 to 127 to each of the English
			letters in both cases, the ten digits, punctuation, the space and {controls.length} control codes that tell a device
			what to do rather than what to print. 128 codes fit exactly in 7 bits.
		</p>
		<p>
			A code like this is what turns bits into text: the byte <span class="mono">01000001</span> means nothing until a
			code says it is A. The lesson <a href="/learn/bits-with-meaning">how bits become letters, colours and codes</a> starts
			from there.
		</p>
	</section>

	<section id="structure">
		<h2>How the table is laid out</h2>
		<p class="section-intro">
			The order is not arbitrary. The top two of the seven bits split the table into four blocks of 32, and the bottom
			five bits pick a character within the block.
		</p>
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Top bits</th>
						<th scope="col">Codes</th>
						<th scope="col">Contains</th>
					</tr>
				</thead>
				<tbody>
					{#each blocks as b}
						<tr>
							<td class="mono">{b.topBits}xxxxx</td>
							<td class="mono nowrap">{b.first} to {b.last}</td>
							<td>{b.contains}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<h3 class="sub">Why A is 65 and a is 97</h3>
		<p>
			Capitals sit in the third block and small letters in the fourth, at the same place, so a letter and its other case
			are exactly 32 apart. In binary that is a single bit:
		</p>
		<div class="table-scroll">
			<table class="data-table compare">
				<tbody>
					{#each [A, a] as row}
						<tr>
							<th scope="row" class="char">{row.char}</th>
							<td class="mono">{row.code}</td>
							{#each row.binary.split('') as bit, i}
								<td class="mono cell" class:flip={i === caseBit}>{bit}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The highlighted bit is worth 32. Setting it makes a letter small, clearing it makes it a capital, and ignoring it
			compares letters without regard to case. The last five bits are the letter's place in the alphabet: A and a are 1,
			Z and z are 26.
		</p>

		<h3 class="sub">Digits: the low four bits are the value</h3>
		<p>
			The digits 0 to 9 are codes {digits[0].code} to {digits[9].code}, which is <span class="mono">011</span> followed
			by the digit in four bits. Clearing the top bits turns the character into its value, and those four bits are
			exactly the digit's <a href="/binary-converter#bcd">BCD code</a>.
		</p>
		<div class="table-scroll">
			<table class="data-table digits">
				<thead>
					<tr>
						<th scope="col">Char</th>
						{#each digits as d}<th scope="col" class="mono">{d.char}</th>{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Dec</th>
						{#each digits as d}<td class="mono">{d.code}</td>{/each}
					</tr>
					<tr>
						<th scope="row">Hex</th>
						{#each digits as d}<td class="mono">{d.hex}</td>{/each}
					</tr>
					<tr>
						<th scope="row">Low 4 bits</th>
						{#each digits as d}<td class="mono strong">{d.binary.slice(3)}</td>{/each}
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section id="control">
		<h2>Control characters</h2>
		<p class="section-intro">
			Codes 0 to 31 and 127 are not printed. They were written for teleprinters and data links, and a few are in daily
			use: tab, line feed, carriage return and escape. Each can be typed as Ctrl with the character 64 above it, which
			is where the caret notation comes from.
		</p>
		<div class="table-scroll">
			<table class="data-table controls">
				<thead>
					<tr>
						<th scope="col">Dec</th>
						<th scope="col">Hex</th>
						<th scope="col">Abbr</th>
						<th scope="col">Caret</th>
						<th scope="col">Name and use</th>
					</tr>
				</thead>
				<tbody>
					{#each controls as row}
						<tr>
							<td class="mono">{row.code}</td>
							<td class="mono">{row.hex}</td>
							<td class="mono strong">{row.abbr}</td>
							<td class="mono nowrap"
								>{row.caret}{#if row.escape}<span class="dim"> {row.escape}</span>{/if}</td
							>
							<td><strong class="cname">{row.name}</strong>. {row.use}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="unicode">
		<h2>ASCII and Unicode</h2>
		<p>
			ASCII covers English and nothing more. Unicode gives a number, its code point, to every character in every writing
			system, and it starts with ASCII: A is U+0041, which is 65, in both. UTF-8, the encoding nearly every web page and
			file uses today, stores those first 128 as the same single bytes, so any ASCII text is already UTF-8.
		</p>
		<p>
			Characters past 127 take two to four bytes in UTF-8. é is {eAcute.label}, stored as
			<span class="mono">{eAcute.bytes.map((b) => b.binary).join(' ')}</span>. The
			<a href="/binary-translator">binary translator</a> shows this breakdown for any text, and
			<a href="/base64">Base64</a> is how those bytes are written when only ASCII characters can be sent.
		</p>
	</section>

	<section id="extended">
		<h2>Extended ASCII</h2>
		<p>
			ASCII uses 7 bits, and computers store 8, which leaves codes 128 to 255 free. Many character sets filled them, and
			all of them are loosely called extended ASCII, but there was never one standard. ISO 8859-1 (Latin-1) and
			Windows-1252 put accented letters there, so 233 is é; the original IBM PC's code page 437 put box-drawing
			characters and Greek letters there, so 233 is Θ. A file written with one and read with another comes out garbled.
			That mess is what Unicode ended; in UTF-8, bytes above 127 only ever appear as parts of multi-byte characters.
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

	.filter-bar {
		margin-bottom: 0.8rem;
		max-width: 520px;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.expression-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.7rem;
	}

	.expression-input::placeholder {
		color: #888;
	}

	.expression-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #8ede8e;
		text-decoration: underline;
		cursor: pointer;
		font-size: inherit;
	}

	.table-scroll {
		overflow-x: auto;
		border-radius: 3px;
		margin-bottom: 0.4rem;
	}

	.ascii {
		width: 100%;
	}

	.ascii tbody tr:not(.detail) {
		cursor: pointer;
	}

	.ascii tbody tr:not(.detail):hover td {
		background-color: rgba(255, 255, 255, 0.05);
	}

	.ascii tr.open td {
		background-color: rgba(51, 119, 34, 0.2);
	}

	.ascii th,
	.ascii td {
		padding: 0.3rem 0.7rem;
	}

	.bin {
		letter-spacing: 0.04em;
	}

	.char {
		color: #fff !important;
		white-space: nowrap;
	}

	.row-btn {
		background: none;
		border: none;
		padding: 0;
		color: #fff;
		font: 600 1rem ui-monospace, SFMono-Regular, Menlo, monospace;
		cursor: pointer;
		min-width: 2.2rem;
		text-align: left;
	}

	.ascii tr.control .row-btn,
	.ascii tr.space .row-btn {
		color: #d8b45a;
		font-size: 0.8rem;
	}

	.name {
		color: #bbb;
	}

	.detail td {
		padding: 0;
	}

	.detail-box {
		padding: 0.7rem 0.9rem 0.8rem;
		background-color: #101012;
		border-left: 3px solid #5db65d;
	}

	.detail-box p {
		margin: 0.4rem 0 0;
		font-size: 0.88rem;
		color: #ccc;
		max-width: 640px;
	}

	.bits-grid {
		display: inline-grid;
		grid-template-columns: repeat(8, minmax(2rem, 2.6rem));
		gap: 3px;
	}

	.bit-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.15rem 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.bit-cell .w {
		font-size: 0.68rem;
		color: #999;
	}

	.bit-cell .b {
		font-size: 1rem;
		font-weight: 700;
	}

	.bit-cell.one .b {
		color: #5db65d;
	}

	.bit-cell.zero .b {
		color: #f66;
	}

	.bit-cell.one {
		border-color: #5db65d;
	}

	.sub {
		margin-top: 1.8rem !important;
		font-size: 1.05rem !important;
	}

	.nowrap {
		white-space: nowrap;
	}

	.compare .cell {
		text-align: center;
		padding-left: 0.55rem;
		padding-right: 0.55rem;
	}

	.compare .flip {
		color: #fff;
		font-weight: 700;
		background-color: rgba(51, 119, 34, 0.45);
	}

	.digits th,
	.digits td {
		text-align: center;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
	}

	.digits tbody th {
		color: #fff;
		white-space: nowrap;
		text-align: left;
	}

	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.dim {
		color: #999;
	}

	.controls td {
		vertical-align: top;
	}

	.cname {
		color: #fff;
		font-weight: 600;
	}

	@media (max-width: 560px) {
		.oct {
			display: none;
		}
		.ascii th,
		.ascii td {
			padding: 0.3rem 0.45rem;
		}
	}

	@media print {
		.ascii {
			font-size: 0.8rem;
		}
		.ascii .row-btn {
			display: inline !important;
		}
		.oct {
			display: table-cell !important;
		}
	}
</style>
