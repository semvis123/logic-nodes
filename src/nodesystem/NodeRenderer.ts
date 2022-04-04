import type { Node } from './Node';
import { uuid } from './utils';
import { NodeConnectionHandler } from './NodeConnectionHandler';
import { ToggleNode } from './ToggleNode';
import { DisplayNode } from './DisplayNode';
import { TimerNode } from './TimerNode';
import { AndNode } from './LogicAndNode';
import { OrNode } from './LogicOrNode';
import { NotNode } from './LogicNotNode';
import { NodeMouseEventHandler } from './NodeMouseEventHandler';
import { HtmlOverlayNode } from './HtmlOverlayNode';
import { DelayNode } from './DelayNode';
export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;
	nodeConnectionHandler: NodeConnectionHandler;
	nodes: Node[];
	nodeClickHandler: NodeMouseEventHandler;

	constructor(public canvas: HTMLCanvasElement) {
		this.nodeClickHandler = new NodeMouseEventHandler(this, canvas);
		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.ctx = canvas.getContext('2d', { alpha: false });
		this.nodes = [
			new ToggleNode(uuid(), 300, 300, this.nodeConnectionHandler),
			new TimerNode(uuid(), 600, 600, this.nodeConnectionHandler, this, 1000),
			new AndNode(uuid(), 400, 600, this.nodeConnectionHandler),
			new OrNode(uuid(), 500, 600, this.nodeConnectionHandler),
			new NotNode(uuid(), 300, 600, this.nodeConnectionHandler),
			new DisplayNode(uuid(), 400, 400, this.nodeConnectionHandler),
			new DelayNode(uuid(), 200, 600, this.nodeConnectionHandler, this, 400),
			new HtmlOverlayNode(uuid(), 500, 400, this.nodeConnectionHandler)
		];
		this.nodeConnectionHandler.addConnection(this.nodes[0].outputs[0], this.nodes[2].inputs[0]);
		this.nodeConnectionHandler.addConnection(this.nodes[1].outputs[0], this.nodes[2].inputs[1]);
		this.nodeConnectionHandler.addConnection(this.nodes[2].outputs[0], this.nodes[5].inputs[0]);
	}

	render() {
		this.ctx.fillStyle = '#555';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		for (const node of this.nodes) {
			node.renderNode(this.ctx);
		}
		this.nodeConnectionHandler.renderConnections(this.ctx);
		this.ctx.strokeStyle = '#000';
		if (this.nodeClickHandler.selectionSquare) {
			this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
			this.ctx.lineWidth = 1;
			this.ctx.fillRect(
				this.nodeClickHandler.selectionSquare.x,
				this.nodeClickHandler.selectionSquare.y,
				this.nodeClickHandler.selectionSquare.width,
				this.nodeClickHandler.selectionSquare.height
			);
			this.ctx.strokeRect(
				this.nodeClickHandler.selectionSquare.x,
				this.nodeClickHandler.selectionSquare.y,
				this.nodeClickHandler.selectionSquare.width,
				this.nodeClickHandler.selectionSquare.height
			);
		}
		this.ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
		this.ctx.lineWidth = 1;
		for (const node of this.nodeClickHandler.selectedNodes || []) {
			this.ctx.strokeRect(node.x, node.y, node.width, node.height);
		}
		for (const node of this.nodeClickHandler.selectedNodes || []) {
			this.ctx.fillRect(node.x, node.y, node.width, node.height);
		}
		if (this.nodeClickHandler.halfConnection) {
			this.ctx.beginPath();
			const toX = this.nodeClickHandler.halfConnection.mousePos.x;
			const toY = this.nodeClickHandler.halfConnection.mousePos.y;
			const fromX = this.nodeClickHandler.halfConnection.outputPos.x;
			const fromY = this.nodeClickHandler.halfConnection.outputPos.y;
			this.ctx.moveTo(fromX, fromY);
			const controlOffsetX = -(fromX - toX) / 3 + this.nodeClickHandler.halfConnection.output.node.width / 2;
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
