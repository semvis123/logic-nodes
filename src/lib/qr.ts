// A QR code encoder written out step by step, so a page can show every stage
// of the build: the bit stream, the codewords, the Reed–Solomon error
// correction, the interleaving, where each module sits and why, and the mask
// scores. It follows ISO/IEC 18004 for numeric, alphanumeric and byte mode
// symbols of versions 1 to 40.
//
// No dependencies. The test suite checks the symbols against the standard's
// tables and worked example, checks the error correction by evaluating
// syndromes, and the encoder was checked during development by decoding
// thousands of rendered symbols with OpenCV's QR reader.
//
// Coordinates: x is the column and y the row, both from the top left, which is
// how the standard draws the symbol. Matrices are indexed [y][x].

export class QrError extends Error {}

export type EcLevel = 'L' | 'M' | 'Q' | 'H';
export type Mode = 'numeric' | 'alphanumeric' | 'byte';

export const EC_LEVELS: readonly EcLevel[] = ['L', 'M', 'Q', 'H'];
export const MODES: readonly Mode[] = ['numeric', 'alphanumeric', 'byte'];
export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

/**
 * The two bits each level writes into the format information. They are not in
 * L, M, Q, H order: the standard numbers them M = 00, L = 01, H = 10, Q = 11.
 * `recovery` is the approximate share of codewords each level can restore.
 */
export const EC_INFO: Record<EcLevel, { bits: number; recovery: number }> = {
	L: { bits: 0b01, recovery: 7 },
	M: { bits: 0b00, recovery: 15 },
	Q: { bits: 0b11, recovery: 25 },
	H: { bits: 0b10, recovery: 30 }
};

/** The 4-bit mode indicators at the start of the bit stream. */
export const MODE_INDICATOR: Record<Mode, string> = { numeric: '0001', alphanumeric: '0010', byte: '0100' };

/** The 45 characters alphanumeric mode can carry, in the order of their values. */
export const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// --- Symbol geometry and the capacity tables ------------------------------

/** Version 1 is 21 modules square and each version adds 4. */
export const symbolSize = (version: number) => 17 + 4 * version;

// The standard's table of error correction codewords per block and number of
// blocks, by level and version (index 0 unused). Every other capacity figure
// follows from these and the module count.
const EC_PER_BLOCK: Record<EcLevel, number[]> = {
	L: [
		0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
		30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
	],
	M: [
		0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
		28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28
	],
	Q: [
		0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30,
		30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
	],
	H: [
		0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30,
		30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30
	]
};

const BLOCKS: Record<EcLevel, number[]> = {
	L: [
		0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
		19, 20, 21, 22, 24, 25
	],
	M: [
		0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33,
		35, 37, 38, 40, 43, 45, 47, 49
	],
	Q: [
		0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43,
		45, 48, 51, 53, 56, 59, 62, 65, 68
	],
	H: [
		0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51,
		54, 57, 60, 63, 66, 70, 74, 77, 81
	]
};

function checkVersion(version: number) {
	if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION)
		throw new QrError(`There is no version ${version}: QR codes run from version 1 to 40`);
}

/**
 * Centre rows and columns of the alignment patterns. They are spread as evenly
 * as possible between column 6 and the far edge, with an even step, which the
 * standard's table follows except at version 32, where it uses 26 rather than
 * the 28 the rule would give.
 */
