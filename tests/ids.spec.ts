// IDs checked against the documents that define them (RFC 9562 Appendix A,
// Discord's and MongoDB's own examples, the ULID spec) and against second
// implementations written differently: string slicing instead of shifts,
// Node's crypto for the name-based UUIDs, and Python's uuid module's numbers
// for version 1. Then the two pages, as a reader would use them.

/* eslint-disable @typescript-eslint/no-non-null-assertion -- the tests assert on fields they know are there */
import { expect, test } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import {
	detectId,
	decodeUuid,
	decodeUlid,
	decodeObjectId,
	decodeSnowflake,
	parseUuid,
	parseUlid,
	crockfordEncode,
	crockfordValue,
	CROCKFORD,
	snowflakeRange,
	snowflakeLastMoment,
	parseMoment,
	describeAge,
	variantOfDigit,
	uuidV4,
	uuidString,
	IdGenerator,
	birthdayHalf,
	ulidToUuid,
	uuidToUlid,
	IdError,
	ID_FORMATS,
	GEN_FORMATS,
	type GenKind,
	type RandomBytes
} from '../src/lib/ids.js';

/** A deterministic random source, so a failure can be reproduced. */
function seeded(seed: number): RandomBytes {
	return (n) => {
		const out = new Uint8Array(n);
		for (let i = 0; i < n; i++) {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			out[i] = seed >> 16;
		}
		return out;
	};
}
const nodeRandom: RandomBytes = (n) => new Uint8Array(randomBytes(n));

const errorOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(IdError);
		return (e as Error).message;
	}
	throw new Error('expected an IdError');
};

/** The independent reading of a UUID: slice the hex text, never shift the integer. */
function sliceUuid(text: string) {
	const h = text.replace(/-/g, '').toLowerCase();
	const nibble = (i: number) => parseInt(h[i], 16);
	return {
		version: nibble(12),
		variantBits: nibble(16).toString(2).padStart(4, '0'),
		v1Ticks: BigInt('0x' + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8)),
		v6Ticks: BigInt('0x' + h.slice(0, 8) + h.slice(8, 12) + h.slice(13, 16)),
		v7Ms: parseInt(h.slice(0, 12), 16),
		clockSeq: parseInt(h.slice(16, 20), 16) & 0x3fff,
		node: h.slice(20)
	};
}

test('RFC 9562 Appendix A: version 1', () => {
	const id = decodeUuid('C232AB00-9414-11EC-B3C8-9F6BDECED846');
	expect(id.version).toBe(1);
	expect(id.variant).toBe('rfc');
	// Python's uuid.UUID(...).time and .clock_seq give these for the same value.
	expect(id.time!.raw).toBe(138648505420000000n);
	expect(sliceUuid(id.canonical).v1Ticks).toBe(138648505420000000n);
	expect(id.time!.iso).toBe('2022-02-22T19:22:22.0000000Z');
	expect(id.fields.find((f) => f.name === 'Clock sequence')!.value).toBe(13256n);
	expect(id.fields.find((f) => f.name === 'Node')!.value).toBe(0x9f6bdeced846n);
	// 0x9F has the low bit set: the RFC's example node is a random one.
	expect(id.fields.find((f) => f.name === 'Node')!.meaning).toContain('multicast bit is set');
});

test('RFC 9562 Appendix A: version 4', () => {
	const id = decodeUuid('919108F7-52D1-4320-9BAC-F847DB4148A8');
	expect(id.version).toBe(4);
	expect(id.variant).toBe('rfc');
	expect(id.time).toBeUndefined();
	expect(id.fields.map((f) => f.length)).toEqual([48, 4, 12, 2, 62]);
	expect(id.fields[2].value).toBe(0x320n);
});

test('RFC 9562 Appendix A: version 6 is the same moment as the version 1 example', () => {
	const id = decodeUuid('1EC9414C-232A-6B00-B3C8-9F6BDECED846');
	expect(id.version).toBe(6);
	expect(id.fields.find((f) => f.name === 'Node')!.value).toBe(0x9f6bdeced846n);
	expect(id.fields.find((f) => f.name === 'Clock sequence')!.value).toBe(13256n);
	expect(id.time!.raw).toBe(138648505420000000n);
	expect(sliceUuid(id.canonical).v6Ticks).toBe(138648505420000000n);
	expect(id.time!.iso).toBe('2022-02-22T19:22:22.0000000Z');
});

