<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseExpression, truthTable } from '$lib/boolean';

	// A worked contrast: the same two inputs, one circuit without memory and one
	// with. The combinational side is generated; the sequential side cannot be,
	// which is exactly the point being made.
	const combinational = truthTable(parseExpression('a & b'));

	const latchTrace = [
		{ s: 0, r: 0, q: 0, note: 'idle, and it stays low' },
		{ s: 1, r: 0, q: 1, note: 'set: the output goes high' },
		{ s: 0, r: 0, q: 1, note: 'same inputs as row one, different output' },
		{ s: 0, r: 1, q: 0, note: 'reset: back to low' },
		{ s: 0, r: 0, q: 0, note: 'and it holds again' }
	];

	const faqs = [
		{
			q: 'What is the difference between combinational and sequential logic?',
			a: 'Combinational logic depends only on the inputs right now, so the same inputs always give the same output and the circuit can be described completely by a truth table. Sequential logic feeds some of its outputs back into its inputs, so it has state: the output depends on the history of what happened, not only on the present.'
		},
		{
			q: 'How can I tell which one a circuit is?',
			a: 'Look for a loop. If you can trace a path from an output back round to an input, the circuit is almost certainly sequential; with no feedback anywhere it is combinational, no matter how many gates deep it goes. Treat it as a quick test rather than a definition: a schematic drawn with flip-flop symbols hides its loops inside them, and a rare feedback loop exists only to suppress a hazard and stores nothing.'
		},
		{
			q: 'Is a multiplexer combinational or sequential?',
			a: 'Combinational. It has a select input that changes which data line is passed through, but nothing is remembered: change the select and the output follows immediately. The same is true of adders, decoders, encoders and comparators.'
		},
		{
			q: 'Why does sequential logic need a clock?',
			a: 'It does not strictly have to have one, and a plain latch does not. But without a clock the feedback settles whenever it happens to, so timing depends on gate delays and races are easy to create. A clock makes every state change happen at one known instant, which is what makes a large design analysable.'
		},
		{
			q: 'Can a truth table describe a sequential circuit?',
			a: 'Not on its own. You need a characteristic table or a state diagram, which lists the next state for each combination of inputs and present state. The flip-flop pages show exactly that: the same inputs appear twice with different results, once for each present state.'
		}
	];

	const page = {
		title: 'Combinational vs Sequential Logic: The Difference',
		description:
			'Combinational logic depends only on its inputs; sequential logic remembers. What separates them, how to spot each, and why one needs a clock.',
		url: `${SITE}/combinational-vs-sequential`,
		image: `${SITE}/og/combinational-vs-sequential.png`,
		imageAlt: 'Logic Nodes: combinational vs sequential logic'
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
					{ '@type': 'ListItem', position: 2, name: 'Combinational vs sequential' }
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
		{ href: '/common-circuits', label: 'Common logic circuits' },
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/learn', label: 'Learn digital logic' }
	]}