export function alignmentPositions(version: number): number[] {
	checkVersion(version);
	if (version === 1) return [];
	const count = Math.floor(version / 7) + 2;
	const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
	const out = [6];
	for (let pos = symbolSize(version) - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
	return out;
}

/**
 * Modules left for data and error correction once the function patterns,
 * format information and version information have taken theirs.
 */
export function rawDataModules(version: number): number {
	checkVersion(version);
	let result = (16 * version + 128) * version + 64;
	if (version >= 2) {
		const count = Math.floor(version / 7) + 2;
		result -= (25 * count - 10) * count - 55;
		if (version >= 7) result -= 36;
	}
	return result;
}

export const totalCodewords = (version: number) => Math.floor(rawDataModules(version) / 8);
/** Modules left over after the last whole codeword: 0, 3, 4 or 7. */
export const remainderBits = (version: number) => rawDataModules(version) % 8;
export const ecCodewordsPerBlock = (version: number, ec: EcLevel) => (checkVersion(version), EC_PER_BLOCK[ec][version]);
export const blockCount = (version: number, ec: EcLevel) => (checkVersion(version), BLOCKS[ec][version]);
export const ecCodewords = (version: number, ec: EcLevel) => ecCodewordsPerBlock(version, ec) * blockCount(version, ec);
export const dataCodewords = (version: number, ec: EcLevel) => totalCodewords(version) - ecCodewords(version, ec);

/**
 * How the codewords split into blocks. When they do not divide evenly the
 * later blocks take one data codeword more; every block has the same number
 * of error correction codewords.
 */
export function blockLayout(version: number, ec: EcLevel): { count: number; data: number; ec: number }[] {
	const blocks = blockCount(version, ec);
	const total = totalCodewords(version);
	const perEc = ecCodewordsPerBlock(version, ec);
	const shortLen = Math.floor(total / blocks);
	const longCount = total % blocks;
	const out = [{ count: blocks - longCount, data: shortLen - perEc, ec: perEc }];
	if (longCount) out.push({ count: longCount, data: shortLen - perEc + 1, ec: perEc });
	return out;
}

/** Bits in the character count field, which grows with the version. */
export function charCountBits(mode: Mode, version: number): number {
	checkVersion(version);
	const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
	return { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] }[mode][band];
}

/** Bits the characters themselves take, not counting the header. */
export function dataBitLength(mode: Mode, count: number): number {
	if (mode === 'numeric') return 10 * Math.floor(count / 3) + [0, 4, 7][count % 3];
	if (mode === 'alphanumeric') return 11 * Math.floor(count / 2) + 6 * (count % 2);
	return 8 * count;
}

/**
 * The most characters (bytes, in byte mode) one mode fits into a symbol, the
 * figure the standard tabulates as the symbol's capacity.
 */
export function capacity(version: number, ec: EcLevel, mode: Mode): number {
	const avail = dataCodewords(version, ec) * 8 - 4 - charCountBits(mode, version);
	let n: number;
	if (mode === 'numeric') {
		const rest = avail % 10;
		n = 3 * Math.floor(avail / 10) + (rest >= 7 ? 2 : rest >= 4 ? 1 : 0);
	} else if (mode === 'alphanumeric') n = 2 * Math.floor(avail / 11) + (avail % 11 >= 6 ? 1 : 0);
	else n = Math.floor(avail / 8);
	return Math.min(n, 2 ** charCountBits(mode, version) - 1);
}

// --- Format and version information ---------------------------------------

/**
 * The 15 format bits: the level's two bits and the mask number, a BCH(15,5)
 * code over them (generator 10100110111), then XOR 101010000010010 so that no
 * combination comes out all zero.
 */
export const FORMAT_MASK = 0b101010000010010;
export const FORMAT_GENERATOR = 0b10100110111;
export function formatBits(ec: EcLevel, mask: number): number {
	const data = (EC_INFO[ec].bits << 3) | mask;
	let rem = data;
	for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * FORMAT_GENERATOR);
	return ((data << 10) | (rem & 0x3ff)) ^ FORMAT_MASK;
}

/** The 18 version bits for version 7 and up: 6 bits of version, a BCH(18,6) code. */
export const VERSION_GENERATOR = 0b1111100100101;
export function versionBits(version: number): number {
	checkVersion(version);
	let rem = version;
	for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * VERSION_GENERATOR);
	return (version << 12) | (rem & 0xfff);
}

// --- GF(256) and Reed–Solomon ---------------------------------------------

