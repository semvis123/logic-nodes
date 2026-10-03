// File signatures, checked three ways: real files made by real tools (Python's
// zipfile, gzip and tarfile, javac, clang and lld, ffmpeg, Pillow), minimal
// files built here byte by byte from the format specifications, and, where it
// is installed, the Unix file command, an independent implementation with its
// own magic database. Then the page, as a reader would use it.

import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	ByteView,
	fromBytes,
	detect,
	parseHex,
	HexError,
	checkExtension,
	extensionOf,
	partialMatches,
	hexDump,
	dumpText,
	readZip,
	mpegFrame,
	javaRelease,
	signatureTable,
	byteOrders,
	stripDumpColumns,
	zipDirectoryStart,
	shebangProgram,
	withArticle,
	formatHexLines,
	EXAMPLES,
	PNG_SIGNATURE,
	HEAD_BYTES,
	TAIL_BYTES
} from '../src/lib/fileSignatures.js';
import { REAL } from './fileSignatures.fixtures.js';

const real = (name: string) => Uint8Array.from(Buffer.from(REAL[name].hex, 'hex'));
const top = (bytes: Uint8Array | number[]) => detect(fromBytes(bytes))[0];

/** Builds bytes from parts: 'AA BB' hex, { t: 'text' }, { pad: offset } to zero-fill up to an offset. */
type Part = string | { t: string } | { pad: number } | number[];
function build(...parts: Part[]): Uint8Array {
	const out: number[] = [];
	for (const p of parts) {
		if (typeof p === 'string')
			out.push(
				...p
					.split(/\s+/)
					.filter(Boolean)
					.map((h) => parseInt(h, 16))
			);
		else if (Array.isArray(p)) out.push(...p);
		else if ('t' in p) out.push(...Array.from(p.t, (c) => c.charCodeAt(0)));
		else while (out.length < p.pad) out.push(0);
	}
	return Uint8Array.from(out);
}
const u16be = (n: number) => [n >> 8, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16le = (n: number) => [n & 0xff, n >> 8];
const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** A deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x80000000;
	};
}

// --- Fixtures built by hand, each from its specification ----------------------

const HAND: Record<string, { bytes: Uint8Array; id: string; name?: RegExp }> = {
	'7z': { bytes: build('37 7A BC AF 27 1C 00 04', { pad: 32 }), id: '7z' },
	rar4: { bytes: build('52 61 72 21 1A 07 00 CF 90 73 00 00 0D 00'), id: 'rar', name: /RAR/ },
	rar5: { bytes: build('52 61 72 21 1A 07 01 00 33 92 B5 E5 0A 01 05 06'), id: 'rar' },
	zstd: { bytes: build('28 B5 2F FD 24 06 31 00 00 68 65 6C 6C 6F 0A'), id: 'zstd' },
	lz4: { bytes: build('04 22 4D 18 64 40 A7 06 00 00 80 68 65 6C 6C 6F 0A'), id: 'lz4' },
	cfb: { bytes: build('D0 CF 11 E0 A1 B1 1A E1', { pad: 24 }, '3E 00 03 00 FE FF 09 00', { pad: 512 }), id: 'cfb' },
	rtf: { bytes: build({ t: '{\\rtf1\\ansi Hello}' }), id: 'rtf' },
	ps: { bytes: build({ t: '%!PS-Adobe-3.0\n%%Pages: 1\nshowpage\n' }), id: 'ps' },
	eps: { bytes: build({ t: '%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 10 10\n' }), id: 'eps' },
	'eps-dos': { bytes: build('C5 D0 D3 C6 20 00 00 00', { pad: 32 }), id: 'eps-dos' },
	dex: { bytes: build({ t: 'dex\n035\0' }, { pad: 112 }), id: 'dex' },
	midi: {
		bytes: build({ t: 'MThd' }, '00 00 00 06 00 01 00 02 01 E0', { t: 'MTrk' }, '00 00 00 04 00 FF 2F 00'),
		id: 'midi'
	},
	woff: { bytes: build({ t: 'wOFF' }, '00 01 00 00', { pad: 44 }), id: 'woff' },
	ttc: { bytes: build({ t: 'ttcf' }, '00 01 00 00 00 00 00 01 00 00 00 10'), id: 'ttc' },
	psd: { bytes: build({ t: '8BPS' }, '00 01 00 00 00 00 00 00 00 03', u32be(48), u32be(64), '00 08 00 03'), id: 'psd' },
	psb: { bytes: build({ t: '8BPS' }, '00 02 00 00 00 00 00 00 00 03', u32be(48), u32be(64), '00 08 00 03'), id: 'psb' },
	'tiff-be': { bytes: build('4D 4D 00 2A 00 00 00 08 00 00'), id: 'tiff' },
	bigtiff: { bytes: build('49 49 2B 00 08 00 00 00 10 00 00 00 00 00 00 00'), id: 'tiff', name: /BigTIFF/ },
	cr2: { bytes: build('49 49 2A 00 10 00 00 00 43 52 02 00', { pad: 32 }), id: 'cr2' },
	cur: { bytes: build('00 00 02 00 01 00 20 20 00 00 01 00 01 00', u32le(40), u32le(22)), id: 'cur' },
	dicom: { bytes: build({ pad: 128 }, { t: 'DICM' }, '02 00 00 00 55 4C 04 00'), id: 'dicom' },
	iso: {
		bytes: build(
			{ pad: 0x8000 },
			'01',
			{ t: 'CD001' },
			'01 00',
			{ pad: 0x8028 },
			{ t: 'MY_DISC'.padEnd(32) },
			{ pad: 0x8800 }
		),
		id: 'iso'
	},
	opus: {
		bytes: build({ t: 'OggS' }, '00 02', { pad: 26 }, '01 13', { t: 'OpusHead' }, '01 01 38 01 80 BB 00 00 00 00 00'),
		id: 'ogg',
		name: /Opus/
	},
	theora: {
		bytes: build({ t: 'OggS' }, '00 02', { pad: 26 }, '01 2A 80', { t: 'theora' }, '03 02 01'),
		id: 'ogg',
		name: /Theora/
	},
	heic: { bytes: build(u32be(24), { t: 'ftypheic' }, '00 00 00 00', { t: 'mif1heic' }), id: 'heic' },
	'heif-heic': { bytes: build(u32be(24), { t: 'ftypmif1' }, '00 00 00 00', { t: 'mif1heic' }), id: 'heic' },
	'3gp': { bytes: build(u32be(20), { t: 'ftyp3gp4' }, '00 00 02 00', { t: '3gp4' }), id: '3gp' },
	'mov-old': { bytes: build(u32be(8), { t: 'wide' }, u32be(1000), { t: 'mdat' }), id: 'mov-old' },
	'ppc-macho': { bytes: build('FE ED FA CE', u32be(18), u32be(0), u32be(2), u32be(10)), id: 'macho' },
	'fat-64': { bytes: build('CA FE BA BF', u32be(1), u32be(0x0100000c), u32be(0)), id: 'macho-universal' },
	'dos-mz': {
		bytes: build({ t: 'MZ' }, '90 00 03 00', { pad: 0x3c }, u32le(0x40), { t: 'not a PE header' }),
		id: 'mz'
	},
	ne: { bytes: build({ t: 'MZ' }, { pad: 0x3c }, u32le(0x80), { pad: 0x80 }, { t: 'NE' }, '05 0A'), id: 'ne' },
	'flac-id3': {
		bytes: build({ t: 'ID3' }, '03 00 00 00 00 00 0A', { pad: 20 }, { t: 'fLaC' }, '00 00 00 22'),
		id: 'flac'
	},
	'utf8-bom-xml': { bytes: build('EF BB BF', { t: '<?xml version="1.0"?><note/>' }), id: 'xml' },
	'utf16le-html': {
		bytes: build('FF FE', ...Array.from('<!DOCTYPE html><p>hi', (c) => [c.charCodeAt(0), 0])),
		id: 'html'
	},
	'utf16be-text': { bytes: build('FE FF', ...Array.from('hello', (c) => [0, c.charCodeAt(0)])), id: 'utf16be-bom' },
	'utf32le-text': {
		bytes: build('FF FE 00 00', ...Array.from('hi', (c) => [c.charCodeAt(0), 0, 0, 0])),
		id: 'utf32le-bom'
	},
	'utf32be-text': {
		bytes: build('00 00 FE FF', ...Array.from('hi', (c) => [0, 0, 0, c.charCodeAt(0)])),
		id: 'utf32be-bom'
	},
	json: { bytes: build({ t: '{"name": "logic", "gates": [1, 2]}\n' }), id: 'json' },
	text: { bytes: build({ t: 'Just some notes,\nwith no signature at all.\n' }), id: 'text' },
	'env-shebang': {
		bytes: build({ t: '#!/usr/bin/env -S node --no-warnings\nconsole.log(1)\n' }),
		id: 'script',
		name: /JavaScript/
	},
	'bash-shebang': { bytes: build({ t: '#!/bin/bash\necho hi\n' }), id: 'script', name: /Shell/ }
};

