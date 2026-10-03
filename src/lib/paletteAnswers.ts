// Instant answers for the Ctrl+K palette. When what was typed is something the
// site can work out (an expression, a logic statement, a number, some Base64,
// an IP address, a UUID, a barcode number)
// the palette shows the answer at the top, with a link that opens the tool for
// it already filled in. The palette loads this module on first open, so no page
// carries these engines until someone uses it.
//
// Every detector is deliberately narrow: a search for "full adder" must stay a
// search, so plain words never count as an expression or as Base64.

import { parseExpression, truthTable, simplify, variablesOf, format } from './boolean.js';
import { parsePropInput, propTable, classify, checkArgument } from './propositional.js';
import { encode } from './ieee754.js';
import { calculate, type Op } from './arithmetic.js';
import { base64Decode, base64EncodeText, decodeUtf8, textToBytes, bin8, asciiTable } from './textEncoding.js';
import { parseCidr, parseMask, subnetInfo, formatAddress, usableHosts } from './ipv4.js';
import { parseIPv6, compressText, addressType } from './ipv6.js';
import { decodeUuid, decodeUlid, decodeSnowflake } from './ids.js';
import { checkDigit, isValidCode } from './ean.js';
import { intTypes } from './intLimits.js';

export type Answer = {
	/** The answer itself, shown in monospace. */
	title: string;
	hint: string;
	/** The tool, already filled in. */
	href: string;
	/** The tool's path, for its icon. */
	tool: string;
	/** A link to a tool rather than a worked-out value, so not set in monospace. */
	action?: boolean;
};

const MAX_ANSWERS = 4;

function link(path: string, params: Record<string, string | number>): string {
	const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
	return query ? `${path}?${query}` : path;
}

/** Binary in nibbles, padded to whole nibbles: 101010 → 0010 1010. */
const nibbles = (bits: string) =>
	bits
		.padStart(Math.ceil(bits.length / 4) * 4, '0')
		.replace(/(.{4})/g, '$1 ')
		.trim();

const clip = (text: string, max = 40) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** Real text: no control characters (tabs and line breaks aside) and no U+FFFD from bad UTF-8. */
const printable = (text: string) =>
	text.length > 0 &&
	[...text].every((ch) => {
		const code = ch.codePointAt(0) ?? 0;
		return (code >= 32 && code !== 127 && code !== 0xfffd) || ch === '\t' || ch === '\n' || ch === '\r';
	});

/** The binary converter's register widths: the smallest that fits. */
const converterWidth = (bitLength: number) => [4, 8, 12, 16, 24, 32].find((w) => w >= bitLength);

function asciiName(code: number): string {
	const row = asciiTable()[code];
	if (code > 32 && code < 127) return `'${row.char}'`;
	return row.abbr ? `${row.abbr} (${row.name.toLowerCase()})` : row.name.toLowerCase();
}

// --- Numbers ---------------------------------------------------------------

function decimalAnswers(text: string): Answer[] {
	const value = BigInt(text);
	const bits = value.toString(2);
	const hex = value.toString(16).toUpperCase();
	const width = converterWidth(bits.length);
	const answers: Answer[] = [
		{
			title: `${text} = ${nibbles(bits)}`,
			hint: `Decimal ${text} in binary · hex 0x${hex} · octal ${value.toString(8)}`,
			href: width
				? link('/binary-converter', { value: text, bits: width })
				: link('/hex-to-decimal', { v: text, from: 'dec' }),
			tool: width ? '/binary-converter' : '/hex-to-decimal'
		}
	];
	if (value <= 127n) {
		answers.push({
			title: `${text} is ${asciiName(Number(value))} in ASCII`,
			hint: `Hex 0x${hex.padStart(2, '0')} · binary ${bin8(Number(value))}`,
			href: link('/ascii-table', { c: text }),
			tool: '/ascii-table'
		});
	}
	// 1011 is more likely meant as binary, so that reading comes first.
	if (/^[01]{2,32}$/.test(text)) answers.unshift(binaryAnswer(text, 'As binary'));
	return answers;
}

function binaryAnswer(digits: string, label = 'Binary'): Answer {
	const value = BigInt(`0b${digits}`);
	const width = converterWidth(digits.length);
	return {
		title: `${nibbles(digits)} = ${value}`,
		hint: `${label} · hex 0x${value.toString(16).toUpperCase()}`,
		href: width
			? link('/binary-converter', { value: digits, base: 'binary', bits: width })
			: link('/hex-to-binary', { v: digits, from: 'bin' }),
		tool: '/binary-converter'
	};
}

