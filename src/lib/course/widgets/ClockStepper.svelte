<script lang="ts">
	// A clock the reader advances by hand, half a cycle at a time, drawing a
	// growing timing diagram with every rising edge marked. A second trace shows
	// what a rising edge detector would output: one short pulse per rising edge
	// and nothing else. The diagram is built from the list of levels, so the
	// edge count and the pulses cannot disagree with the picture.
	import { onDestroy } from 'svelte';

	export let label = 'A clock you advance by hand. Each click is half a cycle.';

	type Level = 0 | 1;
	/** One entry per half cycle, oldest first. The clock starts low. */
	let levels: Level[] = [0];
	let running = false;
	let timer: ReturnType<typeof setInterval> | undefined;

	const SHOWN = 16; // half cycles that fit in the picture
	const HALF = 30; // width of one half cycle
	const LEFT = 52; // room for the trace names
	const HIGH = 14;
	const LOW = 40;
	const PULSE_TOP = 72;
	const PULSE_BOTTOM = 98;
	const PULSE_WIDTH = 8;

	$: rising = levels.filter((level, i) => i > 0 && level === 1 && levels[i - 1] === 0).length;
	$: falling = levels.filter((level, i) => i > 0 && level === 0 && levels[i - 1] === 1).length;
	$: level = levels[levels.length - 1];
	$: start = Math.max(0, levels.length - SHOWN);
	$: shown = levels.slice(start);
	$: width = LEFT + SHOWN * HALF + 12;

	// The clock trace as a path: a horizontal run per half cycle, and a vertical
	// step wherever the level changes.
	$: clockPath = shown
		.map((lvl, i) => {
			const x = LEFT + i * HALF;
			const y = lvl === 1 ? HIGH : LOW;
			const step = i > 0 && shown[i - 1] !== lvl ? `V${y} ` : '';
			return (i === 0 ? `M${x} ${y} ` : step) + `H${x + HALF} `;
		})
		.join('');

	$: edgesShown = shown
		.map((lvl, i) => (i > 0 && lvl === 1 && shown[i - 1] === 0 ? LEFT + i * HALF : -1))
		.filter((x) => x >= 0);

	// The detector's output: high for a moment after each rising edge.
	$: pulsePath = (() => {
		let d = `M${LEFT} ${PULSE_BOTTOM} `;
		for (const x of edgesShown) {
			d += `H${x} V${PULSE_TOP} H${x + PULSE_WIDTH} V${PULSE_BOTTOM} `;
		}
		return d + `H${LEFT + shown.length * HALF}`;
	})();

	function advance() {
		levels = [...levels, level === 1 ? 0 : 1];
	}

	function clear() {
		stop();
		levels = [0];
	}

	function run() {
		running = true;
		timer = setInterval(advance, 500);
	}

	function stop() {
		running = false;
		if (timer) clearInterval(timer);
		timer = undefined;
	}

	onDestroy(stop);
</script>

<div class="widget clock-stepper">
	<p class="widget-title">{label}</p>
	<div class="controls">
		<button type="button" class="toggle advance" on:click={advance}>Advance half a cycle ▸</button>
		{#if running}
			<button type="button" class="mode on" aria-pressed="true" on:click={stop}>Stop</button>
		{:else}
			<button type="button" class="mode" aria-pressed="false" on:click={run}>Run on its own</button>
		{/if}
		<button type="button" class="mode" on:click={clear}>Clear</button>
	</div>

	<div class="scroll">
		<svg
			viewBox="0 0 {width} 118"
			{width}
			height="118"
			role="img"
			aria-label="A clock trace with {rising} rising edges, and a pulse under each one"
		>
			<text
				x={LEFT - 8}
				y="31"
				text-anchor="end"
				fill="#fff"
				font-size="12"
				font-family="ui-monospace, Menlo, monospace">CLK</text
			>
			<text
				x={LEFT - 8}
				y="89"
				text-anchor="end"
				fill="#fff"
				font-size="12"
				font-family="ui-monospace, Menlo, monospace">pulse</text
			>
			{#each edgesShown as x}
				<line x1={x} y1="6" x2={x} y2="104" stroke="#888" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
				<text x={x + 3} y="8" fill="#e2b93b" font-size="9" font-family="ui-monospace, Menlo, monospace">↑</text>
			{/each}
			<path d={clockPath} fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
			<path d={pulsePath} fill="none" stroke="#5db65d" stroke-width="2" stroke-linejoin="round" />
			{#if shown.length >= SHOWN}
				<text x={LEFT} y="114" fill="#888" font-size="9" font-family="Helvetica, Arial, sans-serif"
					>older half cycles have scrolled off the left</text
				>
			{/if}
		</svg>
	</div>

	<p class="reading" aria-live="polite">
		The clock is <span class="mono">{level}</span>. So far it has had <strong>{rising}</strong>
		rising {rising === 1 ? 'edge' : 'edges'} and <strong>{falling}</strong> falling {falling === 1 ? 'edge' : 'edges'},
		which is {Math.floor((levels.length - 1) / 2)} whole {Math.floor((levels.length - 1) / 2) === 1
			? 'period'
			: 'periods'}. The detector has pulsed {rising}
		{rising === 1 ? 'time' : 'times'}.
	</p>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.mode {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 3px;
		color: #ddd;
		font: inherit;
		font-size: 0.8rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}

	.mode.on {
		border-color: #e2b93b;
		color: #e2b93b;
	}

	.scroll {
		overflow-x: auto;
		margin: 0.8rem 0 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		background: #1d1e20;
	}

	.scroll svg {
		display: block;
	}

	.reading {
		color: #ddd;
		font-size: 0.9rem;
		margin: 0.4rem 0 0;
	}
</style>
