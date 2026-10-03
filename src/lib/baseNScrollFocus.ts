// A box that scrolls (a wide table, a long working table, a 40-bit-wide
// drawing) has to be reachable by keyboard, or someone without a mouse cannot
// see the part that is cut off. Safari never focuses such a box by itself, and
// Chrome and Firefox do but give it no name. So while, and only while, the box
// actually overflows, it becomes a named, focusable region; a box that fits
// stays out of the tab order, where an extra stop would only be noise.
//
// Set from code rather than written in the markup, because Svelte 3's a11y
// check wrongly flags tabindex on an element with role="region".

/** Svelte action: `use:scrollFocus={'Name read out for the box'}`. */
export function scrollFocus(node: HTMLElement, label: string) {
	let name = label;
	const update = () => {
		const overflows = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
		if (overflows) {
			node.tabIndex = 0;
			node.setAttribute('role', 'region');
			node.setAttribute('aria-label', name);
		} else {
			node.removeAttribute('tabindex');
			node.removeAttribute('role');
			node.removeAttribute('aria-label');
		}
	};
	// Re-checked when the box resizes and when what is in it changes.
	const resized = new ResizeObserver(update);
	resized.observe(node);
	const changed = new MutationObserver(update);
	changed.observe(node, { subtree: true, childList: true, characterData: true, attributeFilter: ['class'] });
	update();
	return {
		update(next: string) {
			name = next;
			update();
		},
		destroy() {
			resized.disconnect();
			changed.disconnect();
		}
	};
}
