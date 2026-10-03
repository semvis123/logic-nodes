// IPv4 subnetting, checked against a second implementation that works on
// BigInt strings of bits instead of 32 bit operators, against brute-force
// enumeration of every address in small subnets, and against textbook answers.
// Then the two pages, as a reader would use them.

import { expect, test, type Page } from '@playwright/test';
import {
	parseAddress,
	parseMask,
	parseCidr,
	formatAddress,
	maskFromPrefix,
	wildcardFromPrefix,
	prefixFromMask,
	subnetInfo,
	inSubnet,
	addressClass,
	specialRange,
	prefixTable,
	rangeToCidrs,
	parseRequirements,
	parseHostCount,
	formatRequirements,
	checkRequirements,
	prefixForHosts,
	allocateVlsm,
	splitEqual,
	bitsForCount,
	spanInOrder,
	hostRangeTable,
	toBits,
	magicNumber,
	dottedBits,
	IpError,
	SPECIAL_RANGES,
	ADDRESS_SPACE,
	type Requirement
} from '../src/lib/ipv4.js';

/** A deterministic random generator, so a failure can be reproduced. */
function rng(seed: number) {
	return () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x80000000;
	};
}
const random = rng(20261002);
const randomAddress = () => Math.floor(random() * 65536) * 65536 + Math.floor(random() * 65536);

// --- the reference: BigInt and strings, no 32 bit operators anywhere ---------

const ref = {
	parse(text: string): bigint {
		return text.split('.').reduce((acc, o) => acc * 256n + BigInt(o), 0n);
	},
	format(n: bigint): string {
		const out: string[] = [];
		for (let i = 0; i < 4; i++) {
			out.unshift((n % 256n).toString());
			n /= 256n;
		}
		return out.join('.');
	},
	mask(prefix: number): bigint {
		return BigInt('0b0' + '1'.repeat(prefix) + '0'.repeat(32 - prefix));
	},
	and(a: bigint, b: bigint): bigint {
		const x = a.toString(2).padStart(32, '0');
		const y = b.toString(2).padStart(32, '0');
		return BigInt('0b' + [...x].map((c, i) => (c === '1' && y[i] === '1' ? '1' : '0')).join(''));
	},
	info(address: bigint, prefix: number) {
		const size = 2n ** BigInt(32 - prefix);
		// Integer division instead of a mask: the block is the multiple of its size at or below the address.
		const network = (address / size) * size;
		const last = network + size - 1n;
		return { network, last, size };
	}
};

const errorOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (e) {
		if (e instanceof IpError) return e.message;
		throw e;
	}
	return '';
};

test.describe('ipv4 parsing', () => {
	test('addresses round trip and agree with the reference', () => {
		for (let i = 0; i < 2000; i++) {
			const n = randomAddress();
			const text = ref.format(BigInt(n));
			expect(parseAddress(text)).toBe(n);
			expect(formatAddress(n)).toBe(text);
			expect(BigInt(parseAddress(text))).toBe(ref.parse(text));
		}
		expect(parseAddress('0.0.0.0')).toBe(0);
		expect(parseAddress('255.255.255.255')).toBe(ADDRESS_SPACE - 1);
		expect(parseAddress(' 192.168.1.10 ')).toBe(0xc0a8010a);
	});

	test('errors name the octet and the problem', () => {
		expect(errorOf(() => parseAddress('192.168.256.1'))).toBe(
			'Octet 3 is 256, the maximum is 255 (the third octet is 8 bits)'
		);
		expect(errorOf(() => parseAddress('300.1.1.1'))).toMatch(/^Octet 1 is 300, the maximum is 255/);
		expect(errorOf(() => parseAddress('192.168.1'))).toBe(
			'An IPv4 address has 4 octets separated by dots; 192.168.1 has 3 octets'
		);
		expect(errorOf(() => parseAddress('1.2.3.4.5'))).toMatch(/has 5 octets/);
		expect(errorOf(() => parseAddress('192..1.1'))).toMatch(/^Octet 2 is empty/);
		// A stray dot is named as one, even when it makes five parts.
		expect(errorOf(() => parseAddress('1.2.3.4.'))).toBe(
			'1.2.3.4. ends with a dot: an IPv4 address is four numbers separated by dots'
		);
		expect(errorOf(() => parseAddress('192.168.1..10'))).toMatch(/^Octet 4 is empty: there are two dots in a row/);
		expect(errorOf(() => parseAddress('.1.2.3'))).toMatch(/^Octet 1 is empty/);
		expect(errorOf(() => parseAddress('192.168.01.1'))).toMatch(/^Octet 3 is written 01: leading zeros.*write 1$/);
		expect(errorOf(() => parseAddress('10.0.0.x'))).toMatch(/^"x" cannot appear/);
		expect(errorOf(() => parseAddress('-1.0.0.0'))).toMatch(/^"-" cannot appear/);
		expect(errorOf(() => parseAddress('fe80::1'))).toMatch(/looks like an IPv6 address/);
		expect(errorOf(() => parseAddress(''))).toMatch(/^Type an IPv4 address/);
		expect(errorOf(() => parseAddress('1.1.1.99999999999999999999'))).toMatch(/^Octet 4 is 999999999999…, the maximum/);
		expect(errorOf(() => parseAddress('255.255.256.0', 'mask'))).toMatch(/^Mask octet 3 is 256/);
	});

	test('masks: every prefix in every notation, and the bad ones explained', () => {
		for (let p = 0; p <= 32; p++) {
			const mask = maskFromPrefix(p);
			expect(BigInt(mask)).toBe(ref.mask(p));
			expect(BigInt(wildcardFromPrefix(p))).toBe(2n ** 32n - 1n - ref.mask(p));
			expect(prefixFromMask(mask)).toBe(p);
			expect(parseMask(String(p))).toBe(p);
			expect(parseMask(`/${p}`)).toBe(p);
			expect(parseMask(formatAddress(mask))).toBe(p);
		}
		expect(errorOf(() => parseMask('33'))).toBe('A prefix length runs from /0 to /32, so /33 is too long');
		expect(errorOf(() => parseMask('255.0.255.0'))).toBe(
			'255.0.255.0 is not a valid netmask: a mask is ones followed by zeros, but bit 17 is a 1 after bit 9 was a 0'
		);
		expect(errorOf(() => parseMask('0.0.0.255'))).toBe(
			'0.0.0.255 looks like a wildcard mask (zeros then ones); the netmask with the same meaning is 255.255.255.0, which is /24'
		);
		// Every valid mask with any one bit flipped is refused, unless the flip
		// lands on the edge of the run of ones and makes another valid mask.
		for (let p = 0; p <= 32; p++) {
			for (let bit = 0; bit < 32; bit++) {
				const bits = [...toBits(maskFromPrefix(p))];
				bits[bit] = bits[bit] === '1' ? '0' : '1';
				const m = parseInt(bits.join(''), 2);
				const valid = /^1*0*$/.test(bits.join(''));
				if (valid) expect(prefixFromMask(m)).toBe(bits.indexOf('0') === -1 ? 32 : bits.indexOf('0'));
				else expect(() => prefixFromMask(m), `/${p} with bit ${bit} flipped`).toThrow(IpError);
			}
		}
		// And random 32 bit values, almost none of which are masks.
		for (let i = 0; i < 2000; i++) {
			const m = randomAddress();
			const bits = toBits(m);
			const valid = /^1*0*$/.test(bits);
			if (valid) expect(prefixFromMask(m)).toBe(bits.indexOf('0') === -1 ? 32 : bits.indexOf('0'));
			else expect(() => prefixFromMask(m)).toThrow(IpError);
		}
	});

	test('the input forms people type', () => {
		const expected = { address: 0xc0a8010a, prefix: 24, addressText: '192.168.1.10' };
		for (const text of [
			'192.168.1.10/24',
			'192.168.1.10 /24',
			'192.168.1.10 / 24',
			'192.168.1.10 24',
			'192.168.1.10 255.255.255.0',
			'192.168.1.10/255.255.255.0',
			'  192.168.1.10   255.255.255.0 '
		]) {
			expect(parseCidr(text), text).toEqual(expected);
		}
		expect(errorOf(() => parseCidr('192.168.1.10'))).toBe(
			'Add a prefix or mask after the address, such as 192.168.1.10/24 or 192.168.1.10 255.255.255.0. Its old class C default would have been /24'
		);
		expect(errorOf(() => parseCidr('192.168.1.10/'))).toMatch(/after the slash/);
		expect(errorOf(() => parseCidr('192.168.1.300/24'))).toMatch(/^Octet 4 is 300/);
		expect(errorOf(() => parseCidr('192.168.1.1/40'))).toMatch(/too long/);
		expect(errorOf(() => parseCidr('1.2.3.4//24'))).toMatch(/^There are two slashes/);
		expect(errorOf(() => parseCidr('1.2.3.4./24'))).toMatch(/ends with a dot/);
		expect(dottedBits(0xc0a8010a)).toBe('11000000.10101000.00000001.00001010');
	});
});

