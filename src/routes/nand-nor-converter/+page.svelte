<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		parseExpression,
		truthTable,
		toUniversal,
		countUniversalGates,
		formatUniversal,
		format,
		equivalent,
		BooleanError,
		type UniversalKind
	} from '$lib/boolean';

	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = { expr: 'a | (b & !c)', gate: 'nand' };
	onMount(() => {
		const p = readUrl();
		expression = safeText(p.expr) ?? expression;
		kind = safeOption(p.gate, ['nand', 'nor'] as const) ?? kind;
	});
	$: syncUrl({ expr: expression, gate: kind }, DEFAULTS);

	let expression = 'a | (b & !c)';
	let kind: UniversalKind = 'nand';

	let nested = '';
	let pasteable = '';
	let gateCount = 0;
	let originalGates = 0;
	let reading = '';
	let verified = false;
	let error = '';
	$: {
		try {
			const ast = parseExpression(expression);
			truthTable(ast); // rejects anything past the variable limit
			const converted = toUniversal(ast, kind);
			nested = formatUniversal(converted, kind);
			pasteable = format(converted, 'programming');
			gateCount = countUniversalGates(converted);
			originalGates = countOperators(ast);
			reading = format(ast, 'math');
			// Cheap self-check: the rewrite must not change the function.
			verified = equivalent(ast, converted);
			error = '';
		} catch (e) {
			nested = '';
			error = e instanceof BooleanError ? e.message : 'That expression did not parse';
		}
	}

	// Gates in the original, counting shared subexpressions once.
	function countOperators(ast: ReturnType<typeof parseExpression>): number {
		const seen = new Set<string>();
		const key = (n: typeof ast): string => {
			if (n.t === 'var') return n.name;
			if (n.t === 'const') return n.v ? '1' : '0';
			if (n.t === 'not') return `!${key(n.a)}`;
			return `(${key(n.a)}${n.t}${key(n.b)})`;
		};
		const walk = (n: typeof ast) => {
			if (n.t === 'var' || n.t === 'const') return;
			seen.add(key(n));
			if (n.t === 'not') return walk(n.a);
			walk(n.a);
			walk(n.b);
		};
		walk(ast);
		return seen.size;
	}

	const examples = [
		{ label: 'NOT', value: '!a' },
		{ label: 'AND', value: 'a & b' },
		{ label: 'OR', value: 'a | b' },
		{ label: 'XOR', value: 'a ^ b' },
		{ label: 'Half adder carry', value: 'a & b' },
		{ label: 'Three variables', value: 'a | (b & !c)' }
	];

	// The substitution rules, so the output is explainable rather than magic.
	const rules: Record<UniversalKind, { from: string; to: string }[]> = {
		nand: [
			{ from: '¬a', to: 'NAND(a, a)' },
			{ from: 'a ∧ b', to: 'NAND(NAND(a, b), NAND(a, b))' },
			{ from: 'a ∨ b', to: 'NAND(NAND(a, a), NAND(b, b))' },
			{ from: 'a ⊻ b', to: 'NAND(NAND(a, c), NAND(b, c)) where c = NAND(a, b)' }
		],
		nor: [
			{ from: '¬a', to: 'NOR(a, a)' },
			{ from: 'a ∨ b', to: 'NOR(NOR(a, b), NOR(a, b))' },
			{ from: 'a ∧ b', to: 'NOR(NOR(a, a), NOR(b, b))' },
			{ from: 'a ⊻ b', to: 'the NAND construction dualised gives XNOR, then one more NOR inverts it' }
		]
	};

	const faqs = [
		{
			q: 'Why can NAND build every other gate?',
			a: "Because NOT, AND and OR can each be made from NAND alone, and those three are enough to express any boolean function. NOT is a NAND with both inputs tied together, AND is a NAND followed by that NOT, and OR is a NAND fed by two inverted inputs, which is De Morgan's law in gate form. NOR is universal for exactly the same reasons."
		},
		{
			q: 'Why would anyone build a circuit from one kind of gate?',
			a: 'In CMOS a NAND is smaller and faster than the equivalent AND, because AND is physically a NAND with an inverter bolted on. Standardising on one gate also simplifies manufacturing and lets a design use a single part number, which is why NAND dominates real chips.'
		},
		{
			q: 'Is the gate count here the minimum?',
			a: 'It is the count for this particular construction, with identical subcircuits counted once because they would be one shared gate. It is not guaranteed minimal: a smarter factorisation of the original expression can sometimes do better. Simplify the expression first for the best result.'
		},
		{
			q: 'How many NAND gates does XOR need?',
			a: 'Four. The trick is to compute c = NAND(a, b) once and reuse it: XOR is NAND(NAND(a, c), NAND(b, c)). With NOR gates the same shape produces XNOR, so XOR takes five NOR gates because it needs one more to invert the result.'
		}
	];

	const page = {
		title: 'NAND & NOR Converter: Rewrite Any Logic With One Gate',
		description:
			'Convert a boolean expression into a NAND-only or NOR-only circuit, with the gate count and the substitution rules. Free, runs in your browser.',
		url: `${SITE}/nand-nor-converter`,
		image: `${SITE}/og/nand-nor-converter.png`,
		imageAlt: 'Logic Nodes: nand nor converter'
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
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'NAND and NOR converter' }
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
		{ href: '/logic-gates/nand', label: 'The NAND gate' },
		{ href: '/logic-gates/nor', label: 'The NOR gate' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>NAND and NOR converter</h1>
		<p class="lede">
			Rewrite any expression using nothing but NAND gates, or nothing but NOR gates. Both are universal, so every
			circuit has a version made of one gate repeated.
		</p>

		<div class="card tool">
			<label class="field" for="expression">Boolean expression</label>
			<input
				id="expression"
				class="expression-input"
				type="text"
				bind:value={expression}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
			/>
			<div class="controls">
				<div class="chips">
					{#each examples as example}
						<button type="button" class="chip-btn" on:click={() => (expression = example.value)}>
							{example.label}
						</button>
					{/each}
				</div>
				<ShareLink what="the expression" />
				<div class="kind" role="group" aria-label="Target gate">
					<button
						type="button"
						class:active={kind === 'nand'}
						aria-pressed={kind === 'nand'}
						on:click={() => (kind = 'nand')}>NAND only</button
					>
					<button
						type="button"
						class:active={kind === 'nor'}
						aria-pressed={kind === 'nor'}
						on:click={() => (kind = 'nor')}>NOR only</button
					>
				</div>
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else}
				<div class="result" role="status">
					<p class="line">
						<span class="label">Input</span>
						<span class="mono">{reading}</span>
						<span class="count">{originalGates} gate{originalGates === 1 ? '' : 's'}</span>
					</p>
					<p class="line">
						<span class="label">{kind.toUpperCase()} only</span>
						<span class="mono out">{nested}</span>
					</p>
					<p class="line">
						<span class="label">Gates needed</span>
						<span class="mono big">{gateCount}</span>
						<span class="count">
							({kind.toUpperCase()} gates, identical subcircuits counted once{verified
								? '; output checked against the original truth table'
								: ''})
						</span>
					</p>
					<p class="line">
						<span class="label">Paste into the editor</span>
						<span class="mono paste">{pasteable}</span>
					</p>
				</div>
				<p class="hint">
					Copy that last line, open the simulator and press <kbd>ctrl</kbd>+<kbd>E</kbd> to build it from real gates.
				</p>
			{/if}
		</div>
	</section>

	<section>
		<h2>The substitution rules</h2>
		<p class="section-intro">
			The conversion is mechanical: replace each operator with its equivalent built from the target gate, then repeat
			until nothing else is left.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Operation</th>
						<th scope="col">Becomes</th>
					</tr>
				</thead>
				<tbody>
					{#each rules[kind] as rule}
						<tr>
							<th scope="row" class="mono">{rule.from}</th>
							<td class="mono">{rule.to}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The OR rule is <a href="/boolean-algebra-laws">De Morgan's law</a> written as gates: inverting both inputs of a NAND
			turns it into an OR. The AND rule is simpler still, just double negation, since a NAND followed by an inverter is an
			AND. Every identity on this page is checked against a full truth table in the test suite.
		</p>
	</section>

	<section>
		<h2>What it costs</h2>
		<p class="section-intro">
			Rewriting with one gate type is never free. These are the counts for the basic operations.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Operation</th>
						<th scope="col">NAND gates</th>
						<th scope="col">NOR gates</th>
					</tr>
				</thead>
				<tbody>
					<tr><th scope="row" class="mono">¬a</th><td>1</td><td>1</td></tr>
					<tr><th scope="row" class="mono">a ∧ b</th><td>2</td><td>3</td></tr>
					<tr><th scope="row" class="mono">a ∨ b</th><td>3</td><td>2</td></tr>
					<tr><th scope="row" class="mono">a ⊻ b</th><td>4</td><td>5</td></tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			NAND favours AND-heavy logic and NOR favours OR-heavy logic, which is the mirror symmetry you would expect.
			Simplify the expression before converting: a
			<a href="/karnaugh-map-solver">smaller starting circuit</a> converts into a smaller one.
		</p>
	</section>

	<section>
		<h2>Why one gate is enough</h2>
		<p>
			A set of gates is called functionally complete when every boolean function can be built from it. AND, OR and NOT
			together are complete, and the interesting fact is that NAND on its own already contains all three. Tie both its
			inputs together and it is an inverter; follow it with that inverter and it is an AND; invert both inputs first
			and, by De Morgan, it is an OR.
		</p>
		<p>
			The same argument works for <a href="/logic-gates/nor">NOR</a>, and those two are the only two input gates with
			this property. It is not merely a theoretical curiosity: the
			<a href="/logic-gates/nand">NAND gate</a> is the cheapest two input gate in CMOS, so real silicon leans on exactly
			this result. The Apollo Guidance Computer went the other way and was built almost entirely from three input NOR gates.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
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

	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.expression-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.expression-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.controls {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 0.7rem 0 1rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.kind {
		display: inline-flex;
		gap: 4px;
	}

	.kind button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.82rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.kind button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.result {
		border-top: 1px solid rgba(255, 255, 255, 0.15);
		padding-top: 0.9rem;
	}

	.line {
		display: flex;
		gap: 0.8rem;
		align-items: baseline;
		flex-wrap: wrap;
		margin: 0 0 0.6rem;
	}

	.label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 8.5rem;
		flex: none;
	}

	.out {
		color: #8ede8e;
		flex: 1;
		min-width: 0;
		word-break: break-word;
	}

	.paste {
		flex: 1;
		min-width: 0;
		word-break: break-word;
		color: #ddd;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.2rem 0.4rem;
		font-size: 0.85rem;
	}

	.big {
		font-size: 1.3rem;
		color: #fff;
	}

	.count {
		color: #888;
		font-size: 0.75rem;
	}

	.hint {
		color: #888;
		font-size: 0.8rem;
		margin: 0.6rem 0 0;
	}
</style>
