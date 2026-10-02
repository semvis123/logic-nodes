// IPv6 addresses: parsing every way people write them, the fully expanded
// form, the one canonical short form RFC 5952 asks for, what kind of address
// it is, the prefix arithmetic and the EUI-64 interface identifier made from
// a MAC address.
//
// An address is kept as eight 16-bit numbers (hextets) rather than as a
// string, so expanding and compressing are both just ways of printing the
// same 128 bits. Every rule is applied by hand, step by step, so the page can
// say which rule changed what; the tests check the results against the URL
// parser built into JavaScript and a second implementation written with
// strings.

export class IPv6Error extends Error {}

/** Eight 16-bit groups, the first being the most significant. */
export type Hextets = number[];

/** Where each of the eight groups came from in what was typed. */
export type GroupSource = 'typed' | 'gap' | 'ipv4';

export type ParsedIPv6 = {
	hextets: Hextets;
	value: bigint;
	/** The address part exactly as typed, without brackets, zone, prefix or port. */
	address: string;
	/** For each group: the text typed for it, or '' if :: or an IPv4 tail supplied it. */
	typed: string[];
	source: GroupSource[];
	/** The dotted IPv4 tail as typed, if there was one. */
	ipv4Tail: string | null;
	prefix: number | null;
	zone: string | null;
	/** A port after [address]: is accepted and reported, since URLs write it that way. */
	port: number | null;
	/** Where the :: sat, counted in groups, and how many zero groups it stood for. */
	gap: { at: number; length: number } | null;
};

export const hex4 = (h: number) => h.toString(16).padStart(4, '0');
export const bits16 = (h: number) => h.toString(2).padStart(16, '0');

export function toBigInt(hextets: Hextets): bigint {
	return hextets.reduce((acc, h) => (acc << 16n) | BigInt(h), 0n);
}

export function fromBigInt(value: bigint): Hextets {
	return Array.from({ length: 8 }, (_, i) => Number((value >> BigInt(112 - 16 * i)) & 0xffffn));
}

/** The 128 bits as a string of 0s and 1s, most significant first. */
export const allBits = (hextets: Hextets) => hextets.map(bits16).join('');

const IPV4_PART = /^(0|[1-9][0-9]{0,2})$/;

/** Parses a dotted IPv4 address strictly: four decimal numbers 0 to 255, no leading zeros. */
export function parseIPv4(text: string): number[] | null {
	const parts = text.split('.');
	if (parts.length !== 4 || !parts.every((p) => IPV4_PART.test(p))) return null;
	const bytes = parts.map(Number);
	return bytes.every((b) => b <= 255) ? bytes : null;
}

export const formatIPv4 = (bytes: number[]) => bytes.join('.');

/** The IPv4 address in two hextets, as it sits in the low 32 bits of a mapped or NAT64 address. */
export const ipv4FromHextets = (high: number, low: number) => [high >> 8, high & 0xff, low >> 8, low & 0xff];

const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;

/** Checks one group and says precisely what is wrong with it. */
function checkGroup(group: string, n: number) {
	if (HEX_GROUP.test(group)) return;
	const bad = [...group].find((ch) => !/[0-9a-fA-F]/.test(ch));
	if (bad !== undefined)
		throw new IPv6Error(`"${bad}" is not a hex digit (0 to 9, a to f), in group ${n}, "${group}".`);
	throw new IPv6Error(
		`Group ${n}, "${group}", has ${group.length} hex digits. A group holds at most 4, which is 16 bits.`
	);
}

/** Up to 2 + 6 + 4 + 45 and change: generous for anything a person pastes, small enough to be safe. */
export const MAX_INPUT = 120;

/**
 * Reads an IPv6 address the way people paste it: any case, with or without
 * leading zeros and ::, with an IPv4 tail, a zone (%eth0), a prefix length
 * (/64) and square brackets with a port ([2001:db8::1]:443).
 */
