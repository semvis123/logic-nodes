// One small line icon per tool, drawn on a 24 by 24 grid and stroked with
// currentColor. They sit next to the tool's name and are hidden from screen
// readers and from the link text, so the name alone still labels the link.
export const toolIcons: Record<string, string> = {
	// A table with a header row and three columns.
	'/truth-table-generator': '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M9 4v16M15 4v16"/>',
	// p → q, the conditional.
	'/propositional-logic-truth-table':
		'<circle cx="4" cy="12" r="2.3"/><path d="M1.7 9.7V19"/><circle cx="20" cy="12" r="2.3"/><path d="M22.3 9.7V19M9 12h6M13 10l2 2-2 2"/>',
	// Algebra: a bracketed sum.
	'/boolean-algebra-calculator': '<path d="M7 3.5c-4 5-4 12 0 17M17 3.5c4 5 4 12 0 17M8.5 12h7M12 8.5v7"/>',
	// A two by two map with its top row looped as one group.
	'/karnaugh-map-solver':
		'<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M12 13v8M3 13h18" stroke-opacity=".5"/><rect x="5.5" y="5" width="13" height="6" rx="3"/>',
	// Σ, the sum of the minterms.
	'/sum-of-products-calculator': '<path d="M18 5H6l6 7-6 7h12"/>',
	// A NAND gate: the AND body with the output bubble.
	'/nand-nor-converter':
		'<path d="M2 9h3M2 15h3M5 5h5a7 7 0 0 1 0 14H5z"/><circle cx="19" cy="12" r="2"/><path d="M21 12h1.5"/>',
	// One gate feeding a second.
	'/logic-circuit-generator':
		'<path d="M.75 5h2.25M.75 8h2.25M3 3h2a3.5 3.5 0 0 1 0 7H3zM8.5 6.5h3v6h3M.75 17.5h13.75M14.5 10H17a4.75 4.75 0 0 1 0 9.5h-2.5zM21.75 14.75H23"/>',
	// A sheet with a ticked question.
	'/worksheet': '<path d="M6 2.5h9l4 4v15H6z"/><path d="M15 2.5v4h4M9 11l1.5 1.5L13 10M9 16.5h7"/>',
	// Converting one way and back.
	'/binary-converter': '<path d="M4 7h11M12 4l3 3-3 3M20 17H9M12 14l-3 3 3 3"/>',
	// Gray code changes one bit per step: a staircase.
	'/gray-code-converter': '<path d="M2 19h4v-4h4v-4h4V7h4V3h4"/>',
	// ⇔, equivalent both ways.
	'/logical-equivalence-calculator':
		'<path d="M4.8 9.5h14.4M4.8 14.5h14.4M7.5 6.5 2.5 12l5 5.5M16.5 6.5l5 5.5-5 5.5"/>',
	// A root with two children, one of which has two leaves.
	'/expression-tree':
		'<circle cx="12" cy="4.5" r="2.3"/><circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="12" r="2.3"/><circle cx="3.5" cy="19.5" r="2"/><circle cx="8.5" cy="19.5" r="2"/><path d="M10.5 6.3 7.4 10.2M13.5 6.3l3.1 3.9M5 14l-1 3.6M7 14l1 3.6"/>',
	// Two overlapping sets.
	'/venn-diagram-generator': '<circle cx="9" cy="12" r="6.5"/><circle cx="15" cy="12" r="6.5"/>',
	// F → 15: a hex digit and its decimal value.
	'/hex-to-decimal':
		'<path d="M2 17V7h4.5M2 12h3.5M8 12h3M9.75 10.5l1.5 1.5-1.5 1.5M13.5 8.5 15 7v10M22 7h-3.5l-.4 4.2c.5-.2 1-.3 1.5-.3a3 3 0 0 1 0 6c-.9 0-1.7-.4-2.2-1"/>',
	// F → 1111: a hex digit is four bits.
	'/hex-to-binary':
		'<path d="M2 17V7h4.5M2 12h3.5M8 12h3M9.75 10.5l1.5 1.5-1.5 1.5M12.8 9.7 14 8.5v7M15.8 9.7 17 8.5v7M18.8 9.7 20 8.5v7M21.8 9.7 23 8.5v7"/>',
	'/binary-calculator':
		'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M7.5 5.5h9v4h-9zM8 14h2M9 13v2M14 14h2M8 18.5h2M14 18.5h2"/>',
	// F + 1: hex arithmetic.
	'/hex-calculator': '<path d="M2.5 17V7h4.5M2.5 12h3.5M9 12h5.5M11.75 9.25v5.5M17.5 8.5 20 7v10"/>',
	// 0.1, the classic number a float cannot hold exactly.
	'/ieee-754-converter':
		'<ellipse cx="6" cy="12" rx="3.5" ry="6"/><circle cx="12.5" cy="17.4" r=".55" fill="currentColor"/><path d="M15.5 8.5 18.5 6v12"/>',
	// A message written in bits.
	'/binary-translator': '<path d="M3 4h18v12H10l-4 4v-4H3z"/><path d="M7 8v4M10 8h2v4h-2zM15 8v4"/>',
	// A keyboard: every key has a code.
	'/ascii-table':
		'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 9h1M9.5 9h1M13 9h1M16.5 9h1M6 12.5h1M9.5 12.5h1M13 12.5h1M16.5 12.5h1M8 16h8"/>',
	// b64, how Base64 is often abbreviated.
	'/base64':
		'<path d="M1.5 7v10"/><circle cx="4" cy="14.5" r="2.5"/><circle cx="11" cy="14.5" r="2.5"/><path d="M13.3 7.4a4 4 0 0 0-4.8 3.9v3.2M21 17V7l-5 7h7"/>'
};
