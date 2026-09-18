// Stage 5: building circuits that compute. Every sum, pattern and table here
// comes from the same libraries as the reference pages ($lib/adders,
// $lib/twosComplement, $lib/commonCircuits, $lib/sevenSegment), never from a
// value typed in by hand, so a question cannot disagree with the tools.

import { fullAdder, fullAdderRows, rippleAdd, type Bit } from '../../adders.js';
import { parseExpression, evaluate } from '../../boolean.js';
import { circuitBySlug } from '../../commonCircuits.js';
import { toBits, rangeOf } from '../../numbers.js';
import { digitSegments, segmentNames } from '../../sevenSegment.js';
import { representations, negate, addSigned } from '../../twosComplement.js';
import { fromPractice } from '../fromPractice.js';
import { assemble, bin, int, pick, shuffle } from '../random.js';
import type { CourseQuestion, Random, StageMeta } from '../types.js';

const WIDTH = 4;

/** A signed number for prose and options, with a real minus sign. */
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));

const bitOf = (random: Random): Bit => (random() < 0.5 ? 0 : 1);

/** A lookup that the reference data guarantees, made explicit instead of asserted. */
const must = <T>(value: T | undefined, what: string): T => {
	if (value === undefined) throw new Error(`Missing ${what}`);
	return value;
};

// --- The half adder ---------------------------------------------------------

const halfAdderCircuit = must(circuitBySlug('half-adder'), 'half adder');
const halfSum = parseExpression(
	must(
		halfAdderCircuit.outputs.find((o) => o.name === 'sum'),
		'half adder sum'
	).expression
);
const halfCarry = parseExpression(
	must(
		halfAdderCircuit.outputs.find((o) => o.name === 'carry'),
		'half adder carry'
	).expression
);
const halfAdd = (a: Bit, b: Bit) => ({
	sum: evaluate(halfSum, { a: a === 1, b: b === 1 }) ? 1 : 0,
	carry: evaluate(halfCarry, { a: a === 1, b: b === 1 }) ? 1 : 0
});

const halfAdderOutputs = (random: Random): CourseQuestion => {
	const a = bitOf(random);
	const b = bitOf(random);
	const { sum, carry } = halfAdd(a, b);
	const text = (s: number, c: number) => `sum ${s}, carry ${c}`;
	const { options, answer } = assemble(random, text(sum, carry), [
		text(1 - sum, carry),
		text(sum, 1 - carry),
		text(1 - sum, 1 - carry)
	]);
	return {
		prompt: `A half adder is given a = ${a} and b = ${b}. What does it output?`,
		detail: `${a} + ${b}`,
		options,
		answer,
		hints: [
			'Add the two bits as numbers first. The result, 0, 1 or 2, is written in two bits: the carry is the twos column and the sum is the ones column.',
			`${a} + ${b} = ${
				a + b
			}. Written in two bits that is ${carry}${sum}: the left bit is the carry, the right bit is the sum.`
		],
		explanation: `${a} + ${b} = ${
			a + b
		}, which is ${carry}${sum} in binary. So the sum output is ${sum} (a XOR b) and the carry output is ${carry} (a AND b).`
	};
};

const whichGateMakes = (random: Random): CourseQuestion => {
	const which = pick(random, ['sum', 'carry'] as const);
	const column = Array.from({ length: 4 }, (_, i) => halfAdd(((i >> 1) & 1) as Bit, (i & 1) as Bit)[which]).join(', ');
	const right = which === 'sum' ? 'XOR' : 'AND';
	const { options, answer } = assemble(random, right, ['OR', which === 'sum' ? 'AND' : 'XOR', 'NAND', 'NOT']);
	return {
		prompt: `In a half adder, which gate produces the ${which} output?`,
		options,
		answer,
		hints: [
			`Write the ${which} column of the half adder's table for inputs 00, 01, 10, 11, then ask which gate has that column.`,
			`The ${which} column reads ${column}. Which two-input gate gives a 1 ${
				which === 'sum' ? 'exactly when the inputs differ' : 'only when both inputs are 1'
			}?`
		],
		explanation: `The ${which} column is ${column}. That is the ${right} gate: ${
			which === 'sum'
				? '1 when exactly one input is 1, because 0 + 1 and 1 + 0 are 1 while 1 + 1 leaves 0 in the ones column'
				: '1 only when both inputs are 1, because only 1 + 1 is big enough to need a second column'
		}.`
	};
};

