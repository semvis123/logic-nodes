<script lang="ts">
	import {
		calculate,
		ops,
		calcWidths,
		CalcError,
		MAX_DIGITS,
		type CalcRadix,
		type Calculation,
		type Op
	} from '$lib/arithmetic';
	import { groupDigits } from '$lib/radix';
	import { readUrl, syncUrl, safeText, safeOption } from '$lib/urlState';
	import ColumnWorking from '$lib/ColumnWorking.svelte';
	import ShareLink from '$lib/ShareLink.svelte';
	import { onMount } from 'svelte';

	/** The base the calculator works in. */
	export let radix: CalcRadix;
	/** The example shown before anything is typed, and prerendered. */
	export let defaults: { a: string; b: string; op: Op };
	/** Starting points, loaded by the chips. */
	export let examples: { label: string; a: string; b: string; op: Op; width?: number | null }[] = [];

	export let a = defaults.a;
	export let b = defaults.b;
	export let op: Op = defaults.op;
	export let width: number | null = null;

	const opIds = ops.map((o) => o.id);
	const widthIds = ['auto', ...calcWidths.map(String)];
	onMount(() => {
		const p = readUrl();
		a = safeText(p.a, MAX_DIGITS + 20) ?? a;
		b = safeText(p.b, MAX_DIGITS + 20) ?? b;
		op = safeOption(p.op, opIds) ?? op;
		const w = safeOption(p.bits, widthIds);
		if (w) width = w === 'auto' ? null : Number(w);
	});
	$: syncUrl({ a, b, op, bits: width ?? 'auto' }, { ...defaults, bits: 'auto' });

	const baseName = radix === 2 ? 'binary' : 'hex';
	$: spec = ops.find((o) => o.id === op)!;

	let calc: Calculation | null = null;
	let error = '';
	$: {
		try {
			calc = calculate(op, a, b, radix, width);
			error = '';
		} catch (e) {
			error = e instanceof CalcError ? e.message : 'Those numbers could not be read';
		}
	}

	/** Groups long binary into nibbles for reading; hex stays as it is. */
	const show = (text: string) => {
		if (radix !== 2) return text;
		const negative = text.startsWith('−');
		const body = negative ? text.slice(1) : text;
		return (negative ? '−' : '') + groupDigits(body, 4);
	};

	const decimal = (n: bigint) => n.toString().replace(/^-/, '−');

	/** The same sum in decimal, so the answer can be checked another way. */
	function check(c: Calculation): string {
		const s = ops.find((o) => o.id === c.op)!.symbol;
		if (c.op === 'not') return `NOT ${decimal(c.a)} = ${decimal(c.result)} in ${c.layout.columns} bits`;
		if (c.op === 'shl' && c.overflow)
			return `${decimal(c.a)} ${s} ${c.b} = ${decimal(c.a << c.b)}; ${c.width} bits keep ${decimal(c.result)}`;
		if (c.op === 'shl' || c.op === 'shr') return `${decimal(c.a)} ${s} ${c.b} = ${decimal(c.result)}`;
		if (c.op === 'div')
			return `${decimal(c.a)} ÷ ${decimal(c.b)} = ${decimal(c.result)} remainder ${decimal(c.remainder!)}`;
		// In a fixed width the true answer and the bits kept can differ; say both rather than a wrong sum.
		const exact = c.op === 'add' ? c.a + c.b : c.op === 'sub' ? c.a - c.b : c.op === 'mul' ? c.a * c.b : c.result;
		if (exact !== c.result) {
			return `${decimal(c.a)} ${s} ${decimal(c.b)} = ${decimal(exact)}; ${c.width} bits keep ${decimal(c.result)}`;
		}
		return `${decimal(c.a)} ${s} ${decimal(c.b)} = ${decimal(c.result)}`;
	}

	function load(example: typeof examples[number]) {
		a = example.a;
		b = example.b;
		op = example.op;
		if (example.width !== undefined) width = example.width;
	}

	/**
	 * A shift reads its second box as a count of places in decimal, so a number
	 * left there from a sum (11011 is eleven thousand places) is replaced by 1.
	 */
	function setOp(next: Op) {
		const shiftNext = !!ops.find((o) => o.id === next)?.shift;
		if (shiftNext && !spec.shift) b = '1';
		op = next;
	}

	function setWidth(event: Event) {
		const v = (event.target as HTMLSelectElement).value;
		width = v === 'auto' ? null : Number(v);
	}

	/** Long explanations fold away so the answer stays in view. */
	const FOLD = 10;
</script>

