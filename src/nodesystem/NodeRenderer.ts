import type { NodeSystem } from './NodeSystem';
export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;
	throttleTimer: NodeJS.Timeout = null;
	shouldRender = false;
	view: { x: number; y: number; } = {x: 0, y: 0};

	constructor(public canvas: HTMLCanvasElement, private nodeSystem: NodeSystem) {
		this.ctx = canvas.getContext('2d', { alpha: false });
	}

	render() {
		this.shouldRender = true;
		if (this.throttleTimer == null) {
			requestAnimationFrame(this.actuallyRender.bind(this));
			this.throttleTimer = setTimeout(this.actuallyRender.bind(this), 10);
		}
	}
	
	actuallyRender() {
		this.throttleTimer = null;
		if (!this.shouldRender) return;
		this.shouldRender = false;
		const theme = this.nodeSystem.config.theme;
		const eventHandler = this.nodeSystem.eventHandler;
		const selectionSquare = eventHandler.selectionSquare;
		
		this.ctx.fillStyle = theme.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			this.ctx.save();
			this.ctx.translate(node.x + this.view.x, node.y + this.view.y);
			node.renderNode(this.ctx);
			this.ctx.restore();	
		}

		
		if (selectionSquare) {
			this.ctx.fillStyle = theme.nodeSelectionSquareColor;
			this.ctx.lineWidth = 1;
			this.ctx.fillRect(selectionSquare.x, selectionSquare.y, selectionSquare.width, selectionSquare.height);
			this.ctx.strokeRect(selectionSquare.x, selectionSquare.y, selectionSquare.width, selectionSquare.height);
		}
		this.ctx.save();
		this.ctx.translate(this.view.x, this.view.y);
		
		this.nodeSystem.nodeConnectionHandler.renderConnections(this.ctx, this.nodeSystem.config);
		this.ctx.strokeStyle = theme.connectionColor;

		this.ctx.fillStyle = theme.nodeSelectedColor;
		this.ctx.lineWidth = 1;
		for (const node of eventHandler.selectedNodes || []) {
			this.ctx.strokeRect(node.x, node.y, node.width, node.height);
		}
		for (const node of eventHandler.selectedNodes || []) {
			this.ctx.fillRect(node.x, node.y, node.width, node.height);
		}

		if (eventHandler.halfConnection) {
			const toX = eventHandler.halfConnection.mousePos.x;
			const toY = eventHandler.halfConnection.mousePos.y;
			const fromX = eventHandler.halfConnection.outputPos.x;
			const fromY = eventHandler.halfConnection.outputPos.y;
			const controlOffsetX = -(fromX - toX) / 3 + eventHandler.halfConnection.output.node.width / 2;
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
		this.ctx.restore();
	}
}