const whyOnePlusOne = (random: Random): CourseQuestion => {
	const { sum, carry } = halfAdd(1, 1);
	const asks = [
		{
			prompt: 'Why does a half adder output sum 0 and carry 1 for 1 + 1?',
			right: '1 + 1 is 2, which needs two bits: 10',
			wrong: ['1 + 1 is 1 in binary', 'the adder rounds 2 down to 0', '10 means ten, so the answer is ten']
		},
		{
			prompt: 'What does the carry output of a half adder mean?',
			right: 'the sum was too big for one bit',
			wrong: ['both inputs were 0', 'the inputs were different', 'the sum was odd']
		},
		{
			prompt: 'Why is it called a half adder?',
			right: 'it has no input for a carry coming in',
			wrong: ['it adds only half a bit', 'it only handles two of the four cases', 'it has one output instead of two']
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'A single bit can only hold 0 or 1. Adding two bits can give 2, and 2 does not fit, so the adder needs a second output for the overflow.',
			`1 + 1 is 2, which in binary is ${carry}${sum}. The ${carry} goes on the carry output and the ${sum} on the sum output. The carry is the only way 2 can be shown, and a half adder has nowhere to take a carry in.`
		],
		explanation:
			'Adding two bits gives 0, 1 or 2. Two does not fit in one bit, so it is written 10: sum 0 with a carry of 1. The carry says the sum overflowed one bit. The circuit is a half adder because it can send a carry out but cannot accept one in; the full adder adds that third input.'
	};
};

// --- The full adder ---------------------------------------------------------

const fullAdderOutputs = (random: Random): CourseQuestion => {
	const a = bitOf(random);
	const b = bitOf(random);
	const cin = bitOf(random);
	const { sum, cout } = fullAdder(a, b, cin);
	const text = (s: number, c: number) => `sum ${s}, carry out ${c}`;
	const { options, answer } = assemble(random, text(sum, cout), [
		text(1 - sum, cout),
		text(sum, 1 - cout),
		text(1 - sum, 1 - cout)
	]);
	const ones = a + b + cin;
	return {
		prompt: `A full adder is given a = ${a}, b = ${b} and carry in = ${cin}. What does it output?`,
		detail: `${a} + ${b} + ${cin}`,
		options,
		answer,
		hints: [
			'Add all three bits as numbers. The result, 0 to 3, is written in two bits: carry out then sum.',
			`${a} + ${b} + ${cin} = ${ones}, which in two bits is ${cout}${sum}.`
		],
		explanation: `${a} + ${b} + ${cin} = ${ones}, which is ${cout}${sum} in binary. The sum output is ${sum}: it is 1 when an odd number of inputs are 1. The carry out is ${cout}: it is 1 when at least two inputs are 1.`
	};
};

const howManyOnes = (random: Random): CourseQuestion => {
	const row = pick(random, fullAdderRows());
	const ones = row.a + row.b + row.cin;
	// The number of 1s is fixed by the two outputs: every row with this sum and
	// carry out has the same count.
	const { options, answer } = assemble(random, String(ones), ['0', '1', '2', '3']);
	return {
		prompt: `A full adder shows sum ${row.sum} and carry out ${row.cout}. How many of its three inputs are 1?`,
		options,
		answer,
		hints: [
			'The carry out is 1 when at least two inputs are 1, and the sum is 1 when an odd number of inputs are 1. Together they pin the count down.',
			`Carry out ${row.cout} means ${row.cout ? 'two or three' : 'zero or one'} inputs are 1; sum ${
				row.sum
			} means the count is ${row.sum ? 'odd' : 'even'}.`
		],
		explanation: `The two outputs are the count written in binary: carry out ${row.cout}, sum ${row.sum} is ${
			row.cout
		}${row.sum}, which is ${ones}. So exactly ${ones} input${ones === 1 ? ' is' : 's are'} 1.`
	};
};

const whichCombine = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'A full adder is built from two half adders and one more gate. How is its carry out made?',
			right: 'the two half adder carries, through an OR gate',
			wrong: [
				'the two half adder sums, through an OR gate',
				'the two half adder carries, through an AND gate',
				"the second half adder's sum on its own"
			]
		},
		{
			prompt: 'A full adder is built from two half adders. What does the second half adder add together?',
			right: "the first half adder's sum and the carry in",
			wrong: ['a and b', 'the two carries', 'a and the carry in']
		},
		{
			prompt: 'A full adder is built from two half adders and an OR gate. Where does its sum output come from?',
			right: "the second half adder's sum",
			wrong: ["the first half adder's sum", 'the OR gate', "the first half adder's carry"]
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'The first half adder adds a and b. The second adds that result to the carry in. Each half adder makes a sum and a carry, so there are two carries to deal with.',
			'The final sum is a XOR b XOR carry in, which is the second half adder. Only one of the two carries can ever be 1 at a time, so a single OR gate merges them into the carry out.'
		],
		explanation:
			'Half adder one adds a and b, giving a first sum and a first carry. Half adder two adds that first sum to the carry in, giving the final sum and a second carry. The two carries can never both be 1, so an OR gate of them is the carry out. That is the textbook full adder: two half adders and an OR.'
	};
};

