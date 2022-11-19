import type { NodeParameter } from './fullscreenPrompt/FullscreenPrompt';
import type { NodeSystem } from './NodeSystem';
import type { NodeSaveData } from './NodeSaveData';
import type { Node } from './Node';
export interface NodeConstructor {
	new (id: string, x: number, y: number, layer: number, nodeSystem: NodeSystem, parameters?: NodeParameter[]);
	load(save: NodeSaveData, nodeSystem: NodeSystem): Node;
}