/** The field's reducing polynomial, x⁸ + x⁴ + x³ + x² + 1. */
export const GF_POLY = 0x11d;
/** EXP[i] is α^i (the table runs to 510 so products need no reduction); LOG is its inverse. */
export const GF_EXP: number[] = [];
export const GF_LOG: number[] = new Array(256).fill(0);
{
	let x = 1;
	for (let i = 0; i < 255; i++) {
		GF_EXP[i] = x;
		GF_LOG[x] = i;
		x <<= 1;
		if (x & 0x100) x ^= GF_POLY;
	}
	for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

export const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

/**
 * The generator polynomial (x − α⁰)(x − α¹)…(x − α^(n−1)), highest power
 * first, leading 1 included. Minus is plus in this field.
 */
export function rsGenerator(degree: number): number[] {
	let poly = [1];
	for (let i = 0; i < degree; i++) {
		const next = new Array(poly.length + 1).fill(0);
		for (let j = 0; j < poly.length; j++) {
			next[j] ^= poly[j];
			next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
		}
		poly = next;
	}
	return poly;
}

/**
 * The error correction codewords: the remainder of data × x^degree divided by
 * the generator, by long division, the way the standard describes it.
 */
export function rsRemainder(data: readonly number[], degree: number): number[] {
	const gen = rsGenerator(degree);
	const rem = new Array(degree).fill(0);
	for (const byte of data) {
		const factor = byte ^ rem[0];
		rem.shift();
		rem.push(0);
		if (factor) for (let j = 0; j < degree; j++) rem[j] ^= gfMul(gen[j + 1], factor);
	}
	return rem;
}

// --- Masks and penalty rules -----------------------------------------------

/** The eight mask conditions; a data module is inverted where its mask is true. */
export const MASKS: { formula: string; test: (x: number, y: number) => boolean }[] = [
	{ formula: '(row + column) mod 2 = 0', test: (x, y) => (x + y) % 2 === 0 },
	{ formula: 'row mod 2 = 0', test: (x, y) => y % 2 === 0 },
	{ formula: 'column mod 3 = 0', test: (x) => x % 3 === 0 },
	{ formula: '(row + column) mod 3 = 0', test: (x, y) => (x + y) % 3 === 0 },
	{
		formula: '(⌊row / 2⌋ + ⌊column / 3⌋) mod 2 = 0',
		test: (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0
	},
	{ formula: '(row × column) mod 2 + (row × column) mod 3 = 0', test: (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0 },
	{
		formula: '((row × column) mod 2 + (row × column) mod 3) mod 2 = 0',
		test: (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
	},
	{
		formula: '((row + column) mod 2 + (row × column) mod 3) mod 2 = 0',
		test: (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
	}
];

export type Penalty = { mask: number; runs: number; boxes: number; finders: number; balance: number; total: number };

/**
 * The four penalty rules. Lower is better.
 *  1. Runs of five or more same-coloured modules in a row or column: 3, plus 1
 *     for each module past five.
 *  2. Each 2×2 block of one colour: 3 (blocks may overlap).
 *  3. Each 1:1:3:1:1 dark-light-dark-light-dark pattern with four light
 *     modules before or after it, in a row or column: 40. The quiet zone
 *     counts as light, so a pattern at the edge counts too.
 *  4. 10 for every whole 5% step the share of dark modules is away from 50%.
 */
export function penalty(matrix: boolean[][], mask = -1): Penalty {
	const size = matrix.length;
	let runs = 0;
	let boxes = 0;
	let finders = 0;
	let dark = 0;
	const at = (line: (i: number) => boolean, i: number) => (i < 0 || i >= size ? false : line(i));
	const pattern = [true, false, true, true, true, false, true];
	const scanLine = (line: (i: number) => boolean) => {
		let runColour = line(0);
		let runLength = 1;
		for (let i = 1; i <= size; i++) {
			if (i < size && line(i) === runColour) runLength++;
			else {
				if (runLength >= 5) runs += 3 + runLength - 5;
				if (i < size) {
					runColour = line(i);
					runLength = 1;
				}
			}
		}
		for (let s = 0; s + 7 <= size; s++) {
			if (!pattern.every((p, k) => line(s + k) === p)) continue;
			const lightBefore = [1, 2, 3, 4].every((k) => !at(line, s - k));
			const lightAfter = [0, 1, 2, 3].every((k) => !at(line, s + 7 + k));
			finders += 40 * (Number(lightBefore) + Number(lightAfter));
		}
	};
	for (let y = 0; y < size; y++) scanLine((x) => matrix[y][x]);
	for (let x = 0; x < size; x++) scanLine((y) => matrix[y][x]);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			if (matrix[y][x]) dark++;
			if (x + 1 < size && y + 1 < size) {
				const c = matrix[y][x];
				if (matrix[y][x + 1] === c && matrix[y + 1][x] === c && matrix[y + 1][x + 1] === c) boxes += 3;
			}
		}
	const total = size * size;
	const balance = 10 * Math.floor(Math.abs(20 * dark - 10 * total) / total);
	return { mask, runs, boxes, finders, balance, total: runs + boxes + finders + balance };
}

// --- The bit stream ---------------------------------------------------------

/** The most compact single mode the whole text fits. */
export function chooseMode(text: string): Mode {
	if (/^[0-9]*$/.test(text)) return 'numeric';
	if ([...text].every((ch) => ALPHANUMERIC_CHARSET.includes(ch))) return 'alphanumeric';
	return 'byte';
}

/** UTF-8, as every modern scanner reads byte mode; a lone surrogate becomes U+FFFD. */
export const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));

/** One group of characters and the bits they become. */
export type DataGroup = { chars: string; value: number; bits: string };

/** A labelled run of the bit stream, in order. */
export type Field = {
	kind: 'mode' | 'count' | 'data' | 'terminator' | 'bit-padding' | 'pad-bytes';
	label: string;
	bits: string;
};

const binary = (value: number, width: number) => value.toString(2).padStart(width, '0');

/** Cuts the text into the groups its mode encodes together. */
export function dataGroups(text: string, mode: Mode): DataGroup[] {
	const out: DataGroup[] = [];
	if (mode === 'numeric') {
		for (let i = 0; i < text.length; i += 3) {
			const chars = text.slice(i, i + 3);
			const value = Number(chars);
			out.push({ chars, value, bits: binary(value, [0, 4, 7, 10][chars.length]) });
		}
	} else if (mode === 'alphanumeric') {
		for (let i = 0; i < text.length; i += 2) {
			const chars = text.slice(i, i + 2);
			const a = ALPHANUMERIC_CHARSET.indexOf(chars[0]);
			if (chars.length === 2) {
				const value = 45 * a + ALPHANUMERIC_CHARSET.indexOf(chars[1]);
				out.push({ chars, value, bits: binary(value, 11) });
			} else out.push({ chars, value: a, bits: binary(a, 6) });
		}
	} else {
		for (const ch of text) {
			for (const [k, byte] of utf8(ch).entries())
				out.push({ chars: k === 0 ? ch : '', value: byte, bits: binary(byte, 8) });
		}
	}
	return out;
}

/** Number of characters the count field records: bytes in byte mode. */
export const charCount = (text: string, mode: Mode) => (mode === 'byte' ? utf8(text).length : text.length);

/** The smallest version from `from` up that holds the text at this level, or 0 if none does. */
export function smallestVersion(text: string, ec: EcLevel, mode = chooseMode(text), from = 1): number {
	const count = charCount(text, mode);
	for (let v = from; v <= MAX_VERSION; v++) {
		const bits = 4 + charCountBits(mode, v) + dataBitLength(mode, count);
		if (count < 2 ** charCountBits(mode, v) && bits <= dataCodewords(v, ec) * 8) return v;
	}
	return 0;
}

/** The pad codewords 11101100 and 00010001, repeated until the data is full. */
export const PAD_BYTES = [0xec, 0x11];

/** The bit stream as labelled fields, and the data codewords it packs into. */
export function bitStream(text: string, mode: Mode, version: number, ec: EcLevel) {
	const capacityBits = dataCodewords(version, ec) * 8;
	const groups = dataGroups(text, mode);
	const count = charCount(text, mode);
	const fields: Field[] = [
		{ kind: 'mode', label: 'Mode indicator', bits: MODE_INDICATOR[mode] },
		{ kind: 'count', label: 'Character count', bits: binary(count, charCountBits(mode, version)) },
		{ kind: 'data', label: 'Data', bits: groups.map((g) => g.bits).join('') }
	];
	let length = fields.reduce((n, f) => n + f.bits.length, 0);
	if (length > capacityBits) throw new QrError('The data does not fit this version');
	const terminator = Math.min(4, capacityBits - length);
	fields.push({ kind: 'terminator', label: 'Terminator', bits: '0'.repeat(terminator) });
	length += terminator;
	const fill = (8 - (length % 8)) % 8;
	fields.push({ kind: 'bit-padding', label: 'Zeros to a whole byte', bits: '0'.repeat(fill) });
	length += fill;
	const padCount = (capacityBits - length) / 8;
	const pads = Array.from({ length: padCount }, (_, i) => PAD_BYTES[i % 2]);
	fields.push({ kind: 'pad-bytes', label: 'Pad bytes', bits: pads.map((p) => binary(p, 8)).join('') });
	const all = fields.map((f) => f.bits).join('');
	const codewords: number[] = [];
	for (let i = 0; i < all.length; i += 8) codewords.push(parseInt(all.slice(i, i + 8), 2));
	return { fields, groups, count, codewords, padCount };
}

// --- The symbol -------------------------------------------------------------

export const ROLES = [
	'finder',
	'separator',
	'timing',
	'alignment',
	'dark',
	'format',
	'version',
	'data',
	'ec',
	'remainder'
] as const;
export type Role = typeof ROLES[number];

/** What a module is: its role, and for codewords and information bits, which one. */
export type ModuleInfo = {
	role: Role;
	/** Position in the placement order, from 0; -1 for modules outside codewords. */
	codeword: number;
	/** Bit within the codeword (7 is the most significant) or within the format or version information. */
	bit: number;
	/** 1 or 2 for the two copies of the format and version information. */
	copy: number;
};

export type Block = { data: number[]; ec: number[] };

export type QrCode = {
	text: string;
	mode: Mode;
	ec: EcLevel;
	version: number;
	size: number;
	mask: number;
	/** The smallest version the text fits, which the version is when chosen automatically. */
	minVersion: number;
	fields: Field[];
	groups: DataGroup[];
	count: number;
	padCount: number;
	dataCodewords: number[];
	blocks: Block[];
	/** The codewords in the order they are placed: data interleaved, then error correction interleaved. */
	sequence: number[];
	/** Where each placed codeword came from. */
	origin: { kind: 'data' | 'ec'; block: number; index: number }[];
	/** The finished symbol. */
	modules: boolean[][];
	/** The same symbol before masking, with the chosen mask's format information. */
	unmasked: boolean[][];
	info: ModuleInfo[][];
	penalties: Penalty[];
	formatBits: number;
	versionBits: number;
	remainderBits: number;
};

export type EncodeOptions = { ec?: EcLevel; version?: number | 'auto'; mask?: number | 'auto' };

/** Encodes the text into a QR code, choosing the version and the mask unless they are given. */
export function encodeQr(text: string, options: EncodeOptions = {}): QrCode {
	const ec = options.ec ?? 'M';
	const mode = chooseMode(text);
	const count = charCount(text, mode);
	const minVersion = smallestVersion(text, ec, mode);
	if (!minVersion) {
		const max = capacity(MAX_VERSION, ec, mode);
		const unit = mode === 'byte' ? 'bytes' : 'characters';
		throw new QrError(
			`That is ${count} ${unit} in ${mode} mode, and the largest QR code holds ${max} at level ${ec}` +
				(ec === 'L' ? '.' : '. A lower error correction level fits more.')
		);
	}
	let version = minVersion;
	if (options.version !== undefined && options.version !== 'auto') {
		checkVersion(options.version);
		if (options.version < minVersion)
			throw new QrError(
				`It does not fit version ${options.version} at level ${ec}: the smallest version that holds it is ${minVersion}.`
			);
		version = options.version;
	}
	const size = symbolSize(version);
	const stream = bitStream(text, mode, version, ec);

	// Split into blocks, add each block's error correction, interleave.
	const blocks: Block[] = [];
	let offset = 0;
	for (const group of blockLayout(version, ec))
		for (let b = 0; b < group.count; b++) {
			const data = stream.codewords.slice(offset, offset + group.data);
			offset += group.data;
			blocks.push({ data, ec: rsRemainder(data, group.ec) });
		}
	const sequence: number[] = [];
	const origin: QrCode['origin'] = [];
	const longest = Math.max(...blocks.map((b) => b.data.length));
	for (let i = 0; i < longest; i++)
		blocks.forEach((block, b) => {
			if (i < block.data.length) {
				sequence.push(block.data[i]);
				origin.push({ kind: 'data', block: b, index: i });
			}
		});
	const perEc = ecCodewordsPerBlock(version, ec);
	for (let i = 0; i < perEc; i++)
		blocks.forEach((block, b) => {
			sequence.push(block.ec[i]);
			origin.push({ kind: 'ec', block: b, index: i });
		});

	// Function patterns first, so the data placement knows which modules to skip.
	const grid: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
	const info: ModuleInfo[][] = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => ({ role: 'data' as Role, codeword: -1, bit: -1, copy: 0 }))
	);
	const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
	const set = (x: number, y: number, dark: boolean, role: Role, bit = -1, copy = 0) => {
		grid[y][x] = dark;
		info[y][x] = { role, codeword: -1, bit, copy };
		reserved[y][x] = true;
	};

	for (let i = 0; i < size; i++) {
		set(6, i, i % 2 === 0, 'timing');
		set(i, 6, i % 2 === 0, 'timing');
	}
	for (const [cx, cy] of [
		[3, 3],
		[size - 4, 3],
		[3, size - 4]
	])
		for (let dy = -4; dy <= 4; dy++)
			for (let dx = -4; dx <= 4; dx++) {
				const x = cx + dx;
				const y = cy + dy;
				if (x < 0 || y < 0 || x >= size || y >= size) continue;
				const dist = Math.max(Math.abs(dx), Math.abs(dy));
				set(x, y, dist !== 2 && dist !== 4, dist === 4 ? 'separator' : 'finder');
			}
	const align = alignmentPositions(version);
	const last = align.length - 1;
	for (let i = 0; i <= last; i++)
		for (let j = 0; j <= last; j++) {
			// The three corners already hold finder patterns.
			if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
			for (let dy = -2; dy <= 2; dy++)
				for (let dx = -2; dx <= 2; dx++)
					set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, 'alignment');
		}

	// The format information is written per mask below; reserve its modules now.
	const drawFormat = (target: boolean[][], bits: number, mark: boolean) => {
		const put = (x: number, y: number, i: number, copy: number) => {
			target[y][x] = ((bits >>> i) & 1) === 1;
			if (mark) {
				info[y][x] = { role: 'format', codeword: -1, bit: i, copy };
				reserved[y][x] = true;
			}
		};
		for (let i = 0; i <= 5; i++) put(8, i, i, 1);
		put(8, 7, 6, 1);
		put(8, 8, 7, 1);
		put(7, 8, 8, 1);
		for (let i = 9; i < 15; i++) put(14 - i, 8, i, 1);
		for (let i = 0; i < 8; i++) put(size - 1 - i, 8, i, 2);
		for (let i = 8; i < 15; i++) put(8, size - 15 + i, i, 2);
	};
	drawFormat(grid, 0, true);
	// The dark module, always dark, beside the lower left format copy.
	set(8, size - 8, true, 'dark');

	const vBits = version >= 7 ? versionBits(version) : 0;
	if (version >= 7)
		for (let i = 0; i < 18; i++) {
			const dark = ((vBits >>> i) & 1) === 1;
			const a = size - 11 + (i % 3);
			const b = Math.floor(i / 3);
			set(a, b, dark, 'version', i, 1);
			set(b, a, dark, 'version', i, 2);
		}

	// The codewords, two columns at a time from the right, up then down,
	// skipping the vertical timing column. Leftover modules are remainder bits.
	const totalBits = sequence.length * 8;
	let n = 0;
	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) right = 5;
		const upward = ((right + 1) & 2) === 0;
		for (let vert = 0; vert < size; vert++)
			for (let j = 0; j < 2; j++) {
				const x = right - j;
				const y = upward ? size - 1 - vert : vert;
				if (reserved[y][x]) continue;
				if (n < totalBits) {
					const cw = n >>> 3;
					const bit = 7 - (n & 7);
					grid[y][x] = ((sequence[cw] >>> bit) & 1) === 1;
					info[y][x] = { role: origin[cw].kind, codeword: cw, bit, copy: 0 };
				} else info[y][x] = { role: 'remainder', codeword: -1, bit: -1, copy: 0 };
				n++;
			}
	}

	const masked = (k: number) => {
		const out = grid.map((row, y) => row.map((dark, x) => (reserved[y][x] ? dark : dark !== MASKS[k].test(x, y))));
		drawFormat(out, formatBits(ec, k), false);
		return out;
	};
	const candidates = MASKS.map((_, k) => masked(k));
	const penalties = candidates.map((matrix, k) => penalty(matrix, k));
	let mask: number;
	if (options.mask !== undefined && options.mask !== 'auto') {
		if (!Number.isInteger(options.mask) || options.mask < 0 || options.mask > 7)
			throw new QrError('The mask is a number from 0 to 7');
		mask = options.mask;
	} else mask = penalties.reduce((best, p) => (p.total < penalties[best].total ? p.mask : best), 0);
	const fBits = formatBits(ec, mask);
	const unmasked = grid.map((row) => row.slice());
	drawFormat(unmasked, fBits, false);

	return {
		text,
		mode,
		ec,
		version,
		size,
		mask,
		minVersion,
		fields: stream.fields,
		groups: stream.groups,
		count,
		padCount: stream.padCount,
		dataCodewords: stream.codewords,
		blocks,
		sequence,
		origin,
		modules: candidates[mask],
		unmasked,
		info,
		penalties,
		formatBits: fBits,
		versionBits: vBits,
		remainderBits: remainderBits(version)
	};
}

