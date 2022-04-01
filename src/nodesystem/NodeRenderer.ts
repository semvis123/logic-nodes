import { Node } from './Node';
import { NodeInput } from './NodeInput';
import { NodeType } from './NodeType';
import { uuid } from './utils';
import { NodeValueType } from './NodeValueType';
import { NodeOutput } from './NodeOutput';
import { NodeConnectionHandler } from './NodeConnectionHandler';

export class NodeRenderer {
	ctx: CanvasRenderingContext2D;
	frame: number;
	nodeConnectionHandler: NodeConnectionHandler;
	nodes: Node[];
	render() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		for (const node of this.nodes) {
			node.renderNode(this.ctx);
		}
		this.nodeConnectionHandler.renderConnections(this.ctx);
	}

	constructor(public canvas: HTMLCanvasElement) {
		this.ctx = canvas.getContext('2d');
		this.nodeConnectionHandler = new NodeConnectionHandler();
		this.nodes = [
			new Node(
				uuid(),
				NodeType.Unknown,
				10,
				10,
				50,
				50,
				[],
				[new NodeOutput(uuid(), 'a', NodeValueType.Number, 0)],
				this.nodeConnectionHandler
			),
			new Node(
				uuid(),
				NodeType.Unknown,
				80,
				20,
				50,
				50,
				[
					new NodeInput(uuid(), 'b', NodeValueType.Number, 0),
					new NodeInput(uuid(), 'b', NodeValueType.Number, 1)
				],
				[new NodeOutput(uuid(), 'b', NodeValueType.Number, 0)],
				this.nodeConnectionHandler
			)
		];
		this.nodeConnectionHandler.addConnection(this.nodes[0].outputs[0], this.nodes[1].inputs[0]);
		this.nodeConnectionHandler.addConnection(this.nodes[0].outputs[0], this.nodes[1].inputs[1]);
	}
}
