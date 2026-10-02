// C struct layout: where a compiler puts each member, how much padding it adds
// and why, for the common ABIs.
//
// A small parser for the part of C that describes data (struct and union
// definitions, typedefs, arrays, pointers, #pragma pack, the packed attribute
// and _Alignas), and a layout pass per target. Every size and alignment in the
// target tables below was read off clang 18 for that target triple, and the
// test suite checks the whole layout pass against more than forty structs whose
// layouts clang produced, on all five targets.
//
// Bit-fields are refused rather than guessed at: their packing rules differ
// between the System V ABIs and MSVC, and a wrong answer there is worse than
// none.

export class StructError extends Error {
	readonly line: number;
	readonly column: number;
	constructor(message: string, line = 0, column = 0) {
		super(line ? `Line ${line}, column ${column}: ${message}` : message);
		this.line = line;
		this.column = column;
	}
}

// --- targets ----------------------------------------------------------------

export type PrimName =
	| 'char'
	| 'signed char'
	| 'unsigned char'
	| 'short'
	| 'unsigned short'
	| 'int'
	| 'unsigned int'
	| 'long'
	| 'unsigned long'
	| 'long long'
	| 'unsigned long long'
	| 'float'
	| 'double'
	| 'long double'
	| '_Bool'
	| 'pointer'
	| 'wchar_t';

export type TargetId = 'x64' | 'win64' | 'i386' | 'arm32' | 'arm64';

export type Target = {
	id: TargetId;
	label: string;
	/** The clang target triple the numbers were checked against. */
	triple: string;
	/** The data model: which of int, long and pointers are 64 bits. */
	model: string;
	/**
	 * MSVC treats _Alignas as a floor that #pragma pack cannot lower; GCC and
	 * clang on the System V targets cap everything, explicit alignment
	 * included, at the pack value.
	 */
	msvc: boolean;
	/** Size and alignment inside a struct, in bytes. */
	types: Record<PrimName, [size: number, align: number]>;
};

// The integer types every target agrees on.
const COMMON: Pick<Target['types'], 'char' | 'signed char' | 'unsigned char' | '_Bool' | 'short' | 'unsigned short'> &
	Pick<Target['types'], 'int' | 'unsigned int' | 'float'> = {
	char: [1, 1],
	'signed char': [1, 1],
	'unsigned char': [1, 1],
	_Bool: [1, 1],
	short: [2, 2],
	'unsigned short': [2, 2],
	int: [4, 4],
	'unsigned int': [4, 4],
	float: [4, 4]
};

export const TARGETS: Target[] = [
	{
		id: 'x64',
		label: 'x86-64 Linux and macOS',
		triple: 'x86_64-linux-gnu',
		model: 'LP64',
		msvc: false,
		types: {
			...COMMON,
			long: [8, 8],
			'unsigned long': [8, 8],
			'long long': [8, 8],
			'unsigned long long': [8, 8],
			double: [8, 8],
			'long double': [16, 16],
			pointer: [8, 8],
			wchar_t: [4, 4]
		}
	},
	{
		id: 'win64',
		label: 'x86-64 Windows (MSVC)',
		triple: 'x86_64-pc-windows-msvc',
		model: 'LLP64',
		msvc: true,
		types: {
			...COMMON,
			long: [4, 4],
			'unsigned long': [4, 4],
			'long long': [8, 8],
			'unsigned long long': [8, 8],
			double: [8, 8],
			'long double': [8, 8],
			pointer: [8, 8],
			wchar_t: [2, 2]
		}
	},
	{
		id: 'i386',
		label: '32-bit x86 Linux',
		triple: 'i386-linux-gnu',
		model: 'ILP32',
		msvc: false,
		types: {
			...COMMON,
			long: [4, 4],
			'unsigned long': [4, 4],
			// The i386 System V ABI predates 8-byte loads mattering: inside a
			// struct, 8-byte types only get 4-byte alignment.
			'long long': [8, 4],
			'unsigned long long': [8, 4],
			double: [8, 4],
			'long double': [12, 4],
			pointer: [4, 4],
			wchar_t: [4, 4]
		}
	},
	{
		id: 'arm32',
		label: '32-bit ARM (AAPCS)',
		triple: 'armv7-linux-gnueabihf',
		model: 'ILP32',
		msvc: false,
		types: {
			...COMMON,
			long: [4, 4],
			'unsigned long': [4, 4],
			'long long': [8, 8],
			'unsigned long long': [8, 8],
			double: [8, 8],
			'long double': [8, 8],
			pointer: [4, 4],
			wchar_t: [4, 4]
		}
	},
	{
		id: 'arm64',
		label: 'AArch64 (64-bit ARM) Linux',
		triple: 'aarch64-linux-gnu',
		model: 'LP64',
		msvc: false,
		types: {
			...COMMON,
			long: [8, 8],
			'unsigned long': [8, 8],
			'long long': [8, 8],
			'unsigned long long': [8, 8],
			double: [8, 8],
			'long double': [16, 16],
			pointer: [8, 8],
			wchar_t: [4, 4]
		}
	}
];

export const TARGET_IDS = TARGETS.map((t) => t.id);

export const targetById = (id: TargetId): Target => TARGETS.find((t) => t.id === id) ?? TARGETS[0];

/**
 * Typedef names from the standard headers, as the basic type they stand for.
 * size_t and friends are pointer sized on every target here, so they map to
 * 'pointer' for their size; the fixed-width types map to the integer type
 * with that width, which carries the target's alignment for it (int64_t is
 * aligned to 4 inside an i386 struct, like long long).
 */
