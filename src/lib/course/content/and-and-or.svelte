<script lang="ts">
	import Aside from '$lib/course/Aside.svelte';
	import LiveGate from '$lib/course/widgets/LiveGate.svelte';
	import LiveExpression from '$lib/course/widgets/LiveExpression.svelte';
</script>

<h2>Two questions</h2>
<p>
	Most of what a circuit has to decide comes down to one of two questions about its inputs. "Are all of them on?" and
	"Is at least one of them on?" The gate that answers the first is called <strong>AND</strong>, and the gate that
	answers the second is called <strong>OR</strong>. They are named after the words you would use to describe them, and
	if you keep those words in mind you will never mix them up.
</p>

<h2>AND: both</h2>
<p>
	An AND gate outputs 1 only when every one of its inputs is 1. If any input is 0, the output is 0. Think of a door that
	opens only when a key is turned <em>and</em> the correct code has been typed. Either one on its own does nothing.
</p>

<LiveGate gate="and" />

<p>
	Look at the table: four rows, and only the bottom one, where <span class="mono">a</span> and
	<span class="mono">b</span> are both 1, has a 1 in the output column. That single 1 at the bottom is the fingerprint of
	AND. The symbol is a shape with a flat back and a rounded nose, like a capital D.
</p>

<h2>OR: at least one</h2>
<p>
	An OR gate outputs 1 when at least one of its inputs is 1. It is 0 only when all of its inputs are 0. A burglar alarm
	that rings if the door sensor <em>or</em> the window sensor is triggered is an OR gate: one is enough, and both together
	still just ring the alarm.
</p>

<LiveGate gate="or" />

<p>
	The table is the mirror of AND: a single 0 at the top, where both inputs are 0, and 1 everywhere else. The symbol has
	a curved back and comes to a point at the front.
</p>

<Aside kind="mistake" title="OR is not 'one or the other'">
	<p>
		In everyday English, "you can have tea or coffee" usually means one of them, not both. The OR gate is not like that.
		When both inputs are 1 the output is 1; OR means <em>at least</em> one, and it is perfectly happy with all of them. The
		gate that means "one or the other but not both" is a different gate, and it gets its own lesson.
	</p>
</Aside>

<div class="example">
	<p>
		<strong>Worked example.</strong> The alarm rings if the door <em>or</em> the window is open. The door is open and
		the window is closed. Does it ring? And would a door that needs the key <em>and</em> the code open if only the key was
		turned?
	</p>
	<p>
		The alarm is an OR gate with inputs door = 1, window = 0. OR asks "is at least one input 1?" Yes, the door is, so
		the output is 1 and the alarm rings. The door lock is an AND gate with inputs key = 1, code = 0. AND asks "are all
		inputs 1?" No, the code is 0, so the output is 0 and the door stays shut.
	</p>
</div>

<LiveExpression
	expression="a | b"
	label="The alarm: an OR gate with a sensor on each input."
	names={{ a: 'door', b: 'window' }}
	outputLabel="alarm"
/>

<h2>More than two inputs</h2>
<p>
	Nothing about "all" or "at least one" stops at two. An AND gate can have three, four or eight inputs, and it still
	outputs 1 only when every one of them is 1. An OR gate with any number of inputs still outputs 1 when any one of them
	is. A car that warns you when <em>any</em> door is open is a four-input OR; a rocket that launches only when
	<em>every</em> safety check has passed is an AND with as many inputs as there are checks.
</p>
<p>
	The truth table grows quickly, as you saw last lesson: three inputs give eight rows. Click through the three-input AND
	below and count the 1s in the output column. There is still exactly one, in the bottom row. A three-input OR would
	have seven 1s and a single 0, in the top row.
</p>

<LiveExpression expression="a & b & c" label="A three-input AND gate." />

<Aside kind="why" title="why give them symbols as well as names?">
	<p>
		A circuit with a hundred gates would be unreadable if every one of them was a box with a word in it. The shapes let
		you take in a drawing at a glance: the D shapes are ANDs, the pointed ones are ORs, and you can follow the logic
		without reading a single label. There is a lesson at the end of this stage on reading such drawings.
	</p>
</Aside>

<Aside kind="tip">
	<p>
		To tell an AND table from an OR table without thinking, look only at the top row and the bottom row. The top row has
		all inputs 0, so AND gives 0 there and OR gives 0 there too; the bottom row has all inputs 1, so both give 1. The
		rows in between are where they differ: AND is 0 in all of them, OR is 1 in all of them. So count the 1s: one 1 means
		AND, one 0 means OR.
	</p>
</Aside>

<h2>Where they turn up</h2>
<p>
	AND and OR are the workhorses of digital design. An AND gate with one input used as an "enable" lets a signal through
	only while enable is 1, which is how a circuit is switched on and off. A row of AND gates picks out certain bits of a
	number and blanks the rest, which programmers know as masking. OR gates gather several "something happened" signals
	into one, so a processor can be interrupted by any of a dozen devices through a single wire. Later in this course you
	will find an AND gate producing the carry when two bits are added.
</p>

<h2>What to remember</h2>
<ul>
	<li>AND outputs 1 only when every input is 1. Its table has a single 1, in the bottom row.</li>
	<li>OR outputs 1 when at least one input is 1. Its table has a single 0, in the top row.</li>
	<li>OR includes the case where every input is 1; it means "at least one", not "exactly one".</li>
	<li>Both gates can have any number of inputs, and the rules "all" and "at least one" do not change.</li>
	<li>"Key and code" is an AND; "door or window" is an OR.</li>
</ul>
