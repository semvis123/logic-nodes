<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { fsms, fsmEquations, walkTable, stateVariables, stateLabels, type Fsm } from '$lib/fsm';
	import { buildCircuit } from '$lib/circuit';
	import { circuitToSvg } from '$lib/exportSvg';
	import { clockSignal, timingToSvg, timingAlt, type Signal, type Level } from '$lib/timing';

	// Everything below the specification is derived: the equations by the
	// Karnaugh map engine from the transition table, the circuit from the
	// equations, and the step diagram from walking the table. The test suite
	// checks that the equations and the table agree on every input.
	const built = fsms.map((fsm) => {
		const equations = fsmEquations(fsm);
		const variables = stateVariables(fsm);
		const labels = stateLabels(fsm);
		const legend = variables.map((v, i) => `${v} = ${labels[i]}`).join(', ');
		const circuit = buildCircuit(equations.map((e) => ({ name: e.name, ast: e.ast })));
		const circuitSvg = circuitToSvg(circuit, { standard: 'ansi', palette: 'colour' });
		const steps = walkTable(fsm, fsm.demo);
		const codes = new Map(fsm.states.map((s) => [s.id, s.code]));
		const signals: Signal[] = [
			clockSignal(steps.length),
			{ name: fsm.input.toUpperCase(), bits: steps.map((s) => (s.input === '1' ? 1 : 0) as Level), coloured: true },
			...labels.map((label, i) => ({
				name: label,
				bits: steps.map((s) => (codes.get(s.state)![i] === '1' ? 1 : 0) as Level),
				coloured: true
			})),
			{ name: 'Z', bits: steps.map((s) => (s.output === '1' ? 1 : 0) as Level), coloured: true }
		];
		return {
			...fsm,
			equations,
			variables,
			labels,
			legend,
			circuitSvg,
			steps,
			timingSvg: timingToSvg(signals, { showEdges: true, showCycles: true }),
			timingPrintSvg: timingToSvg(signals, { showEdges: true, showCycles: true, palette: 'mono' }),
			timingAlt: timingAlt(signals),
			diagram: stateDiagram(fsm)
		};
	});

	/**
	 * Draws the state diagram: states on a circle, transitions as curved arrows
	 * so that a pair going both ways does not overlap, self loops as a small
	 * loop on the outside. Moore machines print the output inside the state,
	 * Mealy machines on the arrow as input/output.
	 */
	function stateDiagram(fsm: Fsm): string {
		const W = 440;
		const H = 340;
		const R = 30;
		const cx = W / 2 + 10;
		const cy = H / 2 + 8;
		const orbit = 100;
		const n = fsm.states.length;
		const pos = new Map(
			fsm.states.map((s, i) => {
				const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
				return [s.id, { x: cx + orbit * Math.cos(angle), y: cy + orbit * Math.sin(angle) }];
			})
		);
		const parts: string[] = [];
		const label = (t: typeof fsm.transitions[number]) => (fsm.kind === 'mealy' ? `${t.input}/${t.output}` : t.input);

		// Merge transitions that share an origin and target into one arrow.
		const merged = new Map<string, { from: string; to: string; labels: string[] }>();
		for (const t of fsm.transitions) {
			const key = `${t.from}>${t.to}`;
			const entry = merged.get(key) ?? { from: t.from, to: t.to, labels: [] };
			entry.labels.push(label(t));
			merged.set(key, entry);
		}

		for (const edge of merged.values()) {
			const a = pos.get(edge.from)!;
			const b = pos.get(edge.to)!;
			const text = edge.labels.join(', ');
			if (edge.from === edge.to) {
				// A small loop on the far side of the state from the centre, with
				// the label just beyond it.
				const ux = (a.x - cx) / orbit;
				const uy = (a.y - cy) / orbit;
				const px = -uy;
				const py = ux;
				const start = { x: a.x + R * (ux * 0.7 + px * 0.7), y: a.y + R * (uy * 0.7 + py * 0.7) };
				const end = { x: a.x + R * (ux * 0.7 - px * 0.7), y: a.y + R * (uy * 0.7 - py * 0.7) };
				const c1 = { x: a.x + ux * 62 + px * 34, y: a.y + uy * 62 + py * 34 };
				const c2 = { x: a.x + ux * 62 - px * 34, y: a.y + uy * 62 - py * 34 };
				parts.push(
					`<path d="M${r(start.x)},${r(start.y)} C${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(end.x)},${r(
						end.y
					)}" class="edge" marker-end="url(#arrow-${fsm.slug})"/>`
				);
				parts.push(`<text x="${r(a.x + ux * 64)}" y="${r(a.y + uy * 64 + 4)}" class="edge-label">${text}</text>`);
				continue;
			}
			// Curve every arrow a little to one side, so the reverse arrow bends
			// the other way, and put the label on the outside of its own bend.
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy);
			const ux = dx / len;
			const uy = dy / len;
			const px = -uy;
			const py = ux;
			const bend = 26;
			const control = { x: (a.x + b.x) / 2 + px * bend, y: (a.y + b.y) / 2 + py * bend };
			const start = { x: a.x + ux * R + px * 5, y: a.y + uy * R + py * 5 };
			const end = { x: b.x - ux * (R + 4) + px * 5, y: b.y - uy * (R + 4) + py * 5 };
			parts.push(
				`<path d="M${r(start.x)},${r(start.y)} Q${r(control.x)},${r(control.y)} ${r(end.x)},${r(
					end.y
				)}" class="edge" marker-end="url(#arrow-${fsm.slug})"/>`
			);
			// The curve passes halfway to the control point; sit the label a little further out.
			const at = { x: (a.x + b.x) / 2 + px * (bend / 2 + 11), y: (a.y + b.y) / 2 + py * (bend / 2 + 11) };
			parts.push(`<text x="${r(at.x)}" y="${r(at.y + 4)}" class="edge-label">${text}</text>`);
		}
		for (const s of fsm.states) {
			const p = pos.get(s.id)!;
			parts.push(`<circle cx="${r(p.x)}" cy="${r(p.y)}" r="${R}" class="state"/>`);
			if (fsm.kind === 'moore') {
				parts.push(`<text x="${r(p.x)}" y="${r(p.y - 4)}" class="state-name">${s.id}</text>`);
				parts.push(`<text x="${r(p.x)}" y="${r(p.y + 12)}" class="state-out">out ${s.output}</text>`);
			} else {
				parts.push(`<text x="${r(p.x)}" y="${r(p.y + 5)}" class="state-name">${s.id}</text>`);
			}
			parts.push(`<text x="${r(p.x)}" y="${r(p.y + R + 16)}" class="state-code">${s.code}</text>`);
		}
		// The reset arrow comes in from the left of the first state, clear of its loop.
		const first = pos.get(fsm.states[0].id)!;
		parts.push(
			`<path d="M${r(first.x - R - 46)},${r(first.y)} L${r(first.x - R - 6)},${r(
				first.y
			)}" class="edge" marker-end="url(#arrow-${fsm.slug})"/>`
		);
		parts.push(`<text x="${r(first.x - R - 26)}" y="${r(first.y - 8)}" class="edge-label reset">reset</text>`);
		return `<svg viewBox="0 0 ${W} ${H}" class="fsm" role="img" aria-label="State diagram of the ${fsm.name}">
			<defs><marker id="arrow-${
				fsm.slug
			}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ddd"/></marker></defs>
			${parts.join('\n')}
		</svg>`;
	}
	function r(n: number) {
		return Math.round(n * 10) / 10;
	}

	const faqs = [
		{
			q: 'What is a finite state machine?',
			a: 'A sequential circuit that is always in exactly one of a fixed, finite set of states. On each clock edge it moves to a next state chosen by its present state and its inputs, and it produces outputs from its state, or from its state and inputs together. Counters, controllers, protocol handlers and sequence detectors are all finite state machines; in hardware one is a register holding the state plus combinational logic computing the next state and the outputs.'
		},
		{
			q: 'What is the difference between a Moore machine and a Mealy machine?',
			a: 'In a Moore machine the outputs depend only on the present state, so they change only on a clock edge and are stable for a whole cycle. In a Mealy machine the outputs depend on the present state and the inputs, so they can change as soon as an input does and can respond a cycle earlier. A Mealy machine often needs fewer states for the same job; a Moore machine has outputs that cannot glitch when an input does.'
		},
		{
			q: 'How do you design a finite state machine?',
			a: "Draw the state diagram from the specification, list it as a state table, assign a binary code to each state, choose a flip-flop type, derive the flip-flop input equations and the output equations from the table using Karnaugh maps, and build the circuit. Unused state codes are don't cares in the maps. Then simulate it against the specification, which is what the diagrams on this page do."
		},
		{
			q: 'What is a state table?',
			a: 'The state diagram written as a table: one row per combination of present state and input, giving the next state and the output. With the states replaced by their binary codes it is a truth table whose inputs are the state bits and the machine inputs, and whose outputs are the next-state bits and the machine outputs, which is what the flip-flop logic is designed from.'
		},
		{
			q: 'How many flip-flops does a state machine need?',
			a: 'Enough bits to give every state a distinct code: for n states, the smallest whole number of bits not less than log₂ n, so two flip-flops for three or four states and three for five to eight. One-hot encoding uses one flip-flop per state instead, which costs more flip-flops but usually simpler next-state logic, and is common in FPGAs.'
		},
		{
			q: 'What happens if a state machine enters an unused state?',
			a: "Codes that no state uses are don't cares during design, so the minimal logic sends them wherever is convenient, which could be a loop the machine never leaves. A robust design either checks what the derived equations do with every unused code, or assigns every unused code an explicit transition to the reset state, at the cost of slightly larger logic."
		}
	];

	const page = {
		title: 'Finite State Machines: Moore vs Mealy and a Worked Design',
		description:
			'What a state machine is, Moore vs Mealy, and a 101 sequence detector designed both ways: state diagram, state table, equations, circuit and timing.',
		url: `${SITE}/finite-state-machines`,
		image: `${SITE}/og/finite-state-machines.png`,
		imageAlt: 'LogicGates.org: finite state machines'
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
					{ '@type': 'ListItem', position: 3, name: 'Finite state machines' }
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
		{ href: '/counters', label: 'Counters' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/combinational-vs-sequential', label: 'Combinational vs sequential' }
	]}
