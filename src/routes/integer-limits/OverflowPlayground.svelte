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
		IntLimitsError,
		type IntSlug,
		type IntType,
		type Op,
		type OpResult
	} from '$lib/intLimits';
	import Bits from './Bits.svelte';

	export let type: IntSlug;
	export let value: string;
	export let op: Op;
	export let to: IntSlug;

	$: t = intTypeBySlug(type) as IntType;
	$: target = intTypeBySlug(to) as IntType;

	let result: OpResult | null = null;
	let error = '';
	// Runs at prerender too, so the served page shows a worked overflow.
	$: {
		try {
			const n = parseInteger(value);
			if (!fits(n, t)) {
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

	/** Carry the answer back into the input, to apply another step to it. */
	function keep() {
		if (!result) return;
		type = result.to.slug;
		value = result.result.toString();
	}

	const presets = (x: IntType) => [
		{ label: 'max', v: x.max },
		{ label: 'min', v: x.min },
		{ label: '0', v: 0n },
		...(x.signed ? [{ label: '−1', v: -1n }] : [{ label: 'max ÷ 2', v: x.max / 2n }])
	];
</script>

<div class="playground">
	<div class="controls">
		<div class="control">
			<label for="pg-type">Type</label>
			<select id="pg-type" bind:value={type}>
				{#each intTypes as x}
					<option value={x.slug}>{x.slug}</option>
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
				aria-describedby="pg-help"
			/>
		</div>
	</div>
	<p class="field-help" id="pg-help">
		Decimal, 0x hex or 0b binary, with a minus sign if negative. 2^31{'\u00a0'}-{'\u00a0'}1 works too.
	</p>
	<div class="chips" aria-label="Set the value">
		{#each presets(t) as preset}
			<button type="button" class="chip-btn" on:click={() => (value = preset.v.toString())}>
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
				on:click={() => (op = o.id)}>{o.label}</button
			>
		{/each}
		{#if op === 'cast'}
			<label class="visually-hidden" for="pg-to">Cast to type</label>
			<select id="pg-to" bind:value={to}>
				{#each intTypes as x}
					<option value={x.slug}>{x.slug}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if result}
		<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
			<div class="answer" role={error ? undefined : 'status'}>
				<span class="answer-label">
					{op === 'cast'
						? `${formatDecimal(result.value)} as ${result.to.slug}`
						: `${result.to.slug}: ${formatDecimal(result.value)} ${ops.find((o) => o.id === op)?.label}`}
				</span>
				<span class="answer-value mono" data-testid="pg-result">{formatDecimal(result.result)}</span>
				<span class="verdict" class:wrapped={result.wrapped}>
					{#if result.wrapped}
						{op === 'cast'
							? 'Value changed by the cast'
							: result.direction === 'over'
							? 'Overflow: wrapped past the maximum to the bottom of the range'
							: 'Underflow: wrapped past the minimum to the top of the range'}
					{:else}
						No overflow: the exact answer fits
					{/if}
				</span>
			</div>

			<div class="bit-rows">
				<div class="bit-row">
					<span class="row-label">Before <span class="mono">{hexOf(result.value, result.from.bits)}</span></span>
					<Bits
						bits={binaryOf(result.value, result.from.bits)}
						signed={result.from.signed}
						label="{result.from.bits} bits before: {binaryOf(result.value, result.from.bits)}"
					/>
				</div>
				<div class="bit-row">
					<span class="row-label">After <span class="mono">{hexOf(result.result, result.to.bits)}</span></span>
					<Bits
						bits={binaryOf(result.result, result.to.bits)}
						signed={result.to.signed}
						label="{result.to.bits} bits after: {binaryOf(result.result, result.to.bits)}"
					/>
				</div>
				{#if t.signed || result.to.signed}
					<p class="legend">The underlined bit is the sign bit: 1 means negative in a signed type.</p>
				{/if}
			</div>

			<ol class="steps">
				{#each result.steps as step}
					<li>{step}</li>
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

	.value-input:focus,
	select:focus {
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

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0 0 0.8rem;
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
		overflow-wrap: anywhere;
	}

	.answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.5rem;
		overflow-wrap: anywhere;
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
		overflow-wrap: anywhere;
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
		overflow-wrap: anywhere;
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
		overflow-wrap: anywhere;
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