// MP3 with no tag: MPEG-1 Layer III, 128 kbit/s, 44.1 kHz, no padding,
// so each frame is floor(144 × 128000 / 44100) = 417 bytes.
const frameHeader = 'FF FB 90 64';
HAND['mp3-frames'] = { bytes: build(frameHeader, { pad: 417 }, frameHeader, { pad: 834 }), id: 'mp3' };
HAND.aac = { bytes: build('FF F1 50 80 02 1F FC', { pad: 32 }), id: 'aac' };

// Files with a PDF inside, made with real tools: GNU tar (tar --format=gnu -cf
// doc.tar doc.pdf, cut to its first 600 bytes) and Python's zipfile with
// ZIP_STORED, plus the start of an audio-only MP4 from ffmpeg (isom brand).
const INSIDE: Record<string, { hex: string }> = {
	'doc.tar': {
		hex: '646f632e706466000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000303030303634340030303030303030003030303030303000303030303030303030363600313532363030313234343400303131303134002030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007573746172202000726f6f7400000000000000000000000000000000000000000000000000000000726f6f7400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000255044462d312e340a25e2e3cfd30a312030206f626a0a3c3c3e3e0a656e646f626a0a747261696c65720a3c3c3e3e0a2525454f460a00000000000000000000000000000000000000000000000000000000000000000000'
	},
	'stored.zip': {
		hex: '504b030414000000000034a4425dda361c71360000003600000007000000646f632e706466255044462d312e340a25e2e3cfd30a312030206f626a0a3c3c3e3e0a656e646f626a0a747261696c65720a3c3c3e3e0a2525454f460a504b0102140314000000000034a4425dda361c713600000036000000070000000000000000000000a48100000000646f632e706466504b05060000000001000100350000005b0000000000'
	},
	'voice.m4a': {
		hex: '0000001c6674797069736f6d0000020069736f6d69736f326d7034310000000866726565000008166d646174de02004c'
	}
};

// --- A ZIP writer, written independently of the reader -----------------------

/** Stored entries, with the data-descriptor flag so local headers carry no sizes. */
function zipWithDescriptors(entries: [string, string][], comment = ''): Uint8Array {
	const local: number[] = [];
	const central: number[] = [];
	for (const [name, data] of entries) {
		const offset = local.length;
		const n = Array.from(name, (c) => c.charCodeAt(0));
		const d = Array.from(data, (c) => c.charCodeAt(0));
		local.push(
			...u32le(0x04034b50),
			...u16le(20),
			...u16le(8),
			...u16le(0),
			...u32le(0),
			...u32le(0),
			...u32le(0),
			...u32le(0),
			...u16le(n.length),
			...u16le(0),
			...n,
			...d
		);
		local.push(...u32le(0x08074b50), ...u32le(0), ...u32le(d.length), ...u32le(d.length));
		central.push(
			...u32le(0x02014b50),
			...u16le(20),
			...u16le(20),
			...u16le(8),
			...u16le(0),
			...u32le(0),
			...u32le(0),
			...u32le(d.length),
			...u32le(d.length)
		);
		central.push(
			...u16le(n.length),
			...u16le(0),
			...u16le(0),
			...u16le(0),
			...u16le(0),
			...u32le(0),
			...u32le(offset),
			...n
		);
	}
	const c = Array.from(comment, (ch) => ch.charCodeAt(0));
	const end = [
		...u32le(0x06054b50),
		...u16le(0),
		...u16le(0),
		...u16le(entries.length),
		...u16le(entries.length),
		...u32le(central.length),
		...u32le(local.length),
		...u16le(c.length),
		...c
	];
	return Uint8Array.from([...local, ...central, ...end]);
}

/** What a page reading a File would see: the head and the tail, with the middle unread. */
function asFile(bytes: Uint8Array, head = HEAD_BYTES, tail = TAIL_BYTES): ByteView {
	return new ByteView(
		bytes.subarray(0, Math.min(head, bytes.length)),
		bytes.length,
		bytes.subarray(Math.max(0, bytes.length - tail))
	);
}

// --- What the real files are -------------------------------------------------

const EXPECTED: Record<string, string> = {
	'tiny.png': 'png',
	'tiny.jpg': 'jpeg',
	'tiny.gif': 'gif',
	'tiny.webp': 'webp',
	'tiny.bmp': 'bmp',
	'tiny.tif': 'tiff',
	'tiny.ico': 'ico',
	'tiny.pdf': 'pdf',
	'plain.zip': 'zip',
	'doc.docx': 'docx',
	'book.xlsx': 'xlsx',
	'deck.pptx': 'pptx',
	'book.epub': 'epub',
	'text.odt': 'odt',
	'app.apk': 'apk',
	'hi.jar': 'jar',
	'empty.zip': 'zip',
	'hello.gz': 'gzip',
	'named.gz': 'gzip',
	'hello.bz2': 'bzip2',
	'hello.xz': 'xz',
	'ustar.tar': 'tar',
	'gnu.tar': 'tar',
	'db-head.sqlite': 'sqlite',
	'tiny.wav': 'wav',
	'hello.exe': 'pe',
	'lib.dll': 'dll',
	'arm.exe': 'pe',
	'x86.exe': 'pe',
	elf64: 'elf',
	elf32: 'elf',
	'libs.so': 'elf',
	'sarm.o': 'elf',
	'sarm7.o': 'elf',
	'ppc.o': 'elf',
	'mach32.o': 'macho',
	'mach64.o': 'macho',
	'macharm.o': 'macho',
	'fat.o': 'macho-universal',
	'Hi.class': 'cafebabe',
	'Hi8.class': 'cafebabe',
	's.wasm': 'wasm',
	'tone.mp3': 'mp3',
	'tone.ogg': 'ogg',
	'tone.flac': 'flac',
	'tone.aiff': 'aiff',
	'tone.m4a': 'm4a',
	'clip.mp4': 'mp4',
	'clip.mov': 'mov',
	'clip.avi': 'avi',
	'clip.mkv': 'mkv',
	'clip.webm': 'webm',
	'tiny.avif': 'avif',
	'font.ttf': 'ttf',
	'font.otf': 'otf',
	'font.woff2': 'woff2',
	'hello.py': 'script',
	'dot.svg': 'svg',
	'notfound.html': 'html'
};

/** What the file command says for each of our ids, as a pattern. */
const FILE_SAYS: Record<string, RegExp> = {
	png: /^PNG image/,
	jpeg: /^JPEG image/,
	gif: /^GIF image/,
	webp: /Web\/P image/,
	bmp: /^PC bitmap/,
	tiff: /TIFF image/,
	ico: /icon resource/,
	pdf: /^PDF document/,
	zip: /^Zip archive/,
	docx: /Microsoft Word 2007/,
	xlsx: /Microsoft Excel 2007/,
	pptx: /Microsoft PowerPoint 2007/,
	epub: /EPUB/,
	odt: /OpenDocument Text/,
	apk: /Android package/,
	jar: /Java archive/,
	gzip: /^gzip compressed/,
	bzip2: /^bzip2 compressed/,
	xz: /^XZ compressed/,
	tar: /tar archive/,
	sqlite: /^SQLite 3/,
	wav: /WAVE audio/,
	pe: /^PE32\+? executable/,
	dll: /\(DLL\)/,
	elf: /^ELF/,
	macho: /^Mach-O/,
	'macho-universal': /^Mach-O universal binary/,
	cafebabe: /compiled Java class/,
	wasm: /WebAssembly/,
	mp3: /MPEG ADTS, layer III|ID3/,
	ogg: /^Ogg data/,
	flac: /FLAC audio/,
	aiff: /AIFF audio/,
	m4a: /M4A/,
	mp4: /ISO Media/,
	mov: /QuickTime/,
	avi: /AVI/,
	mkv: /Matroska/,
	webm: /WebM/,
	avif: /AVIF/,
	ttf: /TrueType Font/,
	otf: /OpenType font/,
	woff2: /Web Open Font Format \(Version 2\)/,
	script: /script/,
	svg: /SVG/,
	html: /HTML document/,
	'7z': /^7-zip archive/,
	rar: /^RAR archive/,
	zstd: /Zstandard/,
	lz4: /LZ4/,
	cfb: /Composite Document File/,
	rtf: /Rich Text Format/,
	ps: /PostScript/,
	eps: /PostScript/,
	'eps-dos': /PostScript|EPS/,
	midi: /MIDI/,
	woff: /Web Open Font Format/,
	psd: /Photoshop/,
	psb: /Photoshop/,
	cr2: /Canon CR2|TIFF/,
	dicom: /DICOM/,
	iso: /ISO 9660/,
	heic: /HEIF|HEIC/,
	'3gp': /3GPP/,
	json: /JSON/,
	text: /text/,
	xml: /XML/
};

