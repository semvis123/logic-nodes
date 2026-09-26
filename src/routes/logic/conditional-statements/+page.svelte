<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseProp, parsePropInput, propTable, formatProp, equivalenceGroups, type Prop } from '$lib/propositional';
	import { equivalentText } from '$lib/logicReference';
	import { toolLink } from '$lib/urlState';

	const calc = (s: string) => toolLink('/propositional-logic-truth-table', { s });
	const tf = (v: boolean) => (v ? 'T' : 'F');
	const table = (s: string) => propTable(parsePropInput(s));

	// The conditional's own truth table, with the one false row picked out.
	const conditional = table('p → q');
	const falseRow = conditional.statements[0].values.indexOf(false);

	// The four forms, generated from the conditional rather than typed.
	const neg = (p: Prop): Prop => (p.t === 'not' ? p.a : { t: 'not', a: p });
	const forms = (p: Prop, q: Prop) => [
		{ name: 'Conditional', prop: { t: 'imp', a: p, b: q } as Prop, how: 'if p then q' },
		{ name: 'Converse', prop: { t: 'imp', a: q, b: p } as Prop, how: 'swap the parts' },
		{ name: 'Inverse', prop: { t: 'imp', a: neg(p), b: neg(q) } as Prop, how: 'negate both parts' },
		{ name: 'Contrapositive', prop: { t: 'imp', a: neg(q), b: neg(p) } as Prop, how: 'swap and negate' }
	];
	const four = forms({ t: 'var', name: 'p' }, { t: 'var', name: 'q' });
	const fourTable = table(four.map((f) => formatProp(f.prop)).join(', '));
	// Which of the four agree on every row, as the engine finds it.
	const groups = equivalenceGroups(fourTable.statements)
		.filter((g) => g.length > 1)
		.map((g) => g.map((i) => four[i].name.toLowerCase()));

	const square = {
		p: 'it is a square',
		q: 'it is a rectangle',
		notP: 'it is not a square',
		notQ: 'it is not a rectangle'
	};
	const squareForms = [
		{ name: 'Conditional', text: `If ${square.p}, then ${square.q}.`, holds: true },
		{ name: 'Converse', text: `If ${square.q}, then ${square.p}.`, holds: false },
		{ name: 'Inverse', text: `If ${square.notP}, then ${square.notQ}.`, holds: false },
		{ name: 'Contrapositive', text: `If ${square.notQ}, then ${square.notP}.`, holds: true }
	];

	const biconditional = table('p ↔ q, (p → q) ∧ (q → p)');
	const biconditionalSplits = equivalentText('p ↔ q', '(p → q) ∧ (q → p)');

	// English to symbols. The contrapositive column is derived from the parsed
	// statement, so it cannot drift from the translation.
	const translations = [
		{ english: 'If it rains, the match is cancelled.', key: 'r: it rains, c: the match is cancelled', s: 'r → c' },
		{ english: 'The alarm sounds whenever the door opens.', key: 'a: the alarm sounds, d: the door opens', s: 'd → a' },
		{
			english: 'You can vote only if you are 18 or older.',
			key: 'v: you can vote, e: you are 18 or older',
			s: 'v → e'
		},
		{
			english: 'The program compiles only if it has no syntax errors.',
			key: 'c: it compiles, s: it has a syntax error',
			s: 'c → ¬s'
		},
		{ english: 'I will walk unless it rains.', key: 'w: I walk, r: it rains', s: '¬r → w' },
		{
			english: 'Being a square is sufficient for being a rectangle.',
			key: 's: it is a square, r: it is a rectangle',
			s: 's → r'
		},
		{
			english: 'A charged battery is necessary for the car to start.',
			key: 'b: the battery is charged, t: the car starts',
			s: 't → b'
		},
		{
			english: 'You get a refund if and only if you return it within 30 days.',
			key: 'f: you get a refund, d: you return it within 30 days',
			s: 'f ↔ d'
		}
	].map((t) => {
		const prop = parseProp(t.s);
		const contra =
			prop.t === 'imp'
				? formatProp({ t: 'imp', a: neg(prop.b), b: neg(prop.a) })
				: prop.t === 'iff'
				? formatProp({ t: 'iff', a: neg(prop.a), b: neg(prop.b) })
				: '';
		// Only shown when the engine agrees it says the same.
		return { ...t, contra: contra && equivalentText(t.s, contra) ? contra : '' };
	});

	const unlessSame = equivalentText('¬q → p', 'p ∨ q');
	const negationRight = equivalentText('¬(p → q)', 'p ∧ ¬q');
	const negationWrong = equivalentText('¬(p → q)', 'p → ¬q');

	const faqs = [
		{
			q: 'What is a conditional statement?',
			a: 'A conditional statement is a statement of the form "if p, then q", written p → q. p is the antecedent (or hypothesis) and q the consequent (or conclusion). It is false only when p is true and q is false, and true in every other case.'
		},
		{
			q: 'What is the contrapositive of a statement?',
			a: 'The contrapositive of "if p, then q" is "if not q, then not p", written ¬q → ¬p: swap the two parts and negate both. It is logically equivalent to the original, so a statement and its contrapositive are always both true or both false. That is why proving the contrapositive proves the statement.'
		},
		{
			q: 'What is the difference between the converse and the inverse?',
			a: 'The converse swaps the parts: "if q, then p". The inverse negates both parts: "if not p, then not q". Neither is equivalent to the original conditional, but they are equivalent to each other, because the inverse is the contrapositive of the converse.'
		},
		{
			q: 'Why is a conditional true when the "if" part is false?',
			a: 'A conditional only makes a claim about the cases where its antecedent holds. When the antecedent is false the claim is not tested, so it cannot have been broken, and logic counts it as true. This is called vacuous truth. "If it rains, I will take an umbrella" is not broken on a dry day, whatever I carry.'
		},
		{
			q: 'What does "p only if q" mean?',
			a: '"p only if q" means p → q: p cannot happen without q, so whenever p is true, q is. It does not mean q → p. "You can vote only if you are 18" says being 18 is required to vote, not that every 18 year old votes.'
		},
		{
			q: 'What is a biconditional statement?',
			a: 'A biconditional, "p if and only if q", written p ↔ q, is true when p and q have the same truth value and false when they differ. It says both p → q and its converse q → p. Definitions are biconditionals: a triangle is equilateral if and only if all three sides are equal.'
		},
		{
			q: 'How do you negate an if-then statement?',
			a: 'The negation of p → q is p ∧ ¬q: "p happens and q does not". A conditional is false only when the antecedent is true and the consequent false, so that case is exactly its negation. The negation is not another conditional; in particular it is not p → ¬q.'
		}
	];

	const page = {
		title: 'Conditional Statements: Converse, Inverse, Contrapositive',
		description:
			'If-then statements in logic: when p → q is true, its converse, inverse and contrapositive, the biconditional, and necessary and sufficient conditions.',
		url: `${SITE}/logic/conditional-statements`,
		image: `${SITE}/og/logic-conditional-statements.png`,
		imageAlt: 'LogicGates.org: conditional statements, converse, inverse and contrapositive'
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
					{ '@type': 'ListItem', position: 2, name: 'Logic', item: `${SITE}/logic` },
					{ '@type': 'ListItem', position: 3, name: 'Conditional statements' }
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
		{ href: '/logic', label: 'Propositional logic' },
		{ href: '/logic/tautology', label: 'Tautologies' },
		{ href: '/logic/rules-of-inference', label: 'Rules of inference' },
		{ href: '/logic/logical-equivalences', label: 'Logical equivalences' },
		{ href: '/propositional-logic-truth-table', label: 'Truth tables for logic statements' },
		{ href: '/logical-equivalence-calculator', label: 'Logical equivalence calculator' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/">LogicGates.org</a> <span aria-hidden="true">›</span>
			<a href="/logic">Logic</a> <span aria-hidden="true">›</span>
			<span>Conditional statements</span>
		</nav>
		<h1>Conditional statements</h1>
		<p class="lede">
			"If p, then q" is the most used and most misread statement in logic. Here is exactly when it is true, how its
			converse, inverse and contrapositive relate to it, and how to translate "only if", "unless" and "necessary" into
			symbols.
		</p>
	</section>

	<section id="definition">
		<h2>What a conditional statement says</h2>
		<p>
			A <strong>conditional statement</strong> joins two statements with "if ... then": "if p, then q", written
			<span class="mono">p → q</span>. The part after "if" is the <strong>antecedent</strong> (or hypothesis); the part
			after "then" is the <strong>consequent</strong> (or conclusion). It is also called an implication, and read "p implies
			q".
		</p>
		<div class="split">
			<table class="data-table tt">
				<thead>
					<tr>
						<th scope="col" class="mono">p</th>
						<th scope="col" class="mono">q</th>
						<th scope="col" class="mono main">p → q</th>
					</tr>
				</thead>
				<tbody>
					{#each conditional.rows as row, r}
						<tr class:counter={r === falseRow}>
							{#each row as v}<td class={v ? 'bit-1' : 'bit-0'}>{tf(v)}</td>{/each}
							<td class="main {conditional.statements[0].values[r] ? 'bit-1' : 'bit-0'}"
								>{tf(conditional.statements[0].values[r])}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
			<div>
				<p>
					Think of it as a promise: "if you finish the report, I will buy you lunch". The promise is broken in one case
					only, when you finish the report and get no lunch. That is the highlighted row: p true, q false. In every
					other row the promise is kept, so <span class="mono">p → q</span> is true.
				</p>
				<p>
					A conditional does not say that p causes q, or that p is true, or that q is true. It says only that p true and
					q false does not happen. That makes it the same as <span class="mono">¬p ∨ q</span>: "not p, or q".
				</p>
			</div>
		</div>
	</section>

	<section id="vacuous-truth">
		<h2>Vacuous truth: when the "if" part is false</h2>
		<p>
			The two rows where p is false are the ones that surprise people. A conditional with a false antecedent is true
			whatever the consequent says, and is called <strong>vacuously true</strong>. "If 2 + 2 = 5, then the moon is made
			of cheese" is true, because it makes no claim about any situation that actually happens.
		</p>
		<p>
			This is not a trick; it is what makes general rules work. "Every number divisible by 4 is even" means "for every
			n, if n is divisible by 4 then n is even". For n = 7 the antecedent is false. If that instance counted as false,
			the rule would be false, which it is not. So every instance with a false antecedent has to count as true.
		</p>
	</section>

	<section id="converse-inverse-contrapositive">
		<h2>Converse, inverse and contrapositive</h2>
		<p class="section-intro">
			Swap the parts of a conditional, negate them, or both, and you get three related statements:
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Statement</th>
						<th scope="col">Example</th>
					</tr>
				</thead>
				<tbody>
					{#each four as f, i}
						<tr>
							<td class="form-cell">
								<strong>{f.name}</strong>
								<span class="mono nowrap">{formatProp(f.prop)}</span>
								<span class="how">{f.how}</span>
							</td>
							<td>
								{squareForms[i].text}
								<span class={squareForms[i].holds ? 'yes' : 'no'}>{squareForms[i].holds ? 'True' : 'False'}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>The truth table settles which of them say the same thing:</p>
		<div class="table-wrap">
			<table class="data-table tt">
				<thead>
					<tr>
						{#each fourTable.variables as v}<th scope="col" class="mono">{v}</th>{/each}
						{#each fourTable.statements as s, i}
							<th scope="col" class="first">{four[i].name}<br /><span class="mono">{s.label}</span></th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each fourTable.rows as row, r}
						<tr>
							{#each row as v}<td class={v ? 'bit-1' : 'bit-0'}>{tf(v)}</td>{/each}
							{#each fourTable.statements as s}
								<td class="first {s.values[r] ? 'bit-1' : 'bit-0'}">{tf(s.values[r])}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			Columns that match in every row: {#each groups as g, i}<strong>{g.join(' and ')}</strong
				>{#if i < groups.length - 1}; {/if}{/each}. So a conditional is <strong>logically equivalent</strong> to its
			contrapositive, and the converse is equivalent to the inverse, but a conditional is not equivalent to its
			converse.
			<a href={calc('p → q, q → p, ¬p → ¬q, ¬q → ¬p')}>Check it in the calculator</a>.
		</p>
		<p>
			This is why <strong>proof by contrapositive</strong> works. To prove "if n² is even, then n is even", prove
			instead "if n is odd, then n² is odd", which is easier, and which says exactly the same. And it is why the
			converse is a trap: all squares are rectangles, but a rectangle need not be a square. Reasoning from a conditional
			to its converse is the fallacy of <a href="/logic/rules-of-inference#fallacies">affirming the consequent</a>.
		</p>
	</section>

	<section id="biconditional">
		<h2>The biconditional: if and only if</h2>
		<p>
			"p if and only if q", written <span class="mono">p ↔ q</span> and often shortened to "p iff q", says that p and q always
			have the same truth value. It is true when both are true or both are false.
		</p>
		<div class="table-wrap">
			<table class="data-table tt">
				<thead>
					<tr>
						{#each biconditional.variables as v}<th scope="col" class="mono">{v}</th>{/each}
						{#each biconditional.statements as s}<th scope="col" class="mono first">{s.label}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each biconditional.rows as row, r}
						<tr>
							{#each row as v}<td class={v ? 'bit-1' : 'bit-0'}>{tf(v)}</td>{/each}
							{#each biconditional.statements as s}
								<td class="first {s.values[r] ? 'bit-1' : 'bit-0'}">{tf(s.values[r])}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>
			{#if biconditionalSplits}The two columns match: a biconditional is a conditional in both directions,
				<span class="mono">(p → q) ∧ (q → p)</span>, which is where its name comes from.{/if} "If" gives one direction and
			"only if" the other. To prove an "if and only if" theorem you prove both conditionals. Definitions work this way too:
			"a number is even if and only if it is divisible by 2". In circuits the biconditional is the
			<a href="/logic-gates/xnor">XNOR gate</a>, and its negation is exclusive or.
		</p>
	</section>

	<section id="necessary-sufficient">
		<h2>Necessary and sufficient conditions</h2>
		<p>In <span class="mono">p → q</span>:</p>
		<ul class="list">
			<li>
				p is a <strong>sufficient condition</strong> for q: p on its own is enough to guarantee q. Being a square is sufficient
				for being a rectangle.
			</li>
			<li>
				q is a <strong>necessary condition</strong> for p: p cannot happen without q. Being a rectangle is necessary for
				being a square.
			</li>
		</ul>
		<p>
			When p is both necessary and sufficient for q, the two imply each other and <span class="mono">p ↔ q</span>. A
			quick check for which way the arrow points: the sufficient condition goes on the left, the necessary one on the
			right.
		</p>
	</section>

	<section id="phrasings">
		<h2>Ways English says "if p then q"</h2>
		<p class="section-intro">All of these are <span class="mono">p → q</span>:</p>
		<div class="phrases">
			{#each ['if p, then q', 'if p, q', 'q if p', 'p only if q', 'p implies q', 'q whenever p', 'q provided that p', 'p is sufficient for q', 'q is necessary for p', 'q unless not p', 'not p unless q', 'q follows from p'] as phrase}
				<span class="card phrase">{phrase}</span>
			{/each}
		</div>
		<p>
			<strong>"Only if"</strong> is the one that catches people out. "p only if q" puts q on the right: p → q. "I will go
			only if you go" says my going requires yours; it does not promise that I go whenever you do.
		</p>
		<p>
			<strong>"Unless"</strong> means "if not". "p unless q" is <span class="mono">¬q → p</span>{#if unlessSame}, which
				is equivalent to <span class="mono">p ∨ q</span>{/if}. "I will walk unless it rains" says that if it does not
			rain, I walk. Strictly it says nothing about what I do when it does rain, even though in everyday speech people
			often mean that too.
		</p>
	</section>

	<section id="translations">
		<h2>Worked examples: English to symbols</h2>
		<p class="section-intro">
			Pick a letter for each simple statement, find the antecedent, then write the arrow. The last column is the
			contrapositive of each, which says the same thing in other words.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">English</th>
						<th scope="col">Symbols</th>
						<th scope="col">Contrapositive</th>
					</tr>
				</thead>
				<tbody>
					{#each translations as t}
						<tr>
							<td>{t.english}<br /><span class="key">{t.key}</span></td>
							<td class="mono nowrap"><a href={calc(t.s)}>{t.s}</a></td>
							<td class="mono nowrap">{t.contra}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The biconditional has no single contrapositive, but negating both sides gives an equivalent statement, shown in
			its row.
		</p>
	</section>

	<section id="negation">
		<h2>Negating a conditional</h2>
		<p>
			A conditional is false in exactly one row, where p is true and q is false. So its negation is true in exactly that
			row{#if negationRight}: <span class="mono">¬(p → q) ≡ p ∧ ¬q</span>, "p, and not q"{/if}. The negation of "if it
			rains, the match is cancelled" is "it rains and the match is not cancelled".
			{#if !negationWrong}It is not
				<span class="mono">p → ¬q</span>, which differs from <span class="mono">¬(p → q)</span> whenever p is false:
				<a href={calc('¬(p → q), p ∧ ¬q, p → ¬q')}>compare all three</a>.{/if}
			More negations are in the table of <a href="/logic/logical-equivalences#negation">logical equivalences</a>.
		</p>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="list">
			<li>
				<strong>Treating the converse as the same statement.</strong> "If it is a square, it is a rectangle" does not give
				"if it is a rectangle, it is a square".
			</li>
			<li>
				<strong>Reading "only if" as "if".</strong> "p only if q" is <span class="mono">p → q</span>, not
				<span class="mono">q → p</span>.
			</li>
			<li>
				<strong>Thinking a false antecedent makes the conditional false.</strong> It makes it true.
			</li>
			<li>
				<strong>Reading causation into the arrow.</strong> <span class="mono">p → q</span> can be true when p and q have
				nothing to do with each other, as long as p is not true while q is false.
			</li>
			<li>
				<strong>Negating to another conditional.</strong> The negation of <span class="mono">p → q</span> is
				<span class="mono">p ∧ ¬q</span>.
			</li>
		</ul>
		<p>
			Check any of these with the <a href="/propositional-logic-truth-table">truth table calculator</a>, or see which
			statements are always true on the <a href="/logic/tautology">tautology</a> page.
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

	.crumbs {
		font-size: 0.8rem;
		color: #999;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #999;
	}

	.split {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	.split p:first-child {
		margin-top: 0;
	}

	@media (max-width: 600px) {
		.split {
			grid-template-columns: 1fr;
		}
	}

	.tt th,
	.tt td {
		text-align: center;
		white-space: nowrap;
	}

	.tt .first {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.tt .main {
		font-weight: 700;
		background-color: rgba(255, 255, 255, 0.06);
	}

	.tt tr.counter td {
		background-color: rgba(190, 50, 50, 0.25);
	}

	.nowrap {
		white-space: nowrap;
	}

	.yes,
	.no {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 700;
		margin-left: 0.3rem;
	}

	.yes {
		color: #8ede8e;
	}

	.no {
		color: #ff8a8a;
	}

	.form-cell {
		min-width: 8rem;
	}

	.form-cell > * {
		display: block;
	}

	.form-cell strong {
		color: #fff;
		font-weight: 600;
	}

	.how {
		color: #999;
		font-size: 0.8rem;
	}

	.key {
		color: #999;
		font-size: 0.8rem;
	}

	.list {
		color: #ddd;
		padding-left: 1.25rem;
		max-width: 700px;
	}

	.list li {
		margin-bottom: 0.6rem;
	}

	.phrases {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.phrase {
		padding: 0.3rem 0.7rem;
		font-size: 0.9rem;
		color: #ddd;
	}
</style>
