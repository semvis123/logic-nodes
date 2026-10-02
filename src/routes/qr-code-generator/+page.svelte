<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		encodeQr,
		capacity,
		dataCodewords,
		alignmentPositions,
		symbolSize,
		smallestVersion,
		hexByte,
		runsPath,
		formatBits,
		MASKS,
		EC_LEVELS,
		EC_INFO,
		MAX_VERSION,
		QrError,
		type EcLevel,
		type QrCode
	} from '$lib/qr';
	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import Anatomy from './Anatomy.svelte';
	import Steps from './Steps.svelte';
	import { onMount } from 'svelte';

	const MAX_TEXT = 7089;
	const versionOptions = ['auto', ...Array.from({ length: MAX_VERSION }, (_, i) => String(i + 1))] as const;
	const maskOptions = ['auto', '0', '1', '2', '3', '4', '5', '6', '7'] as const;
	type VersionOption = typeof versionOptions[number];
	type MaskOption = typeof maskOptions[number];

	// Every setting lives in the query string, so a link reopens this exact code.
	const DEFAULTS = { t: 'HELLO WORLD', ec: 'Q', v: 'auto', m: 'auto' };
	onMount(() => {
		const p = readUrl();
		text = safeText(p.t, MAX_TEXT) ?? text;
		ec = safeOption(p.ec, EC_LEVELS) ?? ec;
		version = safeOption(p.v, versionOptions) ?? version;
		mask = safeOption(p.m, maskOptions) ?? mask;
	});

	let text = DEFAULTS.t;
	let ec: EcLevel = 'Q';
	let version: VersionOption = 'auto';
	let mask: MaskOption = 'auto';
	$: syncUrl({ t: text, ec, v: version, m: mask }, DEFAULTS);

	// Runs at build time too, so the served page shows a finished, worked code.
	// On a bad input the last good code stays on screen, dimmed, under the message.
	let qr: QrCode = encodeQr(DEFAULTS.t, { ec: 'Q' });
	let error = '';
	$: {
		if (!text) error = 'Type some text or a link to encode.';
		else
			try {
				qr = encodeQr(text, {
					ec,
					version: version === 'auto' ? 'auto' : Number(version),
					mask: mask === 'auto' ? 'auto' : Number(mask)
				});
				error = '';
			} catch (e) {
				error = e instanceof QrError ? e.message : 'That could not be encoded.';
			}
	}
	$: minVersion = text ? smallestVersion(text, ec) : 1;
	$: modeName = { numeric: 'numeric', alphanumeric: 'alphanumeric', byte: 'byte' }[qr.mode];
	$: lowest = Math.min(...qr.penalties.map((p) => p.total));
	$: lowerCaseHint =
		qr.mode === 'byte' && /[a-z]/.test(text) && /^[0-9A-Za-z $%*+\-./:]*$/.test(text)
			? smallestVersion(text.toUpperCase(), ec)
			: 0;

	function tryExample(t: string, level: EcLevel, v: VersionOption = 'auto') {
		text = t;
		ec = level;
		version = v;
		mask = 'auto';
		const field = document.getElementById('qr-text');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; text: string; ec: EcLevel; v?: VersionOption }[] = [
		{ label: 'HELLO WORLD', text: 'HELLO WORLD', ec: 'Q' },
		{ label: 'A link', text: 'https://logicgates.org/qr-code-generator', ec: 'M' },
		{ label: 'Digits only', text: '31415926535897932384', ec: 'M' },
		{ label: 'Wi-Fi login', text: 'WIFI:T:WPA;S:Cafe Guest;P:espresso42;;', ec: 'M' },
		{ label: 'café ☕ (UTF-8)', text: 'café ☕', ec: 'L' },
		{ label: 'Version 7', text: 'VERSION INFORMATION', ec: 'H', v: '7' }
	];

	// --- Reference content, all from the engine. --------------------------------

	const hw = encodeQr('HELLO WORLD', { ec: 'Q' });
	const link = 'https://logicgates.org';
	const linkUpper = link.toUpperCase();
	// Level Q is where the saving shows up as a smaller version for this link.
	const linkLower = encodeQr(link, { ec: 'Q' });
	const linkCaps = encodeQr(linkUpper, { ec: 'Q' });
	const levelRows = EC_LEVELS.map((level) => ({
		level,
		recovery: EC_INFO[level].recovery,
		bits: EC_INFO[level].bits.toString(2).padStart(2, '0'),
		v1: dataCodewords(1, level),
		bytes1: capacity(1, level, 'byte'),
		bytes10: capacity(10, level, 'byte'),
		linkVersion: smallestVersion(link + '/qr-code-generator', level)
	}));
	const capacityRows = Array.from({ length: MAX_VERSION }, (_, i) => {
		const v = i + 1;
		return {
			v,
			size: symbolSize(v),
			align: Math.max(0, alignmentPositions(v).length ** 2 - 3),
			bytes: EC_LEVELS.map((level) => capacity(v, level, 'byte')),
			digits: capacity(v, 'M', 'numeric'),
			alnum: capacity(v, 'M', 'alphanumeric')
		};
	});
	const PREVIEW = 12;
	const maskRows = MASKS.map((m, k) => ({
		k,
		formula: m.formula,
		path: runsPath(PREVIEW, (x, y) => m.test(x, y)),
		format: formatBits('M', k).toString(2).padStart(15, '0')
	}));
	const v40 = capacityRows[MAX_VERSION - 1];
	const fmt = (n: number) => n.toLocaleString('en-GB');

	const faqs = [
		{
			q: 'What are the three big squares in a QR code?',
			a: 'Finder patterns. Each is a 7 × 7 square of a dark ring, a light ring and a dark 3 × 3 centre, so a line through it in any direction crosses dark, light, dark, light and dark in the ratio 1:1:3:1:1. A scanner looks for that ratio to find the code and works out its angle from where the three squares sit; the corner without one is the bottom right.'
		},
		{
			q: 'Which error correction level should I use?',
			a: `Level M, which can restore about 15% of the codewords, suits most printed codes. Use L (about 7%) to keep a long link small on a clean screen, and Q (25%) or H (30%) for codes that get scratched or have a logo over them. More correction means a bigger symbol: ${link}/qr-code-generator needs version ${levelRows[0].linkVersion} at L and version ${levelRows[3].linkVersion} at H.`
		},
		{
			q: 'Why does lower case text make a bigger QR code?',
			a: `Alphanumeric mode, at 5.5 bits a character, only has the capitals, the digits, space and $ % * + - . / :. One lower case letter sends the whole text to byte mode, at 8 bits a character. ${link} is ${linkLower.fields[2].bits.length} bits of data in byte mode; ${linkUpper} is ${linkCaps.fields[2].bits.length} bits in alphanumeric mode, and domain names are not case sensitive.`
		},
		{
			q: 'Why does another generator make a different pattern for the same text?',
			a: 'The text can be encoded in more than one valid way. Generators differ in which version and error correction level they pick, whether they mix modes, and how they score the eight masks, so the modules differ while the content is the same. Any scanner reads them all, because the format information in the code says which level and mask were used.'
		},
		{
			q: 'Do QR codes expire?',
			a: 'No. A QR code is just the text or link drawn as modules, so it works for as long as the print survives and, for a link, the page exists. Codes sold as "dynamic" hold a link to a redirect service, and those stop working if that service is switched off. The codes made here are static: nothing is stored or tracked.'
		},
		{
			q: 'What is the most a QR code can hold?',
			a: `Version 40 at level L, ${v40.size} × ${v40.size} modules, holds ${fmt(
				capacity(40, 'L', 'numeric')
			)} digits, ${fmt(capacity(40, 'L', 'alphanumeric'))} alphanumeric characters or ${fmt(
				capacity(40, 'L', 'byte')
			)} bytes. Codes that big are hard to scan from a phone, so links are usually kept short.`
		}
	];

	const page = {
		title: 'QR Code Generator That Shows How Every Module Is Built',
		description:
			'Make a QR code and see how it is built: mode and bit stream, Reed–Solomon error correction, masking and every module labelled, with SVG and PNG download.',
		url: `${SITE}/qr-code-generator`,
		image: `${SITE}/og/qr-code-generator.png`,
		imageAlt: 'LogicGates.org: QR code generator with the anatomy of the code'
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
					{ '@type': 'ListItem', position: 3, name: 'QR code generator' }
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
		{ href: '/ean-13-barcode-generator', label: 'EAN-13 barcode generator' },
		{ href: '/binary-translator', label: 'Binary translator' },
		{ href: '/base64', label: 'Base64 encode and decode' },
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>QR code generator</h1>
		<p class="lede">
			Type text or a link to make a QR code, then take it apart: every module is coloured by what it does, from the
			finder patterns to the error correction, and each step of the encoding is written out below.
		</p>

		<div class="card tool">
			<label class="field" for="qr-text">Text or link</label>
			<textarea
				id="qr-text"
				class="text-input"
				rows="2"
				bind:value={text}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				maxlength={MAX_TEXT}
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="qr-text-help"
			/>
			<p class="field-help" id="qr-text-help">
				Digits alone use numeric mode; capitals, digits, space and $ % * + - . / : use alphanumeric mode; anything else
				uses byte mode, as UTF-8.
			</p>

			<div class="options">
				<div class="opt" role="group" aria-label="Error correction level">
					<span class="opt-label">Error correction</span>
					{#each EC_LEVELS as level}
						<button
							type="button"
							class:active={ec === level}
							aria-pressed={ec === level}
							title="Restores about {EC_INFO[level].recovery}% of codewords"
							on:click={() => (ec = level)}>{level} <span class="pct">{EC_INFO[level].recovery}%</span></button
						>
					{/each}
				</div>
				<div class="opt">
					<label class="opt-label" for="qr-version">Version</label>
					<select id="qr-version" bind:value={version}>
						{#each versionOptions as v}
							<option value={v} disabled={v !== 'auto' && Number(v) < minVersion}
								>{v === 'auto'
									? `Smallest (${minVersion || '–'})`
									: `${v} (${symbolSize(Number(v))}×${symbolSize(Number(v))})`}</option
							>
						{/each}
					</select>
				</div>
				<div class="opt">
					<label class="opt-label" for="qr-mask">Mask</label>
					<select id="qr-mask" bind:value={mask}>
						{#each maskOptions as m}
							<option value={m}>{m === 'auto' ? 'Lowest penalty' : m}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryExample(example.text, example.ec, example.v)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-value"
						>Version {qr.version}, {qr.size} × {qr.size} modules, level {qr.ec}, mask {qr.mask}</span
					>
					<span class="answer-also">
						{qr.count}
						{qr.mode === 'byte' ? `byte${qr.count === 1 ? '' : 's'}` : `character${qr.count === 1 ? '' : 's'}`} in {modeName}
						mode: {qr.dataCodewords.length} data codewords and {qr.sequence.length - qr.dataCodewords.length} error correction
						codewords{qr.blocks.length > 1 ? ` in ${qr.blocks.length} blocks` : ''}.
						{#if qr.version > qr.minVersion}Version {qr.minVersion} would have been enough.{/if}
					</span>
					{#if lowerCaseHint && lowerCaseHint < qr.version}
						<span class="answer-also hint">
							In capitals it would fit alphanumeric mode and version {lowerCaseHint}.
						</span>
					{/if}
				</div>

				<Anatomy {qr} />

				<h2 class="working-title" id="mask-scores">Mask scores</h2>
				<p class="note">
					Each mask is tried and scored with the four penalty rules; the lowest total wins. Lower means fewer patterns
					that could confuse a scanner.
				</p>
				<!-- Positioned, so the hidden column heading cannot escape the scroll box and widen the page. -->
				<div class="table-wrap pen-wrap">
					<table class="data-table penalties">
						<thead>
							<tr>
								<th scope="col">Mask</th>
								<th scope="col" class="num">Runs</th>
								<th scope="col" class="num">2×2 boxes</th>
								<th scope="col" class="num">Finder-like</th>
								<th scope="col" class="num">Balance</th>
								<th scope="col" class="num">Total</th>
								<th scope="col"><span class="visually-hidden">Use</span></th>
							</tr>
						</thead>
						<tbody>
							{#each qr.penalties as p}
								<tr class:chosen={p.mask === qr.mask}>
									<th scope="row" class="mono"
										>{p.mask}{#if p.mask === qr.mask}<span class="tag">{mask === 'auto' ? 'chosen' : 'set'}</span
											>{/if}</th
									>
									<td class="mono num">{p.runs}</td>
									<td class="mono num">{p.boxes}</td>
									<td class="mono num">{p.finders}</td>
									<td class="mono num">{p.balance}</td>
									<td class="mono num total" class:best={p.total === lowest}>{p.total}</td>
									<td>
										{#if p.mask !== qr.mask}
											<button type="button" class="use-btn" on:click={() => (mask = maskOptions[p.mask + 1])}
												>Use mask {p.mask}</button
											>
										{:else if mask !== 'auto'}
											<button type="button" class="use-btn" on:click={() => (mask = 'auto')}>Back to auto</button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
			<p class="share-row"><ShareLink what="this code" /></p>
		</div>
	</section>

	<section id="steps">
		<h2>How this code was built, step by step</h2>
		<p class="section-intro">
			The code above, from text to modules. Change the text or the settings and these steps follow.
		</p>
		<div class:stale={!!error}>
			<Steps {qr} />
		</div>
	</section>

	<section id="anatomy">
		<h2>The parts of a QR code</h2>
		<p class="section-intro">
			A QR code is a square of modules, 21 × 21 at version 1 and 4 more each way per version, up to {v40.size} × {v40.size}
			at version 40. Some modules are fixed patterns a scanner uses to find and read the code; the rest carry the data and
			its error correction.
		</p>
		<div class="table-wrap">
			<table class="data-table parts">
				<thead>
					<tr><th scope="col">Part</th><th scope="col">Where and what</th><th scope="col">Why it is there</th></tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Finder patterns</th>
						<td>Three 7 × 7 squares in the corners</td>
						<td>Their 1:1:3:1:1 ratio is easy to spot at any angle; the missing fourth corner gives the orientation.</td
						>
					</tr>
					<tr>
						<th scope="row">Separators</th>
						<td>A light border one module wide round each finder</td>
						<td>Keeps the finder pattern apart from the data next to it.</td>
					</tr>
					<tr>
						<th scope="row">Timing patterns</th>
						<td>Alternating modules along row 6 and column 6, between the finders</td>
						<td>Let the scanner count the columns and rows, and so work out the version and the module size.</td>
					</tr>
					<tr>
						<th scope="row">Alignment patterns</th>
						<td
							>5 × 5 squares from version 2 on: one at version 2, {capacityRows[6].align} at version 7, {v40.align}
							at version 40</td
						>
						<td>Reference points that let a scanner correct for a curved or tilted code.</td>
					</tr>
					<tr>
						<th scope="row">Dark module</th>
						<td>One module beside the lower left finder, always dark</td>
						<td>Fixed by the standard; it is never part of the data.</td>
					</tr>
					<tr>
						<th scope="row">Format information</th>
						<td>15 bits, twice: round the top left finder, and split between the other two</td>
						<td>
							The error correction level and the mask number, protected by a BCH code. Two copies, so one can be
							damaged.
						</td>
					</tr>
					<tr>
						<th scope="row">Version information</th>
						<td>18 bits, twice, in 6 × 3 blocks by the top right and lower left finders, from version 7</td>
						<td>The version number, BCH protected, since counting the timing modules gets unreliable in large codes.</td
						>
					</tr>
					<tr>
						<th scope="row">Data and error correction</th>
						<td>Everything else, in 8-module codewords</td>
						<td>The message and the Reed–Solomon codewords that can rebuild damaged parts of it.</td>
					</tr>
					<tr>
						<th scope="row">Remainder bits</th>
						<td>0, 3, 4 or 7 modules left after the last codeword, depending on the version</td>
						<td>Filler; they are set to 0 before masking.</td>
					</tr>
					<tr>
						<th scope="row">Quiet zone</th>
						<td>A light margin 4 modules wide on every side</td>
						<td>Separates the code from whatever is printed round it. Without it many scanners fail.</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section id="encoding">
		<h2>Worked example: HELLO WORLD</h2>
		<p class="section-intro">
			The usual first example, at version 1 and level Q, which leaves {dataCodewords(1, 'Q')}
			data codewords and {hw.blocks[0].ec.length} for error correction.
		</p>
		<ol class="worked">
			<li>
				Every character is in the alphanumeric set, so the mode indicator is <span class="mono"
					>{hw.fields[0].bits}</span
				>, and 11 characters in 9 bits is <span class="mono">{hw.fields[1].bits}</span>.
			</li>
			<li>
				Pairs of characters become 11-bit numbers, 45 × first + second, using the value of each character in the
				alphanumeric set (0–9 are 0–9, A is 10, space is 36):
				<span class="pairs">
					{#each hw.groups as g}
						<span class="pair"
							><span class="mono strong">{g.chars.replace(/ /g, '␣')}</span>
							<span class="mono">{g.value}</span>
							<span class="mono dim">{g.bits}</span></span
						>
					{/each}
				</span>
				D is on its own at the end, so it takes 6 bits.
			</li>
			<li>
				That is {hw.fields.slice(0, 3).reduce((n, f) => n + f.bits.length, 0)} bits. {hw.fields[3].bits.length} terminator
				zeros, {hw.fields[4].bits.length} more to finish the byte, and {hw.padCount} pad bytes make the
				{hw.dataCodewords.length} data codewords:
				<span class="mono hex-line">{hw.dataCodewords.map(hexByte).join(' ')}</span>
			</li>
			<li>
				Reed–Solomon over GF(256) gives the {hw.blocks[0].ec.length} error correction codewords:
				<span class="mono hex-line ec">{hw.blocks[0].ec.map(hexByte).join(' ')}</span>
			</li>
			<li>
				The {hw.sequence.length} codewords fill the {hw.sequence.length * 8} free modules exactly; version 1 has no remainder
				bits. Mask {hw.mask} scores lowest, and the format information for level Q and mask {hw.mask} is
				<span class="mono">{hw.formatBits.toString(2).padStart(15, '0')}</span>.
			</li>
		</ol>
		<p class="reducer">
			<a
				href={toolLink('/qr-code-generator', { t: 'HELLO WORLD' })}
				on:click|preventDefault={() => tryExample('HELLO WORLD', 'Q')}>Open HELLO WORLD in the generator</a
			>. The codewords are bytes like any other; the <a href="/hex-to-binary">hex to binary converter</a> turns them back
			into the bits in the modules.
		</p>
	</section>

	<section id="levels">
		<h2>Error correction levels</h2>
		<p class="section-intro">
			Reed–Solomon codewords are added to every block. A scanner can rebuild damaged codewords from them, up to the
			share each level is designed for. The cost is room for data.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Level</th>
						<th scope="col" class="num">Restores about</th>
						<th scope="col">Format bits</th>
						<th scope="col" class="num">Data codewords, v1</th>
						<th scope="col" class="num">Bytes, v1</th>
						<th scope="col" class="num">Bytes, v10</th>
					</tr>
				</thead>
				<tbody>
					{#each levelRows as row}
						<tr>
							<th scope="row" class="mono">{row.level}</th>
							<td class="num">{row.recovery}%</td>
							<td class="mono">{row.bits}</td>
							<td class="mono num">{row.v1}</td>
							<td class="mono num">{row.bytes1}</td>
							<td class="mono num">{row.bytes10}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The format bits are not in alphabetical order: the standard numbers the levels M = 00, L = 01, H = 10, Q = 11.
		</p>
	</section>

	<section id="masks">
		<h2>The eight masks</h2>
		<p class="section-intro">
			Data can come out in stripes or blotches, or contain something that looks like a finder pattern. So the data and
			error correction modules are XORed with one of eight fixed patterns, flipping the modules where the pattern is
			dark, and the pattern that leaves the fewest problems is kept. Row and column count from 0 at the top left.
		</p>
		<div class="mask-grid">
			{#each maskRows as m}
				<figure class="mask-card">
					<svg viewBox="0 0 {PREVIEW} {PREVIEW}" class="mask-preview" aria-hidden="true" shape-rendering="crispEdges">
						<rect width={PREVIEW} height={PREVIEW} fill="#fff" />
						<path d={m.path} fill="#111" />
					</svg>
					<figcaption>
						<strong>Mask {m.k}</strong>
						<span class="mono formula">{m.formula}</span>
					</figcaption>
				</figure>
			{/each}
		</div>
		<p>The penalty rules, from ISO/IEC 18004:</p>
		<ul class="points">
			<li>
				<strong>Runs.</strong> Five or more modules of one colour in a row or column score 3, plus 1 for each module past
				five.
			</li>
			<li><strong>Boxes.</strong> Each 2 × 2 block of one colour scores 3. Blocks can overlap.</li>
			<li>
				<strong>Finder-like patterns.</strong> Dark, light, dark, light, dark in the ratio 1:1:3:1:1 with four light modules
				before or after it scores 40. This page counts the quiet zone as light.
			</li>
			<li>
				<strong>Balance.</strong> 10 for every whole 5% the share of dark modules is away from half.
			</li>
		</ul>
		<p class="reducer">
			The rules leave room for interpretation, at the edges especially, so two correct generators can choose different
			masks for the same text. Both codes scan, because the mask number is in the format information.
		</p>
	</section>

	<section id="capacity">
		<h2>QR code capacity by version</h2>
		<p class="section-intro">
			How much fits in each version: bytes at each level (byte mode, such as a link with lower case letters), and digits
			and alphanumeric characters at level M.
		</p>
		<div class="table-wrap scroll-box tall">
			<table class="data-table capacity">
				<thead>
					<tr>
						<th scope="col">Version</th>
						<th scope="col">Modules</th>
						<th scope="col" class="num">Alignment</th>
						<th scope="col" class="num">Bytes L</th>
						<th scope="col" class="num">Bytes M</th>
						<th scope="col" class="num">Bytes Q</th>
						<th scope="col" class="num">Bytes H</th>
						<th scope="col" class="num">Digits M</th>
						<th scope="col" class="num">Alnum M</th>
					</tr>
				</thead>
				<tbody>
					{#each capacityRows as row}
						<tr>
							<th scope="row" class="mono">{row.v}</th>
							<td class="mono">{row.size}×{row.size}</td>
							<td class="mono num">{row.align}</td>
							{#each row.bytes as b}
								<td class="mono num">{fmt(b)}</td>
							{/each}
							<td class="mono num">{fmt(row.digits)}</td>
							<td class="mono num">{fmt(row.alnum)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			A character outside ASCII takes 2 to 4 bytes in UTF-8, so text with accents or emoji fits fewer characters than
			the byte count. The <a href="/binary-translator">binary translator</a> shows the UTF-8 bytes of any text, and the
			<a href="/ascii-table">ASCII table</a> the one-byte characters.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>No quiet zone.</strong> Printing the code flush against a border, a photo or other text. Leave four modules
				of light margin on every side.
			</li>
			<li>
				<strong>Too dense to scan.</strong> A long link makes a high version with small modules. Shorten the link, or print
				the code bigger.
			</li>
			<li>
				<strong>Lower case in a link that could be capitals.</strong> One lower case letter forces byte mode. At level
				Q, {link} needs version {linkLower.version}; {linkUpper} fits version {linkCaps.version}. Scheme and domain are
				not case sensitive, but the path after them can be.
			</li>
			<li>
				<strong>Low contrast or inverted colours.</strong> The standard's codes are dark modules on a light background. Many
				phone scanners also read light on dark, but not all.
			</li>
			<li>
				<strong>A logo over too much of it.</strong> A logo destroys the modules under it, which error correction has to
				make up for. Use level H, keep the logo small and away from the finder patterns, and test the result.
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
			Bars instead of squares: the <a href="/ean-13-barcode-generator">EAN-13 barcode generator</a> draws the barcodes
			on shop products, with each digit's bars explained. For another way to write bytes as text, see
			<a href="/base64">Base64</a>.
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

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.text-input {
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
		max-height: 14rem;
	}

	.text-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.text-input[aria-invalid='true'] {
		border-color: #f66;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.7rem;
	}

	.options {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.7rem 1.4rem;
		margin-bottom: 0.9rem;
	}

	.opt {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.opt-label {
		color: #bbb;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.25rem;
	}

	.opt button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font: 600 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.opt button .pct {
		color: #aaa;
		font-weight: normal;
		font-size: 0.75rem;
	}

	.opt button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.opt button.active .pct {
		color: #e6f5e6;
	}

	.opt select {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 0.85rem;
		padding: 0.3rem 0.4rem;
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
		margin: 0 0 0.8rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid #e05555;
		border-left-width: 4px;
		border-radius: 3px;
		background-color: rgba(190, 50, 50, 0.12);
	}

	.results {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 1rem;
	}

	.stale {
		opacity: 0.35;
		pointer-events: none;
	}

	.answer {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
		margin-bottom: 1rem;
	}

	.answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.15rem;
		font-weight: 600;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
		overflow-wrap: anywhere;
	}

	.answer-also.hint {
		color: #ddd;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem !important;
		margin: 1.6rem 0 0.3rem !important;
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0 0 0.6rem;
		max-width: 660px;
	}

	.pen-wrap {
		position: relative;
	}

	.penalties th,
	.penalties td {
		white-space: nowrap;
		padding: 0.3rem 0.7rem;
	}

	@media (max-width: 560px) {
		.penalties th,
		.penalties td {
			padding: 0.3rem 0.4rem;
		}
	}

	.penalties tr.chosen th,
	.penalties tr.chosen td {
		background-color: rgba(93, 182, 93, 0.12);
		color: #fff;
	}

	.penalties td.best {
		color: #8ede8e;
		font-weight: 700;
	}

	.tag {
		background: #372;
		border-radius: 3px;
		color: #fff;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.68rem;
		margin-left: 0.4rem;
		padding: 0.05rem 0.35rem;
	}

	.use-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #ccc;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
	}

	.use-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.num {
		text-align: right !important;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.parts th[scope='row'] {
		color: #fff;
		white-space: nowrap;
	}

	.parts td {
		min-width: 12rem;
	}

	.worked {
		color: #ddd;
		max-width: 760px;
		padding-left: 1.25rem;
	}

	.worked li {
		margin-bottom: 0.8rem;
	}

	.pairs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0.4rem 0;
	}

	.pair {
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		display: inline-flex;
		flex-direction: column;
		font-size: 0.85rem;
		padding: 0.15rem 0.45rem;
	}

	.strong {
		color: #8ede8e !important;
		font-weight: 700;
	}

	.dim {
		color: #aaa !important;
		font-size: 0.75rem;
	}

	.hex-line {
		display: block;
		color: #fff;
		margin-top: 0.2rem;
		overflow-wrap: anywhere;
	}

	.hex-line.ec {
		color: #f0b47a;
	}

	.mask-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 10px;
		margin-bottom: 1.2rem;
	}

	.mask-card {
		align-items: center;
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		display: flex;
		gap: 0.7rem;
		margin: 0;
		padding: 0.5rem 0.6rem;
	}

	.mask-preview {
		flex: none;
		height: 60px;
		width: 60px;
	}

	.mask-card figcaption {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.formula {
		font-size: 0.75rem;
		overflow-wrap: anywhere;
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

	.scroll-box {
		overflow: auto;
	}

	.tall {
		max-height: 460px;
	}

	.capacity th,
	.capacity td {
		white-space: nowrap;
		padding: 0.3rem 0.7rem;
	}

	.capacity thead th {
		position: sticky;
		top: 0;
	}
</style>
