<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { textToBytes, parseHex, EncodingError } from '$lib/textEncoding';
	import {
		base32Encode,
		base32Decode,
		base32Length,
		bytesAsText,
		hexBytes,
		BASE32_ALPHABETS,
		BASE32_NAMES,
		BaseNError,
		type Base32Group,
		type Base32Variant
	} from '$lib/baseN';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import ErrorAt from '$lib/ErrorAt.svelte';
	import Steps from './Steps.svelte';
	import { onMount } from 'svelte';

	type Mode = 'encode' | 'decode';
	type Source = 'text' | 'hex';
	const VARIANTS = ['rfc4648', 'hex', 'crockford'] as const;

	// Every setting lives in the query string, so a link reopens this exactly; the
	// input is capped at the length a link carries, so anything typed round-trips.
	const URL_MAX = 4000;
	const DEFAULTS = { m: 'encode', t: 'Hello', a: 'rfc4648', pad: 'on', in: 'text', r: 'number' };
	onMount(() => {
		const p = readUrl();
		mode = safeOption(p.m, ['encode', 'decode'] as const) ?? mode;
		input = safeText(p.t, URL_MAX) ?? input;
		variant = safeOption(p.a, VARIANTS) ?? variant;
		pad = safeOption(p.pad, ['on', 'off'] as const) ?? pad;
		source = safeOption(p.in, ['text', 'hex'] as const) ?? source;
		reading = safeOption(p.r, ['number', 'bytes'] as const) ?? reading;
	});

	let mode: Mode = 'encode';
	let input = DEFAULTS.t;
	let variant: Base32Variant = 'rfc4648';
	let pad: 'on' | 'off' = 'on';
	let source: Source = 'text';
	// A ULID-shaped Crockford string can be read two ways (see the engine); a
	// ULID is a number, so that reading comes first, and the RFC 4648 cut is a click away.
	let reading: 'number' | 'bytes' = 'number';
	$: syncUrl({ m: mode, t: input, a: variant, pad, in: source, r: reading }, DEFAULTS);

	const SHOWN_GROUPS = 4;

	// Runs during prerendering too, so the served page shows a worked example.
	let output = '';
	let groups: Base32Group[] = [];
	let error = '';
	let errorAt: number | undefined;
	let notes: string[] = [];
	let notText = false;
	let asNumber: number[] | undefined;
	let numberNote: string | undefined;
	let byteCount = 0;
	let byteHex = '';
	$: {
		try {
			notes = [];
			notText = false;
			asNumber = undefined;
			errorAt = undefined;
			if (mode === 'encode') {
				const bytes = source === 'hex' ? parseHex(input).bytes : textToBytes(input);
				const result = base32Encode(bytes, { variant, pad: pad === 'on' });
				output = result.text;
				groups = result.groups;
				byteCount = bytes.length;
				byteHex = hexBytes(bytes);
			} else {
				const result = base32Decode(input, variant);
				groups = result.groups;
				notes = result.notes;
				asNumber = result.asNumber;
				numberNote = result.numberNote;
				const bytes = asNumber && reading === 'number' ? asNumber : result.bytes;
				byteCount = bytes.length;
				byteHex = hexBytes(bytes);
				// A 128-bit number is an ID, not text, even when its bytes happen to be printable.
				const read = asNumber && reading === 'number' ? { text: '', isText: false } : bytesAsText(bytes);
				notText = !read.isText;
				output = read.isText ? read.text : byteHex;
			}
			error = '';
		} catch (e) {
			groups = [];
			output = '';
			error = e instanceof BaseNError || e instanceof EncodingError ? e.message : 'That could not be read as Base32.';
			errorAt = e instanceof BaseNError ? e.position : undefined;
		}
	}
	$: asWholeNumber = mode === 'decode' && !!asNumber && reading === 'number';
	$: outputRows = Math.min(8, Math.max(2, Math.ceil(output.length / 56) + output.split('\n').length - 1));

	/** Switches mode, carrying the result across so the toggle reads as a swap. */
	function setMode(next: Mode) {
		if (next === mode) return;
		if (!error && output) {
			if (next === 'encode' && notText) {
				input = output;
				source = 'hex';
			} else if (next === 'decode' || !notText) {
				input = output;
				if (next === 'encode') source = 'text';
			}
		}
		mode = next;
	}

	function tryExample(example: Example) {
		mode = example.mode;
		input = example.value;
		variant = example.variant;
		source = example.source ?? 'text';
		const field = document.getElementById('input');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		field?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	let copied: 'idle' | 'copied' | 'failed' = 'idle';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(output);
			copied = 'copied';
		} catch {
			copied = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = 'idle'), 2000);
	}

	type Example = { label: string; value: string; mode: Mode; variant: Base32Variant; source?: Source };
	const enc = (text: string, v: Base32Variant = 'rfc4648') => base32Encode(textToBytes(text), { variant: v }).text;
	// The example secret from the otpauth:// key URI documentation: the bytes of "Hello!" then DE AD BE EF.
	const totpSecret = 'JBSWY3DPEHPK3PXP';
	const examples: Example[] = [
		{ label: 'Hello', value: 'Hello', mode: 'encode', variant: 'rfc4648' },
		{ label: 'foobar', value: 'foobar', mode: 'encode', variant: 'rfc4648' },
		{ label: 'café', value: 'café', mode: 'encode', variant: 'rfc4648' },
		{ label: 'Bytes in hex', value: '00 FF 10 80 7F', mode: 'encode', variant: 'rfc4648', source: 'hex' },
		{ label: 'Decode a 2FA secret', value: totpSecret, mode: 'decode', variant: 'rfc4648' },
		{ label: 'foobar in base32hex', value: 'foobar', mode: 'encode', variant: 'hex' },
		{ label: 'Crockford, typed loosely', value: '9ijp-rv3f', mode: 'decode', variant: 'crockford' }
	];

	// The worked examples, all from the engine.
	const hello = base32Encode(textToBytes('Hello'));
	const helloGroup = hello.groups[0];
	const totp = base32Decode(totpSecret);
	const totpText = bytesAsText(totp.bytes.slice(0, 6)).text;
	const alphabetRows = Array.from({ length: 32 }, (_, index) => ({
		index,
		bits: index.toString(2).padStart(5, '0'),
		rfc: BASE32_ALPHABETS.rfc4648[index],
		hex: BASE32_ALPHABETS.hex[index],
		crockford: BASE32_ALPHABETS.crockford[index]
	}));
	const padRows = ['f', 'fo', 'foo', 'foob', 'fooba'].map((text) => {
		const result = base32Encode(textToBytes(text));
		const g = result.groups[0];
		return {
			text,
			bytes: g.bytes.length,
			bits: g.bytes.length * 8,
			chars: 8 - g.padding,
			fill: g.fillBits,
			padding: g.padding,
			encoded: result.text,
			hexEncoded: base32Encode(textToBytes(text), { variant: 'hex' }).text
		};
	});
	const sizes = [1, 5, 10, 16, 20, 32, 100, 1000].map((n) => ({
		n,
		padded: base32Length(n),
		unpadded: base32Length(n, false),
		base64: 4 * Math.ceil(n / 3)
	}));
	// Bytes in increasing order, and the order their encodings sort in as plain text.
	const sortBytes = [0x0f, 0x80, 0xff];
	const sortRows = sortBytes.map((b) => ({
		hex: hexBytes([b]),
		rfc: base32Encode([b]).text,
		b32hex: base32Encode([b], { variant: 'hex' }).text
	}));
	const sortedBy = (key: 'rfc' | 'b32hex') =>
		[...sortRows]
			.sort((x, y) => (x[key] < y[key] ? -1 : 1))
			.map((r) => r.hex)
			.join(', ');
	const listOf = (key: 'rfc' | 'b32hex') => sortRows.map((r) => r[key]).join(', ');
	const abc = enc('abc');
	const abcHex = hexBytes(textToBytes('abc'));
	const abcMisread = hexBytes(base32Decode(abc, 'hex').bytes);
	const crockfordHello = base32Encode(textToBytes('Hello'), { variant: 'crockford' }).text;
	const fmt = (n: number) => n.toLocaleString('en-GB');

	const faqs = [
		{
			q: 'What is Base32 used for?',
			a: `Mostly for things people read, type or say, or that pass through systems that ignore case. The secret keys for two-factor authentication apps (TOTP) are Base32, such as ${totpSecret}, which decodes to the bytes ${hexBytes(
				totp.bytes
			)}. ULIDs use Crockford's Base32, and Tor's .onion addresses are Base32 in small letters.`
		},
		{
			q: 'Why does Base32 use 2 to 7 and no 0, 1, 8 or 9?',
			a: 'RFC 4648 Base32 needs 32 characters. The 26 capital letters give 26, and the other six are the digits 2 to 7. Leaving out 0, 1 and 8 means the result never has a digit that could be mistaken for the letters O, I or B, and once 2 to 7 fill the six places, 9 is not needed.'
		},
		{
			q: 'Why does Base32 end with ======?',
			a: 'Base32 turns every 5 bytes into 8 characters. When the data is not a multiple of 5 bytes, the last group is short and = fills it to 8 characters: one leftover byte gives 2 characters and six =, two give 4 and four =, three give 5 and three =, four give 7 and one =. Many systems, TOTP apps among them, leave the padding off.'
		},
		{
			q: 'What is the difference between Base32, base32hex and Crockford Base32?',
			a: `RFC 4648 Base32 is A–Z then 2–7. base32hex is 0–9 then A–V, so encoded strings without padding sort in the same order as the bytes. Crockford's alphabet is 0–9 and the letters without I, L, O and U, and his scheme also has reading rules: a decoder reads I and L as 1 and O as 0, ignores hyphens and case, there is no padding, and an optional check symbol may end the string. "Hello" is ${
				hello.text
			}, ${enc(
				'Hello',
				'hex'
			)} and ${crockfordHello} in the three. Crockford's own scheme, and ULIDs, write a number rather than bytes, with the spare bits at the front instead of the end, so unless the length is a multiple of 8 characters the bits line up differently.`
		},
		{
			q: 'How much bigger does Base32 make data?',
			a: 'Eight characters for every 5 bytes, so 60% bigger, against a third bigger for Base64. The price buys an alphabet with no lower case and no symbols, which survives being read aloud, typed into a phone or used in a case-insensitive file name or DNS label.'
		},
		{
			q: 'Why did my Base32 fail to decode?',
			a: 'Usually a character from a different alphabet (a 0, 1, 8 or 9 in RFC 4648 Base32, or a W to Z in base32hex), a length that leaves 1, 3 or 6 characters after the groups of eight, which no number of bytes produces, or the wrong number of = signs. The error names which one and marks the character. Spaces, line breaks and small letters are fine.'
		}
	];

	const page = {
		title: 'Base32 Encode and Decode Online: RFC 4648, Hex and Crockford',
		description:
			'Encode text or bytes to Base32 or decode it back, and see how 5 bytes become 8 characters bit by bit, in RFC 4648, base32hex and Crockford alphabets.',
		url: `${SITE}/base32`,
		image: `${SITE}/og/base32.png`,
		imageAlt: 'LogicGates.org: Base32 encode and decode, bit by bit'
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
					{ '@type': 'ListItem', position: 3, name: 'Base32 encode and decode' }
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
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/base58', label: 'Base58 and Base58Check' },
		{ href: '/base36', label: 'Base 36 converter' },
		{ href: '/uuid-decoder', label: 'UUID and ULID decoder' },
		{ href: '/binary-translator', label: 'Binary translator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Base32 encode and decode</h1>
		<p class="lede">
			Turn text or bytes into Base32 or Base32 back into bytes, in the RFC 4648, base32hex or Crockford alphabet. Every
			group is drawn: five bytes, their 40 bits, the same bits cut into fives, and the character each five picks.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Direction">
				<button
					type="button"
					class:active={mode === 'encode'}
					aria-pressed={mode === 'encode'}
					on:click={() => setMode('encode')}>Encode</button
				>
				<button
					type="button"
					class:active={mode === 'decode'}
					aria-pressed={mode === 'decode'}
					on:click={() => setMode('decode')}>Decode</button
				>
			</div>

			<div class="opts">
				<div class="opt" role="group" aria-label="Alphabet">
					<span class="opt-label">Alphabet</span>
					{#each VARIANTS as v}
						<button
							type="button"
							class:active={variant === v}
							aria-pressed={variant === v}
							on:click={() => (variant = v)}
							>{v === 'rfc4648' ? 'RFC 4648' : v === 'hex' ? 'base32hex' : 'Crockford'}</button
						>
					{/each}
				</div>
				{#if mode === 'encode' && variant !== 'crockford'}
					<div class="opt" role="group" aria-label="Padding">
						<span class="opt-label">Padding</span>
						<button type="button" class:active={pad === 'on'} aria-pressed={pad === 'on'} on:click={() => (pad = 'on')}
							>With =</button
						>
						<button
							type="button"
							class:active={pad === 'off'}
							aria-pressed={pad === 'off'}
							on:click={() => (pad = 'off')}>Without</button
						>
					</div>
				{/if}
				{#if mode === 'encode'}
					<div class="opt" role="group" aria-label="Input">
						<span class="opt-label">Input</span>
						<button
							type="button"
							class:active={source === 'text'}
							aria-pressed={source === 'text'}
							on:click={() => (source = 'text')}>Text</button
						>
						<button
							type="button"
							class:active={source === 'hex'}
							aria-pressed={source === 'hex'}
							on:click={() => (source = 'hex')}>Hex bytes</button
						>
					</div>
				{/if}
				{#if mode === 'decode' && asNumber && !error}
					<div class="opt" role="group" aria-label="Read as">
						<span class="opt-label">Read as</span>
						<button
							type="button"
							class:active={reading === 'number'}
							aria-pressed={reading === 'number'}
							on:click={() => (reading = 'number')}>128-bit number (ULID)</button
						>
						<button
							type="button"
							class:active={reading === 'bytes'}
							aria-pressed={reading === 'bytes'}
							on:click={() => (reading = 'bytes')}>Bytes from the left</button
						>
					</div>
				{/if}
			</div>

			<label class="field" for="input"
				>{mode === 'decode' ? BASE32_NAMES[variant] : source === 'hex' ? 'Bytes in hex' : 'Text'}</label
			>
			<textarea
				id="input"
				class="expression-input"
				rows="2"
				bind:value={input}
				maxlength={URL_MAX}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="input-help"
			/>
			<p class="field-help" id="input-help">
				{#if mode === 'encode' && source === 'hex'}
					Hex bytes such as 48 65 6C or 48656C; a 0x in front of each is fine.
				{:else if mode === 'encode'}
					Any text, including accents and emoji. It is turned into UTF-8 bytes first, and the bytes are encoded.
				{:else if variant === 'crockford'}
					Upper or lower case. Hyphens and spaces are ignored, I, L and O are read as 1, 1 and 0, and a check symbol (*
					~ $ = U) at the end is checked.
				{:else}
					Spaces, line breaks and small letters are fine, and so is missing padding.
				{/if}
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryExample(example)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<ErrorAt message={error} {input} position={errorAt} />
			{:else}
				<div class="out-head">
					<span class="field"
						><label for="output">{mode === 'encode' ? BASE32_NAMES[variant] : notText ? 'Bytes, in hex' : 'Text'}</label
						>
						<span class="count" role="status"
							>{byteCount} byte{byteCount === 1 ? '' : 's'}{mode === 'encode'
								? `, ${output.length} characters`
								: ''}</span
						></span
					>
					<span class="copy-wrap">
						<button type="button" class="copy" on:click={copyOutput} disabled={!output}>Copy</button>
						<span class="copied" aria-live="polite"
							>{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Select the text and copy it' : ''}</span
						>
					</span>
				</div>
				<textarea id="output" class="output mono" readonly rows={outputRows} value={output} />
				{#if mode === 'decode' && !notText && byteCount}
					<p class="note">Bytes: <span class="mono wrap">{byteHex}</span></p>
				{/if}
				{#if asWholeNumber}
					<p class="note">
						Read as one 128-bit number, the way a ULID is written: 26 characters hold 130 bits, so the first character's
						top 2 bits are zeros in front of the number. These are its 16 bytes, in hex.
					</p>
				{:else if notText}
					<p class="note">
						These bytes are not readable UTF-8 text, so they are shown in hex. A 2FA secret, a hash or a key is random
						bytes like this.
					</p>
				{/if}
				{#each notes as note}
					<p class="note">{note}</p>
				{/each}
				{#if asNumber && !asWholeNumber}
					<p class="note">{numberNote}</p>
				{/if}
				{#if asNumber}
					<p class="note">
						Take a ULID apart, time and all, in the <a href="/uuid-decoder">UUID and ULID decoder</a>.
					</p>
				{/if}

				{#if asWholeNumber}
					<p class="note">
						The step-by-step drawing cuts the characters into bytes from the left, the RFC 4648 way, which lines the
						bits up differently; choose <button type="button" class="link-btn" on:click={() => (reading = 'bytes')}
							>Bytes from the left</button
						> to see it.
					</p>
				{:else if groups.length}
					<h2 class="steps-title">Step by step</h2>
					<p class="note legend">
						{#if mode === 'encode'}
							Top to bottom: each byte, its 8 bits, the same 40 bits cut into fives, each five as a number from 0 to 31,
							and the character for that number. Colours follow each byte's bits into the fives; grey bits are zeros
							added to fill the last five.
						{:else}
							Top to bottom: each character, its number in the alphabet, that number's 5 bits, the same bits cut into
							bytes, and each byte in hex. Grey bits are left over and dropped.
						{/if}
					</p>
					<Steps groups={groups.slice(0, SHOWN_GROUPS)} {mode} />
					{#if groups.length > SHOWN_GROUPS}
						<p class="note">
							Showing the first {SHOWN_GROUPS} of {groups.length} groups; every group works the same way.
						</p>
					{/if}
				{/if}
			{/if}

			<div class="export">
				<ShareLink what="the input and settings" />
			</div>
		</div>
	</section>

	<section id="how">
		<h2>How Base32 works: 5 bytes become 8 characters</h2>
		<p class="section-intro">
			A Base32 character carries 5 bits, since 2<sup>5</sup> = 32, and a byte is 8. The smallest run of bits that is a whole
			number of both is 40: five bytes, or eight characters. So the encoder takes the bytes five at a time, writes out their
			40 bits, cuts them into eight fives and looks each one up in the alphabet. Here is "Hello":
		</p>
		<Steps groups={hello.groups} />
		<p>
			H, e, l, l and o are the bytes {helloGroup.bytes.join(', ')}. Their 40 bits cut into fives are
			<span class="mono wrap">{helloGroup.quintets.join(' ')}</span>, which are {helloGroup.indexes.join(', ')}, and in
			the RFC 4648 alphabet those are <strong class="mono">{hello.text}</strong>. Decoding runs the same steps upwards.
			Text goes through <a href="/binary-translator">UTF-8</a> first, so an accented letter is two bytes before Base32 sees
			it.
		</p>
	</section>

	<section id="alphabets">
		<h2>The three Base32 alphabets</h2>
		<p class="section-intro">
			All three map the numbers 0 to 31 to characters; only the characters differ. Data encoded with one alphabet must
			be decoded with the same one.
		</p>
		<div class="table-wrap">
			<table class="data-table alphabet">
				<thead>
					<tr>
						<th scope="col">Value</th>
						<th scope="col">Bits</th>
						<th scope="col">RFC 4648</th>
						<th scope="col">base32hex</th>
						<th scope="col">Crockford</th>
					</tr>
				</thead>
				<tbody>
					{#each alphabetRows as row}
						<tr>
							<td class="mono">{row.index}</td>
							<td class="mono">{row.bits}</td>
							<td class="mono strong">{row.rfc}</td>
							<td class="mono strong">{row.hex}</td>
							<td class="mono strong">{row.crockford}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<ul class="uses">
			<li>
				<strong>RFC 4648 Base32</strong> is the one meant by plain "Base32": capitals A–Z for 0 to 25, then 2–7. It is the
				alphabet of 2FA secret keys and of .onion addresses.
			</li>
			<li>
				<strong>base32hex</strong>, from the same RFC, continues hexadecimal: 0–9, then A–V. Because the characters are
				in ASCII order, encoded strings sort the same way as the bytes they hold, as long as they are left unpadded (an
				= sorts after the digits). The bytes
				{sortRows.map((r) => r.hex).join(', ')} are <span class="mono">{listOf('rfc')}</span> in RFC 4648 Base32, which
				sort as {sortedBy('rfc')}: the alphabet puts 2–7 after Z, but ASCII puts digits before letters. In base32hex
				they are <span class="mono">{listOf('b32hex')}</span>, which sort as {sortedBy('b32hex')}.
			</li>
			<li>
				<strong>Crockford Base32</strong>, designed by Douglas Crockford for people to read and type, is 0–9 and the
				letters without I, L, O and U. A decoder ignores case and hyphens and reads I and L as 1 and O as 0, so a code
				read over the phone still decodes. It has no padding, and may end in a check symbol for the number modulo 37:
				one of the 32 characters or one of five extras, * ~ $ = U, which this decoder checks. His scheme encodes a
				number, with any spare bits at the front; this page, like many libraries, applies the alphabet to bytes the RFC
				4648 way, with the spare bits at the end. The two agree whenever the length is a multiple of 8 characters.
				ULIDs, the sortable IDs the <a href="/uuid-decoder">UUID and ULID decoder</a> takes apart, are one 128-bit number
				in 26 characters, so 2 zero bits come first; paste one in Crockford decode mode and the page reads it as that number,
				with the bytes cut from the left a click away.
			</li>
		</ul>
	</section>

	<section id="padding">
		<h2>Padding: when the bytes do not fill a group</h2>
		<p class="section-intro">
			When fewer than five bytes are left, the last group is short. Its bits are filled out with zeros to a whole five,
			and = signs take the place of the characters with no bits at all, so the output is always a multiple of eight.
			These are the test vectors from RFC 4648:
		</p>
		<div class="table-wrap">
			<table class="data-table pad-table">
				<thead>
					<tr>
						<th scope="col">Input</th>
						<th scope="col">Base32</th>
						<th scope="col">base32hex</th>
						<th scope="col" class="num">= signs</th>
						<th scope="col" class="num"
							><span class="wide-only">Zero bits added</span><span class="narrow-only">Fill bits</span></th
						>
						<th scope="col" class="num wide-only">Bytes</th>
						<th scope="col" class="num wide-only">Bits</th>
						<th scope="col" class="num wide-only">Characters</th>
					</tr>
				</thead>
				<tbody>
					{#each padRows as row}
						<tr>
							<td class="mono">{row.text}</td>
							<td class="mono strong">
								<a
									href={toolLink('/base32', { t: row.text })}
									on:click|preventDefault={() =>
										tryExample({ label: row.text, value: row.text, mode: 'encode', variant: 'rfc4648' })}
									>{row.encoded}</a
								>
							</td>
							<td class="mono">{row.hexEncoded}</td>
							<td class="mono num">{row.padding}</td>
							<td class="mono num">{row.fill}</td>
							<td class="mono num wide-only">{row.bytes}</td>
							<td class="mono num wide-only">{row.bits}</td>
							<td class="mono num wide-only">{row.chars}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			A decoder can tell how many bytes the last group holds from its number of characters alone, so the padding carries
			no information and is often left off, as in 2FA secrets. A group can never end after 1, 3 or 6 characters: no
			number of bytes produces that, which is how this decoder spots a missing or extra character.
		</p>
	</section>

	<section id="size">
		<h2>How much bigger Base32 makes data</h2>
		<p class="section-intro">
			Every 5 bytes become 8 characters, so Base32 is 60% bigger than the data, against a third for Base64.
		</p>
		<div class="table-wrap">
			<table class="data-table sizes">
				<thead>
					<tr>
						<th scope="col" class="num">Bytes</th>
						<th scope="col" class="num">Base32</th>
						<th scope="col" class="num">Without padding</th>
						<th scope="col" class="num">Base64</th>
					</tr>
				</thead>
				<tbody>
					{#each sizes as s}
						<tr>
							<td class="mono num">{fmt(s.n)}</td>
							<td class="mono num">{fmt(s.padded)}</td>
							<td class="mono num">{fmt(s.unpadded)}</td>
							<td class="mono num">{fmt(s.base64)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The rule: 8 × ⌈n ÷ 5⌉ characters for n bytes with padding, ⌈8n ÷ 5⌉ without. A 20-byte TOTP secret is exactly 32
			characters, with no padding needed.
		</p>
	</section>

	<section id="totp">
		<h2>Base32 in two-factor authentication</h2>
		<p>
			An authenticator app and a website share a secret key, a run of random bytes. The QR code you scan when you set up
			2FA holds an <span class="mono">otpauth://</span> link with the key in Base32, and the "enter this key instead"
			text under it is the same Base32, often in blocks of four and in small letters. Base32 is used because the key may
			have to be typed by hand, and an alphabet with one case and no 0, 1 or 8 is hard to mistype. The example key
			<a
				href={toolLink('/base32', { m: 'decode', t: totpSecret })}
				on:click|preventDefault={() => tryExample(examples[4])}><span class="mono">{totpSecret}</span></a
			>
			is {totp.bytes.length} bytes: "{totpText}" followed by {hexBytes(totp.bytes.slice(6))}.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="uses">
			<li>
				<strong>Decoding with the wrong alphabet.</strong> A string can be valid in more than one alphabet, and then it
				decodes without an error into the wrong bytes. "abc" is <span class="mono">{abc}</span> in RFC 4648 Base32; read
				as base32hex, the same characters give the bytes <span class="mono">{abcMisread}</span>, not
				<span class="mono">{abcHex}</span>.
			</li>
			<li>
				<strong>Typing 0, 1 or 8 in RFC 4648 Base32.</strong> They are not in the alphabet (nor is 9). If a key seems to
				contain them, they are almost certainly the letters O, I and B.
			</li>
			<li>
				<strong>Comparing Base32 strings as case-sensitive.</strong> Most decoders, this one included, read small
				letters as capitals, so <span class="mono">jbswy3dp</span> and <span class="mono">JBSWY3DP</span> are the same
				bytes. Some refuse small letters, such as Python's <span class="mono">base64.b32decode</span> unless it is given
				<span class="mono">casefold=True</span>, so write capitals when in doubt.
			</li>
			<li>
				<strong>Treating it as encryption.</strong> Base32, like Base64, has no key; anyone can decode it.
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
			For 6 bits per character, see <a href="/base64">Base64</a>; for the alphabet that drops 0, O, I and l and works by
			division instead, <a href="/base58">Base58</a>; and for base 36, the
			<a href="/base36">base 36 converter</a>.
		</p>
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
		display: flex;
		gap: 4px;
		margin-bottom: 0.8rem;
	}

	.direction button {
		flex: 1 1 0;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.95rem;
		padding: 0.5rem 0.6rem;
		cursor: pointer;
	}

	.direction button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
		font-weight: 600;
	}

	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.1rem;
		margin-bottom: 0.9rem;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.expression-input,
	.output {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
		resize: vertical;
		overflow-wrap: anywhere;
		min-height: 3.2rem;
		max-height: 16rem;
	}

	.output {
		background-color: #101012;
		color: #8ede8e;
	}

	.expression-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.expression-input[aria-invalid='true'] {
		border-color: #f66;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.7rem;
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

	.out-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.count {
		color: #999;
		margin-left: 0.4rem;
	}

	.copy-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-direction: row-reverse;
		margin-bottom: 0.35rem;
	}

	.copied {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	.copy:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.2rem 0.7rem;
		cursor: pointer;
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}

	.legend {
		margin-bottom: 0.7rem;
		max-width: 660px;
	}

	.steps-title {
		font-size: 1rem;
		margin: 1.2rem 0 0.3rem;
	}

	.export {
		display: flex;
		align-items: center;
		gap: 0.8rem 1.1rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.opt {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.opt-label {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.15rem;
	}

	.opt button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.opt button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.uses {
		color: #ddd;
		padding-left: 1.25rem;
		max-width: 700px;
		margin-top: 1rem;
	}

	.uses li {
		margin-bottom: 0.5rem;
	}

	.wrap {
		overflow-wrap: anywhere;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: #8ede8e;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.alphabet {
		width: auto;
		min-width: 320px;
	}

	.data-table.alphabet td,
	.data-table.alphabet th {
		text-align: center;
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.num {
		text-align: right !important;
	}

	.narrow-only {
		display: none;
	}

	.data-table.pad-table td,
	.data-table.pad-table th {
		white-space: nowrap;
	}

	/* On a phone the tables keep their main columns, in tighter cells. */
	@media (max-width: 560px) {
		.data-table.alphabet th,
		.data-table.alphabet td,
		.data-table.sizes th,
		.data-table.sizes td,
		.data-table.pad-table th,
		.data-table.pad-table td {
			padding-left: 0.35rem;
			padding-right: 0.35rem;
			font-size: 0.85rem;
		}

		.alphabet {
			min-width: 0;
		}

		.wide-only {
			display: none;
		}

		.narrow-only {
			display: inline;
		}
	}
</style>
