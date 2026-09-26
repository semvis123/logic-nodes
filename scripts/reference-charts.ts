// Renders a printable reference chart for each of the number, text, logic and
// set pages: the ASCII table, the binary alphabet, the hex to decimal grid,
// the logic symbols, the rules of inference, the logical equivalences, the
// conditional forms, the set operations as Venn diagrams, the set notation
// symbols, the IEEE 754 layouts and the Base64 alphabet.
//
// Nothing on a chart is typed in here. Every code, value, verdict and shading
// comes from the same engine the page uses, and a rule or law the engine does
// not confirm is left off, so a chart cannot disagree with its page.
//
//   npm run charts
//
// Chromium: set CHROMIUM_PATH to a Chromium binary to use it; otherwise the
// Chrome installed on the machine is used, as for the other card scripts.

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync, deflateSync } from 'node:zlib';
import {
	asciiBlocks,
	encodeText,
	bin8,
	BASE64_ALPHABET,
	BASE64URL_ALPHABET,
	base64EncodeText
} from '../src/lib/textEncoding.js';
import { parseRadix, toRadix } from '../src/lib/radix.js';
import { parsePropInput, propTable, formatProp, equivalenceGroups, type Prop } from '../src/lib/propositional.js';
import {
	connectiveSymbols,
	otherSymbols,
	rules,
	fallacies,
	checkArgumentText,
	basicLaws,
	conditionalLaws,
	biconditionalLaws,
	equivalentText,
	type Law
} from '../src/lib/logicReference.js';
import { parseSet, formatSet, shade, booleanText, vennLayout, setLabels, roster } from '../src/lib/venn.js';
import { symbolRows, universe, sets } from '../src/lib/setNotation.js';
import { formats, encode, limits, type Format } from '../src/lib/ieee754.js';

const OUT_DIR = 'static/img';
const MANIFEST = 'src/lib/referenceCharts.json';

const SANS = `'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif`;
const MONO = `ui-monospace, Menlo, 'DejaVu Sans Mono', 'Liberation Mono', monospace`;
/** Logic and set expressions: a proportional face with full-size arrows and operators. */
const MATH = `'DejaVu Sans', 'Cambria Math', 'STIX Two Math', 'Helvetica Neue', Arial, sans-serif`;

const STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; color: #111; font-family: ${SANS}; }
  .card { padding: 32px 36px 26px; display: flex; flex-direction: column; gap: 16px; width: max-content; background: #fff; }
  h1 { font-size: 32px; letter-spacing: -0.01em; }
  .sub { font-size: 17px; color: #444; margin-top: 4px; }
  .mono { font-family: ${MONO}; }
  .fx { font-family: ${MATH}; }
  .foot { font-size: 14px; color: #555; border-top: 1px solid #ccc; padding-top: 9px; }
  h2 { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #333; margin-bottom: 8px; }
  table { border-collapse: collapse; font-size: 15px; }
  th, td { border: 1px solid #222; padding: 3px 9px; text-align: center; }
  th { background: #ececec; font-weight: 700; }
  td.l, th.l { text-align: left; }
  .row { display: flex; gap: 22px; align-items: flex-start; }
  .note { font-size: 15px; color: #222; line-height: 1.45; }
  .note b { font-weight: 700; }
  .muted { color: #666; }
  svg { display: block; }
`;

const esc = (s: string) =>
	s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));

const html = (body: string) =>
	`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${body}</body></html>`;

const shell = (title: string, sub: string, inner: string, path: string, extraStyle = '') =>
	html(`<style>${extraStyle}</style><div class="card">
    <div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
    ${inner}
    <p class="foot">logicgates.org${path}</p>
  </div>`);

type Chart = { file: string; title: string; alt: string; path: string; body: string; width: number };
const charts: Chart[] = [];

const tf = (v: boolean) => (v ? 'T' : 'F');
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// --- 1. ASCII table ------------------------------------------------------------
{
	const blocks = asciiBlocks();
	const inner = `<div class="row">${blocks
		.map(
			(block) => `<div>
        <h2 class="bh">${block.first}–${block.last}<span>${esc(block.contains)}</span></h2>
        <table class="ascii"><thead><tr><th>Dec</th><th>Hex</th><th>Binary</th><th>Char</th></tr></thead><tbody>${block.rows
					.map(
						(row) =>
							`<tr><td>${row.code}</td><td class="mono">${row.hex}</td><td class="mono">${row.binary}</td><td class="${
								row.abbr ? 'abbr' : 'ch'
							}">${esc(row.abbr ?? row.char)}</td></tr>`
					)
					.join('')}</tbody></table>
      </div>`
		)
		.join('')}</div>`;
	const controls = blocks.flatMap((b) => b.rows).filter((r) => r.kind === 'control').length;
	charts.push({
		file: 'ascii-table-chart.png',
		title: 'ASCII table chart',
		alt: `ASCII table chart: all 128 ASCII codes in four blocks of 32, with decimal, hexadecimal and 7-bit binary values, the printable characters and the ${controls} control character abbreviations`,
		path: '/ascii-table',
		body: shell(
			'ASCII table',
			'All 128 codes: decimal, hexadecimal, 7-bit binary and the character. Control codes by abbreviation.',
			inner,
			'/ascii-table',
			`.ascii td { padding: 0 8px; height: 26px; font-size: 14px; line-height: 1; } .ascii .ch { font-family: ${MONO}; font-weight: 700; font-size: 16px; width: 50px; }
       .ascii .abbr { font-size: 12px; color: #333; width: 50px; } .row { gap: 22px; }
       .bh { font-size: 14px; } .bh span { display: block; font-size: 12.5px; font-weight: 400; text-transform: none; letter-spacing: 0; color: #444; margin-top: 2px; }`
		),
		width: 1400
	});
}

// --- 2. binary alphabet --------------------------------------------------------
{
	const byteOf = (ch: string) => encodeText(ch)[0].bytes[0].value;
	const range = (first: string, last: string) =>
		Array.from({ length: last.charCodeAt(0) - first.charCodeAt(0) + 1 }, (_, i) =>
			String.fromCharCode(first.charCodeAt(0) + i)
		);
	const groups = [
		{ name: 'Capital letters', chars: range('A', 'Z') },
		{ name: 'Small letters', chars: range('a', 'z') },
		{ name: 'Digits', chars: range('0', '9') }
	];
	const tableFor = (chars: string[]) =>
		`<table class="alpha"><thead><tr><th>Char</th><th>Binary</th><th>Dec</th></tr></thead><tbody>${chars
			.map((ch) => {
				const value = byteOf(ch);
				return `<tr><td class="ch">${esc(ch)}</td><td class="mono">${bin8(value)}</td><td>${value}</td></tr>`;
			})
			.join('')}</tbody></table>`;
	// Two columns of 13 for each alphabet, one of 10 for the digits.
	const inner = `<div class="row">${groups
		.map(
			(g) =>
				`<div><h2>${g.name}</h2><div class="row" style="gap:10px">${
					g.chars.length > 13 ? tableFor(g.chars.slice(0, 13)) + tableFor(g.chars.slice(13)) : tableFor(g.chars)
				}</div></div>`
		)
		.join('')}</div>`;
	const a = byteOf('A');
	charts.push({
		file: 'binary-alphabet-chart.png',
		title: 'Binary alphabet chart',
		alt: `Binary alphabet chart: the letters A to Z and a to z and the digits 0 to 9 as 8-bit binary ASCII codes with their decimal values, from A = ${bin8(
			a
		)} (${a})`,
		path: '/binary-translator',
		body: shell(
			'Binary alphabet',
			'Each letter and digit as an 8-bit byte in ASCII and UTF-8, with its decimal value.',
			inner,
			'/binary-translator',
			`.alpha td { padding: 3px 9px; font-size: 15px; } .alpha .ch { font-family: ${MONO}; font-weight: 700; font-size: 17px; }`
		),
		width: 1400
	});
}

// --- 3. hex to decimal grid ---------------------------------------------------
{
	const digits = Array.from({ length: 16 }, (_, i) => toRadix(BigInt(i), 16));
	const head = `<tr><th class="corner"></th>${digits.map((d) => `<th class="mono">_${d}</th>`).join('')}</tr>`;
	const body = digits
		.map(
			(hi) =>
				`<tr><th class="mono">${hi}_</th>${digits
					.map((lo) => {
						const hex = hi + lo;
						const value = parseRadix(hex, 16).value;
						return `<td><span class="hx">${hex}</span><span class="dc">${value}</span></td>`;
					})
					.join('')}</tr>`
		)
		.join('');
	charts.push({
		file: 'hex-to-decimal-chart.png',
		title: 'Hex to decimal chart',
		alt: 'Hex to decimal conversion chart: a 16 by 16 grid of every two-digit hexadecimal value from 00 to FF with its decimal equivalent from 0 to 255, rows by first hex digit and columns by second',
		path: '/hex-to-decimal',
		body: shell(
			'Hex to decimal chart: 00 to FF',
			'Row = first hex digit, column = second. Each cell shows the hex value and its decimal equivalent.',
			`<table class="hexgrid"><thead>${head}</thead><tbody>${body}</tbody></table>`,
			'/hex-to-decimal',
			`.hexgrid td { padding: 3px 4px; width: 54px; line-height: 1.1; }
       .hexgrid .hx { display: block; font-family: ${MONO}; font-size: 11px; color: #666; }
       .hexgrid .dc { display: block; font-size: 17px; font-weight: 700; }
       .hexgrid th { font-size: 15px; padding: 4px 6px; } .hexgrid .corner { background: #fff; border-color: #fff #222 #222 #fff; }`
		),
		width: 1100
	});
}

// --- 4. logic symbols -----------------------------------------------------------
{
	const table = propTable(parsePropInput(connectiveSymbols.map((s) => s.example).join(', ')));
	const [p, q] = table.variables;
	const symbolTable = `<table class="sy"><thead><tr><th>Symbol</th><th class="l">Name</th><th class="l">Read as</th><th class="l">Also written</th></tr></thead><tbody>${connectiveSymbols
		.map(
			(s) =>
				`<tr><td class="big">${esc(s.symbol)}</td><td class="l"><b>${esc(s.name)}</b></td><td class="l">${esc(
					s.reads
				)}</td><td class="l fx">${esc(s.also)}</td></tr>`
		)
		.join('')}</tbody></table>`;
	const truth = `<table class="tt"><thead><tr><th>${p}</th><th>${q}</th>${table.statements
		.map((s) => `<th class="fx">${esc(formatProp(s.prop))}</th>`)
		.join('')}</tr></thead><tbody>${table.rows
		.map(
			(row, r) =>
				`<tr>${row.map((v) => `<td>${tf(v)}</td>`).join('')}${table.statements
					.map((s) => `<td class="${s.values[r] ? 't' : 'f'}">${tf(s.values[r])}</td>`)
					.join('')}</tr>`
		)
		.join('')}</tbody></table>`;
	const others = `<table class="sy"><thead><tr><th>Symbol</th><th class="l">Name</th><th class="l">Meaning</th></tr></thead><tbody>${otherSymbols
		.map(
			(s) =>
				`<tr><td class="big">${esc(s.symbol)}</td><td class="l"><b>${esc(s.name)}</b></td><td class="l mean fx">${esc(
					s.meaning
				)}</td></tr>`
		)
		.join('')}</tbody></table>`;
	charts.push({
		file: 'logic-symbols-chart.png',
		title: 'Logic symbols chart',
		alt: `Logic symbols chart: the connectives ${connectiveSymbols
			.map((s) => `${s.symbol} ${s.name.toLowerCase()}`)
			.join(', ')} with how to read them, other notations and their truth tables, plus ⊤, ⊥, ∴, ≡, ⊨ and ⊢`,
		path: '/logic',
		body: shell(
			'Logic symbols',
			'The connectives of propositional logic, how to read them, other notations and their truth values.',
			`<div><h2>Connectives</h2>${symbolTable}</div>
       <div class="row"><div><h2>Truth values</h2>${truth}</div><div><h2>Other symbols</h2>${others}</div></div>`,
			'/logic',
			`.sy .big { font-size: 24px; font-family: ${MATH}; padding: 2px 12px; } .sy td { padding: 5px 10px; }
       .tt td, .tt th { padding: 5px 11px; font-size: 16px; } .tt .t { font-weight: 700; } .tt .f { color: #666; }
       .mean { max-width: 380px; font-size: 14px; }`
		),
		width: 1300
	});
}

// --- 5. rules of inference -------------------------------------------------------
{
	const verdicts = rules.map((rule) => ({ rule, valid: checkArgumentText(rule.premises, rule.conclusion).valid }));
	const valid = verdicts.filter((v) => v.valid).map((v) => v.rule);
	const invalid = fallacies.filter((f) => !checkArgumentText(f.premises, f.conclusion).valid);
	const form = (premises: string[], conclusion: string) =>
		`<div class="form fx">${premises.map((p) => `<div>${esc(p)}</div>`).join('')}<div class="concl">∴ ${esc(
			conclusion
		)}</div></div>`;
	const cards = valid
		.map(
			(rule) =>
				`<div class="rule"><div class="nm">${esc(rule.name)}</div>${
					rule.aka ? `<div class="aka fx">${esc(rule.aka)}</div>` : ''
				}${form(rule.premises, rule.conclusion)}</div>`
		)
		.join('');
	const bad = invalid
		.map(
			(f) =>
				`<div class="rule fallacy"><div class="nm">${esc(f.name)}</div><div class="aka">Invalid; mistaken for ${esc(
					f.mistakenFor
				)}</div>${form(f.premises, f.conclusion)}</div>`
		)
		.join('');
	charts.push({
		file: 'rules-of-inference-chart.png',
		title: 'Rules of inference chart',
		alt: `Rules of inference chart: the premises and conclusion of ${plural(valid.length, 'valid rule')}, ${valid
			.map((r) => r.name.toLowerCase())
			.join(', ')}, and ${plural(
			invalid.length,
			'invalid fallacy',
			'invalid fallacies'
		)} such as ${invalid[0].name.toLowerCase()}`,
		path: '/logic/rules-of-inference',
		body: shell(
			'Rules of inference',
			'Each rule as premises above the line and the conclusion below. Every rule shown is checked valid by truth table.',
			`<div><h2>Valid rules</h2><div class="rules">${cards}</div></div>
       <div><h2>Fallacies: invalid look-alikes</h2><div class="rules">${bad}</div></div>`,
			'/logic/rules-of-inference',
			`.rules { display: grid; grid-template-columns: repeat(5, 210px); gap: 12px; }
       .rule { border: 1px solid #222; padding: 10px 12px; }
       .rule .nm { font-weight: 700; font-size: 16px; }
       .rule .aka { font-size: 12.5px; color: #555; margin-top: 2px; }
       .rule .form { margin-top: 8px; font-size: 16px; line-height: 1.45; }
       .rule .concl { border-top: 1.5px solid #111; margin-top: 3px; padding-top: 2px; font-weight: 700; }
       .fallacy { border-style: dashed; background: #f6f6f6; }`
		),
		width: 1300
	});
}

// --- 6. logical equivalences ---------------------------------------------------------
{
	const checked = (laws: Law[]) =>
		laws
			.map((law) => ({ ...law, pairs: law.pairs.filter(([a, b]) => equivalentText(a, b)) }))
			.filter((law) => law.pairs.length);
	const groups = [
		{ title: 'Laws of logic', laws: checked(basicLaws) },
		{ title: 'Conditionals', laws: checked(conditionalLaws) },
		{ title: 'Biconditionals', laws: checked(biconditionalLaws) }
	];
	const count = groups.reduce((sum, g) => sum + g.laws.reduce((s, l) => s + l.pairs.length, 0), 0);
	const tableFor = (laws: Law[]) =>
		`<table class="eq"><tbody>${laws
			.map((law) =>
				law.pairs
					.map(
						([a, b], i) =>
							`<tr>${
								i === 0 ? `<td class="l nm" rowspan="${law.pairs.length}">${esc(law.name)}</td>` : ''
							}<td class="fx lhs">${esc(a)}</td><td class="sym fx">≡</td><td class="fx rhs">${esc(b)}</td></tr>`
					)
					.join('')
			)
			.join('')}</tbody></table>`;
	const [basic, cond, bicond] = groups;
	charts.push({
		file: 'logical-equivalences-chart.png',
		title: 'Logical equivalences chart',
		alt: `Logical equivalences chart: ${count} equivalences each checked by truth table, including identity, domination, De Morgan's, distributive, absorption, material implication, contraposition, exportation and the biconditional laws`,
		path: '/logic/logical-equivalences',
		body: shell(
			'Logical equivalences',
			`${count} laws of propositional logic. Both sides of each have the same truth table, checked row by row.`,
			`<div class="row"><div><h2>${basic.title}</h2>${tableFor(basic.laws)}</div>
       <div style="display:flex;flex-direction:column;gap:16px"><div><h2>${cond.title}</h2>${tableFor(
				cond.laws
			)}</div><div><h2>${bicond.title}</h2>${tableFor(bicond.laws)}</div></div></div>`,
			'/logic/logical-equivalences',
			`.eq td { padding: 4px 10px; font-size: 15.5px; } .eq .nm { font-weight: 700; font-size: 14px; background: #f3f3f3; }
       .eq .lhs { text-align: right; border-right: none; } .eq .rhs { text-align: left; border-left: none; }
       .eq .sym { border-left: none; border-right: none; color: #555; padding: 4px 2px; }`
		),
		width: 1400
	});
}

// --- 7. conditional statements ----------------------------------------------------------
{
	const neg = (p: Prop): Prop => (p.t === 'not' ? p.a : { t: 'not', a: p });
	const p: Prop = { t: 'var', name: 'p' };
	const q: Prop = { t: 'var', name: 'q' };
	const four = [
		{ name: 'Conditional', prop: { t: 'imp', a: p, b: q } as Prop, how: 'if p then q' },
		{ name: 'Converse', prop: { t: 'imp', a: q, b: p } as Prop, how: 'swap the parts' },
		{ name: 'Inverse', prop: { t: 'imp', a: neg(p), b: neg(q) } as Prop, how: 'negate both parts' },
		{ name: 'Contrapositive', prop: { t: 'imp', a: neg(q), b: neg(p) } as Prop, how: 'swap and negate' }
	];
	const table = propTable(parsePropInput(four.map((f) => formatProp(f.prop)).join(', ')));
	const groups = equivalenceGroups(table.statements).filter((g) => g.length > 1);
	const pairText = groups.map((g) => g.map((i) => four[i].name.toLowerCase()).join(' ≡ '));
	const partner = (i: number) => {
		const g = groups.find((g) => g.includes(i));
		return g ? g.filter((j) => j !== i).map((j) => four[j].name.toLowerCase()) : [];
	};
	const formsTable = `<table class="cf"><thead><tr><th class="l">Form</th><th>Symbols</th><th class="l">How</th><th class="l">Same truth table as</th></tr></thead><tbody>${four
		.map(
			(f, i) =>
				`<tr><td class="l"><b>${f.name}</b></td><td class="fx big">${esc(formatProp(f.prop))}</td><td class="l">${
					f.how
				}</td><td class="l">${partner(i).join(', ') || '—'}</td></tr>`
		)
		.join('')}</tbody></table>`;
	const truth = `<table class="cf tt"><thead><tr>${table.variables.map((v) => `<th>${v}</th>`).join('')}${four
		.map((f) => `<th><div class="small">${f.name}</div><span class="fx">${esc(formatProp(f.prop))}</span></th>`)
		.join('')}</tr></thead><tbody>${table.rows
		.map(
			(row, r) =>
				`<tr>${row.map((v) => `<td>${tf(v)}</td>`).join('')}${table.statements
					.map((s) => `<td class="${s.values[r] ? 't' : 'f'}">${tf(s.values[r])}</td>`)
					.join('')}</tr>`
		)
		.join('')}</tbody></table>`;
	const falseRows = table.statements[0].values
		.map((v, r) =>
			v ? '' : table.variables.map((name, j) => `${name} is ${table.rows[r][j] ? 'true' : 'false'}`).join(' and ')
		)
		.filter(Boolean);
	charts.push({
		file: 'conditional-statements-chart.png',
		title: 'Conditional statements chart',
		alt: `Conditional statements chart: the conditional p → q, its converse, inverse and contrapositive in symbols with their truth table, showing ${pairText.join(
			' and '
		)}`,
		path: '/logic/conditional-statements',
		body: shell(
			'Converse, inverse and contrapositive',
			'The four forms of a conditional statement, their truth table, and which ones always agree.',
			`${formsTable}
       <div class="row" style="align-items:center; gap:28px"><div>${truth}</div>
       <div class="note" style="max-width:420px">
         <p><b>Always agree:</b> ${groups
						.map((g) => g.map((i) => `the ${four[i].name.toLowerCase()}`).join(' and '))
						.join('; ')}.</p>
         <p style="margin-top:8px"><span class="fx">p → q</span> is false only when ${falseRows.join(
						' or '
					)}; in every other row it is true.</p>
       </div></div>`,
			'/logic/conditional-statements',
			`.cf td, .cf th { padding: 6px 12px; font-size: 16px; } .cf .big { font-size: 18px; }
       .tt .t { font-weight: 700; } .tt .f { color: #666; } .small { font-size: 12px; font-weight: 400; color: #444; }`
		),
		width: 1100
	});
}

// --- 8. set operations as Venn diagrams ------------------------------------------------------
{
	const layout = vennLayout(2);
	const labels = setLabels(2, [], 22);
	const venn = (shaded: boolean[]) => {
		const u = layout.universe;
		const parts = [
			`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="${Math.round(
				(240 * layout.height) / layout.width
			)}" viewBox="0 0 ${layout.width} ${layout.height}">`
		];
		for (const region of layout.regions)
			parts.push(`<path d="${region.path}" fill="${shaded[region.index] ? '#9e9e9e' : '#fff'}" fill-rule="evenodd"/>`);
		parts.push(
			`<rect x="${u.x}" y="${u.y}" width="${u.w}" height="${u.h}" fill="none" stroke="#111" stroke-width="2"/>`
		);
		for (const c of layout.circles)
			parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="#111" stroke-width="2.5"/>`);
		parts.push(`<text x="${u.lx}" y="${u.ly}" font-size="20" font-weight="700" text-anchor="middle">U</text>`);
		for (const spot of labels)
			parts.push(
				`<text x="${spot.x}" y="${spot.y}" font-size="${spot.size}" font-weight="700" text-anchor="${
					spot.anchor
				}" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(spot.text)}</text>`
			);
		parts.push('</svg>');
		return parts.join('');
	};
	const ops = [
		{ expr: 'A ∪ B', name: 'Union' },
		{ expr: 'A ∩ B', name: 'Intersection' },
		{ expr: 'A − B', name: 'Difference' },
		{ expr: 'B − A', name: 'Difference' },
		{ expr: 'A Δ B', name: 'Symmetric difference' },
		{ expr: "A'", name: 'Complement' },
		{ expr: '(A ∪ B)′', name: 'Neither A nor B' },
		{ expr: '(A ∩ B)′', name: 'Not both' }
	].map((op) => {
		const parsed = parseSet(op.expr);
		return { ...op, text: formatSet(parsed), logic: booleanText(parsed), shaded: shade(parsed, 2) };
	});
	const inner = `<div class="vgrid">${ops
		.map(
			(op) =>
				`<div class="v"><div class="ex fx">${esc(op.text)}</div><div class="vn">${esc(op.name)}</div>${venn(
					op.shaded
				)}<div class="lg fx">${esc(op.logic)}</div></div>`
		)
		.join('')}</div>`;
	charts.push({
		file: 'set-operations-venn-chart.png',
		title: 'Set operations Venn diagram chart',
		alt: `Set operations Venn diagram chart: eight shaded two-set Venn diagrams for ${ops
			.map((o) => o.text)
			.join(', ')}, each with its name and boolean logic equivalent`,
		path: '/venn-diagram-generator',
		body: shell(
			'Set operations on Venn diagrams',
			'The shaded region is the result of each operation. Below each diagram: the same thing in boolean logic.',
			inner,
			'/venn-diagram-generator',
			`.vgrid { display: grid; grid-template-columns: repeat(4, auto); gap: 18px 26px; }
       .v { text-align: center; } .v .ex { font-size: 22px; font-weight: 700; }
       .v .vn { font-size: 14px; color: #444; margin: 1px 0 6px; } .v svg { margin: 0 auto; }
       .v .lg { font-size: 14px; color: #333; margin-top: 5px; }`
		),
		width: 1200
	});
}

// --- 9. set notation symbols ----------------------------------------------------------
{
	const inner = `<table class="sn"><thead><tr><th>Symbol</th><th class="l">Name</th><th class="l">Read as</th><th class="l">Example</th></tr></thead><tbody>${symbolRows
		.map(
			(s) =>
				`<tr><td class="fx big">${s.symbol
					.split('\n')
					.map(esc)
					.join('<span class="or"> or </span>')}</td><td class="l"><b>${esc(s.name)}</b></td><td class="l">${esc(
					s.reads
				)}</td><td class="l fx ex">${esc(s.example)}</td></tr>`
		)
		.join('')}</tbody></table>`;
	charts.push({
		file: 'set-notation-chart.png',
		title: 'Set notation symbols chart',
		alt: `Set notation symbols chart: ${symbolRows.length} set theory symbols including ${symbolRows
			.slice(0, 11)
			.map((s) => s.symbol.split('\n')[0])
			.join(' ')} with their names, how to read them and a worked example on A = ${roster(sets.A)} and B = ${roster(
			sets.B
		)}`,
		path: '/set-notation',
		body: shell(
			'Set notation symbols',
			`Name, reading and a worked example for each. U = ${roster(universe)}, A = ${roster(sets.A)}, B = ${roster(
				sets.B
			)}.`,
			inner,
			'/set-notation',
			`.sn td, .sn th { padding: 5px 11px; font-size: 15px; } .sn .big { font-size: 19px; white-space: nowrap; }
       .sn .or { font-family: ${SANS}; font-size: 12px; color: #666; } .sn .ex { font-size: 14px; max-width: 520px; }`
		),
		width: 1300
	});
}

// --- 10. IEEE 754 formats ---------------------------------------------------------------
{
	const EXAMPLE = '5.75';
	const SIGN = '#cfcfcf';
	const EXP = '#9f9f9f';
	const FRAC = '#f2f2f2';
	const BAR = 960;
	const layoutBar = (format: Format) => {
		const f = formats[format];
		const top = f.bits - 1;
		const fields = [
			{ name: 'Sign', bits: 1, colour: SIGN, from: top, to: top },
			{ name: 'Exponent', bits: f.exponentBits, colour: EXP, from: top - 1, to: f.fractionBits },
			{ name: 'Fraction (mantissa)', bits: f.fractionBits, colour: FRAC, from: f.fractionBits - 1, to: 0 }
		];
		// Widths in proportion to the bits, with a floor so the sign stays legible.
		const minimum = 70;
		const rest = BAR - minimum;
		const unit = rest / (f.bits - 1);
		return `<div class="bar">${fields
			.map(
				(field) =>
					`<div class="fld" style="width:${field.bits === 1 ? minimum : Math.round(field.bits * unit)}px;background:${
						field.colour
					}">
            <div class="fn">${field.name}</div><div class="fb">${plural(field.bits, 'bit')}</div>
            <div class="fi mono"><span>${field.from}</span>${
						field.from !== field.to ? `<span>${field.to}</span>` : ''
					}</div></div>`
			)
			.join('')}</div>`;
	};
	const single = encode(EXAMPLE, 'single');
	const worked = (format: Format) => {
		const e = encode(EXAMPLE, format);
		const f = formats[format];
		return `<tr><td class="l"><b>${f.bits} bit</b></td><td class="mono" style="background:${SIGN}">${e.sign}</td><td class="mono" style="background:${EXP}">${e.exponentBits}</td><td class="mono l" style="background:${FRAC}">${e.fractionBits}</td><td class="mono">${e.hex}</td><td class="fx">${e.biased} − ${f.bias} = ${e.exponent}</td></tr>`;
	};
	const specs = (['single', 'double'] as Format[])
		.map((format) => {
			const f = formats[format];
			const lim = limits(format);
			return `<tr><td class="l"><b>${f.name}</b> <span class="muted mono" style="font-size:13px">${f.ctype}</span></td><td>1</td><td>${f.exponentBits}</td><td>${f.fractionBits}</td><td>${f.bias}</td><td class="mono">${lim.max.shortest}</td><td class="mono">${lim.minNormal.shortest}</td><td class="mono">${lim.epsilon.shortest}</td></tr>`;
		})
		.join('');
	const significand = single.significand.replace(/0+$/, '');
	const inner = `
    <div><h2>Single precision (float32)</h2>${layoutBar('single')}</div>
    <div><h2>Double precision (float64)</h2>${layoutBar('double')}</div>
    <div class="formula fx">value = (−1)<sup>sign</sup> × 1.fraction<sub>2</sub> × 2<sup>exponent − bias</sup></div>
    <table class="spec"><thead><tr><th class="l">Format</th><th>Sign</th><th>Exponent</th><th>Fraction</th><th>Bias</th><th>Largest</th><th>Smallest normal</th><th>Epsilon</th></tr></thead><tbody>${specs}</tbody></table>
    <div><h2>Worked example: ${EXAMPLE}</h2>
      <p class="note" style="margin-bottom:8px">${EXAMPLE} in binary is <span class="mono">${significand}</span> × 2<sup>${
		single.exponent
	}</sup>: sign ${single.sign}, exponent ${single.exponent} + bias, fraction <span class="mono">${significand.slice(
		2
	)}</span> followed by zeros.</p>
      <table class="spec"><thead><tr><th class="l">Format</th><th>Sign</th><th>Exponent</th><th class="l">Fraction</th><th>Hex</th><th>Exponent − bias</th></tr></thead><tbody>${worked(
				'single'
			)}${worked('double')}</tbody></table>
    </div>`;
	charts.push({
		file: 'ieee-754-format-chart.png',
		title: 'IEEE 754 floating point format chart',
		alt: `IEEE 754 floating point format chart: bit layouts of 32-bit single precision (1 sign, ${formats.single.exponentBits} exponent, ${formats.single.fractionBits} fraction bits, bias ${formats.single.bias}) and 64-bit double precision (1 sign, ${formats.double.exponentBits} exponent, ${formats.double.fractionBits} fraction bits, bias ${formats.double.bias}), the value formula, the ranges, and ${EXAMPLE} worked through as ${single.hex}`,
		path: '/ieee-754-converter',
		body: shell(
			'IEEE 754 floating point formats',
			'How float32 and float64 split their bits, the bias, the value formula and one number worked through.',
			inner,
			'/ieee-754-converter',
			`.bar { display: flex; border: 2px solid #111; width: max-content; }
       .fld { border-right: 2px solid #111; padding: 6px 8px 4px; text-align: center; }
       .fld:last-child { border-right: none; }
       .fn { font-weight: 700; font-size: 16px; } .fb { font-size: 14px; color: #222; }
       .fi { display: flex; justify-content: space-between; font-size: 12px; color: #222; margin-top: 4px; }
       .spec td, .spec th { padding: 5px 10px; font-size: 15px; }
       .formula { font-size: 21px; border: 1.5px solid #111; padding: 10px 16px; width: max-content; }`
		),
		width: 1100
	});
}
// --- 11. Base64 alphabet ------------------------------------------------------------------
{
	const columns = [0, 1, 2, 3].map((c) => Array.from({ length: 16 }, (_, i) => c * 16 + i));
	const tables = columns
		.map(
			(indexes) =>
				`<table class="b64"><thead><tr><th>Index</th><th>Binary</th><th>Char</th></tr></thead><tbody>${indexes
					.map(
						(i) =>
							`<tr><td>${i}</td><td class="mono">${i.toString(2).padStart(6, '0')}</td><td class="ch">${esc(
								BASE64_ALPHABET[i]
							)}</td></tr>`
					)
					.join('')}</tbody></table>`
		)
		.join('');
	const examples = ['Man', 'Ma', 'M'].map((text) => ({ text, out: base64EncodeText(text).text }));
	const urlDiff = [...BASE64_ALPHABET]
		.map((ch, i) =>
			ch === BASE64URL_ALPHABET[i]
				? ''
				: // Each character boxed, and the pair kept on one line, so a - cannot read as a hyphen.
				  `<li style="white-space:nowrap">index ${i}: <b class="mono" style="border:1px solid #111;padding:0 6px">${esc(
						ch
				  )}</b> becomes <b class="mono" style="border:1px solid #111;padding:0 6px">${esc(
						BASE64URL_ALPHABET[i]
				  )}</b></li>`
		)
		.filter(Boolean);
	const note = `<div class="note" style="max-width:330px">
      <h2>Padding with =</h2>
      <p>Every 3 bytes become 4 characters. When the input ends with 2 bytes left over, the output ends in one <b class="mono">=</b>; with 1 byte left over, in <b class="mono">==</b>.</p>
      <table class="b64 pad" style="margin-top:10px"><thead><tr><th>Text</th><th>Base64</th></tr></thead><tbody>${examples
				.map((e) => `<tr><td class="mono">${e.text}</td><td class="mono ch">${e.out}</td></tr>`)
				.join('')}</tbody></table>
      <h2 style="margin-top:18px">URL-safe Base64</h2>
      <p>Changes two characters, so the output can go in a URL or file name:</p>
      <ul style="list-style:none;margin-top:6px;display:flex;flex-direction:column;gap:6px">${urlDiff.join('')}</ul>
    </div>`;
	charts.push({
		file: 'base64-alphabet-chart.png',
		title: 'Base64 alphabet chart',
		alt: `Base64 alphabet chart: the index table of all 64 Base64 characters, A to Z, a to z, 0 to 9, + and /, with each 6-bit binary value, plus how = padding works and the URL-safe alphabet`,
		path: '/base64',
		body: shell(
			'Base64 alphabet',
			'Each 6-bit value from 0 to 63 and the character it becomes, with = padding and the URL-safe variant.',
			`<div class="row" style="gap:16px">${tables}${note}</div>`,
			'/base64',
			`.b64 td, .b64 th { padding: 3px 10px; font-size: 15px; } .b64 .ch { font-family: ${MONO}; font-weight: 700; font-size: 17px; }`
		),
		width: 1300
	});
}

// --- PNG size ---------------------------------------------------------------------------------
//
// The charts are black, white and grey, but Chromium saves RGBA. Rewriting a
// screenshot as an 8-bit greyscale PNG, with each row's filter picked by the
// usual minimum-sum rule and maximum deflate, gives the same pixels in about
// half the bytes. Anything that is not pure grey and opaque is left untouched.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(bytes: Buffer): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
	return Buffer.concat([head, data, crc]);
}
const paeth = (a: number, b: number, c: number) => {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

function greyPng(png: Buffer): Buffer {
	let pos = 8;
	let width = 0;
	let height = 0;
	let bpp = 0;
	const idat: Buffer[] = [];
	while (pos < png.length) {
		const length = png.readUInt32BE(pos);
		const type = png.toString('ascii', pos + 4, pos + 8);
		const data = png.subarray(pos + 8, pos + 8 + length);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			const [depth, colour, , , interlace] = [data[8], data[9], data[10], data[11], data[12]];
			if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) return png;
			bpp = colour === 6 ? 4 : 3;
		} else if (type === 'IDAT') idat.push(data);
		pos += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * bpp;
	const grey = Buffer.alloc(width * height);
	let prev = Buffer.alloc(stride);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? line[i - bpp] : 0;
			const b = prev[i];
			const c = i >= bpp ? prev[i - bpp] : 0;
			const add = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0;
			line[i] = (line[i] + add) & 0xff;
		}
		for (let x = 0; x < width; x++) {
			const r = line[x * bpp];
			if (line[x * bpp + 1] !== r || line[x * bpp + 2] !== r || (bpp === 4 && line[x * bpp + 3] !== 255)) return png;
			grey[y * width + x] = r;
		}
		prev = line;
	}
	const out = Buffer.alloc(height * (width + 1));
	const candidate = Buffer.alloc(width);
	for (let y = 0; y < height; y++) {
		const row = grey.subarray(y * width, (y + 1) * width);
		const above = y ? grey.subarray((y - 1) * width, y * width) : Buffer.alloc(width);
		let best = Infinity;
		for (let f = 0; f <= 4; f++) {
			let sum = 0;
			for (let x = 0; x < width; x++) {
				const a = x ? row[x - 1] : 0;
				const b = above[x];
				const c = x ? above[x - 1] : 0;
				const predict = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0;
				const v = (row[x] - predict) & 0xff;
				candidate[x] = v;
				sum += v < 128 ? v : 256 - v;
			}
			if (sum < best) {
				best = sum;
				out[y * (width + 1)] = f;
				candidate.copy(out, y * (width + 1) + 1);
			}
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 0; // greyscale
	const result = Buffer.concat([
		png.subarray(0, 8),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(out, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
	return result.length < png.length ? result : png;
}

// --- render ----------------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH;
// Greyscale text antialiasing: LCD subpixel smoothing would add colour fringes
// to a black and white chart, and stop it being saved as a greyscale PNG.
const args = ['--disable-lcd-text'];
const browser = await chromium.launch(executablePath ? { executablePath, args } : { channel: 'chrome', args });
const page = await browser.newPage({ deviceScaleFactor: 2 });

const manifest: { file: string; title: string; alt: string; url: string; width: number; height: number }[] = [];
for (const chart of charts) {
	await page.setViewportSize({ width: chart.width, height: 900 });
	await page.setContent(chart.body, { waitUntil: 'load' });
	const el = await page.$('.card');
	if (!el) throw new Error(`no card rendered for ${chart.file}`);
	const png = greyPng(await el.screenshot());
	writeFileSync(join(OUT_DIR, chart.file), png);
	const width = png.readUInt32BE(16);
	const height = png.readUInt32BE(20);
	manifest.push({
		file: chart.file,
		title: chart.title,
		alt: chart.alt,
		url: `logicgates.org${chart.path}`,
		width,
		height
	});
	console.log(`  ${chart.file} ${width}×${height} ${Math.round(png.length / 1024)} KB`);
}

await browser.close();

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, '\t')}\n`);
console.log(`\n${charts.length} charts written to ${OUT_DIR}/, manifest to ${MANIFEST}`);