export function parseIPv6(input: string): ParsedIPv6 {
	let text = input.trim();
	if (!text) throw new IPv6Error('Type an IPv6 address, such as 2001:db8::1.');
	if (text.length > MAX_INPUT)
		throw new IPv6Error(`That is longer than ${MAX_INPUT} characters, too long for an address.`);
	if (/\s/.test(text)) throw new IPv6Error('An address has no spaces in it.');

	let port: number | null = null;
	let prefixText: string | null = null;
	const bracketed = text.startsWith('[');
	if (bracketed) {
		const close = text.indexOf(']');
		if (close < 0) throw new IPv6Error('There is a [ with no ] to close it.');
		const after = text.slice(close + 1);
		text = text.slice(1, close);
		if (after) {
			const m = /^:(\d{1,5})$/.exec(after);
			if (!m || Number(m[1]) > 65535) {
				throw new IPv6Error(`After the ] only a port can follow, written like :443 (0 to 65535), not "${after}".`);
			}
			port = Number(m[1]);
		}
	} else if (text.includes(']')) {
		throw new IPv6Error('There is a ] with no [ before it.');
	}

	const slash = text.indexOf('/');
	if (slash >= 0) {
		prefixText = text.slice(slash + 1);
		text = text.slice(0, slash);
		if (prefixText.includes('%')) {
			const [len, zoneId] = prefixText.split('%');
			throw new IPv6Error(
				`The zone goes before the prefix length: write ${text}%${zoneId}/${len}, not ${text}/${prefixText}.`
			);
		}
		if (!/^\d{1,3}$/.test(prefixText) || Number(prefixText) > 128) {
			throw new IPv6Error(`The prefix length after / must be a whole number from 0 to 128, not "${prefixText}".`);
		}
	}

	let zone: string | null = null;
	const percent = text.indexOf('%');
	if (percent >= 0) {
		zone = text.slice(percent + 1);
		text = text.slice(0, percent);
		// In a URL the % itself has to be escaped, so RFC 6874 writes the zone of
		// [fe80::1%eth0] as [fe80::1%25eth0]. Inside brackets, read it that way.
		if (bracketed && zone.startsWith('25') && zone.length > 2) zone = zone.slice(2);
		if (!zone) throw new IPv6Error('Nothing follows the %. A zone ID names an interface, such as %eth0 or %3.');
		if (!/^[\w.~-]+$/.test(zone)) throw new IPv6Error(`"${zone}" is not a zone ID: use letters, digits, ., _, ~ or -.`);
	}

	const address = text;
	if (!address) throw new IPv6Error('There is no address before the prefix or zone.');
	if (parseIPv4(address)) {
		throw new IPv6Error(
			`${address} is an IPv4 address. Its IPv4-mapped IPv6 form is ::ffff:${address}, which this page can show.`
		);
	}
	if (!address.includes(':')) {
		throw new IPv6Error('An IPv6 address needs colons between its groups, such as 2001:db8::1.');
	}
	if (address.includes(':::')) throw new IPv6Error('Three colons in a row. The shorthand for zero groups is two: ::.');
	const doubles = address.split('::').length - 1;
	if (doubles > 1) {
		throw new IPv6Error(
			':: appears twice. It may be used only once, or there would be no telling how many zero groups each one stands for.'
		);
	}
	if (address.startsWith(':') && !address.startsWith('::')) {
		throw new IPv6Error('The address starts with a single colon. Leading zero groups are written ::, not :.');
	}
	if (address.endsWith(':') && !address.endsWith('::')) {
		throw new IPv6Error('The address ends with a single colon. Trailing zero groups are written ::, not :.');
	}

	const [head, tail] = doubles ? address.split('::') : [address, null];
	const headGroups = head ? head.split(':') : [];
	const tailGroups = tail ? tail.split(':') : [];
	const written = [...headGroups, ...(tail === null ? [] : tailGroups)];

	// An IPv4 tail stands for the last two groups, so it may only come last.
	let ipv4Tail: string | null = null;
	written.forEach((g, i) => {
		if (!g.includes('.')) return;
		if (i !== written.length - 1 || (tail !== null && tailGroups.length === 0)) {
			throw new IPv6Error(
				`"${g}" looks like an IPv4 address, but a dotted IPv4 part can only be the very end of the address, where it stands for the last two groups.`
			);
		}
		if (!parseIPv4(g)) {
			throw new IPv6Error(`"${g}" is not a valid IPv4 tail: it needs four numbers from 0 to 255 separated by dots.`);
		}
		ipv4Tail = g;
	});
	const count = written.length + (ipv4Tail ? 1 : 0);
	// Validate each hex group, numbered by its place in the address: after a ::
	// the groups belong at the end, so they are counted back from group 8. If
	// there are too many groups for that to make sense, the order written is all
	// there is to go on.
	const tailStart = tail !== null && count < 8 ? 8 - (tailGroups.length + (ipv4Tail ? 1 : 0)) : headGroups.length;
	written.forEach((g, i) => {
		if (g === ipv4Tail && i === written.length - 1) return;
		if (g === '') throw new IPv6Error('Two colons in a row inside the address, where a group was expected.');
		checkGroup(g, i < headGroups.length ? i + 1 : tailStart + (i - headGroups.length) + 1);
	});

	const tailNote = ipv4Tail ? ' (counting the IPv4 tail as two)' : '';
	if (tail === null) {
		if (count < 8) {
			throw new IPv6Error(
				`Only ${count} groups${tailNote}, and no :: to stand for the missing ${8 - count}. An address has 8 groups.`
			);
		}
		if (count > 8) throw new IPv6Error(`${count} groups${tailNote}: an IPv6 address has exactly 8, which is 128 bits.`);
	} else if (count >= 8) {
		throw new IPv6Error(
			count === 8
				? `All 8 groups are already written${tailNote}, so the :: has nothing to stand for: it must replace at least one zero group.`
				: `${count} groups${tailNote} as well as ::, but an address has only 8.`
		);
	}

	const hextets: Hextets = [];
	const typed: string[] = [];
	const source: GroupSource[] = [];
	const pushWritten = (groups: string[]) => {
		for (const g of groups) {
			if (g === ipv4Tail) {
				const b = parseIPv4(g) as number[];
				hextets.push((b[0] << 8) | b[1], (b[2] << 8) | b[3]);
				typed.push('', '');
				source.push('ipv4', 'ipv4');
			} else {
				hextets.push(parseInt(g, 16));
				typed.push(g);
				source.push('typed');
			}
		}
	};
	let gap: ParsedIPv6['gap'] = null;
	pushWritten(headGroups);
	if (tail !== null) {
		gap = { at: hextets.length, length: 8 - count };
		for (let i = 0; i < gap.length; i++) {
			hextets.push(0);
			typed.push('');
			source.push('gap');
		}
		pushWritten(tailGroups);
	}

	return {
		hextets,
		value: toBigInt(hextets),
		address,
		typed,
		source,
		ipv4Tail,
		prefix: prefixText === null ? null : Number(prefixText),
		zone,
		port,
		gap
	};
}