>
	<section class="intro">
		<h1>Combinational vs sequential logic</h1>
		<p class="lede">
			One kind of circuit answers a question about right now. The other remembers what happened. The difference is a
			single wire looping backwards, and almost everything else follows from it.
		</p>
	</section>

	<section>
		<h2>The short answer</h2>
		<div class="table-wrap">
			<table class="data-table compare">
				<thead>
					<tr>
						<th scope="col" />
						<th scope="col">Combinational</th>
						<th scope="col">Sequential</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Output depends on</th>
						<td>the inputs right now</td>
						<td>the inputs and the current state</td>
					</tr>
					<tr>
						<th scope="row">Has feedback</th>
						<td>no</td>
						<td>yes, that is what makes it sequential</td>
					</tr>
					<tr>
						<th scope="row">Described by</th>
						<td>a truth table, or a boolean expression</td>
						<td>a state diagram, or a characteristic table</td>
					</tr>
					<tr>
						<th scope="row">Needs a clock</th>
						<td>no</td>
						<td>usually, to make state changes happen at known instants</td>
					</tr>
					<tr>
						<th scope="row">Same inputs twice</th>
						<td>always the same output</td>
						<td>can give different outputs</td>
					</tr>
					<tr>
						<th scope="row">Examples</th>
						<td>
							<a href="/common-circuits#half-adder">adders</a>,
							<a href="/common-circuits#multiplexer">multiplexers</a>, decoders, comparators
						</td>
						<td>
							<a href="/flip-flops">latches and flip-flops</a>, registers, counters, state machines
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>Seen side by side</h2>
		<p class="section-intro">
			The clearest way to feel the difference is to look at two small circuits with the same two inputs.
		</p>

		<div class="two-up">
			<div class="card side">
				<h3>An AND gate, combinational</h3>
				<div class="table-wrap">
					<table class="data-table small">
						<thead>
							<tr>
								<th scope="col" class="mono">a</th>
								<th scope="col" class="mono">b</th>
								<th scope="col" class="mono">out</th>
							</tr>
						</thead>
						<tbody>
							{#each combinational.rows as value, row}
								<tr>
									<td class={row & 2 ? 'bit-1' : 'bit-0'}>{row & 2 ? 1 : 0}</td>
									<td class={row & 1 ? 'bit-1' : 'bit-0'}>{row & 1 ? 1 : 0}</td>
									<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="note">Four rows and the circuit is fully described. Nothing about the past can change any of them.</p>
			</div>

			<div class="card side">
				<h3>An SR latch, sequential</h3>
				<div class="table-wrap">
					<table class="data-table small">
						<thead>
							<tr>
								<th scope="col" class="mono">S</th>
								<th scope="col" class="mono">R</th>
								<th scope="col" class="mono">Q</th>
								<th scope="col">what happened</th>
							</tr>
						</thead>
						<tbody>
							{#each latchTrace as step, i}
								<tr class:marked={i === 0 || i === 2}>
									<td class={step.s ? 'bit-1' : 'bit-0'}>{step.s}</td>
									<td class={step.r ? 'bit-1' : 'bit-0'}>{step.r}</td>
									<td class={step.q ? 'bit-1' : 'bit-0'}>{step.q}</td>
									<td class="what">{step.note}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="note">
					Read in order, not as a truth table. The two highlighted rows have identical inputs and different outputs,
					which no truth table can express.
				</p>
			</div>
		</div>
	</section>

	<section>
		<h2>How to tell them apart</h2>
		<p class="section-intro">There is one test, and it is visual: follow the wires and look for a loop.</p>
		<ol class="steps">
			<li>
				<strong>Trace from each output backwards.</strong> If any path leads back to an input of a gate you have already
				passed through, the circuit has feedback and is sequential.
			</li>
			<li>
				<strong>No loop means combinational.</strong> Depth does not matter: a four bit ripple carry adder is a couple of
				dozen gates, around nine deep along its longest path, and still has no memory at all.
			</li>
			<li>
				<strong>Try the same inputs twice.</strong> Set the inputs, note the output, change them, set them back. A combinational
				circuit returns to the same output every time; a sequential one may not.
			</li>
		</ol>
		<p class="reducer">
			The <a href="/truth-table-generator">truth table generator</a> refuses circuits with a loop for this reason: there
			is no single output to tabulate.
		</p>
	</section>

	<section>
		<h2>Why the clock arrives</h2>
		<p>
			Feedback brings a problem with it. A latch settles into its new state whenever its gates happen to catch up, so
			two latches fed from the same signal may change at slightly different moments. In a circuit of any size those
			small differences become races, where the result depends on which path happened to be faster.
		</p>
		<p>
			A clock removes the question. Every <a href="/flip-flops">flip-flop</a> samples its input on the same edge, so every
			state change happens at one instant and each signal has a full clock period to settle before anything reads it. That
			is what makes a design analysable: you only have to check that the combinational logic between two flip-flops settles
			within one period, rather than reasoning about every possible ordering.
		</p>
		<p>
			The usual shape is therefore both kinds together: blocks of combinational logic between registers of flip-flops,
			all sharing one clock. A processor is that pattern repeated.
		</p>
		<p>
			<a class="cta" href="/simulator">Build one in the simulator</a>
		</p>
		<p class="reducer">
			Try it directly: two <a href="/logic-gates/nor">NOR gates</a> cross-coupled make a latch you can set and reset,
			and it is the smallest circuit with a memory.
			<a href="/learn#memory">The learning path</a> builds it step by step.
		</p>
		<p class="reducer">
			The two sequential circuits worth knowing next are both just flip-flops in a row:
			<a href="/counters">counters</a>, where each stage toggles when the ones below it are high, and
			<a href="/shift-registers">shift registers</a>, where every stage passes its value along on each edge.
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

	.compare th,
	.compare td {
		vertical-align: top;
	}

	.two-up {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 12px;
	}

	.side {
		padding: 0.9rem 1rem 1rem;
	}

	.side h3 {
		color: #fff;
		margin-bottom: 0.7rem;
	}

	.small {
		width: 100%;
		font-size: 0.88rem;
	}

	.small th,
	.small td {
		text-align: center;
	}

	.what {
		text-align: left !important;
		color: #888;
		font-size: 0.8rem;
	}

	tr.marked td {
		background-color: rgba(216, 180, 90, 0.16);
	}

	.note {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.7rem 0 0;
	}

	.steps {
		padding-left: 1.25rem;
		color: #ddd;
		max-width: 700px;
	}

	.steps li {
		margin-bottom: 0.7rem;
	}

	.steps strong {
		color: #fff;
	}
</style>
