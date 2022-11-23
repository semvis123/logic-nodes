import { Command } from './Command';
import { ToastMessage } from '../toastMessage/ToastMessage';
import { Config } from '../Config';
import { NodeConnectionHandler } from '../handlers/NodeConnectionHandler';
import { NodeStorage } from '../NodeStorage';
import { nodeClassesMap } from '../nodes/nodes';
import type { NodeSaveData } from '../NodeSaveData';
import type { NodeSaveFile } from '../NodeSaveFile';
import { removeOuterBrackets, uuid } from '../utils';
import type { Node } from '../Node';
import type { NodeInput } from '../NodeInput';
import { TextFloatingModal } from '../floatingModal/TextFloatingModal';
import type { NodeSystem } from '../NodeSystem';

type LogicNotation = {
	or: string;
	and: string;
	not: string;
	xor: string;
	notLocation?: string;
}

export const logicNotations: LogicNotation[] = [
	{
		or: ' || ',
		and: ' && ',
		not: ' !',
		xor: ' ^ '
	},
	{
		or: ' or ',
		and: ' and ',
		not: 'not ',
		xor: ' xor '
	},
	{
		or: ' \u2228 ',
		and: ' \u2227 ',
		not: '\u00AC',
		xor: ' \u22BB '
	},
	{
		or: ' + ',
		and: ' . ',
		not: '\'',
		xor: ' \u2295 ',
		notLocation: 'after',
	},
	{
		or: ' v ',
		and: ' ^ ',
		not: ' ~ ',
		xor: ' \u2295 '
	},
];


export class CreateBooleanExpressionCommand extends Command {
	nodeConnectionHandler: NodeConnectionHandler;
	nodeStorage: NodeStorage;
	config: Config;
	activeModal: TextFloatingModal = null;

