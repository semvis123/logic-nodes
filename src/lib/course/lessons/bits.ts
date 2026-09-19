// Stage 1: bits and binary numbers.

import { assemble, bin, grouped, int, pick } from '../random.js';
import type { CourseQuestion, Random, StageMeta } from '../types.js';
import { rangeOf, render, toBcd, toBits } from '../../numbers.js';

const howManyValues = (random: Random): CourseQuestion => {
	const n = int(random, 2, 6);
	const right = 2 ** n;
	const { options, answer } = assemble(random, String(right), [String(n * 2), String(n ** 2), String(right - 1)]);
	return {
		prompt: `How many different values can ${n} bits hold?`,
		options,
		answer,
		hints: [
			'Each bit can be 0 or 1, so every bit you add doubles the number of patterns.',
			`Start from 1 bit, which has 2 patterns, and double ${n - 1} more times.`
		],
		explanation: `Each of the ${n} bits has 2 choices, so there are 2 × 2 × … × 2 = 2^${n} = ${right} patterns.`
	};
};

const whatIsAOne = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'A wire in a digital circuit is carrying a 1. Which of these means the same thing?',
			right: 'high',
			wrong: ['low', 'off', 'half on']
		},
		{
			prompt: 'A wire in a digital circuit is carrying a 0. Which of these means the same thing?',
			right: 'off',
			wrong: ['on', 'high', 'true']
		},
		{
			prompt: 'How many different values can one wire carry in a digital circuit?',
			right: '2',
			wrong: ['1', '10', 'as many as you like']
		},
		{
			prompt: 'Which of these is a single bit?',
			right: 'the position of one light switch',
			wrong: ['the reading on a thermometer', 'the volume knob on a speaker', 'the time on a clock']
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A bit has exactly two values. 1, high, on and true are all names for one of them; 0, low, off and false for the other.',
			'Ask which option is a thing that can only be in one of two states.'
		],
		explanation:
			'A bit is one of two values and nothing in between. 1 is also called high, on or true; 0 is low, off or false. Anything with more than two settings is not a bit.'
	};
};

const validPattern = (random: Random): CourseQuestion => {
	const n = int(random, 3, 5);
	const right = bin(int(random, 0, 2 ** n - 1), n);
	const bad = [right.replace(/[01]/, '2'), right.slice(0, -1) + 'A', right.replace(/[01]/, '.')];
	const { options, answer } = assemble(random, right, bad);
	return {
		prompt: `Which of these is a valid pattern of ${n} bits?`,
		options,
		answer,
		hints: [
			'A bit is only ever 0 or 1, so a pattern of bits uses only those two symbols.',
			'Look for the option that contains nothing but 0s and 1s.'
		],
		explanation: `Only ${right} uses nothing but 0s and 1s. Any other symbol is not a bit.`
	};
};

const combinations = (random: Random): CourseQuestion => {
	const n = int(random, 2, 4);
	const things = pick(random, [
		{ many: 'switches', one: 'switch' },
		{ many: 'wires', one: 'wire' },
		{ many: 'lamps', one: 'lamp' },
		{ many: 'buttons', one: 'button' }
	]);
	const right = 2 ** n;
	const { options, answer } = assemble(random, String(right), [String(n), String(n * 2), String(right + n)]);
	return {
		prompt: `You have ${n} ${things.many}, each either on or off. How many different combinations of on and off are there?`,
		options,
		answer,
		hints: [
			`Write the combinations out for 2 ${things.many} first: off-off, off-on, on-off, on-on. That is 4.`,
			`Each extra ${things.one} doubles the count: 2, then 4, then 8, and so on.`
		],
		explanation: `Each of the ${n} ${things.many} doubles the count, so there are 2^${n} = ${right} combinations.`
	};
};

const countUp = (random: Random): CourseQuestion => {
	const n = int(random, 3, 5);
	const value = int(random, 0, 2 ** n - 2);
	const right = bin(value + 1, n);
	const distractors = [bin(value + 2, n), bin(value === 0 ? 2 : value - 1, n), bin((value + 1) ^ (1 << (n - 1)), n)];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `Counting in binary, what comes right after ${bin(value, n)}?`,
		detail: bin(value, n),
		options,
		answer,
		hints: [
			'Adding 1 in binary works like adding 1 in decimal: if the last digit is 0 it becomes 1; if it is 1 it becomes 0 and you carry 1 to the left.',
			`${bin(value, n)} is ${value} in decimal, so the next number is ${value + 1}. Write ${value + 1} in binary.`
		],
		explanation: `${bin(value, n)} is ${value}. Add 1 to get ${value + 1}, which in ${n} bits is ${right}.`
	};
};

