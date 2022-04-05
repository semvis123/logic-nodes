import type { NodeSystem } from './NodeSystem';
export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;

	constructor(public canvas: HTMLCanvasElement, private nodeSystem: NodeSystem) {
		this.ctx = canvas.getContext('2d', { alpha: false });
	}

	render() {
		this.ctx.fillStyle = '#555';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			node.renderNode(this.ctx);
		}
		this.nodeSystem.nodeConnectionHandler.renderConnections(this.ctx);
		this.ctx.strokeStyle = '#000';
		if (this.nodeSystem.nodeClickHandler.selectionSquare) {
			this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
			this.ctx.lineWidth = 1;
			this.ctx.fillRect(
				this.nodeSystem.nodeClickHandler.selectionSquare.x,
				this.nodeSystem.nodeClickHandler.selectionSquare.y,
				this.nodeSystem.nodeClickHandler.selectionSquare.width,
				this.nodeSystem.nodeClickHandler.selectionSquare.height
			);
			this.ctx.strokeRect(
				this.nodeSystem.nodeClickHandler.selectionSquare.x,
				this.nodeSystem.nodeClickHandler.selectionSquare.y,
				this.nodeSystem.nodeClickHandler.selectionSquare.width,
				this.nodeSystem.nodeClickHandler.selectionSquare.height
			);
		}
		this.ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
		this.ctx.lineWidth = 1;
		for (const node of this.nodeSystem.nodeClickHandler.selectedNodes || []) {
			this.ctx.strokeRect(node.x, node.y, node.width, node.height);
		}
		for (const node of this.nodeSystem.nodeClickHandler.selectedNodes || []) {
			this.ctx.fillRect(node.x, node.y, node.width, node.height);
		}
		if (this.nodeSystem.nodeClickHandler.halfConnection) {
			this.ctx.beginPath();
			const toX = this.nodeSystem.nodeClickHandler.halfConnection.mousePos.x;
			const toY = this.nodeSystem.nodeClickHandler.halfConnection.mousePos.y;
			const fromX = this.nodeSystem.nodeClickHandler.halfConnection.outputPos.x;
			const fromY = this.nodeSystem.nodeClickHandler.halfConnection.outputPos.y;
			this.ctx.moveTo(fromX, fromY);
			const controlOffsetX = -(fromX - toX) / 3 + this.nodeSystem.nodeClickHandler.halfConnection.output.node.width / 2;
			const controlOffsetY = -(fromY - toY) / 3;
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
