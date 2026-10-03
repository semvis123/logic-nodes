// A box that scrolls has to be reachable by keyboard, or Safari users cannot
// scroll it at all. But a box that fits needs no tab stop, and an unnamed one
// is noise, so the tab stop, role and name are added only while it overflows.
// The same action as on the bit manipulation page, extended to boxes that
// scroll vertically.

/** Makes `node` a named, focusable region while its content overflows it. Name it with data-label. */
export function scrollFocus(node: HTMLElement) {
	const update = () => {
		if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) {
			node.tabIndex = 0;
			node.setAttribute('role', 'region');
			node.setAttribute('aria-label', node.dataset.label ?? 'Table');
		} else {
			node.removeAttribute('tabindex');
			node.removeAttribute('role');
			node.removeAttribute('aria-label');
		}
	};
	// Re-checked when the box resizes and when what is in it changes.
	const ro = new ResizeObserver(update);
	ro.observe(node);
	const mo = new MutationObserver(update);
	mo.observe(node, { subtree: true, childList: true, characterData: true });
	update();
	return {
		destroy: () => {
			ro.disconnect();
			mo.disconnect();
		}
	};
}