const BUILTIN_TYPEDEFS: Record<string, PrimName> = {
	size_t: 'pointer',
	ssize_t: 'pointer',
	ptrdiff_t: 'pointer',
	intptr_t: 'pointer',
	uintptr_t: 'pointer',
	int8_t: 'signed char',
	uint8_t: 'unsigned char',
	int16_t: 'short',
	uint16_t: 'unsigned short',
	int32_t: 'int',
	uint32_t: 'unsigned int',
	int64_t: 'long long',
	uint64_t: 'unsigned long long',
	int_least8_t: 'signed char',
	uint_least8_t: 'unsigned char',
	int_least16_t: 'short',
	uint_least16_t: 'unsigned short',
	int_least32_t: 'int',
	uint_least32_t: 'unsigned int',
	int_least64_t: 'long long',
	uint_least64_t: 'unsigned long long',
	wchar_t: 'wchar_t',
	char16_t: 'unsigned short',
	char32_t: 'unsigned int',
	bool: '_Bool',
	_Bool: '_Bool'
};

/** The basic types for the reference table, in reading order. */
export const REFERENCE_TYPES: { name: string; prim: PrimName }[] = [
	{ name: 'char', prim: 'char' },
	{ name: '_Bool / bool', prim: '_Bool' },
	{ name: 'short', prim: 'short' },
	{ name: 'int', prim: 'int' },
	{ name: 'long', prim: 'long' },
	{ name: 'long long', prim: 'long long' },
	{ name: 'float', prim: 'float' },
	{ name: 'double', prim: 'double' },
	{ name: 'long double', prim: 'long double' },
	{ name: 'pointer, size_t', prim: 'pointer' },
	{ name: 'int64_t', prim: 'long long' },
	{ name: 'wchar_t', prim: 'wchar_t' }
];

// --- the parsed form ---------------------------------------------------------

export type TypeRef =
	| { kind: 'prim'; prim: PrimName; text: string }
	| { kind: 'pointer'; to: TypeRef }
	| { kind: 'function'; text: string }
	| { kind: 'array'; of: TypeRef; count: number | null }
	| { kind: 'record'; record: RecordDef }
	| { kind: 'void' };

/** _Alignas(8) or _Alignas(double): the type form is resolved per target. */
export type AlignSpec = { value: number } | { type: TypeRef };

export type MemberDef = {
	/** Null for an anonymous struct or union member. */
	name: string | null;
	type: TypeRef;
	alignas: AlignSpec[];
	line: number;
	column: number;
	/** The declaration as written, one declarator only, for the reordered code. */
	code: string;
};

export type RecordDef = {
	kind: 'struct' | 'union';
	tag: string | null;
	/** The name a typedef gave it, if any, used when the tag is missing. */
	typedefName: string | null;
	members: MemberDef[];
	/** __attribute__((packed)) on the definition. */
	packed: boolean;
	/** The #pragma pack value in force where it was defined. */
	pack: number | null;
	complete: boolean;
	line: number;
	column: number;
	/** Text before the members and after them, to rebuild the definition. */
	open: string;
	close: string;
};

export type Program = {
	/** The record to lay out: the last one defined at the top level. */
	main: RecordDef;
	records: RecordDef[];
};

// --- tokens --------------------------------------------------------------------

type Token = {
	type: 'id' | 'num' | 'punct' | 'directive' | 'eof';
	value: string;
	line: number;
	column: number;
	start: number;
	end: number;
};

export const MAX_SOURCE = 4000;

/** Comments become spaces, keeping every offset and line number intact. */
function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?(\*\/|$)|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

function tokenize(source: string): Token[] {
	const src = stripComments(source);
	const tokens: Token[] = [];
	let i = 0;
	let line = 1;
	let lineStart = 0;
	let atLineStart = true;
	while (i < src.length) {
		const ch = src[i];
		if (ch === '\n') {
			i++;
			line++;
			lineStart = i;
			atLineStart = true;
			continue;
		}
		if (/\s/.test(ch)) {
			i++;
			continue;
		}
		const column = i - lineStart + 1;
		if (ch === '#') {
			if (!atLineStart) throw new StructError('A # is only expected at the start of a line', line, column);
			let end = src.indexOf('\n', i);
			if (end < 0) end = src.length;
			tokens.push({ type: 'directive', value: src.slice(i + 1, end).trim(), line, column, start: i, end });
			i = end;
			continue;
		}
		atLineStart = false;
		const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
		if (id) {
			tokens.push({ type: 'id', value: id[0], line, column, start: i, end: i + id[0].length });
			i += id[0].length;
			continue;
		}
		const num = /^(0[xX][0-9A-Fa-f]+|\d+)[uUlL]*/.exec(src.slice(i));
		if (num) {
			tokens.push({ type: 'num', value: num[0], line, column, start: i, end: i + num[0].length });
			i += num[0].length;
			continue;
		}
		if ('{}[]();,*:='.includes(ch)) {
			tokens.push({ type: 'punct', value: ch, line, column, start: i, end: i + 1 });
			i++;
			continue;
		}
		throw new StructError(`Unexpected character "${ch}"`, line, column);
	}
	tokens.push({ type: 'eof', value: '', line, column: i - lineStart + 1, start: i, end: i });
	return tokens;
}

// --- parser --------------------------------------------------------------------

const TYPE_WORDS = new Set(['signed', 'unsigned', 'short', 'long', 'int', 'char', 'float', 'double', 'void']);
const QUALIFIERS = new Set(['const', 'volatile', 'restrict', '__restrict', 'register']);
const ALIGNAS = new Set(['_Alignas', 'alignas']);
const PACK_VALUES = [1, 2, 4, 8, 16];
const MAX_ALIGN = 4096;

/** Collapses runs of whitespace, so a declaration copies as one tidy line. */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

class Parser {
	private pos = 0;
	private readonly tokens: Token[];
	private readonly src: string;
	private readonly structTags = new Map<string, RecordDef>();
	private readonly unionTags = new Map<string, RecordDef>();
	private readonly typedefs = new Map<string, TypeRef>();
	private packStack: (number | null)[] = [];
	private pack: number | null = null;
	readonly records: RecordDef[] = [];
	private main: RecordDef | null = null;

