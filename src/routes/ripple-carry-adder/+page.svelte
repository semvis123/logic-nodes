<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		fullAdderRows,
		rippleAdd,
		rippleCarryExpressions,
		lookaheadCarries,
		lookaheadExpressions,
		toOutputs,
		carryDepth,
		labelInputs,
		delayTable,
		type Bit
	} from '$lib/adders';
	import { buildCircuit, circuitStates } from '$lib/circuit';
	import { circuitToSvg } from '$lib/exportSvg';
	import { format } from '$lib/boolean';
	import { toolLink } from '$lib/urlState';

	const WIDTH = 4;

	// The full adder cell, from the rule every column applies.
	const cell = fullAdderRows();

	// A live addition: two 4 bit operands and a carry in, traced column by
	// column through the chain. The table and the diagram both follow it.
	let a = 11;
	let b = 6;
	let cin: Bit = 0;
	// An emptied number box binds null; treat anything unusable as 0.
	const clamp = (value: unknown) =>
		Number.isInteger(value) ? Math.min(Math.max(value as number, 0), (1 << WIDTH) - 1) : 0;
	$: sum = rippleAdd(clamp(a), clamp(b), WIDTH, cin);

	// The drawn 4 bit adder: four full adders sharing their carries, laid out by
	// the circuit generator. The inputs are relabelled from single letters to
	// A0..B3 and Cin, and the wires light up with the operands above.
	const rippleList = rippleCarryExpressions(WIDTH);
	const rippleOutputs = toOutputs(rippleList);
	const drawnRipple = labelInputs(buildCircuit(rippleOutputs));
	const rippleDepth = carryDepth(rippleList);
	// The states are looked up by the label the diagram prints, A0 to B3 and Cin.
	$: pins = Object.fromEntries([
		...sum.aBits.map((bit, i) => [`A${WIDTH - 1 - i}`, bit === 1]),
		...sum.bBits.map((bit, i) => [`B${WIDTH - 1 - i}`, bit === 1]),
		['Cin', cin === 1]
	]);
	$: rippleStates = circuitStates(drawnRipple, pins);
	$: rippleSvg = circuitToSvg(drawnRipple, { standard: 'ansi', palette: 'colour', states: rippleStates });

	// Carry lookahead: the equations, and the gate count they cost.
	const carries = lookaheadCarries(WIDTH);
	const lookaheadList = lookaheadExpressions(WIDTH);
	// One AND per product with more than one literal, one OR per carry, plus a
	// generate AND and a propagate XOR per column and a sum XOR per column.
	const lookaheadAnds = carries.reduce((total, carry) => total + carry.terms - 1, 0);
	const lookaheadGates = lookaheadAnds + carries.length + 3 * WIDTH;
	const rippleGates = 5 * WIDTH;
	const widestOr = Math.max(...carries.map((carry) => carry.terms));
	const delays = delayTable([4, 8, 16, 32, 64]);

	// The circuit generator link, so the whole thing can be exported or edited.
	const generatorLink = toolLink('/logic-circuit-generator', {
		expr: rippleList.map((o) => `${o.name} = ${o.expression}`).join('; ')
	});

	const faqs = [
		{
			q: 'What is a ripple carry adder?',
			a: 'A circuit that adds two binary numbers by chaining one full adder per bit, with the carry out of each column wired into the carry in of the next. It is called ripple carry because a carry generated in the lowest column has to pass through every column above it before the top bit is right, rippling along the chain the way a carry does in pencil and paper addition.'
		},
		{
			q: 'How does a 4-bit adder work?',
			a: 'Four full adders in a row. The first takes bit 0 of each number and the carry in, and produces bit 0 of the sum and a carry. That carry goes into the second full adder with bit 1 of each number, and so on. After the fourth column the sum is the four sum bits, and the last carry out is a fifth bit that says the answer did not fit in four.'
		},
		{
			q: 'What is the difference between a half adder and a full adder?',
			a: 'A half adder adds two bits and gives a sum and a carry out, but has no carry in, so it can only be the first column of an adder. A full adder adds three bits, the two operand bits and the carry from the column below, which is what lets it be chained. A full adder is two half adders with their carries ORed together.'
		},
		{
			q: 'Why is a ripple carry adder slow?',
			a: 'Because the carry into each column depends on the carry out of the one before, the worst case, adding 1 to a number that is all 1s, has to wait for the carry to pass through every column in turn. Each column adds about two gate delays, so a 32 bit ripple carry adder has a carry path around 64 gates long, and the whole adder is only as fast as that path.'
		},
		{
			q: 'What is a carry lookahead adder?',
			a: 'An adder that computes every carry directly from the inputs instead of waiting for the one below. Each column produces a generate signal, G = A AND B, meaning it makes a carry on its own, and a propagate signal, P = A XOR B, meaning it passes an incoming carry along. Every carry is then a sum of products of those signals, two gate levels deep after the level that makes G and P, however wide the word is, at the cost of many more gates and wider ones.'
		},
		{
			q: 'How do you subtract with an adder?',
			a: "Invert every bit of the number being subtracted and set the carry in to 1. That adds its two's complement, which is the same as subtracting it. One row of XOR gates with a shared control input does the inverting and doubles as the carry in, so a single adder serves for both operations."
		},
		{
			q: 'What does the carry out of the last column mean?',
			a: "For unsigned numbers it is the fifth bit of the answer: 1 means the true sum is too big for the width. For two's complement numbers it is discarded, and overflow is detected differently, by comparing the carry into the top bit with the carry out of it: if they differ, the result has the wrong sign."
		}
	];

	const page = {
		title: 'Ripple Carry Adder: 4-Bit Adder Circuit, Truth Table and Carry Lookahead',
		description:
			'How a ripple carry adder adds binary numbers: the full adder cell, a 4-bit adder built from four of them with a live circuit diagram and a column by column trace, why the carry makes it slow, and how a carry lookahead adder fixes that.',
		url: `${SITE}/ripple-carry-adder`,
		image: `${SITE}/og/ripple-carry-adder.png`,
		imageAlt: 'LogicGates.org: the ripple carry adder'
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
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Common circuits', item: `${SITE}/common-circuits` },
					{ '@type': 'ListItem', position: 3, name: 'Ripple carry adder' }
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
		{ href: '/common-circuits/full-adder', label: 'The full adder' },
		{ href: '/common-circuits/half-adder', label: 'The half adder' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/common-circuits', label: 'All the common circuits' },
		{ href: '/learn#full-adder', label: 'Build one in the simulator' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/common-circuits">Common circuits</a> <span aria-hidden="true">/</span>
			<span>Ripple carry adder</span>
		</nav>
		<h1>The ripple carry adder</h1>
		<p class="lede">
			Chain one full adder per bit, carry out into carry in, and you can add numbers of any width. It is the simplest
			adder there is, the one inside this site's calculator example, and the reason the carry lookahead adder was
			invented.
		</p>
	</section>

	<section id="full-adder">
		<h2>The cell: a full adder</h2>
		<p>
			Adding two binary numbers by hand, each column takes three bits: one from each number and a carry from the column
			to the right. It produces a sum bit and a carry to the left. A <a href="/common-circuits/full-adder">full adder</a
			>
			is that one column as a circuit, and its truth table is just the eight ways three bits can add up to 0, 1, 2 or 3:
		</p>
		<div class="layout">
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col" class="mono">A</th>
							<th scope="col" class="mono">B</th>
							<th scope="col" class="mono">Cin</th>
							<th scope="col" class="mono out">Sum</th>
							<th scope="col" class="mono">Cout</th>
							<th scope="col">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each cell as row}
							<tr>
								<td class={row.a ? 'bit-1' : 'bit-0'}>{row.a}</td>
								<td class={row.b ? 'bit-1' : 'bit-0'}>{row.b}</td>
								<td class={row.cin ? 'bit-1' : 'bit-0'}>{row.cin}</td>
								<td class="out {row.sum ? 'bit-1' : 'bit-0'}">{row.sum}</td>
								<td class={row.cout ? 'bit-1' : 'bit-0'}>{row.cout}</td>
								<td class="total">{row.a + row.b + row.cin}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="side">
				<p class="equation mono">Sum = A ⊻ B ⊻ Cin</p>
				<p class="equation mono">Cout = AB ∨ Cin(A ⊻ B)</p>
				<p class="side-note">
					The sum is 1 when an odd number of inputs are 1, which is XOR. The carry is 1 when at least two are, which is
					the majority function; writing it with the shared <span class="mono">A ⊻ B</span> is what lets a full adder be
					built from two <a href="/common-circuits/half-adder">half adders</a> and an OR gate.
				</p>
			</div>
		</div>
	</section>

	<section id="chain">
		<h2>Chaining them: the 4-bit adder</h2>
		<p>
			Put four full adders side by side. Bit 0 of each number goes into the first, with the carry in; its carry out goes
			into the second along with bit 1 of each number; and so on up the word. The four sum bits are the answer and the
			final carry out is a fifth bit, worth 16, for when the answer does not fit. Set the numbers below and follow the
			carries along the chain.
		</p>
		<form class="controls" on:submit|preventDefault>
			<label>
				A
				<input type="number" min="0" max={(1 << WIDTH) - 1} bind:value={a} />
			</label>
			<label>
				B
				<input type="number" min="0" max={(1 << WIDTH) - 1} bind:value={b} />
			</label>
			<label>
				Carry in
				<select bind:value={cin}>
					<option value={0}>0</option>
					<option value={1}>1</option>
				</select>
			</label>
		</form>
		<div class="table-wrap">
			<table class="data-table trace">
				<thead>
					<tr>
						<th scope="col" />
						<th scope="col" class="mono top">bit 4</th>
						{#each [...sum.columns].reverse() as column}
							<th scope="col" class="mono">bit {column.position}</th>
						{/each}
						<th scope="col">Value</th>
					</tr>
				</thead>
				<tbody>
					<tr class="carries">
						<th scope="row">carry</th>
						{#each [...sum.carries].reverse() as carry, i}
							<td
								class={carry ? 'bit-1' : 'bit-0'}
								class:top={i === 0}
								title={i === 0 ? 'carry out' : i === WIDTH ? 'carry in' : `carry into bit ${WIDTH - i}`}>{carry}</td
							>
						{/each}
						<td class="value">Cin = {cin}</td>
					</tr>
					<tr>
						<th scope="row" class="mono">A</th>
						<td />
						{#each sum.aBits as bit, i}
							<td class={bit ? 'bit-1' : 'bit-0'}>
								<button
									type="button"
									class="flip"
									on:click={() => (a = clamp(a) ^ (1 << (WIDTH - 1 - i)))}
									title="Flip this bit">{bit}</button
								>
							</td>
						{/each}
						<td class="value">{sum.a}</td>
					</tr>
					<tr>
						<th scope="row" class="mono">B</th>
						<td class="op">+</td>
						{#each sum.bBits as bit, i}
							<td class={bit ? 'bit-1' : 'bit-0'}>
								<button
									type="button"
									class="flip"
									on:click={() => (b = clamp(b) ^ (1 << (WIDTH - 1 - i)))}
									title="Flip this bit">{bit}</button
								>
							</td>
						{/each}
						<td class="value">+ {sum.b}{cin ? ' + 1' : ''}</td>
					</tr>
					<tr class="sum-row">
						<th scope="row" class="mono">Sum</th>
						<td class="top {sum.carryOut ? 'bit-1' : 'bit-0'}">{sum.carryOut}</td>
						{#each sum.sumBits as bit}
							<td class={bit ? 'bit-1' : 'bit-0'}>{bit}</td>
						{/each}
						<td class="value">= {sum.a + sum.b + cin}</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reading">
			{sum.a} + {sum.b}{cin ? ' + 1' : ''} = {sum.a + sum.b + cin}.
			{#if sum.carryOut}
				That needs five bits: the four sum bits read {sum.unsigned}, and the carry out of bit 3 is the fifth bit, worth
				16.
			{:else}
				It fits in four bits, so the carry out is 0.
			{/if}
			Each carry in the top row is produced by the column to its right and consumed by the column beneath it; the rightmost
			one is the carry in, the leftmost the carry out. Click a bit of A or B to flip it.
		</p>
	</section>

	<section id="circuit">
		<h2>The circuit</h2>
		<p>
			The same four full adders as gates, drawn by the <a href="/logic-circuit-generator">circuit generator</a> from the
			sum and carry expressions with each carry written in terms of the one before it. Each full adder is two XORs, two
			ANDs and an OR, {rippleGates} gates in all, and the wires follow the numbers set above: green is 1, red is 0.
		</p>
		<div
			class="canvas"
			role="img"
			aria-label={`4-bit ripple carry adder circuit diagram: four full adders, each carry out feeding the next carry in. ${rippleOutputs
				.map((o) => `${o.name} = ${format(o.ast, 'math')}`)
				.join('; ')}`}
		>
			{@html rippleSvg}
		</div>
		<p class="reducer">
			<a href={generatorLink}>Open it in the circuit generator</a> to export it as SVG, PNG, Verilog or VHDL, or
			<a href="/simulator#example:Calculator">see the calculator example</a>, which is a 4-bit adder with a display on
			the end.
		</p>
	</section>

	<section id="delay">
		<h2>Why the carry makes it slow</h2>
		<p>
			Nothing in column 3 can finish until it knows its carry in, which comes from column 2, which is waiting on column
			1, which is waiting on column 0. In the worst case, adding 1 to 1111, a single carry ripples through every column
			before the top sum bit and the carry out are right. Each column adds about two gate delays to that path, an AND
			and an OR, so the delay grows in step with the width. In the diagram above the longest path from an input to the
			carry out is {rippleDepth.ripple} two-input gates deep for {WIDTH} bits, and every extra bit adds two more.
		</p>
		<p>
			The other columns are not slow, only the carry chain is, and that observation is the whole idea behind the carry
			lookahead adder: compute every carry directly, so nothing waits.
		</p>
	</section>

	<section id="lookahead">
		<h2>Carry lookahead</h2>
		<p>
			Look at a single column. It <strong>generates</strong> a carry when both its inputs are 1, whatever comes in from
			below: <span class="mono">G = A ∧ B</span>. It <strong>propagates</strong> an incoming carry when exactly one
			input is 1: <span class="mono">P = A ⊻ B</span>. So each carry is
			<span class="mono">c<sub>i+1</sub> = G<sub>i</sub> ∨ P<sub>i</sub>c<sub>i</sub></span>, and substituting each
			carry into the next unrolls the chain into a sum of products that mentions only G, P and the carry in:
		</p>
		<ul class="equations mono">
			{#each carries as carry}
				<li>{@html carry.text.replace(/([GPc])(\d)/g, '$1<sub>$2</sub>')}</li>
			{/each}
		</ul>
		<p>
			Every one of those is an AND row feeding a single OR, two gate levels deep, after the one level that makes G and
			P. The carry into the top column no longer waits on the columns below it; it is computed at the same moment as all
			the others. That is the lookahead: three gate levels whatever the width, provided the gates can be made wide
			enough, instead of two more per bit.
		</p>
		<p>
			The cost is gates, and wider ones. For {WIDTH} bits the lookahead unit needs {lookaheadAnds} AND gates and
			{carries.length} OR gates, counting each product as one gate however many inputs it has, on top of the {WIDTH} generate
			ANDs, {WIDTH} propagate XORs and {WIDTH} sum XORs,
			{lookaheadGates} in all against {rippleGates} for the ripple version, and the last OR has {widestOr} inputs. Past four
			bits the fan-in gets out of hand, so real designs build 4-bit lookahead blocks and then look ahead across the blocks,
			which is what the classic 74182 lookahead generator chip does.
		</p>
		<div class="table-wrap">
			<table class="data-table compare">
				<thead>
					<tr>
						<th scope="col">Width</th>
						<th scope="col">Ripple carry: gate levels to the carry out</th>
						<th scope="col">Carry lookahead: gate levels</th>
					</tr>
				</thead>
				<tbody>
					{#each delays as row}
						<tr>
							<th scope="row" class="mono">{row.width} bits</th>
							<td>{row.ripple}</td>
							<td>{row.lookahead}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="legend">
			Two levels per column for ripple carry, the AND-OR of each carry stage, plus the XOR that feeds the first one;
			three for a flat lookahead unit with gates as wide as needed. A blocked lookahead adder sits between the two.
		</p>
		<p class="reducer">
			The lookahead carries are checked against the ripple carries on every one of the
			{(1 << WIDTH) * (1 << WIDTH) * 2} possible inputs by the test suite, so the equations above are the ones that work,
			not the ones that look right.
			<a
				href={toolLink('/logic-circuit-generator', {
					expr: lookaheadList.map((o) => `${o.name} = ${o.expression}`).join('; ')
				})}>Draw the lookahead adder</a
			> to see how much wider it is.
		</p>
	</section>

	<section id="subtract">
		<h2>Subtraction with the same adder</h2>
		<p>
			An adder subtracts if you feed it the <a href="/twos-complement">two's complement</a> of the second number: invert
			every bit of B and set the carry in to 1. A row of XOR gates does the inverting, with a control line as their second
			input that is also wired to the carry in, so one signal switches the circuit between A + B and A − B. That is why a
			processor's arithmetic unit has an adder and no separate subtractor.
		</p>
	</section>

	<section id="build">
		<h2>Build one</h2>
		<p>
			Make a full adder from two XORs, two ANDs and an OR, turn it into a custom node, and place four of them in a row.
			Wire each carry out to the next carry in, toggles to the inputs and displays to the sums, and add 1 to 1111 to
			watch the carry ripple.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			Step 4 of <a href="/learn#full-adder">the learning path</a> builds the full adder and points at the calculator
			example, which chains four of them and puts a <a href="/seven-segment-decoder">seven-segment display</a> on the end.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about adders</h2>
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

	.layout {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 16px;
		align-items: start;
		margin: 1rem 0;
	}

	@media (max-width: 700px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.out {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.total {
		color: #888;
		font-size: 0.85rem;
	}

	.equation {
		color: #8ede8e;
		font-size: 1.05rem;
		margin: 0 0 0.3rem;
	}

	.side-note {
		color: #bbb;
		font-size: 0.88rem;
		margin: 0.6rem 0 0;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		margin: 1rem 0;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: #bbb;
		font-size: 0.85rem;
	}

	.controls input {
		width: 5rem;
	}

	.trace th[scope='row'] {
		text-align: left;
		color: #ddd;
		white-space: nowrap;
	}

	.trace .value {
		color: #bbb;
		text-align: left;
		white-space: nowrap;
	}

	.trace .sum-row td,
	.trace .sum-row th {
		border-top: 1px solid rgba(255, 255, 255, 0.35);
	}

	.trace .carries td,
	.trace .carries th {
		font-size: 0.8rem;
		opacity: 0.85;
	}

	.trace .top {
		border-right: 1px dashed rgba(255, 255, 255, 0.25);
	}

	.trace .op {
		color: #888;
		text-align: center;
	}

	/* A bit you can flip: the button fills its cell and keeps the cell's colour. */
	.trace .flip {
		all: unset;
		cursor: pointer;
		display: block;
		width: 100%;
		text-align: center;
		color: inherit;
		font: inherit;
		border-radius: 2px;
	}

	.trace .flip:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.trace .flip:focus-visible {
		outline: 2px solid #5db65d;
	}

	.reading {
		color: #ddd;
	}

	.canvas {
		overflow-x: auto;
		background-color: #1d1e20;
		background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
		background-size: 22px 22px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem;
	}

	/* Twenty gates need room: on a phone the drawing scrolls sideways rather
	   than shrinking to a smear. */
	.canvas :global(svg) {
		display: block;
		width: 100%;
		min-width: 720px;
		height: auto;
	}

	.equations {
		list-style: none;
		padding: 0;
		color: #8ede8e;
	}

	.equations li {
		margin: 0.3rem 0;
	}

	.compare td {
		text-align: center;
	}

	.compare th[scope='row'] {
		text-align: left;
		color: #ddd;
	}

	.legend {
		color: #999;
		font-size: 0.85rem;
	}
</style>
