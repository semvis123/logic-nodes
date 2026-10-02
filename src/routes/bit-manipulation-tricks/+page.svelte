<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		tricks,
		categories,
		trickById,
		getTrick,
		runTrick,
		resultText,
		valueText,
		groupedBits,
		hexOf,
		parseOperand,
		BitTrickError,
		MAX_INPUT,
		WIDTHS,
		cType,
		type Width,
		type Trick,
		type Trace as TraceT,
		type Example,
		type Inputs
	} from '$lib/bitTricks';
	import { readUrl, syncUrl, safeText, safeInt, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import Trace from './Trace.svelte';
	import { onMount, tick } from 'svelte';

	const ids = tricks.map((t) => t.id);
	const DEFAULT_T = 'clear-lowest-set-bit';
	const widthOptions = WIDTHS.map(String) as ('8' | '16' | '32')[];

	/** The values a trick opens with: its first example. */
	function defaultsFor(trick: Trick) {
		const e = trick.examples[0];
		return { x: e.x, y: e.y ?? '', n: e.n ?? 0 };
	}

	let t = DEFAULT_T;
	let w: Width = 8;
	let x = defaultsFor(getTrick(DEFAULT_T)).x;
	let y = '';
	let n: number | null = 0;

	function writeUrl(tr: Trick, values: { t: string; w: Width; x: string; y: string; n: number | null }) {
		syncUrl(
			{ ...values, y: tr.y ? values.y : undefined, n: tr.n ? values.n ?? '' : undefined },
			{ t: DEFAULT_T, w: 8, ...defaultsFor(tr) }
		);
	}

	onMount(() => {
		const p = readUrl();
		// A link to a trick's anchor opens that trick in the tool as well.
		const fromHash = location.hash.slice(1);
		t = safeOption(p.t, ids) ?? safeOption(fromHash, ids) ?? t;
		w = Number(safeOption(p.w, widthOptions) ?? w) as Width;
		const d = defaultsFor(getTrick(t));
		x = safeText(p.x, MAX_INPUT) ?? d.x;
		y = safeText(p.y, MAX_INPUT) ?? d.y;
		n = safeInt(p.n, 0, 32) ?? d.n;
		// The reactive write below only runs when a value changes, so a link
		// with a bad value that falls back to the default would keep it.
		writeUrl(getTrick(t), { t, w, x, y, n });
	});

	$: trick = trickById(t) ?? tricks[0];
	$: writeUrl(trick, { t, w, x, y, n });

	// Runs at build time too, so the page ships with a real trace. On bad input
	// the last good trace stays, dimmed, rather than the layout collapsing.
	let inputs: Inputs = { x: 0, y: 0, n: 0, w: 8 };
	let trace: TraceT = getTrick(DEFAULT_T).trace({ x: 88, y: 0, n: 0, w: 8 });
	let error = '';
	let errorField = '';
	$: {
		try {
			const run = runTrick(trick, { x, y, n: n ?? NaN }, w);
			inputs = run.inputs;
			trace = run.trace;
			error = '';
			errorField = '';
		} catch (e) {
			error = e instanceof BitTrickError ? e.message : 'That is not a number.';
			errorField = e instanceof BitTrickError ? e.field : 'x';
		}
	}

	// Tricks that read x as something other than a plain number: a character
	// code, or a k-bit field. Moving to or from one of them starts from its own
	// example rather than carrying a value across that means something else.
	const ownInput = ['ascii-case-toggle', 'sign-extension'];

	/**
	 * Opens another trick. A value the person typed for x carries over, so they
	 * can step through the tricks with their own number; y and n carry over
	 * only when they mean the same thing in both tricks.
	 */
	function selectTrick(id: string) {
		const next = trickById(id);
		if (!next) return;
		const prev = trick;
		const d = defaultsFor(next);
		const typed = x !== defaultsFor(prev).x && !ownInput.includes(prev.id) && !ownInput.includes(next.id);
		let fits = true;
		try {
			parseOperand(x, w);
		} catch {
			fits = false;
		}
		const sameY = !!prev.y && prev.y === next.y && y !== defaultsFor(prev).y;
		const sameN = !!prev.n && prev.n === next.n && n !== defaultsFor(prev).n;
		t = id;
		if (!(typed && fits)) x = d.x;
		if (!sameY) y = d.y;
		if (!sameN) n = d.n;
	}

	$: index = tricks.indexOf(trick);

	function tryExample(e: Example) {
		if (e.w) w = e.w;
		x = e.x;
		if (e.y !== undefined) y = e.y;
		if (e.n !== undefined) n = e.n;
	}

	async function openTrick(id: string) {
		selectTrick(id);
		await tick();
		const tool = document.getElementById('tool');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		tool?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
		document.getElementById('trick')?.focus({ preventScroll: true });
	}

	let copyState: 'idle' | 'copied' | 'failed' = 'idle';
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copyCode() {
		try {
			await navigator.clipboard.writeText(trick.code(w));
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copyState = 'idle'), 2500);
	}

	function answerDetail(tr: TraceT, width: Width): string {
		const r = tr.result;
		if (r.kind === 'bits') return `${groupedBits(r.value, width)} in binary, ${hexOf(r.value, width)} in hex`;
		if (r.kind === 'pair') return r.names.map((name, i) => `${name}: ${groupedBits(r.value[i], width)}`).join(', ');
		return '';
	}

	// Worked examples for the catalogue and the cheat sheet, all at 8 bits.
	const worked = tricks.map((tr) => {
		const e = tr.examples[0];
		const run = runTrick(tr, { x: e.x, y: e.y ?? '', n: e.n ?? 0 }, 8);
		return { trick: tr, example: e, ...run };
	});
	const workedById = Object.fromEntries(worked.map((wk) => [wk.trick.id, wk]));

	function inputText(wk: typeof worked[number]): string {
		const tr = wk.trick;
		const parts = [`x = ${groupedBits(wk.inputs.x, 8)} (${valueText(wk.inputs.x, 8, tr.signedView)})`];
		if (tr.y) parts.push(`${tr.y} = ${valueText(wk.inputs.y, 8, tr.signedView)}`);
		if (tr.n) parts.push(`${tr.n.label.replace(' bits', '')} = ${wk.inputs.n}`);
		return parts.join(', ');
	}

	/** The cheat sheet's compact form: x in bits, then y or n. */
	function shortInput(wk: typeof worked[number]): string {
		const tr = wk.trick;
		const parts = [`x = ${groupedBits(wk.inputs.x, 8)}`];
		if (tr.y) parts.push(`${tr.y} = ${valueText(wk.inputs.y, 8, tr.signedView)}`);
		if (tr.n) parts.push(`${tr.n.label.replace(' bits', '')} = ${wk.inputs.n}`);
		return parts.join(', ');
	}

	/** What the variables in a trick's C are declared as. */
	function typesNote(tr: Trick, width: Width): string {
		const ty = cType(tr, width);
		if (tr.y) return `x and ${tr.y} are ${ty} values.`;
		return `${tr.id === 'ascii-case-toggle' ? 'c' : 'x'} is ${ty.startsWith('u') ? 'a' : 'an'} ${ty}.`;
	}

	/** Lets keyboard users scroll a code block that is wider than its box, and only then. */
	function scrollFocus(node: HTMLElement) {
		const update = () => {
			if (node.scrollWidth > node.clientWidth + 1) {
				node.tabIndex = 0;
				node.setAttribute('role', 'region');
				node.setAttribute('aria-label', node.dataset.label ?? 'Code');
			} else {
				node.removeAttribute('tabindex');
				node.removeAttribute('role');
				node.removeAttribute('aria-label');
			}
		};
		// Re-checked when the box resizes and when the code in it changes.
		const ro = new ResizeObserver(update);
		ro.observe(node);
		const mo = new MutationObserver(update);
		mo.observe(node, { subtree: true, childList: true, characterData: true });
		update();
		return {
			destroy: () => {
				ro.disconnect();
				mo.disconnect();
			}
		};
	}

	/** The cheat sheet's C: the first line of code, with any comment lines left out. */
	function shortCode(tr: Trick): string {
		const lines = tr
			.code(8)
			.split('\n')
			.filter((l) => !l.startsWith('/*'));
		return lines[0] + (lines.length > 1 ? ' …' : '');
	}

	function outputText(wk: typeof worked[number]): string {
		const r = wk.trace.result;
		if (r.kind === 'bits') return `${groupedBits(r.value, 8)} (${valueText(r.value, 8, wk.trick.signedView)})`;
		return resultText(r, 8, wk.trick.signedView);
	}

	const byCategory = categories.map((c) => ({ ...c, tricks: tricks.filter((tr) => tr.category === c.id) }));

	// The JavaScript results are evaluated here, at build time, so they are what
	// JavaScript really does. The C, Python and Java results were checked by
	// compiling and running the same lines (GCC 13, Clang 18, Python 3.11, OpenJDK 21).
	const js = {
		allOnes: String(0xffffffff | 0),
		twoTo32: String((2 ** 32) | 0),
		oneShl31: String(1 << 31),
		trunc: String(5.7 | 0),
		minusOneUnsigned: String(-1 >>> 0),
		sar: String(-8 >> 1),
		shr: String(-8 >>> 28),
		shl32: String(1 << 32),
		big: String(1n << 32n) + 'n'
	};

	const gotchas: { id: string; lang: string; title: string; code: string[]; text: string }[] = [
		{
			id: 'gotcha-js-32-bit',
			lang: 'JavaScript',
			title: 'Bitwise operators work on 32-bit signed integers',
			code: [
				`0xFFFFFFFF | 0   // ${js.allOnes}`,
				`2 ** 32 | 0      // ${js.twoTo32}`,
				`1 << 31          // ${js.oneShl31}`,
				`5.7 | 0          // ${js.trunc}`
			],
			text:
				'Numbers are 64-bit floats, but every bitwise operator except >>> converts its operands to 32-bit signed integers and returns one. Bits above 31 are dropped, fractions are cut off, and a result with the top bit set comes out negative. For wider values use BigInt, where 1n << 32n is ' +
				js.big +
				'.'
		},
		{
			id: 'gotcha-js-unsigned-shift',
			lang: 'JavaScript',
			title: '>>> is the unsigned shift, and shift counts wrap at 32',
			code: [
				`-8 >> 1    // ${js.sar}`,
				`-8 >>> 28  // ${js.shr}`,
				`-1 >>> 0   // ${js.minusOneUnsigned}`,
				`1 << 32    // ${js.shl32}`
			],
			text: '>> copies the sign bit in from the left; >>> reads its left operand as an unsigned 32-bit integer, shifts in zeros and returns an unsigned result, so x >>> 0 is the usual way to read a result as unsigned. Only the low 5 bits of the shift count are used, so shifting by 32 is a shift by 0.'
		},
		{
			id: 'gotcha-python-unbounded',
			lang: 'Python',
			title: 'Integers are unbounded, so ~x == -x - 1',
			code: [
				'~5         # -6',
				'-1 >> 1    # -1',
				'~5 & 0xFF  # 250',
				'-7 % 8     # 1',
				'1 << 100',
				'# 1267650600228229401496703205376'
			],
			text: 'A Python int has no width, so there is no top bit to fill: ~x is defined as −x − 1, as if the number had infinitely many sign bits, and >> on a negative number never reaches 0. To get the C result at a fixed width, mask it: & 0xFF for 8 bits, & 0xFFFFFFFF for 32. Python’s // rounds towards minus infinity, so % takes the sign of the divisor, and for a power of two it agrees with x & (n − 1) even for negative x.'
		},
		{
			id: 'gotcha-c-precedence',
			lang: 'C',
			title: 'x & 1 == 0 is not an even test',
			code: ['/* x & (1 == 0): never true */', 'if (x & 1 == 0)', '/* what was meant */', 'if ((x & 1) == 0)'],
			text: 'In C, and in the languages that copied its table (C++, Java, JavaScript), == binds more tightly than &, ^ and |. So x & 1 == 0 compares 1 with 0 first and then ANDs x with the result, 0. GCC and Clang warn about it with -Wall (-Wparentheses). Shifts bind more tightly than comparisons but more loosely than + and −, so 1 << n - 1 is 1 << (n − 1). When in doubt, add brackets.'
		},
		{
			id: 'gotcha-c-shift-width',
			lang: 'C',
			title: 'Shifting by the width or more is undefined',
			code: [
				'/* undefined */',
				'uint32_t a = 1u << 32;',
				'/* overflow: use 1u */',
				'int b = 1 << 31;',
				'/* -4 on GCC and Clang */',
				'int c = -8 >> 1;'
			],
			text: 'A shift count must be less than the width of the (promoted) left operand. The compiler may assume it never is, so the result is not reliably 0: on x86 the shift instruction uses only the low 5 bits of the count, and 1u << n with n = 32 at run time gave 1 when we ran it. Shifting a 1 into the sign bit of a signed int overflows it, which C also makes undefined (from C99 on, C23 included), so build masks from unsigned constants. Right-shifting a negative value is implementation-defined; GCC and Clang shift arithmetically.'
		},
		{
			id: 'gotcha-java-promotion',
			lang: 'Java',
			title: 'byte is promoted to int before >>>',
			code: [
				'byte b = (byte) 0xF0;',
				'b >>> 4           // 268435455',
				'(byte) (b >>> 4)  // -1',
				'(b & 0xFF) >>> 4  // 15'
			],
			text: 'Java has >>> like JavaScript, but byte and short operands are promoted to int first, with sign extension. 0xF0 as a byte is −16, which becomes 0xFFFFFFF0 as an int, so the unsigned shift moves 28 ones down instead of four. Mask with & 0xFF first to get the unsigned byte. Java defines over-long shifts: an int shift uses the low 5 bits of the count, so 1 << 32 is 1, and a long shift the low 6.'
		}
	];

	const ex = (id: string) => workedById[id];
	const clearLow = ex('clear-lowest-set-bit');
	const isolate = ex('isolate-lowest-set-bit');
	const pow = getTrick('is-power-of-two');
	const powYes = pow.trace({ x: 64, y: 0, n: 0, w: 8 });
	const powNo = pow.trace({ x: 96, y: 0, n: 0, w: 8 });
	const absMin = getTrick('branchless-abs').trace({ x: parseOperand('-128', 8), y: 0, n: 0, w: 8 });

	const faqs = [
		{
			q: 'What does x & (x - 1) do?',
			a: `It clears the lowest set bit of x. Subtracting 1 turns the lowest 1 into a 0 and the 0s below it into 1s, so x and x − 1 agree only above that bit, and AND keeps just those bits. For x = ${groupedBits(
				clearLow.inputs.x,
				8
			)} (${clearLow.inputs.x}) the result is ${groupedBits(Number(clearLow.trace.result.value), 8)} (${
				clearLow.trace.result.value
			}). It is the core of the power-of-two test and of Kernighan's bit-counting loop.`
		},
		{
			q: 'How do I check whether a number is a power of two?',
			a: `Use x != 0 && (x & (x - 1)) == 0. A power of two has exactly one set bit, so clearing its lowest set bit leaves 0. For 64 (${groupedBits(
				64,
				8
			)}) x & (x − 1) is ${powYes.rows[2].value}, so it is a power of two; for 96 (${groupedBits(96, 8)}) it is ${
				powNo.rows[2].value
			}, so it is not. The x != 0 test is needed because 0 also gives 0.`
		},
		{
			q: 'Why does x & -x give the lowest set bit?',
			a: `In two's complement −x is ~x + 1. Inverting x turns its trailing zeros into ones, and adding 1 carries through them into the position of the lowest set bit. So −x agrees with x at that bit and is the inverse of x everywhere above it, and the AND keeps only that one bit. For ${isolate.inputs.x} it gives ${isolate.trace.result.value}.`
		},
		{
			q: 'What is the fastest way to count the set bits in an integer?',
			a: 'Use the built-in: __builtin_popcount in GCC and Clang, std::popcount in C++20, Integer.bitCount in Java and int.bit_count in Python 3.10 and later. On a processor with a population count instruction these compile to it. Without one, the SWAR method counts any 32-bit value in a fixed handful of steps, and Kernighan’s loop is quickest when only a few bits are set. JavaScript has no built-in, so the SWAR version is the usual choice there.'
		},
		{
			q: 'Are bit hacks still faster than ordinary code?',
			a: 'Often not, because compilers already know them. GCC and Clang compile x % 8 on an unsigned int to an AND with 7, and recognise Kernighan’s counting loop and replace it with a single popcnt instruction when the target has one. Write the clear version first and reach for a trick when a measurement says it helps, or when the language gives no other way, such as packing flags into an integer.'
		},
		{
			q: 'Why does the branchless absolute value give a negative number for −128?',
			a: `Because +128 does not fit in 8 signed bits: the range is −128 to 127. C works out (x + m) ^ m in int, where it is 128, and stored back in an int8_t that is the bit pattern ${groupedBits(
				Number(absMin.result.value),
				8
			)}, which reads as ${valueText(
				Number(absMin.result.value),
				8,
				true
			)} again. At 32 bits there is no wider type to work in: for INT_MIN the x + m step overflows, which is undefined behaviour in C, as abs(INT_MIN) is.`
		}
	];

	const page = {
		title: 'Bit Manipulation Tricks: Bit Hacks Traced Bit by Bit',
		description:
			'The classic bit hacks, from x & (x - 1) to SWAR popcount and XOR swap, each traced bit by bit for your own value at 8, 16 or 32 bits, with why it works.',
		url: `${SITE}/bit-manipulation-tricks`,
		image: `${SITE}/og/bit-manipulation-tricks.png`,
		imageAlt: 'LogicGates.org: bit manipulation tricks traced bit by bit'
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
					{ '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
					{ '@type': 'ListItem', position: 3, name: 'Bit manipulation tricks' }
				]
			}
		]
	})}${'<'}/script>`;

	$: nMax = trick.n ? trick.n.max(w) : 0;
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
		{ href: '/binary-calculator', label: 'Binary calculator' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/gray-code-converter', label: 'Gray code converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/guess-my-number', label: 'Guess my number' },
		{ href: '/struct-padding-calculator', label: 'Struct padding calculator' },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Bit manipulation tricks</h1>
		<p class="lede">
			The classic bit hacks, each run on a value you choose and traced one row of bits at a time: every intermediate
			value, the operation that made it, and which bits changed. Pick a trick, type x in decimal, hex or binary, and
			read why it works.
		</p>

		<div class="card tool" id="tool">
			<div class="pick-row">
				<div class="pick">
					<label class="field" for="trick">Trick</label>
					<select id="trick" value={t} on:change={(e) => selectTrick(e.currentTarget.value)}>
						{#each byCategory as c}
							<optgroup label={c.name}>
								{#each c.tricks as tr}
									<option value={tr.id} selected={tr.id === t}>{tr.name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				<div class="step-btns">
					<!-- aria-disabled rather than disabled, so the button keeps focus at the end of the list. -->
					<button
						type="button"
						class="nav-btn"
						aria-disabled={index === 0 ? 'true' : 'false'}
						on:click={() => index > 0 && selectTrick(tricks[index - 1].id)}
						aria-label="Previous trick">‹ Prev</button
					>
					<button
						type="button"
						class="nav-btn"
						aria-disabled={index === tricks.length - 1 ? 'true' : 'false'}
						on:click={() => index < tricks.length - 1 && selectTrick(tricks[index + 1].id)}
						aria-label="Next trick">Next ›</button
					>
				</div>
			</div>

			<div class="width-row">
				<span class="field inline" id="width-label">Width</span>
				<div class="widths" role="group" aria-labelledby="width-label">
					{#each WIDTHS as wd}
						<button type="button" class:active={w === wd} aria-pressed={w === wd} on:click={() => (w = wd)}
							>{wd} bits</button
						>
					{/each}
				</div>
			</div>

			<div class="inputs">
				<div class="input-x">
					<label class="field" for="x-input">{trick.id === 'ascii-case-toggle' ? 'c (a character code)' : 'x'}</label>
					<input
						id="x-input"
						class="value-input"
						type="text"
						bind:value={x}
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
						aria-invalid={errorField === 'x' ? 'true' : 'false'}
						aria-describedby={errorField === 'x' ? 'input-error' : 'x-help'}
					/>
				</div>
				{#if trick.y}
					<div class="input-y">
						<label class="field" for="y-input">{trick.y}</label>
						<input
							id="y-input"
							class="value-input"
							type="text"
							bind:value={y}
							spellcheck="false"
							autocomplete="off"
							autocapitalize="off"
							aria-invalid={errorField === 'y' ? 'true' : 'false'}
							aria-describedby={errorField === 'y' ? 'input-error' : undefined}
						/>
					</div>
				{/if}
				{#if trick.n}
					<div class="input-n">
						<label class="field" for="n-input">{trick.n.label}</label>
						<input
							id="n-input"
							class="value-input"
							type="number"
							inputmode="numeric"
							min={trick.n.min}
							max={nMax}
							bind:value={n}
							aria-invalid={errorField === 'n' ? 'true' : 'false'}
							aria-describedby={errorField === 'n' ? 'input-error' : undefined}
						/>
					</div>
				{/if}
			</div>
			<!-- The error takes the help text's place, in the same grid cell, so the tool does not move as you type. -->
			<div class="message-slot">
				<p class="field-help" class:hidden={!!error} id="x-help">
					Decimal such as 88 or −42, hex such as 0x58, binary such as 0b0101_1000, or a character in quotes such as 'a'.
					Negative numbers are stored in two's complement.
				</p>
				{#if error}
					<p class="error" role="alert" id="input-error">{error}</p>
				{/if}
			</div>

			<div class="chips" aria-label="Examples">
				{#each trick.examples as e}
					<button type="button" class="chip-btn" on:click={() => tryExample(e)}>{e.label}</button>
				{/each}
			</div>

			<div class="trick-head">
				<h2 class="trick-name">{trick.name}</h2>
				<p class="trick-what">{trick.what}</p>
				<div class="code-row">
					<pre class="code" use:scrollFocus data-label="C code"><code>{trick.code(w)}</code></pre>
					<button type="button" class="copy" on:click={copyCode}>
						{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy C'}
					</button>
					<span class="visually-hidden" aria-live="polite"
						>{copyState === 'copied'
							? 'C code copied'
							: copyState === 'failed'
							? 'Copying failed: select the code instead'
							: ''}</span
					>
				</div>
				<p class="code-types">In this C, {typesNote(trick, w)}</p>
			</div>

			<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
				<Trace
					rows={trace.rows}
					w={inputs.w}
					signedView={!!trick.signedView}
					column={trick.n && trick.id !== 'sign-extension' ? inputs.n : null}
					label="Trace of {trick.name}"
				/>
				<p class="legend">
					Each row is one value, kept at {inputs.w} bits as if stored back in a variable of that width.
					{#if trace.rows.some((r) => r.base !== undefined)}
						<span class="key-chg" aria-hidden="true">1</span> Boxed, underlined bits differ from the row named under the
						step.
					{/if}
					1s are green and bold, 0s grey.
				</p>

				<div class="answer" role={error ? undefined : 'status'}>
					<span class="answer-label">Result</span>
					<span class="answer-value mono">{trace.answer ?? resultText(trace.result, inputs.w, !!trick.signedView)}</span
					>
					{#if answerDetail(trace, inputs.w)}
						<span class="answer-also mono">{answerDetail(trace, inputs.w)}</span>
					{/if}
					<span class="answer-summary">{trace.summary}</span>
				</div>
				{#if trace.warning}
					<p class="warn"><strong>Note:</strong> {trace.warning}</p>
				{/if}

				{#if trace.aside}
					<h3 class="aside-title">{trace.aside.title}</h3>
					{#if trace.aside.code}
						<pre class="code aside-code" use:scrollFocus data-label="The swap function"><code>{trace.aside.code}</code
							></pre>
					{/if}
					<p class="aside-text">{trace.aside.text}</p>
					<Trace rows={trace.aside.rows} w={inputs.w} signedView={!!trick.signedView} label={trace.aside.title} />
				{/if}

				<h3 class="aside-title">Why it works</h3>
				{#each trick.why as para}
					<p class="why">{para}</p>
				{/each}
				<p class="why-link"><a href="#{trick.id}">{trick.name} in the catalogue below</a></p>
			</div>
			<p class="share-row"><ShareLink what="this trick and its inputs" /></p>
		</div>
	</section>

	<section id="cheat-sheet">
		<h2>Bit hacks cheat sheet</h2>
		<p class="section-intro">
			Every trick on this page with its C expression and one worked 8-bit example. The examples are computed by the same
			code as the tracer above.
		</p>
		<div class="table-wrap">
			<!-- The roles are spelled out because the phone layout below sets display: block on the table, which makes
			     some browsers drop its table semantics. -->
			<!-- svelte-ignore a11y-no-redundant-roles -->
			<table class="data-table cheat" role="table">
				<!-- svelte-ignore a11y-no-redundant-roles -->
				<thead role="rowgroup">
					<!-- svelte-ignore a11y-no-redundant-roles -->
					<tr role="row">
						<th scope="col" role="columnheader">Trick</th>
						<th scope="col" role="columnheader">C</th>
						<th scope="col" role="columnheader">Example at 8 bits</th>
						<th scope="col" role="columnheader">Result</th>
					</tr>
				</thead>
				<!-- svelte-ignore a11y-no-redundant-roles -->
				<tbody role="rowgroup">
					{#each worked as wk}
						<!-- svelte-ignore a11y-no-redundant-roles -->
						<tr role="row">
							<th scope="row" role="rowheader"><a href="#{wk.trick.id}">{wk.trick.name}</a></th>
							<td class="mono code-cell" role="cell" data-label="C">{shortCode(wk.trick)}</td>
							<td class="mono ex-cell" role="cell" data-label="Example">{shortInput(wk)}</td>
							<td class="mono ex-cell" role="cell" data-label="Result">{outputText(wk)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	{#each byCategory as c}
		<section id="category-{c.id}">
			<h2>{c.name}</h2>
			{#each c.tricks as tr}
				{@const wk = workedById[tr.id]}
				<article class="card entry" id={tr.id}>
					<h3><a class="anchor" href="#{tr.id}">{tr.name}</a></h3>
					<pre class="code" use:scrollFocus data-label="{tr.name} in C"><code>{tr.code(8)}</code></pre>
					<p class="code-types">In this C, {typesNote(tr, 8)}</p>
					<p class="entry-what">{tr.what}</p>
					{#each tr.why as para}
						<p class="entry-why">{para}</p>
					{/each}
					<p class="entry-example">
						<span class="ex-label">Example at 8 bits:</span>
						<span class="mono">{inputText(wk)}</span> gives <strong class="mono">{outputText(wk)}</strong>.
						<a href="/bit-manipulation-tricks?t={tr.id}" on:click|preventDefault={() => openTrick(tr.id)}
							>Trace it bit by bit</a
						>
					</p>
				</article>
			{/each}
		</section>
	{/each}

	<section id="language-gotchas">
		<h2>Language gotchas</h2>
		<p class="section-intro">
			The tricks are written in C, where a value has a fixed width. Other languages differ in ways that break them
			quietly. Every result below was produced by running the line: the JavaScript ones are evaluated while this page is
			built, the others were compiled or run with GCC 13, Clang 18, Python 3.11 and OpenJDK 21.
		</p>
		<div class="gotchas">
			{#each gotchas as g}
				<article class="card gotcha" id={g.id}>
					<p class="lang">{g.lang}</p>
					<h3>{g.title}</h3>
					<pre class="code" use:scrollFocus data-label="{g.lang} example"><code>{g.code.join('\n')}</code></pre>
					<p>{g.text}</p>
				</article>
			{/each}
		</div>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Building masks from a signed 1.</strong> 1 &lt;&lt; 31 overflows a 32-bit int; write 1u &lt;&lt; n, or 1ull
				&lt;&lt; n for 64 bits.
			</li>
			<li>
				<strong>Forgetting zero.</strong> x &amp; (x − 1) is 0 for x = 0 too, which is why the
				<a href="#is-power-of-two">power of two test</a> checks x != 0, and
				<a href="#count-trailing-zeros">counting trailing zeros</a> of 0 needs a decision about the answer.
			</li>
			<li>
				<strong>Assuming a signed right shift.</strong> The <a href="#branchless-abs">branchless absolute value</a> needs
				an arithmetic shift, which C leaves to the compiler for negative values and Java and JavaScript spell >>.
			</li>
			<li>
				<strong>The most negative value.</strong> −128 at 8 bits, or INT_MIN at 32, has no positive partner, so its
				absolute value and its negation both come back unchanged. <a href="/twos-complement">Two's complement</a> shows why.
			</li>
			<li>
				<strong>Swapping a variable with itself.</strong> The <a href="#xor-swap">XOR swap</a> zeroes it.
			</li>
			<li>
				<strong>Using the modulo trick on a non-power or a negative number.</strong>
				<a href="#modulo-power-of-two">x &amp; (n − 1)</a> is x % n only for a power of two n and a non-negative x.
			</li>
		</ul>
		<p class="reducer">
			To check a result by hand, the <a href="/binary-calculator">binary calculator</a> does AND, OR, XOR and shifts at
			a fixed width, and the <a href="/hex-to-binary">hex to binary converter</a> turns a mask such as 0x33333333 into its
			bits.
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
		margin-bottom: 1rem;
		scroll-margin-top: 50px;
	}

	.pick-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.6rem 1rem;
		margin-bottom: 0.9rem;
	}

	/* Only as wide as the select, so Prev and Next sit right next to it. */
	.pick {
		flex: 0 1 26rem;
		min-width: 0;
	}

	.pick select {
		width: 100%;
		max-width: 26rem;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font-size: 1rem;
		padding: 0.5rem 0.5rem;
	}

	.step-btns {
		display: flex;
		gap: 4px;
	}

	.nav-btn,
	.widths button,
	.copy {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.85rem;
		padding: 0.45rem 0.8rem;
		cursor: pointer;
	}

	.nav-btn:hover:not([aria-disabled='true']),
	.widths button:hover,
	.copy:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.nav-btn[aria-disabled='true'] {
		color: #8a8a8a;
		cursor: default;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.width-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
		margin-bottom: 0.9rem;
	}

	.widths {
		display: inline-flex;
		gap: 4px;
	}

	.widths button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.field.inline {
		margin: 0;
	}

	.inputs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 0.8rem;
	}

	.input-x,
	.input-y {
		flex: 1 1 200px;
		min-width: 0;
	}

	.input-n {
		flex: 0 0 7rem;
	}

	.value-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.15rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.7rem;
	}

	.value-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.value-input[aria-invalid='true'] {
		border-color: #f66;
	}

	/* Help and error share one grid cell: the slot is as tall as the taller of
	   the two, so neither appearing moves the tool. */
	.message-slot {
		display: grid;
		margin: 0.45rem 0 0.7rem;
	}

	.message-slot > p {
		grid-area: 1 / 1;
		margin: 0;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
	}

	.field-help.hidden {
		visibility: hidden;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 1rem;
	}

	.chip-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font: 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.trick-head {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 0.9rem;
		margin-bottom: 0.9rem;
	}

	.trick-name {
		font-size: 1.25rem !important;
		margin: 0 0 0.2rem !important;
		color: #fff;
	}

	.trick-what {
		color: #bbb;
		margin: 0 0 0.6rem;
	}

	.code-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.code {
		margin: 0;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 0.5rem 0.75rem;
		overflow-x: auto;
		max-width: 100%;
		box-sizing: border-box;
		/* A scroll cue for long lines on a phone: a soft light edge shows on whichever side has more code.
		   The two covers scroll with the text (local) and hide the edges once you reach that end. */
		background: linear-gradient(to right, #0d0d0f 40%, rgba(13, 13, 15, 0)) left center / 2.5rem 100% no-repeat local,
			linear-gradient(to left, #0d0d0f 40%, rgba(13, 13, 15, 0)) right center / 2.5rem 100% no-repeat local,
			radial-gradient(farthest-side at 0 50%, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0)) left center / 0.9rem
				100% no-repeat scroll,
			radial-gradient(farthest-side at 100% 50%, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0)) right center /
				0.9rem 100% no-repeat scroll,
			#0d0d0f;
	}

	.code code {
		font: 0.92rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #e8e8e8;
	}

	.code-row .code {
		flex: 0 1 auto;
		min-width: 0;
	}

	.code-types {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0.35rem 0 0;
	}

	.aside-code {
		margin-bottom: 0.6rem;
	}

	.results.stale {
		opacity: 0.35;
		pointer-events: none;
	}

	.legend {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.9rem;
	}

	.key-chg {
		display: inline-block;
		width: 1.1em;
		text-align: center;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #8ede8e;
		font-weight: 700;
		border: 1px solid #e0c27a;
		border-bottom-width: 3px;
		border-radius: 2px;
		background: rgba(224, 194, 122, 0.12);
	}

	.answer {
		background: #0d0d0f;
		border: 1px solid rgba(93, 182, 93, 0.5);
		border-radius: 3px;
		padding: 0.6rem 0.8rem;
	}

	.answer-label {
		color: #999;
		display: block;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.5rem;
		overflow-wrap: anywhere;
	}

	.answer-also {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}

	.answer-summary {
		color: #ddd;
		display: block;
		font-size: 0.92rem;
		margin-top: 0.25rem;
	}

	.warn {
		border-left: 3px solid #e0c27a;
		padding: 0.4rem 0.7rem;
		margin: 0.7rem 0 0;
		background: rgba(224, 194, 122, 0.06);
		font-size: 0.9rem;
	}

	.warn strong {
		color: #e0c27a;
	}

	.aside-title {
		color: #fff;
		font-size: 1.05rem !important;
		margin: 1.3rem 0 0.4rem !important;
	}

	.aside-text,
	.why {
		font-size: 0.95rem;
		max-width: 720px;
		margin: 0 0 0.6rem;
	}

	.why-link {
		font-size: 0.85rem;
		color: #999;
		margin: 0;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.cheat th,
	.cheat td {
		vertical-align: top;
	}

	.code-cell {
		font-size: 0.85rem;
	}

	.ex-cell {
		font-size: 0.82rem;
	}

	/* On a phone each trick stacks: its name, the C, then the example and result,
	   each labelled, instead of a table wider than the screen. */
	@media (max-width: 640px) {
		.cheat thead {
			display: none;
		}

		.cheat,
		.cheat tbody,
		.cheat tr,
		.cheat th,
		.cheat td {
			display: block;
		}

		.cheat tr {
			padding: 0.5rem 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.12);
		}

		.cheat th,
		.cheat td {
			border: none !important;
			padding: 0.1rem 0.6rem !important;
		}

		.cheat td::before {
			content: attr(data-label) ': ';
			color: #999;
			font-family: system-ui, sans-serif;
		}
	}

	.entry {
		padding: 1rem 1.1rem;
		margin-bottom: 12px;
		scroll-margin-top: 50px;
	}

	.entry h3 {
		font-size: 1.1rem;
		margin-bottom: 0.6rem;
	}

	.anchor {
		color: #fff;
		text-decoration: none;
	}

	.anchor:hover {
		text-decoration: underline;
	}

	.entry-what {
		color: #fff;
		margin: 0.7rem 0 0.4rem;
	}

	.entry-why {
		margin: 0 0 0.5rem;
		max-width: 760px;
	}

	.entry-example {
		font-size: 0.92rem;
		margin: 0.6rem 0 0;
		overflow-wrap: anywhere;
	}

	.entry-example strong {
		color: #8ede8e;
	}

	.ex-label {
		color: #aaa;
	}

	.gotchas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
		gap: 12px;
	}

	.gotcha {
		padding: 0.9rem 1rem;
		min-width: 0;
		scroll-margin-top: 50px;
	}

	.gotcha h3 {
		margin-bottom: 0.6rem;
	}

	.gotcha p {
		font-size: 0.92rem;
		margin: 0.6rem 0 0;
	}

	.gotcha .lang {
		color: #8ede8e;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin: 0 0 0.2rem;
	}

	.points {
		color: #ddd;
		max-width: 720px;
		padding-left: 1.25rem;
	}

	.points li {
		margin-bottom: 0.6rem;
	}

	.points strong {
		color: #fff;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
