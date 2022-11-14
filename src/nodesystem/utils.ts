import type { Config } from './Config';
import type { Node } from './Node';
import type { NodeStorage } from './NodeStorage';
import { ToastMessage } from './toastMessage/ToastMessage';

export const uuid = () => {
	return crypto.getRandomValues(new Uint32Array(4)).join('-');
};

export const textColor = (bgColor: string): string => {
	let color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor;
	color = color.length == 3 ? color[0].repeat(1) + color[1].repeat(1) + color[2].repeat(1) : color;
	const r = parseInt(color.substring(0, 2), 16);
	const g = parseInt(color.substring(2, 4), 16);
	const b = parseInt(color.substring(4, 6), 16);
	return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000' : '#fff';
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

type sizePos = { x: number; y: number; width: number; height: number };
export const positionNode = (
	boundingBox: sizePos,
	x: number,
	y: number,
	nodeStorage: NodeStorage,
	config: Config,
	nodes: Node[] = []
): { x: number; y: number } => {
	if (config.nodesCanOverlap) {
		boundingBox.x = x;
		boundingBox.y = y;
		return { x: x - boundingBox.x, y: y - boundingBox.y };
	}

	const padding = config.nodeSpacing;

	// check if current location is valid
	if (nodes.length > 0) {
		const overlapping = nodes.filter((node) => nodesOverlap(node, nodeStorage.nodes, padding, nodes));
		if (overlapping.length == 0) {
			boundingBox.x = x;
			boundingBox.y = y;
			return { x: x - boundingBox.x, y: y - boundingBox.y };
		}
	}

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
	let found = false;
	let d = -1;
	let dir: number[];
	let tryLimit = 1000;
	while (!found && tryLimit-- > 1) {
		d++;
		for (dir of directions) {
			const left = x + dir[0] * d;
			const top = y + dir[1] * d;
			let overlap = false;
			for (const n of nodeStorage.nodes) {
				if (boundingBox == n) continue;
				if (nodes.includes(n)) continue;
				if (
					!(
						n.x + n.width + padding <= left ||
						n.y + n.height + padding <= top ||
						n.x >= left + padding + boundingBox.width ||
						n.y >= top + padding + boundingBox.height
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
	if (tryLimit <= 1) {
		console.log([boundingBox, x, y, nodeStorage, config, nodes]);
		new ToastMessage('Could not position nodes', 'danger').show();
	}
	const diffX = x + dir[0] * d - boundingBox.x;
	const diffY = y + dir[1] * d - boundingBox.y;
	boundingBox.x = x + dir[0] * d;
	boundingBox.y = y + dir[1] * d;
	return { x: diffX, y: diffY };
};

const nodesOverlap = (node, nodesToCheck, padding, excludedNodes) => {
	let overlap = false;
	const { x, y, width, height } = node;
	for (const n of nodesToCheck) {
		if (node == n) continue;
		if (excludedNodes.includes(n)) continue;
		if (
			!(
				n.x + n.width + padding <= x ||
				n.y + n.height + padding <= y ||
				n.x >= x + padding + width ||
				n.y >= y + padding + height
			)
		) {
			overlap = true;
			break;
		}
	}
	return overlap;
};

export const getBoundingBoxOfMultipleNodes = (nodes: Node[]) => {
	let x: number, y: number, maxX: number, maxY: number;
	nodes.forEach((node) => {
		x = Math.min(x ?? node.x, node.x);
		y = Math.min(y ?? node.y, node.y);
		maxX = Math.max(maxX ?? node.x + node.width, node.x + node.width);
		maxY = Math.max(maxY ?? node.y + node.height, node.y + node.height);
	});
	const width = maxX - x;
	const height = maxY - y;
	return { x, y, width, height };
};

export const createDivTable = (table: Map<string, number>[]) => {
	const t = document.createElement('table');
	const header = document.createElement('thead');
	for (const headerText of table[0].keys()) {
		const th = document.createElement('th');
		th.innerText = headerText;
		header.appendChild(th);
	}
	t.appendChild(header);
	const body = document.createElement('tbody');
	for (const row of table) {
		const tr = document.createElement('tr');
		for (const rowValue of row.values()) {
			const td = document.createElement('td');
			td.innerText = rowValue.toString();
			td.classList.add('td-value-' + rowValue);
			tr.appendChild(td);
		}
		body.appendChild(tr);
	}
	t.appendChild(body);
	return t;
};
