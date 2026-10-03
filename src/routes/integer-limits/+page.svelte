<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import { onMount } from 'svelte';
	import {
		intTypes,
		intSlugs,
		intTypeBySlug,
		formulas,
		formatDecimal,
		hexOf,
		lookup,
		jsNumberFit,
		mistakesFor,
		parseInteger,
		storiesFor,
		wrap,
		describeType,
		IntLimitsError,
		MAX_INPUT,
		type IntSlug,
		type IntType,
		type Lookup,
		type Op
	} from '$lib/intLimits';
	import OverflowPlayground from './OverflowPlayground.svelte';
	import OverflowRules from './OverflowRules.svelte';
	import { breakable } from './breakable';
	import { scrollFocus } from './scrollFocus';

	const opIds = ['inc', 'dec', 'dbl', 'neg', 'cast'] as const;
	const DEFAULTS = { q: '3000000000', t: 'int8', v: '127', op: 'inc', to: 'uint8' };

	let query = DEFAULTS.q;
	let pgType: IntSlug = 'int8';
	let pgValue = DEFAULTS.v;
	let pgOp: Op = 'inc';
	let pgTo: IntSlug = 'uint8';

	// The address bar is left alone until the link has been read. Coming back
	// with Back or Forward remounts this page, and the reactive syncUrl below
	// runs before onMount: unguarded, it would replace the link with the defaults.
	let linkRead = false;
	onMount(() => {
		const p = readUrl();
		query = safeText(p.q, MAX_INPUT) ?? query;
		pgType = safeOption(p.t, intSlugs) ?? pgType;
		pgValue = safeText(p.v, MAX_INPUT) ?? pgValue;
		pgOp = safeOption(p.op, opIds) ?? pgOp;
		pgTo = safeOption(p.to, intSlugs) ?? pgTo;
		linkRead = true;
		// Rewrites the address even when nothing changed, so a value the page
		// rejected (an unknown type, a 100 KB string) is not kept and shared.
		syncUrl({ q: query, t: pgType, v: pgValue, op: pgOp, to: pgTo }, DEFAULTS);
		return () => clearTimeout(alertTimer);
	});
	$: if (linkRead) syncUrl({ q: query, t: pgType, v: pgValue, op: pgOp, to: pgTo }, DEFAULTS);

	let found: Lookup = lookup(parseInteger(DEFAULTS.q));
	let lookupError = '';
	$: {
		try {
			found = lookup(parseInteger(query));
			lookupError = '';
		} catch (e) {
			lookupError = e instanceof IntLimitsError ? e.message : 'That is not a whole number';
		}
	}

	// Screen readers hear the error or the answer once typing pauses, not on
	// every keystroke of a half-typed number; the page itself updates at once.
	// Nothing is announced until the reader changes the number (`touched`), so
	// loading the page or a link stays quiet.
	let touched = false;
	let alertText = '';
	let statusText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	$: announce(lookupError, found, touched);
	function announce(error: string, f: Lookup, live: boolean) {
		clearTimeout(alertTimer);
		if (!live) return;
		if (!error) alertText = '';
		alertTimer = setTimeout(() => {
			alertText = error;
			statusText = error ? '' : summary(f);
		}, 500);
	}
	const summary = (f: Lookup) =>
		`${formatDecimal(f.value)}: smallest signed type ${f.smallestSigned?.slug ?? 'none'}, smallest unsigned type ${
			f.smallestUnsigned?.slug ?? 'none'
		}.`;

	const examples = [
		{ label: '255', v: '255' },
		{ label: '-129', v: '-129' },
		{ label: '65,536', v: '65,536' },
		{ label: '2^31', v: '2^31' },
		{ label: '0xFFFFFFFF', v: '0xFFFFFFFF' },
		{ label: '2^53 - 1', v: '2^53 - 1' },
		{ label: '2^64', v: '2^64' }
	];

	function tryLookup(v: string) {
		touched = true;
		query = v;
		document.getElementById('lookup')?.focus();
	}

	const T = (slug: IntSlug) => intTypeBySlug(slug) as IntType;
	const int8 = T('int8');
	const int32 = T('int32');
	const uint32 = T('uint32');
	const int64 = T('int64');
	const signedPairs = intTypes.filter((t) => t.signed);
	const withStories = intTypes.filter((t) => storiesFor(t).length);
	const safeMax = 2n ** 53n - 1n;

	$: js = jsNumberFit(found.value);
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	/** Takes a stale result out of the tab order and the accessibility tree while an error shows. */
	function inertWhen(node: HTMLElement, on: boolean) {
		node.toggleAttribute('inert', on);
		return { update: (v: boolean) => node.toggleAttribute('inert', v) };
	}

	// A few mistakes from the type pages, each computed for the type it concerns.
	const pick = (slug: IntSlug, title: string) => {
		const m = mistakesFor(T(slug)).find((x) => x.title.startsWith(title));
		if (!m) throw new Error(`no mistake "${title}" for ${slug}`);
		return { ...m, slug };
	};
	const mistakes = [
		pick('int32', 'Negating'),
		pick('uint32', 'Counting down'),
		pick('uint32', 'Comparing signed'),
		pick('int32', 'Finding a midpoint'),
		pick('int64', 'Sending 64-bit IDs'),
		pick('int8', 'Reading Java bytes'),
		pick('uint16', 'Multiplying')
	];

	const faqs = [
		{
			q: 'What is the maximum value of an int?',
			a: `In Java, C# and Kotlin an int is 32 bits, so its maximum is ${formatDecimal(
				int32.max
			)} (2³¹ − 1) and its minimum ${formatDecimal(
				int32.min
			)}. C and C++ only promise that int is at least 16 bits, though it is 32 on every common desktop and phone platform. Python’s int has no maximum.`
		},
		{
			q: 'What is the formula for the range of an n-bit integer?',
			a: 'A signed two’s complement integer of n bits holds −2ⁿ⁻¹ to 2ⁿ⁻¹ − 1. An unsigned one holds 0 to 2ⁿ − 1. Both have 2ⁿ distinct values; the signed type just spends half of them on negative numbers.'
		},
		{
			q: 'Why is the maximum 2ⁿ − 1 and not 2ⁿ?',
			a: `Because zero needs a pattern too. n bits make 2ⁿ patterns, and counting from 0 the last one is 2ⁿ − 1. Eight bits all set to 1 are 255, not 256, and 256 needs a ninth bit.`
		},
		{
			q: 'What happens when an integer overflows?',
			a: `The processor keeps the low n bits of the result and drops the carry, so the value wraps around: ${formatDecimal(
				int32.max
			)} + 1 in a 32-bit int becomes ${formatDecimal(
				wrap(int32.max + 1n, int32)
			)}. Java, Go, Kotlin and C# do exactly that by default. C and C++ treat signed overflow as undefined behaviour, Rust panics in debug builds, Swift stops the program, and Python’s ints never overflow at all. Below 32 bits, C, Java, C# and Kotlin do the arithmetic in int, so ${formatDecimal(
				int8.max
			)} + 1 on an 8-bit value is ${formatDecimal(
				int8.max + 1n
			)} until it is stored back into the 8-bit variable; Go, Rust and Swift work at the narrow width itself.`
		},
		{
			q: 'What is the largest integer JavaScript can hold exactly?',
			a: `Number.MAX_SAFE_INTEGER, ${formatDecimal(
				safeMax
			)} or 2⁵³ − 1. JavaScript numbers are 64-bit floats with a 53-bit significand, so past that not every whole number exists: 2⁵³ + 1 rounds to 2⁵³. BigInt has no such limit, and BigInt64Array stores true 64-bit integers.`
		},
		{
			q: 'Which integer type should I use?',
			a: `The smallest type whose range covers every value the data can take, with room to spare for anything that grows, such as counters, IDs and timestamps. A signed 32-bit count of seconds since 1970 runs out in 2038, so time and ever-growing IDs belong in 64 bits. Type a number into the lookup above to see which types hold it.`
		}
	];

	const page = {
		title: 'Integer Limits: Min and Max Values from int8 to uint128',
		description:
			'The minimum and maximum of every integer type from int8 to uint128, in decimal, hex and as powers of two, plus an overflow playground and a type lookup.',
		url: `${SITE}/integer-limits`,
		image: `${SITE}/og/integer-limits.png`,
		imageAlt: 'LogicGates.org: integer limits for int8 to uint128'
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
					{ '@type': 'ListItem', position: 3, name: 'Integer limits' }
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
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/fp16-bf16-fp8-converter', label: 'FP16, BF16, FP8 and FP4 converter' },
		{ href: '/bit-manipulation-tricks', label: 'Bit manipulation tricks' },
		{ href: '/struct-padding-calculator', label: 'Struct padding calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Integer limits</h1>
		<p class="lede">
			The smallest and largest value of every fixed-width integer type, from int8 to uint128, with what each one is
			called in C, Java, C#, Rust, Go, SQL and JavaScript. Type a number to see which types can hold it.
		</p>

		<div class="card tool">
			<label class="field" for="lookup">Which types hold this number?</label>
			<input
				id="lookup"
				class="value-input"
				type="text"
				bind:value={query}
				on:input={() => (touched = true)}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={lookupError ? 'true' : 'false'}
				aria-describedby="lookup-help{lookupError ? ' lookup-error' : ''}"
			/>
			{#if lookupError}
				<p class="error" id="lookup-error">{lookupError}</p>
			{/if}
			{#if alertText}
				<p class="visually-hidden" role="alert">{alertText}</p>
			{/if}
			<p class="visually-hidden" role="status">{statusText}</p>
			<p class="field-help" id="lookup-help">
				A whole number in decimal, 0x hex or 0b binary, negative if you like. Commas are fine, and so are
				<span class="nowrap">2^31 − 1</span> and <span class="nowrap">2³¹ − 1</span>.
			</p>
			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryLookup(example.v)}>{example.label}</button>
				{/each}
			</div>

			<div
				class="results"
				class:stale={!!lookupError}
				aria-hidden={lookupError ? 'true' : 'false'}
				use:inertWhen={!!lookupError}
			>
				<div class="answer">
					<span class="answer-label">Smallest types for {@html breakable(formatDecimal(found.value))}</span>
					<div class="smallest">
						<span
							>Smallest signed type:
							{#if found.smallestSigned}
								<a class="mono strong" href="/integer-limits/{found.smallestSigned.slug}" data-testid="lookup-signed"
									>{found.smallestSigned.slug}</a
								>
							{:else}
								<strong class="none" data-testid="lookup-signed">none up to 128 bits</strong>
							{/if}</span
						>
						<span
							>Smallest unsigned type:
							{#if found.smallestUnsigned}
								<a
									class="mono strong"
									href="/integer-limits/{found.smallestUnsigned.slug}"
									data-testid="lookup-unsigned">{found.smallestUnsigned.slug}</a
								>
							{:else}
								<strong class="none" data-testid="lookup-unsigned"
									>{found.value < 0n ? 'none (it is negative)' : 'none up to 128 bits'}</strong
								>
							{/if}</span
						>
					</div>
					<span class="answer-also">
						It needs {plural(found.bits.signed, 'bit')} as a signed two’s complement number{found.bits.unsigned === null
							? ''
							: ` and ${plural(found.bits.unsigned, 'bit')} as an unsigned one`}.
						{#if !js.exact}
							That is past 2⁵³ − 1 and a JavaScript number cannot hold it exactly{js.rounded === null
								? ''
								: `: it rounds to ${formatDecimal(js.rounded)}`}. A BigInt can.
						{:else if !js.safe}
							That is past Number.MAX_SAFE_INTEGER, 2⁵³ − 1. A JavaScript number holds this exact value, but not all of
							its neighbours, so arithmetic on it is not safe; use a BigInt.
						{/if}
					</span>
				</div>
				<ul class="fit-grid" aria-label="Every type">
					{#each found.all as row}
						<li class:fits={row.fits}>
							<span class="mono">{row.type.slug}</span>
							<span>{row.fits ? 'holds it' : !row.type.signed && found.value < 0n ? 'no negatives' : 'too small'}</span>
						</li>
					{/each}
				</ul>
			</div>
			<p class="share-row"><ShareLink what="this lookup and the playground below" /></p>
		</div>
	</section>

	<section id="table">
		<h2>Minimum and maximum of every integer type</h2>
		<p class="section-intro">
			Each name links to a page with the limits in hex and binary, the type’s name in each language, and an overflow
			playground set to that type.
		</p>
		<div class="table-wrap" use:scrollFocus data-label="Minimum and maximum of every integer type">
			<table class="data-table limits">
				<thead>
					<tr>
						<th scope="col">Type</th>
						<th scope="col" class="num bits-col">Bits</th>
						<th scope="col" class="num">Maximum</th>
						<th scope="col" class="num">Minimum</th>
					</tr>
				</thead>
				<tbody>
					{#each intTypes as t}
						<tr>
							<th scope="row"><a class="mono" href="/integer-limits/{t.slug}">{t.slug}</a></th>
							<td class="num bits-col">{t.bits}</td>
							<td class="num"
								><span class="mono big">{@html breakable(formatDecimal(t.max), 0)}</span><span class="pow"
									>{formulas(t).max}</span
								></td
							>
							<td class="num"
								><span class="mono">{@html breakable(formatDecimal(t.min), 0)}</span>{#if t.signed}<span class="pow"
										>{formulas(t).min}</span
									>{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="formulas">
		<h2>The formulas</h2>
		<p>
			n bits make 2ⁿ different patterns. An unsigned type reads them all as magnitudes, a signed type gives the half
			with the top bit set to negative numbers, using <a href="/twos-complement">two’s complement</a>:
		</p>
		<div class="formula-grid">
			<div class="card formula">
				<h3>Signed, n bits</h3>
				<p class="big-formula">−2ⁿ⁻¹ to 2ⁿ⁻¹ − 1</p>
				<p class="small">
					For 32 bits: −2³¹ to 2³¹ − 1, which is {formatDecimal(int32.min)} to {formatDecimal(int32.max)}.
				</p>
			</div>
			<div class="card formula">
				<h3>Unsigned, n bits</h3>
				<p class="big-formula">0 to 2ⁿ − 1</p>
				<p class="small">For 32 bits: 0 to 2³² − 1, which is 0 to {formatDecimal(uint32.max)}.</p>
			</div>
		</div>
		<p>
			The signed range is lopsided: there is one more negative number than positive, because zero takes one of the
			patterns whose top bit is 0. So the smallest int8 is {formatDecimal(int8.min)} but the largest is only {formatDecimal(
				int8.max
			)}, and negating {formatDecimal(int8.min)} overflows back to itself. In hex the limits are easy to spot: a signed maximum
			is 7F followed by Fs ({hexOf(int64.max, 64)} for int64), the signed minimum is 8 followed by zeros, and an unsigned
			maximum is all Fs.
		</p>
		<div class="table-wrap" use:scrollFocus data-label="Signed and unsigned range of each width">
			<table class="data-table pairs">
				<caption>Same bits, two readings: the signed and unsigned type of each width</caption>
				<thead>
					<tr>
						<th scope="col">Width</th>
						<th scope="col">Signed range</th>
						<th scope="col">Unsigned range</th>
					</tr>
				</thead>
				<tbody>
					{#each signedPairs as t}
						{@const f = formulas(t)}
						<tr>
							<th scope="row">{t.bits} bits</th>
							<td>{f.min} to {f.max}</td>
							<td>0 to 2{f.count.slice(1)} − 1</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="playground">
		<h2>Overflow playground</h2>
		<p class="section-intro">
			Pick a type and a value, then add one, subtract one, double, negate or cast it to another type. The bits show what
			the processor does: it keeps the low bits and drops whatever does not fit.
		</p>
		<div class="card tool">
			<OverflowPlayground bind:type={pgType} bind:value={pgValue} bind:op={pgOp} bind:to={pgTo} />
		</div>
	</section>

	<section id="overflow">
		<h2>What each language does on overflow</h2>
		<p class="section-intro">
			The bits wrap the same way on every processor; what differs is whether the language lets that happen silently,
			stops the program, or never runs out of bits at all. The C, Java, Rust, Go, JavaScript and Python behaviour here
			was checked by running code.
		</p>
		<OverflowRules />
		<p class="reducer">
			One C and C++ detail: arithmetic on 8 and 16-bit types is done in int, so <span class="mono">x + 1</span> on an int8_t
			at 127 is 128 as an int. It only wraps when stored back into the int8_t; that conversion is implementation defined
			in C (GCC and Clang wrap) and defined as wrapping since C++20.
		</p>
	</section>

	<section id="stories">
		<h2>Real overflows and limits</h2>
		<ul class="stories">
			{#each withStories as t}
				{#each storiesFor(t) as story}
					<li>
						<strong>{story.title}</strong>
						<span class="mono">(<a href="/integer-limits/{t.slug}">{t.slug}</a>)</span>: {@html breakable(story.text)}
					</li>
				{/each}
			{/each}
		</ul>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="stories">
			{#each mistakes as m}
				<li>
					<strong>{m.title}</strong>
					<span class="mono">(<a href="/integer-limits/{m.slug}">{m.slug}</a>)</span>: {@html breakable(m.text)}
				</li>
			{/each}
		</ul>
	</section>

	<section id="types">
		<h2>Each type in detail</h2>
		<ul class="type-links">
			{#each intTypes as t}
				<li>
					<a href="/integer-limits/{t.slug}"><span class="mono">{t.slug}</span></a>
					<span>{describeType(t)}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="faq">
		<h2>Questions</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{@html breakable(faq.a)}</p>
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

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
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
		overflow-wrap: break-word;
		text-transform: uppercase;
	}

	.smallest {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1.4rem;
		color: #ddd;
		font-size: 1rem;
		margin: 0.3rem 0;
	}

	.smallest .strong {
		color: #8ede8e;
		font-size: 1.35rem;
		font-weight: 700;
	}

	.smallest .none {
		color: #e9c46a;
		font-weight: 600;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
	}

	.fit-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 6px;
		list-style: none;
		margin: 0.9rem 0 0;
		padding: 0;
	}

	.fit-grid li {
		border: 1px dashed rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0 0.4rem;
		padding: 0.3rem 0.5rem;
		font-size: 0.82rem;
		color: #aaa;
	}

	.fit-grid li span:last-child {
		margin-left: auto;
		white-space: nowrap;
	}

	.fit-grid li.fits {
		border: 1px solid rgba(93, 182, 93, 0.6);
		color: #8ede8e;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.limits th {
		white-space: nowrap;
	}

	.limits tbody th {
		vertical-align: top;
	}

	/* Numbers break only between digit groups (<wbr>), so the table fits a phone. */
	.limits td {
		font-size: 0.9rem;
		vertical-align: top;
	}

	.pow {
		color: #bbb;
		display: block;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.nowrap {
		white-space: nowrap;
	}

	.num {
		text-align: right !important;
	}

	.limits .big {
		color: #8ede8e;
	}

	.formula-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin-bottom: 1rem;
	}

	.formula {
		padding: 0.9rem 1rem;
	}

	.formula h3 {
		color: #fff;
	}

	.big-formula {
		color: #8ede8e;
		font-size: 1.3rem;
		margin: 0.3rem 0;
	}

	.small {
		font-size: 0.9rem;
		margin: 0.3rem 0 0;
	}

	.pairs caption {
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding-bottom: 0.4rem;
	}

	.pairs td {
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.pairs th[scope='row'] {
		color: #fff;
		white-space: nowrap;
	}

	.stories,
	.type-links {
		color: #ddd;
		max-width: 760px;
		padding-left: 1.25rem;
	}

	.stories li,
	.type-links li {
		margin-bottom: 0.6rem;
	}

	/* Long numbers carry <wbr> between digit groups; this is only a safety net. */
	section p,
	.stories li {
		overflow-wrap: break-word;
	}

	.stories strong {
		color: #fff;
	}

	.type-links {
		columns: 2 16rem;
	}

	@media (max-width: 560px) {
		.limits .bits-col {
			display: none;
		}

		.limits td {
			font-size: 0.8rem;
		}

		/* Narrower side padding keeps a 32-bit limit such as −2,147,483,648 on
		   one line at phone width; on a narrower screen it breaks at a comma. */
		.limits th,
		.limits td {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
		}
	}

	.type-links li span:last-child {
		color: #bbb;
		margin-left: 0.4rem;
	}
</style>
