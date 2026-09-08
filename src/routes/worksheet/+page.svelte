<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';
	import { makeQuestion, questionSignature, topics, type Topic, type Question } from '$lib/quiz';
	import { readUrl, syncUrl, safeInt, safeOption } from '$lib/urlState';

	const DEFAULTS = { seed: '1', n: '10', topic: 'mixed', key: '' };

	let seed = 1;
	let count = 10;
	let topic: Topic = 'mixed';
	let showKey = false;

	onMount(() => {
		const p = readUrl();
		seed = safeInt(p.seed, 1, 999_999) ?? Math.floor(Math.random() * 999_999) + 1;
		count = safeInt(p.n, 1, 40) ?? count;
		topic =
			safeOption(
				p.topic,
				topics.map((t) => t.id)
			) ?? topic;
		// The key is unlocked by a token derived from the sheet, so a student
		// holding the blank link cannot simply flip a 0 to a 1.
		showKey = !!p.key && p.key === keyToken(seed, count, topic);
	});

	/**
	 * A short token that depends on the sheet. This is not a secret: everything
	 * here runs in the browser and anyone determined can read the answers out of
	 * the page. It only stops the obvious guess, so the blank link you hand out
	 * stays blank.
	 */
	function keyToken(from: number, howMany: number, subject: Topic): string {
		let hash = 0x811c9dc5;
		for (const ch of `${from}:${howMany}:${subject}`) {
			hash ^= ch.charCodeAt(0);
			hash = Math.imul(hash, 0x01000193) >>> 0;
		}
		return hash.toString(36).padStart(6, '0').slice(-6);
	}

	$: token = keyToken(seed, count, topic);
	$: syncUrl({ seed, n: count, topic, key: showKey ? token : '' }, DEFAULTS);

	// The seed is the worksheet. The same seed always rebuilds the same sheet,
	// on any machine, with nothing stored anywhere.
	$: questions = buildSheet(seed, count, topic);

	function buildSheet(from: number, howMany: number, subject: Topic): Question[] {
		const out: Question[] = [];
		const seen: string[] = [];
		let step = 0;
		while (out.length < howMany && step < howMany * 40) {
			const question = makeQuestion(from * 1000 + step, subject);
			step += 1;
			const signature = questionSignature(question);
			if (seen.includes(signature)) continue; // no repeats on one sheet
			seen.push(signature);
			out.push(question);
		}
		return out;
	}

	const letters = ['A', 'B', 'C', 'D'];

	// A length that arrived in a link has to be offered, or the select goes blank.
	$: lengths = [...new Set([5, 10, 15, 20, 25, 30, count])].sort((a, b) => a - b);
	const reroll = () => (seed = Math.floor(Math.random() * 999_999) + 1);

	const faqs = [
		{
			q: 'How do I give the same worksheet to a whole class?',
			a: 'Share the link. The sheet is rebuilt from the number in the address, so everyone who opens it sees exactly the same questions in the same order. Nothing is stored on a server, and there is no account or class code to set up.'
		},
		{
			q: 'How do I get the answers?',
			a: 'Tick "show the answer key" and the correct letter and a short explanation appear under each question. The key link carries a short code that belongs to that sheet, so the blank link you hand out stays blank and cannot be turned into the marked one by editing the address. It is not a lock: everything runs in the browser, so a determined student can still dig the answers out of the page.'
		},
		{
			q: 'Can I get a different set of questions?',
			a: 'Press "new sheet" for another random set, or edit the number in the address bar directly. Each number gives a different worksheet, and the same number always gives the same one, so you can hand out several versions of the same difficulty and still mark them.'
		},
		{
			q: 'Can I use these in class?',
			a: 'Yes, freely. The questions are generated, not copied from anywhere, and the site is open source under Apache 2.0. No attribution is required, though a link back is always welcome.'
		}
	];

	const page = {
		title: 'Logic Worksheet Generator: Printable Sheets and Answers',
		description:
			'Generate a printable digital logic worksheet with an answer key. Pick a topic and a length, share the link, and everyone gets the same questions.',
		url: `${SITE}/worksheet`,
		image: `${SITE}/og/worksheet.png`,
		imageAlt: 'Logic Nodes: worksheet generator'
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
					{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Worksheet generator' }
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
		{ href: '/practice', label: 'Practice questions' },
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro no-print">
		<h1>Worksheet generator</h1>
		<p class="lede">
			A printable set of digital logic questions with an answer key. The sheet is rebuilt from the number in the
			address, so sharing the link gives everyone the same questions, and nothing is stored anywhere.
		</p>

		<div class="card controls">
			<div class="row">
				<label class="field">
					Topic
					<select bind:value={topic}>
						{#each topics as option}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					Questions
					<select bind:value={count}>
						{#each lengths as n}
							<option value={n}>{n}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					Sheet number
					<input type="number" min="1" max="999999" bind:value={seed} />
				</label>
				<button type="button" class="reroll" on:click={reroll}>New sheet</button>
			</div>
			<div class="row">
				<label class="check">
					<input type="checkbox" bind:checked={showKey} />
					Show the answer key
				</label>
				<button type="button" class="print" on:click={() => window.print()}>Print</button>
				<ShareLink what="this worksheet" />
			</div>
			<p class="note">
				Print with the key off for the class and on for yourself. The two links differ by a code tied to this sheet, so
				handing out the blank one does not hand out the answers. It only stops the obvious guess, though: the marking
				happens in the browser, so it is not a lock.
			</p>
		</div>
	</section>

	<section class="sheet">
		<header class="sheet-head">
			<h2>
				Digital logic worksheet
				<span class="meta">
					{topics.find((t) => t.id === topic)?.label} · {questions.length} questions · sheet {seed}
				</span>
			</h2>
			<div class="namebox">
				<span>Name</span>
				<span class="rule" />
			</div>
		</header>

		<ol class="questions">
			{#each questions as question}
				<li class="question" class:with-key={showKey}>
					<p class="ask">{question.prompt}</p>

					{#if question.detail}
						<p class="detail mono">{question.detail}</p>
					{/if}

					{#if question.table}
						<table class="q-table">
							<thead>
								<tr>
									{#each question.table.variables as variable}
										<th scope="col">{variable}</th>
									{/each}
									<th scope="col">{question.tableOutputLabel ?? 'Q'}</th>
								</tr>
							</thead>
							<tbody>
								{#each question.table.rows as value, row}
									<tr>
										{#each question.table.variables as _, bit}
											{@const on = !!(row & (1 << (question.table.variables.length - 1 - bit)))}
											<td>{on ? 1 : 0}</td>
										{/each}
										<td>{value ? 1 : 0}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}

					{#if question.svg}
						<div class="figure screen-only">{@html question.svg}</div>
						{#if question.svgPrint}
							<div class="figure print-only" aria-hidden="true">{@html question.svgPrint}</div>
						{/if}
					{/if}

					<ol class="choices">
						{#each question.options as option, o}
							<li class:right={showKey && o === question.answer}>
								<span class="letter">{letters[o] ?? o + 1}</span>
								<span class="mono">{option}</span>
							</li>
						{/each}
					</ol>

					{#if showKey}
						<p class="answer">
							<strong>{letters[question.answer]}.</strong>
							{question.explanation}
						</p>
					{/if}
				</li>
			{/each}
		</ol>

		<p class="sheet-foot">
			Sheet {seed} · generated at logicgates.org/worksheet · free to copy and use
		</p>
	</section>

	<section class="no-print">
		<h2>How it works without an account</h2>
		<p class="section-intro">
			There is no database behind this, and no sign-up. The questions come from the sheet number in the address, so the
			number is the worksheet.
		</p>
		<ul class="how">
			<li>
				<strong>Same number, same sheet.</strong> Anyone opening the link rebuilds question for question what you saw, in
				the same order, on any device.
			</li>
			<li>
				<strong>Different number, different sheet.</strong> Hand out several versions of equal difficulty and still mark
				them all from their own links.
			</li>
			<li>
				<strong>The key is part of the address.</strong> One link gives the blank sheet, the same link with the key switched
				on gives the marked one.
			</li>
			<li>
				<strong>Nothing is collected.</strong> No accounts, no class codes, no tracking, and nothing of yours leaves the
				browser.
			</li>
		</ul>
		<p class="reducer">
			Prefer questions one at a time with instant marking? That is
			<a href="/practice">the practice page</a>, which uses the same generator.
		</p>
	</section>

	<section class="faq no-print">
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

	.controls {
		padding: 1rem 1.1rem 1.1rem;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 0.7rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		color: #bbb;
		font-size: 0.8rem;
	}

	.field select,
	.field input {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 0.9rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.35rem 0.5rem;
		min-width: 7rem;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #ddd;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.reroll,
	.print {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}

	.print {
		border-color: #5db65d;
		color: #8ede8e;
	}

	.reroll:hover,
	.print:hover {
		background: #16241a;
	}

	.note {
		color: #888;
		font-size: 0.8rem;
		margin: 0.3rem 0 0;
	}

	.sheet-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
		border-bottom: 1px solid rgba(255, 255, 255, 0.25);
		padding-bottom: 0.6rem;
	}

	.meta {
		display: block;
		color: #888;
		font-size: 0.8rem;
		font-weight: normal;
		margin-top: 0.2rem;
	}

	.namebox {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		color: #888;
		font-size: 0.85rem;
	}

	.rule {
		display: block;
		width: 12rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
	}

	/* A white line is invisible on paper, and the name box is the one thing on
	   the sheet that has to be written on. */
	@media print {
		.rule {
			border-bottom-color: #000;
		}
	}

	.questions {
		padding-left: 1.4rem;
		margin: 1.2rem 0 0;
	}

	.question {
		margin-bottom: 1.6rem;
		break-inside: avoid;
	}

	.ask {
		color: #fff;
		margin: 0 0 0.4rem;
	}

	.detail {
		color: #8ede8e;
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}

	.q-table {
		border-collapse: collapse;
		margin: 0 0 0.6rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
	}

	.q-table th,
	.q-table td {
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 0.2rem 0.7rem;
		text-align: center;
		color: #ddd;
	}

	.figure {
		max-width: 420px;
		margin: 0 0 0.6rem;
	}

	.figure :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}

	/* The paper copy of a diagram; ContentPage swaps the two when printing. */
	.print-only {
		display: none;
	}

	.choices {
		list-style: none;
		padding: 0;
		margin: 0;
		/* Packed rather than one stretched column each, so a two option question
		   does not spread its answers across the whole page. */
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 2.5rem;
	}

	.choices li {
		min-width: 7rem;
		display: flex;
		gap: 0.5rem;
		color: #ddd;
		font-size: 0.92rem;
		padding: 0.15rem 0;
	}

	.letter {
		color: #888;
		min-width: 1.2rem;
	}

	.choices li.right {
		color: #8ede8e;
	}

	.choices li.right .letter {
		color: #5db65d;
		font-weight: 700;
	}

	.answer {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
		border-left: 2px solid #5db65d;
		padding-left: 0.7rem;
	}

	.answer strong {
		color: #8ede8e;
	}

	.sheet-foot {
		color: #888;
		font-size: 0.78rem;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 0.6rem;
		margin-top: 1.5rem;
	}

	.how {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.how li {
		margin-bottom: 0.5rem;
	}

	.how strong {
		color: #fff;
	}
</style>
