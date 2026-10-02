<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import { downloadSvg, downloadPng, copyText } from '$lib/download';
	import {
		parseCode,
		encode,
		layout,
		barcodeSvg,
		checkWorking,
		isbn10To13,
		isbn13To10,
		isValidCode,
		cleanCode,
		prefixInfo,
		prefixLabel,
		printedForm,
		missedTranspositions,
		structure,
		symbolModules,
		darkModules,
		L_CODES,
		G_CODES,
		R_CODES,
		PARITY_PATTERNS,
		PREFIX_RANGES,
		QUIET_ZONES,
		SYMBOLOGIES,
		GUARDS,
		BarcodeError,
		type Symbology,
		type ParsedCode,
		type Segment
	} from '$lib/ean';
	import CodeBars from './CodeBars.svelte';
	import { onMount } from 'svelte';

	const symbologies = ['ean13', 'upca', 'ean8'] as const;
	const DEFAULTS = { v: '400638133393', sym: 'ean13' };
	onMount(() => {
		const p = readUrl();
		sym = safeOption(p.sym, symbologies) ?? sym;
		input = safeText(p.v, 40) ?? input;
	});
	$: syncUrl({ v: input, sym }, DEFAULTS);

	let input = DEFAULTS.v;
	let sym: Symbology = 'ean13';

	// Runs at build time too, so the page ships with a real barcode drawn. On an
	// error the last good barcode stays on screen, dimmed, so nothing jumps.
	let parsed: ParsedCode = parseCode(DEFAULTS.v, 'ean13');
	let error = '';
	$: {
		try {
			parsed = parseCode(input, sym);
			error = '';
		} catch (e) {
			error = e instanceof BarcodeError ? e.message : 'That is not a barcode number';
		}
	}
	$: barcode = encode(parsed.code, parsed.symbology);
	$: lay = layout(barcode);
	$: info = SYMBOLOGIES[parsed.symbology];
	$: digitSegments = barcode.segments.filter((s) => s.kind === 'digit');
	$: ean13Form = parsed.symbology === 'upca' ? '0' + parsed.code : parsed.code;
	$: prefix = parsed.symbology === 'ean8' ? null : prefixInfo(ean13Form);
	$: isbn10 = parsed.symbology === 'ean13' && !parsed.isbn ? isbn13To10(parsed.code) : null;
	$: typed = cleanCode(input);
	/** Twelve digits in the EAN-13 field that already end in a valid check digit are probably a UPC-A. */
	$: upcHint = sym === 'ean13' && /^\d{12}$/.test(typed) && isValidCode(typed);

	/** The highlighted digit, by its index in the number; null for none. */
	let active: number | null = null;
	$: if (active !== null && active >= parsed.code.length) active = null;
	$: activeSegment = active === null ? undefined : digitSegments.find((s) => s.digitIndex === active);
	$: hiddenFirst = parsed.symbology === 'ean13';
	/** In EAN-13 the first digit has no bars, so highlighting it lights up the six digits whose code sets carry it. */
	$: lit = (i: number | undefined) =>
		i !== undefined && active !== null && (i === active || (hiddenFirst && active === 0 && i >= 1 && i <= 6));

	/** Module numbers count from the first bar of the start guard, as 1. */
	const moduleRange = (s: Segment) => `${s.start - barcode.quiet.left + 1}–${s.start - barcode.quiet.left + s.bits.length}`;

	function choose(next: Symbology) {
		if (next === sym) return;
		const code = error ? '' : parsed.code;
		if (sym === 'ean13' && next === 'upca' && code.startsWith('0')) input = code.slice(1);
		else if (sym === 'upca' && next === 'ean13' && code) input = '0' + code;
		else input = examplesFor[next];
		sym = next;
		active = null;
	}
	const examplesFor: Record<Symbology, string> = { ean13: '400638133393', upca: '03600029145', ean8: '9638507' };

	function tryValue(v: string, s: Symbology) {
		sym = s;
		input = v;
		active = null;
		const field = document.getElementById('code');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; v: string; sym: Symbology }[] = [
		{ label: '400638133393', v: '400638133393', sym: 'ean13' },
		{ label: '5901234123457', v: '5901234123457', sym: 'ean13' },
		{ label: 'Wrong check digit', v: '5901234123450', sym: 'ean13' },
		{ label: 'ISBN 0-306-40615-2', v: '0-306-40615-2', sym: 'ean13' },
		{ label: 'In-store 200…', v: '200123456789', sym: 'ean13' },
		{ label: 'UPC-A 036000291452', v: '036000291452', sym: 'upca' },
		{ label: 'EAN-8 9638507', v: '9638507', sym: 'ean8' }
	];

	let message = '';
	let messageTimer: ReturnType<typeof setTimeout>;
	function say(text: string) {
		message = text;
		clearTimeout(messageTimer);
		messageTimer = setTimeout(() => (message = ''), 2500);
	}
	async function copy(text: string, what: string) {
		say((await copyText(text)) ? `${what} copied` : `Could not copy; select the ${what.toLowerCase()} and press ctrl+C`);
	}
	$: fileName = `${info.name.toLowerCase()}-${parsed.code}`;
	function saveSvg() {
		downloadSvg(barcodeSvg(barcode), `${fileName}.svg`);
	}
	async function savePng() {
		try {
			// Three pixels per module in the file, doubled: six pixels, so every bar is a whole number of pixels.
			await downloadPng(barcodeSvg(barcode), `${fileName}.png`, 2);
		} catch {
			say('The PNG could not be made in this browser; the SVG download still works');
		}
	}

	// Reference content, all from the engine.
	const codeTable = L_CODES.map((l, d) => ({ d, l, g: G_CODES[d], r: R_CODES[d] }));
	const ean13Structure = structure('ean13');
	const upcStructure = structure('upca');
	const ean8Structure = structure('ean8');
	const total = (rows: { modules: number }[]) => rows.reduce((t, r) => t + r.modules, 0);
	const between = symbolModules('ean13');

	const defaultCode = parseCode(DEFAULTS.v, 'ean13');
	const defaultBarcode = encode(defaultCode.code, 'ean13');
	const defaultParity = defaultBarcode.parity ?? '';
	const workedChecks = [
		{ label: 'EAN-13', sym: 'ean13' as Symbology, w: checkWorking('590123412345') },
		{ label: 'ISBN-13', sym: 'ean13' as Symbology, w: checkWorking('978030640615') },
		{ label: 'UPC-A', sym: 'upca' as Symbology, w: checkWorking('03600029145') }
	];
	const isbnExample = isbn10To13('0306406152');
	const missed = missedTranspositions().filter(([a, b]) => a < b);
	const upcExample = parseCode('036000291452', 'upca');
	const upcAsEan = encode('0' + upcExample.code, 'ean13');
	const sameBars = encode(upcExample.code, 'upca').modules === upcAsEan.modules;

	const faqs = [
		{
			q: 'How is the EAN-13 check digit calculated?',
			a: `Multiply the first 12 digits alternately by 1 and 3, starting with 1, and add the results. The check digit is whatever brings that sum up to the next multiple of 10. For ${
				defaultCode.data
			} the sum is ${defaultCode.working.sum}, the next multiple of 10 is ${defaultCode.working.nextTen}, so the check digit is ${
				defaultCode.working.check
			} and the full number is ${defaultCode.code}.`
		},
		{
			q: 'Does the barcode prefix tell you the country of origin?',
			a: 'No. The first two or three digits say which GS1 member organisation issued the company prefix to the brand owner. A company registered with GS1 Germany gets a 400 to 440 prefix wherever its products are made, and a product made in Germany can carry any prefix.'
		},
		{
			q: 'What is the difference between UPC-A and EAN-13?',
			a: `A UPC-A has 12 digits; put a 0 in front and it is an EAN-13 with exactly the same bars, because the first digit 0 selects the all-L pattern for the left half. ${upcExample.code} as a UPC-A and 0${upcExample.code} as an EAN-13 are the same symbol; only the digits printed underneath are arranged differently.`
		},
		{
			q: 'How do I turn an ISBN-10 into an ISBN-13 for the barcode?',
			a: `Put 978 in front of the first nine digits, drop the old check digit and work out a new one with the EAN rule. ${isbnExample.isbn10} becomes ${isbnExample.working.steps
				.map((s) => s.digit)
				.join('')} plus check digit ${isbnExample.working.check}, which is ${isbnExample.isbn13}. Type an ISBN-10 into the generator and it does this for you.`
		},
		{
			q: 'Why does an EAN-13 barcode have 95 modules?',
			a: `Twelve of the thirteen digits are drawn, six each side, at 7 modules each: 84. The start and end guards add 3 each and the centre guard 5, which makes ${between}. The first digit has no bars of its own; it is carried by the mix of L and G codes in the left half.`
		},
		{
			q: 'How much white space does a barcode need around it?',
			a: `GS1 sets a minimum quiet zone of ${QUIET_ZONES.ean13.left} modules on the left and ${QUIET_ZONES.ean13.right} on the right of an EAN-13, ${QUIET_ZONES.upca.left} on each side of a UPC-A and ${QUIET_ZONES.ean8.left} on each side of an EAN-8. Text or a box edge inside that space can stop a scanner from finding where the symbol starts.`
		},
		{
			q: 'What mistakes does the check digit miss?',
			a: `It catches every single wrong digit. It misses a swap of two neighbouring digits only when they differ by 5, such as ${missed
				.map(([a, b]) => `${a} and ${b}`)
				.slice(0, 2)
				.join(' or ')}, because the weights 1 and 3 then change the sum by a multiple of 10. Two or more wrong digits can also cancel out.`
		}
	];

	const page = {
		title: 'EAN-13 Barcode Generator: Check Digit, Bars and How It Works',
		description:
			'Make an EAN-13, UPC-A or EAN-8 barcode as SVG or PNG and see how it works: the check digit, the L, G and R codes, the guard bars and all 95 modules.',
		url: `${SITE}/ean-13-barcode-generator`,
		image: `${SITE}/og/ean-13-barcode-generator.png`,
		imageAlt: 'LogicGates.org: EAN-13 barcode generator with the bars explained'
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
					{ '@type': 'ListItem', position: 3, name: 'EAN-13 barcode generator' }
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
		{ href: '/qr-code-generator', label: 'QR code generator' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/base64', label: 'Base64 encoder' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>EAN-13 barcode generator</h1>
		<p class="lede">
			Type 12 digits to get the check digit and the barcode, or 13 to check one. Every bar is explained: which of the
			three codes draws each digit, where the first digit hides, and the 95 modules from guard to guard.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Barcode type">
				{#each symbologies as s}
					<button type="button" class:active={sym === s} aria-pressed={sym === s} on:click={() => choose(s)}
						>{SYMBOLOGIES[s].name}</button
					>
				{/each}
			</div>

			<label class="field" for="code">{SYMBOLOGIES[sym].name} number</label>
			<input
				id="code"
				class="value-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				inputmode="numeric"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="code-help"
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<p class="field-help" id="code-help">
				{SYMBOLOGIES[sym].length - 1} digits and the check digit is worked out; {SYMBOLOGIES[sym].length} and it is checked.
				{#if sym === 'ean13'}An ISBN-10 such as 0-306-40615-2 is converted to its ISBN-13.{/if}
				Spaces and hyphens are ignored.
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryValue(example.v, example.sym)}>
						{example.label}
					</button>
				{/each}
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<div class="result-grid">
				<div class="side">
				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-label">{info.name}{parsed.status === 'invalid' ? ', check digit corrected' : ''}</span>
					<span class="answer-value mono">{printedForm(parsed.code, parsed.symbology)}</span>
					<span class="answer-also">
						{#if parsed.isbn}
							ISBN-10 <span class="mono">{parsed.isbn.isbn10}</span> becomes ISBN-13 with 978 in front and a new check
							digit, <strong class="mono">{parsed.working.check}</strong>.
						{:else if parsed.status === 'computed'}
							Check digit <strong class="mono">{parsed.working.check}</strong>, worked out from the first {parsed.data
								.length} digits.
						{:else if parsed.status === 'valid'}
							The check digit <strong class="mono">{parsed.working.check}</strong> is correct.
						{:else}
							The check digit is wrong: the first {parsed.data.length} digits need
							<strong class="mono">{parsed.working.check}</strong>, not {parsed.given}.
						{/if}
						{#if prefix}
							Prefix <span class="mono">{ean13Form.slice(0, 3)}</span>: {prefix.meaning}{prefix.special
								? ''
								: ' issued the company prefix (not a country of origin)'}.
						{/if}
						{#if isbn10}ISBN-10: <span class="mono">{isbn10}</span>.{/if}
					</span>
				</div>
				{#if !error && parsed.status === 'invalid'}
					<p class="warning" role="alert">
						{parsed.data}{parsed.given} does not scan as typed: a scanner would reject it. The barcode below uses the correct
						check digit, {parsed.working.check}.
					</p>
				{/if}
				{#if !error && parsed.isbn && !parsed.isbn.valid10}
					<p class="warning" role="alert">
						The ISBN-10 check character should be {parsed.isbn.expected10}, not {parsed.isbn.isbn10[9]}, so check the
						number. The ISBN-13 does not use it: its check digit is worked out afresh.
					</p>
				{/if}
				{#if !error && upcHint}
					<p class="hint">
						These 12 digits already end in a valid check digit, so they may be a UPC-A.
						<button type="button" class="link-btn" on:click={() => tryValue(typed, 'upca')}>Read them as UPC-A</button>
					</p>
				{/if}

				</div>
				<figure class="barcode-figure">
					<div class="barcode-paper">
						<svg
							class="barcode"
							viewBox="0 0 {lay.width} {lay.height}"
							role="img"
							aria-label="{info.name} barcode for {parsed.code}"
						>
							{#each lay.digitSpans as span (span.digitIndex)}
								{#if lit(span.digitIndex)}
									<rect class="band" x={span.x} y="0" width={span.width} height={lay.height} />
								{/if}
							{/each}
							{#each lay.bars as bar}
								<rect
									class="bar"
									class:hot={lit(bar.digitIndex)}
									x={bar.x}
									y={lay.barTop}
									width={bar.width}
									height={(bar.long ? lay.longBottom : lay.barBottom) - lay.barTop}
								/>
							{/each}
							{#each lay.labels as label}
								<text
									class="digit-label"
									class:hot={lit(label.digitIndex)}
									x={label.x}
									y={label.small ? lay.textY - 1 : lay.textY}
									font-size={label.small ? lay.fontSize - 2 : lay.fontSize}>{label.text}</text
								>
							{/each}
							<!-- Invisible hover targets, one per digit, over its bars and its printed digit. -->
							{#each lay.digitSpans as span (span.digitIndex)}
								<rect
									class="hover-target"
									x={span.x}
									y="0"
									width={span.width}
									height={lay.height}
									on:mouseenter={() => (active = span.digitIndex)}
									on:mouseleave={() => (active = null)}
								/>
							{/each}
							{#each lay.labels.filter((l) => !lay.digitSpans.some((s) => s.digitIndex === l.digitIndex)) as label}
								<rect
									class="hover-target"
									x={label.x - 3}
									y={lay.barBottom}
									width="6"
									height={lay.height - lay.barBottom}
									on:mouseenter={() => (active = label.digitIndex)}
									on:mouseleave={() => (active = null)}
								/>
							{/each}
						</svg>
					</div>
					<figcaption class="actions">
						<button type="button" class="action" on:click={saveSvg}>Download SVG</button>
						<button type="button" class="action" on:click={savePng}>Download PNG</button>
						<button type="button" class="action" on:click={() => copy(parsed.code, 'Number')}>Copy number</button>
						<span class="copy-status" aria-live="polite">{message}</span>
					</figcaption>
				</figure>
				</div>

				<h2 class="working-title">Digit by digit</h2>
				<p class="strip-help">
					Hover over the bars, or focus a digit below, to see which modules it owns.
					{#if hiddenFirst}The first digit has no bars: it picks the L and G pattern of the next six.{/if}
				</p>
				<div class="strip" role="group" aria-label="Digits of the barcode">
					{#if hiddenFirst}
						<button
							type="button"
							class="digit-btn first"
							class:hot={active === 0}
							aria-describedby="digit-detail"
							on:mouseenter={() => (active = 0)}
							on:mouseleave={() => (active = null)}
							on:focus={() => (active = 0)}
							on:blur={() => (active = null)}
						>
							<span class="digit-num mono">{parsed.code[0]}</span>
							<span class="digit-set">no bars</span>
							<span class="digit-bits mono">{barcode.parity}</span>
						</button>
					{/if}
					{#each digitSegments as seg, i (seg.digitIndex)}
						{#if i === info.half}<span class="centre-mark" aria-hidden="true">01010</span>{/if}
						<button
							type="button"
							class="digit-btn"
							class:hot={lit(seg.digitIndex)}
							aria-label="Digit {parsed.code[seg.digitIndex ?? 0]}, position {(seg.digitIndex ?? 0) + 1}, {seg.set} code {seg.bits}"
							aria-describedby="digit-detail"
							on:mouseenter={() => (active = seg.digitIndex ?? null)}
							on:mouseleave={() => (active = null)}
							on:focus={() => (active = seg.digitIndex ?? null)}
							on:blur={() => (active = null)}
						>
							<span class="digit-num mono">{parsed.code[seg.digitIndex ?? 0]}</span>
							<span class="digit-set">{seg.set}</span>
							<CodeBars bits={seg.bits} size={4} height={14} />
							<span class="digit-bits mono">{seg.bits}</span>
						</button>
					{/each}
				</div>
				<p class="digit-detail" id="digit-detail" aria-live="polite">
					{#if active === 0 && hiddenFirst}
						The first digit, {parsed.code[0]}, is not drawn. It sets the code sets of the left six digits to
						<strong class="mono">{barcode.parity}</strong>, and a scanner works it out from that pattern.
					{:else if activeSegment}
						Position {(activeSegment.digitIndex ?? 0) + 1}: {parsed.code[activeSegment.digitIndex ?? 0]} drawn with its
						{activeSegment.set} code <strong class="mono">{activeSegment.bits}</strong>, modules {moduleRange(activeSegment)}
						of {barcode.modules.length}{activeSegment.set === 'R'
							? ', on the right where every digit uses R'
							: hiddenFirst
							? `, ${activeSegment.set} because the first digit ${parsed.code[0]} gives ${barcode.parity}`
							: ''}.
					{:else}
						{info.name}: {barcode.modules.length} modules between the quiet zones, {lay.width} with them.
					{/if}
				</p>

				<h2 class="working-title">All {barcode.modules.length} modules</h2>
				<div class="modules" aria-label="The modules, segment by segment">
					{#each barcode.segments.filter((s) => s.kind !== 'quiet') as seg}
						<span class="module-seg" class:guard={seg.kind === 'guard'} class:hot={lit(seg.digitIndex)}>
							<span class="seg-label"
								>{seg.kind === 'guard' ? seg.label.replace(' guard', '') : `${parsed.code[seg.digitIndex ?? 0]} ${seg.set}`}</span
							>
							<span class="seg-bits mono">{seg.bits}</span>
						</span>
					{/each}
				</div>
				<p class="module-line">
					<button type="button" class="action" on:click={() => copy(barcode.modules, 'Modules')}>Copy modules</button>
					<span class="field-help inline-help"
						>1 is a bar module, 0 a space. Add {barcode.quiet.left} spaces on the left and {barcode.quiet.right} on the right
						for the quiet zones.</span
					>
				</p>

				<h2 class="working-title">Check digit working</h2>
				<div class="table-wrap scroll-box">
					<table class="data-table check-table">
						<tbody>
							<tr>
								<th scope="row">Digit</th>
								{#each parsed.working.steps as s}<td class="mono">{s.digit}</td>{/each}
							</tr>
							<tr>
								<th scope="row">× weight</th>
								{#each parsed.working.steps as s}<td class="mono" class:three={s.weight === 3}>{s.weight}</td>{/each}
							</tr>
							<tr>
								<th scope="row">Product</th>
								{#each parsed.working.steps as s}<td class="mono">{s.product}</td>{/each}
							</tr>
						</tbody>
					</table>
				</div>
				<p class="equation">
					Sum <span class="mono">{parsed.working.steps.map((s) => s.product).join(' + ')} = {parsed.working.sum}</span>.
					The next multiple of 10 is {parsed.working.nextTen}, so the check digit is {parsed.working.nextTen} −
					{parsed.working.sum} = <strong class="mono">{parsed.working.check}</strong>.
				</p>
			</div>
			<p class="share-row"><ShareLink what="this barcode" /></p>
		</div>
	</section>

	<section id="structure">
		<h2>How an EAN-13 barcode is put together</h2>
		<p>
			An EAN-13 (the 13 digit European Article Number, now formally a GTIN-13) is drawn on a grid of equal-width
			columns called modules. Each module is either dark or light, so the whole symbol is a string of bits: a bar is a
			run of 1s and a space a run of 0s, and a bar can be one to four modules wide. At the nominal size a module is 0.33
			mm.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Part</th>
						<th scope="col" class="num">EAN-13</th>
						<th scope="col" class="num">UPC-A</th>
						<th scope="col" class="num">EAN-8</th>
					</tr>
				</thead>
				<tbody>
					{#each ean13Structure as row, i}
						<tr>
							<td>{row.part.replace(/^6 /, 'The ').replace(/ × 7$/, ', 7 modules each')}</td>
							<td class="mono num">{row.modules}</td>
							<td class="mono num">{upcStructure[i].modules}</td>
							<td class="mono num">{ean8Structure[i].modules}</td>
						</tr>
					{/each}
					<tr class="total">
						<th scope="row">Total</th>
						<td class="mono num">{total(ean13Structure)}</td>
						<td class="mono num">{total(upcStructure)}</td>
						<td class="mono num">{total(ean8Structure)}</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p>
			The guards are fixed patterns: <span class="mono">{GUARDS.start}</span> at each end and
			<span class="mono">{GUARDS.centre}</span> in the middle. They give a scanner a reference width for one module and
			mark where each half starts. On a printed label they are drawn longer than the other bars, which is why they poke
			down between the digits. Between the guards there are always {between} modules, whatever the number.
		</p>
	</section>

	<section id="codes">
		<h2>The three codes: L, G and R</h2>
		<p>
			Every digit is drawn as 7 modules: two bars and two spaces. There are three ways to draw each digit. The L code (set
			A in the specification) is used on the left, R (set C) on the right, and G (set B) is a second choice on the left
			of an EAN-13. R is L with every module inverted, and G is R read backwards.
		</p>
		<div class="table-wrap">
			<table class="data-table code-table">
				<thead>
					<tr>
						<th scope="col">Digit</th>
						<th scope="col">L code (left)</th>
						<th scope="col">G code (left)</th>
						<th scope="col">R code (right)</th>
					</tr>
				</thead>
				<tbody>
					{#each codeTable as row}
						<tr>
							<td class="mono strong">{row.d}</td>
							<td><span class="mono">{row.l}</span> <CodeBars bits={row.l} /></td>
							<td><span class="mono">{row.g}</span> <CodeBars bits={row.g} /></td>
							<td><span class="mono">{row.r}</span> <CodeBars bits={row.r} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<ul class="points">
			<li>
				<strong>Left codes start with a space, right codes with a bar.</strong> Every L and G code begins with 0 and ends
				with 1; every R code is the other way round.
			</li>
			<li>
				<strong>Parity tells the sets apart.</strong> Each L code has an odd number of dark modules ({darkModules(
					L_CODES[0]
				)} for 0), each G and R code an even number ({darkModules(G_CODES[0])} for 0). A scanner that counts them knows
				which set a digit came from.
			</li>
			<li>
				<strong>Direction comes free.</strong> The first digit after the start guard is always an L code, which is odd.
				Read backwards, the first code a scanner meets is an R code reversed, which is even, so it knows to flip the
				symbol round. That is how a checkout scanner reads a product held either way up.
			</li>
		</ul>
	</section>

	<section id="first-digit">
		<h2>Where the 13th digit hides</h2>
		<p>
			Twelve digits get bars, but an EAN-13 has thirteen. The first digit is never drawn. Instead it decides, for each of
			the six left-hand digits, whether the L or the G code is used, and a scanner reads it back from that pattern. The
			right half always uses R.
		</p>
		<div class="table-wrap">
			<table class="data-table parity-table">
				<thead>
					<tr>
						<th scope="col">First digit</th>
						<th scope="col">Left six digits use</th>
						<th scope="col">First digit</th>
						<th scope="col">Left six digits use</th>
					</tr>
				</thead>
				<tbody>
					{#each PARITY_PATTERNS.slice(0, 5) as pattern, d}
						<tr>
							<td class="mono strong">{d}</td>
							<td class="mono pattern">{pattern}</td>
							<td class="mono strong gap">{d + 5}</td>
							<td class="mono pattern">{PARITY_PATTERNS[d + 5]}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			In the default example, {defaultCode.code}, the first digit is {defaultCode.code[0]}, so the left half reads
			<span class="mono">{defaultParity}</span>: {[...defaultParity]
				.map((set, i) => `${defaultCode.code[i + 1]} as ${set}`)
				.join(', ')}. A first digit of 0 gives all L, which is a plain UPC-A; that is how EAN-13 was made to include the
			older American code without changing any bars.
		</p>
	</section>

	<section id="check-digit">
		<h2>Working out the check digit</h2>
		<p>
			Weight the digits 1, 3, 1, 3 and so on, counting so that the digit next to the check digit gets 3. Add the
			products, and the check digit is what is needed to reach the next multiple of 10. For an EAN-13 the weights start
			with 1 on the first digit; for a 12 digit UPC-A they start with 3, which is the same rule seen from the other end.
		</p>
		<div class="worked-grid">
			{#each workedChecks as ex}
				{@const full = ex.w.steps.map((s) => s.digit).join('') + ex.w.check}
				<div class="card worked">
					<h3>{ex.label} {full}</h3>
					<p class="mono small">
						{ex.w.steps.map((s) => `${s.digit}×${s.weight}`).join(' + ')}<br />= {ex.w.steps
							.map((s) => s.product)
							.join(' + ')}<br />= {ex.w.sum}
					</p>
					<p class="small">
						Next multiple of 10: {ex.w.nextTen}, so the check digit is <strong>{ex.w.check}</strong>.
						<a
							href="/ean-13-barcode-generator?v={full}{ex.sym === 'ean13' ? '' : `&sym=${ex.sym}`}"
							on:click|preventDefault={() => tryValue(full, ex.sym)}>Try it</a
						>
					</p>
				</div>
			{/each}
		</div>
		<p>
			Because 3 and 1 are both coprime to 10, changing any one digit always changes the sum by something that is not a
			multiple of 10, so every single-digit mistake is caught. Swapping two neighbouring digits is caught too, unless
			they differ by exactly 5: {missed.map(([a, b]) => `${a}↔${b}`).join(', ')}. Those {missed.length} pairs out of 45
			change the sum by a multiple of 10.
		</p>
	</section>

	<section id="upc-ean8">
		<h2>UPC-A and EAN-8</h2>
		<p>
			<strong>UPC-A</strong> (Universal Product Code) has 12 digits and is used in the United States and Canada. It is
			an EAN-13 whose first digit is 0: the bars of UPC-A {upcExample.code} and EAN-13 0{upcExample.code} are {sameBars
				? 'identical'
				: 'different'}. A UPC-A label prints its first and last digits small, outside the bars, and draws those two
			digits' bars long like the guards.
		</p>
		<p>
			<strong>EAN-8</strong> is the short version for small packs: 8 digits, four each side of the centre guard, all L on
			the left and all R on the right, so there is no hidden digit. Its {symbolModules('ean8')} modules use the same codes,
			guards and check digit rule. EAN-8 numbers are allocated separately by GS1, not by shortening an EAN-13.
		</p>
	</section>

	<section id="prefixes">
		<h2>What the first three digits mean</h2>
		<p>
			The first two or three digits of an EAN-13 are a GS1 prefix. It identifies the GS1 member organisation that issued
			the company prefix to the brand owner. <strong>It is not the country where the product was made</strong>: a
			company registered in one country keeps its prefix for goods made anywhere. A few ranges have special uses instead.
			This table is a selection, not the full list.
		</p>
		<div class="table-wrap">
			<table class="data-table prefix-table">
				<thead>
					<tr><th scope="col">Prefix</th><th scope="col">Issued by or used for</th></tr>
				</thead>
				<tbody>
					{#each PREFIX_RANGES as range}
						<tr class:special={range.special}>
							<td class="mono">{prefixLabel(range)}</td>
							<td>{range.meaning}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Every UPC-A, read as an EAN-13 with a leading 0, falls between 000 and 099. Restricted circulation numbers (020 to
			029, 040 to 049 and 200 to 299) are for use inside a shop or a company, such as weighed produce labels printed in
			store, and mean nothing outside it.
		</p>
	</section>

	<section id="isbn">
		<h2>Book barcodes: ISBN-10 to ISBN-13</h2>
		<p>
			Books use the 978 and 979 prefixes, sometimes called Bookland, and the EAN-13 printed on a book is its ISBN-13. ISBNs
			have been 13 digits since 2007. An older ISBN-10 converts by putting 978 in front and replacing its check
			character, which works differently: weights 10 down to 2, modulo 11, with X standing for 10.
		</p>
		<div class="card worked isbn-card">
			<h3>ISBN-10 {isbnExample.isbn10} to ISBN-13</h3>
			<p class="mono small">
				978 + {isbnExample.isbn10.slice(0, 9)} = {isbnExample.working.steps.map((s) => s.digit).join('')}<br />
				weighted sum {isbnExample.working.sum}, next multiple of 10 {isbnExample.working.nextTen}<br />
				check digit {isbnExample.working.check}: <strong>{isbnExample.isbn13}</strong>
			</p>
			<p class="small">
				The old check digit {isbnExample.isbn10[9]} is dropped.
				<a
					href="/ean-13-barcode-generator?v={isbnExample.isbn10}"
					on:click|preventDefault={() => tryValue(isbnExample.isbn10, 'ean13')}>Try it</a
				>
			</p>
		</div>
		<p>
			Only 978 numbers have an ISBN-10 equivalent; 979 numbers are new and exist only as 13 digits (979-0 is used for
			printed music, as the ISMN). Magazines and other serials use 977 followed by the first seven digits of their ISSN.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Reading the prefix as a country of origin.</strong> 400 to 440 means the company prefix came from GS1
				Germany, not that the product was made there.
			</li>
			<li>
				<strong>Using a UPC-A as the first 12 digits of an EAN-13.</strong> A 12 digit UPC-A already has its check digit.
				Typing it into an EAN-13 generator adds a 13th digit and makes a different number; put a 0 in front instead.
			</li>
			<li>
				<strong>Cropping the quiet zone.</strong> The blank margins are part of the symbol. Placing the code against an
				edge or a line of text can make it unreadable.
			</li>
			<li>
				<strong>Scaling a small PNG.</strong> Stretched pixels make some bars a pixel wider than others. Use the SVG for
				print, or a PNG at a whole number of pixels per module.
			</li>
			<li>
				<strong>Inventing numbers for real products.</strong> Shops and marketplaces expect a GTIN licensed from GS1. A
				number that merely has a valid check digit is not registered to anyone; the 200 to 299 range exists for in-store
				use.
			</li>
		</ul>
		<p class="reducer">
			Barcodes are bits drawn as stripes. For the same idea in two dimensions see the <a href="/qr-code-generator"
				>QR code generator</a
			>; for bits as numbers and text, the <a href="/binary-converter">binary converter</a> and the
			<a href="/ascii-table">ASCII table</a>.
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

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.warning {
		color: #f9b66b;
		font-size: 0.9rem;
		margin: 0.6rem 0 0;
	}

	.hint {
		color: #ccc;
		font-size: 0.9rem;
		margin: 0.6rem 0 0;
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

	.chip-btn:hover {
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

	.answer-also strong {
		color: #8ede8e;
	}

	/* On a phone the answer comes first and the barcode under it; on a wide
	   screen they sit side by side, so the digit strip below stays in view
	   together with the bars it highlights. */
	.result-grid {
		display: grid;
		gap: 1rem;
	}

	.barcode-figure {
		margin: 0;
	}

	@media (min-width: 860px) {
		.result-grid {
			grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
			align-items: start;
		}

		.barcode-figure {
			grid-column: 1;
			grid-row: 1;
		}

		.side {
			grid-column: 2;
			grid-row: 1;
		}
	}

	/* Barcodes are black on white; the paper keeps that true on a dark page. */
	.barcode-paper {
		background: #fff;
		border-radius: 3px;
		color: #000;
		max-width: 400px;
		padding: 6px;
	}

	.barcode {
		display: block;
		width: 100%;
		height: auto;
		color: #000;
	}

	.bar {
		fill: #000;
		shape-rendering: crispEdges;
	}

	.bar.hot {
		fill: #1b6a1b;
	}

	.band {
		fill: #cfeccf;
	}

	.digit-label {
		fill: currentColor;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		text-anchor: middle;
	}

	.digit-label.hot {
		color: #145214;
		font-weight: 700;
	}

	.hover-target {
		fill: transparent;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 0.6rem;
	}

	.action {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.action:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.copy-status {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.3rem !important;
	}

	.strip-help {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0 0 0.6rem;
	}

	.strip {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: stretch;
	}

	.digit-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 3.3rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		padding: 0.3rem 0.25rem;
	}

	.digit-btn.first {
		border-style: dashed;
	}

	.digit-btn.hot {
		border-color: #5db65d;
		background: #1a2d1a;
	}

	.digit-num {
		color: #fff;
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.digit-set {
		color: #bbb;
		font-size: 0.72rem;
	}

	.digit-btn.hot .digit-set {
		color: #8ede8e;
	}

	.digit-bits {
		font-size: 0.66rem;
		color: #ccc;
		letter-spacing: 0.02em;
	}

	.centre-mark {
		align-self: center;
		color: #999;
		font: 0.7rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0 0.15rem;
		writing-mode: vertical-rl;
	}

	.digit-detail {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.6rem 0 0;
		min-height: 3em;
	}

	.digit-detail strong {
		color: #8ede8e;
	}

	.modules {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 2px;
	}

	.module-seg {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		border-top: 2px solid rgba(255, 255, 255, 0.25);
		padding: 0.1rem 0.2rem 0;
	}

	.module-seg.guard {
		border-top-color: #999;
	}

	.module-seg.hot {
		border-top-color: #5db65d;
		background: #1a2d1a;
	}

	.seg-label {
		color: #aaa;
		font-size: 0.7rem;
		white-space: nowrap;
	}

	.seg-bits {
		color: #eee;
		font-size: 0.8rem;
	}

	.module-seg.guard .seg-bits {
		color: #bbb;
	}

	.module-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin: 0.6rem 0 0;
	}

	.inline-help {
		margin: 0;
	}

	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}

	.check-table th,
	.check-table td {
		white-space: nowrap;
		text-align: center;
		padding: 0.25rem 0.4rem;
	}

	.check-table th {
		text-align: left;
	}

	.check-table td.three {
		color: #8ede8e;
		font-weight: 700;
	}

	.equation {
		color: #ccc;
		font-size: 0.92rem;
		margin: 0.7rem 0 0;
		overflow-wrap: anywhere;
	}

	.equation strong {
		color: #8ede8e;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.num {
		text-align: right !important;
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	tr.total th,
	tr.total td {
		border-top: 2px solid rgba(255, 255, 255, 0.4);
		color: #fff;
	}

	.code-table td {
		white-space: nowrap;
	}

	.code-table td :global(.code-bars) {
		margin-left: 0.4rem;
	}

	.parity-table .gap {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.pattern {
		letter-spacing: 0.12em;
	}

	.prefix-table tr.special td {
		color: #c7e6c7;
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
		overflow-wrap: anywhere;
	}

	.isbn-card {
		max-width: 520px;
		margin-bottom: 1rem;
	}

	.small {
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
		overflow-wrap: anywhere;
	}

	.worked strong {
		color: #8ede8e;
	}

	@media (max-width: 560px) {
		.tool {
			padding: 0.9rem 0.8rem 1.1rem;
		}

		.digit-btn {
			min-width: 3.4rem;
		}

		.code-table th,
		.code-table td {
			padding-left: 0.4rem;
			padding-right: 0.4rem;
		}

		.code-table td :global(.code-bars) {
			display: none;
		}
	}
</style>