test.describe('ipv4 subnets', () => {
	test('network, broadcast and hosts agree with the reference for random subnets', () => {
		for (let i = 0; i < 3000; i++) {
			const address = randomAddress();
			const prefix = Math.floor(random() * 33);
			const info = subnetInfo(address, prefix);
			const r = ref.info(BigInt(address), prefix);
			expect(BigInt(info.network)).toBe(r.network);
			expect(BigInt(info.network)).toBe(ref.and(BigInt(address), ref.mask(prefix)));
			expect(BigInt(info.last)).toBe(r.last);
			expect(BigInt(info.total)).toBe(r.size);
			if (prefix <= 30) {
				expect(BigInt(info.broadcast ?? -1)).toBe(r.last);
				expect(BigInt(info.firstHost)).toBe(r.network + 1n);
				expect(BigInt(info.lastHost)).toBe(r.last - 1n);
				expect(BigInt(info.usable)).toBe(r.size - 2n);
			} else {
				expect(info.broadcast).toBeNull();
				expect(BigInt(info.firstHost)).toBe(r.network);
				expect(BigInt(info.lastHost)).toBe(r.last);
				expect(BigInt(info.usable)).toBe(r.size);
			}
		}
	});

	test('membership by AND matches enumerating every address of small subnets', () => {
		for (let i = 0; i < 40; i++) {
			const prefix = 22 + Math.floor(random() * 11);
			const info = subnetInfo(randomAddress(), prefix);
			const members = new Set<number>();
			for (let a = info.network; a <= info.last; a++) members.add(a);
			expect(members.size).toBe(info.total);
			// Every member, and a margin either side of the block, tested with the AND.
			for (let a = Math.max(0, info.network - 600); a <= Math.min(ADDRESS_SPACE - 1, info.last + 600); a++) {
				if (inSubnet(a, info.network, prefix) !== members.has(a)) throw new Error(`${formatAddress(a)} /${prefix}`);
			}
		}
	});

	test('textbook answers', () => {
		const a = subnetInfo(parseAddress('192.168.1.10'), 24);
		expect(formatAddress(a.network)).toBe('192.168.1.0');
		expect(formatAddress(a.broadcast ?? -1)).toBe('192.168.1.255');
		expect(formatAddress(a.firstHost)).toBe('192.168.1.1');
		expect(formatAddress(a.lastHost)).toBe('192.168.1.254');
		expect(a.usable).toBe(254);
		expect(formatAddress(a.wildcard)).toBe('0.0.0.255');

		const b = subnetInfo(parseAddress('172.16.45.14'), 20);
		expect(formatAddress(b.network)).toBe('172.16.32.0');
		expect(formatAddress(b.broadcast ?? -1)).toBe('172.16.47.255');
		expect(b.usable).toBe(4094);

		const c = subnetInfo(parseAddress('10.1.2.3'), 8);
		expect(formatAddress(c.broadcast ?? -1)).toBe('10.255.255.255');
		expect(c.usable).toBe(16777214);

		const d = subnetInfo(parseAddress('192.168.10.77'), 27);
		expect(formatAddress(d.network)).toBe('192.168.10.64');
		expect(formatAddress(d.broadcast ?? -1)).toBe('192.168.10.95');
		expect(d.usable).toBe(30);

		const p2p = subnetInfo(parseAddress('10.0.0.1'), 31);
		expect(p2p.kind).toBe('point-to-point');
		expect([formatAddress(p2p.firstHost), formatAddress(p2p.lastHost)]).toEqual(['10.0.0.0', '10.0.0.1']);
		expect(p2p.usable).toBe(2);
		expect(p2p.broadcast).toBeNull();

		const host = subnetInfo(parseAddress('8.8.8.8'), 32);
		expect(host.kind).toBe('host');
		expect(host.usable).toBe(1);
		expect(host.firstHost).toBe(host.address);

		const all = subnetInfo(parseAddress('1.2.3.4'), 0);
		expect(all.network).toBe(0);
		expect(all.last).toBe(ADDRESS_SPACE - 1);
		expect(all.usable).toBe(ADDRESS_SPACE - 2);

		expect(subnetInfo(parseAddress('192.168.1.0'), 24).isNetwork).toBe(true);
		expect(subnetInfo(parseAddress('192.168.1.255'), 24).isBroadcast).toBe(true);
	});

	test('the block size shortcut agrees with the AND', () => {
		const m = magicNumber(parseAddress('172.16.45.14'), 20);
		expect(m).toEqual({ octet: 3, maskOctet: 240, block: 16, value: 45, networkOctet: 32, lastOctet: 47 });
		expect(magicNumber(parseAddress('192.168.1.10'), 24)).toMatchObject({ octet: 4, maskOctet: 0, block: 256 });
		for (let i = 0; i < 2000; i++) {
			const address = randomAddress();
			const prefix = 1 + Math.floor(random() * 32);
			const info = subnetInfo(address, prefix);
			const k = magicNumber(address, prefix);
			const shift = 32 - 8 * k.octet;
			expect(Math.floor(info.network / 2 ** shift) % 256).toBe(k.networkOctet);
			expect(Math.floor(info.last / 2 ** shift) % 256).toBe(k.lastOctet);
		}
	});

	test('classes come from the leading bits', () => {
		const cases: [string, string, number | null][] = [
			['0.0.0.0', 'A', 8],
			['10.0.0.1', 'A', 8],
			['127.255.255.255', 'A', 8],
			['128.0.0.0', 'B', 16],
			['191.255.0.1', 'B', 16],
			['192.0.0.0', 'C', 24],
			['223.255.255.255', 'C', 24],
			['224.0.0.1', 'D', null],
			['239.255.255.255', 'D', null],
			['240.0.0.0', 'E', null],
			['255.255.255.255', 'E', null]
		];
		for (const [text, letter, prefix] of cases) {
			const c = addressClass(parseAddress(text));
			expect([c.letter, c.defaultPrefix], text).toEqual([letter, prefix]);
		}
		// By first octet, as the textbooks tabulate it.
		for (let o = 0; o < 256; o++) {
			const want = o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E';
			expect(addressClass(o * 2 ** 24).letter).toBe(want);
		}
	});

	test('special-use ranges, the most specific first', () => {
		const name = (t: string) => specialRange(parseAddress(t))?.name ?? null;
		expect(name('10.20.30.40')).toBe('Private');
		expect(name('172.16.0.0')).toBe('Private');
		expect(name('172.31.255.255')).toBe('Private');
		expect(name('172.32.0.0')).toBeNull();
		expect(name('172.15.255.255')).toBeNull();
		expect(name('192.168.1.1')).toBe('Private');
		expect(name('100.64.0.1')).toBe('Shared address space (CGNAT)');
		expect(name('100.127.255.255')).toBe('Shared address space (CGNAT)');
		expect(name('100.128.0.0')).toBeNull();
		expect(name('127.0.0.1')).toBe('Loopback');
		expect(name('169.254.10.1')).toBe('Link-local');
		expect(name('192.0.2.5')).toBe('Documentation (TEST-NET-1)');
		expect(name('198.51.100.5')).toBe('Documentation (TEST-NET-2)');
		expect(name('203.0.113.5')).toBe('Documentation (TEST-NET-3)');
		expect(name('198.18.0.1')).toBe('Benchmarking');
		expect(name('198.19.255.255')).toBe('Benchmarking');
		expect(name('198.20.0.0')).toBeNull();
		expect(name('0.1.2.3')).toBe('"This network"');
		expect(name('224.0.0.251')).toBe('Multicast');
		expect(name('250.1.1.1')).toBe('Reserved');
		expect(name('255.255.255.255')).toBe('Limited broadcast');
		expect(name('255.255.255.254')).toBe('Reserved');
		expect(name('8.8.8.8')).toBeNull();
		expect(name('1.1.1.1')).toBeNull();
		// Each range's network has no host bits set.
		for (const r of SPECIAL_RANGES) expect(subnetInfo(r.network, r.prefix).network, r.cidr).toBe(r.network);
	});

	test('the /0 to /32 table', () => {
		const rows = prefixTable();
		expect(rows).toHaveLength(33);
		expect(rows[24]).toMatchObject({ mask: '255.255.255.0', wildcard: '0.0.0.255', addresses: 256, usable: 254 });
		expect(rows[16]).toMatchObject({ mask: '255.255.0.0', addresses: 65536, usable: 65534 });
		expect(rows[30]).toMatchObject({ mask: '255.255.255.252', usable: 2 });
		expect(rows[31]).toMatchObject({ mask: '255.255.255.254', addresses: 2, usable: 2 });
		expect(rows[32]).toMatchObject({ mask: '255.255.255.255', addresses: 1, usable: 1 });
		expect(rows[0]).toMatchObject({ mask: '0.0.0.0', wildcard: '255.255.255.255', addresses: 4294967296 });
		for (const r of rows) expect(BigInt(r.addresses)).toBe(2n ** BigInt(32 - r.prefix));
	});

	test('a range splits into the fewest aligned blocks', () => {
		expect(rangeToCidrs(parseAddress('192.168.10.112'), parseAddress('192.168.11.0'))).toEqual([
			{ network: parseAddress('192.168.10.112'), prefix: 28 },
			{ network: parseAddress('192.168.10.128'), prefix: 25 }
		]);
		expect(rangeToCidrs(0, ADDRESS_SPACE)).toEqual([{ network: 0, prefix: 0 }]);
		// Against a BigInt greedy reference over the whole address space,
		// including starts at and above 2^31, where 32 bit operators turn signed.
		const refBlocks = (start: bigint, end: bigint) => {
			const out: { network: number; prefix: number }[] = [];
			let at = start;
			while (at < end) {
				let size = 1n;
				while (size < 2n ** 32n && at % (size * 2n) === 0n && at + size * 2n <= end) size *= 2n;
				out.push({ network: Number(at), prefix: 32 - size.toString(2).length + 1 });
				at += size;
			}
			return out;
		};
		const edges = [0, 1, 2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1, ADDRESS_SPACE];
		for (const a of edges) {
			for (const b of edges) {
				if (a <= b) expect(rangeToCidrs(a, b), `${a} to ${b}`).toEqual(refBlocks(BigInt(a), BigInt(b)));
			}
		}
		for (let i = 0; i < 1000; i++) {
			const x = randomAddress();
			const y = random() < 0.2 ? ADDRESS_SPACE : randomAddress();
			const [start, end] = x <= y ? [x, y] : [y, x];
			expect(rangeToCidrs(start, end)).toEqual(refBlocks(BigInt(start), BigInt(end)));
		}
		for (let i = 0; i < 300; i++) {
			const start = Math.floor(random() * 5000);
			const end = start + Math.floor(random() * 5000);
			const blocks = rangeToCidrs(start, end);
			let at = start;
			for (const b of blocks) {
				const size = 2 ** (32 - b.prefix);
				expect(b.network).toBe(at);
				expect(b.network % size).toBe(0);
				at += size;
			}
			expect(at).toBe(end);
		}
	});
});

