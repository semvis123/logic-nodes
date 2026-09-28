<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { simplify } from '$lib/boolean';
	import { levels, LEVER_NAMES } from './levels';
	import {
		cellIndex,
		defaultPart,
		emptyCells,
		leversOf,
		partCount,
		simulate,
		type Cells,
		type Levers,
		type Part,
		type PartKind,
		type Run
	} from './engine';
	import {
		CELL,
		LEVER_SLOT,
		PAD,
		RADIUS,
		TOP,
		boardSize,
		cellCenter,
		landingPoint,
		leverPosition,
		pointAt,
		segmentAt,
		timeline,
		totalMs,
		trailPath,
		type Segment
	} from './geometry';
	import PartArt from './Part.svelte';

	// --- state ---------------------------------------------------------------

	type Progress = { solved: Record<number, number>; boards: Record<number, Cells> };
	const STORAGE_KEY = 'logicgates-marble-machine:v1';

	let progress: Progress = { solved: {}, boards: {} };
	let levelIndex = 0;
	let cells: Cells = emptyCells(levels[0].setup);
	let levers: Levers = [false];
	let selected: number | null = null;
	let tool: PartKind | null = null;

	/** How each setting of the levers went in the last test, or null before a test. */
	let results: (boolean | null)[] | null = null;
	let running = false;
	let marble: { x: number; y: number } | null = null;
	let trail = '';
	let landedCup = false;
	let bumps: Record<number, number> = {};
	let message = '';
	let reduced = false;
	/** True once the page has hydrated, so a test (or a very quick tap) knows the handlers are attached. */
	let ready = false;
	/** Temporary while the rope styles are compared: 'always', 'demand' or 'circuit'. */
	let ropeMode: 'always' | 'demand' | 'circuit' = 'always';
	/** The lever whose ropes are lit in 'demand' mode. */
	let activeLever: number | null = null;

	// Every run has a number. Starting a new one, or editing the board, changes it,
	// which tells the run in progress to stop wherever it is.
	let runId = 0;

	$: level = levels[levelIndex];
	$: setup = level.setup;
	$: size = boardSize(setup);
	$: settings = Array.from({ length: 1 << level.levers }, (_, i) => i);
	$: currentSetting = levers.reduce((n, down) => (n << 1) | (down ? 1 : 0), 0);
	$: parts = partCount(cells);
	$: best = progress.solved[level.id];
	$: passed = results !== null && results.every((r) => r === true);
	$: selectedPart = selected !== null ? cells[selected] : null;
	$: ropes = buildRopes(cells, levers, ropeMode);
	$: summary = describe(cells, levers);
	$: start = cellCenter(setup.start, 0);

	function isUnlocked(index: number, done: Progress) {
		return index === 0 || done.solved[levels[index - 1].id] !== undefined;
	}

	const stars = (count: number, par: number) => (count <= par ? 3 : count <= par + 1 ? 2 : 1);

	// --- persistence ---------------------------------------------------------

	function save() {
		try {
			progress.boards[level.id] = cells;
			localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
		} catch {
			// Private windows refuse storage; the game just forgets on reload.
		}
	}

	function load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
				progress = { solved: saved.solved ?? {}, boards: saved.boards ?? {} };
			}
		} catch {
			progress = { solved: {}, boards: {} };
		}
	}

	function openLevel(index: number) {
		stop();
		levelIndex = index;
		const saved = progress.boards[levels[index].id];
		cells =
			saved && saved.length === levels[index].setup.cols * levels[index].setup.rows
				? saved
				: emptyCells(levels[index].setup);
		levers = Array(levels[index].levers).fill(false);
		selected = null;
		tool = null;
		results = null;
		trail = '';
		marble = null;
		message = '';
		try {
			history.replaceState(history.state, '', index === 0 ? location.pathname : `?level=${index + 1}`);
		} catch {
			// The address bar is a convenience.
		}
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const mode = new URL(location.href).searchParams.get('ropes');
		if (mode === 'demand' || mode === 'circuit') ropeMode = mode;
		load();
		const wanted = Number(new URL(location.href).searchParams.get('level'));
		const first = Number.isInteger(wanted) && wanted >= 1 && wanted <= levels.length ? wanted - 1 : 0;
		// A link can only take you as far as you have got.
		let index = 0;
		while (index < first && isUnlocked(index + 1, progress)) index++;
		openLevel(index);
		ready = true;
	});

	onDestroy(() => {
		runId++;
		if (typeof window !== 'undefined') removeDragListeners();
	});

	// --- editing the board ----------------------------------------------------

	function stop() {
		runId++;
		running = false;
	}

	/** Anything that changes the machine throws away the last run and test. */
	function edited() {
		stop();
		results = null;
		trail = '';
		marble = null;
		message = '';
		save();
	}

	function place(kind: PartKind, index: number) {
		if (!level.tray.includes(kind)) return;
		const col = index % setup.cols;
		cells[index] = defaultPart(kind, col, setup, level.levers);
		cells = cells;
		selected = index;
		edited();
	}

	function move(from: number, to: number) {
		[cells[from], cells[to]] = [cells[to], cells[from]];
		cells = cells;
		selected = to;
		edited();
	}

	function remove(index: number) {
		cells[index] = null;
		cells = cells;
		if (selected === index) selected = null;
		edited();
	}

	function update(patch: Partial<Part>) {
		if (selected === null || !cells[selected]) return;
		cells[selected] = { ...cells[selected], ...patch } as Part;
		cells = cells;
		edited();
	}

	function clearBoard() {
		cells = emptyCells(setup);
		selected = null;
		edited();
	}

	function toggleLever(index: number) {
		if (running) return;
		levers[index] = !levers[index];
		levers = levers;
		trail = '';
		marble = null;
		landedCup = false;
	}

	function showSetting(setting: number) {
		if (running) return;
		levers = leversOf(level.levers, setting);
		trail = '';
		marble = null;
		landedCup = false;
	}

	// --- running the machine -------------------------------------------------

	const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

	function play(segments: Segment[], id: number): Promise<void> {
		return new Promise((resolve) => {
			const started = performance.now();
			const total = totalMs(segments);
			let last = -1;
			const frame = (now: number) => {
				if (id !== runId) return resolve();
				const t = now - started;
				const { index, progress: through } = segmentAt(segments, t);
				const segment = segments[index];
				marble = pointAt(segment, through);
				if (index !== last) {
					last = index;
					if (segment.bump !== undefined) bumps = { ...bumps, [segment.bump]: (bumps[segment.bump] ?? 0) + 1 };
				}
				if (t >= total) return resolve();
				requestAnimationFrame(frame);
			};
			requestAnimationFrame(frame);
		});
	}

	/** Drops one marble with the levers as they are now. */
	async function drop(speed = 1, id = ++runId): Promise<Run | null> {
		const run = simulate(setup, cells, levers);
		const segments = timeline(setup, run, speed);
		trail = '';
		landedCup = false;
		running = true;
		if (reduced) {
			const last = segments[segments.length - 1];
			marble = run.landing === null ? null : last.to;
		} else {
			await play(segments, id);
		}
		if (id !== runId) return null;
		// The route is drawn once the marble has finished, so it does not give the ending away.
		trail = trailPath(segments);
		landedCup = run.cup;
		if (!run.cup) marble = null;
		return run;
	}

	async function dropOnce() {
		if (running) return;
		const run = await drop();
		running = false;
		if (run) message = run.cup ? 'It reached the cup.' : 'It missed the cup.';
	}

	async function testAll() {
		if (running) return;
		const id = ++runId;
		const table: (boolean | null)[] = settings.map(() => null);
		results = table;
		message = '';
		for (const setting of settings) {
			if (id !== runId) return;
			levers = leversOf(level.levers, setting);
			if (!reduced) await sleep(260);
			if (id !== runId) return;
			const run = await drop(2.2, id);
			if (!run) return;
			table[setting] = run.cup === level.target[setting];
			results = [...table];
		}
		running = false;
		if (id !== runId) return;
		const right = table.filter(Boolean).length;
		if (right === table.length) {
			progress.solved[level.id] = Math.min(progress.solved[level.id] ?? Infinity, parts);
			progress = progress;
			save();
			message = '';
		} else {
			message = `${right} of ${table.length} settings match. Tap a card to watch one that does not.`;
		}
	}

	async function replay(setting: number) {
		if (running) return;
		showSetting(setting);
		await dropOnce();
	}

	// --- drawing helpers ------------------------------------------------------

	type Rope = { idx: number; lever: number; d: string };

	/** A polyline with its corners rounded off. */
	function rounded(points: { x: number; y: number }[], radius: number): string {
		let d = `M${points[0].x} ${points[0].y}`;
		for (let i = 1; i < points.length - 1; i++) {
			const [before, corner, after] = [points[i - 1], points[i], points[i + 1]];
			const back = Math.min(radius, Math.hypot(corner.x - before.x, corner.y - before.y) / 2);
			const forward = Math.min(radius, Math.hypot(after.x - corner.x, after.y - corner.y) / 2);
			const unit = (from: { x: number; y: number }, to: { x: number; y: number }, len: number) => {
				const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
				return { x: to.x + ((from.x - to.x) / dist) * len, y: to.y + ((from.y - to.y) / dist) * len };
			};
			const start = unit(before, corner, back);
			const end = unit(after, corner, forward);
			d += ` L${start.x} ${start.y} Q${corner.x} ${corner.y} ${end.x} ${end.y}`;
		}
		const last = points[points.length - 1];
		return `${d} L${last.x} ${last.y}`;
	}

	function buildRopes(board: Cells, state: Levers, mode: typeof ropeMode): Rope[] {
		const out: Rope[] = [];
		board.forEach((part, idx) => {
			if (!part) return;
			const c = cellCenter(idx % setup.cols, Math.floor(idx / setup.cols));
			const left = { x: c.x - 28, y: c.y - 16 };
			const right = { x: c.x + 28, y: c.y - 16 };
			const tie = (lever: number, to: { x: number; y: number }) => {
				const from = leverPosition(setup, lever, level.levers);
				const startY = from.y + LEVER_SLOT.height + 4;
				if (mode === 'circuit') {
					// Straight down from the lever, along its own lane, then down to the tab.
					const lane = 78 + lever * 10;
					const pts = [
						{ x: from.x, y: startY },
						{ x: from.x, y: lane },
						{ x: to.x, y: lane },
						{ x: to.x, y: to.y - 9 }
					].filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
					out.push({ idx, lever, d: rounded(pts, 7) });
					return;
				}
				// Pulled down, the rope is taut. Up, it hangs slack.
				const sag = state[lever] ? 6 : 34;
				out.push({
					idx,
					lever,
					d: `M${from.x} ${startY} Q${(from.x + to.x) / 2} ${(startY + to.y) / 2 + sag} ${to.x} ${to.y}`
				});
			};
			if (part.kind === 'plank') tie(part.lever, part.side === 1 ? left : right);
			// One rope per lever, to the tab that wears its colour: the first lever's flap is on the right.
			if (part.kind === 'seesaw') {
				tie(part.a, right);
				tie(part.b, left);
			}
		});
		return out;
	}

	const partNames: Record<PartKind, string> = { plank: 'Plank', seesaw: 'Seesaw', ramp: 'Ramp' };
	const partHelp: Record<PartKind, string> = {
		plank: 'Lets the marble through when its lever agrees, and slides it aside when not.',
		seesaw: 'Tips the marble toward whichever of its two levers is down on its own.',
		ramp: 'Always slides the marble to one side.'
	};

	function describePart(part: Part | null) {
		if (!part) return 'empty';
		if (part.kind === 'plank')
			return `plank tied to lever ${LEVER_NAMES[part.lever]}, opens when it is ${part.open}, slides ${part.side === 1 ? 'right' : 'left'}`;
		if (part.kind === 'seesaw') return `seesaw tied to levers ${LEVER_NAMES[part.a]} and ${LEVER_NAMES[part.b]}`;
		return `ramp sliding ${part.side === 1 ? 'right' : 'left'}`;
	}

	/** The board in words, for people who cannot see it. */
	function describe(board: Cells, state: Levers) {
		const levs = state.map((down, i) => `${LEVER_NAMES[i]} ${down ? 'down' : 'up'}`).join(', ');
		const placed = board
			.map((part, i) => (part ? `row ${Math.floor(i / setup.cols) + 1}, column ${(i % setup.cols) + 1}: ${describePart(part)}` : ''))
			.filter(Boolean);
		return `Levers: ${levs}. ${placed.length ? `Parts: ${placed.join('; ')}.` : 'No parts placed yet.'}`;
	}

	const sideName = (side: number) => (side === 1 ? 'right' : 'left');

	$: tableLink = (() => {
		const names = LEVER_NAMES.slice(0, level.levers).map((n) => n.toLowerCase());
		const rule = simplify({ variables: names, rows: level.target }, 'programming').text;
		return `/truth-table-generator?expr=${encodeURIComponent(rule)}`;
	})();

	// --- dragging -------------------------------------------------------------

	type Drag = {
		source: 'tray' | 'cell';
		kind: PartKind;
		from: number | null;
		startX: number;
		startY: number;
		x: number;
		y: number;
		moved: boolean;
	};
	let drag: Drag | null = null;
	let svgEl: SVGSVGElement;
	let trayEl: HTMLElement;

	function toBoard(e: { clientX: number; clientY: number }) {
		const matrix = svgEl?.getScreenCTM();
		if (!matrix) return null;
		const point = svgEl.createSVGPoint();
		point.x = e.clientX;
		point.y = e.clientY;
		return point.matrixTransform(matrix.inverse());
	}

	function cellAt(e: { clientX: number; clientY: number }): number | null {
		const point = toBoard(e);
		if (!point) return null;
		const col = Math.floor((point.x - PAD) / CELL);
		const row = Math.floor((point.y - TOP) / CELL);
		if (col < 0 || col >= setup.cols || row < 0 || row >= setup.rows) return null;
		return cellIndex(setup, col, row);
	}

	function startDrag(e: PointerEvent, source: Drag['source'], kind: PartKind, from: number | null) {
		if (e.button !== 0 || running) return;
		e.preventDefault();
		drag = { source, kind, from, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moved: false };
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', cancelDrag);
	}

	function removeDragListeners() {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', cancelDrag);
	}

	function onMove(e: PointerEvent) {
		if (!drag) return;
		drag.x = e.clientX;
		drag.y = e.clientY;
		if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) drag.moved = true;
		drag = drag;
	}

	function cancelDrag() {
		drag = null;
		removeDragListeners();
	}

	function onUp(e: PointerEvent) {
		const d = drag;
		cancelDrag();
		if (!d) return;
		if (!d.moved) {
			// A tap: on the tray it picks a tool, on a part it selects it.
			if (d.source === 'tray') {
				tool = tool === d.kind ? null : d.kind;
				selected = null;
			} else {
				selected = d.from;
				tool = null;
			}
			return;
		}
		const target = cellAt(e);
		if (d.source === 'tray') {
			if (target !== null) place(d.kind, target);
		} else if (d.from !== null) {
			if (target !== null && target !== d.from) move(d.from, target);
			else if (target === null && trayEl?.contains(document.elementFromPoint(e.clientX, e.clientY))) remove(d.from);
		}
	}

	function cellDown(e: PointerEvent, index: number) {
		activeLever = null;
		const part = cells[index];
		if (part) {
			startDrag(e, 'cell', part.kind, index);
		} else if (tool && !running) {
			e.preventDefault();
			place(tool, index);
		} else {
			selected = null;
		}
	}

	function cellKey(e: KeyboardEvent, index: number) {
		const col = index % setup.cols;
		const row = Math.floor(index / setup.cols);
		const go = (c: number, r: number) => {
			if (c < 0 || c >= setup.cols || r < 0 || r >= setup.rows) return;
			document.getElementById(`cell-${r}-${c}`)?.focus();
		};
		switch (e.key) {
			case 'ArrowLeft':
				return go(col - 1, row), e.preventDefault();
			case 'ArrowRight':
				return go(col + 1, row), e.preventDefault();
			case 'ArrowUp':
				return go(col, row - 1), e.preventDefault();
			case 'ArrowDown':
				return go(col, row + 1), e.preventDefault();
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (running) return;
				if (cells[index]) selected = index;
				else if (tool) place(tool, index);
				return;
			case 'Delete':
			case 'Backspace':
				if (cells[index]) remove(index);
				return;
			case 'Escape':
				tool = null;
				selected = null;
		}
	}

	const leverKey = (e: KeyboardEvent, index: number) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleLever(index);
		}
	};

	function trayIcon(kind: PartKind): Part {
		return defaultPart(kind, 0, setup, level.levers);
	}
