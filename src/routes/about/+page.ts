import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The about content is the homepage now; keep the old URL working.
export const prerender = true;

export const load: PageLoad = () => {
	throw redirect(308, '/');
};
