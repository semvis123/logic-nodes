// IPv6 parsing and RFC 5952 compression, checked against the examples in the
// RFC itself, against the WHATWG URL parser built into Node (which serialises
// IPv6 hosts with the same zero-run rule), and against a second compressor
// written with strings instead of runs.

import { expect, test } from '@playwright/test';
import { isIPv6 } from 'node:net';
import {
	parseIPv6,
	expand,
	compress,
	compressText,
	canonical,
	explain,
	summarise,
	prefixInfo,
	addressType,
	describe as describeAddress,
	parseMac,
	eui64,
	toBigInt,
	fromBigInt,
	allBits,
	ADDRESS_TYPES,
	MAPPED_RANGE,
	IPv6Error,
	type Hextets
} from '../src/lib/ipv6.js';

/** Random hextets with plenty of zero runs, the interesting case for compression. */
function randomHextets(): Hextets {
	const mapped = Math.random() < 0.05;
	const h = Array.from({ length: 8 }, () => {
		const r = Math.random();
		if (r < 0.45) return 0;
		if (r < 0.55) return Math.floor(Math.random() * 16);
		return Math.floor(Math.random() * 0x10000);
	});
	return mapped ? [0, 0, 0, 0, 0, 0xffff, h[6], h[7]] : h;
}

/**
 * The independent reference: print every group in short hex, then search the
 * colon-joined string for the longest ":0:0…:" pattern, longest first. indexOf
 * finds the earliest occurrence, which is the RFC's tie break.
 */
function naiveCompress(h: Hextets): string {
	const mapped = h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff;
	const hexGroups = (mapped ? h.slice(0, 6) : h).map((x) => x.toString(16));
	const s = ':' + hexGroups.join(':') + ':';
	let out = s;
	for (let k = hexGroups.length; k >= 2; k--) {
		const pattern = ':' + Array(k).fill('0').join(':') + ':';
		const at = s.indexOf(pattern);
		if (at >= 0) {
			out = s.slice(0, at) + '::' + s.slice(at + pattern.length);
			break;
		}
	}
	if (out.startsWith(':') && out[1] !== ':') out = out.slice(1);
	if (out.endsWith(':') && out[out.length - 2] !== ':') out = out.slice(0, -1);
	if (mapped) {
		const v4 = [h[6] >> 8, h[6] & 255, h[7] >> 8, h[7] & 255].join('.');
		out = out.endsWith('::') ? out + v4 : out + ':' + v4;
	}
	return out;
}

/** The WHATWG URL parser's canonical IPv6 host, without the brackets. */
const urlCanonical = (address: string) => new URL(`http://[${address}]/`).hostname.slice(1, -1);