// --- Adding whole numbers ---------------------------------------------------

export const addFourBit = (random: Random): CourseQuestion => {
	const a = int(random, 1, 15);
	const b = int(random, 1, 15);
	const sum = rippleAdd(a, b, WIDTH);
	const text = (pattern: string, carry: number) => `${pattern}, carry out ${carry}`;
	const right = text(sum.sumBits.join(''), sum.carryOut);
	const distractors = [
		text(sum.sumBits.join(''), 1 - sum.carryOut),
		text(bin(a ^ b, WIDTH), sum.carryOut),
		text(bin((sum.unsigned + 1) & 15, WIDTH), sum.carryOut),
		text(bin((sum.unsigned - 1) & 15, WIDTH), sum.carryOut)
	];
	const { options, answer } = assemble(random, right, distractors);
	const trace = sum.columns
		.map((c) => `column ${c.position}: ${c.a} + ${c.b} + ${c.cin} = ${c.cout}${c.sum}`)
		.join('; ');
	return {
		prompt: `A four bit ripple carry adder adds ${bin(a, WIDTH)} (${a}) and ${bin(
			b,
			WIDTH
		)} (${b}). What are the sum bits and the carry out?`,
		detail: `${bin(a, WIDTH)} + ${bin(b, WIDTH)}`,
		options,
		answer,
		hints: [
			'Work from the right hand column. In each column add the two bits and the carry in; write the sum bit down and pass the carry to the next column on the left.',
			`${trace}.`
		],
		explanation: `Column by column from the right: ${trace}. The sum bits are ${sum.sumBits.join('')} (${
			sum.unsigned
		}) and the carry out is ${sum.carryOut}${
			sum.carryOut
				? `, because ${a} + ${b} = ${a + b} is more than 15`
				: `, because ${a} + ${b} = ${a + b} fits in four bits`
		}.`
	};
};

const firstCarryColumn = (random: Random): CourseQuestion => {
	let a = int(random, 1, 15);
	let b = int(random, 1, 15);
	let sum = rippleAdd(a, b, WIDTH);
	// Nearly every pair produces a carry somewhere; reroll the odd one out.
	while (sum.carries.every((c) => c === 0)) {
		a = int(random, 1, 15);
		b = int(random, 1, 15);
		sum = rippleAdd(a, b, WIDTH);
	}
	const first = must(
		sum.columns.find((c) => c.cout === 1),
		'carrying column'
	);
	const { options, answer } = assemble(random, `column ${first.position}`, [
		'column 0',
		'column 1',
		'column 2',
		'column 3',
		'no column'
	]);
	return {
		prompt: `Adding ${bin(a, WIDTH)} and ${bin(
			b,
			WIDTH
		)}, which is the first column, counting from column 0 on the right, to produce a carry out of 1?`,
		detail: `${bin(a, WIDTH)} + ${bin(b, WIDTH)}`,
		options,
		answer,
		hints: [
			'A column produces a carry when at least two of its three inputs, the two bits and the carry in, are 1. Column 0 has a carry in of 0, so it needs both bits to be 1.',
			`Column 0 adds ${sum.columns[0].a} + ${sum.columns[0].b}${
				first.position > 0 ? ', which gives no carry. Move left one column at a time until two inputs are 1' : ''
			}.`
		],
		explanation: `${sum.columns
			.slice(0, first.position + 1)
			.map((c) => `column ${c.position}: ${c.a} + ${c.b} + ${c.cin}, carry ${c.cout}`)
			.join('; ')}. The first carry appears in column ${first.position}.`
	};
};

const howManyAdders = (random: Random): CourseQuestion => {
	const n = pick(random, [2, 3, 4, 5, 6, 8, 16]);
	const { options, answer } = assemble(random, String(n), [
		String(n - 1),
		String(2 * n),
		String(2 ** n),
		String(n + 1)
	]);
	return {
		prompt: `How many full adders does a ripple carry adder need to add two ${n}-bit numbers?`,
		options,
		answer,
		hints: [
			'Each full adder handles one column: one bit of each number and the carry from the column to its right.',
			`Two ${n}-bit numbers have ${n} columns, and every column gets its own adder.`
		],
		explanation: `One full adder per column, so ${n} of them, each passing its carry out to the next one's carry in. The rightmost one could be a half adder, since nothing carries into it, but a full adder with its carry in held at 0 does the same job.`
	};
};

