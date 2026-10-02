// Decoding and generating the IDs people paste into a search box to find out
// what is inside them: UUIDs (RFC 9562), ULIDs, MongoDB ObjectIds, Discord and
// Twitter/X snowflakes, and NanoIDs.
//
// Every ID here is a fixed-width integer with named bit fields, so one model
// covers them all: a value, a width, and a list of fields by bit position. The
// pages draw the fields and print the timestamps straight from this, so what a
// page says about an ID is always what the bits say.
//
// Nothing in here touches the DOM or a clock or a random source on its own.
// The generators take the time and a source of random bytes as arguments,
// which keeps them testable and keeps randomness out of prerendering.

export class IdError extends Error {}

/** What a field is for. The pages colour fields by this, so a timestamp looks the same in every ID. */
export type FieldTone =
	| 'time'
	| 'version'
	| 'variant'
	| 'random'
	| 'clock'
	| 'node'
	| 'counter'
	| 'machine'
	| 'process'
	| 'hash'
	| 'custom'
	| 'fixed';

export interface IdField {
	/** Short label drawn inside the bit diagram, a few characters. */
	short: string;
	/** Full name, for the legend and the field table. */
	name: string;
	/** Offset of the field's first (most significant) bit, counting from the ID's top bit as 0. */
	start: number;
	length: number;
	value: bigint;
	tone: FieldTone;
	/** What the value means, in words: a date, "random", "version 7". */
	meaning: string;
}

export interface IdTime {
	/** Milliseconds since 1970-01-01T00:00:00Z, the way Date counts. */
	unixMs: number;
	/** UTC in ISO 8601, with as many fraction digits as the ID actually carries. */
	iso: string;
	precision: '100 ns' | '1 ms' | '1 s';
	/** Where the count starts, for the explanation. */
	epoch: string;
	/** The raw count the ID stores, in its own units. */
	raw: bigint;
}

export type IdKind = 'uuid' | 'ulid' | 'objectid' | 'snowflake' | 'nanoid';
export type SnowflakeService = 'discord' | 'twitter';

export interface DecodedId {
	kind: IdKind;
	/** The ID written the standard way: lower case UUID with dashes, upper case ULID, and so on. */
	canonical: string;
	/** One line naming what this is, such as "UUID version 7". */
	title: string;
	/** One or two sentences on what that kind of ID is made of. */
	summary: string;
	bits: number;
	value: bigint;
	fields: IdField[];
	time?: IdTime;
	/** Things worth knowing about this particular value. */
	notes: string[];
	version?: number;
	variant?: UuidVariant;
	/** For a snowflake: which service's epoch and layout it was read with. */
	service?: SnowflakeService;
}

// ---------------------------------------------------------------- shared bits

const bitsOf = (value: bigint, width: number) => value.toString(2).padStart(width, '0');

/** The field `length` bits long starting `start` bits below the top of a `width` bit value. */
export function bitField(value: bigint, width: number, start: number, length: number): bigint {
	const shift = BigInt(width - start - length);
	return (value >> shift) & ((1n << BigInt(length)) - 1n);
}

/** Builds fields from a layout, reading each value from the ID. Checks the widths add up. */
function layout(
	value: bigint,
	width: number,
	parts: { short: string; name: string; length: number; tone: FieldTone; meaning?: (v: bigint) => string }[]
): IdField[] {
	let start = 0;
	const fields = parts.map((p) => {
		const v = bitField(value, width, start, p.length);
		const field: IdField = {
			short: p.short,
			name: p.name,
			start,
			length: p.length,
			value: v,
			tone: p.tone,
			meaning: p.meaning ? p.meaning(v) : ''
		};
		start += p.length;
		return field;
	});
	if (start !== width) throw new Error(`layout covers ${start} of ${width} bits`);
	return fields;
}

export const hexOf = (value: bigint, digits: number) => value.toString(16).padStart(digits, '0');

