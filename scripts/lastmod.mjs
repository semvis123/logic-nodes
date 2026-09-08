// Records when each page last actually changed, from git.
//
// A sitemap that stamps every page with the build date is worse than one with
// no dates at all: it tells a crawler that all 31 pages changed today, every
// deploy, which is a signal search engines learn to ignore. This writes real
// per-file commit dates, and writes nothing at all when it cannot know them.
//
//   npm run lastmod
//
// Runs automatically before a build. On a shallow clone there is no history to
// read, so the previous file is left in place rather than overwritten with
// something untrue.

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROUTES = 'src/routes';
const OUT = 'src/lib/lastmod.json';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// A one commit clone would date every page the same, which is the problem this
// script exists to avoid.
let depth = 0;
try {
	depth = Number(git(['rev-list', '--count', 'HEAD']));
} catch {
	depth = 0;
}
if (depth < 2) {
	console.log(
		existsSync(OUT)
			? `only ${depth} commit(s) of history here, keeping the existing ${OUT}`
			: `only ${depth} commit(s) of history here, and no ${OUT} to keep; dates will be omitted`
	);
	if (!existsSync(OUT)) writeFileSync(OUT, '{}\n');
	process.exit(0);
}

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : entry === '+page.svelte' ? [full] : [];
	});
}

const dates = {};
for (const file of walk(ROUTES)) {
	// src/routes/learn/+page.svelte -> /learn
	const route = '/' + relative(ROUTES, file).replace(/\/?\+page\.svelte$/, '');
	let date = '';
	try {
		date = git(['log', '-1', '--format=%cs', '--', file]);
	} catch {
		date = '';
	}
	// An uncommitted page has no date yet, and gets none.
	if (date) dates[route === '/' ? '/' : route] = date;
}

writeFileSync(OUT, `${JSON.stringify(dates, null, '\t')}\n`);
console.log(`${Object.keys(dates).length} page dates written to ${OUT}`);
