<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { scrollRegion } from '$lib/scrollRegion';
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import PageHead from '$lib/PageHead.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import ErrorAt from '$lib/ErrorAt.svelte';
	import ColumnWorking from '$lib/ColumnWorking.svelte';
	import { copyText, downloadPng, downloadSvg, slugifyExpression } from '$lib/download';
	import { readUrl, syncUrl, safeText, safeInt, safeOption } from '$lib/urlState';
	import {
		parse,
		build,
		compile,
		paint,
		evalGrid,
		toRgba,
		toSvg,
		exportCell,
		rootWorking,
		workingLayout,
		sierpinskiHolds,
		pascalMod2,
		hexColour,
		colourOf,
		bits8,
		PatternError,
		PALETTES,
		PRESETS,
		MODES,
		BIT_OPS,
		MAX_LENGTH,
		type Fn,
		type Mode,
		type Preset
	} from '$lib/bitPattern';

	const SIZES = [16, 32, 64, 128, 256];
	const NAMES = ['Expression', 'Red', 'Green', 'Blue'];
	const DEFAULTS = {
		e: 'x ^ y',
		r: 'x ^ y',
		g: 'x | y',
		b: 'x & y',
		s: 128,
		m: 'palette',
		k: 6,
		p: 'spectrum',
		t: 0,
		v: 15
	};

	// Index 0 is the single expression, 1 to 3 are red, green and blue.
	let ex = [DEFAULTS.e, DEFAULTS.r, DEFAULTS.g, DEFAULTS.b];
	let size = DEFAULTS.s;
	let mode = DEFAULTS.m as Mode;
	let bit = DEFAULTS.k;
	let pal = DEFAULTS.p;
	let t = DEFAULTS.t;
	let speed = DEFAULTS.v;
	let sel = { x: 45, y: 22 };

	onMount(() => {
		const p = readUrl();
		ex = [p.e, p.r, p.g, p.b].map((v, i) => safeText(v, MAX_LENGTH) ?? ex[i]);
		size = Number(safeOption(p.s, SIZES.map(String))) || size;
		mode =
			safeOption(
				p.m,
				MODES.map((m) => m.id)
			) ?? mode;
		bit = safeInt(p.k, 0, 7) ?? bit;
		pal =
			safeOption(
				p.p,
				PALETTES.map((q) => q.id)
			) ?? pal;
		t = safeInt(p.t, 0, 255) ?? t;
		speed = safeInt(p.v, 1, 120) ?? speed;
		mounted = true;
		thumbs = drawThumbs();
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Written back once settled, so a value the page refused does not stay in the link.
		tick().then(() => syncUrl(urlState, DEFAULTS));
	});

	$: fields = mode === 'rgb' ? [1, 2, 3] : [0];
	$: tries = fields.map((i) => {
		try {
			const node = parse(ex[i]);
			return { node, fn: build(node), err: '', at: 0 };
		} catch (e) {
			if (!(e instanceof PatternError)) throw e;
			return { node: undefined, fn: undefined, err: e.message, at: e.at };
		}
	});

	// While any expression is invalid the last good picture stays up. The server
	// sends an SVG; once the page is running, a canvas takes over, because
	// rebuilding an SVG 30 times a second is far slower than filling pixels.
	let svg = '';
	let mounted = false;
	let canvas: HTMLCanvasElement | undefined;
	let frame: ImageData | undefined;
	let buffer = new Uint32Array(0);
	$: look = { mode, bit, pal };
	$: ok = tries.every((r) => r.fn);
	$: if (ok && !mounted)
		svg = toSvg(
			paint(
				tries.map((r) => r.fn as Fn),
				look,
				size,
				t
			),
			size,
			1,
			'The picture the expression draws'
		);
	$: if (canvas && ok)
		draw(
			canvas,
			tries.map((r) => r.fn as Fn),
			look,
			size,
			t
		);
	function draw(c: HTMLCanvasElement, fns: Fn[], lk: typeof look, n: number, time: number) {
		if (buffer.length !== n * n) buffer = new Uint32Array(n * n);
		if (frame?.width !== n) {
			c.width = c.height = n;
			frame = c.getContext('2d')!.createImageData(n, n);
		}
		toRgba(paint(fns, lk, n, time, 1, buffer), frame.data);
		c.getContext('2d')!.putImageData(frame, 0, 0);
	}
	$: if (sel.x >= size || sel.y >= size) sel = { x: Math.min(sel.x, size - 1), y: Math.min(sel.y, size - 1) };

	// What the chosen pixel is, per expression.
	$: pixels = tries.map((r, k) => {
		if (!r.fn || !r.node) return null;
		const raw = r.fn(sel.x, sel.y, t);
		const w = rootWorking(ex[fields[k]], r.node);
		return { raw, v: raw & 255, work: w ? w(sel.x, sel.y, t) : null };
	});
	$: vs = pixels.map((p) => p?.v ?? 0);
	$: swatch = hexColour(colourOf(look, vs[0], vs[1], vs[2]));
	$: summary = `x ${sel.x}, y ${sel.y}: ${pixels
		.map((p, k) => (p ? `${mode === 'rgb' ? NAMES[k + 1].toLowerCase() : 'value'} ${p.v}, binary ${bits8(p.v)}` : ''))
		.join('; ')}`;

	// Hovering moves the marker silently; only keys and clicks are announced.
	let announce = '';
	function pick(x: number, y: number, say: boolean) {
		sel = { x: Math.max(0, Math.min(size - 1, x)), y: Math.max(0, Math.min(size - 1, y)) };
		if (say) tick().then(() => (announce = summary));
	}
	function pointer(e: PointerEvent | MouseEvent, say: boolean) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		pick(Math.floor(((e.clientX - r.left) / r.width) * size), Math.floor(((e.clientY - r.top) / r.height) * size), say);
	}
	function key(e: KeyboardEvent) {
		const d = e.shiftKey ? 8 : 1;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-d, 0],
			ArrowRight: [d, 0],
			ArrowUp: [0, -d],
			ArrowDown: [0, d],
			Home: [-size, 0],
			End: [size, 0]
		};
		const m = moves[e.key];
		if (!m) return;
		e.preventDefault();
		pick(sel.x + m[0], sel.y + m[1], true);
	}

	// Animation: off until asked for, and not offered when the system asks for less motion.
	// t advances by `speed` steps a second, however fast frames are drawn.
	let reduced = false;
	let playing = false;
	let last = 0;
	let owed = 0;
	function step(now: number) {
		if (!playing) return;
		owed += (Math.min(now - last, 250) * speed) / 1000;
		last = now;
		const n = Math.floor(owed);
		owed -= n;
		if (n) t = (t + n) % 256;
		requestAnimationFrame(step);
	}
	function play() {
		playing = !playing;
		last = performance.now();
		owed = 0;
		if (playing) requestAnimationFrame(step);
	}
	onDestroy(() => (playing = false));

	$: urlState = { e: ex[0], r: ex[1], g: ex[2], b: ex[3], s: size, m: mode, k: bit, p: pal, t, v: speed };
	$: playing || syncUrl(urlState, DEFAULTS);

	function usePreset(p: Preset) {
		const e = typeof p.e === 'string' ? [p.e, ex[1], ex[2], ex[3]] : [ex[0], ...p.e];
		ex = e;
		[size, mode, bit, pal, t] = [p.size, p.mode, p.bit ?? bit, p.pal ?? pal, p.t ?? 0];
		if (!!p.play !== playing && !(p.play && reduced)) play();
	}

	let status = '';
	const say = (m: string) => {
		status = m;
		setTimeout(() => (status = ''), 2500);
	};
	const outSvg = () =>
		toSvg(
			paint(
				tries.map((r) => r.fn as Fn),
				look,
				size,
				t
			),
			size,
			exportCell(size)
		);
	const fileName = () =>
		`bitwise-pattern-${slugifyExpression(mode === 'rgb' ? ex.slice(1).join(' ') : ex[0], 'pattern')}`;
	const exportOk = () => tries.every((r) => r.fn);
	async function savePng() {
		try {
			await downloadPng(outSvg(), `${fileName()}.png`, 1);
		} catch {
			say('Could not make the PNG here. Try the SVG.');
		}
	}
	async function copyExpr() {
		const text = mode === 'rgb' ? `r = ${ex[1]}\ng = ${ex[2]}\nb = ${ex[3]}` : ex[0];
		say((await copyText(text)) ? 'Expression copied' : 'Select the text and copy it');
	}

	// --- Teaching content, all drawn by the engine ---
	const grey = { mode: 'grey', bit: 0, pal: 'fire' } as const;
	const mini = (grid: ArrayLike<number>, n: number, label: string) =>
		toSvg(
			Array.from(grid, (v) => (v ? 0xe8e8e8 : 0x101014)),
			n,
			1,
			label
		);
	const size16 = 16;
	const pascal = mini(pascalMod2(size16), size16, 'C(x + y, x) mod 2, odd entries light');
	const andZero = mini(evalGrid(compile('((x & y) - 1) >> 31'), size16, 0), size16, 'Cells where x & y is 0, light');
	const holds = sierpinskiHolds(256);
	const planes = [3, 2, 1, 0].map((k) =>
		toSvg(paint([compile('x ^ y')], { ...grey, mode: 'bit', bit: k }, size16, 0), size16, 1, `Bit ${k} of x ^ y`)
	);
	const xorGrid = evalGrid(compile('x ^ y'), 256, 0);
	const sameAs = (e: string) => evalGrid(compile(e), 256, 0).every((v, i) => v === xorGrid[i]);
	const identities = ['(x ^ y) & (x | y)', '(x | y) - (x & y)', '(x + y) - 2 * (x & y)'].map((e) => ({
		e,
		same: sameAs(e)
	}));
	// Drawn after hydration: 12 small pictures would add about 80 KB to every prerendered copy of the page.
	let thumbs: string[] = [];
	const drawThumbs = () =>
		PRESETS.map((p) => {
			const fns = [p.e].flat().map(compile);
			return toSvg(
				paint(fns, { mode: p.mode, bit: p.bit ?? 0, pal: p.pal ?? 'fire' }, 32, p.t ?? 0, p.size / 32),
				32,
				1,
				''
			);
		});
	const ramps = PALETTES.map((p) => ({
		...p,
		css: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((u) => hexColour(p.at(u))).join(', ')})`
	}));

	const OPS: [string, string, string][] = [
		['~  -  +', 'Unary', 'Flip every bit, negate, or leave alone. Binds tightest.'],
		['*  /  %', 'Multiply, divide, remainder', 'Whole numbers only. / drops the fraction, and / or % by zero give 0.'],
		['+  -', 'Add, subtract', 'Wraps at 32 bits.'],
		['<<  >>', 'Shift left, right', 'The right shift keeps the sign. The count uses its low 5 bits.'],
		['&', 'AND', 'A bit is 1 only where both inputs have a 1.'],
		['^', 'XOR', 'A bit is 1 where the inputs differ.'],
		['|', 'OR', 'A bit is 1 where either input has a 1. Binds loosest.'],
		['abs(a)', 'Absolute value', 'The most negative 32-bit number has no positive twin, so it stays negative.'],
		['min(a, b)  max(a, b)', 'Smaller, larger', 'Of two values.'],
		[
			'sqrt(a)',
			'Square root',
			'Rounded down to a whole number; 0 for zero or less. sqrt(x * x + y * y) is distance from the corner.'
		],
		[
			'sin(a)  cos(a)',
			'Sine, cosine',
			'a counts a whole turn as 256, so only its low 8 bits matter. Results are whole numbers from -127 to 127: sin(64) is 127, sin(192) is -127, and cos(a) is sin(a + 64).'
		],
		[
			'atan2(y, x)',
			'Direction',
			'The angle of the point (x, y) from the middle, as a whole turn of 256: 0 along +x, 64 along +y (down the picture), 128 along -x, 192 along -y. Rounded to the nearest step; atan2(0, 0) is 0. Note that y comes first. Use atan2(y - 64, x - 64) for the angle round the centre of a 128 grid.'
		]
	];

	const faqs = [
		{
			q: 'What does x ^ y draw?',
			a: 'The XOR texture. For each pixel the value is the column number XOR the row number, and the picture is that value as a shade. Each quadrant is a copy of the whole picture at half size, either as it is or with the top bit of the value set, so the pattern repeats at every scale.'
		},
		{
			q: 'Why does x & y show the Sierpinski triangle?',
			a: `The entry C(x + y, x) of Pascal's triangle is odd exactly when x & y is 0. By Kummer's theorem the power of 2 dividing C(x + y, x) is the number of carries when x and y are added in binary, and the addition has no carries exactly when no bit position is set in both. Colour the odd entries and you have the Sierpinski triangle. ${
				holds
					? "This page builds Pascal's triangle by addition and confirms the match for every x and y below 256."
					: ''
			}`
		},
		{
			q: 'Why are the pictures limited to 256 shades?',
			a: 'A pixel is the low 8 bits of the result, so any value wraps: 256 draws the same shade as 0, and -1 the same as 255. Wrapping is what makes x * y curve into bands. To see higher bits, shift them down first, as in (x * y) >> 8.'
		},
		{
			q: 'Why do sin and cos give whole numbers from -127 to 127?',
			a: 'Everything in the expression is a 32-bit whole number, so sin takes a whole turn as 256 (only its low 8 bits count) and returns 127 times the sine, rounded: sin(64) is 127, sin(0) is 0 and sin(192) is -127. Add 128 to centre it on mid grey, as the Pond starting point does, or halve it before adding several together, as Plasma does.'
		},
		{
			q: 'How do I get an angle for spirals and sweeps?',
			a: 'Use atan2(y - 64, x - 64). It returns the direction of each pixel from the middle of a 128 by 128 picture as a whole turn of 256, in the same units that sin and cos take, so atan2(y - 64, x - 64) * 3 has three cycles round the middle. Adding the distance, sqrt((x - 64) * (x - 64) + (y - 64) * (y - 64)), twists those into spiral arms, and subtracting t * 4 turns them. Spiral arms and Radar sweep above are built this way.'
		},
		{
			q: 'What happens when I divide by zero?',
			a: 'The result is 0. An error half way through an image would leave nothing to look at, so this tool defines / and % by zero as 0. Row 0 of x % y is therefore black.'
		},
		{
			q: 'Is the expression run as code?',
			a: 'No. It is read by a small parser written for this page that knows the operators in the table above and nothing else, so a shared link cannot run anything. Everything happens in your browser and nothing is sent anywhere.'
		},
		{
			q: 'Why do x ^ y and (x ^ y) & (x | y) look the same?',
			a: `They are the same picture. A bit set in x ^ y is set in exactly one of x and y, so it is also set in x | y, and ANDing with x | y changes nothing. ${
				identities.every((i) => i.same)
					? 'This page compares all 65,536 pixels of x ^ y with (x | y) - (x & y) and (x + y) - 2 * (x & y) as well, and they all match.'
					: ''
			}`
		}
	];

	const page = {
		title: 'Bitwise Pattern Generator: XOR, AND and OR Art',
		description:
			'Draw pictures from expressions in x and y, such as x ^ y or x & y. See the Sierpinski triangle, single bit planes and the bit by bit working for any pixel.',
		url: `${SITE}/bitwise-pattern-generator`,
		image: `${SITE}/og/bitwise-pattern-generator.png`,
		imageAlt: 'LogicGates.org: bitwise pattern generator, XOR and AND art'
	};
</script>

<PageHead {page} {faqs} crumb="Bitwise pattern generator" />

<ContentPage
	tool
	related={[
		{ href: '/binary-calculator', label: 'Binary calculator, with AND, OR and XOR' },
		{ href: '/bit-manipulation-tricks', label: 'Bit manipulation tricks' },
		{ href: '/gray-code-converter', label: 'Gray code converter' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/hex-to-binary', label: 'Hex to binary' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Bitwise pattern generator</h1>
		<p class="lede">
			Type an expression in <span class="mono">x</span> and <span class="mono">y</span>, the column and row of each
			pixel, and see the picture it draws. Hover or arrow over a pixel to see the AND, XOR or OR that made it, bit by
			bit.
		</p>

		<div class="card tool">
			{#each fields as i, k}
				<label class="field" for="expr{i}">{NAMES[i]}{mode === 'rgb' ? ' channel' : ''}</label>
				<input
					id="expr{i}"
					class="expression-input"
					bind:value={ex[i]}
					maxlength={MAX_LENGTH}
					spellcheck="false"
					autocomplete="off"
					autocapitalize="off"
					aria-invalid={tries[k].err ? 'true' : 'false'}
					aria-describedby={tries[k].err ? `err${i}` : undefined}
				/>
				{#if tries[k].err}
					<ErrorAt id="err{i}" message={tries[k].err} input={ex[i]} position={tries[k].at} />
				{/if}
			{/each}
			<p class="field-help">
				Use x, y and t, whole numbers (decimal, 0x1F, 0b101), ~ - * / % + &lt;&lt; &gt;&gt; &amp; ^ | with brackets, and
				the functions abs, min, max, sqrt, sin, cos and atan2.
			</p>

			{#each [{ name: 'Still', moving: false }, { name: 'Moving', moving: true }] as g}
				<div class="chips" role="group" aria-label="{g.name} starting points">
					<span class="chip-label" aria-hidden="true">{g.name}</span>
					{#each PRESETS.filter((p) => !!p.play === g.moving) as p}
						<button type="button" class="chip-btn" on:click={() => usePreset(p)}>{p.label}</button>
					{/each}
				</div>
			{/each}

			<div class="controls">
				<div class="opt" role="group" aria-label="Colour mode">
					<span class="opt-label">Colour</span>
					{#each MODES as m}
						<button
							type="button"
							class:active={mode === m.id}
							aria-pressed={mode === m.id}
							on:click={() => (mode = m.id)}>{m.label}</button
						>
					{/each}
				</div>
				{#if mode === 'bit'}
					<div class="opt" role="group" aria-label="Bit to show">
						<span class="opt-label">Bit</span>
						{#each [7, 6, 5, 4, 3, 2, 1, 0] as k}
							<button type="button" class:active={bit === k} aria-pressed={bit === k} on:click={() => (bit = k)}
								>{k}</button
							>
						{/each}
					</div>
				{:else if mode === 'palette'}
					<div class="opt" role="group" aria-label="Palette">
						<span class="opt-label">Palette</span>
						{#each ramps as p}
							<button
								type="button"
								class:active={pal === p.id}
								aria-pressed={pal === p.id}
								on:click={() => (pal = p.id)}
								><span class="swatch" style="background: {p.css}" aria-hidden="true" />{p.label}</button
							>
						{/each}
					</div>
				{/if}
				<div class="opt" role="group" aria-label="Grid size">
					<span class="opt-label">Size</span>
					{#each SIZES as s}
						<button type="button" class:active={size === s} aria-pressed={size === s} on:click={() => (size = s)}
							>{s}</button
						>
					{/each}
				</div>
				<div class="opt">
					<label class="opt-label" for="t">t</label>
					<input id="t" type="range" min="0" max="255" bind:value={t} aria-describedby="t-help" />
					<output class="mono" for="t">{t}</output>
					<button type="button" class:active={playing} aria-pressed={playing} disabled={reduced} on:click={play}
						>Animate</button
					>
				</div>
				<div class="opt">
					<label class="opt-label" for="speed">Speed</label>
					<input id="speed" type="range" min="1" max="120" bind:value={speed} />
					<output class="mono" for="speed">{speed} steps/s</output>
				</div>
				<p class="field-help" id="t-help">
					{reduced
						? 'Animation is off because your system asks for reduced motion. Drag t instead.'
						: 't is a frame number from 0 to 255 you can use in the expression. Animate steps it at the speed set here.'}
				</p>
			</div>

			<div class="stage">
				<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
				<div
					class="picture"
					role="application"
					aria-label="The picture. Arrow keys move the marked pixel, shift and an arrow move 8."
					aria-describedby="readout"
					tabindex="0"
					on:pointermove={(e) => pointer(e, false)}
					on:click={(e) => pointer(e, true)}
					on:keydown={key}
				>
					{#if mounted}
						<canvas bind:this={canvas} aria-hidden="true" />
					{:else}
						{@html svg}
					{/if}
					<span
						class="marker"
						style="left: {(sel.x / size) * 100}%; top: {(sel.y / size) * 100}%; width: {100 / size}%; height: {100 /
							size}%"
					/>
				</div>

				<div class="readout" id="readout">
					<h2>Pixel x {sel.x}, y {sel.y}</h2>
					{#each pixels as px, k}
						{#if px}
							<p class="value">
								<span
									class="swatch big"
									style="background: {hexColour(colourOf(look, px.v, px.v, px.v))}"
									aria-hidden={mode !== 'rgb'}
								/>
								{mode === 'rgb' ? NAMES[k + 1] : 'Value'} <strong class="mono">{px.v}</strong>
								<span class="mono dim">= {bits8(px.v)}</span>
							</p>
							{#if px.work}
								<p class="note">
									A is <span class="mono">{px.work.aText}</span>, B is <span class="mono">{px.work.bText}</span>. {BIT_OPS[
										px.work.op
									]} of the low 8 bits, column by column:
								</p>
								<ColumnWorking
									layout={workingLayout(px.work)}
									label="{BIT_OPS[px.work.op]} working for {NAMES[fields[k]].toLowerCase()}"
								/>
							{:else}
								<p class="note">
									The result is {px.raw}{px.raw === px.v ? '' : `, and the picture keeps its low 8 bits, ${px.v}`}. The
									column working shows when the whole expression is one &amp;, ^ or |.
								</p>
							{/if}
						{/if}
					{/each}
					<p class="note">Colour <span class="mono">{swatch}</span></p>
				</div>
			</div>
			<p class="visually-hidden" role="status" aria-live="polite">{announce}</p>

			<div class="actions">
				<button type="button" class="chip-btn" disabled={!exportOk()} on:click={savePng}>Download PNG</button>
				<button
					type="button"
					class="chip-btn"
					disabled={!exportOk()}
					on:click={() => downloadSvg(outSvg(), `${fileName()}.svg`)}>Download SVG</button
				>
				<button type="button" class="chip-btn" on:click={copyExpr}>Copy expression</button>
				<ShareLink what="the expression and settings" />
				<span class="copied" role="status" aria-live="polite">{status}</span>
			</div>
		</div>
	</section>

	<section>
		<h2>What the expression can say</h2>
		<p class="section-intro">
			Every pixel is worked out on its own, with <span class="mono">x</span> as its column and
			<span class="mono">y</span> as its row, both counted from the top left. Numbers are 32-bit two's complement integers,
			so adding past 2,147,483,647 wraps round to negative, and the picture shows the low 8 bits of the result: in greyscale,
			0 is black and 255 is white.
		</p>
		<div class="table-wrap scroll-box" use:scrollRegion data-label="Operators and functions">
			<table class="data-table">
				<thead
					><tr><th scope="col">Operator or function</th><th scope="col">Name</th><th scope="col">Notes</th></tr></thead
				>
				<tbody>
					{#each OPS as [op, name, note]}
						<tr><th scope="row" class="mono nowrap">{op}</th><td>{name}</td><td>{note}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="reducer">
			Rows run from tightest to loosest, as in C. So <span class="mono">x + y &amp; 8</span> is
			<span class="mono">(x + y) &amp; 8</span>, and <span class="mono">^</span> is XOR here, never a power.
		</p>
	</section>

	<section>
		<h2>Starting points</h2>
		<p class="section-intro">
			Each thumbnail is drawn by the same engine as the picture above. Press the name to load it.
		</p>
		<div class="table-wrap scroll-box" use:scrollRegion data-label="Presets">
			<table class="data-table presets">
				<thead
					><tr><th scope="col">Picture</th><th scope="col">Expression</th><th scope="col">What to notice</th></tr
					></thead
				>
				<tbody>
					{#each PRESETS as p, i}
						<tr>
							<td class="thumb">{@html thumbs[i] ?? ''}</td>
							<td
								><button type="button" class="chip-btn" on:click={() => usePreset(p)}>{p.label}</button><br /><span
									class="mono nowrap">{[p.e].flat().join(' , ')}</span
								></td
							>
							<td>{p.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<h2>Why x &amp; y is the Sierpinski triangle</h2>
		<p>
			Build Pascal's triangle with the usual rule, each entry the one above plus the one to its left, and keep only
			whether it is odd. Lay the entries on a grid so that the entry in column x and row y is C(x + y, x). On the left
			is that grid for 16 by 16. On the right is a light cell wherever <span class="mono">x &amp; y</span> is 0. They
			are the same picture{holds ? ', and the check holds for all 256 by 256 cells' : ''}.
		</p>
		<div class="pair">
			<figure>
				{@html pascal}
				<figcaption>Odd entries of C(x + y, x)</figcaption>
			</figure>
			<figure>
				{@html andZero}
				<figcaption>Cells where x &amp; y is 0</figcaption>
			</figure>
		</div>
		<p>
			The reason is Kummer's theorem: the highest power of 2 dividing C(x + y, x) is the number of carries when you add
			x and y in binary. The entry is odd when that number is 0. Adding two numbers carries at all exactly when some
			column has a 1 in both, which is to say when
			<span class="mono">x &amp; y</span> is not 0. The preset <span class="mono">((x &amp; y) - 1) &gt;&gt; 31</span> shows
			it directly: the subtraction makes a 0 negative, and the shift turns a negative number into all ones.
		</p>
	</section>

	<section>
		<h2>Why x ^ y repeats itself</h2>
		<p>
			Look at the top bit of x and of y in a grid whose size is a power of two. In the top left quadrant both are 0, and
			in the bottom right both are 1; in either case the XOR of the top bits is 0, so the quadrant is a copy of the
			picture one size down. In the other two quadrants exactly one is 1, so the top bit of the result is set: the same
			copy, brighter by half the grid size. Here are the four bit planes of <span class="mono">x ^ y</span> on a 16 by 16
			grid, from bit 3 down to bit 0.
		</p>
		<div class="pair planes">
			{#each planes as plane, i}
				<figure>
					{@html plane}
					<figcaption>Bit {3 - i}</figcaption>
				</figure>
			{/each}
		</div>
		<p>
			A bit plane is one bit of every pixel's value, shown as on or off. Bit 3 splits the grid into four quadrants, bit
			2 splits each of those again, and bit 0 is a checkerboard. Use One bit above to look at any plane of any
			expression.
		</p>
		<p>
			Different expressions can be one picture. {#each identities as id, i}<span class="mono">{id.e}</span>{i <
				identities.length - 1
					? ', '
					: ' '}{/each}
			{identities.every((i) => i.same)
				? 'all draw exactly x ^ y, and the page has compared every pixel to prove it.'
				: 'are compared with x ^ y on this page.'}
		</p>
	</section>

	<section>
		<h2>Animating t</h2>
		<p>
			The slider sets <span class="mono">t</span> to a value from 0 to 255 and the Animate button steps it, wrapping
			from 255 to 0, at the number of steps a second set by the Speed slider. Try <span class="mono">(x ^ y) + t</span>
			in a palette, or <span class="mono">(x ^ t) &amp; y</span> in One bit. The starting points marked as moving, such as
			Plasma and Ripples, begin animating when you load them. Animation never starts by itself otherwise, and it is switched
			off if your system asks for reduced motion.
		</p>
		<p>
			The moving starting points use t in a few ways. Added to a coordinate or a distance, as in
			<span class="mono">x + t</span>, it scrolls the picture. Inside <span class="mono">sin</span> or
			<span class="mono">cos</span> it is a position or angle in a repeating cycle: <span class="mono">sin(t)</span> moves
			the zoom in XOR zoom, and the angle in Spinning XOR is t itself, so frames 0 to 255 are one full turn. Because sin
			and cos repeat every 256, those pictures join up when t wraps from 255 to 0; ones that just add t, such as Scrolling
			maze, jump at that point. Subtracting t from a distance or an angle, as in Ripples and Spiral arms, sends the rings
			or arms outwards or round, and the sign decides the direction.
		</p>
	</section>

	<section>
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Everything looks black.</strong> At size 16 the largest x ^ y is 15, which is nearly black in 256
				shades. Multiply it up, as in <span class="mono">(x ^ y) * 16</span>, or pick a palette.
			</li>
			<li><strong>Using ^ as a power.</strong> It is XOR. Multiply for squares: <span class="mono">x * x</span>.</li>
			<li>
				<strong>Using &lt;, == or &amp;&amp;.</strong> Comparisons are not supported. Subtract and shift instead, as in the
				Sierpinski preset.
			</li>
			<li>
				<strong>Expecting fractions.</strong> <span class="mono">x / 2</span> is whole division, so
				<span class="mono">5 / 2</span> is 2.
			</li>
			<li>
				<strong>Forgetting the wrap.</strong> <span class="mono">x * y</span> is drawn modulo 256, so large products band.
				Shift right to look at the higher bits.
			</li>
		</ul>
	</section>

	<section class="faq">
		<h2>Questions</h2>
		{#each faqs as faq, i}
			<details open={i === 0}>
				<summary>{faq.q}</summary>
				<p>{faq.a}</p>
			</details>
		{/each}
		<p class="reducer">
			The operators are explained on the <a href="/binary-calculator">binary calculator</a> and in
			<a href="/bit-manipulation-tricks">bit manipulation tricks</a>; for the other neighbour of x ^ y, see the
			<a href="/gray-code-converter">Gray code converter</a>.
		</p>
	</section>
</ContentPage>

<style>
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}
	.expression-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
		margin-bottom: 0.3rem;
	}
	.expression-input:focus {
		outline: none;
		border-color: #5db65d;
	}
	.expression-input[aria-invalid='true'] {
		border-color: #f66;
	}
	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.3rem 0 0.7rem;
	}
	.chips,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-bottom: 1rem;
	}
	.chip-label {
		flex-basis: 100%;
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.chips + .chips {
		margin-top: -0.4rem;
	}
	.chip-btn,
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
	.chip-btn:hover:not(:disabled) {
		border-color: #5db65d;
		color: #fff;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 0.4rem;
	}
	.controls .field-help {
		margin: 0;
	}
	.opt {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}
	.opt-label {
		color: #999;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-right: 0.15rem;
		min-width: 3.2rem;
	}
	input[type='range'] {
		width: 10rem;
		max-width: 40vw;
	}
	output {
		min-width: 2rem;
	}
	.swatch {
		display: inline-block;
		width: 1.6rem;
		height: 0.7rem;
		border-radius: 2px;
		margin-right: 0.4rem;
		vertical-align: middle;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}
	.swatch.big {
		width: 1rem;
		height: 1rem;
		margin-right: 0.5rem;
	}
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 512px) minmax(0, 1fr);
		gap: 1.2rem;
		align-items: start;
		margin: 1rem 0;
	}
	@media (max-width: 760px) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.picture {
		position: relative;
		line-height: 0;
		border: 1px solid rgba(255, 255, 255, 0.4);
		cursor: crosshair;
		aspect-ratio: 1;
	}
	.picture :global(svg),
	.picture canvas {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
	}
	.picture canvas {
		image-rendering: pixelated;
	}
	.marker {
		position: absolute;
		pointer-events: none;
		box-shadow: 0 0 0 1px #000, 0 0 0 3px #fff, 0 0 0 4px #000;
	}
	.picture:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: 3px;
	}
	.readout h2 {
		font-size: 1.05rem;
		margin: 0 0 0.6rem;
	}
	.readout p {
		margin: 0.4rem 0;
	}
	.value {
		font-size: 1.05rem;
	}
	.dim {
		color: #aaa;
	}
	.note {
		color: #bbb;
		font-size: 0.85rem;
	}
	.copied {
		color: #8ede8e;
		font-size: 0.8rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.scroll-box {
		max-height: 520px;
		overflow: auto;
	}
	.data-table td,
	.data-table th {
		vertical-align: top;
	}
	.data-table td:last-child {
		min-width: 14rem;
	}
	.presets .thumb {
		width: 5rem;
		height: 5rem;
		box-sizing: border-box;
		padding: 0.4rem 0.6rem;
		line-height: 0;
	}
	.presets .thumb :global(svg) {
		width: 4rem;
		height: 4rem;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}
	.pair {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 1rem 0;
	}
	.pair figure {
		margin: 0;
		width: 12rem;
		line-height: 0;
	}
	.planes figure {
		width: 7rem;
	}
	.pair figure :global(svg) {
		width: 100%;
		height: auto;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}
	figcaption {
		color: #bbb;
		font-size: 0.8rem;
		line-height: 1.3;
		margin-top: 0.3rem;
	}
</style>