const didItFit = (random: Random): CourseQuestion => {
	const a = int(random, 1, 15);
	const b = int(random, 1, 15);
	const sum = rippleAdd(a, b, WIDTH);
	const text = (total: number, carry: number) => `${total}, carry out ${carry}`;
	const right = text(a + b, sum.carryOut);
	const { options, answer } = assemble(random, right, [
		text(a + b, 1 - sum.carryOut),
		text(sum.unsigned, sum.carryOut),
		text(sum.unsigned, 1 - sum.carryOut),
		text(sum.unsigned + 16, 1),
		text(sum.unsigned + 16, 0)
	]);
	return {
		prompt: `A four bit adder adds ${a} and ${b}. What is the true sum, and what does the adder's carry out show?`,
		detail: `${bin(a, WIDTH)} + ${bin(b, WIDTH)}`,
		options,
		answer,
		hints: [
			'Four bits hold 0 to 15. The carry out is 1 exactly when the true sum is bigger than that, so it is a fifth bit worth 16.',
			`${a} + ${b} = ${a + b}. Is that more than 15?`
		],
		explanation: `${a} + ${b} = ${a + b}. ${
			sum.carryOut
				? `That is more than 15, so it does not fit in four bits: the sum bits show ${sum.sumBits.join('')} (${
						sum.unsigned
				  }) and the carry out is 1, worth 16. 16 + ${sum.unsigned} = ${a + b}.`
				: `That fits in four bits, so the sum bits show ${sum.sumBits.join('')} (${
						sum.unsigned
				  }) and the carry out is 0.`
		}`
	};
};

// --- Negative numbers -------------------------------------------------------

export const signedPatternValue = (random: Random): CourseQuestion => {
	const width = pick(random, [4, 4, 8]);
	const codes = representations(width);
	// Patterns with the top bit set are the interesting ones, so they come up twice as often.
	const negative = random() < 2 / 3;
	const code = pick(
		random,
		codes.filter((c) => c.unsigned !== 0 && c.twosComplement < 0 === negative)
	);
	const top = 2 ** (width - 1);
	const rest = code.unsigned - (code.bits[0] ? top : 0);
	const right = signed(code.twosComplement);
	const distractors = [
		signed(code.unsigned),
		signed(code.signMagnitude),
		signed(-code.twosComplement),
		// Subtracting the top weight when the top bit is 0, or forgetting to when it is 1.
		signed(code.bits[0] ? code.unsigned : code.unsigned - top),
		signed(code.bits[0] ? -rest : code.unsigned - 2 * top)
	];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `Read as a ${width}-bit two's complement number, what is ${code.pattern}?`.replace('a 8-bit', 'an 8-bit'),
		detail: code.pattern,
		options,
		answer,
		hints: [
			`In two's complement the top bit is worth −${top} instead of +${top}. Every other bit keeps its usual weight.`,
			code.bits[0]
				? `The top bit is 1, so start from −${top} and add the weights of the other 1s, which come to ${rest}.`
				: `The top bit is 0, so nothing is subtracted: the number is the same as the unsigned reading.`
		],
		explanation: code.bits[0]
			? `The top bit is 1 and worth −${top}. The remaining bits are worth ${rest}. −${top} + ${rest} = ${right}.`
			: `The top bit is 0, so nothing is subtracted and the pattern reads as plain ${right}, the same as unsigned.`
	};
};

const negateNumber = (random: Random): CourseQuestion => {
	const values = Array.from({ length: 15 }, (_, i) => i - 7).filter((v) => v !== 0);
	const value = pick(random, values);
	const steps = negate(value, WIDTH);
	const right = steps.result.join('');
	const distractors = [
		steps.inverted.join(''),
		steps.original.join(''),
		// The sign-magnitude trap: flip the top bit and leave the rest.
		toBits(Math.abs(value), WIDTH)
			.map((bit, i) => (i === 0 ? (value < 0 ? 0 : 1) : bit))
			.join(''),
		// Flipping only the top bit of the pattern, and an off by one.
		steps.original.map((bit, i) => (i === 0 ? 1 - bit : bit)).join(''),
		toBits(-value + 1, WIDTH).join('')
	];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `In four bits, ${signed(value)} is ${steps.original.join('')}. What is the pattern for ${signed(-value)}?`,
		detail: steps.original.join(''),
		options,
		answer,
		hints: [
			"To negate a two's complement number, invert every bit and then add 1. The same two steps work whether you start from a positive or a negative number.",
			`Inverting ${steps.original.join('')} gives ${steps.inverted.join('')}. Now add 1 to that.`
		],
		explanation: `Start from ${steps.original.join('')}. Invert every bit: ${steps.inverted.join(
			''
		)}. Add 1: ${right}. Check by reading it with the top bit worth −8: it comes to ${signed(steps.reading)}.`
	};
};