/** Every group written out as four lower case hex digits. */
export const expand = (hextets: Hextets) => hextets.map(hex4).join(':');

/**
 * True for ::ffff:0:0/96, the IPv4-mapped range. RFC 5952 section 5 recommends
 * the dotted tail for addresses known to carry an IPv4 address; this tool
 * writes it only for mapped addresses, which every reader recognises, and
 * keeps the others (NAT64, for one) in hex, as inet_ntop and the URL parser
 * do. The embedded IPv4 address of those is shown separately by describe().
 */
export const isIPv4Mapped = (h: Hextets) => h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff;

export type ZeroRun = { start: number; length: number };

/** The runs of consecutive zero groups, in order, including runs of one. */
export function zeroRuns(groups: Hextets): ZeroRun[] {
	const runs: ZeroRun[] = [];
	for (let i = 0; i < groups.length; i++) {
		if (groups[i] !== 0) continue;
		const start = i;
		while (i + 1 < groups.length && groups[i + 1] === 0) i++;
		runs.push({ start, length: i - start + 1 });
	}
	return runs;
}

export type Compression = {
	/** The canonical text. */
	text: string;
	/** Each of the groups that are printed in hex, without leading zeros. */
	groups: string[];
	/** Runs of zeros among the hex groups (the first six for an IPv4-mapped address). */
	runs: ZeroRun[];
	/** The run that became ::, or null. */
	chosen: ZeroRun | null;
	/** Another run as long as the chosen one, passed over because it came later. */
	tiedWith: ZeroRun | null;
	/** Every later run as long as the chosen one (up to two, in 0:0:1:0:0:1:0:0). */
	ties: ZeroRun[];
	mapped: boolean;
	/** The dotted tail of a mapped address. */
	ipv4: string | null;
};

/**
 * The RFC 5952 canonical form: lower case, no leading zeros, the longest run
 * of two or more zero groups replaced by :: (the first one if two are equally
 * long), a lone zero group left as 0, and an IPv4-mapped address written with
 * its dotted IPv4 tail.
 */
export function compress(hextets: Hextets): Compression {
	const mapped = isIPv4Mapped(hextets);
	const hexPart = mapped ? hextets.slice(0, 6) : hextets;
	const groups = hexPart.map((h) => h.toString(16));
	const runs = zeroRuns(hexPart);
	let chosen: ZeroRun | null = null;
	let ties: ZeroRun[] = [];
	for (const run of runs) {
		if (run.length < 2) continue;
		// Strictly longer only: on a tie the earlier run keeps its place.
		if (!chosen || run.length > chosen.length) {
			chosen = run;
			ties = [];
		} else if (run.length === chosen.length) {
			ties.push(run);
		}
	}
	const tiedWith = ties[0] ?? null;
	const ipv4 = mapped ? formatIPv4(ipv4FromHextets(hextets[6], hextets[7])) : null;
	let text: string;
	if (chosen) {
		const before = groups.slice(0, chosen.start).join(':');
		const after = groups.slice(chosen.start + chosen.length);
		if (ipv4) after.push(ipv4);
		text = `${before}::${after.join(':')}`;
	} else {
		text = [...groups, ...(ipv4 ? [ipv4] : [])].join(':');
	}
	return { text, groups, runs, chosen, tiedWith, ties, mapped, ipv4 };
}

