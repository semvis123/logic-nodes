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
		// Every route's stylesheet is under 12 KB, and fetching them was two
		// extra round trips in front of the first paint. Inlining them costs a
		// couple of KB of gzipped HTML on a cold load, which is the only time it
		// is paid: client side navigation never refetches the document.
		inlineStyleThreshold: 12288,
		prerender: {
			// The editor reads `#example:Name` at runtime to load a built-in
			// circuit, so those fragments are not anchors on the page. Warn rather
			// than fail, so a genuinely broken in-page link still shows up.
			handleMissingId: 'warn'
		}
	}
};

export default config;
