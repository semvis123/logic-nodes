import type { NodeSystem } from '../NodeSystem';
import { getBoundingBoxOfMultipleNodes } from '../utils';

export class Minimap {
	public width = 150;
	public height = 150;
	public x = 0;
	public y = 0;
	private boundingBox = { x: 0, y: 0, width: 0, height: 0 };
	public visible = false;
	private mouseDown = false;

	constructor(private nodeSystem: NodeSystem) {}

	show() {
		this.visible = true;
	}

	remove() {
		this.visible = false;
	}

	render(ctx: CanvasRenderingContext2D) {
		if (!this.visible) return;
		const { zoom, x, y } = this.nodeSystem.editorState.view;

		const nodeBoundingBox = getBoundingBoxOfMultipleNodes(this.nodeSystem.nodeStorage.nodes);
		nodeBoundingBox.x -= 100;
		nodeBoundingBox.y -= 100;
		nodeBoundingBox.width += 200;
		nodeBoundingBox.height += 200;

		// calculate the bounds of the minimap, including padding. This is the area that will be shown in the minimap
		this.boundingBox = {
			x: nodeBoundingBox.x,
			y: nodeBoundingBox.y,
			width: Math.max(nodeBoundingBox.width, nodeBoundingBox.height),
			height: Math.max(nodeBoundingBox.width, nodeBoundingBox.height)
		};

		// draw the minimap
		ctx.fillStyle = 'rgba(0, 0, 0, 0.845)';
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.strokeRect(0, 0, this.width, this.height);
		ctx.lineWidth = 1.5;

		// draw the view rectangle
		ctx.strokeStyle = 'rgba(0, 84, 201, 1)';

		const canvasWidth = this.nodeSystem.canvas.width / this.nodeSystem.nodeRenderer.dpi / zoom;
		const canvasHeight = this.nodeSystem.canvas.height / this.nodeSystem.nodeRenderer.dpi / zoom;

		const miniView = {
			x: ((-this.boundingBox.x - x) / this.boundingBox.width) * this.width,
			y: ((-this.boundingBox.y - y) / this.boundingBox.height) * this.height,
			width: (canvasWidth / this.boundingBox.width) * this.width,
			height: (canvasHeight / this.boundingBox.height) * this.height
		};

		// draw view clipped in minimap
		ctx.strokeRect(
			Math.min(Math.max(0, miniView.x), this.width),
			Math.min(Math.max(0, miniView.y), this.height),
			Math.max(miniView.width - Math.max(0, -miniView.x) - Math.max(0, miniView.x + miniView.width - this.width), 0),
			Math.max(miniView.height - Math.max(0, -miniView.y) - Math.max(0, miniView.y + miniView.height - this.height), 0)
		);

		this.renderNodes(ctx);
	}

	renderNodes(ctx: CanvasRenderingContext2D) {
		if (!this.visible) return;
		ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			// draw a small square for each node
			ctx.fillRect(
				((node.x - this.boundingBox.x) / this.boundingBox.width) * this.width,
				((node.y - this.boundingBox.y) / this.boundingBox.height) * this.height,
				(node.width / this.boundingBox.width) * this.width,
				(node.height / this.boundingBox.height) * this.height
			);
		}
		// selected nodes
		ctx.fillStyle = 'rgba(139, 195, 255, 1)';
		for (const node of this.nodeSystem.editorState.selectedNodes ?? []) {
			// draw a small square for each node
			ctx.fillRect(
				((node.x - this.boundingBox.x) / this.boundingBox.width) * this.width,
				((node.y - this.boundingBox.y) / this.boundingBox.height) * this.height,
				(node.width / this.boundingBox.width) * this.width,
				(node.height / this.boundingBox.height) * this.height
			);
		}
	}

	handleMouseDown(x, y) {
		if (!this.visible) return;
		if (x < this.x || x > this.x + this.width || y < this.y || y > this.y + this.height) return;
		this.mouseDown = true;
		return this.handleMouseMove(x, y);
	}

	handleMouseUp() {
		this.mouseDown = false;
	}

	handleMouseMove(x: number, y: number): boolean {
		if (!this.visible) return false;
		if (!this.mouseDown) return false;

		if (x < this.x || x > this.x + this.width || y < this.y || y > this.y + this.height) return false;

		// move the center of the view to the mouse position
		const { zoom } = this.nodeSystem.editorState.view;
		const viewX = ((x - this.x) / this.width) * this.boundingBox.width + this.boundingBox.x;
		const viewY = ((y - this.y) / this.height) * this.boundingBox.height + this.boundingBox.y;

		const canvasWidth = this.nodeSystem.canvas.width / this.nodeSystem.nodeRenderer.dpi / zoom;
		const canvasHeight = this.nodeSystem.canvas.height / this.nodeSystem.nodeRenderer.dpi / zoom;

		this.nodeSystem.editorState.view.x = canvasWidth / 2 - viewX;
		this.nodeSystem.editorState.view.y = canvasHeight / 2 - viewY;
		this.nodeSystem.nodeRenderer.requestRender();
		return true;
	}
}
