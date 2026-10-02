// Long grouped numbers (a 128-bit limit is 40 digits) have no break
// opportunity of their own: line breaking treats "1,234" as one word. Rather
// than let CSS break anywhere, which splits digit groups and starts lines with
// commas, these helpers mark the gaps between groups as the only places to break.

const escapeHtml = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped text with a <wbr> after every comma that separates digit groups, for {@html}. */
export const breakable = (s: string): string => escapeHtml(s).replace(/(\d,)(?=\d)/g, '$1<wbr>');
