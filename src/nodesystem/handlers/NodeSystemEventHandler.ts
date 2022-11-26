import type { NodeSystem } from '../NodeSystem';
import { positionNode, getBoundingBoxOfMultipleNodes } from '../utils';
import { ContextMenu } from '../ContextMenu';
import type { Node } from '../Node';
import { CopyCommand } from '../commands/CopyCommand';
import { PasteCommand } from '../commands/PasteCommand';
import { Tooltip } from '../tooltip/Tooltip';
import type { EditorState } from '../EditorState';

export class NodeSystemEventHandler {
	selectedNodes: Node[] | undefined;
	startingMouseMovePosition: { x: number; y: number } | undefined;
	selectionStarted: boolean;
	middleMouseDown: boolean;
	leftMouseDown: boolean;
	hasEventListeners = false;
	tooltip: Tooltip;
	tooltipTimer: NodeJS.Timer;
	activeTooltip: { node: Node; idx: number } = null;
	editorState: EditorState;

	constructor(private nodeSystem: NodeSystem, private canvas: HTMLCanvasElement) {
		this.editorState = nodeSystem.editorState;
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
		this.editorState.halfConnection = undefined;
		this.editorState.selectionBox = undefined;
		this.leftMouseDown = false;
		this.middleMouseDown = false;
		this.tooltip?.destroy();
	}

	onWheel(e: WheelEvent) {
		e.preventDefault();
		if (this.middleMouseDown || this.editorState.contextMenu) return;
		if (e.ctrlKey) {
			// zoom
			this.nodeSystem.nodeRenderer.zoomView(e.deltaY, e.pageX, e.pageY);
			return;
		}
		this.nodeSystem.nodeRenderer.panView(-e.deltaX, -e.deltaY);
		this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
	}

	onKeyDown(e: KeyboardEvent) {
		this.nodeSystem.shortcutManager.executeShortcut(e);
	}

	onContextMenu(e: MouseEvent) {
		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;
		this.tooltip?.destroy();
		const {
			view: { x, y, zoom }
		} = this.nodeSystem.editorState;
		const pannedMouseX = mouseX / zoom - x;
		const pannedMouseY = mouseY / zoom - y;

		this.startingMouseMovePosition = undefined;
		if (this.editorState.contextMenu) {
			this.editorState.contextMenu.remove();
			this.editorState.contextMenu = undefined;
		}
		// show context menu
		const node = this.getNodeAt(pannedMouseX, pannedMouseY);
		if (node) {
			if (!this.editorState.selectedNodes?.includes(node)) this.editorState.selectedNodes = [node];
		} else {
			this.editorState.selectedNodes = [];
		}

		if (this.editorState.contextMenu) {
			this.editorState.contextMenu.remove();
		}
		this.editorState.contextMenu = new ContextMenu(mouseX, mouseY, this.editorState.selectedNodes, this.nodeSystem);
		this.editorState.contextMenu.show();

		this.nodeSystem.nodeRenderer.requestRender();
		this.editorState.selectionBox = {
			x: mouseX,
			y: mouseY,
			width: 0,
			height: 0
		};
	}

