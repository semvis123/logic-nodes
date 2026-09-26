// Text as bytes: UTF-8 with every character broken down to its bits, binary,
// hex and decimal byte lists read back into text with the position of any
// mistake, the 128 codes of ASCII with their names, and Base64 as the
// regrouping of 8-bit bytes into 6-bit indexes it really is.
//
// Deliberately dependency free and written out by hand rather than leaning on
// TextEncoder or btoa, so each step can be shown; the test suite checks the
// results against TextEncoder and Node's Buffer.

export class EncodingError extends Error {}

// --- UTF-8 ----------------------------------------------------------------

/** One byte, in every base a page shows, with the bits split by role. */
export type ByteInfo = {
	value: number;
	binary: string;
	hex: string;
	/**
	 * The fixed marker bits: 0 for a one-byte character, 110, 1110 or 11110 at
	 * the start of a longer one, and 10 on each byte that continues it.
	 */
	prefix: string;
	/** The bits that carry the code point. */
	payload: string;
};

export type CharInfo = {
	/** The character as a string, which can be two UTF-16 units for an emoji. */
	char: string;
	codePoint: number;
	/** U+0048 style. */
	label: string;
	bytes: ByteInfo[];
	/** Where the character's first byte sits in the whole byte list, from 0. */
	offset: number;
	/** A lone surrogate cannot be encoded; like TextEncoder, it becomes U+FFFD. */
	replaced: boolean;
};

/** The four lengths of a UTF-8 sequence and the code points each can hold. */
export const UTF8_RANGES = [
	{ bytes: 1, first: 0x0000, last: 0x007f, payloadBits: 7, pattern: '0xxxxxxx' },
	{ bytes: 2, first: 0x0080, last: 0x07ff, payloadBits: 11, pattern: '110xxxxx 10xxxxxx' },
	{ bytes: 3, first: 0x0800, last: 0xffff, payloadBits: 16, pattern: '1110xxxx 10xxxxxx 10xxxxxx' },
	{ bytes: 4, first: 0x10000, last: 0x10ffff, payloadBits: 21, pattern: '11110xxx 10xxxxxx 10xxxxxx 10xxxxxx' }
] as const;

const LEAD_PREFIX = ['0', '110', '1110', '11110'];

export const bin8 = (value: number) => value.toString(2).padStart(8, '0');
export const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');
export const codePointLabel = (cp: number) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

function byteInfo(value: number, prefix: string): ByteInfo {
	const binary = bin8(value);
	return { value, binary, hex: hex2(value), prefix, payload: binary.slice(prefix.length) };
}

const isSurrogate = (cp: number) => cp >= 0xd800 && cp <= 0xdfff;

/** How many bytes UTF-8 needs for a code point. */
export function utf8Length(cp: number): 1 | 2 | 3 | 4 {
	if (cp < 0 || cp > 0x10ffff) throw new EncodingError(`${codePointLabel(cp)} is beyond the last code point, U+10FFFF`);
	return UTF8_RANGES.find((r) => cp <= r.last)!.bytes;
}

/**
 * The UTF-8 bytes of one code point: the code point's bits are cut into
 * pieces from the right, six per continuation byte, and the rest go in the
 * lead byte after its length marker.
 */
export function utf8Bytes(cp: number): ByteInfo[] {
	const length = utf8Length(cp);
	if (length === 1) return [byteInfo(cp, '0')];
	const bits = cp.toString(2).padStart(UTF8_RANGES[length - 1].payloadBits, '0');
	const leadBits = bits.length - 6 * (length - 1);
	const out = [byteInfo(parseInt(LEAD_PREFIX[length - 1] + bits.slice(0, leadBits), 2), LEAD_PREFIX[length - 1])];
	for (let i = leadBits; i < bits.length; i += 6) out.push(byteInfo(parseInt('10' + bits.slice(i, i + 6), 2), '10'));
	return out;
}

/** Every character of a string with its code point and UTF-8 bytes. */
export function encodeText(text: string): CharInfo[] {
	const out: CharInfo[] = [];
	let offset = 0;
	for (const char of text) {
		const raw = char.codePointAt(0)!;
		const replaced = isSurrogate(raw);
		const codePoint = replaced ? 0xfffd : raw;
		const bytes = utf8Bytes(codePoint);
		out.push({ char, codePoint, label: codePointLabel(codePoint), bytes, offset, replaced });
		offset += bytes.length;
	}
	return out;
}