const toDecimal = (random: Random): CourseQuestion => {
	const n = int(random, 3, 5);
	const value = int(random, 1, 2 ** n - 1);
	const pattern = bin(value, n);
	const weights = pattern
		.split('')
		.map((b, i) => (b === '1' ? 2 ** (n - 1 - i) : 0))
		.filter((w) => w > 0);
	const distractors = [value + 1, value - 1, parseInt(pattern.split('').reverse().join(''), 2), value * 2]
		.filter((d) => d !== value && d >= 0)
		.map(String);
	const { options, answer } = assemble(random, String(value), distractors);
	return {
		prompt: `What is ${pattern} in decimal?`,
		detail: pattern,
		options,
		answer,
		hints: [
			`The bits are worth ${Array.from({ length: n }, (_, i) => 2 ** (n - 1 - i)).join(
				', '
			)} from left to right. Add up the weights of the bits that are 1.`,
			`The 1s are worth ${weights.join(' + ')}.`
		],
		explanation: `Reading the weights from the left, the 1s are worth ${weights.join(' + ')} = ${value}.`
	};
};

const toBinary = (random: Random): CourseQuestion => {
	const n = int(random, 3, 5);
	const value = int(random, 1, 2 ** n - 1);
	const right = bin(value, n);
	const distractors = [bin(value + 1, n), bin(value - 1, n), right.split('').reverse().join('')].filter(
		(d) => d !== right
	);
	const { options, answer } = assemble(random, right, distractors);
	const steps: string[] = [];
	let rest = value;
	for (let i = n - 1; i >= 0; i--) {
		const w = 2 ** i;
		if (rest >= w) {
			steps.push(`${w} fits`);
			rest -= w;
		} else steps.push(`${w} does not`);
	}
	return {
		prompt: `What is ${value} in binary, written with ${n} bits?`,
		detail: String(value),
		options,
		answer,
		hints: [
			`Go through the weights from the biggest down: ${Array.from({ length: n }, (_, i) => 2 ** (n - 1 - i)).join(
				', '
			)}. Write a 1 if the weight fits in what is left, a 0 if not.`,
			`From the left: ${steps.join(', ')}.`
		],
		explanation: `Taking the weights from the left, ${steps.join(', ')}, which gives ${right}.`
	};
};

const bitWeight = (random: Random): CourseQuestion => {
	const n = int(random, 3, 6);
	const k = int(random, 1, n);
	const right = 2 ** (k - 1);
	const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][k - 1];
	const { options, answer } = assemble(random, String(right), [
		String(k),
		String(2 * k),
		String(2 ** k),
		String(2 ** (n - k)),
		String(n)
	]);
	return {
		prompt: `In a ${n}-bit number, how much is the ${ordinal} bit from the right worth?`,
		options,
		answer,
		hints: [
			'The rightmost bit is worth 1, and each step to the left doubles: 1, 2, 4, 8, 16, 32.',
			`Count ${k} weights in from the right: ${Array.from({ length: k }, (_, i) => 2 ** i).join(', ')}.`
		],
		explanation: `Weights double from the right: ${Array.from({ length: k }, (_, i) => 2 ** i).join(
			', '
		)}. The ${ordinal} bit is worth ${right}.`
	};
};

// Lesson 3: bytes, hex and bit width.

/** The hex digit for a nibble value, from the converter's own renderer. */
const hexDigit = (value: number) => render(toBits(value, 4), 'hex');

