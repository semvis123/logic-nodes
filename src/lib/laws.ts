// The laws of boolean algebra, shared by the calculator and the reference page.
// Every entry is verified against a full truth table in the test suite, so a
// typo here fails the build rather than teaching someone the wrong rule.

export type Law = {
	name: string;
	category: 'Basic' | 'Order' | 'Distribution' | 'Negation' | 'Reduction' | 'Exclusive or';
	left: string;
	right: string;
	/** Why it matters, in one line. */
	note: string;
};

/** Anchor for a law, so a shown derivation can link the law it just applied. */
export const lawSlug = (name: string) => `law-${name.toLowerCase().replace(/\s+/g, '-')}`;

export const laws: Law[] = [
	{
		name: 'Identity',
		category: 'Basic',
		left: 'a ∧ 1',
		right: 'a',
		note: 'ANDing with 1 leaves a signal untouched, which is how an enable line passes data through.'
	},
	{
		name: 'Identity',
		category: 'Basic',
		left: 'a ∨ 0',
		right: 'a',
		note: 'The OR counterpart: 0 is the neutral value for OR, the way 1 is for AND.'
	},
	{
		name: 'Annulment',
		category: 'Basic',
		left: 'a ∧ 0',
		right: '0',
		note: 'A single 0 into an AND forces the output low no matter what else happens.'
	},
	{
		name: 'Annulment',
		category: 'Basic',
		left: 'a ∨ 1',
		right: '1',
		note: 'And a single 1 into an OR pins the output high.'
	},
	{
		name: 'Idempotence',
		category: 'Basic',
		left: 'a ∧ a',
		right: 'a',
		note: 'Feeding one signal into both inputs of a gate wastes a gate.'
	},
	{
		name: 'Idempotence',
		category: 'Basic',
		left: 'a ∨ a',
		right: 'a',
		note: 'Wiring one signal into both inputs of an OR gate is just as wasteful.'
	},
	{
		name: 'Complement',
		category: 'Negation',
		left: 'a ∧ ¬a',
		right: '0',
		note: 'A signal and its inverse are never both high, so the AND can never fire.'
	},
	{
		name: 'Complement',
		category: 'Negation',
		left: 'a ∨ ¬a',
		right: '1',
		note: 'One of the two is always high, so the OR is always high.'
	},
	{
		name: 'Double negation',
		category: 'Negation',
		left: '¬(¬a)',
		right: 'a',
		note: 'Two inverters in a row cancel out, though they are still useful as a buffer.'
	},
	{
		name: 'Constant negation',
		category: 'Negation',
		left: '¬0',
		right: '1',
		note: 'An inverter tied low sits high, which is how a 1 is made where no signal supplies one.'
	},
	{
		name: 'Constant negation',
		category: 'Negation',
		left: '¬1',
		right: '0',
		note: 'And the other way round. Not much of a theorem, but it is the step that clears a negated constant out of an expression.'
	},
	{
		name: 'Commutativity',
		category: 'Order',
		left: 'a ∧ b',
		right: 'b ∧ a',
		note: 'Input order does not matter to a gate.'
	},
	{
		name: 'Commutativity',
		category: 'Order',
		left: 'a ∨ b',
		right: 'b ∨ a',
		note: 'The same holds for OR, and for every other two input gate on this site.'
	},
	{
		name: 'Associativity',
		category: 'Order',
		left: '(a ∧ b) ∧ c',
		right: 'a ∧ (b ∧ c)',
		note: 'Grouping does not matter either, which is why a three input AND gate is well defined.'
	},
	{
		name: 'Associativity',
		category: 'Order',
		left: '(a ∨ b) ∨ c',
		right: 'a ∨ (b ∨ c)',
		note: 'So a wide OR can be built from a chain of two input ORs.'
	},
	{
		name: 'Distributivity',
		category: 'Distribution',
		left: 'a ∧ (b ∨ c)',
		right: '(a ∧ b) ∨ (a ∧ c)',
		note: 'Reads like ordinary algebra: AND distributes over OR.'
	},
	{
		name: 'Distributivity',
		category: 'Distribution',
		left: 'a ∨ (b ∧ c)',
		right: '(a ∨ b) ∧ (a ∨ c)',
		note: 'Unlike ordinary algebra, it works the other way round too: OR distributes over AND.'
	},
	{
		name: 'De Morgan',
		category: 'Negation',
		left: '¬(a ∧ b)',
		right: '¬a ∨ ¬b',
		note: 'Push a negation through a bracket and AND becomes OR. The rule behind every NAND-only design.'
	},
	{
		name: 'De Morgan',
		category: 'Negation',
		left: '¬(a ∨ b)',
		right: '¬a ∧ ¬b',
		note: 'The mirror image of the first, and the reason NOR is universal in the same way NAND is.'
	},
	{
		name: 'Absorption',
		category: 'Reduction',
		left: 'a ∨ (a ∧ b)',
		right: 'a',
		note: 'If a alone is enough, the extra term adds nothing. Deletes a gate outright.'
	},
	{
		name: 'Absorption',
		category: 'Reduction',
		left: 'a ∧ (a ∨ b)',
		right: 'a',
		note: 'The dual form: if a is low the whole thing is low regardless of b.'
	},
	{
		name: 'Redundancy',
		category: 'Reduction',
		left: 'a ∨ (¬a ∧ b)',
		right: 'a ∨ b',
		note: 'The ¬a is doing no work: if a is low the second term decides, and if a is high the first does.'
	},
	{
		name: 'Redundancy',
		category: 'Reduction',
		left: 'a ∧ (¬a ∨ b)',
		right: 'a ∧ b',
		note: 'The dual. Easy to miss by eye, which is why minimisers earn their keep.'
	},
	{
		name: 'Adjacency',
		category: 'Reduction',
		left: '(a ∧ b) ∨ (a ∧ ¬b)',
		right: 'a',
		note: 'b takes both values, so it cancels. This is exactly what grouping two squares on a Karnaugh map does.'
	},
	{
		name: 'Consensus',
		category: 'Reduction',
		left: '(a ∧ b) ∨ (¬a ∧ c) ∨ (b ∧ c)',
		right: '(a ∧ b) ∨ (¬a ∧ c)',
		note: 'The third term is already covered by the other two. The classic trap when minimising by hand.'
	},
	{
		name: 'Consensus',
		category: 'Reduction',
		left: '(a ∨ b) ∧ (¬a ∨ c) ∧ (b ∨ c)',
		right: '(a ∨ b) ∧ (¬a ∨ c)',
		note: 'The product of sums version of the same idea.'
	},
	{
		name: 'Definition',
		category: 'Exclusive or',
		left: 'a ⊻ b',
		right: '(a ∧ ¬b) ∨ (¬a ∧ b)',
		note: 'XOR written with the basic three, which is how it is built when no XOR gate is available.'
	},
	{
		name: 'Identity',
		category: 'Exclusive or',
		left: 'a ⊻ 0',
		right: 'a',
		note: 'XOR with 0 passes the signal through unchanged.'
	},
	{
		name: 'Inversion',
		category: 'Exclusive or',
		left: 'a ⊻ 1',
		right: '¬a',
		note: 'XOR with 1 inverts it, which makes XOR a controlled inverter.'
	},
	{
		name: 'Self cancel',
		category: 'Exclusive or',
		left: 'a ⊻ a',
		right: '0',
		note: 'Anything XORed with itself is 0, the property behind parity checks.'
	}
];

export const lawCategories = [...new Set(laws.map((law) => law.category))];