	constructor(source: string) {
		this.src = stripComments(source);
		this.tokens = tokenize(source);
	}

	private get tok() {
		return this.tokens[this.pos];
	}

	private peek(n = 1) {
		return this.tokens[Math.min(this.pos + n, this.tokens.length - 1)];
	}

	private fail(message: string, token: Token = this.tok): never {
		throw new StructError(message, token.line, token.column);
	}

	private is(value: string, token = this.tok) {
		return (token.type === 'punct' || token.type === 'id') && token.value === value;
	}

	private expect(value: string, what = `"${value}"`): Token {
		if (!this.is(value)) {
			const found = this.tok.type === 'eof' ? 'the end of the input' : `"${this.tok.value}"`;
			this.fail(`Expected ${what} but found ${found}`);
		}
		return this.tokens[this.pos++];
	}

	parse(): Program {
		while (this.tok.type !== 'eof') {
			if (this.tok.type === 'directive') this.directive(this.tokens[this.pos++]);
			else this.topLevel();
		}
		if (!this.main)
			throw new StructError('Paste a struct or union definition, such as: struct point { int x; int y; };');
		return { main: this.main, records: this.records };
	}

	private directive(t: Token) {
		const text = t.value;
		if (/^(include|pragma\s+once\b|ifndef|endif|ifdef|if\b|else|define\s+[A-Za-z_]\w*\s*$)/.test(text)) return;
		const m = /^pragma\s+pack\s*\(\s*(?:(push|pop)\s*(?:,\s*(\w+))?|(\w+))?\s*\)\s*$/.exec(text);
		if (!m) {
			if (/^define\b/.test(text)) this.fail('Macros are not expanded here; write the values out in full', t);
			if (/^pragma\s+pack\b/.test(text))
				this.fail('Write #pragma pack as pack(n), pack(), pack(push, n) or pack(pop), with n of 1, 2, 4, 8 or 16', t);
			this.fail(`Only #pragma pack is understood, not #${text.split(/\s/)[0]}`, t);
		}
		const [, action, actionValue, plain] = m;
		const value = actionValue ?? plain;
		let n: number | null = null;
		if (value !== undefined) {
			n = Number(value);
			if (!PACK_VALUES.includes(n)) this.fail(`#pragma pack takes 1, 2, 4, 8 or 16, not ${value}`, t);
		}
		if (action === 'push') {
			this.packStack.push(this.pack);
			if (n !== null) this.pack = n;
		} else if (action === 'pop') {
			if (!this.packStack.length) this.fail('#pragma pack(pop) without a matching push', t);
			this.pack = this.packStack.pop() ?? null;
			if (n !== null) this.pack = n;
		} else {
			this.pack = n;
		}
	}

	private topLevel() {
		const start = this.tok;
		if (this.is(';')) {
			this.pos++;
			return;
		}
		const isTypedef = this.is('typedef');
		if (isTypedef) this.pos++;
		if (!isTypedef && !this.is('struct') && !this.is('union')) {
			if (this.is('enum')) this.fail('Enums are not supported; use int, which is their size on all these targets');
			this.fail('Expected a struct, union or typedef here');
		}
		const declStart = this.tok.start;
		const spec = this.specifiers(isTypedef ? start.start : declStart);
		if (spec.alignas.length) this.fail('_Alignas belongs on a member, not on a whole definition', start);
		if (isTypedef) {
			for (;;) {
				const d = this.declarator(spec.type);
				if (!d.name) this.fail('A typedef needs a name');
				if (d.type.kind === 'record' && !d.type.record.typedefName && d.type.record.tag === null)
					d.type.record.typedefName = d.name;
				this.typedefs.set(d.name, d.type);
				if (!this.is(',')) break;
				this.pos++;
			}
		} else {
			// struct s { ... } a, b; declares variables too; they do not matter here.
			while (!this.is(';') && this.tok.type !== 'eof') {
				this.declarator(spec.type);
				if (!this.is(',')) break;
				this.pos++;
			}
		}
		const semi = this.expect(';', 'a ";" after the definition');
		if (spec.defined) {
			// The main struct, so far: the closing text keeps whatever follows the
			// brace, such as a typedef name or the packed attribute.
			this.main = spec.defined;
			spec.defined.close = tidy(this.src.slice(spec.closeStart, semi.end));
		}
	}

	/**
	 * The type part of a declaration: keywords, a typedef name or a struct or
	 * union (named or defined right here), plus _Alignas and qualifiers.
	 */
	private specifiers(openStart: number): {
		type: TypeRef;
		alignas: AlignSpec[];
		defined: RecordDef | null;
		closeStart: number;
	} {
		const alignas: AlignSpec[] = [];
		const words: Token[] = [];
		let type: TypeRef | null = null;
		let defined: RecordDef | null = null;
		let closeStart = 0;
		for (;;) {
			const t = this.tok;
			if (t.type !== 'id') break;
			if (QUALIFIERS.has(t.value)) {
				this.pos++;
			} else if (ALIGNAS.has(t.value)) {
				alignas.push(this.alignasSpec());
			} else if (t.value === '__attribute__') {
				this.fail('Put __attribute__((packed)) right after the struct keyword or after its closing brace');
			} else if (t.value === 'enum') {
				this.fail('Enums are not supported; use int, which is their size on all these targets');
			} else if (t.value === 'static' || t.value === 'extern') {
				this.fail(`"${t.value}" has no place in a struct definition`);
			} else if (t.value === 'struct' || t.value === 'union') {
				if (type || words.length) this.fail('Two types in one declaration');
				const r = this.record(openStart);
				type = r.type;
				defined = r.defined;
				closeStart = r.closeStart;
			} else if (TYPE_WORDS.has(t.value) || t.value === '_Bool') {
				if (type) this.fail('Two types in one declaration');
				words.push(t);
				this.pos++;
			} else if (!type && !words.length && (this.typedefs.has(t.value) || t.value in BUILTIN_TYPEDEFS)) {
				this.pos++;
				const named = this.typedefs.get(t.value);
				// A typedef of a basic type keeps its own name for display: u8, not unsigned char.
				if (named?.kind === 'prim') type = { ...named, text: t.value };
				else type = named ?? { kind: 'prim', prim: BUILTIN_TYPEDEFS[t.value], text: t.value };
			} else {
				break;
			}
		}
		if (words.length) type = this.basicType(words);
		if (!type) {
			const t = this.tok;
			if (t.type === 'id') this.fail(`Unknown type "${t.value}"; define it above with a typedef or struct`);
			this.fail(t.type === 'eof' ? 'Unexpected end of input' : `Expected a type but found "${t.value}"`);
		}
		return { type, alignas, defined, closeStart };
	}

