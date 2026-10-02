<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import SubnetBits from '$lib/SubnetBits.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseCidr,
		parseAddress,
		subnetInfo,
		inSubnet,
		formatAddress,
		dottedBits,
		toBits,
		magicNumber,
		maskFromPrefix,
		prefixTable,
		usableHosts,
		blockSize,
		SPECIAL_RANGES,
		ADDRESS_CLASSES,
		IpError,
		type SubnetInfo
	} from '$lib/ipv4';
	import { readUrl, syncUrl, safeText, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const DEFAULTS = { ip: '192.168.1.10/24', test: '192.168.2.10' };
	onMount(() => {
		const p = readUrl();
		input = safeText(p.ip, 80) ?? input;
		testInput = safeText(p.test, 40) ?? testInput;
	});
	$: syncUrl({ ip: input, test: testInput }, DEFAULTS);

	let input = DEFAULTS.ip;
	let testInput = DEFAULTS.test;

	const message = (e: unknown) => (e instanceof IpError ? e.message : 'That is not an IPv4 address and mask');

	// Runs at build time too, so the page ships with a real worked subnet. A
	// bad edit keeps the last good result on screen, dimmed, rather than
	// collapsing the layout.
	let info: SubnetInfo = subnetInfo(parseAddress('192.168.1.10'), 24);
	let addressText = '192.168.1.10';
	let error = '';
	$: {
		try {
			const parsed = parseCidr(input);
			info = subnetInfo(parsed.address, parsed.prefix);
			addressText = parsed.addressText;
			error = '';
		} catch (e) {
			error = message(e);
		}
	}

	let testAddress: number | null = null;
	let testError = '';
	$: {
		try {
			testAddress = testInput.trim() ? parseAddress(testInput) : null;
			testError = '';
		} catch (e) {
			testAddress = null;
			testError = message(e);
		}
	}
	$: testAnd = testAddress === null ? 0 : (testAddress & info.mask) >>> 0;
	$: testIn = testAddress !== null && inSubnet(testAddress, info.network, info.prefix);
	$: diffBits = testAddress === null ? 0 : [...toBits(testAnd)].filter((b, i) => b !== toBits(info.network)[i]).length;

	function setPrefix(p: number) {
		input = `${addressText}/${p}`;
	}

	const fmt = formatAddress;
	const count = (n: number) => n.toLocaleString('en-GB');
	const cidr = (s: { network: number; prefix: number }) => `${fmt(s.network)}/${s.prefix}`;

	$: fields = [
		{ id: 'network', label: 'Network address', value: fmt(info.network) },
		{
			id: 'broadcast',
			label: 'Broadcast address',
			value: info.broadcast === null ? `None (/${info.prefix})` : fmt(info.broadcast)
		},
		{ id: 'first', label: 'First usable host', value: fmt(info.firstHost) },
		{ id: 'last', label: 'Last usable host', value: fmt(info.lastHost) },
		{ id: 'usable', label: 'Usable hosts', value: count(info.usable) },
		{ id: 'total', label: 'Total addresses', value: count(info.total) },
		{ id: 'mask', label: 'Netmask', value: fmt(info.mask) },
		{ id: 'wildcard', label: 'Wildcard mask', value: fmt(info.wildcard) },
		{ id: 'prefix', label: 'Prefix length', value: `/${info.prefix}` },
		{ id: 'binary', label: 'Binary mask', value: dottedBits(info.mask) },
		{
			id: 'class',
			label: 'Class (historic)',
			value: `${info.addressClass.letter}${
				info.addressClass.defaultPrefix
					? ` (default /${info.addressClass.defaultPrefix})`
					: ` (${info.addressClass.use.toLowerCase()})`
			}`
		},
		{
			id: 'type',
			label: 'Address type',
			value: info.special
				? `${info.special.name}, ${info.special.cidr} (${info.special.rfc})`
				: 'Public (no special-use range)'
		}
	];

	$: notes = [
		info.kind === 'point-to-point'
			? `A /31 has only two addresses, so there is no room for a network and a broadcast address. RFC 3021 lets both be hosts on a point-to-point link between two routers: ${fmt(
					info.network
			  )} and ${fmt(info.last)}.`
			: '',
		info.kind === 'host'
			? `A /32 is one address on its own, ${fmt(
					info.address
			  )}: a host route, or a router's loopback address. There is no network or broadcast address to take away.`
			: '',
		info.isNetwork
			? `${fmt(
					info.address
			  )} is this subnet's network address, the name of the subnet itself, so it cannot be given to a host.`
			: '',
		info.isBroadcast
			? `${fmt(
					info.address
			  )} is this subnet's broadcast address: a packet sent to it reaches every host, so no single host can use it.`
			: '',
		info.special && info.special.prefix > info.prefix
			? `This /${info.prefix} is larger than the ${
					info.special.cidr
			  } ${info.special.name.toLowerCase()} range the address is in, so it also takes in addresses outside it.`
			: ''
	].filter(Boolean);

	// Copy a plain text summary of the result.
	let copyState: 'idle' | 'copied' | 'failed' = 'idle';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyResults() {
		const text = [`${fmt(info.address)}/${info.prefix}`, ...fields.map((f) => `${f.label}: ${f.value}`)].join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyState = 'idle'), 2500);
	}

	function tryValue(v: string) {
		input = v;
		const field = document.getElementById('cidr');
		field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	const examples = [
		'192.168.1.10/24',
		'10.0.0.1/8',
		'172.16.45.14/20',
		'192.168.10.77 255.255.255.224',
		'10.0.0.0/31',
		'8.8.8.8/32',
		'100.64.1.1/10',
		'169.254.10.20/16'
	];

	// Worked examples, computed by the same engine as the calculator.
	const workedInputs = ['172.16.45.14/20', '192.168.10.77/27', '10.10.10.130/26'];
	const worked = workedInputs.map((text) => {
		const p = parseCidr(text);
		return { text, info: subnetInfo(p.address, p.prefix), m: magicNumber(p.address, p.prefix) };
	});
	const octetsOf = (n: number) => fmt(n).split('.');

	const table = prefixTable();
	const d24 = subnetInfo(parseAddress('192.168.1.10'), 24);
	const d27 = subnetInfo(parseAddress('192.168.1.10'), 27);
	const p31 = subnetInfo(parseAddress('10.0.0.0'), 31);
	const same1 = parseAddress('192.168.1.10');
	const same2 = parseAddress('192.168.1.200');
	const other = parseAddress('192.168.2.10');

	const faqs = [
		{
			q: 'What does /24 mean?',
			a: `It is the prefix length: the first 24 of the address's 32 bits name the network and the remaining 8 name a host on it. Written as a mask that is ${fmt(
				d24.mask
			)}. A /24 holds ${count(d24.total)} addresses, of which ${count(
				d24.usable
			)} can be given to hosts, so 192.168.1.10/24 is on the network ${fmt(d24.network)}.`
		},
		{
			q: 'How do you work out the network address?',
			a: `AND the address with the mask, bit by bit: a 1 in the mask keeps the address bit, a 0 clears it. For 192.168.1.10/27 the mask is ${fmt(
				d27.mask
			)} and the result is ${fmt(
				d27.network
			)}. The broadcast address is the network with every host bit set to 1, here ${fmt(d27.broadcast ?? 0)}.`
		},
		{
			q: 'Why are two addresses in a subnet not usable?',
			a: 'The first address, with every host bit 0, is the network address, which names the subnet itself. The last, with every host bit 1, is the broadcast address, which reaches every host on it. Neither can belong to one host, so a subnet of n addresses has n − 2 usable ones.'
		},
		{
			q: 'Can you use a /31?',
			a: `Yes, on a point-to-point link. A /31 has ${
				p31.total
			} addresses, and taking away a network and a broadcast address would leave none, so RFC 3021 lets both be used as host addresses on a link between two routers, for example ${fmt(
				p31.network
			)} and ${fmt(p31.last)}. It saves half the addresses a /30 would use for the same link.`
		},
		{
			q: 'How can I tell if two addresses are on the same subnet?',
			a: `AND each with the mask and compare. With a /24, 192.168.1.10 gives ${fmt(
				(same1 & maskFromPrefix(24)) >>> 0
			)} and 192.168.1.200 gives ${fmt(
				(same2 & maskFromPrefix(24)) >>> 0
			)}, the same, so they are on one subnet; 192.168.2.10 gives ${fmt(
				(other & maskFromPrefix(24)) >>> 0
			)} and is not. The check below the calculator does exactly this.`
		},
		{
			q: 'What is a wildcard mask?',
			a: 'The netmask with every bit flipped: 0.0.0.255 for 255.255.255.0. Cisco access lists and OSPF network statements use it, where a 0 bit means "must match" and a 1 means "any value". It is also the number of addresses in the block minus one.'
		},
		{
			q: 'Are address classes still used?',
			a: 'Not for routing. Classes A, B and C fixed the network size by the first bits of the address, which wasted addresses, and classless routing (CIDR) replaced them in 1993. The terms survive in textbooks and in some defaults, which is why this calculator still shows the historic class.'
		}
	];

	const page = {
		title: 'Subnet Calculator: Network, Broadcast and Hosts, Bit by Bit',
		description:
			'IPv4 subnet calculator: network and broadcast address, host range, netmask and wildcard from any CIDR, with the AND that finds the network shown bit by bit.',
		url: `${SITE}/subnet-calculator`,
		image: `${SITE}/og/subnet-calculator.png`,
		imageAlt: 'LogicGates.org: subnet calculator showing the network address as a bitwise AND'
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
					{ '@type': 'ListItem', position: 3, name: 'Subnet calculator' }
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
		{ href: '/vlsm-calculator', label: 'VLSM calculator' },
		{ href: '/ipv6-expand-compress', label: 'IPv6 expand and compress' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Subnet calculator</h1>
		<p class="lede">
			Type an IPv4 address with its prefix or mask to get the network and broadcast address, the usable host range and
			every mask. The network address is the address AND the mask, and the calculator shows that AND bit by bit.
		</p>

		<div class="card tool">
			<label class="field" for="cidr">IP address and prefix or mask</label>
			<input
				id="cidr"
				class="value-input"
				type="text"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="cidr-help"
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<p class="field-help" id="cidr-help">Any of 192.168.1.10/24, 192.168.1.10 255.255.255.0 or 192.168.1.10 24.</p>

			<div class="prefix-row">
				<label class="field inline" for="prefix">Prefix</label>
				<input
					id="prefix"
					type="range"
					min="0"
					max="32"
					step="1"
					value={info.prefix}
					disabled={!!error}
					aria-valuetext="/{info.prefix}, mask {fmt(info.mask)}"
					on:input={(e) => setPrefix(Number(e.currentTarget.value))}
				/>
				<span class="prefix-value mono">/{info.prefix} <span class="dim">{fmt(info.mask)}</span></span>
			</div>

			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryValue(example)}>{example}</button>
				{/each}
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-label">Network</span>
					<span class="answer-value mono">{cidr(info)}</span>
					<span class="answer-also">
						{#if info.kind === 'host'}
							A single address, {fmt(info.address)}.
						{:else}
							{count(info.usable)} usable host{info.usable === 1 ? '' : 's'}, {fmt(info.firstHost)} to {fmt(
								info.lastHost
							)}{info.broadcast === null ? ', no broadcast address' : `, broadcast ${fmt(info.broadcast)}`}.
						{/if}
					</span>
				</div>

				<dl class="fields">
					{#each fields as f}
						<div class="field-row" class:wide={f.id === 'binary' || f.id === 'type'}>
							<dt>{f.label}</dt>
							<dd class="mono" data-field={f.id}>{f.value}</dd>
						</div>
					{/each}
				</dl>
				{#if notes.length}
					<ul class="notes">
						{#each notes as note}<li>{note}</li>{/each}
					</ul>
				{/if}
				<p class="copy-row">
					<button type="button" class="small-btn" on:click={copyResults}>Copy results</button>
					<span class="copy-status" aria-live="polite"
						>{copyState === 'copied'
							? 'Copied to the clipboard.'
							: copyState === 'failed'
							? 'Copying was blocked; select the values instead.'
							: ''}</span
					>
				</p>

				<h2 class="working-title">Working: the network address is an AND</h2>
				<p class="working-intro">
					Each bit of the mask is 1 over the network part and 0 over the host part. ANDing keeps the network bits of the
					address and clears the host bits, so what is left is the network address.
				</p>
				<SubnetBits
					caption="Address AND mask gives the network address"
					prefix={info.prefix}
					rows={[
						{ label: 'Address', value: info.address, text: fmt(info.address) },
						{ label: 'Mask', op: 'AND', value: info.mask, text: fmt(info.mask) },
						{ label: 'Network', op: '=', value: info.network, text: fmt(info.network), result: true }
					]}
				/>
				<p class="working-intro">
					Setting every host bit to 1 instead gives the last address of the block: the network OR the wildcard mask,
					which is the mask with each bit flipped.{info.broadcast === null
						? ` In a /${info.prefix} that last address is a host, not a broadcast address.`
						: ''}
				</p>
				<SubnetBits
					caption="Network OR wildcard gives the broadcast address"
					prefix={info.prefix}
					rows={[
						{ label: 'Network', value: info.network, text: fmt(info.network) },
						{ label: 'Wildcard', op: 'OR', value: info.wildcard, text: fmt(info.wildcard) },
						{
							label: info.broadcast === null ? 'Last address' : 'Broadcast',
							op: '=',
							value: info.last,
							text: fmt(info.last),
							result: true
						}
					]}
				/>
				<p class="legend">
					<span class="key net">Solid bracket</span>: network bits.
					<span class="key host">Dashed bracket, tinted</span>: host bits. Bold digits are 1s.
					<a
						href={toolLink('/binary-calculator', {
							a: toBits(info.address),
							b: toBits(info.mask),
							op: 'and',
							bits: 32
						})}>Check this AND in the binary calculator</a
					>.
				</p>

				<h2 class="working-title" id="check-title">Is another address in this subnet?</h2>
				<label class="field" for="test-address">Address to check</label>
				<input
					id="test-address"
					class="value-input small"
					type="text"
					bind:value={testInput}
					spellcheck="false"
					autocomplete="off"
					autocapitalize="off"
					aria-invalid={testError ? 'true' : 'false'}
				/>
				{#if testError}
					<p class="error" role="alert">{testError}</p>
				{:else if testAddress !== null}
					<p class="verdict" class:yes={testIn} class:no={!testIn} role="status">
						{#if testIn}
							<strong>Yes:</strong>
							{fmt(testAddress)} is in {cidr(info)}. ANDed with the mask it gives {fmt(testAnd)}, the same network
							address.
						{:else}
							<strong>No:</strong>
							{fmt(testAddress)} is not in {cidr(info)}. ANDed with the mask it gives {fmt(testAnd)}, which differs from {fmt(
								info.network
							)} in {diffBits} network bit{diffBits === 1 ? '' : 's'}, underlined.
						{/if}
					</p>
					<SubnetBits
						caption="The address to check, ANDed with the mask and compared with the network"
						prefix={info.prefix}
						compare={info.network}
						rows={[
							{ label: 'Check', value: testAddress, text: fmt(testAddress) },
							{ label: 'Mask', op: 'AND', value: info.mask, text: fmt(info.mask) },
							{ label: 'Result', op: '=', value: testAnd, text: fmt(testAnd), result: true },
							{ label: 'Network', op: testIn ? '==' : '≠', value: info.network, text: fmt(info.network) }
						]}
					/>
				{:else}
					<p class="field-help">Type any IPv4 address to see whether it falls inside {cidr(info)}.</p>
				{/if}
			</div>
			<p class="share-row"><ShareLink what="this subnet" /></p>
		</div>
	</section>

	<section id="how">
		<h2>How a subnet mask works</h2>
		<p>
			An IPv4 address is 32 bits, written as four 8-bit octets in decimal. A subnet splits those bits in two: the
			leading bits say which network the address is on, and the rest say which host on that network it is. The prefix
			length, the /24 in 192.168.1.10/24, is where the split falls. The mask writes the same split as an address: a 1
			for every network bit and a 0 for every host bit, so /24 is 255.255.255.0.
		</p>
		<ul class="points">
			<li>
				<strong>Network address.</strong> The address AND the mask: host bits all 0. It names the subnet and is the first
				address in it.
			</li>
			<li>
				<strong>Broadcast address.</strong> The network OR the wildcard mask: host bits all 1. A packet sent there reaches
				every host on the subnet. It is the last address.
			</li>
			<li>
				<strong>Usable hosts.</strong> Everything in between. A block of 2<sup>n</sup> addresses, where n is the number
				of host bits, has 2<sup>n</sup> − 2 usable ones.
			</li>
			<li>
				<strong>Same subnet or not.</strong> Two addresses are on the same subnet when both give the same result ANDed with
				the mask. A computer does this check for every packet it sends, to decide between delivering it directly and handing
				it to the router.
			</li>
		</ul>
		<p class="reducer">
			The AND, OR and NOT here are the same operations as the <a href="/logic-gates">logic gates</a>, applied to 32 bits
			at once. To see the bits of any number, use the <a href="/binary-converter">binary converter</a>.
		</p>
	</section>

	<section id="examples">
		<h2>Worked examples</h2>
		<p class="section-intro">
			Without converting everything to binary: find the octet where the mask stops being 255, and the block size is 256
			minus that mask octet. The network is the multiple of the block size at or below the address's octet.
		</p>
		<div class="worked-grid">
			{#each worked as w}
				{@const o = w.m.octet - 1}
				<div class="card worked">
					<h3>{w.text}</h3>
					<p class="small">
						Mask <span class="mono">{fmt(w.info.mask)}</span>. Octet {w.m.octet} of the mask is {w.m.maskOctet}, so the
						block size is 256 − {w.m.maskOctet} = <strong>{w.m.block}</strong>.
					</p>
					<p class="small">
						Octet {w.m.octet} of the address is {w.m.value}. The block that holds it runs from {w.m.networkOctet} to {w
							.m.lastOctet}.
					</p>
					<p class="mono small">
						Network&nbsp;&nbsp; {octetsOf(w.info.network)
							.map((x, i) => (i === o ? `[${x}]` : x))
							.join('.')}<br />
						Broadcast {octetsOf(w.info.last)
							.map((x, i) => (i === o ? `[${x}]` : x))
							.join('.')}<br />
						First&nbsp;&nbsp;&nbsp;&nbsp; {fmt(w.info.firstHost)}<br />
						Last&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {fmt(w.info.lastHost)}<br />
						Usable&nbsp;&nbsp;&nbsp; <strong>{count(w.info.usable)}</strong>
					</p>
					<p class="small">
						<a
							href="/subnet-calculator?ip={encodeURIComponent(w.text)}"
							on:click|preventDefault={() => tryValue(w.text)}>Try it</a
						>
					</p>
				</div>
			{/each}
		</div>
	</section>

	<section id="p31">
		<h2>/31 and /32: the two exceptions</h2>
		<p>
			A /30 has {blockSize(30)} addresses and {usableHosts(30)} usable ones, which is exactly enough for a link between two
			routers but spends half its addresses on a network and a broadcast address that a two-ended link never needs. RFC 3021
			lets a <strong>/31</strong> be used for such a link instead: its {blockSize(31)} addresses are both hosts, there is
			no broadcast address, and the link takes half the space. Most router software accepts /31 links; a host operating system
			may not, so they are for router-to-router links.
		</p>
		<p>
			A <strong>/32</strong> is one address on its own. It is used for a route to a single host, a router's loopback address,
			or an access list entry that matches one machine. It has no network or broadcast address, so its one address is the
			host.
		</p>
	</section>

	<section id="table">
		<h2>Subnet mask table: /0 to /32</h2>
		<p class="section-intro">
			Every prefix length with its netmask, wildcard mask and size. Each step down the table halves the block.
		</p>
		<div class="table-wrap scroll-box">
			<table class="data-table prefix-table">
				<thead>
					<tr>
						<th scope="col">Prefix</th>
						<th scope="col">Netmask</th>
						<th scope="col">Wildcard</th>
						<th scope="col" class="num">Addresses</th>
						<th scope="col" class="num">Usable hosts</th>
						<th scope="col">Compared with a /24</th>
					</tr>
				</thead>
				<tbody>
					{#each table as row}
						<tr class:current={row.prefix === info.prefix}>
							<th scope="row" class="mono">/{row.prefix}</th>
							<td class="mono">{row.mask}</td>
							<td class="mono">{row.wildcard}</td>
							<td class="mono num">{count(row.addresses)}</td>
							<td class="mono num">{count(row.usable)}</td>
							<td>{row.relative}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The row for the subnet in the calculator is marked. /31 and /32 count every address as usable, for the reasons
			above.
		</p>
	</section>

	<section id="special">
		<h2>Special-use IPv4 ranges</h2>
		<p class="section-intro">
			Some ranges are set aside and never appear as ordinary public addresses. The calculator names the range an address
			falls in.
		</p>
		<div class="table-wrap">
			<table class="data-table special-table">
				<thead>
					<tr>
						<th scope="col">Range</th>
						<th scope="col">Use</th>
						<th scope="col">Defined in</th>
						<th scope="col">Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each SPECIAL_RANGES as r}
						<tr>
							<td class="mono">{r.cidr}</td>
							<td>{r.name}</td>
							<td class="nowrap">{r.rfc}</td>
							<td>{r.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="classes">
		<h2>Address classes, for history</h2>
		<p class="section-intro">
			Before 1993 the first bits of an address fixed its network size. Classless routing (CIDR) replaced the scheme, so
			a class says nothing about a real network today, but the letters still turn up in courses and exams.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Class</th>
						<th scope="col">Leading bits</th>
						<th scope="col">Range</th>
						<th scope="col">Default mask</th>
						<th scope="col">Use</th>
					</tr>
				</thead>
				<tbody>
					{#each ADDRESS_CLASSES as c}
						<tr>
							<th scope="row">{c.letter}</th>
							<td class="mono">{c.leadingBits}</td>
							<td class="mono">{c.first} to {c.last}</td>
							<td class="mono">{c.defaultPrefix === null ? 'none' : `/${c.defaultPrefix}`}</td>
							<td>{c.use}</td>
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
				<strong>Giving a host the network or broadcast address.</strong> In 192.168.1.0/24, .0 and .255 are taken; the hosts
				are .1 to .254.
			</li>
			<li>
				<strong>Assuming a mask from the first octet.</strong> 10.1.2.3 is not automatically a /8. The prefix is whatever
				the network was configured with, which is why this calculator asks for it.
			</li>
			<li>
				<strong>Mixing up the netmask and the wildcard.</strong> 0.0.0.255 in an access list means the same block as 255.255.255.0
				on an interface. Typing one where the other belongs matches the wrong addresses.
			</li>
			<li>
				<strong>Counting hosts as 2<sup>n</sup>.</strong> A /26 has 64 addresses but 62 hosts. Need 64 hosts and you
				need a /25. The <a href="/vlsm-calculator">VLSM calculator</a> picks the right size for each subnet in a plan.
			</li>
			<li>
				<strong>Leading zeros.</strong> Some software reads 010 as octal 8, so 192.168.010.1 can mean 192.168.8.1. Write
				octets without leading zeros.
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

	.value-input.small {
		font-size: 1rem;
		max-width: 22rem;
		padding: 0.45rem 0.6rem;
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

	.prefix-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem 0.7rem;
		margin-bottom: 0.9rem;
	}

	.prefix-row input[type='range'] {
		flex: 1 1 12rem;
		max-width: 26rem;
		accent-color: #5db65d;
	}

	.prefix-row input[type='range']:focus-visible {
		outline: 2px solid #8ede8e;
		outline-offset: 2px;
	}

	.prefix-value {
		color: #fff;
		font-size: 0.95rem;
		min-width: 10.5rem;
	}

	.dim {
		color: #aaa;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 1rem;
	}

	.chip-btn,
	.small-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font: 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.small-btn {
		font-family: inherit;
		padding: 0.3rem 0.7rem;
	}

	.chip-btn:hover,
	.small-btn:hover {
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
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0 1.2rem;
		margin: 0.9rem 0 0;
	}

	.field-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.8rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.field-row.wide {
		grid-column: 1 / -1;
	}

	.field-row dt {
		color: #aaa;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.field-row dd {
		margin: 0;
		color: #fff;
		font-size: 0.92rem;
		text-align: right;
		overflow-wrap: anywhere;
	}

	.notes {
		color: #ddd;
		font-size: 0.88rem;
		margin: 0.8rem 0 0;
		padding-left: 1.2rem;
	}

	.notes li {
		margin-bottom: 0.35rem;
	}

	.copy-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 0.8rem 0 0;
	}

	.copy-status {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.5rem !important;
		margin-bottom: 0.5rem !important;
	}

	.working-intro {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0.6rem 0 0.5rem;
		max-width: 680px;
	}

	.legend {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
	}

	.key.net {
		color: #8ede8e;
		border-bottom: 2px solid #5db65d;
	}

	.key.host {
		color: #d8b45a;
		border-bottom: 2px dashed #d8b45a;
	}

	.verdict {
		font-size: 0.92rem;
		margin: 0.6rem 0 0.6rem;
		padding: 0.5rem 0.7rem;
		border-radius: 3px;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	.verdict.yes {
		border-color: rgba(93, 182, 93, 0.7);
	}

	.verdict.yes strong {
		color: #8ede8e;
	}

	.verdict.no {
		border-color: rgba(255, 102, 102, 0.7);
	}

	.verdict.no strong {
		color: #ff8a8a;
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
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.small {
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
		overflow-wrap: anywhere;
	}

	.worked strong {
		color: #8ede8e;
	}

	.scroll-box {
		max-height: 460px;
		overflow: auto;
	}

	.prefix-table td,
	.prefix-table th {
		white-space: nowrap;
	}

	.prefix-table tbody th {
		color: #fff;
	}

	.prefix-table tr.current th,
	.prefix-table tr.current td {
		color: #8ede8e;
		font-weight: 700;
	}

	.prefix-table tr.current th::before {
		content: '▸ ';
	}

	.num {
		text-align: right !important;
	}

	.nowrap {
		white-space: nowrap;
	}

	.special-table td:first-child {
		white-space: nowrap;
	}

	@media (min-width: 760px) {
		.special-table td:nth-child(2) {
			white-space: nowrap;
		}
	}

	@media (max-width: 560px) {
		.tool {
			padding: 1rem 0.8rem 1.1rem;
		}

		.fields {
			grid-template-columns: 1fr;
		}

		.field-row.wide {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.1rem;
		}

		.field-row.wide dd {
			text-align: left;
		}
	}
</style>
