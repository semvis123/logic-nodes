import type { NodeOutput } from '../NodeOutput';
import type { Node } from '../Node';
import type { NodeSystem } from '../NodeSystem';

export class NodeMouseEventHandler {
	selectedNodes: Node[] | undefined;
	selectionSquare: { x: number; y: number; width: number; height: number } | undefined;
	startingMouseMovePosition: { x: number; y: number } | undefined;
	selectionStarted: boolean;
	contextMenu: HTMLDivElement | undefined;
	halfConnection: {
		output: NodeOutput;
		outputPos: { x: number; y: number };
		mousePos: { x: number; y: number };
	};

	constructor(private nodeSystem: NodeSystem, private canvas: HTMLCanvasElement) {
		canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
		canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
		canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
	}

	onMouseDown(e: MouseEvent) {
		if (e.button === 2) {
			// show context menu
			if (this.selectedNodes) {
				this.selectedNodes = undefined;
			}
			const node = this.getNodeAt(e.pageX, e.pageY);
			if (node) {
				this.selectedNodes = [node];
				if (this.contextMenu) {
					this.contextMenu.remove();
				}
				this.contextMenu = node.showContextMenu(e.pageX, e.pageY);
			}

			this.nodeSystem.nodeRenderer.render();
			return;
		}

		if (this.contextMenu) {
			this.contextMenu.remove();
			this.contextMenu = undefined;
			return;
		}

		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		// connectors
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			const inputSpacing = node.height / (node.inputs.length + 1);
			for (const input of node.inputs) {
				if (
					mouseX >= node.x - 10 &&
					mouseX <= node.x + 10 &&
					mouseY >= node.y + inputSpacing * (input.index + 1) - 10 &&
					mouseY <= node.y + inputSpacing * (input.index + 1) + 10
				) {
					// break one connection
					const brokenConnection = this.nodeSystem.nodeConnectionHandler.removeFirstConnection(input);
					if (brokenConnection) {
						const [output] = brokenConnection;
						const mousePos = { x: mouseX, y: mouseY };
						const outputSpacing = output.node.height / (output.node.outputs.length + 1);
						const outputPos = {
							x: output.node.x + output.node.width,
							y: output.node.y + outputSpacing * (output.index + 1)
						};
						this.halfConnection = { output, outputPos, mousePos };
						return;
					}
				}
			}
			const outputSpacing = node.height / (node.outputs.length + 1);
			for (const output of node.outputs) {
				for (let i = 0; i < node.outputs.length; i++) {
					if (
						mouseX >= node.x + node.width - 10 &&
						mouseX <= node.x + node.width + 10 &&
						mouseY >= node.y + outputSpacing * (output.index + 1) - 10 &&
						mouseY <= node.y + outputSpacing * (output.index + 1) + 10
					) {
						const mousePos = { x: mouseX, y: mouseY };
						const outputPos = {
							x: output.node.x + output.node.width,
							y: output.node.y + outputSpacing * (output.index + 1)
						};
						this.halfConnection = { output, outputPos, mousePos };
						return;
					}
				}
			}
		}

		const node = this.getNodeAt(mouseX, mouseY);
		if (node) {
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
			if (this.selectedNodes) {
				return;
			}
			if (!node.onclick(e, { x: mouseX - node.x, y: mouseY - node.y })) {
				this.nodeSystem.nodeRenderer.render();
				return;
			}
			this.selectedNodes = [node];
			this.nodeSystem.nodeRenderer.render();
			return;
		}
		this.selectedNodes = undefined;
		this.selectionSquare = {
			x: mouseX,
			y: mouseY,
			width: 0,
			height: 0
		};
	}

	onMouseMove(e: MouseEvent) {
		if (this.selectedNodes && this.startingMouseMovePosition) {
			this.selectedNodes.forEach((node) => {
				node.x = node.x - (this.startingMouseMovePosition.x - (e.pageX + this.canvas.offsetLeft));
				node.y = node.y - (this.startingMouseMovePosition.y - (e.pageY + this.canvas.offsetTop));
			});
			this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
			this.nodeSystem.nodeRenderer.render();
		} else if (this.selectionSquare) {
			this.selectionSquare.width = e.pageX - this.canvas.offsetLeft - this.selectionSquare.x;
			this.selectionSquare.height = e.pageY - this.canvas.offsetTop - this.selectionSquare.y;
			this.nodeSystem.nodeRenderer.render();
		} else if (this.halfConnection) {
			this.halfConnection.mousePos = { x: e.pageX, y: e.pageY };
			this.nodeSystem.nodeRenderer.render();
		}
	}

	onMouseUp(e: MouseEvent) {
		if (this.selectionSquare) {
			let x1 = this.selectionSquare.x;
			let y1 = this.selectionSquare.y;
			let x2 = this.selectionSquare.x + this.selectionSquare.width;
			let y2 = this.selectionSquare.y + this.selectionSquare.height;
			if (x1 > x2) {
				const temp = x1;
				x1 = x2;
				x2 = temp;
			}
			if (y1 > y2) {
				const temp = y1;
				y1 = y2;
				y2 = temp;
			}
			const nodes = this.nodeSystem.nodeStorage.nodes.filter((node) => {
				return node.x + node.width >= x1 && node.x <= x2 && node.y + node.height >= y1 && node.y <= y2;
			});
			this.selectedNodes = nodes;
			this.selectionSquare = undefined;
			this.startingMouseMovePosition = undefined;
		} else if (this.halfConnection) {
			const mouseX = e.pageX - this.canvas.offsetLeft;
			const mouseY = e.pageY - this.canvas.offsetTop;

			// connectors
			for (const node of this.nodeSystem.nodeStorage.nodes) {
				const inputSpacing = node.height / (node.inputs.length + 1);
				for (const input of node.inputs) {
					if (
						mouseX >= node.x - 5 &&
						mouseX <= node.x + 5 &&
						mouseY >= node.y + inputSpacing * (input.index + 1) - 5 &&
						mouseY <= node.y + inputSpacing * (input.index + 1) + 5
					) {
						this.nodeSystem.nodeConnectionHandler.addConnection(this.halfConnection.output, input);
					}
				}
			}
		} else {
			this.selectedNodes = undefined;
		}
		this.halfConnection = undefined;
		this.nodeSystem.nodeRenderer.render();
	}

	getNodeAt(x: number, y: number) {
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
				return node;
			}
		}
		return undefined;
	}
}