const rangeForBits = (random: Random): CourseQuestion => {
	const n = int(random, 3, 8);
	const { signedMin, signedMax, unsignedMax } = rangeOf(n);
	const right = `${signed(signedMin)} to ${signed(signedMax)}`;
	const distractors = [
		`0 to ${unsignedMax}`,
		`${signed(signedMin)} to ${signed(-signedMin)}`,
		`${signed(-unsignedMax)} to ${unsignedMax}`,
		`${signed(signedMin + 1)} to ${signed(signedMax)}`
	];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `What range of numbers can ${n} bits hold in two's complement?`,
		options,
		answer,
		hints: [
			`${n} bits make 2^${n} = ${
				unsignedMax + 1
			} patterns. Half of them, the ones with a 1 on top, are negative; the other half are zero and the positives.`,
			`The most negative pattern is 1 followed by zeros, worth −${-signedMin}. The most positive is 0 followed by ones, worth ${signedMax}.`
		],
		explanation: `The top bit is worth −2^${n - 1} = ${signed(
			signedMin
		)}, which on its own is the most negative number. With the top bit 0 the biggest value is all the other bits set, 2^${
			n - 1
		} − 1 = ${signedMax}. So the range is ${right}: one more negative number than positive, because zero uses one of the non-negative patterns.`
	};
};

const doesOverflow = (random: Random): CourseQuestion => {
	const { signedMin, signedMax } = rangeOf(WIDTH);
	const a = int(random, signedMin, signedMax);
	const b = int(random, signedMin, signedMax);
	const sum = addSigned(a, b, WIDTH);
	const pattern = sum.sumBits.join('');
	const result = signed(sum.resultSigned);
	const expected = signed(sum.expected);
	const right = sum.overflow ? `overflow: it reads as ${result}` : `no overflow: it reads as ${result}`;
	const distractors = sum.overflow
		? [
				`no overflow: it reads as ${expected}`,
				`no overflow: it reads as ${result}`,
				`overflow: it reads as ${expected}`
		  ]
		: [
				`overflow: it reads as ${result}`,
				`overflow: it reads as ${signed(-sum.resultSigned)}`,
				`no overflow: it reads as ${sum.unsigned}`,
				`overflow: the carry out is ${sum.carryOut}`
		  ];
	const { options, answer } = assemble(random, right, distractors);
	const aBits = sum.aBits.join('');
	const bBits = sum.bBits.join('');
	return {
		prompt: `In four bit two's complement, ${signed(a)} is ${aBits} and ${signed(
			b
		)} is ${bBits}. The adder gives ${pattern}. Did the addition overflow?`,
		detail: `${aBits} + ${bBits} = ${pattern}`,
		options,
		answer,
		hints: [
			'Four bits hold −8 to 7. Overflow means the true answer is outside that range, and the sign of the result pattern is then wrong: two positives give a negative, or two negatives give a positive.',
			`The true answer is ${signed(a)} + ${signed(
				b
			)} = ${expected}. Read ${pattern} with the top bit worth −8 and compare.`
		],
		explanation: `${signed(a)} + ${signed(
			b
		)} = ${expected}. The pattern ${pattern} reads as ${result} in two's complement. ${
			sum.overflow
				? `Those differ, so the addition overflowed: ${expected} is outside −8 to 7 and the sign came out wrong.`
				: `Those agree, so there was no overflow${
						sum.carryOut
							? ', even though the adder produced a carry out of 1. For signed numbers the carry out is ignored'
							: ''
				  }.`
		}`
	};
};

// --- Multiplexers, decoders and comparators ---------------------------------

const muxAst = parseExpression(must(circuitBySlug('multiplexer'), 'multiplexer').outputs[0].expression);
const mux2 = (s: boolean, a: boolean, b: boolean) => evaluate(muxAst, { s, a, b });
/** A 4-to-1 mux as a tree of three 2-to-1 muxes. */
const mux4 = (s1: boolean, s0: boolean, d: boolean[]) => mux2(s1, mux2(s0, d[0], d[1]), mux2(s0, d[2], d[3]));

const muxPasses = (random: Random): CourseQuestion => {
	const code = int(random, 0, 3);
	const s1 = !!(code & 2);
	const s0 = !!(code & 1);
	// The input that reaches the output is the one whose lone 1 shows up there.
	const passed = must(
		[0, 1, 2, 3].find((i) =>
			mux4(
				s1,
				s0,
				[0, 1, 2, 3].map((j) => j === i)
			)
		),
		'passed input'
	);
	const { options, answer } = assemble(random, `d${passed}`, ['d0', 'd1', 'd2', 'd3']);
	return {
		prompt: `A 4-to-1 multiplexer has inputs d0 to d3 and select lines s1 and s0. With s1 = ${s1 ? 1 : 0} and s0 = ${
			s0 ? 1 : 0
		}, which input reaches the output?`,
		detail: `s1 s0 = ${s1 ? 1 : 0}${s0 ? 1 : 0}`,
		options,
		answer,
		hints: [
			'Read the select lines as a two bit number, s1 first. That number is the index of the input that gets through.',
			`s1 s0 = ${s1 ? 1 : 0}${s0 ? 1 : 0} is ${code} in decimal.`
		],
		explanation: `The select code ${s1 ? 1 : 0}${
			s0 ? 1 : 0
		} is ${code}, so the multiplexer passes d${passed} and ignores the other three inputs.`
	};
};