const hexAndNibble = (random: Random): CourseQuestion => {
	const d = int(random, 0, 15);
	const nibble = toBits(d, 4).join('');
	const hex = hexDigit(d);
	if (random() < 0.5) {
		const distractors = [bin((d + 1) % 16, 4), bin((d + 15) % 16, 4), nibble.split('').reverse().join('')];
		const { options, answer } = assemble(random, nibble, distractors);
		return {
			prompt: `Which nibble does the hex digit ${hex} stand for?`,
			detail: hex,
			options,
			answer,
			hints: [
				'A hex digit is one nibble: 0 to 9 are the same as decimal, and A to F are ten to fifteen. Write that value with four bits.',
				`${hex} ${
					d >= 10 ? `is ${d} in decimal` : 'means the same in hex as in decimal'
				}. Write ${d} in binary with the weights 8, 4, 2, 1.`
			],
			explanation: `${hex} ${
				d >= 10 ? `is ${d} in decimal` : 'is a plain digit'
			}. With the weights 8, 4, 2, 1, ${d} is ${nibble}, so the nibble is ${nibble}.`
		};
	}
	const distractors = [hexDigit((d + 1) % 16), hexDigit((d + 15) % 16), String(d), hexDigit(15 - d)];
	const { options, answer } = assemble(random, hex, distractors);
	return {
		prompt: `What is the nibble ${nibble} as a hex digit?`,
		detail: nibble,
		options,
		answer,
		hints: [
			'Read the nibble as a number with the weights 8, 4, 2, 1. If it is 9 or less, that is the hex digit; ten to fifteen are A to F.',
			`${nibble} is ${d} in decimal.${
				d >= 10 ? ` Ten is A, so count on from A to reach ${d}.` : ' That is a plain digit.'
			}`
		],
		explanation: `${nibble} is ${d} in decimal, and ${d} is written ${hex} in hex.`
	};
};

const hexByteToDecimal = (random: Random): CourseQuestion => {
	const high = int(random, 1, 3);
	const low = int(random, 0, 15);
	const value = high * 16 + low;
	const hex = render(toBits(value, 8), 'hex');
	const distractors = [String(high * 10 + low), String(value + 16), String(value - 1), String(high + low)];
	const { options, answer } = assemble(random, String(value), distractors);
	return {
		prompt: `A byte is written ${hex} in hex. What is it in decimal?`,
		detail: hex,
		options,
		answer,
		hints: [
			'Each hex digit is one nibble, and the left nibble of a byte is worth sixteen times the right one, so the value is left digit × 16 + right digit.',
			`The left digit ${hexDigit(high)} is ${high} and the right digit ${hexDigit(
				low
			)} is ${low}. Work out ${high} × 16 + ${low}.`
		],
		explanation: `${hexDigit(high)} is ${high} and ${hexDigit(
			low
		)} is ${low}, so ${hex} is ${high} × 16 + ${low} = ${value}.`
	};
};

const biggestValue = (random: Random): CourseQuestion => {
	const n = int(random, 4, 16);
	const right = rangeOf(n).unsignedMax;
	const distractors = [String(right + 1), String(right - 1), String(n * 2), String(2 ** (n - 1))];
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `What is the biggest unsigned value that ${n} bits can hold?`,
		options,
		answer,
		hints: [
			`${n} bits make 2^${n} patterns, and one of those patterns is spent on zero.`,
			`2^${n} is ${right + 1}. Take one off for the zero pattern.`
		],
		explanation: `${n} bits make 2^${n} = ${right + 1} patterns, from 0 up to ${right}, so the biggest value is ${
			right + 1
		} − 1 = ${right}.`
	};
};

const bytesAndNibbles = (random: Random): CourseQuestion => {
	const bytes = int(random, 1, 8);
	const n = bytes * 8;
	const nibbles = n / 4;
	const askBytes = random() < 0.5;
	const right = askBytes ? bytes : nibbles;
	const other = askBytes ? nibbles : bytes;
	const distractors = [String(other), String(n / 2), String(n * (askBytes ? 8 : 4)), String(right + 1)];
	const { options, answer } = assemble(random, String(right), distractors);
	const unit = askBytes ? 'byte' : 'nibble';
	const size = askBytes ? 8 : 4;
	return {
		prompt: `How many ${unit}s are there in ${n} bits?`,
		options,
		answer,
		hints: [`A ${unit} is ${size} bits, so divide the number of bits by ${size}.`, `${n} ÷ ${size} = ${right}.`],
		explanation: `A ${unit} is ${size} bits, and ${n} ÷ ${size} = ${right}, so ${n} bits is ${right} ${unit}${
			right === 1 ? '' : 's'
		}.`
	};
};

// Lesson 4: how bits become letters, colours and codes.

const asciiCharacter = (random: Random): CourseQuestion => {
	const set = pick(random, [
		{ start: 65, end: 90, anchor: 'the capital letter A', kind: 'capital letter' },
		{ start: 97, end: 122, anchor: 'the small letter a', kind: 'small letter' },
		{ start: 48, end: 57, anchor: 'the character 0', kind: 'digit character' }
	]);
	const code = int(random, set.start, set.end);
	const right = String.fromCharCode(code);
	const k = code - set.start;
	const distractors = [
		String.fromCharCode(code + 1),
		String.fromCharCode(code - 1),
		set.kind === 'digit character' ? String.fromCharCode(65 + k) : String.fromCharCode(code ^ 32)
	];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `In ASCII, ${set.start} is ${set.anchor}. Which character is code ${code}?`,
		detail: String(code),
		options,
		answer,
		hints: [
			'ASCII numbers the characters in order, so each code is one step along from the code before it.',
			`${code} − ${set.start} = ${k}, so count ${k} step${k === 1 ? '' : 's'} on from ${set.anchor}.`
		],
		explanation: `${set.start} is ${set.anchor}, and ${code} is ${k} further on, so code ${code} is the ${set.kind} ${right}.`
	};
};

