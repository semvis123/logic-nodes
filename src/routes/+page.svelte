<script lang="ts">
	import { onMount } from 'svelte';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';

	// Live half-adder demo: two inputs, XOR for sum, AND for carry.
	let a = false;
	let b = false;
	let interacted = false;
	$: sum = a !== b;
	$: carry = a && b;

	// Auto-play the demo so signals visibly flow on load; hand over control
	// forever on the first real interaction. Skipped under reduced motion.
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const seq: [boolean, boolean][] = [
			[true, false],
			[true, true],
			[false, true],
			[false, false]
		];
		let i = 0;
		const t = setInterval(() => {
			if (interacted) {
				clearInterval(t);
				return;
			}
			[a, b] = seq[i++ % seq.length];
		}, 1400);
		return () => clearInterval(t);
	});

	const toggleA = () => {
		interacted = true;
		a = !a;
	};
	const toggleB = () => {
		interacted = true;
		b = !b;
	};

	// Screenshot carousel. The track is a real scroll container, so touch swipes
	// and no-JS rendering both work; the buttons just drive it programmatically.
	const shots = [
		{
			src: '/boolean-algebra.png',
			title: 'truth table and boolean expression',
			alt: 'A circuit of OR, AND, NOR, NAND and XOR gates in the Logic Nodes editor, next to its generated truth table and boolean expression',
			caption: 'Every circuit comes with its truth table and boolean expression, generated live.'
		},
		{
			src: '/seven-segment.png',
			title: 'seven segment decoder',
			alt: 'A seven segment decoder circuit: four switches feeding a web of AND, OR, NAND, NOR and NOT gates that light up a seven segment display',
			caption: 'A seven segment decoder: four input bits, a web of gates, one lit digit.'
		},
		{
			src: '/calculator.png',
			title: 'four bit calculator',
			alt: 'A four bit calculator in the Logic Nodes editor, built from switches, a four bit adder and seven segment decoder nodes driving three digits',
			caption: 'The built-in calculator, assembled from custom adder and decoder nodes.'
		}
	];

	let track: HTMLDivElement;
	let slide = 0;

	const go = (i: number) => {
		const next = Math.max(0, Math.min(shots.length - 1, i));
		if (!track) return;
		track.scrollTo({
			left: next * track.clientWidth,
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
		slide = next;
	};

	const onScroll = () => {
		if (track.clientWidth) slide = Math.round(track.scrollLeft / track.clientWidth);
	};

	// Arrow keys work once focus is anywhere in the carousel (the buttons).
	const onCarouselKeydown = (e: KeyboardEvent) => {
		if (e.key === 'ArrowRight') e.preventDefault(), go(slide + 1);
		if (e.key === 'ArrowLeft') e.preventDefault(), go(slide - 1);
	};

	const wire = (on: boolean) => (on ? '#5db65d' : '#f23');
	const lamp = (on: boolean) => (on ? '#372' : '#40191c');

	const SITE = 'https://nodes.kriyak.com';

	// Single source of truth for the FAQ: the same array renders the visible
	// <details> list and the FAQPage schema, so the markup can never drift from
	// the structured data (Google requires them to match).
	const faqs = [
		{
			q: 'Is Logic Nodes free?',
			a: 'Yes. Free, open source under Apache 2.0, and it runs entirely in your browser. No account, no install, no tracking.'
		},
		{
			q: 'Which logic gates does it support?',
			a: 'AND, OR, NOT, XOR, NAND and NOR. AND, OR, NAND and NOR take as many inputs as you need, not just two. On top of the gates there are input, toggle, button, constant and microphone nodes, display, output, counter and tone nodes, and interval, delay, splitter, label and HTML overlay nodes.'
		},
		{
			q: 'Can it generate a truth table?',
			a: 'Yes, and in both directions. Build a circuit and the simulator prints its full truth table; or start from an empty canvas, fill in a truth table, and it builds a working circuit that matches.'
		},
		{
			q: 'Can it turn a circuit into a boolean expression?',
			a: 'Yes, and back again: paste a boolean expression onto an empty canvas and you get the circuit. Expressions can be shown in five notations, from the mathematical one to programming operators. Optional simplification runs through Wolfram Alpha and needs your own free App ID in the settings.'
		},
		{
			q: 'Where are my circuits saved?',
			a: 'In your own browser, using localStorage, with an autosave a few seconds after every change. You can also export a design to a JSON file and import it again later. Nothing is uploaded to a server.'
		},
		{
			q: 'Can I share a circuit with someone else?',
			a: 'Export it to a file and send that, or select the nodes and copy: the circuit lands on your clipboard as JSON that anyone can paste straight onto their own canvas. The built-in examples also have direct links, such as nodes.kriyak.com/#example:Calculator.'
		},
		{
			q: 'Does it work on a phone or tablet?',
			a: 'It is built for a mouse and keyboard. Nodes come from the toolbar menus, panning and zooming use the scroll wheel, and there is no pinch to zoom or touch panning yet, so a laptop or desktop is the better experience.'
		},
		{
			q: 'Does it need an internet connection?',
			a: 'Only to load the page. Simulation, saving, truth tables and expressions all run locally in your browser. The single optional exception is Wolfram Alpha simplification, which calls out to their API.'
		}
	];

	// Gate reference. Symbols use the mathematical notation, one of the five the
	// editor can render boolean expressions in.
	const gates = [
		{ name: 'AND', expr: 'a \u2227 b', rule: 'every input is high' },
		{ name: 'OR', expr: 'a \u2228 b', rule: 'at least one input is high' },
		{ name: 'NOT', expr: '\u00ACa', rule: 'its single input is low' },
		{ name: 'XOR', expr: 'a \u22BB b', rule: 'exactly one of its two inputs is high' },
		{ name: 'NAND', expr: '\u00AC(a \u2227 b)', rule: 'any input is low, the inverse of AND' },
		{ name: 'NOR', expr: '\u00AC(a \u2228 b)', rule: 'every input is low, the inverse of OR' }
	];

	// Built-in circuits, openable straight from a link (the editor reads the hash).
	const examples = [
		{
			href: '/simulator#example:Introduction',
			name: 'Introduction',
			blurb: 'A guided first circuit. Start here if gates are new to you.'
		},
		{
			href: '/simulator#example:Rising%20edge%20detector',
			name: 'Rising edge detector',
			blurb: 'A gate and a delay, firing one pulse the moment a signal goes high.'
		},
		{
			href: '/simulator#example:Falling%20edge%20detector',
			name: 'Falling edge detector',
			blurb: 'The mirror image: one pulse as the signal drops back to low.'
		},
		{
			href: '/simulator#example:7%20Segment-display',
			name: '7 segment decoder',
			blurb: 'Four input bits and a web of gates lighting the seven segments of a digit.'
		},
		{
			href: '/simulator#example:Calculator',
			name: 'Four bit calculator',
			blurb: 'Two 4-bit inputs, an adder, and three decoded digits. The full build.'
		}
	];

	// Mirrors the "What it can do" cards; also feeds SoftwareApplication.featureList.
	const featureList = [
		'AND, OR, NOT, XOR, NAND and NOR logic gates',
		'Clock, delay, counter, button, toggle and display nodes',
		'Truth table generator, and circuit generation from a truth table',
		'Boolean expression from a circuit, and a circuit from an expression',
		'Custom nodes: package any circuit into a reusable component',
		'Automatic browser saves, file import and export, clipboard copy and paste',
		'Built-in example circuits, including a working four bit calculator',
		'Editor tools: pan, zoom, undo and redo, copy and paste, layers, minimap'
	];

	const page = {
		title: 'Logic Nodes: Free Online Logic Gate Simulator',
		description:
			'What the Logic Nodes logic gate simulator does: AND, OR, NOT, XOR, NAND and NOR gates, instant truth tables, boolean expressions and reusable custom nodes.',
		url: `${SITE}/`,
		image: `${SITE}/og/home.png`,
		imageAlt: 'Logic Nodes: about'
	};

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				'@id': `${SITE}/#website`,
				url: `${SITE}/`,
				name: 'Logic Nodes',
				description: 'Free online logic gate simulator',
				inLanguage: 'en',
				publisher: { '@id': 'https://kriyak.com/#person' }
			},
			{
				// Same @id as the one the simulator page emits, so both pages
				// describe one entity instead of two competing ones.
				'@type': 'SoftwareApplication',
				'@id': `${SITE}/#app`,
				name: 'Logic Nodes',
				url: `${SITE}/simulator`,
				applicationCategory: 'EducationalApplication',
				applicationSubCategory: 'Logic gate simulator',
				operatingSystem: 'Web browser',
				browserRequirements: 'Requires JavaScript and HTML5 canvas support',
				isAccessibleForFree: true,
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
				description:
					'Free online logic gate simulator. Build and simulate digital logic circuits in the browser, generate truth tables and boolean expressions, and package circuits into reusable custom nodes.',
				featureList,
				screenshot: [`${SITE}/boolean-algebra.png`, `${SITE}/seven-segment.png`, `${SITE}/calculator.png`],
				softwareHelp: { '@id': `${SITE}/#webpage` },
				inLanguage: 'en',
				author: { '@id': 'https://kriyak.com/#person' },
				license: 'https://www.apache.org/licenses/LICENSE-2.0'
			},
			{
				'@type': 'Person',
				'@id': 'https://kriyak.com/#person',
				name: 'Sem',
				url: 'https://kriyak.com/about/',
				jobTitle: 'Software developer',
				sameAs: ['https://github.com/semvis123', 'https://kriyak.com/']
			},
			{
				'@type': ['WebPage', 'FAQPage'],
				'@id': `${SITE}/#webpage`,
				url: page.url,
				name: page.title,
				description: page.description,
				isPartOf: { '@id': `${SITE}/#website` },
				about: { '@id': `${SITE}/#app` },
				primaryImageOfPage: { '@id': `${SITE}/#primaryimage` },
				breadcrumb: { '@id': `${SITE}/#breadcrumb` },
				inLanguage: 'en',
				...modifiedFields(page.url),
				mainEntity: faqs.map((f) => ({
					'@type': 'Question',
					name: f.q,
					acceptedAnswer: { '@type': 'Answer', text: f.a }
				}))
			},
			{
				'@type': 'ImageObject',
				'@id': `${SITE}/#primaryimage`,
				url: page.image,
				contentUrl: page.image,
				width: 1800,
				height: 826,
				caption: page.imageAlt
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${SITE}/#breadcrumb`,
				itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Logic Nodes', item: `${SITE}/` }]
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>{page.title}</title>
	<meta name="description" content={page.description} />
	<link rel="canonical" href={page.url} />
	<meta name="author" content="Sem" />
	<!-- Let Google use full-size image previews and untruncated snippets. -->
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Logic Nodes" />
	<meta property="og:locale" content="en" />
	<meta property="og:title" content={page.title} />
	<meta property="og:description" content={page.description} />
	<meta property="og:url" content={page.url} />
	<meta property="og:image" content={page.image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={page.imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={page.title} />
	<meta name="twitter:description" content={page.description} />
	<meta name="twitter:image" content={page.image} />
	<meta name="twitter:image:alt" content={page.imageAlt} />
	{@html jsonLd}
</svelte:head>

<ContentPage
	related={[
		{ href: '/learn', label: 'Learn digital logic' },
		{ href: '/logic-gates', label: 'The six logic gates' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/boolean-algebra-calculator', label: 'Boolean algebra calculator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' }
	]}
>
	<section class="hero">
		<div class="hero-copy">
			<h1>Build logic circuits in your&nbsp;browser</h1>
			<p class="sub">
				A free logic gate simulator for students, hobbyists, and anyone learning digital logic. Wire up gates, watch the
				signals flow, and read off the truth table.
			</p>
			<div class="hero-actions">
				<a class="cta" href="/">Start building</a>
				<a class="ghost" href="https://github.com/semvis123/logic-nodes">Source on GitHub</a>
			</div>
			<p class="reducer">Free and open source. No account, nothing to install.</p>
			<p class="reducer">Hand-written TypeScript on an HTML5 canvas.</p>
		</div>

		<div class="demo card">
			<p class="demo-hint">A live half adder. Take over by clicking the inputs.</p>
			<svg
				viewBox="0 0 340 190"
				aria-label="Interactive half adder circuit with inputs A and B, an XOR gate producing the sum and an AND gate producing the carry"
			>
				<!-- wires -->
				<path d="M56 55 C 100 55, 100 50, 138 50" fill="none" stroke={wire(a)} stroke-width="2" />
				<path d="M56 55 C 100 55, 95 130, 138 130" fill="none" stroke={wire(a)} stroke-width="2" />
				<path d="M56 135 C 95 135, 100 70, 138 70" fill="none" stroke={wire(b)} stroke-width="2" />
				<path d="M56 135 C 100 135, 100 150, 138 150" fill="none" stroke={wire(b)} stroke-width="2" />
				<path d="M202 60 C 240 60, 240 60, 268 60" fill="none" stroke={wire(sum)} stroke-width="2" />
				<path d="M202 140 C 240 140, 240 140, 268 140" fill="none" stroke={wire(carry)} stroke-width="2" />

				<!-- input A -->
				<g
					class="toggle"
					role="switch"
					aria-checked={a}
					aria-label="Input A"
					tabindex="0"
					on:click={toggleA}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleA())}
				>
					<rect x="16" y="37" width="40" height="36" rx="3" fill={a ? '#372' : '#a22'} stroke="#fff" />
					<text x="36" y="60" text-anchor="middle" fill="#fff">A</text>
				</g>
				<!-- input B -->
				<g
					class="toggle"
					role="switch"
					aria-checked={b}
					aria-label="Input B"
					tabindex="0"
					on:click={toggleB}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleB())}
				>
					<rect x="16" y="117" width="40" height="36" rx="3" fill={b ? '#372' : '#a22'} stroke="#fff" />
					<text x="36" y="140" text-anchor="middle" fill="#fff">B</text>
				</g>

				<!-- gates -->
				<g>
					<rect x="138" y="42" width="64" height="36" rx="3" fill="#161618" stroke="#fff" />
					<text x="170" y="65" text-anchor="middle" fill="#fff">XOR</text>
				</g>
				<g>
					<rect x="138" y="122" width="64" height="36" rx="3" fill="#161618" stroke="#fff" />
					<text x="170" y="145" text-anchor="middle" fill="#fff">AND</text>
				</g>

				<!-- outputs -->
				<g>
					<rect x="268" y="42" width="56" height="36" rx="3" fill={lamp(sum)} stroke="#fff" />
					<text x="296" y="65" text-anchor="middle" fill="#fff">sum</text>
				</g>
				<g>
					<rect x="268" y="122" width="56" height="36" rx="3" fill={lamp(carry)} stroke="#fff" />
					<text x="296" y="145" text-anchor="middle" fill="#fff">carry</text>
				</g>

				<!-- connection points, drawn like the editor draws them -->
				{#each [[56, 55], [56, 135], [138, 50], [138, 70], [138, 130], [138, 150], [202, 60], [202, 140], [268, 60], [268, 140]] as [cx, cy]}
					<circle {cx} {cy} r="3" fill="#fff" />
				{/each}
			</svg>
			<table class="truth" aria-label="Truth table of the half adder, current row highlighted">
				<thead>
					<tr><th>A</th><th>B</th><th>sum</th><th>carry</th></tr>
				</thead>
				<tbody>
					{#each [[false, false], [false, true], [true, false], [true, true]] as [ra, rb]}
						<tr class:active={ra === a && rb === b}>
							<td>{ra ? 1 : 0}</td>
							<td>{rb ? 1 : 0}</td>
							<td>{ra !== rb ? 1 : 0}</td>
							<td>{ra && rb ? 1 : 0}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="demo-footer">The editor generates tables like this for any circuit you build.</p>
		</div>
	</section>

	<section class="features" id="features">
		<h2>What it can do</h2>
		<div class="grid">
			<div class="card feature">
				<h3><span class="chip">AND</span> All the basic gates</h3>
				<p>
					<a href="/logic-gates">AND, OR, NOT, XOR, NAND and NOR</a>, plus clock, delay, counter, button, toggle and
					display nodes for interactive, time-dependent circuits.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">0 1</span> Truth table generator</h3>
				<p>
					Build a circuit and read off its complete truth table. It works the other way too: fill in a truth table and
					the simulator constructs a working circuit from it. There is a standalone
					<a href="/truth-table-generator">truth table generator</a> here too.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">A·B</span> Boolean expressions</h3>
				<p>
					Turn any circuit into its boolean formula, or paste an expression and get a circuit back. The
					<a href="/boolean-algebra-calculator">boolean algebra calculator</a> simplifies and compares expressions on their
					own.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">+</span> Custom nodes</h3>
				<p>
					Package a circuit into a reusable component. Build a half adder once, then drop it into bigger designs, up to
					counters and registers.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">JSON</span> Yours to keep</h3>
				<p>
					Circuits autosave in your browser. Export a design to a file, import it back, or copy a selection to your
					clipboard as JSON someone else can paste onto their canvas. Nothing is uploaded.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">undo</span> Proper editor tools</h3>
				<p>
					Pan, zoom to cursor, undo and redo, copy and paste, layers, a minimap, and keyboard shortcuts (<kbd>ctrl</kbd
					>+<kbd>/</kbd> shows the list). Built-in examples include a working calculator.
				</p>
			</div>
		</div>
		<div class="mid-cta">
			<a class="cta" href="/">Try it now</a>
			<span class="reducer">It opens with an example circuit you can poke at.</span>
		</div>
	</section>

	<section class="how" id="how-to-use">
		<h2>How to use it</h2>
		<ol>
			<li>
				<strong>Add gates.</strong> Pick nodes from the toolbar menus: <em>Input</em> for a toggle or a button,
				<em>Logic</em>
				for the gates themselves, <em>Output</em> for a display. Start with two toggles, one gate, and a display.
			</li>
			<li>
				<strong>Wire them up.</strong> Drag from a node's output point to another node's input. Signal states show live:
				<span class="dot high" />
				high, <span class="dot low" /> low.
			</li>
			<li>
				<strong>Experiment.</strong> Toggle the inputs and watch the circuit respond. Then generate the truth table and see
				your circuit as algebra.
			</li>
		</ol>
	</section>

	<section class="gates" id="gates">
		<h2>Every gate, and what it does</h2>
		<p class="section-intro">
			Six logic gates cover everything in digital logic. These are the ones you get, with the boolean expression the
			editor writes for each.
		</p>
		<table class="data-table gate-table">
			<thead>
				<tr>
					<th scope="col">Gate</th>
					<th scope="col">Expression</th>
					<th scope="col">Output is high when&hellip;</th>
				</tr>
			</thead>
			<tbody>
				{#each gates as gate}
					<tr>
						<th scope="row">{gate.name}</th>
						<td class="expr">{gate.expr}</td>
						<td>{gate.rule}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="reducer">
			AND, OR, NAND and NOR take as many inputs as you need, not just two. Expressions render in five notations, from <span
				class="expr">a &and; b</span
			>
			to <span class="expr">a &amp;&amp; b</span>
			to <span class="expr">a &middot; b</span> &mdash; pick one in the settings.
		</p>
	</section>

	<section class="examples-list" id="circuits">
		<h2>Circuits to open right now</h2>
		<p class="section-intro">
			Each of these links opens the simulator with the circuit already loaded, wired and running.
		</p>
		<ul class="example-links">
			{#each examples as example}
				<li>
					<a href={example.href}>{example.name}</a>
					<span>{example.blurb}</span>
				</li>
			{/each}
		</ul>
		<p class="reducer">
			Good ones to build yourself next: a half adder (an XOR and an AND), a full adder made from two half adders, an SR
			latch from two NOR gates feeding back into each other, and a multiplexer.
			<a href="/learn">The learning path</a> walks through all of them in order.
		</p>
	</section>

	<section class="learn" id="examples">
		<h2>Made for learning digital logic</h2>
		<p>
			Logic Nodes started as a way to understand logic gates properly and grew into a full circuit editor. It's well
			suited for boolean algebra homework, building an SR latch or a half adder for the first time, or experimenting
			with feedback and clocks. Teachers can share example circuits with a link, and students need nothing but a
			browser.
		</p>
		<div
			class="carousel"
			role="group"
			aria-roledescription="carousel"
			aria-label="Screenshots of circuits built in Logic Nodes"
			on:keydown={onCarouselKeydown}
		>
			<!-- Native scroll-snap track: swipes on touch and works without JS. -->
			<div class="track" bind:this={track} on:scroll={onScroll}>
				{#each shots as shot, i}
					<figure class="slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${shots.length}`}>
						<img
							src={shot.src}
							alt={shot.alt}
							width="1800"
							height="826"
							loading={i === 0 ? 'eager' : 'lazy'}
							decoding="async"
						/>
						<figcaption>{shot.caption}</figcaption>
					</figure>
				{/each}
			</div>

			<button
				class="arrow prev"
				type="button"
				aria-label="Previous screenshot"
				disabled={slide === 0}
				on:click={() => go(slide - 1)}
			>
				&lsaquo;
			</button>
			<button
				class="arrow next"
				type="button"
				aria-label="Next screenshot"
				disabled={slide === shots.length - 1}
				on:click={() => go(slide + 1)}
			>
				&rsaquo;
			</button>

			<div class="dots">
				{#each shots as shot, i}
					<button
						type="button"
						class="dot-btn"
						class:current={i === slide}
						aria-label={`Show screenshot ${i + 1}: ${shot.title}`}
						aria-current={i === slide}
						on:click={() => go(i)}
					/>
				{/each}
			</div>
		</div>
		<p class="reducer carousel-hint">
			Built with the editor itself. <a href="/">Open the simulator</a> to poke at circuits like these.
		</p>
	</section>

	<section class="faq" id="faq">
		<h2>Questions</h2>
		<!-- Rendered from `faqs` so the visible answers and the FAQPage schema match. -->
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
	</section>

	<section class="final-cta">
		<h2>Ready to build something?</h2>
		<a class="cta big" href="/">Open the simulator</a>
		<p class="reducer">
			The built-in examples include a working calculator. Start from one of those if a blank canvas feels like a lot.
		</p>
	</section>
</ContentPage>

<style>
	.hero {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 2.5rem;
		align-items: center;
		padding-top: 64px;
		padding-bottom: 40px;
	}

	@media (max-width: 760px) {
		.hero {
			grid-template-columns: 1fr;
			padding-top: 40px;
		}
	}

	.sub {
		color: #bbb;
		margin: 0 0 1.5rem;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.cta.big {
		font-size: 1.1rem;
		padding: 0.8rem 1.8rem;
	}

	.ghost {
		color: #bbb;
		text-decoration: none;
		padding: 0.65rem 0.25rem;
	}

	.ghost:hover {
		color: #fff;
		text-decoration: underline;
	}

	.demo {
		padding: 1rem 1.1rem 0.8rem;
	}

	.demo-hint {
		margin: 0 0 0.4rem;
		color: #ddd;
		font-size: 0.9rem;
	}

	.demo svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.demo svg text {
		font: normal 14px 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.toggle {
		cursor: pointer;
	}

	.toggle:hover rect {
		stroke-width: 2;
	}

	.toggle:focus {
		outline: 1px dashed #aaa;
	}

	.demo svg path {
		transition: stroke 0.25s ease;
	}

	.demo svg rect {
		transition: fill 0.25s ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.demo svg path,
		.demo svg rect {
			transition: none;
		}
	}

	.truth {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		margin-top: 0.6rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.truth th,
	.truth td {
		border: 1px solid rgba(255, 255, 255, 0.2);
		text-align: center;
		padding: 0.15rem 0.4rem;
		color: #bbb;
	}

	.truth tr.active td {
		background-color: rgba(51, 119, 34, 0.35);
		color: #fff;
	}

	.demo-footer {
		color: #888;
		font-size: 0.8rem;
		margin: 0.6rem 0 0.2rem;
	}

	.dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.5);
	}

	.dot.high {
		background-color: #5db65d;
	}

	.dot.low {
		background-color: #f23;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 12px;
	}

	.feature {
		padding: 1rem 1.1rem;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.feature:hover {
		border-color: rgba(255, 255, 255, 0.75);
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.feature,
		.feature:hover {
			transition: none;
			transform: none;
		}
	}

	.feature h3 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.chip {
		font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #ddd;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		padding: 3px 5px;
		background: #0d0d0f;
	}

	.feature p {
		margin: 0;
		color: #bbb;
		font-size: 0.92rem;
	}

	.mid-cta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}

	.mid-cta .reducer {
		margin: 0;
	}

	.how ol {
		padding-left: 1.25rem;
		color: #ddd;
	}

	.how li {
		margin-bottom: 0.8rem;
	}

	.learn p {
		color: #bbb;
		max-width: 640px;
	}

	.gate-table {
		width: 100%;
	}

	.gate-table :global(tbody th) {
		color: #fff;
		font: 600 0.9rem ui-monospace, SFMono-Regular, Menlo, monospace;
		width: 5.5rem;
	}

	.expr {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #ddd;
		white-space: nowrap;
	}

	.example-links {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.example-links li {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		padding: 0.7rem 0.9rem;
	}

	.example-links a {
		color: #fff;
		font-weight: 600;
		text-decoration: none;
		border-bottom: 1px solid rgba(93, 182, 93, 0.7);
	}

	.example-links a:hover {
		color: #8ede8e;
	}

	.example-links span {
		display: block;
		color: #bbb;
		font-size: 0.9rem;
		margin-top: 0.15rem;
	}

	.carousel {
		position: relative;
		margin-top: 1.25rem;
	}

	.track {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-behavior: smooth;
		scrollbar-width: none;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		background: #161618;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.track:focus-visible {
		outline: 1px dashed #aaa;
		outline-offset: 2px;
	}

	.slide {
		flex: 0 0 100%;
		scroll-snap-align: start;
		margin: 0;
		min-width: 0;
	}

	.slide img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1800 / 826;
	}

	.slide figcaption {
		color: #888;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.arrow {
		position: absolute;
		top: calc(50% - 1rem);
		transform: translateY(-50%);
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(6, 6, 6, 0.85);
		border: 1px solid rgb(133, 133, 133);
		border-radius: 3px;
		color: #fff;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}

	.arrow:hover:not(:disabled) {
		background-color: #1a1a1a;
	}

	.arrow:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.arrow.prev {
		left: 10px;
	}

	.arrow.next {
		right: 10px;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-top: 0.7rem;
	}

	.dot-btn {
		width: 10px;
		height: 10px;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 50%;
		background-color: transparent;
		cursor: pointer;
	}

	.dot-btn.current {
		background-color: #5db65d;
		border-color: #5db65d;
	}

	.carousel-hint a {
		color: #ddd;
	}

	/* On touch widths the track is swipeable, so the arrows only get in the way. */
	@media (max-width: 700px) {
		.arrow {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.track {
			scroll-behavior: auto;
		}
	}

	.final-cta {
		text-align: center;
		padding-top: 1rem;
	}

	.final-cta .reducer {
		margin-top: 0.9rem;
	}
</style>
