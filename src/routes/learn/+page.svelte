<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseExpression, truthTable, evaluate } from '$lib/boolean';

	// Every table on this page is computed, not typed out, so none of it can be
	// quietly wrong.
	const halfAdder = {
		sum: truthTable(parseExpression('a ^ b')),
		carry: truthTable(parseExpression('a & b'))
	};
	const fullAdderSum = parseExpression('a ^ b ^ c');
	const fullAdderCarry = parseExpression('(a & b) | (c & (a ^ b))');
	const fullAdder = { sum: truthTable(fullAdderSum), carry: truthTable(fullAdderCarry) };

	// Live full adder: c is the carry in, matching the table's variable order.
	let a = false;
	let b = false;
	let c = false;
	$: values = { a, b, c };
	$: liveSum = evaluate(fullAdderSum, values);
	$: liveCarry = evaluate(fullAdderCarry, values);
	$: liveRow = (a ? 4 : 0) + (b ? 2 : 0) + (c ? 1 : 0);

	const steps = [
		{ id: 'signals', title: 'One wire, two values' },
		{ id: 'gates', title: 'The six gates' },
		{ id: 'half-adder', title: 'Your first real circuit: the half adder' },
		{ id: 'full-adder', title: 'Carrying: the full adder' },
		{ id: 'memory', title: 'Making it remember: the SR latch' },
		{ id: 'time', title: 'Clocks, delays and edges' },
		{ id: 'display', title: 'Showing a number: the seven segment decoder' },
		{ id: 'smaller', title: 'Making it smaller' }
	];

	const faqs = [
		{
			q: 'Do I need any electronics knowledge to start?',
			a: 'No. Everything here works at the level of 1s and 0s: a wire is either high or low, and gates turn some highs and lows into others. You never need to think about volts, resistors or transistors to build a working adder.'
		},
		{
			q: 'How long does this take?',
			a: 'The half adder takes about ten minutes. Getting as far as a four bit adder that displays a number takes an afternoon. The pieces stack, so each step is only a little harder than the one before.'
		},
		{
			q: 'What order should I learn things in?',
			a: 'Gates, then a half adder, then a full adder, then memory with a latch, then clocks and edge detection. That order matters: each circuit is built out of the previous one, and latches are the first point where feedback and timing start to matter.'
		},
		{
			q: 'What is the difference between combinational and sequential logic?',
			a: 'Combinational logic depends only on the inputs right now, so the same inputs always give the same output; gates and adders are combinational. Sequential logic feeds outputs back into inputs so the circuit has state and its output depends on history as well. A latch is the smallest example.'
		}
	];

	const page = {
		title: 'Learn Digital Logic: From One Gate to a Working Adder',
		description:
			'A hands-on path through digital logic: gates, half and full adders, latches, clocks and decoders, each built and run in a free browser simulator.',
		url: `${SITE}/learn`,
		image: `${SITE}/og/learn.png`,
		imageAlt: 'Logic Nodes: learn'
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
				'@type': 'Course',
				'@id': `${page.url}#course`,
				name: 'Learn digital logic with a simulator',
				description:
					'A free, self-paced path through digital logic: gates, adders, latches, clocks and decoders, built in a browser based logic gate simulator.',
				url: page.url,
				inLanguage: 'en',
				...modifiedFields(page.url),
				isAccessibleForFree: true,
				provider: { '@id': 'https://kriyak.com/#person' },
				hasCourseInstance: {
					'@type': 'CourseInstance',
					courseMode: 'online',
					courseWorkload: 'PT3H'
				},
				syllabusSections: steps.map((step, i) => ({
					'@type': 'Syllabus',
					position: i + 1,
					name: step.title,
					url: `${page.url}#${step.id}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Learn digital logic' }
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
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/practice', label: 'Practice questions' },
		{ href: '/worksheet', label: 'Printable worksheets' }
	]}
>
	<section class="intro">
		<h1>Learn digital logic</h1>
		<p class="lede">
			Eight steps from a single wire to a circuit that adds two numbers and shows the answer. Every step is something
			you build and run yourself, not something you read about.
		</p>
		<ol class="toc">
			{#each steps as step, i}
				<li><a href="#{step.id}"><span class="num">{i + 1}</span> {step.title}</a></li>
			{/each}
		</ol>
	</section>

	<section id="signals">
		<h2>1. One wire, two values</h2>
		<p>
			A wire in a digital circuit carries one of two things: high or low, 1 or 0, on or off. That is the whole
			vocabulary. Everything else is a way of turning some 1s and 0s into other 1s and 0s.
		</p>
		<p>
			In the simulator a wire carrying a 1 is drawn <span class="dot high" /> green and a 0
			<span class="dot low" /> red, so you can see the state of a whole circuit at a glance. Drop a toggle and a display
			onto the canvas, wire them together, and click the toggle: you have built the simplest possible circuit, a wire.
		</p>
		<p class="try">
			<strong>Try it:</strong>
			<a href="/simulator#example:Introduction">open the introduction circuit</a>, which is exactly this with a few
			gates added.
		</p>
	</section>

	<section id="gates">
		<h2>2. The six gates</h2>
		<p>
			A gate takes one or more of those signals and produces a new one. There are six worth knowing: <a
				href="/logic-gates/and">AND</a
			>
			is high when both inputs are high,
			<a href="/logic-gates/or">OR</a> when at least one is,
			<a href="/logic-gates/not">NOT</a> flips its single input, and
			<a href="/logic-gates/xor">XOR</a> is high when the two inputs differ.
			<a href="/logic-gates/nand">NAND</a> and <a href="/logic-gates/nor">NOR</a> are AND and OR with the output inverted.
		</p>
		<p>
			That is the entire alphabet. NAND on its own is enough to build the other five, so in a sense there is only one
			gate, but the six are what you will actually reach for.
		</p>
		<p class="try">
			<strong>Try it:</strong> place one of each from the Logic menu, wire two toggles into them, and work through all
			four input combinations until the truth tables feel obvious.
			<a href="/logic-gates">The gate reference</a> has all six tables side by side.
		</p>
	</section>

	<section id="half-adder">
		<h2>3. Your first real circuit: the half adder</h2>
		<p>
			Add two single bits and there are only four cases. 0+0 is 0. 0+1 and 1+0 are both 1. And 1+1 is 2, which does not
			fit in one bit, so it is written as 0 with a carry of 1. Look at the two output columns separately and each one is
			a gate you already know.
		</p>
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col" class="mono">a</th>
					<th scope="col" class="mono">b</th>
					<th scope="col" class="mono">sum</th>
					<th scope="col" class="mono">carry</th>
				</tr>
			</thead>
			<tbody>
				{#each halfAdder.sum.rows as sum, row}
					<tr>
						<td class={row & 2 ? 'bit-1' : 'bit-0'}>{row & 2 ? 1 : 0}</td>
						<td class={row & 1 ? 'bit-1' : 'bit-0'}>{row & 1 ? 1 : 0}</td>
						<td class={sum ? 'bit-1' : 'bit-0'}>{sum ? 1 : 0}</td>
						<td class={halfAdder.carry.rows[row] ? 'bit-1' : 'bit-0'}>
							{halfAdder.carry.rows[row] ? 1 : 0}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p>
			The sum column is 0, 1, 1, 0: that is XOR. The carry column is 0, 0, 0, 1: that is AND. So a half adder is one <a
				href="/logic-gates/xor">XOR</a
			>
			and one
			<a href="/logic-gates/and">AND</a>, both fed from the same two inputs. Two gates, and you can add.
		</p>
		<p class="try">
			<strong>Try it:</strong> two toggles, an XOR, an AND, two displays. When it works, select the whole thing and use File
			then Create node to turn it into a reusable chip called "half adder". You will want it in the next step.
		</p>
	</section>

	<section id="full-adder">
		<h2>4. Carrying: the full adder</h2>
		<p>
			A half adder cannot be chained, because it has nowhere to put a carry coming in from the column to its right. A
			full adder fixes that with a third input. The sum is now
			<span class="mono">a ⊻ b ⊻ c</span>, and the carry out is high whenever at least two of the three inputs are high.
		</p>

		<div class="card live">
			<p class="live-title">A live full adder. Click the inputs.</p>
			<div class="toggles">
				<button type="button" class="toggle" class:on={a} aria-pressed={a} on:click={() => (a = !a)}>
					a <span class="val">{a ? 1 : 0}</span>
				</button>
				<button type="button" class="toggle" class:on={b} aria-pressed={b} on:click={() => (b = !b)}>
					b <span class="val">{b ? 1 : 0}</span>
				</button>
				<button type="button" class="toggle" class:on={c} aria-pressed={c} on:click={() => (c = !c)}>
					carry in <span class="val">{c ? 1 : 0}</span>
				</button>
				<span class="arrow" aria-hidden="true">→</span>
				<span class="out" class:on={liveSum}>sum <span class="val">{liveSum ? 1 : 0}</span></span>
				<span class="out" class:on={liveCarry}>
					carry out <span class="val">{liveCarry ? 1 : 0}</span>
				</span>
			</div>
			<table class="data-table live-table">
				<thead>
					<tr>
						<th scope="col" class="mono">a</th>
						<th scope="col" class="mono">b</th>
						<th scope="col" class="mono">c<sub>in</sub></th>
						<th scope="col" class="mono">sum</th>
						<th scope="col" class="mono">c<sub>out</sub></th>
					</tr>
				</thead>
				<tbody>
					{#each fullAdder.sum.rows as sum, row}
						<tr class:current={row === liveRow}>
							<td class={row & 4 ? 'bit-1' : 'bit-0'}>{row & 4 ? 1 : 0}</td>
							<td class={row & 2 ? 'bit-1' : 'bit-0'}>{row & 2 ? 1 : 0}</td>
							<td class={row & 1 ? 'bit-1' : 'bit-0'}>{row & 1 ? 1 : 0}</td>
							<td class={sum ? 'bit-1' : 'bit-0'}>{sum ? 1 : 0}</td>
							<td class={fullAdder.carry.rows[row] ? 'bit-1' : 'bit-0'}>
								{fullAdder.carry.rows[row] ? 1 : 0}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p>
			The neat way to build it is from two half adders: the first adds a and b, the second adds that sum to the carry
			in, and an OR gate combines the two carries. If you made a half adder chip in the last step, this is three nodes.
		</p>
		<p>
			Chain four full adders, each one's carry out feeding the next one's carry in, and you can add two four bit
			numbers. That is a ripple carry adder, and it is the arithmetic unit at the heart of the calculator example.
		</p>
		<p class="try">
			<strong>Try it:</strong> build the full adder from two half adder chips and an OR, then look at
			<a href="/simulator#example:Calculator">the four bit calculator</a> to see four of them in a row.
		</p>
	</section>

	<section id="memory">
		<h2>5. Making it remember: the SR latch</h2>
		<p>
			Everything so far has been combinational: the output depends only on what the inputs are doing right now. Feed an
			output back into an input and something new happens. The circuit gets state.
		</p>
		<p>
			Take two <a href="/logic-gates/nor">NOR</a> gates and cross-couple them: the output of each one goes into an input
			of the other. The two remaining inputs are set and reset. Raise set briefly and the output goes high and stays high
			after set drops again. Raise reset and it goes back to low, and stays. The circuit remembers which one you touched
			last, and that is a single bit of memory made of two gates.
		</p>
		<p>
			It also introduces a real hazard: raise both inputs at once and the latch has no valid state. Watching that happen
			in a simulator, where you can single out the feedback path, is worth more than reading about it.
		</p>
		<p class="try">
			<strong>Try it:</strong> two NOR gates, two toggles, two displays, and wire each gate's output back into the other's
			input. Then try both inputs high and see what happens.
		</p>
	</section>

	<section id="time">
		<h2>6. Clocks, delays and edges</h2>
		<p>
			Once a circuit has memory it needs a sense of when. The Misc menu has an Interval node that flips between high and
			low on its own, which is a clock, and a Delay node that passes its input through a set number of milliseconds
			later.
		</p>
		<p>
			Those two make edge detection possible. AND a signal with the inverted, delayed copy of itself and the output is
			high only for the brief moment when the signal has gone high but the delayed copy has not caught up. That is a
			rising edge detector: it fires once per transition rather than staying on the whole time a signal is high, which
			is what you want for counting events or triggering a step.
		</p>
		<p class="try">
			<strong>Try it:</strong>
			<a href="/simulator#example:Rising%20edge%20detector">the rising edge detector</a> and
			<a href="/simulator#example:Falling%20edge%20detector">its falling counterpart</a> are both built in. Feed one from
			an Interval node and into a Counter.
		</p>
	</section>

	<section id="display">
		<h2>7. Showing a number: the seven segment decoder</h2>
		<p>
			A four bit number is fine for a machine and useless for a person. A seven segment decoder takes those four bits
			and drives the seven bars of a digit, so 1001 becomes a readable 9.
		</p>
		<p>
			There is no clever trick here, which is exactly why it is a good exercise: each of the seven segments is its own
			boolean function of the four input bits, worked out from a truth table that says which digits light which bars.
			Build the table, simplify each column, and you have seven small circuits sharing four inputs.
		</p>
		<p class="try">
			<strong>Try it:</strong> open <a href="/simulator#example:7%20Segment-display">the seven segment decoder</a>
			and trace one segment back from the display to the switches. Then try deriving segment "a" yourself with the
			<a href="/truth-table-generator">truth table generator</a>.
		</p>
	</section>

	<section id="smaller">
		<h2>8. Making it smaller</h2>
		<p>
			A circuit built straight from a truth table works, but it is usually bigger than it needs to be. Three tools turn
			a working circuit into a smaller one, and they are all the same idea in different clothing.
		</p>
		<ul class="tool-list">
			<li>
				<a href="/truth-table-generator">Truth tables</a> tell you exactly what a circuit does, in full. Start here when
				a circuit misbehaves: compare the table you wanted with the table you built.
			</li>
			<li>
				<a href="/boolean-algebra-calculator">Boolean algebra</a> rewrites the expression using laws like De Morgan's and
				absorption. Good for proving two circuits are the same.
			</li>
			<li>
				<a href="/karnaugh-map-solver">Karnaugh maps</a> fold the truth table into a grid where the simplification is visible
				as rectangles. Fastest way to minimise up to four variables by hand.
			</li>
			<li>
				<a href="/sum-of-products-calculator">Sum of products</a> shows all four canonical and minimal forms at once, which
				is the language exam questions are usually written in.
			</li>
		</ul>
		<p class="reducer">
			Two references worth keeping open alongside these: the
			<a href="/common-circuits">common circuits</a> page, which gives the standard building blocks with their truth
			tables, and
			<a href="/combinational-vs-sequential">combinational vs sequential logic</a>, which explains what changes once a
			circuit has memory.
		</p>
		<p>
			The simulator closes the loop: press <kbd>ctrl</kbd>+<kbd>E</kbd> with a simplified expression and it builds the smaller
			circuit for you, so you can check the new version against the old one.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
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

	.toc {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 6px;
		counter-reset: step;
	}

	.toc a {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem 0.8rem;
		text-decoration: none;
		color: #ddd;
		font-size: 0.9rem;
	}

	.toc a:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.num {
		color: #5db65d;
		font: 600 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.try {
		border-left: 2px solid #5db65d;
		padding-left: 0.9rem;
		color: #bbb;
		font-size: 0.93rem;
	}

	.try strong {
		color: #fff;
	}

	.dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.5);
	}

	.dot.high {
		background-color: #5db65d;
	}

	.dot.low {
		background-color: #f23;
	}

	.live {
		padding: 1rem 1.1rem 1.1rem;
		margin: 1.2rem 0;
	}

	.live-title {
		margin: 0 0 0.8rem;
		color: #ddd;
		font-size: 0.9rem;
	}

	.toggles {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 1rem;
	}

	.toggle {
		background-color: #40191c;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.toggle.on {
		background-color: #372;
	}

	.out {
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		color: #fff;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
	}

	.out.on {
		background-color: #372;
	}

	.val {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 600;
		margin-left: 0.3rem;
	}

	.arrow {
		color: #949494;
		margin: 0 0.2rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle {
			transition: none;
		}
	}

	.live-table {
		width: 100%;
	}

	.live-table th,
	.live-table td {
		text-align: center;
	}

	.live-table tr.current td {
		background-color: rgba(51, 119, 34, 0.28);
	}

	.tool-list {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.tool-list li {
		margin-bottom: 0.7rem;
	}
</style>
