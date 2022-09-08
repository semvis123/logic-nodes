import type { Node } from './Node';
import type { NodeStorage } from './NodeStorage';

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

export const positionNode = (node: Node, nodeStorage: NodeStorage, x: number, y: number) => {
	const directions = [
		[0, -1],
		[0, 1],
		[-1, 0],
		[1, 0],
		[-1, 1],
		[-1, -1],
		[1, -1],
		[1, 1]
	];
	const padding = 10;
	let found = false;
	let d = -1;
	let dir: number[];
	while (!found) {
		d++;
		for (dir of directions) {
			const left = x + dir[0] * d;
			const top = y + dir[1] * d;
			let overlap = false;
			for (const n of nodeStorage.nodes) {
				if (node == n) continue;
				if (
					!(
						n.x + n.width + padding < left ||
						n.y + n.height + padding < top ||
						n.x > left + padding + node.width ||
						n.y > top + padding + node.height
					)
				) {
					overlap = true;
				}
			}
			if (!overlap) {
				found = true;
				break;
			}
		}
	}
	node.x = x + dir[0] * d;
	node.y = y + dir[1] * d;
};
