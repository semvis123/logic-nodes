<script lang="ts">
	// A simplification revealed one law at a time. The derivation comes from
	// the step engine behind the calculator, so every line is a real rewrite
	// with the law that made it named and linked.
	import { parseExpression, format } from '$lib/boolean';
	import { simplifySteps } from '$lib/steps';
	import { lawSlug } from '$lib/laws';

	export let expression: string;
	export let label = '';

	const ast = parseExpression(expression);
	const start = format(ast, 'math');
	const working = simplifySteps(ast);
	const total = working.steps.length;
	const shown = label || `Simplify ${start}, one law at a time.`;

	let revealed = 0;
	$: finished = revealed >= total;
</script>

<div class="widget step-by-step">
	<p class="widget-title">{shown}</p>
	<div class="controls">
		<button
			type="button"
			class="step-btn"
			on:click={() => (revealed = Math.min(total, revealed + 1))}
			disabled={finished}
		>
			{total === 0 ? 'No law applies' : finished ? 'All steps shown' : revealed === 0 ? 'First step' : 'Next step'}
		</button>
		<button type="button" class="step-btn quiet" on:click={() => (revealed = total)} disabled={finished}
			>Show all</button
		>
		<button type="button" class="step-btn quiet" on:click={() => (revealed = 0)} disabled={revealed === 0}>
			Start again
		</button>
		<span class="count" aria-live="polite">{revealed} of {total} step{total === 1 ? '' : 's'}</span>
	</div>
	<ol class="steps" aria-live="polite">
		<li>
			<span class="law start">Start</span>
			<span class="mono text">{start}</span>
		</li>
		{#each working.steps.slice(0, revealed) as step}
			<li>
				<a class="law" href="/boolean-algebra-laws#{lawSlug(step.law)}">{step.law}</a>
				<span class="mono text">{step.text}</span>
				<span class="detail">{step.detail}</span>
			</li>
		{/each}
	</ol>
	{#if finished}
		<p class="result">
			{#if total === 0}
				No law applies to this expression, so it stays as it is.
			{:else if working.isMinimal}
				No law applies any more. The result is <span class="mono">{working.text}</span>, and the calculator's minimiser
				reaches the same form.
			{:else}
				No law applies any more. The laws reached <span class="mono">{working.text}</span>; the minimiser finds
				<span class="mono">{working.minimalText}</span>.
			{/if}
		</p>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.step-btn {
		background-color: #372;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
	}

	.step-btn.quiet {
		background-color: #161618;
		border-color: rgba(255, 255, 255, 0.5);
	}

	.step-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.count {
		color: #bbb;
		font-size: 0.85rem;
	}

	.steps {
		margin: 0.8rem 0 0;
		padding-left: 1.4rem;
	}

	.steps li {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		gap: 0.15rem 0.9rem;
		align-items: baseline;
		margin-bottom: 0.45rem;
	}

	.law {
		font-size: 0.8rem;
		color: #8ede8e;
		text-decoration: none;
		border: 1px solid rgba(141, 222, 142, 0.35);
		border-radius: 3px;
		padding: 0.1rem 0.4rem;
		text-align: center;
	}

	.law.start {
		color: #999;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.text {
		color: #fff;
	}

	.detail {
		grid-column: 2;
		color: #999;
		font-size: 0.82rem;
	}

	.result {
		color: #bbb;
		font-size: 0.9rem;
		margin: 0.8rem 0 0;
	}

	.result .mono {
		color: #8ede8e;
	}

	@media (max-width: 600px) {
		.steps li {
			grid-template-columns: 1fr;
		}

		.detail {
			grid-column: 1;
		}
	}
</style>
