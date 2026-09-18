<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { glossary } from '$lib/glossary';

	// Grouped by first letter for the index strip at the top.
	const letters = [...new Set(glossary.map((entry) => entry.term[0].toUpperCase()))];
	const grouped = letters.map((letter) => ({
		letter,
		entries: glossary.filter((entry) => entry.term[0].toUpperCase() === letter)
	}));

	const page = {
		title: 'Digital Logic Glossary: Every Term, Defined in One Paragraph',
		description: `${glossary.length} terms from digital logic and boolean algebra, from active low to XOR, each defined in a paragraph and linked to the page that explains it.`,
		url: `${SITE}/glossary`,
		image: `${SITE}/og/glossary.png`,
		imageAlt: 'LogicGates.org: glossary'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${page.url}#webpage`,
				url: page.url,
				name: page.title,
				description: page.description,
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${page.url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: { '@id': `${page.url}#terms` }
			},
			{
				'@type': 'DefinedTermSet',
				'@id': `${page.url}#terms`,
				name: 'Digital logic glossary',
				hasDefinedTerm: glossary.map((entry) => ({
					'@type': 'DefinedTerm',
					'@id': `${page.url}#${entry.slug}`,
					name: entry.term,
					description: entry.definition,
					inDefinedTermSet: { '@id': `${page.url}#terms` },
					...(entry.href ? { url: `${SITE}${entry.href}` } : {})
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Glossary' }
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
		{ href: '/roadmap', label: 'The learning roadmap' },
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Digital logic glossary</h1>
		<p class="lede">
			{glossary.length} terms, each defined in one paragraph that stands on its own, with a link to the page that treats
			it properly. Alphabetical, so scan for the word or jump by letter.
		</p>
		<nav class="letters" aria-label="Jump to letter">
			{#each letters as letter}
				<a href="#letter-{letter.toLowerCase()}">{letter}</a>
			{/each}
		</nav>
	</section>

	{#each grouped as group}
		<section class="group" id="letter-{group.letter.toLowerCase()}">
			<h2>{group.letter}</h2>
			<dl>
				{#each group.entries as entry}
					<div class="entry" id={entry.slug}>
						<dt>
							{#if entry.href}
								<a href={entry.href}>{entry.term}</a>
							{:else}
								{entry.term}
							{/if}
						</dt>
						<dd>{entry.definition}</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}

	<section>
		<h2>Missing a term?</h2>
		<p>
			The glossary covers what the rest of this site explains. If a word you met in a course is not here, the
			<a href="/learn">learning path</a> introduces the ideas in order, and the
			<a href="/practice">practice questions</a> test them.
		</p>
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 64px;
	}

	.letters {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 1rem;
	}

	.letters a {
		display: inline-block;
		min-width: 2rem;
		text-align: center;
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.25rem 0.4rem;
		text-decoration: none;
		color: #ddd;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
	}

	.letters a:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.group h2 {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #8ede8e;
	}

	dl {
		margin: 0;
	}

	.entry {
		padding: 0.7rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		max-width: 760px;
	}

	.entry:target {
		background: rgba(93, 182, 93, 0.08);
		box-shadow: -8px 0 0 rgba(93, 182, 93, 0.08), 8px 0 0 rgba(93, 182, 93, 0.08);
	}

	dt {
		color: #fff;
		font-weight: 600;
	}

	dt a {
		color: #fff;
	}

	dd {
		margin: 0.25rem 0 0;
		color: #ccc;
	}
</style>
