import type { NodeOutput } from '../NodeOutput';
import type { NodeSystem } from '../NodeSystem';
import { positionNode, getBoundingBoxOfMultipleNodes } from '../utils';
import { ContextMenu } from '../ContextMenu';
import type { Node } from '../Node';
import { CopyCommand } from '../commands/CopyCommand';
import { PasteCommand } from '../commands/PasteCommand';
import { Tooltip } from '../tooltip/Tooltip';

export class NodeSystemEventHandler {
	selectedNodes: Node[] | undefined;
	selectionBox: { x: number; y: number; width: number; height: number } | undefined;
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
	hasEventListeners = false;
	tooltip: Tooltip;
	tooltipTimer: NodeJS.Timer;
	activeTooltip: { node: Node; idx: number } = null;

	constructor(private nodeSystem: NodeSystem, private canvas: HTMLCanvasElement) {
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onContextMenu = this.onContextMenu.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onCopy = this.onCopy.bind(this);
		this.onPaste = this.onPaste.bind(this);
		this.onWheel = this.onWheel.bind(this);
		this.addEventListeners();
	}

	addEventListeners() {
		if (!this.hasEventListeners) {
			window.addEventListener('pointerdown', this.onMouseDown);
			window.addEventListener('pointermove', this.onMouseMove);
			window.addEventListener('pointerup', this.onMouseUp);
			window.addEventListener('contextmenu', this.onContextMenu);
			window.addEventListener('keydown', this.onKeyDown);
			window.addEventListener('copy', this.onCopy);
			window.addEventListener('paste', this.onPaste);
			window.addEventListener('wheel', this.onWheel, { passive: false });
			this.hasEventListeners = true;
		}
	}

	cleanup() {
		this.hasEventListeners = false;
		window.removeEventListener('pointerdown', this.onMouseDown);
		window.removeEventListener('pointermove', this.onMouseMove);
		window.removeEventListener('pointerup', this.onMouseUp);
		window.removeEventListener('contextmenu', this.onContextMenu);
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('copy', this.onCopy);
		window.removeEventListener('paste', this.onPaste);
		window.removeEventListener('wheel', this.onWheel);
		this.startingMouseMovePosition = undefined;
		this.halfConnection = undefined;
		this.selectionBox = undefined;
		this.leftMouseDown = false;
		this.middleMouseDown = false;
		this.tooltip?.destroy();
	}

	onWheel(e: WheelEvent) {
		e.preventDefault();
		if (this.middleMouseDown || this.contextMenu) return;
		if (e.ctrlKey) {
			// zoom
			this.nodeSystem.nodeRenderer.zoomView(e.deltaY, e.pageX, e.pageY);
			return;
		}
		this.nodeSystem.nodeRenderer.panView(-e.deltaX, -e.deltaY);
		this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
	}

	onKeyDown(e: KeyboardEvent) {
		switch (e.code) {
			case 'Delete':
			case 'Backspace':
				if (this.selectedNodes) {
					this.selectedNodes.forEach((node) => {
						this.nodeSystem.nodeStorage.removeNode(node);
					});
					this.selectedNodes = undefined;
					this.nodeSystem.nodeRenderer.requestRender();
					this.nodeSystem.snapshot();
				}
				e.preventDefault();
				break;
			case 'KeyZ':
				if (e.ctrlKey || e.metaKey) {
					if (e.shiftKey) {
						this.nodeSystem.redo();
					} else {
						this.nodeSystem.undo();
					}
					e.preventDefault();
				}
				break;
			case 'KeyY':
				if (e.ctrlKey || e.metaKey) {
					this.nodeSystem.redo();
				}
				e.preventDefault();
				break;
			default:
				break;
		}
	}

	onContextMenu(e: MouseEvent) {
		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;
		this.tooltip?.destroy();
		const {
			view: { x, y, zoom }
		} = this.nodeSystem.nodeRenderer;
		const pannedMouseX = mouseX / zoom - x;
		const pannedMouseY = mouseY / zoom - y;

		this.startingMouseMovePosition = undefined;
		if (this.contextMenu) {
			this.contextMenu.remove();
			this.contextMenu = undefined;
		}
		// show context menu
		const node = this.getNodeAt(pannedMouseX, pannedMouseY);
		if (node) {
			if (!this.selectedNodes?.includes(node)) this.selectedNodes = [node];
		} else {
			this.selectedNodes = [];
		}

		if (this.contextMenu) {
			this.contextMenu.remove();
		}
		this.contextMenu = new ContextMenu(mouseX, mouseY, this.selectedNodes, this.nodeSystem).show();

		this.nodeSystem.nodeRenderer.requestRender();
		this.selectionBox = {
			x: mouseX,
			y: mouseY,
			width: 0,
			height: 0
		};
	}

