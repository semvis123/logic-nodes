<script lang="ts">
	import { onMount } from 'svelte';

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

	const wire = (on: boolean) => (on ? '#5db65d' : '#f23');
	const lamp = (on: boolean) => (on ? '#372' : '#40191c');

	const jsonLd = `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'SoftwareApplication',
				name: 'Logic Nodes',
				url: 'https://nodes.kriyak.com/',
				applicationCategory: 'EducationalApplication',
				operatingSystem: 'Web browser',
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
				description:
					'Free online logic gate simulator. Build and simulate digital logic circuits in the browser, generate truth tables and boolean expressions, and share circuits with a link.',
				screenshot: 'https://nodes.kriyak.com/og-image.png',
				author: {
					'@type': 'Person',
					name: 'Sem',
					url: 'https://kriyak.com/about/',
					'@id': 'https://kriyak.com/#person'
				},
				license: 'https://www.apache.org/licenses/LICENSE-2.0'
			},
			{
				'@type': 'FAQPage',
				mainEntity: [
					{
						'@type': 'Question',
						name: 'Is Logic Nodes free to use?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Yes. Logic Nodes is free, open source (Apache 2.0), and runs entirely in your browser. There is no account, no install, and no tracking.'
						}
					},
					{
						'@type': 'Question',
						name: 'Is Logic Nodes a free alternative to Logic.ly?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Yes. Logic Nodes is a free, open-source logic gate simulator that runs in your browser with no account and no install, so it works as a free alternative to paid tools like Logic.ly for building and simulating digital logic circuits.'
						}
					},
					{
						'@type': 'Question',
						name: 'Where are my circuits saved?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Circuits are saved in your own browser via localStorage, and you can export and import them as files. Nothing is uploaded to a server.'
						}
					},
					{
						'@type': 'Question',
						name: 'Can I share a circuit with someone else?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Yes. A circuit can be encoded into the page URL, so sharing a circuit is sharing a link. The recipient opens it directly in the simulator.'
						}
					},
					{
						'@type': 'Question',
						name: 'Which logic gates does the simulator support?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'AND, OR, NOT, XOR, NAND, and NOR gates, plus clock, delay, counter, button, toggle, and display nodes. You can also package any circuit into a reusable custom node.'
						}
					}
				]
			}
		]
	})}${'<'}/script>`;
</script>

<svelte:head>
	<title>Logic Nodes — Logic Gate Simulator, Truth Tables &amp; Boolean Algebra</title>
	<meta
		name="description"
		content="Free online logic gate simulator and digital circuit builder — an open-source alternative to Logic.ly. Truth tables, boolean expressions, custom nodes, shareable circuits."
	/>
	<link rel="canonical" href="https://nodes.kriyak.com/about" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Logic Nodes" />
	<meta property="og:title" content="About Logic Nodes | Free Online Logic Gate Simulator" />
	<meta
		property="og:description"
		content="A free logic gate simulator that runs in your browser. Truth tables, boolean expressions, custom nodes, and shareable circuits."
	/>
	<meta property="og:url" content="https://nodes.kriyak.com/about" />
	<meta property="og:image" content="https://nodes.kriyak.com/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	{@html jsonLd}
</svelte:head>

