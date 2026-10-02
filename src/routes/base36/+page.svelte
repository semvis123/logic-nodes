<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { textToBytes } from '$lib/textEncoding';
	import {
		parseInBase,
		toBase,
		divisionSteps,
		placeValueSteps,
		bytesToBase36,
		base36ToBytes,
		bytesAsText,
		hexBytes,
		DIGITS36,
		MAX_NUMBER_DIGITS,
		MAX_TEXT_BYTES,
		BaseNError,
		type DivisionStep,
		type PlaceTerm
	} from '$lib/baseN';
	import { superscript } from '$lib/radix';
	import { readUrl, syncUrl, safeText, safeOption, safeInt, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import ErrorAt from '$lib/ErrorAt.svelte';
	import Num from '$lib/WorkingNumber.svelte';
	import { onMount } from 'svelte';

	type Mode = 'to36' | 'from36' | 'any' | 'text';
	const MODES = ['to36', 'from36', 'any', 'text'] as const;

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { m: 'to36', v: '1000000', from: 16, to: 36, d: 'encode', c: 'upper' };
	onMount(() => {
		const p = readUrl();
		mode = safeOption(p.m, MODES) ?? mode;
		// Text mode's own starting example, when a link names the mode but not the text.
		// Text up to MAX_TEXT_BYTES is never longer than that in characters; a little more
		// is let through so a link to a too-long text opens on its error, not on another text.
		input =
			safeText(p.v, mode === 'text' ? 2 * MAX_TEXT_BYTES : MAX_NUMBER_DIGITS + 20) ?? (mode === 'text' ? 'Hi' : input);
		anyFrom = safeInt(p.from, 2, 36) ?? anyFrom;
		anyTo = safeInt(p.to, 2, 36) ?? anyTo;
		direction = safeOption(p.d, ['encode', 'decode'] as const) ?? direction;
		letterCase = safeOption(p.c, ['upper', 'lower'] as const) ?? letterCase;
	});

	let mode: Mode = 'to36';
	let input = DEFAULTS.v;
	let anyFrom = DEFAULTS.from;
	let anyTo = DEFAULTS.to;
	let direction: 'encode' | 'decode' = 'encode';
	let letterCase: 'upper' | 'lower' = 'upper';
	$: syncUrl(
		{
			m: mode,
			v: input,
			from: mode === 'any' ? anyFrom : undefined,
			to: mode === 'any' ? anyTo : undefined,
			d: mode === 'text' ? direction : undefined,
			c: letterCase
		},
		// Text mode starts from its own example, so that is what a link may leave out.
		mode === 'text' ? { ...DEFAULTS, v: 'Hi' } : DEFAULTS
	);

	$: fromBase =
		mode === 'to36' ? 10 : mode === 'from36' ? 36 : mode === 'any' ? anyFrom : direction === 'encode' ? 0 : 36;
	$: toBaseN = mode === 'to36' ? 36 : mode === 'from36' ? 10 : mode === 'any' ? anyTo : direction === 'encode' ? 36 : 0;
	$: lower = letterCase === 'lower';
	/** The same value in the everyday bases, leaving out the two on screen; binary only while it is short. */
	$: alsoIn = [10, 16, 36, 2].filter((b) => b !== fromBase && b !== toBaseN && (b !== 2 || value < 1n << 64n));

	const MAX_ROWS = 80;
	/** A working table longer than this scrolls in its own box; a shorter one is shown whole. */
	const LONG_TABLE = 30;

	// Runs during prerendering too, so the served page shows a worked example.
	let value = 0n;
	let digits = '';
	let result = '';
	let error = '';
	let errorAt: number | undefined;
	let terms: PlaceTerm[] = [];
	let divisions: DivisionStep[] = [];
	let textBytes: number[] = [];
	let lostZeros = 0;
	let notText = false;
	$: {
		try {
			errorAt = undefined;
			notText = false;
			lostZeros = 0;
			textBytes = [];
			if (mode === 'text' && direction === 'encode') {
				if (!input) throw new BaseNError('Type some text first.');
				const r = bytesToBase36(textToBytes(input), lower);
				textBytes = r.bytes;
				lostZeros = r.leadingZeros;
				value = r.value;
				digits = '';
				result = r.digits;
				terms = [];
				divisions = divisionSteps(value, 36).steps;
			} else if (mode === 'text') {
				const r = base36ToBytes(input);
				textBytes = r.bytes;
				value = r.value;
				digits = r.digits.replace(/^0+(?=.)/, '');
				const read = bytesAsText(r.bytes);
				notText = !read.isText;
				result = read.isText ? read.text : hexBytes(r.bytes);
				terms = placeValueSteps(digits, 36).terms;
				divisions = [];
			} else {
				const parsed = parseInBase(input, fromBase);
				value = parsed.value;
				digits = parsed.digits.replace(/^0+(?=.)/, '');
				result = toBase(value, toBaseN, lower);
				terms = fromBase === 10 ? [] : placeValueSteps(digits, fromBase).terms;
				divisions = toBaseN === 10 ? [] : divisionSteps(value, toBaseN).steps;
			}
			error = '';
		} catch (e) {
			error = e instanceof BaseNError ? e.message : 'That could not be converted.';
			errorAt = e instanceof BaseNError ? e.position : undefined;
			value = 0n;
			textBytes = [];
			result = '';
			terms = [];
			divisions = [];
		}
	}

	const grouped = (n: bigint) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	/** A long number shortened to its ends, so a working table stays readable. */
	function big(n: bigint): string {
		const s = n.toString();
		if (s.length <= 30) return grouped(n);
		return `${s.slice(0, 8)}…${s.slice(-8)} (${s.length} digits)`;
	}
	const baseName = (b: number) =>
		b === 2 ? 'binary' : b === 8 ? 'octal' : b === 10 ? 'decimal' : b === 16 ? 'hex' : `base ${b}`;
	const show = (s: string) => (lower ? s.toLowerCase() : s);

	/** Switching between the two fixed directions carries the answer across. */
	function setMode(next: Mode) {
		if (next === mode) return;
		if (!error && result) {
			if ((mode === 'to36' && next === 'from36') || (mode === 'from36' && next === 'to36')) input = result;
			else if (next === 'any' && mode !== 'text') {
				anyFrom = fromBase;
				anyTo = toBaseN === anyFrom ? (anyFrom === 10 ? 36 : 10) : toBaseN;
			} else if (next === 'text') {
				input = 'Hi';
				direction = 'encode';
			} else if (next === 'any') {
				// From text, the number the text made, in decimal.
				input = value.toString();
				anyFrom = 10;
				anyTo = 36;
			} else if (mode === 'text' || mode === 'any')
				input = next === 'to36' ? value.toString() : toBase(value, 36, lower);
		} else if (next === 'text') {
			input = 'Hi';
			direction = 'encode';
		}
		mode = next;
	}

	function swapAny() {
		if (!error) input = result;
		[anyFrom, anyTo] = [anyTo, anyFrom];
	}

	function setDirection(next: 'encode' | 'decode') {
		if (next === direction) return;
		if (!error && result && !notText) input = result;
		direction = next;
	}

	type Example = { label: string; v: string; m: Mode; from?: number; to?: number; d?: 'encode' | 'decode' };
	const examples: Example[] = [
		{ label: '1,000,000', v: '1000000', m: 'to36' },
		{ label: '2³² − 1', v: '4294967295', m: 'to36' },
		{ label: 'ZZZZ', v: 'ZZZZ', m: 'from36' },
		{ label: 'HELLO', v: 'HELLO', m: 'from36' },
		{ label: 'FF hex to binary', v: 'FF', m: 'any', from: 16, to: 2 },
		{ label: 'DEADBEEF hex to base 36', v: 'DEADBEEF', m: 'any', from: 16, to: 36 }
	];
	// Text mode has its own: the examples above would each switch it off.
	const textExamples: Example[] = [
		{ label: 'Hi', v: 'Hi', m: 'text', d: 'encode' },
		{ label: 'Hello', v: 'Hello', m: 'text', d: 'encode' },
		{ label: 'café', v: 'café', m: 'text', d: 'encode' },
		{ label: 'An emoji', v: '🙂', m: 'text', d: 'encode' },
		{
			label: `Decode ${bytesToBase36(textToBytes('Hello')).digits}`,
			v: bytesToBase36(textToBytes('Hello')).digits,
			m: 'text',
			d: 'decode'
		},
		{ label: 'Decode ZZZZ', v: 'ZZZZ', m: 'text', d: 'decode' }
	];
	function tryExample(ex: Example) {
		mode = ex.m;
		input = ex.v;
		if (ex.from) anyFrom = ex.from;
		if (ex.to) anyTo = ex.to;
		if (ex.d) direction = ex.d;
		const field = document.getElementById('value');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		field?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	let copied: 'idle' | 'copied' | 'failed' = 'idle';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyResult() {
		try {
			await navigator.clipboard.writeText(result);
			copied = 'copied';
		} catch {
			copied = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = 'idle'), 2000);
	}

	const BASES = Array.from({ length: 35 }, (_, i) => i + 2);

	// Worked examples and tables, all from the engine.
	const digitCells = DIGITS36.split('').map((char, value) => ({ char, value }));
	const zz = placeValueSteps('ZZ', 36);
	const million = divisionSteps(1_000_000n, 36);
	const hello = parseInBase('HELLO', 36);
	const powers = Array.from({ length: 11 }, (_, n) => ({ n, value: 36n ** BigInt(n) }));
	const widths = [8, 16, 32, 53, 64, 128].map((bits) => {
		const max = (1n << BigInt(bits)) - 1n;
		return { bits, max, b36: toBase(max, 36), b10: max.toString().length, b16: toBase(max, 16).length };
	});
	const u64 = widths[4];
	const u128 = widths[5];
	const rounded = parseInt(u64.b36, 36);
	// What a JavaScript console prints, and the exact value of that double (2^64).
	const roundedText = String(rounded);
	const roundedExact = BigInt(rounded);
	const textHi = bytesToBase36(textToBytes('Hi'));

	const faqs = [
		{
			q: 'What is base 36?',
			a: 'A way of writing numbers with 36 digits: 0 to 9, then A to Z for 10 to 35. Each place is worth 36 times the one to its right. It is the largest base you can write with the ten digits and one case of the alphabet, which is why it is the highest base most programming languages accept.'
		},
		{
			q: 'How do I convert a number to base 36?',
			a: `Divide it by 36 and write down the remainder as a digit (10 is A, 35 is Z), then divide the quotient by 36 again, until the quotient is 0. The remainders read from the last to the first are the answer. 1,000,000 gives remainders ${million.steps
				.map((s) => s.remainder)
				.join(', ')}, which are ${million.steps.map((s) => s.digit).join(', ')}, so it is ${million.result}.`
		},
		{
			q: 'How do I convert base 36 to decimal?',
			a: `Multiply each digit's value by 36 to the power of its position, counting from 0 at the right, and add them up. ZZ is 35 × 36 + 35 × 1 = ${zz.total}, the largest two-digit base 36 number.`
		},
		{
			q: 'How do I convert base 36 in JavaScript or Python?',
			a: `In JavaScript, n.toString(36) writes a number in base 36 (in small letters) and parseInt(s, 36) reads one back, but only exactly up to 2^53 − 1, because parseInt rounds. For bigger values, write with a BigInt's toString(36), and read by looping over the digits: total = total × 36n + BigInt(digit value). BigInt() itself does not accept base 36. In Python, int(s, 36) reads base 36 at any size, but there is no built-in to write it, so you divide by 36 in a loop as this page shows.`
		},
		{
			q: 'Is base 36 case-sensitive?',
			a: 'No. A and a are both 10, so HELLO and hello are the same number. That makes base 36 safe for things that ignore case, such as file names on some systems, domain names and codes read aloud. Base 62, which adds the small letters as separate digits, is shorter but case-sensitive.'
		},
		{
			q: 'How many base 36 characters does a 64-bit number need?',
			a: `At most ${u64.b36.length}. The largest 64-bit value, ${grouped(u64.max)}, is ${u64.b36} in base 36, against ${
				u64.b16
			} hex digits and ${u64.b10} decimal digits. A 128-bit value such as a UUID needs up to ${u128.b36.length}.`
		}
	];

	const page = {
		title: 'Base 36 Converter: Decimal to Base 36 and Back, With Steps',
		description:
			'Convert decimal to base 36 and base 36 to decimal, or between any two bases from 2 to 36, with numbers of any size and every division step shown.',
		url: `${SITE}/base36`,
		image: `${SITE}/og/base36.png`,
		imageAlt: 'LogicGates.org: base 36 converter with steps'
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
					{ '@type': 'ListItem', position: 3, name: 'Base 36 converter' }
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
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/base32', label: 'Base32 encode and decode' },
		{ href: '/base58', label: 'Base58 and Base58Check' },
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Base 36 converter</h1>
		<p class="lede">
			Convert decimal to base 36 and back, or between any two bases from 2 to 36, for whole numbers of any size. Every
			conversion shows its working: repeated division one way, place values the other.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Conversion">
				<button
					type="button"
					class:active={mode === 'to36'}
					aria-pressed={mode === 'to36'}
					on:click={() => setMode('to36')}>Decimal to base 36</button
				>
				<button
					type="button"
					class:active={mode === 'from36'}
					aria-pressed={mode === 'from36'}
					on:click={() => setMode('from36')}>Base 36 to decimal</button
				>
				<button
					type="button"
					class:active={mode === 'any'}
					aria-pressed={mode === 'any'}
					on:click={() => setMode('any')}>Any base</button
				>
				<button
					type="button"
					class:active={mode === 'text'}
					aria-pressed={mode === 'text'}
					on:click={() => setMode('text')}>Text</button
				>
			</div>

			{#if mode === 'any'}
				<div class="bases">
					<label class="field inline" for="from-base">From</label>
					<select id="from-base" bind:value={anyFrom}>
						{#each BASES as b}<option value={b}
								>{baseName(b)}{b === 2 || b === 8 || b === 10 || b === 16 ? ` (${b})` : ''}</option
							>{/each}
					</select>
					<button type="button" class="swap" on:click={swapAny} aria-label="Swap the two bases">⇄</button>
					<label class="field inline" for="to-base">to</label>
					<select id="to-base" bind:value={anyTo}>
						{#each BASES as b}<option value={b}
								>{baseName(b)}{b === 2 || b === 8 || b === 10 || b === 16 ? ` (${b})` : ''}</option
							>{/each}
					</select>
				</div>
			{:else if mode === 'text'}
				<div class="opt text-dir" role="group" aria-label="Text direction">
					<span class="opt-label">Direction</span>
					<button
						type="button"
						class:active={direction === 'encode'}
						aria-pressed={direction === 'encode'}
						on:click={() => setDirection('encode')}>Text to base 36</button
					>
					<button
						type="button"
						class:active={direction === 'decode'}
						aria-pressed={direction === 'decode'}
						on:click={() => setDirection('decode')}>Base 36 to text</button
					>
				</div>
			{/if}

			<label class="field" for="value"
				>{mode === 'text' && direction === 'encode'
					? 'Text'
					: fromBase === 10
					? 'Decimal number'
					: fromBase === 36
					? 'Base 36 number'
					: `${baseName(fromBase)[0].toUpperCase()}${baseName(fromBase).slice(1)} number`}</label
			>
			<input
				id="value"
				class="value-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				inputmode={fromBase === 10 ? 'numeric' : 'text'}
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="value-help"
			/>
			<p class="field-help" id="value-help">
				{#if mode === 'text' && direction === 'encode'}
					The text's UTF-8 bytes, up to {MAX_TEXT_BYTES}, are read as one big number, which is then written in base 36.
				{:else if mode === 'text'}
					A base 36 number, up to {MAX_NUMBER_DIGITS} digits. Its bytes are read as UTF-8 text.
				{:else if fromBase === 10}
					A whole number of zero or more, up to {MAX_NUMBER_DIGITS} digits. Spaces and underscores are ignored.
				{:else}
					Digits {fromBase <= 10 ? `0 to ${fromBase - 1}` : `0 to 9 and A to ${DIGITS36[fromBase - 1]}`}, upper or lower
					case. Spaces and underscores are ignored.
				{/if}
			</p>

			<div class="chips">
				{#each mode === 'text' ? textExamples : examples as ex}
					<button type="button" class="chip-btn" on:click={() => tryExample(ex)}>{ex.label}</button>
				{/each}
			</div>

			{#if error}
				<ErrorAt message={error} {input} position={errorAt} />
			{:else}
				<div class="results">
					<div class="answer" role="status">
						<span class="answer-head">
							<span class="answer-label"
								>{mode === 'text' && direction === 'decode'
									? notText
										? 'Bytes, in hex'
										: 'Text'
									: toBaseN === 10
									? 'Decimal'
									: toBaseN === 36
									? 'Base 36'
									: baseName(toBaseN)}</span
							>
							<span class="copy-wrap">
								<button type="button" class="copy" on:click={copyResult} disabled={!result}>Copy</button>
								<span class="copied" aria-live="polite"
									>{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Select it and copy' : ''}</span
								>
							</span>
						</span>
						<span class="answer-value mono">{toBaseN === 10 ? grouped(value) : result || '–'}</span>
						{#if mode === 'text' && direction === 'encode'}
							<span class="answer-also"
								>{textBytes.length} byte{textBytes.length === 1 ? '' : 's'}, {result.length} base 36 digit{result.length ===
								1
									? ''
									: 's'}</span
							>
						{:else if mode === 'text'}
							<span class="answer-also">From the bytes <span class="mono">{hexBytes(textBytes) || 'none'}</span></span>
						{:else}
							<span class="answer-also">
								{#each alsoIn as b, i}{i ? ', ' : 'Also '}<span class="mono"
										>{b === 10 ? grouped(value) : toBase(value, b, lower)}</span
									>
									in {baseName(b)}{/each}{alsoIn.length ? '.' : ''}
							</span>
						{/if}
					</div>
					{#if lostZeros}
						<p class="note">
							The text starts with {lostZeros} zero byte{lostZeros === 1 ? '' : 's'}, which a number cannot keep:
							decoding gives the text without {lostZeros === 1 ? 'it' : 'them'}. <a href="/base58">Base58</a> solves this
							by writing each one as a 1.
						</p>
					{/if}

					{#if mode === 'text' && direction === 'encode'}
						<h2 class="working-title">Working: the bytes as one number</h2>
						<p class="equation">
							The UTF-8 bytes <span class="mono wrap">{hexBytes(textBytes)}</span> read as one hexadecimal number are
							<span class="mono wrap">{big(value)}</span> in decimal. Then divide by 36:
						</p>
					{/if}

					{#if terms.length}
						<h2 class="working-title">
							Working: each digit times its place value in {baseName(mode === 'text' ? 36 : fromBase)}
						</h2>
						<div class="table-wrap" class:scroll-box={terms.length > LONG_TABLE}>
							<table class="data-table steps">
								<thead>
									<tr>
										<th scope="col">Digit</th>
										<th scope="col" class="num">Value</th>
										<th scope="col" class="wide-only">Place</th>
										<th scope="col" class="num">Place value</th>
										<th scope="col" class="num">Digit × place</th>
									</tr>
								</thead>
								<tbody>
									{#each terms.slice(0, MAX_ROWS) as term}
										<tr>
											<td class="mono strong">{show(term.digit)}</td>
											<td class="mono num">{term.value}</td>
											<td class="mono wide-only">{mode === 'text' ? 36 : fromBase}{superscript(term.power)}</td>
											<td class="mono num"><Num value={term.place} {big} /></td>
											<td class="mono num"><Num value={term.product} {big} /></td>
										</tr>
									{/each}
									<tr class="total">
										<th scope="row" colspan="3">Sum</th>
										<td class="wide-only" />
										<td class="mono num strong"><Num {value} {big} /></td>
									</tr>
								</tbody>
							</table>
						</div>
						{#if terms.length > MAX_ROWS}
							<p class="note">Showing the first {MAX_ROWS} of {terms.length} digits.</p>
						{/if}
						{#if mode === 'text'}
							<p class="equation">
								{big(value)} written as bytes is
								<span class="mono wrap">{hexBytes(textBytes) || 'nothing'}</span>{notText
									? ', which is not readable UTF-8 text, so it is shown in hex'
									: `, which is the UTF-8 for "${result}"`}.
							</p>
						{/if}
					{/if}

					{#if divisions.length}
						<h2 class="working-title">Working: divide by {toBaseN}, keep the remainders</h2>
						<div class="table-wrap" class:scroll-box={divisions.length > LONG_TABLE}>
							<table class="data-table steps">
								<thead>
									<tr>
										<th scope="col" class="num">Number</th>
										<th scope="col" class="num wide-only">÷ {toBaseN}</th>
										<th scope="col" class="num">Remainder</th>
										<th scope="col">Digit</th>
									</tr>
								</thead>
								<tbody>
									{#each divisions.slice(0, MAX_ROWS) as step}
										<tr>
											<td class="mono num"><Num value={step.dividend} {big} /></td>
											<td class="mono num wide-only"><Num value={step.quotient} {big} /></td>
											<td class="mono num">{step.remainder}</td>
											<td class="mono strong">{show(step.digit)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if divisions.length > MAX_ROWS}
							<p class="note">Showing the first {MAX_ROWS} of {divisions.length} divisions.</p>
						{/if}
						<p class="equation">
							Read the digits from the bottom up: <span class="mono strong wrap">{result}</span>. The first remainder is
							the last digit, because it is what is left after taking out every whole {toBaseN}.
						</p>
					{/if}
				</div>
			{/if}

			<div class="export">
				<div class="opt" role="group" aria-label="Letter case">
					<span class="opt-label">Letters</span>
					<button
						type="button"
						class:active={letterCase === 'upper'}
						aria-pressed={letterCase === 'upper'}
						on:click={() => (letterCase = 'upper')}>ABC</button
					>
					<button
						type="button"
						class:active={letterCase === 'lower'}
						aria-pressed={letterCase === 'lower'}
						on:click={() => (letterCase = 'lower')}>abc</button
					>
				</div>
				<ShareLink what="the number and settings" />
			</div>
		</div>
	</section>

	<section id="digits">
		<h2>The 36 digits</h2>
		<p class="section-intro">
			Base 36 uses the ten decimal digits and then the alphabet: A is 10, Z is 35. Small and capital letters are the
			same digit.
		</p>
		<div class="digit-grid">
			{#each digitCells as cell}
				<div class="digit">
					<span class="dchar">{cell.char}</span>
					<span class="dnum">{cell.value}</span>
				</div>
			{/each}
		</div>
	</section>

	<section id="examples">
		<h2>Worked examples</h2>
		<div class="worked-grid">
			<div class="card worked">
				<h3>1,000,000 to base 36</h3>
				<p class="mono small">
					{#each million.steps as s}
						{grouped(s.dividend)} ÷ 36 = {grouped(s.quotient)} r {s.remainder} → {s.digit}<br />
					{/each}
				</p>
				<p class="small">Read upwards: <strong class="mono">{million.result}</strong>.</p>
			</div>
			<div class="card worked">
				<h3>HELLO to decimal</h3>
				<p class="mono small">
					{#each placeValueSteps('HELLO', 36).terms as t}
						{t.digit} = {t.value} × 36{superscript(t.power)} = {grouped(t.product)}<br />
					{/each}
				</p>
				<p class="small">
					Sum: <strong class="mono">{grouped(hello.value)}</strong>. Any word is a base 36 number.
				</p>
			</div>
			<div class="card worked">
				<h3>"Hi" as a number</h3>
				<p class="small">
					The bytes {hexBytes(textHi.bytes)} are the number 0x4869 = {grouped(textHi.value)}, which is
					<strong class="mono">{textHi.digits}</strong> in base 36.
					<a href={toolLink('/base36', { m: 'text', v: 'Hi' })} on:click|preventDefault={() => setMode('text')}
						>Try it with your own text</a
					>.
				</p>
			</div>
		</div>
	</section>

	<section id="powers">
		<h2>Powers of 36</h2>
		<p class="section-intro">
			Each place is worth 36 times the one to its right. A digit's value times its place, added up, gives the number.
		</p>
		<div class="table-wrap">
			<table class="data-table powers">
				<thead>
					<tr><th scope="col">Power</th><th scope="col" class="num">Value</th><th scope="col">In base 36</th></tr>
				</thead>
				<tbody>
					{#each powers as p}
						<tr>
							<td class="mono">36{superscript(p.n)}</td>
							<td class="mono num">{grouped(p.value)}</td>
							<td class="mono">1{'0'.repeat(p.n)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="widths">
		<h2>How long a number is in base 36</h2>
		<p class="section-intro">
			A base 36 digit carries log<sub>2</sub> 36 ≈ 5.17 bits, a little more than the 5 bits of a
			<a href="/base32">Base32</a> character, so base 36 is the shortest way to write a number with digits and one case of
			letters. The largest unsigned value of each common width:
		</p>
		<div class="table-wrap">
			<table class="data-table widths">
				<thead>
					<tr>
						<th scope="col" class="num">Bits</th>
						<th scope="col">Largest value in base 36</th>
						<th scope="col" class="num">Base 36 digits</th>
						<th scope="col" class="num">Hex digits</th>
						<th scope="col" class="num">Decimal digits</th>
					</tr>
				</thead>
				<tbody>
					{#each widths as w}
						<tr>
							<td class="mono num">{w.bits}</td>
							<td class="mono strong">{w.b36}</td>
							<td class="mono num">{w.b36.length}</td>
							<td class="mono num">{w.b16}</td>
							<td class="mono num">{w.b10}</td>
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
				<strong>Reading the remainders top to bottom.</strong> The first remainder is the last digit. 1,000,000 gives
				{million.steps.map((s) => s.digit).join(', ')} in that order, and the answer is {million.result}.
			</li>
			<li>
				<strong>Trusting parseInt with big numbers.</strong> JavaScript's numbers are exact only up to 2<sup>53</sup>.
				parseInt('{u64.b36.toLowerCase()}', 36) gives {roundedText}, which is exactly {roundedExact === 1n << 64n
					? '2⁶⁴'
					: roundedExact}, {roundedExact - u64.max === 1n ? 'one more than' : 'not'} the real value, {u64.max}. Read
				long values digit by digit into a BigInt, as this converter does.
			</li>
			<li>
				<strong>Mixing up the letter O and the digit 0.</strong> In base 36 both are digits, O worth 24 and 0 worth
				nothing, and so are I (18) and 1. Where people type the codes, an alphabet that leaves the look-alikes out, such
				as
				<a href="/base32">Crockford Base32</a> or <a href="/base58">Base58</a>, is safer.
			</li>
			<li>
				<strong>Expecting text to keep leading zero bytes.</strong> Text read as a number loses any zero bytes at the start,
				just as 007 is 7.
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
			For the bases programmers use most, see the <a href="/hex-to-decimal">hex to decimal converter</a> and the
			<a href="/binary-converter">binary converter</a>.
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
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.9rem;
	}

	.direction button {
		flex: 1 1 auto;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
		padding: 0.45rem 0.7rem;
		cursor: pointer;
	}

	.direction button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
		font-weight: 600;
	}

	.bases {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	.bases select {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 0.9rem;
		padding: 0.3rem 0.4rem;
	}

	.swap {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 1rem;
		padding: 0.15rem 0.55rem;
		cursor: pointer;
	}

	.text-dir {
		margin-bottom: 0.9rem;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.field.inline {
		margin: 0;
	}

	.value-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.value-input:focus {
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
	}

	.answer {
		display: block;
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
	}

	.answer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.answer-label {
		color: #999;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-value {
		color: #8ede8e !important;
		display: block;
		font-size: 1.6rem;
		overflow-wrap: anywhere;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
		overflow-wrap: anywhere;
	}

	.copy-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-direction: row-reverse;
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
		margin: 0.5rem 0 0;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.1rem !important;
	}

	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}

	.data-table.steps td,
	.data-table.steps th {
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

	.data-table.steps tr.total th,
	.data-table.steps tr.total td {
		border-top: 2px solid rgba(255, 255, 255, 0.4);
		color: #fff;
	}

	.equation {
		color: #ccc;
		font-size: 0.92rem;
		margin: 0.7rem 0 0;
		overflow-wrap: anywhere;
	}

	.wrap {
		overflow-wrap: anywhere;
	}

	.export {
		display: flex;
		align-items: center;
		gap: 0.8rem 1.1rem;
		flex-wrap: wrap;
		margin-top: 1rem;
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

	.digit-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.4rem, 1fr));
		gap: 4px;
	}

	.digit {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.25rem 0.45rem;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.dchar {
		font-size: 1.15rem;
		font-weight: 700;
		color: #fff;
	}

	.dnum {
		color: #bbb;
		font-size: 0.8rem;
	}

	.worked-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
	}

	.worked {
		padding: 0.9rem 1rem;
	}

	.worked h3 {
		color: #fff;
	}

	.small {
		font-size: 0.86rem;
		margin: 0.4rem 0 0;
		overflow-wrap: anywhere;
	}

	.worked strong {
		color: #8ede8e;
	}

	@media (max-width: 560px) {
		.data-table.steps td,
		.data-table.steps th {
			padding-left: 0.4rem;
			padding-right: 0.4rem;
			font-size: 0.85rem;
		}
	}

	/* The power is already in the place value, and each quotient is the next row's
	   number, so a phone can do without those columns. */
	@media (max-width: 480px) {
		.wide-only {
			display: none;
		}
	}

	.widths td {
		white-space: nowrap;
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
</style>