export const compressText = (hextets: Hextets) => compress(hextets).text;

/** The canonical form of whatever is typed, or null if it does not parse. */
export function canonical(input: string): string | null {
	try {
		return compressText(parseIPv6(input).hextets);
	} catch {
		return null;
	}
}

/** "group 3" or "groups 3 to 5", counted from 1 the way people count. */
export const groupRange = (run: ZeroRun) =>
	run.length === 1 ? `group ${run.start + 1}` : `groups ${run.start + 1} to ${run.start + run.length}`;

/** "a", "a and b", "a, b and c". */
const listAnd = (items: string[]) =>
	items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** True when the :: as typed is not the run of zeros the canonical form shortens. */
const gapMoved = (parsed: ParsedIPv6, chosen: ZeroRun | null) =>
	!!parsed.gap && (!chosen || parsed.gap.at !== chosen.start || parsed.gap.length !== chosen.length);

/** True when the :: as typed sat inside the chosen run but did not cover all of it. */
const gapTooShort = (parsed: ParsedIPv6, chosen: ZeroRun | null) =>
	!!parsed.gap &&
	!!chosen &&
	gapMoved(parsed, chosen) &&
	parsed.gap.at >= chosen.start &&
	parsed.gap.at + parsed.gap.length <= chosen.start + chosen.length;

/** The groups whose leading zeros go, as typed and as written; a mapped tail is written in dotted form instead. */
function trimmedGroups(parsed: ParsedIPv6, mapped: boolean) {
	return parsed.typed
		.map((g, i) => ({ g, i, short: parsed.hextets[i].toString(16) }))
		.filter(({ g, i, short }) => g !== '' && g.toLowerCase() !== short && !(mapped && i >= 6));
}

export type Step = { rule: string; changed: boolean; detail: string };

/**
 * The RFC 5952 rules in order, each saying what it did to this address, so
 * the page can explain the canonical form rather than just print it.
 */
export function explain(parsed: ParsedIPv6): Step[] {
	const c = compress(parsed.hextets);
	const steps: Step[] = [];

	if (parsed.gap) {
		steps.push({
			rule: 'Fill in the ::',
			changed: true,
			detail: `The :: stood for ${parsed.gap.length} zero group${parsed.gap.length === 1 ? '' : 's'} (${groupRange({
				start: parsed.gap.at,
				length: parsed.gap.length
			})}), so the address is first read back to all 8.`
		});
	}
	if (parsed.ipv4Tail) {
		const [hi, lo] = parsed.hextets.slice(6).map(hex4);
		steps.push({
			rule: 'Read the IPv4 tail',
			changed: true,
			detail: `${parsed.ipv4Tail} is four bytes, so it fills the last two groups: ${hi}:${lo}.`
		});
	}

	const upper = parsed.typed.some((g) => /[A-F]/.test(g));
	steps.push({
		rule: 'Lower case (section 4.3)',
		changed: upper,
		detail: upper ? 'The letters a to f are written in lower case.' : 'Already lower case.'
	});

	const trimmed = trimmedGroups(parsed, c.mapped);
	steps.push({
		rule: 'Drop leading zeros (section 4.1)',
		changed: trimmed.length > 0,
		detail: trimmed.length
			? `${trimmed.map(({ g, short }) => `${g} → ${short}`).join(', ')}. A group of all zeros keeps one 0.`
			: 'No group has a leading zero to drop.'
	});

	const long = c.runs.filter((r) => r.length >= 2);
	let detail: string;
	if (!c.runs.length) detail = 'There are no zero groups, so there is nothing for :: to replace.';
	else if (!c.chosen)
		detail = `Only single zero groups (${c.runs
			.map(groupRange)
			.join(
				', '
			)}). One zero group stays as 0: :: would save just one character and look like more was hidden (section 4.2.2).`;
	else if (c.ties.length)
		detail = `${listAnd(
			[c.chosen, ...c.ties].map(groupRange)
		)} are equally long runs of zeros, so the first one becomes :: (section 4.2.3).`;
	else if (long.length > 1)
		detail = `The longest run of zeros, ${groupRange(
			c.chosen
		)}, becomes ::. Only one run may be shortened (section 4.2.3).`;
	else
		detail = `The run of zeros, ${groupRange(
			c.chosen
		)}, becomes ::, and it must: shorten as much as possible (section 4.2.1).`;
	if (parsed.gap && gapTooShort(parsed, c.chosen))
		detail += ` The :: as typed covered only ${groupRange({
			start: parsed.gap.at,
			length: parsed.gap.length
		})}; it must take in the whole run.`;
	else if (parsed.gap && c.chosen && gapMoved(parsed, c.chosen))
		detail += ` The :: as typed stood for ${groupRange({
			start: parsed.gap.at,
			length: parsed.gap.length
		})}, which is not the longest run.`;
	if (c.chosen && c.runs.some((r) => r.length === 1)) detail += ' Single zero groups elsewhere stay as 0.';
	steps.push({ rule: 'Replace the longest run of zeros with ::', changed: !!c.chosen, detail });

	if (c.mapped) {
		steps.push({
			rule: 'IPv4-mapped tail (section 5)',
			changed: true,
			detail: `The address is in the IPv4-mapped range, ${MAPPED_RANGE}, so its last 32 bits are written as the IPv4 address ${c.ipv4}.`
		});
	}
	return steps;
}

