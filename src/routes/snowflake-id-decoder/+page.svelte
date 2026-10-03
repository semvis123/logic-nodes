<script lang="ts">
	import { SITE } from '$lib/site';
	import ContentPage from '$lib/ContentPage.svelte';
	import IdBits from '$lib/IdBits.svelte';
	import { modifiedFields } from '$lib/lastmod';
	import {
		decodeSnowflake,
		snowflakeRange,
		snowflakeLastMoment,
		parseMoment,
		describeAge,
		IdError,
		SNOWFLAKE_EPOCHS,
		type DecodedId,
		type SnowflakeService
	} from '$lib/ids';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	const services = ['discord', 'twitter'] as const;
	const DISCORD_EXAMPLE = '175928847299117063';
	const DEFAULTS = { id: DISCORD_EXAMPLE, s: 'discord', t: '2016-04-30T11:18:25.796Z' };

	let input = DEFAULTS.id;
	let service: SnowflakeService = 'discord';
	let moment = DEFAULTS.t;
	/** Set on mount, so the local time and the age are the reader's, never the build server's. */
	let now: number | null = null;

	onMount(() => {
		const p = readUrl();
		input = safeText(p.id, 40) ?? input;
		service = safeOption(p.s, services) ?? service;
		moment = safeText(p.t, 40) ?? moment;
		now = Date.now();
		// Rewrites the address at once, so a value the page rejected (an unknown
		// service, an overlong ID) is not left in the link that Copy link shares.
		syncUrl({ id: input, s: service, t: moment }, DEFAULTS);
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(tick);
			clearTimeout(alertTimer);
		};
	});
	$: syncUrl({ id: input, s: service, t: moment }, DEFAULTS);

	// Runs during prerendering too, so the served page shows a decoded snowflake.
	let decoded: DecodedId | null = null;
	let error = '';
	$: {
		try {
			decoded = decodeSnowflake(input, service);
			error = '';
		} catch (e) {
			error = e instanceof IdError ? e.message : 'That could not be read as a snowflake';
		}
	}
	$: epoch = SNOWFLAKE_EPOCHS[service];
	// The timestamp field, as the engine read it: for Twitter that leaves the sign bit out.
	$: shifted = decoded?.time ? decoded.time.raw : 0n;
	$: signDropped = service === 'twitter' && !!decoded && decoded.value >> 63n === 1n;
	$: localTime =
		decoded?.time && now !== null
			? new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(decoded.time.unixMs)
			: '';
	$: age = decoded?.time && now !== null ? describeAge(decoded.time.unixMs, now) : '';

	// The other direction: a moment to the snowflakes that share it.
	let range: { min: bigint; max: bigint } | null = null;
	let momentMs = 0;
	let rangeError = '';
	$: {
		try {
			const ms = parseMoment(moment);
			range = snowflakeRange(ms, service);
			// Only now, so a stale range keeps the label of the time it belongs to.
			momentMs = ms;
			rangeError = '';
		} catch (e) {
			rangeError = e instanceof IdError ? e.message : 'That time could not be read';
		}
	}

	// The visible errors update on every keystroke, but the alert a screen reader
	// announces waits for a pause in typing, so a half typed ID is not read out
	// as an error after every digit.
	let alertText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	$: scheduleAlert(error || rangeError);
	function scheduleAlert(message: string) {
		clearTimeout(alertTimer);
		if (!message) alertText = '';
		else alertTimer = setTimeout(() => (alertText = message), 500);
	}

	/** Lets a keyboard user focus a box that scrolls, so it can be scrolled, and only while it does. */
	function scrollFocus(node: HTMLElement) {
		const update = () => {
			if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) {
				node.tabIndex = 0;
				node.setAttribute('role', 'region');
				node.setAttribute('aria-label', node.dataset.label ?? 'Scrolling box');
			} else {
				node.removeAttribute('tabindex');
				node.removeAttribute('role');
				node.removeAttribute('aria-label');
			}
		};
		// Re-checked when the box resizes and when what is in it changes.
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

	function setNow() {
		moment = new Date().toISOString();
	}

	function tryId(value: string, s: SnowflakeService) {
		service = s;
		input = value;
		const field = document.getElementById('sf-id');
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		field?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
		field?.focus({ preventScroll: true });
	}

	let copied = '';
	let copyFailed = false;
	let copyTimer: ReturnType<typeof setTimeout>;
	async function copy(what: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			copyFailed = false;
		} catch {
			copied = '';
			copyFailed = true;
		}
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => ((copied = ''), (copyFailed = false)), 2500);
	}

	// ------------------------------------------------------------ examples and tables, from the engine

	const twitterExample = (snowflakeRange(Date.UTC(2023, 0, 1, 12), 'twitter').min | (371n << 12n) | 42n).toString();
	const examples: { label: string; value: string; s: SnowflakeService }[] = [
		{ label: "Discord's docs example", value: DISCORD_EXAMPLE, s: 'discord' },
		{ label: 'Discord, 1 ms after the epoch', value: snowflakeRange(1420070400001).min.toString(), s: 'discord' },
		{ label: 'Twitter/X, 2023', value: twitterExample, s: 'twitter' },
		{ label: 'Largest 64-bit value', value: '18446744073709551615', s: 'discord' }
	];

	const docs = decodeSnowflake(DISCORD_EXAMPLE, 'discord');
	const docsShifted = docs.value >> 22n;
	const layouts = services.map((s) => {
		const d = decodeSnowflake(0n, s);
		return {
			name: SNOWFLAKE_EPOCHS[s].name,
			epoch: SNOWFLAKE_EPOCHS[s].iso,
			epochMs: SNOWFLAKE_EPOCHS[s].ms,
			fields: d.fields.map((f) => `${f.name} (${f.length})`),
			last: snowflakeLastMoment(s)
		};
	});
	const years = Array.from({ length: 13 }, (_, i) => 2015 + i).map((year) => ({
		year,
		min: snowflakeRange(Date.UTC(year, 0, 1), 'discord').min
	}));
	const lostDigits = String(Number(DISCORD_EXAMPLE));

	const faqs = [
		{
			q: 'How do I get the date from a Discord ID?',
			a: `Shift the ID right by 22 bits, which is the same as dividing by 4,194,304 and dropping the remainder, then add Discord's epoch, ${
				SNOWFLAKE_EPOCHS.discord.ms
			}. The result is milliseconds since 1970. For ${DISCORD_EXAMPLE} that is ${docsShifted} + ${
				SNOWFLAKE_EPOCHS.discord.ms
			} = ${docsShifted + SNOWFLAKE_EPOCHS.discord.ms}, which is ${docs.time?.iso}.`
		},
		{
			q: 'What is the Discord epoch?',
			a: `${SNOWFLAKE_EPOCHS.discord.iso}, the first moment of 2015, which is ${
				SNOWFLAKE_EPOCHS.discord.ms
			} in Unix milliseconds. Discord IDs count from there rather than from 1970 so that the 42 timestamp bits last longer: until ${snowflakeLastMoment(
				'discord'
			)}.`
		},
		{
			q: 'Why are snowflake IDs sent as strings?',
			a: `JavaScript numbers only hold whole numbers exactly up to 2^53, and snowflakes go past that. Read as a number, ${DISCORD_EXAMPLE} becomes ${lostDigits}, a different ID. Discord's and Twitter's APIs send them as strings so nothing is lost; use BigInt to do arithmetic on them.`
		},
		{
			q: 'How do I find Discord messages from a particular date?',
			a: "Turn the date into a snowflake and use it as the before or after value in Discord's API, which accepts any snowflake there, not only real message IDs. The date to snowflake box on this page gives the smallest and largest snowflake for a moment."
		},
		{
			q: 'Can two snowflakes be the same?',
			a: "Two different objects should not get the same one: each worker and process has its own ID bits, and the increment goes up for every ID that process makes. Discord's documentation notes one exception on purpose: some child objects share their parent's ID, such as a server's @everyone role, which has the server's ID. In Twitter's original design the 12-bit sequence starts again from 0 each millisecond, so one machine can make 4,096 IDs per millisecond."
		},
		{
			q: 'Is a Twitter/X ID decoded the same way?',
			a: `The same shift by 22, but with Twitter's epoch, ${SNOWFLAKE_EPOCHS.twitter.ms} (${SNOWFLAKE_EPOCHS.twitter.iso}). The 10 bits below the time are a machine ID rather than Discord's worker and process, and the top bit is kept 0 so the ID is positive as a signed 64-bit number. Tweets from before late 2010 have older, sequential IDs that hold no time.`
		}
	];

	const page = {
		title: 'Snowflake ID Decoder: Discord and Twitter/X ID to Date',
		description:
			'Decode a Discord or Twitter/X snowflake ID to the exact time it was made, with worker, process and sequence bits, or turn a date into its snowflake range.',
		url: `${SITE}/snowflake-id-decoder`,
		image: `${SITE}/og/snowflake-id-decoder.png`,
		imageAlt: 'LogicGates.org: snowflake ID decoder showing the timestamp and worker bits'
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
					{ '@type': 'ListItem', position: 3, name: 'Snowflake ID decoder' }
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
		{ href: '/uuid-decoder', label: 'UUID decoder and generator' },
		{ href: '/integer-limits', label: 'Integer limits' },
		{ href: '/binary-converter', label: 'Binary converter' },
		{ href: '/hex-to-binary', label: 'Hex to binary converter' },
		{ href: '/twos-complement', label: "Two's complement" },
		{ href: '/tools', label: 'All tools' }
	]}