	onMouseDown(e: MouseEvent) {
		const ctxMBounds = this.contextMenu?.getBoundingClientRect();
		if (this.contextMenu) {
			if (
				!(
					e.x > ctxMBounds.x &&
					e.x - ctxMBounds.width < ctxMBounds.x &&
					e.y > ctxMBounds.y &&
					e.y - ctxMBounds.height < ctxMBounds.y
				)
			) {
				this.contextMenu.remove();
				this.contextMenu = undefined;
			}
			return;
		}
		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		const {
			view: { x, y, zoom }
		} = this.nodeSystem.nodeRenderer;
		const pannedMouseX = mouseX / zoom - x;
		const pannedMouseY = mouseY / zoom - y;

		if (e.button == 1) {
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
			this.middleMouseDown = true;
			return;
		}

		if (e.button == 0) this.leftMouseDown = true;
		if (e.button == 2) return;

		// connectors
		const connectionPointHitBox = this.calcConnectionPointHitBox();

		for (const node of this.nodeSystem.nodeStorage.nodes) {
			const inputSpacing = node.height / (node.inputs.length + 1);
			for (const input of node.inputs) {
				if (
					pannedMouseX >= node.x - connectionPointHitBox &&
					pannedMouseX <= node.x + connectionPointHitBox &&
					pannedMouseY >= node.y + inputSpacing * (input.index + 1) - connectionPointHitBox &&
					pannedMouseY <= node.y + inputSpacing * (input.index + 1) + connectionPointHitBox
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
						this.nodeSystem.snapshot();
						return;
					}
				}
			}
			const outputSpacing = node.height / (node.outputs.length + 1);
			for (const output of node.outputs) {
				for (let i = 0; i < node.outputs.length; i++) {
					if (
						pannedMouseX >= node.x + node.width - connectionPointHitBox &&
						pannedMouseX <= node.x + node.width + connectionPointHitBox &&
						pannedMouseY >= node.y + outputSpacing * (output.index + 1) - connectionPointHitBox &&
						pannedMouseY <= node.y + outputSpacing * (output.index + 1) + connectionPointHitBox
					) {
						const mousePos = { x: pannedMouseX, y: pannedMouseY };
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
				this.nodeSystem.nodeRenderer.requestRender();
				return;
			}
			this.selectedNodes = [node];
			this.nodeSystem.nodeRenderer.requestRender();
			return;
		}
		this.selectedNodes = undefined;
		this.selectionBox = {
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

		let noNeedToRender = false;

		const {
			view: { x, y, zoom }
		} = this.nodeSystem.nodeRenderer;
		const pannedMouseX = mouseX / zoom - x;
		const pannedMouseY = mouseY / zoom - y;

		if (this.middleMouseDown && this.startingMouseMovePosition) {
			// pan
			this.nodeSystem.nodeRenderer.panView(
				-(this.startingMouseMovePosition.x - mouseX),
				-(this.startingMouseMovePosition.y - mouseY)
			);
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
		} else if (this.leftMouseDown && this.selectedNodes && this.startingMouseMovePosition) {
			// move selection
			this.selectedNodes.forEach((node) => {
				node.x = node.x - (this.startingMouseMovePosition.x - mouseX) / zoom;
				node.y = node.y - (this.startingMouseMovePosition.y - mouseY) / zoom;
			});
			this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
			this.nodeSystem.nodeRenderer.requestRender();
		} else if (this.selectionBox) {
			// set selectionBox
			this.selectionBox.width = mouseX - this.selectionBox.x;
			this.selectionBox.height = mouseY - this.selectionBox.y;
		} else if (this.halfConnection) {
			// connection moved
			this.halfConnection.mousePos = { x: pannedMouseX, y: pannedMouseY };
		} else {
			noNeedToRender = true;
		}
		
		const connectionPointHitBox = this.calcConnectionPointHitBox();

		// check if hovering on a connection point and display information
		let isHoveringConnectionPoint = false;
		this.nodeSystem.nodeStorage.nodes.forEach((node) => {
			const inputSpacing = node.height / (node.inputs.length + 1);
			const outputSpacing = node.height / (node.outputs.length + 1);
			[
				{ points: node.inputs, spacing: inputSpacing, xOffset: 0 },
				{ points: node.outputs, spacing: outputSpacing, xOffset: node.width }
			].forEach(({ points, spacing, xOffset }) => {
				points.forEach((point) => {
					if (
						pannedMouseX >= node.x + xOffset - connectionPointHitBox &&
						pannedMouseX <= node.x + xOffset + connectionPointHitBox &&
						pannedMouseY >= node.y + spacing * (point.index + 1) - connectionPointHitBox &&
						pannedMouseY <= node.y + spacing * (point.index + 1) + connectionPointHitBox
					) {
						if (isHoveringConnectionPoint) return;
						isHoveringConnectionPoint = true;
						if (this.activeTooltip?.node == node && this.activeTooltip?.idx == point.index) return;
						if (this.tooltipTimer) clearTimeout(this.tooltipTimer);

						this.tooltipTimer = setTimeout(() => {
							this.tooltip?.destroy();
							this.tooltip = new Tooltip(mouseX, mouseY, point.name);
							this.activeTooltip = { node, idx: point.index };
							document.body.appendChild(this.tooltip.createElement());
						}, 300);
					}
				});
			});
		});

		if (isHoveringConnectionPoint) {
			noNeedToRender = false;
		} else {
			this.tooltip?.destroy();
			this.tooltip = null;
			clearTimeout(this.tooltipTimer);
			this.tooltipTimer = null;
			this.activeTooltip = null;
		}

		if (!noNeedToRender) {
			this.nodeSystem.nodeRenderer.requestRender();
		}
	}

	onMouseUp(e: MouseEvent) {
		if (e.button == 0) {
			this.leftMouseDown = false;
		} else if (e.button == 1) {
			this.middleMouseDown = false;
			return;
		}
		if (this.contextMenu) {
			this.selectionBox = undefined;
			return;
		}
		if (this.selectionBox) {
			const {
				view: { x, y, zoom }
			} = this.nodeSystem.nodeRenderer;
			let x1 = this.selectionBox.x / zoom - x;
			let y1 = this.selectionBox.y / zoom - y;
			let x2 = (this.selectionBox.x + this.selectionBox.width) / zoom - x;
			let y2 = (this.selectionBox.y + this.selectionBox.height) / zoom - y;
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
			this.selectionBox = undefined;
			this.startingMouseMovePosition = undefined;
		} else if (this.halfConnection) {
			const mouseX = e.pageX - this.canvas.offsetLeft;
			const mouseY = e.pageY - this.canvas.offsetTop;
			const {
				view: { x, y, zoom }
			} = this.nodeSystem.nodeRenderer;
			const pannedMouseX = mouseX / zoom - x;
			const pannedMouseY = mouseY / zoom - y;

			// connectors
			const connectionPointHitBox = this.calcConnectionPointHitBox();
			for (const node of this.nodeSystem.nodeStorage.nodes) {
				const inputSpacing = node.height / (node.inputs.length + 1);
				for (const input of node.inputs) {
					if (
						pannedMouseX >= node.x - connectionPointHitBox &&
						pannedMouseX <= node.x + connectionPointHitBox &&
						pannedMouseY >= node.y + inputSpacing * (input.index + 1) - connectionPointHitBox &&
						pannedMouseY <= node.y + inputSpacing * (input.index + 1) + connectionPointHitBox
					) {
						this.nodeSystem.nodeConnectionHandler.addConnection(this.halfConnection.output, input);
						this.nodeSystem.snapshot();
					}
				}
			}
		} else {
			if (this.selectedNodes?.length) {
				const box = getBoundingBoxOfMultipleNodes(this.selectedNodes);
				const translation = positionNode(
					box,
					box.x,
					box.y,
					this.nodeSystem.nodeStorage,
					this.nodeSystem.config,
					this.selectedNodes
				);
				this.selectedNodes.forEach((node) => {
					node.x += translation.x;
					node.y += translation.y;
				});
				this.nodeSystem.snapshot();
			}
			this.selectedNodes = undefined;
		}
		this.halfConnection = undefined;
		this.nodeSystem.nodeRenderer.requestRender();
	}

	async onCopy() {
		new CopyCommand(this.nodeSystem, this.selectedNodes).execute();
	}

	onPaste(e: ClipboardEvent) {
		new PasteCommand(this.nodeSystem, e).execute();
	}

	getNodeAt(x: number, y: number) {
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
				return node;
			}
		}
		return undefined;
	}

	calcConnectionPointHitBox(){
		return Math.max(this.nodeSystem.config.theme.connectionPointRadius, 5 / this.nodeSystem.nodeRenderer.view.zoom);
	}
}