/**
 * One line saying why the canonical form differs from what was typed, for the
 * table of examples: the same rules as explain(), in a few words each.
 */
export function summarise(parsed: ParsedIPv6): string {
	const c = compress(parsed.hextets);
	const parts: string[] = [];
	if (parsed.typed.some((g) => /[A-F]/.test(g))) parts.push('letters in lower case');
	if (trimmedGroups(parsed, c.mapped).length) parts.push('leading zeros dropped');
	// A :: typed exactly where the canonical form puts it changed nothing.
	const typedRight = !!c.chosen && !!parsed.gap && !gapMoved(parsed, c.chosen);
	if (c.chosen && !typedRight) {
		if (c.ties.length)
			parts.push(
				`${c.ties.length + 1} runs of ${c.chosen.length} zero groups tie, so the first, ${groupRange(
					c.chosen
				)}, becomes ::`
			);
		else if (gapTooShort(parsed, c.chosen))
			parts.push(`the :: did not cover the whole run of zeros, so it grows to ${groupRange(c.chosen)} (section 4.2.1)`);
		else if (c.runs.some((r) => r !== c.chosen && r.length >= 2))
			parts.push(`the longer run, ${groupRange(c.chosen)}, becomes ::`);
		else parts.push(`${groupRange(c.chosen)} become ::`);
	} else if (!c.chosen && parsed.gap) parts.push('a single zero group is written 0, not :: (section 4.2.2)');
	else if (!c.chosen && c.runs.length) parts.push('a single zero group stays 0');
	if (c.mapped && !parsed.ipv4Tail) parts.push(`the last 32 bits are written as the IPv4 address ${c.ipv4}`);
	if (!parts.length) return 'Already canonical';
	const text = listAnd(parts);
	return text[0].toUpperCase() + text.slice(1);
}

// --- prefixes ------------------------------------------------------------------

const ALL_ONES = (1n << 128n) - 1n;

export const maskOf = (prefix: number) => (prefix === 0 ? 0n : (ALL_ONES << BigInt(128 - prefix)) & ALL_ONES);

export type PrefixInfo = {
	prefix: number;
	hostBits: number;
	mask: Hextets;
	network: Hextets;
	last: Hextets;
	/** 2^hostBits addresses. */
	count: bigint;
	/** How many /64 networks fit, or null when the prefix is longer than /64. */
	subnets64: bigint | null;
	/** True when the typed address had bits set after the prefix. */
	hostPartSet: boolean;
};

export function prefixInfo(value: bigint, prefix: number): PrefixInfo {
	const mask = maskOf(prefix);
	const network = value & mask;
	const last = network | (ALL_ONES ^ mask);
	return {
		prefix,
		hostBits: 128 - prefix,
		mask: fromBigInt(mask),
		network: fromBigInt(network),
		last: fromBigInt(last),
		count: 1n << BigInt(128 - prefix),
		subnets64: prefix <= 64 ? 1n << BigInt(64 - prefix) : null,
		hostPartSet: network !== value
	};
}

// --- address types ------------------------------------------------------------

export type TypeId =
	| 'unspecified'
	| 'loopback'
	| 'mapped'
	| 'nat64'
	| 'teredo'
	| 'documentation'
	| 'sixtofour'
	| 'linklocal'
	| 'sitelocal'
	| 'ula'
	| 'multicast'
	| 'global'
	| 'other';

/**
 * The IPv4-mapped range in canonical form. The IANA registry writes it
 * ::ffff:0:0/96; RFC 5952 puts the dotted tail on every mapped address, the
 * all-zero one included, so this page writes it that way throughout.
 */
export const MAPPED_RANGE = '::ffff:0.0.0.0/96';

export type AddressTypeDef = { id: TypeId; name: string; range: string; rfc: string; example: string; about: string };

