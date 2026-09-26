import { searchIndex } from '$lib/searchIndex';

export const prerender = true;

export function GET() {
	return new Response(JSON.stringify(searchIndex()), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' }
	});
}
