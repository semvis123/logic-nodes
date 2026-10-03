import { expect, test } from '@playwright/test';

// Each tool page shows its FAQ from one array and PageHead builds the FAQPage
// structured data from that same array; this checks they still agree, and that
// the breadcrumb is there.
const PAGES = [
	'/base32',
	'/base36',
	'/base58',
	'/bit-manipulation-tricks',
	'/ean-13-barcode-generator',
	'/file-signature-checker',
	'/fp16-bf16-fp8-converter',
	'/guess-my-number',
	'/integer-limits',
	'/integer-limits/int32',
	'/ipv6-expand-compress',
	'/logic-symbols-copy-paste',
	'/qr-code-generator',
	'/snowflake-id-decoder',
	'/struct-padding-calculator',
	'/subnet-calculator',
	'/uuid-decoder',
	'/vlsm-calculator'
];

for (const path of PAGES) {
	test(`${path}: the FAQ structured data is the FAQ on the page`, async ({ page }) => {
		await page.goto(path);
		const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
		const graph = blocks.map((t) => JSON.parse(t)).flatMap((b) => b['@graph'] ?? [b]);
		const faqPage = graph.find((n) => [n['@type']].flat().includes('FAQPage'));
		const asked = faqPage.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [
			q.name,
			q.acceptedAnswer.text
		]);
		const shown = await page
			.locator('.faq details')
			.evaluateAll((ds) =>
				ds.map((d) => [d.querySelector('summary')?.textContent?.trim(), d.querySelector('p')?.textContent?.trim()])
			);
		expect(shown).toEqual(asked);
		expect(asked.length).toBeGreaterThanOrEqual(4);
		expect(graph.some((n) => n['@type'] === 'BreadcrumbList')).toBe(true);
	});
}
