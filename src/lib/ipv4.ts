// IPv4 subnetting as the bit arithmetic it really is: the network address is
// the address AND the mask, the broadcast is the network OR the inverted mask,
// and a VLSM plan is a set of power-of-two blocks packed largest first.
//
// Addresses are plain numbers holding an unsigned 32 bit value. JavaScript's
// bitwise operators work on signed 32 bit integers, so every result that came
// out of one is passed through `>>> 0` to read it as unsigned again. The test
// suite checks all of this against a BigInt implementation written the long
// way round, and against brute-force enumeration for small subnets.

export class IpError extends Error {}

/** 2^32, the number of IPv4 addresses. Fits a double exactly. */
export const ADDRESS_SPACE = 4294967296;

/** The netmask for a prefix length: `prefix` one bits followed by zeros. */
export function maskFromPrefix(prefix: number): number {
	// A shift by 32 is a shift by 0 in JavaScript, so /0 needs its own case.
	return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** The wildcard (inverse) mask: the host bits set, as ACLs and OSPF write it. */
export const wildcardFromPrefix = (prefix: number) => ~maskFromPrefix(prefix) >>> 0;

/** Number of addresses in a block of this prefix length. */
export const blockSize = (prefix: number) => 2 ** (32 - prefix);

export function formatAddress(n: number): string {
	return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

/** The 32 bits of an address, most significant first. */
export const toBits = (n: number) => (n >>> 0).toString(2).padStart(32, '0');

/** The bits with a dot between octets, the way they are usually printed. */
export const dottedBits = (n: number) => toBits(n).replace(/(.{8})(?=.)/g, '$1.');

const ordinal = ['', 'first', 'second', 'third', 'fourth'];

/**
 * Reads a dotted-quad address. Leading zeros are refused rather than guessed
 * at: inet_aton and some ping implementations read 010 as octal 8, others as
 * decimal 10, and Python's ipaddress rejects it outright, so it is safer to
 * ask than to quietly pick one meaning.
 */
export function parseAddress(text: string, what = 'address'): number {
	const s = text.trim();
	const label = what === 'address' ? 'Octet' : `${what[0].toUpperCase()}${what.slice(1)} octet`;
	if (!s) throw new IpError(`Type an IPv4 ${what}, such as ${what === 'mask' ? '255.255.255.0' : '192.168.1.10'}`);
	const bad = s.match(/[^0-9.]/);
	if (bad) {
		const ch = bad[0] === ' ' ? 'a space' : `"${bad[0]}"`;
		if (s.includes(':')) throw new IpError(`${s} looks like an IPv6 address; this calculator is for IPv4`);
		throw new IpError(`${ch} cannot appear in an IPv4 ${what}: use four numbers from 0 to 255 separated by dots`);
	}
	const parts = s.split('.');
	if (parts.length !== 4) {
		throw new IpError(
			`An IPv4 ${what} has 4 octets separated by dots; ${s} has ${parts.length} octet${parts.length === 1 ? '' : 's'}`
		);
	}
	let value = 0;
	parts.forEach((part, i) => {
		const n = i + 1;
		if (part === '') throw new IpError(`${label} ${n} is empty: there are two dots in a row, or one at an end`);
		if (part.length > 1 && part[0] === '0') {
			throw new IpError(
				`${label} ${n} is written ${part}: leading zeros are ambiguous (some software reads them as octal), so write ${Number(
					part
				)}`
			);
		}
		const octet = part.length > 4 ? Infinity : Number(part);
		if (octet > 255) {
			throw new IpError(
				`${label} ${n} is ${part.length > 12 ? part.slice(0, 12) + '…' : part}, the maximum is 255 (the ${
					ordinal[n]
				} octet is 8 bits)`
			);
		}
		value = value * 256 + octet;
	});
	return value;
}

/**
 * The prefix length of a netmask, or an error saying why it is not one. A mask
 * must be a solid run of ones then a solid run of zeros; anything else would
 * make "the network part" meaningless.
 */
export function prefixFromMask(mask: number): number {
	const bits = toBits(mask);
	const firstZero = bits.indexOf('0');
	if (firstZero === -1) return 32;
	const strayOne = bits.indexOf('1', firstZero);
	if (strayOne === -1) return firstZero;
	const shown = formatAddress(mask);
	// A run of zeros then ones is the wildcard form, an easy mix-up.
	if (/^0+1+$/.test(bits)) {
		const prefix = bits.indexOf('1');
		throw new IpError(
			`${shown} looks like a wildcard mask (zeros then ones); the netmask with the same meaning is ${formatAddress(
				maskFromPrefix(prefix)
			)}, which is /${prefix}`
		);
	}
	throw new IpError(
		`${shown} is not a valid netmask: a mask is ones followed by zeros, but bit ${strayOne + 1} is a 1 after bit ${
			firstZero + 1
		} was a 0`
	);
}

/** A prefix written as /24, 24 or 255.255.255.0. */
export function parseMask(text: string): number {
	const s = text.trim();
	if (!s) throw new IpError('Add a prefix length or a mask, such as /24 or 255.255.255.0');
	const prefixMatch = s.match(/^\/?\s*(\d+)$/);
	if (prefixMatch) {
		const n = Number(prefixMatch[1]);
		if (n > 32) throw new IpError(`A prefix length runs from /0 to /32, so /${prefixMatch[1]} is too long`);
		return n;
	}
	return prefixFromMask(parseAddress(s.replace(/^\//, ''), 'mask'));
}

export type Cidr = {
	address: number;
	prefix: number;
	/** The address as typed, for rewriting the input with a new prefix. */
	addressText: string;
};

/** Reads 192.168.1.10/24, 192.168.1.10 255.255.255.0, 192.168.1.10/255.255.255.0 or 192.168.1.10 24. */
export function parseCidr(text: string): Cidr {
	const s = text.trim();
	if (!s) throw new IpError('Type an address and its prefix, such as 192.168.1.10/24');
	let addressText: string;
	let maskText: string;
	const slash = s.indexOf('/');
	if (slash !== -1) {
		addressText = s.slice(0, slash).trim();
		maskText = s.slice(slash + 1).trim();
		if (!maskText) throw new IpError('Add the prefix length after the slash, such as /24');
	} else {
		const space = s.search(/\s/);
		if (space === -1) {
			const address = parseAddress(s);
			const cls = addressClass(address);
			throw new IpError(
				`Add a prefix or mask after the address, such as ${s}/24 or ${s} 255.255.255.0${
					cls.defaultPrefix ? `. Its old class ${cls.letter} default would have been /${cls.defaultPrefix}` : ''
				}`
			);
		}
		addressText = s.slice(0, space);
		maskText = s.slice(space).trim();
	}
	return { address: parseAddress(addressText), prefix: parseMask(maskText), addressText };
}

export type AddressClass = {
	letter: 'A' | 'B' | 'C' | 'D' | 'E';
	/** The leading bits that picked the class. */
	leadingBits: string;
	first: string;
	last: string;
	/** The classful network size, or null for D and E, which had none. */
	defaultPrefix: number | null;
	use: string;
};

/** The classes in the order the leading bits are tested. */
export const ADDRESS_CLASSES: AddressClass[] = [
	{ letter: 'A', leadingBits: '0', first: '0.0.0.0', last: '127.255.255.255', defaultPrefix: 8, use: 'Large networks' },
	{
		letter: 'B',
		leadingBits: '10',
		first: '128.0.0.0',
		last: '191.255.255.255',
		defaultPrefix: 16,
		use: 'Medium networks'
	},
	{
		letter: 'C',
		leadingBits: '110',
		first: '192.0.0.0',
		last: '223.255.255.255',
		defaultPrefix: 24,
		use: 'Small networks'
	},
	{
		letter: 'D',
		leadingBits: '1110',
		first: '224.0.0.0',
		last: '239.255.255.255',
		defaultPrefix: null,
		use: 'Multicast'
	},
	{
		letter: 'E',
		leadingBits: '1111',
		first: '240.0.0.0',
		last: '255.255.255.255',
		defaultPrefix: null,
		use: 'Reserved'
	}
];

/** The historic class, read from the leading bits exactly as classful routers did. */
export function addressClass(address: number): AddressClass {
	const bits = toBits(address);
	// Class E's 1111 is the last case, so every address matches one of them.
	return ADDRESS_CLASSES.find((c) => bits.startsWith(c.leadingBits)) ?? ADDRESS_CLASSES[4];
}

export type SpecialRange = {
	network: number;
	prefix: number;
	cidr: string;
	name: string;
	rfc: string;
	note: string;
};

const special = (cidr: string, name: string, rfc: string, note: string): SpecialRange => {
	const [a, p] = cidr.split('/');
	return { network: parseAddress(a), prefix: Number(p), cidr, name, rfc, note };
};

/**
 * Special-use ranges from the IANA IPv4 Special-Purpose Address Registry and
 * the multicast and reserved blocks. An address is matched against the most
 * specific range that holds it.
 */
export const SPECIAL_RANGES: SpecialRange[] = [
	special('0.0.0.0/8', '"This network"', 'RFC 1122', 'Only valid as a source while a host learns its address.'),
	special('10.0.0.0/8', 'Private', 'RFC 1918', 'For use inside an organisation; not routed on the internet.'),
	special(
		'100.64.0.0/10',
		'Shared address space (CGNAT)',
		'RFC 6598',
		'Between a carrier-grade NAT and its customers.'
	),
	special('127.0.0.0/8', 'Loopback', 'RFC 1122', 'Never leaves the host; 127.0.0.1 is the usual one.'),
	special(
		'169.254.0.0/16',
		'Link-local',
		'RFC 3927',
		'Self-assigned when no DHCP server answers; not forwarded by routers.'
	),
	special('172.16.0.0/12', 'Private', 'RFC 1918', '172.16.0.0 to 172.31.255.255.'),
	special('192.0.0.0/24', 'IETF protocol assignments', 'RFC 6890', 'Reserved for specific protocols.'),
	special(
		'192.0.2.0/24',
		'Documentation (TEST-NET-1)',
		'RFC 5737',
		'For examples in documents; never on a real network.'
	),
	special('192.168.0.0/16', 'Private', 'RFC 1918', 'The usual home and office LAN range.'),
	special('198.18.0.0/15', 'Benchmarking', 'RFC 2544', 'For testing network equipment.'),
	special(
		'198.51.100.0/24',
		'Documentation (TEST-NET-2)',
		'RFC 5737',
		'For examples in documents; never on a real network.'
	),
	special(
		'203.0.113.0/24',
		'Documentation (TEST-NET-3)',
		'RFC 5737',
		'For examples in documents; never on a real network.'
	),
	special('224.0.0.0/4', 'Multicast', 'RFC 5771', 'One sender, many receivers; the old class D.'),
	special('240.0.0.0/4', 'Reserved', 'RFC 1112', 'The old class E, set aside for future use.'),
	special('255.255.255.255/32', 'Limited broadcast', 'RFC 919', 'Every host on the local link; never forwarded.')
];

/** The most specific special-use range holding the address, if any. */
export function specialRange(address: number): SpecialRange | null {
	let best: SpecialRange | null = null;
	for (const r of SPECIAL_RANGES) {
		if ((address & maskFromPrefix(r.prefix)) >>> 0 === r.network && (!best || r.prefix > best.prefix)) best = r;
	}
	return best;
}

export type SubnetInfo = {
	address: number;
	prefix: number;
	mask: number;
	wildcard: number;
	network: number;
	/** The last address of the block. /31 and /32 have no broadcast address, but still have a last address. */
	last: number;
	broadcast: number | null;
	firstHost: number;
	lastHost: number;
	total: number;
	usable: number;
	/** /31 is a point-to-point link (RFC 3021), /32 a single host. */
	kind: 'subnet' | 'point-to-point' | 'host';
	addressClass: AddressClass;
	special: SpecialRange | null;
	/** The address typed is the network address itself. */
	isNetwork: boolean;
	isBroadcast: boolean;
};

export function subnetInfo(address: number, prefix: number): SubnetInfo {
	const mask = maskFromPrefix(prefix);
	const wildcard = ~mask >>> 0;
	const network = (address & mask) >>> 0;
	const last = (network | wildcard) >>> 0;
	const total = blockSize(prefix);
	const kind = prefix === 32 ? 'host' : prefix === 31 ? 'point-to-point' : 'subnet';
	// In a normal subnet the first address names the network and the last is
	// the broadcast, so neither can be given to a host. A /31 has no room for
	// either and RFC 3021 lets both be used; a /32 is the one address itself.
	const reserved = kind === 'subnet';
	return {
		address,
		prefix,
		mask,
		wildcard,
		network,
		last,
		broadcast: reserved ? last : null,
		firstHost: reserved ? network + 1 : network,
		lastHost: reserved ? last - 1 : last,
		total,
		usable: reserved ? total - 2 : total,
		kind,
		addressClass: addressClass(address),
		special: specialRange(address),
		isNetwork: reserved && address === network,
		isBroadcast: reserved && address === last
	};
}

/** Whether an address falls in a subnet: AND it with the subnet's mask and compare. */
export function inSubnet(address: number, network: number, prefix: number): boolean {
	return (address & maskFromPrefix(prefix)) >>> 0 === network;
}

/**
 * The shortcut done in your head: find the octet where the mask stops being
 * 255, take 256 minus that mask octet as the block size, and the network
 * octet is the largest multiple of the block size not above the address's
 * octet. It gives the same answer as the AND, one octet at a time.
 */
export function magicNumber(address: number, prefix: number) {
	// For /8, /16 and /24 the mask's 255s end exactly at an octet boundary, so
	// the octet to look at is the next one, where the mask is 0 and the block 256.
	const index = Math.min(3, Math.floor(prefix / 8));
	const shift = 24 - 8 * index;
	const maskOctet = (maskFromPrefix(prefix) >>> shift) & 255;
	const block = 256 - maskOctet;
	const value = (address >>> shift) & 255;
	const networkOctet = Math.floor(value / block) * block;
	return { octet: index + 1, maskOctet, block, value, networkOctet, lastOctet: networkOctet + block - 1 };
}

/** Usable host addresses in a block of this prefix (with /31 and /32 as RFC 3021 and a host route have them). */
export const usableHosts = (prefix: number) => (prefix >= 31 ? blockSize(prefix) : blockSize(prefix) - 2);

export type PrefixRow = {
	prefix: number;
	mask: string;
	wildcard: string;
	addresses: number;
	usable: number;
	/** How many of these fit in a /24, or how many /24s this is, for orientation. */
	relative: string;
};

/** Every prefix length from /0 to /32 with its masks and sizes. */
export function prefixTable(): PrefixRow[] {
	return Array.from({ length: 33 }, (_, prefix) => ({
		prefix,
		mask: formatAddress(maskFromPrefix(prefix)),
		wildcard: formatAddress(wildcardFromPrefix(prefix)),
		addresses: blockSize(prefix),
		usable: usableHosts(prefix),
		relative:
			prefix === 24
				? '1 × /24'
				: prefix < 24
				? `${(2 ** (24 - prefix)).toLocaleString('en-GB')} × /24`
				: `1/${2 ** (prefix - 24)} of a /24`
	}));
}

/** Splits [start, end) into the fewest aligned CIDR blocks that cover it exactly. */
export function rangeToCidrs(start: number, end: number): { network: number; prefix: number }[] {
	const out: { network: number; prefix: number }[] = [];
	let at = start;
	while (at < end) {
		// The largest block that both starts aligned at `at` and fits before `end`.
		let size = at === 0 ? ADDRESS_SPACE : (at & -at) >>> 0;
		while (size > end - at) size /= 2;
		out.push({ network: at, prefix: 32 - Math.log2(size) });
		at += size;
	}
	return out;
}

// --- VLSM ------------------------------------------------------------------

export type Requirement = { name: string; hosts: number };

export const MAX_REQUIREMENTS = 64;

/**
 * Reads one requirement per line: a name and a host count, in either order,
 * separated by spaces, a colon or a comma ("Sales 50", "HR: 20", "Link A, 2").
 * The last whole number on the line is the count, so names may contain digits.
 */
export function parseRequirements(text: string): Requirement[] {
	const out: Requirement[] = [];
	text.split(/\r?\n|;/).forEach((raw, i) => {
		const line = raw.trim();
		if (!line) return;
		// The count at the end ("Sales 50"), or failing that at the start ("50 Sales").
		const last = line.match(/^(.*?)(\d+)(?:\s*hosts?)?$/i);
		const first = line.match(/^(\d+)(?:\s*hosts?)?[\s:,=-]+(.+)$/i);
		const [name0, count0] = last ? [last[1], last[2]] : first ? [first[2], first[1]] : ['', ''];
		if (!count0) {
			throw new IpError(
				`Line ${i + 1} ("${line.slice(0, 30)}") has no host count: write a name and a number, such as Sales 50`
			);
		}
		const name = name0.trim().replace(/[\s:,=-]+$/, '');
		const hosts = Number(count0);
		out.push({ name: name || `Subnet ${out.length + 1}`, hosts });
	});
	checkRequirements(out);
	return out;
}

/** The largest host count a single block can hold: a /0 less its network and broadcast. */
export const MAX_HOSTS = ADDRESS_SPACE - 2;

/** Throws a specific error for a list the planner cannot work with. */
export function checkRequirements(list: Requirement[]) {
	if (list.length > MAX_REQUIREMENTS) {
		throw new IpError(`That is ${list.length} subnets; the limit here is ${MAX_REQUIREMENTS}`);
	}
	list.forEach((r, i) => {
		const who = r.name ? `${r.name} (row ${i + 1})` : `Row ${i + 1}`;
		if (!Number.isInteger(r.hosts) || r.hosts < 1) throw new IpError(`${who} needs a host count of 1 or more`);
		if (r.hosts > MAX_HOSTS) {
			throw new IpError(`${who} asks for ${r.hosts} hosts; the most one IPv4 block can hold is ${MAX_HOSTS}`);
		}
	});
}

/** The text form parseRequirements reads back, one "name hosts" per line. */
export const formatRequirements = (list: Requirement[]) =>
	list.map((r) => `${r.name.replace(/\s*[;\r\n]+\s*/g, ' ').trim()} ${r.hosts}`).join('\n');

/**
 * The longest prefix (smallest block) that holds `hosts` hosts. A normal
 * subnet loses two addresses to the network and broadcast, so it needs
 * hosts + 2 addresses; with point-to-point links allowed, two hosts fit a /31.
 */
export function prefixForHosts(hosts: number, allowP2P = false): number {
	if (allowP2P && hosts <= 2) return 31;
	let prefix = 30;
	while (prefix > 0 && blockSize(prefix) - 2 < hosts) prefix--;
	return prefix;
}

export type Allocation = {
	/** Position in the list as given, from 0. */
	index: number;
	name: string;
	hosts: number;
	info: SubnetInfo;
	/** Usable addresses the block has that this requirement does not need. */
	spare: number;
};

export type VlsmPlan =
	| {
			ok: true;
			allocations: Allocation[];
			free: SubnetInfo[];
			used: number;
			total: number;
	  }
	| {
			ok: false;
			needed: number;
			total: number;
			/** The longest base prefix that would hold the plan, or null if nothing would. */
			fitsIn: number | null;
			/** Each requirement's block size, largest first, so the shortfall can be explained. */
			blocks: { name: string; hosts: number; prefix: number }[];
	  };

/**
 * Variable length subnet masking: give each requirement the smallest block
 * that holds it, then place the blocks largest first from the start of the
 * base network. Every block is a power of two and each one is no bigger than
 * the ones before it, so each starts at a multiple of its own size and is
 * aligned without any gaps. For the same reason the plan fits exactly when the
 * block sizes add up to no more than the base network.
 */
export function allocateVlsm(network: number, prefix: number, requirements: Requirement[], allowP2P = false): VlsmPlan {
	const total = blockSize(prefix);
	const blocks = requirements.map((r, index) => ({ ...r, index, prefix: prefixForHosts(r.hosts, allowP2P) }));
	// Stable sort: equal sizes stay in the order they were listed.
	const order = [...blocks].sort((a, b) => a.prefix - b.prefix || a.index - b.index);
	const needed = order.reduce((sum, b) => sum + blockSize(b.prefix), 0);
	if (needed > total) {
		let fitsIn: number | null = null;
		for (let p = 32; p >= 0; p--) {
			if (blockSize(p) >= needed) {
				fitsIn = p;
				break;
			}
		}
		return {
			ok: false,
			needed,
			total,
			fitsIn,
			blocks: order.map(({ name, hosts, prefix }) => ({ name, hosts, prefix }))
		};
	}
	let at = network;
	const allocations: Allocation[] = order.map((b) => {
		const info = subnetInfo(at, b.prefix);
		at += blockSize(b.prefix);
		return { index: b.index, name: b.name, hosts: b.hosts, info, spare: info.usable - b.hosts };
	});
	const end = network + total;
	const free = rangeToCidrs(at, end).map((c) => subnetInfo(c.network, c.prefix));
	return { ok: true, allocations, free, used: needed, total };
}

/** Bits needed to split into at least `count` equal parts. */
export const bitsForCount = (count: number) => Math.ceil(Math.log2(Math.max(1, count)));

/** Splits a network into equal subnets of a longer prefix, listing at most `limit` of them. */
export function splitEqual(network: number, prefix: number, newPrefix: number, limit = 256) {
	if (newPrefix < prefix) {
		throw new IpError(
			`/${newPrefix} is bigger than the /${prefix} you are splitting; pick a prefix from /${prefix} to /32`
		);
	}
	if (newPrefix > 32) throw new IpError('A prefix length runs from /0 to /32');
	const count = 2 ** (newPrefix - prefix);
	const size = blockSize(newPrefix);
	const subnets = Array.from({ length: Math.min(count, limit) }, (_, i) => subnetInfo(network + i * size, newPrefix));
	return { count, size, subnets, borrowed: newPrefix - prefix };
}

/**
 * The addresses the same blocks would span if placed in the order given
 * instead of largest first, each still starting at a multiple of its size.
 * A small block placed first pushes the next larger one up to its next
 * boundary, and the gap in between is lost.
 */
export function spanInOrder(requirements: Requirement[], allowP2P = false): number {
	let at = 0;
	for (const r of requirements) {
		const size = blockSize(prefixForHosts(r.hosts, allowP2P));
		at = Math.ceil(at / size) * size + size;
	}
	return at;
}

/** For each prefix, the range of host counts it is the right size for. */
export function hostRangeTable(from = 16, to = 30) {
	return Array.from({ length: to - from + 1 }, (_, k) => {
		const prefix = to - k;
		return {
			prefix,
			addresses: blockSize(prefix),
			minHosts: prefix === 30 ? 1 : usableHosts(prefix + 1) + 1,
			maxHosts: usableHosts(prefix)
		};
	});
}
