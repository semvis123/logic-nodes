// Browser side helpers for saving an SVG string as a file, or rasterising it
// to PNG first. Nothing here runs until a button is pressed, so the module is
// safe to import from a prerendered page.

function save(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	// Give the browser a moment to start the download before revoking.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves plain text, for the HDL export. */
export function downloadText(text: string, filename: string) {
	save(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

/** Copies text to the clipboard, reporting whether it worked. */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function downloadSvg(svg: string, filename: string) {
	save(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Rasterises the SVG at `scale` times its natural size. */
export async function downloadPng(svg: string, filename: string, scale = 2) {
	const size = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
	const width = size ? Number(size[1]) : 800;
	const height = size ? Number(size[2]) : 600;

	// A data URL keeps the image same-origin, so the canvas stays untainted.
	const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	const image = new Image();
	image.width = width;
	image.height = height;
	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error('Could not rasterise the diagram'));
		image.src = encoded;
	});

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is unavailable');
	context.drawImage(image, 0, 0, canvas.width, canvas.height);

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	if (blob) save(blob, filename);
}

/** Turns an expression into something safe and readable in a filename. */
export function slugifyExpression(expression: string, fallback = 'circuit'): string {
	const slug = expression
		.toLowerCase()
		.replace(/[∧&·*]/g, '-and-')
		.replace(/[∨|+]/g, '-or-')
		.replace(/[¬!~]/g, 'not-')
		.replace(/[⊻⊕^]/g, '-xor-')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-')
		.slice(0, 60);
	return slug || fallback;
}
