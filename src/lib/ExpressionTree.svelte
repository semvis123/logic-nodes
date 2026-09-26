<script lang="ts">
	// Draws an expression tree as inline SVG: connectives as circles, letters
	// and constants as rounded squares, the root at the top. Given values for
	// the letters, every node is coloured by its own value for that row, the
	// way the working columns of a truth table would show it.
	import { tick } from 'svelte';
	import { layoutTree, withValues, treeStats, type TreeNode } from './exprTree';

	export let tree: TreeNode;
	/** The value of every letter, for one row. Leave out to draw the structure only. */
	export let values: Record<string, boolean> | null = null;
	export let marks: 'tf' | '01' = 'tf';
	/** Optional words for the start of the accessible description. */
	export let label = 'Expression tree';

	// Pixels per layout unit, and the margins that leave room for the marks
	// beside each node and the ring around the root.
	const UX = 54;
	const UY = 66;
	const PAD_X = 38;
	const PAD_TOP = 30;
	const PAD_BOTTOM = 26;
	const R = 17;
	const LEAF = 32;

	$: shown = values ? withValues(tree, values) : tree;
	$: layout = layoutTree(shown);
	$: stats = treeStats(shown);
	$: w = layout.width * UX + 2 * PAD_X;
	$: h = layout.height * UY + PAD_TOP + PAD_BOTTOM;
	$: px = (x: number) => PAD_X + x * UX;
	$: py = (y: number) => PAD_TOP + y * UY;

	// A tree wider than its box scrolls inside it. Start with the root in view,
	// and only when the tree itself changes, so picking a row keeps the scroll.
	let box: HTMLDivElement;
	let svg: SVGSVGElement;
	let centredFor = '';
	// A reactive call rather than afterUpdate, which runs once per flush and so
	// misses a tree that changes while the page is still mounting.
	$: if (box && svg) centre(`${shown.expr}|${w}`);
	async function centre(key: string) {
		if (key === centredFor) return;
		centredFor = key;
		await tick();
		if (box.scrollWidth <= box.clientWidth) return;
		const scale = svg.getBoundingClientRect().width / w;
		box.scrollLeft = px(layout.nodes[0].x) * scale - box.clientWidth / 2;
	}

	const mark = (v: boolean | undefined, style: 'tf' | '01') =>
		v === undefined ? '' : style === '01' ? (v ? '1' : '0') : v ? 'T' : 'F';
	const word = (v: boolean | undefined, style: 'tf' | '01') =>
		v === undefined ? '' : style === '01' ? (v ? '1' : '0') : v ? 'true' : 'false';
	const tone = (v: boolean | undefined) => (v === undefined ? 'plain' : v ? 'on' : 'off');

	$: description =
		`${label} for ${shown.expr}: ${stats.operators} ${stats.operators === 1 ? 'connective' : 'connectives'} over ` +
		`${stats.leaves} ${stats.leaves === 1 ? 'leaf' : 'leaves'}, ${stats.depth + 1} ${
			stats.depth === 0 ? 'level' : 'levels'
		} deep, with ${shown.label} at the root` +
		(shown.value === undefined ? '.' : `. For this row the whole expression is ${word(shown.value, marks)}.`);
</script>

<div class="tree-scroll" bind:this={box}>
	<svg
		bind:this={svg}
		class="tree"
		viewBox="0 0 {w} {h}"
		style="width: {w}px; min-width: {Math.round(w * 0.7)}px"
		role="img"
		aria-label={description}
		xmlns="http://www.w3.org/2000/svg"
	>
		{#each layout.edges as edge}
			{@const a = layout.nodes[edge.from]}
			{@const b = layout.nodes[edge.to]}
			<line class="edge {tone(b.node.value)}" x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} />
		{/each}
		{#each layout.nodes as n (n.id)}
			{@const cx = px(n.x)}
			{@const cy = py(n.y)}
			{@const v = n.node.value}
			<g class="node {tone(v)}" class:root={n.id === 0}>
				<title
					>{n.node.expr}{v === undefined ? '' : ` = ${mark(v, marks)}`}{n.id === 0 && n.node.children.length
						? ' (the whole expression)'
						: ''}</title
				>
				{#if n.id === 0 && v !== undefined}
					<circle class="halo" {cx} {cy} r={R + 6} />
				{/if}
				{#if n.node.children.length}
					<circle class="shape" {cx} {cy} r={R} />
				{:else}
					<rect class="shape leaf" x={cx - LEAF / 2} y={cy - LEAF / 2} width={LEAF} height={LEAF} rx="7" />
				{/if}
				<text
					class="label"
					class:small={n.node.label.length > 1}
					class:letter={n.node.kind === 'var'}
					x={cx}
					y={cy}
					dy="0.35em">{n.node.label}</text
				>
				{#if v !== undefined}
					<text class="mark" x={cx + (n.id === 0 ? R + 10 : R + 5)} y={cy} dy="0.35em">{mark(v, marks)}</text>
				{/if}
			</g>
		{/each}
	</svg>
</div>

<style>
	.tree-scroll {
		overflow-x: auto;
		max-width: 100%;
	}

	.tree {
		display: block;
		margin: 0 auto;
		max-width: 100%;
		height: auto;
		/* Light text on the dark card, for the text inside and the tooltips. */
		color: #eee;
	}

	.edge {
		stroke: rgba(255, 255, 255, 0.35);
		stroke-width: 2;
	}

	.edge.on {
		stroke: rgba(93, 182, 93, 0.75);
	}

	.edge.off {
		stroke: rgba(255, 102, 102, 0.6);
	}

	.shape {
		fill: #26282c;
		stroke: #9a9ea6;
		stroke-width: 2;
	}

	.shape.leaf {
		fill: #1b1c1f;
		stroke: #c9ccd2;
	}

	.on .shape {
		fill: #1d3a1f;
		stroke: #5db65d;
	}

	.off .shape {
		fill: #3d1d1f;
		stroke: #f66;
	}

	.root .shape {
		stroke-width: 3;
	}

	.halo {
		fill: none;
		stroke-width: 2;
		stroke-dasharray: 3 3;
	}

	.on .halo {
		stroke: #5db65d;
	}

	.off .halo {
		stroke: #f66;
	}

	.label {
		fill: currentColor;
		color: #fff;
		font-size: 17px;
		text-anchor: middle;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.label.letter {
		font-weight: 700;
		font-size: 16px;
	}

	.label.small {
		font-size: 12px;
	}

	.mark {
		fill: currentColor;
		font-size: 12px;
		font-weight: 700;
		text-anchor: start;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.on .mark {
		color: #8ede8e;
	}

	.off .mark {
		color: #ff8a8a;
	}

	.root .mark {
		font-size: 14px;
	}

	/* On paper the card turns white, so the plain edges need ink. */
	@media print {
		.edge.plain {
			stroke: #555;
		}

		.on .mark {
			color: #2a7a2a;
		}

		.off .mark {
			color: #b02a2a;
		}
	}
</style>