// --- Drawing ----------------------------------------------------------------

/**
 * An SVG path covering the chosen modules, one rectangle per horizontal run,
 * so even version 40 is a single short-ish element rather than thousands.
 */
export function runsPath(size: number, include: (x: number, y: number) => boolean, offset = 0): string {
	const parts: string[] = [];
	for (let y = 0; y < size; y++) {
		let x = 0;
		while (x < size) {
			if (!include(x, y)) {
				x++;
				continue;
			}
			const start = x;
			while (x < size && include(x, y)) x++;
			parts.push(`M${start + offset} ${y + offset}h${x - start}v1h${start - x}z`);
		}
	}
	return parts.join('');
}

/** Paths for each role, split into dark and light modules, for the anatomy view. */
export function rolePaths(qr: QrCode, masked = true): Record<Role, { dark: string; light: string }> {
	const matrix = masked ? qr.modules : qr.unmasked;
	const out = {} as Record<Role, { dark: string; light: string }>;
	for (const role of ROLES)
		out[role] = {
			dark: runsPath(qr.size, (x, y) => qr.info[y][x].role === role && matrix[y][x]),
			light: runsPath(qr.size, (x, y) => qr.info[y][x].role === role && !matrix[y][x])
		};
	return out;
}

/**
 * The outline of every codeword: an edge wherever a module's neighbour belongs
 * to a different codeword (or none). Edges on the same line are merged.
 */
