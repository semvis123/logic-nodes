import { Command } from './Command';
import { ToastMessage } from '../toastMessage/ToastMessage';
import type { Config } from '../Config';
import { NodeConnectionHandler } from '../handlers/NodeConnectionHandler';
import { NodeStorage } from '../NodeStorage';
import { nodeClassesMap } from '../nodes/nodes';
import type { NodeSaveData } from '../NodeSaveData';
import type { NodeSaveFile } from '../NodeSaveFile';
import { uuid } from '../utils';
import type { Node } from '../Node';
import { TableFloatingModal } from '../floatingModal/TableFloatingModal';
import type { NodeSystem } from '../NodeSystem';
import type { SaveManager } from '../SaveManager';

export class DisplayTruthTableCommand extends Command {
	nodeConnectionHandler: NodeConnectionHandler;
	nodeStorage: NodeStorage;
	config: Config;
	activeTruthTableModal: TableFloatingModal;
	saveManager: SaveManager

	async execute() {
		try {
			if (this.activeTruthTableModal) {
				this.activeTruthTableModal.remove();
				this.activeTruthTableModal = undefined;
			}
			this.nodeSystem.eventHandler.cleanup();
			this.nodeConnectionHandler = new NodeConnectionHandler();
			this.nodeStorage = new NodeStorage();
			this.config = this.nodeSystem.config;
			this.saveManager = this.nodeSystem.saveManager;

			const save = this.nodeSystem.saveManager.createSaveFile();
			for (const node of this.nodeSystem.nodeStorage.nodes) {
				if (
					node.getMetadata().category != 'Logic' &&
					node.getMetadata().nodeName != 'OutputNode' &&
					node.getMetadata().nodeName != 'InputNode' &&
					node.getMetadata().nodeName != 'LabelNode' &&
					node.getMetadata().nodeName != 'SplitterNode' &&
					node.getMetadata().nodeName != 'ConstantNode' &&
					node.getMetadata().nodeName != 'CombinationNode'
				) {
					return new ToastMessage('Truth table can only contain logic nodes.', 'danger').show();
				}
			}
			save.nodes.sort((a, b) => a.y - b.y);
			this.importNodes(save);

			const inputNodes: Node[] = [];
			const outputNodes: Node[] = [];
			// check for outputNodes
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
				return new ToastMessage('Truth table requires at least one InputNode.', 'danger').show();
			if (outputNodes.length == 0)
				return new ToastMessage('Truth table requires at least one OutputNode.', 'danger').show();

			// try all input values
			const table = [];
			const possibleInputValues = this.calculatePossibleInputs(inputNodes.length);
			possibleInputValues.forEach((x) => this.buildTable(x, inputNodes, outputNodes, table));
			this.activeTruthTableModal = new TableFloatingModal('Truth Table', table, this.nodeSystem.eventHandler);
			this.activeTruthTableModal.show();
			new ToastMessage('Created truth table.', 'success').show();
		} finally {
			this.nodeSystem.eventHandler.addEventListeners();
		}
	}

	calculatePossibleInputs(n: number) {
		const possibilities = [];
		if (n <= 0) return [];
		if (n == 1) return [[0], [1]];
		const recurse = this.calculatePossibleInputs(n - 1);
		for (const recursePossibility of recurse) {
			possibilities.push([...recursePossibility, 0]);
			possibilities.push([...recursePossibility, 1]);
		}
		return possibilities;
	}

	buildTable(inputValues: number[], inputNodes: Node[], outputNodes: Node[], table: Map<string, number>[]) {
		inputNodes.forEach((node, i) => node.outputs[0].setValue(inputValues[i]));
		let limit = 50000;
		while (this.nodeConnectionHandler.toUpdate.size > 0 && limit > 0) {
			this.nodeConnectionHandler.updateAllValues();
			limit--;
		}
		if (limit == 0) throw new ToastMessage('Circular connection detected, cannot create truth table', 'danger').show();
		const state = new Map<string, number>();
		inputNodes.forEach((x) => {
			state.set(x.getParamValue('name', 'Input'), x.outputs[0].value ? 1 : 0);
		});
		outputNodes.forEach((x) => {
			state.set(x.getParamValue('name', 'Output'), x.inputs[0].value ? 1 : 0);
		});
		table.push(state);
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
		const usedNames: string[] = [];
		let inputCount = 1;
		let outputCount = 0;
		const alphabet = 'abcdefghijklmnopqrstuvwxyz';
		nodes.forEach((node) => {
			const newNode: Node = nodeClassesMap.get(node.type).load(node, this as unknown as NodeSystem);
			const nodeNameParam = newNode.getParam('name');
			const nodeName = nodeNameParam?.value as string;
			if (usedNames.includes(nodeName)) {
				// name already used, rename
				let i = 1;
				while (usedNames.includes(nodeName + i)) {
					i++;
				}
				nodeNameParam.value = nodeName + i;
			}
			if (nodeName == 'Input') {
				// no input name, create one
				let nodeName = '';
				let a = inputCount;
				while (a > 0) {
					nodeName = alphabet[(a - 1) % alphabet.length] + nodeName;
					a = ~~(a / alphabet.length);
				}
				nodeNameParam.value = nodeName;
				inputCount++;
			} else if (nodeName == 'Output') {
				// no output name, create one
				nodeNameParam.value = 'Q' + (outputCount > 0 ? outputCount.toString() : '');
				outputCount++;
			} else if (node.type == 'CombinationNode') {
				// ensure that the instant mode is the same
				node.parameters.forEach((param) => {
					if (param.name == 'instant') {
						param.checked = true;
					}
				});
			}

			if (rename) newNode.id = uuid();
			nodeIds.set(node.id, newNode.id);
			this.nodeStorage.addNode(newNode);
			pastedNodes.push(newNode);
			usedNames.push(nodeNameParam?.value as string ?? '');
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
