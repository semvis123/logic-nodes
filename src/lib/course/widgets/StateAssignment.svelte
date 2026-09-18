<script lang="ts">
	// The design procedure as something to step through: the state table with
	// names, then with codes, then as a truth table, then the equations one at
	// a time. The equations are the ones the Karnaugh map engine derives from
	// the transition table in $lib/fsm, renamed to Q1 and Q0 for reading.
	import { fsms, stateLabels } from '$lib/fsm';
	import { namedEquations } from '$lib/course/fsmText';

	export let slug = 'moore-101';
	export let label = 'From a state table to equations, one step at a time.';

	const fsm = fsms.find((f) => f.slug === slug) ?? fsms[0];
	const labels = stateLabels(fsm);
	const width = labels.length;
	const equations = namedEquations(fsm);

	const byId = new Map(fsm.states.map((s) => [s.id, s]));
	const rows = fsm.transitions.map((t) => {
		const from = byId.get(t.from) ?? fsm.states[0];
		const to = byId.get(t.to) ?? fsm.states[0];
		const output = (fsm.kind === 'moore' ? from.output : t.output) ?? '0';
		return { from, input: t.input, to, output };
	});
	const used = new Set(fsm.states.map((s) => s.code));
	const unused = Array.from({ length: 1 << width }, (_, i) => i.toString(2).padStart(width, '0')).filter(
		(code) => !used.has(code)
	);

	const steps = [
		'Step 1: the state table. One row for each present state and each input value, giving the next state and the output.',
		`Step 2: assign codes. ${width} bits are enough for ${
			fsm.states.length
		} states, so each state gets a pattern of ${labels.join(' ')}.`,
		`Step 3: rewrite the table with the codes. Each row is now a row of a truth table: ${labels.join(', ')} and ${
			fsm.input
		} in, the next-state bits ${labels.map((l) => 'd' + l.slice(1)).join(', ')} and z out.`,
		...equations.map(
			(e, i) =>
				`Step ${4 + i}: put the ${e.name} column on a Karnaugh map and simplify. ${
					e.name === 'z' ? 'That is the output logic.' : `That is the D input of the flip-flop holding ${labels[i]}.`
				}`
		)
	];

	let step = 0;
	$: shownEquations = Math.max(0, step - 2);
	$: withCodes = step >= 1;
	$: asBits = step >= 2;
	$: done = step >= steps.length - 1;

	const next = () => {
		if (!done) step += 1;
	};
	const restart = () => {
		step = 0;
	};
</script>

<div class="widget state-assignment">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="next" on:click={next} disabled={done}>Next step</button>
		<button type="button" class="reset" on:click={restart} disabled={step === 0}>Start again</button>
		<span class="where">{step + 1} of {steps.length}</span>
	</div>
	<p class="step" aria-live="polite">{steps[step]}</p>
	<div class="table-wrap">
		<table class="data-table state-table">
			<thead>
				<tr>
					{#if asBits}
						{#each labels as l}<th scope="col" class="mono">{l}</th>{/each}
					{:else}
						<th scope="col">Present state</th>
					{/if}
					<th scope="col" class="mono">{fsm.input}</th>
					{#if asBits}
						{#each labels as l}<th scope="col" class="mono">d{l.slice(1)}</th>{/each}
					{:else}
						<th scope="col">Next state</th>
					{/if}
					<th scope="col" class="mono">z</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row}
					<tr>
						{#if asBits}
							{#each row.from.code.split('') as bit}
								<td class={bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
							{/each}
						{:else}
							<td>
								{row.from.id}
								{#if withCodes}<span class="mono code">{row.from.code}</span>{/if}
								<span class="meaning">{row.from.meaning}</span>
							</td>
						{/if}
						<td class={row.input === '1' ? 'bit-1' : 'bit-0'}>{row.input}</td>
						{#if asBits}
							{#each row.to.code.split('') as bit}
								<td class={bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
							{/each}
						{:else}
							<td
								>{row.to.id}
								{#if withCodes}<span class="mono code">{row.to.code}</span>{/if}</td
							>
						{/if}
						<td class={row.output === '1' ? 'bit-1' : 'bit-0'}>{row.output}</td>
					</tr>
				{/each}
				{#if asBits}
					{#each unused as code}
						{#each ['0', '1'] as input}
							<tr class="unused">
								{#each code.split('') as bit}
									<td class={bit === '1' ? 'bit-1' : 'bit-0'}>{bit}</td>
								{/each}
								<td class={input === '1' ? 'bit-1' : 'bit-0'}>{input}</td>
								{#each labels as _}<td class="mono">x</td>{/each}
								<td class="mono">x</td>
							</tr>
						{/each}
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
	{#if unused.length && asBits}
		<p class="note">
			The rows marked x are codes no state uses. They are don't cares: the Karnaugh map may treat each as 0 or 1,
			whichever gives the simpler equation.
		</p>
	{/if}
	{#if shownEquations > 0}
		<dl class="equations" aria-live="polite">
			{#each equations.slice(0, shownEquations) as e}
				<div class="equation">
					<dt class="mono">{e.name}</dt>
					<dd class="mono">= {e.text}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.next,
	.reset {
		background-color: #222;
		border: 1px solid #fff;
		border-radius: 3px;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}

	.next {
		border-color: #5db65d;
		color: #8ede8e;
	}

	.next:disabled,
	.reset:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.where {
		color: #aaa;
		font-size: 0.85rem;
	}

	.step {
		margin: 0.8rem 0 0.6rem;
		color: #ddd;
		font-size: 0.95rem;
	}

	.code {
		color: #8ede8e;
		margin-left: 0.3rem;
	}

	.meaning {
		display: block;
		color: #999;
		font-size: 0.8rem;
	}

	.unused td {
		color: #999;
	}

	.note {
		margin: 0.6rem 0 0;
		color: #aaa;
		font-size: 0.85rem;
	}

	.equations {
		margin: 0.8rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.equation {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		background-color: #222;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 3px;
		padding: 0.4rem 0.7rem;
	}

	.equation dt {
		color: #8ede8e;
		font-weight: 600;
	}

	.equation dd {
		margin: 0;
		color: #fff;
	}
</style>
