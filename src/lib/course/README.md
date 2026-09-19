# Writing a lesson

The course at `/learn` is eight stages of short lessons. A lesson is two files
with the same slug:

- `lessons/<stage>.ts` holds the lesson's metadata and its question generators,
  in the `lessons` array of that stage, in teaching order.
- `content/<slug>.svelte` holds the prose, the boxes and the widgets.

The lesson route `src/routes/learn/[lesson]` joins the two. Nothing else needs
touching: the sitemap, the roadmap sidebar, the course home and the previous
and next links are all derived from the registry.

## Who it is for

Someone about eighteen who has never seen any of this. They are bright and
will not be talked down to, but they do not know the words yet. So:

- Explain every new term in the sentence where it first appears, or right after
  it in a `New word` box. Do not use a term before it has been explained, and
  do not assume the reader remembers one from three lessons ago without a
  reminder.
- Say why before how. The reader wants to know what problem the idea solves.
- One idea per lesson. If a section needs a second idea to make sense, that
  idea belongs in an earlier lesson or in a `New word` box.
- Short sentences, concrete examples, no jargon for its own sake. British
  spelling (minimise, colour), as on the rest of the site. No em dashes.
- Every lesson gets at least one worked example, in a `<div class="example">`
  with the question in the first paragraph and the working in the rest.
- Every lesson ends with a `What to remember` list of three to five lines.
- Aim for 500 to 900 words of prose, plus the widgets and boxes.

## Boxes

```svelte
<Aside kind="term" title="bit">…</Aside>
<!-- a new word, stays open -->
<Aside kind="why" title="what about …?">…</Aside>
<!-- the reason, folds away -->
<Aside kind="mistake" title="reading 10 as ten">…</Aside>
<!-- a trap, folds away -->
<Aside kind="tip">…</Aside>
<!-- a shortcut, stays open -->
```

Use one or two `why` boxes and one `mistake` box per lesson, more only when
the lesson really has more traps. Put paragraphs inside them, not bare text.

## Widgets

Every lesson has at least one thing to click. The kit in `widgets/`:

- `Wire` — a switch, a wire and a lamp.
- `BitStrip` — clickable bits with weights and the value they make.
  `bits`, `value`, `weights`, `hex`, `label`.
- `LiveGate` — one gate with toggles, its symbol and its truth table.
  `gate` is one of and, or, not, xor, nand, nor, xnor; `table` hides the table.
- `LiveExpression` — any expression (`a & b | !c` syntax, as the tools use)
  with a toggle per input, the output and the table. `expression`, `label`,
  `table`, `outputLabel`, `names` (friendlier input names).

Write a new widget when a lesson needs one (a latch to set and reset, a
counter to clock, a shift register, a state machine to step through), as one
component in `widgets/`, named for what it shows. Rules for a widget:

- Wrap it in `<div class="widget">` with a `<p class="widget-title">` first
  line. The shell supplies `.toggle` / `.toggle.on`, `.out` / `.out.on`,
  `.val`, `.lamp` / `.lamp.on`, `.arrow`, and the site's `.data-table` with
  `bit-1` / `bit-0` cells, so reuse those classes rather than restyling.
- Compute, never hard-code. The truth tables, sequences and timings in
  `$lib/boolean`, `$lib/adders`, `$lib/sequential`, `$lib/flipflops`,
  `$lib/latches`, `$lib/fsm`, `$lib/timing` and `$lib/numbers` are tested; use
  them so a widget cannot disagree with the tools.
- Every control is a `<button type="button">` with `aria-pressed` where it is
  a toggle; live readouts get `aria-live="polite"`. It must work at 390px wide.
- No timers that run on their own unless the reader started them, and then a
  way to stop them.

## Question generators

Each lesson lists three to five generators. A generator takes a `Random` and
returns a `CourseQuestion`. Use the helpers in `random.ts`:

```ts
const q = (random: Random): CourseQuestion => {
	const n = int(random, 2, 6);
	const { options, answer } = assemble(random, String(2 ** n), [String(n * 2), String(n ** 2)]);
	return {
		prompt: `How many values can ${n} bits hold?`,
		options,
		answer,
		hints: [idea, nearlyTheAnswer],
		explanation
	};
};
```

- The same `Random` must always give the same question: no `Math.random`,
  no `Date`. `assemble` shuffles and drops duplicate distractors; still give
  it three or more distinct distractors so there are usually four options.
- `hints[0]` points at the idea; `hints[1]` nearly does the work for this
  exact question, with its numbers in. The explanation shows the full
  working. All three must be specific to the generated values, not generic.
- Compute the right answer with the same libraries as the site, never by
  hand. `fromPractice('gates' | 'truth-tables' | 'expressions' | 'simplifying'
| 'diagrams')` in `fromPractice.ts` reuses the practice page's generators
  with hints attached, and is a good extra generator for the gate and algebra
  stages.
- Options are short: a number, a bit pattern, a word, a short expression. Use
  `bin(value, bits)` for patterns. Multi-line options render as-is.
- A `table` (a `TruthTable` from `$lib/boolean`) or an `svg` is shown above
  the options when present; `detail` shows one line in a monospace box.

## Metadata

```ts
{
	slug: 'counting-in-binary',         // the URL: /learn/counting-in-binary
	title: 'Counting in binary',        // short, sentence case, no colon
	blurb: 'One line for the roadmap and the course home.',
	description: 'The meta description, under 160 characters, a full sentence saying what the lesson covers.',
	minutes: 12,                        // reading plus the quiz
	generators: [countUp, toDecimal],
	deeper: [{ href: '/binary-converter', label: 'Binary converter' }],   // existing reference pages only
	build: { href: '/simulator#example:Calculator', label: 'the four bit calculator' }  // optional
}
```

`deeper` links must be pages that exist on the site (see `static/llms.txt`
for the list). `build` can point at a simulator example
(`/simulator#example:Introduction`, `Calculator`, `7%20Segment-display`,
`Rising%20edge%20detector`, `Falling%20edge%20detector`) or at `/simulator`.
The old hands-on Learn page, with its "Try it" instructions for building each
circuit in the simulator, is in git history:
`git show bd1da53:src/routes/learn/+page.svelte`.

## Checks before you are done

```sh
node_modules/.bin/prettier --plugin-search-dir=. --write src/lib/course/lessons/<stage>.ts src/lib/course/content/<slug>.svelte src/lib/course/widgets/<Widget>.svelte
node_modules/.bin/eslint src/lib/course
node_modules/.bin/svelte-check --tsconfig ./tsconfig.json --output machine 2>&1 | grep -i "course"
node_modules/.bin/playwright test tests/course.spec.ts -g "sound across|prose"
```

The last one runs every generator over 400 seeds and checks that every lesson
in the registry has a content file and the other way round. Do not run the
full build or the full test suite from a stage branch; the integrator does.