function hexAnswers(digits: string): Answer[] {
	const value = BigInt(`0x${digits}`);
	const bits = value.toString(2);
	return [
		{
			title: `0x${digits.toUpperCase()} = ${value}`,
			hint: `In decimal · binary ${clip(nibbles(bits), 48)}`,
			href: link('/hex-to-decimal', { v: digits.toUpperCase() }),
			tool: '/hex-to-decimal'
		},
		{
			title: `0x${digits.toUpperCase()} = ${clip(nibbles(bits), 48)}`,
			hint: 'In binary, one nibble per hex digit',
			href: link('/hex-to-binary', { v: digits.toUpperCase() }),
			tool: '/hex-to-binary'
		}
	];
}

function floatAnswers(text: string): Answer[] {
	const single = encode(text, 'single');
	const stored = single.rounded === 'exact' ? 'stored exactly' : `stored as ${clip(single.exact, 22)}`;
	return [
		{
			title: `${text} → 0x${single.hex}`,
			hint: `As a 32-bit float, ${stored}`,
			href: link('/ieee-754-converter', { v: text }),
			tool: '/ieee-754-converter'
		}
	];
}

/** 2147483647 is int32's maximum: worth saying, since that is usually why it was typed. */
function limitAnswer(text: string): Answer | null {
	const value = BigInt(text);
	// 0 is every unsigned type's minimum, which says nothing.
	if (value === 0n) return null;
	const type = intTypes.find((t) => t.max === value) ?? intTypes.find((t) => t.min === value);
	if (!type) return null;
	const which = type.max === value ? 'max' : 'min';
	return {
		title: `${text.replace('-', '−')} = ${type.slug} ${which}`,
		hint: `The ${which === 'max' ? 'largest' : 'smallest'} ${type.bits}-bit ${
			type.signed ? 'signed' : 'unsigned'
		} integer`,
		href: `/integer-limits/${type.slug}`,
		tool: '/integer-limits'
	};
}

// --- Networking, IDs and barcodes -------------------------------------------

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function ipv4Answer(text: string): Answer | null {
	if (IPV4.test(text)) {
		// A bare dotted quad is only worth answering when it is a mask.
		if (!/^(255|0)\./.test(text)) return null;
		const prefix = parseMask(text);
		return {
			title: `${text} = /${prefix}`,
			hint: `A subnet mask: ${usableHosts(prefix).toLocaleString('en-GB')} usable hosts per subnet`,
			href: '/subnet-calculator#table',
			tool: '/subnet-calculator'
		};
	}
	const cidr = parseCidr(text);
	const info = subnetInfo(cidr.address, cidr.prefix);
	const hosts = `${info.usable.toLocaleString('en-GB')} host${info.usable === 1 ? '' : 's'}`;
	return {
		title: `${formatAddress(info.network)}/${info.prefix} · ${hosts}`,
		hint: `Mask ${formatAddress(info.mask)}${
			info.broadcast === null ? '' : ` · broadcast ${formatAddress(info.broadcast)}`
		}`,
		href: link('/subnet-calculator', { ip: text }),
		tool: '/subnet-calculator'
	};
}

function ipv6Answer(text: string): Answer {
	const parsed = parseIPv6(text);
	const short = compressText(parsed.hextets);
	return {
		title: `${short}${parsed.prefix === null ? '' : `/${parsed.prefix}`}`,
		hint: `IPv6, shortest form · ${addressType(parsed.value).name}`,
		href: link('/ipv6-expand-compress', { a: text }),
		tool: '/ipv6-expand-compress'
	};
}

function idAnswer(text: string, ulid: boolean): Answer {
	const id = ulid ? decodeUlid(text) : decodeUuid(text);
	return {
		title: id.title.split(':')[0],
		hint: id.time ? `Made ${id.time.iso}` : clip(id.summary, 60),
		href: link('/uuid-decoder', { id: text }),
		tool: '/uuid-decoder'
	};
}

function snowflakeAnswer(text: string): Answer | null {
	const id = decodeSnowflake(text, 'discord');
	// Only a time between the epoch and now makes it plausibly a real ID.
	if (!id.time || id.time.unixMs > Date.now()) return null;
	return {
		title: `Discord ID → ${id.time.iso}`,
		hint: 'Read as a Discord snowflake: when it was made',
		href: link('/snowflake-id-decoder', { id: text }),
		tool: '/snowflake-id-decoder'
	};
}

