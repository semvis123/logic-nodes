<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import GateSymbol from '$lib/GateSymbol.svelte';
	import { gates } from '$lib/gates';
	import { parseExpression, truthTable } from '$lib/boolean';

	// The three families the seven gates fall into, and how each one relates to
	// the others. Universality is checked per gate on the gate pages.
	const groups: Record<string, { group: 'Basic' | 'Universal' | 'Exclusive'; is: string }> = {
		and: { group: 'Basic', is: 'The base case: all inputs high' },
		or: { group: 'Basic', is: 'The base case: any input high' },
		not: { group: 'Basic', is: 'Inversion, the thing that completes the set' },
		nand: { group: 'Universal', is: 'AND, inverted' },
		nor: { group: 'Universal', is: 'OR, inverted' },
		xor: { group: 'Exclusive', is: 'OR, minus the case where both are high' },
		xnor: { group: 'Exclusive', is: 'XOR, inverted' }
	};

	// Tables come from the expression engine, so the reference cannot drift.
	const rows = gates.map((gate) => ({
		...gate,
		...groups[gate.slug],
		table: truthTable(parseExpression(gate.source))
	}));

	// The chart is drawn by scripts/reference-cards.ts at twice its layout size:
	// the file is 2360 x 2382 pixels, and the page lays it out at half that.
	const chart = {
		src: '/img/logic-gates-chart.png',
		alt: 'Logic gates chart: AND, OR, NOT, XOR, NAND, NOR and XNOR with their ANSI symbols, boolean expressions and truth tables',
		width: 1180,
		height: 1191
	};

	// Every gate over the same two inputs, for the combined table. NOT has only
	// the one input, so its column is NOT a and simply ignores b.
	const both = ['a', 'b'];
	const combined = gates.map((gate) => ({
		...gate,
		header: gate.slug === 'not' ? 'NOT a' : gate.name,
		rows: truthTable(parseExpression(gate.source), both).rows
	}));

	const faqs = [
		{
			q: 'What is a logic gate?',
			a: 'A logic gate is a small circuit that takes one or more binary inputs, each either 1 or 0, and produces a single binary output according to a fixed rule. An AND gate outputs 1 only when every input is 1; an OR gate outputs 1 when any input is 1. Its complete behaviour fits in a truth table, and in hardware each gate is a handful of transistors.'
		},
		{
			q: 'How many types of logic gates are there?',
			a: 'Seven: AND, OR, NOT, XOR, NAND, NOR and XNOR. Some courses stop at six and leave XNOR out, since it is XOR with the output inverted. Traditionally three are called basic, AND, OR and NOT, because the other four are combinations of those; and NAND alone, or NOR alone, can build everything.'
		},
		{
			q: 'What are the types of logic gates?',
			a: 'Three basic gates, AND, OR and NOT; two universal gates, NAND and NOR, which are AND and OR with the output inverted; and two exclusive gates, XOR and XNOR, which are high when the inputs differ and when they match respectively. Every one of them is defined by its truth table, shown on this page.'
		},
		{
			q: 'What are the basic logic gates?',
			a: 'AND, OR and NOT. Every boolean function can be written with these three alone, and the other four gates are combinations of them: NAND is AND followed by NOT, NOR is OR followed by NOT, XOR is (a ∧ ¬b) ∨ (¬a ∧ b), and XNOR is XOR followed by NOT.'
		},
		{
			q: 'What are logic gates made of?',
			a: 'In modern chips, transistors: a CMOS NOT gate is two of them, a NAND or NOR gate is four, and an AND gate is a NAND followed by a NOT, so six. Earlier computers built the same gates from relays and vacuum tubes, and you can make one from two switches on a battery. The rule is what matters, not the material, which is why a simulator can run the same gate as a few lines of code.'
		},
		{
			q: 'What are logic gates used for?',
			a: 'Everything digital. Gates add numbers, compare them, pick one signal out of several, decode addresses and drive displays. Wired back on themselves they store bits, which is how memory and counters work. A processor is billions of gates doing exactly these jobs at once.'
		},
		{
			q: 'Which logic gates are universal?',
			a: "NAND and NOR, and no other two input gate. A gate is universal when every other gate can be built from copies of it alone. Tie both inputs of a NAND together and you get NOT; add that inverter to a NAND and you get AND; invert both inputs first and, by De Morgan's law, you get OR. That is what makes them universal: one well made gate covers every function. Chips favour them for a different reason, that in CMOS they are the cheapest gates after the inverter."
		},
		{
			q: 'Who invented logic gates?',
			a: "Nobody in a single step. George Boole published the algebra of true and false in 1847 and 1854. Charles Sanders Peirce noted in 1886 that electrical switches could carry out that algebra. Claude Shannon's 1937 master's thesis showed that relay circuits and boolean algebra are the same thing, which is the founding paper of digital logic design. Vacuum tube logic circuits date from the 1920s and 1930s, the first electronic computers built from them from the 1940s, transistor gates from the 1950s, and integrated circuits from the early 1960s."
		},
		{
			q: 'What is the difference between a logic gate and boolean algebra?',
			a: 'They are the same thing seen two ways. Boolean algebra is the maths: variables that are 1 or 0 and operators such as AND, OR and NOT. A logic gate is that operator built as a circuit. Every boolean expression can be drawn as gates, and every gate circuit without feedback can be written as an expression.'
		}
	];

	const page = {
		title: 'What Is a Logic Gate? The 7 Types, Truth Tables and Symbols',
		description:
			'What a logic gate is, then all seven types: AND, OR, NOT, XOR, NAND, NOR and XNOR, each with its truth table, symbol, boolean expression and real uses.',
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
				hasPart: { '@id': `${page.url}#list` },
				primaryImageOfPage: { '@id': `${page.url}#chart` }
			},
			{
				'@type': 'ImageObject',
				'@id': `${page.url}#chart`,
				name: 'Logic gates chart',
				caption: chart.alt,
				contentUrl: `${SITE}${chart.src}`,
				width: chart.width * 2,
				height: chart.height * 2
			},
			{
				// hasPart, above, expects a CreativeWork; ItemList alone is not
				// one, so it is tagged as both.
				'@type': ['ItemList', 'CreativeWork'],
				'@id': `${page.url}#list`,
				name: 'The seven logic gates',
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
		{ href: '/logic-gate-symbols', label: 'Gate symbols' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' }
	]}
