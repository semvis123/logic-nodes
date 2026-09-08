// The canonical origin, in one place. Every canonical URL, JSON-LD @id, social
// card URL and sitemap entry is built from this, so moving domains is one edit
// rather than seventy scattered string literals.
//
// No trailing slash: everything downstream appends a path that starts with one.
export const SITE = 'https://logicgates.org';
