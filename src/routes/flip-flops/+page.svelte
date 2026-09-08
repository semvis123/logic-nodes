<script lang="ts">
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { flipFlops } from '$lib/flipflops';

	const SITE = 'https://nodes.kriyak.com';

	const page = {
		title: 'Flip-Flops Explained: SR, D, JK and T',
		description:
			'The four flip-flops with their characteristic and excitation tables, next-state equations, and what each one is actually used for. Free reference.',
		url: `${SITE}/flip-flops`,
		image: `${SITE}/og/flip-flops.png`,
		imageAlt: 'Logic Nodes: flip flops'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'CollectionPage',
				'@id': `${page.url}#webpage`,
				url: page.url,
				name: page.title,
				description: page.description,
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				breadcrumb: { '@id': `${page.url}#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: { '@id': `${page.url}#list` }
			},
			{
				'@type': 'ItemList',
				'@id': `${page.url}#list`,
				name: 'The four flip-flops',
				itemListElement: flipFlops.map((ff, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: ff.name,
					url: `${SITE}/flip-flops/${ff.slug}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Flip-flops' }
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
		{ href: '/counters', label: 'Counters' },
		{ href: '/shift-registers', label: 'Shift registers' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Flip-flops</h1>
		<p class="lede">
			A gate answers a question about right now. A flip-flop remembers. These four are the standard storage elements,
			and everything with state, from a counter to a processor register, is built from them.
		</p>
	</section>

	<section>
		<h2>The four of them</h2>
		<div class="grid">
			{#each flipFlops as ff}
				<a class="card ff" href="/flip-flops/{ff.slug}">
					<h3>
						<span class="ff-name">{ff.shortName}</span>
						<span class="ff-eq mono">{ff.equationText}</span>
					</h3>
					<p>{ff.tagline}</p>
					<span class="more">Read more →</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<h2>Which one to reach for</h2>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Type</th>
						<th scope="col">Inputs</th>
						<th scope="col">Next state</th>
						<th scope="col">Good for</th>
						<th scope="col">Catch</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">SR</th>
						<td class="mono">S, R</td>
						<td class="mono">S ∨ (¬R ∧ Q)</td>
						<td>Latching a condition until something clears it</td>
						<td>S = R = 1 is not allowed</td>
					</tr>
					<tr>
						<th scope="row">D</th>
						<td class="mono">D</td>
						<td class="mono">D</td>
						<td>Registers, pipelines, holding a value steady</td>
						<td>Cannot toggle without external logic</td>
					</tr>
					<tr>
						<th scope="row">JK</th>
						<td class="mono">J, K</td>
						<td class="mono">(J ∧ ¬Q) ∨ (¬K ∧ Q)</td>
						<td>State machines, counters, all four cases usable</td>
						<td>Two inputs to drive instead of one</td>
					</tr>
					<tr>
						<th scope="row">T</th>
						<td class="mono">T</td>
						<td class="mono">T ⊻ Q</td>
						<td>Counters and clock division</td>
						<td>Cannot load a specific value directly</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			They are more alike than they look: each is an SR latch with different logic in front of it. Modern designs mostly
			use D, because a synthesis tool would rather build the extra logic than manage a second control input.
		</p>
	</section>

	<section>
		<h2>Latch or flip-flop?</h2>
		<p class="section-intro">
			The words are often used loosely, but the distinction matters once a circuit has a clock.
		</p>
		<ul class="compare">
			<li>
				<strong>A latch is level triggered.</strong> While its enable is high it is transparent: the output follows the input
				continuously. Turn the enable off and it holds whatever it had.
			</li>
			<li>
				<strong>A flip-flop is edge triggered.</strong> It only samples on the rising or falling edge of the clock, so its
				output changes at one predictable instant per clock period no matter what the input did in between.
			</li>
		</ul>
		<p>
			That predictability is why synchronous designs use flip-flops throughout. Every stage captures its input at the
			same edge, so a signal has a whole clock period to settle before anything looks at it.
		</p>
		<p>
			<a class="cta" href="/simulator">Build one in the simulator</a>
		</p>
		<p class="reducer">
			Start with two <a href="/logic-gates/nor">NOR gates</a> wired into each other, which is the SR latch every other
			one is built on. <a href="/learn#memory">The learning path</a> walks through it.
		</p>
	</section>
</ContentPage>

<style>
	.intro {
		padding-top: 64px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
	}

	.ff {
		padding: 1rem 1.1rem 1.1rem;
		text-decoration: none;
		display: block;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.ff:hover {
		border-color: rgba(255, 255, 255, 0.75);
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.ff,
		.ff:hover {
			transition: none;
			transform: none;
		}
	}

	.ff h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ff-name {
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.ff-eq {
		font-size: 0.78rem;
		color: #999;
	}

	.ff p {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 0.6rem;
	}

	.more {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	.compare {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.compare li {
		margin-bottom: 0.6rem;
	}

	.compare strong {
		color: #fff;
	}
</style>
