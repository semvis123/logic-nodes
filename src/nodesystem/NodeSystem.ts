import { NodeConnectionHandler } from './handlers/NodeConnectionHandler';
import { NodeMouseEventHandler } from './handlers/NodeMouseEventHandler';
import { ClockNode } from './nodes/ClockNode';
import { DisplayNode } from './nodes/DisplayNode';
import { HtmlOverlayNode } from './nodes/HtmlOverlayNode';
import { AndNode } from './nodes/LogicAndNode';
import { NotNode } from './nodes/LogicNotNode';
import { OrNode } from './nodes/LogicOrNode';
import { ToggleNode } from './nodes/ToggleNode';
import { NodeStorage } from './NodeStorage';
import { uuid } from './utils';
import { NodeRenderer } from './NodeRenderer';
import { DelayNode } from './nodes/DelayNode';

export class NodeSystem {
	nodeClickHandler: NodeMouseEventHandler;
	nodeStorage: NodeStorage;
	nodeConnectionHandler: NodeConnectionHandler;
	nodeRenderer: NodeRenderer;

	constructor(public canvas: HTMLCanvasElement) {
		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.nodeClickHandler = new NodeMouseEventHandler(this, canvas);
		this.nodeRenderer = new NodeRenderer(canvas, this);
		this.nodeStorage = new NodeStorage();

		const nodes = [
			new ToggleNode(uuid(), 300, 300, this),
			new ClockNode(uuid(), 600, 600, this, 1000),
			new AndNode(uuid(), 400, 600, this),
			new OrNode(uuid(), 500, 600, this),
			new NotNode(uuid(), 300, 600, this),
			new DisplayNode(uuid(), 400, 400, this),
			new DelayNode(uuid(), 200, 600, this, 400),
			new DelayNode(uuid(), 200, 600, this, 1000),
			new HtmlOverlayNode(uuid(), 500, 400, this)
		];
		for (const node of nodes) {
			this.nodeStorage.addNode(node);
		}

		this.nodeConnectionHandler.addConnection(nodes[0].outputs[0], nodes[2].inputs[0]);
		this.nodeConnectionHandler.addConnection(nodes[1].outputs[0], nodes[2].inputs[1]);
		this.nodeConnectionHandler.addConnection(nodes[2].outputs[0], nodes[5].inputs[0]);
	}
}
