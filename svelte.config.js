import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	compilerOptions: {
		css: false
	},
	preprocess: preprocess(),
	vitePlugin: {
		prebundleSvelteLibraries: true,
		experimental: {
			useVitePreprocess: true,
		}
	},
	kit: {
		adapter: adapter()
	}
};

export default config;
