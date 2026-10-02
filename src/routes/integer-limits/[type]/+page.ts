import { error } from '@sveltejs/kit';
import { intTypeBySlug } from '$lib/intLimits';
import type { PageLoad } from './$types';

// Prerendered: the crawler reaches every type from the /integer-limits table.
export const prerender = true;

export const load: PageLoad = ({ params }) => {
	const type = intTypeBySlug(params.type);
	if (!type) throw error(404, `No such integer type: ${params.type}`);
	return { slug: type.slug };
};