/** An 8, 12 or 13 digit number may be a barcode: say what its check digit is. */
function eanAnswer(text: string): Answer | null {
	const tool = '/ean-13-barcode-generator';
	if (text.length === 12) {
		return {
			title: `EAN-13 check digit ${checkDigit(text)}`,
			hint: `${text}${checkDigit(text)} with the check digit added`,
			href: link(tool, { v: text }),
			tool
		};
	}
	const valid = isValidCode(text);
	if (text.length === 8) {
		if (!valid) return null;
		return {
			title: 'A valid EAN-8',
			hint: 'Its check digit is right',
			href: link(tool, { sym: 'ean8', v: text }),
			tool
		};
	}
	return {
		title: valid ? 'A valid EAN-13' : `Not a valid EAN-13`,
		hint: valid ? 'Its check digit is right' : `The check digit should be ${checkDigit(text.slice(0, 12))}`,
		href: link(tool, { v: text }),
		tool
	};
}

// --- Binary and hex arithmetic --------------------------------------------------

const OPS: Record<string, Op> = { '+': 'add', '-': 'sub', '−': 'sub', '*': 'mul', '×': 'mul', '/': 'div', '÷': 'div' };
const OP_SIGN: Record<string, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

function arithmeticAnswer(a: string, sign: string, b: string, radix: 2 | 16): Answer | null {
	const op = OPS[sign];
	const calc = calculate(op, a, b, radix, null);
	const base = radix === 2 ? 'binary' : 'hex';
	const show = (digits: string) => (radix === 2 ? digits : `0x${digits.toUpperCase()}`);
	const remainder =
		calc.remainder !== undefined && calc.remainder > 0n ? ` r ${calc.remainder.toString(radix).toUpperCase()}` : '';
	return {
		title: `${show(a)} ${OP_SIGN[op]} ${show(b)} = ${
			calc.resultText.startsWith('−') ? '−' + show(calc.resultText.slice(1)) : show(calc.resultText)
		}${remainder}`,
		hint: `In ${base}: ${calc.a} ${OP_SIGN[op]} ${calc.b} = ${calc.result.toString().replace('-', '−')}${
			calc.remainder !== undefined && calc.remainder > 0n ? ` remainder ${calc.remainder}` : ''
		}`,
		href: link(radix === 2 ? '/binary-calculator' : '/hex-calculator', { a, b, op }),
		tool: radix === 2 ? '/binary-calculator' : '/hex-calculator'
	};
}

// --- Text -----------------------------------------------------------------

function quotedAnswers(text: string): Answer[] {
	const chars = [...text];
	if (chars.length === 1) {
		const code = chars[0].codePointAt(0) ?? 0;
		const bytes = textToBytes(text);
		return [
			{
				title: `'${text}' = ${code}`,
				hint:
					code <= 127
						? `ASCII · hex 0x${code.toString(16).toUpperCase().padStart(2, '0')} · binary ${bin8(code)}`
						: `U+${code.toString(16).toUpperCase().padStart(4, '0')} · UTF-8 ${bytes.map(bin8).join(' ')}`,
				href: code <= 127 ? link('/ascii-table', { c: code }) : link('/binary-translator', { t: text }),
				tool: code <= 127 ? '/ascii-table' : '/binary-translator'
			}
		];
	}
	const bytes = textToBytes(text);
	return [
		{
			title: clip(bytes.map(bin8).join(' '), 44),
			hint: `"${clip(text, 24)}" in binary, ${bytes.length} bytes`,
			href: link('/binary-translator', { t: text }),
			tool: '/binary-translator'
		},
		{
			title: clip(base64EncodeText(text).text, 44),
			hint: `"${clip(text, 24)}" in Base64`,
			href: link('/base64', { t: text }),
			tool: '/base64'
		}
	];
}

function base64Answer(text: string): Answer | null {
	// Plain words decode to something, so insist on what Base64 looks like:
	// padding, or a mix of cases or digits, and a decoding that is real text.
	if (!/[=]$/.test(text) && !(/[A-Z]/.test(text) && /[a-z0-9]/.test(text))) return null;
	if (text.replace(/=+$/, '').length % 4 === 1) return null;
	const decoded = decodeUtf8(base64Decode(text).bytes).text;
	if (!printable(decoded) || decoded.length < 2) return null;
	return {
		title: `"${clip(decoded, 36)}"`,
		hint: 'Decoded from Base64',
		href: link('/base64', { m: 'decode', t: text }),
		tool: '/base64'
	};
}

