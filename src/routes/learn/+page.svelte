<script lang="ts">
	import { onMount } from 'svelte';
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { stages, allLessons, totalMinutes } from '$lib/course/lessons';
	import { progress, loadProgress, resetProgress } from '$lib/course/progress';

	onMount(loadProgress);

	$: done = allLessons.filter((l) => $progress[l.slug]?.done).length;
	// The first lesson not yet finished is where "continue" goes.
	$: next = allLessons.find((l) => !$progress[l.slug]?.done) ?? allLessons[0];
	// A plain const, not a reactive statement: the FAQ text below is built once
	// at init, before any `$:` block has run, so a reactive `hours` was still
	// undefined when it was read and the page said "about undefined hours".
	const hours = Math.round(totalMinutes / 30) / 2;

	function reset() {
		if (confirm('Clear your progress on every lesson?')) resetProgress();
	}

	const faqs = [
		{
			q: 'Do I need any electronics or maths to start?',
			a: 'No. The course starts from a light switch and works entirely with 1s and 0s: a wire is either high or low, and gates turn some highs and lows into others. You never need volts, resistors or transistors, and the only arithmetic is counting. Every new word is explained where it first appears.'
		},
		{
			q: 'What order should I learn digital logic in?',
			a: 'Bits, then the gates and truth tables, then boolean algebra, then how to make a circuit smaller with Karnaugh maps, then the circuits that compute: adders, multiplexers and decoders. Only then memory, with the SR latch and flip-flops, and finally counters, registers and state machines. That is the order of the eight stages here, and each one uses only what came before it.'
		},
		{
			q: 'How does a lesson count as done?',
			a: 'Every lesson ends with a quiz of generated questions. Five right in a row and the lesson gets a tick on the roadmap. A wrong answer shows a hint and lets you try the same question again. You can also mark a lesson as already known, which gives it a hollow tick until you pass the quiz. Progress is saved in your browser only; there are no accounts.'
		},
		{
			q: 'How long does it take?',
			a: `The lessons add up to about ${hours} hours of reading and practice. Most people take the early stages in an evening or two each and slow down at memory and state machines, where timing is new. There is no clock: the roadmap keeps your place, and every lesson can be reopened for more practice at any time.`
		},
		{
			q: 'Is this the same as the reference pages?',
			a: 'No. The reference pages, such as the gates, the flip-flops and the boolean algebra laws, are for looking things up and go into more depth than a lesson does. Each lesson links to the reference pages that go deeper on its topic, and the tools on the site are the same ones the lessons point you at.'
		}
	];

	const page = {
		title: 'Learn Digital Logic From Zero: A Free Interactive Course',
		description:
			'A free, interactive digital logic course in eight stages: bits, logic gates, boolean algebra, Karnaugh maps, adders, latches and flip-flops, counters and state machines. Every lesson explains the idea in plain words, has something to click, and ends with a quiz.',
		url: `${SITE}/learn`,
		image: `${SITE}/og/learn.png`,
		imageAlt: 'LogicGates.org: learn digital logic'
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
				mainEntityOfPage: { '@id': `${page.url}#course` },
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
				name: 'Learn digital logic from zero',
				description:
					'A free, self-paced, interactive course in digital logic: from a single bit to state machines, in eight stages and ' +
					`${allLessons.length} lessons, each with a live circuit to click and a quiz.`,
				url: page.url,
				inLanguage: 'en',
				...modifiedFields(page.url),
				isAccessibleForFree: true,
				educationalLevel: 'Beginner',
				provider: { '@id': 'https://kriyak.com/#person' },
				hasCourseInstance: {
					'@type': 'CourseInstance',
					courseMode: 'online',
					courseWorkload: `PT${totalMinutes}M`
				},
				syllabusSections: stages.map((stage, i) => ({
					'@type': 'Syllabus',
					position: i + 1,
					name: stage.title,
					description: stage.tagline,
					url: `${page.url}#${stage.id}`
				})),
				hasPart: allLessons.map((lesson) => ({
					'@type': 'LearningResource',
					'@id': `${SITE}/learn/${lesson.slug}#webpage`,
					name: lesson.title,
					url: `${SITE}/learn/${lesson.slug}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
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
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/glossary', label: 'Glossary' },
		{ href: '/practice', label: 'Practice questions' },
		{ href: '/worksheet', label: 'Printable worksheets' }
	]}
>
	<section class="intro">
		<h1>Learn digital logic from zero</h1>
		<p class="lede">
			A course in {allLessons.length} short lessons, from a single wire to a machine that counts and decides. Each lesson
			explains one idea in plain words, gives you something to click, and ends with a quiz. Nothing here needs anything that
			comes later.
		</p>
		<p class="start">
			<a class="cta" href="/learn/{next.slug}">{done ? `Continue: ${next.title}` : `Start: ${next.title}`}</a>
			{#if done}
				<span class="count">{done} of {allLessons.length} lessons done.</span>
				<button type="button" class="link-btn" on:click={reset}>Reset</button>
			{/if}
		</p>
	</section>

	<section class="how">
		<h2>How it works</h2>
		<div class="grid">
			<div class="card step">
				<h3>Read</h3>
				<p>
					Each lesson is a few minutes of reading written for someone who has never seen this before. New words are
					explained in the sentence they first appear, and the "Why?" boxes are there when you want the reason, not just
					the rule.
				</p>
			</div>
			<div class="card step">
				<h3>Click</h3>
				<p>
					Every lesson has a live circuit in it: a gate you can drive, a latch you can set and reset, a counter you can
					clock. Watching the wires change colour is worth more than reading the truth table twice.
				</p>
			</div>
			<div class="card step">
				<h3>Check</h3>
				<p>
					Five right in a row on the quiz and the lesson gets a tick on the roadmap. A wrong answer shows a hint and
					lets you retry the same question. The questions are generated, so you can always come back for more.
				</p>
			</div>
		</div>
	</section>

	{#each stages as stage, i}
		<section class="stage" id={stage.id}>
			<h2><span class="num">{i + 1}</span> {stage.title}</h2>
			<p class="section-intro">{stage.tagline}</p>
			<ol class="lessons">
				{#each stage.lessons as lesson}
					{@const state = $progress[lesson.slug]?.done}
					<li class:passed={state === 'passed'} class:marked={state === 'marked'}>
						<a href="/learn/{lesson.slug}">
							<span class="tick" aria-hidden="true">{state ? '✓' : ''}</span>
							<span class="text">
								<span class="title">{lesson.title}</span>
								<span class="blurb">{lesson.blurb}</span>
							</span>
							<span class="minutes">{lesson.minutes} min</span>
							{#if state}<span class="visually-hidden">, {state === 'passed' ? 'passed' : 'marked done'}</span>{/if}
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/each}

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
		padding-top: 48px;
	}

	.start {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		margin: 0 0 1rem;
	}

	.count {
		color: #bbb;
	}

	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: #aaa;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.link-btn:hover {
		color: #fff;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
	}

	.step {
		padding: 0.9rem 1.1rem 1rem;
	}

	.step h3 {
		margin: 0 0 0.4rem;
	}

	.step p {
		margin: 0;
		color: #bbb;
		font-size: 0.92rem;
	}

	.stage h2 .num {
		color: #5db65d;
		font: 600 1rem ui-monospace, SFMono-Regular, Menlo, monospace;
		margin-right: 0.4rem;
	}

	.lessons {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 6px;
	}

	.lessons a {
		display: grid;
		grid-template-columns: 1.4rem 1fr auto;
		gap: 0.7rem;
		align-items: center;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.55rem 0.9rem;
		text-decoration: none;
		color: #ddd;
	}

	.lessons a:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.title {
		font-weight: 600;
		color: #fff;
	}

	.blurb {
		font-size: 0.88rem;
		color: #bbb;
	}

	.minutes {
		font-size: 0.8rem;
		color: #888;
		white-space: nowrap;
	}

	.tick {
		width: 1.2rem;
		height: 1.2rem;
		border: 1px solid #666;
		border-radius: 50%;
		font-size: 0.7rem;
		line-height: 1.2rem;
		text-align: center;
		color: #fff;
	}

	li.passed .tick {
		background-color: #5db65d;
		border-color: #5db65d;
		color: #000;
	}

	li.marked .tick {
		border-color: #5db65d;
		color: #5db65d;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 600px) {
		.lessons a {
			grid-template-columns: 1.4rem 1fr;
		}

		.minutes {
			display: none;
		}
	}
</style>