	async execute() {
		if (this.activeModal) {
			this.activeModal.remove();
		}
		try {
			this.nodeSystem.eventHandler.cleanup();
			this.nodeConnectionHandler = new NodeConnectionHandler();
			this.nodeStorage = new NodeStorage();
			this.config = new Config();

			const save = this.nodeSystem.saveManager.createSaveFile();
			for (const node of this.nodeSystem.nodeStorage.nodes) {
				if (
					node.getMetadata().category != 'Logic' &&
					node.getMetadata().nodeName != 'OutputNode' &&
					node.getMetadata().nodeName != 'InputNode' &&
					node.getMetadata().nodeName != 'LabelNode' &&
					node.getMetadata().nodeName != 'SplitterNode' &&
					node.getMetadata().nodeName != 'ConstantNode'
				) {
					return new ToastMessage('Boolean expression can only contain logic nodes.', 'danger').show();
				}
			}
			save.nodes.sort((a, b) => a.y - b.y);
			this.importNodes(save);

			const inputNodes: Node[] = [];
			const outputNodes: Node[] = [];
			for (const node of this.nodeStorage.nodes) {
				if (node.getMetadata().nodeName == 'OutputNode') {
					outputNodes.push(node);
					continue;
				}
				if (node.getMetadata().nodeName == 'InputNode') {
					inputNodes.push(node);
					continue;
				}
			}

			if (inputNodes.length == 0)
				return new ToastMessage('Boolean expression requires at least one InputNode.', 'danger').show();
			if (outputNodes.length == 0)
				return new ToastMessage('Boolean expression requires at least one OutputNode.', 'danger').show();

			let allExpressions = "";
			for (const node of outputNodes) {
				let output = this.createBooleanExpression(node, logicNotations[this.config.private.logicNotation]);
				output = removeOuterBrackets(output);
	
				// ask wolfram alpha for a simplified version
				if (this.config.private.wolframAlphaEnabled) {
					try {
						const wolframCorrectNotation = this.createBooleanExpression(node, logicNotations[1]);
						const response = await fetch(
							`https://api.wolframalpha.com/v2/query?input=simplify%20${wolframCorrectNotation}&appid=${this.config.private.wolframAppId}`
						);
						const xml = await response.text();
						const parser = new DOMParser();
						const xmlDoc = parser.parseFromString(xml, 'text/xml');
						const pod = xmlDoc.getElementsByTagName('pod')[1];
						const subpod = pod.getElementsByTagName('subpod')[0];
						const plaintext = subpod.getElementsByTagName('plaintext')[0];
						const simplifiedOutput = plaintext.childNodes[0].nodeValue;
						if (!simplifiedOutput.includes('already')) {
							output += `\n\nSimplified:\n\n ${simplifiedOutput}`;
						}
					} catch (e) {
						console.log(e);
					}
				}
				if (outputNodes.length > 1) {
					allExpressions += `Output ${node.getParamValue('name', 'Q')}: \n${output}\n\n`;
				} else {
					allExpressions += output;
				}
			} 

			this.activeModal = new TextFloatingModal('Boolean expression', allExpressions, this.nodeSystem.eventHandler);
			this.activeModal.show();
			new ToastMessage('Created boolean expression.', 'success').show();
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}

	createBooleanExpression(node: Node, notation: LogicNotation): string {
		// ((a + b) . (a . b))'
		if (!node) return '0';

		const recurseValues = [];
		for (const input of node.inputs) {
			// get the node connected to the input
			const fromNode = this.getNodeForInput(input);
			recurseValues.push(this.createBooleanExpression(fromNode, notation));
		}

		const not = (value: string): string => {
			if (notation.notLocation == 'after') {
				return `${value}${notation.not}`;
			}
			return `${notation.not}${value}`;
		};

		switch (node?.getMetadata().nodeName) {
			case 'InputNode': {
				return node.getParamValue('name', 'input');
			}
			case 'OrNode': {
				return `(${recurseValues.join(notation.or)})`;
			}
			case 'NandNode': {
				return not(`(${recurseValues.join(notation.and)})`);
			}
			case 'NorNode': {
				return not(`(${recurseValues.join(notation.or)})`);
			}
			case 'XorNode': {
				if (this.config.private.useXORSymbol) {
					return `(${recurseValues.join(notation.xor)})`;
				}

				return `(${recurseValues[0]}${notation.and}${not(recurseValues[1])}${notation.or}${not(recurseValues[0])}${notation.and}${recurseValues[1]})`;
			}
			case 'AndNode': {
				return `(${recurseValues.join(notation.and)})`;
			}
			case 'NotNode': {
				return not(`${recurseValues[0]}`);
			}
			case 'OutputNode': {
				return recurseValues[0];
			}
			case 'SplitterNode': {
				return recurseValues[0];
			}
			case 'ConstantNode': {
				return node.getParamValue('value', '0');
			}
		}
		return '0';
	}

	getNodeForInput(toInput: NodeInput) {
		for (const [output, inputs] of this.nodeConnectionHandler.connections) {
			for (const input of inputs) {
				if (input == toInput) {
					return output.node;
				}
			}
		}
		return null;
	}

	importNodes(
		data: {
			nodes: NodeSaveData[];
			connections: NodeSaveFile['connections'];
		},
		rename = false
	) {
		const nodes: NodeSaveData[] = data.nodes;
		const nodeIds = new Map<string, string>();
		const pastedNodes: Node[] = [];
		let inputCount = 1;
		let outputCount = 0;
		const alphabet = 'abcdefghijklmnopqrstuvwxyz';
		nodes.forEach((node) => {
			const newNode: Node = nodeClassesMap.get(node.type).load(node, this as unknown as NodeSystem);
			const nodeNameParam = newNode.getParam('name');
			if (nodeNameParam?.value == 'Input') {
				// no input name, create one
				let nodeName = '';
				let a = inputCount;
				while (a > 0) {
					nodeName = alphabet[(a - 1) % alphabet.length] + nodeName;
					a = ~~(a / alphabet.length);
				}
				nodeNameParam.value = nodeName;
				inputCount++;
			} else if (nodeNameParam?.value == 'Output') {
				// no output name, create one
				nodeNameParam.value = 'Q' + (outputCount > 0 ? outputCount.toString() : '');
				outputCount++;
			}
			if (rename) newNode.id = uuid();
			nodeIds.set(node.id, newNode.id);
			this.nodeStorage.addNode(newNode);
			pastedNodes.push(newNode);
		});

		for (const connection of data.connections) {
			const fromNode = this.nodeStorage.getNodeById(nodeIds.get(connection.from.nodeId));
			const toNode = this.nodeStorage.getNodeById(nodeIds.get(connection.to.nodeId));
			if (fromNode && toNode) {
				this.nodeConnectionHandler.addConnection(
					fromNode.outputs[connection.from.index],
					toNode.inputs[connection.to.index]
				);
			}
		}
	}
}
