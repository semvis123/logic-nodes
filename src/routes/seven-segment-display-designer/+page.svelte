<script lang="ts">
	import { scrollRegion } from '$lib/scrollRegion';
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import PageHead from '$lib/PageHead.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import { readUrl, syncUrl, safeInt, safeOption, safeText } from '$lib/urlState';
	import {
		FONT, FONT_CHARS, hexTable, typeable, renderText, glyphFor, encodeByte, maskToSegments, byteCode, hex2, bin,
		bcdTable, bcdOutput, emptyGrid, rotateCw, flipH, flipV, invert, gridBytes, gridFromBytes, gridToHex, gridFromHex, textStrip,
		missingGlyphs, marqueeFrame, fontColumns, type ByteOrder, type Lang, type Grid, type Lines
	} from '$lib/displayDesigner';
	import Digit from './Digit.svelte';
	import Nixie from './Nixie.svelte';
	import Dots from './Dots.svelte';
	import Choice from './Choice.svelte';
	import CopyButton from './CopyButton.svelte';
	import { onMount, tick } from 'svelte';

	const A_GLYPH = gridFromBytes(FONT['A'], 5, 7, 'rows', true);
	const DEFAULT_TEXT = 'HELP';
	const DEFAULTS = {
		t: 'seg', n: 4, d: renderText(DEFAULT_TEXT, 4).masks.map(hex2).join(''), bo: 'lsb', cc: 'cathode', lg: 'c', sr: 'mine',
		w: 5, h: 7, g: gridToHex(A_GLYPH), ln: 'rows', mb: 'msb', mx: 'HELLO', ml: 'c', nx: '2026'
	};

	let kind = DEFAULTS.t;
	// Seven-segment
	let n = DEFAULTS.n;
	let text = DEFAULT_TEXT;
	let masks = renderText(text, n).masks;
	let sel = 0;
	let order = DEFAULTS.bo;
	let polarity = DEFAULTS.cc;
	let lang = DEFAULTS.lg;
	let source = DEFAULTS.sr;
	// Dot matrix
	let w = 5;
	let h = 7;
	let grid: Grid = A_GLYPH;
	let lines = DEFAULTS.ln;
	let bitOrder = DEFAULTS.mb;
	let mtext = DEFAULTS.mx;
	let mlang = DEFAULTS.ml;
	let cursor = 0;
	let paint: boolean | null = null;
	let offset = 0;
	let still = true;
	// Nixie
	let nx = DEFAULTS.nx;
	let nxCut = false;

	onMount(() => {
		const p = readUrl();
		kind = safeOption(p.t, ['seg', 'mat', 'nix'] as const) ?? kind;
		n = safeInt(p.n, 1, 8) ?? n;
		const d = safeText(p.d, 16);
		if (d && d.length === 2 * n && /^[0-9a-f]+$/i.test(d)) {
			masks = (d.match(/../g) ?? []).map((x) => parseInt(x, 16));
			text = '';
		} else masks = renderText(text, n).masks;
		order = safeOption(p.bo, ['lsb', 'msb'] as const) ?? order;
		polarity = safeOption(p.cc, ['cathode', 'anode'] as const) ?? polarity;
		lang = safeOption(p.lg, ['c', 'arduino', 'verilog'] as const) ?? lang;
		source = safeOption(p.sr, ['mine', 'hex'] as const) ?? source;
		w = safeInt(p.w, 1, 8) ?? w;
		h = safeInt(p.h, 1, 8) ?? h;
		grid = gridFromHex(p.g ?? '', w, h) ?? (w === 5 && h === 7 ? A_GLYPH : emptyGrid(w, h));
		lines = safeOption(p.ln, ['rows', 'cols'] as const) ?? lines;
		bitOrder = safeOption(p.mb, ['msb', 'lsb'] as const) ?? bitOrder;
		mtext = safeText(p.mx, 40) ?? mtext;
		mlang = safeOption(p.ml, ['c', 'arduino'] as const) ?? mlang;
		nx = (safeText(p.nx, 8) ?? nx).toUpperCase().replace(/[^0-9A-F]/g, '') || nx;
		still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const timer = setInterval(() => !still && (offset += 1), 140);
		tick().then(() => syncUrl(urlState, DEFAULTS));
		return () => clearInterval(timer);
	});

	$: urlState = { t: kind, n, d: masks.map(hex2).join(''), bo: order, cc: polarity, lg: lang, sr: source, w, h, g: gridToHex(grid), ln: lines, mb: bitOrder, mx: mtext, ml: mlang, nx };
	$: syncUrl(urlState, DEFAULTS);

	// ---- seven-segment ----
	const table = hexTable();
	$: opts = { order: order as ByteOrder, anode: polarity === 'anode' };
	$: rendered = renderText(text, n);
	$: bytes = (source === 'mine' ? masks : table.map((r) => r.mask)).map((m) => encodeByte(m, opts));
	$: orderNote = order === 'lsb' ? 'bits 7..0 = dp g f e d c b a' : 'bits 7..0 = a b c d e f g dp';
	$: code = byteCode(bytes, lang as Lang, source === 'mine' ? 'digits' : 'hexDigits', `${orderNote}, common ${polarity}${source === 'hex' ? ', digits 0 to F' : ''}`, opts.anode ? 0xff : 0);
	function setCount(k: number) {
		n = k;
		sel = Math.min(sel, k - 1);
		masks = text ? renderText(text, k).masks : Array.from({ length: k }, (_, i) => masks[i] ?? 0);
	}
	function toggle(i: number, bit: number) {
		masks[i] ^= 1 << bit;
		masks = masks;
		sel = i;
		text = '';
	}

	// ---- dot matrix ----
	const apply = (g: Grid) => ((grid = g), (h = g.length), (w = g[0].length), (cursor = 0));
	function resize(nw: number, nh: number) {
		apply(Array.from({ length: nh }, (_, r) => Array.from({ length: nw }, (_, c) => grid[r]?.[c] ?? false)));
	}
	$: msb = bitOrder === 'msb';
	$: matrixBytes = gridBytes(grid, lines as Lines, msb);
	$: matrixNote = `${lines === 'rows' ? 'one byte per row, top row first' : 'one byte per column, left column first'}; the ${lines === 'rows' ? 'leftmost' : 'top'} pixel is ${msb ? 'the highest bit used' : 'bit 0'}`;
	$: matrixCode = byteCode(matrixBytes, mlang as Lang, 'glyph', matrixNote);
	$: strip = textStrip(mtext);
	$: stripBytes = gridBytes(strip, 'cols', msb);
	$: stripCode = byteCode(stripBytes, mlang as Lang, 'message', `${strip[0].length} columns, one byte per column, ${msb ? 'top pixel is bit 6' : 'top pixel is bit 0'}`);
	$: fontCode = byteCode(fontColumns(), mlang as Lang, 'font5x7', `5 column bytes per character, in the order ${FONT_CHARS.replace(/\\/g, '')}, top pixel is bit 0`);
	$: frame = marqueeFrame(strip, still ? 0 : offset, 17);
	$: missing = missingGlyphs(mtext);
	function setCell(i: number, on: boolean) {
		const [r, c] = [Math.floor(i / w), i % w];
		if (grid[r][c] !== on) {
			grid[r][c] = on;
			grid = grid;
		}
	}
	function cellAt(e: PointerEvent) {
		const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
		return el?.dataset.i === undefined ? -1 : +el.dataset.i;
	}
	function down(e: PointerEvent) {
		const i = cellAt(e);
		if (i < 0) return;
		e.preventDefault();
		cursor = i;
		paint = !grid[Math.floor(i / w)][i % w];
		setCell(i, paint);
	}
	const move = (e: PointerEvent) => {
		const i = paint === null ? -1 : cellAt(e);
		if (i >= 0 && paint !== null) setCell(i, paint);
	};
	async function arrow(e: KeyboardEvent) {
		const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -w, ArrowDown: w } as Record<string, number>)[e.key];
		const next = cursor + step;
		if (step === undefined || next < 0 || next >= w * h || (Math.abs(step) === 1 && Math.floor(next / w) !== Math.floor(cursor / w))) return;
		e.preventDefault();
		cursor = next;
		await tick();
		(document.querySelector(`[data-i="${next}"]`) as HTMLElement).focus();
	}

	// ---- Nixie ----
	$: tubes = [...nx].map((ch) => ({ ch, code: parseInt(ch, 16), bits: bin(parseInt(ch, 16), 4), out: bcdOutput(parseInt(ch, 16)) }));
	$: packed = `0x${nx}`;
	const bcd = bcdTable();
	function typeNixie(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		nx = raw.toUpperCase().replace(/[^0-9A-F]/g, '');
		nxCut = nx.length !== raw.length;
	}

	const unsupported = [...'abcdefghijklmnopqrstuvwxyz'].filter((c) => glyphFor(c) === undefined);
	const rowStyle = (nn: number) => `grid-template-columns: repeat(${nn}, minmax(0, 1fr));`;
	const Z = table[0];

	const faqs = [
		{
			q: 'Why is 0x3F the code for a zero on a seven-segment display?',
			a: `A zero lights six of the seven bars, a to f, and leaves g dark. With a as bit 0, b as bit 1 and so on up to f as bit 5, those six bits are 111111 and g and the decimal point (bits 6 and 7) are 0, so the byte is ${bin(Z.mask)}, which is ${hex2(Z.cathode)} in hex. On a common anode display the same zero is the complement, ${hex2(Z.anode)}.`
		},
		{
			q: 'What is the difference between common cathode and common anode bytes?',
			a: 'Only the sign. On a common cathode display the shared pin goes to ground and a segment lights when its pin is driven high, so a 1 bit means lit. On a common anode display the shared pin goes to the supply and a segment lights when its pin is pulled low, so a 0 bit means lit. The byte for a given digit is therefore the bitwise complement: 0x3F becomes 0xC0.'
		},
		{
			q: 'Which bit order should I use for the segment bits?',
			a: 'Whichever matches your wiring. The common order puts segment a in bit 0 and the decimal point in bit 7 (dp g f e d c b a, reading from bit 7 down), which suits a port wired a to bit 0. Shift-register boards and some libraries put a in the top bit and the point in bit 0 (a b c d e f g dp). The two are mirror images of each other, and this page shows both so you can copy the one your hardware needs.'
		},
		{
			q: 'Which letters can a seven-segment display show?',
			a: `Only a few, and the shapes are conventions rather than a standard. This page draws digits, A, b, C, d, E, F, H, h, J, L, n, o, P, r, t, U and y, plus a dash, an underscore, an equals sign, a question mark and a degree sign. It cannot draw ${unsupported.join(', ').toUpperCase()} in any recognisable form. I and S borrow the shapes of 1 and 5.`
		},
		{
			q: 'Should I store a dot-matrix font as row bytes or column bytes?',
			a: 'Match the way the hardware is scanned. Many small 5 by 7 modules are driven one column at a time, so the natural unit is a column of 7 bits and a character is 5 bytes. An 8 by 8 module driven by shift registers or a driver chip is often written one row per byte. The two are the same picture rotated, and this page produces either, with the first pixel as the top bit or as bit 0.'
		},
		{
			q: 'What does a Nixie decoder do with the codes 10 to 15?',
			a: 'A BCD to decimal decoder driver for Nixie tubes, such as the 74141 or its Soviet equivalent K155ID1, selects one of ten outputs for the BCD codes 0 to 9. For the six codes 10 to 15 it selects none, so no cathode conducts and the tube stays dark. That is useful: leading zeros can be blanked by sending a code above 9.'
		},
		{
			q: 'How can a few pins drive many digits?',
			a: 'By multiplexing. The same-named segment pins of every digit are wired together, and each digit has its own common pin. The microcontroller puts one digit\'s segment byte on the shared lines, enables only that digit, and moves on to the next many times a second. Your eye blends the digits into a steady picture, at the price that each digit is lit only one share of the time, so the segments are driven harder while on.'
		}
	];
	const page = {
		title: 'Seven-Segment and Dot-Matrix Display Designer',
		description: 'Design seven-segment, 5x7 and 8x8 dot-matrix and Nixie displays by clicking, then copy the bytes as C, Arduino or Verilog for either bit order.',
		url: `${SITE}/seven-segment-display-designer`,
		image: `${SITE}/og/seven-segment-display-designer.png`,
		imageAlt: 'LogicGates.org: seven-segment and dot-matrix display designer'
	};
