import { error } from '@sveltejs/kit';
import { flipFlopBySlug } from '$lib/flipflops';
import type { PageLoad } from './$types';

// Prerendered: the crawler reaches each one from the /flip-flops index.
export const prerender = true;

export const load: PageLoad = ({ params }) => {
	const flipFlop = flipFlopBySlug(params.type);
	if (!flipFlop) throw error(404, `No such flip-flop: ${params.type}`);
	return { flipFlop };
};
