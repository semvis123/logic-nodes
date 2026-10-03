// Long grouped numbers (a 128-bit limit is 40 digits) have no break
// opportunity of their own: line breaking treats "1,234" as one word. Rather
// than let CSS break anywhere, which splits digit groups and starts lines with
// commas, these helpers mark the gaps between groups as the only places to break.

const escapeHtml = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// In running text, numbers up to 32 bits (2,147,483,647 is 13 characters) fit
// any line, so they stay whole: breaking them would only split a short number
// for no gain. Table cells are narrower, since they share a phone-width row
// with other columns, so they pass 0 and let every grouped number break.
const LONGEST_UNBROKEN = 13;

/**
 * Escaped text with a <wbr> after each digit-group comma of any number longer
 * than `longest` characters, for {@html}.
 */
export const breakable = (s: string, longest = LONGEST_UNBROKEN): string =>
	escapeHtml(s).replace(/\d{1,3}(?:,\d{3})+/g, (n) => (n.length > longest ? n.replace(/,/g, ',<wbr>') : n));
