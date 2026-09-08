<script lang="ts">
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { shiftRegisterStages, ringCounter, johnsonCounter, registerKinds } from '$lib/sequential';
	import { clockSignal, timingToSvg, timingAlt, type Level } from '$lib/timing';

	const SITE = 'https://nodes.kriyak.com';

	// Every waveform here is generated from the stage definitions, so the picture
	// and the description cannot disagree.
	const WIDTH = 4;
	const serial: Level[] = [1, 0, 1, 1, 0, 0, 0, 0, 0, 0];
	const input = { name: 'IN', bits: serial, coloured: true };
	const stages = shiftRegisterStages(serial, WIDTH);
	const shiftSignals = [clockSignal(serial.length), input, ...stages];
	const shiftSvg = timingToSvg(shiftSignals, { caption: 'A 4 bit shift register', showEdges: true });
	const shiftPrintSvg = timingToSvg(shiftSignals, {
		caption: 'A 4 bit shift register',
		showEdges: true,
		palette: 'mono'
	});
	const shiftAlt = timingAlt(shiftSignals);

	const RING_CYCLES = 9;
	const ringSignals = [clockSignal(RING_CYCLES), ...ringCounter(4, RING_CYCLES)];
	const ringSvg = timingToSvg(ringSignals, { caption: 'Ring counter: 4 states from 4 stages', showEdges: true });
	const ringPrintSvg = timingToSvg(ringSignals, {
		caption: 'Ring counter: 4 states from 4 stages',
		showEdges: true,
		palette: 'mono'
	});

	const JOHNSON_CYCLES = 10;
	const johnsonSignals = [clockSignal(JOHNSON_CYCLES), ...johnsonCounter(4, JOHNSON_CYCLES)];
	const johnsonSvg = timingToSvg(johnsonSignals, {
		caption: 'Johnson counter: 8 states from the same 4 stages',
		showEdges: true
	});
	const johnsonPrintSvg = timingToSvg(johnsonSignals, {
		caption: 'Johnson counter: 8 states from the same 4 stages',
		showEdges: true,
		palette: 'mono'
	});

	// The stage contents cycle by cycle, which is the table people actually want.
	const table = serial.slice(0, 8).map((bit, cycle) => ({
		cycle: cycle + 1,
		input: bit,
		stages: stages.map((stage) => stage.bits[cycle])
	}));

	const faqs = [
		{
			q: 'What is a shift register?',
			a: 'A row of flip-flops wired output to input, all sharing one clock. On every edge each stage takes whatever its neighbour was holding, so the whole contents move along by one place. Stage k holds what the input was k+1 cycles ago, and that is the entire behaviour.'
		},
		{
			q: 'What is a shift register used for?',
			a: 'Turning one wire into many and back. A serial in, parallel out register collects a byte arriving one bit at a time and presents all eight at once, which is what the receiving half of a UART does; a parallel in, serial out register does the reverse when sending. They are also delay lines, and with feedback they become counters or pseudo-random generators.'
		},
		{
			q: 'What is the difference between a ring counter and a Johnson counter?',
			a: 'A ring counter feeds the last stage straight back to the first, so a single high bit walks round and n stages give n states. A Johnson counter inverts on the way back, so the register fills with 1s and then empties, giving 2n states from the same hardware. Neither needs a decoder: in a ring counter each state is already one wire.'
		},
		{
			q: 'How many flip-flops does a shift register need?',
			a: 'One per bit it holds. A four bit register is four flip-flops, and the data takes four clock edges to travel from the input to the last output. That delay is not a fault: it is what makes a shift register useful as a delay line and what sets how long a serial transfer takes.'
		},
		{
			q: 'Why is the output zero for the first few cycles?',
			a: 'Because the register starts empty and the data has not arrived yet. The last stage cannot show anything meaningful until the input has been clocked through every stage before it, so an n bit register has n cycles of latency. Real designs either clear the register first or ignore the output until it is full.'
		}
	];

	const page = {
		title: 'Shift Registers: SIPO, PISO, Ring and Johnson Counters',
		description:
			'How shift registers work, the four serial and parallel arrangements, and the ring and Johnson counters built from them, with generated timing diagrams.',
		url: `${SITE}/shift-registers`,
		image: `${SITE}/og/shift-registers.png`,
		imageAlt: 'Logic Nodes: shift registers'
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
					{ '@type': 'ListItem', position: 2, name: 'Shift registers' }
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
		{ href: '/counters', label: 'Counters' },
		{ href: '/flip-flops/d', label: 'D flip-flop' },
		{ href: '/combinational-vs-sequential', label: 'Combinational vs sequential' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Shift registers</h1>
		<p class="lede">
			A row of flip-flops wired output to input, all on one clock. Every edge, the contents move along by one place.
			That one sentence covers everything on this page.
		</p>
	</section>

	<section id="how">
		<h2>Stage k is the input, k+1 cycles ago</h2>
		<p>
			Each flip-flop takes whatever its neighbour was holding when the edge arrived. Because they all sample at the same
			instant, every stage gets the <em>old</em> value of the one before it, not the new one, so the data moves exactly one
			place per edge rather than racing to the end.
		</p>
		<figure class="timing">
			<div
				class="timing-scroll screen-only"
				role="img"
				aria-label={`Timing diagram of a 4 bit shift register. ${shiftAlt}`}
			>
				{@html shiftSvg}
			</div>
			<div class="timing-scroll print-only" aria-hidden="true">{@html shiftPrintSvg}</div>
			<figcaption>
				The pattern on IN appears at Q0 one cycle later, at Q1 two cycles later, and reaches Q{WIDTH - 1} after {WIDTH} cycles.
			</figcaption>
		</figure>
		<div class="table-wrap">
			<table class="data-table">
				<caption>The same thing as numbers: what each stage holds, cycle by cycle</caption>
				<thead>
					<tr>
						<th scope="col">Cycle</th>
						<th scope="col" class="mono">IN</th>
						{#each stages as stage}
							<th scope="col" class="mono">{stage.name}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each table as row}
						<tr>
							<td class="mono">{row.cycle}</td>
							<td class="mono">{row.input}</td>
							{#each row.stages as value}
								<td class="mono">{value}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">
			Read a column downwards and you see one bit travelling. Read a row across and you see the register's contents at
			that moment, which is what a parallel output gives you all at once.
		</p>
	</section>

	<section id="kinds">
		<h2>Four ways to wire the ends</h2>
		<p class="section-intro">
			The chain is always the same. What changes is whether you put data in one bit at a time or all at once, and
			whether you read it the same way. Those two choices give four registers, and the names are just the two answers
			written down.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Register</th>
						<th scope="col">In</th>
						<th scope="col">Out</th>
						<th scope="col">What it is for</th>
					</tr>
				</thead>
				<tbody>
					{#each registerKinds as kind}
						<tr id={kind.slug}>
							<th scope="row">{kind.name} <span class="abbr mono">{kind.slug.toUpperCase()}</span></th>
							<td>{kind.inputs}</td>
							<td>{kind.outputs}</td>
							<td>{kind.use}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="ring">
		<h2>Feed the end back and it counts</h2>
		<p>
			Wire the last stage to the first and the register stops being a pipe and becomes a loop. Load a single 1 and it
			walks round for ever: four stages, four states, and each state is already one wire, so nothing needs decoding.
			That is a ring counter, and it is the cheapest way to drive things that must happen in strict rotation.
		</p>
		<figure class="timing">
			<div class="timing-scroll screen-only" role="img" aria-label="Timing diagram of a 4 stage ring counter">
				{@html ringSvg}
			</div>
			<div class="timing-scroll print-only" aria-hidden="true">{@html ringPrintSvg}</div>
			<figcaption>One high bit, moving one place per edge, back to the start after four.</figcaption>
		</figure>

		<p>
			Invert on the way back instead and the register fills with 1s, then empties again. The same four flip-flops now
			give eight distinct states, which is the best you can do without decoding logic.
		</p>
		<figure class="timing">
			<div class="timing-scroll screen-only" role="img" aria-label="Timing diagram of a 4 stage Johnson counter">
				{@html johnsonSvg}
			</div>
			<div class="timing-scroll print-only" aria-hidden="true">{@html johnsonPrintSvg}</div>
			<figcaption>
				Filling from Q0 and then emptying from Q0: eight states before it repeats, twice what the ring managed.
			</figcaption>
		</figure>
		<p class="note">
			Neither counts in binary, so neither is a substitute for a <a href="/counters">binary counter</a> when you want a number.
			What they buy is that reading the state needs no gates at all.
		</p>
	</section>

	<section id="build">
		<h2>Building one</h2>
		<p>
			A shift register is the one sequential circuit with nothing clever in it: <a href="/flip-flops/d">D flip-flops</a>
			in a row, output to input, one shared clock. If you have built a D flip-flop you have built a shift register; the only
			decision left is how many.
		</p>
		<p class="cta-row"><a class="cta" href="/simulator">Wire one up in the simulator</a></p>
	</section>

	<section class="faq">
		<h2>Questions about shift registers</h2>
		{#each faqs as item}
			<details>
				<summary>{item.q}</summary>
				<p>{item.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	.print-only {
		display: none;
	}

	.timing {
		margin: 0 0 1.2rem;
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

	.abbr {
		color: #888;
		font-size: 0.75rem;
		margin-left: 0.3rem;
	}
</style>
