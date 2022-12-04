import { FullscreenPrompt } from '../fullscreenPrompt/FullscreenPrompt';
import { Command } from './Command';
import type { NodeSaveData } from '../NodeSaveData';
import { removeOuterBrackets, uuid } from '../utils';
import { ToastMessage } from '../toastMessage/ToastMessage';

type TreeNode = {
	type: 'operator' | 'value';
	value: string;
	children: TreeNode[];
	parentNode?: NodeSaveData;
	parentTreeNode?: TreeNode;
};

type SimpleConnection = {
	from: { nodeId: string; index: number };
	to: { nodeId: string; index: number };
};

const operatorMap = {
	'+': 'OrNode',
	'|': 'OrNode',
	'\u2228': 'OrNode',
	'\u22BB': 'XorNode',
	'\u2295': 'XorNode',
	'.': 'AndNode',
	'*': 'AndNode',
	'&': 'AndNode',
	'\u2227': 'AndNode',
	"'": 'NotNode',
	'~': 'NotNode',
	'!': 'NotNode',
	'\u00AC': 'NotNode'
};

export class ConstructCircuitFromExpressionCommand extends Command {
	async execute() {
		this.nodeSystem.eventHandler.cleanup();
		try {
			if (!(this.nodeSystem.nodeStorage.nodes?.length == 0)) {
				return new ToastMessage(
					'Cannot construct circuit from expression when there are nodes in the circuit',
					'danger'
				).show();
			}
			const prompt = new FullscreenPrompt();
			const params = await prompt.requestParameters('Enter expression', [
				{
					type: 'text',
					name: 'expression',
					label: 'Expression',
					value: '',
					required: true,
					autofocus: true
				}
			]);
			if (params == null) return;
			const expression = params[0].value as string;

			if (expression == '') {
				return new ToastMessage('Expression is empty', 'danger');
			}

			this.constructCircuit(expression);
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}

	public constructCircuit(expression: string) {
		const tree = this.createTree(expression)[0];
		const nodesWithConnection = this.createNodesWithConnection(tree);
		this.nodeSystem.importNodes(nodesWithConnection);
	}

	createTree(expression: string): TreeNode[] {
		const operators = Object.keys(operatorMap);
		const outputTreeNode: TreeNode = {
			type: 'operator',
			value: '',
			children: []
		};

		// remove whitespace
		expression = expression.replace(/\s/g, '');

		// remove outer brackets if possible
		expression = removeOuterBrackets(expression);

		let bracketStack = 0;
		let foundOperator = false;
		for (const operator of operators) {
			for (let i = 0; i < expression.length; i++) {
				let char = expression[i];
				if (char == '(') {
					bracketStack++;
				} else if (char == ')') {
					bracketStack--;
				} else if (bracketStack == 0) {
					char = expression[i];
					if (char == operator) {
						const left = expression.substring(0, i);
						const right = expression.substring(i + 1);
						const leftTree = this.createTree(left);
						const rightTree = this.createTree(right);
						outputTreeNode.value = char;
						outputTreeNode.children.push(...leftTree);
						outputTreeNode.children.push(...rightTree);
						foundOperator = true;
						break;
					}
				}
			}
			if (bracketStack != 0) {
				const error = new Error('Expression contains mismatching brackets');
				new ToastMessage(error.message, 'danger').show();
				throw error;
			}

			if (foundOperator) {
				break;
			}
		}

		if (outputTreeNode.value == '') {
			outputTreeNode.type = 'value';
			outputTreeNode.value = expression;
			if (expression == '') {
				return [];
			}
		}

		return [outputTreeNode];
	}

	createNodesWithConnection(tree: TreeNode): {
		nodes: NodeSaveData[];
		connections: SimpleConnection[];
	} {
		const output = {
			nodes: [] as NodeSaveData[],
			connections: [] as SimpleConnection[]
		};

		// calculate width
		const findMaxDepth = (treeNode: TreeNode): number => {
			if (treeNode.type == 'value') {
				return 0;
			} else {
				return Math.max(...treeNode.children.map(findMaxDepth)) + 1;
			}
		};
		const width = 200 + findMaxDepth(tree) * 150;

		const inputNodes = [] as string[];
		const findInputNodes = (treeNode: TreeNode) => {
			if (
				treeNode.type == 'value' &&
				treeNode.value != '0' &&
				treeNode.value != '1' &&
				!inputNodes.includes(treeNode.value)
			) {
				inputNodes.push(treeNode.value);
			}
			treeNode.children.forEach(findInputNodes);
		};
		findInputNodes(tree);

		// sort input nodes
		inputNodes.sort((a, b) => {
			return a.localeCompare(b);
		});

		const usedInputNodeMap = new Map<string, NodeSaveData>();

		// create input nodes
		inputNodes.forEach((inputNode, index) => {
			const node = this.createInputNode(inputNode, index);
			output.nodes.push(node);
			usedInputNodeMap.set(inputNode, node);
		});

		const outputNode = {
			id: uuid(),
			type: 'OutputNode',
			x: width,
			y: 200,
			layer: 0,
			parameters: []
		};

		output.nodes.push(outputNode);
		tree.parentNode = outputNode;

		let currentDepth = 0;
		const toCreate = [tree];
		const usedInputMap = new Map<string, number>();

		while (toCreate.length > 0) {
			const current = toCreate.shift();
			const parentId = current.parentNode.id;
			const x = width - 70 - currentDepth * 70;
			let y = current.parentNode.y;
			if (current.parentTreeNode?.children.length > 1) {
				y += ((usedInputMap.get(current.parentNode.id) ?? 0) * 500) / currentDepth - 50;
			}
			if (current.type == 'value') {
				// create constant node if not already created
				if (!usedInputNodeMap.has(current.value)) {
					const node = this.createConstantNode(current.value, x, y);
					output.nodes.push(node);
					usedInputNodeMap.set(current.value, node);
				}

				const inputNode = usedInputNodeMap.get(current.value);
				output.connections.push(this.createConnection(inputNode.id, parentId, usedInputMap));
				usedInputMap.set(parentId, (usedInputMap.get(parentId) ?? 0) + 1);
			} else {
				// create operator node (and, or, not)
				const operatorNode = this.createOperatorNode(operatorMap[current.value], x, y);
				output.nodes.push(operatorNode);
				output.connections.push(this.createConnection(operatorNode.id, parentId, usedInputMap));

				usedInputMap.set(parentId, (usedInputMap.get(parentId) ?? 0) + 1);
				current.children.forEach((child) => {
					child.parentNode = operatorNode;
					child.parentTreeNode = current;
				});
				toCreate.push(...current.children);
				currentDepth++;
			}
		}

		return output;
	}

	createInputNode(name: string, amountOfInputs: number) {
		return {
			id: uuid(),
			type: 'InputNode',
			x: 50,
			y: 100 + amountOfInputs * 100,
			layer: 0,
			parameters: [
				{
					name: 'name',
					value: name
				}
			]
		};
	}

	createConstantNode(value: string, x: number, y: number) {
		return {
			id: uuid(),
			type: 'ConstantNode',
			x,
			y,
			layer: 0,
			parameters: [
				{
					name: 'value',
					value
				}
			]
		};
	}

	createOperatorNode(type: string, x: number, y: number) {
		return {
			id: uuid(),
			type: type,
			x,
			y,
			layer: 0,
			parameters: []
		};
	}

	createConnection(from: string, to: string, usedInputMap: Map<string, number>) {
		return {
			from: {
				nodeId: from,
				index: 0
			},
			to: {
				nodeId: to,
				index: usedInputMap.get(to) ?? 0
			}
		};
	}
}
