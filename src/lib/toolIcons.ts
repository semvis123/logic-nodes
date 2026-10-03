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
	// B64, the usual short form of Base64.
	'/base64':
		'<path d="M2 7v10M2 7h2a2.5 2.5 0 0 1 0 5H2M2 12h2.5a2.5 2.5 0 0 1 0 5H2M14 7l-4.2 6.3"/><circle cx="12" cy="14.5" r="2.5"/><path d="M21 17V7l-4.5 6.5H23"/>',
	// ∧ and ∨ on a key, ready to copy.
	'/logic-symbols-copy-paste':
		'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 15 L10 8 L13 15"/><path d="M14 9 L17 15 L20 9"/>',
	// Three float formats, each narrower than the last.
	'/fp16-bf16-fp8-converter':
		'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M6 4v4M10 4v4"/><rect x="3" y="10" width="12" height="4" rx="1"/><path d="M6 10v4M9 10v4"/><rect x="3" y="16" width="6" height="4" rx="1"/><path d="M5 16v4M7 16v4"/>',
	// 0 to Z: a digit and a letter over a baseline.
	'/base36': '<circle cx="7" cy="12" r="3"/><path d="M13 8h6l-4 8"/><path d="M3 20h18"/>',
	// A question mark: one yes/no answer per bit.
	'/guess-my-number':
		'<circle cx="12" cy="12" r="9.5"/><path d="M9 9.3a3 3 0 1 1 4.4 2.6c-.9.5-1.4 1.2-1.4 2.2v.9M12 17.3v.4"/>',
	// A block of characters, read off five bits at a time.
	'/base32':
		'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h4M7 12h4M7 15h4"/><path d="M14 9l3 3-3 3"/>',
	// Lines of text with a tick: the checksum passes.
	'/base58': '<path d="M4 7h10M4 12h7M4 17h10"/><path d="M15 14l2.5 3L21 10"/>',
	// Three finder patterns and some data modules.
	'/qr-code-generator':
		'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6zM14 14h3v3h-3zM18 18h3v3h-3zM14 20.5v.5M20.5 14h.5"/>',
	// Bars of a barcode, with the long guard bars.
	'/ean-13-barcode-generator': '<path d="M3 4v16M5.5 4v12M8 4v12M10.5 4v12M13 4v16M15.5 4v12M18 4v12M21 4v16"/>',
	// An 80-column card with a cut corner and some rectangular holes.
	'/punch-card-generator': '<path d="M7 5h13v14H3V9z"/><path d="M7 11h2M11 11h2M15 11h2M9 15h2M13 15h2"/>',
	// A grid of cells, some filled, like an XOR texture.
	'/bitwise-pattern-generator':
		'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M9 3h6v6H9zM3 9h6v6H3zM15 15h6v6h-6z"/>',
	// A seven-segment digit.
	'/seven-segment-display-designer': '<path d="M8 4h8M8 12h8M8 20h8M6 6v4M6 14v4M18 6v4M18 14v4"/>',
	// An address split into network and host parts.
	'/subnet-calculator':
		'<rect x="2" y="6" width="20" height="12" rx="1.5"/><path d="M13 6v12M5 12h5"/><circle cx="16.5" cy="12" r="1"/><circle cx="19.5" cy="12" r="1"/>',
	// One network cut into blocks of different sizes.
	'/vlsm-calculator': '<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M12 7v10M17 7v10M19.5 7v10"/>',
	// Expand outwards, compress inwards: the colons between.
	'/ipv6-expand-compress':
		'<path d="M1.5 12h5M3.5 9l3 3-3 3M22.5 12h-5M20.5 9l-3 3 3 3"/><circle cx="10.5" cy="9.5" r=".8"/><circle cx="10.5" cy="14.5" r=".8"/><circle cx="13.5" cy="9.5" r=".8"/><circle cx="13.5" cy="14.5" r=".8"/>',
	// A row of bits becoming the next row.
	'/bit-manipulation-tricks':
		'<rect x="2.5" y="4" width="19" height="6" rx="1"/><path d="M7.25 4v6M12 4v6M16.75 4v6"/><rect x="2.5" y="14" width="19" height="6" rx="1"/><path d="M7.25 14v6M12 14v6M16.75 14v6M14.4 10.5v3M13.2 12.3l1.2 1.2 1.2-1.2"/>',
	// From the minimum to the maximum, both ends marked.
	'/integer-limits': '<path d="M4 6v12M20 6v12M4 12h16M7.5 8.5 4 12l3.5 3.5M16.5 8.5 20 12l-3.5 3.5"/>',
	// A struct in memory, with hatched padding.
	'/struct-padding-calculator':
		'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18"/><path d="M9 5v7"/><path d="M15 12v7"/><path d="M11 5l4 7"/><path d="M13 5l4 7"/><path d="M17 5l4 7"/>',
	// An ID cut into labelled fields.
	'/uuid-decoder':
		'<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v10"/><path d="M11 7v10"/><path d="M15 7v10"/><path d="M6 20h4"/><path d="M14 20h4"/>',
	// A snowflake.
	'/snowflake-id-decoder':
		'<path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M4.2 16.5l15.6-9"/><path d="M10 4.5l2 1.5 2-1.5"/><path d="M10 19.5l2-1.5 2 1.5"/>',
	// A file whose first bytes are highlighted.
	'/file-signature-checker':
		'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 11h6"/><path d="M9 14h6"/><rect x="8.5" y="16.5" width="4" height="2"/>'
};
