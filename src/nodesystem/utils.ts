export const uuid = () => {
	return crypto.getRandomValues(new Uint32Array(4)).join('-');
};

export const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
	const path = new Path2D();
	if (w < 2 * r) r = w / 2;
	if (h < 2 * r) r = h / 2;
	path.moveTo(x + r, y);
	path.arcTo(x + w, y, x + w, y + h, r);
	path.arcTo(x + w, y + h, x, y + h, r);
	path.arcTo(x, y + h, x, y, r);
	path.arcTo(x, y, x + w, y, r);
	path.closePath();
	return path;
};