const fileCommand = (() => {
	try {
		execFileSync('file', ['--version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
})();

test.describe('reading pasted hex', () => {
	test('accepts the usual ways of writing bytes', () => {
		const want = [0x89, 0x50, 0x4e, 0x47];
		for (const text of [
			'89 50 4E 47',
			'89504e47',
			'0x89, 0x50, 0x4E, 0x47',
			'\\x89\\x50\\x4e\\x47',
			'89:50:4e:47',
			'  89 50\n4E 47\n',
			'8950 4E47'
		]) {
			expect(Array.from(parseHex(text)), text).toEqual(want);
		}
		expect(parseHex('').length).toBe(0);
	});

	test('names the problem with a bad paste', () => {
		const message = (text: string) => {
			try {
				parseHex(text);
			} catch (e) {
				expect(e).toBeInstanceOf(HexError);
				return (e as Error).message;
			}
			throw new Error('expected a HexError');
		};
		expect(message('89 50 4G')).toContain('“4G” contains “G”');
		// xxd output whose text column cannot be told from bytes gets a hint about the columns.
		expect(message('00000000: 8950 4e47 zz')).toContain('without the offset and text columns');
		expect(message('0D A')).toContain('“A” has an odd number of digits');
		expect(message('895')).toContain('odd number');
	});

	test('hex dumps from od, hexdump -C and xxd paste as their bytes, not their offsets', () => {
		const want = '89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52 00 00 00 01 00';
		const bytes = (text: string) => formatHexLines(parseHex(text), 64);
		// Captured from od -A x -t x1 and xxd on the same 21 bytes; hexdump -C lays out as below.
		const od = '000000 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52\n000010 00 00 00 01 00\n000015\n';
		const hexdumpC =
			'00000000  89 50 4e 47 0d 0a 1a 0a  00 00 00 0d 49 48 44 52  |.PNG........IHDR|\n' +
			'00000010  00 00 00 01 00                                    |.....|\n00000015\n';
		const xxd =
			'00000000: 8950 4e47 0d0a 1a0a 0000 000d 4948 4452  .PNG........IHDR\n' +
			'00000010: 0000 0001 00                             .....\n';
		for (const text of [od, hexdumpC, xxd]) expect(bytes(text), text).toBe(want);
		// The checker's own copied dump pastes back too.
		const v = fromBytes(parseHex(want));
		expect(bytes(dumpText(hexDump(v, [])))).toBe(want);
		// Run-together bytes and plain byte lists are left alone.
		expect(stripDumpColumns('89504e470d0a1a0a 0000000d49484452')).toBe('89504e470d0a1a0a 0000000d49484452');
		expect(stripDumpColumns('89 50 4E 47')).toBe('89 50 4E 47');
		// 16-bit word dumps (plain hexdump) would come out byte-swapped, so they are not touched.
		expect(stripDumpColumns('0000000 5089 474e')).toBe('0000000 5089 474e');
	});

	test('agrees with Buffer on random bytes, through the formatter', () => {
		const random = rng(7);
		for (let n = 0; n < 200; n++) {
			const bytes = Uint8Array.from({ length: Math.floor(random() * 80) }, () => Math.floor(random() * 256));
			expect(Buffer.from(parseHex(formatHexLines(bytes))).equals(Buffer.from(bytes))).toBe(true);
			expect(Buffer.from(parseHex(Buffer.from(bytes).toString('hex'))).equals(Buffer.from(bytes))).toBe(true);
		}
	});
});

test.describe('detecting formats', () => {
	test('every real file is what the tool that made it says', () => {
		for (const [name, id] of Object.entries(EXPECTED)) {
			const found = detect(fromBytes(real(name)));
			expect(found[0]?.id, `${name} (${REAL[name].made})`).toBe(id);
		}
		expect(Object.keys(REAL).sort()).toEqual(Object.keys(EXPECTED).sort());
	});

	test('every hand-built file is detected from its specification bytes', () => {
		for (const [name, { bytes, id, name: pattern }] of Object.entries(HAND)) {
			const found = top(bytes);
			expect(found?.id, name).toBe(id);
			if (pattern) expect(found.name, name).toMatch(pattern);
		}
	});

	test('the file command agrees on the real files and the hand-built ones', () => {
		test.skip(!fileCommand, 'the file command is not installed');
		const dir = mkdtempSync(join(tmpdir(), 'fsig-'));
		const disagree: string[] = [];
		const all: [string, Uint8Array, string][] = [
			...Object.entries(EXPECTED).map(([n, id]) => [n, real(n), id] as [string, Uint8Array, string]),
			...Object.entries(HAND)
				.filter(([, h]) => FILE_SAYS[h.id])
				.map(([n, h]) => [n, h.bytes, h.id] as [string, Uint8Array, string])
		];
		for (const [name, bytes, id] of all) {
			// The file command reads only the start of the 512-byte cut fixtures, the same as the checker.
			const path = join(dir, name.replace(/[^\w.-]/g, '_'));
			writeFileSync(path, bytes);
			const says = execFileSync('file', ['-b', path]).toString().trim();
			if (!FILE_SAYS[id]?.test(says)) disagree.push(`${name}: we say ${id}, file says ${says}`);
		}
		// Two hand-built headers are too minimal for file's database: the DOS EPS
		// header has no PostScript behind it, and file does not list CAFEBABF.
		expect(disagree.filter((d) => !/^(eps-dos|fat-64):/.test(d))).toEqual([]);
	});

	test('CAFEBABE: a Java class or a Mach-O universal binary, decided by the next four bytes', () => {
		const java = top(real('Hi.class'));
		expect(java.id).toBe('cafebabe');
		expect(java.facts[0]).toBe('Class file version 65.0: Java 21');
		expect(top(real('Hi8.class')).facts[0]).toBe('Class file version 52.0: Java 8');
		const fat = top(real('fat.o'));
		expect(fat.id).toBe('macho-universal');
		expect(fat.facts[0]).toBe('2 architectures: x86-64, arm64');
		// The same eight bytes read as a class file version, major first as Java writes it.
		expect(fat.facts[1]).toBe('Read as a Java class, this would be version 2.0, which no Java release uses');
		// Every count of architectures up to 20 reads as Mach-O; every Java major version as Java.
		for (let n = 1; n <= 20; n++) expect(top(build('CA FE BA BE', u32be(n), u32be(7))).id).toBe('macho-universal');
		for (let major = 45; major <= 70; major++) {
			const d = top(build('CA FE BA BE 00 00', u16be(major)));
			expect(d.id).toBe('cafebabe');
			expect(d.facts[0]).toContain(javaRelease(major) as string);
		}
		// Preview features set the minor version to FFFF.
		expect(top(build('CA FE BA BE FF FF 00 41')).facts[0]).toContain('with preview features');
		// Just the magic: it cannot tell, and says so.
		const unsure = top(build('CA FE BA BE'));
		expect(unsure.certainty).toBe('likely');
		expect(unsure.name).toBe('Java class file or Mach-O universal binary');
		// Neither a small count nor a Java version: refused.
		expect(detect(fromBytes(build('CA FE BA BE 00 00 00 21')))).toEqual([]);
	});

	test('Java releases from class file major versions', () => {
		expect(javaRelease(44)).toBeNull();
		expect(javaRelease(45)).toBe('Java 1.0 or 1.1');
		expect(javaRelease(46)).toBe('Java 1.2');
		expect(javaRelease(48)).toBe('Java 1.4');
		expect(javaRelease(49)).toBe('Java 5');
		expect(javaRelease(52)).toBe('Java 8');
		expect(javaRelease(55)).toBe('Java 11');
		expect(javaRelease(61)).toBe('Java 17');
		expect(javaRelease(65)).toBe('Java 21');
	});

	test('decoded header facts match what the tools wrote', () => {
		const facts = (name: string) => top(real(name)).facts.join(' | ');
		expect(facts('tiny.png')).toBe('1 × 1 pixels | 8-bit greyscale');
		expect(facts('tiny.jpg')).toContain('2 × 1 pixels, baseline');
		expect(facts('tiny.gif')).toBe('2 × 1 pixels');
		expect(facts('tiny.bmp')).toBe('2 × 1 pixels, 24 bits per pixel');
		expect(facts('named.gz')).toContain('Original file name: notes.txt');
		expect(facts('ustar.tar')).toContain('The header checksum is correct');
		expect(facts('db-head.sqlite')).toContain('Page size 4,096 bytes');
		expect(facts('hello.exe')).toBe('For x86-64 | PE32+ (64-bit) | Subsystem: Windows console');
		expect(facts('x86.exe')).toBe('For x86 (32-bit) | PE32 (32-bit) | Subsystem: Windows console');
		expect(facts('arm.exe')).toContain('For ARM64');
		expect(facts('elf64')).toBe('64-bit, little-endian | Executable | For x86-64');
		expect(facts('ppc.o')).toContain('32-bit, big-endian');
		expect(facts('sarm.o')).toContain('AArch64');
		expect(facts('mach32.o')).toBe('32-bit, little-endian | For i386 | Object file');
		expect(facts('macharm.o')).toContain('For arm64');
		expect(facts('tone.mp3')).toContain('MPEG-1 Layer III, 56 kbit/s, 44.1 kHz, mono');
		expect(facts('tone.flac')).toBe('16-bit, mono, 44,100 Hz');
		expect(facts('tiny.wav')).toBe('PCM, 8-bit, mono, 8,000 Hz');
		expect(facts('font.ttf')).toBe('20 tables, the first FFTM');
		expect(facts('hello.xz')).toBe('Integrity check: CRC64');
		expect(facts('hello.bz2')).toBe('Block size 900 kB');
		expect(top(HAND.iso.bytes).facts).toContain('Volume label: MY_DISC');
		expect(top(HAND.midi.bytes).facts).toEqual(['Format 1: several tracks played together', '2 tracks']);
	});

	test('the tar checksum is recomputed, not trusted', () => {
		const bytes = real('ustar.tar');
		bytes[0] ^= 1; // rename the first entry without fixing the checksum
		expect(top(bytes).facts).toContain('The header checksum does not match');
	});

	test('weak signatures need their supporting bytes', () => {
		// BM, 00 00 01 00, 00 01 00 00 and ID3 are common by chance; each is backed by a check.
		expect(top(build({ t: 'BM is a set of initials' })).id).toBe('text');
		expect(top(build('00 00 01 00 00 00', { pad: 32 }))?.id).not.toBe('ico');
		const ttf = real('font.ttf');
		ttf[7] ^= 0x10; // break searchRange
		expect(top(ttf)?.id).not.toBe('ttf');
		expect(top(build({ t: 'BZh0' }))?.id).not.toBe('bzip2');
		// A box size that is not a multiple of 4 is not an ftyp box.
		expect(top(build(u32be(23), { t: 'ftypisom' }, { pad: 24 }))?.id).not.toBe('mp4');
	});

	test('MP3 frames: the second header sits exactly one frame length after the first', () => {
		const mp3 = fromBytes(real('tone.mp3'));
		const tag = 10 + 35;
		const first = mpegFrame(mp3, tag);
		expect(first).toMatchObject({ version: 'MPEG-1', layer: 3, bitrate: 56, rate: 44100, mono: true });
		// 144 × 56000 / 44100 = 182.857…, rounded down, plus the padding bit.
		expect(first?.length).toBe(182 + (((mp3.at(tag + 2) as number) >> 1) & 1));
		expect(mpegFrame(mp3, tag + (first?.length ?? 0))).not.toBeNull();
		const bare = top(HAND['mp3-frames'].bytes);
		expect(bare.certainty).toBe('certain');
		expect(bare.fields.map((f) => f.start)).toEqual([0, 417]);
		// A single header with nothing after it is only likely.
		expect(top(build(frameHeader, { pad: 100 })).certainty).toBe('likely');
	});

	test('ZIP entries come from the central directory when the local headers do not give sizes', () => {
		const names: [string, string][] = [
			['[Content_Types].xml', '<Types/>'],
			['_rels/.rels', '<Relationships/>'],
			...Array.from({ length: 30 }, (_, i) => [`docProps/part${i}.xml`, 'x'.repeat(400)] as [string, string]),
			['xl/workbook.xml', '<workbook/>']
		];
		const bytes = zipWithDescriptors(names, 'a comment at the end');
		// The whole file: the local walk stops at the first data descriptor, the directory gives the rest.
		const whole = readZip(fromBytes(bytes));
		expect(whole.fromDirectory).toBe(true);
		expect(whole.names).toEqual(names.map((n) => n[0]));
		expect(top(bytes).id).toBe('xlsx');
		// As a file read in two pieces, with a gap: the tail still holds the directory.
		const view = asFile(bytes, 64, 4000);
		expect(view.complete).toBe(false);
		expect(readZip(view).names).toContain('xl/workbook.xml');
		expect(detect(view)[0].id).toBe('xlsx');
		// Only the start: one entry, and it says it could not see the rest.
		const start = new ByteView(bytes.subarray(0, 64), bytes.length, new Uint8Array(0));
		const partial = detect(start)[0];
		expect(partial.id).toBe('ooxml');
		expect(partial.facts.join(' ')).toContain('central directory at the end of the file was not available');
	});

	test('a central directory too big for the tail is found and read from where it starts', () => {
		// 1,500 entries with long names: a directory of about 150 KB, more than the 64 KB tail.
		const names: [string, string][] = [
			['xl/media/image1.png', 'png'],
			...Array.from(
				{ length: 1500 },
				(_, i) => [`xl/worksheets/a_reasonably_long_sheet_name_for_testing_${i}.xml`, '<x/>'] as [string, string]
			),
			['[Content_Types].xml', '<Types/>']
		];
		const bytes = zipWithDescriptors(names);
		const read = asFile(bytes);
		expect(read.complete).toBe(false);
		// From the head and tail alone it is a plain ZIP, and it says what it could not see.
		expect(detect(read)[0].id).toBe('zip');
		const dirAt = zipDirectoryStart(read) as number;
		expect(bytes.length - dirAt).toBeGreaterThan(TAIL_BYTES);
		expect(Array.from(bytes.subarray(dirAt, dirAt + 4))).toEqual(u32le(0x02014b50));
		// Reading from there to the end, as the page does, finds the workbook.
		const again = new ByteView(bytes.subarray(0, HEAD_BYTES), bytes.length, bytes.subarray(dirAt));
		expect(detect(again)[0].id).toBe('xlsx');
		expect(zipDirectoryStart(again)).toBeNull();
		expect(zipDirectoryStart(fromBytes(real('plain.zip')))).toBeNull();
	});

	test('the EPUB and OpenDocument mimetype entry is read from the stored first entry', () => {
		expect(readZip(fromBytes(real('book.epub'))).mimetype).toBe('application/epub+zip');
		expect(readZip(fromBytes(real('text.odt'))).mimetype).toBe('application/vnd.oasis.opendocument.text');
		expect(readZip(fromBytes(real('plain.zip'))).mimetype).toBeNull();
		// APK has a MANIFEST.MF like a JAR, and is still an APK.
		expect(top(real('app.apk')).id).toBe('apk');
	});

	test('byte order marks, and the text behind them', () => {
		expect(top(HAND['utf8-bom-xml'].bytes).fields[0]).toMatchObject({ start: 0, length: 3 });
		const html = top(HAND['utf16le-html'].bytes);
		expect(html.id).toBe('html');
		expect(html.fields[1]).toMatchObject({ start: 2, length: 28 });
		// FF FE 00 00 is UTF-32LE, not UTF-16LE followed by a NUL character.
		expect(detect(fromBytes(HAND['utf32le-text'].bytes)).map((d) => d.id)).toEqual(['utf32le-bom']);
	});

	test('text gets the honest certainty it deserves', () => {
		expect(top(HAND.text.bytes).certainty).toBe('guess');
		expect(top(real('dot.svg')).certainty).toBe('likely');
		// #! is two bytes of convention, so a script is likely, as the page's FAQ says, never certain.
		expect(top(real('hello.py')).certainty).toBe('likely');
		for (const d of [top(HAND.text.bytes), top(real('dot.svg')), top(real('hello.py'))]) expect(d.textHint).toBe(true);
		expect(top(real('tiny.png')).textHint).toBe(false);
		// Binary that is not valid UTF-8 is not called text.
		expect(detect(fromBytes(build('C3 28 41 42')))).toEqual([]);
		expect(detect(fromBytes(build('41 42 00 43')))).toEqual([]);
		expect(shebangProgram('#!/usr/bin/env python3')).toBe('python3');
		expect(shebangProgram('#!/usr/bin/env -S deno run --allow-net')).toBe('deno');
		expect(shebangProgram('#! /bin/sh -e')).toBe('sh');
	});

	test('PDF headers count anywhere in the first 1024 bytes, but only at 0 for certain', () => {
		// A PDF with other bytes in front, with the usual binary comment line after the header.
		const late = build({ t: 'junk before the header\n' }, { t: '%PDF-2.0\n%' }, 'E2 E3 CF D3 0A');
		const d = top(late);
		expect(d.id).toBe('pdf');
		expect(d.certainty).toBe('likely');
		expect(d.facts).toEqual(['PDF version 2.0', 'The header starts at byte 23, after other data']);
		expect(top(real('tiny.pdf')).certainty).toBe('certain');
		expect(top(build({ pad: 1030 }, { t: '%PDF-1.4' }))?.id).not.toBe('pdf');
		// Text that mentions %PDF- is still text.
		expect(top(build({ t: 'Every PDF starts with %PDF- and a version.\n' })).id).toBe('text');
	});

	test('a container at its own offset outranks a PDF stored inside it', () => {
		const verdict = (name: string, bytes: Uint8Array) => checkExtension(name, detect(fromBytes(bytes)), bytes.length);
		for (const [name, id] of [
			['doc.tar', 'tar'],
			['stored.zip', 'zip']
		]) {
			const bytes = Uint8Array.from(Buffer.from(INSIDE[name].hex, 'hex'));
			const found = detect(fromBytes(bytes));
			expect(
				found.map((f) => f.id),
				name
			).toEqual([id, 'pdf']);
			expect(found[1].certainty).toBe('likely');
			expect(verdict(name, bytes)).toMatchObject({
				status: 'match',
				message: `The .${id} extension matches: it is a ${found[0].name}.`
			});
			// Named .pdf, it is not called a PDF outright, but the second reading is mentioned.
			expect(verdict('doc.pdf', bytes).message).toContain('also match a PDF document');
		}
		// A script that mentions the PDF header is still a script.
		const script = build({ t: '#!/usr/bin/env python3\n"""Checks PDF headers."""\nMAGIC = b"%PDF-"\n' });
		expect(detect(fromBytes(script)).map((d) => d.id)).toEqual(['script']);
		expect(verdict('parser.py', script).status).toBe('match');
		const c = build({ t: '/* checks */\nstatic const char magic[] = "%PDF-1.7";\n' });
		expect(verdict('pdfcheck.c', c).status).toBe('compatible');
	});

	test('ordinary text is not taken for a format that happens to share its first letters', () => {
		const verdict = (name: string, text: string) => {
			const bytes = build({ t: text });
			return [detect(fromBytes(bytes)).map((d) => d.id), checkExtension(name, detect(fromBytes(bytes)), bytes.length)];
		};
		// moov, mdat, wide and free at byte 4 used to make a QuickTime movie of English.
		for (const text of [
			'For free and open source software, see the list below.\n',
			"I'm free to go",
			'Set wide margins.',
			'The mdat box holds media.'
		]) {
			const [ids, v] = verdict('notes.txt', text);
			expect(ids, text).toEqual(['text']);
			expect((v as { status: string }).status).toBe('match');
		}
		// Short signatures that cannot be confirmed: text first, the format listed after it.
		for (const [text, other] of [
			['true\n', 'ttf'],
			['MZ\n', 'mz'],
			['BMW', 'bmp'],
			['ID3 tags are metadata\n', 'mp3'],
			['OTTO\n', 'otf'],
			['MZ is a pair of initials, and this line of text runs on for more than sixty-four bytes.\n', 'mz']
		]) {
			const [ids, v] = verdict('flag.txt', text);
			expect(ids, text).toEqual(['text', other]);
			expect((v as { status: string }).status, text).toBe('match');
		}
		expect((verdict('flag.json', 'true\n')[1] as { status: string }).status).toBe('compatible');
		// Longer signatures that are words too: a real file has binary bytes
		// right after them, so all-text bytes read as text, the format second.
		for (const [text, other] of [
			['GIF89a is a format\n', 'gif'],
			['fLaC is flac\n', 'flac'],
			['wOFF\n', 'woff'],
			['BZh9 compressed\n', 'bzip2']
		]) {
			const [ids, v] = verdict('words.txt', text);
			expect(ids, text).toEqual(['text', other]);
			expect((v as { status: string }).status, text).toBe('match');
		}
		expect((verdict('words.gif', 'GIF89a is a format\n')[1] as { status: string }).status).toBe('compatible');
		// A text format's own signature is not in doubt for being text.
		expect(verdict('a.pdf', '%PDF-1.4\n')[0]).toEqual(['pdf']);
		expect(top(real('tiny.gif')).certainty).toBe('certain');
		// With no text after it, a signature is the signature: the reference
		// table's own bytes, and a bzip2 start whose block magic is confirmed.
		for (const [text, id] of [
			['GIF89a', 'gif'],
			['GIF87a', 'gif'],
			['wOFF', 'woff'],
			['wOF2', 'woff2'],
			['fLaC', 'flac'],
			['ttcf', 'ttc'],
			['BZh9', 'bzip2'],
			['BZh91AY&SY', 'bzip2']
		]) {
			const [ids, v] = verdict(`a.${id === 'bzip2' ? 'bz2' : id}`, text);
			expect(ids[0], text).toBe(id);
			expect(top(build({ t: text })).certainty, text).toBe('certain');
			expect((v as { status: string }).status, text).toBe('match');
		}
		// Text listed ahead of a format does not claim that nothing matched.
		const words = detect(fromBytes(build({ t: 'GIF89a is a format\n' })));
		expect(words[0].explain).toMatch(/^The bytes start with the GIF image signature/);
		expect(words[0].explain).not.toMatch(/No signature matched/);
		// A real old QuickTime header still is one.
		expect(top(HAND['mov-old'].bytes).id).toBe('mov-old');
	});

	test('header values that the format does not allow are called out, not described', () => {
		const png = real('tiny.png');
		png.fill(0xab, 16, 26); // width, height, bit depth and colour type all AB
		const facts = top(png).facts;
		expect(facts).toContain('Width 2,880,154,539 is not allowed in PNG (the most is 2,147,483,647)');
		expect(facts).toContain('Colour type 171 is not a valid PNG colour type');
		expect(facts.join(' ')).not.toContain('pixels');
		const depth = real('tiny.png');
		depth[24] = 3; // 3-bit greyscale does not exist
		expect(top(depth).facts).toContain('Bit depth 3 is not valid for greyscale in PNG');
		expect(top(real('tiny.png')).fields.find((f) => f.label === 'Width')?.value).toBe('1');
	});

	test('fields are numbered in file order, with the signature marked', () => {
		const tar = top(real('ustar.tar'));
		const starts = tar.fields.map((f) => f.start);
		expect(starts).toEqual([...starts].sort((a, b) => a - b));
		expect(tar.fields.filter((f) => f.sig).map((f) => f.start)).toEqual([257]);
		expect(top(real('tiny.png')).fields[0]).toMatchObject({ start: 0, length: 8, sig: true });
	});

	test('older executables and position-independent ones are named for what they are', () => {
		expect(top(real('libs.so')).name).toBe('ELF shared object or PIE executable');
		const mz = (sig: string) => top(build({ t: 'MZ' }, { pad: 0x3c }, u32le(0x80), { pad: 0x80 }, { t: sig }, '00 00'));
		expect(mz('NE').name).toBe('16-bit Windows or OS/2 executable (NE)');
		expect(mz('LE').name).toBe('Linear executable (LE)');
		expect(mz('LX').name).toBe('32-bit OS/2 executable (LX)');
		// A whole paste whose PE pointer runs off the end says so, rather than blaming the read.
		const short = top(build({ t: 'MZ' }, '90 00', { pad: 0x3c }, u32le(0x1000), '00 00 00 00 B8 00 00 00'));
		expect(short.facts).toEqual(['The pointer at 0x3C says 0x1000, which is past the end of the file']);
		const cut = new ByteView(build({ t: 'MZ' }, '90 00', { pad: 0x3c }, u32le(0x1000)), 100_000, new Uint8Array(0));
		expect(detect(cut)[0].facts).toEqual(['The PE header would be at 0x1000, beyond the bytes read']);
	});

	test('text formats: the root element decides, and JSON is parsed whole', () => {
		const svg =
			'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg"/>';
		const doctype = top(build({ t: svg }));
		expect(doctype.id).toBe('svg');
		expect(doctype.fields[0].start).toBe(svg.indexOf('<svg'));
		expect(top(build({ t: '<?xml version="1.0"?>\n<!-- drawn by hand -->\n<svg width="1"/>' })).id).toBe('svg');
		// An svg element that is not the root does not make the file an SVG image.
		const opf = top(build({ t: '<?xml version="1.0"?><package><manifest><svg/></manifest></package>' }));
		expect(opf.id).toBe('xml');
		expect(top(build({ t: '<!-- generated -->\n<html lang="en"><body></body></html>' })).id).toBe('html');
		// JSON bigger than the 8 KB that is enough to judge text.
		const big = JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ id: i, ok: true })));
		expect(big.length).toBeGreaterThan(20_000);
		expect(top(build({ t: big })).id).toBe('json');
		expect(top(build({ t: big.slice(0, -1) })).id).toBe('text');
	});

	test('ISO 9660 needs 32 KB of bytes before its signature, and a file read gets them', () => {
		expect(HEAD_BYTES).toBeGreaterThan(0x8001 + 5);
		const big = new Uint8Array(1_000_000);
		big.set(HAND.iso.bytes);
		expect(detect(asFile(big))[0].id).toBe('iso');
	});

	test('empty and truncated input', () => {
		expect(detect(fromBytes([]))).toEqual([]);
		expect(partialMatches(fromBytes([0x89, 0x50, 0x4e, 0x47]))).toEqual([
			{ name: 'PNG image', have: 4, need: 8, hex: '89 50 4E 47 0D 0A 1A 0A', exts: ['png'] }
		]);
		expect(partialMatches(fromBytes([0x89])).map((p) => p.name)).toEqual(['PNG image']);
		// RIFF is the start of a 12-byte pattern, not a whole 4-byte signature.
		const riff = partialMatches(fromBytes(Array.from('RIFF', (c) => c.charCodeAt(0))));
		expect(riff.map((p) => p.name)).toEqual(['WebP image', 'WAV audio', 'AVI video']);
		expect(riff[0]).toMatchObject({ have: 4, need: 12, hex: '52 49 46 46 ?? ?? ?? ?? 57 45 42 50' });
		expect(partialMatches(fromBytes([0x52, 0x49]))[0].need).toBe(12);
		// A cut-off signature cannot prove the extension wrong.
		const mthd = fromBytes(build({ t: 'MThd' }));
		expect(checkExtension('a.mid', detect(mthd), 4, partialMatches(mthd))).toMatchObject({
			status: 'compatible',
			message:
				'.mid may be right: these 4 bytes are the start of the 8-byte MIDI file signature, and the data stops before the rest of it.'
		});
		expect(checkExtension('a.png', detect(mthd), 4, partialMatches(mthd)).status).toBe('mismatch');
		// A truncated ELF still says what it can.
		expect(top(build('7F 45 4C 46')).certainty).toBe('likely');
		// Every format with a signature at 0 survives being cut to any length without throwing.
		for (const row of signatureTable()) {
			const bytes = parseHex(row.hex.replace(/\?\?/g, '00').replace(/ at .*/, ''));
			for (let n = 0; n <= bytes.length; n++) expect(() => detect(fromBytes(bytes.subarray(0, n)))).not.toThrow();
		}
		// Random bytes never throw either.
		const random = rng(42);
		for (let n = 0; n < 2000; n++) {
			const bytes = Uint8Array.from({ length: Math.floor(random() * 600) }, () => Math.floor(random() * 256));
			if (random() < 0.5 && bytes.length > 8) bytes.set(real('tiny.png').subarray(0, 4 + Math.floor(random() * 4)));
			expect(() => detect(fromBytes(bytes))).not.toThrow();
		}
	});
});

