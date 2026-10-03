<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { tools, toolGroups, toolCount } from '$lib/tools';
	import ToolIcon from '$lib/ToolIcon.svelte';

	const count = toolCount();
	const Count = count[0].toUpperCase() + count.slice(1);

	const page = {
		title: 'Digital Logic Tools: Truth Tables, K-Maps, Boolean Algebra',
		description: `${Count} free tools: truth tables, boolean algebra, Karnaugh maps, logic proofs, binary and hex, floats, subnets, QR codes, UUIDs and Base64.`,
		url: `${SITE}/tools`,
		image: `${SITE}/og/tools.png`,
		imageAlt: 'LogicGates.org: tools'
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
				name: 'Digital logic tools',
				itemListElement: tools.map((tool, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: tool.name,
					description: tool.blurb,
					url: `${SITE}${tool.href}`
				}))
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${page.url}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Tools' }
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
		{ href: '/logic-gates', label: 'The seven logic gates' },
		{ href: '/boolean-algebra-examples', label: 'Worked simplification examples' },
		{ href: '/glossary', label: 'Glossary' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/logic', label: 'Propositional logic' },
		{ href: '/set-notation', label: 'Set notation' }
	]}
>
	<section class="intro">
		<h1>Digital logic tools</h1>
		<p class="lede">
			{Count} calculators for the things you actually have to work out, from truth tables, simplification and Karnaugh maps
			to logic proofs, number bases, text encodings, and the bits inside subnets, floats, IDs and file formats. Each one
			shows its working, and all of them are free and run in your browser, with nothing uploaded.
		</p>
	</section>

	{#each toolGroups as group}
		<section id={group.id}>
			<h2>{group.name}</h2>
			<div class="grid">
				{#each tools.filter((tool) => tool.group === group.id) as tool}
					<a class="card tool" href={tool.href}>
						<h3><ToolIcon href={tool.href} />{tool.name}</h3>
						<p>{tool.blurb}</p>
						<span class="more">Open →</span>
					</a>
				{/each}
			</div>
		</section>
	{/each}

	<section>
		<h2>Which one do I want?</h2>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">If you have</th>
						<th scope="col">And you want</th>
						<th scope="col">Use</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">An expression</th>
						<td>every input combination listed</td>
						<td><a href="/truth-table-generator">Truth table generator</a></td>
					</tr>
					<tr>
						<th scope="row">A long expression</th>
						<td>the shortest equivalent</td>
						<td><a href="/boolean-algebra-calculator">Boolean algebra calculator</a></td>
					</tr>
					<tr>
						<th scope="row">Two expressions</th>
						<td>to know whether they match</td>
						<td><a href="/boolean-algebra-calculator">Boolean algebra calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A homework K-map</th>
						<td>the groups drawn and named</td>
						<td><a href="/karnaugh-map-solver">Karnaugh map solver</a></td>
					</tr>
					<tr>
						<th scope="row">A truth table</th>
						<td>minterms, maxterms, SOP or POS</td>
						<td><a href="/sum-of-products-calculator">Sum of products calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A circuit design</th>
						<td>it rebuilt from one gate type</td>
						<td><a href="/nand-nor-converter">NAND and NOR converter</a></td>
					</tr>
					<tr>
						<th scope="row">A counter or encoder</th>
						<td>a one-bit-at-a-time sequence</td>
						<td><a href="/gray-code-converter">Gray code converter</a></td>
					</tr>
					<tr>
						<th scope="row">A number</th>
						<td>it in another base, or in two's complement</td>
						<td><a href="/binary-converter">Binary converter</a></td>
					</tr>
					<tr>
						<th scope="row">An IP address and a prefix</th>
						<td>its network, broadcast and host range</td>
						<td><a href="/subnet-calculator">Subnet calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A network and some host counts</th>
						<td>a subnet for each, without overlaps</td>
						<td><a href="/vlsm-calculator">VLSM calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A long IPv6 address</th>
						<td>its shortest correct form</td>
						<td><a href="/ipv6-expand-compress">IPv6 expand and compress</a></td>
					</tr>
					<tr>
						<th scope="row">A model in FP16 or FP8</th>
						<td>what one number turns into</td>
						<td><a href="/fp16-bf16-fp8-converter">FP16, BF16, FP8 and FP4 converter</a></td>
					</tr>
					<tr>
						<th scope="row">A C struct</th>
						<td>its size and where the padding goes</td>
						<td><a href="/struct-padding-calculator">Struct padding calculator</a></td>
					</tr>
					<tr>
						<th scope="row">A UUID, ULID or ObjectId</th>
						<td>its version and when it was made</td>
						<td><a href="/uuid-decoder">UUID decoder and generator</a></td>
					</tr>
					<tr>
						<th scope="row">A Discord or Twitter/X ID</th>
						<td>the moment it was created</td>
						<td><a href="/snowflake-id-decoder">Snowflake ID decoder</a></td>
					</tr>
					<tr>
						<th scope="row">A file with a doubtful extension</th>
						<td>what its first bytes say it is</td>
						<td><a href="/file-signature-checker">File signature checker</a></td>
					</tr>
					<tr>
						<th scope="row">Some text or a link</th>
						<td>a QR code, and how it is built</td>
						<td><a href="/qr-code-generator">QR code generator</a></td>
					</tr>
					<tr>
						<th scope="row">A class to teach</th>
						<td>a printable question sheet with answers</td>
						<td><a href="/worksheet">Worksheet generator</a></td>
					</tr>
					<tr>
						<th scope="row">An idea</th>
						<td>to build and run it</td>
						<td><a href="/simulator">The simulator</a></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>The expression tools share one engine</h2>
		<p class="section-intro">
			The same parser and minimiser sits behind every tool here that takes an expression, so what you type into one
			means exactly the same thing in the next. (The number, encoding and programming tools work on bits and bytes
			rather than expressions, so each has its own engine.) It accepts whichever notation you use —
			<span class="mono">a·b</span>, <span class="mono">a&amp;b</span>,
			<span class="mono">a∧b</span>, <span class="mono">ab</span> — and the simplification is
			<a href="/quine-mccluskey">Quine-McCluskey</a>, the same algorithm whether you see it as algebra or as groups on a
			map.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
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

	.tool {
		padding: 1rem 1.1rem 1.1rem;
		text-decoration: none;
		display: block;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.tool:hover {
		border-color: rgba(255, 255, 255, 0.75);
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.tool,
		.tool:hover {
			transition: none;
			transform: none;
		}
	}

	.tool h3 {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		color: #fff;
	}

	.tool p {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 0.6rem;
	}

	.more {
		color: #8ede8e;
		font-size: 0.8rem;
	}

	/* On a phone each group is one panel with a row per tool, rather than a
	   tall stack of separate cards. */
	@media (max-width: 600px) {
		.grid {
			gap: 0;
			background-color: #161618;
			border: 1px solid rgba(255, 255, 255, 0.35);
			border-radius: 3px;
		}

		/* .grid raises these above the shared card style. */
		.grid .tool {
			padding: 0.75rem 0.9rem;
			background: none;
			border: 0;
			border-radius: 0;
		}

		.grid .tool + .tool {
			border-top: 1px solid rgba(255, 255, 255, 0.12);
		}

		.grid .tool:hover {
			transform: none;
		}

		.tool h3 {
			margin: 0 0 0.2rem;
			font-size: 1rem;
		}

		.tool p {
			margin: 0 0 0 calc(20px + 0.55rem);
			font-size: 0.85rem;
		}

		.more {
			display: none;
		}
	}
</style>