// --- Logic ------------------------------------------------------------------

const PROP = /→|↔|->|<->|=>|<=>|⇒|⇔|⊃|∴|\bimplies\b|\biff\b|\btherefore\b/i;

function propositionAnswers(text: string): Answer[] {
	const input = parsePropInput(text);
	const table = propTable(input);
	const href = link('/propositional-logic-truth-table', { s: text });
	const tool = '/propositional-logic-truth-table';
	if (input.conclusion) {
		const { valid, counterexamples } = checkArgument(table);
		return [
			{
				title: valid ? 'Valid argument' : 'Invalid argument',
				hint: valid
					? 'The conclusion is true in every row where the premises are'
					: `${counterexamples.length} row${
							counterexamples.length === 1 ? '' : 's'
					  } with true premises and a false conclusion`,
				href,
				tool
			}
		];
	}
	if (input.statements.length !== 1) {
		return [
			{
				title: `Truth table for ${input.statements.length} statements`,
				hint: 'With equivalence checks',
				href,
				tool,
				action: true
			}
		];
	}
	const kind = classify(table.statements[0].values);
	return [
		{
			title: kind === 'tautology' ? 'Tautology' : kind === 'contradiction' ? 'Contradiction' : 'Contingency',
			hint:
				kind === 'tautology'
					? 'True in every row of its truth table'
					: kind === 'contradiction'
					? 'False in every row of its truth table'
					: `True in some rows and false in others, ${table.rows.length} rows`,
			href,
			tool
		}
	];
}