	/** Turns a run like "unsigned long int" into one of the basic types. */
	private basicType(words: Token[]): TypeRef {
		const count = (w: string) => words.filter((t) => t.value === w).length;
		const text = words.map((t) => t.value).join(' ');
		const bad = () => this.fail(`"${text}" is not a C type`, words[0]);
		const signed = count('signed');
		const unsigned = count('unsigned');
		const longs = count('long');
		const has = (w: string) => count(w) > 0;
		for (const w of ['signed', 'unsigned', 'short', 'int', 'char', 'float', 'double', 'void', '_Bool'])
			if (count(w) > 1) bad();
		if (signed && unsigned) bad();
		if (longs > 2) bad();
		const prim = (p: PrimName): TypeRef => ({ kind: 'prim', prim: p, text });
		const others = (allowed: string[]) => (words.every((t) => allowed.includes(t.value)) ? undefined : bad());
		if (has('void')) {
			others(['void']);
			return { kind: 'void' };
		}
		if (has('_Bool')) {
			others(['_Bool']);
			return prim('_Bool');
		}
		if (has('float')) {
			others(['float']);
			return prim('float');
		}
		if (has('double')) {
			others(['double', 'long']);
			if (longs > 1) bad();
			return prim(longs ? 'long double' : 'double');
		}
		if (has('char')) {
			others(['char', 'signed', 'unsigned']);
			return prim(signed ? 'signed char' : unsigned ? 'unsigned char' : 'char');
		}
		if (has('short')) {
			others(['short', 'int', 'signed', 'unsigned']);
			return prim(unsigned ? 'unsigned short' : 'short');
		}
		others(['int', 'long', 'signed', 'unsigned']);
		if (longs === 2) return prim(unsigned ? 'unsigned long long' : 'long long');
		if (longs === 1) return prim(unsigned ? 'unsigned long' : 'long');
		return prim(unsigned ? 'unsigned int' : 'int');
	}

	private alignasSpec(): AlignSpec {
		const kw = this.tok;
		this.pos++;
		this.expect('(', `"(" after ${kw.value}`);
		let spec: AlignSpec;
		if (this.tok.type === 'num') {
			const value = parseNumber(this.tok.value);
			if (value !== 0 && (value & (value - 1)) !== 0)
				this.fail(`${kw.value} needs a power of two, and ${value} is not one`);
			if (value > MAX_ALIGN) this.fail(`${kw.value} above ${MAX_ALIGN} is beyond what this tool lays out`);
			this.pos++;
			spec = { value };
		} else {
			const s = this.specifiers(this.tok.start);
			let type = s.type;
			while (this.is('*')) {
				this.pos++;
				type = { kind: 'pointer', to: type };
			}
			spec = { type };
		}
		this.expect(')', `")" to close ${kw.value}`);
		return spec;
	}

	private attributes(): boolean {
		let packed = false;
		while (this.is('__attribute__')) {
			const at = this.tok;
			this.pos++;
			this.expect('(', '"((" after __attribute__');
			this.expect('(', '"((" after __attribute__');
			for (;;) {
				const t = this.tok;
				if (t.value === 'packed' || t.value === '__packed__') {
					packed = true;
					this.pos++;
				} else if (t.type === 'id') {
					this.fail(
						`Only the packed attribute is understood, not "${t.value}"; for alignment, use _Alignas on a member`,
						t
					);
				} else {
					this.fail('Expected an attribute name such as packed', at);
				}
				if (!this.is(',')) break;
				this.pos++;
			}
			this.expect(')', '"))" to close __attribute__');
			this.expect(')', '"))" to close __attribute__');
		}
		return packed;
	}