<div class="page">
	<header class="topbar">
		<span class="brand"><span class="brand-box" /> Logic Nodes</span>
		<a class="toolbar-btn" href="/">Open the simulator</a>
	</header>

	<section class="hero">
		<div class="hero-copy">
			<h1>Build logic circuits in your&nbsp;browser</h1>
			<p class="sub">
				A free logic gate simulator and digital circuit builder for students, hobbyists, and
				anyone learning digital logic — an open-source alternative to Logic.ly. Wire up gates,
				watch the signals flow, and read off the truth table.
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
			<svg viewBox="0 0 340 190" aria-label="Interactive half adder circuit with inputs A and B, an XOR gate producing the sum and an AND gate producing the carry">
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
			<p class="demo-footer">
				The editor generates tables like this for any circuit you build.
			</p>
		</div>
	</section>

	<section class="features">
		<h2>What it can do</h2>
		<div class="grid">
			<div class="card feature">
				<h3><span class="chip">AND</span> All the basic gates</h3>
				<p>
					AND, OR, NOT, XOR, NAND, and NOR, plus clock, delay, counter, button, toggle, and
					display nodes for interactive, time-dependent circuits.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">0 1</span> Truth table generator</h3>
				<p>
					Build a circuit and read off its complete truth table. It works the other way too:
					fill in a truth table and the simulator constructs a working circuit from it.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">A·B</span> Boolean expressions</h3>
				<p>
					Turn any circuit into its boolean formula, or paste an expression and get a circuit
					back. Optional simplification through the Wolfram Alpha API.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">+</span> Custom nodes</h3>
				<p>
					Package a circuit into a reusable component. Build a half adder once, then drop it
					into bigger designs, up to counters and registers.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">URL</span> Share with a link</h3>
				<p>
					Circuits encode into the URL, so sharing your work is copy-paste. Saves live in your
					browser, with file export and import. Nothing is uploaded.
				</p>
			</div>
			<div class="card feature">
				<h3><span class="chip">undo</span> Proper editor tools</h3>
				<p>
					Pan, zoom to cursor, undo and redo, copy and paste, layers, a minimap, and keyboard
					shortcuts (<kbd>ctrl</kbd>+<kbd>?</kbd> shows the list). Built-in examples include a
					working calculator.
				</p>
			</div>
		</div>
		<div class="mid-cta">
			<a class="cta" href="/">Try it now</a>
			<span class="reducer">It opens with an example circuit you can poke at.</span>
		</div>
	</section>

	<section class="how">
		<h2>How to use it</h2>
		<ol>
			<li>
				<strong>Add gates.</strong> Right-click the canvas (or use the toolbar) and pick a node:
				start with a button, a couple of gates, and a display.
			</li>
			<li>
				<strong>Wire them up.</strong> Drag from a node's output point to another node's input.
				Signal states show live: <span class="dot high" /> high, <span class="dot low" /> low.
			</li>
			<li>
				<strong>Experiment.</strong> Toggle the inputs and watch the circuit respond. Then
				generate the truth table and see your circuit as algebra.
			</li>
		</ol>
	</section>

	<section class="learn">
		<h2>Made for learning digital logic</h2>
		<p>
			Logic Nodes started as a way to understand logic gates properly and grew into a full logic
			gate editor — a node-based editor (a hand-built node canvas) and digital circuit simulator
			in one. It's well suited for boolean algebra homework, building an SR latch or a half adder
			for the first time, or experimenting with feedback and clocks. Teachers can share example
			circuits with a link, and students need nothing but a browser.
		</p>
		<a class="screenshot-frame" href="/" aria-label="Open the simulator">
			<img
				src="/og-image.png"
				alt="The Logic Nodes editor with a circuit of gates, delays, and displays on the canvas"
				loading="lazy"
				width="1200"
				height="630"
			/>
			<span class="screenshot-caption">The editor, with one of the built-in examples</span>
		</a>
	</section>

	<section class="faq">
		<h2>Questions</h2>
		<details open>
			<summary>Is it free?</summary>
			<p>
				Yes. Free, open source under Apache 2.0, and it runs entirely in your browser. No
				account, no tracking.
			</p>
		</details>
		<details>
			<summary>Is it a free alternative to Logic.ly?</summary>
			<p>
				Yes. Logic Nodes is a free, open-source logic gate simulator in the browser, so it works
				as a free alternative to paid tools like Logic.ly for building and simulating digital
				logic circuits.
			</p>
		</details>
		<details>
			<summary>Where are my circuits saved?</summary>
			<p>
				In your own browser (localStorage), with file export and import if you want backups.
				Nothing is uploaded to a server.
			</p>
		</details>
		<details>
			<summary>Can I share circuits?</summary>
			<p>Yes, a circuit can be encoded into the page URL. Sharing a circuit is sharing a link.</p>
		</details>
	</section>

	<section class="final-cta">
		<h2>Ready to build something?</h2>
		<a class="cta big" href="/">Open the simulator</a>
		<p class="reducer">
			The built-in examples include a working calculator. Start from one of those if a blank
			canvas feels like a lot.
		</p>
	</section>

	<footer class="footer">
		<p>
			Built by <a href="https://kriyak.com/">Sem, a freelance software developer</a>.
			Curious about the internals?
			<a href="https://kriyak.com/blog/hand-writing-a-canvas-node-editor/">Read how it's built</a>
			or see the <a href="https://kriyak.com/project/logic-nodes/">project page</a>.
		</p>
		<p>
			<a href="https://github.com/semvis123/logic-nodes">GitHub</a> ·
			<a href="/">Open the simulator</a>
		</p>
	</footer>
