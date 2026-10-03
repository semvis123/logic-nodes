// File signatures, the "magic numbers" at the start of a file that say what it
// really is, whatever its name claims. Each format below is described once, as
// data: the bytes, where they sit and what they mean. The same data drives the
// detector, the highlighted hex dump and the reference table on the page, so
// the published table cannot disagree with what the checker does.
//
// Most formats are settled by a few fixed bytes at offset 0. The interesting
// ones need a second look: ZIP is the container for DOCX, EPUB, JAR and APK, so
// the entry names decide; MP4, MOV, HEIC and AVIF share the ftyp box and differ
// by brand; CAFEBABE starts both Java class files and Mach-O universal binaries.
// Text formats have no signature at all and are only ever a good guess.

import { hex2 } from './textEncoding.js';

export { hex2 };

export class HexError extends Error {}

/** Bytes read from the start of a file: enough to reach ISO 9660's CD001 at 0x8001. */
export const HEAD_BYTES = 0x9000;
/** Bytes read from the end: a ZIP's end record (22 bytes) behind the longest possible comment. */
export const TAIL_BYTES = 22 + 0xffff;

// --- Reading bytes ---------------------------------------------------------

/**
 * The parts of a file that were read: its start and its end. A pasted hex
 * string is a whole file, so both are the same bytes. Anything in between is
 * unknown, and every reader says so with undefined rather than guessing.
 */
export class ByteView {
	readonly head: Uint8Array;
	readonly size: number;
	readonly tail: Uint8Array;
	readonly tailStart: number;
	constructor(head: Uint8Array, size: number, tail: Uint8Array = head) {
		this.head = head;
		this.size = size;
		this.tail = tail;
		this.tailStart = size - tail.length;
	}

	/** True when the head and tail between them hold every byte of the file. */
	get complete(): boolean {
		return this.tailStart <= this.head.length;
	}

	at(i: number): number | undefined {
		if (!Number.isInteger(i) || i < 0 || i >= this.size) return undefined;
		if (i < this.head.length) return this.head[i];
		if (i >= this.tailStart) return this.tail[i - this.tailStart];
		return undefined;
	}

	has(start: number, length: number): boolean {
		if (start < 0 || length < 0 || start + length > this.size) return false;
		const end = start + length;
		return end <= this.head.length || start >= this.tailStart || this.complete;
	}

	bytes(start: number, length: number): number[] | null {
		if (!this.has(start, length)) return null;
		const out: number[] = [];
		for (let i = 0; i < length; i++) out.push(this.at(start + i) as number);
		return out;
	}

	u16(i: number, little: boolean): number | undefined {
		const b = this.bytes(i, 2);
		if (!b) return undefined;
		return little ? b[0] | (b[1] << 8) : (b[0] << 8) | b[1];
	}

	u32(i: number, little: boolean): number | undefined {
		const b = this.bytes(i, 4);
		if (!b) return undefined;
		const [p, q, r, s] = little ? [b[3], b[2], b[1], b[0]] : b;
		return ((p << 24) | (q << 16) | (r << 8) | s) >>> 0;
	}

	/** The bytes as Latin-1 characters, one per byte, or null when they were not read. */
	text(i: number, length: number): string | null {
		const b = this.bytes(i, length);
		return b ? String.fromCharCode(...b) : null;
	}

	/** Like text, but stops at the first NUL and at the end of what was read. */
	cString(i: number, max: number): string {
		let out = '';
		for (let k = 0; k < max; k++) {
			const b = this.at(i + k);
			if (b === undefined || b === 0) break;
			out += String.fromCharCode(b);
		}
		return out;
	}

	/** The first offset in [from, to) where the needle starts, or -1. */
	find(needle: number[], from = 0, to = this.size): number {
		const last = Math.min(to, this.size) - needle.length;
		outer: for (let i = Math.max(0, from); i <= last; i++) {
			for (let k = 0; k < needle.length; k++) if (this.at(i + k) !== needle[k]) continue outer;
			return i;
		}
		return -1;
	}
}

export const fromBytes = (bytes: Uint8Array | number[]): ByteView => {
	const array = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
	return new ByteView(array, array.length);
};

export const hexOffset = (n: number) =>
	'0x' +
	n
		.toString(16)
		.toUpperCase()
		.padStart(n > 0xffff ? 8 : 4, '0');
export const formatBytes = (bytes: ArrayLike<number>) => Array.from(bytes, hex2).join(' ');
const latin1Bytes = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/** Hex as a person would paste it: 16 bytes to a line. */
export function formatHexLines(bytes: ArrayLike<number>, perLine = 16): string {
	const all = Array.from(bytes, hex2);
	const lines: string[] = [];
	for (let i = 0; i < all.length; i += perLine) lines.push(all.slice(i, i + perLine).join(' '));
	return lines.join('\n');
}

/**
 * Takes the offset column (and the text column) off a pasted hex dump, so the
 * output of od -A x -t x1, hexdump -C or xxd can be pasted as it is. Without
 * this, od's "000000" offset would quietly become three zero bytes. It only
 * acts when every line looks like a dump line: an offset of six or more
 * digits, then byte groups, with the offsets going up. Dumps of 16-bit words
 * (plain hexdump, od -x) are left alone, because their byte order is the
 * machine's, not the file's.
 */
const DUMP_LINE = /^\s*([0-9a-f]{6,16})(:?)(?:\s+(.*))?$/i;

export function stripDumpColumns(input: string): string {
	// Most pastes are not dumps, and the first line says so: checking it before
	// splitting keeps a megabyte of plain hex from being cut into lines for nothing.
	const firstLine = /^\s*([^\r\n]*)/.exec(input)?.[1] ?? '';
	if (!DUMP_LINE.test(firstLine)) return input;
	const lines = input.split(/\r?\n/).filter((l) => l.trim());
	if (!lines.length) return input;
	const out: string[] = [];
	let last = -1;
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(DUMP_LINE);
		if (!m) return input;
		const offset = parseInt(m[1], 16);
		if (offset <= last) return input;
		last = offset;
		let rest = m[3] ?? '';
		// hexdump -C puts the text between bars; xxd puts it after two spaces.
		rest = m[2] ? rest.split(/\s{2,}/)[0] : rest.replace(/\s*\|.*\|\s*$/, '');
		const groups = rest.trim().split(/\s+/).filter(Boolean);
		// od's last line is the length alone.
		if (!groups.length && i === lines.length - 1 && i > 0) break;
		const sizes = m[2] ? /^([0-9a-f]{2}|[0-9a-f]{4})$/i : /^[0-9a-f]{2}$/i;
		if (!groups.length || !groups.every((g) => sizes.test(g))) return input;
		out.push(groups.join(' '));
	}
	return out.join('\n');
}

/** The most hex the paste box accepts, in bytes. Plenty for any header. */
export const MAX_PASTE_BYTES = 1 << 20;

/**
 * Reads pasted hex. Bytes may be separated by spaces, commas, colons or new
 * lines, may carry 0x or \x in front, or may be run together; a separated
 * group with an odd number of digits is refused rather than silently merged
 * with its neighbour, because "D A" could mean 0D 0A or DA.
 *
 * It reads in a single pass, character by character. Splitting into groups and
 * testing each with regular expressions costs about half a second for a
 * megabyte, and the page parses again on every keystroke, including the half
 * of them that leave a byte half typed.
 */
export function parseHex(input: string): Uint8Array {
	const text = stripDumpColumns(input);
	const out = new Uint8Array(text.length >> 1);
	let count = 0;
	let firstGroup = '';
	let i = 0;
	while (i < text.length) {
		if (isSeparator(text.charCodeAt(i))) {
			i++;
			continue;
		}
		const start = i;
		while (i < text.length && !isSeparator(text.charCodeAt(i))) i++;
		if (!firstGroup) firstGroup = text.slice(start, i);
		count = readGroup(text, start, i, out, count, firstGroup);
	}
	checkPasteSize(count);
	return out.slice(0, count);
}

/**
 * Writes one separated group's bytes into out from count and returns the new
 * count. A leading 0x or \x is dropped, and so is any \x inside (\x41\x42).
 */
/** Groups longer than this are quoted in part in an error message. */
const QUOTE_MAX = 24;

function readGroup(
	text: string,
	start: number,
	end: number,
	out: Uint8Array,
	count: number,
	firstGroup: string
): number {
	let p = start;
	const c0 = text.charCodeAt(p);
	const x1 = (text.charCodeAt(p + 1) | 0x20) === 120;
	if (p + 1 < end && x1 && (c0 === 48 || c0 === 92)) p += 2;
	const from = p;
	let digits = 0;
	let high = -1;
	let n = count;
	for (; p < end; p++) {
		const code = text.charCodeAt(p);
		if (code === 92 && p + 1 < end && (text.charCodeAt(p + 1) | 0x20) === 120) {
			p++;
			continue;
		}
		const value = hexDigit(code);
		if (value < 0) {
			// Quote only the neighbourhood of the bad character: a pasted run can be
			// megabytes long, and the message is shown and announced in full.
			const raw =
				end - start <= QUOTE_MAX
					? text.slice(start, end)
					: `${p - start > 8 ? '…' : ''}${text.slice(Math.max(start, p - 8), p + 9)}${end - p > 9 ? '…' : ''}`;
			throw new HexError(
				`“${raw}” contains “${text[p]}”, which is not a hex digit (0 to 9, A to F)${
					/^[0-9a-f]{6,}$/i.test(firstGroup)
						? '. If this is a hex dump, paste only the bytes, without the offset and text columns'
						: ''
				}`
			);
		}
		digits++;
		if (high < 0) high = value;
		else {
			out[n++] = (high << 4) | value;
			high = -1;
		}
	}
	if (digits % 2) {
		const raw = text.slice(start, end);
		if (raw.length > QUOTE_MAX) {
			throw new HexError(
				`“${raw.slice(0, 10)}…${raw.slice(-10)}” (${raw.length.toLocaleString(
					'en-GB'
				)} characters) has an odd number of digits; every byte needs two, so a digit is missing or one too many`
			);
		}
		const group = text.slice(from, end).replace(/\\x/gi, '');
		throw new HexError(
			`“${raw}” has an odd number of digits; every byte needs two, so write 0${group} or join it to its neighbour`
		);
	}
	return n;
}

function checkPasteSize(bytes: number) {
	if (bytes > MAX_PASTE_BYTES) {
		throw new HexError(
			`That is ${bytes.toLocaleString('en-GB')} bytes; paste at most ${MAX_PASTE_BYTES.toLocaleString(
				'en-GB'
			)}, or choose the file instead`
		);
	}
}

/** A hex digit's value, or -1. */
function hexDigit(code: number): number {
	if (code >= 48 && code <= 57) return code - 48; // 0-9
	const lower = code | 0x20;
	return lower >= 97 && lower <= 102 ? lower - 87 : -1; // a-f, A-F
}

/**
 * What separates groups: a comma, semicolon, colon or any white space,
 * the same set as the regular expression class [\s,;:].
 */
function isSeparator(code: number): boolean {
	if (code === 32 || (code >= 9 && code <= 13) || code === 44 || code === 59 || code === 58) return true;
	if (code < 0xa0) return false;
	return (
		code === 0xa0 ||
		code === 0x1680 ||
		(code >= 0x2000 && code <= 0x200a) ||
		code === 0x2028 ||
		code === 0x2029 ||
		code === 0x202f ||
		code === 0x205f ||
		code === 0x3000 ||
		code === 0xfeff
	);
}

// --- The data model --------------------------------------------------------

export type Category = 'image' | 'audio' | 'video' | 'archive' | 'document' | 'executable' | 'font' | 'data' | 'text';

export const CATEGORY_NAMES: Record<Category, string> = {
	image: 'Images',
	audio: 'Audio',
	video: 'Video',
	archive: 'Archives and compression',
	document: 'Documents',
	executable: 'Programs and code',
	font: 'Fonts',
	data: 'Data and disk images',
	text: 'Text'
};

/** A highlighted run of bytes and what it means; sig marks the signature itself. */
export type Field = { start: number; length: number; label: string; value?: string; sig?: boolean };

/** One fixed run of bytes at a fixed offset. null in bytes matches anything. */
type Sig = { at: number; bytes: (number | null)[]; label: string };
/** Several signature parts that must all match, such as RIFF at 0 and WEBP at 8. */
type Variant = { sigs: Sig[]; note?: string };

/** How sure the checker is: a full signature, a short or partly checked one, or text heuristics. */
export type Certainty = 'certain' | 'likely' | 'guess';

/** What a format check adds or changes once its bytes match. */
type Hit = {
	id?: string;
	category?: Category;
	name?: string;
	what?: string;
	exts?: string[];
	alsoOk?: string[];
	noExtOk?: boolean;
	mime?: string;
	certainty?: Certainty;
	fields?: Field[];
	facts?: string[];
	explain?: string;
	/** Found by reading the bytes as text, not by a signature. */
	textHint?: boolean;
};

type TypeDef = {
	id: string;
	name: string;
	/** The name with its article, for sentences: "a PNG image", "an ELF executable". */
	what?: string;
	category: Category;
	/** Usual extensions, the most common first. */
	exts: string[];
	/** Other extensions that are not wrong for this content (a DOCX is a ZIP). */
	alsoOk?: string[];
	/** Files of this kind are often saved without an extension. */
	noExtOk?: boolean;
	mime: string;
	variants: Variant[];
	/** For the reference table, when the bytes alone do not tell the whole story. */
	tableNote?: string;
	/** Checks found bytes more closely; null rejects the match, a Hit refines it. */
	verify?: (v: ByteView, variant: number) => Hit | null;
	/** Replaces plain matching, for signatures that move (PDF) or have no fixed bytes. */
	probe?: (v: ByteView) => Hit | null;
	/** Only tried when nothing else matched, because the pattern is weak. */
	fallback?: boolean;
	explain: string;
};

export type Detection = {
	id: string;
	name: string;
	what: string;
	category: Category;
	exts: string[];
	alsoOk: string[];
	noExtOk: boolean;
	mime: string;
	certainty: Certainty;
	fields: Field[];
	facts: string[];
	explain: string;
	/** True when the answer comes from reading the bytes as text, which has no signature. */
	textHint: boolean;
};

const hexSig = (at: number, hex: string, label: string): Sig => ({
	at,
	bytes: hex.split(' ').map((h) => (h === '??' ? null : parseInt(h, 16))),
	label
});
const textSig = (at: number, text: string, label: string): Sig => ({ at, bytes: latin1Bytes(text), label });
const one = (...sigs: Sig[]): Variant => ({ sigs });

const plural = (n: number, word: string) =>
	`${n.toLocaleString('en-GB')} ${n === 1 ? word : word.endsWith('y') ? word.slice(0, -1) + 'ies' : word + 's'}`;
const field = (start: number, length: number, label: string, value?: string): Field => ({
	start,
	length,
	label,
	value
});

// --- Lookup tables, from the format specifications -------------------------

const PNG_COLOUR: Record<number, string> = {
	0: 'greyscale',
	2: 'RGB colour',
	3: 'indexed colour (a palette)',
	4: 'greyscale with alpha',
	6: 'RGB colour with alpha'
};

/** Which bit depths each PNG colour type allows (PNG specification, table 11.1). */
const PNG_DEPTHS: Record<number, number[]> = {
	0: [1, 2, 4, 8, 16],
	2: [8, 16],
	3: [1, 2, 4, 8],
	4: [8, 16],
	6: [8, 16]
};

/** Why PNG's signature is what it is, a few bytes at a time (PNG specification, section 12.12). */
export const PNG_SIGNATURE: { bytes: number[]; text: string; why: string }[] = [
	{
		bytes: [0x89],
		text: '(none)',
		why: 'Has the top bit set, so a channel that only carries 7 bits damages it, and the file cannot be mistaken for text.'
	},
	{
		bytes: [0x50, 0x4e, 0x47],
		text: 'PNG',
		why: 'The name in ASCII, so a person can recognise the format in a text editor or a hex dump. These three catch no damage.'
	},
	{
		bytes: [0x0d, 0x0a],
		text: 'CR LF',
		why: 'A DOS line ending: a transfer that turns CR LF into LF breaks the signature.'
	},
	{
		bytes: [0x1a],
		text: '^Z',
		why: 'Ctrl+Z, the end-of-file marker for text under DOS: typing the file on a DOS console stops here instead of printing binary.'
	},
	{ bytes: [0x0a], text: 'LF', why: 'A lone line feed: a transfer that turns LF into CR LF breaks the signature.' }
];

const ELF_MACHINE: Record<number, string> = {
	0x02: 'SPARC',
	0x03: 'x86 (32-bit)',
	0x08: 'MIPS',
	0x14: 'PowerPC',
	0x15: 'PowerPC 64-bit',
	0x16: 'IBM S/390',
	0x28: 'ARM (32-bit)',
	0x2a: 'SuperH',
	0x2b: 'SPARC V9',
	0x32: 'IA-64 (Itanium)',
	0x3e: 'x86-64',
	0xb7: 'AArch64 (64-bit ARM)',
	0xf3: 'RISC-V',
	0xf7: 'eBPF',
	0x102: 'LoongArch'
};