	/** struct tag, struct tag { ... } or struct { ... }, with attributes. */
	private record(openStart: number): { type: TypeRef; defined: RecordDef | null; closeStart: number } {
		const kwTok = this.tok;
		const kind = kwTok.value as 'struct' | 'union';
		this.pos++;
		let packed = this.attributes();
		let tag: string | null = null;
		if (this.tok.type === 'id' && this.tok.value !== '__attribute__') {
			tag = this.tok.value;
			this.pos++;
		}
		packed = this.attributes() || packed;
		const tags = kind === 'struct' ? this.structTags : this.unionTags;
		const otherTags = kind === 'struct' ? this.unionTags : this.structTags;
		if (!this.is('{')) {
			if (!tag) this.fail(`Expected a name or "{" after ${kind}`);
			if (otherTags.has(tag) && !tags.has(tag))
				this.fail(`"${tag}" is a ${kind === 'struct' ? 'union' : 'struct'}, not a ${kind}`, kwTok);
			let rec = tags.get(tag);
			if (!rec) {
				// A reference to a struct not defined yet: fine behind a pointer,
				// an error anywhere its size is needed (checked at layout).
				rec = this.newRecord(kind, tag, kwTok);
				tags.set(tag, rec);
			}
			return { type: { kind: 'record', record: rec }, defined: null, closeStart: 0 };
		}
		const braceTok = this.tok;
		this.pos++;
		let rec = tag ? tags.get(tag) : undefined;
		if (rec && rec.complete) this.fail(`${kind} ${tag} is defined twice`, kwTok);
		if (tag && otherTags.has(tag)) this.fail(`"${tag}" is already a ${kind === 'struct' ? 'union' : 'struct'}`, kwTok);
		if (!rec) {
			rec = this.newRecord(kind, tag, kwTok);
			if (tag) tags.set(tag, rec);
		}
		rec.line = kwTok.line;
		rec.column = kwTok.column;
		rec.pack = this.pack;
		while (!this.is('}')) {
			if (this.tok.type === 'eof') this.fail(`Missing "}" to close the ${kind} that starts here`, braceTok);
			if (this.tok.type === 'directive') this.fail('Put #pragma lines outside the struct, before it starts', this.tok);
			this.member(rec);
		}
		const closeTok = this.tok;
		this.pos++;
		packed = this.attributes() || packed;
		rec.packed = packed;
		if (!rec.members.length)
			this.fail(`An empty ${kind} has no size in standard C; give it at least one member`, kwTok);
		const flexIndex = rec.members.findIndex((m) => m.type.kind === 'array' && m.type.count === null);
		if (flexIndex >= 0) {
			const m = rec.members[flexIndex];
			if (kind === 'union') throw new StructError('A union cannot have a flexible array member', m.line, m.column);
			if (flexIndex !== rec.members.length - 1)
				throw new StructError('Only the last member can be a flexible array, written []', m.line, m.column);
			if (rec.members.length === 1)
				throw new StructError('A flexible array member needs at least one other member before it', m.line, m.column);
		}
		rec.complete = true;
		rec.open = tidy(this.src.slice(openStart, braceTok.end));
		rec.close = '}';
		this.records.push(rec);
		return { type: { kind: 'record', record: rec }, defined: rec, closeStart: closeTok.start };
	}

	private newRecord(kind: 'struct' | 'union', tag: string | null, at: Token): RecordDef {
		return {
			kind,
			tag,
			typedefName: null,
			members: [],
			packed: false,
			pack: null,
			complete: false,
			line: at.line,
			column: at.column,
			open: '',
			close: ''
		};
	}

	private member(rec: RecordDef) {
		const startTok = this.tok;
		const spec = this.specifiers(startTok.start);
		if (spec.type.kind === 'record' && spec.defined && this.is(';')) {
			// A nested definition with no declarator. Untagged, it is a C11
			// anonymous member whose fields belong to the outer struct; tagged,
			// it only declares the type.
			if (!spec.defined.tag)
				rec.members.push({
					name: null,
					type: spec.type,
					alignas: spec.alignas,
					line: startTok.line,
					column: startTok.column,
					code: tidy(this.src.slice(startTok.start, this.tok.start)) + ';'
				});
			this.pos++;
			return;
		}
		const specText = tidy(this.src.slice(startTok.start, this.tok.start));
		for (;;) {
			const dStart = this.tok;
			const d = this.declarator(spec.type);
			if (!d.name) this.fail('This member needs a name', dStart);
			if (this.is(':'))
				this.fail(
					'Bit-fields are not supported: GCC, clang and MSVC pack them differently, so this tool leaves them out rather than guess'
				);
			if (this.is('=')) this.fail('Struct members cannot have initial values in C');
			const declText = tidy(this.src.slice(dStart.start, this.tok.start));
			const name = d.name;
			if (rec.members.some((m) => m.name === name)) this.fail(`Duplicate member "${name}"`, dStart);
			if (d.type.kind === 'void') this.fail(`"${name}" is void, which has no size; did you mean void *?`, dStart);
			if (d.type.kind === 'function')
				this.fail(`"${name}" is a function; a struct can only hold a pointer to one, (*${name})`, dStart);
			const inner = innermost(d.type);
			if (inner.kind === 'record' && !inner.record.complete)
				this.fail(
					`${recordName(
						inner.record
					)} is not defined before this point, so its size is unknown; define it above, or use a pointer to it`,
					dStart
				);
			rec.members.push({
				name,
				type: d.type,
				alignas: spec.alignas,
				line: dStart.line,
				column: dStart.column,
				code: `${specText} ${declText};`
			});
			if (!this.is(',')) break;
			this.pos++;
		}
		this.expect(';', 'a ";" after the member');
	}

	/**
	 * A declarator: pointer stars, a name, array sizes, and the
	 * (*name)(params) shape of a function pointer.
	 */
	private declarator(base: TypeRef): { name: string | null; type: TypeRef } {
		let type = base;
		while (this.is('*')) {
			this.pos++;
			type = { kind: 'pointer', to: type };
			while (this.tok.type === 'id' && QUALIFIERS.has(this.tok.value)) this.pos++;
		}
		let name: string | null = null;
		let inner: ((t: TypeRef) => TypeRef) | null = null;
		if (this.is('(')) {
			// int (*fn)(int) or char (*table[4])(void): a pointer, or an array
			// of pointers, to a function.
			this.pos++;
			let stars = 0;
			while (this.is('*')) {
				stars++;
				this.pos++;
			}
			if (!stars) this.fail('Only function pointers, written (*name)(...), may use brackets here');
			if (this.tok.type !== 'id') this.fail('Expected a name after (*');
			name = this.tok.value;
			this.pos++;
			const dims = this.arrayDims();
			this.expect(')', '")" after the function pointer name');
			if (!this.is('(')) this.fail('Expected the parameter list of the function pointer');
			const paramsStart = this.tok.start;
			this.skipBalanced();
			const params = tidy(this.src.slice(paramsStart, this.tokens[this.pos - 1].end));
			const fn: TypeRef = { kind: 'function', text: `${typeText(type)} (*)${params}` };
			inner = () => {
				let t: TypeRef = { kind: 'pointer', to: fn };
				for (let i = 1; i < stars; i++) t = { kind: 'pointer', to: t };
				return wrapArrays(t, dims);
			};
		} else if (this.tok.type === 'id' && !QUALIFIERS.has(this.tok.value)) {
			name = this.tok.value;
			if (ALIGNAS.has(name)) this.fail('Put _Alignas before the type, not after the name');
			this.pos++;
		}
		if (inner) return { name, type: inner(type) };
		const dims = this.arrayDims();
		return { name, type: wrapArrays(type, dims) };
	}