test.describe('RFC 5952 compression', () => {
	test('the examples in RFC 5952 section 4', () => {
		// 4.1: leading zeros suppressed; a zero group is a single 0.
		expect(canonical('2001:0db8::0001')).toBe('2001:db8::1');
		expect(canonical('2001:db8:0000:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1');
		// 4.2.1: shorten as much as possible.
		expect(canonical('2001:db8:0:0:0:0:2:1')).toBe('2001:db8::2:1');
		expect(canonical('2001:db8::0:1')).toBe('2001:db8::1');
		// 4.2.2: one 16-bit 0 field is not shortened.
		expect(canonical('2001:db8:0:1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1');
		expect(canonical('2001:db8::1:1:1:1:1')).toBe('2001:db8:0:1:1:1:1:1');
		// 4.2.3: the longest run, and the first one on a tie.
		expect(canonical('2001:0:0:1:0:0:0:1')).toBe('2001:0:0:1::1');
		expect(canonical('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1');
		// 4.3: lower case.
		expect(canonical('2001:DB8::ABCD')).toBe('2001:db8::abcd');
		// Section 2's list of ways to write one address all come out the same.
		for (const form of [
			'2001:db8:0:0:1:0:0:1',
			'2001:0db8:0:0:1:0:0:1',
			'2001:db8::1:0:0:1',
			'2001:db8::0:1:0:0:1',
			'2001:0db8::1:0:0:1',
			'2001:db8:0:0:1::1',
			'2001:db8:0000:0:1::1',
			'2001:DB8:0:0:1::1'
		]) {
			expect(canonical(form)).toBe('2001:db8::1:0:0:1');
		}
		// Section 5: IPv4-mapped addresses keep the dotted tail.
		expect(canonical('0:0:0:0:0:ffff:c000:0201')).toBe('::ffff:192.0.2.1');
		expect(canonical('::ffff:192.0.2.1')).toBe('::ffff:192.0.2.1');
	});

	test('edge cases of the zero-run rule', () => {
		expect(canonical('0:0:0:0:0:0:0:0')).toBe('::');
		expect(canonical('0:0:0:0:0:0:0:1')).toBe('::1');
		expect(canonical('1:0:0:0:0:0:0:0')).toBe('1::');
		expect(canonical('0:0:1:0:0:1:1:1')).toBe('::1:0:0:1:1:1'); // tie: the leading run wins though the other saves more
		expect(canonical('1:1:1:0:0:1:0:0')).toBe('1:1:1::1:0:0');
		expect(canonical('1:0:0:1:0:0:0:0')).toBe('1:0:0:1::'); // longer trailing run beats an earlier one
		expect(canonical('1:0:1:0:1:0:1:0')).toBe('1:0:1:0:1:0:1:0');
		expect(canonical('0:1:1:1:1:1:1:0')).toBe('0:1:1:1:1:1:1:0');
		expect(canonical('0:0:0:0:0:ffff:0:0')).toBe('::ffff:0.0.0.0');
		expect(canonical('::ffff:0:0:0')).toBe('::ffff:0:0:0'); // not mapped: ffff is in the wrong group
		// RFC 5952 recommends dots for other embedded-IPv4 formats too; this tool, like
		// inet_ntop and the URL parser, gives them only to IPv4-mapped addresses.
		expect(canonical('64:ff9b::192.0.2.33')).toBe('64:ff9b::c000:221');
		expect(canonical('::192.0.2.1')).toBe('::c000:201');
		const c = compress(parseIPv6('2001:db8:0:0:1:0:0:1').hextets);
		expect(c.chosen).toEqual({ start: 2, length: 2 });
		expect(c.tiedWith).toEqual({ start: 5, length: 2 });
		expect(compress(parseIPv6('0:0:1:0:0:1:0:0').hextets).ties).toEqual([
			{ start: 3, length: 2 },
			{ start: 6, length: 2 }
		]);
	});

	test('agrees with a naive string compressor and with the URL parser', () => {
		for (let i = 0; i < 5000; i++) {
			const h = randomHextets();
			const ours = compressText(h);
			expect(ours, h.join(',')).toBe(naiveCompress(h));
			if (!ours.includes('.')) expect(urlCanonical(expand(h))).toBe(ours);
			else expect(urlCanonical(ours)).toBe(urlCanonical(expand(h)));
		}
	});

	test('round trips: expand and compress both parse back to the same 128 bits', () => {
		for (let i = 0; i < 3000; i++) {
			const h = randomHextets();
			const value = toBigInt(h);
			expect(fromBigInt(value)).toEqual(h);
			const full = expand(h);
			expect(full).toMatch(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/);
			const short = compressText(h);
			expect(parseIPv6(full).value).toBe(value);
			expect(parseIPv6(short).value).toBe(value);
			expect(compressText(parseIPv6(short).hextets)).toBe(short); // canonical is a fixed point
			expect(isIPv6(short) && isIPv6(full)).toBe(true);
			expect(allBits(h)).toBe(value.toString(2).padStart(128, '0'));
		}
	});
});

test.describe('parsing IPv6', () => {
	test('zones, prefixes, brackets and IPv4 tails', () => {
		const p = parseIPv6('  FE80::1%eth0/64 ');
		expect(p.hextets).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
		expect(p.zone).toBe('eth0');
		expect(p.prefix).toBe(64);
		expect(p.gap).toEqual({ at: 1, length: 6 });
		const b = parseIPv6('[2001:db8::1]:443');
		expect(b.port).toBe(443);
		expect(compressText(b.hextets)).toBe('2001:db8::1');
		const m = parseIPv6('::ffff:192.0.2.128');
		expect(m.ipv4Tail).toBe('192.0.2.128');
		expect(m.source).toEqual(['gap', 'gap', 'gap', 'gap', 'gap', 'typed', 'ipv4', 'ipv4']);
		expect(m.hextets.slice(6)).toEqual([0xc000, 0x0280]);
		expect(parseIPv6('1:2:3:4:5:6:1.2.3.4').hextets).toEqual([1, 2, 3, 4, 5, 6, 0x0102, 0x0304]);
		expect(parseIPv6('::/0').prefix).toBe(0);
		expect(parseIPv6('::1/128').prefix).toBe(128);
		// RFC 6874: in a URL the % before the zone is itself escaped as %25.
		const url = parseIPv6('[fe80::1%25eth0]:80');
		expect(url.zone).toBe('eth0');
		expect(url.port).toBe(80);
		expect(parseIPv6('fe80::1%25').zone).toBe('25'); // outside brackets, %25 is interface 25
		expect(parseIPv6('[fe80::1%2525]').zone).toBe('25'); // inside them, interface 25 is %2525
		expect(parseIPv6('[fe80::1%eth0]').zone).toBe('eth0'); // unescaped, as people paste it
		expect(() => parseIPv6('[fe80::1%25]')).toThrow(/Nothing follows the %/);
	});

	test('accepts exactly what Node accepts, for addresses without extras', () => {
		const samples = (
			':: ::1 1:: 1:2:3:4:5:6:7:8 1:2:3:4:5:6:7:: ::2:3:4:5:6:7:8 1::8 ::ffff:1.2.3.4 1:2:3:4:5:6:1.2.3.4 ' +
			'1:2:3:4:5:6:7:1.2.3.4 1::2::3 :1::2 1::2: 1:::2 12345:: g::1 1:2:3:4:5:6:7:8:9 1:2:3:4:5:6:7 ' +
			'1:2:3:4:5:6:7:8:: ::1.2.3.4:1 ::1.2.3.256 ::1.2.3 1.2.3.4::'
		).split(' ');
		for (const s of samples) {
			let ok = true;
			try {
				parseIPv6(s);
			} catch {
				ok = false;
			}
			expect(ok, s).toBe(isIPv6(s));
		}
	});

	test('errors say what is wrong', () => {
		const err = (s: string) => {
			try {
				parseIPv6(s);
			} catch (e) {
				expect(e).toBeInstanceOf(IPv6Error);
				return (e as Error).message;
			}
			throw new Error(`${s} parsed`);
		};
		expect(err('')).toMatch(/Type an IPv6 address/);
		expect(err('2001:db8::1::2')).toMatch(/:: appears twice/);
		expect(err('2001:db8:::1')).toMatch(/Three colons/);
		expect(err('2001:0db80::1')).toMatch(/Group 2, "0db80", has 5 hex digits/);
		expect(err('1:2:3:4:5:6:7:8:9')).toMatch(/^9 groups: an IPv6 address has exactly 8/);
		expect(err('1:2:3:4:5:6:7')).toMatch(/Only 7 groups, and no :: to stand for the missing 1/);
		expect(err('1:2:3:4::5:6:7:8')).toMatch(/All 8 groups are already written/);
		// Groups after a :: are numbered by their place in the address, counted from the end.
		expect(err('2001:db8::g1')).toMatch(/"g" is not a hex digit .* group 8, "g1"/);
		expect(err('::-1')).toMatch(/"-" is not a hex digit .* group 8, "-1"/);
		expect(err('1::2:3:4:5:6:12345')).toMatch(/Group 8, "12345", has 5 hex digits/);
		expect(err('g::1')).toMatch(/group 1, "g"/);
		expect(err('1::x:1.2.3.4')).toMatch(/group 6, "x"/);
		expect(err('fe80::1/64%eth0')).toMatch(/zone goes before the prefix length: write fe80::1%eth0\/64/);
		expect(err('fe80::1%eth0/64%x')).toMatch(/more than one %/);
		expect(err('fe80::1%a%b')).toMatch(/more than one %/);
		// With too many groups, places in the address mean nothing: count as written.
		expect(err('1:2::3:4:5:6:7:8:9z')).toMatch(/"z" is not a hex digit .* in the 9th group written, "9z"/);
		expect(err('1:2:3:4:5:6:7:8:12345')).toMatch(/^The 9th group written, "12345", has 5 hex digits/);
		expect(err('1:2:3:4:5:6:7:8:9:10:11:2g')).toMatch(/the 12th group written/);
		expect(err('1:2:3:4:5:6:7:8:9:10:11:12:13:14:15:16:17:18:19:20:2g')).toMatch(/the 21st group written/);
		expect(err('::1.2.3.4:5')).toMatch(/can only be the very end/);
		expect(err('1.2.3.4::')).toMatch(/can only be the very end/);
		expect(err('::1.2.3.999')).toMatch(/not a valid IPv4 tail/);
		expect(err('1:2:3:4:5:6:7:1.2.3.4')).toMatch(/9 groups \(counting the IPv4 tail as two\)/);
		expect(err(':1::')).toMatch(/starts with a single colon/);
		expect(err('1::2:')).toMatch(/ends with a single colon/);
		expect(err('::1/129')).toMatch(/prefix length/);
		expect(err('fe80::1%')).toMatch(/zone ID/);
		expect(err('192.0.2.1')).toMatch(/::ffff:192.0.2.1/);
		expect(err('[::1]:99999')).toMatch(/port/);
		expect(err('2001db8')).toMatch(/needs colons/);
	});
});

test.describe('explaining, prefixes and types', () => {
	test('the steps name each rule that applied', () => {
		const steps = explain(parseIPv6('2001:0DB8:0000:0000:0008:0800:200C:417A'));
		const by = Object.fromEntries(steps.map((s) => [s.rule.split(' (')[0], s]));
		expect(by['Lower case'].changed).toBe(true);
		expect(by['Drop leading zeros'].detail).toContain('0DB8 → db8');
		expect(by['Drop leading zeros'].detail).toContain('0000 → 0');
		expect(by['Replace the longest run of zeros with ::'].detail).toBe(
			'The run of zeros, groups 3 to 4, becomes ::, covering the whole run (section 4.2.1).'
		);
		const tie = explain(parseIPv6('2001:db8:0:0:1:0:0:1'));
		expect(tie.map((s) => s.detail).join(' ')).toContain('equally long');
		const single = explain(parseIPv6('2001:db8:0:1:1:1:1:1'));
		expect(single.map((s) => s.detail).join(' ')).toContain('One zero group stays as 0');
		const mapped = explain(parseIPv6('::ffff:c000:201'));
		expect(mapped[mapped.length - 1].detail).toContain('192.0.2.1');
		// The mapped tail is written in dots, so its hex groups are not "trimmed".
		const hexMapped = explain(parseIPv6('0:0:0:0:0:FFFF:0102:0304'));
		expect(hexMapped.find((s) => s.rule.startsWith('Drop'))?.changed).toBe(false);
		const three = explain(parseIPv6('0:0:1:0:0:1:0:0'))
			.map((s) => s.detail)
			.join(' ');
		expect(three).toContain('groups 1 to 2, groups 4 to 5 and groups 7 to 8 are equally long');
		const short = explain(parseIPv6('2001:db8::0:1'))
			.map((s) => s.detail)
			.join(' ');
		expect(short).toContain('groups 3 to 7');
		expect(short).toContain('The :: as typed covered only groups 3 to 6');
	});

	test('the one-line summaries name every rule that changed something', () => {
		const sum = (s: string) => summarise(parseIPv6(s));
		expect(sum('2001:0db8:0000:0000:0000:0000:0002:0001')).toBe('Leading zeros dropped and groups 3 to 6 become ::');
		expect(sum('2001:db8::0:1')).toBe(
			'The :: did not cover the whole run of zeros, so it grows to groups 3 to 7 (section 4.2.1)'
		);
		expect(sum('2001:db8::1:1:1:1:1')).toBe('A single zero group is written 0, not :: (section 4.2.2)');
		expect(sum('2001:db8:0:0:1:0:0:1')).toContain('2 runs of 2 zero groups tie');
		expect(sum('FE80:0:0:0:0:0:0:1')).toBe('Letters in lower case and groups 2 to 7 become ::');
		expect(sum('0:0:0:0:0:ffff:c000:0201')).toBe(
			'Groups 1 to 5 become :: and the last 32 bits are written as the IPv4 address 192.0.2.1'
		);
		expect(sum('2001:db8::1')).toBe('Already canonical');
	});

	test('prefix arithmetic agrees with BigInt masks built from bit strings', () => {
		for (let i = 0; i < 1000; i++) {
			const h = randomHextets();
			const value = toBigInt(h);
			const p = Math.floor(Math.random() * 129);
			const info = prefixInfo(value, p);
			const bits = value.toString(2).padStart(128, '0');
			const net = BigInt('0b' + bits.slice(0, p) + '0'.repeat(128 - p));
			const last = BigInt('0b' + bits.slice(0, p) + '1'.repeat(128 - p));
			expect(toBigInt(info.network)).toBe(net);
			expect(toBigInt(info.last)).toBe(last);
			expect(info.count).toBe(last - net + 1n);
			expect(toBigInt(info.mask)).toBe(BigInt('0b' + '1'.repeat(p) + '0'.repeat(128 - p)));
			expect(info.subnets64).toBe(p <= 64 ? 2n ** BigInt(64 - p) : null);
		}
		const doc = prefixInfo(parseIPv6('2001:db8:abcd:12::1').value, 48);
		expect(compressText(doc.network)).toBe('2001:db8:abcd::');
		expect(compressText(doc.last)).toBe('2001:db8:abcd:ffff:ffff:ffff:ffff:ffff');
		expect(doc.subnets64).toBe(65536n);
		expect(doc.hostPartSet).toBe(true);
	});

	test('address types, most specific range first', () => {
		const t = (s: string) => addressType(parseIPv6(s).value).id;
		expect(t('::')).toBe('unspecified');
		expect(t('::1')).toBe('loopback');
		expect(t('::2')).toBe('other');
		expect(t('::ffff:10.0.0.1')).toBe('mapped');
		expect(t('64:ff9b::8.8.8.8')).toBe('nat64');
		expect(t('2001:0:4136:e378:8000:63bf:3fff:fdd2')).toBe('teredo');
		expect(t('2001:db8::1')).toBe('documentation');
		expect(t('2001:db9::1')).toBe('global');
		expect(t('2002:c000:204::1')).toBe('sixtofour');
		expect(t('fe80::1')).toBe('linklocal');
		expect(t('febf:ffff::1')).toBe('linklocal');
		expect(t('fec0::1')).toBe('sitelocal');
		expect(t('fc00::1')).toBe('ula');
		expect(t('fdff::1')).toBe('ula');
		expect(t('ff02::1')).toBe('multicast');
		expect(t('3fff:ffff::1')).toBe('global');
		expect(t('4000::1')).toBe('other');
		expect(t('fe00::1')).toBe('other');
		// Every example in the reference table is its own type.
		for (const def of ADDRESS_TYPES) expect(addressType(parseIPv6(def.example).value).id, def.example).toBe(def.id);
	});

	test('embedded IPv4 addresses and multicast details', () => {
		const teredo = describeAddress(parseIPv6('2001:0000:4136:e378:8000:63bf:3fff:fdd2').hextets);
		expect(teredo.embeddedIPv4).toBe('192.0.2.45');
		expect(teredo.notes.join(' ')).toContain('Teredo server: 65.54.227.120');
		expect(teredo.notes.join(' ')).toContain('port 40000');
		expect(describeAddress(parseIPv6('2002:c000:204::1').hextets).embeddedIPv4).toBe('192.0.2.4');
		expect(describeAddress(parseIPv6('64:ff9b::c000:221').hextets).embeddedIPv4).toBe('192.0.2.33');
		const all = describeAddress(parseIPv6('ff02::1').hextets).notes.join(' ');
		expect(all).toContain('link-local');
		expect(all).toContain('all nodes');
		const sn = describeAddress(parseIPv6('ff02::1:ff3c:4d5e').hextets).notes.join(' ');
		expect(sn).toContain('solicited-node');
		expect(sn).toContain('3c4d5e');
		expect(describeAddress(parseIPv6('ff15::1').hextets).notes.join(' ')).toContain('site-local');
		const ssm = describeAddress(parseIPv6('ff3e::1234').hextets).notes.join(' ');
		expect(ssm).toContain('transient');
		expect(ssm).toContain('P bit');
		expect(ssm).not.toContain('R bit');
		expect(describeAddress(parseIPv6('ff7e::1').hextets).notes.join(' ')).toContain('R bit');
	});

	test('every range is written in the canonical form the tool produces', () => {
		for (const def of ADDRESS_TYPES) {
			const p = parseIPv6(def.range);
			expect(`${compressText(p.hextets)}/${p.prefix}`).toBe(def.range);
		}
		expect(MAPPED_RANGE).toBe('::ffff:0.0.0.0/96');
	});
});

test.describe('EUI-64', () => {
	test('MAC notations all read the same', () => {
		const bytes = [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e];
		for (const s of [
			'00:1a:2b:3c:4d:5e',
			'00-1A-2B-3C-4D-5E',
			'00 1a 2b 3c 4d 5e',
			'001a.2b3c.4d5e',
			'001A2B3C4D5E',
			'0:1a:2b:3c:4d:5e'
		]) {
			expect(parseMac(s), s).toEqual(bytes);
		}
		expect(() => parseMac('00:1a:2b:3c:4d')).toThrow(/12 hex digits/);
		expect(() => parseMac('00:1a:2b:3c:4d:5g')).toThrow(/"g" is not a hex digit/);
		expect(() => parseMac('')).toThrow(/Type a MAC/);
		// Malformed separators are rejected, not read by squeezing out the punctuation.
		expect(() => parseMac('a:b:c:d:e:f:0:1:2:3:4:5')).toThrow(/that has 12 bytes/);
		expect(() => parseMac('0.0.1a.2b.3c.4d5e')).toThrow(/three groups of four/);
		expect(() => parseMac('::::::001a2b3c4d5e')).toThrow(/Two separators in a row/);
		expect(() => parseMac('00:1a:2b:3c:4d:5e:')).toThrow(/Two separators in a row/);
		expect(() => parseMac('0:0:1a2b3c4d5e')).toThrow(/"1a2b3c4d5e" has 10 hex digits/);
		expect(() => parseMac('001a2b3c4d')).toThrow(/that has 10 digits/);
		expect(() => parseMac('00 1a 2b 3c 4d')).toThrow(/that has 5 bytes/);
		expect(() => parseMac('00  1a 2b 3c 4d 5e')).toThrow(/Two separators in a row/);
		expect(() => parseMac('00 1a 2b 3c 4d 5x')).toThrow(/"x" is not a hex digit/);
	});

	test('inserts fffe and flips the universal/local bit, checked with BigInt', () => {
		const e = eui64(parseMac('00:1a:2b:3c:4d:5e'));
		expect(compressText(e.linkLocal)).toBe('fe80::21a:2bff:fe3c:4d5e');
		expect(e.firstBefore).toBe(0x00);
		expect(e.firstAfter).toBe(0x02);
		expect(e.locallyAdministered).toBe(false);
		// The documentation MAC of RFC 7042, and a locally administered MAC whose bit flips the other way.
		expect(compressText(eui64(parseMac('00:00:5e:00:53:01')).linkLocal)).toBe('fe80::200:5eff:fe00:5301');
		const local = eui64(parseMac('02:00:00:00:00:01'));
		expect(local.locallyAdministered).toBe(true);
		expect(compressText(local.linkLocal)).toBe('fe80::ff:fe00:1');
		for (let i = 0; i < 500; i++) {
			const mac = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
			const m = mac.reduce((a, b) => (a << 8n) | BigInt(b), 0n);
			// Reference: arithmetic on the 48-bit number rather than on bytes.
			const iid = (((m >> 24n) << 40n) | (0xfffen << 24n) | (m & 0xffffffn)) ^ (1n << 57n);
			const e = eui64(mac);
			expect(toBigInt([0, 0, 0, 0, ...e.iid])).toBe(iid);
			expect(toBigInt(e.linkLocal)).toBe((0xfe80n << 112n) | iid);
		}
	});
});

test.describe('the ipv6-expand-compress page', () => {
	test('the prerendered page already shows the worked default', async ({ page }) => {
		// Wrap points (<wbr>) sit between the groups, so read the text without them.
		const html = (await (await page.request.get('/ipv6-expand-compress')).text()).replace(/<wbr\s*\/?>/g, '');
		expect(html).toContain('2001:db8::8:800:200c:417a');
		expect(html).toContain('2001:0db8:0000:0000:0008:0800:200c:417a');
		expect(html).toContain('fe80::21a:2bff:fe3c:4d5e');
		expect(html).toContain('Documentation');
	});

	test('typing an address updates both forms, the steps and the type', async ({ page }) => {
		await page.goto('/ipv6-expand-compress');
		await page.waitForLoadState('networkidle');
		await page.locator('#address').fill('2001:DB8:0:0:1:0:0:1');
		await expect(page.locator('#compressed')).toHaveText('2001:db8::1:0:0:1');
		await expect(page.locator('#expanded')).toHaveText('2001:0db8:0000:0000:0001:0000:0000:0001');
		await expect(page.locator('.rules')).toContainText('equally long');
		await expect(page.locator('.group.in-run')).toHaveCount(2);
		await page.locator('#address').fill('::ffff:192.0.2.1');
		await expect(page.locator('#compressed')).toHaveText('::ffff:192.0.2.1');
		await expect(page.locator('.working-title').last()).toContainText('IPv4-mapped');
		await page.locator('#address').fill('2001:db8::1::1');
		await expect(page.locator('.error')).toContainText(':: appears twice');
		// The stale results stay on screen, dimmed, but their buttons cannot be used.
		const copies = page.locator('.answer button.copy');
		await expect(copies).toHaveCount(2);
		for (const i of [0, 1]) await expect(copies.nth(i)).toBeDisabled();
		await page.locator('#address').fill('fe80::1%eth0/64');
		await expect(page.locator('.error')).toHaveCount(0);
		await expect(page.locator('#compressed')).toHaveText('fe80::1%eth0/64');
		await expect(page.locator('.facts')).toContainText('18,446,744,073,709,551,616');
		await expect(page.locator('.bit.net')).toHaveCount(64);
	});

	test('the MAC converter shows the EUI-64 link-local address', async ({ page }) => {
		await page.goto('/ipv6-expand-compress');
		await page.waitForLoadState('networkidle');
		await page.locator('#mac').fill('00-00-5E-00-53-01');
		await expect(page.locator('#link-local')).toHaveText('fe80::200:5eff:fe00:5301');
		await page.getByRole('button', { name: 'Explain this address' }).click();
		await expect(page.locator('#address')).toHaveValue('fe80::200:5eff:fe00:5301');
		await page.locator('#mac').fill('00:1a:2b');
		await expect(page.locator('#eui64 .error')).toContainText('12 hex digits');
		const actions = page.locator('#eui64 .eui-actions button');
		await expect(actions).toHaveCount(2);
		for (const i of [0, 1]) await expect(actions.nth(i)).toBeDisabled();
	});

	test('the URL round trips', async ({ page }) => {
		await page.goto('/ipv6-expand-compress');
		await page.waitForLoadState('networkidle');
		await page.locator('#address').fill('ff02::1');
		await page.locator('#mac').fill('02:00:00:00:00:01');
		await expect(page).toHaveURL(/a=ff02%3A%3A1/);
		const url = page.url();
		await page.goto(url);
		await expect(page.locator('#address')).toHaveValue('ff02::1');
		await expect(page.locator('#mac')).toHaveValue('02:00:00:00:00:01');
		await expect(page.locator('#link-local')).toHaveText('fe80::ff:fe00:1');
		await expect(page.locator('.type-notes')).toContainText('all nodes');
	});

	test('errors are announced once typing pauses, and the stale result leaves the tab order', async ({ page }) => {
		await page.goto('/ipv6-expand-compress');
		await page.waitForLoadState('networkidle');
		const address = page.locator('#address');
		await address.fill('2001:db8::1::1');
		// The visible error updates at once; the alert waits half a second for typing to pause.
		await expect(page.locator('#address-error')).toContainText(':: appears twice');
		expect(await page.locator('[role="alert"]').count()).toBe(0);
		await expect(address).toHaveAttribute('aria-describedby', 'address-help address-error');
		await expect(page.locator('#address-error')).not.toHaveAttribute('role', 'alert');
		await expect(page.locator('[role="alert"]')).toHaveCount(1);
		await expect(page.locator('[role="alert"]')).toContainText(':: appears twice');
		await expect(page.locator('.tool').first().locator('.results[inert]')).toHaveCount(1);
		await address.fill('fe80::1');
		await expect(page.locator('[role="alert"]')).toHaveCount(0);
		await expect(address).toHaveAttribute('aria-describedby', 'address-help');
		await expect(page.locator('.results[inert]')).toHaveCount(0);
		await page.locator('#mac').fill('00:11:22');
		await expect(page.locator('#mac')).toHaveAttribute('aria-describedby', 'mac-help mac-error');
		await expect(page.locator('[role="alert"]')).toContainText('12 hex digits');
		await expect(page.locator('#eui64 .results[inert]')).toHaveCount(1);
	});

	test('a rejected query value is dropped from the address bar', async ({ page }) => {
		await page.goto(`/ipv6-expand-compress?a=${'1'.repeat(5000)}&mac=02:00:00:00:00:01`);
		await expect(page.locator('#mac')).toHaveValue('02:00:00:00:00:01');
		await expect(page).toHaveURL(/\/ipv6-expand-compress\?mac=02%3A00%3A00%3A00%3A00%3A01$/);
		await expect(page.locator('#address')).toHaveValue('2001:0DB8:0000:0000:0008:0800:200C:417A/64');
	});

	test('the page reflows at 320px without sideways scrolling', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto('/ipv6-expand-compress');
		await page.waitForLoadState('networkidle');
		await page.locator('.faq details').evaluateAll((ds) => ds.forEach((d) => d.setAttribute('open', '')));
		const width = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(width).toBeLessThanOrEqual(320);
	});
});