const decoderLines = must(circuitBySlug('decoder'), 'decoder').outputs.map((o) => ({
	name: o.name,
	ast: parseExpression(o.expression)
}));

const decoderLine = (random: Random): CourseQuestion => {
	const code = int(random, 0, 3);
	const a = !!(code & 2);
	const b = !!(code & 1);
	const high = must(
		decoderLines.find((line) => evaluate(line.ast, { a, b })),
		'high line'
	);
	const { options, answer } = assemble(
		random,
		high.name,
		decoderLines.map((l) => l.name)
	);
	return {
		prompt: `A 2-to-4 decoder has inputs a (the top bit) and b, and outputs y0 to y3. With a = ${a ? 1 : 0} and b = ${
			b ? 1 : 0
		}, which output is high?`,
		detail: `a b = ${a ? 1 : 0}${b ? 1 : 0}`,
		options,
		answer,
		hints: [
			'A decoder raises exactly one output: the one whose number matches the input read as a binary number.',
			`a b = ${a ? 1 : 0}${b ? 1 : 0} is ${code} in decimal, and the outputs are numbered from 0.`
		],
		explanation: `The input ${a ? 1 : 0}${b ? 1 : 0} is ${code}, so ${
			high.name
		} goes high and the other three stay low. In gates, ${high.name} is ${a ? 'a' : 'NOT a'} AND ${b ? 'b' : 'NOT b'}.`
	};
};

const selectLines = (random: Random): CourseQuestion => {
	const k = int(random, 1, 5);
	const n = 2 ** k;
	const { options, answer } = assemble(random, String(k), [String(n / 2), String(k + 1), String(k - 1), String(2 * n)]);
	return {
		prompt: `How many select lines does a multiplexer need to choose between ${n} inputs?`,
		options,
		answer,
		hints: [
			'Each select line doubles the number of inputs that can be told apart: one line picks between 2, two lines between 4, and so on.',
			`Start from 1 and double until you reach ${n}: ${Array.from({ length: k }, (_, i) => 2 ** (i + 1)).join(
				', '
			)}. The number of doublings is the number of select lines.`
		],
		explanation: `${k} select lines make 2^${k} = ${n} different codes, one per input. Fewer lines could not name every input; more would leave codes unused.`
	};
};

const comparatorOutputs = Object.fromEntries(
	must(circuitBySlug('comparator'), 'comparator').outputs.map((o) => [o.name, parseExpression(o.expression)])
);
/** One column of a comparator, from the reference expressions. */
const compareBit = (a: boolean, b: boolean) => ({
	equal: evaluate(comparatorOutputs.equal, { a, b }),
	greater: evaluate(comparatorOutputs.greater, { a, b }),
	less: evaluate(comparatorOutputs.less, { a, b })
});

const compareTwoBit = (random: Random): CourseQuestion => {
	const a = int(random, 0, 3);
	const b = int(random, 0, 3);
	// Compare from the top bit down; the lower bit only matters when the top bits match.
	const top = compareBit(!!(a & 2), !!(b & 2));
	const low = compareBit(!!(a & 1), !!(b & 1));
	const verdict = top.equal ? low : top;
	const right = verdict.equal ? 'A = B' : verdict.greater ? 'A > B' : 'A < B';
	const { options, answer } = assemble(random, right, ['A = B', 'A > B', 'A < B']);
	return {
		prompt: `A comparator is given A = ${bin(a, 2)} and B = ${bin(b, 2)}. Which of its outputs is high?`,
		detail: `A = ${bin(a, 2)}, B = ${bin(b, 2)}`,
		options,
		answer,
		hints: [
			'Compare the top bits first. If they differ, that decides it. Only if they are equal do you look at the bottom bits.',
			`The top bits are ${a & 2 ? 1 : 0} and ${b & 2 ? 1 : 0}${
				top.equal
					? `, which are equal, so look at the bottom bits: ${a & 1} and ${b & 1}`
					: ', which differ, so they decide'
			}.`
		],
		explanation: `Top bits: ${a & 2 ? 1 : 0} against ${b & 2 ? 1 : 0}. ${
			top.equal
				? `Equal, so the bottom bits decide: ${a & 1} against ${b & 1}, so ${right}.`
				: `They differ, so ${right} whatever the bottom bits are.`
		} In decimal that is ${a} against ${b}.`
	};
};

// --- The seven-segment display ----------------------------------------------

const listSegments = (segments: string) => segments.split('').join(', ');