/** Floor division for BigInt, which otherwise rounds towards zero. */
function floorDiv(a: bigint, b: bigint): bigint {
	const q = a / b;
	return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/** The latest moment a Date can hold, so nothing past it is turned into a date. */
const MAX_DATE_MS = 8.64e15;

/**
 * An ISO 8601 UTC string with exactly `fraction` digits after the seconds.
 * Date only has milliseconds, so the digits past the third come from `subMs`,
 * the remainder in the ID's own finer unit.
 */
function isoUtc(ms: number, fraction: 0 | 3 | 7, sub = 0): string {
	const base = new Date(ms).toISOString();
	if (fraction === 0) return base.replace(/\.\d{3}Z$/, 'Z');
	if (fraction === 3) return base;
	return base.replace(/Z$/, String(sub).padStart(4, '0') + 'Z');
}

// ---------------------------------------------------------------- UUIDs

export type UuidVariant = 'ncs' | 'rfc' | 'microsoft' | 'future';

/** Variant names as RFC 9562 section 4.1 gives them. */
export const VARIANT_NAMES: Record<UuidVariant, string> = {
	ncs: 'NCS (reserved, Apollo Network Computing System)',
	rfc: 'RFC 9562 (the standard one)',
	microsoft: 'Microsoft (reserved, old COM GUIDs)',
	future: 'reserved for the future'
};

/**
 * The variant is read from the top bits of the 17th hex digit: 0xxx is NCS,
 * 10xx is the RFC layout, 110x is Microsoft and 111x is reserved. Only as many
 * bits as needed are significant, which is why the variant field is 1, 2 or 3
 * bits wide depending on its own value.
 */
export function variantOfDigit(digit: number): { variant: UuidVariant; bits: number } {
	if (digit < 0x8) return { variant: 'ncs', bits: 1 };
	if (digit < 0xc) return { variant: 'rfc', bits: 2 };
	if (digit < 0xe) return { variant: 'microsoft', bits: 3 };
	return { variant: 'future', bits: 3 };
}

/** 100 ns intervals from the start of the Gregorian calendar, 1582-10-15, to 1970-01-01. */
export const GREGORIAN_OFFSET = 122_192_928_000_000_000n;

/** A count of 100 ns intervals since 1582-10-15, as a time. */
export function gregorianTime(ticks: bigint): IdTime {
	const unix100ns = ticks - GREGORIAN_OFFSET;
	const ms = floorDiv(unix100ns, 10_000n);
	const sub = Number(unix100ns - ms * 10_000n);
	return {
		unixMs: Number(ms),
		iso: isoUtc(Number(ms), 7, sub),
		precision: '100 ns',
		epoch: '1582-10-15T00:00:00Z, the start of the Gregorian calendar',
		raw: ticks
	};
}

export function unixMsTime(ms: bigint, epochMs = 0n, epoch = '1970-01-01T00:00:00Z, the Unix epoch'): IdTime {
	const unixMs = Number(ms + epochMs);
	if (unixMs > MAX_DATE_MS) throw new IdError('That timestamp is past the last date JavaScript can represent');
	return { unixMs, iso: isoUtc(unixMs, 3), precision: '1 ms', epoch, raw: ms };
}

/** Hex digits and the dashes in their usual places, the form RFC 9562 writes. */
export function uuidString(value: bigint): string {
	const h = hexOf(value, 32);
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** How people write the same UUID: braces, urn:uuid:, no dashes, either case. Returns the 32 hex digits. */
export function parseUuid(input: string): string {
	let s = input.trim();
	s = s.replace(/^urn:uuid:/i, '');
	if (/^\{.*\}$/.test(s)) s = s.slice(1, -1);
	const hex = s.replace(/-/g, '');
	if (!/^[0-9a-fA-F]*$/.test(hex)) {
		const bad = hex.match(/[^0-9a-fA-F]/)?.[0];
		throw new IdError(`A UUID is hex digits 0 to 9 and a to f, and "${bad}" is not one`);
	}
	if (hex.length !== 32) {
		throw new IdError(`A UUID has 32 hex digits; this has ${hex.length}`);
	}
	// Dashes are optional, but where they appear they must split the digits
	// 8-4-4-4-12; a dash anywhere else means the text was mangled.
	if (s.includes('-') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
		throw new IdError('The dashes in a UUID go after the 8th, 12th, 16th and 20th hex digits (8-4-4-4-12)');
	}
	return hex.toLowerCase();
}

const VERSION_TITLES: Record<number, string> = {
	1: 'time and node (MAC address)',
	2: 'DCE security',
	3: 'name-based, MD5 hash',
	4: 'random',
	5: 'name-based, SHA-1 hash',
	6: 'time-ordered version of 1',
	7: 'Unix time, sortable',
	8: 'custom'
};

/** The two special UUIDs with no version at all. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
export const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export function decodeUuid(input: string): DecodedId {
	const hex = parseUuid(input);
	const value = BigInt('0x' + hex);
	const canonical = uuidString(value);
	const notes: string[] = [];

	if (value === 0n || value === (1n << 128n) - 1n) {
		const nil = value === 0n;
		return {
			kind: 'uuid',
			canonical,
			title: nil ? 'The nil UUID' : 'The max UUID',
			summary: nil
				? 'All 128 bits are 0. RFC 9562 reserves it to mean "no UUID", the way a null pointer means no object, so it has no version or variant.'
				: 'All 128 bits are 1. RFC 9562 added it as a sentinel at the other end from nil, for example as the upper bound of a range, so it has no version or variant.',
			bits: 128,
			value,
			fields: [
				{
					short: nil ? 'all zero' : 'all one',
					name: nil ? 'Nil' : 'Max',
					start: 0,
					length: 128,
					value,
					tone: 'fixed',
					meaning: nil ? 'every bit 0' : 'every bit 1'
				}
			],
			notes
		};
	}

	const version = Number(bitField(value, 128, 48, 4));
	const varDigit = Number(bitField(value, 128, 64, 4));
	const { variant, bits: varBits } = variantOfDigit(varDigit);

	if (variant !== 'rfc') {
		// Outside the RFC variant the version nibble means nothing, so the only
		// field that can be named is the variant itself.
		notes.push(
			variant === 'microsoft'
				? "This is Microsoft's reserved backward-compatibility variant, used by old COM GUIDs such as IUnknown, 00000000-0000-0000-C000-000000000046. RFC 9562 does not define its fields."
				: 'Only the RFC 9562 variant defines versions and fields, so the rest of the bits cannot be read any further.'
		);
		return {
			kind: 'uuid',
			canonical,
			title: `UUID, ${VARIANT_NAMES[variant].split(' (')[0]} variant`,
			summary: `The variant bits say this is not an RFC 9562 UUID: it is the ${VARIANT_NAMES[variant]} variant.`,
			bits: 128,
			value,
			fields: layout(value, 128, [
				{ short: 'data', name: 'Data', length: 64, tone: 'custom', meaning: () => 'not defined by RFC 9562' },
				{ short: 'var', name: 'Variant', length: varBits, tone: 'variant', meaning: () => VARIANT_NAMES[variant] },
				{
					short: 'data',
					name: 'Data',
					length: 64 - varBits,
					tone: 'custom',
					meaning: () => 'not defined by RFC 9562'
				}
			]).map((f, i) => (i === 2 ? { ...f, name: 'Data (continued)' } : f)),
			notes,
			variant
		};
	}

	const ver = {
		short: 'ver',
		name: 'Version',
		length: 4,
		tone: 'version' as const,
		meaning: (v: bigint) => `version ${v}`
	};
	const vr = {
		short: 'var',
		name: 'Variant',
		length: 2,
		tone: 'variant' as const,
		meaning: () => 'binary 10: RFC 9562'
	};
	const node = {
		short: 'node',
		name: 'Node',
		length: 48,
		tone: 'node' as const,
		meaning: (v: bigint) =>
			// The multicast bit is the lowest bit of the first byte. A real network
			// card's address always has it clear, so a set bit marks a made-up node.
			(v >> 40n) & 1n ? 'random: the multicast bit is set' : 'a MAC address (multicast bit clear)'
	};
	const clockSeq = {
		short: 'clock seq',
		name: 'Clock sequence',
		length: 14,
		tone: 'clock' as const,
		meaning: (v: bigint) => `${v}, changed when the clock goes back or the node changes`
	};

	let fields: IdField[];
	let time: IdTime | undefined;
	let summary: string;
	switch (version) {
		case 1: {
			fields = layout(value, 128, [
				{ short: 'time low', name: 'Time, low 32 bits', length: 32, tone: 'time' },
				{ short: 'time mid', name: 'Time, middle 16 bits', length: 16, tone: 'time' },
				ver,
				{ short: 'time high', name: 'Time, high 12 bits', length: 12, tone: 'time' },
				vr,
				clockSeq,
				node
			]);
			const ticks = (fields[3].value << 48n) | (fields[1].value << 32n) | fields[0].value;
			time = gregorianTime(ticks);
			summary =
				'A 60-bit count of 100 ns intervals since 1582-10-15, split into three pieces with the lowest bits first, then a clock sequence and a 48-bit node ID that was originally the MAC address.';
			if (!((fields[6].value >> 40n) & 1n)) {
				notes.push(
					'The multicast bit of the node is clear, so this node is probably the network card address of the machine that made it.'
				);
			} else {
				notes.push('The node has the multicast bit set, so it is a random number rather than a real MAC address.');
			}
			notes.push(
				'Because the low bits of the time come first, version 1 UUIDs do not sort in time order. Version 6 is the same data reordered so that they do.'
			);
			break;
		}
		case 2: {
			fields = layout(value, 128, [
				{ short: 'local id', name: 'Local identifier', length: 32, tone: 'custom', meaning: (v) => `${v}` },
				{ short: 'time mid', name: 'Time, middle 16 bits', length: 16, tone: 'time' },
				ver,
				{ short: 'time high', name: 'Time, high 12 bits', length: 12, tone: 'time' },
				vr,
				{ short: 'clk', name: 'Clock sequence (6 bits)', length: 6, tone: 'clock', meaning: (v) => `${v}` },
				{
					short: 'dom',
					name: 'Local domain',
					length: 8,
					tone: 'custom',
					meaning: (v) => (v === 0n ? '0: person (POSIX UID)' : v === 1n ? '1: group (POSIX GID)' : `${v}`)
				},
				node
			]);
			summary =
				'DCE Security, from DCE 1.1: a version 1 layout with the low 32 bits of the time replaced by a local ID such as a POSIX user ID. RFC 9562 reserves the version without defining it further.';
			notes.push(
				'The low 32 bits of the time are gone, so the time can only be read to within about 7 minutes; this page does not guess at it.'
			);
			break;
		}
		case 3:
		case 5: {
			const algo = version === 3 ? 'MD5' : 'SHA-1';
			fields = layout(value, 128, [
				{ short: 'hash', name: `${algo} hash, bits 0 to 47`, length: 48, tone: 'hash' },
				ver,
				{ short: 'hash', name: `${algo} hash, bits 52 to 63`, length: 12, tone: 'hash' },
				vr,
				{ short: 'hash', name: `${algo} hash, bits 66 to 127`, length: 62, tone: 'hash' }
			]);
			summary = `The first 128 bits of the ${algo} hash of a namespace UUID followed by a name, with the version and variant bits written over 6 of them. The same namespace and name always give the same UUID.`;
			notes.push(
				`A hash cannot be reversed: the UUID does not contain the name, and nothing here can recover it. You can only check a guess by hashing it again.`
			);
			break;
		}
		case 4: {
			fields = layout(value, 128, [
				{ short: 'random', name: 'Random, 48 bits', length: 48, tone: 'random' },
				ver,
				{ short: 'random', name: 'Random, 12 bits', length: 12, tone: 'random' },
				vr,
				{ short: 'random', name: 'Random, 62 bits', length: 62, tone: 'random' }
			]);
			summary =
				'122 random bits, with the version and variant written into the other 6. There is no time, machine or counter in it, so there is nothing more to decode.';
			break;
		}
		case 6: {
			fields = layout(value, 128, [
				{ short: 'time high', name: 'Time, high 32 bits', length: 32, tone: 'time' },
				{ short: 'time mid', name: 'Time, middle 16 bits', length: 16, tone: 'time' },
				ver,
				{ short: 'time low', name: 'Time, low 12 bits', length: 12, tone: 'time' },
				vr,
				clockSeq,
				node
			]);
			const ticks = (fields[0].value << 28n) | (fields[1].value << 12n) | fields[3].value;
			time = gregorianTime(ticks);
			summary =
				'The same 60-bit time, clock sequence and node as version 1, with the time written highest bits first, so sorting the text sorts by time.';
			break;
		}
		case 7: {
			fields = layout(value, 128, [
				{ short: 'unix ms', name: 'Unix time in milliseconds', length: 48, tone: 'time' },
				ver,
				{ short: 'rand a', name: 'Random (rand_a)', length: 12, tone: 'random' },
				vr,
				{ short: 'rand b', name: 'Random (rand_b)', length: 62, tone: 'random' }
			]);
			time = unixMsTime(fields[0].value);
			summary =
				'A 48-bit count of milliseconds since 1970, then 74 bits that are random or partly a counter. The time comes first, so these UUIDs sort by creation time and index well in databases.';
			notes.push(
				'Generators may use some of rand_a as a sub-millisecond fraction or a counter to keep IDs from the same millisecond in order; from outside, it cannot be told apart from random.'
			);
			break;
		}
		case 8: {
			fields = layout(value, 128, [
				{ short: 'custom a', name: 'custom_a', length: 48, tone: 'custom' },
				ver,
				{ short: 'custom b', name: 'custom_b', length: 12, tone: 'custom' },
				vr,
				{ short: 'custom c', name: 'custom_c', length: 62, tone: 'custom' }
			]);
			summary =
				'Version 8 is for experimental and vendor-specific layouts. Only the version and variant are fixed; what the other 122 bits mean is up to whoever made it.';
			break;
		}
		default: {
			fields = layout(value, 128, [
				{ short: 'data', name: 'Data', length: 48, tone: 'custom' },
				ver,
				{ short: 'data', name: 'Data', length: 12, tone: 'custom' },
				vr,
				{ short: 'data', name: 'Data', length: 62, tone: 'custom' }
			]);
			summary = `Version ${version} is not defined: RFC 9562 uses 1 to 8, and ${
				version === 0 ? '0 is unused' : '9 to 15 are reserved'
			}. It may be a made-up or corrupted value.`;
		}
	}

	if (time) {
		const timeFields = fields.filter((f) => f.tone === 'time');
		for (const f of timeFields) {
			if (!f.meaning) f.meaning = timeFields.length === 1 ? time.iso : 'part of the timestamp';
		}
	}
	for (const f of fields) if (!f.meaning) f.meaning = f.tone === 'random' ? 'random' : f.tone === 'hash' ? 'hash' : '';

	return {
		kind: 'uuid',
		canonical,
		title: VERSION_TITLES[version] ? `UUID version ${version}: ${VERSION_TITLES[version]}` : `UUID version ${version}`,
		summary,
		bits: 128,
		value,
		fields,
		time,
		notes,
		version,
		variant
	};
}

// ---------------------------------------------------------------- ULID

/** Crockford's Base32: digits then letters, leaving out I, L, O and U. */
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * The value of one Crockford Base32 character, or -1. Case does not matter,
 * and I and L read as 1 and O as 0, because Crockford designed the alphabet
 * to survive being read aloud and typed back in.
 */
export function crockfordValue(ch: string): number {
	const c = ch.toUpperCase();
	if (c === 'I' || c === 'L') return 1;
	if (c === 'O') return 0;
	return CROCKFORD.indexOf(c);
}

export function crockfordEncode(value: bigint, length: number): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		out = CROCKFORD[Number(value & 31n)] + out;
		value >>= 5n;
	}
	return out;
}

