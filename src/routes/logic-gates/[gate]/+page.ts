import { error } from '@sveltejs/kit';
import { gateBySlug } from '$lib/gates';
import type { PageLoad } from './$types';

// Prerendered: the crawler reaches every gate from the /logic-gates index.
export const prerender = true;

export const load: PageLoad = ({ params }) => {
	const gate = gateBySlug(params.gate);
	if (!gate) throw error(404, `No such gate: ${params.gate}`);
	return { gate };
};
