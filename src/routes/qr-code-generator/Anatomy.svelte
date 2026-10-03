<script lang="ts" context="module">
	import type { Role } from '$lib/qr';

	export type Layer = Role | 'quiet';

	/**
	 * Each part of the symbol in two shades of one hue: dark modules stay dark
	 * and light ones stay light, so the highlighted code still reads as a QR
	 * code, and the layer can be told apart from the plain black and white.
	 */
	export const LAYERS: { id: Layer; label: string; dark: string; light: string }[] = [
		{ id: 'finder', label: 'Finder patterns', dark: '#a32020', light: '#f7c6c6' },
		{ id: 'separator', label: 'Separators', dark: '#444', light: '#dedede' },
		{ id: 'timing', label: 'Timing patterns', dark: '#1c56a6', light: '#c4daf6' },
		{ id: 'alignment', label: 'Alignment patterns', dark: '#7a2ea3', light: '#e6cff5' },
		{ id: 'dark', label: 'Dark module', dark: '#d4007a', light: '#f9c3e1' },
		{ id: 'format', label: 'Format information', dark: '#00737a', light: '#b8ecef' },
		{ id: 'version', label: 'Version information', dark: '#7a6400', light: '#f3e7a1' },
		{ id: 'data', label: 'Data codewords', dark: '#1f6b1f', light: '#cdeccd' },
		{ id: 'ec', label: 'Error correction codewords', dark: '#a34f00', light: '#f8d9b6' },
		{ id: 'remainder', label: 'Remainder bits', dark: '#2b2b2b', light: '#a9a9a9' },
		{ id: 'quiet', label: 'Quiet zone', dark: '#000', light: '#fff7d6' }
	];
</script>

<script lang="ts">
	import { rolePaths, codewordOutlines, codewordLabels, describeModule, qrSvg, QUIET_ZONE, type QrCode } from '$lib/qr';
	import { downloadSvg, downloadPng } from '$lib/download';

	export let qr: QrCode;

	/** Outlines stop being readable past about version 20, and numbers past version 6. */
	const OUTLINE_MAX = 20;
	const NUMBER_MAX = 6;

	let on: Record<Layer, boolean> = Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<Layer, boolean>;
	let outlines = true;
	let numbers = true;
	let masked = true;

	$: paths = rolePaths(qr, masked);
	$: outlinePath = qr.version <= OUTLINE_MAX ? codewordOutlines(qr) : '';
	$: labels = qr.version <= NUMBER_MAX ? codewordLabels(qr) : [];
	$: counts = countRoles(qr);
	$: q = QUIET_ZONE;
	$: full = qr.size + 2 * q;
	// The same drawing the downloads use, so what is shown here is what scans.
	$: plain = qrSvg(qr.modules, 4);
	$: plainName = `QR code for ${qr.text.length > 80 ? `${qr.text.slice(0, 80)}…` : qr.text}`;

	function countRoles(code: QrCode): Record<Layer, number> {
		const out = Object.fromEntries(LAYERS.map((l) => [l.id, 0])) as Record<Layer, number>;
		for (const row of code.info) for (const m of row) out[m.role]++;
		out.quiet = (code.size + 2 * QUIET_ZONE) ** 2 - code.size ** 2;
		return out;
	}

	function setAll(value: boolean) {
		on = Object.fromEntries(LAYERS.map((l) => [l.id, value])) as Record<Layer, boolean>;
		outlines = value;
		numbers = value;
	}

	// The inspector: point at a module, or focus the symbol and move with the arrow keys.
	let cursor: { x: number; y: number } | null = null;
	let svgEl: SVGSVGElement;
	$: if (cursor && (cursor.x >= qr.size || cursor.y >= qr.size)) cursor = null;
	$: readout = cursor
		? describeModule(qr, cursor.x, cursor.y, masked)
		: 'Point at a module, or focus the code and use the arrow keys, to see what it is.';
	// Announced only after a key press: pointer moves would fire one announcement
	// per module crossed.
	let spoken = '';

	function pointAt(event: PointerEvent) {
		const box = svgEl.getBoundingClientRect();
		const x = Math.floor(((event.clientX - box.left) / box.width) * full) - q;
		const y = Math.floor(((event.clientY - box.top) / box.height) * full) - q;
		if (x >= 0 && y >= 0 && x < qr.size && y < qr.size) cursor = { x, y };
	}

	function keys(event: KeyboardEvent) {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		const from = cursor ?? { x: qr.size - 1, y: qr.size - 1 };
		const step = event.shiftKey ? 5 : 1;
		cursor = {
			x: Math.min(qr.size - 1, Math.max(0, from.x + (cursor ? move[0] * step : 0))),
			y: Math.min(qr.size - 1, Math.max(0, from.y + (cursor ? move[1] * step : 0)))
		};
		spoken = describeModule(qr, cursor.x, cursor.y, masked);
	}

	// `shown` is a parameter so the template re-runs this when a checkbox changes;
	// read from inside the function, `on` would not be a dependency of the markup.
	const colour = (id: Layer, dark: boolean, shown: Record<Layer, boolean>) => {
		const layer = LAYERS.find((l) => l.id === id);
		if (!layer || !shown[id]) return dark ? '#111' : '#fff';
		return dark ? layer.dark : layer.light;
	};

	let saveError = '';
	const fileName = () => `qr-code-v${qr.version}-${qr.ec}`;
	function saveSvg() {
		downloadSvg(qrSvg(qr.modules, 10), `${fileName()}.svg`);
	}
	async function savePng() {
		saveError = '';
		// Whole pixels per module keep the edges sharp; aim for about 1000 pixels across.
		const px = Math.max(4, Math.round(1000 / (qr.size + 2 * QUIET_ZONE)));
		try {
			await downloadPng(qrSvg(qr.modules, px), `${fileName()}.png`, 1);
		} catch {
			saveError = 'This browser could not make the PNG. The SVG download works everywhere.';
		}
	}