const segmentsForDigit = (random: Random): CourseQuestion => {
	const digit = int(random, 0, 9);
	const right = listSegments(digitSegments[digit]);
	const others = digitSegments.filter((s) => s !== digitSegments[digit]);
	const distractors = shuffle(random, others).slice(0, 4).map(listSegments);
	const { options, answer } = assemble(random, right, distractors);
	const dark = segmentNames.filter((s) => !digitSegments[digit].includes(s));
	return {
		prompt: `Which segments light up to show the digit ${digit}?`,
		detail: `digit ${digit}, input ${bin(digit, 4)}`,
		options,
		answer,
		hints: [
			'The bars are lettered a across the top, then b, c, d clockwise to the bottom, e and f back up the left, and g across the middle. Draw the digit and read off which bars it uses.',
			`For a ${digit}, the bars left dark are ${dark.length ? listSegments(dark.join('')) : 'none: every bar is lit'}.`
		],
		explanation: `A ${digit} uses ${right}${
			dark.length ? `, leaving ${listSegments(dark.join(''))} dark` : ': all seven bars'
		}. The decoder's row for input ${bin(digit, 4)} has a 1 in exactly those output columns.`
	};
};

export const digitForSegments = (random: Random): CourseQuestion => {
	const digit = int(random, 0, 9);
	const distractors = [String((digit + 1) % 10), String((digit + 9) % 10), String((digit + 5) % 10)];
	const { options, answer } = assemble(random, String(digit), distractors);
	const dark = segmentNames.filter((s) => !digitSegments[digit].includes(s));
	return {
		prompt: `A seven-segment display has segments ${listSegments(
			digitSegments[digit]
		)} lit and the rest dark. Which digit is showing?`,
		detail: digitSegments[digit],
		options,
		answer,
		hints: [
			'Sketch the figure eight, letter it a on top then b, c, d clockwise, e and f up the left, g in the middle, and shade the lit bars.',
			`The dark bars are ${dark.length ? listSegments(dark.join('')) : 'none'}. ${
				dark.length
					? `Which digit is drawn without ${dark.length === 1 ? 'that bar' : 'those bars'}?`
					: 'Every bar is lit.'
			}`
		],
		explanation: `Segments ${listSegments(digitSegments[digit])} lit${
			dark.length ? `, with ${listSegments(dark.join(''))} dark,` : ''
		} draw a ${digit}. It is the only digit with exactly that set of bars.`
	};
};

const decoderSize = (random: Random): CourseQuestion => {
	const asks = [
		{
			prompt: 'How many outputs does a seven-segment decoder have?',
			right: '7',
			wrong: ['4', '10', '16'],
			why: 'one per bar of the display, a to g. The digit itself is never an output; it is the pattern the bars make together.'
		},
		{
			prompt: 'How many inputs does a BCD to seven-segment decoder have?',
			right: '4',
			wrong: ['7', '10', '2'],
			why: 'a decimal digit 0 to 9 needs four bits, since three bits only reach 7.'
		},
		{
			prompt: 'How many separate boolean functions, each simplified on its own map, make up a seven-segment decoder?',
			right: '7',
			wrong: ['1', '4', '10'],
			why: 'one per segment, each a function of the same four inputs with its own output column. They are usually written as one truth table with seven output columns.'
		}
	];
	const ask = pick(random, asks);
	const { options, answer } = assemble(random, ask.right, ask.wrong);
	return {
		prompt: ask.prompt,
		options,
		answer,
		hints: [
			'The decoder turns a four bit digit code into on-or-off signals, one per bar of the display.',
			`Count the bars of a figure eight for the outputs, and the bits needed to write 9 in binary for the inputs. The answer here is ${ask.right}.`
		],
		explanation: `${ask.right}: ${ask.why}`
	};
};

