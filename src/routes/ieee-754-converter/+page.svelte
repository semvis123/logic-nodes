<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		encode,
		decode,
		parsePattern,
		patternOf,
		limits,
		formats,
		FloatError,
		type Format,
		type FloatFields,
		type Encoding
	} from '$lib/ieee754';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	type Mode = 'dec' | 'hex' | 'bin';
	const DEFAULTS = { v: '0.1', fmt: 'single', mode: 'dec' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.v, 1300) ?? input;
		format = safeOption(p.fmt, ['single', 'double'] as const) ?? format;
		mode = safeOption(p.mode, ['dec', 'hex', 'bin'] as const) ?? mode;
	});
	$: syncUrl({ v: input, fmt: format, mode }, DEFAULTS);

	let input = DEFAULTS.v;
	let format: Format = 'single';
	let mode: Mode = 'dec';

	// Computed at build time too, so the page is served with 0.1 already worked.
	let fields: FloatFields = encode('0.1', 'single');
	let encoding: Encoding | null = null;
	let error = '';
	$: {
		try {
			if (mode === 'dec') {
				encoding = encode(input, format);
				fields = encoding;
			} else {
				encoding = null;
				fields = decode(parsePattern(input, format, mode === 'hex' ? 'hex' : 'binary'), format);
			}
			error = '';
		} catch (e) {
			error = e instanceof FloatError ? e.message : 'That could not be read';
		}
	}
	$: f = formats[format];

	/** Switching format or mode carries the current value across, rather than reinterpreting the text. */
	function setFormat(next: Format) {
		if (next === format) return;
		if (!error) input = mode === 'dec' ? input : fields.shortest;
		if (!error && mode !== 'dec') mode = 'dec';
		format = next;
	}

	function setMode(next: Mode) {
		if (next === mode) return;
		if (!error) {
			if (next === 'dec') input = fields.shortest;
			else if (next === 'hex') input = fields.hex;
			else input = fields.bits;
		}
		mode = next;
	}

	/** Clicking a bit flips it; the input becomes the new pattern in hex. */
	function flip(index: number) {
		if (error) return;
		const bits = [...fields.bits];
		bits[index] = bits[index] === '1' ? '0' : '1';
		input = BigInt('0b' + bits.join(''))
			.toString(16)
			.toUpperCase()
			.padStart(f.bits / 4, '0');
		mode = 'hex';
	}

	function tryValue(v: string, fmt: Format = format, m: Mode = 'dec') {
		format = fmt;
		mode = m;
		input = v;
		const field = document.getElementById('value');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; v: string; mode?: Mode }[] = [
		{ label: '0.1', v: '0.1' },
		{ label: '1', v: '1' },
		{ label: '-2.5', v: '-2.5' },
		{ label: '3.14159265358979', v: '3.14159265358979' },
		{ label: '16777217', v: '16777217' },
		{ label: '1e-40', v: '1e-40' },
		{ label: '-0', v: '-0' },
		{ label: 'Infinity', v: 'Infinity' },
		{ label: 'NaN', v: 'NaN' },
		{ label: 'Bits 40490FDB', v: '40490FDB', mode: 'hex' }
	];

	const kindText: Record<string, string> = {
		zero: 'Zero',
		subnormal: 'Subnormal',
		normal: 'Normal',
		infinity: 'Infinity',
		nan: 'Not a number (NaN)'
	};

	/** The fraction bits written as a sum of powers of two is too long; show the value of 1.f in decimal instead. */
	function significandValue(x: FloatFields): string {
		if (x.kind !== 'normal' && x.kind !== 'subnormal') return '';
		const frac = BigInt('0b' + x.fractionBits);
		const fb = formats[x.format].fractionBits;
		const whole = x.kind === 'normal' ? 1n << BigInt(fb) : 0n;
		// (whole + frac) / 2^fb, written exactly.
		const n = (whole + frac) * 5n ** BigInt(fb);
		const s = n.toString().padStart(fb + 1, '0');
		return `${s.slice(0, -fb)}.${s.slice(-fb)}`.replace(/0+$/, '').replace(/\.$/, '.0');
	}

	$: exponentLine =
		fields.kind === 'normal'
			? `${fields.biased} − ${f.bias} = ${minus(String(fields.exponent))}`
			: fields.kind === 'subnormal' || fields.kind === 'zero'
			? `all zeros, so 1 − ${f.bias} = ${minus(String(fields.exponent))}`
			: 'all ones: infinity or NaN';

	const minus = (s: string) => s.replace(/^-/, '−');

	// --- Generated reference content ---------------------------------------
	const table = (['single', 'double'] as const).map((fmt) => ({ fmt, ...formats[fmt], ...limits(fmt) }));
	const d = (v: string) => encode(v, 'double');
	const pointOne = d('0.1');
	const pointTwo = d('0.2');
	const pointThree = d('0.3');
	const sum = decode(patternOf(0.1 + 0.2, 'double'), 'double');
	const bigInt = encode('16777217', 'single');
	const specials = [
		{ name: 'Zero', v: '0' },
		{ name: 'Negative zero', v: '-0' },
		{ name: 'Infinity', v: 'Infinity' },
		{ name: 'Negative infinity', v: '-Infinity' },
		{ name: 'NaN', v: 'NaN' },
		{ name: 'Smallest subnormal', v: limits('single').minSubnormal.exact },
		{ name: 'Smallest normal', v: limits('single').minNormal.exact },
		{ name: 'Largest finite', v: limits('single').max.exact }
	].map((s) => ({ ...s, x: encode(s.v, 'single') }));
	const sigDigits = (fmt: Format) => Math.floor((formats[fmt].fractionBits + 1) * Math.log10(2));

	const faqs = [
		{
			q: 'What is IEEE 754?',
			a: 'The standard that almost every processor and programming language uses for floating point numbers. It fixes the layout of the bits, one sign bit, then an exponent, then a fraction, and it fixes how results are rounded, so the same calculation gives the same bits on any machine. float in C and Java is its 32 bit single precision format; double, and every number in JavaScript, is the 64 bit double precision format.'
		},
		{
			q: 'Why is 0.1 + 0.2 not equal to 0.3?',
			a: `Because none of the three can be stored exactly. 0.1 in binary is 0.0001100110011… repeating forever, so it is rounded to the nearest double, which is slightly above 0.1. The same happens to 0.2. Their sum rounds to ${sum.shortest}, while 0.3 on its own rounds to a different double slightly below 0.3, so the comparison fails. Compare floats with a tolerance instead of ==.`
		},
		{
			q: 'How do I convert a decimal number to IEEE 754 by hand?',
			a: 'Write the number in binary, then shift the point until one 1 is left in front of it: 5.75 is 101.11, which is 1.0111 × 2². The sign bit is 0 for positive. The exponent field is the power plus the bias, 2 + 127 = 129 = 10000001 for single precision. The fraction is the bits after the point, 0111, padded with zeros to 23 bits. The leading 1 is not stored.'
		},
		{
			q: 'What is the exponent bias?',
			a: 'A fixed number added to the real exponent so the field can be stored as an unsigned number: 127 for single precision and 1023 for double. An exponent field of 127 in a float means 2⁰. Storing it biased means larger floats have larger bit patterns, so positive floats can be compared as plain integers.'
		},
		{
			q: 'What are subnormal numbers?',
			a: 'Numbers too small for the normal format. When the exponent field is all zeros, the hidden leading bit becomes 0 instead of 1 and the exponent stays at its minimum, so values fade towards zero in even steps instead of jumping from the smallest normal number straight to zero. They cost precision, and on some processors speed.'
		},
		{
			q: 'Why are there two zeros?',
			a: 'Because the sign bit is separate from the rest, +0 and −0 have different bit patterns. They compare equal, but they behave differently in a few places: 1/+0 is +Infinity and 1/−0 is −Infinity. A negative number that underflows keeps its sign as −0.'
		},
		{
			q: 'How precise are float and double?',
			a: `A float has a 24 bit significand, about ${sigDigits(
				'single'
			)} significant decimal digits, and a double has 53 bits, about ${sigDigits(
				'double'
			)}. Every integer up to 2²⁴ = 16,777,216 fits exactly in a float and every integer up to 2⁵³ in a double; above that, some integers are skipped, which is why 16777217 becomes 16777216 as a float.`
		}
	];

	const page = {
		title: 'IEEE 754 Floating Point Converter: Float and Double',
		description:
			'See how a decimal is stored as a 32 bit float or 64 bit double: the sign, exponent and fraction bits, the exact value stored and the rounding error.',
		url: `${SITE}/ieee-754-converter`,
		image: `${SITE}/og/ieee-754-converter.png`,
		imageAlt: 'LogicGates.org: IEEE 754 floating point converter'
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
					{ '@type': 'ListItem', position: 3, name: 'IEEE 754 converter' }
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
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary' },
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>IEEE 754 floating point converter</h1>
		<p class="lede">
			Type a decimal number to see exactly how a computer stores it as a 32 bit float or a 64 bit double: the sign,
			exponent and fraction bits, the value actually stored, and how far that is from what you typed.
		</p>

		<div class="card tool">
			<div class="opts">
				<div class="opt" role="group" aria-label="Format">
					<span class="opt-label">Format</span>
					<button
						type="button"
						class:active={format === 'single'}
						aria-pressed={format === 'single'}
						on:click={() => setFormat('single')}>Float (32 bit)</button
					>
					<button
						type="button"
						class:active={format === 'double'}
						aria-pressed={format === 'double'}
						on:click={() => setFormat('double')}>Double (64 bit)</button
					>
				</div>
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
			</div>

			<label class="field" for="value"
				>{mode === 'dec'
					? 'Decimal number'
					: mode === 'hex'
					? `Bit pattern in hex (${f.bits / 4} digits)`
					: `Bit pattern (${f.bits} bits)`}</label
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
					Any decimal, such as 3.14, -2.5e-8 or 1e300, and also Infinity, -Infinity and NaN.
				{:else}
					Shorter patterns are padded with zeros on the left. A leading {mode === 'hex' ? '0x' : '0b'} is ignored.
				{/if}
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryValue(example.v, format, example.mode ?? 'dec')}>
						{example.label}
					</button>
				{/each}
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<div class="bits" role="group" aria-label="The {f.bits} bits: click one to flip it">
					<div class="field-bits sign">
						<span class="field-name">Sign</span>
						<span class="bit-row">
							<button
								type="button"
								class="bit"
								tabindex={error ? -1 : 0}
								aria-label="Sign bit, {fields.bits[0]}"
								on:click={() => flip(0)}>{fields.bits[0]}</button
							>
						</span>
					</div>
					<div class="field-bits exponent">
						<span class="field-name">Exponent ({f.exponentBits} bits)</span>
						<span class="bit-row">
							{#each [...fields.exponentBits] as bit, i}
								<button
									type="button"
									class="bit"
									tabindex={error ? -1 : 0}
									aria-label="Exponent bit {f.exponentBits - 1 - i}, {bit}"
									on:click={() => flip(1 + i)}>{bit}</button
								>
							{/each}
						</span>
					</div>
					<div class="field-bits fraction">
						<span class="field-name">Fraction ({f.fractionBits} bits)</span>
						<span class="bit-row">
							{#each [...fields.fractionBits] as bit, i}
								<button
									type="button"
									class="bit"
									class:nibble={(i + 1) % 4 === 0}
									tabindex={error ? -1 : 0}
									aria-label="Fraction bit {f.fractionBits - 1 - i}, {bit}"
									on:click={() => flip(1 + f.exponentBits + i)}>{bit}</button
								>
							{/each}
						</span>
					</div>
				</div>
				<p class="hint">Click a bit to flip it. Hex: <span class="mono">{fields.hex}</span></p>

				<dl class="field-list">
					<div class="field-row">
						<dt><span class="dot sign" />Sign</dt>
						<dd class="mono">{fields.bits[0]}</dd>
						<dd class="meaning">{fields.sign ? 'negative' : 'positive'}</dd>
					</div>
					<div class="field-row">
						<dt><span class="dot exponent" />Exponent</dt>
						<dd class="mono">{fields.exponentBits}</dd>
						<dd class="meaning">{exponentLine}</dd>
					</div>
					<div class="field-row">
						<dt><span class="dot fraction" />Significand</dt>
						<dd class="mono wrap">{fields.significand || '—'}</dd>
						<dd class="meaning mono wrap">
							{significandValue(fields) ? `= ${significandValue(fields)}` : kindText[fields.kind]}
						</dd>
					</div>
				</dl>

				{#if fields.kind === 'normal' || fields.kind === 'subnormal'}
					<p class="formula mono">
						{fields.sign ? '−' : '+'}{significandValue(fields).length > 24
							? significandValue(fields).slice(0, 22) + '…'
							: significandValue(fields)} × 2<sup>{minus(String(fields.exponent))}</sup>
					</p>
				{/if}

				<div class="answers" role={error ? undefined : 'status'}>
					<div class="answer wide">
						<span class="answer-label">Value stored ({kindText[fields.kind].toLowerCase()})</span>
						<span class="answer-value mono">{minus(fields.exact)}</span>
					</div>
					<div class="answer">
						<span class="answer-label">Shortest decimal that reads back the same</span>
						<span class="answer-value mono">{minus(fields.shortest)}</span>
					</div>
					{#if encoding}
						<div class="answer" class:exact={encoding.rounded === 'exact'}>
							<span class="answer-label">Rounding error</span>
							{#if encoding.overflowed}
								<span class="answer-value mono">too large: became {minus(fields.exact)}</span>
							{:else if encoding.rounded === 'exact'}
								<span class="answer-value mono">0, stored exactly</span>
							{:else}
								<span class="answer-value mono">{minus(encoding.errorShort)}</span>
								<span class="answer-note">rounded {encoding.rounded}{encoding.underflowed ? ' to zero' : ''}</span>
							{/if}
						</div>
					{/if}
					{#if fields.gap && fields.exponent !== null}
						<div class="answer">
							<span class="answer-label">Gap to the next {format === 'single' ? 'float' : 'double'}</span>
							<span class="answer-value mono"
								>2<sup>{minus(String(fields.exponent - f.fractionBits))}</sup> ≈ {minus(
									Number(fields.gap).toPrecision(4)
								)}</span
							>
						</div>
					{/if}
				</div>
				{#if encoding && encoding.rounded !== 'exact' && !encoding.overflowed}
					<details class="exact-error">
						<summary>The rounding error in full</summary>
						<p class="mono wrap">{minus(encoding.error)}</p>
						<p class="small">
							Stored value minus the number typed, exactly. It is {encoding.rounded === 'up' ? 'positive' : 'negative'} because
							the nearest {format === 'single' ? 'float' : 'double'} is {encoding.rounded === 'up' ? 'above' : 'below'} it.
						</p>
					</details>
				{/if}
			</div>
			<p class="share-row"><ShareLink what="this number" /></p>
		</div>
	</section>

	<section id="how">
		<h2>How floating point works</h2>
		<p>
			A float is scientific notation in binary. Any nonzero number can be written as 1.something × 2<sup>n</sup>, the
			way decimal scientific notation writes 6.02 × 10<sup>23</sup>. IEEE 754 stores three parts of that:
		</p>
		<ul class="points">
			<li>
				<strong class="t-sign">Sign</strong>: one bit, 0 for positive and 1 for negative. The rest of the number is the
				same either way, unlike <a href="/twos-complement">two's complement</a> integers.
			</li>
			<li>
				<strong class="t-exp">Exponent</strong>: the power n, stored with a bias added so the field is never negative.
				For a float the bias is 127, so 2<sup>0</sup> is stored as 127 and 2<sup>−3</sup> as 124.
			</li>
			<li>
				<strong class="t-frac">Fraction</strong>: the bits after the point. The 1 before the point is always there for a
				normal number, so it is not stored at all, which gains a bit of precision for free.
			</li>
		</ul>
		<div class="table-wrap">
			<table class="data-table formats">
				<thead>
					<tr>
						<th scope="col" />
						{#each table as t}<th scope="col">{t.fmt === 'single' ? 'Float (single)' : 'Double'}</th>{/each}
					</tr>
				</thead>
				<tbody>
					<tr
						><th scope="row">Total bits</th>{#each table as t}<td>{t.bits}</td>{/each}</tr
					>
					<tr
						><th scope="row">Exponent bits</th>{#each table as t}<td>{t.exponentBits}</td>{/each}</tr
					>
					<tr
						><th scope="row">Fraction bits</th>{#each table as t}<td>{t.fractionBits} (+1 hidden)</td>{/each}</tr
					>
					<tr
						><th scope="row">Bias</th>{#each table as t}<td>{t.bias}</td>{/each}</tr
					>
					<tr
						><th scope="row">Decimal digits</th>{#each table as t}<td>about {sigDigits(t.fmt)}</td>{/each}</tr
					>
					<tr
						><th scope="row">Largest</th>{#each table as t}<td class="mono">{t.max.shortest}</td>{/each}</tr
					>
					<tr
						><th scope="row">Smallest normal</th>{#each table as t}<td class="mono">{t.minNormal.shortest}</td
							>{/each}</tr
					>
					<tr
						><th scope="row">Smallest subnormal</th>{#each table as t}<td class="mono">{t.minSubnormal.shortest}</td
							>{/each}</tr
					>
					<tr
						><th scope="row">Epsilon (gap above 1)</th>{#each table as t}<td class="mono">{t.epsilon.shortest}</td
							>{/each}</tr
					>
				</tbody>
			</table>
		</div>
		<p>
			Between two powers of two there are always the same number of floats, 2<sup>23</sup> for single precision, so the
			gap between neighbours doubles every time the exponent goes up by one. Above 2<sup>24</sup> the gap is 2, and a
			float can no longer hold every integer: 16777217 is stored as {bigInt.shortest}, rounded {bigInt.rounded}.
			<a href="/ieee-754-converter?v=16777217" on:click|preventDefault={() => tryValue('16777217', 'single')}>See it</a
			>.
		</p>
	</section>

	<section id="point-one">
		<h2>Why 0.1 + 0.2 is not 0.3</h2>
		<p>
			One tenth has no finite binary expansion, just as one third has none in decimal: it is 0.000110011001100… with the
			1100 repeating forever. A double keeps 53 significant bits and rounds the rest, so each of these numbers is stored
			as something slightly different. These are the exact values of the doubles, computed by the converter's engine:
		</p>
		<div class="table-wrap">
			<table class="data-table exacts">
				<thead><tr><th scope="col">Typed</th><th scope="col">Exact value of the double stored</th></tr></thead>
				<tbody>
					<tr><td class="mono">0.1</td><td class="mono wrap">{pointOne.exact}</td></tr>
					<tr><td class="mono">0.2</td><td class="mono wrap">{pointTwo.exact}</td></tr>
					<tr class="hl"><td class="mono">0.1 + 0.2</td><td class="mono wrap">{sum.exact}</td></tr>
					<tr class="hl"><td class="mono">0.3</td><td class="mono wrap">{pointThree.exact}</td></tr>
				</tbody>
			</table>
		</div>
		<p>
			0.1 is rounded {pointOne.rounded} and 0.2 is rounded {pointTwo.rounded}. Their sum is rounded again, to the double
			printed as <span class="mono">{sum.shortest}</span>. But 0.3 on its own is rounded {pointThree.rounded}, to a
			different double, <span class="mono">{pointThree.hex}</span> rather than
			<span class="mono">{sum.hex}</span>. The two differ in the last bit, so <span class="mono">0.1 + 0.2 == 0.3</span>
			is false in JavaScript, Python, C and every other language using IEEE 754 doubles. The fix is to compare with a small
			tolerance, or to use integers (cents rather than pounds) when values must be exact.
		</p>
	</section>

	<section id="special">
		<h2>Special values</h2>
		<p class="section-intro">
			The all-zeros and all-ones exponents are reserved. All zeros means zero or a subnormal; all ones means infinity or
			NaN. These are the float (32 bit) patterns:
		</p>
		<div class="table-wrap">
			<table class="data-table specials">
				<thead>
					<tr
						><th scope="col">Value</th><th scope="col">Hex</th><th scope="col">Sign</th><th scope="col">Exponent</th><th
							scope="col">Fraction</th
						></tr
					>
				</thead>
				<tbody>
					{#each specials as s}
						<tr>
							<th scope="row">{s.name}</th>
							<td class="mono">{s.x.hex}</td>
							<td class="mono t-sign">{s.x.bits[0]}</td>
							<td class="mono t-exp">{s.x.exponentBits}</td>
							<td class="mono t-frac">{s.x.fractionBits.slice(0, 6)}…{s.x.fractionBits.slice(-3)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			NaN, not a number, is the result of operations with no sensible answer, such as 0 ÷ 0 or ∞ − ∞. Any fraction other
			than zero under an all-ones exponent is a NaN, and a NaN is not equal even to itself. Subnormals fill the gap
			between the smallest normal number and zero in even steps, so that x − y is zero only when x equals y.
		</p>
		<p class="reducer">
			Integers use a different encoding: see the <a href="/binary-converter">binary converter</a> and
			<a href="/twos-complement">two's complement</a>. To see the bits of a hex pattern one nibble at a time, use the
			<a href="/hex-to-binary">hex to binary converter</a>.
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
		flex-wrap: wrap;
		gap: 0.6rem 1.2rem;
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

	/* Field colours: sign blue, exponent amber, fraction green. */
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

	.field-bits.fraction {
		flex: 1 1 18rem;
	}

	.field-name {
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.sign .field-name,
	.t-sign {
		color: #8ab8ff;
	}

	.exponent .field-name,
	.t-exp {
		color: #f0c060;
	}

	.fraction .field-name,
	.t-frac {
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

	.fraction .bit {
		border: 1px solid #4e9a4e;
		background: #183018;
	}

	.bit:hover {
		border-color: #fff;
	}

	.hint {
		color: #999;
		font-size: 0.8rem;
		margin: 0.5rem 0 0.8rem;
	}

	/* Name, bits and meaning in three columns; on a phone the meaning drops
	   under the bits so none of them is squeezed into a sliver. */
	.field-list {
		margin: 0;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		background: #161618;
	}

	.field-row {
		display: grid;
		grid-template-columns: 8.5rem minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.2rem 1rem;
		padding: 0.5rem 0.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.field-row:last-child {
		border-bottom: none;
	}

	.field-row dt {
		color: #fff;
		white-space: nowrap;
	}

	.field-row dd {
		margin: 0;
		color: #ddd;
	}

	@media (max-width: 560px) {
		.field-row {
			grid-template-columns: 7rem minmax(0, 1fr);
		}

		.field-row .meaning {
			grid-column: 2;
			color: #bbb;
			font-size: 0.9rem;
		}
	}

	.dot {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		margin-right: 0.4rem;
	}

	.dot.sign {
		background: #8ab8ff;
	}

	.dot.exponent {
		background: #f0c060;
	}

	.dot.fraction {
		background: #8ede8e;
	}

	.wrap {
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	.formula {
		color: #fff;
		font-size: 1rem;
		margin: 0.8rem 0 0;
		overflow-wrap: anywhere;
	}

	.answers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.7rem;
		margin-top: 1rem;
	}

	.answer {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
		min-width: 0;
	}

	.answer.wide {
		grid-column: 1 / -1;
		border-color: rgba(93, 182, 93, 0.5);
	}

	.answer-label {
		color: #999;
		display: block;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-value {
		color: #fff;
		display: block;
		font-size: 1.05rem;
		overflow-wrap: anywhere;
		word-break: break-all;
	}

	.answer.wide .answer-value {
		color: #8ede8e;
		font-size: 1.15rem;
	}

	.answer.exact .answer-value {
		color: #8ede8e;
	}

	.answer-note {
		color: #aaa;
		display: block;
		font-size: 0.78rem;
	}

	.exact-error {
		margin-top: 0.8rem;
	}

	.exact-error summary {
		color: #8ede8e;
		cursor: pointer;
		font-size: 0.88rem;
	}

	.small {
		color: #bbb;
		font-size: 0.85rem;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.6rem;
	}

	.formats th {
		white-space: nowrap;
	}

	@media (max-width: 560px) {
		.formats td,
		.formats th {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
			font-size: 0.85rem;
		}
	}

	.formats tbody th,
	.specials tbody th {
		color: #ddd;
	}

	.exacts tr.hl td {
		background-color: rgba(255, 255, 255, 0.05);
		color: #fff;
	}

	.exacts td:first-child {
		white-space: nowrap;
	}

	.specials td,
	.specials th {
		white-space: nowrap;
	}

	@media (max-width: 560px) {
		.bit {
			width: 1.3rem;
			height: 1.75rem;
			font-size: 0.85rem;
		}
	}
</style>
