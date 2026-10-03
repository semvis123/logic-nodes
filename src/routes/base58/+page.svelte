<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { textToBytes, parseHex, base64Encode, EncodingError } from '$lib/textEncoding';
	import {
		base58Encode,
		base58Decode,
		base58CheckVerify,
		bytesAsText,
		hexBytes,
		leadingCharacters,
		VERSION_KINDS,
		BASE58_ALPHABET,
		BaseNError,
		type DivisionStep,
		type HornerStep,
		type Base58CheckResult
	} from '$lib/baseN';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import ErrorAt from '$lib/ErrorAt.svelte';
	import Num from '$lib/WorkingNumber.svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;
	$: example = data.example;

	type Mode = 'encode' | 'decode' | 'check';
	type Source = 'text' | 'hex';

	// Every setting lives in the query string, so a link reopens this exactly; the
	// input is capped at the length a link carries, so anything typed round-trips.
	const URL_MAX = 2000;
	const DEFAULTS = { m: 'encode', t: 'Hello World!', in: 'text' };
	onMount(() => {
		const p = readUrl();
		mode = safeOption(p.m, ['encode', 'decode', 'check'] as const) ?? mode;
		// Check mode starts from the example address when a link names the mode but not the string.
		input = safeText(p.t, URL_MAX) ?? (mode === 'check' ? data.example.address : input);
		source = safeOption(p.in, ['text', 'hex'] as const) ?? source;
	});

	let mode: Mode = 'encode';
	let input = DEFAULTS.t;
	let source: Source = 'text';
	// Check mode's default string is the example address, so that is what its link may leave out.
	$: syncUrl({ m: mode, t: input, in: source }, mode === 'check' ? { ...DEFAULTS, t: example.address } : DEFAULTS);

	/** Rows of working shown before the table says the rest go the same way. */
	const MAX_ROWS = 120;
	/** A working table longer than this scrolls in its own box; a shorter one is shown whole. */
	const LONG_TABLE = 30;

	// Encode and decode run during prerendering too, so the served page shows a worked example.
	let output = '';
	let error = '';
	let errorAt: number | undefined;
	let notText = false;
	let bytes: number[] = [];
	let zeros = 0;
	let value = 0n;
	let divisions: DivisionStep[] = [];
	let readings: HornerStep[] = [];
	$: if (mode !== 'check') {
		try {
			errorAt = undefined;
			notText = false;
			if (mode === 'encode') {
				bytes = source === 'hex' ? parseHex(input).bytes : textToBytes(input);
				const result = base58Encode(bytes);
				output = result.text;
				zeros = result.leadingZeros;
				value = result.value;
				divisions = result.steps;
				readings = [];
			} else {
				const result = base58Decode(input);
				bytes = result.bytes;
				zeros = result.leadingOnes;
				value = result.value;
				readings = result.steps;
				divisions = [];
				const read = bytesAsText(bytes);
				notText = !read.isText;
				output = read.isText ? read.text : hexBytes(bytes);
			}
			error = '';
		} catch (e) {
			output = '';
			divisions = [];
			readings = [];
			error = e instanceof BaseNError || e instanceof EncodingError ? e.message : 'That could not be read.';
			errorAt = e instanceof BaseNError ? e.position : undefined;
		}
	}

	// Checking needs SHA-256 from Web Crypto, which answers asynchronously; the
	// counter drops an answer that arrives after the input has changed again.
	let check: Base58CheckResult | null = null;
	let checkError = '';
	let checkAt: number | undefined;
	let checkRun = 0;
	$: if (mode === 'check') runCheck(input);
	async function runCheck(text: string) {
		const run = ++checkRun;
		try {
			const result = await base58CheckVerify(text);
			if (run !== checkRun) return;
			check = result;
			checkError = '';
			checkAt = undefined;
		} catch (e) {
			if (run !== checkRun) return;
			check = null;
			checkError = e instanceof BaseNError ? e.message : 'That could not be checked.';
			checkAt = e instanceof BaseNError ? e.position : undefined;
		}
	}

	$: outputRows = Math.min(8, Math.max(2, Math.ceil(output.length / 56) + output.split('\n').length - 1));

	/** Switches mode, carrying the result across so the toggle reads as a swap. */
	function setMode(next: Mode) {
		if (next === mode) return;
		if (next === 'check') {
			const usable = mode === 'decode' && !error && bytes.length >= 5;
			if (!usable) input = example.address;
		} else if (mode === 'check') {
			// Leaving the checker: Decode keeps the string; Encode takes its bytes, since
			// encoding the address's own characters as text would mean nothing.
			if (next === 'encode') {
				if (check && !checkError) {
					input = hexBytes(check.decoded.bytes);
					source = 'hex';
				} else {
					input = DEFAULTS.t;
					source = 'text';
				}
			}
		} else if (!error && output) {
			if (next === 'encode' && notText) {
				input = output;
				source = 'hex';
			} else {
				input = output;
				if (next === 'encode') source = 'text';
			}
		}
		mode = next;
	}

	function tryExample(ex: Example) {
		mode = ex.mode;
		input = ex.value;
		source = ex.source ?? 'text';
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

	/** Thousands separators, and a long number shortened to its ends so a table stays readable. */
	function big(n: bigint): string {
		const s = n.toString();
		if (s.length <= 36) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return `${s.slice(0, 10)}…${s.slice(-10)} (${s.length} digits)`;
	}

	type Example = { label: string; value: string; mode: Mode; source?: Source };
	const examples: Example[] = [
		{ label: 'Hello World!', value: 'Hello World!', mode: 'encode' },
		{ label: 'Hi', value: 'Hi', mode: 'encode' },
		{ label: 'Leading zero bytes', value: '00 00 48 69', mode: 'encode', source: 'hex' },
		{ label: 'Decode a string', value: '2NEpo7TZRRrLZSi2U', mode: 'decode' },
		{ label: 'Check an address', value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', mode: 'check' },
		{ label: 'A script address', value: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', mode: 'check' },
		{ label: 'One character wrong', value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3', mode: 'check' }
	];

	// Worked examples, all from the engine.
	const hi = base58Encode(textToBytes('Hi'));
	const hiZeros = base58Encode([0, 0, ...textToBytes('Hi')]);
	const alphabetCells = BASE58_ALPHABET.split('').map((char, index) => ({ char, index }));
	// One byte changed at the start: Base64 changes one or two characters, Base58 nearly all of them.
	const ripple = ['Hello World!', 'Jello World!'].map((t) => ({
		t,
		b58: base58Encode(textToBytes(t)).text,
		b64: base64Encode(textToBytes(t)).text
	}));
	/** Each character of `a`, marked when it differs from the same position in `b`. */
	const marked = (a: string, b: string) => [...a].map((ch, i) => ({ ch, diff: ch !== b[i] }));
	const differing = (a: string, b: string) => marked(a, b).filter((c) => c.diff).length;
	const rippleB58 = differing(ripple[0].b58, ripple[1].b58);
	const rippleB64 = differing(ripple[0].b64, ripple[1].b64);
	const kinds = VERSION_KINDS.map((k) => {
		const lead = leadingCharacters(k);
		return {
			...k,
			starts: lead.first === lead.last ? lead.first : `${lead.first} or ${lead.last}`,
			longest: lead.longest
		};
	});
	const sizes = [1, 4, 8, 16, 20, 25, 32, 37, 64].map((n) => ({
		n,
		max: base58Encode(Array(n).fill(0xff)).text.length,
		base64: 4 * Math.ceil(n / 3)
	}));
	const addressLength = kinds[0].longest;
	const anyLength = base58Encode(Array(25).fill(0xff)).text.length;

	const faqs = [
		{
			q: 'Why does Base58 leave out 0, O, I and l?',
			a: 'Because in many fonts 0 and O look the same, and so do I and l. Leaving them out means a Base58 string can be copied by eye without a mix-up. Base58 also drops the + and / of Base64, so a string is all letters and digits: a double click selects the whole of it, and nothing in it is mistaken for punctuation.'
		},
		{
			q: 'Why do Bitcoin addresses start with 1?',
			a: 'A legacy Bitcoin address starts with the version byte 0. Base58 treats the bytes as one number, and a number has no leading zeros, so each zero byte at the start is written as a 1, the character for zero, to keep it. Script addresses use version byte 5 and so start with 3.'
		},
		{
			q: 'What is Base58Check?',
			a: 'Base58 with a checksum: a version byte, then the payload, then the first 4 bytes of SHA-256 applied twice to the version and payload. A wallet recomputes the checksum before sending money, so a mistyped address is refused instead of paying a stranger. This page checks pasted addresses the same way.'
		},
		{
			q: 'Is Base58 the same as Base64 with some characters removed?',
			a: `No. 58 is not a power of two, so a character does not stand for a fixed group of bits. The whole input is one number, divided by 58 again and again. That is why changing one byte can change characters all through the result: "${ripple[0].t}" and "${ripple[1].t}" differ in ${rippleB58} of their ${ripple[0].b58.length} Base58 characters, but in only ${rippleB64} of their Base64 characters.`
		},
		{
			q: 'How long is a Bitcoin address in Base58?',
			a: `A legacy address is 25 bytes: a version byte, a 20-byte hash and a 4-byte checksum. Any 25 bytes are at most ${anyLength} Base58 characters, but an address's version byte is 0, which becomes a single 1, so it is at most ${addressLength}. Some are shorter, because the length depends on the size of the number, not only on the byte count.`
		},
		{
			q: 'Why do some Bitcoin addresses start with bc1?',
			a: 'Those are SegWit addresses, written in Bech32 (BIP 173), or in Bech32m (BIP 350) for Taproot addresses starting bc1p: a different encoding with its own error-detecting checksum. They are not Base58Check, so this checker does not read them.'
		}
	];

	const page = {
		title: 'Base58 Encode and Decode, With a Base58Check Address Checker',
		description:
			'Encode text or bytes to Base58 or decode it, see the repeated division by 58, and check the checksum of a Bitcoin address or other Base58Check string.',
		url: `${SITE}/base58`,
		image: `${SITE}/og/base58.png`,
		imageAlt: 'LogicGates.org: Base58 encode and decode, with Base58Check'
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
					{ '@type': 'ListItem', position: 3, name: 'Base58 encode and decode' }
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
		{ href: '/base32', label: 'Base32 encode and decode' },
		{ href: '/base36', label: 'Base 36 converter' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal, by repeated division' },
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Base58 encode and decode</h1>
		<p class="lede">
			Turn text or bytes into Base58, the alphabet of Bitcoin addresses, or decode it back, with the division by 58
			written out. Paste an address to check its Base58Check checksum and see its parts.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Mode">
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
				<button
					type="button"
					class:active={mode === 'check'}
					aria-pressed={mode === 'check'}
					on:click={() => setMode('check')}>Check address</button
				>
			</div>

			{#if mode === 'encode'}
				<div class="opt input-opt" role="group" aria-label="Input">
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

			<label class="field" for="input"
				>{mode === 'check'
					? 'Base58Check string, such as a Bitcoin address'
					: mode === 'decode'
					? 'Base58'
					: source === 'hex'
					? 'Bytes in hex'
					: 'Text'}</label
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
				aria-invalid={(mode === 'check' ? checkError : error) ? 'true' : 'false'}
				aria-describedby="input-help"
			/>
			<p class="field-help" id="input-help">
				{#if mode === 'check'}
					The checksum is recomputed with SHA-256 in your browser. Nothing is sent anywhere.
				{:else if mode === 'decode'}
					Letters and digits except 0, O, I and l. Case matters: a and A are different characters.
				{:else if source === 'hex'}
					Hex bytes such as 00 48 69 or 004869. Zero bytes at the start become 1s.
				{:else}
					Any text, including accents and emoji. It is turned into UTF-8 bytes first, and the bytes are encoded.
				{/if}
			</p>

			<div class="chips">
				{#each examples as ex}
					<button type="button" class="chip-btn" on:click={() => tryExample(ex)}>{ex.label}</button>
				{/each}
			</div>

			{#if mode === 'check'}
				{#if checkError}
					<ErrorAt message={checkError} {input} position={checkAt} />
				{:else if check}
					<div class="verdict" class:bad={!check.valid} role="status">
						<strong>{check.valid ? 'Checksum is valid' : 'Checksum does not match'}</strong>
						{#if check.valid}
							The last 4 bytes equal the first 4 bytes of the double SHA-256 of the rest.
							{#if check.kind}It reads as a {check.kind.name}.{/if}
						{:else}
							The string is mistyped or altered: it says {hexBytes(check.checksum)}, but the bytes before it give {hexBytes(
								check.expected
							)}.
						{/if}
					</div>
					<div class="parts" role="group" aria-label="The decoded bytes, split into parts">
						<div class="part version">
							<span class="part-label">Version</span>
							<span class="mono">{hexBytes([check.version])}</span>
							<span class="part-note">{check.kind ? check.kind.name : `${check.version} in decimal`}</span>
						</div>
						<div class="part payload">
							<span class="part-label">Payload, {check.payload.length} bytes</span>
							<span class="mono wrap">{hexBytes(check.payload) || 'none'}</span>
						</div>
						<div class="part checksum" class:bad={!check.valid}>
							<span class="part-label">Checksum</span>
							<span class="mono">{hexBytes(check.checksum)}</span>
							<span class="part-note">should be {hexBytes(check.expected)}</span>
						</div>
					</div>
					<p class="note">
						Double SHA-256 of version and payload: <span class="mono wrap">{hexBytes(check.hash, '')}</span>. The
						checksum is its first 4 bytes.
					</p>
				{:else}
					<p class="note" role="status">Checking…</p>
				{/if}
			{:else if error}
				<ErrorAt message={error} {input} position={errorAt} />
			{:else}
				<div class="out-head">
					<span class="field"
						><label for="output">{mode === 'encode' ? 'Base58' : notText ? 'Bytes, in hex' : 'Text'}</label>
						<span class="count" role="status"
							>{bytes.length} byte{bytes.length === 1 ? '' : 's'}{mode === 'encode'
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
				{#if mode === 'decode' && bytes.length >= 5}
					<p class="note">
						If this is an address or key, <button type="button" class="linkish" on:click={() => setMode('check')}
							>check its Base58Check checksum</button
						>.
					</p>
				{/if}
				{#if notText}
					<p class="note">These bytes are not readable UTF-8 text, so they are shown in hex.</p>
				{/if}

				{#if bytes.length}
					<h2 class="steps-title">Step by step</h2>
					<ol class="working">
						{#if mode === 'encode'}
							<li>
								The bytes: <span class="mono wrap">{hexBytes(bytes)}</span>.
								{#if zeros}
									<strong>{zeros} zero byte{zeros === 1 ? '' : 's'}</strong> at the start
									{zeros === 1 ? 'becomes' : 'become'} <span class="mono strong">{'1'.repeat(zeros)}</span>.
								{/if}
							</li>
							{#if divisions.length}
								<li>
									{zeros ? 'The rest, read' : 'Read'} as one number:
									<span class="mono wrap">{big(value)}</span>.
								</li>
								<li>Divide by 58 until nothing is left, keeping each remainder:</li>
							{/if}
						{:else}
							{#if zeros}
								<li>
									<strong>{zeros} leading 1{zeros === 1 ? '' : 's'}</strong>
									{zeros === 1 ? 'is a zero byte' : `are ${zeros} zero bytes`}.
								</li>
							{/if}
							{#if readings.length}
								<li>Read the {zeros ? 'other ' : ''}characters left to right: multiply by 58, add the next value:</li>
							{/if}
						{/if}
					</ol>
					{#if divisions.length}
						<div class="table-wrap" class:scroll-box={divisions.length > LONG_TABLE}>
							<table class="data-table steps">
								<thead>
									<tr>
										<th scope="col" class="num">Number</th>
										<th scope="col" class="num quotient">÷ 58</th>
										<th scope="col" class="num">Remainder</th>
										<th scope="col">Character</th>
									</tr>
								</thead>
								<tbody>
									{#each divisions.slice(0, MAX_ROWS) as step}
										<tr>
											<td class="mono num"><Num value={step.dividend} {big} /></td>
											<td class="mono num quotient"><Num value={step.quotient} {big} /></td>
											<td class="mono num">{step.remainder}</td>
											<td class="mono strong">{step.digit}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if divisions.length > MAX_ROWS}
							<p class="note">Showing {MAX_ROWS} of {divisions.length} divisions.</p>
						{/if}
						<p class="equation">
							Read the characters from the bottom up{zeros ? ', after the 1s' : ''}:
							<span class="mono strong wrap">{output}</span>.
						</p>
					{/if}
					{#if readings.length}
						<div class="table-wrap" class:scroll-box={readings.length > LONG_TABLE}>
							<table class="data-table steps">
								<thead>
									<tr>
										<th scope="col">Character</th>
										<th scope="col" class="num">Value</th>
										<th scope="col" class="num">Total × 58 + value</th>
									</tr>
								</thead>
								<tbody>
									{#each readings.slice(0, MAX_ROWS) as step}
										<tr>
											<td class="mono strong">{step.digit}</td>
											<td class="mono num">{step.value}</td>
											<td class="mono num"><Num value={step.after} {big} /></td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if readings.length > MAX_ROWS}
							<p class="note">Showing {MAX_ROWS} of {readings.length} characters.</p>
						{/if}
						<p class="equation">
							Written as bytes, {big(value)} is
							<span class="mono wrap">{hexBytes(bytes.slice(zeros))}</span>{#if zeros}, after {zeros} zero byte{zeros ===
								1
									? ''
									: 's'}{/if}.
						</p>
					{/if}
				{/if}
			{/if}

			<p class="share-row"><ShareLink what="the input and mode" /></p>
		</div>
	</section>

	<section id="why">
		<h2>Why Base58 exists</h2>
		<p>
			Base58 was written for Bitcoin, to show addresses and keys to people. It is Base64's 64 characters minus six: the
			look-alikes 0 (zero), O (capital o), I (capital i) and l (small L), and the symbols + and /. What is left is
			letters and digits only, so a string can be read off a screen without confusing two characters, a double click
			selects the whole of it, and an email program finds no punctuation to break a line at. Besides Bitcoin, IPFS uses
			it for its original content identifiers, the ones starting with Qm.
		</p>
		<div class="alphabet" role="list" aria-label="The 58 characters and their values">
			{#each alphabetCells as cell}
				<div class="letter" role="listitem">
					<span class="lchar">{cell.char}</span>
					<span class="lnum">{cell.index}</span>
				</div>
			{/each}
		</div>
		<p class="reducer">
			The order is digits, capitals, then small letters, as in ASCII, minus the four look-alikes. So 1 is 0, 9 is 8, A
			is 9 and z is 57.
		</p>
	</section>

	<section id="how">
		<h2>How Base58 works: one big number, divided by 58</h2>
		<p class="section-intro">
			Base64 and <a href="/base32">Base32</a> regroup bits, because 64 and 32 are powers of two. 58 is not, so a Base58
			character does not stand for any fixed group of bits. Instead the bytes are read as one large number and written
			in base 58, by the same repeated division that turns <a href="/hex-to-decimal">decimal into hex</a>. Here is "Hi":
		</p>
		<div class="worked-grid">
			<div class="card worked">
				<h3>Encoding "Hi"</h3>
				<p class="small">
					The bytes {hexBytes(textToBytes('Hi'))} are the number 0x4869 = <strong>{hi.value}</strong>.
				</p>
				<p class="mono small">
					{#each hi.steps as s}
						{s.dividend} ÷ 58 = {s.quotient} remainder {s.remainder} → {s.digit}<br />
					{/each}
				</p>
				<p class="small">
					The remainders from the bottom up give <strong class="mono">{hi.text}</strong>.
				</p>
			</div>
			<div class="card worked">
				<h3>Leading zero bytes</h3>
				<p class="small">
					The bytes {hexBytes([0, 0, ...textToBytes('Hi')])} are the same number, {hiZeros.value}: zeros in front of a
					number change nothing. To keep them, each leading zero byte is written as
					<span class="mono">1</span>, the character for 0.
				</p>
				<p class="small">
					So they encode as <strong class="mono">{hiZeros.text}</strong>. Only zero bytes at the very start are treated
					this way; zeros anywhere else are part of the number.
				</p>
			</div>
		</div>
		<p>
			Because every character depends on the whole number, changing one byte can change characters all through the
			result. "{ripple[0].t}" and "{ripple[1].t}" differ only in their first byte:
		</p>
		<div class="table-wrap">
			<table class="data-table ripple">
				<thead>
					<tr>
						<th scope="col" class="wide-only">Text</th><th scope="col">Base58</th><th scope="col">Base64</th>
					</tr>
				</thead>
				<tbody>
					{#each ripple as r, i}
						{@const other = ripple[1 - i]}
						<tr>
							<td class="mono wide-only">{r.t}</td>
							<td class="mono"
								>{#each marked(r.b58, other.b58) as c}<span class:diff={c.diff} class:same={!c.diff}>{c.ch}</span
									>{/each}</td
							>
							<td class="mono"
								>{#each marked(r.b64, other.b64) as c}<span class:diff={c.diff} class:same={!c.diff}>{c.ch}</span
									>{/each}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			{rippleB58} of the {ripple[0].b58.length} Base58 characters differ (underlined), against {rippleB64} of the Base64
			ones. Dividing a long number again and again also takes time that grows with the square of its length, which is why
			Base58 is used for short things like addresses and keys, not for files.
		</p>
	</section>

	<section id="base58check">
		<h2>Base58Check: the checksum in Bitcoin addresses</h2>
		<p class="section-intro">
			A mistyped address must not quietly send money to the wrong place, so Bitcoin adds a checksum before encoding. The
			bytes are a version byte, the payload, and the first 4 bytes of SHA-256 applied twice to those two. This is the
			address <span class="mono wrap">{example.address}</span> taken apart:
		</p>
		<div class="parts static">
			<div class="part version">
				<span class="part-label">Version</span>
				<span class="mono">{hexBytes([example.version])}</span>
				<span class="part-note">{example.kind}</span>
			</div>
			<div class="part payload">
				<span class="part-label">Payload, {example.payload.length} bytes</span>
				<span class="mono wrap">{hexBytes(example.payload)}</span>
				<span class="part-note">a hash of the owner's public key</span>
			</div>
			<div class="part checksum">
				<span class="part-label">Checksum</span>
				<span class="mono">{hexBytes(example.checksum)}</span>
				<span class="part-note">{example.valid ? 'matches' : 'does not match'}</span>
			</div>
		</div>
		<p>
			SHA-256 of SHA-256 of the version and payload is
			<span class="mono wrap">{hexBytes(example.hash, '')}</span>. Its first 4 bytes,
			<span class="mono">{hexBytes(example.expected)}</span>, are the checksum. Change any one character of the address
			and the number changes, so the checksum no longer matches; a random mistake gets through only about once in 2<sup
				>32</sup
			>
			(4.3 billion) tries.
			<a
				href={toolLink('/base58', { m: 'check', t: examples[6].value })}
				on:click|preventDefault={() => tryExample(examples[6])}>Try a one-character mistake</a
			>.
		</p>

		<h3 class="sub">Version bytes and the first character</h3>
		<p class="section-intro">
			The version byte is the most significant part of the number, so it decides which character or two the result can
			start with (a version byte of 0 is the exception: it is a leading zero byte, so it becomes a 1). These are the
			common Bitcoin prefixes, with the first characters worked out by encoding the smallest and largest value of each
			kind:
		</p>
		<div class="table-wrap">
			<table class="data-table kinds">
				<thead>
					<tr>
						<th scope="col">Version</th>
						<th scope="col">What it is</th>
						<th scope="col" class="num wide-only">Payload</th>
						<th scope="col">Starts with</th>
						<th scope="col" class="num wide-only">Longest</th>
					</tr>
				</thead>
				<tbody>
					{#each kinds as k}
						<tr>
							<td class="mono">{hexBytes([k.version])}</td>
							<td>{k.name}</td>
							<td class="mono num wide-only">{k.payloadLength} bytes</td>
							<td class="mono strong">{k.starts}</td>
							<td class="mono num wide-only">{k.longest}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="size">
		<h2>How long Base58 is</h2>
		<p class="section-intro">
			Each character carries log<sub>2</sub> 58 ≈ 5.86 bits, so n bytes need up to about 1.37 × n characters, a little more
			than Base64's 1.33 × n. The exact length depends on the number, so the table gives the most, for bytes that are all
			FF.
		</p>
		<div class="table-wrap">
			<table class="data-table sizes">
				<thead>
					<tr>
						<th scope="col">Bytes</th>
						<th scope="col">Base58, at most</th>
						<th scope="col">Base64 with padding</th>
					</tr>
				</thead>
				<tbody>
					{#each sizes as s}
						<tr>
							<td class="mono">{s.n}</td>
							<td class="mono">{s.max}</td>
							<td class="mono">{s.base64}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
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
			For encodings that regroup bits instead, see <a href="/base64">Base64</a> and <a href="/base32">Base32</a>; for
			numbers in any base from 2 to 36, the <a href="/base36">base 36 converter</a>.
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
		padding: 0.5rem 0.4rem;
		cursor: pointer;
	}

	@media (max-width: 420px) {
		.direction button {
			font-size: 0.85rem;
			white-space: nowrap;
		}
	}

	.direction button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
		font-weight: 600;
	}

	.input-opt {
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

	.linkish {
		background: none;
		border: none;
		padding: 0;
		color: #8ede8e;
		text-decoration: underline;
		font: inherit;
		cursor: pointer;
	}

	.steps-title {
		font-size: 1rem;
		margin: 1.2rem 0 0.3rem;
	}

	.working {
		color: #ddd;
		font-size: 0.9rem;
		padding-left: 1.25rem;
		margin: 0.3rem 0 0.6rem;
	}

	.working li {
		margin-bottom: 0.3rem;
	}

	.verdict {
		margin-top: 0.3rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid #5db65d;
		border-left-width: 4px;
		border-radius: 3px;
		background-color: rgba(51, 119, 34, 0.18);
		color: #ddd;
		font-size: 0.9rem;
	}

	.verdict strong {
		display: block;
		color: #8ede8e;
		font-size: 1.05rem;
	}

	.verdict.bad {
		border-color: #e05555;
		background-color: rgba(190, 50, 50, 0.12);
	}

	.verdict.bad strong {
		color: #f88;
	}

	.parts {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 4px;
		margin-top: 0.7rem;
	}

	.part {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.45rem 0.6rem;
		background-color: #101012;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-top-width: 3px;
		border-radius: 3px;
		min-width: 0;
	}

	.part.version {
		border-top-color: #8ec5ff;
	}

	.part.payload {
		border-top-color: #e6c07b;
	}

	.part.checksum {
		border-top-color: #5db65d;
	}

	.part.checksum.bad {
		border-top-color: #e05555;
	}

	.part-label {
		color: #999;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.part-note {
		color: #bbb;
		font-size: 0.78rem;
	}

	.part .mono {
		color: #fff;
		font-size: 0.85rem;
	}

	.parts.static {
		margin-bottom: 1rem;
	}

	@media (max-width: 640px) {
		.parts {
			grid-template-columns: 1fr;
		}
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
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

	.wrap {
		overflow-wrap: anywhere;
	}

	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}

	.data-table.steps td,
	.data-table.steps th {
		white-space: nowrap;
		font-size: 0.85rem;
		padding-left: 0.6rem;
		padding-right: 0.6rem;
	}

	.num {
		text-align: right !important;
	}

	/* Each quotient is the next row's number, so a phone can do without the column. */
	@media (max-width: 600px) {
		.quotient {
			display: none;
		}

		/* Three short columns fit a phone once the cells are a little tighter. */
		.data-table.sizes th,
		.data-table.sizes td {
			padding-left: 0.4rem;
			padding-right: 0.4rem;
		}
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.equation {
		color: #ccc;
		font-size: 0.92rem;
		margin: 0.7rem 0 0;
	}

	.sub {
		margin-top: 1.8rem !important;
		font-size: 1.05rem !important;
	}

	.alphabet {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.6rem, 1fr));
		gap: 4px;
		margin: 1rem 0 0.4rem;
	}

	.letter {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.25rem 0.45rem;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.lchar {
		font-size: 1.15rem;
		font-weight: 700;
		color: #fff;
	}

	.lnum {
		color: #bbb;
		font-size: 0.8rem;
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

	.ripple td {
		white-space: nowrap;
	}

	.same {
		color: #999;
	}

	.diff {
		color: #fff;
		text-decoration: underline;
		text-decoration-color: #e6c07b;
		text-underline-offset: 3px;
	}

	.kinds td {
		vertical-align: top;
	}

	/* On a phone the comparison columns come first: the two texts are named just
	   above the ripple table, and the payload size and longest length are extras. */
	@media (max-width: 480px) {
		.wide-only {
			display: none;
		}

		:global(.content) .ripple td,
		:global(.content) .ripple th {
			padding-left: 0.4rem;
			padding-right: 0.4rem;
		}
	}
</style>