</script>

<PageHead {page} {faqs} crumb="Display designer" />

<ContentPage
	tool
	related={[
		{ href: '/seven-segment-decoder', label: 'Seven-segment decoder' },
		{ href: '/shift-registers', label: 'Shift registers' },
		{ href: '/ascii-table', label: 'ASCII table' },
		{ href: '/hex-to-binary', label: 'Hex to binary' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Seven-segment and dot-matrix display designer</h1>
		<p class="lede">
			Click segments or dots to draw a digit, a letter or a symbol, and read off the bytes that light it, as hex, binary,
			or a C array, an Arduino array or a Verilog case. Seven-segment, 5×7 and 8×8 dot-matrix and Nixie tubes are here.
		</p>

		<div class="card tool">
			<Choice fill hideLabel label="Display type" bind:value={kind} options={[['seg', 'Seven-segment'], ['mat', 'Dot-matrix'], ['nix', 'Nixie']]} />

			{#if kind === 'seg'}
				<div class="opt count" role="group" aria-label="Number of digits">
					<span class="opt-label">Digits</span>
					{#each [1, 2, 3, 4, 5, 6, 7, 8] as k}
						<button type="button" class:active={n === k} aria-pressed={n === k} on:click={() => setCount(k)}>{k}</button>
					{/each}
				</div>
				<label class="field" for="seg-text">Type text to show on the digits</label>
				<input id="seg-text" class="text" bind:value={text} on:input={() => (masks = renderText(text, n).masks)} maxlength="40" spellcheck="false" autocomplete="off" />
				<p class="field-help" role="status">
					{#if rendered.missing.length && text}
						No seven-segment shape for {rendered.missing.map((c) => `"${c}"`).join(', ')}; those digits are left blank.
					{:else if rendered.cut && text}
						{n} digit{n === 1 ? '' : 's'} shown; {rendered.cut} more character{rendered.cut === 1 ? '' : 's'} do not fit. A "." lights the point of the digit before it.
					{:else}
						Or click the segments and decimal points below. A "." in the text lights the point of the digit before it.
					{/if}
				</p>
				<div class="chips">
					{#each ['HELP', '3.14', 'dEAd', '0123', 'FACE', 'PASS'] as ex}
						<button type="button" class="chip-btn" on:click={() => ((text = ex), (masks = renderText(ex, n).masks))}>{ex}</button>
					{/each}
				</div>

				<div class="digits" style={rowStyle(n)} data-n={n}>
					{#each masks as mask, i}
						<div class="cell-digit" class:current={sel === i}>
							<Digit {mask} index={i} tabbable={sel === i} on:toggle={(e) => toggle(i, e.detail)} />
							<button type="button" class="tab" aria-pressed={sel === i} aria-label="Select digit {i + 1}, byte {hex2(encodeByte(mask, opts))}" on:click={() => (sel = i)}>{hex2(encodeByte(mask, opts))}</button>
						</div>
					{/each}
				</div>

				<div class="opts">
					<Choice label="Bit order" bind:value={order} options={[['lsb', 'dp g f e d c b a'], ['msb', 'a b c d e f g dp']]} />
					<Choice label="Display" bind:value={polarity} options={[['cathode', 'Common cathode'], ['anode', 'Common anode']]} />
				</div>
				<p class="field-help">{order === 'lsb' ? 'Segment a is bit 0 and the decimal point is bit 7.' : 'Segment a is bit 7 and the decimal point is bit 0.'} {polarity === 'anode' ? 'A common anode display lights a segment on a 0 bit, so every bit is inverted.' : 'A common cathode display lights a segment on a 1 bit.'}</p>

				<div class="table-wrap scroll-box" use:scrollRegion data-label="Bytes for each digit" role="status">
					<table class="data-table narrow">
						<thead>
							<tr><th scope="col">Digit</th><th scope="col">Segments lit</th><th scope="col">Hex</th><th scope="col">Binary</th></tr>
						</thead>
						<tbody>
							{#each masks as mask, i}
								{@const b = encodeByte(mask, opts)}
								<tr><td>{i + 1}</td><td class="mono">{maskToSegments(mask) || 'none'}</td><td class="mono strong">0x{hex2(b)}</td><td class="mono">{bin(b)}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="opts out-opts">
					<Choice label="Code for" bind:value={source} options={[['mine', 'Your digits'], ['hex', 'Digits 0 to F']]} />
					<Choice label="Language" bind:value={lang} options={[['c', 'C'], ['arduino', 'Arduino'], ['verilog', 'Verilog']]} />
				</div>
				<div class="scroll-box code" use:scrollRegion data-label="Generated code"><pre class="mono">{code}</pre></div>
				<p class="copy-row">
					<CopyButton text={code} label="Copy code" />
					<CopyButton text={bytes.map((b) => '0x' + hex2(b)).join(', ')} label="Copy bytes" />
				</p>
			{:else if kind === 'mat'}
				<div class="opt count" role="group" aria-label="Grid size">
					<span class="opt-label">Grid</span>
					<button type="button" class:active={w === 5 && h === 7} aria-pressed={w === 5 && h === 7} on:click={() => resize(5, 7)}>5×7</button>
					<button type="button" class:active={w === 8 && h === 8} aria-pressed={w === 8 && h === 8} on:click={() => resize(8, 8)}>8×8</button>
					{#if !((w === 5 && h === 7) || (w === 8 && h === 8))}<span class="note">{w}×{h} after rotating</span>{/if}
				</div>

				<div class="matrix" style="{rowStyle(w)} width: min(100%, {w * 2.8}rem)" role="group" aria-label="Dot grid, {w} columns by {h} rows. Arrow keys move, space toggles." on:pointerdown={down} on:pointermove={move} on:pointerup={() => (paint = null)} on:pointercancel={() => (paint = null)} on:pointerleave={() => (paint = null)}>
					{#each grid as row, r}
						{#each row as on, c}
							{@const i = r * w + c}
							<button type="button" class="dot" class:on data-i={i} tabindex={cursor === i ? 0 : -1} aria-pressed={on} aria-label="Row {r + 1}, column {c + 1}" on:focus={() => (cursor = i)} on:keydown={arrow} on:click={(e) => e.detail === 0 && setCell(i, !on)} />
						{/each}
					{/each}
				</div>
				<div class="chips tools">
					<button type="button" class="chip-btn" on:click={() => apply(rotateCw(grid))}>Rotate 90°</button>
					<button type="button" class="chip-btn" on:click={() => apply(flipH(grid))}>Flip left-right</button>
					<button type="button" class="chip-btn" on:click={() => apply(flipV(grid))}>Flip top-bottom</button>
					<button type="button" class="chip-btn" on:click={() => apply(invert(grid))}>Invert</button>
					<button type="button" class="chip-btn" on:click={() => apply(emptyGrid(w, h))}>Clear</button>
				</div>

				<div class="opts">
					<Choice label="Bytes are" bind:value={lines} options={[['rows', 'Rows'], ['cols', 'Columns']]} />
					<Choice label="First pixel" bind:value={bitOrder} options={[['msb', 'Top bit (MSB)'], ['lsb', 'Bit 0 (LSB)']]} />
					<Choice label="Language" bind:value={mlang} options={[['c', 'C'], ['arduino', 'Arduino']]} />
				</div>
				<p class="field-help">{matrixNote}.</p>
				<div class="scroll-box code" use:scrollRegion data-label="Generated code" role="status"><pre class="mono">{matrixCode}</pre></div>
				<p class="copy-row"><CopyButton text={matrixCode} label="Copy code" /> <CopyButton text={matrixBytes.map((b) => '0x' + hex2(b)).join(', ')} label="Copy bytes" /></p>

				<label class="field" for="mat-text">Type text to see it in the built-in 5×7 font</label>
				<input id="mat-text" class="text" bind:value={mtext} maxlength="40" spellcheck="false" autocomplete="off" />
				<p class="field-help" role="status">
					{missing.length ? `No glyph for ${missing.map((c) => `"${c}"`).join(', ')}; drawn as "?".` : `Digits, A to Z (one case) and ${FONT_CHARS.replace(/[0-9A-Z]/g, '').replace(' ', '')} are in the font.`}
				</p>
				<div class="strip scroll-box" use:scrollRegion data-label="Text in the dot font"><Dots grid={strip} size={9} label="Text drawn in the 5 by 7 font" /></div>
				<div class="marquee" aria-label="Scrolling preview">
					<Dots grid={frame} size={12} label="Scrolling preview of the text" />
					<p class="note">{still ? 'Static preview (reduced motion is on).' : 'Scrolling preview.'}</p>
				</div>
				<p class="copy-row">
					<CopyButton text={stripCode} label="Copy text as array" />
					<CopyButton text={fontCode} label="Copy whole font" />
				</p>
				<div class="scroll-box code" use:scrollRegion data-label="Text as an array"><pre class="mono">{stripCode}</pre></div>
				<p class="field-help">The whole font is {FONT_CHARS.length} characters, {FONT_CHARS.length * 5} bytes, always as columns with the top pixel in bit 0.</p>
			{:else}
				<label class="field" for="nixie-in">Digits to show on the tubes (0 to 9, or A to F for the codes 10 to 15)</label>
				<input id="nixie-in" class="text mono" value={nx} on:input={typeNixie} maxlength="8" spellcheck="false" autocomplete="off" aria-describedby="nixie-help" />
				<p class="field-help" id="nixie-help" role={nxCut ? 'alert' : 'status'}>{nxCut ? 'Only 0 to 9 and A to F are used here; other characters were dropped.' : 'A to F are BCD codes 10 to 15, which no tube numeral answers to: the tube stays dark.'}</p>
				<div class="tubes" style={rowStyle(Math.max(tubes.length, 1))} role="status">
					{#each tubes as t, i}
						<figure>
							<Nixie digit={t.out} uid={i} label={t.out === null ? `Tube ${i + 1} dark, code ${t.code} selects no output` : `Tube ${i + 1} showing ${t.out}`} />
							<figcaption><span class="mono">{t.bits}</span><br /><span class="note">{t.out === null ? 'none' : `output ${t.out}`}</span></figcaption>
					</figure>
					{/each}
				</div>
				<p class="copy-row"><CopyButton text={packed} label="Copy as packed BCD" /> <span class="note mono">{packed}</span></p>
			{/if}
			<p class="share-row"><ShareLink what="the display" /></p>
		</div>
	</section>

	<section id="table">
		<h2>Hex digits 0 to F on seven segments</h2>
		<p class="section-intro">
			Digits 0 to 9 use the same shapes as the <a href="/seven-segment-decoder">seven-segment decoder</a>. The letters are the usual lower-case b and d, so that B and D do not look like 8 and 0. This is generated from the same table the tool uses, with common cathode bytes in the order dp g f e d c b a and the common anode bytes beside them.
		</p>
		<div class="table-wrap" use:scrollRegion={'Hex digits on seven segments'}>
			<table class="data-table">
				<thead>
					<tr><th scope="col">Shows</th><th scope="col">Segments</th><th scope="col">Cathode hex</th><th scope="col">Cathode binary</th><th scope="col">Anode hex</th></tr>
				</thead>
				<tbody>
					{#each table as r}
						<tr><th scope="row">{r.digit}</th><td class="mono">{r.segments}</td><td class="mono strong">0x{hex2(r.cathode)}</td><td class="mono">{bin(r.cathode)}</td><td class="mono">0x{hex2(r.anode)}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="how">
		<h2>How a byte becomes lit segments</h2>
		<ul class="points">
			<li><strong>The byte is a wiring convention.</strong> Eight port pins go to the segment pins through resistors, and bit 0 of the byte is whichever segment you wired to the lowest pin. Wiring a to bit 0 up to g as bit 6 and the point as bit 7 is the most common choice, and it is what makes a zero {hex2(Z.cathode)}: bits 0 to 5 are a to f and nothing else is lit. If your wiring differs, change the bit order above or renumber the bits.</li>
			<li><strong>Anode against cathode.</strong> The segments are LEDs. With the cathodes joined, a high pin lights a segment; with the anodes joined, a low pin does. The display's pattern is the same either way, so the byte is just inverted: {hex2(Z.cathode)} becomes {hex2(Z.anode)}.</li>
			<li><strong>Several digits.</strong> Wiring the segment pins of all digits together and switching each digit's common pin in turn needs only 8 + n pins for n digits. Each digit is on for 1/n of the time, so the refresh must be fast enough to hide the flicker, and the current while a digit is on is usually set higher to make up the brightness.</li>
			<li><strong>The letters are conventions.</strong> No standard says what a seven-segment R or Y looks like. These glyphs are the common ones: {typeable().filter((c) => !/[0-9]/.test(c)).join(' ')}. Anything else, such as {unsupported.join(' ').toUpperCase()}, has no readable shape.</li>
		</ul>
	</section>

	<section id="matrix">
		<h2>Dot matrices: rows, columns and scan direction</h2>
		<p class="section-intro">
			A 5×7 module has 35 dots. It is usually scanned one column at a time: the controller puts a 7-bit pattern on the row lines, enables column 1, then column 2, up to column 5, over and over. That is why 5×7 fonts are stored as five column bytes per character. An 8×8 module is just as often scanned by row, so its natural unit is a row byte. The tool gives you both and the choice of which pixel is the top bit; rotate and flip convert between them. Transposing swaps the row bytes for the column bytes, and rotating four times returns the original grid.
		</p>
		<p class="section-intro">The built-in font here, drawn for this site and not copied from any named font, has these glyphs, shown as the tool would use them:</p>
		<div class="font" aria-label="The built-in font">
			{#each [...FONT_CHARS].filter((c) => c !== ' ') as ch}
				<figure><Dots grid={textStrip(ch)} size={6} label="Glyph {ch}" /><figcaption>{ch}</figcaption></figure>
			{/each}
		</div>
	</section>

	<section id="nixie">
		<h2>Nixie tubes and the BCD to decimal decoder</h2>
		<p class="section-intro">
			A Nixie tube holds ten cathodes shaped like the numerals 0 to 9, stacked one behind another, and a single anode. Connecting one cathode in the circuit makes its numeral glow, so a tube needs ten switched lines rather than seven. A BCD to decimal decoder driver such as the 74141 (the K155ID1 is the Soviet equivalent) turns four BCD bits into those ten lines: the code selects one output, and for codes above 9 none is selected, so the tube is dark. The table is generated from the same function that draws the tubes above.
		</p>
		<div class="table-wrap" use:scrollRegion={'BCD codes and the selected output'}>
			<table class="data-table narrow">
				<thead><tr><th scope="col">Code</th><th scope="col">B3 B2 B1 B0</th><th scope="col">Cathode selected</th></tr></thead>
				<tbody>
					{#each bcd as r}
						<tr><td class="mono">{r.code}</td><td class="mono">{r.bits.split('').join(' ')}</td><td class="mono" class:strong={r.output !== null}>{r.output ?? 'none, tube dark'}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="section-intro">Each BCD digit is one hex digit of the packed value, so 2026 is the bytes 0x20 0x26. See <a href="/seven-segment-decoder">the seven-segment decoder</a> for the same idea with seven outputs.</p>
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
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}
	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.2rem;
		margin: 0.8rem 0 0.4rem;
	}
	.out-opts {
		margin-top: 1.1rem;
	}
	.text {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.5rem 0.7rem;
	}
	.field-help,
	.note {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.7rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 1rem;
	}
	.chip-btn,
	.count button,
	.tab {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}
	.chip-btn:hover,
	.tab:hover {
		border-color: #5db65d;
		color: #fff;
	}
	.digits {
		display: grid;
		gap: 6px;
		margin: 0.4rem 0 0.6rem;
		max-width: 38rem;
	}
	.cell-digit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.2rem 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		background: #101012;
		min-width: 0;
	}
	.cell-digit.current {
		border-color: #5db65d;
	}
	.cell-digit :global(svg) {
		max-width: 5rem;
	}
	.tab {
		font: 0.78rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.15rem 0.4rem;
	}
	.tab[aria-pressed='true'] {
		background: #372;
		border-color: #5db65d;
		color: #fff;
	}
	.scroll-box {
		max-height: 18rem;
		overflow: auto;
	}
	.code {
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		margin-top: 0.8rem;
	}
	.code pre {
		margin: 0;
		padding: 0.6rem 0.8rem;
		color: #8ede8e;
		font-size: 0.85rem;
		white-space: pre;
	}
	.copy-row {
		margin-bottom: 1rem !important;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin: 0.6rem 0 0;
	}
	.narrow th,
	.narrow td {
		padding-left: 0.6rem;
		padding-right: 0.6rem;
	}
	.strong {
		color: #8ede8e;
		font-weight: 700;
	}
	.matrix {
		display: grid;
		gap: 3px;
		margin: 0.8rem 0 0.6rem;
		touch-action: none;
		user-select: none;
	}
	.dot {
		aspect-ratio: 1;
		padding: 0;
		border-radius: 50%;
		background: #2a2a2e;
		border: 1px solid #444;
		cursor: pointer;
		touch-action: none;
	}
	.dot.on {
		background: #f23;
		border-color: #f66;
	}
	.strip {
		margin-top: 0.4rem;
		padding: 0.6rem;
		background: #101012;
		border-radius: 3px;
		max-height: none;
	}
	.marquee {
		margin: 0.6rem 0 0;
		padding: 0.6rem;
		background: #101012;
		border-radius: 3px;
		width: fit-content;
		max-width: 100%;
		box-sizing: border-box;
	}
	.marquee .note {
		margin: 0.4rem 0 0;
	}
	.tubes {
		display: grid;
		gap: 8px;
		margin: 0.8rem 0;
		max-width: 40rem;
	}
	figure {
		margin: 0;
		text-align: center;
		min-width: 0;
	}
	.tubes figure :global(svg) {
		max-width: 4.5rem;
		margin: 0 auto;
	}
	figcaption {
		color: #ddd;
		font-size: 0.8rem;
	}
	.tubes .note {
		margin: 0;
		font-size: 0.72rem;
	}
	.font {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
		gap: 6px;
		margin: 0.8rem 0;
	}
	.font figure {
		padding: 0.3rem;
		background: #101012;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 3px;
	}
	.font figure :global(svg) {
		margin: 0 auto;
		width: 100%;
		max-width: 2.2rem;
	}
	.font figcaption {
		color: #bbb;
		font-size: 0.72rem;
	}
	.share-row {
		margin: 1rem 0 0;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}
</style>
