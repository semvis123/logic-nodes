import type { NodeOutput } from '../NodeOutput';
import type { Node } from '../Node';
import type { NodeSystem } from '../NodeSystem';
import { positionNode } from '../utils';

export class NodeMouseEventHandler {
	selectedNodes: Node[] | undefined;
	selectionSquare: { x: number; y: number; width: number; height: number } | undefined;
	startingMouseMovePosition: { x: number; y: number } | undefined;
	selectionStarted: boolean;
	middleMouseDown: boolean;
	leftMouseDown: boolean;
	contextMenu: HTMLDivElement | undefined;
	halfConnection: {
		output: NodeOutput;
		outputPos: { x: number; y: number };
		mousePos: { x: number; y: number };
	};

	constructor(private nodeSystem: NodeSystem, private canvas: HTMLCanvasElement) {
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onContextMenu = this.onContextMenu.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		window.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mousemove', this.onMouseMove);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('contextmenu', this.onContextMenu);
		window.addEventListener('keydown', this.onKeyDown);
	}

	removeEventListeners() {
		window.removeEventListener('mousedown', this.onMouseDown);
		window.removeEventListener('mousemove', this.onMouseMove);
		window.removeEventListener('mouseup', this.onMouseUp);
		window.removeEventListener('contextmenu', this.onContextMenu);
		window.removeEventListener('keydown', this.onKeyDown);
	}

	onKeyDown(e: KeyboardEvent) {
		if (e.code == 'Delete') {
			if (this.selectedNodes) {
				this.selectedNodes.forEach((node) => {
					this.nodeSystem.nodeStorage.removeNode(node);
				});
				this.nodeSystem.nodeRenderer.render();
			}
		}
	}

	onContextMenu(e: MouseEvent) {
		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		const pannedMouseX = mouseX - this.nodeSystem.nodeRenderer.view.x;
		const pannedMouseY = mouseY - this.nodeSystem.nodeRenderer.view.y;

		this.startingMouseMovePosition = undefined;
		if (this.contextMenu) {
			this.contextMenu.remove();
			this.contextMenu = undefined;
		}
		// show context menu
		if (this.selectedNodes) {
			this.selectedNodes = undefined;
		}
		const node = this.getNodeAt(pannedMouseX, pannedMouseY);
		if (node) {
			this.selectedNodes = [node];
			if (this.contextMenu) {
				this.contextMenu.remove();
			}
			this.contextMenu = node.showContextMenu(mouseX, mouseY);
		}

		this.nodeSystem.nodeRenderer.render();
	}

	onMouseDown(e: MouseEvent) {
		const ctxMBounds = this.contextMenu?.getBoundingClientRect();
		if (
			this.contextMenu &&
			!(
				e.x > ctxMBounds.x &&
				e.x - ctxMBounds.width < ctxMBounds.x &&
				e.y > ctxMBounds.y &&
				e.y - ctxMBounds.height < ctxMBounds.y
			)
		) {
			this.contextMenu.remove();
			this.contextMenu = undefined;
			return;
		}
		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		const pannedMouseX = mouseX - this.nodeSystem.nodeRenderer.view.x;
		const pannedMouseY = mouseY - this.nodeSystem.nodeRenderer.view.y;

		if (e.button == 1) {
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
			this.middleMouseDown = true;
			return;
		}

		if (e.button == 0) this.leftMouseDown = true;

		// connectors
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			const inputSpacing = node.height / (node.inputs.length + 1);
			for (const input of node.inputs) {
				if (
					pannedMouseX >= node.x - 10 &&
					pannedMouseX <= node.x + 10 &&
					pannedMouseY >= node.y + inputSpacing * (input.index + 1) - 10 &&
					pannedMouseY <= node.y + inputSpacing * (input.index + 1) + 10
				) {
					// break one connection
					const brokenConnection = this.nodeSystem.nodeConnectionHandler.removeFirstConnection(input);
					if (brokenConnection) {
						const [output] = brokenConnection;
						const mousePos = { x: pannedMouseX, y: pannedMouseY };
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
						pannedMouseX >= node.x + node.width - 10 &&
						pannedMouseX <= node.x + node.width + 10 &&
						pannedMouseY >= node.y + outputSpacing * (output.index + 1) - 10 &&
						pannedMouseY <= node.y + outputSpacing * (output.index + 1) + 10
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

		const node = this.getNodeAt(pannedMouseX, pannedMouseY);
		if (node) {
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
			if (this.selectedNodes?.length) {
				return;
			}
			if (!node.onclick(e, { x: pannedMouseX - node.x, y: pannedMouseY - node.y })) {
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
		if (this.contextMenu) return;

		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		const pannedMouseX = mouseX - this.nodeSystem.nodeRenderer.view.x;
		const pannedMouseY = mouseY - this.nodeSystem.nodeRenderer.view.y;

		if (this.middleMouseDown && this.startingMouseMovePosition) {
			// pan
			const view = {
				x: this.nodeSystem.nodeRenderer.view.x - (this.startingMouseMovePosition.x - mouseX),
				y: this.nodeSystem.nodeRenderer.view.y - (this.startingMouseMovePosition.y - mouseY)
			};

			this.nodeSystem.nodeRenderer.view = view;
			this.nodeSystem.htmlCanvasOverlayContainer.style.transform = `translate(${view.x}px, ${view.y}px)`;

			this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
			this.nodeSystem.nodeRenderer.render();
		} else if (this.leftMouseDown && this.selectedNodes && this.startingMouseMovePosition) {
			// move selection
			this.selectedNodes.forEach((node) => {
				node.x = node.x - (this.startingMouseMovePosition.x - mouseX);
				node.y = node.y - (this.startingMouseMovePosition.y - mouseY);
			});
			this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
			this.nodeSystem.nodeRenderer.render();
		} else if (this.selectionSquare) {
			// set selectionbox
			this.selectionSquare.width = mouseX - this.selectionSquare.x;
			this.selectionSquare.height = mouseY - this.selectionSquare.y;
		} else if (this.halfConnection) {
			// connection moved
			this.halfConnection.mousePos = { x: pannedMouseX, y: pannedMouseY };
		} else return;

		this.nodeSystem.nodeRenderer.render();
	}

	onMouseUp(e: MouseEvent) {
		if (e.button == 0) {
			this.leftMouseDown = false;
		} else if (e.button == 1) {
			this.middleMouseDown = false;
			return;
		}

		if (this.selectionSquare) {
			let x1 = this.selectionSquare.x - this.nodeSystem.nodeRenderer.view.x;
			let y1 = this.selectionSquare.y - this.nodeSystem.nodeRenderer.view.y;
			let x2 = this.selectionSquare.x + this.selectionSquare.width - this.nodeSystem.nodeRenderer.view.x;
			let y2 = this.selectionSquare.y + this.selectionSquare.height - this.nodeSystem.nodeRenderer.view.y;
			// [x1, x2] = [x1, x2].sort();
			// [y1, y2] = [y1, y2].sort();
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
			const mouseX = e.pageX - this.canvas.offsetLeft - this.nodeSystem.nodeRenderer.view.x;
			const mouseY = e.pageY - this.canvas.offsetTop - this.nodeSystem.nodeRenderer.view.y;

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
			if (this.selectedNodes) {
				this.selectedNodes.forEach((node) => {
					positionNode(node, this.nodeSystem.nodeStorage, node.x, node.y);
				});
			}
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