const BOOL_OPERATOR = /[&|!~¬∧∨·*^⊕'+()]|\b(and|or|xor|not)\b/i;
const BOOL_KEYWORDS = new Set(['and', 'or', 'xor', 'not', 'true', 'false']);

function booleanAnswers(text: string): Answer[] {
	if (!BOOL_OPERATOR.test(text)) return [];
	// Adjacent letters mean AND, so "not gate" would parse as ¬(g·a·t·e). Only
	// short runs of letters count as variables; anything longer is a word.
	const runs = text.match(/[a-z]+/gi) ?? [];
	if (runs.some((run) => run.length > 3 && !BOOL_KEYWORDS.has(run.toLowerCase()))) return [];
	const ast = parseExpression(text);
	const variables = variablesOf(ast);
	if (variables.length === 0 || variables.length > 6) return [];
	const simplified = simplify(truthTable(ast));
	const expr = text.trim();
	const answers: Answer[] = [
		{
			title: simplified.alwaysTrue ? 'Always 1' : simplified.alwaysFalse ? 'Always 0' : `= ${simplified.text}`,
			hint: `${format(ast)} simplified, ${variables.length} variable${variables.length === 1 ? '' : 's'}`,
			href: link('/boolean-algebra-calculator', { expr }),
			tool: '/boolean-algebra-calculator'
		},
		{
			title: 'Truth table',
			action: true,
			hint: `${2 ** variables.length} rows for ${variables.join(', ')}`,
			href: link('/truth-table-generator', { expr }),
			tool: '/truth-table-generator'
		}
	];
	if (variables.length >= 2) {
		answers.push({
			title: 'Karnaugh map',
			action: true,
			hint: 'With the groups drawn',
			href: link('/karnaugh-map-solver', { expr }),
			tool: '/karnaugh-map-solver'
		});
	}
	answers.push({
		title: 'Circuit diagram',
		action: true,
		hint: 'The expression drawn as gates',
		href: link('/logic-circuit-generator', { expr }),
		tool: '/logic-circuit-generator'
	});
	return answers;
}

// --- The dispatcher -----------------------------------------------------------------

const attempt = (fn: () => Answer[] | Answer | null): Answer[] => {
	try {
		const result = fn();
		return result === null ? [] : Array.isArray(result) ? result : [result];
	} catch {
		return [];
	}
};

/** Short names that are valid hex but are meant as words. */
const NOT_HEX = new Set(['bf16', '2fa', 'b64']);

/**
 * A whole number: its binary, plus what else a number that long usually is.
 * The likelier reading comes first: an 18 digit number is far more often a
 * Discord ID than something to see in binary, and 2147483647 is int32's limit.
 */
function integerAnswers(text: string): Answer[] {
	const digits = text.replace('-', '');
	if (digits.length > 40) return [];
	const front: Answer[] = [];
	const back: Answer[] = [];
	for (const limit of attempt(() => limitAnswer(text))) (BigInt(digits) > 255n ? front : back).push(limit);
	if (text.startsWith('-')) return front.concat(back);
	if (digits.length >= 17 && digits.length <= 20) front.push(...attempt(() => snowflakeAnswer(text)));
	if ([8, 12, 13].includes(digits.length)) {
		for (const ean of attempt(() => eanAnswer(text))) (ean.title === 'A valid EAN-13' ? front : back).push(ean);
	}
	const base = digits.length <= 19 ? attempt(() => decimalAnswers(text)) : [];
	return [...front, ...base, ...back].slice(0, MAX_ANSWERS);
}

export function answers(query: string): Answer[] {
	const text = query.trim();
	if (!text || text.length > 200) return [];

	const quoted = text.match(/^["'“‘](.+)["'”’]$/u);
	if (quoted) return attempt(() => quotedAnswers(quoted[1])).slice(0, MAX_ANSWERS);

	// Addresses and IDs first: their dots, colons and dashes would otherwise be
	// read as a float, a sum or a logic statement.
	if (/^\d{1,3}(\.\d{1,3}){3}(\s*\/\s*\d{1,2}|\s+\d{1,3}(\.\d{1,3}){3})?$/.test(text)) {
		return attempt(() => ipv4Answer(text));
	}
	if (text.includes(':')) {
		const v6 = attempt(() => ipv6Answer(text));
		if (v6.length) return v6;
	}
	if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(text)) {
		return attempt(() => idAnswer(text, false));
	}
	// A ULID is 26 Crockford Base32 characters; a letter and a digit keep plain
	// words and long numbers out.
	if (/^[0-7][0-9a-hjkmnp-tv-z]{25}$/i.test(text) && /[a-z]/i.test(text) && /\d.*\d/.test(text)) {
		return attempt(() => idAnswer(text, true));
	}

	// "v" between two letters is logic notation's OR, which the boolean engine
	// would read as a variable.
	if (PROP.test(text) || /\S\s+[vV]\s+\S/.test(text)) return attempt(() => propositionAnswers(text));
	// Before the arithmetic, so 1e-3 is a number rather than hex 1E minus 3.
	if (/^-?(\d+\.\d*|\.\d+|\d+(\.\d*)?e[+-]?\d+)$/i.test(text)) return attempt(() => floatAnswers(text));

	const binaryOp = text.match(/^(?:0b)?([01]+)\s*([+\-−*×/÷])\s*(?:0b)?([01]+)$/i);
	if (binaryOp && (/0b/i.test(text) || (binaryOp[1].length > 1 && binaryOp[3].length > 1))) {
		const [, a, sign, b] = binaryOp;
		return attempt(() => arithmeticAnswer(a, sign, b, 2));
	}
	const hexOp = text.match(/^(?:0x)?([0-9a-f]+)\s*([+\-−*×/÷])\s*(?:0x)?([0-9a-f]+)$/i);
	if (hexOp && (/0x/i.test(text) || /[a-f]/i.test(`${hexOp[1]}${hexOp[3]}`))) {
		const [, a, sign, b] = hexOp;
		return attempt(() => arithmeticAnswer(a, sign, b, 16));
	}
	const binary = text.match(/^0b([01]{1,64})$/i);
	if (binary) return attempt(() => binaryAnswer(binary[1]));
	const hex = text.match(/^(?:0x|#)([0-9a-f]{1,16})$/i);
	if (hex) return attempt(() => hexAnswers(hex[1]));
	// Bare hex needs a digit and a letter, so "beef" and "add" stay words, and
	// a few terms that happen to be hex digits are searches too.
	if (/^[0-9a-f]{1,16}$/i.test(text) && /[0-9]/.test(text) && /[a-f]/i.test(text)) {
		if (NOT_HEX.has(text.toLowerCase())) return [];
		return attempt(() => hexAnswers(text));
	}
	if (/^-?\d+$/.test(text)) return integerAnswers(text);
	if (/^[A-Za-z0-9+/_-]{6,}={0,2}$/.test(text)) {
		const found = attempt(() => base64Answer(text));
		if (found.length) return found;
	}
	return attempt(() => booleanAnswers(text)).slice(0, MAX_ANSWERS);
}
