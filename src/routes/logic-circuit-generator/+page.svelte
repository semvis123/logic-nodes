<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import { parseSystem, truthTables, formatSystem, BooleanError, type Output } from '$lib/boolean';
	import { buildCircuit, circuitStates, CircuitTooLarge, type Circuit } from '$lib/circuit';
	import { circuitToSvg, type Palette, type Standard } from '$lib/exportSvg';
	import { downloadSvg, downloadPng, downloadText, copyText, slugifyExpression } from '$lib/download';
	import { toHdl, hdlTargets, type Hdl } from '$lib/hdl';

	import { readUrl, syncUrl, safeText, safeOption, toolLink } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	// Every setting lives in the query string, so a link reopens this exactly.
	const DEFAULTS = {
		expr: '(a & b) | (!a & c)',
		symbols: 'ansi',
		colours: 'colour',
		caption: '1',
		label: ''
	};
	onMount(() => {
		const p = readUrl();
		expression = safeText(p.expr) ?? expression;
		standard = safeOption(p.symbols, ['ansi', 'iec'] as const) ?? standard;
		palette = safeOption(p.colours, ['colour', 'mono'] as const) ?? palette;
		if (p.caption !== undefined) showCaption = p.caption !== '0';
		if (p.label) {
			labelOutput = true;
			outputLabel = safeText(p.label, 4) ?? outputLabel;
		}
	});
	$: syncUrl(
		{
			expr: expression,
			symbols: standard,
			colours: palette,
			caption: showCaption ? '1' : '0',
			label: labelOutput ? outputLabel : ''
		},
		DEFAULTS
	);

	let expression = '(a & b) | (!a & c)';
	let values: Record<string, boolean> = {};
	let standard: Standard = 'ansi';
	let palette: Palette = 'colour';
	let showCaption = true;
	let labelOutput = false;
	let outputLabel = 'Q';
	let exporting = '';

	let circuit: Circuit | null = null;
	let variables: string[] = [];
	let reading = '';
	let error = '';
	let lastVars = '';
	// Kept around so the HDL export works from the same trees the diagram does.
	let parsed: Output[] | null = null;
	$: {
		try {
			// One expression, or several separated by semicolons: `sum = a ^ b; carry = a & b`.
			const outputs = parseSystem(expression);
			parsed = outputs;
			const table = truthTables(outputs); // enforces the variable limit
			circuit = buildCircuit(outputs);
			variables = table.variables;
			reading = formatSystem(outputs, 'math');
			// Keep the toggles when the variables have not changed.
			const key = variables.join(',');
			if (key !== lastVars) {
				lastVars = key;
				values = Object.fromEntries(variables.map((name) => [name, false]));
			}
			error = '';
		} catch (e) {
			circuit = null;
			parsed = null;
			error = e instanceof CircuitTooLarge || e instanceof BooleanError ? e.message : 'That expression did not parse';
		}
	}

	$: states = circuit ? circuitStates(circuit, values) : {};
	$: outputStates = circuit ? circuit.outputs.map((out) => ({ name: out.name, on: !!states[out.rootId] })) : [];
	$: several = outputStates.length > 1;
	$: depth = circuit ? Math.max(0, ...circuit.nodes.map((n) => n.depth)) : 0;

	// The preview is the exported file, rendered inline. Nothing can drift
	// between what you see and what you download.
	$: svg = circuit
		? circuitToSvg(circuit, {
				standard,
				palette,
				states,
				caption: showCaption ? reading : '',
				outputLabel: labelOutput && !several ? outputLabel.trim() || 'Q' : undefined
		  })
		: '';

	const filename = (ext: string) => `${slugifyExpression(reading)}-circuit.${ext}`;

	async function exportFile(kind: 'svg' | 'png') {
		if (!circuit) return;
		exporting = kind;
		try {
			if (kind === 'svg') downloadSvg(svg, filename('svg'));
			else await downloadPng(svg, filename('png'), 2);
		} finally {
			exporting = '';
		}
	}

	// The same expression as Verilog or VHDL, for pasting into a real toolchain.
	let hdl: Hdl = 'verilog';
	let copied = false;
	let copyTimer: ReturnType<typeof setTimeout>;
	// A lone unnamed output keeps the conventional port name `y`; named outputs keep their names.
	$: hdlSource = parsed && parsed.length === 1 && parsed[0].name === 'Q' ? parsed[0].ast : parsed;
	$: hdlText = hdlSource ? toHdl(hdlSource, hdl, slugifyExpression(reading).replace(/-/g, '_') || 'logic_nodes') : '';
	$: hdlExtension = hdlTargets.find((t) => t.id === hdl)?.extension ?? 'txt';

	async function copyHdl() {
		copied = await copyText(hdlText);
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 2500);
	}

	const toggle = (name: string) => (values = { ...values, [name]: !values[name] });

	const examples = [
		{ label: 'Multiplexer', value: '(a & b) | (!a & c)' },
		{ label: 'Majority of three', value: 'ab + bc + ac' },
		{ label: 'Shared term', value: '((a & b) | c) & ((a & b) | d)' },
		{ label: 'De Morgan', value: '!(a & b)' },
		// Several outputs in one diagram, separated by semicolons.
		{ label: 'Half adder', value: 'sum = a ^ b; carry = a & b' },
		{ label: 'Full adder', value: 'sum = a ^ b ^ c; carry = (a & b) | (c & (a ^ b))' },
		{ label: '1-bit comparator', value: 'lt = !a & b; eq = !(a ^ b); gt = a & !b' }
	];

	const faqs = [
		{
			q: 'Can I get the expression as Verilog or VHDL?',
			a: 'Yes. Open "export as Verilog or VHDL" under the diagram and you get a complete module or entity: one port per variable, one port per output, and a combinational assignment for each. Copy it or download a .v or .vhd file. Every operator is bracketed, because VHDL defines no precedence between and and or, so an unbracketed expression would not compile there.'
		},
		{
			q: 'Can a circuit have more than one output?',
			a: 'Yes. Separate the expressions with semicolons and name each one, as in "sum = a ^ b; carry = a & b". Every output gets its own box on the right, the inputs are shared, and a term that two outputs have in common is drawn once and wired to both, which is how a full adder ends up with a single XOR feeding both its sum and its carry. The truth table generator takes the same syntax and gives one column per output.'
		},
		{
			q: 'Can I download the diagram?',
			a: 'Yes, as an SVG or a PNG, and the file is exactly what you see on screen. SVG stays sharp at any size and can be edited in Inkscape or Illustrator; PNG is the one to paste straight into a document. Both are free to use, including in coursework, a thesis or a slide deck.'
		},
		{
			q: 'Can I choose the gate symbols?',
			a: 'Yes. ANSI distinctive shapes, the ones with a D for AND and a shield for OR, or IEC rectangles with the operator written inside. The choice applies to the diagram and to whatever you download.'
		},
		{
			q: 'Is there a black and white version for printing?',
			a: 'Yes. Switch the colours to black and white and the diagram is drawn as black lines on white, with no signal colours to disappear in a photocopy or a greyscale print. Turning on the output label so the box reads Q rather than 0 or 1 gives you the version that belongs in a report.'
		},
		{
			q: 'How do I turn a boolean expression into a logic circuit?',
			a: 'Work outwards from the variables. Each operator becomes one gate: an AND for a conjunction, an OR for a disjunction, a NOT for a negation. The output of each gate feeds the operator that contained it, so the innermost brackets end up on the left and the outermost operator is the last gate before the output.'
		},
		{
			q: 'Why is a repeated term drawn as one gate?',
			a: 'Because that is what you would build. If the same subexpression appears twice, its gate is wired to both places rather than duplicated, which is why the gate count here can be lower than the number of operators you typed.'
		},
		{
			q: 'Are these the fewest gates possible?',
			a: 'No. The diagram shows your expression as written, with shared terms merged. To reduce the gate count, simplify the expression first with the boolean algebra calculator or a Karnaugh map, then paste the result back in here.'
		},
		{
			q: 'What do the wire colours mean?',
			a: 'Green is a 1 and red is a 0, matching the simulator. Click any input on the left to flip it and the colours propagate through the circuit immediately, so you can follow a signal from an input to the output.'
		}
	];

	const page = {
		title: 'Logic Diagram Generator: Draw Gates, Export SVG or Verilog',
		description:
			'Draw a logic gate diagram from any boolean expression in ANSI or IEC symbols, download it as SVG or PNG, and export the same logic as Verilog or VHDL.',
		url: `${SITE}/logic-circuit-generator`,
		image: `${SITE}/og/logic-circuit-generator.png`,
		imageAlt: 'Logic Nodes: logic circuit generator'
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
					{ '@type': 'ListItem', position: 3, name: 'Circuit diagram generator' }
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
		{ href: '/logic-gate-symbols', label: 'Logic gate symbols' },
		{ href: '/truth-table-generator', label: 'Truth table generator' },
		{ href: '/karnaugh-map-solver', label: 'Karnaugh map solver' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Logic circuit generator</h1>
		<p class="lede">
			Type a boolean expression and get the circuit drawn with proper gate symbols, ready to download as an SVG or a
			PNG. Pick <a href="/logic-gate-symbols">ANSI or IEC shapes</a>, colour or black and white, and flip the inputs to
			watch the signals move. A circuit with several outputs is one line with a semicolon between the expressions.
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
				aria-describedby="expression-help"
			/>
			<p class="field-help" id="expression-help">
				<span class="mono">&amp; | ! ^</span> or words for AND, OR, NOT and XOR. For more than one output, separate the
				expressions with <span class="mono">;</span> and name them:
				<span class="mono">sum = a ^ b; carry = a &amp; b</span>.
			</p>
			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => (expression = example.value)}>
						{example.label}
					</button>
				{/each}
			</div>

			{#if error}
				<p class="error" role="status">{error}</p>
			{:else if circuit}
				<p class="reading">
					Reading it as <span class="mono">{reading}</span> ·
					{circuit.gateCount} gate{circuit.gateCount === 1 ? '' : 's'} ·
					{depth} level{depth === 1 ? '' : 's'} deep
				</p>

				<div class="canvas" class:light={palette === 'mono'}>
					<!-- Exactly the file the download button produces. -->
					{@html svg}
				</div>

				<div class="inputs" role="group" aria-label="Circuit inputs">
					<span class="opt-label">Inputs</span>
					{#each variables as name}
						<button
							type="button"
							class="pin"
							class:on={values[name]}
							aria-pressed={values[name]}
							on:click={() => toggle(name)}
						>
							{name} <span class="val">{values[name] ? 1 : 0}</span>
						</button>
					{/each}
					{#each outputStates as out}
						<span class="result">
							{several ? out.name : 'output'} <span class="val" class:on={out.on}>{out.on ? 1 : 0}</span>
						</span>
					{/each}
				</div>

				<div class="export">
					<div class="opt" role="group" aria-label="Gate symbols">
						<span class="opt-label">Symbols</span>
						<button
							type="button"
							class:active={standard === 'ansi'}
							aria-pressed={standard === 'ansi'}
							on:click={() => (standard = 'ansi')}>ANSI</button
						>
						<button
							type="button"
							class:active={standard === 'iec'}
							aria-pressed={standard === 'iec'}
							on:click={() => (standard = 'iec')}>IEC</button
						>
					</div>
					<div class="opt" role="group" aria-label="Colours">
						<span class="opt-label">Colours</span>
						<button
							type="button"
							class:active={palette === 'colour'}
							aria-pressed={palette === 'colour'}
							on:click={() => (palette = 'colour')}>Colour</button
						>
						<button
							type="button"
							class:active={palette === 'mono'}
							aria-pressed={palette === 'mono'}
							on:click={() => (palette = 'mono')}>Black &amp; white</button
						>
					</div>
					<label class="check">
						<input type="checkbox" bind:checked={showCaption} />
						Caption
					</label>
					<!-- Several outputs are always labelled with their names. -->
					{#if !several}
						<label class="check">
							<input type="checkbox" bind:checked={labelOutput} />
							Label output
						</label>
						{#if labelOutput}
							<input class="label-input" type="text" bind:value={outputLabel} maxlength="4" aria-label="Output label" />
						{/if}
					{/if}
					<ShareLink what="this diagram" />
					<div class="opt downloads">
						<button type="button" class="download" on:click={() => exportFile('svg')} disabled={exporting !== ''}>
							{exporting === 'svg' ? 'Saving…' : 'Download SVG'}
						</button>
						<button type="button" class="download" on:click={() => exportFile('png')} disabled={exporting !== ''}>
							{exporting === 'png' ? 'Saving…' : 'Download PNG'}
						</button>
					</div>
				</div>

				<p class="hint">
					Click an input to flip it. Green is 1, red is 0, the same as
					<a href="/simulator">the simulator</a>. The download matches what you see, and black and white is the one to
					paste into a report.
				</p>

				<details class="hdl">
					<summary>Export as Verilog or VHDL</summary>
					<div class="hdl-bar">
						<div class="hdl-tabs" role="group" aria-label="Language">
							{#each hdlTargets as target}
								<button
									type="button"
									class="hdl-tab"
									class:active={hdl === target.id}
									aria-pressed={hdl === target.id}
									on:click={() => (hdl = target.id)}
								>
									{target.label}
								</button>
							{/each}
						</div>
						<button type="button" class="download" on:click={copyHdl}>
							{copied ? 'Copied' : 'Copy'}
						</button>
						<button
							type="button"
							class="download"
							on:click={() => downloadText(hdlText, `${slugifyExpression(reading)}.${hdlExtension}`)}
						>
							Download .{hdlExtension}
						</button>
					</div>
					<pre class="hdl-code"><code>{hdlText}</code></pre>
					<p class="hint">
						One combinational assignment per output, over the same expressions the diagram draws. Every operator is
						bracketed because VHDL defines no precedence between <span class="mono">and</span> and
						<span class="mono">or</span>.
					</p>
				</details>
			{/if}
		</div>
	</section>

	<section>
		<h2>From algebra to gates</h2>
		<p class="section-intro">
			The translation is mechanical, which is why a tool can do it. Each operator becomes a gate, and an operation you
			wrote twice becomes one gate wired to both places.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">In the expression</th>
						<th scope="col">In the circuit</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row" class="mono">a ∧ b</th>
						<td>an <a href="/logic-gates/and">AND gate</a> with a and b on its inputs</td>
					</tr>
					<tr>
						<th scope="row" class="mono">a ∨ b</th>
						<td>an <a href="/logic-gates/or">OR gate</a></td>
					</tr>
					<tr>
						<th scope="row" class="mono">¬a</th>
						<td>a <a href="/logic-gates/not">NOT gate</a>, drawn as a triangle with a bubble</td>
					</tr>
					<tr>
						<th scope="row" class="mono">a ⊻ b</th>
						<td>an <a href="/logic-gates/xor">XOR gate</a></td>
					</tr>
					<tr>
						<th scope="row">Brackets</th>
						<td>depth: the innermost bracket is the leftmost gate</td>
					</tr>
					<tr>
						<th scope="row">A repeated subexpression</th>
						<td>one gate, with its output wired to both places</td>
					</tr>
					<tr>
						<th scope="row" class="mono">sum = …; carry = …</th>
						<td>two outputs on the right of one circuit, sharing the inputs and any common gates</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			The gates are laid out in columns by how far they sit from the inputs, so the diagram reads left to right and
			every wire travels forwards, routed around the gates rather than across them. Symbols are drawn as either
			<a href="/logic-gate-symbols">ANSI distinctive shapes or IEC rectangles</a>, whichever you choose above.
		</p>
	</section>

	<section>
		<h2>Getting the diagram out</h2>
		<p class="section-intro">
			The picture is only useful if you can take it away, so both formats produce a standalone file with the symbols
			drawn as real vector shapes rather than a screenshot of a web page.
		</p>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Option</th>
						<th scope="col">What it changes</th>
						<th scope="col">Reach for it when</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">SVG</th>
						<td>Vector, sharp at any size, editable</td>
						<td>You will scale it, or tidy it up in a drawing program</td>
					</tr>
					<tr>
						<th scope="row">PNG</th>
						<td>Raster, drawn at twice the size for sharpness</td>
						<td>Pasting into a document, a slide or a forum post</td>
					</tr>
					<tr>
						<th scope="row">ANSI or IEC</th>
						<td>Distinctive shapes, or rectangles with a label inside</td>
						<td>Matching whatever your course or workplace uses</td>
					</tr>
					<tr>
						<th scope="row">Black and white</th>
						<td>Black on white, no signal colours</td>
						<td>Printing, or a report that will be read in greyscale</td>
					</tr>
					<tr>
						<th scope="row">Label the output</th>
						<td>The output box reads Q instead of a live 0 or 1</td>
						<td>Drawing a general circuit rather than one worked example</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Need the gate symbols on their own rather than a whole circuit? The
			<a href="/logic-gate-symbols">symbol reference</a> has all six in both standards, and each
			<a href="/logic-gates">gate page</a> has a downloadable card with its truth table.
		</p>
	</section>

	<section>
		<h2>Fewer gates</h2>
		<p class="section-intro">
			This page draws what you typed. If the drawing looks bigger than it should be, the expression is probably not
			minimal yet.
		</p>
		<ol class="steps">
			<li>
				Simplify it first with the
				<a href={toolLink('/boolean-algebra-calculator', { expr: expression })}>boolean algebra calculator</a> or a
				<a href={toolLink('/karnaugh-map-solver', { expr: expression })}>Karnaugh map</a>, then paste the result back
				here and compare the gate counts. Both links carry what you have typed, so there is nothing to retype.
			</li>
			<li>
				If you need one gate type throughout, the
				<a href={toolLink('/nand-nor-converter', { expr: expression })}>NAND and NOR converter</a> will rewrite it, though
				the gate count usually goes up.
			</li>
			<li>
				When the shape looks right, build it for real: press <kbd>ctrl</kbd>+<kbd>E</kbd> in the simulator and paste the
				same expression.
			</li>
		</ol>
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

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.4rem 0 0;
		line-height: 1.5;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0.7rem 0 1rem;
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

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.reading {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0 0 0.8rem;
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

	/* Print colours want a light frame around them, not the dark grid. */
	.canvas.light {
		background-color: #ffffff;
		background-image: linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
	}

	.canvas :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		max-width: 100%;
	}

	.inputs {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}

	.pin {
		background-color: #40191c;
		border: 1px solid rgba(255, 255, 255, 0.55);
		border-radius: 3px;
		color: #fff;
		font: 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.pin.on {
		background-color: #372;
	}

	@media (prefers-reduced-motion: reduce) {
		.pin {
			transition: none;
		}
	}

	.val {
		font-weight: 600;
		margin-left: 0.3rem;
	}

	.result {
		color: #888;
		font-size: 0.8rem;
		margin-left: 0.4rem;
	}

	.result .val {
		color: #f66;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.result .val.on {
		color: #5db65d;
	}

	.export {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}

	.opt {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.opt-label {
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.15rem;
	}

	.opt button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.opt button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: #bbb;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.label-input {
		width: 3.4rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.25rem 0.4rem;
		text-align: center;
	}

	.downloads {
		margin-left: auto;
	}

	/* Self-sufficient rather than relying on the .opt container for a background:
	   outside it, a button falls back to the browser's grey face, which the
	   green text does not have enough contrast against. */
	.download {
		background: #0d0d0f;
		border: 1px solid #5db65d;
		border-radius: 3px;
		color: #8ede8e;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.download:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.hdl {
		margin-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.8rem;
	}

	.hdl summary {
		cursor: pointer;
		color: #ddd;
		font-size: 0.9rem;
	}

	.hdl-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.8rem 0 0.6rem;
	}

	.hdl-tabs {
		display: flex;
		gap: 0.3rem;
	}

	.hdl-tab {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 3px;
		color: #bbb;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
	}

	.hdl-tab.active {
		border-color: #5db65d;
		color: #fff;
	}

	.hdl-code {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.82rem;
		line-height: 1.5;
		margin: 0;
		overflow-x: auto;
		padding: 0.8rem 1rem;
	}

	.hint {
		color: #888;
		font-size: 0.8rem;
		margin: 0.7rem 0 0;
	}

	.steps {
		padding-left: 1.25rem;
		color: #ddd;
		max-width: 680px;
	}

	.steps li {
		margin-bottom: 0.8rem;
	}
</style>