>
	<section class="intro">
		<h1>The 7 types of logic gates</h1>
		<p class="lede">
			Every digital logic function, from a doorbell to a processor, is built out of these seven operations. Each one
			combines binary inputs — one for NOT, two or more for the rest — into a single binary output.
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
			And they are built in many ways. Two switches on a battery make a working AND gate: wire them in series and the
			lamp only lights when both are closed. Wire them in parallel and you have an OR. The first computers made the same
			gates from relays, then from vacuum tubes. In a diagram a gate is a symbol, and in boolean algebra it is an
			operator: <span class="mono">a ∧ b</span> and an AND gate are the same thing, written down or wired up.
		</p>
		<h3>From transistors to gates</h3>
		<p>
			In a modern chip every gate is a handful of transistors used as switches. A CMOS inverter is two of them: one
			connects the output to the supply when the input is low, the other connects it to ground when the input is high,
			so the output is always the opposite of the input. Put two of the ground-side transistors in series and the output
			can only be pulled low when both inputs are high: that is a NAND gate, four transistors in all. Put them in
			parallel instead and you get a NOR. An AND is a NAND followed by an inverter, six transistors, which is why NAND
			and NOR are the cheapest gates after the inverter and logic is often mapped onto them. A processor is billions of
			transistors, clocked billions of times a second.
		</p>
		<p>
			Two values are used instead of ten because a circuit only has to tell "high" from "low", which it can do reliably
			even when the signal is noisy. Everything else, numbers, text, pictures, is encoded as strings of those bits and
			handled by gates a bit at a time.
		</p>
		<p class="reducer">
			On their own, gates have no memory: the output depends only on the inputs right now. Feed an output back into an
			input and the circuit can hold a value, which is where the <a href="/sr-latch">SR latch</a>,
			<a href="/flip-flops">flip-flops</a> and the rest of
			<a href="/combinational-vs-sequential">sequential logic</a> begin.
		</p>
	</section>

	<section id="types">
		<h2>Types of logic gates</h2>
		<p class="section-intro">
			Three basic gates (AND, OR, NOT), two universal gates (NAND, NOR) and two exclusive gates (XOR, XNOR). All seven
			at a glance, with the symbol, the boolean expression and the truth table, and a page of its own for each.
		</p>
		<div class="gate-grid">
			{#each rows as gate}
				<a class="card gate" href="/logic-gates/{gate.slug}">
					<h3>
						<span class="gate-name">{gate.name}</span>
						<span class="gate-symbol mono">{gate.symbol}</span>
					</h3>
					<p class="group">{gate.group} gate</p>
					<div class="gate-body">
						<div class="gate-drawing">
							<GateSymbol gate={gate.slug} label="{gate.name} gate symbol" />
						</div>
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
					</div>
					<p class="tagline">{gate.tagline}</p>
					<span class="more">Read more →</span>
				</a>
			{/each}
		</div>
	</section>

	<section id="truth-table">
		<h2>Truth table of all 7 logic gates</h2>
		<p class="section-intro">
			Every gate for the same two inputs, side by side. NOT has a single input, so its column is NOT a and ignores b.
		</p>
		<div class="table-wrap">
			<table class="data-table combined" id="all-gates-truth-table">
				<thead>
					<tr>
						<th scope="col" class="mono">a</th>
						<th scope="col" class="mono">b</th>
						{#each combined as gate}
							<th scope="col"><a href="/logic-gates/{gate.slug}">{gate.header}</a></th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each [0, 1, 2, 3] as row}
						<tr>
							{#each both as _, bit}
								{@const on = !!(row & (1 << (both.length - 1 - bit)))}
								<td class={on ? 'bit-1' : 'bit-0'}>{on ? 1 : 0}</td>
							{/each}
							{#each combined as gate}
								<td class={gate.rows[row] ? 'bit-1' : 'bit-0'}>{gate.rows[row] ? 1 : 0}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Read down a column to see a gate's whole rule. The inverted pairs are easy to spot: NAND is AND with every output
			flipped, NOR is OR flipped, and XNOR is XOR flipped.
		</p>
	</section>

	<section id="chart">
		<h2>Logic gates chart</h2>
		<p class="section-intro">
			All seven with their symbols and truth tables on one image, if you want it on a wall or in a set of notes. The
			<a href="/logic-gate-symbols">logic gate symbols</a> page has a chart of both the ANSI and IEC symbols.
		</p>
		<a class="chart-image" href={chart.src} download>
			<img src={chart.src} alt={chart.alt} width={chart.width} height={chart.height} loading="lazy" decoding="async" />
			<span class="chart-caption">Click to download the logic gates chart</span>
		</a>
	</section>

	<section id="basic-vs-universal">
		<h2>Basic gates vs universal gates</h2>
		<p>
			The seven are not independent. The <strong>basic gates</strong> are AND, OR and NOT: together they can express any
			boolean function, since every truth table can be written as an OR of AND terms, with NOT on some of the inputs.
			The <strong>universal gates</strong>, NAND and NOR, can do the same on their own, with no other gate needed. The
			<strong>exclusive gates</strong>, XOR and XNOR, are neither: they are built from the basic gates, and cannot build
			an AND by themselves.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Gate</th>
						<th scope="col">Type</th>
						<th scope="col">Is</th>
						<th scope="col">Inputs</th>
						<th scope="col">Universal</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as gate}
						<tr>
							<th scope="row"><a href="/logic-gates/{gate.slug}">{gate.name}</a></th>
							<td>{gate.group}</td>
							<td>{gate.is}</td>
							<td>{gate.inputs === 'many' ? '2 or more' : gate.inputs}</td>
							<td>{gate.group === 'Universal' ? 'Yes' : 'No'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			"Universal" means every other gate can be built from that one alone. Each gate page shows the construction, and
			every identity on this site is machine checked against its truth table.
		</p>
	</section>

	<section id="universal-gates">
		<h2>Universal gates: NAND and NOR</h2>
		<p>
			A gate is universal, or functionally complete, when every boolean function can be built from copies of it and
			nothing else. AND, OR and NOT together are complete, and any gate that can imitate all three is complete on its
			own. NAND does it in three moves:
		</p>
		<ul class="universal">
			<li>
				<strong>NOT</strong> is a NAND with its two inputs tied together: <span class="mono">¬(a ∧ a) = ¬a</span>.
			</li>
			<li><strong>AND</strong> is a NAND followed by that inverter: <span class="mono">¬¬(a ∧ b) = a ∧ b</span>.</li>
			<li>
				<strong>OR</strong> is a NAND with both inputs inverted first:
				<span class="mono">¬(¬a ∧ ¬b) = a ∨ b</span>, which is <a href="/de-morgans-laws">De Morgan's law</a>.
			</li>
		</ul>
		<p>
			NOR does the same with the roles of AND and OR swapped. No other two input gate qualifies: AND and OR cannot make
			a NOT, and XOR and XNOR cannot make an AND. This is why a single type of gate is enough, and why the Apollo
			Guidance Computer could be built from a single type of three input NOR gate. Every gate page shows its own NAND
			and NOR constructions, and the <a href="/nand-nor-converter">NAND and NOR converter</a> rewrites any expression that
			way with the gate count.
		</p>
	</section>

	<section id="history">
		<h2>A short history</h2>
		<p>
			The algebra came first. George Boole set out the arithmetic of true and false in 1847 and, in full, in
			<em>The Laws of Thought</em> in 1854, the better part of a century before anyone had a use for it in hardware. Charles
			Sanders Peirce saw in 1886 that electrical switches could carry it out, and Henry Sheffer showed in 1913 that a single
			operation is enough on its own: the Sheffer stroke, defined as NOR in his paper and usually read as NAND today. The
			decisive step was Claude Shannon's 1937 master's thesis, which showed that relay switching circuits and boolean algebra
			are the same subject: from then on a circuit could be designed by writing an expression and simplifying it. Vacuum
			tube logic circuits date from the 1920s and 1930s, and the first electronic computers built from them, Colossus and
			ENIAC, from the 1940s. Transistors followed in the 1950s, and the integrated circuits of the early 1960s put whole
			gates on one chip, where they have been shrinking ever since.
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
			<a href="/logic-gate-symbols">symbol reference</a> has all seven in both the ANSI and IEC styles.
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

	.universal {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.universal li {
		margin-bottom: 0.4rem;
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

	.group {
		color: #999;
		font-size: 0.78rem;
		margin: -0.3rem 0 0.6rem;
	}

	.gate-body {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.gate-drawing {
		flex: 0 0 96px;
	}

	.gate .small {
		flex: 1 1 auto;
		font-size: 0.85rem;
	}

	.combined th,
	.combined td {
		text-align: center;
	}

	.combined thead a {
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		white-space: nowrap;
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
