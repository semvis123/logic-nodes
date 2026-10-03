<script lang="ts">
	import { scrollRegion } from '$lib/scrollRegion';
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import IdBits from '$lib/IdBits.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		detectId,
		decodeUuid,
		decodeUlid,
		decodeObjectId,
		parseUlid,
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
		type GenKind,
		type UuidVariant
	} from '$lib/ids';
	import { readUrl, syncUrl, safeText, safeOption, safeInt, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// RFC 9562 Appendix A writes its examples in upper case.
	const RFC_V7 = '017F22E2-79B0-7CC3-98C4-DC0C0C07398F';
	const RFC_V1 = 'C232AB00-9414-11EC-B3C8-9F6BDECED846';
	const RFC_V6 = '1EC9414C-232A-6B00-B3C8-9F6BDECED846';
	const RFC_V4 = '919108F7-52D1-4320-9BAC-F847DB4148A8';
	const RFC_V5 = '2ed6657d-e927-568b-95e1-2665a8aea6a2';
	const genKinds = Object.keys(GEN_FORMATS) as GenKind[];
	const TIMED: GenKind[] = ['v7', 'v1', 'ulid', 'objectid', 'snowflake'];

	// 'std' is each format's usual case: upper for ULIDs, lower for the rest.
	const DEFAULTS = { id: RFC_V7, g: 'v4', n: 5, case: 'std', dash: 'on', at: '' };
	let input = DEFAULTS.id;
	let gKind: GenKind = 'v4';
	let gCount = DEFAULTS.n;
	let gCase: 'std' | 'lower' | 'upper' = 'std';
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
		gCase = safeOption(p.case, ['std', 'lower', 'upper'] as const) ?? gCase;
		gDash = safeOption(p.dash, ['on', 'off'] as const) ?? gDash;
		gAt = safeText(p.at, 40) ?? gAt;
		now = Date.now();
		generator = new IdGenerator((n) => crypto.getRandomValues(new Uint8Array(n)));
		quick = {
			v4: generator.make('v4', now, { upper: false, dashes: true }),
			v7: generator.make('v7', now, { upper: false, dashes: true })
		};
		// Rewrites the address at once, so a value the page rejected (an unknown
		// option, an overlong ID) is not left in the link that Copy link shares.
		syncState(input, gKind, gCount, gCase, gDash, gAt);
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(tick);
			clearTimeout(alertTimer);
		};
	});
	// The time only applies to the kinds that hold one, so it is left out of the link otherwise.
	function syncState(id: string, g: GenKind, n: number, c: string, dash: string, at: string) {
		syncUrl({ id, g, n, case: c, dash, at: TIMED.includes(g) ? at : '' }, DEFAULTS);
	}
	$: syncState(input, gKind, gCount, gCase, gDash, gAt);

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
	$: ulidChars = decoded?.kind === 'ulid' ? parseUlid(decoded.canonical).chars : [];

	function tryId(value: string) {
		input = value;
		const field = document.getElementById('id-input');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		field?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; value: string }[] = [
		{ label: 'v7 (RFC example)', value: RFC_V7 },
		{ label: 'v1 (RFC example)', value: RFC_V1 },
		{ label: 'v6 (RFC example)', value: RFC_V6 },
		{ label: 'v4 (RFC example)', value: RFC_V4 },
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
	$: countOk = Number.isInteger(gCount) && gCount >= 1 && gCount <= 100;

	function generate() {
		if (!generator) return;
		if (!countOk) {
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
			const upper = gCase === 'std' ? genFormat.upper : gCase === 'upper';
			const opts = { upper, dashes: gDash === 'on' };
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

	$: genMessage = countOk ? genError : 'Choose between 1 and 100 IDs.';

	// The visible errors update on every keystroke, but the alert a screen reader
	// announces waits for a pause in typing, so a half typed UUID is not read out
	// as an error after every character.
	let alertText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	$: scheduleAlert(error || genMessage);
	function scheduleAlert(message: string) {
		clearTimeout(alertTimer);
		if (!message) alertText = '';
		else alertTimer = setTimeout(() => (alertText = message), 500);
	}

	// One fresh v4 and v7 beside the decoder, for a reader who came for a new
	// UUID. Made on mount like the generator below; until then each shows its
	// pattern, which has the same length, so nothing moves when they arrive.
	let quick: { v4: string; v7: string } | null = null;
	const QUICK = [
		{ kind: 'v4', name: 'version 4', pattern: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' },
		{ kind: 'v7', name: 'version 7', pattern: 'tttttttt-tttt-7xxx-yxxx-xxxxxxxxxxxx' }
	] as const;
	let quickCopied: '' | 'v4' | 'v7' = '';
	let quickFailed = false;
	let quickTimer: ReturnType<typeof setTimeout>;
	async function copyQuick(kind: 'v4' | 'v7') {
		if (!quick) return;
		try {
			await navigator.clipboard.writeText(quick[kind]);
			quickCopied = kind;
			quickFailed = false;
		} catch {
			quickCopied = '';
			quickFailed = true;
		}
		clearTimeout(quickTimer);
		quickTimer = setTimeout(() => ((quickCopied = ''), (quickFailed = false)), 2500);
	}

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
	// The 16 possible digits fall into four runs, one per variant.
	const variantRows: { from: string; to: string; variant: UuidVariant; fixed: string; rest: string }[] = [];
	for (let d = 0; d < 16; d++) {
		const { variant, bits } = variantOfDigit(d);
		const last = variantRows[variantRows.length - 1];
		if (last && last.variant === variant) last.to = d.toString(16);
		else {
			const pattern = d.toString(2).padStart(4, '0');
			variantRows.push({
				from: d.toString(16),
				to: d.toString(16),
				variant,
				fixed: pattern.slice(0, bits),
				rest: 'x'.repeat(4 - bits)
			});
		}
	}
	const half = birthdayHalf(122);
	// Superscript digits, so the visible answer and its JSON-LD copy are the same text.
	const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const sci = (n: number) => {
		const exp = Math.floor(Math.log10(n));
		return `${(n / 10 ** exp).toFixed(1)} × 10${[...String(exp)].map((c) => SUPERSCRIPT[Number(c)]).join('')}`;
	};

	const versions = [
		{ v: '1', inside: '60-bit time (100 ns), clock sequence, node (MAC address or random)', time: 'Yes', sort: 'No' },
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
			a: `From versions 1, 6 and 7, which carry a full timestamp. Version 2 keeps only part of one, and a version 8 may hold one in a layout only its maker knows. Version 7 starts with the Unix time in milliseconds: ${RFC_V7.toLowerCase()} begins ${hexOf(
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
		{ href: '/base32', label: 'Base32 encode and decode' },
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
				aria-describedby="id-help{error ? ' id-error' : ''}"
			/>
			{#if error}
				<p class="error" id="id-error">{error}</p>
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

			<div class="quick-gen" role="group" aria-label="New UUIDs">
				{#each QUICK as q}
					<div class="quick-row">
						<span class="quick-label">New {q.kind}</span>
						<span class="mono quick-id" class:pending={!quick}>{quick ? quick[q.kind] : q.pattern}</span>
						<button type="button" class="mini copy" disabled={!quick} on:click={() => copyQuick(q.kind)}
							>{quickCopied === q.kind ? 'Copied' : 'Copy'}<span class="visually-hidden">
								new {q.name} UUID</span
							></button
						>
					</div>
				{/each}
				<p class="quick-more">
					<a href="#generator">More kinds and options</a>: up to 100 at a time, ULIDs, ObjectIds and NanoIDs.
					<span class="copy-status" aria-live="polite"
						>{quickCopied
							? `Copied the new ${quickCopied} UUID.`
							: quickFailed
							? 'Copying was blocked: select the UUID and press ctrl+C.'
							: ''}</span
					>
				</p>
			</div>

			{#if decoded}
				<div class="results" class:stale={!!error} inert={error ? true : undefined}>
					<div class="answer">
						<!-- Only the part that changes when the ID does is live: the age
						     below ticks every second and must not be read out each time. -->
						<div role={error ? undefined : 'status'}>
							<span class="answer-label">Detected</span>
							<span class="answer-value">{decoded.title}</span>
							<span class="canonical mono">
								{#if isUuid}
									{decoded.canonical.slice(0, 14)}<mark class="ver" title="version digit">{decoded.canonical[14]}</mark
									>{decoded.canonical.slice(15, 19)}<mark class="var" title="variant digit"
										>{decoded.canonical[19]}</mark
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
						</div>
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
							base={decoded.kind === 'snowflake' ? 'dec' : 'hex'}
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
						<h3 class="chars-title">The characters</h3>
						<p class="note">
							Each character is 5 bits in Crockford Base32. 26 characters would be 130 bits, so the first carries only 3
							and can only be 0 to 7. The first 10 characters are the time, the last 16 the random part.
						</p>
						<ol class="ulid-chars" aria-label="Each character of the ULID, its value and its bits">
							{#each ulidChars as c, i}
								<li class:time-char={i < 10}>
									<span class="mono ch">{c.char}</span>
									<span class="mono val">{c.value}</span>
									<span class="mono b5">{c.value.toString(2).padStart(i === 0 ? 3 : 5, '0')}</span>
								</li>
							{/each}
						</ol>
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
		{#if alertText}
			<p class="visually-hidden" role="alert">{alertText}</p>
		{/if}
	</section>

	<section id="generator">
		<h2>UUID and ID generator</h2>
		<p class="section-intro">
			UUID versions 4, 7 and 1, ULIDs, MongoDB ObjectIds, NanoIDs and Discord snowflakes, made in your browser.
		</p>
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
					<input
						id="gen-count"
						class="count"
						type="number"
						min="1"
						max="100"
						bind:value={gCount}
						aria-invalid={countOk ? 'false' : 'true'}
						aria-describedby={countOk ? undefined : 'gen-error'}
					/>
				</div>
				<div>
					<label class="field" for="gen-case">Letters</label>
					<select id="gen-case" bind:value={gCase} disabled={!genFormat.caseOption}>
						<option value="std">Usual ({genFormat.upper ? 'UPPER' : 'lower'})</option>
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
							aria-invalid={genError ? 'true' : 'false'}
							aria-describedby="gen-at-help{genError ? ' gen-error' : ''}"
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
			{#if genMessage}
				<p class="error" id="gen-error">{genMessage}</p>
			{/if}
			<ol class="generated scroll-box" aria-label="Generated IDs">
				{#each generated as id}
					<li>
						<span class="mono gen-id">{id}</span>
						<button type="button" class="mini" on:click={() => tryId(id)} aria-label="Decode {id}">Decode</button>
					</li>
				{:else}
					{#if generator}
						<li class="empty">Nothing generated.</li>
					{:else}
						<!-- As many blank rows as will be made, so the list does not grow when they arrive. -->
						<li class="visually-hidden">IDs are generated in your browser once the page has loaded.</li>
						{#each Array(gCount) as _}
							<li aria-hidden="true">
								<span class="mono gen-id">&nbsp;</span><span class="mini placeholder">Decode</span>
							</li>
						{/each}
					{/if}
				{/each}
			</ol>
			<div class="gen-actions">
				<button type="button" class="action" on:click={generate} disabled={!generator || !countOk}
					>Generate again</button
				>
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
			Everything else depends on the version. Versions 1, 6 and 7 hold a full timestamp, so they can be decoded to a
			date; version 2 keeps only part of one. Version 4 is random and versions 3 and 5 are hashes, so the most anyone
			can read from them is the version itself.
		</p>
		<div class="table-wrap" use:scrollRegion data-label="UUID versions">
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

		<h3 class="variant-title">The variant digit</h3>
		<p class="section-intro">
			Only the top one to three bits of the 17th digit are the variant (shown in bold); the rest belong to the next
			field (shown as x). That is why four different hex digits all mean the standard layout.
		</p>
		<div class="table-wrap" use:scrollRegion data-label="The variant digit">
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
							<td class="mono strong">{row.from === row.to ? row.from : `${row.from} to ${row.to}`}</td>
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
					<strong class="mono nowrap">{v7.time?.iso}</strong>. The 13th digit, 7, is the version, and the 17th, 9, is
					binary 1001: variant 10 followed by two random bits.
					<a class="nowrap" href="/uuid-decoder" on:click|preventDefault={() => tryId(RFC_V7)}>Try it</a>
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
					which is <strong class="mono nowrap">{v1.time?.iso}</strong>.
					<a class="nowrap" href="/uuid-decoder?id={RFC_V1}" on:click|preventDefault={() => tryId(RFC_V1)}>Try it</a>
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
			<span class="mono alphabet">{CROCKFORD}</span>, leaves out I, L and O, which are easily confused with 1 and 0, and
			U, which Crockford dropped to avoid accidental obscenities; a decoder reads I and L as 1 and O as 0. The ULID
			<span class="mono">{ulidExample.canonical}</span> starts with
			<span class="mono">{ulidExample.canonical.slice(0, 10)}</span>, which is {ulidExample.fields[0].value} ms,
			<span class="mono nowrap">{ulidExample.time?.iso}</span>.
		</p>
		<p>
			A <strong>MongoDB ObjectId</strong> is 12 bytes: 4 bytes of Unix seconds, 5 random bytes chosen once per process,
			and a 3-byte counter. In <span class="mono">{oid.canonical}</span> the first 8 hex digits,
			<span class="mono">{oid.canonical.slice(0, 8)}</span>, are {oid.fields[0].value} seconds,
			<span class="mono nowrap">{oid.time?.iso}</span>.
			<strong>Snowflakes</strong> are 64-bit numbers used by Discord and Twitter/X, with their own epoch; the
			<a href="/snowflake-id-decoder">snowflake ID decoder</a> covers them. A <strong>NanoID</strong> is 21 random characters
			and nothing else, so it has nothing to decode.
		</p>
		<div class="table-wrap" use:scrollRegion data-label="ID formats compared">
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
							<td>{f.sortable}</td>
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
				of the machine that made it. Python's uuid1() and PostgreSQL's uuid_generate_v1() still do by default. Some generators,
				and the one on this page, use a random node with the multicast bit set instead.
			</li>
			<li>
				<strong>Expecting version 1 to sort.</strong> Its time is stored low bits first, so sorting the text does not sort
				by time. Use version 7, or 6 if you need the version 1 fields.
			</li>
			<li>
				<strong>Comparing case-sensitively.</strong> RFC 9562 allows the hex letters in upper, lower or mixed case, so comparisons
				must ignore case (the older RFC 4122 asked for lower case output). Store one form and compare that.
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
		font-size: 0.8rem;
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

	.answer .canonical {
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

	/* An ISO time is one word: on a phone each label goes above its value
	   rather than squeezing the time into a narrow column. */
	@media (max-width: 560px) {
		.times {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.times dd {
			margin-bottom: 0.3rem;
			overflow-wrap: normal;
		}
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

	/* One height for every control in the row, so their labels line up. */
	select,
	.count,
	.small-input {
		height: 2.1rem;
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.2rem 0.6rem;
		padding: 0.15rem 0.7rem;
	}

	.generated li.empty {
		color: #999;
		font-size: 0.85rem;
	}

	/* An ID never breaks across lines; when it and its button do not fit
	   side by side, the button moves under it instead. */
	.gen-id {
		color: #eee;
		font-size: 0.9rem;
		white-space: nowrap;
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

	/* Sized like the Decode button it stands in for, and as tall. */
	.mini.placeholder {
		display: inline-block;
		line-height: normal;
		visibility: hidden;
	}

	/* The same size and look as the site's Copy link button. */
	.mini.copy {
		font-size: 0.8rem;
		line-height: 1.2;
		min-width: 4.6rem;
		padding: 0.3rem 0.7rem;
	}

	.mini:disabled {
		color: #999;
		cursor: default;
	}

	.quick-gen {
		margin: 0 0 1rem;
	}

	/* Label, ID and Copy in a row; on a phone the ID gets a line of its own
	   under its label and button, so it never has to break. */
	.quick-row {
		display: grid;
		grid-template-columns: 4.2rem max-content max-content;
		grid-template-areas: 'label id copy';
		align-items: center;
		gap: 0.3rem 0.7rem;
		margin-top: 0.35rem;
	}

	.quick-label {
		grid-area: label;
		color: #999;
		font-size: 0.85rem;
	}

	.quick-row .quick-id {
		grid-area: id;
		color: #eee;
		font-size: 0.9rem;
		overflow-wrap: anywhere;
		user-select: all;
	}

	.quick-row .copy {
		grid-area: copy;
		justify-self: start;
	}

	.quick-row .quick-id.pending {
		color: #999;
	}

	.quick-more {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
	}

	.quick-more .copy-status {
		display: block;
		min-height: 1.2em;
	}

	.alphabet {
		word-break: break-all;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
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

	.nowrap {
		white-space: nowrap;
	}

	.variant-title {
		margin-top: 1.6rem;
	}

	#generator .section-intro {
		margin-top: 0.3rem;
	}

	.chars-title {
		color: #fff;
		font-size: 1rem;
		margin: 1rem 0 0;
	}

	/* One box per character, wrapping to the width: the character, its value
	   and its 5 bits (3 for the first), coloured like the field it belongs to. */
	.ulid-chars {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0;
	}

	.ulid-chars li {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.1rem;
		padding: 0.2rem 0.25rem;
		border: 1px solid rgba(90, 155, 216, 0.5);
		border-radius: 3px;
		background-color: rgba(90, 155, 216, 0.1);
		line-height: 1.35;
	}

	.ulid-chars li.time-char {
		border-color: rgba(93, 182, 93, 0.6);
		background-color: rgba(93, 182, 93, 0.12);
	}

	.ulid-chars .ch {
		color: #fff;
		font-size: 1.05rem;
		font-weight: 700;
	}

	.ulid-chars .val {
		color: #bbb;
		font-size: 0.75rem;
	}

	.ulid-chars .b5 {
		color: #ddd;
		font-size: 0.75rem;
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

	@media (max-width: 720px) {
		.quick-row {
			grid-template-columns: 4.2rem minmax(0, 1fr);
			grid-template-areas: 'label copy' 'id id';
			margin-top: 0.6rem;
		}
	}

	@media (max-width: 560px) {
		.quick-row .quick-id {
			font-size: 0.8rem;
		}

		.gen-id {
			font-size: 0.74rem;
		}
	}
</style>
