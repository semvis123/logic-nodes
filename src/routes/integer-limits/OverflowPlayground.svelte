<script lang="ts">
	// Pick a type and a value, apply one operation, and watch the bits wrap.
	// The page that holds this owns the URL state, so these are bound props.
	import {
		intTypes,
		intTypeBySlug,
		ops,
		applyOp,
		parseInteger,
		fits,
		formatDecimal,
		binaryOf,
		hexOf,
		lookup,
		IntLimitsError,
		type IntSlug,
		type IntType,
		type Op,
		type OpResult
	} from '$lib/intLimits';
	import Bits from './Bits.svelte';
	import CopyButton from './CopyButton.svelte';
	import { breakable } from './breakable';
	import { onDestroy } from 'svelte';

	export let type: IntSlug;
	export let value: string;
	export let op: Op;
	export let to: IntSlug;

	$: t = intTypeBySlug(type) as IntType;
	$: target = intTypeBySlug(to) as IntType;

	let result: OpResult | null = null;
	let error = '';
	/** When the value parses but is too big for the type: the nearest type that holds it. */
	let roomier: IntType | null = null;
	// Runs at prerender too, so the served page shows a worked overflow.
	$: {
		roomier = null;
		try {
			const n = parseInteger(value);
			if (!fits(n, t)) {
				const l = lookup(n);
				roomier = (t.signed || n < 0n ? l.smallestSigned : l.smallestUnsigned) ?? null;
				throw new IntLimitsError(
					`${formatDecimal(n)} does not fit in ${t.slug}, which holds ${formatDecimal(t.min)} to ${formatDecimal(
						t.max
					)}. Pick a wider type, or try casting from one.`
				);
			}
			result = applyOp(t, n, op, target);
			error = '';
		} catch (e) {
			error = e instanceof IntLimitsError ? e.message : 'That is not a whole number';
		}
	}

	// Screen readers hear the error or the answer once the reader pauses, not on
	// every keystroke of a half-typed value; the page itself updates at once.
	// Nothing is announced until the reader changes something here (`touched`),
	// so loading the page or a link stays quiet.
	let touched = false;
	let alertText = '';
	let statusText = '';
	let alertTimer: ReturnType<typeof setTimeout>;
	$: announce(error, result, op, touched);
	function announce(message: string, r: OpResult | null, o: Op, live: boolean) {
		clearTimeout(alertTimer);
		if (!live) return;
		if (!message) alertText = '';
		alertTimer = setTimeout(() => {
			alertText = message;
			statusText = message || !r ? '' : `${heading(r, o)} = ${formatDecimal(r.result)}. ${verdict(r, o)}.`;
		}, 500);
	}
	onDestroy(() => clearTimeout(alertTimer));

	/** What was done, such as "int8: 127 +1" or "200 as int8". */
	const heading = (r: OpResult, o: Op) =>
		o === 'cast'
			? `${formatDecimal(r.value)} as ${r.to.slug}`
			: `${r.to.slug}: ${formatDecimal(r.value)} ${ops.find((x) => x.id === o)?.label}`;
	const verdict = (r: OpResult, o: Op) =>
		r.wrapped
			? o === 'cast'
				? 'Value changed by the cast'
				: r.direction === 'over'
				? 'Overflow: wrapped past the maximum to the bottom of the range'
				: 'Underflow: wrapped past the minimum to the top of the range'
			: 'No overflow: the exact answer fits';

	/** Carry the answer back into the input, to apply another step to it. */
	function keep() {
		if (!result || error) return;
		type = result.to.slug;
		value = result.result.toString();
	}

	/** Takes a stale result out of the tab order and the accessibility tree while an error shows. */
	function inertWhen(node: HTMLElement, on: boolean) {
		node.toggleAttribute('inert', on);
		return { update: (v: boolean) => node.toggleAttribute('inert', v) };
	}

	// An operation shown as a symbol (+1, −1, ×2) also carries its name, so
	// "−1 (subtract one)" is told apart from the value chip −1.
	const symbolic = (label: string) => !/[a-z]/.test(label);

	const presets = (x: IntType) => [
		{ label: 'max', v: x.max },
		{ label: 'min', v: x.min },
		{ label: '0', v: 0n },
		...(x.signed ? [{ label: '−1', v: -1n }] : [{ label: 'max ÷ 2', v: x.max / 2n }])
	];

	// For an arithmetic wrap, the exact answer one bit wider than the type, in
	// two's complement: its low bits are what is kept, its top bit is dropped.
	// Every operation here (±1, ×2, negate) needs at most one extra bit.
	$: showExact = !!result && result.wrapped && op !== 'cast';
	$: exactBits = result && showExact ? binaryOf(result.exact, result.to.bits + 1) : '';
	$: cast = result?.castKind;
	$: droppedBits = result && cast === 'truncate' ? result.from.bits - result.to.bits : 0;
	$: addedBits = result && (cast === 'sign-extend' || cast === 'zero-extend') ? result.to.bits - result.from.bits : 0;
