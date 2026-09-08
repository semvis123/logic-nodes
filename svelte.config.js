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
			useVitePreprocess: true
		}
	},
	kit: {
		adapter: adapter(),
		prerender: {
			// The editor reads `#example:Name` at runtime to load a built-in
			// circuit, so those fragments are not anchors on the page. Warn rather
			// than fail, so a genuinely broken in-page link still shows up.
			handleMissingId: 'warn'
		}
	}
};

export default config;
