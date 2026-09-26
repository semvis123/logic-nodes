<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import VennDiagram from '$lib/VennDiagram.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseSet, shade, sameShading, setsNeeded, booleanText, evaluateOn, roster } from '$lib/venn';
	import { readUrl, syncUrl, safeText, toolLink } from '$lib/urlState';
	import { onMount } from 'svelte';

	// The one piece of state: which symbol is picked out, so a link can point
	// at a row of the reference table and highlight it.
	onMount(() => {
		const p = readUrl();
		const wanted = safeText(p.symbol, 20);
		if (wanted && symbols.some((s) => s.id === wanted)) {
			highlighted = wanted;
			document.getElementById(`symbol-${wanted}`)?.scrollIntoView({ block: 'center' });
		}
	});
	let highlighted = '';
	$: syncUrl({ symbol: highlighted }, { symbol: '' });

	// Every example below is computed from these sets at build time.
	const universe = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
	const sets = { A: new Set([1, 2, 3, 4]), B: new Set([3, 4, 5, 6]) };
	const value = (expression: string) => roster(evaluateOn(parseSet(expression), sets, universe));
	const subset = (x: Set<number>, y: Set<number>) => [...x].every((v) => y.has(v));
	const small = new Set([1, 2]);
	const tf = (v: boolean) => (v ? 'true' : 'false');

	/** Every subset, smallest first: each item doubles the list, with and without it. */
	function powerSet(items: number[]): number[][] {
		let all: number[][] = [[]];
		for (const item of items) all = [...all, ...all.map((s) => [...s, item])];
		return all.sort((x, y) => x.length - y.length);
	}
	const powerOfSmall = `{${powerSet([...small])
		.map((s) => roster(s))
		.join(', ')}}`;
	const product = [...small].flatMap((x) => ['x', 'y'].map((y) => `(${x}, ${y})`));
	const evens = [...universe].filter((x) => x % 2 === 0);

	type SymbolRow = {
		id: string;
		symbol: string;
		name: string;
		reads: string;
		example: string;
		/** A two-set expression to draw, for the symbols that are operations. */
		diagram?: string;
		logic?: string;
	};

	const rows: SymbolRow[] = [
		{
			id: 'element',
			symbol: '∈',
			name: 'Element of',
			reads: 'is an element of, is in',
			example: `3 ∈ A is ${tf(sets.A.has(3))}`,
			logic: 'x ∈ A is a statement: true or false'
		},
		{
			id: 'not-element',
			symbol: '∉',
			name: 'Not an element of',
			reads: 'is not an element of',
			example: `7 ∉ A is ${tf(!sets.A.has(7))}`,
			logic: '¬(x ∈ A)'
		},
		{
			id: 'subset',
			symbol: '⊆',
			name: 'Subset',
			reads: 'is a subset of',
			example: `{1, 2} ⊆ A is ${tf(subset(small, sets.A))}; A ⊆ A is ${tf(subset(sets.A, sets.A))}`,
			logic: 'x ∈ X → x ∈ Y, for every x'
		},
		{
			id: 'proper-subset',
			symbol: '⊂',
			name: 'Proper subset',
			reads: 'is a proper subset of',
			example: `{1, 2} ⊂ A is ${tf(subset(small, sets.A) && small.size < sets.A.size)}; A ⊂ A is ${tf(false)}`,
			logic: 'X ⊆ Y and X ≠ Y'
		},
		{
			id: 'superset',
			symbol: '⊇',
			name: 'Superset',
			reads: 'is a superset of, contains',
			example: `A ⊇ {3, 4} is ${tf(subset(new Set([3, 4]), sets.A))}`,
			logic: 'x ∈ Y → x ∈ X, for every x'
		},
		{
			id: 'union',
			symbol: '∪',
			name: 'Union',
			reads: 'A union B; in A or B',
			example: `A ∪ B = ${value('A ∪ B')}`,
			diagram: 'A ∪ B',
			logic: '∨ (OR)'
		},
		{
			id: 'intersection',
			symbol: '∩',
			name: 'Intersection',
			reads: 'A intersect B; in A and B',
			example: `A ∩ B = ${value('A ∩ B')}`,
			diagram: 'A ∩ B',
			logic: '∧ (AND)'
		},
		{
			id: 'complement',
			symbol: 'A′\nAᶜ',
			name: 'Complement',
			reads: 'A complement; not in A',
			example: `A′ = ${value('A′')}`,
			diagram: 'A′',
			logic: '¬ (NOT)'
		},
		{
			id: 'difference',
			symbol: 'A − B\nA \\ B',
			name: 'Difference',
			reads: 'A minus B; in A but not B',
			example: `A − B = ${value('A − B')}, B − A = ${value('B − A')}`,
			diagram: 'A − B',
			logic: 'A ∧ ¬B (AND NOT)'
		},
		{
			id: 'symmetric-difference',
			symbol: 'Δ',
			name: 'Symmetric difference',
			reads: 'in A or B but not both',
			example: `A Δ B = ${value('A Δ B')}`,
			diagram: 'A Δ B',
			logic: '⊕ (XOR)'
		},
		{
			id: 'empty',
			symbol: '∅\n{ }',
			name: 'Empty set',
			reads: 'the empty set',
			example: `A ∩ A′ = ${value('A ∩ A′')}`,
			diagram: 'A ∩ A′ ∩ B',
			logic: 'always false (0)'
		},
		{
			id: 'universal',
			symbol: 'U\nξ',
			name: 'Universal set',
			reads: 'the universal set: everything under discussion',
			example: `U = ${roster(universe)}`,
			diagram: 'U ∪ B',
			logic: 'always true (1)'
		},
		{
			id: 'cardinality',
			symbol: '|A|\nn(A)',
			name: 'Cardinality',
			reads: 'the number of elements in A',
			example: `|A| = ${sets.A.size}, |A ∪ B| = ${evaluateOn(parseSet('A ∪ B'), sets, universe).size}`
		},
		{
			id: 'power-set',
			symbol: 'P(A)\n𝒫(A)',
			name: 'Power set',
			reads: 'the set of all subsets of A',
			example: `P({1, 2}) = ${powerOfSmall}`
		},
		{
			id: 'product',
			symbol: '×',
			name: 'Cartesian product',
			reads: 'A cross B: every ordered pair',
			example: `{1, 2} × {x, y} = {${product.join(', ')}}`
		},
		{
			id: 'roster',
			symbol: '{ , }',
			name: 'Roster notation',
			reads: 'the set containing',
			example: `A = ${roster(sets.A)}`
		},
		{
			id: 'set-builder',
			symbol: '{x : …}\n{x | …}',
			name: 'Set-builder notation',
			reads: 'the set of all x such that',
			example: `{x ∈ U : x is even} = ${roster(evens)}`
		},
		{
			id: 'equal',
			symbol: '=',
			name: 'Equal sets',
			reads: 'has exactly the same elements as',
			example: `{1, 2} = {2, 1} is true`,
			logic: 'x ∈ X ↔ x ∈ Y, for every x'
		}
	];
	const symbols = rows.map((s) => ({ ...s, shading: s.diagram ? shade(parseSet(s.diagram), 2) : [] }));

	// Set-builder examples, each computed by filtering or mapping.
	const integers = Array.from({ length: 41 }, (_, i) => i - 20);
	const builder = [
		{ builder: '{x ∈ ℤ : 1 ≤ x ≤ 4}', roster: roster(integers.filter((x) => x >= 1 && x <= 4)) },
		{ builder: '{x ∈ U : x is even}', roster: roster(evens) },
		{ builder: '{x² : x ∈ {1, 2, 3}}', roster: roster([1, 2, 3].map((x) => x * x)) },
		{ builder: '{x ∈ ℤ : x² = 4}', roster: roster(integers.filter((x) => x * x === 4)) },
		{ builder: '{x ∈ ℤ : x² < 0}', roster: roster(integers.filter((x) => x * x < 0)) }
	];

	// Each law is checked on a three-set diagram: both sides must shade the same
	// regions. A law is only marked as checked if that comparison passes.
	const laws = [
		{ name: 'Commutative', left: 'A ∪ B', right: 'B ∪ A' },
		{ name: 'Commutative', left: 'A ∩ B', right: 'B ∩ A' },
		{ name: 'Associative', left: '(A ∪ B) ∪ C', right: 'A ∪ (B ∪ C)' },
		{ name: 'Associative', left: '(A ∩ B) ∩ C', right: 'A ∩ (B ∩ C)' },
		{ name: 'Distributive', left: 'A ∩ (B ∪ C)', right: '(A ∩ B) ∪ (A ∩ C)' },
		{ name: 'Distributive', left: 'A ∪ (B ∩ C)', right: '(A ∪ B) ∩ (A ∪ C)' },
		{ name: "De Morgan's", left: '(A ∪ B)′', right: 'A′ ∩ B′' },
		{ name: "De Morgan's", left: '(A ∩ B)′', right: 'A′ ∪ B′' },
		{ name: 'Complement', left: 'A ∪ A′', right: 'U' },
		{ name: 'Complement', left: 'A ∩ A′', right: '∅' },
		{ name: 'Double complement', left: '(A′)′', right: 'A' },
		{ name: 'Identity', left: 'A ∪ ∅', right: 'A' },
		{ name: 'Identity', left: 'A ∩ U', right: 'A' },
		{ name: 'Domination', left: 'A ∪ U', right: 'U' },
		{ name: 'Domination', left: 'A ∩ ∅', right: '∅' },
		{ name: 'Idempotent', left: 'A ∪ A', right: 'A' },
		{ name: 'Idempotent', left: 'A ∩ A', right: 'A' },
		{ name: 'Absorption', left: 'A ∪ (A ∩ B)', right: 'A' },
		{ name: 'Absorption', left: 'A ∩ (A ∪ B)', right: 'A' },
		{ name: 'Difference', left: 'A − B', right: 'A ∩ B′' }
	].map((law) => {
		const left = parseSet(law.left);
		const right = parseSet(law.right);
		const n = Math.max(2, setsNeeded(left), setsNeeded(right));
		return {
			...law,
			n,
			shading: shade(left, n),
			logic: `${booleanText(left)} = ${booleanText(right)}`,
			checked: sameShading(left, right, 3)
		};
	});

	const unionSize = evaluateOn(parseSet('A ∪ B'), sets, universe).size;
	const interSize = evaluateOn(parseSet('A ∩ B'), sets, universe).size;

	const faqs = [
		{
			q: 'What is the difference between ⊂ and ⊆?',
			a: 'X ⊆ Y means every element of X is also in Y, and allows X and Y to be equal. X ⊂ Y means a proper subset: X ⊆ Y and Y has at least one element X lacks. Some books use ⊂ for plain subset and ⊊ for proper subset, so check which convention a course uses.'
		},
		{
			q: 'What is the difference between ∈ and ⊆?',
			a: '∈ relates an element to a set; ⊆ relates two sets. 3 ∈ A says the number 3 is in A. {3} ⊆ A says the set containing 3 is a subset of A. Writing 3 ⊆ A or {3} ∈ A mixes the two up.'
		},
		{
			q: 'What does A′ mean?',
			a: 'The complement of A: every element of the universal set U that is not in A. It is also written Aᶜ, Ā or U − A. The complement always depends on U; with U = {1, …, 8} and A = {1, 2, 3, 4}, A′ is {5, 6, 7, 8}.'
		},
		{
			q: 'Is A − B the same as B − A?',
			a: `No. Difference is not commutative. With the sets on this page, A − B = ${value('A − B')} and B − A = ${value(
				'B − A'
			)}. Only the symmetric difference A Δ B treats both sides alike.`
		},
		{
			q: 'Why is the empty set a subset of every set?',
			a: 'Because ∅ ⊆ A only claims that every element of ∅ is in A, and ∅ has no elements to break the claim. It is the same reason a conditional with a false "if" part is true in logic.'
		},
		{
			q: 'How do I find the size of a union?',
			a: `Add the sizes and subtract the overlap, which was counted twice: |A ∪ B| = |A| + |B| − |A ∩ B|. Here that is ${sets.A.size} + ${sets.B.size} − ${interSize} = ${unionSize}.`
		},
		{
			q: 'How does set notation relate to logic?',
			a: 'Every set operation is defined by a logical connective on membership: x is in A ∪ B when x ∈ A or x ∈ B, in A ∩ B when x ∈ A and x ∈ B, and in A′ when not x ∈ A. So the laws of set algebra and the laws of boolean algebra are the same laws, and a Venn diagram is a picture of a truth table.'
		}
	];

	const page = {
		title: 'Set Notation: Symbols, Meanings and Venn Diagrams',
		description:
			'Every set notation symbol with its name, how to read it and a worked example: ∈, ⊆, ∪, ∩, complement, Δ, ∅, power set and set-builder notation.',
		url: `${SITE}/set-notation`,
		image: `${SITE}/og/set-notation.png`,
		imageAlt: 'LogicGates.org: set notation symbols and meanings'
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
					{ '@type': 'ListItem', position: 2, name: 'Set notation' }
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
		{ href: '/venn-diagram-generator', label: 'Venn diagram generator' },
		{ href: '/boolean-algebra-laws', label: 'Boolean algebra laws' },
		{ href: '/de-morgans-laws', label: "De Morgan's laws" },
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for logic statements' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<span>Set notation</span>
		</nav>
		<h1>Set notation</h1>
		<p class="lede">
			The symbols of set theory, what each one is called, how to read it aloud and a worked example. Operations come
			with a Venn diagram and the logic connective they match.
		</p>
		<p class="section-intro">
			The examples use the universal set U = {roster(universe)}, with A = {roster(sets.A)} and B = {roster(sets.B)}.
			Each one is computed, not typed in.
		</p>

		<div class="table-wrap">
			<table class="data-table symbols stack">
				<thead>
					<tr>
						<th scope="col">Symbol</th>
						<th scope="col">Name and reading</th>
						<th scope="col">Example</th>
						<th scope="col">Logic</th>
						<th scope="col">Diagram</th>
					</tr>
				</thead>
				<tbody>
					{#each symbols as s}
						<tr id="symbol-{s.id}" class:highlighted={highlighted === s.id}>
							<td class="symbol mono">{s.symbol}</td>
							<td>
								<strong class="name">{s.name}</strong>
								<span class="reads">"{s.reads}"</span>
							</td>
							<td class="mono example">{s.example}</td>
							<td class="logic"
								>{#if s.logic}<span class="mono">{s.logic}</span>{/if}</td
							>
							<td class="diagram-cell">
								{#if s.diagram}
									<a
										class="mini"
										href={toolLink('/venn-diagram-generator', { s: s.diagram })}
										aria-label="Open {s.diagram} in the Venn diagram generator"
									>
										<VennDiagram n={2} shaded={s.shading} small showUniverse={false} label={s.diagram} />
									</a>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Tap a diagram to open it in the <a href="/venn-diagram-generator">Venn diagram generator</a>, where you can shade
			any expression of up to three sets.
		</p>
	</section>

	<section id="set-builder">
		<h2>Roster and set-builder notation</h2>
		<p class="section-intro">
			There are two ways to write a set down. Roster notation lists the elements between braces:
			<span class="mono">{roster(sets.A)}</span>. Order and repeats do not matter, so
			<span class="mono">{'{2, 1, 1}'}</span> is the same set as <span class="mono">{'{1, 2}'}</span>. Set-builder
			notation gives a rule instead: <span class="mono">{'{x : condition}'}</span>, read "the set of all x such that"
			the condition holds. It is the only way to write most infinite sets.
		</p>
		<table class="data-table builder">
			<thead>
				<tr>
					<th scope="col">Set-builder</th>
					<th scope="col">Roster</th>
				</tr>
			</thead>
			<tbody>
				{#each builder as row}
					<tr>
						<td class="mono">{row.builder}</td>
						<td class="mono">{row.roster}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p>
			The operations themselves are defined in set-builder notation, and each definition is a logic statement about
			membership:
		</p>
		<ul class="definitions mono">
			<li>A ∪ B = {'{'}x : x ∈ A ∨ x ∈ B{'}'}</li>
			<li>A ∩ B = {'{'}x : x ∈ A ∧ x ∈ B{'}'}</li>
			<li>A′ = {'{'}x ∈ U : ¬(x ∈ A){'}'}</li>
			<li>A − B = {'{'}x : x ∈ A ∧ x ∉ B{'}'}</li>
			<li>A Δ B = {'{'}x : x ∈ A ⊕ x ∈ B{'}'}</li>
		</ul>
	</section>

	<section id="laws">
		<h2>The laws of set algebra</h2>
		<p class="section-intro">
			These identities hold for any sets A, B and C. Each was checked here by shading both sides on a three-set diagram
			and comparing all eight regions; the diagram shows the shading both sides share.
		</p>
		<div class="table-wrap">
			<table class="data-table laws stack">
				<thead>
					<tr>
						<th scope="col">Law</th>
						<th scope="col">Sets</th>
						<th scope="col">Logic</th>
						<th scope="col">Both sides</th>
						<th scope="col">Check</th>
					</tr>
				</thead>
				<tbody>
					{#each laws as law}
						<tr>
							<td>{law.name}</td>
							<td class="mono nowrap">{law.left} = {law.right}</td>
							<td class="mono logic-cell">{law.logic}</td>
							<td class="diagram-cell">
								<VennDiagram n={law.n} shaded={law.shading} small showUniverse={false} label={law.left} />
							</td>
							<td>
								{#if law.checked}<span class="checked">Checked</span>{:else}<span class="failed">Not verified</span
									>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Every one of these is also a law of boolean algebra, with ∪ as OR, ∩ as AND and ′ as NOT, U as 1 and ∅ as 0:
			compare the <a href="/boolean-algebra-laws">boolean algebra laws</a>, where the same identities are proved with
			truth tables. De Morgan's pair has <a href="/de-morgans-laws">a page of its own</a>.
		</p>
	</section>

	<section id="logic">
		<h2>How set notation maps to logic</h2>
		<p class="section-intro">
			Read each set as the statement "x is in it", and the set operations become the connectives of
			<a href="/propositional-logic-truth-table">propositional logic</a> and the gates of a circuit.
		</p>
		<div class="table-wrap">
			<table class="data-table map">
				<thead>
					<tr>
						<th scope="col">Sets</th>
						<th scope="col">Logic</th>
						<th scope="col">Gate</th>
					</tr>
				</thead>
				<tbody>
					<tr><td class="mono">A ∪ B</td><td class="mono">p ∨ q</td><td><a href="/logic-gates/or">OR</a></td></tr>
					<tr><td class="mono">A ∩ B</td><td class="mono">p ∧ q</td><td><a href="/logic-gates/and">AND</a></td></tr>
					<tr><td class="mono">A′</td><td class="mono">¬p</td><td><a href="/logic-gates/not">NOT</a></td></tr>
					<tr><td class="mono">A − B</td><td class="mono">p ∧ ¬q</td><td>AND with one input inverted</td></tr>
					<tr><td class="mono">A Δ B</td><td class="mono">p ⊕ q</td><td><a href="/logic-gates/xor">XOR</a></td></tr>
					<tr><td class="mono">(A Δ B)′</td><td class="mono">p ↔ q</td><td><a href="/logic-gates/xnor">XNOR</a></td></tr
					>
					<tr><td class="mono">A ⊆ B</td><td class="mono">p → q, for every x</td><td>–</td></tr>
					<tr><td class="mono">U</td><td class="mono">⊤ (true, 1)</td><td>constant 1</td></tr>
					<tr><td class="mono">∅</td><td class="mono">⊥ (false, 0)</td><td>constant 0</td></tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			So A ⊆ B says the conditional "if x is in A, then x is in B" holds for every x, and A = B says the biconditional
			does.
			<a href={toolLink('/propositional-logic-truth-table', { s: 'p ∧ ¬q, ¬(p → q)' })}>Compare p ∧ ¬q with ¬(p → q)</a>
			to see why A ⊆ B is the same as A − B = ∅.
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
		padding-top: 48px;
	}

	.crumbs {
		font-size: 0.8rem;
		color: #999;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #999;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.symbols {
		width: 100%;
	}

	.symbols td {
		vertical-align: middle;
	}

	.symbol {
		font-size: 1.2rem;
		color: #fff;
		white-space: pre;
		line-height: 1.5;
	}

	.name {
		display: block;
		color: #fff;
	}

	.reads {
		color: #bbb;
		font-size: 0.85rem;
	}

	.example {
		color: #ddd;
		font-size: 0.85rem;
	}

	.logic {
		color: #ddd;
		font-size: 0.85rem;
	}

	.diagram-cell {
		width: 96px;
	}

	.diagram-cell > :global(svg),
	.diagram-cell :global(.mini svg) {
		width: 96px;
		max-width: 96px;
	}

	.mini {
		display: block;
		border-radius: 3px;
	}

	.mini:hover :global(svg),
	.mini:focus-visible :global(svg) {
		outline: 2px solid #5db65d;
	}

	tr.highlighted td {
		background-color: rgba(51, 119, 34, 0.2);
	}

	.builder {
		width: auto;
		margin-bottom: 1rem;
	}

	.definitions {
		color: #ddd;
		padding-left: 1.25rem;
		line-height: 1.8;
	}

	.laws {
		width: 100%;
	}

	.laws td {
		vertical-align: middle;
	}

	.nowrap {
		white-space: nowrap;
	}

	.logic-cell {
		color: #bbb;
		font-size: 0.85rem;
	}

	.checked {
		color: #8ede8e;
		white-space: nowrap;
	}

	.checked::before {
		content: '✓ ';
	}

	.failed {
		color: #f66;
	}

	.map {
		width: auto;
	}

	/* On a phone each row of the two tables becomes a small card, with the
	   diagram pinned to its right. */
	@media (max-width: 720px) {
		.stack thead {
			display: none;
		}

		.data-table.stack,
		.stack tbody,
		.stack tr,
		.data-table.stack td {
			display: block;
			width: auto;
		}

		.stack tr {
			position: relative;
			padding: 0.6rem 0;
			min-height: 92px;
			border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		}

		.data-table.stack td {
			border: none;
			padding: 0.1rem 0.6rem;
			margin-right: 104px;
			background: none;
		}

		.data-table.stack td.diagram-cell {
			position: absolute;
			top: 0.6rem;
			right: 0.4rem;
			width: 96px;
			margin: 0;
			padding: 0;
		}

		.stack .nowrap {
			white-space: normal;
		}

		.data-table.stack td.symbol {
			font-size: 1.35rem;
		}
	}
</style>