const validBcd = (random: Random): CourseQuestion => {
	const code = int(random, 0, 15);
	const pattern = bin(code, 4);
	const valid = code <= 9;
	const right = valid ? `yes, it is the digit ${code}` : `no, ${code} is not a decimal digit`;
	const distractors = valid
		? [
				`no, ${code} is not a decimal digit`,
				`yes, it is the digit ${(code + 1) % 10}`,
				`no, only codes above 9 are valid`
		  ]
		: [`yes, it is the digit ${code}`, `yes, it is the digit ${code - 10}`, `no, ${code} is odd`];
	const { options, answer } = assemble(random, right, distractors);
	return {
		prompt: `Is ${pattern} a valid input to a BCD seven-segment decoder?`,
		detail: pattern,
		options,
		answer,
		hints: [
			'BCD writes one decimal digit, 0 to 9, in four bits. Four bits can hold 0 to 15, so six of the sixteen patterns are never used.',
			`${pattern} is ${code} in binary. Is that one of the digits 0 to 9?`
		],
		explanation: `${pattern} is ${code}. ${
			valid
				? `That is a decimal digit, so it is valid BCD and the decoder shows a ${code}.`
				: `Decimal digits stop at 9, so ${code} never arrives at a BCD decoder. Its row of the truth table is a don't care, and whatever the circuit shows for it is never seen.`
		}`
	};
};

export const build: StageMeta = {
	id: 'build',
	title: 'Building circuits that compute',
	tagline: 'Adders, subtractors, selectors and decoders, built from what you know.',
	lessons: [
		{
			slug: 'the-half-adder',
			title: 'The half adder',
			blurb: 'Adding two bits has four cases, and two gates you already know cover them.',
			description:
				'The half adder: adding two bits gives a sum and a carry, the sum column is XOR and the carry column is AND, so two gates add. Build it in the simulator.',
			minutes: 10,
			generators: [halfAdderOutputs, whichGateMakes, whyOnePlusOne, fromPractice('gates')],
			deeper: [
				{ href: '/common-circuits/half-adder', label: 'Half adder reference' },
				{ href: '/common-circuits', label: 'Common circuits' }
			],
			build: { href: '/simulator', label: 'a half adder: two toggles, an XOR, an AND, two displays' }
		},
		{
			slug: 'the-full-adder',
			title: 'The full adder',
			blurb: 'A third input for the carry coming in, which is what lets adders be chained.',
			description:
				'The full adder: a carry in as third input, sum as a XOR b XOR c, carry out when at least two inputs are 1, and building it from two half adders and an OR.',
			minutes: 12,
			generators: [fullAdderOutputs, howManyOnes, whichCombine, fromPractice('expressions')],
			deeper: [
				{ href: '/common-circuits/full-adder', label: 'Full adder reference' },
				{ href: '/ripple-carry-adder', label: 'The ripple carry adder' }
			],
			build: { href: '/simulator', label: 'a full adder from two half adder chips and an OR' }
		},
		{
			slug: 'adding-whole-numbers',
			title: 'Adding whole numbers',
			blurb: 'Chain full adders and the carry ripples along: a four bit adder, traced column by column.',
			description:
				'The ripple carry adder: full adders chained by their carries, a four bit sum traced column by column, what the carry out means, and why the ripple is slow.',
			minutes: 14,
			generators: [addFourBit, firstCarryColumn, howManyAdders, didItFit],
			deeper: [
				{ href: '/ripple-carry-adder', label: 'The ripple carry adder' },
				{ href: '/ripple-carry-adder#lookahead', label: 'Carry lookahead' }
			],
			build: { href: '/simulator#example:Calculator', label: 'the four bit calculator' }
		},
		{
			slug: 'negative-numbers',
			title: 'Negative numbers and subtraction',
			blurb: "Two's complement: make the top bit negative and the same adder subtracts.",
			description:
				"Two's complement: the top bit worth minus 2 to the n minus 1, negation by invert and add 1, subtraction with the same adder, the range, and signed overflow.",
			minutes: 15,
			generators: [signedPatternValue, negateNumber, rangeForBits, doesOverflow],
			deeper: [
				{ href: '/twos-complement', label: "Two's complement" },
				{ href: '/binary-converter', label: 'Binary converter' }
			]
		},
		{
			slug: 'choosing-and-decoding',
			title: 'Multiplexers, decoders and comparators',
			blurb:
				'Three more circuits that are nothing but truth tables: pick an input, light one line, compare two numbers.',
			description:
				'Multiplexers, decoders and comparators: a mux picks one input by a select code, a decoder lights one line per code, a comparator says equal, less or greater.',
			minutes: 13,
			generators: [muxPasses, decoderLine, selectLines, compareTwoBit],
			deeper: [
				{ href: '/common-circuits/multiplexer', label: 'Multiplexer reference' },
				{ href: '/common-circuits/decoder', label: 'Decoder reference' },
				{ href: '/common-circuits/comparator', label: 'Comparator reference' }
			]
		},
		{
			slug: 'the-seven-segment-display',
			title: 'Driving a seven-segment display',
			blurb:
				'Four bits in, seven bars out: seven truth tables that share their inputs, with six rows nobody cares about.',
			description:
				"The seven-segment decoder: bars a to g, four BCD input bits driving seven outputs, six don't care codes, and one segment's expression derived from its map.",
			minutes: 13,
			generators: [segmentsForDigit, digitForSegments, decoderSize, validBcd],
			deeper: [
				{ href: '/seven-segment-decoder', label: 'The seven-segment decoder' },
				{ href: '/logic-circuit-generator', label: 'Circuit diagram generator' }
			],
			build: { href: '/simulator#example:7%20Segment-display', label: 'the seven segment display example' }
		}
	]
};
