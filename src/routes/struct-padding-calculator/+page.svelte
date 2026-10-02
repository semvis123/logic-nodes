<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		analyse,
		compareTargets,
		byteGrid,
		explainSteps,
		staticAsserts,
		plural,
		layoutRecord,
		parseStructs,
		targetById,
		StructError,
		TARGETS,
		TARGET_IDS,
		REFERENCE_TYPES,
		MAX_SOURCE,
		type Analysis,
		type TargetId,
		type RecordLayout
	} from '$lib/structLayout';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const DEFAULT_SOURCE = `struct packet {
    char tag;
    double value;
    short id;
    int count;
    char flag;
};`;

	const examples: { label: string; source: string; target?: TargetId }[] = [
		{ label: 'Badly ordered', source: DEFAULT_SOURCE },
		{
			label: 'Nested struct',
			source: `struct point {
    short x, y;
};

struct sprite {
    char visible;
    struct point pos;
    struct {
        double scale;
        char layer;
    } style;
};`
		},
		{
			label: 'Tagged union',
			source: `struct value {
    int kind;
    union {
        long i;
        double d;
        char s[12];
    } as;
};`
		},
		{
			label: 'BMP header, packed',
			source: `#include <stdint.h>

#pragma pack(push, 1)
struct bmp_file_header {
    char magic[2];
    uint32_t size;
    uint16_t reserved1;
    uint16_t reserved2;
    uint32_t pixel_offset;
};
#pragma pack(pop)`
		},
		{
			label: '__attribute__((packed))',
			source: `#include <stdint.h>

struct __attribute__((packed)) frame {
    uint8_t type;
    uint32_t length;
    uint16_t port;
};`
		},
		{
			label: 'alignas(64)',
			source: `struct counters {
    alignas(64) long hits;
    alignas(64) long misses;
};`
		},
		{
			label: 'Linked list, 32-bit',
			source: `struct node {
    int value;
    struct node *next;
    char tag;
};`,
			target: 'i386'
		},
		{
			label: 'Flexible array',
			source: `#include <stdint.h>

struct message {
    uint32_t length;
    uint8_t type;
    char data[];
};`
		},
		{
			label: 'long on Windows',
			source: `struct record {
    char kind;
    long count;
    long long total;
};`,
			target: 'win64'
		}
	];

	const DEFAULTS = { c: DEFAULT_SOURCE, t: 'x64' };
	let source = DEFAULT_SOURCE;
	let target: TargetId = 'x64';

	onMount(() => {
		const p = readUrl();
		source = safeText(p.c, MAX_SOURCE) ?? source;
		target = safeOption(p.t, TARGET_IDS) ?? target;
	});
	$: syncUrl({ c: source, t: target }, DEFAULTS);

	// Runs at build time too, so the page ships with a real layout. A failed
	// parse keeps the last good result on screen, dimmed, so nothing jumps.
	let result: Analysis = analyse(DEFAULT_SOURCE, 'x64');
	let error = '';
	$: {
		try {
			result = analyse(source, target);
			error = '';
		} catch (e) {
			error = e instanceof StructError ? e.message : 'That could not be read as a C struct';
		}
	}
	$: layout = result.layout;
	$: grid = byteGrid(layout, 8, GRID_LIMIT);
	$: steps = explainSteps(layout);
	$: asserts = staticAsserts(layout);
	$: comparison = compareTargets(source);
	$: anyTarget = comparison.some((c) => c.layout);
	$: rows = Math.min(18, Math.max(7, source.split('\n').length + 1));
	$: dataBytes = layout.size - layout.wasted;

	const GRID_LIMIT = 512;
	const PALETTE = 6;

	let copied = '';
	let copyFailed = false;
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copy(what: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			copyFailed = false;
		} catch {
			copied = what;
			copyFailed = true;
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = ''), 2500);
	}

	function tryExample(example: { source: string; target?: TargetId }) {
		source = example.source;
		if (example.target) target = example.target;
		const field = document.getElementById('struct-source');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	function useReordered() {
		if (!result.reordered) return;
		source = result.reordered.code;
	}

	const segmentTitle = (l: RecordLayout, s: { member: number; innerPad: boolean; start: number; length: number }) => {
		const range = s.length === 1 ? `byte ${s.start}` : `bytes ${s.start} to ${s.start + s.length - 1}`;
		if (s.member < 0) return `Padding, ${range}`;
		return `${l.members[s.member].label}${s.innerPad ? ', padding inside it' : ''}, ${range}`;
	};

	// Worked examples for the teaching sections, laid out by the same engine.
	const x64 = targetById('x64');
	const worked = analyse(DEFAULT_SOURCE, 'x64');
	const workedSteps = explainSteps(worked.layout);
	// The default struct is a struct, so it always has a reordering.
	const workedReordered = worked.reordered ?? { layout: worked.layout, code: DEFAULT_SOURCE, saved: 0 };
	const packedHeader = analyse(examples[3].source, 'x64').layout;
	const unpackedHeader = layoutRecord(parseStructs(examples[3].source.replace(/#pragma[^\n]*\n?/g, '')).main, x64);
	const counters = analyse(examples[5].source, 'x64').layout;
	const nodeOn = (id: TargetId) => analyse(examples[6].source, id).layout;
	const nodeSizes = TARGETS.map((t) => ({ target: t, layout: nodeOn(t.id) }));
	const windowsLong = {
		win: analyse(examples[8].source, 'win64').layout,
		linux: analyse(examples[8].source, 'x64').layout
	};
	const flexible = analyse(examples[7].source, 'x64').layout;
	const i386Packet = analyse(DEFAULT_SOURCE, 'i386').layout;

	const faqs = [
		{
			q: 'Why is sizeof my struct bigger than the sum of its members?',
			a: `Because the compiler adds padding so that each member sits at an address that is a multiple of its alignment, and rounds the total up to a multiple of the largest alignment. The struct packet example holds ${
				worked.layout.size - worked.layout.wasted
			} bytes of data but is ${worked.layout.size} bytes on x86-64: ${worked.layout.wasted} bytes, ${
				worked.layout.wastedPercent
			}%, are padding.`
		},
		{
			q: 'How do I reduce struct padding?',
			a: `Order the members from the largest alignment to the smallest: 8-byte members (double, pointers, long long) first, then 4, 2 and 1. Sorted that way, struct packet shrinks from ${worked.layout.size} to ${workedReordered.layout.size} bytes on x86-64 without losing anything. Packing removes padding too, but it makes members misaligned, which costs speed or correctness on some processors.`
		},
		{
			q: 'Does the compiler reorder struct members to save space?',
			a: 'No. C requires members to have increasing addresses in the order they are declared, so a C compiler never reorders them. It can only add padding. Reordering is up to you, and it changes the binary layout, so it breaks any file format or library interface that depends on the old one.'
		},
		{
			q: 'What does #pragma pack(1) do?',
			a: `It caps every member's alignment at 1 byte, so the compiler adds no padding at all. The file header at the start of a BMP image, written as a struct, is ${packedHeader.size} bytes packed, matching the file, and ${unpackedHeader.size} bytes without the pragma. #pragma pack(n) with n of 2, 4, 8 or 16 caps alignment at n instead, and #pragma pack(push, n) and #pragma pack(pop) save and restore the previous setting.`
		},
		{
			q: 'Is the struct layout the same on every platform?',
			a: `No. Type sizes and alignments are set by each platform's ABI. long is 8 bytes on 64-bit Linux and macOS but 4 on 64-bit Windows, and 32-bit x86 Linux aligns double and long long to only 4 bytes inside a struct, so struct packet is ${i386Packet.size} bytes there and ${worked.layout.size} on x86-64. Use fixed-width types and explicit serialisation for anything that leaves the program.`
		},
		{
			q: 'Why does a struct have padding at the end?',
			a: 'For arrays. Array elements sit back to back, sizeof apart, so the size must be a multiple of the struct’s alignment for every element’s members to stay aligned. A struct holding a double and a char is 16 bytes on x86-64, not 9, so the double in the second element of an array still starts at a multiple of 8.'
		}
	];

	const page = {
		title: 'Struct Padding Calculator: C Struct Size, Offsets and Layout',
		description:
			'Paste a C struct to see its memory layout: every offset, padding byte and sizeof, on x86-64, Windows, 32-bit x86 and ARM, plus a reordering that saves space.',
		url: `${SITE}/struct-padding-calculator`,
		image: `${SITE}/og/struct-padding-calculator.png`,
		imageAlt: 'LogicGates.org: struct padding calculator showing a C struct byte by byte'
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
					{ '@type': 'ListItem', position: 3, name: 'Struct padding calculator' }
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
		{ href: '/integer-limits', label: 'Integer limits' },
		{ href: '/bit-manipulation-tricks', label: 'Bit manipulation tricks' },
		{ href: '/file-signature-checker', label: 'File signature checker' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Struct padding calculator</h1>
		<p class="lede">
			Paste a C struct to see how a compiler lays it out in memory: the offset of every member, each byte of padding and
			why it is there, the total sizeof, and the same members in an order that wastes less.
		</p>

		<div class="card tool">
			<div class="target-row">
				<label class="field inline" for="target">Target</label>
				<select id="target" bind:value={target}>
					{#each TARGETS as t}
						<option value={t.id}>{t.label}</option>
					{/each}
				</select>
			</div>

			<label class="field" for="struct-source">C struct or union</label>
			<textarea
				id="struct-source"
				class="source-input"
				{rows}
				bind:value={source}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="source-help{error ? ' source-error' : ''}"
			/>
			{#if error}
				<p class="error" id="source-error" role="alert">{error}</p>
			{/if}
			<p class="field-help" id="source-help">
				The last struct or union is laid out; earlier ones can be used as member types. Understands the basic types,
				&lt;stdint.h&gt; types, pointers, arrays, nested structs and unions, typedefs, #pragma pack, packed and
				_Alignas. Bit-fields are not supported.
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryExample(example)}>{example.label}</button>
				{/each}
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-label"
						><span class="mono label-code">sizeof({layout.name})</span> on {result.target.label}</span
					>
					<span class="answer-value mono">{plural(layout.size, 'byte')}</span>
					<span class="answer-also">
						Alignment {layout.align}. {plural(dataBytes, 'byte')} of data and
						<strong class:waste={layout.wasted > 0}>{plural(layout.wasted, 'byte')} of padding</strong>
						({layout.wastedPercent}%){#if layout.trailing}, {layout.trailing} of them at the end{/if}{#if layout.innerPadding},
							{layout.innerPadding} inside nested members{/if}.
					</span>
					{#if result.reordered}
						<span class="answer-also">
							{#if result.reordered.saved > 0}
								Sorted by alignment it would be <strong class="good"
									>{plural(result.reordered.layout.size, 'byte')}</strong
								>, saving {result.reordered.saved}.
							{:else if result.reordered.saved === 0}
								Sorting the members by alignment would not make it smaller.
							{:else}
								Sorting by alignment would make it bigger here ({result.reordered.layout.size} bytes), so keep this order.
							{/if}
						</span>
					{/if}
				</div>

				<h2 class="working-title">Byte by byte</h2>
				<p class="legend">
					Each row is 8 bytes. Members are labelled in their colour;
					<span class="legend-pad" aria-hidden="true" /> hatched cells are padding.
					{#if layout.kind === 'union'}All members of a union start at byte 0 and overlap; each byte is labelled with
						the largest member that covers it.{/if}
				</p>
				<div
					class="grid-wrap"
					role="img"
					aria-label="Byte map of {layout.name}: {plural(
						layout.size,
						'byte'
					)}, {layout.wasted} of them padding. The table below lists each member."
				>
					<div class="byte-grid">
						<span class="corner" />
						{#each Array(8) as _, i}
							<span class="col-head mono">+{i}</span>
						{/each}
						{#each grid as row}
							<span class="row-head mono">{row.offset}</span>
							{#each row.segments as seg}
								<span
									class="seg mono {seg.member < 0 ? 'pad' : `c${seg.member % PALETTE}`}"
									class:inner-pad={seg.innerPad}
									style="grid-column: span {seg.length}"
									title={segmentTitle(layout, seg)}
									>{#if seg.member < 0}pad{:else if seg.first}{layout.members[seg.member]
											.label}{:else if seg.innerPad}pad{:else}<span class="cont">…</span>{/if}</span
								>
							{/each}
						{/each}
					</div>
				</div>
				{#if layout.size > GRID_LIMIT}
					<p class="legend">Showing the first {GRID_LIMIT} of {layout.size} bytes; the table has every member.</p>
				{/if}
				{#if layout.size === 0}
					<p class="legend">This struct has no bytes to draw.</p>
				{/if}

				<h2 class="working-title">Members</h2>
				<div class="table-wrap scroll-box">
					<table class="data-table members">
						<thead>
							<tr>
								<th scope="col">Member</th>
								<th scope="col">Type</th>
								<th scope="col" class="num">Offset</th>
								<th scope="col" class="num">Size</th>
								<th scope="col" class="num">Align</th>
								<th scope="col" class="num">Padding before</th>
							</tr>
						</thead>
						<tbody>
							{#each layout.members as m, i}
								<tr>
									<th scope="row" class="mono member-name"
										><span class="swatch c{i % PALETTE}" aria-hidden="true" />{m.label}</th
									>
									<td class="mono type">{m.type}</td>
									<td class="mono num">{m.offset}</td>
									<td class="mono num"
										>{m.flexible ? '0 (flexible)' : m.size}{#if m.innerPadding}<span class="inner-note"
												>, {m.innerPadding} padding inside</span
											>{/if}</td
									>
									<td class="mono num"
										>{m.align}{#if m.align !== m.naturalAlign}<span class="inner-note">
												(type: {m.naturalAlign})</span
											>{/if}</td
									>
									<td class="mono num" class:waste={m.paddingBefore > 0}>{m.paddingBefore}</td>
								</tr>
							{/each}
							<tr class="total">
								<th scope="row" colspan="5">Trailing padding, to a multiple of {layout.align}</th>
								<td class="mono num" class:waste={layout.trailing > 0}>{layout.trailing}</td>
							</tr>
						</tbody>
					</table>
				</div>

				<details class="steps">
					<summary>Why each member is where it is</summary>
					<ol>
						{#each steps as step}
							<li>{step}</li>
						{/each}
					</ol>
				</details>

				{#if result.reordered && result.reordered.saved > 0}
					<h2 class="working-title">Reordered: {plural(result.reordered.layout.size, 'byte')}</h2>
					<p class="legend">
						The same members sorted by alignment, largest first ({layout.size} to {result.reordered.layout.size}
						bytes, {result.reordered.layout.wasted} of padding). Reordering changes the binary layout, so only do it where
						nothing depends on the old one.
					</p>
					<div class="code-head">
						<span class="code-label">Reordered code</span>
						<span class="code-actions">
							<button type="button" class="copy" on:click={() => copy('reorder', result.reordered?.code ?? '')}
								>Copy</button
							>
							<button type="button" class="copy" on:click={useReordered}>Lay out this version</button>
						</span>
					</div>
					<pre class="code mono">{result.reordered.code}</pre>
				{/if}

				<details class="steps">
					<summary>offsetof checks to paste into your code</summary>
					<p class="legend">
						These fail the build if the layout ever changes, for example after someone adds a member or a compiler flag
						changes packing.
					</p>
					<div class="code-head">
						<span class="code-label">_Static_assert lines</span>
						<button type="button" class="copy" on:click={() => copy('asserts', asserts)}>Copy</button>
					</div>
					<pre class="code mono">{asserts}</pre>
				</details>
				<p class="copy-status" aria-live="polite">
					{#if copied}{copyFailed
							? 'Copying was blocked; select the text and press ctrl+C.'
							: copied === 'reorder'
							? 'Reordered code copied.'
							: 'Checks copied.'}{/if}
				</p>
			</div>

			{#if anyTarget}
				<h2 class="working-title">On every target</h2>
				<div class="table-wrap">
					<table class="data-table compare">
						<thead>
							<tr>
								<th scope="col">Target</th>
								<th scope="col" class="num">sizeof</th>
								<th scope="col" class="num">Align</th>
								<th scope="col" class="num">Padding</th>
							</tr>
						</thead>
						<tbody>
							{#each comparison as row}
								<tr class:current={row.target.id === target}>
									<th scope="row">
										<button
											type="button"
											class="target-btn"
											aria-pressed={row.target.id === target}
											on:click={() => (target = row.target.id)}>{row.target.label}</button
										>
									</th>
									{#if row.layout}
										<td class="mono num">{row.layout.size}</td>
										<td class="mono num">{row.layout.align}</td>
										<td class="mono num">{row.layout.wasted}</td>
									{:else}
										<td colspan="3" class="target-error">Does not compile here</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			<p class="share-row"><ShareLink what="this struct and target" /></p>
		</div>
	</section>

	<section id="rules">
		<h2>How a compiler lays out a struct</h2>
		<p class="section-intro">
			Every type has an alignment: the number its address has to be a multiple of. On x86-64, char has alignment 1,
			short 2, int and float 4, and double, long and pointers 8. Two rules then decide the whole layout.
		</p>
		<ol class="points">
			<li>
				<strong>Each member starts at the next offset that is a multiple of its alignment.</strong> The first member is always
				at offset 0, and members stay in the order you wrote them. If the previous member ended at an offset the next one
				cannot use, the compiler fills the gap with padding bytes.
			</li>
			<li>
				<strong>The size is a multiple of the largest member alignment.</strong> That largest alignment becomes the struct's
				own, and the compiler pads the end to reach it. In an array the elements are sizeof apart, so this is what keeps
				the members of the second, third and later elements aligned too.
			</li>
		</ol>
		<p>
			Alignment exists because processors fetch memory in aligned chunks. A 4-byte int at an address that is a multiple
			of 4 never straddles two chunks, so one load reads it. Some processors handle a misaligned load in hardware at a
			cost; others refuse it outright. The ABI for each platform fixes every type's alignment so that separately
			compiled code agrees on where each member is.
		</p>
	</section>

	<section id="worked-example">
		<h2>Worked example: struct packet</h2>
		<p class="section-intro">
			The default struct on x86-64, member by member. It holds {worked.layout.size - worked.layout.wasted} bytes of data
			in
			{worked.layout.size} bytes.
		</p>
		<pre class="code mono">{DEFAULT_SOURCE}</pre>
		<ol class="points">
			{#each workedSteps as step}
				<li>{step}</li>
			{/each}
		</ol>
		<p>
			So {worked.layout.wasted} of the {worked.layout.size} bytes, {worked.layout.wastedPercent}%, are padding. On
			32-bit x86 Linux, where double only needs 4-byte alignment inside a struct, the same struct is
			{i386Packet.size} bytes.
		</p>
	</section>

	<section id="reordering">
		<h2>Reordering members to remove padding</h2>
		<p>
			A C compiler never reorders members, because the standard requires their addresses to increase in declaration
			order. You can. Sort the members by alignment, largest first, and each one starts exactly where the previous one
			ended: a type's size is always a multiple of its alignment, so after the 8-byte members the offset is a multiple
			of 8, after the 4-byte ones a multiple of 4, and so on down.
		</p>
		<pre class="code mono">{workedReordered.code}</pre>
		<p>
			That is {workedReordered.layout.size} bytes instead of {worked.layout.size}, with
			{plural(workedReordered.layout.wasted, 'byte')} of padding. For one struct the saving hardly matters; for a million
			of them in an array it is {worked.layout.size - workedReordered.layout.size} MB, and more of them fit in each cache
			line. The one case the rule does not cover is a member with a raised _Alignas, which can be larger than its size; the
			calculator still computes the result exactly.
		</p>
	</section>

	<section id="packing">
		<h2>Packing: #pragma pack and the packed attribute</h2>
		<p>
			Packing tells the compiler to lower alignment, so it inserts less padding or none. It is meant for data whose
			layout is fixed from outside the program: file headers, network packets and hardware registers.
		</p>
		<ul class="points">
			<li>
				<strong>#pragma pack(n)</strong> caps every member's alignment at n (1, 2, 4, 8 or 16) for the structs defined after
				it. #pragma pack(push, n) and #pragma pack(pop) save and restore the previous value; #pragma pack() goes back to
				the default. GCC, clang and MSVC all accept it.
			</li>
			<li>
				<strong>__attribute__((packed))</strong> is the GCC and clang spelling for alignment 1 on one struct. MSVC does not
				have it, so code that must build there uses #pragma pack.
			</li>
		</ul>
		<p>
			The file header of a BMP image is {packedHeader.size} bytes on disk. As a struct it needs #pragma pack(1) to match:
			without it, the compiler pads the 2-byte magic number so the 4-byte size starts at offset 4, and the struct is {unpackedHeader.size}
			bytes. The cost is that members end up misaligned. x86-64 and AArch64 load misaligned values in hardware, sometimes
			more slowly; on processors that cannot, such as the Cortex-M0, the compiler has to read packed members a byte at a
			time. A pointer to a packed member may itself be misaligned, which is why GCC 9 and later and clang warn about taking
			one (-Waddress-of-packed-member).
		</p>
		<p>
			_Alignas goes the other way and raises a member's alignment. The usual reason is to keep two counters that
			different threads update on separate 64-byte cache lines, so they do not keep invalidating each other: struct
			counters with alignas(64) on both members is {counters.size} bytes, not 16. GCC and clang let #pragma pack lower an
			_Alignas as well; MSVC keeps the _Alignas. The calculator follows each.
		</p>
	</section>

	<section id="targets">
		<h2>Sizes and alignments on each target</h2>
		<p class="section-intro">
			Size / alignment in bytes, as members of a struct. Every value was checked against clang for the target named in
			each column.
		</p>
		<div class="table-wrap">
			<table class="data-table type-table">
				<thead>
					<tr>
						<th scope="col">Type</th>
						{#each TARGETS as t}
							<th scope="col" class="num"
								><span class="t-label">{t.label}</span><span class="t-model">{t.model}</span></th
							>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each REFERENCE_TYPES as row}
						{@const values = TARGETS.map((t) => t.types[row.prim])}
						<tr>
							<th scope="row" class="mono">{row.name}</th>
							{#each values as v}
								<td class="mono num" class:differs={v[0] !== values[0][0] || v[1] !== values[0][1]}>{v[0]} / {v[1]}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Values that differ from x86-64 Linux are highlighted. The Windows column is clang's x86_64-pc-windows-msvc target,
			which follows MSVC's layout rules. For the range each integer width can hold, see the
			<a href="/integer-limits">integer limits</a> tables.
		</p>
		<p>
			The struct node example shows how much pointer size matters:
			{#each nodeSizes as n, i}{n.target.label}: {n.layout.size} bytes{i < nodeSizes.length - 1 ? '; ' : '.'}{/each}
			And struct record, with a long between a char and a long long, is {windowsLong.win.size} bytes on Windows and
			{windowsLong.linux.size} on x86-64 Linux, because long is 4 bytes on one and 8 on the other.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Writing a struct straight to a file or socket.</strong> Its padding, byte order and type sizes are those
				of the machine that wrote it. Another compiler or platform can read it back wrongly. Serialise field by field, or
				pack the struct and use fixed-width types and a fixed byte order.
			</li>
			<li>
				<strong>Comparing structs with memcmp.</strong> The C standard leaves the value of padding bytes unspecified, so
				two structs with equal members can still differ byte for byte. Compare member by member.
			</li>
			<li>
				<strong>Leaking memory through padding.</strong> Copying a struct out of a program, for example from a kernel to
				a user, copies its padding too, along with whatever was in memory there. Zero the struct with memset first.
			</li>
			<li>
				<strong>Assuming a flexible array adds nothing.</strong> A member written data[] has no size of its own, but its
				alignment still counts: struct message is {flexible.size} bytes, and data starts at offset
				{flexible.members[flexible.members.length - 1].offset}. Allocate sizeof plus the array, not the sum of the other
				members.
			</li>
			<li>
				<strong>Packing everything.</strong> A packed struct saves bytes but turns ordinary loads into misaligned ones. Reorder
				first; pack only what has to match an outside format.
			</li>
		</ul>
		<p class="reducer">
			To read the bytes of a dump as numbers, the <a href="/hex-to-decimal">hex to decimal converter</a> and the
			<a href="/binary-converter">binary converter</a> help, and the
			<a href="/file-signature-checker">file signature checker</a>
			reads the first bytes of a file header. Masks and shifts for packed flags are on the
			<a href="/bit-manipulation-tricks">bit manipulation tricks</a> page.
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

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.field.inline {
		margin: 0;
	}

	.target-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	.target-row select {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 0.9rem;
		padding: 0.3rem 0.4rem;
		max-width: 100%;
	}

	.source-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 0.92rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
		resize: vertical;
		tab-size: 4;
	}

	.source-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.source-input[aria-invalid='true'] {
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
		overflow-wrap: anywhere;
	}

	/* C is case sensitive: the struct name must not be shouted. */
	.label-code {
		color: #bbb;
		text-transform: none;
		letter-spacing: 0;
	}

	.answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.6rem;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.88rem;
		margin-top: 0.2rem;
	}

	.answer-also strong {
		color: #fff;
	}

	.answer-also strong.waste {
		color: #f99;
	}

	.answer-also strong.good {
		color: #8ede8e;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.3rem !important;
	}

	.legend {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0 0 0.6rem;
	}

	/* --- byte grid --- */

	.grid-wrap {
		max-height: 480px;
		overflow: auto;
	}

	.grid-wrap + .legend {
		margin-top: 0.6rem;
	}

	.byte-grid {
		display: grid;
		grid-template-columns: 2.4rem repeat(8, minmax(2.1rem, 1fr));
		gap: 3px;
		font-size: 0.75rem;
		min-width: 0;
	}

	.col-head,
	.row-head {
		color: #999;
		font-size: 0.7rem;
		align-self: center;
	}

	.col-head {
		text-align: center;
	}

	.row-head {
		text-align: right;
		padding-right: 0.35rem;
	}

	.seg {
		box-sizing: border-box;
		height: 2rem;
		line-height: calc(2rem - 2px);
		padding: 0 0.35rem;
		border: 1px solid;
		border-left-width: 4px;
		border-radius: 3px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #eee;
		min-width: 0;
	}

	.cont {
		color: #bbb;
	}

	/* Padding is hatched, not just coloured, so it reads without colour. */
	.seg.pad {
		border-color: rgba(255, 255, 255, 0.25);
		border-left-width: 1px;
		border-style: dashed;
		color: #bbb;
		text-align: center;
		background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.13) 0 3px, rgba(0, 0, 0, 0) 3px 8px);
	}

	.seg.inner-pad {
		border-style: dashed;
		color: #ddd;
		background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.13) 0 3px, rgba(0, 0, 0, 0) 3px 8px);
	}

	.legend-pad {
		display: inline-block;
		width: 1.6em;
		height: 0.9em;
		vertical-align: -0.1em;
		border: 1px dashed rgba(255, 255, 255, 0.4);
		border-radius: 2px;
		background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0 3px, rgba(0, 0, 0, 0) 3px 8px);
	}

	.c0 {
		border-color: #5db65d;
		background-color: rgba(93, 182, 93, 0.16);
	}
	.c1 {
		border-color: #6aa6e0;
		background-color: rgba(106, 166, 224, 0.16);
	}
	.c2 {
		border-color: #d8b45a;
		background-color: rgba(216, 180, 90, 0.16);
	}
	.c3 {
		border-color: #b48ede;
		background-color: rgba(180, 142, 222, 0.16);
	}
	.c4 {
		border-color: #4fc1c1;
		background-color: rgba(79, 193, 193, 0.16);
	}
	.c5 {
		border-color: #e07aa8;
		background-color: rgba(224, 122, 168, 0.16);
	}

	/* --- tables --- */

	.scroll-box {
		max-height: 420px;
		overflow: auto;
	}

	.members th,
	.members td,
	.compare th,
	.compare td {
		white-space: nowrap;
	}

	.member-name {
		color: #fff !important;
	}

	.swatch {
		display: inline-block;
		width: 0.7em;
		height: 0.7em;
		margin-right: 0.45em;
		border-width: 2px;
		border-style: solid;
		border-radius: 2px;
		vertical-align: -0.05em;
	}

	.type {
		color: #bbb;
	}

	.num {
		text-align: right !important;
	}

	.inner-note {
		color: #999;
	}

	.data-table td.waste {
		color: #f99;
		font-weight: 700;
	}

	.members tr.total th,
	.members tr.total td {
		border-top: 2px solid rgba(255, 255, 255, 0.4);
		color: #ddd;
	}

	.steps {
		margin-top: 0.9rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem 0.8rem;
	}

	.steps summary {
		cursor: pointer;
		color: #fff;
		font-size: 0.92rem;
	}

	.steps ol {
		color: #ddd;
		font-size: 0.88rem;
		padding-left: 1.3rem;
		margin: 0.6rem 0 0.2rem;
	}

	.steps li {
		margin-bottom: 0.35rem;
	}

	.steps .legend {
		margin-top: 0.6rem;
	}

	.code-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.code-label {
		color: #ddd;
		font-size: 0.85rem;
	}

	.code-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
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

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.code {
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0 0 0.6rem;
		max-width: 100%;
		overflow-x: auto;
		padding: 0.6rem 0.8rem;
		box-sizing: border-box;
	}

	.copy-status {
		color: #8ede8e;
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
		min-height: 1.3em;
	}

	.compare tr.current th,
	.compare tr.current td {
		background-color: rgba(93, 182, 93, 0.1);
	}

	.target-btn {
		background: none;
		border: none;
		color: #8ede8e;
		cursor: pointer;
		font: inherit;
		font-size: 0.9rem;
		padding: 0;
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.target-btn[aria-pressed='true'] {
		color: #fff;
		font-weight: 700;
		text-decoration: none;
	}

	.target-error {
		color: #f99 !important;
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

	.points strong {
		color: #fff;
	}

	section > .code {
		max-width: 720px;
	}

	.type-table th,
	.type-table td {
		white-space: nowrap;
	}

	.type-table thead th {
		vertical-align: bottom;
	}

	.t-label {
		display: block;
		white-space: normal;
		min-width: 6.5rem;
	}

	.t-model {
		display: block;
		color: #999;
		font-weight: normal;
		font-size: 0.75rem;
	}

	.type-table td.differs {
		color: #f0c96a;
		font-weight: 700;
	}

	@media (max-width: 560px) {
		.tool {
			padding: 0.9rem 0.8rem 1rem;
		}

		.byte-grid {
			grid-template-columns: 1.9rem repeat(8, minmax(1.85rem, 1fr));
			gap: 2px;
			font-size: 0.68rem;
		}

		.seg {
			padding: 0 0.2rem;
			border-left-width: 3px;
		}
	}
</style>