test('RFC 9562 Appendix A: version 7', () => {
	const id = decodeUuid('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
	expect(id.version).toBe(7);
	expect(id.time!.unixMs).toBe(0x017f22e279b0);
	expect(id.time!.iso).toBe('2022-02-22T19:22:22.000Z');
	expect(id.fields.map((f) => f.length)).toEqual([48, 4, 12, 2, 62]);
	expect(id.fields[2].value).toBe(0xcc3n);
	expect(id.fields[4].value).toBe(0x18c4dc0c0c07398fn);
});

test('RFC 9562 Appendix A: versions 3 and 5 are the hashes Node computes', () => {
	const dns = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
	const name = Buffer.from('www.example.com');
	for (const [alg, version, expected] of [
		['md5', 3, '5df41881-3aed-3515-88a7-2f4a814cf09e'],
		['sha1', 5, '2ed6657d-e927-568b-95e1-2665a8aea6a2']
	] as const) {
		const h = createHash(alg)
			.update(Buffer.concat([dns, name]))
			.digest()
			.subarray(0, 16);
		h[6] = (h[6] & 0x0f) | (version << 4);
		h[8] = (h[8] & 0x3f) | 0x80;
		const made = uuidString(BigInt('0x' + h.toString('hex')));
		expect(made).toBe(expected);
		const id = decodeUuid(expected);
		expect(id.version).toBe(version);
		expect(id.time).toBeUndefined();
		expect(id.notes.join(' ')).toContain('cannot be reversed');
	}
});

test('RFC 9562 Appendix B: version 8 examples and the nil and max UUIDs', () => {
	for (const v8 of ['2489E9AD-2EE2-8E00-8EC9-32D5F69181C0', '5C146B14-3C52-8AFD-938A-375D0DF1FBF6']) {
		const id = decodeUuid(v8);
		expect(id.version).toBe(8);
		expect(id.variant).toBe('rfc');
		expect(id.fields.map((f) => f.length)).toEqual([48, 4, 12, 2, 62]);
	}
	expect(decodeUuid('00000000-0000-0000-0000-000000000000').title).toBe('The nil UUID');
	expect(decodeUuid('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF').title).toBe('The max UUID');
	expect(decodeUuid('00000000-0000-0000-0000-000000000000').version).toBeUndefined();
});

test('every layout covers all the bits, in order, and agrees with the value', () => {
	const random = seeded(7);
	for (let version = 0; version < 16; version++) {
		for (const varDigit of [0x3, 0x9, 0xd, 0xf]) {
			const h = Array.from(random(16), (b) => b.toString(16).padStart(2, '0')).join('');
			const text = h.slice(0, 12) + version.toString(16) + h.slice(13, 16) + varDigit.toString(16) + h.slice(17);
			const id = decodeUuid(text);
			let at = 0;
			let rebuilt = 0n;
			for (const f of id.fields) {
				expect(f.start).toBe(at);
				at += f.length;
				rebuilt = (rebuilt << BigInt(f.length)) | f.value;
			}
			expect(at).toBe(128);
			expect(rebuilt).toBe(id.value);
			expect(id.variant).toBe(variantOfDigit(varDigit).variant);
			if (id.variant === 'rfc') expect(id.version).toBe(version);
			else expect(id.version).toBeUndefined();
		}
	}
});

test('variants follow the RFC 9562 table', () => {
	const names = Array.from({ length: 16 }, (_, d) => variantOfDigit(d).variant);
	expect(names).toEqual([
		...Array(8).fill('ncs'),
		...Array(4).fill('rfc'),
		'microsoft',
		'microsoft',
		'future',
		'future'
	]);
	expect(decodeUuid('00000000-0000-1000-c000-000000000000').title).toContain('Microsoft');
});

test('UUIDs are read in all their usual spellings', () => {
	const canonical = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
	for (const spelling of [
		canonical.toUpperCase(),
		`{${canonical}}`,
		`urn:uuid:${canonical}`,
		canonical.replace(/-/g, ''),
		`  ${canonical}  `
	]) {
		expect(decodeUuid(spelling).canonical).toBe(canonical);
		expect(detectId(spelling).kind).toBe('uuid');
	}
	expect(errorOf(() => parseUuid('017f22e2-79b0-7cc3-98c4-dc0c0c07398'))).toBe('A UUID has 32 hex digits; this has 31');
	expect(errorOf(() => parseUuid('017f22e2-79b0-7cc3-98c4-dc0c0c07398g'))).toContain('"g"');
	// Dashes only where they belong.
	expect(errorOf(() => parseUuid('0-1-7f22e279b07cc398c4dc0c0c07398f'))).toContain('8-4-4-4-12');
	expect(errorOf(() => detectId('0-1-7f22e279b07cc398c4dc0c0c07398f'))).toContain('8-4-4-4-12');
});

test('MongoDB ObjectId: the documented example', () => {
	const id = decodeObjectId('507f1f77bcf86cd799439011');
	expect(id.time!.iso).toBe('2012-10-17T21:13:27Z');
	expect(id.fields.map((f) => f.length)).toEqual([32, 40, 24]);
	expect(id.fields[2].value).toBe(0x439011n);
	expect(decodeObjectId('ObjectId("507f1f77bcf86cd799439011")').canonical).toBe('507f1f77bcf86cd799439011');
	expect(detectId('ObjectId("507F1F77BCF86CD799439011")').kind).toBe('objectid');
	expect(decodeObjectId("ObjectId('507f1f77bcf86cd799439011')").canonical).toBe('507f1f77bcf86cd799439011');
	// Half a wrapper is not an ObjectId.
	expect(errorOf(() => decodeObjectId('507f1f77bcf86cd799439011)'))).toContain('24 hex digits');
	expect(errorOf(() => decodeObjectId('ObjectId("507f1f77bcf86cd799439011\')'))).toContain('24 hex digits');
});

test('Discord: the documented example snowflake', () => {
	const id = decodeSnowflake('175928847299117063', 'discord');
	expect(id.time!.iso).toBe('2016-04-30T11:18:25.796Z');
	const byName = Object.fromEntries(id.fields.map((f) => [f.name, f.value]));
	expect(byName['Internal worker ID']).toBe(1n);
	expect(byName['Internal process ID']).toBe(0n);
	expect(byName['Increment']).toBe(7n);
	// Discord's documentation does the same sum with the same numbers.
	expect(175928847299117063n >> 22n).toBe(41944705796n);
	expect(41944705796 + 1420070400000).toBe(1462015105796);
	expect(id.notes.join(' ')).toContain('175928847299117060');
});

test('Twitter/X snowflakes read with Twitter’s epoch and a 10-bit machine', () => {
	// A value built from known fields, read back with the Twitter layout.
	const raw = 20n;
	const value = (raw << 22n) | (0b0000100011n << 12n) | 5n;
	const id = decodeSnowflake(value, 'twitter');
	expect(id.time!.unixMs).toBe(1288834974657 + 20);
	expect(id.fields.map((f) => f.length)).toEqual([1, 41, 10, 12]);
	expect(id.fields[2].meaning).toContain('datacentre 1, worker 3');
	expect(id.fields[3].value).toBe(5n);
	// With the sign bit set the time still comes from the 41-bit field, so it
	// cannot land past the last moment the layout holds.
	const top = decodeSnowflake('18446744073709551615', 'twitter');
	expect(top.fields[0].value).toBe(1n);
	expect(top.time!.raw).toBe(2n ** 41n - 1n);
	expect(top.time!.iso).toBe(snowflakeLastMoment('twitter'));
	expect(top.fields[1].meaning).toContain(`${2n ** 41n - 1n} ms after the epoch`);
	// Discord has no sign bit: all 42 bits are time.
	expect(decodeSnowflake('18446744073709551615', 'discord').time!.iso).toBe(snowflakeLastMoment('discord'));
});

test('a date gives the snowflake range for that millisecond, and back', () => {
	const { min, max } = snowflakeRange(Date.parse('2016-04-30T11:18:25.796Z'));
	expect(min <= 175928847299117063n && 175928847299117063n <= max).toBe(true);
	expect(max - min).toBe((1n << 22n) - 1n);
	expect(decodeSnowflake(min).time!.iso).toBe('2016-04-30T11:18:25.796Z');
	expect(decodeSnowflake(max).time!.iso).toBe('2016-04-30T11:18:25.796Z');
	expect(snowflakeRange(1420070400000).min).toBe(0n);
	expect(errorOf(() => snowflakeRange(1420070399999))).toContain('before the Discord epoch');
	expect(snowflakeLastMoment('discord')).toBe(new Date(1420070400000 + 2 ** 42 - 1).toISOString());
	expect(errorOf(() => snowflakeRange(1420070400000 + 2 ** 42))).toContain('after the last moment');
	for (let i = 0; i < 500; i++) {
		const ms = 1420070400000 + Math.floor(Math.random() * 2 ** 40);
		const r = snowflakeRange(ms);
		expect(decodeSnowflake(r.min).time!.unixMs).toBe(ms);
		expect(decodeSnowflake(r.max).time!.unixMs).toBe(ms);
		expect(new Date(ms).toISOString()).toBe(decodeSnowflake(r.max).time!.iso);
	}
});

test('snowflake input errors say what is wrong', () => {
	expect(errorOf(() => decodeSnowflake('12a'))).toContain('digits 0 to 9');
	expect(errorOf(() => decodeSnowflake('18446744073709551616'))).toContain('more than 64 bits');
	expect(decodeSnowflake('18446744073709551615').canonical).toBe('18446744073709551615');
	expect(decodeSnowflake('175,928,847,299,117,063').canonical).toBe('175928847299117063');
	expect(errorOf(() => decodeSnowflake('  '))).toContain('Type a snowflake');
});

test('ULID: the spec example, Crockford decoding and the 128-bit limit', () => {
	// The README's seed-time example: ulid(1469918176385) starts 01ARYZ6S41.
	const id = decodeUlid('01ARYZ6S41TSV4RRFFQ69G5FAV');
	expect(id.time!.unixMs).toBe(1469918176385);
	expect(id.time!.iso).toBe('2016-07-30T22:36:16.385Z');
	expect(crockfordEncode(1469918176385n, 10)).toBe('01ARYZ6S41');
	expect(decodeUlid('01arz3ndektsv4rrffq69g5fav').canonical).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
	// I and L read as 1, O as 0.
	expect(decodeUlid('OIARZ3NDEKTSV4RRFFQ69G5FAV').canonical).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
	expect(decodeUlid('0LARZ3NDEKTSV4RRFFQ69G5FAV').canonical).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
	expect(crockfordValue('u')).toBe(-1);
	expect(errorOf(() => parseUlid('01ARZ3NDEKTSV4RRFFQ69G5FAU'))).toContain('"U"');
	expect(errorOf(() => parseUlid('81ARZ3NDEKTSV4RRFFQ69G5FAV'))).toContain('larger than 128 bits');
	expect(parseUlid('7ZZZZZZZZZZZZZZZZZZZZZZZZZ').value).toBe((1n << 128n) - 1n);
});

test('Crockford Base32 agrees with a second, digit-by-digit implementation', () => {
	const random = seeded(3);
	for (let i = 0; i < 300; i++) {
		const v = BigInt('0x' + Buffer.from(random(16)).toString('hex'));
		const text = crockfordEncode(v, 26);
		// Reference: value = sum of digit × 32^position, found by indexOf.
		let back = 0n;
		for (let p = 0; p < 26; p++) back += BigInt(CROCKFORD.indexOf(text[25 - p])) * 32n ** BigInt(p);
		expect(back).toBe(v);
		expect(parseUlid(text.toLowerCase()).value).toBe(v);
		expect(uuidToUlid(ulidToUuid(text))).toBe(text);
	}
});

test('detection names each kind of ID and explains near misses', () => {
	expect(detectId('9b2f8d5e-3c4a-4f61-8e2b-7a9c0d1e2f30').kind).toBe('uuid');
	expect(detectId('01ARZ3NDEKTSV4RRFFQ69G5FAV').kind).toBe('ulid');
	expect(detectId('507f1f77bcf86cd799439011').kind).toBe('objectid');
	expect(detectId('175928847299117063').kind).toBe('snowflake');
	expect(detectId('V1StGXR8_Z5jdHi6B-myT').kind).toBe('nanoid');
	expect(errorOf(() => detectId(''))).toContain('Paste an ID');
	expect(errorOf(() => detectId('9b2f8d5e-3c4a-4f61-8e2b-7a9c0d1e2f3'))).toContain('this has 31');
	expect(errorOf(() => detectId('hello world'))).toContain('Not a recognised ID');
	// Digit-group separators are accepted here as on the snowflake page.
	expect(detectId('175,928,847,299,117,063').canonical).toBe('175928847299117063');
	expect(detectId('175_928_847_299_117_063').kind).toBe('snowflake');
	expect(detectId('175 928 847 299 117 063').kind).toBe('snowflake');
	// Separators only between groups of three, and only one kind of them.
	expect(errorOf(() => detectId('1 2 3'))).toContain('Not a recognised ID');
	expect(errorOf(() => decodeSnowflake('1 2 3'))).toContain('groups of three');
	expect(errorOf(() => decodeSnowflake('175,928_847'))).toContain('groups of three');
	// A broken ObjectId(...) wrapper gets the ObjectId message.
	expect(errorOf(() => detectId(`ObjectId('507f1f77bcf86cd799439011")`))).toContain('An ObjectId is 24 hex digits');
	expect(detectId(`ObjectId("507f1f77bcf86cd799439011")`).kind).toBe('objectid');
	// The RFC 9562 v1 example has a random (multicast) node, so the title does not promise a MAC address.
	expect(decodeUuid('C232AB00-9414-11EC-B3C8-9F6BDECED846').title).toBe('UUID version 1: time and node');
});

test('generated v4 and v7 UUIDs always have the right version and variant', () => {
	const gen = new IdGenerator(nodeRandom);
	const now = Date.parse('2026-01-02T03:04:05.678Z');
	for (let i = 0; i < 2000; i++) {
		const v4 = uuidString(uuidV4(nodeRandom));
		expect(sliceUuid(v4).version).toBe(4);
		expect(sliceUuid(v4).variantBits.slice(0, 2)).toBe('10');
		const v7 = gen.make('v7', now, { upper: false, dashes: true });
		expect(sliceUuid(v7).version).toBe(7);
		expect(sliceUuid(v7).variantBits.slice(0, 2)).toBe('10');
		expect(sliceUuid(v7).v7Ms).toBeGreaterThanOrEqual(now);
	}
});

test('generated IDs decode back to the time they were made with, and stay in order', () => {
	const now = Date.parse('2025-06-15T12:34:56.789Z');
	const gen = new IdGenerator(seeded(42));
	const opts = { upper: false, dashes: true };
	const kinds: GenKind[] = ['v7', 'v1', 'ulid', 'objectid', 'snowflake'];
	for (const kind of kinds) {
		const batch = Array.from({ length: 100 }, () => gen.make(kind, now, opts));
		expect(new Set(batch).size).toBe(100);
		for (const text of batch) {
			const id = detectId(text);
			const ms = id.time!.unixMs;
			if (kind === 'objectid') expect(ms).toBe(Math.floor(now / 1000) * 1000);
			else expect(Math.floor(ms)).toBe(now);
		}
		// Same millisecond, still sorted: what makes these IDs index well.
		if (kind !== 'snowflake') {
			const sorted = kind === 'v1' ? null : [...batch].sort();
			if (sorted) expect(sorted).toEqual(batch);
		}
	}
	// v1 sorts by its decoded time instead, since its text is not time-ordered.
	const v1s = Array.from({ length: 50 }, () => decodeUuid(gen.make('v1', now, opts)).time!.raw);
	expect([...v1s].sort((a, b) => (a < b ? -1 : 1))).toEqual(v1s);
	const v1 = decodeUuid(gen.make('v1', now, opts));
	expect(v1.fields.find((f) => f.name === 'Node')!.meaning).toContain('multicast bit is set');
	expect(v1.version).toBe(1);
});

test('a generator makes IDs for an earlier time after a later one', () => {
	// The page keeps one generator and regenerates whenever the time changes,
	// so going back in time must give IDs for the time asked for.
	const opts = { upper: false, dashes: true };
	const later = Date.parse('2030-01-01T00:00:00Z');
	const earlier = Date.parse('2020-06-01T12:00:00Z');
	const realNow = Date.now();
	for (const kind of ['v7', 'v1', 'ulid', 'objectid', 'snowflake'] as GenKind[]) {
		const gen = new IdGenerator(seeded(9));
		for (const at of [realNow, later, earlier, earlier - 3_600_000, realNow]) {
			const batch = Array.from({ length: 20 }, () => gen.make(kind, at, opts));
			for (const text of batch) {
				const ms = detectId(text).time!.unixMs;
				expect(kind === 'objectid' ? ms : Math.floor(ms)).toBe(kind === 'objectid' ? Math.floor(at / 1000) * 1000 : at);
			}
			expect(new Set(batch).size).toBe(20);
		}
	}
	// Version 1 changes its clock sequence when the clock goes back, as RFC 9562 section 5.1 asks.
	const gen = new IdGenerator(seeded(5));
	const seq = (t: string) => decodeUuid(t).fields.find((f) => f.name === 'Clock sequence')!.value;
	const first = gen.make('v1', later, opts);
	const again = gen.make('v1', later, opts);
	const back = gen.make('v1', earlier, opts);
	expect(seq(again)).toBe(seq(first));
	expect(seq(back)).toBe((seq(first) + 1n) & 0x3fffn);
	// Asking for the same time again is the same millisecond: still in order.
	const v7a = gen.make('v7', earlier, opts);
	const v7b = gen.make('v7', earlier, opts);
	expect(v7a < v7b).toBe(true);
});

test('a generator refuses times its format has no bits for', () => {
	const gen = new IdGenerator(seeded(2));
	const opts = { upper: false, dashes: true };
	const at = (iso: string) => parseMoment(iso);
	expect(errorOf(() => gen.make('v7', at('1969-06-01'), opts))).toBe(
		'A UUID v7 can only hold times from 1970 to 10889'
	);
	expect(errorOf(() => gen.make('ulid', at('1960-01-01'), opts))).toBe('A ULID can only hold times from 1970 to 10889');
	expect(errorOf(() => gen.make('objectid', at('1960-01-01'), opts))).toBe(
		'An ObjectId can only hold times from 1970 to 2106'
	);
	expect(errorOf(() => gen.make('objectid', at('2200-01-01'), opts))).toContain('2106');
	expect(errorOf(() => gen.make('v1', at('1500-01-01'), opts))).toContain('from 1582');
	// The edges themselves work and decode back.
	expect(detectId(gen.make('v7', 0, opts)).time!.unixMs).toBe(0);
	expect(detectId(gen.make('v7', 2 ** 48 - 1, opts)).time!.unixMs).toBe(2 ** 48 - 1);
	expect(detectId(gen.make('ulid', 2 ** 48 - 1, opts)).time!.unixMs).toBe(2 ** 48 - 1);
	expect(detectId(gen.make('objectid', at('2106-02-07T06:28:15Z'), opts)).time!.iso).toBe('2106-02-07T06:28:15Z');
	expect(detectId(gen.make('objectid', 0, opts)).time!.iso).toBe('1970-01-01T00:00:00Z');
	expect(detectId(gen.make('v1', at('1582-10-15'), opts)).time!.iso).toBe('1582-10-15T00:00:00.0000000Z');
	expect(detectId(gen.make('v1', at('1969-07-20T20:17:40Z'), opts)).time!.iso).toBe('1969-07-20T20:17:40.0000000Z');
	expect(errorOf(() => gen.make('snowflake', at('2014-01-01'), opts))).toContain('before the Discord epoch');
});

test('generator formatting options', () => {
	const gen = new IdGenerator(seeded(1));
	const now = 1_700_000_000_000;
	expect(gen.make('v4', now, { upper: true, dashes: false })).toMatch(/^[0-9A-F]{12}4[0-9A-F]{3}[89AB][0-9A-F]{15}$/);
	expect(gen.make('ulid', now, { upper: false, dashes: true })).toMatch(/^[0-9a-hjkmnp-tv-z]{26}$/);
	expect(gen.make('objectid', now, { upper: true, dashes: true })).toMatch(/^[0-9A-F]{24}$/);
	const nano = gen.make('nanoid', now, { upper: true, dashes: false });
	expect(nano).toMatch(/^[A-Za-z0-9_-]{21}$/);
	expect(GEN_FORMATS.nanoid.caseOption).toBe(false);
	// ULIDs are written in upper case by their spec; UUIDs usually in lower case.
	expect(GEN_FORMATS.ulid.upper).toBe(true);
	expect(GEN_FORMATS.v7.upper).toBe(false);
	// Every one of the 64 characters comes up, and none is much more common.
	const counts = new Map<string, number>();
	for (let i = 0; i < 2000; i++) for (const c of gen.nanoid()) counts.set(c, (counts.get(c) ?? 0) + 1);
	expect(counts.size).toBe(64);
	expect(Math.max(...counts.values()) / Math.min(...counts.values())).toBeLessThan(1.6);
});

test('a moment is read as UTC unless it says otherwise', () => {
	expect(parseMoment('2016-04-30T11:18:25.796Z')).toBe(1462015105796);
	expect(parseMoment('2016-04-30 11:18:25.796')).toBe(1462015105796);
	expect(parseMoment('2016-04-30')).toBe(Date.UTC(2016, 3, 30));
	expect(parseMoment('2016-04-30T13:18+02:00')).toBe(Date.UTC(2016, 3, 30, 11, 18));
	expect(parseMoment('2016-04-30T06:18-0500')).toBe(Date.UTC(2016, 3, 30, 11, 18));
	expect(errorOf(() => parseMoment('30/04/2016'))).toContain('YYYY-MM-DD');
	expect(errorOf(() => parseMoment('2016-02-30'))).toContain('that many days');
	expect(errorOf(() => parseMoment('2016-13-01'))).toContain('out of range');
	// Years below 100 are those years, not 1900 plus.
	expect(new Date(parseMoment('0050-01-01')).toISOString()).toBe('0050-01-01T00:00:00.000Z');
	expect(new Date(parseMoment('1582-10-15')).toISOString()).toBe('1582-10-15T00:00:00.000Z');
	expect(errorOf(() => parseMoment('2024-01-01T00:00+99:99'))).toContain('UTC offset');
	expect(errorOf(() => parseMoment('2024-01-01T00:00+15:00'))).toContain('UTC offset');
	expect(parseMoment('2024-01-01T00:00+14:00')).toBe(Date.UTC(2023, 11, 31, 10));
});

test('ages read naturally', () => {
	const now = Date.UTC(2026, 0, 1);
	expect(describeAge(now, now)).toBe('just now');
	expect(describeAge(now - 5_000, now)).toBe('5 seconds ago');
	expect(describeAge(now - 61_000, now)).toBe('1 minute ago');
	expect(describeAge(now - 3_660_000, now)).toBe('1 hour 1 minute ago');
	expect(describeAge(now - 3 * 86_400_000, now)).toBe('3 days ago');
	expect(describeAge(Date.UTC(2016, 0, 1), now)).toBe('10 years 0 days ago');
	expect(describeAge(now + 2 * 86_400_000, now)).toBe('2 days from now');
	// Calendar years, so a year from one new year to the next is exactly one.
	expect(describeAge(Date.UTC(2025, 0, 1), now)).toBe('1 year 0 days ago');
	expect(describeAge(Date.UTC(2024, 0, 1), Date.UTC(2025, 0, 1))).toBe('1 year 0 days ago');
	expect(describeAge(Date.UTC(2025, 0, 2), now)).toBe('364 days ago');
	expect(describeAge(Date.UTC(2027, 0, 11), now)).toBe('1 year 10 days from now');
});

test('the comparison table matches the decoders', () => {
	const random = (name: string) => ID_FORMATS.find((f) => f.name === name)!;
	const randomBits = (id: ReturnType<typeof detectId>) =>
		id.fields.filter((f) => f.tone === 'random').reduce((n, f) => n + f.length, 0);
	expect(random('UUID v4').random).toBe(`${randomBits(decodeUuid(uuidString(uuidV4(nodeRandom))))} bits`);
	expect(random('UUID v7').random).toBe(`${randomBits(decodeUuid('017F22E2-79B0-7CC3-98C4-DC0C0C07398F'))} bits`);
	expect(random('ULID').random).toBe(`${randomBits(decodeUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV'))} bits`);
	expect(random('ObjectId').bits).toBe(decodeObjectId('507f1f77bcf86cd799439011').bits);
	// About 2.7 × 10^18 version 4 UUIDs for even odds of one repeat.
	expect(birthdayHalf(122)).toBeGreaterThan(2.7e18);
	expect(birthdayHalf(122)).toBeLessThan(2.72e18);
});

const RFC_V7_TEXT = '017F22E2-79B0-7CC3-98C4-DC0C0C07398F';

test.describe('the uuid-decoder page', () => {
	test('ships a decoded RFC example, and decodes what is typed', async ({ page }) => {
		const html = await (await page.request.get('/uuid-decoder')).text();
		expect(html).toContain('UUID version 7: Unix time, sortable');
		expect(html).toContain('2022-02-22T19:22:22.000Z');
		expect(html).toContain('1645557742000');
		// Generated IDs are made in the browser, never baked into the page.
		expect(html).toContain('IDs are generated in your browser once the page has loaded.');

		await page.goto('/uuid-decoder');
		await page.waitForLoadState('networkidle');
		await page.locator('#id-input').fill('C232AB00-9414-11EC-B3C8-9F6BDECED846');
		await expect(page.locator('.answer').first()).toContainText('UUID version 1');
		await expect(page.locator('.answer').first()).toContainText('2022-02-22T19:22:22.0000000Z');
		await expect(page.locator('.answer').first()).toContainText(/ago/);
		await page.locator('#id-input').fill('507f1f77bcf86cd799439011');
		await expect(page.locator('.answer').first()).toContainText('2012-10-17T21:13:27Z');
		await page.locator('#id-input').fill('not an id');
		await expect(page.locator('.error')).toContainText('Not a recognised ID');
		await page.getByRole('button', { name: 'ULID', exact: true }).click();
		await expect(page.locator('.answer').first()).toContainText('2016-07-30T22:36:16.385Z');
	});

	test('generates IDs in the browser that decode correctly', async ({ page }) => {
		await page.goto('/uuid-decoder?g=v7&n=12&case=upper');
		await page.waitForLoadState('networkidle');
		const items = page.locator('.generated .gen-id');
		await expect(items).toHaveCount(12);
		const ids = await items.allTextContents();
		for (const id of ids) expect(id).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-7[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
		expect([...ids].sort()).toEqual(ids);
		await page.locator('#gen-kind').selectOption('snowflake');
		await page.locator('#gen-at').fill('2020-05-05 05:05:05');
		await expect(items.first()).toHaveText(/^\d+$/);
		const flake = (await items.first().textContent())!;
		expect(decodeSnowflake(flake).time!.iso).toBe('2020-05-05T05:05:05.000Z');
		await page.getByRole('button', { name: `Decode ${flake}` }).click();
		await expect(page.locator('#id-input')).toHaveValue(flake);
		await expect(page).toHaveURL(/g=snowflake/);
		await page.locator('#gen-at').fill('yesterday');
		await expect(page.locator('.error')).toContainText('YYYY-MM-DD');
	});

	test('a time typed after IDs were made at the current time is used', async ({ page }) => {
		await page.goto('/uuid-decoder');
		await page.waitForLoadState('networkidle');
		const items = page.locator('.generated .gen-id');
		for (const kind of ['v7', 'v1', 'ulid'] as const) {
			await page.locator('#gen-kind').selectOption(kind);
			await page.locator('#gen-at').fill('');
			await expect(items).toHaveCount(5);
			await page.locator('#gen-at').fill('2020-06-01 12:00');
			await expect
				.poll(async () => detectId((await items.first().textContent())!).time!.unixMs)
				.toBe(Date.UTC(2020, 5, 1, 12));
			for (const text of await items.allTextContents()) {
				expect(Math.floor(detectId(text).time!.unixMs)).toBe(Date.UTC(2020, 5, 1, 12));
			}
			await page.locator('#gen-at').fill('2020-06-01 11:00');
			await expect
				.poll(async () => detectId((await items.first().textContent())!).time!.unixMs)
				.toBe(Date.UTC(2020, 5, 1, 11));
		}
		// ULIDs come out in their usual upper case unless asked otherwise.
		expect(await items.first().textContent()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
		// A time the format cannot hold is refused, not written as a broken ID.
		await page.locator('#gen-at').fill('1960-01-01');
		await expect(page.locator('#generator .error')).toContainText('can only hold times from 1970');
		await expect(items).toHaveCount(0);
		await page.locator('#gen-kind').selectOption('v4');
		await expect(page).not.toHaveURL(/at=/);
	});

	test('the address round-trips', async ({ page }) => {
		await page.goto('/uuid-decoder');
		await page.waitForLoadState('networkidle');
		await page.locator('#id-input').fill('2ed6657d-e927-568b-95e1-2665a8aea6a2');
		await page.locator('#gen-kind').selectOption('nanoid');
		await page.locator('#gen-count').fill('3');
		await expect(page).toHaveURL(/g=nanoid/);
		await expect(page).toHaveURL(/n=3/);
		const url = page.url();
		await page.goto(url);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#id-input')).toHaveValue('2ed6657d-e927-568b-95e1-2665a8aea6a2');
		await expect(page.locator('.answer').first()).toContainText('UUID version 5');
		await expect(page.locator('#gen-kind')).toHaveValue('nanoid');
		await expect(page.locator('.generated .gen-id')).toHaveCount(3);
	});

	test('shows a fresh v4 and v7 on the first screen, made in the browser', async ({ page }) => {
		const html = await (await page.request.get('/uuid-decoder')).text();
		expect(html).toContain('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx');
		await page.goto('/uuid-decoder');
		await page.waitForLoadState('networkidle');
		const quick = page.locator('.quick-id');
		await expect(quick.first()).toHaveText(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		await expect(quick.nth(1)).toHaveText(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		const v7 = (await quick.nth(1).textContent())!;
		expect(Math.abs(detectId(v7).time!.unixMs - Date.now())).toBeLessThan(60_000);
		await expect(page.getByRole('button', { name: 'Copy new version 4 UUID' })).toBeEnabled();
	});

	test('an invalid ID dims the result out of reach, and the alert waits for a pause', async ({ page }) => {
		await page.goto('/uuid-decoder');
		await page.waitForLoadState('networkidle');
		await page.locator('#id-input').fill('abc');
		await expect(page.locator('#id-error')).toContainText('Not a recognised ID');
		await expect(page.locator('#id-input')).toHaveAttribute('aria-describedby', 'id-help id-error');
		await expect.poll(() => page.locator('.intro .results').evaluate((el) => el.hasAttribute('inert'))).toBe(true);
		await expect(page.locator('[role="alert"]')).toHaveCount(0);
		await expect(page.locator('[role="alert"]')).toContainText('Not a recognised ID');
		await page.locator('#id-input').fill(RFC_V7_TEXT);
		await expect(page.locator('[role="alert"]')).toHaveCount(0);
		await expect.poll(() => page.locator('.intro .results').evaluate((el) => el.hasAttribute('inert'))).toBe(false);
	});

	test('values the page rejects are taken out of the address', async ({ page }) => {
		await page.goto(`/uuid-decoder?g=bogus&case=zzz&dash=maybe&n=500&id=${'a'.repeat(200)}`);
		await page.waitForLoadState('networkidle');
		await expect.poll(() => new URL(page.url()).search).toBe('');
		await expect(page.locator('#id-input')).toHaveValue(RFC_V7_TEXT);
	});
});

test.describe('the snowflake-id-decoder page', () => {
	test("ships Discord's example decoded, and decodes what is typed", async ({ page }) => {
		const html = await (await page.request.get('/snowflake-id-decoder')).text();
		expect(html).toContain('2016-04-30T11:18:25.796Z');
		expect(html).toContain('41944705796');

		await page.goto('/snowflake-id-decoder');
		await page.waitForLoadState('networkidle');
		await page.locator('#sf-id').fill('4194304');
		await expect(page.locator('.answer').first()).toContainText('2015-01-01T00:00:00.001Z');
		await page.getByRole('button', { name: 'Twitter/X', exact: true }).click();
		await expect(page.locator('.answer').first()).toContainText(new Date(1288834974657 + 1).toISOString());
		await page.locator('#sf-id').fill('12x');
		await expect(page.locator('.error')).toContainText('digits 0 to 9');
	});

	test('a date gives the snowflake range', async ({ page }) => {
		await page.goto('/snowflake-id-decoder');
		await page.waitForLoadState('networkidle');
		const { min, max } = snowflakeRange(Date.UTC(2024, 2, 1, 17, 30));
		await page.locator('#sf-time').fill('2024-03-01T18:30+01:00');
		await expect(page.locator('#date-to-snowflake .answer')).toContainText(min.toString());
		await expect(page.locator('#date-to-snowflake .answer')).toContainText(max.toString());
		await page.locator('#sf-time').fill('2014-12-31');
		await expect(page.locator('#date-to-snowflake .error')).toContainText('before the Discord epoch');
		// The dimmed range still names the time its numbers belong to.
		await expect(page.locator('#date-to-snowflake .answer-label')).toContainText('2024-03-01T17:30:00.000Z');
	});

	test('the address round-trips', async ({ page }) => {
		await page.goto('/snowflake-id-decoder');
		await page.waitForLoadState('networkidle');
		await page.locator('#sf-id').fill('1234567890123456789');
		await page.getByRole('button', { name: 'Twitter/X', exact: true }).click();
		await page.locator('#sf-time').fill('2023-07-01');
		await expect(page).toHaveURL(/s=twitter/);
		await page.goto(page.url());
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#sf-id')).toHaveValue('1234567890123456789');
		await expect(page.locator('#sf-time')).toHaveValue('2023-07-01');
		await expect(page.getByRole('button', { name: 'Twitter/X', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.answer').first()).toContainText(
			decodeSnowflake('1234567890123456789', 'twitter').time!.iso
		);
	});

	test('a stale range cannot be copied, and the copy buttons say what they copy', async ({ page }) => {
		await page.goto('/snowflake-id-decoder');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: 'Copy first snowflake' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy last snowflake' })).toBeVisible();
		await page.locator('#sf-time').fill('2014-12-31');
		await expect
			.poll(() => page.locator('#date-to-snowflake .results').evaluate((el) => el.hasAttribute('inert')))
			.toBe(true);
		await expect(page.locator('#sf-time')).toHaveAttribute('aria-describedby', 'sf-time-help sf-time-error');
		// Tab goes from the Now button past the dimmed range, not into its Copy buttons.
		await page.getByRole('button', { name: 'Now', exact: true }).focus();
		await page.keyboard.press('Tab');
		expect(await page.evaluate(() => !!document.activeElement?.closest('#date-to-snowflake .results'))).toBe(false);
		await expect(page.locator('[role="alert"]')).toContainText('before the Discord epoch');
	});

	test('values the page rejects are taken out of the address', async ({ page }) => {
		await page.goto(`/snowflake-id-decoder?s=bogus&t=${'1'.repeat(60)}`);
		await page.waitForLoadState('networkidle');
		await expect.poll(() => new URL(page.url()).search).toBe('');
		await expect(page.getByRole('button', { name: 'Discord', exact: true })).toHaveAttribute('aria-pressed', 'true');
	});
});
