import { Command } from './Command';
import type { NodeSystem } from '../NodeSystem';
import type { Node } from '../Node';
import { getBoundingBoxOfMultipleNodes } from '../utils';

export class AlignNodesCommand extends Command {
	constructor(nodeSystem: NodeSystem, private selectedNodes: Node[]) {
		super(nodeSystem);
	}
	async execute() {
		const { x, y } = getBoundingBoxOfMultipleNodes(this.selectedNodes);
		const padding = this.nodeSystem.config.nodeSpacing;

		let smallestWidth: number;
		let smallestHeight: number;
		this.selectedNodes.forEach((node) => {
			smallestWidth = Math.min(smallestWidth ?? node.width, node.width);
			smallestHeight = Math.min(smallestHeight ?? node.height, node.height);
		});
		const gridSizeX = smallestWidth + padding;
		const gridSizeY = smallestHeight + padding;

		this.selectedNodes.forEach((node) => {
			node.x = Math.round((node.x - x) / gridSizeX) * gridSizeX + x;
			node.y = Math.round((node.y - y) / gridSizeY) * gridSizeY + y;
		});
		this.nodeSystem.eventHandler.selectedNodes = undefined;
		this.nodeSystem.snapshot();
	}
}
