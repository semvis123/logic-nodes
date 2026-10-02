<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import IdBits from '$lib/IdBits.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		detectId,
		decodeUuid,
		decodeUlid,
		decodeObjectId,
		uuidToUlid,
		ulidToUuid,
		variantOfDigit,
		describeAge,
		parseMoment,
		birthdayHalf,
		hexOf,
		IdGenerator,
		IdError,
		GEN_FORMATS,
		ID_FORMATS,
		VARIANT_NAMES,
		GREGORIAN_OFFSET,
		CROCKFORD,
		NIL_UUID,
		MAX_UUID,
		type DecodedId,
		type GenKind
	} from '$lib/ids';
	import { readUrl, syncUrl, safeText, safeOption, safeInt, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const RFC_V7 = '017F22E2-79B0-7CC3-98C4-DC0C0C07398F';
	const RFC_V1 = 'C232AB00-9414-11EC-B3C8-9F6BCCED46E3';
	const RFC_V6 = '1EC9414C-232A-6B00-B3C8-9F6BCCED46E3';
	const RFC_V5 = '2ed6657d-e927-568b-95e1-2665a8aea6a2';
	const genKinds = Object.keys(GEN_FORMATS) as GenKind[];
	const TIMED: GenKind[] = ['v7', 'v1', 'ulid', 'objectid', 'snowflake'];

	const DEFAULTS = { id: RFC_V7, g: 'v4', n: 5, case: 'lower', dash: 'on', at: '' };
	let input = DEFAULTS.id;
	let gKind: GenKind = 'v4';
	let gCount = DEFAULTS.n;
	let gCase: 'lower' | 'upper' = 'lower';
	let gDash: 'on' | 'off' = 'on';
	let gAt = '';

	/** Set on mount, so the local time and the age are the reader's, never the build server's. */
	let now: number | null = null;
	let generator: IdGenerator | null = null;

	onMount(() => {
		const p = readUrl();
		input = safeText(p.id, 120) ?? input;
		gKind = safeOption(p.g, genKinds) ?? gKind;
		gCount = safeInt(p.n, 1, 100) ?? gCount;
		gCase = safeOption(p.case, ['lower', 'upper'] as const) ?? gCase;
		gDash = safeOption(p.dash, ['on', 'off'] as const) ?? gDash;
		gAt = safeText(p.at, 40) ?? gAt;
		now = Date.now();
		generator = new IdGenerator((n) => crypto.getRandomValues(new Uint8Array(n)));
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(tick);
	});
	$: syncUrl({ id: input, g: gKind, n: gCount, case: gCase, dash: gDash, at: gAt }, DEFAULTS);

	// Runs during prerendering too, so the served page shows a decoded UUID.
	let decoded: DecodedId | null = null;
	let error = '';
	$: {
		try {
			decoded = detectId(input);
			error = '';
		} catch (e) {
			error = e instanceof IdError ? e.message : 'That could not be read as an ID';
		}
	}

	$: localTime =
		decoded?.time && now !== null
			? new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(decoded.time.unixMs)
			: '';
	$: age = decoded?.time && now !== null ? describeAge(decoded.time.unixMs, now) : '';
	$: isUuid = decoded?.kind === 'uuid' && decoded.version !== undefined;

	function tryId(value: string) {
		input = value;
		const field = document.getElementById('id-input');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; value: string }[] = [
		{ label: 'v7 (RFC example)', value: RFC_V7 },
		{ label: 'v1 (RFC example)', value: RFC_V1 },
		{ label: 'v6', value: RFC_V6 },
		{ label: 'v4', value: '9b2f8d5e-3c4a-4f61-8e2b-7a9c0d1e2f30' },
		{ label: 'v5', value: RFC_V5 },
		{ label: 'Nil', value: NIL_UUID },
		{ label: 'Max', value: MAX_UUID },
		{ label: 'ULID', value: '01ARYZ6S41TSV4RRFFQ69G5FAV' },
		{ label: 'ObjectId', value: '507f1f77bcf86cd799439011' },
		{ label: 'Discord snowflake', value: '175928847299117063' },
		{ label: 'NanoID', value: 'V1StGXR8_Z5jdHi6B-myT' }
	];

	// ------------------------------------------------------------ generator

	let generated: string[] = [];
	let genError = '';
	$: genFormat = GEN_FORMATS[gKind];
	$: timed = TIMED.includes(gKind);

	function generate() {
		if (!generator) return;
		if (!Number.isInteger(gCount) || gCount < 1 || gCount > 100) {
			generated = [];
			return;
		}
		let at = Date.now();
		if (timed && gAt.trim()) {
			try {
				at = parseMoment(gAt);
			} catch (e) {
				genError = e instanceof IdError ? e.message : 'That time could not be read';
				generated = [];
				return;
			}
		}
		try {
			const opts = { upper: gCase === 'upper', dashes: gDash === 'on' };
			generated = Array.from({ length: gCount }, () => (generator as IdGenerator).make(gKind, at, opts));
			genError = '';
		} catch (e) {
			genError = e instanceof IdError ? e.message : 'Those IDs could not be made';
			generated = [];
		}
	}
	// Regenerates whenever an option changes, but only in the browser: an ID
	// baked into the prerendered page would be the same for every visitor.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const regenerate = (..._options: unknown[]) => generate();
	$: if (generator) regenerate(gKind, gCount, gCase, gDash, gAt);

	let copyState: 'idle' | 'copied' | 'failed' = 'idle';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyAll() {
		try {
			await navigator.clipboard.writeText(generated.join('\n'));
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyState = 'idle'), 2500);
	}

	// ------------------------------------------------------------ worked examples, from the engine

	const v7 = decodeUuid(RFC_V7);
	const v1 = decodeUuid(RFC_V1);
	const v1Ticks = v1.time?.raw ?? 0n;
	const v1Unix = v1Ticks - GREGORIAN_OFFSET;
	const ulidExample = decodeUlid('01ARYZ6S41TSV4RRFFQ69G5FAV');
	const oid = decodeObjectId('507f1f77bcf86cd799439011');
	const variantRows = Array.from({ length: 16 }, (_, d) => {
		const { variant, bits } = variantOfDigit(d);
		const pattern = d.toString(2).padStart(4, '0');
		return { digit: d.toString(16), variant, fixed: pattern.slice(0, bits), rest: pattern.slice(bits) };
	});
	const half = birthdayHalf(122);
	const sci = (n: number) => {
		const exp = Math.floor(Math.log10(n));
		return `${(n / 10 ** exp).toFixed(1)} × 10^${exp}`;
	};

	const versions = [
		{ v: '1', inside: '60-bit time (100 ns), clock sequence, node (MAC address)', time: 'Yes', sort: 'No' },
		{ v: '2', inside: 'DCE security: version 1 with a local user or group ID', time: 'Partly', sort: 'No' },
		{ v: '3', inside: 'MD5 hash of a namespace and a name', time: 'No', sort: 'No' },
		{ v: '4', inside: '122 random bits', time: 'No', sort: 'No' },
		{ v: '5', inside: 'SHA-1 hash of a namespace and a name', time: 'No', sort: 'No' },
		{ v: '6', inside: 'Version 1 reordered, time first', time: 'Yes', sort: 'Yes' },
		{ v: '7', inside: '48-bit Unix time (ms), then 74 random bits', time: 'Yes', sort: 'Yes' },
		{ v: '8', inside: 'Vendor-defined, only version and variant fixed', time: 'Maybe', sort: 'Maybe' }
	];

	const faqs = [
		{
			q: 'Can you get the creation time from a UUID?',
			a: `Only from versions 1, 6 and 7, which carry a timestamp. Version 7 starts with the Unix time in milliseconds: ${RFC_V7} begins ${hexOf(
				v7.fields[0].value,
				12
			)}, which is ${v7.fields[0].value} ms, ${
				v7.time?.iso
			}. Versions 1 and 6 count 100 ns steps from 1582-10-15. Version 4 is random and versions 3 and 5 are hashes, so they hold no time at all.`
		},
		{
			q: 'How do I tell which version a UUID is?',
			a: 'Look at the 13th hex digit, the first one of the third group: in 017f22e2-79b0-7cc3-98c4-dc0c0c07398f it is 7, so it is version 7. The 17th digit, the first of the fourth group, gives the variant; for standard UUIDs it is 8, 9, a or b.'
		},
		{
			q: 'Can a version 3 or 5 UUID be decoded back to the name?',
			a: 'No. They are the first 128 bits of an MD5 or SHA-1 hash with 6 bits overwritten, and a hash cannot be run backwards. The only way to find the name is to guess it, hash the guess with the same namespace, and compare.'
		},
		{
			q: 'Will two random UUIDs ever be the same?',
			a: `In practice no. A version 4 UUID has 122 random bits, so you would need to generate about ${sci(
				half
			)} of them before the chance of any repeat reached one half. That assumes a good random source; the generator on this page uses crypto.getRandomValues.`
		},
		{
			q: 'Which UUID version should I use?',
			a: 'Version 7 for database keys and anything you want sorted by creation time, because new IDs land at the end of an index. Version 4 when the ID should reveal nothing, not even when it was made. Version 5 when the same input must always give the same ID. RFC 9562 recommends 7 over 1 and 6.'
		},
		{
			q: 'What is the difference between a UUID and a GUID?',
			a: "GUID is Microsoft's name for the same 128-bit identifier, written the same way. The one practical difference is byte order: Windows stores the first three groups little-endian in memory, so the raw bytes of a GUID and the text do not match in the order you would expect."
		},
		{
			q: 'Are the IDs generated here sent anywhere?',
			a: 'No. They are made in your browser with crypto.getRandomValues when the page loads or an option changes, and are never sent to a server or stored. Decoding is also done entirely in the page.'
		}
	];

	const page = {
		title: 'UUID Decoder and Generator: Version, Time, ULID, ObjectId',
		description:
			'Decode a UUID to its version, variant and timestamp, bit by bit, and read ULIDs and MongoDB ObjectIds too. Generate UUID v4, v7, ULIDs and NanoIDs.',
		url: `${SITE}/uuid-decoder`,
		image: `${SITE}/og/uuid-decoder.png`,
		imageAlt: 'LogicGates.org: UUID decoder showing the version, variant and timestamp bits'
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
					{ '@type': 'ListItem', position: 3, name: 'UUID decoder and generator' }
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
		{ href: '/snowflake-id-decoder', label: 'Snowflake ID decoder' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/base32', label: 'Base32 encoder' },
		{ href: '/binary-translator', label: 'Binary translator' },
		{ href: '/integer-limits', label: 'Integer limits' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>UUID decoder and generator</h1>
		<p class="lede">
			Paste a UUID to see its version, variant and, if it has one, the moment it was made, with every bit labelled. It
			also reads ULIDs, MongoDB ObjectIds and snowflakes, and generates new IDs in your browser.
		</p>

		<div class="card tool">
			<label class="field" for="id-input">UUID or other ID</label>
			<input
				id="id-input"
				class="value-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="id-help"
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<p class="field-help" id="id-help">
				Any case, with or without dashes, braces or urn:uuid:. The kind of ID is worked out from its length and
				characters.
			</p>
			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryId(example.value)}>{example.label}</button>
				{/each}
			</div>

			{#if decoded}
				<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
					<div class="answer" role={error ? undefined : 'status'}>
						<span class="answer-label">Detected</span>
						<span class="answer-value">{decoded.title}</span>
						<span class="canonical mono">
							{#if isUuid}
								{decoded.canonical.slice(0, 14)}<mark class="ver" title="version digit">{decoded.canonical[14]}</mark
								>{decoded.canonical.slice(15, 19)}<mark class="var" title="variant digit">{decoded.canonical[19]}</mark
								>{decoded.canonical.slice(20)}
							{:else}
								{decoded.canonical}
							{/if}
						</span>
						{#if isUuid && decoded.variant}
							<span class="answer-also">
								Version digit <strong class="mono">{decoded.canonical[14]}</strong>, variant digit
								<strong class="mono">{decoded.canonical[19]}</strong>
								(binary {parseInt(decoded.canonical[19], 16).toString(2).padStart(4, '0')}): {VARIANT_NAMES[
									decoded.variant
								]}.
							</span>
						{/if}
						{#if decoded.time}
							<dl class="times">
								<dt>UTC</dt>
								<dd class="mono">{decoded.time.iso}</dd>
								<dt>Your time</dt>
								<dd>{localTime || '…'}</dd>
								<dt>Age</dt>
								<dd>{age || '…'}</dd>
							</dl>
						{/if}
					</div>

					<p class="summary">{decoded.summary}</p>

					{#if decoded.fields.length}
						<h2 class="working-title">The bits</h2>
						<IdBits
							fields={decoded.fields}
							bits={decoded.bits}
							label="Bit layout of {decoded.title}"
							numbering={decoded.kind === 'snowflake' ? 'bottom' : 'top'}
						/>
					{/if}

					{#if decoded.time}
						<p class="note">
							The timestamp counts {decoded.time.precision} steps from {decoded.time.epoch}. Raw count:
							<span class="mono">{decoded.time.raw}</span>.
						</p>
					{/if}
					{#each decoded.notes as note}
						<p class="note">{note}</p>
					{/each}
					{#if decoded.kind === 'ulid'}
						<p class="note">
							The same 128 bits written as a UUID: <span class="mono">{ulidToUuid(decoded.canonical)}</span>. A ULID is
							its bits in <a href="/base32">Crockford Base32</a>, 5 bits per character.
						</p>
					{:else if decoded.kind === 'uuid' && decoded.version === 7}
						<p class="note">
							The same 128 bits written as a ULID: <span class="mono">{uuidToUlid(decoded.canonical)}</span>. Both start
							with a 48-bit millisecond time, so the ULID reads back the same moment.
						</p>
					{:else if decoded.kind === 'snowflake'}
						<p class="note">
							Read as a Discord snowflake. For Twitter/X, or to find the snowflakes for a date, open it in the
							<a href={toolLink('/snowflake-id-decoder', { id: decoded.canonical })}>snowflake ID decoder</a>.
						</p>
					{/if}
				</div>
			{/if}
			<p class="share-row"><ShareLink what="this ID and the generator settings" /></p>
		</div>
	</section>

	<section id="generator">
		<h2>UUID generator</h2>
		<div class="card tool">
			<div class="gen-options">
				<div>
					<label class="field" for="gen-kind">Kind</label>
					<select id="gen-kind" bind:value={gKind}>
						{#each genKinds as k}
							<option value={k}>{GEN_FORMATS[k].label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="field" for="gen-count">How many</label>
					<input id="gen-count" class="count" type="number" min="1" max="100" bind:value={gCount} />
				</div>
				<div>
					<label class="field" for="gen-case">Letters</label>
					<select id="gen-case" bind:value={gCase} disabled={!genFormat.caseOption}>
						<option value="lower">lower case</option>
						<option value="upper">UPPER CASE</option>
					</select>
				</div>
				<div>
					<label class="field" for="gen-dash">Dashes</label>
					<select id="gen-dash" bind:value={gDash} disabled={!genFormat.dashes}>
						<option value="on">With dashes</option>
						<option value="off">No dashes</option>
					</select>
				</div>
				{#if timed}
					<div class="at">
						<label class="field" for="gen-at">Time, UTC</label>
						<input
							id="gen-at"
							class="small-input"
							type="text"
							bind:value={gAt}
							placeholder="now"
							spellcheck="false"
							autocomplete="off"
							aria-describedby="gen-at-help"
						/>
					</div>
				{/if}
			</div>
			<p class="field-help" id="gen-at-help">
				{#if timed}
					Leave the time empty for now, or type one such as 2025-01-01 12:00 to make IDs that decode to that moment.
				{:else if gKind === 'nanoid'}
					NanoIDs are case sensitive, so the letters option does not apply.
				{:else}
					Version 4 has no time in it: all 122 bits that are not version or variant are random.
				{/if}
			</p>
			{#if gCount < 1 || gCount > 100 || !Number.isInteger(gCount)}
				<p class="error" role="alert">Choose between 1 and 100 IDs.</p>
			{/if}
			{#if genError}
				<p class="error" role="alert">{genError}</p>
			{/if}
			<ol class="generated scroll-box" aria-label="Generated IDs">
				{#each generated as id}
					<li>
						<span class="mono gen-id">{id}</span>
						<button type="button" class="mini" on:click={() => tryId(id)} aria-label="Decode {id}">Decode</button>
					</li>
				{:else}
					<li class="empty">
						{generator ? 'Nothing generated.' : 'IDs are generated in your browser once the page has loaded.'}
					</li>
				{/each}
			</ol>
			<div class="gen-actions">
				<button type="button" class="action" on:click={generate} disabled={!generator}>Generate again</button>
				<button type="button" class="action" on:click={copyAll} disabled={!generated.length}>
					{copyState === 'copied' ? 'Copied' : 'Copy all'}
				</button>
				<span class="copy-status" aria-live="polite">
					{copyState === 'copied'
						? `Copied ${generated.length} ID${generated.length === 1 ? '' : 's'}.`
						: copyState === 'failed'
						? 'Copying was blocked; select the list and copy it by hand.'
						: ''}
				</span>
			</div>
		</div>
	</section>

	<section id="reading-a-uuid">
		<h2>How to read a UUID</h2>
		<p>
			A UUID is a 128-bit number written as 32 hex digits in groups of 8, 4, 4, 4 and 12. Two digits always mean the
			same thing whatever made the UUID: the 13th digit is the <strong>version</strong>, which says how the rest was
			filled in, and the top bits of the 17th digit are the <strong>variant</strong>, which says which family of layouts
			it belongs to. Nearly every UUID in use is the RFC 9562 variant, binary 10, so its 17th digit is 8, 9, a or b.
		</p>
		<p>
			Everything else depends on the version. Versions 1, 6 and 7 hold a timestamp, so they can be decoded to a date.
			Version 4 is random and versions 3 and 5 are hashes, so the most anyone can read from them is the version itself.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<caption>UUID versions</caption>
				<thead>
					<tr>
						<th scope="col">Version</th>
						<th scope="col">What the bits hold</th>
						<th scope="col">Time</th>
						<th scope="col">Sorts</th>
					</tr>
				</thead>
				<tbody>
					{#each versions as row}
						<tr>
							<td class="mono strong">{row.v}</td>
							<td>{row.inside}</td>
							<td>{row.time}</td>
							<td>{row.sort}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<h3>The variant digit</h3>
		<p class="section-intro">
			Only the top one to three bits of the 17th digit are the variant (shown in bold); the rest belong to the next
			field. That is why four different hex digits all mean the standard layout.
		</p>
		<div class="table-wrap">
			<table class="data-table variants">
				<thead>
					<tr>
						<th scope="col">17th digit</th>
						<th scope="col">Bits</th>
						<th scope="col">Variant</th>
					</tr>
				</thead>
				<tbody>
					{#each variantRows as row}
						<tr>
							<td class="mono strong">{row.digit}</td>
							<td class="mono"><strong class="fixed">{row.fixed}</strong>{row.rest}</td>
							<td>{VARIANT_NAMES[row.variant]}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="examples">
		<h2>Worked examples</h2>
		<div class="worked-grid">
			<div class="card worked">
				<h3>Version 7 to a date</h3>
				<p class="mono small">{RFC_V7.toLowerCase()}</p>
				<p class="small">
					The first 12 hex digits are the time: <span class="mono">0x{hexOf(v7.fields[0].value, 12)}</span> =
					<span class="mono">{v7.fields[0].value}</span> milliseconds since 1970, which is
					<strong class="mono">{v7.time?.iso}</strong>. The 13th digit, 7, is the version, and the 17th, 9, is binary
					1001: variant 10 followed by two random bits.
					<a href="/uuid-decoder" on:click|preventDefault={() => tryId(RFC_V7)}>Try it</a>
				</p>
			</div>
			<div class="card worked">
				<h3>Version 1 to a date</h3>
				<p class="mono small">{RFC_V1.toLowerCase()}</p>
				<p class="small">
					The time is in three pieces, lowest first. Put them back in order, high, middle, low:
					<span class="mono"
						>{hexOf(v1.fields[3].value, 3)} {hexOf(v1.fields[1].value, 4)} {hexOf(v1.fields[0].value, 8)}</span
					>
					= <span class="mono">{v1Ticks}</span> steps of 100 ns since 1582-10-15. Subtract
					<span class="mono">{GREGORIAN_OFFSET}</span> to count from 1970 instead: <span class="mono">{v1Unix}</span>,
					which is <strong class="mono">{v1.time?.iso}</strong>.
					<a href="/uuid-decoder?id={RFC_V1}" on:click|preventDefault={() => tryId(RFC_V1)}>Try it</a>
				</p>
			</div>
		</div>
		<p>
			Both are examples from RFC 9562, Appendix A, and they hold the same moment. The version 6 example, <span
				class="mono">{RFC_V6.toLowerCase()}</span
			>, is version 1 with the time pieces put in order, high bits first, which is why it sorts correctly as text and
			version 1 does not.
		</p>
	</section>

	<section id="other-ids">
		<h2>ULID, ObjectId, snowflake and NanoID</h2>
		<p>
			UUIDs are not the only IDs with a time inside. A <strong>ULID</strong> is 128 bits like a UUID, 48 bits of
			milliseconds and 80 random bits, written as 26 characters of Crockford Base32 instead of hex. The alphabet,
			<span class="mono">{CROCKFORD}</span>, leaves out I, L, O and U, so a ULID read aloud cannot be mistyped as a
			similar letter; a decoder reads I and L as 1 and O as 0. The ULID
			<span class="mono">{ulidExample.canonical}</span> starts with
			<span class="mono">{ulidExample.canonical.slice(0, 10)}</span>, which is {ulidExample.fields[0].value} ms,
			{ulidExample.time?.iso}.
		</p>
		<p>
			A <strong>MongoDB ObjectId</strong> is 12 bytes: 4 bytes of Unix seconds, 5 random bytes chosen once per process,
			and a 3-byte counter. In <span class="mono">{oid.canonical}</span> the first 8 hex digits,
			<span class="mono">{oid.canonical.slice(0, 8)}</span>, are {oid.fields[0].value} seconds, {oid.time?.iso}.
			<strong>Snowflakes</strong> are 64-bit numbers used by Discord and Twitter/X, with their own epoch; the
			<a href="/snowflake-id-decoder">snowflake ID decoder</a> covers them. A <strong>NanoID</strong> is 21 random characters
			and nothing else, so it has nothing to decode.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<caption>ID formats compared</caption>
				<thead>
					<tr>
						<th scope="col">Format</th>
						<th scope="col" class="num">Bits</th>
						<th scope="col">Written as</th>
						<th scope="col">Time inside</th>
						<th scope="col">Random</th>
						<th scope="col">Sorts by time</th>
					</tr>
				</thead>
				<tbody>
					{#each ID_FORMATS as f}
						<tr>
							<th scope="row">{f.name}</th>
							<td class="mono num">{f.bits}</td>
							<td>{f.chars}</td>
							<td>{f.time}</td>
							<td>{f.random}</td>
							<td>{f.sortable ? 'Yes' : 'No'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Treating a UUID as a secret.</strong> RFC 9562 says not to assume UUIDs are hard to guess or use them as
				security capabilities. Version 4 from a good random source is unpredictable in practice, but versions 1, 6 and 7
				give away when they were made, and a session token deserves a format designed for it.
			</li>
			<li>
				<strong>Leaking a MAC address.</strong> A version 1 UUID made the original way contains the network card address
				of the machine that made it. Generators now usually set a random node with the multicast bit on, as the one on this
				page does.
			</li>
			<li>
				<strong>Expecting version 1 to sort.</strong> Its time is stored low bits first, so sorting the text does not sort
				by time. Use version 7, or 6 if you need the version 1 fields.
			</li>
			<li>
				<strong>Comparing case-sensitively.</strong> RFC 9562 says UUIDs are written in lower case but must be read in either.
				Store one form and compare that.
			</li>
			<li>
				<strong>Mixing up GUID byte order.</strong> Windows stores the first three groups of a GUID little-endian, so the
				raw bytes read as a UUID come out with those groups reversed. The text form is the same either way.
			</li>
		</ul>
		<p class="reducer">
			Each hex digit is four bits, the way the <a href="/hex-to-binary">hex to binary converter</a> shows; turning text
			into bits is covered by the <a href="/binary-translator">binary translator</a>.
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

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.value-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.value-input:focus,
	.small-input:focus,
	.count:focus {
		outline: none;
		border-color: #5db65d;
	}

	.value-input[aria-invalid='true'] {
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
		font: 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.chip-btn:hover,
	.mini:hover,
	.action:hover:not(:disabled) {
		border-color: #5db65d;
		color: #fff;
	}

	.results {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 1rem;
	}

	.results.stale {
		opacity: 0.35;
		pointer-events: none;
	}

	.answer {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
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
		font-size: 1.3rem;
	}

	.canonical {
		display: block;
		color: #fff;
		font-size: 1rem;
		margin-top: 0.3rem;
		overflow-wrap: anywhere;
	}

	mark {
		background: none;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	mark.ver {
		color: #ffd27a;
	}

	mark.var {
		color: #f5a3cf;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.3rem;
	}

	.answer-also strong {
		color: #fff;
	}

	.times {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.15rem 0.8rem;
		margin: 0.6rem 0 0;
		font-size: 0.9rem;
	}

	.times dt {
		color: #999;
	}

	.times dd {
		color: #eee;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.summary {
		color: #ddd;
		margin: 0.8rem 0 0;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.1rem !important;
	}

	.note {
		color: #ccc;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.gen-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1rem;
		align-items: flex-end;
	}

	select,
	.count,
	.small-input {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 0.9rem;
		padding: 0.35rem 0.45rem;
		box-sizing: border-box;
	}

	select:disabled {
		color: #999;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.count {
		width: 5.5rem;
	}

	.small-input {
		width: 15rem;
		max-width: 100%;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.at {
		max-width: 100%;
	}

	.generated {
		list-style: none;
		margin: 0.4rem 0 0.8rem;
		padding: 0.3rem 0;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		max-height: 340px;
		overflow: auto;
		min-height: 2.4rem;
	}

	.generated li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.15rem 0.7rem;
	}

	.generated li.empty {
		color: #999;
		font-size: 0.85rem;
	}

	.gen-id {
		color: #eee;
		font-size: 0.9rem;
		overflow-wrap: anywhere;
		user-select: all;
	}

	.mini,
	.action {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		white-space: nowrap;
	}

	.mini {
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
	}

	.action {
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
	}

	.action:disabled {
		color: #999;
		cursor: default;
	}

	.gen-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.copy-status {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	.data-table caption {
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding-bottom: 0.4rem;
	}

	.data-table th[scope='row'] {
		color: #eee;
		font-weight: 400;
		text-align: left;
		white-space: nowrap;
	}

	.num {
		text-align: right !important;
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.fixed {
		color: #f5a3cf;
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

	.small {
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
		overflow-wrap: anywhere;
	}

	.worked strong {
		color: #8ede8e;
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

	@media (max-width: 560px) {
		.tool {
			padding: 0.9rem 0.75rem 1rem;
		}

		.gen-id {
			font-size: 0.8rem;
		}
	}
</style>