test.describe('the reference table', () => {
	test('every row, written into a file, is detected as that format', () => {
		// Formats whose short signature is backed by further checks need more than the row shows.
		const needMore = new Set(['bmp', 'ico', 'ttf', 'otf', 'cafebabe', 'ftyp', 'mov-old', 'bzip2']);
		const families: Record<string, string[]> = { pe: ['mz'], psd: ['psb'], ico: ['cur'], mkv: ['ebml'] };
		for (const row of signatureTable()) {
			if (needMore.has(row.id) || row.hex.includes(' at ')) continue;
			// Filled with A rather than zeros, so FF FE is not read as FF FE 00 00.
			const bytes = new Uint8Array(row.offset + 64).fill(0x41);
			const sig = row.hex.split(' ').map((h) => (h === '??' ? 0 : parseInt(h, 16)));
			bytes.set(sig, row.offset);
			const found = detect(fromBytes(bytes)).map((d) => d.id);
			const ok = [row.id, ...(families[row.id] ?? [])];
			expect(
				found.some((id) => ok.includes(id) || id.startsWith(row.id)),
				`${row.name}: ${row.hex} at ${row.offset} gave ${found}`
			).toBe(true);
		}
	});

	test('it covers the formats the page promises', () => {
		const ids = new Set(signatureTable().map((r) => r.id));
		for (const id of [
			'png',
			'jpeg',
			'gif',
			'webp',
			'bmp',
			'tiff',
			'ico',
			'pdf',
			'zip',
			'gzip',
			'bzip2',
			'xz',
			'7z',
			'rar',
			'tar',
			'elf',
			'pe',
			'macho',
			'cafebabe',
			'wasm',
			'sqlite',
			'mp3',
			'ftyp',
			'ogg',
			'flac',
			'wav',
			'avi',
			'midi',
			'mkv',
			'woff',
			'woff2',
			'ttf',
			'otf',
			'psd',
			'rtf',
			'ps',
			'utf8-bom',
			'utf16le-bom',
			'dicom',
			'iso'
		]) {
			expect(ids.has(id), id).toBe(true);
		}
		const rows = signatureTable();
		expect(rows.find((r) => r.id === 'tar')).toMatchObject({
			offset: 257,
			hex: '75 73 74 61 72 00 30 30',
			ascii: 'ustar.00'
		});
		expect(rows.find((r) => r.id === 'iso')).toMatchObject({ offset: 0x8001, hex: '43 44 30 30 31' });
		expect(rows.find((r) => r.id === 'webp')?.hex).toBe('52 49 46 46 ?? ?? ?? ?? 57 45 42 50');
	});

	test('the PNG signature explanation is the PNG signature', () => {
		expect(PNG_SIGNATURE.flatMap((b) => b.bytes)).toEqual(Array.from(real('tiny.png').subarray(0, 8)));
	});

	test('byte orders match DataView', () => {
		for (const value of [0xcafebabe, 0xfeedface, 0xfeedfacf, 0xdeadbeef, 0x12345678]) {
			const view = new DataView(new ArrayBuffer(4));
			view.setUint32(0, value, false);
			const big = Array.from(new Uint8Array(view.buffer));
			view.setUint32(0, value, true);
			const little = Array.from(new Uint8Array(view.buffer));
			const orders = byteOrders(value);
			expect(parseHex(orders.big)).toEqual(Uint8Array.from(big));
			expect(parseHex(orders.little)).toEqual(Uint8Array.from(little));
		}
		// Which is why a little-endian Mach-O file starts CE FA ED FE.
		expect(byteOrders(0xfeedface).little).toBe(formatHexLines(real('mach32.o').subarray(0, 4)));
	});
});

