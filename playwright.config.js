/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		// vite preview serves on 4173; the old value of 3000 never came up, so
		// every run timed out waiting for it.
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173',
		// Use the Chrome already on the machine rather than making every
		// checkout download a private Chromium. `npx playwright install` still
		// works if you'd rather have the pinned build.
		channel: 'chrome'
	}
};

export default config;