const ELF_TYPE: Record<number, string> = {
	1: 'relocatable object file (.o)',
	2: 'executable',
	3: 'shared object (a library, or a position-independent executable)',
	4: 'core dump'
};

const PE_MACHINE: Record<number, string> = {
	0x14c: 'x86 (32-bit)',
	0x8664: 'x86-64',
	0x1c0: 'ARM (32-bit)',
	0x1c4: 'ARM Thumb-2 (32-bit)',
	0xaa64: 'ARM64',
	0x200: 'Itanium',
	0x5064: 'RISC-V 64-bit'
};

const PE_SUBSYSTEM: Record<number, string> = {
	1: 'native (a driver or system process)',
	2: 'Windows GUI',
	3: 'Windows console',
	10: 'EFI application',
	11: 'EFI boot service driver',
	12: 'EFI runtime driver'
};

const MACHO_CPU: Record<number, string> = {
	7: 'i386',
	0x01000007: 'x86-64',
	12: 'ARM',
	0x0100000c: 'arm64',
	0x0200000c: 'arm64_32',
	18: 'PowerPC',
	0x01000012: 'PowerPC 64-bit'
};

const MACHO_FILETYPE: Record<number, string> = {
	1: 'object file',
	2: 'executable',
	6: 'dynamic library (dylib)',
	7: 'dynamic linker',
	8: 'bundle',
	10: 'debug symbols (dSYM)',
	11: 'kernel extension'
};

/** Java's class file major version: 45 was Java 1.0 and 1.1, and from Java 5 (49) it is the release plus 44. */
export function javaRelease(major: number): string | null {
	if (major < 45) return null;
	if (major === 45) return 'Java 1.0 or 1.1';
	if (major <= 48) return `Java 1.${major - 44}`;
	return `Java ${major - 44}`;
}

// --- Containers: ZIP ---------------------------------------------------------

/** Formats that are ZIP archives underneath, told apart by their entries. */
export const ZIP_KINDS: {
	id: string;
	name: string;
	/** The name in a sentence: "What makes it a Word document is inside". */
	what: string;
	exts: string[];
	mime: string;
	rule: string;
	/** The rule as the end of a sentence about this file. */
	inside: string;
	test: (z: ZipInfo) => boolean;
}[] = [
	{
		id: 'epub',
		name: 'EPUB e-book',
		what: 'an EPUB e-book',
		exts: ['epub'],
		mime: 'application/epub+zip',
		rule: 'First entry is an uncompressed file called mimetype holding application/epub+zip',
		inside: 'its first entry is an uncompressed file called mimetype holding application/epub+zip',
		test: (z) => z.mimetype === 'application/epub+zip'
	},
	{
		id: 'odt',
		name: 'OpenDocument text (ODT)',
		what: 'an OpenDocument text document',
		exts: ['odt'],
		mime: 'application/vnd.oasis.opendocument.text',
		rule: 'Stored mimetype entry first: application/vnd.oasis.opendocument.text',
		inside: 'its first entry is a stored mimetype file holding application/vnd.oasis.opendocument.text',
		test: (z) => z.mimetype === 'application/vnd.oasis.opendocument.text'
	},
	{
		id: 'ods',
		name: 'OpenDocument spreadsheet (ODS)',
		what: 'an OpenDocument spreadsheet',
		exts: ['ods'],
		mime: 'application/vnd.oasis.opendocument.spreadsheet',
		rule: 'Stored mimetype entry first: application/vnd.oasis.opendocument.spreadsheet',
		inside: 'its first entry is a stored mimetype file holding application/vnd.oasis.opendocument.spreadsheet',
		test: (z) => z.mimetype === 'application/vnd.oasis.opendocument.spreadsheet'
	},
	{
		id: 'odp',
		name: 'OpenDocument presentation (ODP)',
		what: 'an OpenDocument presentation',
		exts: ['odp'],
		mime: 'application/vnd.oasis.opendocument.presentation',
		rule: 'Stored mimetype entry first: application/vnd.oasis.opendocument.presentation',
		inside: 'its first entry is a stored mimetype file holding application/vnd.oasis.opendocument.presentation',
		test: (z) => z.mimetype === 'application/vnd.oasis.opendocument.presentation'
	},
	{
		id: 'odg',
		name: 'OpenDocument drawing (ODG)',
		what: 'an OpenDocument drawing',
		exts: ['odg'],
		mime: 'application/vnd.oasis.opendocument.graphics',
		rule: 'Stored mimetype entry first: application/vnd.oasis.opendocument.graphics',
		inside: 'its first entry is a stored mimetype file holding application/vnd.oasis.opendocument.graphics',
		test: (z) => z.mimetype === 'application/vnd.oasis.opendocument.graphics'
	},
	{
		id: 'apk',
		name: 'Android app (APK)',
		what: 'an Android app',
		exts: ['apk'],
		mime: 'application/vnd.android.package-archive',
		rule: 'Has AndroidManifest.xml at the top level (and usually classes.dex)',
		inside: 'it has AndroidManifest.xml at the top level',
		test: (z) => z.names.includes('AndroidManifest.xml')
	},
	{
		id: 'docx',
		name: 'Word document (DOCX)',
		what: 'a Word document',
		exts: ['docx', 'docm', 'dotx'],
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		rule: 'Has [Content_Types].xml and a word/ folder',
		inside: 'it has [Content_Types].xml and a word/ folder',
		test: (z) => z.names.includes('[Content_Types].xml') && z.names.some((n) => n.startsWith('word/'))
	},
	{
		id: 'xlsx',
		name: 'Excel workbook (XLSX)',
		what: 'an Excel workbook',
		exts: ['xlsx', 'xlsm', 'xltx'],
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		rule: 'Has [Content_Types].xml and an xl/ folder',
		inside: 'it has [Content_Types].xml and an xl/ folder',
		test: (z) => z.names.includes('[Content_Types].xml') && z.names.some((n) => n.startsWith('xl/'))
	},
	{
		id: 'pptx',
		name: 'PowerPoint presentation (PPTX)',
		what: 'a PowerPoint presentation',
		exts: ['pptx', 'pptm', 'potx'],
		mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		rule: 'Has [Content_Types].xml and a ppt/ folder',
		inside: 'it has [Content_Types].xml and a ppt/ folder',
		test: (z) => z.names.includes('[Content_Types].xml') && z.names.some((n) => n.startsWith('ppt/'))
	},
	{
		id: 'ooxml',
		name: 'Office Open XML document (DOCX, XLSX or PPTX)',
		what: 'an Office Open XML document',
		exts: ['docx', 'xlsx', 'pptx'],
		mime: 'application/zip',
		rule: 'Has [Content_Types].xml, but the entries read so far do not show which Office format',
		inside: 'it has [Content_Types].xml, though the entries read so far do not show which Office format',
		test: (z) => z.names.includes('[Content_Types].xml')
	},
	{
		id: 'jar',
		name: 'Java archive (JAR)',
		what: 'a Java archive',
		exts: ['jar'],
		mime: 'application/java-archive',
		rule: 'Has META-INF/MANIFEST.MF (an APK has one too, so APK is checked first)',
		inside: 'it has META-INF/MANIFEST.MF',
		test: (z) => z.names.includes('META-INF/MANIFEST.MF')
	}
];

export type ZipInfo = {
	/** Entry names, from the local headers at the start and the central directory at the end. */
	names: string[];
	/** The content of a stored first entry called mimetype, used by EPUB and OpenDocument. */
	mimetype: string | null;
	/** True when the central directory was read, so the list of names is complete. */
	fromDirectory: boolean;
	/** Total entries according to the end of central directory record, when it was found. */
	entries: number | null;
};

/** Reads a ZIP's entry names from whatever parts of the file are available. */
export function readZip(v: ByteView): ZipInfo {
	const names: string[] = [];
	const add = (n: string) => !names.includes(n) && names.push(n);
	let mimetype: string | null = null;

	// Walk the local headers from the start. Each says how long its data is,
	// unless bit 3 of the flags defers the sizes to after the data.
	let at = 0;
	for (let count = 0; count < 500 && v.u32(at, true) === 0x04034b50; count++) {
		const flags = v.u16(at + 6, true) as number;
		const method = v.u16(at + 8, true);
		const compressed = v.u32(at + 18, true);
		const nameLength = v.u16(at + 26, true);
		const extraLength = v.u16(at + 28, true);
		if (compressed === undefined || nameLength === undefined || extraLength === undefined) break;
		const name = v.text(at + 30, nameLength);
		if (name === null) break;
		add(name);
		const dataAt = at + 30 + nameLength + extraLength;
		if (count === 0 && name === 'mimetype' && method === 0 && compressed < 200) {
			mimetype = v.text(dataAt, compressed);
		}
		if (flags & 0x08 || compressed === 0xffffffff) break;
		at = dataAt + compressed;
	}

	// The central directory lists every entry. Its position is in the end
	// record, the last thing in the file apart from an optional comment.
	let fromDirectory = false;
	let entries: number | null = null;
	const end = zipEndRecord(v);
	if (end >= 0) {
		entries = v.u16(end + 10, true) as number;
		const dirAt = v.u32(end + 16, true) as number;
		let p = dirAt;
		let read = 0;
		while (read < Math.min(entries, 5000) && v.u32(p, true) === 0x02014b50) {
			const n = v.u16(p + 28, true) as number;
			const e = v.u16(p + 30, true) as number;
			const c = v.u16(p + 32, true) as number;
			const name = v.text(p + 46, n);
			if (name === null) break;
			add(name);
			p += 46 + n + e + c;
			read++;
		}
		fromDirectory = read === entries;
	}
	return { names, mimetype, fromDirectory, entries };
}

/** The offset of a ZIP's end of central directory record, searched for backwards from the end, or -1. */
function zipEndRecord(v: ByteView): number {
	const floor = Math.max(0, v.size - TAIL_BYTES);
	for (let end = v.size - 22; end >= floor; end--) {
		if (v.at(end) === 0x50 && v.u32(end, true) === 0x06054b50) return end;
	}
	return -1;
}

/**
 * Where a ZIP's central directory starts, when the end record was read but
 * the directory itself lies further back than the bytes read. A big archive's
 * directory can run to hundreds of kilobytes, so a page reading a file uses
 * this to read from there to the end, instead of guessing from the first entries.
 */
export function zipDirectoryStart(v: ByteView): number | null {
	if (v.u32(0, true) !== 0x04034b50) return null;
	const end = zipEndRecord(v);
	if (end < 0) return null;
	const dirAt = v.u32(end + 16, true) as number;
	if (dirAt >= end || v.has(dirAt, end - dirAt)) return null;
	return dirAt;
}

// --- Containers: ISO base media (ftyp) --------------------------------------

