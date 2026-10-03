/**
 * Lets keyboard users scroll a box whose content is wider or taller than the
 * box, and only then: while it overflows it gets tabindex 0, the region role
 * and a name, from the action's argument or else from data-label. A box that
 * fits stays out of the tab order, so it is not an empty stop. Any role or name
 * the box had of its own comes back when it stops overflowing.
 *
 * Set from code rather than written in the markup, because Svelte 3's a11y
 * check wrongly flags tabindex on an element with role="region".
 *
 * Use: `use:scrollRegion data-label="Name read out"` or `use:scrollRegion={'Name'}`.
 */
export function scrollRegion(node: HTMLElement, label?: string) {
	const role = node.getAttribute('role');
	const name = node.getAttribute('aria-label');
	const restore = (attr: string, value: string | null) =>
		value === null ? node.removeAttribute(attr) : node.setAttribute(attr, value);
	const update = () => {
		const overflows = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
		if (overflows) {
			node.tabIndex = 0;
			node.setAttribute('role', 'region');
			node.setAttribute('aria-label', label ?? node.dataset.label ?? name ?? 'Scrollable table');
		} else {
			node.removeAttribute('tabindex');
			restore('role', role);
			restore('aria-label', name);
		}
	};
	// Re-checked when the box resizes (which includes a closed details being
	// opened), when its content's size changes, and when what is in it changes.
	const ro = new ResizeObserver(update);
	ro.observe(node);
	if (node.firstElementChild) ro.observe(node.firstElementChild);
	const mo = new MutationObserver(update);
	mo.observe(node, { subtree: true, childList: true, characterData: true, attributeFilter: ['class'] });
	update();
	return {
		update(next?: string) {
			label = next;
			update();
		},
		destroy: () => {
			ro.disconnect();
			mo.disconnect();
		}
	};
}
