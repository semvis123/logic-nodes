import { error } from '@sveltejs/kit';
import { circuitBySlug } from '$lib/commonCircuits';
import type { PageLoad } from './$types';

// Prerendered: the crawler reaches each one from the /common-circuits index.
export const prerender = true;

export const load: PageLoad = ({ params }) => {
	const circuit = circuitBySlug(params.circuit);
	if (!circuit) throw error(404, `No such circuit: ${params.circuit}`);
	return { circuit };
};
