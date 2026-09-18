<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { stages } from '$lib/roadmap';

	const faqs = [
		{
			q: 'Where should a complete beginner start?',
			a: 'At stage 1, with bits and binary numbers, then the seven gates. Nothing on the site needs more than that to begin. If you can already count in binary, start at stage 2, and in general start at the first checkpoint you cannot pass.'
		},
		{
			q: 'What order should I learn digital logic in?',
			a: 'Bits, then gates and truth tables, then boolean algebra, then simplification with Karnaugh maps, then the combinational circuits built from them: adders, multiplexers and decoders. Only then memory, with the SR latch and flip-flops, and finally counters, shift registers and state machines. Each stage uses only what came before it.'
		},
		{
			q: 'Do I need maths or electronics first?',
			a: 'No. Everything here works with 1s and 0s and a handful of rules. You never need volts, resistors or transistors, and the only arithmetic is counting. The boolean algebra stage looks like maths but there are fewer laws than in ordinary algebra, and every one of them is proved on the page with a truth table.'
		},
		{
			q: 'How long does it take?',
			a: 'The hands-on part of stage 5, a four-bit adder that displays a number, takes an afternoon once the gates are familiar. The stages before it are an evening or two each. The stages after it are slower because timing is new. A few weeks of evenings is realistic for the whole path.'
		},
		{
			q: 'How is this different from the Learn page?',
			a: 'The Learn page is one continuous build: eight steps in the simulator from a single wire to an adder with a display. This roadmap is the map around it. It explains each idea in plain words first, points into the Learn page at the right moments, and covers the pages the build does not reach, such as boolean algebra, minimisation, flip-flops, counters and state machines.'
		}
	];

	const page = {
		title: 'Digital Logic Roadmap: Learn It From Zero, in Order',
		description:
			'A learning roadmap for digital logic: eight stages from bits and gates through boolean algebra, Karnaugh maps, adders, latches and flip-flops to counters and state machines, each explained in plain words with the pages to read and a checkpoint.',
		url: `${SITE}/roadmap`,
		image: `${SITE}/og/roadmap.png`,
		imageAlt: 'LogicGates.org: digital logic roadmap'
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
				hasPart: { '@id': `${page.url}#stages` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'ItemList',
				'@id': `${page.url}#stages`,
				name: 'Digital logic learning roadmap',
				description: 'The eight stages, in the order to learn them.',
				itemListOrder: 'https://schema.org/ItemListOrderAscending',
				numberOfItems: stages.length,
				itemListElement: stages.map((stage, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: stage.title,
					url: `${page.url}#${stage.id}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Learn digital logic', item: `${SITE}/learn` },
					{ '@type': 'ListItem', position: 3, name: 'Roadmap' }
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
		{ href: '/learn', label: 'The hands-on path' },
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/glossary', label: 'Glossary' },
		{ href: '/practice', label: 'Practice questions' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/learn">Learn</a> <span aria-hidden="true">/</span>
			<span>Roadmap</span>
		</nav>
		<h1>Digital logic roadmap</h1>
		<p class="lede">
			Every page on this site, in the order to learn it. Eight stages from a single bit to a state machine, each
			explained in plain words first, then the pages to read and a checkpoint to pass before moving on. Start at the
			top: nothing here needs anything that comes later.
		</p>
		<ol class="toc">
			{#each stages as stage, i}
				<li><a href="#{stage.id}"><span class="num">{i + 1}</span> {stage.title}</a></li>
			{/each}
		</ol>
	</section>

	<section id="how">
		<h2>How to use it</h2>
		<p>
			Read the few sentences at the top of a stage first. They say what the idea is and why it exists, without any
			notation, so the pages that follow have something to hang on. Then work through the pages in the order listed; the
			note beside each one says what to get from it. The last line of every stage is a checkpoint. If you can do what it
			says, move on. If not, the pages above it are where the answer is.
		</p>
		<p>
			If you already know some of this, skip to the first checkpoint you cannot pass. The <a href="/learn">Learn page</a
			>
			is a separate hands-on build in the simulator, and the roadmap points into it at the right moments rather than repeating
			it.
		</p>
	</section>

	{#each stages as stage, i}
		<section class="stage" id={stage.id}>
			<h2>
				<span class="num" aria-hidden="true">{i + 1}</span> <span class="visually-hidden">Stage {i + 1}:</span>
				{stage.title}
			</h2>
			{#each stage.summary as paragraph}
				<p>{paragraph}</p>
			{/each}
			<h3>Read, in this order</h3>
			<ol class="pages">
				{#each stage.pages as link}
					<li>
						<a href={link.href}>{link.label}</a>
						<span class="why">{link.why}</span>
					</li>
				{/each}
			</ol>
			<p class="checkpoint"><strong>Move on when:</strong> {stage.checkpoint}</p>
		</section>
	{/each}

	<section class="faq">
		<h2>Questions about learning digital logic</h2>
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

	.toc {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 6px;
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

	/* The stage number is read out as "Stage n:" instead of a bare digit. */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.stage h2 .num {
		font-size: 1rem;
		margin-right: 0.3rem;
	}

	.stage h3 {
		margin-top: 1.4rem;
		color: #bbb;
		font-weight: normal;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* One card per page, so each step reads as a thing to go and do. */
	.pages {
		list-style: none;
		padding: 0;
		margin: 0.6rem 0 0;
		counter-reset: page;
		display: grid;
		gap: 6px;
	}

	.pages li {
		counter-increment: page;
		display: grid;
		grid-template-columns: 1.6rem 1fr;
		column-gap: 0.4rem;
		align-items: baseline;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.55rem 0.8rem;
	}

	.pages li::before {
		content: counter(page);
		color: #5db65d;
		font: 600 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.pages a {
		font-weight: 600;
	}

	.pages .why {
		grid-column: 2;
		color: #bbb;
		font-size: 0.9rem;
	}

	.checkpoint {
		border-left: 2px solid #5db65d;
		padding-left: 0.9rem;
		margin-top: 1.4rem;
	}

	@media print {
		.pages li {
			background: #fff;
			border-color: #999;
		}
	}
</style>
