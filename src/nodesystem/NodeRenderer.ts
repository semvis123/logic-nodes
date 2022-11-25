import type { EditorState } from './EditorState';
import type { NodeSystem } from './NodeSystem';
import { getBoundingBoxOfMultipleNodes } from './utils';
export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;
	throttleTimer: NodeJS.Timeout = null;
	shouldRender = false;
	dpi = 1;
	frameCount = 0;
	lastFpsSampleTime = 0;
	countFPS = import.meta.env.DEV;
	static fpsInterval: NodeJS.Timer = null;
	editorState: EditorState;

	constructor(public canvas: HTMLCanvasElement, private nodeSystem: NodeSystem) {
		this.ctx = canvas.getContext('2d', { alpha: false });
		this.editorState = nodeSystem.editorState;
		this.render = this.render.bind(this);
		if (NodeRenderer.fpsInterval) {
			clearInterval(NodeRenderer.fpsInterval);
		}
		if (this.countFPS) {
			NodeRenderer.fpsInterval = setInterval(this.sampleFPS.bind(this), 2000);
		}
		this.render();
	}

	requestRender() {
		this.shouldRender = true;
	}

	sampleFPS() {
		const now = performance.now();
		if (this.frameCount > 0) {
			const currentFps = ((this.frameCount / (now - this.lastFpsSampleTime)) * 1000).toFixed(2);
			console.debug(currentFps + ' fps');
			this.frameCount = 0;
		}
		this.lastFpsSampleTime = now;
	}

	render() {
		requestAnimationFrame(this.render);
		this.frameCount++;
		this.throttleTimer = null;
		if (!this.shouldRender) return;
		this.shouldRender = false;
		const theme = this.nodeSystem.config.theme;
		const selectionBox = this.editorState.selectionBox;

		this.ctx.fillStyle = theme.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();
		this.ctx.scale(this.dpi, this.dpi);
		this.ctx.scale(this.editorState.view.zoom, this.editorState.view.zoom);
		// render grid
		if (this.editorState.view.zoom > 2.5) {
			const gridSize = this.nodeSystem.config.nodeSpacing;
			this.ctx.beginPath();
			this.ctx.lineWidth = 0.5;
			const opacity = Math.max((this.editorState.view.zoom * 1) / 2.5 - 1, 0.25);
			this.ctx.strokeStyle = `rgba(41, 41, 41, ${opacity})`;
			const yOffset = this.editorState.view.y % gridSize;
			const xOffset = this.editorState.view.x % gridSize;
			// horizontal lines
			for (let i = 0; i < this.canvas.height / this.editorState.view.zoom / gridSize + 1; i++) {
				this.ctx.moveTo(0, i * gridSize + yOffset);
				this.ctx.lineTo(this.canvas.width / this.editorState.view.zoom, i * gridSize + yOffset);
			}
			// vertical lines
			for (let i = 0; i < this.canvas.width / this.editorState.view.zoom / gridSize + 1; i++) {
				this.ctx.moveTo(i * gridSize + xOffset, 0);
				this.ctx.lineTo(i * gridSize + xOffset, this.canvas.height);
			}
			this.ctx.stroke();
		}
		this.ctx.translate(this.editorState.view.x, this.editorState.view.y);

		// render nodes
		const viewRight = -this.editorState.view.x + this.canvas.width / this.editorState.view.zoom;
		const viewBottom = -this.editorState.view.y + this.canvas.height / this.editorState.view.zoom;
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			if (
				node.layer === this.editorState.layer &&
				-this.editorState.view.x < node.x + node.width &&
				viewRight > node.x &&
				-this.editorState.view.y < node.y + node.height &&
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
			this.ctx.strokeStyle = theme.nodeSelectionSquareBorderColor;
			this.ctx.fillStyle = theme.nodeSelectionSquareColor;
			this.ctx.lineWidth = 1;
			this.ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
			this.ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
		}
		this.ctx.restore();
		this.ctx.save();
		this.ctx.scale(this.dpi, this.dpi);
		this.ctx.scale(this.editorState.view.zoom, this.editorState.view.zoom);
		this.ctx.translate(this.editorState.view.x, this.editorState.view.y);

		// render connections
		this.nodeSystem.nodeConnectionHandler.renderConnections(this.ctx, this.nodeSystem.config, this.editorState);
		this.ctx.strokeStyle = theme.connectionColor;

		this.ctx.fillStyle = theme.nodeSelectedColor;
		this.ctx.lineWidth = 1;

		// highlight the selected nodes
		for (const node of this.editorState.selectedNodes || []) {
			this.ctx.strokeRect(node.x, node.y, node.width, node.height);
		}
		for (const node of this.editorState.selectedNodes || []) {
			this.ctx.fillRect(node.x, node.y, node.width, node.height);
		}

		// render a half connection
		if (this.editorState.halfConnection) {
			const toX = this.editorState.halfConnection.mousePos.x;
			const toY = this.editorState.halfConnection.mousePos.y;
			const fromX = this.editorState.halfConnection.outputPos.x;
			const fromY = this.editorState.halfConnection.outputPos.y;
			const controlOffsetX = -(fromX - toX) / 3 + this.editorState.halfConnection.output.node.width / 2;
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
		this.ctx.save();
		// minimap is rendered in the top right corner
		this.ctx.scale(this.dpi, this.dpi);
		const paddingTop = 50;
		const paddingRight = 20;
		this.nodeSystem.minimap.x = this.canvas.width - this.nodeSystem.minimap.width - paddingRight;
		this.nodeSystem.minimap.y = paddingTop;
		this.ctx.translate(this.canvas.width / this.dpi - this.nodeSystem.minimap.width - paddingRight, paddingTop);
		// draw minimap
		this.nodeSystem.minimap.render(this.ctx);
		this.ctx.restore();
		this.transformOverlay();
	}

	panView(deltaX: number, deltaY: number) {
		const view = {
			x: this.editorState.view.x + deltaX / this.editorState.view.zoom,
			y: this.editorState.view.y + deltaY / this.editorState.view.zoom,
			zoom: this.editorState.view.zoom
		};

		this.editorState.view = view;
		this.requestRender();
	}

	zoomView(deltaY: number, mouseX: number, mouseY: number) {
		const zoomSpeed = Math.min(Math.abs(deltaY) * 0.02, 0.4);
		const zoomDelta = deltaY < 0 ? 1 + zoomSpeed : 1 / (1 + zoomSpeed);
		const newZoom = this.editorState.view.zoom * zoomDelta;
		this.setZoom(newZoom, mouseX, mouseY);
	}

	setZoom(
		newZoom: number,
		mouseX: number = this.canvas.width / this.dpi / 2,
		mouseY: number = this.canvas.height / this.dpi / 2
	) {
		const oldZoom = this.editorState.view.zoom;
		this.editorState.view = {
			x: this.editorState.view.x + mouseX / newZoom - mouseX / oldZoom,
			y: this.editorState.view.y + mouseY / newZoom - mouseY / oldZoom,
			zoom: newZoom
		};
		this.requestRender();
		this.nodeSystem.bottomToolbar.setZoom(newZoom);
	}

	zoomToFit() {
		const boundingBox = getBoundingBoxOfMultipleNodes(this.nodeSystem.nodeStorage.nodes);
		const padding = 100;

		const canvasWidth = this.canvas.width / this.dpi;
		const canvasHeight = this.canvas.height / this.dpi;

		// calculate the maximum zoom level
		const zoomX = canvasWidth / (boundingBox.width + padding);
		const zoomY = canvasHeight / (boundingBox.height + padding);
		const zoom = Math.min(zoomX, zoomY);

		// set the new view position
		this.editorState.view.x = -boundingBox.x - (boundingBox.width - canvasWidth / zoom) / 2;
		this.editorState.view.y = -boundingBox.y - (boundingBox.height - canvasHeight / zoom) / 2;

		// set the zoom level
		this.setZoom(zoom, 0, 0);

		this.requestRender();
	}

	transformOverlay() {
		const x = this.editorState.view.x;
		const y = this.editorState.view.y;
		const zoom = this.editorState.view.zoom;
		this.nodeSystem.htmlCanvasOverlayContainer.style.transform = `translate(-50%, -50%) scale(${zoom}) translate(50%, 50%) translate(${x}px, ${y}px)`;
	}

	setDPI(dpi: number) {
		this.dpi = dpi;
	}

	setLayer(n: number) {
		this.editorState.layer = n;
		this.requestRender();
	}
}
