<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import MarbleGame from '$lib/marble/MarbleGame.svelte';
	import { levels } from '$lib/marble/levels';

	const faqs = [
		{
			q: 'How do you play the marble machine?',
			a: `Each level shows what the marble should do for every setting of the levers: reach the cup, or not. You build a machine from planks, seesaws and ramps so that it does exactly that. Drop a marble to try one setting, or test them all and the goal cards turn green or red. There are ${levels.length} levels, and each one has a par: the fewest parts that can do the job.`
		},
		{
			q: 'Do I need to know any logic to play?',
			a: 'No. The levels teach by doing: the first ones have one lever and one part, and each new part arrives in a level built around it. The rules of the machine are physical. A plank swings open when its lever is the right way and slides the marble aside when it is not, and a seesaw tips the marble toward whichever of its levers is down on its own.'
		},
		{
			q: 'What is the machine really doing?',
			a: 'Every machine is a digital logic circuit built out of moving parts. The levers are inputs, the cup is the output, and each part is a small decision. Two planks in a row need both levers right, which is an AND. A plank that slides the marble to a second plank gives it a second chance, which is an OR. The seesaw only lets the marble through when exactly one lever is down, which is an XOR. The goal cards are a truth table.'
		},
		{
			q: 'Is there a way to get it in fewer parts?',
			a: 'Often, and the par is the best there is: every level was checked by trying every arrangement of fewer parts. A plank that is shut sends the marble sideways, and that sideways path can be the way to the cup, so a part does not only have to let the marble through. The ramp and the choice of which side a plank slides to matter more than they look.'
		},
		{
			q: 'Does it save my progress?',
			a: 'Yes, in your browser only. Your boards and the levels you have solved are kept in local storage on this device. Nothing is sent anywhere and there is no account.'
		}
	];

	const page = {
		title: 'Marble Machine: A Logic Puzzle Game',
		description:
			'Build a machine of planks and seesaws that drops the marble in the cup only when the levers say so. Eleven puzzles, and no theory needed to play.',
		url: `${SITE}/marble-machine`,
		image: `${SITE}/og/marble-machine.png`,
		imageAlt: 'LogicGates.org: marble machine'
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
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Marble machine' }
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
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/practice', label: 'Practice questions' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Marble machine</h1>
		<p class="lede">
			Levers along the top, a cup at the bottom, and a marble that has to end up in the cup, but only when the levers
			say so. Build the machine from planks and seesaws so it does what each goal card asks, in as few parts as you can.
		</p>
		<div class="card tool">
			<MarbleGame />
		</div>
	</section>

	<section>
		<h2>How it works</h2>
		<ul>
			<li>
				<strong>Pull the levers</strong> to choose a setting, then <strong>drop the marble</strong> to see what it does.
				Every part is tied to a lever by a rope: taut when the lever is down, slack when it is up.
			</li>
			<li>
				<strong>Place parts</strong> by dragging them from the tray, or pick one and tap a square. Tap a placed part to choose
				its lever, which way it opens and which side it slides to.
			</li>
			<li>
				<strong>Test all settings</strong> and each goal card turns green or red. Tap a red card to watch the marble go wrong:
				its route stays behind as a dotted line.
			</li>
			<li>
				<strong>Beat the par.</strong> Three stars for matching it. Some levels have a shorter answer than the obvious one.
			</li>
		</ul>
	</section>

	<section>
		<details class="faq">
			<summary>What is the machine really doing?</summary>
			<p>{faqs[2].a}</p>
			<p>
				Play a few levels first if you would rather work it out yourself. Afterwards the
				<a href="/logic-gates">logic gates</a> pages show the same ideas drawn as circuit symbols, and the
				<a href="/truth-table-generator">truth table generator</a> turns any goal into a table.
			</p>
		</details>
	</section>

	<section>
		<h2>Questions</h2>
		{#each faqs.filter((f, i) => i !== 2) as f}
			<details class="faq">
				<summary>{f.q}</summary>
				<p>{f.a}</p>
			</details>
		{/each}
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 64px;
	}
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
	}
	.faq summary {
		cursor: pointer;
		font-weight: 600;
	}
</style>
