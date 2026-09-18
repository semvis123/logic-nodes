<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import StepByStep from '$lib/course/widgets/StepByStep.svelte';
	import DeMorganPair from '$lib/course/widgets/DeMorganPair.svelte';
	import { parseExpression, format } from '$lib/boolean';
	import { simplifySteps } from '$lib/steps';
	import { lawSlug } from '$lib/laws';

	// Both worked examples are produced by the step engine, so every line is a
	// real rewrite with the law that made it named, not a derivation typed in.
	const worked = (text: string) => {
		const ast = parseExpression(text);
		return { start: format(ast, 'math'), working: simplifySteps(ast) };
	};
	const first = worked('(a ∨ b) ∧ (a ∨ c)');
	const second = worked('¬(a ∨ b) ∨ ¬a ∧ b');
</script>

<h2>Why make it smaller</h2>
<p>
	Two equivalent expressions are two circuits that do the same job, and the shorter one uses fewer gates. Fewer gates
	means a cheaper chip, less power, and a signal that gets through sooner because it passes through fewer stages. It
	also means an expression a person can read. <strong>Simplifying</strong> is the process of using the laws to get from an
	expression you have been given to the shortest one that is equivalent to it.
</p>

<h2>The method</h2>
<p>
	Simplifying by hand is a loop with four moves. Write the expression down. Look for a law that fits some part of it.
	Apply it, writing the new line and the name of the law beside it. Repeat until no law fits. The only skill is the
	looking, and it helps to look in a fixed order:
</p>
<ol>
	<li>A NOT over a bracket? Push it in with De Morgan. Nothing else can be done while it sits there.</li>
	<li>A constant? Identity removes it, or annulment collapses the term.</li>
	<li>The same term twice? Idempotence drops one. A term next to its own NOT? Complement collapses them.</li>
	<li>A term that contains another term of the expression? Absorption deletes the longer one.</li>
	<li>Two terms that are the same except one has a letter and the other its NOT? The redundancy law, below.</li>
	<li>Only when nothing else fits, multiply a bracket out with the distributive law and look again.</li>
</ol>

<Aside kind="term" title="redundancy">
	<p>
		The <strong>redundancy</strong> law says <span class="mono">a ∨ ¬a ∧ b = a ∨ b</span>. The ¬a is doing no work: if a
		is 1 the whole thing is 1 anyway, and if a is 0 then ¬a is 1 and the second term is just b. So the ¬a can be
		dropped. It is absorption's cousin, and the calculator on this site uses it on almost every derivation, so you will
		see it named in the working below. Its dual is <span class="mono">a ∧ (¬a ∨ b) = a ∧ b</span>.
	</p>
</Aside>

<h2>Two worked derivations</h2>
<p>
	Both of the derivations below are produced by the same step engine that runs the
	<a href="/boolean-algebra-calculator">calculator</a>, so every line is a real rewrite and the law beside it is the one
	that made it. The first starts from two brackets and multiplies them out.
</p>

<div class="example">
	<p><strong>Worked example.</strong> Simplify <span class="mono">{first.start}</span>.</p>
	<ol class="steps">
		<li>
			<span class="law start">Start</span>
			<span class="mono text">{first.start}</span>
		</li>
		{#each first.working.steps as step}
			<li>
				<a class="law" href="/boolean-algebra-laws#{lawSlug(step.law)}">{step.law}</a>
				<span class="mono text">{step.text}</span>
				<span class="detail">{step.detail}</span>
			</li>
		{/each}
	</ol>
	<p>
		Notice that the expression got longer before it got shorter: multiplying out produces terms, and absorption then
		eats the ones that contain a. The result, <span class="mono">{first.working.text}</span>, is the second distributive
		law from the last lesson, run backwards.
	</p>
</div>

<p>The second starts with a NOT over a bracket, which is why De Morgan comes first.</p>

<div class="example">
	<p><strong>Worked example.</strong> Simplify <span class="mono">{second.start}</span>.</p>
	<ol class="steps">
		<li>
			<span class="law start">Start</span>
			<span class="mono text">{second.start}</span>
		</li>
		{#each second.working.steps as step}
			<li>
				<a class="law" href="/boolean-algebra-laws#{lawSlug(step.law)}">{step.law}</a>
				<span class="mono text">{step.text}</span>
				<span class="detail">{step.detail}</span>
			</li>
		{/each}
	</ol>
	<p>
		Once the NOT is pushed in, both terms start with ¬a, and the rest follows the checklist: redundancy strips the
		letter that is doing no work, and absorption swallows what is left. Five gates have become a single inverter.
	</p>
</div>

<p>Now try one yourself, one click per law. Guess the next line before you reveal it.</p>

<StepByStep expression="!(a & b) & (a | b)" />

<h2>Checking the answer with a truth table</h2>
<p>
	A derivation can go wrong at any line, so the last move is always a check. Put the original and the result side by
	side and compare every row. If they agree on all of them, the derivation is right, whatever route it took. If they
	disagree anywhere, a step was wrong, and the row that disagrees usually points at which one.
</p>

<DeMorganPair
	left="!(a | b) | !a & b"
	right="!a"
	label="The second example and its answer, on the same inputs. Same on every row?"
/>

<Aside kind="mistake" title="cancelling a shared term">
	<p>
		Given <span class="mono">a ∧ b ∨ a ∧ c</span>, it is tempting to "divide through by a" and write b ∨ c. There is no
		division in boolean algebra. What the shared a allows is the distributive law backwards,
		<span class="mono">a ∧ (b ∨ c)</span>, which still contains the a, and that is as far as it goes. Set a to 0 and b
		to 1: the original gives 0, and b ∨ c would give 1.
	</p>
</Aside>

<h2>When to stop</h2>
<p>
	Stop when no law applies. That usually means you have the shortest form, but not always: the laws can get stuck in a
	form where the next improvement needs a step backwards first. The <a href="/boolean-algebra-calculator">calculator</a>
	settles it another way. Its minimiser works from the truth table, not from the laws, so it cannot get stuck the way a chain
	of rewrites can, and the site's worked examples show the two agreeing. If the calculator reaches the same form you did,
	you can stop. Note that the smallest form is not always unique: some functions have two equally short expressions, and
	either is a right answer.
</p>

<Aside kind="why" title="why trust the calculator over the laws?">
	<p>
		The laws are a search, and a search can miss things. The minimiser instead lists every row where the function is 1
		and finds the fewest AND terms that cover exactly those rows, which is a counting problem with a definite answer.
		That method has a name, Quine-McCluskey, and the Karnaugh map in the next stage is the same idea done by eye.
	</p>
</Aside>

<h2>What to remember</h2>
<ul>
	<li>Simplifying is a loop: look for a law, apply it, name it, repeat until none fits.</li>
	<li>Push NOTs in first, clear constants and repeats, then absorb, then multiply out only as a last resort.</li>
	<li>Redundancy: a ∨ ¬a ∧ b = a ∨ b. The ¬a does no work.</li>
	<li>Check the result against the original with a truth table, row by row.</li>
	<li>When no law fits you are usually done; the calculator's minimiser can confirm it.</li>
</ul>

<style>
	.steps {
		margin: 0.4rem 0 0.8rem;
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

	@media (max-width: 600px) {
		.steps li {
			grid-template-columns: 1fr;
		}

		.detail {
			grid-column: 1;
		}
	}
</style>
