<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import PageHead from '$lib/PageHead.svelte';
	import { groupDecimal } from '$lib/radix';
	import {
		parseIPv6,
		expand,
		compress,
		compressText,
		explain,
		summarise,
		prefixInfo,
		describe,
		parseMac,
		eui64,
		hex4,
		bits16,
		bin8,
		ADDRESS_TYPES,
		MAPPED_RANGE,
		IPv6Error,
		MAX_INPUT,
		UL_BIT,
		type ParsedIPv6
	} from '$lib/ipv6';
	import { readUrl, syncUrl, safeText } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const DEFAULTS = { a: '2001:0DB8:0000:0000:0008:0800:200C:417A/64', mac: '00:1A:2B:3C:4D:5E' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.a, MAX_INPUT + 10) ?? input;
		macInput = safeText(p.mac, 40) ?? macInput;
		// Drops any query value that was not taken, so the address shows the state on screen.
		syncUrl({ a: input, mac: macInput }, DEFAULTS);
	});

	let input = DEFAULTS.a;
	let macInput = DEFAULTS.mac;
	$: syncUrl({ a: input, mac: macInput }, DEFAULTS);

	// Runs at build time too, so the page ships with a real worked example.
	let parsed: ParsedIPv6 = parseIPv6(DEFAULTS.a);
	let error = '';
	$: {
		try {
			parsed = parseIPv6(input);
			error = '';
		} catch (e) {
			error = e instanceof IPv6Error ? e.message : 'That is not an IPv6 address.';
		}
	}
	$: c = compress(parsed.hextets);
	$: full = expand(parsed.hextets);
	$: steps = explain(parsed);
	$: info = describe(parsed.hextets);
	$: pre = parsed.prefix === null ? null : prefixInfo(parsed.value, parsed.prefix);
	$: suffix = (parsed.zone !== null ? `%${parsed.zone}` : '') + (parsed.prefix !== null ? `/${parsed.prefix}` : '');
	$: changed = c.text !== parsed.address;
	$: inRun = (i: number) => !!c.chosen && i >= c.chosen.start && i < c.chosen.start + c.chosen.length;

	/** The 128 bits, each marked as prefix or not, grouped by hextet and nibble. */
	$: bitGroups = parsed.hextets.map((h, g) => {
		const bits = bits16(h);
		return {
			hex: hex4(h),
			nibbles: [0, 1, 2, 3].map((n) => ({
				digit: hex4(h)[n],
				bits: [0, 1, 2, 3].map((b) => {
					const index = g * 16 + n * 4 + b;
					return { bit: bits[n * 4 + b], net: parsed.prefix !== null && index < parsed.prefix };
				})
			})),
			netBits: parsed.prefix === null ? 0 : Math.max(0, Math.min(16, parsed.prefix - g * 16))
		};
	});

	// --- EUI-64 ---
	let macError = '';
	let mac = parseMac(DEFAULTS.mac);
	$: {
		try {
			mac = parseMac(macInput);
			macError = '';
		} catch (e) {
			macError = e instanceof IPv6Error ? e.message : 'That is not a MAC address.';
		}
	}
	$: e64 = eui64(mac);
	$: linkLocal = compressText(e64.linkLocal);
	$: globalExample = compressText([0x2001, 0xdb8, 1, 2, ...e64.iid]);

	// The alerts wait for a pause in typing: almost every half-typed address is
	// invalid, and a screen reader should not be interrupted on each keystroke.
	// The visible error still updates at once.
	let alertText = '';
	let macAlertText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	let macAlertTimer: ReturnType<typeof setTimeout>;
	$: {
		clearTimeout(alertTimer);
		if (!error) alertText = '';
		else {
			const message = error;
			alertTimer = setTimeout(() => (alertText = message), 500);
		}
	}
	$: {
		clearTimeout(macAlertTimer);
		if (!macError) macAlertText = '';
		else {
			const message = macError;
			macAlertTimer = setTimeout(() => (macAlertText = message), 500);
		}
	}

	// --- copying ---
	let copyMessage = '';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyMessage = `Copied the ${what}: ${text}`;
		} catch {
			copyMessage = 'Could not copy automatically: select the text and press ctrl+C.';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyMessage = ''), 3000);
	}

	function tryAddress(value: string) {
		input = value;
		const field = document.getElementById('address');
		const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		field?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples: { label: string; v: string }[] = [
		{ label: 'Two equal zero runs', v: '2001:db8:0:0:1:0:0:1' },
		{ label: 'One zero group', v: '2001:db8:0:1:1:1:1:1' },
		{ label: 'Loopback', v: '0:0:0:0:0:0:0:1' },
		{ label: 'Link-local with zone', v: 'FE80::021A:2BFF:FE3C:4D5E%eth0' },
		{ label: 'IPv4-mapped', v: '::ffff:192.0.2.1' },
		{ label: 'Multicast', v: 'ff02::1:ff3c:4d5e' },
		{ label: 'Unique local /48', v: 'fd12:3456:789a::/48' },
		{ label: 'Teredo', v: '2001:0000:4136:e378:8000:63bf:3fff:fdd2' },
		{ label: 'NAT64', v: '64:ff9b::192.0.2.33' },
		{ label: 'Two :: (invalid)', v: '2001:db8::1::1' }
	];

	const dec = (n: bigint) => groupDecimal(n.toString());
	/**
	 * Long addresses and numbers may wrap after a single colon or a comma, never
	 * inside a group and never at a ::, so that a line never ends in what looks
	 * like a complete, shorter address. (A loop rather than a lookbehind regex,
	 * which older Safari cannot parse.)
	 */
	function pieces(text: string): string[] {
		const out: string[] = [];
		let start = 0;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (ch === ',' || (ch === ':' && text[i - 1] !== ':' && text[i + 1] !== ':')) {
				out.push(text.slice(start, i + 1));
				start = i + 1;
			}
		}
		if (start < text.length) out.push(text.slice(start));
		return out;
	}

	// --- teaching content, all from the engine ---
	const ruleExamples = [
		'2001:0db8:0000:0000:0000:0000:0002:0001',
		'2001:db8::0:1',
		'2001:db8:0:1:1:1:1:1',
		'2001:0:0:1:0:0:0:1',
		'2001:db8:0:0:1:0:0:1',
		'FE80:0:0:0:0:0:0:1',
		'0:0:0:0:0:ffff:c000:0201'
	].map((v) => {
		const p = parseIPv6(v);
		const r = compress(p.hextets);
		return { v, canonical: r.text, why: summarise(p) };
	});

	const typeRows = ADDRESS_TYPES.map((t) => ({ ...t, canonical: compressText(parseIPv6(t.example).hextets) }));

	const prefixRows = [
		{ p: 32, use: 'A typical allocation to an internet provider or large organisation' },
		{ p: 48, use: 'A site, such as an office or campus' },
		{ p: 56, use: 'A common size for a home connection' },
		{ p: 64, use: 'One network (a LAN or VLAN); SLAAC needs exactly /64' },
		{ p: 127, use: 'A point-to-point link between two routers (RFC 6164)' },
		{ p: 128, use: 'A single address, such as a loopback or one host route' }
	].map((r) => ({ ...r, info: prefixInfo(0n, r.p) }));

	// Why :: may appear once: every way of sharing the missing zeros between two gaps.
	const ambiguous = [1, 2, 3].map((k) =>
		compressText(parseIPv6(`2001:db8:${'0:'.repeat(k)}1:${'0:'.repeat(4 - k)}1`).hextets)
	);
	const ambiguousFull = [1, 2, 3].map((k) => `2001:db8:${'0:'.repeat(k)}1:${'0:'.repeat(4 - k)}1`);
	const loopFull = expand(parseIPv6('::1').hextets);
	const tieExample = compressText(parseIPv6('2001:db8:0:0:1:0:0:1').hextets);
	const mappedFull = expand(parseIPv6('::ffff:192.0.2.1').hextets);
	const per64 = prefixInfo(0n, 64).count;
	const per48 = prefixInfo(0n, 48).subnets64 ?? 0n;

	const faqs = [
		{
			q: 'How do I expand an IPv6 address?',
			a: `Put back what the two shorthands removed. Pad every group with leading zeros to four hex digits, then replace :: with as many 0000 groups as it takes to make eight. ::1 has one written group, so the :: stands for seven, and the full form is ${loopFull}.`
		},
		{
			q: 'What is the correct way to compress an IPv6 address?',
			a: `RFC 5952 fixes one canonical form: lower case letters, no leading zeros in any group, and :: in place of the longest run of two or more zero groups, the first one if two runs are equally long. A single zero group stays as 0. So 2001:db8:0:0:1:0:0:1 is written ${tieExample}.`
		},
		{
			q: 'Why can :: only appear once in an address?',
			a: `Because the reader works out how many zero groups :: stands for by counting the groups that are written. With two of them the zeros could be shared out more than one way: 2001:db8::1::1 could be ${ambiguous.join(
				', '
			)}, three different addresses.`
		},
		{
			q: 'How many addresses are in a /64?',
			a: `A /64 leaves 64 bits for the interface identifier, so it holds 2 to the power 64, which is ${dec(
				per64
			)} addresses. A /48 holds ${dec(per48)} of those /64 networks.`
		},
		{
			q: 'What does %eth0 after an address mean?',
			a: 'It is a zone ID (RFC 4007). Every interface has a link-local address in fe80::/10, and the same fe80 address can be valid on more than one link at once, so the zone names the interface to use: fe80::1%eth0 on Linux, or a number such as %12 on Windows. It is not part of the 128 bits and never appears in a packet.'
		},
		{
			q: 'What is an IPv4-mapped IPv6 address?',
			a: `An IPv4 address written inside ${MAPPED_RANGE} (the IANA registry writes it ::ffff:0:0/96), such as ::ffff:192.0.2.1 (${mappedFull} in full). Programs that use one IPv6 socket for both protocols see IPv4 clients this way. RFC 5952 recommends keeping the IPv4 part in dotted decimal.`
		},
		{
			q: 'Should IPv6 addresses be upper or lower case?',
			a: 'Software must accept both, since hex digits mean the same in either case. When writing an address out, RFC 5952 says lower case, so that the same address always looks the same in logs, configuration files and searches.'
		}
	];

	const page = {
		title: 'IPv6 Expand and Compress Tool (RFC 5952), With Steps',
		description:
			'Expand an IPv6 address to all 32 hex digits or compress it to the RFC 5952 short form, with each rule explained, all 128 bits, the prefix and the address type.',
		url: `${SITE}/ipv6-expand-compress`,
		image: `${SITE}/og/ipv6-expand-compress.png`,
		imageAlt: 'LogicGates.org: IPv6 expand and compress tool'
	};
