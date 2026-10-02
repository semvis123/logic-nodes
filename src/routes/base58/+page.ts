import { base58CheckVerify } from '$lib/baseN';
import type { PageLoad } from './$types';

// Static content plus a client side widget: prerender it.
export const prerender = true;

/** The address taken apart on the page. A real, published example address. */
const EXAMPLE_ADDRESS = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';

// The checksum needs SHA-256 from Web Crypto, which is asynchronous, so the
// worked Base58Check example is computed here, at build time, where it can be
// awaited, rather than in the component, so it is in the prerendered HTML.
export const load: PageLoad = async () => {
	const check = await base58CheckVerify(EXAMPLE_ADDRESS);
	return {
		example: {
			address: EXAMPLE_ADDRESS,
			version: check.version,
			payload: check.payload,
			checksum: check.checksum,
			hash: check.hash,
			expected: check.expected,
			valid: check.valid,
			kind: check.kind?.name ?? ''
		}
	};
};
