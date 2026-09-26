<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		base64Encode,
		base64EncodeText,
		base64Decode,
		base64Length,
		decodeUtf8,
		textToBytes,
		formatBytes,
		BASE64_ALPHABET,
		EncodingError,
		type Base64Group
	} from '$lib/textEncoding';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import Steps from './Steps.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { m: 'encode', t: 'Hello', a: 'std', pad: 'on' };
	onMount(() => {
		const p = readUrl();
		mode = safeOption(p.m, ['encode', 'decode'] as const) ?? mode;
		input = safeText(p.t, 4000) ?? input;
		alphabet = safeOption(p.a, ['std', 'url'] as const) ?? alphabet;
		pad = safeOption(p.pad, ['on', 'off'] as const) ?? pad;
	});

	let mode: 'encode' | 'decode' = 'encode';
	let input = DEFAULTS.t;
	let alphabet: 'std' | 'url' = 'std';
	let pad: 'on' | 'off' = 'on';
	$: syncUrl({ m: mode, t: input, a: alphabet, pad }, DEFAULTS);

	const SHOWN_GROUPS = 6;

	// Runs during prerendering too, so the served page shows a worked example.
	let output = '';
	let groups: Base64Group[] = [];
	let error = '';
	let notes: string[] = [];
	let notText = false;
	let byteCount = 0;
	let variant: 'standard' | 'url' = 'standard';
	$: {
		try {
			notes = [];
			notText = false;
			if (mode === 'encode') {
				const result = base64EncodeText(input, { urlSafe: alphabet === 'url', pad: pad === 'on' });
				output = result.text;
				groups = result.groups;
				byteCount = textToBytes(input).length;
			} else {
				const result = base64Decode(input);
				groups = result.groups;
				notes = result.notes;
				variant = result.variant;
				byteCount = result.bytes.length;
				try {
					output = decodeUtf8(result.bytes).text;
				} catch (e) {
					notText = true;
					output = formatBytes(result.bytes, 'hex');
				}
			}
			error = '';
		} catch (e) {
			groups = [];
			output = '';
			error = e instanceof EncodingError ? e.message : 'That could not be decoded';
		}
	}
	$: outputRows = Math.min(8, Math.max(2, Math.ceil(output.length / 56) + output.split('\n').length - 1));

	/** Switches mode, carrying the result across so the toggle reads as a swap. */
	function setMode(next: 'encode' | 'decode') {
		if (next === mode) return;
		if (!error && output && !notText) input = output;
		mode = next;
	}

	function tryExample(value: string, m: 'encode' | 'decode') {
		mode = m;
		input = value;
		const field = document.getElementById('input');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	let copied = false;
	async function copyOutput() {
		try {
			await navigator.clipboard.writeText(output);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	const enc = (text: string) => base64EncodeText(text).text;
	const examples: { label: string; value: string; mode: 'encode' | 'decode' }[] = [
		{ label: 'Hello', value: 'Hello', mode: 'encode' },
		{ label: 'Man', value: 'Man', mode: 'encode' },
		{ label: 'café', value: 'café', mode: 'encode' },
		{ label: 'An emoji', value: '😀', mode: 'encode' },
		{ label: 'Decode a message', value: enc('Base64 is not encryption.'), mode: 'decode' }
	];

	// The worked examples, all from the engine.
	const man = base64EncodeText('Man');
	const manGroup = man.groups[0];
	const padOne = base64EncodeText('M');
	const padTwo = base64EncodeText('Ma');
	const alphabetCells = BASE64_ALPHABET.split('').map((char, index) => ({
		char,
		index,
		bits: index.toString(2).padStart(6, '0')
	}));
	const sizes = [1, 2, 3, 4, 5, 6, 10, 100, 1000, 1_000_000].map((n) => ({
		n,
		padded: base64Length(n),
		unpadded: base64Length(n, false)
	}));
	const auth = 'Aladdin:open sesame';
	const authEncoded = enc(auth);
	const dataUrl = `data:text/plain;base64,${enc('Hello')}`;
	const urlBytes = [0xfb, 0xef, 0xbe, 0xff];
	const urlStandard = base64Encode(urlBytes).text;
	const urlSafe = base64Encode(urlBytes, { urlSafe: true, pad: false }).text;
	const fmt = (n: number) => n.toLocaleString('en-GB');

	const faqs = [
		{
			q: 'Is Base64 encryption?',
			a: `No. Base64 is an encoding: it has no key, and anyone can reverse it. "${auth}" encodes to ${authEncoded}, which looks scrambled but decodes straight back. Use it to carry bytes through a channel that only takes text, never to hide anything.`
		},
		{
			q: 'Why does Base64 end with = or ==?',
			a: 'Base64 turns every 3 bytes into 4 characters. When the input is not a multiple of 3 bytes, the last group is short: one leftover byte gives two characters and ==, two leftover bytes give three characters and =. The padding keeps the output a multiple of 4 characters long.'
		},
		{
			q: 'How much bigger does Base64 make data?',
			a: 'A third bigger: 4 characters for every 3 bytes, rounded up to a whole group. A 3 MB file becomes 4 MB of Base64, plus line breaks if it is wrapped for email.'
		},
		{
			q: 'What is the difference between Base64 and Base64URL?',
			a: 'URL-safe Base64 swaps the two characters that mean something in a URL or file name: + becomes - and / becomes _. It usually leaves off the = padding too. JSON Web Tokens use it. This decoder accepts either.'
		},
		{
			q: 'Why does decoding give strange characters?',
			a: 'The decoded bytes are shown as UTF-8 text. If the Base64 held an image, a compressed file or text in another encoding, the bytes are not UTF-8 text, and this page shows them in hex instead.'
		},
		{
			q: 'Why did my Base64 fail to decode?',
			a: 'Usually a character outside the alphabet (A–Z, a–z, 0–9, + and /, or - and _), a length that leaves one character over after the groups of four, which means something is missing, or = signs in the wrong place or number. The error names which one and where. Spaces and line breaks are ignored.'
		}
	];

	const page = {
		title: 'Base64 Decode and Encode Online, With Each Step Shown',
		description:
			'Decode Base64 to text or encode text to Base64, and see how every 3 bytes become 4 characters, bit by bit, with padding and URL-safe Base64 explained.',
		url: `${SITE}/base64`,
		image: `${SITE}/og/base64.png`,
		imageAlt: 'LogicGates.org: Base64 encode and decode, step by step'
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
					{ '@type': 'ListItem', position: 3, name: 'Base64 encode and decode' }
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
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/learn/bytes-hex-and-width', label: 'Lesson: bytes, hex and bit width' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Base64 encode and decode</h1>
		<p class="lede">
			Turn text into Base64 or Base64 back into text. For short inputs every step is drawn: the bytes in binary, the
			same bits cut into sixes, and the character each six picks.
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

			<label class="field" for="input">{mode === 'encode' ? 'Text' : 'Base64'}</label>
			<textarea
				id="input"
				class="expression-input"
				rows="3"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-describedby="input-help"
			/>
			<p class="field-help" id="input-help">
				{#if mode === 'encode'}
					Any text, including accents and emoji. It is turned into UTF-8 bytes first, and the bytes are encoded.
				{:else}
					Standard or URL-safe Base64. Spaces and line breaks are ignored, and missing padding is fine.
				{/if}
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryExample(example.value, example.mode)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else}
				<div class="out-head">
					<label class="field" for="output"
						>{mode === 'encode' ? 'Base64' : notText ? 'Bytes, in hex' : 'Text'}
						<span class="count"
							>{byteCount} byte{byteCount === 1 ? '' : 's'}{mode === 'encode'
								? `, ${output.length} characters`
								: variant === 'url'
								? ', URL-safe alphabet'
								: ''}</span
						></label
					>
					<button type="button" class="copy" on:click={copyOutput} disabled={!output}
						>{copied ? 'Copied' : 'Copy'}</button
					>
				</div>
				<textarea id="output" class="output mono" readonly rows={outputRows} value={output} />
				{#if notText}
					<p class="note">
						These bytes are not UTF-8 text, so they are shown in hex. They may be an image or other binary data.
					</p>
				{/if}
				{#each notes as note}
					<p class="note">{note}</p>
				{/each}

				{#if groups.length}
					<h2 class="steps-title">Step by step</h2>
					<p class="note legend">
						{#if mode === 'encode'}
							Top to bottom: each byte, its 8 bits, the same bits cut into sixes, each six as a number from 0 to 63, and
							the Base64 character for that number. Colours follow each byte's bits into the sixes; grey bits are zeros
							added to fill the last six.
						{:else}
							Top to bottom: each Base64 character, its number in the alphabet, that number's 6 bits, the same bits cut
							into bytes, and each byte in hex. Grey bits are left over and dropped.
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
				{#if mode === 'encode'}
					<div class="opt" role="group" aria-label="Alphabet">
						<span class="opt-label">Alphabet</span>
						<button
							type="button"
							class:active={alphabet === 'std'}
							aria-pressed={alphabet === 'std'}
							on:click={() => (alphabet = 'std')}>Standard + /</button
						>
						<button
							type="button"
							class:active={alphabet === 'url'}
							aria-pressed={alphabet === 'url'}
							on:click={() => (alphabet = 'url')}>URL-safe - _</button
						>
					</div>
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
				<ShareLink what="the input and settings" />
			</div>
		</div>
	</section>

	<section id="uses">
		<h2>What Base64 is for</h2>
		<p>
			Some channels only carry text: email, URLs, JSON, HTTP headers, a line in a config file. Base64 lets any bytes
			through them, by writing the bytes with 64 characters that survive everywhere: the letters, the digits, + and /.
			You meet it in:
		</p>
		<ul class="uses">
			<li><strong>Email attachments.</strong> MIME sends files as Base64, wrapped in lines of 76 characters.</li>
			<li>
				<strong>Data URLs</strong>, which put a small file straight into a web page:
				<span class="mono wrap">{dataUrl}</span> is a text file holding "Hello".
			</li>
			<li>
				<strong>HTTP basic authentication</strong>, which sends a user name and password as
				<span class="mono wrap">Authorization: Basic {authEncoded}</span>. That is
				<a
					href={toolLink('/base64', { m: 'decode', t: authEncoded })}
					on:click|preventDefault={() => tryExample(authEncoded, 'decode')}>"{auth}"</a
				>, readable by anyone who sees it, which is why it must only go over HTTPS.
			</li>
			<li><strong>Keys and certificates</strong> in PEM files, and binary values inside JSON and XML.</li>
		</ul>
		<p class="reducer">
			Base64 is an encoding, not encryption. There is no key: anyone can decode it, so it hides nothing.
		</p>
	</section>

	<section id="how">
		<h2>How Base64 works: 3 bytes become 4 characters</h2>
		<p class="section-intro">
			A byte is 8 bits and a Base64 character carries 6, since 2<sup>6</sup> = 64. Three bytes are 24 bits, which is exactly
			four sixes. So the encoder takes the bytes three at a time, writes out their 24 bits, cuts them into four groups of
			six, and looks each up in the alphabet. Here is the word "Man":
		</p>
		<Steps groups={man.groups} />
		<p>
			M, a and n are bytes {manGroup.bytes.join(', ')}. Their bits,
			<span class="mono wrap">{manGroup.bits}</span>, cut into sixes are
			<span class="mono wrap">{manGroup.sextets.join(' ')}</span>, which are {manGroup.indexes.join(', ')}, and those
			are the characters {manGroup.chars.join(', ')}. So "Man" is <strong class="mono">{man.text}</strong>. Decoding
			runs the same steps upwards. Text goes through <a href="/binary-translator">UTF-8</a> first, so an emoji is four bytes
			before Base64 sees it.
		</p>

		<h3 class="sub">The alphabet</h3>
		<p class="section-intro">
			The 64 characters in order: capitals for 0 to 25, small letters for 26 to 51, digits for 52 to 61, then + and /.
		</p>
		<div class="alphabet">
			{#each alphabetCells as cell}
				<div class="letter">
					<span class="lchar">{cell.char}</span>
					<span class="lnum">{cell.index}</span>
					<span class="lbits">{cell.bits}</span>
				</div>
			{/each}
		</div>
	</section>

	<section id="padding">
		<h2>Padding: = and ==</h2>
		<p class="section-intro">
			When the bytes run out part way through a group of three, the last group is short. The encoder fills the last six
			with zero bits and adds = for each character that has no bits at all, so the output stays a multiple of four.
		</p>
		<div class="pad-grid">
			<div>
				<h3>One byte left: two characters and ==</h3>
				<Steps groups={padOne.groups} />
				<p class="reducer">
					"M" is <span class="mono">{padOne.text}</span>. 8 bits need two sixes, with 4 zero bits added.
				</p>
			</div>
			<div>
				<h3>Two bytes left: three characters and =</h3>
				<Steps groups={padTwo.groups} />
				<p class="reducer">
					"Ma" is <span class="mono">{padTwo.text}</span>. 16 bits need three sixes, with 2 zero bits added.
				</p>
			</div>
		</div>
		<p>
			The padding carries no information, since the length already says how the last group ends, so many systems leave
			it off. This decoder accepts Base64 with or without it, but not with the wrong number of = signs.
		</p>
	</section>

	<section id="size">
		<h2>How much bigger Base64 makes data</h2>
		<p class="section-intro">
			Every 3 bytes become 4 characters, so Base64 is a third bigger than the data, rounded up to a whole group of four.
		</p>
		<div class="table-scroll">
			<table class="data-table sizes">
				<thead>
					<tr>
						<th scope="col">Bytes</th>
						<th scope="col">Base64 characters</th>
						<th scope="col">Without padding</th>
					</tr>
				</thead>
				<tbody>
					{#each sizes as s}
						<tr>
							<td class="mono">{fmt(s.n)}</td>
							<td class="mono">{fmt(s.padded)}</td>
							<td class="mono">{fmt(s.unpadded)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The rule: 4 × ⌈n ÷ 3⌉ characters for n bytes. Email adds a line break every 76 characters on top of that.
		</p>
	</section>

	<section id="url-safe">
		<h2>URL-safe Base64</h2>
		<p>
			In a URL, + can mean a space and / separates the parts of a path, and / cannot appear in a file name. URL-safe
			Base64, also called Base64URL, uses - for 62 and _ for 63 instead, and usually drops the padding. Everything else
			is the same. The bytes <span class="mono">{formatBytes(urlBytes, 'hex')}</span> are
			<span class="mono">{urlStandard}</span> in standard Base64 and <span class="mono">{urlSafe}</span> in URL-safe Base64.
			JSON Web Tokens are three pieces of URL-safe Base64 joined by full stops.
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
		<p class="reducer">
			To see the bytes of a piece of text in binary, use the <a href="/binary-translator">binary translator</a>; for the
			codes of single characters, the <a href="/ascii-table">ASCII table</a>.
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
		margin-bottom: 0.9rem;
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
		/* Grows with its content where supported, so a result is never cut mid-line. */
		field-sizing: content;
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

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid #e05555;
		border-left-width: 4px;
		border-radius: 3px;
		background-color: rgba(190, 50, 50, 0.12);
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

	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.2rem 0.7rem;
		margin-bottom: 0.35rem;
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
	}

	.uses li {
		margin-bottom: 0.5rem;
	}

	.wrap {
		overflow-wrap: anywhere;
	}

	.sub {
		margin-top: 1.8rem !important;
		font-size: 1.05rem !important;
	}

	.alphabet {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(4.4rem, 1fr));
		gap: 4px;
	}

	.letter {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		column-gap: 0.4rem;
		align-items: baseline;
		padding: 0.25rem 0.45rem;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.lchar {
		grid-row: span 2;
		font-size: 1.15rem;
		font-weight: 700;
		color: #fff;
	}

	.lnum {
		color: #ddd;
		font-size: 0.8rem;
		text-align: right;
	}

	.lbits {
		color: #999;
		font-size: 0.68rem;
		text-align: right;
	}

	.pad-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem 1.5rem;
	}

	.pad-grid h3 {
		font-size: 0.95rem;
		margin-bottom: 0.5rem;
	}

	.table-scroll {
		overflow-x: auto;
		border-radius: 3px;
	}

	.sizes td {
		text-align: right;
	}
</style>