>
	<section class="intro">
		<nav class="crumbs" aria-label="Breadcrumb">
			<a href="/flip-flops">Flip-flops</a> <span aria-hidden="true">/</span>
			<span>Finite state machines</span>
		</nav>
		<h1>Finite state machines</h1>
		<p class="lede">
			A finite state machine is a sequential circuit that is always in one of a fixed set of states, moves between them
			on each clock according to its inputs, and produces outputs from where it is. Every counter, controller and
			protocol handler is one. This page explains the two kinds and works one through from specification to circuit,
			with every step generated and checked.
		</p>
	</section>

	<section id="what-is-an-fsm">
		<h2>What a state machine is</h2>
		<p>
			Combinational logic answers a question about its inputs right now. A <a href="/flip-flops">flip-flop</a>
			remembers one bit. Put a few flip-flops together and feed their outputs back through some combinational logic into
			their inputs, and you have a circuit whose behaviour depends on its history: a state machine. The flip-flops hold the
			<strong>state</strong>, a code for "what has happened so far". On every clock edge the
			<strong>next-state logic</strong> looks at the state and the inputs and decides where to go. The
			<strong>output logic</strong> turns the state, and possibly the inputs, into the outputs.
		</p>
		<p>
			"Finite" just means the set of states is fixed in advance. A 4-bit <a href="/counters">counter</a> is a state machine
			with sixteen states and no inputs. A traffic light controller has a handful of states and a timer input. A vending
			machine remembers how much money has gone in. What makes them all the same thing is that they can be drawn as a diagram
			of circles and arrows, and designed by the same procedure.
		</p>
	</section>

	<section id="moore-vs-mealy">
		<h2>Moore vs Mealy</h2>
		<p>The two kinds differ in one thing only: where the outputs come from.</p>
		<div class="compare">
			<div class="card">
				<h3>Moore machine</h3>
				<p>
					Outputs depend on the <strong>state alone</strong>. They are written inside the state circles, change only on
					a clock edge, and stay steady for a whole cycle. Free of input-induced glitches and easy to reason about, at
					the cost of sometimes needing an extra state.
				</p>
			</div>
			<div class="card">
				<h3>Mealy machine</h3>
				<p>
					Outputs depend on the <strong>state and the inputs</strong>. They are written on the arrows as input/output,
					can change the moment an input does, and typically respond a cycle earlier, often with fewer states. The price
					is outputs that can glitch while inputs settle.
				</p>
			</div>
		</div>
		<p class="reducer">
			Any Moore machine can be rewritten as a Mealy machine and vice versa, though the Moore version may need more
			states and its output lags by a cycle. The worked example below is done both ways, so the difference is visible in
			the diagrams, the equations and the timing.
		</p>
	</section>

	<section id="design-procedure">
		<h2>The design procedure</h2>
		<ol class="procedure">
			<li>
				<strong>Draw the state diagram.</strong> One circle per situation the machine must remember, one arrow per input
				value from each.
			</li>
			<li>
				<strong>Write the state table.</strong> Every present state and input, with the next state and output. This is the
				diagram as data.
			</li>
			<li>
				<strong>Assign codes.</strong> Give each state a binary code; two bits cover up to four states. Codes nobody uses
				become don't cares.
			</li>
			<li>
				<strong>Choose flip-flops.</strong> With D flip-flops the input equation for each bit is simply its next-state column,
				which is why they are the usual choice.
			</li>
			<li>
				<strong>Derive the equations.</strong> Each next-state bit and each output is a boolean function of the state
				bits and inputs: simplify it with a <a href="/karnaugh-map-solver">Karnaugh map</a>.
			</li>
			<li>
				<strong>Build and check.</strong> Wire the gates to the flip-flops, then run a test sequence through it and compare
				against the specification.
			</li>
		</ol>
	</section>

	{#each built as machine, index}
		<section id={machine.slug} class="machine">
			<h2>{index === 0 ? 'Worked example: a Moore detector for 101' : 'The same machine as a Mealy detector'}</h2>
			<p class="section-intro">{machine.purpose}</p>

			{#if index === 0}
				<p>
					The specification: watch a stream of bits <span class="mono">x</span>, one per clock, and raise
					<span class="mono">z</span> whenever the last three bits were 1, 0, 1. Overlaps count, so 10101 contains the pattern
					twice. The machine needs to remember how much of the pattern it has seen so far, which gives four states: nothing
					useful, seen 1, seen 10, and seen 101. In a Moore machine the output belongs to that last state.
				</p>
			{:else}
				<p>
					Moving the output onto the arrows removes the need for a "seen 101" state: the machine can announce the match
					on the very transition that completes it, from "seen 10" on a 1. Three states instead of four, and the flag
					appears one cycle earlier.
				</p>
			{/if}

			<h3>State diagram</h3>
			<div class="card diagram">
				{@html machine.diagram}
				<p class="diagram-note">
					{#if machine.kind === 'moore'}
						Arrows are labelled with the input; the output is written inside each state, and the code under it.
					{:else}
						Arrows are labelled input/output; there is no output in the states themselves.
					{/if}
				</p>
			</div>

			<h3>State table</h3>
			<div class="table-wrap">
				<table class="data-table state-table">
					<thead>
						<tr>
							<th scope="col">Present state</th>
							<th scope="col" class="mono">{machine.input}</th>
							<th scope="col">Next state</th>
							<th scope="col" class="mono">z</th>
						</tr>
					</thead>
					<tbody>
						{#each machine.transitions as t}
							{@const from = machine.states.find((s) => s.id === t.from)}
							{@const to = machine.states.find((s) => s.id === t.to)}
							<tr>
								<td
									>{t.from} <span class="mono code">{from?.code}</span> <span class="meaning">{from?.meaning}</span></td
								>
								<td class={t.input === '1' ? 'bit-1' : 'bit-0'}>{t.input}</td>
								<td>{t.to} <span class="mono code">{to?.code}</span></td>
								{#if machine.kind === 'moore'}
									<td class={from?.output === '1' ? 'bit-1' : 'bit-0'}>{from?.output}</td>
								{:else}
									<td class={t.output === '1' ? 'bit-1' : 'bit-0'}>{t.output}</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<h3>Equations</h3>
			<p>
				With D flip-flops, each next-state bit is a function of the present state bits and the input, read straight off
				the table and simplified on a Karnaugh map. The state bits are
				{#each machine.labels as label, i}{i > 0 ? ' and ' : ''}<span class="mono">{label}</span>{/each}, written
				<span class="mono">{machine.legend}</span> in the expressions.
				{#if machine.kind === 'mealy'}
					The unused code 11 is a don't care, which is what lets d1 lose a literal.
				{/if}
			</p>
			<dl class="equations">
				{#each machine.equations as eq}
					<dt class="mono">{eq.name}</dt>
					<dd class="mono">{eq.text}</dd>
				{/each}
			</dl>
			<p class="reducer">
				<span class="mono">d1</span> and <span class="mono">d0</span> are the D inputs of the flip-flops holding
				<span class="mono">Q1</span> and <span class="mono">Q0</span>; <span class="mono">z</span> is the output.
				{#if machine.kind === 'moore'}
					Notice that <span class="mono">z</span> depends only on the state bits: that is what makes it Moore.
				{:else}
					Notice that <span class="mono">z</span> depends on <span class="mono">x</span> as well as the state: that is what
					makes it Mealy.
				{/if}
			</p>

			<h3>The combinational part</h3>
			<div class="card diagram-card">
				<div
					class="canvas"
					role="img"
					aria-label={`Next-state and output logic of the ${machine.name}: ${machine.equations
						.map((e) => `${e.name} = ${e.text}`)
						.join('; ')}`}
				>
					{@html machine.circuitSvg}
				</div>
				<p class="diagram-note">
					The outputs <span class="mono">d1</span> and <span class="mono">d0</span> feed two D flip-flops whose outputs
					<span class="mono">Q1</span>
					and <span class="mono">Q0</span> come back in as
					<span class="mono">{machine.legend}</span>. The flip-flops and the feedback wires are the only parts not
					drawn.
				</p>
			</div>

			<h3>Timing</h3>
			<p class="section-intro">
				The machine run on the input <span class="mono">{machine.demo}</span>, one bit per cycle, starting in
				{machine.states[0].id}. Each dashed line is a clock edge, where the state changes.
			</p>
			<figure class="timing">
				<div
					class="timing-scroll screen-only"
					role="img"
					aria-label={`Timing diagram of the ${machine.name}. ${machine.timingAlt}`}
				>
					{@html machine.timingSvg}
				</div>
				<div class="timing-scroll print-only" aria-hidden="true">{@html machine.timingPrintSvg}</div>
				<figcaption>
					{#if machine.kind === 'moore'}
						Z goes high in the cycle after the third bit of each 101 arrives, because the machine has to reach S3 first.
					{:else}
						Z goes high in the same cycle as the third bit of each 101, while the machine is still in S2.
					{/if}
				</figcaption>
			</figure>

			<details class="trace">
				<summary>The same run as a table</summary>
				<div class="table-wrap">
					<table class="data-table trace-table">
						<thead>
							<tr>
								<th scope="col">Cycle</th>
								<th scope="col" class="mono">{machine.input}</th>
								<th scope="col">State</th>
								<th scope="col">Next</th>
								<th scope="col" class="mono">z</th>
							</tr>
						</thead>
						<tbody>
							{#each machine.steps as step, i}
								<tr class:flag={step.output === '1'}>
									<td>{i + 1}</td>
									<td class={step.input === '1' ? 'bit-1' : 'bit-0'}>{step.input}</td>
									<td>{step.state}</td>
									<td>{step.next}</td>
									<td class={step.output === '1' ? 'bit-1' : 'bit-0'}>{step.output}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	{/each}

	<section id="unused-states">
		<h2>Unused states</h2>
		<p>
			Two bits give four codes, and the Mealy machine uses three of them. During design the fourth is a don't care, and
			the minimal equations send it wherever made the maps simplest. A real design has to ask what that is: if a glitch
			at power-up lands the machine in the unused code, will it find its way back? Simulate the equations from every
			code, or give every unused code an explicit arrow to the reset state and accept the extra gate or two. Either is
			fine; not checking is not.
		</p>
	</section>

	<section id="build">
		<h2>Build one</h2>
		<p>
			Two D flip-flops, a toggle for <span class="mono">x</span>, a clock, and the gates for the Moore equations:
		</p>
		<dl class="equations">
			{#each built[0].equations as eq}
				<dt class="mono">{eq.name}</dt>
				<dd class="mono">{eq.text}</dd>
			{/each}
		</dl>
		<p>
			with <span class="mono">{built[0].legend}</span>. The simulator has no flip-flop node, so build a D flip-flop from
			gates as the
			<a href="/flip-flops/d">D flip-flop page</a> describes and package it as a custom node; two of those, a clock node
			and the gates above make the whole detector. Feed it 1, 0, 1 on successive clocks and watch
			<span class="mono">z</span> rise one cycle later.
		</p>
		<p>
			<a class="cta" href="/simulator">Open the simulator</a>
		</p>
		<p class="reducer">
			Counters are the same procedure with no input: the <a href="/counters">counters page</a> derives a decade counter
			this way, and the <a href="/flip-flops">flip-flop pages</a> have the excitation tables you need if you use JK or T
			flip-flops instead of D.
		</p>
	</section>

	<section class="faq">
		<h2>Questions about state machines</h2>
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

	.compare {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 12px;
		margin: 1rem 0;
	}

	.compare .card {
		padding: 0.9rem 1rem 0.6rem;
	}

	.compare h3 {
		margin: 0 0 0.4rem;
	}

	.compare p {
		color: #ccc;
		margin: 0 0 0.4rem;
	}

	.procedure {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.procedure li {
		margin-bottom: 0.5rem;
	}

	.procedure strong {
		color: #fff;
	}

	.machine h3 {
		margin-top: 1.6rem;
	}

	.diagram {
		padding: 0.6rem 0.8rem 0.4rem;
		max-width: 560px;
	}

	.diagram :global(svg.fsm) {
		display: block;
		width: 100%;
		height: auto;
	}

	.diagram :global(.state) {
		fill: #161618;
		stroke: #fff;
		stroke-width: 2;
	}

	.diagram :global(.edge) {
		fill: none;
		stroke: #ddd;
		stroke-width: 1.6;
	}

	.diagram :global(.state-name) {
		fill: #fff;
		font: 600 13px ui-monospace, SFMono-Regular, Menlo, monospace;
		text-anchor: middle;
	}

	.diagram :global(.state-out) {
		fill: #8ede8e;
		font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
		text-anchor: middle;
	}

	.diagram :global(.state-code) {
		fill: #999;
		font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
		text-anchor: middle;
	}

	.diagram :global(.edge-label) {
		fill: #ddd;
		font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
		text-anchor: middle;
		/* A dark halo so a label stays legible where it crosses an arrow. */
		paint-order: stroke;
		stroke: #161618;
		stroke-width: 5px;
		stroke-linejoin: round;
	}

	.diagram :global(.edge-label.reset) {
		fill: #999;
	}

	.diagram-note {
		color: #999;
		font-size: 0.85rem;
		margin: 0.5rem 0 0.3rem;
	}

	.state-table td {
		padding: 0.3rem 0.75rem;
	}

	.code {
		color: #8ede8e;
		margin-left: 0.3rem;
	}

	.meaning {
		display: block;
		color: #888;
		font-size: 0.8rem;
	}

	.equations {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 1rem;
		margin: 0.6rem 0;
		max-width: 520px;
	}

	.equations dt {
		color: #fff;
		font-weight: 600;
	}

	.equations dd {
		margin: 0;
		color: #8ede8e;
	}

	.diagram-card {
		padding: 0.8rem 0.9rem 0.6rem;
	}

	.canvas {
		overflow-x: auto;
		background-color: #1d1e20;
		background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
		background-size: 22px 22px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem;
	}

	.canvas :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		max-width: 100%;
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

	.trace {
		margin-top: 0.8rem;
	}

	.trace summary {
		cursor: pointer;
		color: #8ede8e;
		font-size: 0.9rem;
	}

	.trace-table {
		margin-top: 0.6rem;
	}

	.trace-table td {
		padding: 0.2rem 0.7rem;
		text-align: center;
	}

	tr.flag td {
		box-shadow: inset 0 0 0 1px rgba(93, 182, 93, 0.6);
	}
</style>