test.describe('ipv4 vlsm', () => {
	test('requirements in the forms people paste', () => {
		expect(parseRequirements('Sales 50\nHR: 20\nLink A, 2\n\n 12 Guests\nLab 3 10 hosts\n7')).toEqual([
			{ name: 'Sales', hosts: 50 },
			{ name: 'HR', hosts: 20 },
			{ name: 'Link A', hosts: 2 },
			{ name: 'Guests', hosts: 12 },
			{ name: 'Lab 3', hosts: 10 },
			{ name: 'Subnet 6', hosts: 7 }
		]);
		expect(errorOf(() => parseRequirements('Sales 50\nHR'))).toMatch(/^Line 2 \("HR"\) has no host count/);
		expect(errorOf(() => parseRequirements('Sales 0'))).toBe('Sales (row 1) needs a host count of 1 or more');
		expect(errorOf(() => parseRequirements('Huge 5000000000'))).toMatch(/the most one IPv4 block can hold/);
		expect(() => checkRequirements([{ name: '', hosts: 1.5 }])).toThrow(/Row 1 needs/);
		// Pasted from a spreadsheet: thousands separators are read, other
		// number formats are refused rather than half read.
		expect(parseRequirements('Campus 12,500\nHead office 8,000\n1,500 Staff\nSales — 50\nLink-5')).toEqual([
			{ name: 'Campus', hosts: 12500 },
			{ name: 'Head office', hosts: 8000 },
			{ name: 'Staff', hosts: 1500 },
			{ name: 'Sales', hosts: 50 },
			{ name: 'Link', hosts: 5 }
		]);
		expect(errorOf(() => parseRequirements('Sales -5'))).toBe('Line 1 ("Sales -5"): a host count cannot be negative');
		// Commas only group thousands; anything else is refused, naming the digits.
		for (const [bad, digits] of [
			['Sales 1,20', '1,20'],
			['Room 101,50', '101,50'],
			['Lab 2,1,000', '2,1,000']
		]) {
			expect(errorOf(() => parseRequirements(bad))).toBe(
				`Line 1 ("${bad}"): "${digits}" is not a host count, as commas group thousands (12,500); write it in plain digits, or put a space before the count`
			);
		}
		expect(parseRequirements('Room 101 50; Link A,2; Sales \u2212 5')).toEqual([
			{ name: 'Room 101', hosts: 50 },
			{ name: 'Link A', hosts: 2 },
			{ name: 'Sales', hosts: 5 }
		]);
		for (const bad of ['Sales 2.5', 'Sales 50.0']) {
			expect(errorOf(() => parseRequirements(bad))).toBe(
				`Line 1 ("${bad}"): the host count must be a whole number, such as 50 or 12,500`
			);
		}
		for (const bad of ['Sales 1e3', 'Sales 0x20', 'Sales +50']) {
			expect(errorOf(() => parseRequirements(bad))).toBe(
				`Line 1 ("${bad}"): write the host count in plain digits, such as 50`
			);
		}
		// Rows read their counts by the same rule, and say which row is wrong.
		expect(parseHostCount(' 12,500 ', 'X')).toBe(12500);
		expect(parseHostCount('7', 'X')).toBe(7);
		const rowError = (text: string) => {
			try {
				parseHostCount(text, 'Sales (row 3)', 2);
			} catch (e) {
				return [(e as IpError).message, (e as IpError).row];
			}
			return null;
		};
		expect(rowError('1e3')).toEqual(['Sales (row 3): write the host count in plain digits, such as 50', 2]);
		expect(rowError('0x20')).toEqual(['Sales (row 3): write the host count in plain digits, such as 50', 2]);
		expect(rowError('+50')).toEqual(['Sales (row 3): write the host count in plain digits, such as 50', 2]);
		expect(rowError('50.0')).toEqual(['Sales (row 3): the host count must be a whole number, such as 50 or 12,500', 2]);
		expect(rowError('1,20')).toEqual([
			'Sales (row 3): "1,20" is not a host count, as commas group thousands (12,500); write it in plain digits',
			2
		]);
		expect(rowError('-5')).toEqual(['Sales (row 3): a host count cannot be negative', 2]);
		expect(rowError('')).toEqual(['Sales (row 3) needs a host count of 1 or more', 2]);
		// Every count a row accepts reads back the same through the text form.
		for (const hosts of ['1', '50', '12,500', '1,000,000']) {
			const n = parseHostCount(hosts, 'X');
			expect(parseRequirements(`Lab 2 ${hosts}`)).toEqual([{ name: 'Lab 2', hosts: n }]);
		}
		const list: Requirement[] = [
			{ name: 'Link 2', hosts: 2 },
			{ name: '2024', hosts: 9 },
			{ name: 'a; b', hosts: 3 }
		];
		expect(parseRequirements(formatRequirements(list))).toEqual([list[0], list[1], { name: 'a b', hosts: 3 }]);
	});

	test('block sizes', () => {
		const cases: [number, number][] = [
			[1, 30],
			[2, 30],
			[3, 29],
			[6, 29],
			[7, 28],
			[14, 28],
			[30, 27],
			[31, 26],
			[50, 26],
			[62, 26],
			[63, 25],
			[254, 24],
			[255, 23]
		];
		for (const [hosts, prefix] of cases) expect(prefixForHosts(hosts), String(hosts)).toBe(prefix);
		expect(prefixForHosts(2, true)).toBe(31);
		expect(prefixForHosts(1, true)).toBe(31);
		expect(prefixForHosts(3, true)).toBe(29);
		for (let h = 1; h < 5000; h++) {
			const p = prefixForHosts(h);
			expect(2 ** (32 - p) - 2 >= h && (p === 30 || 2 ** (31 - p) - 2 < h)).toBe(true);
		}
	});

	test('the textbook plan: 192.168.10.0/24 for 50, 20, 10 and two links', () => {
		const plan = allocateVlsm(
			parseAddress('192.168.10.0'),
			24,
			parseRequirements('Sales 50\nHR 20\nIT 10\nLink A 2\nLink B 2')
		);
		expect(plan.ok).toBe(true);
		if (!plan.ok) return;
		const rows = plan.allocations.map((a) => [a.name, `${formatAddress(a.info.network)}/${a.info.prefix}`, a.spare]);
		expect(rows).toEqual([
			['Sales', '192.168.10.0/26', 12],
			['HR', '192.168.10.64/27', 10],
			['IT', '192.168.10.96/28', 4],
			['Link A', '192.168.10.112/30', 0],
			['Link B', '192.168.10.116/30', 0]
		]);
		expect(plan.used).toBe(120);
		expect(plan.free.map((f) => `${formatAddress(f.network)}/${f.prefix}`)).toEqual([
			'192.168.10.120/29',
			'192.168.10.128/25'
		]);
		// With /31 links the two links take half the space.
		const p31 = allocateVlsm(
			parseAddress('192.168.10.0'),
			24,
			parseRequirements('Sales 50\nHR 20\nIT 10\nLink A 2\nLink B 2'),
			true
		);
		expect(p31.ok && p31.used).toBe(116);
	});

	test('a plan that does not fit says by how much and what would hold it', () => {
		const plan = allocateVlsm(parseAddress('10.0.0.0'), 26, parseRequirements('A 50\nB 20'));
		expect(plan).toMatchObject({ ok: false, needed: 96, total: 64, fitsIn: 25 });
		const single = allocateVlsm(parseAddress('10.0.0.0'), 28, parseRequirements('A 20'));
		expect(single).toMatchObject({ ok: false, needed: 32, total: 16, fitsIn: 27 });
	});

	test('random plans never overlap, stay inside, are aligned and fit their hosts', () => {
		for (let i = 0; i < 400; i++) {
			const prefix = 16 + Math.floor(random() * 12);
			const network = subnetInfo(randomAddress(), prefix).network;
			const count = 1 + Math.floor(random() * 10);
			const reqs = Array.from({ length: count }, (_, k) => ({
				name: `R${k}`,
				hosts: 1 + Math.floor(random() ** 3 * 2 ** (32 - prefix) * 0.5)
			}));
			const p2p = random() < 0.5;
			const plan = allocateVlsm(network, prefix, reqs, p2p);
			const sizes = reqs.map((r) => 2 ** (32 - prefixForHosts(r.hosts, p2p)));
			const needed = sizes.reduce((a, b) => a + b, 0);
			expect(plan.ok).toBe(needed <= 2 ** (32 - prefix));
			if (!plan.ok) continue;
			expect(plan.allocations).toHaveLength(count);
			const spans: [number, number][] = [];
			for (const a of plan.allocations) {
				const size = a.info.total;
				expect(a.info.network % size).toBe(0);
				expect(a.info.network).toBeGreaterThanOrEqual(network);
				expect(a.info.last).toBeLessThanOrEqual(network + 2 ** (32 - prefix) - 1);
				expect(a.info.usable).toBeGreaterThanOrEqual(a.hosts);
				// The smallest block: one prefix longer would not hold the hosts.
				if (a.info.prefix < 30) expect(2 ** (31 - a.info.prefix) - 2).toBeLessThan(a.hosts);
				spans.push([a.info.network, a.info.last]);
			}
			// Free blocks plus allocations tile the base exactly, with no overlap.
			for (const f of plan.free) spans.push([f.network, f.last]);
			spans.sort((x, y) => x[0] - y[0]);
			let at = network;
			for (const [s, e] of spans) {
				expect(s).toBe(at);
				at = e + 1;
			}
			expect(at).toBe(network + 2 ** (32 - prefix));
			expect(plan.allocations.map((a) => a.index).sort((x, y) => x - y)).toEqual(reqs.map((_, k) => k));
		}
	});

	test('largest first never spans more than any other order', () => {
		const reqs = parseRequirements('Link 2\nSales 50\nHR 20');
		// The /30 at 0 pushes the /26 up to 64, leaving 60 addresses unused.
		expect(spanInOrder(reqs)).toBe(160);
		for (let i = 0; i < 300; i++) {
			const list = Array.from({ length: 1 + Math.floor(random() * 6) }, (_, k) => ({
				name: `R${k}`,
				hosts: 1 + Math.floor(random() ** 2 * 500)
			}));
			const sorted = [...list].sort((a, b) => b.hosts - a.hosts);
			const packed = list.reduce((sum, r) => sum + 2 ** (32 - prefixForHosts(r.hosts)), 0);
			expect(spanInOrder(sorted)).toBe(packed);
			expect(spanInOrder(list)).toBeGreaterThanOrEqual(packed);
		}
	});

	test('the host range table', () => {
		const rows = hostRangeTable();
		for (const r of rows) {
			for (const h of [r.minHosts, r.maxHosts]) expect(prefixForHosts(h)).toBe(r.prefix);
			if (r.prefix < 30) expect(prefixForHosts(r.minHosts - 1)).toBe(r.prefix + 1);
		}
		expect(rows.find((r) => r.prefix === 26)).toEqual({ prefix: 26, addresses: 64, minHosts: 31, maxHosts: 62 });
	});

	test('equal split', () => {
		const s = splitEqual(parseAddress('192.168.0.0'), 24, 26);
		expect(s.count).toBe(4);
		expect(s.subnets.map((x) => `${formatAddress(x.network)}-${formatAddress(x.broadcast ?? -1)}`)).toEqual([
			'192.168.0.0-192.168.0.63',
			'192.168.0.64-192.168.0.127',
			'192.168.0.128-192.168.0.191',
			'192.168.0.192-192.168.0.255'
		]);
		expect(bitsForCount(5)).toBe(3);
		expect(bitsForCount(8)).toBe(3);
		expect(bitsForCount(1)).toBe(0);
		const big = splitEqual(parseAddress('10.0.0.0'), 8, 24, 100);
		expect(big.count).toBe(65536);
		expect(big.subnets).toHaveLength(100);
		expect(formatAddress(big.subnets[99].network)).toBe('10.0.99.0');
		expect(errorOf(() => splitEqual(0, 24, 20))).toMatch(/bigger than the \/24/);
	});
});