export function codewordOutlines(qr: QrCode): string {
	const id = (x: number, y: number) => (x < 0 || y < 0 || x >= qr.size || y >= qr.size ? -1 : qr.info[y][x].codeword);
	const parts: string[] = [];
	// Horizontal edges at the top of row y, vertical edges at the left of column x.
	for (let y = 0; y <= qr.size; y++) {
		let start = -1;
		for (let x = 0; x <= qr.size; x++) {
			const a = id(x, y - 1);
			const b = id(x, y);
			const edge = x < qr.size && a !== b && (a >= 0 || b >= 0);
			if (edge && start < 0) start = x;
			if (!edge && start >= 0) {
				parts.push(`M${start} ${y}H${x}`);
				start = -1;
			}
		}
	}
	for (let x = 0; x <= qr.size; x++) {
		let start = -1;
		for (let y = 0; y <= qr.size; y++) {
			const a = id(x - 1, y);
			const b = id(x, y);
			const edge = y < qr.size && a !== b && (a >= 0 || b >= 0);
			if (edge && start < 0) start = y;
			if (!edge && start >= 0) {
				parts.push(`M${x} ${start}V${y}`);
				start = -1;
			}
		}
	}
	return parts.join('');
}

/**
 * Where to write each codeword's number: the centre of its modules, or the
 * nearest of its own modules when the centre falls outside it (codewords that
 * bend round an alignment pattern or the timing column).
 */