/** The UTF-8 bytes of a string, as TextEncoder would give them. */
export const textToBytes = (text: string): number[] => encodeText(text).flatMap((c) => c.bytes.map((b) => b.value));

/** How a byte that is not a lead byte, or a sequence that is not allowed, is described. */
const describe = (bytes: number[], i: number) => `byte ${i + 1} (${bin8(bytes[i])})`;

/**
 * Reads UTF-8 bytes back into characters, and refuses anything that is not
 * valid UTF-8 with the position of the first bad byte, since a translator
 * that silently prints a replacement character hides the mistake.
 */
export function decodeUtf8(bytes: number[]): { text: string; chars: CharInfo[] } {
	const chars: CharInfo[] = [];
	let i = 0;
	while (i < bytes.length) {
		const lead = bytes[i];
		if (!Number.isInteger(lead) || lead < 0 || lead > 255) throw new EncodingError(`Byte ${i + 1} is not a byte`);
		let length: number;
		if (lead < 0x80) length = 1;
		else if (lead >= 0xc2 && lead <= 0xdf) length = 2;
		else if (lead >= 0xe0 && lead <= 0xef) length = 3;
		else if (lead >= 0xf0 && lead <= 0xf4) length = 4;
		else if (lead < 0xc0)
			throw new EncodingError(
				`${cap(
					describe(bytes, i)
				)} starts with 10, which marks the middle of a character, but no character started before it.`
			);
		else if (lead === 0xc0 || lead === 0xc1)
			throw new EncodingError(
				`${cap(describe(bytes, i))} would start an overlong character: anything it could encode fits in one byte.`
			);
		else
			throw new EncodingError(
				`${cap(describe(bytes, i))} never appears in UTF-8: the byte values F5 to FF are not used.`
			);

		if (i + length > bytes.length)
			throw new EncodingError(
				`${cap(describe(bytes, i))} starts a ${length}-byte character, but the input ends after ${
					bytes.length - i === 1 ? 'it' : `${bytes.length - i} bytes`
				}.`
			);
		let cp = length === 1 ? lead : lead & (0xff >> (length + 1));
		for (let k = 1; k < length; k++) {
			const next = bytes[i + k];
			if ((next & 0xc0) !== 0x80)
				throw new EncodingError(
					`${cap(describe(bytes, i))} starts a ${length}-byte character, but ${describe(
						bytes,
						i + k
					)} does not start with 10 as each following byte must.`
				);
			cp = (cp << 6) | (next & 0x3f);
		}
		if (length > 1 && cp < UTF8_RANGES[length - 1].first)
			throw new EncodingError(
				`Bytes ${i + 1} to ${i + length} are an overlong encoding of ${codePointLabel(cp)}, which must use fewer bytes.`
			);
		if (isSurrogate(cp))
			throw new EncodingError(
				`Bytes ${i + 1} to ${i + length} encode ${codePointLabel(cp)}, a surrogate, which UTF-8 does not allow.`
			);
		if (cp > 0x10ffff)
			throw new EncodingError(`Bytes ${i + 1} to ${i + length} encode a value beyond U+10FFFF, the last code point.`);
		chars.push({
			char: String.fromCodePoint(cp),
			codePoint: cp,
			label: codePointLabel(cp),
			bytes: utf8Bytes(cp),
			offset: i,
			replaced: false
		});
		i += length;
	}
	return { text: chars.map((c) => c.char).join(''), chars };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// --- byte lists as text ------------------------------------------------------

export type ByteFormat = 'binary' | 'hex' | 'decimal';

export type ParsedBytes = {
	bytes: number[];
	/** Set when 7-bit groups were read as ASCII by adding the missing leading 0. */
	sevenBit: boolean;
};

const MAX_INPUT_BYTES = 100_000;

/**
 * Reads binary as bytes. Groups can be separated by spaces, commas or new
 * lines, or run together when the total is a multiple of 8. Every group must
 * be 8 bits, except that a message written entirely in 7-bit groups is read
 * as ASCII, which is what several older translators produce.
 */
export function parseBinary(input: string): ParsedBytes {
	const trimmed = input.trim();
	if (!trimmed) return { bytes: [], sevenBit: false };
	const bad = trimmed.match(/[^01\s,]/);
	if (bad) {
		const at = trimmed.indexOf(bad[0]);
		throw new EncodingError(`"${bad[0]}" at character ${at + 1} is not a binary digit. Binary uses only 0 and 1.`);
	}
	const groups = trimmed.split(/[\s,]+/).filter(Boolean);
	if (groups.length === 1) {
		const run = groups[0];
		if (run.length % 8 === 0) return { bytes: chunk(run, 8).map((g) => parseInt(g, 2)), sevenBit: false };
		if (run.length === 7) return { bytes: [parseInt(run, 2)], sevenBit: true };
		throw new EncodingError(
			`${
				run.length
			} bits is not a whole number of bytes. Without spaces the bits are read 8 at a time, so the length must be a multiple of 8 (the nearest are ${
				Math.floor(run.length / 8) * 8 || 8
			} and ${Math.ceil(run.length / 8) * 8}).`
		);
	}
	if (groups.every((g) => g.length === 7)) return { bytes: groups.map((g) => parseInt(g, 2)), sevenBit: true };
	const wrong = groups.findIndex((g) => g.length !== 8);
	if (wrong >= 0) {
		const g = groups[wrong];
		throw new EncodingError(
			`Group ${wrong + 1} (${g}) has ${g.length} bit${g.length === 1 ? '' : 's'}; each byte needs exactly 8.${
				g.length < 8 ? ' Add leading zeros if the bits are right.' : ''
			}`
		);
	}
	if (groups.length > MAX_INPUT_BYTES) throw new EncodingError('That is too long to translate here.');
	return { bytes: groups.map((g) => parseInt(g, 2)), sevenBit: false };
}

/** Reads hex bytes: 48 69, 4869, 0x48 0x69 or \x48\x69. */
export function parseHex(input: string): ParsedBytes {
	const cleaned = input.trim().replace(/0x|\\x/gi, ' ');
	if (!cleaned.trim()) return { bytes: [], sevenBit: false };
	const bad = cleaned.match(/[^0-9a-f\s,:]/i);
	if (bad) throw new EncodingError(`"${bad[0]}" is not a hex digit. Hex uses 0 to 9 and A to F.`);
	const groups = cleaned.split(/[\s,:]+/).filter(Boolean);
	const bytes: number[] = [];
	for (const [n, g] of groups.entries()) {
		if (groups.length > 1 && g.length === 1) {
			bytes.push(parseInt(g, 16));
			continue;
		}
		if (g.length % 2)
			throw new EncodingError(
				`Group ${n + 1} (${g}) has ${g.length} hex digits. Each byte is two, so the count must be even.`
			);
		bytes.push(...chunk(g, 2).map((pair) => parseInt(pair, 16)));
	}
	return { bytes, sevenBit: false };
}

/** Reads decimal byte values, 0 to 255, separated by spaces or commas. */
export function parseDecimal(input: string): ParsedBytes {
	const trimmed = input.trim();
	if (!trimmed) return { bytes: [], sevenBit: false };
	const groups = trimmed.split(/[\s,;]+/).filter(Boolean);
	const bytes = groups.map((g, n) => {
		if (!/^\d+$/.test(g)) throw new EncodingError(`"${g}" (number ${n + 1}) is not a whole number.`);
		const value = Number(g);
		if (value > 255)
			throw new EncodingError(
				`${g} (number ${
					n + 1
				}) is more than 255, the largest value a byte can hold. A character above 127 is several bytes in UTF-8.`
			);
		return value;
	});
	return { bytes, sevenBit: false };
}

export const parseBytes = (input: string, format: ByteFormat): ParsedBytes =>
	format === 'binary' ? parseBinary(input) : format === 'hex' ? parseHex(input) : parseDecimal(input);

/** Writes bytes as binary, hex or decimal. Binary can drop the leading zeros of each byte. */
export function formatBytes(bytes: number[], format: ByteFormat, separator = ' ', padded = true): string {
	return bytes
		.map((b) => (format === 'binary' ? (padded ? bin8(b) : b.toString(2)) : format === 'hex' ? hex2(b) : String(b)))
		.join(separator);
}

function chunk(s: string, size: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
	return out;
}

/** The place values of a byte's bits and the ones that add up to its value. */
export function placeValues(value: number) {
	const bits = bin8(value).split('').map(Number);
	const weights = bits.map((_, i) => 2 ** (7 - i));
	const terms = weights.filter((_, i) => bits[i] === 1);
	return { bits, weights, terms, sum: terms.reduce((a, b) => a + b, 0) };
}

// --- ASCII -----------------------------------------------------------------

export type AsciiKind = 'control' | 'space' | 'digit' | 'upper' | 'lower' | 'symbol';

export type AsciiRow = {
	code: number;
	hex: string;
	/** Seven bits, which is all ASCII uses; the byte adds a leading 0. */
	binary: string;
	octal: string;
	/** The character itself, or its abbreviation for a control code. */
	char: string;
	/** NUL, LF and so on for the control codes and space. */
	abbr?: string;
	name: string;
	/** What a control code is or was used for. */
	use?: string;
	/** How it is typed as a caret sequence (^J) or escape (\n), where it has one. */
	caret?: string;
	escape?: string;
	/**
	 * The HTML numeric character reference, &#65;, for the printable characters
	 * and the tab and line feed. HTML treats a reference to any other control
	 * code as an error (and &#0; becomes U+FFFD), so those have none.
	 */
	entity?: string;
	/** The HTML named character reference, &amp;, for the printable characters that have one. */
	named?: string;
	kind: AsciiKind;
};

const CONTROLS: [string, string, string?][] = [
	['NUL', 'null', 'Does nothing. C and many languages use it to mark the end of a string.'],
	['SOH', 'start of heading', 'Marked the start of a message header in early data links.'],
	['STX', 'start of text', 'Marked where the header ended and the message text began.'],
	['ETX', 'end of text', 'Ended the message text. Ctrl+C sends it, which is why Ctrl+C interrupts a program.'],
	['EOT', 'end of transmission', 'Ended a transmission. Ctrl+D sends it, which ends input in a Unix terminal.'],
	['ENQ', 'enquiry', 'Asked the other end to identify itself or report its status.'],
	['ACK', 'acknowledge', 'Confirmed that a message arrived intact.'],
	['BEL', 'bell', 'Rang the bell on a teleprinter; terminals beep or flash.'],
	['BS', 'backspace', 'Moves the cursor back one position.'],
	['HT', 'horizontal tab', 'The tab character, moving to the next tab stop.'],
	['LF', 'line feed', 'Moves down one line. Unix, Linux and macOS end each line of text with it.'],
	['VT', 'vertical tab', 'Moved down to the next vertical tab stop on a printer.'],
	['FF', 'form feed', 'Moved a printer to the top of the next page.'],
	['CR', 'carriage return', 'Moves back to the start of the line. Windows ends lines with CR then LF.'],
	['SO', 'shift out', 'Switched to an alternative character set.'],
	['SI', 'shift in', 'Switched back to the standard character set.'],
	['DLE', 'data link escape', 'Made the next characters be read as data rather than control codes.'],
	['DC1', 'device control 1', 'Known as XON: tells the sender to resume. Ctrl+Q in a terminal.'],
	['DC2', 'device control 2', 'A control code left for devices to define.'],
	['DC3', 'device control 3', 'Known as XOFF: tells the sender to pause. Ctrl+S in a terminal.'],
	['DC4', 'device control 4', 'A control code left for devices to define.'],
	['NAK', 'negative acknowledge', 'Reported that a message arrived damaged, asking for it again.'],
	['SYN', 'synchronous idle', 'Sent when there was nothing else, to keep a synchronous link in step.'],
	['ETB', 'end of transmission block', 'Ended one block of a longer transmission.'],
	['CAN', 'cancel', 'Said that the data just sent was in error and should be ignored.'],
	['EM', 'end of medium', 'Marked the physical end of a tape or card deck.'],
	['SUB', 'substitute', 'Stands in for a character that was invalid. Ctrl+Z, end of file in old DOS text.'],
	['ESC', 'escape', 'Starts an escape sequence, how terminals are told to move the cursor or change colour.'],
	['FS', 'file separator', 'The largest of four separators for structured data.'],
	['GS', 'group separator', 'Separates groups within a file.'],
	['RS', 'record separator', 'Separates records within a group.'],
	['US', 'unit separator', 'Separates fields within a record, the smallest unit.']
];

const SYMBOL_NAMES: Record<string, string> = {
	'!': 'exclamation mark',
	'"': 'double quotation mark',
	'#': 'number sign, hash',
	$: 'dollar sign',
	'%': 'percent sign',
	'&': 'ampersand',
	"'": 'apostrophe, single quote',
	'(': 'left parenthesis',
	')': 'right parenthesis',
	'*': 'asterisk',
	'+': 'plus sign',
	',': 'comma',
	'-': 'hyphen, minus',
	'.': 'full stop, period',
	'/': 'slash',
	':': 'colon',
	';': 'semicolon',
	'<': 'less-than sign',
	'=': 'equals sign',
	'>': 'greater-than sign',
	'?': 'question mark',
	'@': 'at sign',
	'[': 'left square bracket',
	'\\': 'backslash',
	']': 'right square bracket',
	'^': 'caret, circumflex',
	_: 'underscore',
	'`': 'grave accent, backtick',
	'{': 'left curly brace',
	'|': 'vertical bar, pipe',
	'}': 'right curly brace',
	'~': 'tilde'
};

/**
 * HTML's named references for printable ASCII (from the HTML Living Standard's
 * list). Only &amp; &lt; &gt; &quot; and &apos; also work in XML and old HTML;
 * the rest arrived with HTML5. The tests parse every one in a browser.
 */
const NAMED_ENTITIES: Record<string, string> = {
	'!': 'excl',
	'"': 'quot',
	'#': 'num',
	$: 'dollar',
	'%': 'percnt',
	'&': 'amp',
	"'": 'apos',
	'(': 'lpar',
	')': 'rpar',
	'*': 'ast',
	'+': 'plus',
	',': 'comma',
	'.': 'period',
	'/': 'sol',
	':': 'colon',
	';': 'semi',
	'<': 'lt',
	'=': 'equals',
	'>': 'gt',
	'?': 'quest',
	'@': 'commat',
	'[': 'lsqb',
	'\\': 'bsol',
	']': 'rsqb',
	'^': 'Hat',
	_: 'lowbar',
	'`': 'grave',
	'{': 'lcub',
	'|': 'verbar',
	'}': 'rcub'
};

/** The five references that work everywhere: XML, XHTML and every HTML version. */
export const CORE_ENTITIES = ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;'];

const ESCAPES: Record<number, string> = {
	0: '\\0',
	7: '\\a',
	8: '\\b',
	9: '\\t',
	10: '\\n',
	11: '\\v',
	12: '\\f',
	13: '\\r',
	27: '\\e'
};

function asciiRow(code: number): AsciiRow {
	const base = {
		code,
		hex: hex2(code),
		binary: code.toString(2).padStart(7, '0'),
		octal: code.toString(8).padStart(3, '0'),
		escape: ESCAPES[code],
		entity: (code >= 32 && code < 127) || code === 9 || code === 10 ? `&#${code};` : undefined
	};
	if (code < 32) {
		const [abbr, name, use] = CONTROLS[code];
		return { ...base, char: abbr, abbr, name, use, caret: '^' + String.fromCharCode(code + 64), kind: 'control' };
	}
	if (code === 127)
		return {
			...base,
			char: 'DEL',
			abbr: 'DEL',
			name: 'delete',
			use: 'All seven holes punched: on paper tape it erased whatever character had been there.',
			caret: '^?',
			kind: 'control'
		};
	const char = String.fromCharCode(code);
	if (code === 32) return { ...base, char: ' ', abbr: 'SP', name: 'space', kind: 'space' };
	if (code >= 48 && code <= 57) return { ...base, char, name: `digit ${char}`, kind: 'digit' };
	if (code >= 65 && code <= 90) return { ...base, char, name: `capital ${char}`, kind: 'upper' };
	if (code >= 97 && code <= 122) return { ...base, char, name: `small ${char}`, kind: 'lower' };
	const named = NAMED_ENTITIES[char] ? `&${NAMED_ENTITIES[char]};` : undefined;
	return { ...base, char, name: SYMBOL_NAMES[char], named, kind: 'symbol' };
}

/** All 128 ASCII codes, in order. */
export const asciiTable = (): AsciiRow[] => Array.from({ length: 128 }, (_, code) => asciiRow(code));

/** The four blocks of 32 that the top two of the seven bits select. */
export function asciiBlocks() {
	const rows = asciiTable();
	const summary = [
		'Control codes',
		'Space, punctuation and the digits',
		'@, the capital letters and [ \\ ] ^ _',
		'`, the small letters, { | } ~ and DEL'
	];
	return [0, 1, 2, 3].map((block) => ({
		topBits: block.toString(2).padStart(2, '0'),
		first: block * 32,
		last: block * 32 + 31,
		contains: summary[block],
		rows: rows.slice(block * 32, block * 32 + 32)
	}));
}

// --- Extended ASCII ----------------------------------------------------------

/**
 * Code page 437, the original IBM PC character set, bytes 128 to 255 in order.
 * Checked in rather than decoded, since browsers do not ship this code page. It
 * matches Unicode's mapping file CP437.TXT (the source of Python's cp437 codec);
 * the tests check anchors and that it has 128 distinct characters.
 */
export const CP437_HIGH =
	'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';

export type ExtendedRow = {
	code: number;
	hex: string;
	binary: string;
	/** The Windows-1252 character, or null for the five bytes it leaves unassigned. */
	win1252: string | null;
	cp437: string;
};

/** Windows-1252 decoded by the platform's own TextDecoder, which follows the WHATWG Encoding Standard. */
function decode1252(code: number): string | null {
	const char = new TextDecoder('windows-1252').decode(new Uint8Array([code]));
	const cp = char.codePointAt(0)!;
	// The standard maps the five unassigned bytes to the C1 controls of the same number.
	return cp >= 0x80 && cp <= 0x9f ? null : char;
}

/** Bytes 128 to 255 in the two most common 8-bit sets called extended ASCII. */
export function extendedAsciiTable(): ExtendedRow[] {
	const cp437 = [...CP437_HIGH];
	return Array.from({ length: 128 }, (_, i) => {
		const code = 128 + i;
		return { code, hex: hex2(code), binary: bin8(code), win1252: decode1252(code), cp437: cp437[i] };
	});
}

// --- Base64 -----------------------------------------------------------------

export const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export type Base64Options = { urlSafe?: boolean; pad?: boolean };

/** One group of up to 3 bytes and the up to 4 characters it becomes. */
export type Base64Group = {
	bytes: number[];
	/** The bytes' bits, followed by the zero bits added to fill the last 6-bit index. */
	bits: string;
	/** How many of those bits were added as zeros, 0, 2 or 4. */
	fillBits: number;
	/** The 6-bit indexes: 4 for a full group, 3 for 2 bytes, 2 for 1 byte. */
	sextets: string[];
	indexes: number[];
	/** The characters, followed by any = padding. */
	chars: string[];
	padding: number;
};

function group(bytes: number[], alphabet: string, pad: boolean): Base64Group {
	const byteBits = bytes.map(bin8).join('');
	const count = Math.ceil(byteBits.length / 6);
	const fillBits = count * 6 - byteBits.length;
	const bits = byteBits + '0'.repeat(fillBits);
	const sextets = chunk(bits, 6);
	const indexes = sextets.map((s) => parseInt(s, 2));
	const padding = 4 - count;
	const chars = indexes.map((i) => alphabet[i]);
	if (pad) for (let k = 0; k < padding; k++) chars.push('=');
	return { bytes, bits, fillBits, sextets, indexes, chars, padding };
}

/** Encodes bytes as Base64, keeping each 3-byte group so it can be shown. */
export function base64Encode(bytes: number[], options: Base64Options = {}): { text: string; groups: Base64Group[] } {
	const alphabet = options.urlSafe ? BASE64URL_ALPHABET : BASE64_ALPHABET;
	const pad = options.pad ?? true;
	const groups: Base64Group[] = [];
	for (let i = 0; i < bytes.length; i += 3) groups.push(group(bytes.slice(i, i + 3), alphabet, pad));
	return { text: groups.map((g) => g.chars.join('')).join(''), groups };
}

export const base64EncodeText = (text: string, options: Base64Options = {}) => base64Encode(textToBytes(text), options);

export type Base64Decoded = {
	bytes: number[];
	groups: Base64Group[];
	/** Which alphabet the input used; standard when it could be either. */
	variant: 'standard' | 'url';
	/** Things that were accepted but worth saying, such as missing padding. */
	notes: string[];
};

/**
 * Decodes Base64 in either alphabet. White space is ignored, since Base64 in
 * email and PEM files is wrapped at 64 or 76 characters, and missing padding is
 * accepted, as URL-safe Base64 usually leaves it off. Everything else that
 * cannot be Base64 is refused with its position.
 */
export function base64Decode(input: string): Base64Decoded {
	const notes: string[] = [];
	const clean = input.replace(/\s+/g, '');
	if (/\s/.test(input.trim())) notes.push('Spaces and line breaks were ignored.');
	const badAt = clean.search(/[^A-Za-z0-9+/\-_=]/);
	if (badAt >= 0) {
		const ch = clean[badAt];
		throw new EncodingError(
			`"${ch}" (character ${
				badAt + 1
			}, not counting spaces) is not in the Base64 alphabet: A–Z, a–z, 0–9, + and / (or - and _ in URL-safe Base64), with = only as padding at the end.`
		);
	}
	const standard = /[+/]/.test(clean);
	const url = /[-_]/.test(clean);
	if (standard && url)
		throw new EncodingError(
			'The input mixes the standard alphabet (+ and /) with the URL-safe one (- and _). It must use one or the other.'
		);
	const variant = url ? 'url' : 'standard';
	const firstPad = clean.indexOf('=');
	let body = clean;
	let padding = 0;
	if (firstPad >= 0) {
		body = clean.slice(0, firstPad);
		const tail = clean.slice(firstPad);
		if (!/^=+$/.test(tail))
			throw new EncodingError(
				`Padding (=) can only come at the very end, but character ${firstPad + 1} is = and more data follows it.`
			);
		padding = tail.length;
		if (padding > 2) throw new EncodingError(`There are ${padding} = signs; Base64 never needs more than two.`);
	}
	const leftover = body.length % 4;
	if (leftover === 1)
		throw new EncodingError(
			`${body.length} characters leaves one character over after the groups of four, and one character is only 6 bits, not enough for a byte. A character is probably missing or extra.`
		);
	const needed = leftover === 0 ? 0 : 4 - leftover;
	if (padding && padding !== needed)
		throw new EncodingError(
			needed === 0
				? `The data is a whole number of 4-character groups, so it needs no padding, but ends with ${padding} = sign${
						padding > 1 ? 's' : ''
				  }.`
				: `The last group has ${leftover} characters, so it needs ${needed} = sign${
						needed > 1 ? 's' : ''
				  }, not ${padding}.`
		);
	if (!padding && needed)
		notes.push(`The padding was missing; the last group is read as if it ended in ${'='.repeat(needed)}.`);

	const alphabet = variant === 'url' ? BASE64URL_ALPHABET : BASE64_ALPHABET;
	const groups: Base64Group[] = [];
	const bytes: number[] = [];
	for (let i = 0; i < body.length; i += 4) {
		const chars = body.slice(i, i + 4).split('');
		const indexes = chars.map((c) => alphabet.indexOf(c));
		const sextets = indexes.map((n) => n.toString(2).padStart(6, '0'));
		const bits = sextets.join('');
		const byteCount = Math.floor(bits.length / 8);
		const fillBits = bits.length - byteCount * 8;
		const groupBytes = chunk(bits.slice(0, byteCount * 8), 8).map((b) => parseInt(b, 2));
		if (fillBits && /1/.test(bits.slice(byteCount * 8)))
			notes.push(
				`The last character, ${
					chars[chars.length - 1]
				}, has 1s in its final ${fillBits} bits, which an encoder always leaves as 0. They were ignored, but the input may have been altered.`
			);
		const groupPadding = 4 - chars.length;
		groups.push({
			bytes: groupBytes,
			bits,
			fillBits,
			sextets,
			indexes,
			chars: [...chars, ...Array(padding && i + 4 >= body.length ? groupPadding : 0).fill('=')],
			padding: groupPadding
		});
		bytes.push(...groupBytes);
	}
	return { bytes, groups, variant, notes };
}

/** The encoded length for n bytes: 4 characters per started group of 3. */
export const base64Length = (bytes: number, pad = true) =>
	pad ? 4 * Math.ceil(bytes / 3) : Math.ceil((bytes * 8) / 6);