export function parseUlid(input: string): { value: bigint; chars: { char: string; value: number }[] } {
	const s = input.trim();
	if (s.length !== 26) throw new IdError(`A ULID is 26 characters; this has ${s.length}`);
	let value = 0n;
	const chars: { char: string; value: number }[] = [];
	for (const ch of s) {
		const v = crockfordValue(ch);
		if (v < 0) throw new IdError(`"${ch}" is not in Crockford's Base32 alphabet (0-9 and A-Z without I, L, O, U)`);
		chars.push({ char: ch, value: v });
		value = (value << 5n) | BigInt(v);
	}
	// 26 characters hold 130 bits, and a ULID only has 128, so the first
	// character can only be 0 to 7.
	if (value >> 128n) throw new IdError('That is larger than 128 bits: a ULID starts with 0 to 7');
	return { value, chars };
}

export function decodeUlid(input: string): DecodedId {
	const { value } = parseUlid(input);
	const fields = layout(value, 128, [
		{ short: 'unix ms', name: 'Unix time in milliseconds', length: 48, tone: 'time' },
		{ short: 'random', name: 'Random, 80 bits', length: 80, tone: 'random', meaning: () => 'random' }
	]);
	const time = unixMsTime(fields[0].value);
	fields[0].meaning = time.iso;
	const canonical = crockfordEncode(value, 26);
	const notes: string[] = [];
	if (canonical !== input.trim()) {
		notes.push(
			`Written canonically as ${canonical}: ULIDs are upper case, and lower case letters, I, L and O are read as their canonical characters.`
		);
	}
	return {
		kind: 'ulid',
		canonical,
		title: 'ULID',
		summary:
			'A 48-bit millisecond Unix timestamp and 80 random bits, written as 26 characters of Crockford Base32. The first 10 characters are the time, so ULIDs sort by when they were made.',
		bits: 128,
		value,
		fields,
		time,
		notes
	};
}