export function codewordLabels(qr: QrCode): { n: number; x: number; y: number; kind: 'data' | 'ec' }[] {
	const cells: [number, number][][] = qr.sequence.map(() => []);
	for (let y = 0; y < qr.size; y++)
		for (let x = 0; x < qr.size; x++) {
			const cw = qr.info[y][x].codeword;
			if (cw >= 0) cells[cw].push([x, y]);
		}
	return cells.map((list, n) => {
		const cx = list.reduce((s, c) => s + c[0] + 0.5, 0) / list.length;
		const cy = list.reduce((s, c) => s + c[1] + 0.5, 0) / list.length;
		const inside = list.some(([x, y]) => Math.abs(x + 0.5 - cx) <= 0.5 && Math.abs(y + 0.5 - cy) <= 0.5);
		const pairInside = list.some(([x, y]) => x + 1 === Math.round(cx) && Math.abs(y + 0.5 - cy) <= 0.5);
		if (inside || pairInside) return { n, x: cx, y: cy, kind: qr.origin[n].kind };
		let best = list[0];
		for (const c of list)
			if (Math.hypot(c[0] + 0.5 - cx, c[1] + 0.5 - cy) < Math.hypot(best[0] + 0.5 - cx, best[1] + 0.5 - cy)) best = c;
		return { n, x: best[0] + 0.5, y: best[1] + 0.5, kind: qr.origin[n].kind };
	});
}

