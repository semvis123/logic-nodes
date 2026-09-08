<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { countSequence, counterWaveforms, counterKinds, bitsOf } from '$lib/sequential';
	import { clockSignal, timingToSvg, timingAlt } from '$lib/timing';
	import { flipFlops } from '$lib/flipflops';
	import { timingCard } from '$lib/timingCards';

	// Everything below is generated, so the tables, the waveforms and the prose
	// counts cannot drift apart.
	const WIDTH = 3;
	const CYCLES = 10;
	const traces = counterWaveforms(WIDTH, CYCLES);
	const signals = [clockSignal(CYCLES), ...traces];
	const counterSvg = timingToSvg(signals, { caption: 'A 3 bit binary up counter', showEdges: true });
	const counterPrintSvg = timingToSvg(signals, {
		caption: 'A 3 bit binary up counter',
		showEdges: true,
		palette: 'mono'
	});
	const counterAlt = timingAlt(signals);

	// The decade counter, shown as the sequence it actually produces.
	const decade = countSequence(4, 12, 10);
	const decadeTraces = counterWaveforms(4, 12, 10);
	const decadeSignals = [clockSignal(12), ...decadeTraces];
	const decadeSvg = timingToSvg(decadeSignals, { caption: 'A decade counter clears after 9', showEdges: true });
	const decadePrintSvg = timingToSvg(decadeSignals, {
		caption: 'A decade counter clears after 9',
		showEdges: true,
		palette: 'mono'
	});

	// The count table: state, its bits, and which bit toggles on the next edge.
	const rows = countSequence(WIDTH, 1 << WIDTH).map((value) => {
		const bits = bitsOf(value, WIDTH);
		// A bit toggles when every bit below it is high, which is the whole rule.
		const toggling = Array.from({ length: WIDTH }, (_, position) => bits.slice(0, position).every((bit) => bit === 1));
		return { value, bits, toggling };
	});

	const tFlipFlop = flipFlops.find((ff) => ff.slug === 't');
	const cards = ['binary-counter-timing-diagram.png', 'decade-counter-timing-diagram.png'].map(timingCard);

	const faqs = [
		{
			q: 'What is a counter in digital logic?',
			a: 'A chain of flip-flops whose outputs, read as a binary number, go up by one on every clock edge. Nothing counts the pulses in any deeper sense: each stage simply toggles when all the stages below it are high, and that rule is exactly what binary counting is.'
		},
		{
			q: 'What is the difference between a ripple counter and a synchronous counter?',
			a: 'In a ripple counter each flip-flop is clocked by the one before it, so the change ripples along the chain and the outputs are briefly wrong after every count. In a synchronous counter every flip-flop shares the clock and extra AND gates decide which ones toggle, so all the bits change together. Ripple is cheaper; synchronous is correct at speed.'
		},
		{
			q: 'How do I build a counter that stops at a number that is not a power of two?',
			a: 'Detect the state just past the last one you want and use it to clear the counter. A decade counter is a four bit counter with an AND gate watching for 10 and wired to the clear input, so the count runs 0 to 9 and starts again. The same trick gives any modulus.'
		},
		{
			q: 'How many flip-flops does an n bit counter need?',
			a: 'One per bit, so a counter that reaches 2^n needs n of them: three flip-flops count to 8, four count to 16, eight count to 256. To count up to a number m that is not a power of two you need enough bits to hold m, so ceil(log2(m)) flip-flops plus the gate that clears it.'
		},
		{
			q: 'Why does the top bit of a counter run at half the speed of the one below it?',
			a: 'Because each bit toggles once for every two toggles of the bit below. That halving is why a counter is also a frequency divider: the most significant bit of an n bit counter is the clock divided by 2^n, which is how a 32768 Hz crystal becomes a one second tick in a watch.'
		}
	];

	const page = {
		title: 'Counters in Digital Logic: Ripple, Synchronous and Decade',
		description:
			'How binary counters work, from toggling flip-flops to ripple, synchronous, decade and up/down designs, with count tables and timing diagrams.',
		url: `${SITE}/counters`,
		image: `${SITE}/og/counters.png`,
		imageAlt: 'Logic Nodes: counters'
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
				about: { '@id': `${SITE}/#app` },
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
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Counters' }
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
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="Logic Nodes" />
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
		{ href: '/shift-registers', label: 'Shift registers' },
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/combinational-vs-sequential', label: 'Combinational vs sequential' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Counters</h1>
		<p class="lede">
			Chain some flip-flops together and their outputs, read as a binary number, go up by one every clock edge. That is
			the entire idea, and everything else on this page is a variation on it.
		</p>
	</section>

	<section id="how">
		<h2>The rule that makes it count</h2>
		<p>
			A counter has one flip-flop per bit, and each one toggles when every bit below it is high. That single rule is
			binary counting: the ones column flips every time, the twos column flips every second time, the fours column every
			fourth time. Nothing keeps a running total anywhere.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<caption>Every state of a {WIDTH} bit counter, and which bits toggle on the next edge</caption>
				<thead>
					<tr>
						<th scope="col">Count</th>
						{#each Array(WIDTH) as _, i}
							<th scope="col" class="mono">Q{WIDTH - 1 - i}</th>
						{/each}
						<th scope="col">Toggles next</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr>
							<td class="mono">{row.value}</td>
							{#each Array(WIDTH) as _, i}
								<td class="mono">{row.bits[WIDTH - 1 - i]}</td>
							{/each}
							<td class="mono toggles">
								{row.toggling
									.map((on, position) => (on ? `Q${position}` : ''))
									.filter(Boolean)
									.reverse()
									.join(', ')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">
			Read the last column down and you have the wiring: Q0 always toggles, so its
			{#if tFlipFlop}<a href="/flip-flops/t">T input</a>{:else}T input{/if} is tied high. Q1 toggles when Q0 is high, so
			its T input is Q0. Q2 toggles when Q0 and Q1 are both high, so its T input is one AND gate. That pattern continues
			for as many bits as you want.
		</p>
	</section>

	<section id="timing">
		<h2>What it looks like in time</h2>
		<p class="section-intro">
			Each bit runs at half the rate of the one below it. That halving is why a counter is also a frequency divider, and
			it is how a 32768 Hz crystal becomes a one second tick in a watch: fifteen stages of division.
		</p>
		<figure class="timing">
			<div class="timing-scroll screen-only" role="img" aria-label={`Timing diagram of a 3 bit counter. ${counterAlt}`}>
				{@html counterSvg}
			</div>
			<div class="timing-scroll print-only" aria-hidden="true">{@html counterPrintSvg}</div>
			<figcaption>
				Q0 toggles every cycle, Q1 every second cycle, Q2 every fourth. The counter wraps back to 0 after {(1 <<
					WIDTH) -
					1}.
			</figcaption>
		</figure>
	</section>

	<section id="kinds">
		<h2>The four you will meet</h2>
		<div class="kinds">
			{#each counterKinds as kind}
				<!-- Prefixed: "decade" is also a section on this page. -->
				<div class="card kind" id="kind-{kind.slug}">
					<h3>{kind.name}</h3>
					<p class="blurb">{kind.blurb}</p>
					<p class="note">{kind.note}</p>
				</div>
			{/each}
		</div>
	</section>

	<section id="decade">
		<h2>Counting to something that is not a power of two</h2>
		<p>
			A chain of n flip-flops naturally counts to 2<sup>n</sup>. To stop anywhere else you watch for the state just past
			the last one you want and use it to clear the counter. A decade counter is four bits with a detector on 10, so the
			sequence runs {decade.slice(0, 10).join(', ')} and then starts again.
		</p>
		<figure class="timing">
			<div
				class="timing-scroll screen-only"
				role="img"
				aria-label="Timing diagram of a decade counter clearing after 9"
			>
				{@html decadeSvg}
			</div>
			<div class="timing-scroll print-only" aria-hidden="true">{@html decadePrintSvg}</div>
			<figcaption>
				The same shape as a four bit counter until 9, where the clear cuts the sequence short and the count restarts.
			</figcaption>
		</figure>
		<p class="note">
			The detector is a single AND gate on the bits that are high in the state you are catching. That state exists for a
			moment before the clear takes effect, which is a real glitch on the outputs and the reason a synchronous clear is
			preferred where anything downstream is watching. Where those glitches matter more than the count being readable, a <a
				href="/gray-code-converter">Gray code</a
			> counter changes only one bit per step and so has none.
		</p>
	</section>

	<section id="design">
		<h2>Designing one that counts in your own order</h2>
		<p>
			A counter does not have to count in binary. Write down the sequence of states you want, look up each transition in
			the <a href="/flip-flops">excitation table</a> of whichever flip-flop you are using, and you have a truth table for
			each input: what to put on it, given the present state. Minimise those tables and the gates fall out.
		</p>
		<ol class="steps">
			<li><strong>List the states</strong> in the order you want them, and the state each one goes to.</li>
			<li>
				<strong>Look up the inputs</strong> for each transition. For a
				<a href="/flip-flops/t">T flip-flop</a> that is just "did this bit change", which is why T is the easy choice for
				counters.
			</li>
			<li>
				<strong>Minimise</strong> each input's table with a <a href="/karnaugh-map-solver">Karnaugh map</a> or the
				<a href="/boolean-algebra-calculator">algebra calculator</a>.
			</li>
			<li>
				<strong>Build it</strong> and check it goes round: <a href="/simulator">the simulator</a> has a counter node,
				and flip-flops you can wire from gates. The <a href="/common-circuits">common circuits reference</a> has the decoders
				and comparators you will want around it.
			</li>
		</ol>
		<p class="cta-row"><a class="cta" href="/simulator">Build a counter in the simulator</a></p>
	</section>

	<section>
		<h2>Reference cards</h2>
		<p class="section-intro">Both waveforms as images, black on white, for notes or a slide.</p>
		{#each [...cards] as shot}
			<a class="card-image" href="/img/{shot.file}" download>
				<img
					src="/img/{shot.file}"
					alt={shot.alt}
					width={shot.width}
					height={shot.height}
					loading="lazy"
					decoding="async"
				/>
				<span class="card-caption">Click to download: {shot.title}</span>
			</a>
		{/each}
	</section>
	<section class="faq">
		<h2>Questions about counters</h2>
		{#each faqs as item}
			<details>
				<summary>{item.q}</summary>
				<p>{item.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	.card-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
		max-width: 640px;
	}

	.card-image img {
		display: block;
		width: 100%;
		height: auto;
		/* The card art is black on white, so it carries its own page colour. */
		background: #fff;
	}

	.card-caption {
		display: block;
		background: #161618;
		color: #8ede8e;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
	}

	.print-only {
		display: none;
	}

	.timing {
		margin: 0;
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

	.toggles {
		color: #8ede8e;
	}

	.kinds {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.8rem;
	}

	.kind {
		padding: 1rem 1.1rem 1.1rem;
	}

	.kind h3 {
		font-size: 1rem;
		margin: 0 0 0.2rem;
	}

	.kind .blurb {
		color: #8ede8e;
		font-size: 0.85rem;
		margin: 0 0 0.5rem;
	}

	.kind .note {
		margin: 0;
	}
</style>