	private arrayDims(): (number | null)[] {
		const dims: (number | null)[] = [];
		while (this.is('[')) {
			const open = this.tok;
			this.pos++;
			if (this.is(']')) {
				if (dims.length) this.fail('Only the first array size can be left empty', open);
				dims.push(null);
				this.pos++;
				continue;
			}
			if (this.tok.type !== 'num') {
				const t = this.tok;
				this.fail(
					t.type === 'id'
						? `Array sizes must be plain numbers; "${t.value}" is a name, and macros are not expanded`
						: 'Expected a number for the array size'
				);
			}
			const n = parseNumber(this.tok.value);
			if (n === 0) this.fail('A zero-length array is a GNU extension; use [] for a flexible array member');
			if (n > 1e9) this.fail('That array is too large to lay out here');
			this.pos++;
			this.expect(']', '"]" after the array size');
			dims.push(n);
		}
		return dims;
	}

	private skipBalanced() {
		let depth = 0;
		do {
			if (this.tok.type === 'eof') this.fail('Missing ")"');
			if (this.is('(')) depth++;
			if (this.is(')')) depth--;
			this.pos++;
		} while (depth > 0);
	}
}

/** a[2][3] is an array of 2 arrays of 3: the last size is the innermost. */
function wrapArrays(type: TypeRef, dims: (number | null)[]): TypeRef {
	let t = type;
	for (let i = dims.length - 1; i >= 0; i--) t = { kind: 'array', of: t, count: dims[i] };
	return t;
}

function parseNumber(text: string): number {
	const digits = text.replace(/[uUlL]+$/, '');
	return /^0[xX]/.test(digits)
		? parseInt(digits.slice(2), 16)
		: parseInt(digits, digits.length > 1 && digits[0] === '0' ? 8 : 10);
}

export function parseStructs(source: string): Program {
	if (source.length > MAX_SOURCE)
		throw new StructError(`That is more than ${MAX_SOURCE} characters; paste just the structs`);
	return new Parser(source).parse();
}

// --- naming types --------------------------------------------------------------

export function recordName(r: RecordDef): string {
	if (r.tag) return `${r.kind} ${r.tag}`;
	if (r.typedefName) return r.typedefName;
	return `${r.kind} { … }`;
}

/** C's inside-out type syntax, simplified: char *[4], struct point, int (*)(int). */
export function typeText(t: TypeRef): string {
	switch (t.kind) {
		case 'prim':
			return t.text;
		case 'void':
			return 'void';
		case 'function':
			return t.text;
		case 'record':
			return recordName(t.record);
		case 'pointer':
			if (t.to.kind === 'function') return t.to.text;
			return `${typeText(t.to)} *`.replace('* *', '**');
		case 'array': {
			let dims = '';
			let inner: TypeRef = t;
			while (inner.kind === 'array') {
				dims += `[${inner.count ?? ''}]`;
				inner = inner.of;
			}
			return `${typeText(inner)}${inner.kind === 'pointer' ? '' : ' '}${dims}`;
		}
	}
}

// --- layout ----------------------------------------------------------------------

type TypeInfo = {
	size: number;
	align: number;
	/**
	 * Alignment asked for with _Alignas somewhere inside the type. MSVC honours
	 * it even under #pragma pack, so it has to travel with the type.
	 */
	required: number;
	/** Padding bytes inside the type, as a mask over its bytes. */
	padding: boolean[];
};

export type MemberLayout = {
	name: string | null;
	/** What the table shows: the name, or "(anonymous union)". */
	label: string;
	type: string;
	offset: number;
	size: number;
	/** The alignment the member got, after packing and _Alignas. */
	align: number;
	/** The alignment its type has on its own, before packing and _Alignas. */
	naturalAlign: number;
	/** Bytes of padding inserted just before this member. */
	paddingBefore: number;
	/** Padding bytes inside the member, from a nested struct or array of them. */
	innerPadding: number;
	flexible: boolean;
	/** True for a struct or union member, or an array of them. */
	nested: boolean;
	code: string;
	/** Padding mask over the member's own bytes. */
	padMask: boolean[];
};

export type RecordLayout = {
	kind: 'struct' | 'union';
	name: string;
	size: number;
	align: number;
	members: MemberLayout[];
	/** Padding after the last member, to round the size up. */
	trailing: number;
	/** Padding between and after members at this level. */
	padding: number;
	/** Padding inside nested members. */
	innerPadding: number;
	/** Every padding byte, at every level. */
	wasted: number;
	/** wasted as a percentage of size, to one decimal place. */
	wastedPercent: number;
	/** Whether each byte of the struct is padding, at any level. */
	padMask: boolean[];
	packed: boolean;
	pack: number | null;
};

const alignUp = (n: number, a: number) => Math.ceil(n / a) * a;

/** The cap on byte masks: beyond this a struct is too big to draw anyway. */
const MASK_LIMIT = 1 << 16;

class Layouter {
	private readonly cache = new Map<RecordDef, { info: TypeInfo; layout: RecordLayout }>();
	readonly target: Target;
	constructor(target: Target) {
		this.target = target;
	}

