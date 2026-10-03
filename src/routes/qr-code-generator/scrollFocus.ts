/**
 * Lets keyboard users scroll a box whose content is wider or taller than the
 * box, and only then: it becomes a named, focusable region (Safari does not
 * focus scroll boxes on its own, and an unnamed focus stop says nothing).
 * The name comes from the box's `data-label`.
 */
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