</script>

<!-- Any change made here, by typing, picking or pressing, turns on the announcements. -->
<div class="playground" on:input={() => (touched = true)} on:change={() => (touched = true)}>
	<div class="controls">
		<div class="control">
			<label for="pg-type">Type</label>
			<select id="pg-type" bind:value={type}>
				{#each intTypes as x}
					<option value={x.slug} selected={x.slug === type}>{x.slug}</option>
				{/each}
			</select>
		</div>
		<div class="control grow">
			<label for="pg-value">Value</label>
			<input
				id="pg-value"
				class="value-input"
				type="text"
				bind:value
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby="pg-help{error ? ' pg-error' : ''}"
			/>
		</div>
	</div>
	<p class="field-help" id="pg-help">
		Decimal, 0x hex or 0b binary, with a minus sign if negative. <span class="nowrap">2^31 − 1</span> works too.
	</p>
	<div class="chips" role="group" aria-label="Set the value">
		{#each presets(t) as preset}
			<button type="button" class="chip-btn" on:click={() => ((touched = true), (value = preset.v.toString()))}>
				{preset.label}
			</button>
		{/each}
	</div>

	<div class="ops" role="group" aria-label="Operation">
		{#each ops as o}
			<button
				type="button"
				data-op={o.id}
				class:active={op === o.id}
				aria-pressed={op === o.id}
				on:click={() => ((touched = true), (op = o.id))}
				>{o.label}{#if symbolic(o.label)}<span class="visually-hidden">({o.name})</span>{/if}</button
			>
		{/each}
		{#if op === 'cast'}
			<label class="visually-hidden" for="pg-to">Cast to type</label>
			<select id="pg-to" bind:value={to}>
				{#each intTypes as x}
					<option value={x.slug} selected={x.slug === to}>{x.slug}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if error}
		<div class="error-row">
			<p class="error" id="pg-error">{error}</p>
			{#if roomier}
				<button
					type="button"
					class="chip-btn"
					data-testid="pg-widen"
					on:click={() => ((touched = true), roomier && (type = roomier.slug))}>Use {roomier.slug}</button
				>
			{/if}
		</div>
	{/if}

	{#if alertText}
		<p class="visually-hidden" role="alert">{alertText}</p>
	{/if}
	<p class="visually-hidden" role="status">{statusText}</p>

	{#if result}
		<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'} use:inertWhen={!!error}>
			<div class="answer">
				<span class="answer-label">{heading(result, op)}</span>
				<span class="answer-line">
					<span class="answer-value mono" data-testid="pg-result">{@html breakable(formatDecimal(result.result))}</span>
					<CopyButton text={result.result.toString()} label="result" />
				</span>
				<span class="verdict" class:wrapped={result.wrapped}>{verdict(result, op)}</span>
			</div>

			<div class="bit-rows">
				<div class="bit-row">
					<span class="row-label"
						>Before <span class="mono">{hexOf(result.value, result.from.bits)}</span>{droppedBits
							? `: the top ${droppedBits} bits are dropped`
							: ''}</span
					>
					<Bits
						bits={binaryOf(result.value, result.from.bits)}
						signed={result.from.signed}
						gutter={showExact}
						dropped={droppedBits}
						label="{result.from.bits} bits before: {binaryOf(result.value, result.from.bits)}"
					/>
				</div>
				{#if showExact}
					<div class="bit-row">
						<span class="row-label"
							>Exact answer <span class="mono">{formatDecimal(result.exact)}</span> written in {result.to.bits + 1} bits{result.exact <
							0n
								? ' of two’s complement'
								: ''}: the leftmost bit does not fit and is dropped</span
						>
						<Bits
							bits={exactBits.slice(1)}
							gutter
							carry={exactBits[0]}
							label="Exact answer in {result.to.bits +
								1} bits: {exactBits}. The leftmost bit, {exactBits[0]}, is dropped."
						/>
					</div>
				{/if}
				<div class="bit-row">
					<span class="row-label"
						>After <span class="mono">{hexOf(result.result, result.to.bits)}</span>{addedBits
							? `: ${addedBits} new bits, copies of ${cast === 'sign-extend' ? 'the sign bit' : '0'}`
							: ''}</span
					>
					<Bits
						bits={binaryOf(result.result, result.to.bits)}
						signed={result.to.signed}
						gutter={showExact}
						added={addedBits}
						label="{result.to.bits} bits after: {binaryOf(result.result, result.to.bits)}"
					/>
				</div>
				<p class="legend">
					{#if t.signed || result.to.signed}The solid underlined bit is the sign bit: 1 means negative in a signed type.{/if}
					{#if showExact || droppedBits}Struck-through bits are dropped.{/if}
					{#if addedBits}Bits with a dotted underline are new.{/if}
				</p>
			</div>

			<ol class="steps">
				{#each result.steps as step}
					<li>{@html breakable(step)}</li>
				{/each}
			</ol>
			<button type="button" class="keep" data-testid="pg-keep" on:click={keep}>
				Use {formatDecimal(result.result)} as the new value
			</button>
		</div>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 0.9rem;
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.control.grow {
		flex: 1 1 14rem;
		min-width: 0;
	}

	label {
		color: #ddd;
		font-size: 0.85rem;
	}

	select {
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.5rem;
	}

	.value-input {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.7rem;
	}

	/* The selects keep the site's focus ring from ContentPage. */
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
		margin: 0.45rem 0 0.6rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 0.9rem;
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

	.ops {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-bottom: 0.9rem;
	}

	.ops button {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font: 0.95rem ui-monospace, SFMono-Regular, Menlo, monospace;
		min-width: 2.8rem;
		padding: 0.4rem 0.7rem;
	}

	.ops button.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.ops select {
		font-size: 0.9rem;
		padding: 0.35rem 0.4rem;
	}

	.error-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.8rem;
		margin: 0 0 0.8rem;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0;
	}

	.nowrap {
		white-space: nowrap;
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
		color: #aaa;
		display: block;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		overflow-wrap: break-word;
	}

	.answer-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.7rem;
	}

	.answer-value {
		color: #8ede8e;
		font-size: 1.5rem;
		min-width: 0;
	}

	.verdict {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.2rem;
	}

	.verdict.wrapped {
		color: #e9c46a;
	}

	.bit-rows {
		margin: 1rem 0 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.bit-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.row-label {
		color: #bbb;
		font-size: 0.8rem;
		overflow-wrap: break-word;
	}

	.legend {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0;
	}

	.steps {
		color: #ddd;
		font-size: 0.92rem;
		margin: 0.8rem 0;
		padding-left: 1.3rem;
		overflow-wrap: break-word;
	}

	.steps li {
		margin-bottom: 0.3rem;
	}

	.keep {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font-size: 0.85rem;
		max-width: 100%;
		overflow-wrap: break-word;
		padding: 0.35rem 0.75rem;
		text-align: left;
	}

	.keep:hover {
		border-color: #5db65d;
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