// --- the pages ---------------------------------------------------------------

async function faqMatches(page: Page, slug: string) {
	const visible = await page.locator('.faq details').evaluateAll((ds) =>
		ds.map((d) => ({
			q: (d.querySelector('summary')?.textContent ?? '').trim(),
			a: (d.querySelector('p')?.textContent ?? '').replace(/\s+/g, ' ').trim()
		}))
	);
	const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
	const ld = blocks
		.map((t) => JSON.parse(t))
		.find((b) => b['@graph']?.some((n: { '@id'?: string }) => n['@id']?.endsWith(`/${slug}#webpage`)));
	const webPage = ld['@graph'].find((n: { '@id'?: string }) => n['@id']?.endsWith('#webpage'));
	expect(visible.length).toBeGreaterThanOrEqual(4);
	expect(
		webPage.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => ({
			q: q.name,
			a: q.acceptedAnswer.text
		}))
	).toEqual(visible);
}

test.describe('the subnet-calculator page', () => {
	test('the prerendered page already shows the worked default', async ({ page }) => {
		const html = await (await page.request.get('/subnet-calculator')).text();
		expect(html).toContain('192.168.1.0');
		expect(html).toContain('192.168.1.255');
		expect(html).toContain('192.168.1.254');
		expect(html).toContain('11000000');
		expect(html).toContain('255.255.255.252');
	});

	test('typing changes the result, and the link round trips', async ({ page }) => {
		await page.goto('/subnet-calculator');
		await page.waitForLoadState('networkidle');
		await page.fill('#cidr', '172.16.45.14 255.255.240.0');
		await expect(page.locator('[data-field="network"]')).toHaveText('172.16.32.0');
		await expect(page.locator('[data-field="broadcast"]')).toHaveText('172.16.47.255');
		await expect(page.locator('[data-field="usable"]')).toHaveText('4,094');
		await expect(page).toHaveURL(/ip=172\.16\.45\.14/);
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page.locator('#cidr')).toHaveValue('172.16.45.14 255.255.240.0');
		await expect(page.locator('[data-field="network"]')).toHaveText('172.16.32.0');
		await expect(page).toHaveURL(shared);
	});

	test('the prefix slider rewrites the input, and bad input is explained', async ({ page }) => {
		await page.goto('/subnet-calculator');
		await page.waitForLoadState('networkidle');
		await page.locator('#prefix').fill('31');
		await expect(page.locator('#cidr')).toHaveValue('192.168.1.10/31');
		await expect(page.locator('[data-field="usable"]')).toHaveText('2');
		await expect(page.locator('.tool')).toContainText('RFC 3021');
		await page.fill('#cidr', '192.168.1.256/24');
		await expect(page.locator('.error')).toHaveText('Octet 4 is 256, the maximum is 255 (the fourth octet is 8 bits)');
	});

	test('errors are described on the field, and announced only after typing pauses', async ({ page }) => {
		await page.goto('/subnet-calculator');
		await page.waitForLoadState('networkidle');
		const alerts: string[] = [];
		await page.exposeFunction('noteAlert', (t: string) => alerts.push(t));
		await page.evaluate(() => {
			const seen = new WeakSet<Node>();
			new MutationObserver(() => {
				for (const el of document.querySelectorAll('main [role="alert"]')) {
					if (!seen.has(el) || el.textContent !== (el as HTMLElement).dataset.last) {
						seen.add(el);
						(el as HTMLElement).dataset.last = el.textContent ?? '';
						(window as unknown as { noteAlert: (t: string) => void }).noteAlert(el.textContent ?? '');
					}
				}
			}).observe(document.body, { subtree: true, childList: true, characterData: true });
		});
		await page.fill('#cidr', '');
		await page.type('#cidr', '10.20.30.40/16', { delay: 60 });
		await page.waitForTimeout(700);
		expect(alerts.length).toBeLessThanOrEqual(1);
		await page.fill('#cidr', '10.20.30.400/16');
		await expect(page.locator('#cidr')).toHaveAttribute('aria-describedby', 'cidr-help cidr-error');
		await expect(page.locator('#cidr-error')).toContainText('Octet 4 is 400');
		await expect(page.locator('main [role="alert"]')).toContainText('Octet 4 is 400');
		await page.fill('#test-address', '1.2.3');
		await expect(page.locator('#test-address')).toHaveAttribute('aria-describedby', 'test-error');
	});

	test('a table that scrolls can be reached by keyboard, and one that fits cannot', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await page.goto('/subnet-calculator');
		await page.waitForLoadState('networkidle');
		const wrap = page.locator('#table .table-wrap');
		await expect(wrap).toHaveAttribute('tabindex', '0');
		await expect(wrap).toHaveAttribute('role', 'region');
		await expect(wrap).toHaveAttribute('aria-label', 'Subnet mask table');
		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(wrap).not.toHaveAttribute('tabindex', '0');
		await expect(page.locator('.bits-figure').first()).toHaveAttribute('role', 'group');
	});

	test('the membership check shows the AND', async ({ page }) => {
		await page.goto('/subnet-calculator?ip=10.0.0.5%2F8&test=11.0.0.1');
		await expect(page.locator('.verdict')).toContainText('is not in');
		await page.fill('#test-address', '10.200.3.4');
		await expect(page.locator('.verdict')).toContainText('is in');
	});

	test('an empty check field, refused values and a bad input', async ({ page }) => {
		await page.goto('/subnet-calculator?ip=192.168.1.0%2F24');
		await page.waitForLoadState('networkidle');
		await page.fill('#test-address', '');
		await expect(page).toHaveURL(/test=-/);
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page.locator('#test-address')).toHaveValue('');
		await expect(page).toHaveURL(shared);
		// A refused value leaves the address bar instead of lingering there.
		await page.goto(`/subnet-calculator?ip=${'x'.repeat(81)}`);
		await expect(page).toHaveURL(/\/subnet-calculator$/);
		// The dimmed last result cannot be reached while the input is wrong.
		await page.fill('#cidr', '192.168.1.256/24');
		await expect(page.locator('.results')).toHaveAttribute('inert', /.*/);
		// The check field stays usable, and waits for a good subnet instead of using the dimmed one.
		await page.fill('#test-address', '192.168.1.77');
		await expect(page.locator('.check')).toContainText('Fix the subnet above');
		await expect(page.locator('.verdict')).toHaveCount(0);
		await page.fill('#cidr', '192.168.1.0/24');
		await expect(page.locator('.verdict')).toContainText('192.168.1.77 is in 192.168.1.0/24');
		await page.fill('#cidr', '224.0.0.1/4');
		await expect(page.locator('.results')).not.toHaveAttribute('inert', /.*/);
		await expect(page.locator('.notes')).toContainText('Multicast addresses name groups of receivers, not hosts');
	});

	test('the FAQ JSON-LD matches the visible answers', async ({ page }) => {
		await page.goto('/subnet-calculator');
		await faqMatches(page, 'subnet-calculator');
	});
});

