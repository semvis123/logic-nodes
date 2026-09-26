<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { add, subtract, multiply, divide, bitwise, signedDecimal, MAX_DIGITS, type Op } from '$lib/arithmetic';
	import Calculator from '$lib/Calculator.svelte';
	import ColumnWorking from '$lib/ColumnWorking.svelte';

	const defaults = { a: '101101', b: '11011', op: 'add' as Op };

	const examples: { label: string; a: string; b: string; op: Op; width?: number | null }[] = [
		{ label: 'Carries: 1111 + 1', a: '1111', b: '1', op: 'add', width: null },
		{ label: 'Borrows: 10000 − 1', a: '10000', b: '1', op: 'sub', width: null },
		{ label: '1011 × 101', a: '1011', b: '101', op: 'mul', width: null },
		{ label: '110101 ÷ 101', a: '110101', b: '101', op: 'div', width: null },
		{ label: 'Overflow in 8 bits', a: '11111111', b: '1', op: 'add', width: 8 },
		{ label: '3 − 5 in 8 bits', a: '11', b: '101', op: 'sub', width: 8 },
		{ label: 'AND mask', a: '10110110', b: '00001111', op: 'and', width: null },
		{ label: 'Shift left 3', a: '1011', b: '3', op: 'shl', width: null }
	];

	// The rules, generated: every combination of two bits and a carry in.
	const rules = [0, 1].flatMap((carry) =>
		[0, 1].flatMap((x) =>
			[0, 1].map((y) => {
				const total = x + y + carry;
				return { x, y, carry, sum: total % 2, carryOut: total >> 1, written: total.toString(2) };
			})
		)
	);

	// Worked examples, each drawn from the engine the calculator uses.
	const addition = add(0b1011n, 0b111n, 2);
	const subtraction = subtract(0b1100n, 0b101n, 2);
	const multiplication = multiply(0b1011n, 0b101n, 2);
	const division = divide(0b110101n, 0b101n, 2);
	const overflow = add(0b11001000n, 0b01100100n, 2, 8);
	const negative = subtract(0b11n, 0b101n, 2, 8);
	const tooNegative = subtract(0n, 0b11111111n, 2, 8);
	const masked = bitwise('and', 0b10110110n, 0b00001111n, 2, 8);
	const bin = (n: bigint) => n.toString(2);

	const faqs = [
		{
			q: 'How do you add binary numbers?',
			a: 'Line them up on the right and add column by column, as in decimal, but carry at 2 instead of 10. 0 + 0 = 0, 0 + 1 = 1, 1 + 1 = 10 (write 0, carry 1), and 1 + 1 + 1 = 11 (write 1, carry 1). The calculator above shows every carry above its column.'
		},
		{
			q: 'How do you subtract binary numbers?',
			a: "Column by column from the right. 1 − 0 = 1, 1 − 1 = 0 and 0 − 0 = 0. For 0 − 1, borrow from the next column to the left: the 0 becomes 10 (two), 10 − 1 = 1, and the column you borrowed from is one less. If the bottom number is bigger, subtract the other way round and put a minus sign on the answer. Computers instead add the two's complement, which gives the same bits."
		},
		{
			q: 'How do you multiply binary numbers?',
			a: "For every 1 in the second number, write the first number shifted left by that bit's position; for every 0, write nothing. Then add the rows. That is shift and add, and it is how simple processors multiply: 1011 × 101 is 1011 plus 1011 shifted two places, 1011 + 101100 = 110111."
		},
		{
			q: 'How do you divide binary numbers?',
			a: 'Long division, which is easier than in decimal because each quotient digit is 0 or 1: either the divisor fits into what you have so far, and you subtract it and write 1, or it does not, and you write 0 and bring down the next bit. What is left at the end is the remainder.'
		},
		{
			q: 'What is overflow?',
			a: "In a fixed number of bits, an answer that needs more bits than there are. Adding 1 to 11111111 in eight bits gives 00000000 with a carry out that has nowhere to go. For unsigned numbers that carry out is what signals overflow, and a processor records it in the carry flag (C or CF). For signed two's complement numbers overflow is when two numbers of the same sign add up to the opposite sign, and that is what the overflow flag (V or OF) records."
		},
		{
			q: 'How long can the numbers be?',
			a: `Up to ${MAX_DIGITS} bits each. With the width set to Unlimited, answers grow as long as they need to; with a fixed width of 8, 16, 32 or 64 bits the result wraps round the way a register does, and the calculator says when that happened.`
		},
		{
			q: 'Can it handle negative numbers?',
			a: "Inputs are unsigned. A subtraction that goes below zero shows the answer with a minus sign in Unlimited width, and in a fixed width it shows the wrapped bit pattern, which is the two's complement of the negative answer. The two's complement page explains how that encoding works."
		}
	];

	const page = {
		title: 'Binary Calculator: Add, Subtract, Multiply and Divide Binary',
		description:
			'Add, subtract, multiply and divide binary numbers with every carry, borrow and partial product shown, plus AND, OR, XOR, NOT and shifts at any width.',
		url: `${SITE}/binary-calculator`,
		image: `${SITE}/og/binary-calculator.png`,
		imageAlt: 'LogicGates.org: binary calculator with working'
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
					{ '@type': 'ListItem', position: 3, name: 'Binary calculator' }
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
		{ href: '/hex-calculator', label: 'Hex calculator' },
		{ href: '/ripple-carry-adder', label: 'The ripple carry adder' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary' },
		{ href: '/ieee-754-converter', label: 'IEEE 754 floating point' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Binary calculator</h1>
		<p class="lede">
			Add, subtract, multiply and divide binary numbers and see the working the way it is done on paper: carries above
			the columns, borrows, partial products and long division. AND, OR, XOR, NOT and shifts are here too, at any width.
		</p>
		<Calculator radix={2} {defaults} {examples} />
	</section>

	<section id="addition">
		<h2>Binary addition rules</h2>
		<p class="section-intro">
			Binary adds column by column exactly like decimal, but a column carries as soon as it reaches two. With a carry
			coming in from the right, each column adds up to three bits, so there are only eight cases:
		</p>
		<div class="table-wrap">
			<table class="data-table rules">
				<thead>
					<tr>
						<th scope="col">Carry in</th>
						<th scope="col">A</th>
						<th scope="col">B</th>
						<th scope="col">Total</th>
						<th scope="col">Write</th>
						<th scope="col">Carry out</th>
					</tr>
				</thead>
				<tbody>
					{#each rules as r}
						<tr>
							<td class={r.carry ? 'bit-1' : 'bit-0'}>{r.carry}</td>
							<td class={r.x ? 'bit-1' : 'bit-0'}>{r.x}</td>
							<td class={r.y ? 'bit-1' : 'bit-0'}>{r.y}</td>
							<td class="mono">{r.carry} + {r.x} + {r.y} = {r.written}</td>
							<td class={r.sum ? 'bit-1' : 'bit-0'}>{r.sum}</td>
							<td class={r.carryOut ? 'bit-1' : 'bit-0'}>{r.carryOut}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			The two to remember are <span class="mono">1 + 1 = 10</span> (write 0, carry 1) and
			<span class="mono">1 + 1 + 1 = 11</span> (write 1, carry 1). Here is {bin(addition.a)} + {bin(addition.b)}, which
			is
			{addition.a} + {addition.b} = {addition.result} in decimal:
		</p>
		<div class="worked">
			<ColumnWorking layout={addition.layout} label="Worked addition" />
			<ol class="explain">
				{#each addition.explanation as line}<li>{line}</li>{/each}
			</ol>
		</div>
		<p>
			That table is the truth table of a <a href="/common-circuits/full-adder">full adder</a>, and the column by column
			method is exactly what a <a href="/ripple-carry-adder">ripple carry adder</a> does in hardware: one full adder per
			column, each passing its carry to the next, which is why the carry has to ripple from right to left before the top
			bit is ready.
		</p>
	</section>

	<section id="subtraction">
		<h2>Binary subtraction with borrows</h2>
		<p>
			Subtract column by column from the right. <span class="mono">1 − 0 = 1</span>,
			<span class="mono">1 − 1 = 0</span> and <span class="mono">0 − 0 = 0</span>. The only hard case is
			<span class="mono">0 − 1</span>: borrow from the column to the left, which turns this column's 0 into 10 (two),
			and 10 − 1 = 1. The column that lent is then one less. Here is {bin(subtraction.a)} − {bin(subtraction.b)}, or {subtraction.a}
			− {subtraction.b} = {subtraction.result}:
		</p>
		<div class="worked">
			<ColumnWorking layout={subtraction.layout} label="Worked subtraction" />
			<p class="legend"><span class="key borrow">1</span> marks a column that lent 1 to the column on its right.</p>
			<ol class="explain">
				{#each subtraction.explanation as line}<li>{line}</li>{/each}
			</ol>
		</div>
		<p>
			When the second number is larger, work out the difference the other way round and put a minus sign in front. A
			processor does not do that: it adds the <a href="/twos-complement">two's complement</a> of the second number, so the
			same adder does both jobs, and the answer comes out as a two's complement pattern.
		</p>
	</section>

	<section id="multiplication">
		<h2>Multiplication is shift and add</h2>
		<p>
			Multiplying by a single bit is trivial: times 1 is the number itself, times 0 is nothing. So binary long
			multiplication is a list of shifted copies of the first number, one for each 1 in the second, added together. Here
			is {bin(multiplication.a)} × {bin(multiplication.b)}, or {multiplication.a} × {multiplication.b} = {multiplication.result}:
		</p>
		<div class="worked">
			<ColumnWorking layout={multiplication.layout} label="Worked multiplication" />
			<ol class="explain">
				{#each multiplication.explanation as line}<li>{line}</li>{/each}
			</ol>
		</div>
		<p>
			Shifting left by one place doubles a binary number, the way adding a 0 multiplies a decimal number by ten. The
			dimmed zeros above are those shifts.
		</p>
	</section>

	<section id="division">
		<h2>Binary long division</h2>
		<p>
			Division works like decimal long division, but each quotient digit is 0 or 1: either the divisor fits into the
			bits brought down so far or it does not. Here is {bin(division.a)} ÷ {bin(division.b)}, or {division.a} ÷ {division.b}
			=
			{division.result} remainder {division.remainder}:
		</p>
		<div class="table-wrap">
			<table class="data-table div-table">
				<thead>
					<tr>
						<th scope="col">Bring down</th>
						<th scope="col">Now</th>
						<th scope="col">{bin(division.b)} goes in</th>
						<th scope="col">Take away</th>
						<th scope="col">Left</th>
					</tr>
				</thead>
				<tbody>
					{#each division.division ?? [] as step}
						<tr>
							<td class="mono">{step.brought}</td>
							<td class="mono">{bin(step.current)}</td>
							<td class={step.digit ? 'bit-1' : 'bit-0'}>{step.digit}</td>
							<td class="mono">{bin(step.product)}</td>
							<td class="mono">{bin(step.remainder)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The quotient is the "goes in" column read downwards, {division.resultText}, and the remainder is what is left at
			the end, {bin(division.remainder ?? 0n)}.
		</p>
	</section>

	<section id="overflow">
		<h2>Overflow in a fixed width</h2>
		<p>
			On paper a sum can always grow a digit. In a register it cannot: an 8 bit register holds 8 bits, and a carry out
			of the top column is lost. Set the width to 8 bits and add {bin(overflow.a)} + {bin(overflow.b)} ({overflow.a} + {overflow.b}):
		</p>
		<div class="worked">
			<ColumnWorking layout={overflow.layout} label="Addition that overflows 8 bits" />
		</div>
		<p>
			The true answer, {overflow.a + overflow.b}, needs 9 bits. The register keeps the low 8, {overflow.resultText},
			which is {overflow.result}. Subtraction wraps the other way: in 8 bits, 11 − 101 (3 − 5) leaves
			<span class="mono">{negative.resultText}</span>, which is {negative.result} read as unsigned and {signedDecimal(
				negative.signedResult ?? 0n
			)} read as a signed
			<a href="/twos-complement">two's complement</a> number. The bits are the same; only the reading differs.
		</p>
		<p>
			The signed reading is only right while the true answer fits. Eight signed bits reach down to −128, so
			{bin(tooNegative.a)} − {bin(tooNegative.b)} ({tooNegative.a} − {tooNegative.b} = {signedDecimal(
				tooNegative.a - tooNegative.b
			)}) leaves <span class="mono">{tooNegative.resultText}</span>, which reads as {signedDecimal(
				tooNegative.signedResult ?? 0n
			)} either way. That is a signed overflow: the bits cannot hold the answer at all.
		</p>
	</section>

	<section id="bitwise">
		<h2>Bitwise operations</h2>
		<p>
			AND, OR and XOR work on each column separately, with no carries, following the <a href="/logic-gates"
				>logic gates</a
			> of the same names. AND with a mask keeps only the bits you want: here the mask 00001111 keeps the low four bits.
		</p>
		<div class="worked">
			<ColumnWorking layout={masked.layout} label="AND with a mask" />
		</div>
		<p>
			NOT flips every bit, so its answer depends on how many bits there are: pick a width, or the calculator uses the
			number of digits you typed. A left shift by n multiplies by 2<sup>n</sup>, and a right shift divides by 2<sup
				>n</sup
			> and drops the remainder.
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

	.rules td,
	.rules th {
		text-align: center;
		white-space: nowrap;
		padding-left: 0.55rem;
		padding-right: 0.55rem;
	}

	.worked {
		max-width: 620px;
		margin: 0 0 1rem;
	}

	.explain {
		color: #ccc;
		font-size: 0.88rem;
		padding-left: 1.4rem;
		margin: 0.7rem 0 0;
	}

	.explain li {
		margin-bottom: 0.2rem;
	}

	.legend {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0.4rem 0 0;
	}

	.key {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 700;
		margin-right: 0.3rem;
	}

	.key.borrow {
		color: #ff9a9a;
	}

	.div-table td {
		text-align: center;
		white-space: nowrap;
	}
</style>