// Most specific first: the first range that matches names the address.
export const ADDRESS_TYPES: AddressTypeDef[] = [
	{
		id: 'unspecified',
		name: 'Unspecified',
		range: '::/128',
		rfc: 'RFC 4291',
		example: '::',
		about:
			'All zeros: no address at all. A host uses it as its source before it has an address, and a server listening on :: accepts connections to any of its addresses.'
	},
	{
		id: 'loopback',
		name: 'Loopback',
		range: '::1/128',
		rfc: 'RFC 4291',
		example: '::1',
		about: 'The machine itself, like 127.0.0.1 in IPv4. Packets sent to it never leave the host.'
	},
	{
		id: 'mapped',
		name: 'IPv4-mapped',
		range: MAPPED_RANGE,
		rfc: 'RFC 4291',
		example: '::ffff:192.0.2.1',
		about:
			'An IPv4 address in IPv6 clothing, so one IPv6 socket can serve IPv4 clients too: the IPv4 client 192.0.2.1 shows up as ::ffff:192.0.2.1. The last 32 bits are the IPv4 address.'
	},
	{
		id: 'nat64',
		name: 'NAT64 well-known prefix',
		range: '64:ff9b::/96',
		rfc: 'RFC 6052',
		example: '64:ff9b::c000:221',
		about:
			'Lets an IPv6-only host reach an IPv4 server through a NAT64 translator. The last 32 bits are the IPv4 address it stands for.'
	},
	{
		id: 'teredo',
		name: 'Teredo',
		range: '2001::/32',
		rfc: 'RFC 4380',
		example: '2001:0:4136:e378:8000:63bf:3fff:fdd2',
		about:
			"Teredo tunnelled IPv6 over UDP through IPv4 NAT. The next 32 bits are the Teredo server's IPv4 address; the last 48 bits are the client's public port and IPv4 address with every bit inverted."
	},
	{
		id: 'documentation',
		name: 'Documentation',
		range: '2001:db8::/32',
		rfc: 'RFC 3849',
		example: '2001:db8::1',
		about:
			'Reserved for examples in books, manuals and RFCs, like 192.0.2.0/24 in IPv4, so an example can never be someone’s real address. It is never routed.'
	},
	{
		id: 'sixtofour',
		name: '6to4',
		range: '2002::/16',
		rfc: 'RFC 3056',
		example: '2002:c000:204::1',
		about:
			'6to4 tunnelling gave every public IPv4 address its own /48: the 32 bits after 2002 are the IPv4 address of the site’s tunnel end.'
	},
	{
		id: 'linklocal',
		name: 'Link-local unicast',
		range: 'fe80::/10',
		rfc: 'RFC 4291',
		example: 'fe80::1',
		about:
			'Valid only on one link, such as one Ethernet segment or Wi-Fi network; routers never forward it. Every IPv6 interface has one, and since every interface is on fe80::/64, a zone ID such as %eth0 says which link is meant.'
	},
	{
		id: 'sitelocal',
		name: 'Site-local (deprecated)',
		range: 'fec0::/10',
		rfc: 'RFC 3879',
		example: 'fec0::1',
		about:
			'The original private range, deprecated because "site" was never well defined. Unique local addresses replaced it.'
	},
	{
		id: 'ula',
		name: 'Unique local',
		range: 'fc00::/7',
		rfc: 'RFC 4193',
		example: 'fd12:3456:789a::1',
		about:
			'Private addresses, the IPv6 counterpart of 10.0.0.0/8. Not routed on the internet. In practice they start fd, followed by a random 40-bit global ID so that two private networks are unlikely to clash when joined.'
	},
	{
		id: 'multicast',
		name: 'Multicast',
		range: 'ff00::/8',
		rfc: 'RFC 4291',
		example: 'ff02::1',
		about:
			'One to many: a packet sent to a multicast group reaches every interface that has joined it. IPv6 has no broadcast; it uses multicast groups such as ff02::1 (every node on the link) instead.'
	},
	{
		id: 'global',
		name: 'Global unicast',
		range: '2000::/3',
		rfc: 'RFC 4291',
		example: '2606:4700:4700::1111',
		about:
			'An ordinary public address, routed on the internet. Every address from 2000:: to 3fff:ffff:… is in this range; a network usually gets a /48 or /56 and splits it into /64s.'
	}
];

export const OTHER_TYPE: AddressTypeDef = {
	id: 'other',
	name: 'Reserved or unassigned',
	range: '',
	rfc: 'IANA registry',
	example: '',
	about:
		'Not in any special range or in 2000::/3. Most IPv6 space outside 2000::/3 is reserved by the IETF and not handed out.'
};

const parsedRanges = ADDRESS_TYPES.map((t) => {
	const p = parseIPv6(t.range);
	return { def: t, value: p.value, prefix: p.prefix as number };
});

