<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import MergePasses from '$lib/course/widgets/MergePasses.svelte';
	import { tabulate, cubeTerm, type Cube, type Pass } from '$lib/quineMcCluskey';
	import { overbar } from '$lib/course/notation';

	// The worked example, computed rather than typed, so every line agrees with
	// the Quine-McCluskey page for the same function.
	const variables = ['a', 'b', 'c'];
	const example = tabulate([1, 3, 5, 6, 7], [], variables);
	const dashed = (pattern: string) => pattern.replace(/-/g, '–');
	const ms = (list: number[]) => list.map((m) => `m${m}`).join(', ');
	const term = (cube: Cube) => overbar(cubeTerm(cube, variables));
	const ones = (n: number) => `${n} ${n === 1 ? 'one' : 'ones'}`;

	/** One pass as a sentence: each group of codes with what became of them. */
	const passLine = (pass: Pass) =>
		pass.groups
			.map(
				(group) =>
					`${ones(group.ones)}: ${group.cubes
						.map((cube) => `${dashed(cube.pattern)} (${ms(cube.covers)}, ${cube.ticked ? 'ticked' : 'prime'})`)
						.join(', ')}`
			)
			.join('; ');
	const primesLine = example.primes
		.map((prime) => `${dashed(prime.pattern)}, which reads as ${term(prime)} and covers ${ms(prime.covers)}`)
		.join('; ');
	/** The minterms a prime is the only cover of, which is what makes it essential. */
	const soleCover = (cube: Cube) =>
		example.chart.minterms.filter(
			(m, column) => cube.covers.includes(m) && example.chart.rows.filter((row) => row.covers[column]).length === 1
		);
	const essentialLine = example.essential
		.map((cube) => `${term(cube)} is the only prime covering ${ms(soleCover(cube))}`)
		.join(', and ');
	const restLine = example.remaining.length
		? `That still leaves ${ms(example.remaining)}, covered with the fewest extra primes: ${example.extra
				.map(term)
				.join(', ')}.`
		: 'Between them they cover every column, so nothing is left to choose.';
</script>

<h2>Where the map runs out</h2>
<p>
	A Karnaugh map works because you can see which cells are neighbours. With five inputs you need two 4 by 4 maps
	stacked, with cells in the same place on both counting as neighbours, and with six you need four. Past that, nobody
	can see the loops, and a map of twenty inputs is out of the question. Real circuits routinely have that many. So the
	minimising has to be done by a program, and a program cannot "spot" anything. It needs a procedure: a fixed list of
	steps that reaches the answer without judgement. The Quine-McCluskey method, worked out by Willard Quine in 1952 and
	refined by Edward McCluskey in 1956, is exactly that, and it is the method the tools on this site run.
</p>

<h2>The same idea, as a list of steps</h2>
<p>
	The method uses the one rule you already have: two terms that differ in exactly one input merge into one term without
	that input. Instead of looking for neighbours on a picture, it writes every minterm as a binary code and compares
	codes. It has three steps.
</p>
<p>
	<strong>Step 1: group by the number of 1s.</strong> Write each minterm of the function in binary and sort the codes into
	groups by how many 1s they contain. Two codes that differ in exactly one bit must have counts of 1s that differ by exactly
	one, so a code only ever needs comparing with the group next to its own, which is what keeps the work down.
</p>
<p>
	<strong>Step 2: merge.</strong> Compare every code in a group with every code in the group below. Whenever two differ in
	a single bit, write a new term with a dash in that position, meaning "this input has dropped out", and put a tick against
	both originals to record that they have been absorbed into something bigger. When every pair has been tried, do the same
	again with the new dashed terms, merging only terms whose dashes are in the same place, and keep going until a pass produces
	nothing. Any term that never got a tick could not be merged with anything, so it is a prime implicant: a loop that cannot
	be made bigger, just as on the map.
</p>
<p>
	<strong>Step 3: choose.</strong> Draw a chart with one row per prime implicant and one column per minterm, and put a mark
	wherever the row's term covers the column's minterm. A column with a single mark can only be covered by that one row, so
	that row is essential and goes straight into the answer. Cross off every column it covers. If columns are left, pick the
	fewest remaining rows that cover them. The answer is the OR of the chosen terms.
</p>

<Aside kind="term" title="prime implicant chart">
	<p>
		The <strong>prime implicant chart</strong> is the table from step 3: prime implicants down the side, minterms along the
		top, marks where one covers the other. It turns "which loops should I keep?" into a question a program can answer by
		counting marks in columns.
	</p>
</Aside>

<div class="example">
	<p>
		<strong>Worked example.</strong> Minimise <span class="mono">f(a, b, c) = Σm({example.minterms.join(', ')})</span>
		with the Quine-McCluskey method.
	</p>
	{#each example.passes as pass}
		<p>
			<strong>{pass.dashes === 0 ? 'Step 1, group.' : `Step 2, pass ${pass.dashes}.`}</strong>
			{#if pass.dashes === 0}
				In binary, sorted by their number of 1s:
			{:else if pass.dashes === 1}
				Compare neighbouring groups and merge every pair that differs in one bit, writing a dash where the bit was:
			{:else}
				Merge the dashed terms whose dashes are in the same place and which differ in one bit:
			{/if}
			<span class="mono">{passLine(pass)}</span>.
		</p>
	{/each}
	<p>
		<strong>Step 3, choose.</strong> The unticked terms are the prime implicants:
		<span class="mono">{primesLine}</span>. On the chart, {essentialLine}, so {example.essential.length === 1
			? 'it is'
			: 'both are'} essential. {restLine} The answer is <span class="mono">f = {overbar(example.text)}</span>, and a map
		would have given the same two loops.
	</p>
</div>

<Aside kind="mistake" title="merging terms whose dashes do not line up">
	<p>
		In the second and later passes, two terms may only merge if their dashes are in the same positions and the rest
		differs in one bit. 0–1 and 01– look close but cannot merge: together they cover m1, m3, m2 and m3, which is three
		cells, and three is never a loop. The same goes for codes that differ in two bits, however alike they look. Count
		the differing positions every time.
	</p>
</Aside>

<h2>Watch it run</h2>
<p>
	The function below has four inputs and eight minterms, and its chart needs a real choice at the end: two prime
	implicants are essential, and each of the two minterms they leave uncovered can be picked up by more than one of the
	rest, so the last step is to find the single prime that covers both. Click through one pass at a time and check a
	merge or two by hand.
</p>

<MergePasses minterms={[0, 2, 4, 5, 8, 10, 13, 15]} />

<Aside kind="why" title="why do real tools not use this either?">
	<p>
		Quine-McCluskey always finds a minimal answer, but the number of prime implicants can grow very fast with the number
		of inputs, and choosing the best cover from a huge chart is one of the problems computers are known to be slow at.
		For the sizes you would ever do by hand it is instant. For a chip with hundreds of inputs, design tools use methods
		that settle for a very good answer rather than a provably smallest one. The idea underneath is still the same
		merging of neighbours.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>Karnaugh maps stop being readable at five or six inputs, so bigger functions need a procedure.</li>
	<li>
		Quine-McCluskey is the map's merging rule done on binary codes: group by 1s, merge pairs differing in one bit.
	</li>
	<li>A merged term gets a dash where the input dropped out; a term that never merges is a prime implicant.</li>
	<li>The prime implicant chart picks the cover: essential rows first, then the fewest others that finish the job.</li>
	<li>It gives the same answer as a map, works for any number of inputs, and suits a computer.</li>
</ul>