/** A ULID's 128 bits are a UUID's 128 bits, so either can be written as the other. */
export const ulidToUuid = (ulid: string) => uuidString(parseUlid(ulid).value);
export const uuidToUlid = (uuid: string) => crockfordEncode(BigInt('0x' + parseUuid(uuid)), 26);

// ---------------------------------------------------------------- ObjectId

export function decodeObjectId(input: string): DecodedId {
	// Either the bare hex or the whole ObjectId("...") the mongo shell prints.
	const t = input.trim();
	const wrapped = t.match(/^ObjectId\(\s*(["']?)([0-9a-fA-F]{24})\1\s*\)$/i);
	const s = wrapped ? wrapped[2] : t;
	if (!/^[0-9a-fA-F]{24}$/.test(s)) throw new IdError('An ObjectId is 24 hex digits');
	const value = BigInt('0x' + s);
	const fields = layout(value, 96, [
		{ short: 'unix seconds', name: 'Unix time in seconds', length: 32, tone: 'time' },
		{
			short: 'random',
			name: 'Random, 5 bytes',
			length: 40,
			tone: 'random',
			meaning: () => 'random, chosen once per process'
		},
		{ short: 'counter', name: 'Counter, 3 bytes', length: 24, tone: 'counter', meaning: (v) => `${v}` }
	]);
	const seconds = fields[0].value;
	const time: IdTime = {
		unixMs: Number(seconds) * 1000,
		iso: isoUtc(Number(seconds) * 1000, 0),
		precision: '1 s',
		epoch: '1970-01-01T00:00:00Z, the Unix epoch',
		raw: seconds
	};
	fields[0].meaning = time.iso;
	return {
		kind: 'objectid',
		canonical: s.toLowerCase(),
		title: 'MongoDB ObjectId',
		summary:
			'12 bytes: a 4-byte Unix timestamp in seconds, a 5-byte random value fixed for each process, and a 3-byte counter that starts at a random value and goes up by one for each new ID.',
		bits: 96,
		value,
		fields,
		time,
		notes: [
			'Older drivers split the middle 5 bytes into a 3-byte machine ID and a 2-byte process ID. Current drivers fill them with random bytes instead, so they no longer identify a machine.'
		]
	};
}

// ---------------------------------------------------------------- snowflakes

export const SNOWFLAKE_EPOCHS: Record<SnowflakeService, { ms: bigint; iso: string; name: string }> = {
	discord: { ms: 1_420_070_400_000n, iso: '2015-01-01T00:00:00.000Z', name: 'Discord' },
	twitter: { ms: 1_288_834_974_657n, iso: new Date(1_288_834_974_657).toISOString(), name: 'Twitter/X' }
};

const MAX_U64 = (1n << 64n) - 1n;

export function parseSnowflake(input: string): bigint {
	const s = input.trim().replace(/[,_\s]/g, '');
	if (!s) throw new IdError('Type a snowflake ID, a whole number such as 175928847299117063');
	if (!/^\d+$/.test(s)) {
		throw new IdError('A snowflake is a whole number in decimal, digits 0 to 9 only');
	}
	const value = BigInt(s);
	if (value > MAX_U64) throw new IdError('That is more than 64 bits, too large for a snowflake');
	return value;
}

export function decodeSnowflake(input: string | bigint, service: SnowflakeService = 'discord'): DecodedId {
	const value = typeof input === 'bigint' ? input : parseSnowflake(input);
	const epoch = SNOWFLAKE_EPOCHS[service];
	const fields =
		service === 'discord'
			? layout(value, 64, [
					{ short: 'timestamp', name: 'Milliseconds since the Discord epoch', length: 42, tone: 'time' },
					{ short: 'worker', name: 'Internal worker ID', length: 5, tone: 'machine', meaning: (v) => `${v}` },
					{ short: 'proc', name: 'Internal process ID', length: 5, tone: 'process', meaning: (v) => `${v}` },
					{
						short: 'increment',
						name: 'Increment',
						length: 12,
						tone: 'counter',
						// Discord's documentation: "For every ID that is generated on that process, this number is incremented".
						meaning: (v) => `${v}, goes up by one for every ID generated on that process`
					}
			  ])
			: layout(value, 64, [
					{
						short: '',
						name: 'Sign bit',
						length: 1,
						tone: 'fixed',
						meaning: (v) =>
							v ? '1, which Twitter never sets' : '0, so the ID stays positive as a signed 64-bit number'
					},
					{ short: 'timestamp', name: 'Milliseconds since the Twitter epoch', length: 41, tone: 'time' },
					{
						short: 'machine',
						name: 'Machine ID',
						length: 10,
						tone: 'machine',
						meaning: (v) => `${v} (datacentre ${v >> 5n}, worker ${v & 31n} in the original layout)`
					},
					{
						short: 'sequence',
						name: 'Sequence',
						length: 12,
						tone: 'counter',
						meaning: (v) => `${v}, counts IDs made by that machine in the same millisecond, from 0`
					}
			  ]);
	// Twitter's timestamp is 41 bits under a sign bit. Leaving the sign bit out
	// keeps the time inside the layout's range even for a value Twitter would
	// never produce; the sign bit field says it is set.
	const ms = service === 'twitter' ? (value >> 22n) & ((1n << 41n) - 1n) : value >> 22n;
	const time = unixMsTime(ms, epoch.ms, `${epoch.iso}, the ${epoch.name} epoch`);
	const timeField = fields.find((f) => f.tone === 'time');
	if (timeField) timeField.meaning = `${ms} ms after the epoch: ${time.iso}`;
	const notes: string[] = [];
	if (value < 1n << 22n)
		notes.push('The timestamp is 0, so this would have been made in the first millisecond of the epoch.');
	const asNumber = Number(value);
	if (BigInt(asNumber) !== value) {
		notes.push(
			`As a JavaScript number this becomes ${String(
				asNumber
			)}, which is a different ID: numbers above 2^53 lose their last digits, which is why APIs send snowflakes as strings.`
		);
	}
	return {
		kind: 'snowflake',
		canonical: value.toString(),
		title: `${epoch.name} snowflake`,
		summary:
			service === 'discord'
				? 'A 64-bit number: milliseconds since 2015-01-01 in the top 42 bits, then a 5-bit worker ID, a 5-bit process ID and a 12-bit increment.'
				: 'A 64-bit number: an unused sign bit, milliseconds since the Twitter epoch in the next 41 bits, then a 10-bit machine ID and a 12-bit sequence number.',
		bits: 64,
		value,
		fields,
		time,
		notes,
		service
	};
}

/**
 * Every snowflake made in one millisecond lies between these two: the time in
 * the top bits, and the low 22 bits all 0 or all 1. Discord's API accepts
 * either as a before or after cursor to fetch messages around a moment.
 */
export function snowflakeRange(unixMs: number, service: SnowflakeService = 'discord'): { min: bigint; max: bigint } {
	const epoch = SNOWFLAKE_EPOCHS[service];
	if (!Number.isFinite(unixMs) || !Number.isInteger(unixMs)) throw new IdError('That is not a moment in time');
	const ms = BigInt(unixMs) - epoch.ms;
	if (ms < 0n) throw new IdError(`That is before the ${epoch.name} epoch, ${epoch.iso}, so no snowflake has that time`);
	const timeBits = service === 'discord' ? 42n : 41n;
	if (ms >= 1n << timeBits) throw new IdError(`That is after the last moment a ${epoch.name} snowflake can hold`);
	const min = ms << 22n;
	return { min, max: min | ((1n << 22n) - 1n) };
}

/** The last moment each layout can represent, after which the timestamp field overflows. */
export function snowflakeLastMoment(service: SnowflakeService): string {
	const bits = service === 'discord' ? 42n : 41n;
	return new Date(Number(SNOWFLAKE_EPOCHS[service].ms + (1n << bits) - 1n)).toISOString();
}

// ---------------------------------------------------------------- dates typed in

/**
 * Reads a date and time the way people type one: 2024-03-01, 2024-03-01 12:30,
 * 2024-03-01T12:30:15.250Z, or with an offset such as +02:00. Without an
 * offset it is UTC, never the reader's local time, so a shared link means the
 * same moment for everyone. Date.parse would treat some of these as local time.
 */
export function parseMoment(input: string): number {
	const s = input.trim();
	const m = s.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i
	);
	if (!m) throw new IdError('Write the date as YYYY-MM-DD, optionally with a time such as 2024-03-01 12:30:00');
	const [, y, mo, d, h = '0', mi = '0', sec = '0', frac = '0', zone] = m;
	const parts = [Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(sec)];
	if (
		parts[1] < 1 ||
		parts[1] > 12 ||
		parts[2] < 1 ||
		parts[2] > 31 ||
		parts[3] > 23 ||
		parts[4] > 59 ||
		parts[5] > 59
	) {
		throw new IdError('That date or time has a field out of range');
	}
	// Date.UTC reads years 0 to 99 as 1900 to 1999, so the year is set on its own.
	const date = new Date(0);
	date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
	date.setUTCHours(parts[3], parts[4], parts[5], Number(frac.padEnd(3, '0')));
	let ms = date.getTime();
	// Date rolls 31 April over into May; refuse it rather than move the date.
	if (date.getUTCDate() !== parts[2]) throw new IdError('That month does not have that many days');
	if (zone && !/^(Z|UTC)$/i.test(zone)) {
		const z = zone.replace(':', '');
		const hours = Number(z.slice(1, 3));
		const minutes = Number(z.slice(3, 5));
		// Real offsets run from -12:00 to +14:00.
		if (hours > 14 || minutes > 59) throw new IdError('A UTC offset is at most 14 hours, such as +02:00 or -05:00');
		ms -= (hours * 60 + minutes) * (z[0] === '-' ? -1 : 1) * 60_000;
	}
	return ms;
}

/** How long ago (or how far ahead) a moment is, in the two largest units that matter. */
export function describeAge(thenMs: number, nowMs: number): string {
	const diff = nowMs - thenMs;
	const abs = Math.abs(diff);
	const s = Math.floor(abs / 1000);
	const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	let text: string;
	if (s < 60) text = unit(s, 'second');
	else if (s < 3600) text = unit(Math.floor(s / 60), 'minute');
	else if (s < 86400) text = `${unit(Math.floor(s / 3600), 'hour')} ${unit(Math.floor((s % 3600) / 60), 'minute')}`;
	else {
		// Whole calendar years first, so 2025-01-01 to 2026-01-01 is one year,
		// then the days left over.
		const [a, b] = diff >= 0 ? [thenMs, nowMs] : [nowMs, thenMs];
		const addYears = (ms: number, n: number) => {
			const d = new Date(ms);
			d.setUTCFullYear(d.getUTCFullYear() + n);
			return d.getTime();
		};
		let years = new Date(b).getUTCFullYear() - new Date(a).getUTCFullYear();
		if (addYears(a, years) > b) years--;
		const rest = Math.floor((b - addYears(a, years)) / 86_400_000);
		text = years ? `${unit(years, 'year')} ${unit(rest, 'day')}` : unit(rest, 'day');
	}
	if (s === 0) return 'just now';
	return diff >= 0 ? `${text} ago` : `${text} from now`;
}

// ---------------------------------------------------------------- detection

export const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export function decodeNanoId(input: string): DecodedId {
	const s = input.trim();
	return {
		kind: 'nanoid',
		canonical: s,
		title: 'Probably a NanoID',
		summary: `21 characters from the 64-character URL-safe alphabet, ${
			21 * 6
		} random bits. A NanoID is random all the way through, so there is no time or machine to decode.`,
		bits: 126,
		value: 0n,
		fields: [],
		notes: [
			'Any 21-character string of letters, digits, _ and - fits this pattern, so it could also be a token from another system.'
		]
	};
}

/**
 * Works out what kind of ID a string is from its length and alphabet, then
 * decodes it. The checks run from the most specific shape to the least, so a
 * 32-digit hex string is a UUID before it is anything else.
 */
export function detectId(input: string, service: SnowflakeService = 'discord'): DecodedId {
	const s = input.trim();
	if (!s) throw new IdError('Paste an ID: a UUID, ULID, ObjectId, snowflake or NanoID');
	const bare = s
		.replace(/^urn:uuid:/i, '')
		.replace(/^\{(.*)\}$/, '$1')
		.replace(/-/g, '');
	if (/^[0-9a-f]{32}$/i.test(bare)) return decodeUuid(s);
	if (/^[0-9a-f]{24}$/i.test(s) || /^ObjectId\(\s*(["']?)[0-9a-f]{24}\1\s*\)$/i.test(s)) return decodeObjectId(s);
	// Snowflakes are sometimes pasted with digit-group separators: 175,928,847,299,117,063.
	if (/^\d[\d,_ ]*$/.test(s) && /^\d{1,20}$/.test(s.replace(/[,_ ]/g, ''))) return decodeSnowflake(s, service);
	if (s.length === 26 && [...s].every((c) => crockfordValue(c) >= 0)) return decodeUlid(s);
	if (s.length === 21 && /^[A-Za-z0-9_-]+$/.test(s)) return decodeNanoId(s);

	// Nothing matched: say what it nearly was.
	if (/^[0-9a-f]+$/i.test(bare) && s.includes('-')) return decodeUuid(s); // throws, naming the digit count
	if (s.length === 36 || s.length === 32) return decodeUuid(s);
	if (s.length === 26) return decodeUlid(s);
	throw new IdError(
		`Not a recognised ID: ${s.length} characters. UUIDs are 32 hex digits (36 with dashes), ULIDs 26 characters, ObjectIds 24 hex digits, NanoIDs 21 characters, and snowflakes a number of up to 20 digits.`
	);
}

// ---------------------------------------------------------------- generating

/** Fills a new array with random bytes. The page passes crypto.getRandomValues; tests pass a seeded one. */
export type RandomBytes = (n: number) => Uint8Array;

const bytesToBig = (b: Uint8Array) => b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);

export function uuidV4(random: RandomBytes): bigint {
	let v = bytesToBig(random(16));
	v = (v & ~(0xfn << 76n)) | (4n << 76n);
	v = (v & ~(0x3n << 62n)) | (2n << 62n);
	return v;
}

export type GenKind = 'v4' | 'v7' | 'v1' | 'ulid' | 'objectid' | 'nanoid' | 'snowflake';

export interface GenOptions {
	upper: boolean;
	dashes: boolean;
}

/** Every time the generators can write, as Unix milliseconds: [first, last]. */
export const GEN_TIME_RANGE: Record<'v7' | 'v1' | 'ulid' | 'objectid', { min: number; max: number; name: string }> = {
	// 48 bits of milliseconds from 1970.
	v7: { min: 0, max: 2 ** 48 - 1, name: 'A UUID v7' },
	ulid: { min: 0, max: 2 ** 48 - 1, name: 'A ULID' },
	// 60 bits of 100 ns from 1582-10-15; the last whole millisecond that fits.
	v1: {
		min: -Number(GREGORIAN_OFFSET / 10_000n),
		max: Number(((1n << 60n) - 1n - GREGORIAN_OFFSET) / 10_000n),
		name: 'A UUID v1'
	},
	// 32 bits of seconds from 1970, which ends in February 2106.
	objectid: { min: 0, max: (2 ** 32 - 1) * 1000 + 999, name: 'An ObjectId' }
};

/** Refuses a time a format has no bits for, rather than writing a malformed ID. */
function checkGenTime(kind: keyof typeof GEN_TIME_RANGE, nowMs: number) {
	const r = GEN_TIME_RANGE[kind];
	if (!Number.isInteger(nowMs) || nowMs < r.min || nowMs > r.max) {
		const year = (ms: number) => new Date(ms).getUTCFullYear();
		throw new IdError(`${r.name} can only hold times from ${year(r.min)} to ${year(r.max)}`);
	}
}

/**
 * A generator keeps the state a real one would: the last timestamp, so IDs
 * made in the same millisecond still come out in order, and the per-process
 * values (v1 node and clock sequence, ObjectId random bytes and counter).
 *
 * Asking for an earlier time than the last one is treated as the clock having
 * been set back: the IDs get the time asked for, and only stop being in order
 * with the ones before. For version 1, RFC 9562 section 5.1 says the clock
 * sequence must change when that happens, so it does.
 */
export class IdGenerator {
	private ulidAsked = -1;
	private ulidMs = -1;
	private ulidRandom = 0n;
	private v7Asked = -1;
	private v7Ms = -1;
	private v7Random = 0n;
	private v1Asked = Number.NEGATIVE_INFINITY;
	private v1Ticks = -1n;
	private v1Clock: bigint;
	private v1Node: bigint;
	private oidRandom: bigint;
	private oidCounter: number;

	private random: RandomBytes;

	constructor(random: RandomBytes) {
		this.random = random;
		const r = random(13);
		this.v1Clock = bytesToBig(r.subarray(0, 2)) & 0x3fffn;
		// RFC 9562 section 6.10: a random node must have the multicast bit set,
		// so it can never collide with a real network card's address.
		this.v1Node = bytesToBig(r.subarray(2, 8)) | (1n << 40n);
		this.oidRandom = bytesToBig(r.subarray(8, 13));
		this.oidCounter = Number(bytesToBig(random(3)));
	}

	/** A UUID v7. In the same millisecond, the 74 random bits go up by a random step, as RFC 9562 method 2 allows. */
	v7(nowMs: number): bigint {
		checkGenTime('v7', nowMs);
		let ms = nowMs;
		if (nowMs >= this.v7Asked && nowMs <= this.v7Ms) {
			// Same millisecond as last time (or one the counter already spilled into).
			ms = this.v7Ms;
			this.v7Random += 1n + bytesToBig(this.random(4));
			if (this.v7Random >> 74n) {
				ms += 1;
				this.v7Random = bytesToBig(this.random(10)) & ((1n << 74n) - 1n);
			}
		} else {
			this.v7Random = bytesToBig(this.random(10)) & ((1n << 74n) - 1n);
		}
		this.v7Asked = nowMs;
		this.v7Ms = ms;
		const randA = this.v7Random >> 62n;
		const randB = this.v7Random & ((1n << 62n) - 1n);
		return (BigInt(ms) << 80n) | (7n << 76n) | (randA << 64n) | (2n << 62n) | randB;
	}

	/** A UUID v1 with a random node. Within one millisecond the 100 ns count steps on so no two are equal. */
	v1(nowMs: number): bigint {
		checkGenTime('v1', nowMs);
		let ticks = BigInt(nowMs) * 10_000n + GREGORIAN_OFFSET;
		if (nowMs < this.v1Asked) {
			// The clock went back: same time again is possible, so change the clock sequence.
			this.v1Clock = (this.v1Clock + 1n) & 0x3fffn;
		} else if (ticks <= this.v1Ticks) {
			ticks = this.v1Ticks + 1n;
		}
		this.v1Asked = nowMs;
		this.v1Ticks = ticks;
		const low = ticks & 0xffffffffn;
		const mid = (ticks >> 32n) & 0xffffn;
		const high = (ticks >> 48n) & 0xfffn;
		return (
			(low << 96n) | (mid << 80n) | (1n << 76n) | (high << 64n) | (2n << 62n) | (this.v1Clock << 48n) | this.v1Node
		);
	}

	/** A ULID. In the same millisecond the random part goes up by one, as the ULID spec's monotonic mode says. */
	ulid(nowMs: number): bigint {
		checkGenTime('ulid', nowMs);
		if (nowMs >= this.ulidAsked && nowMs <= this.ulidMs) {
			nowMs = this.ulidMs;
			this.ulidRandom += 1n;
			if (this.ulidRandom >> 80n) throw new IdError('Too many ULIDs in one millisecond');
		} else {
			this.ulidAsked = nowMs;
			this.ulidRandom = bytesToBig(this.random(10));
		}
		this.ulidMs = nowMs;
		return (BigInt(nowMs) << 80n) | this.ulidRandom;
	}

	objectId(nowMs: number): bigint {
		checkGenTime('objectid', nowMs);
		this.oidCounter = (this.oidCounter + 1) % 0x1000000;
		return (BigInt(Math.floor(nowMs / 1000)) << 64n) | (this.oidRandom << 24n) | BigInt(this.oidCounter);
	}

	nanoid(size = 21): string {
		// 256 is a multiple of 64, so masking a byte to 6 bits is unbiased.
		return Array.from(this.random(size), (b) => NANOID_ALPHABET[b & 63]).join('');
	}

	snowflake(nowMs: number, service: SnowflakeService = 'discord'): bigint {
		const { min } = snowflakeRange(nowMs, service);
		return min | (bytesToBig(this.random(3)) & ((1n << 22n) - 1n));
	}

	/** One ID of the given kind, as text, formatted the way the options say where the format allows. */
	make(kind: GenKind, nowMs: number, opts: GenOptions): string {
		const uuid = (v: bigint) => {
			let s = uuidString(v);
			if (!opts.dashes) s = s.replace(/-/g, '');
			return opts.upper ? s.toUpperCase() : s;
		};
		switch (kind) {
			case 'v4':
				return uuid(uuidV4(this.random));
			case 'v7':
				return uuid(this.v7(nowMs));
			case 'v1':
				return uuid(this.v1(nowMs));
			case 'ulid': {
				const s = crockfordEncode(this.ulid(nowMs), 26);
				return opts.upper ? s : s.toLowerCase();
			}
			case 'objectid': {
				const s = hexOf(this.objectId(nowMs), 24);
				return opts.upper ? s.toUpperCase() : s;
			}
			case 'nanoid':
				return this.nanoid();
			case 'snowflake':
				return this.snowflake(nowMs).toString();
		}
	}
}

/**
 * Which formatting options apply to which kind: case and dashes would change a
 * NanoID or a snowflake into another ID. `upper` is the case the format is
 * usually written in: the ULID spec writes upper case, UUIDs and ObjectIds are
 * usually printed in lower case.
 */
export const GEN_FORMATS: Record<GenKind, { label: string; caseOption: boolean; dashes: boolean; upper: boolean }> = {
	v4: { label: 'UUID v4 (random)', caseOption: true, dashes: true, upper: false },
	v7: { label: 'UUID v7 (time-ordered)', caseOption: true, dashes: true, upper: false },
	v1: { label: 'UUID v1 (random node)', caseOption: true, dashes: true, upper: false },
	ulid: { label: 'ULID', caseOption: true, dashes: false, upper: true },
	objectid: { label: 'MongoDB ObjectId', caseOption: true, dashes: false, upper: false },
	nanoid: { label: 'NanoID', caseOption: false, dashes: false, upper: false },
	snowflake: { label: 'Discord snowflake', caseOption: false, dashes: false, upper: false }
};

/**
 * How many random IDs of `bits` random bits you need before the chance of any
 * two being equal reaches one half: the birthday bound, sqrt(2 ln 2 · 2^bits).
 */
export function birthdayHalf(bits: number): number {
	return Math.sqrt(2 * Math.LN2) * 2 ** (bits / 2);
}

/** The ID formats side by side, from the layouts above. */
export const ID_FORMATS: {
	name: string;
	bits: number;
	chars: string;
	time: string;
	random: string;
	/** Whether sorting the IDs sorts them by creation time, and to what precision. */
	sortable: string;
}[] = [
	{ name: 'UUID v4', bits: 128, chars: '36 hex and dashes', time: 'none', random: '122 bits', sortable: 'No' },
	{
		name: 'UUID v7',
		bits: 128,
		chars: '36 hex and dashes',
		time: '48 bits, 1 ms',
		random: '74 bits',
		sortable: 'To the millisecond'
	},
	{
		name: 'UUID v1',
		bits: 128,
		chars: '36 hex and dashes',
		time: '60 bits, 100 ns',
		random: 'none, or a random node',
		sortable: 'No'
	},
	{
		name: 'ULID',
		bits: 128,
		chars: '26 Crockford Base32',
		time: '48 bits, 1 ms',
		random: '80 bits',
		sortable: 'To the millisecond'
	},
	{
		name: 'ObjectId',
		bits: 96,
		chars: '24 hex',
		time: '32 bits, 1 s',
		random: '40 bits per process',
		sortable: 'To the second'
	},
	{
		name: 'Discord snowflake',
		bits: 64,
		chars: 'up to 20 decimal digits',
		time: '42 bits, 1 ms',
		random: 'none',
		sortable: 'To the millisecond'
	},
	{ name: 'NanoID', bits: 126, chars: '21 URL-safe characters', time: 'none', random: '126 bits', sortable: 'No' }
];

/** Bit strings of each field, for drawing. */
export const fieldBits = (f: IdField) => bitsOf(f.value, f.length);