export const inRange = (value: bigint, rangeValue: bigint, prefix: number) =>
	(value & maskOf(prefix)) === (rangeValue & maskOf(prefix));

export function addressType(value: bigint): AddressTypeDef {
	return parsedRanges.find((r) => inRange(value, r.value, r.prefix))?.def ?? OTHER_TYPE;
}

/** Multicast scope, the fourth hex digit of ffXY:: (RFC 4291 and RFC 7346). */
export const MULTICAST_SCOPES: Record<number, string> = {
	0x0: 'reserved',
	0x1: 'interface-local',
	0x2: 'link-local',
	0x3: 'realm-local',
	0x4: 'admin-local',
	0x5: 'site-local',
	0x8: 'organisation-local',
	0xe: 'global',
	0xf: 'reserved'
};

/** A few multicast groups worth recognising by name. */
const KNOWN_GROUPS: { address: string; name: string }[] = [
	{ address: 'ff02::1', name: 'all nodes on the link' },
	{ address: 'ff02::2', name: 'all routers on the link' },
	{ address: 'ff02::fb', name: 'multicast DNS (mDNS)' },
	{ address: 'ff02::1:2', name: 'all DHCPv6 relay agents and servers' }
];
const knownGroupValues = KNOWN_GROUPS.map((g) => ({ ...g, value: parseIPv6(g.address).value }));
const solicitedNode = parseIPv6('ff02::1:ff00:0').value;

export type Details = {
	type: AddressTypeDef;
	/** Extra facts about this particular address, each one line. */
	notes: string[];
	/** An IPv4 address carried inside, if the type has one. */
	embeddedIPv4: string | null;
};

const v4 = (high: number, low: number) => formatIPv4(ipv4FromHextets(high, low));

export function describe(hextets: Hextets): Details {
	const value = toBigInt(hextets);
	const type = addressType(value);
	const notes: string[] = [];
	let embeddedIPv4: string | null = null;
	const h = hextets;
	switch (type.id) {
		case 'mapped':
		case 'nat64':
			embeddedIPv4 = v4(h[6], h[7]);
			notes.push(`Embedded IPv4 address: ${embeddedIPv4} (the last two groups, ${hex4(h[6])}:${hex4(h[7])}).`);
			break;
		case 'sixtofour':
			embeddedIPv4 = v4(h[1], h[2]);
			notes.push(`IPv4 address of the 6to4 site: ${embeddedIPv4} (groups 2 and 3, ${hex4(h[1])}:${hex4(h[2])}).`);
			break;
		case 'teredo': {
			const server = v4(h[2], h[3]);
			embeddedIPv4 = v4(h[6] ^ 0xffff, h[7] ^ 0xffff);
			const port = h[5] ^ 0xffff;
			notes.push(`Teredo server: ${server} (groups 3 and 4).`);
			notes.push(
				`Client: ${embeddedIPv4}, port ${port}. Groups 7 and 8 and group 6 hold them with every bit inverted: ${hex4(
					h[6]
				)}:${hex4(h[7])} XOR ffff:ffff, and ${hex4(h[5])} XOR ffff.`
			);
			break;
		}
		case 'multicast': {
			const flags = (h[0] >> 4) & 0xf;
			const scope = h[0] & 0xf;
			notes.push(
				`Scope ${scope.toString(16)}: ${MULTICAST_SCOPES[scope] ?? 'unassigned'} (the fourth hex digit of ${hex4(
					h[0]
				)}).`
			);
			// The flags are 0RPT (RFC 4291, RFC 3306, RFC 3956); R needs P, and P needs T.
			const flagNotes = [
				flags & 1 ? 'a transient group, not permanently assigned by IANA (T bit)' : 'a permanent, IANA-assigned group'
			];
			if (flags & 2) flagNotes.push('its address is built from a unicast prefix (P bit, RFC 3306)');
			if (flags & 4) flagNotes.push('it carries the address of a rendezvous point (R bit, RFC 3956)');
			if (flags & 8) flagNotes.push('the reserved high bit is set');
			notes.push(`Flags ${flags.toString(16)}: ${flagNotes.join('; ')}.`);
			const known = knownGroupValues.find((g) => g.value === value);
			if (known) notes.push(`${known.address} is ${known.name}.`);
			if (inRange(value, solicitedNode, 104)) {
				notes.push(
					`A solicited-node group (ff02::1:ff00:0/104): neighbour discovery for the addresses ending in ${(
						h[7] |
						((h[6] & 0xff) << 16)
					)
						.toString(16)
						.padStart(6, '0')} (the last 24 bits).`
				);
			}
			break;
		}
		case 'linklocal':
			notes.push('Needs a zone ID, such as fe80::1%eth0, when used on a host with more than one interface.');
			break;
		case 'ula':
			if (h[0] >> 8 === 0xfd) {
				notes.push(
					`Global ID ${(h[0] & 0xff).toString(16).padStart(2, '0')}${hex4(h[1])}${hex4(h[2])} (40 bits), subnet ${hex4(
						h[3]
					)}.`
				);
			} else {
				notes.push(
					'fc00::/8, the half of the range with the L bit 0, is left for a future definition (RFC 4193); addresses in use start fd.'
				);
			}
			break;
	}
	return { type, notes, embeddedIPv4 };
}