test.describe('extensions', () => {
	const verdict = (name: string, bytes: Uint8Array) => checkExtension(name, detect(fromBytes(bytes)), bytes.length);

	test('the extension is read the way people name files', () => {
		expect(extensionOf('photo.JPG')).toBe('jpg');
		expect(extensionOf('archive.tar.gz')).toBe('gz');
		expect(extensionOf('.bashrc')).toBe('');
		expect(extensionOf('C:\\Users\\sem\\notes')).toBe('');
		expect(extensionOf('dir.d/file')).toBe('');
	});

	test('match, mismatch, compatible, unknown and none', () => {
		expect(verdict('photo.png', real('tiny.png')).status).toBe('match');
		const lie = verdict('photo.jpg', real('tiny.png'));
		expect(lie.status).toBe('mismatch');
		expect(lie.message).toBe('This .jpg file is actually a PNG image. Its usual extension is .png.');
		expect(verdict('novel.zip', real('book.epub')).status).toBe('compatible');
		expect(verdict('report.zip', real('doc.docx')).status).toBe('compatible');
		// A ZIP whose whole directory was read and has no word/ folder is no DOCX...
		expect(verdict('report.docx', real('plain.zip')).status).toBe('mismatch');
		// ...but one whose directory was not seen might be, and a comic book ZIP is just a ZIP.
		const zipStart = real('plain.zip').subarray(0, 40);
		expect(checkExtension('report.docx', detect(new ByteView(zipStart, 5000, new Uint8Array(0))), 5000).status).toBe(
			'compatible'
		);
		expect(verdict('comic.cbz', real('plain.zip')).status).toBe('compatible');
		// An EXE is not a DLL, and a DLL is not an EXE: bit 13 of the characteristics says which.
		expect(verdict('hello.dll', real('hello.exe')).status).toBe('mismatch');
		expect(verdict('lib.exe', real('lib.dll')).status).toBe('mismatch');
		expect(verdict('scan.dng', real('tiny.tif')).status).toBe('compatible');
		expect(verdict('photo.xyz', real('tiny.png'))).toMatchObject({ status: 'unknown-ext' });
		expect(verdict('hello', real('elf64'))).toMatchObject({
			status: 'no-ext',
			message: 'That is normal for an ELF executable.'
		});
		expect(verdict('photo', real('tiny.png'))).toMatchObject({
			status: 'no-ext',
			message: 'Nothing to check against. It is a PNG image, usually named .png.'
		});
		expect(verdict('readme.md', HAND.text.bytes).status).toBe('compatible');
		expect(verdict('notes.weird', HAND.text.bytes).status).toBe('compatible');
		expect(verdict('logo.png', real('notfound.html'))).toMatchObject({
			status: 'mismatch',
			message: 'This .png file is actually an HTML document. Its usual extension is .html.'
		});
		expect(verdict('song.wav', real('tone.mp3')).message).toContain('actually an MP3 file');
		expect(verdict('empty.txt', new Uint8Array(0)).status).toBe('empty');
	});

	test("ISO media siblings fit each other's extensions", () => {
		// ffmpeg -f lavfi -i sine=d=0.2 -c:a aac -f mp4 voice.m4a writes the brands isom, iso2, mp41.
		const voice = Uint8Array.from(Buffer.from(INSIDE['voice.m4a'].hex, 'hex'));
		expect(top(voice).id).toBe('mp4');
		expect(verdict('voice.m4a', voice).status).toBe('compatible');
		expect(verdict('voice.mov', voice).status).toBe('compatible');
		const m4v = build(u32be(20), { t: 'ftypM4V ' }, '00 00 00 01', { t: 'isom' });
		expect(top(m4v).id).toBe('m4v');
		expect(verdict('clip.mp4', m4v).status).toBe('compatible');
		// A still image is not a movie, whatever the shared box structure.
		expect(verdict('photo.mp4', HAND.heic.bytes).status).toBe('mismatch');
		expect(verdict('photo.heif', HAND.heic.bytes).status).toBe('match');
		// HEVC and AV1 are different codecs: a HEIC is a HEIF, but not an AVIF.
		expect(verdict('photo.avif', HAND.heic.bytes).status).toBe('mismatch');
		// A generic mif1 major brand says only "HEIF"; the codec brand decides
		// .heic or .avif, the same as when it is the major brand.
		const generic = build(u32be(24), { t: 'ftypmif1' }, '00 00 00 00', { t: 'mif1heic' });
		expect(top(generic).id).toBe('heic');
		expect(verdict('photo.avif', generic).status).toBe('mismatch');
		expect(verdict('photo.heic', generic).status).toBe('match');
		expect(verdict('photo.heif', generic).status).toBe('match');
		expect(verdict('photo.mp4', generic).status).toBe('mismatch');
		const genericAv1 = build(u32be(24), { t: 'ftypmif1' }, '00 00 00 00', { t: 'mif1avif' });
		expect(top(genericAv1).id).toBe('avif');
		expect(verdict('photo.heic', genericAv1).status).toBe('mismatch');
		expect(verdict('photo.heif', genericAv1).status).not.toBe('mismatch');
		// Both codec brands listed: either extension fits.
		const both = build(u32be(28), { t: 'ftypmif1' }, '00 00 00 00', { t: 'mif1heicavif' });
		expect(verdict('photo.avif', both).status).not.toBe('mismatch');
		expect(verdict('photo.heic', both).status).not.toBe('mismatch');
		expect(verdict('song.mp4', real('tone.m4a')).status).toBe('compatible');
	});

	test('generic extensions are never called wrong, and suggest no signature', () => {
		expect(verdict('notes.bin', HAND.text.bytes).status).toBe('compatible');
		expect(verdict('Thumbs.db', HAND.cfb.bytes).status).toBe('compatible');
		expect(verdict('app.db', real('db-head.sqlite')).status).toBe('match');
		const unknown = verdict('photo.bin', build('00 11 22 33 44 55 66 77 88 99'));
		expect(unknown.status).toBe('undetected');
		expect(unknown.expected).toEqual([]);
	});

	test('an unrecognised file says what its extension should have started with', () => {
		const v = verdict('photo.png', build('00 11 22 33 44 55 66 77 88 99'));
		expect(v.status).toBe('undetected');
		expect(v.message).toContain('A real .png file would start 89 50 4E 47 0D 0A 1A 0A.');
	});

	test('articles follow how the name is spoken', () => {
		expect(withArticle('MP4 video')).toBe('an MP4 video');
		expect(withArticle('PNG image')).toBe('a PNG image');
		expect(withArticle('Ogg Vorbis audio')).toBe('an Ogg Vorbis audio file');
		expect(withArticle('UTF-8 text')).toBe('a UTF-8 text');
		expect(withArticle('SVG image')).toBe('an SVG image');
		expect(withArticle('RAR archive')).toBe('a RAR archive');
		expect(withArticle('MPEG-4 audio (M4A)')).toBe('an MPEG-4 audio file (M4A)');
	});
});

