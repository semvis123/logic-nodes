// The about page is fully static, so ship it as prerendered HTML: fastest
// possible response for crawlers and visitors, and no SSR work per request.
export const prerender = true;