const colourBits = (random: Random): CourseQuestion => {
	const channels = 3;
	const perChannel = 8;
	const bitsTotal = channels * perChannel;
	const ask = pick(random, ['bits', 'bytes', 'colours'] as const);
	if (ask === 'colours') {
		const right = 2 ** bitsTotal;
		const distractors = [
			String(bitsTotal),
			String(2 ** perChannel),
			String(channels * 2 ** perChannel),
			String(right - 1)
		];
		const { options, answer } = assemble(random, String(right), distractors);
		return {
			prompt: `A screen colour has ${channels} channels, red, green and blue, of ${perChannel} bits each. How many different colours can it name?`,
			options,
			answer,
			hints: [
				`Count the bits first: ${channels} channels of ${perChannel} bits is ${bitsTotal} bits, and every bit doubles the number of patterns.`,
				`${bitsTotal} bits give 2^${bitsTotal} patterns.`
			],
			explanation: `${channels} × ${perChannel} = ${bitsTotal} bits, and ${bitsTotal} bits make 2^${bitsTotal} = ${right} patterns, one per colour.`
		};
	}
	const right = ask === 'bits' ? bitsTotal : channels;
	const distractors =
		ask === 'bits'
			? [String(perChannel), String(channels), String(bitsTotal * 2), String(channels + perChannel)]
			: [String(bitsTotal), String(perChannel), String(channels * 2), String(1)];
	const { options, answer } = assemble(random, String(right), distractors);
	return {
		prompt: `A screen colour is stored as ${channels} channels, red, green and blue, of ${perChannel} bits each. How many ${ask} is one colour?`,
		options,
		answer,
		hints: [
			ask === 'bits'
				? `Each channel is ${perChannel} bits and there are ${channels} of them.`
				: `A byte is 8 bits, and each channel is ${perChannel} bits, so each channel is one byte.`,
			ask === 'bits' ? `${channels} × ${perChannel} = ${bitsTotal}.` : `${channels} channels, one byte each.`
		],
		explanation:
			ask === 'bits'
				? `${channels} channels × ${perChannel} bits = ${bitsTotal} bits.`
				: `Each ${perChannel} bit channel is exactly one byte, so ${channels} channels are ${channels} bytes, or ${bitsTotal} bits.`
	};
};

const bcdCode = (random: Random): CourseQuestion => {
	if (random() < 0.5) {
		const value = int(random, 10, 99);
		const asBcd = (v: number) =>
			toBcd(v)
				.map((d) => d.bits.join(''))
				.join(' ');
		const right = asBcd(value);
		const tens = Math.floor(value / 10);
		const ones = value % 10;
		const swapped = ones * 10 + tens;
		const distractors = [grouped(bin(value, 8)), asBcd(value + 1), swapped >= 10 ? asBcd(swapped) : asBcd(value - 1)];
		const { options, answer } = assemble(random, right, distractors);
		return {
			prompt: `What is ${value} in BCD?`,
			detail: String(value),
			options,
			answer,
			hints: [
				'BCD gives each decimal digit its own nibble. Write each digit as a four bit binary number and put the nibbles side by side.',
				`The digits are ${tens} and ${ones}. ${tens} is ${bin(tens, 4)} and ${ones} is ${bin(ones, 4)}.`
			],
			explanation: `${value} has the digits ${tens} and ${ones}. In four bits each, ${tens} is ${bin(
				tens,
				4
			)} and ${ones} is ${bin(ones, 4)}, so the BCD form is ${right}. Plain binary would be ${grouped(
				bin(value, 8)
			)}, which is a different code.`
		};
	}
	const n = int(random, 0, 15);
	const nibble = bin(n, 4);
	const valid = n <= 9;
	const right = valid ? `yes, it is the digit ${n}` : 'no, it is not a digit';
	const distractors = valid
		? ['no, it is not a digit', `yes, it is the digit ${(n + 1) % 10}`, `yes, it is the digit ${(n + 9) % 10}`]
		: [`yes, it is the digit ${n % 10}`, `yes, it is the digit ${n}`, `yes, it is the digit ${n - 6}`];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `Is the nibble ${nibble} a valid BCD digit?`,
		detail: nibble,
		options,
		answer,
		hints: [
			'A BCD nibble holds one decimal digit, 0 to 9. The six nibbles worth 10 to 15 are never used.',
			`Read ${nibble} with the weights 8, 4, 2, 1: it is ${n}. Is ${n} a decimal digit?`
		],
		explanation: valid
			? `${nibble} is ${n}, which is a decimal digit, so it is a valid BCD nibble meaning ${n}.`
			: `${nibble} is ${n}, and there is no decimal digit ${n}, so it is one of the six nibbles BCD never uses.`
	};
};