	onMouseDown(e: MouseEvent) {
		const ctxMBounds = this.editorState.contextMenu?.menu?.getBoundingClientRect();
		if (this.editorState.contextMenu) {
			if (
				!(
					e.x > ctxMBounds.x &&
					e.x - ctxMBounds.width < ctxMBounds.x &&
					e.y > ctxMBounds.y &&
					e.y - ctxMBounds.height < ctxMBounds.y
				)
			) {
				this.editorState.contextMenu.remove();
				this.editorState.contextMenu = undefined;
			}
			return;
		}
		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		const {
			view: { x, y, zoom }
		} = this.nodeSystem.editorState;
		const pannedMouseX = mouseX / zoom - x;
		const pannedMouseY = mouseY / zoom - y;

		if (e.button == 1) {
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
			this.middleMouseDown = true;
			return;
		}

		if (e.button == 0) {
			this.leftMouseDown = true;
			if (this.nodeSystem.minimap?.handleMouseDown(mouseX, mouseY)) {
				return;
			}
		}
		if (e.button == 2) return;

		// connectors
		const connectionPointHitBox = this.calcConnectionPointHitBox();

		for (const node of this.nodeSystem.nodeStorage.nodes) {
			if (node.layer != this.nodeSystem.editorState.layer) continue;
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
						this.editorState.halfConnection = { output, outputPos, mousePos };
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
						this.editorState.halfConnection = { output, outputPos, mousePos };
						return;
					}
				}
			}
		}

		const node = this.getNodeAt(pannedMouseX, pannedMouseY);
		if (node) {
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
			if (this.editorState.selectedNodes?.length) {
				return;
			}
			if (!node.onclick(e, { x: pannedMouseX - node.x, y: pannedMouseY - node.y })) {
				this.nodeSystem.nodeRenderer.requestRender();
				return;
			}
			this.editorState.selectedNodes = [node];
			this.nodeSystem.nodeRenderer.requestRender();
			return;
		}
		this.editorState.selectedNodes = undefined;
		this.editorState.selectionBox = {
			x: mouseX,
			y: mouseY,
			width: 0,
			height: 0
		};
	}

	onMouseMove(e: MouseEvent) {
		if (this.editorState.contextMenu) return;

		const mouseX = e.pageX - this.canvas.offsetLeft;
		const mouseY = e.pageY - this.canvas.offsetTop;

		let noNeedToRender = false;

		const {
			view: { x, y, zoom }
		} = this.nodeSystem.editorState;
		const pannedMouseX = mouseX / zoom - x;
		const pannedMouseY = mouseY / zoom - y;

		if (this.nodeSystem.minimap?.handleMouseMove(mouseX, mouseY)) {
			return;
		}

		if (this.middleMouseDown && this.startingMouseMovePosition) {
			// pan
			this.nodeSystem.nodeRenderer.panView(
				-(this.startingMouseMovePosition.x - mouseX),
				-(this.startingMouseMovePosition.y - mouseY)
			);
			this.startingMouseMovePosition = { x: mouseX, y: mouseY };
		} else if (this.leftMouseDown && this.editorState.selectedNodes && this.startingMouseMovePosition) {
			// move selection
			this.editorState.selectedNodes.forEach((node) => {
				node.x = node.x - (this.startingMouseMovePosition.x - mouseX) / zoom;
				node.y = node.y - (this.startingMouseMovePosition.y - mouseY) / zoom;
			});
			this.startingMouseMovePosition = { x: e.pageX, y: e.pageY };
			this.nodeSystem.nodeRenderer.requestRender();
		} else if (this.editorState.selectionBox) {
			// set selectionBox
			this.editorState.selectionBox.width = mouseX - this.editorState.selectionBox.x;
			this.editorState.selectionBox.height = mouseY - this.editorState.selectionBox.y;
		} else if (this.editorState.halfConnection) {
			// connection moved
			this.editorState.halfConnection.mousePos = { x: pannedMouseX, y: pannedMouseY };
		} else {
			noNeedToRender = true;
		}

		const connectionPointHitBox = this.calcConnectionPointHitBox();

		// check if hovering on a connection point and display information
		this.tooltip?.destroy();
		if (noNeedToRender && this.nodeSystem.editorState.view.zoom > 0.5) {
			this.tooltip = null;
			this.activeTooltip = null;
			if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
			this.tooltipTimer = setTimeout(() => {
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
								if (this.activeTooltip?.node == node && this.activeTooltip?.idx == point.index) return;

								this.tooltip?.destroy();
								this.tooltip = new Tooltip(mouseX, mouseY, point.name);
								this.activeTooltip = { node, idx: point.index };
								document.body.appendChild(this.tooltip.createElement());
							}
						});
					});
				});
			}, 300);
		}

		if (!noNeedToRender) {
			this.nodeSystem.nodeRenderer.requestRender();
		}
	}

	onMouseUp(e: MouseEvent) {
		if (e.button == 0) {
			this.leftMouseDown = false;
			this.nodeSystem.minimap?.handleMouseUp();
		} else if (e.button == 1) {
			this.middleMouseDown = false;
			return;
		}
		if (this.editorState.contextMenu) {
			this.editorState.selectionBox = undefined;
			return;
		}
		if (this.editorState.selectionBox) {
			const {
				view: { x, y, zoom }
			} = this.nodeSystem.editorState;
			let x1 = this.editorState.selectionBox.x / zoom - x;
			let y1 = this.editorState.selectionBox.y / zoom - y;
			let x2 = (this.editorState.selectionBox.x + this.editorState.selectionBox.width) / zoom - x;
			let y2 = (this.editorState.selectionBox.y + this.editorState.selectionBox.height) / zoom - y;
			[x1, x2] = [x1, x2].sort((a, b) => a - b);
			[y1, y2] = [y1, y2].sort((a, b) => a - b);

			const nodes = this.nodeSystem.nodeStorage.nodes.filter((node) => {
				return node.x + node.width >= x1 && node.x <= x2 && node.y + node.height >= y1 && node.y <= y2 && node.layer == this.nodeSystem.editorState.layer;
			});
			this.editorState.selectedNodes = nodes;
			this.editorState.selectionBox = undefined;
			this.startingMouseMovePosition = undefined;
		} else if (this.editorState.halfConnection) {
			const mouseX = e.pageX - this.canvas.offsetLeft;
			const mouseY = e.pageY - this.canvas.offsetTop;
			const {
				view: { x, y, zoom }
			} = this.nodeSystem.editorState;
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
						this.nodeSystem.nodeConnectionHandler.addConnection(this.editorState.halfConnection.output, input);
						this.nodeSystem.snapshot();
					}
				}
			}
		} else {
			if (this.editorState.selectedNodes?.length) {
				const box = getBoundingBoxOfMultipleNodes(this.editorState.selectedNodes);
				const translation = positionNode(
					box,
					box.x,
					box.y,
					this.nodeSystem.nodeStorage,
					this.nodeSystem.config,
					this.editorState.layer,
					this.editorState.selectedNodes
				);
				this.editorState.selectedNodes.forEach((node) => {
					node.x += translation.x;
					node.y += translation.y;
				});
				this.nodeSystem.snapshot();
			}
			this.editorState.selectedNodes = undefined;
		}
		this.editorState.halfConnection = undefined;
		this.nodeSystem.nodeRenderer.requestRender();
	}

	async onCopy() {
		new CopyCommand(this.nodeSystem).execute();
	}

	onPaste(e: ClipboardEvent) {
		new PasteCommand(this.nodeSystem, e).execute();
	}

	getNodeAt(x: number, y: number) {
		for (const node of this.nodeSystem.nodeStorage.nodes) {
			if (node.layer != this.nodeSystem.editorState.layer) continue;
			if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
				return node;
			}
		}
		return undefined;
	}

	calcConnectionPointHitBox() {
		return Math.max(this.nodeSystem.config.theme.connectionPointRadius, 5);
	}
}
