<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { latches } from '$lib/latches';
	import { parseExpression, evaluate } from '$lib/boolean';
	import { pattern, timingToSvg, timingAlt, type Signal, type Level } from '$lib/timing';

	// A latch is level sensitive, so its step diagram shows Q settled in the
	// same column as the inputs that produced it: each column is a moment, not
	// a clock cycle, and there are no edges to mark.
	const built = latches.map((latch) => {
		const ast = parseExpression(latch.equation);
		const inputs: Signal[] = latch.demo.map((bits, i) => pattern(latch.labels[i], bits));
		const bits: Level[] = [];
		let q = false;
		for (let step = 0; step < latch.demo[0].length; step++) {
			const values: Record<string, boolean> = { q };
			latch.inputs.forEach((name, i) => (values[name] = latch.demo[i][step] === '1'));
			q = evaluate(ast, values);
			bits.push(q ? 1 : 0);
		}
		const signals = [...inputs, { name: 'Q', bits, coloured: true }];
		return {
			...latch,
			svg: timingToSvg(signals, { caption: latch.equationText, showCycles: true }),
			printSvg: timingToSvg(signals, { caption: latch.equationText, showCycles: true, palette: 'mono' }),
			alt: timingAlt(signals)
		};
	});

	const faqs = [
		{
			q: 'What is an SR latch?',
			a: 'The simplest circuit that remembers one bit. Two cross-coupled gates, each feeding an input of the other, give it two stable states. A pulse on the set input drives the output to 1 and it stays there; a pulse on reset drives it to 0 and it stays there. With neither input active the latch holds its last value, which is what makes it memory.'
		},
		{
			q: 'How do you build an SR latch from NOR gates?',
			a: 'Take two NOR gates. Connect the output of the first to one input of the second, and the output of the second to one input of the first. The two free inputs are S and R, and the two outputs are Q and its complement. Raising S makes Q go high; raising R makes it go low; both low holds. Both high at once is the one input you must not give it.'
		},
		{
			q: 'How do you build an SR latch from NAND gates?',
			a: 'Exactly the same wiring with NAND gates instead. The difference is polarity: a NAND latch is set and reset by a 0 rather than a 1, so its inputs are written S̄ and R̄, the resting state is both inputs high, and both low is the forbidden case. It is the version most textbooks draw and the one on classic parts such as the 74279 quad latch, since NAND is the cheaper gate in CMOS.'
		},
		{
			q: 'Why is S = R = 1 forbidden on an SR latch?',
			a: 'With both inputs of a NOR latch high, both NOR gates output 0, so Q and Q̄ are both 0 and no longer opposites. Worse, if the two inputs then drop at the same moment, which state the latch settles into depends on which gate happens to be a fraction faster, so the result is unpredictable. Designs either guarantee the combination never happens, or use a JK flip-flop, which turns that case into a toggle.'
		},
		{
			q: 'What is the difference between an SR latch and an SR flip-flop?',
			a: 'A latch is level sensitive: it responds the moment its inputs change, for as long as they stay changed. A flip-flop is edge triggered: it looks at its inputs only at the instant of a clock edge and ignores them the rest of the time. A gated latch is halfway between the two, responding only while an enable line is high. An edge-triggered SR flip-flop is two gated latches in a master-slave pair, driven by opposite phases of the clock, so the output can only move at the edge between them.'
		},
		{
			q: 'What is a D latch?',
			a: 'A gated SR latch with R wired to the inverse of S, so the forbidden input can never happen. The single data input D is copied to Q while the enable is high, which is why it is also called a transparent latch, and Q freezes at its last value when the enable drops. Two D latches back to back, enabled on opposite phases, make an edge-triggered D flip-flop.'
		},
		{
			q: 'What is an SR latch used for?',
			a: 'Debouncing a mechanical switch, holding a fault or alarm flag until it is explicitly cleared, arbitrating between two requests so that whichever arrives first wins, and as the storage element inside flip-flops and registers. Anything that needs to remember a single bit without a clock is a latch of this kind, or something built on the same feedback loop.'
		}
	];

	const page = {
		title: 'SR Latch: NOR and NAND Circuits, Truth Table and Timing',
		description:
			'How the SR latch works: the NOR and NAND versions, the gated SR latch and the D latch, each with its truth table and a step diagram, plus why S = R = 1 is forbidden and how a latch differs from a flip-flop.',
		url: `${SITE}/sr-latch`,
		image: `${SITE}/og/sr-latch.png`,
		imageAlt: 'LogicGates.org: the SR latch'
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
					{ '@type': 'ListItem', position: 1, name: 'LogicGates.org', item: `${SITE}/` },
					{ '@type': 'ListItem', position: 2, name: 'Flip-flops', item: `${SITE}/flip-flops` },
					{ '@type': 'ListItem', position: 3, name: 'SR latch' }
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
		{ href: '/flip-flops', label: 'Flip-flops' },
		{ href: '/flip-flops/sr', label: 'The SR flip-flop' },
		{ href: '/combinational-vs-sequential', label: 'Combinational vs sequential' },
		{ href: '/finite-state-machines', label: 'Finite state machines' },
		{ href: '/learn/the-sr-latch', label: 'Build one in the simulator' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/flip-flops">Flip-flops</a> <span aria-hidden="true">/</span>
			<span>SR latch</span>
		</nav>
		<h1>The SR latch</h1>
		<p class="lede">
			Two gates, each feeding the other, and suddenly a circuit can remember. The SR latch is the smallest piece of
			memory in digital logic and the idea inside every flip-flop, register and static RAM cell.
		</p>
	</section>

	<section id="what-is-a-latch">
		<h2>What a latch is</h2>
		<p>
			A latch is a circuit with two stable states that stays in whichever one it was last pushed into. That is all
			memory means at the level of gates: a value that persists after the input that caused it has gone away. Every gate
			on the <a href="/logic-gates">gates page</a> is combinational, its output fixed by its inputs right now. A latch escapes
			that by feedback. Route a gate's output back round to an input and the circuit's present output becomes one of the
			things that decides its next output, so it has a past.
		</p>
		<p>
			The SR latch has two inputs, <strong>set</strong> and <strong>reset</strong>, and an output Q. Pulse set and Q
			becomes 1 and stays 1. Pulse reset and Q becomes 0 and stays 0. Leave both inputs alone and Q holds. Its
			complement Q̄ is available on the other gate for free.
		</p>
	</section>

	{#each built as latch}
		<section id={latch.slug}>
			<h2>{latch.name}</h2>
			<p class="section-intro">{latch.tagline}</p>

			{#if latch.slug === 'nor'}
				<p>
					Take two <a href="/logic-gates/nor">NOR gates</a>. The output of each goes into one input of the other, and
					the two inputs left over are S and R. Call the gate that takes R the Q gate, and the gate that takes S the Q̄
					gate. A NOR outputs 1 only when both of its inputs are 0, so with S and R both low each gate is held by the
					other: if Q is 1, the Q̄ gate sees that 1 and outputs 0, and the Q gate sees R = 0 and Q̄ = 0 and keeps Q at 1.
					Raise S and the Q̄ gate is forced to 0, so the Q gate now sees two 0s and goes to 1: the pair has flipped, and
					dropping S again leaves it there. Raising R forces the Q gate to 0 in the same way.
				</p>
			{:else if latch.slug === 'nand'}
				<p>
					The same wiring with <a href="/logic-gates/nand">NAND gates</a> gives a latch that is set and reset by a 0 rather
					than a 1, because a NAND output is forced, to 1, only when an input goes low. Its inputs are therefore written
					S̄ and R̄, both sit at 1 when idle, and a 0 on S̄ sets while a 0 on R̄ resets. It is the same machine with the polarity
					flipped, and the more common of the two inside real chips, since NAND is the smaller and faster gate in CMOS.
				</p>
			{:else if latch.slug === 'gated'}
				<p>
					Put an AND gate in front of each input and feed an enable line E into both, and the latch only listens while E
					is high. While E is low, S and R can do what they like and Q holds. This is the step towards a flip-flop:
					instead of responding at any moment, the latch responds only during a window that something else controls.
				</p>
			{:else}
				<p>
					Tie the reset of a gated SR latch to the inverse of its set, so that a single data line D drives both, and the
					forbidden combination can no longer happen. While E is high, Q simply copies D, which is why this is also
					called a transparent latch. When E drops, Q freezes at whatever D was last. Two of these back to back, enabled
					on opposite halves of a clock, make an edge-triggered
					<a href="/flip-flops/d">D flip-flop</a>.
				</p>
			{/if}

			<div class="layout">
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								{#each latch.labels as label}
									<th scope="col" class="mono">{label}</th>
								{/each}
								<th scope="col" class="mono">Q</th>
								<th scope="col" class="mono next-col">Q⁺</th>
								<th scope="col">Effect</th>
							</tr>
						</thead>
						<tbody>
							{#each latch.characteristic as row}
								<tr class:invalid={row.next === 'invalid'}>
									{#each row.inputs as bit}
										<td class={bit === 'X' ? 'bit-x' : bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
									{/each}
									<td class={row.q === '1' ? 'bit-1' : 'bit-0'}>{row.q}</td>
									<td class="next-col {row.next === 'invalid' ? 'bit-x' : row.next === '1' ? 'bit-1' : 'bit-0'}">
										{row.next === 'invalid' ? '—' : row.next}
									</td>
									<td class="effect">{row.note}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="side">
					<p class="equation mono">{latch.equationText}</p>
					<p class="side-note">
						Q⁺ is the state the latch settles into; X means the input does not matter. The equation is the table written
						as algebra, and the diagram below is simulated from it.
					</p>
				</div>
			</div>

			<figure class="timing">
				<div class="timing-scroll screen-only" role="img" aria-label={`Step diagram for ${latch.name}. ${latch.alt}`}>
					{@html latch.svg}
				</div>
				<div class="timing-scroll print-only" aria-hidden="true">{@html latch.printSvg}</div>
				<figcaption>
					Each column is a moment. Q settles a gate delay after the inputs change, and holds through every column where
					nothing is asking it to move.
				</figcaption>
			</figure>
		</section>
	{/each}

	<section id="forbidden">
		<h2>The forbidden input</h2>
		<p>
			Raise S and R together on a NOR latch and both gates are forced to 0, so Q and Q̄ are both 0 and no longer
			opposites. That alone breaks anything downstream that relied on one being the inverse of the other. The real
			trouble comes when the two inputs then fall at the same moment: each gate wants to go high if the other stays low,
			and which one wins depends on which is a fraction of a nanosecond faster. The latch may settle either way, or even
			oscillate briefly. The state after that is not predictable, which is why the row is marked as not allowed rather
			than filled in. The <a href="/flip-flops/jk">JK flip-flop</a> exists largely to give that input combination a meaning:
			toggle.
		</p>
	</section>

	<section id="latch-vs-flip-flop">
		<h2>Latch or flip-flop?</h2>
		<p>
			A latch is <strong>level sensitive</strong>. It responds to its inputs whenever they change, for as long as they
			stay changed, and in the gated versions whenever the enable is high. A <a href="/flip-flops">flip-flop</a> is
			<strong>edge triggered</strong>: it samples its inputs at the instant of a clock edge and ignores them at every
			other moment. That difference is the whole reason clocks exist. With a latch, a signal that changes twice while
			the enable is high gets through twice; with a flip-flop it is seen exactly once per cycle, at a predictable
			instant, and everything downstream can be designed around that instant. The
			<a href="/combinational-vs-sequential">combinational vs sequential</a> page has the longer version.
		</p>
	</section>

	<section id="uses">
		<h2>Where it is used</h2>
		<ul class="uses">
			<li>
				<strong>Switch debouncing.</strong> A mechanical switch bounces for milliseconds. Wire the two contacts of a changeover
				switch to set and reset and the latch flips on the first touch and ignores every bounce after it.
			</li>
			<li>
				<strong>Fault and alarm flags.</strong> A condition that lasted a microsecond sets the latch, and the flag stays
				up until something explicitly resets it.
			</li>
			<li>
				<strong>Arbitration.</strong> Two requests race for a resource; whichever sets the latch first wins and holds it.
			</li>
			<li>
				<strong>Inside every flip-flop.</strong> D, JK and T flip-flops are classically an SR latch with logic in front of
				it, and a static RAM cell is the same feedback loop, two cross-coupled inverters, behind two access transistors.
			</li>
		</ul>
	</section>

	<section id="build">
		<h2>Build one</h2>
		<p>
			Two NOR gates, two toggles and two displays, with each gate's output wired back into the other's input. Set and
			reset it, then try both inputs high and watch what happens when you release them. Seeing the feedback path settle
			is worth more than reading about it.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			It is step 5 of <a href="/learn/the-sr-latch">the learning path</a>. The clocked version, with its characteristic and
			excitation tables and a demo you can clock, is on the <a href="/flip-flops/sr">SR flip-flop page</a>.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about the SR latch</h2>
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
		color: #888;
		margin-bottom: 0.6rem;
	}

	.crumbs span {
		color: #888;
	}

	.layout {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 16px;
		align-items: start;
		margin: 1rem 0;
	}

	@media (max-width: 700px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.next-col {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}

	.effect {
		color: #888;
		font-size: 0.85rem;
	}

	tr.invalid td {
		opacity: 0.55;
	}

	.equation {
		color: #8ede8e;
		font-size: 1.05rem;
		margin: 0;
	}

	.side-note {
		color: #bbb;
		font-size: 0.88rem;
		margin: 0.6rem 0 0;
	}

	.timing {
		margin: 0;
	}

	.print-only {
		display: none;
	}

	.timing-scroll {
		overflow-x: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		background: #1d1e20;
	}

	.timing-scroll :global(svg) {
		display: block;
		min-width: 100%;
	}

	.timing figcaption {
		color: #999;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}

	.uses {
		color: #ddd;
		max-width: 700px;
		padding-left: 1.25rem;
	}

	.uses li {
		margin-bottom: 0.5rem;
	}

	.uses strong {
		color: #fff;
	}
</style>
