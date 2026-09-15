<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { gates } from '$lib/gates';
	import { parseExpression, truthTable } from '$lib/boolean';

	// Tables come from the expression engine, so the reference cannot drift.
	const rows = gates.map((gate) => ({ ...gate, table: truthTable(parseExpression(gate.source)) }));

	const faqs = [
		{
			q: 'What is a logic gate?',
			a: 'A logic gate is a small circuit that takes one or more binary inputs, each either 1 or 0, and produces a single binary output according to a fixed rule. An AND gate outputs 1 only when every input is 1; an OR gate outputs 1 when any input is 1. Its complete behaviour fits in a truth table, and in hardware each gate is a handful of transistors.'
		},
		{
			q: 'How many logic gates are there?',
			a: 'Six basic gates: AND, OR, NOT, XOR, NAND and NOR. Some courses list a seventh, XNOR, which is XOR with the output inverted. Strictly only three are fundamental, AND, OR and NOT, since the others are combinations of those; and NAND alone can build everything.'
		},
		{
			q: 'What are logic gates made of?',
			a: 'In modern chips, transistors: a CMOS NAND gate is four of them, a NOT gate is two. Earlier computers built the same gates from relays and vacuum tubes, and you can make one from two switches on a battery. The rule is what matters, not the material, which is why a simulator can run the same gate as a few lines of code.'
		},
		{
			q: 'What are logic gates used for?',
			a: 'Everything digital. Gates add numbers, compare them, pick one signal out of several, decode addresses and drive displays. Wired back on themselves they store bits, which is how memory and counters work. A processor is billions of gates doing exactly these jobs at once.'
		},
		{
			q: 'Why are NAND and NOR called universal gates?',
			a: 'Because every other gate can be built from NAND gates alone, or from NOR gates alone. Tie both inputs of a NAND together and you get NOT; add that inverter to a NAND and you get AND. Chips are largely made of NAND and NOR for this reason: one well made gate covers every function.'
		},
		{
			q: 'What is the difference between a logic gate and boolean algebra?',
			a: 'They are the same thing seen two ways. Boolean algebra is the maths: variables that are 1 or 0 and operators such as AND, OR and NOT. A logic gate is that operator built as a circuit. Every boolean expression can be drawn as gates, and every gate circuit without feedback can be written as an expression.'
		}
	];

	const page = {
		title: 'The 6 Logic Gates: Truth Tables, Symbols and Uses',
		description:
			'What a logic gate is, then all six: AND, OR, NOT, XOR, NAND and NOR, each with its truth table, boolean expression and real uses. Free reference, no signup.',
		url: `${SITE}/logic-gates`,
		image: `${SITE}/og/logic-gates.png`,
		imageAlt: 'LogicGates.org: logic gates'
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
				})),
				hasPart: { '@id': `${page.url}#list` }
			},
			{
				'@type': 'ItemList',
				'@id': `${page.url}#list`,
				name: 'The six basic logic gates',
				itemListElement: gates.map((gate, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: `${gate.name} gate`,
					url: `${SITE}/logic-gates/${gate.slug}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Logic gates' }
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
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' }
	]}
>
	<section class="intro">
		<h1>The six logic gates</h1>
		<p class="lede">
			Every digital logic function, from a doorbell to a processor, is built out of these six operations. Each one
			combines binary inputs — one for NOT, two for XOR, two or more for the rest — into a single binary output.
		</p>
	</section>

	<section id="what-is-a-logic-gate">
		<h2>What is a logic gate?</h2>
		<p>
			A logic gate is a circuit with one or more inputs and one output, where every wire carries one of two values:
			<span class="mono">1</span> or <span class="mono">0</span>, high or low, on or off. The gate applies a fixed rule
			to its inputs and puts the answer on its output. That is the whole idea. An AND gate's rule is "1 only if every
			input is 1"; a NOT gate's rule is "the opposite of the input".
		</p>
		<p>
			Because the inputs can only be 1 or 0, a gate's behaviour can be written out in full. Two inputs give four
			combinations, three give eight, and a table listing the output for each is a <strong>truth table</strong>. The
			truth table <em>is</em> the gate: two circuits with the same table are interchangeable, however they are built.
		</p>
		<p>
			And they are built in many ways. In a modern chip a gate is a few transistors; the first computers made the same
			gates from relays and vacuum tubes, and two switches on a battery make a working AND gate. In a diagram a gate is
			a symbol, and in boolean algebra it is an operator: <span class="mono">a ∧ b</span> and an AND gate are the same thing,
			written down or wired up.
		</p>
		<p>
			Two values are used instead of ten because a circuit only has to tell "high" from "low", which it can do reliably
			even when the signal is noisy. Everything else, numbers, text, pictures, is encoded as strings of those bits and
			handled by gates a bit at a time.
		</p>
		<p class="reducer">
			On their own, gates have no memory: the output depends only on the inputs right now. Feed an output back into an
			input and the circuit can hold a value, which is where <a href="/flip-flops">flip-flops</a> and the rest of
			<a href="/combinational-vs-sequential">sequential logic</a> begin.
		</p>
	</section>

	<section>
		<h2>All six at a glance</h2>
		<div class="gate-grid">
			{#each rows as gate}
				<a class="card gate" href="/logic-gates/{gate.slug}">
					<h3>
						<span class="gate-name">{gate.name}</span>
						<span class="gate-symbol mono">{gate.symbol}</span>
					</h3>
					<table class="data-table small">
						<thead>
							<tr>
								{#each gate.table.variables as variable}
									<th scope="col" class="mono">{variable}</th>
								{/each}
								<th scope="col" class="mono">Q</th>
							</tr>
						</thead>
						<tbody>
							{#each gate.table.rows as value, row}
								<tr>
									{#each gate.table.variables as _, bit}
										{@const on = !!(row & (1 << (gate.table.variables.length - 1 - bit)))}
										<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
									{/each}
									<td class={value ? 'bit-1' : 'bit-0'}>{value ? 1 : 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="tagline">{gate.tagline}</p>
					<span class="more">Read more →</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<h2>The chart</h2>
		<p class="section-intro">
			All six with their symbols and truth tables on one image, if you want it on a wall or in a set of notes.
		</p>
		<a class="chart-image" href="/img/logic-gates-chart.png" download>
			<img
				src="/img/logic-gates-chart.png"
				alt="Logic gates chart: AND, OR, NOT, XOR, NAND and NOR with their ANSI symbols, boolean expressions and truth tables"
				width="1180"
				height="700"
				loading="lazy"
				decoding="async"
			/>
			<span class="chart-caption">Click to download the logic gates chart</span>
		</a>
	</section>

	<section>
		<h2>How they relate</h2>
		<p class="section-intro">
			The six are not independent. Three of them are the other three with the output inverted, and two of them can build
			all the rest on their own.
		</p>
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col">Gate</th>
					<th scope="col">Is</th>
					<th scope="col">Inputs</th>
					<th scope="col">Universal</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">AND</th>
					<td>The base case: all inputs high</td>
					<td>2 or more</td>
					<td>No</td>
				</tr>
				<tr>
					<th scope="row">OR</th>
					<td>The base case: any input high</td>
					<td>2 or more</td>
					<td>No</td>
				</tr>
				<tr>
					<th scope="row">NOT</th>
					<td>Inversion, the thing that completes the set</td>
					<td>1</td>
					<td>No</td>
				</tr>
				<tr>
					<th scope="row">NAND</th>
					<td>AND, inverted</td>
					<td>2 or more</td>
					<td>Yes</td>
				</tr>
				<tr>
					<th scope="row">NOR</th>
					<td>OR, inverted</td>
					<td>2 or more</td>
					<td>Yes</td>
				</tr>
				<tr>
					<th scope="row">XOR</th>
					<td>OR, minus the case where both are high</td>
					<td>2</td>
					<td>No</td>
				</tr>
			</tbody>
		</table>
		<p class="reducer">
			"Universal" means every other gate can be built from that one alone. NAND and NOR both qualify, which is why real
			chips are largely made of them. Each gate page shows the construction, and every identity on this site is machine
			checked against its truth table.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about logic gates</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>

	<section>
		<h2>Try them</h2>
		<p class="section-intro">
			Reading a truth table is one thing; watching a signal move is another. Drop a couple of these onto a canvas, wire
			them to a switch and a lamp, and toggle the inputs.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			Prefer to recognise them on a schematic? The
			<a href="/logic-gate-symbols">symbol reference</a> has all six in both the ANSI and IEC styles.
		</p>
		<p class="reducer">
			Or start from the <a href="/simulator#example:Introduction">introduction circuit</a>, generate a
			<a href="/truth-table-generator">truth table</a> from what you build, and simplify it with a
			<a href="/karnaugh-map-solver">Karnaugh map</a>.
		</p>
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 64px;
	}

	.chart-image {
		display: block;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		text-decoration: none;
	}

	.chart-image img {
		display: block;
		width: 100%;
		height: auto;
		/* The card art is black on white, so it carries its own page colour. */
		background: #fff;
	}

	.chart-caption {
		display: block;
		background: #161618;
		color: #8ede8e;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
	}

	.gate-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 12px;
	}

	.gate {
		padding: 0.9rem 1rem 1rem;
		text-decoration: none;
		display: block;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.gate:hover {
		border-color: rgba(255, 255, 255, 0.75);
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.gate,
		.gate:hover {
			transition: none;
			transform: none;
		}
	}

	.gate h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.gate-name {
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.gate-symbol {
		font-size: 0.85rem;
		color: #999;
	}

	.gate .small {
		width: 100%;
		font-size: 0.85rem;
	}

	.tagline {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.6rem 0 0.4rem;
	}

	.more {
		color: #8ede8e;
		font-size: 0.8rem;
	}
</style>