</script>

<div class="anatomy">
	<div class="figure">
		<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
		<svg
			bind:this={svgEl}
			viewBox="{-q} {-q} {full} {full}"
			class="symbol"
			role="application"
			aria-roledescription="QR code inspector"
			aria-label="QR code, version {qr.version}, {qr.size} by {qr.size} modules, with its parts highlighted. Use the arrow keys to inspect modules, Shift for steps of 5."
			aria-describedby="qr-readout"
			tabindex="0"
			shape-rendering="crispEdges"
			on:pointermove={pointAt}
			on:pointerdown={pointAt}
			on:keydown={keys}
		>
			<rect x={-q} y={-q} width={full} height={full} fill={on.quiet ? LAYERS[10].light : '#fff'} />
			{#if on.quiet}
				<!-- Hatching as well as colour, so the band reads as a zone and not as modules. -->
				<pattern id="qr-quiet-hatch" width="1" height="1" patternUnits="userSpaceOnUse">
					<path d="M0 1L1 0" stroke="#e3c55a" stroke-width="0.08" shape-rendering="geometricPrecision" />
				</pattern>
				<rect x={-q} y={-q} width={full} height={full} fill="url(#qr-quiet-hatch)" />
			{/if}
			<rect x="0" y="0" width={qr.size} height={qr.size} fill="#fff" />
			{#each LAYERS.slice(0, 10) as layer}
				{@const p = paths[layer.id]}
				{#if p}
					<path d={p.light} fill={colour(layer.id, false, on)} />
					<path d={p.dark} fill={colour(layer.id, true, on)} />
				{/if}
			{/each}
			{#if outlines && outlinePath}
				<g shape-rendering="geometricPrecision" fill="none" stroke-linecap="square">
					<path d={outlinePath} stroke="#fff" stroke-width="0.22" />
					<path d={outlinePath} stroke="#000" stroke-width="0.09" />
				</g>
			{/if}
			{#if numbers && labels.length}
				<g class="labels" shape-rendering="geometricPrecision">
					{#each labels as label}
						<text
							x={label.x}
							y={label.y}
							dominant-baseline="central"
							font-size={label.n + 1 >= 100 ? 0.62 : 0.8}
							class:ec-label={label.kind === 'ec'}>{label.n + 1}</text
						>
					{/each}
				</g>
			{/if}
			{#if cursor}
				<rect
					class="cursor"
					x={cursor.x - 0.1}
					y={cursor.y - 0.1}
					width="1.2"
					height="1.2"
					shape-rendering="geometricPrecision"
				/>
			{/if}
		</svg>
		<p class="readout" id="qr-readout">{readout}</p>
		<p class="visually-hidden" aria-live="polite">{spoken}</p>
	</div>

	<div class="controls">
		<div class="plain">
			<div class="plain-code" role="img" aria-label={plainName}>{@html plain}</div>
			<div class="plain-side">
				<p class="plain-head">Scannable code</p>
				<div class="downloads">
					<button type="button" class="small-btn" on:click={saveSvg}>Download SVG</button>
					<button type="button" class="small-btn" on:click={savePng}>Download PNG</button>
				</div>
				<p class="note">Plain black on white with the four-module quiet zone, ready to print or scan.</p>
			</div>
		</div>
		{#if saveError}<p class="note warn" role="alert">{saveError}</p>{/if}

		<fieldset class="layers">
			<legend>Highlight</legend>
			<p class="layer-head" aria-hidden="true">Modules</p>
			{#each LAYERS as layer}
				{#if counts[layer.id] > 0}
					<label class="layer">
						<input type="checkbox" bind:checked={on[layer.id]} />
						<span class="swatch" aria-hidden="true"
							><span style="background:{layer.dark}" /><span style="background:{layer.light}" /></span
						>
						<span class="layer-name">{layer.label}</span>
						<span class="layer-count">{counts[layer.id]}<span class="visually-hidden"> modules</span></span>
					</label>
				{/if}
			{/each}
			<label class="layer">
				<input type="checkbox" bind:checked={outlines} disabled={!outlinePath} />
				<span class="swatch outline" aria-hidden="true" />
				<span class="layer-name"
					>Codeword outlines{#if !outlinePath}<span class="layer-off">Drawn up to version {OUTLINE_MAX}</span
						>{/if}</span
				>
			</label>
			<label class="layer">
				<input type="checkbox" bind:checked={numbers} disabled={!labels.length} />
				<span class="swatch number" aria-hidden="true">1</span>
				<span class="layer-name"
					>Placement order{#if !labels.length}<span class="layer-off">Numbered up to version {NUMBER_MAX}</span
						>{/if}</span
				>
			</label>
			<div class="all">
				<button type="button" class="small-btn" on:click={() => setAll(true)}>Show all</button>
				<button type="button" class="small-btn" on:click={() => setAll(false)}>Plain code</button>
			</div>
		</fieldset>

		<label class="mask-toggle">
			<input type="checkbox" bind:checked={masked} />
			Apply mask {qr.mask}
		</label>
		{#if !masked}
			<p class="note">
				The data as placed, before masking. The format information still names mask {qr.mask}, so this version will not
				scan; it is here to show what the mask changes.
			</p>
		{/if}
	</div>
</div>

<style>
	.anatomy {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18.5rem;
		gap: 1rem 1.4rem;
		align-items: start;
	}

	.figure {
		min-width: 0;
	}

	.symbol {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		aspect-ratio: 1;
		border-radius: 3px;
		touch-action: pinch-zoom;
		cursor: crosshair;
	}

	.symbol:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: 3px;
	}

	.labels text {
		fill: #000;
		stroke: #fff;
		stroke-width: 0.16px;
		paint-order: stroke;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-weight: 700;
		text-anchor: middle;
		pointer-events: none;
	}

	.labels text.ec-label {
		font-style: italic;
	}

	.cursor {
		fill: none;
		stroke: #00a2ff;
		stroke-width: 0.2px;
		pointer-events: none;
	}

	.readout {
		color: #ddd;
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
		min-height: 2.8em;
		max-width: 560px;
	}

	.controls {
		min-width: 0;
	}

	.plain {
		align-items: flex-start;
		display: flex;
		gap: 0.7rem;
		margin-bottom: 0.8rem;
	}

	.plain-code {
		flex: none;
		width: 7.5rem;
	}

	.plain-code :global(svg) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 3px;
	}

	.plain-side {
		min-width: 0;
	}

	.plain-head {
		color: #bbb;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		margin: 0;
		text-transform: uppercase;
	}

	.plain .downloads {
		margin-top: 0.3rem;
	}

	.layers {
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		margin: 0;
		padding: 0.4rem 0.7rem 0.6rem;
	}

	.layers legend {
		color: #bbb;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		padding: 0 0.3rem;
		text-transform: uppercase;
	}

	.layer {
		align-items: center;
		color: #ddd;
		cursor: pointer;
		display: flex;
		font-size: 0.85rem;
		gap: 0.45rem;
		padding: 0.12rem 0;
	}

	.layer input {
		accent-color: #5db65d;
		margin: 0;
	}

	.swatch {
		border: 1px solid rgba(255, 255, 255, 0.5);
		display: inline-flex;
		flex: none;
		height: 0.9rem;
		width: 1.4rem;
	}

	.swatch span {
		flex: 1;
	}

	.swatch.outline {
		background: repeating-linear-gradient(90deg, #fff 0 4px, #000 4px 5px);
	}

	.swatch.number {
		background: #fff;
		color: #000;
		font-size: 0.65rem;
		font-weight: 700;
		justify-content: center;
		line-height: 0.85rem;
	}

	.layer-name {
		flex: 1;
	}

	.layer-off {
		color: #999;
		display: block;
		font-size: 0.75rem;
	}

	.layer-head {
		color: #999;
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		margin: 0 0 0.1rem;
		text-align: right;
		text-transform: uppercase;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.layer-count {
		color: #999;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
	}

	.all,
	.downloads {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 0.5rem;
	}

	.small-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.3rem 0.7rem;
	}

	.small-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.mask-toggle {
		align-items: center;
		color: #ddd;
		display: flex;
		font-size: 0.9rem;
		gap: 0.45rem;
		margin-top: 0.8rem;
	}

	.mask-toggle input {
		accent-color: #5db65d;
		margin: 0;
	}

	.note {
		color: #bbb;
		font-size: 0.8rem;
		margin: 0.4rem 0 0;
	}

	.warn {
		color: #f66;
	}

	@media (max-width: 760px) {
		.anatomy {
			grid-template-columns: minmax(0, 1fr);
		}

		.symbol {
			margin: 0 auto;
		}
	}
</style>
