<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		FORMATS,
		FORMAT_IDS,
		decode,
		encode,
		encodeParsed,
		stored,
		parseDecimal,
		asParsed,
		parseCode,
		neighbours,
		facts,
		allCodes,
		mxBlock,
		powerOfTwo,
		minus,
		shortValue,
		exactPower,
		distinctShort,
		MiniFloatError,
		MAX_INPUT,
		type FormatId,
		type Decoded,
		type Encoding,
		type OverflowMode,
		type Parsed
	} from '$lib/minifloat';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import { groupDecimal } from '$lib/radix';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	type Mode = 'dec' | 'hex' | 'bin';
	const DEFAULTS = { v: '0.1', mode: 'dec', fmt: 'fp16', of: 'saturate' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.v, MAX_INPUT) ?? input;
		mode = safeOption(p.mode, ['dec', 'hex', 'bin'] as const) ?? mode;
		format = safeOption(p.fmt, FORMAT_IDS) ?? format;
		overflowMode = safeOption(p.of, ['saturate', 'nan'] as const) ?? overflowMode;
	});
	$: syncUrl({ v: input, mode, fmt: format, of: overflowMode }, DEFAULTS);

	let input = DEFAULTS.v;
	let mode: Mode = 'dec';
	/** In bits mode the format being typed; in decimal mode the one whose rounding is worked through. */
	let format: FormatId = 'fp16';
	/** What E4M3 does with a value beyond 448, since it has no infinity. */
	let overflowMode: OverflowMode = 'saturate';

	// Computed at build time too, so the page is served with 0.1 already converted.
	let parsed: Parsed = parseDecimal('0.1');
	let typed: Decoded | null = null;
	let error = '';
	$: {
		try {
			if (mode === 'dec') {
				parsed = parseDecimal(input);
				typed = null;
			} else {
				typed = decode(parseCode(input, format, mode === 'hex' ? 'hex' : 'binary'), format);
				parsed = asParsed(typed);
			}
			error = '';
		} catch (e) {
			error = e instanceof MiniFloatError ? e.message : 'That could not be read';
		}
	}
	$: rows = FORMAT_IDS.map((id) => {
		const enc = encodeParsed(parsed, id, overflowMode);
		const near = enc.result ? neighbours(enc.result) : { below: null, above: null };
		// Past either end there is infinity in the IEEE formats and nothing in the others.
		const end = (side: 'below' | 'above') =>
			FORMATS[id].specials === 'ieee' ? (side === 'below' ? '−∞' : '∞') : 'none';
		let nearText = { below: '', value: '', above: '' };
		if (enc.result) {
			const list = [near.below, enc.result, near.above].filter((d): d is Decoded => d !== null);
			const texts = distinctShort(list).map(minus);
			const at = near.below ? 1 : 0;
			nearText = {
				below: near.below ? texts[0] : end('below'),
				value: texts[at],
				above: near.above ? texts[at + 1] : end('above')
			};
		}
		return { id, f: FORMATS[id], enc, nearText };
	});
	$: detail = rows.find((r) => r.id === format) || rows[1];
	$: shown = typed ?? detail.enc.result;
	$: sf = FORMATS[format];
	$: steps = mode === 'dec' ? detail.enc.steps : null;

	function setMode(next: Mode) {
		if (next === mode) return;
		if (!error) {
			const d = shown;
			if (next === 'dec') input = d ? d.exact : 'NaN';
			else if (d) input = next === 'hex' ? d.hex : d.bits;
		}
		mode = next;
	}

	/** In bits mode, switching format carries the value across as the new format's pattern. */
	function setFormat(next: FormatId) {
		if (next === format) return;
		if (mode !== 'dec' && !error) {
			const r = rows.find((x) => x.id === next)?.enc.result;
			if (r) input = mode === 'hex' ? r.hex : r.bits;
			else {
				mode = 'dec';
				input = parsed.normalised;
			}
		}
		format = next;
	}

	/** Clicking a bit flips it; the input becomes the new pattern. */
	function flip(index: number) {
		if (error || !shown) return;
		const bits = [...shown.bits];
		bits[index] = bits[index] === '1' ? '0' : '1';
		const d = decode(parseInt(bits.join(''), 2), format);
		if (mode === 'dec') mode = 'hex';
		input = mode === 'bin' ? d.bits : d.hex;
	}

	function tryValue(v: string, m: Mode = 'dec', fmt: FormatId = format) {
		mode = m;
		format = fmt;
		input = v;
		const field = document.getElementById('value');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; v: string; mode?: Mode; fmt?: FormatId }[] = [
		{ label: '0.1', v: '0.1' },
		{ label: '3.14159', v: '3.14159' },
		{ label: '1000', v: '1000' },
		{ label: '70000', v: '70000' },
		{ label: '464', v: '464', fmt: 'e4m3' },
		{ label: '1e-6', v: '1e-6' },
		{ label: '-0', v: '-0' },
		{ label: 'NaN', v: 'NaN' },
		{ label: 'FP16 bits 3C00', v: '3C00', mode: 'hex', fmt: 'fp16' },
		{ label: 'E4M3 bits 7E', v: '7E', mode: 'hex', fmt: 'e4m3' },
		{ label: 'E5M2 bits 7C', v: '7C', mode: 'hex', fmt: 'e5m2' }
	];

	const kindText: Record<string, string> = {
		zero: 'zero',
		subnormal: 'subnormal',
		normal: 'normal',
		infinity: 'infinity',
		nan: 'NaN'
	};

	/** The relative error as a percentage, for people who think in those. */
	function percent(rel: string | null): string {
		if (rel === null) return '';
		const p = Number(rel) * 100;
		if (p === 0) return '0%';
		// Below a hundredth of a percent, a plain ratio reads better than 0.0000015%.
		return p >= 0.01 ? `${Number(p.toPrecision(3))}%` : `${minus(rel)}`;
	}

	function roundedText(e: Encoding): string {
		if (!e.result) return e.note;
		if (e.overflow === 'infinity') return 'too large: became infinity';
		if (e.overflow === 'saturated') return 'too large: clamped to the largest value';
		if (e.overflow === 'nan') return 'too large: became NaN';
		if (e.rounded === 'special') return 'stored as itself';
		if (e.rounded === 'exact') return 'stored exactly';
		if (e.underflowed) return `too small: rounded ${e.rounded} to zero`;
		return `rounded ${e.rounded}`;
	}

	// Copying a code: one live region announces it for every card.
	let copied = '';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = `Copied ${what}`;
		} catch {
			copied = 'Copying failed: select the text and press ctrl+C';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = ''), 2500);
	}

	// --- Generated reference content ---------------------------------------
	const table = FORMAT_IDS.map((id) => facts(id));
	const pow = (d: Decoded) => {
		const k = exactPower(d);
		return k === null ? '' : powerOfTwo(k);
	};
	const digitsText = (x: number) => x.toFixed(1);

	// Worked rounding examples: the first two are exact ties in E4M3, the third never ends.
	const tieDown = encode('1.0625', 'e4m3');
	const tieUp = encode('1.1875', 'e4m3');
	const pointOne16 = encode('0.1', 'fp16');
	const worked = [
		{ title: '1.0625 to E4M3: a tie, kept even', e: tieDown, v: '1.0625', fmt: 'e4m3' as FormatId },
		{ title: '1.1875 to E4M3: a tie, rounded up to even', e: tieUp, v: '1.1875', fmt: 'e4m3' as FormatId },
		{ title: '0.1 to FP16: sticky decides', e: pointOne16, v: '0.1', fmt: 'fp16' as FormatId }
	];

	// What happens just past the top of each format.
	const overflowRows = FORMAT_IDS.map((id) => {
		const fx = facts(id);
		const beyond = String(fx.max.number * 2);
		return {
			id,
			name: FORMATS[id].name,
			max: fx.max,
			sat: encode(beyond, id, 'saturate'),
			nan: encode(beyond, id, 'nan'),
			infSat: encode('Infinity', id, 'saturate'),
			infNan: encode('Infinity', id, 'nan')
		};
	});
	const e4m3Tie = encode('464', 'e4m3', 'nan');
	const e4m3Over = encode('465', 'e4m3', 'nan');
	const fp16Tie = encode('65520', 'fp16');

	// BF16 is the top half of FP32: the same value in both, side by side.
	const bfRows = ['1', '0.1', '3.14159', '-0.001', '70000', '1e38'].map((v) => ({
		v,
		fp32: stored(v, 'fp32'),
		bf16: stored(v, 'bf16'),
		fp16: stored(v, 'fp16')
	}));
	const roundedUpRow = bfRows.find((b) => b.bf16.hex !== b.fp32.hex.slice(0, 4));

	// Double rounding: going through FP32 on the way to BF16 can land on a different value.
	const doubleInput = '1.003906250931322574615478515625'; // 1 + 2^-8 + 2^-30
	const direct = encode(doubleInput, 'bf16');
	const viaFp32 = encode(doubleInput, 'fp32');
	const viaBf16 = encodeParsed(asParsed(stored(doubleInput, 'fp32')), 'bf16');

	// Truncating FP32 to BF16 instead of rounding it.
	const truncSource = stored('0.1', 'fp32');
	const truncated = decode(parseInt(truncSource.hex.slice(0, 4), 16), 'bf16');
	const roundedBf = stored('0.1', 'bf16');
	const e4m3Hundred = encode('100', 'e4m3');

	const block = mxBlock(['0.31', '-1.2', '2.5', '0.05', '-0.7', '1.9', '0.004', '-2.2']);

	const fp4Codes = allCodes('e2m1');
	const e4m3Codes = allCodes('e4m3').slice(0, 128);
	const spaced = (d: Decoded) => {
		const f = FORMATS[d.format];
		return `${d.bits[0]} ${d.bits.slice(1, 1 + f.exponentBits)} ${d.bits.slice(1 + f.exponentBits)}`;
	};

	const fp16 = facts('fp16');
	const e4m3 = facts('e4m3');
	const e5m2 = facts('e5m2');
	const bf16 = facts('bf16');
	const fp16Over = encode('70000', 'fp16');

	const faqs = [
		{
			q: 'What is the difference between FP16 and BF16?',
			a: `Both are 16 bits, but they split them differently. FP16 (IEEE half precision) has 5 exponent bits and 10 mantissa bits, so it is more precise, about ${digitsText(
				fp16.decimalDigits
			)} decimal digits, but its largest value is only ${
				fp16.max.exact
			}. BF16 has 8 exponent bits and 7 mantissa bits, the same exponent as FP32, so it reaches about ${shortValue(
				bf16.max,
				8
			)} but keeps only about ${digitsText(
				bf16.decimalDigits
			)} digits. Training tends to need range more than digits, which is why BF16 is popular there.`
		},
		{
			q: 'What is the largest FP16 number?',
			a: `${fp16.max.exact}, stored as ${fp16.max.hex}: the largest exponent, 2¹⁵, times 1.1111111111 in binary. Anything from ${fp16Tie.input} up rounds to infinity, because ${fp16Tie.input} is exactly halfway to the next step and ties go to the even pattern, which is infinity. That is why ${fp16Over.input} overflows in FP16 but not in BF16.`
		},
		{
			q: 'What is the difference between FP8 E4M3 and E5M2?',
			a: `E4M3 spends 4 bits on the exponent and 3 on the mantissa: finer steps but a largest value of ${e4m3.max.exact}. E5M2 spends 5 on the exponent and 2 on the mantissa: coarser steps but a largest value of ${e5m2.max.exact}. E5M2 keeps IEEE-style infinities and NaNs; E4M3 gives up infinity so the top exponent can hold more numbers, and only S.1111.111 is NaN. The paper that proposed the pair suggests E4M3 for weights and activations and E5M2 for gradients.`
		},
		{
			q: 'What happens when a number is too big for FP8?',
			a: `In E5M2, as in FP16 and BF16, it becomes infinity. E4M3 has no infinity, so the OCP specification allows two behaviours: saturate to ±${e4m3.max.exact}, or produce NaN. This converter saturates by default and lets you switch to NaN. Either way the threshold is ${e4m3Tie.input}, halfway to the step above ${e4m3.max.exact}; ${e4m3Tie.input} itself rounds down to ${e4m3Tie.result?.exact} because ties go to even.`
		},
		{
			q: 'Why is BF16 just the top half of an FP32?',
			a: "Because it was designed that way: the sign and the 8 exponent bits are the same as FP32, and the 7 mantissa bits are the top 7 of FP32's 23. Converting is dropping the low 16 bits, after rounding, so BF16 covers the same range as FP32 and converts to and from it cheaply. The cost is precision: about 2 to 3 significant decimal digits."
		},
		{
			q: 'What is FP4 and what values can it hold?',
			a: `FP4 E2M1 has 1 sign bit, 2 exponent bits and 1 mantissa bit, with no infinity and no NaN, so all 16 codes are numbers: ±${fp4Codes
				.filter((d) => d.sign === 0)
				.map((d) => d.exact)
				.join(
					', '
				)}. On its own that is very little, so it is used with block scaling: in MXFP4, every 32 values share one 8-bit power-of-two scale.`
		}
	];

	const page = {
		title: 'FP16, BF16, FP8 and FP4 Converter: Half Precision, bfloat16',
		description:
			'Convert a decimal to FP16, BF16, FP8 E4M3 and E5M2, and FP4 at once: the sign, exponent and mantissa bits, the exact value stored and the rounding error.',
		url: `${SITE}/fp16-bf16-fp8-converter`,
		image: `${SITE}/og/fp16-bf16-fp8-converter.png`,
		imageAlt: 'LogicGates.org: FP16, BF16, FP8 and FP4 converter'
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
					{ '@type': 'ListItem', position: 3, name: 'FP16, BF16 and FP8 converter' }
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
		{ href: '/ieee-754-converter', label: 'IEEE 754 converter' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary' },
		{ href: '/integer-limits', label: 'Integer limits' },
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>FP16, BF16, FP8 and FP4 converter</h1>
		<p class="lede">
			Type a decimal to see it in every low-precision float used in machine learning and graphics at once: the bits, the
			value each format actually stores, and how far that is from what you typed. Or type a bit pattern to read it back.
		</p>

		<div class="card tool">
			<div class="opts">
				<div class="opt" role="group" aria-label="Input">
					<span class="opt-label">Input</span>
					<button
						type="button"
						class:active={mode === 'dec'}
						aria-pressed={mode === 'dec'}
						on:click={() => setMode('dec')}>Decimal</button
					>
					<button
						type="button"
						class:active={mode === 'hex'}
						aria-pressed={mode === 'hex'}
						on:click={() => setMode('hex')}>Hex bits</button
					>
					<button
						type="button"
						class:active={mode === 'bin'}
						aria-pressed={mode === 'bin'}
						on:click={() => setMode('bin')}>Binary bits</button
					>
				</div>
				<div class="opt" role="group" aria-label={mode === 'dec' ? 'Format to work through' : 'Format of the bits'}>
					<span class="opt-label">{mode === 'dec' ? 'Work through' : 'Format'}</span>
					{#each FORMAT_IDS as id}
						<button
							type="button"
							class:active={format === id}
							aria-pressed={format === id}
							on:click={() => setFormat(id)}>{FORMATS[id].name}</button
						>
					{/each}
				</div>
			</div>

			<label class="field" for="value"
				>{mode === 'dec'
					? 'Decimal number'
					: mode === 'hex'
					? `${FORMATS[format].name} bit pattern in hex (${Math.ceil(FORMATS[format].bits / 4)} digit${
							FORMATS[format].bits > 4 ? 's' : ''
					  })`
					: `${FORMATS[format].name} bit pattern (${FORMATS[format].bits} bits)`}</label
			>
			<input
				id="value"
				class="value-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="value-help"
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<p class="field-help" id="value-help">
				{#if mode === 'dec'}
					Any decimal, such as 0.1, -2.5e-3 or 65504, and also Infinity and NaN. It is rounded straight to each format,
					exactly, never through a JavaScript number.
				{:else}
					Shorter patterns are padded with zeros on the left. A leading {mode === 'hex' ? '0x' : '0b'} and spaces are ignored.
				{/if}
			</p>

			<div class="overflow-row">
				<span class="opt-label" id="of-label">E4M3 overflow</span>
				<div class="opt" role="group" aria-labelledby="of-label">
					<button
						type="button"
						class:active={overflowMode === 'saturate'}
						aria-pressed={overflowMode === 'saturate'}
						on:click={() => (overflowMode = 'saturate')}>Saturate to ±448</button
					>
					<button
						type="button"
						class:active={overflowMode === 'nan'}
						aria-pressed={overflowMode === 'nan'}
						on:click={() => (overflowMode = 'nan')}>Become NaN</button
					>
				</div>
			</div>

			<div class="chips">
				{#each examples as example}
					<button
						type="button"
						class="chip-btn"
						on:click={() => tryValue(example.v, example.mode ?? 'dec', example.fmt ?? format)}
					>
						{example.label}
					</button>
				{/each}
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				{#if shown}
					<div class="bits" role="group" aria-label="The {sf.bits} bits of {sf.name}: click one to flip it">
						<div class="field-bits sign">
							<span class="field-name">Sign</span>
							<span class="bit-row">
								<button
									type="button"
									class="bit"
									tabindex={error ? -1 : 0}
									aria-label="Sign bit, {shown.bits[0]}"
									on:click={() => flip(0)}>{shown.bits[0]}</button
								>
							</span>
						</div>
						<div class="field-bits exponent">
							<span class="field-name">Exponent ({sf.exponentBits})</span>
							<span class="bit-row">
								{#each [...shown.exponentBits] as bit, i}
									<button
										type="button"
										class="bit"
										tabindex={error ? -1 : 0}
										aria-label="Exponent bit {sf.exponentBits - 1 - i}, {bit}"
										on:click={() => flip(1 + i)}>{bit}</button
									>
								{/each}
							</span>
						</div>
						<div class="field-bits mantissa">
							<span class="field-name">Mantissa ({sf.mantissaBits})</span>
							<span class="bit-row">
								{#each [...shown.mantissaBits] as bit, i}
									<button
										type="button"
										class="bit"
										class:nibble={(i + 1) % 4 === 0 && i + 1 < sf.mantissaBits}
										tabindex={error ? -1 : 0}
										aria-label="Mantissa bit {sf.mantissaBits - 1 - i}, {bit}"
										on:click={() => flip(1 + sf.exponentBits + i)}>{bit}</button
									>
								{/each}
							</span>
						</div>
					</div>
					<p class="hint">
						{sf.name}{mode === 'dec' ? ` of ${minus(parsed.normalised)}` : ''}: hex
						<span class="mono">{shown.hex}</span>,
						{kindText[shown.kind]}{shown.exponent !== null && shown.kind !== 'zero'
							? `, ${shown.significand} × ${powerOfTwo(shown.exponent)}`
							: ''}. Click a bit to flip it.
					</p>
				{:else}
					<p class="hint">{detail.enc.note}, so there is no {FORMATS[format].name} pattern to show.</p>
				{/if}

				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-label"
						>{mode === 'dec' || !typed ? 'You typed' : `${FORMATS[typed.format].name} ${typed.hex} is`}</span
					>
					<span class="answer-value mono">{minus(typed ? typed.exact : parsed.normalised)}</span>
					<span class="answer-also">Below: the nearest value in each format, rounded to nearest, ties to even.</span>
				</div>

				<p class="visually-hidden" aria-live="polite">{copied}</p>
				<div class="cards">
					{#each rows as row (row.id)}
						{@const r = row.enc.result}
						<article class="fmt-card" class:current={row.id === format} aria-labelledby="card-{row.id}">
							<header>
								<h3 id="card-{row.id}">{row.f.name}</h3>
								<span class="layout">1 · {row.f.exponentBits} · {row.f.mantissaBits}, bias {row.f.bias}</span>
							</header>
							{#if r}
								<div
									class="mini-bits mono"
									role="group"
									aria-label="Bits: sign {r.bits[0]}, exponent {r.exponentBits}, mantissa {r.mantissaBits}"
								>
									<span class="grp s" title="sign"><span class="tag">S</span><span class="b">{r.bits[0]}</span></span>
									<span class="grp e" title="exponent"
										><span class="tag">E</span><span class="b">{r.exponentBits}</span></span
									>
									<span class="grp m" title="mantissa"
										><span class="tag">M</span><span class="b">{r.mantissaBits}</span></span
									>
								</div>
								<dl class="facts">
									<div>
										<dt>Hex</dt>
										<dd class="mono">
											{r.hex}
											<button
												type="button"
												class="copy"
												aria-label="Copy {row.f.name} hex {r.hex}"
												on:click={() => copy(r.hex, `${row.f.name} ${r.hex}`)}>Copy</button
											>
										</dd>
									</div>
									<div>
										<dt>Stored</dt>
										<dd class="mono wrap stored">{minus(r.exact)}</dd>
									</div>
									<div>
										<dt>Error</dt>
										<dd>
											{#if row.enc.errorShort !== null && row.enc.rounded !== 'exact'}
												<span class="mono">{minus(row.enc.errorShort)}</span>
												{#if row.enc.relativeShort}<span class="rel">({percent(row.enc.relativeShort)} relative)</span
													>{/if}
												<span class="note">{roundedText(row.enc)}</span>
											{:else}
												<span class="note" class:ok={row.enc.rounded === 'exact'}>{roundedText(row.enc)}</span>
											{/if}
										</dd>
									</div>
									<div>
										<dt>Kind</dt>
										<dd>{kindText[r.kind]}</dd>
									</div>
									{#if r.kind !== 'nan' && r.kind !== 'infinity'}
										<div>
											<dt>Neighbours</dt>
											<dd class="mono near">
												{row.nearText.below}
												<span aria-hidden="true">‹</span><span class="visually-hidden">below,</span>
												<strong>{row.nearText.value}</strong>
												<span aria-hidden="true">›</span><span class="visually-hidden">above,</span>
												{row.nearText.above}
											</dd>
										</div>
									{/if}
								</dl>
							{:else}
								<p class="note none">{row.enc.note}: it has no infinity or NaN, only the 16 numbers.</p>
							{/if}
						</article>
					{/each}
				</div>

				{#if steps}
					<details class="steps-box" open>
						<summary>How {minus(parsed.normalised)} rounds to {detail.f.name}: guard, round and sticky bits</summary>
						<p class="small">
							In binary the value is {steps.keptText}{steps.guard}{steps.round}{steps.tail}… × {powerOfTwo(
								steps.lsb + detail.f.mantissaBits
							)}{#if steps.subnormal}, written with the smallest exponent {powerOfTwo(
									steps.lsb + detail.f.mantissaBits
								)} because it is below the normal range (subnormal){/if}. {detail.f.name} keeps {detail.f.mantissaBits} bits
							after the point.
						</p>
						<div
							class="grs mono"
							aria-label="Kept bits {steps.keptText}, guard {steps.guard}, round {steps.round}, sticky {steps.sticky}"
						>
							<span class="grs-cell kept"><span class="tag">kept</span>{steps.keptText}</span>
							<span class="grs-cell"><span class="tag">G</span>{steps.guard}</span>
							<span class="grs-cell"><span class="tag">R</span>{steps.round}</span>
							<span class="grs-cell"><span class="tag">S</span>{steps.sticky}</span>
						</div>
						<p class="small">
							Sticky is 1 if any bit after the round bit is 1 ({steps.tail}…{steps.sticky && !steps.tail.includes('1')
								? ' and more beyond'
								: ''}). {steps.reason}
							{#if detail.enc.overflow}
								The result is beyond {detail.f.name}'s largest value, {minus(facts(detail.id).max.exact)}, so it {detail
									.enc.overflow === 'infinity'
									? 'becomes infinity'
									: detail.enc.overflow === 'nan'
									? 'becomes NaN'
									: 'is clamped to it'}.
							{:else if detail.enc.result}
								Result: <span class="mono">{detail.enc.result.significand}</span> × {powerOfTwo(
									detail.enc.result.exponent ?? 0
								)} = <span class="mono">{minus(detail.enc.result.exact)}</span>.
							{/if}
						</p>
					</details>
				{/if}
			</div>
			<p class="share-row"><ShareLink what="this value and format" /></p>
		</div>
	</section>

	<section id="formats">
		<h2>The formats side by side</h2>
		<p>
			Every one of these is the same idea as the 32 and 64 bit floats on the <a href="/ieee-754-converter"
				>IEEE 754 converter</a
			>: a sign bit, an exponent stored with a bias, and the bits after the point of a binary number 1.mmm. They differ
			only in how many bits go to the exponent, which sets the range, and how many to the mantissa, which sets the
			precision. Every figure in this table is computed by the converter's engine.
		</p>
		<div class="layouts" aria-hidden="true">
			{#each table as t}
				<div class="layout-row">
					<span class="layout-name">{t.format.name}</span>
					<span class="strip">
						<span class="cell s" style="grid-column: span 1" />
						<span class="cell e" style="grid-column: span {t.format.exponentBits}" />
						<span class="cell m" style="grid-column: span {t.format.mantissaBits}" />
					</span>
					<span class="layout-count mono">1·{t.format.exponentBits}·{t.format.mantissaBits}</span>
				</div>
			{/each}
		</div>
		<p class="small legend">
			<span class="key s" /> sign <span class="key e" /> exponent <span class="key m" /> mantissa, drawn to scale. BF16's
			exponent is exactly as wide as FP32's.
		</p>
		<div class="table-wrap">
			<table class="data-table formats">
				<thead>
					<tr>
						<th scope="col">Format</th>
						<th scope="col">Bits S·E·M, bias</th>
						<th scope="col">Largest</th>
						<th scope="col">Smallest normal</th>
						<th scope="col">Smallest subnormal</th>
						<th scope="col">Epsilon</th>
						<th scope="col">Digits</th>
						<th scope="col">Specials</th>
					</tr>
				</thead>
				<tbody>
					{#each table as t}
						<tr>
							<th scope="row">{t.format.name}<span class="aka">{t.format.aka}</span></th>
							<td class="mono">1·{t.format.exponentBits}·{t.format.mantissaBits}, {t.format.bias}</td>
							<td class="mono">{shortValue(t.max, 8)}</td>
							<td class="mono">{pow(t.minNormal)}<span class="approx">≈ {shortValue(t.minNormal, 8)}</span></td>
							<td class="mono">{pow(t.minSubnormal)}<span class="approx">≈ {shortValue(t.minSubnormal, 8)}</span></td>
							<td class="mono">{powerOfTwo(t.epsilonPower)}</td>
							<td class="mono">{digitsText(t.decimalDigits)}</td>
							<td
								>{t.infinities ? '±∞' : 'no ∞'}<span class="approx"
									>{t.nanCount
										? `${groupDecimal(String(t.nanCount))} NaN code${t.nanCount > 1 ? 's' : ''}`
										: 'no NaN'}</span
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="small">
			Epsilon is the gap between 1 and the next value up, 2 to the minus number of mantissa bits. Digits is the
			significand's bits, hidden 1 included, times log₁₀ 2: roughly how many significant decimal digits survive.
		</p>
	</section>

	<section id="how">
		<h2>How the bits make a value</h2>
		<p>
			For a normal number, the value is (−1)<sup>sign</sup> × 1.mantissa × 2<sup>exponent − bias</sup>. The 1 before the
			point is not stored, because a normal number always has it. When the exponent field is all zeros the number is
			subnormal: the hidden bit becomes 0 and the exponent stays at 1 − bias, so the values fade evenly down to zero
			instead of stopping short of it.
		</p>
		<p>
			The formats disagree about the all-ones exponent. The IEEE-style ones (FP32, FP16, BF16 and E5M2) reserve it:
			mantissa zero is infinity, anything else NaN. E4M3 keeps only one NaN, S.1111.111, and uses the rest of the top
			exponent for ordinary numbers, which is how it reaches {e4m3.max.exact} instead of 240. LLVM and PyTorch call it E4M3FN:
			F for finite, N for its non-IEEE NaN. FP4 E2M1 reserves nothing at all: every code is a number.
		</p>
	</section>

	<section id="rounding">
		<h2>Rounding: to nearest, ties to even</h2>
		<p>
			A decimal almost never lands on a value the format can store, so it is rounded to the nearest one. When it is
			exactly halfway between two, it goes to the one whose last mantissa bit is 0, the even one. Always rounding halves
			up would push sums upwards on average; ties to even goes up half the time and down half the time.
		</p>
		<p>
			Hardware does this with three extra bits. Beyond the bits it keeps, it remembers the next bit (the guard), the one
			after that (the round bit) and whether anything at all is set further down (the sticky bit, an OR of the rest).
			Guard 0 means less than half a step: truncate. Guard 1 with round or sticky set means more than half: round up.
			Guard 1 with both clear is an exact tie, and the last kept bit decides.
		</p>
		<div class="worked-grid">
			{#each worked as w}
				{@const s = w.e.steps}
				<div class="card worked">
					<h3>{w.title}</h3>
					{#if s}
						<p class="mono small">
							kept {s.keptText} · G {s.guard} · R {s.round} · S {s.sticky}<br />
							→ {w.e.result?.significand} × {powerOfTwo(w.e.result?.exponent ?? 0)} =
							<strong>{w.e.result?.exact}</strong>
						</p>
						<p class="small">
							{s.reason}
							<a
								href="/fp16-bf16-fp8-converter?v={w.v}{w.fmt === 'fp16' ? '' : `&fmt=${w.fmt}`}"
								on:click|preventDefault={() => tryValue(w.v, 'dec', w.fmt)}>Try it</a
							>
						</p>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<section id="overflow">
		<h2>Too big: infinity, saturation or NaN</h2>
		<p>
			Rounding works as if the exponent could keep growing, and only then checks whether the result fits. So the cut-off
			is not the largest value itself but halfway to the step above it. In FP16 that is {fp16Tie.input}: exactly
			halfway, and the even neighbour is the pattern above {fp16.max.exact}, infinity. In E4M3 it is {e4m3Tie.input},
			halfway between {e4m3.max.exact} and the 480 that S.1111.111 would have been if it were not NaN; here the even neighbour
			is {e4m3Tie.result?.exact}, so {e4m3Tie.input} stays finite and {e4m3Over.input} does not.
		</p>
		<p>
			Formats with infinity overflow to it. E4M3 and FP4 have none. For E4M3 the OCP 8-bit floating point specification
			allows either saturating to ±{e4m3.max.exact} or producing NaN, and it also lets conversions to E5M2 saturate instead
			of overflowing. <strong>This converter shows</strong>: infinity for FP32, FP16, BF16 and E5M2; for E4M3 whichever
			of the two you pick above (saturation unless you change it); and for FP4, which has neither infinity nor NaN, the
			largest value, ±6.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Format</th>
						<th scope="col">Largest</th>
						<th scope="col">Twice the largest becomes</th>
						<th scope="col">Infinity becomes</th>
					</tr>
				</thead>
				<tbody>
					{#each overflowRows as o}
						<tr>
							<th scope="row">{o.name}</th>
							<td class="mono">{shortValue(o.max, 8)}</td>
							<td class="mono"
								>{#if o.id === 'e4m3'}{o.sat.result?.exact} or {o.nan.result?.exact}{:else}{shortValue(
										o.sat.result ?? o.max,
										8
									)}{/if}</td
							>
							<td class="mono"
								>{#if o.id === 'e4m3'}{o.infSat.result?.exact} or {o.infNan.result?.exact}{:else}{o.infSat.result
										? shortValue(o.infSat.result, 8)
										: '—'}{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="bf16">
		<h2>Why BF16 keeps FP32's range</h2>
		<p>
			BF16 is the top 16 bits of an FP32: the same sign, the same 8 bit exponent with the same bias of 127, and the
			first 7 of FP32's 23 mantissa bits. So anything an FP32 can hold, BF16 can hold too, only less precisely, and
			converting is a matter of rounding off the low 16 bits. FP16 has more precision but a 5 bit exponent, so it runs
			out at {fp16.max.exact}. The same values in all three:
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Value</th>
						<th scope="col">FP32 hex</th>
						<th scope="col">BF16 hex</th>
						<th scope="col">BF16 value</th>
						<th scope="col">FP16 value</th>
					</tr>
				</thead>
				<tbody>
					{#each bfRows as b}
						<tr>
							<td class="mono">{minus(b.v)}</td>
							<td class="mono"
								><span class="hi">{b.fp32.hex.slice(0, 4)}</span><span class="lo">{b.fp32.hex.slice(4)}</span></td
							>
							<td class="mono hi">{b.bf16.hex}</td>
							<td class="mono">{minus(shortValue(b.bf16, 10))}</td>
							<td class="mono">{minus(shortValue(b.fp16, 10))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="small">
			The BF16 pattern is the first four hex digits of the FP32 one, or one more when the low half is past halfway and
			rounds up{roundedUpRow ? `, as it does for ${roundedUpRow.v}` : ''}.
		</p>
	</section>

	<section id="block-scaling">
		<h2>Block scaling: how FP4 is usable at all (MXFP4)</h2>
		<p>
			Eight positive values are too few to store anything useful on their own. The OCP microscaling (MX) formats fix
			that by sharing a scale: a block of 32 values stores one 8-bit scale, an E8M0 number that is nothing but a power
			of two (an exponent with bias 127 and no mantissa), and each value is stored as an E2M1 after dividing by it. The
			scale exponent is the power of two of the block's largest magnitude minus 2, the largest exponent of E2M1, so the
			largest value lands between 4 and 8; anything above 6 is clamped.
		</p>
		<p>
			Here is a block of {block.elements.length} values (a real block has 32), worked by the engine. The largest magnitude
			sets the scale to {powerOfTwo(block.scaleExp)}, stored as E8M0 code {block.scaleCode}:
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Value</th>
						<th scope="col">÷ {powerOfTwo(block.scaleExp)}</th>
						<th scope="col">E2M1 bits</th>
						<th scope="col">E2M1 value</th>
						<th scope="col">× {powerOfTwo(block.scaleExp)} again</th>
					</tr>
				</thead>
				<tbody>
					{#each block.elements as el}
						<tr>
							<td class="mono">{minus(el.input)}</td>
							<td class="mono">{minus(el.scaled)}</td>
							<td class="mono">{spaced(el.code)}</td>
							<td class="mono">{minus(el.code.exact)}{el.saturated ? ' (clamped)' : ''}</td>
							<td class="mono">{minus(el.restored)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="small">
			The block costs 4 bits per value plus 8 bits shared by all 32, 4.25 bits per value. Small values in a block with a
			large one lose the most: they fall into E2M1's coarse steps near zero.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Rounding twice.</strong> Converting a decimal to FP32 and then to BF16 is not always the same as
				rounding it straight to BF16. {minus(doubleInput)} (that is 1 + 2⁻⁸ + 2⁻³⁰) goes straight to {direct.result
					?.exact}
				({direct.result?.hex}), but FP32 first rounds it to {viaFp32.result?.exact}, an exact tie for BF16, which then
				goes to {viaBf16.result?.exact} ({viaBf16.result?.hex}). This converter always rounds once, from the exact
				decimal.
			</li>
			<li>
				<strong>Chopping instead of rounding.</strong> Keeping the top 16 bits of an FP32 truncates it. {truncSource.hex}
				(0.1 as FP32) chopped is {truncated.hex} = {truncated.exact}; rounded properly it is {roundedBf.hex} = {roundedBf.exact}.
			</li>
			<li>
				<strong>Assuming FP16 has room.</strong> Its largest value is {fp16.max.exact}, so {fp16Over.input} is already infinity,
				and squares of numbers above about 256 overflow. BF16 or a scale factor avoids that.
			</li>
			<li>
				<strong>Treating E4M3 like an IEEE format.</strong> It has no infinity, 0x7F is NaN rather than infinity, and 0x78
				to 0x7E are ordinary numbers from 256 to 448.
			</li>
			<li>
				<strong>Reading the error as absolute.</strong> An error of {minus(e4m3Hundred.errorShort ?? '')} for 100 in E4M3
				sounds large, but it is {percent(e4m3Hundred.relativeShort)} of the value. For normal numbers every format here keeps
				the relative error below half of its epsilon; only subnormals do worse.
			</li>
		</ul>
	</section>

	<section id="fp4">
		<h2>All 16 FP4 E2M1 values</h2>
		<details class="code-list">
			<summary>Show the FP4 table</summary>
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col">Bits S E M</th>
							<th scope="col">Hex</th>
							<th scope="col">Value</th>
							<th scope="col">Kind</th>
						</tr>
					</thead>
					<tbody>
						{#each fp4Codes as d}
							<tr>
								<td class="mono">{spaced(d)}</td>
								<td class="mono">{d.hex}</td>
								<td class="mono">{minus(d.exact)}</td>
								<td>{kindText[d.kind]}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<section id="e4m3">
		<h2>All 256 FP8 E4M3 codes</h2>
		<p class="section-intro">
			Each row is one magnitude; the negative code is the same with the sign bit set, 0x80 higher.
		</p>
		<details class="code-list">
			<summary>Show the E4M3 table</summary>
			<div class="table-wrap scroll-box">
				<table class="data-table e4m3-table">
					<thead>
						<tr>
							<th scope="col">Bits S E M</th>
							<th scope="col">Hex</th>
							<th scope="col">Negative</th>
							<th scope="col">Value</th>
							<th scope="col">Kind</th>
						</tr>
					</thead>
					<tbody>
						{#each e4m3Codes as d}
							<tr>
								<td class="mono">{spaced(d)}</td>
								<td class="mono">{d.hex}</td>
								<td class="mono">{decode(d.code + 128, 'e4m3').hex}</td>
								<td class="mono">{d.exact}</td>
								<td>{kindText[d.kind]}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
		<p class="reducer">
			For the 32 and 64 bit formats in full detail, see the <a href="/ieee-754-converter">IEEE 754 converter</a>. For
			patterns as plain integers, the <a href="/hex-to-binary">hex to binary converter</a> and the
			<a href="/integer-limits">integer limits</a> pages.
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

	.opts {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 0.9rem;
	}

	.opt {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}

	.opt-label {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.2rem;
		min-width: 6.5rem;
	}

	.opt button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.82rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.opt button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.overflow-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-bottom: 0.8rem;
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

	/* Field colours, as on the IEEE 754 page: sign blue, exponent amber, mantissa green.
	   Each field also carries its name, so colour is never the only cue. */
	.bits {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 14px;
		align-items: flex-start;
	}

	.field-bits {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.field-bits.mantissa {
		flex: 1 1 14rem;
	}

	.field-name {
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.sign .field-name {
		color: #8ab8ff;
	}

	.exponent .field-name {
		color: #f0c060;
	}

	.mantissa .field-name {
		color: #8ede8e;
	}

	.bit-row {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
	}

	.bit {
		font: 600 0.95rem ui-monospace, SFMono-Regular, Menlo, monospace;
		width: 1.45rem;
		height: 1.9rem;
		padding: 0;
		border-radius: 3px;
		cursor: pointer;
		color: #fff;
		background: #0d0d0f;
	}

	.bit.nibble {
		margin-right: 4px;
	}

	.sign .bit {
		border: 1px solid #5d8fd8;
		background: #1a2a45;
	}

	.exponent .bit {
		border: 1px solid #b08a30;
		background: #3a2e12;
	}

	.mantissa .bit {
		border: 1px solid #4e9a4e;
		background: #183018;
	}

	.bit:hover {
		border-color: #fff;
	}

	.hint {
		color: #aaa;
		font-size: 0.82rem;
		margin: 0.5rem 0 0.8rem;
		overflow-wrap: anywhere;
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
		font-size: 1.35rem;
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.82rem;
		margin-top: 0.2rem;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.7rem;
		margin-top: 0.9rem;
	}

	.fmt-card {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.6rem 0.75rem 0.7rem;
		min-width: 0;
	}

	.fmt-card.current {
		border-color: #5db65d;
		box-shadow: inset 3px 0 0 #5db65d;
	}

	.fmt-card header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0 0.6rem;
		margin-bottom: 0.4rem;
	}

	.fmt-card h3 {
		color: #fff;
		font-size: 1rem;
		margin: 0;
	}

	.layout {
		color: #999;
		font-size: 0.75rem;
	}

	.mini-bits {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.45rem;
		font-size: 0.82rem;
	}

	.grp {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid;
		border-radius: 3px;
		max-width: 100%;
	}

	.grp .tag {
		font-size: 0.68rem;
		padding: 0.1rem 0.3rem;
		color: #0d0d0f;
		font-weight: 700;
		display: flex;
		align-items: center;
	}

	.grp .b {
		padding: 0.1rem 0.35rem;
		color: #fff;
		letter-spacing: 0.06em;
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	.grp.s {
		border-color: #5d8fd8;
		background: #1a2a45;
	}

	.grp.s .tag {
		background: #8ab8ff;
	}

	.grp.e {
		border-color: #b08a30;
		background: #3a2e12;
	}

	.grp.e .tag {
		background: #f0c060;
	}

	.grp.m {
		border-color: #4e9a4e;
		background: #183018;
	}

	.grp.m .tag {
		background: #8ede8e;
	}

	.facts {
		margin: 0;
		font-size: 0.85rem;
	}

	.facts div {
		display: grid;
		grid-template-columns: 5.6rem minmax(0, 1fr);
		gap: 0 0.5rem;
		padding: 0.18rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.facts dt {
		color: #999;
	}

	.facts dd {
		margin: 0;
		color: #ddd;
		min-width: 0;
	}

	.stored {
		color: #8ede8e;
	}

	.rel {
		color: #bbb;
		margin-left: 0.2rem;
	}

	.note {
		color: #aaa;
		display: block;
		font-size: 0.8rem;
	}

	.note.ok {
		color: #8ede8e;
	}

	.note.none {
		margin: 0.3rem 0 0;
	}

	.near {
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}

	.near strong {
		color: #fff;
	}

	.copy {
		background: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font: 0.72rem 'Helvetica Neue', Helvetica, Arial, sans-serif;
		margin-left: 0.4rem;
		padding: 0.05rem 0.45rem;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.wrap {
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	.steps-box {
		margin-top: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
		background: #0d0d0f;
	}

	.steps-box summary {
		color: #8ede8e;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.grs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 0.6rem 0;
	}

	.grs-cell {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.15rem 0.5rem;
		color: #fff;
		font-size: 1rem;
	}

	.grs-cell.kept {
		border-color: #4e9a4e;
		background: #183018;
	}

	.grs-cell .tag {
		color: #aaa;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.small {
		color: #bbb;
		font-size: 0.88rem;
		overflow-wrap: anywhere;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* The layout strips: 32 equal columns, so every format's bits line up from the left. */
	.layouts {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 1rem 0 0.4rem;
	}

	.layout-row {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr) 4.2rem;
		align-items: center;
		gap: 0.6rem;
	}

	.layout-name {
		color: #ddd;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.layout-count {
		font-size: 0.78rem;
		color: #bbb;
	}

	.strip {
		display: grid;
		grid-template-columns: repeat(32, minmax(0, 1fr));
		gap: 0;
		height: 1.1rem;
	}

	.cell {
		border: 1px solid rgba(0, 0, 0, 0.5);
		border-radius: 2px;
	}

	.cell.s,
	.key.s {
		background: #8ab8ff;
	}

	.cell.e,
	.key.e {
		background: #f0c060;
		background-image: repeating-linear-gradient(135deg, transparent 0 3px, rgba(0, 0, 0, 0.25) 3px 5px);
	}

	.cell.m,
	.key.m {
		background: #8ede8e;
	}

	.key {
		display: inline-block;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		vertical-align: -0.1rem;
		margin: 0 0.2rem 0 0.5rem;
	}

	.key:first-child {
		margin-left: 0;
	}

	.formats th,
	.formats td {
		white-space: nowrap;
	}

	.formats tbody th {
		color: #fff;
	}

	.formats th,
	.formats td {
		font-size: 0.88rem;
		padding-left: 0.6rem;
		padding-right: 0.6rem;
	}

	.approx {
		display: block;
		color: #999;
		font-size: 0.78rem;
	}

	/* The other names may wrap, which keeps the table inside the column on a laptop. */
	.aka {
		display: block;
		white-space: normal;
		max-width: 8.5rem;
		line-height: 1.3;
		color: #999;
		font-size: 0.75rem;
	}

	.worked-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin-bottom: 1.2rem;
	}

	.worked {
		padding: 0.9rem 1rem;
	}

	.worked h3 {
		color: #fff;
	}

	.worked strong {
		color: #8ede8e;
	}

	.hi {
		color: #fff !important;
	}

	.lo {
		color: #888;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.7rem;
		overflow-wrap: anywhere;
	}

	.points strong {
		color: #fff;
	}

	.code-list summary {
		color: #8ede8e;
		cursor: pointer;
		margin-bottom: 0.6rem;
	}

	.scroll-box {
		max-height: 460px;
		overflow: auto;
	}

	.e4m3-table td {
		white-space: nowrap;
	}

	@media (max-width: 560px) {
		.bit {
			width: 1.3rem;
			height: 1.75rem;
			font-size: 0.85rem;
		}

		.opt-label {
			min-width: 0;
			width: 100%;
		}

		.layout-row {
			grid-template-columns: 4.6rem minmax(0, 1fr);
		}

		.layout-count {
			display: none;
		}
	}
</style>