<div class="card tool">
	<div class="op-row" role="group" aria-label="Operation">
		{#each ops as o}
			<button
				type="button"
				class="op-btn"
				class:active={op === o.id}
				aria-pressed={op === o.id}
				title={o.label}
				on:click={() => setOp(o.id)}
				><span class="op-symbol">{o.symbol}</span>{#if o.symbol !== o.label}<span class="op-label">{o.label}</span
					>{/if}</button
			>
		{/each}
	</div>

	<div class="fields">
		<div class="field-group">
			<label class="field" for="calc-a">{spec.unary || spec.shift ? 'Number' : 'First number'} ({baseName})</label>
			<input
				id="calc-a"
				class="num-input"
				type="text"
				bind:value={a}
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				aria-invalid={error ? 'true' : 'false'}
				aria-describedby={error ? 'calc-error' : undefined}
			/>
		</div>
		{#if !spec.unary}
			<div class="op-between" aria-hidden="true">{spec.symbol}</div>
			<div class="field-group">
				<label class="field" for="calc-b"
					>{spec.shift ? 'Places to shift (decimal)' : `Second number (${baseName})`}</label
				>
				<input
					id="calc-b"
					class="num-input"
					type="text"
					bind:value={b}
					spellcheck="false"
					autocomplete="off"
					autocapitalize="off"
					inputmode={spec.shift ? 'numeric' : 'text'}
				/>
			</div>
		{/if}
		<div class="field-group narrow">
			<label class="field" for="calc-width">Width</label>
			<select id="calc-width" value={width === null ? 'auto' : String(width)} on:change={setWidth}>
				<option value="auto">Unlimited</option>
				{#each calcWidths as w}
					<option value={String(w)}>{w} bits</option>
				{/each}
			</select>
		</div>
	</div>

	{#if error}
		<p class="error" id="calc-error" role="alert">{error}</p>
	{/if}

	{#if examples.length}
		<div class="chips">
			{#each examples as example}
				<button type="button" class="chip-btn" on:click={() => load(example)}>{example.label}</button>
			{/each}
		</div>
	{/if}

	{#if calc}
		<div class="results" class:stale={!!error} aria-hidden={error ? 'true' : 'false'}>
			<div class="answer" role={error ? undefined : 'status'}>
				<span class="answer-label">{calc.op === 'div' ? 'Quotient' : 'Answer'}</span>
				<span class="answer-value mono">{show(calc.resultText)}</span>
				{#if calc.op === 'div'}
					<span class="answer-label rem">Remainder</span>
					<span class="answer-value mono">{show(calc.remainder?.toString(radix).toUpperCase() ?? '0')}</span>
				{/if}
				<span class="answer-check">In decimal: {check(calc)}</span>
			</div>

			{#if calc.overflow}
				<p class="warning">
					Overflow: the answer does not fit in {calc.width} bits, so the bits that do not fit are dropped, shown struck through
					below.
				</p>
			{/if}
			{#if calc.result < 0n}
				<p class="note">
					The answer is negative, written with a minus sign. Inside a computer a negative number is stored as its
					<a href="/twos-complement">two's complement</a>; pick a width to see that pattern.
				</p>
			{/if}
			{#if calc.wrappedNegative}
				{#if calc.signedResult === calc.a - calc.b}
					<p class="note">
						The answer is negative. With a fixed width the subtraction wraps round, and the bits shown are the
						<a href="/twos-complement">two's complement</a> of {decimal(calc.a - calc.b)}.
					</p>
				{:else}
					<p class="warning">
						Signed overflow: the true answer, {decimal(calc.a - calc.b)}, is below the smallest number {calc.width}
						signed bits can hold, so the wrapped bits are not its <a href="/twos-complement">two's complement</a>.
					</p>
				{/if}
			{/if}
			{#each calc.notes.filter((n) => !n.startsWith('Quotient')) as note}
				<p class="note">{note}</p>
			{/each}

			<h2 class="working-title">Working</h2>
			{#if calc.layoutTitle}
				<p class="layout-title">{calc.layoutTitle}</p>
			{/if}
			{#if calc.division}
				<div class="table-wrap div-wrap">
					<table class="data-table div-table">
						<thead>
							<tr>
								<th scope="col">Bring down</th>
								<th scope="col">Now</th>
								<th scope="col">Goes in</th>
								<th scope="col">Take away</th>
								<th scope="col">Left</th>
							</tr>
						</thead>
						<tbody>
							{#each calc.division as step}
								<tr class:zero-step={step.digit === 0}>
									<td class="mono">{step.brought}</td>
									<td class="mono">{step.current.toString(radix).toUpperCase()}</td>
									<td class="mono strong">{step.digit.toString(radix).toUpperCase()}</td>
									<td class="mono">{step.product.toString(radix).toUpperCase()}</td>
									<td class="mono">{step.remainder.toString(radix).toUpperCase()}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="layout-title">
					The "goes in" column, read from top to bottom, is the quotient; the last "left" is the remainder.
				</p>
			{:else}
				<ColumnWorking layout={calc.layout} label="Working, column by column" />
				{#if calc.layout.rows.some((r) => r.kind === 'carry' || r.kind === 'borrow')}
					<p class="legend">
						{#if calc.op === 'add'}<span class="key carry">1</span> carried into the column below it{:else}<span
								class="key borrow">1</span
							> lent by the column below it to the column on its right{/if}
					</p>
				{/if}
			{/if}

			{#if calc.explanation.length > FOLD}
				<ol class="explain">
					{#each calc.explanation.slice(0, 4) as line}<li>{line}</li>{/each}
				</ol>
				<details class="more-steps">
					<summary>All {calc.explanation.length} steps</summary>
					<ol class="explain" start={5}>
						{#each calc.explanation.slice(4) as line}<li>{line}</li>{/each}
					</ol>
				</details>
			{:else}
				<ol class="explain" class:single={calc.explanation.length === 1}>
					{#each calc.explanation as line}<li>{line}</li>{/each}
				</ol>
			{/if}
		</div>
	{/if}

	<p class="share-row"><ShareLink what="this calculation" /></p>
</div>

<style>
	.tool {
		padding: 1.1rem 1.2rem 1.3rem;
		margin-bottom: 1rem;
	}

	.op-row {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-bottom: 0.9rem;
	}

	.op-btn {
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #ddd;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.3rem 0.65rem;
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
	}

	.op-symbol {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 700;
	}

	.op-label {
		font-size: 0.78rem;
	}

	.op-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.op-btn.active {
		background-color: #372;
		border-color: #5db65d;
		color: #fff;
	}

	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}

	.field-group {
		flex: 1 1 11rem;
		min-width: 0;
	}

	.field-group.narrow {
		flex: 0 1 9rem;
	}

	.op-between {
		font: 700 1.2rem ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #bbb;
		padding-bottom: 0.55rem;
	}

	.field {
		display: block;
		font-size: 0.85rem;
		color: #ddd;
		margin-bottom: 0.35rem;
	}

	.num-input,
	select {
		width: 100%;
		box-sizing: border-box;
		background-color: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		color: #fff;
		font: 1.05rem ui-monospace, SFMono-Regular, Menlo, monospace;
		padding: 0.55rem 0.6rem;
	}

	.num-input:focus,
	select:focus {
		outline: none;
		border-color: #5db65d;
	}

	.num-input[aria-invalid='true'] {
		border-color: #f66;
	}

	.error {
		color: #f66;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 0.9rem;
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

	.chip-btn:hover {
		border-color: #5db65d;
		color: #fff;
	}

	.results {
		border-top: 1px solid rgba(255, 255, 255, 0.12);
		margin-top: 1rem;
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
		margin-bottom: 0.8rem;
	}

	.answer-label {
		color: #999;
		display: block;
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.answer-label.rem {
		margin-top: 0.4rem;
	}

	.answer-value {
		color: #8ede8e;
		display: block;
		font-size: 1.5rem;
		overflow-wrap: anywhere;
	}

	.answer-check {
		color: #bbb;
		display: block;
		font-size: 0.85rem;
		margin-top: 0.3rem;
		overflow-wrap: anywhere;
	}

	.warning {
		color: #e0b050;
		font-size: 0.88rem;
	}

	.note {
		color: #ccc;
		font-size: 0.88rem;
	}

	.working-title {
		color: #fff;
		font-size: 1.15rem;
		margin-top: 1rem !important;
	}

	.layout-title {
		color: #bbb;
		font-size: 0.85rem;
		margin: 0 0 0.5rem;
	}

	.legend {
		color: #aaa;
		font-size: 0.8rem;
		margin: 0.4rem 0 0;
	}

	.key {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 700;
		margin-right: 0.3rem;
	}

	.key.carry {
		color: #f0c060;
	}

	.key.borrow {
		color: #ff9a9a;
	}

	.explain {
		color: #ddd;
		font-size: 0.9rem;
		padding-left: 1.4rem;
		margin: 0.8rem 0 0;
		overflow-wrap: anywhere;
	}

	.explain.single {
		list-style: none;
		padding-left: 0;
	}

	.explain li {
		margin-bottom: 0.25rem;
	}

	.more-steps {
		margin-top: 0.3rem;
	}

	.more-steps summary {
		cursor: pointer;
		color: #8ede8e;
		font-size: 0.88rem;
	}

	.div-wrap {
		max-height: 420px;
		overflow: auto;
	}

	.div-table td,
	.div-table th {
		white-space: nowrap;
	}

	.div-table td.strong {
		color: #8ede8e;
		font-weight: 700;
	}

	.div-table tr.zero-step td {
		color: #999;
	}

	.share-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	@media (max-width: 560px) {
		.op-between {
			display: none;
		}

		.field-group {
			flex-basis: 100%;
		}

		.field-group.narrow {
			flex: 1 1 100%;
		}
	}
</style>