	info(t: TypeRef, at: { line: number; column: number }): TypeInfo {
		switch (t.kind) {
			case 'prim': {
				const [size, align] = this.target.types[t.prim];
				return { size, align, required: 0, padding: new Array(size).fill(false) };
			}
			case 'pointer': {
				const [size, align] = this.target.types.pointer;
				return { size, align, required: 0, padding: new Array(size).fill(false) };
			}
			case 'void':
				throw new StructError('void has no size', at.line, at.column);
			case 'function':
				throw new StructError('A function has no size; use a pointer to it', at.line, at.column);
			case 'array': {
				const el = this.info(t.of, at);
				if (t.count === null) return { size: 0, align: el.align, required: el.required, padding: [] };
				const size = el.size * t.count;
				if (size > 2 ** 32) throw new StructError('That array is too large to lay out here', at.line, at.column);
				const padding: boolean[] = [];
				if (size <= MASK_LIMIT) for (let i = 0; i < t.count; i++) padding.push(...el.padding);
				return { size, align: el.align, required: el.required, padding };
			}
			case 'record': {
				const r = t.record;
				if (!r.complete)
					throw new StructError(
						`${recordName(
							r
						)} is not defined before this point, so its size is unknown; define it above, or use a pointer to it`,
						at.line,
						at.column
					);
				if (r.members.some((m) => m.type.kind === 'array' && m.type.count === null))
					throw new StructError(
						`${recordName(r)} ends in a flexible array, so it cannot be a member of another struct or an array element`,
						at.line,
						at.column
					);
				return this.record(r).info;
			}
		}
	}

	private explicitAlign(m: MemberDef): number {
		let a = 0;
		for (const spec of m.alignas) {
			const value = 'value' in spec ? spec.value : this.info(spec.type, m).align;
			a = Math.max(a, value);
		}
		return a;
	}

	record(r: RecordDef): { info: TypeInfo; layout: RecordLayout } {
		const hit = this.cache.get(r);
		if (hit) return hit;
		const msvc = this.target.msvc;
		let offset = 0;
		let align = 1;
		let required = 0;
		let unionSize = 0;
		const members: MemberLayout[] = [];
		for (const m of r.members) {
			const info = this.info(m.type, m);
			const explicit = this.explicitAlign(m);
			if (explicit && explicit < info.align)
				throw new StructError(
					`_Alignas(${explicit}) asks for less than the ${info.align}-byte alignment ${typeText(
						m.type
					)} already has on this target`,
					m.line,
					m.column
				);
			// Packing lowers a member's alignment; _Alignas raises it. On the
			// System V targets #pragma pack has the last word, on MSVC _Alignas
			// does (both checked against clang for each target).
			const base = r.packed ? 1 : info.align;
			let a: number;
			if (msvc) {
				a = Math.max(r.pack ? Math.min(base, r.pack) : base, explicit, info.required);
			} else {
				a = Math.max(base, explicit);
				if (r.pack) a = Math.min(a, r.pack);
			}
			const at = r.kind === 'union' ? 0 : alignUp(offset, a);
			const flexible = m.type.kind === 'array' && m.type.count === null;
			members.push({
				name: m.name,
				label: m.name ?? `(anonymous ${m.type.kind === 'record' ? m.type.record.kind : 'member'})`,
				type: typeText(m.type),
				offset: at,
				size: info.size,
				align: a,
				naturalAlign: info.align,
				paddingBefore: r.kind === 'union' ? 0 : at - offset,
				innerPadding: info.padding.filter(Boolean).length,
				flexible,
				nested: innermost(m.type).kind === 'record',
				code: m.code,
				padMask: info.padding
			});
			if (r.kind === 'union') unionSize = Math.max(unionSize, info.size);
			else offset = at + info.size;
			align = Math.max(align, a);
			required = Math.max(required, explicit, info.required);
		}
		const end = r.kind === 'union' ? unionSize : offset;
		const size = alignUp(end, align);
		if (size > 2 ** 32) throw new StructError('That struct is too large to lay out here', r.line, r.column);
		let padMask: boolean[] = [];
		if (size <= MASK_LIMIT) {
			// A byte is padding unless some member has data in it: for a struct
			// that is one member per byte, for a union any of the overlapping ones.
			padMask = new Array(size).fill(true);
			for (const m of members)
				m.padMask.forEach((pad, i) => {
					if (!pad) padMask[m.offset + i] = false;
				});
		}
		const wasted = padMask.filter(Boolean).length;
		const padding = r.kind === 'union' ? size - end : members.reduce((s, m) => s + m.paddingBefore, 0) + size - end;
		const layout: RecordLayout = {
			kind: r.kind,
			name: recordName(r),
			size,
			align,
			members,
			trailing: size - end,
			padding,
			innerPadding: wasted - padding,
			wasted,
			wastedPercent: size ? Math.round((wasted / size) * 1000) / 10 : 0,
			padMask,
			packed: r.packed,
			pack: r.pack
		};
		const result = { info: { size, align, required, padding: padMask }, layout };
		this.cache.set(r, result);
		return result;
	}
}

function innermost(t: TypeRef): TypeRef {
	return t.kind === 'array' ? innermost(t.of) : t;
}

export function layoutRecord(record: RecordDef, target: Target): RecordLayout {
	return new Layouter(target).record(record).layout;
}

// --- the whole analysis ---------------------------------------------------------

export type Reordered = {
	layout: RecordLayout;
	code: string;
	/** Bytes saved by the new order; zero when the order was already best. */
	saved: number;
};

export type Analysis = {
	program: Program;
	layout: RecordLayout;
	reordered: Reordered | null;
	target: Target;
};

/**
 * Sorts the members by the alignment they got, largest first, keeping the
 * written order among equals. Any flexible array stays last, where C needs it.
 * With every size a multiple of its alignment, this order needs no padding
 * between members at all.
 */
export function reorder(record: RecordDef, layout: RecordLayout): RecordDef {
	const indexed = record.members.map((m, i) => ({
		m,
		i,
		a: layout.members[i].align,
		flex: layout.members[i].flexible
	}));
	indexed.sort((x, y) => Number(x.flex) - Number(y.flex) || y.a - x.a || x.i - y.i);
	return { ...record, members: indexed.map((x) => x.m) };
}