>
	<section class="intro">
		<h1>Snowflake ID decoder</h1>
		<p class="lede">
			Paste a Discord or Twitter/X ID to see the moment it was made, to the millisecond, and the worker and sequence
			bits beside it. Or type a date to get the range of snowflakes from that moment.
		</p>

		<div class="card tool">
			<div class="direction" role="group" aria-label="Service">
				{#each services as s}
					<button type="button" class:active={service === s} aria-pressed={service === s} on:click={() => (service = s)}
						>{SNOWFLAKE_EPOCHS[s].name}</button
					>
				{/each}
			</div>

			<label class="field" for="sf-id">Snowflake ID</label>
			<input
				id="sf-id"
				class="value-input"
				type="text"
				inputmode="numeric"
				bind:value={input}
				spellcheck="false"
				autocomplete="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="sf-help{error ? ' sf-error' : ''}"
			/>
			{#if error}
				<p class="error" id="sf-error">{error}</p>
			{/if}
			<p class="field-help" id="sf-help">
				A user, message, server or channel ID: in Discord, turn on Developer Mode and choose Copy ID. Up to 20 digits.
			</p>
			<div class="chips">
				{#each examples as example}
					<button type="button" class="chip-btn" on:click={() => tryId(example.value, example.s)}
						>{example.label}</button
					>
				{/each}
			</div>

			{#if decoded && decoded.time}
				<div class="results" class:stale={!!error} inert={error ? true : undefined}>
					<div class="answer">
						<!-- The age below ticks every second, so only the time itself is live. -->
						<div role={error ? undefined : 'status'}>
							<span class="answer-label">Made at, UTC</span>
							<span class="answer-value mono">{decoded.time.iso}</span>
						</div>
						<dl class="times">
							<dt>Your time</dt>
							<dd>{localTime || '…'}</dd>
							<dt>Age</dt>
							<dd>{age || '…'}</dd>
							<dt>Unix ms</dt>
							<dd class="mono">{decoded.time.unixMs}</dd>
						</dl>
					</div>

					<h2 class="working-title">Working: shift right by 22, add the epoch</h2>
					<div class="table-wrap scroll-box equation-box" use:scrollFocus data-label="Working">
						<p class="equation mono">
							{decoded.canonical} &gt;&gt; 22{#if signDropped}, without the sign bit,{/if} = {shifted}<br />
							{shifted} + {epoch.ms} = {decoded.time.unixMs}<br />
							= {decoded.time.iso}
						</p>
					</div>
					<p class="note">
						Shifting right by 22 drops the low 22 bits, leaving the milliseconds since the {epoch.name} epoch,
						<span class="nowrap">{epoch.iso}</span>. Adding the epoch gives Unix milliseconds.
					</p>

					<h2 class="working-title">The bits</h2>
					<IdBits fields={decoded.fields} bits={64} base="dec" numbering="bottom" label="Bit layout of the snowflake" />
					{#each decoded.notes as note}
						<p class="note">{note}</p>
					{/each}
				</div>
			{/if}
			<p class="share-row"><ShareLink what="this ID, the service and the date" /></p>
		</div>
		{#if alertText}
			<p class="visually-hidden" role="alert">{alertText}</p>
		{/if}
	</section>

	<section id="date-to-snowflake">
		<h2>Date to snowflake</h2>
		<div class="card tool">
			<label class="field" for="sf-time">Date and time, UTC unless you add an offset</label>
			<div class="time-row">
				<input
					id="sf-time"
					class="value-input"
					type="text"
					bind:value={moment}
					spellcheck="false"
					autocomplete="off"
					aria-invalid={rangeError ? 'true' : 'false'}
					aria-describedby="sf-time-help{rangeError ? ' sf-time-error' : ''}"
				/>
				<button type="button" class="action" on:click={setNow}>Now</button>
			</div>
			{#if rangeError}
				<p class="error" id="sf-time-error">{rangeError}</p>
			{/if}
			<p class="field-help" id="sf-time-help">
				For example 2024-03-01, 2024-03-01 18:30 or 2024-03-01T18:30:00+01:00. Uses the {epoch.name} layout chosen above.
			</p>
			{#if range}
				<div class="results" class:stale={!!rangeError} inert={rangeError ? true : undefined}>
					<div class="answer" role={rangeError ? undefined : 'status'}>
						<span class="answer-label">Snowflakes made at {new Date(momentMs).toISOString()}</span>
						<div class="range-row">
							<span class="range-label">First</span>
							<span class="mono range-value">{range.min}</span>
							<button type="button" class="mini" on:click={() => range && copy('first', range.min.toString())}
								>{copied === 'first' ? 'Copied' : 'Copy'}<span class="visually-hidden"> first snowflake</span></button
							>
						</div>
						<div class="range-row">
							<span class="range-label">Last</span>
							<span class="mono range-value">{range.max}</span>
							<button type="button" class="mini" on:click={() => range && copy('last', range.max.toString())}
								>{copied === 'last' ? 'Copied' : 'Copy'}<span class="visually-hidden"> last snowflake</span></button
							>
						</div>
						<span class="copy-status" aria-live="polite"
							>{copied
								? `Copied the ${copied} snowflake.`
								: copyFailed
								? 'Copying was blocked: select the number and press ctrl+C.'
								: ''}</span
						>
					</div>
					<p class="note">
						Every {epoch.name} ID made in that millisecond lies between these two: the time in the top bits, and the low
						22 bits all 0 for the first and all 1 for the last.
						{#if service === 'discord'}
							Use the first as an <span class="mono">after</span> value or the last as a
							<span class="mono">before</span> value to page through messages by time.
						{/if}
					</p>
				</div>
			{/if}
		</div>
	</section>

	<section id="how-it-works">
		<h2>How a snowflake ID works</h2>
		<p>
			A snowflake is a 64-bit number that a server can make on its own, without asking a central database for the next
			number, and that still sorts in time order. Twitter designed it in 2010, and Discord uses the same idea. The top
			bits are the milliseconds since the service's epoch; below them are bits that say which machine made the ID, and a
			counter for IDs made by that machine in the same millisecond.
		</p>
		<p>
			Because the time is in the top bits, a bigger ID is always a later one (to the millisecond), so sorting IDs sorts
			by age. The same Discord example, worked through:
		</p>
		<div class="table-wrap scroll-box equation-box" use:scrollFocus data-label="The Discord example, worked through">
			<p class="equation mono">
				{DISCORD_EXAMPLE} &gt;&gt; 22 = {docsShifted}<br />
				{docsShifted} + {SNOWFLAKE_EPOCHS.discord.ms} = {docsShifted + SNOWFLAKE_EPOCHS.discord.ms}<br />
				= {docs.time?.iso}
			</p>
		</div>
		<p class="section-intro">The same sum in code. BigInt keeps all 64 bits; a plain number would not.</p>
		<pre class="code" use:scrollFocus data-label="The same sum in JavaScript and Python"><code
				>{`// JavaScript
const snowflake = '${DISCORD_EXAMPLE}';
const ms = Number(BigInt(snowflake) >> 22n) + ${SNOWFLAKE_EPOCHS.discord.ms};
new Date(ms).toISOString();

# Python
from datetime import datetime, timezone
snowflake = ${DISCORD_EXAMPLE}
datetime.fromtimestamp(((snowflake >> 22) + ${SNOWFLAKE_EPOCHS.discord.ms}) / 1000, tz=timezone.utc)`}</code
			></pre>

		<div class="table-wrap" use:scrollFocus data-label="Discord and Twitter/X layouts">
			<table class="data-table">
				<caption>Discord and Twitter/X layouts</caption>
				<thead>
					<tr>
						<th scope="col">Service</th>
						<th scope="col">Epoch</th>
						<th scope="col">Fields, top bits first (width)</th>
						<th scope="col">Runs out</th>
					</tr>
				</thead>
				<tbody>
					{#each layouts as l}
						<tr>
							<th scope="row">{l.name}</th>
							<td class="nowrap"><span class="mono">{l.epoch}</span><br /><span class="dim mono">{l.epochMs}</span></td>
							<td>{l.fields.join(', ')}</td>
							<td class="mono nowrap">{l.last.slice(0, 10)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="by-year">
		<h2>Discord snowflakes by year</h2>
		<p class="section-intro">
			The first possible Discord ID of each year. Any ID smaller than a year's value was made before that year began, so
			you can date an ID roughly at a glance.
		</p>
		<div class="table-wrap" use:scrollFocus data-label="Discord snowflakes by year">
			<table class="data-table years">
				<thead>
					<tr>
						<th scope="col">From</th>
						<th scope="col" class="num">First snowflake</th>
					</tr>
				</thead>
				<tbody>
					{#each years as y}
						<tr>
							<td class="mono">{y.year}-01-01</td>
							<td class="mono num">{y.min}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section id="mistakes">
		<h2>Common mistakes</h2>
		<ul class="points">
			<li>
				<strong>Parsing the ID as a number.</strong> In JavaScript,
				<span class="mono">Number("{DISCORD_EXAMPLE}")</span>
				gives {lostDigits}. The last digits are gone because the value is past 2<sup>53</sup>, the limit of exact
				integers in a double; the <a href="/integer-limits">integer limits</a> page lists where each type runs out. Keep
				IDs as strings and use BigInt for arithmetic.
			</li>
			<li>
				<strong>Using the wrong epoch.</strong> A Discord ID read from the Unix epoch lands in the 1970s or 1980s, and one
				read with Twitter's epoch comes out about four years too early. Switch the service above to see the difference.
			</li>
			<li>
				<strong>Dividing instead of shifting in a language with floats.</strong> id / 4194304 in floating point rounds; shift
				right by 22 on a 64-bit integer, or divide with integer division.
			</li>
		</ul>
		<p class="reducer">
			To see an ID as the 64 bits it is, paste it into the <a href="/binary-converter">binary converter</a>. Snowflakes
			are one of several IDs with a time inside; UUID version 7, ULIDs and MongoDB ObjectIds are decoded by the
			<a href="/uuid-decoder">UUID decoder</a>.
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
	}

	.direction {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 0.9rem;
	}

	.direction button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		font-size: 0.9rem;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}

	.direction button.active {
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

	.value-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.6rem 0.7rem;
	}

	.value-input:focus {
		outline: none;
		border-color: #5db65d;
	}

	.value-input[aria-invalid='true'] {
		border-color: #f66;
	}

	.field-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.45rem 0 0.7rem;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
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
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}

	.chip-btn:hover,
	.mini:hover,
	.action:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.results {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		padding-top: 1rem;
	}

	.results.stale {
		opacity: 0.35;
		pointer-events: none;
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

	.answer .answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.35rem;
		overflow-wrap: anywhere;
	}

	.times {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.15rem 0.8rem;
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
	}

	.times dt {
		color: #999;
	}

	.times dd {
		color: #eee;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.working-title {
		color: #fff;
		font-size: 1.1rem;
		margin-top: 1.1rem !important;
	}

	/* Each line of a sum stays whole; on a phone the box scrolls instead. */
	.equation-box {
		margin: 0.5rem 0 0;
	}

	.equation {
		color: #ddd;
		font-size: 0.92rem;
		margin: 0;
		white-space: nowrap;
	}

	.note {
		color: #ccc;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
		overflow-wrap: anywhere;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.time-row {
		display: flex;
		gap: 0.5rem;
	}

	.mini,
	.action {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		white-space: nowrap;
	}

	/* The same size and look as the site's Copy link button. */
	.mini {
		font-size: 0.8rem;
		line-height: 1.2;
		min-width: 4.6rem;
		padding: 0.3rem 0.7rem;
	}

	.action {
		font-size: 0.9rem;
		padding: 0.35rem 0.9rem;
	}

	.range-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.3rem 0.7rem;
		margin-top: 0.35rem;
	}

	.range-label {
		color: #999;
		font-size: 0.85rem;
		width: 2.6rem;
	}

	.range-row .range-value {
		color: #8ede8e;
		font-size: 1.1rem;
		overflow-wrap: anywhere;
	}

	.copy-status {
		color: #8ede8e;
		display: block;
		font-size: 0.8rem;
		min-height: 1.2em;
		margin-top: 0.3rem;
	}

	.code {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		color: #ddd;
		font: 0.85rem ui-monospace, SFMono-Regular, Menlo, monospace;
		overflow-x: auto;
		padding: 0.7rem 0.9rem;
		margin: 0 0 1.2rem;
	}

	.data-table caption {
		text-align: left;
		color: #bbb;
		font-size: 0.85rem;
		padding-bottom: 0.4rem;
	}

	.data-table th[scope='row'] {
		color: #eee;
		font-weight: 400;
		text-align: left;
		white-space: nowrap;
	}

	.nowrap {
		white-space: nowrap;
	}

	#how-it-works .section-intro {
		margin-top: 1rem;
	}

	.dim {
		color: #999;
		font-size: 0.8rem;
	}

	.num {
		text-align: right !important;
	}

	.years {
		width: auto;
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

	@media (max-width: 560px) {
		.answer .answer-value {
			font-size: 1.05rem;
		}

		.range-row .range-value {
			font-size: 0.95rem;
		}

		#sf-time {
			font-size: 0.9rem;
		}
	}
</style>
