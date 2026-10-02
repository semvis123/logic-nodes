<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseCidr,
		parseAddress,
		subnetInfo,
		formatAddress,
		parseRequirements,
		formatRequirements,
		checkRequirements,
		prefixForHosts,
		allocateVlsm,
		splitEqual,
		bitsForCount,
		spanInOrder,
		hostRangeTable,
		blockSize,
		maskFromPrefix,
		IpError,
		type Requirement,
		type SubnetInfo,
		type VlsmPlan
	} from '$lib/ipv4';
	import { readUrl, syncUrl, safeText, safeOption, safeInt, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	type Row = { name: string; hosts: string };
	const DEFAULT_REQS: Requirement[] = [
		{ name: 'Sales', hosts: 50 },
		{ name: 'HR', hosts: 20 },
		{ name: 'IT', hosts: 10 },
		{ name: 'Link A', hosts: 2 },
		{ name: 'Link B', hosts: 2 }
	];
	const DEFAULTS = {
		net: '192.168.10.0/24',
		req: formatRequirements(DEFAULT_REQS),
		p31: '0',
		mode: 'vlsm',
		by: 'count',
		n: '4',
		to: '26'
	};

	let base = DEFAULTS.net;
	let rows: Row[] = DEFAULT_REQS.map((r) => ({ name: r.name, hosts: String(r.hosts) }));
	let editAsText = false;
	let text = DEFAULTS.req;
	let allowP2P = false;
	let mode: 'vlsm' | 'split' = 'vlsm';
	let splitBy: 'count' | 'prefix' = 'count';
	let splitCount = DEFAULTS.n;
	let splitTo = Number(DEFAULTS.to);

	onMount(() => {
		const p = readUrl();
		base = safeText(p.net, 60) ?? base;
		const req = safeText(p.req, 4000);
		if (req !== undefined) {
			try {
				rows = parseRequirements(req).map((r) => ({ name: r.name, hosts: String(r.hosts) }));
				text = req;
			} catch {
				// Keep what was shared so the reader can see and fix it.
				text = req;
				editAsText = true;
			}
		}
		allowP2P = p.p31 === '1';
		mode = safeOption(p.mode, ['vlsm', 'split'] as const) ?? mode;
		splitBy = safeOption(p.by, ['count', 'prefix'] as const) ?? splitBy;
		splitCount = safeText(p.n, 12) ?? splitCount;
		splitTo = safeInt(p.to, 0, 32) ?? splitTo;
	});

	$: rowsText = rows.map((r) => `${r.name.replace(/\s*[;\r\n]+\s*/g, ' ').trim()} ${r.hosts.trim()}`).join('\n');
	$: syncUrl(
		{
			net: base,
			req: editAsText ? text : rowsText,
			p31: allowP2P ? '1' : '0',
			mode,
			by: splitBy,
			n: splitCount,
			to: splitTo
		},
		DEFAULTS
	);

	const message = (e: unknown, fallback: string) => (e instanceof IpError ? e.message : fallback);

	// The base network. Host bits are cleared rather than refused, with a note,
	// because typing a router's own address with its prefix is common.
	let net: SubnetInfo = subnetInfo(parseAddress('192.168.10.0'), 24);
	let baseError = '';
	let baseNote = '';
	$: {
		try {
			const c = parseCidr(base);
			net = subnetInfo(c.address, c.prefix);
			baseError = '';
			baseNote =
				c.address !== net.network
					? `${formatAddress(c.address)} has host bits set, so the plan uses its network, ${formatAddress(
							net.network
					  )}/${net.prefix}.`
					: '';
		} catch (e) {
			baseError = message(e, 'That is not a network such as 192.168.10.0/24');
		}
	}

	let list: Requirement[] = DEFAULT_REQS;
	let reqError = '';
	$: {
		try {
			if (editAsText) {
				list = parseRequirements(text);
			} else {
				const fromRows = rows.map((r, i) => ({
					name: r.name.trim() || `Subnet ${i + 1}`,
					hosts: r.hosts.trim() === '' ? 0 : Number(r.hosts)
				}));
				checkRequirements(fromRows);
				list = fromRows;
			}
			reqError = list.length ? '' : 'Add at least one subnet to plan.';
		} catch (e) {
			reqError = message(e, 'Those requirements could not be read');
		}
	}

	$: plan = allocateVlsm(net.network, net.prefix, list, allowP2P) as VlsmPlan;
	// The last plan that fitted stays on screen, dimmed, while the current one does not.
	let shown: Extract<VlsmPlan, { ok: true }> = allocateVlsm(parseAddress('192.168.10.0'), 24, DEFAULT_REQS) as Extract<
		VlsmPlan,
		{ ok: true }
	>;
	let shownNet: SubnetInfo = net;
	$: if (plan.ok && !vlsmError) {
		shown = plan;
		shownNet = net;
	}
	// What /31 links would change, for the note under the plan.
	$: linkCount = list.filter((r) => r.hosts <= 2).length;
	$: p31Plan = !allowP2P && linkCount ? allocateVlsm(net.network, net.prefix, list, true) : null;
	$: p31Saving = plan.ok && p31Plan?.ok ? plan.used - p31Plan.used : 0;
	$: vlsmError = baseError || reqError;
	$: shortError = !vlsmError && !plan.ok ? shortMessage(plan as Extract<VlsmPlan, { ok: false }>) : '';

	function shortMessage(p: Extract<VlsmPlan, { ok: false }>): string {
		const sizes = p.blocks.map((b) => b.prefix);
		const listText =
			sizes.length === 1
				? `a /${sizes[0]}`
				: `${sizes
						.slice(0, -1)
						.map((s) => `/${s}`)
						.join(', ')} and /${sizes[sizes.length - 1]}`;
		let out = `This plan needs ${count(p.needed)} addresses (${listText}), but ${cidr(net)} has ${count(
			p.total
		)}, so it is ${count(p.needed - p.total)} addresses short.`;
		if (p.fitsIn !== null) out += ` The smallest base network that holds it is a /${p.fitsIn}.`;
		if (p31Plan && p31Plan.ok) out += ' Using /31 for the two-host links would make it fit.';
		return out;
	}

	function switchToText() {
		text = rowsText;
		editAsText = true;
	}

	function switchToRows() {
		try {
			rows = parseRequirements(text).map((r) => ({ name: r.name, hosts: String(r.hosts) }));
			editAsText = false;
		} catch (e) {
			reqError = message(e, 'Those requirements could not be read');
		}
	}

	function addRow() {
		rows = [...rows, { name: '', hosts: '' }];
		const i = rows.length - 1;
		setTimeout(() => document.getElementById(`req-name-${i}`)?.focus());
	}

	function removeRow(i: number) {
		rows = rows.filter((_, k) => k !== i);
		setTimeout(() => {
			const next = document.getElementById(`req-name-${Math.min(i, rows.length - 1)}`);
			(next ?? document.getElementById('add-row'))?.focus();
		});
	}

	// Equal split.
	$: countValue = Number(splitCount);
	$: countError =
		splitBy === 'count' && (!Number.isInteger(countValue) || countValue < 1)
			? 'Type a whole number of subnets, 1 or more.'
			: '';
	$: newPrefix = splitBy === 'count' && !countError ? net.prefix + bitsForCount(countValue) : splitTo;
	let split: ReturnType<typeof splitEqual> | null = null;
	let splitError = '';
	$: {
		try {
			if (countError) throw new IpError(countError);
			if (newPrefix > 32) {
				throw new IpError(
					`A /${net.prefix} has ${count(net.total)} addresses, so it cannot be split into ${count(countValue)} subnets.`
				);
			}
			split = splitEqual(net.network, net.prefix, newPrefix, 256);
			splitError = '';
		} catch (e) {
			split = null;
			splitError = message(e, 'That split is not possible');
		}
	}
	$: prefixOptions = Array.from({ length: 33 - net.prefix }, (_, k) => net.prefix + k);

	// The address-space bar: allocations and free blocks in address order.
	type Segment = { label: string; name: string; info: SubnetInfo; free: boolean };
	$: segments = (
		[
			...shown.allocations.map((a, i) => ({ label: String(i + 1), name: a.name, info: a.info, free: false })),
			...shown.free.map((f) => ({ label: '', name: 'Free', info: f, free: true }))
		] as Segment[]
	).sort((a, b) => a.info.network - b.info.network);
	$: splitSegments =
		split && split.count <= 64
			? split.subnets.map((s, i) => ({ label: String(i + 1), name: `Subnet ${i + 1}`, info: s, free: false }))
			: [];

	const fmt = formatAddress;
	const count = (n: number) => n.toLocaleString('en-GB');
	const cidr = (s: { network: number; prefix: number }) => `${fmt(s.network)}/${s.prefix}`;
	const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

	function tryPlan(netText: string, reqs: string, p31 = false) {
		mode = 'vlsm';
		base = netText;
		rows = parseRequirements(reqs).map((r) => ({ name: r.name, hosts: String(r.hosts) }));
		text = reqs;
		editAsText = false;
		allowP2P = p31;
		document.getElementById('base')?.focus();
	}

	const examples = [
		{ label: 'Office /24', net: '192.168.10.0/24', req: formatRequirements(DEFAULT_REQS) },
		{
			label: 'Campus /22',
			net: '10.20.0.0/22',
			req: 'Staff 300\nStudents 200\nLabs 100\nPrinters 25\nServers 12\nWAN 2'
		},
		{
			label: 'Branches /16',
			net: '172.16.0.0/16',
			req: 'Head office 8000\nBranch 1 2000\nBranch 2 1000\nBranch 3 500'
		},
		{ label: 'Does not fit', net: '192.168.50.0/25', req: 'Floor 1 60\nFloor 2 60\nGuests 10' }
	];

	// The teaching section, computed from the default plan.
	const demo = allocateVlsm(parseAddress('192.168.10.0'), 24, DEFAULT_REQS) as Extract<VlsmPlan, { ok: true }>;
	const demo31 = allocateVlsm(parseAddress('192.168.10.0'), 24, DEFAULT_REQS, true) as Extract<VlsmPlan, { ok: true }>;
	const reversed = [...DEFAULT_REQS].reverse();
	const reversedSpan = spanInOrder(reversed);
	const ranges = hostRangeTable(16, 30);
	const for50 = prefixForHosts(50);
	const for62 = prefixForHosts(62);
	const for63 = prefixForHosts(63);

	const faqs = [
		{
			q: 'What is VLSM?',
			a: 'Variable length subnet masking: splitting one network into subnets of different sizes, each with its own prefix length, instead of cutting it into equal pieces. A department of 50 hosts gets a block for 50, and a link between two routers gets a block for 2, so far fewer addresses go unused.'
		},
		{
			q: 'Why allocate the largest subnet first?',
			a: `Every subnet must start at a multiple of its own size. Placing the biggest blocks first means each smaller block starts where the last one ended and is already aligned, so there are no gaps. The example plan on this page needs ${demo.used} addresses largest first; listed in reverse, smallest first, the same blocks would span ${reversedSpan}.`
		},
		{
			q: 'How big a subnet do 50 hosts need?',
			a: `A /${for50}: ${blockSize(for50)} addresses, of which ${
				blockSize(for50) - 2
			} are usable after the network and broadcast address. The rule is the smallest power of two at least two more than the host count. 62 hosts still fit a /${for62}, but 63 need a /${for63}.`
		},
		{
			q: 'Should a point-to-point link be a /30 or a /31?',
			a: `A /30 has 4 addresses and 2 usable, which works everywhere. A /31 has only 2 addresses, both usable on a router-to-router link under RFC 3021, and halves the space. In the example plan, /31 links would bring the total from ${demo.used} to ${demo31.used} addresses. Use /31 where both ends support it.`
		},
		{
			q: 'What is the difference between VLSM and FLSM?',
			a: 'Fixed length subnet masking (FLSM) gives every subnet the same prefix, so a network is cut into 2, 4, 8 or more equal blocks; the equal split mode does this. VLSM sizes each subnet to its own need. FLSM is simpler to manage, VLSM wastes fewer addresses.'
		},
		{
			q: 'What if my subnets do not fit?',
			a: 'The calculator adds up the block sizes, which is exact for blocks placed largest first, and says how many addresses are missing and the smallest base network that would hold them. Then either use a larger base network, shrink a requirement that sits just over a power of two, or use /31 for router links.'
		}
	];

	const page = {
		title: 'VLSM Calculator: Plan Subnets of Different Sizes',
		description:
			'VLSM calculator: enter a network and the hosts each subnet needs for an aligned plan with masks, host ranges and free space, or split it into equal subnets.',
		url: `${SITE}/vlsm-calculator`,
		image: `${SITE}/og/vlsm-calculator.png`,
		imageAlt: 'LogicGates.org: VLSM calculator with an address-space bar'
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
					{ '@type': 'ListItem', position: 3, name: 'VLSM calculator' }
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
		{ href: '/subnet-calculator', label: 'Subnet calculator' },
		{ href: '/ipv6-expand-compress', label: 'IPv6 expand and compress' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>VLSM calculator</h1>
		<p class="lede">
			Give a network and the number of hosts each subnet needs. The calculator sizes every subnet, packs them largest
			first so each block is aligned, and shows what is left. Or split a network into equal subnets.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Mode">
				<button
					type="button"
					class:active={mode === 'vlsm'}
					aria-pressed={mode === 'vlsm'}
					on:click={() => (mode = 'vlsm')}>Subnets by hosts (VLSM)</button
				>
				<button
					type="button"
					class:active={mode === 'split'}
					aria-pressed={mode === 'split'}
					on:click={() => (mode = 'split')}>Equal split</button
				>
			</div>

			<label class="field" for="base">Network to divide</label>
			<input
				id="base"
				class="value-input"
				type="text"
				bind:value={base}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={baseError ? 'true' : 'false'}
				aria-describedby="base-help"
			/>
			{#if baseError}
				<p class="error" role="alert">{baseError}</p>
			{/if}
			<p class="field-help" id="base-help">
				{#if baseNote}{baseNote}{:else}A network and prefix, such as 192.168.10.0/24 or 10.0.0.0 255.255.252.0.{/if}
				{#if !baseError}It has {count(net.total)} addresses.{/if}
			</p>

			{#if mode === 'vlsm'}
				<div class="req-head">
					<h2 class="sub-title" id="req-title">Subnets and the hosts each needs</h2>
					{#if editAsText}
						<button type="button" class="small-btn" on:click={switchToRows}>Edit as rows</button>
					{:else}
						<button type="button" class="small-btn" on:click={switchToText}>Edit as text</button>
					{/if}
				</div>
				{#if editAsText}
					<label class="field" for="req-text">One subnet per line: a name and a host count</label>
					<textarea
						id="req-text"
						class="req-text"
						rows="7"
						bind:value={text}
						spellcheck="false"
						aria-invalid={reqError ? 'true' : 'false'}
					/>
					<p class="field-help">Pasted lists work too: "Sales 50", "HR: 20" and "Link A, 2" are all read.</p>
				{:else}
					<div class="req-rows" role="group" aria-labelledby="req-title">
						{#each rows as row, i}
							<div class="req-row">
								<label class="visually-hidden" for="req-name-{i}">Name of subnet {i + 1}</label>
								<input
									id="req-name-{i}"
									class="row-input name"
									type="text"
									placeholder="Subnet {i + 1}"
									bind:value={row.name}
									autocomplete="off"
								/>
								<label class="visually-hidden" for="req-hosts-{i}">Hosts needed in subnet {i + 1}</label>
								<input
									id="req-hosts-{i}"
									class="row-input hosts"
									type="text"
									inputmode="numeric"
									placeholder="hosts"
									bind:value={row.hosts}
									autocomplete="off"
								/>
								<span class="row-unit" aria-hidden="true">hosts</span>
								<button
									type="button"
									class="remove"
									aria-label="Remove {row.name || `subnet ${i + 1}`}"
									on:click={() => removeRow(i)}>Remove</button
								>
							</div>
						{/each}
					</div>
					<button type="button" class="small-btn add" id="add-row" on:click={addRow}>Add a subnet</button>
				{/if}
				{#if reqError}
					<p class="error" role="alert">{reqError}</p>
				{/if}

				<label class="check">
					<input type="checkbox" bind:checked={allowP2P} />
					Use /31 for subnets of 1 or 2 hosts (point-to-point links, RFC 3021)
				</label>

				<div class="chips">
					{#each examples as ex}
						<button type="button" class="chip-btn" on:click={() => tryPlan(ex.net, ex.req)}>{ex.label}</button>
					{/each}
				</div>

				{#if shortError}
					<p class="error short" role="alert">{shortError}</p>
				{/if}

				<div
					class="results"
					class:stale={!!vlsmError || !plan.ok}
					aria-hidden={vlsmError || !plan.ok ? 'true' : 'false'}
				>
					{#if shown}
						<div class="answer" role={vlsmError || shortError ? undefined : 'status'}>
							<span class="answer-label"
								>{plan.ok && !vlsmError ? 'Plan for' : 'Last plan that fitted,'} {cidr(shownNet)}</span
							>
							<span class="answer-value"
								>{shown.allocations.length} subnet{shown.allocations.length === 1 ? '' : 's'}, {count(shown.used)} of {count(
									shown.total
								)} addresses used</span
							>
							<span class="answer-also"
								>{count(shown.total - shown.used)} addresses left free{shown.free.length
									? `, starting at ${fmt(shown.free[0].network)}`
									: ''}.{p31Saving
									? ` /31 links for the ${linkCount} two-host subnet${
											linkCount === 1 ? '' : 's'
									  } would save ${p31Saving} more.`
									: ''}</span
							>
						</div>

						<div class="bar-wrap" aria-hidden="true">
							<div class="bar">
								{#each segments as s}
									<span
										class="seg"
										class:free={s.free}
										style="width: {pct(s.info.total, shown.total)}"
										title="{s.name}: {cidr(s.info)}"
										>{s.info.total / shown.total >= 0.035 ? s.label || 'free' : ''}</span
									>
								{/each}
							</div>
							<div class="bar-scale mono">
								<span>{fmt(shownNet.network)}</span><span>{fmt(shownNet.last)}</span>
							</div>
						</div>

						<div class="table-wrap scroll-box">
							<table class="data-table plan">
								<caption class="visually-hidden">The subnets, largest first, then the free space</caption>
								<thead>
									<tr>
										<th scope="col">#</th>
										<th scope="col">Name</th>
										<th scope="col" class="num">Needs</th>
										<th scope="col" class="num">Usable</th>
										<th scope="col">Network and mask</th>
										<th scope="col">First host</th>
										<th scope="col">Last host</th>
										<th scope="col">Broadcast</th>
										<th scope="col" class="num">Unused</th>
									</tr>
								</thead>
								<tbody>
									{#each shown.allocations as a, i}
										<tr>
											<td class="mono">{i + 1}</td>
											<th scope="row" class="name-cell">{a.name}</th>
											<td class="mono num">{count(a.hosts)}</td>
											<td class="mono num">{count(a.info.usable)}</td>
											<td class="mono"
												><span class="strong">{cidr(a.info)}</span><span class="mask">{fmt(a.info.mask)}</span></td
											>
											<td class="mono">{fmt(a.info.firstHost)}</td>
											<td class="mono">{fmt(a.info.lastHost)}</td>
											<td class="mono">{a.info.broadcast === null ? 'none (/31)' : fmt(a.info.broadcast)}</td>
											<td class="mono num">{count(a.spare)}</td>
										</tr>
									{/each}
									{#each shown.free as f}
										<tr class="free-row">
											<td />
											<th scope="row" class="name-cell">Free ({count(f.total)})</th>
											<td />
											<td />
											<td class="mono">{cidr(f)}<span class="mask">{fmt(f.mask)}</span></td>
											<td class="mono" colspan="3">{fmt(f.network)} to {fmt(f.last)}</td>
											<td />
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="reducer">
							Unused counts usable addresses a subnet has beyond what it asked for. Any row can be opened in the
							<a
								href={toolLink('/subnet-calculator', {
									ip: shown.allocations[0] ? cidr(shown.allocations[0].info) : ''
								})}>subnet calculator</a
							> to see its bits.
						</p>
					{/if}
				</div>
			{:else}
				<div class="split-controls">
					<div class="split-field">
						<label class="field" for="split-count">Number of subnets</label>
						<input
							id="split-count"
							class="row-input"
							type="text"
							inputmode="numeric"
							bind:value={splitCount}
							on:input={() => (splitBy = 'count')}
							aria-invalid={splitBy === 'count' && splitError ? 'true' : 'false'}
						/>
					</div>
					<span class="or">or</span>
					<div class="split-field">
						<label class="field" for="split-prefix">New prefix</label>
						<select
							id="split-prefix"
							value={newPrefix}
							on:change={(e) => {
								splitTo = Number(e.currentTarget.value);
								splitBy = 'prefix';
							}}
						>
							{#each prefixOptions as p}
								<option value={p}>/{p} ({count(blockSize(p))} addresses)</option>
							{/each}
						</select>
					</div>
				</div>
				{#if splitError && !baseError}
					<p class="error" role="alert">{splitError}</p>
				{/if}
				<div class="results" class:stale={!!baseError || !split} aria-hidden={baseError || !split ? 'true' : 'false'}>
					{#if split}
						<div class="answer" role="status">
							<span class="answer-label">{cidr(net)} split</span>
							<span class="answer-value">{count(split.count)} × /{newPrefix}</span>
							<span class="answer-also"
								>{split.borrowed} bit{split.borrowed === 1 ? '' : 's'} borrowed from the host part. Each subnet has {count(
									split.size
								)} addresses, {count(split.subnets[0].usable)} usable.{splitBy === 'count' && countValue !== split.count
									? ` ${count(countValue)} is not a power of two, so it rounds up to ${count(split.count)}; the spare ${
											split.count - countValue === 1 ? 'one is' : `${count(split.count - countValue)} are`
									  } free for later.`
									: ''}</span
							>
						</div>
						{#if splitSegments.length}
							<div class="bar-wrap" aria-hidden="true">
								<div class="bar">
									{#each splitSegments as s}
										<span class="seg" style="width: {pct(1, split.count)}" title="{s.name}: {cidr(s.info)}"
											>{split.count <= 32 ? s.label : ''}</span
										>
									{/each}
								</div>
								<div class="bar-scale mono">
									<span>{fmt(net.network)}</span><span>{fmt(net.last)}</span>
								</div>
							</div>
						{/if}
						<div class="table-wrap scroll-box">
							<table class="data-table split">
								<thead>
									<tr>
										<th scope="col">#</th>
										<th scope="col">Network</th>
										<th scope="col">First host</th>
										<th scope="col">Last host</th>
										<th scope="col">Broadcast</th>
									</tr>
								</thead>
								<tbody>
									{#each split.subnets as s, i}
										<tr>
											<td class="mono">{i + 1}</td>
											<td class="mono strong">{cidr(s)}</td>
											<td class="mono">{fmt(s.firstHost)}</td>
											<td class="mono">{fmt(s.lastHost)}</td>
											<td class="mono">{s.broadcast === null ? 'none' : fmt(s.broadcast)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						{#if split.count > split.subnets.length}
							<p class="reducer">
								The first {split.subnets.length} of {count(split.count)} are listed. The rest follow the same pattern, each
								{count(split.size)} addresses after the last.
							</p>
						{/if}
					{/if}
				</div>
			{/if}
			<p class="share-row"><ShareLink what="this plan" /></p>
		</div>
	</section>

	<section id="how">
		<h2>How VLSM works</h2>
		<p class="section-intro">
			The calculator's opening example, step by step: 192.168.10.0/24 shared between three departments and two router
			links.
		</p>
		<ol class="points">
			<li>
				<strong>Size each subnet.</strong> A subnet needs its hosts plus two addresses, for the network and broadcast
				address, rounded up to a power of two. 50 hosts need 52 addresses, so a block of {blockSize(for50)}, a /{for50}.
			</li>
			<li>
				<strong>Sort largest first.</strong> Every block has to start at a multiple of its own size: a /26 at .0, .64, .128
				or .192, a /30 at any multiple of 4.
			</li>
			<li>
				<strong>Place them one after another.</strong> Because each block is no bigger than the one before, it always starts
				on its own boundary, and nothing is wasted between blocks.
			</li>
		</ol>
		<div class="table-wrap">
			<table class="data-table demo">
				<thead>
					<tr>
						<th scope="col">Subnet</th>
						<th scope="col" class="num">Hosts</th>
						<th scope="col" class="num">Hosts + 2</th>
						<th scope="col" class="num">Block</th>
						<th scope="col">Placed at</th>
						<th scope="col">Next free</th>
					</tr>
				</thead>
				<tbody>
					{#each demo.allocations as a}
						<tr>
							<th scope="row">{a.name}</th>
							<td class="mono num">{a.hosts}</td>
							<td class="mono num">{a.hosts + 2}</td>
							<td class="mono num">{a.info.total} (/{a.info.prefix})</td>
							<td class="mono">{cidr(a.info)}</td>
							<td class="mono">{fmt(a.info.last + 1)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			The five subnets use {demo.used} of 256 addresses, leaving {demo.free.map((f) => cidr(f)).join(' and ')} free for later.
			Placed in the reverse order, smallest first, the same blocks would span {reversedSpan} addresses, because each larger
			block has to skip ahead to its next boundary. With /31 links the plan needs {demo31.used}.
		</p>
		<p class="reducer">
			Each subnet's network address is its first address AND its mask; the <a href="/subnet-calculator"
				>subnet calculator</a
			> draws that AND bit by bit.
		</p>
	</section>

	<section id="sizes">
		<h2>Which prefix for how many hosts</h2>
		<p class="section-intro">
			The smallest block for a host count: two addresses go to the network and broadcast, so each prefix covers up to
			its size minus two.
		</p>
		<div class="table-wrap">
			<table class="data-table sizes">
				<thead>
					<tr>
						<th scope="col">Hosts needed</th>
						<th scope="col">Prefix</th>
						<th scope="col">Mask</th>
						<th scope="col" class="num">Addresses</th>
					</tr>
				</thead>
				<tbody>
					{#each ranges as r}
						<tr>
							<td class="mono">{count(r.minHosts)} to {count(r.maxHosts)}</td>
							<th scope="row" class="mono">/{r.prefix}</th>
							<td class="mono">{fmt(maskFromPrefix(r.prefix))}</td>
							<td class="mono num">{count(r.addresses)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			A requirement just over a boundary doubles its block: 62 hosts fit a /{for62}, 63 need a /{for63}. Leave room for
			growth when you size, since renumbering a subnet later is far more work than a bigger block now.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Forgetting the two reserved addresses.</strong> A block of 32 holds 30 hosts, not 32. Count the router's
				own interface as a host too.
			</li>
			<li>
				<strong>Starting a block off its boundary.</strong> 192.168.10.16/26 is not a network: a /26 must start at a multiple
				of 64. The calculator always places blocks on their boundary.
			</li>
			<li>
				<strong>Allocating in the order listed.</strong> Small blocks first leave gaps the large ones cannot use. Sort largest
				first.
			</li>
			<li>
				<strong>Overlapping subnets.</strong> Two subnets that share addresses make routing ambiguous. Every plan here is
				checked to tile the base network exactly, with no overlap.
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

	.value-input,
	.req-text {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.req-text {
		font-size: 0.95rem;
		resize: vertical;
	}

	.value-input:focus,
	.req-text:focus,
	.row-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.value-input[aria-invalid='true'],
	.req-text[aria-invalid='true'],
	.row-input[aria-invalid='true'] {
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

	.error.short {
		margin: 0 0 0.8rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid rgba(255, 102, 102, 0.6);
		border-radius: 3px;
		background: #0d0d0f;
	}

	.req-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0 0.5rem;
	}

	.sub-title {
		color: #fff;
		font-size: 1rem !important;
		margin: 0 !important;
	}

	.req-rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.req-row {
		max-width: 40rem;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.row-input,
	select {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 0.95rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.4rem 0.55rem;
		box-sizing: border-box;
	}

	.row-input.name {
		flex: 1 1 auto;
		min-width: 0;
		max-width: 20rem;
	}

	.row-input.hosts {
		width: 6.5rem;
		text-align: right;
	}

	.row-unit {
		color: #999;
		font-size: 0.8rem;
	}

	.remove,
	.small-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
	}

	.remove:hover,
	.small-btn:hover,
	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.remove {
		margin-left: auto;
	}

	.add {
		margin-top: 0.6rem;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		color: #ddd;
		font-size: 0.88rem;
		margin: 0.9rem 0;
	}

	.check input {
		accent-color: #5db65d;
		margin-top: 0.2rem;
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
		font-size: 1.3rem;
		font-weight: 600;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
	}

	.bar-wrap {
		margin: 1rem 0 0.9rem;
	}

	.bar {
		display: flex;
		height: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		overflow: hidden;
		background: #0d0d0f;
	}

	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: 2px;
		border-right: 1px solid #0d0d0f;
		background-color: #2f6b2f;
		color: #fff;
		font: 600 0.75rem ui-monospace, SFMono-Regular, Menlo, monospace;
		overflow: hidden;
		white-space: nowrap;
	}

	.seg:nth-child(even) {
		background-color: #3d7f3d;
	}

	.seg.free {
		background: repeating-linear-gradient(135deg, #1b1b1e 0 6px, #26262a 6px 12px);
		color: #bbb;
		font-weight: 400;
	}

	.seg:last-child {
		border-right: none;
	}

	.bar-scale {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		margin-top: 0.25rem;
	}

	.bar-scale span {
		color: #aaa;
	}

	.scroll-box {
		max-height: 460px;
		overflow: auto;
	}

	.data-table.plan td,
	.data-table.plan th {
		padding: 0.35rem 0.55rem;
		font-size: 0.88rem;
	}

	.plan td,
	.plan th,
	.split td,
	.split th {
		white-space: nowrap;
	}

	.name-cell {
		color: #fff !important;
	}

	.free-row td,
	.free-row th {
		color: #aaa !important;
	}

	.num {
		text-align: right !important;
	}

	.data-table td.strong,
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.mask {
		display: block;
		color: #999;
		font-size: 0.78rem;
	}

	.split-controls {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 0.6rem 1rem;
		margin: 0.6rem 0 1rem;
	}

	.split-field .row-input {
		width: 8rem;
	}

	.or {
		color: #999;
		padding-bottom: 0.5rem;
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

	.demo th[scope='row'] {
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

	@media (max-width: 560px) {
		.tool {
			padding: 1rem 0.8rem 1.1rem;
		}

		.row-unit {
			display: none;
		}

		.row-input.hosts {
			width: 4.8rem;
		}
	}
</style>