/** What an ftyp box's brands mean. Checked in order against the major brand, then the compatible ones. */
export const FTYP_KINDS: { id: string; name: string; brands: string[]; exts: string[]; mime: string }[] = [
	{
		id: 'heic',
		name: 'HEIC image (HEIF with HEVC)',
		brands: ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx'],
		exts: ['heic', 'heif'],
		mime: 'image/heic'
	},
	{ id: 'avif', name: 'AVIF image', brands: ['avif', 'avis'], exts: ['avif'], mime: 'image/avif' },
	{ id: 'heif', name: 'HEIF image', brands: ['mif1', 'msf1'], exts: ['heif', 'heic'], mime: 'image/heif' },
	{ id: 'mov', name: 'QuickTime movie', brands: ['qt  '], exts: ['mov', 'qt'], mime: 'video/quicktime' },
	{
		id: 'm4a',
		name: 'MPEG-4 audio (M4A)',
		brands: ['M4A ', 'M4B ', 'M4P '],
		exts: ['m4a', 'm4b', 'm4p'],
		mime: 'audio/mp4'
	},
	{ id: 'm4v', name: 'MPEG-4 video (M4V)', brands: ['M4V ', 'M4VH', 'M4VP'], exts: ['m4v'], mime: 'video/x-m4v' },
	{
		id: '3gp',
		name: '3GPP video',
		brands: ['3gp4', '3gp5', '3gp6', '3gp7', '3ge6', '3gg6'],
		exts: ['3gp'],
		mime: 'video/3gpp'
	},
	{ id: '3g2', name: '3GPP2 video', brands: ['3g2a', '3g2b', '3g2c'], exts: ['3g2'], mime: 'video/3gpp2' },
	{ id: 'cr3', name: 'Canon CR3 raw image', brands: ['crx '], exts: ['cr3'], mime: 'image/x-canon-cr3' },
	{
		id: 'mp4',
		name: 'MP4 video',
		brands: ['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'mmp4', 'MSNV', 'f4v '],
		exts: ['mp4', 'm4v', 'f4v'],
		mime: 'video/mp4'
	}
];

/** ISO media files that play as movies or sound: one is often saved under another's extension, and players cope. */
const MP4_FAMILY = ['mp4', 'm4a', 'm4v', 'm4b', 'm4p', 'mov', 'qt', '3gp', '3g2', 'f4v'];
/** ISO media still images, which are HEIF underneath. */
const HEIF_FAMILY = ['heic', 'heif', 'avif'];

function readFtyp(v: ByteView) {
	const boxSize = v.u32(0, false) ?? 0;
	const major = v.text(8, 4) ?? '';
	const compatible: string[] = [];
	for (let at = 16; at + 4 <= Math.min(boxSize, 256); at += 4) {
		const brand = v.text(at, 4);
		if (brand === null) break;
		compatible.push(brand);
	}
	// A generic major brand (mif1 for HEIF, isom for MP4) defers to a more
	// specific compatible one: an AVIF is often written as mif1 + avif.
	const byBrand = (b: string) => FTYP_KINDS.find((k) => k.brands.includes(b));
	let kind = byBrand(major);
	if (kind?.id === 'heif') kind = compatible.map(byBrand).find((k) => k?.id === 'heic' || k?.id === 'avif') ?? kind;
	if (!kind) kind = compatible.map(byBrand).find((k) => k);
	return { boxSize, major, compatible, kind };
}

// --- Text ------------------------------------------------------------------

/** Extensions for text, which has no signature, so none of them can be called wrong for plain text. */
export const TEXT_EXTS = [
	'txt',
	'text',
	'md',
	'markdown',
	'csv',
	'tsv',
	'json',
	'jsonl',
	'ndjson',
	'log',
	'ini',
	'cfg',
	'conf',
	'yaml',
	'yml',
	'toml',
	'js',
	'mjs',
	'cjs',
	'ts',
	'jsx',
	'tsx',
	'css',
	'scss',
	'less',
	'py',
	'sh',
	'bash',
	'zsh',
	'c',
	'h',
	'cpp',
	'hpp',
	'cc',
	'java',
	'kt',
	'cs',
	'rs',
	'go',
	'rb',
	'pl',
	'php',
	'lua',
	'r',
	'sql',
	'tex',
	'srt',
	'vtt',
	'svg',
	'html',
	'htm',
	'xml',
	'xhtml',
	'bat',
	'ps1',
	'asm',
	's',
	'vhd',
	'v',
	'sv',
	'swift',
	'hs',
	'ml',
	'ex',
	'exs',
	'el',
	'lisp',
	'clj',
	'scala',
	'dart',
	'vue',
	'svelte',
	'rtf',
	'ps',
	'eps',
	'env',
	'gitignore'
];

const XML_EXTS = [
	'svg',
	'xhtml',
	'rss',
	'atom',
	'plist',
	'xsd',
	'xsl',
	'xslt',
	'kml',
	'gpx',
	'config',
	'resx',
	'xaml',
	'opf',
	'ncx',
	'musicxml',
	'drawio'
];

const SCRIPT_KINDS: { match: RegExp; name: string; exts: string[] }[] = [
	{ match: /^python/, name: 'Python script', exts: ['py'] },
	{ match: /^(node|nodejs|deno|bun)$/, name: 'JavaScript script', exts: ['js', 'mjs', 'cjs', 'ts'] },
	{ match: /^(sh|bash|zsh|dash|ksh|ash|mksh)$/, name: 'Shell script', exts: ['sh', 'bash', 'zsh'] },
	{ match: /^fish$/, name: 'Fish script', exts: ['fish'] },
	{ match: /^perl/, name: 'Perl script', exts: ['pl'] },
	{ match: /^ruby/, name: 'Ruby script', exts: ['rb'] },
	{ match: /^php/, name: 'PHP script', exts: ['php'] },
	{ match: /^lua/, name: 'Lua script', exts: ['lua'] },
	{ match: /^Rscript$/, name: 'R script', exts: ['r'] },
	{ match: /^pwsh$/, name: 'PowerShell script', exts: ['ps1'] },
	{ match: /^(awk|gawk|mawk)$/, name: 'AWK script', exts: ['awk'] },
	{ match: /^tclsh/, name: 'Tcl script', exts: ['tcl'] }
];

/** The program a #! line runs, looking through /usr/bin/env to the real interpreter. */
export function shebangProgram(line: string): string {
	const parts = line.replace(/^#!/, '').trim().split(/\s+/);
	const base = (p: string) => p.split('/').pop() ?? p;
	const first = base(parts[0] ?? '');
	if (first !== 'env') return first;
	const arg = parts.slice(1).find((p) => !p.startsWith('-') && !p.includes('='));
	return arg ? base(arg) : 'env';
}

type TextPos = { toByte: (index: number) => number; unit: number };

/** Comments, processing instructions and a doctype: what may come before an XML document's root element. */
const PROLOG = /^(?:\s*(?:<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!doctype[^>[]*(?:\[[\s\S]*?\])?\s*>))*\s*/;

/** Classifies decoded text. Text formats have no fixed signature, so this is at best "likely". */
function classifyText(text: string, pos: TextPos, complete: boolean): Hit {
	const hit = classifyTextInner(text, pos, complete);
	return { ...hit, textHint: true };
}

function classifyTextInner(text: string, pos: TextPos, complete: boolean): Hit {
	const lead = text.length - text.trimStart().length;
	const body = text.slice(lead);
	const lower = body.slice(0, 4096).toLowerCase();
	const span = (index: number, token: string, label: string) =>
		field(pos.toByte(lead + index), token.length * pos.unit, label, token);

	if (text.startsWith('#!')) {
		const line = text.split(/\r?\n/)[0];
		const program = shebangProgram(line);
		const kind = SCRIPT_KINDS.find((k) => k.match.test(program));
		return {
			id: 'script',
			name: kind ? kind.name : 'Script',
			what: kind ? `a ${kind.name}` : 'a script',
			category: 'executable',
			exts: kind ? kind.exts : [],
			alsoOk: ['txt'],
			noExtOk: true,
			mime: 'text/plain',
			// Two bytes of text are a convention, not a signature: likely, never certain.
			certainty: 'likely',
			fields: [
				field(pos.toByte(0), 2 * pos.unit, 'Shebang: #! marks an interpreter line', '#!'),
				field(
					pos.toByte(2),
					(line.length - 2) * pos.unit,
					'The interpreter to run this file with',
					line.slice(2).trim()
				)
			],
			facts: [`Runs with ${program}`],
			explain:
				'On Unix-like systems a file that starts with #! is a script: when it is run as a program, the kernel reads the rest of the first line as the path of the interpreter and hands it the file. That is why scripts often have no extension at all.'
		};
	}
	if (/^<(?:\?xml|svg|!doctype (?:html|svg)|html|!--)/.test(lower)) {
		// The root element decides, not a mention further in: an XML file that
		// holds an svg element somewhere is still not an SVG image.
		const rootAt = (lower.match(PROLOG) as RegExpMatchArray)[0].length;
		const doctypeHtml = lower.startsWith('<!doctype html');
		const declAt = lower.startsWith('<?xml') ? 0 : -1;
		const fields: Field[] = [];
		if (declAt === 0) fields.push(span(0, body.slice(0, 5), 'XML declaration'));
		if (/^<svg[\s>/]/.test(lower.slice(rootAt))) {
			fields.push(span(rootAt, body.slice(rootAt, rootAt + 4), 'The root svg element'));
			return {
				id: 'svg',
				name: 'SVG image',
				what: 'an SVG image',
				exts: ['svg'],
				alsoOk: ['xml', 'txt'],
				mime: 'image/svg+xml',
				certainty: 'likely',
				fields,
				explain:
					'SVG is XML text, so it has no binary signature. An svg root element, usually after an optional XML declaration, is what marks it.'
			};
		}
		if (doctypeHtml || /^<html[\s>]/.test(lower.slice(rootAt))) {
			const token = doctypeHtml ? body.slice(0, 14) : body.slice(rootAt, rootAt + 5);
			fields.push(span(doctypeHtml ? 0 : rootAt, token, doctypeHtml ? 'HTML doctype' : 'The root html element'));
			return {
				id: 'html',
				name: 'HTML document',
				what: 'an HTML document',
				exts: ['html', 'htm', 'xhtml'],
				alsoOk: ['shtml', 'php', 'asp', 'aspx', 'jsp', 'txt'],
				mime: 'text/html',
				certainty: 'likely',
				fields,
				explain:
					'HTML is text and has no signature; a doctype or an html element at the start is the strongest hint. A web server that answers a missing image with an HTML error page is a common way to end up with a "logo.png" that is really this.'
			};
		}
		if (declAt === 0) {
			return {
				id: 'xml',
				name: 'XML document',
				what: 'an XML document',
				exts: ['xml'],
				alsoOk: [...XML_EXTS, 'txt'],
				mime: 'application/xml',
				certainty: 'likely',
				fields,
				explain:
					'XML is text, so it has no binary signature, but a document may open with an XML declaration, <?xml version="1.0"?>, which is as close as text gets to one.'
			};
		}
	}
	if (complete && /^[[{]/.test(body)) {
		try {
			JSON.parse(text);
			return {
				id: 'json',
				name: 'JSON data',
				what: 'JSON data',
				exts: ['json'],
				alsoOk: TEXT_EXTS,
				mime: 'application/json',
				certainty: 'guess',
				fields: [span(0, body[0], 'Opening bracket; the whole text parses as JSON')],
				explain:
					'JSON is text with no signature. This one starts with a bracket and the whole of it parses as JSON, which is about as sure as text gets.'
			};
		} catch {
			// Not JSON after all: fall through to plain text.
		}
	}
	return {
		id: 'text',
		name: 'Plain text',
		what: 'plain text',
		exts: ['txt'],
		alsoOk: TEXT_EXTS,
		mime: 'text/plain',
		certainty: 'guess',
		fields: [],
		explain:
			'No signature matched, and every byte read is printable text in valid UTF-8 (or ASCII). Text has no magic number, so source code, CSV, Markdown and plain notes all look like this; the extension is the only label it has.'
	};
}

const utf8Length = (s: string) => {
	let n = 0;
	for (const ch of s) {
		const cp = ch.codePointAt(0) as number;
		n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
	}
	return n;
};

/** True when the head holds the whole file, so text decoded from it is all of the text. */
const wholeHead = (v: ByteView) => v.head.length >= v.size;

/**
 * Decodes the head as UTF-8 when it is clean text: no NULs or stray control
 * codes, no invalid sequences. 8 KB is plenty to judge; a whole file is read
 * when it is all there, so that JSON can be parsed from start to end.
 */
function readUtf8(v: ByteView, from: number, max = wholeHead(v) ? v.size : 8192): string | null {
	let bytes = v.head.subarray(from, Math.min(v.head.length, max + from));
	// A multi-byte character can be cut off where the read stopped.
	if (from + bytes.length < v.size) {
		let cut = bytes.length;
		for (let k = 1; k <= 3 && cut - k >= 0; k++) {
			const b = bytes[cut - k];
			if ((b & 0xc0) === 0xc0) {
				cut -= k;
				break;
			}
			if ((b & 0x80) === 0) break;
		}
		bytes = bytes.subarray(0, cut);
	}
	for (const b of bytes) if ((b < 0x20 && ![9, 10, 12, 13, 27].includes(b)) || b === 0x7f) return null;
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

function readUtf16(v: ByteView, from: number, little: boolean): string {
	let out = '';
	for (let i = from; i + 1 < Math.min(v.head.length, from + (wholeHead(v) ? v.size : 8192)); i += 2)
		out += String.fromCharCode(v.u16(i, little) as number);
	return out;
}

/** A byte order mark followed by text: report the BOM and classify what follows it. */
function bomVerify(
	bomLength: number,
	encoding: string,
	decode: ((v: ByteView) => { text: string; pos: TextPos } | null) | null
) {
	return (v: ByteView): Hit => {
		const decoded = decode ? decode(v) : null;
		const inner = decoded ? classifyText(decoded.text, decoded.pos, wholeHead(v)) : null;
		const base: Hit = { facts: [`Text encoded as ${encoding}, announced by a byte order mark`] };
		if (!inner || inner.id === 'text') return base;
		return {
			...inner,
			certainty: 'likely',
			fields: inner.fields,
			facts: [...(inner.facts ?? []), `Encoded as ${encoding}, with a byte order mark`]
		};
	};
}

// --- MPEG audio frames ------------------------------------------------------

const MP3_BITRATES = {
	v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
	v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
};
const MPEG_RATES: Record<number, number[]> = {
	3: [44100, 48000, 32000],
	2: [22050, 24000, 16000],
	0: [11025, 12000, 8000]
};

type MpegFrame = { version: string; layer: number; bitrate: number; rate: number; mono: boolean; length: number };

/** Decodes an MPEG audio frame header at an offset, or null if the bits are not one. */
export function mpegFrame(v: ByteView, at: number): MpegFrame | null {
	const b = v.bytes(at, 4);
	if (!b || b[0] !== 0xff || (b[1] & 0xe0) !== 0xe0) return null;
	const versionBits = (b[1] >> 3) & 3;
	const layerBits = (b[1] >> 1) & 3;
	const bitrateIndex = b[2] >> 4;
	const rateIndex = (b[2] >> 2) & 3;
	if (versionBits === 1 || layerBits === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
	const layer = 4 - layerBits;
	const rate = MPEG_RATES[versionBits][rateIndex];
	const v1 = versionBits === 3;
	const bitrate = layer === 3 ? (v1 ? MP3_BITRATES.v1 : MP3_BITRATES.v2)[bitrateIndex] : 0;
	const padding = (b[2] >> 1) & 1;
	// Layer III frames hold 1152 samples (576 for MPEG-2 and 2.5): 144 or 72 bytes per kbit/s per kHz.
	const length = layer === 3 && bitrate ? Math.floor(((v1 ? 144 : 72) * bitrate * 1000) / rate) + padding : 0;
	return {
		version: v1 ? 'MPEG-1' : versionBits === 2 ? 'MPEG-2' : 'MPEG-2.5',
		layer,
		bitrate,
		rate,
		mono: b[3] >> 6 === 3,
		length
	};
}

const frameFacts = (f: MpegFrame) => [
	`${f.version} Layer ${['I', 'II', 'III'][f.layer - 1]}${f.bitrate ? `, ${f.bitrate} kbit/s` : ''}, ${(
		f.rate / 1000
	).toLocaleString('en-GB')} kHz, ${f.mono ? 'mono' : 'stereo'}`
];

// --- The formats -------------------------------------------------------------

const ZIP_FAMILY = [
	'zip',
	'docx',
	'xlsx',
	'pptx',
	'docm',
	'xlsm',
	'pptm',
	'odt',
	'ods',
	'odp',
	'odg',
	'epub',
	'jar',
	'apk',
	'xpi',
	'aar',
	'whl',
	'nupkg',
	'ipa',
	'kmz',
	'cbz',
	'3mf',
	'vsdx',
	'war',
	'ear'
];

const TYPES: TypeDef[] = [
	{
		id: 'png',
		name: 'PNG image',
		category: 'image',
		exts: ['png'],
		alsoOk: ['apng'],
		mime: 'image/png',
		variants: [one(hexSig(0, '89 50 4E 47 0D 0A 1A 0A', 'PNG signature'))],
		verify: (v) => {
			if (v.u32(8, false) !== 13 || v.text(12, 4) !== 'IHDR') return { certainty: 'certain' };
			const w = v.u32(16, false);
			const h = v.u32(20, false);
			const depth = v.at(24);
			const colour = v.at(25);
			const n = (x: number) => x.toLocaleString('en-GB');
			const fields = [
				field(8, 4, 'Length of the first chunk: 13 bytes', '13'),
				field(12, 4, 'First chunk type: IHDR, the image header', 'IHDR')
			];
			const facts: string[] = [];
			// The header is not trusted blindly: PNG allows 1 to 2^31 − 1 pixels a side
			// and only a few bit depths for each colour type, so say when it breaks those.
			const sizeOk = (x: number) => x >= 1 && x <= 0x7fffffff;
			if (w !== undefined && h !== undefined) {
				fields.push(field(16, 4, 'Width', n(w)), field(20, 4, 'Height', n(h)));
				if (sizeOk(w) && sizeOk(h)) facts.push(`${n(w)} × ${n(h)} pixels`);
				for (const [label, x] of [
					['Width', w],
					['Height', h]
				] as [string, number][]) {
					if (!sizeOk(x))
						facts.push(
							`${label} ${n(x)} is not allowed in PNG (${x < 1 ? 'the least is 1' : 'the most is 2,147,483,647'})`
						);
				}
			}
			if (depth !== undefined && colour !== undefined) {
				if (!PNG_DEPTHS[colour]) facts.push(`Colour type ${colour} is not a valid PNG colour type`);
				else if (!PNG_DEPTHS[colour].includes(depth))
					facts.push(`Bit depth ${depth} is not valid for ${PNG_COLOUR[colour]} in PNG`);
				else facts.push(`${depth}-bit ${PNG_COLOUR[colour]}`);
			}
			if (v.at(28) === 1) facts.push('Interlaced (Adam7)');
			return { fields, facts };
		},
		explain:
			'Every PNG starts with the same eight bytes, and most of them were chosen to catch a way files used to be damaged in transit: the high bit of 89 for 7-bit channels, CR LF and LF for line-ending conversion, and 1A to stop DOS from typing it to the screen. Chunks follow, the first always IHDR with the width and height.'
	},
	{
		id: 'jpeg',
		name: 'JPEG image',
		category: 'image',
		exts: ['jpg', 'jpeg', 'jfif', 'jpe'],
		mime: 'image/jpeg',
		variants: [one(hexSig(0, 'FF D8', 'Start of image (SOI) marker'), hexSig(2, 'FF', 'The next marker begins'))],
		verify: (v) => {
			const marker = v.at(3) as number;
			const facts: string[] = [];
			const fields: Field[] = marker === undefined ? [] : [field(3, 1, 'First segment type', `FF ${hex2(marker)}`)];
			if (marker === 0xe0 && v.text(6, 5) === 'JFIF\0') {
				facts.push('JFIF (APP0 segment)');
				fields.push(field(6, 5, 'JFIF identifier', 'JFIF'));
			} else if (marker === 0xe1 && v.text(6, 6) === 'Exif\0\0') {
				facts.push('Exif (APP1 segment), as written by cameras and phones');
				fields.push(field(6, 4, 'Exif identifier', 'Exif'));
			} else if (marker === 0xdb) {
				facts.push('No APP segment: quantisation tables come straight after the start marker');
			}
			// Walk the segments to the frame header for the size.
			let at = 2;
			for (let k = 0; k < 64; k++) {
				if (v.at(at) !== 0xff) break;
				const m = v.at(at + 1) as number;
				const len = v.u16(at + 2, false);
				if (len === undefined || m === 0xda) break;
				if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
					const height = v.u16(at + 5, false);
					const width = v.u16(at + 7, false);
					if (height !== undefined && width !== undefined) {
						facts.push(
							`${width} × ${height} pixels, ${
								m === 0xc2 ? 'progressive' : m === 0xc0 ? 'baseline' : 'SOF' + (m - 0xc0)
							}`
						);
						fields.push(field(at, 2, 'Start of frame marker', `FF ${hex2(m)}`));
					}
					break;
				}
				at += 2 + len;
			}
			return { fields, facts };
		},
		explain:
			'A JPEG is a list of segments, each starting with an FF byte and a marker. The first is always FF D8, start of image, and another FF follows straight away for the next segment: FF E0 for JFIF, FF E1 for Exif. So FF D8 FF is the test.'
	},
	{
		id: 'gif',
		name: 'GIF image',
		category: 'image',
		exts: ['gif'],
		mime: 'image/gif',
		variants: [
			one(textSig(0, 'GIF87a', 'GIF signature, 1987 version')),
			one(textSig(0, 'GIF89a', 'GIF signature, 1989 version'))
		],
		verify: (v) => {
			const w = v.u16(6, true);
			const h = v.u16(8, true);
			if (w === undefined || h === undefined) return {};
			return {
				fields: [field(6, 2, 'Width (little-endian)', String(w)), field(8, 2, 'Height (little-endian)', String(h))],
				facts: [`${w} × ${h} pixels`]
			};
		},
		explain:
			'Plain ASCII: GIF, then the version, 87a or 89a. The 89a version added animation delays and transparency through extension blocks. The logical screen width and height follow, little-endian.'
	},
	{
		id: 'webp',
		name: 'WebP image',
		category: 'image',
		exts: ['webp'],
		mime: 'image/webp',
		variants: [one(textSig(0, 'RIFF', 'RIFF container'), textSig(8, 'WEBP', 'Form type: WEBP'))],
		verify: (v) => {
			const chunk = v.text(12, 4);
			const kind: Record<string, string> = {
				'VP8 ': 'lossy (VP8)',
				VP8L: 'lossless (VP8L)',
				VP8X: 'extended (VP8X: alpha, animation or metadata)'
			};
			return {
				fields: [...riffSize(v), ...(chunk ? [field(12, 4, 'First chunk', chunk)] : [])],
				facts: chunk && kind[chunk] ? [`Encoding: ${kind[chunk]}`] : []
			};
		},
		explain:
			'WebP lives in a RIFF container, like WAV and AVI: RIFF, a little-endian size, then the four-letter form type that says what is inside, here WEBP.'
	},
	{
		id: 'bmp',
		name: 'BMP image',
		category: 'image',
		exts: ['bmp', 'dib'],
		mime: 'image/bmp',
		variants: [one(textSig(0, 'BM', 'BMP signature'))],
		verify: (v) => {
			// Two letters are a weak signature, so insist on a real header size too.
			const dib = v.u32(14, true);
			if (dib === undefined)
				return { certainty: 'likely', facts: ['Too short to check the header size that confirms a BMP'] };
			if (![12, 40, 52, 56, 64, 108, 124].includes(dib)) return null;
			const fields = [
				field(2, 4, 'File size (little-endian)', String(v.u32(2, true))),
				field(14, 4, 'Header size: says which BMP version', String(dib))
			];
			const facts: string[] = [];
			const w = dib === 12 ? v.u16(18, true) : v.u32(18, true);
			const hRaw = dib === 12 ? v.u16(20, true) : v.u32(22, true);
			const bpp = v.u16(dib === 12 ? 24 : 28, true);
			if (w !== undefined && hRaw !== undefined && bpp !== undefined) {
				const h = dib === 12 ? hRaw : hRaw | 0;
				facts.push(`${w} × ${Math.abs(h)} pixels, ${bpp} bits per pixel${h < 0 ? ', stored top row first' : ''}`);
			}
			return { fields, facts };
		},
		explain:
			'BM is short, so the checker also reads the size of the header that follows, which is one of a handful of values (40 bytes is the common Windows 3 header, 124 the latest).'
	},
	{
		id: 'tiff',
		name: 'TIFF image',
		category: 'image',
		exts: ['tif', 'tiff'],
		alsoOk: ['dng', 'cr2', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'orf', 'pef', 'erf'],
		mime: 'image/tiff',
		variants: [
			{ sigs: [hexSig(0, '49 49 2A 00', 'II: Intel byte order (little-endian), then 42')], note: 'little-endian' },
			{ sigs: [hexSig(0, '4D 4D 00 2A', 'MM: Motorola byte order (big-endian), then 42')], note: 'big-endian' },
			{ sigs: [hexSig(0, '49 49 2B 00', 'II, then 43: BigTIFF, little-endian')], note: 'BigTIFF' },
			{ sigs: [hexSig(0, '4D 4D 00 2B', 'MM, then 43: BigTIFF, big-endian')], note: 'BigTIFF' }
		],
		verify: (v, i) => {
			const little = i % 2 === 0;
			const facts = [little ? 'Little-endian (II, for Intel)' : 'Big-endian (MM, for Motorola)'];
			if (i >= 2) return { name: 'BigTIFF image', facts: [...facts, 'BigTIFF: 64-bit offsets, for files over 4 GB'] };
			const ifd = v.u32(4, little);
			const fields = ifd === undefined ? [] : [field(4, 4, 'Offset of the first image directory', hexOffset(ifd))];
			if (v.text(8, 2) === 'CR' && v.at(10) === 2) {
				return {
					id: 'cr2',
					name: 'Canon CR2 raw image (TIFF-based)',
					exts: ['cr2'],
					alsoOk: ['tif', 'tiff'],
					mime: 'image/x-canon-cr2',
					fields: [...fields, field(8, 3, 'CR, version 2: Canon raw')],
					facts
				};
			}
			return { fields, facts };
		},
		explain:
			'The first two bytes give the byte order of every number in the file, II for little-endian or MM for big-endian, and the next two are the number 42 written in that order. Many camera raw formats (DNG, NEF, CR2, ARW) are TIFF underneath and start the same way.'
	},
	{
		id: 'ico',
		name: 'Windows icon (ICO)',
		category: 'image',
		exts: ['ico'],
		mime: 'image/vnd.microsoft.icon',
		variants: [
			{ sigs: [hexSig(0, '00 00 01 00', 'Reserved 0, then type 1: icon')] },
			{ sigs: [hexSig(0, '00 00 02 00', 'Reserved 0, then type 2: cursor')] }
		],
		verify: (v, i) => {
			const count = v.u16(4, true);
			if (count === undefined) return { certainty: 'likely' };
			if (count === 0 || count > 256) return null;
			const reserved = v.at(9);
			if (reserved !== undefined && reserved !== 0) return null;
			const w = v.at(6);
			const embeddedPng = v.u32(18, true);
			const facts = [`${plural(count, 'image')}`];
			if (w !== undefined) facts[0] += `, the first ${w || 256} pixels wide`;
			if (embeddedPng !== undefined && v.text(embeddedPng, 4) === '\x89PNG')
				facts.push('The first image is stored as a PNG');
			const base: Hit = { fields: [field(4, 2, 'Number of images', String(count))], facts };
			return i === 1 ? { ...base, id: 'cur', name: 'Windows cursor (CUR)', exts: ['cur'] } : base;
		},
		explain:
			'Four bytes, 00 00 01 00, that are mostly zeros, so the checker also checks the image count and the first directory entry before believing them. An icon file holds several sizes of the same picture.'
	},
	{
		id: 'psd',
		name: 'Photoshop document (PSD)',
		category: 'image',
		exts: ['psd'],
		alsoOk: ['psb'],
		mime: 'image/vnd.adobe.photoshop',
		variants: [
			{ sigs: [textSig(0, '8BPS', '8BPS: Photoshop signature'), hexSig(4, '00 01', 'Version 1: PSD')] },
			{
				sigs: [
					textSig(0, '8BPS', '8BPS: Photoshop signature'),
					hexSig(4, '00 02', 'Version 2: PSB, the large document format')
				]
			}
		],
		verify: (v, i) => {
			const h = v.u32(14, false);
			const w = v.u32(18, false);
			const facts = w !== undefined && h !== undefined ? [`${w} × ${h} pixels`] : [];
			return i === 1 ? { id: 'psb', name: 'Photoshop large document (PSB)', exts: ['psb'], facts } : { facts };
		},
		explain:
			'8BPS, then a version number: 1 for an ordinary PSD, 2 for PSB, the variant for images over 30,000 pixels a side.'
	},
	{
		id: 'pdf',
		name: 'PDF document',
		category: 'document',
		exts: ['pdf'],
		alsoOk: ['ai'],
		mime: 'application/pdf',
		variants: [one(textSig(0, '%PDF-', '%PDF- and the version'))],
		tableNote: 'Readers accept it anywhere in the first 1024 bytes',
		probe: (v) => {
			const at = v.find(latin1Bytes('%PDF-'), 0, 1024);
			if (at < 0) return null;
			// Readers accept a header after other bytes, but %PDF- further in is
			// just as likely to be a PDF stored inside a tar or ZIP, or a source
			// file that mentions it. Clean text is never called a PDF for that,
			// and a late header is only likely, so a container at its own fixed
			// offset outranks it.
			if (at > 0 && readUtf8(v, 0) !== null) return null;
			const version = (v.text(at + 5, 3) ?? '').replace(/[^0-9.]/g, '');
			return {
				certainty: at > 0 ? 'likely' : 'certain',
				fields: [
					field(at, 5, 'PDF header', '%PDF-'),
					...(version ? [field(at + 5, version.length, 'Version', version)] : [])
				],
				facts: [
					...(version ? [`PDF version ${version}`] : []),
					...(at > 0 ? [`The header starts at byte ${at}, after other data`] : [])
				]
			};
		},
		explain:
			'A PDF starts with a comment line, %PDF- and the version. The second line is usually another comment of four bytes over 127, which tells transfer programs to treat the file as binary.'
	},
	{
		id: 'zip',
		name: 'ZIP archive',
		category: 'archive',
		exts: ['zip'],
		alsoOk: ZIP_FAMILY,
		mime: 'application/zip',
		variants: [
			{ sigs: [hexSig(0, '50 4B 03 04', 'PK, then 03 04: a local file header')] },
			{
				sigs: [hexSig(0, '50 4B 05 06', 'PK, then 05 06: end of central directory, so an empty archive')],
				note: 'empty'
			},
			{ sigs: [hexSig(0, '50 4B 07 08', 'PK, then 07 08: a split archive')], note: 'split' }
		],
		verify: (v, i) => {
			if (i === 1) return { facts: ['An empty archive: nothing but the end record'] };
			if (i === 2) return { facts: ['The first part of an archive split over several files'] };
			const z = readZip(v);
			const fields: Field[] = [];
			const nameLength = v.u16(26, true);
			if (nameLength !== undefined) fields.push(field(30, Math.min(nameLength, 64), 'First entry name', z.names[0]));
			const facts: string[] = [];
			if (z.entries !== null)
				facts.push(
					`${plural(z.entries, 'entry')}${z.names.length ? `, including ${z.names.slice(0, 4).join(', ')}` : ''}`
				);
			else if (z.names.length) facts.push(`First entries: ${z.names.slice(0, 4).join(', ')}`);
			if (!z.fromDirectory)
				facts.push(
					'The central directory at the end of the file was not available, so only the first entries were read'
				);
			const kind = ZIP_KINDS.find((k) => k.test(z));
			if (z.mimetype) {
				const at = 30 + 8 + (v.u16(28, true) ?? 0);
				fields.push(field(at, z.mimetype.length, 'Stored mimetype entry', z.mimetype));
			}
			if (!kind) {
				// With the whole directory read, the formats told apart by their
				// entries are ruled out: a ZIP with no word/ folder is no DOCX. The
				// rest (CBZ, KMZ, wheels and so on) have nothing the checker tests for.
				const ruledOut = z.fromDirectory ? ZIP_KINDS.flatMap((k) => (k.id === 'jar' ? [] : k.exts)) : [];
				const alsoOk = ZIP_FAMILY.filter((e) => !ruledOut.includes(e));
				if (z.mimetype) return { fields, facts: [...facts, `Declares itself as ${z.mimetype}`], alsoOk };
				return { fields, facts, alsoOk };
			}
			return {
				id: kind.id,
				name: kind.name,
				exts: kind.exts,
				alsoOk: ['zip'],
				mime: kind.mime,
				fields,
				facts,
				explain: `It is a ZIP archive: PK 03 04 is the header of its first stored file. What makes it ${kind.what} is inside: ${kind.inside}.`
			};
		},
		explain:
			"PK are Phil Katz's initials, from PKZIP. 03 04 marks a local file header, the record in front of every file stored in the archive. Many formats are ZIP archives with agreed contents, so the entry names decide whether it is a plain ZIP, a DOCX, an EPUB or an APK."
	},
	{
		id: 'gzip',
		name: 'gzip compressed file',
		category: 'archive',
		exts: ['gz', 'tgz'],
		alsoOk: ['svgz', 'emz', 'wmz'],
		mime: 'application/gzip',
		variants: [one(hexSig(0, '1F 8B', 'gzip ID bytes'), hexSig(2, '08', 'Compression method 8: deflate'))],
		verify: (v) => {
			const flags = v.at(3) ?? 0;
			const os: Record<number, string> = {
				0: 'FAT (MS-DOS, Windows)',
				3: 'Unix',
				7: 'classic Mac OS',
				11: 'NTFS (Windows)'
			};
			const facts: string[] = [];
			const fields = [field(3, 1, 'Flags'), field(4, 4, 'Modification time (Unix seconds, little-endian)')];
			const osByte = v.at(9);
			if (osByte !== undefined)
				facts.push(
					osByte === 255 ? 'The operating system is not recorded' : `Made on ${os[osByte] ?? `system ${osByte}`}`
				);
			if (flags & 0x08) {
				let at = 10;
				if (flags & 0x04) at += 2 + (v.u16(10, true) ?? 0);
				const name = v.cString(at, 255);
				if (name) {
					facts.unshift(`Original file name: ${name}`);
					fields.push(field(at, name.length, 'Original file name', name));
				}
			}
			return { fields, facts };
		},
		explain:
			'1F 8B identifies gzip and the third byte is the compression method, which is always 8 (deflate) in practice. A .tar.gz is a tar archive inside gzip, so it starts with these bytes too; the tar header is only visible after decompressing.'
	},
	{
		id: 'bzip2',
		name: 'bzip2 compressed file',
		category: 'archive',
		exts: ['bz2', 'tbz2', 'tbz'],
		mime: 'application/x-bzip2',
		variants: [one(textSig(0, 'BZh', 'BZ, then h for Huffman coding'))],
		verify: (v) => {
			const level = v.at(3);
			if (level === undefined) return { certainty: 'likely' };
			if (level < 0x31 || level > 0x39) return null;
			const facts = [`Block size ${level - 0x30}00 kB`];
			const fields = [field(3, 1, 'Block size, 1 to 9 hundred kB', String.fromCharCode(level))];
			const block = v.bytes(4, 6);
			if (block && formatBytes(block) === '31 41 59 26 53 59')
				fields.push(field(4, 6, 'Block magic: the digits of π, 3.14159265359', '314159265359'));
			if (block && formatBytes(block) === '17 72 45 38 50 90')
				fields.push(field(4, 6, 'End of stream magic: the digits of √π, 1.77245385090', '177245385090'));
			return { fields, facts };
		},
		explain:
			'BZh and a digit for the block size. Each compressed block then starts with 31 41 59 26 53 59, the first digits of π written in hex digits, and the stream ends with the digits of √π.'
	},
	{
		id: 'xz',
		name: 'XZ compressed file',
		what: 'an XZ compressed file',
		category: 'archive',
		exts: ['xz', 'txz'],
		mime: 'application/x-xz',
		variants: [one(hexSig(0, 'FD 37 7A 58 5A 00', 'FD, 7zXZ, 00: XZ stream header'))],
		verify: (v) => {
			const check = (v.at(7) ?? 0) & 0x0f;
			const names: Record<number, string> = { 0: 'no checksum', 1: 'CRC32', 4: 'CRC64', 10: 'SHA-256' };
			return {
				fields: [field(6, 2, 'Stream flags: the integrity check')],
				facts: [`Integrity check: ${names[check] ?? `type ${check}`}`]
			};
		},
		explain:
			'XZ wraps LZMA2 data. Its header starts with FD and ends with 00, which, as in PNG, makes it unmistakably binary; 7zXZ in between is readable.'
	},
	{
		id: '7z',
		name: '7-Zip archive',
		category: 'archive',
		exts: ['7z'],
		mime: 'application/x-7z-compressed',
		variants: [one(hexSig(0, '37 7A BC AF 27 1C', '7z, then BC AF 27 1C'))],
		verify: (v) => {
			const major = v.at(6);
			const minor = v.at(7);
			return major === undefined || minor === undefined
				? {}
				: { fields: [field(6, 2, 'Format version', `${major}.${minor}`)], facts: [`Format version ${major}.${minor}`] };
		},
		explain: 'Six bytes: the letters 7z and four binary bytes, followed by the format version.'
	},
	{
		id: 'rar',
		name: 'RAR archive',
		category: 'archive',
		exts: ['rar'],
		mime: 'application/vnd.rar',
		variants: [
			{ sigs: [hexSig(0, '52 61 72 21 1A 07 01 00', 'Rar! 1A 07 01 00: RAR 5')], note: 'RAR 5' },
			{ sigs: [hexSig(0, '52 61 72 21 1A 07 00', 'Rar! 1A 07 00: RAR 1.5 to 4')], note: 'RAR 4' }
		],
		verify: (v, i) => ({ facts: [i === 0 ? 'RAR 5 format (WinRAR 5.0 and later)' : 'RAR 1.5 to 4.x format'] }),
		explain:
			'Rar! in ASCII, then 1A 07 and a version byte: 00 for the older format, 01 00 for RAR 5, which changed the archive layout completely.'
	},
	{
		id: 'tar',
		name: 'tar archive',
		category: 'archive',
		exts: ['tar'],
		mime: 'application/x-tar',
		variants: [
			{ sigs: [hexSig(257, '75 73 74 61 72 00 30 30', 'ustar, NUL, 00: POSIX tar')], note: 'POSIX' },
			{ sigs: [hexSig(257, '75 73 74 61 72 20 20 00', 'ustar, two spaces, NUL: GNU tar')], note: 'GNU' }
		],
		verify: (v, i) => {
			const name = v.cString(0, 100);
			const facts = [i === 0 ? 'POSIX ustar format' : 'GNU tar format'];
			if (name) facts.push(`First entry: ${name}`);
			// The header checksum: the sum of all 512 bytes, with its own 8 bytes counted as spaces.
			const header = v.bytes(0, 512);
			if (header) {
				const stored = parseInt(
					String.fromCharCode(...header.slice(148, 156))
						.replace(/[\0 ]+$/, '')
						.trim(),
					8
				);
				const sum = header.reduce((a, b, k) => a + (k >= 148 && k < 156 ? 32 : b), 0);
				facts.push(stored === sum ? 'The header checksum is correct' : 'The header checksum does not match');
			}
			return {
				fields: [
					field(0, Math.max(1, name.length), 'First entry name', name),
					field(148, 8, 'Header checksum (octal)')
				],
				facts
			};
		},
		explain:
			'tar has no signature at the start: a file begins with its first entry name. The POSIX ustar format added a magic word, ustar, at byte 257 of each 512-byte header. Older tar files have none and can only be recognised by their checksum.'
	},
	{
		id: 'zstd',
		name: 'Zstandard compressed file',
		category: 'archive',
		exts: ['zst'],
		mime: 'application/zstd',
		variants: [one(hexSig(0, '28 B5 2F FD', 'Frame magic 0xFD2FB528, little-endian'))],
		explain: 'A Zstandard frame starts with the number FD2FB528 stored little-endian, so the bytes appear reversed.'
	},
	{
		id: 'lz4',
		name: 'LZ4 compressed file',
		what: 'an LZ4 compressed file',
		category: 'archive',
		exts: ['lz4'],
		mime: 'application/x-lz4',
		variants: [one(hexSig(0, '04 22 4D 18', 'Frame magic 0x184D2204, little-endian'))],
		explain: 'An LZ4 frame starts with the number 184D2204 stored little-endian.'
	},
	{
		id: 'cfb',
		name: 'Microsoft compound file (old Office, MSI)',
		category: 'document',
		exts: ['doc', 'xls', 'ppt', 'msi', 'msg'],
		alsoOk: ['dot', 'xlt', 'pot', 'vsd', 'pub', 'mpp', 'ole'],
		mime: 'application/x-ole-storage',
		variants: [one(hexSig(0, 'D0 CF 11 E0 A1 B1 1A E1', 'Compound file signature'))],
		verify: (v) => {
			const major = v.u16(26, true);
			return major === undefined
				? {}
				: {
						fields: [field(26, 2, 'Major version: 3 (512-byte sectors) or 4 (4096)', String(major))],
						facts: [`Version ${major}, ${major === 4 ? 4096 : 512}-byte sectors`]
				  };
		},
		explain:
			'Pre-2007 Word, Excel and PowerPoint files, Windows Installer packages and Outlook messages are all compound files: a small file system inside one file. The signature reads roughly DOCFILE in hex-speak (D0 CF 11 E0). Which of them it is depends on the streams inside, not on the first bytes.'
	},
	{
		id: 'rtf',
		name: 'Rich Text Format document',
		category: 'document',
		exts: ['rtf'],
		mime: 'application/rtf',
		variants: [one(textSig(0, '{\\rtf', '{\\rtf: an RTF group'))],
		explain:
			'RTF is text: the whole document is one group in braces that opens with the control word \\rtf and its version, 1.'
	},
	{
		id: 'ps',
		name: 'PostScript document',
		category: 'document',
		exts: ['ps', 'eps'],
		alsoOk: ['ai', 'epsf'],
		mime: 'application/postscript',
		variants: [one(textSig(0, '%!PS', '%!PS: PostScript comment'))],
		verify: (v) => {
			const line = v.cString(0, 80).split(/[\r\n]/)[0];
			return /EPSF/.test(line)
				? { id: 'eps', name: 'Encapsulated PostScript (EPS)', exts: ['eps', 'epsf'], facts: [line] }
				: { facts: [line] };
		},
		explain:
			'%! starts a PostScript program; %!PS-Adobe-3.0 says it follows Adobe’s document structuring conventions, and EPSF on the same line marks an encapsulated graphic.'
	},
	{
		id: 'eps-dos',
		name: 'Encapsulated PostScript with a preview (DOS EPS)',
		what: 'an EPS file with a preview',
		category: 'document',
		exts: ['eps'],
		mime: 'application/postscript',
		variants: [one(hexSig(0, 'C5 D0 D3 C6', 'DOS EPS binary header'))],
		explain:
			'A binary header in front of the PostScript and a TIFF or WMF preview; C5 D0 D3 C6 is EPSF with the top bit set on every letter.'
	},
	{
		id: 'elf',
		name: 'ELF executable',
		what: 'an ELF executable',
		category: 'executable',
		exts: ['elf', 'so', 'o', 'ko', 'axf'],
		noExtOk: true,
		mime: 'application/x-elf',
		variants: [one(hexSig(0, '7F 45 4C 46', 'DEL, then ELF'))],
		verify: (v) => {
			const cls = v.at(4);
			const data = v.at(5);
			if (cls === undefined || data === undefined) return { certainty: 'likely' };
			const little = data === 1;
			const type = v.u16(16, little);
			const machine = v.u16(18, little);
			const fields = [
				field(4, 1, 'Class: 1 is 32-bit, 2 is 64-bit', cls === 2 ? '64-bit' : '32-bit'),
				field(5, 1, 'Data: 1 is little-endian, 2 is big-endian', little ? 'little-endian' : 'big-endian')
			];
			const facts = [`${cls === 2 ? '64-bit' : '32-bit'}, ${little ? 'little-endian' : 'big-endian'}`];
			if (type !== undefined) {
				fields.push(field(16, 2, 'Object file type', ELF_TYPE[type] ?? String(type)));
				facts.push(ELF_TYPE[type] ? ELF_TYPE[type].charAt(0).toUpperCase() + ELF_TYPE[type].slice(1) : `Type ${type}`);
			}
			if (machine !== undefined) {
				fields.push(field(18, 2, 'Machine (instruction set)', ELF_MACHINE[machine] ?? hexOffset(machine)));
				facts.push(`For ${ELF_MACHINE[machine] ?? `machine ${hexOffset(machine)}`}`);
			}
			// Type 3 is a library or, as most Linux programs now are, a
			// position-independent executable; the header alone does not say which.
			const so = type === 3;
			return {
				name: type === 1 ? 'ELF object file' : so ? 'ELF shared object or PIE executable' : 'ELF executable',
				what: type === 1 ? 'an ELF object file' : so ? 'an ELF shared object or PIE executable' : 'an ELF executable',
				fields,
				facts
			};
		},
		explain:
			'The Executable and Linkable Format, used by Linux, the BSDs, Android and most embedded toolchains. 7F is the DEL control code, followed by ELF in ASCII; the next bytes give the word size and byte order, then the type and the processor.'
	},
	{
		id: 'pe',
		name: 'Windows executable (PE)',
		category: 'executable',
		exts: ['exe'],
		alsoOk: ['sys', 'scr', 'cpl', 'ocx', 'efi', 'mui', 'drv', 'com'],
		mime: 'application/vnd.microsoft.portable-executable',
		variants: [one(textSig(0, 'MZ', 'MZ: the DOS executable header'))],
		verify: (v) => {
			const peAt = v.u32(0x3c, true);
			const base: Field[] = [];
			if (peAt === undefined)
				return {
					id: 'mz',
					name: 'DOS or Windows executable (MZ)',
					certainty: 'likely',
					facts: ['Too short to reach the pointer at 0x3C that leads to the Windows header']
				};
			base.push(field(0x3c, 4, 'e_lfanew: where the PE header starts', hexOffset(peAt)));
			const sig = v.text(peAt, 4);
			if (sig === null) {
				return {
					id: 'mz',
					name: 'DOS or Windows executable (MZ)',
					certainty: 'likely',
					fields: base,
					facts: [
						v.complete
							? `The pointer at 0x3C says ${hexOffset(peAt)}, which is past the end of the file`
							: `The PE header would be at ${hexOffset(peAt)}, beyond the bytes read`
					]
				};
			}
			const older: Record<string, [string, string]> = {
				NE: ['16-bit Windows or OS/2 executable (NE)', 'The New Executable format of Windows 3.x and 16-bit OS/2'],
				LE: [
					'Linear executable (LE)',
					'Used for Windows 3.x and 9x device drivers (VxD) and by DOS extenders such as DOS/4GW'
				],
				LX: ['32-bit OS/2 executable (LX)', 'The 32-bit executable format of OS/2 2.0 and later']
			};
			const kind = older[sig.slice(0, 2)];
			if (kind) {
				return {
					id: 'ne',
					name: kind[0],
					fields: [...base, field(peAt, 2, 'Header of the newer format', sig.slice(0, 2))],
					facts: [kind[1]]
				};
			}
			if (sig !== 'PE\0\0') {
				return {
					id: 'mz',
					name: 'MS-DOS executable (MZ)',
					what: 'an MS-DOS executable',
					certainty: 'likely',
					exts: ['exe', 'com'],
					fields: base,
					facts: ['No PE header where 0x3C points, so this is a plain DOS program, or not an executable at all']
				};
			}
			const machine = v.u16(peAt + 4, true) ?? 0;
			const characteristics = v.u16(peAt + 22, true) ?? 0;
			const magic = v.u16(peAt + 24, true);
			const subsystem = v.u16(peAt + 24 + 68, true);
			const dll = (characteristics & 0x2000) !== 0;
			const fields = [
				...base,
				field(peAt, 4, 'PE signature: PE, NUL, NUL', 'PE\\0\\0'),
				field(peAt + 4, 2, 'Machine', PE_MACHINE[machine] ?? hexOffset(machine)),
				field(peAt + 22, 2, 'Characteristics (bit 13 set means a DLL)', dll ? 'DLL' : 'executable')
			];
			const facts = [`For ${PE_MACHINE[machine] ?? `machine ${hexOffset(machine)}`}`];
			if (magic !== undefined) {
				fields.push(
					field(
						peAt + 24,
						2,
						'Optional header magic: 10B is PE32, 20B is PE32+ (64-bit)',
						magic === 0x20b ? 'PE32+' : 'PE32'
					)
				);
				facts.push(magic === 0x20b ? 'PE32+ (64-bit)' : 'PE32 (32-bit)');
			}
			if (subsystem !== undefined && PE_SUBSYSTEM[subsystem]) {
				fields.push(field(peAt + 92, 2, 'Subsystem', PE_SUBSYSTEM[subsystem]));
				facts.push(`Subsystem: ${PE_SUBSYSTEM[subsystem]}`);
			}
			if (dll)
				return {
					id: 'dll',
					name: 'Windows DLL (PE)',
					exts: ['dll'],
					alsoOk: ['sys', 'ocx', 'cpl', 'mui', 'drv'],
					fields,
					facts
				};
			if (subsystem !== undefined && subsystem >= 10 && subsystem <= 12)
				return { id: 'efi', name: 'EFI executable (PE)', what: 'an EFI executable', exts: ['efi'], fields, facts };
			return { fields, facts };
		},
		explain:
			'MZ are the initials of Mark Zbikowski, who designed the MS-DOS executable format. A Windows program still starts with a small DOS program; the 4-byte number at 0x3C points past it to the real header, which starts PE followed by two zero bytes.'
	},
	{
		id: 'macho',
		name: 'Mach-O binary',
		category: 'executable',
		exts: ['dylib', 'o', 'bundle'],
		noExtOk: true,
		mime: 'application/x-mach-binary',
		variants: [
			{
				sigs: [hexSig(0, 'CF FA ED FE', 'FEEDFACF stored little-endian: 64-bit Mach-O')],
				note: '64-bit, little-endian'
			},
			{
				sigs: [hexSig(0, 'CE FA ED FE', 'FEEDFACE stored little-endian: 32-bit Mach-O')],
				note: '32-bit, little-endian'
			},
			{ sigs: [hexSig(0, 'FE ED FA CF', 'FEEDFACF, big-endian: 64-bit Mach-O')], note: '64-bit, big-endian' },
			{ sigs: [hexSig(0, 'FE ED FA CE', 'FEEDFACE, big-endian: 32-bit Mach-O')], note: '32-bit, big-endian' }
		],
		verify: (v, i) => {
			const little = i < 2;
			const bits = i % 2 === 0 ? 64 : 32;
			const cpu = v.u32(4, little);
			const filetype = v.u32(12, little);
			const fields: Field[] = [];
			const facts = [`${bits}-bit, ${little ? 'little-endian' : 'big-endian'}`];
			if (cpu !== undefined) {
				fields.push(field(4, 4, 'CPU type', MACHO_CPU[cpu] ?? hexOffset(cpu)));
				facts.push(`For ${MACHO_CPU[cpu] ?? `CPU type ${hexOffset(cpu)}`}`);
			}
			if (filetype !== undefined) {
				fields.push(field(12, 4, 'File type', MACHO_FILETYPE[filetype] ?? String(filetype)));
				if (MACHO_FILETYPE[filetype])
					facts.push(MACHO_FILETYPE[filetype].charAt(0).toUpperCase() + MACHO_FILETYPE[filetype].slice(1));
			}
			return { fields, facts };
		},
		explain:
			'Mach-O is the executable format of macOS and iOS. Its magic number is FEEDFACE (FEEDFACF for 64-bit), written in the byte order of the processor. Intel and Apple silicon Macs are little-endian, so a 64-bit file starts CF FA ED FE; a 32-bit one, from an older Intel Mac or iPhone, starts CE FA ED FE, and PowerPC Macs wrote it big-endian.'
	},
	{
		id: 'cafebabe',
		name: 'Java class file',
		category: 'executable',
		exts: ['class'],
		mime: 'application/java-vm',
		variants: [
			one(hexSig(0, 'CA FE BA BE', 'CAFEBABE')),
			one(hexSig(0, 'CA FE BA BF', 'CAFEBABF: 64-bit universal binary'))
		],
		tableNote: 'Shared by Java class files and Mach-O universal binaries; the next four bytes decide',
		verify: (v, i) => cafebabe(v, i === 1),
		explain: ''
	},
	{
		id: 'dex',
		name: 'Android Dalvik executable (DEX)',
		category: 'executable',
		exts: ['dex'],
		mime: 'application/vnd.android.dex',
		variants: [one(textSig(0, 'dex\n', 'dex and a line feed'), hexSig(7, '00', 'NUL after the three-digit version'))],
		verify: (v) => {
			const version = v.text(4, 3);
			return version ? { fields: [field(4, 3, 'Format version', version)], facts: [`DEX version ${version}`] } : {};
		},
		explain: 'The compiled code inside an Android app: dex, a line feed, a three-digit version such as 035, and a NUL.'
	},
	{
		id: 'wasm',
		name: 'WebAssembly module',
		category: 'executable',
		exts: ['wasm'],
		mime: 'application/wasm',
		variants: [one(hexSig(0, '00 61 73 6D', 'NUL, then asm'))],
		verify: (v) => {
			const version = v.u32(4, true);
			return version === undefined
				? {}
				: {
						fields: [field(4, 4, 'Version (little-endian)', String(version))],
						facts: [`Binary format version ${version}`]
				  };
		},
		explain:
			'A NUL byte and asm, then the format version as a little-endian 32-bit number, which has been 1 since WebAssembly shipped.'
	},
	{
		id: 'sqlite',
		name: 'SQLite database',
		what: 'an SQLite database',
		category: 'data',
		exts: ['sqlite', 'sqlite3', 'db', 'db3'],
		noExtOk: true,
		mime: 'application/vnd.sqlite3',
		variants: [one(textSig(0, 'SQLite format 3\0', 'SQLite format 3, then NUL'))],
		verify: (v) => {
			const raw = v.u16(16, false);
			const facts: string[] = [];
			const fields: Field[] = [];
			if (raw !== undefined) {
				const page = raw === 1 ? 65536 : raw;
				facts.push(`Page size ${page.toLocaleString('en-GB')} bytes`);
				fields.push(field(16, 2, 'Page size (big-endian; 1 means 65,536)', String(page)));
			}
			const enc = v.u32(56, false);
			if (enc) facts.push(`Text encoding: ${['', 'UTF-8', 'UTF-16le', 'UTF-16be'][enc] ?? enc}`);
			const ver = v.u32(96, false);
			if (ver) {
				facts.push(`Last written by SQLite ${Math.floor(ver / 1e6)}.${Math.floor(ver / 1000) % 1000}.${ver % 1000}`);
				fields.push(field(96, 4, 'SQLite version number that last wrote it', String(ver)));
			}
			return { fields, facts };
		},
		explain:
			'The first 16 bytes are literally the text "SQLite format 3" and a NUL. The rest of the 100-byte header holds the page size, the text encoding and the version of SQLite that last wrote the file.'
	},
	{
		id: 'mp3',
		name: 'MP3 audio',
		what: 'an MP3 file',
		category: 'audio',
		exts: ['mp3'],
		mime: 'audio/mpeg',
		variants: [one(textSig(0, 'ID3', 'ID3: an ID3v2 tag'))],
		tableNote: 'Or a frame sync, FF Fx or FF Ex, with no tag',
		verify: (v) => {
			const major = v.at(3);
			const flags = v.at(5) ?? 0;
			const size = v.bytes(6, 4);
			if (major === undefined || !size || size.some((b) => b > 0x7f))
				return { certainty: 'likely', facts: ['An ID3 tag, but too short to see what follows it'] };
			// Synchsafe: seven bits per byte, so the size never contains an FF that looks like a frame sync.
			const tagSize = (size[0] << 21) | (size[1] << 14) | (size[2] << 7) | size[3];
			const end = 10 + tagSize + (flags & 0x10 ? 10 : 0);
			const fields = [
				field(3, 2, 'ID3 version', `2.${major}.${v.at(4)}`),
				field(6, 4, 'Tag size, 7 bits per byte', String(tagSize))
			];
			const facts = [`ID3v2.${major} tag of ${plural(tagSize, 'byte')}`];
			if (v.text(end, 4) === 'fLaC') {
				return {
					id: 'flac',
					name: 'FLAC audio',
					exts: ['flac'],
					mime: 'audio/flac',
					fields: [...fields, field(end, 4, 'fLaC after the tag')],
					facts: [...facts, 'FLAC audio follows the tag']
				};
			}
			const frame = mpegFrame(v, end);
			if (frame) {
				const named =
					frame.layer === 3
						? {}
						: {
								id: 'mp' + frame.layer,
								name: `MPEG Layer ${frame.layer === 2 ? 'II' : 'I'} audio`,
								exts: ['mp' + frame.layer]
						  };
				return {
					...named,
					fields: [...fields, field(end, 4, 'First MPEG audio frame header')],
					facts: [...facts, ...frameFacts(frame)]
				};
			}
			return {
				certainty: 'likely',
				fields,
				facts: [
					...facts,
					v.has(end, 4) ? 'No audio frame straight after the tag' : 'The audio after the tag is beyond the bytes read'
				]
			};
		},
		explain:
			'An MP3 has no signature of its own: it is a run of frames, each starting with eleven 1 bits (FF Ex or FF Fx). Most files start with an ID3v2 tag for the title and artist instead, which begins ID3, and the first frame follows it.'
	},
	{
		id: 'wav',
		name: 'WAV audio',
		category: 'audio',
		exts: ['wav'],
		mime: 'audio/wav',
		variants: [one(textSig(0, 'RIFF', 'RIFF container'), textSig(8, 'WAVE', 'Form type: WAVE'))],
		verify: (v) => {
			const facts: string[] = [];
			if (v.text(12, 4) === 'fmt ') {
				const format = v.u16(20, true);
				const channels = v.u16(22, true);
				const rate = v.u32(24, true);
				const bits = v.u16(34, true);
				const formats: Record<number, string> = { 1: 'PCM', 3: 'IEEE floating point', 0xfffe: 'extensible' };
				if (format !== undefined && channels !== undefined && rate !== undefined && bits !== undefined) {
					facts.push(
						`${formats[format] ?? `format ${format}`}, ${bits}-bit, ${
							channels === 1 ? 'mono' : channels === 2 ? 'stereo' : plural(channels, 'channel')
						}, ${rate.toLocaleString('en-GB')} Hz`
					);
				}
			}
			return { fields: riffSize(v), facts };
		},
		explain:
			'RIFF, a little-endian size, then WAVE. The fmt chunk that follows gives the sample format, channels and rate.'
	},
	{
		id: 'avi',
		name: 'AVI video',
		what: 'an AVI video',
		category: 'video',
		exts: ['avi'],
		mime: 'video/x-msvideo',
		variants: [one(textSig(0, 'RIFF', 'RIFF container'), textSig(8, 'AVI ', 'Form type: AVI and a space'))],
		verify: (v) => ({ fields: riffSize(v) }),
		explain:
			'Another RIFF file: RIFF, the size, then AVI with a trailing space, since every RIFF form type is four characters.'
	},
	{
		id: 'aiff',
		name: 'AIFF audio',
		what: 'an AIFF file',
		category: 'audio',
		exts: ['aiff', 'aif', 'aifc'],
		mime: 'audio/aiff',
		variants: [
			one(textSig(0, 'FORM', 'IFF container'), textSig(8, 'AIFF', 'Form type: AIFF')),
			one(textSig(0, 'FORM', 'IFF container'), textSig(8, 'AIFC', 'Form type: AIFC (compressed)'))
		],
		explain: "Apple's audio format uses IFF, the big-endian ancestor of RIFF: FORM, a size, then AIFF or AIFC."
	},
	{
		id: 'flac',
		name: 'FLAC audio',
		category: 'audio',
		exts: ['flac'],
		mime: 'audio/flac',
		variants: [one(textSig(0, 'fLaC', 'fLaC'))],
		verify: (v) => {
			const b = v.bytes(18, 4);
			if ((v.at(4) ?? 1) & 0x7f || !b) return {};
			const rate = (b[0] << 12) | (b[1] << 4) | (b[2] >> 4);
			const channels = ((b[2] >> 1) & 7) + 1;
			const bits = (((b[2] & 1) << 4) | (b[3] >> 4)) + 1;
			return {
				fields: [field(4, 4, 'STREAMINFO block header'), field(18, 4, 'Sample rate, channels and bit depth, packed')],
				facts: [
					`${bits}-bit, ${
						channels === 1 ? 'mono' : channels === 2 ? 'stereo' : plural(channels, 'channel')
					}, ${rate.toLocaleString('en-GB')} Hz`
				]
			};
		},
		explain:
			'fLaC, then the STREAMINFO block, which packs the sample rate, channel count and bit depth into a few bits each.'
	},
	{
		id: 'ogg',
		name: 'Ogg media',
		what: 'an Ogg file',
		category: 'audio',
		exts: ['ogg', 'oga', 'ogv', 'opus', 'spx'],
		mime: 'audio/ogg',
		variants: [one(textSig(0, 'OggS', 'OggS: an Ogg page'), hexSig(4, '00', 'Version 0'))],
		verify: (v) => {
			const segments = v.at(26);
			if (segments === undefined) return {};
			const at = 27 + segments;
			const head = v.text(at, 8) ?? '';
			const codecs: [string, string, string[], string][] = [
				['\x01vorbis', 'Ogg Vorbis audio', ['ogg', 'oga'], 'audio/ogg'],
				['OpusHead', 'Ogg Opus audio', ['opus', 'ogg', 'oga'], 'audio/ogg'],
				['\x80theora', 'Ogg Theora video', ['ogv', 'ogg'], 'video/ogg'],
				['\x7fFLAC', 'Ogg FLAC audio', ['oga', 'ogg'], 'audio/ogg'],
				['Speex   ', 'Ogg Speex audio', ['spx', 'ogg'], 'audio/ogg']
			];
			const codec = codecs.find(([sig]) => head.startsWith(sig));
			if (!codec) return {};
			return {
				name: codec[1],
				exts: codec[2],
				mime: codec[3],
				fields: [field(at, codec[0].length, 'First packet: the codec header', codec[0].replace(/[^\x20-\x7e]/g, ''))],
				facts: [`Codec: ${codec[1].replace(/^Ogg /, '')}`]
			};
		},
		explain:
			'OggS starts every page of an Ogg stream, not just the first. The first packet of the first page names the codec inside: Vorbis, Opus, Theora or FLAC.'
	},
	{
		id: 'midi',
		name: 'MIDI file',
		category: 'audio',
		exts: ['mid', 'midi'],
		mime: 'audio/midi',
		variants: [one(textSig(0, 'MThd', 'MThd: the header chunk'), hexSig(4, '00 00 00 06', 'Header length: 6'))],
		verify: (v) => {
			const format = v.u16(8, false);
			const tracks = v.u16(10, false);
			if (format === undefined || tracks === undefined) return {};
			const formats = ['a single track', 'several tracks played together', 'several independent sequences'];
			return {
				fields: [field(8, 2, 'Format', String(format)), field(10, 2, 'Number of tracks', String(tracks))],
				facts: [`Format ${format}: ${formats[format] ?? 'unknown'}`, plural(tracks, 'track')]
			};
		},
		explain:
			'A Standard MIDI File is a list of chunks: MThd, a length that is always 6, then the format, the number of tracks and the timing division.'
	},
	{
		id: 'mkv',
		name: 'Matroska video',
		category: 'video',
		exts: ['mkv', 'mka', 'mks', 'mk3d'],
		alsoOk: ['webm'],
		mime: 'video/x-matroska',
		variants: [one(hexSig(0, '1A 45 DF A3', 'EBML header element ID'))],
		verify: (v) => {
			const at = v.find([0x42, 0x82], 4, 64);
			if (at < 0) return { id: 'ebml', name: 'EBML document (Matroska family)', certainty: 'likely' };
			const first = v.at(at + 2) ?? 0;
			let len = 1;
			while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
			let size = first & (0xff >> len);
			for (let k = 1; k < len; k++) size = size * 256 + (v.at(at + 2 + k) ?? 0);
			const docType = v.text(at + 2 + len, Math.min(size, 32)) ?? '';
			const fields = [
				field(at, 2, 'DocType element', 'DocType'),
				field(at + 2 + len, docType.length, 'DocType value', docType)
			];
			if (docType === 'webm')
				return {
					id: 'webm',
					name: 'WebM video',
					exts: ['webm'],
					alsoOk: ['mkv'],
					mime: 'video/webm',
					fields,
					facts: ['DocType: webm']
				};
			return { fields, facts: [`DocType: ${docType}`] };
		},
		explain:
			'Matroska and WebM are both EBML, a binary cousin of XML. The file starts with the EBML header ID, 1A 45 DF A3, and a DocType element inside it says matroska or webm.'
	},
	{
		id: 'woff',
		name: 'WOFF web font',
		category: 'font',
		exts: ['woff'],
		mime: 'font/woff',
		variants: [one(textSig(0, 'wOFF', 'wOFF'))],
		verify: (v) => fontFlavour(v),
		explain:
			'Web Open Font Format: a compressed wrapper around a TrueType or OpenType font. The four bytes after wOFF give the flavour of the font inside.'
	},
	{
		id: 'woff2',
		name: 'WOFF2 web font',
		category: 'font',
		exts: ['woff2'],
		mime: 'font/woff2',
		variants: [one(textSig(0, 'wOF2', 'wOF2'))],
		verify: (v) => fontFlavour(v),
		explain:
			'WOFF 2.0, with Brotli compression and font-specific transforms; same idea as WOFF, with a 2 in the signature.'
	},
	{
		id: 'ttf',
		name: 'TrueType font',
		category: 'font',
		exts: ['ttf'],
		alsoOk: ['otf'],
		mime: 'font/ttf',
		variants: [
			one(hexSig(0, '00 01 00 00', 'sfnt version 1.0: TrueType outlines')),
			one(textSig(0, 'true', 'true: Apple TrueType'))
		],
		verify: (v) => tableDirectory(v),
		explain:
			'A TrueType font starts with the version number 1.0 as a fixed-point number, 00 01 00 00, then a table directory. Those four bytes are common, so the checker also checks the directory: its three search fields are fixed functions of the table count.'
	},
	{
		id: 'otf',
		name: 'OpenType font (CFF)',
		what: 'an OpenType font',
		category: 'font',
		exts: ['otf'],
		mime: 'font/otf',
		variants: [one(textSig(0, 'OTTO', 'OTTO: OpenType with CFF outlines'))],
		verify: (v) => tableDirectory(v),
		explain:
			'OTTO marks an OpenType font whose glyphs are PostScript (CFF) outlines; an OpenType font with TrueType outlines starts 00 01 00 00 instead.'
	},
	{
		id: 'ttc',
		name: 'TrueType font collection',
		category: 'font',
		exts: ['ttc', 'otc'],
		mime: 'font/collection',
		variants: [one(textSig(0, 'ttcf', 'ttcf: a font collection'))],
		explain: 'Several fonts in one file, sharing tables; ttcf is followed by a version and the offsets of each font.'
	},
	{
		id: 'ftyp',
		name: 'MP4 video',
		category: 'video',
		exts: ['mp4'],
		alsoOk: [...MP4_FAMILY, ...HEIF_FAMILY],
		mime: 'video/mp4',
		variants: [one(textSig(4, 'ftyp', 'ftyp: the file type box'))],
		tableNote: 'Bytes 0 to 3 are the box size; the brand at 8 decides MP4, MOV, M4A, HEIC or AVIF',
		verify: (v) => {
			const f = readFtyp(v);
			if (f.boxSize < 16 || f.boxSize % 4 || !/^[\x20-\x7e]{4}$/.test(f.major)) return null;
			const fields = [field(0, 4, 'Box size', String(f.boxSize)), field(8, 4, 'Major brand', f.major)];
			const facts = [
				`Brands: ${[f.major, ...f.compatible.filter((b) => b !== f.major)].map((b) => b.trim()).join(', ')}`
			];
			if (!f.kind)
				return { name: `ISO media file (brand ${f.major.trim()})`, what: 'an ISO media file', fields, facts };
			const k = f.kind;
			// An MP4 with only sound in it is commonly named .m4a, and a phone's
			// video may carry a 3GP or QuickTime brand: the brand narrows, the
			// extension can still be any of the family.
			// HEIC and AVIF are both HEIF, so .heif fits either, but their codecs differ.
			// A generic mif1 or msf1 major brand only says "HEIF"; the codec
			// brands among the compatible ones say which readers can open it,
			// so .heic fits only with a HEVC brand and .avif only with an AV1 one.
			const has = (id: string) => f.compatible.some((b) => FTYP_KINDS.find((x) => x.id === id)?.brands.includes(b));
			const genericHeif = FTYP_KINDS.find((x) => x.id === 'heif')?.brands.includes(f.major);
			const family =
				k.id === 'heif'
					? HEIF_FAMILY
					: genericHeif
					? ['heif', ...(has('heic') ? ['heic'] : []), ...(has('avif') ? ['avif'] : [])]
					: k.id === 'heic' || k.id === 'avif'
					? ['heif']
					: k.id === 'cr3'
					? []
					: MP4_FAMILY;
			return {
				id: k.id,
				name: k.name,
				exts: k.exts,
				alsoOk: family.filter((e) => !k.exts.includes(e)),
				mime: k.mime,
				category: ['heic', 'avif', 'heif', 'cr3'].includes(k.id) ? 'image' : k.id === 'm4a' ? 'audio' : 'video',
				fields,
				facts
			};
		},
		explain:
			'MP4, QuickTime, HEIC and AVIF all use the ISO base media file format, a tree of boxes, each a 4-byte size and a 4-letter type. The first box is ftyp, and its major brand says which format this is: isom or mp42 for MP4, qt for QuickTime, heic, avif.'
	},
	{
		id: 'mov-old',
		name: 'QuickTime movie (no ftyp box)',
		category: 'video',
		exts: ['mov', 'qt'],
		alsoOk: ['mp4'],
		mime: 'video/quicktime',
		variants: [
			one(textSig(4, 'moov', 'moov box')),
			one(textSig(4, 'mdat', 'mdat box')),
			one(textSig(4, 'wide', 'wide box')),
			one(textSig(4, 'free', 'free box'))
		],
		tableNote: 'Older QuickTime files open with another box instead of ftyp',
		// moov, mdat, wide and free are English words, and any four letters
		// before them make a "box size" of at least 8. Text is not a movie.
		verify: (v) =>
			(v.u32(0, false) ?? 8) >= 8 && readUtf8(v, 0) === null
				? { certainty: 'likely', fields: [field(0, 4, 'Box size')] }
				: null,
		explain:
			'Files from before the ftyp box became usual start straight with a movie (moov), media data (mdat) or padding (wide, free) box.'
	},
	{
		id: 'dicom',
		name: 'DICOM medical image',
		category: 'image',
		exts: ['dcm', 'dicom'],
		noExtOk: true,
		mime: 'application/dicom',
		variants: [one(textSig(128, 'DICM', 'DICM after the 128-byte preamble'))],
		verify: () => ({ fields: [field(0, 128, 'Preamble: 128 bytes for other software, usually zeros')] }),
		explain:
			'A DICOM file starts with 128 bytes that are free for other uses (often all zero), then DICM. Scanners often save them with no extension.'
	},
	{
		id: 'iso',
		name: 'ISO 9660 disc image',
		what: 'an ISO 9660 disc image',
		category: 'data',
		exts: ['iso'],
		alsoOk: ['img', 'cdr'],
		mime: 'application/x-iso9660-image',
		variants: [one(textSig(0x8001, 'CD001', 'CD001: a volume descriptor'))],
		verify: (v) => {
			const type = v.at(0x8000);
			const names: Record<number, string> = {
				0: 'boot record',
				1: 'primary volume descriptor',
				2: 'supplementary volume descriptor',
				255: 'set terminator'
			};
			const fields = [field(0x8000, 1, 'Descriptor type', names[type ?? -1] ?? String(type))];
			const facts: string[] = [];
			if (type === 1) {
				const label = (v.text(0x8028, 32) ?? '').trim();
				if (label) {
					facts.push(`Volume label: ${label}`);
					fields.push(field(0x8028, label.length, 'Volume label', label));
				}
			}
			return { fields, facts };
		},
		explain:
			'The first 32 KB of a CD or DVD image (16 sectors of 2048 bytes) are a system area that ISO 9660 leaves alone, often holding a boot sector. The volume descriptors start at sector 16, byte 0x8000: a type byte, then CD001.'
	},
	{
		id: 'utf8-bom',
		name: 'UTF-8 text with a byte order mark',
		what: 'UTF-8 text',
		category: 'text',
		exts: ['txt'],
		alsoOk: TEXT_EXTS,
		mime: 'text/plain',
		variants: [one(hexSig(0, 'EF BB BF', 'UTF-8 byte order mark'))],
		verify: bomVerify(3, 'UTF-8', (v) => {
			const text = readUtf8(v, 3);
			if (text === null) return null;
			return { text, pos: { toByte: (i) => 3 + utf8Length(text.slice(0, i)), unit: 1 } };
		}),
		explain:
			'EF BB BF is U+FEFF, the byte order mark, encoded in UTF-8. UTF-8 has no byte order to mark, so it only says "this is UTF-8"; Windows tools often add it and Unix tools often trip over it.'
	},
	{
		id: 'utf32le-bom',
		name: 'UTF-32 text, little-endian',
		what: 'UTF-32 text',
		category: 'text',
		exts: ['txt'],
		alsoOk: TEXT_EXTS,
		mime: 'text/plain',
		variants: [one(hexSig(0, 'FF FE 00 00', 'UTF-32 little-endian byte order mark'))],
		verify: bomVerify(4, 'UTF-32LE', null),
		explain:
			'U+FEFF as a little-endian 32-bit number. The same four bytes could be a UTF-16 little-endian mark followed by a NUL character, but text almost never starts with NUL.'
	},
	{
		id: 'utf32be-bom',
		name: 'UTF-32 text, big-endian',
		what: 'UTF-32 text',
		category: 'text',
		exts: ['txt'],
		alsoOk: TEXT_EXTS,
		mime: 'text/plain',
		variants: [one(hexSig(0, '00 00 FE FF', 'UTF-32 big-endian byte order mark'))],
		verify: bomVerify(4, 'UTF-32BE', null),
		explain: 'U+FEFF as a big-endian 32-bit number.'
	},
	{
		id: 'utf16le-bom',
		name: 'UTF-16 text, little-endian',
		what: 'UTF-16 text',
		category: 'text',
		exts: ['txt'],
		alsoOk: TEXT_EXTS,
		mime: 'text/plain',
		variants: [one(hexSig(0, 'FF FE', 'UTF-16 little-endian byte order mark'))],
		verify: (v) => (v.at(2) === 0 && v.at(3) === 0 ? null : utf16le(v)),
		explain:
			'U+FEFF written as a 16-bit number, low byte first. Read with the wrong byte order it would be U+FFFE, which is guaranteed never to be a character, so the mark settles the order. Windows "Unicode" text files start this way.'
	},
	{
		id: 'utf16be-bom',
		name: 'UTF-16 text, big-endian',
		what: 'UTF-16 text',
		category: 'text',
		exts: ['txt'],
		alsoOk: TEXT_EXTS,
		mime: 'text/plain',
		variants: [one(hexSig(0, 'FE FF', 'UTF-16 big-endian byte order mark'))],
		verify: bomVerify(2, 'UTF-16BE', (v) => ({
			text: readUtf16(v, 2, false),
			pos: { toByte: (i) => 2 + 2 * i, unit: 2 }
		})),
		explain: 'U+FEFF written as a 16-bit number, high byte first.'
	},
	{
		id: 'mpeg-audio',
		name: 'MP3 audio',
		what: 'an MP3 file',
		category: 'audio',
		exts: ['mp3'],
		mime: 'audio/mpeg',
		variants: [],
		fallback: true,
		probe: (v) => {
			const frame = mpegFrame(v, 0);
			const b1 = v.at(1) ?? 0;
			if (!frame) {
				// ADTS AAC uses the same 12-bit sync with the layer bits set to 00.
				if (v.at(0) === 0xff && (b1 & 0xf6) === 0xf0) {
					return {
						id: 'aac',
						name: 'AAC audio (ADTS)',
						what: 'an AAC file',
						exts: ['aac'],
						mime: 'audio/aac',
						certainty: 'likely',
						fields: [field(0, 2, 'ADTS sync word and layer 00')],
						explain:
							'Raw AAC audio in ADTS frames: twelve 1 bits, then the MPEG version and a layer of 00, which MP3 never uses.'
					};
				}
				return null;
			}
			const next = frame.length ? mpegFrame(v, frame.length) : null;
			const named =
				frame.layer === 3
					? { id: 'mp3' }
					: {
							id: 'mp' + frame.layer,
							name: `MPEG Layer ${frame.layer === 2 ? 'II' : 'I'} audio`,
							exts: ['mp' + frame.layer]
					  };
			return {
				...named,
				certainty: next ? 'certain' : 'likely',
				fields: [
					field(0, 4, 'MPEG audio frame header'),
					...(next ? [field(frame.length, 4, 'The next frame header, exactly one frame later')] : [])
				],
				facts: [
					...frameFacts(frame),
					next ? 'A second frame starts where the first says it ends' : 'No ID3 tag; only one frame header was checked'
				]
			};
		},
		explain:
			'No tag, just MPEG audio frames: each header starts with eleven 1 bits, then the version, layer, bit rate and sample rate. A second frame exactly one frame length later confirms it.'
	}
];

const utf16le = bomVerify(2, 'UTF-16LE', (v) => ({
	text: readUtf16(v, 2, true),
	pos: { toByte: (i) => 2 + 2 * i, unit: 2 }
}));

function riffSize(v: ByteView): Field[] {
	const size = v.u32(4, true);
	return size === undefined
		? []
		: [
				field(
					4,
					4,
					`Size of the rest: ${
						size + 8 === v.size ? 'file length − 8, as it should be' : `${size.toLocaleString('en-GB')} + 8 bytes`
					}`,
					String(size)
				)
		  ];
}

function fontFlavour(v: ByteView): Hit {
	const flavour = v.bytes(4, 4);
	if (!flavour) return {};
	const ttf = formatBytes(flavour) === '00 01 00 00';
	const cff = String.fromCharCode(...flavour) === 'OTTO';
	const label = ttf ? 'TrueType outlines' : cff ? 'CFF (PostScript) outlines' : 'unknown';
	return { fields: [field(4, 4, 'Flavour of the font inside', label)], facts: [`Contains a font with ${label}`] };
}

/** The table directory's search fields follow from the table count, which makes a four-byte signature trustworthy. */
function tableDirectory(v: ByteView): Hit | null {
	const n = v.u16(4, false);
	const searchRange = v.u16(6, false);
	const selector = v.u16(8, false);
	const shift = v.u16(10, false);
	if (n === undefined || searchRange === undefined || selector === undefined || shift === undefined)
		return { certainty: 'likely', facts: ['Too short to check the table directory'] };
	if (n === 0 || n > 200) return null;
	const power = Math.floor(Math.log2(n));
	if (searchRange !== 16 * 2 ** power || selector !== power || shift !== n * 16 - searchRange) return null;
	const tag = v.text(12, 4);
	return {
		fields: [
			field(4, 2, 'Number of tables', String(n)),
			field(6, 6, 'searchRange, entrySelector, rangeShift: derived from the count')
		],
		facts: [`${plural(n, 'table')}${tag && /^[\x20-\x7e]{4}$/.test(tag) ? `, the first ${tag.trim()}` : ''}`]
	};
}

/**
 * CAFEBABE starts two unrelated formats. A Java class file follows it with
 * its minor and major version (major 45 or more). A Mach-O universal binary
 * follows it with the number of architectures inside, a small number. Read as
 * one 32-bit number, the two ranges cannot overlap in practice.
 */
function cafebabe(v: ByteView, wide: boolean): Hit | null {
	const next = v.u32(4, false);
	const minor = v.u16(4, false);
	const major = v.u16(6, false);
	const universal = (count: number): Hit => {
		const size = wide ? 32 : 20;
		const archs: string[] = [];
		for (let k = 0; k < Math.min(count, 16); k++) {
			const cpu = v.u32(8 + size * k, false);
			if (cpu === undefined) break;
			archs.push(MACHO_CPU[cpu] ?? hexOffset(cpu));
		}
		const fields = [field(4, 4, 'Number of architectures', String(count))];
		if (archs.length) fields.push(field(8, 4, 'First architecture: CPU type', archs[0]));
		return {
			id: 'macho-universal',
			name: 'Mach-O universal binary',
			exts: [],
			noExtOk: true,
			alsoOk: ['dylib', 'bundle', 'o'],
			mime: 'application/x-mach-binary',
			fields,
			facts: [
				`${plural(count, 'architecture')}${archs.length ? `: ${archs.join(', ')}` : ''}${
					archs.length && archs.length < Math.min(count, 16) ? ' (the rest are past the bytes read)' : ''
				}`,
				`Read as a Java class, this would be version ${major}.${minor}, which no Java release uses`
			],
			explain:
				'CAFEBABE is shared by Java class files and Mach-O universal (fat) binaries, which bundle the same program for several processors. Here the next four bytes are a small count of architectures, which settles it: a Java class would have a major version of 45 or more there.'
		};
	};
	if (wide)
		return next === undefined
			? { id: 'macho-universal', name: 'Mach-O universal binary', exts: [], noExtOk: true, certainty: 'likely' }
			: universal(next);
	if (next === undefined || minor === undefined || major === undefined) {
		return {
			id: 'cafebabe',
			name: 'Java class file or Mach-O universal binary',
			what: 'a Java class or Mach-O universal binary',
			exts: ['class'],
			alsoOk: [],
			noExtOk: true,
			certainty: 'likely',
			facts: ['CAFEBABE alone cannot say which: the four bytes after it are needed'],
			explain:
				'CAFEBABE starts both Java class files and Mach-O universal binaries. The next four bytes decide: a version number of 45 or more for Java, a small count of architectures for Mach-O.'
		};
	}
	if (next >= 1 && next <= 20) return universal(next);
	const release = javaRelease(major);
	if (!release) return null;
	return {
		fields: [field(4, 2, 'Minor version', String(minor)), field(6, 2, 'Major version', String(major))],
		facts: [
			`Class file version ${major}.${minor}: ${release}${minor === 0xffff ? ', with preview features' : ''}`,
			'Run it with that Java release or any later one'
		],
		explain:
			'CAFEBABE starts every compiled Java class, and the two 16-bit numbers after it are the minor and major version of the class file format. The same four bytes start Mach-O universal binaries, but those follow with a small count of architectures, never a number as large as a Java version.'
	};
}

// --- Detection ---------------------------------------------------------------

const certaintyRank: Record<Certainty, number> = { certain: 0, likely: 1, guess: 2 };

/** Formats that are text themselves, so a clean-text body is no reason to doubt their signature. */
const TEXT_NATIVE: ReadonlySet<string> = new Set(['pdf', 'rtf', 'ps']);

function sigMatches(v: ByteView, sig: Sig): boolean {
	return sig.bytes.every((b, k) => b === null || v.at(sig.at + k) === b);
}

/**
 * "a PNG image", "an MP3 file": initialisms take the article of how they are
 * spoken, so a few consonants count as vowels. Audio formats read better as files.
 */
export function withArticle(name: string): string {
	const noun = name.replace(/ audio( \(.*\))?$/, ' audio file$1');
	const an =
		/^(?:[aeio]|u(?!tf|ni|s))/i.test(noun) ||
		/^(?:MP\d|MPEG|M4[AVB]|MS-|XZ|LZ4|SVG|HTML|XML|SQL|RTF|NE|LE|LX|MKV|F4V|SVGZ)\b/.test(noun);
	return (an ? 'an ' : 'a ') + noun;
}

function build(def: TypeDef, hit: Hit, sigFields: Field[]): Detection {
	const name = hit.name ?? def.name;
	const sameType = !hit.id || hit.id === def.id;
	return {
		id: hit.id ?? def.id,
		name,
		what: hit.what ?? (hit.name ? withArticle(name) : def.what ?? withArticle(name)),
		category: hit.category ?? def.category,
		exts: hit.exts ?? def.exts,
		alsoOk: hit.alsoOk ?? (sameType ? def.alsoOk ?? [] : []),
		noExtOk: hit.noExtOk ?? def.noExtOk ?? false,
		mime: hit.mime ?? def.mime,
		certainty: hit.certainty ?? 'certain',
		// In file order, so the numbers in the dump read from top to bottom.
		fields: [...sigFields, ...(hit.fields ?? [])].filter((f) => f.length > 0).sort((a, b) => a.start - b.start),
		facts: hit.facts ?? [],
		explain: hit.explain ?? def.explain,
		textHint: hit.textHint ?? false
	};
}

const TEXT_DEF: TypeDef = {
	id: 'text',
	name: 'Plain text',
	category: 'text',
	exts: ['txt'],
	mime: 'text/plain',
	variants: [],
	explain: ''
};

/**
 * Every format the bytes match, the surest first, except that clean text
 * whose only matches are unconfirmed short signatures reads as text first.
 * Empty when nothing matched.
 */
export function detect(v: ByteView): Detection[] {
	if (v.size === 0) return [];
	const found: Detection[] = [];
	// Matches of a binary format whose whole signature is printable letters.
	const wordy = new Set<Detection>();
	const run = (fallback: boolean) => {
		for (const def of TYPES) {
			if (!!def.fallback !== fallback) continue;
			if (def.probe) {
				const hit = def.probe(v);
				if (hit) found.push(build(def, hit, []));
				continue;
			}
			for (let i = 0; i < def.variants.length; i++) {
				const variant = def.variants[i];
				if (!variant.sigs.every((s) => sigMatches(v, s))) continue;
				const hit = def.verify ? def.verify(v, i) : {};
				if (hit === null) continue;
				const sigFields = variant.sigs.map((s) => ({ ...field(s.at, s.bytes.length, s.label), sig: true }));
				const d = build(def, hit, sigFields);
				found.push(d);
				if (
					!TEXT_NATIVE.has(def.id) &&
					variant.sigs.every((s) => s.bytes.every((b) => b !== null && b >= 0x20 && b < 0x7f))
				)
					wordy.add(d);
				break;
			}
		}
	};
	run(false);
	if (!found.length) run(true);
	// GIF89a, fLaC, wOFF and BZh are words as well as signatures. A real file
	// of those formats has binary bytes straight after them (sizes, flags,
	// compressed data), so when clean text carries on past everything the
	// format accounts for, the signature is only likely, and the text reading
	// below goes first. The bare signature, or a header whose structure the
	// checker confirmed (bzip2's BZh91AY&SY is all printable), stays certain.
	if (wordy.size && readUtf8(v, 0) !== null)
		for (const d of wordy) {
			const end = Math.max(...d.fields.map((f) => f.start + f.length));
			if (d.certainty === 'certain' && v.size > end) d.certainty = 'likely';
		}
	// Short signatures that could not be confirmed (true, OTTO, BM, MZ, ID3)
	// are also ordinary words. When nothing matched in full and every byte
	// is clean text, the text reading goes first and the others are listed
	// after it. A byte order mark is text already and needs no second reading.
	found.sort((a, b) => certaintyRank[a.certainty] - certaintyRank[b.certainty]);
	if (found.every((d) => d.certainty !== 'certain' && d.category !== 'text')) {
		const text = readUtf8(v, 0);
		if (text !== null && text.length) {
			const hit = classifyText(text, { toByte: (i) => utf8Length(text.slice(0, i)), unit: 1 }, wholeHead(v));
			const t = build(TEXT_DEF, hit, []);
			// Plain text's own explanation says no signature matched, which is
			// not so when a format is listed after it.
			if (t.id === 'text' && found.length)
				t.explain = `The bytes start with the ${found[0].name} signature, but every byte read is printable text in valid UTF-8 (or ASCII), including where that format's binary data should be, so this is most likely text that happens to begin with the same letters. Text has no magic number of its own; the extension is the only label it has.`;
			found.unshift(t);
		}
	}
	return found;
}

/** When the bytes stop partway through a signature: "the first 4 of PNG's 8 bytes". */
export type Partial = { name: string; have: number; need: number; hex: string; exts: string[] };

export function partialMatches(v: ByteView): Partial[] {
	if (v.size === 0 || v.size >= 16) return [];
	const out: Partial[] = [];
	for (const def of TYPES) {
		for (const variant of def.variants) {
			// The whole pattern, so RIFF is the start of WebP's 12 bytes, not all 4 of them.
			const p = signaturePattern(variant);
			const cells = p.text.split(' ');
			if (p.offset !== 0 || p.text.includes(' at ') || cells.length <= v.size) continue;
			if (cells.slice(0, v.size).every((h, k) => h === '??' || parseInt(h, 16) === v.at(k))) {
				out.push({ name: def.name, have: v.size, need: cells.length, hex: p.text, exts: def.exts });
				break;
			}
		}
	}
	return out;
}

// --- Extensions ----------------------------------------------------------------

export type ExtensionStatus = 'match' | 'compatible' | 'mismatch' | 'unknown-ext' | 'no-ext' | 'undetected' | 'empty';

export type ExtensionVerdict = {
	status: ExtensionStatus;
	ext: string;
	message: string;
	expected: { name: string; hex: string }[];
};

/** The extension of a file name, lower case, without the dot; '' for none. A leading dot (.bashrc) is not one. */
export function extensionOf(fileName: string): string {
	const base = fileName.trim().split(/[\\/]/).pop() ?? '';
	const dot = base.lastIndexOf('.');
	return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Every extension the checker has a format for, so it knows when a name is making a claim. */
export const KNOWN_EXTS: ReadonlySet<string> = new Set([
	...TYPES.flatMap((t) => t.exts),
	...ZIP_KINDS.flatMap((k) => k.exts),
	...FTYP_KINDS.flatMap((k) => k.exts),
	'html',
	'htm',
	'svg',
	'xml',
	'json',
	'txt',
	'py',
	'sh',
	'js',
	'class',
	'cur',
	'psb',
	'webm',
	'cr2',
	'dll',
	'efi',
	'aac',
	'mp2',
	'jar',
	'apk',
	'epub'
]);

/**
 * Extensions that say nothing about the format: .bin and .dat hold anything,
 * and .db is SQLite, Windows' Thumbs.db (a compound file) and much else. They
 * are never called wrong, and no signature is suggested for them.
 */
export const GENERIC_EXTS: ReadonlySet<string> = new Set(['bin', 'dat', 'data', 'db', 'raw', 'tmp', 'out']);

/** The signatures a file with this extension would normally start with. */
export function expectedFor(ext: string): { name: string; hex: string }[] {
	if (GENERIC_EXTS.has(ext)) return [];
	return TYPES.filter((t) => t.exts[0] === ext || (t.exts.includes(ext) && !TYPES.some((u) => u.exts[0] === ext)))
		.filter((t) => t.variants.length)
		.map((t) => ({ name: t.name, hex: signaturePattern(t.variants[0]).text }));
}

/**
 * Whether the name fits the bytes. `partials` are signatures the bytes stop
 * partway through: four bytes of MThd cannot prove a .mid wrong.
 */
export function checkExtension(
	fileName: string,
	detections: Detection[],
	size: number,
	partials: Partial[] = []
): ExtensionVerdict {
	const ext = extensionOf(fileName);
	const dotted = ext ? `.${ext}` : '';
	const top = detections[0];
	const expected =
		ext && (!top || !detections.some((d) => d.exts.includes(ext) || d.alsoOk.includes(ext))) ? expectedFor(ext) : [];
	if (size === 0)
		return { status: 'empty', ext, message: 'The file is empty, so there are no bytes to check.', expected: [] };
	if (!top) {
		const msg =
			'No signature this checker knows. Plenty of files have none: raw data, encrypted files, and some old or obscure formats.';
		if (expected.length)
			return {
				status: 'undetected',
				ext,
				message: `${msg} A real ${dotted} file would start ${expected[0].hex}.`,
				expected
			};
		return { status: 'undetected', ext, message: msg, expected };
	}
	const usual = top.exts.length ? `.${top.exts[0]}` : 'no extension';
	if (!ext) {
		if (top.noExtOk) return { status: 'no-ext', ext, message: `That is normal for ${top.what}.`, expected };
		return {
			status: 'no-ext',
			ext,
			message: `Nothing to check against. It is ${top.what}, usually named ${usual}.`,
			expected
		};
	}
	if (top.exts.includes(ext))
		return { status: 'match', ext, message: `The ${dotted} extension matches: it is ${top.what}.`, expected: [] };
	if (top.alsoOk.includes(ext))
		return {
			status: 'compatible',
			ext,
			message: `${dotted} fits: it is ${top.what}, which is usually named ${usual} but is a valid ${dotted} too.`,
			expected: []
		};
	// A weaker reading of the same bytes may fit the name; say so without claiming it is the answer.
	const other = detections.slice(1).find((d) => d.exts.includes(ext) || d.alsoOk.includes(ext));
	if (other)
		return {
			status: 'compatible',
			ext,
			message: `${dotted} fits another reading of these bytes: they are most likely ${top.what}, but also match ${other.what}.`,
			expected: []
		};
	const cut = partials.find((p) => p.exts.includes(ext));
	if (cut)
		return {
			status: 'compatible',
			ext,
			message: `${dotted} may be right: ${
				cut.have === 1 ? 'this byte is' : `these ${cut.have} bytes are`
			} the start of the ${cut.need}-byte ${cut.name} signature, and the data stops before the rest of it.`,
			expected: []
		};
	if (GENERIC_EXTS.has(ext))
		return {
			status: 'compatible',
			ext,
			message: `${dotted} is a generic extension that any kind of data can have, so it is not wrong. The content is ${top.what}, usually named ${usual}.`,
			expected: []
		};
	if (top.certainty === 'guess' && !KNOWN_EXTS.has(ext)) {
		return {
			status: 'compatible',
			ext,
			message: `Text has no signature, so nothing here contradicts the ${dotted} extension.`,
			expected: []
		};
	}
	if (!KNOWN_EXTS.has(ext))
		return {
			status: 'unknown-ext',
			ext,
			message: `This checker does not know ${dotted}, so it cannot say whether that fits. The content is ${top.what}, usually named ${usual}.`,
			expected
		};
	return {
		status: 'mismatch',
		ext,
		message: `This ${dotted} file is actually ${top.what}. Its usual extension is ${usual}.`,
		expected
	};
}

// --- Hex dump ------------------------------------------------------------------

export type DumpCell = { offset: number; byte: number | null; field: number };
export type DumpRow = { kind: 'row'; offset: number; cells: DumpCell[] } | { kind: 'gap'; from: number; to: number };

/**
 * The rows of a hex dump worth showing: the first few rows, plus the rows
 * holding each highlighted field, with gaps marked between them. Signatures at
 * 257 (tar) or 0x8001 (ISO 9660) get their own rows without dumping 32 KB.
 */
export function hexDump(v: ByteView, fields: Field[], width = 16, leadBytes = 64, maxRows = 40): DumpRow[] {
	if (v.size === 0) return [];
	const rows = new Set<number>();
	const lastRow = Math.floor((v.size - 1) / width);
	// The same bytes at any width: 64 bytes are four rows of 16 or eight of 8.
	const leadRows = Math.ceil(leadBytes / width);
	for (let r = 0; r < leadRows && r <= lastRow; r++) rows.add(r);
	for (const f of fields) {
		const first = Math.floor(f.start / width);
		const last = Math.min(Math.floor((f.start + f.length - 1) / width), first + 3);
		for (let r = first; r <= last && r <= lastRow; r++) rows.add(r);
	}
	const sorted = [...rows]
		.sort((a, b) => a - b)
		.filter((r) => v.has(r * width, 1))
		.slice(0, maxRows);
	const fieldAt = (offset: number) => fields.findIndex((f) => offset >= f.start && offset < f.start + f.length);
	const out: DumpRow[] = [];
	let previous = -1;
	for (const r of sorted) {
		if (previous >= 0 && r > previous + 1) out.push({ kind: 'gap', from: (previous + 1) * width, to: r * width });
		if (previous < 0 && r > 0) out.push({ kind: 'gap', from: 0, to: r * width });
		const cells: DumpCell[] = [];
		for (let k = 0; k < width; k++) {
			const offset = r * width + k;
			const byte = v.at(offset);
			cells.push({ offset, byte: byte === undefined ? null : byte, field: byte === undefined ? -1 : fieldAt(offset) });
		}
		out.push({ kind: 'row', offset: r * width, cells });
		previous = r;
	}
	// Say so when the dump stops before the file does, rather than ending silently.
	if (previous >= 0 && previous < lastRow) out.push({ kind: 'gap', from: (previous + 1) * width, to: v.size });
	return out;
}

/** A byte as the ASCII column shows it: printable ASCII as itself, anything else as a dot. */
export const asciiChar = (b: number | null) =>
	b === null ? ' ' : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.';

/** The hex dump as plain text, laid out like hexdump -C. */
export function dumpText(rows: DumpRow[]): string {
	return rows
		.map((row) => {
			// Not hexdump's *, which means "the same as the line above".
			if (row.kind === 'gap') return `... ${plural(row.to - row.from, 'byte')} not shown`;
			const hex = row.cells.map((c) => (c.byte === null ? '  ' : hex2(c.byte))).join(' ');
			const text = row.cells
				.filter((c) => c.byte !== null)
				.map((c) => asciiChar(c.byte))
				.join('');
			return `${row.offset.toString(16).padStart(8, '0')}  ${hex}  |${text}|`;
		})
		.join('\n');
}

// --- The reference table ---------------------------------------------------------

/** A variant's bytes as one pattern when they sit close together, ?? for bytes that can be anything. */
export function signaturePattern(variant: Variant): { offset: number; text: string; ascii: string } {
	const start = Math.min(...variant.sigs.map((s) => s.at));
	const end = Math.max(...variant.sigs.map((s) => s.at + s.bytes.length));
	if (end - start <= 16) {
		const cells: (number | null)[] = Array(end - start).fill(null);
		for (const s of variant.sigs) s.bytes.forEach((b, k) => (cells[s.at - start + k] = b));
		return {
			offset: start,
			text: cells.map((b) => (b === null ? '??' : hex2(b))).join(' '),
			ascii: cells.map((b) => (b === null ? '.' : asciiChar(b))).join('')
		};
	}
	return {
		offset: start,
		text: variant.sigs.map((s) => `${formatBytes(s.bytes as number[])} at ${hexOffset(s.at)}`).join(', '),
		ascii: variant.sigs.map((s) => (s.bytes as number[]).map(asciiChar).join('')).join(' … ')
	};
}

export type TableRow = {
	id: string;
	name: string;
	category: Category;
	exts: string[];
	offset: number;
	hex: string;
	ascii: string;
	note: string;
};

/** One row per signature variant, grouped by category in a fixed order. */
export function signatureTable(): TableRow[] {
	const order = Object.keys(CATEGORY_NAMES) as Category[];
	const rows: TableRow[] = [];
	for (const def of TYPES) {
		def.variants.forEach((variant, i) => {
			const p = signaturePattern(variant);
			rows.push({
				id: def.id,
				name:
					def.id === 'cafebabe'
						? i === 0
							? 'Java class file or Mach-O universal binary'
							: 'Mach-O universal binary, 64-bit'
						: def.id === 'ftyp'
						? 'MP4, MOV, M4A, HEIC, AVIF'
						: def.name,
				category: def.category,
				exts:
					def.id === 'ftyp' ? ['mp4', 'mov', 'm4a', 'heic', 'avif'] : def.id === 'cafebabe' && i === 1 ? [] : def.exts,
				offset: p.offset,
				hex: p.text,
				ascii: p.ascii,
				note: [variant.note, i === 0 ? def.tableNote : ''].filter(Boolean).join('. ')
			});
		});
	}
	return rows.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/** How many formats the checker recognises, counting each container kind once. */
export const FORMAT_COUNT = new Set([
	...TYPES.map((t) => t.id),
	...ZIP_KINDS.map((k) => k.id),
	...FTYP_KINDS.map((k) => k.id),
	'svg',
	'html',
	'xml',
	'json',
	'script',
	'cr2',
	'dll',
	'efi',
	'cur',
	'psb',
	'webm',
	'aac',
	'macho-universal'
]).size;

// --- Famous magic numbers ------------------------------------------------------------

/** A 32-bit number as its bytes in each byte order: how it looks in a hex dump. */
export function byteOrders(value: number): { big: string; little: string } {
	const bytes = [24, 16, 8, 0].map((s) => (value >>> s) & 0xff);
	return { big: formatBytes(bytes), little: formatBytes([...bytes].reverse()) };
}

// --- Examples -------------------------------------------------------------------------

/** Real files (made with the tools named), cut to the bytes the checker needs. */
export const EXAMPLES: { id: string; label: string; name: string; hex: string; made: string }[] = [
	{
		id: 'png-as-jpg',
		label: 'A PNG named .jpg',
		name: 'photo.jpg',
		made: 'a 1 × 1 PNG',
		hex: '89504e470d0a1a0a0000000d49484452000000010000000108000000003a7e9b550000000a49444154789c636800000082008177cd72b60000000049454e44ae426082'
	},
	{
		id: 'jpeg',
		label: 'JPEG',
		name: 'holiday.jpeg',
		made: 'Pillow',
		hex: 'ffd8ffe000104a46494600010100000100010000ffdb004300100b0c0e0c0a100e0d0e1211101318281a181616183123251d283a333d3c3933383740485c4e404457453738506d51575f626768673e4d71797064785c656763ffdb0043011112121815182f1a1a2f634238426363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636363ffc00011080001000203012200021101031101ffc400'
	},
	{
		id: 'docx',
		label: 'DOCX (a ZIP)',
		name: 'report.docx',
		made: 'Python zipfile',
		hex: '504b03041400000008006498425de6b8746b5c00000062000000130000005b436f6e74656e745f54797065735d2e786d6c15cc4d0a80201040e1ab84fb1c6bd1224a2fd10544a61fca519c21eaf6d9f2f1c19bdc13afe6c6c247a25975da2867a7e5cdc84d15e259ed227904e0b063f4ac5346aab2a612bdd42c1b641f4ebf21f4c60c10120992b4f23f14d80f504b03041400000008006498425d82d91cd512000000100000000b0000005f72656c732f2e72656c73b3094acd492cc9cccf2bcec82c28d6b70300504b03041400000008006498425ddd5a860d0f0000000d00000011000000776f72642f646f63756d656e742e786d6cb329b74ac94f2ecd4dcd2bd1b70300504b010214031400000008006498425de6b8746b5c000000620000001300000000000000000000008001000000005b436f6e74656e745f54797065735d2e786d6c504b010214031400000008006498425d82d91cd512000000100000000b000000000000000000000080018d0000005f72656c732f2e72656c73504b010214031400000008006498425ddd5a860d0f0000000d0000001100000000000000000000008001c8000000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000060100000000'
	},
	{
		id: 'epub',
		label: 'EPUB named .zip',
		name: 'novel.zip',
		made: 'Python zipfile',
		hex: '504b0304140000000000000021006f61ab2c1400000014000000080000006d696d65747970656170706c69636174696f6e2f657075622b7a6970504b03041400000008006498425d54995f930e0000000c000000160000004d4554412d494e462f636f6e7461696e65722e786d6cb349cecf2b49cccc4b2dd2b70300504b01021403140000000000000021006f61ab2c14000000140000000800000000000000000000008001000000006d696d6574797065504b010214031400000008006498425d54995f930e0000000c00000016000000000000000000000080013a0000004d4554412d494e462f636f6e7461696e65722e786d6c504b050600000000020002007a0000007c0000000000'
	},
	{
		id: 'class',
		label: 'Java class',
		name: 'Hi.class',
		made: 'javac 21',
		hex: 'cafebabe00000041001d0a000200030700040c000500060100106a6176612f6c'
	},
	{
		id: 'fat',
		label: 'Mach-O universal',
		name: 'tool',
		made: 'llvm-lipo',
		hex: 'cafebabe00000002010000070000000300001000000003680000000c0100000c0000000000004000000002b00000000e00000000000000000000000000000000'
	},
	{
		id: 'elf',
		label: 'Linux ELF',
		name: 'hello',
		made: 'clang and ld.lld',
		hex: '7f454c4602010100000000000000000002003e0001000000a0112000000000004000000000000000e80200000000000000000000400038000400400007000500'
	},
	{
		id: 'exe',
		label: 'Windows EXE',
		name: 'setup.exe',
		made: 'clang and lld-link',
		hex: '4d5a78000100000004000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000780000000e1fba0e00b409cd21b8014ccd21546869732070726f6772616d2063616e6e6f742062652072756e20696e20444f53206d6f64652e2400005045000064860100dffebf6a0000000000000000f00022000b020e00000200000000000000000000101000000010000000000040010000000010000000020000060000000000000006000000000000000020000000020000000000000300608100001000000000000010000000000000000010000000000000100000000000000000000010000000'
	},
	{
		id: 'gzip',
		label: 'gzip with a name',
		name: 'notes.txt.gz',
		made: 'Python gzip',
		hex: '1f8b08080000000002ff6e6f7465732e74787400cb48cdc9c9e7020020303a3606000000'
	},
	{
		id: 'pdf',
		label: 'PDF',
		name: 'invoice.pdf',
		made: 'by hand',
		hex: '255044462d312e370a25e2e3cfd30a312030206f626a0a3c3c202f54797065202f436174616c6f67202f5061676573203220302052203e3e0a656e646f626a0a322030206f626a0a3c3c202f54797065202f5061676573202f4b696473205b33203020525d202f436f756e742031203e3e0a656e646f626a0a332030206f626a0a3c3c202f54797065202f50616765202f506172656e74203220302052202f4d65646961426f78205b3020302037322037325d203e3e0a656e646f626a0a787265660a3020340a303030303030303030302036353533352066200a30303030303030303135203030303030206e200a30303030303030303634203030303030206e200a30303030303030313231203030303030206e200a747261696c65720a3c3c202f53697a652034202f526f6f74203120302052203e3e0a7374617274787265660a3139300a2525454f460a'
	},
	{
		id: 'mp3',
		label: 'MP3 with ID3',
		name: 'tone.mp3',
		made: 'ffmpeg',
		hex: '49443304000000000023545353450000000f0000034c61766636302e31362e3130300000000000000000000000fffb40c0000000000000000000000000000000'
	},
	{
		id: 'script',
		label: 'Python script',
		name: 'hello',
		made: 'by hand',
		hex: '23212f7573722f62696e2f656e7620707974686f6e330a7072696e74282268656c6c6f22290a'
	},
	{
		id: 'html-as-png',
		label: 'HTML named .png',
		name: 'logo.png',
		made: 'by hand',
		hex: '3c21444f43545950452068746d6c3e0a3c68746d6c206c616e673d22656e223e3c686561643e3c7469746c653e343034204e6f7420466f756e643c2f7469746c653e3c2f686561643e3c626f64793e3c68313e4e6f7420466f756e643c2f68313e3c2f626f64793e3c2f68746d6c3e0a'
	},
	{ id: 'truncated', label: 'Cut-off PNG', name: 'image.png', made: 'the first 4 bytes of a PNG', hex: '89504e47' }
];