</script>

<PageHead {page} {faqs} crumb="IPv6 expand and compress" />

<ContentPage
	related={[
		{ href: '/subnet-calculator', label: 'Subnet calculator' },
		{ href: '/vlsm-calculator', label: 'VLSM calculator' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>IPv6 expand and compress</h1>
		<p class="lede">
			Paste an IPv6 address in any form to get it written out in full and in the one canonical short form of RFC 5952,
			with every rule that changed it, all 128 bits, its prefix and what kind of address it is.
		</p>

		<div class="card tool">
			<label class="field" for="address">IPv6 address</label>
			<input
				id="address"
				class="value-input"
				type="text"
				bind:value={input}
				maxlength={MAX_INPUT + 10}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="address-help{error ? ' address-error' : ''}"
			/>
			{#if error}
				<p class="error" id="address-error">{error}</p>
			{/if}
			{#if alertText}
				<p class="visually-hidden" role="alert">{alertText}</p>
			{/if}
			<p class="field-help" id="address-help">
				Any case, with or without leading zeros and ::. A /prefix, a %zone, an IPv4 tail such as ::ffff:192.0.2.1 and
				square brackets with a port are all understood.
			</p>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" title={example.v} on:click={() => tryAddress(example.v)}>
						{example.label}
					</button>
				{/each}
			</div>

			<!-- inert, not just aria-hidden: the dimmed last result must not be reachable by keyboard either. -->
			<div class="results" class:stale={!!error} inert={error ? true : undefined}>
				<div class="answer" role={error ? undefined : 'status'}>
					<div class="answer-row">
						<span class="answer-label">Compressed (RFC 5952)</span>
						<span class="answer-value mono" id="compressed"
							>{#each pieces(c.text) as p}{p}<wbr />{/each}<span class="extra">{suffix}</span></span
						>
						<button
							type="button"
							class="copy"
							disabled={!!error}
							on:click={() => copy(c.text + suffix, 'compressed form')}
							>Copy<span class="visually-hidden"> compressed form</span></button
						>
					</div>
					<div class="answer-row">
						<span class="answer-label">Expanded</span>
						<span class="answer-value full mono" id="expanded"
							>{#each pieces(full) as p}{p}<wbr />{/each}<span class="extra">{suffix}</span></span
						>
						<button type="button" class="copy" disabled={!!error} on:click={() => copy(full + suffix, 'expanded form')}
							>Copy<span class="visually-hidden"> expanded form</span></button
						>
					</div>
					<p class="answer-also">
						{#if changed}
							You typed <span class="mono"
								>{#each pieces(parsed.address) as p}{p}<wbr />{/each}</span
							>, which is not the canonical form.
						{:else}
							What you typed is already the canonical form.
						{/if}
						<strong>{info.type.name}</strong>{info.type.range ? ` (${info.type.range})` : ''}.
						{#if parsed.port !== null}
							Port {parsed.port} is not part of the address and is left out.
						{/if}
					</p>
				</div>
				<p class="copy-status" aria-live="polite">{copyMessage}</p>

				<h2 class="working-title">How the short form is made</h2>
				<p class="small-intro">Each group as typed, written in full, then as it appears in the short form.</p>
				<ol class="groups">
					{#each parsed.hextets as h, i}
						{#if i % 4 === 0}
							<!-- Row captions; each tile also names its rows for screen readers. -->
							<li class="group legend" class:second={i === 4} aria-hidden="true">
								<span class="g-num">&nbsp;</span>
								<span class="g-typed"><span class="legend-label">Typed</span></span>
								<span class="g-full"><span class="legend-label">Full</span></span>
								<span class="g-short"><span class="legend-label">Short</span></span>
							</li>
						{/if}
						<li class="group" class:in-run={inRun(i)} class:tail={c.mapped && i >= 6} class:zero={h === 0 && !inRun(i)}>
							<span class="g-num">Group {i + 1}</span>
							<span class="g-typed mono">
								<span class="visually-hidden">typed:</span>
								{#if parsed.source[i] === 'gap'}<span class="g-note">from ::</span>
								{:else if parsed.source[i] === 'ipv4'}<span class="g-note">IPv4 tail</span>
								{:else}{parsed.typed[i]}{/if}
							</span>
							<span class="g-full mono"><span class="visually-hidden">in full:</span> {hex4(h)}</span>
							<span class="g-short mono">
								<span class="visually-hidden">short form:</span>
								{#if c.mapped && i >= 6}{(h >> 8) + '.' + (h & 0xff)}
								{:else if inRun(i)}<span class="g-note">in ::</span>
								{:else}{h.toString(16)}{/if}
							</span>
						</li>
					{/each}
				</ol>
				<ol class="rules">
					{#each steps as step}
						<li class:unchanged={!step.changed}>
							<strong>{step.rule}.</strong>
							{step.detail}
						</li>
					{/each}
				</ol>

				<h2 class="working-title">All 128 bits</h2>
				<p class="small-intro">
					{#if pre && pre.prefix === 0}
						With /0 there is no network part: all 128 bits are free (dotted underline).
					{:else if pre && pre.prefix === 128}
						All 128 bits are the network prefix (bold, solid underline): a /128 names exactly one address.
					{:else if pre}
						The first {pre.prefix} bits are the network prefix (bold, solid underline); {pre.hostBits === 1
							? 'the last bit identifies'
							: `the other ${pre.hostBits} identify`} the address inside it (dotted underline).
					{:else}
						Eight groups of 16 bits, each hex digit standing for four. Add a prefix length such as /64 to mark the
						network part.
					{/if}
				</p>
				<div class="bits-wrap">
					<div class="bit-groups">
						{#each bitGroups as g, i}
							<div
								class="bit-group"
								role="group"
								aria-label="Group {i + 1}, {g.hex}: {bits16(parsed.hextets[i])}{pre
									? `, ${g.netBits} of 16 bits in the prefix`
									: ''}"
							>
								<span class="bg-head mono" aria-hidden="true">{g.hex}</span>
								<span class="bg-bits mono" aria-hidden="true">
									{#each g.nibbles as nib}
										<span class="nibble">
											<span class="nib-bits"
												>{#each nib.bits as b}<span class="bit" class:net={b.net} class:host={pre && !b.net}
														>{b.bit}</span
													>{/each}</span
											>
										</span>
									{/each}
								</span>
							</div>
						{/each}
					</div>
				</div>

				{#if pre}
					<h2 class="working-title">The /{pre.prefix} network</h2>
					<dl class="facts">
						<dt>Network prefix</dt>
						<dd class="mono">{compressText(pre.network)}/{pre.prefix}</dd>
						<dt>First address</dt>
						<dd class="mono">{compressText(pre.network)}</dd>
						<dt>Last address</dt>
						<dd class="mono">
							{#each pieces(compressText(pre.last)) as p}{p}<wbr />{/each}
						</dd>
						<dt>Addresses</dt>
						<dd>
							<span class="mono">2<span class="visually-hidden"> to the power </span><sup>{pre.hostBits}</sup></span> =
							<span class="mono"
								>{#each pieces(dec(pre.count)) as p}{p}<wbr />{/each}</span
							>
						</dd>
						<dt>/64 networks</dt>
						<dd>
							{#if pre.subnets64 !== null}
								<span class="mono"
									>2<span class="visually-hidden"> to the power </span><sup>{64 - pre.prefix}</sup></span
								>
								= <span class="mono">{dec(pre.subnets64)}</span>
							{:else if pre.prefix === 128}
								Smaller than one /64: a single address
							{:else}
								Smaller than one /64: <span class="mono"
									>2<span class="visually-hidden"> to the power </span><sup>{pre.hostBits}</sup></span
								>
								of its <span class="mono">2<span class="visually-hidden"> to the power </span><sup>64</sup></span> addresses
							{/if}
						</dd>
						<dt>Mask</dt>
						<dd class="mono">{compressText(pre.mask)}</dd>
					</dl>
					{#if pre.hostPartSet}
						<p class="note">
							The address has bits set after the first {pre.prefix}, so it is one address inside the network rather than
							the network itself.
						</p>
					{/if}
				{/if}

				<h2 class="working-title">Address type: {info.type.name}</h2>
				<p class="type-line">
					{#if info.type.range}<span class="mono">{info.type.range}</span>, {info.type.rfc}.{/if}
					{info.type.about}
				</p>
				{#if info.notes.length}
					<ul class="type-notes">
						{#each info.notes as note}<li>{note}</li>{/each}
					</ul>
				{/if}
			</div>
			<p class="share-row"><ShareLink what="this address and MAC" /></p>
		</div>
	</section>

	<section id="eui64">
		<h2>MAC address to EUI-64 interface identifier</h2>
		<p class="section-intro">
			Stateless autoconfiguration (SLAAC) traditionally built the last 64 bits of an address from the network card's
			48-bit MAC address, using the modified EUI-64 format of RFC 4291: split the MAC in half, put ff:fe in the middle,
			and flip one bit.
		</p>
		<div class="card tool">
			<label class="field" for="mac">MAC address</label>
			<input
				id="mac"
				class="value-input"
				type="text"
				bind:value={macInput}
				maxlength={40}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={macError ? 'true' : 'false'}
				aria-describedby="mac-help{macError ? ' mac-error' : ''}"
			/>
			{#if macError}
				<p class="error" id="mac-error">{macError}</p>
			{/if}
			{#if macAlertText}
				<p class="visually-hidden" role="alert">{macAlertText}</p>
			{/if}
			<p class="field-help" id="mac-help">
				Six bytes in hex, written 00:1a:2b:3c:4d:5e, 00-1A-2B-3C-4D-5E, 00 1a 2b 3c 4d 5e, 001a.2b3c.4d5e or with no
				separators.
			</p>

			<div class="results" class:stale={!!macError} inert={macError ? true : undefined}>
				<ol class="eui-steps">
					<li>
						<span class="step-title">Split the MAC in half</span>
						<span class="bytes mono">
							{#each e64.mac as b, i}<span class="byte">{b.toString(16).padStart(2, '0')}</span>{#if i === 2}<span
										class="split"
										aria-hidden="true">|</span
									>{/if}{/each}
						</span>
					</li>
					<li>
						<span class="step-title">Insert ff:fe in the middle</span>
						<span class="bytes mono">
							{#each e64.inserted as b, i}<span class="byte" class:added={i === 3 || i === 4}
									>{b.toString(16).padStart(2, '0')}</span
								>{/each}
						</span>
					</li>
					<li>
						<span class="step-title">Flip the universal/local bit (the seventh bit of the first byte)</span>
						<span class="flip mono">
							<span
								>{#each bin8(e64.firstBefore).split('') as bit, k}<span class="fbit" class:ul={k === 6}>{bit}</span
									>{/each}</span
							>
							<span aria-hidden="true">→</span>
							<span
								>{#each bin8(e64.firstAfter).split('') as bit, k}<span class="fbit" class:ul={k === 6}>{bit}</span
									>{/each}</span
							>
							<span class="flip-hex"
								>{e64.firstBefore.toString(16).padStart(2, '0')} XOR {UL_BIT.toString(16).padStart(2, '0')} = {e64.firstAfter
									.toString(16)
									.padStart(2, '0')}</span
							>
						</span>
					</li>
					<li>
						<span class="step-title">Group into four hextets: the interface identifier</span>
						<span class="mono iid">{e64.iid.map(hex4).join(':')}</span>
					</li>
					<li>
						<span class="step-title">Put fe80::/64 in front: the link-local address</span>
						<span class="mono iid strong" id="link-local" aria-live="polite">{linkLocal}</span>
						<span class="eui-actions">
							<button
								type="button"
								class="copy"
								disabled={!!macError}
								on:click={() => copy(linkLocal, 'link-local address')}
								>Copy<span class="visually-hidden"> link-local address</span></button
							>
							<button type="button" class="copy" disabled={!!macError} on:click={() => tryAddress(linkLocal)}
								>Explain this address</button
							>
						</span>
					</li>
				</ol>
				<p class="note">
					{#if e64.group}
						Its lowest bit is 1, which marks a group (multicast) MAC; a real interface never has one. The U/L bit was
						{e64.locallyAdministered ? 1 : 0}, so the identifier's bit becomes {e64.locallyAdministered ? 0 : 1}.
					{:else if e64.locallyAdministered}
						This MAC is locally administered (the bit was 1), so the flip clears it to 0, which in an interface
						identifier means "local".
					{:else}
						This MAC is a universally administered, manufacturer-assigned one (the bit was 0), so the identifier's bit
						becomes 1, meaning "globally unique".
					{/if}
					The flip is there so that hand-numbered identifiers such as ::1 and ::2 read as local without anyone having to
					set that bit. On a global prefix the same identifier follows the prefix, for example {globalExample}.
				</p>
				<p class="reducer">
					Many systems now pick the interface identifier at random instead (RFC 8981 temporary addresses, RFC 7217
					stable ones), because an EUI-64 identifier reveals the MAC address and follows a device from network to
					network.
				</p>
			</div>
		</div>
	</section>

	<section id="notation">
		<h2>How IPv6 addresses are written</h2>
		<p>
			An IPv6 address is 128 bits, written as eight groups of 16 bits, each group as four hex digits separated by
			colons. One hex digit is four bits, so a group is four digits and the whole address is 32 of them. Written out in
			full, that is long, so RFC 4291 allows two shorthands:
		</p>
		<ul class="points">
			<li>
				<strong>Leading zeros in a group can go.</strong> 0db8 can be written db8, 0042 as 42 and 0000 as 0. Trailing zeros
				stay: db80 is a different number.
			</li>
			<li>
				<strong>One run of zero groups can become ::.</strong> The reader counts the groups that are written and fills the
				gap with as many zero groups as it takes to make eight, which is why :: may appear only once.
			</li>
		</ul>
		<p>
			Those rules allow many spellings of the same address, which makes searching logs and comparing configurations
			unreliable. RFC 5952 therefore picks one canonical form, the one this page produces:
		</p>
		<ol class="points">
			<li>Lower case hex digits (section 4.3).</li>
			<li>No leading zeros; a zero group is a single 0 (section 4.1).</li>
			<li>:: must be used to its full extent: it covers the whole run of zeros it replaces (section 4.2.1).</li>
			<li>:: is not used for a single zero group (section 4.2.2).</li>
			<li>:: replaces the longest run of zero groups; if two runs are equally long, the first one (section 4.2.3).</li>
			<li>
				IPv4-mapped addresses keep their last 32 bits in dotted decimal (section 5). RFC 5952 recommends that for other
				formats that carry an IPv4 address too, such as NAT64's 64:ff9b::192.0.2.33; this tool, like glibc's inet_ntop,
				writes those in hex and shows the IPv4 address under the address type.
			</li>
		</ol>
	</section>

	<section id="examples">
		<h2>The rules on real examples</h2>
		<p class="section-intro">Each row worked out by the same code as the tool above. Select one to see its steps.</p>
		<div class="table-wrap">
			<table class="data-table examples">
				<thead>
					<tr><th scope="col">Written as</th><th scope="col">Canonical</th><th scope="col">Why</th></tr>
				</thead>
				<tbody>
					{#each ruleExamples as r}
						<tr>
							<td class="mono"
								><a
									href="/ipv6-expand-compress?a={encodeURIComponent(r.v)}"
									on:click|preventDefault={() => tryAddress(r.v)}
									>{#each pieces(r.v) as p}{p}<wbr />{/each}</a
								></td
							>
							<td class="mono strong canon"
								>{#each pieces(r.canonical) as p}{p}<wbr />{/each}</td
							>
							<td>{r.why}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="types">
		<h2>IPv6 address types</h2>
		<p class="section-intro">
			The ranges the tool recognises, checked from the most specific down: an address takes the first range it falls in.
			Every address the tool does not place in one of these is outside 2000::/3 and reserved.
		</p>
		<div class="table-wrap">
			<table class="data-table types">
				<thead>
					<tr>
						<th scope="col">Range</th>
						<th scope="col">Type</th>
						<th scope="col">Example</th>
						<th scope="col">What it is for</th>
					</tr>
				</thead>
				<tbody>
					{#each typeRows as t}
						<tr>
							<td class="mono nowrap">{t.range}</td>
							<td class="nowrap"><strong>{t.name}</strong><br /><span class="rfc">{t.rfc}</span></td>
							<td class="mono"
								><a
									href="/ipv6-expand-compress?a={encodeURIComponent(t.canonical)}"
									on:click|preventDefault={() => tryAddress(t.canonical)}
									>{#each pieces(t.canonical) as p}{p}<wbr />{/each}</a
								></td
							>
							<td class="about">{t.about}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="prefixes">
		<h2>Prefix lengths and how much they hold</h2>
		<p class="section-intro">
			The prefix length says how many leading bits name the network; the rest number the addresses in it. Each bit fewer
			doubles the size. These are the sizes that come up most:
		</p>
		<div class="table-wrap">
			<table class="data-table prefixes">
				<thead>
					<tr>
						<th scope="col">Prefix</th>
						<th scope="col" class="num">Addresses</th>
						<th scope="col" class="num">/64 networks</th>
						<th scope="col">Typical use</th>
					</tr>
				</thead>
				<tbody>
					{#each prefixRows as r}
						<tr>
							<td class="mono strong">/{r.p}</td>
							<td class="mono num nowrap"
								>2<span class="visually-hidden"> to the power </span><sup>{r.info.hostBits}</sup></td
							>
							<td class="mono num nowrap">{r.info.subnets64 === null ? '–' : dec(r.info.subnets64)}</td>
							<td>{r.use}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			IPv6 subnetting splits on these boundaries, often on whole hex digits (4 bits) so that subnets line up with the
			written groups. For the IPv4 version, with every mask and host count, see the <a href="/subnet-calculator"
				>subnet calculator</a
			>
			and the <a href="/vlsm-calculator">VLSM calculator</a>.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Using :: twice.</strong> 2001:db8::1::1 is invalid, because there is no telling how the four missing
				zero groups are shared between the gaps: it could be {ambiguousFull.join(', ')}.
			</li>
			<li>
				<strong>Dropping trailing zeros.</strong> Only leading zeros may go: 2001:db8:1:: and 2001:db8:1000:: are different
				addresses.
			</li>
			<li>
				<strong>Shortening a single zero group to ::.</strong> Allowed by RFC 4291 but not canonical: 2001:db8::1:1:1:1:1
				should be written 2001:db8:0:1:1:1:1:1.
			</li>
			<li>
				<strong>Putting a port straight after the address.</strong> In 2001:db8::1:443 the 443 is read as one more hex group,
				which makes a valid but different address. With a port, wrap the address in brackets: [2001:db8::1]:443, as URLs
				do.
			</li>
			<li>
				<strong>An IPv4 tail in the middle.</strong> A dotted IPv4 part stands for the last 32 bits, so it can only come
				at the end: ::ffff:192.0.2.1, never 192.0.2.1::1.
			</li>
			<li>
				<strong>Converting the IPv4 part as one decimal number.</strong> Each of the four numbers is a byte, two hex
				digits: 192.0.2.1 is c0.00.02.01, so the groups are c000:0201. The
				<a href="/hex-to-decimal">hex to decimal converter</a>
				does the byte conversions, and the <a href="/hex-to-binary">hex to binary converter</a> shows the bits behind each
				digit.
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

	/* Full-length addresses in the answers are one unbreakable run; at 320px
	   (400% zoom) they would otherwise push the page sideways. */
	.faq p {
		overflow-wrap: anywhere;
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
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
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

	.answer-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 0.6rem;
		margin-bottom: 0.5rem;
	}

	.answer-label {
		grid-column: 1 / -1;
		color: #999;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-value {
		color: #8ede8e;
		font-size: 1.45rem;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.answer-value.full {
		color: #fff;
		font-size: 1.05rem;
	}

	.extra {
		color: #bbb;
	}

	.answer-also {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.2rem 0 0;
		overflow-wrap: anywhere;
	}

	.answer-also strong {
		color: #fff;
	}

	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.copy-status {
		color: #8ede8e;
		font-size: 0.8rem;
		min-height: 1.3em;
		margin: 0.3rem 0 0;
		overflow-wrap: anywhere;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.3rem !important;
		margin-bottom: 0.4rem !important;
	}

	.small-intro {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0 0 0.6rem;
	}

	.groups {
		list-style: none;
		padding: 0;
		margin: 0 0 0.8rem;
		display: grid;
		grid-template-columns: auto repeat(8, minmax(0, 1fr));
		gap: 6px;
	}

	.group.legend {
		background: none;
		border: none;
		align-items: flex-end;
		padding-left: 0;
		padding-right: 0;
	}

	.group.legend.second {
		display: none;
	}

	.legend-label {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.68rem;
		font-weight: normal;
		color: #999;
	}

	.group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.35rem 0.2rem;
		min-width: 0;
		position: relative;
	}

	.group.in-run {
		border: 1px dashed #5db65d;
		background: rgba(93, 182, 93, 0.08);
	}

	.group.tail {
		border-style: dotted;
	}

	.g-num {
		color: #999;
		font-size: 0.68rem;
	}

	.g-typed {
		color: #bbb !important;
		font-size: 0.8rem;
		min-height: 1.3em;
	}

	.g-full {
		color: #fff !important;
		font-size: 0.9rem;
	}

	.g-short {
		color: #8ede8e !important;
		font-weight: 700;
		font-size: 0.95rem;
		min-height: 1.4em;
	}

	.g-note {
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 0.7rem;
		font-weight: normal;
		color: #bbb;
		white-space: nowrap;
	}

	.group.in-run .g-short .g-note {
		color: #8ede8e;
	}

	.rules {
		color: #ddd;
		font-size: 0.9rem;
		padding-left: 1.3rem;
		margin: 0;
	}

	.rules li {
		margin-bottom: 0.35rem;
	}

	.rules li.unchanged {
		color: #aaa;
	}

	.rules strong {
		color: #fff;
	}

	.bits-wrap {
		overflow-x: auto;
	}

	.bit-groups {
		display: grid;
		grid-template-columns: repeat(4, minmax(max-content, 1fr));
		gap: 8px;
	}

	.bit-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.3rem 0.45rem 0.4rem;
	}

	.bg-head {
		color: #fff !important;
		font-size: 0.85rem;
		letter-spacing: 0.08em;
	}

	.bg-bits {
		display: flex;
		gap: 5px;
	}

	.nib-bits {
		display: flex;
	}

	.bit {
		display: inline-block;
		width: 0.62rem;
		text-align: center;
		font-size: 0.85rem;
		color: #ccc;
		border-bottom: 2px solid transparent;
		line-height: 1.5;
	}

	.bit.net {
		color: #8ede8e;
		font-weight: 700;
		border-bottom: 2px solid #5db65d;
	}

	.bit.host {
		color: #aaa;
		border-bottom: 2px dotted #888;
	}

	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.3rem 1rem;
		margin: 0;
		font-size: 0.92rem;
	}

	.facts dt {
		color: #999;
	}

	.facts dd {
		margin: 0;
		color: #ddd;
		overflow-wrap: anywhere;
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.7rem 0 0;
	}

	.type-line {
		color: #ddd;
		font-size: 0.92rem;
		margin: 0;
	}

	.type-notes {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
		padding-left: 1.2rem;
		overflow-wrap: anywhere;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.eui-steps {
		padding-left: 1.3rem;
		margin: 0;
		color: #ddd;
	}

	.eui-steps li {
		margin-bottom: 0.75rem;
	}

	.step-title {
		display: block;
		font-size: 0.9rem;
		color: #fff;
		margin-bottom: 0.2rem;
	}

	.bytes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.byte {
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		padding: 0 0.35rem;
		font-size: 0.95rem;
	}

	.byte.added {
		border: 1px dashed #5db65d;
		color: #8ede8e;
		font-weight: 700;
	}

	.split {
		color: #999;
		padding: 0 0.2rem;
	}

	.flip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
	}

	.fbit {
		display: inline-block;
		width: 0.7rem;
		text-align: center;
	}

	.fbit.ul {
		outline: 1px solid #5db65d;
		color: #8ede8e;
		font-weight: 700;
	}

	.flip-hex {
		color: #bbb;
		font-size: 0.85rem;
	}

	.iid {
		font-size: 1rem;
		overflow-wrap: anywhere;
	}

	.strong {
		color: #8ede8e !important;
		font-weight: 700;
	}

	.eui-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 0.4rem;
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

	.examples td {
		overflow-wrap: break-word;
	}

	.nowrap {
		white-space: nowrap;
	}

	.num {
		text-align: right !important;
	}

	.rfc {
		color: #999;
		font-size: 0.8rem;
	}

	.types td {
		vertical-align: top;
	}

	.types td.about {
		min-width: 260px;
		font-size: 0.88rem;
	}

	.data-table td.strong {
		color: #8ede8e;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 700px) {
		.groups {
			grid-template-columns: auto repeat(4, minmax(0, 1fr));
		}

		.group.legend.second {
			display: flex;
		}
	}

	.prefixes td:last-child {
		min-width: 12rem;
	}

	sup {
		font-size: 0.7em;
		line-height: 0;
	}

	@media (min-width: 561px) {
		/* Room for the longest short form here, 20 characters, on one line; the break points are for phones. */
		.examples td.canon {
			min-width: 21ch;
		}
	}

	@media (max-width: 560px) {
		.examples th,
		.examples td {
			padding: 0.35rem 0.5rem;
			font-size: 0.85rem;
		}

		/* The type table becomes one block per range: four columns do not fit a phone. */
		.types thead {
			display: none;
		}

		.types,
		.types tbody,
		.types tr,
		.types td {
			display: block;
		}

		.types tr {
			padding: 0.55rem 0.75rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		}

		.types tbody tr:last-child {
			border-bottom: none;
		}

		.types td,
		.types tbody tr:last-child td {
			border: none;
			padding: 0.1rem 0;
		}

		.types td.about {
			min-width: 0;
		}

		/* The prefix table keeps its three short columns and puts the use underneath. */
		.prefixes,
		.prefixes thead,
		.prefixes tbody {
			display: block;
		}

		.prefixes tr {
			display: grid;
			grid-template-columns: 3.2rem 1fr 1fr;
			border-bottom: 1px solid rgba(255, 255, 255, 0.15);
		}

		.prefixes tbody tr:last-child {
			border-bottom: none;
		}

		.prefixes th,
		.prefixes td,
		.prefixes tbody tr:last-child td {
			border: none;
			padding: 0.3rem 0.6rem;
		}

		.prefixes thead th:last-child {
			display: none;
		}

		.prefixes td:last-child {
			grid-column: 1 / -1;
			min-width: 0;
			padding-top: 0;
			font-size: 0.88rem;
		}

		.answer-value {
			font-size: 1.15rem;
		}

		.answer-value.full {
			font-size: 0.9rem;
		}

		.bit-groups {
			grid-template-columns: repeat(2, minmax(max-content, 1fr));
			gap: 6px;
		}

		.bit-group {
			padding: 0.25rem 0.3rem 0.35rem;
		}

		.bg-bits {
			gap: 3px;
		}

		.bit {
			width: 0.5rem;
			font-size: 0.72rem;
		}

		.facts {
			grid-template-columns: 1fr;
			gap: 0 0;
		}

		.facts dd {
			margin-bottom: 0.4rem;
		}
	}
</style>
