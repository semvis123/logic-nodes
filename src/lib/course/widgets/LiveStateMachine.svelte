<script lang="ts">
	// The 101 sequence detector to drive by hand: press 0 or 1, watch the
	// machine move round its state diagram, and see the output lamp come on the
	// cycle after the pattern completes. Every move comes from walking the
	// transition table in $lib/fsm, the same table the reference page is
	// generated from.
	import { fsms, walkTable, type FsmTransition } from '$lib/fsm';

	export let slug = 'moore-101';
	export let label = 'The 101 detector. Feed it bits one at a time and watch the state and the output.';

	const LIMIT = 24;
	const fsm = fsms.find((f) => f.slug === slug) ?? fsms[0];

	// The diagram: states in a row in the order they are listed, forward moves
	// as straight arrows along the row, moves back as curves underneath, and
	// a state that stays put as a small loop on top.
	const R = 26;
	const Y = 100;
	const STEP = 120;
	const X0 = 50;
	const W = X0 * 2 + STEP * (fsm.states.length - 1);
	const H = 216;
	const index = new Map(fsm.states.map((s, i) => [s.id, i]));
	const xOf = (id: string) => X0 + (index.get(id) ?? 0) * STEP;

	type Edge = { from: string; input: '0' | '1'; path: string; lx: number; ly: number; text: string };

	const edge = (t: FsmTransition): Edge => {
		const x1 = xOf(t.from);
		const x2 = xOf(t.to);
		const text = t.output === undefined ? t.input : `${t.input}/${t.output}`;
		const base = { from: t.from, input: t.input, text };
		if (t.from === t.to) {
			return {
				...base,
				path: `M ${x1 - 10} ${Y - R + 3} C ${x1 - 36} ${Y - R - 48}, ${x1 + 36} ${Y - R - 48}, ${x1 + 10} ${Y - R + 3}`,
				lx: x1,
				ly: Y - R - 31
			};
		}
		const distance = Math.abs((index.get(t.to) ?? 0) - (index.get(t.from) ?? 0));
		const mid = (x1 + x2) / 2;
		if (x2 > x1 && distance === 1) {
			return { ...base, path: `M ${x1 + R} ${Y} L ${x2 - R - 6} ${Y}`, lx: mid, ly: Y - 9 };
		}
		if (x2 > x1) {
			const depth = 30 * distance;
			return {
				...base,
				path: `M ${x1} ${Y - R} Q ${mid} ${Y - R - depth} ${x2} ${Y - R}`,
				lx: mid,
				ly: Y - R - depth / 2 - 6
			};
		}
		const depth = 34 * distance + 14 * (index.get(t.from) ?? 0);
		return {
			...base,
			path: `M ${x1} ${Y + R} Q ${mid} ${Y + R + depth} ${x2} ${Y + R}`,
			lx: mid,
			ly: Y + R + depth / 2 + 12
		};
	};
	const edges = fsm.transitions.map(edge);

	let history = '';

	$: steps = walkTable(fsm, history);
	$: last = steps[steps.length - 1];
	$: current = last ? last.next : fsm.states[0].id;
	$: state = fsm.states.find((s) => s.id === current) ?? fsm.states[0];
	// A Moore output belongs to the state; a Mealy output to the move just made.
	$: output = fsm.kind === 'moore' ? state.output === '1' : last?.output === '1';
	$: full = history.length >= LIMIT;

	const feed = (bit: '0' | '1') => {
		if (!full) history += bit;
	};
	const reset = () => {
		history = '';
	};
</script>

<div class="widget live-state-machine">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<span class="input-label">input x:</span>
		<button type="button" class="feed" on:click={() => feed('0')} disabled={full}>0</button>
		<button type="button" class="feed" on:click={() => feed('1')} disabled={full}>1</button>
		<button type="button" class="reset" on:click={reset} disabled={history.length === 0}>Reset</button>
		<span class="arrow" aria-hidden="true">→</span>
		<span class="out" class:on={output} aria-live="polite">z <span class="val">{output ? 1 : 0}</span></span>
	</div>
	<div class="diagram">
		<svg viewBox="0 0 {W} {H}" role="img" aria-label="State diagram of the {fsm.name}, currently in {current}">
			<defs>
				<marker id="lsm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
					<path d="M 0 0 L 10 5 L 0 10 z" fill="#949494" />
				</marker>
				<marker id="lsm-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
					<path d="M 0 0 L 10 5 L 0 10 z" fill="#5db65d" />
				</marker>
			</defs>
			{#each edges as e}
				{@const taken = last !== undefined && e.from === last.state && e.input === last.input}
				<path
					d={e.path}
					fill="none"
					stroke={taken ? '#5db65d' : '#949494'}
					stroke-width={taken ? 2.5 : 1.5}
					marker-end="url(#{taken ? 'lsm-arrow-on' : 'lsm-arrow'})"
				/>
				<rect
					x={e.lx - 4 - e.text.length * 3.5}
					y={e.ly - 10}
					width={8 + e.text.length * 7}
					height="14"
					rx="2"
					fill="#161618"
				/>
				<text x={e.lx} y={e.ly} text-anchor="middle" font-size="11" fill={taken ? '#8ede8e' : '#ccc'} class="mono">
					{e.text}
				</text>
			{/each}
			{#each fsm.states as s}
				{@const here = s.id === current}
				<circle
					cx={xOf(s.id)}
					cy={Y}
					r={R}
					fill={here ? '#372' : '#222'}
					stroke={here ? '#8ede8e' : 'rgba(255, 255, 255, 0.6)'}
					stroke-width={here ? 2 : 1}
				/>
				<text
					x={xOf(s.id)}
					y={s.output === undefined ? Y + 4 : Y - 2}
					text-anchor="middle"
					font-size="13"
					font-weight="600"
					fill="#fff"
				>
					{s.id}
				</text>
				{#if s.output !== undefined}
					<text x={xOf(s.id)} y={Y + 13} text-anchor="middle" font-size="10" fill="#ccc" class="mono">z={s.output}</text
					>
				{/if}
			{/each}
		</svg>
	</div>
	<p class="status" aria-live="polite">
		{#if last}
			In <strong>{last.state}</strong>, input {last.input}, so now in <strong>{current}</strong>: {state.meaning}.
		{:else}
			Starting in <strong>{current}</strong>: {state.meaning}.
		{/if}
	</p>
	<p class="history">
		Input so far: <span class="mono">{history || '(nothing yet)'}</span>
		{#if full}<span class="note">That is {LIMIT} bits. Press reset to start again.</span>{/if}
	</p>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.input-label {
		color: #bbb;
		font-size: 0.85rem;
	}

	.feed,
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

	.feed {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 600;
		min-width: 2.4rem;
		border-color: #5db65d;
		color: #8ede8e;
	}

	.feed:disabled,
	.reset:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.diagram {
		margin-top: 0.8rem;
		background: #1d1e20;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
	}

	.diagram svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.status,
	.history {
		margin: 0.6rem 0 0;
		color: #ddd;
		font-size: 0.95rem;
	}

	.note {
		color: #aaa;
		font-size: 0.85rem;
		margin-left: 0.5rem;
	}
</style>
