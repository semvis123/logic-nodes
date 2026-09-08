// Prerender every route to static HTML at build time. Both routes are fully
// static (no server load functions), so this bakes the /about copy and the
// JSON-LD into crawlable HTML instead of relying on adapter-auto's
// platform-dependent default. Adapter-agnostic: works with adapter-static and
// adapter-cloudflare alike.
export const prerender = true;