test.describe('the hex dump', () => {
	test('shows the first rows and the rows holding each field, with gaps between', () => {
		const tar = fromBytes(real('ustar.tar'));
		const d = detect(tar)[0];
		const rows = hexDump(tar, d.fields);
		const offsets = rows.map((r) => (r.kind === 'row' ? r.offset : `gap ${r.from}-${r.to}`));
		// The trailing gap says the dump stops before the file does.
		expect(offsets).toEqual([0, 16, 32, 48, 'gap 64-144', 144, 'gap 160-256', 256, `gap 272-${tar.size}`]);
		// Every byte shown is the byte at that offset, and every signature byte is marked.
		for (const row of rows) {
			if (row.kind !== 'row') continue;
			for (const c of row.cells) expect(c.byte).toBe(tar.at(c.offset) ?? null);
		}
		const marked = rows.flatMap((r) =>
			r.kind === 'row' ? r.cells.filter((c) => c.field >= 0).map((c) => c.offset) : []
		);
		for (let k = 257; k < 265; k++) expect(marked).toContain(k);
	});

	test('plain text output lines up like hexdump -C', () => {
		const rows = hexDump(fromBytes(real('tiny.png')), []);
		expect(dumpText(rows).split('\n')[0]).toBe(
			'00000000  89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52  |.PNG........IHDR|'
		);
		// 64 bytes, then a marker for the 3 that are left, so the dump never ends silently.
		expect(rows.map((r) => r.kind)).toEqual(['row', 'row', 'row', 'row', 'gap']);
		expect(dumpText(rows).split('\n')[4]).toBe('... 3 bytes not shown');
		// Narrow rows show the same 64 bytes, eight rows of eight.
		expect(hexDump(fromBytes(real('tiny.png')), [], 8).filter((r) => r.kind === 'row').length).toBe(8);
		// Shown in full when asked for, with no marker.
		expect(hexDump(fromBytes(real('tiny.png')), [], 16, 256).map((r) => r.kind)).toEqual(Array(5).fill('row'));
		// Spaces in the text column are bytes, and are kept; only missing bytes are left out.
		expect(
			dumpText(hexDump(fromBytes(build({ t: 'RIFF$' }, '00 00 00', { t: 'AVI LIST    ' })), [])).split('\n')[1]
		).toBe(`00000010  20 20 20 20${'   '.repeat(12)}  |    |`);
		expect(hexDump(fromBytes([]), [])).toEqual([]);
	});

	test('an ISO image shows its descriptor without dumping 32 KB', () => {
		const iso = fromBytes(HAND.iso.bytes);
		const rows = hexDump(iso, detect(iso)[0].fields, 16);
		expect(rows.length).toBeLessThan(12);
		expect(rows.some((r) => r.kind === 'row' && r.offset === 0x8000)).toBe(true);
	});
});

