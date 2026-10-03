<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import {
		intTypes,
		intSlugs,
		intTypeBySlug,
		formulas,
		formatDecimal,
		hexOf,
		binaryOf,
		nibbles,
		namesFor,
		storiesFor,
		usesOf,
		scientific,
		digitCount,
		describeType,
		twinOf,
		wrap,
		jsWrapExample,
		typeTitle,
		typeDescription,
		typeFaqs,
		mistakesFor,
		MAX_INPUT,
		type IntSlug,
		type IntType,
		type Op
	} from '$lib/intLimits';
	import OverflowPlayground from '../OverflowPlayground.svelte';
	import OverflowRules from '../OverflowRules.svelte';
	import CopyButton from '../CopyButton.svelte';
	import { breakable } from '../breakable';
	import { scrollFocus } from '../scrollFocus';
	import type { PageData } from './$types';

	export let data: PageData;

	$: t = intTypeBySlug(data.slug) as IntType;
	$: f = formulas(t);
	$: twin = twinOf(t);
	$: index = intTypes.indexOf(t);
	$: prev = index > 0 ? intTypes[index - 1] : null;
	$: next = index < intTypes.length - 1 ? intTypes[index + 1] : null;
	$: names = namesFor(t);
	$: stories = storiesFor(t);
	$: faqs = typeFaqs(t);
	$: mistakes = mistakesFor(t);
	// A 128-bit limit is 39 digits, too long for a lede (and the social card
	// that quotes it), so those two give the size and leave the digits to the card below.
	$: lede =
		t.bits === 128
			? t.signed
				? `${t.slug} holds every whole number from ${f.min} to ${f.max}, about ±${scientific(
						t.max
				  )}, stored in two’s complement. The exact limits, all ${digitCount(t.max)} digits, are below.`
				: `${t.slug} holds every whole number from 0 to ${f.max}, about ${scientific(
						t.max
				  )}, none of them negative. The exact maximum, all ${digitCount(t.max)} digits, is below.`
			: `${t.slug} holds every whole number from ${formatDecimal(t.min)} to ${formatDecimal(t.max)}, which is ${
					f.min
			  } to ${f.max}. That is ${f.count} = ${formatDecimal(t.count)} values in ${t.bits} bits${
					t.signed ? ', stored in two’s complement' : ', none of them negative'
			  }.`;
	// Types whose width depends on the platform are noted on the rows they can match.
	$: platformNote =
		t.bits === 64
			? 'Types whose width depends on the platform, such as C’s long, Go’s int and Rust’s isize, are in the notes.'
			: t.bits === 32
			? 'C’s int, whose width depends on the platform, is in the notes.'
			: '';
	$: wrapped = wrap(t.max + 1n, t);
	$: wrappedLow = wrap(t.min - 1n, t);

	$: limitRows = [
		{ label: 'Maximum', value: t.max, formula: f.max },
		{ label: 'Minimum', value: t.min, formula: f.min }
	];

	// The playground starts at this type's maximum, one step from wrapping.
	const opIds = ['inc', 'dec', 'dbl', 'neg', 'cast'] as const;
	const defaultsFor = (x: IntType) => ({ t: x.slug, v: x.max.toString(), op: 'inc', to: twinOf(x).slug });
	$: DEFAULTS = defaultsFor(t);
	let pgType: IntSlug = data.slug as IntSlug;
	let pgValue = (intTypeBySlug(data.slug) as IntType).max.toString();
	let pgOp: Op = 'inc';
	let pgTo: IntSlug = twinOf(intTypeBySlug(data.slug) as IntType).slug;

	// Until the link has been read, the address bar is left alone. On Back or
	// Forward the reactive syncUrl below runs before afterNavigate, and would
	// otherwise replace the incoming link with this type's defaults. Leaving the
	// site (willUnload) must not reset it: Back may restore this very page from
	// the back/forward cache, where afterNavigate does not run again.
	let linkRead = false;
	beforeNavigate(({ from, to, willUnload }) => {
		if (!willUnload && to && from?.url.pathname !== to.url.pathname) linkRead = false;
	});

	// Runs on first load and after every move between type pages, which reuse
	// this component: start from the new type's defaults, then apply the link.
	afterNavigate(() => {
		const base = intTypeBySlug(data.slug) as IntType;
		const p = readUrl();
		pgType = safeOption(p.t, intSlugs) ?? base.slug;
		pgValue = safeText(p.v, MAX_INPUT) ?? base.max.toString();
		pgOp = safeOption(p.op, opIds) ?? 'inc';
		pgTo = safeOption(p.to, intSlugs) ?? twinOf(base).slug;
		linkRead = true;
		// Rewrites the address even when nothing changed, so a value the page
		// rejected (an unknown type, a 100 KB string) is not kept and shared.
		syncUrl({ t: pgType, v: pgValue, op: pgOp, to: pgTo }, defaultsFor(base));
	});
	$: if (linkRead) syncUrl({ t: pgType, v: pgValue, op: pgOp, to: pgTo }, DEFAULTS);

	$: url = `${SITE}/integer-limits/${t.slug}`;
	$: title = typeTitle(t);
	$: description = typeDescription(t);
	$: ogImage = `${SITE}/og/integer-limits-${t.slug}.png`;

	$: jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['WebPage', 'FAQPage'],
				'@id': `${url}#webpage`,
				url,
				name: title,
				description,
				isPartOf: { '@id': `${SITE}/#website` },
				breadcrumb: { '@id': `${url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(url),
				mainEntity: faqs.map((q) => ({
					'@type': 'Question',
					name: q.q,
					acceptedAnswer: { '@type': 'Answer', text: q.a }
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Integer limits', item: `${SITE}/integer-limits` },
					{ '@type': 'ListItem', position: 4, name: t.slug }
				]
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta name="author" content="Sem" />
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="LogicGates.org" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={`LogicGates.org: ${t.slug} range`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/integer-limits', label: 'All integer limits' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/fp16-bf16-fp8-converter', label: 'FP16, BF16, FP8 and FP4 converter' },
		{ href: '/bit-manipulation-tricks', label: 'Bit manipulation tricks' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/integer-limits">Integer limits</a> <span aria-hidden="true">/</span>
			<span>{t.slug}</span>
		</nav>
		<h1>{t.slug}: the {describeType(t)}</h1>
		<p class="lede">{@html breakable(lede)}</p>

		<div class="card limits-card">
			<h2 class="card-title">{t.slug} limits</h2>
			<dl class="limits">
				{#each limitRows as row}
					<div class="limit">
						<dt>{row.label}</dt>
						<dd>
							<div class="limit-main">
								<span class="mono limit-value" data-testid={row.label === 'Maximum' ? 'max' : 'min'}
									>{@html breakable(formatDecimal(row.value))}</span
								>
								<CopyButton text={row.value.toString()} label="{row.label.toLowerCase()} in decimal" />
							</div>
							<div class="limit-line sub">
								<span class="tag">power</span><span class="formula">{row.formula}</span>
							</div>
							<div class="limit-line sub">
								<span class="tag">hex</span><span class="mono">{hexOf(row.value, t.bits)}</span>
								<CopyButton text={hexOf(row.value, t.bits)} label="{row.label.toLowerCase()} in hex" />
							</div>
							<div class="limit-line sub binary">
								<span class="tag">binary</span><span class="mono">{nibbles(binaryOf(row.value, t.bits))}</span>
								<CopyButton text={binaryOf(row.value, t.bits)} label="{row.label.toLowerCase()} in binary" />
							</div>
						</dd>
					</div>
				{/each}
				<div class="limit">
					<dt>Distinct values</dt>
					<dd>{f.count} = {@html breakable(formatDecimal(t.count))}</dd>
				</div>
				<div class="limit">
					<dt>Size</dt>
					<dd>{t.bits} bits, {t.bits / 8} {t.bits === 8 ? 'byte' : 'bytes'}</dd>
				</div>
			</dl>
			{#if t.signed}
				<p class="note">
					The hex and binary forms are the bit patterns. The top bit is the sign: 0 for the maximum, 1 for the minimum.
				</p>
			{/if}
		</div>
	</section>

	<section id="playground">
		<h2>{t.slug} overflow playground</h2>
		<p class="section-intro">
			Starts at the maximum, one step from overflowing. Change the operation, the value or the type, or cast to another
			width, and watch the bits wrap.
		</p>
		<div class="card tool">
			<OverflowPlayground bind:type={pgType} bind:value={pgValue} bind:op={pgOp} bind:to={pgTo} />
			<p class="share-row"><ShareLink what="this calculation" /></p>
		</div>
	</section>

	<section id="names">
		<h2>What {t.slug} is called in each language</h2>
		<div class="table-wrap" use:scrollFocus data-label="What {t.slug} is called in each language">
			<table class="data-table names">
				<thead>
					<tr>
						<th scope="col">Language</th>
						<th scope="col">Type</th>
						<th scope="col">Limits in code</th>
						<th scope="col">Note</th>
					</tr>
				</thead>
				<tbody>
					{#each names as n}
						<tr>
							<th scope="row">{n.language}</th>
							<td class="mono type-name" class:missing={!n.type} data-label="Type">{n.type ?? 'none'}</td>
							<td class="mono" class:empty={!n.limits} data-label="Limits">{n.limits ?? ''}</td>
							<td class="note-cell" class:empty={!n.note} data-label="Note">{n.note ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Only names with exactly {t.bits} bits on every platform are listed as the type.
			{platformNote}
		</p>
	</section>

	<section id="overflow">
		<h2>What happens when {t.slug} overflows</h2>
		<p>
			In {t.bits} bits, {@html breakable(formatDecimal(t.max))} + 1 wraps to
			<strong class="mono">{@html breakable(formatDecimal(wrapped))}</strong>, and
			{@html breakable(formatDecimal(t.min))} − 1 wraps to
			<strong class="mono">{@html breakable(formatDecimal(wrappedLow))}</strong>. The processor keeps the low {t.bits} bits
			of the answer, which is the same as working modulo {f.count}{t.signed
				? ', and the top bit then decides the sign'
				: ''}. You can see it in JavaScript:
		</p>
		<p class="code mono">
			{jsWrapExample(t)} <span class="arrow">→</span>
			{wrapped.toString()}{t.bits >= 64 ? 'n' : ''}
		</p>
		<p>Whether a program is allowed to wrap like that depends on the language:</p>
		<OverflowRules />
		{#if t.bits < 32}
			<p class="reducer">
				In C and C++, arithmetic on {t.bits}-bit types is done in int, so the sum itself does not overflow; it wraps
				when stored back into the {t.signed ? 'int' : 'uint'}{t.bits}_t.
				{t.signed
					? 'That conversion is implementation defined in C (GCC and Clang wrap) and defined as wrapping since C++20.'
					: 'For unsigned types that conversion is always defined: it wraps.'}
				{t.slug === 'uint16'
					? `The promotion has a catch: it is to signed int, so uint16_t × uint16_t is a signed multiplication, and ${formatDecimal(
							t.max
					  )} × ${formatDecimal(t.max)} overflows it.`
					: ''}
			</p>
		{/if}
	</section>

	<section id="mistakes">
		<h2>Common mistakes with {t.slug}</h2>
		<ul class="mistakes">
			{#each mistakes as m}
				<li><strong>{m.title}.</strong> {@html breakable(m.text)}</li>
			{/each}
		</ul>
	</section>

	{#if stories.length}
		<section id="stories">
			<h2>When {t.slug} overflowed for real</h2>
			{#each stories as story}
				<div class="card story">
					<h3>{story.title}</h3>
					<p>{@html breakable(story.text)}</p>
				</div>
			{/each}
		</section>
	{/if}

	<section id="uses">
		<h2>Where you meet {t.slug}</h2>
		<ul class="points">
			{#each usesOf[t.slug] as use}
				<li>
					{#if typeof use === 'string'}{use}{:else}<a href={use.href}>{use.text}</a>{/if}
				</li>
			{/each}
		</ul>
		<p class="reducer">
			Need {t.signed ? 'no negatives and twice the reach' : 'negative numbers'}? The {t.signed ? 'unsigned' : 'signed'}
			type of the same width is <a href="/integer-limits/{twin.slug}" class="mono">{twin.slug}</a>, from {formatDecimal(
				twin.min
			)} to {formatDecimal(twin.max)}.
		</p>
	</section>

	<section id="all-types">
		<h2>Every integer type</h2>
		<div class="table-wrap" use:scrollFocus data-label="Every integer type">
			<table class="data-table all">
				<thead>
					<tr>
						<th scope="col">Type</th>
						<th scope="col" class="num">Minimum</th>
						<th scope="col" class="num">Maximum</th>
					</tr>
				</thead>
				<tbody>
					{#each intTypes as other}
						<tr class:current={other.slug === t.slug}>
							<th scope="row">
								{#if other.slug === t.slug}
									<span class="mono" aria-current="page">{other.slug}</span>
									<span class="this-page">this page</span>
								{:else}
									<a class="mono" href="/integer-limits/{other.slug}">{other.slug}</a>
								{/if}
							</th>
							<td class="mono num">{@html breakable(formatDecimal(other.min), 0)}</td>
							<td class="mono num">{@html breakable(formatDecimal(other.max), 0)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<nav class="pager" aria-label="Neighbouring types">
			{#if prev}<a href="/integer-limits/{prev.slug}">← <span class="mono">{prev.slug}</span></a>{:else}<span />{/if}
			{#if next}<a href="/integer-limits/{next.slug}"><span class="mono">{next.slug}</span> →</a>{/if}
		</nav>
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

	.crumbs {
		color: #999;
		font-size: 0.85rem;
		margin-bottom: 0.4rem;
	}

	.limits-card {
		padding: 1rem 1.2rem 1.1rem;
		margin-bottom: 1rem;
	}

	.card-title {
		color: #fff;
		font-size: 1.05rem;
		margin: 0 0 0.6rem !important;
	}

	.limits {
		margin: 0;
	}

	.limit {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr);
		gap: 0.3rem 1rem;
		padding: 0.6rem 0;
	}

	.limit:first-child {
		border-top: none;
		padding-top: 0;
	}

	dt {
		color: #bbb;
		font-size: 0.9rem;
	}

	dd {
		color: #ddd;
		margin: 0;
		min-width: 0;
		overflow-wrap: break-word;
	}

	.limit-main {
		line-height: 1.5;
	}

	.limit-main :global(.copy) {
		margin-left: 0.5rem;
	}

	.limit-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem 0.6rem;
	}

	.limit-value {
		color: #8ede8e;
		font-size: 1.35rem;
		font-weight: 700;
		vertical-align: middle;
	}

	.sub {
		font-size: 0.9rem;
		margin-top: 0.15rem;
	}

	.sub .mono {
		overflow-wrap: anywhere;
		min-width: 0;
	}

	.formula {
		color: #ddd;
	}

	.tag {
		color: #999;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		min-width: 3.6rem;
	}

	.binary .mono {
		font-size: 0.82rem;
		letter-spacing: 0.02em;
	}

	.note {
		color: #aaa;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
	}

	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.names {
		min-width: 640px;
	}

	.names th[scope='row'] {
		color: #fff;
		white-space: nowrap;
	}

	.names .type-name {
		color: #8ede8e;
		white-space: nowrap;
	}

	.names .type-name.missing {
		color: #aaa;
		font-style: italic;
	}

	.names .note-cell {
		font-size: 0.85rem;
	}

	.code {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem 0.7rem;
		overflow-wrap: anywhere;
	}

	.mistakes {
		color: #ddd;
		padding-left: 1.25rem;
	}

	.mistakes li {
		margin-bottom: 0.6rem;
	}

	.mistakes strong {
		color: #fff;
	}

	.arrow {
		color: #999;
		margin: 0 0.3rem;
	}

	strong.mono {
		color: #8ede8e;
	}

	/* Long numbers carry <wbr> between digit groups; this is only a safety net. */
	section p,
	.points li,
	.mistakes li {
		overflow-wrap: break-word;
	}

	.story {
		padding: 0.9rem 1rem;
		margin-bottom: 0.8rem;
	}

	.story h3 {
		color: #fff;
	}

	.story p {
		margin: 0.3rem 0 0;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.4rem;
	}

	.all th {
		white-space: nowrap;
	}

	.this-page {
		color: #bbb;
		display: block;
		font-size: 0.75rem;
		font-weight: 400;
	}

	/* The 128-bit rows break between digit groups (<wbr>), never inside one. */
	.all td {
		font-size: 0.85rem;
	}

	.all tr.current th,
	.all tr.current td {
		color: #8ede8e;
		background-color: rgba(93, 182, 93, 0.08);
	}

	.num {
		text-align: right !important;
	}

	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: 0.8rem;
	}

	@media (max-width: 560px) {
		.limit {
			grid-template-columns: minmax(0, 1fr);
		}

		.all td {
			font-size: 0.78rem;
		}

		/* Narrower side padding keeps a 32-bit limit such as −2,147,483,648 on
		   one line at phone width; on a narrower screen it breaks at a comma. */
		.all th,
		.all td {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
		}

		/* The names table becomes one block per language: no sideways scrolling. */
		.names {
			min-width: 0;
		}

		.names thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
		}

		.names tr,
		.names th[scope='row'],
		.names td {
			display: block;
		}

		.names tr {
			border-bottom: 1px solid rgba(255, 255, 255, 0.12);
			padding: 0.4rem 0;
		}

		/* tr in the selector outranks the shared .data-table cell border. */
		.names tr th[scope='row'],
		.names tr td {
			border: none;
			padding: 0.1rem 0.5rem;
		}

		.names td.empty {
			display: none;
		}

		.names td::before {
			content: attr(data-label) ': ';
			color: #999;
			font-family: system-ui, sans-serif;
			font-size: 0.75rem;
			font-style: normal;
		}

		.names .type-name {
			white-space: normal;
		}
	}
</style>
