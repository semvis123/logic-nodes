<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import CourseShell from '$lib/course/CourseShell.svelte';
	import Quiz from '$lib/course/Quiz.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { lessonBySlug, stageOf, neighbours, position } from '$lib/course/lessons';
	import type { PageData } from './$types';

	export let data: PageData;

	$: lesson = lessonBySlug(data.slug)!;
	$: stage = stageOf(data.slug)!;
	$: where = position(data.slug);
	$: around = neighbours(data.slug);

	$: page = {
		title: `${lesson.title}: Digital Logic Course, Lesson ${where.stage}.${where.lesson}`,
		description: lesson.description,
		url: `${SITE}/learn/${lesson.slug}`,
		image: `${SITE}/og/learn-${lesson.slug}.png`,
		imageAlt: `LogicGates.org: ${lesson.title}`
	};

	$: jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['WebPage', 'LearningResource'],
				'@id': `${page.url}#webpage`,
				url: page.url,
				name: lesson.title,
				headline: page.title,
				description: page.description,
				isPartOf: [{ '@id': `${SITE}/#website` }, { '@id': `${SITE}/learn#course` }],
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${page.url}#breadcrumb` },
				inLanguage: 'en',
				learningResourceType: 'Lesson',
				educationalLevel: 'Beginner',
				timeRequired: `PT${lesson.minutes}M`,
				isAccessibleForFree: true,
				position: where.stage * 100 + where.lesson,
				...modifiedFields(page.url)
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Learn digital logic', item: `${SITE}/learn` },
					{
						'@type': 'ListItem',
						position: 3,
						name: `${where.stage}. ${stage.title}`,
						item: `${SITE}/learn#${stage.id}`
					},
					{ '@type': 'ListItem', position: 4, name: lesson.title }
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
		...lesson.deeper,
		{ href: '/learn', label: 'The whole course' },
		{ href: '/glossary', label: 'Glossary' },
		{ href: '/practice', label: 'Practice questions' }
	]}
>
	<CourseShell current={lesson.slug}>
		{#key lesson.slug}
			<article class="lesson">
				<section class="intro">
					<nav class="crumbs" aria-label="Breadcrumb">
						<a href="/learn">Learn</a> <span aria-hidden="true">/</span>
						<a href="/learn#{stage.id}">{where.stage}. {stage.title}</a> <span aria-hidden="true">/</span>
						<span>{lesson.title}</span>
					</nav>
					<h1>{lesson.title}</h1>
					<p class="meta">
						Lesson {where.lesson} of {where.of} in this stage, about {lesson.minutes} minutes
					</p>
					<p class="lede">{lesson.blurb}</p>
				</section>

				<section class="body">
					<svelte:component this={data.component} />
				</section>

				{#if lesson.build}
					<section class="build">
						<p class="try">
							<strong>Build it:</strong> <a href={lesson.build.href}>{lesson.build.label}</a> in the simulator.
						</p>
					</section>
				{/if}

				<Quiz {lesson} />

				{#if lesson.deeper.length}
					<section class="deeper">
						<h2>Go deeper</h2>
						<ul>
							{#each lesson.deeper as link}
								<li><a href={link.href}>{link.label}</a></li>
							{/each}
						</ul>
					</section>
				{/if}

				<nav class="pager" aria-label="Lessons">
					{#if around.previous}
						<a class="prev" href="/learn/{around.previous.slug}">
							<span class="dir">Previous</span>
							<span class="name">{around.previous.title}</span>
						</a>
					{:else}
						<span />
					{/if}
					{#if around.next}
						<a class="next" href="/learn/{around.next.slug}">
							<span class="dir">Next</span>
							<span class="name">{around.next.title}</span>
						</a>
					{:else}
						<a class="next" href="/learn">
							<span class="dir">Finished</span>
							<span class="name">Back to the course</span>
						</a>
					{/if}
				</nav>
			</article>
		{/key}
	</CourseShell>
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

	.meta {
		color: #888;
		font-size: 0.85rem;
		margin: -0.4rem 0 0.8rem;
	}

	.lesson {
		max-width: 760px;
	}

	/* Lesson prose: the same rhythm as the reference pages. */
	.body :global(h2) {
		font-size: 1.25rem;
		margin: 2.2rem 0 0.8rem;
	}

	.body :global(h3) {
		font-size: 1.05rem;
		margin: 1.6rem 0 0.5rem;
	}

	.body :global(ul),
	.body :global(ol) {
		color: #ddd;
	}

	.body :global(li) {
		margin-bottom: 0.3rem;
	}

	.body :global(.example) {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.7rem 1rem;
		margin: 1rem 0;
	}

	.body :global(.example p) {
		margin: 0 0 0.5rem;
	}

	.body :global(.example p:last-child) {
		margin-bottom: 0;
	}

	.build {
		margin-top: 1.5rem;
	}

	.deeper {
		margin-top: 2rem;
	}

	.deeper h2 {
		font-size: 1.1rem;
		margin: 0 0 0.5rem;
	}

	.deeper ul {
		margin: 0;
		padding-left: 1.2rem;
		color: #ddd;
	}

	.pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin: 2.5rem 0 3rem;
	}

	.pager a {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		text-decoration: none;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.6rem 0.9rem;
		min-width: 40%;
	}

	.pager a:hover {
		border-color: #5db65d;
	}

	.pager .next {
		text-align: right;
		margin-left: auto;
	}

	.dir {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #5db65d;
	}

	.name {
		color: #fff;
		font-weight: 600;
	}

	@media print {
		.pager {
			display: none;
		}
	}
</style>