test.describe('the examples', () => {
	test('each example is what its label says', () => {
		const want: Record<string, string> = {
			'png-as-jpg': 'png',
			jpeg: 'jpeg',
			docx: 'docx',
			epub: 'epub',
			class: 'cafebabe',
			fat: 'macho-universal',
			elf: 'elf',
			exe: 'pe',
			gzip: 'gzip',
			pdf: 'pdf',
			mp3: 'mp3',
			script: 'script',
			'html-as-png': 'html'
		};
		for (const ex of EXAMPLES) {
			const bytes = parseHex(ex.hex);
			const found = detect(fromBytes(bytes));
			if (ex.id === 'truncated') {
				expect(found).toEqual([]);
				expect(partialMatches(fromBytes(bytes))[0].name).toBe('PNG image');
				continue;
			}
			expect(found[0].id, ex.id).toBe(want[ex.id]);
		}
		expect(EXAMPLES[0].hex).toBe(REAL['tiny.png'].hex);
	});
});

test.describe('the file-signature-checker page', () => {
	test('ships a real detection, hex dump and reference table in the served HTML', async ({ page }) => {
		const html = await (await page.request.get('/file-signature-checker')).text();
		expect(html).toContain('PNG image');
		expect(html).toContain('This .jpg file is actually a PNG image. Its usual extension is .png.');
		expect(html).toContain('Length of the first chunk: 13 bytes');
		expect(html).toContain('75 73 74 61 72 00 30 30');
		expect(html).toContain('Class file version 65.0: Java 21');
		expect(html).toContain('CE FA ED FE');
	});

	test('pasting bytes and naming the file changes the answer', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		await page.locator('#hex').fill(formatHexLines(real('Hi.class').subarray(0, 16)));
		await page.locator('#name').fill('Hi.class');
		await expect(page.locator('.answer-value')).toHaveText('Java class file');
		await expect(page.locator('.verdict').first()).toContainText('Matches: The .class extension matches');
		await expect(page.locator('.dump td.sig')).toHaveCount(8);
		await page.locator('#hex').fill('89 50 4G');
		await expect(page.locator('[role=alert]')).toContainText('not a hex digit');
		await page.getByRole('button', { name: 'Cut-off PNG' }).click();
		await expect(page.locator('.answer')).toContainText('These 4 bytes are the start of the PNG image signature');
		// The cut-off signature is marked in the dump too.
		await expect(page.locator('.dump td.sig')).toHaveCount(4);
	});

	test('a chosen file is read in the browser, head and tail', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Check a file' }).click();
		await expect(page.locator('.empty-state')).toContainText('Nothing is uploaded');
		// A big XLSX whose names are only in the central directory at the end.
		const big = zipWithDescriptors([
			['[Content_Types].xml', '<Types/>'],
			...[1, 2, 3, 4].map((i) => [`padding${i}.bin`, 'x'.repeat(40_000)] as [string, string]),
			['xl/workbook.xml', '<workbook/>']
		]);
		await page
			.locator('#file')
			.setInputFiles({ name: 'budget.zip', mimeType: 'application/zip', buffer: Buffer.from(big) });
		await expect(page.locator('.answer-value')).toHaveText('Excel workbook (XLSX)');
		await expect(page.locator('.verdict').first()).toContainText('Fits');
		await expect(page.locator('.read-note')).toContainText('Read the first 36 KB and the last 64 KB');
		await page.getByRole('button', { name: 'Put the first bytes in the hex box' }).click();
		await expect(page.locator('#name')).toHaveValue('budget.zip');
		await expect(page.locator('#hex')).toHaveValue(/^50 4B 03 04/);
		// The start alone cannot show the workbook folder, and the page says so.
		await expect(page.locator('.read-note')).toContainText('do not read as Excel workbook (XLSX)');
	});

	test('a big ZIP whose directory is more than the tail is read from where its directory starts', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Check a file' }).click();
		const big = zipWithDescriptors([
			['xl/media/image1.png', 'png'],
			...Array.from(
				{ length: 1500 },
				(_, i) => [`xl/worksheets/a_reasonably_long_sheet_name_for_testing_${i}.xml`, '<x/>'] as [string, string]
			),
			['[Content_Types].xml', '<Types/>']
		]);
		await page
			.locator('#file')
			.setInputFiles({ name: 'big.xlsx', mimeType: 'application/zip', buffer: Buffer.from(big) });
		await expect(page.locator('.answer-value')).toHaveText('Excel workbook (XLSX)');
		await expect(page.locator('.verdict').first()).toContainText('Matches');
	});

	test('a file dropped outside the file box is still checked', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		const dataTransfer = await page.evaluateHandle(() => {
			const dt = new DataTransfer();
			dt.items.add(new File([new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0])], 'tool', { type: '' }));
			return dt;
		});
		await page.locator('#hex').dispatchEvent('drop', { dataTransfer });
		await expect(page.locator('.answer-value')).toHaveText('ELF executable');
		await expect(page.locator('.read-note')).toContainText('tool: 8 bytes');
	});

	test('example chips leave focus where it is, and an emptied box says what to do', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		const chip = page.getByRole('button', { name: 'Linux ELF' });
		await chip.click();
		await expect(chip).toBeFocused();
		await expect(page.locator('.answer-value')).toHaveText('ELF executable');
		await page.locator('#hex').fill('');
		await page.locator('#name').fill('');
		await expect(page.locator('.empty-state')).toHaveText('Paste some bytes above, or pick one of the examples.');
		// The empty state round trips through the link instead of turning back into the example.
		await expect(page).toHaveURL(/e=1/);
		await page.reload();
		await expect(page.locator('#hex')).toHaveValue('');
		await expect(page.locator('.empty-state')).toBeVisible();
	});

	test('bytes too many for a link say so instead of offering a link that loses them', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		await page.locator('#hex').fill(formatHexLines(new Uint8Array(5000).fill(0x41)));
		await expect(page.locator('.share-note')).toContainText('too many for a link');
		await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
		await page.locator('#hex').fill('7F 45 4C 46');
		await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
	});

	test('pasted bytes and the name round trip through the address bar', async ({ page }) => {
		await page.goto('/file-signature-checker');
		await page.waitForLoadState('networkidle');
		await page.locator('#hex').fill('7F 45 4C 46 02 01 01');
		await page.locator('#name').fill('');
		await expect(page).toHaveURL(/h=/);
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page.locator('#hex')).toHaveValue('7F 45 4C 46 02 01 01');
		await expect(page.locator('#name')).toHaveValue('');
		await expect(page.locator('.answer-value')).toHaveText('ELF executable');
		expect(page.url()).toBe(shared);
	});

	test('the FAQ in the structured data is the FAQ on the page', async ({ page }) => {
		await page.goto('/file-signature-checker');
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) as string);
		const faq = ld['@graph'][0].mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [
			q.name,
			q.acceptedAnswer.text
		]);
		const shown = await page
			.locator('.faq details')
			.evaluateAll((els) =>
				els.map((d) => [d.querySelector('summary')?.textContent?.trim(), d.querySelector('p')?.textContent?.trim()])
			);
		expect(shown).toEqual(faq);
		expect(faq.length).toBeGreaterThanOrEqual(4);
	});
});
