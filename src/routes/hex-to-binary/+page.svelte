<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseRadix,
		digitsToBitGroups,
		bitsToDigitGroups,
		joinBits,
		joinDigits,
		groupDigits,
		groupDecimal,
		hexDigitTable,
		octalDigitTable,
		RadixError,
		MAX_DIGITS,
		type Group
	} from '$lib/radix';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	type From = 'hex' | 'bin' | 'oct';
	type To = 'hex' | 'oct';
	const DEFAULTS = { v: '3F9C', from: 'hex', to: 'hex' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.v, MAX_DIGITS + 20) ?? input;
		from = safeOption(p.from, ['hex', 'bin', 'oct'] as const) ?? from;
		to = safeOption(p.to, ['hex', 'oct'] as const) ?? to;
	});
	$: syncUrl({ v: input, from, to }, DEFAULTS);

	let input = DEFAULTS.v;
	let from: From = 'hex';
	let to: To = 'hex';

	const fromOptions: From[] = ['hex', 'bin', 'oct'];
	const toOptions: To[] = ['hex', 'oct'];
	const radixOf = { hex: 16, oct: 8, bin: 2 } as const;
	const names = { hex: 'hex', oct: 'octal', bin: 'binary' };

	// Computed during prerendering as well, so the default conversion is in the HTML.
	let groups: Group[] = [];
	let padded = 0;
	let answer = '';
	let value = 0n;
	let error = '';
	$: {
		try {
			const parsed = parseRadix(input, radixOf[from]);
			value = parsed.value;
			if (from === 'bin') {
				const bits = parsed.digits;
				const result = bitsToDigitGroups(bits, radixOf[to]);
				groups = result.groups;
				padded = result.padded;
				answer = joinDigits(groups);
			} else {
				groups = digitsToBitGroups(parsed.digits, radixOf[from] as 8 | 16);
				padded = 0;
				answer = groupDigits(joinBits(groups), from === 'hex' ? 4 : 3);
			}
			error = '';
		} catch (e) {
			error = e instanceof RadixError ? e.message : 'That is not a number';
		}
	}
	/** The base the groups are read in: the source for hex/octal, the target for binary. */
	$: groupBase = from === 'bin' ? to : from;
	$: size = groupBase === 'hex' ? 4 : 3;

	function setFrom(next: From) {
		if (next === from) return;
		// Carry the answer across, so going back the other way is one click.
		if (!error) {
			if (next === 'bin') {
				to = from === 'oct' ? 'oct' : 'hex';
				input = value.toString(2);
			} else input = value.toString(radixOf[next]).toUpperCase();
		}
		from = next;
	}

	function tryValue(v: string, f: From, t: To = 'hex') {
		from = f;
		to = t;
		input = v;
		const field = document.getElementById('value');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; v: string; from: From; to?: To }[] = [
		{ label: 'FF', v: 'FF', from: 'hex' },
		{ label: 'DEADBEEF', v: 'DEADBEEF', from: 'hex' },
		{ label: '1011 0110 to hex', v: '10110110', from: 'bin', to: 'hex' },
		{ label: '101101 to hex', v: '101101', from: 'bin', to: 'hex' },
		{ label: 'Octal 755', v: '755', from: 'oct' },
		{ label: '111101101 to octal', v: '111101101', from: 'bin', to: 'oct' }
	];

	// Worked examples from the same engine.
	const workedHex = digitsToBitGroups('B7', 16);
	const workedBin = bitsToDigitGroups('1101011', 16);
	// Grouping from the wrong end, to show why it fails.
	const wrongWay = ['1101', '011'].map((g) => parseInt(g, 2).toString(16).toUpperCase()).join('');
	const perms = digitsToBitGroups('755', 8);
	const permNames = ['owner', 'group', 'others'];
	const rwx = (bits: string) => [...bits].map((b, i) => (b === '1' ? 'rwx'[i] : '-')).join('');

	const faqs = [
		{
			q: 'How do I convert hex to binary?',
			a: 'Replace each hex digit with its four bit pattern from the table and write the groups side by side. B7 is B = 1011 and 7 = 0111, so B7 is 1011 0111. Leading zeros of the first group can be dropped. No arithmetic is needed, because one hex digit is exactly four bits.'
		},
		{
			q: 'How do I convert binary to hex?',
			a: 'Split the bits into groups of four starting from the right, pad the leftmost group with zeros if it is short, and replace each group with its hex digit. 1101011 becomes 0110 1011, which is 6B. Starting from the left would give the wrong answer whenever the length is not a multiple of four.'
		},
		{
			q: 'What is a nibble?',
			a: 'Four bits, half a byte. It holds 16 values, 0000 to 1111, which is exactly one hex digit, so a byte is always written as two hex digits: the high nibble and the low nibble.'
		},
		{
			q: 'How do I convert octal to binary?',
			a: 'The same way as hex, with groups of three: each octal digit 0 to 7 becomes three bits. 755 is 111 101 101. Going back, split the bits into threes from the right.'
		},
		{
			q: 'Why can I not do the same with decimal?',
			a: 'Because 10 is not a power of 2. A decimal digit needs between three and four bits and the digits do not line up with bit boundaries, so converting decimal to binary needs real division, as the binary converter and the hex to decimal page show. Binary coded decimal sidesteps this by storing each decimal digit in its own four bits, at the cost of wasting six of the sixteen patterns.'
		},
		{
			q: 'How long a number can this convert?',
			a: `Up to ${MAX_DIGITS} digits of whatever base you type, so 64 hex digits (256 bits) or 64 bits of binary. Spaces and underscores are ignored, as are a leading 0x, 0b or 0o.`
		}
	];

	const page = {
		title: 'Hex to Binary Converter: Nibble by Nibble',
		description:
			'Convert hex to binary and binary to hex one nibble at a time, with the four bit group for every digit shown. Octal to binary by groups of three too.',
		url: `${SITE}/hex-to-binary`,
		image: `${SITE}/og/hex-to-binary.png`,
		imageAlt: 'LogicGates.org: hex to binary converter'
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
					{ '@type': 'ListItem', position: 3, name: 'Hex to binary converter' }
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
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/hex-calculator', label: 'Hex calculator' },
		{ href: '/ieee-754-converter', label: 'IEEE 754 converter' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Hex to binary converter</h1>
		<p class="lede">
			One hex digit is exactly four bits, so converting is a lookup rather than arithmetic. Type hex to see each digit
			become its nibble, or binary to see it grouped back into hex. Octal works the same way in groups of three.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Convert from">
				<span class="opt-label">From</span>
				{#each fromOptions as option}
					<button
						type="button"
						class:active={from === option}
						aria-pressed={from === option}
						on:click={() => setFrom(option)}>{names[option][0].toUpperCase() + names[option].slice(1)}</button
					>
				{/each}
				{#if from === 'bin'}
					<span class="opt-label to">To</span>
					{#each toOptions as option}
						<button
							type="button"
							class:active={to === option}
							aria-pressed={to === option}
							on:click={() => (to = option)}>{option === 'hex' ? 'Hex' : 'Octal'}</button
						>
					{/each}
				{/if}
			</div>

			<label class="field" for="value">{names[from][0].toUpperCase() + names[from].slice(1)} number</label>
			<input
				id="value"
				class="value-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryValue(example.v, example.from, example.to)}>
						{example.label}
					</button>
				{/each}
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-label">{from === 'bin' ? names[to] : 'binary'}</span>
					<span class="answer-value mono">{answer}</span>
					<span class="answer-also">{groupDecimal(value.toString())} in decimal</span>
				</div>

				<h3 class="working-title">
					{#if from === 'bin'}
						Working: groups of {size} bits from the right{padded
							? `, with ${padded} zero${padded === 1 ? '' : 's'} added on the left`
							: ''}
					{:else}
						Working: each {names[from]} digit becomes {size} bits
					{/if}
				</h3>
				<div class="groups" class:reverse={from === 'bin'}>
					{#each groups as group, i}
						<div class="group">
							{#if from === 'bin'}
								<span class="group-bits mono"
									>{#each [...group.bits] as bit, j}<span
											class:pad={i === 0 && j < padded}
											class={bit === '1' ? 'one' : 'zero'}>{bit}</span
										>{/each}</span
								>
								<span class="arrow" aria-hidden="true">↓</span>
								<span class="group-digit mono">{group.digit}</span>
							{:else}
								<span class="group-digit mono">{group.digit}</span>
								<span class="arrow" aria-hidden="true">↓</span>
								<span class="group-bits mono"
									>{#each [...group.bits] as bit}<span class={bit === '1' ? 'one' : 'zero'}>{bit}</span>{/each}</span
								>
							{/if}
						</div>
					{/each}
				</div>
				{#if from === 'bin' && padded}
					<p class="note">The dimmed zeros were added to fill the leftmost group. They do not change the value.</p>
				{/if}
			</div>
			<p class="share-row"><ShareLink what="this conversion" /></p>
		</div>
	</section>

	<section id="nibbles">
		<h2>The nibble table</h2>
		<p class="section-intro">
			This is the whole method. Each hex digit maps to one four bit pattern and back, and the patterns are just the
			numbers 0 to 15 written in binary.
		</p>
		<div class="table-wrap">
			<table class="data-table nibbles">
				<thead>
					<tr>
						<th scope="col">Hex</th>
						<th scope="col">Binary</th>
						<th scope="col">Decimal</th>
						<th scope="col" class="gap">Hex</th>
						<th scope="col">Binary</th>
						<th scope="col">Decimal</th>
					</tr>
				</thead>
				<tbody>
					{#each hexDigitTable.slice(0, 8) as row, i}
						{@const other = hexDigitTable[i + 8]}
						<tr>
							<td class="mono strong">{row.hex}</td>
							<td class="mono">{row.binary}</td>
							<td class="mono">{row.decimal}</td>
							<td class="mono strong gap">{other.hex}</td>
							<td class="mono">{other.binary}</td>
							<td class="mono">{other.decimal}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The bits in a nibble are worth 8, 4, 2 and 1. So C = 12 = 8 + 4 is 1100, and 9 = 8 + 1 is 1001.
		</p>
	</section>

	<section id="method">
		<h2>Why grouping works, and why from the right</h2>
		<p>
			In binary each place is worth twice the one to its right. Four places together cover 2<sup>4</sup> = 16 values, so
			every block of four bits is one base 16 digit, and each block's place value is the next power of 16. The blocks never
			interfere with each other, which is why one digit can be converted without looking at the rest.
		</p>
		<div class="worked-grid">
			<div class="card worked">
				<h3>Hex B7 to binary</h3>
				<p class="mono small">
					{#each workedHex as g}{g.digit} → {g.bits}<br />{/each}
					B7 = <strong>{workedHex.map((g) => g.bits).join(' ')}</strong>
				</p>
			</div>
			<div class="card worked">
				<h3>Binary 1101011 to hex</h3>
				<p class="mono small">
					Pad to {workedBin.groups.length * 4} bits: {workedBin.groups.map((g) => g.bits).join(' ')}<br />
					{#each workedBin.groups as g}{g.bits} → {g.digit}<br />{/each}
					1101011 = <strong>{joinDigits(workedBin.groups)}</strong>
				</p>
			</div>
		</div>
		<p>
			The groups start from the right because that is where the place values start: the rightmost bit is always worth 1.
			Group 1101011 from the left and you get 1101 and 011, which read as {wrongWay}, not {joinDigits(
				workedBin.groups
			)}. The <a href="/hex-to-decimal">hex to decimal converter</a> shows how the digits turn into a value, and the
			<a href="/binary-calculator">binary calculator</a> does arithmetic on the bits themselves.
		</p>
	</section>

	<section id="octal">
		<h2>Octal and binary: groups of three</h2>
		<p class="section-intro">
			Octal is base 8, and 8 is 2<sup>3</sup>, so each octal digit is exactly three bits. It is rarer than hex today,
			but Unix file permissions still use it, because the permission bits come in threes.
		</p>
		<div class="octal-grid">
			<div class="table-wrap">
				<table class="data-table">
					<thead><tr><th scope="col">Octal</th><th scope="col">Binary</th></tr></thead>
					<tbody>
						{#each octalDigitTable as row}
							<tr><td class="mono strong">{row.octal}</td><td class="mono">{row.binary}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="card worked">
				<h3>chmod 755</h3>
				<p class="mono small">
					{#each perms as g, i}{g.digit} → {g.bits} → {rwx(g.bits)} ({permNames[i]})<br />{/each}
				</p>
				<p class="small">
					Each group of three bits is read, write and execute. 755 gives the owner everything and everyone else read and
					execute. <a href="/hex-to-binary?v=755&amp;from=oct" on:click|preventDefault={() => tryValue('755', 'oct')}
						>Convert it</a
					>
				</p>
			</div>
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
		align-items: center;
		gap: 4px;
		margin-bottom: 0.9rem;
	}

	.opt-label {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.2rem;
	}

	.opt-label.to {
		margin-left: 0.8rem;
	}

	.direction button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
		padding: 0.35rem 0.8rem;
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

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0.8rem 0 1rem;
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
		font-size: 1.5rem;
		overflow-wrap: anywhere;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
		overflow-wrap: anywhere;
	}

	.working-title {
		margin-top: 1.1rem !important;
	}

	/* The groups wrap onto new lines on a phone, a group at a time. */
	.groups {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 0.6rem;
	}

	.group {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.35rem 0.55rem;
		min-width: 3.2rem;
	}

	.group-digit {
		color: #fff;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.group-bits {
		font-size: 1.05rem;
		letter-spacing: 0.08em;
	}

	.group-bits .one {
		color: #6fcf6f;
	}

	.group-bits .zero {
		color: #ff7a7a;
	}

	.group-bits .pad {
		color: #8c8c8c;
		text-decoration: underline dotted;
	}

	.arrow {
		color: #999;
		font-size: 0.8rem;
		line-height: 1;
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.6rem 0 0;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.nibbles .gap {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.worked-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
		margin: 1rem 0;
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

	.small {
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
		overflow-wrap: anywhere;
	}

	.octal-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 16px;
		align-items: start;
	}

	@media (max-width: 560px) {
		.octal-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Both halves of the table fit a phone without scrolling. */
	@media (max-width: 560px) {
		.nibbles th,
		.nibbles td {
			padding-left: 0.45rem;
			padding-right: 0.45rem;
			font-size: 0.85rem;
		}
	}
</style>