/** The standard asks for a quiet zone of four light modules on every side. */
export const QUIET_ZONE = 4;

/** A plain black on white SVG of the symbol with its quiet zone, for download. */
export function qrSvg(modules: boolean[][], moduleSize = 10, quiet = QUIET_ZONE): string {
	const size = modules.length;
	const full = (size + 2 * quiet) * moduleSize;
	const path = runsPath(size, (x, y) => modules[y][x], quiet);
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${full}" viewBox="0 0 ${size + 2 * quiet} ${
			size + 2 * quiet
		}" shape-rendering="crispEdges">` +
		`<rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="${path}"/></svg>`
	);
}

/** Two hex digits per codeword, upper case. */
export const hexByte = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

/** What a module is, in words, for the inspector under the symbol. */
export function describeModule(qr: QrCode, x: number, y: number): string {
	const m = qr.info[y][x];
	const where = `Row ${y}, column ${x}`;
	const masked = qr.modules[y][x];
	const colour = masked ? 'dark' : 'light';
	switch (m.role) {
		case 'finder':
			return `${where}: finder pattern, ${colour}.`;
		case 'separator':
			return `${where}: separator, the light border around a finder pattern.`;
		case 'timing':
			return `${where}: timing pattern, ${colour}. Timing modules alternate, so a reader can count columns and rows.`;
		case 'alignment':
			return `${where}: alignment pattern, ${colour}.`;
		case 'dark':
			return `${where}: the dark module, which is dark in every QR code.`;
		case 'format':
			return `${where}: format information, copy ${m.copy}, bit ${m.bit} of 15, ${colour}.`;
		case 'version':
			return `${where}: version information, copy ${m.copy}, bit ${m.bit} of 18, ${colour}.`;
		case 'remainder':
			return `${where}: remainder bit, a spare module after the last codeword (0 before masking), ${colour}.`;
		default: {
			const o = qr.origin[m.codeword];
			const kind = o.kind === 'data' ? 'data' : 'error correction';
			const value = qr.sequence[m.codeword];
			const raw = (value >>> m.bit) & 1;
			const flipped = raw !== Number(masked);
			return `${where}: codeword ${m.codeword + 1} (${kind} ${o.index + 1} of block ${o.block + 1}, 0x${hexByte(
				value
			)}), bit ${m.bit}. The bit is ${raw}${flipped ? ', inverted by the mask,' : ''} so the module is ${colour}.`;
		}
	}
}