</script>

<div class="game" data-ready={ready} data-level={level.id} data-solved={best !== undefined}>
	<div class="levels" role="group" aria-label="Levels">
		{#each levels as l, i}
			<button
				type="button"
				class="level"
				class:current={i === levelIndex}
				class:done={progress.solved[l.id] !== undefined}
				disabled={!isUnlocked(i, progress)}
				aria-current={i === levelIndex ? 'step' : undefined}
				aria-label={`Level ${l.id}${progress.solved[l.id] !== undefined ? ', solved' : ''}${isUnlocked(i, progress) ? '' : ', locked'}`}
				on:click={() => openLevel(i)}>{l.id}</button
			>
		{/each}
	</div>

	<p class="goal" data-testid="hint"><strong>Level {level.id}.</strong> {level.hint}</p>

	<div class="layout">
		<div class="stage">
			<svg
				bind:this={svgEl}
				class="machine"
				viewBox="0 0 {size.width} {size.height}"
				role="group"
				aria-label="Marble machine"
				aria-describedby="machine-summary"
			>
				<defs>
					<clipPath id="marble-cell-clip"><rect x="-32" y="-32" width="64" height="64" /></clipPath>
					<radialGradient id="marble-shine" cx="34%" cy="30%" r="75%">
						<stop offset="0" stop-color="#ffffff" />
						<stop offset="0.45" stop-color="#c9d3e3" />
						<stop offset="1" stop-color="#6c7b93" />
					</radialGradient>
					<linearGradient id="marble-gold" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stop-color="#ffe98a" />
						<stop offset="0.55" stop-color="#f2b92a" />
						<stop offset="1" stop-color="#b9801a" />
					</linearGradient>
				</defs>

				<rect class="frame" width={size.width} height={size.height} rx="14" />
				<rect class="field" x={PAD} y={TOP} width={setup.cols * CELL} height={setup.rows * CELL} />

				<!-- The pegboard: alternating cells and a peg on every corner. -->
				{#each cells as _, idx}
					{@const c = cellCenter(idx % setup.cols, Math.floor(idx / setup.cols))}
					{#if (idx % setup.cols + Math.floor(idx / setup.cols)) % 2 === 0}
						<rect class="checker" x={c.x - 32} y={c.y - 32} width="64" height="64" />
					{/if}
				{/each}
				{#each Array(setup.rows + 1) as _, r}
					{#each Array(setup.cols + 1) as __, c}
						<circle class="peg" cx={PAD + c * CELL} cy={TOP + r * CELL} r="1.8" />
					{/each}
				{/each}

				<!-- A faint line down the column the marble is dropped into. -->
				<path class="dropline" d="M{start.x} {TOP} V{TOP + setup.rows * CELL}" />

				<!-- The hopper the marble waits in. -->
				<path class="hopper" d="M{start.x - 26} {TOP - 42} L{start.x - 8} {TOP - 6} H{start.x + 8} L{start.x + 26} {TOP - 42}" />
				{#if !running && !landedCup}
					<g transform="translate({start.x} {TOP - 20})" class="marble ready">
						<circle r={RADIUS} fill="url(#marble-shine)" class="ball" />
						<circle cx="-3.5" cy="-4" r="3" class="glint" />
					</g>
				{/if}

				<!-- Ropes tie each part to its lever. -->
				{#each ropes as rope}
					{@const lit = rope.lever === activeLever || rope.idx === selected}
					{#if ropeMode !== 'demand' || lit}
					<path
						class="rope rope-{rope.lever}"
						class:circuit={ropeMode === 'circuit'}
						class:dim={ropeMode !== 'demand' && selected !== null && rope.idx !== selected}
						class:hot={ropeMode === 'demand' || (selected !== null && rope.idx === selected)}
						d={rope.d}
						style="stroke: var(--lever-{rope.lever})"
					/>
					{/if}
				{/each}

				<!-- The parts. -->
				{#each cells as part, idx}
					{#if part}
						{@const c = cellCenter(idx % setup.cols, Math.floor(idx / setup.cols))}
						<g transform="translate({c.x} {c.y})">
							{#if selected === idx}
								<rect class="selected" x="-31" y="-31" width="62" height="62" rx="8" />
							{/if}
							<PartArt {part} {levers} bump={bumps[idx] ?? 0} />
						</g>
					{/if}
				{/each}

				<!-- The cups and drains along the bottom. -->
				{#each Array(setup.cols) as _, col}
					{@const land = landingPoint(setup, col)}
					{@const isCup = setup.cups.includes(col)}
					<g transform="translate({land.x} {TOP + setup.rows * CELL})" class="landing">
						<rect class="slot" x="-30" y="2" width="60" height="{84 - 6}" rx="8" />
						{#if isCup}
							<g class="cup" class:lit={landedCup && marble && Math.abs(marble.x - land.x) < 4}>
								<path d="M-22 14H22L17 52Q0 64 -17 52Z" fill="url(#marble-gold)" class="bowl" />
								<path d="M-22 14H22" class="rim" />
								<path d="M-5 60V70M-13 72H13" class="stem" />
							</g>
						{:else}
							<g class="drain">
								<rect x="-15" y="22" width="30" height="34" rx="6" class="hole" />
								<path d="M-6 34 0 42 6 34" class="chevron" />
							</g>
						{/if}
					</g>
				{/each}

				<!-- The route the last marble took, left behind so a wrong turn can be seen. -->
				{#if trail}
					<path class="trail" d={trail} />
				{/if}

				{#if marble}
					<g transform="translate({marble.x} {marble.y})" class="marble">
						<ellipse cx="2" cy="{RADIUS - 1}" rx="8" ry="2.6" class="shadow" />
						<circle r={RADIUS} fill="url(#marble-shine)" class="ball" />
						<circle cx="-3.5" cy="-4" r="3" class="glint" />
					</g>
				{/if}

				<!-- The levers. -->
				<rect class="rail" x={PAD} y="6" width={setup.cols * CELL} height="4" rx="2" />
				{#each levers as down, i}
					{@const p = leverPosition(setup, i, level.levers)}
					<g
						class="lever"
						transform="translate({p.x} {p.y})"
						role="switch"
						aria-checked={down}
						aria-label={`Lever ${LEVER_NAMES[i]}`}
						tabindex="0"
						on:click={() => {
							activeLever = i;
							toggleLever(i);
						}}
						on:pointerenter={() => (activeLever = i)}
						on:focus={() => (activeLever = i)}
						on:keydown={(e) => leverKey(e, i)}
					>
						<rect class="slot" x={-LEVER_SLOT.width / 2} y="0" width={LEVER_SLOT.width} height={LEVER_SLOT.height} rx="13" />
						<path class="tick" d="M-4 6l4-4 4 4M-4 40l4 4 4-4" />
						<g class="knob" style="transform: translateY({down ? 33 : 13}px)">
							<circle r="11" style="fill: var(--lever-{i})" class="knob-face" />
							<text class="knob-letter">{LEVER_NAMES[i]}</text>
						</g>
						<rect class="hit" x="-26" y="-6" width="52" height="{LEVER_SLOT.height + 12}" />
					</g>
				{/each}

				<!-- One target per cell, for the pointer and the keyboard. -->
				{#each cells as part, idx}
					{@const col = idx % setup.cols}
					{@const row = Math.floor(idx / setup.cols)}
					{@const c = cellCenter(col, row)}
					<g
						class="cell"
						class:filled={!!part}
						transform="translate({c.x} {c.y})"
						role="button"
						tabindex="0"
						id="cell-{row}-{col}"
						data-cell="{row},{col}"
						aria-label={`Row ${row + 1}, column ${col + 1}: ${describePart(part)}`}
						on:pointerdown={(e) => cellDown(e, idx)}
						on:keydown={(e) => cellKey(e, idx)}
					>
						<rect class="area" class:want={tool && !part} x="-32" y="-32" width="64" height="64" />
					</g>
				{/each}
			</svg>
			<p class="sr-only" id="machine-summary">{summary}</p>
		</div>

		<div class="side">
			<div class="controls">
				<button type="button" class="cta" disabled={running} on:click={dropOnce}>Drop marble</button>
				<button type="button" class="cta secondary" disabled={running} on:click={testAll}>Test all settings</button>
				<button type="button" class="link-btn" disabled={running || parts === 0} on:click={clearBoard}>Clear board</button>
			</div>

			<p class="status" role="status" aria-live="polite" data-testid="status">
				{#if passed}
					<strong class="win">Solved with {parts} {parts === 1 ? 'part' : 'parts'}.</strong>
					{'★'.repeat(stars(parts, level.par))}{'☆'.repeat(3 - stars(parts, level.par))}
					<span class="par">Par is {level.par}.</span>
				{:else if message}
					{message}
				{:else if running}
					Running…
				{:else}
					{parts} {parts === 1 ? 'part' : 'parts'} placed. Par is {level.par}.{best !== undefined ? ` Your best: ${best}.` : ''}
				{/if}
			</p>

			{#if passed}
				<p class="after">
					{#if levelIndex < levels.length - 1}
						<button type="button" class="cta" on:click={() => openLevel(levelIndex + 1)}>Next level</button>
					{:else}
						<strong>That was the last level.</strong>
					{/if}
					<a href={tableLink}>See the same rule as a truth table</a>
				</p>
			{/if}

			<h2 class="sub">Goal</h2>
			<ul class="cards" aria-label="What the marble should do for each setting of the levers">
				{#each settings as setting}
					{@const want = level.target[setting]}
					{@const state = leversOf(level.levers, setting)}
					{@const result = results ? results[setting] : null}
					<li>
						<button
							type="button"
							class="card"
							class:now={setting === currentSetting}
							class:ok={result === true}
							class:bad={result === false}
							disabled={running}
							aria-label={`${state.map((d, i) => `${LEVER_NAMES[i]} ${d ? 'down' : 'up'}`).join(', ')}: the marble should ${want ? '' : 'not '}reach the cup${result === null ? '' : result ? '. Passed' : '. Failed'}`}
							on:click={() => replay(setting)}
						>
							<span class="dots" aria-hidden="true">
								{#each state as down, i}
									<span class="dot" class:down style="--c: var(--lever-{i})">{LEVER_NAMES[i]}</span>
								{/each}
							</span>
							<svg class="mini" viewBox="-14 -2 28 30" aria-hidden="true">
								<path d="M-11 0H11L8 18Q0 25 -8 18Z" class:want fill={want ? 'url(#marble-gold)' : 'none'} class="mini-cup" />
							</svg>
							<span class="verdict" aria-hidden="true">{result === null ? '' : result ? '✓' : '✗'}</span>
						</button>
					</li>
				{/each}
			</ul>

			<h2 class="sub">Parts</h2>
			<div class="tray" bind:this={trayEl} role="group" aria-label="Parts you can place">
				{#each level.tray as kind}
					<button
						type="button"
						class="tray-item"
						class:active={tool === kind}
						aria-pressed={tool === kind}
						data-tray={kind}
						disabled={running}
						on:pointerdown={(e) => startDrag(e, 'tray', kind, null)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								tool = tool === kind ? null : kind;
								selected = null;
							}
						}}
					>
						<svg viewBox="-40 -40 80 80" aria-hidden="true">
							<PartArt part={trayIcon(kind)} levers={Array(level.levers).fill(false)} />
						</svg>
						<span class="tray-text"><strong>{partNames[kind]}</strong><span>{partHelp[kind]}</span></span>
					</button>
				{/each}
			</div>
			<p class="tray-help">
				Drag a part onto the board, or pick one and tap a square. Drag a placed part to move it, or back here to remove it.
			</p>

			{#if selectedPart && selected !== null}
				<div class="inspector" aria-label="Selected part">
					<h3>{partNames[selectedPart.kind]}</h3>
					{#if selectedPart.kind === 'plank'}
						<div class="option-row">
							<span class="option-label" id="opt-lever">Tied to lever</span>
							<div class="seg" role="group" aria-labelledby="opt-lever">
								{#each Array(level.levers) as _, i}
									<button
										type="button"
										class:on={selectedPart.lever === i}
										aria-pressed={selectedPart.lever === i}
										on:click={() => update({ lever: i })}>{LEVER_NAMES[i]}</button
									>
								{/each}
							</div>
						</div>
						<div class="option-row">
							<span class="option-label" id="opt-open">Lets the marble through when it is</span>
							<div class="seg" role="group" aria-labelledby="opt-open">
								<button type="button" class:on={selectedPart.open === 'down'} aria-pressed={selectedPart.open === 'down'} on:click={() => update({ open: 'down' })}>Down</button>
								<button type="button" class:on={selectedPart.open === 'up'} aria-pressed={selectedPart.open === 'up'} on:click={() => update({ open: 'up' })}>Up</button>
							</div>
						</div>
					{:else if selectedPart.kind === 'seesaw'}
						<div class="option-row">
							<span class="option-label" id="opt-a">Tips left when only this is down</span>
							<div class="seg" role="group" aria-labelledby="opt-a">
								{#each Array(level.levers) as _, i}
									<button type="button" class:on={selectedPart.a === i} aria-pressed={selectedPart.a === i} disabled={selectedPart.b === i} on:click={() => update({ a: i })}>{LEVER_NAMES[i]}</button>
								{/each}
							</div>
						</div>
						<div class="option-row">
							<span class="option-label" id="opt-b">Tips right when only this is down</span>
							<div class="seg" role="group" aria-labelledby="opt-b">
								{#each Array(level.levers) as _, i}
									<button type="button" class:on={selectedPart.b === i} aria-pressed={selectedPart.b === i} disabled={selectedPart.a === i} on:click={() => update({ b: i })}>{LEVER_NAMES[i]}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if selectedPart.kind !== 'seesaw'}
						<div class="option-row">
							<span class="option-label" id="opt-side">Slides the marble</span>
							<div class="seg" role="group" aria-labelledby="opt-side">
								<button type="button" class:on={selectedPart.side === -1} aria-pressed={selectedPart.side === -1} on:click={() => update({ side: -1 })}>Left</button>
								<button type="button" class:on={selectedPart.side === 1} aria-pressed={selectedPart.side === 1} on:click={() => update({ side: 1 })}>Right</button>
							</div>
						</div>
					{/if}
					<p class="inspector-note">Now sliding {selectedPart.kind === 'seesaw' ? 'to whichever side tips' : sideName(selectedPart.side)}.</p>
					<button type="button" class="link-btn" on:click={() => remove(selected ?? 0)}>Remove this part</button>
				</div>
			{/if}
		</div>
	</div>

	{#if drag && drag.moved}
		<div class="ghost" style="left: {drag.x}px; top: {drag.y}px" aria-hidden="true">
			<svg viewBox="-40 -40 80 80" width="64" height="64">
				<PartArt part={trayIcon(drag.kind)} levers={Array(level.levers).fill(false)} />
			</svg>
		</div>
	{/if}
</div>

<style>
	.game {
		--lever-0: #ff7b7b;
		--lever-1: #59c7ff;
		--lever-2: #ffd166;
		margin-top: 0.4rem;
	}
	.levels {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-bottom: 0.8rem;
	}
	.level {
		min-width: 2.2rem;
		height: 2.2rem;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.4);
		background: #0d0d0f;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}
	.level.done {
		border-color: #5db65d;
		color: #9ad39a;
	}
	.level.current {
		background: #2c6b2c;
		color: #fff;
		border-color: #5db65d;
	}
	.level:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.level:focus-visible,
	.card:focus-visible,
	.tray-item:focus-visible,
	.seg button:focus-visible {
		outline: 2px solid #5db65d;
		outline-offset: 2px;
	}
	.goal {
		margin: 0 0 1rem;
		color: #e6e6e6;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
	}
	.stage {
		min-width: 0;
	}
	.machine {
		display: block;
		width: 100%;
		height: auto;
		user-select: none;
		-webkit-user-select: none;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* --- the board --- */
	.frame {
		fill: #16171b;
		stroke: rgba(255, 255, 255, 0.18);
		stroke-width: 1.5;
	}
	.field {
		fill: #1b1d23;
		stroke: #3a3e4a;
		stroke-width: 2;
	}
	.checker {
		fill: rgba(255, 255, 255, 0.025);
	}
	.peg {
		fill: rgba(255, 255, 255, 0.16);
	}
	.dropline {
		stroke: rgba(255, 255, 255, 0.09);
		stroke-width: 2;
		stroke-dasharray: 2 7;
		stroke-linecap: round;
	}
	.hopper {
		fill: none;
		stroke: #8a95a8;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ball {
		stroke: #2c3546;
		stroke-width: 1;
	}
	.glint {
		fill: rgba(255, 255, 255, 0.85);
	}
	.shadow {
		fill: rgba(0, 0, 0, 0.35);
	}
	.rope {
		fill: none;
		stroke-width: 2.2;
		stroke-linecap: round;
		opacity: 0.85;
	}
	.rope-1 {
		stroke-dasharray: 6 4;
	}
	.rope-2 {
		stroke-dasharray: 1.5 4.5;
		stroke-width: 3;
	}
	.rope.circuit {
		stroke-dasharray: none;
		stroke-width: 2.4;
		stroke-linejoin: round;
	}
	.rope.dim {
		opacity: 0.25;
	}
	.rope.hot {
		stroke-width: 3.4;
		opacity: 1;
	}
	.selected {
		fill: rgba(93, 182, 93, 0.1);
		stroke: #5db65d;
		stroke-width: 1.6;
		stroke-dasharray: 5 4;
	}
	.trail {
		fill: none;
		stroke: rgba(255, 255, 255, 0.45);
		stroke-width: 2;
		stroke-dasharray: 3 5;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}

	/* --- landing row --- */
	.landing .slot {
		fill: #121318;
		stroke: #2c2f38;
		stroke-width: 1.5;
	}
	.bowl {
		stroke: #7a4f0c;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.rim {
		stroke: #ffe98a;
		stroke-width: 3;
		stroke-linecap: round;
	}
	.stem {
		fill: none;
		stroke: #b9801a;
		stroke-width: 4;
		stroke-linecap: round;
	}
	.cup {
		transition: filter 0.2s ease;
	}
	.cup.lit {
		filter: drop-shadow(0 0 9px rgba(255, 215, 90, 0.95));
	}
	.hole {
		fill: #050506;
		stroke: #2c2f38;
		stroke-width: 1.5;
	}
	.chevron {
		fill: none;
		stroke: #4a4f5c;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* --- levers --- */
	.rail {
		fill: #3a3e4a;
	}
	.lever {
		cursor: pointer;
		outline: none;
	}
	.lever .slot {
		fill: #0b0c0f;
		stroke: #59606f;
		stroke-width: 2;
	}
	.tick {
		fill: none;
		stroke: #59606f;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.knob {
		transition: transform 0.18s cubic-bezier(0.3, 1.4, 0.5, 1);
	}
	.knob-face {
		stroke: #101010;
		stroke-width: 1.6;
	}
	.knob-letter {
		font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace;
		fill: #101010;
		text-anchor: middle;
		dominant-baseline: central;
	}
	.lever .hit {
		fill: transparent;
	}
	.lever:focus-visible .slot {
		stroke: #5db65d;
		stroke-width: 3;
	}

	/* --- cells --- */
	.cell {
		outline: none;
	}
	.cell .area {
		fill: transparent;
		stroke: transparent;
		stroke-width: 2;
	}
	.cell.filled {
		cursor: grab;
		touch-action: none;
	}
	.cell .area.want {
		stroke: rgba(93, 182, 93, 0.6);
		stroke-dasharray: 4 4;
		cursor: copy;
	}
	.cell:hover .area.want {
		fill: rgba(93, 182, 93, 0.12);
	}
	.cell:focus-visible .area {
		stroke: #5db65d;
		stroke-width: 3;
	}

	/* --- the panel beside the board --- */
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		align-items: center;
	}
	.cta.secondary {
		background: transparent;
		border: 1px solid #5db65d;
		color: #9ad39a;
	}
	.cta:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.link-btn {
		background: none;
		border: 0;
		color: #9ad39a;
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
	.link-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.status {
		margin: 0.9rem 0 0;
		min-height: 1.5rem;
		color: #ddd;
	}
	.win {
		color: #7be27b;
	}
	.par {
		color: #aaa;
	}
	.after {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
		margin: 0.6rem 0 0;
	}
	.sub {
		font-size: 1rem;
		margin: 1.3rem 0 0.5rem;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.6rem, 1fr));
		gap: 0.5rem;
	}
	.card {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.55rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}
	.card.now {
		border-color: #fff;
	}
	.card.ok {
		border-color: #5db65d;
		background: rgba(93, 182, 93, 0.12);
	}
	.card.bad {
		border-color: #d9534f;
		background: rgba(217, 83, 79, 0.14);
	}
	.dots {
		display: inline-flex;
		gap: 0.25rem;
	}
	.dot {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 50%;
		border: 2px solid var(--c);
		font: 700 0.62rem ui-monospace, SFMono-Regular, Menlo, monospace;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--c);
	}
	.dot.down {
		background: var(--c);
		color: #101010;
	}
	.mini {
		width: 1.4rem;
		height: 1.5rem;
		margin-left: auto;
	}
	.mini-cup {
		stroke: #b9801a;
		stroke-width: 1.5;
	}
	.mini-cup:not(.want) {
		stroke: #5c6270;
		stroke-dasharray: 2 2;
	}
	.verdict {
		width: 1rem;
		text-align: center;
		font-weight: 700;
	}
	.card.ok .verdict {
		color: #7be27b;
	}
	.card.bad .verdict {
		color: #ff8a86;
	}

	.tray {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.tray-item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0.6rem;
		background: #0d0d0f;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 4px;
		color: #fff;
		font: inherit;
		text-align: left;
		cursor: grab;
		touch-action: none;
	}
	.tray-item.active {
		border-color: #5db65d;
		background: rgba(93, 182, 93, 0.12);
	}
	.tray-item svg {
		width: 3.6rem;
		height: 3.6rem;
		flex: none;
		background: #1b1d23;
		border-radius: 4px;
	}
	.tray-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.85rem;
	}
	.tray-text span {
		color: #aaa;
		font-size: 0.78rem;
	}
	.tray-help {
		color: #999;
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
	}
	.inspector {
		margin-top: 1rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
	}
	.inspector h3 {
		margin: 0 0 0.6rem;
		font-size: 0.95rem;
	}
	.option-row {
		margin-bottom: 0.7rem;
	}
	.option-label {
		display: block;
		font-size: 0.82rem;
		color: #ddd;
		margin-bottom: 0.3rem;
	}
	.seg {
		display: inline-flex;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 3px;
		overflow: hidden;
	}
	.seg button {
		background: #0d0d0f;
		color: #fff;
		border: 0;
		padding: 0.4rem 0.8rem;
		font: inherit;
		cursor: pointer;
	}
	.seg button + button {
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}
	.seg button.on {
		background: #2c6b2c;
	}
	.seg button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.inspector-note {
		color: #999;
		font-size: 0.8rem;
		margin: 0 0 0.6rem;
	}
	.ghost {
		position: fixed;
		z-index: 50;
		width: 64px;
		height: 64px;
		margin: -32px 0 0 -32px;
		pointer-events: none;
		opacity: 0.9;
		filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.5));
	}

	@media (max-width: 760px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.knob,
		.cup {
			transition: none;
		}
	}
</style>
