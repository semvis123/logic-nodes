<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { flipFlops } from '$lib/flipflops';
	import { parseExpression, evaluate } from '$lib/boolean';
	import { clockSignal, pattern, simulateClocked, timingToSvg, timingAlt } from '$lib/timing';
	import type { PageData } from './$types';

	export let data: PageData;

	$: ff = data.flipFlop;
	$: others = flipFlops.filter((f) => f.slug !== ff.slug);
	$: url = `${SITE}/flip-flops/${ff.slug}`;
	$: ogImage = `${SITE}/og/flip-flops-${ff.slug}.png`;

	// The waveform walks the characteristic table: every legal input combination
	// in turn, held for two cycles so the delayed response is visible. Invalid
	// combinations are left out rather than drawn as if they worked.
	$: combinations = [
		...new Map(
			ff.characteristic.filter((row) => row.next !== 'invalid').map((row) => [row.inputs.join(''), row.inputs])
		).values()
	];
	$: timingInputs = ff.inputs.map((name, i) =>
		pattern(name.toUpperCase(), combinations.map((bits) => String(bits[i]).repeat(2)).join(''))
	);
	$: timingSignals = [
		clockSignal(timingInputs[0]?.bits.length ?? 0),
		...timingInputs,
		simulateClocked(ff.equation, timingInputs, { initial: 0 })
	];
	$: timingSvg = timingToSvg(timingSignals, { caption: ff.equationText, showEdges: true });
	// A dark waveform is a waste of ink, so paper gets a black and white copy.
	$: timingPrintSvg = timingToSvg(timingSignals, {
		caption: ff.equationText,
		showEdges: true,
		palette: 'mono'
	});
	$: timingDescription = timingAlt(timingSignals);
	$: equation = parseExpression(ff.equation);

	// Live demo: hold the inputs, press the clock, watch the state move.
	let q = false;
	let pins: Record<string, boolean> = {};
	let history: { inputs: boolean[]; from: boolean; to: boolean }[] = [];
	$: if (ff) resetDemo(ff.slug);

	let lastSlug = '';
	function resetDemo(slug: string) {
		if (slug === lastSlug) return;
		lastSlug = slug;
		q = false;
		pins = Object.fromEntries(ff.inputs.map((name) => [name, false]));
		history = [];
	}

	$: invalid = ff.slug === 'sr' && pins.s && pins.r;
	$: nextState = invalid ? null : evaluate(equation, { ...pins, q });

	function tick() {
		if (invalid) return;
		const from = q;
		const to = evaluate(equation, { ...pins, q });
		history = [...history.slice(-7), { inputs: ff.inputs.map((n) => pins[n]), from, to }];
		q = to;
	}

	$: title = `${ff.shortName} Flip-Flop: Truth Table, Equation and Uses`;
	$: description =
		`How the ${ff.shortName} flip-flop works, with its characteristic and excitation tables, ` +
		`next state equation and a live demo you can clock. Free reference.`;

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
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(url),
				mainEntity: ff.faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Flip-flops', item: `${SITE}/flip-flops` },
					{ '@type': 'ListItem', position: 3, name: `${ff.shortName} flip-flop` }
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
	<meta property="og:site_name" content="Logic Nodes" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:alt" content={`Logic Nodes: ${ff.name}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/flip-flops', label: 'All four flip-flops' },
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/flip-flops">Flip-flops</a> <span aria-hidden="true">/</span>
			<span>{ff.shortName}</span>
		</nav>
		<h1>{ff.name}</h1>
		<p class="lede">{ff.tagline}</p>

		<div class="card demo">
			<p class="demo-title">
				Live demo. Set the inputs, then clock it.
				<span class="eq mono">{ff.equationText}</span>
			</p>
			<div class="controls">
				{#each ff.inputs as name}
					<button
						type="button"
						class="pin"
						class:on={pins[name]}
						aria-pressed={pins[name]}
						on:click={() => (pins = { ...pins, [name]: !pins[name] })}
					>
						{name.toUpperCase()}
						<span class="val">{pins[name] ? 1 : 0}</span>
					</button>
				{/each}
				<button type="button" class="clock" on:click={tick} disabled={invalid}>Clock ▸</button>
				<span class="state" class:on={q}>Q <span class="val">{q ? 1 : 0}</span></span>
				<span class="next">
					{#if invalid}
						<span class="warn">S = R = 1 is not allowed</span>
					{:else}
						next <span class="mono">{nextState ? 1 : 0}</span>
					{/if}
				</span>
			</div>
			{#if history.length}
				<ol class="history">
					{#each history as step}
						<li>
							<span class="mono">
								{ff.inputs.map((n, i) => `${n.toUpperCase()}=${step.inputs[i] ? 1 : 0}`).join(' ')}
							</span>
							<span class="arrow">Q {step.from ? 1 : 0} → {step.to ? 1 : 0}</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="demo-hint">Nothing clocked yet. The state only moves on an edge.</p>
			{/if}
		</div>
	</section>

	<section>
		<h2>How it behaves</h2>
		<p>{ff.behaviour}</p>
		<p>{ff.intuition}</p>
	</section>

	<section>
		<h2>Characteristic table</h2>
		<p class="section-intro">
			What the next state is, for every combination of inputs and present state. The equation below is this table
			written as algebra.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						{#each ff.inputs as name}
							<th scope="col" class="mono">{name.toUpperCase()}</th>
						{/each}
						<th scope="col" class="mono">Q</th>
						<th scope="col" class="mono next-col">Q⁺</th>
						<th scope="col">Effect</th>
					</tr>
				</thead>
				<tbody>
					{#each ff.characteristic as row}
						<tr class:invalid={row.next === 'invalid'}>
							{#each row.inputs as bit}
								<td class={bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
							{/each}
							<td class={row.q === '1' ? 'bit-1' : 'bit-0'}>{row.q}</td>
							<td class="next-col {row.next === 'invalid' ? 'bit-x' : row.next === '1' ? 'bit-1' : 'bit-0'}">
								{row.next === 'invalid' ? '—' : row.next}
							</td>
							<td class="effect">{row.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="equation mono">{ff.equationText}</p>
		{#if ff.slug === 'sr'}
			<p class="reducer">
				That equation holds subject to S ∧ R = 0. It is written for the six rows that are allowed; at S = R = 1 the
				algebra says 1 while the real latch drives both outputs low, which is exactly why that input is ruled out rather
				than described.
			</p>
		{/if}
	</section>

	<section id="timing">
		<h2>Timing</h2>
		<p class="section-intro">
			The same behaviour in time rather than in a table. Each dashed line is a rising clock edge, and Q only ever
			changes on one: that is what makes it a flip-flop rather than a latch. The inputs walk through every legal
			combination in turn, held for two cycles so you can see the response arrive a cycle late.
		</p>
		<figure class="timing">
			<div
				class="timing-scroll screen-only"
				role="img"
				aria-label={`Timing diagram for the ${ff.shortName} flip-flop. ${timingDescription}`}
			>
				{@html timingSvg}
			</div>
			<div class="timing-scroll print-only" aria-hidden="true">{@html timingPrintSvg}</div>
			<figcaption>
				Q is computed from <span class="mono">{ff.equationText}</span>, the same equation as the table above, so the
				waveform and the table cannot disagree.
			</figcaption>
		</figure>
	</section>

	<section>
		<h2>Excitation table</h2>
		<p class="section-intro">
			The same information turned around. You know the transition you want; this says what to put on the inputs to get
			it. This is the table you use when designing a counter or a state machine, and the X's are what make the driving
			logic small.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col" class="mono">Q</th>
						<th scope="col" class="mono">Q⁺</th>
						{#each ff.inputs as name}
							<th scope="col" class="mono">{name.toUpperCase()}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each ff.excitation as row}
						<tr>
							<td class={row.from === '1' ? 'bit-1' : 'bit-0'}>{row.from}</td>
							<td class={row.to === '1' ? 'bit-1' : 'bit-0'}>{row.to}</td>
							{#each row.inputs as bit}
								<td class={bit === 'X' ? 'bit-x' : bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			An X means the input does not matter for that transition, which is a
			<a href="/karnaugh-map-solver#dont-cares">don't care</a> when you minimise the logic that drives it.
		</p>
	</section>

	<section>
		<h2>Building one</h2>
		<p class="section-intro">{ff.buildFrom}</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			The editor has a Delay node, which is what you need to make feedback settle predictably rather than oscillating.
		</p>
	</section>

	<section>
		<h2>Where it is used</h2>
		<ul class="uses">
			{#each ff.uses as use}
				<li>{use}</li>
			{/each}
		</ul>
	</section>

	<section class="faq">
		<h2>Questions about the {ff.shortName} flip-flop</h2>
		{#each ff.faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>

	<section>
		<h2>The others</h2>
		<div class="others">
			{#each others as other}
				<a class="other" href="/flip-flops/{other.slug}">
					<span class="other-name mono">{other.shortName}</span>
					<span class="other-tag">{other.tagline}</span>
				</a>
			{/each}
		</div>
	</section>
</ContentPage>

<style>
	.timing {
		margin: 0;
	}

	.print-only {
		display: none;
	}

	.timing-scroll {
		overflow-x: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		background: #1d1e20;
	}

	.timing-scroll :global(svg) {
		display: block;
		min-width: 100%;
	}

	.timing figcaption {
		color: #999;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}

	.intro {
		padding-top: 48px;
	}

	.crumbs {
		font-size: 0.8rem;
		color: #888;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #888;
	}

	.demo {
		padding: 1rem 1.1rem 1.1rem;
		margin-top: 1.5rem;
	}

	.demo-title {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 0 0 0.9rem;
		color: #ddd;
		font-size: 0.9rem;
	}

	.eq {
		color: #8ede8e;
		font-size: 0.85rem;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.pin,
	.state {
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.55);
		border-radius: 3px;
		color: #fff;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		transition: background-color 0.15s ease;
	}

	.pin {
		cursor: pointer;
	}

	.pin.on,
	.state.on {
		background-color: #372;
	}

	.state {
		font-weight: 600;
	}

	@media (prefers-reduced-motion: reduce) {
		.pin,
		.state {
			transition: none;
		}
	}

	.val {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		margin-left: 0.35rem;
	}

	.clock {
		background-color: #0d0d0f;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #8ede8e;
		font-size: 0.85rem;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}

	.clock:hover:not(:disabled) {
		background-color: #16241a;
	}

	.clock:disabled {
		opacity: 0.4;
		cursor: default;
		border-color: rgba(255, 255, 255, 0.3);
		color: #888;
	}

	.next {
		color: #888;
		font-size: 0.8rem;
	}

	.warn {
		color: #e0a44d;
	}

	.history {
		list-style: none;
		padding: 0;
		margin: 0.9rem 0 0;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		padding-top: 0.6rem;
		font-size: 0.82rem;
	}

	.history li {
		display: flex;
		gap: 1rem;
		color: #bbb;
		padding: 0.1rem 0;
	}

	.arrow {
		color: #8ede8e;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.demo-hint {
		color: #888;
		font-size: 0.8rem;
		margin: 0.9rem 0 0;
	}

	.next-col {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.effect {
		color: #888;
		font-size: 0.85rem;
	}

	tr.invalid td {
		opacity: 0.55;
	}

	.equation {
		color: #8ede8e;
		font-size: 1.05rem;
		margin-top: 0.9rem;
	}

	.uses {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.uses li {
		margin-bottom: 0.6rem;
	}

	.others {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 10px;
	}

	.other {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.7rem 0.9rem;
		text-decoration: none;
	}

	.other:hover {
		border-color: rgba(255, 255, 255, 0.7);
	}

	.other-name {
		display: block;
		color: #fff;
		font-weight: 600;
	}

	.other-tag {
		display: block;
		color: #999;
		font-size: 0.82rem;
		margin-top: 0.15rem;
	}
</style>