const codeSize = (random: Random): CourseQuestion => {
	const n = int(random, 3, 12);
	const right = 2 ** n;
	const distractors = [String(n * 2), String(right - 1), String(n ** 2), String(2 ** (n - 1))];
	const { options, answer } = assemble(random, String(right), distractors);
	const thing = pick(random, [
		{ one: 'character', many: 'characters' },
		{ one: 'colour', many: 'colours' },
		{ one: 'key on a keyboard', many: 'keys on a keyboard' },
		{ one: 'instruction', many: 'instructions' }
	]);
	return {
		prompt: `A code uses ${n} bits for each ${thing.one}. How many different ${thing.many} can it name?`,
		options,
		answer,
		hints: [
			'Every different pattern of bits can stand for one thing, and each extra bit doubles the number of patterns.',
			`${n} bits make 2^${n} patterns, so start at 2 and double ${n - 1} more times.`
		],
		explanation: `${n} bits make 2^${n} = ${right} different patterns, so the code can name ${right} different ${thing.many}. ASCII, for instance, uses 7 bits for 128 characters.`
	};
};

export const bits: StageMeta = {
	id: 'bits',
	title: 'Bits and binary numbers',
	tagline: 'Everything a computer does is done with wires that are on or off. Here is how that becomes numbers.',
	lessons: [
		{
			slug: 'what-is-a-bit',
			title: 'What a bit is',
			blurb: 'One wire, two values, and why that is enough to build on.',
			description:
				'The first lesson in digital logic: what a bit is, why a wire carries only 1 or 0, what high, low, on and off mean, and how many patterns a few bits can make.',
			minutes: 8,
			generators: [whatIsAOne, howManyValues, validPattern, combinations],
			deeper: [
				{ href: '/glossary', label: 'Glossary' },
				{ href: '/simulator#example:Introduction', label: 'The introduction circuit in the simulator' }
			]
		},
		{
			slug: 'counting-in-binary',
			title: 'Counting in binary',
			blurb: 'Counting with only two digits, and reading a binary number without thinking.',
			description:
				'How to count in binary and convert between binary and decimal: place value with weights 1, 2, 4, 8, carrying when a column is full, and a bit strip to click through.',
			minutes: 12,
			generators: [countUp, toDecimal, toBinary, bitWeight],
			deeper: [{ href: '/binary-converter', label: 'Binary converter' }]
		},
		{
			slug: 'bytes-hex-and-width',
			title: 'Bytes, hex and bit width',
			blurb: 'Bits in fours and eights, hex as a shorthand for nibbles, and what happens past the biggest value.',
			description:
				'Nibbles and bytes, hexadecimal as one digit per nibble with the full table, why hex beats decimal, and how a fixed width wraps round to zero.',
			minutes: 12,
			generators: [hexAndNibble, hexByteToDecimal, biggestValue, bytesAndNibbles],
			deeper: [
				{ href: '/binary-converter', label: 'Binary converter' },
				{ href: '/glossary', label: 'Glossary' }
			]
		},
		{
			slug: 'bits-with-meaning',
			title: 'How bits become letters, colours and codes',
			blurb: 'The same byte as a number, a letter, two decimal digits or a flag: a code decides.',
			description:
				'Bits mean nothing until a code assigns a meaning: ASCII for characters, three bytes for a colour, BCD for decimal digits and a single bit as a flag.',
			minutes: 12,
			generators: [asciiCharacter, colourBits, bcdCode, codeSize],
			deeper: [
				{ href: '/binary-converter#bcd', label: 'BCD in the binary converter' },
				{ href: '/seven-segment-decoder', label: 'Seven-segment decoder' },
				{ href: '/twos-complement', label: "Two's complement, for later" }
			]
		}
	]
};