/** The definition as C source again, members one per line. */
export function recordCode(record: RecordDef): string {
	const body = record.members.map((m) => `    ${m.code}`).join('\n');
	const lines = [`${record.open}\n${body}\n${record.close}`];
	if (record.pack) return `#pragma pack(push, ${record.pack})\n${lines[0]}\n#pragma pack(pop)`;
	return lines[0];
}

export function analyse(source: string, targetId: TargetId): Analysis {
	const program = parseStructs(source);
	const target = targetById(targetId);
	const layout = layoutRecord(program.main, target);
	let reordered: Reordered | null = null;
	if (layout.kind === 'struct') {
		const def = reorder(program.main, layout);
		const newLayout = layoutRecord(def, target);
		reordered = { layout: newLayout, code: recordCode(def), saved: layout.size - newLayout.size };
	}
	return { program, layout, reordered, target };
}

/** The same struct on every target, or the reason it does not compile there. */
export function compareTargets(
	source: string
): { target: Target; layout: RecordLayout | null; error: string | null }[] {
	let program: Program;
	try {
		program = parseStructs(source);
	} catch (e) {
		const error = e instanceof StructError ? e.message : String(e);
		return TARGETS.map((target) => ({ target, layout: null, error }));
	}
	return TARGETS.map((target) => {
		try {
			return { target, layout: layoutRecord(program.main, target), error: null };
		} catch (e) {
			return { target, layout: null, error: e instanceof StructError ? e.message : String(e) };
		}
	});
}

// --- the byte grid ----------------------------------------------------------------

export type GridSegment = {
	/** Index into the layout's members, or -1 for padding at this level. */
	member: number;
	/** Padding inside the member (a nested struct's own padding). */
	innerPad: boolean;
	start: number;
	length: number;
	/** True when this run is where the member starts, so it carries the name. */
	first: boolean;
};

export type GridRow = { offset: number; segments: GridSegment[] };

/**
 * Cuts the struct's bytes into rows of `width`, and each row into runs of the
 * same member (or padding), so a row draws as a handful of labelled blocks.
 * For a union, bytes belong to the largest member that covers them.
 */
export function byteGrid(layout: RecordLayout, width = 8, maxBytes = 512): GridRow[] {
	const owner: number[] = new Array(Math.min(layout.size, maxBytes)).fill(-1);
	const order = layout.members
		.map((m, i) => ({ m, i }))
		.sort((a, b) => (layout.kind === 'union' ? a.m.size - b.m.size : 0));
	for (const { m, i } of order) for (let b = m.offset; b < m.offset + m.size && b < owner.length; b++) owner[b] = i;
	const rows: GridRow[] = [];
	for (let rowStart = 0; rowStart < owner.length; rowStart += width) {
		const segments: GridSegment[] = [];
		for (let b = rowStart; b < Math.min(rowStart + width, owner.length); b++) {
			const member = owner[b];
			const innerPad = member >= 0 && layout.padMask[b] === true;
			const last = segments[segments.length - 1];
			if (last && last.member === member && last.innerPad === innerPad) last.length++;
			else
				segments.push({
					member,
					innerPad,
					start: b,
					length: 1,
					first: member >= 0 && (b === layout.members[member].offset || !segments.some((s) => s.member === member))
				});
		}
		rows.push({ offset: rowStart, segments });
	}
	return rows;
}

// --- explanations -----------------------------------------------------------------

/**
 * One sentence per member saying where it went and why, the way you would
 * work it out by hand.
 */
export function explainSteps(layout: RecordLayout): string[] {
	const steps: string[] = [];
	if (layout.kind === 'union') {
		steps.push(
			`Every member of a union starts at offset 0. The largest is ${Math.max(
				...layout.members.map((m) => m.size)
			)} bytes.`
		);
	} else {
		let offset = 0;
		for (const m of layout.members) {
			const what = `${m.label} (${m.type}, ${m.flexible ? 'no size of its own' : plural(m.size, 'byte')}, alignment ${
				m.align
			})`;
			if (m.paddingBefore)
				steps.push(
					`${what}: offset ${offset} is not a multiple of ${m.align}, so ${plural(
						m.paddingBefore,
						'byte'
					)} of padding go in first and it starts at ${m.offset}.`
				);
			else if (m.offset === 0) steps.push(`${what}: the first member always starts at offset 0.`);
			else steps.push(`${what}: offset ${offset} is already a multiple of ${m.align}, so it starts right there.`);
			offset = m.offset + m.size;
		}
		steps.push(
			layout.trailing
				? `The members end at ${offset}. The struct's alignment is ${
						layout.align
				  }, its largest member alignment, so the size rounds up to ${layout.size} with ${plural(
						layout.trailing,
						'byte'
				  )} of trailing padding.`
				: `The members end at ${offset}, already a multiple of the struct's alignment of ${layout.align}, so the size is ${layout.size} with no trailing padding.`
		);
		return steps;
	}
	steps.push(
		layout.trailing
			? `The union's alignment is ${layout.align}, so its size rounds up to ${layout.size}, with ${plural(
					layout.trailing,
					'byte'
			  )} of trailing padding.`
			: `That is already a multiple of the union's alignment of ${layout.align}, so the size is ${layout.size}.`
	);
	return steps;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** _Static_assert lines that pin the layout, so a build fails if it changes. */
export function staticAsserts(layout: RecordLayout): string {
	const lines = ['#include <stddef.h>', '', `_Static_assert(sizeof(${layout.name}) == ${layout.size}, "size");`];
	if (!layout.name.includes('{'))
		for (const m of layout.members)
			if (m.name) lines.push(`_Static_assert(offsetof(${layout.name}, ${m.name}) == ${m.offset}, "${m.name}");`);
	return lines.join('\n');
}
