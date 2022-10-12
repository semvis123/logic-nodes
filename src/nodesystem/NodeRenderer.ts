import type { NodeSystem } from './NodeSystem';
import { getBoundingBoxOfMultipleNodes } from './utils';
export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;
	throttleTimer: NodeJS.Timeout = null;
	shouldRender = false;
	view: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 };
	dpi = 1;

	constructor(public canvas: HTMLCanvasElement, private nodeSystem: NodeSystem) {
		this.ctx = canvas.getContext('2d', { alpha: false });
		this.render = this.render.bind(this);
	}

	requestRender() {
		this.shouldRender = true;
		if (this.throttleTimer == null) {
			requestAnimationFrame(this.render);
			this.throttleTimer = setTimeout(this.render, 10);
		}
	}

	render() {
		this.throttleTimer = null;
		if (!this.shouldRender) return;
		this.shouldRender = false;
		const theme = this.nodeSystem.config.theme;
		const eventHandler = this.nodeSystem.eventHandler;
		const selectionBox = eventHandler.selectionBox;

		this.ctx.fillStyle = theme.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();
		this.ctx.scale(this.dpi, this.dpi);
		this.ctx.scale(this.view.zoom, this.view.zoom);
		// render grid
		if (this.view.zoom > 2.5) {
			const gridSize = this.nodeSystem.config.nodeSpacing;
			this.ctx.beginPath();
			this.ctx.lineWidth = 0.5;
			const opacity = Math.max((this.view.zoom * 1) / 2.5 - 1, 0.25);
			this.ctx.strokeStyle = `rgba(41, 41, 41, ${opacity})`;
			const yOffset = this.view.y % gridSize;
			const xOffset = this.view.x % gridSize;
			// horizontal lines
			for (let i = 0; i < this.canvas.height / this.view.zoom / gridSize + 1; i++) {
				this.ctx.moveTo(0, i * gridSize + yOffset);
				this.ctx.lineTo(this.canvas.width / this.view.zoom, i * gridSize + yOffset);
			}
			// vertical lines
			for (let i = 0; i < this.canvas.width / this.view.zoom / gridSize + 1; i++) {
				this.ctx.moveTo(i * gridSize + xOffset, 0);
				this.ctx.lineTo(i * gridSize + xOffset, this.canvas.height);
			}
			this.ctx.stroke();
		}
		this.ctx.translate(this.view.x, this.view.y);

		// render nodes
		const viewRight = -this.view.x + this.canvas.width / this.view.zoom;
		const viewBottom = -this.view.y + this.canvas.height / this.view.zoom;
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			if (
				-this.view.x < node.x + node.width &&
				viewRight > node.x &&
				-this.view.y < node.y + node.height &&
				viewBottom > node.y
				) {
					this.ctx.translate(node.x, node.y);
					node.renderNode(this.ctx);
					this.ctx.translate(-node.x, -node.y);
				}
		}
		this.ctx.restore();
		this.ctx.save();
		this.ctx.scale(this.dpi, this.dpi);

		// render selection rectangle
		if (selectionBox) {
			this.ctx.fillStyle = theme.nodeSelectionSquareColor;
			this.ctx.lineWidth = 1;
			this.ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
			this.ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
		}
		this.ctx.restore();
		this.ctx.save();
		this.ctx.scale(this.dpi, this.dpi);
		this.ctx.scale(this.view.zoom, this.view.zoom);
		this.ctx.translate(this.view.x, this.view.y);

		// render connections
		this.nodeSystem.nodeConnectionHandler.renderConnections(this.ctx, this.nodeSystem.config);
		this.ctx.strokeStyle = theme.connectionColor;

		this.ctx.fillStyle = theme.nodeSelectedColor;
		this.ctx.lineWidth = 1;

		// highlight the selected nodes
		for (const node of eventHandler.selectedNodes || []) {
			this.ctx.strokeRect(node.x, node.y, node.width, node.height);
		}
		for (const node of eventHandler.selectedNodes || []) {
			this.ctx.fillRect(node.x, node.y, node.width, node.height);
		}

		// render a half connection
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
		this.transformOverlay();
	}

	panView(deltaX: number, deltaY: number) {
		const view = {
			x: this.view.x + deltaX / this.view.zoom,
			y: this.view.y + deltaY / this.view.zoom,
			zoom: this.view.zoom
		};

		this.view = view;
		this.requestRender();
	}

	zoomView(deltaY: number, mouseX: number, mouseY: number) {
		const zoomSpeed = Math.min(Math.abs(deltaY) * 0.02, 0.4);
		const zoomDelta = deltaY < 0 ? 1 + zoomSpeed : 1 / (1 + zoomSpeed);
		const newZoom = this.view.zoom * zoomDelta;
		this.setZoom(newZoom, mouseX, mouseY);
	}

	setZoom(newZoom: number, mouseX: number = this.canvas.width / 2, mouseY: number = this.canvas.height / 2) {
		const oldZoom = this.view.zoom;
		this.view = {
			x: this.view.x + mouseX / newZoom - mouseX / oldZoom,
			y: this.view.y + mouseY / newZoom - mouseY / oldZoom,
			zoom: newZoom
		};
		this.requestRender();
		this.nodeSystem.bottomToolbar.setZoom(newZoom);
	}

	zoomToFit() {
		const boundingBox = getBoundingBoxOfMultipleNodes(this.nodeSystem.nodeStorage.nodes);
		const padding = 100;
		const zoomX = this.canvas.width / (boundingBox.width + padding);
		const zoomY = this.canvas.height / (boundingBox.height + padding);
		const zoom = Math.min(zoomX, zoomY);
		this.setZoom(zoom, 0, 0);
		this.view.x = -boundingBox.x + (this.canvas.width - zoom * boundingBox.width) / 2 / zoom;
		this.view.y = -boundingBox.y + (this.canvas.height - zoom * boundingBox.height) / 2 / zoom;
		this.requestRender();
	}

	transformOverlay() {
		this.nodeSystem.htmlCanvasOverlayContainer.style.transform = `translate(-50%, -50%) scale(${this.view.zoom}) translate(50%, 50%) translate(${this.view.x}px, ${this.view.y}px)`;
	}

	setDPI(dpi: number) {
		this.dpi = dpi;
	}
}
