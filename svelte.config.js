import adapter from '@sveltejs/adapter-node';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	compilerOptions: {
		css: false,
		hydratable: false,
	},
	preprocess: preprocess(),
	experimental: {
		useVitePreprocess: true,
		prebundleSvelteLibraries: true,
	},
	kit: {
		adapter: adapter({
			precompress: true,
		})
	}
};

export default config;
