<script lang="ts">
	import { scrollRegion } from '$lib/scrollRegion';
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		ByteView,
		fromBytes,
		parseHex,
		HexError,
		detect,
		checkExtension,
		partialMatches,
		hexDump,
		dumpText,
		asciiChar,
		formatHexLines,
		formatBytes,
		hex2,
		hexOffset,
		signatureTable,
		byteOrders,
		EXAMPLES,
		PNG_SIGNATURE,
		ZIP_KINDS,
		FTYP_KINDS,
		CATEGORY_NAMES,
		HEAD_BYTES,
		TAIL_BYTES,
		FORMAT_COUNT,
		zipDirectoryStart
	} from '$lib/fileSignatures';
	import type { Detection, ExtensionStatus, Category, Field } from '$lib/fileSignatures';
	import { readUrl, syncUrl, safeText } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onDestroy, onMount } from 'svelte';

	const exampleText = (hex: string) => formatHexLines(parseHex(hex));
	const DEFAULT = EXAMPLES[0];
	const DEFAULT_HEX = exampleText(DEFAULT.hex);
	/** Long pastes still work; they are just too long to be worth putting in a link. */
	const MAX_LINK_HEX = 12000;
	/** The most bytes handed from a chosen file to the hex box: what still fits in a link. */
	const MAX_HANDOFF = Math.floor(MAX_LINK_HEX / 3);

	let mode: 'hex' | 'file' = 'hex';
	let hexText = DEFAULT_HEX;
	let name = DEFAULT.name;

	// A chosen file: its name, size and the parts that were read.
	let fileView: ByteView | null = null;
	let fileName = '';
	let fileError = '';
	let reading = false;
	let dragging = false;

	onMount(() => {
		const p = readUrl();
		if (p.e === '1') {
			hexText = '';
			name = '';
		} else if (p.h !== undefined || p.n !== undefined) {
			hexText = safeText(p.h, MAX_LINK_HEX) ?? '';
			name = safeText(p.n, 255) ?? '';
		}
		// Drops anything in the query the page did not use, so a copied link holds only what is on screen.
		syncUrl(linkState(mode, hexText, name), {});
		const narrowQuery = window.matchMedia('(max-width: 600px)');
		narrow = narrowQuery.matches;
		const onChange = (e: MediaQueryListEvent) => (narrow = e.matches);
		narrowQuery.addEventListener('change', onChange);
		return () => narrowQuery.removeEventListener('change', onChange);
	});
	// The link holds pasted bytes and the name; a chosen file never goes into it.
	// An emptied box is written as e=1, so that it reopens empty rather than as the example.
	function linkState(mode: 'hex' | 'file', hexText: string, name: string) {
		if (mode !== 'hex' || hexText.length > MAX_LINK_HEX || (hexText === DEFAULT_HEX && name === DEFAULT.name))
			return {};
		return hexText === '' && name === '' ? { e: 1 } : { h: hexText, n: name };
	}
	$: tooLongForLink = hexText.length > MAX_LINK_HEX;
	$: syncUrl(linkState(mode, hexText, name), {});

	/** Eight bytes a row on a phone, sixteen elsewhere; the prerendered page uses sixteen. */
	let narrow = false;
	$: width = narrow ? 8 : 16;
	// Four offset digits are enough for anything under 64 KB, and leave a phone room for the text column.
	$: offsetDigits = narrow && rows.every((r) => r.kind !== 'row' || r.offset < 0x10000) ? 4 : 8;

	let view: ByteView | null = null;
	let pasteError = '';
	$: {
		if (mode === 'hex') {
			try {
				view = fromBytes(parseHex(hexText));
				pasteError = '';
			} catch (e) {
				view = null;
				pasteError = e instanceof HexError ? e.message : 'Those bytes could not be read';
			}
		} else {
			view = fileView;
			pasteError = '';
		}
	}
	// The alert waits for a pause in typing, so a screen reader is not interrupted
	// on every keystroke while a byte is half written. The visible error is immediate.
	let alertText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	$: scheduleAlert(pasteError);
	function scheduleAlert(message: string) {
		clearTimeout(alertTimer);
		if (!message) alertText = '';
		else alertTimer = setTimeout(() => (alertText = message), 500);
	}
	onDestroy(() => clearTimeout(alertTimer));

	$: checkedName = mode === 'hex' ? name : fileName;
	$: detections = view ? detect(view) : [];
	$: primary = detections[0] as Detection | undefined;
	$: partials = view ? partialMatches(view) : [];
	$: verdict = view ? checkExtension(checkedName, detections, view.size, partials) : null;
	// With nothing detected, a cut-off signature is still worth pointing at in the dump.
	$: fields =
		primary?.fields ??
		(partials.length
			? [
					{
						start: 0,
						length: partials[0].have,
						label: `Start of the ${partials[0].name} signature (${partials[0].have} of ${partials[0].need} bytes)`,
						sig: true
					} as Field
			  ]
			: []);
	// A short paste is shown whole; anything longer shows its first 64 bytes and the rows that matter.
	$: rows = view ? hexDump(view, fields, width, view.complete && view.size <= 256 ? 256 : 64) : [];
	$: shownFields = fields.filter((f) => view?.has(f.start, 1));

	const statusWord: Record<ExtensionStatus, string> = {
		match: 'Matches',
		compatible: 'Fits',
		mismatch: 'Mismatch',
		'unknown-ext': 'Unknown extension',
		'no-ext': 'No extension',
		undetected: 'Not recognised',
		empty: 'Empty'
	};
	const certaintyText = {
		certain: 'Certain: the full signature matched',
		likely: 'Likely: a short signature, or one checked only in part',
		guess: 'A guess: text has no signature'
	};
	const certaintyLabel = (d: Detection) =>
		d.textHint && d.certainty === 'likely'
			? 'Likely: a telling start, though text has no real signature'
			: certaintyText[d.certainty];

	/** A ZIP's central directory is read in full up to this size; past it, the first entries have to do. */
	const MAX_DIRECTORY = 16 << 20;

	/** Counts reads, so a slow file that finishes after a newer pick cannot replace it. */
	let readId = 0;

	async function readFile(file: File) {
		const id = ++readId;
		reading = true;
		fileError = '';
		handoff = null;
		try {
			const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
			const tailStart = Math.max(head.length, file.size - TAIL_BYTES);
			const tail =
				tailStart < file.size ? new Uint8Array(await file.slice(tailStart).arrayBuffer()) : new Uint8Array(0);
			let read = file.size <= head.length ? new ByteView(head, file.size) : new ByteView(head, file.size, tail);
			// A big archive's directory starts further back than the tail: read from there to the end.
			const dirAt = zipDirectoryStart(read);
			if (dirAt !== null && file.size - dirAt <= MAX_DIRECTORY) {
				const from = Math.max(head.length, dirAt);
				const directory = new Uint8Array(await file.slice(from).arrayBuffer());
				if (id !== readId) return;
				read = new ByteView(head, file.size, directory);
			}
			if (id !== readId) return;
			fileView = read;
			fileName = file.name;
		} catch {
			if (id !== readId) return;
			fileView = null;
			fileError = 'The browser could not read that file. Try choosing it again.';
		}
		reading = false;
	}

	function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) readFile(file);
	}

	const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files');

	function onDragOver(event: DragEvent) {
		if (!carriesFiles(event)) return;
		event.preventDefault();
		dragging = true;
	}

	/** A file dropped anywhere on the page is checked, rather than opened by the browser in place of the page. */
	function onDrop(event: DragEvent) {
		if (!carriesFiles(event)) return;
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			mode = 'file';
			readFile(file);
		}
	}

	/** What the hex box was given from a file, so the page can say when those bytes alone read differently. */
	let handoff: { text: string; bytes: number; id: string; name: string } | null = null;

	/**
	 * Hands the start of a chosen file to the hex box, where it can be edited
	 * and shared: the whole file when it is small, otherwise enough to cover
	 * every highlighted field (tar's ustar is at 257, DICOM's DICM at 128), up
	 * to what a link can hold.
	 */
	function useBytes() {
		if (!fileView || !fileView.size) return;
		const fieldsEnd = Math.max(64, ...(primary?.fields ?? []).map((f) => f.start + f.length));
		const count = Math.min(fileView.head.length, MAX_HANDOFF, fileView.complete ? fileView.size : fieldsEnd);
		const text = formatHexLines(fileView.head.subarray(0, Math.ceil(count / 16) * 16));
		handoff = {
			text,
			bytes: Math.min(fileView.head.length, Math.ceil(count / 16) * 16),
			id: primary?.id ?? '',
			name: primary?.name ?? ''
		};
		hexText = text;
		name = fileName;
		mode = 'hex';
	}
	$: handoffChanged = !!handoff && mode === 'hex' && hexText === handoff.text && (primary?.id ?? '') !== handoff.id;

	/** Loads an example. Focus stays on the chip, so the next example is one Tab away. */
	function tryExample(ex: typeof EXAMPLES[number], scroll = false) {
		mode = 'hex';
		hexText = exampleText(ex.hex);
		name = ex.name;
		if (scroll) {
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			document.getElementById('checker')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		}
	}

	let copied = '';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = `Copied the ${what}`;
		} catch {
			copied = 'Copying was blocked; select the text and copy it instead';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = ''), 2500);
	}
	onDestroy(() => clearTimeout(copyTimer));

	const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`;
	const kb = (n: number) => `${(n / 1024).toLocaleString('en-GB', { maximumFractionDigits: 0 })} KB`;

	// --- Content generated from the engine -------------------------------------------

	const table = signatureTable();
	const categories = Object.keys(CATEGORY_NAMES) as Category[];
	let filter = '';
	$: needle = filter.trim().toLowerCase();
	$: shownRows = needle
		? table.filter(
				(r) =>
					`${r.name} ${r.exts.join(' ')} ${r.hex} ${r.ascii}`.toLowerCase().includes(needle) ||
					// "504B" finds 50 4B too.
					(/^[0-9a-f\s]+$/.test(needle) && r.hex.replace(/ /g, '').toLowerCase().includes(needle.replace(/\s/g, '')))
		  )
		: table;
	const offsetOf = (id: string) => table.find((r) => r.id === id)?.offset ?? 0;

	const bytesOf = (id: string) => parseHex(EXAMPLES.find((e) => e.id === id)?.hex ?? '');
	const javaBytes = bytesOf('class');
	const fatBytes = bytesOf('fat');
	const java = detect(fromBytes(javaBytes))[0];
	const fat = detect(fromBytes(fatBytes))[0];
	const machoLittle = byteOrders(0xfeedfacf).little;
	const famous = [
		{
			value: 0xcafebabe,
			where:
				'The first four bytes of every compiled Java class file, and of a Mach-O universal binary on macOS (one file holding the same program for several processors).'
		},
		{
			value: 0xfeedface,
			where: `The magic number of a 32-bit Mach-O file, the executable format of macOS and iOS, as used on PowerPC and older Intel Macs and on older iPhones. It is stored in the processor's byte order, so a 32-bit file from an Intel Mac starts ${
				byteOrders(0xfeedface).little
			}, and one from a PowerPC Mac FE ED FA CE.`
		},
		{
			value: 0xfeedfacf,
			where: `The 64-bit Mach-O magic number, FEEDFACE plus one, and the one on every current Mac program: Intel and Apple silicon Macs are little-endian, so a single-architecture file, or each slice of a universal one, starts ${machoLittle}.`
		},
		{
			value: 0xdeadbeef,
			where:
				'Not a file signature. It is a value written into memory on purpose, so that reading uninitialised or freed memory stands out in a debugger or a crash dump. It is a well known piece of hexspeak, words spelled with the letters A to F.'
		}
	].map((f) => ({ ...f, hex: f.value.toString(16).toUpperCase(), ...byteOrders(f.value) }));

	const htmlExample = EXAMPLES.find((e) => e.id === 'html-as-png') ?? EXAMPLES[0];
	let pngOffset = 0;
	const pngGroups = PNG_SIGNATURE.map((g) => {
		const from = pngOffset;
		pngOffset += g.bytes.length;
		return { ...g, from, to: pngOffset - 1 };
	});
	const pngExample = detect(fromBytes(parseHex(DEFAULT.hex)))[0];
	const pngAsJpg = checkExtension(DEFAULT.name, [pngExample], 1);

	const faqs = [
		{
			q: 'What is a file signature?',
			a: 'A fixed run of bytes, usually at the very start of a file, that marks its format. PNG files start 89 50 4E 47 0D 0A 1A 0A, PDFs start %PDF-, and ZIP archives start PK. They are also called magic numbers. Programs use them to tell a file’s real type, because the extension in its name is only a label that anyone can change.'
		},
		{
			q: 'Can I convert a file by renaming it?',
			a: `No. Renaming changes the label, not the bytes: a PNG renamed to .jpg is still a PNG, and this checker will say "${pngAsJpg.message}" Many programs open it anyway because they look at the signature, but upload forms that only accept certain extensions may reject or mishandle it. To change the format, open it in an editor or converter and save it as the new type.`
		},
		{
			q: 'Is my file uploaded anywhere?',
			a: `No. The file is read in your browser with the File API: the first ${kb(HEAD_BYTES)} and the last ${kb(
				TAIL_BYTES
			)}, which reaches every signature here, including ISO 9660 at byte 32,769, and a ZIP's end record. When a big ZIP's central directory starts further back, it is read from there to the end, up to ${
				MAX_DIRECTORY >> 20
			} MB. Nothing is sent to a server, and a chosen file never goes into the page's link.`
		},
		{
			q: 'Why does my DOCX show up as a ZIP file?',
			a: `Because it is one. DOCX, XLSX, PPTX, EPUB, OpenDocument, JAR and APK files are all ZIP archives with agreed contents, so they all start PK 03 04. The checker looks inside, at the entry names (a word/ folder for DOCX) or a stored mimetype entry (EPUB and OpenDocument), to say which. It knows ${ZIP_KINDS.length} of these.`
		},
		{
			q: 'Why can it not tell what my CSV or text file is?',
			a: 'Text has no signature. A CSV, a Markdown file, source code and plain notes are all just characters, so the best any tool can do is notice that the bytes are valid text and maybe spot a telling start, like <?xml, <!DOCTYPE html or #!. Those are shown as likely or a guess, never as certain.'
		},
		{
			q: 'Does a correct signature mean a file is safe?',
			a: 'No. A signature only says how the file starts. Anything can follow a valid header, and some files are deliberately valid in two formats at once (polyglots). Use it to find out what a file claims to be, not to decide whether to trust it.'
		}
	];

	const page = {
		title: 'File Signature Checker: Find a File’s Type by Magic Bytes',
		description:
			'Check what a file really is from its first bytes: the magic number highlighted in a hex dump, the detected format, and whether the extension tells the truth.',
		url: `${SITE}/file-signature-checker`,
		image: `${SITE}/og/file-signature-checker.png`,
		imageAlt: 'LogicGates.org: file signature checker with a highlighted hex dump'
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
					{ '@type': 'ListItem', position: 3, name: 'File signature checker' }
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

<svelte:window on:dragover={onDragOver} on:drop={onDrop} on:dragend={() => (dragging = false)} />

<ContentPage
	related={[
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/binary-translator', label: 'Binary translator' },
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/struct-padding-calculator', label: 'Struct padding calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>File signature checker</h1>
		<p class="lede">
			Find out what a file really is from its first bytes, whatever its name says. Choose a file or paste hex: the magic
			number is highlighted in a hex dump and checked against the extension.
		</p>

		<div
			class="card tool"
			id="checker"
			class:dragging
			on:dragleave={(e) => e.target === e.currentTarget && (dragging = false)}
		>
			<div class="direction" role="group" aria-label="Input">
				<button
					type="button"
					class:active={mode === 'hex'}
					aria-pressed={mode === 'hex'}
					on:click={() => (mode = 'hex')}>Paste hex bytes</button
				>
				<button
					type="button"
					class:active={mode === 'file'}
					aria-pressed={mode === 'file'}
					on:click={() => (mode = 'file')}>Check a file</button
				>
			</div>

			{#if mode === 'hex'}
				<label class="field" for="hex">Bytes, in hex</label>
				<textarea
					id="hex"
					class="hex-input"
					rows="5"
					placeholder="89 50 4E 47 0D 0A 1A 0A …"
					bind:value={hexText}
					spellcheck="false"
					autocomplete="off"
					autocapitalize="off"
					aria-invalid={pasteError ? 'true' : 'false'}
					aria-describedby="hex-help{pasteError ? ' hex-error' : ''}"
				/>
				{#if pasteError}
					<p class="error" id="hex-error">{pasteError}</p>
				{/if}
				{#if alertText}
					<p class="visually-hidden" role="alert">{alertText}</p>
				{/if}
				<p class="field-help" id="hex-help">
					The first bytes are enough for most formats. Spaces, commas, colons, new lines and 0x or \x prefixes are all
					fine.
				</p>
				<label class="field" for="name">File name, for the extension check (optional)</label>
				<input
					id="name"
					class="name-input"
					type="text"
					bind:value={name}
					spellcheck="false"
					autocomplete="off"
					autocapitalize="off"
				/>
			{:else}
				<div class="drop" class:dragging>
					<input id="file" class="file-input" type="file" on:change={onPick} aria-describedby="file-help" />
					<label class="file-btn" for="file">Choose a file</label>
					<span class="drop-hint">or drop one anywhere on the page</span>
					<p class="field-help" id="file-help">
						The file stays on your device. It is read in the browser with <span class="mono">Blob.slice</span>: the
						first {kb(HEAD_BYTES)} and the last {kb(TAIL_BYTES)}, and nothing is uploaded.
					</p>
				</div>
				{#if fileError}
					<p class="error" role="alert">{fileError}</p>
				{/if}
			{/if}

			<div class="chips">
				{#each EXAMPLES as ex}
					<button type="button" class="chip-btn" on:click={() => tryExample(ex)}>{ex.label}</button>
				{/each}
			</div>

			<div class="results" class:stale={!!pasteError} inert={pasteError ? true : undefined}>
				{#if mode === 'file' && !fileView}
					<p class="empty-state" role="status">
						{reading ? 'Reading the file…' : 'Choose a file to see its signature. Nothing is uploaded.'}
					</p>
				{:else if mode === 'hex' && view && view.size === 0}
					<p class="empty-state" role="status">Paste some bytes above, or pick one of the examples.</p>
				{:else if view && verdict}
					<div
						class="answer"
						class:warn={verdict.status === 'mismatch'}
						class:plain={!primary}
						role={pasteError ? undefined : 'status'}
					>
						<span class="answer-label">Detected</span>
						{#if primary}
							<span class="answer-value">{primary.name}</span>
							<span class="answer-also"
								><span class="mono">{primary.mime}</span>{#if primary.exts.length}{' · usually '}<span class="mono"
										>.{primary.exts.join(', .')}</span
									>{/if}</span
							>
							<span class="certainty certainty-{primary.certainty}">{certaintyLabel(primary)}</span>
						{:else if view.size === 0}
							<span class="answer-value none">Nothing to check</span>
						{:else}
							<span class="answer-value none">No known signature</span>
						{/if}
						<p class="verdict verdict-{verdict.status}">
							<strong>{statusWord[verdict.status]}:</strong>
							{verdict.message}
						</p>
						{#each partials as p}
							<p class="verdict">
								These {plural(p.have, 'byte')} are the start of the {p.name} signature, which is {p.need} bytes long:
								<span class="mono">{p.hex}</span>. Paste more of the file to be sure.
							</p>
						{/each}
						{#if mode === 'file' && fileView}
							<p class="read-note">
								{fileName}: {plural(fileView.size, 'byte')}.
								{fileView.complete
									? 'Read in full.'
									: `Read the first ${kb(fileView.head.length)} and the last ${kb(fileView.tail.length)}.`}
								{#if fileView.size}
									<button type="button" class="link-btn" on:click={useBytes}>Put the first bytes in the hex box</button>
									to edit or share them.
								{/if}
							</p>
						{/if}
						{#if handoffChanged && handoff}
							<p class="read-note">
								Only the first {plural(handoff.bytes, 'byte')} of the file were copied, and on their own they do not read
								as {handoff.name || 'what the file was'}: the rest of the file is what settled it.
							</p>
						{/if}
					</div>

					{#if primary}
						{#if primary.facts.length}
							<ul class="facts">
								{#each primary.facts as fact}
									<li>{fact}</li>
								{/each}
							</ul>
						{/if}
						<p class="explain"><strong>Why these bytes.</strong> {primary.explain}</p>
						{#if detections.length > 1}
							<p class="explain">
								Also matches: {detections
									.slice(1)
									.map((d) => d.name)
									.join(', ')}.
							</p>
						{/if}
					{/if}

					{#if rows.length}
						<div class="dump-head">
							<h2 class="working-title" id="dump-title">Hex dump{fields.length ? ', signature highlighted' : ''}</h2>
							<button type="button" class="copy" on:click={() => copy(dumpText(rows), 'hex dump')}>Copy dump</button>
						</div>
						<div class="table-wrap scroll-box dump-wrap" use:scrollRegion data-label="Hex dump">
							<table class="dump mono" aria-labelledby="dump-title">
								<thead>
									<tr>
										<th scope="col">Offset</th>
										{#each Array(width) as _, k}
											<th scope="col" class="hx">{hex2(k)}</th>
										{/each}
										<th scope="col" class="ascii">Text</th>
									</tr>
								</thead>
								<tbody>
									{#each rows as row}
										{#if row.kind === 'gap'}
											<tr class="gap">
												<td colspan={width + 2}
													>… {plural(row.to - row.from, 'byte')} not shown ({hexOffset(row.from)} to {hexOffset(
														row.to - 1
													)})</td
												>
											</tr>
										{:else}
											<tr>
												<th scope="row" class="off"
													>{row.offset.toString(16).toUpperCase().padStart(offsetDigits, '0')}</th
												>
												{#each row.cells as cell}
													<td
														class="hx"
														class:sig={cell.field >= 0}
														class:f0={cell.field % 4 === 0}
														class:f1={cell.field % 4 === 1}
														class:f2={cell.field % 4 === 2}
														class:f3={cell.field % 4 === 3}
														title={cell.field >= 0 ? fields[cell.field].label : undefined}
														>{#if cell.field >= 0 && fields[cell.field].start === cell.offset}<span
																class="n"
																aria-hidden="true">{cell.field + 1}</span
															>{/if}{cell.byte === null ? '' : hex2(cell.byte)}</td
													>
												{/each}
												<td class="ascii"
													>{#each row.cells as cell}<span class:sig={cell.field >= 0}>{asciiChar(cell.byte)}</span
														>{/each}</td
												>
											</tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
						<p class="legend" class:hidden={!fields.length}>
							Highlighted bytes are underlined, and a small number marks where each field starts; the table below
							explains them, with the signature itself in bold. The Text column shows printable ASCII and a dot for
							anything else.
						</p>
						{#if shownFields.length}
							<div class="table-wrap" use:scrollRegion data-label="Signature fields">
								<table class="data-table fields">
									<thead>
										<tr>
											<th scope="col">#</th>
											<th scope="col">Offset and bytes</th>
											<th scope="col">Meaning</th>
										</tr>
									</thead>
									<tbody>
										{#each fields as f, i}
											{#if view.has(f.start, 1)}
												<tr class:sig-row={f.sig}>
													<td><span class="tag f{i % 4}">{i + 1}</span></td>
													<td class="mono bytes"
														><span class="at">{hexOffset(f.start)}</span>{formatBytes(
															view.bytes(f.start, Math.min(f.length, 12)) ?? []
														)}{f.length > 12 ? ` … (${f.length})` : ''}</td
													>
													<td
														>{f.label}{#if f.value && !f.label.includes(f.value)}: <strong class="mono"
																>{f.value}</strong
															>{/if}</td
													>
												</tr>
											{/if}
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{/if}
				{/if}
			</div>
			<p class="copied" aria-live="polite">{copied}</p>
			{#if mode === 'hex'}
				<p class="share-row">
					{#if tooLongForLink}
						<span class="share-note"
							>These bytes are too many for a link (over {MAX_LINK_HEX.toLocaleString('en-GB')} characters of hex), so the
							address bar does not hold them. Paste fewer, or share the file itself.</span
						>
					{:else}
						<ShareLink what="these bytes and the file name" />
					{/if}
				</p>
			{/if}
		</div>
	</section>

	<section id="how">
		<h2>How file signatures work</h2>
		<p class="section-intro">
			Most file formats begin with a fixed run of bytes, chosen by whoever designed the format, so that a program can
			tell what it has been given before reading any further. Those bytes are the file signature, or magic number. The
			name of a file, and its extension, is just a label: it is not stored in the file, and renaming a file changes
			nothing inside it.
		</p>
		<ul class="points">
			<li>
				<strong>Usually at offset 0.</strong> PNG, JPEG, GIF, PDF, ZIP, ELF and most others start at the very first byte.
			</li>
			<li>
				<strong>Sometimes further in.</strong> A tar archive's <span class="mono">ustar</span> sits at byte
				{offsetOf('tar')}, DICOM's <span class="mono">DICM</span> at byte {offsetOf('dicom')}, after a free preamble,
				and an ISO 9660 disc image's <span class="mono">CD001</span> at byte {offsetOf('iso').toLocaleString('en-GB')}
				({hexOffset(offsetOf('iso'))}), after 32 KB the format leaves for boot code.
			</li>
			<li>
				<strong>Containers need a second look.</strong> A signature can say "ZIP" or "RIFF" or "ISO media" when what you
				want to know is DOCX, WebP or HEIC. The answer is a little further in: the entry names, the form type, the brand.
			</li>
			<li>
				<strong>Byte order shows.</strong> A magic number stored as a 32-bit integer appears reversed on little-endian
				machines, which is why a 64-bit Mach-O program on an Intel or Apple silicon Mac starts {machoLittle} rather than
				FE ED FA CF.
			</li>
			<li>
				<strong>Text has none.</strong> CSV, JSON, Markdown and source code are just characters. A byte order mark or a
				telling start such as <span class="mono">&lt;?xml</span> or <span class="mono">#!</span> is as close as text gets.
			</li>
		</ul>
		<p class="reducer">
			The Unix <span class="mono">file</span> command works this way, from a database of these patterns; this page's
			tests check its answers against it. To read the bytes yourself, the <a href="/ascii-table">ASCII table</a> gives
			the letters behind the hex and <a href="/hex-to-binary">hex to binary</a> shows the bits.
		</p>
	</section>

	<section id="png">
		<h2>Why PNG starts with 89 50 4E 47 0D 0A 1A 0A</h2>
		<p class="section-intro">
			PNG's eight bytes were chosen with care. Apart from the three letters of the name, each one catches a way that
			files used to get damaged when they were copied between systems, so a broken PNG is spotted in its first eight
			bytes instead of half way through decoding.
		</p>
		<div class="table-wrap" use:scrollRegion data-label="PNG signature bytes">
			<table class="data-table png">
				<thead>
					<tr>
						<th scope="col">Bytes</th>
						<th scope="col">Hex and text</th>
						<th scope="col">Why it is there</th>
					</tr>
				</thead>
				<tbody>
					{#each pngGroups as g}
						<tr>
							<td class="mono nowrap">{g.from === g.to ? g.from : `${g.from} to ${g.to}`}</td>
							<td class="nowrap"
								><span class="mono strong">{formatBytes(g.bytes)}</span><span class="mono as-text">{g.text}</span></td
							>
							<td>{g.why}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="containers">
		<h2>One signature, many formats</h2>
		<p class="section-intro">
			Several popular formats are containers with agreed contents, so their first bytes say only what the container is.
			ZIP archives start <span class="mono">50 4B 03 04</span> (PK, after Phil Katz of PKZIP), and these formats are all
			ZIP archives underneath:
		</p>
		<div class="table-wrap" use:scrollRegion data-label="Formats inside a ZIP">
			<table class="data-table zip-kinds">
				<thead>
					<tr>
						<th scope="col">Format</th>
						<th scope="col">How the checker tells it apart</th>
					</tr>
				</thead>
				<tbody>
					{#each ZIP_KINDS as k}
						<tr>
							<td class="kind">{k.name}<span class="mono exts">.{k.exts.join(', .')}</span></td>
							<td class="rule">{k.rule}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="section-intro gap-top">
			The ISO base media format behind MP4 is a tree of boxes, and the first is <span class="mono">ftyp</span> at byte 4.
			Its brand, a four-character code at byte 8, names the format:
		</p>
		<div class="table-wrap" use:scrollRegion data-label="ftyp brands">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Brands</th>
						<th scope="col">Format</th>
						<th scope="col">Extensions</th>
					</tr>
				</thead>
				<tbody>
					{#each FTYP_KINDS as k}
						<tr>
							<td class="mono">{k.brands.map((b) => b.trim()).join(', ')}</td>
							<td>{k.name}</td>
							<td class="mono">.{k.exts.join(', .')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			RIFF works the same way for WebP, WAV and AVI: <span class="mono">RIFF</span>, a 4-byte size, then the form type
			<span class="mono">WEBP</span>, <span class="mono">WAVE</span> or <span class="mono">AVI</span> followed by a space,
			since a form type is always four characters.
		</p>
	</section>

	<section id="cafebabe">
		<h2>CAFEBABE: Java class or Mach-O?</h2>
		<p class="section-intro">
			Two unrelated formats start with the same four bytes, <span class="mono">CA FE BA BE</span>. The next four bytes
			settle it. Here are the first eight bytes of a real class file, compiled by javac, and of a real macOS universal
			binary, made by lipo:
		</p>
		<div class="worked-grid">
			<div class="card worked">
				<h3>{java.name}</h3>
				<p class="mono bytes-line">
					<span class="strong">{formatBytes(javaBytes.subarray(0, 4))}</span>
					{formatBytes(javaBytes.subarray(4, 8))}
				</p>
				<p class="small">
					After the magic come two 16-bit numbers, the minor and major version: {formatBytes(javaBytes.subarray(4, 6))} is
					{(javaBytes[4] << 8) | javaBytes[5]} and {formatBytes(javaBytes.subarray(6, 8))} is {(javaBytes[6] << 8) |
						javaBytes[7]}. {java.facts[0]}.
				</p>
			</div>
			<div class="card worked">
				<h3>{fat.name}</h3>
				<p class="mono bytes-line">
					<span class="strong">{formatBytes(fatBytes.subarray(0, 4))}</span>
					{formatBytes(fatBytes.subarray(4, 8))}
				</p>
				<p class="small">
					After the magic comes one 32-bit number, the count of architectures inside: {fat.facts[0]}. No Java release
					has a major version that small; the first, Java 1.0, used 45.
				</p>
			</div>
		</div>
	</section>

	<section id="famous">
		<h2>Famous magic numbers</h2>
		<p class="section-intro">
			Some magic numbers are chosen to be readable as words in hex, which makes them easy to spot in a dump. The same
			number looks different in memory depending on byte order:
		</p>
		<div class="famous-grid">
			{#each famous as f}
				<div class="card famous">
					<h3 class="mono strong">{f.hex}</h3>
					<dl class="orders">
						<dt>Big-endian bytes</dt>
						<dd class="mono">{f.big}</dd>
						<dt>Little-endian bytes</dt>
						<dd class="mono">{f.little}</dd>
					</dl>
					<p class="small">{f.where}</p>
				</div>
			{/each}
		</div>
	</section>

	<section id="reference">
		<h2>File signature table</h2>
		<p class="section-intro">
			Every signature the checker knows, {table.length} of them, generated from the same data the checker uses. With the
			ZIP and ISO media kinds above and the text formats, it names {FORMAT_COUNT} formats in all.
			<span class="mono">??</span> is a byte that can be anything.
		</p>
		<label class="field" for="filter">Filter by name, extension or bytes</label>
		<input
			id="filter"
			class="filter-input"
			type="text"
			bind:value={filter}
			placeholder="png, 50 4B, ELF…"
			autocomplete="off"
		/>
		<p class="filter-count" aria-live="polite">{needle ? `${shownRows.length} of ${table.length} signatures` : ''}</p>
		<div class="table-wrap scroll-box tall" use:scrollRegion data-label="File signature table">
			<table class="data-table sigs">
				<thead>
					<tr>
						<th scope="col">Format</th>
						<th scope="col">Bytes</th>
						<th scope="col">Offset</th>
						<th scope="col">Extensions</th>
						<th scope="col">As text</th>
					</tr>
				</thead>
				<tbody>
					{#each categories as cat}
						{@const inCat = shownRows.filter((r) => r.category === cat)}
						{#if inCat.length}
							<tr class="cat"><th scope="rowgroup" colspan="5">{CATEGORY_NAMES[cat]}</th></tr>
							{#each inCat as r}
								<tr>
									<td
										>{r.name}{#if r.note}<span class="note">{r.note}</span>{/if}</td
									>
									<td class="mono strong sig-bytes">{r.hex}</td>
									<td class="mono">{r.offset < 1024 ? r.offset : hexOffset(r.offset)}</td>
									<td class="mono">{r.exts.length ? '.' + r.exts.slice(0, 4).join(', .') : 'none'}</td>
									<td class="mono">{r.ascii}</td>
								</tr>
							{/each}
						{/if}
					{/each}
					{#if !shownRows.length}
						<tr><td colspan="5">No signature matches “{filter}”.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Renaming to convert.</strong> Changing .png to .jpg makes a PNG with the wrong name, not a JPEG. Most image
				viewers still open it, which hides the problem until something stricter does not.
			</li>
			<li>
				<strong>An error page saved as the file.</strong> A download link that fails often hands back an HTML error page
				under the name you asked for, so "logo.png" turns out to be <span class="mono">&lt;!DOCTYPE html&gt;</span>. Try
				the
				<button type="button" class="link-btn" on:click={() => tryExample(htmlExample, true)}>HTML named .png</button> example.
			</li>
			<li>
				<strong>Reading a little-endian magic number backwards.</strong> Zstandard's magic number is FD2FB528 but its
				files start <span class="mono">28 B5 2F FD</span>, because it is stored low byte first.
			</li>
			<li>
				<strong>Treating "ZIP" as the whole answer.</strong> An Office document, an e-book and an Android app are all ZIP
				archives; the contents say which.
			</li>
			<li>
				<strong>Trusting a signature for safety.</strong> A valid header says how a file starts, not what the rest does.
				Files can be valid in two formats at once.
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

	.direction {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.9rem;
	}

	.direction button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}

	.direction button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.hex-input,
	.name-input,
	.filter-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 0.95rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.7rem;
	}

	.hex-input {
		resize: vertical;
		line-height: 1.45;
		/* Soft wrapping breaks between bytes, so a narrow box never cuts one in half. */
		white-space: pre-wrap;
	}

	.name-input {
		max-width: 360px;
		margin-bottom: 0.9rem;
	}

	.filter-input {
		max-width: 360px;
	}

	.hex-input:focus,
	.name-input:focus,
	.filter-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.hex-input[aria-invalid='true'] {
		border-color: #f66;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.7rem;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
		/* The message quotes the paste, which can be one long run with no spaces. */
		overflow-wrap: anywhere;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.drop {
		position: relative;
		border: 1px dashed rgba(255, 255, 255, 0.45);
		border-radius: 3px;
		padding: 1rem;
		margin-bottom: 0.9rem;
		text-align: center;
	}

	.drop.dragging {
		border-color: #5db65d;
		border-style: solid;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}

	.file-btn {
		display: inline-block;
		background-color: #372;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		cursor: pointer;
		font-weight: 600;
		padding: 0.5rem 1.1rem;
	}

	.file-input:focus-visible + .file-btn {
		outline: 2px solid #8ede8e;
		outline-offset: 2px;
	}

	.drop-hint {
		color: #bbb;
		font-size: 0.9rem;
		margin-left: 0.5rem;
	}

	.drop .field-help {
		margin-bottom: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 1rem;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.results {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 1rem;
		min-height: 8rem;
	}

	.results.stale {
		opacity: 0.35;
		pointer-events: none;
	}

	.empty-state {
		color: #bbb;
		margin: 0.5rem 0;
	}

	.answer {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
	}

	.answer.plain {
		border-color: rgba(255, 255, 255, 0.35);
	}

	.answer-value.none {
		color: #ddd;
	}

	.legend.hidden {
		display: none;
	}

	.answer.warn {
		border-color: #e0a040;
	}

	.answer-label {
		color: #999;
		display: block;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.5rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
		overflow-wrap: anywhere;
	}

	.certainty {
		display: inline-block;
		font-size: 0.75rem;
		margin-top: 0.4rem;
		padding: 0.1rem 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #ddd;
	}

	.certainty-guess,
	.certainty-likely {
		border-style: dashed;
	}

	.verdict {
		color: #ddd;
		font-size: 0.95rem;
		margin: 0.6rem 0 0;
		overflow-wrap: anywhere;
	}

	.verdict-mismatch strong {
		color: #f0b860;
	}

	.verdict-match strong,
	.verdict-compatible strong {
		color: #8ede8e;
	}

	.read-note {
		color: #bbb;
		font-size: 0.82rem;
		margin: 0.6rem 0 0;
		overflow-wrap: anywhere;
	}

	.link-btn {
		background: none;
		border: none;
		color: #8ede8e;
		cursor: pointer;
		font: inherit;
		padding: 0;
		text-decoration: underline;
	}

	.facts {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.8rem 0 0;
		padding-left: 1.2rem;
	}

	.explain {
		color: #ccc;
		font-size: 0.9rem;
		margin: 0.7rem 0 0;
		max-width: 720px;
	}

	.explain strong {
		color: #fff;
	}

	.dump-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.1rem;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin: 0 !important;
	}

	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.copied {
		color: #8ede8e;
		font-size: 0.8rem;
		min-height: 1.2em;
		margin: 0.4rem 0 0;
	}

	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}

	.scroll-box.tall {
		max-height: 640px;
	}

	.dump-wrap {
		margin-top: 0.5rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
	}

	.dump {
		border-collapse: collapse;
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.dump th,
	.dump td {
		padding: 0.12rem 0.22rem;
		white-space: nowrap;
		text-align: center;
	}

	.dump thead th {
		color: #999;
		font-weight: normal;
		font-size: 0.72rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
	}

	.dump .off {
		color: #999;
		font-weight: normal;
		text-align: left;
		padding-right: 0.6rem;
	}

	.dump td.hx {
		color: #ccc;
		position: relative;
		min-width: 1.4em;
	}

	.dump td.hx:nth-child(10) {
		padding-left: 0.6rem;
	}

	.dump .ascii {
		text-align: left;
		padding-left: 0.8rem;
		color: #bbb;
		white-space: pre;
	}

	.dump td.sig {
		color: #fff;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.dump .ascii .sig {
		color: #fff;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.dump td.sig.f0,
	.tag.f0 {
		background: rgba(93, 182, 93, 0.3);
	}

	.dump td.sig.f1,
	.tag.f1 {
		background: rgba(80, 140, 230, 0.35);
	}

	.dump td.sig.f2,
	.tag.f2 {
		background: rgba(220, 150, 50, 0.35);
	}

	.dump td.sig.f3,
	.tag.f3 {
		background: rgba(190, 90, 200, 0.35);
	}

	/* The field number sits in the cell's own top padding, clear of the row above. */
	.dump td.hx {
		padding-top: 0.6rem;
	}

	.dump .n {
		position: absolute;
		top: 0.05rem;
		left: 0.1rem;
		font-size: 0.65rem;
		font-weight: 400;
		color: #fff;
		line-height: 1;
	}

	.dump tr.gap td {
		color: #999;
		font-size: 0.75rem;
		text-align: left;
		padding: 0.25rem 0.3rem;
	}

	.legend {
		color: #999;
		font-size: 0.78rem;
		margin: 0.45rem 0 0.8rem;
	}

	.fields td {
		font-size: 0.88rem;
		vertical-align: top;
	}

	.fields .bytes {
		min-width: 9em;
		max-width: 18em;
	}

	.fields .at {
		display: block;
		color: #999;
		font-size: 0.78rem;
	}

	.fields strong {
		color: #fff;
	}

	.tag {
		display: inline-block;
		min-width: 1.4em;
		text-align: center;
		color: #fff;
		border-radius: 2px;
		font-size: 0.8rem;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 0.6rem 0 0;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.6rem;
	}

	.points strong {
		color: #fff;
	}

	.strong,
	.data-table td.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.png td {
		vertical-align: top;
	}

	.rule {
		overflow-wrap: anywhere;
	}

	.nowrap {
		white-space: nowrap;
	}

	.as-text,
	.exts {
		display: block;
		color: #bbb;
		font-size: 0.8rem;
	}

	.kind {
		min-width: 8em;
	}

	/* On a phone the long heading wraps, so the rules column fits beside the names. */
	.zip-kinds thead th {
		white-space: normal;
	}

	.famous-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.famous {
		padding: 0.9rem 1rem;
	}

	.famous h3 {
		font-size: 1.15rem;
	}

	.orders {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.15rem 0.8rem;
		margin: 0.5rem 0;
		font-size: 0.85rem;
	}

	.orders dt {
		color: #bbb;
	}

	.orders dd {
		margin: 0;
		white-space: nowrap;
	}

	.gap-top {
		margin-top: 1.4rem;
	}

	.worked-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
		margin-bottom: 1.2rem;
	}

	.worked {
		padding: 0.9rem 1rem;
	}

	.worked h3 {
		color: #fff;
	}

	.bytes-line {
		font-size: 1.05rem;
		margin: 0.4rem 0;
	}

	.small {
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.filter-count {
		color: #bbb;
		font-size: 0.8rem;
		min-height: 1.2em;
		margin: 0.3rem 0;
	}

	.sigs td {
		vertical-align: top;
		font-size: 0.88rem;
	}

	.sigs .sig-bytes {
		white-space: nowrap;
	}

	/* On a phone, long patterns wrap between bytes (four to a line) rather than
	   pushing the extensions and text columns out of the box. */
	@media (max-width: 600px) {
		.sigs .sig-bytes {
			white-space: normal;
			min-width: 11ch;
			max-width: 12ch;
		}
	}

	.sigs .note {
		display: block;
		color: #999;
		font-size: 0.78rem;
		max-width: 320px;
	}

	.sigs tr.cat th {
		color: #fff;
		background: #101012;
		font-weight: 600;
		font-size: 0.85rem;
	}

	/* The column headings stay in view while the table scrolls inside its box. */
	.sigs thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: #0d0d0f;
	}

	.fields tr.sig-row td {
		font-weight: 700;
	}

	.share-note {
		color: #bbb;
		font-size: 0.8rem;
	}

	.card.tool.dragging {
		border-color: #5db65d;
	}

	@media (max-width: 600px) {
		.dump {
			font-size: 0.78rem;
		}

		.dump th,
		.dump td {
			padding-left: 0.14rem;
			padding-right: 0.14rem;
		}

		.dump .off {
			padding-right: 0.3rem;
		}

		.dump .ascii {
			padding-left: 0.4rem;
		}

		.dump td.hx:nth-child(10) {
			padding-left: 0.22rem;
		}

		.drop-hint {
			display: block;
			margin: 0.4rem 0 0;
		}

		.famous-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
