import type { NodeSystem } from './NodeSystem';
export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;

	constructor(public canvas: HTMLCanvasElement, private nodeSystem: NodeSystem) {
		this.ctx = canvas.getContext('2d', { alpha: false });
	}

	render() {
		const theme = this.nodeSystem.config.theme;
		const clickHandler = this.nodeSystem.nodeClickHandler;
		const selectionSquare = clickHandler.selectionSquare;

		this.ctx.fillStyle = theme.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			node.renderNode(this.ctx);
		}

		this.ctx.strokeStyle = theme.connectionColor;
		this.nodeSystem.nodeConnectionHandler.renderConnections(this.ctx);

		if (selectionSquare) {
			this.ctx.fillStyle = theme.nodeSelectionSquareColor;
			this.ctx.lineWidth = 1;
			this.ctx.fillRect(selectionSquare.x, selectionSquare.y, selectionSquare.width, selectionSquare.height);
			this.ctx.strokeRect(selectionSquare.x, selectionSquare.y, selectionSquare.width, selectionSquare.height);
		}

		this.ctx.fillStyle = theme.nodeSelectedColor;
		this.ctx.lineWidth = 1;

		for (const node of clickHandler.selectedNodes || []) {
			this.ctx.strokeRect(node.x, node.y, node.width, node.height);
		}
		for (const node of clickHandler.selectedNodes || []) {
			this.ctx.fillRect(node.x, node.y, node.width, node.height);
		}

		if (clickHandler.halfConnection) {
			const toX = clickHandler.halfConnection.mousePos.x;
			const toY = clickHandler.halfConnection.mousePos.y;
			const fromX = clickHandler.halfConnection.outputPos.x;
			const fromY = clickHandler.halfConnection.outputPos.y;
			const controlOffsetX = -(fromX - toX) / 3 + clickHandler.halfConnection.output.node.width / 2;
			const controlOffsetY = -(fromY - toY) / 3;
			this.ctx.beginPath();
			this.ctx.moveTo(fromX, fromY);
			this.ctx.bezierCurveTo(
				fromX + controlOffsetX,
				fromY + controlOffsetY,
				toX - controlOffsetX,
				toY - controlOffsetY,
				toX,
				toY
			);
			this.ctx.stroke();
		}
	}
}
