<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { add, subtract, multiply, divide, additionTable, MAX_DIGITS, type Op } from '$lib/arithmetic';
	import { digitChar } from '$lib/radix';
	import Calculator from '$lib/Calculator.svelte';
	import ColumnWorking from '$lib/ColumnWorking.svelte';

	const defaults = { a: '3AF7', b: '1C9D', op: 'add' as Op };

	const examples: { label: string; a: string; b: string; op: Op; width?: number | null }[] = [
		{ label: 'FF + 1', a: 'FF', b: '1', op: 'add', width: null },
		{ label: '1000 − 1', a: '1000', b: '1', op: 'sub', width: null },
		{ label: '2F × 1B', a: '2F', b: '1B', op: 'mul', width: null },
		{ label: 'FFFF ÷ 3', a: 'FFFF', b: '3', op: 'div', width: null },
		{ label: 'Overflow in 16 bits', a: 'FFFF', b: '2', op: 'add', width: 16 },
		{ label: '10 − 20 in 32 bits', a: '10', b: '20', op: 'sub', width: 32 },
		{ label: 'Mask with FF00', a: 'BEEF', b: 'FF00', op: 'and', width: 16 },
		{ label: 'XOR', a: 'F0F0', b: '3C3C', op: 'xor', width: 16 }
	];

	const table = additionTable(16);
	const digits = Array.from({ length: 16 }, (_, i) => digitChar(i));

	const addition = add(0x2b7n, 0x5e9n, 16);
	const subtraction = subtract(0x4a2n, 0x1b7n, 16);
	const multiplication = multiply(0x2fn, 0x1bn, 16);
	const division = divide(0xfacen, 0x1bn, 16);
	const wrapped = subtract(0x10n, 0x20n, 16, 32);
	const hex = (n: bigint) => n.toString(16).toUpperCase();

	const faqs = [
		{
			q: 'How do you add hex numbers?',
			a: 'Line them up on the right and add column by column. Convert letters to their values (A = 10 up to F = 15), add, and if the column total is 16 or more, subtract 16, write that digit and carry 1. B + 7 is 11 + 7 = 18, which is 16 + 2, so write 2 and carry 1.'
		},
		{
			q: 'How do you subtract hex numbers?',
			a: 'Column by column from the right. When the top digit is smaller, borrow 16 from the column to the left: 2 − 7 becomes 16 + 2 − 7 = 11, which is B, and the next column along is one less. If the second number is bigger, subtract the other way round and put a minus sign on the answer.'
		},
		{
			q: 'What is FF + 1 in hex?',
			a: 'FF + 1 = 100. F + 1 is 16, which writes 0 and carries 1; the next F plus that carry is 16 again, and the final carry becomes a new digit. It is the same as 255 + 1 = 256, and in an 8 bit register it wraps to 00, which is overflow.'
		},
		{
			q: 'How do you multiply hex numbers?',
			a: 'Multiply the first number by each digit of the second, as in decimal long multiplication, shifting each row one place left, then add the rows. For single digit products it helps to go through decimal: B × 7 = 11 × 7 = 77 = 4 × 16 + 13, which is 4D. The calculator shows each row with its decimal check.'
		},
		{
			q: 'Is hex arithmetic the same as binary arithmetic?',
			a: 'Yes. One hex digit is four bits, so adding hex is adding binary four bits at a time, and a hex carry is the carry out of the top bit of each nibble. The answers are the same bits written more compactly, which is why the bitwise operations here write the hex out in binary.'
		},
		{
			q: 'How long can the numbers be?',
			a: `Up to ${MAX_DIGITS} hex digits (256 bits) each, worked exactly with no rounding. Choose a width of 8, 16, 32 or 64 bits to see what a register of that size would do: results wrap round, and the calculator flags overflow.`
		}
	];

	const page = {
		title: 'Hex Calculator: Add, Subtract, Multiply and Divide Hex',
		description:
			'A hexadecimal calculator that shows its working: carries at 16, borrows, partial products and long division, with a full hex addition table.',
		url: `${SITE}/hex-calculator`,
		image: `${SITE}/og/hex-calculator.png`,
		imageAlt: 'LogicGates.org: hex calculator with working'
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
					{ '@type': 'ListItem', position: 3, name: 'Hex calculator' }
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
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/hex-to-decimal', label: 'Hex to decimal converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/ieee-754-converter', label: 'IEEE 754 floating point' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Hex calculator</h1>
		<p class="lede">
			Add, subtract, multiply and divide hexadecimal numbers, with the carries, borrows, partial products and long
			division laid out column by column. Bitwise AND, OR, XOR, NOT and shifts too, at any width.
		</p>
		<Calculator radix={16} {defaults} {examples} />
	</section>

	<section id="addition">
		<h2>Adding hex: carry at 16</h2>
		<p>
			Hex adds like decimal, except a column only carries when it reaches sixteen. The easy way to add two hex digits is
			through decimal: B + 7 is 11 + 7 = 18, and 18 is one 16 and 2 more, so write 2 and carry 1. Here is {hex(
				addition.a
			)} + {hex(addition.b)}, which is {addition.a} + {addition.b} = {addition.result} in decimal:
		</p>
		<div class="worked">
			<ColumnWorking layout={addition.layout} label="Worked hex addition" />
			<ol class="explain">
				{#each addition.explanation as line}<li>{line}</li>{/each}
			</ol>
		</div>
	</section>

	<section id="table">
		<h2>The hex addition table</h2>
		<p class="section-intro">
			Every sum of two hex digits. Two digit answers carry: the 1 in front is the carry into the next column.
		</p>
		<div class="table-scroll" tabindex="0" role="region" aria-label="Hex addition table">
			<table class="data-table add-table">
				<thead>
					<tr>
						<th scope="col" class="corner">+</th>
						{#each digits as d}<th scope="col">{d}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each table as row, i}
						<tr>
							<th scope="row">{digits[i]}</th>
							{#each row as cell}
								<td class:carry={cell.length > 1}>{cell}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="subtraction">
		<h2>Subtracting hex: borrow 16</h2>
		<p>
			When a column's top digit is smaller than the one below, borrow from the next column to the left. The borrow is
			worth 16 in this column, and the column that lent is one less. Here is {hex(subtraction.a)} − {hex(
				subtraction.b
			)}, or
			{subtraction.a} − {subtraction.b} = {subtraction.result}:
		</p>
		<div class="worked">
			<ColumnWorking layout={subtraction.layout} label="Worked hex subtraction" />
			<p class="legend"><span class="key">1</span> marks a column that lent 16 to the column on its right.</p>
			<ol class="explain">
				{#each subtraction.explanation as line}<li>{line}</li>{/each}
			</ol>
		</div>
		<p>
			A result below zero is shown with a minus sign. In a fixed width it wraps round instead, and the digits left are
			the
			<a href="/twos-complement">two's complement</a> of the negative answer: 10 − 20 in 32 bits is {wrapped.resultText},
			which is −16 in decimal.
		</p>
	</section>

	<section id="multiplication">
		<h2>Multiplying hex</h2>
		<p>
			Long multiplication works as in decimal: one row per digit of the second number, each shifted one place further
			left, then add the rows. Here is {hex(multiplication.a)} × {hex(multiplication.b)}, or {multiplication.a} × {multiplication.b}
			= {multiplication.result}:
		</p>
		<div class="worked">
			<ColumnWorking layout={multiplication.layout} label="Worked hex multiplication" />
			<ol class="explain">
				{#each multiplication.explanation as line}<li>{line}</li>{/each}
			</ol>
		</div>
	</section>

	<section id="division">
		<h2>Dividing hex</h2>
		<p>
			Long division brings down one hex digit at a time and asks how many times the divisor fits, which is a number from
			0 to F. Here is {hex(division.a)} ÷ {hex(division.b)}, or {division.a} ÷ {division.b} = {division.result} remainder
			{division.remainder}:
		</p>
		<ol class="explain worked">
			{#each division.explanation as line}<li>{line}</li>{/each}
		</ol>
		<p class="reducer">
			Quotient {division.resultText}, remainder {hex(division.remainder ?? 0n)}. To check a step by hand, convert to
			decimal with the <a href="/hex-to-decimal">hex to decimal converter</a>.
		</p>
	</section>

	<section id="binary">
		<h2>Hex arithmetic is binary arithmetic</h2>
		<p>
			A hex digit is four bits, so a hex sum is a binary sum read four bits at a time, and a hex carry is the carry out
			of the top bit of a nibble. That is why hex is the notation for registers, memory addresses and masks: the
			<a href="/binary-calculator">binary calculator</a> gives the same bits, and the
			<a href="/hex-to-binary">hex to binary converter</a> shows how each digit maps to its four bits.
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
		color: #ff9a9a;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 700;
		margin-right: 0.3rem;
	}

	.table-scroll {
		overflow-x: auto;
		max-width: 100%;
	}

	.add-table th,
	.add-table td {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		text-align: center;
		padding: 0.25rem 0.4rem;
		font-size: 0.85rem;
	}

	.add-table tbody th {
		color: #fff;
		font-weight: 600;
		background-color: #101012;
	}

	.add-table td.carry {
		color: #f0c060;
	}

	/* Small enough on a phone that all sixteen columns fit without scrolling. */
	@media (max-width: 560px) {
		.add-table th,
		.add-table td {
			padding: 0.2rem 0.18rem;
			font-size: 0.72rem;
		}
	}
</style>