</div>

<style>
	:global(html),
	:global(body),
	:global(main) {
		margin: 0;
		padding: 0;
		background-color: #1d1e20;
	}

	.page {
		min-height: 100vh;
		background-color: #1d1e20;
		background-image: linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
		background-size: 45px 45px;
		color: #fff;
		font: normal normal normal 16px/1.6 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 30px;
		background-color: #101010;
		border-bottom: solid 1px #444;
		padding: 0 10px;
		font-size: 14px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #fff;
	}

	/* Like an active input node in the editor: green fill, white border. */
	.brand-box {
		display: inline-block;
		width: 12px;
		height: 12px;
		background-color: #372;
		border: 1px solid #fff;
		border-radius: 3px;
	}

	.toolbar-btn {
		box-sizing: border-box;
		background-color: #060606;
		border: solid 1px rgb(133, 133, 133);
		color: #fff;
		padding: 0 10px;
		height: 26px;
		line-height: 24px;
		text-align: center;
		text-decoration: none;
		font-size: 13px;
		border-radius: 3px;
	}

	.toolbar-btn:hover {
		background-color: #1a1a1a;
	}

	section,
	.footer {
		max-width: 940px;
		margin: 0 auto;
		padding: 0 20px;
	}

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

	h1 {
		font-size: 2.4rem;
		line-height: 1.15;
		margin: 0 0 0.75rem;
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

	.reducer {
		color: #888;
		font-size: 0.85rem;
		margin-top: 0.75rem;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background-color: #372;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #fff;
		text-decoration: none;
		padding: 0.65rem 1.4rem;
		font-weight: 600;
	}

	.cta:hover {
		background-color: #483;
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

	.card {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
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

	h2 {
		font-size: 1.4rem;
		margin: 3.2rem 0 1rem;
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

	kbd {
		font: 600 0.85em ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.55);
		border-bottom-width: 2px;
		border-radius: 3px;
		padding: 0 4px;
		background: #0d0d0f;
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

	.screenshot-frame {
		display: block;
		margin-top: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		overflow: hidden;
		background: #161618;
		text-decoration: none;
	}

	.screenshot-frame img {
		display: block;
		width: 100%;
		height: auto;
	}

	.screenshot-caption {
		display: block;
		color: #888;
		font-size: 0.8rem;
		padding: 0.5rem 0.8rem;
	}

	.faq details {
		background-color: #161618;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		margin-bottom: 8px;
		padding: 0.6rem 0.9rem;
	}

	.faq summary {
		cursor: pointer;
		font-weight: 600;
	}

	.faq p {
		color: #bbb;
		margin: 0.5rem 0 0.2rem;
	}

	.final-cta {
		text-align: center;
		padding-top: 1rem;
	}

	.final-cta .reducer {
		margin-top: 0.9rem;
	}

	.footer {
		border-top: 1px solid #444;
		margin-top: 3.5rem;
		padding-top: 1.5rem;
		padding-bottom: 2.5rem;
		color: #999;
		font-size: 0.92rem;
	}

	.footer a {
		color: #ddd;
	}
</style>