test.describe('the vlsm-calculator page', () => {
	test('the prerendered page already shows the worked plan', async ({ page }) => {
		const html = await (await page.request.get('/vlsm-calculator')).text();
		expect(html).toContain('192.168.10.0/26');
		expect(html).toContain('192.168.10.64/27');
		expect(html).toContain('192.168.10.128/25');
	});

	test('editing rows changes the plan and the link round trips', async ({ page }) => {
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		await page.locator('#req-hosts-0').fill('100');
		await expect(page.locator('.plan tbody tr').first()).toContainText('192.168.10.0/25');
		await page.getByRole('button', { name: 'Add a subnet' }).click();
		await page.locator('#req-name-5').fill('Guests');
		await page.locator('#req-hosts-5').fill('5');
		await expect(page.locator('.plan')).toContainText('Guests');
		await expect(page).toHaveURL(/req=/);
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page.locator('#req-hosts-0')).toHaveValue('100');
		await expect(page.locator('#req-name-5')).toHaveValue('Guests');
		await expect(page).toHaveURL(shared);
	});

	test('the plan fits its card at 1280 without scrolling sideways', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		const wrap = page.locator('.plan').locator('xpath=..');
		const [scroll, client] = await wrap.evaluate((el) => [el.scrollWidth, el.clientWidth]);
		expect(scroll).toBeLessThanOrEqual(client);
		await expect(page.locator('.plan thead')).toContainText('Host range');
		await expect(page.locator('.plan tbody tr').first()).toContainText('192.168.10.1to 192.168.10.62');
	});

	test('a plan that does not fit says how much is missing', async ({ page }) => {
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		await page.fill('#base', '192.168.10.0/26');
		await expect(page.locator('.error')).toContainText('needs 120 addresses');
		await expect(page.locator('.error')).toContainText('56 addresses short');
	});

	test('pasted text and the equal split mode', async ({ page }) => {
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Edit as text' }).click();
		await page.fill('#req-text', 'A 500\nB 200');
		await page.fill('#base', '10.0.0.0/22');
		await expect(page.locator('.plan tbody tr').first()).toContainText('10.0.0.0/23');
		await page.getByRole('button', { name: 'Equal split' }).click();
		await page.fill('#split-count', '3');
		await expect(page.locator('.split tbody tr')).toHaveCount(4);
		await expect(page.locator('.split tbody tr').last()).toContainText('10.0.3.0/24');
	});

	test('host counts are read strictly, the bad row is marked, and grouped counts round trip', async ({ page }) => {
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		await page.locator('#req-hosts-2').fill('1e2');
		await expect(page.locator('#req-error')).toHaveText('IT (row 3): write the host count in plain digits, such as 50');
		await expect(page.locator('#req-hosts-2')).toHaveAttribute('aria-invalid', 'true');
		await expect(page.locator('#req-hosts-0')).toHaveAttribute('aria-invalid', 'false');
		await page.fill('#base', '10.0.0.0/16');
		await page.locator('#req-hosts-2').fill('12,500');
		await expect(page.locator('#req-error')).toHaveCount(0);
		await expect(page.locator('.plan tbody tr').first()).toContainText('10.0.0.0/18');
		const shared = page.url();
		await page.goto('about:blank');
		await page.goto(shared);
		await expect(page).toHaveURL(/IT\+12500/);
		await expect(page.locator('#req-hosts-2')).toHaveValue('12500');
		await expect(page.locator('.plan tbody tr').first()).toContainText('IT');
		await expect(page).toHaveURL(shared);
		// A link holding a bad row reopens as rows, with that row marked.
		await page.locator('#req-hosts-1').fill('abc');
		await expect(page.locator('#req-error')).toHaveText('HR (row 2): write the host count in plain digits, such as 50');
		const bad = page.url();
		await page.goto('about:blank');
		await page.goto(bad);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('#req-hosts-1')).toHaveValue('abc');
		await expect(page.locator('#req-hosts-1')).toHaveAttribute('aria-invalid', 'true');
		await expect(page.locator('#req-error')).toHaveText('HR (row 2): write the host count in plain digits, such as 50');
		await expect(page).toHaveURL(bad);
	});

	test('every network links to the subnet calculator, and the plan copies', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		const links = page.locator('.plan tbody a');
		await expect(links).toHaveCount(7);
		await expect(links.nth(1)).toHaveAttribute('href', '/subnet-calculator?ip=192.168.10.64%2F27');
		await page.getByRole('button', { name: 'Copy plan' }).click();
		await expect(page.locator('.copy-status')).toContainText('Copied');
		const copied = await page.evaluate(() => navigator.clipboard.readText());
		expect(copied.split('\n')[1]).toBe(
			'Sales\t50\t62\t192.168.10.0/26\t255.255.255.192\t192.168.10.1\t192.168.10.62\t192.168.10.63\t12'
		);
	});

	test('a shared plan that does not fit shows no stale plan, and offers a base that fits', async ({ page }) => {
		await page.goto('/vlsm-calculator?net=192.168.50.0%2F25&req=Floor+1+60%0AFloor+2+60%0AGuests+10');
		await expect(page.locator('.error.short')).toContainText('addresses short');
		await expect(page.locator('.results')).toHaveCount(0);
		await page.getByRole('button', { name: 'Use 192.168.50.0/24' }).click();
		await expect(page.locator('#base')).toHaveValue('192.168.50.0/24');
		await expect(page.locator('.plan tbody tr').first()).toContainText('Floor 1');
	});

	test('the editor toggle keeps focus, and the split controls agree', async ({ page }) => {
		await page.goto('/vlsm-calculator');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Edit as text' }).click();
		await expect(page.getByRole('button', { name: 'Edit as rows' })).toBeFocused();
		await page.getByRole('button', { name: 'Equal split' }).click();
		await page.selectOption('#split-prefix', '30');
		await expect(page.locator('#split-count')).toHaveValue('64');
		await expect(page.locator('.answer-value')).toHaveText('64 × /30');
		// Typing a count after choosing a prefix splits by the count typed.
		await page.fill('#split-count', '3');
		await expect(page.locator('#split-count')).toHaveValue('3');
		await expect(page.locator('.answer-value')).toHaveText('4 × /26');
		await expect.poll(() => new URL(page.url()).searchParams.get('n')).toBe('3');
		await page.selectOption('#split-prefix', '28');
		await expect(page.locator('#split-count')).toHaveValue('16');
		await page.locator('#split-count').press('End');
		await page.locator('#split-count').press('Backspace');
		await page.locator('#split-count').press('Backspace');
		await expect(page.locator('#split-count')).toHaveValue('');
		await page.locator('#split-count').type('5');
		await expect(page.locator('#split-count')).toHaveValue('5');
		await expect(page.locator('.answer-value')).toHaveText('8 × /27');
		// With no valid count, the prefix select shows no prefix rather than a stale one.
		await page.fill('#split-count', 'abc');
		await expect(page.locator('#split-prefix option:checked')).toHaveText('Choose a prefix');
		await page.selectOption('#split-prefix', '29');
		await expect(page.locator('#split-count')).toHaveValue('32');
		await expect(page.locator('#split-prefix option:checked')).not.toHaveText('Choose a prefix');
		await expect(page.locator('.answer-value')).toHaveText('32 × /29');
		// A prefix longer than the base leaves no count to show.
		await page.selectOption('#split-prefix', '30');
		await page.fill('#base', '192.168.10.0/31');
		await expect(page.locator('#split-prefix option:checked')).toHaveText('/30 (larger than the network)');
		await expect(page.locator('#split-count')).toHaveValue('');
	});

	test('the FAQ JSON-LD matches the visible answers', async ({ page }) => {
		await page.goto('/vlsm-calculator');
		await faqMatches(page, 'vlsm-calculator');
	});
});
