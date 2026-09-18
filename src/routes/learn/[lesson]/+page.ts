import { error } from '@sveltejs/kit';
import type { SvelteComponent } from 'svelte';
import { lessonBySlug } from '$lib/course/lessons';
import type { PageLoad } from './$types';

// Prerendered: the crawler reaches every lesson from the course home and from
// the roadmap on every other lesson.
export const prerender = true;

// One component per lesson, keyed by its slug, loaded only when its lesson is
// opened: eager imports would put every lesson's prose and widgets on every
// lesson page. The prerender still gets the HTML, since load runs on the
// server too.
const content = import.meta.glob('/src/lib/course/content/*.svelte') as Record<
	string,
	() => Promise<{ default: typeof SvelteComponent }>
>;

export const load: PageLoad = async ({ params }) => {
	const lesson = lessonBySlug(params.lesson);
	const loader = content[`/src/lib/course/content/${params.lesson}.svelte`];
	if (!lesson || !loader) throw error(404, `No such lesson: ${params.lesson}`);
	const { default: component } = await loader();
	return { slug: params.lesson, component };
};