// --- EUI-64 ---------------------------------------------------------------------

/** Reads a 48-bit MAC address in any of the usual notations. */
export function parseMac(input: string): number[] {
	const text = input.trim();
	if (!text) throw new IPv6Error('Type a MAC address, such as 00:1a:2b:3c:4d:5e.');
	let digits: string;
	if (/^[0-9a-f]{12}$/i.test(text)) digits = text;
	else if (/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(text)) digits = text.replace(/\./g, '');
	else if (/^([0-9a-f]{1,2})([:-][0-9a-f]{1,2}){5}$/i.test(text)) {
		digits = text
			.split(/[:-]/)
			.map((b) => b.padStart(2, '0'))
			.join('');
	} else {
		// Not one of the accepted shapes: say which part is wrong rather than
		// guessing what was meant from whatever hex digits are there.
		const bad = [...text].find((ch) => !/[0-9a-f:.-]/i.test(ch));
		if (bad !== undefined) throw new IPv6Error(`"${bad}" is not a hex digit. A MAC address is six bytes in hex.`);
		const sizeError = (n: number, unit: string) =>
			new IPv6Error(`A MAC address is 6 bytes, 12 hex digits, such as 00:1a:2b:3c:4d:5e; that has ${n} ${unit}.`);
		if (!/[:.-]/.test(text)) throw sizeError(text.length, text.length === 1 ? 'digit' : 'digits');
		if (text.includes('.')) {
			throw new IPv6Error('With dots, a MAC address is three groups of four hex digits, such as 001a.2b3c.4d5e.');
		}
		const fields = text.split(/[:-]/);
		if (fields.some((f) => f === '')) {
			throw new IPv6Error('Two separators in a row, or one at the start or end, where a byte was expected.');
		}
		const long = fields.find((f) => f.length > 2);
		if (long !== undefined) {
			throw new IPv6Error(`"${long}" has ${long.length} hex digits, but between : or - each byte is two.`);
		}
		throw sizeError(fields.length, fields.length === 1 ? 'byte' : 'bytes');
	}
	return Array.from({ length: 6 }, (_, i) => parseInt(digits.slice(2 * i, 2 * i + 2), 16));
}

export type Eui64 = {
	mac: number[];
	/** The MAC with ff:fe inserted in the middle, before the bit flip. */
	inserted: number[];
	/** After flipping the universal/local bit: the interface identifier. */
	identifier: number[];
	firstBefore: number;
	firstAfter: number;
	/** The MAC's own U/L bit: 0 means a globally unique, manufacturer-assigned address. */
	locallyAdministered: boolean;
	/** The I/G bit: a group (multicast) MAC is not a real interface address. */
	group: boolean;
	/** The identifier as four hextets, the low 64 bits of the address. */
	iid: Hextets;
	linkLocal: Hextets;
};

/** The universal/local bit: bit 1 of the first byte, the seventh from the left. */
export const UL_BIT = 0x02;

/**
 * Modified EUI-64 (RFC 4291 appendix A): split the MAC in half, put ff:fe in
 * the middle, and invert the universal/local bit, so that a hand-written
 * identifier such as ::1 counts as local without needing that bit set.
 */
export function eui64(mac: number[]): Eui64 {
	const inserted = [...mac.slice(0, 3), 0xff, 0xfe, ...mac.slice(3)];
	const identifier = [inserted[0] ^ UL_BIT, ...inserted.slice(1)];
	const iid = [0, 2, 4, 6].map((i) => (identifier[i] << 8) | identifier[i + 1]);
	return {
		mac,
		inserted,
		identifier,
		firstBefore: mac[0],
		firstAfter: identifier[0],
		locallyAdministered: (mac[0] & UL_BIT) !== 0,
		group: (mac[0] & 1) !== 0,
		iid,
		linkLocal: [0xfe80, 0, 0, 0, ...iid]
	};
}

export const formatMac = (mac: number[]) => mac.map((b) => b.toString(16).padStart(2, '0')).join(':');
export const bin8 = (b: number) => b.toString(2).padStart(8, '0');
