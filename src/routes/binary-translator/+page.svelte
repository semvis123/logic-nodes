<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		encodeText,
		decodeUtf8,
		parseBytes,
		formatBytes,
		placeValues,
		asciiTable,
		codePointLabel,
		UTF8_RANGES,
		EncodingError,
		type CharInfo,
		type ByteFormat
	} from '$lib/textEncoding';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { d: 'encode', t: 'Hi', f: 'binary', sep: 'space', zeros: 'on' };
	onMount(() => {
		const p = readUrl();
		direction = safeOption(p.d, ['encode', 'decode'] as const) ?? direction;
		input = safeText(p.t, 2000) ?? input;
		format = safeOption(p.f, ['binary', 'hex', 'decimal'] as const) ?? format;
		sep = safeOption(p.sep, ['space', 'none'] as const) ?? sep;
		zeros = safeOption(p.zeros, ['on', 'off'] as const) ?? zeros;
	});

	let direction: 'encode' | 'decode' = 'encode';
	let input = DEFAULTS.t;
	let format: ByteFormat = 'binary';
	let sep: 'space' | 'none' = 'space';
	let zeros: 'on' | 'off' = 'on';
	$: syncUrl({ d: direction, t: input, f: format, sep, zeros }, DEFAULTS);
	// Decimal bytes run together could not be read back (72105 is H then i, or not), so they are always separated.
	$: spaced = sep === 'space' || format === 'decimal';

	const ascii = asciiTable();
	const FORMAT_NAMES: Record<ByteFormat, string> = { binary: 'binary', hex: 'hex', decimal: 'decimal' };
	const SHOWN_CHARS = 48;

	/** How a character is shown in the table: control codes and spaces by name, since they are invisible. */
	const shown = (c: CharInfo) =>
		c.codePoint < 128 && (c.codePoint <= 32 || c.codePoint === 127) ? ascii[c.codePoint].abbr : c.char;

	// Runs during prerendering too, so the served page carries a real breakdown.
	let chars: CharInfo[] = [];
	let output = '';
	let error = '';
	let sevenBit = false;
	let byteCount = 0;
	$: {
		try {
			sevenBit = false;
			if (direction === 'encode') {
				chars = encodeText(input);
				const bytes = chars.flatMap((c) => c.bytes.map((b) => b.value));
				byteCount = bytes.length;
				const padded = zeros === 'on' || sep === 'none' || format !== 'binary';
				output = formatBytes(bytes, format, spaced ? ' ' : '', padded);
			} else {
				const parsed = parseBytes(input, format);
				sevenBit = parsed.sevenBit;
				const decoded = decodeUtf8(parsed.bytes);
				chars = decoded.chars;
				byteCount = parsed.bytes.length;
				output = decoded.text;
			}
			error = '';
		} catch (e) {
			chars = [];
			output = '';
			error = e instanceof EncodingError ? e.message : 'That could not be translated';
		}
	}

	$: multiByte = chars
		.filter((c, i) => c.bytes.length > 1 && chars.findIndex((d) => d.char === c.char) === i)
		.slice(0, 3);
	$: outputRows = Math.min(8, Math.max(2, Math.ceil(output.length / 56) + output.split('\n').length - 1));

	/**
	 * Switches direction, carrying the result across so the toggle reads as a
	 * swap. Going to decode, the bytes are written out again in the form the
	 * decoder reads best, whole bytes with spaces, whatever the display options
	 * were: 7-bit groups mixed with 6-bit ones, or decimal run together, would
	 * not read back.
	 */
	function setDirection(next: 'encode' | 'decode') {
		if (next === direction) return;
		if (!error && output) {
			input =
				next === 'decode'
					? formatBytes(
							chars.flatMap((c) => c.bytes.map((b) => b.value)),
							format,
							' ',
							true
					  )
					: output;
		}
		direction = next;
	}

	/** Loads an example: text examples are encoded, binary ones decoded. */
	function tryExample(value: string, dir: 'encode' | 'decode', fmt: ByteFormat = 'binary') {
		direction = dir;
		format = fmt;
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

	const examples: { label: string; value: string; dir: 'encode' | 'decode' }[] = [
		{ label: 'Hi', value: 'Hi', dir: 'encode' },
		{ label: 'hello world', value: 'hello world', dir: 'encode' },
		{ label: 'café', value: 'café', dir: 'encode' },
		{ label: 'An emoji', value: '😀', dir: 'encode' },
		{ label: 'Decode a message', value: '01001100 01101111 01100111 01101001 01100011', dir: 'decode' }
	];

	// The worked examples, all from the engine.
	const hi = encodeText('Hi');
	const hiBinary = formatBytes(
		hi.flatMap((c) => c.bytes.map((b) => b.value)),
		'binary'
	);
	const handMessage = '01001100 01101111 01100111 01101001 01100011';
	const handBytes = parseBytes(handMessage, 'binary').bytes;
	const handText = decodeUtf8(handBytes).text;
	const handRows = handBytes.map((value) => ({ value, ...placeValues(value), char: String.fromCharCode(value) }));
	const first = placeValues(hi[0].bytes[0].value);
	const sizes = encodeText('Aé€😀');
	const eAcute = encodeText('é')[0];
	const rangeLabel = (cp: number) => codePointLabel(cp);

	// The binary alphabet: each letter and digit through the same encoder as the translator.
	const alphabetGroups = [
		{ name: 'Capital letters', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
		{ name: 'Small letters', chars: 'abcdefghijklmnopqrstuvwxyz' },
		{ name: 'Digits', chars: '0123456789' }
	].map((g) => ({
		name: g.name,
		rows: encodeText(g.chars).map((c) => ({ char: c.char, binary: c.bytes[0].binary, value: c.bytes[0].value }))
	}));
	const [capitals, smalls, digitRows] = alphabetGroups.map((g) => g.rows);
	const space = encodeText(' ')[0].bytes[0];

	const faqs = [
		{
			q: `What does ${hiBinary} mean?`,
			a: `It is the word "Hi". Each group of 8 bits is one byte: ${hi
				.map((c) => `${c.bytes[0].binary} is ${c.bytes[0].value}, the code for ${c.char}`)
				.join(', and ')}. Paste it into the translator above with "Binary to text" selected to see each step.`
		},
		{
			q: 'Is binary code the same as ASCII?',
			a: 'No. Binary is just a way of writing numbers with two digits. ASCII is a code that says which number stands for which character, so A is 65, which is 01000001 in binary. Binary to text translation needs both: read each group of bits as a number, then look the number up in a code such as ASCII or UTF-8.'
		},
		{
			q: 'How many bits are in a letter?',
			a: `Eight for the letters and symbols of ASCII, which UTF-8 stores in one byte each. ASCII itself needs only 7 bits, so the first bit is always 0. Other characters take more: ${sizes
				.slice(1)
				.map((c) => `${c.char} takes ${c.bytes.length * 8} bits`)
				.join(', ')}.`
		},
		{
			q: 'Why is é two bytes?',
			a: `Its code point, ${eAcute.label} (${
				eAcute.codePoint
			}), is bigger than 127, the largest number that fits in the 7 bits a one-byte UTF-8 character has room for. UTF-8 splits its bits over two bytes: ${eAcute.bytes
				.map((b) => b.binary)
				.join(' ')}. The first starts with 110 to say "two bytes", the second with 10 to say "continued".`
		},
		{
			q: 'Can I translate binary without spaces?',
			a: 'Yes. Without spaces the bits are read eight at a time from the left, so the total must be a multiple of 8. With spaces each group must be 8 bits. A message written entirely in 7-bit groups, as some older translators produce, is read as ASCII with a 0 added at the front of each group.'
		},
		{
			q: 'What is the binary code for a space?',
			a: 'A space is character 32, which is 00100000 in binary. It is a character like any other, so a translated sentence has a byte for every space between its words.'
		},
		{
			q: 'Why do I get an error for my binary?',
			a: 'Either a group is not 8 bits long, there is a character other than 0, 1 and spaces, or the bytes are not valid UTF-8: a byte above 127 must be part of a multi-byte character, so it has to follow the rules for one. The message names the group or byte where things went wrong.'
		}
	];

	const page = {
		title: 'Binary Translator: Text to Binary and Binary to Text',
		description:
			'Translate text to binary and binary to text, with every character broken down into its code point and UTF-8 bytes. Handles accents and emoji.',
		url: `${SITE}/binary-translator`,
		image: `${SITE}/og/binary-translator.png`,
		imageAlt: 'LogicGates.org: binary translator, text to binary and back'
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
					{ '@type': 'ListItem', position: 3, name: 'Binary translator' }
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
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/binary-converter', label: 'Binary converter (numbers)' },
		{ href: '/learn/bits-with-meaning', label: 'Lesson: how bits become letters' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Binary translator</h1>
		<p class="lede">
			Turn text into binary, or binary back into text. Every character is broken down below into its number and the
			bytes UTF-8 stores it as, so you can see where each bit comes from.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Direction">
				<button
					type="button"
					class:active={direction === 'encode'}
					aria-pressed={direction === 'encode'}
					on:click={() => setDirection('encode')}>Text to {FORMAT_NAMES[format]}</button
				>
				<button
					type="button"
					class:active={direction === 'decode'}
					aria-pressed={direction === 'decode'}
					on:click={() => setDirection('decode')}
					>{FORMAT_NAMES[format][0].toUpperCase() + FORMAT_NAMES[format].slice(1)} to text</button
				>
			</div>

			<label class="field" for="input"
				>{direction === 'encode'
					? 'Text'
					: `${FORMAT_NAMES[format][0].toUpperCase()}${FORMAT_NAMES[format].slice(1)}`}</label
			>
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
				{#if direction === 'encode'}
					Any text, including accents and emoji. It is encoded as UTF-8, which is ASCII for plain English letters.
				{:else if format === 'binary'}
					Groups of 8 bits separated by spaces, or one long run of bits whose length is a multiple of 8.
				{:else if format === 'hex'}
					Two hex digits per byte, such as <span class="mono">48 69</span>, <span class="mono">4869</span> or
					<span class="mono">0x48 0x69</span>.
				{:else}
					Byte values from 0 to 255, separated by spaces or commas. A character above 127 is several bytes in UTF-8.
				{/if}
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryExample(example.value, example.dir)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else}
				<div class="out-head">
					<label class="field" for="output"
						>{direction === 'encode' ? FORMAT_NAMES[format][0].toUpperCase() + FORMAT_NAMES[format].slice(1) : 'Text'}
						<span class="count"
							>{chars.length} character{chars.length === 1 ? '' : 's'}, {byteCount} byte{byteCount === 1
								? ''
								: 's'}</span
						></label
					>
					<button type="button" class="copy" on:click={copyOutput} disabled={!output}
						>{copied ? 'Copied' : 'Copy'}</button
					>
				</div>
				<textarea id="output" class="output mono" readonly rows={outputRows} value={output} />
				{#if sevenBit}
					<p class="note">
						Every group was 7 bits, so the message was read as 7-bit ASCII, with a 0 added in front of each group.
					</p>
				{/if}

				{#if chars.length}
					<h2 class="breakdown-title">Character by character</h2>
					<div class="table-scroll">
						<table class="data-table breakdown">
							<thead>
								<tr>
									<th scope="col">Char</th>
									<th scope="col">Code point</th>
									<th scope="col">UTF-8 bytes in binary</th>
									<th scope="col">Hex</th>
									<th scope="col">Decimal</th>
								</tr>
							</thead>
							<tbody>
								{#each chars.slice(0, SHOWN_CHARS) as c}
									<tr class:multi={c.bytes.length > 1}>
										<td class="char">{shown(c)}</td>
										<td class="mono"
											>{c.label}{#if c.replaced}<span class="dim"> (broken)</span>{/if}</td
										>
										<td class="mono bits">
											{#each c.bytes as b}
												<span class="byte"
													>{#if c.bytes.length > 1}<span class="prefix">{b.prefix}</span><span class="payload"
															>{b.payload}</span
														>{:else}{b.binary}{/if}</span
												>
											{/each}
										</td>
										<td class="mono">{c.bytes.map((b) => b.hex).join(' ')}</td>
										<td class="mono">{c.bytes.map((b) => b.value).join(' ')}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if chars.length > SHOWN_CHARS}
						<p class="note">The table shows the first {SHOWN_CHARS} of {chars.length} characters.</p>
					{/if}
					{#each multiByte as c}
						{@const payload = c.bytes.map((b) => b.payload).join('')}
						<p class="multi-note">
							<strong class="mono">{c.char}</strong> is {c.label}, number {c.codePoint}. That is
							<span class="mono">{c.codePoint.toString(2)}</span> in binary, too big for the 7 bits a one-byte character
							has, so UTF-8 uses {c.bytes.length} bytes. It writes the number in {payload.length} bits,
							<span class="mono"
								>{#each c.bytes as b, i}<span class="payload">{b.payload}</span>{i < c.bytes.length - 1
										? ' '
										: ''}{/each}</span
							>, and puts each piece after a marker:
							<span class="mono"
								>{#each c.bytes as b, i}<span class="prefix">{b.prefix}</span><span class="payload">{b.payload}</span
									>{i < c.bytes.length - 1 ? ' ' : ''}{/each}</span
							>.
						</p>
					{/each}
					{#if multiByte.length}
						<p class="legend">
							<span class="prefix">Grey</span> bits are markers, <span class="payload">green</span> bits the character's
							number.
						</p>
					{/if}
				{/if}
			{/if}

			<div class="export">
				<div class="opt" role="group" aria-label="Number format">
					<span class="opt-label">As</span>
					{#each ['binary', 'hex', 'decimal'] as f}
						<button
							type="button"
							class:active={format === f}
							aria-pressed={format === f}
							on:click={() => (format = f === 'hex' ? 'hex' : f === 'decimal' ? 'decimal' : 'binary')}
							>{f === 'binary' ? 'Binary' : f === 'hex' ? 'Hex' : 'Decimal'}</button
						>
					{/each}
				</div>
				{#if direction === 'encode' && format !== 'decimal'}
					<div class="opt" role="group" aria-label="Separator">
						<span class="opt-label">Between bytes</span>
						<button
							type="button"
							class:active={sep === 'space'}
							aria-pressed={sep === 'space'}
							on:click={() => (sep = 'space')}>Space</button
						>
						<button
							type="button"
							class:active={sep === 'none'}
							aria-pressed={sep === 'none'}
							on:click={() => (sep = 'none')}>Nothing</button
						>
					</div>
					{#if format === 'binary' && sep === 'space'}
						<div class="opt" role="group" aria-label="Leading zeros">
							<span class="opt-label">Bits</span>
							<button
								type="button"
								class:active={zeros === 'on'}
								aria-pressed={zeros === 'on'}
								on:click={() => (zeros = 'on')}>8 per byte</button
							>
							<button
								type="button"
								class:active={zeros === 'off'}
								aria-pressed={zeros === 'off'}
								on:click={() => (zeros = 'off')}>No leading zeros</button
							>
						</div>
					{/if}
				{/if}
				<ShareLink what="the text and settings" />
			</div>
		</div>
	</section>

	<section id="how">
		<h2>How text becomes binary</h2>
		<p class="section-intro">
			A computer stores only numbers, and it stores them in binary. Text gets there in three steps.
		</p>
		<ol class="steps">
			<li>
				<strong>Each character gets a number.</strong> Unicode gives every character in every script a number called its
				code point, written U+ and then hex: H is {hi[0].label}, which is {hi[0].codePoint}.
			</li>
			<li>
				<strong>The number becomes bytes.</strong> UTF-8, the encoding used by nearly every web page and file today, stores
				code points up to 127 as a single byte holding the number, and bigger ones as two to four bytes.
			</li>
			<li>
				<strong>Each byte is 8 bits.</strong>
				{hi[0].codePoint} in binary is
				<span class="mono">{hi[0].bytes[0].binary}</span>, so that is what H is stored as.
			</li>
		</ol>
		<div class="flow card">
			{#each hi as c}
				<div class="flow-row">
					<span class="flow-char">{c.char}</span>
					<span class="arrow" aria-hidden="true">→</span>
					<span class="mono">{c.label}</span>
					<span class="arrow" aria-hidden="true">→</span>
					<span class="mono">{c.codePoint}</span>
					<span class="arrow" aria-hidden="true">→</span>
					<span class="mono strong">{c.bytes[0].binary}</span>
				</div>
			{/each}
		</div>
		<p class="reducer">
			The table of which number stands for which character is the code. For English letters, digits and punctuation it
			is <a href="/ascii-table">ASCII</a>, which UTF-8 contains unchanged. The lesson
			<a href="/learn/bits-with-meaning">how bits become letters, colours and codes</a> goes through the idea slowly.
		</p>
	</section>

	<section id="alphabet">
		<h2>Binary code for letters (binary alphabet)</h2>
		<p class="section-intro">
			Every letter and digit as the byte a computer stores, in ASCII and UTF-8 alike, with its decimal code. Capitals
			run from {capitals[0].value} to {capitals[25].value}, small letters from {smalls[0].value} to {smalls[25].value},
			and the digits from {digitRows[0].value} to {digitRows[9].value}. A space is
			<span class="mono">{space.binary}</span> ({space.value}).
		</p>
		{#each alphabetGroups as group}
			<h3 class="alpha-title">{group.name}</h3>
			<ul class="alphabet">
				{#each group.rows as row}
					<li>
						<span class="alpha-char">{row.char}</span>
						<span class="mono alpha-bits">{row.binary}</span>
						<span class="mono alpha-dec">{row.value}</span>
					</li>
				{/each}
			</ul>
		{/each}
		<p class="reducer">
			A capital and its small letter differ in one bit, the one worth 32: {capitals[0].char} is
			<span class="mono">{capitals[0].binary}</span> and {smalls[0].char} is
			<span class="mono">{smalls[0].binary}</span>. The last five bits count through the alphabet, and a digit's last
			four bits are its value. Punctuation and control codes are in the <a href="/ascii-table">ASCII table</a>.
		</p>
	</section>

	<section id="utf-8">
		<h2>ASCII and UTF-8: why é is two bytes</h2>
		<p class="section-intro">
			ASCII has 128 characters, numbered 0 to 127, which fit in 7 bits. That covers English and nothing else. Unicode
			numbers over a million possible characters, so UTF-8 uses more bytes for bigger numbers, and marks the bytes so a
			reader always knows where a character starts.
		</p>
		<div class="table-scroll">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Bytes</th>
						<th scope="col">Code points</th>
						<th scope="col">Bits for the number</th>
						<th scope="col">Pattern</th>
					</tr>
				</thead>
				<tbody>
					{#each UTF8_RANGES as r}
						<tr>
							<td>{r.bytes}</td>
							<td class="mono nowrap">{rangeLabel(r.first)} to {rangeLabel(r.last)}</td>
							<td>{r.payloadBits}</td>
							<td class="mono nowrap">{r.pattern}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			The first bits of each byte are markers. A byte starting 0 is a whole character on its own, which is exactly
			ASCII, so any ASCII text is already valid UTF-8. A byte starting 110, 1110 or 11110 starts a character of two,
			three or four bytes, and each byte that follows starts 10. The x positions hold the code point's bits.
		</p>
		<div class="table-scroll">
			<table class="data-table breakdown">
				<thead>
					<tr>
						<th scope="col">Char</th>
						<th scope="col">Code point</th>
						<th scope="col">UTF-8 bytes in binary</th>
						<th scope="col">Hex</th>
					</tr>
				</thead>
				<tbody>
					{#each sizes as c}
						<tr>
							<td class="char">{c.char}</td>
							<td class="mono">{c.label}</td>
							<td class="mono bits">
								{#each c.bytes as b}
									<span class="byte"
										><span class="prefix">{b.prefix}</span><span class="payload">{b.payload}</span></span
									>
								{/each}
							</td>
							<td class="mono">{c.bytes.map((b) => b.hex).join(' ')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Marker bits in grey, the code point's bits in green. Joining the green bits of a row gives back the code point in
			binary. Some older systems used a single byte for é with a different code, which is why text sometimes shows up as
			"cafÃ©": its two UTF-8 bytes were read as two separate characters.
		</p>
	</section>

	<section id="place-values">
		<h2>Reading a byte with place values</h2>
		<p class="section-intro">
			Each bit of a byte has a weight, doubling from right to left: 1, 2, 4 up to 128. The byte's value is the sum of
			the weights where the bit is 1. Here is <span class="mono">{hi[0].bytes[0].binary}</span>, the letter H:
		</p>
		<div class="table-scroll">
			<table class="data-table places">
				<tbody>
					<tr>
						<th scope="row">Weight</th>
						{#each first.weights as w}<td class="mono">{w}</td>{/each}
					</tr>
					<tr>
						<th scope="row">Bit</th>
						{#each first.bits as bit}<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>{/each}
					</tr>
				</tbody>
			</table>
		</div>
		<p>
			The 1s sit under {first.terms.join(' and ')}, so the byte is {first.terms.join(' + ')} = {first.sum}, and
			character
			{first.sum} is {hi[0].char}. The <a href="/binary-converter">binary converter</a> does the same for any number,
			and the lesson on <a href="/learn/bytes-hex-and-width">bytes, hex and bit width</a> explains why a byte is 8 bits and
			how hex shortens it.
		</p>
	</section>

	<section id="by-hand">
		<h2>How to translate binary to text by hand</h2>
		<ol class="steps">
			<li><strong>Split the bits into bytes</strong> of 8, counting from the left.</li>
			<li><strong>Turn each byte into a number</strong> by adding the weights of its 1 bits.</li>
			<li>
				<strong>Look each number up</strong> in the <a href="/ascii-table">ASCII table</a>. A byte of 128 or more is
				part of a longer UTF-8 character; its first bits say how many bytes belong together.
			</li>
		</ol>
		<p class="section-intro">
			Here is <span class="mono">{handMessage}</span> worked that way:
		</p>
		<div class="table-scroll">
			<table class="data-table hand">
				<thead>
					<tr>
						<th scope="col">Byte</th>
						<th scope="col">Weights of the 1 bits</th>
						<th scope="col">Value</th>
						<th scope="col">Char</th>
					</tr>
				</thead>
				<tbody>
					{#each handRows as row}
						<tr>
							<td class="mono">{row.bits.join('')}</td>
							<td class="mono">{row.terms.join(' + ')}</td>
							<td class="mono">{row.sum}</td>
							<td class="char">{row.char}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The message reads "{handText}". A quicker way to spot letters: capitals are 010 followed by the letter's place in
			the alphabet in five bits, and small letters are 011 followed by the same. o is the 15th letter, so it is 011 and
			01111.
			<a
				href={toolLink('/binary-translator', { d: 'decode', t: handMessage })}
				on:click|preventDefault={() => tryExample(handMessage, 'decode')}>Load it into the translator</a
			>.
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
			Also on this site: the <a href="/ascii-table">ASCII table</a> with all 128 codes, and
			<a href="/base64">Base64 encoding</a>, the other common way to write bytes as text.
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

	.alpha-title {
		font-size: 1rem !important;
		margin: 1.2rem 0 0.5rem !important;
		color: #fff;
	}

	.alphabet {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 4px 10px;
	}

	.alphabet li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.2rem 0.5rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
	}

	.alpha-char {
		color: #fff;
		font: 700 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		min-width: 1ch;
	}

	.alpha-bits {
		color: #8ede8e;
		letter-spacing: 0.03em;
	}

	.alpha-dec {
		color: #bbb;
		font-size: 0.85rem;
		margin-left: auto;
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

	.breakdown-title {
		font-size: 1rem;
		margin: 1.2rem 0 0.5rem;
	}

	.table-scroll {
		overflow-x: auto;
		border-radius: 3px;
		margin-bottom: 0.4rem;
	}

	.breakdown td {
		vertical-align: top;
	}

	.char {
		color: #fff !important;
		font-size: 1.05rem;
		white-space: nowrap;
	}

	.bits {
		white-space: normal;
		min-width: 9ch;
	}

	.byte {
		display: inline-block;
		margin-right: 0.6ch;
		white-space: nowrap;
	}

	.prefix {
		color: #999;
	}

	.payload {
		color: #8ede8e;
	}

	.dim {
		color: #999;
	}

	.multi-note {
		font-size: 0.9rem;
		color: #ccc;
		margin: 0.6rem 0 0;
		overflow-wrap: anywhere;
	}

	.legend {
		display: block;
		color: #999;
		font-size: 0.8rem;
		margin-top: 0.2rem;
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

	.steps {
		padding-left: 1.25rem;
		color: #ddd;
		max-width: 660px;
	}

	.steps li {
		margin-bottom: 0.8rem;
	}

	.flow {
		padding: 0.8rem 1rem;
		display: inline-flex;
		flex-direction: column;
		gap: 0.3rem;
		max-width: 100%;
		box-sizing: border-box;
	}

	.flow-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.flow-char {
		font-size: 1.2rem;
		font-weight: 700;
		min-width: 1.2rem;
	}

	.arrow {
		color: #999;
	}

	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.nowrap {
		white-space: nowrap;
	}

	.places th {
		color: #fff;
	}

	.places td {
		text-align: center;
		padding-left: 0.6rem;
		padding-right: 0.6rem;
	}
</style>
